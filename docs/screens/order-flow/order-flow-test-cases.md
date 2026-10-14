---
title: Order Flow (POS Home screen) — Tài liệu hợp nhất (tính năng + test case)
route: /home, /order/:id/checkout, /order-pending, /order-history
source-linear: https://linear.app/fastboy/document/order-flow-1bd212f296da
consolidates: feature-spec + feature inventory + test cases (TC-01..81) + nhật ký quét live + code detail (flow map + page object/spec/fixture)
scanned-at: 2026-07-15 (Playwright MCP), 2026-09-07 (raw CDP)
scanned-by: playwright-mcp · webdriverio-attach (CDP 9222 / msedgedriver) · raw-CDP-attach (WebView2 CDP 9222)
verified-at: 2026-09-02, 2026-09-03 (WebdriverIO attach — merchant 20258, app v1.0.47), 2026-09-07 (raw CDP — Edge 152 / WebView2 / Tauri v2)
cross-referenced: docs/linear/order-management.md, docs/linear/order-pending.md, docs/linear/split-order.md, docs/linear/portal-order-history.md, docs/linear/portal-support-edit-completed-order.md
---

# Order Flow (POS Home screen) — Tài liệu hợp nhất

> **MỘT file duy nhất:** gộp đặc tả tính năng + feature inventory + toàn bộ test case (TC-01..81)
>
> - nhật ký quét live (2026-09-02, 09-03, 09-07) + code detail (flow map + page object/spec/fixture).
>   Trước đây tách làm 3 file (`order-flow-test-cases.md` + `order-flow-scan-2026-09-07.md`
> - `order-flow-code-detail.md`), nay hợp nhất tất cả về đây.
>
> **Chú thích trạng thái:** ✅ = đã quét live khớp · ⚠️ = có drift/điều kiện · 🧱 = chưa quét được
> (cần order settled / dual-screen / terminal thật) · 📄 = từ document (Linear), chưa dựng UI.

# PHẦN A — Đặc tả tính năng

## A1. Mục tiêu & phạm vi

"Order Flow" là tài liệu Linear lớn nhất trong hệ POS, mô tả toàn bộ vòng đời một đơn hàng
tại quầy (POS Home `/home`): từ Header Bar (Appointment, Cash Drawer, Scan, Search, Login),
màn Home (danh sách nhân viên, danh sách dịch vụ, nhập số điện thoại khách, Checkin Today,
Appointment Today), tạo đơn (cart, checkout, các phương thức thanh toán Cash/Card/Gift
Card/Other, Split Tip, Split Order), đến quản lý đơn sau khi tạo (Order History, Order
Detail theo từng status, Adjust Tip, Refund/Partial Refund, Reopen Order, xử lý mất mạng khi
thanh toán) và cuối cùng là module Customer & Order Search.

Phạm vi tài liệu này gồm toàn bộ nội dung 1468 dòng của `docs/linear/order-flow.md`
(đã đọc đầy đủ 2 nửa file) và được đối chiếu chéo với 5 tài liệu liên quan trong
`docs/linear/`: `order-management.md` (view Portal/Admin của cùng dữ liệu order),
`order-pending.md`, `split-order.md`, `portal-order-history.md`,
`portal-support-edit-completed-order.md`. Các màn con Order History / Order Pending đã có
feature-spec riêng (`docs/features/order-history.md`, `docs/features/order-pending.md`) —
tài liệu này tập trung vào phần **Home / tạo đơn / checkout / quản lý order** chưa được
tách riêng.

## A2. Sơ đồ luồng Order

```
Home (/home)
  ├─ Header: Pending Orders · Order History · Appointment · Scanner · Search · (org-chart/clock/bell)
  ├─ Chọn Staff  ──►  tự tạo draft order (Processing, $0.00)      [TC-77]
  │      └─ Chọn Service ──► Cart (nhóm theo staff)
  │              ├─ Promo & Rewards · Note · Merge Order · Edit price/Item Discount   [TC-18..24]
  │              ├─ Split Order (icon cạnh Pay)  ──► /order/:id/split-order            [TC-25..33]
  │              └─ Pay ──► Checkout
  ├─ Quick Pay (tile)   ──► dialog Custom Amount (không cần chọn service)             [TC-13..17]
  ├─ Gift Card (tile)   ──► bán/redeem gift card
  ├─ Enter Customer Phone/Name/Email + keypad                                         [TC-06..10]
  └─ Quick Checkout / Checkin Today / Appointments Today

Checkout (/order/:id/checkout)
  ├─ 4 method: Card / Cash / Gift Card / Other  (amount KHÁC nhau theo method)        [TC-39]
  ├─ Enter Amount (keypad) · Split Tip · Tip · Print · Cash Drawer (khi Cash)         [TC-40..49]
  └─ Complete Payment ──► staff code ──► (dual-screen) customer tip ──► Payment Successful
                                                                                       [TC-50, 76, 80, 81]
Sau thanh toán (Order History /order-history)
  ├─ Order Detail theo status (Unsettled/Settled/Canceled/Refunded/Partial/Reopen)    [TC-54..59, 79]
  ├─ Adjust Tip · Split Tip                                                            [TC-34..38, 69, 70]
  ├─ Refund / Partial Refund (1 nút gộp)                                              [TC-56, 60..63]
  ├─ Cancel Order · Re-open Order                                                     [TC-64, 65..68]
  └─ Handling network disconnect (Card mất mạng)                                      [TC-52, 53]

Search toàn cục (header): 4 tab All / Appointment / Customer / Order                  [TC-74, 75]
```

## A3. Các luồng chính (từ Linear)

### A3.1 Header Bar

- **Quick Redirect – Appointment**: link booking online tạo appointment hiển thị lên
  Calendar Appointment của POS (read-only với booking online). Click "Check-out" từ một
  appointment sẽ tạo order và fill sẵn service/staff từ appointment; chỉ tạo được 1 order
  cho 1 appointment tại một thời điểm.
  - Appointment Calendar: Date (default Today), khung giờ 12:00AM–11:45PM, cột Unassigned
    (tuỳ setting), danh sách staff Active theo alphabet nickname, filter Staff/Status
    (Scheduled/Canceled/Confirmed/Done)/Date, nút New Appointment.
  - Appointment workflow theo status: **Scheduled** (Edit/Cancel/Confirm, chưa Check Out
    được) → **Confirmed** (Edit/Cancel/Check Out redirect sang checkout) → **Done** (không
    action nào, đã convert sang Order) / **Canceled** (không action nào).
  - Nếu đang tạo dở 1 order mà check out order khác từ appointment → popup "Update Order
    from Appointment" cảnh báo sẽ thay thế order hiện tại (Keep Current Order / Update
    Order).
- **Quick Redirect – Cash Drawer**: click mở ngăn kéo tiền.
- **Scan**: quét Barcode/QR Gift Card (check nhanh thông tin) hoặc quét Order QR code (redirect
  Order History).
- **Search (Customer & Order Search)**: tìm theo Customer Name/Phone hoặc Order ID, trả kết
  quả theo 5 tab **All / Appointment / Checkin / Order / Customer**; mỗi tab có cấu trúc field
  riêng (xem A3.8); trạng thái rỗng hiển thị icon "No data".
- **Login / Notifications**: đăng nhập bằng staff code + passcode; panel Notification hiển thị
  thông báo hệ thống (appointment confirmed, v.v.).

### A3.2 Home screen

- **Staff list**: card theo tab (All/nhóm), hiển thị tên, next appointment, badge số lượng.
  Chọn staff trước khi thêm service vào order.
- **Service list**: search + danh mục dịch vụ (category → count), click danh mục để xem list
  service/product cụ thể; có 2 nút đặc biệt **Quick Pay** và **Gift Card** không cần chọn
  order trước.
- **Enter Customer Phone/Name/Email**: bàn phím số + input tìm khách hàng gắn vào order.
- **Checkin Today** / **Appointment Today**: 2 khối collapsible ("Show"/"Hide") hiển thị số
  lượng theo ngày hiện tại.

### A3.3 Create Order

- **Cart**: hiển thị theo nhóm Staff (vd "Store" khi chưa gán staff cụ thể), từng dòng
  service/product kèm giá + nút xoá (X); action **Promo & Rewards**, **Note**, **Merge
  Order**; tổng Subtotal/Tax/Total; action Print, Split Tip, **Pay**.
- **Checkout**: chọn phương thức **Card / Cash / Gift Card / Other**, có ô "Enter Amount" (số
  tiền tuỳ chỉnh), preview hoá đơn (order id, timestamp, customer, danh sách service, subtotal/
  tax/total), nút **Tip** và **Complete Payment** / **Print**.
- **Split Tip**: chia tip theo % hoặc số tiền cho nhiều staff trong order.
- **Split Order**: tách 1 order thành nhiều check để thanh toán riêng (xem chi tiết trong
  `docs/linear/split-order.md` — "Chỉnh sửa Check", "Chuyển sang màn hình thanh toán Check
  mới").
- **Order History / Order Workflow / Order Status**: mỗi order đi qua các trạng thái
  (In Use → Processing/Successful - Unsettled → Successful - Settled → Refunded/Partial
  Refunded/Canceled/Re-open...).
- **Order Detail** theo status, nội dung đặc thù từng status:
  - **Successful - Settled**: action Receipt / Refund / Partial Refund.
  - **Canceled**: action Receipt; Cancel Information (Amount, Date & Time, By Staff, Reason).
  - **Refunded**: action Receipt; Refund Information (title "Refund #OD-ID-CheckID", Amount,
    Date & Time, Method, By Staff, Reason).
  - **Partial Refunded**: action Receipt / Refund (refund hết phần còn lại) / Partial Refund;
    Refund Information tương tự bản Refunded.

### A3.4 Adjust Tip

- Chỉ hiện khi order **Successful - Unsettled**, payment method Card (status Auth)/Cash/Other
  (không áp dụng Gift Card); order nhiều payment method → phải chọn 1 method cụ thể; order
  nhiều staff → tự động re-split tip sau khi Adjust; chỉ cho Add Tip khi order có Staff.

### A3.5 Refund / Partial Refund

- Refund = hoàn toàn bộ; Partial Refund = hoàn một phần (khách không hài lòng 1 service, 1
  service không thực hiện, lỗi nhân viên, điều chỉnh giá...).
- Điều kiện: order **Successful - Settled**; nếu có credit transaction chưa Batch/Close →
  disable nút Refund + alert "Refund Not Available".
- Workflow gộp chung 1 form "Refund": chọn service(s) → All = Full Refund (autofill = total
  order); chọn 1 phần = Partial Refund (autofill = giá các service được chọn). Có
  discount/tax → refund theo giá sau khi phân bổ % discount cho từng service. Promotion cũ áp
  dụng lúc checkout được giữ nguyên dù partial refund làm order giảm dưới ngưỡng khuyến mãi.
- Dialog Refund: Title "Refund", mô tả, chọn service/product (All hoặc từng dòng), chọn
  refund method (Cash/Card/Other — không Gift Card), refund amount autofill, reason (optional),
  action Cancel/Refund.
- Sau refund: Order History ghi thêm session "Refund Information" (mã RF, amount, thời gian,
  method, staff, reason); Receipt thêm session tương ứng.
- Status sau cùng: Partial Refunded → (refund hết) → Refunded; refund lỗi → "Refund Issue".
  Payment Auth+Tip chỉ được partial-refund base amount (không refund Tip); payment Sale được
  refund tới hết Amount + Tip.

### A3.6 Reopen Order

- Thêm status "re-open"; tại Order History, nút "Re-open" đổi thành "Continue Re-open" khi
  order đang re-open; chỉ được reopen **1 lần**.
- Bỏ void từng transaction, thay bằng nút chung "Void all" (xuất hiện khi sửa service làm số
  tiền không khớp).
- Không đổi status order gốc trong lúc reopen; tính lại theo setting mới; phải thanh toán
  thành công để "Complete payment" thoát flow re-open.
- Report Effect: khi đang re-open → loại khỏi mọi Income/Report; khi Complete lại → tính lại
  toàn bộ và ghi nhận lại vào report.
- Field bị ảnh hưởng khi reopen: Discount/Promotion/Reward (giữ theo version cũ), Service fee
  (tính lại theo subtotal mới), Tax (giữ theo version cũ), Cashback redeem (restore rồi apply
  lại), Cashback earn (tính lại theo total mới lúc close).
- Special case xử lý: đổi phương thức thanh toán/đổi total thấp hơn/đổi tax → Void & charge
  lại; đổi total cao hơn → charge thêm; xoá hết staff chỉ còn Store dù đã tip → Void & charge
  lại; thay toàn bộ list service mới → cảnh báo rồi tính lại như order mới.

### A3.7 Handling Network Disconnects (thanh toán Card mất mạng)

- Có thể tiếp tục thanh toán offline bằng Cash trong lúc chờ; khi online lại, "Try again"
  refresh giao dịch card: nếu xuất hiện transaction mới → complete payment (không tạo
  transaction $0), khoá nút back; nếu không xuất hiện → thanh toán tiếp bằng method khác.
- Sau thanh toán luôn kiểm tra Order History để quyết định có cần void transaction card tạo
  lúc mất mạng hay không (đảm bảo consistency số tiền).

### A3.8 Customer & Order Search (module riêng, cuối tài liệu)

- 5 tab: All / Appointment / Checkin / Order / Customer.
- Appointment tab: list + detail (date, customer phone/name, service/staff/start time/
  duration, add more service/staff, notes) + Customer Insight (tổng appointment theo status,
  tổng chi tiêu, điểm loyalty, số lần visit).
- Checkin tab: checkin/checkout date, status, point earned/used.
- Order tab: created at, staff, service, total amount → click redirect Order History Detail.
- Customer tab: tên, phone, points, visits, group → click mở Customer Info Detail Modal.
- Empty state: icon "No data" + message.
- Acceptance criteria: search theo phone trả về đủ Customer/Appointment/Checkin/Order; search
  theo tên trả đúng khách + data liên quan; search theo Order ID trả đúng order + redirect
  được; không có kết quả → "No data".

> ⚠️ **Drift đã xác nhận live (xem TC-74):** UI thực tế chỉ có **4 tab** (All / Appointment /
> Customer / Order) — **KHÔNG có tab Checkin**. Mô tả 5 tab ở trên là theo Linear (SAI so với UI).

## A4. Feature inventory (bảng tính năng + trạng thái live)

> Bảng liệt kê TẤT CẢ tính năng Order kèm trạng thái quét live gần nhất (mốc **2026-09-07** raw CDP,
> bổ sung 09-02/09-03). Cột "Trạng thái" dùng chú thích ✅/⚠️/🧱/📄 ở đầu tài liệu.

### A4.1 Header Bar (mọi màn)

| Tính năng                         | Mô tả                                                                                                   | Trạng thái 2026-09-07                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Pending Orders                    | Mở panel danh sách đơn đang In Use/Processing (badge số lượng)                                          | ✅ nút + panel; badge = 0 sau khi dọn                |
| Order History                     | Link `/order-history`                                                                                   | ✅ `<a href="/order-history">`                       |
| Appointment                       | Link `/appointment?date=...` (calendar booking)                                                         | ✅ `<a href>`                                        |
| Scanner                           | Quét Barcode/QR Gift Card hoặc Order QR                                                                 | ✅ nút "Scanner" (không có scanner thật để test sâu) |
| Search toàn cục                   | 4 tab All/Appointment/Customer/Order; placeholder "Search by customer Name or Phone, Order ID, QR Code" | ⚠️ 4 tab (Linear ghi 5 tab — SAI); [TC-74]           |
| Icon org-chart / clock / bell     | Sơ đồ tổ chức, đồng bộ (badge đỏ "!"), thông báo                                                        | ✅ thấy 3 icon (bell = notifications)                |
| **KHÔNG có** Cash Drawer ở header | Cash Drawer nằm trong Checkout khi chọn Cash                                                            | ⚠️ xác nhận không có ở header [TC-71]                |

### A4.2 Home — tạo đơn

| Tính năng                                  | Mô tả                                                                                    | Trạng thái                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Staff list + tab "All"                     | Card staff (tên + initial + "Next appt --:--" + badge số)                                | ✅ Kang/Eren/Jin/Bean/Ben/Merri/Hana/Minh/Hung Nguyen               |
| Search staff                               | Lọc staff theo nickname                                                                  | ✅ input "Search staff"                                             |
| Chọn staff → tạo draft order               | Auto sinh order Processing, customer Unknown, $0.00                                      | ✅ tạo `OD260907-21642103` [TC-77]                                  |
| Service list + category                    | Category kèm count: Quick Pay, Gift Card, Pedicure (1), Nails (4), Product (10), OMD (2) | ✅ mở Nails → thấy Manicure $27.50, WAX $35, Pedicure $35           |
| Search service                             | Lọc service theo tên                                                                     | ✅ input "Search service"                                           |
| Quick Pay (tile)                           | Dialog Custom Amount + Service Name + note 0/80 + Apply Discount + Add                   | 📄/✅ (dialog theo TC-14)                                           |
| Gift Card (tile)                           | Bán/redeem gift card không cần order                                                     | 📄                                                                  |
| Enter Customer Phone/Name/Email + keypad   | Gán khách vào order; New/Existing customer flow                                          | ✅ input + keypad 0-9/C/Done (Done disabled tới khi đủ) [TC-06..10] |
| Checkin Today (N) / Appointments Today (N) | 2 khối collapsible Show/Hide                                                             | ✅ "Checkin Today (0)" / "Appointments Today (0)"                   |
| Quick Checkout                             | Nút xanh (checkout nhanh)                                                                | ✅ nút "Quick Checkout"                                             |

### A4.3 Cart (giỏ hàng đơn đang tạo)

| Tính năng                                 | Mô tả                                                             | Trạng thái                                   |
| ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Header order                              | `#OD260907-21642103` + nút **Remove** (xoá cả order)              | ✅ [TC-78]                                   |
| Nhóm theo staff                           | "Staff: Kang" → các dòng service; nút **Delete Staff Order Item** | ✅                                           |
| Choose service placeholder                | Khi staff chưa có service                                         | ✅                                           |
| Promo & Rewards                           | Dialog: Promotions + Custom Discount %/$ + Rewards + Apply        | ✅ nút [TC-18]                               |
| Note                                      | Ghi chú order (≤ 50 ký tự)                                        | ✅ nút [TC-19]                               |
| Merge Order                               | Chỉ hiện khi order đã có ≥1 service                               | ✅ (chưa hiện lúc order rỗng) [TC-20]        |
| Edit price / Item Discount / Service note | Click service → sửa giá, Apply Discount %/$, note 0/50            | 📄 [TC-22..24]                               |
| Summary                                   | Subtotal / Tax / Total                                            | ✅ **$27.50 / $2.75 (10%) / $30.25** [TC-21] |
| Split Order (icon cạnh Pay)               | → `/order/:id/split-order`                                        | 📄 [TC-25]                                   |
| Pay                                       | Disabled khi chưa có service; enable khi có                       | ✅                                           |

### A4.4 Checkout (`/order/:id/checkout`)

| Tính năng                    | Mô tả                                                                                                                     | Trạng thái                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 4 phương thức thanh toán     | **Card $30.25** (gồm service fee/tax) · **Cash $27.50** · **Gift Card $27.50** · **Other $27.50** (cash discount, bỏ tax) | ✅ amount KHÁC nhau theo method [TC-39]    |
| Enter Amount + keypad        | Nhập tiền khách đưa; hiển thị Change/Remaining                                                                            | ✅ keypad 0-9/C                            |
| Receipt preview (panel phải) | Order #, ngày giờ, customer, Staff, service, Order Note, Subtotal/Tax/Total                                               | ✅ khớp screenshot                         |
| Pay By Cash quick amount     | $5 / $10 / $50 / $100; chọn Cash tự điền total → Complete Payment                                                         | 📄/⚠️ [TC-40]                              |
| Pay By Card                  | Cần terminal thật (test env dừng ở nhập amount)                                                                           | 🧱 [TC-44]                                 |
| Pay By Gift Card             | Input Gift Card Code → "Gift Card Accepted" → Pay                                                                         | 📄 [TC-45]                                 |
| Pay By Other                 | Nhập tên phương thức → "Other (<tên>)"                                                                                    | 📄 [TC-46]                                 |
| Tip                          | Disabled tới khi chọn method                                                                                              | ✅ nút Tip [TC-47]                         |
| Print                        | In receipt preview (không gồm Payment Method)                                                                             | ✅ nút Print [TC-48]                       |
| Cash Drawer                  | Chỉ xuất hiện trong màn Cash (không ở header)                                                                             | ⚠️ [TC-49]                                 |
| Complete Payment             | Disabled tới khi đủ tiền + method; yêu cầu **staff code**                                                                 | ✅ disabled (chưa chọn method) [TC-42, 76] |
| Partial pay                  | Trả nhiều lần tạo nhiều payment                                                                                           | 📄 [TC-43]                                 |

### A4.5 Split Order & Split Tip

| Tính năng                                           | Mô tả                                                         | Trạng thái            |
| --------------------------------------------------- | ------------------------------------------------------------- | --------------------- |
| Split Order — 3 method                              | Equally / By Amount / By Items (By Items disabled khi 1 item) | 📄 [TC-26]            |
| Split Order — Equally                               | Chia đều N check, check cuối bù chênh lệch                    | 📄 [TC-27, 28]        |
| Split Order — By Amount                             | Validate tổng = Order Total, check cuối auto                  | 📄 [TC-29, 30]        |
| Split Order — By Items                              | Gán từng item cho từng check                                  | 📄 [TC-33]            |
| Split Order — mỗi check thanh toán độc lập 4 method | "Pay $<check amount>"                                         | 📄 [TC-31, 32]        |
| Split Tip — ẩn khi 1 staff                          | Chỉ hiện khi order >1 staff + có tip                          | ✅ [TC-34]            |
| Split Tip — Split Evenly                            | Chia đều (VD $12 → $6/$6)                                     | ✅ 2026-09-03 [TC-35] |
| Split Tip — Proportion (default)                    | Theo tỉ lệ service ((svc/total)×tip)                          | ✅ [TC-36]            |
| Split Tip — Manual                                  | Nhập tay từng staff, tổng phải = Total Tip                    | ✅ [TC-37]            |
| Split Tip — dialog                                  | Total tip + 3 tab + list staff + Confirm                      | ✅ [TC-38]            |

### A4.6 Payment Successful & dual-screen (màn khách)

| Tính năng                     | Mô tả                                                                                      | Trạng thái                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| Complete Payment → staff code | Dialog "Enter staff code to complete payment" + keypad                                     | ✅ [TC-76]                      |
| Dual-screen tip-wait          | "Customer is adding a tip. Please wait…" chờ màn khách                                     | ⚠️ chặn nếu 1 màn [TC-80]       |
| Màn khách "Add a tip"         | "Tip based on total: $X" (giá gốc service) · 15/18/20/25% · Custom Tip · No Tip · Continue | ✅ raw CDP `/customer/` [TC-81] |
| Payment Successful            | Reception: "Payment Successful!" + Adjust Tip/Split Tip + No Receipt/Print/Text/Email      | ✅ [TC-50]                      |
| No Receipt                    | Về `/home` hoặc `/order-pending`                                                           | 📄 [TC-51]                      |

### A4.7 Quản lý đơn sau thanh toán (Order History / Order Detail)

| Tính năng                            | Mô tả                                                                                                                 | Trạng thái                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Order Detail — bố cục chung          | 5 khối: Order Information (có **Cashier**) · Order Summary · Service Details · Tip · Payment Details                  | ✅ [TC-79]                                           |
| Filter (Order History)               | Sort by + Staff + Payment Method + **Status (9 giá trị)** + Clear/Confirm                                             | ✅ [TC-54]                                           |
| Unsettled — actions                  | Adjust Tip · Receipt · Re-Open Order · Cancel Order                                                                   | ✅ [TC-55]                                           |
| Settled — actions                    | Receipt + **Refund (1 nút gộp full/partial)** — KHÔNG có nút Partial Refund riêng                                     | ⚠️ [TC-56]                                           |
| Canceled — detail                    | Chỉ Receipt; Payment Details có dòng **Voided**; "By Staff" = Cashier                                                 | ⚠️ [TC-57]                                           |
| Refunded / Partial Refunded — detail | Refund Information (mã RF, amount, thời gian, method, staff, reason)                                                  | 🧱 [TC-58, 59]                                       |
| Adjust Tip                           | Chỉ Unsettled + method Card(Auth)/Cash/Other (KHÔNG Gift Card); dialog Current Tip + quick $20/$50/$100/$200 + keypad | ✅ dialog [TC-69]; multi-method 🧱 [TC-70]           |
| Refund / Partial Refund              | Chọn service (All=full / phần=partial), method Cash/Card/Other, amount autofill, reason optional                      | 🧱 (cần order settled — settle qua đêm) [TC-60..63]  |
| Cancel Order                         | Dialog "All payments will be voided" + reason bắt buộc + Keep Order/Confirm Cancel                                    | ✅ dialog [TC-64] (không submit — safety-classifier) |
| Re-open Order                        | Chỉ 1 lần; "Continue Re-open"; Void all; field khoá theo version cũ                                                   | 📄 [TC-65..68]                                       |
| Handling network disconnect          | Card mất mạng → Try again / thanh toán offline / check void                                                           | 📄 [TC-52, 53]                                       |

## A5. Thành phần UI thực tế (quét bằng Playwright MCP, 2026-07-15)

> Quét trên `http://localhost:1420` (env local, đã có sẵn phiên đăng nhập / dữ liệu demo).
> Screenshot: `docs/features/order-flow-assets/01-home.png` (Home), `02-cart.png` (Cart sau
> khi chọn staff + service), `03-checkout.png` (màn Checkout).

| Thành phần                                                                  | Vai trò                                | Trạng thái     | Ghi chú                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header: Pending Orders / Order History / Appointment                        | Điều hướng chính                       | ✅ khớp Linear | 3 link/button ở banner, đúng như "Header Bar". Không thấy nút Cash Drawer/Scan riêng biệt trong viewport đã chụp — có thể nằm sau icon menu (chưa xác nhận được do giới hạn thời gian quét).                                                           |
| Sidebar "Pending Orders"                                                    | Danh sách order đang In Use/Processing | ✅ khớp        | Card hiển thị Order ID, badge status (In Use/Processing), tên khách (ẩn số **_-_**-XXXX), service + staff, "+N more service", subtotal, Pts, giờ tạo.                                                                                                  |
| Search staff (tab All/New/Nails/test1/test2)                                | Lọc nhân viên                          | ✅ khớp        | Tab tuỳ theo cấu hình danh mục nhân viên của shop demo — không có trong Linear literal nhưng đúng khái niệm "list Staff".                                                                                                                              |
| Card nhân viên (Amelia, Isabella, Sophia,...)                               | Chọn staff cho order                   | ✅ khớp        | Có ảnh đại diện/khối màu, dòng "Next appt --:--", badge số (0) — khớp mục "Next appt" trong Linear.                                                                                                                                                    |
| "Enter Customer Phone, Name or Email" + bàn phím số                         | Gán khách hàng                         | ✅ khớp        | Accordion mở sẵn kèm keypad 0-9 + C + Done (disabled tới khi nhập đủ).                                                                                                                                                                                 |
| "Checkin Today (1)" / "Appointments Today (0)"                              | Khối collapsible                       | ✅ khớp        | Nút "Show" — đúng hành vi thu gọn nêu trong Linear, chưa mở rộng do dữ liệu demo trống.                                                                                                                                                                |
| Service search + category grid (Quick Pay, Gift Card, Product, danh mục...) | Chọn dịch vụ/thao tác nhanh            | ✅ khớp        | "Quick Pay" và "Gift Card" là 2 ô riêng biệt không cần order — đúng đặc tả.                                                                                                                                                                            |
| Cart panel (sau khi chọn staff + service)                                   | Giỏ hàng của order đang tạo            | ✅ khớp        | Header "#OD260715-09666812" + nút Remove; nhóm theo staff (ví dụ "Store"); dòng dịch vụ có nút xoá (X); footer Promo & Rewards / Note / Merge Order / Subtotal-Tax-Total / Print / Split-tip icon / Pay.                                               |
| Checkout screen (`/order/:id/checkout`)                                     | Thanh toán                             | ✅ khớp        | 4 phương thức Card/Cash/Gift Card/Other hiển thị số tiền tương ứng ngay trên nút; panel phải là hoá đơn preview (Order #, ngày giờ, tên khách, danh sách dịch vụ, Subtotal/Tax/Total); nút Print, Tip (disabled tới khi có payment), Complete Payment. |
| Notification bell / Cash drawer / device-clock icon                         | Header phải                            | ⚠️ một phần    | Chỉ xác nhận được icon chuông + icon đồng bộ ("!" badge đỏ) qua screenshot; chưa click mở panel do giới hạn thời gian — không phủ định được nội dung, chỉ chưa verify sâu.                                                                             |

## A6. Nghiệp vụ & ràng buộc

- Một appointment chỉ tạo được 1 order tại một thời điểm; nếu đang có order dở khi checkout từ
  appointment khác → buộc chọn Keep Current Order hoặc Update Order (không có lựa chọn thứ 3).
- Adjust Tip / Refund / Partial Refund đều gắn chặt với **status** + **payment method** của
  order (ví dụ Gift Card không được Adjust Tip, không được Refund).
- Refund luôn tính trên giá sau discount (không refund giá gốc) — nguyên tắc "thu bao nhiêu
  trả bấy nhiêu" để tránh salon lỗ.
- Reopen Order chỉ cho phép đúng 1 lần/order; nhiều field (Tax, Discount/Promotion/Reward) bị
  "khoá" theo version trước khi reopen, chỉ Service fee và Cashback được tính lại.
- Card transaction chưa Batch/Close sẽ chặn hoàn toàn thao tác Refund (không có ngoại lệ),
  hiển thị alert rõ điều kiện enable lại.
- Xử lý mất mạng khi thanh toán Card luôn đi kèm bước bắt buộc kiểm tra lại Order History để
  quyết định void giao dịch trùng, tránh lệch số tiền.

## A7. Trạng thái / quyền / edge case

- **Order status** xuất hiện trong tài liệu: In Use, Processing, Successful - Unsettled,
  Successful - Settled, Canceled, Refunded, Partial Refunded, Refund Issue, Re-open.
  (⚠️ Filter Order History live có **9 giá trị** — thêm Canceling / Cancel Issue / Refunding, xem TC-54.)
- **Quyền**: các action Cancel/Refund/Partial Refund/Adjust Tip đều yêu cầu nhập staff code
  ("By Staff" ghi nhận ai thực hiện) — ngụ ý cần quyền/PIN riêng cho thao tác nhạy cảm về tiền.
- **Edge case đã liệt kê rõ trong Linear**:
  - Order có nhiều payment method → phải chọn method cụ thể trước khi Adjust Tip.
  - Order có discount/TAX khi Partial Refund → phải chia tỷ lệ % discount cho từng service.
  - Promotion rule theo ngưỡng tổng tiền vẫn giữ nguyên dù partial refund kéo tổng xuống dưới
    ngưỡng (đã chốt tại thời điểm settle).
  - Reopen mà xoá hết service cũ, thay list mới hoàn toàn → phải cảnh báo rõ (recalculate
    pricing/commission/total) trước khi cho tiếp tục.
  - Mất mạng giữa lúc thanh toán Card → 2 nhánh xử lý tuỳ có/không xuất hiện transaction mới
    khi "Try again".

## A8. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

| Hạng mục                                                               | Linear                                                                         | UI thực tế                                                                                                                                                                                                                                                                                              | Kết luận                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cấu trúc Home (staff list + service list + cart)                       | Mô tả rõ 3 khối                                                                | Quét thấy đúng 3 khối, đúng vị trí (staff giữa, service phải, cart hiện ra sau khi chọn)                                                                                                                                                                                                                | ✅ Khớp                                                                                                                                                                            |
| Nút Quick Pay / Gift Card không cần order                              | Có                                                                             | Có, hiển thị ngay đầu grid dịch vụ                                                                                                                                                                                                                                                                      | ✅ Khớp                                                                                                                                                                            |
| Checkout: 4 phương thức Card/Cash/Gift Card/Other                      | Có                                                                             | Có, đúng cả nhãn lẫn số tiền hiển thị trực tiếp trên nút                                                                                                                                                                                                                                                | ✅ Khớp                                                                                                                                                                            |
| Cart action Promo & Rewards / Note / Merge Order                       | Có (đã ghi nhận ở `docs/features/home.md` — nhãn "Khuyến mãi & Thưởng" khi VN) | UI thực tế (bản EN) hiển thị "Promo & Rewards" / "Note" / "Merge Order"                                                                                                                                                                                                                                 | ✅ Khớp tên gọi, đã có ghi chú lệch dịch thuật riêng ở `docs/features/home.md` (không lặp lại ở đây)                                                                               |
| Order Detail theo status (Settled/Canceled/Refunded/Partial Refunded)  | Mô tả chi tiết field + action cho từng status                                  | **Chưa verify trực tiếp** — không hoàn tất một giao dịch thanh toán/refund thật trong phiên quét (để tránh làm bẩn dữ liệu demo dùng chung, xem cảnh báo `fullyParallel:false` trong `playwright.config.ts` về việc backend share state); đã có xác nhận gián tiếp qua `docs/features/order-history.md` | ⚠️ Lệch phạm vi quét — cần bổ sung ở phiên sau, đây là khoảng trống lớn nhất                                                                                                       |
| Adjust Tip / Refund / Partial Refund dialog                            | Mô tả field cụ thể (service list, refund method, amount autofill, reason)      | Không mở được do cần order đã Settled (order test tạo mới đang ở trạng thái chưa thanh toán)                                                                                                                                                                                                            | ⚠️ Chưa quét được — Linear-only cho mục này                                                                                                                                        |
| Reopen Order                                                           | Mô tả đầy đủ workflow + special case                                           | Không có trong phạm vi quét (cần order đã Successful trước, và tính năng có thể ẩn sau setting/feature-flag)                                                                                                                                                                                            | ⚠️ Chưa xác nhận UI — Linear-only                                                                                                                                                  |
| Customer & Order Search (5 tab All/Appointment/Checkin/Order/Customer) | Mô tả chi tiết ở cuối doc                                                      | Đã thấy ô "Search staff" (lọc nhân viên) khác với "Search order ID, customer name..." (sidebar Pending Orders) và popup Search toàn cục (Ctrl+K, đã quét ở `docs/features/home.md` với 4 tab All/Appointment/Customer/Order — **thiếu tab "Checkin"** so với 5 tab trong Linear)                        | ⚠️ Lệch: Linear liệt kê 5 tab (thêm "Checkin") nhưng bản quét trước đó ở Home chỉ ghi nhận 4 tab — cần re-scan popup Search để xác nhận có tab Checkin ẩn/scroll hay thực sự thiếu |
| Header Bar: Cash Drawer, Scan (Barcode/QR)                             | 2 mục riêng trong Linear                                                       | Không xác định được nút riêng trong viewport đã chụp (có thể nằm trong menu hamburger ☰ chưa mở)                                                                                                                                                                                                       | ⚠️ Chưa verify — cần mở menu hamburger ở lần quét sau                                                                                                                              |
| Split Order / Split Tip                                                | Có tài liệu riêng, thao tác trong Cart                                         | Thấy icon cạnh nút Print trong Cart (khả năng là Split Tip) nhưng chưa click để xác nhận nội dung dialog                                                                                                                                                                                                | ⚠️ Chưa verify chi tiết dialog                                                                                                                                                     |

# PHẦN B — Test Cases

Nguồn: PHẦN A ở trên (đã tổng hợp) + `docs/linear/order-flow.md` (1468 dòng, đọc đầy đủ 2
nửa) + đối chiếu `docs/linear/order-management.md`, `order-pending.md`, `split-order.md`,
`portal-order-history.md`, `portal-support-edit-completed-order.md`. Quét lại bằng Playwright
MCP trên `http://localhost:1420` (2026-07-15): Home, Cart (staff + service đã chọn), Quick Pay
dialog, Split Order screen. Verify live bằng WebdriverIO attach (2026-09-02/03) và raw CDP
(2026-09-07). Các mục **Order Detail theo status (Settled/Canceled/Refunded/Partial Refunded),
Reopen Order, Split Tip dialog, Cash Drawer/Scan** chưa re-scan trực tiếp trong một số phiên
(cần order đã settle/refund/reopen sẵn có, không tạo mới để tránh làm bẩn dữ liệu demo) — các
TC tương ứng được viết từ đặc tả Linear, ghi rõ `[LINEAR-ONLY]` trong cột Ghi chú và implement
dưới dạng skip-safe check (không giả định UI khi chưa xác nhận được).

## B1. Bảng tổng hợp nhanh (TC-01..87 + trạng thái)

> Bảng tra nhanh; chi tiết bước/kết quả đầy đủ xem **B3**. Cột Trạng thái theo mốc verify gần
> nhất (đánh dấu **09-07** cho TC bổ sung live 2026-09-07, **09-10** cho card-payment TC-82..87).

| ID    | Tính năng                                                      | Ưu tiên | Trạng thái                                                                                  |
| ----- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| TC-01 | Home hiển thị đủ 3 khối Staff/Service/Cart                     | P1      | ✅ **09-07**                                                                                |
| TC-02 | Chọn Service trước Staff → popup "Select Staff First"          | P1      | 📄                                                                                          |
| TC-03 | Chọn Staff → chọn Service thành công, Pay enable               | P1      | ✅ **09-07**                                                                                |
| TC-04 | Search staff theo nickname lọc đúng                            | P2      | ✅ input                                                                                    |
| TC-05 | Search service theo tên                                        | P2      | ✅ input                                                                                    |
| TC-06 | Enter Customer Phone — New Customer flow                       | P1      | 📄                                                                                          |
| TC-07 | Enter Customer Phone — Existing Customer flow                  | P1      | 📄                                                                                          |
| TC-08 | Phone trùng nhiều customer, Done → tự chọn đầu tiên            | P3      | 📄                                                                                          |
| TC-09 | Skip customer → "Unknown"                                      | P2      | ✅ order tạo với "Unknown"                                                                  |
| TC-10 | Customer có note → popup khi chọn                              | P3      | 📄                                                                                          |
| TC-11 | Change Staff trong order                                       | P2      | ✅ (nhãn "Change Staff")                                                                    |
| TC-12 | Delete Staff xoá toàn bộ service của staff đó                  | P2      | ✅ "Delete Staff Order Item"                                                                |
| TC-13 | Quick Pay — Select Staff First khi chưa có staff               | P1      | 📄                                                                                          |
| TC-14 | Quick Pay dialog — đủ field                                    | P1      | ✅                                                                                          |
| TC-15 | Quick Pay — Add enable khi đủ Amount + Service Name            | P1      | 📄                                                                                          |
| TC-16 | Quick Pay — Amount > $9,999,999.99 bị chặn                     | P2      | 📄                                                                                          |
| TC-17 | Quick Pay item chỉ cho order hiện tại, không Item Discount     | P3      | 📄                                                                                          |
| TC-18 | Cart — Promo & Rewards mở dialog                               | P1      | ✅                                                                                          |
| TC-19 | Cart — Note ≤ 50 ký tự                                         | P2      | ✅ nút Note                                                                                 |
| TC-20 | Cart — Merge Order (chỉ khi có ≥1 service)                     | P2      | ✅ **09-07** (rỗng → không hiện)                                                            |
| TC-21 | Cart — Summary Subtotal/Tax/Total đúng                         | P1      | ✅ **09-07** $27.50/$2.75/$30.25                                                            |
| TC-22 | Cart — Edit price của service                                  | P2      | ✅ dialog service                                                                           |
| TC-23 | Cart — Apply Item Discount %/$                                 | P2      | ✅ switch Apply Discount                                                                    |
| TC-24 | Cart — Service note ≤ 50 ký tự                                 | P3      | ✅ note 0/50                                                                                |
| TC-25 | Split Order — mở từ icon cạnh Pay                              | P1      | 📄                                                                                          |
| TC-26 | Split Order — 3 method (By Items disable khi 1 item)           | P1      | 📄                                                                                          |
| TC-27 | Split Order — Equally 2 check chia đều                         | P1      | 📄                                                                                          |
| TC-28 | Split Order — Add New Check                                    | P2      | 📄                                                                                          |
| TC-29 | Split Order — By Amount validate tổng                          | P2      | 📄                                                                                          |
| TC-30 | Split Order — By Amount check cuối auto                        | P1      | 📄                                                                                          |
| TC-31 | Split Order — mỗi check 4 method độc lập                       | P1      | 📄                                                                                          |
| TC-32 | Split Order — Receipt Details Subtotal/Tax/Total gốc           | P2      | 📄                                                                                          |
| TC-33 | Split Order — By Items gán item/check                          | P1      | 📄                                                                                          |
| TC-34 | Split Tip — ẩn khi 1 staff                                     | P3      | ✅                                                                                          |
| TC-35 | Split Tip — Split Evenly                                       | P2      | ✅ 09-03                                                                                    |
| TC-36 | Split Tip — Proportion (default)                               | P2      | ✅ 09-03                                                                                    |
| TC-37 | Split Tip — Manual editable                                    | P1      | ✅ 09-03                                                                                    |
| TC-38 | Split Tip — dialog (Total tip + 3 tab + Confirm)               | P2      | ✅ 09-03                                                                                    |
| TC-39 | Checkout — 4 method amount KHÁC nhau                           | P1      | ✅ **09-07** Card $30.25 / còn lại $27.50                                                   |
| TC-40 | Checkout — Pay By Cash quick amount $5/$10/$50/$100            | P1      | ⚠️ 09-02                                                                                    |
| TC-41 | Checkout — Cash Amount < Total chỉ "Pay"                       | P1      | 📄                                                                                          |
| TC-42 | Checkout — Cash đủ tiền → "Complete Payment"                   | P1      | ✅ **09-07** (Complete Payment disabled khi chưa chọn)                                      |
| TC-43 | Checkout — partial pay tạo nhiều payment                       | P2      | 📄                                                                                          |
| TC-44 | Checkout — Pay By Card dừng ở nhập amount (không terminal)     | P2      | 🧱                                                                                          |
| TC-45 | Checkout — Pay By Gift Card nhập code                          | P1      | 📄                                                                                          |
| TC-46 | Checkout — Pay By Other nhập tên method                        | P1      | 📄                                                                                          |
| TC-47 | Checkout — Tip disabled tới khi có method                      | P2      | ✅ **09-07** nút Tip                                                                        |
| TC-48 | Checkout — Print không gồm Payment Method                      | P3      | ✅ nút Print                                                                                |
| TC-49 | Checkout — Cash Drawer (chỉ ở màn Cash)                        | P3      | ⚠️ 09-02                                                                                    |
| TC-50 | Payment Successful — 4 action Receipt                          | P1      | ✅ 09-03 (dual-screen raw CDP)                                                              |
| TC-51 | Payment Successful — No Receipt về Home/Pending                | P2      | 📄                                                                                          |
| TC-52 | Network disconnect — có transaction card mới                   | P3      | 📄 [LINEAR-ONLY]                                                                            |
| TC-53 | Network disconnect — không có transaction mới                  | P3      | 📄 [LINEAR-ONLY]                                                                            |
| TC-54 | Order History — Filter Staff/Method/Status (9 status)          | P2      | ✅ 09-02                                                                                    |
| TC-55 | Order Detail Unsettled — Adjust Tip/Receipt/Re-Open/Cancel     | P1      | ✅ 09-02                                                                                    |
| TC-56 | Order Detail Settled — Receipt + Refund (gộp)                  | P1      | ⚠️ 09-02                                                                                    |
| TC-57 | Order Detail Canceled — Receipt + Voided                       | P1      | ⚠️ 09-02                                                                                    |
| TC-58 | Order Detail Refunded — Receipt + Refund Information           | P1      | 🧱                                                                                          |
| TC-59 | Order Detail Partial Refunded — Receipt/Refund/Partial         | P1      | 🧱                                                                                          |
| TC-60 | Refund — credit chưa Batch → disable + alert                   | P2      | 🧱                                                                                          |
| TC-61 | Refund — All = Full Refund autofill total                      | P1      | 🧱                                                                                          |
| TC-62 | Refund — 1 phần = Partial, chia % discount                     | P2      | 🧱                                                                                          |
| TC-63 | Refund dialog — field đầy đủ                                   | P1      | 🧱 (settle qua đêm)                                                                         |
| TC-64 | Cancel Order — confirm + reason bắt buộc                       | P1      | ✅ 09-03 dialog (không submit)                                                              |
| TC-65 | Reopen — chỉ 1 lần                                             | P2      | 📄 [LINEAR-ONLY]                                                                            |
| TC-66 | Reopen — "Continue Re-open"                                    | P2      | 📄 [LINEAR-ONLY]                                                                            |
| TC-67 | Reopen — "Void all"                                            | P3      | 📄 [LINEAR-ONLY]                                                                            |
| TC-68 | Reopen — field khoá version cũ, Service fee/Cashback tính lại  | P3      | 📄 [LINEAR-ONLY]                                                                            |
| TC-69 | Adjust Tip — chỉ Unsettled + Card/Cash/Other (không Gift Card) | P2      | ✅ 09-02 dialog                                                                             |
| TC-70 | Adjust Tip — nhiều method phải chọn 1                          | P2      | 🧱                                                                                          |
| TC-71 | Header — Cash Drawer KHÔNG ở header                            | P3      | ⚠️ **09-07** xác nhận không có                                                              |
| TC-72 | Header — Scanner giftcard info nhanh                           | P3      | 📄                                                                                          |
| TC-73 | Header — Scan Order QR redirect Order History                  | P3      | 📄                                                                                          |
| TC-74 | Search toàn cục — 4 tab (KHÔNG Checkin)                        | P1      | ⚠️ 09-02                                                                                    |
| TC-75 | Search theo Order ID redirect Order Detail                     | P1      | 📄                                                                                          |
| TC-76 | Checkout — Complete Payment yêu cầu staff code                 | P1      | ✅ 09-02                                                                                    |
| TC-77 | Chọn staff → tự tạo order Processing                           | P2      | ✅ **09-07** `OD260907-21642103`                                                            |
| TC-78 | Cart — Remove xoá order (confirm "Delete Order")               | P2      | ✅ **09-07** dialog + xoá thành công                                                        |
| TC-79 | Order Detail — bố cục chung 5 khối                             | P1      | ✅ 09-02                                                                                    |
| TC-80 | Dual-screen tip-wait chặn khi 1 màn                            | P2      | ⚠️ 09-02                                                                                    |
| TC-81 | Dual-screen — màn khách "Add a tip"                            | P1      | ✅ 09-03                                                                                    |
| TC-82 | Card — tender pre-fill đúng balance due (remaining=0)          | P1      | ✅ **09-10** probe PASS                                                                     |
| TC-83 | Card — keypad clamp over-tender về balance (không change)      | P2      | ✅ **09-10** probe PASS                                                                     |
| TC-84 | Card — charge settle → payment-success                         | P1      | ✅ **09-10** gated `CARD_SETTLE=1` (passcode 8888 + màn khách No Tip + 2 chữ ký + quẹt thẻ) |
| TC-85 | Card — charging dialog hiện amount + countdown                 | P2      | 🧱 (assert trong lần CARD_SETTLE)                                                           |
| TC-86 | Card — charge fail/timeout → Try Again                         | P2      | 🧱 (cần terminal decline/timeout)                                                           |
| TC-87 | Card — tip đẩy sang màn khách                                  | P2      | 🧱 [dual-window] launch lane + tip config                                                   |

**Thống kê:** 87 TC · ✅ verify live: 43 · ⚠️ drift/điều kiện: 9 · 🧱 chưa dựng được (settle/terminal/multi-method): 15 · 📄 document-only còn lại.

> **Card spec** (`tests/regression/order-flow/card-payment.spec.ts`, thêm 2026-09-10): TC-82/83 probe chạy
> thật; TC-84 settle gated sau `CARD_SETTLE=1` (charge tiền thật + cần quẹt thẻ ở terminal, dialog charge
> không có nút cancel nên không bật mặc định). Order tạo với staff/service **theo index** (đa dạng, không
> hard-code). Card ≥ cash (TC-39), Complete Payment disabled không terminal (TC-44), no Cash Drawer (TC-49)
> vẫn ở checkout-tenders.spec.ts.

## B2. Nhật ký verify live

### B2.1 — 2026-09-02 (WebdriverIO attach, merchant 20258, app v1.0.47)

> **Cách quét:** attach vào app desktop đang chạy qua CDP `127.0.0.1:9222` + `msedgedriver`
> (`npm run app:launch`), drive bằng script `webdriverio remote()`. Máy này **không có dev
> server `localhost:1420`** (`VOLT_POS_SRC` trống) nên bản quét 2026-07-15 ở `1420` không
> tái lập được — mọi thứ dưới đây quét trên app cài thật (`http://tauri.localhost/...`).
> App chỉ ship ~20 `data-testid` nên quét theo text/role/DOM.

**✅ Đã verify khớp (UI thật đúng như TC):**
TC-01, TC-02, TC-03, TC-11 _(nhãn thực tế là **"Change Staff"** chứ không phải "Update")_,
TC-12, TC-13, TC-14 _(note counter **0/80**)_, TC-18 _(dialog **"Promo & Rewards"**: Promotions
"No promotions available" + Custom Discount %/$ + "Order promotion discount setting" + **Rewards**
"test 20258" + Apply — Rewards đã LIVE, không còn PENDING)_, TC-20 _(Merge Order chỉ hiện khi order
đã có ≥1 service)_, TC-21 _(Subtotal + **Tax 10%** + Total; VD Manicure $27.50 → Tax $2.75 → Total
$30.25; chưa có dòng Item Discount/Promotion khi chưa apply)_, TC-22/23/24 _(dialog service:
price input editable + **Reset amount** + note **0/50** + Apply Discount switch + Save)_, TC-25,
TC-26 _(By Items **disabled** khi order 1 item)_, TC-27, TC-28, TC-31, TC-32, TC-54 _(Filter: xem
drift bên dưới)_, TC-55 _(Unsettled: **Adjust Tip / Receipt / Re-Open Order / Cancel Order**; 1
staff → không có Split Tip, khớp TC-34)_, TC-69 _(Adjust Tip dialog: Current Tip + Enter Amount +
quick **$20/$50/$100/$200** + keypad + Save; hiện cả với method Other)_.

**⚠️ DRIFT — cần sửa nội dung TC (đã cập nhật ở bảng B3):**

| TC    | Doc cũ                                                                 | UI thật 2026-09-02                                                                                                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-39 | "mỗi nút show amount tương ứng order total"                            | 4 nút hiển thị **số tiền KHÁC nhau theo method**: **Card $30.25** (gồm service fee), **Cash / Gift Card / Other $27.50** (cash discount, bỏ tax).                                                                                                            |
| TC-40 | Quick amount `$100/$50/$20/$10`                                        | Thực tế **`$5 / $10 / $50 / $100`**. Chọn Cash tự điền đúng total → Complete Payment enable ngay.                                                                                                                                                            |
| TC-49 | Cash Drawer (mơ hồ)                                                    | Nút **Cash Drawer** nằm trong màn checkout khi chọn **Cash** (không ở header).                                                                                                                                                                               |
| TC-54 | Status filter chỉ 5 giá trị                                            | Thực tế **9**: Successful-Unsettled, Successful-Settled, Canceled, **Canceling**, **Cancel Issue**, Partial Refunded, Refunded, **Refunding**, **Refund Issue**. Dialog Filter còn có **Sort by (Date completed)** + Staff + Payment Method + Clear/Confirm. |
| TC-56 | Settled: Receipt / Refund / **Partial Refund**                         | Chỉ **Receipt + Refund** — 1 nút Refund **gộp** (full/partial phân biệt theo service chọn trong dialog), không có nút Partial Refund riêng.                                                                                                                  |
| TC-57 | Canceled: block "**Cancel Information** (Amount/Date/By Staff/Reason)" | Không có block riêng — Order Detail hiện **Payment Details** với transaction gốc + 1 dòng **Voided**; "By Staff" nằm ở field **Cashier** trong Order Information. Action: chỉ Receipt.                                                                       |
| TC-71 | Header có nút Cash Drawer                                              | **Không có nút Cash Drawer ở header/sidebar.** Header: Pending Orders / Order History / Appointment / **Scanner** / global Search / icon (org-chart, clock, bell).                                                                                           |
| TC-74 | Search **5 tab** (có Checkin)                                          | Search chỉ **4 tab: All / Appointment / Customer / Order** — **KHÔNG có tab Checkin**. Placeholder "Search by customer Name or Phone, Order ID, QR Code".                                                                                                    |

**🧱 KHÔNG verify được trong phiên này (giữ nguyên `[LINEAR-ONLY]` / spec-based):**

- **Dual-screen (màn khách)**: sau khi Complete Payment + nhập staff code (**passcode 8888 owner
  20258 hoạt động**), flow dừng ở **"Customer is adding a tip. Please wait..."** — chờ màn khách.
  Màn khách là **Tauri webview riêng, msedgedriver KHÔNG expose window handle** → không drive
  được từ attach lane 1 máy. ⟹ **TC-50 (Payment Successful), toàn bộ dual-screen (Pay By Cash/Card/
  Gift Card/Other), Split Tip sau thanh toán không tự động hoá được ở chế độ này** — cần máy 2 màn
  thật hoặc mock customer display.
- **TC-60..63 (dialog Refund)**: không mở trên order **thật đã settled** vì rủi ro refund tiền
  thật (và bị safety-classifier chặn). Cần order settled **throwaway** để verify field dialog.
- **TC-58/59 (detail Refunded / Partial Refunded)**: tiệm 20258 không có order Refunded/Partial
  trong range 7 ngày lúc quét → chưa lấy được layout thật.
- **TC-65..68 (Reopen)**, **TC-70 (Adjust Tip nhiều method)**, **TC-35..38 (dialog Split Tip)**:
  cần order thật multi-staff/settled + thao tác ghi lên dữ liệu thật → không thực thi.

**🆕 TC mới phát hiện khi quét (đã bổ sung — xem TC-76..81 cuối bảng B3).**

### B2.2 — 2026-09-03 follow-up (mở khoá dual-screen bằng raw CDP + Split Tip + ràng buộc Refund)

**Cách mở khoá màn khách:** ở **attach lane (msedgedriver/`debuggerAddress`)** `getWindowHandles()`
chỉ trả về main window + `about:blank`, KHÔNG expose webview `/customer/` như 1 handle drive được.
Giải pháp dùng ở đây: **raw CDP qua `ws`** — `GET http://127.0.0.1:9222/json` lấy `webSocketDebuggerUrl`
của từng target (thấy cả `/customer/`), connect WebSocket, gửi `Runtime.evaluate` để đọc/click. Cách
này drive được CẢ 2 webview, bỏ qua giới hạn handle. Lưu ý: **tab Radix (`role=tab`) không switch
bằng `.click()` tổng hợp** — phải `focus()` + dispatch chuỗi pointer event.

> **Lưu ý cho suite chính:** framework ĐÃ có [`withCustomerWindow()` / `switchToCustomer()`](src/helpers/window.ts)
> dựa trên `getWindowHandles()` trả về cả 2 window — cơ chế này hoạt động ở lane **tauri-driver**
> (launch), nơi cả 2 window là handle WebDriver thật. Vấn đề handle ở trên là **đặc thù của attach
> lane**. Khi port test dual-screen chạy bằng tauri-driver, dùng `withCustomerWindow()` thay cho raw CDP.

**✅ Verify thêm (order throwaway 2 staff Kang+Ben, tip 20% = $12):**

- **Màn khách "Add a tip"** (dual-screen): "Tip based on total: **$60.00**" (= tổng **giá gốc
  service** $25+$35, KHÔNG phải subtotal $66) · quick **15%/18%/20%/25%** · **Custom Tip** · **No
  Tip** · **Continue** (disabled tới khi chọn) · "By proceeding, you agree to Terms and Privacy
  Policy". → **TC mới, đã bổ sung** (customer-side tip screen, TC-81).
- **TC-50** ✅ Reception "Payment Successful!" + Adjust Tip/Split Tip + No Receipt/Print/Text
  Message/Email; Customer "Payment complete" + 4 action. (Cash mode này KHÔNG có bước signature —
  signature chỉ ở Card.)
- **TC-34..38 Split Tip** ✅ (xem bảng): Evenly $6/$6 · Proportion $5/$7 · Manual editable · dialog
  Total tip $12 + 3 tab + Confirm. Tab mặc định = **Proportion**.
- **TC-64 Cancel Order** ✅ dialog (reason bắt buộc + "All payments will be voided" + Keep Order/
  Confirm Cancel); chưa submit vì safety-classifier chặn.

**🧱 Refund dialog (TC-60..63) — VẪN chưa verify, lý do THỰC TẾ:** nút Refund chỉ có ở order
**Successful - Settled**, nhưng **Cash/Gift Card/Other settle vào NGÀY HÔM SAU** theo merchant
timezone, còn **Card cần terminal thật** (không có trong test env). ⟹ **không tạo được order
throwaway settled trong ngày**. Đường đi khả thi: để order throwaway cash (VD `OD260903-09717395`)
**qua đêm cho settle**, phiên sau mở Refund dialog trên chính nó rồi Cancel (không submit) — an
toàn, không đụng order thật.

> ⚠️ **Cleanup còn treo:** order throwaway `OD260903-09717395` (cash $66 + tip $12) đang
> Successful-Unsettled, tính vào income tiệm 20258 hôm nay. Safety-classifier chặn thao tác Cancel
> tự động → cần cancel tay (Cancel Order → chọn reason → Confirm Cancel) hoặc để settle rồi refund.

### B2.3 — 2026-09-07 (raw CDP live scan — Edge 152 / WebView2 / Tauri v2)

**Cách quét (phương pháp):** App Volt POS là **Tauri v2 + WebView2** → UI là web (React) render
trong webview Chromium. Vì máy này **không có dev server `localhost:1420`** (không chạy source),
không dùng được Playwright MCP ở chế độ launch. Thay vào đó drive **app thật đang chạy** qua **raw
CDP** — đúng lane mà [`wdio.attach.conf.ts`](../../../configs/wdio/wdio.attach.conf.ts) dùng:

1. App chạy thật, mở remote debugging `127.0.0.1:9222` (`npm run app:launch`).
2. `GET http://127.0.0.1:9222/json` → lấy `webSocketDebuggerUrl` của target main window
   (`/order-pending`) và màn khách (`/customer/`).
3. Connect WebSocket → `Runtime.evaluate` để đọc DOM / click / điều hướng SPA;
   `Page.captureScreenshot` để chụp màn.

> **Ràng buộc điều hướng:** route trực tiếp bằng URL làm SPA trắng màn → phải **click trong app**
> (click `<a href="/home">`, click staff card, click Pay...). App chỉ ship ~vài `data-testid`
> nên quét theo **text / role / DOM**.

**Phiên 2026-09-07 (read-only + throwaway an toàn):** `/order-pending` → Home → chọn staff **Kang**
(tự tạo draft order `OD260907-21642103`) → thêm service **Manicure** → xem Cart summary → **Pay** →
màn **Checkout** → **KHÔNG** Complete Payment → back → **Remove → Delete** dọn sạch draft (Pending = 0).
Screenshot: [order-flow-assets/2026-09-07-home.png](./order-flow-assets/2026-09-07-home.png) ·
[2026-09-07-checkout.png](./order-flow-assets/2026-09-07-checkout.png).

**Bằng chứng (nhật ký thao tác raw CDP):**

| Bước | Hành động (raw CDP)      | Kết quả quan sát                                                                                                                      |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `GET /json`              | main `/order-pending` + `/customer/` (dual-screen) + 2 worker                                                                         |
| 2    | Scan `/order-pending`    | Header: Pending Orders/Order History/Appointment/Scanner/Staff13/Latest/Today/09-07/Quick Checkout                                    |
| 3    | Click `<a href="/home">` | → `/home` (SPA nav OK, không trắng màn)                                                                                               |
| 4    | Scan Home                | staff All (9 staff) · keypad khách · category Quick Pay/Gift Card/Pedicure/Nails/Product/OMD · Checkin(0)/Appointments(0)             |
| 5    | Click staff **Kang**     | tạo draft `OD260907-21642103` Processing $0.00; Cart mở (Remove/Promo & Rewards/Note/Pay disabled; chưa có Merge Order)               |
| 6    | Mở category **Nails**    | Manicure $27.50 · WAX $35 · Pedicure $35                                                                                              |
| 7    | Add **Manicure**         | Subtotal **$27.50** · Tax **$2.75** (10%) · Total **$30.25** · Pay enabled                                                            |
| 8    | Click **Pay**            | → `/order/01a07a74…/checkout`; Card **$30.25** · Cash/Gift Card/Other **$27.50** · keypad · Print · Tip · Complete Payment (disabled) |
| 9    | Screenshot checkout      | [2026-09-07-checkout.png](./order-flow-assets/2026-09-07-checkout.png)                                                                |
| 10   | Back → Home              | về `/home`                                                                                                                            |
| 11   | **Remove → Delete**      | dialog "Delete Order — Are you sure…? Cancel/Delete" → xoá; **Pending Orders = 0** (dọn sạch)                                         |

> **An toàn:** không Complete Payment, không tạo order tính vào income; draft throwaway đã xoá.
> Không đụng tới Refund/Cancel trên order thật (safety-classifier chặn + rủi ro tiền thật).

## B3. Bảng test case chi tiết (TC-ORDERFLOW-01..87)

| ID              | Tiêu đề                                                                                    | Tiền điều kiện                                                                                | Các bước                                                                                                                                                                                                                          | Kết quả mong đợi                                                                                                                                                                                                                                                                                                   | Loại       | Ưu tiên |
| --------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| TC-ORDERFLOW-01 | Home hiển thị đủ 3 khối Staff / Service / Cart                                             | Đã login, ở `/home`                                                                           | 1. Mở `/home`                                                                                                                                                                                                                     | Staff list (search + tabs All/Group), Service list (search + category grid gồm Quick Pay/Gift Card đầu tiên), placeholder cart trống hoặc "Add Staffs and Services" đều hiển thị                                                                                                                                   | e2e        | P1      |
| TC-ORDERFLOW-02 | Chọn Service trước khi chọn Staff hiện popup "Select Staff First"                          | Order chưa có staff                                                                           | 1. Click 1 service trong catalogue khi chưa chọn staff                                                                                                                                                                            | Popup "Select Staff First" — "Please select a staff before choosing services.", nút Done                                                                                                                                                                                                                           | regression | P1      |
| TC-ORDERFLOW-03 | Chọn Staff trước, sau đó chọn Service thành công                                           | Ở `/home`                                                                                     | 1. Click 1 card staff (vd Amelia) 2. Click 1 service                                                                                                                                                                              | Staff card active, cart hiện nhóm theo staff, service được thêm với giá đúng, nút Pay enable                                                                                                                                                                                                                       | e2e        | P1      |
| TC-ORDERFLOW-04 | Search staff theo nickname lọc đúng danh sách                                              | Có nhiều staff                                                                                | 1. Nhập nickname vào "Search staff"                                                                                                                                                                                               | List staff chỉ còn card khớp                                                                                                                                                                                                                                                                                       | regression | P2      |
| TC-ORDERFLOW-05 | Search service theo tên trả về đúng danh mục                                               | Ở `/home`, đã chọn staff                                                                      | 1. Nhập tên service vào "Search service"                                                                                                                                                                                          | Danh sách lọc còn đúng service khớp tên                                                                                                                                                                                                                                                                            | regression | P2      |
| TC-ORDERFLOW-06 | Enter Customer Phone — New Customer flow                                                   | Order chưa gán customer                                                                       | 1. Click "Enter Customer Phone, Name or Email" 2. Nhập số phone mới hợp lệ 3. Click Done                                                                                                                                          | Dialog "Add new customer": Phone (đã điền), Customer Name (optional, default Unknownxxxx), Group, Save/(X)/View More                                                                                                                                                                                               | e2e        | P1      |
| TC-ORDERFLOW-07 | Enter Customer Phone — Existing Customer flow                                              | Đã có customer trong hệ thống                                                                 | 1. Nhập số phone đã tồn tại                                                                                                                                                                                                       | Dialog "Customers Found" hiện list; chọn 1 dòng gắn customer vào order                                                                                                                                                                                                                                             | e2e        | P1      |
| TC-ORDERFLOW-08 | Enter Customer Phone — trùng nhiều customer, không chọn mà click Done                      | Nhiều customer cùng phone                                                                     | 1. Nhập phone trùng 2. Không chọn dòng nào, click Done                                                                                                                                                                            | Hệ thống tự chọn customer đầu tiên trong danh sách, tiếp tục luồng tạo Order                                                                                                                                                                                                                                       | edge       | P3      |
| TC-ORDERFLOW-09 | Skip customer entry                                                                        | Ở field Enter Phone Number                                                                    | 1. Click Skip                                                                                                                                                                                                                     | Customer hiển thị "Unknown", order vẫn tạo được                                                                                                                                                                                                                                                                    | regression | P2      |
| TC-ORDERFLOW-10 | Customer có Customer Note đã lưu → hiện popup khi chọn lại                                 | Customer có sẵn note                                                                          | 1. Chọn customer đã có note từ danh sách                                                                                                                                                                                          | Popup hiển thị Customer Note (chỉ xem) trước khi confirm Done                                                                                                                                                                                                                                                      | edge       | P3      |
| TC-ORDERFLOW-11 | Update Staff trong order đã chọn                                                           | Order có 1 staff                                                                              | 1. Click Update ở dòng staff 2. Chọn staff khác                                                                                                                                                                                   | Staff trong order được thay thế                                                                                                                                                                                                                                                                                    | regression | P2      |
| TC-ORDERFLOW-12 | Delete Staff xoá toàn bộ service của staff đó                                              | Order có staff + service                                                                      | 1. Click nút xoá (Delete Staff Order Item) ở dòng staff                                                                                                                                                                           | Staff và toàn bộ service thuộc staff đó biến mất khỏi cart                                                                                                                                                                                                                                                         | regression | P2      |
| TC-ORDERFLOW-13 | Quick Pay — Select Staff First khi chưa có staff                                           | Order/staff trống                                                                             | 1. Click tile "Quick Pay" mà chưa chọn staff                                                                                                                                                                                      | Popup "Select Staff First" hiện ra (không mở dialog Quick Pay)                                                                                                                                                                                                                                                     | e2e        | P1      |
| TC-ORDERFLOW-14 | Quick Pay dialog — đủ field khi đã có staff                                                | Đã chọn 1 staff                                                                               | 1. Click tile "Quick Pay"                                                                                                                                                                                                         | Dialog "Quick Pay": textbox "Custom Amount" ($0.00), textbox "Service Name", textbox "Add note" (đếm ký tự 0/80), switch "Apply Discount", nút Add (disabled), nút Close                                                                                                                                           | e2e        | P1      |
| TC-ORDERFLOW-15 | Quick Pay — nút Add chỉ enable khi đủ Amount + Service Name                                | Dialog Quick Pay đang mở                                                                      | 1. Chỉ nhập Amount 2. Kiểm tra Add vẫn disabled 3. Nhập thêm Service Name                                                                                                                                                         | Add chuyển sang enabled chỉ sau khi có đủ 2 field required                                                                                                                                                                                                                                                         | regression | P1      |
| TC-ORDERFLOW-16 | Quick Pay — Amount vượt quá $9,999,999.99 bị chặn                                          | Dialog Quick Pay đang mở                                                                      | 1. Nhập amount lớn hơn giới hạn                                                                                                                                                                                                   | Validation chặn / không cho vượt max theo đặc tả Linear                                                                                                                                                                                                                                                            | regression | P2      |
| TC-ORDERFLOW-17 | Quick Pay — item được thêm chỉ dùng cho order hiện tại, không apply Item Discount          | Đã Add 1 Quick Pay item                                                                       | 1. Add Quick Pay item vào cart                                                                                                                                                                                                    | Item xuất hiện trong cart dưới staff đã chọn; theo Linear service Quick Pay không lưu hệ thống và không cho apply Item Discount (chỉ Order Discount)                                                                                                                                                               | edge       | P3      |
| TC-ORDERFLOW-18 | Cart — Promo & Rewards mở dialog Add Promo                                                 | Cart có ít nhất 1 service                                                                     | 1. Click "Promo & Rewards"                                                                                                                                                                                                        | Dialog Add Promo: list Promo hệ thống + Custom (% min 0.1% max 100%, hoặc $ ≤ giá trước Reward/Tax)                                                                                                                                                                                                                | e2e        | P1      |
| TC-ORDERFLOW-19 | Cart — Note giới hạn 50 ký tự                                                              | Cart có order                                                                                 | 1. Click "Note" 2. Nhập > 50 ký tự                                                                                                                                                                                                | Input chặn ở 50 ký tự                                                                                                                                                                                                                                                                                              | regression | P2      |
| TC-ORDERFLOW-20 | Cart — Merge Order                                                                         | Có ≥ 2 order đang mở                                                                          | 1. Click "Merge Order"                                                                                                                                                                                                            | Dialog cho chọn order khác để gộp                                                                                                                                                                                                                                                                                  | regression | P2      |
| TC-ORDERFLOW-21 | Cart — Summary Subtotal/Tax/Total đúng                                                     | Cart có 1 service $11.00, tax 10%                                                             | 1. Xem Summary                                                                                                                                                                                                                    | Subtotal $11.00, Tax $1.10, Total $12.10 khớp                                                                                                                                                                                                                                                                      | e2e        | P1      |
| TC-ORDERFLOW-22 | Cart — Edit price của service                                                              | Cart có 1 service                                                                             | 1. Click vào service 2. Sửa Price 3. Save                                                                                                                                                                                         | Giá hiển thị chính xác theo giá đã sửa; không cho về âm                                                                                                                                                                                                                                                            | regression | P2      |
| TC-ORDERFLOW-23 | Cart — Apply Item Discount cho 1 service (% hoặc $)                                        | Cart có 1 service                                                                             | 1. Click service 2. Bật Apply Discount 3. Chọn % (1–100) hoặc $ (≤ Price)                                                                                                                                                         | Giá gốc + số tiền discount hiển thị đúng dưới dòng service                                                                                                                                                                                                                                                         | regression | P2      |
| TC-ORDERFLOW-24 | Cart — Service note tối đa 50 ký tự, hiện dưới tên service                                 | Cart có 1 service                                                                             | 1. Click service 2. Nhập Note > 50 ký tự                                                                                                                                                                                          | Note bị chặn ở 50 ký tự, hiển thị dưới service name                                                                                                                                                                                                                                                                | edge       | P3      |
| TC-ORDERFLOW-25 | Split Order — mở từ icon cạnh Pay trong cart                                               | Order có ≥1 service, đã có staff                                                              | 1. Click icon Split (giữa Print và Pay)                                                                                                                                                                                           | Điều hướng sang `/order/:id/split-order`, heading "Split Order #<orderCode>"                                                                                                                                                                                                                                       | e2e        | P1      |
| TC-ORDERFLOW-26 | Split Order — 3 phương thức Equally / By Amount / By Items                                 | Ở `/order/:id/split-order`                                                                    | 1. Xem 3 tab method                                                                                                                                                                                                               | 3 nút "Equally"/"By Amount"/"By Items"; "By Items" disabled khi order chỉ có 1 dòng item (xác nhận qua scan MCP)                                                                                                                                                                                                   | e2e        | P1      |
| TC-ORDERFLOW-27 | Split Order — Equally mặc định tạo 2 check chia đều                                        | Ở tab Equally                                                                                 | 1. Xem danh sách check mặc định                                                                                                                                                                                                   | 2 check "Check 1 (…)"/"Check 2 (…)" mỗi check = Total/2 (làm tròn 2 chữ số thập phân, check cuối bù chênh lệch)                                                                                                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-28 | Split Order — Add New Check thêm 1 check                                                   | Ở tab Equally, đã có 2 check                                                                  | 1. Click "Add New Check"                                                                                                                                                                                                          | Thêm 1 check mới, tổng chia lại đều cho N+1 check                                                                                                                                                                                                                                                                  | regression | P2      |
| TC-ORDERFLOW-29 | Split Order — By Amount validate tổng phải khớp Order Total                                | Ở tab By Amount, N=3                                                                          | 1. Nhập amount cho check 1, 2 sao cho tổng > Order Total                                                                                                                                                                          | Check N (tự tính) trả về âm hoặc lỗi — không cho tiếp tục (theo ví dụ Linear: Check1=$50, Check2=$60 → Auto=-$10 → WRONG)                                                                                                                                                                                          | edge       | P2      |
| TC-ORDERFLOW-30 | Split Order — By Amount hợp lệ tự tính check cuối                                          | Ở tab By Amount, N=3, Order $100                                                              | 1. Nhập Check1=$30, Check2=$50                                                                                                                                                                                                    | Check3 tự tính = $20, tổng khớp Order Total                                                                                                                                                                                                                                                                        | e2e        | P1      |
| TC-ORDERFLOW-31 | Split Order — mỗi check thanh toán độc lập với 4 phương thức                               | Đã chọn 1 check                                                                               | 1. Click "Select #OD...-1" 2. Chọn payment method (Card/Cash/Gift Card/Other)                                                                                                                                                     | Nút "Pay $<amount check>" hiển thị đúng số tiền của check đó, Print khả dụng                                                                                                                                                                                                                                       | e2e        | P1      |
| TC-ORDERFLOW-32 | Split Order — Receipt Details hiển thị Subtotal/Tax/Total gốc                              | Ở `/order/:id/split-order`                                                                    | 1. Xem panel phải "Receipt Details"                                                                                                                                                                                               | Subtotal/Tax/Total của order gốc hiển thị đúng (Nail Spa $11.00 / Tax $1.10 / Total $12.10 trong data demo)                                                                                                                                                                                                        | regression | P2      |
| TC-ORDERFLOW-33 | Split Order — By Items gán từng item cho từng check                                        | Order có ≥2 item, By Items enabled                                                            | 1. Chọn By Items 2. Gán item vào Check 1, item còn lại vào Check 2                                                                                                                                                                | Mỗi check tính tổng theo item được gán; 1 item chỉ thuộc 1 check                                                                                                                                                                                                                                                   | e2e        | P1      |
| TC-ORDERFLOW-34 | Split Tip — ẩn khi order chỉ có 1 staff ✅2026-09-02                                       | Order có 1 staff                                                                              | 1. Mở Order Detail Unsettled / màn success                                                                                                                                                                                        | Action Split Tip KHÔNG hiển thị (đã verify trên order Unsettled 1 staff). Với order >1 staff + tip → Split Tip HIỆN cả ở màn Payment Successful lẫn Order Detail Unsettled.                                                                                                                                        | edge       | P3      |
| TC-ORDERFLOW-35 | Split Tip — Split Evenly chia đều ✅2026-09-03                                             | Order >1 staff, có Tip (verify: Kang/Ben, tip $12)                                            | 1. Mở Split Tip 2. Chọn tab "Split Evenly"                                                                                                                                                                                        | Chia đều: **$12 → Kang $6.00 / Ben $6.00** (input read-only). VD Linear 3 staff tip $10 → $3.40/$3.40/$3.20 (staff cuối bù dư) chưa test riêng nhưng logic khớp.                                                                                                                                                   | edge       | P2      |
| TC-ORDERFLOW-36 | Split Tip — Proportion theo tỉ lệ service từng staff ✅2026-09-03                          | Order >1 staff (verify: Kang svc $27.50 / Ben $38.50, tip $12)                                | 1. Mở Split Tip 2. Chọn tab "Proportion"                                                                                                                                                                                          | Chia theo tỉ lệ service: **Kang $5.00 (27.5/66×12) / Ben $7.00 (38.5/66×12)** (input read-only). Đúng công thức (service/total)×tip.                                                                                                                                                                               | edge       | P2      |
| TC-ORDERFLOW-37 | Split Tip — Manual nhập riêng từng staff ✅2026-09-03                                      | Order nhiều staff                                                                             | 1. Mở Split Tip 2. Chọn tab "Manual" 3. Nhập số tiền cho từng staff                                                                                                                                                               | Tab Manual: input mỗi staff **editable** (readOnly=false); tổng phải bằng Total Tip trước khi Confirm enable.                                                                                                                                                                                                      | e2e        | P1      |
| TC-ORDERFLOW-38 | Split Tip — dialog gồm Title/Total Tip/3 tab/list staff/Confirm ✅2026-09-03               | Order >1 staff + có Tip                                                                       | 1. Trên màn Payment Successful click "Split Tip" (hoặc Order Detail Unsettled)                                                                                                                                                    | Dialog "Split Tip": **Total tip $12.00** + 3 tab **Split Evenly / Proportion(default) / Manual** + list staff (Kang/Ben) + Close(X) + Confirm(disabled tới khi hợp lệ). ⚠️ tab mặc định active = **Proportion**.                                                                                                   | regression | P2      |
| TC-ORDERFLOW-39 | Checkout — 4 phương thức, amount KHÁC nhau theo method ✅2026-09-02                        | Order đã Pay, ở `/checkout`                                                                   | 1. Xem 4 nút Card/Cash/Gift Card/Other                                                                                                                                                                                            | **Card = total gồm service fee** (VD $30.25); **Cash/Gift Card/Other = total sau cash discount, bỏ tax** (VD $27.50). Amount in ngay trên từng nút, KHÁC nhau — không phải cùng 1 order total.                                                                                                                     | e2e        | P1      |
| TC-ORDERFLOW-40 | Checkout — Pay By Cash với Quick amount ✅2026-09-02                                       | Ở checkout, chọn Cash                                                                         | 1. Chọn Cash 2. Click Quick amount (**$5 / $10 / $50 / $100**)                                                                                                                                                                    | Amount field cập nhật theo quick amount; Change hiển thị nếu Amount > Total. (Chọn Cash tự điền đúng total → Remaining=0 → nút chuyển "Complete Payment" ngay.)                                                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-41 | Checkout — Pay By Cash, Amount < Total chỉ enable "Pay"                                    | Ở Cash, chưa đủ tiền                                                                          | 1. Nhập Amount < Total Order                                                                                                                                                                                                      | Nút "Pay" hiển thị (chưa phải Complete Payment), Remaining > 0                                                                                                                                                                                                                                                     | regression | P1      |
| TC-ORDERFLOW-42 | Checkout — Pay By Cash đủ tiền hiện "Complete Payment"                                     | Ở Cash                                                                                        | 1. Nhập Amount ≥ Total Order                                                                                                                                                                                                      | Nút đổi thành "Complete Payment", Remaining = 0                                                                                                                                                                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-43 | Checkout — thanh toán nhiều lần (partial pay) tạo nhiều payment                            | Order lớn, trả nhiều lần                                                                      | 1. Pay lần 1 với Amount < Total 2. Pay tiếp phần còn lại                                                                                                                                                                          | Mỗi lần Pay tạo 1 payment riêng, Total Paid cộng dồn tới khi Complete Order                                                                                                                                                                                                                                        | edge       | P2      |
| TC-ORDERFLOW-44 | Checkout — Pay By Card dừng ở màn nhập số tiền (không có terminal thật)                    | Ở checkout, chọn Card                                                                         | 1. Chọn Card 2. Nhập amount = order total                                                                                                                                                                                         | Complete Payment hiển thị nhưng có thể vẫn disabled tới khi terminal xác nhận charge thành công (giới hạn môi trường test)                                                                                                                                                                                         | regression | P2      |
| TC-ORDERFLOW-45 | Checkout — Pay By Gift Card, nhập code thủ công                                            | Ở checkout, chọn Gift Card                                                                    | 1. Chọn Gift Card 2. "Input Gift Card Code" 3. Nhập code hợp lệ 4. Confirm                                                                                                                                                        | "Gift Card Accepted" hiển thị, sau đó Pay khả dụng                                                                                                                                                                                                                                                                 | e2e        | P1      |
| TC-ORDERFLOW-46 | Checkout — Pay By Other yêu cầu nhập tên phương thức                                       | Ở checkout, chọn Other                                                                        | 1. Chọn Other 2. Nhập "Input payment method name" 3. Complete Payment                                                                                                                                                             | Payment Success hiển thị "Other (<tên đã nhập>)"                                                                                                                                                                                                                                                                   | e2e        | P1      |
| TC-ORDERFLOW-47 | Checkout — Tip button disable tới khi có payment method                                    | Ở checkout, chưa chọn method                                                                  | 1. Kiểm tra nút Tip trước khi chọn method                                                                                                                                                                                         | Tip disabled; sau khi chọn method → enable                                                                                                                                                                                                                                                                         | regression | P2      |
| TC-ORDERFLOW-48 | Checkout — Print xuất receipt preview không gồm Payment Method                             | Ở checkout                                                                                    | 1. Click Print                                                                                                                                                                                                                    | Receipt in ra không hiển thị Payment Method (chỉ staff/service/summary)                                                                                                                                                                                                                                            | edge       | P3      |
| TC-ORDERFLOW-49 | Checkout — Cash Drawer action ✅2026-09-02                                                 | Ở checkout, chọn **Cash**                                                                     | 1. Chọn Cash 2. Click "Cash Drawer" (nút chỉ xuất hiện trong màn Cash, KHÔNG ở header)                                                                                                                                            | Trigger mở ngăn kéo tiền (best-effort — hardware; verify click không lỗi). Vị trí đúng: checkout/Cash.                                                                                                                                                                                                             | regression | P3      |
| TC-ORDERFLOW-50 | Payment Successful — 4 action Receipt ✅2026-09-03 (dual-screen qua raw CDP)               | Sau Complete Payment + staff code + customer chọn tip                                         | 1. Xem màn Payment Successful!                                                                                                                                                                                                    | Reception: heading **"Payment Successful!"** + **Adjust Tip / Split Tip** (nếu >1 staff+tip) + **No Receipt / Print / Text Message / Email**. Customer: "Payment complete" + 4 action tương tự. **Đã drive được màn khách qua raw CDP `/customer/` target** (msedgedriver không thấy handle — xem B2.2).           | e2e        | P1      |
| TC-ORDERFLOW-51 | Payment Successful — No Receipt trả về Home/Order Pending                                  | Ở màn Payment Successful                                                                      | 1. Click "No Receipt"                                                                                                                                                                                                             | Điều hướng về `/home` hoặc `/order-pending`                                                                                                                                                                                                                                                                        | regression | P2      |
| TC-ORDERFLOW-52 | Handling Network Disconnect — Card mất mạng, có transaction card mới khi Try again         | [LINEAR-ONLY] Đang thanh toán Card thì mất mạng                                               | 1. Mất mạng giữa thanh toán Card 2. Online lại, click Try again                                                                                                                                                                   | Nếu xuất hiện transaction card mới: số tiền cần thanh toán = 0, cho Complete Payment (không tạo transaction $0), khoá nút back                                                                                                                                                                                     | edge       | P3      |
| TC-ORDERFLOW-53 | Handling Network Disconnect — không có transaction mới                                     | [LINEAR-ONLY]                                                                                 | 1. Try again không thấy transaction mới                                                                                                                                                                                           | Amount không đổi, cho thanh toán tiếp bằng method khác, sau đó check Order History để quyết định void                                                                                                                                                                                                              | edge       | P3      |
| TC-ORDERFLOW-54 | Order History listing — filter Staff/Payment Method/Status                                 | Có sẵn order                                                                                  | 1. Mở `/order-history` 2. Click "Filter" 3. Mở Select payment method / Select status                                                                                                                                              | ✅2026-09-02 Dialog Filter: **Sort by (Date completed)** + Staff + Payment Method (Card/Cash/Gift Card/Other) + Status + Clear/Confirm. **Status 9 giá trị**: Successful-Unsettled, Successful-Settled, Canceled, Canceling, Cancel Issue, Partial Refunded, Refunded, Refunding, Refund Issue                     | regression | P2      |
| TC-ORDERFLOW-55 | Order Detail — Successful Unsettled: action Receipt/Re-Open/Cancel                         | [LINEAR-ONLY] Order status Successful - Unsettled                                             | 1. Mở order Unsettled                                                                                                                                                                                                             | ✅2026-09-02 Action buttons: **Adjust Tip, Receipt, Re-Open Order, Cancel Order**. Split Tip chỉ hiện khi order >1 staff (order 1 staff không có)                                                                                                                                                                  | e2e        | P1      |
| TC-ORDERFLOW-56 | Order Detail — Successful Settled: action Receipt/Refund/Partial Refund                    | Order status Successful - Settled (nếu có sẵn trong demo data)                                | 1. Mở order Settled                                                                                                                                                                                                               | ⚠️2026-09-02 Action buttons: **Receipt + Refund** — 1 nút Refund GỘP (full/partial theo service chọn trong dialog), KHÔNG có nút Partial Refund riêng; không có Cancel/Re-Open                                                                                                                                     | e2e        | P1      |
| TC-ORDERFLOW-57 | Order Detail — Canceled: chỉ có Receipt + Cancel Information                               | Order status Canceled                                                                         | 1. Mở order Canceled                                                                                                                                                                                                              | ⚠️2026-09-02 Chỉ action Receipt. KHÔNG có block "Cancel Information" riêng — **Payment Details** hiện transaction gốc + dòng **Voided**; "By Staff" = field **Cashier** trong Order Information                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-58 | Order Detail — Refunded: chỉ có Receipt + Refund Information                               | Order status Refunded                                                                         | 1. Mở order Refunded                                                                                                                                                                                                              | Chỉ action Receipt; block "Refund Information": title "Refund #OD-ID-CheckID", Amount, Date & Time, Method, By Staff, Reason                                                                                                                                                                                       | e2e        | P1      |
| TC-ORDERFLOW-59 | Order Detail — Partial Refunded: Receipt + Refund + Partial Refund                         | Order status Partial Refunded                                                                 | 1. Mở order Partial Refunded                                                                                                                                                                                                      | 3 action: Receipt, Refund (refund hết phần còn lại), Partial Refund; có block Refund Information                                                                                                                                                                                                                   | e2e        | P1      |
| TC-ORDERFLOW-60 | Refund — credit transaction chưa Batch/Close → disable + alert                             | Order Settled có credit transaction chưa batch                                                | 1. Click Refund                                                                                                                                                                                                                   | Nút Refund disabled; nếu ép click → alert "Refund Not Available"                                                                                                                                                                                                                                                   | edge       | P2      |
| TC-ORDERFLOW-61 | Refund — chọn All service = Full Refund, autofill total order                              | Order Settled, nhiều service                                                                  | 1. Click Refund 2. Chọn option "All"                                                                                                                                                                                              | Amount autofill = total order (gồm Tip nếu có)                                                                                                                                                                                                                                                                     | e2e        | P1      |
| TC-ORDERFLOW-62 | Refund — chọn 1 phần service = Partial Refund, autofill đúng giá + chia % discount         | Order Settled có discount, nhiều service                                                      | 1. Click Refund 2. Chọn 1 service                                                                                                                                                                                                 | Amount autofill theo giá service đã phân bổ % discount tương ứng (VD Linear: refund service $100/$200 discount $20 → trả $90)                                                                                                                                                                                      | edge       | P2      |
| TC-ORDERFLOW-63 | Refund dialog — field đầy đủ (Select service, Refund method, Amount, Reason optional)      | Đang mở dialog Refund                                                                         | 1. Xem dialog                                                                                                                                                                                                                     | Title "Refund", mô tả, Select services/products (All/từng dòng), Refund method Cash/Card/Other (không Gift Card), Refund amount autofill, Reason optional (list lý do chuẩn), Cancel/Refund                                                                                                                        | regression | P1      |
| TC-ORDERFLOW-64 | Cancel Order — confirm + reason bắt buộc ✅2026-09-03 (dialog)                             | Order Unsettled                                                                               | 1. Click Cancel Order 2. Chọn reason 3. Confirm Cancel                                                                                                                                                                            | Dialog "Cancel Order — Are you sure...? **All payments will be voided.**" + dropdown **"Select cancellation reason"** (bắt buộc) + **Keep Order / Confirm Cancel** (disabled tới khi chọn reason). Bước submit + staff code chưa chạy (safety-classifier chặn thao tác cancel thật).                               | e2e        | P1      |
| TC-ORDERFLOW-65 | Reopen Order — chỉ cho phép 1 lần                                                          | [LINEAR-ONLY] Order đã reopen 1 lần                                                           | 1. Mở lại order đã từng reopen                                                                                                                                                                                                    | Không còn action Reopen (đã dùng hết lượt)                                                                                                                                                                                                                                                                         | edge       | P2      |
| TC-ORDERFLOW-66 | Reopen Order — nút đổi thành "Continue Re-open" khi đang dở                                | [LINEAR-ONLY] Order đang ở trạng thái re-open                                                 | 1. Mở Order History                                                                                                                                                                                                               | Nút hiển thị "Continue Re-open" thay vì "Re-open"                                                                                                                                                                                                                                                                  | edge       | P2      |
| TC-ORDERFLOW-67 | Reopen Order — Void all thay cho void từng transaction                                     | [LINEAR-ONLY] Đang reopen, sửa service làm lệch số tiền                                       | 1. Sửa/xoá service trong lúc reopen                                                                                                                                                                                               | Nút chung "Void all" xuất hiện (không còn nút void riêng từng transaction)                                                                                                                                                                                                                                         | edge       | P3      |
| TC-ORDERFLOW-68 | Reopen Order — field bị khoá theo version cũ (Discount/Tax), Service fee/Cashback tính lại | [LINEAR-ONLY]                                                                                 | 1. Reopen order, thay đổi subtotal                                                                                                                                                                                                | Discount/Promotion/Reward và Tax giữ nguyên version cũ; Service fee và Cashback tính lại theo subtotal/total mới                                                                                                                                                                                                   | edge       | P3      |
| TC-ORDERFLOW-69 | Adjust Tip — chỉ hiện khi Successful-Unsettled + method Card(Auth)/Cash/Other              | [LINEAR-ONLY]                                                                                 | 1. Mở order Unsettled với Gift Card                                                                                                                                                                                               | Action Adjust Tip KHÔNG hiển thị cho Gift Card. (✅2026-09-02 verify DIALOG trên Unsettled/Other: Current Tip + Enter Amount + quick $20/$50/$100/$200 + keypad + Save; case ẩn-với-Gift-Card chưa verify vì thiếu order Gift Card Unsettled)                                                                      | edge       | P2      |
| TC-ORDERFLOW-70 | Adjust Tip — order nhiều payment method phải chọn 1 method cụ thể                          | [LINEAR-ONLY] Order nhiều payment method                                                      | 1. Click Adjust Tip                                                                                                                                                                                                               | Hiện list payment method, bắt buộc chọn 1 trước khi tiếp tục                                                                                                                                                                                                                                                       | edge       | P2      |
| TC-ORDERFLOW-71 | Header Bar — Cash Drawer mở ngăn kéo từ banner                                             | Ở `/home`                                                                                     | 1. Mở icon menu header (nếu cần) 2. Click Cash Drawer                                                                                                                                                                             | ⚠️2026-09-02 **KHÔNG có nút Cash Drawer ở header/sidebar**. Header: Pending Orders / Order History / Appointment / Scanner / Search / icon (org-chart, clock, bell). Cash Drawer chỉ có trong checkout khi chọn Cash (xem TC-49) ⟹ TC này nên đổi thành "xác nhận Cash Drawer KHÔNG ở header"                      | regression | P3      |
| TC-ORDERFLOW-72 | Header Bar — Scan Giftcard hiển thị thông tin nhanh                                        | Ở `/home`                                                                                     | 1. Click "Scanner" trong banner                                                                                                                                                                                                   | Mở luồng scan; scan Barcode/QR Giftcard cho ra info nhanh (best-effort trong môi trường test không có scanner thật)                                                                                                                                                                                                | regression | P3      |
| TC-ORDERFLOW-73 | Header Bar — Scan Order QR redirect Order History                                          | Ở `/home`                                                                                     | 1. Scan QR order hợp lệ                                                                                                                                                                                                           | Redirect `/order-history` đúng order                                                                                                                                                                                                                                                                               | regression | P3      |
| TC-ORDERFLOW-74 | Search toàn cục — **4 tab** All/Appointment/Customer/Order (KHÔNG có Checkin) ⚠️2026-09-02 | Ở `/home` (hoặc bất kỳ màn có header)                                                         | 1. Click ô Search trên header 2. Nhập customer phone/name/order ID                                                                                                                                                                | Dialog "Search" với **4 tab: All / Appointment / Customer / Order** — **KHÔNG có tab Checkin** (Linear ghi 5 tab là SAI so với UI). Placeholder "Search by customer Name or Phone, Order ID, QR Code"; rỗng → icon + "Search by customer name, phone, order ID, or QR code"                                        | e2e        | P1      |
| TC-ORDERFLOW-75 | Search — theo Order ID redirect đúng Order History Detail                                  | Có order tồn tại                                                                              | 1. Nhập Order ID vào Search                                                                                                                                                                                                       | Tab Order trả đúng order, click redirect `/order-history/<id>`                                                                                                                                                                                                                                                     | e2e        | P1      |
| TC-ORDERFLOW-76 | Checkout — Complete Payment yêu cầu staff code ✅2026-09-02                                | Ở checkout, đã chọn method + đủ amount                                                        | 1. Click "Complete Payment"                                                                                                                                                                                                       | Hiện dialog **"Enter staff code to complete payment"** + keypad số. Nhập passcode owner (8888 cho tiệm 20258) mới đi tiếp. Sai passcode → chặn.                                                                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-77 | Chọn staff (chưa có order) tự tạo order Processing ✅2026-09-02                            | Ở `/home`, chưa có order                                                                      | 1. Click 1 card staff                                                                                                                                                                                                             | Tự sinh 1 order mới (Pending list: status Processing, customer "Unknown", $0.00) và mở cart với staff đó + placeholder "Choose service"                                                                                                                                                                            | regression | P2      |
| TC-ORDERFLOW-78 | Cart — nút Remove xoá order (confirm "Delete Order") ✅2026-09-02                          | Cart đang có order nháp                                                                       | 1. Click "Remove" 2. Xác nhận                                                                                                                                                                                                     | Dialog "Delete Order — Are you sure you want to delete this entire order?" Cancel/Delete; click Delete → về `/home`, order biến khỏi Pending                                                                                                                                                                       | regression | P2      |
| TC-ORDERFLOW-79 | Order Detail — bố cục chung mọi status ✅2026-09-02                                        | Mở 1 order bất kỳ trong Order History                                                         | 1. Click 1 order                                                                                                                                                                                                                  | 5 khối: **Order Information** (Status/Order ID/**Cashier**/Order Date/Customer/Phone) · **Order Summary** (Subtotal/Total Discount/Tax/Tip/Total) · **Service Details** (group theo Staff, gồm "Store") · **Tip** · **Payment Details** (mỗi check: method + card brand/last4 + amount + status Successful/Voided) | e2e        | P1      |
| TC-ORDERFLOW-80 | Dual-screen tip-wait chặn hoàn tất thanh toán khi 1 màn ⚠️2026-09-02                       | Attach 1 máy, sau staff code                                                                  | 1. Complete Payment + nhập staff code                                                                                                                                                                                             | Hiện "Customer is adding a tip. Please wait…" + Cancel — chờ màn khách. Màn khách là Tauri webview riêng KHÔNG có window handle qua msedgedriver ⟹ dùng **raw CDP** vào target `/customer/` để drive (đã giải quyết 2026-09-03)                                                                                    | edge       | P2      |
| TC-ORDERFLOW-81 | Dual-screen — màn khách "Add a tip" ✅2026-09-03                                           | Sau staff code (đang tip-wait), drive target `/customer/`                                     | 1. Xem màn khách 2. Chọn quick tip / No Tip / Custom Tip 3. Continue                                                                                                                                                              | "Add a tip" · "Tip based on total: $X" (= tổng **giá gốc service**, không gồm tax/fee) · quick **15% / 18% / 20% / 25%** (kèm số tiền) · **Custom Tip** · **No Tip** · **Continue** (disabled tới khi chọn). Chọn xong → màn khách "Payment complete" + 4 action Receipt.                                          | e2e        | P1      |
| TC-ORDERFLOW-82 | Card — tender pre-fill đúng balance due ✅2026-09-10                                       | Ở checkout, order có ≥1 service                                                               | 1. Chọn tender Card                                                                                                                                                                                                               | Entry tự điền số tiền phải trả (>0); remaining = 0                                                                                                                                                                                                                                                                 | regression | P1      |
| TC-ORDERFLOW-83 | Card — keypad clamp over-tender về balance ✅2026-09-10                                    | Ở tender Card                                                                                 | 1. Gõ amount ~10× balance due                                                                                                                                                                                                     | Entry clamp về đúng balance due; không hiện Change (card không có over-tender/thối tiền)                                                                                                                                                                                                                           | regression | P2      |
| TC-ORDERFLOW-84 | Card — charge settle → payment-success ✅09-10 gated CARD_SETTLE=1 (launch lane)           | CARD_SETTLE=1 · SPEC_RETRIES=0 · STAFF_PASSCODE 8888 (20258) · terminal gắn sẵn · launch lane | 1. Tạo order (staff/service theo index) 2. Chọn Card 3. Complete Payment 4. Nhập staff code 8888 5. Màn khách: No Tip → ký (nếu có) → Continue 6. Quẹt thẻ ở terminal → charge duyệt 7. Màn khách: ký standalone lần 2 → Continue | Charge duyệt → điều hướng `/payment-success`; 4 action Receipt hiện; continue → về till sạch. Thiếu bước màn khách hoặc chữ ký lần 2 → charging dialog kẹt "charging". Charge thật cần timeout 120s (CARD_CHARGE)                                                                                                  | e2e        | P1      |
| TC-ORDERFLOW-85 | Card — charging dialog amount + countdown 🧱                                               | Trong lần CARD_SETTLE, sau Complete Payment                                                   | 1. Quan sát charging dialog                                                                                                                                                                                                       | Hiện số tiền charge (= total order) + countdown đếm ngược chờ terminal                                                                                                                                                                                                                                             | regression | P2      |
| TC-ORDERFLOW-86 | Card — charge fail/timeout → Try Again 🧱                                                  | Terminal decline hoặc hết giờ                                                                 | 1. Để terminal từ chối/timeout                                                                                                                                                                                                    | Dialog hiện message failed/timeout + nút "Try Again" (nhãn kèm countdown)                                                                                                                                                                                                                                          | regression | P2      |
| TC-ORDERFLOW-87 | Card — tip đẩy sang màn khách 🧱[dual-window]                                              | Launch lane 2 màn + merchant bật tip-after-payment                                            | 1. Complete Payment tender Card                                                                                                                                                                                                   | Màn khách hiện "Add a tip"; màn chính chờ "Customer is adding a tip. Please wait…"                                                                                                                                                                                                                                 | edge       | P2      |

# PHẦN C — Code Detail

> _Nội dung phần này gộp từ `order-flow-code-detail.md` (generated-at: 2026-07-17)._
>
> Ghi chú phạm vi: "Order Flow" là tài liệu Linear/test-case lớn nhất (Home → Cart →
> Checkout → Split Order → quản lý Order), **không có một spec file duy nhất**. Nó map
> tới nhiều file order/checkout/split-order theo đúng quy ước ở `docs/screens/README.md`
> (một số màn lớn được chia thành nhiều spec theo tính năng con thay vì 1 file 1 màn).

## C1. Flow Map

### C1.1 Sơ đồ (file → file)

```
docs/linear/order-flow.md (+ order-management.md, order-pending.md,
split-order.md, portal-order-history.md, portal-support-edit-completed-order.md)
  └─(feature-spec + scan Playwright MCP)→ docs/screens/order-flow/order-flow-test-cases.md
        (PHẦN A Feature Overview + PHẦN B Test Cases, TC-ORDERFLOW-01..81)
        │
        ├─→ src/pages/pos/HomePage.ts            (page object: staff/service/cart/customer)
        ├─→ src/pages/pos/CheckoutPage.ts         (page object: /checkout, 4 payment methods)
        ├─→ src/pages/pos/SplitOrderPage.ts       (page object: /order/:id/split-order)
        ├─→ src/pages/pos/OrderHistoryPage.ts     (page object: order list/detail/status)
        ├─→ src/pages/pos/OrderPendingPage.ts     (page object: pending orders sidebar)
        ├─→ src/components/modal/QuickPayDialog.ts (component: Quick Pay dialog)
        │
        ├─→ tests/regression/pos/order-flow/create-order.spec.ts   (TC-ORDERFLOW-01..24)
        ├─→ tests/regression/pos/order-flow/checkout.spec.ts       (TC-ORDERFLOW-39..53)
        └─→ tests/regression/pos/order-flow/split-order.spec.ts    (TC-ORDERFLOW-25..38)
              │
              └─(dùng chung)→ src/fixtures/index.ts → src/fixtures/pages.fixture.ts
                    (khởi tạo homePage / checkoutPage / splitOrderPage per test)
              │
              └─(khi chạy)→ test-results/ , playwright-report/ (Playwright HTML reporter mặc định)
```

### C1.2 Bảng mắt xích

| #   | File nguồn                                             | →   | File đích                                                                                          | Khâu tạo                                                         | Ghi chú                                                                                          |
| --- | ------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `docs/linear/order-flow.md` (+ 5 doc Linear liên quan) | →   | `docs/screens/order-flow/order-flow-test-cases.md`                                                 | feature-spec (đọc Linear + quét Playwright MCP `localhost:1420`) | Test-cases doc tự khai nguồn ở PHẦN D "Nguồn tham chiếu"                                         |
| 2   | `order-flow-test-cases.md` (TC-ORDERFLOW-01..24)       | →   | `src/pages/pos/HomePage.ts`, `src/components/modal/QuickPayDialog.ts`                              | testcase-gen (page object)                                       | Comment đầu file spec trỏ ngược 2 file này                                                       |
| 3   | `order-flow-test-cases.md` (TC-ORDERFLOW-39..53)       | →   | `src/pages/pos/CheckoutPage.ts`                                                                    | testcase-gen (page object)                                       |                                                                                                  |
| 4   | `order-flow-test-cases.md` (TC-ORDERFLOW-25..38)       | →   | `src/pages/pos/SplitOrderPage.ts`                                                                  | testcase-gen (page object)                                       |                                                                                                  |
| 5   | Page objects trên                                      | →   | `tests/regression/pos/order-flow/create-order.spec.ts`, `checkout.spec.ts`, `split-order.spec.ts`  | testcase-gen (spec)                                              | 3 spec file thay cho "1 file duy nhất" vì phạm vi quá lớn                                        |
| 6   | 3 spec file                                            | →   | `src/fixtures/index.ts` (`mergeTests(pagesFixture, apiFixture)`) → `src/fixtures/pages.fixture.ts` | fixtures dùng chung                                              | Cung cấp `homePage`, `checkoutPage`, `splitOrderPage` đã khởi tạo sẵn                            |
| 7   | Khi chạy spec                                          | →   | `playwright-report/` / `test-results/`                                                             | Playwright Test runner                                           | Không có report riêng cho order-flow như skill `screen-suite-report` (chưa gộp thành 1 test lớn) |

### C1.3 Ghi chú Flow Map

- **Không có 1 spec file duy nhất cho "order-flow"** — đúng như task yêu cầu xác nhận:
  logic được chia theo tính năng con (`create-order.spec.ts`, `checkout.spec.ts`,
  `split-order.spec.ts`) trong cùng thư mục `tests/regression/pos/order-flow/`, mỗi file
  cover một dải TC-ORDERFLOW-xx trong PHẦN B.
- **Mắt xích còn thiếu / chưa xác nhận tồn tại**:
  - Không tìm thấy page object/spec riêng cho **Order Detail theo status** (Settled/
    Canceled/Refunded/Partial Refunded), **Adjust Tip**, **Refund/Partial Refund dialog**,
    **Reopen Order**, **Split Tip dialog** — các TC tương ứng (TC-ORDERFLOW-34-38,
    52-53, 55-70) trong PHẦN B đều đánh dấu `[LINEAR-ONLY]` và
    không có code test thực thi kèm theo trong 3 spec file trên (đã Grep toàn bộ `tests/`,
    không thấy file nào implement các case này ngoài phần đã liệt kê).
  - Không có `OrderDetailPage.ts` hay `RefundDialog.ts`/`AdjustTipDialog.ts` trong
    `src/pages/pos/` hoặc `src/components/modal/` (đã Glob, chỉ thấy `OrderHistoryPage.ts`
    và `OrderPendingPage.ts`).
  - Không có report tổng hợp kiểu `reports/order-flow/order-flow-scan.html` (khác với màn
    Home đã có luồng "1 test lớn + report" theo skill `screen-suite-report`) — order-flow
    hiện chỉ chạy qua Playwright HTML reporter mặc định.

## C2. Code Detail

### C2.1 Tổng quan công nghệ

| Công nghệ                                       | Vai trò trong luồng gen                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Test (`@playwright/test`)            | Chạy spec, `test.describe`/`test()`, `expect()` assertion                                                                                                                                               |
| Playwright MCP                                  | Quét UI thật (`localhost:1420`) để xác nhận locator/role/text trước khi viết page object (ghi rõ trong comment đầu mỗi file)                                                                            |
| Custom fixtures (`mergeTests`)                  | `src/fixtures/index.ts` gộp `pagesFixture` + `apiFixture` thành 1 entrypoint `test`/`expect` duy nhất, tự tiêm `homePage`/`checkoutPage`/`splitOrderPage` vào từng test                                 |
| TypeScript path alias                           | `@fixtures/index`, `@pages/BasePage`, `@components/BaseComponent`, `@constants/urls`, `@configs/constants/timeouts`, `@utils/logger` — rút gọn import, khai báo trong `tsconfig`/`playwright.config.ts` |
| Tag system (`@/types/testTags`)                 | Gắn `Tag.REGRESSION`, `Tag.UI`, `Tag.PAYMENT` vào tên `test.describe` để filter khi chạy CI                                                                                                             |
| Page Object Model (`BasePage`, `BaseComponent`) | Class trừu tượng chung: `goto()`, `waitForReady()`, locator factory (`byTestId`, `byRole`, `byText`, `byLabel`)                                                                                         |
| Playwright HTML reporter                        | Xuất `playwright-report/`/`test-results/` mặc định khi chạy 3 spec (không có report tuỳ biến riêng cho order-flow)                                                                                      |

### C2.2 Chi tiết theo file

#### 1. `docs/screens/order-flow/order-flow-test-cases.md` (chính tài liệu này)

- **Vai trò trong luồng:** nguồn sự thật cho toàn bộ Order Flow — tổng hợp 1468 dòng
  `docs/linear/order-flow.md` + 5 doc Linear liên quan, đối chiếu UI thật (quét Playwright
  MCP 2026-07-15), rồi liệt kê các test case (TC-ORDERFLOW-01..81 sau khi bổ sung live 09-07).

```markdown
1 ---
2 title: Order Flow (POS Home screen)
3 route: /home
4 source-linear: https://linear.app/fastboy/document/order-flow-1bd212f296da
5 scanned-at: 2026-07-15
6 scanned-by: playwright-mcp
7 cross-referenced: docs/linear/order-management.md, docs/linear/order-pending.md, docs/linear/split-order.md, docs/linear/portal-order-history.md, docs/linear/portal-support-edit-completed-order.md
8 ---
```

- **Giải thích:** front-matter khai báo route, nguồn Linear gốc, ngày quét và các doc
  Linear đối chiếu chéo — mọi TC phía dưới đều truy ngược được về đây _(snapshot front-matter
  gốc 2026-07-15; front-matter hiện tại của file hợp nhất đã bổ sung thêm các mốc verify/scan)_.
  PHẦN B chia rõ TC nào đã re-scan thật (`e2e`), TC nào chỉ dựa vào đặc tả Linear
  (`[LINEAR-ONLY]`, dạng "skip-safe check").
- **Công nghệ dùng để gen/chạy:** đọc file bằng công cụ đọc file thường + quét UI bằng
  Playwright MCP (không phải code test) — đây là bước feature-spec/test-case-gen thủ công,
  chưa chạy Playwright Test runner.

#### 2. `src/pages/pos/HomePage.ts`

- **Vai trò trong luồng:** page object cho `/home` — bọc các thao tác Staff/Service/Cart/
  Customer mà `create-order.spec.ts` gọi lại.

```ts
19  constructor(page: Page) {
20    super(page);
21    this.staffSearchInput = page.getByPlaceholder('Search staff');
22    this.serviceSearchInput = page.getByPlaceholder('Search service');
23    this.payButton = page.getByRole('button', { name: 'Pay' });
24    this.deleteOrderButton = page.getByRole('button', { name: 'Delete Order' });
25    this.customerPhoneButton = page.getByText('Enter Customer Phone');
26    this.quickPayTile = page.getByRole('heading', { name: 'Quick Pay' });
27    this.giftCardTile = page.getByRole('heading', { name: 'Gift Card' });
28    this.promoRewardsButton = page.getByRole('button', { name: 'Promo & Rewards' });
29    this.noteButton = page.getByRole('button', { name: 'Note', exact: true });
30    this.mergeOrderButton = page.getByRole('button', { name: 'Merge Order' });
31  }
```

- **Giải thích:** khai báo locator bằng role/placeholder/text — khớp với các thành phần
  UI đã liệt kê ở PHẦN A (§A5 "Cart panel", "Search staff", "Quick Pay",
  "Promo & Rewards"...). `goto()` (dòng 33-39) còn gọi `cleanupExistingOrder()` để xoá đơn
  còn sót từ lần chạy trước — tránh state rò giữa các test (dòng 45-58), và `selectStaff()`
  (dòng 60-76) có `waitForFunction` chờ class `.is-changing-staff` biến mất trước khi click
  `force: true`, giải quyết vấn đề overlay chặn pointer-event.
- **Công nghệ dùng để gen/chạy:** Playwright locator API (`getByRole`, `getByPlaceholder`,
  `getByText`), Playwright MCP (để xác định đúng role/text thật trước khi hard-code), TS
  alias `@pages/BasePage`, `@constants/urls`.

#### 3. `src/pages/pos/CheckoutPage.ts`

- **Vai trò trong luồng:** page object cho `/checkout` — chọn phương thức thanh toán,
  đọc số tiền hiển thị, Complete Payment.

```ts
1  import { type Locator, type Page, expect } from '@playwright/test';
2  import { BasePage } from '@pages/BasePage';
3
4  export type PaymentMethod = 'Card' | 'Cash' | 'Gift Card' | 'Other';
...
28  async selectPaymentMethod(method: PaymentMethod): Promise<void> {
29    const button = this.page.getByRole('button', { name: new RegExp(`^${method}`) });
30    await button.click();
31    await this.page.waitForTimeout(300);
32  }
33
34  async clickCompletePayment(): Promise<void> {
35    await expect(this.completePaymentButton).toBeEnabled();
36    await this.completePaymentButton.click();
37  }
```

- **Giải thích:** union type `PaymentMethod` khớp đúng 4 phương thức mô tả ở PHẦN A
  (§A3.3 "Card / Cash / Gift Card / Other"); `selectPaymentMethod` dùng regex
  `^${method}` vì label nút thật gồm cả số tiền phía sau tên method (ví dụ "Cash $12.10").
  `clickCompletePayment` assert `toBeEnabled()` trước khi click — khớp field
  "Complete Payment button disable tới khi đủ điều kiện" ở TC-ORDERFLOW-42/44.
- **Công nghệ dùng để gen/chạy:** Playwright `expect()` auto-retry assertion, regex
  locator matching, `page.waitForTimeout` (chờ UI cập nhật sau click — chấp nhận được cho
  luồng thanh toán không có signal rõ ràng hơn).

#### 4. `src/pages/pos/SplitOrderPage.ts`

- **Vai trò trong luồng:** page object cho `/order/:id/split-order` — 3 tab chia
  (Equally/By Amount/By Items), danh sách Check, thanh toán riêng từng check.

```ts
7  /**
8   * Split Order screen (`/order/:id/split-order`) — reached from the Cart's
9   * split icon button (next to Print, before Pay).
10  *
11  * Selector strategy: role/text captured via Playwright MCP scan on
12  * 2026-07-15 against a single-service order (Amelia · Nail Spa, $12.10):
...
41  this.equallyTab = page.getByRole('button', { name: 'Equally', exact: true });
42  this.byAmountTab = page.getByRole('button', { name: 'By Amount', exact: true });
43  this.byItemsTab = page.getByRole('button', { name: 'By Items', exact: true });
44  this.addNewCheckButton = page.getByRole('button', { name: 'Add New Check' });
```

- **Giải thích:** docblock ghi rõ ngày/điều kiện quét MCP thật (order 1 dòng dịch vụ) —
  đúng nguyên tắc "không bịa locator". `isMethodEnabled()` (dòng 65-73) cho phép spec
  assert "By Items" bị disable khi order chỉ có 1 line item, khớp TC-ORDERFLOW-26.
- **Công nghệ dùng để gen/chạy:** Playwright MCP scan trực tiếp trên URL thật để lấy
  role/text chính xác trước khi code hoá; `getByRole('button', { exact: true })` để tránh
  nhầm giữa 3 tab tên gần giống nhau.

#### 5. `tests/regression/pos/order-flow/create-order.spec.ts`

- **Vai trò trong luồng:** spec thực thi TC-ORDERFLOW-01..24 (Home/Cart/Quick Pay), dùng
  `homePage` fixture.

```ts
1  import { test, expect } from '@fixtures/index';
2  import { Tag } from '@/types/testTags';
...
13 test.describe(`Order Flow — Create Order ${Tag.REGRESSION} ${Tag.UI}`, () => {
14   test.beforeEach(async ({ homePage }) => {
15     await homePage.goto();
16   });
...
25   test('TC-ORDERFLOW-02: choosing a Service before Staff shows "Select Staff First"', async ({
26     page,
27     homePage,
28   }) => {
29     const hasStaff = await page
30       .getByText('Delete Staff Order Item')
31       .first()
32       .isVisible()
33       .catch(() => false);
34     test.skip(hasStaff, 'A staff is already attached to the current demo order');
```

- **Giải thích:** tên `test.describe` chèn `Tag.REGRESSION`/`Tag.UI` để hạ tầng CI filter
  theo tag; mỗi test id trỏ thẳng về TC-ORDERFLOW-xx trong PHẦN B. Nhiều test dùng
  `test.skip(condition, reason)` (không phải throw lỗi) khi state demo-data không đáp ứng
  tiền điều kiện — tránh false negative do dữ liệu demo dùng chung giữa các suite
  (`playwright.config.ts` chạy `workers: 1`, ghi rõ trong comment ở PHẦN A §A5).
- **Công nghệ dùng để gen/chạy:** custom fixture injection (`homePage` tới sẵn từ
  `pagesFixture`), `test.skip()` có điều kiện, `test.describe` với template-string tag.

#### 6. `tests/regression/pos/order-flow/checkout.spec.ts`

- **Vai trò trong luồng:** spec TC-ORDERFLOW-39..53, dùng `homePage` + `checkoutPage`.

```ts
16 test.describe(`Order Flow — Checkout ${Tag.REGRESSION} ${Tag.UI} ${Tag.PAYMENT}`, () => {
17   test.beforeEach(async ({ homePage }) => {
18     await homePage.goto();
19   });
20
21   async function goToCheckout(homePage: HomePage): Promise<boolean> {
22     const hasOrder = await homePage.payButton.isVisible({ timeout: 3_000 }).catch(() => false);
23     if (!hasOrder) return false;
24     await homePage.clickPay();
25     return true;
26   }
```

- **Giải thích:** helper nội bộ `goToCheckout` gói điều kiện tiên quyết (phải có order với
  nút Pay hiển thị) thành 1 hàm dùng lại cho nhiều test — mọi test gọi `test.skip(!reached, ...)`
  ngay sau đó thay vì crash khi demo cart trống.
- **Công nghệ dùng để gen/chạy:** Playwright fixture composition (`homePage`, `checkoutPage`
  cùng lấy từ 1 fixture context), type import `HomePage` chỉ để type-hint helper function.

#### 7. `tests/regression/pos/order-flow/split-order.spec.ts`

- **Vai trò trong luồng:** spec TC-ORDERFLOW-25..38, dùng `homePage` + `splitOrderPage`.

```ts
4  /**
5   * Order Flow — Split Order / Split Tip (TC-ORDERFLOW-25..38).
...
13 * Split Tip requires a settled, multi-staff, tipped order which this test
14 * env does not reliably seed — those TCs are recorded as `test.skip` quoting
15 * the Linear spec (docs/linear/order-flow.md §"Split Tip") rather than
16 * asserting against unverified selectors.
17 */
18 test.describe(`Order Flow — Split Order ${Tag.REGRESSION} ${Tag.UI}`, () => {
```

- **Giải thích:** docblock tự khai rõ giới hạn — Split Tip (TC-ORDERFLOW-34..38) không có
  data seed đủ điều kiện nên chỉ được ghi nhận bằng `test.skip` trích Linear, không giả
  định UI khi chưa quét được (đúng tinh thần "Ghi chú Flow Map" §C1.3 ở trên). _Lưu ý:
  bản quét 2026-09-03 (PHẦN B §B2.2) sau đó ĐÃ verify được dialog Split Tip qua raw CDP —
  spec có thể port lại các TC-34..38 khi chạy bằng tauri-driver + `withCustomerWindow()`._
- **Công nghệ dùng để gen/chạy:** cùng cơ chế fixture + `test.skip` như 2 spec trên;
  khác biệt là tab method (Equally/By Amount/By Items) được assert trạng thái enabled/
  disabled qua `SplitOrderPage.isMethodEnabled()`.

#### 8. `src/fixtures/index.ts` và `src/fixtures/pages.fixture.ts`

- **Vai trò trong luồng:** entrypoint fixture dùng chung cho cả 3 spec — cung cấp
  `homePage`, `checkoutPage`, `splitOrderPage` đã khởi tạo với `page` hiện tại.

```ts
1  import { mergeTests, expect } from '@playwright/test';
2  import { pagesFixture } from './pages.fixture';
3  import { apiFixture } from './api.fixture';
...
12 export const test = mergeTests(pagesFixture, apiFixture);
13 export { expect };
```

- **Giải thích:** `mergeTests` của Playwright gộp 2 fixture module (`pagesFixture` — page
  objects, `apiFixture` — API/graphql) thành 1 `test`/`expect` duy nhất để import gọn ở mọi
  spec (`import { test, expect } from '@fixtures/index'`). `pages.fixture.ts` (dòng 21, 23,
  37 đã xác minh) khai báo type `homePage: HomePage`, `checkoutPage: CheckoutPage`,
  `splitOrderPage: SplitOrderPage` và factory async khởi tạo từng page object với `page`.
- **Công nghệ dùng để gen/chạy:** Playwright Test fixtures (`test.extend`/`mergeTests`),
  dependency injection theo kiểu Playwright (mỗi fixture tên field khớp tên tham số test
  nhận vào).

### C2.3 So với sơ đồ Flow Map

- Bảng mắt xích ở §C1.2 đã đủ mọi file thật tham gia luồng "tạo/tạo đơn/checkout" (Home →
  Cart → Checkout → Split Order); phần **Code Detail** bổ sung so với Flow Map: cơ chế
  `cleanupExistingOrder()`/`test.skip(condition, reason)` để né state rò giữa test run (một
  chi tiết vận hành không thể hiện trong sơ đồ file→file); vai trò cụ thể của
  `mergeTests`/`pages.fixture.ts` trong việc tiêm `homePage`/`checkoutPage`/`splitOrderPage`.
- Flow Map liệt kê các mắt xích "còn thiếu" (Order Detail theo status, Refund, Adjust Tip,
  Reopen, Split Tip dialog) — Code Detail xác nhận thêm: các TC này **có tồn tại trong
  PHẦN B dưới nhãn `[LINEAR-ONLY]`** nhưng hoàn toàn chưa có page object/spec thực thi
  tương ứng, không phải do sơ đồ bỏ sót mà do code chưa được viết cho phần đó.

# PHẦN D — Khoảng trống & nguồn tham chiếu

## D1. Khoảng trống cần bổ sung (phiên sau)

1. **Refund/Partial Refund dialog (TC-58..63):** cần order **Successful - Settled**. Cash/Gift Card/Other
   settle **qua đêm** theo merchant timezone; Card cần terminal thật. → để 1 order cash throwaway
   qua đêm rồi mở Refund dialog (Cancel, không submit).
2. **Reopen Order (TC-65..68):** cần order đã Successful + thao tác ghi dữ liệu thật → chưa dựng UI.
3. **Adjust Tip multi-method (TC-70)** & **Adjust Tip ẩn với Gift Card (TC-69 nhánh):** cần order
   nhiều payment method / Gift Card Unsettled.
4. **Quick Pay / Gift Card tile / customer entry flows (TC-06..17, 45, 46):** dialog xác nhận field
   trực tiếp (các phiên trước chỉ xác nhận sự tồn tại nút/tile).
5. **Split Order (TC-25..33):** cần order ≥2 item để mở By Items; nên dựng throwaway 2 service.
6. **Order Detail theo status (Settled/Canceled/Refunded/Partial Refunded)** trên Playwright MCP lane
   (`localhost:1420`) — khoảng trống lớn nhất của bản quét 2026-07-15 (xem A8).

## D2. Nguồn tham chiếu

- **Linear (nguồn gốc):** [Order Flow](https://linear.app/fastboy/document/order-flow-1bd212f296da) — bản offline: [docs/linear/order-flow.md](../linear/order-flow.md) (1468 dòng, đã đọc đầy đủ).
- **Đối chiếu chéo:** [docs/linear/order-management.md](../linear/order-management.md) (Portal/Admin view) · [docs/linear/order-pending.md](../linear/order-pending.md) · [docs/linear/split-order.md](../linear/split-order.md) · [docs/linear/portal-order-history.md](../linear/portal-order-history.md) · [docs/linear/portal-support-edit-completed-order.md](../linear/portal-support-edit-completed-order.md).
- **Feature-spec liên quan đã có sẵn:** [docs/features/home.md](./home.md) (i18n + popup chi tiết màn Home) · [docs/features/order-history.md](./order-history.md) · [docs/features/order-pending.md](./order-pending.md).
- **Code detail:** đã gộp vào PHẦN C của chính tài liệu này (trước đây là `order-flow-code-detail.md`).
- **Attach lane (drive app thật):** [wdio.attach.conf.ts](../../../configs/wdio/wdio.attach.conf.ts) · scripts `app:launch`/`app:kill` · helper [`withCustomerWindow()`](../../../src/helpers/window.ts).
- **Ảnh quét (Playwright MCP, 2026-07-15):** [order-flow-assets/01-home.png](./order-flow-assets/01-home.png) · [order-flow-assets/02-cart.png](./order-flow-assets/02-cart.png) · [order-flow-assets/03-checkout.png](./order-flow-assets/03-checkout.png).
- **Ảnh quét (raw CDP, 2026-09-07):** [order-flow-assets/2026-09-07-home.png](./order-flow-assets/2026-09-07-home.png) · [2026-09-07-checkout.png](./order-flow-assets/2026-09-07-checkout.png).
- **Cấu hình môi trường quét:** `playwright.config.ts` (`baseURL` local `http://localhost:1420`, `workers: 1` vì backend share state giữa các phiên).
