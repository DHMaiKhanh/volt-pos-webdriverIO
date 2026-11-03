---
title: Order History — lịch khoảng ngày không lặp/trùng ngày giữa 2 tháng — test cases
ticket: VP-2105 — https://linear.app/fastboy/issue/VP-2105/pos-order-history-date-range-filter-calendar-shows
spec-files: tests/regression/order-history/vp-2105-date-range-calendar.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [POS] Order History: date range filter calendar shows duplicate/overlapping days

**Ticket:** [VP-2105](https://linear.app/fastboy/issue/VP-2105/pos-order-history-date-range-filter-calendar-shows) · PR volt-pos#3210 (merge 27/10, thay PR #1929 cũ) · file `src/components/date-range-picker.tsx`
**Liên quan:** OH-049 trong `docs/qc/volt-qc/windows-regression/07-order-history.md` (spec `tests/regression/volt-qc/pos/order-history.spec.ts`).

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows (QC tay PASS 10/10 trên **1.1.67** ngày 27/10/2026).
- Đã đăng nhập, vào **Order History** (staff code nếu merchant bật passcode gate). Bấm ô khoảng ngày (`#selected-date-range`) → popover có **2 lịch** cạnh nhau (trái / phải) + nút **Today**, **Cancel**, **Apply**.
- Mỗi lịch có nút Previous/Next Month riêng; ô ngày là `button[data-day="M/D/YYYY"]`; ngày đầu/cuối khoảng có `data-range-start` / `data-range-end`.
- Acceptance Criteria: mỗi lịch chỉ hiện ngày của tháng mình (không ngày nào xuất hiện ở cả 2 lịch); ngày biên được chọn chỉ tô ở **1** lịch; Apply vẫn lọc đơn đúng.
- Danh sách đơn hiển thị **ngày hoàn tất** còn bộ lọc theo **ngày tạo** → đơn re-open thanh toán lại sau khoảng vẫn hợp lệ; chỉ coi là sai khi ngày hiển thị **trước** ngày bắt đầu.
- Chỉ đọc / lọc — không tạo hay sửa đơn.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ có điều kiện · 🧱 chưa tự động được ở máy này · 📄 chỉ tài liệu.

## 1. Hiển thị 2 lịch

| TC ID        | Title                                        | Priority | Precondition           | Test Data          | Steps                                                                   | Expected Result                                                                                        | Status |
| ------------ | -------------------------------------------- | -------- | ---------------------- | ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| TC-VP2105-01 | POS đã update lên bản có fix                 | High     | POS dev đang chạy      | Bản ≥ 1.1.67       | Menu ≡ → Version Update                                                 | Ghi lại version (QC tay: 1.1.67 "You're Up to Date")                                                   | 📄     |
| TC-VP2105-02 | Mở bộ lọc mặc định – 2 lịch không trùng ngày | High     | Đã vào Order History   | Khoảng mặc định    | Bấm ô khoảng ngày                                                       | Lịch trái chỉ có ngày của tháng trái, lịch phải chỉ có ngày của tháng phải; không ngày nào ở cả 2 lịch | ✅     |
| TC-VP2105-03 | Đúng kịch bản lỗi: cuối tháng 6 / tháng 7    | High     | Popover đang mở        | 15/06 – 30/06/2026 | Lịch trái về 6/2026, lịch phải về 7/2026 → chọn 15 và 30 ở lịch tháng 6 | 29, 30/6 chỉ hiện ở lịch tháng 6; lịch tháng 7 bắt đầu từ 1/7, không hiện 29/30/6                      | ✅     |
| TC-VP2105-04 | Ngày kết thúc chỉ highlight ở 1 lịch         | High     | Đã chọn 15/06 – 30/06  | 30/06/2026         | Quan sát 2 lịch                                                         | Ngày 30/6 chỉ được tô (range end) ở lịch tháng 6; lịch tháng 7 không tô ngày nào                       | ✅     |
| TC-VP2105-05 | Apply lọc đơn đúng (15/06 – 30/06)           | High     | Đã chọn khoảng         | 15/06 – 30/06/2026 | Bấm Apply                                                               | Ô ngày hiện "06/15/2026 - 06/30/2026"; danh sách không có đơn hoàn tất trước 15/06                     | ✅     |
| TC-VP2105-06 | Mở lại bộ lọc sau khi Apply                  | Medium   | Đã Apply 15/06 – 30/06 | —                  | Bấm lại ô ngày                                                          | Hiện lịch 6/2026 + 7/2026, khoảng chọn giữ nguyên ở lịch tháng 6, không trùng ngày / không tô ở 2 lịch | ✅     |

## 2. Khoảng ngày vắt tháng / chuyển năm / tháng ngắn

| TC ID        | Title                         | Priority | Precondition    | Test Data               | Steps                                                   | Expected Result                                                                                                                         | Status |
| ------------ | ----------------------------- | -------- | --------------- | ----------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP2105-07 | Khoảng ngày vắt qua 2 lịch    | High     | Popover đang mở | 28/09 – 03/10/2026      | Chọn 28/9 ở lịch trái, 3/10 ở lịch phải → Apply         | 28–30/9 chỉ tô ở lịch tháng 9, 1–3/10 chỉ tô ở lịch tháng 10; sau Apply ô ngày "09/28/2026 - 10/03/2026", không đơn hoàn tất trước 28/9 | ✅     |
| TC-VP2105-08 | Chuyển năm (12/2025 – 1/2026) | Medium   | Popover đang mở | 29/12/2025 – 04/01/2026 | Lùi về 12/2025 và 1/2026, chọn khoảng                   | Mỗi lịch chỉ hiện ngày của tháng mình; 29–31/12 tô ở lịch tháng 12, 1–4/1 tô ở lịch tháng 1                                             | ✅     |
| TC-VP2105-09 | Tháng 2 (28 ngày) / tháng 3   | Low      | Popover đang mở | 2/2026 – 3/2026         | Điều hướng tới 2/2026 + 3/2026                          | Tháng 2 chỉ 1–28, tháng 3 chỉ 1–31; ô trống không hiện ngày tháng khác                                                                  | ✅     |
| TC-VP2105-10 | Nút Today / Cancel            | Medium   | Popover đang mở | —                       | Bấm Today; mở lại, đổi tháng + chọn ngày rồi bấm Cancel | Today lọc đúng hôm nay; Cancel đóng popover, giữ nguyên khoảng đang lọc                                                                 | ✅     |

## Kết quả test tay (27/10/2026, POS Windows 1.1.67)

10/10 PASS — đã comment vào VP-2105, chuyển QC Completed.

## Ghi chú automation

- Spec chỉ đọc; ngày cố định (6/2026, 9–10/2026, 12/2025–1/2026, 2–3/2026) nằm trong quá khứ so với ngày chạy.
- TC-01 chỉ ghi version → PENDING.
- Chạy: `npm run test:attach -- --spec tests/regression/order-history/vp-2105-date-range-calendar.spec.ts`
