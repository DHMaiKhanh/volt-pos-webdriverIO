/**
 * The money model, recomputed independently of the app.
 *
 * ## The rule that makes this layer worth having
 *
 * Nothing here imports the app, calls the app, or reads a figure the app already
 * derived. Every function takes raw inputs and produces the number the screen is
 * supposed to show, so a disagreement is a real defect rather than a tautology.
 *
 * The inputs can come from anywhere — `src/api` (GraphQL), `src/db` (the local
 * SQLCipher databases), or a screen scrape. That is deliberate: a reconciliation
 * spec fills them one way and a focused spec another, and both get identical
 * numbers out, so the two can be compared to each other as well as to the app.
 *
 * Everything is integer cents, and `rdiv` is the only division.
 */

export { computeIncomeSummary, rdiv } from './incomeCalc.js';
export type {
  CompensationInput,
  IncomeSummaryResult,
  PeriodInput,
  StaffInput,
  StaffPayoutRow,
  StoreSaleInput,
} from './incomeCalc.js';

export { computePeriodDays, computePeriodRange } from './payPeriod.js';
