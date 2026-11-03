---
title: Font Size setting + Print All Staff Income (POS) — test cases
ticket: VP-4809 — https://linear.app/fastboy/issue/VP-4809/improvement-ticket-1561986-djieu-chinh-co-chu-va-print-all-staff
feature-spec: docs/report-field-formulas.md
spec-files: tests/regression/incomes/vp-4809-font-size-print.spec.ts, tests/web/portal-vp-4809-font-size.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-03
---

# Test Cases – [Improvement] Ticket #1561986 — Điều chỉnh cỡ chữ và Print All Staff Income

**Ticket:** [VP-4809](https://linear.app/fastboy/issue/VP-4809/improvement-ticket-1561986-djieu-chinh-co-chu-va-print-all-staff) · PR volt-pos#3087 (POS) · fastboy-portal#845 (Portal) · volt-pos-api#1535 (API — flag `merchant_theme_pos_style.font_size`)
**Dev:** Ngan Huynh (`ngan_huynh`) · **Tiệm khách:** Larita Nail Spa (#21397) · CRM #1561986
**Sub-issue:** không có (02/11/2026).

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.86** (bản đã có PR volt-pos#3087).
- Đã đăng nhập POS; passcode owner theo `.env` (`OWNER_PASSCODE`).
- **Request 1 – Font Size**
  - POS: ☰ → Settings → **Accessibility** → card **Font Size** (Small / Medium / Large, radio `font-size-small|medium|large`).
  - Giá trị lưu ở `sys_setting` key **`merchant_theme_pos_style`**, field JSON **`font_size`** (`small`/`medium`/`large`). Không có row / giá trị lạ ⇒ **Medium**.
  - POS áp dụng bằng `data-font-size` trên `<html>`: chữ `text-*` = `--font-size-base × 0.875 / 1 / 1.125`; **khoảng cách/layout (rem) không đổi**.
  - Đổi thành công → toast **"Font size updated"** / "Đã cập nhật cỡ chữ".
  - Setting là **global của tiệm** → spec chạy `@exclusive`, chụp giá trị ban đầu và trả lại sau khi chạy.
- **Request 2 – Print All Staff Income** (màn **Reports V4**: `/report-pages/v4/staff-payroll`, `/report-pages/v4/staff-income`)
  - Danh sách staff có **ô tick** ở cột đầu mỗi dòng + **tick-all** ở header (`report-table-tick-all`, aria-label "Select All").
  - Có tick ⇒ nút đọc **"Print (n)"**; nhấn ⇒ tất cả staff đã tick in trên **1 receipt**, mỗi staff 1 phần riêng (dòng `Date:` + `Staff: <tên>`), theo thứ tự danh sách; trong lúc gom có modal **"Preparing n of m…"**.
  - In xong ⇒ bỏ hết tick. Staff không có số liệu (mọi số = 0) bị bỏ khỏi receipt ⇒ toast "Skipped n staff…"; nếu không ai có số liệu ⇒ toast **"Nothing to print for the ticked staff"** và **giữ tick**.
  - Không tick ⇒ Print in staff đang xem như cũ. Chưa chọn staff + không tick ⇒ **không có nút Print**.
  - Tick **không** chọn dòng (panel phải vẫn "No detail to show"); đổi kỳ ⇒ xoá tick; tick của staff bị search ẩn ⇒ bị bỏ.
  - Automation **không in ra giấy**: spec bọc `window.__TAURI_INTERNALS__.invoke`, chặn mutation `print` và đọc nội dung ESC/POS (base64) để kiểm tra từng phần `Staff: …`.

Chú thích trạng thái: ✅ tự động hoá được trên POS Windows (hoặc Portal — web lane, Edge `.portal-profile`) · ⚠️ tự động hoá có điều kiện (dữ liệu / bọc IPC in) · 🧱 chưa tự động được ở đây (Portal, Android, bản in giấy, restart app) · 📄 chỉ tài liệu.

## 1. Font Size — POS (Settings > Accessibility)

| TC ID        | Title                                                         | Priority | Precondition                                                            | Test Data      | Steps                                                                 | Expected Result                                                                                                                        | Status |
| ------------ | ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4809-01 | Hiển thị setting Font Size (TC-FS-01)                         | High     | POS ≥ 1.1.86                                                            | –              | 1. ☰ → Settings → Accessibility. 2. Xem card Font Size               | Có card **Font Size** với đúng 3 lựa chọn **Small / Medium / Large**, đúng 1 lựa chọn được chọn                                        | ✅     |
| TC-VP4809-02 | Chọn Small (TC-FS-02)                                         | High     | Đang ở Accessibility                                                    | Small          | 1. Chọn Small                                                         | `<html data-font-size="small">`, chữ nhỏ lại ngay (×0.875 — vd. 20px → 17.5px); `merchant_theme_pos_style.font_size` = `small`         | ✅     |
| TC-VP4809-03 | Chọn Medium (TC-FS-03)                                        | High     | Đang ở Accessibility                                                    | Medium         | 1. Chọn Medium                                                        | `data-font-size="medium"`, chữ cỡ gốc (×1 — 20px); lưu `medium`                                                                        | ✅     |
| TC-VP4809-04 | Chọn Large (TC-FS-04)                                         | High     | Đang ở Accessibility                                                    | Large          | 1. Chọn Large                                                         | `data-font-size="large"`, chữ lớn (×1.125 — 22.5px); lưu `large`                                                                       | ✅     |
| TC-VP4809-05 | Chỉ cỡ chữ đổi, khoảng cách/layout giữ nguyên                 | Medium   | Đang ở Accessibility                                                    | Small → Large  | 1. Chọn Small, đo `1rem`. 2. Chọn Large, đo `1rem`                    | `1rem` (spacing) **không đổi** giữa các lựa chọn; chỉ `text-*` thay đổi                                                                | ✅     |
| TC-VP4809-06 | Toast xác nhận khi đổi cỡ chữ                                 | Low      | Đang ở Accessibility                                                    | Medium → Large | 1. Chọn một cỡ khác cỡ hiện tại                                       | Toast **"Font size updated"** / "Đã cập nhật cỡ chữ"; chọn lại đúng cỡ đang chọn thì không lưu lại                                     | ✅     |
| TC-VP4809-07 | Large áp dụng trên các màn khác (TC-FS-05)                    | Medium   | Font Size = Large                                                       | –              | 1. Mở Pending Orders. 2. Mở Order History                             | Mỗi màn vẫn `data-font-size="large"`, chữ to lên, **không tràn ngang** (không có thanh cuộn ngang trang)                               | ✅     |
| TC-VP4809-08 | Giữ lựa chọn khi chuyển màn (TC-FS-06)                        | Medium   | Đã chọn 1 cỡ chữ                                                        | Small          | 1. Chọn Small. 2. Về Home → Pending Orders. 3. Quay lại Accessibility | Vẫn là Small (radio + `data-font-size`)                                                                                                | ✅     |
| TC-VP4809-09 | Giữ lựa chọn sau reload / tắt mở lại app (TC-FS-06, TC-FS-07) | Medium   | Font Size = Large                                                       | –              | 1. Reload app (hoặc tắt hẳn POS). 2. Mở lại                           | Vẫn là Large — **🧱 attach mode không restart được POS dùng chung**; đã PASS tay 02/11 (1.1.86)                                        | 🧱     |
| TC-VP4809-10 | Lưu font_size không xoá field khác của Theme Pos Style        | Medium   | Row `merchant_theme_pos_style` có thể có field khác (Portal)            | Medium → Large | 1. Đọc JSON đã lưu. 2. Đổi cỡ chữ. 3. Đọc lại                         | Chỉ `font_size` đổi; mọi field khác giữ nguyên giá trị                                                                                 | ✅     |
| TC-VP4809-11 | Mặc định Medium cho tiệm chưa có setting                      | High     | Tiệm **chưa** có row `merchant_theme_pos_style` (hoặc `font_size` null) | Tiệm mới       | 1. Mở Accessibility                                                   | Medium được chọn, chữ cỡ gốc — **🧱 cần tiệm mới; tiệm DEV đã có row** (chưa kiểm tra được 02/11)                                      | 🧱     |
| TC-VP4809-12 | Customer Display không bị đổi cỡ chữ                          | Low      | Có cửa sổ Customer Display                                              | Large          | 1. Chọn Large. 2. Xem cửa sổ Customer Display                         | `<html>` của Customer Display **không** có `data-font-size` (setting chỉ áp dụng cửa sổ staff — theo commit PR #3087, cần PO xác nhận) | ⚠️     |

## 2. Font Size — Portal

| TC ID        | Title                                                     | Priority | Precondition            | Test Data | Steps                                                                  | Expected Result                                                                                                                         | Status |
| ------------ | --------------------------------------------------------- | -------- | ----------------------- | --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4809-13 | Portal: Store Setting > Configuration có Font Size        | High     | Portal DEV, merchant 14 | –         | 1. Portal → Store Setting → Configuration                              | Có setting **Font Size** 3 lựa chọn Small/Medium/Large, mặc định Medium — chạy trên Portal web lane (`npm run portal:vp-4809`, chỉ đọc) | ✅     |
| TC-VP4809-14 | Đổi trên Portal → POS áp dụng sau sync, không cần restart | High     | POS đang mở             | Large     | 1. Portal chọn Large → Save. 2. Chờ POS pull `sys_setting`. 3. Xem POS | POS đổi sang Large, radio Accessibility = Large — **🧱 cross-surface: Portal lane đã sẵn (`.portal-profile`), phía POS chưa nối**       | 🧱     |

## 3. Print All Staff Income — Reports V4 (Staff Payroll / Staff Income)

| TC ID        | Title                                                 | Priority | Precondition                                     | Test Data                  | Steps                                                | Expected Result                                                                                                           | Status |
| ------------ | ----------------------------------------------------- | -------- | ------------------------------------------------ | -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4809-15 | Staff Payroll V4 có ô tick mỗi dòng + tick-all        | High     | Mở `/report-pages/v4/staff-payroll`, kỳ hiện tại | –                          | 1. Xem cột đầu danh sách staff                       | Header có ô **Select All**; mỗi dòng staff có 1 ô tick, aria-label = tên staff; mặc định chưa tick                        | ✅     |
| TC-VP4809-16 | Staff Income V4 cũng có ô tick                        | High     | Mở `/report-pages/v4/staff-income`               | –                          | 1. Xem cột đầu danh sách staff                       | Có tick-all + ô tick mỗi dòng như Staff Payroll                                                                           | ✅     |
| TC-VP4809-17 | Chưa chọn staff và chưa tick → không có nút Print     | Medium   | Vừa mở Staff Payroll V4, chưa chọn dòng nào      | –                          | 1. Mở trang. 2. Tìm nút Print                        | Không có nút Print (giống màn cũ khi chưa chọn staff); panel phải "No detail to show"                                     | ⚠️     |
| TC-VP4809-18 | Tick 1 staff → "Print (1)", tick không mở detail      | High     | Staff Payroll V4, chưa chọn dòng                 | Staff đầu danh sách        | 1. Tick ô của 1 staff                                | Nút hiện **"Print (1)"**; dòng **không** được chọn (panel phải vẫn "No detail to show")                                   | ✅     |
| TC-VP4809-19 | Tick-all / bỏ tick-all                                | High     | Staff Payroll V4                                 | –                          | 1. Tick ô Select All. 2. Bỏ tick Select All          | B1: mọi dòng được tick, nút **"Print (N)"** với N = **Total staff**. B2: bỏ hết tick, nút không còn số                    | ✅     |
| TC-VP4809-20 | In nhiều staff trên 1 receipt, mỗi staff 1 phần riêng | Critical | Staff Payroll V4, ≥ 2 staff có số liệu trong kỳ  | 2–3 staff có Orders > 0    | 1. Tick 2–3 staff. 2. Nhấn Print (n)                 | Gửi **đúng 1** lệnh in; receipt có lần lượt từng `Staff: <tên>` theo **thứ tự danh sách**, mỗi phần có dòng `Date:` riêng | ⚠️     |
| TC-VP4809-21 | Modal "Preparing n of m" khi đang gom dữ liệu         | Medium   | Như TC-20                                        | 3 staff                    | 1. Tick 3 staff. 2. Nhấn Print (3). 3. Quan sát      | Modal **"Preparing 1 of 3… / Please wait"** che trang, không bấm được gì; tự đóng khi in xong                             | ⚠️     |
| TC-VP4809-22 | In xong → bỏ hết tick                                 | Medium   | Như TC-20                                        | –                          | 1. In nhiều staff thành công. 2. Xem danh sách + nút | Mọi ô tick bỏ chọn; nút không còn "(n)"                                                                                   | ⚠️     |
| TC-VP4809-23 | Không tick → Print in staff đang xem như cũ           | High     | Đã chọn 1 staff có số liệu, không tick           | Staff có Orders > 0        | 1. Click 1 staff (mở detail). 2. Nhấn Print          | 1 receipt, **1 phần** `Staff: <tên staff đang xem>`                                                                       | ⚠️     |
| TC-VP4809-24 | Chỉ tick staff không có số liệu → không in, giữ tick  | Medium   | Kỳ có staff Orders = 0 và mọi số = $0.00         | 1 staff toàn $0.00         | 1. Tick staff đó. 2. Nhấn Print (1)                  | Không gửi lệnh in; toast **"Nothing to print for the ticked staff"**; ô tick vẫn giữ                                      | ⚠️     |
| TC-VP4809-25 | Đổi kỳ → xoá tick                                     | Medium   | Staff Payroll V4 có ≥ 2 kỳ                       | –                          | 1. Tick 1 staff. 2. Đổi sang kỳ khác                 | Không còn ô nào được tick, nút không còn "(n)"                                                                            | ✅     |
| TC-VP4809-26 | Search ẩn staff đã tick → tick đó bị bỏ               | Medium   | Staff Payroll V4                                 | Tick A, search tên B (≠ A) | 1. Tick staff A. 2. Search tên staff B               | Tick của A bị bỏ (A không còn trong list) → nút không còn "(1)" cho A                                                     | ✅     |
| TC-VP4809-27 | Staff Income V4: in nhiều staff trên 1 receipt        | High     | Staff Income V4, hôm nay có ≥ 2 staff có số liệu | 2 staff                    | 1. Tick 2 staff. 2. Nhấn Print (2)                   | 1 lệnh in, 2 phần `Staff: <tên>` theo thứ tự danh sách                                                                    | ⚠️     |

<!-- Tạm tắt (cần máy in nhiệt thật): | TC-VP4809-28 | Bản in giấy thực tế: mỗi staff tách bạch, đọc rõ         | High     | Máy in nhiệt thật                                | 3 staff                    | 1. In 3 staff. 2. Xem giấy                           | 1 tờ, header tiệm 1 lần, mỗi staff có vạch `====` + Date/Staff riêng, không lẫn số — **🧱 cần máy in thật, không kiểm tra giấy tự động** | 🧱     | -->

## Ghi chú

- TC-VP4809-13 chạy trên Portal web lane: `npm run portal:vp-4809` (`tests/web/portal-vp-4809-font-size.spec.ts`) — chỉ đọc radio `Font size` (Store Settings → Configuration), không đổi cỡ chữ của tiệm. "Mặc định Medium" = giá trị hiện tại của tiệm 14 (spec POS `@exclusive` trả lại Medium sau khi chạy). PASS 03/11/2026.
- Kết quả test tay 02/11/2026 (POS 1.1.86): Request 1 PASS 7/7 (TC-FS-01…07 ↔ TC-VP4809-01…04, 07, 08, 09). Request 2 chưa có kết quả tay — các TC 15–29 lấy từ mô tả ticket + code PR volt-pos#3087.
- TC-20…24, 27 dùng **bọc IPC in** (chặn mutation `print`, không ra giấy). Nếu `__TAURI_INTERNALS__.invoke` không cho bọc (bản build khoá thuộc tính), các TC đó **skip** kèm lý do.
- Màn Staff Income / Staff Payroll **cũ** (`/incomes/...`) không thuộc phạm vi tick-in-nhiều (PR chỉ sửa `report-pages`).
