/**
 * ONE-OFF demo / recovery spec (không thuộc suite chính).
 *
 * Mục đích: chứng minh framework điều khiển được app để TẠO 1 ĐƠN THANH TOÁN CASH,
 * kể cả khi app boot vào /order-pending. Chạy bằng lane tạm wdio.recovery.conf.ts
 * (KHÔNG nạp rootHooks → không bị ensureLoggedIn chặn).
 *
 * Trong 1 session:
 *   switchToMain -> returnToHome (đi từ /order-pending về /home) -> createOrder -> payInCash
 */
import { expect } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { createOrder, payInCash, returnToHome } from '../../src/flows/index.js';
import { switchToMain } from '../../src/helpers/window.js';
import { waitUntilPath } from '../../src/helpers/wait.js';
import { splashPage } from '../../src/pages/index.js';
import { step } from '../../src/helpers/steps.js';

describe('DEMO — tạo đơn thanh toán cash', () => {
  it('điều khiển app tạo và thanh toán 1 đơn bằng cash', async () => {
    await switchToMain();

    // Đợi app boot xong (splash chạy migrations + mở 3 DB + sync) trước khi điều hướng.
    await step('Đợi app boot xong', async () => {
      await waitUntilPath((p) => p !== '' && p !== '/', {
        timeout: Timeouts.NAVIGATION,
        message: 'WebView chưa route khỏi "/"',
      });
      await splashPage.waitUntilLeft(Timeouts.APP_BOOT);
    });

    // /order-pending -> /home bằng cách click (không nav URL)
    await returnToHome();

    // Tạo đơn (chọn staff đầu + service đầu) và vào checkout
    const { orderId } = await step('Tạo đơn mới', () => createOrder());
    expect(orderId).toBeTruthy();

    // Thanh toán đúng số tiền (omit tenderedCents = settle exact)
    const success = await payInCash(orderId);

    expect(await success.orderId()).toBe(orderId);
    expect(await success.isActive()).toBe(true);
  });
});
