#!/usr/bin/env node
/**
 * Screen recorder for QC evidence videos (the "🎬 Video" link in a Linear
 * verify comment).
 *
 *   npm run rec:start -- --name VP-5711-01        # start recording the whole desktop
 *   npm run rec:start -- --name VP-5711-01 --window "Volt POS"   # one window only
 *   ... drive the app ...
 *   npm run rec:stop                              # finalize → prints the .mp4 path
 *   npm run rec:status
 *
 * Source (auto): when the app exposes CDP 9222 it films the app's own WebViews —
 * staff screen + customer display side by side (--screens staff,customer) —
 * through screencast/captureScreenshot, so windows covering the POS (Claude,
 * Chrome…) never end up on film. Without CDP, or with --window/--source desktop,
 * it falls back to gdigrab, which films whatever is on top of the screen.
 *
 * How it stays safe if something dies: a detached worker owns ffmpeg's stdin.
 * It records to .mkv (still playable when cut off), and on `stop` it sends "q"
 * so ffmpeg flushes cleanly, then remuxes to a browser-friendly .mp4
 * (+faststart) that Linear plays inline. A hard cap (--max, default 600 s)
 * stops a forgotten recording.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, '.recordings');
const STATE = path.join(OUT_DIR, '.current.json');
const STOP_FLAG = path.join(OUT_DIR, '.stop');

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; } };
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1);

async function start(o) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cur = readState();
  if (cur && cur.status === 'recording' && alive(cur.workerPid)) {
    console.error(`Already recording → ${cur.mp4}. Run "npm run rec:stop" first.`);
    process.exit(1);
  }
  try { fs.unlinkSync(STOP_FLAG); } catch { /* none */ }
  const name = String(o.name && o.name !== true ? o.name : 'rec').replace(/[^\w.-]+/g, '_');
  const base = path.join(OUT_DIR, `${name}-${stamp()}`);
  // Source: the app's own WebViews over CDP when the app exposes 9222 (films
  // staff + customer display even when covered by other windows), else the desktop.
  const window = o.window && o.window !== true ? String(o.window) : null;
  let source = o.source && o.source !== true ? String(o.source) : null;
  if (!source) source = !window && (await cdpPages())?.length ? 'cdp' : 'desktop';
  const screens = String(o.screens && o.screens !== true ? o.screens : 'staff,customer').split(',').map((x) => x.trim());
  const state = {
    status: 'starting', mkv: `${base}.mkv`, mp4: `${base}.mp4`, log: `${base}.ffmpeg.log`,
    source, screens, window,
    fps: Number(o.fps) || 10, max: Number(o.max) || 600, width: Number(o.width) || 1920,
    startedAt: new Date().toISOString(),
  };
  writeState(state);
  const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), '_worker'], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  worker.unref();
  // Wait until ffmpeg has actually produced data, so the first click is on film.
  // gdigrab needs a few seconds before the first frame; .mkv size lags behind
  // (cluster buffering), so watch ffmpeg's own "frame=N" counter instead.
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const s = readState();
    if (s?.status === 'failed') { console.error(`Recording failed — see ${s.log}`); process.exit(1); }
    let frames = 0;
    try { frames = Math.max(0, ...[...fs.readFileSync(s.log, 'utf8').matchAll(/frame=\s*(\d+)/g)].map((m) => Number(m[1]))); } catch { /* not yet */ }
    if (s?.status === 'recording' && frames > 0) {
      const what = source === 'cdp' ? `app CDP (${screens.join(' + ')})` : state.window ? `window "${state.window}"` : 'desktop';
      console.log(`● REC ${what} → ${s.mp4} (auto-stop after ${state.max}s)`);
      return;
    }
  }
  console.error(`Recorder did not start within 20s — see ${state.log}`);
  process.exit(1);
}

// ---------------------------------------------------------------- CDP source
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';

async function cdpPages() {
  try {
    const r = await fetch(`${CDP}/json`, { signal: AbortSignal.timeout(2000) });
    return (await r.json()).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  } catch { return null; }
}

const screenOf = (t) => (/\/customer\b/.test(t.url) ? 'customer' : 'staff');

/** One CDP page → latest JPEG frame kept fresh by screencast + a slow screenshot poll. */
async function openFeed(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const feed = { screen: screenOf(target), frame: null, lastAt: 0, ws };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Page.screencastFrame') {
      feed.frame = Buffer.from(m.params.data, 'base64'); feed.lastAt = Date.now();
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
    }
  };
  feed.call = (method, params = {}) => new Promise((res) => {
    const my = ++id; pending.set(my, res);
    ws.send(JSON.stringify({ id: my, method, params }));
    setTimeout(() => { if (pending.delete(my)) res(null); }, 3000);
  });
  await feed.call('Page.enable');
  await feed.call('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1920, maxHeight: 1080 });
  // A window hidden behind others may stop painting screencast frames;
  // captureScreenshot forces a fresh frame, so poll it when screencast is quiet.
  feed.shoot = async () => {
    const r = await feed.call('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    if (r?.data) { feed.frame = Buffer.from(r.data, 'base64'); feed.lastAt = Date.now(); }
  };
  await feed.shoot();
  return feed;
}

async function cdpWorker(s) {
  const pages = (await cdpPages()) ?? [];
  const wanted = s.screens;
  const targets = pages.filter((t) => wanted.includes(screenOf(t)));
  if (!targets.length) throw new Error(`no CDP page for ${wanted.join(',')} at ${CDP}`);
  const feeds = await Promise.all(targets.map(openFeed));
  const log = fs.openSync(s.log, 'w');
  const parts = feeds.map((f) => {
    const file = s.mkv.replace(/\.mkv$/, `.${f.screen}.mkv`);
    const ff = spawn(ffmpegPath, [
      '-hide_banner', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(s.fps), '-i', '-',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-g', String(s.fps * 2), file,
    ], { stdio: ['pipe', 'ignore', log], windowsHide: true });
    ff.stdin.on('error', () => { /* closed */ });
    return { feed: f, ff, file, done: new Promise((r) => ff.on('exit', r)) };
  });
  writeState({ ...s, status: 'recording', workerPid: process.pid, parts: parts.map((p) => p.file) });
  fs.writeSync(log, `frame= 1 (cdp ${parts.map((p) => p.feed.screen).join('+')})\n`);

  const started = Date.now();
  const tick = setInterval(() => {
    for (const p of parts) if (p.feed.frame) p.ff.stdin.write(p.feed.frame);
  }, Math.round(1000 / s.fps));
  const poll = setInterval(() => {
    for (const p of parts) if (Date.now() - p.feed.lastAt > 400) void p.feed.shoot();
  }, 250);
  await new Promise((r) => {
    const t = setInterval(() => {
      if (fs.existsSync(STOP_FLAG) || Date.now() - started > s.max * 1000) { clearInterval(t); r(); }
    }, 250);
  });
  clearInterval(tick); clearInterval(poll);
  for (const p of parts) { p.ff.stdin.end(); try { p.feed.ws.close(); } catch { /* gone */ } }
  await Promise.all(parts.map((p) => p.done));

  writeState({ ...readState(), status: 'finalizing' });
  // Two screens → side by side at the same height; one screen → plain remux.
  const args2 = parts.length === 1
    ? ['-i', parts[0].file, '-c', 'copy']
    : [...parts.flatMap((p) => ['-i', p.file]),
      '-filter_complex', `${parts.map((_, i) => `[${i}:v]scale=-2:720[v${i}]`).join(';')};${parts.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${parts.length},format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28'];
  const fin = spawn(ffmpegPath, ['-hide_banner', '-y', ...args2, '-movflags', '+faststart', s.mp4], { stdio: ['ignore', 'ignore', log], windowsHide: true });
  const rc = await new Promise((r) => fin.on('exit', r));
  if (rc === 0) { for (const p of parts) fs.rmSync(p.file, { force: true }); fs.closeSync(log); fs.rmSync(s.log, { force: true }); }
  try { fs.unlinkSync(STOP_FLAG); } catch { /* none */ }
  writeState({ ...readState(), status: rc === 0 ? 'done' : 'failed', stoppedAt: new Date().toISOString() });
}

async function worker() {
  const s = readState();
  if (s.source === 'cdp') {
    try { await cdpWorker(s); } catch (e) {
      fs.appendFileSync(s.log, `\n${e?.stack ?? e}\n`);
      writeState({ ...readState(), status: 'failed' });
    }
    return;
  }
  const input = s.window ? ['-i', `title=${s.window}`] : ['-i', 'desktop'];
  const ff = spawn(ffmpegPath, [
    '-hide_banner', '-y', '-f', 'gdigrab', '-framerate', String(s.fps), '-draw_mouse', '1', ...input,
    '-t', String(s.max),
    '-vf', `scale='min(${s.width},iw)':-2:flags=bicubic,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-g', String(s.fps * 2),
    s.mkv,
  ], { stdio: ['pipe', 'ignore', fs.openSync(s.log, 'w')], windowsHide: true });
  writeState({ ...s, status: 'recording', workerPid: process.pid, ffmpegPid: ff.pid });

  const poll = setInterval(() => {
    if (fs.existsSync(STOP_FLAG)) { clearInterval(poll); try { ff.stdin.write('q'); } catch { /* exited */ } }
  }, 250);
  const code = await new Promise((r) => ff.on('exit', r));
  clearInterval(poll);
  if (!fs.existsSync(s.mkv) || fs.statSync(s.mkv).size === 0) {
    writeState({ ...readState(), status: 'failed', exitCode: code });
    return;
  }
  writeState({ ...readState(), status: 'finalizing' });
  const remux = spawn(ffmpegPath, ['-hide_banner', '-y', '-i', s.mkv, '-c', 'copy', '-movflags', '+faststart', s.mp4],
    { stdio: 'ignore', windowsHide: true });
  const rc = await new Promise((r) => remux.on('exit', r));
  if (rc === 0 && fs.existsSync(s.mp4)) {
    fs.unlinkSync(s.mkv);
    try { fs.unlinkSync(s.log); } catch { /* keep */ }
  }
  try { fs.unlinkSync(STOP_FLAG); } catch { /* none */ }
  writeState({ ...readState(), status: rc === 0 ? 'done' : 'failed', stoppedAt: new Date().toISOString() });
}

async function stop() {
  const s = readState();
  if (!s) { console.error('No recording.'); process.exit(1); }
  if (s.status === 'recording' || s.status === 'finalizing' || s.status === 'starting') {
    fs.writeFileSync(STOP_FLAG, '1');
    for (let i = 0; i < 900; i++) { // up to 3 min: side-by-side re-encode of a long take
      await sleep(200);
      const c = readState();
      if (c.status === 'done' || c.status === 'failed' || !alive(c.workerPid)) break;
    }
  }
  const c = readState();
  if (c.status === 'done' && fs.existsSync(c.mp4)) {
    const secs = Math.round((Date.parse(c.stoppedAt) - Date.parse(c.startedAt)) / 1000);
    console.log(`■ Saved ${c.mp4} (${mb(c.mp4)} MB, ~${secs}s)`);
  } else {
    console.error(`Recording not finalized (status ${c.status}). Raw file: ${c.mkv} — log ${c.log}`);
    process.exit(1);
  }
}

function status() {
  const s = readState();
  if (!s) return console.log('idle');
  const running = s.workerPid && alive(s.workerPid);
  console.log(`${s.status}${running ? '' : ' (worker not running)'} → ${s.mp4}`);
}

const o = args(process.argv.slice(2));
const cmd = o._[0];
if (cmd === 'start') await start(o);
else if (cmd === 'stop') await stop();
else if (cmd === 'status') status();
else if (cmd === '_worker') await worker();
else {
  console.log('usage: record.mjs start [--name X] [--source cdp|desktop] [--screens staff,customer] [--window "Title"] [--fps 10] [--max 600] [--width 1920] | stop | status');
  process.exit(cmd ? 1 : 0);
}
