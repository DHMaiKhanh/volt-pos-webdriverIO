import path from 'node:path';
import { Paths } from '../constants/paths.js';
import { Timeouts } from '../constants/timeouts.js';
import { loadEnv } from '../env/loadEnv.js';

const env = loadEnv();

/**
 * WEB lane — drive the GoPOS web POS in a real browser.
 *
 * ## Why this is its own config
 *
 * Every other lane drives the Tauri desktop app: tauri-driver launches a
 * binary, or msedgedriver attaches to a running WebView2. This lane drives a
 * plain website (`pos.gocheckin.net`) in Microsoft Edge, so NONE of the app
 * machinery applies — no `tauri:options`, no `AppLifecycleService`, no
 * `TauriDriverService`, and crucially no `rootHooks` (those sign into the app
 * and switch app windows; here there is no app).
 *
 * WebdriverIO v9 manages msedgedriver itself for `browserName: 'MicrosoftEdge'`,
 * so there is no driver service to start and no port to reserve.
 *
 * ## What it is for
 *
 * Phase A of the cross-surface check: create an appointment on the web, write
 * its correlation key to `.tmp/web-appointment-handoff.json`, so the app lane
 * can later confirm the same appointment synced down to Volt POS.
 *
 *   npm run web:appointment
 */
export const config: WebdriverIO.Config = {
  runner: 'local',

  specs: [path.join(Paths.TESTS, 'web', '**', '*.spec.ts')],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': {
        args: ['--disable-popup-blocking', '--start-maximized'],
      },
    },
  ],

  logLevel: env.LOG_LEVEL === 'debug' ? 'debug' : 'warn',
  outputDir: path.join(Paths.REPORTS, 'wdio-logs-web'),

  baseUrl: env.WEB_URL,
  bail: 0,
  waitforTimeout: Timeouts.MEDIUM,
  waitforInterval: 250,
  connectionRetryTimeout: Timeouts.API,
  connectionRetryCount: 2,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: Timeouts.MOCHA_TEST,
  },

  // A flaky web round trip earns one retry on dev, same as the app lanes.
  specFileRetries: env.SPEC_RETRIES,
  specFileRetriesDeferred: true,

  reporters: [['spec', { symbols: { passed: '[PASS]', failed: '[FAIL]', skipped: '[SKIP]' } }]],

  async afterTest(test, _ctx, result): Promise<void> {
    if (result.passed) return;
    const fs = await import('node:fs');
    const { browser } = await import('@wdio/globals');
    fs.mkdirSync(Paths.SCREENSHOTS, { recursive: true });
    const file = path.join(Paths.SCREENSHOTS, `web-${test.title.replace(/\W+/g, '_')}.png`);
    await browser.saveScreenshot(file).catch(() => undefined);
    console.log(`[web] failure screenshot → ${file}`);
  },

  onPrepare(): void {
    const lines = [
      '',
      '='.repeat(78),
      ' GoPOS WEB lane',
      '='.repeat(78),
      ` URL          : ${env.WEB_URL}`,
      ` Web merchant : ${env.WEB_MERCHANT_ID}`,
      ` Username     : ${env.WEB_USERNAME || '(UNSET — fill WEB_USERNAME in .env.dev)'}`,
      '='.repeat(78),
      '',
    ];
    console.log(lines.join('\n'));
  },
};
