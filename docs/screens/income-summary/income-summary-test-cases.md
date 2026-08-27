---
title: Tổng hợp thu nhập (/incomes/income-summary) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /incomes/income-summary
scanned-at: 2026-07-06
consolidates: feature-spec + test cases + i18n (coverage + meaning)
excludes: docs/codegen-flow/income-summary-flow.md · docs/codegen-detail/income-summary-detail.md (giữ riêng)
---

# Tổng hợp thu nhập (`/incomes/income-summary`) — Tài liệu hợp nhất

> MỘT file duy nhất: gộp đặc tả tính năng + test case + kết quả quét Tiếng Việt (còn tiếng Anh + dịch đúng chuẩn). Kết quả trực quan: [reports/income-summary/income-summary.html](../../reports/income-summary/income-summary-scan.html). Luồng code-gen giữ riêng: [codegen-flow/income-summary-flow.md](../income-summary/income-summary-code-detail.md) · [codegen-detail/income-summary-detail.md](../income-summary/income-summary-code-detail.md).

# PHẦN A — Đặc tả tính năng

## A1. Mục tiêu & phạm vi

Màn `/incomes/income-summary` tổng hợp thu nhập theo **khoảng thời gian** (không chỉ 1 ngày):

- Chọn **date range** + nhóm dữ liệu theo **Day / Week / Month**.
- **Total Income** của khoảng đã chọn, luôn **so sánh với khoảng liền trước** (vs. Same day/period last week...).
- Biểu đồ 3 thông số **Gross Income / Net Income / Total Tip**.
- Bảng tổng theo mốc thời gian; click 1 dòng → mở **panel chi tiết** (Payment / Sale / Supply Fee / Staff Payout / Salon Earnings).
- **In** báo cáo (nút Print trong panel chi tiết).

Đây là báo cáo đối soát sâu nhất trong nhóm Income — dùng để chốt payout nhân viên và earnings của salon.

## A2. Các luồng chính (từ Linear)

- **Income Summary chart** — filter date range + xem theo **Day/Week**; **Total Income** compare với kỳ trước:
  - **Gross Income:** tổng sale trước refund; **không** gồm tip, không gồm gift card load/activation.
  - **Net Income:** tổng sale sau refund/partial refund; **không** tính Tip, order Cancel, sale giftcard.
  - **Total Tip.**
- **Total Income table:** `Date`; `Sale`; `Tip`; `Net Income`; `Total Payment`. _(UI thực tế: Date / Sale / Tip / Tax / Total Payment — xem §A4.)_
- **Income Summary detail** — 5 khối:
  - **PAYMENT DETAILS:** Card/Cash/Others mỗi loại = Sale − Refund + Tip + Tax; **Amount Collected = Card+Cash+Others**; Gift Card Redemption (Sale/Tip/Tax); **TOTAL PAYMENT = Amount Collected + Gift Card Redemption**.
  - **SALE DETAILS:** **Total Sale = Gift card + Service + Product Sale**; **Total Refund = Service + Product Refund**; **Subtotal = Sale − Refund**; Discount = Discount − Discount Reversed; **Net Total = Subtotal − Discount**; Tip; Tax Collected; **TOTAL PAYMENT = Net Total + Tax + Tip**.
  - **SUPPLY FEE:** Total Supply Fee; **Staff Supply Share = Total × 0.6**; Salon Supply Share = phần còn lại.
  - **STAFF PAYOUT:** Total Service = Service Sale − Service Refund; Staff Supply Share; **Staff Commission (60%) = Total Service×60% − Staff Supply Share**; Tip; Clean up fee; Staff Salary; **TOTAL STAFF PAYOUT = Commission + Tip − Clean up + Salary** → chia **Pay 1 / Pay 2**.
  - **SALON EARNINGS:** Salon Commission (40%); Product Sale/Refund; Total Discount; **Net Earnings**; Staff Supply Share; Clean up fee; Staff Salary; **TOTAL EARNING**; Tax Collected.

## A3. Thành phần UI thực tế — khu filter + tổng + bảng (quét Playwright MCP, 2026-07-06)

Ảnh: [income-summary-assets/income-summary-detail.png](income-summary-assets/income-summary-detail.png) (đã click 1 dòng để bung panel chi tiết)

| Thành phần                                       | Vai trò                                 | Trạng thái | Ghi chú                                                   |
| ------------------------------------------------ | --------------------------------------- | ---------- | --------------------------------------------------------- |
| Tiêu đề **Income Summary**                       | Nhãn màn hình                           | Hoạt động  |                                                           |
| Combobox preset (**Today**)                      | Chọn khoảng ngày nhanh                  | Hoạt động  | Đi kèm calendar                                           |
| Nút **calendar `07/06/2026`**                    | Date-picker                             | Hoạt động  | Accessible name `MM/DD/YYYY`                              |
| Tabs **Day / Week / Month**                      | Nhóm dữ liệu                            | Hoạt động  | URL `groupBy=day`; **Day** selected mặc định              |
| **Total Income** (heading + `$0.00`)             | Tổng thu nhập khoảng đã chọn            | Hoạt động  | Kèm `100.00%` + "vs. Same day last week"                  |
| 3 nhãn **Gross Income / Net Income / Total tip** | Legend chart                            | Hoạt động  |                                                           |
| **Chart** (application, trục $0–$100)            | Biểu đồ theo khoảng                     | Hoạt động  |                                                           |
| **Bảng tổng**                                    | Date / Sale / Tip / Tax / Total Payment | Hoạt động  | Click 1 dòng → mở detail; URL thêm `detailId=<from>-<to>` |

## A4. Panel chi tiết (sau khi click 1 dòng)

| Khối                 | Các dòng quét được                                                                                                                                                                                                                                                                              | Ghi chú                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Header               | Heading ngày + nút **Print**                                                                                                                                                                                                                                                                    |                                                        |
| **Payment Details**  | **Cash / Card / Others** (mỗi loại: Sale, Refund, Tip, Tax) → **Amount Collected** → **Gift Card Redemption** (Sale, Tip, Tax) → **Total Payment**                                                                                                                                              | Khớp spec                                              |
| **Sale Details**     | **Total Sale** (Service Sale, Product Sale, Gift Card Sale) → **Total Refund** (Service Refund, Product Refund) → **Subtotal** → **Total Discount** (Discount, Discount Reversed) → **Net Total** → Tip → Tax Collected → **Total Payment**                                                     | Khớp spec                                              |
| **Supply Fee**       | Total supply fee, Staff Supply Share, Salon Supply Share                                                                                                                                                                                                                                        | Khớp spec                                              |
| **Staff Payout**     | Total Service, Staff Supply Share, Staff Commission, Tip, Clean Up Fee, **Discount Charge**, **Card Charge - Commission**, **Card Charge - Tip**, Staff Salary → **Total Staff Payout** (Pay 1, Pay 2)                                                                                          | ⚠️ 3 dòng in đậm là **mới**, chưa có trong spec Linear |
| Toggle **Show less** | Thu gọn khối Staff Payout                                                                                                                                                                                                                                                                       | UI element mới                                         |
| **Salon Earnings**   | Total Service, Salon Supply Share, Salon Commission, Product Sale, Product Refund, Total Discount (Discount, Discount Reversed), **Net Earnings**, Staff Supply Share, Clean Up Fee, **Discount Charge**, **Card Charge - Commission**, **Card Charge - Tip**, Staff Salary, **Total Earnings** | ⚠️ 3 dòng "Charge" là mới so với spec                  |

## A5. Nghiệp vụ & ràng buộc

- **Total Income** luôn kèm phần trăm so với **kỳ liền trước** (nhãn phụ thuộc groupBy: "same day last week"...).
- Panel chi tiết **chỉ hiện khi chọn 1 dòng** trong bảng; `detailId` được ghi lên URL → deep-link được.
- Công thức chốt payout: `Staff Commission (60%)`, `Salon Commission (40%)` dựa trên Staff Compensation split; `Staff Supply Share = Total Supply Fee × 0.6`.
- **Total Staff Payout** tách thành **Pay 1 / Pay 2** theo setting Pay 1 – Pay 2 Split của từng staff.
- Ba dòng **Card Charge - Commission / Card Charge - Tip / Discount Charge** phản ánh phí thẻ & discount phân bổ — cần PO bổ sung công thức chính thức (chưa có trong Linear).

## A6. Trạng thái / quyền / edge case

- **Quyền:** owner passcode (đã bypass 30 phút trong phiên quét này nên không hiện lại dialog).
- **Empty state bảng:** vẫn có 1 dòng cho mốc đang xem với toàn `$0.00`; panel chi tiết mặc định "No detail to show — Select a period from the table to view income details."
- **Group By:** Day/Week/Month đổi cách gom dòng bảng và mốc chart.
- **Refund/Discount:** ảnh hưởng Subtotal (âm), Discount Reversed cộng ngược khi refund.

## A7. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

| Mục              | Linear                                                  | UI thực tế                                                            | Kết luận                                                                      |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Group By         | Day / **Week**                                          | Day / Week / **Month**                                                | ⚠️ UI có thêm **Month** — spec chỉ nêu Day/Week                               |
| Cột bảng tổng    | Date / Sale / Tip / **Net Income** / Total Payment      | Date / Sale / Tip / **Tax** / Total Payment                           | ⚠️ **Lệch cột**: UI hiển thị **Tax** thay vì **Net Income**. Cần PO xác nhận. |
| 3 thông số chart | Gross / Net / Total Tip                                 | Gross Income / Net Income / Total tip                                 | ✅ Khớp                                                                       |
| Payment Details  | Card/Cash/Others + Amount Collected + Gift Card + Total | Đủ, thêm Sale/Refund/Tip/Tax breakdown mỗi loại                       | ✅ Khớp (UI chi tiết hơn)                                                     |
| Sale Details     | đầy đủ các dòng                                         | Khớp từng dòng                                                        | ✅ Khớp                                                                       |
| Staff Payout     | Commission / Tip / Clean up / Salary / Pay1 / Pay2      | Thêm **Discount Charge, Card Charge - Commission, Card Charge - Tip** | ⚠️ **UI thừa 3 dòng** so với spec                                             |
| Salon Earnings   | Net Earnings / Total Earning ...                        | Thêm **Discount Charge, Card Charge - Commission/Tip**                | ⚠️ **UI thừa 3 dòng** so với spec                                             |

# PHẦN B — Quét Tiếng Việt (i18n)

> Nguồn số liệu: `reports/income-summary/compare.json` (TC-i18n-screen-compare, quét sau khi cuộn hết trang + glossary bổ sung theo [VP-2252](https://linear.app/fastboy/issue/VP-2252)). Deep-scan panel chi tiết bắt thêm **Pay 1 / Pay 2** còn tiếng Anh (xem B1).

## B0. Tổng quan (số liệu từ compare.json)

> **Chuỗi UI đối chiếu 23** · ❌ chưa dịch **1** · ⚠️ sai chuẩn **3** · 📐 UI vỡ **0** · ✅ thuật ngữ đúng **19** · (data bỏ qua: 8 · tổng pair 45)

| Chỉ số                    | Giá trị   |
| ------------------------- | --------- |
| `total` (tổng pair)       | 45        |
| `missing` (còn tiếng Anh) | 1         |
| `suspect` (sai chuẩn)     | 3         |
| `ok` (đúng chuẩn)         | 19        |
| `data` (bỏ qua — số/tiền) | 8         |
| `uiBroken.xOverflow`      | 0px       |
| `uiBroken.clipped`        | [] (rỗng) |

## B1. ❌ Còn tiếng Anh (nhãn UI thật)

| Chuỗi (EN)        | Đang hiển thị (VI)     | Nên dịch     | Ghi chú                                                                                                                                                                                                                    |
| ----------------- | ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tip`             | `Tip` (chưa qua `t()`) | **Tiền tip** | Nhãn "Tip" trong khu Total Income / bảng tổng (header cột). Cùng lỗi với income-daily (label cứng dùng chung). Nguồn: `data-table-column-header.tsx:33`.                                                                   |
| `Pay 1` / `Pay 2` | `Pay 1` / `Pay 2`      | (cần dịch)   | [VP-2253](https://linear.app/fastboy/issue/VP-2253) — trong panel chi tiết mục **Tổng chi trả nhân viên** (Staff Payout). Chỉ hiện sau khi mở khối → deep-scan (`scanIncomesDetail` + `expandPanelSections`) mới bắt được. |

## B2. ⚠️ Dịch chưa đúng chuẩn

| Hiện tại (VI)   | Gốc (EN)       | Nên dùng (chuẩn)       | Nguồn / Issue                                                                                                     |
| --------------- | -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Thu nhập gộp`  | `Gross Income` | **Tổng thu nhập**      | [VP-2256](https://linear.app/fastboy/issue/VP-2256) — legend biểu đồ (`income-summary-chart-legend.tsx:27`).      |
| `Thu nhập ròng` | `Net Income`   | **Thu nhập thực nhận** | [VP-2256](https://linear.app/fastboy/issue/VP-2256) — legend biểu đồ (`income-summary-chart-legend.tsx:27`).      |
| `Bán hàng`      | `Sale`         | **Doanh thu**          | [VP-2259](https://linear.app/fastboy/issue/VP-2259) — "Sale" không nhất quán (`data-table-column-header.tsx:33`). |

> **Lưu ý phạm vi (còn sót — cần fix riêng):** compare chỉ phủ **view mặc định**. Hai lỗi sau nằm trong **panel chi tiết** (chỉ mount sau click 1 dòng) nên compare tự động **chưa** bắt — ghi nhận từ Linear:
>
> - [VP-2258](https://linear.app/fastboy/issue/VP-2258): `Net Total` → "Thực thu" gây nhầm ⇒ nên **"Doanh thu thuần"**.
> - (Glossary đã thêm các từ này nên khi mở rộng compare vào panel chi tiết sẽ tự bắt.)

## B3. ✅ Đã dịch đúng (mẫu)

| EN                            | VI                            |
| ----------------------------- | ----------------------------- |
| Income Summary                | Tổng hợp thu nhập             |
| Total Income                  | Tổng thu nhập                 |
| Day                           | Ngày                          |
| Week                          | Tuần                          |
| Month                         | Tháng                         |
| Today                         | Hôm nay                       |
| Total tip                     | Tổng tip                      |
| Tax                           | Thuế                          |
| Total Payment                 | Tổng thanh toán               |
| vs. Same day last week        | so với Cùng ngày tuần trước   |
| No detail to show             | Không có chi tiết để hiển thị |
| Order History                 | Lịch sử đơn hàng              |
| Scanner                       | Quét mã                       |
| Internet connection restored. | Đã kết nối internet trở lại.  |

## B4. 📐 UI vỡ (chỉ báo cáo)

> Không phát hiện: `xOverflow = 0px`, `clipped = []`. Tabs Day/Week/Month + bảng vẫn khít với bản dịch VI.

# PHẦN C — Test cases

> Màn này **đã có bộ test rất lớn** (~70 TC + reconciliation pipeline). Bảng dưới tài liệu-hoá coverage theo nhóm (section) để đối chiếu spec Linear — GIỮ NGUYÊN ID và nội dung từ `docs/testcases/income-summary-testcases.md`. Không sinh/đè code.

## Cách chạy

```bash
npx playwright test tests/regression/incomes/income-summary tests/regression/incomes/income-summary-past \
  tests/regression/incomes/income-summary-reconciliation tests/regression/incomes/income-summary-ui
```

## Bảng test case theo nhóm (đã hiện thực)

| Nhóm                        | TC IDs                                      | Trọng tâm kiểm thử                                                                            | Kết quả mong đợi                             | File                           |
| --------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| Overview                    | TC01,03,04,06,09,15,16,17,18,19,25,34,48,56 | Layout 2 panel, filter mặc định Today, tabs Day/Week/Month, chart 3 series, bảng tổng         | Đúng cấu trúc + giá trị mặc định             | overview                       |
| Filter                      | TC02,05,07                                  | Preset dropdown + date-picker + groupBy                                                       | URL `groupBy=`, range đổi đúng               | filter                         |
| Total Income                | TC08,09,11,12,13,14                         | Total Income + %so kỳ trước (Gross/Net/Tip)                                                   | Compare label + % đúng, không NaN            | total-income                   |
| Payment Details             | TC20–27                                     | Card/Cash/Others (Sale/Refund/Tip/Tax), Amount Collected, Gift Card Redemption, Total Payment | Khớp GraphQL + đẳng thức                     | payment-details                |
| Sale Details                | TC28–34                                     | Total Sale/Refund, Subtotal, Discount, Net Total, Tip, Tax, Total Payment                     | Đẳng thức Net Total = Subtotal − Discount... | sale-details                   |
| Supply Fee                  | TC35,36,37                                  | Total / Staff Share (×0.6) / Salon Share                                                      | Chia đúng tỉ lệ                              | supply-fee                     |
| Staff Payout                | TC38–51                                     | Commission 60%, Tip, Clean up, Salary, Pay 1/Pay 2, Show more/less                            | Khớp công thức payout                        | staff-payout                   |
| Staff Payout ↔ Staff Income | TC38,40,41,44                               | Đối chiếu payout với màn Staff Income                                                         | Nhất quán chéo báo cáo                       | staff-payout-from-staff-income |
| Salon Earnings              | TC52,53,54,55,55b                           | Salon Commission 40%, Net Earnings, Total Earnings, Tax                                       | Khớp công thức                               | salon-earnings                 |
| Charge fields & Salon tax   | TC66–72                                     | Discount Charge, Card Charge - Commission/Tip (fields UI mới)                                 | Giá trị hợp lệ, reconcile                    | charge-fields                  |
| Reconciliation              | TC56,57,58                                  | Panel ↔ tổng bảng ↔ GraphQL                                                                   | Ba nguồn khớp                                | reconciliation                 |
| Cross-report                | TC59,60,61                                  | Income Summary ↔ Daily ↔ Staff                                                                | Nhất quán chéo                               | cross-report                   |
| Edge cases                  | TC62,63,64,65                               | Ngày trống, refund âm, discount reversed                                                      | Xử lý đúng                                   | edge                           |
| Re-derive (Cách 2)          | TC-RD                                       | Staff/Salon re-derive từ DB                                                                   | Khớp giá trị tính lại                        | RD-staff-salon-rederive        |
| Past pipeline               | TC-PAST                                     | Ngày quá khứ full pipeline                                                                    | Khớp snapshot                                | income-summary-past            |
| Recon pipeline              | TC-RECON-\*                                 | orders→income summary, sections-from-compensation, staff-compensation                         | Pipeline đối soát đầu-cuối                   | income-summary-reconciliation  |
| App-faithful HTML / UI      | TC-IS-UI                                    | Render HTML trung thực với app                                                                | Khớp cấu trúc DOM                            | income-summary-ui              |

**Tổng: ~70+ test** trải 15 file spec + helpers (`incomeSummary.helpers.ts`).

### Ghi chú test case

- Công thức nguồn: [src/reports/incomeCalcCore.ts](../../src/reports/incomeCalcCore.ts); bảng công thức: [docs/report-field-formulas.md](../report-field-formulas.md).
- 3 field UI mới (Discount Charge, Card Charge - Commission/Tip) đã được kiểm thử ở nhóm **charge-fields** dù spec Linear chưa mô tả — xem cảnh báo §A7.
- Page object: [src/pages/pos/IncomeSummaryPage.ts](../../src/pages/pos/IncomeSummaryPage.ts).

## Nguồn: VP-1048 — Income Summary (Add Tax Column) — Test Cases đầy đủ

> Nội dung nguyên văn từ tài liệu test case gốc VP-1048 (đã hợp nhất vào đây, file gốc đã xoá). Nguồn: Linear VP-1048 + tài liệu "[Volt POS] POS Income" + screenshot UI thực tế.
> Format theo cột Excel: ID | PROGRAM | FEATURES | LINK | DESCRIPTION | PRE-CONDITION | TEST STEPS | DATA TEST | EXPECTED RESULT | ACTUAL RESULT | STATUS | NOTE.
> Phạm vi: **Income Summary report** (chart/filter/table + detail: Payment / Sale / Supply Fee / Staff Payout / Salon Earnings) + cross-report. Loại trừ màn **Staff Income** riêng (đã gộp vào `income-staff.md`).
> NOTE chứa: Mã TC nội bộ · Loại (Positive/Negative/Boundary/Edge/Regression/UI) · Ưu tiên (P1/P2/P3) · nguồn `QC#N` (bug regression) / `ACn` · ⚠️ = cần làm rõ.
> ⚠️ Điểm cần làm rõ: (1) Pay1+Pay2 lệch Total Staff Payout đúng bằng Staff Salary; (2) base Salon Commission khi refund lớn; (3) "100% vs Last year" nghi data 2025 = 0; (5) Supply Fee trừ trùng trong Total Staff Payout/Pay1; (6) data verify cho các charge fields mới. Xem cuối phần.

### Giao diện Income Summary (tham khảo — theo UI mới nhất)

Màn hình chia **2 panel**. **Panel trái:** bộ lọc (dropdown kỳ `Custom`/`Năm` + Date picker + toggle Day/Week/Month, mặc định Day–Today) · Total Income (Net Income, có thể âm) + % so sánh ("vs. Previous period" cho Day/Custom, "vs. Last year" cho Week/Month) + chart 3 series (Gross/Net/Tip) · bảng `Date | Sale | Tip | Tax | Total Payment` (row Week/Month có nhãn + khoảng ngày; click row → load panel phải). **Panel phải (Detail):** Payment Details · Sale Details · Supply Fee · Staff Payout (Commission, Tip, Clean up, Discount Charge, Card Charge - Commission/Tip, Salary; toggle Show more/less Pay 1/Pay 2) · Salon Earnings (gồm Discount Charge, Card Charge - Commission/Tip, Tax Collected) + nút Print.

### Dữ liệu mẫu thực tế — đối chiếu công thức (May 29, 2026, ngày lỗ → test dấu âm)

| Khối                                             | Giá trị                                 | Kiểm chứng                             |
| ------------------------------------------------ | --------------------------------------- | -------------------------------------- |
| Net Total / Total Income                         | **−11.22**                              | Subtotal −31.38 − Discount(−20.16) ✓   |
| Bảng Sale/Tip/Tax/Total Payment                  | −11.22 / 28.11 / −10.45 / **6.44**      | −11.22 + 28.11 + (−10.45) = 6.44 ✓     |
| Cash                                             | **−255.45**                             | 75 + (−292) + (−28) + (−10.45) ✓       |
| Card / Others                                    | 106.90 / 29.99                          | (86.90+20) / (18.88+11.11) ✓           |
| Amount Collected / GC Redemption / Total Payment | −118.56 / 125.00 / **6.44**             | −118.56 + 125 = 6.44 ✓                 |
| Total Sale / Total Refund / Subtotal             | 310.62 / 342.00 / −31.38                | ✓                                      |
| Supply Fee (Total/Staff/Salon)                   | −23.00 / −22.40 / −0.60                 | Staff+Salon=Total ✓                    |
| Staff Payout (Comm/Tip/Cleanup/Salary→Total)     | −123.24 / 28.11 / 0 / 0.61 → **−94.52** | ✓                                      |
| Pay 1 / Pay 2                                    | −117.79 / 22.66                         | Pay1+Pay2 = −95.13 = Total − Salary ⚠️ |
| Salon Net Earnings / Total Earnings              | 135.02 / 112.01                         | ✓                                      |

### Bảng test case đầy đủ (72 TC)

| ID  | PROGRAM | FEATURES           | LINK                                | DESCRIPTION                                                                                                            | PRE-CONDITION                                    | TEST STEPS                                     | DATA TEST                                              | EXPECTED RESULT                                                                                     | ACTUAL RESULT | STATUS | NOTE                                                 |
| --- | ------- | ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------- | ------ | ---------------------------------------------------- |
| 1   | POS     | Filter             | Income Summary / Filter             | Filter mặc định Day - Today                                                                                            | Mở Income Summary                                | Quan sát filter mặc định                       | —                                                      | Mặc định **Day + Today**                                                                            |               |        | TC-INC-043 · Positive · P2                           |
| 2   | POS     | Filter             | Income Summary / Filter             | Week/Month chọn năm qua dropdown                                                                                       | Đang ở Week/Month                                | Đổi dropdown năm                               | 2026 → 2025                                            | Data đổi đúng theo năm chọn                                                                         |               |        | TC-INC-099 · Positive · P2                           |
| 3   | POS     | Filter             | Income Summary / Filter             | Day theo date range → mỗi ngày 1 record                                                                                | Có data nhiều ngày                               | 1. Chọn Day<br>2. Chọn range                   | range 21–25/05                                         | 5 record (mỗi ngày 1 dòng)                                                                          |               |        | TC-INC-044 · Positive · P2                           |
| 4   | POS     | Filter             | Income Summary / Filter             | Week (năm hiện tại) → đến tuần hiện tại                                                                                | year 2026                                        | Chọn Week                                      | year 2026                                              | List theo week, đến week hiện tại; mỗi week 1 record                                                |               |        | TC-INC-045 · Positive · P2                           |
| 5   | POS     | Filter             | Income Summary / Filter             | Week năm quá khứ → đủ tất cả week của năm                                                                              | year 2025                                        | Chọn Week + năm 2025                           | year 2025                                              | Hiển thị tất cả week của 2025                                                                       |               |        | TC-INC-046 · Boundary · P2                           |
| 6   | POS     | Filter             | Income Summary / Filter             | Month (năm hiện tại) → đến tháng hiện tại                                                                              | year 2026                                        | Chọn Month                                     | year 2026                                              | List theo tháng, đến tháng hiện tại                                                                 |               |        | TC-INC-047 · Positive · P2                           |
| 7   | POS     | Filter             | Income Summary / Filter             | Month năm quá khứ → đủ 12 tháng                                                                                        | year 2025                                        | Chọn Month + năm 2025                          | year 2025                                              | Đủ 12 tháng                                                                                         |               |        | TC-INC-048 · Boundary · P2                           |
| 8   | POS     | Total Income       | Income Summary / Total Income       | Total Income so sánh kỳ trước tương ứng                                                                                | range bất kỳ                                     | Xem % so sánh của Total Income                 | —                                                      | So với khoảng thời gian liền trước cùng độ dài                                                      |               |        | TC-INC-049 · Positive · P2                           |
| 9   | POS     | Total Income       | Income Summary / Total Income       | Nhãn so sánh đổi theo chế độ kỳ                                                                                        | —                                                | Đổi Day ↔ Week/Month (theo năm)                | —                                                      | Day/Custom = "vs. Previous period"; Week/Month = "vs. Last year"                                    |               |        | TC-INC-101 · Positive · P2                           |
| 10  | POS     | Total Income       | Income Summary / Total Income       | Mũi tên trend đúng màu & hướng                                                                                         | Có kỳ trước để so                                | Xem % compare (kỳ giảm và kỳ tăng)             | −$11.22 (giảm) / $247,776.47 (tăng)                    | Giảm = đỏ ↓ 100.10%; tăng = xanh ↑                                                                  |               |        | TC-INC-102 · Positive · P2 · QC#14                   |
| 11  | POS     | Total Income       | Income Summary / Total Income       | Total Income hiển thị số âm đúng (không ép 0)                                                                          | Ngày lỗ                                          | Xem Total Income                               | May 29 = −$11.22                                       | Hiển thị **−$11.22** đúng dấu                                                                       |               |        | TC-INC-100 · Edge · P1                               |
| 12  | POS     | Total Income       | Income Summary / Total Income       | Gross Income = Sale before refund, không gồm tip/tax/giftcard load                                                     | Có gift card sale                                | Xem Gross Income                               | sale 485.25 + GC 100                                   | Gross = **485.25** (loại GC sale)                                                                   |               |        | TC-INC-050 · Positive · P1 · QC#9 · AC5              |
| 13  | POS     | Total Income       | Income Summary / Total Income       | Net Income = sale sau refund, loại tip/cancel/giftcard sale                                                            | Như ID 12 + refund                               | refund 63.80                                   | Xem Net Income                                         | Net = 485.25 − 63.80 = **421.45**                                                                   |               |        | TC-INC-051 · Positive · P1 · QC#9 · AC5              |
| 14  | POS     | Total Income       | Income Summary / Total Income       | Gross/Net không cộng nhầm Gift Card sale                                                                               | Có GC sale                                       | Kiểm Gross/Net                                 | GC sale 100                                            | Không ra 585.25 / 569.53 (bug cũ)                                                                   |               |        | TC-INC-052 · Negative · P1 · QC#9 · AC5              |
| 15  | POS     | Total Income table | Income Summary / Total Income table | Total Income table thêm cột Tax (bỏ Net Income)                                                                        | Order có Tax                                     | Xem Total Income table                         | —                                                      | Có cột **Tax**; cột Net Income đã bỏ (thay bằng Tax)                                                |               |        | TC-INC-040 · Positive · P1 · QC#30 · AC5             |
| 16  | POS     | Total Income table | Income Summary / Total Income table | Table không duplicate Net Income vs Sale                                                                               | —                                                | Xem table                                      | —                                                      | Không có cột Net Income trùng nội dung Sale                                                         |               |        | TC-INC-041 · Negative · P2 · AC5                     |
| 17  | POS     | Total Income table | Income Summary / Total Income table | Total Payment table = Sale + Tip + Tax                                                                                 | 1 ngày                                           | Xem cột Total Payment                          | May 29: Sale −11.22, Tip 28.11, Tax −10.45             | = **6.44**                                                                                          |               |        | TC-INC-042 · Positive · P1                           |
| 18  | POS     | Total Income table | Income Summary / Total Income table | Row Week/Month hiển thị nhãn + khoảng ngày                                                                             | Week/Month mode                                  | Xem từng row trong bảng                        | Week 18                                                | Hiển thị "Week 18 (04/27/2026 - 05/03/2026)"                                                        |               |        | TC-INC-103 · Positive · P2                           |
| 19  | POS     | Total Income table | Income Summary / Total Income table | Click 1 row → panel phải load đúng kỳ                                                                                  | Có nhiều row                                     | Click row Week 23                              | Week 23 (06/01–06/03)                                  | Header panel phải = "Jun 01, 2026 - Jun 03, 2026"; data đúng tuần đó                                |               |        | TC-INC-104 · Positive · P1                           |
| 20  | POS     | Payment Details    | Income Summary / Payment Details    | Card = Sale − Refund + Tip + Tax (theo Card)                                                                           | 1 ngày                                           | Xem Payment Details > Card                     | Sale 86.90, Refund 0, Tip 20, Tax 0                    | Card = **106.90**; sub-rows Sale/Refund/Tip/Tax đúng                                                |               |        | TC-INC-060 · Positive · P1                           |
| 21  | POS     | Payment Details    | Income Summary / Payment Details    | Cash = Sale − Refund + Tip + Tax, cho phép âm                                                                          | Ngày lỗ                                          | Xem Cash                                       | Sale 75, Refund −292, Tip −28, Tax −10.45              | Cash = **−255.45**                                                                                  |               |        | TC-INC-061 · Negative · P1                           |
| 22  | POS     | Payment Details    | Income Summary / Payment Details    | Others = Sale − Refund + Tip + Tax (theo Others)                                                                       | 1 ngày                                           | Xem Others                                     | Sale 18.88, Tip 11.11                                  | Others = **29.99**                                                                                  |               |        | TC-INC-062 · Positive · P1                           |
| 23  | POS     | Payment Details    | Income Summary / Payment Details    | Amount Collected = Card + Cash + Others                                                                                | 1 ngày                                           | Xem Amount Collected                           | −255.45 + 106.90 + 29.99                               | = **−118.56**                                                                                       |               |        | TC-INC-063 · Positive · P2                           |
| 24  | POS     | Payment Details    | Income Summary / Payment Details    | Gift Card Redemption gồm Sale/Tip/Tax theo GC                                                                          | Redeem GC                                        | Xem GC Redemption                              | Sale 100, Tip 25, Tax 0                                | = **125.00**; sub-rows đúng                                                                         |               |        | TC-INC-064 · Positive · P2                           |
| 25  | POS     | Payment Details    | Income Summary / Payment Details    | TOTAL PAYMENT = Amount Collected + Gift Card Redemption                                                                | 1 ngày                                           | Xem TOTAL PAYMENT                              | −118.56 + 125.00                                       | = **6.44**                                                                                          |               |        | TC-INC-065 · Positive · P1                           |
| 26  | POS     | Payment Details    | Income Summary / Payment Details    | Sub-row Sale/Refund/Tip/Tax cho phép âm, đúng dấu                                                                      | Ngày lỗ                                          | Xem Cash sub-rows                              | Refund −292, Tip −28, Tax −10.45                       | Hiển thị đủ dấu trừ, không làm tròn về 0                                                            |               |        | TC-INC-105 · Edge · P1                               |
| 27  | POS     | Payment Details    | Income Summary / Payment Details    | Header cột thứ 5 = "Total Payment"                                                                                     | —                                                | Xem header cột                                 | —                                                      | Hiển thị "Total Payment" (không phải "Amount Collected")                                            |               |        | TC-INC-066 · UI · P3 · QC#8                          |
| 28  | POS     | Sale Details       | Income Summary / Sale Details       | Total Sale = GC Sale + Service Sale + Product Sale                                                                     | 1 ngày                                           | Xem Sale Details                               | Service 260.62, Product 50, GC 0                       | Total Sale = **310.62**                                                                             |               |        | TC-INC-070 · Positive · P2                           |
| 29  | POS     | Sale Details       | Income Summary / Sale Details       | Total Refund = Service Refund + Product Refund                                                                         | Có refund                                        | Xem Sale Details                               | Service 200, Product 142                               | Total Refund = **342.00**                                                                           |               |        | TC-INC-071 · Positive · P2                           |
| 30  | POS     | Sale Details       | Income Summary / Sale Details       | Subtotal = Total Sale − Total Refund (cho phép âm)                                                                     | 1 ngày                                           | Xem Subtotal                                   | 310.62 − 342.00                                        | = **−31.38**                                                                                        |               |        | TC-INC-072 · Positive · P2                           |
| 31  | POS     | Sale Details       | Income Summary / Sale Details       | Total Discount = Discount − Discount Reversed                                                                          | Có refund hoàn discount                          | Xem Total Discount                             | Discount 29.84, Reversed 50.00                         | = **−20.16**                                                                                        |               |        | TC-INC-073 · Positive · P2                           |
| 32  | POS     | Sale Details       | Income Summary / Sale Details       | Net Total = Subtotal − Total Discount                                                                                  | 1 ngày                                           | Xem Net Total                                  | −31.38 − (−20.16)                                      | = **−11.22**                                                                                        |               |        | TC-INC-074 · Positive · P1                           |
| 33  | POS     | Sale Details       | Income Summary / Sale Details       | Tax Collected = Σ tax mọi phương thức (cho phép âm)                                                                    | 1 ngày                                           | Xem Tax Collected                              | tax tổng các phương thức                               | = **−10.45**                                                                                        |               |        | TC-INC-075 · Positive · P1                           |
| 34  | POS     | Sale Details       | Income Summary / Sale Details       | TOTAL PAYMENT = Net Total + Tax + Tip                                                                                  | 1 ngày                                           | Xem TOTAL PAYMENT                              | −11.22 + (−10.45) + 28.11                              | = **6.44**                                                                                          |               |        | TC-INC-076 · Positive · P1                           |
| 35  | POS     | Supply Fee         | Income Summary / Supply Fee         | Supply Fee tính trừ refund (không cộng)                                                                                | Service có supply fee + refund                   | Xem Total Supply Fee                           | 8.80 − 2.33 − 2.33                                     | = **4.14** (không phải 13.46)                                                                       |               |        | TC-INC-080 · Regression · P1 · QC#17                 |
| 36  | POS     | Supply Fee         | Income Summary / Supply Fee         | Staff Supply Share theo % Commission Setting                                                                           | setting 60/40                                    | Xem Staff Supply Share                         | Total −23.00 → Staff −22.40                            | Staff Supply Share + Salon Supply Share = Total Supply Fee                                          |               |        | TC-INC-081 · Positive · P2                           |
| 37  | POS     | Supply Fee         | Income Summary / Supply Fee         | Salon Supply Share = Total − Staff Supply Share                                                                        | 1 ngày                                           | Xem Salon Supply Share                         | −23.00 − (−22.40)                                      | = **−0.60**                                                                                         |               |        | TC-INC-082 · Positive · P2                           |
| 38  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Commission (60%) = (Total Service × 60%) − Staff Supply Share; đúng % rate                                       | Setting service rate                             | Xem Staff Commission                           | service rate (không nhầm 6% card fee / 80%)            | = (Service Sale − Service Refund)×60% − Staff Supply Share; đúng % Commission Setting - For Service |               |        | TC-INC-083 · Regression · P1 · QC#18,#26,#30         |
| 39  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff chỉ Salary → Commission = 0                                                                                      | Staff salary-only                                | Xem Commission                                 | —                                                      | Commission = 0                                                                                      |               |        | TC-INC-084 · Edge · P2                               |
| 40  | POS     | Staff Payout       | Income Summary / Staff Payout       | Clean up fee = Deduction/day × số ngày làm                                                                             | deduction 20/day, 1 ngày                         | Xem Clean up fee                               | deduction 20/day × 1 ngày                              | = **20.00** (không phải 3.15)                                                                       |               |        | TC-INC-085 · Regression · P1 · QC#19                 |
| 41  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Salary — Salary by Period chia theo ngày                                                                         | Pay Period 1 week $7000, xem 3 ngày              | Xem Staff Salary                               | rate 1000/ngày × 3                                     | = **3000**                                                                                          |               |        | TC-INC-086 · Boundary · P1                           |
| 42  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Salary — Wage Per Hour                                                                                           | Staff lương theo giờ                             | Xem Staff Salary                               | lương/giờ × số giờ                                     | = lương/giờ × số giờ                                                                                |               |        | TC-INC-087 · Positive · P2                           |
| 43  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Salary — Wage Per Day                                                                                            | Staff lương theo ngày                            | Xem Staff Salary                               | lương/ngày × số ngày                                   | = lương/ngày × số ngày                                                                              |               |        | TC-INC-088 · Positive · P2                           |
| 44  | POS     | Staff Payout       | Income Summary / Staff Payout       | TOTAL STAFF PAYOUT = Commission + Tip + Salary − Supply Fee − Clean up − Discount Charge − Card Charge (Comm+Tip)      | 1 ngày                                           | Xem Total Staff Payout                         | May 29 (charge fields = 0): −123.24 + 28.11 + 0.61 − 0 | = **−94.52** khi Supply/Discount/Card Charge = 0 (không cộng nhầm clean up) ⚠️ xem note Supply Fee  |               |        | TC-INC-089 · Regression · P1 · QC#12 · ⚠️            |
| 45  | POS     | Staff Payout       | Income Summary / Staff Payout       | Pay 1 = [Salary + (Commission − Supply Fee)]×Pay1% − Clean up − Discount Charge − Card Charge (Comm+Tip), text % động  | Có split setting                                 | Xem Pay 1                                      | Commission −123.24, split theo setting                 | Giá trị đúng công thức mở rộng; text hiển thị đúng % theo setting                                   |               |        | TC-INC-090 · Regression · P1 · QC#12,#21,#22         |
| 46  | POS     | Staff Payout       | Income Summary / Staff Payout       | Pay 2 = (Salary + Commission)×Pay2% + Tip, không hardcode 70%                                                          | Có split setting                                 | Xem Pay 2                                      | Tip 28.11                                              | Giá trị đúng; text % theo setting (không hardcode 70%)                                              |               |        | TC-INC-091 · Regression · P1 · QC#12,#21,#22         |
| 47  | POS     | Staff Payout       | Income Summary / Staff Payout       | Pay 1 + Pay 2 + Staff Salary = Total Staff Payout                                                                      | Có Salary ≠ 0                                    | Cộng Pay1 + Pay2 + Salary                      | −117.79 + 22.66 + 0.61                                 | = **−94.52** (khớp Total)                                                                           |               |        | TC-INC-092 · Negative · P1 · ⚠️ xác nhận cộng Salary |
| 48  | POS     | Staff Payout       | Income Summary / Staff Payout       | Toggle Show more / Show less Pay 1 & Pay 2                                                                             | Panel Staff Payout                               | Click Show more rồi Show less                  | —                                                      | Show more hiện Pay 1/Pay 2; Show less ẩn                                                            |               |        | TC-INC-106 · UI · P3                                 |
| 49  | POS     | Staff Payout       | Income Summary / Staff Payout       | Kỳ lương CHƯA chốt → lấy số lớn hơn (estimate)                                                                         | Staff Commission+Salary, kỳ chưa chốt            | Xem report                                     | —                                                      | Hiển thị max(Commission, Salary)                                                                    |               |        | TC-INC-096 · Edge · P2 · ⚠️ cần làm rõ               |
| 50  | POS     | Staff Payout       | Income Summary / Staff Payout       | Kỳ lương ĐÃ chốt → lấy con số đã chốt                                                                                  | Kỳ đã chốt                                       | Xem report                                     | —                                                      | Hiển thị con số được chọn để tính lương                                                             |               |        | TC-INC-097 · Edge · P2 · ⚠️ cần làm rõ               |
| 51  | POS     | Staff Payout       | Income Summary / Staff Payout       | Custom Pay Period 4 mốc → Pay1/Pay2 tách 4 kỳ                                                                          | Pay Period custom 4 ngày                         | Xem subtext Pay1/Pay2                          | 25, 26, 27, 30                                         | Tách thành 4 dòng kỳ tương ứng (không gộp 1)                                                        |               |        | TC-INC-098 · Regression · P2 · QC#29                 |
| 52  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Salon Commission(40%) = TotalService×40% − Salon Supply Share                                                          | setting 60/40                                    | Xem Salon Commission                           | Total Service 60.62                                    | Dùng đúng % Owner rate                                                                              |               |        | TC-INC-093 · Positive · P2                           |
| 53  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Net Earnings = Salon Commission + Product Sale − Product Refund − Total Discount                                       | 1 ngày                                           | Xem Net Earnings                               | 206.86 + 50 − 142 − (−20.16)                           | = **135.02**                                                                                        |               |        | TC-INC-094 · Positive · P2                           |
| 54  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Total Earning = Net Earnings + Staff Supply Share + Clean up + Discount Charge − Staff Salary + Card Charge (Comm+Tip) | 1 ngày                                           | Xem Total Earnings                             | 135.02 + (−22.40) + 0 + 0 − 0.61 + 0                   | = **112.01** khi charge fields = 0; hiển thị âm khi ra âm (không ép 0)                              |               |        | TC-INC-095 · Regression · P1 · QC#13                 |
| 55  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Salon Total Earnings & Staff Total Payout tính độc lập                                                                 | Ngày lỗ cho staff                                | So 2 khối                                      | Staff −94.52; Salon 112.01                             | Mỗi bên đúng công thức riêng, không ép bằng nhau                                                    |               |        | TC-INC-107 · Edge · P2                               |
| 56  | POS     | Đối chiếu          | Income Summary (đối chiếu)          | Total Payment khớp 3 nơi (table = Payment = Sale Details)                                                              | 1 ngày                                           | So Total Payment ở 3 chỗ                       | May 29                                                 | Cả 3 = **6.44**                                                                                     |               |        | TC-INC-108 · Negative · P1                           |
| 57  | POS     | Đối chiếu          | Income Summary (đối chiếu)          | Net Total ↔ Sale ↔ Total Income khớp                                                                                   | 1 ngày                                           | So 3 chỗ                                       | May 29                                                 | Cả 3 = **−11.22**                                                                                   |               |        | TC-INC-109 · Negative · P1                           |
| 58  | POS     | Đối chiếu          | Income Summary (đối chiếu)          | Tax khớp 3 nơi (table = Tax Collected = Σ Tax Payment)                                                                 | 1 ngày                                           | So 3 chỗ                                       | May 29                                                 | Khớp **−10.45**                                                                                     |               |        | TC-INC-110 · Negative · P1                           |
| 59  | POS     | Cross-report       | DSR ↔ Income Summary                | Daily Sale Report ↔ Income Summary cùng ngày khớp số                                                                   | Data 1 ngày                                      | So Sale/Tax/Refund/Total Payment giữa 2 report | 21/05                                                  | Mọi con số khớp                                                                                     |               |        | TC-XR-090 · Positive · P1 · AC6                      |
| 60  | POS     | Cross-report       | DSR ↔ Income Summary                | Income Summary Total Refund khớp Daily Sale                                                                            | 2 refund                                         | refund −52.80, −11.00                          | So Total Refund 2 report                               | = **63.80** (không phải 83.80); Net Income = −63.80                                                 |               |        | TC-XR-091 · Negative · P1 · QC#10 · AC6              |
| 61  | POS     | Cross-report       | DSR ↔ Income Summary                | Print receipt ↔ UI khớp toàn bộ con số                                                                                 | Có data                                          | Click Print & đối chiếu với UI                 | —                                                      | Khớp toàn bộ Payment/Sale/Staff/Salon                                                               |               |        | TC-XR-093 · Regression · P2 · QC#7,#32               |
| 62  | POS     | Edge               | Income Summary / Edge               | Ngày chỉ bán Gift Card (không service/product)                                                                         | Chỉ GC sale                                      | Xem Gross/Net Income                           | GC 100                                                 | Gross = 0, Net = 0 (loại GC sale); Total Sale vẫn gồm GC                                            |               |        | TC-EDGE-112 · Edge · P1                              |
| 63  | POS     | Edge               | Income Summary / Edge               | Week/Month chưa phát sinh giao dịch hiển thị $0.00                                                                     | year 2026, tuần đầu năm                          | Xem Week 1–6                                   | Week 1 (01/01–01/04)                                   | Tất cả cột = $0.00, không trống/lỗi                                                                 |               |        | TC-EDGE-116 · Edge · P2                              |
| 64  | POS     | Edge               | Income Summary / Edge               | Custom Pay Period: Save khi chưa chọn ngày bị chặn                                                                     | Tạo custom period                                | Save mà không chọn ngày                        | —                                                      | Không cho Save (liên quan VP-1444)                                                                  |               |        | TC-EDGE-114 · Negative · P3                          |
| 65  | POS     | Edge               | Income Summary / Edge               | Làm tròn tiền tệ nhất quán 2 chữ số                                                                                    | Có số lẻ                                         | So tổng vs từng dòng                           | 0.005                                                  | Không lệch do rounding                                                                              |               |        | TC-EDGE-115 · Edge · P2 · ⚠️ cần làm rõ              |
| 66  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Discount Charge = tổng promotion staff chia với chủ tiệm                                                         | Order có promotion staff share                   | Xem Staff Discount Charge                      | promotion staff share                                  | Hiển thị đúng tổng promotion staff chia; được trừ trong Total Staff Payout & Pay 1                  |               |        | TC-INC-111 · Positive · P2                           |
| 67  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Card Charge - Commission theo setting On Staff Commission                                                        | Setting Staff Compensation - On Staff Commission | Xem Staff Card Charge - Commission             | % phí thẻ trên Commission                              | = chiết khấu phí thẻ trên Commission đúng setting; trừ trong Total & Pay 1                          |               |        | TC-INC-112 · Positive · P2                           |
| 68  | POS     | Staff Payout       | Income Summary / Staff Payout       | Staff Card Charge - Tip theo setting On Credit Card Tip                                                                | Setting Staff Compensation - On Credit Card Tip  | Xem Staff Card Charge - Tip                    | % phí thẻ trên Tip                                     | = chiết khấu phí thẻ trên Tip đúng setting; trừ trong Total & Pay 1                                 |               |        | TC-INC-113 · Positive · P2                           |
| 69  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Staff Discount Charge (Salon) = tổng promotion staff chia với chủ tiệm                                                 | Order có promotion staff share                   | Xem Staff Discount Charge (Salon)              | promotion staff share                                  | Hiển thị đúng; được CỘNG vào Total Earning (chủ tiệm thu lại)                                       |               |        | TC-INC-114 · Positive · P2                           |
| 70  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Staff Card Charge - Commission (Salon) cộng vào Total Earning                                                          | Setting On Staff Commission                      | Xem Staff Card Charge - Commission (Salon)     | % phí thẻ trên Commission                              | = đúng setting; CỘNG vào Total Earning                                                              |               |        | TC-INC-115 · Positive · P2                           |
| 71  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Staff Card Charge - Tip (Salon) cộng vào Total Earning                                                                 | Setting On Credit Card Tip                       | Xem Staff Card Charge - Tip (Salon)            | % phí thẻ trên Tip                                     | = đúng setting; CỘNG vào Total Earning                                                              |               |        | TC-INC-116 · Positive · P2                           |
| 72  | POS     | Salon Earnings     | Income Summary / Salon Earnings     | Tax Collected (Salon) = Σ tax mọi phương thức                                                                          | 1 ngày                                           | Xem Tax Collected (Salon Earnings)             | tax tổng các phương thức                               | Khớp Tax Collected của Sale Details (−10.45 ở May 29)                                               |               |        | TC-INC-117 · Positive · P2                           |

### Coverage map (VP-1048)

| Acceptance Criteria / Mục                                                  | Test case (ID)                 |
| -------------------------------------------------------------------------- | ------------------------------ |
| AC5 — Income Summary gồm Tax ở mọi field (table, gross/net, payment, sale) | 12, 13, 14, 15, 16, 17, 33, 58 |
| AC6 — Không lệch số liệu giữa các report                                   | 56, 57, 58, 59, 60             |
| Filter (Day/Week/Month, năm, default)                                      | 1–7                            |
| Total Income (compare, label, trend, âm, gross/net)                        | 8–14                           |
| Total Income table (Tax, row label, click→detail)                          | 15–19                          |
| Payment Details (gồm Tax, giá trị âm, header)                              | 20–27                          |
| Sale Details (gồm Tax, net total âm)                                       | 28–34                          |
| Supply Fee                                                                 | 35–37                          |
| Staff Payout (commission/clean up/salary/pay split/charge fields)          | 38–51, 66–68                   |
| Salon Earnings (commission/net/charge fields/tax)                          | 52–55, 69–72                   |
| Edge / Boundary                                                            | 62–65                          |

### ⚠️ Điểm cần làm rõ với BA/QC (VP-1048)

1. **Pay 1 + Pay 2 vs Total Staff Payout (ID 47):** May 29 cho `Pay1(−117.79) + Pay2(22.66) = −95.13`, còn `Total = −94.52` → lệch đúng `Staff Salary $0.61`. **Cập nhật (data Jun 15 trên build mới):** `Pay1(122.88) + Pay2(1185.74) = 1308.62 = Total` đúng khít, Salary (50.68) **đã nằm trong** Pay split, KHÔNG cộng ngoài. Automation hiện assert `Total = Pay1 + Pay2` (TC-44/47). Cần BA xác nhận đây là hành vi chuẩn (chênh ở May 29 nghi là build cũ).
2. **Salon Commission base (ID 52):** May 29 cho Salon Commission `$206.86` không khớp `TotalService 60.62 × 40%`. Cần xác nhận base & cách tổng hợp khi refund lớn.
3. **"100% vs Last year":** nghi data 2025 = 0 → hiển thị 100% có hợp lý không, hay nên `—`/`N/A`.
4. **Phân quyền / Timezone "Today" / Định nghĩa "Others" / "kỳ lương đã chốt" / giới hạn date range** — chưa nêu trong spec.
5. **Supply Fee trừ trùng trong Total Staff Payout (ID 44, 45):** spec mới `Staff Commission (60%) = TotalService×60% − Staff Supply Share` (đã trừ supply share) NHƯNG `Total Staff Payout` lại tiếp tục `− Supply Fee`, và Pay 1 cũng `(Commission − Supply Fee)` → khả năng trừ Staff Supply Share 2 lần. May 29 (−94.52) được validate theo công thức cũ (không có term −Supply Fee). Cần BA xác nhận `Supply Fee` trong Total/Pay1 có phải cùng `Staff Supply Share` đã trừ trong Commission hay không.
   - **🔴 BUG XÁC NHẬN (re-derive Cách 2 từ DB):** Re-derive từ raw (`report-tool.cjs` → `report.rs`, dùng `%service` lịch sử đóng băng trong `report_staff_daily_income.compensation`) cho thấy **bảng store `report_store_daily_income` tính Commission / Pay1 / Pay2 / Total / Salon bằng `%service` KHÔNG khớp settings của ngày** → các số này trong Income Summary của app bị **SAI**. Vd 15/06: Staff Commission đúng = **$1,349.95** (re-derive) vs app **$1,116.89**. Các field SALE/Payment/Supply total/Tip/Tax/Clean-up/Total Service **vẫn khớp tuyệt đối**. Đã có test re-derive: [TC-RD-staff-salon-rederive.spec.ts](../../tests/regression/incomes/income-summary/TC-RD-staff-salon-rederive.spec.ts).
6. **Charge fields mới (ID 66–72):** `Staff Discount Charge`, `Staff Card Charge - Commission`, `Staff Card Charge - Tip` (cả Staff Payout & Salon Earnings) + dấu (Staff trừ / Salon cộng). Cần dataset có setting `Staff Compensation` + promotion staff-share ≠ 0 để verify số thực; hiện chỉ check công thức/định nghĩa. **Quan sát data Jun 15:** Staff Total thấp hơn công thức cũ ~$217 và Salon Total cao hơn ~$217 (gần bằng nhau) → đúng hành vi "staff trừ / salon cộng lại" của term charge ẩn, nhưng panel hiện KHÔNG render dòng charge nào nên không tái tạo được tổng đầy đủ.
7. **Refund sign trong Payment Details (ID 21, 26):** settled list API (`reportStoreDailyIncomeList`) trả refund là **magnitude dương** trong khi UI hiển thị **âm**. Automation đã chuyển sang so khớp `|refund|` và công thức `<method> = Sale − |Refund| + Tip + Tax`. Cần xác nhận đây là convention chuẩn của list API (live API trả âm).

> Tổng: **72 test case** · P1 trọng yếu: ID 11, 12, 13, 17, 19, 25, 32, 34, 44, 54, 56, 57, 58, 60.

### Hiện trạng tự động hoá (Playwright) — VP-1048

> Income Summary route: `/incomes/income-summary?from=<unix>&to=<unix>&groupBy=day|week|month[&detailId=<from>-<to>]`. Gated bằng passcode.
> GraphQL: `getIncomeSummaryLive(reportDate: RFC3339)` cho hôm nay; `getIncomeSummary(from,to: YYYY-MM-DD)` → `reportStoreDailyIncomeList` cho khoảng đã chốt.

- **Tier 1 (real DB, read-only / structural):** filter mặc định, Day/Week/Month, year dropdown, nhãn so sánh, bảng có cột Tax (bỏ Net Income), click row → detail header, 5 nhóm detail render, Print, đối chiếu Total Payment giữa table/Payment/Sale Details, hiển thị số âm. → `tests/regression/incomes/income-summary/income-summary-*.spec.ts`.
- **Tier 3 (mocked dataset May 29 loss day):** các công thức Payment/Sale/Supply Fee/Staff Payout/Salon Earnings với số chính xác. → cần mock `getIncomeSummaryLive` + query detail panel (đang bổ sung).
- **Staff Payout từ Staff Income (settled):** `TC38.40.41.44-staff-payout-from-staff-income.spec.ts` — dựng Staff Payout từ `reportStaffDailyIncomeList` (GraphQL settled); khớp Tip/CleanUp/Salary/TotalService.
- **Re-derive Cách 2 từ DB (local-only):** `TC-RD-staff-salon-rederive.spec.ts` + `src/db/VoltPosDb.ts` + `src/reports/IncomeSummaryRederive.ts`. Đọc thẳng SQLite `%APPDATA%/VoltPOS`, port `report.rs`, dựng lại Staff Payout + Salon Earnings theo `%service` lịch sử. Tự skip khi không có DB (CI). Assert nhất quán nội bộ + field khớp app; **report divergence** (Commission/Pay/Total) = bug app ở mục ⚠️#5.
- **Charge fields mới (TC 66–72):** `TC66.67.68.69.70.71.72-charge-fields.spec.ts`. TC-72 (Salon `Tax Collected` = Sale Details tax) chạy thật khi build render dòng đó; TC-66…71 verify dòng charge khi UI render (tolerant skip nếu dataset không có setting). Phần value-exact + total mở rộng để `fixme` chờ fixture `Staff Compensation` + xác nhận ⚠️#5 (Supply Fee trừ trùng) + bổ sung field vào GraphQL model.

## Nguồn tham chiếu

- Spec/glossary: `docs/i18n/income-summary-translation-map.md` (nếu có, giữ riêng).
- Luồng code-gen (tách riêng): [codegen-flow/income-summary-flow.md](../income-summary/income-summary-code-detail.md) · [codegen-detail/income-summary-detail.md](../income-summary/income-summary-code-detail.md).
- Test/helper + dữ liệu thô JSON: [reports/income-summary/compare.json](../../reports/income-summary/compare.json).
- Report i18n trực quan: [reports/income-summary/compare.html](../../reports/income-summary/compare.html).
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['income-summary']`, `gated:true`).
- Spec Linear (offline): [docs/linear/income-report.md](../linear/income-report.md) — mục **Income Summary**; Linear document gốc: https://linear.app/fastboy/document/income-report-cd80210c48f3.
- Ảnh quét: [income-summary-assets/income-summary-detail.png](income-summary-assets/income-summary-detail.png).

---

## Income Reports Family — relationship between Daily Sale Report / Income Summary / Staff Income

(folded in from docs/test-cases/income-reports/README.md — cross-report index for the 3 income screens)

# Income Reports — Test Cases (tổng hợp)

Bộ test case **tổng hợp 3 màn báo cáo doanh thu** của Volt POS. Cả ba dùng chung
nguồn dữ liệu GraphQL (`reportStoreDailyIncomeList` / `storeDailyIncomeLive`) nên
được gom về một chỗ để dễ đối chiếu chéo.

| #   | Tính năng                  | Route                     | Test case                                                                            | Số TC |
| --- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------ | ----- |
| 1   | **Daily Sale Report**      | `/incomes/income-daily`   | [VP-1048-daily-sale-report-test-cases.md](./VP-1048-daily-sale-report-test-cases.md) | 44    |
| 2   | **Income Summary**         | `/incomes/income-summary` | [VP-1048-income-summary.md](./VP-1048-income-summary.md)                             | 73    |
| 3   | **Staff Income & Payroll** | `/incomes/income-staff`   | [VP-1402-staff-income.md](./VP-1402-staff-income.md)                                 | 80    |

> Tổng: **~197 test case** cho cụm Income.

## Quan hệ giữa 3 báo cáo

```
                ┌─────────────────────── Income Summary ───────────────────────┐
                │  Payment Details · Sale Details · Supply Fee ·                │
                │  Staff Payout ───────────────┐   Salon Earnings              │
                └──────────────────────────────┼───────────────────────────────┘
                          ▲                     │ (per-staff payout)
                          │ (cùng ngày, cùng số) ▼
   Daily Sale Report ─────┘            Staff Income & Payroll
   (1 ngày: Income/Payment Detail)     (per-staff: Commission/Salary, chốt lương)
```

- **Daily Sale Report** — chi tiết **một ngày** (Income Detail + Payment Detail + bảng order). Là "lát cắt 1 ngày" của cùng dữ liệu Income Summary dùng.
- **Income Summary** — tổng hợp **theo khoảng thời gian** (Day/Week/Month) + panel chi tiết 5 khối; khối **Staff Payout** là phần per-staff cộng dồn.
- **Staff Income & Payroll** — bóc tách **theo từng nhân viên** (dự trù) và **chốt lương** (Payroll). Khối Staff Payout trong Income Summary = tổng của các staff ở đây.

## Đối chiếu chéo (cross-report invariants)

- Cùng một ngày: **Sale / Tax / Refund / Total Payment** phải khớp giữa Daily Sale Report và Income Summary (DSR ↔ IS).
- Income Summary **Staff Payout total** = Σ payout của các nhân viên trong Staff Income (cùng kỳ, settled).
- Tiền lưu **integer cents** ở mọi nơi; cho phép **số âm** (ngày lỗ / refund lớn).

## Liên kết nhanh

- **API reference (GraphQL):** [(folded into this file's API Reference section)]((folded into this file's API Reference section)) — query/field của Daily Sale Report & Income Summary.
- **Test tự động (Playwright):**
  - Daily Sale Report: `tests/regression/incomes/daily-sale-report/` + `tests/api/daily-sale-report.api.spec.ts`
  - Income Summary: `tests/regression/incomes/income-summary/` + `tests/api/income-summary.api.spec.ts`
- **Quy ước & workflow viết test case:** [../README.md](../README.md)

## Lưu ý chung khi viết/chạy test

- **Timezone merchant** (Asia/Ho_Chi_Minh, UTC+7): ngày được gom theo giờ merchant, không theo giờ máy chạy.
- **Live vs Settled:** hôm nay đọc bản _live_ (chưa chốt, tax gộp vào Sale, chưa tách per-order); ngày quá khứ đọc bản _settled_ (đầy đủ, bất biến) → các test công thức nên dùng ngày settled.
- Nhãn so sánh "% vs …" phụ thuộc **preset** đang chọn (xem VP-1048-income-summary).
