---
title: Code Detail — Settings Accessibility
generated-at: 2026-07-17
---

# Settings Accessibility — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
src/domains/i18n/i18nCompare.ts (SCREENS['settings-accessibility'] = { route: '/settings/accessibility' })
   └─(khai báo màn để spec chọn qua env I18N_SCREEN)→
tests/regression/i18n/TC-i18n-screen-compare.spec.ts (generic spec, không riêng cho màn này)
   ├─→ src/pages/settings/LanguageSettingsPage.ts (đổi ngôn ngữ EN/VI)
   ├─→ src/domains/i18n/i18nScan.ts
   │      ├─ routerNavigate()      (điều hướng client-side giữ ngôn ngữ)
   │      ├─ scrollThroughPage()   (cuộn hết trang để mount nội dung lazy)
   │      ├─ switchToVietnamese()  (đổi sang Tiếng Việt)
   │      ├─ enterPasscodeIfPrompted() (bỏ qua vì settings-accessibility không gated)
   │      └─ detectBody()          (quét tiếng Anh còn sót + UI vỡ)
   └─→ src/domains/i18n/i18nCompare.ts
          ├─ captureTexts() (dùng captureTextsInPage qua page.evaluate)
          ├─ pairAndClassify() (đối chiếu EN↔VI theo GLOSSARY)
          ├─ summarize()
          └─ renderCompareReport() (HTML báo cáo, chỉ ghi file khi I18N_HTML=1)
   └─(khi chạy: I18N_SCREEN=settings-accessibility)→ reports/settings-accessibility/compare.json (+ compare.html nếu I18N_HTML=1)
   └─(khâu người/skill viết tay)→ docs/screens/settings-accessibility/settings-accessibility-test-cases.md
```

### Bảng mắt xích

| #   | File nguồn                                                              | →   | File đích                                                                  | Khâu tạo                                    | Ghi chú                                                                                                                                  |
| --- | ----------------------------------------------------------------------- | --- | -------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/domains/i18n/i18nCompare.ts` (`SCREENS['settings-accessibility']`) | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                     | khai báo registry                           | Spec đọc route `/settings/accessibility` qua `SCREENS[I18N_SCREEN]`; spec KHÔNG có bản riêng cho màn này, dùng chung 1 spec cho mọi màn. |
| 2   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                  | →   | `src/pages/settings/LanguageSettingsPage.ts`                               | gọi page object                             | Đổi ngôn ngữ trước khi quét pass EN và pass VI.                                                                                          |
| 3   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                  | →   | `src/domains/i18n/i18nScan.ts`                                             | gọi helper quét                             | `routerNavigate`, `scrollThroughPage`, `switchToVietnamese`, `enterPasscodeIfPrompted`, `detectBody`.                                    |
| 4   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                  | →   | `src/domains/i18n/i18nCompare.ts`                                          | gọi helper đối chiếu                        | `captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`, `renderCompareReport`.                                                     |
| 5   | `TC-i18n-screen-compare.spec.ts` (khi chạy)                             | →   | `reports/settings-accessibility/compare.json`                              | ghi file khi test chạy                      | HTML `compare.html` chỉ ghi khi `I18N_HTML=1`; ngoài ra HTML còn được attach vào Playwright report qua `test.info().attach`.             |
| 6   | `reports/settings-accessibility/compare.json` (+ chạy thủ công)         | →   | `docs/screens/settings-accessibility/settings-accessibility-test-cases.md` | người/skill `i18n-vietnamese-scan` viết tay | File test-cases hiện tại ghi rõ nguồn là `compare.json + compare.html`.                                                                  |

### Ghi chú

- **Không có page object hoặc spec riêng cho `settings-accessibility`.** Toàn bộ luồng "gen test" của màn này chỉ là **một lượt quét i18n** (`TC-i18n-screen-compare.spec.ts`), dùng chung với mọi màn khác trong `SCREENS`, chọn màn qua biến môi trường `I18N_SCREEN=settings-accessibility`. Không tồn tại `src/pages/settings/AccessibilityPage.ts` hay `tests/**/*Accessibility*.spec.ts` (đã Glob xác nhận không có).
- Không có `docs/linear/settings-accessibility.md` — theo `docs/screens/settings-accessibility/settings-accessibility-test-cases.md` (dòng 47): "Chưa có sub-task Linear nào (VP-2252) chỉ đích danh màn này."
- Mắt xích còn thiếu: chưa có Feature Overview / Test Cases theo skill `linear-spec-testcase` (chưa có Linear doc gốc cho màn này) — file test-cases hiện tại chỉ có phần i18n scan.
- `reports/settings-accessibility/compare.html` được file test-cases nhắc tới làm "report trực quan" nhưng chỉ được ghi ra đĩa khi chạy với `I18N_HTML=1`; mặc định spec chỉ ghi `compare.json`.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                                    | Vai trò trong luồng gen                                                                                                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@fixtures/index`)                                          | Chạy spec `TC-i18n-screen-compare.spec.ts`, điều khiển `page`.                                                                                                        |
| `page.evaluate` (DOM API trong browser)                                      | `captureTextsInPage` và `scrollThroughPage` chạy trực tiếp trong context trang để duyệt DOM, tính `scrollHeight`, `getComputedStyle`.                                 |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)                           | `routerNavigate()` điều hướng client-side tới `/settings/accessibility` để giữ ngôn ngữ đã chọn (một `page.goto` đầy đủ sẽ làm mất trạng thái ngôn ngữ trong bộ nhớ). |
| Page Object Model (`LanguageSettingsPage`)                                   | Bọc UI đổi ngôn ngữ (`/settings/language`) thành API `select('en'                                                                                                     | 'vi')`, `waitForReady()`. |
| TypeScript path alias (`@domains/i18n/...`, `@pages/...`, `@fixtures/index`) | Import gọn trong spec, cấu hình alias tại `tsconfig`/`playwright.config.ts`.                                                                                          |
| Node `fs` (`mkdirSync`, `writeFileSync`)                                     | Ghi `reports/<screen>/compare.json` (và `compare.html` khi `I18N_HTML=1`) sau khi test chạy.                                                                          |
| Playwright `test.info().attach`                                              | Đính HTML báo cáo vào Playwright HTML report để xem nhanh không cần mở file rời.                                                                                      |
| `Tag` (`@/types/testTags`)                                                   | Gắn tag `REGRESSION` cho `test.describe`.                                                                                                                             |
| Glossary tra cứu tĩnh (`GLOSSARY` trong `i18nCompare.ts`)                    | Danh sách thuật ngữ POS chuẩn tiếng Việt dùng để phân loại `ok`/`suspect`/`missing`.                                                                                  |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nCompare.ts`

- **Vai trò trong luồng:** khai báo màn `settings-accessibility` trong registry `SCREENS`, cung cấp toàn bộ hàm capture/so sánh/report dùng chung cho mọi màn.

```ts
315: 'settings-accessibility': { name: 'Hiển thị', route: '/settings/accessibility' },
```

- **Giải thích:** đây là entry duy nhất trong code liên quan trực tiếp tới "settings-accessibility" — một dòng khai báo tên hiển thị + route, không có cấu hình `gated: true` (không cần passcode) khác với ví dụ `settings-business`.
- **Công nghệ dùng để gen/chạy:** TypeScript object literal, được `TC-i18n-screen-compare.spec.ts` đọc qua `SCREENS[SCREEN]` với `SCREEN = process.env.I18N_SCREEN`.

```ts
221:222: export async function captureTexts(page: Page, rootSelector = 'body'): Promise<CapturedText[]> {
223:   return page.evaluate(captureTextsInPage, { rootSelector, dataZones: DATA_ZONE_SELECTORS });
224: }
```

- **Giải thích:** hàm chạy trong Node nhưng inject `captureTextsInPage` (một hàm serialize được) vào browser context qua `page.evaluate`, thu thập mọi text node + `placeholder`/`aria-label`/`title` hiển thị, loại trừ các "data zone" (danh sách staff/dịch vụ...).
- **Công nghệ dùng để gen/chạy:** Playwright `page.evaluate` (browser-side DOM Tree Walker), TypeScript.

```ts
253: export function pairAndClassify(en: CapturedText[], vi: CapturedText[]): ComparedPair[] {
```

- **Giải thích:** join hai lượt capture EN/VI theo key đường dẫn DOM, phân loại từng cặp thành `ok` / `missing` / `suspect` / `data` dựa trên `GLOSSARY`.
- **Công nghệ dùng để gen/chạy:** logic thuần TypeScript, không phụ thuộc trình duyệt.

#### 2. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** spec Playwright DUY NHẤT chạy cho màn này (chọn qua env `I18N_SCREEN=settings-accessibility`), thực hiện quét EN → đổi VI → quét lại → so sánh → ghi báo cáo.

```ts
39: const SCREEN = process.env.I18N_SCREEN || 'home';
...
45: const def = SCREENS[SCREEN];
...
52:    const lang = new LanguageSettingsPage(page);
53:    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
54:    await lang.waitForReady();
55:    await lang.select('en');
56:    await routerNavigate(page, def.route);
...
62:    // Scroll the whole body so lazy/below-the-fold content mounts before capture.
63:    await scrollThroughPage(page);
64:    const en = await captureTexts(page);
```

- **Giải thích:** với `settings-accessibility`, `def.gated` là `undefined` (falsy) nên bước `enterPasscodeIfPrompted` bị bỏ qua trong thực tế — spec vẫn gọi `if (def.gated) {...}` nhưng nhánh này không chạy cho màn này.
- **Công nghệ dùng để gen/chạy:** Playwright Test runner, custom fixtures (`@fixtures/index`), Page Object (`LanguageSettingsPage`), helper `routerNavigate`/`scrollThroughPage` (đều chạy `page.evaluate`).

```ts
90:    const outDir = path.resolve('reports', SCREEN);
91:    mkdirSync(outDir, { recursive: true });
...
94:    const jsonPath = path.join(outDir, `compare.json`);
95:    const htmlPath = path.join(outDir, `compare.html`);
96:    writeFileSync(jsonPath, JSON.stringify({ ... }, null, 2), 'utf8');
...
128:    if (process.env.I18N_HTML === '1') {
129:      writeFileSync(htmlPath, html, 'utf8');
130:    }
131:    await test.info().attach(`compare-${SCREEN}.html`, { body: html, contentType: 'text/html' });
```

- **Giải thích:** khi chạy với `SCREEN = 'settings-accessibility'`, output đi vào `reports/settings-accessibility/compare.json` — đúng như nguồn tham chiếu ghi trong `settings-accessibility-test-cases.md`. `compare.html` chỉ tồn tại trên đĩa nếu chạy với `I18N_HTML=1`.
- **Công nghệ dùng để gen/chạy:** Node `fs`/`path`, Playwright `test.info().attach` để nhúng HTML vào report chuẩn của Playwright.

```ts
158:    if (process.env.I18N_LENIENT !== '1') {
159:      expect
160:        .soft(missing, `Màn "${SCREEN}": còn ${missing.length} chuỗi CHƯA dịch sang Tiếng Việt`)
161:        .toHaveLength(0);
162:    }
```

- **Giải thích:** cổng chặn (gate) chỉ fail khi còn chuỗi tiếng Anh chưa dịch (`missing`); `suspect` (sai chuẩn thuật ngữ) và UI vỡ chỉ report, không fail test — khớp với kết quả 0/0/0 trong test-cases.md.
- **Công nghệ dùng để gen/chạy:** Playwright `expect.soft` (soft assertion — không dừng test ngay khi fail).

#### 3. `src/domains/i18n/i18nScan.ts`

- **Vai trò trong luồng:** cung cấp các helper điều hướng/quét dùng chung: đổi ngôn ngữ, điều hướng giữ ngôn ngữ, cuộn hết trang, nhập passcode, quét leftover-English + UI vỡ.

```ts
728: export async function switchToVietnamese(page: Page): Promise<void> {
729:   await page.goto('\settings\language', { waitUntil: 'domcontentloaded' });
730:   // The radio row carries the visible language name.
731:   const viRow = page.getByText('Tiếng Việt', { exact: true });
732:   await viRow.waitFor({ state: 'visible', timeout: 15_000 });
733:   await viRow.click();
734:   await page.getByText('Đơn đang chờ', { exact: true }).first().waitFor({ timeout: 10_000 });
735: }
```

- **Giải thích:** đổi ngôn ngữ sang Tiếng Việt bằng cách click radio "Tiếng Việt" trên `/settings/language`, rồi chờ một anchor text tiếng Việt cố định ("Đơn đang chờ") xuất hiện để xác nhận đổi thành công trước khi điều hướng tiếp tới `/settings/accessibility`.
- **Công nghệ dùng để gen/chạy:** Playwright locator `getByText(..., { exact: true })`, `waitFor`.

```ts
742: export async function routerNavigate(page: Page, to: string): Promise<void> {
743:   await page.evaluate((dest) => {
744:     const r = (
745:       window as unknown as { __TSR_ROUTER__?: { navigate: (o: { to: string }) => unknown } }
746:     ).__TSR_ROUTER__;
747:     r?.navigate({ to: dest });
748:   }, to);
749: }
```

- **Giải thích:** thay vì `page.goto('/settings/accessibility')` (full reload, mất ngôn ngữ đang chọn trong memory), hàm này gọi trực tiếp router nội bộ của app (TanStack Router) đã được app expose ra `window.__TSR_ROUTER__`, giữ nguyên state ngôn ngữ.
- **Công nghệ dùng để gen/chạy:** Playwright `page.evaluate`, TanStack Router runtime API của ứng dụng dưới test.

```ts
759: export async function scrollThroughPage(page: Page, stepPause = 180): Promise<void> {
760:   try {
761:     // 1) Collect scrollable targets (the window + any overflow:auto/scroll box
762:     //    taller than its client height) and their max scrollTop, in-page.
763:     const targets = await page.evaluate(() => {
...
778:     const passes = Math.min(24, Math.max(6, targets * 4));
```

- **Giải thích:** trước khi capture, hàm cuộn cả `window` và mọi container có `overflow: auto/scroll/overlay` cao hơn client height, theo nhiều bước (6–24 lần tuỳ số lượng target), để nội dung lazy-mount trước khi quét — tránh bỏ sót phần dưới trang (bài học VP-2252 được nêu trong docstring của hàm, dòng 752-758).
- **Công nghệ dùng để gen/chạy:** Playwright `page.evaluate`, DOM `scrollHeight`/`clientHeight`/`getComputedStyle`.

```ts
813: export async function enterPasscodeIfPrompted(page: Page, code = '8888'): Promise<boolean> {
814:   const dialog = page.getByRole('dialog');
815:   const visible = await dialog.first().isVisible().catch(() => false);
816:   if (!visible) return false;
```

- **Giải thích:** với `settings-accessibility`, `def.gated` không được set nên spec không gọi hàm này trong nhánh thực thi — hàm chỉ áp dụng cho các màn `gated: true` khác (ví dụ `settings-business`, các màn income).
- **Công nghệ dùng để gen/chạy:** Playwright `getByRole('dialog')`.

#### 4. `src/pages/settings/LanguageSettingsPage.ts`

- **Vai trò trong luồng:** Page Object cho `/settings/language`, dùng ở bước đầu spec để chuyển sang tiếng Anh trước lượt quét EN (bước chuyển sang tiếng Việt lại dùng `switchToVietnamese()` ở `i18nScan.ts`, không qua page object này).

```ts
17: export class LanguageSettingsPage extends BasePage {
18:   protected readonly path = '/settings/language';
...
25:   static readonly ANCHORS = {
26:     en: { nav: 'Pending Orders', sidebar: 'Setting', subtitle: 'Choose your primary language' },
27:     vi: { nav: 'Đơn đang chờ', sidebar: 'Cài đặt', subtitle: 'Chọn ngôn ngữ chính của bạn' },
28:   } as const;
```

- **Giải thích:** class kế thừa `BasePage` chung của repo, khai báo các locator/anchor ổn định (không đổi theo ngôn ngữ đang chọn) để xác nhận trạng thái ngôn ngữ hiện tại.
- **Công nghệ dùng để gen/chạy:** Playwright `Locator`, mô hình Page Object Model chuẩn của repo (`BasePage`).

### So với sơ đồ Flow Map

- Sơ đồ Flow Map ở trên **đơn giản hơn thực tế theo một hướng quan trọng**: không có nhánh riêng cho `settings-accessibility` trong code — mọi bước (spec, page object, helper) đều là code **chung cho tất cả màn** trong `SCREENS`, chỉ khác nhau ở giá trị `I18N_SCREEN` truyền vào lúc chạy. Vì vậy bảng mắt xích ghi tên file dùng chung, không có file "riêng" nào tên `*Accessibility*`.
- Điểm khác với các màn đã có Linear feature-spec (ví dụ `income-daily`, `home`): không có bước `Linear doc → test-cases.md (Feature Overview)`; file `settings-accessibility-test-cases.md` hiện chỉ có phần i18n scan, đúng như tiêu đề "Tài liệu hợp nhất (i18n; feature/testcase bổ sung sau)".
- Bước ghi HTML (`compare.html`) trong sơ đồ có điều kiện (`I18N_HTML=1`) — nếu chạy spec ở chế độ mặc định, mắt xích "→ compare.html" không xảy ra, chỉ có `compare.json` và HTML đính trong Playwright report.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Accessibility (Hiển thị)** · route `/settings/accessibility` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **3** · 📐 UI vỡ **0**
> Số liệu máy quét: 44 cặp EN↔VI · ✅ đúng glossary 36 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-accessibility/compare.json` · HTML: `reports/settings-accessibility/settings-accessibility.html`
> Cách quét: `I18N_SCREEN=settings-accessibility I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Gồm 2 khối: bàn phím ảo và bật/tắt xác thực Passcode.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                            | Gốc (EN)                                        | Nên dùng (chuẩn)                                                                   | Vì sao                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hiển thị                                 | Accessibility                                   | **Trợ năng**                                                                       | Nội dung màn là **bàn phím ảo + xác thực passcode**, không phải cấu hình hiển thị. “Hiển thị” (= Display) làm người dùng tìm sai chỗ; “Trợ năng” là chuẩn tiếng Việt cho Accessibility. |
| Chọn các tuỳ chọn hiển thị               | Choose your accessibility settings              | **Chọn các tuỳ chọn trợ năng**                                                     | Kéo theo lỗi trên.                                                                                                                                                                      |
| Cài đặt Passcode / Bật xác thực Passcode | Passcode Setting / Enable Passcode Verification | **Giữ “Passcode” (đang nhất quán toàn app) — hoặc đổi đồng loạt sang “Mã bảo vệ”** | Không phải lỗi: “Passcode” được giữ nguyên ở mọi màn. Chỉ cần quyết định 1 lần cho cả app.                                                                                              |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Cài đặt bàn phím (Keyboard Setting) · Hiển thị bàn phím ảo (Show the virtual keyboard)
- Khi tắt, các thao tác yêu cầu Passcode sẽ được thực hiện ngay mà không cần xác thực.

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất `GLOSSARY`:** `Accessibility: ['Trợ năng']`.
- Không bấm switch khi quét — “Enable Passcode Verification” là cấu hình merchant-wide, đổi là ảnh hưởng cả suite (xem `EXCLUSIVE_SPECS` trong `playwright.config.ts`).

### 6. Nguồn tham chiếu

- JSON: `reports/settings-accessibility/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-accessibility`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
