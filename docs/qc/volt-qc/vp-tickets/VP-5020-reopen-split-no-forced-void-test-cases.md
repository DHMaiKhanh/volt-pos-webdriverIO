---
title: Re-Open đơn split không còn bị ép Void All — test cases
ticket: VP-5020 — https://linear.app/fastboy/issue/VP-5020/re-open-on-windows-always-forces-void-all-for-a-split-order-completed
sub-issues: VP-5297 (lệch Subtotal 1 cent, QC Completed 06/11)
spec-files: tests/regression/order-flow/vp-5020-reopen-split-no-forced-void.spec.ts
imported-at: 2026-11-07
updated-at: 2026-11-07
---

# Test Cases – Re-Open on Windows always forces Void All for a split order

**Ticket:** [VP-5020](https://linear.app/fastboy/issue/VP-5020/re-open-on-windows-always-forces-void-all-for-a-split-order-completed) · sub-task VP-5297 · liên quan VP-4912, VP-4405, PR #2175 (VP-2585 one-time edit)
**Trạng thái:** QC Completed — test tay trên dev **1.1.108** (06/11/2026): 7/7 PASS (đơn OD261106-38329409, Card $86.52 + Cash $84.00).

## Hành vi mong đợi

1. Đơn đã **split và thanh toán đủ** (Successful - Unsettled) khi **Re-Open Order → Confirm** vào màn Edit Order
   **không** bật popup "Void Order Transactions" nếu chưa sửa gì.
2. Màn Edit giữ các check đã trả: Total Paid = Total, Remaining $0.00, có nút **Re-Open Done**.
3. Subtotal / Tax / Total ở màn Edit khớp Order Details.
4. **Re-Open Done** khi không sửa gì: đóng lại được order, giữ nguyên các giao dịch (không có giao dịch Voided), số tiền không đổi.
5. Chỉnh những gì được phép (đổi staff) rồi Re-Open Done cũng **không** bị ép void.
6. Áp dụng cho cả split Cash + Cash và Card + Cash.

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows dev **bản mới nhất** trên feed, cửa sổ khách `/customer/` mở (tip hỏi ở màn khách → No Tip).
- 2 service `VOLT_TEST_SERVICE` / `VOLT_TEST_SERVICE_2` (mặc định Express Pedicure / Lavender Treatment), staff `VOLT_TEST_STAFF` (mặc định Pamela).
- Card + Cash: staff `VP5020_CARD_STAFF` (mặc định Zelene Doyle), service `VP5020_CARD_SERVICE` (mặc định Dark Queen),
  cần terminal kết nối (header Devices › Terminal Connected) và `CARD_SETTLE=1`.
- Passcode staff tiệm 14: 8888 (`VOLT_STAFF_CODE`).
- Ghi dữ liệu thật (tạo + thanh toán + re-open đơn) → chỉ dev / staging, `WRITE_ALLOWED` bật.

Chú thích trạng thái: ✅ tự động được · ⚠️ tự động được, có điều kiện (terminal + CARD_SETTLE).

## 1. Split Cash + Cash (đúng các bước của ticket)

| TC ID        | Title                                              | Priority | Precondition          | Test Data                             | Steps                                                                                                                            | Expected Result                                                                                           | Status        |
| ------------ | -------------------------------------------------- | -------- | --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| TC-VP5020-02 | Split Equally 2 service Cash + Cash → Complete     | High     | Home, không có đơn mở | 2 service, check 1 Cash, check 2 Cash | 1. Quick Checkout → staff → 2 service. 2. Split → Equally. 3. Check 1 Cash, check 2 Cash (No Tip). 4. Complete Done → No Receipt | Order History: Successful - Unsettled, Payment Details có 2 giao dịch Cash                                | ✅ PASS 07/11 |
| TC-VP5020-03 | Re-Open không sửa gì → không bật Void              | Critical | TC-02                 | Đơn TC-02                             | Order History → Re-Open Order → Confirm → đợi 5s                                                                                 | Không có popup "Void Order Transactions"; có nút **Re-Open Done**                                         | ✅ PASS 07/11 |
| TC-VP5020-04 | Màn Edit giữ các check đã trả                      | Critical | TC-03                 | Đơn TC-02                             | Đọc màn checkout re-open                                                                                                         | Total Paid = Total của đơn, Remaining $0.00                                                               | ✅ PASS 07/11 |
| TC-VP5020-05 | Subtotal / Tax / Total màn Edit khớp Order Details | High     | TC-03                 | Đơn TC-02                             | So panel phải màn Edit với Order Details                                                                                         | Subtotal, Tax, Total bằng đúng Order Details (không lệch cent)                                            | ✅ PASS 07/11 |
| TC-VP5020-06 | Re-Open Done không sửa gì → giữ nguyên giao dịch   | Critical | TC-03                 | Đơn TC-02                             | Bấm Re-Open Done → mở lại Order Details                                                                                          | Successful - Unsettled, vẫn 2 giao dịch Cash, không có giao dịch Voided, Subtotal / Tax / Total không đổi | ✅ PASS 07/11 |
| TC-VP5020-07 | Re-Open lần 2 → vẫn không bị ép Void               | High     | TC-06                 | Đơn TC-02                             | Re-Open Order → Confirm → Re-Open Done                                                                                           | Không popup Void, có Re-Open Done; sau Done vẫn 2 giao dịch Cash, số tiền không đổi                       | ✅ PASS 07/11 |
| TC-VP5020-08 | Đổi staff khi Re-Open → không bị ép Void           | High     | TC-07                 | Đơn TC-02, staff khác staff hiện tại  | 1. Re-Open → Confirm. 2. Edit Order → Change Staff → chọn staff khác → Confirm. 3. Pay → Re-Open Done                            | Không popup Void; Order Details hiện staff mới, vẫn 2 giao dịch Cash, không Voided, Total không đổi       | ✅ PASS 07/11 |

## 2. Split Card + Cash

| TC ID        | Title                                              | Priority | Precondition                      | Test Data                              | Steps                                                                                               | Expected Result                                                                                                   | Status        |
| ------------ | -------------------------------------------------- | -------- | --------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| TC-VP5020-09 | Split Card + Cash → Re-Open không bật Void         | Critical | Terminal Connected, CARD_SETTLE=1 | Dark Queen, check 1 Card, check 2 Cash | 1. Split Equally: check 1 Card (No Tip, ký tên), check 2 Cash → Complete Done. 2. Re-Open → Confirm | Không popup Void; Total Paid = Total, Remaining $0.00, có Re-Open Done; Subtotal / Tax / Total khớp Order Details | ⚠️ PASS 07/11 |
| TC-VP5020-10 | Re-Open Done đơn Card + Cash → giữ 1 Card + 1 Cash | High     | TC-09                             | Đơn TC-09                              | Re-Open Done → mở lại Order Details                                                                 | Successful - Unsettled, 1 Card + 1 Cash, không Voided, số tiền không đổi                                          | ⚠️ PASS 07/11 |

## Kết quả chạy spec (07/11/2026, POS 1.1.108 — bản mới nhất trên feed)

Lệnh: `npm run test:attach -- --spec tests/regression/order-flow/vp-5020-reopen-split-no-forced-void.spec.ts` (2′24″).

- **Lượt 1 (10:23):** TC-02 → TC-08 PASS (split Cash + Cash 2 service, Re-Open 2 lần, đổi staff — không lần nào bị ép Void).
  TC-09 / TC-10 SKIP vì header Devices báo "Terminal Not Connected" (POS vừa đăng nhập lại).
- **Lượt 2 (10:29, sau khi bật terminal):** `--mochaOpts.grep "TC-VP5020-09|TC-VP5020-10"` → TC-09, TC-10 PASS (charge thẻ thật, 1′41″).
- **Tổng: 9/9 PASS.** (07/11 bỏ TC-01 ghi version và TC-11 đơn split từ P8D theo yêu cầu.)
