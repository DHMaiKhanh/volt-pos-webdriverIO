/**
 * `npm run app:launch` — starts the ATTACH lane.
 *
 * Launches the installed app with WebView2 remote debugging enabled, then
 * starts `msedgedriver` beside it. `npm run test:attach` then connects to that
 * driver with `ms:edgeOptions.debuggerAddress`, driving the app in place
 * instead of letting tauri-driver start its own copy.
 *
 * ## Why WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS is the injection point
 *
 * The app under test is a SHIPPED binary. Its WebView2 environment is created
 * by Tauri's own Rust startup path, and nothing in the packaged app exposes a
 * hook to pass browser flags — `tauri.conf.json` has no field for them, the
 * WebDriver capability set has no field for the application's environment, and
 * the Rust that would call `CreateCoreWebView2EnvironmentWithOptions` with
 * `AdditionalBrowserArguments` was compiled months ago.
 *
 * What IS still available is the loader itself: `WebView2Loader` reads
 * `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` from the process environment when the
 * environment is created and appends its value to the browser command line.
 * That makes it the only supported way to turn on `--remote-debugging-port` for
 * a build you cannot recompile — and it is why this must be set on the process
 * BEFORE it starts, which is exactly what `launchDetached()` does.
 *
 * Cost of the lane, stated plainly: the app's state is whatever it was, not a
 * clean boot. Use it for smoke checks and for reproducing a reported defect.
 */

import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Timeouts } from '../configs/constants/timeouts.js';
import { loadEnv } from '../configs/env/loadEnv.js';
import { appEnvPassthrough, resolveMsEdgeDriver } from '../src/support/services/TauriDriverService.js';
import { killStaleProcesses, launchDetached } from '../src/support/process.js';
import { isPortOpen, waitForPortFree } from '../src/support/net.js';

const line = (text = ''): void => console.log(text);

function banner(title: string): void {
  line();
  line('='.repeat(78));
  line(` ${title}`);
  line('='.repeat(78));
}

/**
 * Wait for a port with visible progress.
 *
 * A silent 90-second wait is indistinguishable from a hang, and this lane is
 * run by hand, so the operator gets a ticking line instead of nothing.
 */
async function waitWithProgress(
  label: string,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now();
  const deadline = started + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (process.stdout.isTTY) process.stdout.write('\r'.padEnd(70) + '\r');
      line(`  [ OK ]  ${label} answering on ${host}:${String(port)} after ${seconds}s`);
      return true;
    }
    if (process.stdout.isTTY) {
      const waited = Math.floor((Date.now() - started) / 1000);
      process.stdout.write(
        `\r  [ .. ]  waiting for ${label} on ${host}:${String(port)}  ${String(waited)}s   `,
      );
    }
    await delay(250);
  }

  if (process.stdout.isTTY) process.stdout.write('\r'.padEnd(70) + '\r');
  line(`  [FAIL]  ${label} never opened ${host}:${String(port)} within ${String(timeoutMs / 1000)}s`);
  return false;
}

async function main(): Promise<number> {
  const env = loadEnv();

  banner(`ATTACH LANE — launching the app with WebView2 remote debugging (ENV=${env.ENV})`);
  line(` Binary            ${env.APP_PATH || '(UNRESOLVED)'}`);
  line(` Upstream API      ${env.UPSTREAM_BASE_URI}`);
  line(` CDP port          ${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}`);
  line(` Driver port       ${env.DRIVER_HOST}:${String(env.DRIVER_PORT)}`);
  line('='.repeat(78));
  line();

  if (!env.APP_PATH || !fs.existsSync(env.APP_PATH)) {
    line('  [FAIL]  No app binary resolved.');
    line();
    line('  Set APP_PATH in configs/env/.env.<ENV>, or install the app to');
    line('  %LOCALAPPDATA%\\volt-pos\\volt-pos-app.exe, then run: npm run preflight');
    line();
    return 1;
  }

  const msEdgeDriver = resolveMsEdgeDriver(env.MSEDGEDRIVER_PATH);
  if (!msEdgeDriver) {
    line('  [FAIL]  msedgedriver was not found.');
    line();
    line('  Fix: npm run setup:drivers');
    line();
    return 1;
  }

  // A surviving window swallows the new launch outright:
  // `tauri-plugin-single-instance` forwards the arguments to the RUNNING
  // instance and exits the new process, so the CDP flag would never take
  // effect and the driver would attach to nothing.
  const killed = killStaleProcesses({ app: true, drivers: true });
  if (killed.length) {
    line(`  [INFO]  Killed stale processes: ${killed.join(', ')}`);
    line('          (single-instance would otherwise hand this launch to the old window)');
  } else {
    line('  [INFO]  No stale app or driver processes to clear.');
  }

  await waitForPortFree(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.SHORT).catch(() => {
    line(`  [WARN]  Port ${String(env.DRIVER_PORT)} is still held; msedgedriver may fail to bind.`);
  });
  await waitForPortFree(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT, Timeouts.SHORT).catch(() => {
    line(`  [WARN]  Port ${String(env.REMOTE_DEBUG_PORT)} is still held by a previous WebView2 host.`);
  });

  line();
  const browserArgs = `--remote-debugging-port=${String(env.REMOTE_DEBUG_PORT)}`;
  line(`  [INFO]  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=${browserArgs}`);
  const appPid = launchDetached(env.APP_PATH, env.APP_ARGS, {
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: browserArgs,
    ...appEnvPassthrough(),
  });
  line(`  [ OK ]  Launched ${env.APP_PATH} (pid ${String(appPid)})`);
  line();

  // The splash screen runs migrations, opens three SQLCipher databases and does
  // a sync handshake before the webview settles, so the CDP socket can take the
  // full boot budget to appear on a cold start.
  const cdpUp = await waitWithProgress(
    'WebView2 CDP',
    env.DRIVER_HOST,
    env.REMOTE_DEBUG_PORT,
    Timeouts.APP_BOOT,
  );
  if (!cdpUp) {
    line();
    line('  The app started but never exposed a CDP endpoint. The usual causes:');
    line('    - another volt-pos instance survived the kill and swallowed this launch');
    line('    - the WebView2 Runtime is missing, so no browser process was ever created');
    line(
      `    - something else already owns port ${String(env.REMOTE_DEBUG_PORT)} (change REMOTE_DEBUG_PORT)`,
    );
    line();
    return 1;
  }

  const driverPid = launchDetached(msEdgeDriver, [`--port=${String(env.DRIVER_PORT)}`], {});
  line(`  [ OK ]  Started ${msEdgeDriver} (pid ${String(driverPid)})`);

  const driverUp = await waitWithProgress(
    'msedgedriver',
    env.DRIVER_HOST,
    env.DRIVER_PORT,
    Timeouts.DRIVER_READY,
  );
  if (!driverUp) {
    line();
    line('  msedgedriver never bound its port. A driver whose version does not match the');
    line('  WebView2 Runtime is the usual cause, and it fails quietly like this.');
    line('  Fix: npm run setup:drivers -- --force');
    line();
    return 1;
  }

  banner('READY');
  line(' The app is running and attachable. State is whatever the app already had —');
  line(' this lane is for smoke checks and defect reproduction, not the regression suite.');
  line();
  line('   npm run test:attach                    run the attach lane');
  line('   npm run preflight                      re-verify the attach preconditions');
  line('   npm run app:kill                       stop the app and the driver');
  line();
  line(` CDP endpoint:    http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}/json/version`);
  line(` WebDriver:       http://${env.DRIVER_HOST}:${String(env.DRIVER_PORT)}`);
  line();
  return 0;
}

process.exitCode = await main();
