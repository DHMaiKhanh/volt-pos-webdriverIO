import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

/** Is something listening on this TCP port right now? */
export function isPortOpen(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (open: boolean): void => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Wait for a driver to start answering.
 *
 * A TCP connect is enough — both tauri-driver and msedgedriver bind their port
 * before they are ready to serve, but the gap is milliseconds, whereas an HTTP
 * `/status` probe adds a dependency on each driver's own status contract, which
 * differs between them.
 */
export async function waitForPortOpen(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return;
    await delay(150);
  }
  throw new Error(
    `Nothing started listening on ${host}:${port} within ${timeoutMs}ms. ` +
      `Check the driver's stderr above — a version mismatch between msedgedriver and the ` +
      `WebView2 Runtime is the usual cause, and it manifests as a silent hang rather than an error.`,
  );
}

/**
 * Wait for a port to be released.
 *
 * Needed between spec files: the driver is restarted per session on a fixed
 * port, and Windows holds the socket briefly in TIME_WAIT after the previous
 * process exits. Without this, spec file #2 dies on EADDRINUSE.
 */
export async function waitForPortFree(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(host, port))) return;
    await delay(200);
  }
  throw new Error(
    `Port ${host}:${port} is still in use after ${timeoutMs}ms. ` +
      `Another run is probably still going — check for stray tauri-driver / msedgedriver processes.`,
  );
}
