# Luồng order — PRODUCTION, Bee Bee Spa (#2949), Volt POS 1.1.5 — 26/10/2026

- Test tay bằng script (attach CDP vào app production đang cài), **không thanh toán card** (theo yêu cầu).
- Passcode production do **user tự nhập** trên máy; script chỉ chờ.
- Cấu hình tiệm: Product Tax 10%, Service Tax 10%, Service Fee 10%, Cash Discount 10%.
- Dịch vụ dùng: Polish Change ($0.20), Nail File & Buff ($0.25), Cuticle Trim ($0.30), Express Manicure & Polish ($4.33); thợ Hugo.
- **Mọi đơn test đã Cancel / xoá** sau khi kiểm.

## Kết quả

| #   | Luồng                                                 | Đơn                       | Kết quả             | Chi tiết                                                                                                |
| --- | ----------------------------------------------------- | ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Tạo đơn: thợ + dịch vụ, giỏ hàng                      | OD261026-42999644         | ✅ PASS             | Card $0.24 / Cash $0.22; Subtotal $0.22, Tax $0.02; màn khách khớp                                      |
| 2   | Thanh toán **Cash**                                   | OD261026-42999644         | ✅ PASS             | Payment Successful $0.22; DB: sale cash 22¢, tax 2¢                                                     |
| 3   | Thanh toán **Other**                                  | OD261026-43327133         | ✅ PASS             | Payment Successful $0.22; DB: sale other 22¢                                                            |
| 4   | **Split Order** (chia đều 2 check: Cash + Other)      | OD261026-43459579         | ✅ PASS             | Check 1 Cash $2.79, Check 2 Other $2.80 → Payment Successful $5.97                                      |
| 5   | Split bị khoá khi đơn < $5                            | OD261026-43459579 ($0.55) | ✅ PASS (đúng rule) | Nút split mờ tới khi đơn ≥ $5 (rule VP-3580)                                                            |
| 6   | **Pending Order**: lưu nháp → mở lại từ Pending → xoá | OD261026-43765607         | ✅ PASS             | Có trong Pending list, mở lại đúng nội dung, xoá xong                                                   |
| 7   | **Order History** detail                              | 3 đơn trên                | ✅ PASS             | Summary (Subtotal/Tax/Tip/Total) + Payment Details đúng; split hiện từng check                          |
| 8   | **Receipt**                                           | OD261026-42999644         | ✅ PASS             | Subtotal $0.20, Tax $0.02, Total $0.22, Paid with Cash                                                  |
| 9   | **Cancel Order** (Cash, Other, Split)                 | 3 đơn trên                | ✅ PASS             | "Canceling" → **canceled** trong ~10 s, mỗi sale có void; Cancel information đủ (staff, số tiền, lý do) |
| 10  | Quick Pay để trống bấm Add                            | OD261026-43915458         | ❌ **FAIL**         | Thêm "Unknown Service 1 — $0.00" (giống DEV 1.1.61). Đã xoá đơn                                         |
| —   | Card                                                  | —                         | ⏭️ Không test       | Theo yêu cầu                                                                                            |
| —   | Gift Card                                             | —                         | ⏭️ Không test       | Không có thẻ test ở tiệm thật; dùng thẻ của khách là rủi ro                                             |

**Tổng: 9 PASS · 1 FAIL** (Quick Pay $0).

## Ghi nhận

1. 🐞 **Quick Pay cho Add khi trống** — có trên cả production 1.1.5 và DEV 1.1.61.
2. ⚠️ **Tip $0.38 lạ ở Check 2 (Other) của đơn split** — script không chọn tip (lúc đó màn khách không hiện bước tip cho script). Có thể có người chạm màn khách; cần kiểm lại nếu thấy lặp.
3. ℹ️ **Staff code bị hỏi lại** ở Complete Payment dù đã tích "Do not require passcode for the next 30 minutes" ở lần trước — cần xác nhận rule (mỗi lần thanh toán đều hỏi, hay 30 phút không áp cho thanh toán).
4. ℹ️ Trên DEV trước đó thấy "No cancel information available" — thực ra chỉ là lúc đơn còn "Canceling"; sau ~10 s hiện đủ thông tin. **Không phải lỗi.**
