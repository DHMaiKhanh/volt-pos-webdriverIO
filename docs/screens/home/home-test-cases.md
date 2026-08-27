---
title: Home (/home) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /home
source-linear: 'offline: docs/linear/main-flow-onboard.md'
scanned-at: 2026-07-06
scanned-by: playwright (TC-i18n-home-vietnamese-scan + TC-i18n-screen-compare) trên app live localhost:1420
consolidates: feature-spec (skill 1) + test cases (skill 2) + i18n coverage + i18n meaning (skill 5)
excludes: docs/codegen-flow/home-flow.md · docs/codegen-detail/home-detail.md (giữ riêng theo yêu cầu)
---

# Home (`/home`) — Tài liệu hợp nhất

> **MỘT file duy nhất** cho màn Home: gộp **đặc tả tính năng** + **test case** + **kết quả quét
> Tiếng Việt** — cả _"quét tiếng Việt"_ (còn tiếng Anh không) lẫn _"quét nghĩa"_ (dịch đúng
> chuẩn chưa). Kết quả trực quan: **1 file** `reports/home/home.html`.
> Luồng code-gen được giữ **tách riêng**: [codegen-flow/home-flow.md](../home/home-code-detail.md) ·
> [codegen-detail/home-detail.md](../home/home-code-detail.md).

---

# PHẦN A — Đặc tả tính năng

## A1. Mục tiêu & phạm vi

Chuyển app sang **Tiếng Việt**, đi hết các bề mặt (surface) của màn Home và liệt kê **chính xác
chỗ nào còn tiếng Anh** + **dịch đã đúng chuẩn chưa**. Phạm vi Home: trang `/home`, các popup
**không cần đơn**, các dialog **cần đơn** (Ghi chú / Khuyến mãi / Gộp đơn / Đổi nhân viên / toast In),
và 3 **panel header** (Thông báo 🔔 / Chấm công / Thiết bị).

## A2. Các luồng chính

- Đổi ngôn ngữ **một lần** qua UI (`/settings/language` → "Tiếng Việt").
- App **không lưu ngôn ngữ qua reload** (bug đã biết) → điều hướng **client-side** bằng TanStack
  Router (`window.__TSR_ROUTER__.navigate`), **không** `page.goto` giữa chừng.
- Tạo **một đơn** (chọn nhân viên đầu + 1 dịch vụ) để mở nhóm dialog phụ thuộc đơn.

## A3. Thành phần UI thực tế (quét Playwright)

| Surface                                                        | Vai trò                                                         | Trạng thái VN    | Ghi chú                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `/home` (trang chính)                                          | Header, sidebar đơn chờ, cột Staff/Khách/Dịch vụ, Order summary | ⚠️ **CÒN EN**    | `Quick Pay`, `Gift Card`, `Additional Services`, `Basic Services` |
| Popup **Bán thẻ quà tặng**                                     | Mở không cần đơn                                                | ✅ VN            |                                                                   |
| Popup **Chọn nhân viên trước** (Quick Pay khi chưa chọn staff) | Cảnh báo                                                        | ✅ VN            |                                                                   |
| Popup **Tìm kiếm toàn cục** (Ctrl+K)                           | Search                                                          | ✅ VN            | 4 tab All/Appointment/Customer/Order cần kiểm lại                 |
| Popup **Quét mã** (Scanner)                                    | Camera                                                          | ✅ VN            | thường không mở trong CI                                          |
| Dialog **Ghi chú đơn**                                         | Cần đơn                                                         | ✅ VN            |                                                                   |
| Dialog **Khuyến mãi & Thưởng**                                 | Cần đơn                                                         | ⚠️ **sai chuẩn** | hiển thị "Khuyến mãi & Phần thưởng"                               |
| Dialog **Gộp đơn**                                             | Cần đơn                                                         | ✅ VN            | rò giá trị fallback `Unknown`                                     |
| Panel **Chấm công**                                            | Header                                                          | ✅ VN            |                                                                   |
| Panel **Thông báo** (🔔)                                       | Header                                                          | ⚠️ **CÒN EN**    | dòng `"<Tên> appointment on <ngày> has been confirmed."`          |

---

# PHẦN B — Quét Tiếng Việt (i18n)

> Quét **1 lần EN + 1 lần VI**, ghép theo đường dẫn DOM, đối chiếu **glossary POS**
> ([`src/utils/i18nCompare.ts`](../../src/utils/i18nCompare.ts)). Dữ liệu (tên dịch vụ/nhân
> viên/đơn) đã lọc bỏ khỏi cổng lỗi.

## B0. Tổng quan (2026-07-06)

> ❌ chưa dịch (nhãn UI thật) **4** · ⚠️ sai chuẩn **1** · ✅ thuật ngữ đúng **59** · 📐 UI vỡ thật **0**
> (compare thô: missing 14 gồm 10 chuỗi là **data mẫu** — xem B1b.)

## B1. ❌ Còn tiếng Anh — NHÃN UI THẬT (quét tiếng Việt)

| Chuỗi (EN)            | Đang hiển thị                                   | Nên dịch             | Ghi chú                                                                              |
| --------------------- | ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `Quick Pay`           | Quick Pay                                       | **Thanh toán nhanh** | Nút cột dịch vụ, chưa `t()`. "Quick Checkout" cạnh đó đã dịch đúng.                  |
| `Gift Card`           | Gift Card                                       | **Thẻ quà tặng**     | Nút mở dialog Bán thẻ quà tặng.                                                      |
| `Additional Services` | Additional Services                             | **Dịch vụ bổ sung**  | Nhãn nhóm dịch vụ.                                                                   |
| `Basic Services`      | Basic Services                                  | **Dịch vụ cơ bản**   | Nhãn nhóm dịch vụ.                                                                   |
| `Unknown`             | Unknown                                         | _(fallback)_         | Giá trị fallback thẻ Gộp đơn → xử lý tầng dữ liệu ("Không rõ"), không phải key i18n. |
| Panel 🔔              | `... appointment on <ngày> has been confirmed.` | (cần dịch)           | Thông báo lịch hẹn hardcode EN — deep-scan bắt.                                      |

### B1b. Data mẫu leak (KHÔNG phải lỗi dịch — bỏ qua)

`Gift Card [****-****-2060]`, `pedicure today`, `Test today`, `Product 2`, `Category 2`,
`APITest Service …`, `APITest Product …`, `Spa Service`, `service 1` — là **tên dịch
vụ/sản phẩm/danh mục mẫu** (merchant data), không đưa vào cổng lỗi.

## B2. ⚠️ Dịch chưa đúng chuẩn (quét nghĩa)

| Hiện tại (VI)            | Gốc (EN)          | Nên dùng (chuẩn)        | Vì sao                                                    |
| ------------------------ | ----------------- | ----------------------- | --------------------------------------------------------- |
| Khuyến mãi & Phần thưởng | `Promo & Rewards` | **Khuyến mãi & Thưởng** | Glossary chuẩn hoá "Rewards"→"Thưởng" cho gọn, nhất quán. |

## B3. ✅ Đã dịch đúng chuẩn (mẫu)

| EN             | VI               |
| -------------- | ---------------- |
| Pending Orders | Đơn đang chờ     |
| Order History  | Lịch sử đơn hàng |
| Appointment    | Lịch hẹn         |
| Scanner        | Quét mã          |
| Quick Checkout | Thanh toán nhanh |
| Done           | Hoàn tất         |
| Show           | Hiện             |

## B4. 📐 Vỡ giao diện (chỉ báo cáo)

- Tràn ngang toàn màn: `0px` → không vỡ.
- Cắt chữ (ellipsis): chỉ ở **tên dịch vụ / mã đơn** (`OD260707-…`, tên khách) — cắt có chủ đích, không phải lỗi layout.

---

# PHẦN C — Test cases

> Mỗi TC map 1-1 sang code trong spec Home. Code đã tồn tại — thêm TC mới thì thêm `test()`
> theo convention `@fixtures/index` + `Tag`.

| ID            | Tiêu đề                             | Tiền điều kiện      | Kết quả mong đợi                         | Code                               |
| ------------- | ----------------------------------- | ------------------- | ---------------------------------------- | ---------------------------------- |
| TC-HOME-VI-01 | Đổi ngôn ngữ sang Tiếng Việt qua UI | Đã đăng nhập        | Sidebar "Đơn đang chờ" (VN)              | `switchToVietnamese()`             |
| TC-HOME-VI-02 | Router client-side khả dụng         | Đã đổi VN           | `window.__TSR_ROUTER__` là object        | `expect(hasRouter).toBe(true)`     |
| TC-HOME-VI-03 | Quét `/home` còn chuỗi EN           | VN + router         | Liệt kê chuỗi EN (Quick Pay, Gift Card…) | `scanRoute + record`               |
| TC-HOME-VI-04 | Quét popup Bán thẻ quà tặng         | VN, không cần đơn   | Popup VN                                 | `HOME_POPUP_DEFS[0]`               |
| TC-HOME-VI-05 | Cảnh báo "Chọn nhân viên trước"     | VN, chưa chọn staff | Dialog cảnh báo VN                       | `HOME_POPUP_DEFS[1]`               |
| TC-HOME-VI-06 | Tìm kiếm toàn cục (Ctrl+K)          | VN                  | Dialog search VN                         | `HOME_POPUP_DEFS[2]`               |
| TC-HOME-VI-07 | Scanner (best-effort)               | VN, có camera       | VN (skip nếu không camera)               | `HOME_POPUP_DEFS[3]`               |
| TC-HOME-VI-08 | Dialog phụ thuộc đơn                | VN, tạo được đơn    | Ghi chú/Khuyến mãi/Gộp đơn VN            | `scanHomeOrderDialogs()`           |
| TC-HOME-VI-09 | Dialog Đổi nhân viên                | VN, đơn có staff    | Dialog xác nhận VN                       | `scanHomeOrderDialogs §3b`         |
| TC-HOME-VI-10 | Toast nút In                        | VN, đơn có dịch vụ  | Toast VN                                 | `scanHomeOrderDialogs §4`          |
| TC-HOME-VI-11 | 3 panel header                      | VN                  | Panel VN (🔔 còn EN)                     | `scanHeaderPanels()`               |
| TC-HOME-VI-12 | Sinh báo cáo                        | Đã quét             | File scan tồn tại                        | `renderI18nReport + writeFileSync` |
| TC-HOME-VI-13 | Cổng localization (soft gate)       | `I18N_LENIENT≠1`    | Fail nếu còn EN; lenient → info          | vòng `expect.soft` cuối spec       |

---

## Nguồn tham chiếu

- **Spec quét / glossary màn Home:** [docs/i18n/home-translation-map.md](../home/home-code-detail.md 'i18n Notes section') (giữ riêng — hạ tầng scanner dùng chung).
- **Luồng code-gen (tách riêng):** [codegen-flow/home-flow.md](../home/home-code-detail.md) · [codegen-detail/home-detail.md](../home/home-code-detail.md).
- **Test / helper:** [TC-i18n-home-vietnamese-scan.spec.ts](../../tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts) · [i18nHome.ts](../../src/utils/i18nHome.ts) · [i18nScan.ts](../../src/utils/i18nScan.ts) · [i18nCompare.ts](../../src/utils/i18nCompare.ts)
- **Dữ liệu quét thô:** `reports/home/compare.json` (meaning) · `reports/home/home-scan.json` (coverage/suite).
