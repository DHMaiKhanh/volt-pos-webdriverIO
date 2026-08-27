/**
 * The income reports.
 *
 * ## Use these WITH `src/api`, not instead of it
 *
 * Every screen here renders derived money, and a spec that only reads the screen
 * can prove at most that the screen is self-consistent. `ReportService` queries
 * the same `vReport*` views the screens render from, so the assertion worth
 * writing is screen-vs-schema. See the class notes on each page for which of
 * the two sources answers which question.
 *
 * Each module default-exports a shared instance: the pages hold no state and
 * resolve everything against the live DOM per call, so one per worker is enough.
 */

export { default as incomeDailyPage, IncomeDailyPage } from './IncomeDailyPage.js';
export { default as incomeStaffPage, IncomeStaffPage } from './IncomeStaffPage.js';
export type { StaffIncomeRow } from './IncomeStaffPage.js';
export { default as incomeSummaryPage, IncomeSummaryPage, SummaryRows } from './IncomeSummaryPage.js';
export type { GroupBy, SummaryRowKey } from './IncomeSummaryPage.js';
