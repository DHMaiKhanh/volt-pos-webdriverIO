---
title: Code Detail — Charge Fee
generated-at: 2026-07-17
---

# Charge Fee — Code Detail

> Màn `charge-fee` (`/settings/charge-fee`) hiện **chưa có** page object / spec
> Playwright riêng. Luồng code đang tồn tại thực sự là luồng **i18n scan chung**
> (`TC-i18n-screen-compare.spec.ts`), chạy tham số hoá qua biến môi trường
> `I18N_SCREEN=charge-fee`, và đây là nguồn của toàn bộ nội dung trong
> `charge-fee-test-cases.md`.

## Flow Map

### Sơ đồ (file → file)

```
src/domains/i18n/i18nCompare.ts (SCREENS['charge-fee'] khai báo route)
   └─(import)→ tests/regression/i18n/TC-i18n-screen-compare.spec.ts
                 (chạy với env I18N_SCREEN=charge-fee)
        ├─→ src/pages/settings/LanguageSettingsPage.ts   (đổi ngôn ngữ EN/VI)
        ├─→ src/domains/i18n/i18nScan.ts
        │     ├─ switchToVietnamese()
        │     ├─ routerNavigate()      (điều hướng giữ ngôn ngữ, qua TanStack Router)
        │     ├─ scrollThroughPage()   (cuộn hết trang trước khi quét)
        │     └─ detectBody()          (quét tiếng Anh còn sót + UI vỡ)
        ├─→ src/domains/i18n/i18nCompare.ts
        │     ├─ captureTexts()        (chụp text theo DOM-path)
        │     ├─ pairAndClassify()     (so khớp EN↔VI theo glossary)
        │     ├─ summarize()
        │     ├─ suggestFor()
        │     └─ renderCompareReport()
        └─(khi chạy xong)→ reports/charge-fee/compare.json
                             (+ reports/charge-fee/compare.html nếu I18N_HTML=1)
   └─(skill i18n-vietnamese-scan đọc compare.json)→
        docs/screens/charge-fee/charge-fee-test-cases.md
```

### Bảng mắt xích

| #   | File nguồn                                                                     | →   | File đích                                              | Khâu tạo                                                                                                    | Ghi chú                                                                                                               |
| --- | ------------------------------------------------------------------------------ | --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/domains/i18n/i18nCompare.ts` (khai báo `SCREENS['charge-fee']`, dòng 317) | →   | `tests/regression/i18n/TC-i18n-screen-compare.spec.ts` | import `SCREENS`, `captureTexts`, `pairAndClassify`, `summarize`, `suggestFor`, `renderCompareReport`       | Định nghĩa route `/settings/charge-fee`, tên hiển thị "Phí & Phụ thu"                                                 |
| 2   | `TC-i18n-screen-compare.spec.ts`                                               | →   | `src/pages/settings/LanguageSettingsPage.ts`           | gọi `lang.select('en')` / đọc từ `switchToVietnamese()`                                                     | Đổi ngôn ngữ app trước mỗi lượt quét                                                                                  |
| 3   | `TC-i18n-screen-compare.spec.ts`                                               | →   | `src/domains/i18n/i18nScan.ts`                         | import `switchToVietnamese`, `routerNavigate`, `enterPasscodeIfPrompted`, `detectBody`, `scrollThroughPage` | Các helper quét/điều hướng dùng chung cho mọi màn                                                                     |
| 4   | `TC-i18n-screen-compare.spec.ts`                                               | →   | `reports/charge-fee/compare.json`                      | `writeFileSync` trong spec (dòng 96–113)                                                                    | Dữ liệu thô: `summary`, `missing`, `suspect`, `uiBroken`, `pairs`                                                     |
| 5   | `reports/charge-fee/compare.json`                                              | →   | `docs/screens/charge-fee/charge-fee-test-cases.md`     | skill `i18n-vietnamese-scan` đọc JSON rồi viết mục i18n                                                     | File test-case hiện tại **chỉ có phần i18n**, chưa có Feature Overview / Test Cases theo skill `linear-spec-testcase` |

### Ghi chú

- **Chưa có page object riêng** cho charge-fee (không tìm thấy file `ChargeFeePage.ts` trong `src/pages/settings/` hay `src/pages/pos/`).
- **Chưa có spec riêng** cho charge-fee (không tìm thấy `tests/**/*charge*fee*.spec.ts`); luồng test hiện tại chạy chung qua `TC-i18n-screen-compare.spec.ts` với `I18N_SCREEN=charge-fee`.
- **Chưa có tài liệu Linear** (`docs/linear/charge-fee*.md` không tồn tại) — test-cases.md ghi rõ "Chưa có sub-task Linear nào (VP-2252) chỉ đích danh màn này".
- `reports/charge-fee/compare.json` và `compare.html` **chưa tồn tại trên đĩa** ở thời điểm viết file này (chỉ được tạo khi chạy spec) — đường dẫn trong test-cases.md là nơi kết quả SẼ được ghi ra, không phải file có sẵn.
- `scripts/build-screen-report.mjs` được nhắc tới trong ghi chú của `TC-i18n-screen-compare.spec.ts` (dòng 116) nhưng **không tồn tại** trong `scripts/` (chỉ có `build-dashboard.mjs`, `build-reports-index.mjs`, `md-to-html.mjs`, `check-server.mjs`, `run-dashboard.mjs`).

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                    | Vai trò trong luồng gen                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@fixtures/index`)                          | Chạy spec, cung cấp `page`, `test`, `expect`                                                                                     |
| TypeScript path alias (`@domains/i18n`, `@pages`, `@/types`) | Import gọn giữa `tsconfig` paths, tránh relative path dài                                                                        |
| TanStack Router (`window.__TSR_ROUTER__.navigate`)           | `routerNavigate()` điều hướng client-side để giữ ngôn ngữ đang chọn (một `page.goto` full reload sẽ làm mất trạng thái ngôn ngữ) |
| Biến môi trường (`I18N_SCREEN`, `I18N_LENIENT`, `I18N_HTML`) | Tham số hoá spec chung cho nhiều màn, bật/tắt gate và xuất HTML rời                                                              |
| `node:fs` (`mkdirSync`, `writeFileSync`)                     | Ghi `compare.json` / `compare.html` ra `reports/<screen>/`                                                                       |
| Glossary EN↔VI (trong `i18nCompare.ts`)                      | So khớp thuật ngữ, gợi ý bản dịch chuẩn (`suggestFor`)                                                                           |
| Skill `i18n-vietnamese-scan`                                 | Đọc `compare.json`, viết mục i18n vào `charge-fee-test-cases.md`                                                                 |

### Chi tiết theo file

#### 1. `src/domains/i18n/i18nCompare.ts` (dòng 317)

- **Vai trò trong luồng:** Khai báo màn `charge-fee` trong registry `SCREENS`, là "nguồn sự thật" cho route + tên hiển thị mà spec dùng khi quét.

```ts
'charge-fee': { name: 'Phí & Phụ thu', route: '/settings/charge-fee' },
```

- **Giải thích:** Mỗi khoá trong `SCREENS` map tới `{ name, route, gated? }`; spec đọc `SCREENS[SCREEN]` để biết điều hướng tới đâu và tên hiển thị khi in log/report. `charge-fee` không có `gated: true` nên spec bỏ qua bước `enterPasscodeIfPrompted`.
- **Công nghệ dùng để gen/chạy:** TypeScript object literal, dùng làm cấu hình tĩnh cho toàn bộ các màn trong project (không riêng charge-fee).

#### 2. `tests/regression/i18n/TC-i18n-screen-compare.spec.ts`

- **Vai trò trong luồng:** Spec Playwright thực thi toàn bộ quá trình quét EN→VI cho MỘT màn, chọn màn qua `I18N_SCREEN` (mặc định `home`; với charge-fee chạy `I18N_SCREEN=charge-fee`).

```ts
const SCREEN = process.env.I18N_SCREEN || 'home';

test.describe(`i18n — so sánh EN↔VI theo màn ${Tag.REGRESSION}`, () => {
  test(`TC-I18N-COMPARE: ${SCREEN}`, async ({ page }) => {
    test.setTimeout(180_000);

    const def = SCREENS[SCREEN];
    expect(
      def,
      `Màn "${SCREEN}" chưa khai báo trong SCREENS (src/utils/i18nCompare.ts)`,
    ).toBeTruthy();

    // 1) ENGLISH pass — switch to English, navigate client-side, capture.
    const lang = new LanguageSettingsPage(page);
    await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
    await lang.waitForReady();
    await lang.select('en');
    await routerNavigate(page, def.route);
    await page.waitForTimeout(1800);
    if (def.gated) {
      await enterPasscodeIfPrompted(page).catch(() => {});
      await page.waitForTimeout(1000);
    }
    // Scroll the whole body so lazy/below-the-fold content mounts before capture.
    await scrollThroughPage(page);
    const en = await captureTexts(page);
```

- **Giải thích:** Đoạn trên là lượt quét ENGLISH: đổi ngôn ngữ sang `en` qua `LanguageSettingsPage`, điều hướng client-side tới route của charge-fee (`/settings/charge-fee`), cuộn hết trang (`scrollThroughPage`) để nội dung lazy mount rồi mới `captureTexts`. Lượt VIETNAMESE lặp lại tương tự (dòng 66–77 trong file) rồi gọi `pairAndClassify(en, vi)` để phân loại từng chuỗi thành `missing` (chưa dịch) / `suspect` (sai chuẩn) / `ok`.
- **Công nghệ dùng để gen/chạy:** Playwright Test (`test`, `expect`, fixtures `page`), page object `LanguageSettingsPage`, helper quét `i18nScan.ts`, so khớp `i18nCompare.ts`.

#### 3. `src/pages/settings/LanguageSettingsPage.ts` (dòng 17–54)

- **Vai trò trong luồng:** Page object đổi ngôn ngữ app trước mỗi lượt quét — điều kiện tiên quyết để spec có thể thu thập text tiếng Anh rồi tiếng Việt trên cùng một màn charge-fee.

```ts
export class LanguageSettingsPage extends BasePage {
  protected readonly path = '/settings/language';
  ...
  static readonly ANCHORS = {
    en: { nav: 'Pending Orders', sidebar: 'Setting', subtitle: 'Choose your primary language' },
    vi: { nav: 'Đơn đang chờ', sidebar: 'Cài đặt', subtitle: 'Chọn ngôn ngữ chính của bạn' },
  } as const;

  async select(lang: AppLanguage): Promise<void> {
    await this.row(lang).click();
    // The header/nav re-renders — wait for that language's nav anchor.
    await expect(
      this.page.getByText(LanguageSettingsPage.ANCHORS[lang].nav, { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}
```

- **Giải thích:** `select()` click vào radio ngôn ngữ tương ứng rồi chờ một "anchor" ổn định (chuỗi không đổi theo ngôn ngữ được dịch, ví dụ nav đổi từ "Pending Orders" sang "Đơn đang chờ") xuất hiện để xác nhận app đã re-render xong trước khi tiếp tục điều hướng sang charge-fee.
- **Công nghệ dùng để gen/chạy:** Playwright Locator + `expect().toBeVisible()`, kế thừa `BasePage` chung của repo.

#### 4. `src/domains/i18n/i18nScan.ts` (dòng 728–780)

- **Vai trò trong luồng:** Cung cấp các helper lõi mà spec charge-fee gọi trực tiếp: đổi ngôn ngữ nhanh, điều hướng giữ router state, và **quét-đầy-đủ** trước khi bắt text.

```ts
export async function switchToVietnamese(page: Page): Promise<void> {
  await page.goto('/settings/language', { waitUntil: 'domcontentloaded' });
  const viRow = page.getByText('Tiếng Việt', { exact: true });
  await viRow.waitFor({ state: 'visible', timeout: 15_000 });
  await viRow.click();
  await page.getByText('Đơn đang chờ', { exact: true }).first().waitFor({ timeout: 10_000 });
}

export async function routerNavigate(page: Page, to: string): Promise<void> {
  await page.evaluate((dest) => {
    const r = (
      window as unknown as { __TSR_ROUTER__?: { navigate: (o: { to: string }) => unknown } }
    ).__TSR_ROUTER__;
    r?.navigate({ to: dest });
  }, to);
}

export async function scrollThroughPage(page: Page, stepPause = 180): Promise<void> {
```

- **Giải thích:** `routerNavigate` gọi trực tiếp instance router TanStack (`window.__TSR_ROUTER__`) đã gắn vào `window` bởi app, để chuyển route `/settings/charge-fee` **không reload trang** — vì một `page.goto` đầy đủ sẽ làm app load lại và mất ngôn ngữ vừa chọn. `scrollThroughPage` cuộn cả `window` và mọi container `overflow: auto/scroll` cao hơn viewport (theo comment dòng 751–758, viết riêng cho các màn có panel/nội dung lazy-mount — charge-fee có phần "Cấu hình tip" mở rộng nên cũng cần bước này để không quét sót, đúng bài học VP-2252).
- **Công nghệ dùng để gen/chạy:** `page.evaluate()` truy cập biến toàn cục của TanStack Router; DOM API (`scrollHeight`, `clientHeight`, `getComputedStyle`) để tự phát hiện vùng cuộn được.

#### 5. `src/domains/i18n/i18nCompare.ts` (`captureTexts`, `pairAndClassify`, dòng 222–333)

- **Vai trò trong luồng:** Bắt text theo DOM-path ở cả 2 lượt quét (EN, VI) rồi so khớp theo glossary để phân loại `missing` / `suspect` / `ok` — đây là dữ liệu gốc cho `charge-fee-test-cases.md`.

```ts
export async function captureTexts(page: Page, rootSelector = 'body'): Promise<CapturedText[]> {
```

```ts
export function pairAndClassify(en: CapturedText[], vi: CapturedText[]): ComparedPair[] {
```

- **Giải thích:** `captureTexts` chạy trong page context (qua `page.evaluate`, không trích full body ở đây vì không cần cho mục đích tài liệu) để lấy text + đường dẫn DOM làm khoá join. `pairAndClassify` ghép cặp EN/VI theo khoá đó rồi tra glossary nội bộ để gắn trạng thái — kết quả này chính là nguồn của các số liệu "70 thuật ngữ khớp glossary", "0 chưa dịch" trong `charge-fee-test-cases.md`.
- **Công nghệ dùng để gen/chạy:** `page.evaluate` (DOM walk trong browser context), thuật toán join theo key tự viết bằng TypeScript.

### So với sơ đồ Flow Map

- Sơ đồ Flow Map ở trên đã liệt kê đủ các file thật tham gia; phần Code Detail chỉ làm rõ thêm **vì sao** `routerNavigate` phải dùng `window.__TSR_ROUTER__` (tránh mất state ngôn ngữ) và vì sao `scrollThroughPage` là bắt buộc cho màn có panel mở rộng như charge-fee — hai chi tiết kỹ thuật này không nằm trong bảng mắt xích.
- Khác với các màn đã có luồng gen đầy đủ (Linear doc → test-cases.md → page object → spec riêng), charge-fee hiện dừng ở **luồng i18n dùng chung**; chưa có `ChargeFeePage.ts` hay spec chức năng riêng, nên "Chi tiết theo file" ở trên chỉ có thể đi vào các file dùng chung (`i18nScan.ts`, `i18nCompare.ts`, `LanguageSettingsPage.ts`) cộng với chính spec tham số hoá `TC-i18n-screen-compare.spec.ts`.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Charge & Fee (Phí & Phụ thu)** · route `/settings/charge-fee` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **1** · 📐 UI vỡ **0**
> Số liệu máy quét: 78 cặp EN↔VI · ✅ đúng glossary 66 · ⚠️ suspect 0 · dữ liệu 6 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/charge-fee/compare.json` · HTML: `reports/charge-fee/charge-fee.html`
> Cách quét: `I18N_SCREEN=charge-fee I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Gồm Tip Setting (phương thức/thời điểm/mức tip + bảng tuỳ chọn), Tax Setting và Signature.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)       | Gốc (EN) | Nên dùng (chuẩn)                                        | Vì sao                                                                                                                                                                                                                  |
| ------------------- | -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tiền boa (toàn màn) | Tip      | **Giữ “tiền boa” và **sửa các màn khác theo màn này**** | Đây là màn dùng thuật ngữ đầy đủ và nhất quán nhất (Cài đặt tiền boa, Phương thức tiền boa, Mức tiền boa, Gợi ý tiền boa). Màn **Tipping Settings** mới lại dùng “tip”, Staff Payroll thì lẫn cả “Tip” trong công thức. |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang (`xOverflow 0`) và **không có UI vỡ**. Hai chuỗi từng bị báo cắt — "Sửa tuỳ chọn tiền boa", "Xoá tuỳ chọn tiền boa" — là nhãn **`sr-only`** của 2 nút icon trong cột "Hành động" (`tip-options-table-columns.tsx:240,250`), vô hình có chủ đích chứ không phải chữ bị bóp.

### 4. ✅ Đã dịch đúng (mẫu)

- Cài đặt tiền boa · Phương thức tiền boa · Thời điểm tiền boa · Mức tiền boa · Tuỳ chọn tiền boa · Gợi ý tiền boa
- Trước thanh toán / Sau thanh toán (Before / After Payment)
- Cài đặt thuế (Tax Setting) · Thuế (Tax)
- Chữ ký (Signature) · Yêu cầu chữ ký điện tử (Require Digital Signature) · Thời điểm chữ ký
- Bật: khách ký trên màn hình, miễn nếu bỏ qua. Tắt: khách ký trên hoá đơn giấy.

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: dialog “Thêm tuỳ chọn tiền boa” (Add Tip Option) và dialog Reorder.
- Đây nên là **màn tham chiếu** khi chốt chuẩn cho Tip trong glossary.

### 6. Nguồn tham chiếu

- JSON: `reports/charge-fee/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `charge-fee`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
