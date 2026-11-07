/**
 * "Chạy tất cả" gate for the GUI runner: before a full run, every store under
 * test must have its three web surfaces OPEN and SIGNED IN, and its card
 * terminal CONNECTED — cross-surface specs (web → POS, Portal ↔ POS, card
 * charges) need all of them in the same run.
 *
 *   GoCheckin   pos.gocheckin.net   typed login (merchantId / username / password)
 *   GAP Checkin gap.gocheckin.net   typed owner login (same account)
 *   Portal      Fastboy Portal      GCI Business QR / Google only → the person signs
 *                                   in once; the session lives in the Edge profile
 *   Terminal    header Devices popover of that store's Volt POS app ("Terminal · Connected")
 *
 * Accounts: configs/web-accounts.json (per environment → per store). Each site
 * runs in its own Edge window on its own profile (sessions survive between runs)
 * with DevTools on the site's `cdpPort`, so this module reads the page URL / text
 * and types the login over CDP — no WebDriver, no msedgedriver.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SITES = /** @type {const} */ (['gocheckin', 'gap', 'portal']);
const SITE_LABEL = { gocheckin: 'GoCheckin', gap: 'GAP Checkin', portal: 'Portal' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── CDP plumbing ───────────────────────────────────────────────────────── */

async function targets(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1_500) });
    return await res.json();
  } catch {
    return null;
  }
}

/** Evaluate `expr` (awaiting a promise) in a page target; resolves its value. */
function evaluate(wsUrl, expr, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('CDP timeout'));
    }, timeoutMs);
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`CDP: cannot open ${wsUrl}`));
    };
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: expr, awaitPromise: true, returnByValue: true },
        }),
      );
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (m.result?.exceptionDetails) reject(new Error(m.result.exceptionDetails.text || 'evaluate failed'));
      else resolve(m.result?.result?.value);
    };
  });
}

function edgeExe() {
  const c = [
    process.env.EDGE_PATH,
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
  return c.find((p) => existsSync(p)) ?? null;
}

/* ── In-page scripts (run in the web page over CDP) ─────────────────────── */

/** Helpers injected before every login script: React-safe typing + finders. */
const PAGE_HELPERS = `
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const setVal = (el, v) => {
    el.focus();
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const labelOf = (el) => {
    const id = el.getAttribute('id');
    const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    return norm([el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'),
      lab && lab.textContent, el.closest('label') && el.closest('label').textContent].join(' | '));
  };
  const input = (re) => Array.from(document.querySelectorAll('input')).find((el) => visible(el) && re.test(labelOf(el)));
  const button = (re) => Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => visible(b) && re.test(norm(b.textContent)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await wait(250); } return null; };
`;

/**
 * One CDP connection to a page: evaluate + REAL mouse clicks. GAP (Vue) ignores
 * a scripted `el.click()` on its OWNER / Login buttons, so buttons are clicked
 * with Input.dispatchMouseEvent at their centre.
 */
async function pageSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`CDP: cannot open ${wsUrl}`));
  });
  const send = (method, params = {}, timeoutMs = 20_000) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const t = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timeout`));
      }, timeoutMs);
      pending.set(id, (m) => {
        clearTimeout(t);
        resolve(m);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expr, timeoutMs) => {
    const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, timeoutMs);
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.text || 'evaluate failed');
    return m.result?.result?.value;
  };
  /** Mouse-click the first visible button whose text matches `reSrc` (waits up to `ms`). */
  const clickButton = async (reSrc, ms = 8_000) => {
    const rect = await ev(
      `(async () => { ${PAGE_HELPERS}
        const b = await until(() => button(new RegExp(${JSON.stringify(reSrc)})), ${ms});
        if (!b) return null; b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
      ms + 5_000,
    );
    if (!rect) return false;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    return true;
  };
  return { ev, clickButton, close: () => ws.close() };
}

/** GoCheckin web: ID → Log In → Username + Password → Log In. */
async function loginGoCheckin(s, acc) {
  if (!(await s.ev('location.pathname.includes("/login")'))) return 'already';
  const idOnly = await s.ev(`(async () => { ${PAGE_HELPERS}
    const id = await until(() => input(/(^|[^a-z])id([^a-z]|$)|merchant/) || input(/user/), 10000);
    if (!id || input(/user/)) return false;
    setVal(id, ${JSON.stringify(acc.merchantId)}); return true; })()`);
  if (idOnly) await s.clickButton('^log ?in$');
  const filled = await s.ev(`(async () => { ${PAGE_HELPERS}
    const user = await until(() => input(/user/), 15000); if (!user) return 'no username field';
    setVal(user, ${JSON.stringify(acc.username)});
    const pass = await until(() => input(/pass/), 5000); if (!pass) return 'no password field';
    setVal(pass, ${JSON.stringify(acc.password)}); return 'ok'; })()`, 25_000);
  if (filled !== 'ok') return filled;
  if (!(await s.clickButton('^log ?in$'))) return 'no Log In button';
  return 'clicked'; // the page navigates away; the caller polls the result from outside
}

/** GAP Checkin: OWNER → ID / user / password → Login; done when "Mini Apps" shows. */
async function loginGap(s, acc) {
  const DONE = `/mini apps/i.test(document.body.innerText)`;
  if (await s.ev(DONE)) return 'already';
  const hasForm = await s.ev(`!!Array.from(document.querySelectorAll('input')).find((i) => /enter your id/i.test(i.placeholder))`);
  if (!hasForm) await s.clickButton('^owner$');
  const filled = await s.ev(`(async () => { ${PAGE_HELPERS}
    const id = await until(() => input(/enter your id/), 15000); if (!id) return 'no ID field';
    setVal(id, ${JSON.stringify(acc.merchantId)});
    setVal(input(/enter your user/), ${JSON.stringify(acc.username)});
    setVal(input(/enter your password/), ${JSON.stringify(acc.password)}); return 'ok'; })()`, 25_000);
  if (filled !== 'ok') return filled;
  if (!(await s.clickButton('^login$'))) return 'no Login button';
  return 'clicked'; // the page re-renders / navigates; the caller polls the result from outside
}

/** Volt POS: open the header Devices popover, read each device row, close it. */
const READ_DEVICES = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pop = () => document.querySelector('[data-radix-popper-content-wrapper]');
  if (!pop()) {
    const btn = document.evaluate('(//header/div[last()]//button)[1]', document, null, 9, null).singleNodeValue
      || document.querySelector('[data-testid="header-devices"]');
    if (!btn) return { error: 'no Devices button in the header (app not on a till screen?)' };
    btn.click();
  }
  let p = null;
  for (let i = 0; i < 20 && !(p = pop()); i++) await wait(150);
  if (!p) return { error: 'Devices popover never opened' };
  await wait(600);
  const rows = Array.from(p.querySelectorAll('[data-testid="device-row"]')).map((r) => {
    const t = r.querySelector('p[title]');
    return { name: ((t && t.textContent) || r.textContent || '').trim(), status: (t && t.getAttribute('title')) || '' };
  });
  const text = (p.innerText || '').replace(/\\s+/g, ' ').trim();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { rows, text };
})()`;

/* ── The module ─────────────────────────────────────────────────────────── */

export function createPreflight({ repoRoot, apps, warm, logCrash }) {
  const ACCOUNTS_FILE = path.join(repoRoot, 'configs', 'web-accounts.json');
  /** env → store → { sites: {site: {...}}, terminal: {...}, checkedAt } */
  const cache = {};
  let busy = null;

  function accounts(env) {
    try {
      const all = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
      return Array.isArray(all[env]) ? all[env] : [];
    } catch (err) {
      logCrash('preflight accounts', err);
      return [];
    }
  }

  /** Same profile layout as scripts/web-open.ts: store 14 on dev keeps its old profiles. */
  function profileDir(env, store, site) {
    const legacy = env === 'dev' && store === '14';
    if (site === 'portal') return path.join(repoRoot, legacy ? '.portal-profile' : `.portal-profile-${env}-${store}`);
    const s = site === 'gocheckin' ? 'pos' : 'gap';
    return legacy
      ? path.join(repoRoot, '.gocheckin-profile', s)
      : path.join(repoRoot, '.gocheckin-profile', `${env}-${store}`, s);
  }

  function startUrl(site, acc) {
    if (site === 'portal') return `${acc.url.replace(/\/+$/, '')}/pos/nail/${acc.merchantId}/setting`;
    return acc.url;
  }

  const pageOf = (list) =>
    (list ?? []).find((t) => t.type === 'page' && /^https?:/.test(t.url) && !t.url.startsWith('chrome'));

  /** Read one site's state without touching it. */
  async function siteState(env, store, site, acc) {
    const label = SITE_LABEL[site];
    if (!acc?.cdpPort) return { state: 'nocreds', detail: `${label}: thiếu cấu hình trong web-accounts.json` };
    if (site !== 'portal' && (!acc.merchantId || !acc.username || !acc.password))
      return { state: 'nocreds', detail: `${label}: chưa có ID/username/password trong configs/web-accounts.json` };
    const page = pageOf(await targets(acc.cdpPort));
    if (!page) return { state: 'closed', detail: `${label}: chưa mở` };
    let signed;
    try {
      if (site === 'gap')
        signed = await evaluate(
          page.webSocketDebuggerUrl,
          `document.body && /mini apps/i.test(document.body.innerText)`,
          5_000,
        );
      else if (site === 'gocheckin') signed = /gocheckin\.net/.test(page.url) && !page.url.includes('/login');
      else {
        // The Portal SPA keeps its URL while it decides; read the page instead
        // (textContent: innerText is '' while the window is hidden).
        const onPortal = page.url.startsWith(acc.url.replace(/\/+$/, '')) && !page.url.includes('/login');
        const seen = onPortal
          ? await evaluate(
              page.webSocketDebuggerUrl,
              `(() => { const t = document.body ? document.body.textContent : '';
                 if (/Continue with GCI Business|Secure access for your business/i.test(t)) return 'login';
                 if (/Store Settings|Staff Members|Overview/.test(t)) return 'ok';
                 return 'loading'; })()`,
              5_000,
            )
          : 'login';
        signed = seen === 'ok';
      }
    } catch {
      signed = false;
    }
    return signed
      ? { state: 'ok', detail: `${label}: đã đăng nhập`, url: page.url }
      : {
          state: 'login',
          detail:
            site === 'portal'
              ? `${label}: chưa đăng nhập — quét QR GCI Business trong cửa sổ Edge (phiên được lưu cho lần sau)`
              : `${label}: đang ở trang đăng nhập`,
          url: page.url,
        };
  }

  /** Open the site's Edge window (own profile + DevTools port) if it is not up. */
  async function openSite(env, store, site, acc) {
    if (pageOf(await targets(acc.cdpPort))) return true;
    const exe = edgeExe();
    if (!exe) throw new Error('Không tìm thấy msedge.exe (đặt EDGE_PATH).');
    spawn(
      exe,
      [
        `--user-data-dir=${profileDir(env, store, site)}`,
        `--remote-debugging-port=${acc.cdpPort}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--disable-features=msImplicitSignin,msEdgeSyncConsent',
        '--new-window',
        '--window-size=1280,860',
        startUrl(site, acc),
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
    const end = Date.now() + 20_000;
    while (Date.now() < end) {
      if (pageOf(await targets(acc.cdpPort))) return true;
      await sleep(500);
    }
    return false;
  }

  async function signIn(site, acc) {
    const page = pageOf(await targets(acc.cdpPort));
    if (!page) return 'window gone';
    // Land on the login / home URL first (a stale tab may sit elsewhere).
    if (site === 'gocheckin' && !/gocheckin\.net/.test(page.url))
      await evaluate(page.webSocketDebuggerUrl, `location.href = ${JSON.stringify(acc.url)}; 1`, 5_000);
    if (site === 'gap' && !/gap\.gocheckin\.net/.test(page.url))
      await evaluate(page.webSocketDebuggerUrl, `location.href = ${JSON.stringify(acc.url)}; 1`, 5_000);
    await sleep(3_000);
    const fresh = pageOf(await targets(acc.cdpPort));
    if (!fresh) return 'window gone';
    let session = null;
    try {
      session = await pageSession(fresh.webSocketDebuggerUrl);
      return site === 'gocheckin' ? await loginGoCheckin(session, acc) : await loginGap(session, acc);
    } catch (err) {
      return String(err.message || err);
    } finally {
      session?.close();
    }
  }

  /* ── Terminal ─────────────────────────────────────────────────────────── */

  async function appPage(port) {
    return (await targets(port))?.find((t) => {
      if (t.type !== 'page') return false;
      try {
        const u = new URL(t.url);
        return u.hostname === 'tauri.localhost' && !u.pathname.startsWith('/customer') && !u.pathname.startsWith('/splash');
      } catch {
        return false;
      }
    });
  }

  /** Terminal state of one store: read on the first running app of that store. */
  async function terminalState(env, store, { wake = false } = {}) {
    const slots = apps.slotsFor(env).filter((s) => s.store === store);
    if (slots.length === 0) return { state: 'unknown', detail: 'Terminal: tiệm không nằm trong lựa chọn App' };
    let page = null;
    let slot = null;
    for (const s of slots) {
      const p = await appPage(Number(apps.instanceEnv(s.n).REMOTE_DEBUG_PORT));
      if (p) {
        page = p;
        slot = s;
        break;
      }
    }
    // The installed app (instance 0) can be booted by the pre-warm.
    if (!page && wake && slots.some((s) => s.n === 0) && warm) {
      warm.setEnabled?.(true);
      warm.request?.('kiểm tra terminal');
      const end = Date.now() + 150_000;
      while (Date.now() < end && !page) {
        await sleep(2_000);
        page = await appPage(9222);
      }
      slot = slots.find((s) => s.n === 0);
    }
    if (!page)
      return {
        state: 'unknown',
        detail: slots.some((s) => s.n === 0)
          ? `Terminal: app tiệm ${store} chưa mở — bật "Mở sẵn app" rồi Kiểm tra lại`
          : `Terminal: app tiệm ${store} (App ${slots.map((s) => s.slot).join(', ')}, bản sao) chưa chạy nên chưa đọc được terminal — mở app tiệm ${store} rồi Kiểm tra lại, hoặc bỏ tiệm này khỏi thanh App`,
      };
    try {
      // The app may still be rendering (just booted / reloaded): retry a few times.
      let r = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const live = (await appPage(Number(apps.instanceEnv(slot?.n ?? 0).REMOTE_DEBUG_PORT))) ?? page;
        r = await evaluate(live.webSocketDebuggerUrl, READ_DEVICES, 15_000).catch((e) => ({ error: String(e.message || e) }));
        if (!r?.error) break;
        await sleep(3_000);
      }
      if (r?.error) return { state: 'unknown', detail: `Terminal: ${r.error}` };
      const term = (r.rows ?? []).filter((x) => /terminal|dot|bamboo|reader/i.test(x.name));
      const ok =
        term.some((x) => /^connected$/i.test(x.status)) || /Terminal\s*\|?\s*Connected/i.test(r.text ?? '');
      const desc = term.length
        ? term.map((x) => `${x.name}: ${x.status || '?'}`).join(', ')
        : (r.text ?? '').slice(0, 120);
      return {
        state: ok ? 'ok' : 'down',
        detail: ok ? `Terminal: đã kết nối (${desc})` : `Terminal: CHƯA kết nối (${desc || 'không thấy thiết bị'})`,
        app: slot?.slot,
      };
    } catch (err) {
      return { state: 'unknown', detail: `Terminal: không đọc được (${String(err.message || err)})` };
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Stores the next run tests: the stores picked in the App bar for this env. */
  const runStores = (env, override) => [...new Set(apps.slotsFor(env, override).map((s) => s.store))];

  async function check(env, { open = false, stores } = {}) {
    const ids = stores ?? runStores(env);
    const accs = accounts(env);
    const out = [];
    for (const id of ids) {
      const acc = accs.find((s) => s.id === id);
      const sites = {};
      for (const site of SITES) {
        const a = acc?.[site];
        let st = await siteState(env, id, site, a);
        if (open && st.state !== 'ok' && st.state !== 'nocreds') {
          try {
            if (st.state === 'closed' && !(await openSite(env, id, site, a))) {
              st = {
                state: 'closed',
                detail: `${SITE_LABEL[site]}: Edge không mở được DevTools :${a.cdpPort} — profile này có đang mở ở cửa sổ Edge khác không? Đóng nó rồi thử lại.`,
              };
            } else {
              if (site !== 'portal') {
                const r = await signIn(site, a);
                if (r !== 'clicked' && r !== 'already') logCrash(`preflight ${site} ${id}`, new Error(String(r)));
              } else await sleep(3_000);
              st = await siteState(env, id, site, a);
              // After Login the page navigates: give it up to 25 s to land signed in.
              for (let t = 0; t < 25 && st.state === 'login' && site !== 'portal'; t++) {
                await sleep(1_000);
                st = await siteState(env, id, site, a);
              }
            }
          } catch (err) {
            st = { state: 'closed', detail: `${SITE_LABEL[site]}: ${String(err.message || err)}` };
          }
        }
        sites[site] = st;
      }
      const terminal = await terminalState(env, id, { wake: open });
      out.push({ store: id, name: acc?.name || '', sites, terminal });
    }
    const problems = out.flatMap((s) =>
      [...SITES.map((k) => s.sites[k]), s.terminal]
        .filter((x) => x.state !== 'ok')
        .map((x) => `Tiệm ${s.store}: ${x.detail}`),
    );
    const result = { env, stores: out, ok: problems.length === 0, problems, checkedAt: new Date().toISOString() };
    cache[env] = result;
    return result;
  }

  /** Last result (instant) — the GUI polls this. */
  const status = (env) => ({ ...(cache[env] ?? { env, stores: [], ok: false, problems: [], checkedAt: null }), busy: !!busy });

  /** One check at a time; concurrent callers share it. */
  function run(env, opts) {
    if (busy) return busy;
    busy = check(env, opts).finally(() => {
      busy = null;
    });
    return busy;
  }

  return { status, check: run, runStores };
}
