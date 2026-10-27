# Test Data Setup — VP-1048 · Daily Sale Report & Income Summary

> **Issue:** [VP-1048](https://linear.app/fastboy/issue/VP-1048/spec-update-daily-sale-report-and-income-summary-report-add-tax-column) · Team VOLT · Priority **Urgent**
> **Phạm vi file này:** bộ dữ liệu tối thiểu để phủ toàn bộ test case trong [VP-1048-income-summary.md](VP-1048-income-summary.md) và [VP-1048-daily-sale-report.md](VP-1048-daily-sale-report.md).
> Nguyên tắc: dùng **số tròn** để QC cộng tay được; mỗi order ghi rõ payment / tip / tax / discount / refund.
> Tax rate giả định = **10%** (Tax = 10% × (giá − discount)).

---

## A. Config chuẩn bị TRƯỚC (làm 1 lần)

| Mục                                 | Thiết lập                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Tax**                             | Bật tax rate 10%                                                                                                                |
| **Service A**                       | Giá $100, **Supply Fee $10**                                                                                                    |
| **Service B**                       | Giá $200, Supply Fee $0                                                                                                         |
| **Product P1**                      | Giá $50                                                                                                                         |
| **Gift Card**                       | Cho phép bán (add fund) và redeem                                                                                               |
| **Staff ST1 — Commission**          | Commission For Service = **60%** (Owner 40%); Pay1/Pay2 split = **50/50**; Deduction Per Day (Clean up) = **$20**; không Salary |
| **Staff ST2 — Salary by Period**    | Pay Period 1 week = **$7000** (rate $1000/ngày)                                                                                 |
| **Staff ST3 — Wage Per Hour**       | $50/giờ                                                                                                                         |
| **Staff ST4 — Wage Per Day**        | $200/ngày                                                                                                                       |
| **Staff ST5 — Commission + Salary** | Commission 50% + Salary (để test kỳ chốt/chưa chốt — lấy số lớn hơn)                                                            |

---

## B. NGÀY VÀNG (D1) — phủ phần lớn công thức trong 1 ngày

**Đề xuất ngày: 02/06/2026** (nằm trong tuần hiện tại để test cả tuần cắt). Tất cả service gán **ST1** trừ khi ghi khác.

| Order | Loại               | Item                                    | Giá  | Discount    | Tip | Tax | Payment                | Ghi chú                                                    |
| ----- | ------------------ | --------------------------------------- | ---- | ----------- | --- | --- | ---------------------- | ---------------------------------------------------------- |
| O1    | Sale               | Service A (supply $10)                  | 100  | 0           | 20  | 10  | **Cash**               | service sale + supply + commission                         |
| O2    | Sale               | Service B                               | 200  | 50          | 30  | 15  | **Card**               | có **Discount**                                            |
| O3    | Sale               | Product P1                              | 50   | 0           | 0   | 5   | **Others**             | product sale                                               |
| O4    | Sale               | **Gift Card add fund**                  | 100  | 0           | 0   | 0   | **Cash**               | Gift Card Sale (loại khỏi Gross/Net)                       |
| O5    | Sale               | Service A (supply $10)                  | 100  | 0           | 10  | 10  | **Gift Card (redeem)** | Gift Card Redemption                                       |
| O6    | **Refund** (full)  | Service A (đơn cũ từng có Discount $30) | −100 | reversed 30 | 0   | −10 | Cash                   | Service Refund + **Discount Reversed**                     |
| O7    | **Partial Refund** | Product P1                              | −20  | 0           | 0   | −2  | Card                   | Product Refund                                             |
| O8    | **Cancel**         | Service B                               | 80   | 0           | 10  | 8   | Cash                   | **đơn Cancel** → phải bị loại khỏi mọi tổng & Orders count |

### Kết quả mong đợi D1 — Sale Details (đối chiếu tay được)

| Field             | Phép tính                      | **Kết quả** |
| ----------------- | ------------------------------ | ----------- |
| Service Sale      | 100 + 200 + 100                | **400**     |
| Product Sale      | 50                             | **50**      |
| Gift Card Sale    | 100                            | **100**     |
| **Total Sale**    | 400 + 50 + 100                 | **550**     |
| Service Refund    | 100                            | **100**     |
| Product Refund    | 20                             | **20**      |
| **Total Refund**  | 100 + 20                       | **120**     |
| Subtotal          | 550 − 120                      | **430**     |
| Discount          | 50                             | **50**      |
| Discount Reversed | 30                             | **30**      |
| Total Discount    | 50 − 30                        | **20**      |
| **Net Total**     | 430 − 20                       | **410**     |
| Tip               | 20 + 30 + 0 + 10 (loại cancel) | **60**      |
| Tax Collected     | (10+15+5+10) − (10+2)          | **28**      |
| **TOTAL PAYMENT** | 410 + 28 + 60                  | **498**     |

### Supply Fee / Staff Payout (ST1) / Salon Earnings — D1

| Khối                       | Phép tính                   | **Kết quả** |
| -------------------------- | --------------------------- | ----------- |
| Total Supply Fee           | 10 (O1) + 10 (O5) − 10 (O6) | **10**      |
| Staff Supply Share (60%)   | 10 × 0.6                    | **6**       |
| Salon Supply Share         | 10 − 6                      | **4**       |
| Total Service (ST1)        | (100+200+100) − 100         | **300**     |
| **Staff Commission (60%)** | 300×60% − 6                 | **174**     |
| Tip                        |                             | **60**      |
| Clean up fee               | $20/ngày × 1                | **20**      |
| Staff Salary (ST1)         | commission-only             | **0**       |
| **Total Staff Payout**     | 174 + 60 − 20 + 0           | **214**     |
| Pay 1                      | 174×50% − 20                | **67**      |
| Pay 2                      | 174×50% + 60                | **147**     |
| Pay1 + Pay2                | 67 + 147                    | **214** ✓   |
| Salon Commission (40%)     | 300×40% − 4                 | **116**     |
| Net Earnings               | 116 + 50 − 20 − 20          | **126**     |
| **Total Earning**          | 126 + 6 + 20 − 0            | **152**     |

### Đối chiếu chính (bắt buộc khớp)

- **TOTAL PAYMENT = $498** ở cả 3 nơi: Sale Details · Payment Details · bảng Total Income (TC-INC-108, TC-DSR-027).
- **Amount Collected + Gift Card Redemption = Total Payment.** Gift Card Redemption (O5) = 100 + 10 + 10 = **120** → Amount Collected mong đợi = 498 − 120 = **378**.
- **Net Total = Sale (bảng) = Total Income = −/+** giống nhau (TC-INC-109).
- ⚠️ _Phân bổ Sale theo từng phương thức (Cash/Card/Others) phụ thuộc cách xử lý Discount/Discount Reversed trong Payment Details — xem mục E.1, QC verify số app rồi đối chiếu._

---

## C. ORDER cho biến thể STAFF (Staff Payout / Salary) — thêm vào D1 hoặc ngày kế

| Order | Staff                                 | Item                                                  | Payment | Mục đích test                                                                                   |
| ----- | ------------------------------------- | ----------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| O9    | **ST2** (Salary by Period $7000/tuần) | Service A $100                                        | Cash    | TC-INC-086: xem report 3 ngày → Staff Salary = 1000×3 = **3000**                                |
| O10   | **ST3** (Wage/Hour $50)               | Service A $100                                        | Card    | TC-INC-087: Salary = 50 × số giờ làm                                                            |
| O11   | **ST4** (Wage/Day $200)               | Service A $100                                        | Cash    | TC-INC-088: Salary = 200 × số ngày                                                              |
| O12   | **ST5** (Commission 50% + Salary)     | Service B $200                                        | Card    | TC-INC-096/097: kỳ **chưa chốt** → lấy max(Commission, Salary); kỳ **đã chốt** → lấy số đã chốt |
| O13   | ST?                                   | bất kỳ, set **Custom Pay Period 4 mốc** (25,26,27,30) | —       | TC-INC-098: Pay1/Pay2 tách 4 kỳ                                                                 |

---

## D. NGÀY EDGE / BIÊN (mỗi ngày 1 mục đích)

| Ngày                                  | Order cần tạo                            | Phủ test case                                                       |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| **D2 — ngày lỗ**                      | 1 sale nhỏ ($50) + 1 refund lớn ($300)   | TC-EDGE-111, TC-INC-100 (Total Income âm), TC-DSR-035 (trend đỏ ↓)  |
| **D3 — chỉ refund**                   | Chỉ 1 đơn refund $63.80 (refund tax)     | TC-EDGE-111, Sale/Total Payment âm                                  |
| **D4 — chỉ Gift Card**                | Chỉ 1 đơn bán Gift Card $100             | TC-EDGE-112: Gross=0, Net=0, Total Sale vẫn có GC                   |
| **D5 — Tax = 0**                      | 1 sale Service $100, **không tax**, Cash | TC-EDGE-113: Tax cột/field = 0.00, Total vẫn đúng                   |
| **D6 — không có order**               | KHÔNG tạo gì                             | TC-EDGE-110: empty state, mọi card = 0                              |
| **D7 — đa phương thức + nhiều order** | 5–10 order sale Cash/Card/Others         | TC-DSR-001/006 (Orders count, chart refund), TC-DSR-034 (real-time) |

---

## E. SPREAD cho filter Day / Week / Month / Year

| Mục tiêu filter               | Cần data ở                                                     | Test case                                                                                             |
| ----------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Day**                       | ≥2 ngày liên tiếp (D1 + D5)                                    | TC-INC-044                                                                                            |
| **Week (tuần đủ)**            | ≥2 ngày trong cùng 1 tuần đã qua (vd 25–31/05)                 | TC-INC-045, TC-INC-113 (Week = tổng các ngày)                                                         |
| **Week (tuần hiện tại, cắt)** | data trong tuần này (01–03/06)                                 | TC-INC-104 (current week truncated)                                                                   |
| **Month**                     | data ở ≥2 tháng khác nhau (vd 1 ngày tháng 5 + 1 ngày tháng 6) | TC-INC-047                                                                                            |
| **Year hiện tại 2026**        | tổng hợp năm                                                   | TC-INC-099 (dropdown năm)                                                                             |
| **"vs. Last year"**           | ⚠️ **tạo ≥1 order trong 2025** (vd 02/06/2025)                 | TC-INC-101/102: để % so sánh có ý nghĩa (nếu 2025 trống → xác nhận hiển thị 100%/N/A là đúng hay sai) |
| **Year quá khứ (2025)**       | data rải vài tuần/tháng 2025                                   | TC-INC-046/048 (đủ tất cả week/12 tháng)                                                              |

> 💡 Có thể tái dùng: đặt **D1 = 02/06/2026** và **D-tuần-đủ = 26/05/2026** thì 1 bộ order phủ luôn Day + Week (đủ & cắt) + Month (tháng 5 vs 6).

---

## F. Map độ phủ (tóm tắt)

| Khối test                                                          | Order/Ngày phủ       |
| ------------------------------------------------------------------ | -------------------- |
| Payment Details (Cash/Card/Others/GC redeem, tip, tax, âm)         | O1–O7 (D1) + D2      |
| Sale Details (service/product/GC sale, refund, discount, reversed) | O1–O7 (D1)           |
| Supply Fee / Staff Payout / Salon Earnings                         | O1–O6 (ST1) + O9–O13 |
| Salary các loại + kỳ chốt/chưa chốt + custom period                | O9–O13               |
| Orders count / Cancel / Tip-Tax exclude cancel                     | O8 (cancel) + D7     |
| Total Income âm / trend / giá trị âm                               | D2, D3               |
| Edge (empty/refund-only/GC-only/tax-0)                             | D3–D6                |
| Filter Day/Week/Month/Year + vs Last year                          | mục E                |
| Cross-report (Daily Sale ↔ Income Summary ↔ Print)                 | mọi ngày có data     |

---

## G. TỔNG KẾT SỐ LƯỢNG

- **Ngày vàng D1:** 8 order (O1–O8) — phủ Payment/Sale/Supply/Staff/Salon + cancel.
- **Biến thể staff:** +5 order (O9–O13).
- **Ngày edge D2–D5:** ~6 order.
- **Ngày D7 (đa order):** ~5–10 order.
- **Spread 2025 (vs last year):** ~3–5 order.
- **D6:** 0 order (ngày trống).

➡️ **Tổng khoảng 27–35 order, rải trên ~8–10 ngày** (gồm vài ngày trong tuần hiện tại, vài ngày tuần trước, 1 ngày tháng khác, và vài đơn năm 2025).

---

## ⚠️ Điểm cần BA/Dev xác nhận trước khi chốt dữ liệu

1. **Discount trong Payment Details:** "Total Sale Card" là **gross** (trước discount) hay **net** (sau discount)? Ảnh hưởng phân bổ Cash/Card/Others (mục B reconcile Amount Collected).
2. **Discount Reversed khi refund:** Khi refund đơn từng có discount, số tiền refund cho khách = subtotal hay subtotal − discount? (chi phối O6).
3. **"Kỳ lương đã chốt":** thao tác nào để chốt kỳ (cho O12 test max → số chốt)?
4. **vs Last year:** so cùng kỳ 2025 hay cả năm 2025? Nếu 2025 trống → hiển thị 100% hay N/A?
5. **Tax âm:** refund tax tạo Tax Collected âm (D1 = +28; nếu refund nhiều hơn → âm) — xác nhận cho phép.
