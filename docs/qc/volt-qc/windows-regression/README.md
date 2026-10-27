# Volt POS — Bộ test case Regression (Windows, bản production 1.1.31)

> **Nguồn:** 1.603 task Linear team VP (đã lọc còn 1.164 task liên quan app Windows: bỏ Canceled/Duplicate và task chỉ dành cho Android) · 48 Linear Documents của team VP · source code `C:\volt-pos` **nhánh `production`** · 14 file test case theo ticket (262 TC), đã đối chiếu và gộp ngày 2026-10-08 (xem mục "Nguồn ticket đã gộp"). Kết quả mong đợi viết theo code production; chỗ nào lệch với doc/ticket thì ghi ở NOTE.
> **Ngày lập:** 2026-10-08 · **Tiệm dùng để test:** 20258 · **Ngôn ngữ:** tiếng Việt (nhãn nút và thông báo giữ đúng chữ tiếng Anh như trên app).
> **Định dạng:** 12 cột theo mẫu Excel của team: ID | PROGRAM | FEATURES | LINK | DESCRIPTION | PRE-CONDITION | TEST STEPS | DATA TEST | EXPECTED RESULT | ACTUAL RESULT | STATUS | NOTE.
> **File Excel gộp:** [Volt-POS-Regression-Test-Cases.xlsx](Volt-POS-Regression-Test-Cases.xlsx), gồm 1 sheet "Tổng hợp" và 16 sheet module. Có sẵn bộ lọc, cột STATUS chọn được Pass/Fail/Blocked/Skip.

## Quy ước

| Vị trí      | Giá trị                                                          | Ý nghĩa                                                                                                                     |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| DESCRIPTION | `[Happy]` `[Bad]` `[Edge]` `[Permission]` `[Regression VP-xxxx]` | Loại case. Regression là bug đã fix, không được tái phát                                                                    |
| DESCRIPTION | `[P1]` `[P2]` `[P3]`                                             | P1: tiền, dữ liệu, thanh toán, luồng chặn · P2: hành vi, validate · P3: giao diện, bản dịch                                 |
| NOTE        | `PROD-SAFE`                                                      | Chỉ đọc, chạy production thoải mái                                                                                          |
| NOTE        | `GHI DỮ LIỆU`                                                    | Tạo hoặc sửa dữ liệu trên tiệm test (đơn Cash/Other…). Được chạy nhưng sẽ để lại record. Case đổi setting có bước khôi phục |
| NOTE        | `KHÔNG CHẠY PROD`                                                | Quẹt thẻ thật, gửi SMS/Email cho khách thật, thao tác tiền thật không đảo ngược được                                        |
| NOTE        | `CẦN THIẾT BỊ`                                                   | Cần máy in, máy quẹt thẻ, két tiền, máy quét hoặc thiết bị thứ 2                                                            |
| NOTE        | `CHƯA SHIP: VP-xxxx`                                             | Tính năng đã có spec/ticket nhưng chưa có trong bản production                                                              |
| NOTE        | `// NOTE: cần xác nhận`                                          | Doc, ticket và code production nói khác nhau, cần PO chốt                                                                   |

## Mục lục & thống kê

| #   | File                                                                         | Module                                                                           | Tổng      | Happy | Bad | Edge | Perm | Regr | P1  | PROD-SAFE | GHI DỮ LIỆU | KHÔNG CHẠY PROD | CẦN TB | CHƯA SHIP | Cần XN |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- | ----- | --- | ---- | ---- | ---- | --- | --------- | ----------- | --------------- | ------ | --------- | ------ |
| 01  | [01-khoi-dong-dang-nhap-dieu-huong.md](01-khoi-dong-dang-nhap-dieu-huong.md) | APP: Khởi động, đăng nhập, đồng bộ, điều hướng                                   | 134       | 45    | 21  | 42   | 3    | 23   | 31  | 82        | 19          | 30              | 3      | 14        | 10     |
| 02  | [02-home-tao-order.md](02-home-tao-order.md)                                 | HOME: Tạo & chỉnh order                                                          | 183       | 71    | 20  | 59   | 7    | 26   | 41  | 101       | 80          | 0               | 2      | 7         | 21     |
| 03  | [03-checkout-thanh-toan.md](03-checkout-thanh-toan.md)                       | PAY: Checkout & thanh toán                                                       | 173       | 45    | 24  | 53   | 6    | 45   | 92  | 29        | 121         | 18              | 18     | 1         | 13     |
| 04  | [04-khuyen-mai-diem-giftcard.md](04-khuyen-mai-diem-giftcard.md)             | PROMO: Khuyến mãi, reward, điểm, cashback, gift card                             | 193       | 51    | 24  | 52   | 2    | 64   | 121 | 27        | 159         | 5               | 5      | 8         | 27     |
| 05  | [05-split-order.md](05-split-order.md)                                       | SPLIT: Split order & split tip                                                   | 126       | 35    | 21  | 46   | 3    | 21   | 70  | 26        | 91          | 6               | 9      | 2         | 21     |
| 06  | [06-pending-checkin.md](06-pending-checkin.md)                               | PEND: Pending orders & GoCheckin                                                 | 99        | 51    | 7   | 13   | 4    | 24   | 56  | 29        | 65          | 0               | 6      | 3         | 9      |
| 07  | [07-order-history.md](07-order-history.md)                                   | OH: Order history, refund, huỷ, reopen, adjust tip                               | 217       | 83    | 17  | 53   | 11   | 53   | 99  | 130       | 72          | 9               | 9      | 8         | 25     |
| 08  | [08-appointment.md](08-appointment.md)                                       | APPT: Lịch hẹn                                                                   | 142       | 40    | 15  | 63   | 6    | 18   | 45  | 85        | 29          | 25              | 3      | 30        | 9      |
| 09  | [09-time-keeping.md](09-time-keeping.md)                                     | TIME: Chấm công                                                                  | 104       | 29    | 14  | 44   | 10   | 7    | 34  | 55        | 45          | 3               | 1      | 2         | 13     |
| 10  | [10-bao-cao-payroll.md](10-bao-cao-payroll.md)                               | RPT: Báo cáo, thu nhập nhân viên, payroll, batch                                 | 207       | 89    | 6   | 55   | 10   | 47   | 114 | 152       | 42          | 6               | 9      | 4         | 39     |
| 11  | [11-settings.md](11-settings.md)                                             | SET: Settings                                                                    | 183       | 80    | 24  | 42   | 0    | 37   | 56  | 107       | 75          | 1               | 3      | 4         | 15     |
| 12  | [12-phan-quyen-passcode.md](12-phan-quyen-passcode.md)                       | PERM: Phân quyền, vai trò, passcode                                              | 95        | 25    | 2   | 26   | 27   | 15   | 59  | 45        | 49          | 2               | 2      | 3         | 9      |
| 13  | [13-customer-display.md](13-customer-display.md)                             | CD: Màn hình khách                                                               | 78        | 35    | 4   | 26   | 2    | 11   | 27  | 13        | 57          | 6               | 8      | 1         | 9      |
| 14  | [14-e2e-xuyen-suot.md](14-e2e-xuyen-suot.md)                                 | E2E: Luồng xuyên suốt, đa thiết bị, phần cứng                                    | 70        | 29    | 9   | 9    | 0    | 23   | 55  | 11        | 53          | 6               | 12     | 2         | 19     |
| 15  | [15-turn.md](15-turn.md)                                                     | TURN: Turn board, gợi ý lượt & tính lượt                                         | 86        | 33    | 0   | 48   | 1    | 4    | 42  | 30        | 55          | 0               | 5      | 0         | 25     |
| 16  | [16-portal-device-management.md](16-portal-device-management.md)             | PORTAL: Quản lý thiết bị POS (Device Management)                                 | 78        | 25    | 10  | 35   | 6    | 2    | 24  | 42        | 14          | 13              | 9      | 0         | 37     |
| 17  | [17-reopen.md](17-reopen.md)                                                 | RO: Re-Open order (sửa item/staff/customer 1 lần — Linear VP-2585 & task reopen) | 127       | 7     | 0   | 35   | 1    | 84   | 82  | 3         | 98          | 23              | 24     | 0         | 6      |
|     |                                                                              | **TỔNG**                                                                         | **2.168** | 766   | 218 | 666  | 98   | 420  | 966 | 964       | 1026        | 130             | 104    | 89        | 301    |

**Gợi ý thứ tự chạy sau mỗi lần deploy:** chạy E2E-001 → E2E-010 trước (smoke sau deploy). Tiếp theo là các case `[P1]` + `PROD-SAFE`, rồi các case `[P1]` + `GHI DỮ LIỆU` (đơn Cash/Other). Cuối cùng chạy P2/P3 theo module có thay đổi trong bản release.

## Dữ liệu cần chuẩn bị trên tiệm 20258

- Xác nhận lại cấu hình phí: các ví dụ tiền giả định **Service Fee 3% (thẻ) / Cash Discount 3% / Tax 0%**, suy ra từ giá Callus Treatment là $10.30 khi trả Card và $10.00 khi trả Cash/Other. Nếu cấu hình khác thì phải tính lại các DATA TEST.
- Cấu hình điểm hiện tại (Portal): Cash $2.00, Card $0.01, Gift Card $2.00, Other $1.00 cho mỗi điểm.
- Staff test theo từng role (mã dùng placeholder `<OWNER_CODE>`, `<MANAGER_CODE>`, `<PARTNER_CODE>`, `<STAFF_CODE>`, `<INACTIVE_CODE>`…), thêm 1 staff tính lương theo giờ để test chấm công (QA-TEST / QC_STAFF).
- Gift card test (có 1 thẻ chỉ còn $5), 1 khuyến mãi đang hiệu lực, 1 lịch hẹn Confirmed tạo từ Portal/GoBooking, 1 đơn Cash từ hôm trước (đã Settled) để test refund.
- Tiệm 20258 dùng chung, người khác có thể tạo đơn cùng lúc. Khi so số liệu, luôn so **mức tăng/giảm** và theo **mã đơn của mình**, không so với số cố định.

## Câu hỏi cần PO chốt (mâu thuẫn chính giữa doc, ticket và bản production)

| #   | Chủ đề                                              | Bản production đang làm                                                                        | Doc / ticket nói                                                                         | Case liên quan              |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Tip có được tính điểm không                         | Có tính tip (Other $10 + tip $2 → 12 điểm)                                                     | VP-4167: bỏ tip (→ 10 điểm). Ticket ghi lẫn Expected và Actual                           | PROMO, E2E-017/018/046      |
| 2   | Re-open order                                       | Chỉ đổi được thợ và sửa note. Không thêm/xoá dịch vụ, không sửa giá, không đổi khách           | VP-2585/3598/3726: được sửa tiền 1 lần, chuyển điểm khi đổi khách A→B                    | OH, E2E-027                 |
| 3   | Edit Order + tag "Updated"                          | Chưa có trên POS                                                                               | VP-2591/4037/4051/4307/3825                                                              | OH (CHƯA SHIP)              |
| 4   | Chia đều tip $10 cho 3 thợ                          | $3.34 / $3.33 / $3.33                                                                          | Doc Order Flow: $3.40 / $3.40 / $3.20                                                    | SPLIT, OH                   |
| 5   | Keypad Cash khi đã có số điền sẵn                   | Gõ số thì **nối** vào số cũ ($10.00 bấm 5 → $100.05)                                           | VP-3437/4194 (QC Completed): phím đầu tiên phải **thay** số cũ. Bản sửa mới có ở develop | PAY                         |
| 6   | Trả một phần trên checkout thường                   | Bị chặn, phải dùng Split                                                                       | Doc cho phép ("Continue Payment")                                                        | PAY                         |
| 7   | Gift card không đủ tiền → "Redeem & Add New Check"  | Chỉ đóng dialog, không trừ thẻ                                                                 | VP-2306: trừ số dư và tạo check mới                                                      | PAY                         |
| 8   | Refund                                              | Bắt buộc chọn lý do. Hoàn toàn bộ thì số tiền gồm cả tip                                       | Doc: lý do không bắt buộc. Hoàn thẻ không gồm tip                                        | OH                          |
| 9   | Ma trận quyền theo role                             | Staff được Void và xem Payroll. Partner được Refund và xem Batch                               | Doc Staff Management: Void/Refund chỉ Owner…                                             | PERM-062 → 078              |
| 10  | Ngôn ngữ                                            | Lưu theo từng máy. Màn hình khách luôn tiếng Anh                                               | Doc: áp dụng cả tiệm. VP-2302/2303: màn hình khách phải dịch                             | SET, CD                     |
| 11  | Pay 1 / Pay 2                                       | VP-2610: Pay 1 = round(Total × %), Pay 2 = phần còn lại                                        | Doc Payroll cũ và VP-3542 tính khác ($513 → $153.90/$359.10 hay $123/$390)               | RPT                         |
| 12  | Staff Payroll kỳ hiện tại                           | Không hiện staff có thu nhập $0                                                                | VP-3891/3356/4357: phải hiện cả staff $0                                                 | RPT                         |
| 13  | Income Summary "Total Income"                       | Tổng cột Sale                                                                                  | Spec: Net Income                                                                         | RPT                         |
| 14  | Giảm giá cố định lớn hơn giá dịch vụ                | Tổng tiền bị chặn đúng, nhưng dòng Promotion vẫn hiện số đã nhập (−$30), phí thợ tính theo $30 | VP-4375: −$20, kèm thông báo chặn                                                        | PROMO-030 → 033             |
| 15  | Appointment trên POS                                | Chỉ còn nút Checkout. Tạo/sửa/xác nhận/huỷ đang tắt. Checkout hiện cả với lịch Scheduled       | Doc "Book Appointment from POS": đủ thao tác, chỉ Checkout khi Confirmed                 | APPT-116 → 142              |
| 16  | Đăng nhập                                           | Chỉ có QR và Staff Token, không có OTP                                                         | Các doc mô tả khác nhau (GAP, username/password, OTP)                                    | APP                         |
| 17  | Chấm công                                           | Bấm vào ô staff, không hỏi passcode. Ai qua cổng Time Tracking cũng sửa và xoá được            | VP-2722 và doc: dùng Staff Code, chỉ Owner được sửa và phải ghi lý do                    | TIME                        |
| 18  | Khoá payroll trong chấm công                        | Delete so theo giờ khoá, Add/Edit so theo ngày, nên không nhất quán                            | (spec chưa nói)                                                                          | TIME-080                    |
| 19  | Promotion %                                         | Tính trên tổng giá gốc ($5.00)                                                                 | Doc: tính sau item discount ($4.70)                                                      | PROMO                       |
| 20  | "Shown on Go POS" = OFF                             | Dịch vụ vẫn hiện trên Home                                                                     | VP-1176: phải ẩn                                                                         | SET                         |
| 21  | Payment Details (Daily Sale) có gồm tip & tax không | Spec Income v2: không gồm (RPT-032/033/039)                                                    | Ảnh UI VP-1048: Cash $3,706.55 đã gồm tip & tax                                          | RPT-187                     |
| 22  | Pay 1 / Pay 2 của staff lương cứng                  | Theo VP-2610 ($27/$63, $618/$412)                                                              | VP-1148/VP-1341 dùng công thức cũ                                                        | RPT-198                     |
| 23  | % vs Yesterday khi hôm qua = 0                      | Hiện 100%                                                                                      | VP-1048: hiện "N/A"                                                                      | RPT-037                     |
| 24  | Nút tiền nhanh $5/$10/$50/$100                      | Bấm nút **thay** số tiền                                                                       | VP-1432: **cộng dồn**                                                                    | PAY-173                     |
| 25  | Refund order split                                  | Chỉ hoàn toàn bộ order, gồm cả tip                                                             | Ticket Split Order: hoàn theo check/item                                                 | SPLIT-123/124               |
| 26  | Gift card: Bonus và Discount                        | Loại trừ nhau; giá dòng order = Customer Pays                                                  | Doc Gift Card: dùng đồng thời; giá dòng = mệnh giá                                       | PROMO-123/124               |
| 27  | Turn board                                          | Không có 4 thanh/legend; Adjust/Setting không hỏi passcode; Adjust nhập giá trị đích, chặn ở 0 | VP-1761: có 4 thanh, legend, cần mã thợ, nhập delta, cho âm                              | TURN                        |
| 28  | Portal Device Management                            | VP-1198 AC: trang chỉ xem                                                                      | Doc: có Remote View, Disconnect, Credential update, audit thao tác                       | DEVM (37 dòng cần xác nhận) |

Mỗi file module còn có thêm phần "⚠️ mâu thuẫn", **Coverage map** (yêu cầu/ticket → TC) và **Chưa cover** ở cuối file.

## Lỗi nghi ngờ phát hiện khi đọc code production (nên log bug sau khi xác nhận)

- Split Order By Items: nút đóng hộp gợi ý hiện chữ thô **actions.close** do thiếu bản dịch.
- Split Order: dòng Tax trên màn split hiện $10.40, trong khi giá trị lưu là $10.20 (đã biết, nằm trong VP-4405).
- Item note: ô nhập cho gõ tới 80 ký tự (đếm `n/80`), nhưng từ ký tự 51 đã báo lỗi "Note must be less than 50 characters".
- Order History Filter: bấm **Clear** rồi **Confirm** thì mất bộ lọc ngày, nhưng nút ngày vẫn hiện "7 ngày" (OH-065).
- Settings › Roles: tên role lấy theo id cố định "1".."4", nên nút có thể hiện "Assign to Role" (thiếu tên).
- Income Summary: số tuần tính theo tuần bắt đầu Chủ nhật, nhưng các khoảng tuần bắt đầu thứ Hai, nên năm 2025 có 2 dòng "Week 1".
- Gift card bán ra: dữ liệu top-up chỉ giữ trong bộ nhớ phiên, không gắn với order. Khởi động lại app trước khi thanh toán thì order vẫn hoàn tất nhưng thẻ không được nạp (PROMO-176/177/178).
- Refund order bán gift card (Cash, đã settle) không trừ lại số dư thẻ (PROMO-183).
- Turn: Adjust khi đang xem ngày quá khứ lại ghi vào hôm nay (TURN-074); phần trừ tay cũ có thể làm lần cộng tay sau không có tác dụng (TURN-077).

## Nguồn ticket đã gộp (2026-10-08)

Từng TC trong các file test case theo ticket ở thư mục gốc đã được đối chiếu với bộ regression. **Trùng** thì chỉ ghi mapping; **Một phần** / **Mới** thì viết TC mới theo hành vi production. Mapping chi tiết nằm trong Coverage map của từng module.

| File ticket                                                   | TC      | Trùng   | Một phần | Mới    | Gộp vào  | TC mới                                  |
| ------------------------------------------------------------- | ------- | ------- | -------- | ------ | -------- | --------------------------------------- |
| Split-Order-test-cases.md                                     | 25      | 13      | 9        | 3      | 05       | SPLIT-115 → 126                         |
| VP-1048-daily-sale-report-test-cases.md                       | 44      | 32      | 9        | 3      | 10       | RPT-185 → 193                           |
| VP-1148-compensation-salary-wage-per-day-test-cases.md        | 10      | 0       | 7        | 3      | 10, 11   | RPT-194 → 199, SET-181 → 183            |
| VP-1341-staff-payroll-salary-test-cases.md                    | 10      | 2       | 5        | 3      | 10, 11   | RPT-195 → 201                           |
| VP-1343-count-days-off-staff-income-test-cases.md             | 20      | 10      | 5        | 5      | 10       | RPT-202 → 207                           |
| VP-1252-pending-order-test-cases.md + VP-1252-5-test-cases.md | 25      | 15      | 6        | 4      | 06       | PEND-094 → 099                          |
| gift-card-pos-test-cases.md + VP-1261-test-cases.md           | 60      | 28      | 17       | 15     | 04       | PROMO-167 → 193                         |
| VP-1432-test-cases.md                                         | 5       | 3       | 2        | 0      | 03       | PAY-173                                 |
| VP-1434-quick-pay-discount-reset-test-cases.md                | 10      | 2       | 7        | 1      | 02       | HOME-178 → 183                          |
| VP-1433-order-history-customer-info-search-test-cases.md      | 10      | 8       | 2        | 0      | 07       | OH-217                                  |
| VP-1761-turn-suggestion-test-cases.md                         | 25      | 0       | 6        | 19     | 15 (mới) | TURN-001 → 086 (toàn bộ chức năng Turn) |
| VP-1198-test-cases.md                                         | 18      | 0       | 6        | 12     | 16 (mới) | DEVM-001 → 078                          |
| **Tổng**                                                      | **262** | **113** | **81**   | **68** |          | **243 TC mới**                          |

TC cũ được sửa khi đối chiếu (thêm expected hoặc sửa cho đúng production): PEND-079, PEND-089, PAY-008, OH-029, OH-163, PROMO-111, PROMO-131, RPT-033, RPT-037, RPT-042, RPT-154, SPLIT-090, SET-062, APP-062.
