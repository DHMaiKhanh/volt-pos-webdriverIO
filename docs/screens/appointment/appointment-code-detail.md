---
title: Code Detail — Appointment
generated-at: 2026-07-17
---

# Appointment — Code Detail

## Flow Map

### Sơ đồ (file → file)

```
docs/linear/book-appointment-from-pos.md   (VP-1615, parent VP-1498)
  └─(skill linear-feature-spec, tay/PM)→ docs/screens/appointment/appointment-test-cases.md
        (phần đầu file, mục "1. Mở form Create" … "6. Edit/Confirm/Cancel"
         — đây là bản "VP-1615-analysis" nằm NGAY TRONG file test-cases, không phải file riêng)
      └─(skill linear-testcase-gen: quét Playwright MCP trên http://localhost:1420/appointment)→
            docs/screens/appointment/appointment-test-cases.md
            (mục "## Nhóm 1 — Mở form Create" … "## Nhóm 6 — Edit / Confirm / Cancel",
             + bảng "Known Bugs" VP-2342..VP-2371)
          ├─→ src/pages/pos/AppointmentPage.ts        (page object)
          └─→ tests/regression/appointment/TC-appointment-create-edit.spec.ts  (spec, 1 test lớn / test.step)
                ├─ dùng fixture appointmentPage từ src/fixtures/pages.fixture.ts (qua @fixtures/index)
                ├─ dùng src/domains/reporting/checkReport.ts (writeCheckReport, captureShot, SkipCheck, summarize)
                ├─ dùng src/domains/reporting/dashboard.ts (writeDashboard)
                └─(khi chạy)→ reports/appointment/appointment-scan.{html,json}
                              + report/allure gốc của Playwright (test.info().attach)
```

### Bảng mắt xích

| #   | File nguồn                                                                            | →   | File đích                                                                                                                                   | Khâu tạo                                                                                                                            | Ghi chú                                                                                                                       |
| --- | ------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | [docs/linear/book-appointment-from-pos.md](../../linear/book-appointment-from-pos.md) | →   | [docs/screens/appointment/appointment-test-cases.md](./appointment-test-cases.md) (đầu file: mục 1–6 + "Tổng hợp câu hỏi cần confirm")      | skill `linear-feature-spec` (tay, dựa theo VP-1615 + Reference doc Google Docs)                                                     | Đây là phần "phân tích tính năng", tương đương "VP-1615-analysis" nhưng nằm chung 1 file với test case, không tách file riêng |
| 2   | appointment-test-cases.md (mục 1–6)                                                   | →   | appointment-test-cases.md (mục "## Nhóm 1" … "## Nhóm 6", bảng Known Bugs)                                                                  | skill `linear-testcase-gen` (quét Playwright MCP tại `http://localhost:1420/appointment` + đọc trực tiếp Linear VP-1615 sub-issues) | Bổ sung 22 known-bug (VP-2342→VP-2371) + 1 bug chưa lên ticket (TC-DATE-02)                                                   |
| 3   | appointment-test-cases.md (Test Cases)                                                | →   | [src/pages/pos/AppointmentPage.ts](../../../src/pages/pos/AppointmentPage.ts)                                                               | skill `linear-testcase-gen` (sinh code)                                                                                             | Page object cho dialog Create/Edit Appointment tại route `/appointment`                                                       |
| 4   | appointment-test-cases.md (Test Cases)                                                | →   | [tests/regression/appointment/TC-appointment-create-edit.spec.ts](../../../tests/regression/appointment/TC-appointment-create-edit.spec.ts) | skill `linear-testcase-gen` (sinh code)                                                                                             | 1 test `TC-APPT-ALL`, mỗi TC-* là 1 `test.step`, theo đúng contract Home/Order Pending                                        |
| 5   | src/fixtures/pages.fixture.ts (fixture `appointmentPage`)                             | →   | TC-appointment-create-edit.spec.ts                                                                                                          | tay (fixture nền có trước, spec import qua `@fixtures/index`)                                                                       | `appointmentPage: async ({ page }, use) => use(new AppointmentPage(page))`                                                    |
| 6   | src/domains/reporting/checkReport.ts, src/domains/reporting/dashboard.ts              | →   | TC-appointment-create-edit.spec.ts                                                                                                          | tay (helper report nền có trước)                                                                                                    | `writeCheckReport`, `captureShot`, `SkipCheck`, `summarize`, `writeDashboard`                                                 |
| 7   | TC-appointment-create-edit.spec.ts                                                    | →   | `reports/appointment/appointment-scan.{html,json}`                                                                                          | tự sinh khi chạy test (`npx playwright test`)                                                                                       | Cũng attach `appointment-scan.html` vào Playwright report qua `test.info().attach`                                            |

### Ghi chú

- Mắt xích còn thiếu / chưa tồn tại:
  - File `docs/test-cases/VP-1615-analysis.md` được cả `AppointmentPage.ts` (dòng 8) và spec (dòng 16, 22-26) trỏ tới trong comment nhưng **file này không tồn tại** trong repo (`docs/test-cases/` không có, và không có file `VP-1615-analysis.md` ở đâu khác) — nội dung tương ứng thực chất nằm ngay trong phần đầu của `docs/screens/appointment/appointment-test-cases.md` (mục 1–6 + "Tổng hợp câu hỏi cần confirm"). Đây là một liên kết "ma" trong comment code, nên KHÔNG được ghi là link thật ở bảng trên.
  - Không tìm thấy helper full-scan kiểu `scrollThroughPage()` / `expandPanelSections()` được dùng trong spec này (các helper đó chỉ tồn tại cho luồng i18n scan `src/utils/i18nScan.ts` / `src/utils/i18nIncomes.ts` — cả hai file này không tồn tại trong `src/utils/` hiện tại của repo, chỉ có `dateUtils.ts, fileUtils.ts, index.ts, logger.ts, moneyUtils.ts, retry.ts, stringUtils.ts`). Vì vậy không đưa vào sơ đồ.
  - Nhiều nhóm test case trong `.md` (Nhóm 5 phần lớn, Nhóm 6 toàn bộ Edit/Confirm/Cancel) được spec ghi nhận bằng `SkipCheck` (không assert cứng) vì thiếu seed data (customer/staff/service, appointment có sẵn theo từng status) — tức luồng gen code chưa "phủ" hết mục Test Cases trong `.md`, đây là gap thật giữa tài liệu và code.

## Code Detail

### Tổng quan công nghệ

| Công nghệ                                                                                                | Vai trò trong luồng gen                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playwright Test (`@playwright/test`)                                                                     | Nền tảng chạy spec, cung cấp `test`, `expect`, `Locator`, `Page`                                                                                                                                                               |
| Playwright MCP                                                                                           | Dùng ở bước `linear-testcase-gen` để quét UI thật tại `http://localhost:1420/appointment`, phát hiện naming thực tế ("Create Appointment" thay vì "New Appointment"), cấu trúc dialog 3 khối, và các known-bug ghi trong `.md` |
| Fixtures (`@fixtures/index` → `mergeTests`)                                                              | Gộp `pagesFixture` + `apiFixture`; cấp `appointmentPage` (khởi tạo `new AppointmentPage(page)`) và `page` cho spec, tránh spec phải tự new page object                                                                         |
| TS path alias (`@pages/*`, `@fixtures/*`, `@constants/*`, `@domains/*`, `@configs/*`, `@utils/*`, `@/*`) | Import gọn trong `AppointmentPage.ts` (`@pages/BasePage`, `@constants/urls`) và trong spec (`@fixtures/index`, `@/types/testTags`, `@constants/urls`, `@domains/reporting/checkReport`, `@domains/reporting/dashboard`)        |
| Tag system (`src/types/testTags.ts` → `Tag.REGRESSION`, `Tag.UI`)                                        | Gắn tag vào `test.describe` để CI/allure lọc theo nhóm regression/UI                                                                                                                                                           |
| "One-big-test + test.step" pattern + `checkReport.ts` / `dashboard.ts`                                   | Sinh report tự-chứa `reports/appointment/appointment-scan.{html,json}` — mỗi TC là 1 step, kết quả pass/fail/skip tích lũy vào `CheckResult[]`, không abort giữa chừng nhờ try/catch bọc từng `check()`                        |
| `SkipCheck` (custom error class trong `checkReport.ts`)                                                  | Đánh dấu case chưa automate được (thiếu data/seed hoặc `[NEEDS CONFIRM]`) thành `skip` thay vì fail/pass giả                                                                                                                   |
| `expect.soft`                                                                                            | Ở cuối spec, để không dừng ngay khi 1 case fail — gom hết fail rồi báo 1 lần                                                                                                                                                   |

### Chi tiết theo file

#### 1. docs/screens/appointment/appointment-test-cases.md (nguồn)

- **Vai trò trong luồng:** vừa là "feature spec" (mục 1–6, dòng 1–143) vừa là "test case list" (mục "Nhóm 1"–"Nhóm 6", dòng 197–325), cộng bảng Known Bugs (dòng 151–178) — tất cả nằm trong 1 file duy nhất, khác với mô hình 2-file (`.md` phân tích riêng + `.md` test case riêng) mà comment code kỳ vọng.
- **Giải thích:** Dòng 1–10 là header lấy trực tiếp từ Linear VP-1615 (link, parent, status, PR, reference doc). Dòng 145–147 mở phần hai với dòng "Nguồn: [VP-1615-analysis.md](./VP-1615-analysis.md) + quét thực tế UI bằng Playwright MCP" — **link này trỏ tới file không tồn tại**, xác nhận gap đã ghi ở Flow Map.
- **Công nghệ dùng để gen:** viết tay theo skill `linear-feature-spec` (đọc Linear + Google Docs) rồi `linear-testcase-gen` (Playwright MCP quét `http://localhost:1420/appointment`), không phải code chạy được — là input cho bước sinh code kế tiếp.

#### 2. src/pages/pos/AppointmentPage.ts

```ts
1  import { type Locator, type Page, expect } from '@playwright/test';
2  import { BasePage } from '@pages/BasePage';
3  import { Urls } from '@constants/urls';
...
12 export class AppointmentPage extends BasePage {
13   protected readonly path = Urls.APPOINTMENT;
```

- **Vai trò trong luồng:** page object cho route `/appointment`, kế thừa `BasePage` (goto/waitForReady chung).
- **Giải thích:**
  - Dòng 48-76: khai báo locator theo cấu trúc dialog thật quan sát được qua MCP — `createAppointmentButton` bắt theo tên nút thật "Create Appointment" (không phải "New Appointment" như doc Linear gốc, đúng như ghi chú "Quan sát thực tế bổ sung" trong `.md` dòng 184).
  - Dòng 55-60: `customerPhoneInput`/`customerNameInput` dùng `getByPlaceholder`, `customerSuggestions` dùng regex mask `\(\*{3}\)\s*\*{3}-\d{4}` khớp đúng format mask `(***) ***-2619` mô tả ở `.md` dòng 32.
  - Dòng 66-67: `startTimeInput` lấy theo `getByRole('textbox').nth(2)` — comment giải thích "3rd textbox after phone + name", một kỹ thuật định vị theo thứ tự DOM khi không có locator ổn định hơn (rủi ro giòn nếu thứ tự field đổi).
  - Dòng 88-103 `closeForm()`: có logic retry-click 3 lần + fallback `Escape` vì "calendar behind dialog keeps re-rendering (live appointment counts via websocket)" — xử lý flakiness thực tế phát hiện khi quét bằng MCP.
- **Công nghệ dùng để gen/chạy:** Playwright Locator API (`getByRole`, `getByPlaceholder`, `getByText`), TS path alias `@pages/*` `@constants/*`.

#### 3. tests/regression/appointment/TC-appointment-create-edit.spec.ts

```ts
1  import { test, expect } from '@fixtures/index';
2  import { Tag } from '@/types/testTags';
3  import { Urls } from '@constants/urls';
4  import {
5    captureShot,
6    type CheckResult,
7    SkipCheck,
8    summarize,
9    writeCheckReport,
10 } from '@domains/reporting/checkReport';
11 import { writeDashboard } from '@domains/reporting/dashboard';
...
28 test.describe(`Appointment — create/edit/confirm/cancel scan ${Tag.REGRESSION} ${Tag.UI}`, () => {
29   test('TC-APPT-ALL: Appointment form — full check', async ({ appointmentPage, page }) => {
```

- **Vai trò trong luồng:** spec test chính — 1 test lớn (`TC-APPT-ALL`) gói toàn bộ các TC từ `.md` thành các `test.step`, cùng cơ chế report như Home/Order Pending.
- **Giải thích:**
  - Dòng 34-53: hàm `check(id, title, fn)` là khung chạy chung — bọc mỗi case trong `test.step`, `try/catch`: pass ghi kết quả `fn()` trả về, `SkipCheck` → `status: 'skip'`, lỗi khác → `status: 'fail'`, luôn `captureShot(page)` kèm theo.
  - Dòng 155-178 (`TC-DATE-02`): minh họa việc spec tự phát hiện lại bug đã ghi trong `.md` (Date Next không đổi ngày) và convert thành `SkipCheck` có message trỏ lại đúng bug — không tự ý pass/fail sai.
  - Dòng 401-434 (Nhóm 5 & 6): các case cần seed data (Save thật, appointment có sẵn theo status) đều bị đánh `SkipCheck` với message giải thích rõ lý do — cho thấy code KHÔNG phủ hết mọi dòng trong bảng test case, chỉ phủ phần khả thi không cần seed.
  - Dòng 448-469: cuối test gọi `writeCheckReport('appointment', results, {...})` và `writeDashboard('appointment', results, {...})`, sinh `reports/appointment/appointment-scan.{html,json}` + dashboard riêng; log tổng hợp pass/fail/skip ra console; `expect.soft` gom lỗi ở cuối theo biến env `I18N_LENIENT`.
- **Công nghệ dùng để gen/chạy:** Playwright Test runner, custom fixtures (`@fixtures/index` → `mergeTests(pagesFixture, apiFixture)` tại `src/fixtures/index.ts`), Tag system, module report nội bộ `checkReport.ts`/`dashboard.ts`, TS alias.

#### 4. src/fixtures/pages.fixture.ts (mắt xích fixture)

- **Vai trò trong luồng:** cấp fixture `appointmentPage` cho spec — dòng 15 `import { AppointmentPage } from '@pages/pos/AppointmentPage'`, dòng 34 khai báo type `appointmentPage: AppointmentPage`, dòng 80-81 `appointmentPage: async ({ page }, use) => { await use(new AppointmentPage(page)); }`.
- **Giải thích:** đây là lớp glue giữa page object và spec — spec không tự `new AppointmentPage(page)` mà nhận sẵn qua destructure `{ appointmentPage, page }` ở test callback, đúng pattern fixture của Playwright Test.
- **Công nghệ dùng để gen/chạy:** Playwright Test fixtures API (`test.extend`/tương đương, gộp qua `mergeTests`).

#### 5. src/domains/reporting/checkReport.ts

- **Vai trò trong luồng:** định nghĩa kiểu `CheckResult`/`CheckStatus`, hàm `captureShot` (screenshot JPEG base64 để nhúng report), class `SkipCheck`, `summarize`, `writeCheckReport` — dùng chung cho mọi màn theo "one big test" contract (dòng 5-14 comment nêu rõ: mirror Home i18n scan contract).
- **Giải thích:** `captureShot` (dòng 38-45) chụp screenshot viewport-only quality 55 để report nhẹ; toàn bộ ảnh bị strip khỏi JSON, chỉ giữ trong HTML.
- **Công nghệ dùng để gen/chạy:** Node `fs` (`mkdirSync`, `writeFileSync`), Playwright `Page.screenshot`.

### So với bản Flow Map

- Flow Map chỉ nêu tên các file tham gia (page object, spec, report); phần Code Detail ở trên đi sâu vào **từng dòng code cụ thể** (locator strategy dòng 66-67 và 88-103 của `AppointmentPage.ts`; cơ chế `check()`/`SkipCheck`/`expect.soft` dòng 34-53 và 471-475 của spec) và giải thích **vì sao** code viết như vậy (flakiness của calendar re-render, thiếu seed data cho Nhóm 5/6, link "ma" tới `VP-1615-analysis.md`).
- Flow Map nêu gap ở mức "thiếu file/thiếu helper"; Code Detail nêu thêm gap ở mức "thiếu coverage" — nhiều dòng trong bảng Test Cases (Nhóm 5, Nhóm 6, và các case `[NEEDS CONFIRM]`) chưa có assertion thật trong spec, chỉ có `SkipCheck` ghi lại lý do.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Appointment (Lịch hẹn)** · route `/appointment` · scanned-at: 2026-08-20
> ❌ chưa dịch **1** · ⚠️ sai chuẩn / lệch thuật ngữ **0** · 📐 UI vỡ **1 nhãn bị cắt**
> Số liệu máy quét: 157 cặp EN↔VI · ✅ đúng glossary 14 · ⚠️ suspect 0 · dữ liệu 1 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 1
> Dữ liệu thô: `reports/appointment/compare.json` · HTML: `reports/appointment/appointment.html`
> Cách quét: `I18N_SCREEN=appointment I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Lịch hẹn dạng scheduler (cột theo thợ × dòng theo giờ). Quét ở mức khung + header filter.

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)                                           | Đang hiển thị (VI)      | Nên dịch              | Nguồn (data-tsd-source)                                        |
| ---------------------------------------------------- | ----------------------- | --------------------- | -------------------------------------------------------------- |
| Previous day / Next day / icon-calendar (aria-label) | Previous day / Next day | Ngày trước / Ngày sau | components/date-selector.tsx:175 và :283 — nút điều hướng ngày |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

> Không phát hiện chuỗi dịch lệch chuẩn ở phạm vi đã quét.

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang (`xOverflow 0`). Tên thợ ở header cột scheduler bị ellipsis vì cột rộng cố định (bản EN cũng vậy → không phải lỗi dịch). Nhãn thật duy nhất bị ellipsis là **"Chưa phân công"** (`global.unassigned`, dài hơn "Unassigned") → nên soi mắt thường xem có mất chữ ở cột đầu tiên.

### 4. ✅ Đã dịch đúng (mẫu)

- Tổng quan lịch hẹn (Appointment Overview) · Tạo lịch hẹn (Create Appointment)
- Bây giờ (Now) · Nhân viên (Staffs) · Trạng thái (Statuses)
- Chưa phân công (Unassigned) · Đã xác nhận (Confirmed) · Đã huỷ (Canceled)
- 20/08/2026 (ngày localize đúng)

### 5. Ghi chú / đề xuất bổ sung glossary

- 13 chuỗi mà scan báo “còn tiếng Anh” đều là **tên nhân viên chứa từ trong từ điển** (“New Employee 2”, “Staff Payroll”, “Staff income 1”, “wage hour”, “Wage6”…) → **false positive**, không phải lỗi dịch. Đây là hệ quả của dữ liệu test được đặt tên bằng tiếng Anh.
- **Chưa quét**: dialog Tạo/Sửa lịch hẹn (`create-appointment-dialog`, `edit-appointment-dialog`), popover filter thợ/trạng thái, thẻ chi tiết lịch hẹn.

### 6. Nguồn tham chiếu

- JSON: `reports/appointment/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `appointment`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
