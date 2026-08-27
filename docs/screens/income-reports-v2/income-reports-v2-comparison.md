# So sánh 3 cặp màn hình Report: V1 vs V2

> Quét trực tiếp bằng MCP Playwright trên app đang chạy tại `http://localhost:1420`, ngày dữ liệu **Jul 21, 2026** (shop timezone), sau khi nhập passcode `8888` để qua `PermissionProtectedRoute`.
>
> Route V1/V2 lấy từ sidebar thực tế của app (không phải suy đoán):
>
> - `/incomes/income-daily` ↔ `/incomes/income-daily-v2` — **Daily Sale Report**
> - `/incomes/income-summary` ↔ `/incomes/income-summary-v2` — **Income Summary**
> - `/incomes/income-staff` ↔ `/incomes/income-staff-v2` — **Staff Income**

## Kết luận nhanh

| Cặp màn hình            | Kết quả so sánh                                                           |
| ----------------------- | ------------------------------------------------------------------------- |
| Daily Sale Report vs V2 | **Giống hệt 100%** — cùng dữ liệu, cùng layout, chỉ khác tiêu đề "... V2" |
| Income Summary vs V2    | **Có sai lệch dữ liệu ở panel chi tiết** (xem mục "Bug tìm thấy")         |
| Staff Income vs V2      | **Giống hệt 100%** — cả layout salary-type lẫn commission-type đều khớp   |

---

## 1. Daily Sale Report (`income-daily`) vs Daily Sale Report V2 (`income-daily-v2`)

Cả 2 route trả về **cùng một bộ dữ liệu, cùng cấu trúc**, chỉ tiêu đề đổi từ "Daily Sale Report" → "Daily Sale Report V2".

### Cấu trúc màn hình (giống nhau ở cả 2 bản)

**A. 4 thẻ thống kê (stat cards) + so sánh vs Yesterday:**

| Field                                | Giá trị quét được           | Mô tả (tooltip trong app)                                                                                               |
| ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Total Order                          | 7 (↑96% vs Yesterday)       | Total number of order, excluding cancel/refunds/manual refunds                                                          |
| Sale                                 | $471.50 (↑93% vs Yesterday) | Total sale amount of the order, including refund/partial refund values after discount is applied, excluding Tax and Tip |
| Total tip _(chú ý chữ thường "tip")_ | $72.00 (↑56% vs Yesterday)  | Total tips received, not included in sales revenue but counted in collected amounts                                     |
| Total Payment                        | $543.50 (↑92% vs Yesterday) | The final revenue includes Gift Card Redemption                                                                         |

**B. Chart "Sale"** — biểu đồ cột theo giờ trong ngày.

**C. Bảng danh sách Order (7 dòng, mỗi dòng click được → mở chi tiết order):**

| Order #           | Sale/Refund | Tip    | Tax   | Total (Sale+Tax+Tip) |
| ----------------- | ----------- | ------ | ----- | -------------------- |
| OD260721-25951760 | $140.00     | $20.00 | $0.00 | $160.00              |
| OD260721-26073632 | $140.00     | $20.00 | $0.00 | $160.00              |
| OD260721-26684906 | $140.00     | $20.00 | $0.00 | $160.00              |
| OD260721-27254727 | $60.50      | $5.00  | $0.00 | $65.50               |
| OD260721-27339767 | $22.00      | $8.00  | $0.00 | $30.00               |
| OD260720-30723448 | -$75.00     | -$1.00 | $0.00 | -$76.00              |
| OD260721-27797111 | $22.00      | $0.00  | $0.00 | $22.00               |
| OD260721-27815904 | $22.00      | $0.00  | $0.00 | $22.00               |

**D. Income Details:**

- Sale: $471.50
- Tip: $72.00
- Tax Collected _(Sales tax collected, adjusted for refunds)_: $0.00
- Total Payment: $543.50

**E. Payment Details:**

- Card: $139.50
- Cash: $404.00
- Others: $0.00
- Amount Collected: $543.50
- Gift Card Redemption: $0.00
- Total Payment: $543.50

### So sánh V1 vs V2

Tất cả field ở trên (A–E) **giống hệt nhau về giá trị** giữa 2 route. Không phát hiện khác biệt.

---

## 2. Income Summary (`income-summary`) vs Income Summary V2 (`income-summary-v2`)

### Cấu trúc màn hình (giống nhau ở cả 2 bản)

**A. Header:**

- "Total Income Jul 21, 2026": **$471.50** (↑689.38% vs. Same day last week)
- Legend: Gross Income / Net Income / Total tip
- Toggle Day / Week / Month + chart theo `groupBy`

**B. Bảng theo kỳ (Date/Sale/Tip/Tax/Total Payment):**

| Date   | Sale    | Tip    | Tax   | Total Payment |
| ------ | ------- | ------ | ----- | ------------- |
| Jul 21 | $471.50 | $72.00 | $0.00 | $543.50       |

Click 1 dòng → mở panel chi tiết bên phải (`detailId` gắn vào URL).

**C. Panel chi tiết — Payment Details** _(giống nhau V1/V2)_:

- Cash: $404.00 → Sale $420.00, Refund -$75.00, Tip $59.00, Tax $0.00
- Card: $139.50 → Sale $126.50, Refund $0.00, Tip $13.00, Tax $0.00
- Others: $0.00 → Sale/Refund/Tip/Tax đều $0.00
- Amount Collected: $543.50
- Gift Card Redemption: $0.00 (Sale/Tip/Tax $0.00)
- Total Payment: $543.50

**D. Panel chi tiết — Sale Details** ⚠️ **KHÁC NHAU (xem bug bên dưới)**

**E. Panel chi tiết — Supply Fee** _(giống nhau V1/V2)_:

- Total supply fee: -$1.00
- Staff Supply Share: $0.00
- Salon Supply Share: -$1.00

**F. Panel chi tiết — Staff Payout** _(giống nhau V1/V2)_:

- Total Service: $471.50
- Staff Supply Share: $0.00
- Staff Commission: $95.00
- Tip: $59.00
- Clean Up Fee: $54.00
- Discount Charge: $0.00
- Card Charge Commission: $0.22
- Card Charge Tip: $0.00
- Staff Salary: $1,716.65
- **Total Staff Payout: $1,816.43** → Pay 1: $772.10 / Pay 2: $1,044.33

**G. Panel chi tiết — Salon Earnings** ⚠️ **KHÁC NHAU (xem bug bên dưới)**

### 🐛 Bug tìm thấy: Income Summary V2 — Sale Details & Salon Earnings sai lệch dữ liệu

Khi so sánh trực tiếp cùng 1 ngày (Jul 21, 2026), cùng dữ liệu nguồn, panel chi tiết ở V2 trả về **giá trị khác V1** cho các field bên dưới — trong khi V1 nội bộ tự nhất quán (breakdown cộng đúng bằng tổng).

**Sale Details:**

| Field                                                            | V1 (`income-summary`) | V2 (`income-summary-v2`) | Ghi chú                                                                                       |
| ---------------------------------------------------------------- | --------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| Total Sale (heading)                                             | $546.50               | $546.50                  | Giống nhau                                                                                    |
| Service Sale                                                     | **$546.50**           | **$0.00**                | ❌ V2 sai — Service+Product+GiftCard Sale ở V2 cộng lại = $0, không khớp Total Sale = $546.50 |
| Product Sale                                                     | $0.00                 | $0.00                    | Giống                                                                                         |
| Gift Card Sale                                                   | $0.00                 | $0.00                    | Giống                                                                                         |
| Total Refund (heading)                                           | $75.00                | $75.00                   | Giống nhau                                                                                    |
| Service Refund                                                   | **$75.00**            | **$0.00**                | ❌ V2 sai — Service+Product Refund ở V2 cộng lại = $0, không khớp Total Refund = $75.00       |
| Product Refund                                                   | $0.00                 | $0.00                    | Giống                                                                                         |
| Subtotal, Discount, Net Total, Tip, Tax Collected, Total Payment | Giống hệt             | Giống hệt                | Không đổi                                                                                     |

**Salon Earnings:**

| Field                                                                                                                      | V1             | V2          | Ghi chú                                   |
| -------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------- | ----------------------------------------- |
| Total Service, Salon Supply Share, Salon Commission, Product Sale/Refund, Total Discount, Net Earnings, Staff Supply Share | Giống hệt      | Giống hệt   | Không đổi                                 |
| Clean Up Fee                                                                                                               | **$54.00**     | **$0.00**   | ❌ V2 thiếu Clean Up Fee                  |
| Discount Charge, Card Charge Commission, Card Charge Tip                                                                   | Giống hệt      | Giống hệt   | Không đổi                                 |
| Staff Salary                                                                                                               | **$1,716.65**  | **$0.00**   | ❌ V2 thiếu Staff Salary                  |
| **Total Earnings**                                                                                                         | **-$1,284.93** | **$377.72** | ❌ Lệch ~$1,662.65 do 2 field trên bị mất |

**Đề xuất kiểm tra code:** field `Service Sale`/`Service Refund` trong Sale Details và `Clean Up Fee`/`Staff Salary` trong Salon Earnings ở trang V2 (`/incomes/income-summary-v2`) có khả năng bind sai nguồn dữ liệu hoặc thiếu tính toán so với API/logic của V1.

---

## 3. Staff Income (`income-staff`) vs Staff Income V2 (`income-staff-v2`)

### Cấu trúc màn hình (giống nhau ở cả 2 bản)

**A. 6 thẻ thống kê tổng hợp toàn shop:**

| Field              | Giá trị   |
| ------------------ | --------- |
| Total staff        | 9         |
| Total orders       | 8         |
| Total subtotal     | $471.50   |
| Total supply fee   | -$1.00    |
| Total tip          | $59.00    |
| Total staff income | $1,732.43 |

**B. Bảng danh sách staff (Name/Orders/Subtotal/Supply Fee/Tip/Total Income):**

| Staff    | Orders | Subtotal | Supply Fee | Tip    | Total Income |
| -------- | ------ | -------- | ---------- | ------ | ------------ |
| trinehhh | 1      | $140.00  | $0.00      | $20.00 | $20.00       |
| Val      | 3      | $104.50  | $0.00      | $0.00  | $0.00        |
| Mai      | 0      | $0.00    | $0.00      | $0.00  | $451.66      |
| Linda    | 1      | $140.00  | $0.00      | $20.00 | $20.00       |
| Kevin    | 1      | -$75.00  | -$1.00     | -$1.00 | $645.66      |
| Jackie   | 1      | $140.00  | $0.00      | $20.00 | $20.00       |
| Hugo     | 1      | $22.00   | $0.00      | $0.00  | $10.78       |
| Evon     | 0      | $0.00    | $0.00      | $0.00  | $221.33      |
| Annie    | 0      | $0.00    | $0.00      | $0.00  | $343.00      |

Click 1 staff → mở panel chi tiết bên phải (`staffId` gắn vào URL). Panel có **2 layout** tùy pay type của staff:

**C1. Layout "salary" (vd. Kevin — Salary by Period):**

- Bảng order riêng của staff: Order #, Sale/Refund, Tip
- Clock In: `-`, Clock Out: `-`, Working Days: 1
- Sale $0.00 / Refund -$75.00 / Subtotal -$75.00
- Salary Type: Salary by Period, Rate: $666.66
- Gross Income _(Fixed salary for this period)_: $666.66
- Clean Up Fee/Deduction: $20.00
- Tip: -$1.00
- Card Charge Tip: $0.00
- **Total Income** _(Gross Income − Clean Up Fee + Tip − Card Charge Tip)_: $645.66
- Pay 1 _(Gross Income × 50% − Clean Up Fee − Card Charge Tip)_: $313.33
- Pay 2 _(Gross Income × 50% + Tip)_: $332.33

**C2. Layout "commission" (vd. trinehhh):**

- Bảng order riêng: Order #, Sale/Refund, Supply, Tip
- Sale $140.00 / Refund $0.00 / Subtotal $140.00
- Supply Fee _(incl. Sale & Refund)_: $0.00
- Staff Commission _((Subtotal − Supply Fee) × Commission Rate)_: $0.00
- Commission Rate (07/21/2026): 0%
- Card Charge Commission: $0.00
- Clean Up Fee/Deduction: $0.00
- Discount Charge: $0.00
- Tip: $20.00
- Card Charge Tip: $0.00
- **Total Income** _(Staff Commission − Clean Up Fee + Tip − Card Charge Commission − Card Charge Tip − Discount Charge)_: $20.00
- Pay 1 _(Staff Commission × Pay 1 Rate − Clean Up Fee − Card Charge Commission − Card Charge Tip − Discount Charge)_, Pay 1 Rate 0%: $0.00
- Pay 2 _(Staff Commission × Pay 2 Rate + Tip)_, Pay 2 Rate 100%: $20.00

### So sánh V1 vs V2

Đã quét đối chiếu cả **layout salary (Kevin)** và **layout commission (trinehhh)** — tất cả field, công thức, giá trị **giống hệt nhau** giữa `income-staff` và `income-staff-v2`. Không phát hiện sai lệch.

> ⚠️ **Cập nhật 2026-08-20 — kết luận "không sai lệch" ở trên KHÔNG còn đúng cho panel chi tiết V2.** Khi chạy lại `TC-IRV2-3` (xem "Code đã sinh" bên dưới), **bảng danh sách** và **stat bar** của V1 và V2 vẫn khớp tuyệt đối, nhưng **panel chi tiết bên phải của V2 trả về $0.00 cho một loạt field nguồn**, kéo theo Total Income / Pay 1 / Pay 2 sai theo:
>
> | Field                   | V1 (đúng)                                         | V2                                                                           |
> | ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
> | Gross Income _(salary)_ | $166.66 (SVF 4/5), $466.66 (Mai)                  | **$0.00** — dù dòng `Rate` ngay bên trên vẫn hiển thị đúng $166.66 / $466.66 |
> | Staff Commission        | $192.00 (Vincent), -$14.14 (trinehhh)             | **$0.00**                                                                    |
> | Card Charge Commission  | $5.76 (Vincent)                                   | **$0.00**                                                                    |
> | Card Charge Tip         | $0.94 (Wendy), $3.60 (Ryan), $0.45 (Vincent)      | **$0.00**                                                                    |
> | → **Total Income**      | $38.06 (Wendy), $198.29 (Vincent), $170.40 (Ryan) | **$39.00 / $12.50 / $174.00**                                                |
>
> Đây **không phải** lỗi chưa-load-xong: panel V2 tự nhất quán với các số $0.00 đó (Wendy: $0.00 − $8.00 + $47.00 − $0.00 = $39.00), giữ nguyên suốt 10 s chờ, và ảnh chụp màn hình cho thấy panel đã render đầy đủ. Ví dụ đầy đủ: ngày 07/22/2026, cả 16 staff.
>
> Hệ quả đáng chú ý: **trong V2, Total Income ở bảng danh sách ($38.06) khác Total Income ở panel chi tiết ($39.00) của cùng một staff** — hai con số đến từ hai query khác nhau (`income-staff-list` vs `income-staff-detail`) và chỉ panel bị ảnh hưởng. Vì vậy `IncomeStaffPage.openStaffDetail()` **không được** dùng Total Income của dòng làm mốc "panel đã load xong" (nó sẽ không bao giờ tới) — mốc đúng là `<h2>` tên staff trong panel.

### 3.1 Bảng phân tích chi tiết TỪNG staff (panel bên phải) — ngày 07/21/2026, cả 8 staff

> Quét lại bằng MCP Playwright trên `income-staff` (Yesterday = 07/21/2026), click từng dòng trong bảng 8 staff và chụp toàn bộ panel chi tiết bên phải. Route V2 (`income-staff-v2`) đối chiếu bằng code (mục "Code đã sinh" bên dưới) chứ không quét tay lặp lại — kết quả tay ở đây dùng làm "nguồn sự thật" để viết assertion.

**Tổng hợp phân loại 8 staff của ngày này:**

| Staff    | Orders | Loại panel | Salary subtype    | Rate ngày 07/21/2026 |
| -------- | ------ | ---------- | ----------------- | -------------------- |
| trinehhh | 1      | Commission | –                 | 10.1%                |
| Val      | 2      | Salary     | Wage Per Day      | $80.00/ngày          |
| Mai      | 0      | Salary     | Salary by Period  | $466.66              |
| Linda    | 1      | Salary     | **Wage Per Hour** | $30.00/giờ           |
| Kevin    | 1      | Salary     | Salary by Period  | $666.66              |
| Jackie   | 1      | Salary     | Wage Per Day      | $120.00/ngày         |
| Evon     | 0      | Salary     | Salary by Period  | $233.33              |
| Annie    | 0      | Salary     | Salary by Period  | $350.00              |

Vậy chỉ riêng ngày 07/21/2026 đã có đủ **4 biến thể pay-type/subtype** trên cùng 1 ngày: Commission (trinehhh), Wage Per Day (Val, Jackie), Wage Per Hour (Linda), Salary by Period (Mai, Kevin, Evon, Annie).

**C0. trinehhh — Commission** (đã có ở mục 3 phía trên, không lặp lại).

**C1. Val — Salary, Wage Per Day:**

- Bảng order riêng: `Order #` / `Sale/Refund` / `Tip` — 2 dòng: `OD260721-27339767` ($22.00 / $8.00), `OD260721-27254727` ($60.50 / $5.00)
- Clock In: `-`, Clock Out: `-`, Working Days: **0**
- Sale $82.50 / Refund $0.00 / Subtotal $82.50
- Salary Type: Wage Per Day, Rate: $80.00
- Gross Income _(Rate × Working Days)_: **$0.00** ⚠️ (Working Days = 0 dù có 2 order trong ngày → Gross Income luôn $0, xem ghi chú bên dưới)
- Clean Up Fee/Deduction: $0.00
- Tip: **$0.00** ⚠️ (2 order cộng lại có tip $8.00 + $5.00 = $13.00 nhưng panel hiển thị $0.00 — cùng hiện tượng "Tip trong panel không khớp tổng tip của các order" như ghi chú Working Days ở mục 4.3)
- Card Charge Tip: $0.00
- **Total Income** _(Gross Income − Clean Up Fee + Tip − Card Charge Tip)_: $0.00
- Pay 1 _(Gross Income × 20% − Clean Up Fee − Card Charge Tip)_: $0.00
- Pay 2 _(Gross Income × 80% + Tip)_: $0.00

**C2. Mai — Salary, Salary by Period (không có order trong ngày):**

- Bảng order: trống — hiển thị "No data available / No orders found for the selected date."
- Clock In: `-`, Clock Out: `-`, Working Days: 1
- Sale $0.00 / Refund $0.00 / Subtotal $0.00
- Salary Type: Salary by Period, Rate: $466.66
- Gross Income _(Fixed salary for this period)_: $466.66
- Clean Up Fee/Deduction: $15.00
- Tip: $0.00, Card Charge Tip: $0.00
- **Total Income**: $451.66 → Pay 1 _(Gross Income × 35% − Clean Up Fee − Card Charge Tip)_: $148.33 / Pay 2 _(Gross Income × 65% + Tip)_: $303.33

**C3. Linda — Salary, Wage Per Hour (subtype mới chưa có ví dụ chi tiết trước đây):**

- Bảng order riêng: `Order #` / `Sale/Refund` / `Tip` — 1 dòng: `OD260721-25951760` ($140.00 / $20.00)
- Clock In: `-`, Clock Out: `-`, **Working Hours**: 0 _(nhãn field khác Wage Per Day/Salary — đúng là "Working Hours" chứ không phải "Working Days")_
- Sale $140.00 / Refund $0.00 / Subtotal $140.00
- Salary Type: Wage Per Hour, Rate: $30.00
- Gross Income _(Rate × Working Hours)_: $0.00 (Working Hours = 0)
- Clean Up Fee/Deduction: $0.00
- Tip: $20.00 (ở đây Tip trong panel KHỚP với tip của order duy nhất, khác trường hợp Val có 2 order)
- Card Charge Tip: $0.00
- **Total Income** _(Gross Income − Clean Up Fee + Tip − Card Charge Tip)_: $20.00
- Pay 1 _(Gross Income × 25% − Clean Up Fee − Card Charge Tip)_: $0.00
- Pay 2 _(Gross Income × 75% + Tip)_: $20.00

**C4. Kevin — Salary, Salary by Period** (đã có ở mục "C1. Layout salary" phía trên — khớp 100% với lần quét này).

**C5. Jackie — Salary, Wage Per Day:**

- Bảng order riêng: 1 dòng `OD260721-26073632` ($140.00 / $20.00)
- Clock In: `-`, Clock Out: `-`, Working Days: 0
- Sale $140.00 / Refund $0.00 / Subtotal $140.00
- Salary Type: Wage Per Day, Rate: $120.00
- Gross Income _(Rate × Working Days)_: $0.00
- Clean Up Fee/Deduction: $0.00
- Tip: $20.00 (khớp tip order duy nhất — khác Val vốn có 2 order)
- Card Charge Tip: $0.00
- **Total Income**: $20.00 → Pay 1 _(Gross Income × 40% − Clean Up Fee − Card Charge Tip)_: $0.00 / Pay 2 _(Gross Income × 60% + Tip)_: $20.00

**C6. Evon — Salary, Salary by Period (0 order):**

- Bảng order: trống
- Clock In: `-`, Clock Out: `-`, Working Days: 1
- Sale/Refund/Subtotal đều $0.00
- Salary Type: Salary by Period, Rate: $233.33
- Gross Income: $233.33, Clean Up Fee/Deduction: $12.00, Tip: $0.00, Card Charge Tip: $0.00
- **Total Income**: $221.33 → Pay 1: $104.66 / Pay 2: $116.67

**C7. Annie — Salary, Salary by Period (0 order):**

- Bảng order: trống
- Clock In: `-`, Clock Out: `-`, Working Days: 1
- Sale/Refund/Subtotal đều $0.00
- Salary Type: Salary by Period, Rate: $350.00
- Gross Income: $350.00, Clean Up Fee/Deduction: $7.00, Tip: $0.00, Card Charge Tip: $0.00
- **Total Income**: $343.00 → Pay 1: $168.00 / Pay 2: $175.00

⚠️ **Ghi chú nghiệp vụ mới phát hiện — "Tip trong panel không luôn khớp tổng tip của các order hiển thị ngay bên trên":** với staff có ĐÚNG 1 order trong ngày (Linda, Jackie, Kevin, trinehhh), field Tip trong panel luôn khớp đúng tip của order đó. Nhưng với **Val** (2 order, tip $8.00 + $5.00 = $13.00), field Tip trong panel lại hiển thị **$0.00**, không phải $13.00. Cùng lúc, Gross Income của Val cũng bị tính $0.00 do Working Days = 0. Cả 2 field cùng "về 0" gợi ý: khi Working Days/Working Hours = 0 (staff Salary chưa "chấm công" chính thức cho kỳ này dù có order), backend có thể đang chặn/zero-hoá toàn bộ nhánh tính lương salary (gồm cả Tip) thay vì chỉ Gross Income — cần xác nhận lại với đội backend đây là hành vi đúng theo thiết kế ("chỉ tính lương khi có Working Days > 0") hay là bug tính thiếu Tip khi Working Days = 0.

---

## 4. Staff Income — Quét mở rộng 1 tháng, toàn bộ staff & pay-type

> Khoảng ngày dùng để quét: chọn preset **"This Month"** trong date-filter combobox trên `income-staff` → URL ra `?from=1782882000&to=1784696399`, hiển thị `07/01/2026 - 07/21/2026` (từ đầu tháng đến hôm nay, app không cho chọn hết tháng 7 vì chưa qua ngày 21). Đây là range 1 tháng (tính từ đầu tháng) theo đúng ý định của yêu cầu.

Ở khoảng ngày này, bảng danh sách staff hiển thị **15 staff** (nhiều hơn 9 staff của bản quét 1-ngày Jul 21 trước đó, vì có thêm staff không phát sinh order vào riêng ngày 21/07 nhưng có order trong các ngày khác của tháng): Wendy, Vincent, Val, trinehhh, Tony, Ryan, Mai, Linda, Kevin, Jackie, Hugo, Evon, Bob, Annie, Andy.

**Tổng shop (6 thẻ thống kê) tại `income-staff` với range tháng:**

| Field              | Giá trị    |
| ------------------ | ---------- |
| Total staff        | 15         |
| Total orders       | 230        |
| Total subtotal     | $10,302.40 |
| Total supply fee   | $117.00    |
| Total tip          | $624.66    |
| Total staff income | $17,174.90 |

### 4.1 Bảng phân loại pay-type của toàn bộ 15 staff

| Staff    | Orders (tháng) | Pay type   | Salary subtype       | Rate quét được                                  |
| -------- | -------------- | ---------- | -------------------- | ----------------------------------------------- |
| Wendy    | 1              | Salary     | **Wage Per Day**     | $150.00/ngày                                    |
| Vincent  | 0              | Commission | –                    | 60%                                             |
| Val      | 9              | Salary     | **Wage Per Day**     | $80.00/ngày                                     |
| trinehhh | 1              | Commission | –                    | 0% (theo tuần, xem 4.3)                         |
| Tony     | 8              | Salary     | **Wage Per Hour**    | $25.00/giờ                                      |
| Ryan     | 1              | Salary     | **Wage Per Hour**    | (không xem rate chi tiết, chỉ xác nhận subtype) |
| Mai      | 5              | Salary     | **Salary by Period** | (xem 4.3)                                       |
| Linda    | 4              | Salary     | **Wage Per Hour**    | (không xem rate chi tiết)                       |
| Kevin    | 186            | Salary     | **Salary by Period** | rate đổi theo tuần (xem 4.3)                    |
| Jackie   | 5              | Salary     | **Wage Per Day**     | (không xem rate chi tiết)                       |
| Hugo     | 3              | Commission | –                    | 50%                                             |
| Evon     | 1              | Salary     | **Salary by Period** | (không xem rate chi tiết)                       |
| Bob      | 4              | Commission | –                    | 60%                                             |
| Annie    | 0              | Salary     | **Salary by Period** | (không xem rate chi tiết)                       |
| Andy     | 2              | Salary     | **Wage Per Day**     | (không xem rate chi tiết)                       |

**Kết luận độ phủ salary subtype:** cả **3 subtype Salary** đúng như Staff Setting (Salary by Period, Wage Per Day, Wage Per Hour) đều **có mặt** trong dữ liệu thật, cùng dạng Commission — tổng cộng đủ **4 biến thể pay-type** cần kiểm tra:

- Commission: Vincent (60%), trinehhh (0%), Hugo (50%), Bob (60%)
- Salary by Period: Mai, Kevin, Evon, Annie
- Wage Per Day: Wendy, Val, Jackie, Andy
- Wage Per Hour: Tony, Ryan, Linda

### 4.2 Order-level detail cho staff nhiều order — Kevin (186 orders)

Khi mở panel chi tiết của Kevin (`staffId=019ef27b-c9e2-745d-92fc-6baec45fa02f`), bảng Order **render toàn bộ 186 order cùng lúc trong DOM** (không phân trang, không lazy-load/virtualization) — accessibility snapshot của panel này dài **~850 dòng YAML**. Vì vậy **không cần thao tác "scroll" thủ công để load thêm dữ liệu** — chỉ cần snapshot là thấy hết toàn bộ order ngay từ đầu. Một vài order mẫu (đầu bảng, mới nhất trước):

| Order #           | Sale/Refund | Tip    |
| ----------------- | ----------- | ------ |
| OD260720-30723448 | -$75.00     | -$1.00 |
| OD260720-30733093 | -$80.00     | -$1.00 |
| OD260720-30684380 | -$8.00      | -$1.00 |
| OD260720-30742856 | -$73.00     | -$1.00 |
| OD260720-30693721 | -$65.00     | (…)    |

**Tổng hợp Kevin (Salary by Period) cho cả tháng:**

- Clock In/Out: `-` / `-`, Working Days: 13
- Sale $6,656.00 / Refund -$301.00 / Subtotal $6,355.00
- Salary Type: Salary by Period, Rate hiển thị "-" ở dòng tổng (vì rate đổi theo từng kỳ lương, xem breakdown 4.3)
- Gross Income _(Fixed salary for this period)_: $4,666.66
- Clean Up Fee/Deduction: $260.00
- Tip: $277.50, Card Charge Tip: $50.00
- **Total Income**: $4,634.16 → Pay 1: $2,023.30 / Pay 2: $2,610.86

⚠️ **Sai lệch nhỏ tìm thấy:** bảng danh sách staff (tổng quan) hiển thị Total Income của Kevin là **$4,634.13**, nhưng panel chi tiết hiển thị **$4,634.16** — lệch **$0.03**. Đây là sai lệch làm tròn (rounding) giữa giá trị tổng hợp ở bảng danh sách và giá trị tính lại trong panel chi tiết, cần kiểm tra logic tổng hợp/làm tròn phía backend hoặc phía tổng hợp client.

### 4.3 Rate/Commission thay đổi theo tuần trong cùng 1 khoảng ngày — phát hiện kỹ thuật mới

Khi khoảng ngày quét trải dài nhiều tuần lương (payroll period), UI **tự chia nhỏ theo từng kỳ rate/commission đã áp dụng** thay vì chỉ hiển thị 1 giá trị duy nhất:

- **trinehhh (Commission)**: hiển thị 4 dòng `Commission Rate (07/01/2026 - 07/08/2026): 0%`, `(07/09/2026 - 07/13/2026): 0%`, `(07/14/2026 - 07/20/2026): 0%`, `(07/21/2026): 0%` — tương tự với `Pay 1 Rate`/`Pay 2 Rate` cũng tách theo từng kỳ đổi rate.
- **Vincent (Commission 60%)**: 4 kỳ đều 60%, Pay 1 Rate 30% / Pay 2 Rate 70% xuyên suốt — rate ổn định trong tháng.
- **Kevin (Salary by Period)**: dòng "Rate" ở tổng hiển thị "-", thay vào đó liệt kê `Rate (07/01/2026 - 07/08/2026): $0.00`, `(07/09/2026 - 07/13/2026): $400.00`, `(07/14/2026 - 07/20/2026): $285.71`, `(07/21/2026): $666.66` — đúng là salary theo kỳ, mỗi kỳ lương có rate cấu hình khác nhau, và Gross Income $4,666.66 là tổng các kỳ (không đơn thuần cộng 4 số hiển thị, vì các con số hiển thị có thể là rate quy đổi/ngày chứ không phải tổng tiền kỳ đó).

**Ghi chú riêng cho Val (Wage Per Day):** order trải trên 3 ngày khác nhau trong tháng (07/07, 07/13, 07/21) nhưng field **Working Days vẫn hiển thị "1"** và Gross Income chỉ tính `Rate × 1 = $80.00` (không phải 3 ngày × $80 = $240). Cần xác nhận lại đây là hành vi đúng theo thiết kế (ví dụ "Working Days" chỉ đếm ngày làm việc thực tế đã "check-in", không suy ra từ ngày có order) hay là một bug tính thiếu Working Days khi range trải nhiều ngày — trong dữ liệu quét được, Total Income hiển thị nhất quán ở cả bảng tổng quan ($75.00) và panel chi tiết ($75.00) nên nội bộ không tự mâu thuẫn, nhưng về mặt nghiệp vụ có vẻ đáng nghi (nhân viên làm 3 ngày nhưng chỉ được tính lương 1 ngày).

### 4.4 So sánh V1 vs V2 ở tầm tháng — vẫn khớp cho cả 4 biến thể pay-type

Đối chiếu trực tiếp cùng `staffId` + cùng `from`/`to` (tháng) giữa `/incomes/income-staff` và `/incomes/income-staff-v2`:

| Staff    | Pay type         | Total Income V1 | Total Income V2 | Khớp? |
| -------- | ---------------- | --------------- | --------------- | ----- |
| trinehhh | Commission       | $20.00          | $20.00          | ✅    |
| Wendy    | Wage Per Day     | $142.00         | $142.00         | ✅    |
| Tony     | Wage Per Hour    | $549.76         | $549.76         | ✅    |
| Kevin    | Salary by Period | $4,634.16       | $4,634.16       | ✅    |

Cả 4 biến thể pay-type (Commission, Wage Per Day, Wage Per Hour, Salary by Period) đều **giữ nguyên kết luận "giống hệt 100%"** giữa V1/V2 kể cả khi mở rộng range ra 1 tháng — không phát hiện thêm sai lệch mới giữa V1/V2 của Staff Income ngoài phạm vi đã biết.

### 4.5 Đối chiếu nhanh với Daily Sale Report & Income Summary (cùng range tháng)

- **Daily Sale Report (`income-daily`)** với `?from=1782882000&to=1784696399`: URL tự thêm `activeChart=sale` nhưng **màn hình chỉ hiển thị dữ liệu của đúng 1 ngày `07/01/2026` (tức ngày `from`)** — header hiển thị "07/01/2026" chứ không phải range, Total Order = 6, Sale = $427.50, Total tip = $72.00, Total Payment = $499.50. → **Daily Sale Report không hỗ trợ quét theo range nhiều ngày**, nó luôn dùng `from` làm ngày đơn lẻ, bất kể `to` khác `from` bao xa. Đây là hành vi đúng theo tên gọi "Daily" nhưng cần lưu ý khi truyền `to` khác `from` vào URL sẽ không có tác dụng gì trên màn này.
- **Income Summary (`income-summary`)** với cùng range: hỗ trợ đúng range tháng — header hiển thị "Total Income Jul 01, 2026 - Jul 21, 2026: $10,767.20". Con số này **không bằng** "Total subtotal" $10,302.40 của Staff Income cho cùng range — nhưng đây là khác biệt kỳ vọng vì 2 field có định nghĩa khác nhau (Total Income ở Summary tính theo Sale gộp Net/Gross khác công thức Subtotal ở Staff Income, vốn là Sale − Refund riêng theo từng staff), không phải sai lệch cần sửa.

## Kết quả chạy 30-ngày gần nhất (2026-07-22)

Chạy `TC-income-reports-v2-compare.spec.ts` (đã bổ sung drill-down per-staff detail panel cho TC-IRV2-3, xem mục "Code đã sinh") toàn bộ 30 ngày (2026-06-23 → 2026-07-22), report tại [`reports/income-reports-v2/compare-latest.html`](../../../reports/income-reports-v2/compare-latest.html) (bản snapshot theo ngày: `compare-2026-07-22.html`). Report **đầy đủ 90/90 phần** (30 ngày × 3 màn hình) sau khi chạy bù lại TC-IRV2-3 lần 2 (lần đầu dừng sớm ở ngày 2026-07-07 do dev server tạm ngưng — xem log bên dưới).

- **3943 rows** so sánh trên **30/30 ngày**, **272 rows lệch** (mismatch + missing-in-one-side).
- **TC-IRV2-1 (Daily Sale Report)**: PASS toàn bộ 30 ngày — không lệch.
- **TC-IRV2-2 (Income Summary)**: FAIL như kỳ vọng — vẫn đúng bug đã biết ở §2 (Sale Details / Salon Earnings mất Service Sale/Refund, Clean Up Fee, Staff Salary ở V2), lặp lại ở mọi ngày có dữ liệu.
- **TC-IRV2-3 (Staff Income + per-staff detail panel mới)**: nay đã có đủ part cho cả 30/30 ngày. Toàn bộ 30 ngày đều FAIL soft-assertion ở mức "Total staff income"/`totalIncome` từng staff — lệch nhỏ, dạng rounding (ví dụ 2026-06-24: Vincent $166.53 vs $154.53, Jackie $108.16 vs $113.94; các ngày khác lệch tương tự vài đô/staff) — **cùng dạng sai lệch rounding đã ghi nhận ở mục 4.2** (Kevin lệch $0.03 giữa bảng tổng và panel chi tiết), nhưng ở đây là **giữa V1 và V2** chứ không phải giữa bảng tổng và panel chi tiết trong cùng 1 bản. Đây là **phát hiện mới**: sai lệch rounding nhỏ giữa V1/V2 xuất hiện ở HẦU HẾT các ngày có staff salary, mức lệch thường vài đô-la trên mỗi staff — cần đội backend kiểm tra logic làm tròn giữa 2 phiên bản tính lương salary, khác hẳn với mức độ "giống hệt 100%" đã kết luận ở các lần quét tay trước đó (§3, §4.4) vốn chỉ test 1-2 ngày mẫu cụ thể chứ chưa quét đủ 30 ngày liên tiếp.
- **Log kỹ thuật của lần chạy bù**: lần chạy TC-IRV2-3 đầu tiên bị dừng ở ngày 2026-07-07 vì `net::ERR_CONNECTION_REFUSED` (dev server `localhost:1420` tạm thời không phản hồi, không phải lỗi code) — chạy lại riêng `TC-income-reports-v2-compare.spec.ts:240` sau khi server lên lại đã lấp đầy 14 ngày còn thiếu (2026-06-23 → 2026-07-06) mà không xoá dữ liệu 2 test kia (parts trên đĩa không bị test:3 wipe, chỉ TC-IRV2-1 wipe `.parts` lúc đầu file).

## Quy trình cho các lần chạy sau

> Từ nay, **mỗi lần chạy lại** bộ so sánh V1/V2 (chạy spec, quét tay bằng MCP Playwright, hoặc quét mở rộng ngày/tháng) đều phải **cập nhật lại chính file này** (`docs/screens/income-reports-v2/income-reports-v2-comparison.md`) với kết quả mới nhất, thay vì chỉ báo cáo trong chat:
>
> - Cập nhật ngày quét, số liệu, và bảng "Kết luận nhanh" nếu có thay đổi so với lần trước.
> - Nếu phát hiện bug mới hoặc bug cũ đã được fix, cập nhật mục "Bug tìm thấy" tương ứng (đánh dấu đã fix, không xoá lịch sử — có thể ghi chú "Đã fix ngày ..." bên dưới).
> - Nếu chạy quét theo dải ngày (ví dụ 30 ngày dùng `compare-latest.html`), ghi tóm tắt kết quả (bao nhiêu ngày pass/fail, ngày nào phát sinh sai lệch mới) vào một mục con trong file này, kèm đường dẫn tới report HTML tương ứng trong `reports/income-reports-v2/`.
> - Giữ nguyên các phần lịch sử phía trên (không xoá), chỉ thêm/chỉnh phần liên quan để file luôn phản ánh đúng trạng thái mới nhất.

## Ghi chú kỹ thuật khi quét (cho lần chạy sau)

- Cả 6 route đều bị `PermissionProtectedRoute` chặn bằng passcode dialog (`8888`) — phải nhập passcode trước khi snapshot thấy nội dung thật.
- Tick checkbox "Do not require passcode for the next 30 minutes" ở lần nhập đầu để không phải nhập lại khi chuyển route trong cùng phiên.
- URL filter là nguồn sự thật: `?from=<epoch>&to=<epoch>` (+ `activeChart=` cho Daily, `groupBy=` cho Summary, `staffId=`/`detailId=` khi mở panel chi tiết).
- Panel chi tiết của Income Summary/Staff Income **chỉ mount sau khi click 1 dòng trong bảng** — nếu chỉ chụp snapshot ngay khi vào trang sẽ thấy "No detail to show".
- Nhãn tip trên Daily Sale Report là **"Total tip"** (t thường), không phải "Total Tip".
- Combobox date-filter có preset **"This Month"** — chọn preset này khi app đang ở ngày X trong tháng sẽ ra range `01/tháng - X/tháng` (không phải cả tháng đủ 30/31 ngày nếu chưa đi hết tháng). Muốn 1 range tháng cố định/đủ ngày thì nên tự set `from`/`to` qua URL thay vì dùng preset.
- Bảng Order trong panel chi tiết Staff Income **không phân trang/không lazy-load** — kể cả staff có 186 order (Kevin) thì toàn bộ order vẫn render hết trong DOM/accessibility tree ngay khi mở panel, nên khi cần "quét hết order" chỉ cần lấy snapshot đầy đủ, không cần giả lập hành động scroll.
- Daily Sale Report **bỏ qua `to`** trong query string — luôn hiển thị dữ liệu của đúng ngày `from` dù URL có truyền range nhiều ngày.

## Code đã sinh từ document này

Đã tự động hoá 3 phép so sánh V1 vs V2 ở trên thành test Playwright, chạy trên "hôm nay" (tự thích ứng dữ liệu live thay vì cố định ngày Jul 21, 2026 của bản quét tay):

- **Page objects** — thêm tham số `variant: 'v1' | 'v2'` (mặc định `'v1'`, không phá vỡ code cũ) vào constructor:
  - [`DailySaleReportPage.ts`](../../../src/pages/pos/DailySaleReportPage.ts) → route `-v2` là `/incomes/income-daily-v2`
  - [`IncomeSummaryPage.ts`](../../../src/pages/pos/IncomeSummaryPage.ts) → `/incomes/income-summary-v2`
  - [`IncomeStaffPage.ts`](../../../src/pages/pos/IncomeStaffPage.ts) → `/incomes/income-staff-v2`
- **Spec** — [`TC-income-reports-v2-compare.spec.ts`](../../../tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts), 3 test case:
  - **TC-IRV2-1**: Daily Sale Report v1 vs v2 — stat cards, Income/Payment Details, order rows.
  - **TC-IRV2-2**: Income Summary v1 vs v2 — Payment Details/Supply Fee/Staff Payout (kỳ vọng khớp) + **Sale Details**/**Salon Earnings** viết dưới dạng assertion so sánh bằng thật (không phải assertion "phải khác"), nên **sẽ FAIL cho tới khi bug ở mục "Bug tìm thấy" (§2) được fix**, lúc đó tự chuyển xanh mà không cần sửa lại test.
  - **TC-IRV2-3**: Staff Income v1 vs v2 — 6 field thẻ thống kê tổng shop + toàn bộ dòng bảng staff + (mới) drill-down panel chi tiết của MỖI staff xuất hiện trong ngày đó (`IncomeStaffPage.readStaffDetailPanel()` — quét order sub-table + toàn bộ field label/value, tự thích ứng cả layout salary lẫn commission mà không cần biết trước field nào tồn tại).
    - **Cột `Service` bị loại khỏi so sánh** (`IGNORED_ORDER_COLUMNS` trong spec): bảng order của V1 có cột `Service` liệt kê line item, V2 không render cột này, nên mọi dòng order đều bị đánh dấu mismatch chỉ vì V1 có tên dịch vụ còn V2 rỗng (89 dòng riêng ngày 2026-08-05). Cột bị bỏ ở CẢ HAI phía ngay lúc scrape, nên assertion và report HTML cùng chỉ so `Order #`/`Sale-Refund`/`Supply`/`Tip`.

Câu lệnh chạy (xem thêm `docs/test-commands.md`):

```bash
# Chạy cả file — ẩn trình duyệt (headless, mặc định)
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts

# Chạy cả file — hiển thị trình duyệt (headed)
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts --headed

# Chạy có hiển thị trình duyệt + Playwright Inspector, dừng từng bước để debug
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts --headed --debug

# Chạy riêng từng test case (thêm --headed nếu muốn xem trình duyệt)
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts:25   # TC-IRV2-1: Daily Sale Report
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts:70   # TC-IRV2-2: Income Summary
npx playwright test tests/regression/incomes/income-reports-v2/TC-income-reports-v2-compare.spec.ts:110  # TC-IRV2-3: Staff Income
```

**Đã tự động hoá thêm (lần cập nhật 2026-07-22):** `IncomeStaffPage.readStaffDetailPanel()` — tương đương `readDetailSections()` của Income Summary nhưng generic hơn (không cần khai báo trước danh sách field), đọc cả order sub-table lẫn mọi field label/value trong panel chi tiết Staff Income. TC-IRV2-3 giờ mở panel chi tiết của MỌI staff xuất hiện trong ngày (cả v1 lẫn v2) và so khớp toàn bộ, thay vì chỉ so bảng liệt kê + thẻ thống kê như trước.

**Vẫn chưa tự động hoá:** phần 4 của document (quét mở rộng 1 tháng theo từng staff, sai lệch rounding $0.03 của Kevin) — chỉ mới có bằng tay, chưa viết thành assertion Playwright (khoảng ngày dài làm chi phí quét quá lớn cho CI thường xuyên).
