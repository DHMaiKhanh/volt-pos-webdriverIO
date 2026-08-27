---
title: Code Detail — Staff Payroll (Bảng lương nhân viên)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Staff Payroll (Bảng lương nhân viên) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Staff Payroll (Bảng lương nhân viên)** · route `/incomes/staff-payroll` · scanned-at: 2026-08-20
> ❌ chưa dịch **3** · ⚠️ sai chuẩn / lệch thuật ngữ **7** · 📐 UI vỡ **0**
> Số liệu máy quét: 131 cặp EN↔VI · ✅ đúng glossary 23 · ⚠️ suspect 0 · dữ liệu 85 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/staff-payroll/compare.json` · HTML: `reports/staff-payroll/staff-payroll.html`
> Cách quét: `I18N_SCREEN=staff-payroll I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Màn mới, route **gated** (passcode). Quét 2 lớp: (1) list + thẻ tổng bằng spec compare, (2) **panel chi tiết** — chỉ hiện sau khi click 1 nhân viên — quét trực tiếp bằng MCP cho CẢ 2 dạng: **Salary** (TestSalary) và **Commission** (Ora Spencer).

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)                   | Đang hiển thị (VI)                            | Nên dịch                              | Nguồn (data-tsd-source)                                                                                                             |
| ---------------------------- | --------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pay 1 (Total Income x 85%)   | Pay 1(Tổng thu nhập x 85%)                    | Đợt trả 1 (Tổng thu nhập x 85%)       | staff-payroll-detail-salary.tsx / -commission.tsx — “Pay 1”, “Pay 2” còn nguyên tiếng Anh ở cả 2 dạng                               |
| Pay 2 (Total Income - Pay 1) | Pay 2(Tổng thu nhập - Pay 1)                  | Đợt trả 2 (Tổng thu nhập − Đợt trả 1) | cùng nguồn; trong ngoặc cũng còn “Pay 1”                                                                                            |
| Tip (trong dòng công thức)   | (Mức lương - Phí dọn dẹp + Tip - Phí thẻ Tip) | … + Tiền boa − Phí thẻ Tiền boa       | Dòng công thức của “Tổng thu nhập” dùng “Tip” tiếng Anh trong khi nhãn ngay phía trên đã dịch “Tiền boa” → lệch trong cùng một khối |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                      | Gốc (EN)           | Nên dùng (chuẩn)                        | Vì sao                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thu nhập thực nhận (cột danh sách) | Total Income       | **Tổng thu nhập**                       | Cùng chuỗi EN “Total Income” nhưng cột danh sách dịch “Thu nhập thực nhận”, panel chi tiết dịch “Tổng thu nhập”. Glossary: **Net Income = Thu nhập thực nhận** → cột đang mượn nghĩa của chỉ tiêu khác.                    |
| Tiền boa thanh toán bằng thẻ       | Card Charge Tip    | **Phí thẻ - Tiền boa**                  | **Sai nghĩa**: đây là _phí quẹt thẻ tính trên tiền boa_ (bị trừ ra), không phải “tiền boa trả bằng thẻ”. Chính dòng công thức bên dưới cũng gọi “Phí thẻ Tip”, và khoản tương ứng của hoa hồng đã là “Phí thẻ - Hoa hồng”. |
| Phí khuyến mãi                     | Discount Charge    | **Phí giảm giá**                        | Nhãn dịch “khuyến mãi” nhưng công thức trong cùng panel ghi “Phí giảm giá”; glossary chốt Discount = Giảm giá.                                                                                                             |
| Doanh số                           | Sale               | **Doanh thu**                           | Glossary chốt Sale = **Doanh thu** (VP-2268/2259) để đồng bộ 3 màn báo cáo thu nhập; panel này (bảng ngày + khối tổng) đang dùng “Doanh số”.                                                                               |
| Mức lương                          | Salary Amount      | **Số tiền lương (hoặc “Lương kỳ này”)** | Glossary đã gán **Rate = Mức lương** (VP-2267). Dùng lại “Mức lương” cho Salary Amount làm 2 chỉ tiêu khác nhau trùng tên khi đối chiếu Staff Income.                                                                      |
| Tổng thu nhập (thẻ tổng đầu trang) | Total staff income | **Tổng thu nhập nhân viên**             | Bỏ mất “nhân viên” nên trùng y nguyên nhãn “Tổng thu nhập” trong panel chi tiết — 2 con số khác nhau, cùng một tên.                                                                                                        |
| Đơn (cột danh sách)                | Orders             | **Đơn hàng**                            | Thẻ tổng ngay trên đã dùng “Tổng đơn hàng” → nên đồng bộ.                                                                                                                                                                  |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang, không cắt chữ (`xOverflow 0`, `clipped 0`) ở cả danh sách và 2 dạng panel chi tiết. Chỉ có lỗi **typography**: thiếu khoảng trắng trước dấu ngoặc — “Pay 1(Tổng thu nhập x 85%)”, “Phí vật tư(gồm Doanh số & Hoàn tiền)” (bản EN cũng thiếu → sửa cả 2 locale).

### 4. ✅ Đã dịch đúng (mẫu)

- Bảng lương nhân viên (Staff Payroll) · Kỳ hiện tại (20/08/2026 - 20/08/2026)
- Số liệu tạm tính — sẽ cập nhật đến khi chốt kỳ. (Estimated — figures update until the period is closed.)
- Số ngày làm / Số giờ làm (Working Days / Working Hours) · Ngày làm việc: 0 ngày
- Phí vật tư (Supply Fee) · Hoa hồng nhân viên (Staff Commission) · Phí thẻ - Hoa hồng (Card Charge Commission)
- Phí dọn dẹp/Khấu trừ (Clean Up Fee/Deduction) · Hoàn tiền (Refund) · Tạm tính (Subtotal)
- In (Print) · Chọn nhân viên để xem chi tiết thu nhập hoặc in báo cáo. · Cảm ơn, TestSalary!

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất `GLOSSARY`:** `Pay 1: ['Đợt trả 1']`, `Pay 2: ['Đợt trả 2']`, `Card Charge Tip: ['Phí thẻ - Tiền boa']`, `Card Charge Commission: ['Phí thẻ - Hoa hồng']`, `Discount Charge: ['Phí giảm giá']`, `Total Income: ['Tổng thu nhập']`, `Salary Amount: ['Số tiền lương']`, `Supply Fee: ['Phí vật tư']`, `Clean Up Fee: ['Phí dọn dẹp']`, `Staff Commission: ['Hoa hồng nhân viên']`.
- Panel chi tiết **không** với tới được bằng scan theo route (phải click 1 hàng) → các lỗi nặng nhất (Pay 1/2, Card Charge Tip) chỉ lộ ra ở lượt quét MCP. Muốn tự động hoá cần deep-scan riêng giống `TC-i18n-incomes`.
- Chuỗi “Tip” trong công thức nằm ở app repo `staff-payroll-detail-*.tsx` — phải thay bằng key đã dịch, không ghép cứng.

### 6. Nguồn tham chiếu

- JSON: `reports/staff-payroll/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `staff-payroll`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
