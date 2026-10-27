#!/usr/bin/env node
/**
 * Reusable CDP driver for the Volt POS WebView2 app (attach lane).
 *
 * The app is Tauri v2 + WebView2 (Chromium). When launched with remote
 * debugging (`npm run app:launch`), it exposes CDP on 127.0.0.1:9222. This
 * script attaches over that endpoint — no dev server, no source, drives the
 * REAL running app. Same mechanism as configs/wdio/wdio.attach.conf.ts.
 *
 * Requires Node >= 22 (global WebSocket / fetch). No npm dependency.
 *
 * Subcommands:
 *   node cdp.mjs targets                       list all page targets (url + id)
 *   node cdp.mjs scan [urlSubstr]              structured DOM dump of a screen (JSON)
 *   node cdp.mjs text [urlSubstr]              visible innerText of <body> (raw)
 *   node cdp.mjs shot <outPath> [urlSubstr]    save a PNG screenshot
 *   node cdp.mjs eval <jsFile> [urlSubstr]     eval a JS expression file, print JSON result
 *   node cdp.mjs click "<text>" [urlSubstr]    click element by visible text/role, print new url
 *   node cdp.mjs nav-home [urlSubstr]          click the app logo/back to reach /home
 *   node cdp.mjs type "<field>" "<value>" [urlSubstr]
 *                                              fill an input found by placeholder/label/testid/name
 *   node cdp.mjs watch <seconds> [urlSubstr]   BUG SIGNAL: listen for console errors, uncaught
 *                                              exceptions and failed/4xx/5xx network calls while
 *                                              you (or another command) drive the app; prints JSON
 *
 * urlSubstr picks WHICH webview: omit = main POS window (not /customer/);
 * pass "customer" to drive the customer display.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = process.env.REMOTE_DEBUG_PORT || 9222;
const [cmd, ...rest] = process.argv.slice(2);

async function listTargets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json`).catch(() => null);
  if (!r) die('CDP endpoint not reachable on :' + PORT + ' — is the app running? (npm run app:launch)');
  return (await r.json()).filter((t) => t.type === 'page');
}
function pickTarget(ts, sub) {
  const t = sub
    ? ts.find((x) => (x.url || '').includes(sub))
    : // skip the customer display and the about:blank tab a wdio attach session leaves behind
      ts.find((x) => /^https?:/.test(x.url || '') && !x.url.includes('/customer/')) || ts[0];
  if (!t) die('No matching target. Available: ' + JSON.stringify(ts.map((x) => x.url)));
  return t;
}
function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function withSocket(target, fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      }
    });
    ws.addEventListener('open', async () => {
      try {
        const out = await fn(send);
        ws.close();
        resolve(out);
      } catch (e) {
        ws.close();
        reject(e);
      }
    });
    ws.addEventListener('error', (e) => reject(new Error('WS ' + (e.message || e))));
  });
}

async function evaluate(target, expression) {
  return withSocket(target, async (send) => {
    await send('Runtime.enable', {});
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      allowUnsafeEvalBlocklistBypass: true,
    });
    if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
    return r.result.value;
  });
}

// ---- DOM scanner expression (returns structured screen model) ----
const SCAN_EXPR = `(() => {
  const clip = (s, n = 60) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n);
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  const uniq = (a) => [...new Set(a)];
  const testids = [...document.querySelectorAll('[data-testid]')].map((el) => ({
    id: el.getAttribute('data-testid'), tag: el.tagName.toLowerCase(), text: clip(el.textContent, 40), vis: vis(el) }));
  const interactive = [...document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"],[role="combobox"]')]
    .filter(vis).map((el) => ({ role: el.getAttribute('role') || el.tagName.toLowerCase(),
      text: clip(el.textContent || el.getAttribute('aria-label'), 50),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      testid: el.getAttribute('data-testid') || null })).filter((x) => x.text);
  const headings = uniq([...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')].filter(vis).map((el) => clip(el.textContent, 60)).filter(Boolean));
  const inputs = [...document.querySelectorAll('input,textarea,select')].filter(vis).map((el) => ({
    type: el.type || el.tagName.toLowerCase(), placeholder: clip(el.placeholder, 50), value: clip(el.value, 30), testid: el.getAttribute('data-testid') || null }));
  const links = [...document.querySelectorAll('a[href]')].filter(vis).map((el) => ({ href: el.getAttribute('href'), text: clip(el.textContent || el.getAttribute('aria-label'), 40) }));
  const dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis).map((el) => clip(el.textContent, 240));
  return { url: location.href, title: document.title, headings, interactive, inputs, links, dialogs,
    counts: { interactive: interactive.length, testids: testids.length, inputs: inputs.length }, testids };
})()`;

// ---- click-by-text expression builder ----
function clickExpr(text) {
  const t = JSON.stringify(text);
  return `(async () => {
    const target = ${t};
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const clickable = [...document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"],[role="link"]')].filter(vis);
    let el = clickable.find((e) => norm(e.textContent) === target)
          || clickable.find((e) => norm(e.textContent).startsWith(target))
          || clickable.find((e) => norm(e.textContent).includes(target));
    if (!el) {
      // fall back to any visible element whose exact text matches, then climb to nearest clickable
      const any = [...document.querySelectorAll('*')].filter((e) => vis(e) && norm(e.textContent) === target && e.querySelectorAll('*').length < 12);
      el = any.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
      if (el) el = el.closest('button,a,[role="button"],[role="tab"]') || el;
    }
    if (!el) return { ok: false, reason: 'not found: ' + target };
    if (el.disabled) return { ok: false, reason: 'disabled: ' + target };
    el.scrollIntoView({ block: 'center' });
    el.click();
    await new Promise((r) => setTimeout(r, 1200));
    return { ok: true, url: location.href, clicked: norm(el.textContent).slice(0, 50) };
  })()`;
}

const NAV_HOME_EXPR = `(async () => {
  let a = document.querySelector('a[href="/home"]');
  if (a) { a.click(); await new Promise((r) => setTimeout(r, 1200)); }
  if (!location.href.endsWith('/home')) {
    const btns = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left < 140 && r.top < 140; });
    if (btns[0]) { btns[0].click(); await new Promise((r) => setTimeout(r, 1200)); }
  }
  return { ok: true, url: location.href };
})()`;

// ---- fill-input expression builder (React-safe: native setter + input/change events) ----
function typeExpr(field, value) {
  return `(async () => {
    const f = ${JSON.stringify(field)}.toLowerCase(), v = ${JSON.stringify(value)};
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const labelOf = (el) => ((el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent) || el.closest('label')?.textContent || '');
    const keys = (el) => [el.placeholder, el.getAttribute('aria-label'), el.getAttribute('data-testid'), el.name, labelOf(el)].map((x) => (x || '').toLowerCase());
    const els = [...document.querySelectorAll('input,textarea')].filter(vis);
    const el = els.find((e) => keys(e).some((k) => k === f)) || els.find((e) => keys(e).some((k) => k.includes(f)));
    if (!el) return { ok: false, reason: 'input not found: ' + f, inputs: els.map((e) => keys(e).filter(Boolean)[0] || e.type) };
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, field: keys(el).filter(Boolean)[0], readBack: el.value };
  })()`;
}

// ---- watch: collect runtime + network errors for N seconds ----
async function watch(target, seconds) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const out = { url: target.url, seconds, consoleErrors: [], exceptions: [], failedRequests: [], httpErrors: [] };
  const reqs = new Map();
  let id = 0;
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('WS error'))); });
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    const p = m.params || {};
    if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning' || p.type === 'assert'))
      out.consoleErrors.push({ level: p.type, text: (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400) });
    else if (m.method === 'Runtime.exceptionThrown')
      out.exceptions.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 600));
    else if (m.method === 'Log.entryAdded' && p.entry?.level === 'error')
      out.consoleErrors.push({ level: 'log-error', text: (p.entry.text || '').slice(0, 400), url: p.entry.url });
    else if (m.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { method: p.request.method, url: p.request.url });
    else if (m.method === 'Network.responseReceived' && p.response.status >= 400)
      out.httpErrors.push({ status: p.response.status, ...(reqs.get(p.requestId) || { url: p.response.url }) });
    else if (m.method === 'Network.loadingFailed' && !p.canceled)
      out.failedRequests.push({ error: p.errorText, ...(reqs.get(p.requestId) || {}) });
  });
  send('Runtime.enable'); send('Log.enable'); send('Network.enable');
  await new Promise((r) => setTimeout(r, seconds * 1000));
  ws.close();
  out.total = out.consoleErrors.length + out.exceptions.length + out.failedRequests.length + out.httpErrors.length;
  return out;
}

// ---- main ----
try {
  if (cmd === 'targets') {
    const ts = await listTargets();
    console.log(JSON.stringify(ts.map((t) => ({ url: t.url, id: t.id })), null, 2));
  } else if (cmd === 'scan') {
    const t = pickTarget(await listTargets(), rest[0]);
    console.log(JSON.stringify(await evaluate(t, SCAN_EXPR), null, 2));
  } else if (cmd === 'text') {
    const t = pickTarget(await listTargets(), rest[0]);
    console.log(await evaluate(t, `(document.body.innerText || '').replace(/\\n{2,}/g,'\\n').slice(0, 4000)`));
  } else if (cmd === 'shot') {
    const out = rest[0] || die('shot needs <outPath>');
    const t = pickTarget(await listTargets(), rest[1]);
    const data = await withSocket(t, async (send) => { await send('Page.enable', {}); return (await send('Page.captureScreenshot', { format: 'png' })).data; });
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log('SAVED ' + out);
  } else if (cmd === 'eval') {
    const file = rest[0] || die('eval needs <jsFile>');
    const t = pickTarget(await listTargets(), rest[1]);
    console.log(JSON.stringify(await evaluate(t, readFileSync(file, 'utf8')), null, 2));
  } else if (cmd === 'click') {
    const text = rest[0] || die('click needs "<text>"');
    const t = pickTarget(await listTargets(), rest[1]);
    console.log(JSON.stringify(await evaluate(t, clickExpr(text)), null, 2));
  } else if (cmd === 'nav-home') {
    const t = pickTarget(await listTargets(), rest[0]);
    console.log(JSON.stringify(await evaluate(t, NAV_HOME_EXPR), null, 2));
  } else if (cmd === 'type') {
    const [field, value, sub] = rest;
    if (!field || value === undefined) die('type needs "<field>" "<value>"');
    const t = pickTarget(await listTargets(), sub);
    console.log(JSON.stringify(await evaluate(t, typeExpr(field, value)), null, 2));
  } else if (cmd === 'watch') {
    const secs = Number(rest[0] || 20);
    const t = pickTarget(await listTargets(), rest[1]);
    console.log(JSON.stringify(await watch(t, secs), null, 2));
  } else {
    console.log('Usage: node cdp.mjs <targets|scan|text|shot|eval|click|nav-home|type|watch> [args]');
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  die(e.message);
}
