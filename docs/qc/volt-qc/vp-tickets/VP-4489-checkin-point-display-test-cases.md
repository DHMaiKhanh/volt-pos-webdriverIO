---
title: Điểm Customer — 1 check-in = 1 point bị chuyển sang $1 = 1 point (+ VP-5112 "1 points") — test cases
ticket: VP-4489 — https://linear.app/fastboy/issue/VP-4489/bug-ticket-1552811-djiem-customer-hien-thi-sai-check-in-1-point-bi
sub-issues: VP-5112 — https://linear.app/fastboy/issue/VP-5112
feature-spec: docs/specs/checkout-type-setting.md
spec-files: tests/regression/checkout-type/vp-4489-checkin-point-display.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [Bug] Ticket #1552811 — Điểm Customer hiển thị sai (check-in = 1 point bị chuyển sang $1 = 1 point)

**Ticket:** [VP-4489](https://linear.app/fastboy/issue/VP-4489/bug-ticket-1552811-djiem-customer-hien-thi-sai-check-in-1-point-bi) · project Checkout Type Setting · tiệm gốc: Pinky Nails and Spa (#20673)
**Dev:** Thien Duy (`thienduy_vo`) · **Sub-bug:** [VP-5112](https://linear.app/fastboy/issue/VP-5112) — màn hình khách hiện "You've earned **1 points**" (QC Completed, 1.1.64)
**Trạng thái:** QC Completed — PASS trên dev 1.1.64 (02/11/2026). Lần test 26/10 (1.1.57): 6 PASS / 1 FAIL (CI-07 → VP-5112).

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.64**.
- Khách test có SĐT (`LOYALTY_CUSTOMER_PHONE`, vd new3 – 7777777702); thanh toán **Cash**, không tip.
- Setting đổi trên **Portal DEV** → Store Settings → Payment & transactions → Checkout setting / Point config. Spec **không** đổi setting: mỗi TC đọc `merchant_point_payment_config` (GraphQL `sysSettingList`) và **skip** nếu setting hiện tại không khớp precondition. Chạy lần lượt theo bảng:

| Lượt        | Checkout type        | Point Bonus | Cash/Card/Other | TC chạy                             |
| ----------- | -------------------- | ----------- | --------------- | ----------------------------------- |
| A           | Auto                 | 1           | $1.00 / point   | 01, 07, 10                          |
| B           | Auto                 | 1           | No points       | 02, 07, 10                          |
| C           | Manual               | —           | No points       | 03                                  |
| D           | Manual (hoặc Hybrid) | —           | $1.00 / point   | 04, 09, 10                          |
| bất kỳ Auto | Auto                 | bất kỳ      | bất kỳ          | 05 (cần kiosk check-in CHK-POS-017) |

- Oracle điểm: delta số dư khách (GoCheckin `customerInfo.currentPoint`) = `order.pointBonus` = điểm tính lại từ setting + giao dịch thật (`src/domain/loyaltyPoints.ts`).
- Màn hình khách (cửa sổ thứ 2 `/customer/`) chỉ tiếng Anh: "Congrats! You've earned" / "N point(s)" / "Your current points".
- Sau khi test trả setting tiệm #14 về: Manual, Point Bonus 10, Cash/Card/Other $1.00, Gift card No points.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện (setting Portal / dữ liệu) · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Tích điểm theo check-in (VP-4489 — CI-01..CI-06)

| TC ID        | Title                                                             | Priority | Precondition                                                | Test Data                                          | Steps                                                                        | Expected Result                                                                    | Status |
| ------------ | ----------------------------------------------------------------- | -------- | ----------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| TC-VP4489-01 | Auto: 1 check-in = 1 point, không tính theo tiền                  | Critical | Auto Checkout, Point Bonus 1, Cash/Card/Other $1.00         | Khách loyalty, order > $1 (vd $63.00), Cash        | 1. Quick Checkout + khách. 2. Thêm dịch vụ. 3. Pay → Cash → Complete Payment | Khách **+1 điểm** (vd 126 → 127), không phải +63; `order.pointBonus` = 1           | ⚠️     |
| TC-VP4489-02 | Auto: tắt $1 = 1 point vẫn giữ điểm check-in (đúng case của tiệm) | Critical | Auto, Point Bonus 1, tất cả method "No points"              | Khách loyalty, Cash                                | 1. Tạo order. 2. Thanh toán Cash                                             | Khách vẫn **+1 điểm** (127 → 128)                                                  | ⚠️     |
| TC-VP4489-03 | Manual + tất cả "No points" → 0 điểm                              | Medium   | Manual, tất cả method "No points"                           | Khách loyalty, Cash                                | 1. Tạo order. 2. Thanh toán Cash                                             | **0 điểm** (theo thiết kế: Manual không bù bằng bonus), số dư giữ nguyên           | ⚠️     |
| TC-VP4489-04 | Manual: $1 = 1 point không bị ảnh hưởng                           | Critical | Manual, Cash $1.00 / point                                  | Khách loyalty, order $63.00 Cash                   | 1. Tạo order. 2. Thanh toán Cash                                             | **+63 điểm** (= floor(số tiền trả / rate)), `order.pointBonus` khớp                | ⚠️     |
| TC-VP4489-05 | Auto: order $0 không cộng điểm                                    | Medium   | Auto (bonus bất kỳ); kiosk check-in CHK-POS-017 còn pending | Reward "test redeem 2109" (−$101, 0 point) → $0.00 | 1. Mở order check-in của khách. 2. Redeem reward → $0. 3. Thanh toán         | Không cộng điểm, **không hiện** khối "Congrats! You've earned" trên màn hình khách | ⚠️     |
| TC-VP4489-06 | Đổi setting trên Portal áp dụng ngay, không cần restart POS       | Medium   | POS đang chạy                                               | Manual ↔ Auto, bonus, No points                    | 1. Save trên Portal. 2. Chờ đồng bộ ~10–20 s. 3. Thanh toán order mới        | Order sau đó tính theo setting mới                                                 | 🧱     |

## 2. Màn hình khách hiển thị điểm (VP-5112 — CI-07 + retest 27/10)

| TC ID        | Title                                                     | Priority | Precondition                                                     | Test Data                              | Steps                                                                              | Expected Result                                                                                   | Status |
| ------------ | --------------------------------------------------------- | -------- | ---------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4489-07 | Auto + bonus 1: màn hình khách hiện "1 point" (số ít)     | High     | Auto, Point Bonus 1                                              | Khách loyalty, Cash                    | 1. Thanh toán. 2. Xem màn hình khách trước khi bấm No Receipt                      | "Congrats! You've earned **1 point**" (bug cũ: "1 points")                                        | ⚠️     |
| TC-VP4489-08 | POS đang ở bản có fix VP-5112                             | High     | POS kết nối dev                                                  | —                                      | 1. Mở sidebar (≡). 2. Đọc "Version:" ở khối About                                  | Version **≥ 1.1.64**                                                                              | ✅     |
| TC-VP4489-09 | Nhận nhiều điểm → hiện số nhiều "N points"                | High     | Point Config có Cash earning (Manual/Hybrid) hoặc Auto bonus > 1 | Khách loyalty, dịch vụ ≥ $2 (vd $5.00) | 1. Thanh toán Cash. 2. Xem màn hình khách                                          | "Congrats! You've earned **N points**" với N = điểm thực nhận (vd 5 points)                       | ⚠️     |
| TC-VP4489-10 | "Your current points" cộng đúng sau mỗi đơn               | Medium   | Setting có cộng điểm cho Cash                                    | Khách loyalty                          | 1. Đọc số dư trước. 2. Thanh toán. 3. So "Your current points" trên màn hình khách | Current points = số dư trước + điểm nhận; khớp số dư GoCheckin sau thanh toán                     | ⚠️     |
| TC-VP4489-11 | POS ở Tiếng Việt — không hỏng chuỗi điểm                  | Low      | Setting → Language → Tiếng Việt                                  | Khách loyalty, $1.00                   | 1. Đổi ngôn ngữ POS. 2. Thanh toán Cash. 3. Xem màn hình khách. 4. Trả về English  | Không lỗi chuỗi (key `pointsValue_one` / `_other`); màn hình khách vẫn tiếng Anh (hành vi có sẵn) | 🧱     |
| TC-VP4489-12 | Manual 0 điểm hiện "You've earned 0 points" (Auto thì ẩn) | Low      | Manual, tất cả "No points"                                       | —                                      | 1. Thanh toán. 2. Xem màn hình khách                                               | Chờ PO quyết định có ẩn khối điểm khi 0 ở Manual hay không — ghi nhận, chưa có expected chốt      | 📄     |

## Ghi chú automation

- 🧱 TC-06: cần đổi setting trên Portal giữa chừng (Portal đăng nhập Google 2FA) → test tay.
- 🧱 TC-11: đổi ngôn ngữ app là state toàn merchant (`@exclusive`) → test tay.
- 📄 TC-12: câu hỏi mở cho PO trong VP-5112.
- TC-05 dùng lại kiosk check-in của CHK-POS-017 (`CHECKOUT_TYPE_CASES=CHK-POS-017 npm run web:checkout-type-checkin`); nếu Checkout Type suite đã dùng mất order đó thì TC skip.
- Các TC đọc màn hình khách cần cửa sổ customer là một WebDriver handle.

Chạy: `npm run test:attach -- --spec tests/regression/checkout-type/vp-4489-checkin-point-display.spec.ts`
