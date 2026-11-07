---
title: Appointment — thứ tự cột thợ theo GAP + màu appointment theo thợ — test cases
ticket: VP-4402 — https://linear.app/fastboy/issue/VP-4402/improvement-ticket-1548610-appointment-sap-xep-thu-tu-cot-tho-va-mau
sub-issues: VP-5094 (BE priority, Done), VP-5500 (BE màu thợ, Done), VP-5479 (Canceled 06/11 theo dev), VP-5481 (Todo — Thien Duy)
spec-files: tests/regression/appointment/vp-4402-staff-column-order-color.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-07
---

# Test Cases – [POS] Appointment: sắp xếp thứ tự cột thợ và màu appointment giống GAP

**Ticket:** [VP-4402](https://linear.app/fastboy/issue/VP-4402/improvement-ticket-1548610-appointment-sap-xep-thu-tu-cot-tho-va-mau) · Ticket CRM #1548610 (Xpo Nails #19388) · PR volt-pos#3274 (POS) · volt-pos-api#1566 / VP-5094 (BE sync `employee.priority`)
**Dev:** Thien Duy (`thienduy_vo`), Thanh Lam (`lam_doan`, BE) · **Bug con:** VP-5479 (1001vvv bị xếp cuối board — **Canceled** 06/11 theo yêu cầu dev), VP-5481 (màu cột khác GAP — còn Unassigned + thợ không màu, POS sửa)

## Hành vi mong đợi

- Cột thợ trên POS Appointment Overview xếp theo thứ tự GAP (GCI `employee.priority`), màu header/card theo màu thợ GoCheckin (`color_detail` type 1, sync 2 chiều — VP-5500).
- Theo VP-5500 (Out of scope → POS): cột **Unassigned** và thợ **không có màu** hiển thị `#5669FF` như GAP (`var(--primary)`), không dùng xám.
- Thợ cũ chỉ nhận màu/priority khi được lưu lại trên GoCheckin (không backfill) — store 14 đã lưu lại 117 thợ ngày 06/11 → 272/272 màu khớp.

## Điều kiện chung

- Môi trường DEV, merchant #14, POS Windows **≥ 1.1.87** (đã có PR volt-pos#3274). GAP: [pos.gocheckin.net](https://pos.gocheckin.net) (store 14).
- POS → header **Appointment** → màn **Appointment Overview** (board cột thợ, cột đầu là **Unassigned**).
- Thứ tự cột thợ lấy từ bảng `display_order` với `entity_type = 'staff_appointment'` (sync read-only từ GCI `employee.priority`, không phải row `entity_type = 'staff'`):
  1. `priority > 0` tăng dần → 2. `priority = 0` → 3. thợ **không có row** (POS-only / GCI chưa gửi) xếp **cuối**; cùng nhóm thì theo tên (nickname viết thường, so sánh `<`/`>`).
- POS chỉ đọc `staff_appointment` (API từ chối POST 422 / PUT 403). Muốn đổi thứ tự cột → đổi trên GCI/CRM.
- Card appointment có thợ: nền **pha 30% màu thợ** (`color-mix(in srgb, <màu thợ> 30%, var(--card))`), viền trái 4px màu thợ. Card Unassigned: nền mặc định, không pha màu.
- Màu header cột = `staff.colorHex`; thợ có `colorHex = null` → xám mặc định `#CDCCD2`; cột Unassigned → `--color-neutral-700` (`#4D4A5B`).
- Spec chỉ đọc (GraphQL in-page + computed style); appointment test được tạo **trên GAP**, POS không tạo appointment.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được nhưng có điều kiện · 🧱 không tự động được ở đây · 📄 chỉ tài liệu.

## 1. Thứ tự cột thợ

| TC ID        | Title                                              | Priority | Precondition                                      | Test Data                                                             | Steps                                                                                                    | Expected Result                                                                                            | Status |
| ------------ | -------------------------------------------------- | -------- | ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4402-01 | POS đã lên version có tính năng                    | High     | POS dev đã update                                 | Version ≥ 1.1.87                                                      | 1. Kiểm tra version POS                                                                                  | POS chạy ≥ **1.1.87** (build sau khi merge PR #3274)                                                       | ✅     |
| TC-VP4402-02 | Thứ tự cột thợ trên POS giống GAP                  | High     | GAP đã có thứ tự thợ; đã sync `staff_appointment` | 297 thợ có trên cả 2 board, ngày 11/02                                | 1. Mở Appointment Overview. 2. Đọc toàn bộ header cột (cuộn ngang). 3. So với thứ tự `staff_appointment` | Thứ tự cột POS = thứ tự `priority` (= thứ tự GAP); 296/297 thợ khớp (thợ lệch: 1001vvv — VP-5479 Canceled) | ✅     |
| TC-VP4402-03 | Thợ có `priority = 0` đứng sau thợ có thứ tự       | Medium   | Có thợ GCI gửi `priority = 0`                     | —                                                                     | 1. Đọc board. 2. Lấy vị trí các thợ `priority = 0`                                                       | Mọi thợ `priority = 0` nằm sau mọi thợ `priority > 0` và trước thợ không có row                            | ⚠️     |
| TC-VP4402-04 | Thợ chưa có row `staff_appointment` xếp cuối board | Medium   | Có thợ POS-only / chưa sync                       | 333, abc xyz30, Bell, Ben, Delete, Elise Terry, Emma2, JD, TestSalary | 1. Cuộn tới cuối board                                                                                   | Nhóm thợ không có row nằm cuối, theo thứ tự tên                                                            | ⚠️     |
| TC-VP4402-06 | Dropdown Staffs vẫn A→Z                            | Low      | Đang ở Appointment Overview                       | —                                                                     | 1. Mở filter **Staffs**                                                                                  | Danh sách thợ trong dropdown giữ thứ tự tên A→Z (chỉ board đổi theo GAP)                                   | ✅     |
| TC-VP4402-07 | Thứ tự cột không đổi khi chuyển ngày               | Medium   | —                                                 | Hôm nay → ngày mai                                                    | 1. Đọc thứ tự cột. 2. Next day. 3. Đọc lại                                                               | Thứ tự cột giống hệt giữa 2 ngày                                                                           | ✅     |

## 2. Màu appointment / cột

| TC ID        | Title                    | Priority | Precondition                | Test Data      | Steps                                | Expected Result                               | Status |
| ------------ | ------------------------ | -------- | --------------------------- | -------------- | ------------------------------------ | --------------------------------------------- | ------ |
| TC-VP4402-11 | Màu header cột = màu thợ | Medium   | Đang ở Appointment Overview | Mọi cột có màu | 1. Đọc màu viền dưới header từng cột | = `staff.colorHex` (thợ không màu: xem TC-12) | ✅     |

## 3. Bug VP-5481 — màu cột trên POS không giống GAP

| TC ID        | Title                                                     | Priority | Precondition                     | Test Data                                                                                                                     | Steps                           | Expected Result                                                                                                                                                       | Status     |
| ------------ | --------------------------------------------------------- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TC-VP4402-12 | VP-5481: không cột thợ nào xám; thợ không màu = `#5669FF` | High     | Thợ cũ đã lưu lại trên GoCheckin | Teri Jennings (vàng `#F8D885`), Lizzie Wade (`#A0AFF0`), Ramona Dunn (`#96BDF5`); thợ không màu: Shelby, JS, KKate, Phong001… | 1. Đọc màu header mọi cột       | Teri/Lizzie/Ramona đúng màu GAP; không cột nào xám `#CDCCD2`; thợ `colorHex = null` hiển thị `#5669FF` như GAP. 06/11: 3 thợ đã đúng, còn 25 cột xám → fail (POS sửa) | 🐞 VP-5481 |
| TC-VP4402-13 | VP-5481: cột Unassigned màu xanh như GAP                  | Medium   | —                                | Unassigned                                                                                                                    | 1. So màu header cột Unassigned | Xanh `#5669FF` như GAP. Hiện tại: xám đậm `#4D4A5B` → fail (POS sửa, assign Thien Duy)                                                                                | 🐞 VP-5481 |
| TC-VP4402-14 | VP-5481: thợ Anna đúng màu GAP                            | Low      | Anna đã lưu lại trên GoCheckin   | Anna                                                                                                                          | 1. So màu cột Anna              | Xanh `#96BDF5` như GAP. 06/11: đã đúng sau khi lưu lại trên GoCheckin                                                                                                 | ✅         |

## Kết quả test tay (02/11/2026, POS Windows 1.1.87)

Pass 5 / Fail 2 (TC-VP4402-05 → VP-5479, TC-VP4402-12 → VP-5481) — đã comment vào VP-4402.

## Kết quả 05–06/11/2026 (POS 1.1.101 → 1.1.107)

- 06/11: lưu lại 117 thợ cũ trên GoCheckin (Gap Settings → Staff → Save) → 272/272 thợ cùng màu GCI = POS; Anna đúng màu.
- VP-5479 Canceled theo dev; VP-5481 còn Unassigned + thợ không màu → Todo, assign Thien Duy.

## Automation

`npm run test:attach -- --spec tests/regression/appointment/vp-4402-staff-column-order-color.spec.ts` (hoặc `npm run test:spec -- <spec>`)
TC-12, TC-13 gắn `@broken` (fail tới khi VP-5481 được fix).
07/11/2026: bỏ 6 TC skip theo yêu cầu user — TC-05 (VP-5479 Canceled), TC-08/09/10 (card appointment, thiếu dữ liệu), TC-15/16 (không tự động được). Không đánh số lại các TC còn lại.

### Lần chạy 07/11/2026 — POS 1.1.107, store 14 (attach lane), sau khi bỏ 6 TC skip

**8 PASS / 2 FAIL / 0 SKIP** (10 TC)

| TC ID        | Kết quả         | Ghi chú                                                                                                                            |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TC-VP4402-01 | PASS            | 1.1.107 ≥ 1.1.87                                                                                                                   |
| TC-VP4402-02 | PASS            | thứ tự cột = `staff_appointment`                                                                                                   |
| TC-VP4402-03 | PASS            | 1001vvv (priority 0) sau mọi thợ có thứ tự — đúng logic hiện tại                                                                   |
| TC-VP4402-04 | PASS            | thợ không có row nằm cuối                                                                                                          |
| TC-VP4402-06 | PASS            | dropdown Staffs A→Z                                                                                                                |
| TC-VP4402-07 | PASS            | thứ tự cột không đổi khi sang ngày mai                                                                                             |
| TC-VP4402-11 | PASS            | header = `staff.colorHex` cho mọi thợ có màu                                                                                       |
| TC-VP4402-12 | FAIL 🐞 VP-5481 | 25 cột còn xám `#CDCCD2` (24 thợ không màu + JD POS-only): taff 12347, Shelby, JS, JDD, JSS, JD1119, …, KKate, WWave, Phong001, JD |
| TC-VP4402-13 | FAIL 🐞 VP-5481 | Unassigned `#4D4A5B`, mong đợi `#5669FF`                                                                                           |
| TC-VP4402-14 | PASS            | Anna `#96BDF5`                                                                                                                     |
