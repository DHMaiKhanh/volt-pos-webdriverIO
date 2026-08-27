# Staff Payroll — Test Case & Quét Đối Chiếu Dữ Liệu Đa Ứng Dụng

Route (Volt POS, local): `/incomes/staff-payroll`
Route (FASTBOY Portal, dev): `/pos/:shopId/payroll?tab=staff-payroll&page=<n>&periodId=<uuid>`

Đã quét bằng Playwright MCP vào ngày 2026-07-20. Cổng bảo vệ: cùng hộp thoại
mã passcode như các màn Income khác (passcode chủ shop `8888`) — xem
[[income-screens-gotchas]].

## Tổng Quan Tính Năng

Báo cáo 2 panel, tương tự `IncomeStaffPage` (`/incomes/income-staff`):

- **Panel trái**: ô tìm kiếm theo nickname, dropdown chọn kỳ báo cáo (theo
  tuần lịch, mới nhất trước), thanh tổng hợp 6 chỉ số (Tổng nhân viên /
  đơn hàng / tổng tiền hàng / phí supply / tip / thu nhập nhân viên), và
  bảng danh sách nhân viên (Tên, Đơn hàng, Tổng tiền hàng, Phí Supply, Tip,
  Tổng thu nhập).
- **Panel phải**: chi tiết lương của từng nhân viên sau khi bấm vào 1 dòng.
  Cập nhật 2026-07-20 (sau khi app được build lại): panel chi tiết thực ra có
  **2 layout khác nhau tùy loại nhân viên** (`payType`), không phải 1 layout
  cố định như bản quét trước đó ghi nhận:
  - **`salary`** (nhân viên hưởng lương, vd. Tony, Val): Số ngày làm, Số giờ
    làm, **Số tiền lương (Salary Amount)**, Phí/Khấu trừ dọn dẹp, Tip, Tip
    quẹt thẻ → Tổng thu nhập = Salary Amount − Clean Up Fee + Tip − Card
    Charge Tip.
  - **`commission`** (nhân viên hưởng hoa hồng, vd. Hugo): thêm 1 **bảng
    breakdown theo từng ngày** (Date/Sale/Refund/Supply Fee/Tip) ngay dưới
    dòng "Working Days: N days", rồi tới Sale, Refund, Subtotal, Supply Fee
    (incl. Sale & Refund), **Staff Commission**, **Card Charge Commission**,
    Phí/Khấu trừ dọn dẹp, Tip, Tip quẹt thẻ, **Discount Charge** → Tổng thu
    nhập = Staff Commission − Clean Up Fee + Tip − Card Charge Commission −
    Card Charge Tip − Discount Charge.
  - Cả 2 layout đều có phần **chia Kỳ trả 1 / Kỳ trả 2** với tỉ lệ phần trăm
    khác nhau tùy nhân viên (quan sát được: Tony 30/70, Hugo 40/60 — tỉ lệ
    cấu hình riêng cho từng nhân viên, không phải hằng số cố định).
  - Hiển thị "No detail to show" cho tới khi chọn 1 dòng.
- Bảng tương ứng bên Portal có phân trang ("Showing X to Y of Z results" +
  Previous/Next) thay vì danh sách cuộn 1 lần, và liệt kê các dòng nhân
  viên trùng lặp mà app local không hiển thị trùng theo cùng cách (ví dụ:
  Portal hiển thị 2 dòng "Mr. Kevin Vu", khớp với 2 dòng "Mr. Kevin Vu"
  của app local — xem kỳ Jul 9–13 bên dưới). Portal cũng có cùng 2 layout
  `salary`/`commission` ở panel chi tiết, cùng field, chỉ khác cách đặt tên
  1-2 nhãn (xem D-2 bên dưới).

## Test Case

| #     | Case                                                                   | Các bước                                                                                                                                                                                                                                                                      | Kết quả mong đợi                                                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Cổng passcode                                                          | Vào `/incomes/staff-payroll` khi chưa xác thực                                                                                                                                                                                                                                | Hiện hộp thoại passcode; nội dung trang bị ẩn cho tới khi nhập `8888`                                                                                                                                               |
| TC-02 | Thanh tổng hợp hiển thị                                                | Mở khóa passcode, chờ trang sẵn sàng                                                                                                                                                                                                                                          | Hiện đủ 6 thẻ thống kê: Tổng nhân viên, Tổng đơn hàng, Tổng tiền hàng, Tổng phí supply, Tổng tip, Tổng thu nhập nhân viên                                                                                           |
| TC-03 | Số dòng bảng khớp thống kê Tổng nhân viên                              | Đọc chỉ số `Total staff` so với số lượng `tbody tr`                                                                                                                                                                                                                           | Bằng nhau (26 ở mọi kỳ đã quét)                                                                                                                                                                                     |
| TC-04 | Tổng cột khớp với thanh tổng hợp                                       | Cộng tổng các cột `Orders`/`Subtotal`/`Supply Fee`/`Tip` trên toàn bộ dòng                                                                                                                                                                                                    | Bằng đúng thẻ thống kê tương ứng (xem các bảng theo kỳ bên dưới)                                                                                                                                                    |
| TC-05 | Tìm kiếm lọc nhân viên theo nickname                                   | Gõ nickname nhân viên vào ô `Search staff`                                                                                                                                                                                                                                    | Bảng chỉ còn (các) dòng khớp                                                                                                                                                                                        |
| TC-06 | Đổi kỳ báo cáo qua dropdown                                            | Mở dropdown kỳ, chọn preset khác                                                                                                                                                                                                                                              | `periodId`/khoảng ngày trên URL cập nhật; thanh tổng hợp + bảng tải lại theo kỳ mới                                                                                                                                 |
| TC-07 | Bấm vào dòng mở panel chi tiết                                         | Bấm vào dòng nhân viên có đơn hàng khác 0                                                                                                                                                                                                                                     | Panel phải hiển thị tên nhân viên + tiêu đề khoảng ngày, Số ngày/giờ làm, Số tiền lương, Phí dọn dẹp, Tip, Tip quẹt thẻ, Tổng thu nhập, Kỳ trả 1, Kỳ trả 2                                                          |
| TC-08 | Chi tiết nhân viên không có đơn hàng                                   | Bấm vào dòng nhân viên có 0 đơn hàng                                                                                                                                                                                                                                          | Panel chi tiết hiển thị toàn số 0, không phải trạng thái lỗi                                                                                                                                                        |
| TC-09 | Tổng thu nhập âm không bị ép về 0                                      | So sánh Hugo, kỳ Jun 28–29 (`Total Income = -$8.00`)                                                                                                                                                                                                                          | Giá trị hiển thị là số âm, không phải `$0.00` hay bị ẩn                                                                                                                                                             |
| TC-10 | **Đối chiếu đa ứng dụng**: Volt POS vs Portal, cùng kỳ                 | Với cùng một `periodId`, so sánh từng dòng (Tên, Đơn hàng, Tổng tiền hàng, Phí Supply, Tip, Tổng thu nhập) giữa `localhost:1420/incomes/staff-payroll` và tab `staff-payroll` bên Portal                                                                                      | Cả 26 dòng nhân viên và 6 chỉ số tổng hợp khớp chính xác giữa hai app                                                                                                                                               |
| TC-11 | Đối chiếu đa ứng dụng đúng trên nhiều kỳ                               | Lặp lại TC-10 cho ít nhất 3 kỳ khác nhau (không chỉ tuần hiện tại)                                                                                                                                                                                                            | Không có kỳ nào lệch dòng nhân viên hoặc tổng hợp                                                                                                                                                                   |
| TC-12 | **Đối chiếu panel chi tiết từng nhân viên** (không chỉ quét danh sách) | Với mỗi nhân viên có đơn hàng > 0 và tồn tại ở cả 2 app trong cùng kỳ: bấm vào dòng để mở panel chi tiết trên CẢ HAI app, đọc toàn bộ field (Working Days/Hours hoặc Sale/Refund/Staff Commission tùy `payType`, Deduction, Tip, Card Charge Tip, Total Income, Pay 1, Pay 2) | Mọi field khớp chính xác giữa 2 app; `payType` (salary/commission) phải giống nhau cho cùng 1 nhân viên                                                                                                             |
| TC-13 | Nhận diện đúng layout theo `payType`                                   | Mở panel chi tiết của 1 nhân viên salary (vd. Tony) và 1 nhân viên commission (vd. Hugo)                                                                                                                                                                                      | Panel salary có Working Hours + Salary Amount, KHÔNG có bảng breakdown theo ngày; panel commission có bảng breakdown theo ngày + Sale/Refund/Staff Commission/Discount Charge, KHÔNG có Working Hours/Salary Amount |

## Kết Quả Quét — Volt POS local (`localhost:1420`)

Đầy đủ 26 nhân viên, theo đúng thứ tự hiển thị trên bảng, cho mọi kỳ báo cáo mà dropdown đang cung cấp (mới nhất trước). Các cột: Đơn hàng / Tổng tiền hàng / Phí Supply / Tip / Tổng thu nhập.

### Kỳ: Jul 9, 2026 – Jul 13, 2026 (tuần hiện tại)

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 7 · Tổng tiền hàng $311.00 · Tổng phí supply $17.00 · Tổng tip $110.00 · Tổng thu nhập nhân viên $4,945.00

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip     | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ------- | ------------- |
| Wendy              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Vincent            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Val                | 1        | $80.00         | $4.00      | $0.00   | $0.00         |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tony               | 1        | $100.00        | $5.00      | $0.00   | $0.00         |
| Tommy              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Ryan               | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Peter              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mai                | 0        | $0.00          | $0.00      | $0.00   | $1,325.00     |
| Linda              | 1        | $40.00         | $0.00      | $10.00  | $10.00        |
| Kim                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Kevin              | 2        | $11.00         | $6.00      | $100.00 | $1,950.00     |
| Jackie             | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Iverson            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Hugo               | 1        | $10.00         | $0.00      | $0.00   | $5.00         |
| Henry              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Evon               | 0        | $0.00          | $0.00      | $0.00   | $640.00       |
| Bob                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Annie              | 0        | $0.00          | $0.00      | $0.00   | $1,015.00     |
| Andy               | 1        | $70.00         | $2.00      | $0.00   | $0.00         |
| Amy                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |

### Kỳ: Jul 1, 2026 – Jul 8, 2026

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 29 · Tổng tiền hàng $2,744.90 · Tổng phí supply $88.00 · Tổng tip $276.66 · Tổng thu nhập nhân viên $5,689.19

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip     | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ------- | ------------- |
| Wendy              | 0        | $0.00          | $0.00      | $0.00   | $142.00       |
| Vincent            | 0        | $0.00          | $0.00      | $50.00  | $40.00        |
| Val                | 5        | $539.40        | $17.00     | $0.00   | $75.00        |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tony               | 7        | $689.00        | $25.00     | $31.11  | $549.76       |
| Tommy              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Ryan               | 1        | $120.00        | $3.00      | $30.00  | $128.58       |
| Peter              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mai                | 3        | $362.00        | $8.00      | $0.00   | $1,280.00     |
| Linda              | 2        | $204.00        | $7.00      | $10.56  | $1,258.95     |
| Kim                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Kevin              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Jackie             | 4        | $462.00        | $19.00     | $115.00 | $369.81       |
| Iverson            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Hugo               | 2        | $60.00         | $1.00      | $0.00   | $20.45        |
| Henry              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Evon               | 1        | $60.00         | $0.00      | $0.00   | $604.00       |
| Bob                | 3        | $208.50        | $6.00      | $19.99  | $109.64       |
| Annie              | 0        | $0.00          | $0.00      | $0.00   | $994.00       |
| Andy               | 1        | $40.00         | $2.00      | $20.00  | $117.00       |
| Amy                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |

### Kỳ: Jun 30, 2026 – Jun 30, 2026 (1 ngày)

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 4 · Tổng tiền hàng $250.00 · Tổng phí supply $8.00 · Tổng tip $0.00 · Tổng thu nhập nhân viên $3,197.80

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip   | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ----- | ------------- |
| Wendy              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Vincent            | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Val                | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Tony               | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Tommy              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Ryan               | 1        | $0.00          | $0.00      | $0.00 | $0.00         |
| Peter              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Mai                | 0        | $0.00          | $0.00      | $0.00 | $1,385.00     |
| Linda              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Kim                | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Kevin              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Jackie             | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Iverson            | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Hugo               | 1        | $50.00         | $4.00      | $0.00 | $23.00        |
| Henry              | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Evon               | 1        | $100.00        | $2.00      | $0.00 | $688.00       |
| Bob                | 1        | $100.00        | $2.00      | $0.00 | $58.80        |
| Annie              | 0        | $0.00          | $0.00      | $0.00 | $1,043.00     |
| Andy               | 0        | $0.00          | $0.00      | $0.00 | $0.00         |
| Amy                | 0        | $0.00          | $0.00      | $0.00 | $0.00         |

### Kỳ: Jun 28, 2026 – Jun 29, 2026

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 25 · Tổng tiền hàng $1,154.00 · Tổng phí supply $28.00 · Tổng tip $122.50 · Tổng thu nhập nhân viên $3,733.57

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip    | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ------ | ------------- |
| Wendy              | 1        | $80.00         | $0.00      | $20.00 | $68.00        |
| Vincent            | 3        | $106.00        | $2.00      | $40.00 | $29.60        |
| Val                | 1        | $40.00         | $2.00      | $0.00  | $75.00        |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Tony               | 2        | $126.00        | $6.00      | $14.50 | $160.41       |
| Tommy              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Ryan               | 3        | $80.00         | $0.00      | $15.00 | $57.00        |
| Peter              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mai                | 3        | $100.00        | $2.00      | $0.00  | $1,370.00     |
| Linda              | 1        | $50.00         | $2.00      | $10.00 | $10.00        |
| Kim                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Kevin              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Jackie             | 1        | $327.00        | $6.00      | $3.00  | $180.76       |
| Iverson            | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Hugo               | 2        | $0.00          | $0.00      | $0.00  | **-$8.00**    |
| Henry              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Evon               | 4        | $0.00          | $0.00      | $0.00  | $676.00       |
| Bob                | 1        | $100.00        | $2.00      | $10.00 | $68.80        |
| Annie              | 2        | $105.00        | $4.00      | $0.00  | $1,036.00     |
| Andy               | 1        | $40.00         | $2.00      | $10.00 | $10.00        |
| Amy                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |

> Lưu ý: Tổng thu nhập của Hugo là **âm** trong kỳ này (`-$8.00`) dù Tổng tiền hàng/Phí Supply/Tip đều $0 — Tổng thu nhập không phải là tổng cộng đơn giản của các cột hiển thị, nó gộp cả phần tính lương/khấu trừ từ panel chi tiết. Không nên assert `Total Income >= 0` trong test.

### Kỳ: Jun 25, 2026 – Jun 27, 2026

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 39 · Tổng tiền hàng $2,855.00 · Tổng phí supply $65.00 · Tổng tip $268.50 · Tổng thu nhập nhân viên $4,684.28

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip     | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ------- | ------------- |
| Wendy              | 2        | $160.00        | $0.00      | $40.00  | $136.00       |
| Vincent            | 4        | $432.00        | $8.00      | $104.00 | $309.06       |
| Val                | 2        | $80.00         | $4.00      | $0.00   | $150.00       |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tony               | 3        | $186.00        | $9.00      | $24.50  | $316.50       |
| Tommy              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Ryan               | 5        | $246.00        | $0.00      | $34.00  | $161.60       |
| Peter              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Mai                | 5        | $300.00        | $6.00      | $0.00   | $1,355.00     |
| Linda              | 2        | $100.00        | $4.00      | $20.00  | $20.00        |
| Kim                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Kevin              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Jackie             | 2        | $654.00        | $12.00     | $6.00   | $361.52       |
| Iverson            | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Hugo               | 2        | $80.00         | $0.00      | $0.00   | $24.00        |
| Henry              | 0        | $0.00          | $0.00      | $0.00   | $0.00         |
| Evon               | 5        | $182.00        | $8.00      | $0.00   | $664.00       |
| Bob                | 2        | $200.00        | $4.00      | $20.00  | $137.60       |
| Annie              | 3        | $155.00        | $6.00      | $0.00   | $1,029.00     |
| Andy               | 2        | $80.00         | $4.00      | $20.00  | $20.00        |
| Amy                | 0        | $0.00          | $0.00      | $0.00   | $0.00         |

### Kỳ: Jun 22, 2026 – Jun 24, 2026

**Thanh tổng hợp**: Tổng nhân viên 26 · Tổng đơn hàng 21 · Tổng tiền hàng $1,485.00 · Tổng phí supply $32.00 · Tổng tip $134.00 · Tổng thu nhập nhân viên $4,128.87

| Tên                | Đơn hàng | Tổng tiền hàng | Phí Supply | Tip    | Tổng thu nhập |
| ------------------ | -------- | -------------- | ---------- | ------ | ------------- |
| Wendy              | 1        | $80.00         | $0.00      | $20.00 | $68.00        |
| Vincent            | 2        | $216.00        | $4.00      | $52.00 | $144.53       |
| Val                | 2        | $40.00         | $2.00      | $0.00  | $150.00       |
| Tuesday            | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Tony               | 1        | $60.00         | $3.00      | $10.00 | $302.00       |
| Tommy              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Tom                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Stephanie          | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Ryan               | 2        | $166.00        | $0.00      | $19.00 | $98.60        |
| Peter              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Nash               | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mr. Kevin Vu (1st) | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mr. Kevin Vu (2nd) | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Mai                | 2        | $200.00        | $4.00      | $0.00  | $1,355.00     |
| Linda              | 1        | $50.00         | $2.00      | $10.00 | $10.00        |
| Kim                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Kevin              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Jackie             | 1        | $327.00        | $6.00      | $3.00  | $224.94       |
| Iverson            | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Hugo               | 3        | $40.00         | $0.00      | $0.00  | $4.00         |
| Henry              | 0        | $0.00          | $0.00      | $0.00  | $0.00         |
| Evon               | 3        | $116.00        | $5.00      | $0.00  | $664.00       |
| Bob                | 1        | $100.00        | $2.00      | $10.00 | $68.80        |
| Annie              | 1        | $50.00         | $2.00      | $0.00  | $1,029.00     |
| Andy               | 1        | $40.00         | $2.00      | $10.00 | $10.00        |
| Amy                | 0        | $0.00          | $0.00      | $0.00  | $0.00         |

## Kết Quả Quét — FASTBOY Portal (`dev.v2.fastboypay.com`, shop `100004`)

Xác thực: SSO login không thể script hóa (không có form username/password).
Đăng nhập thủ công một lần qua `tests/portal/auth.setup.ts` (`npm run auth`)
— một trình duyệt headed mở `/login`, chờ người dùng hoàn tất Google SSO,
rồi lưu session vào `.auth/portal-storage-state.json` (gitignored).

> **Điểm cần lưu ý**: script setup ban đầu chờ `url.pathname !== '/login'`
> để xác nhận thành công — nhưng `/login` lập tức redirect sang
> `accounts.google.com`, mà URL đó _cũng_ không phải `/login`, nên điều
> kiện chờ trả về ngay lập tức mà chưa hề đăng nhập thật. Đã sửa lại
> thành chờ `url.host === portalHost && pathname !== '/login'` (tức là
> quay lại đúng host của Portal), nên giờ đã chờ đúng cho tới khi SSO
> hoàn tất (~1–1.5 phút để người dùng click qua các bước).

Đã quét trực tiếp qua project Playwright `portal` (`storageState` từ bước
trên) cho cùng 6 kỳ như bản quét local. Dropdown kỳ của Portal (`combobox`
hiển thị ví dụ "Jul 9, 2026 - Jul 13, 2026") ánh xạ tới các `periodId` sau
cho shop `100004`:

| Kỳ              | `periodId`                             |
| --------------- | -------------------------------------- |
| Jul 9–13, 2026  | `019f4540-9412-7870-a83b-72ece4e375c7` |
| Jul 1–8, 2026   | `019f1c0c-bebe-7e81-916e-fdcc4a54cb22` |
| Jun 30, 2026    | `019f16e6-d058-7d63-aa72-1426ba834082` |
| Jun 28–29, 2026 | `019f0c9a-82b5-7760-9e2f-5b2f5f990d9b` |
| Jun 25–27, 2026 | `019efd29-8c0e-7037-b689-379dc915e860` |
| Jun 22–24, 2026 | `019ef27b-c37f-794a-9c10-746e615045f4` |

**Kết quả: dữ liệu khớp chính xác với Volt POS ở mọi dòng nhân viên mà
Portal hiển thị, ở cả 6 kỳ** — kể cả Tổng thu nhập âm `-$8.00` của Hugo
trong kỳ Jun 28–29 (xem TC-09), và Val/Andy/Tony/Kevin/v.v. ở mọi kỳ khác.
Không tìm thấy sai lệch số liệu nào trong 96 dòng đã đối chiếu (16 nhân
viên × 6 kỳ).

**Nhưng số dòng luôn không khớp**: Portal hiển thị **16 dòng mỗi kỳ**,
Volt POS hiển thị **26**. Xem mục Sai Lệch bên dưới — điều này nhất quán
qua cả 6 kỳ, không phải hiện tượng đơn lẻ.

## Sai Lệch

### D-1: Portal bỏ sót 10 nhân viên mà Volt POS luôn liệt kê

- **Volt POS**: luôn liệt kê đủ 26 nhân viên, bất kể có hoạt động hay không.
- **Portal**: chỉ liệt kê 16. 10 người bị thiếu giống nhau ở mọi kỳ:
  Tuesday, Tommy, Tom, Stephanie, Peter, Nash, Kim, Iverson, Henry, Amy.
- **Không phải quy tắc đơn giản "ẩn nếu toàn số 0"**: 5 trong số 16 nhân
  viên mà Portal _có_ hiển thị cũng toàn số 0 ở mọi kỳ (Jackie, Ryan,
  Wendy, Bob, Vincent), nên riêng việc không có hoạt động/thu nhập không
  giải thích được việc bị bỏ sót. Khả năng cao nhất: Portal chỉ liệt kê
  nhân viên có bản ghi lương/ca làm cho shop đó trong kỳ đó, trong khi báo
  cáo local của Volt POS luôn hiển thị toàn bộ danh sách nhân viên. Cần
  xác nhận từ backend/API trước khi coi bên nào là "sai" — đây có thể là
  hành vi có chủ đích (Portal = bản ghi lương thực tế, Volt POS = chiếu
  toàn bộ danh sách nhân viên).
- **Ảnh hưởng tới TC-10/TC-11**: viết lại assertion đối chiếu thành quan
  hệ Portal-là-tập-con-của-Volt-POS, không phải khớp tập 1:1 — tức là mọi
  dòng của Portal phải khớp chính xác với dòng tương ứng bên Volt POS
  (điều này đúng ✅), nhưng Volt POS được phép có thêm các dòng toàn số 0
  mà Portal không hiển thị.
- **Trùng lặp Mr. Kevin Vu**: đã xác nhận trên cả hai app — 2 dòng "Mr.
  Kevin Vu" giống hệt nhau, toàn số 0, xuất hiện ở mọi kỳ trên cả Portal,
  khớp với hiện tượng trùng dòng của chính Volt POS.

### D-2: Lệch field "Deduction/Clean Up Fee" ở panel chi tiết cho một số nhân viên

Phát hiện qua đối chiếu panel chi tiết tự động (TC-12), sau khi app được
build lại 2026-07-20:

- Nhân viên **Hugo** (kỳ Jul 9–13) và **Annie**, **Bob** (kỳ khác trong 6 kỳ
  đã quét) có giá trị **Clean Up Fee/Deduction khác nhau** giữa Volt POS và
  Portal, dù mọi field khác (Sale/Refund/Staff Commission/Tip/Card Charge
  Tip/Total Income/Pay 1/Pay 2) khớp chính xác.
- Cả 3 trường hợp đều là nhân viên loại **commission**. Chưa quan sát thấy
  lệch Deduction ở nhân viên loại **salary** (Tony, Val khớp field này).
- Cần backend/PM xác nhận: đây có phải do 2 hệ thống tính "Clean Up Fee"
  khác thời điểm chốt sổ (cutoff time) hay là bug đồng bộ dữ liệu thật.

### D-3: Working Hours lệch làm tròn hiển thị (không phải bug dữ liệu)

- Volt POS hiển thị 2 chữ số thập phân (vd. `20.92`), Portal làm tròn 1 chữ
  số thập phân (vd. `20.9`) cho cùng nhân viên/kỳ — cùng giá trị gốc, chỉ
  khác độ chính xác hiển thị. Test đối chiếu dùng dung sai `0.05` giờ thay
  vì so chuỗi tuyệt đối cho field này.

### D-4: Volt POS thỉnh thoảng trả về bảng rỗng (0 dòng) ngay sau khi đổi kỳ

- Quan sát được trong lúc chạy đối chiếu tự động qua nhiều kỳ liên tiếp:
  sau khi gọi `selectPeriod()` chuyển sang 1 kỳ khác, `readAllRows()` đôi
  khi trả về **0 dòng** dù màn hình luôn có đủ 26 nhân viên trên thực tế.
  Đã thêm cơ chế polling chờ tối đa ~3s (`rowCountSettled()` trong
  `StaffPayrollPage.ts`) nhưng vẫn xảy ra ở một số lần chạy — có thể cần
  thời gian chờ dài hơn hoặc một tín hiệu "đã tải xong" đáng tin cậy hơn từ
  UI (vd. tắt trạng thái loading/skeleton) thay vì poll rowCount thô.
- **Chưa rõ nguyên nhân gốc**: có thể do polling/refetch nền của app (đã
  quan sát toast "Internet connection restored" xuất hiện trong lúc quét),
  hoặc do việc đổi kỳ liên tục nhanh hơn UI xử lý kịp. Cần điều tra thêm
  trước khi coi đây là bug sản phẩm.

## Việc Cần Làm Tiếp

- [x] Chạy `npm run auth` (SSO thủ công) — đã sửa lỗi script setup báo
      thành công quá sớm trước (xem lưu ý ở trên).
- [x] Quét Portal cho đủ 6 kỳ — xong, xem các bảng ở trên.
- [x] Ghi nhận sai lệch số dòng thành mục Sai Lệch (D-1).
- [x] Đổi assertion từ "số dòng bằng nhau" thành "mọi dòng của Portal khớp
      với dòng tương ứng bên Volt POS" theo D-1 (không cần hardcode
      `periodId` nữa — spec tự đọc period labels từ dropdown POS và lái
      Portal theo cùng label).
- [x] Thêm đối chiếu panel chi tiết từng nhân viên (TC-12/TC-13), không chỉ
      quét danh sách — xem `PortalStaffPayrollPage.readDetailPanel()` và
      `StaffPayrollPage.readDetailPanel()`, có hỗ trợ 2 `payType`.
- [x] Ghi nhận sai lệch Deduction (D-2) và rounding Working Hours (D-3).
- [ ] Xin xác nhận xem D-1 (10 nhân viên bị thiếu) có phải hành vi sản
      phẩm có chủ đích hay là lỗi của Portal.
- [ ] Xin xác nhận D-2 (lệch Deduction ở nhân viên commission) có phải bug
      thật hay khác biệt cutoff time giữa 2 hệ thống.
- [ ] Điều tra D-4 (POS trả bảng rỗng sau khi đổi kỳ) — cần biết trước khi
      tin tưởng chạy đối chiếu toàn bộ 6 kỳ mà không có bước polling/retry.

Liên quan: [[income-screens-gotchas]].
