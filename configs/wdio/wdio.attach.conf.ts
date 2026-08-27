import { loadEnv } from '../env/loadEnv.js';
import { shared } from './wdio.shared.conf.js';

const env = loadEnv();

/**
 * ATTACH lane — drive an app that is ALREADY RUNNING.
 *
 * ## What this is for
 *
 * tauri-driver always launches its own copy of the binary. That is the right
 * default, but it means you can never point the suite at the app a person is
 * already using — an installed production till, a build reproducing a bug, a
 * session someone logged into by hand.
 *
 * WebView2 solves this: given `--remote-debugging-port`, the app exposes a
 * CDP endpoint, and `msedgedriver` can attach to it through
 * `ms:edgeOptions.debuggerAddress` instead of starting a browser. tauri-driver
 * is not involved at all in this mode.
 *
 * ## How to use it
 *
 *   1. npm run app:launch      # starts the installed app with CDP enabled
 *   2. npm run test:attach
 *
 * ## The trade-off, stated plainly
 *
 * The app's state is whatever the operator left behind — not a clean boot. So
 * this lane is for smoke checks and for reproducing a reported defect, never
 * for the regression suite, whose specs assume they start from a known screen.
 *
 * `msedgedriver` must be running and listening on DRIVER_PORT; `npm run
 * app:launch` starts it alongside the app.
 */
export const config: WebdriverIO.Config = {
  ...shared,
  capabilities: [
    {
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': {
        // Attach instead of launch. The port must match what app:launch used.
        debuggerAddress: `127.0.0.1:${String(env.REMOTE_DEBUG_PORT)}`,
      },
    },
  ],
  specFileRetries: 0,
};
