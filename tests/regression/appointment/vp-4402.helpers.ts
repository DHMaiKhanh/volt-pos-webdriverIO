/**
 * Oracles for VP-4402 (appointment board: GAP staff column order + staff-coloured
 * cards) read from the POS's own schema through in-page GraphQL.
 *
 * The board order is re-derived exactly as volt-pos does it
 * (`src/lib/display-order.ts` → `sortStaffByAppointmentOrder`, PR #3274):
 *   1. staff with a `staff_appointment` display-order row and `priority > 0`, ascending;
 *   2. then rows with `priority = 0`;
 *   3. then staff with NO row (POS-only / never synced from GCI);
 * each group tie-broken by `compareStaffNickname` (plain `<`/`>` on the lowercased
 * display name — NOT `localeCompare`).
 * The staff set is `useAppointmentStaffs` with no filter: active, not `dts_owner`.
 */

import { gql } from '../../../src/api/index.js';

export interface BoardStaff {
  id: string;
  /** `staffDisplayName`: nickname, else "first last", else "N/A". */
  name: string;
  colorHex: string | null;
  /** `staff_appointment` priority; `undefined` = no row. */
  priority: number | null | undefined;
}

const BOARD_STAFF = `
  query vp4402BoardStaff {
    staffList(
      where: {
        status: { eq: "active" }
        _and: [{ _or: [{ type: { isNull: true } }, { type: { neq: "dts_owner" } }] }]
      }
      orderBy: [{ nickname: asc }]
    ) {
      id
      nickname
      firstName
      lastName
      colorHex
    }
  }
`;

const APPOINTMENT_ORDER = `
  query vp4402AppointmentOrder {
    displayOrderList(where: { entityType: { eq: "staff_appointment" } }, orderBy: [{ priority: asc }]) {
      entityId
      priority
    }
  }
`;

interface StaffNode {
  id: string;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  colorHex: string | null;
}

const displayName = (s: StaffNode): string =>
  s.nickname || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'N/A';

/** The active board staff with their `staff_appointment` priority attached. */
export async function boardStaff(): Promise<BoardStaff[]> {
  const client = gql();
  const staff = await client.query<{ staffList: StaffNode[] }>(BOARD_STAFF, {
    operationName: 'vp4402BoardStaff',
  });
  const order = await client.query<{ displayOrderList: { entityId: string; priority: number | null }[] }>(
    APPOINTMENT_ORDER,
    { operationName: 'vp4402AppointmentOrder' },
  );
  const priorityById = new Map(order.displayOrderList.map((row) => [row.entityId, row.priority]));
  return staff.staffList.map((s) => ({
    id: s.id,
    // The board header renders trimmed text; dev has staff stored as "quan ".
    name: displayName(s).trim(),
    colorHex: s.colorHex,
    priority: priorityById.has(s.id) ? priorityById.get(s.id) : undefined,
  }));
}

/** 0 = ranked (`priority > 0`), 1 = row at 0, 2 = no row. */
export function rankOf(s: BoardStaff): 0 | 1 | 2 {
  if (typeof s.priority !== 'number') return 2;
  return s.priority > 0 ? 0 : 1;
}

/** `compareStaffNickname` from volt-pos `src/lib/display-order.ts`. */
function compareName(a: BoardStaff, b: BoardStaff): number {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

/** The column order the board must render (staff only — Unassigned is prepended by the board). */
export function expectedColumnOrder(staff: BoardStaff[]): BoardStaff[] {
  return [...staff].sort((a, b) => {
    const rank = rankOf(a) - rankOf(b);
    if (rank !== 0) return rank;
    const priority = (a.priority ?? 0) - (b.priority ?? 0);
    if (priority !== 0) return priority;
    return compareName(a, b);
  });
}

/** The Staffs filter dropdown's order (unchanged by VP-4402): `compareStaffNickname` only. */
export function expectedDropdownOrder(staff: BoardStaff[]): string[] {
  return [...staff].sort(compareName).map((s) => s.name);
}

/* ------------------------------------------------------------------------- */

interface AppointmentRow {
  id: string;
  status: string | null;
  startTime: string | null;
  staff: StaffNode | null;
}

const DAY_APPOINTMENTS = `
  query vp4402DayAppointments($where: AppointmentComparisonExp) {
    appointmentList(where: $where) {
      id
      status
      startTime
      staff {
        id
        nickname
        firstName
        lastName
        colorHex
      }
    }
  }
`;

/** `formatToUTCRFC3339` — `yyyy-MM-ddTHH:mm:ss+00:00`. */
const rfc3339 = (d: Date): string => `${d.toISOString().slice(0, 19)}+00:00`;

export interface DayAppointments {
  /** Days after today (0 = today). */
  offset: number;
  assigned: { staffName: string; colorHex: string | null }[];
  unassigned: number;
}

/**
 * The board's appointments for each of the next `days` days (today first), with
 * the same filter the board uses: local day bounds, default statuses, no
 * temporary GCI rows.
 */
export async function appointmentsByDay(days = 7): Promise<DayAppointments[]> {
  const out: DayAppointments[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const where = {
      _and: [
        { startTime: { gte: rfc3339(start), lte: rfc3339(end) } },
        { status: { in: ['scheduled', 'confirmed', 'done'] } },
        { _or: [{ flag: { isNull: true } }, { flag: { neq: 'temporary' } }] },
      ],
    };
    const data = await gql().query<{ appointmentList: AppointmentRow[] }>(DAY_APPOINTMENTS, {
      operationName: 'vp4402DayAppointments',
      variables: { where },
    });
    out.push({
      offset,
      assigned: data.appointmentList
        .filter((a) => a.staff !== null)
        .map((a) => ({ staffName: displayName(a.staff as StaffNode), colorHex: a.staff?.colorHex ?? null })),
      unassigned: data.appointmentList.filter((a) => a.staff === null).length,
    });
  }
  return out;
}
