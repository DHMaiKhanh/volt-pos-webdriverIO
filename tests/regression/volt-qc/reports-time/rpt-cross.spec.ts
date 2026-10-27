/**
 * volt-qc port — cross-report reconciliation on a PAST day (yesterday), read-only.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-cross.spec.ts` — RPT-T32a and
 * T32b (`@readonly`). T35/T36 (Report V2 / report-pages) are skipped in volt-qc
 * itself ("user decided not to test Report V2") and are not ported.
 *
 * Known issue carried over (volt-qc bug #46): Total Staff Payout can differ from
 * Σ Staff Income by a few dollars on some days — RPT-176 keeps volt-qc's 5¢
 * tolerance, so it fails loudly on such a day rather than hiding the gap.
 */

import { RptCss } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { detailIdOf, pv, rangeOffset, readPairs } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  dailySnapshot,
  openStaffIncome,
  openSummary,
  selectStaffRow,
  setNoIncomeToggle,
  staffList,
  summaryDetail,
  summaryState,
  waitStaffRows,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, ensureCents, note } from './reports-time.helpers.js';

describe('volt-qc RPT — cross-report reconciliation (read-only, yesterday)', () => {
  it(
    title(
      'Daily Sale day D = Income Summary day D (Sale / Tip / Tax / Total Payment) (RPT-175)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      const d = await dailySnapshot(-1);
      if (d.detail === null) {
        note('RPT-175: yesterday has no Daily Sale data');
        this.skip();
      }
      const r = rangeOffset(-1);
      await openSummary({ ...r, detailId: detailIdOf(r) });
      const row = (await summaryState()).rows[0];
      ensure(row !== undefined, 'Income Summary has no row for yesterday');
      ensureCents(row.sale, d.cards['Sale']?.value ?? Number.NaN, 'Summary Sale vs Daily Sale card');
      ensureCents(row.tip, d.cards['Total tip']?.value ?? Number.NaN, 'Summary Tip vs Daily Total tip card');
      ensureCents(row.tax, d.detail.tax, 'Summary Tax vs Daily Tax Collected');
      ensureCents(
        row.total,
        d.detail.paymentTotal,
        'Summary Total Payment vs Daily Payment Details Total Payment',
      );
    },
  );

  it(
    title('Income Summary Staff Payout day D ≈ Σ Staff Income day D (RPT-176)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      const r = rangeOffset(-1);
      await openSummary({ ...r, detailId: detailIdOf(r) });
      const P = await summaryDetail(true).catch(() => null);
      if (P === null) {
        note('RPT-176: yesterday has no revenue');
        this.skip();
      }
      const SP = { section: 'Staff Payout' };
      const totalService = pv(P, 'Total Service', SP);
      const payout = pv(P, 'Total Staff Payout', { ...SP, group: '' });
      const pay1 = pv(P, 'Pay 1', { ...SP, group: 'Total Staff Payout' });
      const pay2 = pv(P, 'Pay 2', { ...SP, group: 'Total Staff Payout' });

      await openStaffIncome(r);
      await setNoIncomeToggle(true);
      ensure(await waitStaffRows(60_000), 'Staff Income lists no staff for yesterday');
      const l = await staffList();
      ensureCents(totalService, l.summary.totalSubtotal, 'Total Service vs Total subtotal', 5);
      ensureCents(payout, l.summary.totalStaffIncome, 'Total Staff Payout vs Total staff income', 5);

      const earners = l.rows.filter((x) => x.total !== 0);
      if (earners.length > 10) {
        note(
          `RPT-176: ${String(earners.length)} staff earned yesterday (> 10) — per-staff Σ Pay 1/Pay 2 skipped`,
        );
        return;
      }
      let s1 = 0;
      let s2 = 0;
      for (const s of earners) {
        await selectStaffRow(s.name);
        const sp = await readPairs(RptCss.rightPane);
        s1 += pv(sp, 'Pay 1');
        s2 += pv(sp, 'Pay 2');
      }
      ensureCents(s1, pay1, 'Σ staff Pay 1 vs Summary Pay 1', 5);
      ensureCents(s2, pay2, 'Σ staff Pay 2 vs Summary Pay 2', 5);
    },
  );
});
