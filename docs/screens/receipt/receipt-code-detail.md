---
title: Code Detail — Receipt
generated-at: 2026-07-17
---

# Receipt — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
tests/regression/i18n/TC-i18n-screen-compare.spec.ts   (I18N_SCREEN=receipt)
   │  đọc SCREENS['receipt'] = { name: 'Hóa đơn (mẫu in)', route: '/settings/receipt' }
   ▼
src/domains/i18n/i18nCompare.ts
   │  SCREENS registry, captureTexts(), pairAndClassify(), summarize(),
   │  suggestFor(), renderCompareReport(), GLOSSARY
   ▼ (imports DATA_ZONE_SELECTORS from)
src/domains/i18n/i18nScan.ts
   │  STATIC_ROUTES[].find(path === '/settings/receipt')
   │  switchToVietnamese(), routerNavigate(), detectBody(), scrollThroughPage()
   ▼
src/pages/settings/LanguageSettingsPage.ts
   │  page object dùng để chuyển App sang EN rồi sang VI trước mỗi lượt quét
   ▼
reports/receipt/compare.json  +  reports/receipt/compare.html (chỉ khi I18N_HTML=1)
   │  tiêu thụ bởi skill i18n-vietnamese-scan để viết
   ▼
docs/screens/receipt/receipt-test-cases.md   (mục "PHẦN i18n" hiện có)
```

Không có nhánh **codegen** (page object riêng cho màn Receipt / spec riêng
`TC-*-receipt*.spec.ts`) — màn này chỉ được quét như **một trong nhiều màn**
bởi 2 spec chung: `TC-i18n-vietnamese-scan.spec.ts` (quét toàn app, gồm route
`/settings/receipt` trong `STATIC_ROUTES`) và `TC-i18n-screen-compare.spec.ts`
(so sánh EN↔VI riêng cho một `I18N_SCREEN`, có thể chạy với
`I18N_SCREEN=receipt`).

### Bảng mắt xích

| #   | File nguồn                                              | →   | File đích                                        | Khâu tạo                                                                                                    | Ghi chú                                                                                    |
| --- | ------------------------------------------------------- | --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`  | →   | `src/domains/i18n/i18nCompare.ts`                | import `SCREENS`, `captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`, `renderCompareReport`       | `SCREEN = process.env.I18N_SCREEN \|\| 'home'`; với Receipt cần chạy `I18N_SCREEN=receipt` |
| 2   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`  | →   | `src/pages/settings/LanguageSettingsPage.ts`     | `new LanguageSettingsPage(page)` → `lang.select('en')` / (sau `switchToVietnamese`)                         | chuyển ngôn ngữ trước mỗi lượt capture                                                     |
| 3   | `src/domains/i18n/i18nCompare.ts`                       | →   | `src/domains/i18n/i18nScan.ts`                   | `import { DATA_ZONE_SELECTORS } from '@domains/i18n/i18nScan'`                                              | dùng để loại vùng data (DB) khỏi phần so sánh                                              |
| 4   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`  | →   | `src/domains/i18n/i18nScan.ts`                   | import `switchToVietnamese`, `routerNavigate`, `enterPasscodeIfPrompted`, `detectBody`, `scrollThroughPage` | điều hướng client-side tới `/settings/receipt` bằng router (không `page.goto` giữa chừng)  |
| 5   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` | →   | `src/domains/i18n/i18nScan.ts` (`STATIC_ROUTES`) | route `{ path: '/settings/receipt', name: 'Hóa đơn (mẫu in)', group: 'Settings' }` (dòng 43)                | quét Receipt cùng lượt với 22 route tĩnh khác                                              |
| 6   | `TC-i18n-screen-compare.spec.ts`                        | →   | `reports/receipt/compare.json`                   | `writeFileSync(jsonPath, JSON.stringify({...}))`                                                            | luôn ghi JSON (dữ liệu nguồn cho skill)                                                    |
| 7   | `TC-i18n-screen-compare.spec.ts`                        | →   | `reports/receipt/compare.html`                   | `renderCompareReport()` + `writeFileSync(htmlPath, html)`                                                   | chỉ ghi khi `I18N_HTML=1`; luôn attach vào Playwright report                               |
| 8   | `reports/receipt/compare.json` + `compare.html`         | →   | `docs/screens/receipt/receipt-test-cases.md`     | skill `i18n-vietnamese-scan` đọc report rồi viết mục i18n                                                   | tài liệu hiện có, `scanned-at: 2026-07-06`                                                 |

### Ghi chú

- Mắt xích còn thiếu / chưa tồn tại:
  - **Không có page object riêng** cho màn Receipt (không có
    `src/pages/settings/ReceiptSettingsPage.ts` hay tương tự) — đã `Grep`
    toàn `src/` theo `receipt` (case-insensitive) và chỉ thấy tham chiếu
    trong `SplitOrderPage.ts`, `OrderHistoryPage.ts`, `PaymentSuccessPage.ts`
    (đều là "receipt" trong ngữ cảnh đơn hàng/thanh toán, không phải màn
    Settings → Receipt) và trong `i18nScan.ts` / `i18nCompare.ts` /
    `i18nOrderHistory.ts`.
  - **Không có spec riêng** cho luồng chức năng của màn (đổi mẫu in, xem
    preview...) — chỉ có 2 spec i18n chung nêu trên. Đã `Glob` toàn repo
    theo `*[Rr]eceipt*` và không tìm thấy spec/page object nào khớp ngoài
    tài liệu `docs/screens/receipt/receipt-test-cases.md` chính nó.
  - Vì vậy **chưa có** bước "Linear source doc → test-cases.md → page
    object → spec functional" như các màn đã có code-detail (home,
    income-*, order-history, order-pending, settings-business). Luồng
    "code" thật tồn tại cho màn này **chỉ là luồng i18n-scan** ở trên.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                   | Vai trò trong luồng                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@playwright/test`)                        | Chạy spec, cung cấp `page`, `test.info().attach(...)` để đính HTML report                                              |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)          | `routerNavigate()` điều hướng client-side tới `/settings/receipt` mà không reload (app không lưu ngôn ngữ qua reload)  |
| Page Object Model                                           | `LanguageSettingsPage` (đổi ngôn ngữ EN/VI) — màn Receipt tự nó chưa có PO                                             |
| `page.evaluate` (in-browser DOM scan)                       | `captureTextsInPage` chạy trực tiếp trong browser để duyệt DOM theo `rootSelector` + `dataZones`, trả `CapturedText[]` |
| Node `fs` (`mkdirSync`, `writeFileSync`)                    | Ghi `reports/receipt/compare.json` (+ `.html` khi `I18N_HTML=1`)                                                       |
| Biến môi trường `I18N_SCREEN`, `I18N_LENIENT`, `I18N_HTML`  | Chọn màn cần so sánh / tắt gate fail / bật xuất HTML rời                                                               |
| Glossary tra cứu (`GLOSSARY` object trong `i18nCompare.ts`) | Chuẩn hoá & gợi ý thuật ngữ tiếng Việt đúng khi phân loại `suspect`/`missing`                                          |

### Chi tiết theo file

#### 1. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** spec thực thi — nhận `I18N_SCREEN` (mặc định
  `home`, cần set `I18N_SCREEN=receipt` để chạy cho màn này), lookup định
  nghĩa màn trong `SCREENS`, quét 1 lần bằng English rồi 1 lần bằng Tiếng
  Việt, so khớp theo DOM-path key, và ghi report.

```ts
39	const SCREEN = process.env.I18N_SCREEN || 'home';
40
41	test.describe(`i18n — so sánh EN↔VI theo màn ${Tag.REGRESSION}`, () => {
42	  test(`TC-I18N-COMPARE: ${SCREEN}`, async ({ page }) => {
43	    test.setTimeout(180_000);
44
45	    const def = SCREENS[SCREEN];
46	    expect(
47	      def,
48	      `Màn "${SCREEN}" chưa khai báo trong SCREENS (src/utils/i18nCompare.ts)`,
49	    ).toBeTruthy();
50
51	    // 1) ENGLISH pass — switch to English, navigate client-side, capture.
52	    const lang = new LanguageSettingsPage(page);
53	    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
54	    await lang.waitForReady();
55	    await lang.select('en');
56	    await routerNavigate(page, def.route);
```

- **Giải thích:** với Receipt, `def` = `{ name: 'Hóa đơn (mẫu in)', route:
'/settings/receipt' }`. Spec KHÔNG `page.goto('/settings/receipt')` trực
  tiếp — nó `page.goto('/settings/language')` để đổi ngôn ngữ qua UI, sau đó
  dùng `routerNavigate` (client-side) để đi tới route thật cần quét, đúng
  ràng buộc "app không lưu ngôn ngữ qua reload" ghi trong
  `docs/screens/README.md` (mục 2).
- **Công nghệ dùng để gen/chạy:** Playwright Test runner, biến môi trường
  `I18N_SCREEN`, page object `LanguageSettingsPage`.

#### 2. `src/domains/i18n/i18nCompare.ts`

- **Vai trò trong luồng:** định nghĩa `SCREENS['receipt']`, các hàm
  `captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`,
  `renderCompareReport` dùng chung cho mọi màn — Receipt chỉ khác ở giá
  trị `route`/`name` được truyền vào.

```ts
303	export const SCREENS: Record<string, ScreenDef> = {
304	  home: { name: 'Trang chủ / POS', route: '/home' },
305	  'order-pending': { name: 'Đơn đang chờ', route: '/order-pending' },
306	  'order-history': { name: 'Lịch sử đơn hàng', route: '/order-history' },
307	  appointment: { name: 'Lịch hẹn', route: '/appointment' },
308	  'income-daily': { name: 'Thu nhập theo ngày', route: '/incomes/income-daily', gated: true },
309	  'income-summary': { name: 'Tổng hợp thu nhập', route: '/incomes/income-summary', gated: true },
310	  'income-staff': { name: 'Thu nhập nhân viên', route: '/incomes/income-staff', gated: true },
311	  'settings-business': { name: 'Thông tin doanh nghiệp', route: '/settings/business', gated: true },
312	  'settings-services': { name: 'Dịch vụ & Sản phẩm', route: '/settings/services' },
313	  'settings-staffs': { name: 'Nhân viên', route: '/settings/staffs' },
314	  'settings-roles': { name: 'Vai trò', route: '/settings/roles' },
315	  'settings-permissions': { name: 'Quyền hạn', route: '/settings/permissions' },
316	  receipt: { name: 'Hóa đơn (mẫu in)', route: '/settings/receipt' },
317	  'charge-fee': { name: 'Phí & Phụ thu', route: '/settings/charge-fee' },
```

- **Giải thích:** `receipt` không có `gated: true` (không cần passcode chủ
  để mở, khác với `income-*`/`settings-business`) — đúng với việc
  `/settings/receipt` là trang cài đặt thông thường trong nhóm Settings.

```ts
222	export async function captureTexts(page: Page, rootSelector = 'body'): Promise<CapturedText[]> {
223	  return page.evaluate(captureTextsInPage, { rootSelector, dataZones: DATA_ZONE_SELECTORS });
224	}
```

- **Giải thích:** hàm dùng chung để chụp toàn bộ text hiển thị trên trang
  hiện tại (cả 2 lượt EN và VI) — với Receipt, trang đang mở là
  `/settings/receipt` (preview hóa đơn) tại thời điểm gọi.
- **Công nghệ dùng để gen/chạy:** TypeScript module dùng chung cho mọi màn,
  `page.evaluate` (chạy code trong browser context), object literal
  `GLOSSARY` làm "nguồn sự thật" thuật ngữ chuẩn.

#### 3. `src/domains/i18n/i18nScan.ts`

- **Vai trò trong luồng:** khai báo route `/settings/receipt` trong danh
  sách `STATIC_ROUTES` (dùng bởi spec quét toàn app
  `TC-i18n-vietnamese-scan.spec.ts`) và cung cấp các helper điều hướng/quét
  dùng chung (`switchToVietnamese`, `routerNavigate`, `detectBody`,
  `scrollThroughPage`) mà spec compare cũng import lại.

```ts
28	export const STATIC_ROUTES: RouteDef[] = [
29	  { path: '/home', name: 'Trang chủ / POS', group: 'POS' },
30	  { path: '/order-pending', name: 'Đơn đang chờ', group: 'POS' },
31	  { path: '/order-history', name: 'Lịch sử đơn hàng', group: 'POS' },
32	  { path: '/appointment', name: 'Lịch hẹn', group: 'POS' },
...
42	  { path: '/settings/permissions', name: 'Quyền hạn', group: 'Settings', expandAll: true },
43	  { path: '/settings/receipt', name: 'Hóa đơn (mẫu in)', group: 'Settings' },
44	  { path: '/settings/charge-fee', name: 'Phí & Phụ thu', group: 'Settings' },
```

- **Giải thích:** Receipt nằm trong nhóm `'Settings'`, không có `gated`
  hay `expandAll` — quét thẳng, không cần bấm mở thêm control nào trước
  khi chụp text.
- **Công nghệ dùng để gen/chạy:** cùng module `i18nScan.ts` được cả 2 spec
  (`TC-i18n-vietnamese-scan.spec.ts` và `TC-i18n-screen-compare.spec.ts`)
  import; đây là nơi duy nhất "biết" Receipt là một route hợp lệ để quét.

Ngoài ra, `i18nScan.ts` còn có 2 dòng từ điển ghi chú trực tiếp liên quan
Receipt (dùng bởi bộ dò leftover-English chung, không phải bộ dò riêng cho
Receipt):

```ts
375	    'message', // "Text Message" send-receipt button, Payment Complete display (VP-2304)
...
445	    'points', // loyalty term — leaks as "Current points:" on the order receipt
446	    'visit', // "Total visit:" on the order receipt
```

- **Giải thích:** đây là chú thích cho từ điển `ui` dùng CHUNG toàn app —
  ghi lại rằng các từ `message`/`points`/`visit` cũng xuất hiện trên
  receipt (mẫu in hóa đơn), không phải các dòng dành riêng cho màn Settings
  → Receipt.

#### 4. `src/pages/settings/LanguageSettingsPage.ts`

- **Vai trò trong luồng:** page object thao tác UI đổi ngôn ngữ tại
  `/settings/language`, được `TC-i18n-screen-compare.spec.ts` dùng trước
  mỗi lượt capture (EN rồi VI) của bất kỳ màn nào, bao gồm Receipt.
- **Giải thích:** không có logic riêng cho Receipt — cùng một page object
  dùng cho toàn bộ 17 màn trong `SCREENS`.
- **Công nghệ dùng để gen/chạy:** Page Object Model pattern (`waitForReady()`,
  `select('en'|'vi')`).

### So với sơ đồ Flow Map

- Flow Map ở trên là **toàn bộ luồng code thật hiện có** cho màn Receipt —
  không có tầng "codegen" (Linear spec → test-cases.md → page object →
  spec functional) như các màn đã hoàn chỉnh (home, income-*,
  order-history, order-pending, settings-business). Bảng mắt xích phản ánh
  đúng 1:1 những gì đọc được trong code, không thêm chi tiết nào khác so
  với Code Detail.
- Điểm khác biệt duy nhất đáng chú ý: route `/settings/receipt` xuất hiện ở
  **2 nơi độc lập** phải khớp tay — `STATIC_ROUTES` (`i18nScan.ts:43`) và
  `SCREENS['receipt']` (`i18nCompare.ts:316`) — không có ràng buộc kiểu
  (type-level) nào đảm bảo 2 danh sách này đồng bộ; đây là rủi ro nhỏ khi
  thêm/đổi route trong tương lai.

## i18n Notes

Xem toàn bộ kết quả quét EN↔VI (11 nhãn thật chưa dịch trong template
preview hóa đơn, bug lặp "Staff: Staff:", v.v.) tại
[`docs/screens/receipt/receipt-test-cases.md`](receipt-test-cases.md) —
tài liệu đó đã gộp sẵn phần i18n cho màn này theo cấu trúc chung của
`docs/screens/README.md`.

## Ghi chú

- Màn Receipt hiện **chỉ có i18n-scan**, chưa có feature-spec/testcase-gen
  (skill `linear-spec-testcase`) và chưa có codegen page-object/spec riêng
  (skill `codegen-flow`) — đúng như `docs/screens/README.md` đã đánh dấu
  (`code-detail: —`, "i18n-scan only so far").
- File code-detail này mô tả **luồng i18n-scan hiện tại** làm "luồng code"
  thực tế duy nhất tồn tại cho màn Receipt, theo đúng yêu cầu khi chưa có
  codegen thật. Khi có page object/spec chức năng riêng cho Receipt trong
  tương lai, cần bổ sung một nhánh Flow Map mới (Linear doc → test-cases →
  page object → spec) và cập nhật bảng ✅/— tương ứng trong
  `docs/screens/README.md`.
