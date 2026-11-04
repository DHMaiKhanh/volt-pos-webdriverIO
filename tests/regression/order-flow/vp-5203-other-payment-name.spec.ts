/**
 * VP-5203 — Order History drops the Other payment name ("Other -").
 *
 * Paying with the Other tender and typing a method name ("Zelle QC") showed
 * "Other (Zelle QC)" on Payment Successful, but Order History › Payment Details
 * only read "Other -" — the staff-entered name was lost, for a plain checkout and
 * for an Other check inside Split Order. Fixed in volt-pos#3267, first shipped in
 * POS 1.1.88 (QC PASS 5/5 on dev 1.1.96, 04/11/2026).
 *
 * TC map (Linear comment on VP-5203):
 *   TC-5203-01  build carries the fix (>= 1.1.88)
 *   TC-5203-02  plain order, Other "<name>" → Payment Successful "Other (<name>)"
 *   TC-5203-03  same order → Order History Payment Details "<name> - Amount: $x"
 *   TC-5203-04  split order, each check Other with its own name → both names in history
 *   TC-5203-05  Other with an EMPTY name → history "Amount: $x", no "null"/"undefined"
 *
 * Customer tip goes to the customer display even for Other (BEFORE tip flow), so
 * this runs on the LAUNCH lane where the customer window is a WebDriver handle.
 *
 * CREATES DATA AND TAKES OTHER PAYMENTS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { VqcPay } from '../../../src/constants/testids.voltqc-pay.js';
import { inMain } from '../../../src/constants/testids.voltqc-pos.js';
import { step } from '../../../src/helpers/steps.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  completeDone,
  openSplit,
  orderUuidFromUrl,
  payCheck,
  settleSplit,
} from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, escapeRe, usd, vqEnv } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { appVersion, skipUnlessBuild, versionAtLeast } from '../../../src/support/appVersion.js';
import { Tag, title } from '../../../src/types/testTags.js';

const TICKET = 'VP-5203';
const FIX_BUILD = '1.1.88';

/** Unique per run so an older order with the same label can never satisfy the assertion. */
const stamp = (): string => String(Date.now()).slice(-5);

/**
 * Open the order's Order History detail straight by uuid. Searching the list and
 * clicking the row races the debounced re-render ("nothing matches" on the row
 * that was there a tick earlier), so go to `/order-history/<uuid>` directly.
 */
async function openHistory(uuid: string, code: string): Promise<void> {
  await app.go(`/order-history/${uuid}`);
  await P.waitFor(inMain({ text: `Order #${code}` }), 20_000, `Order #${code}`);
  await P.waitFor(inMain({ text: 'Payment Details', nth: 0 }), 20_000, 'Payment Details');
  await app.closeToasts();
}

/** " | "-joined Payment Details section of the open Order History detail pane. */
async function paymentDetails(code: string): Promise<string> {
  const d = await app.historyDetail(code);
  const from = d.indexOf('Payment Details');
  const to = d.indexOf('Order Note', from);
  return from < 0 ? '' : d.slice(from, to > from ? to : undefined);
}

/** Home → new order → Pay → Other → type `name` (may be '') → Complete → success text. */
async function payPlainOther(
  name: string,
): Promise<{ code: string; uuid: string; amount: number; success: string }> {
  const code = await app.createOrder({ services: [vqEnv.testService] });
  await app.pay();
  const uuid = await orderUuidFromUrl();
  const amount = await app.methodAmount('Other');
  await app.selectMethod('Other');
  expect(await P.fillQ(VqcPay.otherNameInput, name)).toBe(name);
  await app.completePayment({ tip: 'none' });
  const success = await app.waitSuccess();
  return { code, uuid, amount, success };
}

describe(`${TICKET} — Order History keeps the Other payment method name`, () => {
  const splits = new Set<string>();

  before(() => {
    assertWritesAllowed('take Other payments for VP-5203');
  });

  beforeEach(async function () {
    await skipUnlessBuild(this, FIX_BUILD, TICKET);
  });

  afterEach(async () => {
    for (const id of splits) await settleSplit(id);
    splits.clear();
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  it(title(`TC-5203-01 installed POS build carries the fix (>= ${FIX_BUILD})`, Tag.REGRESSION), async () => {
    const v = await appVersion();
    expect(v).not.toBe('');
    expect(versionAtLeast(v, FIX_BUILD)).toBe(true);
  });

  it(
    title(
      'TC-5203-02/03 plain order paid Other with a name: success shows "Other (<name>)" and Order History Payment Details keeps "<name> - Amount"',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const name = `Zelle QC ${stamp()}`;
      const { code, uuid, amount, success } = await step('TC-5203-02: pay Other with a name', () =>
        payPlainOther(name),
      );

      await step('TC-5203-02: Payment Successful echoes "Other (<name>)" → No Receipt', async () => {
        expect(success).toContain(`(${name})`);
        expect(success).toContain(usd(amount));
        await app.noReceipt();
      });

      await step('TC-5203-03: Order History › Payment Details shows the name', async () => {
        await openHistory(uuid, code);
        const pay = await paymentDetails(code);
        expect(pay).toMatch(/Other/);
        expect(pay).toMatch(new RegExp(`${escapeRe(name)} - Amount: ${escapeRe(usd(amount))}`));
      });
    },
  );

  it(
    title(
      'TC-5203-04 split order: each check paid Other under its own name → both names in Order History Payment Details',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const s = stamp();
      const names = [`Zelle Split ${s}`, `Venmo Split ${s}`] as const;
      const code = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      splits.add(code);

      let uuid = '';
      await step('Split equally into 2 checks, each paid Other with its own name', async () => {
        await openSplit();
        uuid = await orderUuidFromUrl();
        await payCheck(code, 1, 'Other', { otherName: names[0] });
        await payCheck(code, 2, 'Other', { otherName: names[1] });
      });

      await step('Complete Done → Payment Successful lists both names', async () => {
        const success = await completeDone();
        splits.delete(code);
        for (const n of names) expect(success).toContain(`(${n})`);
        await app.noReceipt();
      });

      await step('Order History › Payment Details keeps both names', async () => {
        await openHistory(uuid, code);
        const pay = await paymentDetails(code);
        expect(pay).toContain(`#${code}-1`);
        expect(pay).toContain(`#${code}-2`);
        for (const n of names) expect(pay).toMatch(new RegExp(`${escapeRe(n)} - Amount: \\$`));
      });
    },
  );

  it(
    title(
      'TC-5203-05 Other with no name still settles; Payment Details reads "Amount: $x" with no null/undefined',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code, uuid, amount } = await payPlainOther('');
      await app.noReceipt();
      await openHistory(uuid, code);
      const pay = await paymentDetails(code);
      expect(pay).toMatch(/Other/);
      expect(pay).toContain(`Amount: ${usd(amount)}`);
      expect(pay).not.toMatch(/null|undefined/i);
    },
  );
});
