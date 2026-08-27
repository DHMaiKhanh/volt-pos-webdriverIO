---
title: Employees (Nhân viên)
route: /settings/staffs, /settings/staffs/$staffId
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Employees — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Màn quản lý nhân viên, gồm 2 panel: danh sách `All Employees` (tìm kiếm, lọc trạng thái,
kéo-thả thứ tự, tạo mới) và **chi tiết nhân viên với 5 tab**: `Information`,
`Compensation`, `Service Skills`, `Work Hours`, `Permissions` — dùng chung một nút `Save`.

Đây là màn có form phức tạp nhất trong nhóm Settings.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

**Panel danh sách**

| Thành phần     | Locator                                                                             | Ghi chú                                                                                      |
| -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tiêu đề        | `getByRole('heading', { name: 'All Employees' })` (level 3)                         |                                                                                              |
| Kéo-thả thứ tự | `getByRole('button', { name: 'Reorder Employees' })`                                |                                                                                              |
| Tạo nhân viên  | `button` **không có accessible name** (icon `+`) cạnh nút Reorder                   | mở dialog "Create New Staff"                                                                 |
| Tìm kiếm       | `getByRole('textbox', { name: 'Search employee' })`                                 |                                                                                              |
| Lọc trạng thái | `button[role="combobox"]` hiện `All`                                                | options: `All`, `Active`, `Inactive`                                                         |
| Item nhân viên | `getByRole('link', { name: 'Kevin Kevin Active' })`, href `/settings/staffs/<uuid>` | 11 item lúc quét; accessible name = **tên lặp 2 lần** (alt avatar + text) + badge trạng thái |
| Placeholder    | `paragraph` "Select a staff member to view details."                                |                                                                                              |

**Chi tiết nhân viên**

- `heading` level 3 = nickname (ví dụ `Kevin`) — **có** hiển thị (khác màn Roles bị rỗng).
- `tablist` 5 tab; `Information` selected mặc định.
- `button` `Save` — disabled khi chưa thay đổi.

**Tab `Information`**

| Field             | Locator                                                    | Giá trị lúc quét      |
| ----------------- | ---------------------------------------------------------- | --------------------- |
| Appointment Staff | `#isAllowBooking` (switch)                                 | ON                    |
| First Name        | `#firstName`                                               | rỗng                  |
| Last Name         | `#lastName`                                                | rỗng                  |
| Nick Name         | `#nickname`                                                | `Kevin`               |
| Phone             | `input[name="phone"]` (**id sinh động**)                   | rỗng                  |
| Email             | `#email`                                                   | `emp4@go-checkin.com` |
| SSN (Optional)    | `#ssn`                                                     | rỗng                  |
| Employee group    | `combobox` "Select employee group"                         | chưa chọn             |
| Vai trò           | `combobox` hiện `Staff`                                    |                       |
| Staff Code        | `input[name="staffCode"]` (**id sinh động**)               | `0002`                |
| Address           | `#address`                                                 | rỗng                  |
| Country / State   | 2 `combobox` (**id sinh động**), label `Country` / `State` | chưa chọn             |
| City              | `#city`                                                    | rỗng                  |
| Postal / Zip Code | `#postalCode`                                              | rỗng                  |

**Tab `Compensation`** — 3 chế độ: `Commission`, `Commission + Salary`, `Salary`.
Radio kiểu lương: `#salary_by_period` (checked), `#wage_per_day`, `#wage_per_hour`.
Field: `input[name="salaryAmount"]` = `$2,000.00` · `input[name="cashCheckSplit"]` = `50`
(kèm ô `50%`) · `input[name="deductionPerDay"]` = `$20.00` ·
`input[name="percentCreditCardTip"]` = `50` · switch `#enablePayrollTip` nhãn
**"Exclude Tips From Cash/Check Income"** (OFF).

**Tab `Service Skills`** — dịch vụ nhóm theo category (`ACRYLIC`, `ADD-ONS`, …), mỗi dịch
vụ là một nút/checkbox bật-tắt kỹ năng.

**Tab `Work Hours`** — `button` `Sync with Business Hours` + **7 switch** theo thứ
`Monday`…`Sunday` (đều ON lúc quét), mỗi ngày kèm khoảng giờ hiển thị `-`.

**Tab `Permissions`** — `Assigned Role` (mô tả: "This role controls base permissions for
this staff member.") + `Extra Permission Only` (mô tả: "Only permissions not included in
the _Manager_ role are shown below. Role-based permissions cannot be disabled here.") +
cây `Access` với nút `Collapse All`, 5 nhóm và **14 switch** (chỉ quyền con, 1 cột).

**Dialog "Create New Staff"** — mọi input đều có `name` nhưng **id sinh động** ⇒ locate
theo `input[name=...]` hoặc label:
`firstName` (`e.g. Jenny`) · `lastName` (`e.g. Nguyen`) · `nickname` (`e.g. Jen`) ·
`phone` · `email` · `ssn` · `staffCode` (`Enter 4 digit code`) · `address`
(`e.g. 2799 Katy Fwy .Ste. 130`) · `city` · `postalCode` (`Enter 5 digit zip code`) ·
combobox `Select employee group`, vai trò (default `Staff`), `Select a country`,
`Select a state` (**disabled** khi chưa chọn country) · `button` `Create` (**enabled ngay
khi form còn trống**) · `button` `Close`.

### 3. Luồng chính đã quan sát

1. Mở `/settings/staffs` → danh sách 11 nhân viên + placeholder.
2. Mở combobox lọc → 3 option `All` / `Active` / `Inactive`.
3. Click nhân viên `Kevin` → URL `/settings/staffs/<uuid>`, heading = `Kevin`, tab `Information` active, `Save` disabled.
4. Lần lượt click 4 tab còn lại → mỗi tab render nội dung riêng, `Save` vẫn disabled.
5. Click nút `+` → dialog "Create New Staff" với `Create` **đã enabled** dù form trống; `State` disabled cho tới khi chọn `Country`.
6. Escape → dialog đóng, không tạo nhân viên.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- `Save` cấp màn, dùng chung cho cả 5 tab; gate theo dirty.
- `State` phụ thuộc `Country` (disabled tới khi chọn quốc gia).
- Quyền của nhân viên = quyền theo vai trò (không sửa ở đây) **+** quyền bổ sung
  (`Extra Permission Only`) — nên tab này chỉ hiện 14 quyền con, không có cột vai trò.
- `Work Hours` có nút đồng bộ giờ từ Business Hours (`/settings/business`).

### 5. Trạng thái / quyền / edge case

- 🐞 **Tab Permissions ghi sai tên vai trò**: `Assigned Role` = **Staff** nhưng mô tả bên
  dưới lại nói "not included in the **Manager** role" ⇒ chuỗi mô tả không lấy theo vai trò
  thật của nhân viên đang xem.
- ⚠️ **`Create` enabled khi form trống** (khác `Create Category` bị disable) ⇒ validation
  dồn vào lúc submit; cần case xác nhận bấm `Create` với form trống **không** tạo nhân viên
  mà hiện lỗi.
- ⚠️ **7 switch Work Hours đều ON nhưng khoảng giờ là `-`** (không có giờ) ⇒ cần xác nhận
  ngày "bật mà không có giờ" là hợp lệ hay là dữ liệu thiếu.
- ⚠️ **Console error/warning thật khi mở màn này** (cần biết để không nhầm là do test):
  - `[ERROR] A component is changing an uncontrolled input to be controlled` (form nhân viên)
  - `[WARNING] Switch is changing from uncontrolled to controlled`
  - `[WARNING] Missing 'Description' or 'aria-describedby' for {DialogContent}` (×2, lỗi a11y của dialog)
  - `[ERROR] Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME @ asset://localhost/`
    — **avatar nhân viên dùng protocol `asset://` của Tauri**, không load được trong
    Chromium. Đây là hạn chế môi trường test, **không** phải bug app; đừng assert avatar
    load được.
    ⇒ Test kiểu "không có console error" (như `TC-SETTINGS-12`) sẽ **fail** ở màn này nếu
    không whitelist các lỗi trên.
- Không có passcode gate.
- Không thấy hành động **xoá** nhân viên trong phạm vi đã quét.

## Test Cases

| ID        | Tiêu đề                                       | Tiền điều kiện          | Các bước                                                                           | Kết quả mong đợi                                                                                                                                                                                                                                                                             | Ưu tiên |
| --------- | --------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-EMP-01 | Màn danh sách render đủ điều khiển            | Đã đăng nhập            | 1. Goto `/settings/staffs`                                                         | `heading` "All Employees"; `button` `Reorder Employees`; nút `+`; `textbox` "Search employee"; combobox lọc `All`; `paragraph` "Select a staff member to view details."                                                                                                                      | P1      |
| TC-EMP-02 | Danh sách hiện nhân viên kèm badge trạng thái | Ở `/settings/staffs`    | 1. Đọc các `link` nhân viên                                                        | Mỗi item có href `/settings/staffs/<uuid>` và badge `Active`/`Inactive`                                                                                                                                                                                                                      | P1      |
| TC-EMP-03 | Combobox lọc có 3 lựa chọn                    | Ở `/settings/staffs`    | 1. Click combobox `All`                                                            | Options: `All`, `Active`, `Inactive`                                                                                                                                                                                                                                                         | P1      |
| TC-EMP-04 | Lọc Active chỉ còn nhân viên đang hoạt động   | Ở `/settings/staffs`    | 1. Chọn `Active`                                                                   | Mọi item còn lại có badge `Active`; số item ≤ tổng ban đầu                                                                                                                                                                                                                                   | P1      |
| TC-EMP-05 | Lọc Inactive chỉ còn nhân viên đã tắt         | Ở `/settings/staffs`    | 1. Chọn `Inactive`                                                                 | Mọi item còn lại có badge `Inactive`                                                                                                                                                                                                                                                         | P1      |
| TC-EMP-06 | Tìm kiếm lọc theo tên                         | Ở `/settings/staffs`    | 1. Fill "Search employee" = `kevin`                                                | Danh sách chỉ còn item khớp `Kevin` (không phân biệt hoa thường)                                                                                                                                                                                                                             | P1      |
| TC-EMP-07 | Tìm kiếm không khớp                           | Ở `/settings/staffs`    | 1. Fill = `zzzznotexist`                                                           | Danh sách 0 item; ghi nhận có/không empty-state                                                                                                                                                                                                                                              | P2      |
| TC-EMP-08 | Click nhân viên mở chi tiết                   | Ở `/settings/staffs`    | 1. Click 1 nhân viên                                                               | URL = `/settings/staffs/<uuid>`; `heading` level 3 = nickname; `Save` disabled                                                                                                                                                                                                               | P1      |
| TC-EMP-09 | Chi tiết có đúng 5 tab, Information mặc định  | Đang xem 1 nhân viên    | 1. Đọc `tablist`                                                                   | 5 tab `Information`, `Compensation`, `Service Skills`, `Work Hours`, `Permissions`; `Information` `aria-selected="true"`                                                                                                                                                                     | P1      |
| TC-EMP-10 | Tab Information đủ field hồ sơ                | Tab Information active  | 1. Đọc form                                                                        | Có `#isAllowBooking` (ON), `#firstName`, `#lastName`, `#nickname`, `input[name="phone"]`, `#email`, `#ssn`, `input[name="staffCode"]`, `#address`, combobox `Country`/`State`, `#city`, `#postalCode`                                                                                        | P1      |
| TC-EMP-11 | Nickname và Staff Code prefill đúng dữ liệu   | Tab Information active  | 1. Đọc `#nickname` và `input[name="staffCode"]`                                    | Khớp với item đã click ở danh sách (ví dụ `Kevin` / `0002`)                                                                                                                                                                                                                                  | P1      |
| TC-EMP-12 | Tab Compensation có 3 chế độ lương            | Đang xem 1 nhân viên    | 1. Click tab `Compensation`                                                        | Thấy `Commission`, `Commission + Salary`, `Salary`                                                                                                                                                                                                                                           | P1      |
| TC-EMP-13 | Radio kiểu lương có 3 lựa chọn                | Tab Compensation active | 1. Đọc `#salary_by_period`, `#wage_per_day`, `#wage_per_hour`                      | `#salary_by_period` checked; 2 cái còn lại unchecked                                                                                                                                                                                                                                         | P1      |
| TC-EMP-14 | Field lương/tip prefill đúng định dạng tiền   | Tab Compensation active | 1. Đọc `salaryAmount`, `deductionPerDay`, `cashCheckSplit`, `percentCreditCardTip` | `$2,000.00` / `$20.00` / `50` / `50` — tiền có `$` và dấu phẩy, phần trăm là số trơn                                                                                                                                                                                                         | P2      |
| TC-EMP-15 | Switch loại trừ tip khỏi thu nhập cash/check  | Tab Compensation active | 1. Đọc `#enablePayrollTip`                                                         | Tồn tại với nhãn "Exclude Tips From Cash/Check Income", `aria-checked="false"`                                                                                                                                                                                                               | P2      |
| TC-EMP-16 | Tab Service Skills nhóm dịch vụ theo category | Đang xem 1 nhân viên    | 1. Click tab `Service Skills`                                                      | Thấy tên category (`ACRYLIC`, `ADD-ONS`, …) và các dịch vụ bật-tắt được bên dưới                                                                                                                                                                                                             | P1      |
| TC-EMP-17 | Tab Work Hours có 7 switch theo thứ           | Đang xem 1 nhân viên    | 1. Click tab `Work Hours`                                                          | 7 switch `Monday`…`Sunday` + `button` `Sync with Business Hours`                                                                                                                                                                                                                             | P1      |
| TC-EMP-18 | ⚠️ Ngày bật nhưng không có khoảng giờ         | Tab Work Hours active   | 1. Đọc khoảng giờ từng ngày                                                        | 7 switch ON nhưng giờ hiển thị `-` → cần xác nhận là hợp lệ hay dữ liệu thiếu                                                                                                                                                                                                                | P2      |
| TC-EMP-19 | Tab Permissions hiện vai trò được gán         | Đang xem 1 nhân viên    | 1. Click tab `Permissions`                                                         | Thấy `Assigned Role` + mô tả "This role controls base permissions for this staff member." và giá trị vai trò (ví dụ `Staff`)                                                                                                                                                                 | P1      |
| TC-EMP-20 | 🐞 Mô tả Extra Permission nói sai vai trò     | Tab Permissions active  | 1. So `Assigned Role` với mô tả bên dưới                                           | `Assigned Role` = `Staff` nhưng mô tả ghi "not included in the **Manager** role" — **không khớp vai trò thật**                                                                                                                                                                               | P2      |
| TC-EMP-21 | Cây quyền bổ sung có 14 switch                | Tab Permissions active  | 1. Đếm `[role="switch"]` trong tabpanel                                            | **14** (đúng số quyền con; không có cột vai trò như `/settings/permissions`)                                                                                                                                                                                                                 | P1      |
| TC-EMP-22 | Chuyển tab không làm form dirty               | Đang xem 1 nhân viên    | 1. Lần lượt click cả 5 tab                                                         | `Save` vẫn `disabled` sau khi đi hết 5 tab                                                                                                                                                                                                                                                   | P1      |
| TC-EMP-23 | Sửa field làm dirty và bật Save               | Tab Information active  | 1. Fill `#city` = `QA City`                                                        | `Save` enabled. **Không Save — reload để bỏ thay đổi**                                                                                                                                                                                                                                       | P1      |
| TC-EMP-24 | Reload bỏ thay đổi chưa lưu                   | Vừa làm TC-EMP-23       | 1. Reload route                                                                    | `#city` trở về rỗng; `Save` disabled; **không** có dialog cảnh báo khi rời trang                                                                                                                                                                                                             | P1      |
| TC-EMP-25 | Dialog Create New Staff đủ field              | Ở `/settings/staffs`    | 1. Click nút `+`                                                                   | `heading` "Create New Staff"; đủ các `input[name=...]` như bảng mô tả; combobox `Select employee group`, vai trò `Staff`, `Select a country`, `Select a state`                                                                                                                               | P1      |
| TC-EMP-26 | State bị khoá tới khi chọn Country            | Dialog Create mở        | 1. Đọc nút `Select a state`                                                        | `disabled = true` khi chưa chọn country                                                                                                                                                                                                                                                      | P1      |
| TC-EMP-27 | ⚠️ Create enabled khi form trống              | Dialog Create mở        | 1. Đọc nút `Create`                                                                | `disabled = false` dù mọi field trống → cần case xác nhận submit rỗng **không** tạo nhân viên mà hiện message lỗi (First Name / Nick Name / Staff Code)                                                                                                                                      | P1      |
| TC-EMP-28 | Escape đóng dialog, không tạo nhân viên       | Dialog Create mở        | 1. Nhấn `Escape`                                                                   | Dialog đóng; số item trong danh sách không đổi                                                                                                                                                                                                                                               | P1      |
| TC-EMP-29 | Placeholder các field Create đúng             | Dialog Create mở        | 1. Đọc placeholder                                                                 | `e.g. Jenny` / `e.g. Nguyen` / `e.g. Jen` / `Enter 4 digit code` / `Enter 5 digit zip code` / `e.g. 2799 Katy Fwy .Ste. 130`                                                                                                                                                                 | P3      |
| TC-EMP-30 | ⚠️ Màn này có console error nền               | Đang xem 1 nhân viên    | 1. Thu console                                                                     | Xuất hiện `uncontrolled input to be controlled`, `Switch is changing from uncontrolled to controlled`, `Missing 'Description' … {DialogContent}`, và `ERR_UNKNOWN_URL_SCHEME @ asset://localhost/` (avatar Tauri) ⇒ test "no console error" phải whitelist các lỗi này, **không** coi là bug | P1      |
