---
title: Permissions (Quyền hạn)
route: /settings/permissions
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Permissions — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Bảng ma trận **quyền × vai trò**: mỗi dòng là một quyền (có cây cha–con), mỗi cột là một
vai trò hệ thống (`Owner`, `Manager`, `Partner`, `Staff`). Bật/tắt switch là lưu ngay,
**không có nút Save**.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần       | Vai trò (role/label)                                                     | Trạng thái              | Ghi chú                                                                 |
| ---------------- | ------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| Tiêu đề          | `getByRole('heading', { name: 'Permissions' })` — **level 1**            |                         | các màn settings khác dùng level 3                                      |
| Cột đầu header   | text "Access" + `button` `Expand All`                                    |                         | sau khi mở thành `Collapse All`                                         |
| Cột vai trò      | text `Owner`, `Manager`, `Partner`, `Staff`                              |                         |                                                                         |
| Nút theo vai trò | `button` `Select All` / `Unselect All` dưới tên vai trò                  | Owner **không có** nút  | nhãn = `Unselect All` khi vai trò đó đã bật hết, ngược lại `Select All` |
| Dòng quyền       | `div.grid.grid-cols-6` chứa 1 `p` (tên quyền) + 4 `[role="switch"]`      |                         | label chiếm 2 cột, 4 switch chiếm 4 cột                                 |
| Nút mở/gập nhóm  | `generic` "Toggle" trong cell tên quyền cha                              |                         |                                                                         |
| Switch quyền     | `[role="switch"]`, **không có** `id`, `data-testid`, hay accessible name |                         | thứ tự cố định: Owner, Manager, Partner, Staff                          |
| Switch cột Owner | `[role="switch"][disabled]` `aria-checked="true"`                        | luôn checked + disabled | Owner luôn có mọi quyền, không sửa được                                 |

**Cây quyền đầy đủ (sau `Expand All`): 5 nhóm cha + 14 quyền con = 19 dòng × 4 vai trò = 76 switch.**

| Nhóm cha         | Quyền con                                                     |
| ---------------- | ------------------------------------------------------------- |
| Order Management | Edit Order · Cancel Order (Void) · Refund · Completed Payment |
| Income           | Summary Income · Daily Income · Staff Income · Staff Payroll  |
| Batch Management | Batch History · Batch Close                                   |
| Cash Drawer      | Open Cash Drawer                                              |
| System Setting   | POS Settings · View Phone Number · View Time Tracking         |

### 3. Luồng chính đã quan sát

1. Mở `/settings/permissions` → 5 dòng nhóm cha, mặc định **gập**.
2. Click `Expand All` → hiện đủ 19 dòng, nút đổi thành `Collapse All`.
3. Click switch cột `Partner` ở dòng cha `Cash Drawer` (đang OFF) → cha ON **và** con
   `Open Cash Drawer` cũng ON theo (cascade cha → con). **Không có toast**.
4. Click lại switch đó → cha và con cùng trở về OFF.
5. Reload → trạng thái đúng như trước khi thay đổi ⇒ mỗi lần click là một mutation lưu ngay.
6. Sau reload, cây trở lại trạng thái **gập** (nút lại là `Expand All`).

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- **Owner bất biến**: 19 switch cột Owner đều `checked` + `disabled`.
- **Cascade cha → con**: bật/tắt quyền cha áp cho toàn bộ quyền con của cùng vai trò.
- **Lưu ngay, không Save, không toast** — khác `/settings/payment-transaction`.
- Nhãn nút theo vai trò phản ánh trạng thái tổng: lúc quét `Manager` = `Unselect All`
  (bật hết), `Partner` và `Staff` = `Select All`. Đáng chú ý: `Staff` đang bật
  `Cash Drawer` nhưng nút vẫn là `Select All` ⇒ nhãn chỉ thành `Unselect All` khi **tất cả**
  quyền của vai trò đó đang bật.

### 5. Trạng thái / quyền / edge case

- Route này được đánh dấu **gated** (có `passcode-guard-dialog.tsx` /
  `passcode-protected-route.tsx`). Lúc quét **không** thấy dialog vì phiên đang giữ grant
  "không hỏi passcode trong 30 phút" (`volt-passcode-skip`). Case gate cần chạy trên
  context sạch (xoá key đó trước).
- ⚠️ **Bẫy locator (quan trọng cho codegen)**: switch quyền không có name/id/testid ⇒
  **bắt buộc định vị theo vị trí**: tìm dòng `div.grid.grid-cols-6` chứa `p` có text
  **khớp tuyệt đối** tên quyền, rồi lấy `[role="switch"]` thứ `n` theo cột
  (0=Owner, 1=Manager, 2=Partner, 3=Staff).
  Lưu ý `hasText: 'Cash Drawer'` sẽ khớp **cả** dòng `Open Cash Drawer` → phải so khớp
  chính xác trên `p`.
- ⚠️ **Không dùng `Select All` / `Unselect All` trong test khi chưa snapshot trạng thái**:
  trạng thái hiện tại của `Staff` là hỗn hợp (chỉ bật Cash Drawer), bấm `Select All` rồi
  `Unselect All` **không** khôi phục lại được. Test cho 2 nút này phải đọc và ghi lại toàn
  bộ ma trận trước, rồi restore từng switch.

## Test Cases

| ID         | Tiêu đề                                      | Tiền điều kiện                                 | Các bước                                               | Kết quả mong đợi                                                                                                                             | Ưu tiên |
| ---------- | -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-PERM-01 | Màn render tiêu đề Permissions               | Đã unlock passcode                             | 1. Goto `/settings/permissions`                        | `getByRole('heading', { name: 'Permissions' })` visible (level 1)                                                                            | P1      |
| TC-PERM-02 | Header có 4 cột vai trò                      | Ở màn permissions                              | 1. Đọc header                                          | Thấy `Access`, `Owner`, `Manager`, `Partner`, `Staff`                                                                                        | P1      |
| TC-PERM-03 | Mặc định cây quyền đang gập                  | Vừa mở màn                                     | 1. Đếm dòng có switch                                  | Chỉ 5 dòng nhóm cha; nút hiển thị `Expand All`                                                                                               | P1      |
| TC-PERM-04 | Expand All mở hết 19 dòng                    | Ở màn permissions                              | 1. Click `Expand All`                                  | 19 dòng quyền; tổng `[role="switch"]` = **76**; nút đổi thành `Collapse All`                                                                 | P1      |
| TC-PERM-05 | Cây quyền đúng 5 nhóm cha                    | Đã Expand All                                  | 1. Đọc tên nhóm                                        | `Order Management`, `Income`, `Batch Management`, `Cash Drawer`, `System Setting`                                                            | P1      |
| TC-PERM-06 | Nhóm Order Management đủ 4 quyền con         | Đã Expand All                                  | 1. Đọc con của Order Management                        | `Edit Order`, `Cancel Order (Void)`, `Refund`, `Completed Payment`                                                                           | P2      |
| TC-PERM-07 | Nhóm Income đủ 4 quyền con                   | Đã Expand All                                  | 1. Đọc con của Income                                  | `Summary Income`, `Daily Income`, `Staff Income`, `Staff Payroll`                                                                            | P2      |
| TC-PERM-08 | Nhóm Batch Management đủ 2 quyền con         | Đã Expand All                                  | 1. Đọc con của Batch Management                        | `Batch History`, `Batch Close`                                                                                                               | P2      |
| TC-PERM-09 | Nhóm System Setting đủ 3 quyền con           | Đã Expand All                                  | 1. Đọc con của System Setting                          | `POS Settings`, `View Phone Number`, `View Time Tracking`                                                                                    | P2      |
| TC-PERM-10 | Cột Owner luôn bật và không sửa được         | Đã Expand All                                  | 1. Với mỗi dòng, đọc switch index 0                    | Tất cả `aria-checked="true"` **và** `disabled`                                                                                               | P1      |
| TC-PERM-11 | Collapse All gập lại về 5 dòng               | Đã Expand All                                  | 1. Click `Collapse All`                                | Chỉ còn 5 dòng nhóm cha; nút đổi lại `Expand All`                                                                                            | P2      |
| TC-PERM-12 | Bật quyền cha cascade sang quyền con         | Đã Expand All; `Partner`/`Cash Drawer` = OFF   | 1. Click switch `Partner` ở dòng `Cash Drawer`         | Cha `Cash Drawer` → ON **và** con `Open Cash Drawer` cột Partner cũng → ON                                                                   | P1      |
| TC-PERM-13 | Tắt quyền cha cascade tắt quyền con          | Vừa thực hiện TC-PERM-12                       | 1. Click lại switch đó                                 | Cả cha và con cột Partner trở về OFF                                                                                                         | P1      |
| TC-PERM-14 | Thay đổi lưu ngay, không có nút Save         | Ở màn permissions                              | 1. Liệt kê `button` trong vùng nội dung                | Không có `Save`/`Apply`; chỉ có `Expand/Collapse All` và `Select All`/`Unselect All`                                                         | P1      |
| TC-PERM-15 | Thay đổi không hiện toast                    | Vừa toggle 1 switch                            | 1. Chờ 1s, đếm toast                                   | Không có `[data-sonner-toast]`                                                                                                               | P3      |
| TC-PERM-16 | Thay đổi sống qua reload                     | Vừa toggle 1 switch                            | 1. Reload route 2. Đọc lại dòng đó                     | Giá trị đúng như sau khi toggle ⇒ đã lưu server-side                                                                                         | P1      |
| TC-PERM-17 | Trạng thái expand không được lưu             | Đã Expand All                                  | 1. Reload route                                        | Cây trở lại **gập**, nút là `Expand All`                                                                                                     | P3      |
| TC-PERM-18 | Nút theo vai trò phản ánh trạng thái tổng    | Ở màn permissions                              | 1. Đọc nhãn nút của từng vai trò                       | Vai trò bật hết → `Unselect All`; vai trò còn thiếu ≥1 quyền → `Select All` (kể cả khi đã bật một phần, ví dụ `Staff` chỉ bật `Cash Drawer`) | P2      |
| TC-PERM-19 | Cột Owner không có nút Select All            | Ở màn permissions                              | 1. Đọc header cột Owner                                | Chỉ có chữ `Owner`, **không** kèm `button`                                                                                                   | P2      |
| TC-PERM-20 | Select All bật toàn bộ quyền của vai trò     | Đã snapshot toàn bộ ma trận                    | 1. Click `Select All` của `Partner` 2. Đọc cột Partner | Toàn bộ 19 switch cột Partner = ON; nhãn nút đổi thành `Unselect All`. **Bắt buộc restore từng switch theo snapshot ở cuối test**            | P2      |
| TC-PERM-21 | Unselect All tắt toàn bộ quyền của vai trò   | Vừa thực hiện TC-PERM-20                       | 1. Click `Unselect All` của `Partner`                  | Toàn bộ cột Partner = OFF; nhãn về `Select All`                                                                                              | P2      |
| TC-PERM-22 | Passcode gate chặn khi vào bằng context sạch | Đã xoá `volt-passcode-skip` trong localStorage | 1. Goto `/settings/permissions`                        | Xuất hiện dialog nhập passcode trước khi thấy bảng quyền                                                                                     | P1      |
| TC-PERM-23 | Locator switch phải khớp tên quyền tuyệt đối | Đã Expand All                                  | 1. Lọc dòng theo text `Cash Drawer` không exact        | Khớp **2** dòng (`Cash Drawer` và `Open Cash Drawer`) → chứng minh phải so khớp tuyệt đối trên `p` để tránh sai dòng                         | P1      |
