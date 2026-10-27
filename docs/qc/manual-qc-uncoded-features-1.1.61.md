# QC tay — các tính năng chưa có spec tự động (Volt POS 1.1.61)

- Máy: Windows, tiệm **14** (Volt POS tiem test 14 v1), môi trường DEV
- Cách test: lái app thật qua CDP 9222 (attach), đối chiếu GraphQL nội bộ của app + MCP volt-pos (server)
- Cấu hình tiệm lúc test: Product Tax 5%, Service Tax 5%, Service Fee (card) 3%, Cash Discount 3%,
  Point Config cash/card/other = 100, gift card = tắt; Point Bonus = 10
- Ký hiệu: ✅ PASS · ❌ FAIL · ⛔ BLOCKED (không test được, có lý do) · ⏳ chưa chạy · 🐞 phát hiện ngoài TC

> Cột "1.1.57" là kết quả test tay ngày 26/10 trước khi update. Cột "1.1.61" điền sau khi chạy lại.

## 1. Checkout Type Setting — VP-4591

| TC    | Nội dung                                           | Kỳ vọng                                                                  | 1.1.57                      | 1.1.61 |
| ----- | -------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------- | ------ |
| CT-01 | POS đọc `selected_type` / `point_bonus` từ setting | Giá trị local khớp Portal, không cần restart POS                         | ✅ (đồng bộ trễ ~1h)        | ⏳     |
| CT-02 | Manual/Hybrid + Cash, có khách                     | Điểm = Point Config trên tiền trả ($73.50 → +73), không cộng Point Bonus | ✅                          | ⏳     |
| CT-03 | Manual/Hybrid + Other, có khách                    | +63 cho $63.00 theo config Other                                         | ✅                          | ⏳     |
| CT-04 | Đơn không có khách                                 | Không cộng điểm, không báo lỗi, không hiện block điểm                    | ✅                          | ⏳     |
| CT-05 | Re-open → Re-Open Done (complete lại)              | Không cộng điểm lần 2                                                    | ✅                          | ⏳     |
| CT-06 | Cancel sau khi checkout                            | Không trừ điểm, không gửi điểm âm                                        | ✅                          | ⏳     |
| CT-07 | Auto: complete đơn > $0                            | Cộng đúng Point Bonus, bỏ qua Point Config                               | ⛔ cần đổi Portal sang Auto | ⏳     |
| CT-08 | Auto: đơn $0 / chỉ bán gift card                   | Không cộng bonus, không hiện block điểm                                  | ⛔ cần Auto                 | ⏳     |
| CT-09 | Point Config gift card = tắt, trả bằng gift card   | 0 điểm cho phần gift card                                                | ⏳                          | ⏳     |

## 2. Service Tax — VP-3334 / 3335 / 3336

| TC    | Nội dung                                     | Kỳ vọng                               | 1.1.57                                 | 1.1.61 |
| ----- | -------------------------------------------- | ------------------------------------- | -------------------------------------- | ------ |
| ST-01 | Settings › Charge & Fee                      | Service Tax hiện 5%, chỉ đọc          | ⏳ (mở màn bằng URL làm app treo 🐞)   | ⏳     |
| ST-02 | Đơn chỉ service                              | Tax = 5%; item `taxPercent=5`         | ✅ ($30 → $1.50)                       | ⏳     |
| ST-03 | Đơn service + product                        | Chỉ 1 dòng Tax = tổng 2 loại          | ✅ ($70 → $3.50)                       | ⏳     |
| ST-04 | Card: thuế tính trên giá đã cộng service fee | $72.10 → Tax $3.61 → $75.71           | ✅                                     | ⏳     |
| ST-05 | Màn khách (customer display)                 | 1 dòng Tax, khớp màn chính            | ✅                                     | ⏳     |
| ST-06 | Tip base                                     | Không gồm thuế (tip trên $60 service) | ✅                                     | ⏳     |
| ST-07 | Order History detail + Receipt               | Tax đúng, 1 dòng, không ghi %         | ✅                                     | ⏳     |
| ST-08 | Cancel / void                                | Transaction void giữ đúng thuế        | ✅                                     | ⏳     |
| ST-09 | Split Order by Items                         | Tổng thuế các check = thuế đơn gốc    | ✅ (3.00 + 0.50 = 3.50)                | ⏳     |
| ST-10 | Re-open + thêm service → thuế tính lại       | Thuế mới = 5% subtotal mới            | ⛔ tile service bị khoá ở Edit Order   | ⏳     |
| ST-11 | Refund một phần trên đơn đã settle           | Hoàn đúng tỉ lệ thuế                  | ⏳ (chỉ đọc dialog, không refund thật) | ⏳     |

## 3. Reopen — sửa item & thợ — VP-2585

| TC    | Nội dung                           | Kỳ vọng                                         | 1.1.57                           | 1.1.61 |
| ----- | ---------------------------------- | ----------------------------------------------- | -------------------------------- | ------ |
| RE-01 | Edit Order: thêm service           | Thêm được 1 lần                                 | ❌/⛔ tile `pointer-events-none` | ⏳     |
| RE-02 | Edit Order: đổi thợ (Change Staff) | Đổi được, tiền không đổi                        | ⏳                               | ⏳     |
| RE-03 | Edit Order: xoá item               | Tiền + thuế tính lại, có void/refund chênh lệch | ⏳                               | ⏳     |

## 4. Dark mode — VP-3798 / 3799 / 3800

| TC    | Nội dung                                          | Kỳ vọng                               | 1.1.57 | 1.1.61 |
| ----- | ------------------------------------------------- | ------------------------------------- | ------ | ------ |
| DM-01 | Settings › Accessibility có Appearance Light/Dark | Có 2 lựa chọn                         | ⏳     | ⏳     |
| DM-02 | Chọn Dark                                         | Cả cửa sổ POS và màn khách chuyển tối | ⏳     | ⏳     |
| DM-03 | Restart app                                       | Giữ lựa chọn Dark                     | ⏳     | ⏳     |
| DM-04 | Trả về Light                                      | Về sáng cả 2 cửa sổ                   | ⏳     | ⏳     |

## 5. Gift card — áp Service Fee / Cash Discount — VP-3879

| TC       | Nội dung                       | Kỳ vọng                                  | 1.1.57                                 | 1.1.61 |
| -------- | ------------------------------ | ---------------------------------------- | -------------------------------------- | ------ |
| GC-SF-01 | Tender Gift Card trên checkout | Giá theo setting (không SF → = giá cash) | ✅ quan sát: Gift Card = Cash = $73.50 | ⏳     |

## 6. Archive Cash Order — VP-4007 (In Progress)

| TC    | Nội dung                     | Kỳ vọng         | 1.1.57 | 1.1.61 |
| ----- | ---------------------------- | --------------- | ------ | ------ |
| AR-01 | Có UI archive đơn cash không | Probe: có/không | ⏳     | ⏳     |

## 🐞 Phát hiện ngoài TC (1.1.57)

1. Receipt in "Current points: 522" (số cũ) dù khách vừa được +73 → 595.
2. Log điểm trên server: `createdAt` lệch +7h so với `updatedAt` (vd 23:24 vs 16:24).
3. POS nhận đổi Checkout Type từ Portal trễ khoảng 1 giờ (Portal đổi 15:32, POS vẫn Hybrid lúc 16:22).
4. Mở thẳng `/settings/charge-fee` bằng URL làm cửa sổ chính treo và app tự khởi động lại.
5. Order đã Cancel vẫn ghi "Cancel information: No cancel information available".

## Tổng hợp

| Phiên bản | Tổng TC | ✅  | ❌  | ⛔  | ⏳  |
| --------- | ------- | --- | --- | --- | --- |
| 1.1.57    | 29      | 15  | 0   | 4   | 10  |
| 1.1.61    | 29      | —   | —   | —   | —   |
