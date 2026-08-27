---
title: Luồng code-gen — Thông tin doanh nghiệp (Business Info)
generated-at: 2026-07-06
---

# Luồng code-gen — Thông tin doanh nghiệp (Business Info)

## Sơ đồ (file → file)

```
Linear VP-871 / docs/linear/settings.md
  └─(skill 1 linear-feature-spec: quét Playwright MCP + screenshot)
     → docs/features/settings-business.md  (+ settings-business-assets/business-info.png)
        └─(skill 2 linear-testcase-gen: quét MCP → liệt kê case)
           → docs/testcases/settings-business-testcases.md
              ├─→ src/pages/settings/BusinessInfoPage.ts        (page object — locators + readPayPeriod)
              └─→ tests/regression/settings/business/TC-business-info.spec.ts  (spec, 11 test)
                   └─(khi chạy)→ reports/html, reports/allure-results, test-results/
  └─(skill 5 i18n-vietnamese-scan)
     → docs/i18n/settings-business-i18n-result.md  (+ reports/settings-business/compare.{html,json})
  └─(skill 6 screen-suite-report)
     → tests/regression/settings/business/TC-business-info-ALL.spec.ts
        └─(khi chạy)→ reports/settings-business/settings-business-scan.{html,json}
```

## Bảng mắt xích

| #   | File nguồn                                | →   | File đích                                                             | Khâu tạo                 | Ghi chú                                  |
| --- | ----------------------------------------- | --- | --------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| 1   | Linear VP-871 + `docs/linear/settings.md` | →   | `docs/features/settings-business.md`                                  | skill 1                  | Quét MCP live + chụp `business-info.png` |
| 2   | `docs/features/settings-business.md`      | →   | `docs/testcases/settings-business-testcases.md`                       | skill 2                  | 12 case (read-only)                      |
| 3   | testcases.md                              | →   | `src/pages/settings/BusinessInfoPage.ts`                              | skill 2                  | Đã có sẵn — mở rộng thêm locators        |
| 4   | testcases.md                              | →   | `tests/regression/settings/business/TC-business-info.spec.ts`         | skill 2                  | 11 test, chạy xanh                       |
| 5   | route live                                | →   | `docs/i18n/settings-business-i18n-result.md`                          | skill 5                  | 70 ✅ / 0 chưa dịch (sau khi vào gate)   |
| 6   | testcases + spec                          | →   | `TC-business-info-ALL.spec.ts` + `reports/settings-business/*-scan.*` | skill 6                  | 1-big-test kiểu Home                     |
| 7   | mọi `.md`                                 | →   | `reports/settings-business/*.html`                                    | `scripts/md-to-html.mjs` | HTML kèm hero image                      |

## Ghi chú

- **Passcode gate:** màn gated → mọi spec phải unlock `8888` trước; helper dùng `PasscodeDialog`.
- Page object `BusinessInfoPage` đã tồn tại từ pipeline income (đọc Pay Period) → skill 2 chỉ **mở rộng** locators, không tạo mới.
- Mắt xích còn thiếu: chưa có spec Linear riêng cho phần POS (Pay Period / Store Policies) — xem §6 feature doc.

---

---

title: Chi tiết luồng code-gen — Thông tin doanh nghiệp (Business Info)
expands: docs/codegen-flow/settings-business-flow.md
generated-at: 2026-07-06
---

# Chi tiết luồng code-gen — Thông tin doanh nghiệp (Business Info)

## Tổng quan công nghệ

| Công nghệ                    | Vai trò trong luồng gen                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **Playwright MCP**           | Quét live `/settings/business`, nhập passcode, snapshot cây a11y, chụp full-page |
| **Linear MCP**               | Đọc VP-871 + sub-task để lấy spec/nghiệp vụ                                      |
| **Playwright Test**          | Chạy spec (`@fixtures/index`, `expect`, `test.step`)                             |
| **Page Object (BasePage)**   | `BusinessInfoPage` kế thừa `BasePage` — locator + action, không assert           |
| **PasscodeDialog component** | Mở khoá gate (`enterPasscode`, `tickRemember30m`)                                |
| **TS path alias**            | `@pages`, `@components`, `@fixtures`, `@/`                                       |
| **scripts/md-to-html.mjs**   | Render `.md` → HTML tự-chứa kèm hero image                                       |

## Chi tiết theo file

### 1. src/pages/settings/BusinessInfoPage.ts

- **Vai trò:** page object — locator các section/field + đọc Pay Period.

```ts
this.heading = page.getByRole('heading', { name: 'Business Info' });
this.payPeriodGroup = page.locator('[role="radiogroup"]');
this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
field(name: string): Locator { return this.page.getByRole('textbox', { name, exact: true }); }
daySwitch(day: string): Locator { return this.page.getByRole('switch', { name: `Open on ${day}` }); }
async isFieldEditable(name: string): Promise<boolean> { return this.field(name).first().isEditable().catch(() => false); }
```

- **Giải thích:** dùng **role-based locator** (`getByRole`) — bền hơn CSS, khớp trực tiếp cây a11y đã quét bằng MCP. `readPayPeriod()` đọc `data-state="checked"` của Radix radio.
- **Công nghệ:** Playwright locators + Radix a11y attributes.

### 2. src/components/modal/PasscodeDialog.ts (tái dùng)

- **Vai trò:** mở khoá owner passcode gate.

```ts
await passcodeDialog.tickRemember30m();
await passcodeDialog.enterPasscode('8888'); // click từng nút số, chờ dialog ẩn
```

- **Công nghệ:** Radix dialog + `getByRole('button', { name: digit, exact: true })`.

### 3. tests/regression/settings/business/TC-business-info.spec.ts

- **Vai trò:** 11 test read-only.

```ts
async function openUnlocked(businessInfoPage, passcodeDialog) {
  await businessInfoPage.goto();
  await passcodeDialog.waitForVisible(8_000).catch(() => {}); // cold-load: dialog mount trễ
  if (await passcodeDialog.isOpen()) {
    await passcodeDialog.tickRemember30m();
    await passcodeDialog.enterPasscode(PASSCODE);
  }
  await businessInfoPage.waitForReady();
}
```

- **Giải thích:** bài học khi chạy — trên cold `goto`, dialog passcode mount **sau** khi app render, nên phải `waitForVisible` (best-effort) trước khi kiểm `isOpen()`; nếu kiểm ngay sẽ bỏ qua unlock → form bị gate chặn → `waitForReady` timeout (9/11 test từng fail vì lỗi này).
- **Công nghệ:** Playwright Test + custom fixtures (`businessInfoPage`, `passcodeDialog`).

### 4. scripts/md-to-html.mjs

- **Vai trò:** render mọi `.md` (feature/testcases/flow/i18n) → HTML tự-chứa, nhúng `business-info.png` base64.
- **Công nghệ:** Node script + markdown→HTML + base64 image inlining.

## So với bản map (skill 3)

Bản map chỉ liệt kê file→file; bản này thêm **đoạn code thật** + **bài học runtime** (cold-load passcode race) và **công nghệ** từng mắt xích.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Business Info (Thông tin doanh nghiệp)** · route `/settings/business` · scanned-at: 2026-08-20
> ❌ chưa dịch **2** · ⚠️ sai chuẩn / lệch thuật ngữ **2** · 📐 UI vỡ **0**
> Số liệu máy quét: 103 cặp EN↔VI · ✅ đúng glossary 82 · ⚠️ suspect 0 · dữ liệu 3 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-business/compare.json` · HTML: `reports/settings-business/settings-business.html`
> Cách quét: `I18N_SCREEN=settings-business I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Route **gated** (passcode “Enter staff code to access Merchant Settings Page”). Màn này vừa được thêm khối **Turn Settings** và khối **Pay Period** — phần mới nhất nên soi kỹ.

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)                                                | Đang hiển thị (VI) | Nên dịch                                             | Nguồn (data-tsd-source)                                                                         |
| --------------------------------------------------------- | ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Open on monday … Open on sunday (aria-label của 7 switch) | Open on monday …   | Mở cửa thứ Hai … Mở cửa Chủ Nhật                     | components/ui/switch.tsx:44 — nhãn nhìn thấy (“Thứ Hai”…) đã dịch, chỉ aria-label còn tiếng Anh |
| Website (nhãn field)                                      | Website            | Trang web (hoặc giữ “Website” — từ mượn đã phổ biến) | components/ui/label.tsx:37 — mức độ: tuỳ chọn, không phải lỗi nặng                              |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                          | Gốc (EN)                   | Nên dùng (chuẩn)                                                  | Vì sao                                                                                                            |
| -------------------------------------- | -------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cài đặt phiên làm việc / Giá trị phiên | Turn Settings / Turn value | **Cài đặt lượt / Giá trị lượt**                                   | Xem chi tiết ở màn `turn`: cùng khối này, câu mô tả đã dùng “lượt” nhưng nhãn lại dùng “phiên”.                   |
| Kỳ hiện tại                            | Current plan               | **Kỳ hiện tại (giữ) — nên sửa **bản EN** thành “Current period”** | Bản VI đúng nghiệp vụ hơn bản EN (đây là kỳ trả lương, không phải “plan”). Ghi nhận để sửa phía EN, không sửa VI. |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0` — kể cả bảng giờ làm 7 ngày và khối Pay Period (nhãn VI dài hơn EN nhưng vẫn vừa khung).

### 4. ✅ Đã dịch đúng (mẫu)

- Kỳ trả lương (Pay Period) · Hàng tuần / Hai tuần một lần / Hàng tháng / Tuỳ chỉnh
- Chọn ngày trả lương (Select payroll dates) · 20/08 - 26/08/2026
- Giờ làm việc + Thứ Hai…Chủ Nhật (Work Hours + weekday names)
- Thương hiệu cửa hàng / Logo cửa hàng / Ảnh bìa (Store Brand / Store Logo / Cover Photo)
- Chính sách trách nhiệm · Chính sách huỷ · Chính sách khác (Liability / Cancellation / Other Policies)
- Tên pháp lý (Legal Name) · Mã bưu chính (Postal / Zip Code) · Tiểu bang (State)

### 5. Ghi chú / đề xuất bổ sung glossary

- Placeholder dạng giá trị mẫu (`(888) 888-8888`, `$0.00`) **không** phải lỗi i18n — theo CLAUDE.md R11 của app repo, `value`/`defaultValue`/placeholder mẫu để nguyên.
- Khối Turn Settings ở đây và dialog **Cài đặt** mở từ Turn dùng chung chuỗi → sửa 1 chỗ là hết cả 2.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-business/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-business`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
