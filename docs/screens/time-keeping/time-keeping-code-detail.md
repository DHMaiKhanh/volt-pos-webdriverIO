---
title: Code Detail — Time Keeping
generated-at: 2026-07-17
---

# Time Keeping — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
docs/screens/time-keeping/time-keeping-test-cases.md (Ghi chú, mục 5 — chưa có Feature Overview/Test Cases riêng)
  └─(khai báo cách gọi)→ src/domains/i18n/i18nHome.ts :: scanTimeKeepingDialog()
        │   dùng lại các helper dùng chung của:
        ├─→ src/domains/i18n/i18nScan.ts :: routerNavigate(), detectDialog()
        └─→ src/domains/i18n/i18nHome.ts :: dismissDialog() (helper nội bộ file, không export)
  └─(được gọi trong)→ tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts (bước 4c)
        └─(khi chạy)→ reports/home/home-scan.html , reports/home/home-scan.json
                       (+ reports/home/screens/*.png nếu phát hiện lỗi dịch/vỡ UI)

(Nhánh KHÁC — không cùng luồng dialog, chỉ liên quan cùng tên nghiệp vụ)
src/pages/pos/TimeTrackingPage.ts (page object cho route /time-tracking)
  └─(đăng ký fixture)→ src/fixtures/pages.fixture.ts :: timeTrackingPage
        └─ hiện CHƯA có spec nào import/dùng timeTrackingPage (0 kết quả grep trong tests/)
```

### Bảng mắt xích

| #   | File nguồn                                                                     | →   | File đích                                                    | Khâu tạo                                                              | Ghi chú                                                                                                                              |
| --- | ------------------------------------------------------------------------------ | --- | ------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `docs/screens/time-keeping/time-keeping-test-cases.md`                         | →   | `src/domains/i18n/i18nHome.ts`                               | thủ công (đề xuất ghi ở mục "5. Ghi chú / đề xuất" của test-cases.md) | Chỉ là ghi chú đề xuất, không phải doc-spec sinh code tự động như luồng Linear→testcase-gen                                          |
| 2   | `src/domains/i18n/i18nScan.ts` (`routerNavigate`, `detectDialog`, `RouteScan`) | →   | `src/domains/i18n/i18nHome.ts` (`scanTimeKeepingDialog`)     | import trực tiếp                                                      | Tái dùng helper chung của bộ quét i18n                                                                                               |
| 3   | `src/domains/i18n/i18nHome.ts` (`scanTimeKeepingDialog`)                       | →   | `tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts` | import + gọi ở bước 4c trong `test()`                                 | Đây là nơi DUY NHẤT gọi `scanTimeKeepingDialog` trong toàn repo                                                                      |
| 4   | `tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts`                   | →   | `reports/home/home-scan.html`, `reports/home/home-scan.json` | `renderI18nReport()` + `writeFileSync` trong spec                     | Report gộp chung của toàn màn Home, Time Keeping chỉ là 1 entry trong mảng `scans` (route ghi là `/home ▸ Chấm công (Time Keeping)`) |
| 5   | `src/pages/pos/TimeTrackingPage.ts`                                            | →   | `src/fixtures/pages.fixture.ts` (`timeTrackingPage`)         | đăng ký fixture                                                       | Page object cho route `/time-tracking` (bảng chấm công server-side), KHÔNG phải page object của dialog `?dialog=time-keeping`        |

### Ghi chú

- **Không có page object riêng cho dialog Time Keeping.** `TimeTrackingPage.ts` chỉ phục vụ route `/time-tracking` (dùng trong pipeline income, xem docstring "Used by the income pipeline (Step 3)") và **hiện chưa có spec nào sử dụng nó** — `Grep "TimeTrackingPage"` trong `tests/` không ra kết quả nào ngoài khai báo fixture.
- **Không có spec riêng cho Time Keeping.** Dialog `?dialog=time-keeping` chỉ được quét như MỘT BƯỚC (bước 4c) lồng trong test case `TC-I18N-VI-HOME` của `TC-i18n-home-vietnamese-scan.spec.ts` — không có file spec `TC-*-time-keeping*.spec.ts` độc lập.
- **Không có `docs/linear/time-keeping.md`.** Glob `docs/linear/**` không trả về file nào trong repo — chưa có tài liệu Linear cho màn này.
- **Chưa có mục "Feature Overview" / "Test Cases" hoàn chỉnh** trong `time-keeping-test-cases.md` — file đó hiện chỉ có phần i18n scan (đúng như `docs/screens/README.md` Appendix A đã ghi: "screen này chỉ có i18n-scan").
- Vì vậy, **luồng code thật duy nhất tồn tại** cho "Time Keeping" là luồng i18n-scan: `i18nHome.ts::scanTimeKeepingDialog()` được gọi từ `TC-i18n-home-vietnamese-scan.spec.ts`, ghi kết quả vào report chung của Home (`reports/home/home-scan.*`), không có report riêng `reports/time-keeping/...` mặc dù front-matter của `time-keeping-test-cases.md` có nhắc tới đường dẫn đó (dòng "Kết quả HTML: reports/time-keeping/time-keeping.html") — **đường dẫn này chưa tồn tại trên đĩa**, chỉ là dự định.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                                    | Vai trò trong luồng gen                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playwright Test (`@playwright/test`)                                         | Runner thực thi spec `TC-i18n-home-vietnamese-scan.spec.ts`, cung cấp `page`, `expect`                                                                             |
| Custom fixtures (`@fixtures/index`)                                          | Cung cấp `test`/`expect` đã mở rộng (tag system `Tag.REGRESSION`) cho spec                                                                                         |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)                           | Điều hướng client-side sang `/home?dialog=time-keeping` mà KHÔNG reload trang — giữ được ngôn ngữ Tiếng Việt đã chọn trước đó (tránh bug "reload revert language") |
| TypeScript path alias (`@domains/i18n/...`, `@pages/...`, `@fixtures/index`) | Import module gọn, khớp `tsconfig` paths                                                                                                                           |
| `page.evaluate()` (Playwright DOM eval)                                      | Dò click icon đồng hồ trên header khi deep-link không hiện dialog (fallback), và trích dữ liệu bảng trong `TimeTrackingPage.readCheckIns()`                        |
| Node `fs` (`mkdirSync`, `writeFileSync`)                                     | Ghi report HTML/JSON ra `reports/home/` sau khi quét xong                                                                                                          |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nHome.ts` — `scanTimeKeepingDialog()`

- **Vai trò trong luồng:** hàm quét chính, mở dialog "Chấm công" bằng deep-link và ghi lại 1 `RouteScan` cho nó.

```ts
/**
 * Scan the Chấm công (Time Keeping) dialog specifically. The clock icon in the
 * header has NO accessible name, so {@link scanHeaderPanels} reaches it by blind
 * position (fragile). This helper instead uses the dialog's DEEP-LINK — the app
 * opens it from `?dialog=time-keeping` (verified live via MCP: clicking the clock
 * icon sets `/home?dialog=time-keeping`). Navigating CLIENT-SIDE with that search
 * param keeps the language Vietnamese and opens the dialog deterministically.
 *
 * Known finding (see docs/i18n/time-keeping-i18n-result.md): the empty state of
 * the "Nhân viên sẵn sàng" column renders the hardcoded English "No staffs found."
 * (fixed in app PR #1947, pending merge). Best-effort — never throws.
 */
export async function scanTimeKeepingDialog(
  page: Page,
  record: (scan: RouteScan) => Promise<void>,
): Promise<void> {
  try {
    await routerNavigate(page, '/home');
    await page.waitForTimeout(800);
    await dismissDialog(page);
    // Client-side navigate with the ?dialog=time-keeping search param (keeps VN).
    await page.evaluate(() => {
      const r = (
        window as unknown as {
          __TSR_ROUTER__?: { navigate: (o: unknown) => unknown };
        }
      ).__TSR_ROUTER__;
      r?.navigate({ to: '/home', search: { dialog: 'time-keeping' } });
    });
    await page.waitForTimeout(1200);
    // Fallback: if the deep-link didn't surface the dialog, click the clock icon
    // (icon-only header button that sets the ?dialog=time-keeping URL).
    let up = await page
      .locator('[role="dialog"],[role="alertdialog"]')
      .last()
      .isVisible()
      .catch(() => false);
    if (!up) {
      await page.evaluate(() => {
        const norm = (s: string | null): string => (s || '').replace(/\s+/g, ' ').trim();
        const btns = [...document.querySelectorAll('header button')].filter(
          (b) => !norm(b.textContent) && !!b.querySelector('svg,img'),
        );
        for (const b of btns) {
          (b as HTMLElement).click();
          if (location.search.includes('dialog=time-keeping')) break;
        }
      });
      await page.waitForTimeout(1000);
      up = await page
        .locator('[role="dialog"],[role="alertdialog"]')
        .last()
        .isVisible()
        .catch(() => false);
    }
    if (!up) return; // couldn't open — skip, never fail the scan
    await record({
      ...(await detectDialog(page)),
      route: '/home ▸ Chấm công (Time Keeping)',
      name: 'Trang chủ · Chấm công (Time Keeping)',
      group: 'System',
      redirected: false,
      popup: true,
      reachable: true,
    });
    await dismissDialog(page);
  } catch {
    /* time-keeping dialog unavailable — skip */
  }
}
```

- **Giải thích:**
  1. Điều hướng về `/home` bằng `routerNavigate()` (client-side, không `page.goto`) để không làm mất ngôn ngữ Tiếng Việt đã set trước đó.
  2. Đóng dialog còn sót (`dismissDialog`) trước khi mở dialog mục tiêu, tránh chồng overlay.
  3. Mở dialog bằng cách gọi trực tiếp `__TSR_ROUTER__.navigate({ to: '/home', search: { dialog: 'time-keeping' } })` — đây CHÍNH LÀ deep-link `/home?dialog=time-keeping` được nêu trong yêu cầu, set qua router thay vì đổi URL bar để giữ SPA state.
  4. Nếu deep-link không mở được dialog (icon đồng hồ không có accessible name nên không click theo `getByRole`), có **fallback bằng `page.evaluate`**: dò các `<button>` trong `<header>` không có text và có `svg`/`img` con, click từng cái tới khi URL chứa `dialog=time-keeping`.
  5. Khi dialog đã mở (`role="dialog"` visible), gọi `detectDialog(page)` (từ `i18nScan.ts`) để lấy nội dung dialog, gộp vào một `RouteScan` với `route: '/home ▸ Chấm công (Time Keeping)'`, rồi gọi callback `record()` do caller truyền vào.
  6. Toàn bộ nằm trong `try/catch` — best-effort, không bao giờ throw để không làm fail cả suite quét Home.
- **Công nghệ dùng để gen/chạy:** TanStack Router client-side navigate (`__TSR_ROUTER__`), Playwright `page.evaluate`/`page.locator`, hàm dùng lại `routerNavigate`/`detectDialog` từ `i18nScan.ts`.

#### 2. `src/domains/i18n/i18nScan.ts` — `routerNavigate()` (dòng 742-749)

- **Vai trò trong luồng:** helper dùng chung, điều hướng SPA không reload — điều kiện bắt buộc để giữ ngôn ngữ Tiếng Việt khi quét dialog Time Keeping.

```ts
export async function routerNavigate(page: Page, to: string): Promise<void> {
  await page.evaluate((dest) => {
    const r = (window as unknown as { __TSR_ROUTER__?: { navigate: (o: { to: string }) => unknown } })
      .__TSR_ROUTER__;
    r?.navigate({ to: dest });
  }, to);
}
```

- **Giải thích:** gọi thẳng `window.__TSR_ROUTER__.navigate({ to })` bên trong `page.evaluate`, tức là dùng API router nội bộ của app (TanStack Router) thay vì Playwright `page.goto`, vì `page.goto` sẽ reload toàn trang và app có bug không giữ được ngôn ngữ đã chọn qua reload.
- **Công nghệ dùng để gen/chạy:** TanStack Router (`__TSR_ROUTER__`), Playwright `page.evaluate`.

#### 3. `tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts`

- **Vai trò trong luồng:** spec duy nhất gọi `scanTimeKeepingDialog`; đây là nơi Time Keeping thực sự được "chạy" trong CI/regression.

```ts
import {
  HOME_POPUP_DEFS,
  scanHomeOrderDialogs,
  scanHeaderPanels,
  scanTimeKeepingDialog,
} from '@domains/i18n/i18nHome';
...
test.describe(`i18n — Home Vietnamese deep scan ${Tag.REGRESSION}`, () => {
  test('TC-I18N-VI-HOME: Home screen + popups still in English', async ({ page }) => {
    test.setTimeout(180_000);
    ...
    // 1) Switch to Tiếng Việt (real UI click on the language radio).
    await switchToVietnamese(page);
    ...
    // 4b) Header status panels (Notifications, Time Keeping, Devices).
    await scanHeaderPanels(page, record);

    // 4c) Chấm công (Time Keeping) dialog via its deep-link — deterministic scan
    //     of the check-in panel (catches the "No staffs found." empty state).
    await scanTimeKeepingDialog(page, record);

    // 5) Write a Home-scoped report (HTML + JSON).
    const generatedAt = new Date().toISOString();
    mkdirSync(outDir, { recursive: true });
    const dedup = dedupUntranslated(scans);
    const untranslated = scans.filter(isUntranslated);
    const html = renderI18nReport(scans, generatedAt, { dedup });
    writeFileSync(path.join(outDir, 'home-scan.html'), html, 'utf8');
    writeFileSync(
      path.join(outDir, 'home-scan.json'),
      JSON.stringify(
        {
          generatedAt,
          scanned: scans.length,
          untranslatedCount: untranslated.length,
          strings: dedup.map((d) => d.text),
          dedup,
          untranslated: untranslated.map((s) => ({ route: s.route, name: s.name, ui: s.ui })),
          all: scans,
        },
        null,
        2,
      ),
      'utf8',
    );
```

- **Giải thích:** test case `TC-I18N-VI-HOME` chuyển app sang Tiếng Việt một lần (`switchToVietnamese`), rồi quét lần lượt: trang `/home` đầy đủ, các popup không cần order (`HOME_POPUP_DEFS`), dialog order-flow (`scanHomeOrderDialogs`), panel header (`scanHeaderPanels` — click mù theo vị trí, bao gồm cả icon đồng hồ như một fallback cũ), và **cuối cùng `scanTimeKeepingDialog`** như bước riêng đáng tin cậy hơn cho đúng dialog Time Keeping. Mỗi `RouteScan` được đẩy vào mảng `scans` qua callback `record`, rồi toàn bộ được gộp lại và ghi ra `reports/home/home-scan.html` + `.json` bằng `renderI18nReport` + `writeFileSync` — Time Keeping không có report riêng, nó là 1 phần tử trong report chung của Home.
- **Công nghệ dùng để gen/chạy:** Playwright Test (`test.describe`/`test`), custom fixtures (`@fixtures/index`), tag system (`Tag.REGRESSION`), Node `fs` để ghi report tĩnh (HTML/JSON tự-chứa, không cần server).

#### 4. `src/pages/pos/TimeTrackingPage.ts` (nhánh riêng, không thuộc luồng dialog)

- **Vai trò trong luồng:** page object cho route độc lập `/time-tracking` (không phải dialog `?dialog=time-keeping`). Được đăng ký fixture nhưng **chưa có spec nào dùng**.

```ts
/**
 * Time Tracking — `/time-tracking` (passcode-gated).
 *
 * A table of the day's clock-ins:
 *   # | Staff | Date IN | Date OUT | Total Hours | Created At | Updated At | Note | Action
 *
 * Used by the income pipeline (Step 3) to find which staff checked in — the
 * `wage_per_day` / `wage_per_hour` salary inputs depend on it. Like the report
 * pages, the route shows the passcode dialog on top, so `goto` does NOT wait for
 * readiness — the caller unlocks first, then calls `waitForReady`.
 */
export class TimeTrackingPage extends BasePage {
  protected readonly path = '/time-tracking';

  readonly heading: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  ...
  async readCheckIns(): Promise<TimeTrackingRow[]> { ... }
}
```

Đăng ký fixture, trong `src/fixtures/pages.fixture.ts`:

```ts
import { TimeTrackingPage } from '@pages/pos/TimeTrackingPage';
...
timeTrackingPage: TimeTrackingPage;
...
timeTrackingPage: async ({ page }, use) => {
  await use(new TimeTrackingPage(page));
},
```

- **Giải thích:** class này đại diện cho MÀN HÌNH KHÁC (`/time-tracking`, có passcode gate) — không phải dialog "Chấm công" mở từ header Home. Theo docstring, nó tồn tại để pipeline tính lương (income reconciliation) đọc dữ liệu check-in (`readCheckIns()` scrape bảng theo tên cột, không phụ thuộc thứ tự cột). Grep toàn bộ `tests/` cho `TimeTrackingPage` chỉ ra kết quả duy nhất là chính khai báo fixture — **không spec nào import/sử dụng `timeTrackingPage` hiện tại**, nên nhánh này chưa có mắt xích "→ spec" thật.
- **Công nghệ dùng để gen/chạy:** Playwright Page Object pattern (`extends BasePage`), fixture injection (`pages.fixture.ts`), DOM scraping qua `locator.evaluate` để map cột theo header text.

### So với sơ đồ Flow Map

- Sơ đồ ở trên phản ánh đúng thực tế: **không có** chuỗi Linear-doc → test-cases.md (Feature Overview/Test Cases) → page object → spec riêng cho Time Keeping như các màn đã hoàn chỉnh khác (ví dụ Home, Income). Toàn bộ "code thật" hiện có chỉ là 1 hàm quét (`scanTimeKeepingDialog`) được gọi từ 1 bước trong spec chung của Home.
- Điểm chi tiết hơn sơ đồ: sơ đồ chỉ vẽ `i18nHome.ts → spec`, nhưng thực tế `scanTimeKeepingDialog` còn phụ thuộc ngược vào `i18nScan.ts` (dùng `routerNavigate`, `detectDialog`, `RouteScan`) và một helper nội bộ không export (`dismissDialog`, định nghĩa ngay trong `i18nHome.ts` dòng 124) — các phụ thuộc này đã được nêu rõ trong bảng mắt xích #2.
- Nhánh `TimeTrackingPage.ts` được liệt kê riêng để tránh nhầm lẫn: nó cùng tên nghiệp vụ ("time keeping"/"time tracking") nhưng là một route/màn hình khác (`/time-tracking`), phục vụ mục đích khác (income pipeline), và hiện là một mắt xích "mồ côi" (đăng ký fixture nhưng chưa có spec gọi tới).

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Time Keeping (Chấm công vào/ra)** · route `/home?dialog=time-keeping` · scanned-at: 2026-08-20
> ❌ chưa dịch **1** · ⚠️ sai chuẩn / lệch thuật ngữ **4** · 📐 UI vỡ **0**
> Số liệu máy quét: 237 cặp EN↔VI · ✅ đúng glossary 54 · ⚠️ suspect 1 · dữ liệu 41 · scanner-missing 4 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 2
> Dữ liệu thô: `reports/time-keeping/compare.json` · HTML: `reports/time-keeping/time-keeping.html`
> Cách quét: `I18N_SCREEN=time-keeping I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Dialog `?dialog=time-keeping` mở trên route hiện tại, nên bản quét cũng chứa chuỗi của `/home`; phần dưới chỉ tính chuỗi của riêng dialog. **Không click vào thợ khi quét** — click là hành động chấm công thật (ghi dữ liệu).

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)             | Đang hiển thị (VI) | Nên dịch  | Nguồn (data-tsd-source)                    |
| ---------------------- | ------------------ | --------- | ------------------------------------------ |
| Search... (aria-label) | Search...          | Tìm kiếm… | icon.tsx:64 — icon ô tìm kiếm trong dialog |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)           | Gốc (EN)            | Nên dùng (chuẩn)                              | Vì sao                                                                                                                           |
| ----------------------- | ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Nhân viên chưa sẵn sàng | Unavailable Staff   | **Nhân viên chưa vào ca (hoặc “Đang nghỉ”)**  | Nhóm này là thợ **chưa/đã ra ca** (badge RA + mốc giờ). “Chưa sẵn sàng” nghe như trạng thái lỗi, không phải nghiệp vụ chấm công. |
| Nhân viên sẵn sàng      | Available Staff     | **Nhân viên đang trong ca (hoặc “Đang làm”)** | Cùng lý do trên — nhóm này là thợ đã vào ca.                                                                                     |
| RA                      | OUT                 | **ĐÃ RA (và IN → “ĐANG LÀM”)**                | “RA” một chữ dễ đọc thành hướng/nút; badge trạng thái nên là cụm rõ nghĩa.                                                       |
| 13/08/2026 05:16 PM     | 08/13/2026 05:16 PM | **13/08/2026 17:16**                          | Ngày đã đổi đúng dd/mm/yyyy nhưng **giờ vẫn 12h AM/PM** — tiếng Việt dùng 24h. Lỗi lặp ở mọi màn có mốc giờ.                     |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang (`xOverflow 0`) và **không có nhãn nào bị cắt**. 2 chuỗi ellipsis còn lại là dữ liệu của route nền `/home` (`"MANICURE & PEDICURE"`, tên dịch vụ test dài) — không thuộc dialog. Danh sách 224 thợ cuộn bình thường ở bản VI.

### 4. ✅ Đã dịch đúng (mẫu)

- Chấm công (Time Keeping)
- Không tìm thấy nhân viên. (No staff found.)
- placeholder Tìm nhân viên (Search staff)
- Đóng (Close)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất `GLOSSARY`:** `Available Staff: ['Nhân viên đang trong ca']`, `Unavailable Staff: ['Nhân viên chưa vào ca']`, `Time Keeping: ['Chấm công']`.
- Sidebar có 2 mục dễ lẫn: **Chấm công** (dialog này) và **Quản lý chấm công** (`/time-tracking`) — xem ghi chú ở màn `time-tracking`.

### 6. Nguồn tham chiếu

- JSON: `reports/time-keeping/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `time-keeping`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
