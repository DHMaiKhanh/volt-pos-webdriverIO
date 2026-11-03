/**
 * VP-4566 — Customer Group names may repeat (POS side).
 *
 * TC catalogue: docs/screens/customer-group/customer-group-test-cases.md
 * (TC-CUSTGROUP-01…09). Driven through Home → Quick Checkout → new phone → Done →
 * quick-add dialog → "Select customer group" → "Add group" popover.
 *
 * The cases share state in file order: TC-03 creates the duplicate pair that
 * TC-01/07/09 rely on, TC-06 creates the trimmed group TC-07/08 edit.
 *
 * POS cannot delete a group, so every run leaves its groups (random suffix) on
 * the dev merchant. Orders opened by the quick-add flow are deleted afterwards.
 */

import { expect } from '@wdio/globals';
import { VqcHome, btn } from '../../../src/constants/testids.voltqc-pos.js';
import { VqhCustomer, VqhDialog, VqhGroup, inDlg } from '../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import {
  cleanupOrders,
  closeCustomerDialog,
  closeStrayDialogs,
  created,
  currentOrderId,
  fmtPhone,
  randomPhone,
  typeCustomerPhone,
  uniqueName,
  waitOrderId,
} from '../../../src/pages/voltqc/home-pend/homePendProbe.js';
import { quickCheckout } from '../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import type { VqcQuery } from '../../../src/constants/testids.voltqc-pos.js';
import { Tag, title } from '../../../src/types/testTags.js';

const dupName = uniqueName('QC Dup');
const trimName = uniqueName('QC Trim');

interface GroupRow {
  /** Raw label text, NOT trimmed — TC-06 checks the stored name. */
  raw: string;
  checked: boolean;
}

/** Every row of the open "Add group" popover, in display order. */
function groupRows(): Promise<GroupRow[]> {
  return browser.execute((editCss: string) => {
    const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
    return Array.from(document.querySelectorAll(editCss))
      .filter(visible)
      .map((b) => {
        const row = b.parentElement as HTMLElement;
        // the leaf element holding the name — the row itself carries layout whitespace
        const leaf = Array.from(row.querySelectorAll('*')).find(
          (e) => !b.contains(e) && e.children.length === 0 && (e.textContent ?? '').trim() !== '',
        );
        const label = leaf?.textContent ?? '';
        const cb = row.querySelector('[role="checkbox"]');
        return { raw: label, checked: cb?.getAttribute('aria-checked') === 'true' };
      });
  }, VqhGroup.editCss);
}

const rowsNamed = async (name: string): Promise<GroupRow[]> =>
  (await groupRows()).filter((r) => r.raw.trim() === name);

/** Tag the pencil of the `nth` row named `name` (negative = from the end) and return a chain to it. */
async function editButtonOf(name: string, nth = -1): Promise<VqcQuery> {
  const ok = await browser.execute(
    (editCss: string, want: string, n: number) => {
      document.querySelectorAll('[data-qc-edit]').forEach((e) => e.removeAttribute('data-qc-edit'));
      const hits = Array.from(document.querySelectorAll(editCss)).filter((b) => {
        const row = b.parentElement as HTMLElement;
        return (row.textContent ?? '').replace(b.textContent ?? '', '').trim() === want;
      });
      const el = hits[n < 0 ? hits.length + n : n];
      if (!el) return false;
      el.setAttribute('data-qc-edit', '1');
      return true;
    },
    VqhGroup.editCss,
    name,
    nth,
  );
  if (!ok) throw new Error(`No "Edit group name" pencil for group "${name}".`);
  return { css: '[data-qc-edit="1"]', nth: 0 };
}

/** Open the quick-add dialog for a fresh phone (when not open yet) and the group popover. */
async function openGroupPopover(): Promise<void> {
  if (await P.has(VqhGroup.popoverTitle)) return;
  if (!(await P.has(VqhDialog.quickAdd))) {
    const phone = randomPhone();
    await quickCheckout();
    await typeCustomerPhone(phone);
    expect(await P.inputValue(VqcHome.customerInput)).toBe(fmtPhone(phone));
    await P.clickQ(VqcHome.doneButton);
    await P.waitFor(VqhDialog.quickAdd, 10_000, 'quick-add dialog');
  }
  await P.clickQ(inDlg(VqhDialog.quickAdd, { role: 'combobox', nth: 0 }));
  await P.waitFor(VqhGroup.popoverTitle, 5_000, '"Add group"');
}

/** New Group → type → Create. Returns true when the dialog closed (group created). */
async function createGroup(name: string): Promise<boolean> {
  await openGroupPopover();
  await P.clickQ(btn('New Group', 0));
  await P.waitFor(VqhGroup.newDialog, 5_000, 'New Group dialog');
  await P.fillQ([VqhGroup.newDialog, VqhGroup.nameInput], name);
  await P.clickQ([VqhGroup.newDialog, btn('Create', 0)]);
  const closed = await P.poll(
    async () => !(await P.has(VqhGroup.newDialog)) || (await P.has(VqhGroup.required)),
    (v) => v,
    8_000,
  );
  return closed && !(await P.has(VqhGroup.newDialog));
}

/** Pencil of the last row named `from` → type `to` → Save. Returns true when the dialog closed. */
async function renameGroup(from: string, to: string): Promise<boolean> {
  await openGroupPopover();
  await P.clickQ(await editButtonOf(from));
  await P.waitFor(VqhGroup.editDialog, 5_000, 'Edit Group dialog');
  await P.fillQ([VqhGroup.editDialog, VqhGroup.nameInput], to);
  await P.clickQ([VqhGroup.editDialog, btn('Save', 0)]);
  await P.poll(
    async () => !(await P.has(VqhGroup.editDialog)) || (await P.has(VqhGroup.required)),
    (v) => v,
    8_000,
  );
  return !(await P.has(VqhGroup.editDialog));
}

/** Count rows named `name` once the popover has re-rendered to `want`. */
const waitRowCount = async (name: string, want: number): Promise<number> =>
  P.poll(
    async () => (await rowsNamed(name)).length,
    (n) => n === want,
    8_000,
  );

describe('VP-4566 customer group — duplicate names (POS)', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    for (let i = 0; i < 4; i += 1) await closeCustomerDialog().catch(() => undefined);
    await closeStrayDialogs().catch(() => undefined);
    const id = await currentOrderId().catch(() => '');
    if (id) created.add(id);
    await cleanupOrders();
  });

  it(
    title(
      'Empty name → "Group name is required.", nothing created (TC-CUSTGROUP-02)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openGroupPopover();
      const before = (await groupRows()).length;
      expect(await createGroup('')).toBe(false);
      expect(await P.has([VqhGroup.newDialog, VqhGroup.required])).toBe(true);
      await P.escape();
      await settle(300);
      await openGroupPopover();
      expect((await groupRows()).length).toBe(before);
    },
  );

  it(
    title(
      'A second group with an existing name is created and ticked (TC-CUSTGROUP-03)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      expect(await createGroup(dupName)).toBe(true);
      expect(await waitRowCount(dupName, 1)).toBe(1);
      expect(await createGroup(dupName)).toBe(true);
      expect(await P.has({ textRe: 'already in use', flags: 'i', nth: 0 })).toBe(false);
      expect(await waitRowCount(dupName, 2)).toBe(2);
      expect((await rowsNamed(dupName)).some((r) => r.checked)).toBe(true);
    },
  );

  it(
    title(
      'The "Add group" list shows every same-name group, each with its own pencil (TC-CUSTGROUP-01)',
      Tag.REGRESSION,
    ),
    async () => {
      await openGroupPopover();
      const rows = await rowsNamed(dupName);
      expect(rows.length).toBe(2);
      // re-open: the list comes back from the server, not from the creating dialog
      await P.escape();
      await settle(300);
      await openGroupPopover();
      expect(await waitRowCount(dupName, 2)).toBe(2);
    },
  );

  it(
    title('Same name in another case is a separate group (TC-CUSTGROUP-04)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const lower = dupName.toLowerCase();
      expect(await createGroup(lower)).toBe(true);
      expect(await waitRowCount(lower, 1)).toBe(1);
      expect((await rowsNamed(dupName)).length).toBe(2);
    },
  );

  it(
    title('Whitespace-only name → "Group name is required." (TC-CUSTGROUP-05)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await openGroupPopover();
      const before = (await groupRows()).length;
      expect(await createGroup('     ')).toBe(false);
      expect(await P.has([VqhGroup.newDialog, VqhGroup.required])).toBe(true);
      await P.escape();
      await settle(300);
      await openGroupPopover();
      expect((await groupRows()).length).toBe(before);
    },
  );

  it(
    title('Leading/trailing spaces are trimmed on save (TC-CUSTGROUP-06)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      expect(await createGroup(`   ${trimName}   `)).toBe(true);
      expect(await waitRowCount(trimName, 1)).toBe(1);
      const [row] = await rowsNamed(trimName);
      expect(row?.raw).toBe(trimName);
    },
  );

  it(
    title(
      'Edit: whitespace-only name → "Group name is required.", name kept (TC-CUSTGROUP-08)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      expect(await renameGroup(trimName, '   ')).toBe(false);
      expect(await P.has([VqhGroup.editDialog, VqhGroup.required])).toBe(true);
      await P.escape();
      await settle(300);
      await openGroupPopover();
      expect(await waitRowCount(trimName, 1)).toBe(1);
    },
  );

  it(
    title('Edit: rename to an existing group name saves (TC-CUSTGROUP-07)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      expect(await renameGroup(trimName, dupName)).toBe(true);
      expect(await waitRowCount(trimName, 0)).toBe(0);
      expect(await waitRowCount(dupName, 3)).toBe(3);
    },
  );

  it(
    title(
      'A new customer saved with one of the same-name groups gets that chip; the older ones stay unticked (TC-CUSTGROUP-09)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const customer = uniqueName('QC VP4566');
      await openGroupPopover();
      const before = (await rowsNamed(dupName)).length;
      expect(await createGroup(dupName)).toBe(true);
      expect(await waitRowCount(dupName, before + 1)).toBe(before + 1);
      const rows = await rowsNamed(dupName);
      expect(rows.filter((r) => r.checked).length).toBe(1);
      await P.clickQ(inDlg(VqhDialog.quickAdd, { role: 'combobox', nth: 0 }));
      await P.waitGoneQ(VqhGroup.popoverTitle, 5_000);
      await P.fillQ(inDlg(VqhDialog.quickAdd, VqhCustomer.nameBox), customer);
      await P.clickQ(inDlg(VqhDialog.quickAdd, btn('Save', 0)));
      await P.waitGoneQ(VqhDialog.quickAdd, 10_000);
      created.add(await waitOrderId());
      expect(
        await P.poll(
          () => P.textOf(VqhCustomer.bar),
          (x) => x.includes(customer),
          10_000,
        ),
      ).toContain(customer);
      expect(await P.texts({ css: VqhCustomer.groupChipCss })).toEqual([dupName]);
    },
  );
});
