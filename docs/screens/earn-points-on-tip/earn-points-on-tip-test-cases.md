---
title: Earn points on tip (Portal setting → POS loyalty points) — test cases
ticket: VP-4812 — https://linear.app/fastboy/issue/VP-4812/improvement-ticket-1560598-tien-tip-khong-tinh-points
spec-files: tests/regression/earn-points-on-tip/earn-points-on-tip.spec.ts
oracle: src/domain/loyaltyPoints.ts (earn_on_tip) · tests/unit/loyaltyPoints.test.ts
imported-at: 2026-11-01
updated-at: 2026-11-01
---

# Test Cases – [Improvement] Tiền tip không tính points (Earn points on tip)

**Ticket:** [VP-4812](https://linear.app/fastboy/issue/VP-4812/improvement-ticket-1560598-tien-tip-khong-tinh-points) · CRM #1560598 (Honeys Nails #20963)
**PR:** volt-pos#3262 (POS) · fastboy-portal#908 (Portal) · volt-pos-api#1586 (API)

## Tóm tắt tính năng

- Portal → Store Settings → **Payment & transactions** → **Setting point config** → mục **Tip** → toggle **"Earn points on tip"**. Chỉ chỉnh trên Portal; POS chỉ đọc.
- Lưu ở key `earn_on_tip` (boolean) trong system setting `merchant_point_payment_config`, cạnh `cash` / `card` / `gift_card` / `other` / `selected_type` / `point_bonus`.
- **BẬT**: số tiền tính điểm = tiền khách trả cho đơn **+ tip** (giống hành vi cũ).
- **TẮT**: số tiền tính điểm = tiền khách trả cho đơn, **không cộng tip**.
- Chưa có key (tiệm cũ) → coi như BẬT, không đổi hành vi.
- Chỉ ảnh hưởng cách tính theo Point Config (Checkout Type **Manual** / **Hybrid**). **Auto** chỉ cộng Point Bonus, không phụ thuộc số tiền.

## Điều kiện chung

- Môi trường DEV, merchant #14 (Volt POS tiem test 14 v1), POS Windows **1.1.86**.
- Point Config: Cash = Card = Other = 1 điểm / $1 · Gift card = No points · Checkout Type = **Manual**.
- Thuế 5% · Cash discount 3% (giá Cash $63.00, giá Card $64.89 cho dịch vụ $60).
- Tip timing = After payment; tiệm 14 đẩy màn tip sang **màn hình khách** cả khi trả Cash.
- Đơn test: Quick Checkout → khách loyalty → staff Zelene Doyle → dịch vụ Lidasy $60.
- Khách: QC Coby 334334 (`8322280593`, Cash) · QC Coby 001618 (`8327946102`, Card). Ghi điểm **trước** mỗi TC.
- Card cần terminal thật (máy tiệm 14 có) và `CARD_SETTLE=1`.

---

## 1. Portal

| TC ID   | Title                                 | Priority | Precondition       | Steps                                                                                                                  | Expected Result                                                              | Status (01/11/2026)          |
| ------- | ------------------------------------- | -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| EPT-01  | Verify Portal có toggle và lưu được   | P1       | Owner/Admin Portal | 1. Store Settings → Payment & transactions<br>2. Setting point config → Tip<br>3. Tắt toggle → Save<br>4. Reload trang | Có mục "Earn points on tip"; Save báo "Point settings saved"; reload vẫn TẮT | ✅ Pass (manual + tự động)   |
| EPT-01b | Verify setting được ghi xuống API/POS | P2       | Sau EPT-01         | Đọc `merchant_point_payment_config` từ POS                                                                             | Có key `earn_on_tip` đúng giá trị vừa lưu                                    | ✅ Pass (`earn_on_tip:true`) |

## 2. BẬT "Earn points on tip"

| TC ID  | Title                                 | Priority | Test Data                               | Steps                                                                                      | Expected Result                   | Status (01/11/2026)                    |
| ------ | ------------------------------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------- |
| EPT-02 | Verify BẬT: Cash có tip → tính cả tip | P1       | Cash $63.00 + tip 20% ($12.00) = $75.00 | 1. Tạo đơn cho khách<br>2. Pay Cash → Complete Payment<br>3. Màn khách chọn 20% → Continue | **+75** điểm (màn khách = server) | ✅ +75 (63 → 138) · OD261101-64993719  |
| EPT-03 | Verify BẬT: Card có tip → tính cả tip | P1       | Card $64.89 + tip 20% ($12.00) = $76.89 | Như EPT-02, Pay Card, ký tên trên màn khách                                                | **+76** điểm                      | ✅ +76 (203 → 279) · OD261101-65065808 |

## 3. TẮT "Earn points on tip"

| TC ID  | Title                                        | Priority | Test Data                      | Steps                   | Expected Result      | Status (01/11/2026)                    |
| ------ | -------------------------------------------- | -------- | ------------------------------ | ----------------------- | -------------------- | -------------------------------------- |
| EPT-04 | Verify TẮT: Cash có tip → không tính tip     | P1       | Cash $63.00 + tip 20% ($12.00) | Như EPT-02              | **+63** (bỏ $12 tip) | ✅ +63 (138 → 201) · OD261101-65146049 |
| EPT-05 | Verify TẮT: Card có tip → không tính tip     | P1       | Card $64.89 + tip 20% ($12.00) | Như EPT-03              | **+64** (bỏ $12 tip) | ✅ +64 (279 → 343) · OD261101-65187581 |
| EPT-06 | Verify TẮT: không tip → tính như bình thường | P2       | Cash $63.00, No Tip            | Như EPT-02, chọn No Tip | **+63**              | ✅ +63 (201 → 264) · OD261101-65235045 |

## 3b. Other và Gift card

Point config lúc test: Gift card và Other đều **Earning $1.00**. Đơn $63.00 + tip 20% ($12.00), khách chọn tip trên màn hình khách; gift card trả toàn bộ (kể cả tip).

| TC ID  | Title                                              | Priority | Test Data                     | Expected Result                                                             | Status (01/11/2026, tự động)                                 |
| ------ | -------------------------------------------------- | -------- | ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| EPT-09 | Verify BẬT: Other có tip → tính cả tip             | P1       | Other $63.00 + tip $12.00     | **+75**                                                                     | ✅ +75 · OD261101-69020528                                   |
| EPT-10 | Verify TẮT: Other có tip → không tính tip          | P1       | Other $63.00 + tip $12.00     | **+63**                                                                     | ✅ +63 · OD261101-69140763                                   |
| EPT-11 | Verify Gift card có tip theo Point Config + toggle | P1       | Gift card $63.00 + tip $12.00 | Gift card Earning: BẬT **+75** / TẮT **+63** · Gift card "No points": **0** | ✅ BẬT +75 (OD261101-69032220) · TẮT +63 (OD261101-69152114) |

## 4. Đổi setting khi POS đang chạy

| TC ID  | Title                                                  | Priority | Steps                                                                                                | Expected Result                         | Status (01/11/2026)                    |
| ------ | ------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| EPT-07 | Verify BẬT lại có hiệu lực ngay, không cần restart POS | P1       | 1. POS đang mở (setting TẮT)<br>2. Portal BẬT lại, Save<br>3. Cash $63.00 + tip 15% ($9.00) = $72.00 | **+72** (tính lại cả tip) ở đơn kế tiếp | ✅ +72 (264 → 336) · OD261101-65326258 |

## 5. Không bị ảnh hưởng

| TC ID  | Title                                            | Priority | Precondition                   | Test Data             | Expected Result                      | Status                                  |
| ------ | ------------------------------------------------ | -------- | ------------------------------ | --------------------- | ------------------------------------ | --------------------------------------- |
| EPT-08 | Verify Auto Checkout không phụ thuộc setting tip | P2       | Checkout Type = Auto, bonus 10 | Cash $63.00 + tip 20% | **+10** (Point Bonus) dù BẬT hay TẮT | ⏳ Chưa chạy (cần đổi Portal sang Auto) |

## Ghi chú

- Mô tả dưới toggle luôn là "Count the tip in the amount that earns points." ở cả 2 trạng thái, khác mock trong task ("Tips don't earn points…" khi tắt). Không tính là lỗi — chờ PO.
- Kết quả đã comment trên VP-4812 (01/11/2026, 7/7 Pass), task chuyển **QC Completed**.

## 9. Automation map

`tests/regression/earn-points-on-tip/earn-points-on-tip.spec.ts` — chạy **launch lane** (cần màn hình khách để chọn tip).

| TC ID     | Tự động?  | Cách                                                                                     |
| --------- | --------- | ---------------------------------------------------------------------------------------- |
| EPT-01    | ✅        | `tests/web/portal-earn-on-tip.spec.ts` (Edge, profile `.portal-profile/` đã đăng nhập).  |
| EPT-01b   | ✅        | Đọc setting, khẳng định key `earn_on_tip` có mặt (không rơi về mặc định).                |
| EPT-02/03 | ✅ (gate) | Chạy khi setting đang **BẬT**; tắt thì skip.                                             |
| EPT-04/05 | ✅ (gate) | Chạy khi setting đang **TẮT**; bật thì skip.                                             |
| EPT-06    | ✅        | Chạy ở cả 2 trạng thái (không tip thì kết quả như nhau).                                 |
| EPT-07    | ❌        | Cần đổi Portal giữa lúc chạy. Chạy 2 lượt (BẬT rồi TẮT) **không restart app** là đã phủ. |
| EPT-09/10 | ✅ (gate) | Other, chạy theo toggle (cần Other Earning).                                             |
| EPT-11    | ✅        | Gift card (thẻ `973047331197`), kỳ vọng theo Point Config của gift card.                 |
| EPT-08    | ✅ (gate) | Chạy khi Checkout Type = Auto.                                                           |

Spec POS không đổi setting (API read-only theo quy ước) — việc bật/tắt do **web lane Portal** làm (`PortalSettingsPage`), lệnh `test:earn-points-on-tip:full` nối: Portal BẬT → spec POS → Portal TẮT → spec POS. Oracle điểm tính lại từ setting live + giao dịch thật của đơn (`src/domain/loyaltyPoints.ts`), so với **chênh lệch điểm của khách** (GoCheckin) và **dấu `pointBonus`** của đơn; với case có tip còn khẳng định thêm số điểm **có/không** cộng tip.

Biến môi trường: `LOYALTY_CUSTOMER_PHONE` (khách Cash), `EPT_CARD_CUSTOMER_PHONE` (khách Card, mặc định = `LOYALTY_CUSTOMER_PHONE`), `CARD_SETTLE=1` cho case Card.

```bash
# lần đầu trên máy: mở Edge, đăng nhập Portal 1 lần (QR GCI Business hoặc Google) — phiên lưu ở .portal-profile/
npm run portal:login
```

```bash
# chạy đủ 2 lượt tự động (bật → POS → tắt → POS)
npm run test:earn-points-on-tip:full
```

```bash
# lẻ: chỉ bật/tắt Portal, hoặc chỉ spec POS theo setting đang có
npm run portal:earn-on-tip:on
npm run portal:earn-on-tip:off
npm run test:earn-points-on-tip
```

Portal lane: `PORTAL_URL` (mặc định `https://v2.dev-fastboypay.com`), `PORTAL_MERCHANT_ID` (mặc định `14`). Phiên hết hạn → spec báo rõ "chạy lại `portal:login`".

Đơn tạo qua **Pending Orders → Quick Checkout** (`createOrder({ quickCheckout: true })`) và gắn khách bằng cách **gõ SĐT vào ô "Phone, name or email"** rồi chọn dòng "Customers Found" — vì trên 1.1.86 hàng phím cuối ("0") của keypad bị panel "Checkin Today" che, và home có thể đang mở sẵn đơn nháp khác.

### Kết quả chạy tự động

| Ngày       | Build  | Setting live                                      | Kết quả                                                                                                                                                                                         |
| ---------- | ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01/11/2026 | 1.1.86 | TẮT · Manual (chạy riêng)                         | 4 pass / 0 fail / 5 skip — EPT-01b · 04 · 05 · 06                                                                                                                                               |
| 01/11/2026 | 1.1.86 | **Full tự động** (`test:earn-points-on-tip:full`) | **Portal BẬT ✅ → POS 4/4 ✅** (EPT-02 Cash $63+$12 → +75 · EPT-03 Card $64.89+$12 → +76 · EPT-06 +63) · **Portal TẮT ✅ → POS 4/4 ✅** (EPT-04 +63 · EPT-05 +64 · EPT-06 +63). Kết thúc ở TẮT. |
| 01/11/2026 | 1.1.86 | **Full tự động** + Gift card/Other                | Portal BẬT → POS 6/6 ✅ (thêm EPT-09 Other +75 · EPT-11 Gift card +75) · Portal TẮT → POS 6/6 ✅ (thêm EPT-10 Other +63 · EPT-11 Gift card +63). Kết thúc ở TẮT.                                |
