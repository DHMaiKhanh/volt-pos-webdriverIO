/**
 * Staff rows, transcribed from `type Staff` in the app's schema.
 *
 * Only `id` and `nickname` are non-null there; a staff member created from the
 * portal with no personal name has `firstName`/`lastName` null and no
 * `staffCode`, which is why nickname is the field every fixture and locator in
 * this suite keys on.
 */
export interface StaffNode {
  id: string;
  nickname: string;
  firstName: string | null;
  lastName: string | null;
  staffCode: number | null;
  /** `active` | `inactive` — an inactive staff renders no card on `/home`. */
  status: string | null;
}

export interface StaffListResponse {
  staffList: StaffNode[];
}

/** A staff member who can actually be selected on the home screen. */
export const isSelectable = (staff: StaffNode): boolean => staff.status === 'active';
