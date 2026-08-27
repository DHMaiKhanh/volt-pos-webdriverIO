---
title: Luồng code-gen — Income Summary (/incomes/income-summary)
generated-at: 2026-07-06
skill: codegen-flow-map (3/4)
---

# Luồng code-gen — Income Summary (`/incomes/income-summary`)

> Đầu ra **Skill 3/4** (`codegen-flow-map`): bản đồ **file → file**. Đường dẫn đã verify (2026-07-06).

## Sơ đồ (file → file)

```
Linear doc "Income Report" (income-report-cd80210c48f3)
  └─(offline fallback)→ docs/linear/income-report.md   (mục Income Summary)
     └─(Skill 1: linear-feature-spec + quét Playwright MCP)
        → docs/features/income-summary.md
           └─(Skill 2: linear-testcase-gen + quét Playwright MCP)
              → docs/testcases/income-summary-testcases.md   (~70 TC — tài liệu-hoá code có sẵn)
                 ├─→ src/pages/pos/IncomeSummaryPage.ts   (page object, extends BasePage)
                 │      imports:
                 │       ├─ @pages/BasePage       → src/pages/BasePage.ts
                 │       ├─ @data/static/shops    → src/data/static/shops.ts
                 │       └─ @utils/dateUtils      → src/utils/dateUtils.ts
                 ├─→ tests/regression/incomes/income-summary/            (15 spec + incomeSummary.helpers.ts)
                 ├─→ tests/regression/incomes/income-summary-past/       (TC-PAST-pipeline)
                 ├─→ tests/regression/incomes/income-summary-reconciliation/  (4 spec TC-RECON-*)
                 └─→ tests/regression/incomes/income-summary-ui/         (TC-IS-UI)
                        │  reports engine + helpers:
                        │   ├─ @utils/incomeSummaryDetail            → src/utils/incomeSummaryDetail.ts
                        │   ├─ @utils/incomeSummaryFromCompensation  → src/utils/incomeSummaryFromCompensation.ts
                        │   ├─ @utils/incomeSummaryHtml              → src/utils/incomeSummaryHtml.ts
                        │   ├─ @utils/incomeSummaryUi                → src/utils/incomeSummaryUi.ts
                        │   ├─ @utils/staffPayout                    → src/utils/staffPayout.ts
                        │   ├─ @utils/payPeriod                      → src/utils/payPeriod.ts
                        │   ├─ @utils/sectionsFromScrape             → src/utils/sectionsFromScrape.ts
                        │   ├─ @utils/incomeFromOrders               → src/utils/incomeFromOrders.ts
                        │   ├─ @utils/comparePage · @utils/reportPages · @utils/moneyUtils · @utils/dateUtils
                        │   └─ src/reports/incomeCalcCore.ts          (công thức lõi)
                        └─(khi `npx playwright test`)→ reports/html · reports/json · reports/junit · reports/allure-results · reports/income-summary/
```

## Bảng mắt xích

| #   | File nguồn                 | →   | File đích                                                                                    | Khâu tạo       | Ghi chú                                 |
| --- | -------------------------- | --- | -------------------------------------------------------------------------------------------- | -------------- | --------------------------------------- |
| 1   | Linear "Income Report"     | →   | [docs/linear/income-report.md](../linear/income-report.md)                                   | offline mirror | mục Income Summary                      |
| 2   | linear/income-report.md    | →   | [docs/features/income-summary.md](../income-summary/income-summary-test-cases.md)            | Skill 1        | Quét cả panel chi tiết (5 khối)         |
| 3   | features/income-summary.md | →   | [docs/testcases/income-summary-testcases.md](../income-summary/income-summary-test-cases.md) | Skill 2        | ~70 TC theo nhóm section                |
| 4   | testcases.md               | →   | [src/pages/pos/IncomeSummaryPage.ts](../../src/pages/pos/IncomeSummaryPage.ts)               | có sẵn         | Scrape detail sections + reconciliation |
| 5   | testcases.md               | →   | tests/regression/incomes/income-summary{,-past,-reconciliation,-ui}/                         | có sẵn         | 4 folder spec                           |
| 6   | spec + helpers             | →   | src/reports/incomeCalcCore.ts, src/utils/incomeSummary\*.ts                                  | có sẵn         | Engine tính lại & so khớp               |
| 7   | spec                       | →   | reports/\* + reports/income-summary/                                                         | runtime        | Reporters + report riêng                |

## Ghi chú

- Đây là màn có chuỗi util **dày nhất** trong nhóm Income (reconciliation nhiều nguồn: UI ↔ orders ↔ compensation ↔ DB).
- Report gộp-1-test là đầu ra **Skill 6** → `reports/income-summary/`.

---

---

title: Chi tiết luồng code-gen — Income Summary (/incomes/income-summary)
expands: docs/codegen-flow/income-summary-flow.md
generated-at: 2026-07-06
skill: codegen-flow-detail (4/4)
---

# Chi tiết luồng code-gen — Income Summary (`/incomes/income-summary`)

> Đầu ra **Skill 4/4**: mở rộng [income-summary-flow.md](../income-summary/income-summary-code-detail.md). Đoạn trích
> copy đúng từ file thật (verify 2026-07-06).

## Tổng quan công nghệ

| Công nghệ                  | Vai trò trong luồng gen                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Playwright MCP**         | Quét 2 panel: `browser_click` dòng bảng → `detailId` vào URL → `browser_snapshot` bung 5 khối chi tiết               |
| **Playwright Test**        | Runner + locator engine; nhiều spec dùng `page.evaluate` để scrape DOM                                               |
| **Page Object Model**      | `IncomeSummaryPage extends BasePage` — có scraper `readDetailSections()` chạy trong browser                          |
| **Reconciliation engine**  | `src/reports/incomeCalcCore.ts` + `src/utils/incomeSummary*.ts` — tính lại & so khớp UI ↔ orders ↔ compensation ↔ DB |
| **TZ-aware epoch**         | `zonedDayStartUnix/EndUnix` + `shopTimezone`                                                                         |
| **Tag / fixtures / alias** | như các màn Income khác                                                                                              |

## Chi tiết theo file

### 1. `src/pages/pos/IncomeSummaryPage.ts`

```ts
// L42-L61 — locator cốt lõi
export class IncomeSummaryPage extends BasePage {
  protected readonly path = '/incomes/income-summary';
  this.heading = page.getByText('Income Summary', { exact: true });
  this.periodDropdown = page.getByRole('combobox').first();
  this.groupByTabs = page.getByRole('tablist');
  this.totalIncomeHeading = page.getByRole('heading', { name: /^Total Income/ });
  this.table = page.getByRole('table');
```

```ts
// L80-L87 — điều hướng range + groupBy qua URL
async gotoRange(from: Date, to: Date, groupBy: GroupBy = 'Day'): Promise<void> {
  const f = zonedDayStartUnix(from, SHOP_TZ);
  const t = zonedDayEndUnix(to, SHOP_TZ);
  await this.page.goto(`${this.path}?from=${f}&to=${t}&groupBy=${groupBy.toLowerCase()}`, {
    waitUntil: 'domcontentloaded' });
}
```

```ts
// L188-L192 — click 1 dòng → chờ detailId + panel
async openPeriodDetail(index = 0): Promise<void> {
  await this.tableRows().nth(index).click();
  await expect(this.page).toHaveURL(/detailId=/);
  await expect(this.sectionHeading('Payment Details')).toBeVisible();
}
```

- **Giải thích:** panel chi tiết chỉ mount sau khi chọn dòng (URL thêm `detailId`). Đây là lý do Skill 1
  phải `browser_click` dòng bảng khi quét mới thấy 5 khối.

```ts
// L249-L297 — scraper chạy trong trang (page.evaluate)
const flat = await this.page.evaluate(() => {
  const SECTIONS = ['Payment Details', 'Sale Details', 'Supply Fee', 'Staff Payout', 'Salon Earnings'];
  document.querySelectorAll('button,[role="button"],span,div').forEach((el) => {
    if ((el.textContent || '').trim() === 'Show more') (el as HTMLElement).click();
  });
  // ... duyệt div.justify-between, lấy label + money value, cờ bold (fontWeight>=600)
});
```

- **Công nghệ:** **`page.evaluate`** — chạy JS trong context trình duyệt để scrape toàn panel thành
  `{section, rows[]}`; tự click "Show more" để bung Staff Payout. Dùng cho reconciliation nhiều nguồn.

### 2. Engine tính lại — `src/reports/incomeCalcCore.ts` + `src/utils/incomeSummary*.ts`

- **Vai trò:** các spec `TC-RECON-*`, `staff-payout`, `salon-earnings` **không** chỉ đọc UI mà còn
  **tính lại** từ orders/compensation rồi so khớp (chống app tính sai lặng lẽ).
- **Công nghệ:** TypeScript thuần (không chạm DOM) — `incomeFromOrders`, `staffPayout`, `payPeriod`,
  `incomeSummaryFromCompensation`, `sectionsFromScrape` (parse output của scraper trên).

### 3. Spec + helpers

```ts
// tests/regression/incomes/income-summary/*.spec.ts
test.describe(`Income Summary — Payment Details (real data) ${Tag.REGRESSION}`, () => { ... });
```

- **Công nghệ:** `incomeSummary.helpers.ts` gói bước mở màn + chọn range + đọc panel dùng chung nhiều spec.

## So với bản map (Skill 3)

- Chi tiết thêm: kỹ thuật **`page.evaluate` scraper** cho panel 5 khối, và tầng **reconciliation** tính lại
  bằng util thuần — thứ mà bản map chỉ liệt kê tên file.

---

## API Reference (GraphQL) — fold-in from docs/api/income-summary-api.md

# Income Summary — API Reference

Screen: **`/incomes/income-summary`** · Source: `volt-pos/src/routes/_app/incomes/income-summary/`

Range-based report grouped by Day/Week/Month, with a per-period **detail panel**.
Two GraphQL definition files:

- Overview (table + chart + total): [`-shared/income-summary.gql.ts`] via [`-shared/use-income-summary.ts`]
- Detail panel (right side): [`-income-summary-detail/income-summary-detail.gql.ts`] via [`-income-summary-detail/use-income-summary-detail.ts`]

---

## Operations overview

| Operation                    | Type  | Scope        | Used when                | Key arg                    |
| ---------------------------- | ----- | ------------ | ------------------------ | -------------------------- |
| `getIncomeSummary`           | query | Overview     | past days in range       | `from`/`to` (`YYYY-MM-DD`) |
| `getIncomeSummaryLive`       | query | Overview     | range includes today     | `reportDate` (RFC3339)     |
| `getIncomeSummaryDetail`     | query | Detail panel | selected period is past  | `from`/`to` (`YYYY-MM-DD`) |
| `getIncomeSummaryDetailLive` | query | Detail panel | selected period is today | `reportDate` (RFC3339)     |

All four select from `reportStoreDailyIncomeList` (settled) or
`storeDailyIncomeLive` (today). The overview also fetches the **previous
period** via `getIncomeSummary` for the comparison %, and **merges** the live
today-row into the settled rows when the range ends today.

---

## 1. Overview — `getIncomeSummary` / `getIncomeSummaryLive`

```graphql
query getIncomeSummary($from: String, $to: String) {
  reportStoreDailyIncomeList(where: { date: { gte: $from, lte: $to } }, orderBy: [{ date: desc }]) {
    ...storeIncomeSummaryOverview
  }
}

query getIncomeSummaryLive($reportDate: String!) {
  storeDailyIncomeLive(reportDate: $reportDate) {
    ...storeIncomeSummaryOverviewLive
  }
}
```

`fragment storeIncomeSummaryOverview(Live)` — drives the table & chart:

| Field                                   | UI                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `date`                                  | Period date                                                                   |
| `dailySaleSale`                         | (raw sale)                                                                    |
| `incomeTotalSale`                       | Total Sale; **summed → Total Income** (`INCOME_SUMMARY_DATA_KEYS.TOTAL_SALE`) |
| `incomeDiscount`, `incomeTotalDiscount` | Discounts                                                                     |
| `incomeSubtotal`                        | Subtotal                                                                      |
| `incomeNet`, `incomeNetTotal`           | Net / Net Total                                                               |
| `incomeSummaryTotalPayment`             | Table **Total Payment** column                                                |
| `incomeTip`                             | Table **Tip** column                                                          |
| `incomeTaxAmount`                       | Table **Tax** column                                                          |
| `incomeSummaryPaymentAmountCollected`   | Amount Collected                                                              |

Table columns: `Date | Sale | Tip | Tax | Total Payment` (the old **Net Income**
column was replaced by **Tax** — VP-1048 AC5).

---

## 2. Detail panel — `getIncomeSummaryDetail` / `getIncomeSummaryDetailLive`

```graphql
query getIncomeSummaryDetail($from: String, $to: String) {
  reportStoreDailyIncomeList(where: { date: { gte: $from, lte: $to } }, orderBy: [{ date: desc }]) {
    ...storeIncomeSummary
  }
}

query getIncomeSummaryDetailLive($reportDate: String!) {
  storeDailyIncomeLive(reportDate: $reportDate) {
    ...storeIncomeSummaryLive
  }
}
```

Fires when a table row is clicked (URL gains `detailId=<from>-<to>`). The
`fragment storeIncomeSummary(Live)` returns **5 grouped blocks**:

### Payment Details

`incomeSummaryTotalPayment`, `incomeSummaryPaymentAmountCollected`,
`incomeSummaryPaymentTotalCash` (+ `CashSale`/`CashRefund`/`CashTip`),
`incomeSummaryPaymentTotalCard` (+ `CardSale`/`CardRefund`/`CardTip`),
`incomeSummaryPaymentTotalOthers` (+ `OthersSale`/`OthersRefund`/`OthersTip`),
`incomeSummaryPaymentGiftCardSale`, `incomeSummaryPaymentGiftCardRedemption`,
`incomeSummaryPaymentGiftCardTip`, `incomeTotalPayment`,
`paymentTaxCash`/`paymentTaxCard`/`paymentTaxOthers`/`paymentTaxGiftCardRedemption`.

### Sale Details

`incomeServiceSale`, `incomeProductSale`, `incomeGiftCardSale`,
`incomeTotalSale`, `incomeServiceRefund`, `incomeProductRefund`,
`incomeTotalRefund`, `incomeSubtotal`, `incomeDiscount`,
`incomeDiscountReversed`, `incomeTotalDiscount`, `incomeNetTotal`, `incomeTip`,
`incomeNet`, `incomeTaxAmount`, `saleIncomeTotalPayment`.

### Supply Fee

`supplyFeeTotal`, `supplyFeeStaffShare`, `supplyFeeSalonShare`.

### Staff Payout

`staffPayoutTotalService`, `staffPayoutSupplyShare`, `staffPayoutCommission`,
`staffPayoutTip`, `staffPayoutCleanUpFee`, `staffPayoutSalary`,
`staffPayoutTotal`, `staffPayoutPay1`, `staffPayoutPay2`.

### Salon Earnings

`salonEarningsTotalService`, `salonEarningsSupplyShare`,
`salonEarningsCommission`, `salonEarningsProductSale`,
`salonEarningsProductRefund`, `salonEarningsDiscount`,
`salonEarningsDiscountReversed`, `salonEarningsTotalDiscount`,
`salonEarningsNet`, `salonEarningsStaffSupplyShare`,
`salonEarningsCleanUpFee`, `salonEarningsStaffSalary`, `salonEarningsTotal`.

---

## 3. Filter / grouping behavior (`use-income-summary.ts`)

- **Group By** (`?groupBy=`): `day` | `week` | `month` (`GROUP_BY_OPTIONS`).
  Switching to Day → range = **Last 30 Days**; Week/Month → range = the
  **selected year** (`startOfYear`→`endOfYear`).
- **Row click** → `detailId = <fromUnix>-<toUnix>` (`getSummaryDetailId`).
- Aggregation across the range is client-side (`aggregateByGrouping`).

### Comparison label (`PRESET_COMPARISON_LABELS`)

The "vs." label depends on the matched preset, **not** simply Day/Week/Month:

| Preset            | Label                |
| ----------------- | -------------------- |
| Today / Yesterday | `Same day last week` |
| This Week         | `Last week`          |
| Last Week         | `Week before last`   |
| This Month        | `Last month`         |
| Last Month        | `Month before last`  |
| This Year         | `Last year`          |
| Last Year         | `Year before last`   |
| Last 7 Days       | `Previous 7 days`    |
| Last 30 Days      | `Previous 30 days`   |
| Custom            | `Previous period`    |

% change = `calculatePercentageChange(totalIncome, totalIncomePrevious)`, where
`totalIncome = Σ incomeTotalSale` over the aggregated current rows.

---

## Notes for automation

- Detail sections render **`$0.00` placeholders** until the detail query
  resolves — poll for a known value before reading (see `IncomeSummaryPage`).
- For an unsettled **today** detail, tax is folded into Sale (not itemized);
  formula-exact assertions should target a **settled past day**.
- Reconciliation invariants (UI-only, no API needed):
  `Total Payment` (table) = Payment Details total = Sale Details total;
  `Net Total` = Sale = Total Income; `Tax` (table) = `Tax Collected` = Σ tax per tender.

---

## i18n Notes (fold-in from docs/i18n/incomes-translation-map.md — shared across the 3 Income screens)

# Bản đồ dịch thuật — 3 trang Báo cáo thu nhập (Incomes)

> **Phạm vi:** Daily Sale Report (`/incomes/income-daily`) · Income Summary (`/incomes/income-summary`) · Staff Income (`/incomes/income-staff`).
> **Nguồn:** phân tích source (file:line) + xác minh động MCP Playwright (`localhost:1420`, 2026-07-02).
> **Trạng thái app khi quét (MCP):** tiếng Anh. Cả 3 route **gated** (passcode chủ 8888).
> **Dùng để:** đặc tả cho quét động Incomes — xem [`vietnamese-scan-flow.md`](vietnamese-scan-flow.md) §3.4.
> **Triển khai:** [`src/utils/i18nIncomes.ts`](../../src/utils/i18nIncomes.ts) · spec riêng [`TC-i18n-incomes-vietnamese-scan.spec.ts`](../../tests/regression/i18n/TC-i18n-incomes-vietnamese-scan.spec.ts).

Ký hiệu: ✅ đã xác minh qua MCP · ⚠️ HARDCODE (chưa `t()`) · 🔁 cần điều kiện/dữ liệu.

---

## 0. Tổng quan (xác minh qua MCP)

Cả 3 route dùng chung khung: **Passcode gate → DatePicker (preset + lịch) → Bảng dữ liệu → click hàng mở panel chi tiết → (Print / Order Details)**.

| Điểm          | Kết quả                                                         |
| ------------- | --------------------------------------------------------------- |
| Toast         | ❌ không có toast ở cả 3 route                                  |
| data-testid   | chỉ 1 (`income-offline-banner`) → còn lại select theo text/role |
| Passcode gate | ✅ cả 3 khoá bằng **dialog owner-passcode**                     |
| Dialog        | **Order Details** (cả 3)                                        |
| Button        | **Print** (cả 3), **Show more/Show less** (summary)             |
| Tab           | **Day / Week / Month** (income-summary)                         |
| Search        | **Search staff** (income-staff)                                 |
| Calendar      | widget dùng chung (giống order-pending/order-history)           |

---

## 1. Passcode gate (dialog dùng chung — ✅ `[role=dialog]`)

Vào bất kỳ route income nào khi chưa mở khoá → dialog keypad:

| Element  | Text (EN)                                         |
| -------- | ------------------------------------------------- |
| Tiêu đề  | _Enter your passcode_                             |
| Keypad   | 1–9, 0 (data-neutral)                             |
| Checkbox | _Do not require passcode for the next 30 minutes_ |

> Nhập `8888` (env `OWNER_PASSCODE`) + tick "30 minutes" → các route income sau **không** hỏi lại. Route-scan tự nhập passcode nhưng **không quét text dialog** → `scanIncomesGate` quét dialog này (chạy trước khi nhập passcode).

---

## 2. Income Summary — `/incomes/income-summary`

| Element                | Text (EN)                                                 | Trạng thái                        |
| ---------------------- | --------------------------------------------------------- | --------------------------------- |
| Tabs                   | **Day / Week / Month**                                    | ✅ verify                         |
| DatePicker             | preset _Today_ + nút lịch (`icon-calendar`)               | ✅ verify                         |
| Empty (chưa chọn hàng) | _No detail to show_                                       | ✅ verify                         |
| Button                 | **Show more / Show less**                                 | 🔁 khi có nhiều dòng              |
| Button                 | **Print**                                                 | 🔁 trong panel chi tiết           |
| Hàng dữ liệu           | click → panel chi tiết tại chỗ (payment/sale/staff/salon) | ✅ (đã cover ở flow §9)           |
| Dialog                 | **Order Details**                                         | 🔁 mở từ 1 đơn trong chi tiết     |
| Lưới lịch              | "July 2026" / "Mo Tu We Th Fr Sa Su"                      | ⚠️ react-day-picker chưa localize |

---

## 3. Staff Income — `/incomes/income-staff`

| Element    | Text (EN)                                                      | Trạng thái   |
| ---------- | -------------------------------------------------------------- | ------------ |
| Search     | placeholder **Search staff**                                   | ✅ verify    |
| Bảng — cột | **Name · Orders · Subtotal · Supply Fee · Tip · Total Income** | ✅ verify    |
| Empty      | _No detail to show_                                            | ✅ verify    |
| DatePicker | _Today_ + lịch                                                 | ✅ verify    |
| Hàng staff | click → panel chi tiết (tên staff + clock/salary/pay)          | ✅ (flow §9) |
| Button     | **Print** (trong panel chi tiết)                               | ✅ verify    |
| Dialog     | **Order Details**                                              | 🔁           |

---

## 4. Daily Sale Report — `/incomes/income-daily`

| Element              | Text (EN)                                                                        | Trạng thái  |
| -------------------- | -------------------------------------------------------------------------------- | ----------- |
| Bảng dữ liệu + Print | tương tự 2 trang trên                                                            | 🔁          |
| Dialog               | **Order Details**                                                                | 🔁          |
| DatePicker           | _Today_ + lịch                                                                   | ✅          |
| **Lỗi tải**          | ⚠️ **"Failed to load store daily income data!"** + **"Please try again later."** | ⚠️ HARDCODE |

### ⚠️ i18n gap DUY NHẤT (nên fix trong source)

`income-daily-error.tsx:5-6` — 2 chuỗi **hardcode** trong khi **đã có key sẵn**:

| Text hardcode                             | Key có sẵn                     |
| ----------------------------------------- | ------------------------------ |
| _Failed to load store daily income data!_ | `global.failedLoadDailyIncome` |
| _Please try again later._                 | `global.tryAgainLater`         |

> Chỉ cần thay 2 chuỗi bằng `t(global.failedLoadDailyIncome)` / `t(global.tryAgainLater)`. Lỗi này khó ép tự động (cần load fail) → scan chỉ bắt nếu tình cờ; ghi nhận thủ công.

---

## 5. Ánh xạ sang implementation (`i18nIncomes.ts`)

| Hàm / def               | Quét gì                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scanIncomesGate`       | dialog passcode ("Enter your passcode" / "Do not require…") — chạy TRƯỚC khi nhập passcode                                                               |
| `INCOMES_POPUP_DEFS`    | DatePicker lịch (icon-calendar) — screenshot + aria                                                                                                      |
| `scanIncomesDatePicker` | lưới lịch — dò tên tháng/thứ tiếng Anh (như order-history)                                                                                               |
| `scanIncomesDetail`     | click hàng đầu (summary + staff) → **cuộn hết panel** (`scrollThroughPage`) → panel chi tiết (Print, headings) → best-effort mở **Order Details** dialog |

> Route body (tabs/headings/Search/empty/Today) đã được **route-scan** bao (STATIC_ROUTES, gated). Deep-scan thêm: **dialog passcode**, **lưới lịch**, **panel chi tiết + Print + Order Details**.
> **Cuộn hết trang:** `scanRoute` (STATIC_ROUTES) và cả 2 lần bắt chuỗi trong `TC-i18n-screen-compare` gọi `scrollThroughPage()` (cuộn window + mọi khung overflow từ trên xuống dưới rồi về đầu) trước khi quét → nội dung lazy/dưới màn hình mới mount được bắt hết.

---

## 6. KHÔNG phải lỗi dịch — bỏ qua

- Số tiền `$...`, ngày/giờ trơ, tên staff/đơn (data).
- `income-offline-banner` = trạng thái mạng (đã có xử lý riêng).

---

## 7. Trạng thái quét (cập nhật qua Skill `i18n-vietnamese-scan`)

| Ngày quét  | Màn            | Chuỗi UI | ❌ Chưa dịch                 | ⚠️ Sai chuẩn                   | 📐 UI vỡ | ✅ Đúng | Kết quả chi tiết                                                                |
| ---------- | -------------- | -------- | ---------------------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------- |
| 2026-07-06 | income-daily   | 40       | 1 (`Tip`)                    | 3 (`Sale`→Doanh thu)           | 0        | 36      | [income-daily-i18n-result.md](../income-daily/income-daily-test-cases.md)       |
| 2026-07-06 | income-summary | 23       | 1 (`Tip`) + `Pay 1`/`Pay 2`ᵈ | 3 (`Gross/Net Income`, `Sale`) | 0        | 19      | [income-summary-i18n-result.md](../income-summary/income-summary-test-cases.md) |
| 2026-07-06 | income-staff   | 23       | 1 (`Tip`) + `Pay 1`/`Pay 2`ᵈ | 0ᵛ                             | 0        | 22      | [income-staff-i18n-result.md](../income-staff/income-staff-test-cases.md)       |

> ᵈ chỉ deep-scan (`TC-i18n-incomes`, mở panel chi tiết) bắt được — không nằm trong compare view mặc định.
> ᵛ view mặc định 0; `Rate`→"Tỉ lệ" (VP-2267) ở panel chi tiết Salary compare chưa với tới.
>
> Nguồn: `TC-i18n-screen-compare` (EN↔VI) + `TC-i18n-incomes` (deep) → `reports/<khoá>/compare.{json,html}` · `reports/i18n-audit/incomes-scan.{json,html}`.
> **Cuộn hết trang:** compare + route-scan gọi `scrollThroughPage()` trước khi bắt chuỗi; `scanIncomesDetail` thêm `expandPanelSections()` mở khối thu gọn (Staff Payout) → bắt được `Pay 1`/`Pay 2` ([VP-2253](https://linear.app/fastboy/issue/VP-2253)).
> **Đối chiếu VP-2252:** glossary bổ sung `Sale`→Doanh thu ([VP-2268](https://linear.app/fastboy/issue/VP-2268)/[VP-2259](https://linear.app/fastboy/issue/VP-2259)), `Gross Income`→Tổng thu nhập & `Net Income`→Thu nhập thực nhận ([VP-2256](https://linear.app/fastboy/issue/VP-2256)), `Net Total`→Doanh thu thuần ([VP-2258](https://linear.app/fastboy/issue/VP-2258)), `Rate`→Mức lương ([VP-2267](https://linear.app/fastboy/issue/VP-2267)).
> **Còn hạn chế:** `Net Total` (VP-2258) và `Rate` (VP-2267) nằm trong panel chi tiết → compare view-mặc-định chưa bắt; đã thêm vào glossary sẵn, cần mở rộng compare để deep-scan panel là tự gắn cờ.
> Lỗi chung: label lẻ **"Tip"** chưa bọc `t()` ở **cả 3 màn** (cùng component) → fix một chỗ.
