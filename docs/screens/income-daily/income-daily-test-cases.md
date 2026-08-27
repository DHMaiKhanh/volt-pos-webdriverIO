---
title: Thu nhập theo ngày (/incomes/income-daily) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /incomes/income-daily
scanned-at: 2026-07-06
consolidates: feature-spec + test cases + i18n (coverage + meaning)
excludes: docs/codegen-flow/income-daily-flow.md · docs/codegen-detail/income-daily-detail.md (giữ riêng)
---

# Thu nhập theo ngày (`/incomes/income-daily`) — Tài liệu hợp nhất

> MỘT file duy nhất: gộp đặc tả tính năng + test case + kết quả quét Tiếng Việt (còn tiếng Anh + dịch đúng chuẩn). Kết quả trực quan: reports/income-daily/income-daily.html. Luồng code-gen giữ riêng: codegen-flow/income-daily-flow.md · codegen-detail/income-daily-detail.md.

# PHẦN A — Đặc tả tính năng

## A1. Mục tiêu & phạm vi

Màn `/incomes/income-daily` là **Daily Sale Report** — báo cáo doanh thu **của MỘT ngày** cho owner/tenant:

- Xem nhanh 4 chỉ số tổng của ngày (**Total Order, Sale, Total Tip, Total Payment**) kèm so sánh với **hôm qua**.
- Biểu đồ theo giờ/khung của ngày, có thể chuyển chỉ số hiển thị (Sale / Order / Tip / Payment).
- Danh sách order chi tiết trong ngày + panel **Income Details** và **Payment Details** để đối soát.
- **In** báo cáo ngày (nút Print).

Màn được bảo vệ bằng **passcode dialog** (owner passcode) khi truy cập lần đầu — cùng cơ chế với các màn Income khác.

## A2. Các luồng chính (từ Linear)

Trích mục **Daily Sale Report** trong spec:

- **Daily Sale Report Chart** — 4 chỉ số:
  - **Orders** — _Total number of order, refunds, and manual refunds_ (UI hiển thị "Total Order" với mô tả "excluding cancel/refunds/manual refunds").
  - **Sale** = tổng sale/refund/partial refund, **không** tính Tip, Tax, **không** tính order Cancel (Card/Cash/Other/GiftCard).
  - **Total Tips** = tổng Tip (không tính order Cancel).
  - **Total Payment** — final revenue, **bao gồm** Gift Card Redemption.
- **Daily Sale Report detail — List Order Detail** (mỗi order): `Order #` (orderCode); `Sale` (service sale/refund sau Discount); `Tax`; `Tip`; `Total = Sale + Tip + Tax`.
  - Order Refund/Partial Refund: Sale/Refund là **số âm**; `Total = Sale − Discount + Tip` (âm).
- **INCOME DETAIL:** `Sale` (tổng Sale/Refund sau Discount); `Tip`; `Tax Collected` (tổng Tax); **`Total Payment = Sale + Tip + Tax Collected`**.
- **PAYMENT DETAIL:** `Card = Sale Card − Refund Card`; `Cash = Sale Cash − Refund Cash`; `Others = Sale Others − Refund Others`;
  **`Amount Collected = Card + Cash + Others`**; `Gift Card Redemption`; **`TOTAL PAYMENT = Amount Collected + Gift Card Redemption`**.

## A3. Thành phần UI thực tế (quét bằng Playwright MCP, 2026-07-06)

Ảnh: [income-daily-assets/income-daily-empty.png](income-daily-assets/income-daily-empty.png) (trạng thái ngày chưa có data — 07/06/2026)

| Thành phần                      | Vai trò                                                                        | Trạng thái                  | Ghi chú                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------ |
| Tiêu đề **Daily Sale Report**   | Nhãn màn hình                                                                  | Hoạt động                   | Góc trên bảng chart                                                                        |
| Nút **Today**                   | Reset filter về hôm nay                                                        | Hoạt động                   | URL nhận `from`/`to` = midnight → end-of-day                                               |
| Nút **calendar `07/06/2026`**   | Date-picker chọn 1 ngày                                                        | Hoạt động                   | Accessible name = `MM/DD/YYYY`                                                             |
| Card **Total Order**            | Chỉ số + %vs Yesterday                                                         | Hoạt động                   | Mô tả: _Total number of order, excluding cancel/refunds/ manual refunds_                   |
| Card **Sale**                   | Chỉ số tiền + %vs Yesterday                                                    | Hoạt động (click đổi chart) | `$0.00` khi trống; mô tả khớp spec                                                         |
| Card **Total tip**              | Chỉ số tip + %vs Yesterday                                                     | Hoạt động                   | Mô tả: _…not included in sales revenue but counted in collected amounts_                   |
| Card **Total Payment**          | Chỉ số payment + %vs Yesterday                                                 | Hoạt động                   | Mô tả: _The final revenue includes Gift Card Redemption_                                   |
| **Chart "Sale"**                | Biểu đồ theo chỉ số đang chọn                                                  | Hoạt động                   | URL `activeChart=sale`; trống → "No chart data available / Try selecting a different date" |
| Heading ngày **"Jul 06, 2026"** | Tiêu đề panel chi tiết                                                         | Hoạt động                   | Bên phải                                                                                   |
| Nút **Print**                   | In báo cáo ngày                                                                | Hoạt động (enabled)         | Kể cả khi không có data                                                                    |
| Bảng **order detail**           | Danh sách order trong ngày                                                     | Hoạt động                   | Trống → "No data available"; Order # dạng `OD\d{6}-\d+`                                    |
| Panel **Income Details**        | Sale / Tip / Tax Collected / Total Payment                                     | Hoạt động                   | Tax Collected có mô tả _(Sales tax collected, adjusted for refunds)_                       |
| Panel **Payment Details**       | Card / Cash / Others / Amount Collected / Gift Card Redemption / Total Payment | Hoạt động                   | 6 dòng, khớp spec PAYMENT DETAIL                                                           |
| Banner **connection**           | "Internet connection restored."                                                | Hoạt động                   | Liên quan Offline Mode                                                                     |

**Chi tiết chỉ số card** (khớp spec Linear):

| Card          | Giá trị trống | %-so-sánh | Nhãn so sánh |
| ------------- | ------------- | --------- | ------------ |
| Total Order   | `0`           | 100%      | vs Yesterday |
| Sale          | `$0.00`       | 0%        | vs Yesterday |
| Total tip     | `$0.00`       | 0%        | vs Yesterday |
| Total Payment | `$0.00`       | 0%        | vs Yesterday |

## A4. Nghiệp vụ & ràng buộc

- **Sale** loại trừ Tip, Tax và order **Cancel**; refund/partial refund tính giá trị âm sau Discount.
- **Total Payment** = doanh thu cuối, **có** cộng Gift Card Redemption (khác với Amount Collected chỉ gồm Card+Cash+Others).
- Công thức panel: `Income Details.Total Payment = Sale + Tip + Tax Collected` và `Payment Details.Total Payment = Amount Collected + Gift Card Redemption` — hai con số này phải khớp nhau.
- `from`/`to` (epoch) lưu trên URL → filter ngày **bền qua reload / share link** (URL persistence).
- Mọi phép so sánh %vs Yesterday dựa trên cùng chỉ số của ngày liền trước.

## A5. Trạng thái / quyền / edge case

- **Quyền:** cần **owner passcode** (mặc định `8888`) qua passcode dialog; có tùy chọn _"Do not require passcode for the next 30 minutes"_.
- **Empty state:** ngày không có order → chart "No chart data available", bảng "No data available", tất cả chỉ số `$0.00`/`0`, Print vẫn enabled.
- **Refund/Cancel:** Sale/Total của order refund là số âm; order Cancel **không** vào Sale/Tip.
- **Live delta:** chỉ số cập nhật khi có order mới trong ngày đang xem (xem TC live-delta hiện có).
- **Lưu ý UI:** helper text của mỗi card là `<p>` **luôn hiển thị** dưới heading — **không** phải tooltip hover, **không** có nút ⓘ.

## A6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

| Mục                | Linear                                                                         | UI thực tế                                     | Kết luận                                                                                                |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 4 chỉ số card      | Orders / Sale / Total Tips / Total Payment                                     | Total Order / Sale / Total tip / Total Payment | ✅ Khớp (khác biệt nhỏ về cách viết hoa/nhãn)                                                           |
| Mô tả "Orders"     | _Total number of order, refunds, and manual refunds_                           | _excluding cancel/refunds/ manual refunds_     | ⚠️ **Lệch câu chữ** — UI ghi "excluding", spec ghi "refunds and manual refunds". Cần PO xác nhận nghĩa. |
| Income Details     | Sale / Tip / Tax Collected / Total Payment                                     | Đủ 4 dòng                                      | ✅ Khớp                                                                                                 |
| Payment Details    | Card / Cash / Others / Amount Collected / Gift Card Redemption / Total Payment | Đủ 6 dòng                                      | ✅ Khớp                                                                                                 |
| Print              | (không nêu rõ)                                                                 | Có nút Print                                   | ✅ UI bổ sung, hợp lý                                                                                   |
| Tax Collected note | _total Tax_                                                                    | _(Sales tax collected, adjusted for refunds)_  | ✅ Khớp về ý (UI diễn giải rõ hơn)                                                                      |

# PHẦN B — Quét Tiếng Việt (i18n)

## B0. Tổng quan (số liệu từ i18n-result.md / compare.json)

> **Chuỗi UI đối chiếu 40** · ❌ chưa dịch **1** · ⚠️ sai chuẩn **3** · 📐 UI vỡ **0** · ✅ thuật ngữ đúng **36** · (data bỏ qua: 144 · tổng pair 241)
> Quét **sau khi cuộn hết trang** (`scrollThroughPage`) + đối chiếu glossary bổ sung theo [VP-2252](https://linear.app/fastboy/issue/VP-2252).
> Nguồn số liệu: [reports/income-daily/compare.json](../../reports/income-daily/compare.json) (generatedAt 2026-07-06T09:25:43Z → `total 241 · missing 1 · suspect 3 · ok 36 · data 144`).
> Report trực quan: `reports/income-daily/compare.html`

## B1. ❌ Còn tiếng Anh (nhãn UI thật)

| Chuỗi (EN) | Đang hiển thị (VI)     | Nên dịch     | Ghi chú                                                                                                                       |
| ---------- | ---------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `Tip`      | `Tip` (chưa qua `t()`) | **Tiền tip** | Nhãn dòng trong panel **Income Details** (khác với card "Total tip" đã dịch = "Tổng tip"). Dev cần bọc `t()` cho label "Tip". |

## B2. ⚠️ Dịch chưa đúng chuẩn

| Hiện tại (VI)       | Gốc (EN) | Nên dùng (chuẩn) | Issue                                                                                                                                                                                                                    |
| ------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Bán hàng` (×3 chỗ) | `Sale`   | **Doanh thu**    | [VP-2268](https://linear.app/fastboy/issue/VP-2268) / [VP-2259](https://linear.app/fastboy/issue/VP-2259) — "Sale" dịch không nhất quán: card + Chi tiết thu nhập dùng "Bán hàng" nhưng tiêu đề màn là "Doanh thu ngày". |

**3 vị trí "Sale" → "Bán hàng"** (theo compare.json):

- `src/routes/_app/incomes/income-daily/-income-daily-statistics/income-daily-statistics-card.tsx:69` (card)
- `src/routes/_app/incomes/income-daily/-income-daily/income-daily.tsx:81` (heading)
- `src/routes/_app/incomes/income-daily/-income-daily-detail/income-daily-detail-row.tsx:44` (dòng bảng)

## B3. ✅ Đã dịch đúng (mẫu)

| EN                                                              | VI                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| Daily Sale Report                                               | Doanh thu ngày                                         |
| Total Order                                                     | Tổng đơn                                               |
| Total number of order, excluding cancel/refunds/ manual refunds | Tổng số đơn, không gồm đơn huỷ/hoàn tiền/hoàn thủ công |
| vs Yesterday                                                    | so với hôm qua                                         |
| Today                                                           | Hôm nay                                                |
| Order History                                                   | Lịch sử đơn hàng                                       |
| Scanner                                                         | Quét mã                                                |
| Internet connection restored.                                   | Đã kết nối internet trở lại.                           |

## B4. 📐 UI vỡ (chỉ báo cáo)

> Không phát hiện: `xOverflow = 0px`, không có chuỗi bị cắt (`clipped = []`). Bản dịch VI dài hơn EN nhưng layout 2 cột vẫn chịu được.

**Ghi chú / đề xuất bổ sung glossary:**

- Chuỗi lẻ **"Tip"** (đứng một mình) xuất hiện ở cả income-daily và income-summary — nhiều khả năng cùng một component panel dùng label cứng. Fix một chỗ có thể xử lý cả hai màn.
- Glossary hiện đã đủ cho màn này; không cần bổ sung.

# PHẦN C — Test cases

> Màn này **đã có code test đầy đủ** (page object + 44 TC). Bảng dưới **tài liệu-hoá** bộ TC đang chạy (mỗi TC map 1-1 với một `test()` trong [tests/regression/incomes/daily-sale-report/](../../tests/regression/incomes/daily-sale-report/)).

## Cách chạy

```bash
npx playwright test tests/regression/incomes/daily-sale-report
```

## Bảng test case (đã hiện thực trong code)

| ID          | Tiêu đề                                                 | Tiền điều kiện        | Các bước                  | Kết quả mong đợi                                                            | Loại            | Ưu tiên | File                |
| ----------- | ------------------------------------------------------- | --------------------- | ------------------------- | --------------------------------------------------------------------------- | --------------- | ------- | ------------------- |
| TC-1        | Default filter = Today, full layout renders             | Passcode đã mở        | Mở /incomes/income-daily  | URL có `from=<today midnight>`; 4 card + panel hiển thị                     | regression      | P1      | defaults            |
| TC-3        | Card description — Total Order                          | như trên              | Đọc `<p>` dưới heading    | Đúng text "Total number of order, excluding cancel/refunds/ manual refunds" | regression      | P2      | defaults            |
| TC-5        | Card description — Sale                                 |                       | Đọc `<p>`                 | Đúng text mô tả Sale                                                        | regression      | P2      | defaults            |
| TC-7        | Card description — Total Tip                            |                       | Đọc `<p>`                 | Đúng text mô tả Tip                                                         | regression      | P2      | defaults            |
| TC-9        | Card description — Total Payment                        |                       | Đọc `<p>`                 | Đúng text mô tả Total Payment                                               | regression      | P2      | defaults            |
| TC-10       | Mỗi card có nhãn `<n>% vs Yesterday`                    |                       | Đọc từng card             | Cả 4 card có badge % + "vs Yesterday"                                       | regression      | P2      | defaults            |
| TC-14       | Order # đầu tiên đúng format `OD\d{6}-\d+`              | Ngày có order         | Đọc cell Order # đầu bảng | Khớp regex                                                                  | regression      | P1      | defaults            |
| TC-25       | Nút Print enabled & click được                          |                       | Click Print               | Không lỗi, dialog in mở                                                     | regression      | P2      | defaults            |
| TC-2/4/6/8  | Refund/Cancel: Sale/Total âm, Cancel không vào Sale     | Ngày có refund/cancel | Đọc bảng + panel          | Refund là số âm; order Cancel loại khỏi Sale/Tip                            | regression      | P1      | refund-cancel       |
| TC-8        | Total Payment nhất quán qua lifecycle (create → cancel) |                       | Theo dõi 1 order          | Total Payment cập nhật đúng                                                 | regression      | P1      | refund-cancel       |
| TC-22/23/37 | Refund/cancel edge trên panel                           |                       |                           | Panel phản ánh đúng                                                         | regression      | P2      | refund-cancel       |
| TC-11       | Mặc định chart = Sale khi load lần đầu                  |                       | Mở màn                    | `activeChart=sale`                                                          | regression      | P2      | chart-switching     |
| TC-27/28/29 | Click card đổi chart (Order/Tip/Payment)                |                       | Click từng card           | URL `activeChart=` đổi tương ứng                                            | regression      | P2      | chart-switching     |
| TC-30       | Chỉ card được click mang trạng thái selected            |                       | Click 1 card              | Chỉ card đó có class selected                                               | regression      | P2      | chart-switching     |
| TC-12       | Chọn hôm qua → load ngày hôm qua                        |                       | gotoDate(yesterday)       | Data + URL = hôm qua                                                        | regression      | P1      | date-filter         |
| TC-13       | Ngày không order → $0.00 mọi nơi                        |                       | Chọn ngày trống           | Tất cả `$0.00`/`0`                                                          | regression      | P1      | date-filter         |
| TC-39       | Ngày quá khứ khớp snapshot GraphQL settled              |                       | gotoDate(past)            | Bảng khớp snapshot                                                          | regression      | P1      | date-filter         |
| TC-15/17    | Cell Sale & Tip parse ra money hợp lệ                   | Ngày có data          | Đọc cell                  | Parse cents thành công                                                      | regression      | P2      | orders-table        |
| TC-18       | Total = Sale + Tip + Tax trên mỗi dòng                  |                       | Đọc từng dòng             | Đẳng thức đúng                                                              | regression      | P1      | orders-table        |
| TC-16       | Ngày settled tách tax vào Income Detail Tax Collected   |                       | Đọc panel                 | Tax Collected = tổng tax                                                    | regression      | P1      | payment-types       |
| TC-24       | Payment buckets Card/Cash/Others                        |                       | Đọc Payment Details       | Khớp GraphQL                                                                | regression      | P1      | payment-types       |
| TC-19/20/21 | Income/Payment Details khớp GraphQL + reconcile         |                       | Đọc panel + so API        | Trùng khớp; live: tip vào Total Tip & Amount Collected chứ không vào Sale   | regression      | P1      | math + live-delta   |
| TC-26       | Mọi money render dạng `$#,##0.00`                       |                       | Quét toàn màn             | Đúng định dạng                                                              | regression      | P2      | math                |
| TC-31       | Reload giữ `activeChart` + `from/to` trong URL          |                       | Reload                    | UI phản ánh đúng URL                                                        | regression      | P2      | url-persistence     |
| TC-32       | Mở route hiện passcode dialog trước khi render data     | Chưa mở passcode      | Mở route                  | Dialog passcode chặn data                                                   | regression/auth | P1      | permission          |
| TC-33       | Passcode sai → dialog vẫn mở, không unlock              |                       | Nhập sai                  | Dialog còn, data ẩn                                                         | regression/auth | P1      | permission          |
| TC-34       | Tick "Do not require passcode 30m" bỏ qua lần sau       |                       | Tick + nhập               | Lần sau không hỏi                                                           | regression/auth | P2      | permission          |
| TC-35       | Click 1 dòng mở Order Details dialog + set `?orderId`   | Ngày có order         | Click dòng                | Dialog mở, URL có orderId                                                   | regression      | P1      | order-detail-dialog |
| TC-36       | Đóng dialog qua ESC / × / mở dòng khác                  |                       | ESC / click × / dòng khác | Dialog đóng, orderId clear/replace                                          | regression      | P2      | order-detail-dialog |
| TC-40       | Skeleton hiện khi đang load                             |                       | Mở màn                    | `[data-slot=skeleton]` xuất hiện                                            | regression      | P3      | edge-cases          |
| TC-41       | Error fallback khi GraphQL 500                          | Mock 500              | Mở màn                    | Hiện "Failed to load…"                                                      | regression      | P2      | edge-cases          |
| TC-42       | %vs Yesterday không Infinity/NaN khi hôm qua = 0        |                       | Chọn ngày sau ngày trống  | Badge hiển thị hợp lệ                                                       | regression      | P2      | edge-cases          |
| TC-43       | Split-tender order hiện qua Card/Cash/Gift Card         | Mock split            | Đọc Payment Details       | Chia đúng bucket                                                            | regression      | P2      | mocked-scenarios    |
| TC-44       | Timezone boundary — UI theo merchant-local day          |                       | gotoDate quanh biên TZ    | Cửa sổ ngày đúng theo shop TZ                                               | regression      | P1      | mocked-scenarios    |

**Tổng: 44 test (TC-1 … TC-44)**, chia 13 file spec theo cluster.

### Ghi chú i18n / quyền (test)

- Toàn bộ route bọc bởi `PermissionProtectedRoute` (passcode owner). Xem `PasscodeDialog`.
- i18n coverage cho màn này được xử lý ở skill `i18n-vietnamese-scan` — kết quả đã hợp nhất vào PHẦN B.

## Nguồn tham chiếu

- Spec/glossary: docs/i18n/income-daily-translation-map.md (nếu có, giữ riêng)
- Luồng code-gen (tách riêng): [codegen-flow/income-daily-flow.md](../income-daily/income-daily-code-detail.md) · [codegen-detail/income-daily-detail.md](../income-daily/income-daily-code-detail.md)
- Test/helper + dữ liệu thô JSON: [reports/income-daily/compare.json](../../reports/income-daily/compare.json)
- Page object hiện có: [src/pages/pos/DailySaleReportPage.ts](../../src/pages/pos/DailySaleReportPage.ts)
- Test suite hiện có: [tests/regression/incomes/daily-sale-report/](../../tests/regression/incomes/daily-sale-report/) (TC01–TC44)
- Spec Linear (offline): [docs/linear/income-report.md](../linear/income-report.md) — mục **Daily Sale Report**.

---

# Appendix — Legacy VP-1048 Daily Sale Report Test Cases (Excel-style, merged from docs/test-cases/income-reports/VP-1048-daily-sale-report-test-cases.md)

# VP-1048 — Daily Sale Report & Income/Payment Detail (POS Income, thêm cột Tax) — Test Cases

> **Nguồn:** Spec dán trong chat ([Volt POS] POS Income) + ảnh chụp màn hình UI thực tế + task Linear VP-1048.
> **Ngôn ngữ:** Tiếng Việt (theo source).
> **Format:** Excel-style, 1 dòng = 1 test case.
>
> ⚠️ **Cần xác nhận (gap):** Tiêu đề task VP-1048 đề cập cả _"Income Summary Report"_ nhưng spec dán trong chat chỉ mô tả **Daily Sale Report** (+ Order Detail / Income Detail / Payment Detail). Bộ test case này phủ phần được mô tả chi tiết; phần Income Summary Report cần spec bổ sung trước khi viết TC. (Không truy cập được Linear do cần đăng nhập `/mcp`.)
>
> ⚠️ **Bất biến quan trọng (reconciliation):** spec định nghĩa **Total Payment** ở 2 nơi bằng 2 công thức khác nhau:
>
> - Income Detail: `Total Payment = Sale + Tip + Tax Collected`
> - Payment Detail: `TOTAL PAYMENT = Amount Collected (Card+Cash+Others) + Gift Card Redemption`
>   Cả hai phải **bằng nhau** và bằng card **Total Payment** ở Business Snapshot (ảnh: cả 3 đều = $8,356.55). TC-21 kiểm tra bất biến này.

| ID  | PROGRAM | FEATURES                  | LINK                           | DESCRIPTION                                                                                      | PRE-CONDITION                                                          | TEST STEPS                                                                    | DATA TEST                                                                                       | EXPECTED RESULT                                                                                                                                                                                                                                     | ACTUAL RESULT | STATUS | NOTE                                                                         |
| --- | ------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ---------------------------------------------------------------------------- |
| 1   | POS     | Business Snapshot         | Daily Sale Report              | Mở màn hình Daily Sale Report, mặc định filter = Today                                           | User đã đăng nhập, có quyền xem báo cáo                                | 1. Vào Daily Sale Report                                                      |                                                                                                 | 1. Màn hình hiển thị 4 card: Total Order, Sale, Total Tip, Total Payment<br>2. Filter mặc định = **Today**, ngày = ngày hiện tại<br>3. Panel phải hiển thị List Order Detail + Income Detail + Payment Detail của hôm nay                           |               |        |                                                                              |
| 2   | POS     | Business Snapshot         | Daily Sale Report              | Total Order đếm đúng số order, loại trừ cancel/refund/manual refund                              | Trong ngày có order sale + order cancel + order refund + manual refund | 1. Mở báo cáo ngày có dữ liệu<br>2. Đọc giá trị card Total Order              | 5 sale, 1 cancel, 1 refund, 1 manual refund                                                     | 1. Total Order = **5** (chỉ đếm order hợp lệ)<br>2. Order cancel/refund/manual refund KHÔNG được đếm                                                                                                                                                |               |        | // NOTE: cần xác nhận order có refund 1 phần được đếm hay không              |
| 3   | POS     | Business Snapshot         | Daily Sale Report              | Tooltip card Orders hiển thị đúng nội dung                                                       | Đang ở Daily Sale Report                                               | 1. Hover/click icon (i) cạnh "Total Order"                                    |                                                                                                 | 1. Tooltip hiển thị: "Total number of order, excluding cancel/refunds/manual refunds."                                                                                                                                                              |               |        |                                                                              |
| 4   | POS     | Business Snapshot         | Daily Sale Report              | Sale = tổng sale/refund/partial refund sau Discount, KHÔNG tính Tip/Tax, KHÔNG tính order Cancel | Có order sale, refund, partial refund, cancel với Tip & Tax            | 1. Mở báo cáo<br>2. Đọc card Sale                                             | Order A: Sale 110, Discount 10, Tip 30, Tax 8.8<br>Order B (refund) -50<br>Order C (cancel) 200 | 1. Sale = (110-10) + (-50) = **$50.00**<br>2. KHÔNG cộng Tip (30), KHÔNG cộng Tax (8.8)<br>3. KHÔNG cộng order Cancel (200)                                                                                                                         |               |        |                                                                              |
| 5   | POS     | Business Snapshot         | Daily Sale Report              | Tooltip card Sale                                                                                | Đang ở Daily Sale Report                                               | 1. Hover/click icon (i) cạnh "Sale"                                           |                                                                                                 | 1. Tooltip: "Total sale amount of the order, including refund/partial refund values after discount is applied, excluding Tax and Tip."                                                                                                              |               |        |                                                                              |
| 6   | POS     | Business Snapshot         | Daily Sale Report              | Total Tip = tổng Tip, không tính order Cancel                                                    | Có order có Tip + order cancel có Tip                                  | 1. Mở báo cáo<br>2. Đọc card Total Tip                                        | Order A Tip 30, Order B Tip 25, Order C (cancel) Tip 40                                         | 1. Total Tip = 30 + 25 = **$55.00**<br>2. Tip của order cancel (40) KHÔNG được tính                                                                                                                                                                 |               |        |                                                                              |
| 7   | POS     | Business Snapshot         | Daily Sale Report              | Tooltip card Total Tips                                                                          | Đang ở Daily Sale Report                                               | 1. Hover/click icon (i) cạnh "Total Tip"                                      |                                                                                                 | 1. Tooltip: "Total tips received, not included in sales revenue but counted in collected amounts."                                                                                                                                                  |               |        |                                                                              |
| 8   | POS     | Business Snapshot         | Daily Sale Report              | Total Payment = doanh thu cuối gồm Gift Card Redemption                                          | Có sale + tip + tax + gift card redemption                             | 1. Mở báo cáo<br>2. Đọc card Total Payment                                    | Amount Collected 3,706.55; Gift Card 4,650                                                      | 1. Total Payment = Amount Collected + Gift Card Redemption = **$8,356.55**<br>2. Bằng giá trị TOTAL PAYMENT ở Payment Detail                                                                                                                        |               |        |                                                                              |
| 9   | POS     | Business Snapshot         | Daily Sale Report              | Tooltip card Total Payment                                                                       | Đang ở Daily Sale Report                                               | 1. Hover/click icon (i) cạnh "Total Payment"                                  |                                                                                                 | 1. Tooltip: "The final revenue includes Gift Card Redemption."                                                                                                                                                                                      |               |        |                                                                              |
| 10  | POS     | Business Snapshot         | Daily Sale Report              | So sánh "vs Yesterday" hiển thị % tăng/giảm đúng chiều                                           | Có dữ liệu hôm nay và hôm qua                                          | 1. Mở báo cáo<br>2. Đọc % "vs Yesterday" trên từng card                       | Hôm qua Sale 350, hôm nay 8,151.55                                                              | 1. Mỗi card hiển thị % chênh lệch so với hôm qua<br>2. Tăng → mũi tên/nhãn tăng (xanh); giảm → giảm (đỏ)<br>3. % tính đúng: (today-yesterday)/yesterday                                                                                             |               |        |                                                                              |
| 11  | POS     | Business Snapshot         | Daily Sale Report              | Chart Sale hiển thị doanh số theo từng khung giờ trong ngày                                      | Có order rải theo các giờ                                              | 1. Mở báo cáo<br>2. Xem chart "Sale"                                          | Order lúc 8AM, 1PM, 3PM                                                                         | 1. Trục X = giờ (12AM → 10PM)<br>2. Cột Sale đứng đúng khung giờ phát sinh order<br>3. Chiều cao cột tỉ lệ với Sale của giờ đó                                                                                                                      |               |        |                                                                              |
| 12  | POS     | Filter ngày               | Daily Sale Report              | Chọn một ngày khác bằng date picker, báo cáo load lại theo ngày đó                               | Có dữ liệu của ngày quá khứ                                            | 1. Click vào ô ngày<br>2. Chọn ngày quá khứ có dữ liệu<br>3. Quan sát báo cáo | Chọn ngày có 3 order                                                                            | 1. Tiêu đề panel phải đổi sang ngày đã chọn<br>2. Cards + chart + Order Detail + Income/Payment Detail cập nhật theo ngày chọn<br>3. Nút "Today" cho phép quay lại hôm nay                                                                          |               |        |                                                                              |
| 13  | POS     | Filter ngày               | Daily Sale Report              | Chọn ngày không có order (rỗng)                                                                  | Có ngày không phát sinh order                                          | 1. Chọn ngày rỗng                                                             | Ngày 0 order                                                                                    | 1. Total Order = 0; Sale = $0.00; Total Tip = $0.00; Total Payment = $0.00<br>2. List Order Detail rỗng (hoặc thông báo no data)<br>3. Income/Payment Detail = $0.00 toàn bộ                                                                        |               |        |                                                                              |
| 14  | POS     | Order Detail              | Daily Sale Report / panel phải | Cột Order # hiển thị orderCode đúng                                                              | Có order trong ngày                                                    | 1. Mở báo cáo<br>2. Xem cột Order #                                           | OD260604-36243812                                                                               | 1. Cột Order # = orderCode của order (vd OD260604-36243812)                                                                                                                                                                                         |               |        |                                                                              |
| 15  | POS     | Order Detail              | Daily Sale Report / panel phải | Cột Sale (Sale/Refund) = tổng service sale/refund trên order sau Discount                        | Order có service sale + discount                                       | 1. Xem dòng order trong bảng                                                  | Service 30, Discount 5                                                                          | 1. Cột Sale/Refund = 30 - 5 = **$25.00**<br>2. Không gồm Tip/Tax                                                                                                                                                                                    |               |        |                                                                              |
| 16  | POS     | Order Detail (Tax column) | Daily Sale Report / panel phải | Cột Tax (MỚI) hiển thị Tax trên từng order                                                       | Order có Tax                                                           | 1. Xem cột Tax của order                                                      | Order Tax 8.8                                                                                   | 1. Bảng Order Detail có cột **Tax** (mới thêm theo VP-1048)<br>2. Cột Tax = Tax tính trên order = $8.80                                                                                                                                             |               |        |                                                                              |
| 17  | POS     | Order Detail              | Daily Sale Report / panel phải | Cột Tip = total tip trên order                                                                   | Order có nhiều dịch vụ + tip                                           | 1. Xem cột Tip                                                                | Tip 10                                                                                          | 1. Cột Tip = tổng tip của order = $10.00                                                                                                                                                                                                            |               |        |                                                                              |
| 18  | POS     | Order Detail              | Daily Sale Report / panel phải | Cột Total = Sale + Tip + Tax (header ghi "Sale + Tax + Tip")                                     | Order có sale, tip, tax                                                | 1. Xem cột Total của order                                                    | Sale 25, Tip 10, Tax 0                                                                          | 1. Total = 25 + 10 + 0 = **$35.00**<br>2. Total = Sale + Tip + Tax cho mọi dòng                                                                                                                                                                     |               |        |                                                                              |
| 19  | POS     | Income Detail (Tax)       | Daily Sale Report / panel phải | Income Detail: Sale/Tip/Tax Collected/Total Payment tính đúng                                    | Ngày có nhiều order                                                    | 1. Xem khối Income Detail                                                     | Σ Sale 8,151.55; Σ Tip 55; Σ Tax 150                                                            | 1. Sale = tổng Sale/Refund sau Discount = $8,151.55<br>2. Tip = total tip = $55.00<br>3. **Tax Collected** = total Tax = $150.00 (label phụ: "Sales tax collected, adjusted for refunds")<br>4. Total Payment = 8,151.55 + 55 + 150 = **$8,356.55** |               |        |                                                                              |
| 20  | POS     | Payment Detail            | Daily Sale Report / panel phải | Payment Detail: Card/Cash/Others = Sale - Refund theo từng phương thức                           | Order thanh toán bằng Card, Cash, Others (có cả refund)                | 1. Xem khối Payment Detail                                                    | Cash sale 3,800 refund 93.45; Card 0; Others 0                                                  | 1. Card = Sale Card - Refund Card<br>2. Cash = Sale Cash - Refund Cash = $3,706.55<br>3. Others = Sale Others - Refund Others<br>4. Amount Collected = Card + Cash + Others = $3,706.55                                                             |               |        |                                                                              |
| 21  | POS     | Payment Detail            | Daily Sale Report / panel phải | TOTAL PAYMENT = Amount Collected + Gift Card Redemption và khớp Income Detail + card             | Có gift card redemption                                                | 1. Xem Payment Detail<br>2. So với Income Detail & card Total Payment         | Amount Collected 3,706.55; Gift Card 4,650                                                      | 1. Gift Card Redemption = $4,650.00<br>2. TOTAL PAYMENT = 3,706.55 + 4,650 = **$8,356.55**<br>3. = Total Payment ở Income Detail (TC-19)<br>4. = card Total Payment ở Business Snapshot (TC-8)                                                      |               |        |                                                                              |
| 22  | POS     | Refund handling           | Daily Sale Report              | Refund/partial refund làm giảm Sale (giá trị âm)                                                 | Có order refund toàn phần & partial refund                             | 1. Tạo/chọn ngày có refund<br>2. Đọc Sale (card + Income Detail)              | Sale 200, partial refund -60, full refund -100                                                  | 1. Sale phản ánh giá trị refund (trừ đi): 200 - 60 - 100 = $40<br>2. Phương thức refund trừ đúng vào Card/Cash/Others tương ứng                                                                                                                     |               |        |                                                                              |
| 23  | POS     | Cancel handling           | Daily Sale Report              | Order Cancel bị loại khỏi Sale, Tip, Total Order                                                 | Có order ở trạng thái Cancel                                           | 1. Chọn ngày có order cancel                                                  | 1 order cancel (Sale 200, Tip 40, Tax 16)                                                       | 1. Total Order không đếm order cancel<br>2. Sale không cộng 200<br>3. Total Tip không cộng 40<br>4. Order cancel không xuất hiện làm tăng Income/Payment (theo spec "không tính order Cancel")                                                      |               |        | // NOTE: cần xác nhận order cancel có hiển thị trong list Order Detail không |
| 24  | POS     | Gift Card                 | Daily Sale Report              | Gift Card Redemption tính vào Total Payment nhưng KHÔNG tính vào Sale                            | Có order thanh toán bằng Gift Card                                     | 1. Chọn ngày có redemption gift card                                          | Gift Card Redemption 4,650                                                                      | 1. Sale KHÔNG bao gồm 4,650<br>2. Gift Card Redemption = 4,650 hiển thị ở Payment Detail<br>3. Total Payment có cộng 4,650                                                                                                                          |               |        |                                                                              |
| 25  | POS     | Print                     | Daily Sale Report              | Nút Print xuất báo cáo đúng ngày đang xem                                                        | Đang xem báo cáo 1 ngày                                                | 1. Click "Print"                                                              |                                                                                                 | 1. Mở bản in/preview của báo cáo<br>2. Nội dung in khớp ngày + số liệu đang hiển thị (cards, Order Detail, Income, Payment)                                                                                                                         |               |        |                                                                              |
| 26  | POS     | Định dạng tiền            | Daily Sale Report              | Tất cả số tiền hiển thị định dạng tiền tệ 2 chữ số thập phân                                     | Có dữ liệu                                                             | 1. Quan sát mọi giá trị tiền                                                  |                                                                                                 | 1. Mọi số tiền dạng $#,##0.00 (vd $8,151.55)<br>2. Giá trị 0 hiển thị $0.00, không để trống                                                                                                                                                         |               |        |                                                                              |

## Coverage map

| Yêu cầu / mục trong spec                                              | TC phủ |
| --------------------------------------------------------------------- | ------ |
| Mở màn hình + filter mặc định Today                                   | 1      |
| Orders count (loại cancel/refund/manual refund) + tooltip             | 2, 3   |
| Sale (sau discount, loại Tip/Tax/Cancel) + tooltip                    | 4, 5   |
| Total Tips (loại Cancel) + tooltip                                    | 6, 7   |
| Total Payment (gồm Gift Card Redemption) + tooltip                    | 8, 9   |
| So sánh vs Yesterday                                                  | 10     |
| Chart Sale theo giờ                                                   | 11     |
| Filter cho phép chọn từng ngày                                        | 12, 13 |
| Order Detail: Order # = orderCode                                     | 14     |
| Order Detail: Sale (sau Discount)                                     | 15     |
| Order Detail: **cột Tax (mới)**                                       | 16     |
| Order Detail: Tip                                                     | 17     |
| Order Detail: Total = Sale + Tip + Tax                                | 18     |
| Income Detail: Sale / Tip / **Tax Collected** / Total Payment         | 19     |
| Payment Detail: Card / Cash / Others / Amount Collected               | 20     |
| Payment Detail: Gift Card Redemption + TOTAL PAYMENT + reconciliation | 21     |
| Xử lý Refund / Partial refund                                         | 22     |
| Xử lý Cancel                                                          | 23     |
| Gift Card (vào Total Payment, không vào Sale)                         | 24     |
| Print                                                                 | 25     |
| Định dạng tiền tệ                                                     | 26     |

> **Chưa cover (cần spec bổ sung / xác nhận):**
>
> - **Income Summary Report** (nêu trong tiêu đề VP-1048) — chưa có spec chi tiết trong nguồn được cung cấp.
> - Phân quyền (role nào được xem Daily Sale Report / nút Print).
> - Múi giờ / mốc cắt ngày (order gần 12AM thuộc ngày nào).
> - Tiền tệ đa quốc gia / làm tròn lẻ tới cent của Tax.
> - Hành vi order **refund 1 phần** có được đếm trong Total Order hay không (TC-2 note).

---

## Bổ sung sau review code (TC 27–44)

> **Nguồn:** đối chiếu spec với source `D:\Project\Volt-pos-main\volt-pos\src\routes\_app\incomes\income-daily\` (Tauri + React 19 + TanStack Router + GraphQL). Các TC dưới đây phủ các behavior **có trong code nhưng spec không mô tả rõ**.

| ID  | PROGRAM | FEATURES            | LINK                           | DESCRIPTION                                                                  | PRE-CONDITION                                  | TEST STEPS                                                                                                        | DATA TEST         | EXPECTED RESULT                                                                                                                                                                  | ACTUAL RESULT | STATUS | NOTE                                                                   |
| --- | ------- | ------------------- | ------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ---------------------------------------------------------------------- |
| 27  | POS     | Chart switching     | Daily Sale Report              | Click card **Total Order** → chart đổi sang Total Order                      | Đang ở Daily Sale Report, có dữ liệu           | 1. Click vào card "Total Order"<br>2. Quan sát chart + URL                                                        |                   | 1. URL param `activeChart=totalOrder`<br>2. Label `<h3>` đổi thành "Total Order"<br>3. Bar chart vẽ **số order** theo từng giờ (không phải tiền)                                 |               |        |                                                                        |
| 28  | POS     | Chart switching     | Daily Sale Report              | Click card **Total Tip** → chart đổi sang Total Tip                          | Đang ở Daily Sale Report                       | 1. Click vào card "Total Tip"<br>2. Quan sát chart + URL                                                          |                   | 1. URL `activeChart=totalTip`<br>2. Label "Total Tip"<br>3. Chart vẽ tip/giờ                                                                                                     |               |        |                                                                        |
| 29  | POS     | Chart switching     | Daily Sale Report              | Click card **Total Payment** → chart đổi sang Total Payment                  | Đang ở Daily Sale Report                       | 1. Click vào card "Total Payment"<br>2. Quan sát chart + URL                                                      |                   | 1. URL `activeChart=totalPayment`<br>2. Label "Total Payment"<br>3. Chart vẽ Total Payment/giờ                                                                                   |               |        |                                                                        |
| 30  | POS     | Card selected state | Daily Sale Report              | Card đang được chọn có visual khác biệt (border + nền nhạt)                  | Có dữ liệu                                     | 1. Click lần lượt 4 cards                                                                                         |                   | 1. Card active có `border-2 border-primary` + `bg-primary-50` + `shadow-sm`<br>2. 3 card còn lại giữ `border-stroke` default<br>3. Mỗi lúc chỉ có 1 card active                  |               |        |                                                                        |
| 31  | POS     | URL persistence     | Daily Sale Report              | Reload trang giữ nguyên `activeChart` và `from/to`                           | Đang xem 1 ngày + chart Total Tip              | 1. Bấm F5 / reload                                                                                                |                   | 1. Sau reload, URL còn nguyên `activeChart=totalTip&from=...&to=...`<br>2. Chart hiển thị Total Tip<br>3. Date filter giữ ngày đã chọn                                           |               |        | // verify URL có thể bookmark / share được                             |
| 32  | POS     | Permission gate     | Daily Sale Report              | User không có permission `daily_income` bị chặn                              | Đăng nhập user thiếu quyền `daily_income`      | 1. Vào URL `/incomes/income-daily`                                                                                |                   | 1. `PermissionProtectedRoute` chặn render<br>2. Hiển thị dialog passcode "Enter staff code to access Income Page" HOẶC redirect về `/`<br>3. Không lộ data                       |               |        |                                                                        |
| 33  | POS     | Passcode wrong      | Daily Sale Report              | Nhập sai passcode                                                            | Đã được prompt passcode                        | 1. Mở Daily Sale Report<br>2. Nhập 0000 (passcode sai)<br>3. Quan sát                                             | 0000              | 1. Dialog vẫn mở<br>2. Có thông báo lỗi / passcode bị clear<br>3. Không cho vào trang                                                                                            |               |        |                                                                        |
| 34  | POS     | Passcode bypass 30m | Daily Sale Report              | Check "Do not require passcode for the next 30 minutes" giữ phiên 30 phút    | Vừa được prompt passcode                       | 1. Tick checkbox<br>2. Nhập passcode đúng<br>3. Rời trang, quay lại trong 30 phút<br>4. Đợi quá 30 phút, quay lại | 8888 (owner)      | 1. Lần 2 (trong 30 phút): vào thẳng không cần passcode<br>2. Lần 3 (sau 30 phút): dialog passcode lại hiện                                                                       |               |        |                                                                        |
| 35  | POS     | Order Detail dialog | Daily Sale Report / panel phải | Click row order → mở dialog chi tiết                                         | Có ≥1 order trong ngày                         | 1. Click vào 1 row trong bảng Order Detail                                                                        | OD260604-25225104 | 1. Dialog (`IncomeDailyOrdersTableDialog`) mở ra<br>2. Hiển thị order code, services, staff, phương thức thanh toán, transactions<br>3. Tổng số liệu match dòng trong bảng       |               |        |                                                                        |
| 36  | POS     | Order Detail dialog | Daily Sale Report / panel phải | Đóng dialog (X / ESC / click outside)                                        | Đang mở dialog order detail                    | 1. Bấm ESC HOẶC click X HOẶC click outside                                                                        |                   | 1. Dialog đóng<br>2. Bảng + cards giữ nguyên state, không reload data<br>3. Có thể click row khác mở dialog mới                                                                  |               |        |                                                                        |
| 37  | POS     | Refund visual       | Daily Sale Report / panel phải | Row refund hiển thị màu đỏ + dấu trừ                                         | Có order refund (toàn phần hoặc partial)       | 1. Vào ngày có refund<br>2. Tìm dòng refund trong bảng                                                            | Refund $60        | 1. Các cell Sale/Tip/Tax/Total có class `text-destructive` (đỏ)<br>2. Số có dấu `-` phía trước (vd `-$60.00`)<br>3. Row sale bình thường vẫn màu mặc định                        |               |        |                                                                        |
| 38  | POS     | Live data (Today)   | Daily Sale Report              | Hôm nay dùng query `storeDailyIncomeLive` — order mới phản ánh khi refetch   | Đang xem ngày hôm nay                          | 1. Mở 1 tab khác tạo order mới + complete<br>2. Quay lại tab Daily Sale Report<br>3. Refresh / chờ refetch        | Order $50 cash    | 1. Total Order +1<br>2. Sale + $50<br>3. Cash + $50<br>4. Order xuất hiện trong bảng Order Detail                                                                                |               |        | // Note: tùy implementation có thể cần reload manual hoặc auto refresh |
| 39  | POS     | Settled data (past) | Daily Sale Report              | Hôm qua dùng query `storeDailyIncome` — order mới không ảnh hưởng            | Đang xem ngày hôm qua                          | 1. Mở tab khác tạo order mới hôm nay<br>2. Quay lại tab xem ngày hôm qua                                          |                   | 1. Cards + bảng + chart không thay đổi<br>2. Tổng vẫn là số settled của ngày hôm qua                                                                                             |               |        |                                                                        |
| 40  | POS     | Loading state       | Daily Sale Report              | Vào trang trong lúc data chưa load → hiển thị skeleton                       | Network chậm / first load                      | 1. Vào `/incomes/income-daily` (clear cache)                                                                      |                   | 1. Bên trái: `IncomeDailySkeleton` (placeholder 4 cards + chart)<br>2. Bên phải: `IncomeDailyDetailSkeleton`<br>3. Khi data về: skeleton biến mất, render dữ liệu thật           |               |        |                                                                        |
| 41  | POS     | Error state         | Daily Sale Report              | GraphQL fail → hiển thị error fallback                                       | Backend GraphQL fail (mock 500 / network down) | 1. Tắt mạng / mock 500 cho query `storeDailyIncome*`<br>2. Vào trang                                              |                   | 1. Bên trái: `IncomeDailyError` render thông báo lỗi<br>2. Bên phải: "Failed to load store daily income detail data!"<br>3. Không crash app                                      |               |        |                                                                        |
| 42  | POS     | Edge: %vs Yesterday | Daily Sale Report              | Hôm qua = $0 và hôm nay > $0 — không hiển thị `Infinity%` / `NaN%`           | Hôm qua 0 order, hôm nay có dữ liệu            | 1. Chọn ngày hôm nay (yesterday phải = 0)                                                                         |                   | 1. % "vs Yesterday" hiển thị "N/A" hoặc "—" hoặc text tương đương<br>2. KHÔNG hiển thị "Infinity%", "NaN%", hoặc số quá lớn dạng "999999%"<br>3. Không crash                     |               |        | // verify cách handle divide-by-zero                                   |
| 43  | POS     | Split payment       | Daily Sale Report              | Order trả split (Card + Cash + Gift Card) phân bổ đúng vào Payment Detail    | Có 1 order trả 3 phương thức                   | 1. Tạo order $100, trả Card $40 + Cash $30 + Gift Card $30<br>2. Mở Daily Sale Report                             |                   | 1. Card cộng đúng $40<br>2. Cash cộng đúng $30<br>3. Gift Card Redemption cộng đúng $30<br>4. Amount Collected = $70 (Card+Cash, KHÔNG gồm Gift Card)<br>5. Total Payment = $100 |               |        |                                                                        |
| 44  | POS     | Timezone boundary   | Daily Sale Report              | Order tại 23:59 ngày X và 00:01 ngày X+1 thuộc đúng ngày theo timezone store | Có order ngay sát 12AM theo timezone store     | 1. Tạo order lúc 23:59 ngày X<br>2. Tạo order lúc 00:01 ngày X+1<br>3. Lọc theo ngày X<br>4. Lọc theo ngày X+1    |                   | 1. Filter ngày X: chỉ thấy order 23:59<br>2. Filter ngày X+1: chỉ thấy order 00:01<br>3. Không bị lệch 1 ngày do conversion UTC ↔ local                                          |               |        | // verify với `from/to` (local) vs `fromUTC/toUTC` trong query         |

## Coverage map — bổ sung

| Yêu cầu / behavior trong code               | TC phủ                          |
| ------------------------------------------- | ------------------------------- |
| Click card → đổi chart (4 loại)             | 27, 28, 29 (Sale đã có ở TC-11) |
| Card selected visual state                  | 30                              |
| URL params persist sau reload               | 31                              |
| Permission gate `daily_income`              | 32                              |
| Passcode dialog (sai / đúng / bypass 30m)   | 33, 34                          |
| Click row → dialog chi tiết order           | 35, 36                          |
| Refund visual (màu đỏ + dấu trừ)            | 37                              |
| Query khác nhau: Today live vs settled past | 38, 39                          |
| Loading skeleton                            | 40                              |
| Error fallback                              | 41                              |
| Edge case math (%/0)                        | 42                              |
| Split payment phân bổ                       | 43                              |
| Timezone / mốc 12AM                         | 44                              |

> **Vẫn chưa cover (cần spec bổ sung):**
>
> - **Income Summary Report** (VP-1048 đề cập)
> - 2 chart type `netIncome` và `totalRefund` (có trong code, chưa có card UI tương ứng — xác nhận có dùng không)
> - Tooltip chart on hover khi rê chuột vào bar
> - Print receipt format chi tiết (TC-25 còn generic — nên tách thành nhiều TC)
> - Multi-currency / rounding cent của Tax
