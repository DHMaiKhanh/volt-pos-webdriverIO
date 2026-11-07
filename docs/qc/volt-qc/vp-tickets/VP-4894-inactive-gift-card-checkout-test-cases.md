---
title: Gift card Inactive / chưa bán còn số dư phải bị chặn ở checkout — test cases
ticket: VP-4894 — https://linear.app/fastboy/issue/VP-4894/inactive-unsold-gift-card-with-a-balance-is-accepted-at-checkout-needs
sub-issues: VP-6056 — https://linear.app/fastboy/issue/VP-6056/posgift-card-the-inactive-van-hien-gift-card-accepted-khi-nhap-ma-o
spec-files: tests/regression/order-flow/vp-4894-inactive-gift-card.spec.ts
imported-at: 2026-11-06
updated-at: 2026-11-06
---

# Test Cases – Inactive / unsold gift card with a balance is accepted at checkout

**Ticket:** [VP-4894](https://linear.app/fastboy/issue/VP-4894/inactive-unsold-gift-card-with-a-balance-is-accepted-at-checkout-needs) · project Maintenance 2026-Q4-M11-W1
**Dev:** PR FastboyMarketing/volt-pos#3356 "[POS] [P8D] [VP-4894] fix: refuse inactive / unsold gift cards at payment"
**Sub-bug:** [VP-6056](https://linear.app/fastboy/issue/VP-6056/posgift-card-the-inactive-van-hien-gift-card-accepted-khi-nhap-ma-o) — 1.1.104 thẻ Inactive vẫn vào màn Gift Card Accepted (đã fix ở 1.1.106)
**Trạng thái:** QC Completed — test tay 06/11/2026: 1.1.104 FAIL → 1.1.106 PASS. Tự động 06/11 trên 1.1.106 (`MERCHANT_ID=20258`): 6 PASS / 0 FAIL.

## Hành vi mong đợi

1. Nhập / scan mã gift card có trạng thái **khác active** (Inactive, Initial / Not sold yet) mà còn số dư → báo lỗi
   **ngay sau khi tra thẻ** ("Gift card is inactive" + nút **Scan Again**), KHÔNG hiển thị màn **Gift Card Accepted**, không có nút **Pay**.
2. Thẻ **active** còn số dư vẫn được chấp nhận như cũ (Gift Card Accepted + Pay).

## Điều kiện chung

- Môi trường DEV, merchant **20258** (catalog `src/data/static/giftCards.json`), POS Windows **≥ 1.1.106**, LAUNCH lane
  (cửa sổ khách `/customer/` cần cho bước tip "Customer is adding a tip").
- Thẻ inactive thật còn số dư ($125.45): `937833424784`, `028403306731`, `851713032980` (`inactiveGiftCards`).
- Thẻ active còn số dư: thẻ giàu nhất trong `fundedActiveGiftCards`.
- Tiệm 20258 hiện **không có thẻ Initial** → case Initial giả lập kết quả tra thẻ (`giftCardQueryByCode`) bằng stub
  `installGiftCardStub` (status `initial`, số dư $50) — chỉ thay câu trả lời tra thẻ, phần UI là app thật. Từ 1.1.106 `__TAURI_INTERNALS__.invoke` không ghi đè được → stub wrap `fetch` tới `ipc.localhost/graphql`.
- `.env.dev` đang để `MERCHANT_ID=14` → chạy spec này với `MERCHANT_ID=20258` (catalog chỉ bật cho 20258).
- Passcode staff 8888 (Complete Payment có thể hỏi passcode). Không bấm **Pay** → không trừ tiền thẻ nào.

Chú thích trạng thái: ✅ tự động được · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được (lý do) · 📄 chỉ tài liệu · 🐞 bug đã log.

## 1. Thẻ không active bị chặn khi tra thẻ

| TC ID        | Title                                      | Priority | Precondition                                 | Test Data                         | Steps                                                                                           | Expected Result                                                                             | Status |
| ------------ | ------------------------------------------ | -------- | -------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| TC-VP4894-01 | Nhập mã thẻ Inactive còn số dư             | Critical | Order có dịch vụ, ở checkout                 | 937833424784 (inactive, $125.45)  | 1. Gift Card → Complete Payment (passcode, No Tip) 2. Input Gift Card Code 3. Nhập mã → Confirm | Hiện "Gift card is inactive" + Scan Again; không có "Gift Card Accepted", không có nút Pay  | ✅     |
| TC-VP4894-02 | Mọi thẻ Inactive trong catalog đều bị chặn | High     | Như TC-01                                    | `inactiveGiftCards` (3 thẻ)       | Lặp TC-01 cho từng thẻ (Scan Again giữa các lần)                                                | Mỗi thẻ đều bị chặn như TC-01                                                               | ✅     |
| TC-VP4894-03 | Thẻ Initial / Not sold yet còn số dư       | High     | Như TC-01; stub tra thẻ trả status `initial` | Mã bất kỳ, status initial, $50.00 | Như TC-01                                                                                       | Không vào màn Gift Card Accepted, không có Pay, có Scan Again (báo lỗi thẻ không dùng được) | ⚠️     |
| TC-VP4894-04 | Scan Again sau khi bị từ chối              | Medium   | Đang ở màn "Gift card is inactive"           | —                                 | Bấm Scan Again → Input Gift Card Code                                                           | Quay lại màn nhập mã, ô nhập trống, nhập được mã khác                                       | ✅     |

## 2. Regression thẻ active và lớp chặn server

| TC ID        | Title                                   | Priority | Precondition | Test Data                   | Steps                     | Expected Result                                                         | Status |
| ------------ | --------------------------------------- | -------- | ------------ | --------------------------- | ------------------------- | ----------------------------------------------------------------------- | ------ |
| TC-VP4894-05 | Thẻ Active còn số dư vẫn được chấp nhận | Critical | Như TC-01    | Thẻ funded active giàu nhất | Như TC-01 (không bấm Pay) | Hiện "Gift Card Accepted", có nút Pay, không có "Gift card is inactive" | ✅     |
| TC-VP4894-06 | Mã không tồn tại vẫn báo "not valid"    | Medium   | Như TC-01    | `INVALID_GIFT_CARD_CODE`    | Như TC-01                 | Hiện "Gift card is not valid", không lẫn với thông báo inactive         | ✅     |
