import { gql, type GraphQLClient } from '../GraphQLClient.js';
import { isSelectable, type StaffListResponse, type StaffNode } from '../models/staff.js';

const STAFF_LIST = `
  query staffList {
    staffList(orderBy: [{ nickname: asc }]) {
      id
      nickname
      firstName
      lastName
      staffCode
      status
    }
  }
`;

/**
 * The staff roster.
 *
 * ## Why a spec asks the schema instead of a fixture
 *
 * `src/data/static/staff.ts` holds nicknames read off one machine's `.env`. That
 * is fine for "click THIS staff", but two things need the live roster:
 *
 * - **Parallel isolation.** Workers must claim DIFFERENT staff or they fight
 *   over one staff member's active order. Slicing a live, deterministically
 *   ordered list is what makes that safe — see {@link claimForWorker}.
 * - **Failing honestly on an empty shop.** A merchant with no active staff makes
 *   dozens of specs skip themselves and the run reports success while testing
 *   nothing. The Playwright suite hit exactly this on 2026-08-12 and the symptom
 *   was a misleading "passcode was rejected" — there was no staff to verify the
 *   code against. {@link assertShopHasStaff} converts that into one clear error.
 */
export class StaffService {
  constructor(private readonly client: GraphQLClient = gql()) {}

  /** Every staff row, ordered by nickname so the order is stable across calls. */
  async list(): Promise<StaffNode[]> {
    const data = await this.client.query<StaffListResponse>(STAFF_LIST, {
      operationName: 'staffList',
    });
    return data.staffList;
  }

  /** Only the staff who actually render a card on `/home`. */
  async active(): Promise<StaffNode[]> {
    return (await this.list()).filter(isSelectable);
  }

  async findByNickname(nickname: string): Promise<StaffNode | undefined> {
    return (await this.list()).find((staff) => staff.nickname === nickname);
  }

  /**
   * The staff member this worker owns.
   *
   * Modulo rather than a hard index: a shop with fewer active staff than workers
   * would otherwise hand back `undefined` and the spec would fail on a missing
   * card instead of the real cause. Wrapping means two workers may share a staff
   * member on a thin roster — slower and occasionally contended, but never a
   * mystery failure. `null` is returned only when there is genuinely nobody.
   */
  async claimForWorker(workerIndex: number): Promise<StaffNode | null> {
    const roster = await this.active();
    if (roster.length === 0) return null;
    return roster[workerIndex % roster.length] ?? null;
  }

  /**
   * Fail the run, loudly, if the merchant has no active staff.
   *
   * A hard throw and not a skip, for the reason in the class doc: a suite that
   * skips its way to green is worse than one that fails.
   */
  async assertShopHasStaff(): Promise<void> {
    const roster = await this.active();
    if (roster.length > 0) return;

    const all = await this.list();
    throw new Error(
      'The merchant under test has no ACTIVE staff.\n' +
        `staffList returned ${String(all.length)} row(s), none with status="active".\n` +
        'Nothing in this suite creates staff, so every order-creating spec would skip and the ' +
        'run would report success having tested nothing. The passcode gate also cannot verify a ' +
        'code without staff, which surfaces later as a misleading "Failed to verify staff code".\n' +
        'Fix the merchant (MERCHANT_ID in configs/env/.env.<ENV>) or point at one with a roster.',
    );
  }
}
