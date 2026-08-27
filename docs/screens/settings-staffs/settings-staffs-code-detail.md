---
title: Code Detail — Settings Staffs
generated-at: 2026-07-17
---

# Settings Staffs — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
src/domains/i18n/i18nScan.ts          (STATIC_ROUTES['/settings/staffs'])
  └─(danh sách route tĩnh cho quét leftover-English)
        │
        ▼
tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts
  ├─→ mở /settings/staffs → click staff đầu tiên → quét 5 tab hồ sơ
  │     (Thông tin/Thù lao/Kỹ năng dịch vụ/Giờ làm việc/Quyền hạn)
  ├─→ src/domains/i18n/i18nPopups.ts (POPUP_DEFS: "Tạo nhân viên", "Tạo nhóm nhân viên")
  └─(ghi)→ reports/i18n-audit/auto-scan.{html,json}

src/domains/i18n/i18nCompare.ts       (SCREENS['settings-staffs'] = { name, route })
        │
        ▼
tests/regression/i18n/TC-i18n-screen-compare.spec.ts   (I18N_SCREEN=settings-staffs)
  ├─→ src/domains/i18n/i18nScan.ts (scrollThroughPage, switchToVietnamese, routerNavigate, detectBody)
  └─(ghi)→ reports/settings-staffs/compare.{html,json}
        │
        ▼
docs/screens/settings-staffs/settings-staffs-test-cases.md   (phần i18n, đã có sẵn)

[KHÔNG có] src/pages/settings/StaffsSettingsPage.ts (page object CHO MÀN LIST)
[CÓ] src/pages/settings/EmployeeSettingsPage.ts — page object đọc tab "Compensation"
     của trang chi tiết `/settings/staffs/$staffId`, dùng bởi các spec income
     reconciliation (KHÔNG phải bởi luồng gen test-case/i18n của chính màn này):
     tests/regression/incomes/income-summary-reconciliation/TC-RECON-staff-compensation.spec.ts
```

### Bảng mắt xích

| #                             | File nguồn                                                                 | →   | File đích                                                                                    | Khâu tạo                                        | Ghi chú                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                             | `src/domains/i18n/i18nScan.ts` (`STATIC_ROUTES`, dòng 40)                  | →   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`                                      | Khai báo route tĩnh                             | `{ path: '/settings/staffs', name: 'Nhân viên', group: 'Settings' }` — màn list được quét như mọi màn tĩnh khác.                                                                    |
| 2                             | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` (dòng 589-650)     | →   | `src/domains/i18n/i18nScan.ts` (`detectBody`, `routerNavigate`, `enterPasscodeIfPrompted`)   | Quét sâu 5 tab                                  | Mở nhân viên đầu (`main a.cursor-pointer`), click từng `getByRole('tab')` theo index (0..4), quét từng tab; tab 0 ("Thông tin") còn mở thêm dropdown "Vai trò nhân viên" (VP-2272). |
| 3                             | `src/domains/i18n/i18nPopups.ts` (`POPUP_DEFS`, dòng 276-293)              | →   | `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts` (`scanPopup`)                        | Khai báo popup                                  | 2 popup gắn với `host: '/settings/staffs'`: "Tạo nhân viên", "Tạo nhóm nhân viên".                                                                                                  |
| 4                             | `src/domains/i18n/i18nCompare.ts` (`SCREENS['settings-staffs']`, dòng 313) | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                                       | Khai báo màn cho compare EN↔VI                  | `{ name: 'Nhân viên', route: '/settings/staffs' }`, chọn qua env `I18N_SCREEN=settings-staffs`.                                                                                     |
| 5                             | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`                     | →   | `reports/settings-staffs/compare.json` (`+ compare.html` khi `I18N_HTML=1`)                  | Chạy spec                                       | EN pass → VI pass (đều gọi `scrollThroughPage`) → `pairAndClassify` → ghi JSON, đính HTML vào Playwright report.                                                                    |
| 6                             | `reports/settings-staffs/compare.json`                                     | →   | `docs/screens/settings-staffs/settings-staffs-test-cases.md`                                 | Skill `i18n-vietnamese-scan` đọc JSON, viết doc | File test-cases.md hiện đã có phần i18n hoàn chỉnh (30/30 khớp glossary, không vỡ UI).                                                                                              |
| 7                             | _(không tồn tại)_                                                          | →   | _(không tồn tại)_                                                                            | —                                               | Không có page object `StaffsSettingsPage` hay spec CRUD (thêm/sửa/xoá nhân viên) riêng cho màn list — xem Ghi chú.                                                                  |
| 8 (phụ, không cùng luồng gen) | `src/pages/settings/EmployeeSettingsPage.ts`                               | →   | `tests/regression/incomes/income-summary-reconciliation/TC-RECON-staff-compensation.spec.ts` | Page object đọc dữ liệu                         | Dùng route `/settings/staffs/$staffId` để đối chiếu số liệu income, không phải test case UI cho chính màn settings-staffs.                                                          |

### Ghi chú

- Màn `settings-staffs` **chưa có page object hay spec test-case CRUD riêng** (không có `src/pages/settings/StaffsSettingsPage.ts`, không có `tests/regression/settings/staffs/...`). Toàn bộ "code flow" hiện có của màn này là **luồng quét i18n** (2 spec: `TC-i18n-vietnamese-scan.spec.ts` quét leftover-English toàn app + `TC-i18n-screen-compare.spec.ts` so sánh chất lượng dịch EN↔VI riêng màn này).
- `src/pages/settings/EmployeeSettingsPage.ts` tồn tại thật, nhưng được viết cho mục đích khác (đọc tab Compensation phục vụ đối chiếu số liệu income ở `TC-RECON-staff-compensation.spec.ts`), không phải một phần của luồng gen test-case/i18n cho màn settings-staffs. Đã ghi chú rõ ở bảng trên để không nhầm là "page object của màn".
- 5 tab hồ sơ (Thông tin/Thù lao/Kỹ năng dịch vụ/Giờ làm việc/Quyền hạn) chỉ được quét **bên trong** `TC-i18n-vietnamese-scan.spec.ts` (bước 4e, dòng ~589-650) bằng cách click theo `getByRole('tab')` index — không có scan riêng lẻ theo từng tab trong `TC-i18n-screen-compare.spec.ts` (spec đó chỉ quét view mặc định của route `/settings/staffs`, tức tab đầu/list, sau khi `scrollThroughPage`).
- Mắt xích còn thiếu / chưa tồn tại: page object cho màn list + form thêm/sửa nhân viên, spec test-case CRUD, và một scan compare riêng cho trang chi tiết `/settings/staffs/$staffId` (hiện compare.json chỉ phủ view mặc định của `/settings/staffs`, chưa phủ 5 tab).

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                                  | Vai trò trong luồng gen                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@fixtures/index`)                                        | Chạy 2 spec i18n (`TC-i18n-vietnamese-scan.spec.ts`, `TC-i18n-screen-compare.spec.ts`), gắn `Tag.REGRESSION`.       |
| TanStack Router (`window.__TSR_ROUTER__.navigate` qua `routerNavigate`)    | Điều hướng client-side tới `/settings/staffs` để giữ trạng thái ngôn ngữ Tiếng Việt (không reload).                 |
| DOM scan trong-browser (`detectBody`, `scrollThroughPage`, `captureTexts`) | Quét leftover-English + UI vỡ (`i18nScan.ts`), cuộn hết trang trước khi chụp text để không sót nội dung lazy-mount. |
| Glossary EN→VI (`i18nCompare.ts` `GLOSSARY`, `SCREENS`)                    | Nguồn "chuẩn dịch" để phân loại từng cặp EN/VI là `ok`/`missing`/`suspect`.                                         |
| Popup registry (`i18nPopups.ts` `POPUP_DEFS`)                              | Khai báo popup "Tạo nhân viên"/"Tạo nhóm nhân viên" để scan mở & quét riêng.                                        |
| `getByRole('tab')` + click theo index                                      | Kỹ thuật ngôn-ngữ-trung-lập để lần lượt mở 5 tab hồ sơ mà không phụ thuộc nhãn tab đang là EN hay VI.               |
| Node `fs` (`writeFileSync`, `mkdirSync`)                                   | Ghi kết quả JSON/HTML ra `reports/settings-staffs/compare.json` (+ `compare.html` khi `I18N_HTML=1`).               |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nScan.ts`

- **Vai trò trong luồng:** Khai báo route tĩnh `/settings/staffs` để mọi spec quét-toàn-app đi qua, và cung cấp các helper dùng chung (`routerNavigate`, `scrollThroughPage`, `detectBody`, `switchToVietnamese`).

```ts
1	import type { Page } from '@playwright/test';
...
28	export const STATIC_ROUTES: RouteDef[] = [
29	  { path: '/home', name: 'Trang chủ / POS', group: 'POS' },
...
40	  { path: '/settings/staffs', name: 'Nhân viên', group: 'Settings' },
41	  { path: '/settings/roles', name: 'Vai trò', group: 'Settings' },
```

- **Giải thích:** `STATIC_ROUTES` là danh sách các đường dẫn "không tham số" mà `TC-i18n-vietnamese-scan.spec.ts` lặp qua để quét leftover-English. `/settings/staffs` nằm trong nhóm `Settings`, không `gated` (không cần passcode) — khớp với thực tế route mở trực tiếp từ menu Cài đặt.
- **Công nghệ dùng để gen/chạy:** TypeScript object literal thuần, không phụ thuộc UI framework; được import bởi spec Playwright.

#### 2. `tests/regression/i18n/TC-i18n-vietnamese-scan.spec.ts`

- **Vai trò trong luồng:** Đây là nơi thực thi bước "quét sâu 5 tab hồ sơ nhân viên" — mở staff đầu tiên trong list rồi lần lượt click qua từng tab.

```ts
589	    // 4e) Employee — open the first staff, then scan EACH of the 5 tabs.
590	    try {
591	      await routerNavigate(page, '/settings/staffs');
592	      await page.waitForTimeout(1500);
593	      await enterPasscodeIfPrompted(page).catch(() => {});
594	      const staff = page.locator('main a.cursor-pointer').first();
595	      if (await staff.isVisible().catch(() => false)) {
596	        await staff.click();
597	        await page.waitForTimeout(1500);
598	        // Tab order matches STAFF_TABS: information, compensation, services,
599	        // workHours, permissions. Clicked by role+index (language-neutral).
600	        const TABS_VN = ['Thông tin', 'Thù lao', 'Kỹ năng dịch vụ', 'Giờ làm việc', 'Quyền hạn'];
601	        const tabs = page.getByRole('tab');
602	        const count = await tabs.count().catch(() => 0);
603	        for (let i = 0; i < Math.min(count, TABS_VN.length); i++) {
604	          try {
605	            await tabs.nth(i).click();
606	            await page.waitForTimeout(1200);
607	            await record({
608	              ...(await detectBody(page)),
609	              route: `/settings/staffs → ${TABS_VN[i]}`,
610	              name: `Nhân viên · ${TABS_VN[i]}`,
611	              group: 'Settings',
612	              redirected: false,
613	            });
```

- **Giải thích:** Sau khi vào `/settings/staffs` và click nhân viên đầu (`main a.cursor-pointer`), spec lấy tất cả phần tử `role="tab"` và click theo **index** (không theo tên) vì tên tab đổi theo ngôn ngữ đang bật — đây là kỹ thuật "click ngôn-ngữ-trung-lập" được ghi chú ngay trong code (dòng 599). Mỗi tab sau khi click được quét bằng `detectBody` và `record` vào danh sách kết quả chung của spec, gắn route ảo `"/settings/staffs → <tên tab VI>"` để phân biệt trong report.
- Riêng tab đầu ("Thông tin", `i === 0`) còn mở thêm dropdown "Vai trò nhân viên" bằng regex ngôn-ngữ-kép `/vai trò nhân viên|employee role/i`, quét thêm 1 lần nữa (VP-2272), rồi `Escape` để đóng — best-effort, không fail scan nếu dropdown không có.
- **Công nghệ dùng để gen/chạy:** Playwright `getByRole`, locator `.nth()`, `try/catch` best-effort (không để 1 bước lỗi làm hỏng toàn bộ scan), TanStack Router điều hướng qua `routerNavigate`.

#### 3. `src/domains/i18n/i18nPopups.ts`

- **Vai trò trong luồng:** Khai báo 2 popup gắn với host `/settings/staffs` để scan mở dialog rồi quét riêng nội dung dialog (view mặc định không phủ được).

```ts
276	  {
277	    name: 'Cài đặt · Tạo nhân viên',
278	    group: 'Settings',
279	    host: '/settings/staffs',
280	    open: [
281	      { by: 'role', role: 'button', name: /create.*staff|new staff|thêm nhân viên|tạo nhân viên/i },
282	      { by: 'testid', value: 'add-staff' },
283	    ],
284	  },
285	  {
286	    name: 'Cài đặt · Tạo nhóm nhân viên',
287	    group: 'Settings',
288	    host: '/settings/staffs',
289	    open: [
290	      { by: 'role', role: 'button', name: /new group|add group|tạo nhóm|thêm nhóm/i },
291	      { by: 'testid', value: 'add-staff-group' },
292	    ],
293	  },
```

- **Giải thích:** Mỗi `POPUP_DEF` khai báo nhiều chiến lược mở (`by: 'role'` với regex tên nút song ngữ EN/VI, hoặc `by: 'testid'` fallback) — `scanPopup` (trong `i18nPopups.ts`, gọi từ spec quét) thử từng chiến lược cho tới khi mở được popup rồi quét nội dung.
- **Công nghệ dùng để gen/chạy:** Regex song ngữ để né phụ thuộc ngôn ngữ hiện tại của UI; `data-testid` là fallback ổn định hơn khi có.

#### 4. `src/domains/i18n/i18nCompare.ts`

- **Vai trò trong luồng:** Đăng ký màn `settings-staffs` vào registry `SCREENS` để spec so sánh EN↔VI (`TC-i18n-screen-compare.spec.ts`) biết route cần quét, và cung cấp `GLOSSARY` làm chuẩn đối chiếu thuật ngữ.

```ts
56	export const GLOSSARY: Record<string, string[]> = {
...
114	  Staff: ['Nhân viên'],
...
313	  'settings-staffs': { name: 'Nhân viên', route: '/settings/staffs' },
```

- **Giải thích:** `SCREENS['settings-staffs']` chỉ có `name` + `route`, không có `gated: true` — khớp với việc màn Staff không yêu cầu passcode. `GLOSSARY.Staff = ['Nhân viên']` là thuật ngữ chuẩn dùng để đối chiếu bất cứ chuỗi "Staff" nào xuất hiện trên màn.
- **Công nghệ dùng để gen/chạy:** TypeScript `Record` tra cứu case-insensitive (so khớp ở hàm `suggestFor`/`pairAndClassify` cùng file), là "nguồn sự thật" cho việc dịch đúng chuẩn.

#### 5. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** Spec thực thi so sánh EN↔VI cho **một** màn được chọn qua env `I18N_SCREEN`; khi chạy với `I18N_SCREEN=settings-staffs` sẽ tạo ra `reports/settings-staffs/compare.json`.

```ts
39	const SCREEN = process.env.I18N_SCREEN || 'home';
...
45	    const def = SCREENS[SCREEN];
...
51	    // 1) ENGLISH pass — switch to English, navigate client-side, capture.
52	    const lang = new LanguageSettingsPage(page);
53	    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
54	    await lang.waitForReady();
55	    await lang.select('en');
56	    await routerNavigate(page, def.route);
...
62	    // Scroll the whole body so lazy/below-the-fold content mounts before capture.
63	    await scrollThroughPage(page);
64	    const en = await captureTexts(page);
65
66	    // 2) VIETNAMESE pass — switch to VN, navigate, capture + leftover-English + UI vỡ.
67	    await switchToVietnamese(page);
68	    await routerNavigate(page, def.route);
```

- **Giải thích:** Chạy 2 lần quét cùng route (`def.route` = `/settings/staffs`), một lần ở English, một lần ở Tiếng Việt, đều gọi `scrollThroughPage` trước khi `captureTexts` để đảm bảo nội dung lazy-mount phía dưới cũng được chụp — tránh bài học VP-2252 (quét sót phần dưới). Kết quả hai lần được `pairAndClassify` ghép theo DOM-path key rồi phân loại `ok`/`missing`/`suspect`.
- Đầu ra ghi JSON luôn (`reports/settings-staffs/compare.json`); HTML riêng (`compare.html`) chỉ ghi khi `I18N_HTML=1`, còn lại HTML được đính trực tiếp vào Playwright report qua `test.info().attach`.
- **Công nghệ dùng để gen/chạy:** `LanguageSettingsPage` (page object đổi ngôn ngữ), `routerNavigate` (TanStack Router client-side nav để giữ state ngôn ngữ), Node `fs` để ghi JSON/HTML, `test.info().attach` để gắn báo cáo vào Playwright HTML report.

### So với sơ đồ Flow Map

- Sơ đồ ở trên phản ánh đúng thực tế: màn `settings-staffs` KHÔNG có nhánh "page object + spec CRUD" như các màn đã có test-case đầy đủ (ví dụ income-staff) — nhánh đó được đánh dấu "không tồn tại" thay vì vẽ mờ, đúng yêu cầu chỉ ghi mắt xích thật.
- Chi tiết hơn sơ đồ ở điểm: bảng "Chi tiết theo file" cho thấy kỹ thuật click-tab-theo-index (ngôn-ngữ-trung-lập) và bước mở dropdown "Vai trò nhân viên" — hai chi tiết này nằm bên trong 1 khối code lớn của `TC-i18n-vietnamese-scan.spec.ts` nên không tách được thành mắt xích file→file riêng, chỉ mô tả được ở mức đoạn code.
- `EmployeeSettingsPage.ts` được liệt kê ở bảng mắt xích #8 nhưng gắn nhãn "phụ, không cùng luồng gen" — tránh gây hiểu nhầm rằng màn này đã có page object test-case đầy đủ.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Employees (Nhân viên)** · route `/settings/staffs` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **0** · 📐 UI vỡ **0**
> Số liệu máy quét: 43 cặp EN↔VI · ✅ đúng glossary 34 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-staffs/compare.json` · HTML: `reports/settings-staffs/settings-staffs.html`
> Cách quét: `I18N_SCREEN=settings-staffs I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Quét ở mức khung danh sách nhân viên + panel rỗng.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

> Không phát hiện chuỗi dịch lệch chuẩn ở phạm vi đã quét.

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Tất cả nhân viên (All Employees) · Tất cả (All)
- Chọn nhân viên để xem chi tiết. (Select a staff member to view details.)
- placeholder Tìm nhân viên (Search employee) · aria-label Sắp xếp nhân viên (Reorder Employees)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: 4 tab trong chi tiết nhân viên (Information / Compensation / Service / Permission) và dialog Tạo nhân viên. Tab **Compensation** chứa nhiều thuật ngữ lương/hoa hồng trùng với Staff Payroll → nên quét riêng để đối chiếu (xem ghi chú ở `staff-payroll`).

### 6. Nguồn tham chiếu

- JSON: `reports/settings-staffs/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-staffs`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
