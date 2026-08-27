---
title: Time Tracking
source: playwright-mcp-scan
scanned-at: 2026-08-05
route: /time-tracking
---

# Time Tracking — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Màn **Time Tracking** (`/time-tracking`, passcode-gated — dialog "Enter staff code to
access Time Tracking") là bảng quản lý (owner-facing) toàn bộ bản ghi chấm công
(check-in/check-out) của nhân viên theo ngày/khoảng ngày, cho phép **Add / Edit /
Delete** thủ công. Đây là màn quản trị đối lập với dialog **Time Keeping** (mở từ icon
đồng hồ trên Home) — nơi nhân viên tự bấm Check In / Check Out.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần          | Vai trò (role/label)                                                                 | Trạng thái                                                                                                                                                                                                     | Ghi chú                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Passcode dialog     | `dialog` "Enter staff code to access Time Tracking"                                  | Che route khi vào `/time-tracking`                                                                                                                                                                             | Bàn phím số 0-9, checkbox "Do not require passcode for the next 30 minutes"                                              |
| Heading             | `heading` level 3 "Time Tracking"                                                    | —                                                                                                                                                                                                              |                                                                                                                          |
| Date-range combobox | `combobox` mặc định "Today"                                                          | Có `listbox` dropdown                                                                                                                                                                                          | Options: Today, Yesterday, This Week, Last Week, Last 7 Days, This Month, Last Month, Last 30 Days, This Year, Last Year |
| Ngày cụ thể         | `button` hiển thị "mm/dd/yyyy" (icon-calendar)                                       | Đi kèm combobox range                                                                                                                                                                                          | Mở date-picker (chưa quét chi tiết lịch)                                                                                 |
| Ô tìm kiếm          | `textbox` placeholder "Search staff"                                                 | —                                                                                                                                                                                                              |                                                                                                                          |
| Nút Add             | `button` (không có tên/icon-only) ngay cạnh ô search                                 | Mở dialog "Add New Time Keeping"                                                                                                                                                                               |                                                                                                                          |
| Bảng dữ liệu        | `table` với 9 cột                                                                    | —                                                                                                                                                                                                              | Cột: `#`, `Staff`, `Date IN`, `Date OUT`, `Total Hours`, `Created At`, `Updated At`, `Note`, `Action`                    |
| Empty state         | cell "No time tracking records / No time tracking data for the selected date range." | Khi không có bản ghi trong khoảng ngày đang chọn                                                                                                                                                               |                                                                                                                          |
| Dialog Add          | `dialog` heading "Add New Time Keeping"                                              | Field: Staff (combobox tìm kiếm, required), Date IN (calendar + time textbox, mặc định = now), Date OUT (calendar + time, optional), Note (textbox, placeholder "Optional note", max 255). Nút "Add" / "Close" | Validation: bỏ trống Staff → "Staff is required"                                                                         |
| Dialog Edit         | `dialog` heading "Edit Time Keeping"                                                 | Staff hiển thị dạng `button` **disabled** (không cho đổi); Date IN, Date OUT, Note vẫn sửa được. Nút "Save" (disabled cho tới khi có thay đổi) / "Close"                                                       |                                                                                                                          |
| Alert Delete        | `alertdialog` heading "Delete Time Keeping Record"                                   | Message: "Are you sure you want to delete this time record for {Staff}? This action cannot be undone." Nút "Cancel" / "Delete"                                                                                 |                                                                                                                          |
| Action cell         | `button` "Edit", `button` "Delete" trên mỗi row                                      |                                                                                                                                                                                                                |                                                                                                                          |
| Toast               | Notifications region (`alt+T`)                                                       | "Time keeping added successfully", "Time Keeping record deleted successfully"                                                                                                                                  |                                                                                                                          |

### 3. Luồng chính đã quan sát

1. Vào `/time-tracking` → passcode dialog che trang → nhập đúng mã (đã thử `8888`) →
   dialog tự đóng, bảng hiển thị.
2. Click nút Add (icon-only cạnh ô search) → dialog "Add New Time Keeping" mở, Date IN
   mặc định là ngày/giờ hiện tại.
3. Bấm "Add" khi chưa chọn Staff → validation inline "Staff is required", dialog
   không đóng.
4. Chọn Staff từ combobox tìm kiếm (searchable dropdown liệt kê toàn bộ staff, hiển thị
   initial + tên) → bấm "Add" → toast "Time keeping added successfully" → row mới xuất
   hiện trong bảng với Date IN = Created At = Updated At = thời điểm submit, Date OUT
   "-", Total Hours "—".
5. Bấm "Edit" trên row → dialog "Edit Time Keeping" mở, Staff bị khoá (disabled), nút
   "Save" disabled cho tới khi sửa field khác.
6. Bấm "Delete" trên row → alertdialog xác nhận xuất hiện đúng tên staff → bấm "Delete"
   → toast "Time Keeping record deleted successfully" → bảng quay về empty state.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- Staff là bắt buộc khi thêm mới; Date IN có giá trị mặc định (now) nên gần như luôn
  hợp lệ trừ khi user tự xoá.
- Date OUT là optional (khớp tài liệu Linear "Time Keeping": Date OUT optional khi Add).
- Không cho đổi Staff khi Edit (field disabled) — khớp tài liệu: "Edit Time Keeping:
  Staff (nickname, disable)".
- Cột `Action` luôn có cả Edit + Delete bất kể trạng thái bản ghi (chưa quan sát được
  case bị khoá do Payroll Locked — cần dữ liệu seed riêng để kiểm chứng message "This
  record cannot be deleted because it's included in locked payroll." nêu trong Linear).
- Bảng lọc theo khoảng ngày qua combobox range + calendar; đổi ngày → bảng phải
  requery theo tham số ngày mới (chưa xác minh trực tiếp query URL khi quét).

### 5. Trạng thái / quyền / edge case

- Passcode sai: có cơ chế nhưng chưa thử trong lần quét này (dialog có
  `expectDismiss:false` pattern ở page-object khác — nên cover ở test case riêng).
- Empty state hiển thị rõ ràng khi không có bản ghi trong khoảng ngày.
- Chưa quan sát được: phân trang khi nhiều bản ghi, hành vi khi search staff không tồn
  tại (search staff là lọc bảng theo tên, chưa test), giới hạn ký tự Note (max 255) khi
  nhập vượt quá, và case Delete bị chặn do Payroll Locked.

### 6. Re-scan xác nhận (2026-08-05) — luồng Add / Edit / Delete

Đã quét lại trực tiếp bằng Playwright MCP trên `/time-tracking` (passcode `8888`),
thực hiện đủ chu trình **Create → Edit → Delete (Cancel rồi Delete thật)** trên 1 bản
ghi mới, kết quả khớp 100% với mô tả ở mục 2–3 phía trên, cụ thể:

- **Add**: bấm nút Add icon-only → dialog "Add New Time Keeping" mở, Date IN mặc định
  = giờ hiện tại. Bấm "Add" khi chưa chọn Staff → lỗi inline "Staff is required" ngay
  dưới combobox, dialog không đóng (đã xác nhận `combobox` chuyển sang trạng thái
  `invalid`). Chọn Staff "Andy" từ dropdown searchable → bấm "Add" → dialog đóng ngay,
  row mới xuất hiện: Date IN = Created At = Updated At = thời điểm submit, Date OUT =
  "-", Total Hours = "—", Note = "-".
- **Edit**: bấm "Edit" trên row → dialog "Edit Time Keeping" mở, Staff hiển thị dạng
  `button [disabled]` (không click được), nút "Save" `[disabled]` ban đầu. Gõ chữ vào
  Note → Save chuyển sang enabled ngay. Bấm "Save" → dialog đóng, row cập nhật đúng Note
  mới, `Updated At` nhảy sang thời điểm save (khác `Created At`), các cột khác giữ
  nguyên.
- **Delete**: bấm "Delete" trên row → `alertdialog` "Delete Time Keeping Record" hiện
  message đúng tên staff ("...for Andy..."). Bấm "Cancel" → dialog đóng, row **không**
  bị xoá (đã xác nhận lại bằng snapshot). Mở lại Delete → bấm "Delete" thật → dialog
  đóng, bảng quay về empty state "No time tracking records".
- Không quan sát trực tiếp được toast text trong lần quét này (region Notifications
  trống tại thời điểm chụp snapshot — có thể do toast đã tự ẩn trước khi snapshot chạy);
  giữ nguyên text toast đã ghi trước đó ở mục 2 vì chưa có bằng chứng ngược lại.

## Test Cases

| ID       | Tiêu đề                                               | Tiền điều kiện                                                        | Các bước                                                                                                                      | Kết quả mong đợi                                                                                                                                                                | Ưu tiên |
| -------- | ----------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-TT-01 | Passcode gate chặn truy cập /time-tracking            | Chưa unlock passcode trong session                                    | 1. Điều hướng tới `/time-tracking`                                                                                            | Hiện `dialog` "Enter staff code to access Time Tracking" với bàn phím số, che nội dung trang                                                                                    | P1      |
| TC-TT-02 | Nhập đúng passcode mở được màn Time Tracking          | Đang ở passcode dialog                                                | 1. Bấm lần lượt 4 chữ số passcode đúng (vd `8888`)                                                                            | Dialog tự đóng; hiện heading "Time Tracking", bảng dữ liệu và bộ lọc                                                                                                            | P1      |
| TC-TT-03 | Empty state khi không có bản ghi trong ngày           | Đã unlock; ngày đang chọn (Today) không có bản ghi                    | 1. Quan sát bảng                                                                                                              | Hiện "No time tracking records" / "No time tracking data for the selected date range."                                                                                          | P2      |
| TC-TT-04 | Validation bắt buộc chọn Staff khi Add                | Đã unlock, dialog Add đang mở                                         | 1. Bấm "Add" mà không chọn Staff                                                                                              | Hiện lỗi inline "Staff is required" ngay dưới combobox Staff; dialog không đóng                                                                                                 | P1      |
| TC-TT-05 | Thêm mới bản ghi Time Keeping thành công (happy path) | Đã unlock                                                             | 1. Bấm nút Add cạnh ô search 2. Chọn 1 Staff từ combobox 3. Giữ nguyên Date IN mặc định (now), để trống Date OUT 4. Bấm "Add" | Toast "Time keeping added successfully"; dialog đóng; bảng xuất hiện row mới đúng Staff vừa chọn, Date OUT = "-", Total Hours = "—", Created At = Updated At = thời điểm submit | P1      |
| TC-TT-06 | Staff bị khoá (disabled) khi Edit                     | Đã có 1 bản ghi                                                       | 1. Bấm "Edit" trên row                                                                                                        | Dialog "Edit Time Keeping" mở; field Staff hiển thị dạng button disabled, không đổi được; nút "Save" disabled cho tới khi có thay đổi khác                                      | P2      |
| TC-TT-07 | Xoá bản ghi Time Keeping thành công                   | Đã có 1 bản ghi                                                       | 1. Bấm "Delete" trên row 2. Trong alertdialog xác nhận, bấm "Delete"                                                          | Alertdialog hiện đúng tên Staff trong message; sau khi confirm → toast "Time Keeping record deleted successfully"; row biến mất khỏi bảng                                       | P1      |
| TC-TT-08 | Huỷ xoá bằng nút Cancel                               | Đã có 1 bản ghi, alertdialog Delete đang mở                           | 1. Bấm "Cancel" trong alertdialog                                                                                             | Alertdialog đóng; row vẫn còn nguyên trong bảng                                                                                                                                 | P2      |
| TC-TT-09 | Đổi khoảng ngày lọc dữ liệu                           | Đã unlock                                                             | 1. Mở combobox date-range (mặc định "Today") 2. Chọn "This Week"                                                              | Combobox cập nhật giá trị đã chọn; bảng requery theo khoảng ngày mới (mở rộng phạm vi, có thể hiện thêm bản ghi hoặc vẫn empty state)                                           | P2      |
| TC-TT-10 | Tìm kiếm nhân viên trong bảng qua ô Search staff      | Có ít nhất 1 bản ghi                                                  | 1. Nhập tên staff (đúng/một phần) vào ô "Search staff"                                                                        | Bảng chỉ còn các row khớp tên nhập vào                                                                                                                                          | P3      |
| TC-TT-11 | Note tối đa 255 ký tự khi Add                         | Dialog Add đang mở, đã chọn Staff                                     | 1. Nhập text > 255 ký tự vào field Note                                                                                       | Field chặn/hiện lỗi khi vượt quá 255 ký tự (cần xác minh hành vi cắt cứng hay validation message)                                                                               | P3      |
| TC-TT-12 | Không cho xoá bản ghi thuộc kỳ Payroll đã khoá        | Cần seed dữ liệu: bản ghi Time Keeping nằm trong kỳ Payroll đã Locked | 1. Bấm "Delete" trên bản ghi thuộc payroll locked                                                                             | Không xoá được; hiện message "This record cannot be deleted because it's included in locked payroll." (theo tài liệu Linear time-keeping.md — chưa quan sát trực tiếp qua UI)   | P2      |
