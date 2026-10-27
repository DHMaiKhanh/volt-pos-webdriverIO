# Create Order — Master test-case catalog (Volt POS Nail, Windows)

> Tổng hợp ĐẦY ĐỦ luồng **tạo order** trên màn Home: gộp `order-flow-test-cases.md`
> (TC-ORDERFLOW-01..87), các mục create-order từ Linear (xem `docs/qc/linear-pos-testcase-catalog.md`),
> và hành vi thực tế của app. Mỗi dòng là 1 test case với **trạng thái coverage** trong suite.
>
> Cột **Coverage**: `✅ spec` (đã có spec chạy thật) · `🟡 pending` (đã khai trong source, chờ
> fixture/hardware) · `🔴 missing` (chưa có, cần bổ sung). Cột **Spec** trỏ file thực thi.

Map page object: [`src/pages/pos/HomePage.ts`](../../../src/pages/pos/HomePage.ts) · dialog Quick Pay
nằm trong HomePage · checkout handoff [`CheckoutPage.ts`](../../../src/pages/pos/CheckoutPage.ts).

---

## 1. Entry points — mở một draft order

| ID          | Test case                                                | Expected                                                                                 | Coverage   | Spec                     | Source  |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | ------------------------ | ------- |
| CO-ENTRY-01 | Chọn staff khi chưa có order → tự tạo order Processing   | Pending list thêm order status Processing, customer Unknown, $0.00; cart mở với staff đó | ✅ spec    | home-cart (TC-77)        | app     |
| CO-ENTRY-02 | Mở Quick Pay tạo dòng tự do                              | Dialog Quick Pay, thêm item vào cart dưới staff                                          | ✅ spec    | quick-pay (TC-14/15)     | app     |
| CO-ENTRY-03 | Bán Gift Card từ Home (nút Gift Card)                    | Dialog bán thẻ, thêm dòng GC vào order                                                   | 🔴 missing | —                        | app     |
| CO-ENTRY-04 | Tạo order từ Pending (Quick Checkout)                    | Mở lại order pending để thanh toán                                                       | ✅ spec    | order-pending (TC-OP-07) | app     |
| CO-ENTRY-05 | Checkout cả nhóm service của 1 appointment thành 1 order | Multi-service appointment → 1 order                                                      | 🟡 pending | appointment-*            | VP-3151 |
| CO-ENTRY-06 | Tạo order từ check-in (GoCheckin) ở Pending              | Check-in sync → pending order                                                            | ✅ spec    | web-checkin-to-pos       | app     |

## 2. Chọn & quản lý Staff

| ID          | Test case                                                                          | Expected                                    | Coverage                                 | Spec              | Source       |
| ----------- | ---------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- | ----------------- | ------------ |
| CO-STAFF-01 | Panel staff render đủ (search + tabs All/Group)                                    | Danh sách staff + ô search hiển thị         | ✅ spec                                  | home-cart (TC-01) | app          |
| CO-STAFF-02 | Search staff theo nickname lọc đúng                                                | List chỉ còn card khớp                      | ✅ spec                                  | home-cart (TC-04) | app          |
| CO-STAFF-03 | **Chọn được staff sau khi search** (regression)                                    | Sau khi lọc, click card vẫn chọn được staff | 🔴 missing                               | —                 | VP-1572      |
| CO-STAFF-04 | Chọn service trước staff → popup "Select Staff First"                              | Popup cảnh báo, nút Done                    | ✅ spec                                  | home-cart (TC-02) | app          |
| CO-STAFF-05 | Update/Change staff của order                                                      | Vào swap mode, chọn staff khác → thay thế   | ✅ spec (swap mode) / 🔴 (hoàn tất swap) | home-cart (TC-11) | app          |
| CO-STAFF-06 | Delete staff xoá toàn bộ service của staff đó                                      | Staff + service của staff biến mất          | ✅ spec                                  | home-cart (TC-12) | app          |
| CO-STAFF-07 | **Multi-staff**: thêm staff thứ 2, mỗi staff 1 nhóm service                        | Cart group theo từng staff, total cộng dồn  | 🔴 missing                               | —                 | app          |
| CO-STAFF-08 | Hiện staff status Available/Busy ở Turn (không "Available" trước khi chọn service) | Status thật theo turn                       | 🟡 pending                               | turn-*            | VP-3247/3434 |

## 3. Chọn Service / Product

| ID        | Test case                                                                 | Expected                                              | Coverage   | Spec              | Source      |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ----------------- | ----------- |
| CO-SVC-01 | Panel service render (search + category grid gồm Quick Pay/Gift Card đầu) | Grid + search hiển thị                                | ✅ spec    | home-cart (TC-01) | app         |
| CO-SVC-02 | Chọn staff → chọn service thành công, giá đúng, Pay enable                | Service thêm vào cart, Pay bật                        | ✅ spec    | home-cart (TC-03) | app         |
| CO-SVC-03 | Search service theo tên trả đúng                                          | List lọc đúng service                                 | ✅ spec    | home-cart (TC-05) | app         |
| CO-SVC-04 | Thêm service thứ 2 → subtotal tăng                                        | Subtotal tăng, total khớp công thức                   | ✅ spec    | create-order      | app         |
| CO-SVC-05 | Thêm cùng 1 service nhiều lần (quantity)                                  | Mỗi lần thêm 1 dòng/tăng qty; subtotal tăng tương ứng | 🔴 missing | —                 | app         |
| CO-SVC-06 | Thêm **Product** (không gắn staff) → product tax đúng                     | Dòng product, tax theo product rate                   | 🔴 missing | —                 | app/VP-4079 |
| CO-SVC-07 | Nhóm Basic vs Additional Services                                         | Service đúng nhóm                                     | 🔴 missing | —                 | app         |

## 4. Sửa dòng trong Cart (service editor)

| ID         | Test case                                          | Expected                                             | Coverage                                             | Spec              | Source       |
| ---------- | -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ----------------- | ------------ |
| CO-LINE-01 | Edit price của service (click dòng → sửa → Save)   | Giá hiển thị đúng giá đã sửa; không về âm            | ✅ spec                                              | home-cart (TC-22) | app          |
| CO-LINE-02 | Apply Item Discount cho 1 service (% hoặc $)       | Giá gốc + discount hiển thị đúng                     | ✅ spec                                              | home-cart (TC-23) | app          |
| CO-LINE-03 | Service note ≤ 50 ký tự, hiện dưới tên service     | Note chặn ở 50 ký tự                                 | ✅ spec                                              | home-cart (TC-24) | app          |
| CO-LINE-04 | Remove 1 dòng service                              | Dòng biến mất, total giảm                            | 🔴 missing (có removeService nhưng chưa có TC riêng) | —                 | app          |
| CO-LINE-05 | Reset amount trước khi gõ giá (InputCurrency mask) | Phải bấm "Reset amount" rồi mới gõ; assert read-back | ✅ (page object)                                     | home-cart (TC-22) | app (memory) |

## 5. Customer

| ID         | Test case                                                       | Expected                                                                            | Coverage                          | Spec                   | Source  |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- | ---------------------- | ------- |
| CO-CUST-01 | Nhập phone mới → form "Add new customer"                        | Dialog Phone (điền sẵn), Name optional default Unknownxxxx, Group, Save/X/View More | ✅ spec                           | customer-entry (TC-06) | app     |
| CO-CUST-02 | Nhập phone đã tồn tại → "Customers Found", chọn gắn vào order   | List khách, chọn 1 → gắn                                                            | 🟡 pending (cần customer fixture) | customer-entry (TC-07) | app     |
| CO-CUST-03 | Phone trùng nhiều khách, không chọn mà Done → tự chọn khách đầu | Auto-chọn khách đầu, tiếp tục                                                       | 🟡 pending                        | customer-entry (TC-08) | app     |
| CO-CUST-04 | Skip customer → "Unknown", order vẫn tạo                        | Customer = Unknown                                                                  | 🟡 pending (chưa có locator Skip) | customer-entry (TC-09) | app     |
| CO-CUST-05 | Khách có Customer Note → popup note khi chọn                    | Popup note (view-only) trước Done                                                   | 🟡 pending                        | customer-entry (TC-10) | app     |
| CO-CUST-06 | Check-in khách mới trên order đã trả không freeze (regression)  | Không freeze                                                                        | 🔴 missing                        | —                      | VP-3341 |

## 6. Order-level: Promo & Rewards / Note / Merge

| ID        | Test case                                                    | Expected                                                                        | Coverage                          | Spec              | Source  |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- | ----------------- | ------- |
| CO-ORD-01 | Promo & Rewards mở dialog Add Promo                          | Dialog: list promo hệ thống + Custom (% 0.1–100, hoặc $ ≤ giá trước Reward/Tax) | ✅ spec (mở dialog)               | home-cart (TC-18) | app     |
| CO-ORD-02 | **Áp dụng** 1 promotion → total giảm đúng                    | Subtotal giữ, promotion trừ đúng, total khớp                                    | 🔴 missing                        | —                 | app     |
| CO-ORD-03 | Promo/Reward FIXED > phần giảm được → cap (không lưu nguyên) | Discount cap theo phần giảm được                                                | 🔴 missing                        | —                 | VP-4375 |
| CO-ORD-04 | Promo/Reward **bị chặn** khi order chỉ bán Gift Card         | Không cho chọn promo/reward                                                     | 🔴 missing                        | —                 | VP-4162 |
| CO-ORD-05 | Hiện tổng Promotion & Reward khả dụng khi tạo order          | Màn tạo order hiện tổng promo/reward                                            | 🔴 missing                        | —                 | VP-4802 |
| CO-ORD-06 | Reward ẩn cho tới khi chọn khách                             | Reward option không hiện trước khi có customer                                  | 🔴 missing                        | —                 | VP-3564 |
| CO-ORD-07 | Note đơn mở dialog, giới hạn 50 ký tự                        | Dialog note, chặn 50 ký tự                                                      | ✅ spec (mở) / 🔴 (giới hạn)      | home-cart (TC-19) | app     |
| CO-ORD-08 | Merge Order khả dụng khi order có ≥1 line (và ≥2 order mở)   | Nút Merge offered; dialog chọn order gộp                                        | ✅ spec (offered) / 🔴 (gộp thật) | home-cart (TC-20) | app     |

## 7. Quick Pay (dòng tự do)

| ID       | Test case                                                                           | Expected                                 | Coverage                                          | Spec              | Source  |
| -------- | ----------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- | ----------------- | ------- |
| CO-QP-01 | Quick Pay chưa chọn staff → "Select Staff First"                                    | Popup, không mở dialog                   | ✅ spec                                           | quick-pay (TC-13) | app     |
| CO-QP-02 | Dialog Quick Pay đủ field (Amount/Name/Note 0/80/Apply Discount/Add disabled/Close) | Dialog đúng field                        | ✅ spec                                           | quick-pay (TC-14) | app     |
| CO-QP-03 | Add chỉ enable khi đủ Amount + Service Name                                         | Add bật sau khi đủ 2 field               | ✅ spec                                           | quick-pay (TC-15) | app     |
| CO-QP-04 | Amount cap $9,999,999.99                                                            | Nhập > max bị clamp/chặn                 | 🟡 pending → **bổ sung**                          | quick-pay (TC-16) | app     |
| CO-QP-05 | Quick Pay item không persist & không apply Item Discount                            | Item trong cart; không cho item-discount | 🟡 pending → **bổ sung**                          | quick-pay (TC-17) | app     |
| CO-QP-06 | Quick Pay yêu cầu passcode (khi bật setting)                                        | Hỏi passcode                             | 🔴 missing                                        | —                 | VP-3115 |
| CO-QP-07 | Apply Discount trong Quick Pay (% / $) hoạt động                                    | Discount áp đúng vào dòng quick pay      | ✅ (page object có applyQuickPayDiscount) / 🔴 TC | —                 | app     |

## 8. Tổng tiền (arithmetic) & phí

| ID        | Test case                                                           | Expected                                                   | Coverage   | Spec              | Source            |
| --------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ----------------- | ----------------- |
| CO-SUM-01 | Cart footer Subtotal/Tax/Total reconcile                            | total = subtotal − itemDiscount − promotion − reward + tax | ✅ spec    | home-cart (TC-21) | app               |
| CO-SUM-02 | Service Tax áp ở order level (checkout & split)                     | Service tax đúng                                           | 🟡 pending | checkout/split    | VP-3334/3335      |
| CO-SUM-03 | Service Fee (card) & Cash Discount áp đúng; **loại Gift Card sale** | GC sale không bị SF/CD                                     | 🔴 missing | —                 | VP-4379/3812/4083 |
| CO-SUM-04 | Discount Charge chỉ tính service, không gồm product no-staff        | Scope đúng                                                 | 🔴 missing | —                 | VP-3436           |

## 9. Vòng đời draft & handoff

| ID         | Test case                                                  | Expected                                     | Coverage                      | Spec              | Source             |
| ---------- | ---------------------------------------------------------- | -------------------------------------------- | ----------------------------- | ----------------- | ------------------ |
| CO-LIFE-01 | Remove (Delete Order) xoá cả draft, confirm "Delete Order" | Dialog confirm → về Home, order khỏi Pending | ✅ spec                       | home-cart (TC-78) | app                |
| CO-LIFE-02 | Xoá order yêu cầu staff passcode (guard 2 bước)            | Guard passcode → Delete                      | ✅ (confirmDestructiveAction) | home-cart (TC-78) | VP-3822 (memory)   |
| CO-LIFE-03 | Draft là priced & payable (Pay enable)                     | Pay bật khi có line có giá                   | ✅ spec                       | home-cart (TC-03) | app                |
| CO-LIFE-04 | Pay → chuyển sang Checkout                                 | pressPay mở CheckoutPage                     | ✅ (page object)              | checkout specs    | app                |
| CO-LIFE-05 | Rời Home giải phóng order claim (không giữ claimed)        | Order claim released                         | 🔴 missing                    | —                 | VP-4523 (canceled) |
| CO-LIFE-06 | 2 pending cùng phone không bị auto-link/auto-complete      | Không gộp                                    | 🔴 missing                    | —                 | VP-3314            |

## 10. Header / Search / Scan (quanh create-order)

| ID        | Test case                                                             | Expected                                        | Coverage                                       | Spec                      | Source |
| --------- | --------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------- | ------ |
| CO-HDR-01 | Global Search 4 tab All/Appointment/Customer/Order (KHÔNG có Checkin) | Dialog Search 4 tab, placeholder đúng           | 🟡 pending → **bổ sung** (cần GlobalSearch PO) | header-and-search (TC-74) | app    |
| CO-HDR-02 | Search theo Order ID → redirect Order History detail                  | Tab Order trả đúng, click → /order-history/<id> | 🟡 pending → **bổ sung**                       | header-and-search (TC-75) | app    |
| CO-HDR-03 | Cash Drawer KHÔNG ở header                                            | Không có control                                | 🟡 manual (absence)                            | header-and-search (TC-71) | app    |
| CO-HDR-04 | Scan gift card xem nhanh                                              | Cần scanner                                     | 🟡 blocked (hardware)                          | header-and-search (TC-72) | app    |
| CO-HDR-05 | Scan order QR → Order History                                         | Cần scanner                                     | 🟡 blocked (hardware)                          | header-and-search (TC-73) | app    |

---

## Tổng kết gap create-order (ưu tiên bổ sung)

**Bổ sung được ngay (verify live rồi code):**

1. CO-HDR-01/02 — dựng `GlobalSearch` page object → TC-74/75.
2. CO-QP-04/05 — Quick Pay clamp + non-persistence/no-item-discount (TC-16/17).
3. CO-CUST-02..05 — customer fixture (tạo khách biết trước phone) → TC-07/08/09/10.
4. CO-STAFF-03 — chọn staff sau search (VP-1572).
5. CO-STAFF-07 — multi-staff order.
6. CO-SVC-05/06 — quantity + product line (+ product tax).
7. CO-ORD-02/03/04/05 — áp promotion thật, cap FIXED, chặn promo GC-only, hiện tổng promo/reward.
8. CO-LINE-04 — remove 1 dòng service.

**Chặn bởi hardware/thiết kế:** CO-HDR-04/05 (scanner), CO-STAFF-08 (turn status cần data turn).
