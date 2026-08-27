/**
 * `npm run app:kill` — clear everything a previous run left behind.
 *
 * Reach for this when a lane died mid-session, when preflight reports stale
 * processes, or before switching between the launch and attach lanes.
 *
 * It is not just tidiness. The app registers `tauri-plugin-single-instance`, so
 * a surviving window does not merely waste memory — it FORWARDS the next launch
 * to itself and exits the new process. The driver then holds a session against
 * a process it never started, and the failure surfaces as a selector that
 * cannot find anything.
 *
 * Flags:
 *   --app-only       leave tauri-driver / msedgedriver running
 *   --drivers-only   leave the app running (useful in the attach lane)
 */

import {
  APP_IMAGE_NAMES,
  DRIVER_IMAGE_NAMES,
  killStaleProcesses,
  runningImages,
} from '../src/support/process.js';

const line = (text = ''): void => console.log(text);

const appOnly = process.argv.includes('--app-only');
const driversOnly = process.argv.includes('--drivers-only');

function main(): number {
  const killApp = !driversOnly;
  const killDrivers = !appOnly;

  const targets = [...(killApp ? APP_IMAGE_NAMES : []), ...(killDrivers ? DRIVER_IMAGE_NAMES : [])];

  line();
  line('='.repeat(78));
  line(' VOLT POS E2E — stopping leftover processes');
  line('='.repeat(78));
  line(` Targets   ${targets.join(', ')}`);
  line();

  const before = runningImages(targets);
  if (!before.length) {
    line('  [ OK ]  Nothing was running. The machine is already clean.');
    line();
    return 0;
  }

  line(`  [INFO]  Found ${String(before.length)} live image(s): ${before.join(', ')}`);
  const killed = killStaleProcesses({ app: killApp, drivers: killDrivers });
  for (const image of killed) line(`  [ OK ]  killed ${image} (with its child processes)`);

  // taskkill returns before the kernel has finished tearing the tree down, and
  // a WebView2 host can outlive its parent by a beat — so verify rather than
  // trust the exit code.
  const survivors = runningImages(targets);
  line();
  if (survivors.length) {
    line(`  [FAIL]  Still running after taskkill /F /T: ${survivors.join(', ')}`);
    line();
    line('  Something is holding these open — a debugger attached to the app, or a process');
    line('  owned by another user. Check Task Manager, or run this shell as the same user');
    line('  that started the app.');
    line();
    return 1;
  }

  line(`  [ OK ]  All ${String(before.length)} image(s) are gone.`);
  line();
  line('  Next:  npm run preflight       verify the machine is ready for a lane');
  line();
  return 0;
}

process.exitCode = main();
