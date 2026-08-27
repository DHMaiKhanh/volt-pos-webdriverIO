---
title: Luồng code-gen — Order Pending (/order-pending)
generated-at: 2026-07-06
skill: codegen-flow-map (3/4)
---

# Luồng code-gen — Order Pending (`/order-pending`)

> Đầu ra **Skill 3/4** (`codegen-flow-map`): bản đồ **file → file** của quá trình sinh test
> cho màn Order Pending. Mọi đường dẫn dưới đây đã verify tồn tại thật (2026-07-06). Bản
> giải thích chi tiết từng đoạn code + công nghệ là **Skill 4/4** (`codegen-flow-detail`).

## Sơ đồ (file → file)

```
Linear doc (order-pending-caa07c054f23)
  └─(offline fallback)→ docs/linear/order-pending.md
     └─(Skill 1: linear-feature-spec + quét Playwright MCP)
        → docs/features/order-pending.md  ─┬─ ảnh: docs/features/order-pending-assets/queue.png
           └─(Skill 2: linear-testcase-gen + quét Playwright MCP)
              → docs/testcases/order-pending-testcases.md   (TC-OP-01..11)
                 ├─→ src/pages/pos/OrderPendingPage.ts       (page object, extends BasePage)
                 └─→ tests/regression/orders/order-pending/TC-order-pending.spec.ts  (spec)
                        │  imports:
                        │   ├─ @fixtures/index  → src/fixtures/pages.fixture.ts (orderPendingPage)
                        │   ├─ @/types/testTags → src/types/testTags.ts (Tag)
                        │   ├─ @constants/urls  → src/constants/urls.ts (Urls)
                        │   └─ @pages/pos/OrderPendingPage (ORDER_CODE_RE)
                        └─(khi `npx playwright test`)→ reports/html · reports/json · reports/junit · reports/allure-results
```

## Bảng mắt xích

| #   | File nguồn                                                                                                                 | →   | File đích                                                                                                                              | Khâu tạo                | Ghi chú                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| 1   | Linear `order-pending` doc                                                                                                 | →   | [docs/linear/order-pending.md](../linear/order-pending.md)                                                                             | có sẵn (offline mirror) | Nguồn spec — Linear MCP chưa auth nên dùng bản offline                      |
| 2   | [docs/linear/order-pending.md](../linear/order-pending.md)                                                                 | →   | [docs/features/order-pending.md](../order-pending/order-pending-test-cases.md)                                                         | Skill 1 (feature-spec)  | Tổng hợp spec + quét UI thật qua Playwright MCP                             |
| 3   | quét Playwright MCP                                                                                                        | →   | [docs/features/order-pending-assets/queue.png](../features/order-pending-assets/queue.png)                                             | Skill 1                 | Ảnh chụp queue                                                              |
| 4   | [docs/features/order-pending.md](../order-pending/order-pending-test-cases.md)                                             | →   | [docs/testcases/order-pending-testcases.md](../order-pending/order-pending-test-cases.md)                                              | Skill 2 (testcase-gen)  | 11 test case, mỗi TC map 1-1 một `test()`                                   |
| 5   | [docs/testcases/order-pending-testcases.md](../order-pending/order-pending-test-cases.md)                                  | →   | [src/pages/pos/OrderPendingPage.ts](../../src/pages/pos/OrderPendingPage.ts)                                                           | Skill 2                 | Thêm locator toolbar + card + action (search/setSort/…)                     |
| 6   | [docs/testcases/order-pending-testcases.md](../order-pending/order-pending-test-cases.md)                                  | →   | [tests/regression/orders/order-pending/TC-order-pending.spec.ts](../../tests/regression/orders/order-pending/TC-order-pending.spec.ts) | Skill 2                 | 11 `test()` (TC-OP-01..11)                                                  |
| 7   | [src/pages/pos/OrderPendingPage.ts](../../src/pages/pos/OrderPendingPage.ts)                                               | →   | [src/fixtures/pages.fixture.ts](../../src/fixtures/pages.fixture.ts)                                                                   | có sẵn                  | Fixture `orderPendingPage` (đã đăng ký từ trước)                            |
| 8   | [src/fixtures/pages.fixture.ts](../../src/fixtures/pages.fixture.ts) + [api.fixture.ts](../../src/fixtures/api.fixture.ts) | →   | [src/fixtures/index.ts](../../src/fixtures/index.ts)                                                                                   | có sẵn                  | `mergeTests` → export `test`/`expect` cho spec                              |
| 9   | spec                                                                                                                       | →   | reports/{html,json,junit,allure-results}                                                                                               | khi chạy                | Reporters khai báo trong [playwright.config.ts](../../playwright.config.ts) |

## Phụ thuộc phụ (spec import)

| Import trong spec                   | File thật                                                                    | Vai trò                              |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| `@fixtures/index`                   | [src/fixtures/index.ts](../../src/fixtures/index.ts)                         | `test`, `expect` (fixtures gộp)      |
| `@/types/testTags`                  | [src/types/testTags.ts](../../src/types/testTags.ts)                         | `Tag` (@regression/@ui/@smoke)       |
| `@constants/urls`                   | [src/constants/urls.ts](../../src/constants/urls.ts)                         | `Urls` (ORDER_HISTORY, APPOINTMENT…) |
| `@pages/pos/OrderPendingPage`       | [src/pages/pos/OrderPendingPage.ts](../../src/pages/pos/OrderPendingPage.ts) | `ORDER_CODE_RE`, class page object   |
| `@pages/BasePage` (qua page object) | [src/pages/BasePage.ts](../../src/pages/BasePage.ts)                         | `goto()`, `waitForReady()` cơ sở     |

## Ghi chú

- **Mắt xích đã tồn tại từ trước** (không phải skill này sinh): page object `OrderPendingPage`
  đã có sẵn và **đã đăng ký** trong `pages.fixture.ts`; Skill 2 chỉ **mở rộng** thêm locator/action,
  không cần sửa fixture.
- **Không có helper riêng** trong `src/utils/` cho luồng order-pending (khác với luồng i18n dùng
  `src/utils/i18nScan.ts`). Nếu sau này tách logic parse card ra util, thêm mắt xích tại đây.
- **Report chỉ sinh khi chạy** `npx playwright test`. Lần chạy thử bị chặn do dev server `:1420`
  tắt giữa phiên (môi trường), không liên quan tới code đã gen.

---

---

title: Chi tiết luồng code-gen — Order Pending (/order-pending)
expands: docs/codegen-flow/order-pending-flow.md
generated-at: 2026-07-06
skill: codegen-flow-detail (4/4)
---

# Chi tiết luồng code-gen — Order Pending (`/order-pending`)

> Đầu ra **Skill 4/4** (`codegen-flow-detail`): mở rộng [bản map 3/4](../order-pending/order-pending-code-detail.md)
> xuống mức **từng đoạn code + công nghệ**. Mọi đoạn trích copy đúng từ file thật (kèm số dòng).

## Tổng quan công nghệ

| Công nghệ                                       | Vai trò trong luồng gen                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Linear MCP** (`linear-server`)                | Đọc spec gốc; phiên này chưa auth → fallback `docs/linear/order-pending.md`                                                     |
| **Playwright MCP** (`mcp__playwright__*`)       | Quét UI thật (`browser_navigate` + `browser_snapshot`) để lấy role/label/placeholder → nền tảng cho locator, chống bịa selector |
| **Playwright Test** (`@playwright/test`)        | Runner chạy spec; `expect` web-first assertions (auto-retry)                                                                    |
| **Page Object Model** (`BasePage`)              | Đóng gói locator + action theo màn hình                                                                                         |
| **Custom fixtures** (`mergeTests`)              | Bơm `orderPendingPage` vào test qua DI                                                                                          |
| **TypeScript path alias**                       | `@fixtures`, `@pages`, `@constants`, `@/` — map trong `tsconfig.json`                                                           |
| **Tag system** (`Tag`)                          | Gắn `@regression`/`@ui`/`@smoke` vào tên test để lọc khi chạy                                                                   |
| **Reporters** (list/html/json/junit/**allure**) | Sinh report khi `npx playwright test`                                                                                           |
| **ESLint + Prettier**                           | `npx eslint --fix` verify style sau khi gen                                                                                     |

## Chi tiết theo file

### 1. `docs/linear/order-pending.md` — nguồn spec

- **Vai trò:** bản mirror offline của Linear doc `order-pending-caa07c054f23`. Cung cấp
  định nghĩa Pending Order, 3 nguồn tạo đơn, lifecycle, offline mode.
- **Công nghệ:** Markdown + frontmatter (`linearId`, `url`). Đọc bằng `Read`. Đây là fallback
  khi **Linear MCP** chưa xác thực trong phiên non-interactive.

### 2. `docs/features/order-pending.md` — feature spec (Skill 1)

- **Vai trò:** tổng hợp spec + đối chiếu với UI thật đã quét.
- **Công nghệ dùng để gen:** **Playwright MCP** — `browser_navigate('http://localhost:1420/order-pending')`
  rồi `browser_snapshot()` trả accessibility tree. Từ tree rút ra card fields và toolbar. Ảnh
  `order-pending-assets/queue.png` chụp bằng `browser_take_screenshot`.
- **Bằng chứng quét (trích snapshot MCP):**
  ```yaml
  - button "OD260706-01297238 In Use Unknown N/A 0 Pts 07:21 PM Processing Regular Pedicure Linda"
  - textbox "Search order ID, customer name or phone"
  - combobox: Latest # options: Latest / Oldest
  - button "Quick Checkout"
  ```

### 3. `src/pages/pos/OrderPendingPage.ts` — page object (Skill 2)

- **Vai trò:** locator + action cho màn hình; **không** chứa assert nghiệp vụ (trừ helper
  `expect*` kế thừa sẵn có).
- **Đoạn — hằng regex + kế thừa BasePage** ([:6-13](../../src/pages/pos/OrderPendingPage.ts#L6-L13)):

  ```ts
  export const ORDER_CODE_RE = /OD\d{6}-\d{8}/;
  export type SortOrder = 'Latest' | 'Oldest';
  export class OrderPendingPage extends BasePage {
    protected readonly path = Urls.ORDER_PENDING;
  ```

  - **Giải thích:** `path` được `BasePage.goto()` dùng để `page.goto(path)`. `ORDER_CODE_RE`
    chuẩn hoá format mã đơn thấy khi quét (`OD######-########`).

- **Đoạn — locator bắt nguồn từ scan** ([:39-52](../../src/pages/pos/OrderPendingPage.ts#L39-L52)):

  ```ts
  this.searchInput = page.getByRole('textbox', {
    name: /Search order ID, customer name or phone/i,
  });
  this.sortCombobox = page.getByRole('combobox').filter({ hasText: /Latest|Oldest/ });
  this.quickCheckoutButton = page.getByRole('button', { name: 'Quick Checkout' });
  ```

  - **Công nghệ:** Playwright **role-based locator** (`getByRole`) + `.filter({hasText})` — bền hơn
    CSS selector; đúng chuỗi lấy từ snapshot MCP (không bịa).

- **Đoạn — action `setSort` / `sortOptions`** ([:118-140](../../src/pages/pos/OrderPendingPage.ts#L118-L140)):

  ```ts
  async setSort(order: SortOrder): Promise<void> {
    await this.sortCombobox.click();
    await this.page.getByRole('option', { name: order, exact: true }).click();
  }
  ```

  - **Giải thích:** mô phỏng combobox tuỳ biến (click mở listbox → click `option`). `role=option`
    xác nhận từ snapshot (`option "Latest" [selected]`, `option "Oldest"`).

### 4. `tests/regression/orders/order-pending/TC-order-pending.spec.ts` — spec (Skill 2)

- **Vai trò:** mỗi TC trong file testcase `.md` → một `test()`.
- **Đoạn — import qua alias + fixtures** ([:1-4](../../tests/regression/orders/order-pending/TC-order-pending.spec.ts#L1-L4)):

  ```ts
  import { test, expect } from '@fixtures/index';
  import { Tag } from '@/types/testTags';
  import { Urls } from '@constants/urls';
  import { ORDER_CODE_RE } from '@pages/pos/OrderPendingPage';
  ```

  - **Công nghệ:** **TS path alias** (resolve qua `tsconfig.json` "paths" + `tsconfig-paths`/vite).
    `test` là bản `mergeTests(pagesFixture, apiFixture)` nên có sẵn `orderPendingPage`.

- **Đoạn — describe + beforeEach + tag** ([:15-18](../../tests/regression/orders/order-pending/TC-order-pending.spec.ts#L15-L18)):

  ```ts
  test.describe(`Order Pending — queue ${Tag.REGRESSION} ${Tag.UI}`, () => {
    test.beforeEach(async ({ orderPendingPage }) => {
      await orderPendingPage.goto();
    });
  ```

  - **Công nghệ:** template string nhúng `Tag` → lọc bằng `--grep @regression`. `beforeEach`
    dùng **fixture DI** `orderPendingPage` (không `new` thủ công).

- **Đoạn — TC dựa trên dữ liệu quét, skip an toàn** ([:40-53](../../tests/regression/orders/order-pending/TC-order-pending.spec.ts#L40-L53)):

  ```ts
  const count = await orderPendingPage.orderCardCount();
  test.skip(count === 0, 'No pending orders to search');
  const code = await orderPendingPage.orderCodeAt(0);
  const fragment = code!.split('-')[1]; // the 8-digit suffix
  await orderPendingPage.search(fragment);
  await expect(orderPendingPage.orderCards()).toHaveCount(1);
  ```

  - **Giải thích:** hành vi search này đã **verify live qua Playwright MCP** (gõ `01297238` →
    còn đúng 1 card). `test.skip` runtime tránh fail giả khi shop rỗng.
  - **Công nghệ:** `expect(locator).toHaveCount()` — web-first assertion auto-retry tới timeout.

### 5. `src/fixtures/pages.fixture.ts` + `index.ts` — DI (có sẵn)

- **Đoạn** ([pages.fixture.ts:36-38](../../src/fixtures/pages.fixture.ts#L36-L38)):

  ```ts
  orderPendingPage: async ({ page }, use) => {
    await use(new OrderPendingPage(page));
  },
  ```

  - **Công nghệ:** Playwright `base.extend<PagesFixture>` — tạo instance page object mỗi test,
    tự dọn sau `use`. `index.ts` gộp page + api fixture bằng `mergeTests`.

### 6. `playwright.config.ts` — cấu hình chạy

- **Đoạn** ([:34-43](../../playwright.config.ts#L34-L43)): reporters `list/html/json/junit/allure-playwright`.
- **Đoạn** ([:45-58](../../playwright.config.ts#L45-L58)): `baseURL: env.BASE_URL` (mặc định
  `http://localhost:1420`), `timezoneId` theo shop → "Today" của app khớp date math của test.
  - **Công nghệ:** Playwright config + `loadEnv()` (dotenv). `trace/screenshot/video: 'on'` để
    dashboard replay.

## So với bản map (Skill 3)

- Skill 3 chỉ nêu **file → file**; bản này đi tới **đoạn code cụ thể + số dòng** và **công nghệ**
  đứng sau từng đoạn (role locator, fixture DI, tag filter, web-first assertion, MCP scan).
- Bổ sung **bằng chứng quét MCP** (yaml snapshot) chứng minh locator không bịa.
- Ghi rõ điểm **có sẵn vs sinh mới**: `pages.fixture.ts`/`index.ts`/`playwright.config.ts` là hạ
  tầng có sẵn; Skill 2 chỉ thêm locator/action vào `OrderPendingPage.ts` và sinh mới spec.

---

## i18n Notes (fold-in from docs/i18n/order-pending-translation-map.md)

# Bản đồ dịch thuật — Trang Đơn đang chờ (`/order-pending`)

> **Nguồn:** phân tích source (file:line app repo) + xác minh động bằng MCP Playwright trên app đang chạy (`http://localhost:1420/order-pending`, 2026-07-02).
> **Trạng thái app khi quét (MCP):** đang hiển thị **tiếng Anh**.
> **Dùng để:** đặc tả cho quét động trang Đơn đang chờ — xem [`vietnamese-scan-flow.md`](vietnamese-scan-flow.md) §3.3.
> **Triển khai:** [`src/utils/i18nOrderPending.ts`](../../src/utils/i18nOrderPending.ts) · spec riêng [`TC-i18n-order-pending-vietnamese-scan.spec.ts`](../../tests/regression/i18n/TC-i18n-order-pending-vietnamese-scan.spec.ts).
> **Quét gần nhất (compare EN↔VI):** 2026-07-06 — tổng 6 · ❌ chưa dịch 1 (`Unknown`→"Không rõ") · ⚠️ sai chuẩn 0 · 📐 UI vỡ 0. Chi tiết: [`order-pending-i18n-result.md`](../order-pending/order-pending-test-cases.md).

Ký hiệu: ✅ đã xác minh mở được qua MCP · ⚠️ HARDCODE (chưa `t()`) · 🔁 cần điều kiện · 🔇 nút icon thiếu nhãn.

---

## 0. Tổng quan (xác minh qua MCP)

```
/order-pending
├── FILTER BAR (filter-bar.tsx): Search · Staff (n) · Sort (Latest) · DatePicker (preset + lịch) · Quick Checkout
├── LƯỚI THẺ ĐƠN (pending-order-card.tsx): mã đơn · Unknown · N/A · 0 Pts · giờ · Processing · service/staff
└── STATE: Empty (No pending orders) / Error (Couldn't load…) / Loading (spinner)
```

**Popover/dropdown mở được (không cần chọn đơn):**

- **Staff filter** → popover `[role=dialog]` (`popover.tsx:111`).
- **Sort** → `[role=listbox]` (Latest/Oldest).
- **DatePicker preset** → `[role=listbox]` (Today/Yesterday/…).
- **DatePicker lịch** → `[role=dialog]` (react-day-picker grid).

---

## 1. FilterBar — `filter-bar.tsx`

| Element            | Text (EN)                                                     | file:line             | Trạng thái |
| ------------------ | ------------------------------------------------------------- | --------------------- | ---------- |
| Search input       | placeholder _Search order ID, customer name or phone_         | `filter-bar.tsx:43`   | ✅ verify  |
| Nút Staff filter   | _Staff_ + badge số                                            | `staff-filter.tsx:82` | ✅ verify  |
| Nút Quick Checkout | _Quick Checkout_ (icon +)                                     | `filter-bar.tsx:59`   | ✅ verify  |
| DatePicker         | preset dùng chung (Today/Yesterday…, trừ This Year/Last Year) | `filter-bar.tsx:50`   | ✅ verify  |

### 1a. Popover Staff filter — `staff-filter.tsx` (✅ `[role=dialog]`)

| Element              | Text (EN)                      | line |
| -------------------- | ------------------------------ | ---- |
| Search               | placeholder _By Staff_         | 102  |
| Checkbox chọn tất cả | _All_                          | 110  |
| Empty                | _No results found._            | 117  |
| Danh sách staff      | tên staff (data động — bỏ qua) | 124  |

### 1b. Dropdown Sort — `sort-filter.tsx` (✅ `[role=listbox]`)

| Option     | Text (EN) | line                 |
| ---------- | --------- | -------------------- |
| SelectItem | _Latest_  | 38 (`global.latest`) |
| SelectItem | _Oldest_  | 38 (`global.oldest`) |

### 1c. DatePicker (✅ verify)

- **Preset dropdown** (`[role=listbox]`): _Today · Yesterday · This Week · Last Week · Last 7 Days · This Month · Last Month · Last 30 Days_.
- **Lưới lịch** (`[role=dialog]`, react-day-picker): tiêu đề tháng **"July 2026"** + hàng thứ **"Mo Tu We Th Fr Sa Su"** → ⚠️ **grid còn tiếng Anh** (giống Lịch sử đơn hàng — từ điển chung không bắt được tên tháng/thứ, phải dò riêng).

---

## 2. Trạng thái Empty / Error / Loading — `empty-state.tsx` / `index.tsx`

| Trạng thái   | Text (EN)                                                                                                       | Nguồn                   | Kích hoạt       |
| ------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------- |
| Không có đơn | title _No pending orders_ · desc _New orders created from check-in or appointments will show up here._          | `empty-state.tsx:11-12` | 🔁 khi 0 đơn    |
| Lỗi tải      | title _Couldn't load pending orders_ · desc _Something went wrong. Please check your connection and try again._ | `index.tsx:45-46`       | 🔁 khi lỗi mạng |
| Đang tải     | (spinner, không chữ)                                                                                            | `index.tsx:50`          | —               |

> Empty/Error khó ép tự động (cần 0 đơn / lỗi mạng) → scan chỉ bắt nếu tình cờ xuất hiện; ghi nhận thủ công.

---

## 3. Thẻ đơn pending — `pending-order-card.tsx`

| Element                                 | Text (EN)                                                | line                      | Ghi chú                      |
| --------------------------------------- | -------------------------------------------------------- | ------------------------- | ---------------------------- |
| Badge đang dùng                         | _In Use_                                                 | 77                        | 🔁 khi đơn mở ở máy khác     |
| Badge đã check-in                       | _Checked-in_                                             | 87                        | 🔁 khi đã check-in           |
| Phone fallback                          | _N/A_                                                    | 94                        | ✅ verify (hiện thường trực) |
| Điểm                                    | _{{points}} Pts_                                         | 96                        | ✅ verify ("0 Pts")          |
| Badge trạng thái                        | _Processing_ (mặc định)                                  | 106 (`common.processing`) | ✅ verify                    |
| Thêm service                            | _+ {{count}} more service_ / _+ {{count}} more services_ | 117                       | 🔁 khi >1 service            |
| mã đơn / tên KH / giờ / service / staff | data động — **không dịch**                               | 71,83,101,129,130         | —                            |

> Thẻ đơn nằm trong luồng `/order-pending` (đã là STATIC_ROUTE) nên chuỗi hiển-thị-sẵn được route-scan bắt. Badge điều kiện (In Use / Checked-in / +N more) chỉ bắt được khi có dữ liệu tương ứng.

---

## 4. TOAST — `use-pending-actions.ts`

| Trigger                   | Text (EN)                                                | Loại  | line |
| ------------------------- | -------------------------------------------------------- | ----- | ---- |
| Tạo đơn lỗi               | _Couldn't create a new order. Please try again._         | error | 58   |
| Bắt đầu checkout appt lỗi | _Couldn't start appointment checkout. Please try again._ | error | 67   |
| Sync đơn lỗi              | _Couldn't sync this order. Please try again._            | error | 117  |

> Toast lỗi cần điều kiện nghiệp vụ/lỗi mạng → scan **không** ép; ghi nhận thủ công.

---

## 5. Dialog guard (render từ component dùng chung — KHÔNG trong route này)

Khi mở 1 thẻ bị chặn (đơn half-paid, hoặc đang mở ở máy khác), `openOrder` kích hoạt guard dùng chung:

| Dialog                     | Text (EN)                                                                                   | Key                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Đơn đang dùng máy khác     | _Order in use_ · _This order is currently being used on another device…_                    | `global.orderInUseTitle` / `…Description`           |
| Phải hoàn tất đơn hiện tại | _Complete the current order first_ · _The current order already has a payment in progress…_ | `global.completeCurrentOrderTitle` / `…Description` |

> 🔁 Hai dialog này khó ép tự động (cần trạng thái đơn đặc thù). `scanOrderPendingCardOpen` click thẻ đầu và **best-effort** quét dialog nếu bật lên.

---

## 6. Ánh xạ sang implementation (`i18nOrderPending.ts`)

| Hàm / def                    | Quét gì                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `ORDER_PENDING_POPUP_DEFS`   | DatePicker lịch (icon-calendar) — screenshot + aria qua `scanPopup` |
| `scanOrderPendingFilter`     | Staff popover · Sort dropdown · DatePicker preset dropdown          |
| `scanOrderPendingDatePicker` | lưới lịch — dò tên tháng/thứ tiếng Anh                              |
| `scanOrderPendingCardOpen`   | click thẻ đầu → best-effort quét guard dialog / màn mở đơn          |

> Mọi trigger khai **nhiều fallback** (EN → VN → cấu trúc) vì lúc quét app đang ở Tiếng Việt.

---

## 7. KHÔNG phải lỗi dịch — bỏ qua

- mã đơn `OD…`, tên KH (`Unknown` là fallback UI — có bắt, xem [[home-translation-map]] §5), tên service/staff (data), giờ `02:25 AM`, `0 Pts` (số).
- Ký hiệu, ngày trơ. (Theo Rule 11.)
