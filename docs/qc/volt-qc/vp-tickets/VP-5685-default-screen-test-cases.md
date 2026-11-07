---
title: Cho phép tiệm cấu hình màn hình mặc định trên POS (Default Screen) — test cases
ticket: VP-5685 — https://linear.app/fastboy/issue/VP-5685/cho-phep-tiem-cau-hinh-man-hinh-mac-djinh-tren-pos
sub-issues: —
spec-files: tests/regression/settings/vp-5685-default-screen.spec.ts
imported-at: 2026-11-06
updated-at: 2026-11-06
---

# Test Cases – Cho phép tiệm cấu hình màn hình mặc định trên POS (Default Screen)

**Ticket:** [VP-5685](https://linear.app/fastboy/issue/VP-5685/cho-phep-tiem-cau-hinh-man-hinh-mac-djinh-tren-pos) · project Default Screen Setting · related VP-5723
**Dev:** Ngan Huynh (`ngan_huynh`) · PR FastboyMarketing/volt-pos#3336 · volt-pos-api#1625 · fastboy-portal#959
**Trạng thái:** QC Completed — test tay trên dev 1.1.107 (06/11/2026): 9/9 PASS phạm vi POS Windows.
**Tự động (06/11/2026, dev 1.1.107, lane launch):** 12/12 TC PASS (TC-13..18 đã bỏ theo yêu cầu 06/11).

## Hành vi mong đợi

1. POS › Setting › Accessibility có thẻ **Default Screen** ngay dưới Customer Display: hai lựa chọn có hình skeleton
   (**Pending Orders** – nhãn "Default", **Home** – "Create Order") và nút Save riêng.
2. Tiệm cũ và mới mặc định **Pending Orders**. Một cấu hình dùng chung cho cả tiệm (sys setting `merchant_default_screen`,
   giá trị `pending_orders` | `home`).
3. Khi **mở app** (sau đăng nhập hoặc app tự mở lại) và sau **Complete order** (Payment Successful → chọn receipt xong),
   POS điều hướng theo cấu hình. Chọn Home thì màn hình trống: chưa khách, chưa thợ, giỏ trống.
4. Save ticket, Back, Void, Cancel order và tab header giữ nguyên hành vi. Logo VOLT luôn về Home.
5. Lưu trên Portal hoặc POS đồng bộ sang Portal và mọi POS khác, không điều hướng máy đang hoạt động; áp dụng ở lần mở
   app / Complete tiếp theo.
6. Lưu trên POS lỗi do mất mạng: toast lỗi, giữ lựa chọn để Save lại, tiếp tục dùng giá trị đã lưu trước đó.
7. Áp dụng Windows, D5, P18. **P8D out of scope** (Loan Dang xác nhận 05/11).

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows **≥ 1.1.107** (có PR #3336), device đã đăng nhập.
- Vào Setting cần passcode POS Settings (8888) — `goToSettings()` tự trả lời.
- Thanh toán bằng Cash, khách chọn No Tip trên màn khách (tiệm 14 đẩy tip sang màn khách cả khi cash) → cần lane có
  cửa sổ khách drive được.
- Oracle DB: GraphQL `sysSettingList(where:{key:{eq:"merchant_default_screen"}}){value}`.
- Spec **ghi cấu hình tiệm** (merchant-global): `after` luôn trả về mặc định **Pending Orders** (không khôi phục theo
  snapshot: một lượt chạy bị gián đoạn để lại Home thì lượt sau sẽ "khôi phục" Home).
- DB lưu giá trị lúc thì thô (`pending_orders`, ngay sau khi lưu trên POS), lúc thì dạng chuỗi JSON (`"pending_orders"`,
  sau khi mở lại app / đồng bộ) — oracle chấp nhận cả hai.
- TC mở lại app (08/09) tắt hẳn app rồi mở lại → chỉ chạy được khi không có phiên khác đang dùng chung app.

Chú thích trạng thái: ✅ tự động được · ⚠️ được, có điều kiện · 🧱 chưa tự động được (lý do) · 📄 chỉ tài liệu · 🐞 bug đã log.

## 1. Thẻ Default Screen trên POS

| TC ID        | Title                                | Priority | Precondition                    | Test Data      | Steps                                               | Expected Result                                                                                                      | Status |
| ------------ | ------------------------------------ | -------- | ------------------------------- | -------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5685-01 | Thẻ Default Screen hiển thị đúng chỗ | High     | Vào Setting bằng passcode       | —              | ≡ → Setting → Accessibility, kéo tới Default Screen | Thẻ Default Screen nằm ngay sau Customer Display; có 2 lựa chọn kèm skeleton Pending Orders / Home và nút Save riêng | ✅     |
| TC-VP5685-02 | Mặc định Pending Orders, Save khoá   | High     | Cấu hình đang là Pending Orders | —              | Mở thẻ Default Screen                               | Pending Orders được chọn, có nhãn "Default"; Save bị disable khi chưa đổi                                            | ✅     |
| TC-VP5685-03 | Đổi lựa chọn rồi chọn lại giá trị cũ | Medium   | Cấu hình Pending Orders         | —              | 1. Chọn Home 2. Chọn lại Pending Orders             | Bước 1 Save bật; bước 2 Save khoá lại, không có gì để lưu                                                            | ✅     |
| TC-VP5685-04 | Lưu Home                             | Critical | Cấu hình Pending Orders         | Home           | Chọn Home → Save                                    | Toast "Default screen setting updated successfully"; Save khoá lại; DB `value = home`                                | ✅     |
| TC-VP5685-05 | Lưu Pending Orders                   | Critical | Cấu hình Home                   | Pending Orders | Chọn Pending Orders → Save                          | Toast thành công; DB `value = pending_orders`                                                                        | ✅     |

## 2. Điều hướng sau Complete order và khi mở app

| TC ID        | Title                                  | Priority | Precondition            | Test Data                 | Steps                                                 | Expected Result                                                                   | Status |
| ------------ | -------------------------------------- | -------- | ----------------------- | ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| TC-VP5685-06 | Complete order khi cấu hình Home       | Critical | Cấu hình Home           | 1 staff + 1 dịch vụ, Cash | Tạo đơn → Pay → Cash → Complete → No Tip → No Receipt | Về `/home` trống: chưa khách (keypad "Phone, name or email"), chưa thợ, giỏ trống | ✅     |
| TC-VP5685-07 | Complete order khi cấu hình Pending    | Critical | Cấu hình Pending Orders | 1 staff + 1 dịch vụ, Cash | Tạo đơn → Pay → Cash → Complete → No Tip → No Receipt | Về `/order-pending`                                                               | ✅     |
| TC-VP5685-08 | Mở lại app khi cấu hình Home           | High     | Cấu hình Home           | —                         | Tắt hẳn app → mở lại, đợi qua splash                  | App vào thẳng `/home`                                                             | ⚠️     |
| TC-VP5685-09 | Mở lại app khi cấu hình Pending Orders | High     | Cấu hình Pending Orders | —                         | Tắt hẳn app → mở lại, đợi qua splash                  | App vào thẳng `/order-pending`                                                    | ⚠️     |

## 3. Hành vi giữ nguyên (không phụ thuộc cấu hình)

| TC ID        | Title                                       | Priority | Precondition            | Test Data           | Steps                                      | Expected Result                                                | Status |
| ------------ | ------------------------------------------- | -------- | ----------------------- | ------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------ |
| TC-VP5685-10 | Logo VOLT luôn về Home                      | High     | Cấu hình Pending Orders | —                   | Từ Pending Orders bấm logo VOLT            | Về `/home`                                                     | ✅     |
| TC-VP5685-11 | Back từ checkout giữ đơn                    | Medium   | Cấu hình Home           | 1 staff + 1 dịch vụ | Tạo đơn → Pay → Back                       | Quay lại `/home` với đúng đơn đang làm (dịch vụ còn trong giỏ) | ✅     |
| TC-VP5685-12 | Tab header Pending Orders khi cấu hình Home | Low      | Cấu hình Home           | —                   | Từ Home bấm tab Pending Orders trên header | Vào `/order-pending` như cũ                                    | ✅     |
