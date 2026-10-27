/**
 * volt-qc port — 19 RE-OPEN (read-only cases).
 *
 * Source: volt-qc `e2e/tests/19-reopen/reopen-linear.spec.ts` (RO-H8) and
 * `reopen-methods.spec.ts` (RO-211). TC catalogue: docs/qc/volt-qc/windows-regression/17-reopen.md.
 *
 * Both only READ an existing settled order in Order History and check which
 * actions its detail pane offers. Nothing is re-opened.
 */

import { expect } from '@wdio/globals';
import { VqcOrderHistory as OH, btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { orderHistoryPage } from '../../../../src/pages/index.js';
import {
  addDays,
  applyFilter,
  openRow,
  pickDateRange,
  rowCodes,
  search,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/** First order in the last `daysBack` days matching the statuses/payments, or null. */
async function findHistoryOrder(
  statuses: string[],
  payments: string[],
  daysBack = 7,
): Promise<string | null> {
  if (await orderHistoryPage.isActive()) await returnToHome();
  await goToOrderHistory();
  await P.waitFor(OH.heading, 15_000, 'Order History heading');
  if ((await P.inputValue(OH.searchBox)) !== '') await search('');
  const today = new Date();
  await pickDateRange(addDays(today, -(daysBack - 1)), today);
  await applyFilter({ statuses, payments });
  return (await rowCodes())[0] ?? null;
}

async function openSettled(code: string): Promise<void> {
  await openRow(code);
  await P.waitFor(inMain({ text: `Order #${code}` }), 15_000, 'order detail');
  const status = await P.poll(
    () => P.pageText(),
    (t) => t.includes('Successful - Settled'),
    10_000,
  );
  expect(status).toContain('Successful - Settled');
}

describe('volt-qc 19 RE-OPEN — settled orders (read-only)', () => {
  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title('A Settled (Cash/Other) order has no Re-Open button (VP-261 / VP-3060) (RO-100)', Tag.REGRESSION),
    async function () {
      this.timeout(3 * 60_000);
      // Non-card orders settle at the merchant's day rollover, so the last 7 days normally hold one.
      const code = await findHistoryOrder(['successful-settled'], ['cash', 'other']);
      if (!code) this.skip();
      await openSettled(code ?? '');
      expect(await P.count(inMain(btn('Re-Open Order')))).toBe(0);
      expect(await P.count(inMain(btn('Continue Re-open')))).toBe(0);
    },
  );

  it(
    title(
      'A Settled Card order has no Re-Open but offers Refund (VP-2585 TC02 / VP-261) (RO-211)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(3 * 60_000);
      // Card orders settle only at batch close — look back a year.
      const code = await findHistoryOrder(['successful-settled'], ['card'], 365);
      if (!code) this.skip();
      await openSettled(code ?? '');
      expect(await P.count(inMain(btn('Re-Open Order')))).toBe(0);
      const refund =
        (await P.has({ css: '[data-testid="order-action-refund"]' })) || (await P.has(inMain(btn('Refund'))));
      expect(refund).toBe(true);
    },
  );
});
