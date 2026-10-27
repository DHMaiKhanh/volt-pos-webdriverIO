---
title: Batch History
route: /batch-history
scanned-by: raw-CDP-attach (WebView2 CDP 9222)
scanned-at: 2026-10-25
build: 1.1.56 (merchant 14, DEV)
---

# Batch History — Test Cases

## Feature overview

Màn **Batch History** (`/batch-history`, menu ☰ → Batch History) liệt kê các batch thẻ theo khoảng ngày:

- Bộ lọc preset (combobox): Today, Yesterday, This Week (mặc định), Last Week, Last 7 Days, This Month,
  Last Month, Last 30 Days, This Year, Last Year. Bên cạnh là nút khoảng ngày `MM/DD/YYYY - MM/DD/YYYY`.
- Bảng batch: **Batch Date | Batch Number | Status | Total Payment | Total Amount**.
  - Batch đang mở hiện `Not closed yet`, Status `Open`. Batch Number dạng số (vd. `105`).
  - Total Payment là **số lượng** payment (vd. `4414`), không phải tiền. Total Amount là tiền, hiển thị dưới dạng nút.
- Panel phải mặc định `No item selected`. Bấm nút **Total Amount** của một batch thì panel hiện
  **Batch Close Review** (tiêu đề + trạng thái), kèm bảng **OD Code | Subtotal | Tip | Total**. Mỗi OD Code là một nút.
- Batch đang mở vẫn hiện bất kể preset (batch mở từ 08/2026 vẫn nằm trong "This Week").

Không có nút Close Batch trên màn này (đã quét toàn bộ button trong `main`).

## Test cases

Ký hiệu: ✅ quét live khớp · ⚠️ có điều kiện/drift · 🧱 chưa quét được · 📄 chỉ có trong tài liệu

| ID          | Tiêu đề                                              | Tiền điều kiện                | Các bước                                                                              | Kết quả mong đợi                                                                                   | Loại       | Ưu tiên | Nguồn                        |
| ----------- | ---------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- | ------- | ---------------------------- |
| TC-BATCH-01 | Mở màn từ menu                                       | Đã đăng nhập                  | ☰ → Batch History                                                                    | URL `/batch-history`, heading "Batch History"                                                      | Functional | High    | ✅                           |
| TC-BATCH-02 | Preset mặc định là This Week                         | —                             | Mở màn                                                                                | Combobox hiện "This Week"; nút khoảng ngày từ thứ Hai tới hôm nay của tuần hiện tại                | Functional | Medium  | ✅                           |
| TC-BATCH-03 | Đủ 10 preset                                         | —                             | Mở combobox                                                                           | Đúng 10 option theo thứ tự ở mục overview                                                          | Functional | Medium  | ✅                           |
| TC-BATCH-04 | Header bảng batch                                    | —                             | Đọc `th`                                                                              | Batch Date, Batch Number, Status, Total Payment, Total Amount                                      | UI         | Medium  | ✅                           |
| TC-BATCH-05 | Batch đang mở hiển thị đúng                          | Có batch chưa đóng            | Đọc dòng có Status Open                                                               | Batch Date = "Not closed yet", Total Amount có dạng tiền `$x,xxx.xx`                               | Functional | High    | ✅                           |
| TC-BATCH-06 | Panel mặc định chưa chọn                             | —                             | Mở màn                                                                                | Panel phải hiện "No item selected"                                                                 | UI         | Low     | ✅                           |
| TC-BATCH-07 | Mở Batch Close Review                                | Có ít nhất 1 batch            | Bấm nút Total Amount của dòng đầu                                                     | Panel hiện "Batch Close Review", trạng thái của batch, bảng OD Code/Subtotal/Tip/Total có ≥ 1 dòng | Functional | High    | ✅                           |
| TC-BATCH-08 | Mã đơn trong review hợp lệ và không trùng            | Đã mở review                  | Đọc cột OD Code                                                                       | Mọi mã khớp `OD\d{6}-\d+`, không trùng lặp                                                         | Data       | Medium  | ✅                           |
| TC-BATCH-09 | Mỗi dòng review: Total ≥ Subtotal + Tip − chiết khấu | Đã mở review                  | Đọc từng dòng                                                                         | Mọi giá trị parse được thành tiền, không âm                                                        | Data       | Medium  | ⚠️                           |
| TC-BATCH-10 | Đổi preset tải lại danh sách                         | —                             | Chọn "Last Month"                                                                     | Nút khoảng ngày đổi sang tháng trước; bảng render lại, không lỗi                                   | Functional | Medium  | ✅                           |
| TC-BATCH-11 | Header batch khớp review                             | Batch đang mở                 | So Total Payment (số lượng) và Total Amount với số dòng / tổng cột Total trong review | **Nghi vấn**: 4414 payment / $635,230.20 so với 985 đơn / $130,572.40 (xem BUG-BATCH-01)           | Data       | High    | ⚠️                           |
| TC-BATCH-12 | Bấm OD Code mở chi tiết đơn                          | Đã mở review                  | Bấm một OD Code                                                                       | Chưa xác định hành vi đích (chưa quét)                                                             | Functional | Low     | 🧱                           |
| TC-BATCH-13 | Batch đã đóng hiện ngày đóng và trạng thái Closed    | Có batch đã đóng trong khoảng | Chọn "Last Year"                                                                      | Dòng batch có ngày, Status khác Open                                                               | Functional | Medium  | 🧱 (tiệm 14 chỉ có batch mở) |
