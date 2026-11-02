/**
 * Detached wrapper for one GUI run.
 *
 * runner.mjs spawns this DETACHED with its output going to a file, never to a
 * pipe back to the server. If the server dies mid-run (crash, window killed,
 * port fight), the run keeps going: before this, wdio wrote into the server's
 * stdout pipe, got EPIPE the moment the server went away, and a 4-hour run
 * died silently at 146/2208.
 *
 * It runs the command, then records the exit code in the run-state file so a
 * restarted server can tell "finished" from "killed".
 *
 *   node run-job.mjs <state.json> <command…>
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [stateFile, ...cmdParts] = process.argv.slice(2);
const cmd = cmdParts.join(' ');

function patchState(patch) {
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    writeFileSync(stateFile, JSON.stringify({ ...state, ...patch }, null, 2));
  } catch (err) {
    console.error(`[run-job] could not update ${stateFile}: ${err}`);
  }
}

/**
 * Keep Windows awake for as long as this job lives. On battery the machine
 * drops into Modern Standby after a few idle minutes, which froze a full run
 * for 5 hours and let a restart kill it. A hidden PowerShell holds
 * ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED and exits on its own
 * once this process is gone, so the request never outlives the run.
 */
function keepAwake() {
  if (process.platform !== 'win32') return;
  const ps = [
    `Add-Type -Name P -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'`,
    '[W.P]::SetThreadExecutionState([uint32]"0x80000003") | Out-Null',
    `while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 30 }`,
  ].join('; ');
  try {
    const guard = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
    guard.on('error', (err) => console.error(`[run-job] keep-awake failed: ${err}`));
    guard.unref();
  } catch (err) {
    console.error(`[run-job] keep-awake failed: ${err}`);
  }
}

/**
 * Resume the apps runner.mjs froze for this run (scripts/freeze-apps.ps1). Done
 * here, not only in the server, so they come back even when the GUI was closed
 * mid-run; Stop kills this process, and the server thaws in that case.
 */
function thawApps() {
  const { FREEZE_SCRIPT, FREEZE_STATE } = process.env;
  if (process.platform !== 'win32' || !FREEZE_SCRIPT || !FREEZE_STATE || !existsSync(FREEZE_STATE)) return;
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', FREEZE_SCRIPT, '-Action', 'Thaw', '-StateFile', FREEZE_STATE],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  );
  console.log(`${r.stdout ?? ''}${r.stderr ?? ''}`.trim());
}

keepAwake();
const child = spawn(cmd, { shell: true, stdio: 'inherit', windowsHide: true });
child.on('close', (code) => {
  console.log(`\n[runner] process exited with code ${code}`);
  thawApps();
  patchState({ exitCode: code ?? -1, finishedAt: new Date().toISOString() });
  process.exit(code ?? 1);
});
