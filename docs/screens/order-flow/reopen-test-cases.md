---
title: Reopen Order — test cases từ Linear (team VP)
scope: Re-Open Order trên POS Windows (Order History → Re-Open → Checkout/Home ở chế độ editOrderId)
source: https://linear.app/fastboy/team/VP/all — tìm theo từ khoá "reopen" / "re-open" (team VP không có status hay label "Reopen")
collected: 2026-10-17
spec: tests/regression/order-flow/reopen-flow.spec.ts (chạy thật) · tests/regression/order-flow/reopen-guards.spec.ts (dialog + stub cũ)
---

# Reopen Order — test cases

## 0. Cách lấy danh sách

- Team VP **không có** workflow state hay label tên "Reopen", nên "task reopen" = các issue có
  `reopen` / `re-open` trong tiêu đề/mô tả **và** nói về tính năng Re-Open Order.
- Loại bỏ: issue **Canceled** (VP-4015, VP-4016, VP-4140), **Duplicate** (VP-3563), lane
  **Restaurant** (VP-4221), và các ticket SS chỉ là data-fix một đơn cụ thể (VP-3060, VP-3062,
  VP-3186, VP-3301, VP-3310, VP-3364, VP-3700, VP-3865).
- Ticket gốc là **VP-2585** (sửa tiền/item/staff **đúng 1 lần** khi reopen). Phần lớn bug còn lại là
  hệ quả của nó. Code của VP-2585 nằm ở nhánh `feat/VP-2585` (PR #2175) — **chưa merge `develop`**
  tại 2026-10-16, nên một số case chỉ đúng trên build QC có nhánh này.

## 1. Danh sách task Reopen trong Linear

| Issue                                               | Tiêu đề (rút gọn)                                                                         | Status Linear       | Loại          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------- | ------------- |
| [VP-838](https://linear.app/fastboy/issue/VP-838)   | Spec: Re-open flow (void all, thêm/bớt service)                                           | Backlog             | Spec          |
| [VP-2585](https://linear.app/fastboy/issue/VP-2585) | [POS] Reopen — cho sửa item/giá/staff **1 lần**                                           | QC Completed        | Feature (gốc) |
| [VP-3913](https://linear.app/fastboy/issue/VP-3913) | Re-open không giới hạn dù đã hết `reopenEditCount`                                        | QC Completed        | Bug           |
| [VP-3914](https://linear.app/fastboy/issue/VP-3914) | TC07 — nút Re-Open không hiện message "còn lượt sửa"                                      | QC Completed        | Bug           |
| [VP-3982](https://linear.app/fastboy/issue/VP-3982) | Reopen: xoá customer rồi thêm customer mới không được                                     | QC Completed        | Bug           |
| [VP-4037](https://linear.app/fastboy/issue/VP-4037) | Edit Order vẫn cho sửa khi order Reopen/Pending/Cancel                                    | QC Completed        | Bug           |
| [VP-4012](https://linear.app/fastboy/issue/VP-4012) | Reopen +item: Card tax sai base (thiếu SF), Card ≠ Cash/Other                             | QC Completed        | Bug           |
| [VP-4013](https://linear.app/fastboy/issue/VP-4013) | Reopen +service trả Cash: $110.17 thay vì $110.00                                         | QC Completed        | Bug           |
| [VP-4067](https://linear.app/fastboy/issue/VP-4067) | Reopen sau split (Cash+Other) phát sinh số lẻ phải trả thêm                               | QC Completed        | Bug           |
| [VP-4079](https://linear.app/fastboy/issue/VP-4079) | Reopen +Product (Card): product tax không áp dụng                                         | QC Completed        | Bug           |
| [VP-3957](https://linear.app/fastboy/issue/VP-3957) | Reopen +service (Card): Total sai khi có SF + Tax ($116.50 vs $115.50)                    | QC Completed        | Bug           |
| [VP-3931](https://linear.app/fastboy/issue/VP-3931) | Reopen +service (Cash): bỏ qua tax ($67.20 vs $68.20)                                     | QC Completed        | Bug           |
| [VP-3969](https://linear.app/fastboy/issue/VP-3969) | Reopen làm visit customer +1                                                              | Done                | Bug           |
| [VP-4077](https://linear.app/fastboy/issue/VP-4077) | Reopen recompute theo toggle gift-card SF **đã lưu** của order                            | QC Completed        | Enhancement   |
| [VP-4085](https://linear.app/fastboy/issue/VP-4085) | Reopen — point & checkinAndCheckout theo mô hình point mới                                | QC Completed        | Enhancement   |
| [VP-4405](https://linear.app/fastboy/issue/VP-4405) | PR #2175 side effects: 1¢ tax, split Total, point revoke, Home line ≠ Subtotal, Quick Pay | QC Testing          | Bug           |
| [VP-3148](https://linear.app/fastboy/issue/VP-3148) | Re-open OD — chuyển **từng** service giữa các staff                                       | QC Completed        | SS Request    |
| [VP-3670](https://linear.app/fastboy/issue/VP-3670) | Reopen OD — chuyển/xoá từng service riêng lẻ                                              | In Progress         | SS Request    |
| [VP-3376](https://linear.app/fastboy/issue/VP-3376) | Re-open cho sửa thợ theo từng service                                                     | In Progress         | SS Request    |
| [VP-3226](https://linear.app/fastboy/issue/VP-3226) | Reopen linh hoạt hơn (qua ngày, split service, discount)                                  | In Progress         | SS Request    |
| [VP-3279](https://linear.app/fastboy/issue/VP-3279) | [Re-open] Change staff phải ghi đủ field staff trên order item                            | Verified Production | Bug           |
| [VP-3200](https://linear.app/fastboy/issue/VP-3200) | Loyalty points = 0 khi complete, sai khi reopen re-complete                               | Verified Production | Bug           |
| [VP-2939](https://linear.app/fastboy/issue/VP-2939) | Reopen không chỉnh được tip                                                               | Verified Production | SS Request    |
| [VP-3598](https://linear.app/fastboy/issue/VP-3598) | [BE] Reopen đổi customer A → B: chuyển điểm                                               | Done                | BE            |
| [VP-3726](https://linear.app/fastboy/issue/VP-3726) | [BE] Reopen: request là nguồn sự thật cho customer được cộng                              | Done                | BE            |

## 2. Hành vi app (đọc từ source `volt-pos` nhánh `feat/VP-2585`, 2026-10-16)

- **Re-Open Order** chỉ có trên đơn **Successful − Unsettled** (`order-history-detail-actions.tsx`).
  Khi đơn đang ở `re_open` nút đổi chữ thành **Continue Re-open**.
- Dialog: `Re-open to edit items or payments before settlement.` + một trong hai câu:
  - còn lượt: **`One edit of items, prices left; locks once paid.`**
  - hết lượt: **`Items and prices are locked. Staff, customer and notes can still change.`**
- Confirm đi qua `PermissionProtectedButton` (`edit_order`, gate `reopen_order`) → set status
  `re_open` → điều hướng `/order/{id}/checkout?editOrderId={id}`.
- Checkout reopen, chưa sửa gì (remaining = 0, amount = 0) → nút xanh là **Re-Open Done**
  (huỷ reopen, đơn quay về Successful, **không tốn lượt**).
- Header checkout có link **Edit Order** → `/home?editOrderId=…` (Home hiển thị `Edit Order: OD…`).
  Thêm item → **Pay** → checkout với remaining > 0 → thanh toán phần chênh như đơn thường.
- Hết lượt (`reopenEditCount ≥ limit`): chỉ sửa non-money; thêm item bị `ReopenBlockDialog` chặn.
- Giảm tiền: `REOPEN_VOID_ALL_ENABLED = false` → hiện gate "cover the shortfall"
  (`Cannot continue yet` / `Add a service priced …`), không còn Void All tự động.

## 3. Test cases

Ký hiệu cột **Auto**: ✅ đã code & **PASS live** 2026-10-17 (merchant 14, build 1.1.41, SF 10% / CD 10% /
Tax 10%) · ⏸ pending (stub `it()` trong spec, ghi lý do).

### 3.1 Dialog & lượt sửa

| TC    | Mô tả                                                       | Bước                                                                                                                                                | Kỳ vọng                                                                                                           | Linear                      | Auto |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- | ---- |
| RO-01 | Re-Open có trên đơn unsettled, dialog mở/đóng được          | Tạo đơn cash → Order History → mở đơn → bấm Re-Open Order → Cancel                                                                                  | Nút hiện, Refund không hiện; dialog mở có text; Cancel đóng dialog, đơn không đổi                                 | VP-838, VP-2585             | ✅   |
| RO-02 | Dialog báo **còn lượt sửa**                                 | Đơn mới chưa reopen → mở dialog                                                                                                                     | Có câu `One edit of items, prices left`                                                                           | **VP-3914**                 | ✅   |
| RO-03 | Confirm reopen → checkout chế độ edit, không phát sinh tiền | Confirm (+ passcode nếu có)                                                                                                                         | URL `/order/{id}/checkout?editOrderId`; Enter Amount = $0.00; nút **Re-Open Done**; header có link **Edit Order** | VP-2585 §3, VP-4067         | ✅   |
| RO-04 | Thoát giữa chừng → **Continue Re-open**                     | Ở chế độ reopen app ẩn toàn bộ nav (không Back, không link Order History) → "bỏ dở" = tắt app; test mô phỏng bằng router `history.back()` về detail | Nút đọc `Continue Re-open`                                                                                        | VP-2585 §6, TC-ORDERFLOW-66 | ✅   |
| RO-05 | Re-Open Done không sửa gì **không tốn lượt**                | Continue Re-open → Re-Open Done → mở lại đơn                                                                                                        | Đơn về Successful; nút `Re-Open Order`; dialog vẫn `One edit … left`                                              | VP-2585 §3 (bằng tiền)      | ✅   |

### 3.2 Sửa tiền 1 lần (tăng tiền)

| TC    | Mô tả                                                         | Bước                                                         | Kỳ vọng                                                                                                                                                      | Linear                       | Auto                                            |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------- |
| RO-06 | Reopen + thêm service → charge phần chênh bằng Cash           | Reopen → Edit Order → Home thêm 1 service → Pay → tab Cash   | Enter Amount (= tile Cash) = Total mới − số đã trả, đúng tới cent (live: $60 + $100 → Total $176, due **$110.00**, Card $121.00); trả Cash → Payment Success | VP-2585 §3, VP-3931, VP-4013 | ✅                                              |
| RO-07 | Sau khi dùng lượt: dialog báo **hết lượt**                    | Mở lại đơn vừa sửa → Re-Open                                 | Câu `Items and prices are locked`                                                                                                                            | **VP-3913**                  | ✅                                              |
| RO-08 | Hết lượt: reopen vẫn được nhưng **không thêm item tiền**      | Confirm reopen lần 2 → Edit Order → bấm 1 service            | Không có dòng mới / bị chặn; checkout Remaining = $0                                                                                                         | **VP-3913**, VP-2585 AC      | ✅                                              |
| RO-09 | Home khi reopen: tổng giá các dòng = Subtotal                 | Ở RO-06, sau khi thêm service, đọc giá từng dòng và Subtotal | Σ dòng = Subtotal (lệch khi merchant có SF)                                                                                                                  | **VP-4405 §4**               | ✅                                              |
| RO-10 | Reopen + service, trả **Card**                                | Như RO-06 nhưng tab Card                                     | Card = (Δ + SF) + tax(Δ + SF); Card ≥ Cash                                                                                                                   | VP-3957, VP-4012             | ⏸ 💳 (cần `CARD_SETTLE=1` + terminal)           |
| RO-11 | Reopen + **Product**, trả Card: product tax áp dụng           | Thêm product thay vì service                                 | Tax có phần product tax                                                                                                                                      | VP-4079                      | ⏸ (cần product tile + tax fixture)              |
| RO-12 | Cash quy đổi đúng, không lẻ cent ($110.00 không phải $110.17) | Merchant SF 5% / Tax 10%, đơn gốc Card có gift card          | Cash = $110.00                                                                                                                                               | VP-4013                      | ⏸ (cần merchant SF 5%/Tax 10% + gift card sale) |
| RO-13 | Cash không bỏ tax service mới ($68.20)                        | SF 5%/Tax 10%, đơn gốc Card 2×$100, reopen +$62 Cash         | Cash = $68.20                                                                                                                                                | VP-3931                      | ⏸ (cần fixture giá/tax cố định)                 |

### 3.3 Split / số lẻ / rounding

| TC    | Mô tả                                                                                  | Linear      | Auto                           |
| ----- | -------------------------------------------------------------------------------------- | ----------- | ------------------------------ |
| RO-14 | Reopen đơn split Cash + Other không sửa gì → Remaining = $0.00, không có payment thứ 3 | **VP-4067** | ⏸ (cần fixture split 2 tender) |
| RO-15 | Lệch 1¢ tax đơn mới ($19 product, SF 4%/CD 3.5%/Tax 8.25%, Cash)                       | VP-4405 §1  | ⏸ (PO chưa chốt)               |
| RO-16 | Màn split: Total sau khi trả check Cash = tổng thực thu                                | VP-4405 §2  | ⏸                              |
| RO-17 | Quick Pay $25 trên Home reopen hiện $25 hay $27.50                                     | VP-4405 §5  | ⏸ (PO chưa chốt)               |

### 3.4 Customer / loyalty / visit

| TC    | Mô tả                                                          | Linear                       | Auto                                       |
| ----- | -------------------------------------------------------------- | ---------------------------- | ------------------------------------------ |
| RO-18 | Reopen: xoá customer rồi thêm customer mới → gán thành công    | **VP-3982**                  | ⏸ (cần đơn có customer + customer thứ 2)   |
| RO-19 | Reopen + complete lại không làm visit +1                       | **VP-3969**                  | ⏸ (cần đọc visit qua Customer profile/API) |
| RO-20 | Đổi customer A → B: trừ điểm A, cộng B                         | VP-2585 §5, VP-3598, VP-4085 | ⏸ (cần loyalty fixture + đọc điểm)         |
| RO-21 | Gỡ customer khi reopen: điểm cũ bị thu hồi                     | VP-4085, VP-3726             | ⏸                                          |
| RO-22 | Đơn không customer: không ghi `point_bonus`, không gọi checkin | VP-4085                      | ⏸ (assert ở DB/API)                        |
| RO-23 | Points đúng sau reopen re-complete                             | VP-3200                      | ⏸                                          |

### 3.5 Staff / tip / chặn sửa

| TC    | Mô tả                                                                | Linear                    | Auto                            |
| ----- | -------------------------------------------------------------------- | ------------------------- | ------------------------------- |
| RO-24 | Chuyển **1** service của staff A sang staff B (không kéo cả nhóm)    | VP-3148, VP-3670, VP-3376 | ⏸ (feature In Progress)         |
| RO-25 | Xoá 1 service nhập dư sau reopen                                     | VP-3670                   | ⏸                               |
| RO-26 | Change staff ghi đủ field staff trên order item                      | VP-3279                   | ⏸ (assert DB)                   |
| RO-27 | Reopen chỉnh tip được; tip chia đều lại khi thêm staff               | VP-2939, VP-2585 §4       | ⏸                               |
| RO-28 | Đơn có promotion/reward/campaign/cashback/split → chặn sửa tiền      | VP-2585 §1                | ⏸ (cần fixture promo)           |
| RO-29 | Item gift card không sửa/xoá được khi reopen                         | VP-2585 §2                | ⏸ (gift card sale thiếu testid) |
| RO-30 | Giảm tiền → gate "Cannot continue yet / Add a service priced …"      | VP-2585 §3, VP-838        | ⏸                               |
| RO-31 | Edit Order chỉ cho Partial Refunded / Successful Settled / Unsettled | VP-4037                   | ⏸ (cần đơn ở các status khác)   |
| RO-32 | Recompute theo toggle gift-card SF đã lưu (7 case bảng VP-4077)      | VP-4077                   | ⏸ (cần lật toggle trên Portal)  |

## 4. Kết quả chạy live 2026-10-17

`reopen-flow.spec.ts`: **7 passing, 0 failing, 13 pending** (RO-01..09; các ⏸ là stub).

Phát hiện khi chạy:

- Locator nút Re-Open cũ (`button.bg-persian-indigo-100`) đã drift sang `bg-persian-indigo-solid` → ROP-01
  trong `reopen-guards.spec.ts` fail từ 12/10 dù đơn reopen được. Đã đổi sang match theo text
  (`Re-Open Order` / `Continue Re-open`).
- Checkout reopen **không có** dòng Remaining / Total Paid: số tiền phải thu đọc từ "Enter Amount".
- Header ở chế độ reopen chỉ còn "Edit Order" → `returnToHome()` không thoát được; dùng
  `leaveReopenCheckout()` trong `after` hook.

## 5. Ghi chú chạy

- `npm run test:spec -- tests/regression/order-flow/reopen-flow.spec.ts`
- Spec **tạo dữ liệu & thu tiền thật** (1 đơn cash + 1 lần charge thêm cash). Chỉ dev/staging.
- Cần launch lane khi merchant đẩy tip sang màn khách cả lúc trả cash (xem `payInCash`).
- Passcode guard `reopen_order` là tuỳ cấu hình merchant → flow dùng `enterIfPresent`.
