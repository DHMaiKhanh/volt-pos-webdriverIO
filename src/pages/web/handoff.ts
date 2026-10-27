import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../../../configs/constants/paths.js';
import type { AppointmentHandoff } from './OrderSitePage.js';

/**
 * Where the web lane leaves the appointment it created, so the app lane — a
 * separate WebdriverIO process with its own config — can read the correlation
 * key back. A file is the simplest channel between two independent runs, and
 * `.tmp/` is already git-ignored and wiped by `npm run clean`.
 */
export const HANDOFF_FILE = path.join(Paths.TMP, 'web-appointment-handoff.json');

export function writeHandoff(handoff: AppointmentHandoff): void {
  fs.mkdirSync(Paths.TMP, { recursive: true });
  fs.writeFileSync(HANDOFF_FILE, JSON.stringify(handoff, null, 2), 'utf8');
}

/** Read the handoff, or null if the web lane has not run yet. */
export function readHandoff(): AppointmentHandoff | null {
  if (!fs.existsSync(HANDOFF_FILE)) return null;
  return JSON.parse(fs.readFileSync(HANDOFF_FILE, 'utf8')) as AppointmentHandoff;
}
