---
title: Passcode cho Quick Checkout / Quick Pay / Gift Card / Calendar / Edit Service Price + Customer Status — test cases
ticket: VP-4815 — https://linear.app/fastboy/issue/VP-4815/improvement-ticket-1562799-passcode-cho-quick-check-outquick-paygift
sub-issues: VP-4860 (BE passcode), VP-4861 (BE customer status)
spec-files: tests/regression/settings/vp-4815-passcode-gates.spec.ts
imported-at: 2026-11-05
updated-at: 2026-11-05
---

# Test Cases – [Improvement] Ticket #1562799 Passcode cho Quick Check Out / Quick Pay / Gift Card / Calendar / Service price + Customer Status

**Ticket:** [VP-4815](https://linear.app/fastboy/issue/VP-4815/improvement-ticket-1562799-passcode-cho-quick-check-outquick-paygift) · project Maintenance 2026-Q4-M11-W1 · CRM #1562799 (Happy Nails #16136)
**Dev:** Thien Duy (`thienduy_vo`) · PR FastboyMarketing/volt-pos#3317 (passcode) + #3319 (customer status), merge vào `develop` 05/11
**BE:** VP-4860 (volt-pos-api#1533), VP-4861 (volt-pos-api#1590, view `v_customer_type`)
**Trạng thái:** QC Completed — test tay trên dev 1.1.99 (05/11/2026): 17/17 PASS (Windows). Scanner → Add Funds test tay lại trên 1.1.101: PASS.
**Tự động (05/11/2026, dev 1.1.101 — bản mới nhất trên feed, attach CDP 9223):** 21 PASS / 0 FAIL (TC-07 thêm sau, chạy riêng); trước đó 1.1.100 cũng 20 PASS sau khi sửa spec — spec `tests/regression/settings/vp-4815-passcode-gates.spec.ts`.

## Hành vi mong đợi

1. Passcode Setting (Settings → Accessibility) có thêm 4 dòng: **Quick Checkout**, **Sell Gift Card**, **Edit Service Price**, **Calendar** (Quick Pay đã có từ VP-3115). Mặc định tắt.
2. Dòng bật → hỏi "Enter staff code to access <tên>", rồi kiểm tra role của staff có permission tương ứng (`quick_checkout`, `quick_pay`, `gift_card_sale`, `edit_service_price`, `calendar`). Owner/Manager có sẵn; Staff không có → "You don't have permission for this action" (Calendar: "…to access this page").
3. Dòng tắt → không hỏi passcode.
4. Quick Checkout = mỗi lần **bắt đầu một sale từ giỏ trống** hỏi 1 lần: chạm thợ / khách / Gift Card đầu tiên, Scanner → Add Funds. Order đang mở → không hỏi. Nút Quick Checkout chỉ xoá giỏ, không hỏi.
5. Gift Card khi giỏ trống và bật cả 2 gate → hỏi 2 lần (Quick Checkout rồi Sell Gift Card).
6. Edit Service Price chỉ hỏi khi giá thật sự đổi; chỉ sửa note / discount thì không hỏi.
7. Calendar chặn cả route `/appointment`.
8. Customer Status (New / Regular / VIP / At Risk / Booking / Import) hiện ở ô Customer khi tạo order, danh sách tìm khách, Customer Information và Order History Detail. `normal` / không có dòng → không hiện badge.

## Điều kiện chung

- DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.99** (có #3317 + #3319), đã đăng nhập.
- Spec đổi setting `merchant_passcode_settings` của merchant → `@exclusive`; `before` chụp lại trạng thái, `after` trả lại đúng như cũ.
- Mã staff (env, mặc định merchant #14):
  - `VP4815_OWNER_CODE` (8888 – Merri 1, Owner), `VP4815_MANAGER_CODE` (9876 – Aubrey Shepard, Manager),
  - `VP4815_STAFF_CODE` (5559 – Pamela, Staff), `VP4815_PARTNER_CODE` (7775 – Ramona Dunn, Partner: chỉ có `quick_pay`).
- Khách: `VP4815_VIP_PHONE` (2052051122 – Tuti, VIP), `VP4815_SEARCH_NAME` ("QC Srch" — nhiều status trong 1 lần tìm), `VP4815_AT_RISK_NAME` ("UNKNOWN5560").
- Oracle: GraphQL `vCustomerTypeList{customerId type}`, `sysSettingList(key = merchant_passcode_settings)`.
- Trước mỗi lần dò gate phải xoá grant 30 phút (`volt-passcode-skip`), nếu không popup sẽ không hiện.
- Chạm thợ đang có pending order sẽ mở order đó, nên spec chọn thợ **không** có pending order.
- Scanner tra thẻ **remote** (`giftCardQueryByCode`), không tra `giftCardList` local; nút **Add Funds** nằm trong dialog **Gift card history**.

Chú thích: ✅ tự động được · ⚠️ được, có điều kiện · 🧱 chưa tự động được (lý do) · 📄 chỉ tài liệu · 🐞 bug đã log.

## 1. Quick Checkout

| TC ID        | Title                                              | Priority | Precondition                                   | Test Data                                                 | Steps                                                                                                         | Expected Result                                                                                   | Status |
| ------------ | -------------------------------------------------- | -------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4815-01 | Chọn thợ khi giỏ trống → hỏi passcode              | Critical | Bật Quick Checkout; giỏ trống                  | Thợ không có pending                                      | 1. Pending Orders → Quick Checkout. 2. Chạm 1 thợ                                                             | Hiện "Enter staff code to access Quick Checkout"; chưa tạo order                                  | ✅     |
| TC-VP4815-02 | Role Staff bị từ chối                              | Critical | Như TC-01, popup đang mở                       | `VP4815_STAFF_CODE`                                       | Nhập mã Staff                                                                                                 | "You don't have permission for this action"; popup vẫn mở; không có order                         | ✅     |
| TC-VP4815-03 | Owner qua được → tạo order                         | Critical | Như TC-02                                      | `VP4815_OWNER_CODE`                                       | Nhập mã Owner                                                                                                 | Popup đóng, có order mới với thợ vừa chạm                                                         | ✅     |
| TC-VP4815-04 | Order đang mở → chạm service không hỏi             | High     | Order của TC-03 đang mở                        | Service đầu tiên                                          | Chạm 1 service                                                                                                | Thêm service, không hỏi passcode                                                                  | ✅     |
| TC-VP4815-05 | Chọn khách khi giỏ trống → hỏi; Cancel → không tạo | High     | Giỏ trống                                      | Khách VIP (Tuti)                                          | 1. Tìm khách. 2. Chạm dòng khách. 3. Nhập mã Staff. 4. Bấm X                                                  | Hỏi Quick Checkout; Staff bị từ chối; đóng popup thì giỏ vẫn trống                                | ✅     |
| TC-VP4815-06 | Chạm service khi giỏ trống                         | Low      | Giỏ trống                                      | —                                                         | Chạm 1 service                                                                                                | "Select Staff First", không tạo order (không cần passcode)                                        | ✅     |
| TC-VP4815-07 | Scanner → Add Funds                                | Medium   | Bật Quick Checkout + Sell Gift Card; giỏ trống | Gift card active mà Scanner tra được (`VP4815_GIFT_CARD`) | Scanner → Input Gift Card Code → Confirm → Gift card history → **Add Funds** → mã Staff → mã Owner → mã Owner | Hỏi Quick Checkout (Staff bị từ chối), rồi Sell Gift Card, rồi mở Sell Gift Card với thẻ vừa quét | ✅     |

## 2. Quick Pay

| TC ID        | Title                                    | Priority | Precondition            | Test Data             | Steps                               | Expected Result                           | Status |
| ------------ | ---------------------------------------- | -------- | ----------------------- | --------------------- | ----------------------------------- | ----------------------------------------- | ------ |
| TC-VP4815-08 | Quick Pay hỏi passcode; Staff bị từ chối | High     | Bật Quick Pay; có order | `VP4815_STAFF_CODE`   | 1. Chạm Quick Pay. 2. Nhập mã Staff | Hỏi "…access Quick Pay"; Staff bị từ chối | ✅     |
| TC-VP4815-09 | Partner (có `quick_pay`) qua được        | High     | Như TC-08               | `VP4815_PARTNER_CODE` | Nhập mã Partner                     | Mở dialog Quick Pay                       | ✅     |

## 3. Sell Gift Card

| TC ID        | Title                                                   | Priority | Precondition                                   | Test Data                                  | Steps                                         | Expected Result                                                       | Status |
| ------------ | ------------------------------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------- | ------ |
| TC-VP4815-10 | Order đang mở: hỏi 1 lần, Staff bị từ chối, Manager qua | High     | Bật Sell Gift Card; có order                   | `VP4815_STAFF_CODE`, `VP4815_MANAGER_CODE` | 1. Chạm Gift Card. 2. Mã Staff. 3. Mã Manager | Chỉ hỏi "Sell Gift Card"; Staff bị từ chối; Manager mở Sell Gift Card | ✅     |
| TC-VP4815-11 | Giỏ trống + bật cả 2 gate → hỏi 2 lần                   | Medium   | Bật Quick Checkout + Sell Gift Card; giỏ trống | `VP4815_OWNER_CODE`                        | 1. Chạm Gift Card. 2. Mã Owner. 3. Mã Owner   | Lần 1 "Quick Checkout", lần 2 "Sell Gift Card", rồi mở Sell Gift Card | ✅     |

## 4. Edit Service Price

| TC ID        | Title                                     | Priority | Precondition                            | Test Data                | Steps                                            | Expected Result                                                  | Status |
| ------------ | ----------------------------------------- | -------- | --------------------------------------- | ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------- | ------ |
| TC-VP4815-12 | Chỉ sửa note → không hỏi                  | Medium   | Bật Edit Service Price; có dòng service | Note "VP4815 note only"  | Mở dòng → nhập note → Save                       | Lưu luôn, không hỏi passcode                                     | ✅     |
| TC-VP4815-13 | Đổi giá → hỏi; Staff từ chối; Manager lưu | Critical | Như TC-12                               | Giá −$5; Staff / Manager | Mở dòng → đổi giá → Save → mã Staff → mã Manager | Hỏi "…Edit Service Price"; Staff bị từ chối; Manager lưu giá mới | ✅     |

## 5. Calendar

| TC ID        | Title                                  | Priority | Precondition | Test Data           | Steps                           | Expected Result                                                         | Status |
| ------------ | -------------------------------------- | -------- | ------------ | ------------------- | ------------------------------- | ----------------------------------------------------------------------- | ------ |
| TC-VP4815-14 | Mở Appointment → hỏi; Staff bị từ chối | High     | Bật Calendar | `VP4815_STAFF_CODE` | Header → Appointment → mã Staff | Hỏi "…access Calendar"; "You don't have permission to access this page" | ✅     |
| TC-VP4815-15 | Owner mở được Calendar                 | High     | Như TC-14    | `VP4815_OWNER_CODE` | Nhập mã Owner                   | Vào Appointment Overview                                                | ✅     |

## 6. Tắt gate / màn Passcode Setting

| TC ID        | Title                                   | Priority | Precondition             | Test Data | Steps                                                          | Expected Result                                                                                            | Status |
| ------------ | --------------------------------------- | -------- | ------------------------ | --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4815-16 | Tắt cả 5 gate → không hỏi ở đâu cả      | Critical | Tắt 5 dòng + Save        | —         | Appointment; giỏ trống chạm thợ; đổi giá; Quick Pay; Gift Card | Không chỗ nào hỏi passcode                                                                                 | ✅     |
| TC-VP4815-17 | Passcode Setting có 4 dòng mới, Save OK | Medium   | Settings → Accessibility | —         | Mở Passcode Setting, đổi 1 dòng, Save                          | Có Quick Checkout / Sell Gift Card / Edit Service Price / Calendar; lưu xuống `merchant_passcode_settings` | ✅     |

## 7. Customer Status

| TC ID        | Title                    | Priority | Precondition          | Test Data                                   | Steps                          | Expected Result                                                          | Status                                           |
| ------------ | ------------------------ | -------- | --------------------- | ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------ |
| TC-VP4815-18 | Ô Customer khi tạo order | High     | Order có khách        | Khách VIP                                   | Gắn khách vào order            | Badge khớp `v_customer_type` (VIP)                                       | ✅                                               |
| TC-VP4815-19 | Danh sách tìm khách      | Medium   | —                     | `VP4815_SEARCH_NAME`, `VP4815_AT_RISK_NAME` | Gõ tên vào ô tìm khách         | Mỗi dòng có badge đúng type; khách `normal` không có badge; At Risk hiện | ✅                                               |
| TC-VP4815-20 | Customer Information     | High     | Order có khách VIP    | —                                           | Bấm bút sửa khách              | Tiêu đề "Customer Information" có badge VIP                              | ✅                                               |
| TC-VP4815-21 | Order History Detail     | High     | Khách có order đã trả | Order của khách `VP4815_SEARCH_NAME`        | Order History → tìm → mở order | Dòng Customer có badge đúng type                                         | ⚠️ cần 1 order đã thanh toán của khách có status |
