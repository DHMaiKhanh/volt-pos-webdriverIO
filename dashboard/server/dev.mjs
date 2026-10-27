/**
 * Dev launcher: start the run-control server and the Vite dev server together.
 *
 * `npm run dev:all` runs this. It spawns both as children and forwards their
 * output with a short prefix, so one terminal shows the dashboard URL and the
 * runner logs side by side. Ctrl-C kills both.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASH_ROOT = path.resolve(__dirname, '..');

function run(label, cmd, args) {
  const child = spawn(cmd, args, { cwd: DASH_ROOT, shell: true, env: process.env });
  const prefix = (line) => `[${label}] ${line}`;
  const pipe = (stream, out) => {
    stream.on('data', (d) => {
      for (const line of d.toString().split(/\r?\n/)) {
        if (line.length) out(prefix(line));
      }
    });
  };
  pipe(child.stdout, (s) => console.log(s));
  pipe(child.stderr, (s) => console.error(s));
  child.on('close', (code) => {
    console.log(prefix(`exited with code ${code}`));
    process.exit(code ?? 0);
  });
  return child;
}

const runner = run('runner', 'node', ['server/runner.mjs']);
const vite = run('vite', 'npx', ['vite']);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    runner.kill();
    vite.kill();
    process.exit(0);
  });
}
