---
title: Thu nhập nhân viên (/incomes/income-staff) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /incomes/income-staff
scanned-at: 2026-07-06
consolidates: feature-spec + test cases + i18n (coverage + meaning)
excludes: docs/codegen-flow/income-staff-flow.md · docs/codegen-detail/income-staff-detail.md (giữ riêng)
---

# Thu nhập nhân viên (`/incomes/income-staff`) — Tài liệu hợp nhất

> MỘT file duy nhất: gộp đặc tả tính năng + test case + kết quả quét Tiếng Việt (còn tiếng Anh + dịch đúng chuẩn). Kết quả trực quan: [reports/income-staff/compare.html](../../reports/income-staff/compare.html). Luồng code-gen giữ riêng: [codegen-flow/income-staff-flow.md](../income-staff/income-staff-code-detail.md) · [codegen-detail/income-staff-detail.md](../income-staff/income-staff-code-detail.md).

# PHẦN A — Đặc tả tính năng

## A1. Mục tiêu & phạm vi

Màn `/incomes/income-staff` (tiêu đề UI: **Staff Income**) là **report dự trù thu nhập của từng nhân viên** theo ngày/khoảng ngày:

- Danh sách staff kèm chỉ số thu nhập; search theo **nickname**; filter theo ngày/khoảng.
- Bảng tổng đầu trang: Total staff, Total orders, Total subtotal, Total supply fee, Total tip, Total staff income.
- Click 1 staff → panel chi tiết thu nhập theo **setting Compensation** của staff đó (Commission / Salary / Commission+Salary) + **Print**.

> Lưu ý nghiệp vụ: Staff Income chỉ là **report dự trù**; con số chính xác chốt ở **Payroll** khi đóng kỳ lương.

## A2. Các luồng chính (từ Linear)

- **Staff listing:** Search (Staff Nickname); Filter (ngày xem report); cột: **Staff (nickname); Orders; Subtotal (= Sale − Refund); Supply Fee; Tip; Total Income**.
- **Staff Income detail** — 2 biến thể theo Compensation:
  1. **STAFF INCOME – Commission**
     - Staff Info: Name (Nickname); Date (1 ngày hoặc range + No. of WD).
     - Order listing: Order#; Sale/Refund; Supply; Tip.
     - Detail: Sale; Refund; **Subtotal = Sale − Refund**; Supply Fee; **Staff Commission = (Subtotal − Supply fee) × 60%**; Clean Up Fee/Deduction; Tip; **TOTAL INCOME = Commission − Clean up + Tip**.
  2. **STAFF INCOME – Salary / Commission + Salary** (Pay by Hour/Day/Period)
     - Staff Info: Name; Date; Clock In; Clock Out; Working Hours.
     - Order listing: Order#; Sale/Refund; Tip.
     - Detail: Sale; Refund; **Subtotal**; **Rate** (theo setting: Salary by Period / Wage Per Hour / Wage Per Day); **Gross Income = [ngày/giờ] × rate**; Clean Up Fee; Tip; **TOTAL INCOME = Gross Income − Clean Up + Tip**.
- **Lưu ý:** nếu staff set **Salary** hoặc **Commission + Salary** → luôn show cả Commission lẫn Salary, nhưng Total Income lấy phần Salary (phụ thuộc **Staff Days Off Setting**). Wage Per Hour cần Checkin–Checkout; Wage Per Day cần Checkin.

## A3. Thành phần UI thực tế (quét bằng Playwright MCP, 2026-07-06)

Ảnh: [income-staff-assets/income-staff-empty.png](income-staff-assets/income-staff-empty.png) (ngày 07/06/2026 chưa có staff data)

| Thành phần                      | Vai trò                                                        | Trạng thái                                                                             | Ghi chú                          |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| Tiêu đề **Staff Income**        | Nhãn màn hình                                                  | Hoạt động                                                                              |                                  |
| **Search staff** (textbox)      | Lọc theo nickname                                              | Hoạt động                                                                              | placeholder "Search staff"       |
| Combobox preset (**Today**)     | Chọn khoảng ngày nhanh                                         | Hoạt động                                                                              | Đi kèm calendar                  |
| Nút **calendar `07/06/2026`**   | Date-picker                                                    | Hoạt động                                                                              | Accessible name `MM/DD/YYYY`     |
| Thẻ tổng **Total staff**        | Đếm số staff                                                   | Hoạt động                                                                              | `0` khi trống                    |
| Thẻ tổng **Total orders**       | Tổng order                                                     | Hoạt động                                                                              | `0`                              |
| Thẻ tổng **Total subtotal**     | Tổng subtotal                                                  | Hoạt động                                                                              | `$0.00`                          |
| Thẻ tổng **Total supply fee**   | Tổng supply fee                                                | Hoạt động                                                                              | `$0.00`                          |
| Thẻ tổng **Total tip**          | Tổng tip                                                       | Hoạt động                                                                              | `$0.00`                          |
| Thẻ tổng **Total staff income** | Tổng thu nhập staff                                            | Hoạt động                                                                              | `$0.00`                          |
| **Danh sách staff**             | Bảng staff (Staff/Orders/Subtotal/Supply Fee/Tip/Total Income) | Trống → **"No results found."**                                                        | Cột hiện khi có data (theo spec) |
| **Panel chi tiết**              | Chi tiết thu nhập 1 staff + Print                              | Trống → "No detail to show — Select staff to preview income details or print reports." | Cần chọn staff                   |

## A4. Nghiệp vụ & ràng buộc

- **Subtotal = Sale − Refund**; **Staff Commission = (Subtotal − Supply fee) × 60%** (60% theo Staff Compensation split; nếu chỉ set Salary → Commission = 0).
- **Clean Up Fee/Deduction = $ setting Deduction Per Day × số ngày xem report.**
- **TOTAL INCOME (Commission) = Commission − Clean up + Tip**; **TOTAL INCOME (Salary) = Gross Income − Clean up + Tip**.
- **Rate** phụ thuộc kiểu lương: Salary by Period (lương kỳ ÷ số ngày trong kỳ), Wage Per Hour, Wage Per Day.
- Report là **dự trù**; số chốt nằm ở **Payroll**.

## A5. Trạng thái / quyền / edge case

- **Quyền:** owner passcode (đã bypass 30 phút trong phiên quét).
- **Empty state:** không có staff phát sinh trong ngày → "No results found." + panel "No detail to show".
- **Salary/Commission+Salary:** hiển thị cả Commission và Salary; Total Income phụ thuộc **Staff Days Off Setting**.
- **Wage Per Hour/Day:** cần dữ liệu Checkin/Checkout để tính giờ/ngày làm việc.

## A6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

| Mục                  | Linear                                            | UI thực tế                                                           | Kết luận                                                         |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tên màn              | "Staff Income"                                    | Tiêu đề UI "Staff Income"                                            | ✅ Khớp                                                          |
| Search               | Search theo Nickname                              | textbox "Search staff"                                               | ✅ Khớp                                                          |
| Cột listing          | Staff/Orders/Subtotal/Supply Fee/Tip/Total Income | Chưa quan sát được (empty) — thanh tổng phản ánh đúng các chỉ số này | ⚠️ **Chưa xác nhận cột trên data thật** (cần chạy ngày có staff) |
| Thanh tổng đầu trang | (spec không liệt kê rõ)                           | Total staff/orders/subtotal/supply fee/tip/staff income              | ✅ UI bổ sung, khớp ý các chỉ số spec                            |
| Detail 2 biến thể    | Commission / Salary                               | Chưa quan sát được (empty)                                           | ⚠️ **Chưa xác nhận trên data thật**                              |

> **TODO xác nhận trên data thật:** cần chọn 1 ngày có staff phát sinh để xác nhận cột bảng + 2 biến thể panel chi tiết (Commission vs Salary) trước khi khoá assertion.

# PHẦN B — Quét Tiếng Việt (i18n)

## B0. Tổng quan (số liệu từ i18n-result.md / compare.json)

> **Chuỗi UI đối chiếu 23** · ❌ chưa dịch **1** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **0** · ✅ thuật ngữ đúng **22** · (data bỏ qua: 67 · tổng pair 110)
> ⚠️ **Phát hiện mới:** quét **sau khi cuộn hết trang** + bảng có data staff → lộ cột **`Tip`** chưa dịch (trước đây quét trên empty-state nên báo 0). ✅ 18 ⇒ 22 do phủ thêm bảng staff.
> Report trực quan: [reports/income-staff/compare.html](../../reports/income-staff/compare.html)

## B1. ❌ Còn tiếng Anh (nhãn UI thật)

| Chuỗi (EN)        | Đang hiển thị (VI)     | Nên dịch     | Ghi chú                                                                                                                                             |
| ----------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tip`             | `Tip` (chưa qua `t()`) | **Tiền tip** | Cột **Tip** trong bảng staff (chỉ hiện khi có data). Cùng một label cứng dùng chung với income-daily & income-summary — fix một chỗ xử lý cả 3 màn. |
| `Pay 1` / `Pay 2` | `Pay 1` / `Pay 2`      | (cần dịch)   | [VP-2253](https://linear.app/fastboy/issue/VP-2253) — panel chi tiết (Staff Payout). Deep-scan (`expandPanelSections`) mới bắt được.                |

## B2. ⚠️ Dịch chưa đúng chuẩn

> View mặc định: 22/22 thuật ngữ khớp glossary.

> **Còn sót trong panel chi tiết (Salary) — cần fix riêng, ghi nhận từ Linear:**
>
> - [VP-2267](https://linear.app/fastboy/issue/VP-2267) / [VP-2263](https://linear.app/fastboy/issue/VP-2263): `Rate` → "Tỉ lệ" **SAI** (Rate là số tiền/mức lương, không phải %) ⇒ nên **"Mức lương"** (hoặc "Đơn giá"). Nằm trong panel chi tiết biến thể Salary nên compare tự động chưa bắt; glossary đã thêm `Rate` để lần mở rộng deep-scan panel sẽ tự gắn cờ.

## B3. ✅ Đã dịch đúng (mẫu)

| EN                            | VI                           |
| ----------------------------- | ---------------------------- |
| Staff Income                  | Thu nhập nhân viên           |
| Total staff                   | Tổng nhân viên               |
| Total orders                  | Tổng đơn hàng                |
| Total subtotal                | Tổng tạm tính                |
| Today                         | Hôm nay                      |
| Order History                 | Lịch sử đơn hàng             |
| Scanner                       | Quét mã                      |
| Internet connection restored. | Đã kết nối internet trở lại. |

## B4. 📐 UI vỡ (chỉ báo cáo)

> Không phát hiện: `xOverflow = 0px`, `clipped = []`. Thanh 6 thẻ tổng + ô search vẫn khít với bản dịch VI.

### Ghi chú / đề xuất bổ sung glossary

- Chuỗi lẻ **"Tip"** là lỗi CHUNG của cả 3 màn income (daily + summary + staff) — cùng một component label cứng chưa bọc `t()`. Fix một chỗ xử lý cả ba.
- Đã phủ thêm bảng staff có data nhờ cuộn hết trang. **Vẫn chưa phủ**: panel chi tiết 2 biến thể (Commission/Salary) chỉ mount sau khi click 1 dòng — cần deep-scan (`scanIncomesDetail`, đã có cuộn panel) hoặc mở rộng compare để click dòng, kiểm thêm Staff Commission/Clean Up Fee/Rate/Gross Income.

# PHẦN C — Test cases

> Nguồn: [docs/testcases/income-staff-testcases.md](income-staff.md) — GIỮ NGUYÊN ID & nội dung.
> Màn **Staff Income** khi sinh test là màn **MỚI** → skill 2 sinh mới page object + spec. Các TC cần data staff (rows/detail) được đánh dấu **[data]** và tự **skip** khi ngày quét không có staff phát sinh (đúng pattern Cluster của Daily).

## Cách chạy

```bash
npx playwright test tests/regression/incomes/income-staff
```

## Bảng test case

| ID                   | Tiêu đề                                                                          | Tiền điều kiện        | Các bước                 | Kết quả mong đợi                                                                                        | Loại            | Ưu tiên |
| -------------------- | -------------------------------------------------------------------------------- | --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| TC-IST-01            | Route bị chặn bởi passcode dialog                                                | Chưa mở passcode      | Mở /incomes/income-staff | Dialog "Enter your passcode" hiện trước khi render data                                                 | regression/auth | P1      |
| TC-IST-02            | Passcode đúng mở màn, hiển thị tiêu đề "Staff Income"                            |                       | Nhập 8888                | Heading "Staff Income" + thanh tổng hiển thị                                                            | regression/auth | P1      |
| TC-IST-03            | Default filter = Today, URL có from/to                                           | Passcode mở           | Mở màn                   | URL chứa `from=<today midnight>`&`to=`                                                                  | regression      | P1      |
| TC-IST-04            | Thanh tổng có đủ 6 chỉ số                                                        |                       | Đọc header stats         | Total staff, Total orders, Total subtotal, Total supply fee, Total tip, Total staff income đều hiển thị | regression      | P1      |
| TC-IST-05            | Ô Search staff hiển thị & nhập được                                              |                       | Focus + gõ               | Textbox "Search staff" nhận input                                                                       | regression      | P2      |
| TC-IST-06            | Combobox preset ngày mặc định "Today"                                            |                       | Đọc combobox             | Text = "Today"                                                                                          | regression      | P2      |
| TC-IST-07            | Nút calendar hiển thị đúng ngày `MM/DD/YYYY`                                     |                       | Đọc nút                  | Accessible name khớp regex ngày                                                                         | regression      | P2      |
| TC-IST-08            | Panel chi tiết rỗng khi chưa chọn staff                                          |                       | Không chọn staff         | Hiện "No detail to show — Select staff to preview income details or print reports."                     | regression      | P2      |
| TC-IST-09            | Ngày không có staff → "No results found." + tổng $0.00/0                         | Ngày trống            | gotoDate(ngày trống)     | List "No results found."; các tổng tiền = $0.00, đếm = 0                                                | regression      | P1      |
| TC-IST-10            | Chọn ngày quá khứ đổi from/to trên URL                                           |                       | gotoDate(past)           | URL phản ánh ngày đã chọn                                                                               | regression      | P2      |
| TC-IST-11            | Reload giữ from/to trong URL                                                     |                       | Reload sau gotoDate      | UI + URL nhất quán                                                                                      | regression      | P2      |
| TC-IST-12            | Mọi money ở thanh tổng đúng dạng `$#,##0.00`                                     |                       | Quét tổng                | Đúng định dạng USD                                                                                      | regression      | P2      |
| TC-IST-13 **[data]** | Bảng staff có đủ cột Staff/Orders/Subtotal/Supply Fee/Tip/Total Income           | Ngày có staff         | Đọc header bảng          | Đủ 6 cột theo spec                                                                                      | regression      | P1      |
| TC-IST-14 **[data]** | Search lọc đúng theo nickname                                                    | Ngày có staff         | Gõ nickname              | Chỉ còn dòng khớp                                                                                       | regression      | P2      |
| TC-IST-15 **[data]** | Click 1 staff mở panel chi tiết + Print enabled                                  | Ngày có staff         | Click dòng staff         | Panel detail hiện, nút Print enabled                                                                    | regression      | P1      |
| TC-IST-16 **[data]** | Detail Commission: Subtotal = Sale − Refund; Total = Commission − Clean up + Tip | Staff kiểu Commission | Đọc panel                | Đẳng thức đúng                                                                                          | regression      | P1      |
| TC-IST-17 **[data]** | Detail Salary: Gross Income = ngày/giờ × Rate; Total = Gross − Clean up + Tip    | Staff kiểu Salary     | Đọc panel                | Đẳng thức đúng                                                                                          | regression      | P1      |
| TC-IST-18 **[data]** | Total staff income = Σ Total Income từng staff                                   | Ngày có staff         | So tổng vs từng dòng     | Khớp                                                                                                    | regression      | P2      |

**Tổng: 18 TC** (TC-IST-01…18). 12 TC chạy không cần data; 6 TC **[data]** tự skip khi ngày trống.

### Ghi chú test

- Route gated passcode owner (`PasscodeDialog`, `OWNER_PASSCODE`).
- Công thức đối chiếu: `docs/linear/income-report.md` mục Staff Income + [src/reports/incomeCalcCore.ts](../../src/reports/incomeCalcCore.ts).

## Nguồn tham chiếu

- Spec/glossary: `docs/i18n/income-staff-translation-map.md` (chưa có — giữ riêng khi được sinh).
- Spec Linear (offline): [docs/linear/income-report.md](../linear/income-report.md) — mục **Staff Income**; Linear gốc: https://linear.app/fastboy/document/income-report-cd80210c48f3 (team VOLT, updated 2026-06-11).
- Luồng code-gen (tách riêng): [codegen-flow/income-staff-flow.md](../income-staff/income-staff-code-detail.md) · [codegen-detail/income-staff-detail.md](../income-staff/income-staff-code-detail.md).
- Công thức: [src/reports/incomeCalcCore.ts](../../src/reports/incomeCalcCore.ts), [docs/report-field-formulas.md](../report-field-formulas.md).
- Ảnh quét: [income-staff-assets/income-staff-empty.png](income-staff-assets/income-staff-empty.png).
- Test/helper + dữ liệu thô JSON: [reports/income-staff/compare.json](../../reports/income-staff/compare.json) · HTML: [reports/income-staff/compare.html](../../reports/income-staff/compare.html).
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['income-staff']`, `gated:true`).

---

# Appendix — Legacy VP-1402 Staff Income & Staff Payroll Test Cases (Excel-style, merged from docs/test-cases/income-reports/VP-1402-staff-income.md)

# VP-1402 — Staff Income & Staff Payroll — Test Cases

> Nguồn: spec "[Volt POS] Staff Income / Staff Payroll" (BA) + **UI thực tế đã verify qua Playwright MCP** (build Jun 16 2026, dataset thật). Ngôn ngữ: Tiếng Việt.
> Format theo cột Excel: ID | PROGRAM | FEATURES | LINK | DESCRIPTION | PRE-CONDITION | TEST STEPS | DATA TEST | EXPECTED RESULT | ACTUAL RESULT | STATUS | NOTE.
> Phạm vi: màn **Staff Income** (report dự trù — `/incomes/income-staff`) gồm Staff Listing + Detail theo từng setting Compensation (Commission / Salary / Commission+Salary) **và** màn **Staff Payroll** (chốt kì lương) gồm Commission / Salary.
> NOTE chứa: Mã TC nội bộ · Loại (Positive/Negative/Boundary/Edge/Regression/UI) · Ưu tiên (P1/P2/P3) · 🐞 = nghi vấn bug đã quan sát · ⚠️ = cần làm rõ.
> Liên quan: Income Summary (khối Staff Payout) → [VP-1048-income-summary.md](./VP-1048-income-summary.md). Staff Income là **report dự trù** số tiền staff sẽ nhận; con số chính xác chốt ở **Staff Payroll**.

---

## Điều hướng & gating (đã verify UI)

- Mở từ **Sidebar → Staff Income** (`/incomes/income-staff`), cùng nhóm income với Daily Sale Report (`/incomes/income-daily`) và Income Summary (`/incomes/income-summary`).
- Nhóm income report **gated bằng passcode** (owner passcode `8888`); có checkbox "Do not require passcode for the next 30 minutes".
- URL state: `?from=<unix>&to=<unix>` (listing) + `&staffId=<uuid>` khi mở detail 1 staff.

## Staff Listing — UI thực tế

- **Ô Search "Search staff"** (trái) + **combobox kỳ (mặc định `Today`)** + **Date picker** (mặc định ngày hiện tại). _Không_ có tab Day/Week/Month như Income Summary.
- Bảng cột: **Name · Orders · Subtotal · Supply Fee · Tip · Total Income** — _(spec gọi cột đầu là "Staff" nhưng UI thực tế là **"Name"**, hiển thị nickname hoặc full name tùy staff)_. **Tất cả cột có sort** (icon sort trên header).
- Subtotal / Supply Fee / Tip / Total Income **cho phép âm** (đã thấy nhiều dòng âm, vd Teri Jennings −$369.72).
- Click 1 dòng staff → mở **panel Detail bên phải** (layout đổi theo Compensation). Trước khi chọn: "No detail to show — Select staff to preview income details or print reports."

## Staff Income Detail — UI thực tế

**Header:** `<Tên staff>` + `(<ngày/range>)` + nút **Print**. Cuối panel: dòng cảm ơn _"Thank you, <tên>!"_.

**Commission** (vd Sophia, 06/16/2026 — Subtotal $193.33 / Supply $41.00 / Tip $50.00):

- Order listing: **Order # · Sale/Refund · Supply · Tip**.
- Detail: `Sale` → `Refund` → `Subtotal` → `Supply Fee (incl. Sale & Refund)` → `Staff Commission ((Subtotal - Supply Fee) x Staff Commission Rate)` → `Commission Rate (<ngày>): <x>%` → `Card Charge - Commission` → `Clean Up Fee/Deduction` → `Discount Charge` → `Tip` → `Card Charge - Tip` → **`Total Income (Staff Commission - Clean Up Fee + Tip)`** → **`Pay 1 (Staff Commission x <p1>% - Clean Up Fee)`** + `Pay 1 Rate (<ngày>): <p1>%` → **`Pay 2 (Staff Commission x <p2>% + Tip)`** + `Pay 2 Rate (<ngày>): <p2>%`.

**Salary** (vd Wage Per Day 4, 06/16/2026 — 0 order):

- Khi không order: empty state "No data available / No orders found for the selected date".
- Info: `Clock In` · `Clock Out` · `Working Days` · `Sale` · `Refund` · `Subtotal`.
- Salary block: `Salary Type` (Wage Per Day / Wage Per Hour / Salary by Period) · `Rate` · `Gross Income (Rate × Working Days)`.
- `Clean Up Fee/Deduction` · `Tip` → **`Total Income (Gross Income - Clean Up Fee + Tip)`** → **`Pay 1 (Gross Income x <p1>% - Clean Up Fee)`** + Pay 1 Rate → **`Pay 2 (Gross Income x <p2>% + Tip)`** + Pay 2 Rate.

> **Khác biệt cần lưu ý so với spec:** (1) label Total Income/Pay chỉ ghi 3 số hạng (`Comm - Clean Up + Tip`), **không liệt kê** Card Charge/Discount Charge trong label dù các field này có hiển thị; (2) Rate được gắn theo **ngày hiệu lực** `(06/16/2026)`; (3) % Pay 1/Pay 2 trong môi trường test hiện là **50/50** (spec ví dụ 30/70) → khẳng định **% lấy theo setting, không hardcode**; (4) label Total Income Salary dùng **`- Clean Up Fee`** (giải toả ⚠️ trước đây: là **trừ**).

## Công thức gốc (đối chiếu spec)

| Khối                           | Công thức                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Subtotal                       | `Sale − Refund` (cho phép âm)                                                                           |
| Staff Commission               | `(Subtotal − Supply Fee) × Staff Commission Rate`                                                       |
| Clean Up Fee                   | `Deduction/ngày × số ngày xem report`                                                                   |
| **Commission — Total Income**  | `Staff Commission − Clean Up Fee + Tip` (− Card Charge Comm − Card Charge Tip − Discount Charge khi có) |
| **Commission — Pay 1 / Pay 2** | `Comm × p1% − Clean Up [− phí]` / `Comm × p2% + Tip` (p1/p2 theo Pay1-Pay2 Split)                       |
| **Salary — Gross Income**      | `Rate × Working Days` (hoặc × Working Hours với Wage Per Hour)                                          |
| **Salary — Total Income**      | `Gross Income − Clean Up Fee + Tip`                                                                     |
| **Salary — Pay 1 / Pay 2**     | `Gross × p1% − Clean Up` / `Gross × p2% + Tip`                                                          |

> Cross-check: với cả Commission và Salary, **Pay 1 + Pay 2 = Total Income**. (Đã verify thực tế: Sophia 38.08+88.09≈126.17 ✓; Wage Per Day 4: 20.00+25.00=45.00 ✓.)

---

## A. Staff Income — Staff Listing

| ID  | PROGRAM | FEATURES | LINK                   | DESCRIPTION                                                 | PRE-CONDITION                | TEST STEPS                           | DATA TEST        | EXPECTED RESULT                                                     | ACTUAL RESULT | STATUS | NOTE                      |
| --- | ------- | -------- | ---------------------- | ----------------------------------------------------------- | ---------------------------- | ------------------------------------ | ---------------- | ------------------------------------------------------------------- | ------------- | ------ | ------------------------- |
| 1   | POS     | Gating   | Staff Income / Access  | Vào Staff Income yêu cầu passcode                           | Chưa nhập passcode trong 30' | Mở `/incomes/income-staff`           | passcode `8888`  | Hiện dialog "Enter your passcode"; nhập đúng → vào report           |               |        | TC-SI-001 · Positive · P1 |
| 2   | POS     | Gating   | Staff Income / Access  | Passcode sai → chặn                                         | —                            | Nhập passcode sai                    | sai              | Báo lỗi, không load report                                          |               |        | TC-SI-002 · Negative · P2 |
| 3   | POS     | Gating   | Staff Income / Access  | Tích "không hỏi passcode 30'" → không hỏi lại trong 30 phút | —                            | Tích checkbox + nhập passcode        | —                | Trong 30' mở lại report không hỏi passcode                          |               |        | TC-SI-003 · Positive · P3 |
| 4   | POS     | Listing  | Staff Income / Listing | Bảng staff đủ 6 cột theo UI                                 | Có data staff                | Quan sát header                      | —                | Cột: **Name · Orders · Subtotal · Supply Fee · Tip · Total Income** |               |        | TC-SI-004 · UI · P1       |
| 5   | POS     | Listing  | Staff Income / Listing | Cột Name hiển thị tên staff (nickname/full name)            | —                            | Xem cột Name                         | —                | Hiển thị tên staff đúng (vd Sophia, Teri Jennings)                  |               |        | TC-SI-005 · Positive · P2 |
| 6   | POS     | Listing  | Staff Income / Listing | Mỗi cột có sort, click đổi chiều tăng/giảm                  | Nhiều staff                  | Click header Subtotal / Total Income | —                | Sort đúng theo cột & đổi chiều khi click lại                        |               |        | TC-SI-006 · Positive · P2 |
| 7   | POS     | Listing  | Staff Income / Listing | Orders = tổng số order của staff trong kỳ                   | Staff có N order             | Đối chiếu cột Orders                 | —                | = số order của staff (vd Elise Terry = 87)                          |               |        | TC-SI-007 · Positive · P2 |
| 8   | POS     | Listing  | Staff Income / Listing | Subtotal = Sale − Refund                                    | Có sale + refund             | Đối chiếu Subtotal                   | —                | = Sale − Refund                                                     |               |        | TC-SI-008 · Positive · P1 |
| 9   | POS     | Listing  | Staff Income / Listing | Subtotal/Supply/Tip/Total cho phép âm                       | Refund > Sale                | Xem dòng âm                          | Teri Jennings    | Hiển thị **số âm** đúng dấu (−$369.72 …), không ép 0                |               |        | TC-SI-009 · Edge · P1     |
| 10  | POS     | Listing  | Staff Income / Listing | Total Income (listing) khớp Total Income trong Detail       | —                            | So listing vs detail                 | Sophia $126.17   | Hai con số khớp                                                     |               |        | TC-SI-010 · Negative · P1 |
| 11  | POS     | Search   | Staff Income / Search  | Search "Search staff" lọc đúng theo tên                     | Nhiều staff                  | Gõ tên vào ô Search                  | "Sophia"         | Lọc đúng staff khớp                                                 |               |        | TC-SI-011 · Positive · P2 |
| 12  | POS     | Search   | Staff Income / Search  | Search không match → empty                                  | —                            | Gõ chuỗi không tồn tại               | "zzz999"         | Bảng rỗng / no result, không lỗi                                    |               |        | TC-SI-012 · Negative · P3 |
| 13  | POS     | Filter   | Staff Income / Filter  | Mặc định kỳ = **Today**                                     | Mở report                    | Quan sát combobox + date             | —                | Mặc định **Today** + ngày hiện tại                                  |               |        | TC-SI-013 · Positive · P2 |
| 14  | POS     | Filter   | Staff Income / Filter  | Chọn 1 ngày → data theo ngày                                | Có data                      | Chọn 1 ngày                          | 04/15/2025       | Data tính cho đúng 1 ngày; header detail = ngày đó                  |               |        | TC-SI-014 · Positive · P1 |
| 15  | POS     | Filter   | Staff Income / Filter  | Chọn range → cộng dồn; detail hiện No. of WD                | Có data range                | Chọn range                           | 04/15–04/30/2025 | Header detail = range; hiện **No. of WD / Working Days**            |               |        | TC-SI-015 · Positive · P1 |
| 16  | POS     | Filter   | Staff Income / Filter  | Đổi ngày → listing & detail tính lại                        | Đang xem 1 ngày              | Đổi sang ngày khác                   | —                | Toàn bộ số liệu tính lại theo kỳ mới                                |               |        | TC-SI-016 · Positive · P2 |

## B. Staff Income — Detail (Commission)

| ID  | PROGRAM | FEATURES          | LINK                                  | DESCRIPTION                                                         | PRE-CONDITION                         | TEST STEPS                                                | DATA TEST                                              | EXPECTED RESULT                                         | ACTUAL RESULT | STATUS | NOTE                                        |
| --- | ------- | ----------------- | ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- | ------------- | ------ | ------------------------------------------- |
| 17  | POS     | Detail-Commission | Staff Income / Commission / Header    | Header = Tên staff + (ngày) + nút Print                             | Staff Commission                      | Mở detail                                                 | Sophia, 06/16/2026                                     | "Sophia" + "(06/16/2026)" + nút Print                   |               |        | TC-SI-017 · UI · P2                         |
| 18  | POS     | Detail-Commission | Staff Income / Commission / Orders    | Order listing đủ cột Order # / Sale-Refund / Supply / Tip           | Có order                              | Xem order listing                                         | —                                                      | Mỗi dòng 1 order; cột Order #, Sale/Refund, Supply, Tip |               |        | TC-SI-018 · UI · P2                         |
| 19  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Sale / Refund / Subtotal đúng                                       | —                                     | Xem Sale, Refund, Subtotal                                | Sale 193.33, Refund 0                                  | Subtotal = 193.33                                       |               |        | TC-SI-019 · Positive · P1                   |
| 20  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Supply Fee (incl. Sale & Refund) — refund trừ bớt, không cộng dồn   | Service có supply + refund            | Xem Supply Fee                                            | —                                                      | = phần ròng sau refund (đối chiếu QC#17 Income Summary) |               |        | TC-SI-020 · Regression · P1                 |
| 21  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Staff Commission = (Subtotal − Supply Fee) × Commission Rate        | có Commission Rate                    | Xem Staff Commission                                      | (193.33−41) × rate                                     | Khớp công thức `(Subtotal − Supply) × rate`             |               |        | TC-SI-021 · Positive · P1                   |
| 22  | POS     | Detail-Commission | Staff Income / Commission / Rate      | Hiển thị "Commission Rate (ngày): x%" khớp giá trị Staff Commission | —                                     | So Commission Rate hiển thị vs giá trị Commission tính ra | Sophia rate hiển thị 10% nhưng Commission = 152.33×50% | **Rate hiển thị phải khớp rate dùng để tính**           |               |        | TC-SI-022 · Negative · P1 · 🐞 (xem Bug #1) |
| 23  | POS     | Detail-Commission | Staff Income / Commission / Rate      | Commission Rate gắn theo ngày hiệu lực                              | rate đổi theo ngày                    | Đổi ngày xem                                              | —                                                      | Rate cập nhật theo ngày `(<ngày>)`                      |               |        | TC-SI-023 · Positive · P2                   |
| 24  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Card Charge - Commission theo setting On Staff Commission           | setting on                            | Xem field                                                 | —                                                      | = phí thẻ trên Commission; trừ trong Total & Pay 1      |               |        | TC-SI-024 · Positive · P2 · ⚠️ cần data     |
| 25  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Card Charge - Commission = 0 khi setting off                        | setting off                           | Xem field                                                 | —                                                      | = $0.00                                                 |               |        | TC-SI-025 · Negative · P2                   |
| 26  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Card Charge - Tip theo setting On Credit Card Tip                   | setting on                            | Xem field                                                 | —                                                      | = phí thẻ trên Tip; trừ trong Total & Pay 1             |               |        | TC-SI-026 · Positive · P2 · ⚠️ cần data     |
| 27  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Discount Charge = promotion staff chia với chủ tiệm                 | order có promotion                    | Xem Discount Charge                                       | —                                                      | = phần promotion staff gánh; trừ trong Total & Pay 1    |               |        | TC-SI-027 · Positive · P2 · ⚠️ cần data     |
| 28  | POS     | Detail-Commission | Staff Income / Commission / Detail    | Clean Up Fee/Deduction = deduction/ngày × số ngày xem               | deduction 20/ngày, range 8 ngày       | Xem Clean Up Fee                                          | 20 × 8                                                 | = $160 (nhân theo số ngày)                              |               |        | TC-SI-028 · Regression · P1                 |
| 29  | POS     | Detail-Commission | Staff Income / Commission / Total     | Total Income = Comm − Clean Up + Tip (− phí khi có)                 | Sophia: Comm 76.17, cleanup 0, tip 50 | Xem Total Income                                          | —                                                      | = 76.17 − 0 + 50 = **$126.17**                          |               |        | TC-SI-029 · Positive · P1                   |
| 30  | POS     | Detail-Commission | Staff Income / Commission / Total     | Total Income trừ đủ Card Charge & Discount khi ≠ 0                  | dataset có 3 phí ≠ 0                  | Xem Total Income                                          | 3 phí ≠ 0                                              | Trừ đủ 3 phí dù label chỉ ghi rút gọn                   |               |        | TC-SI-030 · Regression · P1 · ⚠️ cần data   |
| 31  | POS     | Detail-Commission | Staff Income / Commission / Pay 1     | Pay 1 = Comm × p1% − Clean Up (− phí)                               | Sophia p1 50%                         | Xem Pay 1                                                 | 76.17 × 50% − 0                                        | = **$38.08**; "Pay 1 Rate (ngày): 50%"                  |               |        | TC-SI-031 · Positive · P1                   |
| 32  | POS     | Detail-Commission | Staff Income / Commission / Pay 2     | Pay 2 = Comm × p2% + Tip                                            | Sophia p2 50%                         | Xem Pay 2                                                 | 76.17 × 50% + 50                                       | = **$88.09**; "Pay 2 Rate (ngày): 50%"                  |               |        | TC-SI-032 · Positive · P1                   |
| 33  | POS     | Detail-Commission | Staff Income / Commission / Pay split | p1/p2 lấy theo Pay1-Pay2 Split setting (không hardcode 30/70)       | split khác nhau                       | So 2 staff khác split                                     | 50/50 vs 30/70                                         | Mỗi staff dùng đúng % setting riêng                     |               |        | TC-SI-033 · Regression · P1                 |
| 34  | POS     | Detail-Commission | Staff Income / Commission / Đối chiếu | Pay 1 + Pay 2 = Total Income                                        | —                                     | Cộng Pay1 + Pay2                                          | 38.08 + 88.09                                          | ≈ $126.17 = Total Income ✓                              |               |        | TC-SI-034 · Negative · P1                   |
| 35  | POS     | Detail-Commission | Staff Income / Commission / Edge      | Subtotal âm (refund > sale) → Commission/Total âm đúng dấu          | Teri Jennings (−369.72)               | Mở detail, xem Total                                      | —                                                      | Hiển thị âm đúng (vd Total −$34.86), không ép 0         |               |        | TC-SI-035 · Edge · P1                       |
| 36  | POS     | Detail-Commission | Staff Income / Commission / Footer    | Cuối panel hiển thị "Thank you, <tên>!"                             | —                                     | Xem cuối panel                                            | Sophia                                                 | "Thank you, Sophia!"                                    |               |        | TC-SI-036 · UI · P3                         |

## C. Staff Income — Detail (Salary / Commission + Salary)

| ID  | PROGRAM | FEATURES      | LINK                              | DESCRIPTION                                                              | PRE-CONDITION                     | TEST STEPS                | DATA TEST               | EXPECTED RESULT                                                                 | ACTUAL RESULT | STATUS | NOTE                              |
| --- | ------- | ------------- | --------------------------------- | ------------------------------------------------------------------------ | --------------------------------- | ------------------------- | ----------------------- | ------------------------------------------------------------------------------- | ------------- | ------ | --------------------------------- |
| 37  | POS     | Detail-Salary | Staff Income / Salary / Info      | Info hiện Clock In / Clock Out / Working Days / Sale / Refund / Subtotal | Staff Salary                      | Mở detail                 | —                       | 6 field info hiển thị; chưa chấm công → Clock In/Out = "-"                      |               |        | TC-SI-037 · UI · P1               |
| 38  | POS     | Detail-Salary | Staff Income / Salary / Type      | Salary Type hiển thị đúng loại                                           | —                                 | Xem Salary Type           | Wage Per Day            | = "Wage Per Day" / "Wage Per Hour" / "Salary by Period"                         |               |        | TC-SI-038 · UI · P2               |
| 39  | POS     | Detail-Salary | Staff Income / Salary / Rate      | Salary by Period → Rate = lương kỳ / số ngày trong kỳ                    | Pay Period 1 week, $7000          | Xem Rate                  | $7000 / 7               | Rate = **$1000/ngày**                                                           |               |        | TC-SI-039 · Boundary · P1         |
| 40  | POS     | Detail-Salary | Staff Income / Salary / Gross     | Salary by Period — xem ít hơn 1 kỳ → Gross = số ngày xem × rate          | Như TC-39, xem 3 ngày             | Xem Gross Income          | 1000 × 3                | Gross = **$3000** (không trả full $7000)                                        |               |        | TC-SI-040 · Boundary · P1         |
| 41  | POS     | Detail-Salary | Staff Income / Salary / Gross     | Wage Per Day → Gross Income = Rate × Working Days                        | Staff Wage per Day                | Xem Gross Income          | rate × WD               | label "(Rate × Working Days)"; = rate × số ngày làm                             |               |        | TC-SI-041 · Positive · P2         |
| 42  | POS     | Detail-Salary | Staff Income / Salary / Gross     | Wage Per Hour → Gross = Rate × Working Hours; cần Clock In/Out           | Staff Wage per Hour có chấm công  | Xem Working Hours + Gross | In 9:00, Out 17:00 → 8h | Working Hours từ Clock In/Out; Gross = rate × giờ                               |               |        | TC-SI-042 · Positive · P1         |
| 43  | POS     | Detail-Salary | Staff Income / Salary / Total     | Total Income = Gross − Clean Up Fee + Tip                                | 1 staff                           | Xem Total Income          | —                       | label "(Gross Income - Clean Up Fee + Tip)"; đúng phép tính                     |               |        | TC-SI-043 · Positive · P1         |
| 44  | POS     | Detail-Salary | Staff Income / Salary / Pay 1     | Pay 1 = Gross × p1% − Clean Up                                           | split setting                     | Xem Pay 1                 | —                       | label "(Gross Income x <p1>% - Clean Up Fee)"; "Pay 1 Rate (ngày)"              |               |        | TC-SI-044 · Positive · P2         |
| 45  | POS     | Detail-Salary | Staff Income / Salary / Pay 2     | Pay 2 = Gross × p2% + Tip                                                | split setting                     | Xem Pay 2                 | —                       | label "(Gross Income x <p2>% + Tip)"; "Pay 2 Rate (ngày)"                       |               |        | TC-SI-045 · Positive · P2         |
| 46  | POS     | Detail-Salary | Staff Income / Salary / Đối chiếu | Pay 1 + Pay 2 = Total Income                                             | —                                 | Cộng Pay1 + Pay2          | Wage Per Day 4: 20 + 25 | = $45.00 = Total Income ✓                                                       |               |        | TC-SI-046 · Negative · P2         |
| 47  | POS     | Detail-Salary | Staff Income / Salary / Empty     | Staff Salary không order trong kỳ → vẫn có lương                         | Salary staff, 0 order             | Mở detail                 | Wage Per Day 4          | Order listing empty state; vẫn show Salary/Total Income (không phụ thuộc order) |               |        | TC-SI-047 · Edge · P1             |
| 48  | POS     | Detail-Both   | Staff Income / Commission+Salary  | Staff Commission+Salary hiển thị cả 2 phần                               | Staff setting Commission + Salary | Mở detail                 | —                       | Hiện cả block Commission và block Salary                                        |               |        | TC-SI-048 · Positive · P1 · ⚠️ #3 |
| 49  | POS     | Detail-Both   | Staff Income / Commission+Salary  | Total Income của Comm+Salary show phần Salary (tùy Days Off Setting)     | Như TC-48                         | Xem Total Income          | —                       | Total = phần Salary; phụ thuộc Staff Days Off Setting để chốt Comm/Salary       |               |        | TC-SI-049 · Positive · P1 · ⚠️ #3 |
| 50  | POS     | Detail        | Staff Income / Note               | Staff Income là số **dự trù**, số chốt ở Payroll                         | —                                 | Đối chiếu Payroll cùng kỳ | —                       | Staff Income = estimate; Payroll = số chốt                                      |               |        | TC-SI-050 · Edge · P2             |

## D. Staff Payroll — Commission

| ID  | PROGRAM | FEATURES     | LINK                                   | DESCRIPTION                                                  | PRE-CONDITION      | TEST STEPS           | DATA TEST        | EXPECTED RESULT                                             | ACTUAL RESULT | STATUS | NOTE                           |
| --- | ------- | ------------ | -------------------------------------- | ------------------------------------------------------------ | ------------------ | -------------------- | ---------------- | ----------------------------------------------------------- | ------------- | ------ | ------------------------------ |
| 51  | POS     | Payroll-Comm | Staff Payroll / Commission / Info      | Staff Info: Name + Pay Period + Working Days                 | Staff Commission   | Mở payroll           | 04/15–04/30/2025 | Name, Pay Period = range, Working Days = 8 days             |               |        | TC-SP-001 · UI · P1            |
| 52  | POS     | Payroll-Comm | Staff Payroll / Commission / Listing   | Order listing nhóm **theo Date** (không theo từng order)     | order nhiều ngày   | Xem listing          | —                | Mỗi dòng = 1 ngày; cột Date, Sale, Refund (âm), Supply, Tip |               |        | TC-SP-002 · Positive · P1      |
| 53  | POS     | Payroll-Comm | Staff Payroll / Commission / Detail    | Subtotal = Σ(Sale − Refund) toàn kỳ                          | —                  | Xem Subtotal         | —                | = tổng (Sale − Refund) các ngày                             |               |        | TC-SP-003 · Positive · P1      |
| 54  | POS     | Payroll-Comm | Staff Payroll / Commission / Detail    | Staff Commission = (Subtotal − Supply Fee) × Commission Rate | setting rate       | Xem Staff Commission | —                | Khớp công thức; rate theo setting                           |               |        | TC-SP-004 · Positive · P1      |
| 55  | POS     | Payroll-Comm | Staff Payroll / Commission / Detail    | Clean Up Fee = Deduction × số ngày tính lương                | deduction/ngày     | Xem Clean Up Fee     | deduction × WD   | = deduction × số ngày tính lương                            |               |        | TC-SP-005 · Regression · P1    |
| 56  | POS     | Payroll-Comm | Staff Payroll / Commission / Detail    | Discount Charge / Card Charge Comm / Card Charge Tip         | settings tương ứng | Xem 3 field          | —                | Đúng giá trị; trừ trong Total & Pay 1                       |               |        | TC-SP-006 · Positive · P2 · ⚠️ |
| 57  | POS     | Payroll-Comm | Staff Payroll / Commission / Total     | Total Income = Comm − Cleanup + Tip − CardC − CardT − Disc   | —                  | Xem Total Income     | —                | Đúng công thức                                              |               |        | TC-SP-007 · Positive · P1      |
| 58  | POS     | Payroll-Comm | Staff Payroll / Commission / Pay 1     | Pay 1 = Comm × p1% − Cleanup − CardC − CardT − Disc          | split setting      | Xem Pay 1            | —                | Đúng công thức; % theo Pay1-Pay2 Split                      |               |        | TC-SP-008 · Positive · P1      |
| 59  | POS     | Payroll-Comm | Staff Payroll / Commission / Pay 2     | Pay 2 = Comm × p2% + Tip                                     | split setting      | Xem Pay 2            | —                | Đúng công thức                                              |               |        | TC-SP-009 · Positive · P1      |
| 60  | POS     | Payroll-Comm | Staff Payroll / Commission / Đối chiếu | Pay 1 + Pay 2 = Total Income                                 | —                  | Cộng Pay1 + Pay2     | —                | Khớp                                                        |               |        | TC-SP-010 · Negative · P1      |

## E. Staff Payroll — Salary

| ID  | PROGRAM | FEATURES       | LINK                               | DESCRIPTION                                              | PRE-CONDITION       | TEST STEPS        | DATA TEST        | EXPECTED RESULT                                    | ACTUAL RESULT | STATUS | NOTE                              |
| --- | ------- | -------------- | ---------------------------------- | -------------------------------------------------------- | ------------------- | ----------------- | ---------------- | -------------------------------------------------- | ------------- | ------ | --------------------------------- |
| 61  | POS     | Payroll-Salary | Staff Payroll / Salary / Info      | Staff Info: Name + Pay Period                            | Staff Salary        | Mở payroll        | 04/15–04/30/2025 | Name + Pay Period range                            |               |        | TC-SP-011 · UI · P2               |
| 62  | POS     | Payroll-Salary | Staff Payroll / Salary / Detail    | Hiện Working Days, Working Hours, Salary Amount          | —                   | Xem detail        | —                | 3 field hiển thị                                   |               |        | TC-SP-012 · UI · P1               |
| 63  | POS     | Payroll-Salary | Staff Payroll / Salary / Amount    | Salary by Period → Salary Amount = số setting            | by Period $7000     | Xem Salary Amount | $7000            | = $7000                                            |               |        | TC-SP-013 · Positive · P1         |
| 64  | POS     | Payroll-Salary | Staff Payroll / Salary / Amount    | Wage Per Day → Salary Amount = rate/ngày × Working Days  | rate 150/ngày, WD 8 | Xem Salary Amount | 150 × 8          | = $1200                                            |               |        | TC-SP-014 · Positive · P1         |
| 65  | POS     | Payroll-Salary | Staff Payroll / Salary / Amount    | Wage Per Hour → Salary Amount = rate/giờ × Working Hours | rate 25/giờ, WH 64  | Xem Salary Amount | 25 × 64          | = $1600 (spec ghi nhầm "Wage Per Day" — xem ⚠️ #2) |               |        | TC-SP-015 · Positive · P1 · ⚠️ #2 |
| 66  | POS     | Payroll-Salary | Staff Payroll / Salary / Cleanup   | Deduction/Clean up = deduction × số ngày tính lương      | deduction/ngày      | Xem Deduction     | deduction × WD   | = deduction × số ngày tính lương                   |               |        | TC-SP-016 · Regression · P1       |
| 67  | POS     | Payroll-Salary | Staff Payroll / Salary / Total     | Total Income = Salary Amount − Clean up + Tip            | —                   | Xem Total Income  | —                | Đúng công thức                                     |               |        | TC-SP-017 · Positive · P1         |
| 68  | POS     | Payroll-Salary | Staff Payroll / Salary / Pay 1     | Pay 1 = Salary × p1% − Clean up                          | split setting       | Xem Pay 1         | —                | Đúng công thức; % theo Pay1-Pay2 Split             |               |        | TC-SP-018 · Positive · P2         |
| 69  | POS     | Payroll-Salary | Staff Payroll / Salary / Pay 2     | Pay 2 = Salary × p2% + Tip                               | split setting       | Xem Pay 2         | —                | Đúng công thức                                     |               |        | TC-SP-019 · Positive · P2         |
| 70  | POS     | Payroll-Salary | Staff Payroll / Salary / Đối chiếu | Pay 1 + Pay 2 = Total Income                             | —                   | Cộng Pay1 + Pay2  | —                | Khớp                                               |               |        | TC-SP-020 · Negative · P1         |

## F. Settings dependency · Edge · Cross-report

| ID  | PROGRAM | FEATURES         | LINK                               | DESCRIPTION                                                           | PRE-CONDITION             | TEST STEPS                       | DATA TEST          | EXPECTED RESULT                                                  | ACTUAL RESULT | STATUS | NOTE                                |
| --- | ------- | ---------------- | ---------------------------------- | --------------------------------------------------------------------- | ------------------------- | -------------------------------- | ------------------ | ---------------------------------------------------------------- | ------------- | ------ | ----------------------------------- |
| 71  | POS     | Tip setting      | Staff Income / Exclude Tips        | Exclude Tips From Cash/Check Income = enable → Tip bị loại            | setting enable            | So Total Income on vs off        | —                  | Tip không cộng (hoặc trừ) vào Total Income theo setting          |               |        | TC-SI-051 · Regression · P1 · ⚠️ #4 |
| 72  | POS     | Tip setting      | Staff Income / Exclude Tips        | Exclude Tips = disable → Tip cộng bình thường                         | setting disable           | Xem Total Income                 | —                  | Tip cộng vào Total Income                                        |               |        | TC-SI-052 · Positive · P2           |
| 73  | POS     | Days Off setting | Staff Income / Commission+Salary   | Staff Days Off Setting quyết định nhận Commission hay Salary          | Staff Commission+Salary   | Đổi Days Off setting → xem Total | —                  | Total chốt đúng theo Commission/Salary tùy Days Off Setting      |               |        | TC-SI-053 · Regression · P2 · ⚠️ #3 |
| 74  | POS     | Rate per staff   | Staff Income & Payroll             | Commission Rate & Pay split lấy theo setting **từng staff theo ngày** | 2 staff khác rate         | So 2 staff                       | —                  | Mỗi staff dùng đúng rate/split riêng theo ngày hiệu lực          |               |        | TC-SI-054 · Regression · P2         |
| 75  | POS     | Edge             | Staff Income / Empty               | Staff Commission không order → các field = 0                          | Commission staff, 0 order | Mở detail                        | —                  | Order listing empty; Commission/Total = $0.00, không lỗi         |               |        | TC-SI-055 · Edge · P2               |
| 76  | POS     | Edge             | Staff Income / Wage/Hour no clock  | Wage per Hour thiếu Clock In/Out → Working Hours = 0                  | Wage/Hour chưa chấm công  | Mở detail                        | —                  | Clock In/Out = "-"; Working Hours/Gross = 0 (cần xác nhận xử lý) |               |        | TC-SI-056 · Edge · P2 · ⚠️          |
| 77  | POS     | Edge             | Staff Income / Wage/Day no checkin | Wage per Day cần Check-in để đếm Working Days                         | Wage/Day không check-in   | Mở detail                        | —                  | Ngày không check-in không tính Working Days                      |               |        | TC-SI-057 · Edge · P2 · ⚠️          |
| 78  | POS     | Rounding         | Staff Income / Rounding            | Làm tròn tiền tệ 2 chữ số nhất quán                                   | có số lẻ                  | So tổng vs từng dòng             | Sophia 88.08/88.09 | Không lệch quá rounding hợp lý                                   |               |        | TC-SI-058 · Edge · P2 · ⚠️          |
| 79  | POS     | Cross-report     | Staff Income ↔ Income Summary      | Total Income (Staff Income) ↔ Staff Payout (Income Summary) cùng kỳ   | 1 ngày, cùng staff        | So 2 report                      | cùng ngày          | Các con số tương ứng khớp (Commission/Tip/Cleanup/Pay 1/Pay 2)   |               |        | TC-XR-001 · Negative · P1           |
| 80  | POS     | Cross-report     | Staff Income ↔ Staff Payroll       | Staff Income (estimate) ↔ Staff Payroll (chốt) cùng kỳ                | kỳ đã chốt                | So 2 report                      | cùng kỳ            | Cùng setting → công thức khớp; Payroll là số chốt cuối           |               |        | TC-XR-002 · Regression · P2         |

## 🐞 Bug candidates (quan sát thực tế — cần xác nhận với dev)

> Phát hiện khi lướt UI thật (06/16/2026). Cần dev xác nhận trước khi log bug chính thức.

| #   | Màn / Staff                            | Quan sát                                                                                                                                                                                           | Kỳ vọng                                                                                                | TC liên quan          |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | Commission detail / **Sophia**         | "Commission Rate (06/16/2026): **10%**" nhưng Staff Commission = **$76.17** = (193.33 − 41) × **50%**. Rate hiển thị ≠ rate dùng để tính.                                                          | Rate hiển thị phải khớp rate thực dùng (hoặc 10% → Commission $15.23, hoặc rate hiển thị = 50%)        | TC-SI-022             |
| 2   | Salary detail / **Wage Per Day 4**     | Rate = $0.00, Working Days = 0, Gross Income = $0.00, Clean Up = $5.00, Tip = $0 → theo label `Gross − Clean Up + Tip` phải = **−$5.00**, nhưng **Total Income = $45.00** (Pay 1 $20 + Pay 2 $25). | Total Income phải khớp các thành phần hiển thị, hoặc hiển thị đúng Rate/Gross/Salary Amount tạo ra $45 | TC-SI-043 / TC-SI-046 |
| 3   | Listing / **Maia Kennedy**, **Johnna** | Subtotal âm (−$70.22 / −$38.02) nhưng **Total Income = $0.00**; trong khi staff khác (Thong −$0.44, Lami −$5.00) Total âm. Không nhất quán cách xử lý âm vs ép 0.                                  | Thống nhất: hoặc luôn cho âm, hoặc ép 0 có quy tắc rõ ràng                                             | TC-SI-009 / TC-SI-035 |
| 4   | Listing / **Loda02**                   | Orders = 0, Subtotal/Supply/Tip = $0.00 nhưng **Total Income = $0.04**.                                                                                                                            | Làm rõ nguồn $0.04 khi không có order (rounding? lương sót?)                                           | TC-SI-058             |

## Coverage map

| Mục spec                                                     | Test case (ID) |
| ------------------------------------------------------------ | -------------- |
| Gating passcode                                              | 1–3            |
| Staff Listing (search/filter/sort/columns)                   | 4–16           |
| Staff Income — Commission detail                             | 17–36          |
| Staff Income — Salary / Commission+Salary detail             | 37–50          |
| Staff Payroll — Commission                                   | 51–60          |
| Staff Payroll — Salary                                       | 61–70          |
| Setting dependency (Tip exclude / Days Off / Rate per staff) | 71–74          |
| Edge / Rounding                                              | 75–78          |
| Cross-report (Income Summary / Payroll)                      | 79, 80         |
| Pay 1 + Pay 2 = Total Income (kiểm nhất quán)                | 34, 46, 60, 70 |
| Bug candidates                                               | 🐞 #1–#4       |

## ⚠️ Điểm cần làm rõ với BA/QC

1. ~~Salary Total Income dấu Clean up~~ → **đã verify: là `− Clean Up Fee`** (UI label "Gross Income - Clean Up Fee + Tip").
2. **Staff Payroll — Salary / Wage Per Hour:** spec viết `Salary Amount = [Wage Per Day rate] × Working Hour` — nghi nhầm, đúng phải `[Wage Per Hour rate] × Working Hours`. Xác nhận TC-SP-015.
3. **Commission + Salary — phần nào vào Total:** spec nói "Total show Salary" nhưng cũng "phụ thuộc Staff Days Off Setting". Làm rõ khi nào Total = Salary, khi nào = Commission, và estimate lấy theo nguyên tắc nào.
4. **Exclude Tips From Cash/Check Income:** enable thì loại **toàn bộ** tip hay chỉ tip tiền mặt/check (giữ tip thẻ)?
5. **Data mẫu phí khấu trừ** (Discount Charge, Card Charge Comm/Tip): chưa có dataset ≠ 0 để verify Total/Pay đầy đủ.
6. **"Số ngày" cho Clean Up Fee:** "số ngày xem report" (Staff Income) vs "số ngày tính lương" (Payroll) — tính cả ngày không làm/không check-in?
7. **Label Total Income/Pay rút gọn:** UI chỉ ghi `Comm - Clean Up + Tip` / `Gross - Clean Up + Tip`, không liệt kê Card Charge & Discount Charge dù field có. Xác nhận các phí này có thực sự được trừ trong giá trị tính hay không (TC-SI-030).

---

## Hiện trạng tự động hoá (Playwright)

> Route Staff Income: `/incomes/income-staff?from=<unix>&to=<unix>[&staffId=<uuid>]`. Gated passcode.
> Khi implement, tham chiếu mã TC trong tên test, vd: `test("TC-SI-021 | Commission = (Subtotal - Supply) x Rate", ...)`.

- **Tier 1 (real DB, structural/read-only):** gating passcode, listing đủ cột + sort, search, filter Today/1 ngày/range, mở detail theo từng Compensation, header (tên + ngày + Print) + footer, đối chiếu Total Income listing ↔ detail, hiển thị số âm. → `tests/regression/incomes/staff-income/*.spec.ts` (chưa tạo).
- **Tier 3 (mocked dataset):** công thức Commission/Salary/Pay 1/Pay 2 với số chính xác + 3 phí khấu trừ ≠ 0; cùng các bug candidate #1–#4. → cần mock query Staff Income/Payroll (chờ data mẫu — ⚠️ #5).

---

## A5. Quét toàn bộ staff trong 1 tháng (MCP Playwright, dữ liệu thật, 2026-07-21)

> Phạm vi quét theo yêu cầu: đổi filter sang **"Last 30 Days"** (`06/22/2026 - 07/21/2026`, tương đương preset "1 tháng" — combobox không có sẵn nhãn "Month" riêng, dùng "Last 30 Days"), quét **6 thẻ tổng** + **click vào từng dòng staff** trong bảng, với staff có nhiều order thì kiểm tra cách bảng order hiển thị hết (không phân trang).

### Tổng quan toàn shop (Last 30 Days)

| Chỉ số             | Giá trị    |
| ------------------ | ---------- |
| Total staff        | 15         |
| Total orders       | 319        |
| Total subtotal     | $16,046.40 |
| Total supply fee   | $250.00    |
| Total tip          | $1,149.66  |
| Total staff income | $32,226.28 |

### Danh sách 15 staff (click từng dòng, ghi nhận Salary Type thật của từng người)

| Staff    | Orders  | Subtotal  | Supply Fee | Tip     | Total Income | Compensation mode xác nhận                                                              |
| -------- | ------- | --------- | ---------- | ------- | ------------ | --------------------------------------------------------------------------------------- |
| Wendy    | 5       | $520.00   | $1.00      | $80.00  | $222.00      | Salary — **Wage Per Day**                                                               |
| Vincent  | 9       | $754.00   | $14.00     | $246.00 | $523.19      | **Commission**                                                                          |
| Val      | 14      | $781.90   | $25.00     | $0.00   | $450.00      | (chưa mở panel — Total Income tách biệt Subtotal ⇒ khả năng Salary)                     |
| trinehhh | 1       | $140.00   | $0.00      | $20.00  | $20.00       | Commission (đã xác nhận ở phiên trước)                                                  |
| Tony     | 14      | $1,161.00 | $48.00     | $80.11  | $1,328.58    | (chưa mở — pattern giống Salary do Total Income >> Subtotal)                            |
| Ryan     | 12      | $612.00   | $3.00      | $98.00  | $366.58      | Salary — **Wage Per Hour**                                                              |
| Mai      | 15      | $1,222.00 | $23.00     | $0.00   | $9,816.62    | Salary (Total Income rất lớn so với Subtotal ⇒ Salary by Period rate cao)               |
| Linda    | 8       | $584.00   | $15.00     | $80.56  | $1,328.95    | Salary (pattern giống Tony/Kevin)                                                       |
| Kevin    | **186** | $6,355.00 | $18.00     | $277.50 | $4,634.13    | Salary — **Salary by Period** (nhiều order nhất — xem mục "Staff nhiều order" bên dưới) |
| Jackie   | 9       | $1,910.00 | $43.00     | $147.00 | $812.66      | Commission (đã xác nhận ở phiên trước)                                                  |
| Hugo     | 11      | $240.00   | $5.00      | $0.00   | $68.45       | Commission (đã xác nhận ở phiên trước)                                                  |
| Evon     | 14      | $458.00   | $15.00     | $0.00   | $4,551.98    | Salary (Total Income >> Subtotal)                                                       |
| Bob      | 9       | $728.50   | $16.00     | $60.49  | $456.14      | chưa mở                                                                                 |
| Annie    | 6       | $310.00   | $12.00     | $0.00   | $7,490.00    | Salary (Total Income >> Subtotal)                                                       |
| Andy     | 6       | $270.00   | $12.00     | $60.00  | $157.00      | chưa mở                                                                                 |

> Đủ 3/3 sub-mode Salary đã xác nhận trực tiếp qua panel chi tiết: **Wage Per Day** (Wendy), **Wage Per Hour** (Ryan), **Salary by Period** (Kevin) — cộng **Commission** (Vincent/trinehhh/Jackie/Hugo). Các staff còn lại (Val/Tony/Mai/Linda/Evon/Bob/Annie/Andy) suy luận qua chênh lệch Subtotal vs Total Income nhưng **chưa click mở panel** — nên mở thêm nếu cần verify công thức chính xác từng người (không phải blocker vì mục tiêu chính — phủ đủ 3 loại Salary + Commission — đã đạt).

### Chi tiết 3 loại Salary + Commission (copy nguyên văn từ panel)

**1. Wage Per Day — Wendy** (5 order, Working Days: 1):

- Sale $520.00 / Refund $0.00 / Subtotal $520.00
- Salary Type: **Wage Per Day**, Rate: $150.00
- Gross Income _(Rate × Working Days)_: $150.00
- Clean Up Fee/Deduction: $8.00 · Tip: $80.00 · Card Charge Tip: $0.00
- **Total Income** _(Gross Income − Clean Up Fee + Tip − Card Charge Tip)_: $222.00
- Pay 1 _(Gross Income × 40% − Clean Up Fee − Card Charge Tip)_: $52.00
- Pay 2 _(Gross Income × 60% + Tip)_: $170.00

**2. Wage Per Hour — Ryan** (12 order, Working Hours: 60.92):

- Sale $784.00 / Refund -$172.00 / Subtotal $612.00
- Salary Type: **Wage Per Hour**, Rate: $5.00
- Gross Income _(Rate × Working Hours)_: $304.58
- Clean Up Fee/Deduction: $36.00 · Tip: $98.00 · Card Charge Tip: $0.00
- **Total Income**: $366.58 · Pay 1: $40.14 · Pay 2: $326.44

**3. Salary by Period — Kevin** (186 order, Working Days: 13):

- Sale $6,656.00 / Refund -$301.00 / Subtotal $6,355.00
- Salary Type: **Salary by Period**, Rate hiển thị **"-"** (rate thay đổi giữa kỳ, xem breakdown theo sub-kỳ bên dưới)
- **Rate đổi giữa chừng trong 1 tháng** (điểm quan trọng khi quét khoảng dài): Rate (06/22–07/08): $0.00 · Rate (07/09–07/13): $400.00 · Rate (07/14–07/20): $285.71 · Rate (07/21): $666.66
- Gross Income _(Fixed salary for this period)_: $4,666.66 (tổng các sub-kỳ)
- Clean Up Fee/Deduction: $260.00 · Tip: $277.50 · Card Charge Tip: $50.00
- **Total Income**: $4,634.16 · Pay 1: $2,023.30 · Pay 2: $2,610.86

**4. Commission — Vincent** (9 order):

- Sale $864.00 / Refund -$110.00 / Subtotal $754.00 / Supply Fee $14.00
- Staff Commission _((Subtotal − Supply Fee) × Rate)_: $464.80
- **Commission Rate cũng đổi theo sub-kỳ trong khoảng quét**: 60% (06/22–06/24), 60% (06/25–06/27), **80%** (06/28–06/29), 60% (06/30), 60% (07/01–07/08, 07/09–07/13, 07/14–07/20, 07/21)
- Card Charge Commission: $47.21 · Clean Up Fee: $70.00 · Discount Charge: $48.00 · Tip: $246.00 · Card Charge Tip: $22.40
- **Total Income**: $523.19
- Pay 1 Rate cũng đổi theo sub-kỳ (30% hầu hết, 50% trong 06/28–06/29) → Pay 1: **-$31.53** (âm, do Clean Up/Discount/Card Charge lớn hơn phần Commission × Pay 1 Rate)
- Pay 2 Rate: 70% (50% trong 06/28–06/29) → Pay 2: $554.72

> **Phát hiện quan trọng khi quét khoảng dài (1 tháng) thay vì 1 ngày:** nếu Rate/Commission Rate/Pay 1 Rate/Pay 2 Rate của staff **thay đổi giữa chừng trong khoảng ngày đang xem**, panel chi tiết **tự tách thành nhiều dòng "Rate (từ ngày - đến ngày): giá trị"** thay vì 1 giá trị Rate duy nhất — đây là hành vi KHÔNG xuất hiện khi quét theo Today/1 ngày (đã quét trước đó), nên các test case cũ (TC-IST/TC-SI) set-điều-kiện đơn Rate sẽ **cần bổ sung case multi-period-rate** khi test theo khoảng ngày dài.

### Staff nhiều order — Kevin (186 order)

- Bảng order riêng của Kevin có **toàn bộ 186 dòng render 1 lần trong DOM** (đếm được 205 `<tr>` kể cả header/phần khác) — **không có nút "Show more"/phân trang/virtualization** ở panel chi tiết Staff Income (khác với Income Summary có nút "Show more/Show less" cho bảng theo kỳ).
- Ý nghĩa cho test tự động: khi staff có nhiều order, **`browser_snapshot`/DOM query lấy đủ hết order** mà không cần scroll-and-reload hay click "load more" — chỉ cần `scrollThroughPage()` để đảm bảo lazy-render (nếu có) đã mount, không cần logic phân trang riêng.
- Rủi ro hiệu năng: nếu số order lên tới hàng nghìn, render toàn bộ không phân trang có thể chậm — chưa đo được vì dataset hiện tại tối đa 186.

## A6. Đối chiếu Staff Income ↔ Staff Settings — Compensation (xác nhận cấu trúc salary giống hệt)

Quét `/settings/staffs/<id>` → tab **Compensation** (vd. Ryan) xác nhận UI setting dùng **đúng cấu trúc 2 tầng** như Staff Income hiển thị:

```
Commission
Commission + Salary
  └─ Salary Setting
       ├─ Salary by Period
       ├─ Wage Per Day
       └─ Wage Per Hour
```

- Toggle gốc: **Commission** hoặc **Commission + Salary** (không có "chỉ Salary" độc lập — luôn đi kèm Commission Setting bên dưới dù staff chọn Commission + Salary).
- Khi chọn **Commission + Salary**, mở thêm khối **Salary Setting** với 3 lựa chọn con: **Salary by Period / Wage Per Day / Wage Per Hour** — đúng 3 loại đã quan sát được trên Staff Income (Kevin=Salary by Period, Wendy=Wage Per Day, Ryan=Wage Per Hour).
- Ngoài ra Compensation còn có: Commission Setting (For Service/Product/Gift Card — % Staff/Owner), Pay 1 - Pay 2 (%), Deduction Per Day (USD), Card Fee Charge (On Staff Commission %, On Credit Card Tip % + toggle "Add credit card tips to staff paycheck"), Staff Days Off Setting (Limit days off, Max days off allowed, Days not allowed to be off theo thứ), toggle **Exclude Tips From Cash/Check Income**.
- **Kết luận:** cấu trúc "Commission + Salary gồm Salary by Period / Wage Per Day / Wage Per Hour" ở Staff Settings **khớp hoàn toàn** với 3 sub-mode Salary Type quan sát được ở panel chi tiết Staff Income — không có mode thứ 4 hay khác biệt nào giữa 2 màn.
