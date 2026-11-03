---
title: Staff Payroll hiển thị staff có Order/Subtotal nhưng Total Income = $0 (POS) — test cases
ticket: VP-3356 — https://linear.app/fastboy/issue/VP-3356/pos-staff-payroll-khong-hien-thi-staff-co-ordersubtotal-nhung-total
feature-spec: docs/report-field-formulas.md
spec-files: tests/regression/incomes/vp-3356-staff-payroll-zero-income.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [POS] Staff Payroll không hiển thị staff có Order/Subtotal nhưng Total Income = $0

**Ticket:** [VP-3356](https://linear.app/fastboy/issue/VP-3356/pos-staff-payroll-khong-hien-thi-staff-co-ordersubtotal-nhung-total) · PR volt-pos#2699
**Sub-bug:** [VP-3891](https://linear.app/fastboy/issue/VP-3891/pos-staff-jd53001-co-subtotal-dollar0-nhung-total-income-dollar0-khong) — JD53001 có Subtotal ≠ $0 nhưng Total Income = $0 không hiển thị ở Current Period (Unclosed)
**Dev:** Nam Pham (`nam_pham`) · **Liên quan:** VP-2460 (Staff Income ẩn staff no-income — phải giữ nguyên), VP-4357 · regression `10-bao-cao-payroll.md` RPT-140 / RPT-141

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.57** (bản đã fix, QC Completed 26/10/2026).
- POS → ☰ → Income Reports → **Staff Payroll** (`/incomes/staff-payroll`, có passcode owner) — chọn kỳ bằng ô **pay period** (`Current Period (…)` = kỳ chưa đóng).
- Sau fix:
  - **Current Period (Unclosed)** liệt kê **tất cả** staff — kể cả staff 0 order và staff có order nhưng Total Income = $0.00 (trước fix bị lọc `totalIncome === 0`).
  - **Kỳ đã đóng** liệt kê cả staff inactive/deleted có số liệu (trước fix query chỉ lấy `status = active`).
  - 6 thẻ Summary (Total staff / Orders / Subtotal / Supply Fee / Tip / Total Income) = tổng của danh sách đã bổ sung.
  - Màn **Staff Income** (V1 `/incomes/income-staff` và V4 `/report-pages/v4/staff-income`) **vẫn mặc định ẩn** staff no-income (switch "Show staff with no income" tắt) — không regression VP-2460.
- Dữ liệu mẫu từ ticket / comment QC (merchant 14):
  - Kỳ **Aug 20 – Aug 26, 2026**: `1001bc` 1 order, Subtotal **-$62.00** (refund), Total Income $0.00; `THONG` (inactive, staff hưởng lương) 1 order, $30.00, Total Income $0.00.
  - Kỳ **Sep 10 – Sep 16, 2026**: `JD53001` 2 orders, $115.50, Total Income $0.00.
  - Kỳ **Oct 16 – Oct 22, 2026** (đã đóng): 336 staff / 1,057 orders / Subtotal $57,662.86 — khớp Portal.
- TC tạo dữ liệu (TC-11): staff **JD53001** phải đang **active** và **không hưởng commission** (Total Income luôn $0.00); tạo 1 đơn Cash cho JD53001 bằng flow `createOrder` + `payInCash` (cần `WRITE_ALLOWED`).

Chú thích trạng thái: ✅ tự động hoá được trên POS Windows (read-only) · ⚠️ tự động hoá có điều kiện (phụ thuộc dữ liệu kỳ cũ / tạo đơn) · 🧱 chưa tự động được ở đây (so Portal) · 📄 chỉ tài liệu.

## 1. Staff Payroll — Current Period (Unclosed)

| TC ID        | Title                                                                    | Priority | Precondition                                                                | Test Data                | Steps                                                                                     | Expected Result                                                                                                       | Status |
| ------------ | ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP3356-01 | Staff có Orders > 0 nhưng Total Income = $0 vẫn hiển thị (AC1)           | Critical | Kỳ hiện tại có staff không có thu nhập                                      | Current Period           | 1. Mở Staff Payroll (kỳ mặc định = Current Period). 2. Tìm các dòng Total Income $0.00    | Danh sách **có** dòng Total Income `$0.00` (không bị lọc); dòng có Orders > 0 mà income 0 hiện đúng `$0.00`, không ẩn | ✅     |
| TC-VP3356-02 | Current Period hiển thị tất cả staff, kể cả 0 order (VP-3891)            | Critical | Merchant có staff active chưa có đơn trong kỳ                               | Current Period           | 1. Mở Staff Payroll. 2. Đếm dòng, đếm staff 0 order. 3. So với số staff active            | Có dòng **Orders = 0**; số dòng ≥ số staff **active** của tiệm (giống kỳ đã đóng); số dòng = thẻ **Total staff**      | ✅     |
| TC-VP3356-03 | Summary khớp Σ danh sách sau khi bổ sung staff $0 — Current Period (AC4) | High     | Như TC-01                                                                   | –                        | 1. Cộng từng cột Orders / Subtotal / Supply Fee / Tip / Total Income. 2. So 6 thẻ Summary | Mỗi thẻ = tổng cột tương ứng (cents), số dòng = Total staff                                                           | ✅     |
| TC-VP3356-04 | Mở detail staff có order nhưng income $0.00 không lỗi (AC5)              | High     | Có staff Orders > 0, Total Income $0.00 trong kỳ hiện tại hoặc kỳ Aug 20–26 | THONG / 1001bc / JD53001 | 1. Click dòng staff đó. 2. Xem panel chi tiết                                             | Panel mở không lỗi ("Failed to load…" không xuất hiện); tên khớp; **Total Income $0.00** = dòng danh sách             | ⚠️     |

## 2. Staff Payroll — kỳ đã đóng

| TC ID        | Title                                                              | Priority | Precondition                                    | Test Data                                    | Steps                                                                                | Expected Result                                                                                                | Status |
| ------------ | ------------------------------------------------------------------ | -------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP3356-05 | Refund âm `1001bc` hiện đúng dấu âm, không bị ẩn (AC2)             | High     | Kỳ Aug 20 – Aug 26, 2026 còn trong danh sách kỳ | `1001bc` −$62.00                             | 1. Chọn kỳ Aug 20 – Aug 26, 2026. 2. Tìm `1001bc`                                    | Có dòng `1001bc`: Orders 1, Subtotal **-$62.00** (dấu âm), Total Income $0.00                                  | ⚠️     |
| TC-VP3356-06 | Staff inactive có số liệu vẫn hiển thị ở kỳ đã đóng (THONG)        | High     | Như TC-05                                       | `THONG` $30.00                               | 1. Chọn kỳ Aug 20 – Aug 26, 2026. 2. Tìm THONG. 3. Mở detail                         | Có dòng THONG: Orders 1, Subtotal $30.00, Total Income $0.00; detail mở bình thường, Total Income $0.00        | ⚠️     |
| TC-VP3356-07 | Summary khớp Σ danh sách — kỳ đã đóng gần nhất (AC4)               | High     | Có ≥ 1 kỳ đã đóng                               | Kỳ đầu tiên khác Current Period              | 1. Chọn kỳ đã đóng. 2. So 6 thẻ với tổng cột                                         | Mỗi thẻ = tổng cột; số dòng = Total staff                                                                      | ✅     |
| TC-VP3356-08 | JD53001 ở kỳ đã đóng Sep 10 – Sep 16, 2026 (VP-3891)               | Medium   | Kỳ Sep 10 – Sep 16, 2026 còn trong danh sách    | `JD53001`                                    | 1. Chọn kỳ Sep 10 – Sep 16, 2026. 2. Tìm JD53001                                     | JD53001: 2 orders, Subtotal $115.50, Total Income $0.00                                                        | ⚠️     |
| TC-VP3356-09 | Danh sách + Summary POS khớp Portal (Unclosed và kỳ đã đóng) (AC3) | High     | Portal DEV cùng merchant                        | Aug 20–26 (269 staff), Oct 16–22 (336 staff) | 1. Portal → Payroll → Staff Payroll, chọn cùng kỳ. 2. So từng dòng + Summary với POS | Cùng số staff, từng dòng và Summary khớp — **🧱 cần lane Portal (SSO), chưa nối vào suite**; đã PASS tay 26/10 | 🧱     |

## 3. Sub-bug VP-3891 — JD53001 (Current Period)

| TC ID        | Title                                                                 | Priority | Precondition                                            | Test Data                      | Steps                                                                                                          | Expected Result                                                                                                                                                                                          | Status |
| ------------ | --------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP3356-10 | Tạo đơn cho JD53001 → hiển thị ở Current Period, Total Income ≤ $0.00 | Critical | JD53001 active, không hưởng commission; `WRITE_ALLOWED` | Đơn Cash 1 dịch vụ cho JD53001 | 1. Tạo đơn cho JD53001 (Subtotal ≠ $0) → thanh toán Cash. 2. Mở Staff Payroll → Current Period. 3. Tìm JD53001 | JD53001 hiển thị: Orders ≥ 1, Subtotal > $0, Total Income **$0.00** (không ẩn dòng) (JD53001 không có commission; nếu dịch vụ có supply fee thì payroll trừ phí → Total Income âm, vd −$7.00 ngày 03/11) | ⚠️     |

## 4. Không regression Staff Income (VP-2460)

| TC ID        | Title                                                       | Priority | Precondition                     | Test Data | Steps                                                                                                | Expected Result                                                                                                     | Status |
| ------------ | ----------------------------------------------------------- | -------- | -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP3356-11 | Staff Income V1 vẫn ẩn staff no-income khi switch tắt (AC6) | High     | `/incomes/income-staff`, hôm nay | –         | 1. Mở Staff Income (V1). 2. Đảm bảo "Show staff with no income" tắt. 3. Xem danh sách. 4. Bật switch | B3: **không** có dòng Total Income $0.00. B4: số dòng ≥ khi tắt, Total staff theo đúng danh sách; trả switch về tắt | ✅     |
| TC-VP3356-12 | Staff Income V4 vẫn ẩn staff no-income khi switch tắt (AC6) | High     | `/report-pages/v4/staff-income`  | –         | 1. Mở Staff Income V4. 2. Đảm bảo switch tắt. 3. Xem danh sách. 4. Bật switch                        | Như TC-11 trên màn V4                                                                                               | ✅     |

## Kết quả test tay (26/10/2026, POS Windows 1.1.57)

VP-3356 PASS 6/6 AC · VP-3891 PASS — đã comment vào Linear. Current Period Oct 23–26 hiển thị 342 staff; kỳ Oct 16–22 khớp Portal 336 staff.
