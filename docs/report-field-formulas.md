# Volt POS — Công thức field cho tất cả Report

Tài liệu **tổng hợp công thức cho từng field** của 3 màn report income:

| Report                | Route                     | UI label cột                         |
| --------------------- | ------------------------- | ------------------------------------ |
| **Daily Sale Report** | `/incomes/income-daily`   | báo cáo 1 ngày                       |
| **Income Summary**    | `/incomes/income-summary` | range, group Day/Week/Month + detail |
| **Staff Income**      | `/incomes/income-staff`   | per-staff listing + detail (dự trù)  |

**Nguồn:**

- API/GraphQL: [`docs/api/daily-sale-report-api.md`](./api/daily-sale-report-api.md), [`docs/api/income-summary-api.md`](./api/income-summary-api.md)
- Test-case + spec đối chiếu UI: [`docs/test-cases/VP-1048-daily-sale-report-test-cases.md`](./test-cases/VP-1048-daily-sale-report-test-cases.md), [`VP-1048-income-summary.md`](./test-cases/VP-1048-income-summary.md), [`VP-1402-staff-income.md`](./test-cases/VP-1402-staff-income.md)
- **Công thức chuẩn (single source of truth)**: [`src/reports/incomeCalcCore.ts`](../src/reports/incomeCalcCore.ts) — port nguyên văn backend `report.rs`. Model field: [`src/api/models/Report.ts`](../src/api/models/Report.ts), [`src/api/models/IncomeSummary.ts`](../src/api/models/IncomeSummary.ts).

---

## 0. Quy ước chung (đọc trước)

| Quy ước             | Chi tiết                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Đơn vị tiền**     | Tất cả amount lưu **integer cents**. Display `$#,##0.00`; `0 → $0.00`.                                                                                             |
| **Dấu âm**          | Sale/Tip/Tax/Subtotal/Net/Payment **được phép âm** (ngày lỗ / refund > sale). Không ép về 0.                                                                       |
| **Làm tròn**        | Backend dùng **round-half-up integer division** `rdiv(n, d) = floor((n + floor(d/2)) / d)` (xem `incomeCalcCore.ts`). Mọi `× %` đều qua `rdiv(x * pct, 100)`.      |
| **Refund**          | Refund **giảm** Sale (giá trị âm). Settled list API trả refund là **magnitude dương** → công thức dùng `− \|Refund\|`; live API trả âm. (VP-1048-income ⚠️#7).     |
| **Cancel**          | Order **Cancel** bị loại khỏi Total Order / Sale / Tip / mọi field.                                                                                                |
| **Gift Card**       | **GC Redemption** vào Total Payment nhưng **KHÔNG vào Sale**. GC **Sale** không cộng vào Gross/Net Income.                                                         |
| **Timezone**        | Ngày bucket theo **merchant timezone** (vd `Asia/Ho_Chi_Minh`), không phải timezone runner.                                                                        |
| **Live vs Settled** | Hôm nay = `storeDailyIncomeLive(reportDate RFC3339)`; ngày quá khứ = `reportStoreDailyIncomeList(date gte/lte, YYYY-MM-DD)`. Ngày unsettled: **tax gộp vào Sale**. |
| **Gating**          | Cả 3 report gated bằng **owner passcode** (`8888`), checkbox "không hỏi lại 30 phút".                                                                              |

---

## 1. DAILY SALE REPORT (`/incomes/income-daily`)

### 1.1 Business Snapshot — 4 cards

| Card              | Công thức                                         | Ghi chú                                              |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **Total Order**   | `COUNT(order hợp lệ)`                             | Loại cancel / refund / manual refund.                |
| **Sale**          | `Σ (sale − refund − partial refund) sau Discount` | **KHÔNG** gồm Tip, Tax, order Cancel, GC redemption. |
| **Total Tip**     | `Σ tip`                                           | Loại tip của order Cancel.                           |
| **Total Payment** | `Amount Collected + Gift Card Redemption`         | = TOTAL PAYMENT ở Payment Detail.                    |
| vs Yesterday      | `(today − yesterday) / yesterday`                 | Tăng = xanh ↑, giảm = đỏ ↓.                          |

### 1.2 Order Detail (mỗi dòng = 1 order)

| Cột           | GraphQL                       | Công thức                                                  |
| ------------- | ----------------------------- | ---------------------------------------------------------- |
| Order #       | `orderCode`                   | mã order                                                   |
| Sale / Refund | `saleAmount` / `refundAmount` | service+product sale/refund **sau Discount**, excl Tip/Tax |
| **Tax**       | `taxAmount`                   | tax tính trên order (cột mới VP-1048)                      |
| Tip           | `tipAmount`                   | tổng tip order                                             |
| Total         | `total`                       | **`Sale + Tip + Tax`** (header "Sale + Tax + Tip")         |

> Bất biến: `total = saleAmount + refundAmount + taxAmount + tipAmount` (đúng 1 trong sale/refund ≠ 0 mỗi dòng).

### 1.3 Income Detail

| UI label          | GraphQL field        | Công thức                        |
| ----------------- | -------------------- | -------------------------------- |
| Sale              | `dailySaleSale`      | Σ Sale/Refund sau Discount       |
| Tip               | `dailySaleTip`       | Σ tip                            |
| Tax Collected     | `incomeTaxAmount`    | Σ tax (đã điều chỉnh refund)     |
| **Total Payment** | `incomeTotalPayment` | **`Sale + Tip + Tax Collected`** |

### 1.4 Payment Detail

| UI label             | GraphQL field                                   | Công thức                                     |
| -------------------- | ----------------------------------------------- | --------------------------------------------- |
| Card                 | `dailySalePaymentCard`                          | `Sale Card − Refund Card`                     |
| Cash                 | `dailySalePaymentCash`                          | `Sale Cash − Refund Cash`                     |
| Others               | `dailySalePaymentOthers`                        | `Sale Others − Refund Others`                 |
| **Amount Collected** | `dailySalePaymentAmountCollected`               | **`Card + Cash + Others`** (excl Gift Card)   |
| Gift Card Redemption | `dailySalePaymentGiftCardRedemption`            | GC redeem trong ngày                          |
| **TOTAL PAYMENT**    | `dailySaleTotalPayment`                         | **`Amount Collected + Gift Card Redemption`** |
| Tax per tender       | `paymentTaxCard/Cash/Others/GiftCardRedemption` | tax theo từng phương thức                     |

> ⚠️ Khác Income Summary: ở **DSR**, Card/Cash/Others = `Sale − Refund` (không cộng Tip/Tax vào từng tender). Ở **Income Summary** thì có (xem §2.3).

**Bất biến reconciliation (DSR):** `Income Detail Total Payment` = `Payment Detail TOTAL PAYMENT` = card **Total Payment** (Business Snapshot).

---

## 2. INCOME SUMMARY (`/incomes/income-summary`)

### 2.1 Panel trái — Total Income & bảng overview

| Field                         | GraphQL                                                | Công thức                                                                         |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Total Income** (Net)        | `Σ incomeTotalSale`                                    | Net Income cả range; **được phép âm**                                             |
| Gross Income (chart)          | `incomeTotalSale` (gross)                              | Sale **trước** refund, **loại** Tip/Tax/GC load                                   |
| Net Income (chart)            | —                                                      | `Gross − Refund` (loại Tip/Cancel/GC sale)                                        |
| % so sánh                     | `calculatePercentageChange(cur, prev)`                 | nhãn theo preset (Day/Custom = "vs Previous period"; Week/Month = "vs Last year") |
| Bảng: Date / Sale / Tip / Tax | `date / incomeTotalSale / incomeTip / incomeTaxAmount` | cột Net Income cũ **đã bỏ**, thay bằng **Tax**                                    |
| Bảng: **Total Payment**       | `incomeSummaryTotalPayment`                            | **`Sale + Tip + Tax`**                                                            |

### 2.2 Sale Details

| UI label               | GraphQL field                                 | Công thức                                     |
| ---------------------- | --------------------------------------------- | --------------------------------------------- |
| Service Sale           | `incomeServiceSale`                           | sale service                                  |
| Product Sale           | `incomeProductSale`                           | sale product                                  |
| Gift Card Sale         | `incomeGiftCardSale`                          | bán GC                                        |
| **Total Sale**         | `incomeTotalSale`                             | **`Service + Product + Gift Card Sale`**      |
| Service/Product Refund | `incomeServiceRefund` / `incomeProductRefund` | refund                                        |
| **Total Refund**       | `incomeTotalRefund`                           | **`Service Refund + Product Refund`**         |
| **Subtotal**           | `incomeSubtotal`                              | **`Total Sale − Total Refund`** (cho phép âm) |
| Discount / Reversed    | `incomeDiscount` / `incomeDiscountReversed`   | discount & phần hoàn lại                      |
| **Total Discount**     | `incomeTotalDiscount`                         | **`Discount − Discount Reversed`**            |
| **Net Total**          | `incomeNetTotal`                              | **`Subtotal − Total Discount`**               |
| Tip                    | `incomeTip`                                   | tổng tip                                      |
| **Tax Collected**      | `incomeTaxAmount`                             | **`Σ tax mọi phương thức`** (cho phép âm)     |
| **TOTAL PAYMENT**      | `saleIncomeTotalPayment`                      | **`Net Total + Tax + Tip`**                   |

### 2.3 Payment Details

Mỗi tender (Cash / Card / Others) có sub-rows Sale / Refund / Tip / Tax:

| UI label             | GraphQL field                                                    | Công thức                                     |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Cash (Total)         | `incomeSummaryPaymentTotalCash` (+`CashSale/CashRefund/CashTip`) | **`Sale − \|Refund\| + Tip + Tax`** (Cash)    |
| Card (Total)         | `incomeSummaryPaymentTotalCard` (+`CardSale/CardRefund/CardTip`) | **`Sale − \|Refund\| + Tip + Tax`** (Card)    |
| Others (Total)       | `incomeSummaryPaymentTotalOthers` (+`Others…`)                   | **`Sale − \|Refund\| + Tip + Tax`** (Others)  |
| **Amount Collected** | `incomeSummaryPaymentAmountCollected`                            | **`Cash + Card + Others`**                    |
| Gift Card Redemption | `incomeSummaryPaymentGiftCardRedemption` (+`GiftCardSale/Tip`)   | `Sale + Tip + Tax` (GC)                       |
| **TOTAL PAYMENT**    | `incomeSummaryTotalPayment` / `incomeTotalPayment`               | **`Amount Collected + Gift Card Redemption`** |
| Tax per tender       | `paymentTaxCash/Card/Others/GiftCardRedemption`                  | tax theo phương thức                          |

### 2.4 Supply Fee

| UI label             | GraphQL field         | Công thức                                                       |
| -------------------- | --------------------- | --------------------------------------------------------------- |
| **Total Supply Fee** | `supplyFeeTotal`      | supply fee **net của refund** (`sale − refund`, không cộng dồn) |
| Staff Supply Share   | `supplyFeeStaffShare` | `Σ rdiv(supplyNet_staff × %service_staff, 100)`                 |
| Salon Supply Share   | `supplyFeeSalonShare` | **`Total Supply Fee − Staff Supply Share`**                     |

### 2.5 Staff Payout

> Công thức chuẩn lấy từ `incomeCalcCore.ts` (`computeIncomeSummary`). Tính **per-staff rồi rollup = Σ**. `%service` = Commission rate phần staff; `p1` = Pay1-Pay2 split.

**Per-staff:**

```
commission   = rdiv((serviceNet − supplyNet) × %service, 100)
supplyShare  = rdiv(supplyNet × %service, 100)
cleanUp      = checkedIn ? deductionPerDay : 0            // theo ngày làm
cardFee      = (compType=commission & %cardCommission>0)
               ? rdiv(rdiv(cardBase × %service,100) × %cardCommission, 100) : 0
effTip       = enablePayrollTip ? 0 : tip                 // setting Exclude Tips
base         = isSalaried ? salaryDay : commission
totalIncome  = base − cleanUp − cardFee + effTip
pay1         = rdiv(base × p1, 100) − cleanUp − (commission-only ? cardFee : 0)
pay2         = totalIncome − pay1                          // ⇒ pay1 + pay2 = totalIncome
```

`salaryDay` (port `report.rs`):

| salarySetting      | Công thức                                                                  |
| ------------------ | -------------------------------------------------------------------------- |
| `wage_per_hour`    | `rdiv(salaryAmount × workedMinutes, 60)`                                   |
| `wage_per_day`     | `!checkedIn ? 0 : (finalized ? rdiv(fin.salary, workDays) : salaryAmount)` |
| `salary_by_period` | `rdiv(finalized ? fin.salary : salaryAmount, periodDays)`                  |

`salaryReport` (số Salary hiển thị): `commission → 0`; `salary → salaryDay`; `commission_salary → finalized ? salaryDay : (salaryDay > commission ? salaryDay : 0)` (kỳ chưa chốt lấy max).

**Store rollup (field hiển thị):**

| UI label               | GraphQL field             | Công thức                                                                                |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Total Service          | `staffPayoutTotalService` | `serviceSale − serviceRefund`                                                            |
| Staff Supply Share     | `staffPayoutSupplyShare`  | `Σ supplyShare`                                                                          |
| Staff Commission       | `staffPayoutCommission`   | `Σ commission`                                                                           |
| Tip                    | `staffPayoutTip`          | `Σ tip`                                                                                  |
| Clean Up Fee           | `staffPayoutCleanUpFee`   | `Σ cleanUp` = `Σ (deduction/ngày × số ngày làm)`                                         |
| Staff Salary           | `staffPayoutSalary`       | `Σ salaryReport`                                                                         |
| **TOTAL STAFF PAYOUT** | `staffPayoutTotal`        | `Σ totalIncome` (spec: `Comm + Tip + Salary − Supply − CleanUp − Discount − CardCharge`) |
| Pay 1 / Pay 2          | `staffPayoutPay1/Pay2`    | `Σ pay1` / `Σ pay2` — **`Pay1 + Pay2 = Total Staff Payout`**                             |

> ⚠️ Divergence đã ghi nhận (VP-1048-income ⚠️#5): bảng store `report_store_daily_income` của **app** tính Commission/Pay/Total bằng `%service` không khớp setting theo ngày → các số này **có thể SAI** (vd 15/06: re-derive $1,349.95 vs app $1,116.89). Field Sale/Payment/Supply/Tip/Tax/CleanUp/TotalService thì khớp. Đối chiếu test [`TC-RD-staff-salon-rederive.spec.ts`](../tests/regression/incomes/income-summary/TC-RD-staff-salon-rederive.spec.ts).

### 2.6 Salon Earnings

| UI label                    | GraphQL field                                          | Công thức                                                                       |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Total Service               | `salonEarningsTotalService`                            | `serviceSale − serviceRefund`                                                   |
| Salon Supply Share          | `salonEarningsSupplyShare`                             | `supplyTotal − staffSupplyShare`                                                |
| **Salon Commission**        | `salonEarningsCommission`                              | `Σ rdiv(serviceNet × (100 − %service),100) − salonSupplyShare`                  |
| Product Sale / Refund       | `salonEarningsProductSale/Refund`                      | sale/refund product                                                             |
| Discount / Reversed / Total | `salonEarningsDiscount/DiscountReversed/TotalDiscount` | discount phía salon                                                             |
| **Net Earnings**            | `salonEarningsNet`                                     | **`Salon Commission + Product Sale − Product Refund − Total Discount`**         |
| Staff Supply Share          | `salonEarningsStaffSupplyShare`                        | cộng lại vào Total                                                              |
| Clean Up Fee                | `salonEarningsCleanUpFee`                              | `Σ cleanUp`                                                                     |
| Staff Salary                | `salonEarningsStaffSalary`                             | `Σ salaryReport` (trừ ra)                                                       |
| **TOTAL EARNINGS**          | `salonEarningsTotal`                                   | **`Net Earnings + Staff Supply Share + Clean Up − Staff Salary + Card Charge`** |

### 2.7 Bất biến reconciliation (Income Summary)

- `Total Payment` (bảng) = Payment Details TOTAL = Sale Details TOTAL PAYMENT.
- `Net Total` = `Sale` (bảng) = `Total Income` (panel trái).
- `Tax` (bảng) = `Tax Collected` (Sale Details) = `Σ Tax per tender` (Payment Details) = Tax Collected (Salon).
- Staff Supply Share + Salon Supply Share = Total Supply Fee.
- DSR ↔ Income Summary cùng ngày: Sale/Tax/Refund/Total Payment khớp.

---

## 3. STAFF INCOME (`/incomes/income-staff`) — report **dự trù**

> Số dự trù staff sẽ nhận; số **chốt** ở Staff Payroll. `Pay1 + Pay2 = Total Income` cho cả Commission & Salary.

### 3.1 Staff Listing (6 cột)

| Cột              | Công thức                          |
| ---------------- | ---------------------------------- |
| Name             | nickname / full name               |
| Orders           | số order của staff trong kỳ        |
| **Subtotal**     | **`Sale − Refund`** (cho phép âm)  |
| Supply Fee       | supply fee net (đã trừ refund)     |
| Tip              | tổng tip                           |
| **Total Income** | = Total Income trong Detail (khớp) |

### 3.2 Detail — Commission

| Field                            | Công thức                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Subtotal                         | `Sale − Refund`                                                                                      |
| Supply Fee (incl. Sale & Refund) | net sau refund (refund trừ bớt, không cộng dồn)                                                      |
| **Staff Commission**             | **`(Subtotal − Supply Fee) × Commission Rate`**                                                      |
| Commission Rate (ngày)           | rate theo **ngày hiệu lực**, theo từng staff                                                         |
| Card Charge − Commission         | phí thẻ trên Commission (setting On Staff Commission); **trừ** Total & Pay1                          |
| Card Charge − Tip                | phí thẻ trên Tip (setting On Credit Card Tip); **trừ** Total & Pay1                                  |
| Discount Charge                  | phần promotion staff gánh chung với chủ tiệm; **trừ** Total & Pay1                                   |
| **Clean Up Fee/Deduction**       | **`Deduction/ngày × số ngày xem report`**                                                            |
| Tip                              | tổng tip                                                                                             |
| **Total Income**                 | **`Commission − Clean Up + Tip`** `(− Card Charge Comm − Card Charge Tip − Discount Charge khi ≠ 0)` |
| **Pay 1**                        | **`Commission × p1% − Clean Up`** `(− phí)`                                                          |
| **Pay 2**                        | **`Commission × p2% + Tip`**                                                                         |

### 3.3 Detail — Salary (Wage Per Day / Hour / Salary by Period)

| Field                | Công thức                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Salary Type          | `Wage Per Day` / `Wage Per Hour` / `Salary by Period`                                                     |
| Rate                 | by Period: **`lương kỳ / số ngày trong kỳ`**; Per Day/Hour: rate setting                                  |
| Working Days / Hours | từ check-in (ngày) / Clock In–Out (giờ)                                                                   |
| **Gross Income**     | Per Day: **`Rate × Working Days`**; Per Hour: **`Rate × Working Hours`**; by Period: `Rate × số ngày xem` |
| Clean Up Fee         | `Deduction/ngày × số ngày`                                                                                |
| Tip                  | tổng tip                                                                                                  |
| **Total Income**     | **`Gross Income − Clean Up Fee + Tip`**                                                                   |
| **Pay 1**            | **`Gross × p1% − Clean Up`**                                                                              |
| **Pay 2**            | **`Gross × p2% + Tip`**                                                                                   |

### 3.4 Commission + Salary

Hiển thị cả 2 block. Total Income chốt theo **Staff Days Off Setting** (Commission hay Salary); kỳ chưa chốt thường lấy `max(Commission, Salary)` (= `salaryReport` logic §2.5).

### 3.5 Setting ảnh hưởng

| Setting                             | Tác động                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| Commission Rate / Pay1-Pay2 Split   | theo **từng staff theo ngày** (không hardcode 30/70)            |
| Exclude Tips From Cash/Check Income | `enablePayrollTip = true` → `effTip = 0` (tip không cộng Total) |
| Staff Days Off Setting              | quyết định Commission vs Salary cho staff Commission+Salary     |
| Deduction Per Day                   | nhân số ngày → Clean Up Fee                                     |

### 3.6 Cross-report

- **Staff Income ↔ Income Summary (Staff Payout)** cùng kỳ: Commission/Tip/Clean Up/Pay1/Pay2 tương ứng khớp.
- **Staff Income (estimate) ↔ Staff Payroll (chốt)**: cùng setting → công thức khớp; Payroll là số chốt cuối.

---

## 4. Tổng hợp bất biến chéo (dùng cho assert tự động)

| Bất biến                                                           | Phạm vi                       |
| ------------------------------------------------------------------ | ----------------------------- |
| `Order Total = Sale + Tip + Tax`                                   | DSR Order Detail              |
| `Income Total Payment = Sale + Tip + Tax`                          | DSR Income Detail             |
| `Payment Total = Amount Collected + GC Redemption`                 | DSR & Income Summary          |
| `Amount Collected = Card + Cash + Others`                          | DSR & Income Summary          |
| `Subtotal = Total Sale − Total Refund`                             | Income Summary                |
| `Net Total = Subtotal − Total Discount`                            | Income Summary                |
| `Total Payment = Net Total + Tax + Tip`                            | Income Summary Sale Details   |
| `Staff Supply + Salon Supply = Total Supply Fee`                   | Income Summary                |
| `Pay 1 + Pay 2 = Total (Staff Payout / Staff Income)`              | Income Summary & Staff Income |
| `Subtotal = Sale − Refund`                                         | Staff Income listing          |
| `Tax (table) = Tax Collected = Σ Tax per tender`                   | Income Summary                |
| DSR ↔ Income Summary cùng ngày: Sale/Tax/Refund/Total Payment khớp | Cross-report                  |

---

> 🐞 **Cảnh báo bug/divergence đã biết** (xem chi tiết trong các doc test-case): Income Summary Staff Commission/Pay/Total có thể lệch do `%service` đóng băng sai (VP-1048-income ⚠️#5); Staff Income hiển thị Commission Rate ≠ rate dùng tính (VP-1402 🐞#1); Salary Total Income ≠ các thành phần hiển thị (VP-1402 🐞#2); xử lý số âm không nhất quán (🐞#3). Khi assert formula-exact, ưu tiên **ngày settled quá khứ** và đối chiếu re-derive.
