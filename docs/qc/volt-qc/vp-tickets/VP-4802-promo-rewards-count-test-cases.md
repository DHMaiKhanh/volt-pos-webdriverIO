---
title: Hiển thị tổng Promotion và Reward khả dụng trên nút Promo & Rewards (POS) — test cases
ticket: VP-4802 — https://linear.app/fastboy/issue/VP-4802/hien-thi-tong-promotion-va-reward-kha-dung-khi-tao-order
spec-files: tests/regression/order-flow/vp-4802-promo-rewards-count.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – Hiển thị tổng Promotion và Reward khả dụng khi tạo order

**Ticket:** [VP-4802](https://linear.app/fastboy/issue/VP-4802/hien-thi-tong-promotion-va-reward-kha-dung-khi-tao-order) · PR volt-pos#3109 · trạng thái **QC Completed** (11/11 PASS trên dev 1.1.57, 26/10/2026)
**Liên quan:** catalog CO-ORD-05 (`docs/screens/order-flow/create-order-master-catalog.md`), dòng VP-4802 trong `docs/qc/linear-pos-testcase-catalog.md`
**Sub-issue:** không có (02/11/2026).

## Điều kiện chung

- Môi trường DEV, POS Windows ≥ 1.1.57, merchant #14, đứng ở Home.
- Badge = số đỏ ở góc nút **Promo & Rewards** trên màn Create Order (`data-testid="promo-rewards-count"`):
  **số promotion chưa dùng, còn hạn của khách + số reward có `point ≤ điểm của khách`**; không có badge khi tổng = 0; > 99 hiện **"99+"**; order chỉ có gift card → 0.
- Số kỳ vọng được tính lại bằng GraphQL nội bộ của POS (chỉ đọc) đúng như app query: `campaignCustomerList` (isUsed = false, campaign còn hạn) → `campaignList`; `redeemList` (point ≤ điểm khách đọc trên thanh khách "Point: N"). Không hard-code 10/5/3 như lúc test tay vì dữ liệu dev thay đổi.
- Khách test: `VP4802_CUSTOMER_PHONE` (khách **có ≥ 1 promotion**, như "hihi"/"finally"), mặc định `LOYALTY_CUSTOMER_PHONE`. Khách chỉ có điểm: `VP4802_POINTS_CUSTOMER_PHONE` (mặc định cùng số).
- Gift card: thẻ Active `VOLT_TEST_GIFT_CARD` (chỉ thêm dòng top-up rồi xoá order, không thanh toán).
- Khách mới 0 điểm được tạo bằng số điện thoại ngẫu nhiên `832…` (mỗi lần chạy để lại 1 khách test).

Chú thích trạng thái: ✅ đã test tay PASS (26/10, 1.1.57) và tự động được · ⚠️ tự động được nhưng có điều kiện dữ liệu · 🧱 không tự động được ở máy này (cần Portal / dữ liệu không có trên dev) · 📄 chỉ tài liệu.

## 1. Có / không có khách

| TC ID        | Title                                  | Priority | Precondition                                        | Test Data                      | Steps                                                                              | Expected Result                                                                                       | Status |
| ------------ | -------------------------------------- | -------- | --------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4802-01 | Order không có khách: không có số      | High     | Tạo order mới (QC: PR-01)                           | Staff test + Quick Pay $10     | 1. Quick Checkout. 2. Chọn staff + 1 dòng, không nhập khách. 3. Mở Promo & Rewards | Nút **không có badge**; dialog báo **"No promotions available"** và **"No rewards available"**        | ✅     |
| TC-VP4802-02 | Khách có promotion + reward: số = tổng | High     | Khách có ≥ 1 promotion chưa dùng (QC: PR-02, PR-06) | `VP4802_CUSTOMER_PHONE`        | 1. Order + gắn khách. 2. Đọc badge. 3. Mở dialog, đếm dòng                         | Badge = **số promotion + số reward ≤ điểm** (theo GraphQL); khớp số dòng trong dialog                 | ⚠️     |
| TC-VP4802-03 | Bỏ khách khỏi order: số biến mất       | Medium   | Order đang có khách có badge (QC: PR-03)            | Như TC-02                      | 1. Bấm xoá khách → Remove                                                          | Badge **biến mất**                                                                                    | ✅     |
| TC-VP4802-04 | Khách mới 0 điểm, không promotion      | High     | — (QC: PR-04)                                       | Khách mới, SĐT ngẫu nhiên      | 1. Order + thêm khách mới. 2. Đọc badge. 3. Mở dialog                              | Badge = **số reward 0 điểm** (không badge nếu = 0); "No promotions available"; dòng trong dialog khớp | ✅     |
| TC-VP4802-05 | Khách có điểm: chỉ đếm reward đủ điểm  | Medium   | Khách có điểm (QC: PR-05)                           | `VP4802_POINTS_CUSTOMER_PHONE` | 1. Order + gắn khách. 2. Đọc "Point: N" + badge                                    | Phần reward của badge = số reward có **point ≤ N**; tổng khớp dialog                                  | ✅     |

## 2. Áp dụng / sử dụng promotion

| TC ID        | Title                                            | Priority | Precondition                                                                     | Test Data                       | Steps                                                                                   | Expected Result                                                                                      | Status |
| ------------ | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4802-06 | Apply promotion: số trên nút giữ nguyên          | Medium   | Khách có ≥ 1 promotion (QC: PR-07)                                               | Promotion đầu tiên trong dialog | 1. Mở dialog → chọn promotion → Apply. 2. Đọc badge                                     | Order lưu promotion; badge **vẫn = số trước khi Apply**                                              | ⚠️     |
| TC-VP4802-07 | Thanh toán xong: promotion đã dùng không còn đếm | High     | Như TC-06, đặt `VP4802_CONSUME_PROMO=1` (tiêu 1 promotion của khách) (QC: PR-08) | Cash, No Tip                    | 1. Thanh toán order TC-06 bằng Cash. 2. Order mới cho cùng khách. 3. Đọc badge + dialog | Promotion đã dùng **không còn** trong dialog; badge = tổng mới (promotion − 1, reward theo điểm mới) | ⚠️     |

## 3. Gift card

| TC ID        | Title                                         | Priority | Precondition                | Test Data             | Steps                                                                   | Expected Result                                                                | Status |
| ------------ | --------------------------------------------- | -------- | --------------------------- | --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| TC-VP4802-08 | Order chỉ có gift card: không có số           | High     | Khách như TC-02 (QC: PR-09) | Top-up $25 thẻ test   | 1. Quick Checkout + gắn khách. 2. Chỉ thêm dòng gift card. 3. Mở dialog | Không badge; dialog báo **"Promotions and rewards don't apply to gift cards"** | ✅     |
| TC-VP4802-09 | Thêm dịch vụ vào order gift card: số hiện lại | Medium   | Order của TC-08 (QC: PR-10) | Staff + Quick Pay $10 | 1. Chọn staff + thêm 1 dòng                                             | Badge hiện lại = tổng như TC-02                                                | ✅     |

## 4. Pending order

| TC ID        | Title                                  | Priority | Precondition                       | Test Data | Steps                                                                       | Expected Result                        | Status |
| ------------ | -------------------------------------- | -------- | ---------------------------------- | --------- | --------------------------------------------------------------------------- | -------------------------------------- | ------ |
| TC-VP4802-10 | Mở lại pending order có khách: số đúng | Medium   | Pending order có khách (QC: PR-11) | Như TC-02 | 1. Tạo order có khách → về Home. 2. Pending Orders → mở order. 3. Đọc badge | Badge = tổng theo GraphQL, khớp dialog | ✅     |

## 5. Không tự động được / chỉ tài liệu

| TC ID        | Title                                                        | Priority | Precondition                                | Test Data | Steps                                                                       | Expected Result                                                                                          | Status |
| ------------ | ------------------------------------------------------------ | -------- | ------------------------------------------- | --------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4802-11 | > 99 ưu đãi hiện "99+"                                       | Low      | Khách có ≥ 100 promotion + reward           | —         | 1. Gắn khách. 2. Đọc badge                                                  | Badge **"99+"**                                                                                          | 🧱     |
| TC-VP4802-12 | Promotion gán / dùng từ Portal hoặc POS khác: số tự cập nhật | Medium   | Đang mở order có khách; Portal (Google 2FA) | —         | 1. Gán promotion mới cho khách trên Portal. 2. Chờ sync, không mở lại order | Badge tăng 1 mà không cần mở lại order                                                                   | 🧱     |
| TC-VP4802-13 | Promotion inactive / chưa tới ngày bắt đầu                   | Low      | Promotion như vậy gán cho khách (Portal)    | —         | 1. Gắn khách. 2. Đọc badge                                                  | Cần PO xác nhận: query hiện chỉ lọc ngày hết hạn, không lọc `isActive` / ngày bắt đầu (ghi chú QC 26/10) | 🧱     |
| TC-VP4802-14 | Badge không hiện nửa tổng khi đang tải                       | Low      | —                                           | —         | 1. Review code: `isCountReady` chờ cả 2 list + điểm GCI                     | Không có trạng thái hiện số tạm                                                                          | 📄     |

## Ghi chú automation

- Spec: `tests/regression/order-flow/vp-4802-promo-rewards-count.spec.ts` — `npm run test:attach -- --spec tests/regression/order-flow/vp-4802-promo-rewards-count.spec.ts`.
- 10 TC chạy được (✅/⚠️), 4 TC PENDING (11–13 cần dữ liệu/Portal, 14 tài liệu).
- TC-07 **tiêu 1 promotion** của khách test → chỉ chạy khi `VP4802_CONSUME_PROMO=1`.
