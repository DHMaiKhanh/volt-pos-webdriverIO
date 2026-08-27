---
title: Luồng code-gen — Order History (/order-history)
generated-at: 2026-07-06
skill: codegen-flow-map (3/4)
---

# Luồng code-gen — Order History (`/order-history`)

> Đầu ra **Skill 3/4** (`codegen-flow-map`): bản đồ **file → file** của quá trình sinh test
> cho màn Order History. Mọi đường dẫn dưới đây đã verify tồn tại thật (2026-07-06). Bản
> giải thích chi tiết từng đoạn code + công nghệ là **Skill 4/4** (`codegen-flow-detail`).

## Sơ đồ (file → file)

```
Linear doc (portal-order-history-ba2903a15df5)
  └─(offline fallback)→ docs/linear/portal-order-history.md
     └─(Skill 1: linear-feature-spec + quét Playwright MCP)
        → docs/features/order-history.md
           └─(Skill 2: linear-testcase-gen + quét Playwright MCP)
              → docs/testcases/order-history-testcases.md   (TC-OH-01..21)
                 ├─→ src/pages/pos/OrderHistoryPage.ts       (page object, extends BasePage — MỞ RỘNG)
                 │      imports:
                 │       ├─ @pages/BasePage                  → src/pages/BasePage.ts
                 │       ├─ @components/modal/PasscodeDialog  → src/components/modal/PasscodeDialog.ts
                 │       └─ @utils/orderDetail                → src/utils/orderDetail.ts
                 └─→ tests/regression/order-history/TC-order-history.spec.ts   (spec, 20 test())
                        │  imports:
                        │   ├─ @fixtures/index  → src/fixtures/index.ts → pages.fixture.ts (orderHistoryPage)
                        │   └─ @/types/testTags → src/types/testTags.ts (Tag)
                        └─(khi `npx playwright test`)→ reports/html · reports/json · reports/junit · reports/allure-results
```

## Bảng mắt xích

| #   | File nguồn                                                                                                                 | →   | File đích                                                                                                                | Khâu tạo                | Ghi chú                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Linear `portal-order-history` doc                                                                                          | →   | [docs/linear/portal-order-history.md](../linear/portal-order-history.md)                                                 | có sẵn (offline mirror) | Nguồn spec — Linear MCP chưa auth nên dùng bản offline                                                |
| 2   | [docs/linear/portal-order-history.md](../linear/portal-order-history.md)                                                   | →   | [docs/features/order-history.md](../order-history/order-history-test-cases.md)                                           | Skill 1 (feature-spec)  | Tổng hợp business rules + quét UI thật qua Playwright MCP (list + detail panel)                       |
| 3   | [docs/features/order-history.md](../order-history/order-history-test-cases.md)                                             | →   | [docs/testcases/order-history-testcases.md](../order-history/order-history-test-cases.md)                                | Skill 2 (testcase-gen)  | 21 test case; mỗi TC map 1-1 một `test()` (trừ TC-OH-21 i18n)                                         |
| 4   | [docs/testcases/order-history-testcases.md](../order-history/order-history-test-cases.md)                                  | →   | [src/pages/pos/OrderHistoryPage.ts](../../src/pages/pos/OrderHistoryPage.ts)                                             | Skill 2 (mở rộng)       | Thêm locator toolbar/filter/receipt + action đọc-only (search/openFilter/openReceipt/openFirstOrder…) |
| 5   | [docs/testcases/order-history-testcases.md](../order-history/order-history-test-cases.md)                                  | →   | [tests/regression/order-history/TC-order-history.spec.ts](../../tests/regression/order-history/TC-order-history.spec.ts) | Skill 2                 | 20 `test()` (TC-OH-01..20); chạy pass 20/20                                                           |
| 6   | [src/pages/pos/OrderHistoryPage.ts](../../src/pages/pos/OrderHistoryPage.ts)                                               | →   | [src/fixtures/pages.fixture.ts](../../src/fixtures/pages.fixture.ts)                                                     | có sẵn                  | Fixture `orderHistoryPage` (đã đăng ký từ trước — Skill 2 KHÔNG sửa)                                  |
| 7   | [src/fixtures/pages.fixture.ts](../../src/fixtures/pages.fixture.ts) + [api.fixture.ts](../../src/fixtures/api.fixture.ts) | →   | [src/fixtures/index.ts](../../src/fixtures/index.ts)                                                                     | có sẵn                  | `mergeTests` → export `test`/`expect` cho spec                                                        |
| 8   | spec                                                                                                                       | →   | reports/{html,json,junit,allure-results}                                                                                 | khi chạy                | Reporters khai báo trong [playwright.config.ts](../../playwright.config.ts)                           |

## Phụ thuộc phụ (import thật)

| Import                             | File thật                                                                              | Vai trò                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@fixtures/index`                  | [src/fixtures/index.ts](../../src/fixtures/index.ts)                                   | `test`, `expect` (fixtures gộp)                                    |
| `@/types/testTags`                 | [src/types/testTags.ts](../../src/types/testTags.ts)                                   | `Tag` (@regression/@ui)                                            |
| `@pages/BasePage`                  | [src/pages/BasePage.ts](../../src/pages/BasePage.ts)                                   | `goto()`, `waitForReady()`, locator factory cơ sở                  |
| `@components/modal/PasscodeDialog` | [src/components/modal/PasscodeDialog.ts](../../src/components/modal/PasscodeDialog.ts) | Nhập passcode khi void/refund (dùng trong cancelOrder/refundOrder) |
| `@utils/orderDetail`               | [src/utils/orderDetail.ts](../../src/utils/orderDetail.ts)                             | `parseOrderDetailFromText`, type `OrderDetail` (đọc breakdown đơn) |

## Ghi chú

- **Mắt xích đã tồn tại từ trước** (không phải skill này sinh): page object `OrderHistoryPage`
  đã có sẵn (phục vụ cluster refund/cancel) và **đã đăng ký** trong `pages.fixture.ts`; Skill 2 chỉ
  **mở rộng** thêm locator/action đọc-only + helper filter sub-popover, **không** sửa fixture.
- **Thư mục spec mới**: `tests/regression/order-history/` do Skill 2 tạo (trước đó chưa có).
- **Không có helper `src/utils/i18nOrderHistory.ts` trong luồng functional này** — file đó thuộc
  luồng i18n riêng ([TC-i18n-order-history-vietnamese-scan.spec.ts](../../tests/regression/i18n/TC-i18n-order-history-vietnamese-scan.spec.ts)),
  sẽ là đầu ra của Skill i18n-vietnamese-scan, không phải spec functional này.
- **Report sinh khi chạy** `npx playwright test tests/regression/order-history/`. Lần chạy thật:
  **20/20 pass** (dev server `:1420` có tắt/bật lại giữa phiên nhưng cuối cùng chạy đủ).

---

---

title: Chi tiết luồng code-gen — Order History (/order-history)
expands: docs/codegen-flow/order-history-flow.md
generated-at: 2026-07-06
skill: codegen-flow-detail (4/4)
---

# Chi tiết luồng code-gen — Order History (`/order-history`)

> Đầu ra **Skill 4/4** (`codegen-flow-detail`): mở rộng bản đồ file→file của
> [order-history-flow.md](../order-history/order-history-code-detail.md) thành giải thích **từng đoạn
> code + công nghệ**. Mọi đoạn trích copy đúng từ file thật (kèm số dòng, verify 2026-07-06).

## Tổng quan công nghệ

| Công nghệ                                 | Vai trò trong luồng gen                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Linear (MCP `linear-server`)**          | Đọc spec gốc; phiên này chưa auth → fallback bản offline `docs/linear/portal-order-history.md`                                                           |
| **Playwright MCP** (`mcp__playwright__*`) | Quét UI thật khi gen: `browser_navigate`, `browser_snapshot` (a11y tree), `browser_click`, `browser_evaluate` → lấy label/role/selector THẬT (không bịa) |
| **Playwright Test** (`@playwright/test`)  | Runner chạy spec; `expect`, `test()`, `test.describe`, `test.skip`, locator engine (`getByRole`/`getByText`/`getByPlaceholder`)                          |
| **Page Object Model**                     | `OrderHistoryPage extends BasePage` — gói locator + action, spec không chạm DOM trực tiếp                                                                |
| **Custom fixtures** (`mergeTests`)        | `@fixtures/index` bơm `orderHistoryPage` vào mỗi test                                                                                                    |
| **TypeScript path alias**                 | `@fixtures`, `@pages`, `@utils`, `@/` (khai trong `tsconfig.json` → resolve khi `tsc`/Playwright chạy)                                                   |
| **shadcn/Radix UI** (app đích)            | Dialog/Popover render `role="dialog"`, checkbox render `role="checkbox"` → quyết định cách viết locator                                                  |
| **Tag system**                            | `Tag.REGRESSION`, `Tag.UI` chèn vào title để lọc `--grep`                                                                                                |
| **Reporters**                             | list / html / json / junit / **allure-playwright** (khai trong `playwright.config.ts`)                                                                   |

## Chi tiết theo file

### 1. `docs/linear/portal-order-history.md` → `docs/features/order-history.md` (Skill 1)

- **Vai trò:** nguồn business rules. Skill 1 đọc spec + dùng **Playwright MCP** quét màn thật.
- **Công nghệ quét (MCP):** ví dụ lệnh đã chạy khi gen —
  ```js
  await page.goto('http://localhost:1420/order-history'); // browser_navigate
  // browser_snapshot → a11y tree: heading "Order History", button "Filter",
  //   textbox "Search order ID, customer name or phone", list các <a href="/order-history/…">
  ```
- **Giải thích:** `browser_snapshot` trả về cây accessibility (role + name) — chính là nguồn để
  chọn `getByRole('heading', {name:'Order History'})`, `getByRole('button',{name:'Filter'})`…
  Detail panel quét được: `Order Information / Order Summary / Service Details / Payment Details / Order Note`,
  và bộ nút theo trạng thái (Settled → Receipt+Refund; Unsettled → Adjust Tip/Receipt/Re-Open/Cancel).

### 2. `docs/testcases/order-history-testcases.md` (Skill 2)

- **Vai trò:** liệt kê 21 TC, mỗi TC map 1-1 một `test()`. Đây là **nguồn sự thật** khi sinh code.
- **Công nghệ:** không phải code — là bảng Markdown; nhưng ràng buộc "mỗi TC → 1 `test()`" ép cấu trúc spec.

### 3. `src/pages/pos/OrderHistoryPage.ts` — page object (Skill 2 MỞ RỘNG)

- **Vai trò:** khai locator + action đọc-only cho spec. Kế thừa `BasePage` (có `goto()`).
- **Khai báo locator** ([dòng 28-48](../../src/pages/pos/OrderHistoryPage.ts#L28-L48)):

  ```ts
  this.searchInput = page.getByPlaceholder(/search order id/i);
  this.filterButton = page.getByRole('button', { name: /^Filter$/i });
  this.receiptButton = page.getByRole('button', { name: /^Receipt$/i });
  this.emptyDetailMessage = page.getByText(/Select an order to view details/i);
  this.orderCards = page.locator('a[href*="/order-history/"]');
  ```

  - **Giải thích:** `getByPlaceholder(/search order id/i)` phân biệt ô search của trang với ô
    "Search..." toàn cục ở header (điểm sửa sau khi chạy thử). `orderCards` bám vào `href` route
    `/order-history/<uuid>` — bền hơn text vì card render từng ký tự mã đơn thành `<generic>` riêng.
  - **Công nghệ:** Playwright locator engine + regex (case-insensitive, anchored `^…$`).

- **Chọn đơn theo trạng thái** ([dòng 279-286](../../src/pages/pos/OrderHistoryPage.ts#L279-L286)):

  ```ts
  async openFirstOrderWithStatus(statusText: RegExp): Promise<boolean> {
    const match = this.orderCards.filter({ hasText: statusText }).first();
    if ((await match.count()) === 0) return false;
    await match.click();
    await expect(this.page).toHaveURL(/\/order-history\/[^?]+/);
    ...
  ```

  - **Giải thích + bài học gen:** ban đầu dùng `/Settled/` → **dính** "Un**settled**" (đơn đầu list
    là Unsettled, không có nút Refund) → test fail. Sửa caller sang `/Successful - Settled/`. Đây là
    kiểu lỗi chỉ lộ ra khi **chạy thật**, minh hoạ vì sao skill 2 phải run spec chứ không chỉ gen.
  - **Công nghệ:** `Locator.filter({hasText})` + `.first()` + `toHaveURL` (assert điều hướng).

- **Filter sub-popover** ([dòng 323-335](../../src/pages/pos/OrderHistoryPage.ts#L323-L335)):

  ```ts
  async openFilterPaymentMethods(): Promise<void> {
    await this.filterDialog.getByRole('button', { name: /Select payment method/i }).click();
    // exact — "Card" would otherwise also match the "Gift Card" checkbox.
    await expect(this.page.getByRole('checkbox', { name: 'Card', exact: true })).toBeVisible();
  }
  ```

  - **Giải thích:** Payment/Status **không** render sẵn trong dialog Filter — phải click nút
    "Select payment method"/"Select status" để mở **popover thứ hai** (`role="dialog"` khác) chứa
    `role="checkbox"`. `exact:true` vì accessible-name "Card" là substring của "Gift Card" (đã gây
    strict-mode violation khi chạy thử → phải thêm `exact`).
  - **Công nghệ:** shadcn/Radix Popover + Checkbox; Playwright `getByRole('checkbox',{exact})`.

### 4. `tests/regression/order-history/TC-order-history.spec.ts` — spec (Skill 2)

- **Import & setup** ([dòng 1-23](../../tests/regression/order-history/TC-order-history.spec.ts#L1-L23)):

  ```ts
  import { test, expect } from '@fixtures/index';
  import { Tag } from '@/types/testTags';
  ...
  test.describe(`Order History — functional ${Tag.REGRESSION} ${Tag.UI}`, () => {
    test.beforeEach(async ({ orderHistoryPage }) => {
      await orderHistoryPage.goto();
      await orderHistoryPage.waitForReady();
    });
  ```

  - **Công nghệ:** `@fixtures/index` (alias → `src/fixtures/index.ts` `mergeTests(pagesFixture, apiFixture)`)
    bơm `orderHistoryPage`. Tag chèn vào tên describe để `playwright test --grep @regression` lọc được.

- **Ví dụ TC đọc-only an toàn** (TC-OH-18, mở dialog Refund rồi Escape, KHÔNG confirm):

  ```ts
  const found = await orderHistoryPage.openFirstOrderWithStatus(/Successful - Settled/i);
  test.skip(!found, 'No settled order to open the refund dialog on');
  test.skip(!(await orderHistoryPage.canRefund()), 'Refund not available on this order');
  await orderHistoryPage.openRefundDialogOnly();
  await orderHistoryPage.dismissActiveDialog(); // Escape — không bấm Confirm
  ```

  - **Giải thích:** app dùng **1 worker + backend thật dùng chung** → không được xác nhận hành động
    phá huỷ. `test.skip` làm test tự bỏ qua khi data không có đơn đúng trạng thái (bền với seed đổi).
  - **Công nghệ:** Playwright `test.skip(condition, reason)` (skip động tại runtime).

### 5. `playwright.config.ts` — cấu hình chạy

- **Vai trò:** `baseURL` (`http://localhost:1420`), `workers:1` (chống race backend chung),
  `trace:'on'`, `screenshot:'on'`, và 5 reporter (list/html/json/junit/allure).
- **Công nghệ:** allure-playwright → `reports/allure-results`; timezone lái theo `SHOP` để "Today" khớp.

## So với bản map (Skill 3)

- Skill 3 chỉ vẽ **file → file**. Bản này đi tới **từng đoạn code + số dòng** và nêu **công nghệ**
  đằng sau mỗi mắt xích: MCP a11y snapshot → cách chọn locator; Radix popover 2 lớp → vì sao cần
  `openFilterPaymentMethods`; strict-mode "Card"/"Gift Card" → vì sao `exact:true`; single-worker
  backend → vì sao test chỉ mở-rồi-Escape. Đây là các quyết định **chỉ thấy khi chạy thật**, không
  suy ra được từ sơ đồ file→file.

---

## i18n Notes (fold-in from docs/i18n/order-history-translation-map.md)

# Bản đồ dịch thuật — Trang Lịch sử đơn hàng (`/order-history`)

> **Nguồn:** xác minh động bằng MCP Playwright trên app đang chạy (`http://localhost:1420/order-history`, 2026-07-02) + `data-tsd-source` (file:line của app repo) đọc trực tiếp từ DOM.
> **Trạng thái app khi quét:** đã bật **Tiếng Việt** (đổi qua `/settings/language`, điều hướng client-side bằng router).
> **Dùng để:** làm đặc tả (spec) cho tính năng quét tiếng Việt động trang Lịch sử đơn hàng — xem [`vietnamese-scan-flow.md`](vietnamese-scan-flow.md) mục Order History. Song song với [`home-translation-map.md`](home-translation-map.md).
>
> **🔎 Trạng thái quét (2026-07-06, TC-i18n-screen-compare):** trang chính `/order-history` — ❌ chưa dịch (text) **0** · ⚠️ sai chuẩn **0** · ✅ đúng chuẩn **10** · 📐 cắt chữ **1** ("Bộ lọc"). Còn lại: format ngày kiểu Anh (§3) + aria-label EN (§4) — report-only. Kết quả đầy đủ: [`order-history-i18n-result.md`](../order-history/order-history-test-cases.md) · Report trực quan: `reports/order-history/compare.html`.

Ký hiệu:

- ✅ **Đã xác minh** mở được trên app thật qua MCP (kèm chuỗi render thực tế).
- 🔁 **Cần chọn 1 đơn** (mở trang chi tiết) trước khi mở.
- ⚠️ **HARDCODE / chưa dịch** — chuỗi tiếng Anh hiển thị giữa UI tiếng Việt, là lỗi dịch thật cần fix.
- 🔇 **aria/label icon còn tiếng Anh** — nhãn trợ năng chưa dịch (a11y + điểm mù scan).
- 🕳️ **Điểm mù scan** — chuỗi tiếng Anh mà `detectScope` hiện KHÔNG bắt được (giải thích ở §5).

---

## 0. Tổng quan luồng động Lịch sử đơn hàng (xác minh qua MCP)

```
/order-history
├── HEADER (giống Home): sidebar · Đơn đang chờ · Lịch sử đơn hàng · Lịch hẹn · Quét mã · Tìm kiếm... · 🔔 3 icon
├── THANH LỌC trên cùng:
│   ├── DatePicker (nút "06/25/2026 - 07/02/2026", aria "icon-calendar")  → popover lịch 2 tháng
│   ├── Nút "Bộ lọc"  → dialog Bộ lọc (Sắp xếp / Nhân viên / Phương thức TT / Trạng thái)
│   └── Ô tìm kiếm "Tìm mã đơn hàng, tên khách hàng hoặc SĐT" (+ icon aria "Search...")
├── DANH SÁCH ĐƠN (trái): tiêu đề ngày ("Jul 1, 2026") + thẻ đơn (mã · trạng thái · SĐT · phương thức TT · tiền · nhân viên · giờ)
└── PANEL CHI TIẾT (phải, khi chọn 1 đơn):
    ├── "Đơn hàng #OD…" + nút "Hoá đơn" / "Hoàn tiền"
    ├── Thông tin đơn hàng · Tóm tắt đơn hàng · Chi tiết dịch vụ · Chi tiết thanh toán · Ghi chú đơn hàng
    ├── Dialog "Chi tiết hoá đơn" (tái dùng receipt-preview của /settings/receipt)  🔁
    └── Dialog "Hoàn tiền" (order-refund-confirm-dialog)  🔁
```

**Điều kiện mở:**

- **Không cần chọn đơn:** DatePicker (lịch), dialog Bộ lọc (+ 4 dropdown con), ô tìm kiếm.
- **Cần chọn 1 đơn (mở chi tiết):** nút Hoá đơn → dialog hoá đơn; nút Hoàn tiền → dialog hoàn tiền.

---

## 1. Chuỗi tĩnh đã dịch OK (verify hiển thị Tiếng Việt)

| Vùng                     | Chuỗi (EN gốc)                                      | Render thực tế (VN)                                                       |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------- |
| Tiêu đề trang            | Order History                                       | **Lịch sử đơn hàng** ✅                                                   |
| Nút lọc                  | Filter                                              | **Bộ lọc** ✅                                                             |
| Ô tìm kiếm (placeholder) | Search order ID, customer name or phone             | **Tìm mã đơn hàng, tên khách hàng hoặc SĐT** ✅                           |
| Panel rỗng               | Select an order to view details                     | **Chọn một đơn hàng để xem chi tiết.** ✅                                 |
| Trạng thái đơn (thẻ)     | Success - Unsettled / Success - Settled / Cancelled | **Thành công - Chưa quyết toán / Thành công - Đã quyết toán / Đã huỷ** ✅ |
| Nút lịch                 | Today / Cancel / Apply                              | **Hôm nay / Huỷ / Áp dụng** ✅                                            |

### 1a. Dialog "Bộ lọc" — đã dịch sạch ✅

| Element                         | Chuỗi (VN)                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading / nút đóng              | **Bộ lọc** · **Đóng**                                                                                                                                                         |
| Sắp xếp theo → option           | **Sắp xếp theo** · **Ngày tạo** · **Cập nhật gần nhất**                                                                                                                       |
| Nhân viên                       | **Nhân viên** · nút **Chọn nhân viên** · placeholder **Tìm nhân viên**                                                                                                        |
| Phương thức thanh toán → option | **Phương thức thanh toán** · **Thẻ** · **Tiền mặt** · **Thẻ quà tặng** · **Khác**                                                                                             |
| Trạng thái → option             | **Trạng thái** · Thành công - Chưa quyết toán · Thành công - Đã quyết toán · Đã huỷ · Đang huỷ · Lỗi huỷ · Hoàn tiền một phần · Đã hoàn tiền · Đang hoàn tiền · Lỗi hoàn tiền |
| Nút dưới                        | **Xoá** · **Xác nhận**                                                                                                                                                        |

### 1b. Panel chi tiết đơn — đã dịch sạch ✅

`Đơn hàng #OD…` · `Hoá đơn` · `Hoàn tiền` · `Thông tin đơn hàng` · `Trạng thái` · `Mã đơn` · `Nhân viên thu ngân` · `Ngày đặt hàng` · `Khách hàng` · `Điện thoại` · `Tóm tắt đơn hàng` · `Tạm tính` · `Tổng giảm giá` · `Thuế` · `Tip` · `Tổng cộng` · `Chi tiết dịch vụ` · `Không có thông tin tiền boa.` · `Chi tiết thanh toán` · `Ghi chú đơn hàng` · `Không có ghi chú cho đơn hàng này.`

### 1c. Dialog "Hoàn tiền" — vỏ dialog đã dịch, ⚠️ dropdown còn EN (VP-2312)

`Hoàn tiền` · `Nhập số tiền hoặc chọn lần thanh toán bạn muốn hoàn.` · `Chọn dịch vụ/sản phẩm` · `Tất cả dịch vụ` · `Số tiền hoàn` · `Phương thức hoàn tiền` · `Chọn phương thức thanh toán để hoàn` · `Chọn lý do hoàn tiền` · `Vui lòng chọn lý do hoàn tiền` · `Huỷ` ✅

> ⚠️ **VP-2312:** khi MỞ dropdown **"Phương thức hoàn tiền"**, các option lại hiển thị tiếng Anh: **"Cash (Remain $150.00)"** (mong đợi **"Tiền mặt (Còn lại $150.00)"**). Xem §2 #10.
> Nguồn: `order-history/-order-history-detail/-refund/order-refund-confirm-dialog.tsx`.

### 1d. Nút hành động theo TRẠNG THÁI đơn (xác minh live 2026-07-02)

Panel chi tiết hiển thị **bộ nút khác nhau tuỳ trạng thái**. Tất cả nhãn nút + dialog đều **đã dịch** ✅.

| Trạng thái đơn                   | Nút hành động                                           |
| -------------------------------- | ------------------------------------------------------- |
| Thành công - **Chưa quyết toán** | `Chỉnh tip` · `Hoá đơn` · `Mở lại đơn hàng` · `Huỷ đơn` |
| Thành công - **Đã quyết toán**   | `Hoá đơn` · `Hoàn tiền`                                 |
| **Đã huỷ**                       | `Hoá đơn`                                               |
| **Đã hoàn tiền**                 | `Hoá đơn`                                               |

> 5 trạng thái còn lại (Đang huỷ · Lỗi huỷ · Hoàn tiền một phần · Đang hoàn tiền · Lỗi hoàn tiền) là **trạng thái hệ thống tạm thời** — không có dữ liệu lịch sử để mở, không có biến thể nút riêng.

**Dialog theo nút (đều đã dịch sạch ✅):**

| Dialog          | Chuỗi chính (VN)                                                                                                                                | Nguồn                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Chỉnh tip       | `Chỉnh tip` · `Tip hiện tại: $X` · `Nhập số tiền` · preset $20/$50/$100/$200 · keypad · `Lưu`                                                   | `dialog-secondary.tsx`                    |
| Mở lại đơn hàng | `Mở lại đơn hàng?` · `Mở lại đơn hàng này sẽ cho phép bạn chỉnh sửa các mục hoặc thanh toán trước khi quyết toán.` · `Huỷ` · `Xác nhận`         | `alert-dialog.tsx`                        |
| Huỷ đơn         | `Huỷ đơn` · `Bạn có chắc muốn huỷ đơn hàng này? Tất cả thanh toán sẽ bị huỷ.` · `Chọn lý do huỷ` · `Giữ đơn hàng` · `Xác nhận huỷ`              | `-cancel/order-cancel-confirm-dialog.tsx` |
| Huỷ đơn › Lý do | `Khách hàng yêu cầu` · `Vấn đề dịch vụ` · `Đơn hàng sai` · `Thanh toán trùng lặp` · `Lỗi khuyến mãi / giảm giá` · `Nhân viên nhầm lẫn` · `Khác` | —                                         |

> ⚠️ **CẢNH BÁO tự động hoá:** dialog "Huỷ đơn" có nút xác nhận **"Xác nhận huỷ"** (chứa chữ "huỷ") — hàm `dismiss()` khi đóng dialog **tuyệt đối không** bấm nút chứa "xác nhận"/"confirm", chỉ dùng Escape / nút "Đóng"/"Giữ đơn hàng", tránh vô tình huỷ đơn thật.

### 1e. Nút trong "Chi tiết hoá đơn": In / Gửi SMS / Gửi Email (xác minh live)

| Nút           | Hành vi                | Chuỗi (VN)                                                           | Ghi chú                                                                        |
| ------------- | ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **In**        | Gọi print gốc (native) | nhãn `In` ✅                                                         | Trong trình duyệt không bật toast/dialog app → không có chuỗi cần dịch.        |
| **Gửi SMS**   | Mở dialog nhập SĐT     | `SĐT khách hàng` · placeholder `Nhập điện thoại` · `Gửi` · `Đóng` ✅ | ⚠️ aria-label **"Clear input"** (nút xoá ô nhập) còn tiếng Anh — a11y, xem §4. |
| **Gửi Email** | Mở dialog nhập email   | `Email khách hàng` · placeholder `Nhập email` · `Gửi` · `Đóng` ✅    | Sạch.                                                                          |

---

## 2. ⚠️ Chuỗi HARDCODE / chưa dịch — mục tiêu chính scan phải bắt

Đây là chuỗi tiếng Anh **hiển thị giữa UI Tiếng Việt** = lỗi dịch thật.

| #   | Vùng                                                | Text (EN)                                                                                                       | Nguồn (data-tsd-source)                                                                 |                       Scan bắt?                       |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | :---------------------------------------------------: |
| 1   | Dialog Hoá đơn · khách                              | **Current points:**                                                                                             | `settings/receipt/-receipt-preview/receipt-preview-customer.tsx:51`                     |         🕳️ (thiếu từ điển — đã thêm `points`)         |
| 2   | Dialog Hoá đơn · khách                              | **Total visit:**                                                                                                | `receipt-preview-customer.tsx:51`                                                       |                     ✅ (`total`)                      |
| 3   | Dialog Hoá đơn · dòng dịch vụ                       | **Staff: \<tên\>**                                                                                              | `receipt-preview-service-item.tsx:272`                                                  |                     ✅ (`staff`)                      |
| 4   | Dialog Hoá đơn · ghi chú                            | **Business Note:**                                                                                              | `receipt-preview-note.tsx:34`                                                           |                ✅ (`business`,`note`)                 |
| 5   | Dialog Hoá đơn · chính sách                         | **By signing below, you acknowledge that the services were provided to your satisfaction. No refunds allowed.** | `receipt-preview-policy.tsx:12`                                                         |                 ✅ (câu + `service`)                  |
| 6   | Chi tiết thanh toán                                 | **Amount: $44.00**                                                                                              | `order-history-detail/order-history-detail-payment.tsx:305`                             |                     ✅ (`amount`)                     |
| 7   | Chi tiết thanh toán + Hoá đơn                       | **Got: $40.00 (Change: $0.00 - Tip: $0.00)**                                                                    | `order-history-detail-payment.tsx:305`                                                  |              🕳️ **Cố ý BỎ QUA** (xem §6)              |
| 8   | Thẻ đơn + Hoá đơn                                   | **Cash / Card / Card, Cash** (phương thức TT)                                                                   | `order-history-list/order-history-item.tsx:104`                                         |       🕳️ (nằm trong data-zone thẻ đơn — xem §6)       |
| 9   | Error boundary (khi mất kết nối/backend lỗi)        | **Failed to fetch**                                                                                             | trang lỗi chung (`Lỗi` / `Đã có lỗi xảy ra` đã dịch, chi tiết là message exception thô) |     ⚠️ borderline — message kỹ thuật, nên ẩn/dịch     |
| 10  | Dialog Hoàn tiền · dropdown "Phương thức hoàn tiền" | **Cash (Remain $150.00)** (mong đợi "Tiền mặt (Còn lại $150.00)")                                               | `-refund/order-refund-confirm-dialog.tsx` (option dropdown phương thức)                 | ✅ `scanRefundMethod()` (VP-2312) — bộ dò chuyên biệt |
| 11  | Panel chi tiết · thời gian                          | **Cập nhật cuối: Jun 30, 2026 03:58 AM** + tiêu đề nhóm ngày danh sách **"Jul 1, 2026"**                        | `components/ui/card.tsx:162` · `order-history-list.tsx:128`                             |   ✅ `EN_DATETIME` (VP-2313) — trước là 🕳️, xem §3    |

> ⚠️ **Điểm quan trọng:** phương thức thanh toán ở **dialog Bộ lọc** ĐÃ dịch (`Thẻ`/`Tiền mặt`/`Thẻ quà tặng`/`Khác`) nhưng ở **thẻ đơn + hoá đơn** vẫn là `Cash`/`Card`. Không nhất quán → cần dịch enum phương thức TT dùng chung.
> 💡 Dialog "Chi tiết hoá đơn" **tái dùng** các component `settings/receipt/-receipt-preview/*` → lỗi #1–#5 dùng chung với màn **Settings → Hoá đơn** (`/settings/receipt`); sửa 1 lần là hết cả 2 nơi.

---

## 3. 🌐 Lịch (DatePicker) — grid vẫn TIẾNG ANH ⚠️

Nút mở lịch hiển thị dải ngày; popover là `[role="dialog"]` (qua `components/ui/popover.tsx:111`). Các **nút** dưới lịch đã dịch (Hôm nay/Huỷ/Áp dụng) **NHƯNG lưới lịch react-day-picker chưa set `locale` Tiếng Việt**, nên:

| Vùng lịch       | Hiển thị (EN)                                                                | Loại                        |
| --------------- | ---------------------------------------------------------------------------- | --------------------------- |
| Tiêu đề tháng   | **June 2026** · **July 2026**                                                | text 🕳️                     |
| Nhãn thứ        | **Mo Tu We Th Fr Sa Su**                                                     | text 🕳️                     |
| aria điều hướng | **Go to the Previous Month** · **Go to the Next Month** · **Navigation bar** | aria ✅ (`previous`/`next`) |
| aria ô ngày     | **Monday, June 1st, 2026** · **Today, Thursday, July 2nd, 2026, selected** … | aria 🕳️                     |

> 🐞 **Lỗi thật:** cả lưới lịch tiếng Anh giữa app Tiếng Việt. Vì tháng/thứ **không nằm trong từ điển UI** nên `detectScope` không tự bắt phần text → xem cách xử lý ở §5 (scanner lịch chuyên biệt bắt tên tháng tiếng Anh). aria "Previous/Next Month" thì bị bắt vào mục aria (chỉ báo cáo).

Ngoài ra tiêu đề ngày trong danh sách (`order-history-list.tsx:128`) và dòng "Cập nhật cuối:" (`components/ui/card.tsx:162`) render ngày kiểu Anh: **"Jul 1, 2026"**, **"Cập nhật cuối: Jun 30, 2026 03:58 AM"** — lỗi định dạng ngày (locale) — **[VP-2313](https://linear.app/fastboy/issue/VP-2313)**.

> 🐞 **VP-2313 (nay đã tự bắt):** trước đây là điểm mù 🕳️ vì `detectScope` coi ngày trơ là DATA. Nay `scanOrderHistoryDetail()` có bộ dò `EN_DATETIME` (tháng viết tắt + năm, hoặc giờ HH:MM AM/PM) quét panel chi tiết + tiêu đề nhóm ngày → gộp vào `ui`. Cùng lớp bug với lưới lịch (§3 phía trên, VP-2198). Sửa gốc: set `locale` VN cho hàm format ngày dùng chung.

---

## 4. 🔇 aria/label icon còn tiếng Anh (a11y)

| Vị trí                     | aria-label                                             | Nguồn                                                                |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Nút mở lịch                | **icon-calendar**                                      | `components/icon.tsx:64` — Icon lấy tên icon làm aria-label mặc định |
| Icon ô tìm kiếm            | **Search...**                                          | `components/icon.tsx:64`                                             |
| Dòng dịch vụ (chi tiết)    | **service-name** · **price** · **note** · **discount** | field aria trong panel chi tiết dịch vụ                              |
| Dialog Gửi SMS · nút xoá ô | **Clear input**                                        | nút xoá SĐT trong dialog Gửi SMS (§1e)                               |

> Không có chữ hiển thị để dịch, nhưng screen reader đọc "icon-calendar" / "Search..." → nên thêm `aria-label` đã dịch. Chỉ báo cáo, không làm fail gate (giống mục 🔇 của Home).

---

## 5. Ánh xạ sang implementation quét động ([`i18nOrderHistory.ts`](../../src/utils/i18nOrderHistory.ts))

| Hàm / hằng                              | Bao phủ                                                        | Cách mở (đã verify)                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORDER_HISTORY_POPUP_DEFS` (DatePicker) | Lịch (aria + screenshot)                                       | click nút có aria `icon-calendar` / nút chứa dải `dd/mm/yyyy`                                                                                                                                                               |
| `scanOrderHistoryFilter()`              | Dialog Bộ lọc + 4 dropdown con                                 | click "Bộ lọc" → lần lượt mở Nhân viên / Phương thức TT / Trạng thái (popover `[role=dialog]`) + Sắp xếp (listbox)                                                                                                          |
| `scanOrderHistoryDatePicker()`          | **Grid lịch tiếng Anh** (§3)                                   | mở lịch → dò tên tháng/thứ tiếng Anh (bắt được điểm mù §3)                                                                                                                                                                  |
| `scanOrderHistoryDetail()`              | Panel chi tiết + Hoá đơn + Hoàn tiền + **2 bộ dò chuyên biệt** | click thẻ đơn đầu → quét body → mở "Hoá đơn" → quét → mở "Hoàn tiền" → quét → (VP-2312) mở dropdown "Phương thức hoàn tiền" → quét → (VP-2313) dò ngày/giờ EN trong panel                                                   |
| `scanRefundMethod()` (VP-2312)          | Dropdown **"Phương thức hoàn tiền"** trong dialog Hoàn tiền    | mở combobox (placeholder "Chọn phương thức thanh toán để hoàn") → dò option EN "Cash (Remain $150.00)" bằng bộ dò phương thức TT (Cash/Card/Gift Card/Other/Check/Remain…) — bỏ qua luật tiền-trong-ngoặc của `detectScope` |
| `EN_DATETIME` (VP-2313)                 | **Ngày/giờ định dạng Anh** trong panel + tiêu đề nhóm ngày     | regex tháng viết tắt (Jan…Dec) + năm, hoặc giờ HH:MM AM/PM → gộp vào `ui` của panel chi tiết. Cùng cơ chế `EN_MONTHS` cho lưới lịch (§3)                                                                                    |

**Điều chỉnh `detectScope`** (nhỏ, an toàn): thêm `points` (bắt "Current points:" #1) và `remain`/`remaining` (bắt "Remain" ngoài ngoặc — VP-2312) vào từ điển UI. KHÔNG nới luật tiền-trong-ngoặc / ngày-đơn (2 điểm mù được xử lý bằng bộ dò chuyên biệt trong `scanOrderHistoryDetail`, tránh false-positive trên toàn app).

> Mỗi trigger khai **nhiều fallback** (aria/role/text EN→VN→css) vì lúc quét app đang ở Tiếng Việt, nhãn EN gốc không khớp.

---

## 6. KHÔNG phải lỗi dịch — scan cố ý BỎ QUA

- Mã đơn `OD260630-…`, tiền `$40.00`, SĐT ẩn `***-***-2052`, tên khách/nhân viên (data trong thẻ đơn — `DATA_ZONE_SELECTORS` có `a[href*="/order-history/"]`).
- Dòng **"Got: $40.00 (Change: $0.00 - Tip: $0.00)"**: khớp luật parenthetical-money → coi là data/format, **thống nhất với** [`home-translation-map.md`](home-translation-map.md) §6 (mục "(Received $0.01 - Change $0.00)"). Nếu về sau muốn dịch nhãn `Got/Change/Tip` thì phải nới luật này cho CẢ hai trang.
- Phương thức TT `Cash`/`Card` ở thẻ đơn nằm trong data-zone → scan không bắt; ghi nhận thủ công ở §2 #8 là điểm cần dịch enum dùng chung.

> Đúng Rule 11 bộ quy tắc dịch — token giá trị/format không dịch. Một **câu hoàn chỉnh** có chèn ngày thì VẪN là UI cần dịch (ví dụ chính sách #5).
