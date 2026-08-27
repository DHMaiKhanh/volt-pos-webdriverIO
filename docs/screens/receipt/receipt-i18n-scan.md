---
title: receipt — Tài liệu hợp nhất (i18n; feature/testcase bổ sung sau)
screen: receipt
route: /settings/receipt
scanned-at: 2026-07-06
source: compare.json + compare.html (TC-i18n-screen-compare, quét sau khi cuộn hết trang)
---

# Hóa đơn (mẫu in) — Quét Tiếng Việt / UI vỡ / dịch đúng chuẩn

> **Tài liệu hợp nhất (1 file/màn).** Hiện mới có **PHẦN i18n** (quét Tiếng Việt + nghĩa). Đặc tả tính năng & test case sẽ bổ sung vào chính file này khi chạy skill 1/2. Luồng code-gen (nếu có) giữ riêng ở codegen-flow/ + codegen-detail/. Kết quả HTML: reports/receipt/receipt.html.

## Tổng quan

> **Chuỗi UI đối chiếu 101** · ❌ chưa dịch **11 nhãn thật** (+ 11 chuỗi data mẫu) · ⚠️ sai chuẩn **0** · 📐 UI vỡ **0** · ✅ thuật ngữ đúng **79** · (tổng pair 133)
> ⚠️ Đây là màn có **nhiều tiếng Anh nhất** trong nhóm settings — phần **preview hóa đơn** còn hàng loạt nhãn cứng chưa `t()`.
> Report trực quan: `reports/receipt/compare.html`

## 1. ❌ Chưa dịch (còn tiếng Anh) — NHÃN THẬT (cần fix)

| Chuỗi (EN)                                                                                                    | Nên dịch                       | Ghi chú                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `Customer Name`                                                                                               | **Tên khách hàng**             | Nhãn khối thông tin khách trên hóa đơn.                                           |
| `Current points:`                                                                                             | **Điểm hiện tại:**             | Loyalty — cùng chuỗi đã thấy trên receipt đơn hàng.                               |
| `Total visit:`                                                                                                | **Tổng lượt ghé:**             | Loyalty.                                                                          |
| `Staff:`                                                                                                      | **Nhân viên:**                 | Nhãn dòng nhân viên (hiện lỗi lặp **"Staff: Staff:"** — cần rà cả bug nối chuỗi). |
| `(Note: …)`                                                                                                   | **(Ghi chú: …)**               | Nhãn "Note:" bọc ghi chú dịch vụ (tên dịch vụ là data).                           |
| `Tip`                                                                                                         | **Tiền tip**                   | Cùng label cứng dùng chung với 3 màn Income.                                      |
| `Cash`                                                                                                        | **Tiền mặt**                   | Dòng phương thức thanh toán.                                                      |
| `(Cash $xx.xx - Change $xx.xx)`                                                                               | **(Tiền mặt … - Tiền thối …)** | Nhãn "Cash"/"Change" trong dòng mẫu.                                              |
| `(Current Balance: $xx.xx)`                                                                                   | **(Số dư hiện tại: …)**        | Nhãn "Current Balance:" của gift card.                                            |
| `Order Note:`                                                                                                 | **Ghi chú đơn:**               |                                                                                   |
| `Business Note:`                                                                                              | **Ghi chú cửa hàng:**          |                                                                                   |
| `By signing below, you acknowledge that the services were provided to your satisfaction. No refunds allowed.` | (cần dịch cả câu)              | Câu miễn trừ ký tên cuối hóa đơn — **hardcode**.                                  |

## 1b. Data mẫu trong preview (KHÔNG phải lỗi dịch — bỏ qua)

`John Doe`, `Jane Doe` (tên NV mẫu) · `Service A/B/C/D` (tên dịch vụ mẫu) · `Credit Card - 1234`, `Gift Card ****1234` (phương thức mẫu). Đây là placeholder minh hoạ layout, không đưa vào cổng dịch.

## 2. ⚠️ Dịch chưa đúng chuẩn

> Không có (trong số đã dịch, 79 thuật ngữ khớp glossary).

## 3. 📐 Vỡ giao diện (chỉ báo cáo)

> Không phát hiện: `xOverflow = 0px`, `clipped = []`.

## 4. ✅ Đã dịch đúng (mẫu)

| EN       | VI         |
| -------- | ---------- |
| Receipt  | Hóa đơn    |
| Subtotal | Tạm tính   |
| Tax      | Thuế       |
| Total    | Tổng       |
| Discount | Giảm giá   |
| Payment  | Thanh toán |

## 5. Ghi chú / đề xuất

- Preview hóa đơn dùng **template cứng** — nhóm nhãn `Customer Name / Current points: / Total visit: / Staff: / Note: / Tip / Cash / Change / Current Balance / Order Note: / Business Note:` + câu miễn trừ cần bọc `t()`.
- Bug phụ: **"Staff: Staff:"** bị lặp tiền tố → kiểm code ghép chuỗi nhãn nhân viên.
- Chuỗi `Tip`/`Cash` trùng lỗi label chung toàn app (Income + receipt) → fix chỗ chung.

## 6. Nguồn tham chiếu

- HTML: `reports/receipt/compare.html` · JSON: `reports/receipt/compare.json`
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['receipt']`)
