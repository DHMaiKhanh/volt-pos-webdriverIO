/**
 * volt-qc port — 02 HOME: the on-screen (virtual) keyboard (WRITE + settings cases).
 *
 * Source: volt-qc `e2e/tests/02-home/home-plan-panels.spec.ts` (HOME-VK1…VK3, `@settings`).
 * TC catalogue: docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Settings › Accessibility › "Show the virtual keyboard" is a DEVICE setting; every
 * case records the original position and puts it back in `finally`. Tagged
 * EXCLUSIVE so it never runs beside another spec that types into the till.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { VqcHome } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqhDialog,
  VqhEditor,
  VqhSettings,
  inDlg,
} from '../../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  cleanupOrders,
  closeCustomerDialog,
  closeEditor,
  closeStrayDialogs,
  createOrder,
  discover,
  openQuickPay,
  qp,
  randomPhone,
  typeCustomerPhone,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const KB = { css: VqhSettings.virtualKeyboardCss, nth: -1 } as const;
let staff = '';

/** Settings › Accessibility › "Show the virtual keyboard" → `on`. Returns the previous state. */
async function setVirtualKeyboard(on: boolean): Promise<boolean> {
  await returnToHome();
  await P.routerGo('/settings/accessibility');
  await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 3_000 });
  await P.waitFor(VqhSettings.virtualKeyboardSwitch, 15_000, '"Show the virtual keyboard" switch');
  const before = (await P.attrOf(VqhSettings.virtualKeyboardSwitch, 'aria-checked')) === 'true';
  if (before !== on) await P.clickQ(VqhSettings.virtualKeyboardSwitch);
  await P.poll(
    () => P.attrOf(VqhSettings.virtualKeyboardSwitch, 'aria-checked'),
    (v) => v === String(on),
    5_000,
  );
  await returnToHome();
  return before;
}

async function kbShown(timeout = 5_000): Promise<boolean> {
  return P.poll(
    () => P.has(KB),
    (v) => v,
    timeout,
  );
}

async function closeKeyboard(): Promise<void> {
  for (let i = 0; i < 3 && (await P.has(KB)); i += 1) {
    await P.escape();
    await settle(400);
  }
}

async function vk(keys: string[]): Promise<void> {
  for (const k of keys) await P.clickQ(VqhSettings.vkKey(k));
}

describe('volt-qc 02 HOME — virtual keyboard (write, device setting)', () => {
  before(async () => {
    await returnToHome();
    staff = (await discover()).staff[0] ?? '';
  });

  beforeEach(function () {
    if (!staff) this.skip();
  });

  afterEach(async () => {
    await closeKeyboard().catch(() => undefined);
    await closeCustomerDialog().catch(() => undefined);
    await closeStrayDialogs().catch(() => undefined);
    await cleanupOrders();
  });

  it(
    title(
      'Quick Pay with the on-screen keypad: 1234 → $12.34; Reset amount → 0.00; then 5,0 → $0.50 (HOME-056)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async () => {
      const before = await setVirtualKeyboard(true);
      try {
        await createOrder(staff);
        await openQuickPay();
        await P.clickQ(qp(VqhEditor.amount));
        expect(await kbShown()).toBe(true);
        await vk(['1', '2', '3', '4']);
        // Known dev bug #10: the keypad inserts at the tap position (not the end) — recorded by the source as soft.
        expect(await P.inputValue(qp(VqhEditor.amount))).toBe('$12.34');
        await P.jsClickQ(qp(VqhEditor.reset));
        expect(await P.inputValue(qp(VqhEditor.amount))).toMatch(/^\$?0\.00$/);
        expect(await P.count(qp(VqhEditor.reset))).toBe(0);
        await P.clickQ(qp(VqhEditor.amount));
        await vk(['5', '0']);
        expect(await P.inputValue(qp(VqhEditor.amount))).toBe('$0.50');
        await vk(['{enter}']);
        expect(
          await P.poll(
            () => P.has(KB),
            (v) => !v,
            5_000,
          ),
        ).toBe(false);
        await closeEditor();
      } finally {
        await closeKeyboard();
        await closeStrayDialogs().catch(() => undefined);
        await setVirtualKeyboard(before);
      }
    },
  );

  it(
    title(
      'Quick-add: letters typed on the keyboard, its Done hides it without submitting; Service Name keeps 50; Add stays reachable (HOME-168, HOME-169, HOME-170)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async () => {
      const before = await setVirtualKeyboard(true);
      try {
        await quickCheckout();
        await typeCustomerPhone(randomPhone());
        await P.clickQ(VqcHome.doneButton);
        await P.waitFor(VqhDialog.quickAdd, 10_000, 'quick-add');
        const name = inDlg(VqhDialog.quickAdd, { css: 'input', placeholder: 'Enter customer name' });
        await P.clickQ(name);
        expect(await kbShown()).toBe(true);
        await vk(['a', 'n', 'n', 'a']);
        expect(await P.inputValue(name)).toMatch(/^anna$/i);
        await vk(['{enter}']);
        expect(
          await P.poll(
            () => P.has(KB),
            (v) => !v,
            5_000,
          ),
        ).toBe(false);
        expect(await P.has(VqhDialog.quickAdd)).toBe(true);
        await closeCustomerDialog();

        await createOrder(staff);
        await openQuickPay();
        await P.clickQ(qp(VqhEditor.serviceName));
        expect(await kbShown()).toBe(true);
        await vk(Array<string>(55).fill('b'));
        expect(await P.inputValue(qp(VqhEditor.serviceName))).toMatch(/^b{50}$/i);
        await P.clickQ(qp(VqhEditor.note));
        const box = await P.info(VqhDialog.quickPay);
        const r = box?.rect ?? { x: 0, y: 0, w: 0, h: 0 };
        await P.clickAt(r.x + r.w - 40, r.y + 120);
        expect(
          await P.poll(
            () => P.has(KB),
            (v) => !v,
            5_000,
          ),
        ).toBe(false);
        expect((await P.info(qp(VqhEditor.add)))?.fullyInViewport).toBe(true);
        await closeEditor();
      } finally {
        await closeKeyboard();
        await closeStrayDialogs().catch(() => undefined);
        await setVirtualKeyboard(before);
      }
    },
  );

  it(
    title(
      'Keyboard OFF: Search staff / customer name never open it; ON: the Pending sidebar search never opens it (HOME-171)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async () => {
      const before = await setVirtualKeyboard(false);
      try {
        await quickCheckout();
        await P.clickQ(VqcHome.staffSearch);
        await settle(600);
        expect(await P.count(KB)).toBe(0);
        await typeCustomerPhone(randomPhone());
        await P.clickQ(VqcHome.doneButton);
        await P.waitFor(VqhDialog.quickAdd, 10_000);
        await P.clickQ(inDlg(VqhDialog.quickAdd, { css: 'input', placeholder: 'Enter customer name' }));
        await settle(600);
        expect(await P.count(KB)).toBe(0);
        await closeCustomerDialog();

        await setVirtualKeyboard(true);
        await P.clickQ([
          { role: 'complementary', name: 'Pending Orders sidebar' },
          { role: 'textbox', nth: 0 },
        ]);
        await settle(600);
        expect(await P.count(KB)).toBe(0);
      } finally {
        await closeKeyboard();
        await setVirtualKeyboard(before);
      }
    },
  );
});
