/**
 * Batch History — `/batch-history` — ported 1:1 from
 * `docs/screens/batch-history/batch-history-test-cases.md` (TC-BATCH-01..13,
 * live scan 2026-10-25, build 1.1.56, merchant 14).
 *
 * READ-ONLY: nothing here closes a batch or prints (the screen has no Close
 * Batch button anyway). Assertions are invariants, never the scan day's dollar
 * figures.
 *
 * Source legend from the doc: ✅ implemented as written · ⚠️ implemented on the
 * real invariant, a known deviation fails loudly naming its bug ID · 🧱 pending.
 */

import { expect } from '@wdio/globals';
import { appNav } from '../../../src/components/nav/AppNav.js';
import { BatchLabels } from '../../../src/constants/testids.batch-history.js';
import { DATE_PRESETS } from '../../../src/constants/testids.reports-v4.js';
import { Routes } from '../../../src/constants/routes.js';
import { returnToHome } from '../../../src/flows/navigation.flow.js';
import { step } from '../../../src/helpers/steps.js';
import batchHistoryPage, {
  type BatchReviewRow,
  type BatchRow,
} from '../../../src/pages/incomes/BatchHistoryPage.js';
import { countOf, moneyCents } from '../../../src/pages/incomes/reportDom.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { formatMoney, sumCents } from '../../../src/utils/money.js';

const MONEY_FORMAT = /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/;
const OD_CODE = /^OD\d{6}-\d+$/;

const mmddyyyy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;

/** The date-range button renders a single date when from === to, else `from - to`. */
const rangeText = (from: Date, to: Date): string[] =>
  mmddyyyy(from) === mmddyyyy(to)
    ? [mmddyyyy(from), `${mmddyyyy(from)} - ${mmddyyyy(to)}`]
    : [`${mmddyyyy(from)} - ${mmddyyyy(to)}`];

const isOpen = (row: BatchRow): boolean => (BatchLabels.statusOpen as readonly string[]).includes(row.status);

const fail = (problems: string[], context: string): void => {
  if (problems.length > 0) throw new Error(`${context}:\n  - ${problems.join('\n  - ')}`);
};

describe('Batch History', () => {
  describe('list & filters', () => {
    it(
      title('TC-BATCH-01: opens from the ☰ menu at /batch-history with its heading', Tag.REGRESSION),
      async () => {
        await step('Go home, then ☰ → Batch History', async () => {
          await returnToHome();
          await appNav.openSidebarLink(Routes.BATCH_HISTORY);
          await batchHistoryPage.waitForReady();
        });

        expect(await batchHistoryPage.currentPath()).toBe(Routes.BATCH_HISTORY);
        expect(BatchLabels.title as readonly string[]).toContain(await batchHistoryPage.headingText());
      },
    );

    it(title('TC-BATCH-02: default preset is This Week, range Monday → today', Tag.REGRESSION), async () => {
      await batchHistoryPage.open();

      expect(DATE_PRESETS.thisWeek as readonly string[]).toContain(await batchHistoryPage.presetText());

      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      expect(rangeText(monday, today)).toContain(await batchHistoryPage.dateRangeText());
    });

    it(
      title('TC-BATCH-03: the preset combobox lists exactly the 10 presets in order', Tag.REGRESSION),
      async () => {
        await batchHistoryPage.open();
        const options = await step('Read the preset options', () => batchHistoryPage.presetOptions());

        const expected = Object.values(DATE_PRESETS);
        const problems: string[] = [];
        if (options.length !== expected.length) {
          problems.push(
            `expected ${String(expected.length)} options, got ${String(options.length)}: ${options.join(' | ')}`,
          );
        }
        expected.forEach((pair, i) => {
          if (!(pair as readonly string[]).includes(options[i] ?? '')) {
            problems.push(`option ${String(i + 1)}: expected "${pair[0]}", got "${options[i] ?? '(none)'}"`);
          }
        });
        fail(problems, 'TC-BATCH-03 preset list');
      },
    );

    it(
      title(
        'TC-BATCH-04: batch table header is Batch Date | Batch Number | Status | Total Payment | Total Amount',
        Tag.REGRESSION,
      ),
      async () => {
        await batchHistoryPage.open();
        const head = await batchHistoryPage.batchHeaders();
        const expected = [
          BatchLabels.batchDate,
          BatchLabels.batchNumber,
          BatchLabels.status,
          BatchLabels.totalPayment,
          BatchLabels.totalAmount,
        ];
        const problems = expected
          .map((pair, i) =>
            (pair as readonly string[]).includes(head[i] ?? '')
              ? null
              : `column ${String(i + 1)}: expected "${pair[0]}", got "${head[i] ?? '(none)'}"`,
          )
          .filter((p): p is string => p !== null);
        if (head.length !== expected.length)
          problems.push(`expected 5 columns, got ${String(head.length)}: ${head.join(' | ')}`);
        fail(problems, 'TC-BATCH-04 batch table header');
      },
    );

    it(
      title(
        'TC-BATCH-05: the open batch shows "Not closed yet" and a money Total Amount',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        await batchHistoryPage.open();
        const rows = await batchHistoryPage.batchRows();
        const open = rows.find(isOpen);
        if (!open) {
          throw new Error(
            `TC-BATCH-05 precondition: no batch with Status Open is listed (rows: ${JSON.stringify(rows)}). ` +
              'The merchant needs an unclosed card batch for this check.',
          );
        }

        expect(BatchLabels.notClosedYet as readonly string[]).toContain(open.batchDate);
        expect(open.totalAmount).toMatch(MONEY_FORMAT);
        expect(open.batchNumber).toMatch(/^\d+$/);
      },
    );

    it(title('TC-BATCH-06: the right panel defaults to "No item selected"', Tag.REGRESSION), async () => {
      await batchHistoryPage.open();
      expect(await batchHistoryPage.isPanelEmpty()).toBe(true);
    });

    it(
      title('TC-BATCH-10: switching to Last Month reloads the list for the previous month', Tag.REGRESSION),
      async () => {
        await batchHistoryPage.open();
        await batchHistoryPage.selectPreset('lastMonth');

        const today = new Date();
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);

        expect(DATE_PRESETS.lastMonth as readonly string[]).toContain(await batchHistoryPage.presetText());
        expect(rangeText(first, last)).toContain(await batchHistoryPage.dateRangeText());
        // Re-rendered without crashing: the header is still there and every listed row is complete.
        expect((await batchHistoryPage.batchHeaders()).length).toBe(5);
        for (const row of await batchHistoryPage.batchRows()) {
          expect(row.totalAmount).toMatch(MONEY_FORMAT);
        }
      },
    );

    it(
      title(
        'TC-BATCH-13: a closed batch shows its close date and a non-Open status — PENDING (merchant 14 only has the open batch; needs a closed batch in Last Year)',
      ),
    );
  });

  describe('Batch Close Review', () => {
    let batches: BatchRow[] = [];
    let review: BatchReviewRow[] = [];
    let reviewStatus = '';

    before(async () => {
      await batchHistoryPage.open();
      batches = await batchHistoryPage.batchRows();
      if (batches.length === 0) return;
      await batchHistoryPage.openReview(1);
      reviewStatus = await batchHistoryPage.reviewStatusText();
      review = await batchHistoryPage.reviewRows();
    });

    const requireReview = (): void => {
      if (batches.length === 0) {
        throw new Error('Precondition: no batch is listed under This Week, so there is no review to open.');
      }
    };

    it(
      title(
        'TC-BATCH-07: the Total Amount button opens Batch Close Review with its status and ≥ 1 order row',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        requireReview();
        expect(await batchHistoryPage.isReviewOpen()).toBe(true);
        expect(reviewStatus).not.toBe('');

        const head = await batchHistoryPage.reviewHeaders();
        const expected = [BatchLabels.odCode, BatchLabels.subtotal, BatchLabels.tip, BatchLabels.total];
        expected.forEach((pair, i) => {
          expect(pair as readonly string[]).toContain(head[i] ?? '');
        });
        expect(review.length).toBeGreaterThanOrEqual(1);
      },
    );

    it(title('TC-BATCH-08: every OD Code is well-formed and unique', Tag.REGRESSION), () => {
      requireReview();
      const malformed = review.map((r) => r.odCode).filter((c) => !OD_CODE.test(c));
      const seen = new Set<string>();
      const duplicates = review
        .map((r) => r.odCode)
        .filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
      fail(
        [
          ...malformed.map((c) => `malformed OD Code "${c}" (expected OD\\d{6}-\\d+)`),
          ...duplicates.map((c) => `duplicate OD Code "${c}"`),
        ],
        `TC-BATCH-08 over ${String(review.length)} review rows`,
      );
    });

    it(
      title('TC-BATCH-09: every review row parses as money, none negative, Total ≥ Tip', Tag.REGRESSION),
      () => {
        requireReview();
        const problems: string[] = [];
        for (const row of review) {
          try {
            const subtotal = moneyCents(row.subtotal);
            const tip = moneyCents(row.tip);
            const total = moneyCents(row.total);
            if (subtotal < 0 || tip < 0 || total < 0) {
              problems.push(
                `${row.odCode}: negative value (Subtotal ${row.subtotal}, Tip ${row.tip}, Total ${row.total})`,
              );
            }
            if (total < tip) problems.push(`${row.odCode}: Total ${row.total} < Tip ${row.tip}`);
          } catch (error) {
            problems.push(`${row.odCode}: unparseable money — ${(error as Error).message}`);
          }
        }
        fail(
          problems,
          'TC-BATCH-09 (⚠️ in the scan: Total ≥ Subtotal + Tip − discount cannot be checked exactly because ' +
            'the review shows no discount column; asserting parse / non-negative / Total ≥ Tip)',
        );
      },
    );

    it(
      title(
        'TC-BATCH-11 [BUG-BATCH-01]: the open batch header matches its review (payment count and Total Amount)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        requireReview();
        const openIndex = batches.findIndex(isOpen);
        if (openIndex < 0) throw new Error('TC-BATCH-11 precondition: no open batch listed under This Week.');
        const header = batches[openIndex]!;

        let rows = review;
        if (openIndex !== 0) {
          rows = await step('Open the review of the open batch', async () => {
            await batchHistoryPage.openReview(openIndex + 1);
            return batchHistoryPage.reviewRows();
          });
        }

        const headerCount = countOf(header.totalPayment);
        const headerAmount = moneyCents(header.totalAmount);
        const reviewTotal = sumCents(rows.map((r) => moneyCents(r.total)));

        const problems: string[] = [];
        if (headerCount !== rows.length) {
          problems.push(
            `header Total Payment = ${String(headerCount)} payments, review lists ${String(rows.length)} orders`,
          );
        }
        if (headerAmount !== reviewTotal) {
          problems.push(
            `header Total Amount = ${formatMoney(headerAmount)}, Σ review Total = ${formatMoney(reviewTotal)}`,
          );
        }
        fail(
          problems,
          `TC-BATCH-11 — BUG-BATCH-01 (suspected): batch #${header.batchNumber} header does not reconcile with ` +
            'its Batch Close Review. Possibly the header counts every payment (cash/other/gift card) while the ' +
            'review lists card orders only (cf. VP-2472). If the review list is virtualised, the row count is the ' +
            'RENDERED subset — check that before logging',
        );
      },
    );

    it(
      title(
        'TC-BATCH-12: pressing an OD Code opens the order detail — PENDING (target behaviour of the OD Code button not scanned yet)',
      ),
    );
  });
});
