---
title: Code Detail — Tipping Settings (Cài đặt chia tip)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Tipping Settings (Cài đặt chia tip) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Tipping Settings (Cài đặt chia tip)** · route `/settings/payment-transaction` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **1** · 📐 UI vỡ **0**
> Số liệu máy quét: 44 cặp EN↔VI · ✅ đúng glossary 36 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-payment-transaction/compare.json` · HTML: `reports/settings-payment-transaction/settings-payment-transaction.html`
> Cách quét: `I18N_SCREEN=settings-payment-transaction I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Mục mới trong Setting, nhóm **Payment & Transaction** (`Thanh toán & Giao dịch`). Nội dung: chọn phương thức chia tip mặc định khi hoàn tất đơn (Split Evenly / Proportion).

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                      | Gốc (EN)                             | Nên dùng (chuẩn)                     | Vì sao                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cài đặt tip / chia tip / xử lý tip | Tipping Settings / Split Tip Setting | **Cài đặt tiền boa / Chia tiền boa** | Màn này giữ nguyên từ **tip**, trong khi màn **Phí & Phụ thu** (`charge-fee`) dùng “tiền boa” cho toàn bộ (Cài đặt tiền boa, Mức tiền boa, Gợi ý tiền boa) và Staff Payroll cũng dùng “Tiền boa”. Một trong hai phải nhường: đây là cùng một khái niệm ở 3 màn. |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Cổng thanh toán (Payment Gateway) · Thanh toán & Giao dịch (Payment & Transaction)
- Quản lý cách xử lý tip khi thanh toán. (Manage how tips are handled during checkout.)
- Thiết lập phương thức chia tip sẽ được chọn sẵn khi hoàn tất đơn hàng.
- Chia đều (Split Evenly) · Theo tỉ lệ (Proportion) · Lưu (Save)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất `GLOSSARY`:** `Tipping Settings: ['Cài đặt tiền boa']`, `Split Tip: ['Chia tiền boa']`, `Split Evenly: ['Chia đều']`, `Proportion: ['Theo tỉ lệ']` — và chốt 1 chuẩn cho `Tip` (`Tiền boa` đang chiếm đa số màn).
- Không quét được popup xác nhận lưu (nếu có) vì skill không bấm Save (tránh ghi cấu hình thật của merchant).

### 6. Nguồn tham chiếu

- JSON: `reports/settings-payment-transaction/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-payment-transaction`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
