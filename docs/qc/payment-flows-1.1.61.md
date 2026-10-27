# Luồng thanh toán — Volt POS 1.1.61 (tiệm 14, DEV) — 26/10/2026

Lượt auto: 24 spec thanh toán, settle thật (`CARD_SETTLE=1`, `CHARGE_SETTLE=1`), retry 1 lần cho spec fail.
Thời gian: 1h07. Kết quả lần chạy cuối mỗi spec (dashboard `latest.json`): **51 pass · 34 fail · 101 skip** trên 186 case.
Card thật còn được test tay thêm 1 lần (đơn OD261026-35831732: $64.89 + tip $21, có chữ ký, đã lên server).

> 34 "fail" gồm cả các hook `before/after` hỏng dây chuyền. Số case nghiệp vụ fail thật ít hơn — xem phân loại.

## Kết quả theo hình thức thanh toán

| Hình thức        | Spec PASS                                           | Spec có fail                                                    | Ghi chú                                                                     |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Cash**         | cash-payment, charge-cash-matrix (10/10)            | charge-cash-matrix-2 (Quick Pay $50), vp-1432 (4)               | Đơn thường trả cash: PASS                                                   |
| **Card**         | card-payment, charge-card-matrix (10/10) + test tay | charge-card-matrix-2 (Quick Pay $50)                            | Charge thật qua máy quẹt: PASS                                              |
| **Gift Card**    | charge-giftcard-matrix (10/10, chạy lại)            | charge-giftcard-matrix-2 (Quick Pay $1)                         | Lượt 1 SKIP do thiếu thẻ tiệm 14; đã thêm thẻ và chạy lại → đơn thường PASS |
| **Other**        | charge-other-matrix (10/10)                         | charge-other-matrix-2 (Quick Pay $50)                           | Đơn thường trả Other: PASS                                                  |
| Split Order      | split-order (6/6), split-order-multi, split-tip     | —                                                               | PASS                                                                        |
| Payment Success  | payment-success (2/2)                               | —                                                               | PASS                                                                        |
| Quick Pay        | —                                                   | quick-pay (TC-14, 15), 3 matrix đợt 2                           | Xem phân loại #1, #2                                                        |
| Tip / Adjust Tip | —                                                   | tip-guards, adjust-tip, charge-discount-tip                     | Xem phân loại #4, #5                                                        |
| Khác             | —                                                   | checkout-tenders (TC-44, 49, 76), payment-reliability (PAY-R17) | Xem phân loại                                                               |

## Phân loại các case fail

| #   | Case                                              | Nguyên nhân                                                                                                   | Loại                                                                  |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Quick Pay $50 (TC-134, 144, 154), quick-pay TC-15 | 1.1.61 (tiệm 14) **đòi staff code trước khi mở Quick Pay**; test không nhập passcode nên không thấy ô số tiền | Test cần sửa (hành vi mới của app)                                    |
| 2   | quick-pay TC-14 "Add bị khoá khi chưa nhập"       | Trên 1.1.61 nút **Add bật sẵn**; bấm Add khi trống → giỏ thêm **"Unknown Service 1 — $0.00"**                 | 🐞 **Nghi lỗi app** (cho thêm dịch vụ $0 không tên) — cần PO xác nhận |
| 3   | vp-1432 TC-02..05                                 | Bấm $5/$50/$100 **thay** số tiền thay vì **cộng dồn**                                                         | 🐞 **Lỗi app đã biết**, vẫn còn trên 1.1.61                           |
| 4   | tip-guards TIP-01/R1, adjust-tip TC-69            | Nút Adjust Tip vẫn có và dialog mở bình thường (kiểm tay). Lúc fail dialog Adjust Tip đang mở đè lên nút      | Test (trạng thái để lại giữa các case)                                |
| 5   | charge-discount-tip TC-90/91/93                   | Không tìm thấy dòng giỏ / nút Tip sau khi cart bị kẹt từ case trước; dây chuyền "Return to the till"          | Test (dây chuyền) — cần chạy lại riêng để chắc                        |
| 6   | checkout-tenders TC-44                            | Test giả định chưa có máy quẹt; tiệm 14 đã có máy quẹt kết nối                                                | Môi trường                                                            |
| 7   | checkout-tenders TC-76                            | Kẹt "Customer is adding a tip" — tiệm 14 đẩy tip sang màn khách cả khi trả cash, spec chưa xử lý              | Test cần sửa                                                          |
| 8   | checkout-tenders TC-49                            | Nút Cash Drawer — kỳ vọng vị trí khác bản mới                                                                 | Test cần kiểm lại                                                     |
| 9   | payment-reliability PAY-R17                       | Không thấy nút lọc thanh toán trong Order History                                                             | Test cần kiểm lại (nghi đổi giao diện)                                |
| —   | Các hook "Return to the till"                     | Hỏng dây chuyền do case trước để lại dialog/overlay                                                           | Hệ quả, không phải lỗi riêng                                          |

## 🐞 Tái hiện: Quick Pay thêm được dịch vụ $0 không tên (1.1.61)

Ảnh: `screenshots/quickpay-1.1.61/`

1. Home → Quick Checkout → chọn thợ (Pamela).
2. Bấm tile **Quick Pay** → (nếu hỏi) nhập staff code.
3. Dialog mở: Custom Amount **$0.00**, Service Name trống, nút **Add đang bật** (`04-reopen-prefilled.png`).
4. Bấm **Add** khi chưa nhập gì.

- **Thực tế:** dialog đóng, không báo lỗi; giỏ thêm dòng **"Unknown Service 2 — $0.00"**, dòng được lưu vào DB (`servicePrice = 0`, `serviceId = null`) (`05-cart-after-empty-add.png`).
- **Kỳ vọng (bản cũ / TC-ORDERFLOW-14, 15):** Add khoá cho tới khi có số tiền > 0 **và** tên dịch vụ.
- **Mức ảnh hưởng:** đơn chỉ có dòng $0 vẫn vào được Checkout ($0.00) nhưng **Complete Payment bị khoá** → không chốt được đơn $0. Hậu quả: rác dòng $0 / đơn nháp $0 trong Pending Orders.
- Ghi chú: lần đầu mở dialog, Custom Amount hiện sẵn **$21.22** dù chưa gõ gì (Add → "Unknown Service 1 — $21.86"); mở lại thì về $0.00 — **không lặp lại được**, chỉ ghi nhận.
- Đơn test OD261026-41039159, OD261026-41102933 đã xoá sau khi tái hiện.

## Gift Card (chạy lại với thẻ 973047331197 của tiệm 14)

Chạy lại 5 spec, 9 phút 43 giây: **10 pass · 2 fail · 16 skip**.

| Spec                                                  | Kết quả                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| charge-giftcard-matrix (redeem + settle, 10 kịch bản) | ✅ **10/10 PASS**                                                                                                                        |
| charge-giftcard-matrix-2                              | ❌ Quick Pay $1.00 (TC-164) — cùng nguyên nhân #1 (passcode trước Quick Pay); hook dọn dẹp hỏng nên các case còn lại của spec không chạy |
| gift-card-payment (nhập mã tay, TC-45)                | ⚪ SKIP — cần catalog thẻ, catalog chỉ có cho tiệm 20258                                                                                 |
| giftcard-multi-pay (1 đơn trả bằng nhiều thẻ)         | ⚪ SKIP — cần ≥ 2 thẻ trong catalog, như trên                                                                                            |
| gift-card-guards                                      | ⚪ 13 case PENDING sẵn trong code (thiếu testid dialog bán thẻ) + 1 case cần catalog                                                     |

→ Trả bằng Gift Card trên đơn thường: **PASS**. Nhập mã tay và trả nhiều thẻ cho 1 đơn **chưa test được tự động trên tiệm 14** (cần lập catalog thẻ cho tiệm 14).

## Kết luận

- Thanh toán đơn thường bằng **Cash, Card, Gift Card, Other** trên 1.1.61: **PASS** (ma trận 10/10 mỗi loại + card thật).
- **Split Order, Payment Success: PASS.**
- Lỗi app cần báo: **vp-1432 (nút tiền nhanh không cộng dồn)**, **Quick Pay cho thêm dịch vụ $0 không tên**.
- Phần còn lại là test chưa theo kịp 1.1.61 (passcode trước Quick Pay, tip đẩy sang màn khách) — sửa test rồi chạy lại.
