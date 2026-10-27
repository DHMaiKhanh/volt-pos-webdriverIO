---
title: Reports V4
route: /report-pages/v4/{daily-sale-report|income-summary|staff-income|staff-payroll}
scanned-by: raw-CDP-attach (WebView2 CDP 9222)
scanned-at: 2026-10-25
build: 1.1.56 (merchant 14, DEV)
---

# Reports V4 — Test Cases

## Feature overview

Menu ☰ → nhóm **Reports V4** (thu gọn mặc định) gồm 4 report, mỗi report có badge **V4** cạnh tiêu đề.
Menu còn giữ các report cũ ở `/report-pages/<slug>`, kèm một mục **Demo DS Report**.

| Report            | Route                                        | Thành phần chính quét được                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily Sale Report | `/report-pages/v4/daily-sale-report`         | Preset (Today), nút ngày, 4 tile (Total Order, Sale, Total tip, Total Payment), mỗi tile có mô tả, % và dòng "vs Yesterday"; chart theo giờ; nút Print; bảng Order # / Sale/Refund / Tip / Tax / Total (Sale + Tax + Tip); tab Income Details / Payment Details |
| Income Summary    | `/report-pages/v4/income-summary`            | Preset (Today), combobox group-by (Day), tile Total Income + "vs Yesterday", chart, "Total Income Table" Date/Sale/Tip/Tax/Total Payment; panel "Select a row to see its details"                                                                               |
| Staff Income      | `/report-pages/v4/staff-income`              | Ô Search, preset, switch "Show staff with no income", 6 card tổng (Total staff, orders, subtotal, supply fee, tip, staff income), bảng Name/Orders/Subtotal/Supply Fee/Tip/Total Income (header sort được)                                                      |
| Staff Payroll     | `/report-pages/v4/staff-payroll?period_id=…` | Ô Search, combobox kỳ "Current Period (…)", 6 card tổng, bảng như Staff Income                                                                                                                                                                                  |

## Test cases

| ID        | Tiêu đề                                                     | Tiền điều kiện | Các bước                                                 | Kết quả mong đợi                                                                             | Loại       | Ưu tiên | Nguồn                                      |
| --------- | ----------------------------------------------------------- | -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------ |
| TC-RV4-01 | Nhóm Reports V4 trong menu                                  | —              | ☰ → mở "Reports V4"                                     | Đúng 4 link `/report-pages/v4/{daily-sale-report,income-summary,staff-income,staff-payroll}` | Functional | High    | ✅                                         |
| TC-RV4-02 | Badge V4 trên mỗi report                                    | —              | Mở từng report                                           | Có chữ "V4" cạnh tiêu đề                                                                     | UI         | Low     | ✅                                         |
| TC-RV4-03 | DSR V4: 4 tile và mô tả                                     | —              | Mở Daily Sale V4                                         | Có Total Order, Sale, Total tip, Total Payment, mỗi tile có dòng "vs Yesterday"              | Functional | Medium  | ✅                                         |
| TC-RV4-04 | DSR V4: Total Order = số dòng bảng đơn                      | Hôm nay có đơn | Đếm dòng bảng Order #                                    | Bằng tile Total Order                                                                        | Data       | High    | ✅ (3 = 3)                                 |
| TC-RV4-05 | DSR V4: Σ cột Total = tile Total Payment                    | Hôm nay có đơn | Cộng cột Total                                           | Bằng Total Payment (± Gift Card Redemption)                                                  | Data       | High    | ⚠️                                         |
| TC-RV4-06 | DSR V4 khớp DSR V1 cùng ngày                                | —              | So Sale/Tip/Total Payment V4 với `/incomes/income-daily` | Bằng nhau                                                                                    | Data       | High    | ⚠️                                         |
| TC-RV4-07 | Income Summary V4 khớp V1                                   | —              | So dòng Today của 2 bản                                  | Sale/Tip/Tax/Total Payment bằng nhau                                                         | Data       | High    | ✅ ($110 / $40 / $5.50 / $155.50 ở cả hai) |
| TC-RV4-08 | Income Summary V4 mở chi tiết                               | Có dòng        | Bấm dòng                                                 | Panel chi tiết có số khác $0.00 khi dòng khác 0 (regression VP-4850)                         | Functional | High    | ⚠️                                         |
| TC-RV4-09 | Staff Income V4: Total staff = số dòng                      | —              | Đếm dòng                                                 | Bằng card Total staff                                                                        | Data       | Medium  | ✅ (15)                                    |
| TC-RV4-10 | Staff Income V4: Σ Orders/Subtotal/Supply/Tip/Income = card | —              | Cộng các cột                                             | Bằng 5 card tương ứng                                                                        | Data       | High    | ⚠️                                         |
| TC-RV4-11 | Staff Income V4: switch "Show staff with no income"         | —              | Bật switch                                               | Số dòng tăng hoặc giữ nguyên, Total staff cập nhật theo                                      | Functional | Medium  | ✅                                         |
| TC-RV4-12 | Staff Income V4: Search lọc theo tên                        | —              | Gõ tên của dòng đầu                                      | Chỉ còn dòng khớp                                                                            | Functional | Medium  | ✅                                         |
| TC-RV4-13 | Staff Income V4 khớp V1                                     | —              | So card tổng V4 với `/incomes/income-staff` cùng ngày    | Total orders/subtotal/supply/tip bằng nhau                                                   | Data       | High    | ⚠️                                         |
| TC-RV4-14 | Staff Payroll V4: kỳ hiện tại mặc định                      | —              | Mở report                                                | Combobox "Current Period (…)", URL có `period_id`                                            | Functional | Medium  | ✅                                         |
| TC-RV4-15 | Staff Payroll V4: Total staff = số dòng; Σ cột = card       | —              | Đếm và cộng                                              | Khớp                                                                                         | Data       | High    | ⚠️                                         |
| TC-RV4-16 | Staff Payroll V4 khớp V1 cùng kỳ                            | —              | So card tổng V4 với `/incomes/staff-payroll`             | Khớp                                                                                         | Data       | High    | ⚠️                                         |
| TC-RV4-17 | Khoảng ngày > 1 năm bị chặn                                 | —              | Chọn khoảng > 367 ngày                                   | Date picker chặn hoặc báo lỗi rõ ràng (VP-4883 / VP-4927)                                    | Validation | Medium  | 🧱 (date picker chưa quét)                 |
| TC-RV4-18 | Print DSR V4                                                | —              | Bấm Print                                                | In ra máy in                                                                                 | Functional | Low     | 🧱 (cần máy in)                            |
