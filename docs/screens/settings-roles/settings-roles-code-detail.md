---
title: Code Detail — Settings Roles
generated-at: 2026-07-17
---

# Settings Roles — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
docs/screens/settings-roles/settings-roles-test-cases.md (đã có — chỉ phần i18n)
   │  (KHÔNG có Linear feature-spec / test-case gen riêng cho màn này)
   │
   ├─ luồng A: quét toàn app (bắt buộc, chạy mỗi lần regression)
   │  tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts
   │     └─ STATIC_ROUTES['/settings/roles']            (src/domains/i18n/i18nScan.ts:41)
   │          └─ scanRoute()                             (src/domains/i18n/i18nScan.ts)
   │     └─ scanDynamic('/settings/roles', 'Chi tiết vai trò', 'Settings',
   │          'main a, main [role=button]')              (spec dòng 232-237)
   │          └─ routerNavigate() + enterPasscodeIfPrompted() + detectBody()
   │              (src/domains/i18n/i18nScan.ts)
   │     └─(khi chạy)→ reports/i18n-audit/auto-scan.{html,json} + auto-screens/*.png
   │
   └─ luồng B: quét riêng 1 màn (theo skill i18n-vietnamese-scan, đã chạy 2026-07-06)
      tests/regression/i18n/TC-i18n-screen-compare.spec.ts (I18N_SCREEN=settings-roles)
         └─ SCREENS['settings-roles']                    (src/domains/i18n/i18nCompare.ts:314)
         └─ scrollThroughPage() + captureTexts() + pairAndClassify()
              (src/domains/i18n/i18nScan.ts, src/domains/i18n/i18nCompare.ts)
         └─(khi chạy)→ reports/settings-roles/compare.json (+ compare.html nếu I18N_HTML=1)
         └─(skill tổng hợp)→ docs/screens/settings-roles/settings-roles-test-cases.md
```

### Bảng mắt xích

| #   | File nguồn                                                                      | →   | File đích                                                                                                                                                                                                              | Khâu tạo                                                                                        | Ghi chú                                                                                                      |
| --- | ------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `src/domains/i18n/i18nScan.ts` (`STATIC_ROUTES`, dòng 41)                       | →   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`                                                                                                                                                                | Khai báo route tĩnh `/settings/roles` để quét toàn app                                          | Không có page object riêng, dùng chung `scanRoute()`                                                         |
| 2   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` (dòng 199-224, 232-237) | →   | `src/domains/i18n/i18nScan.ts` (`routerNavigate`, `enterPasscodeIfPrompted`, `detectBody`)                                                                                                                             | `scanDynamic()` mở trang chi tiết vai trò bằng cách click `main a, main [role=button]`          | Đây là "page object thay thế" cho panel chi tiết `/settings/roles/$roleId` — không có class page object thật |
| 3   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`                         | →   | `reports/i18n-audit/auto-scan.html` / `.json`                                                                                                                                                                          | Ghi report tổng khi chạy                                                                        | Report chung cho mọi màn, không tách riêng settings-roles                                                    |
| 4   | `src/domains/i18n/i18nCompare.ts` (`SCREENS['settings-roles']`, dòng 314)       | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts` (chạy với `I18N_SCREEN=settings-roles`)                                                                                                                         | Định nghĩa route `/settings/roles`, `gated: undefined` (không gate) cho luồng compare riêng màn |                                                                                                              |
| 5   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                          | →   | `src/domains/i18n/i18nScan.ts` (`scrollThroughPage`, `switchToVietnamese`, `routerNavigate`) + `src/domains/i18n/i18nCompare.ts` (`captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`, `renderCompareReport`) | Quét EN rồi VI, join theo DOM-path, phân loại `missing/suspect/ok`                              |                                                                                                              |
| 6   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                          | →   | `reports/settings-roles/compare.json` (+ `compare.html` nếu `I18N_HTML=1`)                                                                                                                                             | Ghi kết quả compare riêng cho màn này                                                           | Nguồn dữ liệu đã dùng để viết `settings-roles-test-cases.md`                                                 |
| 7   | `reports/settings-roles/compare.json`                                           | →   | `docs/screens/settings-roles/settings-roles-test-cases.md`                                                                                                                                                             | Skill `i18n-vietnamese-scan` tổng hợp thủ công/agent                                            | File đã tồn tại, không sửa trong task này                                                                    |

### Ghi chú

- **Không có page object riêng** cho `/settings/roles` (không có file kiểu `src/pages/settings/RolesPage.ts`) và **không có spec test case chức năng** (không có `TC-*roles*.spec.ts` trong `tests/regression/` ngoài các spec i18n dùng chung). Đã `Glob` `**/*Role*`, `**/*roles*` và `Grep` `settings-roles` trên toàn repo — chỉ khớp 3 file: `docs/screens/settings-roles/settings-roles-test-cases.md`, `docs/screens/README.md`, `src/domains/i18n/i18nCompare.ts`.
- **Không có `docs/linear/settings-roles.md`** — chưa có Linear feature-spec cho màn này (test-cases.md ghi rõ: "Đặc tả tính năng & test case sẽ bổ sung... khi chạy skill 1/2").
- Route chi tiết `/settings/roles/$roleId` (định danh trong `docs/screens/README.md` dòng 152, 459, 672) **không có route/page-object riêng trong repo test** — nó chỉ được chạm tới gián tiếp qua `scanDynamic()` bằng cách click phần tử đầu tiên khớp selector `main a, main [role=button]` trên trang danh sách, rồi quét nội dung trang vừa điều hướng tới bằng `detectBody()`. Đây là mắt xích **thay thế tạm**, không phải test case thật cho trang chi tiết.
- Vì vậy luồng code hiện tại của "settings-roles" **chỉ là luồng quét i18n** (2 spec dùng chung cho mọi màn), không có luồng gen test-case/page-object/spec riêng theo mẫu Linear → test-cases.md → page object → spec như các màn đã có TC chức năng.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                                        | Vai trò trong luồng gen                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Playwright Test (`@fixtures/index`)                                              | Chạy 2 spec i18n (`TC-i18n-vietnamese-scan.spec.ts`, `TC-i18n-screen-compare.spec.ts`) đi qua `/settings/roles`          |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)                               | `routerNavigate()` điều hướng client-side để giữ ngôn ngữ Tiếng Việt trong bộ nhớ (full `page.goto` sẽ reset về English) |
| TypeScript path alias `@domains/i18n/...`, `@fixtures/index`, `@/types/testTags` | Import các helper/registry dùng chung thay vì đường dẫn tương đối dài                                                    |
| DOM-path capture + glossary (`i18nCompare.ts`)                                   | Ghép cặp chuỗi EN↔VI theo `key` cấu trúc DOM, phân loại `missing/suspect/ok`                                             |
| Node `fs` (`mkdirSync`, `writeFileSync`)                                         | Ghi `reports/settings-roles/compare.json` (+ `.html` khi `I18N_HTML=1`) và `reports/i18n-audit/auto-scan.*`              |
| Playwright locator best-effort (`isVisible().catch(() => false)`)                | `scanDynamic()` không fail toàn bộ scan khi trang danh sách vai trò trống hoặc không có phần tử để click                 |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nScan.ts` — khai báo route tĩnh (dòng 39-43)

- **Vai trò trong luồng:** đăng ký `/settings/roles` vào danh sách route được quét tự động mỗi lần chạy `TC-i18n-vietnamese-scan.spec.ts`.

```ts
39	  { path: '/settings/services', name: 'Dịch vụ & Sản phẩm', group: 'Settings' },
40	  { path: '/settings/staffs', name: 'Nhân viên', group: 'Settings' },
41	  { path: '/settings/roles', name: 'Vai trò', group: 'Settings' },
42	  { path: '/settings/permissions', name: 'Quyền hạn', group: 'Settings', expandAll: true },
43	  { path: '/settings/receipt', name: 'Hóa đơn (mẫu in)', group: 'Settings' },
```

- **Giải thích:** mỗi entry trong `STATIC_ROUTES` chỉ cần path + tên hiển thị + group; `scanRoute()` (dùng chung cho mọi route) sẽ điều hướng tới và quét — không có logic đặc thù cho settings-roles ở bước này.
- **Công nghệ dùng để gen/chạy:** mảng cấu hình TypeScript, tiêu thụ bởi Playwright Test khi spec lặp `for (const def of STATIC_ROUTES)`.

#### 2. `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` — `scanDynamic()` cho trang chi tiết vai trò (dòng 199-224, gọi tại 232-237)

- **Vai trò trong luồng:** đây là mắt xích duy nhất chạm tới `/settings/roles/$roleId` — vì không có page object/spec riêng, hàm này đóng vai "page object tối giản": mở danh sách, click item đầu, quét trang chi tiết.

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
```

Lệnh gọi cho settings-roles:

```ts
232	    await scanDynamic(
233	      '/settings/roles',
234	      'Chi tiết vai trò',
235	      'Settings',
236	      'main a, main [role=button]',
237	    );
```

- **Giải thích:** `routerNavigate()` đưa trang về `/settings/roles` bằng router client-side (giữ ngôn ngữ VI đã chọn trước đó), chờ UI ổn định, thử nhập passcode nếu có gate, rồi tìm phần tử đầu tiên khớp `main a, main [role=button]` (vì danh sách vai trò không có `href` cố định dạng `roles/:id`, nên selector rộng hơn selector của staffs `main a.cursor-pointer`). Nếu không thấy gì hiển thị (danh sách rỗng) thì bỏ qua, không fail cả suite. Khi click được, đợi rồi gọi `detectBody()` để quét text trên panel/trang chi tiết vừa mở, gắn `route` là `"/settings/roles → chi tiết"` để phân biệt với trang danh sách trong report.
- **Công nghệ dùng để gen/chạy:** Playwright locator + `catch(() => false)` để best-effort; TanStack Router qua `routerNavigate()`.

#### 3. `src/domains/i18n/i18nScan.ts` — `routerNavigate()` (dòng 738-749)

- **Vai trò trong luồng:** điều hướng SPA giữ nguyên state ngôn ngữ đang chọn, dùng ở cả `scanDynamic()` (mục 2) và ở `TC-i18n-screen-compare.spec.ts`.

```ts
738	/**
739	 * Client-side navigate via the TanStack router so the in-memory language stays
740	 * Vietnamese (a full `page.goto` would revert to English — see file header).
741	 */
742	export async function routerNavigate(page: Page, to: string): Promise<void> {
743	  await page.evaluate((dest) => {
744	    const r = (
745	      window as unknown as { __TSR_ROUTER__?: { navigate: (o: { to: string }) => unknown } }
746	    ).__TSR_ROUTER__;
747	    r?.navigate({ to: dest });
748	  }, to);
749	}
750
```

- **Giải thích:** gọi vào biến toàn cục `window.__TSR_ROUTER__` mà app expose (TanStack Router) để `navigate({ to })` thay vì `page.goto`, tránh việc reload trang làm mất ngôn ngữ VI đang set trong bộ nhớ.
- **Công nghệ dùng để gen/chạy:** `page.evaluate()` của Playwright chạy JS trong context trình duyệt; phụ thuộc TanStack Router expose `__TSR_ROUTER__` trên `window`.

#### 4. `src/domains/i18n/i18nCompare.ts` — khai báo `SCREENS['settings-roles']` (dòng 314)

- **Vai trò trong luồng:** cấu hình cho `TC-i18n-screen-compare.spec.ts` khi chạy với `I18N_SCREEN=settings-roles` — route để điều hướng và tên hiển thị tiếng Việt.

```ts
312	  'settings-services': { name: 'Dịch vụ & Sản phẩm', route: '/settings/services' },
313	  'settings-staffs': { name: 'Nhân viên', route: '/settings/staffs' },
314	  'settings-roles': { name: 'Vai trò', route: '/settings/roles' },
315	  'settings-permissions': { name: 'Quyền hạn', route: '/settings/permissions' },
```

- **Giải thích:** không có `gated: true` cho settings-roles (khác với `income-daily`/`settings-business` phía trên), nghĩa là spec compare không cần bước nhập passcode chủ cửa hàng cho màn này. Chỉ khai báo route danh sách `/settings/roles` — trang chi tiết `$roleId` không nằm trong registry này (luồng compare-riêng-màn không quét trang chi tiết).
- **Công nghệ dùng để gen/chạy:** object literal TypeScript làm registry, đọc bởi spec qua `SCREENS[SCREEN]` với `SCREEN = process.env.I18N_SCREEN`.

#### 5. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts` — luồng scan EN → VI cho 1 màn (dòng 39-77)

- **Vai trò trong luồng:** đây là spec đã sinh ra `reports/settings-roles/compare.json`, nguồn dữ liệu cho `settings-roles-test-cases.md` hiện có.

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
57	    await page.waitForTimeout(1800);
58	    if (def.gated) {
59	      await enterPasscodeIfPrompted(page).catch(() => {});
60	      await page.waitForTimeout(1000);
61	    }
62	    // Scroll the whole body so lazy/below-the-fold content mounts before capture.
63	    await scrollThroughPage(page);
64	    const en = await captureTexts(page);
```

- **Giải thích:** với `I18N_SCREEN=settings-roles`, spec dùng `LanguageSettingsPage` (page object thật, dùng chung cho mọi màn) để chuyển app sang English, `routerNavigate()` tới `/settings/roles`, vì `def.gated` không set nên **bỏ qua** bước nhập passcode, rồi `scrollThroughPage()` cuộn hết trang trước khi `captureTexts()` chụp toàn bộ chuỗi UI hiển thị (đây là bước quan trọng theo bài học VP-2252: không cuộn sẽ quét sót nội dung dưới fold — dù danh sách vai trò ở đây không dài nên tác động thấp). Sau đó lặp lại với Tiếng Việt (dòng 67-76, không trích ở trên) và so khớp bằng `pairAndClassify()`.
- **Công nghệ dùng để gen/chạy:** Playwright Test, `LanguageSettingsPage` (page object có thật tại `src/pages/settings/LanguageSettingsPage.ts`), TanStack Router qua `routerNavigate()`, `scrollThroughPage()` (quét đầy đủ theo domains/i18n/i18nScan.ts).

### So với sơ đồ Flow Map

- Sơ đồ đã liệt kê đủ 2 luồng thật đang tồn tại: (A) quét toàn app qua `TC-i18n-vietnamese-scan.spec.ts` — trong đó `/settings/roles` chỉ là một entry trong `STATIC_ROUTES` và trang chi tiết `$roleId` chỉ được chạm bằng `scanDynamic()` best-effort; (B) quét so sánh EN↔VI riêng màn qua `TC-i18n-screen-compare.spec.ts` với `I18N_SCREEN=settings-roles`, kết quả đã được tổng hợp thành `settings-roles-test-cases.md` (2026-07-06).
- Không có mắt xích "Linear spec → test-cases (Feature Overview/Test Cases) → page object → spec chức năng" như các màn đã có TC thật — mục "Ghi chú" ở Flow Map đã nêu rõ 2 khoảng trống chính: (1) thiếu `docs/linear/settings-roles.md`, (2) thiếu page object + spec test case chức năng riêng cho `/settings/roles` và `/settings/roles/$roleId`.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Roles (Vai trò)** · route `/settings/roles` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **2** · 📐 UI vỡ **0**
> Số liệu máy quét: 49 cặp EN↔VI · ✅ đúng glossary 41 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-roles/compare.json` · HTML: `reports/settings-roles/settings-roles.html`
> Cách quét: `I18N_SCREEN=settings-roles I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Danh sách 4 vai trò + số thành viên.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI) | Gốc (EN)   | Nên dùng (chuẩn)                 | Vì sao                                                                                                                        |
| ------------- | ---------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chủ           | Owner      | **Chủ tiệm (hoặc “Chủ sở hữu”)** | “Chủ” đứng một mình quá ngắn, dễ hiểu sang nghĩa khác; các vai trò còn lại đều là cụm rõ nghĩa (Quản lý, Đối tác, Nhân viên). |
| 32 Thành viên | 32 Members | **32 thành viên**                | Viết hoa giữa câu theo kiểu tiếng Anh; tiếng Việt viết thường.                                                                |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Vai trò (Role) · Số thành viên (Members Count)
- Quản lý (Manager) · Đối tác (Partner) · Nhân viên (Staff)
- Chọn vai trò để xem chi tiết. (Select a Role to view details.)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: dialog Assign staff, dialog reset permissions.
- **Đề xuất `GLOSSARY`:** `Owner: ['Chủ tiệm']`, `Manager: ['Quản lý']`, `Partner: ['Đối tác']`.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-roles/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-roles`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
