---
title: 'Checkout Type Setting (POS Windows + Android)'
source: https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android
linear_id: 97990216-8342-43fd-b329-3e4ae4982143
team: VOLT
updated: 2026-10-20T04:53:25.216Z
qa-notes-updated: 2026-10-27
related:
  - VP-4554 (API) — volt-pos-api#1487
  - VP-4590 (Portal)
  - volt-pos#3031 (POS, branch feat/VP-4591-pos-checkout-type)
  - VP-5151 (Bug — check-in còn active trên POS sau complete)
---

# Checkout Type Setting — POS (Windows + Android P8D)

> 📌 **Source of truth: Linear** — [VP-4591](https://linear.app/fastboy/issue/VP-4591/pos-checkout-type-setting-windows-android),
> project [Checkout Type Setting](https://linear.app/fastboy/project/checkout-type-setting-a7d574c39869).
> File này là snapshot (2026-10-22) của ticket + phần đọc code PR volt-pos#3031, dùng khi viết test.
> Test case: [checkout-type-test-cases.md](../screens/checkout-type/checkout-type-test-cases.md) ·
> Kết quả re-test mới nhất: [vp-4591-retest-2026-10-27.md](../screens/checkout-type/vp-4591-retest-2026-10-27.md).

## 1. Mục đích

POS đọc **Checkout Type** (Manual / Auto / Hybrid) và **Point Bonus** từ setting
`merchant_point_payment_config`, rồi tính điểm loyalty khi **complete order** theo đúng kiểu đang chọn.

**Scope:** POS Windows và POS Android (P8D) trong cùng ticket — hành vi phải giống nhau trên 2 app (quy tắc 10).
**Không gồm:** UI setting (Portal, VP-4590) và tự checkout cuối ngày (API, VP-4554). Không đổi cách tính Point Config hiện tại.

## 2. Setting `merchant_point_payment_config`

Một dòng `sys_setting` (key `merchant_point_payment_config`), value là JSON. Bản cũ chỉ có 4 key payment method;
VP-4554 thêm 2 key top-level (additive — setting cũ vẫn parse được):

```json
{
  "cash": { "enabled": true, "point": 100 },
  "card": { "enabled": true, "point": 100 },
  "gift_card": { "enabled": false, "point": 100 },
  "other": { "enabled": true, "point": 100 },
  "selected_type": "auto_checkout",
  "point_bonus": 10
}
```

| Key                | Ý nghĩa                                                                         | Mặc định / giá trị lạ              |
| ------------------ | ------------------------------------------------------------------------------- | ---------------------------------- |
| `<method>.enabled` | Payment method có tính điểm không (Portal: "No points" = `false`)               | thiếu → `true`                     |
| `<method>.point`   | Số **cents** cho 1 điểm (`100` = 1 điểm / $1)                                   | thiếu / âm / không phải số → `100` |
| `selected_type`    | `payment_method` (Manual) · `auto_checkout` (Auto) · `hybrid_checkout` (Hybrid) | thiếu / lạ → **Manual**            |
| `point_bonus`      | Số nguyên ≥ 0                                                                   | thiếu / lạ / âm → **0**            |

- POS đọc setting **mới nhất lúc complete order** (hook `usePointPaymentConfig`, query `getPointPaymentConfig`
  re-fetch mỗi khi bảng `sys_setting` được pull) → đổi trên Portal áp cho order complete sau đó, **không cần restart POS** (quy tắc 8).
- POS bản cũ (trước #3031) không biết `selected_type` → đọc `auto_checkout` như Manual.

## 3. Điểm khi complete order

| Checkout Type | Điểm khách nhận khi complete order trên POS                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual**    | Theo **Point Config** trên tiền khách trả thật (như hiện tại).                                                                                                                                                                                                                                |
| **Auto**      | **Point Bonus**, cộng ngay khi complete. **Không** áp Point Config, không phụ thuộc số tiền. **Không cộng** cho order tổng $0 (không tính tip — kể cả order redeem toàn bộ) và order **chỉ bán gift card** (quyết định 2026-10-20). Order **trả bằng** gift card vẫn được cộng nếu tổng > $0. |
| **Hybrid**    | Theo **Point Config** (như Manual). Point Bonus chỉ cộng khi hệ thống tự checkout cuối ngày — POS **không** cộng.                                                                                                                                                                             |

Quy tắc chung:

- Point Config = 0 / "No points" cho một payment method → Manual / Hybrid không cộng điểm cho phần tiền đó,
  **không bù bằng Point Bonus** (quy tắc 6).
- Point Bonus cộng đúng **1 lần cho mỗi check-in** (quy tắc 7) — split payment nhiều tender vẫn chỉ 1 lần.

### 3.1 Công thức Point Config (Manual / Hybrid) — `src/shared/checkout/points.ts`

1. Lấy các tender **tính điểm**: transaction `sale`, không cancelled, không bị void, tender card phải ở trạng thái đã settle, `amount + tip > 0`.
2. `tenderTotal` = tổng `amount + tip` các tender đó.
3. Trừ phần **bán gift card** trong order (`giftCardExcludedAmount`, tối đa bằng `tenderTotal`) → `eligibleTotal`.
4. Chia `eligibleTotal` về từng tender theo tỉ lệ, dồn phần lệch làm tròn vào tender cuối; gộp theo payment method.
5. Mỗi method: nếu `enabled` và `point > 0` → `floor(base / point)`; cộng lại.

### 3.2 Auto — khi nào được bonus

`earnsAutoBonus = (orderTotal − tipTotal) > 0 && !isGiftCardSaleOnly(items)`

- Được bonus → gửi `pointsToAward = point_bonus`, hiện block điểm.
- Không được → vẫn gửi checkout với `0` (để check-in được checkout đúng 1 lần) và **ẩn block điểm** (không hiện "0 points").

## 4. Mỗi check-in checkout đúng 1 lần — ⚠️ confirm with PO

- Mọi order đều có check-in (`customer_checkin_id`), kể cả order tạo trực tiếp trên POS. Order Complete → check-in
  được checkout theo Checkout Type (quy tắc 1, 2, 11).
- POS chỉ gửi checkout khi (`shouldSendCheckout`): order có khách **và** `order.point_bonus` chưa được stamp **và**
  check-in chưa đóng (`finished` / `completed`).
- Complete lại sau **Edit Order / Re-open**: **không cộng lại, không chuyển điểm**, mọi Checkout Type (chốt 2026-10-19).
  Giới hạn đã chấp nhận: đổi khách khi re-open → khách mới không nhận điểm.
- Check-in đã checkout (vd. Hybrid tự checkout cuối ngày) → POS complete không cập nhật lại tiền và điểm.
  Order bị huỷ cuối ngày rồi Restore và complete → không cộng thêm (quy tắc 5).
- **Refund / Cancel** sau checkout: không revert điểm, không gửi điểm âm (quy tắc 9).

### 4.1 Hành vi thực tế đã quan sát (QA, POS Windows 1.1.57 → 1.1.65, DEV tiệm #14)

| Nguồn order                                                                   | Check-in lúc order còn pending                                                                             | Hệ quả                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Check-in trên GAP kiosk** (gap.gocheckin.net → GoCheckin, iframe `/iframe`) | Có ngay: order pending mang badge **Checked-in**, `customerCheckinId` có giá trị, check-in `active`        | Đúng luồng Hybrid: job cuối ngày thấy check-in để tự checkout. Complete trong ngày → check-in `finished`.                                                                                                       |
| **Quick Checkout trên POS**                                                   | **Không có** (`customerCheckinId = null`); check-in chỉ được tạo **lúc complete** (checkinAt = checkoutAt) | Job Hybrid cuối ngày không có gì để checkout → order tạo trên POS để qua đêm **không** được +10 (CHK-POS-024 fail 26/10). Trái câu "mọi order đều có check-in, kể cả order tạo trên POS" — chờ PO/dev xác nhận. |

- Service khách chọn trên kiosk **không** được đưa vào order — phải thêm trên POS.
- 1 khách chỉ có 1 check-in active; kiosk báo "đã check-in" nếu còn check-in active.
- Merge: order bị merge chuyển `merged`, check-in của nó đóng (`completed` → `finished`), khách của order đó không nhận điểm.
- **VP-5151:** 1 lần gặp check-in vẫn `active` trên POS sau khi order complete, trong khi server ghi `checkoutAt` sớm hơn lúc complete (OD261027-00003433, sau thao tác Tip → trả Cash $0).

### 4.2 Quy ước khi test

Order dùng để test **phải tạo từ check-in GAP kiosk** (xem "Điều kiện chung" trong
[checkout-type-test-cases.md](../screens/checkout-type/checkout-type-test-cases.md)). Chỉ CHK-POS-033 dùng Quick Checkout
vì chính nó kiểm tra order tạo trên POS. Automation dùng 2 lane: lane web check-in trên kiosk → lane app mở order
pending có `customerCheckinId` rồi complete (test case §9).

## 5. Hybrid — order còn mở khi check-in được tự checkout cuối ngày

- API (volt-pos-api#1487, đã merge) tự checkout check-in **khi tạo report doanh thu store hằng ngày** (không có timer 23:59).
  API **không xoá, không archive** order — order `pending` giữ nguyên.
- POS complete order đó sau thời điểm này → GCI trả `FAIL` → không cộng điểm, **không báo lỗi**, không hiện số điểm.
- Job chạy cùng lúc tạo report ngày (~06:30 sáng giờ VN / ~23:30 UTC trên DEV), không trigger tay được. Chỉ áp cho
  check-in còn `active` lúc đó → cần order pending từ GAP kiosk (§4.1). Bộ order qua đêm: test case §8.

## 6. Merge order

Order có check-in: giữ theo flow merge hiện tại của POS (quy tắc 12) — điểm không bị cộng trùng.

## 7. Online / Offline & phản hồi API

Điểm gửi qua mutation `checkinAndCheckout(orderId, total, totalDiscount, redeemId, promotionCode, customerId, phone, pointsToAward)`
→ `src-tauri/src/graphql/gocheckin.rs` → API `/go_check_in/customer/checkin_and_checkout`.

| Kết quả                                              | `order.point_bonus`                   | Block điểm trên màn khách        |
| ---------------------------------------------------- | ------------------------------------- | -------------------------------- |
| `OK`                                                 | stamp = điểm đã gửi                   | hiện điểm + `currentPoint`       |
| `FAIL` / `MISSING_ORDER_DATA` (từ chối)              | release về `null`, order `successful` | ẩn, không báo lỗi                |
| lỗi không rõ (`FAILED`, null, exception)             | giữ stamp (có thể đã credit)          | ẩn                               |
| Offline                                              | queue `updatePointBackgroundTask`     | hiện điểm, `currentPoint` = null |
| Không gửi (walk-in / re-complete / check-in đã đóng) | không đổi                             | ẩn                               |

Auto mà không được bonus → luôn ẩn block điểm (`isEarnedPointsHidden`).

## 8. Vị trí code (volt-pos, PR #3031)

| Phần                         | File                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Parse setting                | `src/shared/settings/point-payment-config.ts` (`parsePointPaymentSetting`, `CHECKOUT_TYPE`) |
| Hook đọc setting             | `src/hooks/use-point-payment-config.ts`, query `src/hooks/point-payment-config.gql.ts`      |
| Tính điểm (dùng chung 2 app) | `src/shared/checkout/points.ts` (`calculatePointsToAward`, `resolveCheckoutAward`)          |
| Once-per-check-in / kết quả  | `src/shared/checkout/checkin-checkout.ts`                                                   |
| Windows complete             | `src/routes/_app/order/$orderId/checkout/-components/use-checkout.ts`                       |
| Android complete             | `src/routes-android/_app/order/$id/payment/-shared/use-complete-sale.ts`                    |
| Màn khách (block điểm)       | `src/routes/customer/-view-payment-success/view-payment-success.tsx`                        |

Money: integer cents + `currency.js`. Quality gate cả 2 app: `npm run build` + `npx tsc -p tsconfig.android.json --noEmit` + `npm run build:android`.

## 9. Acceptance Criteria

- [ ] Manual: complete order → khách nhận điểm theo Point Config như hiện tại.
- [ ] Auto: complete order → khách nhận đúng Point Bonus bất kể số tiền; Point Config không áp. Order tổng $0 (không tính tip) hoặc chỉ bán gift card → không cộng bonus, không hiện block điểm.
- [ ] Hybrid: complete order trước cuối ngày → điểm theo Point Config, không cộng Point Bonus.
- [ ] Check-in đã tự checkout cuối ngày → complete order trên POS không cộng thêm điểm, không báo lỗi.
- [ ] Setting chưa có `selected_type` / `point_bonus` → POS chạy như Manual.
- [ ] Đổi Checkout Type trên Portal → order complete sau thời điểm lưu theo kiểu mới, không cần restart POS.
- [ ] Refund / Cancel sau checkout không trừ điểm.
- [ ] Mọi case trên cho cùng kết quả trên POS Windows và POS Android (P8D).

## 10. Tham chiếu

- Spec: [checkout-type-spec.md](https://github.com/FastboyMarketing/volt-po/blob/main/nail/checkin-checkout/checkout-type-spec.md)
- Handoff: [HANDOFF.md](https://github.com/FastboyMarketing/volt-po/blob/main/nail/checkin-checkout/HANDOFF.md)
- PR POS: [FastboyMarketing/volt-pos#3031](https://github.com/FastboyMarketing/volt-pos/pull/3031) · PR API: [FastboyMarketing/volt-pos-api#1487](https://github.com/FastboyMarketing/volt-pos-api/pull/1487)
