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

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

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

const child = spawn(cmd, { shell: true, stdio: 'inherit', windowsHide: true });
child.on('close', (code) => {
  console.log(`\n[runner] process exited with code ${code}`);
  patchState({ exitCode: code ?? -1, finishedAt: new Date().toISOString() });
  process.exit(code ?? 1);
});
