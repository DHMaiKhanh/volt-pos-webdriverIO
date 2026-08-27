---
title: Code Detail — Settings Services
generated-at: 2026-07-17
---

# Settings Services — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
src/domains/i18n/i18nCompare.ts (SCREENS['settings-services'] = { route: '/settings/services' })
  └─(khai báo màn quét)→ tests/regression/i18n/TC-i18n-screen-compare.spec.ts
        · I18N_SCREEN=settings-services npx playwright test TC-i18n-screen-compare.spec.ts
        └─(EN pass + VI pass, captureTexts + pairAndClassify)→ reports/settings-services/compare.json
              (compare.html chỉ ghi khi I18N_HTML=1 — debug)
              └─(khâu viết tài liệu, thủ công/skill)→ docs/screens/settings-services/settings-services-test-cases.md

src/domains/i18n/i18nScan.ts (STATIC_ROUTES: '/settings/services' | DATA_ZONE_SELECTORS: 'a[href*="/settings/services/"]')
  └─(quét toàn site)→ tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts
        ├─ scanRoute(page, { path: '/settings/services', ... })  — quét view mặc định
        ├─ scanDynamic('/settings/services', 'Chi tiết danh mục', 'Settings',
        │     'main a[href*="services/"], main a.cursor-pointer')  — mở /settings/services/$categoryId
        └─ scanRowDetail('/settings/services', 'Dịch vụ & Sản phẩm → chi tiết', 'Settings',
              ['main a.cursor-pointer', 'main [role="button"]'])  — mở dialog chi tiết sản phẩm
        └─(ghi report)→ reports/i18n-audit/auto-scan.{html,json}
```

### Bảng mắt xích

| #   | File nguồn                                                                                                                                     | →   | File đích                                                        | Khâu tạo                                                                                             | Ghi chú                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `src/domains/i18n/i18nCompare.ts` (`SCREENS['settings-services']`)                                                                             | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`           | đăng ký route để spec đọc qua `I18N_SCREEN`                                                          | Route `/settings/services`, không `gated`                                   |
| 2   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                                                                                         | →   | `reports/settings-services/compare.json`                         | chạy spec (EN pass → VI pass → `pairAndClassify`)                                                    | `compare.html` chỉ ghi khi `I18N_HTML=1`                                    |
| 3   | `reports/settings-services/compare.json`                                                                                                       | →   | `docs/screens/settings-services/settings-services-test-cases.md` | viết tài liệu (thủ công/skill `i18n-vietnamese-scan`)                                                | File đã tồn tại, không chỉnh sửa trong task này                             |
| 4   | `src/domains/i18n/i18nScan.ts` (`STATIC_ROUTES`, `DATA_ZONE_SELECTORS`)                                                                        | →   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`          | khai báo route tĩnh + vùng data cần loại trừ                                                         | Dùng chung cho toàn bộ 22 route, không riêng cho màn này                    |
| 5   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` (`scanDynamic('/settings/services', ...)`, `scanRowDetail('/settings/services', ...)`) | →   | `reports/i18n-audit/auto-scan.{html,json}`                       | best-effort mở trang chi tiết danh mục (`/settings/services/$categoryId`) + dialog sản phẩm rồi quét | Đây là nơi DUY NHẤT trong code hiện có chạm tới route dynamic `$categoryId` |

### Ghi chú

- **Không có page object riêng** cho settings-services trong `src/pages/` (đã Glob `src/pages/**/*Service*` → không có kết quả) và **không có spec riêng** (`tests/**/*settings-services*`, `tests/**/*Service*` → không có kết quả ngoài các spec i18n dùng chung ở trên).
- Route `/settings/services/$categoryId` (trang chi tiết danh mục) **chưa có route object/spec test-case riêng** — mắt xích duy nhất đang tồn tại là hàm `scanDynamic()` trong `TC-i18n-vietnamese-scan.spec.ts`, mở trang chi tiết bằng cách click `main a[href*="services/"], main a.cursor-pointer` rồi quét leftover-English (best-effort, không fail nếu không có data).
- Vì vậy, đúng như `docs/screens/README.md` đã nêu: màn này hiện chỉ có **luồng i18n-scan** (quét chuỗi tiếng Anh còn sót + so sánh chất lượng dịch EN↔VI), chưa có **Feature Spec / Test Case functional** hay codegen page-object/spec riêng. Luồng code mô tả dưới đây là luồng thật đang chạy, không phải luồng codegen test case thông thường (Linear → test-cases.md → page object → spec).
- Không tìm thấy `docs/linear/settings-services*.md` (đã Glob `docs/linear/*` → không có thư mục/file nào tồn tại trong repo).

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                               | Vai trò trong luồng gen                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@playwright/test`, custom fixtures `@fixtures/index`) | Chạy 2 spec i18n (`TC-i18n-screen-compare.spec.ts`, `TC-i18n-vietnamese-scan.spec.ts`) trong `tests/regression/i18n/`                  |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)                      | `routerNavigate()` điều hướng client-side tới `/settings/services` mà không mất trạng thái ngôn ngữ (VI không persist qua full reload) |
| `page.evaluate` (Playwright in-browser eval)                            | `detectScope()` / `captureTextsInPage()` chạy trực tiếp trong DOM để bắt chuỗi tiếng Anh còn sót và chụp text EN/VI theo DOM-path key  |
| TypeScript path alias (`@domains/i18n/*`, `@pages/*`, `@/types/*`)      | Import các helper dùng chung (`i18nScan.ts`, `i18nCompare.ts`) và `LanguageSettingsPage`                                               |
| Biến môi trường (`I18N_SCREEN`, `I18N_HTML`, `I18N_LENIENT`)            | Chọn màn cần compare, bật ghi HTML debug, và chuyển gate sang chế độ chỉ báo cáo (không fail)                                          |
| Node `fs` (`mkdirSync`/`writeFileSync`)                                 | Ghi `reports/settings-services/compare.json` (và `compare.html` nếu `I18N_HTML=1`) / `reports/i18n-audit/auto-scan.{html,json}`        |
| Playwright soft assertions (`expect.soft`)                              | Gate không abort ngay khi phát hiện chuỗi chưa dịch — liệt kê hết rồi mới fail cuối bài                                                |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nCompare.ts`

- **Vai trò trong luồng:** đăng ký `settings-services` vào registry `SCREENS` để spec compare biết route cần mở; cũng chứa toàn bộ logic capture + so khớp EN↔VI dùng chung cho mọi màn.

```ts
311	  'settings-business': { name: 'Thông tin doanh nghiệp', route: '/settings/business', gated: true },
312	  'settings-services': { name: 'Dịch vụ & Sản phẩm', route: '/settings/services' },
313	  'settings-staffs': { name: 'Nhân viên', route: '/settings/staffs' },
```

- **Giải thích:** `settings-services` không đặt `gated: true` (khác `settings-business`), nên spec compare không cần bước nhập passcode trước khi quét.
- **Công nghệ dùng để gen/chạy:** TypeScript `Record<string, ScreenDef>` — registry tra cứu bằng key màn hình (`I18N_SCREEN=settings-services`).

#### 2. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** spec thật sự tạo ra `reports/settings-services/compare.json` — nguồn dữ liệu cho `settings-services-test-cases.md`.

```ts
39	const SCREEN = process.env.I18N_SCREEN || 'home';
...
51	    // 1) ENGLISH pass — switch to English, navigate client-side, capture.
52	    const lang = new LanguageSettingsPage(page);
53	    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
54	    await lang.waitForReady();
55	    await lang.select('en');
56	    await routerNavigate(page, def.route);
57	    await page.waitForTimeout(1800);
58	    if (def.gated) {
59	      await enterPasscodeIfPrompted(page).catch(() => {});
60	      await page.waitForTimeout(1000);
61	    }
62	    // Scroll the whole body so lazy/below-the-fold content mounts before capture.
63	    await scrollThroughPage(page);
64	    const en = await captureTexts(page);
```

- **Giải thích:** đọc `SCREENS[SCREEN]` (với `SCREEN='settings-services'` qua env var), chuyển ngôn ngữ UI sang English bằng `LanguageSettingsPage`, điều hướng router tới `/settings/services`, cuộn hết trang (`scrollThroughPage`) để mount nội dung lazy rồi chụp mọi chuỗi hiển thị (`captureTexts`). Lặp lại bước tương tự sau khi `switchToVietnamese(page)` để có cặp EN/VI theo cùng DOM-path key, sau đó `pairAndClassify` phân loại `missing/suspect/ok` và ghi JSON.
- **Công nghệ dùng để gen/chạy:** Playwright Test + fixtures, TanStack Router client-navigate, page object `LanguageSettingsPage` (`@pages/settings/LanguageSettingsPage`), Node `fs` để ghi report.

#### 3. `src/domains/i18n/i18nScan.ts`

- **Vai trò trong luồng:** khai báo route tĩnh `/settings/services` trong `STATIC_ROUTES` và selector loại trừ vùng dữ liệu merchant (`DATA_ZONE_SELECTORS`) cho danh sách dịch vụ/danh mục.

```ts
39	  { path: '/settings/services', name: 'Dịch vụ & Sản phẩm', group: 'Settings' },
...
168	export const DATA_ZONE_SELECTORS = [
169	  '#home-staff-listing', // POS staff cards (names)
170	  'a[href*="/settings/staffs/"]', // staff list rows
171	  'a[href*="/settings/services/"]', // service / category settings rows
172	  'a[href*="/order-history/"]', // order-history cards
173	];
```

- **Giải thích:** `a[href*="/settings/services/"]` loại trừ tên dịch vụ/danh mục (dữ liệu merchant) khỏi cả 2 detector (`detectScope` cho leftover-English, `captureTextsInPage` cho EN↔VI compare) — tránh báo lỗi sai khi tên sản phẩm/danh mục vốn không cần dịch.
- **Công nghệ dùng để gen/chạy:** mảng CSS selector dùng trong `page.evaluate` (chạy trong browser context).

#### 4. `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`

- **Vai trò trong luồng:** spec quét toàn site; đây là nơi duy nhất trong code hiện có **mở trang chi tiết danh mục** `/settings/services/$categoryId` và **dialog chi tiết sản phẩm**.

```ts
199	    const scanDynamic = async (
200	      listPath: string,
201	      name: string,
202	      group: RouteScan['group'],
203	      clickSelector: string,
204	    ): Promise<void> => {
205	      try {
206	        await routerNavigate(page, listPath);
207	        await page.waitForTimeout(1500);
208	        await enterPasscodeIfPrompted(page).catch(() => {});
209	        const target = page.locator(clickSelector).first();
210	        if (!(await target.isVisible().catch(() => false))) return;
211	        await target.click();
212	        await page.waitForTimeout(1800);
213	        const raw = await detectBody(page);
214	        await record({
215	          ...raw,
216	          route: `${listPath} → chi tiết`,
217	          name,
218	          group,
219	          redirected: raw.path === listPath,
220	        });
221	      } catch {
222	        /* no data to open — skip */
223	      }
224	    };
...
238	    await scanDynamic(
239	      '/settings/services',
240	      'Chi tiết danh mục',
241	      'Settings',
242	      'main a[href*="services/"], main a.cursor-pointer',
243	    );
```

và:

```ts
583	    // Product — open a product on the Services & Products screen (opens a dialog).
584	    await scanRowDetail('/settings/services', 'Dịch vụ & Sản phẩm → chi tiết', 'Settings', [
585	      'main a.cursor-pointer',
586	      'main [role="button"]',
587	    ]);
```

- **Giải thích:** `scanDynamic('/settings/services', ...)` click phần tử `main a[href*="services/"], main a.cursor-pointer` đầu tiên để mở trang con `/settings/services/$categoryId` (route dynamic của TanStack Router theo file `docs/linear` không tồn tại, nhưng route được suy ra từ đường link `href*="services/"`), rồi quét toàn body (`detectBody`) tìm chuỗi tiếng Anh còn sót. Bên dưới, `scanRowDetail('/settings/services', ...)` lại click item khác để mở **dialog** chi tiết sản phẩm và quét luôn. Cả hai đều best-effort (bọc `try/catch`, không có data thì bỏ qua, không làm fail scan chính).
- **Công nghệ dùng để gen/chạy:** Playwright locator + click, `page.waitForTimeout` để đợi UI render, hàm dùng chung `detectBody()`/`enterPasscodeIfPrompted()` từ `i18nScan.ts`.

#### 5. `src/domains/i18n/i18nScan.ts` — `detectScope()` (detector lõi)

- **Vai trò trong luồng:** hàm chạy **trong browser** (serialize qua `page.evaluate`) — logic thật quyết định một chuỗi có bị coi là "còn tiếng Anh" hay không cho mọi route tĩnh/động, bao gồm `/settings/services` và trang chi tiết của nó.

```ts
203	export function detectScope(opts: DetectOpts): RawDetect {
204	  const { rootSelector, dataZones = [], dataValues = [] } = opts;
...
501	  const isEnglish = (t: string): boolean => {
502	    if (fpExact.has(t)) return false;
503	    if (viet.test(t)) return false;
504	    if (forceEnglish.test(t)) return true; // known hardcoded-EN phrase (WELCOME TO …)
505	    const tokens = t.toLowerCase().match(/[a-z]+/g) || [];
506	    const dictCount = tokens.filter((x) => ui.has(x)).length;
507	    if (dictCount === 0) return false;
508	    if (/^[$\d.,:()/\s+%@#-]+$/.test(t)) return false; // money / numeric / code
509	    if (/^[A-Z0-9-]{6,}$/.test(t)) return false; // device id / order code
510	    if (looksLikeData(t, dictCount, tokens)) return false; // merchant data, not UI
511	    return true;
512	  };
```

- **Giải thích:** một chuỗi bị gắn cờ "tiếng Anh" khi (a) không có dấu tiếng Việt, (b) có ít nhất 1 từ trong từ điển UI đã curate (`ui` Set gồm "service", "product", "active", "inactive" — các từ đúng cho màn Dịch vụ & Sản phẩm, comment VP-2270/VP-2271/VP-2278 trong đầu file spec scan xác nhận điều này), và (c) không "trông như dữ liệu" (`looksLikeData` loại tên danh mục/dịch vụ dạng proper-noun nhiều từ, mã ALL-CAPS...).
- **Công nghệ dùng để gen/chạy:** hàm self-contained (`/* eslint-disable */` vì không có outer scope) chạy bằng `page.evaluate`, không phụ thuộc Node — thuần DOM API (`TreeWalker`, `getComputedStyle`, `getBoundingClientRect`).

### So với sơ đồ Flow Map

- Sơ đồ ở trên đầy đủ hơn README tổng (`docs/screens/README.md`) vì chỉ ra chính xác 2 spec (`TC-i18n-screen-compare.spec.ts`, `TC-i18n-vietnamese-scan.spec.ts`) và 2 helper module (`i18nScan.ts`, `i18nCompare.ts`) tham gia, thay vì chỉ nói "đã có i18n-scan".
- Điểm khác biệt so với sơ đồ chuẩn (Linear → test-cases.md → page object → spec) của các màn khác: **không có bước Linear/feature-spec, không có page object riêng**. Route dynamic `/settings/services/$categoryId` chỉ được chạm tới gián tiếp qua `scanDynamic()`/`scanRowDetail()` trong spec quét toàn site — chưa có test case functional (thêm/sửa/xoá dịch vụ, mở danh mục...) nào được sinh riêng cho màn này.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Services & Products (Dịch vụ & Sản phẩm)** · route `/settings/services` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **0** · 📐 UI vỡ **0**
> Số liệu máy quét: 42 cặp EN↔VI · ✅ đúng glossary 34 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-services/compare.json` · HTML: `reports/settings-services/settings-services.html`
> Cách quét: `I18N_SCREEN=settings-services I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Quét ở mức khung danh sách danh mục + panel “Chọn một danh mục để xem chi tiết.”

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

> Không phát hiện chuỗi dịch lệch chuẩn ở phạm vi đã quét.

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang và **không có UI vỡ**. Chuỗi "Cập nhật" từng bị báo cắt là nhãn **`sr-only`** của nút icon sửa danh mục (`category-list-item.tsx:37`) — vô hình có chủ đích.

### 4. ✅ Đã dịch đúng (mẫu)

- Danh mục (Category) · Đang hoạt động / Ngưng hoạt động (Active / Inactive)
- Chọn một danh mục để xem chi tiết. (Select a category to view details.)
- aria-label Sắp xếp danh mục hoặc dịch vụ (Reorder Categories or Services)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: các dialog Tạo/Sửa dịch vụ, Tạo/Sửa sản phẩm, Reorder — scan theo route không mở dialog. Cần lượt quét riêng nếu muốn phủ.
- Tên danh mục/dịch vụ trong danh sách là **dữ liệu** (Artificial Nails, Hand Care…) → không phải lỗi dịch.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-services/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-services`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
