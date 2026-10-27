/**
 * volt-qc port — Batch History, read-only. Never closes a batch, never presses
 * Split Tip.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-batch.spec.ts` RPT-T30a-d and
 * `rpt-plan-data.spec.ts` RPT-T48c (`@readonly`). The last Closed batch on DEV
 * was > 30 days old when volt-qc wrote these, so Closed-batch cases look back
 * 365 days.
 */

import { expect } from '@wdio/globals';
import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { RptCss, RptText } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  choosePreset,
  comboText,
  hasText,
  parseUsDate,
  rangeDates,
  rangeOffset,
  ymd,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  batchReview,
  batchRows,
  clickBatchAmount,
  clickFirstReviewOrder,
  clickMainHeader,
  closeOrderDetails,
  openBatch,
  orderDetailsButtons,
  orderDetailsText,
  waitOrderDetails,
  type BatchRow,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note } from './reports-time.helpers.js';

const closedOf = (rows: BatchRow[]): BatchRow[] => rows.filter((r) => r.status === 'Closed');
const t = (s: string): number => parseUsDate(s)?.getTime() ?? Number.NaN;

describe('volt-qc RPT — Batch History (read-only)', () => {
  it(
    title(
      'Layout: heading, Last 7 Days, 5 columns, empty review panel; the Open batch is always first (RPT-164, RPT-165)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBatch();
      expect(await hasText(RptCss.main, 'Batch History', 'h1, h2, h3, [role="heading"]')).toBe(true);
      expect(await comboText(RptCss.main)).toBe('Last 7 Days');
      const { headers, rows } = await batchRows();
      expect(headers).toEqual(['Batch Date', 'Batch Number', 'Status', 'Total Payment', 'Total Amount']);
      expect((await batchReview()).text).toContain(RptText.noItemSelected);
      ensure(rows.length > 0, 'Batch History lists no batch in the last 7 days');
      expect(rows[0]?.date).toBe(RptText.notClosedYet);
      expect(rows[0]?.status).toBe('Open');

      await choosePreset(RptCss.main, 'Last Month');
      const lm = await batchRows();
      expect(lm.rows[0]?.status).toBe('Open');
      expect(lm.rows[0]?.date).toBe(RptText.notClosedYet);
    },
  );

  it(
    title(
      'Closed batches: MM/dd/yyyy descending; the Batch Date header flips to ascending, Open stays first (RPT-166)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openBatch();
      let { rows } = await batchRows();
      if (closedOf(rows).length < 2) {
        await openBatch(rangeOffset(-364, 0));
        rows = (await batchRows()).rows;
      }
      const closed = closedOf(rows);
      if (closed.length < 2) {
        note('RPT-166: fewer than 2 Closed batches in 365 days');
        this.skip();
      }
      for (const r of closed) expect(r.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      for (let i = 1; i < closed.length; i += 1) {
        ensure(
          t(closed[i]?.date ?? '') <= t(closed[i - 1]?.date ?? ''),
          'Closed batches are not newest first',
        );
      }
      // The first click may only make the default descending sort explicit — click up to 3 times.
      let asc = rows;
      for (let k = 0; k < 3; k += 1) {
        await clickMainHeader('Batch Date');
        asc = (await batchRows()).rows;
        const c = closedOf(asc);
        if (c.length >= 2 && t(c[1]?.date ?? '') >= t(c[0]?.date ?? '')) break;
      }
      expect(asc[0]?.status).toBe('Open');
      const c2 = closedOf(asc);
      for (let i = 1; i < c2.length; i += 1)
        ensure(t(c2[i]?.date ?? '') >= t(c2[i - 1]?.date ?? ''), 'Not ascending after sorting');
    },
  );

  it(
    title(
      'Batch Close Review for a Closed and the Open batch; OD Code opens a view-only Order Details (RPT-167, RPT-168, RPT-169)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await openBatch(rangeOffset(-364, 0));
      const { rows } = await batchRows();
      const closed = closedOf(rows);
      if (closed.length === 0) {
        note('RPT-167: no Closed batch in 365 days');
        this.skip();
      }

      await step(
        'RPT-167 Closed batch → review with date/time and OD Code | Subtotal | Tip | Total',
        async () => {
          const c = closed[0];
          ensure(c !== undefined, 'no closed batch');
          await clickBatchAmount(c.index);
          await browser.waitUntil(async () => (await batchReview()).text.includes(RptText.batchCloseReview), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          expect((await batchReview()).text).toMatch(
            /Date: \d{2}\/\d{2}\/\d{4} \| \d{2}:\d{2}:\d{2} (AM|PM)/,
          );
          await browser.waitUntil(
            async () => (await batchReview()).headers.join('|') === 'OD Code|Subtotal|Tip|Total',
            {
              timeout: Timeouts.MEDIUM,
              interval: 300,
              timeoutMsg: `Review headers: ${(await batchReview()).headers.join(' | ')}`,
            },
          );
        },
      );

      await step(
        'RPT-169 OD Code → Order Details without Refund / Cancel / Re-Open; closing returns to the review',
        async () => {
          if (!(await clickFirstReviewOrder())) {
            note('RPT-169: the batch lists no order');
            return;
          }
          expect(await waitOrderDetails(true)).toBe(true);
          await browser.waitUntil(async () => /Order #OD/.test(await orderDetailsText()), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          const buttons = await orderDetailsButtons();
          for (const b of [/Refund/, /Cancel Order/, /Re-Open Order/]) {
            ensure(
              !buttons.some((x) => b.test(x)),
              `Order Details shows "${b.source}" — buttons: ${buttons.join(', ')}`,
            );
          }
          await closeOrderDetails();
          expect(await waitOrderDetails(false)).toBe(true);
          expect((await batchReview()).text).toContain(RptText.batchCloseReview);
        },
      );

      await step('RPT-168 Open batch → review labelled "Not closed yet"', async () => {
        await clickBatchAmount(0);
        await browser.waitUntil(async () => (await batchReview()).text.includes(RptText.batchCloseReview), {
          timeout: Timeouts.MEDIUM,
          interval: 250,
        });
        expect((await batchReview()).text).toContain(RptText.notClosedYet);
      });
    },
  );

  it(
    title('A range with no batch lists only the Open batch or "No batches found." (RPT-170)', Tag.REGRESSION),
    async () => {
      await openBatch(rangeDates(ymd(2024, 1, 1), ymd(2024, 1, 7)));
      const { rows } = await batchRows();
      if (rows.length === 0) expect(await hasText(RptCss.main, RptText.noBatches)).toBe(true);
      else {
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('Open');
      }
    },
  );

  it(
    title(
      'Batch Date and the review date come from the same UTC source (evening closes) (RPT-172)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await openBatch(rangeOffset(-364, 0));
      const closed = closedOf((await batchRows()).rows);
      if (closed.length === 0) {
        note('RPT-172: no Closed batch in 365 days');
        this.skip();
      }
      const evening: string[] = [];
      for (const c of closed.slice(0, 15)) {
        await clickBatchAmount(c.index);
        await browser
          .waitUntil(async () => /Date: \d{2}\/\d{2}\/\d{4}/.test((await batchReview()).text), {
            timeout: Timeouts.SHORT,
            interval: 250,
          })
          .catch(() => undefined);
        const m = /Date: (\d{2}\/\d{2}\/\d{4}) \| (\d{2}):\d{2}:\d{2} (AM|PM)/.exec(
          (await batchReview()).text,
        );
        if (!m) continue;
        const h = (Number(m[2]) % 12) + (m[3] === 'PM' ? 12 : 0);
        if (h < 6)
          evening.push(
            `${c.number}: Batch Date ${c.date}, review ${m[1] ?? ''} ${m[2] ?? ''} ${m[3] ?? ''} (UTC)`,
          );
        expect(m[1]).toBe(c.date);
      }
      if (evening.length === 0) {
        note('RPT-172: no batch closed after 7 PM CT in 365 days');
        this.skip();
      }
      note(`RPT-172 evening batches: ${evening.join('; ')}`);
    },
  );
});
