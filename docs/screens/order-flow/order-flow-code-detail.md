---
title: Code Detail — Order Flow
generated-at: 2026-07-17
---

# Order Flow — Code Detail

> Ghi chú phạm vi: "Order Flow" là tài liệu Linear/test-case lớn nhất (Home → Cart →
> Checkout → Split Order → quản lý Order), **không có một spec file duy nhất**. Nó map
> tới nhiều file order/checkout/split-order theo đúng quy ước ở `docs/screens/README.md`
> (một số màn lớn được chia thành nhiều spec theo tính năng con thay vì 1 file 1 màn).

## Flow Map

### Sơ đồ (file → file)

```
docs/linear/order-flow.md (+ order-management.md, order-pending.md,
split-order.md, portal-order-history.md, portal-support-edit-completed-order.md)
  └─(feature-spec + scan Playwright MCP)→ docs/screens/order-flow/order-flow-test-cases.md
        (Feature Overview §1-6 + Test Cases §7, TC-ORDERFLOW-01..75)
        │
        ├─→ src/pages/pos/HomePage.ts            (page object: staff/service/cart/customer)
        ├─→ src/pages/pos/CheckoutPage.ts         (page object: /checkout, 4 payment methods)
        ├─→ src/pages/pos/SplitOrderPage.ts       (page object: /order/:id/split-order)
        ├─→ src/pages/pos/OrderHistoryPage.ts     (page object: order list/detail/status)
        ├─→ src/pages/pos/OrderPendingPage.ts     (page object: pending orders sidebar)
        ├─→ src/components/modal/QuickPayDialog.ts (component: Quick Pay dialog)
        │
        ├─→ tests/regression/pos/order-flow/create-order.spec.ts   (TC-ORDERFLOW-01..24)
        ├─→ tests/regression/pos/order-flow/checkout.spec.ts       (TC-ORDERFLOW-39..53)
        └─→ tests/regression/pos/order-flow/split-order.spec.ts    (TC-ORDERFLOW-25..38)
              │
              └─(dùng chung)→ src/fixtures/index.ts → src/fixtures/pages.fixture.ts
                    (khởi tạo homePage / checkoutPage / splitOrderPage per test)
              │
              └─(khi chạy)→ test-results/ , playwright-report/ (Playwright HTML reporter mặc định)
```

### Bảng mắt xích

| #   | File nguồn                                             | →   | File đích                                                                                          | Khâu tạo                                                         | Ghi chú                                                                                          |
| --- | ------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `docs/linear/order-flow.md` (+ 5 doc Linear liên quan) | →   | `docs/screens/order-flow/order-flow-test-cases.md`                                                 | feature-spec (đọc Linear + quét Playwright MCP `localhost:1420`) | Test-cases doc tự khai nguồn ở §8 "Nguồn tham chiếu"                                             |
| 2   | `order-flow-test-cases.md` (TC-ORDERFLOW-01..24)       | →   | `src/pages/pos/HomePage.ts`, `src/components/modal/QuickPayDialog.ts`                              | testcase-gen (page object)                                       | Comment đầu file spec trỏ ngược 2 file này                                                       |
| 3   | `order-flow-test-cases.md` (TC-ORDERFLOW-39..53)       | →   | `src/pages/pos/CheckoutPage.ts`                                                                    | testcase-gen (page object)                                       |                                                                                                  |
| 4   | `order-flow-test-cases.md` (TC-ORDERFLOW-25..38)       | →   | `src/pages/pos/SplitOrderPage.ts`                                                                  | testcase-gen (page object)                                       |                                                                                                  |
| 5   | Page objects trên                                      | →   | `tests/regression/pos/order-flow/create-order.spec.ts`, `checkout.spec.ts`, `split-order.spec.ts`  | testcase-gen (spec)                                              | 3 spec file thay cho "1 file duy nhất" vì phạm vi quá lớn                                        |
| 6   | 3 spec file                                            | →   | `src/fixtures/index.ts` (`mergeTests(pagesFixture, apiFixture)`) → `src/fixtures/pages.fixture.ts` | fixtures dùng chung                                              | Cung cấp `homePage`, `checkoutPage`, `splitOrderPage` đã khởi tạo sẵn                            |
| 7   | Khi chạy spec                                          | →   | `playwright-report/` / `test-results/`                                                             | Playwright Test runner                                           | Không có report riêng cho order-flow như skill `screen-suite-report` (chưa gộp thành 1 test lớn) |

### Ghi chú

- **Không có 1 spec file duy nhất cho "order-flow"** — đúng như task yêu cầu xác nhận:
  logic được chia theo tính năng con (`create-order.spec.ts`, `checkout.spec.ts`,
  `split-order.spec.ts`) trong cùng thư mục `tests/regression/pos/order-flow/`, mỗi file
  cover một dải TC-ORDERFLOW-xx trong test-cases.md.
- **Mắt xích còn thiếu / chưa xác nhận tồn tại**:
  - Không tìm thấy page object/spec riêng cho **Order Detail theo status** (Settled/
    Canceled/Refunded/Partial Refunded), **Adjust Tip**, **Refund/Partial Refund dialog**,
    **Reopen Order**, **Split Tip dialog** — các TC tương ứng (TC-ORDERFLOW-34-38,
    52-53, 55-70) trong `order-flow-test-cases.md` đều đánh dấu `[LINEAR-ONLY]` và
    không có code test thực thi kèm theo trong 3 spec file trên (đã Grep toàn bộ `tests/`,
    không thấy file nào implement các case này ngoài phần đã liệt kê).
  - Không có `OrderDetailPage.ts` hay `RefundDialog.ts`/`AdjustTipDialog.ts` trong
    `src/pages/pos/` hoặc `src/components/modal/` (đã Glob, chỉ thấy `OrderHistoryPage.ts`
    và `OrderPendingPage.ts`).
  - Không có report tổng hợp kiểu `reports/order-flow/order-flow-scan.html` (khác với màn
    Home đã có luồng "1 test lớn + report" theo skill `screen-suite-report`) — order-flow
    hiện chỉ chạy qua Playwright HTML reporter mặc định.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                       | Vai trò trong luồng gen                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@playwright/test`)            | Chạy spec, `test.describe`/`test()`, `expect()` assertion                                                                                                                                               |
| Playwright MCP                                  | Quét UI thật (`localhost:1420`) để xác nhận locator/role/text trước khi viết page object (ghi rõ trong comment đầu mỗi file)                                                                            |
| Custom fixtures (`mergeTests`)                  | `src/fixtures/index.ts` gộp `pagesFixture` + `apiFixture` thành 1 entrypoint `test`/`expect` duy nhất, tự tiêm `homePage`/`checkoutPage`/`splitOrderPage` vào từng test                                 |
| TypeScript path alias                           | `@fixtures/index`, `@pages/BasePage`, `@components/BaseComponent`, `@constants/urls`, `@configs/constants/timeouts`, `@utils/logger` — rút gọn import, khai báo trong `tsconfig`/`playwright.config.ts` |
| Tag system (`@/types/testTags`)                 | Gắn `Tag.REGRESSION`, `Tag.UI`, `Tag.PAYMENT` vào tên `test.describe` để filter khi chạy CI                                                                                                             |
| Page Object Model (`BasePage`, `BaseComponent`) | Class trừu tượng chung: `goto()`, `waitForReady()`, locator factory (`byTestId`, `byRole`, `byText`, `byLabel`)                                                                                         |
| Playwright HTML reporter                        | Xuất `playwright-report/`/`test-results/` mặc định khi chạy 3 spec (không có report tuỳ biến riêng cho order-flow)                                                                                      |

### Chi tiết theo file

#### 1. `docs/screens/order-flow/order-flow-test-cases.md`

- **Vai trò trong luồng:** nguồn sự thật cho toàn bộ Order Flow — tổng hợp 1468 dòng
  `docs/linear/order-flow.md` + 5 doc Linear liên quan, đối chiếu UI thật (quét Playwright
  MCP 2026-07-15), rồi liệt kê 75 test case (TC-ORDERFLOW-01..75).

```markdown
1 ---
2 title: Order Flow (POS Home screen)
3 route: /home
4 source-linear: https://linear.app/fastboy/document/order-flow-1bd212f296da
5 scanned-at: 2026-07-15
6 scanned-by: playwright-mcp
7 cross-referenced: docs/linear/order-management.md, docs/linear/order-pending.md, docs/linear/split-order.md, docs/linear/portal-order-history.md, docs/linear/portal-support-edit-completed-order.md
8 ---
```

- **Giải thích:** front-matter khai báo route, nguồn Linear gốc, ngày quét và các doc
  Linear đối chiếu chéo — mọi TC phía dưới đều truy ngược được về đây. §7 chia rõ TC nào
  đã re-scan thật (`e2e`), TC nào chỉ dựa vào đặc tả Linear (`[LINEAR-ONLY]`, dạng
  "skip-safe check").
- **Công nghệ dùng để gen/chạy:** đọc file bằng công cụ đọc file thường + quét UI bằng
  Playwright MCP (không phải code test) — đây là bước feature-spec/test-case-gen thủ công,
  chưa chạy Playwright Test runner.

#### 2. `src/pages/pos/HomePage.ts`

- **Vai trò trong luồng:** page object cho `/home` — bọc các thao tác Staff/Service/Cart/
  Customer mà `create-order.spec.ts` gọi lại.

```ts
19  constructor(page: Page) {
20    super(page);
21    this.staffSearchInput = page.getByPlaceholder('Search staff');
22    this.serviceSearchInput = page.getByPlaceholder('Search service');
23    this.payButton = page.getByRole('button', { name: 'Pay' });
24    this.deleteOrderButton = page.getByRole('button', { name: 'Delete Order' });
25    this.customerPhoneButton = page.getByText('Enter Customer Phone');
26    this.quickPayTile = page.getByRole('heading', { name: 'Quick Pay' });
27    this.giftCardTile = page.getByRole('heading', { name: 'Gift Card' });
28    this.promoRewardsButton = page.getByRole('button', { name: 'Promo & Rewards' });
29    this.noteButton = page.getByRole('button', { name: 'Note', exact: true });
30    this.mergeOrderButton = page.getByRole('button', { name: 'Merge Order' });
31  }
```

- **Giải thích:** khai báo locator bằng role/placeholder/text — khớp với các thành phần
  UI đã liệt kê trong test-cases.md §3 ("Cart panel", "Search staff", "Quick Pay",
  "Promo & Rewards"...). `goto()` (dòng 33-39) còn gọi `cleanupExistingOrder()` để xoá đơn
  còn sót từ lần chạy trước — tránh state rò giữa các test (dòng 45-58), và `selectStaff()`
  (dòng 60-76) có `waitForFunction` chờ class `.is-changing-staff` biến mất trước khi click
  `force: true`, giải quyết vấn đề overlay chặn pointer-event.
- **Công nghệ dùng để gen/chạy:** Playwright locator API (`getByRole`, `getByPlaceholder`,
  `getByText`), Playwright MCP (để xác định đúng role/text thật trước khi hard-code), TS
  alias `@pages/BasePage`, `@constants/urls`.

#### 3. `src/pages/pos/CheckoutPage.ts`

- **Vai trò trong luồng:** page object cho `/checkout` — chọn phương thức thanh toán,
  đọc số tiền hiển thị, Complete Payment.

```ts
1  import { type Locator, type Page, expect } from '@playwright/test';
2  import { BasePage } from '@pages/BasePage';
3
4  export type PaymentMethod = 'Card' | 'Cash' | 'Gift Card' | 'Other';
...
28  async selectPaymentMethod(method: PaymentMethod): Promise<void> {
29    const button = this.page.getByRole('button', { name: new RegExp(`^${method}`) });
30    await button.click();
31    await this.page.waitForTimeout(300);
32  }
33
34  async clickCompletePayment(): Promise<void> {
35    await expect(this.completePaymentButton).toBeEnabled();
36    await this.completePaymentButton.click();
37  }
```

- **Giải thích:** union type `PaymentMethod` khớp đúng 4 phương thức mô tả trong
  test-cases.md §2.3 ("Card / Cash / Gift Card / Other"); `selectPaymentMethod` dùng regex
  `^${method}` vì label nút thật gồm cả số tiền phía sau tên method (ví dụ "Cash $12.10").
  `clickCompletePayment` assert `toBeEnabled()` trước khi click — khớp field
  "Complete Payment button disable tới khi đủ điều kiện" ở TC-ORDERFLOW-42/44.
- **Công nghệ dùng để gen/chạy:** Playwright `expect()` auto-retry assertion, regex
  locator matching, `page.waitForTimeout` (chờ UI cập nhật sau click — chấp nhận được cho
  luồng thanh toán không có signal rõ ràng hơn).

#### 4. `src/pages/pos/SplitOrderPage.ts`

- **Vai trò trong luồng:** page object cho `/order/:id/split-order` — 3 tab chia
  (Equally/By Amount/By Items), danh sách Check, thanh toán riêng từng check.

```ts
7  /**
8   * Split Order screen (`/order/:id/split-order`) — reached from the Cart's
9   * split icon button (next to Print, before Pay).
10  *
11  * Selector strategy: role/text captured via Playwright MCP scan on
12  * 2026-07-15 against a single-service order (Amelia · Nail Spa, $12.10):
...
41  this.equallyTab = page.getByRole('button', { name: 'Equally', exact: true });
42  this.byAmountTab = page.getByRole('button', { name: 'By Amount', exact: true });
43  this.byItemsTab = page.getByRole('button', { name: 'By Items', exact: true });
44  this.addNewCheckButton = page.getByRole('button', { name: 'Add New Check' });
```

- **Giải thích:** docblock ghi rõ ngày/điều kiện quét MCP thật (order 1 dòng dịch vụ) —
  đúng nguyên tắc "không bịa locator". `isMethodEnabled()` (dòng 65-73) cho phép spec
  assert "By Items" bị disable khi order chỉ có 1 line item, khớp TC-ORDERFLOW-26.
- **Công nghệ dùng để gen/chạy:** Playwright MCP scan trực tiếp trên URL thật để lấy
  role/text chính xác trước khi code hoá; `getByRole('button', { exact: true })` để tránh
  nhầm giữa 3 tab tên gần giống nhau.

#### 5. `tests/regression/pos/order-flow/create-order.spec.ts`

- **Vai trò trong luồng:** spec thực thi TC-ORDERFLOW-01..24 (Home/Cart/Quick Pay), dùng
  `homePage` fixture.

```ts
1  import { test, expect } from '@fixtures/index';
2  import { Tag } from '@/types/testTags';
...
13 test.describe(`Order Flow — Create Order ${Tag.REGRESSION} ${Tag.UI}`, () => {
14   test.beforeEach(async ({ homePage }) => {
15     await homePage.goto();
16   });
...
25   test('TC-ORDERFLOW-02: choosing a Service before Staff shows "Select Staff First"', async ({
26     page,
27     homePage,
28   }) => {
29     const hasStaff = await page
30       .getByText('Delete Staff Order Item')
31       .first()
32       .isVisible()
33       .catch(() => false);
34     test.skip(hasStaff, 'A staff is already attached to the current demo order');
```

- **Giải thích:** tên `test.describe` chèn `Tag.REGRESSION`/`Tag.UI` để hạ tầng CI filter
  theo tag; mỗi test id trỏ thẳng về TC-ORDERFLOW-xx trong test-cases.md. Nhiều test dùng
  `test.skip(condition, reason)` (không phải throw lỗi) khi state demo-data không đáp ứng
  tiền điều kiện — tránh false negative do dữ liệu demo dùng chung giữa các suite
  (`playwright.config.ts` chạy `workers: 1`, ghi rõ trong comment ở test-cases.md §3).
- **Công nghệ dùng để gen/chạy:** custom fixture injection (`homePage` tới sẵn từ
  `pagesFixture`), `test.skip()` có điều kiện, `test.describe` với template-string tag.

#### 6. `tests/regression/pos/order-flow/checkout.spec.ts`

- **Vai trò trong luồng:** spec TC-ORDERFLOW-39..53, dùng `homePage` + `checkoutPage`.

```ts
16 test.describe(`Order Flow — Checkout ${Tag.REGRESSION} ${Tag.UI} ${Tag.PAYMENT}`, () => {
17   test.beforeEach(async ({ homePage }) => {
18     await homePage.goto();
19   });
20
21   async function goToCheckout(homePage: HomePage): Promise<boolean> {
22     const hasOrder = await homePage.payButton.isVisible({ timeout: 3_000 }).catch(() => false);
23     if (!hasOrder) return false;
24     await homePage.clickPay();
25     return true;
26   }
```

- **Giải thích:** helper nội bộ `goToCheckout` gói điều kiện tiên quyết (phải có order với
  nút Pay hiển thị) thành 1 hàm dùng lại cho nhiều test — mọi test gọi `test.skip(!reached, ...)`
  ngay sau đó thay vì crash khi demo cart trống.
- **Công nghệ dùng để gen/chạy:** Playwright fixture composition (`homePage`, `checkoutPage`
  cùng lấy từ 1 fixture context), type import `HomePage` chỉ để type-hint helper function.

#### 7. `tests/regression/pos/order-flow/split-order.spec.ts`

- **Vai trò trong luồng:** spec TC-ORDERFLOW-25..38, dùng `homePage` + `splitOrderPage`.

```ts
4  /**
5   * Order Flow — Split Order / Split Tip (TC-ORDERFLOW-25..38).
...
13 * Split Tip requires a settled, multi-staff, tipped order which this test
14 * env does not reliably seed — those TCs are recorded as `test.skip` quoting
15 * the Linear spec (docs/linear/order-flow.md §"Split Tip") rather than
16 * asserting against unverified selectors.
17 */
18 test.describe(`Order Flow — Split Order ${Tag.REGRESSION} ${Tag.UI}`, () => {
```

- **Giải thích:** docblock tự khai rõ giới hạn — Split Tip (TC-ORDERFLOW-34..38) không có
  data seed đủ điều kiện nên chỉ được ghi nhận bằng `test.skip` trích Linear, không giả
  định UI khi chưa quét được (đúng tinh thần "Ghi chú" của Flow Map ở trên).
- **Công nghệ dùng để gen/chạy:** cùng cơ chế fixture + `test.skip` như 2 spec trên;
  khác biệt là tab method (Equally/By Amount/By Items) được assert trạng thái enabled/
  disabled qua `SplitOrderPage.isMethodEnabled()`.

#### 8. `src/fixtures/index.ts` và `src/fixtures/pages.fixture.ts`

- **Vai trò trong luồng:** entrypoint fixture dùng chung cho cả 3 spec — cung cấp
  `homePage`, `checkoutPage`, `splitOrderPage` đã khởi tạo với `page` hiện tại.

```ts
1  import { mergeTests, expect } from '@playwright/test';
2  import { pagesFixture } from './pages.fixture';
3  import { apiFixture } from './api.fixture';
...
12 export const test = mergeTests(pagesFixture, apiFixture);
13 export { expect };
```

- **Giải thích:** `mergeTests` của Playwright gộp 2 fixture module (`pagesFixture` — page
  objects, `apiFixture` — API/graphql) thành 1 `test`/`expect` duy nhất để import gọn ở mọi
  spec (`import { test, expect } from '@fixtures/index'`). `pages.fixture.ts` (dòng 21, 23,
  37 đã xác minh) khai báo type `homePage: HomePage`, `checkoutPage: CheckoutPage`,
  `splitOrderPage: SplitOrderPage` và factory async khởi tạo từng page object với `page`.
- **Công nghệ dùng để gen/chạy:** Playwright Test fixtures (`test.extend`/`mergeTests`),
  dependency injection theo kiểu Playwright (mỗi fixture tên field khớp tên tham số test
  nhận vào).

### So với sơ đồ Flow Map

- Bảng mắt xích ở trên đã đủ mọi file thật tham gia luồng "tạo/tạo đơn/checkout" (Home →
  Cart → Checkout → Split Order); phần **Code Detail** bổ sung so với Flow Map: cơ chế
  `cleanupExistingOrder()`/`test.skip(condition, reason)` để né state rò giữa test run (một
  chi tiết vận hành không thể hiện trong sơ đồ file→file); vai trò cụ thể của
  `mergeTests`/`pages.fixture.ts` trong việc tiêm `homePage`/`checkoutPage`/`splitOrderPage`.
- Flow Map liệt kê các mắt xích "còn thiếu" (Order Detail theo status, Refund, Adjust Tip,
  Reopen, Split Tip dialog) — Code Detail xác nhận thêm: các TC này **có tồn tại trong
  test-cases.md dưới nhãn `[LINEAR-ONLY]`** nhưng hoàn toàn chưa có page object/spec thực thi
  tương ứng, không phải do sơ đồ bỏ sót mà do code chưa được viết cho phần đó.
