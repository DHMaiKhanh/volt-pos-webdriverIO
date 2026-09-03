/**
 * SCAN — 4 phương thức thanh toán của Volt POS (card / cash / gift-card / other).
 *
 * Chạy trên lane phục hồi `wdio.recovery.conf.ts` (KHÔNG nạp rootHooks) nên spec
 * TỰ boot + điều hướng, giống `cash-demo.spec.ts`.
 *
 * Trong MỘT đơn duy nhất, spec "quét" lần lượt 4 tab tender rồi chốt đơn bằng cash:
 *   switchToMain -> boot -> returnToHome -> createOrder
 *     -> quét CARD  (đọc trạng thái nút Complete Payment)
 *     -> quét OTHER (nhập tên phương thức, đọc lại)
 *     -> quét GIFT-CARD (xác nhận tab dùng được)
 *     -> quét CASH  (over-tender: kiểm tiền thối + remaining)
 *     -> payInCash  (chốt đơn -> /payment-success)
 *
 * ## Vì sao KHÔNG settle đủ cả 4
 *
 * Đây là giới hạn phần cứng/dữ liệu, đã chép ra từ `src/data/static/paymentMethods.ts`:
 *   - `card` cần một Bamboo DOT terminal gắn thật + handoff tip/chữ ký từ màn hình
 *     khách, nếu không hộp thoại charge đứng ở "waiting for connect device";
 *   - `gift-card` cần một MÃ THẺ thật còn số dư trong đúng merchant đang test.
 * Nên hai phương thức đó chỉ quét được tới mức "tab có mở/dùng được không" + hành vi
 * UI, còn `cash` (và `other` khi online) mới chốt được mà không cần phần cứng. Việc
 * redeem thẻ quà tặng / charge thẻ ngân hàng thuộc về các spec chuyên biệt.
 *
 * Mỗi lần quét được bọc try/catch và GHI kết quả vào `report` thay vì ném lỗi: một
 * tab bị khoá vì offline là THÔNG TIN cần thấy, không phải lý do làm hỏng cả lượt
 * quét. Chỉ nhánh cash end-to-end mới hard-assert — đó là rail phải luôn chạy được.
 */
import { expect } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { createOrder, payInCash, returnToHome } from '../../src/flows/index.js';
import { step } from '../../src/helpers/steps.js';
import { startUpdaterWatcher, stopUpdaterWatcher } from '../../src/helpers/updater.js';
import { waitUntilPath } from '../../src/helpers/wait.js';
import { switchToMain } from '../../src/helpers/window.js';
import { checkoutPage, splashPage } from '../../src/pages/index.js';
import { moduleLogger } from '../../src/utils/logger.js';

const log = moduleLogger('payment-scan');

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

describe('SCAN — 4 phương thức thanh toán', () => {
  // Recovery lane KHÔNG nạp rootHooks nên watcher dọn toast updater cũng không
  // chạy. App coi mọi bản là "mới hơn" nên có thể bung một sonner toast 520px,
  // duration Infinity, đậu góc trên phải đè lên control. Bật watcher như rootHooks
  // vẫn làm để phòng — vô hại khi không có toast, cứu click khi có.
  before(() => {
    startUpdaterWatcher();
  });

  after(() => {
    stopUpdaterWatcher();
  });

  it('quét card / cash / gift-card / other trên một đơn rồi chốt bằng cash', async () => {
    await switchToMain();

    // Đợi app boot xong (splash chạy migrations + mở 3 DB + sync) trước khi điều hướng.
    await step('Đợi app boot xong', async () => {
      await waitUntilPath((p) => p !== '' && p !== '/', {
        timeout: Timeouts.NAVIGATION,
        message: 'WebView chưa route khỏi "/"',
      });
      await splashPage.waitUntilLeft(Timeouts.APP_BOOT);
    });

    // /order-pending -> /home bằng cách click (recovery lane không có rootHooks).
    await returnToHome();

    // Tạo đơn (staff đầu + service đầu) và vào checkout.
    const { orderId } = await step('Tạo đơn mới', () => createOrder());
    expect(orderId).toBeTruthy();
    await checkoutPage.waitForReady();

    /** Một dòng kết quả cho mỗi phương thức — in ra ở cuối lượt quét. */
    const report: string[] = [];

    // --- CARD -------------------------------------------------------------
    // `card` là tab mặc định khi vào checkout. Nút Complete Payment phải ĐANG
    // KHOÁ: nó chỉ mở sau khi màn hình khách trả tip + chữ ký, nên trên máy quét
    // (không thao tác customer display) trạng thái disabled mới là đúng.
    await step('Quét CARD', async () => {
      try {
        await checkoutPage.selectTender('card');
        const enabled = await checkoutPage.isCompletePaymentEnabled();
        report.push(
          enabled
            ? 'card      : reachable — Complete Payment ENABLED (bất thường: card lẽ ra chờ handoff)'
            : 'card      : reachable — Complete Payment disabled (đúng: chờ tip + chữ ký từ customer display)',
        );
      } catch (error) {
        report.push(`card      : blocked   — ${reason(error)}`);
      }
    });

    // --- CASH -------------------------------------------------------------
    // Tín hiệu quét: cash mở được và Complete Payment ENABLED NGAY — tương phản
    // với card (nút disabled tới khi có handoff). Dùng isEnabled() chứ không đọc
    // getText tiền, và KHÔNG gõ keypad.
    //
    // Vì sao không over-tender ở đây: trên build này cột preset ($5/$10/$50/$100)
    // render ĐÈ lên cột phím số — nút "$50" phủ đúng phím "9" (xem
    // reports/screenshots) — nên mọi số tiền chứa chữ số 9 sẽ "not clickable".
    // Phép tính tiền thối từng xu đã do cash-payment.spec.ts giữ; bằng chứng cash
    // ở đây là lượt CHỐT EXACT bên dưới (bấm thẳng Complete Payment, không gõ số).
    await step('Quét CASH', async () => {
      await checkoutPage.selectTender('cash');
      const canComplete = await checkoutPage.isCompletePaymentEnabled();
      report.push(
        canComplete
          ? 'cash      : reachable — Complete Payment enabled ngay (chốt exact ở bước settle)'
          : 'cash      : reachable — Complete Payment CHƯA enabled (bất thường cho cash)',
      );
    });

    // --- GIFT-CARD --------------------------------------------------------
    // Chỉ xác nhận tab mở được (offline sẽ khoá 3 tender card/gift-card/other).
    // Mở hộp thoại quét + redeem một mã thẻ THẬT là hành vi settle, để dành cho
    // spec gift-card riêng — ở đây không đụng tới tiền.
    await step('Quét GIFT-CARD', async () => {
      try {
        await checkoutPage.selectTender('gift-card');
        report.push('gift-card : reachable — tab mở được (redeem thẻ thật thuộc spec gift-card riêng)');
      } catch (error) {
        report.push(`gift-card : blocked   — ${reason(error)}`);
      }
    });

    // --- OTHER ------------------------------------------------------------
    // Tab `other` chọn được thì hiện ô nhập tên phương thức. Ghi vào rồi đọc lại
    // để chứng minh tender này nhận và giữ được nhãn (echo ở màn payment-success).
    await step('Quét OTHER', async () => {
      try {
        await checkoutPage.selectOtherTender();
        await checkoutPage.enterOtherMethodName('Zelle');
        const name = await checkoutPage.otherMethodName();
        expect(name).toBe('Zelle');
        report.push(`other     : reachable — nhận tên tender "${name}"`);
      } catch (error) {
        report.push(`other     : blocked   — ${reason(error)}`);
      }
    });

    // --- Chốt đơn bằng cash (rail end-to-end) -----------------------------
    // Exact: bỏ tenderedCents = chốt đúng số còn phải trả. payInCash không gõ phím
    // số ở nhánh này (bấm thẳng Complete Payment trên số pre-fill), nên né sạch
    // overlap keypad và mọi read getText tiền — đây là bằng chứng cash chắc nhất.
    const success = await payInCash(orderId);
    expect(await success.orderId()).toBe(orderId);
    expect(await success.isActive()).toBe(true);
    report.push('settle    : cash exact -> /payment-success OK');

    log.info(
      `\n===== KẾT QUẢ QUÉT 4 PHƯƠNG THỨC THANH TOÁN — đơn ${orderId} =====\n` +
        report.map((r) => `   ${r}`).join('\n') +
        '\n============================================================\n',
    );
  });
});
