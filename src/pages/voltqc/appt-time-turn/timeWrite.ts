import { $, browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { timeKeepingDialog } from '../../../components/modal/TimeKeepingDialog.js';
import { VqcTime as T } from '../../../constants/testids.voltqc-appt-time-turn.js';
import { RptCss } from '../../../constants/testids.voltqc-reports-time.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import {
  clickIn,
  clickOption,
  closeStrayDialogs,
  existsIn,
  idle,
  parseUsDateTime,
  toastCount,
} from '../reports-time/rptDom.js';
import {
  closeTkWithEscape,
  openTimeKeepingByUrl,
  tkSearch,
  tkTiles,
  ttOpen,
  ttOpenAdd,
  ttPickRange,
  ttPreset,
  ttRows,
  ttSearch,
  type TkColumn,
  type TtRow,
} from '../reports-time/rptTime.js';

/**
 * Write-path helpers for the volt-qc 09-time ports (volt-qc `e2e/src/flows/time.ts`
 * + `deep-oh-time.ts`): Check In / Out through the Time Keeping dialog, and
 * Add / Edit / Delete on the Time Tracking page.
 *
 * ## Data safety
 *
 * Every helper that writes is paired with {@link ttCleanup}: it checks the
 * staff OUT again and deletes every Time Tracking record of that staff created
 * since the test started. Staff are picked by {@link pickTimeStaff} among those
 * who are OUT right now — preferably never clocked in — and never the suite's
 * configured `STAFF_NAME`, so nobody another spec relies on is touched.
 *
 * ## Scoping
 *
 * The Add / Edit dialogs have no testid; the visible dialog with the wanted
 * title is stamped `data-vqtt-dlg`, and the form row with the wanted label
 * `data-vqtt-fi`, then plain WebDriver lookups run inside those stamps.
 */

type El = WebdriverIO.Element;

export type DlgKind = 'add' | 'edit';
export type FormLabel = 'Staff' | 'Date IN' | 'Date OUT';

const TITLE: Record<DlgKind, string> = { add: T.addTitle, edit: T.editTitle };
const DLG = '[data-vqtt-dlg="1"]';
const ITEM = '[data-vqtt-dlg="1"] [data-vqtt-fi="1"]';

/* ------------------------------------------------------------------------- *
 * Dates
 * ------------------------------------------------------------------------- */

const p2 = (n: number): string => String(n).padStart(2, '0');

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** `base`'s day at hh:mm (local = shop time on the test machine). */
export function at(base: Date, hh: number, mm = 0): Date {
  const d = startOfDay(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export const mdy = (d: Date): string =>
  `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${String(d.getFullYear())}`;

/** `MM/dd/yyyy hh:mm a`, the app's date-time format. */
export function usDateTime(d: Date): string {
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${mdy(d)} ${p2(h)}:${p2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Is the `MM/dd/yyyy hh:mm a` text within `slackMs` of `ref` (minute-floored)? */
export function near(text: string, ref: number, slackMs = 2 * 60_000): boolean {
  const d = parseUsDateTime(text);
  return !!d && Math.abs(d.getTime() - Math.floor(ref / 60_000) * 60_000) <= slackMs;
}

/** Records "today 12:00 AM / 11:59 PM" can roll to another day close to midnight. */
export const nearMidnight = (d: Date = new Date()): boolean =>
  (d.getHours() === 0 && d.getMinutes() < 5) || (d.getHours() === 23 && d.getMinutes() >= 50);

/* ------------------------------------------------------------------------- *
 * Toasts
 * ------------------------------------------------------------------------- */

/** Wait (up to `timeout`) for a sonner toast containing `text`. */
export async function toastShown(text: string, timeout = 10_000): Promise<boolean> {
  return (
    (await P.poll(
      () => toastCount(text),
      (n) => n > 0,
      timeout,
    )) > 0
  );
}

/* ------------------------------------------------------------------------- *
 * Time Keeping dialog
 * ------------------------------------------------------------------------- */

/**
 * `count` staff that are OUT right now, enabled, uniquely named, not the suite's
 * `STAFF_NAME` — never-clocked-in staff first (their day has no records that a
 * new record could overlap). Leaves the dialog closed.
 */
export async function pickTimeStaff(count: number, exclude: readonly string[] = []): Promise<string[]> {
  await timeKeepingDialog.open();
  await timeKeepingDialog.clearSearch();
  const cards = await timeKeepingDialog.columnCards('unavailable');
  await timeKeepingDialog.close();
  const seen = new Map<string, number>();
  for (const c of cards) seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
  const banned = new Set([env.STAFF_NAME, ...exclude].filter(Boolean).map((s) => s.toLowerCase()));
  const usable = cards.filter(
    (c) =>
      c.name !== '' &&
      !c.disabled &&
      !c.selected &&
      seen.get(c.name) === 1 &&
      !banned.has(c.name.toLowerCase()),
  );
  const ordered = [...usable.filter((c) => c.time === ''), ...usable.filter((c) => c.time !== '')];
  return ordered.slice(0, count).map((c) => c.name);
}

/** Check In / Out one staff from the dialog (opens it when needed) and wait for the toast. WRITES ATTENDANCE. */
export async function tkToggle(staff: string, action: 'Check In' | 'Check Out'): Promise<void> {
  await timeKeepingDialog.open();
  if (action === 'Check In') await timeKeepingDialog.checkIn(staff);
  else await timeKeepingDialog.checkOut(staff);
  await toastShown(action === 'Check In' ? T.toastCheckIn : T.toastCheckOut, 5_000);
  await idle(100);
}

/** Check the staff OUT when they are IN. */
export async function tkEnsureOut(staff: string): Promise<void> {
  await timeKeepingDialog.open();
  if ((await timeKeepingDialog.columnOf(staff)) === 'available') await tkToggle(staff, 'Check Out');
  await timeKeepingDialog.clearSearch().catch(() => undefined);
  await timeKeepingDialog.close();
}

/** Column and tile text ("Name | IN | 10/08/2026 09:00 AM") of a staff in the open dialog (searches first). */
export async function tkTileOf(staff: string): Promise<{ column: TkColumn | null; text: string }> {
  await tkSearch(staff);
  for (const column of ['Available', 'Unavailable'] as const) {
    const tile = (await tkTiles(column)).find((t) => t.name === staff);
    if (tile) return { column, text: tile.text };
  }
  return { column: null, text: '' };
}

/** Is the staff's tile inert (`opacity-50` + `pointer-events-none`)? */
export async function tkTileInert(staff: string): Promise<{ opacity: boolean; pointerNone: boolean } | null> {
  await tkSearch(staff);
  return browser.execute(
    function (tileCss: string, nameCss: string, name: string) {
      const tile = Array.from(document.querySelectorAll(tileCss)).find(function (t) {
        return (t.querySelector(nameCss)?.textContent ?? '').trim() === name;
      }) as HTMLElement | undefined;
      if (!tile) return null;
      return {
        opacity: tile.className.includes('opacity-50'),
        pointerNone:
          tile.className.includes('pointer-events-none') || getComputedStyle(tile).pointerEvents === 'none',
      };
    },
    RptCss.tkTile,
    RptCss.tkTileName,
    staff,
  );
}

export { closeTkWithEscape, openTimeKeepingByUrl };

/* ------------------------------------------------------------------------- *
 * Time Tracking table
 * ------------------------------------------------------------------------- */

const lastLine = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .pop() ?? '';

/** Rendered rows, the Staff cell reduced to the nickname (the avatar initial is its own line). */
export async function rows(): Promise<TtRow[]> {
  return (await ttRows()).map((r) => ({ ...r, staff: lastLine(r.staff) }));
}

export async function rowsOf(staff: string): Promise<TtRow[]> {
  return (await rows()).filter((r) => r.staff === staff);
}

/** Open Time Tracking (gate answered), pick a preset, search the staff. */
export async function showStaff(staff: string, preset = 'Last 7 Days'): Promise<void> {
  if (!(await P.path()).startsWith('/time-tracking')) await ttOpen();
  await ttPreset(preset);
  await ttSearch(staff);
}

/** The staff's row whose Date IN is exactly `dateIn` (minute precision). */
export async function findRow(staff: string, dateIn: Date): Promise<TtRow | null> {
  const want = usDateTime(dateIn);
  return (await rowsOf(staff)).find((r) => r.dateIn === want) ?? null;
}

async function rowButton(row: TtRow, name: 'Edit' | 'Delete'): Promise<El> {
  return await $(`${T.rowCss(row.index)} button[aria-label="${name}"]`).getElement();
}

export async function rowButtonDisabled(row: TtRow, name: 'Edit' | 'Delete'): Promise<boolean> {
  const b = await rowButton(row, name);
  return !(await b.isEnabled());
}

/** Press Edit on the row and wait for "Edit Time Keeping". */
export async function openEdit(row: TtRow): Promise<void> {
  await P.closeToasts();
  const b = await rowButton(row, 'Edit');
  await b.scrollIntoView({ block: 'center' }).catch(() => undefined);
  await b.click();
  if (!(await waitDlg('edit', true))) throw new Error('"Edit Time Keeping" did not open');
  await idle(50);
}

/* ------------------------------------------------------------------------- *
 * Delete
 * ------------------------------------------------------------------------- */

const deleteDialog = { role: 'dialog', hasText: T.deleteTitle, nth: -1 } as const;

export async function openDelete(row: TtRow): Promise<void> {
  await P.closeToasts();
  const b = await rowButton(row, 'Delete');
  await b.scrollIntoView({ block: 'center' }).catch(() => undefined);
  await b.click();
  await P.waitFor(deleteDialog, Timeouts.MEDIUM, T.deleteTitle);
}

export async function deleteDialogOpen(): Promise<boolean> {
  return P.has(deleteDialog);
}

export async function deleteDialogText(): Promise<string> {
  return P.textOf(deleteDialog);
}

export async function cancelDelete(): Promise<void> {
  await P.clickQ([deleteDialog, { role: 'button', name: 'Cancel', nth: 0 }]);
  await P.waitGoneQ(deleteDialog, Timeouts.SHORT, T.deleteTitle);
}

export async function confirmDelete(): Promise<boolean> {
  await P.clickQ([deleteDialog, { role: 'button', name: 'Delete', nth: 0 }]);
  const ok = await toastShown(T.toastDeleted);
  await P.waitGoneQ(deleteDialog, Timeouts.SHORT, T.deleteTitle).catch(() => undefined);
  await idle(100);
  return ok;
}

export async function deleteRow(row: TtRow): Promise<void> {
  await openDelete(row);
  if (!(await confirmDelete()))
    throw new Error(`Delete of ${row.staff} ${row.dateIn} showed no success toast`);
}

/* ------------------------------------------------------------------------- *
 * Add / Edit dialog
 * ------------------------------------------------------------------------- */

async function markDlg(kind: DlgKind): Promise<boolean> {
  return browser.execute(function (title: string) {
    for (const e of Array.from(document.querySelectorAll('[data-vqtt-dlg]')))
      e.removeAttribute('data-vqtt-dlg');
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(function (d) {
      if (d.getClientRects().length === 0) return false;
      return Array.from(d.querySelectorAll('*')).some(function (e) {
        return e.children.length === 0 && (e.textContent ?? '').trim() === title;
      });
    });
    const dlg = dialogs[dialogs.length - 1];
    if (!dlg) return false;
    dlg.setAttribute('data-vqtt-dlg', '1');
    return true;
  }, TITLE[kind]);
}

export async function dlgOpen(kind: DlgKind): Promise<boolean> {
  return markDlg(kind);
}

export async function waitDlg(
  kind: DlgKind,
  open: boolean,
  timeout: number = Timeouts.MEDIUM,
): Promise<boolean> {
  return browser
    .waitUntil(async () => (await markDlg(kind)) === open, { timeout, interval: 200 })
    .then(
      () => true,
      () => false,
    );
}

async function markItem(kind: DlgKind, label: string): Promise<void> {
  if (!(await markDlg(kind))) throw new Error(`"${TITLE[kind]}" is not open`);
  const ok = await browser.execute(
    function (itemCss: string, labelCss: string, l: string) {
      for (const e of Array.from(document.querySelectorAll('[data-vqtt-fi]')))
        e.removeAttribute('data-vqtt-fi');
      const dlg = document.querySelector('[data-vqtt-dlg="1"]');
      if (!dlg) return false;
      const item = Array.from(dlg.querySelectorAll(itemCss)).find(function (fi) {
        const lab = fi.querySelector(labelCss);
        return !!lab && (lab.textContent ?? '').trim() === l;
      });
      if (!item) return false;
      item.setAttribute('data-vqtt-fi', '1');
      return true;
    },
    T.formItem,
    T.formLabel,
    label,
  );
  if (!ok) throw new Error(`"${TITLE[kind]}" has no form row "${label}"`);
}

async function inItem(kind: DlgKind, label: string, css: string): Promise<El> {
  await markItem(kind, label);
  const el = await $(`${ITEM} ${css}`).getElement();
  await el.waitForExist({ timeout: Timeouts.SHORT });
  return el;
}

const asText = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');

/** `HH:mm` (24 h) value of the Date IN / OUT time input. */
export async function timeValue(kind: DlgKind, label: 'Date IN' | 'Date OUT'): Promise<string> {
  return asText(await (await inItem(kind, label, T.timeInput)).getProperty('value'));
}

export async function timeInputAttrs(
  kind: DlgKind,
  label: 'Date IN' | 'Date OUT',
): Promise<{ type: string | null; inputmode: string | null; disabled: boolean }> {
  const el = await inItem(kind, label, T.timeInput);
  return {
    type: await el.getAttribute('type'),
    inputmode: await el.getAttribute('inputmode'),
    disabled: !(await el.isEnabled()),
  };
}

/**
 * Set the time input the way Playwright `fill('HH:mm')` does: the native value
 * setter + `input`/`change`, so React's onChange sees it. Keyboard typing into a
 * Chromium time input depends on the segment the caret lands in.
 */
export async function setTime(kind: DlgKind, label: 'Date IN' | 'Date OUT', d: Date): Promise<void> {
  const el = await inItem(kind, label, T.timeInput);
  const hhmm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  await browser.execute(
    function (input: HTMLInputElement, v: string) {
      input.focus();
      // React tracks the last value it saw; the prototype setter bypasses that tracker.
      Reflect.set(HTMLInputElement.prototype, 'value', v, input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    },
    el as unknown as HTMLInputElement,
    hhmm,
  );
  await settle(150);
}

/** Focus the time input (hours segment first) and type raw keys — TIME-073. */
export async function typeTime(kind: DlgKind, label: 'Date IN' | 'Date OUT', keys: string): Promise<void> {
  const el = await inItem(kind, label, T.timeInput);
  await browser.execute(
    function (input: HTMLInputElement) {
      input.focus();
    },
    el as unknown as HTMLInputElement,
  );
  await browser.keys(keys.split(''));
  await settle(200);
}

/** Text of the Date IN / OUT day button (`MM/dd/yyyy`, `''` when unset). */
export async function dateText(kind: DlgKind, label: 'Date IN' | 'Date OUT'): Promise<string> {
  const el = await inItem(kind, label, T.dateButton);
  const t = (await el.getText()).trim();
  return t !== '' ? t : asText(await el.getProperty('textContent'));
}

export async function dateButtonDisabled(kind: DlgKind, label: 'Date IN' | 'Date OUT'): Promise<boolean> {
  return !(await (await inItem(kind, label, T.dateButton)).isEnabled());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (d: Date): string =>
  `${String(d.getMonth() + 1)}/${String(d.getDate())}/${String(d.getFullYear())}`;

/** Open the Date IN / OUT calendar (single month, month/year Select caption). */
export async function openCalendar(kind: DlgKind, label: 'Date IN' | 'Date OUT'): Promise<void> {
  await markItem(kind, label);
  await clickIn(ITEM, T.dateButton);
  await settle(300);
}

/** State of a day in the open calendar: `null` when the shown month does not render it. */
export async function calendarDayState(d: Date): Promise<{ disabled: boolean } | null> {
  return browser.execute(
    function (popCss: string, key: string) {
      const pops = Array.from(document.querySelectorAll(popCss)).filter(function (p) {
        return p.getClientRects().length > 0 && !!p.querySelector('button[data-day]');
      });
      const pop = pops[pops.length - 1];
      const b = pop?.querySelector<HTMLButtonElement>(`button[data-day="${key}"]`);
      if (!b) return null;
      return { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' };
    },
    T.popper,
    dayKey(d),
  );
}

/** Pick a day in the Date IN / OUT calendar; the time keeps its hh:mm (`handleDateChange`). */
export async function pickDate(kind: DlgKind, label: 'Date IN' | 'Date OUT', d: Date): Promise<void> {
  await openCalendar(kind, label);
  const sel = `button[data-day="${dayKey(d)}"]`;
  if (!(await existsIn(T.popper, sel, 1500))) {
    await clickIn(T.popper, T.combobox, 1);
    await clickOption(String(d.getFullYear()));
    await clickIn(T.popper, T.combobox, 0);
    await clickIn(
      'body',
      `//*[@role="option"][starts-with(normalize-space(.), "${MONTHS[d.getMonth()] ?? ''}")]`,
    );
    await settle(200);
  }
  await clickIn(T.popper, sel);
  await settle(200);
}

/** Day first (the picker keeps hh:mm), then the time. */
export async function setDateTime(kind: DlgKind, label: 'Date IN' | 'Date OUT', d: Date): Promise<void> {
  if ((await dateText(kind, label)) !== mdy(d)) await pickDate(kind, label, d);
  await setTime(kind, label, d);
}

/** Staff picker trigger text (Add) — "Select staff" until chosen. */
export async function staffTriggerText(kind: DlgKind): Promise<string> {
  const el = await inItem(kind, 'Staff', T.combobox);
  const t = (await el.getText()).trim();
  return t !== '' ? t : asText(await el.getProperty('textContent'));
}

/** Edit: the staff row renders a disabled button instead of the picker. */
export async function staffButtonDisabled(): Promise<boolean> {
  const el = await inItem('edit', 'Staff', 'button');
  return !(await el.isEnabled());
}

export async function openStaffPicker(kind: DlgKind): Promise<void> {
  await markItem(kind, 'Staff');
  await clickIn(ITEM, T.combobox);
  await settle(300);
}

const dlgQ = (kind: DlgKind) => ({ role: 'dialog', hasText: TITLE[kind], nth: -1 }) as const;
const staffSearch = (kind: DlgKind) =>
  [dlgQ(kind), { css: `input[placeholder="${T.staffSearchPlaceholder}"]`, nth: 0 }] as const;

export async function staffSearchShown(kind: DlgKind): Promise<boolean> {
  return P.has(staffSearch(kind));
}

export async function fillStaffSearch(kind: DlgKind, text: string): Promise<void> {
  await P.fillQ(staffSearch(kind), text);
  await settle(300);
}

export async function staffOptionCount(kind: DlgKind): Promise<number> {
  return P.count([dlgQ(kind), { role: 'option' }]);
}

export async function noResultsShown(kind: DlgKind): Promise<boolean> {
  return P.has([dlgQ(kind), { text: 'No results found.' }]);
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Choose `staff` in the Add dialog's searchable picker (option text = avatar initial + nickname). */
export async function selectStaff(kind: DlgKind, staff: string): Promise<void> {
  await openStaffPicker(kind);
  await fillStaffSearch(kind, staff);
  await P.clickQ([dlgQ(kind), { role: 'option', nameRe: `(^|\\s)${esc(staff)}$`, nth: 0 }]);
  await settle(200);
}

const noteBox = (kind: DlgKind) =>
  [dlgQ(kind), { css: `[placeholder="${T.notePlaceholder}"]`, nth: 0 }] as const;

export async function noteShown(kind: DlgKind): Promise<boolean> {
  return P.has(noteBox(kind));
}

export async function noteValue(kind: DlgKind): Promise<string> {
  return P.inputValue(noteBox(kind));
}

export async function noteDisabled(kind: DlgKind): Promise<boolean> {
  return P.isDisabled(noteBox(kind));
}

/** Playwright `fill()` on the note (select-all + insert). */
export async function setNote(kind: DlgKind, text: string): Promise<void> {
  await P.fillQ(noteBox(kind), text);
}

/** Paste-like insert at the caret (`keyboard.insertText`) — respects `maxlength`. */
export async function insertNote(kind: DlgKind, text: string, atEnd = false): Promise<void> {
  await P.clickQ(noteBox(kind));
  if (atEnd) await browser.keys([Key.End]);
  await browser.execute(function (t: string) {
    document.execCommand('insertText', false, t);
  }, text);
  await settle(200);
}

/** Type key by key at the end of the note. */
export async function typeNoteAtEnd(kind: DlgKind, keys: string): Promise<void> {
  await P.clickQ(noteBox(kind));
  await browser.keys([Key.End]);
  await browser.keys(keys.split(''));
  await settle(200);
}

const submitBtn = (kind: DlgKind) =>
  [dlgQ(kind), { role: 'button', name: kind === 'add' ? 'Add' : 'Save', nth: 0 }] as const;

export async function submitEnabled(kind: DlgKind): Promise<boolean> {
  return !(await P.isDisabled(submitBtn(kind)));
}

export async function hasButton(kind: DlgKind, name: string): Promise<boolean> {
  return P.has([dlgQ(kind), { role: 'button', name, nth: 0 }]);
}

export async function submit(kind: DlgKind): Promise<void> {
  await P.clickQ(submitBtn(kind));
  await idle(100);
}

export async function fieldError(kind: DlgKind, label: FormLabel): Promise<string> {
  await markItem(kind, label);
  return browser.execute(
    function (css: string, msg: string) {
      const m = document.querySelector(`${css} ${msg}`);
      return m ? ((m as HTMLElement).innerText || m.textContent || '').trim() : '';
    },
    ITEM,
    T.formMessage,
  );
}

export async function formErrors(kind: DlgKind): Promise<string[]> {
  if (!(await markDlg(kind))) return [];
  return browser.execute(function (css: string) {
    return Array.from(document.querySelectorAll(css))
      .map(function (e) {
        return ((e as HTMLElement).innerText || e.textContent || '').trim();
      })
      .filter(Boolean);
  }, `${DLG} ${T.formMessage}`);
}

/** Close the Add / Edit dialog with its X (Escape as a fallback); never saves. */
export async function closeDlg(kind: DlgKind): Promise<void> {
  if (!(await markDlg(kind))) return;
  const x = [dlgQ(kind), { role: 'button', name: 'Close', nth: 0 }] as const;
  if (await P.has(x)) await P.clickQ(x);
  else await browser.keys([Key.Escape]);
  await waitDlg(kind, false, Timeouts.SHORT);
}

/** Open "Add New Time Keeping" (toasts closed first — they cover the + button). */
export async function openAdd(): Promise<void> {
  await P.closeToasts();
  await ttOpenAdd();
  await markDlg('add');
}

export interface RecordInput {
  staff: string;
  in: Date;
  out?: Date;
  note?: string;
}

/** Fill the Add form (does not submit). */
export async function fillAdd(r: RecordInput): Promise<void> {
  await openAdd();
  await selectStaff('add', r.staff);
  await setDateTime('add', 'Date IN', r.in);
  if (r.out) await setDateTime('add', 'Date OUT', r.out);
  if (r.note !== undefined) await setNote('add', r.note);
}

/** Add one record: `ok` = the success toast came up; otherwise the form's messages, dialog closed. */
export async function addRecord(r: RecordInput): Promise<{ ok: boolean; errors: string[] }> {
  await fillAdd(r);
  await submit('add');
  const ok = await toastShown(T.toastAdded, 6_000);
  const errors = ok ? [] : await formErrors('add');
  if (!ok) await closeDlg('add');
  await idle(100);
  return { ok, errors };
}

/** {@link addRecord} that must succeed. */
export async function addRecordOk(r: RecordInput): Promise<void> {
  const res = await addRecord(r);
  if (!res.ok) {
    throw new Error(
      `Add ${r.staff} ${usDateTime(r.in)} → ${r.out ? usDateTime(r.out) : '(open)'} failed: ${res.errors.join(' / ')}`,
    );
  }
}

/* ------------------------------------------------------------------------- *
 * Time wheel (Date OUT clock popover)
 * ------------------------------------------------------------------------- */

export async function openClock(kind: DlgKind, label: 'Date IN' | 'Date OUT'): Promise<void> {
  await markItem(kind, label);
  await clickIn(ITEM, T.clockTrigger);
  await settle(300);
}

/** The open wheel popover: one entry per wheel with its option labels (unique, sorted) and rect. */
export async function wheels(): Promise<
  { labels: string[]; index: number; rect: { x: number; y: number; w: number; h: number } }[]
> {
  return browser.execute(
    function (popCss: string, wheelCss: string, optCss: string, hlCss: string) {
      const pops = Array.from(document.querySelectorAll(popCss)).filter(function (p) {
        return p.getClientRects().length > 0 && !!p.querySelector(wheelCss);
      });
      const pop = pops[pops.length - 1];
      if (!pop) return [];
      return Array.from(pop.querySelectorAll(wheelCss)).map(function (w) {
        const labels = Array.from(
          new Set(
            Array.from(w.querySelectorAll(optCss))
              .map(function (o) {
                return (o.textContent ?? '').trim();
              })
              .filter(Boolean),
          ),
        ).sort();
        const hl = w.querySelector<HTMLElement>(hlCss);
        const m = hl ? /translateY\((-?[\d.]+)px\)/.exec(hl.style.transform) : null;
        const r = w.getBoundingClientRect();
        return {
          labels,
          index: m ? Math.round(-Number(m[1]) / 64) : 0,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        };
      });
    },
    T.popper,
    T.wheel,
    T.wheelOption,
    T.wheelHighlightList,
  );
}

export async function wheelPopoverOpen(): Promise<boolean> {
  return (await wheels()).length > 0;
}

/** Spin wheel `n` to option index `target` with mouse-wheel ticks (the library debounces < 100 ms). */
async function wheelTo(n: number, target: number, len: number, infinite: boolean): Promise<void> {
  for (let round = 0; round < 6; round += 1) {
    const w = (await wheels())[n];
    if (!w) throw new Error(`No wheel #${String(n)} in the time popover`);
    let d = target - (((w.index % len) + len) % len);
    if (infinite) {
      d = ((d % len) + len) % len;
      if (d > len / 2) d -= len;
    }
    if (d === 0) return;
    for (let i = 0; i < Math.abs(d); i += 1) {
      await P.wheel(w.rect.x + w.rect.w / 2, w.rect.y + w.rect.h / 2, d > 0 ? 120 : -120);
      await settle(150);
    }
    await settle(400);
  }
}

/** Spin hour (01–12), minute (00–59), AM/PM. */
export async function pickWheelTime(hour12: number, minute: number, meridiem: 'AM' | 'PM'): Promise<void> {
  await wheelTo(0, hour12 - 1, 12, true);
  await wheelTo(1, minute, 60, true);
  await wheelTo(2, meridiem === 'AM' ? 0 : 1, 2, false);
}

/* ------------------------------------------------------------------------- *
 * Cleanup / payroll lock
 * ------------------------------------------------------------------------- */

/**
 * Delete every record of `staff` created at/after `since` (−1 min). Looks in
 * Last 7 Days unless `range` is given. Throws on a locked (read-only) record.
 */
export async function deleteCreatedSince(staff: string, since: number, range?: [Date, Date]): Promise<void> {
  const cut = Math.floor(since / 60_000) * 60_000 - 60_000;
  await closeStrayDialogs();
  await ttOpen();
  if (range) {
    await ttPickRange(range[0], range[1]);
    await ttSearch(staff);
  } else {
    await ttPreset('Last 7 Days');
    await ttSearch(staff);
  }
  for (let guard = 0; guard < 30; guard += 1) {
    const mine = (await rowsOf(staff)).find((r) => (parseUsDateTime(r.createdAt)?.getTime() ?? 0) >= cut);
    if (!mine) return;
    if (await rowButtonDisabled(mine, 'Delete')) {
      throw new Error(`Record ${staff} ${mine.dateIn} is locked (payroll) — clean it up by hand`);
    }
    await deleteRow(mine);
  }
}

/** Standard end-of-test cleanup: check OUT, then delete records created since `since`. Never throws. */
export async function ttCleanup(
  staffs: readonly string[],
  since: number,
  range?: [Date, Date],
): Promise<string[]> {
  const errors: string[] = [];
  for (const s of staffs.filter(Boolean)) {
    await tkEnsureOut(s).catch((e: unknown) => errors.push(`Check Out ${s}: ${String(e)}`));
    await deleteCreatedSince(s, since, range).catch((e: unknown) =>
      errors.push(`Delete records of ${s}: ${String(e)}`),
    );
  }
  if (errors.length > 0) {
    console.warn(`[time cleanup] ${errors.join(' / ')}`);
  }
  return errors;
}

/**
 * Read the payroll lockedAt by adding a 01/01/2020 09:00–10:00 record: a locked
 * shop rejects it with "... (locked at: MM/dd/yyyy hh:mm a)". `saved` = no lock,
 * and the record WAS saved — clean it with range [01/01/2020, 01/01/2020].
 */
export async function probeLockedAt(
  staff: string,
): Promise<{ lockedAt: Date | null; saved: boolean; errors: string[] }> {
  await ttOpen();
  const day = new Date(2020, 0, 1);
  const r = await addRecord({ staff, in: at(day, 9), out: at(day, 10) });
  if (r.ok) return { lockedAt: null, saved: true, errors: [] };
  const m = /locked at: (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M)/.exec(r.errors.join(' '));
  return { lockedAt: m?.[1] ? parseUsDateTime(m[1]) : null, saved: false, errors: r.errors };
}

export { ttOpen, ttPreset, ttSearch, ttPickRange };
export type { TtRow };
