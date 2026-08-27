---
title: Luồng code-gen — Staff Income (/incomes/income-staff)
generated-at: 2026-07-06
skill: codegen-flow-map (3/4)
---

# Luồng code-gen — Staff Income (`/incomes/income-staff`)

> Đầu ra **Skill 3/4** (`codegen-flow-map`): bản đồ **file → file**. Đây là màn **được sinh mới hoàn toàn**
> trong phiên này (page object + spec chưa từng tồn tại). Đường dẫn đã verify (2026-07-06).

## Sơ đồ (file → file)

```
Linear doc "Income Report" (income-report-cd80210c48f3)
  └─(offline fallback)→ docs/linear/income-report.md   (mục Staff Income)
     └─(Skill 1: linear-feature-spec + quét Playwright MCP)
        → docs/features/income-staff.md
           └─(Skill 2: linear-testcase-gen + quét Playwright MCP)
              → docs/testcases/income-staff-testcases.md   (TC-IST-01..18)
                 ├─→ src/pages/pos/IncomeStaffPage.ts   ★ SINH MỚI (page object, extends BasePage)
                 │      imports:
                 │       ├─ @pages/BasePage        → src/pages/BasePage.ts
                 │       ├─ @data/static/shops     → src/data/static/shops.ts (shopTimezone)
                 │       └─ @utils/dateUtils       → src/utils/dateUtils.ts (zonedDayStartUnix/EndUnix)
                 │   └─(wire vào)→ src/fixtures/pages.fixture.ts   ★ THÊM incomeStaffPage
                 └─→ tests/regression/incomes/income-staff/TC-IST-staff-income.spec.ts   ★ SINH MỚI (18 test())
                        │  imports:
                        │   ├─ @fixtures/index   → src/fixtures/index.ts → pages.fixture.ts (incomeStaffPage, passcodeDialog)
                        │   ├─ @/types/testTags  → src/types/testTags.ts (Tag.REGRESSION)
                        │   └─ @data/static/staff → src/data/static/staff.ts (OWNER_PASSCODE)
                        └─(khi `npx playwright test`)→ reports/html · reports/json · reports/junit · reports/allure-results
```

## Bảng mắt xích

| #   | File nguồn               | →   | File đích                                                                                                                                    | Khâu tạo        | Ghi chú                                                |
| --- | ------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------ |
| 1   | Linear "Income Report"   | →   | [docs/linear/income-report.md](../linear/income-report.md)                                                                                   | offline mirror  | mục Staff Income                                       |
| 2   | linear/income-report.md  | →   | [docs/features/income-staff.md](../income-staff/income-staff-test-cases.md)                                                                  | Skill 1         | Quét empty-state + spec 2 biến thể (Commission/Salary) |
| 3   | features/income-staff.md | →   | [docs/testcases/income-staff-testcases.md](../income-staff/income-staff-test-cases.md)                                                       | Skill 2         | 18 TC (12 structural + 6 [data] tự-skip)               |
| 4   | testcases.md             | →   | [src/pages/pos/IncomeStaffPage.ts](../../src/pages/pos/IncomeStaffPage.ts)                                                                   | ★ Skill 2 (mới) | Search + stat bar + listing + detail                   |
| 5   | IncomeStaffPage          | →   | [src/fixtures/pages.fixture.ts](../../src/fixtures/pages.fixture.ts)                                                                         | ★ Skill 2 (mới) | Đăng ký fixture `incomeStaffPage`                      |
| 6   | testcases.md             | →   | [tests/regression/incomes/income-staff/TC-IST-staff-income.spec.ts](../../tests/regression/incomes/income-staff/TC-IST-staff-income.spec.ts) | ★ Skill 2 (mới) | 18 `test()`; 9 structural đã chạy PASS                 |
| 7   | spec                     | →   | reports/html, reports/json, reports/junit, reports/allure-results                                                                            | runtime         | Reporters                                              |

## Ghi chú

- **Mắt xích trước đây thiếu (nay đã bổ sung):** page object, fixture entry, spec — tất cả sinh mới ở phiên này.
- Khác income-summary/daily: **không** dùng util reconciliation (`incomeCalcCore`, `staffPayout`) — mới ở mức structural. Các TC-IST [data] để ngỏ cho vòng sau khi có ngày phát sinh staff, sẽ dùng `payPeriod`/`staffPayout` để đối chiếu công thức.
- Report gộp-1-test là đầu ra **Skill 6** → `reports/income-staff/`.

---

---

title: Chi tiết luồng code-gen — Staff Income (/incomes/income-staff)
expands: docs/codegen-flow/income-staff-flow.md
generated-at: 2026-07-06
skill: codegen-flow-detail (4/4)
---

# Chi tiết luồng code-gen — Staff Income (`/incomes/income-staff`)

> Đầu ra **Skill 4/4**: mở rộng [income-staff-flow.md](../income-staff/income-staff-code-detail.md). Màn **sinh mới**
> hoàn toàn trong phiên này → đây là bản giải thích code do skill 2 vừa tạo. Đoạn trích copy đúng từ file thật.

## Tổng quan công nghệ

| Công nghệ                  | Vai trò trong luồng gen                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Playwright MCP**         | Quét màn: `browser_navigate` → `/incomes/income-staff`; `browser_snapshot` → title "Staff Income", ô "Search staff", 6 thẻ tổng, empty "No results found." + "No detail to show" |
| **Playwright Test**        | Runner; 9 test structural đã chạy **PASS** để verify selector                                                                                                                    |
| **Page Object Model**      | `IncomeStaffPage extends BasePage` (SINH MỚI)                                                                                                                                    |
| **Custom fixtures**        | Thêm `incomeStaffPage` vào `pages.fixture.ts`                                                                                                                                    |
| **TZ-aware epoch**         | `zonedDayStartUnix/EndUnix` + `shopTimezone` cho `gotoRange`/`gotoDate`                                                                                                          |
| **test.skip có điều kiện** | 6 TC `[data]` tự bỏ qua khi ngày không có staff                                                                                                                                  |

## Chi tiết theo file

### 1. Quét MCP (Skill 1 & 2) — nguồn selector

```js
await page.goto('http://localhost:1420/incomes/income-staff'); // browser_navigate
// browser_snapshot a11y tree:
//   text "Staff Income"; textbox "Search staff"; combobox "Today"; button "…07/06/2026"
//   6 stat: Total staff / Total orders / Total subtotal / Total supply fee / Total tip / Total staff income
//   heading "No results found." (list rỗng) ; heading "No detail to show"
```

- **Giải thích:** vì tài khoản quét hôm nay không có staff phát sinh → chỉ thấy empty-state. Đây là lý do
  6 TC `[data]` được viết dạng **tự-skip**.

### 2. `src/pages/pos/IncomeStaffPage.ts` (SINH MỚI)

```ts
// L48-L60 — locator từ snapshot
export class IncomeStaffPage extends BasePage {
  protected readonly path = '/incomes/income-staff';
  this.heading = page.getByText('Staff Income', { exact: true });
  this.searchInput = page.getByRole('textbox', { name: 'Search staff' });
  this.periodDropdown = page.getByRole('combobox').first();
  this.emptyResults = page.getByRole('heading', { name: 'No results found.' });
  this.noDetail = page.getByRole('heading', { name: 'No detail to show', exact: true });
```

```ts
// waitForReady — chờ stat bar (mount sau khi passcode mở)
async waitForReady(): Promise<void> {
  await expect(this.heading).toBeVisible({ timeout: 15_000 });
  await expect(this.statLabel('Total staff income')).toBeVisible({ timeout: 15_000 });
}
```

```ts
// statValue — lấy value là sibling ngay sau label
statValue(name: StaffIncomeStat): Locator {
  return this.statLabel(name).locator('xpath=following-sibling::*[1]');
}
```

- **Công nghệ:** cùng khuôn gated-route như DailySaleReportPage/IncomeSummaryPage (goto không ready,
  caller mở passcode); locator dựa **role + visible text** (app chưa có `data-testid`); XPath sibling để
  gắn value với label.

### 3. `src/fixtures/pages.fixture.ts` (THÊM)

```ts
import { IncomeStaffPage } from '@pages/pos/IncomeStaffPage';
// interface PagesFixture { ... incomeStaffPage: IncomeStaffPage; ... }
incomeStaffPage: async ({ page }, use) => { await use(new IncomeStaffPage(page)); },
```

- **Công nghệ:** Playwright fixture — mỗi test nhận `incomeStaffPage` mới (isolation theo test).

### 4. `tests/regression/incomes/income-staff/TC-IST-staff-income.spec.ts` (SINH MỚI, 18 test)

```ts
import { test, expect } from '@fixtures/index';
import { Tag } from '@/types/testTags';
import { OWNER_PASSCODE } from '@data/static/staff';

test.beforeEach(async ({ incomeStaffPage, passcodeDialog }) => {
  await incomeStaffPage.goto();
  await passcodeDialog.enterPasscode(OWNER_PASSCODE);
  await incomeStaffPage.waitForReady();
});
```

```ts
// TC [data] — tự skip khi không có staff
test('TC-IST-15: clicking a staff opens the detail panel with Print enabled', async ({ incomeStaffPage }) => {
  test.skip((await incomeStaffPage.rowCount()) === 0, 'No staff rows for the current day.');
  await incomeStaffPage.openStaffDetail(0);
  await expect(incomeStaffPage.printButton).toBeEnabled();
});
```

- **Công nghệ:** `test.skip(condition, reason)` — data-agnostic; suite xanh cả khi tenant/ngày rỗng.

## So với bản map (Skill 3)

- Chi tiết thêm: **các đoạn code sinh mới** (locator, `waitForReady`, `statValue` XPath, fixture entry,
  mẫu `test.skip` cho TC [data]) — bản map chỉ đánh dấu "★ SINH MỚI" ở mức file.
- **Kết quả verify:** `npx playwright test …/income-staff --grep "structure & permission"` → **9 passed**.

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
