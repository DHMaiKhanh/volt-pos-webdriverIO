---
title: Code Detail — Settings Language
generated-at: 2026-07-17
---

# Settings Language — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
docs/screens/settings-language/settings-language-test-cases.md (i18n-scan doc, có sẵn)
   └─(mô tả user flow gốc)→ src/domains/i18n/i18nScan.ts
                              ├─ switchToVietnamese(page)   — mở /settings/language, click "Tiếng Việt"
                              ├─ routerNavigate(page, to)   — điều hướng client-side qua __TSR_ROUTER__
                              ├─ scrollThroughPage(page)    — cuộn hết trang trước khi quét/capture
                              └─ scanRoute(page, def)        — dùng cả 3 hàm trên cho từng route tĩnh

src/pages/settings/LanguageSettingsPage.ts (page object riêng cho /settings/language)
   ├─ dùng trong → tests/regression/settings/TC-language-switch.spec.ts   (spec chức năng đổi ngôn ngữ)
   └─ dùng trong → tests/regression/i18n/TC-i18n-screen-compare.spec.ts   (spec quét EN↔VI cho MỌI màn,
                    bước đầu tiên của luồng luôn là chọn ngôn ngữ qua page object này)

src/fixtures/pages.fixture.ts
   └─(khai báo fixture)→ `languageSettingsPage` — inject LanguageSettingsPage vào cả 2 spec trên

src/domains/i18n/i18nCompare.ts
   └─ SCREENS['settings-language'] = { name: 'Ngôn ngữ', route: '/settings/language' }
        — đăng ký màn này vào registry để TC-i18n-screen-compare.spec.ts biết route + tên hiển thị

(khi chạy TC-i18n-screen-compare.spec.ts với I18N_SCREEN=settings-language)
   └─→ reports/settings-language/compare.json (+ compare.html nếu I18N_HTML=1)
        — nguồn dữ liệu đã được dùng để viết settings-language-test-cases.md
```

### Bảng mắt xích

| #   | File nguồn                                                         | →   | File đích                                                                     | Khâu tạo                     | Ghi chú                                                                                                                                              |
| --- | ------------------------------------------------------------------ | --- | ----------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/domains/i18n/i18nScan.ts` (`switchToVietnamese`)              | →   | `/settings/language` (route thật)                                             | helper quét i18n             | `page.goto('/settings/language')` rồi click text "Tiếng Việt" — là điểm khởi đầu của TOÀN BỘ luồng quét i18n cho mọi màn khác (không riêng màn này). |
| 2   | `src/pages/settings/LanguageSettingsPage.ts`                       | →   | `tests/regression/settings/TC-language-switch.spec.ts`                        | page object → spec           | Spec test chức năng chuyển đổi ngôn ngữ (không phải quét i18n), 5 test case TC-LANG-01..05.                                                          |
| 3   | `src/pages/settings/LanguageSettingsPage.ts`                       | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                        | page object → spec           | Spec dùng `LanguageSettingsPage` để ép EN rồi ép VI trước khi quét bất kỳ màn nào (bao gồm chính `settings-language`).                               |
| 4   | `src/fixtures/pages.fixture.ts`                                    | →   | cả 2 spec trên                                                                | fixture wiring               | Khai báo fixture `languageSettingsPage: async ({ page }, use) => use(new LanguageSettingsPage(page))`.                                               |
| 5   | `src/domains/i18n/i18nCompare.ts` (`SCREENS['settings-language']`) | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                        | registry → spec              | `I18N_SCREEN=settings-language` sẽ tra route `/settings/language` từ registry này.                                                                   |
| 6   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`             | →   | `reports/settings-language/compare.json` (+ `compare.html` nếu `I18N_HTML=1`) | spec → report                | Kết quả quét EN↔VI, là nguồn dữ liệu của `settings-language-test-cases.md`.                                                                          |
| 7   | `reports/settings-language/compare.json`                           | →   | `docs/screens/settings-language/settings-language-test-cases.md`              | skill `i18n-vietnamese-scan` | File test-cases hiện tại ghi rõ `source: compare.json + compare.html`.                                                                               |

### Ghi chú

- Mắt xích còn thiếu: chưa có `docs/linear/settings-language.md` (nguồn spec Linear) — README liệt kê màn này là "i18n-scan only so far", chưa chạy skill `linear-spec-testcase` (Feature Overview/Test Cases) và cũng chưa có codegen-flow trước đây (đây là file code-detail đầu tiên của màn).
- Route đã đăng ký ở 2 nơi độc lập: `LanguageSettingsPage.path = '/settings/language'` (page object) và `SCREENS['settings-language'].route` (`src/domains/i18n/i18nCompare.ts:319`) — cả hai khớp nhau, không lệch.
- File `settings-language-test-cases.md` mô tả **kết quả quét i18n** (không có Feature Overview/Test Cases dạng luồng nghiệp vụ) — README (`docs/screens/README.md`, mục 3, bước `1. switchToVietnamese()`) là nơi mô tả _tại sao_ màn này quan trọng: nó là điểm vào của toàn bộ luồng quét EN↔VI cho tất cả 24 màn tĩnh khác.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                            | Vai trò trong luồng gen                                                                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@playwright/test`)                                 | Chạy spec, `page.goto`, `expect`, locator API.                                                                                                      |
| Page Object Model (`BasePage` → `LanguageSettingsPage`)              | Đóng gói locator radiogroup + hành vi `select()`/`selectedLanguage()`/`isLanguageActive()`.                                                         |
| Playwright custom fixtures (`@fixtures/index`, `pages.fixture.ts`)   | Inject `languageSettingsPage` sẵn khởi tạo vào test, tránh `new LanguageSettingsPage(page)` lặp lại trong từng spec.                                |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)                   | `routerNavigate()` trong `i18nScan.ts` điều hướng client-side để KHÔNG revert ngôn ngữ về English (bug đã biết: `page.goto` giữa chừng làm mất VI). |
| TypeScript path alias (`@pages`, `@domains`, `@fixtures`, `@/types`) | Import ngắn, thấy trong cả page object và cả 2 spec.                                                                                                |
| Tag system (`Tag.REGRESSION` từ `@/types/testTags`)                  | Gắn tag cho `test.describe` để filter khi chạy suite regression.                                                                                    |
| Node `fs` (`mkdirSync`, `writeFileSync`)                             | `TC-language-switch.spec.ts` (case TC-LANG-05) và `TC-i18n-screen-compare.spec.ts` tự ghi báo cáo HTML/JSON vào `reports/`.                         |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nScan.ts`

- **Vai trò trong luồng:** chứa hàm `switchToVietnamese` — thao tác UI thật trên chính route `/settings/language`, là bước đầu tiên (`Bước 0a`) của mọi lần quét i18n toàn app.

```ts
// src/domains/i18n/i18nScan.ts (dòng 727-736)
/** Switch the app to Tiếng Việt via Settings → Language (real UI click). */
export async function switchToVietnamese(page: Page): Promise<void> {
  await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
  // The radio row carries the visible language name.
  const viRow = page.getByText('Tiếng Việt', { exact: true });
  await viRow.waitFor({ state: 'visible', timeout: 15_000 });
  await viRow.click();
  // Confirm the switch took effect — the sidebar/header re-renders in VN.
  await page.getByText('Đơn đang chờ', { exact: true }).first().waitFor({ timeout: 10_000 });
}
```

- **Giải thích:** `page.goto` tải trực tiếp route `/settings/language` (full navigation vì đây là lần đầu, chưa có state ngôn ngữ để giữ), chờ dòng radio "Tiếng Việt" hiện ra rồi click, sau đó chờ chuỗi "Đơn đang chờ" (nav item đã dịch) xuất hiện để xác nhận app đã re-render sang VI.
- **Công nghệ dùng để gen/chạy:** Playwright `page.goto` + `getByText(exact:true)` locator + `waitFor`. Đây là hàm dùng chung, không riêng cho spec của màn `settings-language`.

```ts
// src/domains/i18n/i18nScan.ts (dòng 738-749)
export async function routerNavigate(page: Page, to: string): Promise<void> {
  await page.evaluate((dest) => {
    const r = (window as unknown as { __TSR_ROUTER__?: { navigate: (o: { to: string }) => unknown } })
      .__TSR_ROUTER__;
    r?.navigate({ to: dest });
  }, to);
}
```

- **Giải thích:** sau khi đã ở VI, mọi điều hướng tiếp theo (kể cả quay lại `/settings/language` để quét màn khác) phải đi qua router in-memory của TanStack Router (`window.__TSR_ROUTER__.navigate`) thay vì `page.goto`, vì `page.goto` là full reload và ngôn ngữ không được persist (bug VP-462 nêu trong `LanguageSettingsPage.ts` dòng 14 và test TC-LANG-05).
- **Công nghệ dùng để gen/chạy:** `page.evaluate` chạy code trong browser context, truy cập biến global `__TSR_ROUTER__` do TanStack Router expose.

#### 2. `src/pages/settings/LanguageSettingsPage.ts`

- **Vai trò trong luồng:** page object chính thức của màn `/settings/language`, được cả spec chức năng (`TC-language-switch.spec.ts`) và spec quét i18n (`TC-i18n-screen-compare.spec.ts`) dùng.

```ts
// src/pages/settings/LanguageSettingsPage.ts (dòng 17-54)
export class LanguageSettingsPage extends BasePage {
  protected readonly path = '/settings/language';

  readonly radiogroup: Locator;
  readonly englishRow: Locator;
  readonly vietnameseRow: Locator;

  static readonly ANCHORS = {
    en: { nav: 'Pending Orders', sidebar: 'Setting', subtitle: 'Choose your primary language' },
    vi: { nav: 'Đơn đang chờ', sidebar: 'Cài đặt', subtitle: 'Chọn ngôn ngữ chính của bạn' },
  } as const;

  constructor(page: Page) {
    super(page);
    this.radiogroup = page.locator('[role="radiogroup"]');
    this.englishRow = page.getByText('English', { exact: true });
    this.vietnameseRow = page.getByText('Tiếng Việt', { exact: true });
  }

  async waitForReady(): Promise<void> {
    await expect(this.vietnameseRow).toBeVisible({ timeout: 15_000 });
    await expect(this.englishRow).toBeVisible({ timeout: 15_000 });
  }

  private row(lang: AppLanguage): Locator {
    return lang === 'vi' ? this.vietnameseRow : this.englishRow;
  }

  async select(lang: AppLanguage): Promise<void> {
    await this.row(lang).click();
    await expect(
      this.page.getByText(LanguageSettingsPage.ANCHORS[lang].nav, { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
```

- **Giải thích:** kế thừa `BasePage` (định nghĩa `path`, `goto()`, `waitForReady()` mặc định). Locator dùng `[role="radiogroup"]` (Radix UI radiogroup) và `getByText(exact:true)` cho 2 nhãn "English"/"Tiếng Việt" — nhãn này KHÔNG đổi theo ngôn ngữ hiện tại nên là anchor ổn định. `ANCHORS` map ngôn ngữ → chuỗi nav/sidebar/subtitle tương ứng, dùng để xác nhận app đã re-render đúng ngôn ngữ sau khi `select()`.
- **Công nghệ dùng để gen/chạy:** Page Object Model kế thừa `BasePage` (`src/pages/BasePage.ts`), Playwright `Locator`/`expect().toBeVisible()`.

#### 3. `src/fixtures/pages.fixture.ts`

- **Vai trò trong luồng:** khai báo fixture `languageSettingsPage` để spec không phải tự khởi tạo page object.

```ts
// src/fixtures/pages.fixture.ts (dòng 33, 77-79)
  languageSettingsPage: LanguageSettingsPage;
  ...
  languageSettingsPage: async ({ page }, use) => {
    await use(new LanguageSettingsPage(page));
  },
```

- **Giải thích:** mở rộng kiểu fixture của Playwright Test bằng một custom fixture — mỗi test nhận sẵn instance `LanguageSettingsPage` gắn với `page` hiện tại của test đó.
- **Công nghệ dùng để gen/chạy:** Playwright Test custom fixtures (`test.extend`), import qua alias `@fixtures/index`.

#### 4. `tests/regression/settings/TC-language-switch.spec.ts`

- **Vai trò trong luồng:** spec regression cho chính chức năng đổi ngôn ngữ (không phải quét i18n) — 5 test case TC-LANG-01 đến TC-LANG-05.

```ts
// tests/regression/settings/TC-language-switch.spec.ts (dòng 15-24)
test.describe(`Settings — Language switch ${Tag.REGRESSION}`, () => {
  test.beforeEach(async ({ languageSettingsPage }) => {
    await languageSettingsPage.goto();
    await languageSettingsPage.waitForReady();
  });

  test('TC-LANG-01: default language is English', async ({ languageSettingsPage }) => {
    expect(await languageSettingsPage.selectedLanguage()).toBe('en');
    expect(await languageSettingsPage.isLanguageActive('en')).toBe(true);
  });
```

- **Giải thích:** `beforeEach` điều hướng tới màn và chờ sẵn sàng bằng chính page object. TC-LANG-01..03 kiểm tra chuyển đổi 2 chiều EN⇄VI; TC-LANG-04 kiểm tra ngôn ngữ giữ nguyên khi điều hướng client-side (`routerNavigate`-style, viết trực tiếp bằng `page.evaluate` trong spec dòng 64-69); TC-LANG-05 dùng `test.fail(true, ...)` để document bug VP-462 (ngôn ngữ mất sau full reload) và tự ghi report HTML/screenshot vào `reports/i18n-audit/lang-persist-fail/` khi assertion thất bại đúng như mong đợi.
- **Công nghệ dùng để gen/chạy:** Playwright Test (`test.describe`, `test.beforeEach`, `test.fail`), Node `fs` (`mkdirSync`/`writeFileSync`) để tự sinh báo cáo HTML tại chỗ, `test.info().attach()` để đính kèm report/screenshot vào Playwright HTML report.

#### 5. `src/domains/i18n/i18nCompare.ts`

- **Vai trò trong luồng:** registry `SCREENS` khai báo tên hiển thị + route cho từng màn được phép quét EN↔VI, bao gồm `settings-language`.

```ts
// src/domains/i18n/i18nCompare.ts (dòng 317-321)
  'charge-fee': { name: 'Phí & Phụ thu', route: '/settings/charge-fee' },
  'settings-accessibility': { name: 'Hiển thị', route: '/settings/accessibility' },
  'settings-language': { name: 'Ngôn ngữ', route: '/settings/language' },
  'time-tracking': { name: 'Chấm công', route: '/time-tracking' },
  'cash-drawer': { name: 'Két tiền', route: '/cash-drawer' },
```

- **Giải thích:** đây là "danh bạ" mà `TC-i18n-screen-compare.spec.ts` tra cứu bằng key `I18N_SCREEN` (env var) để lấy `route` cần quét và `name` hiển thị trong report.
- **Công nghệ dùng để gen/chạy:** TypeScript object literal đơn giản, không phải framework — nhưng là điểm nối bắt buộc giữa CLI arg (`I18N_SCREEN=settings-language`) và route thật.

#### 6. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** spec tổng dùng cho MỌI màn (tham số hoá qua `I18N_SCREEN`); khi chạy với `I18N_SCREEN=settings-language` nó tự quét chính màn Settings → Language và đây là nguồn dữ liệu duy nhất phía sau `settings-language-test-cases.md`.

```ts
// tests/regression/i18n/TC-i18n-screen-compare.spec.ts (dòng 39, 51-57, 67-69)
const SCREEN = process.env.I18N_SCREEN || 'home';
...
    const lang = new LanguageSettingsPage(page);
    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
    await lang.waitForReady();
    await lang.select('en');
    await routerNavigate(page, def.route);
    ...
    await switchToVietnamese(page);
    await routerNavigate(page, def.route);
```

- **Giải thích:** pass 1 ép về English rồi `routerNavigate` tới `def.route` (khi `SCREEN=settings-language`, `def.route` chính là `/settings/language` — quét lại chính nó); pass 2 gọi `switchToVietnamese(page)` (full `page.goto` tới `/settings/language` + click "Tiếng Việt") rồi cũng `routerNavigate` tới `def.route`. Kết quả 2 pass được `pairAndClassify` so khớp theo DOM-path key, ghi ra `reports/settings-language/compare.json`.
- **Công nghệ dùng để gen/chạy:** Playwright Test tham số hoá bằng biến môi trường, page object (`LanguageSettingsPage`), helper quét (`i18nScan.ts`: `switchToVietnamese`, `routerNavigate`, `scrollThroughPage`, `detectBody`), helper so sánh (`i18nCompare.ts`: `captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`, `renderCompareReport`), Node `fs` để ghi `compare.json`/`compare.html`, `test.info().attach()` để đính HTML report vào Playwright report.

### So với sơ đồ Flow Map

- Sơ đồ ở trên đơn giản hoá thành 1 mũi tên `i18nScan.ts → routerNavigate`, nhưng thực tế `TC-i18n-screen-compare.spec.ts` gọi CẢ `switchToVietnamese` (dùng `page.goto`, chỉ chạy 1 lần lúc bắt đầu pass VI) VÀ `routerNavigate` (dùng cho mọi điều hướng sau đó) — hai cơ chế khác nhau vì lý do bug persist (VP-462) đã nêu ở mục "Ghi chú" và trong code `LanguageSettingsPage.ts` dòng 14.
- Điểm đặc biệt của màn `settings-language` so với các màn khác trong README: nó vừa là **đối tượng bị quét** (có mặt trong `SCREENS` registry, có `compare.json` riêng) vừa là **công cụ để quét mọi màn khác** (chứa hành động click "Tiếng Việt" mà `switchToVietnamese()` dựa vào) — không màn nào khác trong `docs/screens/` có vai trò kép này.
- Chưa tìm thấy `docs/linear/settings-language.md` hay bất kỳ Linear issue nào chỉ đích danh màn này (đúng như README ghi ở mục 5: "Chưa có sub-task Linear nào (VP-2252) chỉ đích danh màn này") — nên sơ đồ Flow Map không có nhánh "Linear doc" như cấu trúc mẫu gợi ý.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Language (Ngôn ngữ)** · route `/settings/language` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **0** · 📐 UI vỡ **0**
> Số liệu máy quét: 41 cặp EN↔VI · ✅ đúng glossary 32 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-language/compare.json` · HTML: `reports/settings-language/settings-language.html`
> Cách quét: `I18N_SCREEN=settings-language I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Màn chọn ngôn ngữ — cũng là màn mà spec compare dùng để đổi EN↔VI.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

> Không phát hiện chuỗi dịch lệch chuẩn ở phạm vi đã quét.

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Ngôn ngữ (Language) · Chọn ngôn ngữ chính của bạn (Choose your primary language)
- “English” và “Tiếng Việt” giữ nguyên — **đúng chuẩn**: tên ngôn ngữ luôn viết bằng chính ngôn ngữ đó

### 5. Ghi chú / đề xuất bổ sung glossary

- Chuỗi “English” bị scan xếp vào nhóm “còn tiếng Anh” là **false positive** — đây là endonym, không dịch.
- Ghi chú kỹ thuật: khi chạy trong trình duyệt (không phải Tauri webview), `tauri-language-detector` không lưu ngôn ngữ → mỗi tab/context giữ ngôn ngữ riêng, `page.goto` sẽ reset về EN. Vì vậy spec compare điều hướng bằng router (`routerNavigate`), và quét song song nhiều màn KHÔNG tranh nhau ngôn ngữ.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-language/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-language`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
