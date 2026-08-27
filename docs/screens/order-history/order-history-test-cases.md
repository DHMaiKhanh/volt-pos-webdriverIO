---
title: Lịch sử đơn hàng (/order-history) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /order-history
scanned-at: 2026-07-06
consolidates: feature-spec + test cases + i18n (coverage + meaning)
excludes: docs/codegen-flow/order-history-flow.md · docs/codegen-detail/order-history-detail.md (giữ riêng)
---

# Lịch sử đơn hàng (`/order-history`) — Tài liệu hợp nhất

> MỘT file duy nhất: gộp đặc tả tính năng + test case + kết quả quét Tiếng Việt (còn tiếng Anh + dịch đúng chuẩn). Kết quả trực quan: reports/order-history/order-history.html. Luồng code-gen giữ riêng: codegen-flow/order-history-flow.md · codegen-detail/order-history-detail.md.

# PHẦN A — Đặc tả tính năng

> Nguồn: business rules offline trên Linear (`portal-order-history.md`) + **quét màn hình thật** bằng Playwright MCP trên app POS đang chạy (2026-07-06, đơn `#OD260701-12504800`). Linear mô tả _Portal_ Order History nhưng theo **POS Parity Notes §14**, data shape & điều kiện hành động (refund/cancel/reopen/tip) là **giống hệt** giữa POS và Portal — nên các business rule ở đây áp dụng cho cả màn POS `/order-history`.

## A1. Mục tiêu & phạm vi

Màn hình cho phép nhân viên/chủ tiệm **tra cứu lại các đơn đã xử lý** (loại trừ đơn
`pending`), xem **chi tiết đơn**, và thực hiện **hành động sau thanh toán** tuỳ trạng thái:
hoá đơn, hoàn tiền, huỷ/void, mở lại đơn, chỉnh tip, gửi hoá đơn. Phạm vi gồm:

- Trang danh sách `/order-history` (thanh lọc + danh sách đơn theo ngày).
- Trang chi tiết `/order-history/<orderId>` (panel phải).
- Các popup/dialog: **DatePicker** (lịch), **Bộ lọc** (+4 dropdown con), **Hoá đơn**
  (receipt preview + In/SMS/Email), **Hoàn tiền**, **Huỷ đơn**, **Chỉnh tip**, **Mở lại đơn**.

## A2. Các luồng chính (từ Linear)

- **Danh sách & lọc (§8):** mặc định ẩn đơn `pending`, sort mới nhất theo ngày tạo,
  20 đơn/trang. Lọc theo: mã đơn (partial, case-insensitive), khách (tên/SĐT/email),
  location, trạng thái (multi-select, Settled/Unsettled tách riêng), phương thức TT,
  nhân viên, khoảng ngày (Hôm nay / Hôm qua / 7 ngày / 30 ngày / Tháng này / tuỳ chọn).
- **Settled vs Unsettled (§2):** cờ `settled` quyết định nút nào hiện — ràng buộc của
  payment processor, không chỉ là luật nghiệp vụ.
- **Vòng đời trạng thái (§3):** `pending → successful`; unsettled → `canceling`/`re_open`;
  settled → `refunding`; các nhánh `canceled`/`cancel_issue`/`refunded`/`partial_refunded`/
  `refund_issue`. Khi đang `refunding`/`canceling` → **chặn mọi hành động** (transitional).
- **Hành động (§4):** Full/Partial Refund, Cancel/Void, Reopen, Adjust Tip, Send Receipt,
  Export — mỗi hành động có bộ điều kiện riêng (xem A4).

## A3. Thành phần UI thực tế (quét bằng Playwright MCP, 2026-07-06)

| Thành phần                | Vai trò                                                                     | Trạng thái                     | Ghi chú                                                                    |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Header (banner)           | Sidebar · Đơn chờ · Order History · Appointment · Scanner · Search · 3 icon | Hiện                           | Dùng chung layout với Home                                                 |
| Nút **DatePicker**        | Mở popover lịch 2 tháng, chọn khoảng ngày                                   | Hiện                           | Nhãn `06/28/2026 - 07/05/2026`, aria `icon-calendar`                       |
| Nút **Filter**            | Mở dialog Bộ lọc                                                            | Hiện                           | 4 nhóm: Sort / Nhân viên / Phương thức TT / Trạng thái                     |
| Ô **Search**              | Tìm mã đơn / tên khách / SĐT                                                | Hiện                           | placeholder "Search order ID, customer name or phone"                      |
| **Danh sách đơn** (trái)  | Tiêu đề ngày (`Jul 1, 2026`) + thẻ đơn                                      | Hiện                           | Thẻ: mã · trạng thái · khách/SĐT · phương thức TT · tiền · nhân viên · giờ |
| **Panel rỗng**            | Khi chưa chọn đơn                                                           | Hiện                           | "Select an order to view details."                                         |
| **Panel chi tiết** (phải) | Khi chọn 1 đơn                                                              | Hiện                           | Header `Order #OD…` + nút hành động theo trạng thái                        |
| → **Order Information**   | Status · Order ID · Cashier · Order Date · Customer · Phone                 | Hiện                           |                                                                            |
| → **Order Summary**       | Subtotal · Total Discount · Tax · Tip · Total                               | Hiện                           |                                                                            |
| → **Service Details**     | Staff + dòng dịch vụ (service-name / price) + "Last updated"                | Hiện                           |                                                                            |
| → **Tip**                 | Danh sách chia tip theo nhân viên (`Andy - $20.00`)                         | Hiện                           | Ẩn nếu không có tip                                                        |
| → **Payment Details**     | Dòng thanh toán (Cash/Card) + "Got: $X (Change… - Tip…)"                    | Hiện                           |                                                                            |
| → **Order Note**          | Ghi chú đơn                                                                 | Hiện                           | "No note for this order." nếu trống                                        |
| Nút **Receipt**           | Mở dialog Hoá đơn (In / SMS / Email)                                        | Hiện (mọi trạng thái)          | tái dùng receipt-preview của /settings/receipt                             |
| Nút **Refund**            | Mở dialog Hoàn tiền                                                         | Chỉ khi settled + đủ điều kiện |                                                                            |

### A3a. Bộ nút hành động theo TRẠNG THÁI (xác minh live)

| Trạng thái đơn             | Nút hiển thị                                 |
| -------------------------- | -------------------------------------------- |
| Successful - **Unsettled** | Adjust Tip · Receipt · Reopen Order · Cancel |
| Successful - **Settled**   | Receipt · Refund                             |
| **Canceled**               | Receipt                                      |
| **Refunded**               | Receipt                                      |

## A4. Nghiệp vụ & ràng buộc (từ Linear §4)

- **Full Refund:** settled=true; status `successful`/`partial_refunded`; có ≥1 payment không phải gift-card; không transitional; quyền `refund`. Cần **Reason**. → `refunding` → `refunded`/`refund_issue` (không auto-retry).
- **Partial Refund:** settled=true; transaction còn remaining balance > 0; nếu card thì batch đã đóng; amount ≤ remaining; quyền `refund`. Reason **optional**.
- **Cancel/Void:** settled=false; status `successful`/`pending`/`partial_refunded`/`cancel_issue`; quyền `cancel_order_void`. Cần **Reason**. → `canceling` → `canceled`/`cancel_issue` (có thể retry từ portal).
- **Reopen:** settled=false; status `successful`/`re_open`; quyền `edit_order`. Nếu đang `re_open` → nhãn "Continue Re-open".
- **Adjust Tip:** settled=false; status `successful`; tip timing = `AFTER_PAYMENT`; có ≥1 staff; quyền `adjust_tip`.
- **Send Receipt:** mọi trạng thái; quyền `view_orders`; validate email/phone (10+ digits).
- **Export:** quyền `export_orders`; theo filter hiện tại; format csv/pdf.
- **Money (§12):** mọi số tiền lưu integer cents, hiển thị qua `money()`.
- **Reasons (§5):** Customer Request / Service Issue / Incorrect Order / Duplicate Payment / Promotion-Discount Error / Staff Mistake / Other.

## A5. Trạng thái / quyền / edge case

- **Quyền:** thiếu quyền → nút hành động **bị ẩn** (không disable). Ma trận quyền §6 Linear.
- **Transitional blocking:** `refunding`/`canceling` → chặn tất cả hành động.
- **Multi-location (§7):** mặc định xem mọi đơn trong các location được cấp; đơn thuộc location không có quyền → coi như not found.
- **Issue status (§9):** `cancel_issue` retry được từ portal; `refund_issue` phải xử lý thủ công.
- **Edge cột hiển thị:** khách/SĐT có thể là `-`; SĐT ẩn dạng `***-***-2052`; phương thức TT có thể ghép "Card, Cash".
- ⚠️ **Cảnh báo tự động hoá:** dialog Huỷ đơn có nút "Confirm Cancel" — khi đóng dialog tuyệt đối **không** bấm nút xác nhận, chỉ Escape / "Keep Order", tránh huỷ đơn thật.

## A6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

- **Khớp:** cấu trúc list + filter + detail panel + bộ nút theo settled/status đúng như
  ma trận eligibility §15 Linear. Các trạng thái quan sát live (Settled/Unsettled/Canceled/
  Refunded) và nút tương ứng khớp §4.
- **Lệch / chưa xác minh live:**
  - **Export** (§4.7) và **Location filter** (§7): Linear có nhưng phiên quét POS chưa
    thấy nút Export riêng; dialog Bộ lọc live gồm Sort/Nhân viên/Phương thức TT/Trạng thái
    (chưa thấy Location — có thể do 1 location trong data test).
  - **Audit Log** (§10): Linear mô tả log theo thời gian trong order detail — chưa thấy
    section audit log trên panel chi tiết POS (có thể là tính năng riêng của Portal).
  - **i18n:** một số chuỗi còn tiếng Anh khi bật Tiếng Việt (lịch, phương thức TT ở thẻ đơn,
    vài nhãn hoá đơn) — chi tiết ở [order-history-translation-map.md](../order-history/order-history-code-detail.md 'i18n Notes section'), là đầu vào cho Skill i18n-vietnamese-scan.

# PHẦN B — Quét Tiếng Việt (i18n)

> Đầu ra **Skill i18n-vietnamese-scan** cho màn `/order-history`. Cơ chế: quét **1 lần EN + 1 lần VI**,
> ghép theo đường dẫn DOM, phân loại bằng `GLOSSARY` POS ([src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts)).
> Chạy chỉ-báo-cáo (`I18N_LENIENT=1`). Bản đồ chi tiết vùng: [order-history-translation-map.md](../order-history/order-history-code-detail.md 'i18n Notes section').

## B0. Tổng quan (số liệu từ i18n-result.md / compare.json)

> tổng **21** chuỗi bắt được · ❌ chưa dịch (text hiển thị) **0** · ⚠️ sai chuẩn **0** · ✅ đúng chuẩn **10** · 🔤 data/format **1** · 📐 UI vỡ: tràn ngang **0px**, cắt chữ **1** ("Bộ lọc")
> Report trực quan (tự-chứa): `reports/order-history/compare.html`

**Kết luận:** phần **text hiển thị** của trang chính Lịch sử đơn hàng đã dịch **sạch & đúng chuẩn** —
không còn chuỗi tiếng Anh, không có bản dịch sai thuật ngữ. Các mục còn lại là **định dạng ngày (locale)**
và **nhãn a11y (aria-label)** — nhóm report-only, không tính là fail cổng dịch.

## B1. ❌ Còn tiếng Anh (nhãn UI thật)

**Không có.** Mọi nhãn/label/placeholder nhìn thấy đã sang Tiếng Việt.

> ⚠️ Hai nhóm borderline dưới đây `detectScope` phân loại `missing` nhưng **không phải text UI thường**:

### B1a. 🔤 Định dạng ngày còn kiểu Anh (locale) — lỗi thật, nhưng là format

| Đang hiển thị                                                                      | Nên là                             | Nguồn (data-tsd-source)                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `Jul 6, 2026` · `Jul 2, 2026` · `Jul 1, 2026` · `Jun 30, 2026` (tiêu đề nhóm ngày) | `06 Th7, 2026` / định dạng ngày VI | `order-history/-order-history-list/order-history-list.tsx:128` |

> Khớp với [order-history-translation-map.md](../order-history/order-history-code-detail.md 'i18n Notes section') §3: lưới lịch + tiêu đề ngày
> chưa set `locale` Tiếng Việt (react-day-picker / hàm format ngày). Sửa: truyền locale `vi` cho bộ format ngày.

### B1b. 🔇 aria-label icon còn tiếng Anh (a11y, report-only)

| aria-label (EN)       | Vị trí           | Nguồn                                                          |
| --------------------- | ---------------- | -------------------------------------------------------------- |
| `Open sidebar`        | nút mở sidebar   | `components/ui/button.tsx:92`                                  |
| `Open pending orders` | nút Đơn đang chờ | `components/ui/button.tsx:92`                                  |
| `icon-calendar`       | nút mở lịch      | `components/icon.tsx:64` (Icon lấy tên icon làm aria mặc định) |
| `Search...`           | icon ô tìm kiếm  | `components/icon.tsx:64`                                       |

> Không có chữ hiển thị nhưng screen-reader đọc tiếng Anh → nên thêm `aria-label` đã dịch. Không làm fail cổng.
> **Bỏ qua (không phải app):** `Notifications alt+T` (region toast của thư viện Sonner) · `Open TanStack Devtools` (công cụ dev).

## B2. ⚠️ Dịch chưa đúng chuẩn

**Không có.** Không có chuỗi nào dịch lệch thuật ngữ glossary.

## B3. ✅ Đã dịch đúng (mẫu — 10/10)

| EN                                                    | VI (đang hiển thị)                           | Nguồn                                             |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Pending Orders                                        | **Đơn đang chờ**                             | ui/button.tsx:92                                  |
| Order History (menu + tiêu đề)                        | **Lịch sử đơn hàng**                         | header-menu.tsx:43 · order-history-header.tsx:101 |
| Appointment                                           | **Lịch hẹn**                                 | header-menu.tsx:74                                |
| Scanner                                               | **Quét mã**                                  | ui/button.tsx:92                                  |
| Internet connection restored.                         | **Đã kết nối internet trở lại.**             | online-status-notification.tsx:304                |
| Filter                                                | **Bộ lọc**                                   | order-history-header.tsx:145                      |
| Select an order to view details.                      | **Chọn một đơn hàng để xem chi tiết.**       | order-history/index.tsx:26                        |
| [placeholder] Search...                               | **Tìm kiếm...**                              | ui/input.tsx:176                                  |
| [placeholder] Search order ID, customer name or phone | **Tìm mã đơn hàng, tên khách hàng hoặc SĐT** | input-original.tsx:44                             |

## B4. 📐 UI vỡ (chỉ báo cáo)

- **Tràn ngang:** 0px (không có).
- **Cắt chữ (clipped): 1** → nhãn nút **"Bộ lọc"** (nút Filter). Tiếng Việt "Bộ lọc" (6 ký tự có dấu) dài
  hơn "Filter" → text bị cắt trong khung nút cố định.
  - **Đề xuất:** nới `min-width`/bỏ `truncate` cho nút Filter ở
    `order-history/-order-history-list/order-history-header.tsx:145`, hoặc giảm padding icon.

### Ghi chú / đề xuất bổ sung glossary

- Trang chính `/order-history` **đạt chuẩn dịch** cho text hiển thị. Việc còn lại thuộc dev:
  (1) **format ngày theo locale `vi`** (B1a), (2) **dịch aria-label** icon (B1b), (3) **fix cắt chữ "Bộ lọc"** (B4).
- Scan này phủ **trang chính**; các dialog phụ thuộc đơn (Hoá đơn / Hoàn tiền / Huỷ / Chỉnh tip) và lưới lịch
  đã được ghi nhận riêng trong [order-history-translation-map.md](../order-history/order-history-code-detail.md 'i18n Notes section') §1c-1e, §2, §3
  (gồm vài chuỗi hardcode trong dialog Hoá đơn dùng chung với `/settings/receipt`).
- Chưa cần bổ sung `GLOSSARY` — các thuật ngữ của màn (Filter/Pending Orders/Order History…) đã có và khớp.

# PHẦN C — Test cases

> Nguồn: feature spec (Phần A) + business rules Linear + quét live bằng Playwright MCP (2026-07-06).
>
> ⚠️ **An toàn dữ liệu:** app chạy 1 worker, **chia sẻ state backend thật**. Các hành động
> **phá huỷ** (xác nhận Huỷ đơn / Hoàn tiền / Chỉnh tip / Mở lại) **KHÔNG** được auto-confirm.
> Test chỉ **mở dialog rồi đóng an toàn** (Escape / nút "Keep Order"/"Close"), tuyệt đối không
> bấm nút chứa "Confirm". Kịch bản confirm-thật được ghi lại (P?) nhưng để chạy thủ công/cluster riêng.

## Bảng test case

| ID       | Tiêu đề                                           | Tiền điều kiện                | Các bước                                                                     | Kết quả mong đợi                                                                                           | Loại       | Ưu tiên |
| -------- | ------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| TC-OH-01 | Trang tải & thanh công cụ                         | Đã đăng nhập                  | 1. Vào `/order-history`                                                      | Header "Order History", nút DatePicker (dải ngày), nút "Filter", ô Search đều hiển thị                     | e2e        | P1      |
| TC-OH-02 | Danh sách đơn render theo ngày                    | Có đơn trong khoảng ngày      | 1. Vào trang 2. Xem cột trái                                                 | Có ≥1 tiêu đề ngày (vd "Jul 1, 2026") và ≥1 thẻ đơn; thẻ chứa mã `OD…`, trạng thái, tiền `$…`, tên NV, giờ | e2e        | P1      |
| TC-OH-03 | Empty state panel chi tiết                        | Chưa chọn đơn                 | 1. Vào trang, không click đơn                                                | Panel phải hiển thị "Select an order to view details."                                                     | e2e        | P2      |
| TC-OH-04 | Mở chi tiết đơn                                   | Có ≥1 đơn                     | 1. Click thẻ đơn đầu                                                         | URL đổi thành `/order-history/<id>`; nút "Receipt" hiển thị                                                | e2e        | P1      |
| TC-OH-05 | Section Order Information                         | Đã mở 1 đơn                   | 1. Mở đơn 2. Xem panel                                                       | Hiển thị "Order Information" + nhãn Status, Order ID, Cashier, Order Date, Customer, Phone                 | e2e        | P1      |
| TC-OH-06 | Section Order Summary                             | Đã mở 1 đơn                   | 1. Mở đơn                                                                    | Hiển thị "Order Summary" + Subtotal, Total Discount, Tax, Tip, Total (mỗi dòng có giá `$…`)                | e2e        | P1      |
| TC-OH-07 | Các section còn lại                               | Đã mở 1 đơn                   | 1. Mở đơn                                                                    | Hiển thị "Service Details", "Payment Details", "Order Note"                                                | e2e        | P2      |
| TC-OH-08 | Nút hành động — đơn Settled                       | Có đơn "Successful - Settled" | 1. Mở đơn settled                                                            | Hiển thị nút "Receipt" và "Refund"                                                                         | e2e        | P1      |
| TC-OH-09 | Nút hành động — đơn đã đóng (Canceled/Refunded)   | Có đơn Canceled hoặc Refunded | 1. Mở đơn đó                                                                 | Chỉ có "Receipt"; KHÔNG có "Refund"/"Cancel Order"                                                         | e2e        | P2      |
| TC-OH-10 | Search theo mã đơn (partial)                      | Biết 1 mã đơn hiển thị        | 1. Gõ 1 phần mã vào Search                                                   | Danh sách chỉ còn (các) đơn khớp; đơn đã gõ vẫn hiện                                                       | e2e        | P1      |
| TC-OH-11 | Search không khớp                                 | —                             | 1. Gõ chuỗi rác "ZZZNOMATCH999"                                              | Danh sách rỗng (không thẻ đơn nào)                                                                         | e2e        | P2      |
| TC-OH-12 | Dialog Filter mở & có đủ nhóm                     | —                             | 1. Click "Filter"                                                            | Dialog mở, có nhóm Sort by / Staff / Payment method / Status                                               | e2e        | P1      |
| TC-OH-13 | Filter — options Payment method                   | Dialog Filter mở              | 1. Mở nhóm Payment method                                                    | Có Card, Cash, Gift Card, Other                                                                            | e2e        | P2      |
| TC-OH-14 | Filter — options Status                           | Dialog Filter mở              | 1. Mở nhóm Status                                                            | Có Successful-Unsettled, Successful-Settled, Canceled, … (Settled/Unsettled tách riêng)                    | e2e        | P2      |
| TC-OH-15 | Filter — Clear/Confirm & đóng an toàn             | Dialog Filter mở              | 1. Thấy nút Clear + Confirm 2. Đóng dialog (Escape)                          | Có 2 nút; dialog đóng, không thay đổi dữ liệu                                                              | e2e        | P2      |
| TC-OH-16 | DatePicker mở lịch 2 tháng                        | —                             | 1. Click nút dải ngày                                                        | Popover lịch mở, có nút Today / Cancel / Apply                                                             | e2e        | P2      |
| TC-OH-17 | Dialog Receipt mở & đóng an toàn                  | Đã mở 1 đơn                   | 1. Mở đơn 2. Click "Receipt" 3. Đóng                                         | Dialog Hoá đơn mở (In / SMS / Email); đóng được, không mất state                                           | e2e        | P2      |
| TC-OH-18 | Dialog Refund mở rồi HUỶ (không confirm)          | Có đơn Settled                | 1. Mở đơn settled 2. Click "Refund" 3. Đóng bằng "Cancel"/Escape             | Dialog Hoàn tiền mở; đóng an toàn KHÔNG thực hiện hoàn tiền                                                | e2e        | P1      |
| TC-OH-19 | Dialog Cancel/Void mở rồi GIỮ đơn (không confirm) | Có đơn Unsettled              | 1. Mở đơn unsettled 2. Click "Cancel Order" 3. Đóng bằng "Keep Order"/Escape | Dialog Huỷ mở; đóng an toàn, đơn KHÔNG bị huỷ                                                              | e2e        | P1      |
| TC-OH-20 | Mặc định loại trừ đơn Pending                     | —                             | 1. Vào trang, xem list                                                       | Không có thẻ đơn trạng thái "Pending"                                                                      | e2e        | P2      |
| TC-OH-21 | i18n (tham chiếu chéo)                            | —                             | Xem skill i18n-vietnamese-scan                                               | Không còn chuỗi EN giữa UI Tiếng Việt (báo cáo riêng)                                                      | regression | P2      |

### Ghi chú map code

- Mỗi TC ánh xạ 1-1 sang một `test(...)` trong spec (trừ TC-OH-21 thuộc bộ i18n riêng).
- TC status-dependent (08/09/18/19) dùng `test.skip(...)` khi không có đơn đúng trạng thái trong data hiện tại.

## Nguồn tham chiếu

- Spec/glossary: [docs/i18n/order-history-translation-map.md](../order-history/order-history-code-detail.md 'i18n Notes section') (giữ riêng)
- Luồng code-gen (tách riêng): [codegen-flow/order-history-flow.md](../order-history/order-history-code-detail.md) · [codegen-detail/order-history-detail.md](../order-history/order-history-code-detail.md)
- Test i18n hiện có: [tests/regression/i18n/TC-i18n-order-history-vietnamese-scan.spec.ts](../../tests/regression/i18n/TC-i18n-order-history-vietnamese-scan.spec.ts)
- Linear (offline): [docs/linear/portal-order-history.md](../linear/portal-order-history.md)
- Test/helper + dữ liệu thô JSON: `reports/order-history/compare.json` (renderer `renderCompareReport()` trong [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts))
- Lệnh chạy lại i18n: `cross-env ENV=local I18N_SCREEN=order-history I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry`
