---
title: Appointment — thứ tự cột thợ theo GAP + màu appointment theo thợ — test cases
ticket: VP-4402 — https://linear.app/fastboy/issue/VP-4402/improvement-ticket-1548610-appointment-sap-xep-thu-tu-cot-tho-va-mau
spec-files: tests/regression/appointment/vp-4402-staff-column-order-color.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [POS] Appointment: sắp xếp thứ tự cột thợ và màu appointment giống GAP

**Ticket:** [VP-4402](https://linear.app/fastboy/issue/VP-4402/improvement-ticket-1548610-appointment-sap-xep-thu-tu-cot-tho-va-mau) · Ticket CRM #1548610 (Xpo Nails #19388) · PR volt-pos#3274 (POS) · volt-pos-api#1566 / VP-5094 (BE sync `employee.priority`)
**Dev:** Thien Duy (`thienduy_vo`), Thanh Lam (`lam_doan`, BE) · **Bug con:** VP-5479 (1001vvv bị xếp cuối board), VP-5481 (màu cột khác GAP)

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

| TC ID        | Title                                              | Priority | Precondition                                      | Test Data                                                             | Steps                                                                                                    | Expected Result                                                                                                                                                  | Status |
| ------------ | -------------------------------------------------- | -------- | ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4402-01 | POS đã lên version có tính năng                    | High     | POS dev đã update                                 | Version ≥ 1.1.87                                                      | 1. Kiểm tra version POS                                                                                  | POS chạy ≥ **1.1.87** (build sau khi merge PR #3274)                                                                                                             | ✅     |
| TC-VP4402-02 | Thứ tự cột thợ trên POS giống GAP                  | High     | GAP đã có thứ tự thợ; đã sync `staff_appointment` | 297 thợ có trên cả 2 board, ngày 11/02                                | 1. Mở Appointment Overview. 2. Đọc toàn bộ header cột (cuộn ngang). 3. So với thứ tự `staff_appointment` | Thứ tự cột POS = thứ tự `priority` (= thứ tự GAP); 296/297 thợ khớp (thợ lệch: TC-05)                                                                            | ✅     |
| TC-VP4402-03 | Thợ có `priority = 0` đứng sau thợ có thứ tự       | Medium   | Có thợ GCI gửi `priority = 0`                     | —                                                                     | 1. Đọc board. 2. Lấy vị trí các thợ `priority = 0`                                                       | Mọi thợ `priority = 0` nằm sau mọi thợ `priority > 0` và trước thợ không có row                                                                                  | ⚠️     |
| TC-VP4402-04 | Thợ chưa có row `staff_appointment` xếp cuối board | Medium   | Có thợ POS-only / chưa sync                       | 333, abc xyz30, Bell, Ben, Delete, Elise Terry, Emma2, JD, TestSalary | 1. Cuộn tới cuối board                                                                                   | Nhóm thợ không có row nằm cuối, theo thứ tự tên                                                                                                                  | ⚠️     |
| TC-VP4402-05 | VP-5479: thợ 1001vvv đứng thứ 2 như GAP            | Medium   | 1001vvv đứng thứ 2 trên GAP                       | 1001vvv                                                               | 1. So vị trí cột 1001vvv trên GAP và POS                                                                 | 1001vvv đứng **ngay sau Unassigned** trên POS; mọi thợ trên board đều có row `staff_appointment`. Hiện tại: POS xếp cuối board (không có row) → fail tới khi fix | ⚠️     |
| TC-VP4402-06 | Dropdown Staffs vẫn A→Z                            | Low      | Đang ở Appointment Overview                       | —                                                                     | 1. Mở filter **Staffs**                                                                                  | Danh sách thợ trong dropdown giữ thứ tự tên A→Z (chỉ board đổi theo GAP)                                                                                         | ✅     |
| TC-VP4402-07 | Thứ tự cột không đổi khi chuyển ngày               | Medium   | —                                                 | Hôm nay → ngày mai                                                    | 1. Đọc thứ tự cột. 2. Next day. 3. Đọc lại                                                               | Thứ tự cột giống hệt giữa 2 ngày                                                                                                                                 | ✅     |

## 2. Màu appointment / cột

| TC ID        | Title                                            | Priority | Precondition                                           | Test Data                                 | Steps                                                 | Expected Result                                                                                     | Status |
| ------------ | ------------------------------------------------ | -------- | ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4402-08 | Card appointment có màu theo thợ (thợ đã có màu) | High     | Có appointment gán thợ trong 7 ngày tới (tạo trên GAP) | Isabella 2:15 PM, Merri 1 3:45 PM (11/02) | 1. Tạo trên GAP. 2. Mở POS Appointment, tới đúng ngày | Nền card pha màu nhạt của thợ (Isabella xanh, Merri 1 cam), viền trái đúng màu thợ = màu header cột | ⚠️     |
| TC-VP4402-09 | Appointment chưa gán thợ hiển thị đúng cột       | Medium   | Có appointment Unassigned trong 7 ngày tới             | Unassigned 3:00 PM (11/02)                | 1. Tạo Unassigned trên GAP. 2. Mở POS Appointment     | Card nằm ở cột **Unassigned**, không bị tô màu thợ khác (không pha màu)                             | ⚠️     |
| TC-VP4402-10 | Appointment ngày khác                            | Medium   | Có appointment gán thợ ở ngày khác hôm nay             | Erin 2:00 PM (11/03)                      | 1. Tạo trên GAP ngày mai. 2. POS chuyển sang ngày đó  | Card nằm đúng cột thợ, nền pha màu thợ; thứ tự cột không đổi                                        | ⚠️     |
| TC-VP4402-11 | Màu header cột = màu thợ                         | Medium   | Đang ở Appointment Overview                            | Mọi cột                                   | 1. Đọc màu viền dưới header từng cột                  | = `staff.colorHex`; thợ `colorHex = null` → `#CDCCD2`                                               | ✅     |

## 3. Bug VP-5481 — màu cột trên POS không giống GAP

| TC ID        | Title                                                  | Priority | Precondition                   | Test Data                                                                        | Steps                                 | Expected Result                                                                                                                                      | Status |
| ------------ | ------------------------------------------------------ | -------- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4402-12 | VP-5481: thợ chưa chọn màu trên POS vẫn có màu như GAP | High     | Thợ trên POS `colorHex = null` | Teri Jennings (vàng `#F8D885`), Lizzie Wade (`#A0AFF0`), Ramona Dunn (`#96BDF5`) | 1. So màu header/card trên GAP và POS | Không cột nào trên board POS còn màu xám mặc định `#CDCCD2`; 3 thợ trên đúng màu GAP. Hiện tại: 140 thợ xám (2284/2492 thợ `colorHex = null`) → fail | ⚠️     |
| TC-VP4402-13 | VP-5481: cột Unassigned màu xanh như GAP               | Medium   | —                              | Unassigned                                                                       | 1. So màu header cột Unassigned       | Xanh `#5669FF` như GAP. Hiện tại: xám đậm `#4D4A5B` → fail                                                                                           | ⚠️     |
| TC-VP4402-14 | VP-5481: thợ Anna đúng màu GAP                         | Low      | Có thợ Anna trên board         | Anna                                                                             | 1. So màu cột Anna                    | Xanh `#96BDF5` như GAP. Hiện tại: cam `#E3AA8A` → fail                                                                                               | ⚠️     |

## 4. Không tự động được ở đây

| TC ID        | Title                                             | Priority | Precondition           | Test Data  | Steps                                                                        | Expected Result                                              | Status |
| ------------ | ------------------------------------------------- | -------- | ---------------------- | ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| TC-VP4402-15 | So sánh trực quan board GAP vs POS                | High     | Đăng nhập GAP store 14 | Ngày 11/02 | 1. Tạo appointment trên GAP. 2. Chụp board GAP và POS cùng ngày, so từng cột | Thứ tự cột + màu cột/card trên POS giống GAP                 | 🧱     |
| TC-VP4402-16 | POS không ghi/đổi được thứ tự `staff_appointment` | Medium   | —                      | —          | 1. Gọi API POST/PUT row `staff_appointment`                                  | API từ chối (POST 422 / PUT 403); đổi thứ tự chỉ qua GCI/CRM | 🧱     |

## Kết quả test tay (02/11/2026, POS Windows 1.1.87)

Pass 5 / Fail 2 (TC-VP4402-05 → VP-5479, TC-VP4402-12 → VP-5481) — đã comment vào VP-4402.

## Automation

`npm run test:attach -- --spec tests/regression/appointment/vp-4402-staff-column-order-color.spec.ts` — chưa chạy (lead chạy tuần tự sau).
TC-05, TC-12, TC-13, TC-14 gắn `@broken` (fail tới khi VP-5479 / VP-5481 được fix).
