---
title: Luồng code-gen — Daily Sale Report (/incomes/income-daily)
generated-at: 2026-07-06
skill: codegen-flow-map (3/4)
---

# Luồng code-gen — Daily Sale Report (`/incomes/income-daily`)

> Đầu ra **Skill 3/4** (`codegen-flow-map`): bản đồ **file → file** của quá trình sinh test cho màn
> Daily Sale Report. Mọi đường dẫn đã verify tồn tại thật (2026-07-06). Bản giải thích chi tiết từng
> đoạn code + công nghệ là **Skill 4/4** (`codegen-flow-detail`).

## Sơ đồ (file → file)

```
Linear doc "Income Report" (income-report-cd80210c48f3)
  └─(offline fallback)→ docs/linear/income-report.md   (mục Daily Sale Report)
     └─(Skill 1: linear-feature-spec + quét Playwright MCP)
        → docs/features/income-daily.md
           └─(Skill 2: linear-testcase-gen + quét Playwright MCP)
              → docs/testcases/income-daily-testcases.md   (TC-1..TC-44 — tài liệu-hoá code có sẵn)
                 ├─→ src/pages/pos/DailySaleReportPage.ts   (page object, extends BasePage)
                 │      imports:
                 │       ├─ @pages/BasePage            → src/pages/BasePage.ts
                 │       ├─ @utils/moneyUtils          → src/utils/moneyUtils.ts
                 │       ├─ @utils/incomeFromOrders    → src/utils/incomeFromOrders.ts
                 │       ├─ @utils/orderDetail         → src/utils/orderDetail.ts
                 │       ├─ @utils/dateUtils           → src/utils/dateUtils.ts
                 │       └─ @data/static/shops         → src/data/static/shops.ts
                 └─→ tests/regression/incomes/daily-sale-report/TC*.spec.ts   (13 file, 44 test())
                        │  imports:
                        │   ├─ @fixtures/index  → src/fixtures/index.ts → pages.fixture.ts (dailySaleReportPage, passcodeDialog)
                        │   ├─ @/types/testTags → src/types/testTags.ts (Tag)
                        │   └─ @data/static/staff → src/data/static/staff.ts (OWNER_PASSCODE)
                        └─(khi `npx playwright test`)→ reports/html · reports/json · reports/junit · reports/allure-results
```

## Bảng mắt xích

| #   | File nguồn                                                                  | →   | File đích                                                                              | Khâu tạo                | Ghi chú                                                    |
| --- | --------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| 1   | Linear "Income Report"                                                      | →   | [docs/linear/income-report.md](../linear/income-report.md)                             | có sẵn (offline mirror) | Linear MCP chưa auth → dùng bản offline                    |
| 2   | [docs/linear/income-report.md](../linear/income-report.md)                  | →   | [docs/features/income-daily.md](../income-daily/income-daily-test-cases.md)            | Skill 1                 | Tổng hợp business rules + quét UI thật (KPI cards, panels) |
| 3   | [docs/features/income-daily.md](../income-daily/income-daily-test-cases.md) | →   | [docs/testcases/income-daily-testcases.md](../income-daily/income-daily-test-cases.md) | Skill 2                 | 44 TC; tài liệu-hoá coverage đã có (không đè code)         |
| 4   | testcases.md                                                                | →   | [src/pages/pos/DailySaleReportPage.ts](../../src/pages/pos/DailySaleReportPage.ts)     | có sẵn                  | Page object 2 cột (cards+chart / table+details)            |
| 5   | testcases.md                                                                | →   | tests/regression/incomes/daily-sale-report/ (13 spec)                                  | có sẵn                  | 44 `test()` chia cluster                                   |
| 6   | spec                                                                        | →   | reports/html, reports/json, reports/junit, reports/allure-results                      | runtime                 | Playwright reporters (playwright.config.ts)                |

## Ghi chú

- **Không có mắt xích thiếu** — màn này đã có đủ page object + spec trước khi chạy skill.
- Report gộp-1-test kiểu Home là đầu ra riêng của **Skill 6** (`screen-suite-report`) → `reports/income-daily/`.

---

---

title: Chi tiết luồng code-gen — Daily Sale Report (/incomes/income-daily)
expands: docs/codegen-flow/income-daily-flow.md
generated-at: 2026-07-06
skill: codegen-flow-detail (4/4)
---

# Chi tiết luồng code-gen — Daily Sale Report (`/incomes/income-daily`)

> Đầu ra **Skill 4/4**: mở rộng [income-daily-flow.md](../income-daily/income-daily-code-detail.md) thành giải
> thích **từng đoạn code + công nghệ**. Mọi đoạn trích copy đúng từ file thật (kèm số dòng, verify 2026-07-06).

## Tổng quan công nghệ

| Công nghệ                                 | Vai trò trong luồng gen                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Linear (MCP `linear-server`)**          | Đọc spec "Income Report"; phiên này chưa auth → fallback `docs/linear/income-report.md`                                                                                |
| **Playwright MCP** (`mcp__playwright__*`) | Quét UI thật: `browser_navigate` → `/incomes/income-daily`, `browser_snapshot` (a11y tree) → lấy label/role của 4 KPI card + 2 panel, `browser_click` để nhập passcode |
| **Playwright Test** (`@playwright/test`)  | Runner: `expect`, `test()`, locator engine `getByRole`/`getByText`                                                                                                     |
| **Page Object Model**                     | `DailySaleReportPage extends BasePage` — gói locator + action                                                                                                          |
| **Custom fixtures** (`mergeTests`)        | `@fixtures/index` bơm `dailySaleReportPage`, `passcodeDialog`                                                                                                          |
| **TypeScript path alias**                 | `@fixtures`, `@pages`, `@utils`, `@data`, `@/` (khai trong tsconfig)                                                                                                   |
| **Timezone-aware epoch**                  | `zonedDayStartUnix/EndUnix` + `shopTimezone` → cửa sổ ngày theo TZ của shop                                                                                            |
| **shadcn/Radix (app đích)**               | Passcode dialog = `role="dialog"`; order detail = `role="dialog" name="Order Details"`                                                                                 |
| **Reporters**                             | list / html / json / junit / allure-playwright (playwright.config.ts)                                                                                                  |

## Chi tiết theo file

### 1. Quét MCP khi gen (Skill 1 & 2)

- **Vai trò:** lấy selector THẬT. Lệnh MCP đã chạy:

```js
await page.goto('http://localhost:1420/incomes/income-daily'); // browser_navigate → hiện passcode dialog
// browser_click các nút "8" → nhập 8888; tick "Do not require passcode for the next 30 minutes"
// browser_snapshot → a11y tree: 4 card heading level=4 (Total Order/Sale/Total tip/Total Payment),
//   panel "Income Details" (Sale/Tip/Tax Collected/Total Payment), "Payment Details" (Card/Cash/Others/…)
```

- **Công nghệ:** `browser_snapshot` trả cây accessibility → nguồn quyết định `getByRole('heading',{level:4})`.

### 2. `src/pages/pos/DailySaleReportPage.ts` (page object)

- **Vai trò:** locator + action, không assert.

```ts
// L28-L29, L44-L46
export class DailySaleReportPage extends BasePage {
  protected readonly path = '/incomes/income-daily';
  // ...
  this.heading = page.getByText('Daily Sale Report', { exact: true });
  this.todayButton = page.getByRole('button', { name: 'Today', exact: true });
  this.printButton = page.getByRole('button', { name: 'Print' });
```

```ts
// L67-L71 — route gated, KHÔNG waitForReady ở goto()
async goto(): Promise<void> {
  this.logger.info(`Navigate to ${this.path}`);
  await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
  // Intentionally NOT calling waitForReady() — caller unlocks first.
}
```

- **Giải thích:** route bọc `PermissionProtectedRoute` → dialog passcode che layout. `goto()` cố tình
  **không** chờ readiness để caller mở passcode trước, rồi mới `waitForReady()` (chờ card "Sale").
- **Công nghệ:** Playwright locator (text/role) + kỹ thuật "gated route": tách navigate ↔ ready.

```ts
// L350-L357 — điều hướng theo ngày qua URL (bỏ qua calendar popover)
async gotoDate(date: Date, activeChart: ChartKey = 'sale'): Promise<void> {
  const tz = shopTimezone(process.env.SHOP);
  const from = zonedDayStartUnix(date, tz);
  const to = zonedDayEndUnix(date, tz);
  await this.page.goto(`${this.path}?from=${from}&to=${to}&activeChart=${activeChart}`);
}
```

- **Công nghệ:** URL là single-source-of-truth của filter → set thẳng epoch theo **TZ shop** (`dateUtils` + `shops`).

### 3. `tests/regression/incomes/daily-sale-report/TC*.spec.ts` (44 test)

```ts
// TC01…-defaults.spec.ts (đầu file)
import { test, expect } from '@fixtures/index';
import { Tag } from '@/types/testTags';
import { OWNER_PASSCODE } from '@data/static/staff';

test.beforeEach(async ({ dailySaleReportPage, passcodeDialog }) => {
  await dailySaleReportPage.goto();
  await passcodeDialog.enterPasscode(OWNER_PASSCODE);
  await dailySaleReportPage.waitForReady();
});
```

- **Giải thích:** mẫu chuẩn — `goto()` (chưa ready) → `enterPasscode(8888)` (điền digit qua Radix keypad) → `waitForReady()`.
- **Công nghệ:** custom fixtures (`mergeTests`), tag `${Tag.REGRESSION}` để `--grep`, `PasscodeDialog` component.

### 4. `src/fixtures/index.ts` + `pages.fixture.ts`

```ts
export const test = mergeTests(pagesFixture, apiFixture); // index.ts
// pages.fixture.ts
dailySaleReportPage: async ({ page }, use) => { await use(new DailySaleReportPage(page)); },
```

- **Công nghệ:** Playwright `mergeTests` gộp fixtures → một `test` duy nhất inject page object.

## So với bản map (Skill 3)

- Skill 3 chỉ liệt kê file→file. Ở đây đi tới **đoạn code cụ thể**: cơ chế gated-route (`goto` không ready),
  URL-driven filter theo TZ shop, mẫu `beforeEach` passcode, và cách MCP `browser_snapshot` quyết định locator.

---

## API Reference (GraphQL) — fold-in from docs/api/daily-sale-report-api.md

# Daily Sale Report — API Reference

Screen: **`/incomes/income-daily`** · Source: `volt-pos/src/routes/_app/incomes/income-daily/`

GraphQL defined in [`-shared/income-daily.gql.ts`]; invoked by
[`-shared/use-income-daily.ts`]. Single-day report (one date at a time).

---

## Operations overview

| Operation                             | Type  | Used when                                    | Key arg                                                 |
| ------------------------------------- | ----- | -------------------------------------------- | ------------------------------------------------------- |
| `storeDailyIncomeLive`                | query | Selected date **is today**                   | `reportDate` (RFC3339), `fromUTC`                       |
| `storeDailyIncome`                    | query | Selected date **is a past day**              | `from`/`to` (`YYYY-MM-DD`), `fromUTC`/`toUTC` (RFC3339) |
| `getOrderDetails`                     | query | Clicking an order row (Order Details dialog) | `id` (orderId)                                          |
| `transactionByPk` / `transactionList` | query | Card/transaction info in order detail        | `id` / `ids`                                            |

The current row is `liveData.storeDailyIncomeLive` (today) or
`currentData.reportStoreDailyIncomeList[0]` (past). The **previous** day is
always fetched via `storeDailyIncome` for the `%vs Yesterday` comparison.

---

## 1. `storeDailyIncome` (settled / past day)

```graphql
query storeDailyIncome($from: String, $to: String, $fromUTC: String, $toUTC: String) {
  reportStoreDailyIncomeList(where: { date: { gte: $from, lte: $to } }, orderBy: [{ date: desc }]) {
    ...storeDailyIncome
    incomeTaxAmount
    incomeTotalPayment
    paymentTaxCard
    paymentTaxCash
    paymentTaxOthers
    paymentTaxGiftCardRedemption
    saleIncomeTaxAmount
    saleIncomeTotalPayment
    salonEarningsTaxAmount
  }
  reportStoreDailyIncomeOrderList(where: { reportDate: { gte: $from, lte: $to } }, orderBy: [{ reportDate: desc }]) {
    ...storeDailyIncomeOrder
  }
  orderList(where: { _and: [
    { completedAt: { gte: $fromUTC, lte: $toUTC } }
    { reportOrderStatusTrackingListById: { status: { eq: "successful" } } }
    { _not: { reportOrderStatusTrackingListById: { status: { eq: "canceled" } } } }
  ] }) { ...orderListDaily taxAmount }
  orderAggregate(where: { /* same filter */ }) { aggregate { count } }
}
```

**Variables** (from `use-income-daily.ts`):

- `from`, `to` — merchant-local date `YYYY-MM-DD` (via `formatDateRangeToISO`).
- `fromUTC`, `toUTC` — RFC3339 UTC bounds of the merchant day (via `dateRangeToUTCTimezone`).

**Returns:** the settled income row (`reportStoreDailyIncomeList[0]`), the
per-order rows (`reportStoreDailyIncomeOrderList`), and a count of orders
created in the window (`orderAggregate`, excludes canceled).

---

## 2. `storeDailyIncomeLive` (today, unsettled)

```graphql
query storeDailyIncomeLive($reportDate: String!, $fromUTC: String) {
  storeDailyIncomeLive(reportDate: $reportDate) { ...storeDailyIncomeLive }
  storeDailyIncomeOrdersLive(reportDate: $reportDate) { ...storeDailyIncomeOrderLive taxAmount }
  orderList(where: { _and: [
    { completedAt: { gte: $fromUTC } }
    { reportOrderStatusTrackingListById: { status: { eq: "successful" } } }
    { _not: { reportOrderStatusTrackingListById: { status: { eq: "canceled" } } } }
  ] }) { ...orderListDaily taxAmount }
  orderAggregate(where: { /* same filter */ }) { aggregate { count } }
}
```

**Variables:**

- `reportDate` — **RFC3339** start-of-merchant-day in UTC (e.g. `2026-06-09T17:00:00+00:00`). Required.
- `fromUTC` — same instant; lower bound for live order list.

> Note: for an unsettled day, per-order **tax** is folded into Sale and the
> aggregate `incomeTaxAmount` stays 0 until settlement — tax only itemizes on
> settled days (drives the e2e read-only tax test against a past day).

---

## 3. Income-row fields (`ReportStoreDailyIncome` / `StoreDailyIncomeLive`)

`fragment storeDailyIncome` + `storeDailyIncomeLive` share these fields:

| Field                                                                                     | Meaning                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------- |
| `date`                                                                                    | Report date                         |
| `currencyCode`, `id`, `createdAt`, `updatedAt`                                            | (settled only) metadata             |
| `dailySaleSale`                                                                           | Sale (Income Detail)                |
| `dailySaleTip`                                                                            | Tip                                 |
| `dailySalePaymentCash`                                                                    | Payment — Cash                      |
| `dailySalePaymentCard`                                                                    | Payment — Card                      |
| `dailySalePaymentOthers`                                                                  | Payment — Others                    |
| `dailySalePaymentGiftCardRedemption`                                                      | Gift Card Redemption                |
| `dailySalePaymentAmountCollected`                                                         | Amount Collected (Card+Cash+Others) |
| `dailySaleTotalPayment`                                                                   | Total Payment                       |
| `incomeTaxAmount`                                                                         | Tax Collected (Income Detail)       |
| `incomeTotalPayment`                                                                      | Income Detail Total Payment         |
| `paymentTaxCard` / `paymentTaxCash` / `paymentTaxOthers` / `paymentTaxGiftCardRedemption` | Tax per tender                      |
| `saleIncomeTaxAmount` / `saleIncomeTotalPayment`                                          | Sale-side tax / total               |
| `salonEarningsTaxAmount`                                                                  | Salon earnings tax                  |

### Per-order rows

`fragment storeDailyIncomeOrder` (settled) / `storeDailyIncomeOrderLive` (live):
`id, orderId, saleAmount, refundAmount, tipAmount, giftCardSaleRedemptionAmount,
total, transactionType, reportDate, occurredAt, taxAmount` (settled embeds
`order { ...orderDetails }`; live adds `orderCode`).

`fragment orderListDaily on Order { id createdAt settled status }`.

---

## 4. Order Details dialog — `getOrderDetails`

Clicking an order row opens the Order Details dialog (sets `?orderId=`).
Source: `volt-pos/src/shared/graphql/order.gql.ts`.

```graphql
query getOrderDetails($id: String!) {
  orderByPk(id: $id) {
    ...orderDetails
  }
}
```

`fragment orderDetails on Order` is large — key parts: `orderCode, subtotal,
taxAmount, total, tipAmount, totalDiscount, status, settled, customer {…},
orderItemListById { ...orderItem }, orderTransactionListById { ...orderTransaction },
giftCardHistoryListById { ...giftCardHistory }`.

Supporting transaction queries: `transactionByPk($id)` and
`transactionList($ids)` (card last-four / batch info).

---

## Field → UI map (reconciliation)

| UI label (Income/Payment Details) | GraphQL field                                |
| --------------------------------- | -------------------------------------------- |
| Income · Sale                     | `dailySaleSale`                              |
| Income · Tip                      | `dailySaleTip`                               |
| Income · Tax Collected            | `incomeTaxAmount`                            |
| Income · Total Payment            | `incomeTotalPayment` (= Sale+Tip+Tax)        |
| Payment · Card / Cash / Others    | `dailySalePaymentCard` / `…Cash` / `…Others` |
| Payment · Amount Collected        | `dailySalePaymentAmountCollected`            |
| Payment · Gift Card Redemption    | `dailySalePaymentGiftCardRedemption`         |
| Payment · Total Payment           | `dailySaleTotalPayment`                      |

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
