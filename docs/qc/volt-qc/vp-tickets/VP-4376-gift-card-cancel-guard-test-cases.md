---
title: Guard huỷ đơn gift card không chặn nhầm "không đủ số dư" khi tra mã ra card rỗng (POS) — test cases
ticket: VP-4376 — https://linear.app/fastboy/issue/VP-4376/pos-guard-huy-djon-gift-card-chan-nham-khong-dju-so-du-khi-tra-ma-ra
spec-files: tests/regression/order-flow/vp-4376-gift-card-cancel-guard.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [POS] Guard huỷ đơn gift card chặn nhầm "không đủ số dư" khi tra mã ra card rỗng

**Ticket:** [VP-4376](https://linear.app/fastboy/issue/VP-4376/pos-guard-huy-djon-gift-card-chan-nham-khong-dju-so-du-khi-tra-ma-ra) · trạng thái **Done** · bản sửa ship lên production cùng VP-4176 (#2844, `fetchCurrentBalance`)
**Liên quan:** VP-3727 (guard huỷ đơn top-up, #2782) · catalog cũ: PROMO-160 (`windows-regression/04`), OH-121…123 (`07`), CAN-R1 (`cancel-order-guards.spec.ts`)
**Sub-issue:** không có (02/11/2026).

## Điều kiện chung

- Môi trường DEV, POS Windows. Code guard: `use-cancel-gift-card-guard.ts` — tra số dư theo thứ tự mã `giftCard.code` → `history.code` → `posGiftCard.code`; card **không có `id`** coi là _chưa biết_ và thử mã kế tiếp.
- Order test = **top-up thẻ test Active** (`VOLT_TEST_GIFT_CARD`) **$25**, trả **Cash** (No Tip). Mỗi order chỉ huỷ được 1 lần → các ca bị chặn dùng chung 1 order, các ca huỷ thật tạo order riêng.
- "Mã không tra được" (bước 2 của ticket: Fiddler/Charles trả `{"id":"","code":"","currentBalance":0,…}`) được giả lập **ngay trong POS**: spec bọc `window.__TAURI_INTERNALS__.invoke` cho đúng 1 operation `getGiftCardByCode` rồi gỡ ra sau ca (không ghi dữ liệu qua stub). Nếu webview không cho bọc → ca **skip**.
- Thông báo (en-US):
  - Chặn — thiếu số dư: **"Unable to Cancel Order"** + "Gift Card balance is insufficient to revert this top-up. This order cannot be cancelled."
  - Chặn — không kiểm tra được: **"Unable to Cancel Order"** + "Unable to verify the Gift Card balance. Please check the connection and try again."
  - Thành công: toast **"Order canceled successfully"**, Status **Canceled**.
- Passcode huỷ đơn: 8888.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được nhưng có điều kiện (stub IPC / dữ liệu thẻ) · 🧱 không tự động được ở máy này · 📄 chỉ tài liệu.

## 1. Acceptance Criteria

| TC ID        | Title                                                                   | Priority | Precondition                                                                     | Test Data                                 | Steps                                                                                     | Expected Result                                                                                                                      | Status |
| ------------ | ----------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| TC-VP4376-01 | Mã đầu ra card rỗng, mã kế tiếp đủ số dư → huỷ được                     | Critical | Order top-up mà lịch sử thẻ có **≥ 2 mã khác nhau** (vd. mã `posGiftCard` riêng) | Stub: mã đầu → card rỗng; mã sau tra thật | 1. Order History → order top-up. 2. Cancel Order → chọn lý do → Confirm Cancel → passcode | **Huỷ thành công** ("Order canceled successfully", Status Canceled) — guard thử tiếp mã sau                                          | ⚠️     |
| TC-VP4376-02 | Không mã nào tra được → báo "không kiểm tra được", không báo "không đủ" | Critical | Order top-up $25 đã trả                                                          | Stub: mọi mã → card rỗng                  | 1. Cancel Order → lý do → Confirm Cancel → passcode                                       | Dialog **"Unable to Cancel Order"** + **"Unable to verify the Gift Card balance…"**; KHÔNG có "insufficient"; order **không** bị huỷ | ⚠️     |
| TC-VP4376-03 | Thẻ thật sự thiếu số dư vẫn bị chặn với "không đủ số dư"                | Critical | Order top-up $25 đã trả                                                          | Stub: mọi mã → card có `id`, số dư $0.00  | 1. Cancel Order → lý do → Confirm Cancel → passcode                                       | Dialog **"Unable to Cancel Order"** + **"Gift Card balance is insufficient to revert this top-up…"**; order không bị huỷ             | ⚠️     |

## 2. Hồi quy bổ sung

| TC ID        | Title                                                        | Priority | Precondition             | Test Data                      | Steps                                                                                                     | Expected Result                                                                           | Status |
| ------------ | ------------------------------------------------------------ | -------- | ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| TC-VP4376-04 | Lỗi kết nối khi tra số dư → báo "không kiểm tra được"        | High     | Order top-up $25 đã trả  | Stub: lookup trả lỗi transport | 1. Cancel Order → lý do → Confirm Cancel → passcode                                                       | **"Unable to verify the Gift Card balance…"**; order không bị huỷ                         | ⚠️     |
| TC-VP4376-05 | Bấm OK trên dialog chặn → order vẫn Successful, huỷ lại được | Medium   | Sau TC-02/03/04, gỡ stub | —                              | 1. OK. 2. Xem Status. 3. Cancel lại (không stub)                                                          | Status vẫn **Successful - Unsettled**; lần huỷ thật **thành công** (thẻ vừa nạp đủ số dư) | ✅     |
| TC-VP4376-06 | Thẻ đủ số dư, tra mã bình thường → huỷ được, số dư hoàn đúng | High     | Order top-up $25 mới     | Không stub                     | 1. Đọc số dư thẻ TRƯỚC khi top-up, chờ số dư +$25. 2. Cancel Order → Confirm → passcode. 3. Đọc lại số dư | Huỷ thành công, Status **Canceled**; số dư thẻ giảm đúng **$25.00** (đảo phần top-up)     | ✅     |

## 3. Không tự động được / chỉ tài liệu

| TC ID        | Title                                                                               | Priority | Precondition                   | Test Data       | Steps                                                     | Expected Result                                                                                 | Status |
| ------------ | ----------------------------------------------------------------------------------- | -------- | ------------------------------ | --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| TC-VP4376-07 | Lặp TC-01…03 trên build **production** (v1.1.2+)                                    | Critical | Build production đã pick #2844 | Fiddler/Charles | 1. Chạy lại AC trên production                            | Kết quả như develop                                                                             | 🧱     |
| TC-VP4376-08 | Xoá/đổi mã thẻ trong hệ thống gift card để mã không tra được (cách thật của ticket) | Medium   | Quyền sửa thẻ trên Portal/BE   | —               | 1. Đổi mã thẻ. 2. Huỷ order                               | Như TC-02                                                                                       | 🧱     |
| TC-VP4376-10 | Pick #2844 lên production: lấy bản `fetchCurrentBalance`, chạy `verify-resolve`     | Medium   | PR cherry-pick                 | —               | 1. Review conflict `use-cancel-gift-card-guard.ts` + test | Không giữ cả hai bản; test _"treats a code the API answers with an empty card…"_ có mặt và pass | 📄     |

## Ghi chú automation

- Spec: `tests/regression/order-flow/vp-4376-gift-card-cancel-guard.spec.ts` — `npm run test:attach -- --spec tests/regression/order-flow/vp-4376-gift-card-cancel-guard.spec.ts`.
- 6 TC chạy được (✅/⚠️), 4 TC PENDING (07–08 cần production/Portal, 09–10 tài liệu).
- Mỗi lần chạy: 2–3 order top-up $25 bằng Cash, 2 order bị huỷ thật (thẻ test tăng/giảm cân bằng).
