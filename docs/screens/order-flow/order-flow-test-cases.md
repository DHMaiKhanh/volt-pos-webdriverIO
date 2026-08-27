---
title: Order Flow (POS Home screen)
route: /home
source-linear: https://linear.app/fastboy/document/order-flow-1bd212f296da
scanned-at: 2026-07-15
scanned-by: playwright-mcp
cross-referenced: docs/linear/order-management.md, docs/linear/order-pending.md, docs/linear/split-order.md, docs/linear/portal-order-history.md, docs/linear/portal-support-edit-completed-order.md
---

# Order Flow (POS Home screen) — Đặc tả tính năng

## 1. Mục tiêu & phạm vi

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

## 2. Các luồng chính (từ Linear)

### 2.1 Header Bar

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
  riêng (xem §4); trạng thái rỗng hiển thị icon "No data".
- **Login / Notifications**: đăng nhập bằng staff code + passcode; panel Notification hiển thị
  thông báo hệ thống (appointment confirmed, v.v.).

### 2.2 Home screen

- **Staff list**: card theo tab (All/nhóm), hiển thị tên, next appointment, badge số lượng.
  Chọn staff trước khi thêm service vào order.
- **Service list**: search + danh mục dịch vụ (category → count), click danh mục để xem list
  service/product cụ thể; có 2 nút đặc biệt **Quick Pay** và **Gift Card** không cần chọn
  order trước.
- **Enter Customer Phone/Name/Email**: bàn phím số + input tìm khách hàng gắn vào order.
- **Checkin Today** / **Appointment Today**: 2 khối collapsible ("Show"/"Hide") hiển thị số
  lượng theo ngày hiện tại.

### 2.3 Create Order

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

### 2.4 Adjust Tip

- Chỉ hiện khi order **Successful - Unsettled**, payment method Card (status Auth)/Cash/Other
  (không áp dụng Gift Card); order nhiều payment method → phải chọn 1 method cụ thể; order
  nhiều staff → tự động re-split tip sau khi Adjust; chỉ cho Add Tip khi order có Staff.

### 2.5 Refund / Partial Refund

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

### 2.6 Reopen Order

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

### 2.7 Handling Network Disconnects (thanh toán Card mất mạng)

- Có thể tiếp tục thanh toán offline bằng Cash trong lúc chờ; khi online lại, "Try again"
  refresh giao dịch card: nếu xuất hiện transaction mới → complete payment (không tạo
  transaction $0), khoá nút back; nếu không xuất hiện → thanh toán tiếp bằng method khác.
- Sau thanh toán luôn kiểm tra Order History để quyết định có cần void transaction card tạo
  lúc mất mạng hay không (đảm bảo consistency số tiền).

### 2.8 Customer & Order Search (module riêng, cuối tài liệu)

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

## 3. Thành phần UI thực tế (quét bằng Playwright MCP)

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

## 4. Nghiệp vụ & ràng buộc

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

## 5. Trạng thái / quyền / edge case

- **Order status** xuất hiện trong tài liệu: In Use, Processing, Successful - Unsettled,
  Successful - Settled, Canceled, Refunded, Partial Refunded, Refund Issue, Re-open.
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

## 6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

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

## 7. Test Cases

Nguồn: mục 1–6 ở trên (đã tổng hợp) + `docs/linear/order-flow.md` (1468 dòng, đọc đầy đủ 2
nửa) + đối chiếu `docs/linear/order-management.md`, `order-pending.md`, `split-order.md`,
`portal-order-history.md`, `portal-support-edit-completed-order.md`. Quét lại bằng Playwright
MCP trên `http://localhost:1420` (2026-07-15): Home, Cart (staff + service đã chọn), Quick Pay
dialog, Split Order screen. Các mục **Order Detail theo status (Settled/Canceled/Refunded/
Partial Refunded), Reopen Order, Split Tip dialog, Cash Drawer/Scan** chưa re-scan trực tiếp
trong phiên này (cần order đã settle/refund/reopen sẵn có, không tạo mới để tránh làm bẩn dữ
liệu demo) — các TC tương ứng được viết từ đặc tả Linear, ghi rõ `[LINEAR-ONLY]` trong cột Ghi
chú và implement dưới dạng skip-safe check (không giả định UI khi chưa xác nhận được).

| ID              | Tiêu đề                                                                                    | Tiền điều kiện                                                 | Các bước                                                                                 | Kết quả mong đợi                                                                                                                                                                            | Loại       | Ưu tiên |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| TC-ORDERFLOW-01 | Home hiển thị đủ 3 khối Staff / Service / Cart                                             | Đã login, ở `/home`                                            | 1. Mở `/home`                                                                            | Staff list (search + tabs All/Group), Service list (search + category grid gồm Quick Pay/Gift Card đầu tiên), placeholder cart trống hoặc "Add Staffs and Services" đều hiển thị            | e2e        | P1      |
| TC-ORDERFLOW-02 | Chọn Service trước khi chọn Staff hiện popup "Select Staff First"                          | Order chưa có staff                                            | 1. Click 1 service trong catalogue khi chưa chọn staff                                   | Popup "Select Staff First" — "Please select a staff before choosing services.", nút Done                                                                                                    | regression | P1      |
| TC-ORDERFLOW-03 | Chọn Staff trước, sau đó chọn Service thành công                                           | Ở `/home`                                                      | 1. Click 1 card staff (vd Amelia) 2. Click 1 service                                     | Staff card active, cart hiện nhóm theo staff, service được thêm với giá đúng, nút Pay enable                                                                                                | e2e        | P1      |
| TC-ORDERFLOW-04 | Search staff theo nickname lọc đúng danh sách                                              | Có nhiều staff                                                 | 1. Nhập nickname vào "Search staff"                                                      | List staff chỉ còn card khớp                                                                                                                                                                | regression | P2      |
| TC-ORDERFLOW-05 | Search service theo tên trả về đúng danh mục                                               | Ở `/home`, đã chọn staff                                       | 1. Nhập tên service vào "Search service"                                                 | Danh sách lọc còn đúng service khớp tên                                                                                                                                                     | regression | P2      |
| TC-ORDERFLOW-06 | Enter Customer Phone — New Customer flow                                                   | Order chưa gán customer                                        | 1. Click "Enter Customer Phone, Name or Email" 2. Nhập số phone mới hợp lệ 3. Click Done | Dialog "Add new customer": Phone (đã điền), Customer Name (optional, default Unknownxxxx), Group, Save/(X)/View More                                                                        | e2e        | P1      |
| TC-ORDERFLOW-07 | Enter Customer Phone — Existing Customer flow                                              | Đã có customer trong hệ thống                                  | 1. Nhập số phone đã tồn tại                                                              | Dialog "Customers Found" hiện list; chọn 1 dòng gắn customer vào order                                                                                                                      | e2e        | P1      |
| TC-ORDERFLOW-08 | Enter Customer Phone — trùng nhiều customer, không chọn mà click Done                      | Nhiều customer cùng phone                                      | 1. Nhập phone trùng 2. Không chọn dòng nào, click Done                                   | Hệ thống tự chọn customer đầu tiên trong danh sách, tiếp tục luồng tạo Order                                                                                                                | edge       | P3      |
| TC-ORDERFLOW-09 | Skip customer entry                                                                        | Ở field Enter Phone Number                                     | 1. Click Skip                                                                            | Customer hiển thị "Unknown", order vẫn tạo được                                                                                                                                             | regression | P2      |
| TC-ORDERFLOW-10 | Customer có Customer Note đã lưu → hiện popup khi chọn lại                                 | Customer có sẵn note                                           | 1. Chọn customer đã có note từ danh sách                                                 | Popup hiển thị Customer Note (chỉ xem) trước khi confirm Done                                                                                                                               | edge       | P3      |
| TC-ORDERFLOW-11 | Update Staff trong order đã chọn                                                           | Order có 1 staff                                               | 1. Click Update ở dòng staff 2. Chọn staff khác                                          | Staff trong order được thay thế                                                                                                                                                             | regression | P2      |
| TC-ORDERFLOW-12 | Delete Staff xoá toàn bộ service của staff đó                                              | Order có staff + service                                       | 1. Click nút xoá (Delete Staff Order Item) ở dòng staff                                  | Staff và toàn bộ service thuộc staff đó biến mất khỏi cart                                                                                                                                  | regression | P2      |
| TC-ORDERFLOW-13 | Quick Pay — Select Staff First khi chưa có staff                                           | Order/staff trống                                              | 1. Click tile "Quick Pay" mà chưa chọn staff                                             | Popup "Select Staff First" hiện ra (không mở dialog Quick Pay)                                                                                                                              | e2e        | P1      |
| TC-ORDERFLOW-14 | Quick Pay dialog — đủ field khi đã có staff                                                | Đã chọn 1 staff                                                | 1. Click tile "Quick Pay"                                                                | Dialog "Quick Pay": textbox "Custom Amount" ($0.00), textbox "Service Name", textbox "Add note" (đếm ký tự 0/80), switch "Apply Discount", nút Add (disabled), nút Close                    | e2e        | P1      |
| TC-ORDERFLOW-15 | Quick Pay — nút Add chỉ enable khi đủ Amount + Service Name                                | Dialog Quick Pay đang mở                                       | 1. Chỉ nhập Amount 2. Kiểm tra Add vẫn disabled 3. Nhập thêm Service Name                | Add chuyển sang enabled chỉ sau khi có đủ 2 field required                                                                                                                                  | regression | P1      |
| TC-ORDERFLOW-16 | Quick Pay — Amount vượt quá $9,999,999.99 bị chặn                                          | Dialog Quick Pay đang mở                                       | 1. Nhập amount lớn hơn giới hạn                                                          | Validation chặn / không cho vượt max theo đặc tả Linear                                                                                                                                     | regression | P2      |
| TC-ORDERFLOW-17 | Quick Pay — item được thêm chỉ dùng cho order hiện tại, không apply Item Discount          | Đã Add 1 Quick Pay item                                        | 1. Add Quick Pay item vào cart                                                           | Item xuất hiện trong cart dưới staff đã chọn; theo Linear service Quick Pay không lưu hệ thống và không cho apply Item Discount (chỉ Order Discount)                                        | edge       | P3      |
| TC-ORDERFLOW-18 | Cart — Promo & Rewards mở dialog Add Promo                                                 | Cart có ít nhất 1 service                                      | 1. Click "Promo & Rewards"                                                               | Dialog Add Promo: list Promo hệ thống + Custom (% min 0.1% max 100%, hoặc $ ≤ giá trước Reward/Tax)                                                                                         | e2e        | P1      |
| TC-ORDERFLOW-19 | Cart — Note giới hạn 50 ký tự                                                              | Cart có order                                                  | 1. Click "Note" 2. Nhập > 50 ký tự                                                       | Input chặn ở 50 ký tự                                                                                                                                                                       | regression | P2      |
| TC-ORDERFLOW-20 | Cart — Merge Order                                                                         | Có ≥ 2 order đang mở                                           | 1. Click "Merge Order"                                                                   | Dialog cho chọn order khác để gộp                                                                                                                                                           | regression | P2      |
| TC-ORDERFLOW-21 | Cart — Summary Subtotal/Tax/Total đúng                                                     | Cart có 1 service $11.00, tax 10%                              | 1. Xem Summary                                                                           | Subtotal $11.00, Tax $1.10, Total $12.10 khớp                                                                                                                                               | e2e        | P1      |
| TC-ORDERFLOW-22 | Cart — Edit price của service                                                              | Cart có 1 service                                              | 1. Click vào service 2. Sửa Price 3. Save                                                | Giá hiển thị chính xác theo giá đã sửa; không cho về âm                                                                                                                                     | regression | P2      |
| TC-ORDERFLOW-23 | Cart — Apply Item Discount cho 1 service (% hoặc $)                                        | Cart có 1 service                                              | 1. Click service 2. Bật Apply Discount 3. Chọn % (1–100) hoặc $ (≤ Price)                | Giá gốc + số tiền discount hiển thị đúng dưới dòng service                                                                                                                                  | regression | P2      |
| TC-ORDERFLOW-24 | Cart — Service note tối đa 50 ký tự, hiện dưới tên service                                 | Cart có 1 service                                              | 1. Click service 2. Nhập Note > 50 ký tự                                                 | Note bị chặn ở 50 ký tự, hiển thị dưới service name                                                                                                                                         | edge       | P3      |
| TC-ORDERFLOW-25 | Split Order — mở từ icon cạnh Pay trong cart                                               | Order có ≥1 service, đã có staff                               | 1. Click icon Split (giữa Print và Pay)                                                  | Điều hướng sang `/order/:id/split-order`, heading "Split Order #<orderCode>"                                                                                                                | e2e        | P1      |
| TC-ORDERFLOW-26 | Split Order — 3 phương thức Equally / By Amount / By Items                                 | Ở `/order/:id/split-order`                                     | 1. Xem 3 tab method                                                                      | 3 nút "Equally"/"By Amount"/"By Items"; "By Items" disabled khi order chỉ có 1 dòng item (xác nhận qua scan MCP)                                                                            | e2e        | P1      |
| TC-ORDERFLOW-27 | Split Order — Equally mặc định tạo 2 check chia đều                                        | Ở tab Equally                                                  | 1. Xem danh sách check mặc định                                                          | 2 check "Check 1 (…)"/"Check 2 (…)" mỗi check = Total/2 (làm tròn 2 chữ số thập phân, check cuối bù chênh lệch)                                                                             | e2e        | P1      |
| TC-ORDERFLOW-28 | Split Order — Add New Check thêm 1 check                                                   | Ở tab Equally, đã có 2 check                                   | 1. Click "Add New Check"                                                                 | Thêm 1 check mới, tổng chia lại đều cho N+1 check                                                                                                                                           | regression | P2      |
| TC-ORDERFLOW-29 | Split Order — By Amount validate tổng phải khớp Order Total                                | Ở tab By Amount, N=3                                           | 1. Nhập amount cho check 1, 2 sao cho tổng > Order Total                                 | Check N (tự tính) trả về âm hoặc lỗi — không cho tiếp tục (theo ví dụ Linear: Check1=$50, Check2=$60 → Auto=-$10 → WRONG)                                                                   | edge       | P2      |
| TC-ORDERFLOW-30 | Split Order — By Amount hợp lệ tự tính check cuối                                          | Ở tab By Amount, N=3, Order $100                               | 1. Nhập Check1=$30, Check2=$50                                                           | Check3 tự tính = $20, tổng khớp Order Total                                                                                                                                                 | e2e        | P1      |
| TC-ORDERFLOW-31 | Split Order — mỗi check thanh toán độc lập với 4 phương thức                               | Đã chọn 1 check                                                | 1. Click "Select #OD...-1" 2. Chọn payment method (Card/Cash/Gift Card/Other)            | Nút "Pay $<amount check>" hiển thị đúng số tiền của check đó, Print khả dụng                                                                                                                | e2e        | P1      |
| TC-ORDERFLOW-32 | Split Order — Receipt Details hiển thị Subtotal/Tax/Total gốc                              | Ở `/order/:id/split-order`                                     | 1. Xem panel phải "Receipt Details"                                                      | Subtotal/Tax/Total của order gốc hiển thị đúng (Nail Spa $11.00 / Tax $1.10 / Total $12.10 trong data demo)                                                                                 | regression | P2      |
| TC-ORDERFLOW-33 | Split Order — By Items gán từng item cho từng check                                        | Order có ≥2 item, By Items enabled                             | 1. Chọn By Items 2. Gán item vào Check 1, item còn lại vào Check 2                       | Mỗi check tính tổng theo item được gán; 1 item chỉ thuộc 1 check                                                                                                                            | e2e        | P1      |
| TC-ORDERFLOW-34 | Split Tip — ẩn khi order chỉ có 1 staff                                                    | [LINEAR-ONLY] Order có 1 staff, có Tip                         | 1. Mở Order Detail / màn success sau Complete Payment                                    | Action Split Tip KHÔNG hiển thị (theo docs/linear/split-order.md §Split Tip)                                                                                                                | edge       | P3      |
| TC-ORDERFLOW-35 | Split Tip — Split Evenly chia đều, làm tròn còn dư cho staff cuối                          | [LINEAR-ONLY] Order 3 staff, tip $10                           | 1. Mở Split Tip 2. Chọn "Split Evenly"                                                   | 2 staff đầu $3.40, staff cuối $3.20 (đặc tả VD trong Linear)                                                                                                                                | edge       | P2      |
| TC-ORDERFLOW-36 | Split Tip — Proportion theo % service từng staff                                           | [LINEAR-ONLY] Anna $60 / Hannah $40, total order $100, tip $20 | 1. Mở Split Tip 2. Chọn "Proportion"                                                     | Anna = $12, Hannah = $8 (đúng công thức (service/total)\*tip)                                                                                                                               | edge       | P2      |
| TC-ORDERFLOW-37 | Split Tip — Manual nhập riêng từng staff dựa trên Total Tip                                | [LINEAR-ONLY] Order nhiều staff                                | 1. Mở Split Tip 2. Chọn "Manual" 3. Nhập số tiền cho từng staff                          | Tổng các phần Manual phải bằng Total Tip trước khi Confirm                                                                                                                                  | e2e        | P1      |
| TC-ORDERFLOW-38 | Split Tip — dialog gồm Title/Total Tip/3 option/list staff/Confirm                         | [LINEAR-ONLY]                                                  | 1. Mở Split Tip                                                                          | Title "Split Tip", "Total Tip", 3 tab Split Evenly/Proportion/Manual, list staff nickname, nút Confirm                                                                                      | regression | P2      |
| TC-ORDERFLOW-39 | Checkout — 4 phương thức hiển thị đúng số tiền trên nút                                    | Order đã Pay, ở `/checkout`                                    | 1. Xem 4 nút Card/Cash/Gift Card/Other                                                   | Mỗi nút show label + amount tương ứng order total                                                                                                                                           | e2e        | P1      |
| TC-ORDERFLOW-40 | Checkout — Pay By Cash với Quick amount                                                    | Ở checkout, chọn Cash                                          | 1. Chọn Cash 2. Click Quick amount ($100/$50/$20/$10)                                    | Amount field cập nhật theo quick amount, Change hiển thị nếu Amount > Total                                                                                                                 | e2e        | P1      |
| TC-ORDERFLOW-41 | Checkout — Pay By Cash, Amount < Total chỉ enable "Pay"                                    | Ở Cash, chưa đủ tiền                                           | 1. Nhập Amount < Total Order                                                             | Nút "Pay" hiển thị (chưa phải Complete Payment), Remaining > 0                                                                                                                              | regression | P1      |
| TC-ORDERFLOW-42 | Checkout — Pay By Cash đủ tiền hiện "Complete Payment"                                     | Ở Cash                                                         | 1. Nhập Amount ≥ Total Order                                                             | Nút đổi thành "Complete Payment", Remaining = 0                                                                                                                                             | e2e        | P1      |
| TC-ORDERFLOW-43 | Checkout — thanh toán nhiều lần (partial pay) tạo nhiều payment                            | Order lớn, trả nhiều lần                                       | 1. Pay lần 1 với Amount < Total 2. Pay tiếp phần còn lại                                 | Mỗi lần Pay tạo 1 payment riêng, Total Paid cộng dồn tới khi Complete Order                                                                                                                 | edge       | P2      |
| TC-ORDERFLOW-44 | Checkout — Pay By Card dừng ở màn nhập số tiền (không có terminal thật)                    | Ở checkout, chọn Card                                          | 1. Chọn Card 2. Nhập amount = order total                                                | Complete Payment hiển thị nhưng có thể vẫn disabled tới khi terminal xác nhận charge thành công (giới hạn môi trường test)                                                                  | regression | P2      |
| TC-ORDERFLOW-45 | Checkout — Pay By Gift Card, nhập code thủ công                                            | Ở checkout, chọn Gift Card                                     | 1. Chọn Gift Card 2. "Input Gift Card Code" 3. Nhập code hợp lệ 4. Confirm               | "Gift Card Accepted" hiển thị, sau đó Pay khả dụng                                                                                                                                          | e2e        | P1      |
| TC-ORDERFLOW-46 | Checkout — Pay By Other yêu cầu nhập tên phương thức                                       | Ở checkout, chọn Other                                         | 1. Chọn Other 2. Nhập "Input payment method name" 3. Complete Payment                    | Payment Success hiển thị "Other (<tên đã nhập>)"                                                                                                                                            | e2e        | P1      |
| TC-ORDERFLOW-47 | Checkout — Tip button disable tới khi có payment method                                    | Ở checkout, chưa chọn method                                   | 1. Kiểm tra nút Tip trước khi chọn method                                                | Tip disabled; sau khi chọn method → enable                                                                                                                                                  | regression | P2      |
| TC-ORDERFLOW-48 | Checkout — Print xuất receipt preview không gồm Payment Method                             | Ở checkout                                                     | 1. Click Print                                                                           | Receipt in ra không hiển thị Payment Method (chỉ staff/service/summary)                                                                                                                     | edge       | P3      |
| TC-ORDERFLOW-49 | Checkout — Cash Drawer action                                                              | Ở checkout                                                     | 1. Click "Cash Drawer"                                                                   | Trigger mở ngăn kéo tiền (best-effort assertion — hardware-dependent, có thể chỉ verify click không lỗi)                                                                                    | regression | P3      |
| TC-ORDERFLOW-50 | Payment Successful — 4 action Receipt                                                      | Sau Complete Payment                                           | 1. Xem màn Payment Successful!                                                           | 4 nút: No Receipt / Print / SMS (Text Message) / Email                                                                                                                                      | e2e        | P1      |
| TC-ORDERFLOW-51 | Payment Successful — No Receipt trả về Home/Order Pending                                  | Ở màn Payment Successful                                       | 1. Click "No Receipt"                                                                    | Điều hướng về `/home` hoặc `/order-pending`                                                                                                                                                 | regression | P2      |
| TC-ORDERFLOW-52 | Handling Network Disconnect — Card mất mạng, có transaction card mới khi Try again         | [LINEAR-ONLY] Đang thanh toán Card thì mất mạng                | 1. Mất mạng giữa thanh toán Card 2. Online lại, click Try again                          | Nếu xuất hiện transaction card mới: số tiền cần thanh toán = 0, cho Complete Payment (không tạo transaction $0), khoá nút back                                                              | edge       | P3      |
| TC-ORDERFLOW-53 | Handling Network Disconnect — không có transaction mới                                     | [LINEAR-ONLY]                                                  | 1. Try again không thấy transaction mới                                                  | Amount không đổi, cho thanh toán tiếp bằng method khác, sau đó check Order History để quyết định void                                                                                       | edge       | P3      |
| TC-ORDERFLOW-54 | Order History listing — filter Staff/Payment Method/Status                                 | Có sẵn order                                                   | 1. Mở `/order-history` 2. Click "Filter" 3. Mở Select payment method / Select status     | Payment Method checkbox Card/Cash/Gift Card/Other; Status checkbox Successful-Unsettled/Settled/Canceled/Refunded/Partial Refunded                                                          | regression | P2      |
| TC-ORDERFLOW-55 | Order Detail — Successful Unsettled: action Receipt/Re-Open/Cancel                         | [LINEAR-ONLY] Order status Successful - Unsettled              | 1. Mở order Unsettled                                                                    | Action buttons: Receipt, Re-Open Order, Cancel Order; Split Tip khả dụng                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-56 | Order Detail — Successful Settled: action Receipt/Refund/Partial Refund                    | Order status Successful - Settled (nếu có sẵn trong demo data) | 1. Mở order Settled                                                                      | Action buttons: Receipt, Refund, Partial Refund; không có Cancel/Re-Open                                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-57 | Order Detail — Canceled: chỉ có Receipt + Cancel Information                               | Order status Canceled                                          | 1. Mở order Canceled                                                                     | Chỉ action Receipt; block "Cancel Information": Amount, Date & Time, By Staff, Reason                                                                                                       | e2e        | P1      |
| TC-ORDERFLOW-58 | Order Detail — Refunded: chỉ có Receipt + Refund Information                               | Order status Refunded                                          | 1. Mở order Refunded                                                                     | Chỉ action Receipt; block "Refund Information": title "Refund #OD-ID-CheckID", Amount, Date & Time, Method, By Staff, Reason                                                                | e2e        | P1      |
| TC-ORDERFLOW-59 | Order Detail — Partial Refunded: Receipt + Refund + Partial Refund                         | Order status Partial Refunded                                  | 1. Mở order Partial Refunded                                                             | 3 action: Receipt, Refund (refund hết phần còn lại), Partial Refund; có block Refund Information                                                                                            | e2e        | P1      |
| TC-ORDERFLOW-60 | Refund — credit transaction chưa Batch/Close → disable + alert                             | Order Settled có credit transaction chưa batch                 | 1. Click Refund                                                                          | Nút Refund disabled; nếu ép click → alert "Refund Not Available"                                                                                                                            | edge       | P2      |
| TC-ORDERFLOW-61 | Refund — chọn All service = Full Refund, autofill total order                              | Order Settled, nhiều service                                   | 1. Click Refund 2. Chọn option "All"                                                     | Amount autofill = total order (gồm Tip nếu có)                                                                                                                                              | e2e        | P1      |
| TC-ORDERFLOW-62 | Refund — chọn 1 phần service = Partial Refund, autofill đúng giá + chia % discount         | Order Settled có discount, nhiều service                       | 1. Click Refund 2. Chọn 1 service                                                        | Amount autofill theo giá service đã phân bổ % discount tương ứng (VD Linear: refund service $100/$200 discount $20 → trả $90)                                                               | edge       | P2      |
| TC-ORDERFLOW-63 | Refund dialog — field đầy đủ (Select service, Refund method, Amount, Reason optional)      | Đang mở dialog Refund                                          | 1. Xem dialog                                                                            | Title "Refund", mô tả, Select services/products (All/từng dòng), Refund method Cash/Card/Other (không Gift Card), Refund amount autofill, Reason optional (list lý do chuẩn), Cancel/Refund | regression | P1      |
| TC-ORDERFLOW-64 | Cancel Order — yêu cầu staff code (By Staff)                                               | Order Unsettled                                                | 1. Click Cancel Order 2. Xác nhận qua passcode                                           | Order chuyển Canceled, ghi nhận "By Staff"                                                                                                                                                  | e2e        | P1      |
| TC-ORDERFLOW-65 | Reopen Order — chỉ cho phép 1 lần                                                          | [LINEAR-ONLY] Order đã reopen 1 lần                            | 1. Mở lại order đã từng reopen                                                           | Không còn action Reopen (đã dùng hết lượt)                                                                                                                                                  | edge       | P2      |
| TC-ORDERFLOW-66 | Reopen Order — nút đổi thành "Continue Re-open" khi đang dở                                | [LINEAR-ONLY] Order đang ở trạng thái re-open                  | 1. Mở Order History                                                                      | Nút hiển thị "Continue Re-open" thay vì "Re-open"                                                                                                                                           | edge       | P2      |
| TC-ORDERFLOW-67 | Reopen Order — Void all thay cho void từng transaction                                     | [LINEAR-ONLY] Đang reopen, sửa service làm lệch số tiền        | 1. Sửa/xoá service trong lúc reopen                                                      | Nút chung "Void all" xuất hiện (không còn nút void riêng từng transaction)                                                                                                                  | edge       | P3      |
| TC-ORDERFLOW-68 | Reopen Order — field bị khoá theo version cũ (Discount/Tax), Service fee/Cashback tính lại | [LINEAR-ONLY]                                                  | 1. Reopen order, thay đổi subtotal                                                       | Discount/Promotion/Reward và Tax giữ nguyên version cũ; Service fee và Cashback tính lại theo subtotal/total mới                                                                            | edge       | P3      |
| TC-ORDERFLOW-69 | Adjust Tip — chỉ hiện khi Successful-Unsettled + method Card(Auth)/Cash/Other              | [LINEAR-ONLY]                                                  | 1. Mở order Unsettled với Gift Card                                                      | Action Adjust Tip KHÔNG hiển thị cho Gift Card                                                                                                                                              | edge       | P2      |
| TC-ORDERFLOW-70 | Adjust Tip — order nhiều payment method phải chọn 1 method cụ thể                          | [LINEAR-ONLY] Order nhiều payment method                       | 1. Click Adjust Tip                                                                      | Hiện list payment method, bắt buộc chọn 1 trước khi tiếp tục                                                                                                                                | edge       | P2      |
| TC-ORDERFLOW-71 | Header Bar — Cash Drawer mở ngăn kéo từ banner                                             | Ở `/home`                                                      | 1. Mở icon menu header (nếu cần) 2. Click Cash Drawer                                    | Trigger mở cash drawer (best-effort — phần cứng, verify không lỗi khi click)                                                                                                                | regression | P3      |
| TC-ORDERFLOW-72 | Header Bar — Scan Giftcard hiển thị thông tin nhanh                                        | Ở `/home`                                                      | 1. Click "Scanner" trong banner                                                          | Mở luồng scan; scan Barcode/QR Giftcard cho ra info nhanh (best-effort trong môi trường test không có scanner thật)                                                                         | regression | P3      |
| TC-ORDERFLOW-73 | Header Bar — Scan Order QR redirect Order History                                          | Ở `/home`                                                      | 1. Scan QR order hợp lệ                                                                  | Redirect `/order-history` đúng order                                                                                                                                                        | regression | P3      |
| TC-ORDERFLOW-74 | Search toàn cục — 5 tab All/Appointment/Checkin/Order/Customer                             | Ở `/home`                                                      | 1. Mở Search (Ctrl+K hoặc icon Search) 2. Nhập customer phone                            | 5 tab kết quả: All/Appointment/Checkin/Order/Customer; không có kết quả → icon "No data"                                                                                                    | e2e        | P1      |
| TC-ORDERFLOW-75 | Search — theo Order ID redirect đúng Order History Detail                                  | Có order tồn tại                                               | 1. Nhập Order ID vào Search                                                              | Tab Order trả đúng order, click redirect `/order-history/<id>`                                                                                                                              | e2e        | P1      |

## 8. Nguồn tham chiếu

- **Linear (nguồn gốc):** [Order Flow](https://linear.app/fastboy/document/order-flow-1bd212f296da) — bản offline: [docs/linear/order-flow.md](../linear/order-flow.md) (1468 dòng, đã đọc đầy đủ).
- **Đối chiếu chéo:** [docs/linear/order-management.md](../linear/order-management.md) (Portal/Admin view) · [docs/linear/order-pending.md](../linear/order-pending.md) · [docs/linear/split-order.md](../linear/split-order.md) · [docs/linear/portal-order-history.md](../linear/portal-order-history.md) · [docs/linear/portal-support-edit-completed-order.md](../linear/portal-support-edit-completed-order.md).
- **Feature-spec liên quan đã có sẵn:** [docs/features/home.md](./home.md) (i18n + popup chi tiết màn Home) · [docs/features/order-history.md](./order-history.md) · [docs/features/order-pending.md](./order-pending.md).
- **Ảnh quét (Playwright MCP, 2026-07-15):** [order-flow-assets/01-home.png](./order-flow-assets/01-home.png) · [order-flow-assets/02-cart.png](./order-flow-assets/02-cart.png) · [order-flow-assets/03-checkout.png](./order-flow-assets/03-checkout.png).
- **Cấu hình môi trường quét:** `playwright.config.ts` (`baseURL` local `http://localhost:1420`, `workers: 1` vì backend share state giữa các phiên).
