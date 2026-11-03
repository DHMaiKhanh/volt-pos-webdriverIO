---
title: Menu service — chữ tên service/category màu đen (ink) giống tên thợ — test cases
ticket: VP-4039 — https://linear.app/fastboy/issue/VP-4039/improvement-ticket-1532414-djoi-mau-chu-menu-service-luu-filter-active
spec-files: tests/regression/home/vp-4039-menu-service-ink-text.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [POS] Đổi màu chữ Menu service sang màu đen + lưu filter Active ở Employees

**Ticket:** [VP-4039](https://linear.app/fastboy/issue/VP-4039/improvement-ticket-1532414-djoi-mau-chu-menu-service-luu-filter-active) · Ticket CRM #1532414 (ASIAN PEARL NAILS STUDIO #21013) · PR volt-pos#3133
**Dev:** Ngan Huynh (`ngan_huynh`) · **Sub-issue:** không có

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.58** (bản 1.1.57 build trước khi merge PR #3133 nên vẫn chữ trắng).
- Đã đăng nhập POS, đứng ở màn Home, không có order nháp đang mở.
- Màu chữ "ink" = màu tên thợ trên tile Staff (`text-ink`, đo được `rgb(47, 44, 53)` = `#2F2C35` trên 1.1.58).
- Chỉ đổi **màu chữ**; màu nền tile vẫn là màu category (`category.colorHex`, mặc định Peach `#E3AA8A` sau VP-5338). Tile ghim: Quick Pay `#E66436`, Gift Card `#F49D1A`.
- Request 2 (lưu filter Active ở Setting/Employees) đã bị **gạch** trong ticket và không nằm trong PR → chỉ ghi nhận, không test.
- Spec chỉ đọc màu (computed style) + đối chiếu GraphQL `query category` của Home; không tạo dữ liệu.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được nhưng có điều kiện · 🧱 không tự động được ở đây · 📄 chỉ tài liệu.

## 1. Build & màu chữ Menu service

| TC ID        | Title                                                     | Priority | Precondition                                   | Test Data                                                          | Steps                                                                           | Expected Result                                                                                                                           | Status |
| ------------ | --------------------------------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4039-01 | Đúng bản build có fix                                     | High     | Đã cài bản dev mới                             | Version ≥ 1.1.58                                                   | 1. Mở menu bên trái → xem Version (spec đọc qua IPC Tauri `plugin:app` version) | Version ≥ **1.1.58**                                                                                                                      | ✅     |
| TC-VP4039-02 | Chữ trên card service màu đen                             | High     | Đang ở Home                                    | Lidasy, Dark Queen, Express Pedicure…                              | 1. Home → xem lưới Menu service                                                 | Tên, mô tả, giá service màu **ink**, không còn chữ trắng                                                                                  | ✅     |
| TC-VP4039-03 | Chữ trên tile category màu đen (gồm Quick Pay, Gift Card) | High     | Đang ở Home                                    | 23 tile, 3 trang carousel                                          | 1. Xem dải category. 2. Vuốt qua tất cả các trang                               | Tên category + số service màu **ink**, kể cả tile Quick Pay và Gift Card                                                                  | ✅     |
| TC-VP4039-04 | Màu chữ service giống màu tên thợ                         | Medium   | Đang ở Home                                    | Tile thợ (vd Pamela) vs card service                               | 1. So màu tên thợ và chữ service                                                | Cùng một màu (`rgb(47, 44, 53)`)                                                                                                          | ✅     |
| TC-VP4039-05 | Kết quả tìm kiếm service cũng chữ đen                     | Medium   | Đang ở Home                                    | Từ khóa "pedicure" (spec lấy từ đầu tiên của tên service đầu tiên) | 1. Gõ từ khóa vào ô Search service                                              | Mọi card kết quả đều chữ **ink**                                                                                                          | ✅     |
| TC-VP4039-06 | Category màu đậm vẫn đọc được                             | Medium   | Có category màu tím đậm (màu cũ trước VP-5338) | Gel & Acrylic Services `#785EE1`, Additional Services `#6C64E9`    | 1. Bấm vào từng category                                                        | Chữ đen trên nền đậm vẫn đọc được (ghi chú: độ tương phản thấp hơn chữ trắng cũ — không phải bug). Spec chỉ chạy khi còn category nền tối | ⚠️     |
| TC-VP4039-07 | Màu nền không đổi                                         | Low      | So với 1.1.57                                  | Quick Pay, The Signature Spa Combo, Lidasy                         | 1. So màu nền tile với `category.colorHex` trong DB                             | Chỉ đổi màu chữ; nền tile = màu category (Quick Pay `#E66436`, Gift Card `#F49D1A`)                                                       | ✅     |

## 2. Request 2 — ngoài phạm vi

| TC ID        | Title                                           | Priority | Precondition                   | Test Data | Steps                                                            | Expected Result                                            | Status |
| ------------ | ----------------------------------------------- | -------- | ------------------------------ | --------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| TC-VP4039-08 | Setting/Employees nhớ filter Active khi vào lại | Low      | Request 2 bị gạch trong ticket | —         | 1. Settings → Employees → filter Active. 2. Ra ngoài. 3. Vào lại | (Không làm) — ghi nhận để không bị bỏ sót khi tiệm hỏi lại | 📄     |

## Kết quả test tay (26/10/2026, POS Windows 1.1.58)

Pass 7 / Fail 0 — đã comment "I have verified…" vào VP-4039 (QC Completed).

## Automation

`npm run test:attach -- --spec tests/regression/home/vp-4039-menu-service-ink-text.spec.ts` — chưa chạy (lead chạy tuần tự sau).
