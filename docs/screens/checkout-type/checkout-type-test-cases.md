---
title: Checkout Type Setting (POS) — test cases
ticket: VP-4591 — https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android
feature-spec: docs/specs/checkout-type-setting.md
spec-files: tests/regression/checkout-type/checkout-type.spec.ts
imported-at: 2026-10-22
---

# Test Cases – [POS] Checkout Type Setting (Windows + Android P8D)

**Ticket:** [VP-4591](https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android) · PR volt-pos#3031
**Liên quan:** VP-4590 (Portal) · VP-4554 (API, volt-pos-api#1487)

## Điều kiện chung (áp cho mọi TC, trừ khi TC ghi khác)

- Môi trường DEV, đã deploy cùng lúc API VP-4554 và POS bản PR #3031.
- Merchant test: #14 (hoặc tiệm test khác).
- **Point Config:** Cash = 1 điểm / $1 · Card = 1 điểm / $1 · Other = 1 điểm / $1 · Gift card = No points.
- **Point Bonus = 10.**
- Khách test có số điện thoại. Ghi lại số điểm của khách **trước** mỗi TC để so sánh.
- Mỗi TC chạy trên **cả 2 app**. Status ghi riêng: `Win:` (POS Windows) và `P8D:` (POS Android). Kết quả 2 app phải giống nhau.

---

## 1. Đọc setting

| TC ID       | Title                                                               | Priority | Precondition                                                                                       | Test Data              | Steps                                                                                                 | Expected Result                                       | Status      |
| ----------- | ------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------- |
| CHK-POS-001 | Verify setting chưa có key mới thì chạy như Manual                  | P1       | Flag `merchant_point_payment_config` chỉ có 4 key payment, chưa có `selected_type` / `point_bonus` | Manicure $40, trả Card | 1. Check-in khách<br>2. Tạo order, thêm service<br>3. Pay Card<br>4. Complete order                   | Khách được **40 điểm** (theo Point Config), không lỗi | Win: · P8D: |
| CHK-POS-002 | Verify `selected_type` có giá trị lạ thì chạy như Manual, bonus = 0 | P2       | Sửa flag qua API/DB: `selected_type = "abc"`, `point_bonus = 10`                                   | Manicure $40, trả Card | 1–4 như CHK-POS-001                                                                                   | Khách được **40 điểm**, không cộng bonus, không lỗi   | Win: · P8D: |
| CHK-POS-003 | Verify đổi Checkout Type trên Portal áp ngay, không cần restart POS | P1       | POS đang mở, setting = Manual                                                                      | Manicure $40, trả Card | 1. Portal: đổi sang Auto, Save<br>2. Không restart POS<br>3. Tạo order mới, Pay Card, Complete        | Khách được **10 điểm** (Auto)                         | Win: · P8D: |
| CHK-POS-004 | Verify POS đọc setting tại thời điểm complete order                 | P2       | Setting = Manual                                                                                   | Manicure $40, trả Card | 1. Tạo order (chưa complete)<br>2. Portal: đổi sang Auto, Save<br>3. Quay lại POS, Pay Card, Complete | Khách được **10 điểm** (theo setting lúc complete)    | Win: · P8D: |
| CHK-POS-005 | Verify đổi Point Bonus áp cho order sau                             | P2       | Setting = Auto, bonus 10                                                                           | Manicure $40           | 1. Portal: đổi bonus thành 20, Save<br>2. POS: tạo order, Pay, Complete                               | Khách được **20 điểm**                                | Win: · P8D: |

## 2. Manual Checkout

| TC ID       | Title                                                                           | Priority | Precondition                                            | Test Data                           | Steps                                                                         | Expected Result                                                              | Status      |
| ----------- | ------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| CHK-POS-006 | Verify Manual trả Card tính theo Point Config                                   | P1       | Setting = Manual                                        | Manicure $40, trả Card              | 1. Check-in khách<br>2. Tạo order, thêm service<br>3. Pay Card<br>4. Complete | Khách được **40 điểm**                                                       | Win: · P8D: |
| CHK-POS-007 | Verify Manual trả Cash tính theo Point Config                                   | P1       | Setting = Manual                                        | Manicure $40, trả Cash              | 1–4 như trên, Pay Cash                                                        | Khách được điểm theo Point Config trên số tiền khách trả thật (như hiện tại) | Win: · P8D: |
| CHK-POS-008 | Verify Manual split payment, phần gift card không tính điểm                     | P1       | Setting = Manual                                        | Order $50: $30 Cash + $20 Gift card | 1–3 như trên, split payment<br>4. Complete                                    | Khách được **30 điểm** (phần gift card = 0, không bù bằng bonus)             | Win: · P8D: |
| CHK-POS-009 | Verify Manual payment method có Point Config = 0 thì không cộng, không bù bonus | P1       | Setting = Manual; Portal đặt Card = No points           | Manicure $40, trả Card              | 1–4 như CHK-POS-006                                                           | Khách được **0 điểm**, **không** cộng Point Bonus                            | Win: · P8D: |
| CHK-POS-010 | Verify Manual không áp Point Bonus                                              | P1       | Setting = Manual, Point Bonus = 10 (giá trị cũ vẫn lưu) | Manicure $40, trả Card              | 1–4 như CHK-POS-006                                                           | Khách được **40 điểm**, không có thêm 10 điểm bonus                          | Win: · P8D: |
| CHK-POS-011 | Verify Manual order $0 (redeem toàn bộ)                                         | P2       | Setting = Manual; khách có đủ điểm redeem               | Manicure $20, redeem toàn bộ        | 1. Tạo order<br>2. Redeem điểm hết $20<br>3. Complete                         | Không cộng điểm                                                              | Win: · P8D: |

## 3. Auto Checkout

| TC ID       | Title                                                       | Priority | Precondition                                | Test Data                                  | Steps                                                                         | Expected Result                                               | Status      |
| ----------- | ----------------------------------------------------------- | -------- | ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| CHK-POS-012 | Verify Auto cộng đúng Point Bonus khi complete              | P1       | Setting = Auto, bonus 10                    | Manicure $40, trả Card                     | 1. Check-in khách<br>2. Tạo order, thêm service<br>3. Pay Card<br>4. Complete | Khách được **10 điểm**, cộng ngay khi complete                | Win: · P8D: |
| CHK-POS-013 | Verify Auto không phụ thuộc số tiền                         | P1       | Setting = Auto, bonus 10                    | Full set $150, trả Cash                    | 1–4 như trên, Pay Cash                                                        | Khách được **10 điểm** (không phải 150)                       | Win: · P8D: |
| CHK-POS-014 | Verify Auto không áp Point Config                           | P2       | Setting = Auto; Portal đặt Card = No points | Manicure $40, trả Card                     | 1–4 như CHK-POS-012                                                           | Khách được **10 điểm**                                        | Win: · P8D: |
| CHK-POS-015 | Verify Auto order trả toàn bộ bằng gift card vẫn được cộng  | P1       | Setting = Auto                              | Order $50, trả 100% Gift card              | 1–3 như trên, Pay Gift card<br>4. Complete                                    | Khách được **10 điểm** (tổng > $0)                            | Win: · P8D: |
| CHK-POS-016 | Verify Auto split payment chỉ cộng bonus 1 lần              | P1       | Setting = Auto                              | Order $60: $30 Cash + $30 Card             | 1–3 như trên, split payment<br>4. Complete                                    | Khách được **10 điểm**, không phải 20                         | Win: · P8D: |
| CHK-POS-017 | Verify Auto order $0 (redeem toàn bộ) không cộng bonus      | P1       | Setting = Auto; khách có đủ điểm redeem     | Manicure $20, redeem toàn bộ               | 1. Tạo order<br>2. Redeem hết $20<br>3. Complete                              | **0 điểm**, không hiện block điểm                             | Win: · P8D: |
| CHK-POS-018 | Verify Auto order $0 có tip không cộng bonus                | P1       | Setting = Auto                              | Order $0 (redeem toàn bộ) + tip $5         | 1. Tạo order, redeem toàn bộ<br>2. Thêm tip $5<br>3. Pay tip, Complete        | **0 điểm** (tổng không tính tip), không hiện block điểm       | Win: · P8D: |
| CHK-POS-019 | Verify Auto order chỉ bán gift card không cộng bonus        | P1       | Setting = Auto                              | Bán gift card $100, trả Card               | 1. Tạo order chỉ có gift card $100<br>2. Pay Card<br>3. Complete              | **0 điểm**, không hiện block điểm                             | Win: · P8D: |
| CHK-POS-020 | Verify Auto order có cả service và gift card vẫn cộng bonus | P2       | Setting = Auto                              | Manicure $40 + bán gift card $50, trả Card | 1. Tạo order gồm service + gift card<br>2. Pay Card<br>3. Complete            | Khách được **10 điểm** (không phải order "chỉ bán gift card") | Win: · P8D: |
| CHK-POS-021 | Verify Auto với Point Bonus = 0                             | P2       | Setting = Auto, bonus 0                     | Manicure $40, trả Card                     | 1–4 như CHK-POS-012                                                           | **0 điểm**, không lỗi                                         | Win: · P8D: |

## 4. Hybrid Checkout

| TC ID       | Title                                                               | Priority | Precondition                                            | Test Data                                          | Steps                                                                                                                                        | Expected Result                                                                                      | Status      |
| ----------- | ------------------------------------------------------------------- | -------- | ------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- |
| CHK-POS-022 | Verify Hybrid complete trong ngày tính theo Point Config            | P1       | Setting = Hybrid, bonus 10                              | Manicure $40, trả Card                             | 1. Check-in khách<br>2. Tạo order, thêm service<br>3. Pay Card<br>4. Complete (trước cuối ngày)                                              | Khách được **40 điểm**, **không** cộng 10 điểm bonus                                                 | Win: · P8D: |
| CHK-POS-023 | Verify Hybrid payment method có Point Config = 0 không bù bonus     | P1       | Setting = Hybrid                                        | Order $50, trả 100% Gift card (No points)          | 1–3 như trên, Pay Gift card<br>4. Complete                                                                                                   | **0 điểm**, không cộng bonus                                                                         | Win: · P8D: |
| CHK-POS-024 | Verify Hybrid tự checkout cuối ngày cộng Point Bonus                | P1       | Setting = Hybrid, bonus 10                              | Check-in khách, tạo order nhưng **không** complete | 1. Check-in khách, tạo order, để pending<br>2. Chạy tự checkout cuối ngày (API chạy khi tạo report doanh thu ngày)<br>3. Kiểm tra điểm khách | Khách được **10 điểm**; order vẫn ở trạng thái pending, không bị xoá/archive                         | Win: · P8D: |
| CHK-POS-025 | Verify complete order sau khi check-in đã tự checkout               | P1       | Đã chạy xong CHK-POS-024                                | Order pending của CHK-POS-024                      | 1. Mở order pending trên POS<br>2. Pay Card<br>3. Complete                                                                                   | **Không cộng thêm** điểm; **không báo lỗi**; không hiện số điểm vừa cộng; order complete bình thường | Win: · P8D: |
| CHK-POS-026 | Verify order bị huỷ cuối ngày, Restore rồi complete không cộng thêm | P2       | Setting = Hybrid; check-in đã tự checkout, order bị huỷ | Order đã huỷ                                       | 1. Restore order<br>2. Pay, Complete                                                                                                         | **Không cộng thêm** điểm, không báo lỗi                                                              | Win: · P8D: |

## 5. Mỗi check-in chỉ checkout 1 lần / Refund / Cancel

| TC ID       | Title                                                                             | Priority | Precondition                                                       | Test Data                          | Steps                                                                                  | Expected Result                                               | Status      |
| ----------- | --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| CHK-POS-027 | Verify Manual: Edit Order rồi complete lại không cộng thêm                        | P1       | Setting = Manual; order $40 đã complete, khách đã được 40 điểm     | Thêm service $20                   | 1. Mở order, Edit Order<br>2. Thêm service $20<br>3. Pay phần chênh lệch, Complete lại | **Không cộng thêm**, không chuyển điểm; điểm khách giữ nguyên | Win: · P8D: |
| CHK-POS-028 | Verify Auto: Edit Order rồi complete lại không cộng bonus lần 2                   | P1       | Setting = Auto; order đã complete, khách đã được 10 điểm           | —                                  | 1. Edit Order<br>2. Complete lại                                                       | **Không cộng thêm** 10 điểm                                   | Win: · P8D: |
| CHK-POS-029 | Verify Hybrid: Edit Order rồi complete lại không cộng thêm                        | P2       | Setting = Hybrid; order đã complete trong ngày                     | —                                  | 1. Edit Order<br>2. Complete lại                                                       | **Không cộng thêm** điểm                                      | Win: · P8D: |
| CHK-POS-030 | Verify re-open đổi khách: khách mới không nhận điểm (giới hạn đã chấp nhận)       | P3       | Order đã complete với khách A                                      | Khách B                            | 1. Re-open order<br>2. Đổi sang khách B<br>3. Complete lại                             | Khách B **không** nhận điểm; điểm khách A không bị chuyển     | Win: · P8D: |
| CHK-POS-031 | Verify Refund sau checkout không trừ điểm                                         | P1       | Order $40 đã complete, khách đã nhận điểm (test cả Manual và Auto) | Refund toàn bộ                     | 1. Refund order<br>2. Kiểm tra điểm khách                                              | Điểm khách **không bị trừ**, không gửi điểm âm                | Win: · P8D: |
| CHK-POS-032 | Verify Cancel/Void sau checkout không trừ điểm                                    | P1       | Order đã complete, khách đã nhận điểm                              | —                                  | 1. Cancel/Void order<br>2. Kiểm tra điểm khách                                         | Điểm khách **không bị trừ**                                   | Win: · P8D: |
| CHK-POS-033 | Verify order tạo trực tiếp trên POS (không check-in trước) vẫn checkout theo type | P1       | Setting = Auto                                                     | Tạo order mới trên POS, chọn khách | 1. Tạo order trên POS (không qua check-in)<br>2. Pay, Complete                         | Order có check-in; khách được **10 điểm**                     | Win: · P8D: |

## 6. Merge / Offline / Tương thích

| TC ID       | Title                                             | Priority | Precondition                                | Test Data                                             | Steps                                                                    | Expected Result                                              | Status      |
| ----------- | ------------------------------------------------- | -------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------- |
| CHK-POS-034 | Verify merge order có check-in giữ flow hiện tại  | P2       | 2 order của khách đã check-in               | Order A $30, Order B $20                              | 1. Merge A và B<br>2. Pay, Complete                                      | Hoạt động đúng flow merge hiện tại; điểm không bị cộng trùng | Win: · P8D: |
| CHK-POS-035 | Verify Auto complete khi offline                  | P2       | Setting = Auto                              | Manicure $40                                          | 1. Ngắt mạng POS<br>2. Pay, Complete<br>3. Bật mạng lại, chờ sync        | Sau khi sync, khách được **10 điểm**, chỉ 1 lần              | Win: · P8D: |
| CHK-POS-036 | Verify Manual complete khi offline                | P2       | Setting = Manual                            | Manicure $40, trả Card                                | 1–3 như trên                                                             | Sau khi sync, khách được **40 điểm**, chỉ 1 lần              | Win: · P8D: |
| CHK-POS-037 | Verify POS bản cũ đọc Auto như Manual             | P3       | Setting = Auto; dùng POS bản trước PR #3031 | Manicure $40, trả Card                                | 1. Pay, Complete trên POS bản cũ                                         | Khách được **40 điểm** (như Manual), không crash             | Win: · P8D: |
| CHK-POS-038 | Verify kết quả giống nhau giữa Windows và Android | P1       | Cùng setting, cùng khách                    | Lặp lại CHK-POS-006, 012, 017, 022, 025 trên cả 2 app | 1. Chạy trên POS Windows<br>2. Chạy trên POS Android (P8D)<br>3. So sánh | Điểm cộng và UI hiển thị giống nhau trên 2 app               | Win: · P8D: |

---

## 7. Automation map (WebdriverIO — POS Windows)

> Spec: `tests/regression/checkout-type/checkout-type.spec.ts` · chạy:
> `npm run test:spec -- ./tests/regression/checkout-type/checkout-type.spec.ts`
>
> **Oracle:** điểm khách đọc qua query `customerInfo(phone).currentPoint` (cùng query màn Promo & Rewards dùng) trước/sau
> khi complete; số điểm mong đợi tính lại độc lập bằng `src/domain/loyaltyPoints.ts` (port của
> `src/shared/checkout/points.ts` PR #3031) từ setting + transaction thật của order; thêm assert `order.pointBonus` (stamp).
>
> **Setting KHÔNG được đổi bởi test** (API layer read-only). Mỗi TC đọc setting live và **tự skip** nếu tiền điều kiện
> không khớp → QA đặt Portal về Manual / Auto / Hybrid rồi chạy lại spec cho từng kiểu.
>
> **Env cần:** `LOYALTY_CUSTOMER_PHONE` (khách test có SĐT, digits only). Card: `CARD_SETTLE=1 SPEC_RETRIES=0` + terminal.
> Gift card: `GIFT_CARD_CODE` còn số dư.

| Ký hiệu | Nghĩa                                          |
| ------- | ---------------------------------------------- |
| ✅      | Tự động, chạy không cần phần cứng              |
| 💳      | Tự động, cần `CARD_SETTLE=1` + terminal Bamboo |
| 🎁      | Tự động, cần gift card fixture                 |
| ⏸️      | PENDING — lý do ghi kèm                        |

| TC ID       | Auto | Gate (setting live)                         | Ghi chú                                                    |
| ----------- | ---- | ------------------------------------------- | ---------------------------------------------------------- |
| CHK-POS-001 | 💳   | raw không có `selected_type`, `point_bonus` |                                                            |
| CHK-POS-002 | 💳   | `selected_type` không hợp lệ                |                                                            |
| CHK-POS-003 | ⏸️   | —                                           | Cần đổi Portal giữa test (test không ghi setting)          |
| CHK-POS-004 | ⏸️   | —                                           | Như 003                                                    |
| CHK-POS-005 | ⏸️   | —                                           | Như 003                                                    |
| CHK-POS-006 | 💳   | Manual                                      |                                                            |
| CHK-POS-007 | ✅   | Manual                                      | Pay Cash                                                   |
| CHK-POS-008 | ⏸️   | —                                           | Chưa có flow split tender cash + gift card trên 1 check    |
| CHK-POS-009 | 💳   | Manual + Card = No points                   |                                                            |
| CHK-POS-010 | 💳   | Manual + bonus > 0                          |                                                            |
| CHK-POS-011 | ⏸️   | —                                           | Cần fixture reward redeem                                  |
| CHK-POS-012 | 💳   | Auto                                        |                                                            |
| CHK-POS-013 | ✅   | Auto                                        | Pay Cash, service bất kỳ — assert = bonus                  |
| CHK-POS-014 | 💳   | Auto + Card = No points                     |                                                            |
| CHK-POS-015 | 🎁   | Auto                                        |                                                            |
| CHK-POS-016 | ⏸️   | —                                           | Split tender cash + card (cần flow + terminal)             |
| CHK-POS-017 | ⏸️   | —                                           | Cần fixture reward redeem                                  |
| CHK-POS-018 | ⏸️   | —                                           | Cần fixture reward redeem                                  |
| CHK-POS-019 | ⏸️   | —                                           | Chưa có flow bán gift card                                 |
| CHK-POS-020 | ⏸️   | —                                           | Chưa có flow bán gift card                                 |
| CHK-POS-021 | 💳   | Auto + bonus = 0                            |                                                            |
| CHK-POS-022 | 💳   | Hybrid                                      |                                                            |
| CHK-POS-023 | 🎁   | Hybrid + Gift card = No points              |                                                            |
| CHK-POS-024 | ⏸️   | —                                           | Job cuối ngày chạy ở API                                   |
| CHK-POS-025 | ⏸️   | —                                           | Phụ thuộc 024                                              |
| CHK-POS-026 | ⏸️   | —                                           | Phụ thuộc 024                                              |
| CHK-POS-027 | ⏸️   | —                                           | Re-open/Edit order mutating (giống reopen.spec.ts)         |
| CHK-POS-028 | ⏸️   | —                                           | Như 027                                                    |
| CHK-POS-029 | ⏸️   | —                                           | Như 027                                                    |
| CHK-POS-030 | ⏸️   | —                                           | Như 027 + cần khách thứ 2                                  |
| CHK-POS-031 | ⏸️   | —                                           | Refund cần order đã Settled (giống refund.spec.ts)         |
| CHK-POS-032 | ⏸️   | —                                           | Như 031                                                    |
| CHK-POS-033 | ✅   | Auto                                        | Order tạo trực tiếp trên POS, Pay Cash; assert có check-in |
| CHK-POS-034 | ⏸️   | —                                           | Merge order cần 2 check-in                                 |
| CHK-POS-035 | ⏸️   | —                                           | Chưa có harness ngắt mạng                                  |
| CHK-POS-036 | ⏸️   | —                                           | Như 035                                                    |
| CHK-POS-037 | ⏸️   | —                                           | Cần build POS cũ                                           |
| CHK-POS-038 | ⏸️   | —                                           | Android P8D không drive được bằng suite này — chạy tay     |
