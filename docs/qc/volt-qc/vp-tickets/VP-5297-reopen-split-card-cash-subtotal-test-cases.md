---
title: Re-Open đơn split Card + Cash — màn Edit phải hiện Subtotal khớp Order Details (không lệch 1 cent) — test cases
ticket: VP-5297 — https://linear.app/fastboy/issue/VP-5297/pos-windows-1168-re-open-djon-split-card-cash-man-edit-hien-subtotal
sub-issues: —
spec-files: tests/regression/order-flow/vp-5297-reopen-split-card-cash-subtotal.spec.ts
imported-at: 2026-11-06
updated-at: 2026-11-07
---

# Test Cases – [POS Windows] Re-Open đơn split Card + Cash: màn Edit hiện Subtotal $101.49, lệch 1 cent so với Order Details $101.50

**Ticket:** [VP-5297](https://linear.app/fastboy/issue/VP-5297/pos-windows-1168-re-open-djon-split-card-cash-man-edit-hien-subtotal) · parent VP-5020 · liên quan VP-4405, VP-4912
**Trạng thái:** QC Completed — test tay trên dev **1.1.108** (06/11/2026): 4/4 PASS; spec tự động 07/11: 7/7 PASS (bug gốc trên 1.1.68: màn Edit $101.49).

## Hành vi mong đợi

1. Đơn split thanh toán **Card + Cash** (giá card ≠ giá cash): sau **Re-Open**, panel phải màn Edit (checkout re-open) và giỏ
   **Edit Order** hiện Subtotal và giá dòng service **bằng đúng** Order Details (ví dụ $101.50, không phải $101.49).
2. Tax và Total trên màn Edit khớp Order Details; không bật popup "Void Order Transactions" (phần chính VP-5020).
3. **Re-Open Done** không đổi số tiền đã lưu, giữ nguyên 1 giao dịch Card + 1 giao dịch Cash.
4. Đối chứng: split **Cash + Other** và **Cash + Cash** cũng không lệch.

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows dev bản mới nhất (QC tay: 1.1.108), cửa sổ khách `/customer/` mở.
- Terminal thẻ kết nối (header Devices › Terminal Connected) và `CARD_SETTLE=1` cho các TC charge thẻ thật.
- Service `VP5297_SERVICE` (mặc định **Dark Queen** $100, giá card $103), staff `VP5297_STAFF` (mặc định **Zelene Doyle**).
- Tax & pricing tiệm 14: tax 5% (Dark Queen Card + Cash → Subtotal $101.50 / Tax $5.08 / Total $106.57).
- Màn khách: mỗi check hỏi tip (kể cả Cash) → **No Tip**; check Card thêm màn ký tên.
- Ghi dữ liệu thật (tạo + thanh toán + re-open đơn) → chỉ chạy dev / staging, `WRITE_ALLOWED` bật.

Chú thích trạng thái: ✅ tự động được · ⚠️ tự động được, có điều kiện (terminal + CARD_SETTLE) · 🧱 chưa tự động được · 📄 chỉ tài liệu.

## 1. Split Card + Cash → Re-Open (case bug)

| TC ID        | Title                                                     | Priority | Precondition                      | Test Data                              | Steps                                                                                                                                                    | Expected Result                                                                                                         | Status |
| ------------ | --------------------------------------------------------- | -------- | --------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5297-02 | Split Equally Card + Cash → Payment Successful            | Critical | Terminal Connected, CARD_SETTLE=1 | Dark Queen, check 1 Card, check 2 Cash | 1. Quick Checkout → staff → Dark Queen. 2. Split → Equally. 3. Check 1 Card → Pay (No Tip, ký tên). 4. Check 2 Cash → Complete Check 2. 5. Complete Done | Payment Successful!; Order History: Successful - Unsettled, Payment Details có 1 Card + 1 Cash                          | ⚠️     |
| TC-VP5297-03 | Re-Open đơn split Card + Cash → không bật Void            | Critical | TC-02                             | Đơn TC-02                              | Order History → Re-Open Order → Confirm                                                                                                                  | Vào checkout re-open, không có "Void Order Transactions", có nút **Re-Open Done**                                       | ⚠️     |
| TC-VP5297-04 | Màn Edit (checkout re-open): Subtotal / dòng service khớp | Critical | TC-03                             | Đơn TC-02                              | Đọc panel phải màn checkout re-open                                                                                                                      | Subtotal = Order Details (vd $101.50), dòng Dark Queen = giá dòng ở Order Details, Tax / Total khớp — **không $101.49** | ⚠️     |
| TC-VP5297-05 | Giỏ Edit Order: Subtotal / dòng service khớp              | High     | TC-03                             | Đơn TC-02                              | Bấm **Edit Order** → đọc giỏ hàng                                                                                                                        | Dòng Dark Queen và Subtotal = Order Details; Tax / Total khớp                                                           | ⚠️     |
| TC-VP5297-06 | Re-Open Done giữ nguyên số tiền và giao dịch              | High     | TC-05                             | Đơn TC-02                              | Pay → Re-Open Done → mở lại Order Details                                                                                                                | Subtotal / Tax / Total không đổi, vẫn 1 Card + 1 Cash, Status Successful - Unsettled                                    | ⚠️     |

## Kết quả chạy spec (06/11/2026, POS 1.1.108, `npm run test:attach -- --spec …vp-5297…`)

- **Lần 1 (17:40):** TC-03, 04, 05, 06, 08 PASS. TC-02 FAIL do spec tự thêm assertion `Subtotal + Tax = Total`
  (thực tế $101.50 + $5.08 = $106.58 ≠ Total $106.57 = Card $54.07 + Cash $52.50 — lệch 1¢ kiểu VP-4405, ngoài phạm vi
  VP-5297) → đã bỏ assertion. TC-07 FAIL "Never appeared: Order #…" (Order History chưa có đơn vừa trả) → đã thêm retry.
- **Lần 2 (17:44):** không dùng được — session Claude khác đang lái cùng app qua CDP 9222 (re-open split VP-5020);
  attach self-heal phải relaunch app, card không lên terminal kịp → TC-02 timeout, TC-07/08 dây chuyền. Chờ máy rảnh để chạy lại.
- **Lần 3 (07/11 10:53, máy rảnh, 1.1.108 = bản mới nhất trên feed): 7 PASS / 0 FAIL / 2 PENDING** (TC-01, TC-09 doc-only), 3m28s.
- **07/11 11:01:** TC-09 chuyển từ 📄 sang tự động (đơn Settled thật, chỉ đọc) → **PASS** trên OD261106-38329409.
  Tổng hiện tại: **8 PASS / 0 FAIL / 0 PENDING**. TC-01 (ghi version, chỉ tài liệu) đã bỏ theo yêu cầu 07/11 — không đánh số lại TC khác.

## 2. Đối chứng không có Card

| TC ID        | Title                                                | Priority | Precondition                                                                       | Test Data                                                                                                           | Steps                                                                                                                               | Expected Result                                                                                                                                                                             | Status |
| ------------ | ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5297-07 | Đối chứng split Cash + Other                         | Medium   | Home                                                                               | Dark Queen, Cash + Other                                                                                            | 1. Split Equally Cash + Other → Complete Done. 2. Re-Open → đọc màn Edit. 3. Re-Open Done                                           | Order Details = màn Edit = sau Re-Open Done (Subtotal $100.00 / Tax $5.00 / Total $105.00)                                                                                                  | ✅     |
| TC-VP5297-08 | Đối chứng split Cash + Cash                          | Medium   | Home                                                                               | Dark Queen, Cash + Cash                                                                                             | Như TC-07 với Cash + Cash                                                                                                           | Order Details = màn Edit = sau Re-Open Done, không lệch cent                                                                                                                                | ✅     |
| TC-VP5297-09 | Đơn split Card + Cash đã Settled: không Re-Open được | Medium   | Có đơn split Card + Cash "Successful - Settled" trong 14 ngày (đã chốt sổ qua đêm) | Ưu tiên đơn gốc OD261030-39808255, không có thì đơn Settled Card + Cash đầu tiên (07/11: OD261106-38329409 $170.52) | 1. Order History → Filter Status Successful - Settled, Payment Card + Cash, 14 ngày. 2. Mở đơn có 1 Card + 1 Cash. 3. Xem thanh nút | Status Successful - Settled; chỉ có **Receipt + Refund**; **không** có Re-Open Order / Continue Re-open / Cancel Order / Adjust Tip (theo TC-OH-08, OH-104, docs/specs/order-management.md) | ✅     |
