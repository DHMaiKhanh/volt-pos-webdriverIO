/**
 * TEST CASES — 4 phương thức thanh toán (Card / Cash / Gift Card / Other) cho tiệm 20258.
 *
 * Chạy trên lane phục hồi `wdio.recovery.conf.ts` (KHÔNG nạp rootHooks) nên spec
 * TỰ boot + điều hướng, giống `cash-demo.spec.ts` / `payment-methods-scan.spec.ts`.
 *
 * Khác với spec SCAN (quét 4 tab trên MỘT đơn, chỉ chốt cash), spec này thực sự
 * CHỐT tiền ở mọi phương thức làm được trên máy test — mỗi phương thức là MỘT test
 * case trên MỘT đơn riêng (settle đóng đơn nên không dùng chung đơn được):
 *
 *   - Card      : CHỈ QUÉT — Complete Payment phải đang disabled. Card chỉ mở khoá
 *                 sau khi màn hình khách trả tip + chữ ký, và charge cần một Bamboo
 *                 DOT terminal gắn thật; máy test không có cả hai nên đây là giới
 *                 hạn phần cứng, KHÔNG settle được. Dọn đơn nháp sau khi quét.
 *   - Cash      : settle EXACT — bỏ tenderedCents, bấm thẳng Complete Payment trên
 *                 số pre-fill (KHÔNG gõ keypad → né overlap phím "9", xem
 *                 checkout-keypad-preset-overlap).
 *   - Gift Card : redeem thẻ 152298102986 — số set cứng cho tiệm 20258 ở
 *                 `src/data/static/paymentMethods.ts` (GIFT_CARD_BY_MERCHANT) — rồi
 *                 settle. `enterGiftCardCode` gõ vào ô thẻ riêng, không đụng keypad
 *                 checkout. Nếu thẻ không đủ số dư, `payWithGiftCard` ném lỗi nói rõ
 *                 đó là split payment, không phải fail thầm.
 *   - Other     : đặt tên tender "Zelle" rồi settle. Online là đủ — không cần phần
 *                 cứng. Tax vẫn áp như card (Other là tender CÓ NHÃN, không miễn thuế).
 *
 * before(): boot 1 lần + bật watcher dọn toast updater (recovery lane không có
 * rootHooks nên phải tự bật). beforeEach(): returnToHome chuẩn hoá trạng thái giữa
 * các test — sau settle app đậu ở /payment-success, returnToHome đưa về /home.
 */
import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { giftCard } from '../../src/data/index.js';
import {
  createOrder,
  payInCash,
  payWithGiftCard,
  payWithOther,
  returnToHome,
} from '../../src/flows/index.js';
import { step } from '../../src/helpers/steps.js';
import { startUpdaterWatcher, stopUpdaterWatcher } from '../../src/helpers/updater.js';
import { waitUntilPath } from '../../src/helpers/wait.js';
import { switchToMain } from '../../src/helpers/window.js';
import { checkoutPage, homePage, splashPage } from '../../src/pages/index.js';

describe('Thanh toán — 4 phương thức (Card / Cash / Gift Card / Other) — tiệm 20258', () => {
  before(async () => {
    // Recovery lane không nạp rootHooks nên watcher dọn toast updater cũng không
    // chạy. App coi mọi bản là "mới hơn" → có thể bung sonner toast đè lên control.
    // Bật như rootHooks vẫn làm: vô hại khi không có toast, cứu click khi có.
    startUpdaterWatcher();

    await switchToMain();

    // Đợi app boot xong (splash chạy migrations + mở 3 DB + sync) trước khi điều hướng.
    await step('Đợi app boot xong', async () => {
      await waitUntilPath((p) => p !== '' && p !== '/', {
        timeout: Timeouts.NAVIGATION,
        message: 'WebView chưa route khỏi "/"',
      });
      await splashPage.waitUntilLeft(Timeouts.APP_BOOT);
    });

    await returnToHome();
  });

  after(() => {
    stopUpdaterWatcher();
  });

  // Đưa app về /home trước mỗi test: sau settle app đậu ở /payment-success,
  // returnToHome đi tiếp về till; nếu test trước để lại nháp trên checkout thì nó
  // cũng back ra. Idempotent nên gọi lại ngay sau before() cũng vô hại.
  //
  // Escape trước: một test lỗi có thể để lại modal (vd. dialog gift card ở màn
  // nhập mã / kết quả số dư) che header, khiến returnToHome không click được nav
  // và test kế tiếp "chết oan". Escape đóng Radix dialog; vô hại khi không có modal.
  beforeEach(async () => {
    await browser.keys(['Escape']);
    await returnToHome();
  });

  it('Card — chỉ quét: Complete Payment disabled (không settle khi thiếu terminal + handoff)', async () => {
    const { orderId } = await step('Tạo đơn cho card', () => createOrder());
    expect(orderId).toBeTruthy();
    await checkoutPage.waitForReady();

    // `card` là tab mặc định khi vào checkout; selectTender là no-op nhưng gọi cho
    // tường minh. Nút phải đang DISABLED: card chỉ mở khoá sau tip + chữ ký từ
    // customer display — máy test không thao tác màn khách nên disabled mới đúng.
    await checkoutPage.selectTender('card');
    expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);

    // Card không settle được ở đây (cần Bamboo DOT terminal thật). Dọn đơn nháp
    // để test kế tiếp bắt đầu trên till sạch — createOrder giả định till trống.
    await step('Dọn đơn nháp card', async () => {
      await checkoutPage.pressBack();
      await homePage.waitForReady(Timeouts.MEDIUM);
      await homePage.deleteOrder();
    });
  });

  it('Cash — settle exact -> /payment-success', async () => {
    const { orderId } = await step('Tạo đơn cho cash', () => createOrder());
    expect(orderId).toBeTruthy();

    // Bỏ tenderedCents = chốt đúng số còn phải trả (bấm thẳng Complete Payment
    // trên số pre-fill, không gõ keypad).
    const success = await payInCash(orderId);

    expect(await success.orderId()).toBe(orderId);
    expect(await success.isActive()).toBe(true);
  });

  it('Gift Card — redeem 152298102986 -> /payment-success', async () => {
    // Số thẻ set cứng cho tiệm 20258 (env GIFT_CARD_CODE vẫn override được nếu đặt).
    expect(giftCard.code).toBeTruthy();

    const { orderId } = await step('Tạo đơn cho gift card', () => createOrder());
    expect(orderId).toBeTruthy();

    const success = await payWithGiftCard(orderId, giftCard.code);

    expect(await success.orderId()).toBe(orderId);
    expect(await success.isActive()).toBe(true);
  });

  it('Other (Zelle) — settle -> /payment-success', async () => {
    const { orderId } = await step('Tạo đơn cho other', () => createOrder());
    expect(orderId).toBeTruthy();

    const success = await payWithOther(orderId, 'Zelle');

    expect(await success.orderId()).toBe(orderId);
    expect(await success.isActive()).toBe(true);
  });
});
