---
title: Re-Open đơn split payment — có Close Ticket (Re-Open Done), không bị ép Void — test cases
ticket: VP-4912 — https://linear.app/fastboy/issue/VP-4912/bug-ticket-1564743-re-open-order-sau-split-payment-khong-co-option
sub-issues: VP-5286, VP-5287
spec-files: tests/regression/order-flow/vp-4912-reopen-split-close-ticket.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [Bug] Re-Open order sau split payment không có option Close Ticket

**Ticket:** [VP-4912](https://linear.app/fastboy/issue/VP-4912/bug-ticket-1564743-re-open-order-sau-split-payment-khong-co-option) · CRM #1564743 · PR volt-pos#3172 (locked reopen giữ nguyên sale gốc)
**Sub-bug:** [VP-5286](https://linear.app/fastboy/issue/VP-5286) (re-open split chưa sửa gì vẫn bật popup Void, không có Re-Open Done, Subtotal/Tax bị tính lại) · [VP-5287](https://linear.app/fastboy/issue/VP-5287) (đổi staff / thông tin non-money vẫn bị ép Void All) — cả hai tái hiện trên **1.1.85**, **1.1.68** PASS.

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows (QC tay PASS trên **1.1.68** ngày 30/10/2026; **1.1.85** bị hồi quy → VP-5286 / VP-5287).
- Đã đăng nhập POS, đứng ở màn Home. Staff payment passcode **8888** (`VOLT_STAFF_CODE`).
- Fixture: staff `VOLT_TEST_STAFF` (Pamela), staff thứ 2 `VOLT_TEST_STAFF_2`, service `VOLT_TEST_SERVICE` / `VOLT_TEST_SERVICE_2`.
- Đơn split = Home → chọn staff + service → nút **Split** (cam, giữa Print và Pay) → **Equally** 2 check → mỗi check chọn tender → Pay → "Check N Paid Successfully" → **Complete Done**.
- Máy test **không có card terminal** (tender Card → Pay bị disable) → split dùng Cash + Other / Cash + Cash thay cho Card.
- Requirement chốt (comment 21–22/10): re-open đơn **split** chưa settle → **không** hiện popup "Void Order Transactions", **khoá sửa tiền** (không thêm/xoá service, không đổi giá), chỉ cho sửa non-money (staff, khách, note); có nút **Re-Open Done** (Close Ticket) để đóng ticket.
- Popup Re-Open của đơn split ghi: _"Items and prices are locked. Staff, customer and notes can still change."_
- Customer display hỏi tip trước mỗi lần thanh toán → chọn **No Tip**.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ có điều kiện · 🧱 chưa tự động được ở máy này · 📄 chỉ tài liệu.

## 1. Thanh toán split + Re-Open lần đầu

| TC ID        | Title                                                                     | Priority | Precondition                      | Test Data                                          | Steps                                                                                                     | Expected Result                                                                                                                 | Status |
| ------------ | ------------------------------------------------------------------------- | -------- | --------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4912-01 | Version POS test                                                          | Medium   | POS dev đang chạy                 | —                                                  | Menu ≡ → Version Update                                                                                   | Ghi lại version đang test (QC tay: 1.1.68 PASS; 1.1.85 FAIL)                                                                    | 📄     |
| TC-VP4912-02 | Split Equally 2 check Cash + Other → All checks paid → Payment Successful | Critical | Home, không có đơn nháp           | 1 service, check 1 Cash, check 2 Other "E2E Other" | 1. Tạo đơn. 2. Split → Equally (2 check). 3. Check 1 Cash → Pay. 4. Check 2 Other → Pay. 5. Complete Done | Hiện "All checks paid"; màn **Payment Successful!**; Order History: Successful - Unsettled, Payment Details có 1 Cash + 1 Other | ✅     |
| TC-VP4912-03 | Re-Open đơn split lần đầu (chưa sửa gì) → không popup Void                | Critical | Đơn TC-02                         | —                                                  | 1. Order History → mở đơn. 2. Re-Open Order → đọc popup. 3. Confirm (passcode)                            | Popup Re-Open có "Items and prices are locked"; vào checkout **không** bật popup "Void Order Transactions"                      | ✅     |
| TC-VP4912-04 | Re-Open đơn split → có nút Re-Open Done (Close Ticket)                    | Critical | Đang ở checkout re-open của TC-03 | —                                                  | Quan sát checkout re-open                                                                                 | Có nút **Re-Open Done** và bấm được                                                                                             | ✅     |
| TC-VP4912-05 | Bấm Re-Open Done (không sửa gì) → đóng ticket, không bị ép Void           | Critical | TC-04                             | —                                                  | 1. Re-Open Done (passcode nếu hỏi). 2. Xem lại chi tiết đơn                                               | Về Order History detail; Status **Successful - Unsettled**; vẫn đúng 1 Cash + 1 Other, không giao dịch nào bị void              | ✅     |
| TC-VP4912-06 | Subtotal/Tax giữ nguyên khi re-open đơn split                             | High     | Đơn TC-02                         | Subtotal/Tax đọc ở detail trước khi re-open        | 1. Ghi Subtotal/Tax ở detail. 2. Re-Open → checkout. 3. So Subtotal/Tax ở checkout. 4. Re-Open Done       | Subtotal và Tax ở checkout **bằng** lúc thanh toán (không bị tính lại kiểu $99.85 / $5.15 như VP-5286)                          | ✅     |

## 2. Khoá sửa tiền, cho sửa non-money

| TC ID        | Title                                                                   | Priority | Precondition | Test Data                     | Steps                                                                                             | Expected Result                                                                            | Status |
| ------------ | ----------------------------------------------------------------------- | -------- | ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| TC-VP4912-07 | Đơn split re-open: khoá sửa tiền (không thêm service)                   | High     | Đơn TC-02    | Service `VOLT_TEST_SERVICE_2` | 1. Re-Open → Edit Order (Home editor). 2. Bấm tile service khác. 3. Pay → Re-Open Done            | Tile service bị khoá, không thêm được dòng mới; Total trên Home không đổi                  | ✅     |
| TC-VP4912-08 | Đơn split re-open: đổi staff → Re-Open Done, không bị ép Void (VP-5287) | Critical | Đơn TC-02    | Staff mới `VOLT_TEST_STAFF_2` | 1. Re-Open → Edit Order. 2. Change Staff → staff 2 → Confirm. 3. Pay. 4. Re-Open Done             | Pay **không** bật popup Void; có Re-Open Done; detail hiện staff mới, vẫn 1 Cash + 1 Other | ✅     |
| TC-VP4912-09 | Tái hiện lần 2 với split Cash + Cash                                    | High     | Home         | Check 1 Cash, check 2 Cash    | 1. Tạo đơn split Cash + Cash. 2. Re-Open. 3. Kiểm tra popup / nút / Subtotal-Tax. 4. Re-Open Done | Không popup Void; có Re-Open Done; Subtotal/Tax giữ nguyên; detail vẫn 2 Cash              | ✅     |
| TC-VP4912-10 | Đối chứng: đơn thanh toán 1 lần → Re-Open bình thường                   | Medium   | Home         | 1 service, Cash               | 1. Tạo + trả Cash 1 lần. 2. Re-Open. 3. Re-Open Done                                              | Không popup Void; có Re-Open Done; Subtotal/Tax giữ nguyên; Successful - Unsettled         | ✅     |

## 3. Sub-bug VP-5286 / VP-5287 (1.1.85)

| TC ID        | Title                                                                                | Priority | Precondition         | Test Data                  | Steps                                                                        | Expected Result                                                                                                       | Status |
| ------------ | ------------------------------------------------------------------------------------ | -------- | -------------------- | -------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4912-11 | VP-5286: re-open split → Edit Order → Pay lại (không sửa gì) vẫn không popup Void    | Critical | Đơn TC-02            | —                          | 1. Re-Open → Edit Order. 2. Không sửa gì, bấm Pay. 3. Re-Open Done           | Checkout **không** bật "Void Order Transactions"; Complete Payment không bị ép, có Re-Open Done; giao dịch giữ nguyên | ✅     |
| TC-VP4912-12 | VP-5287: re-open split → sửa Order Note (non-money) → lưu được, không bị ép Void All | High     | Đơn TC-02            | Note `QC VP4912 <rand>`    | 1. Re-Open → Edit Order. 2. Note → nhập note → Save. 3. Pay. 4. Re-Open Done | Không popup Void; Re-Open Done đóng ticket; detail có Order Note mới; vẫn 1 Cash + 1 Other                            | ✅     |
| TC-VP4912-13 | Split có leg Card (Card + Cash) → Re-Open → có Re-Open Done                          | High     | Máy có card terminal | Check 1 Card, check 2 Cash | 1. Split Card + Cash. 2. Re-Open. 3. Re-Open Done                            | Như TC-03…05 (không popup Void, có Re-Open Done, giữ giao dịch Card)                                                  | 🧱     |

## Kết quả test tay

- 30/10/2026 sáng, **1.1.85**: FAIL 6/10 → VP-5286, VP-5287 (Backlog).
- 30/10/2026 17:16–17:25, **1.1.68**: PASS 8/8 (TC-02 → TC-09; TC-10 cũ "Void All → trả lại → Re-Open" không cần vì 1.1.68 không còn ép Void). Đơn OD261030-37013950 (Cash $52.49 + Other $52.51), OD261030-37253988 (Cash + Cash).

## Ghi chú automation

- TC-13 cần card terminal (máy này Card → Pay disable) → PENDING.
- TC-01 chỉ ghi version → PENDING.
- Mỗi lần chạy tạo 3 đơn đã thanh toán (split Cash+Other, split Cash+Cash, Cash) trên merchant 14 — để Successful - Unsettled.
- Chạy: `npm run test:attach -- --spec tests/regression/order-flow/vp-4912-reopen-split-close-ticket.spec.ts`
