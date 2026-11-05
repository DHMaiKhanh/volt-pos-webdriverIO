---
title: Màn khách "No, enter again" — gỡ khách bị từ chối khỏi order bên staff — test cases
ticket: VP-5195 — https://linear.app/fastboy/issue/VP-5195/pos-customer-display-no-enter-again-leaves-the-rejected-customer
sub-issues: VP-5711 — https://linear.app/fastboy/issue/VP-5711/poscustomer-display-sau-khi-khach-bam-no-enter-again-the-pending-order
spec-files: tests/regression/customer-display/vp-5195-phone-reject.spec.ts
imported-at: 2026-11-05
updated-at: 2026-11-05
---

# Test Cases – [POS] [Customer Display] "No, enter again" leaves the rejected customer attached to the staff order

**Ticket:** [VP-5195](https://linear.app/fastboy/issue/VP-5195/pos-customer-display-no-enter-again-leaves-the-rejected-customer) · project Maintenance 2026-Q4 · parent VP-5122
**Dev:** Ngan Huynh (`ngan_huynh`) · PR FastboyMarketing/volt-pos#3250 (vào `vp-5122`) → #3258 (vào `develop`, 04/11)
**Sub-bug:** [VP-5711](https://linear.app/fastboy/issue/VP-5711/poscustomer-display-sau-khi-khach-bam-no-enter-again-the-pending-order) — sau "No", thẻ Pending Order + `total` lưu trong order vẫn là tổng cũ
**Trạng thái:** Todo — test tay trên dev 1.1.98 (05/11/2026): 9/10 PASS, 1 FAIL (TC-06 → VP-5711).

## Hành vi mong đợi (PO chốt 29/10)

1. Khách bấm **No, enter again** → **tự động gỡ khách khỏi order**, báo cho thu ngân bằng toast
   "The customer said this is not their number, so they were removed from the order." / VI "Khách xác nhận đây không phải số của mình, đã xoá khách hàng khỏi đơn.", và mở lại keypad tìm khách bên staff.
2. Gỡ khách xử lý **giống hệt** khi thu ngân tự gỡ bằng tay: gỡ reward + promotion gắn với khách, **giữ** custom discount.
3. Áp dụng cho màn khách Windows, semi và D5 (dùng chung `rejectCustomerPhone`).
4. Nút "No, enter again" không hiện khi đang thanh toán (`isPaying`) hoặc order reopen (`isReopen`).

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.98** (có PR #3258), cửa sổ khách `/customer/` mở.
- 2 khách có SĐT duy nhất và có điểm: `VP5195_PHONE_A` (mặc định 2052051122 – Tuti), `VP5195_PHONE_B` (mặc định 0250251234 – Kong). Không dùng số bị trùng nhiều khách (vd 2052052052).
- Promotion / reward của khách A: `VP5195_PROMOTION` (mặc định "Remind after 15 days not visit"), `VP5195_REWARD` (mặc định "Reward 10%").
- Passcode staff 8888 cho Apply Discount (Promo & Rewards).
- Oracle DB: GraphQL `orderList(where:{orderCode:{eq}}){customerId redeemId campaignId total}`, `customerList(where:{phone:{eq}}){pointBalance}`.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được ở đây · 🐞 đang FAIL do bug đã log.

## 1. Khách bấm "No, enter again"

| TC ID        | Title                                 | Priority | Precondition                | Test Data | Steps                                                                                                   | Expected Result                                                                                                                                  | Status |
| ------------ | ------------------------------------- | -------- | --------------------------- | --------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| TC-VP5195-01 | No → staff gỡ khách, toast, mở keypad | Critical | Order có staff + dịch vụ    | Khách A   | 1. Staff nhập SĐT A → Done. 2. Màn khách "Is this your phone number?". 3. Khách bấm **No, enter again** | Thẻ khách trên order biến mất, keypad "Phone, name or email" mở lại; toast "The customer said this is not their number…"; DB `customerId = null` | ✅     |
| TC-VP5195-02 | Màn khách sau khi bấm No              | High     | Như TC-01                   | —         | Xem màn khách sau bước 3                                                                                | Về keypad "Enter Customer Phone" trống, cart (Order Details) vẫn hiện, không rơi về Welcome                                                      | ✅     |
| TC-VP5195-03 | Khách nhập số khác sau khi No         | High     | Đã bấm No                   | Khách B   | Khách nhập SĐT B trên màn khách → Done                                                                  | Order gắn B, không còn A; màn khách "Check-in Successful" với điểm của B                                                                         | ✅     |
| TC-VP5195-04 | Khách nhập lại đúng số vừa từ chối    | Medium   | Đã bấm No                   | Khách A   | Khách nhập lại SĐT A → Done                                                                             | Order gắn lại A, check-in thành công                                                                                                             | ✅     |
| TC-VP5195-05 | Khách bấm Yes (regression)            | High     | Màn khách đang hỏi xác nhận | Khách A   | Khách bấm **Yes**                                                                                       | Giữ A trên order, không có toast từ chối, check-in thành công                                                                                    | ✅     |

## 2. Reward / promotion / custom discount khi gỡ khách

| TC ID        | Title                                        | Priority | Precondition                                                   | Test Data            | Steps                                                                         | Expected Result                                                                                                                                | Status     |
| ------------ | -------------------------------------------- | -------- | -------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TC-VP5195-06 | No khi order có promotion + reward của khách | Critical | Staff gắn A, khách chưa trả lời; áp promotion + reward → Apply | A, promotion, reward | 1. Ghi tổng trước. 2. Khách bấm No. 3. Xem panel order, thẻ Pending Order, DB | DB `redeemId`, `campaignId` = null; panel không còn "Reward Redemption"; **thẻ Pending Order và `total` DB = Total trên panel** (giống gỡ tay) | 🐞 VP-5711 |
| TC-VP5195-07 | No khi order có custom discount + reward     | High     | Gắn A; Custom Discount 10% + reward → Apply                    | A, 10%, reward       | Khách bấm No                                                                  | Reward bị gỡ, dòng "Promotion" (custom discount) vẫn còn                                                                                       | ✅         |
| TC-VP5195-08 | Thu ngân tự gỡ khách (code dùng chung)       | Medium   | Gắn A + promotion + reward, khách bấm Yes                      | A                    | Bấm X trên thẻ khách → Remove                                                 | Gỡ khách + promotion + reward; thẻ Pending Order = Total panel ngay                                                                            | ✅         |

## 3. Khoá nút No và thanh toán

| TC ID        | Title                                       | Priority | Precondition                 | Test Data       | Steps                                  | Expected Result                                                                | Status |
| ------------ | ------------------------------------------- | -------- | ---------------------------- | --------------- | -------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| TC-VP5195-09 | Bấm Pay khi khách chưa trả lời              | Medium   | Màn khách đang hỏi xác nhận  | A               | Staff bấm **Pay**                      | Màn khách không còn nút "No, enter again" (chuyển check-in / khoá)             | ✅     |
| TC-VP5195-10 | Thanh toán sau khi No — không cộng điểm sai | Critical | Khách bấm No, không nhập lại | A, Cash, No Tip | Pay → Cash → Complete Payment → No Tip | Order thanh toán là Unknown (`customerId = null`); điểm A không đổi            | ✅     |
| TC-VP5195-11 | Order reopen: không có nút No               | Medium   | Order đã thanh toán có khách | —               | Order History → Re-Open                | Màn khách không hiện "No, enter again" (đã có ở `cd-phone.spec.ts` CD-028)     | ⚠️     |
| TC-VP5195-12 | Toast tiếng Việt                            | Low      | POS Language = Tiếng Việt    | A               | Lặp TC-01                              | Toast "Khách xác nhận đây không phải số của mình, đã xoá khách hàng khỏi đơn." | 🧱     |
| TC-VP5195-13 | Màn khách semi / D5                         | High     | Máy semi / D5 (Android)      | A               | Lặp TC-01 trên semi, D5                | Như TC-01                                                                      | 🧱     |

## Ghi chú automation

- Spec tạo order mới mỗi case và xoá order nháp sau case (`resetTill`); TC-10 thanh toán thật bằng Cash.
- TC-06 gắn `@broken` cho tới khi VP-5711 được fix — bỏ tag khi fix xong.
- TC-11, TC-12, TC-13 là PENDING: **đã comment lại trong spec** (không còn `it` rỗng) nên lần chạy không báo SKIP — kết quả chỉ có 10 TC PASS/FAIL.
- TC-11 đã có ở `tests/regression/volt-qc/cd-e2e/cd-phone.spec.ts` (CD-028).
- 🧱 TC-12: đổi ngôn ngữ app là state toàn merchant (`@exclusive`) → test tay.
- 🧱 TC-13: semi / D5 là máy Android, không chạy được trên lane Windows.

Chạy: `npm run test:attach -- --spec tests/regression/customer-display/vp-5195-phone-reject.spec.ts`
