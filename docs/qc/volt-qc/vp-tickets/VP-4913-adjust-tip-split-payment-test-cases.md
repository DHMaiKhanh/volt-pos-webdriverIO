---
title: Adjust Tip sau Split Payment — cho chọn nguồn tiền thu tip — test cases
ticket: VP-4913 — https://linear.app/fastboy/issue/VP-4913/improvement-ticket-1564780-adjust-tip-sau-split-payment-cho-chon-nguon
spec-files: tests/regression/order-flow/vp-4913-adjust-tip-split-payment.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [Improvement] Adjust Tip sau split payment cho chọn nguồn tiền

**Ticket:** [VP-4913](https://linear.app/fastboy/issue/VP-4913/improvement-ticket-1564780-adjust-tip-sau-split-payment-cho-chon-nguon) · CRM #1564780 · PR volt-pos#3163 ("Adjust Tip on Payment Success lets the cashier pick the payment")
**Dev:** Ngan Huynh · **Sub-issue:** không có.

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows (QC tay PASS 9/9 trên **1.1.62** ngày 26/10/2026).
- Merchant bật **tip sau thanh toán** (Adjust Tip chỉ hiện khi đơn unsettled + có tender adjust được).
- Đơn split = Home → staff + service → nút **Split** → Equally → mỗi check chọn tender → Pay → Complete Done → màn **Payment Successful!** có link **Adjust Tip**.
- Đơn ≥ 2 payment adjust được → bấm Adjust Tip mở popup **"Adjust Order Tip"** liệt kê từng payment (mỗi dòng có nút Adjust Tip riêng); đơn 1 payment → mở thẳng keypad (dialog "Current Tip").
- Keypad Adjust Tip gõ theo **cent**: gõ `1000` = $10.00, `500` = $5.00 (phím đầu thay giá trị cũ).
- Gift Card **không** adjust tip được → không nằm trong danh sách.
- Máy test **không có card terminal** (Card → Pay disable) → split dùng Cash + Other (+ Gift Card).
- Customer display hỏi tip trước mỗi check → **No Tip**. Staff passcode **8888**.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ có điều kiện · 🧱 chưa tự động được ở máy này · 📄 chỉ tài liệu.

## 1. Payment Success sau split

| TC ID        | Title                                 | Priority | Precondition                | Test Data                                    | Steps                                                       | Expected Result                                                                                                  | Status |
| ------------ | ------------------------------------- | -------- | --------------------------- | -------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4913-01 | Hiện nút Adjust Tip sau Split Payment | High     | Tip sau thanh toán đang bật | 1 service, 2 check: Cash + Other "E2E Other" | Split Order → trả 2 check → Complete Done → Payment Success | Màn Payment Success hiện link **Adjust Tip**                                                                     | ✅     |
| TC-VP4913-02 | Adjust Tip cho chọn nguồn tiền        | High     | TC-01                       | Như TC-01                                    | Bấm Adjust Tip                                              | Popup **"Adjust Order Tip"** liệt kê cả Cash và Other (2 nút Adjust Tip), không tự cộng tip vào payment đầu tiên | ✅     |
| TC-VP4913-03 | Tip vào đúng payment Other            | High     | TC-02                       | Tip $10 (gõ `1000`)                          | Adjust Tip ở dòng Other → nhập 10.00 → Save                 | Dòng Other: "+ $10.00 Tip"; dòng Cash không có tip                                                               | ✅     |
| TC-VP4913-04 | Tip vào đúng payment Cash             | High     | TC-03                       | Tip $5 (gõ `500`)                            | Adjust Tip ở dòng Cash → nhập 5.00 → Save                   | Dòng Cash: "+ $5.00 Tip"; dòng Other giữ "+ $10.00 Tip"                                                          | ✅     |

## 2. Order History

| TC ID        | Title                                        | Priority | Precondition | Test Data     | Steps                               | Expected Result                                                                                 | Status |
| ------------ | -------------------------------------------- | -------- | ------------ | ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| TC-VP4913-05 | Order History hiển thị tip theo từng payment | High     | TC-04        | Đơn của TC-01 | No Receipt → Order History → mở đơn | Tip **$15.00**, staff "<staff> - $15.00"; Payment Details có tip $5.00 (Cash) và $10.00 (Other) | ✅     |
| TC-VP4913-06 | Adjust Tip ở Order History vẫn hoạt động     | Medium   | TC-05        | Như TC-05     | Order History → Adjust Tip          | Popup "Adjust Order Tip" liệt kê đúng 2 payment với tip hiện tại (Cash $5.00, Other $10.00)     | ✅     |

## 3. Trường hợp khác

| TC ID        | Title                                                                      | Priority | Precondition                                         | Test Data                                     | Steps                                          | Expected Result                                                             | Status |
| ------------ | -------------------------------------------------------------------------- | -------- | ---------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| TC-VP4913-07 | Đơn 1 payment mở keypad trực tiếp                                          | Medium   | —                                                    | 1 service, Cash                               | Thanh toán Cash → Payment Success → Adjust Tip | Mở thẳng keypad Adjust Tip (Current Tip $0.00), không có popup chọn payment | ✅     |
| TC-VP4913-08 | Gift Card không nằm trong danh sách, nút vẫn hiện khi check 1 là Gift Card | High     | Gift card `VOLT_TEST_GIFT_CARD` còn đủ số dư 1 check | 3 check: Gift Card + Cash + Other "E2E Other" | Split 3 check → Payment Success → Adjust Tip   | Nút Adjust Tip vẫn hiện; popup chỉ có Cash và Other, không có Gift Card     | ⚠️     |
| TC-VP4913-09 | Version POS                                                                | Medium   | —                                                    | —                                             | Menu → Version Update                          | Ghi lại version (QC tay: 1.1.62, "You're Up to Date")                       | 📄     |
| TC-VP4913-10 | Split có Card payment → chọn Card để adjust tip                            | High     | Máy có card terminal                                 | Card + Cash                                   | Split → trả Card → Adjust Tip                  | Popup liệt kê Card, adjust tip vào Card được                                | 🧱     |

## Kết quả test tay (26/10/2026, POS Windows 1.1.62)

9 PASS / 0 FAIL / 1 chưa test (TC-10 — máy không có card terminal). Đơn: OD261026-36469109 (Cash $31.49 + Other $31.51), OD261026-36791082 (Cash 1 lần), OD261026-36873074 (Gift Card + Cash + Other).

## Ghi chú automation

- TC-08 skip khi không có `VOLT_TEST_GIFT_CARD` / `GIFT_CARD_CODE`; fail rõ ràng nếu gift card hết số dư ("Gift card not accepted").
- TC-09 chỉ ghi version, TC-10 cần card terminal → PENDING.
- Mỗi lần chạy tạo 3 đơn đã thanh toán + tip $15 trên đơn split.
- Chạy: `npm run test:attach -- --spec tests/regression/order-flow/vp-4913-adjust-tip-split-payment.spec.ts`
