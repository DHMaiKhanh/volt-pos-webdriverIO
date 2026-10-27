---
title: Checkout Type Setting (POS) — test cases
ticket: VP-4591 — https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android
feature-spec: docs/specs/checkout-type-setting.md
spec-files: tests/regression/checkout-type/checkout-type.spec.ts
imported-at: 2026-10-22
updated-at: 2026-10-27
---

# Test Cases – [POS] Checkout Type Setting (Windows + Android P8D)

**Ticket:** [VP-4591](https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android) · PR volt-pos#3031
**Liên quan:** VP-4590 (Portal) · VP-4554 (API, volt-pos-api#1487) · Bug VP-5151 (check-in còn active sau complete)

## Điều kiện chung (áp cho mọi TC, trừ khi TC ghi khác)

- Môi trường DEV, đã deploy cùng lúc API VP-4554 và POS bản PR #3031.
- Merchant test: #14 (store GAP "Tenant Test Volpos").
- **Point Config:** Cash = 1 điểm / $1 · Card = 1 điểm / $1 · Other = 1 điểm / $1 · Gift card = No points.
- **Point Bonus = 10.**
- Khách test có số điện thoại. Ghi lại số điểm của khách **trước** mỗi TC để so sánh.
- Mỗi TC chạy trên **cả 2 app**. Status ghi riêng: `Win:` (POS Windows) và `P8D:` (POS Android). Kết quả 2 app phải giống nhau.

### Order pending phải tạo từ check-in GoCheckin (GAP kiosk)

Mọi order dùng để test (trừ CHK-POS-033) **phải là order pending sinh ra từ check-in trên GAP kiosk**, **không** tạo bằng Quick Checkout trên POS:

1. Mở `https://gap.gocheckin.net/home` → đăng nhập **Owner** của store 14 → mini app **GoCheckin**
   (kiosk chạy trong iframe `https://gap.gocheckin.net/iframe`).
2. Nhập số điện thoại khách trên keypad → NEXT → (khách mới: nhập tên) → Skip email / birthday / services / staff
   → (khách mới: ký tên ở màn Messaging Consent) → NEXT → màn "You have checked in successfully".
3. Trên POS, order pending của khách tự xuất hiện với badge **Checked-in**; order đã có `customerCheckinId`, check-in ở trạng thái **active**.
4. Mở order đó trên POS, thêm staff + service (service chọn trên kiosk **không** vào order), rồi thanh toán và Complete.

Lý do: order tạo trên POS (Quick Checkout) **chưa có check-in** cho tới lúc complete — check-in được tạo ngay lúc
complete (đã xác nhận trên 1.1.57 và 1.1.65). Vì vậy job Hybrid cuối ngày không thấy order đó (CHK-POS-024 fail
với order tạo trên POS). Order từ GoCheckin mới đúng luồng thực tế "khách check-in → làm dịch vụ → checkout".

Lưu ý khi chạy:

- 1 khách chỉ có **1 check-in active** tại một thời điểm → mỗi order cần check-in mới (khách cũ check-in lại được ngay sau khi order trước complete).
- Kiosk là app canvas: bấm keypad chậm (~0.4 s/số), ô tên chỉ nhập chữ (số bị rơi).
- Máy POS Windows test không có đầu đọc thẻ → **Card được thay bằng Other** (cũng 1 điểm / $1). Case cần Card thật ghi rõ trong Status.

---

## 1. Đọc setting

| TC ID       | Title                                                               | Priority | Precondition                                                                                       | Test Data                   | Steps                                                                                                                       | Expected Result                                 | Status                                     |
| ----------- | ------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| CHK-POS-001 | Verify setting chưa có key mới thì chạy như Manual                  | P1       | Flag `merchant_point_payment_config` chỉ có 4 key payment, chưa có `selected_type` / `point_bonus` | Full Set $40, trả Cash/Card | 1. Check-in khách trên GAP kiosk<br>2. POS: mở order pending (Checked-in), thêm service<br>3. Pay<br>4. Complete            | Điểm theo Point Config (+42 cho $42), không lỗi | Win: ✅ +42 (OD261027-00003442) · P8D:     |
| CHK-POS-002 | Verify `selected_type` có giá trị lạ thì chạy như Manual, bonus = 0 | P2       | Sửa flag: `selected_type = "abc"`, `point_bonus = 10`                                              | Full Set $40, trả Cash/Card | 1–4 như CHK-POS-001                                                                                                         | Theo Point Config, không cộng bonus, không lỗi  | Win: ✅ +42 (OD261027-00003441) · P8D:     |
| CHK-POS-003 | Verify đổi Checkout Type trên Portal áp ngay, không cần restart POS | P1       | POS đang mở, setting = Manual                                                                      | Full Set $40, trả Cash/Card | 1. Portal: đổi sang Auto, Save<br>2. Không restart POS<br>3. Check-in GAP, mở order, Pay, Complete                          | **+10** (Auto)                                  | Win: ✅ +10, POS nhận setting ~10 s · P8D: |
| CHK-POS-004 | Verify POS đọc setting tại thời điểm complete order                 | P2       | Setting = Manual                                                                                   | Full Set $40, trả Cash/Card | 1. Check-in GAP, mở order, thêm service (chưa complete)<br>2. Portal: đổi sang Auto, Save<br>3. Quay lại POS, Pay, Complete | **+10** (theo setting lúc complete)             | Win: ✅ +10 (OD261027-00003425) · P8D:     |
| CHK-POS-005 | Verify đổi Point Bonus áp cho order sau                             | P2       | Setting = Auto, bonus 10                                                                           | Full Set $40                | 1. Portal: đổi bonus thành 20, Save<br>2. Check-in GAP, mở order, Pay, Complete                                             | **+20**                                         | Win: ✅ +20 (OD261027-00003429) · P8D:     |

## 2. Manual Checkout

| TC ID       | Title                                                                           | Priority | Precondition                                            | Test Data                                             | Steps                                                                                                                 | Expected Result                                                   | Status                                            |
| ----------- | ------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| CHK-POS-006 | Verify Manual trả Card tính theo Point Config                                   | P1       | Setting = Manual                                        | Full Set $40, trả Card (Win: Other $42)               | 1. Check-in khách trên GAP kiosk<br>2. POS: mở order pending (Checked-in), thêm service<br>3. Pay Card<br>4. Complete | Theo Point Config (+42 cho $42)                                   | Win: ✅ +42 bằng Other (OD261027-00003423) · P8D: |
| CHK-POS-007 | Verify Manual trả Cash tính theo Point Config                                   | P1       | Setting = Manual                                        | Acrylic Removal 3 $20, trả Cash                       | 1–4 như trên, Pay Cash                                                                                                | Theo tiền khách trả thật (+21 cho $21)                            | Win: ✅ +21 (OD261027-00003422) · P8D:            |
| CHK-POS-008 | Verify Manual split payment, phần gift card không tính điểm                     | P1       | Setting = Manual                                        | Order $42: $21 Cash + $21 Gift card                   | 1–2 như trên<br>3. Split Order (Equally): check 1 Cash, check 2 Gift card<br>4. Complete Done                         | Chỉ tính phần Cash (+21), phần gift card = 0, không bù bằng bonus | Win: ✅ +21 (OD261027-00003439) · P8D:            |
| CHK-POS-009 | Verify Manual payment method có Point Config = 0 thì không cộng, không bù bonus | P1       | Setting = Manual; Portal đặt Card = No points           | Full Set $40, trả Card (Win: Other = No points)       | 1–4 như CHK-POS-006                                                                                                   | **0 điểm**, **không** cộng Point Bonus                            | Win: ✅ 0 (OD261027-00003424) · P8D:              |
| CHK-POS-010 | Verify Manual không áp Point Bonus                                              | P1       | Setting = Manual, Point Bonus = 10 (giá trị cũ vẫn lưu) | Như CHK-POS-006 / 007                                 | 1–4 như CHK-POS-006                                                                                                   | Không có thêm 10 điểm bonus                                       | Win: ✅ chỉ +42 / +21 · P8D:                      |
| CHK-POS-011 | Verify Manual order $0 (redeem toàn bộ)                                         | P2       | Setting = Manual                                        | Full Set $40 + reward "test redeem 2109" (−$101) → $0 | 1. Check-in GAP, mở order, thêm service<br>2. Promo & Rewards → redeem → $0<br>3. Pay Cash $0, Complete               | Không cộng điểm                                                   | Win: ✅ 0 (OD261027-00003440) · P8D:              |

## 3. Auto Checkout

| TC ID       | Title                                                       | Priority | Precondition                                | Test Data                                         | Steps                                                                                                            | Expected Result                                         | Status                                                                                                        |
| ----------- | ----------------------------------------------------------- | -------- | ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| CHK-POS-012 | Verify Auto cộng đúng Point Bonus khi complete              | P1       | Setting = Auto, bonus 10                    | Full Set $40, trả Cash/Card                       | 1. Check-in khách trên GAP kiosk<br>2. POS: mở order pending (Checked-in), thêm service<br>3. Pay<br>4. Complete | **+10**, cộng ngay khi complete                         | Win: ✅ +10 (OD261027-00003425) · P8D:                                                                        |
| CHK-POS-013 | Verify Auto không phụ thuộc số tiền                         | P1       | Setting = Auto, bonus 10                    | Nail Strengthener $150, Cash $157.50              | 1–4 như trên, Pay Cash                                                                                           | **+10** (không phải 157)                                | Win: ✅ +10 (OD261027-00003427) · P8D:                                                                        |
| CHK-POS-014 | Verify Auto không áp Point Config                           | P2       | Setting = Auto; Portal đặt Card = No points | Full Set $40, trả Card (Win: Other = No points)   | 1–4 như CHK-POS-012                                                                                              | **+10**                                                 | Win: ✅ +10 (OD261027-00003426) · P8D:                                                                        |
| CHK-POS-015 | Verify Auto order trả toàn bộ bằng gift card vẫn được cộng  | P1       | Setting = Auto                              | Full Set $40, trả 100% Gift card $42              | 1–2 như trên<br>3. Pay Gift card (Input Gift Card Code → Pay)<br>4. Complete                                     | **+10** (tổng > $0)                                     | Win: ✅ +10 (OD261027-00003435) · P8D:                                                                        |
| CHK-POS-016 | Verify Auto split payment chỉ cộng bonus 1 lần              | P1       | Setting = Auto                              | Order $42: $21 Cash + $21 Card (Win: Other)       | 1–2 như trên<br>3. Split Order (Equally): check 1 Cash, check 2 Card<br>4. Complete Done                         | **+10**, không phải 20                                  | Win: ✅ +10 một lần, Cash + Other (OD261027-00003428) · P8D:                                                  |
| CHK-POS-017 | Verify Auto order $0 (redeem toàn bộ) không cộng bonus      | P1       | Setting = Auto                              | Full Set $40 + reward −$101 → $0                  | 1. Check-in GAP, mở order, thêm service<br>2. Redeem toàn bộ<br>3. Pay Cash $0, Complete                         | **0 điểm**, không hiện block điểm                       | Win: ✅ 0, không có block điểm (OD261027-00003431) · P8D:                                                     |
| CHK-POS-018 | Verify Auto order $0 có tip không cộng bonus                | P1       | Setting = Auto                              | Order $0 (redeem toàn bộ) + tip $5                | 1. Check-in GAP, mở order, redeem toàn bộ<br>2. Thêm tip $5<br>3. Pay tip, Complete                              | **0 điểm** (tổng không tính tip), không hiện block điểm | Win: ⛔ Blocked — tip chỉ gắn vào **Card**, máy không có đầu đọc thẻ (OD261027-00003433 → xem VP-5151) · P8D: |
| CHK-POS-019 | Verify Auto order chỉ bán gift card không cộng bonus        | P1       | Setting = Auto                              | Gift Card: top-up thẻ active $25 / $100, trả Cash | 1. Check-in GAP, mở order<br>2. Gift Card → nhập mã thẻ active → giá trị → Add<br>3. Pay, Complete               | **0 điểm**, không hiện block điểm                       | Win: ✅ 0, không có block điểm (OD261027-00003434, -00003437) · P8D:                                          |
| CHK-POS-020 | Verify Auto order có cả service và gift card vẫn cộng bonus | P2       | Setting = Auto                              | Full Set $40 + top-up gift card $50, trả Cash $92 | 1. Check-in GAP, mở order, thêm service + gift card<br>2. Pay<br>3. Complete                                     | **+10** (không phải order "chỉ bán gift card")          | Win: ✅ +10 (OD261027-00003436) · P8D:                                                                        |
| CHK-POS-021 | Verify Auto với Point Bonus = 0                             | P2       | Setting = Auto, bonus 0                     | Full Set $40, trả Cash/Card                       | 1–4 như CHK-POS-012                                                                                              | **0 điểm**, không lỗi                                   | Win: ✅ 0 (OD261027-00003430) · P8D:                                                                          |

## 4. Hybrid Checkout

| TC ID       | Title                                                               | Priority | Precondition                                            | Test Data                                                 | Steps                                                                                                                                                                                | Expected Result                                                                                                 | Status                                                                                        |
| ----------- | ------------------------------------------------------------------- | -------- | ------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| CHK-POS-022 | Verify Hybrid complete trong ngày tính theo Point Config            | P1       | Setting = Hybrid, bonus 10                              | Lidasy, Cash $63                                          | 1. Check-in khách trên GAP kiosk<br>2. POS: mở order pending, thêm service<br>3. Pay<br>4. Complete (trước cuối ngày)                                                                | Theo Point Config (+63), **không** cộng 10 điểm bonus; check-in chuyển `finished`                               | Win: ✅ +63 (OD261027-00003411) · P8D:                                                        |
| CHK-POS-023 | Verify Hybrid payment method có Point Config = 0 không bù bonus     | P1       | Setting = Hybrid                                        | Full Set $40, trả 100% Gift card (No points)              | 1–2 như trên<br>3. Pay Gift card<br>4. Complete                                                                                                                                      | **0 điểm**, không cộng bonus                                                                                    | Win: ✅ 0 (OD261027-00003443) · P8D:                                                          |
| CHK-POS-024 | Verify Hybrid tự checkout cuối ngày cộng Point Bonus                | P1       | Setting = Hybrid, bonus 10                              | Bộ đơn qua đêm §8 — order GCI pending, **không** complete | 1. Check-in khách trên GAP kiosk, mở order trên POS, thêm service, để pending<br>2. Chờ job cuối ngày (API chạy khi tạo report doanh thu ngày, ~23:30 UTC)<br>3. Kiểm tra điểm khách | **+10** mỗi check-in; order vẫn pending, không bị xoá/archive                                                   | Win: ⏳ Chờ job 28/10 (§8) — với order tạo trên POS: ❌ Fail 26/10 (không có check-in) · P8D: |
| CHK-POS-025 | Verify complete order sau khi check-in đã tự checkout               | P1       | Đã chạy xong CHK-POS-024                                | Order pending của CHK-POS-024                             | 1. Mở order pending trên POS<br>2. Pay Cash/Card<br>3. Complete                                                                                                                      | **Không cộng thêm** điểm; **không báo lỗi**; không hiện số điểm vừa cộng; order complete bình thường            | Win: ⏳ Chờ 024 · P8D:                                                                        |
| CHK-POS-026 | Verify order bị huỷ cuối ngày, Restore rồi complete không cộng thêm | P2       | Setting = Hybrid; check-in đã tự checkout, order bị huỷ | Order đã huỷ (nếu có)                                     | 1. Restore order<br>2. Pay, Complete                                                                                                                                                 | **Không cộng thêm** điểm, không báo lỗi (spec: API không huỷ order pending → kỳ vọng không có order nào bị huỷ) | Win: ⏳ Chờ job · P8D:                                                                        |

## 5. Mỗi check-in chỉ checkout 1 lần / Refund / Cancel

| TC ID       | Title                                                                             | Priority | Precondition                                                | Test Data                               | Steps                                                                                                    | Expected Result                                               | Status                                                                                                 |
| ----------- | --------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CHK-POS-027 | Verify Manual: Edit Order rồi complete lại không cộng thêm                        | P1       | Setting = Manual; order GCI đã complete, khách đã nhận điểm | Thêm service $30                        | 1. Order History → Re-Open Order → Edit Order<br>2. Thêm service<br>3. Pay phần chênh lệch, Re-Open Done | **Không cộng thêm**, không chuyển điểm; điểm khách giữ nguyên | Win: ⚠️ Một phần — không cộng thêm ✅; Edit Order khoá staff/service (OD261027-00003423) · P8D:        |
| CHK-POS-028 | Verify Auto: Edit Order rồi complete lại không cộng bonus lần 2                   | P1       | Setting = Auto; order GCI đã complete, khách đã được +10    | —                                       | 1. Re-Open → Edit Order<br>2. Re-Open Done                                                               | **Không cộng thêm** 10 điểm                                   | Win: ⚠️ Một phần — không +10 lần 2 ✅; Edit Order khoá (OD261027-00003427) · P8D:                      |
| CHK-POS-029 | Verify Hybrid: Edit Order rồi complete lại không cộng thêm                        | P2       | Setting = Hybrid; order GCI đã complete trong ngày          | —                                       | 1. Re-Open<br>2. Re-Open Done                                                                            | **Không cộng thêm** điểm                                      | Win: ⚠️ Một phần — không cộng thêm ✅; Edit Order khoá (OD261027-00003411) · P8D:                      |
| CHK-POS-030 | Verify re-open đổi khách: khách mới không nhận điểm (giới hạn đã chấp nhận)       | P3       | Order đã complete với khách A                               | Khách B                                 | 1. Re-open order<br>2. Đổi sang khách B<br>3. Complete lại                                               | Khách B **không** nhận điểm; điểm khách A không bị chuyển     | Win: ⛔ Blocked — nút gỡ khách disable khi Re-Open · P8D:                                              |
| CHK-POS-031 | Verify Refund sau checkout không trừ điểm                                         | P1       | Order đã complete **và đã settle**, khách đã nhận điểm      | Refund toàn bộ                          | 1. Refund order<br>2. Kiểm tra điểm khách                                                                | Điểm khách **không bị trừ**, không gửi điểm âm                | Win: ⛔ Blocked 27/10 — order chưa settle không có nút Refund (✅ 25/10 trên OD261022-35821706) · P8D: |
| CHK-POS-032 | Verify Cancel/Void sau checkout không trừ điểm                                    | P1       | Order GCI đã complete, khách đã nhận điểm                   | —                                       | 1. Order History → Cancel Order (chọn lý do)<br>2. Kiểm tra điểm khách                                   | Điểm khách **không bị trừ**                                   | Win: ✅ order → canceled, giữ 51 (OD261027-00003439) · P8D:                                            |
| CHK-POS-033 | Verify order tạo trực tiếp trên POS (không check-in trước) vẫn checkout theo type | P1       | Setting = Auto                                              | **Quick Checkout trên POS**, chọn khách | 1. Tạo order trên POS (không qua GAP kiosk)<br>2. Pay, Complete                                          | Order có check-in sau complete; khách được **+10**            | Win: ✅ +10, check-in tạo **lúc complete** (OD261027-25540804) · P8D:                                  |

## 6. Merge / Offline / Tương thích

| TC ID       | Title                                             | Priority | Precondition                                | Test Data                                                  | Steps                                                                    | Expected Result                                              | Status                                                                                  |
| ----------- | ------------------------------------------------- | -------- | ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| CHK-POS-034 | Verify merge order có check-in giữ flow hiện tại  | P2       | 2 order GCI pending (2 check-in)            | Order A (khách A) + Order B (khách B), mỗi order 1 service | 1. Mở A → Merge Order → chọn B → Merge<br>2. Pay, Complete               | Hoạt động đúng flow merge hiện tại; điểm không bị cộng trùng | Win: ✅ +10 một lần cho A; B → merged, khách B 0 (OD261027-00003438 + -00003421) · P8D: |
| CHK-POS-035 | Verify Auto complete khi offline                  | P2       | Setting = Auto                              | Order GCI, Full Set $40                                    | 1. Ngắt mạng POS<br>2. Pay, Complete<br>3. Bật mạng lại, chờ sync        | Sau khi sync, khách được **+10**, chỉ 1 lần                  | Win: ⬜ Chưa test — cần ngắt mạng riêng app POS · P8D:                                  |
| CHK-POS-036 | Verify Manual complete khi offline                | P2       | Setting = Manual                            | Order GCI, Full Set $40                                    | 1–3 như trên                                                             | Sau khi sync, điểm theo Point Config, chỉ 1 lần              | Win: ⬜ Chưa test — như 035 · P8D:                                                      |
| CHK-POS-037 | Verify POS bản cũ đọc Auto như Manual             | P3       | Setting = Auto; dùng POS bản trước PR #3031 | Full Set $40                                               | 1. Pay, Complete trên POS bản cũ                                         | Như Manual, không crash                                      | Win: ⛔ Blocked — không có bản trước PR #3031 · P8D:                                    |
| CHK-POS-038 | Verify kết quả giống nhau giữa Windows và Android | P1       | Cùng setting, cùng khách                    | Lặp lại CHK-POS-006, 012, 017, 022, 025 trên cả 2 app      | 1. Chạy trên POS Windows<br>2. Chạy trên POS Android (P8D)<br>3. So sánh | Điểm cộng và UI hiển thị giống nhau trên 2 app               | Win: ⛔ Blocked — không có máy P8D · P8D:                                               |

**Tổng Windows (27/10, POS 1.1.65, order GCI):** 25 ✅ · 0 ❌ · 3 ⚠️ · 5 ⛔ · 3 ⏳ · 2 ⬜ (/38). Bảng tổng hợp đầy đủ (test data, điểm trước → sau): [vp-4591-retest-2026-10-27.md](vp-4591-retest-2026-10-27.md) · ảnh: comment Linear VP-4591 ngày 27/10.

---

## 7. Phát hiện khi test

| #   | Phát hiện                                                                                                                                                                                                                            | Liên quan                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1   | Order tạo trên POS (Quick Checkout) không có check-in cho tới lúc complete → job Hybrid cuối ngày bỏ qua order đó. Đây là lý do dùng order từ GAP kiosk.                                                                             | CHK-POS-024, 033         |
| 2   | Check-in của OD261027-00003433 vẫn `active` trên POS sau khi complete (kể cả sau restart); server ghi `checkoutAt` 07:39:24 UTC — **trước** lúc complete 07:40:25. Gặp 1 lần, sau thao tác mở Tip $5 (gắn vào Card) rồi trả Cash $0. | Bug VP-5151, CHK-POS-018 |
| 3   | Tip trên màn checkout chỉ gắn vào Card; Cash / Other vẫn hiện $0.00.                                                                                                                                                                 | CHK-POS-018              |
| 4   | Re-Open → Edit Order khoá staff + service; nút gỡ khách disable. Cần PO xác nhận rule mới hay lỗi.                                                                                                                                   | CHK-POS-027 – 030        |
| 5   | Merge: order B chuyển `merged`, check-in của B `completed` → `finished`; khách B không nhận điểm.                                                                                                                                    | CHK-POS-034              |

---

## 8. Bộ order qua đêm cho CHK-POS-024 / 025 / 026 (tạo 27/10, kiểm tra 28/10)

Setting lúc tạo: **Hybrid · Point Bonus 10**. Tất cả order từ check-in GAP kiosk, pending, check-in active, chưa thanh toán. Không đổi setting trước khi job chạy.

| #   | Order             | Khách                  | Staff · dịch vụ                                     | Total   | Điểm trước | Kỳ vọng sau job              |
| --- | ----------------- | ---------------------- | --------------------------------------------------- | ------- | ---------- | ---------------------------- |
| 1   | OD261027-00003408 | new 2 (***7701)        | Kani · Lidasy                                       | $64.89  | 0          | 10                           |
| 2   | OD261027-00003409 | new4 (***7704)         | Kani · Nail Strengthener                            | $162.23 | 0          | 10 (không phải 162)          |
| 3   | OD261027-00003410 | new5 (***7705)         | (không có dịch vụ)                                  | $0.00   | 0          | ⚠️ cần PO xác nhận (Auto: 0) |
| 4   | OD261027-00003444 | QC Hybrid A (***7711)  | Zelene Doyle · Lidasy                               | $64.89  | 0          | 10                           |
| 5   | OD261027-00003445 | QC Hybrid B (***7712)  | Pamela · Dark Queen                                 | $108.15 | 0          | 10                           |
| 6   | OD261027-00003446 | QC Hybrid C (***7713)  | Anastasia · Full Set Shellac + Organic Herbal Spa   | $81.11  | 0          | 10 (một lần, 2 dịch vụ)      |
| 7   | OD261027-00003447 | QC Hybrid D (***7714)  | Hiha1 · Nail Strengthener                           | $162.23 | 0          | 10                           |
| 8   | OD261027-00003448 | QC Hybrid E (***7715)  | Kani · Express Pedicure + Thalia · Full Set Shellac | $75.71  | 0          | 10 (một lần, 2 staff)        |
| 9   | OD261027-00003449 | QC Hybrid F (***7716)  | Olivia2 · Express Pedicure                          | $32.45  | 0          | 10                           |
| 10  | OD261027-00003453 | QC Hybrid G (***7717)  | (không có dịch vụ)                                  | $0.00   | 0          | ⚠️ cần PO xác nhận           |
| 11  | OD261027-00003454 | QC Hybrid H (***7718)  | Ora Spencer · Organic Herbal Spa + reward −$101     | $0.00   | 0          | ⚠️ cần PO xác nhận           |
| 12  | OD261027-00003455 | QC Gift Card (***7709) | Clark Travis · Lidasy                               | $64.89  | 135        | 145                          |
| 13  | OD261027-00003456 | gci ten (***7710)      | Thalia · Dark Queen                                 | $108.15 | 0          | 10                           |

Đối chứng (không được cộng thêm sau job): new6 (***7706) giữ 63 · QC Manual 08 (***7708) giữ 226 (xem VP-5151).

Sau bước 024: mở từng order → Pay Cash đúng Total → Complete → **không cộng thêm**, không lỗi, không hiện block điểm (CHK-POS-025).

---

## 9. Automation map (WebdriverIO — POS Windows)

> Spec: `tests/regression/checkout-type/checkout-type.spec.ts`
>
> **Nguồn order (thay đổi 27/10):** spec **không** tạo order bằng Quick Checkout nữa (trừ CHK-POS-033). Order lấy từ
> check-in GAP kiosk theo mô hình 2 lane giống `web:checkin` / `test:checkin-to-pos`:
>
> 1. **Lane web** — `npm run web:checkout-type-checkin` (Edge, `wdio.web.conf.ts`,
>    `tests/web/checkout-type-checkins.spec.ts`): `CheckinKioskPage` đăng nhập GAP (Owner store 14 — `WEB_*` env) →
>    mini app GoCheckin (iframe `gap.gocheckin.net/iframe`) → check-in **1 khách mới / 1 TC** (số `8<batch>2<tc>`, tên
>    `CT<tc> T<batch>`; mỗi TC 1 khách riêng vì 1 khách chỉ có 1 check-in active) → ghi map `TC → khách` vào
>    `.tmp/checkout-type-checkins.json` (file reset mỗi lần chạy). Danh sách TC: `CHECKOUT_TYPE_GCI_CASES` trong
>    `src/pages/web/checkinHandoff.ts`; `CHECKOUT_TYPE_CASES=CHK-POS-007,CHK-POS-013` giới hạn theo kiểu Portal đang
>    đặt (check-in thừa sẽ thành order pending trên POS).
> 2. **Lane app** — `npm run test:checkout-type`: mỗi TC đọc khách từ handoff (`gciCustomer`) → chờ order **pending +
>    `customerCheckinId` + check-in `active`** của khách đó sync về POS (`LoyaltyService.checkedInPendingOrder`, tối đa
>    60 s) → `openPendingOrder()` mở order từ Pending Orders, thêm staff + service → Pay → Complete. Không có handoff →
>    TC **skip**; có handoff mà không thấy order → TC **fail** (sync / khác store).
> 3. Lệnh gộp: `npm run test:checkout-type-gci` = lane web `&&` lane app.
>
> **Oracle:** điểm khách đọc qua `customerInfo(phone).currentPoint` trước/sau complete; điểm mong đợi tính lại bằng
> `src/domain/loyaltyPoints.ts` (port của `src/shared/checkout/points.ts` PR #3031) từ setting + transaction thật của
> order; assert thêm `order.pointBonus` (stamp) và với order GCI: check-in của order sau complete **chính là**
> check-in nó đã mang khi còn pending.
>
> **Setting KHÔNG được đổi bởi test** (API layer read-only). Mỗi TC đọc setting live và **tự skip** nếu tiền điều kiện
> không khớp → QA đặt Portal về Manual / Auto / Hybrid rồi chạy lại cho từng kiểu.
>
> **Env cần:** `WEB_MERCHANT_ID` / `WEB_USERNAME` / `WEB_PASSWORD` + `GAP_URL` (đăng nhập GAP Owner store 14) cho lane
> web; `LOYALTY_CUSTOMER_PHONE` chỉ cho CHK-POS-033. Card: `CARD_SETTLE=1 SPEC_RETRIES=0` + terminal. Gift card:
> `GIFT_CARD_CODE` còn số dư.

| Ký hiệu | Nghĩa                                            |
| ------- | ------------------------------------------------ |
| ✅      | Tự động, order từ GAP kiosk, không cần phần cứng |
| 💳      | Tự động, cần `CARD_SETTLE=1` + terminal Bamboo   |
| 🎁      | Tự động, cần gift card fixture                   |
| ⏸️      | PENDING — lý do ghi kèm                          |

| TC ID       | Auto | Gate (setting live)                         | Ghi chú                                                                                             |
| ----------- | ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| CHK-POS-001 | ✅   | raw không có `selected_type`, `point_bonus` | Pay Cash (Card nếu `CARD_SETTLE=1`)                                                                 |
| CHK-POS-002 | ✅   | `selected_type` không hợp lệ                | Như 001                                                                                             |
| CHK-POS-003 | ⏸️   | —                                           | Cần đổi Portal giữa test (test không ghi setting)                                                   |
| CHK-POS-004 | ⏸️   | —                                           | Như 003                                                                                             |
| CHK-POS-005 | ⏸️   | —                                           | Như 003                                                                                             |
| CHK-POS-006 | 💳   | Manual                                      |                                                                                                     |
| CHK-POS-007 | ✅   | Manual                                      | Pay Cash                                                                                            |
| CHK-POS-008 | ⏸️   | —                                           | Chưa có flow Split Order cash + gift card                                                           |
| CHK-POS-009 | 💳   | Manual + Card = No points                   |                                                                                                     |
| CHK-POS-010 | ✅   | Manual + bonus > 0                          | Pay Cash                                                                                            |
| CHK-POS-011 | ✅   | Manual                                      | Redeem `FULL_REDEEM_REWARD` ("test redeem 2109", 0 điểm, −$101) → $0, Pay Cash; assert total 0, Δ 0 |
| CHK-POS-012 | ✅   | Auto                                        | Pay Cash                                                                                            |
| CHK-POS-013 | ✅   | Auto                                        | Pay Cash, service bất kỳ — assert = bonus                                                           |
| CHK-POS-014 | 💳   | Auto + Card = No points                     |                                                                                                     |
| CHK-POS-015 | 🎁   | Auto                                        |                                                                                                     |
| CHK-POS-016 | ⏸️   | —                                           | Chưa có flow Split Order                                                                            |
| CHK-POS-017 | ✅   | Auto + bonus > 0                            | Như 011; assert không hiện block điểm (`showEarned` false), Δ 0                                     |
| CHK-POS-018 | ✅   | Auto + bonus > 0                            | Như 017 + tip $5 qua keypad Tip (tip gắn Card), rồi Pay Cash $0                                     |
| CHK-POS-019 | ⏸️   | —                                           | Chưa có flow bán / top-up gift card                                                                 |
| CHK-POS-020 | ⏸️   | —                                           | Như 019                                                                                             |
| CHK-POS-021 | ✅   | Auto + bonus = 0                            | Pay Cash                                                                                            |
| CHK-POS-022 | ✅   | Hybrid                                      | Pay Cash                                                                                            |
| CHK-POS-023 | 🎁   | Hybrid + Gift card = No points              |                                                                                                     |
| CHK-POS-024 | ⏸️   | —                                           | Job cuối ngày chạy ở API — chạy tay theo §8                                                         |
| CHK-POS-025 | ⏸️   | —                                           | Phụ thuộc 024                                                                                       |
| CHK-POS-026 | ⏸️   | —                                           | Phụ thuộc 024                                                                                       |
| CHK-POS-027 | ⏸️   | —                                           | Re-open/Edit order mutating (giống reopen.spec.ts)                                                  |
| CHK-POS-028 | ⏸️   | —                                           | Như 027                                                                                             |
| CHK-POS-029 | ⏸️   | —                                           | Như 027                                                                                             |
| CHK-POS-030 | ⏸️   | —                                           | Như 027 + cần khách thứ 2                                                                           |
| CHK-POS-031 | ⏸️   | —                                           | Refund cần order đã Settled (giống refund.spec.ts)                                                  |
| CHK-POS-032 | ⏸️   | —                                           | Cancel order mutating                                                                               |
| CHK-POS-033 | ✅   | Auto                                        | **Ngoại lệ:** order tạo bằng Quick Checkout; assert check-in có sau complete                        |
| CHK-POS-034 | ⏸️   | —                                           | Merge cần 2 check-in + flow Merge Order                                                             |
| CHK-POS-035 | ⏸️   | —                                           | Chưa có harness ngắt mạng                                                                           |
| CHK-POS-036 | ⏸️   | —                                           | Như 035                                                                                             |
| CHK-POS-037 | ⏸️   | —                                           | Cần build POS cũ                                                                                    |
| CHK-POS-038 | ⏸️   | —                                           | Android P8D không drive được bằng suite này — chạy tay                                              |
