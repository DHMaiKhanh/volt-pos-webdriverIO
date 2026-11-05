/**
 * VP-5634 — with "Group items by staff or guest" OFF the receipt printed each
 * service at its raw price while Subtotal / Total (and the customer display)
 * carried the Service fee. Fix: PR volt-pos#3335 → develop (>= 1.1.98): the
 * line amount is `finalPrice` in both layouts.
 *
 * docs/qc/volt-qc/vp-tickets/VP-5634-receipt-service-fee-ungrouped-test-cases.md (TC-VP5634-01..10)
 *
 *   npm run test:attach -- --spec tests/regression/checkout/vp-5634-receipt-service-fee.spec.ts
 *
 * No printer needed: a `window.fetch` wrap records `mutation print` (passed through,
 * so the app toasts "Printer not connected"); the base64 ESC/POS is decoded into lines.
 *
 * EXCLUSIVE: saves the merchant-global receipt switch; `after()` puts it back.
 * CREATES DATA (draft orders are deleted; TC-06 pays one order in Cash). dev only.
 */

import { expect } from '@wdio/globals';
import { VpReceiptSf as R } from '../../../src/constants/testids.vp-receipt-sf.js';
import { returnToHome } from '../../../src/flows/index.js';
import { switchToMain } from '../../../src/helpers/window.js';
import receiptSettingsPage from '../../../src/pages/settings/ReceiptSettingsPage.js';
import { app } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { ensure, expectCents, resetTill, track, untrack } from '../volt-qc/cd-e2e/cd-e2e.helpers.js';
import {
  GROUP_TOGGLE,
  capturePrint,
  groupItemsOn,
  historyServiceLines,
  moneyAfter,
  moneyPairs,
  openNewestCardOrder,
  openReceiptSettings,
  setGroupItems,
  sumCents,
  tilePrice,
  vp5634,
  waitCheckoutLines,
  type Line,
  type Receipt,
} from './vp-5634.helpers.js';

const cents = (lines: readonly Line[]): number[] => lines.map((l) => l.cents);

interface Built {
  code: string;
  base: number[];
  panel: { services: Line[]; subtotal: number };
}

/**
 * New order: `lines` = [staff, service] pairs (one staff group per distinct
 * staff), menu prices read off the tiles; then Pay → `method`, panel read.
 */
async function orderAtCheckout(
  method: 'Card' | 'Cash',
  lines?: readonly (readonly [string, string])[],
): Promise<Built> {
  const d = await app.testData();
  const plan = lines ?? [
    [d.staff, vp5634.service1],
    [d.staff, vp5634.service2],
  ];
  const first = plan[0] as readonly [string, string];
  const code = track(await app.createOrder({ staff: first[0], services: [] }));
  const base: number[] = [];
  let staff = first[0];
  for (const [s, service] of plan) {
    if (s !== staff) {
      await app.pickStaff(s);
      staff = s;
    }
    base.push(await tilePrice(service));
    await app.addService(service);
  }
  await app.pay();
  await app.selectMethod(method);
  const panel = await waitCheckoutLines(plan.length);
  return { code, base, panel };
}

function expectLinesAddUp(r: Receipt): void {
  expectCents(sumCents(r.services), r.subtotal, 'service lines summed vs receipt Subtotal');
}

describe('VP-5634 — receipt service lines carry the Service fee whether or not items are grouped', () => {
  let groupWas = true;

  before(async () => {
    await switchToMain();
    await returnToHome();
    groupWas = await groupItemsOn();
    await returnToHome();
  });

  beforeEach(async () => {
    await switchToMain();
  });

  afterEach(async () => {
    await switchToMain().catch(() => undefined);
    await resetTill();
  });

  after(async () => {
    await switchToMain().catch(() => undefined);
    await setGroupItems(groupWas).catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  describe('0. Settings → Receipt preview', () => {
    it(
      title(
        'TC-VP5634-08: Receipt Preview shows "Staff:" headings only while Group items is on (no Save)',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        await openReceiptSettings();
        const on = await receiptSettingsPage.isToggleOn(GROUP_TOGGLE);
        const before = await receiptSettingsPage.previewText();
        await receiptSettingsPage.toggle(GROUP_TOGGLE);
        const after = await receiptSettingsPage.previewText();
        await receiptSettingsPage.toggle(GROUP_TOGGLE); // back: nothing to save
        const [grouped, ungrouped] = on ? [before, after] : [after, before];

        expect(grouped).toMatch(/Staff:/);
        expect(ungrouped).not.toMatch(/Staff:/);
        expect(ungrouped).toMatch(/Service A/);
        expect(await receiptSettingsPage.isToggleOn(GROUP_TOGGLE)).toBe(on);
        expect(await receiptSettingsPage.isSaveEnabled()).toBe(false);
        await returnToHome();
      },
    );
  });

  describe('1. Group items ON (control)', () => {
    before(async () => {
      await setGroupItems(true);
    });

    it(
      title(
        'TC-VP5634-01: grouped Card receipt — staff heading, indented lines at the fee-inclusive price',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const d = await app.testData();
        const { base, panel } = await orderAtCheckout('Card');
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(r.services.length === 2, `receipt service lines: ${JSON.stringify(r.itemBlock)}`);
        expect(r.headings).toContain(d.staff);
        expect(r.indented).toBe(r.services.length);
        expect(cents(r.services)).toEqual(cents(panel.services));
        r.services.forEach((l, k) => {
          expect(l.cents).toBeGreaterThan(base[k] ?? Number.MAX_SAFE_INTEGER);
        });
        expectLinesAddUp(r);
        expectCents(r.subtotal, panel.subtotal, 'receipt Subtotal vs checkout panel');
      },
    );
  });

  describe('2. Group items OFF', () => {
    before(async () => {
      await setGroupItems(false);
    });

    it(
      title(
        'TC-VP5634-02: ungrouped Card receipt — no staff heading, every line fee-inclusive and adding up to Subtotal',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const d = await app.testData();
        const { base, panel } = await orderAtCheckout('Card');
        const card = await app.methodCents('Card');
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(r.services.length === 2, `receipt service lines: ${JSON.stringify(r.itemBlock)}`);
        // No staff heading, no indent.
        expect(r.headings).toEqual([]);
        expect(r.text).not.toContain(d.staff);
        expect(r.indented).toBe(0);
        // Each line = checkout panel (fee-inclusive), never the menu price.
        expect(cents(r.services)).toEqual(cents(panel.services));
        r.services.forEach((l, k) => {
          expect(l.cents).toBeGreaterThan(base[k] ?? Number.MAX_SAFE_INTEGER);
        });
        expectLinesAddUp(r);
        expectCents(r.subtotal, panel.subtotal, 'receipt Subtotal vs checkout panel');
        expectCents(r.total, card, 'receipt Total vs Card tender');
      },
    );

    it(
      title(
        'TC-VP5634-03: ungrouped Card receipt matches the customer display line by line',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await orderAtCheckout('Card');
        const cd = await cust.text();
        const shown = moneyPairs(cd, 'Order Details', 'Subtotal');
        const shownSubtotal = moneyAfter(cd, 'Subtotal');
        await switchToMain();
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(shown.length === 2, `customer display lines: ${JSON.stringify(shown)}`);
        expect(cents(r.services)).toEqual(cents(shown));
        expectCents(r.subtotal, shownSubtotal, 'receipt Subtotal vs customer display Subtotal');
      },
    );

    it(
      title(
        'TC-VP5634-04: ungrouped Cash receipt — menu prices (no fee), adding up to Subtotal',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { base, panel } = await orderAtCheckout('Cash');
        const cash = await app.methodCents('Cash');
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(r.services.length === 2, `receipt service lines: ${JSON.stringify(r.itemBlock)}`);
        expect(cents(r.services)).toEqual(base);
        expect(cents(r.services)).toEqual(cents(panel.services));
        expectLinesAddUp(r);
        expectCents(r.total, cash, 'receipt Total vs Cash tender');
      },
    );

    it(
      title(
        'TC-VP5634-05: ungrouped Card receipt of a two-staff order — no staff names, both lines fee-inclusive',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const d = await app.testData();
        ensure(d.staff2 !== '', 'needs a second staff on Home');
        const { base, panel } = await orderAtCheckout('Card', [
          [d.staff, vp5634.service1],
          [d.staff2, vp5634.service2],
        ]);
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(r.services.length === 2, `receipt service lines: ${JSON.stringify(r.itemBlock)}`);
        expect(r.headings).toEqual([]);
        expect(r.itemBlock.join('\n')).not.toContain(d.staff);
        expect(r.itemBlock.join('\n')).not.toContain(d.staff2);
        expect(cents(r.services)).toEqual(cents(panel.services));
        r.services.forEach((l, k) => {
          expect(l.cents).toBeGreaterThan(base[k] ?? Number.MAX_SAFE_INTEGER);
        });
        expectLinesAddUp(r);
      },
    );

    it(
      title(
        'TC-VP5634-06: ungrouped receipt printed from Payment Successful after a Cash sale',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { code, base } = await orderAtCheckout('Cash');
        const cash = await app.methodCents('Cash');
        await app.completePayment('none');
        await app.successText();
        untrack(code);
        const r = await capturePrint(() => P.clickQ(R.printButton));

        ensure(r.services.length === 2, `receipt service lines: ${JSON.stringify(r.itemBlock)}`);
        expect(r.text).toContain(code);
        expect(cents(r.services)).toEqual(base);
        expectLinesAddUp(r);
        expect(r.text).toMatch(/Paid with:/);
        expect(r.lines.some((l) => /^Cash\s+\$/.test(l.trim()))).toBe(true);
        expectCents(r.total, cash, 'receipt Total vs Cash paid');
      },
    );

    it(
      title(
        'TC-VP5634-07: ungrouped reprint of a paid Card order from Order History — lines = Service Details, add up to Subtotal',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const code = await openNewestCardOrder();
        const detail = await historyServiceLines();
        const subtotal = moneyAfter(await app.text('main'), 'Subtotal');
        await P.clickQ(R.historyReceiptButton);
        await P.waitFor(R.receiptDialog, 15_000, 'Receipt Details');
        const r = await capturePrint(() => P.clickQ(R.receiptDialogPrint));
        await app.closeStrayDialogs();

        ensure(detail.length > 0, `no service lines read on ${code}`);
        expect(r.text).toContain(code);
        expect(r.headings).toEqual([]);
        expect(cents(r.services)).toEqual(cents(detail));
        expectLinesAddUp(r);
        expectCents(r.subtotal, subtotal, `receipt Subtotal vs Order History Subtotal (${code})`);
      },
    );
  });

  // TC-VP5634-09 (🧱): P8D receipt + Print Check — Android device, not on the Windows lane.
  // TC-VP5634-10 (🧱): real paper print — no thermal printer on the test machine.
});
