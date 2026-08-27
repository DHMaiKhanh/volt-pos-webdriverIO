---
title: Roles (Vai trò)
route: /settings/roles, /settings/roles/$roleId
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Roles — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Xem 4 vai trò hệ thống kèm số thành viên, và **gán nhân viên vào vai trò**. Layout 2 panel
trong vùng nội dung: danh sách vai trò (bên trái) · chi tiết vai trò với bảng nhân viên
(bên phải).

Không có chức năng tạo/xoá/đổi tên vai trò — 4 vai trò là cố định
(`Owner`, `Manager`, `Partner`, `Staff`).

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần           | Vai trò (role/label)                                                              | Trạng thái lúc quét                              | Ghi chú                                              |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Tiêu đề danh sách    | `getByRole('heading', { name: 'Roles' })` — level 1                               |                                                  |                                                      |
| Header cột           | `paragraph` "Role" và `paragraph` "Members Count"                                 |                                                  |                                                      |
| Item vai trò         | `getByRole('link', { name: 'Owner 11 Members' })` … href `/settings/roles/<uuid>` | 4 item                                           | `Owner 11` · `Manager 24` · `Partner 5` · `Staff 28` |
| Placeholder chi tiết | `paragraph` "Select a Role to view details."                                      | khi chưa chọn vai trò                            |                                                      |
| Tiêu đề chi tiết     | `h1` trong panel chi tiết                                                         | **RỖNG** (xem bug bên dưới)                      |                                                      |
| Nút gán              | `getByRole('button', { name: 'Assign to Role' })`                                 | enabled                                          |                                                      |
| Bảng nhân viên       | `table`                                                                           | cột: `Nick Name` / `Phone Number` / `Staff Code` | mỗi cell là `link` sang `/settings/staffs/<staffId>` |

**Dialog "Assign to Staff Role"**

| Thành phần | Locator                                                                                  | Ghi chú                                                            |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Tiêu đề    | `heading` level 2 "Assign to Staff Role"                                                 |                                                                    |
| Nút gán    | `button` `Assign`                                                                        | **disabled** khi chưa chọn ai                                      |
| Nút đóng   | `button` **không có accessible name** (icon)                                             | Escape cũng đóng                                                   |
| Ô tìm      | `getByRole('textbox', { name: "Search for staff's nickname, first name or last name" })` |                                                                    |
| Danh sách  | `li` — mỗi item: `checkbox` + `img` avatar + nickname + badge vai trò hiện tại           | nhân viên **đã** thuộc vai trò đang xem thì checkbox `checked` sẵn |

### 3. Luồng chính đã quan sát

1. Mở `/settings/roles` → 4 vai trò + placeholder "Select a Role to view details.".
2. Click `Partner` → URL `/settings/roles/<uuid>`, panel chi tiết hiện bảng nhân viên.
3. Click `Assign to Role` → dialog "Assign to Staff Role", nút `Assign` disabled.
4. Gõ `mai` vào ô tìm → danh sách còn **1** item `Mai | Partner` (tìm không phân biệt hoa thường).
5. Tick checkbox item đó → `Assign` enabled.
6. Escape → dialog đóng, **không** gán gì (bảng và số Members không đổi).

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- Chỉ có luồng **gán nhân viên vào vai trò**; không tạo/sửa/xoá vai trò.
- Nhân viên đang thuộc vai trò được tick sẵn ⇒ dialog dùng cho cả gán thêm và (có thể) bỏ gán.
- Badge trong dialog cho thấy vai trò **hiện tại** của nhân viên ⇒ gán là chuyển vai trò,
  không phải cộng thêm vai trò.
- Mọi cell trong bảng nhân viên đều là link tới trang chi tiết nhân viên tương ứng.

### 5. Trạng thái / quyền / edge case

- 🐞 **Tiêu đề chi tiết vai trò rỗng**: panel chi tiết render `h1` nhưng `innerText === ""`
  — không hiển thị tên vai trò đang xem. Kiểm chứng ở cả `Owner` và `Partner`.
- 🐞 **Số Members không khớp số dòng bảng** (mismatch hệ thống, không phải lệch 1):
  `Partner` badge **5 Members** nhưng bảng chỉ **1** dòng; `Owner` badge **11 Members**
  nhưng bảng chỉ **5** dòng. Cần xác nhận badge có đếm cả nhân viên inactive/đã xoá.
- 🐞 **Cột `Phone Number` rỗng ở mọi dòng** đã quét (chỉ có nickname + staff code).
- 🐞 **Item trong dialog thiếu tên**: nhân viên "Annie" có `img[alt="Annie"]` nhưng phần
  tên hiển thị trống; một số item khác (`Beo`, `Beo11`, `Beo2222`) **không có badge vai trò**.
- Chưa quét được `staffs-reset-permissions-confirm-dialog` — dialog này chỉ xuất hiện sau
  khi **thực sự** gán vai trò cho nhân viên đang có quyền tuỳ chỉnh; không chạy để tránh
  đổi vai trò dữ liệu thật.
- Không có passcode gate.

## Test Cases

| ID         | Tiêu đề                                                | Tiền điều kiện                      | Các bước                                                    | Kết quả mong đợi                                                                                  | Ưu tiên |
| ---------- | ------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| TC-ROLE-01 | Màn liệt kê đúng 4 vai trò hệ thống                    | Đã đăng nhập                        | 1. Goto `/settings/roles`                                   | 4 `link`: `Owner`, `Manager`, `Partner`, `Staff`; không có nút tạo vai trò                        | P1      |
| TC-ROLE-02 | Header cột Role / Members Count                        | Ở `/settings/roles`                 | 1. Đọc header danh sách                                     | `paragraph` "Role" và "Members Count"                                                             | P2      |
| TC-ROLE-03 | Placeholder khi chưa chọn vai trò                      | Ở `/settings/roles`                 | 1. Quan sát panel phải                                      | `paragraph` "Select a Role to view details."                                                      | P2      |
| TC-ROLE-04 | Mỗi vai trò hiện số thành viên                         | Ở `/settings/roles`                 | 1. Đọc text từng item                                       | Khớp mẫu `^\d+ Members$` (lúc quét: 11 / 24 / 5 / 28)                                             | P1      |
| TC-ROLE-05 | Click vai trò điều hướng và render chi tiết            | Ở `/settings/roles`                 | 1. Click `Partner`                                          | URL = `/settings/roles/<uuid>`; item được active; bảng nhân viên render                           | P1      |
| TC-ROLE-06 | Bảng nhân viên đủ 3 cột                                | Đang xem 1 vai trò                  | 1. Đọc `thead`                                              | `Nick Name` / `Phone Number` / `Staff Code`                                                       | P1      |
| TC-ROLE-07 | Mỗi dòng link sang chi tiết nhân viên                  | Đang xem 1 vai trò                  | 1. Đọc `href` của link trong dòng                           | Trỏ `/settings/staffs/<uuid>`                                                                     | P2      |
| TC-ROLE-08 | 🐞 Tiêu đề chi tiết vai trò bị rỗng                    | Đang xem 1 vai trò                  | 1. Đọc `h1` trong panel chi tiết                            | `innerText` **rỗng** — đáng lẽ phải là tên vai trò. Lặp lại ở ≥2 vai trò (`Owner`, `Partner`)     | P2      |
| TC-ROLE-09 | 🐞 Members Count không khớp số dòng                    | Ở `/settings/roles`                 | 1. Đọc badge của `Owner` (11) 2. Mở `Owner`, đếm `tbody tr` | Badge 11 vs bảng 5 dòng → **lệch**. Lặp lại với `Partner`: badge 5 vs bảng 1 dòng                 | P1      |
| TC-ROLE-10 | 🐞 Cột Phone Number không có dữ liệu                   | Đang xem 1 vai trò                  | 1. Đọc cell cột `Phone Number` từng dòng                    | Rỗng ở mọi dòng đã quét                                                                           | P2      |
| TC-ROLE-11 | Dialog Assign mở với Assign disabled                   | Đang xem 1 vai trò                  | 1. Click `Assign to Role`                                   | `heading` "Assign to Staff Role"; nút `Assign` **disabled**; có ô tìm kiếm và danh sách nhân viên | P1      |
| TC-ROLE-12 | Danh sách nhân viên hiện badge vai trò hiện tại        | Dialog Assign mở                    | 1. Đọc các `li`                                             | Mỗi item có `checkbox` + avatar + nickname + badge (`Owner`/`Manager`/`Partner`/`Staff`)          | P1      |
| TC-ROLE-13 | Nhân viên đã thuộc vai trò được tick sẵn               | Dialog Assign mở từ vai trò `Owner` | 1. Tìm item có badge `Owner`                                | Checkbox của item đó `aria-checked="true"`                                                        | P1      |
| TC-ROLE-14 | Tìm kiếm lọc theo nickname, không phân biệt hoa thường | Dialog Assign mở                    | 1. Fill ô tìm = `mai`                                       | Danh sách còn 1 item `Mai` (badge `Partner`)                                                      | P1      |
| TC-ROLE-15 | Tick nhân viên bật nút Assign                          | Đã lọc còn 1 item                   | 1. Click checkbox của item                                  | `aria-checked="true"`; nút `Assign` enabled                                                       | P1      |
| TC-ROLE-16 | Escape đóng dialog, không gán ai                       | Đã tick 1 nhân viên                 | 1. Nhấn `Escape`                                            | Dialog đóng; số dòng bảng và các badge Members **không đổi**                                      | P1      |
| TC-ROLE-17 | 🐞 Item trong dialog thiếu tên hiển thị                | Dialog Assign mở                    | 1. Tìm item có `img[alt="Annie"]`                           | Phần tên hiển thị **rỗng** dù avatar có alt `Annie`                                               | P2      |
| TC-ROLE-18 | ⚠️ Một số nhân viên không có badge vai trò             | Dialog Assign mở                    | 1. Đọc các item `Beo`, `Beo11`, `Beo2222`                   | Không có badge vai trò → cần xác nhận là nhân viên chưa gán vai trò hay lỗi hiển thị              | P2      |
| TC-ROLE-19 | Tìm kiếm không khớp cho danh sách rỗng                 | Dialog Assign mở                    | 1. Fill ô tìm = `zzzznotexist`                              | Danh sách 0 item; ghi nhận có/không có empty-state message                                        | P2      |
| TC-ROLE-20 | Chuyển vai trò khác cập nhật bảng                      | Đang xem `Owner`                    | 1. Click `Staff` ở danh sách                                | URL đổi; bảng đổi sang danh sách nhân viên của `Staff`                                            | P2      |
