import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../../../configs/constants/paths.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';

const env = loadEnv();

/**
 * A second browser for app-lane specs: Microsoft Edge on the QR-signed
 * `.portal-profile/`, driven over the Chrome DevTools Protocol.
 *
 * ## Why not a second WebDriver session
 *
 * An app-lane run owns one WebDriver session (the Volt POS WebView). Cross-surface
 * cases (Portal change → POS sees it, and back) need the Portal open in the SAME
 * run, between two POS steps. Edge is launched as a plain process with
 * `--remote-debugging-port` and spoken to over CDP with Node's built-in
 * WebSocket — no driver, no second wdio session, nothing to install.
 *
 * ## Sign-in
 *
 * Same profile as the web lane (`npm run portal:login`, QR once). {@link isSignedIn}
 * lets a spec skip with a clear reason when the session expired. The profile can be
 * open in ONE Edge at a time: close the portal:login window before running.
 */
export class PortalCdp {
  private ws: WebSocket | null = null;
  private browserWs: string | null = null;
  private seq = 0;
  private readonly pending = new Map<number, (msg: CdpReply) => void>();

  constructor(private readonly port = Number(process.env.PORTAL_CDP_PORT ?? 9333)) {}

  get profileDir(): string {
    return path.join(Paths.ROOT, '.portal-profile');
  }

  /** Launch Edge on the profile (or reuse one already listening on the port) and attach to its page. */
  async start(url = env.PORTAL_URL): Promise<this> {
    if (!(await this.version())) {
      spawn(
        edgeExe(),
        [
          `--user-data-dir=${this.profileDir}`,
          `--remote-debugging-port=${String(this.port)}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--window-size=1400,900',
          url,
        ],
        { detached: true, stdio: 'ignore' },
      ).unref();
      const deadline = Date.now() + 25_000;
      while (!(await this.version())) {
        if (Date.now() > deadline)
          throw new Error(
            `PortalCdp: Edge never opened DevTools on :${String(this.port)}. Is .portal-profile already open in another Edge (portal:login)? Close it and re-run.`,
          );
        await sleep(500);
      }
    }
    this.browserWs = (await this.version())?.webSocketDebuggerUrl ?? null;
    const pages = (await (await fetch(`http://127.0.0.1:${String(this.port)}/json`)).json()) as CdpTarget[];
    const page = pages.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension'));
    if (!page) throw new Error('PortalCdp: no page target in Edge.');
    this.ws = await openSocket(page.webSocketDebuggerUrl, (m) => {
      if (m.id !== undefined) this.pending.get(m.id)?.(m);
      if (m.id !== undefined) this.pending.delete(m.id);
    });
    await this.send('Page.enable');
    return this;
  }

  /** Close the whole Edge instance this helper launched. */
  async stop(): Promise<void> {
    this.ws?.close();
    this.ws = null;
    if (!this.browserWs) return;
    const b = await openSocket(this.browserWs, () => undefined).catch(() => null);
    b?.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(800);
    b?.close();
    this.browserWs = null;
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws) throw new Error('PortalCdp: not started');
    const id = ++this.seq;
    const reply = new Promise<CdpReply>((resolve) => this.pending.set(id, resolve));
    this.ws.send(JSON.stringify({ id, method, params }));
    const r = await reply;
    if (r.error) throw new Error(`PortalCdp ${method}: ${r.error.message}`);
    return r.result as T;
  }

  /** Evaluate `body` (a function body; may `await`) in the page and return its value. */
  async eval<T>(body: string): Promise<T> {
    const r = await this.send<{ result: { value?: T }; exceptionDetails?: { text: string } }>(
      'Runtime.evaluate',
      {
        expression: `(async () => { ${body} })()`,
        awaitPromise: true,
        returnByValue: true,
      },
    );
    if (r.exceptionDetails) throw new Error(`PortalCdp eval: ${r.exceptionDetails.text}`);
    return r.result.value as T;
  }

  async url(): Promise<string> {
    return this.eval<string>('return location.href;');
  }

  async goto(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await this.waitFor('return document.readyState === "complete";', 30_000, `load ${url}`);
  }

  async reload(): Promise<void> {
    await this.send('Page.reload', {});
    await sleep(500);
    await this.waitFor('return document.readyState === "complete";', 30_000, 'reload');
  }

  /** Poll a boolean `body` until true. */
  async waitFor(body: string, timeout = 15_000, what = 'condition'): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.eval<boolean>(body).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`PortalCdp: ${what} not met within ${String(timeout / 1000)}s`);
  }

  /** Real typing into the focused element (React sees input events), replacing its selection. */
  async insertText(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }

  async screenshot(file: string): Promise<void> {
    const r = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }

  /** On the Portal and past /login (the profile's session is alive). */
  async isSignedIn(): Promise<boolean> {
    const u = await this.url();
    return u.startsWith(env.PORTAL_URL) && !u.includes('/login');
  }

  private async version(): Promise<{ webSocketDebuggerUrl: string } | null> {
    try {
      const r = await fetch(`http://127.0.0.1:${String(this.port)}/json/version`, {
        signal: AbortSignal.timeout(1_000),
      });
      return r.ok ? ((await r.json()) as { webSocketDebuggerUrl: string }) : null;
    } catch {
      return null;
    }
  }
}

interface CdpTarget {
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface CdpReply {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function openSocket(url: string, onMessage: (m: CdpReply) => void): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`PortalCdp: cannot open ${url}`));
    ws.onmessage = (e: MessageEvent) => onMessage(JSON.parse(String(e.data)) as CdpReply);
  });
}

function edgeExe(): string {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Microsoft',
      'Edge',
      'Application',
      'msedge.exe',
    ),
    path.join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'Microsoft',
      'Edge',
      'Application',
      'msedge.exe',
    ),
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found)
    throw new Error(`PortalCdp: msedge.exe not found (set EDGE_PATH). Tried: ${candidates.join(', ')}`);
  return found;
}
