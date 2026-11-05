---
title: Receipt in giá service đã gồm Service fee khi tắt "Group items by staff or guest" — test cases
ticket: VP-5634 — https://linear.app/fastboy/issue/VP-5634/bug-ticket-1580486-receipt-khong-show-gia-tien-service-bao-gom-sf-dual
sub-issues: —
spec-files: tests/regression/checkout/vp-5634-receipt-service-fee.spec.ts
imported-at: 2026-11-05
updated-at: 2026-11-05
---

# Test Cases – [Bug] Ticket #1580486 – Receipt không show giá tiền service bao gồm SF (Dual-screen có SF)

**Ticket:** [VP-5634](https://linear.app/fastboy/issue/VP-5634/bug-ticket-1580486-receipt-khong-show-gia-tien-service-bao-gom-sf-dual) · project Maintenance 2026-Q4-M11-W1 · CRM #1580486 (Tyra Hair Studio #20654)
**Dev:** Nam Pham (`nam_pham`) · PR FastboyMarketing/volt-pos#3335 (vào `develop`, merge 05/11 01:29 UTC, có từ bản dev **1.1.98**)
**Trạng thái:** QC Completed — test tay trên dev 1.1.98 (05/11/2026): 6/6 PASS.

## Hành vi mong đợi

1. Khi tiệm **tắt** Settings → Receipt → "Group items by staff or guest", mỗi dòng service trên receipt in **`finalPrice`** (giá đã gồm Service fee với Card) — giống màn khách (Dual-screen) và giống layout group.
2. Cộng các dòng service = **Subtotal** in trên receipt.
3. Cờ group chỉ đổi **layout** (dòng "Staff" / tên staff và thụt lề), không đổi **số tiền**.
4. Cash (không có fee): dòng service vẫn là giá gốc như trước.
5. Fix dùng chung cho P8D (receipt Android + Print Check) qua `selectReceiptItems`.

Trước fix (nhánh ungrouped): in `service.price` → Card 2.5%: $45.00 + $50.00 nhưng Subtotal $97.38.

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.98**, cửa sổ khách `/customer/` mở.
- Tiệm có Service fee > 0 cho Card (merchant 14: 3%), Service tax 5%.
- Không cần máy in: spec bọc `__TAURI_INTERNALS__.invoke`, ghi lại `mutation print($data)` (base64 ESC/POS) và trả `print: true` → giải mã thành text receipt để so sánh.
- 2 service có giá cố định: `VP5634_SERVICE_1` (mặc định "Tropical Deluxe" $54.00), `VP5634_SERVICE_2` (mặc định "Full set Ombre (2 colors)" $50.00).
- Cờ "Group items by staff or guest" là setting **toàn merchant** (`@exclusive`): spec đổi + Save, cuối spec trả về giá trị ban đầu.
- TC Order History cần ít nhất 1 order **Card** đã thanh toán có Service fee trong 7 ngày (lọc Payment Method = Card).
- Passcode staff 8888 cho Settings / Complete Payment.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được ở đây · 🐞 đang FAIL do bug đã log.

## 1. In receipt ở màn thanh toán

| TC ID        | Title                                          | Priority | Precondition                        | Test Data                              | Steps                                                   | Expected Result                                                                                                                        | Status |
| ------------ | ---------------------------------------------- | -------- | ----------------------------------- | -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5634-01 | Group ON – Card – Print (đối chứng)            | Medium   | Bật "Group items by staff or guest" | 1 staff, service 1 + 2                 | 1. Tạo order 2. Pay → Card 3. Bấm Print                 | Có dòng tên staff, service thụt lề; giá mỗi dòng = giá trên panel Card (đã gồm fee, > giá gốc); cộng các dòng = Subtotal               | ✅     |
| TC-VP5634-02 | Group OFF – Card – Print (case lỗi của ticket) | Critical | Tắt cờ → Save                       | 1 staff, service 1 + 2                 | 1. Tạo order 2. Pay → Card 3. Bấm Print                 | Không có dòng tên staff / thụt lề; giá mỗi dòng = giá panel Card (gồm fee, không phải giá gốc); cộng các dòng = Subtotal; Total = Card | ✅     |
| TC-VP5634-03 | Màn khách (Dual-screen) khớp receipt           | High     | Như TC-02                           | Như TC-02                              | Ở màn Card, đọc Order Details trên màn khách, bấm Print | Giá từng service trên màn khách = giá từng dòng trên receipt; Subtotal bằng nhau                                                       | ✅     |
| TC-VP5634-04 | Group OFF – Cash – Print                       | High     | Như TC-02                           | Như TC-02                              | 1. Pay → Cash 2. Bấm Print                              | Dòng service = giá gốc (Cash không cộng fee), cộng các dòng = Subtotal; Total = số trên nút Cash                                       | ✅     |
| TC-VP5634-05 | Group OFF – order 2 staff – Card – Print       | High     | Như TC-02                           | staff 1 + staff 2, mỗi staff 1 service | 1. Tạo order 2 staff 2. Pay → Card 3. Print             | Không có tên staff nào trên receipt; 2 dòng service đều gồm fee; cộng = Subtotal                                                       | ✅     |

## 2. In receipt sau thanh toán / in lại

| TC ID        | Title                                                  | Priority | Precondition                           | Test Data                      | Steps                                                                   | Expected Result                                                                                  | Status |
| ------------ | ------------------------------------------------------ | -------- | -------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| TC-VP5634-06 | Group OFF – thanh toán Cash xong → Print               | Medium   | Như TC-02                              | Như TC-02, Cash, No Tip        | 1. Pay → Cash → Complete Payment → No Tip 2. Payment Successful → Print | Dòng service = giá gốc, cộng = Subtotal; có "Paid with:" + Cash                                  | ✅     |
| TC-VP5634-07 | Group OFF – Order History → Receipt → Print order Card | High     | Như TC-02; có order Card đã thanh toán | Order Card mới nhất (lọc Card) | 1. Order History → Filter Card → chọn order 2. Receipt → Print          | Giá mỗi dòng service trên receipt = giá ở Service Details (đã gồm fee); cộng các dòng = Subtotal | ⚠️     |

## 3. Settings / nền tảng khác

| TC ID        | Title                                   | Priority | Precondition        | Test Data | Steps                                                               | Expected Result                                                                | Status |
| ------------ | --------------------------------------- | -------- | ------------------- | --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| TC-VP5634-08 | Receipt Preview theo cờ group           | Low      | Settings → Receipt  | —         | Bật / tắt "Group items by staff or guest" (không Save), xem Preview | Bật: có "Staff: …" trên preview; tắt: không còn "Staff: …", vẫn có Service A–D | ✅     |
| TC-VP5634-09 | P8D receipt + Print Check khi tắt group | High     | Máy P8D (Android)   | Card + SF | Lặp TC-02 trên P8D, mở Print Check                                  | Như TC-02                                                                      | 🧱     |
| TC-VP5634-10 | In ra giấy thật                         | Medium   | Máy có máy in nhiệt | Như TC-02 | Lặp TC-02 với máy in thật                                           | Receipt giấy giống nội dung TC-02                                              | 🧱     |

## Ghi chú automation

- Spec bọc IPC `print` (dùng `installPrintCapture` của VP-4809): máy in **không** nhận lệnh, app nhận `print: true`.
- Receipt được giải mã ESC/POS: bỏ lệnh ESC/GS, bỏ ảnh raster (logo, QR, chữ ký) → text từng dòng.
- Mỗi case tạo order mới và xoá order nháp sau case (`resetTill`); TC-06 thanh toán thật bằng Cash.
- Cờ group được Save (merchant-global) → spec gắn `@exclusive`, `after()` trả cờ về giá trị ban đầu.
- ⚠️ TC-07: cần dữ liệu có sẵn (order Card có fee trong 7 ngày); không có → case fail với thông báo thiếu data.
- 🧱 TC-09: P8D là máy Android, không chạy trên lane Windows. 🧱 TC-10: máy test không có máy in. Hai TC này **comment lại** trong spec (không còn `it` rỗng).

Chạy: `npm run test:attach -- --spec tests/regression/checkout/vp-5634-receipt-service-fee.spec.ts`
