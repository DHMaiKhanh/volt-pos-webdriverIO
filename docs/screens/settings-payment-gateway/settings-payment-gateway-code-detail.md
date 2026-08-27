---
title: Code Detail — Payment Gateway (Cổng thanh toán)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Payment Gateway (Cổng thanh toán) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Payment Gateway (Cổng thanh toán)** · route `/settings/payment-gateway` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **1** · 📐 UI vỡ **0**
> Số liệu máy quét: 41 cặp EN↔VI · ✅ đúng glossary 33 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-payment-gateway/compare.json` · HTML: `reports/settings-payment-gateway/settings-payment-gateway.html`
> Cách quét: `I18N_SCREEN=settings-payment-gateway I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Mục mới trong Setting, nhóm **Payment & Transaction**. Một switch duy nhất: charge trực tiếp qua cổng Fastboy Payment hay đi qua API upstream cũ.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                                      | Gốc (EN)                                                      | Nên dùng (chuẩn)                                                  | Vì sao                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Khi tắt, thanh toán thẻ sẽ đi qua API upstream cũ. | When off, card charges route through the legacy upstream API. | **Khi tắt, thanh toán thẻ sẽ đi qua hệ thống cũ (upstream API).** | Câu dịch giữ nguyên “API upstream” — người dùng tiệm nail không hiểu; nên diễn giải “hệ thống cũ” và để thuật ngữ kỹ thuật trong ngoặc. |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Cổng thanh toán (Payment Gateway)
- Chọn cách xử lý thanh toán thẻ. (Choose how card payments are processed.)
- Thanh toán trực tiếp qua cổng Fastboy Payment (giữ nguyên tên riêng “Fastboy Payment” — đúng)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất `GLOSSARY`:** `Payment Gateway: ['Cổng thanh toán']`.
- Không bật/tắt switch khi quét — đây là cấu hình định tuyến thanh toán thật của merchant.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-payment-gateway/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-payment-gateway`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
