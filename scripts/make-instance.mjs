/**
 * `node scripts/make-instance.mjs <n> [--app <installed volt-pos.exe>]`
 *
 * Builds parallel test instance <n> (docs/parallel-instances.md) from the
 * INSTALLED app — no source build, so the copy is exactly the build under test:
 *
 *   D:\VoltE2E\i<n>\volt-pos-i<n>.exe       the app, Tauri identifier VoltPOS → VoltP0<n>
 *   D:\VoltE2E\i<n>\msedgedriver-i<n>.exe   drivers renamed, so kills stay per instance
 *   D:\VoltE2E\i<n>\tauri-driver-i<n>.exe
 *   D:\VoltE2E\i<n>\window-offscreen.json   placement seeded before every launch — on the right
 *                                          screen edge, since tauri-plugin-window-state drops the
 *                                          saved size of an off-screen position; the lane's
 *                                          park-windows.ps1 then moves it fully out of sight
 *   D:\VoltE2E\i<n>\window-visible.json     …and for the one-time device sign-in
 *
 * ## Why patching the identifier is enough
 *
 * The identifier decides everything that makes a second copy collide with the
 * first: tauri-plugin-single-instance's mutex and window class (`<id>-sim`,
 * `<id>-sic` — a second launch would otherwise just focus the first window and
 * exit), the app data folder (%APPDATA%\<id>: device sign-in, local databases)
 * and the WebView2 profile (%LOCALAPPDATA%\<id>\EBWebView). The compiler builds
 * the 7-byte "VoltPOS" with two overlapping 4-byte stores — `mov dword [rax+3],
 * 'tPOS'` then `mov dword [rax], 'Volt'` — so rewriting the last two bytes of the
 * first immediate gives a same-length identifier without moving anything.
 *
 * Re-run after installing a new build: the bytes are found by pattern, not offset.
 * The copy starts signed out — sign it in once from its QR (`launch.cmd visible`).
 */

import fs from 'node:fs';
import path from 'node:path';

const n = Number(process.argv[2]);
if (!Number.isInteger(n) || n < 1 || n > 9) {
  console.error('usage: node scripts/make-instance.mjs <1-9> [--app <path to installed volt-pos.exe>]');
  process.exit(2);
}
const appArg = process.argv.indexOf('--app');
const installed =
  appArg > 0
    ? process.argv[appArg + 1]
    : path.join(process.env.LOCALAPPDATA ?? '', 'Volt POS', 'volt-pos.exe');
const root = process.env.VOLT_INSTANCE_ROOT || 'D:\\VoltE2E';
const dir = path.join(root, `i${n}`);
const repo = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
);

// mov dword ptr [rax+3], 'tPOS'  …  mov dword ptr [rax], 'Volt'
const STORE_TAIL = Buffer.from([0xc7, 0x40, 0x03, 0x74, 0x50, 0x4f, 0x53]);
const STORE_HEAD = Buffer.from([0xc7, 0x00, 0x56, 0x6f, 0x6c, 0x74]);

const exe = fs.readFileSync(installed);
const hits = [];
for (let i = exe.indexOf(STORE_TAIL); i !== -1; i = exe.indexOf(STORE_TAIL, i + 1)) {
  // The 'Volt' store follows within a few instructions.
  if (exe.subarray(i + 7, i + 40).indexOf(STORE_HEAD) !== -1) hits.push(i);
}
if (hits.length !== 1) {
  console.error(
    `expected exactly one identifier store in ${installed}, found ${hits.length} — build layout changed`,
  );
  process.exit(1);
}
const digits = String(n).padStart(2, '0');
exe[hits[0] + 5] = digits.charCodeAt(0);
exe[hits[0] + 6] = digits.charCodeAt(1);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `volt-pos-i${n}.exe`), exe);
for (const extra of fs.readdirSync(path.dirname(installed))) {
  if (/\.dll$/i.test(extra))
    fs.copyFileSync(path.join(path.dirname(installed), extra), path.join(dir, extra));
}
fs.copyFileSync(path.join(repo, '.drivers', 'msedgedriver.exe'), path.join(dir, `msedgedriver-i${n}.exe`));
fs.copyFileSync(path.join(repo, '.drivers', 'tauri-driver.exe'), path.join(dir, `tauri-driver-i${n}.exe`));

const win = (main) => ({
  main,
  customer: {
    width: 1920,
    height: 1080,
    x: 1910,
    y: 0,
    prev_x: 1910,
    prev_y: 0,
    maximized: false,
    visible: true,
    decorated: false,
    fullscreen: false,
  },
});
const parked = {
  width: 1920,
  height: 1080,
  x: 1910,
  y: 0,
  prev_x: 1910,
  prev_y: 0,
  maximized: false,
  visible: true,
  decorated: false,
  fullscreen: false,
};
const shown = {
  width: 1100,
  height: 820,
  x: 300,
  y: 110,
  prev_x: 300,
  prev_y: 110,
  maximized: false,
  visible: true,
  decorated: true,
  fullscreen: false,
};
fs.writeFileSync(path.join(dir, 'window-offscreen.json'), JSON.stringify(win(parked), null, 2));
fs.writeFileSync(path.join(dir, 'window-visible.json'), JSON.stringify(win(shown), null, 2));

// Which install this copy was made from — the GUI remakes it when the installed exe changes.
const src = fs.statSync(installed);
fs.writeFileSync(
  path.join(dir, 'source.json'),
  JSON.stringify(
    { installed, size: src.size, mtimeMs: src.mtimeMs, madeAt: new Date().toISOString() },
    null,
    2,
  ),
);

const cdp = 9222 + 10 * n;
fs.writeFileSync(
  path.join(dir, 'launch.cmd'),
  [
    '@echo off',
    `rem Volt POS test instance ${n} (identifier VoltP${digits}, CDP ${cdp}) — made by scripts/make-instance.mjs.`,
    'rem "visible" opens the staff window on screen (device sign-in); otherwise it starts parked.',
    `if not exist "%APPDATA%\\VoltP${digits}" mkdir "%APPDATA%\\VoltP${digits}"`,
    'if /I "%~1"=="visible" (',
    `  copy /Y "%~dp0window-visible.json" "%APPDATA%\\VoltP${digits}\\.window-state.json" >nul`,
    ') else (',
    `  copy /Y "%~dp0window-offscreen.json" "%APPDATA%\\VoltP${digits}\\.window-state.json" >nul`,
    ')',
    `set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${cdp} --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling"`,
    `start "" "%~dp0volt-pos-i${n}.exe"`,
    '',
  ].join('\r\n'),
);
console.log(`instance ${n} ready in ${dir} (identifier VoltP${digits}, CDP ${cdp}, driver ${4444 + 10 * n})`);
