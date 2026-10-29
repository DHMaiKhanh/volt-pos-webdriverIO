/**
 * The attach-lane health classifier, checked without the app.
 *
 * `isDrivableTarget` decides, from a CDP target, whether the attached app is on a
 * screen the next spec file can recover from — the heart of the attach self-heal
 * (`src/support/attachApp.ts`). Get it wrong one way and a wedged app (stuck
 * mid-checkout) is called healthy, so the whole run cascades red behind it; wrong
 * the other way and a perfectly good app is relaunched every file, throwing away
 * the open-once speed the lane exists for. Neither shows up as a failing E2E spec,
 * so it is pinned here.
 *
 * Pure-function test: no app, no driver. `npm run test:unit`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDrivableTarget, type CdpTarget } from '../../src/support/attachApp.js';

const page = (url: string): CdpTarget => ({ type: 'page', url });

describe('isDrivableTarget — attach self-heal health classifier', () => {
  it('accepts the screens the next file can recover from', () => {
    for (const path of ['/home', '/login', '/splashscreen', '/order-pending', '/order-history']) {
      assert.equal(isDrivableTarget(page(`http://tauri.localhost${path}`)), true, path);
    }
  });

  it('accepts an order view (recoverable), but NOT its checkout', () => {
    assert.equal(isDrivableTarget(page('http://tauri.localhost/order/01a1-abc')), true, 'order view');
    assert.equal(
      isDrivableTarget(page('http://tauri.localhost/order/01a1-abc/checkout')),
      false,
      'mid-checkout is the wedge the cascade came from',
    );
  });

  it('rejects the stuck screens returnToHome cannot escape', () => {
    for (const url of [
      'http://tauri.localhost/order/01a1-abc/split-order',
      'http://tauri.localhost/force-update',
    ]) {
      assert.equal(isDrivableTarget(page(url)), false, url);
    }
  });

  it('rejects a non-app or blank target', () => {
    assert.equal(isDrivableTarget(page('about:blank')), false, 'about:blank');
    assert.equal(isDrivableTarget(page('')), false, 'empty url');
    assert.equal(isDrivableTarget(page('https://example.com/home')), false, 'foreign host');
  });

  it('rejects non-page targets (service worker, iframe, devtools)', () => {
    assert.equal(
      isDrivableTarget({ type: 'service_worker', url: 'http://tauri.localhost/home' }),
      false,
      'service_worker on /home is still not a drivable page',
    );
    assert.equal(isDrivableTarget({ type: 'iframe', url: 'http://tauri.localhost/home' }), false, 'iframe');
  });
});
