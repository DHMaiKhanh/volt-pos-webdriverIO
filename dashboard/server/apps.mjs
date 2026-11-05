/**
 * Which Volt POS apps a GUI run drives: environment → stores → 1, 2 or 3 apps
 * side by side (docs/parallel-instances.md).
 *
 * ## Model
 *
 * Every app the GUI runs is an INSTANCE with a number `n`. The number fixes the
 * copy's folder (D:\VoltE2E\i<n>), its Tauri identifier (VoltP<nn>, so its own
 * device sign-in and databases), its process image names and its ports
 * (instanceEnv). Each store owns a fixed list of instance numbers, so a copy is
 * signed in to ONE store once and stays that way: picking another store for
 * "App 2" in the GUI just selects another copy, nothing re-signs.
 *
 *   Staging (ENV=dev — dev and staging are the same thing for this team)
 *     store 14      → 0 (the installed app), 1, 2
 *     store 100004  → 21, 22, 23
 *   Production (ENV=prod)
 *     store 2949    → 31, 32, 33
 *     store 20258   → 34, 35, 36
 *
 * Staging and Production are different .exe BUILDS (the backend URL is
 * compiled in). Copies are made from a source build (APP_SOURCE in
 * configs/env/.env.prod for prod, else the installed app), and only from a
 * build whose baked-in backend matches the environment, so a copy is never
 * quietly made from the wrong build.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** At most this many apps side by side: each app + its worker ≈ 1.3 GB. */
export const MAX_APPS = 3;

/**
 * Environments the GUI offers (key = the ENV a run gets), the stores each one
 * tests against, and the instance numbers each store owns (see the header).
 */
export const PROFILES = {
  dev: {
    label: 'Staging',
    stores: [
      { id: '14', name: 'Fastboy Nails', instances: [0, 1, 2] },
      { id: '100004', instances: [21, 22, 23] },
    ],
  },
  prod: {
    label: 'Production',
    readOnly: true,
    stores: [
      { id: '2949', name: 'Bee Bee Spa', instances: [31, 32, 33] },
      { id: '20258', instances: [34, 35, 36] },
    ],
  },
};

/** Old saved choices / schedules said `staging`: it is the same environment as dev. */
export const normEnv = (env) => (env === 'staging' ? 'dev' : PROFILES[env] ? env : 'dev');

/**
 * Host baked into each build (configs/env/loadEnv.ts ENV_DEFAULTS) → which
 * environment a .exe is. A build pointed at the staging host counts as dev too.
 */
const BUILD_MARKERS = [
  ['dev', 'v2.dev-fastboypay.com'],
  ['dev', 'stage.volt-pos.fastboy.dev'],
  ['prod', 'volt-pos.v2.fastboypay.com'],
];

/** A parked copy must keep rendering while out of sight. */
const ANTI_THROTTLE =
  '--disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows ' +
  '--disable-renderer-backgrounding --disable-background-timer-throttling';

/** Environment and store an instance number belongs to; null if no store owns it. */
export function ownerOf(n) {
  for (const [env, p] of Object.entries(PROFILES))
    for (const store of p.stores) if (store.instances.includes(n)) return { env, store: store.id };
  return null;
}

export function createApps({ repoRoot, tmp, envFileValue, logCrash }) {
  /** Where `scripts/make-instance.mjs` puts the copies: <root>\i<N>\volt-pos-i<N>.exe. */
  const INSTANCE_ROOT = process.env.VOLT_INSTANCE_ROOT || 'D:\\VoltE2E';
  /** The installed app (the GUI runs outside the Claude package, so this is the real one). */
  const INSTALLED_APP = path.join(process.env.LOCALAPPDATA ?? '', 'Volt POS', 'volt-pos.exe');
  const CONFIG_FILE = path.join(tmp, 'gui-apps.json');
  /** `GUI_LANES=1` still caps the dev lanes, as before. */
  const DEV_MAX = Math.min(MAX_APPS, Math.max(1, Number(process.env.GUI_LANES ?? MAX_APPS) || 1));

  /* ── Instance → paths, ports, images ──────────────────────────────────── */

  /** Everything instance N's processes need to stay out of the others' way (src/support/process.ts). */
  function instanceEnv(n) {
    const dir = path.join(INSTANCE_ROOT, `i${n}`);
    return {
      VOLT_INSTANCE: String(n),
      APP_PATH: path.join(dir, `volt-pos-i${n}.exe`),
      APP_IDENTIFIER: `VoltP${String(n).padStart(2, '0')}`,
      APP_IMAGES: `volt-pos-i${n}.exe`,
      DRIVER_IMAGES: `tauri-driver-i${n}.exe,msedgedriver-i${n}.exe`,
      MSEDGEDRIVER_PATH: path.join(dir, `msedgedriver-i${n}.exe`),
      TAURI_DRIVER_PATH: path.join(dir, `tauri-driver-i${n}.exe`),
      REMOTE_DEBUG_PORT: String(9222 + 10 * n),
      DRIVER_PORT: String(4444 + 10 * n),
      TAURI_NATIVE_PORT: String(4445 + 10 * n),
      APP_BROWSER_ARGS: ANTI_THROTTLE,
      APP_WINDOW_SEED: path.join(dir, 'window-offscreen.json'),
    };
  }

  const identifierOf = (n) => (n === 0 ? 'VoltPOS' : instanceEnv(n).APP_IDENTIFIER);
  const signedIn = (n) => existsSync(path.join(process.env.APPDATA ?? '', identifierOf(n), 'credentials'));
  const copyExists = (n) => {
    const e = instanceEnv(n);
    return existsSync(e.APP_PATH) && existsSync(e.MSEDGEDRIVER_PATH);
  };
  const stampOf = (n) => {
    try {
      return JSON.parse(readFileSync(path.join(INSTANCE_ROOT, `i${n}`, 'source.json'), 'utf8'));
    } catch {
      return null;
    }
  };

  /* ── Which env a build is ─────────────────────────────────────────────── */

  const buildCache = new Map();
  /** 'dev' | 'prod' | 'unknown' | null (no file), cached per path + size + mtime. */
  function buildEnvOf(exe) {
    if (!exe || !existsSync(exe)) return null;
    const st = statSync(exe);
    const key = `${exe}|${st.size}|${st.mtimeMs}`;
    if (buildCache.has(key)) return buildCache.get(key);
    let found = 'unknown';
    try {
      const buf = readFileSync(exe);
      let best = 0;
      for (const [env, host] of BUILD_MARKERS) {
        let hits = 0;
        for (let i = buf.indexOf(host); i !== -1 && hits < 50; i = buf.indexOf(host, i + 1)) hits += 1;
        if (hits > best) {
          best = hits;
          found = env;
        }
      }
    } catch (err) {
      logCrash('buildEnvOf', err);
    }
    buildCache.set(key, found);
    return found;
  }

  /** The build copies of `env` are made from: APP_SOURCE in .env.<env>, else the installed app. */
  const sourceOf = (env) => envFileValue(env, 'APP_SOURCE') || INSTALLED_APP;

  /* ── Saved choice: apps per env, store per app ────────────────────────── */

  const maxFor = (env) => (env === 'dev' ? DEV_MAX : MAX_APPS);
  const defaultStores = (env) =>
    Array.from({ length: MAX_APPS }, (_, i) => PROFILES[env].stores[i % PROFILES[env].stores.length].id);

  function loadConfig() {
    let saved = {};
    try {
      saved = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      /* first run */
    }
    const out = {};
    for (const env of Object.keys(PROFILES)) {
      const s = saved[env] ?? {};
      const ids = PROFILES[env].stores.map((x) => x.id);
      const count = Number.isInteger(s.count)
        ? Math.min(maxFor(env), Math.max(1, s.count))
        : Math.min(2, maxFor(env));
      const stores = defaultStores(env).map((d, i) =>
        ids.includes(String(s.stores?.[i])) ? String(s.stores[i]) : d,
      );
      out[env] = { count, stores };
    }
    return out;
  }

  /** Merge `{ env, count?, stores? }` into the saved choice. */
  function setConfig({ env: asked, count, stores }) {
    const env = normEnv(asked);
    const all = loadConfig();
    if (Number.isInteger(count)) all[env].count = Math.min(maxFor(env), Math.max(1, count));
    if (Array.isArray(stores)) {
      const ids = PROFILES[env].stores.map((x) => x.id);
      all[env].stores = all[env].stores.map((d, i) =>
        ids.includes(String(stores[i])) ? String(stores[i]) : d,
      );
    }
    mkdirSync(tmp, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(all, null, 2));
    return { ok: true };
  }

  /**
   * The apps a run of `env` drives, in order. `override` = `{ count, stores }`
   * from a schedule or the run request; else the saved choice.
   */
  function slotsFor(asked, override = {}) {
    const env = normEnv(asked);
    const profile = PROFILES[env];
    const saved = loadConfig()[env];
    const count = Math.min(maxFor(env), Math.max(1, Number(override.count) || saved.count));
    const ids = profile.stores.map((x) => x.id);
    const storeAt = (i) =>
      ids.includes(String(override.stores?.[i])) ? String(override.stores[i]) : saved.stores[i];
    // The k-th app on a store takes that store's k-th instance number.
    const seen = {};
    return Array.from({ length: count }, (_, i) => {
      const store = storeAt(i);
      seen[store] = (seen[store] ?? 0) + 1;
      const n = profile.stores[ids.indexOf(store)].instances[seen[store] - 1];
      return { slot: i + 1, n, store };
    });
  }

  /* ── Making / refreshing copies ───────────────────────────────────────── */

  const isRunningImage = (image) => {
    const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], { encoding: 'utf8' });
    return (r.stdout ?? '').toLowerCase().includes(image.toLowerCase());
  };

  function makeCopy(n, source) {
    const r = spawnSync(
      process.execPath,
      [path.join(repoRoot, 'scripts', 'make-instance.mjs'), String(n), '--app', source],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    return r.status === 0
      ? { ok: true }
      : { ok: false, error: (r.stderr || r.stdout || '').trim().split(/\r?\n/).pop() || `exit ${r.status}` };
  }

  /**
   * Bring copy N up to date with its env's source build. A copy whose source
   * changed is remade (a copy older than the installed app signs itself out),
   * but only from a build of the right env: installing the prod build must not
   * turn the staging copies into prod ones. Returns what happened, for the log.
   */
  function syncCopy(n) {
    if (n === 0) return 'installed';
    const env = ownerOf(n)?.env ?? 'dev';
    const source = sourceOf(env);
    const srcEnv = buildEnvOf(source);
    const exists = copyExists(n);
    if (exists) {
      const stamp = stampOf(n);
      const st = existsSync(source) ? statSync(source) : null;
      if (!st || (stamp && stamp.size === st.size && stamp.mtimeMs === st.mtimeMs)) return 'same';
      if (srcEnv !== env) return `giữ bản cũ (nguồn đang là bản ${srcEnv ?? 'không có'})`;
      if (isRunningImage(`volt-pos-i${n}.exe`)) return 'busy';
      const r = makeCopy(n, source);
      return r.ok ? 'rebuilt' : `failed: ${r.error}`;
    }
    if (srcEnv !== env) return `chưa có (nguồn là bản ${srcEnv ?? 'không có'}, cần bản ${env})`;
    const r = makeCopy(n, source);
    return r.ok ? 'made' : `failed: ${r.error}`;
  }

  /**
   * Instances a run of `env` can use right now, after refreshing the copies.
   * `{ instances, skipped, builds }` — `skipped` says why an app got no lane.
   */
  function laneInstances(env, override) {
    const instances = [];
    const skipped = [];
    const builds = [];
    for (const s of slotsFor(env, override)) {
      if (s.n === 0) {
        instances.push({ ...s, env: {} });
        continue;
      }
      const sync = syncCopy(s.n);
      builds.push(`i${s.n} ${sync}`);
      if (!copyExists(s.n))
        skipped.push(`App ${s.slot} (i${s.n}, tiệm ${s.store}): chưa tạo bản sao — ${sync}`);
      else if (!signedIn(s.n))
        skipped.push(`App ${s.slot} (i${s.n}, tiệm ${s.store}): chưa đăng nhập — bấm "Mở QR"`);
      else {
        const merchant = { MERCHANT_ID: s.store, STORE_ID: s.store, PORTAL_MERCHANT_ID: s.store };
        instances.push({ ...s, env: { ...instanceEnv(s.n), ...merchant } });
      }
    }
    return { instances, skipped, builds };
  }

  /* ── Status for the GUI ───────────────────────────────────────────────── */

  function status(env) {
    env = normEnv(env);
    const source = sourceOf(env);
    const sourceEnv = buildEnvOf(source);
    const slots = slotsFor(env).map((s) => {
      if (s.n === 0) {
        return {
          ...s,
          kind: 'installed',
          exists: existsSync(INSTALLED_APP),
          signedIn: signedIn(0),
          buildEnv: sourceEnv,
        };
      }
      const stamp = stampOf(s.n);
      return {
        ...s,
        kind: 'copy',
        exists: copyExists(s.n),
        signedIn: signedIn(s.n),
        buildEnv: stamp?.env ?? null,
        madeAt: stamp?.madeAt ?? null,
      };
    });
    const profiles = Object.fromEntries(
      Object.entries(PROFILES).map(([k, p]) => [
        k,
        { label: p.label, stores: p.stores, readOnly: !!p.readOnly, max: maxFor(k) },
      ]),
    );
    return {
      env,
      profiles,
      config: loadConfig(),
      source: { path: source, env: sourceEnv, matches: sourceEnv === env },
      slots,
      root: INSTANCE_ROOT,
    };
  }

  /**
   * Open copy N on screen with its QR login (`launch.cmd visible`), making the
   * copy first if it does not exist yet. From here, NOT from a shell inside the
   * Claude app: that one is an MSIX package whose children get a virtualised
   * AppData, so a sign-in made there would never reach the runs.
   */
  function openForSignIn(n) {
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false, error: 'n phải là 1–99' };
    const owner = ownerOf(n);
    if (!owner) return { ok: false, error: `Không tiệm nào dùng bản sao i${n}` };
    const env = owner.env;
    if (!copyExists(n)) {
      const source = sourceOf(env);
      const srcEnv = buildEnvOf(source);
      if (srcEnv !== env) {
        return {
          ok: false,
          error:
            `Không tạo được bản sao ${env}: nguồn ${source} là bản ${srcEnv ?? '(không có file)'}. ` +
            `Cài bản ${PROFILES[env].label} hoặc đặt APP_SOURCE=<đường dẫn volt-pos.exe bản đó> trong configs/env/.env.${env}.`,
        };
      }
      const r = makeCopy(n, source);
      if (!r.ok) return { ok: false, error: `make-instance ${n}: ${r.error}` };
    }
    const launcher = path.join(INSTANCE_ROOT, `i${n}`, 'launch.cmd');
    if (!existsSync(launcher))
      return { ok: false, error: `Không có ${launcher} — chạy node scripts/make-instance.mjs ${n}` };
    spawn('cmd.exe', ['/c', launcher, 'visible'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return { ok: true };
  }

  return { status, setConfig, slotsFor, laneInstances, openForSignIn, instanceEnv };
}
