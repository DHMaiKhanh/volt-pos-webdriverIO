# Retest Reopen — Card / Cash / Gift Card / Other (22/10/2026)

Retest toàn bộ các task trong project Linear **Reopen order — update item & staff**:
[VP-2585](https://linear.app/fastboy/issue/VP-2585), [VP-4405](https://linear.app/fastboy/issue/VP-4405) và các sub-task.
Không dùng code test: điều khiển trực tiếp app Volt POS đang cài trên máy (thao tác qua WebView2 remote debugging), kiểm tra bằng số liệu trên màn hình.

## Môi trường

| Mục              | Giá trị                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| App              | Volt POS **1.1.41** (DEV), bản cài tại `%LOCALAPPDATA%\Volt POS`                    |
| Merchant setting | Service Fee **3%** · Cash Discount **3%** · Product Tax **5%** · Service Tax **5%** |
| Card             | Terminal đã kết nối, giao dịch duyệt thật (Visa 0043)                               |
| Gift Card        | `****0511` (thanh toán), `****1736` (bán gift card)                                 |
| Khách test       | lam_doan_a (`***9443`), lam_doan_b (`***9442`)                                      |

## Tổng kết

|         | PASS   | FAIL  | Chưa kết luận / chưa test |
| ------- | ------ | ----- | ------------------------- |
| Số case | **18** | **3** | 2 + 5 ngoài phạm vi       |

**3 lỗi tìm thấy:**

1. [VP-4978](https://linear.app/fastboy/issue/VP-4978) — **Giảm tiền khi reopen bị chặn — không còn đi luồng Void-All** (VP-2585 TC23, cả 4 phương thức). Đã PASS ở bản 1.1.22 → **tái lỗi / đổi hành vi**.
2. [VP-4979](https://linear.app/fastboy/issue/VP-4979) — **Reopen không sửa gì, bấm Done → visit của customer +1** (VP-3969 tái lỗi).
3. [VP-4980](https://linear.app/fastboy/issue/VP-4980) — **Điểm loyalty sai khi customer được gán trong lúc reopen**: đổi tiếp sang khách khác thì khách cũ không bị trừ điểm; gỡ rồi chọn lại cùng khách thì khách bị **cộng điểm + visit lần nữa** (liên quan VP-4085 / VP-3598).

---

## A. Luồng chính — chạy cho từng phương thức

Kịch bản: đơn 1 service $62 (Pamela) → thanh toán → Re-Open → không sửa → Edit Order thêm service $35 (Kani) + product $36 → thu chênh lệch **bằng chính phương thức đó** → kiểm tra Order History → Re-Open lần 2.

| #   | Test case                                                                                               | Ticket                                      | Card | Cash | Gift Card | Other |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---- | ---- | --------- | ----- |
| A1  | Tạo đơn và thanh toán (Card $67.05 / còn lại $65.10)                                                    | —                                           | ✅   | ✅   | ✅        | ✅    |
| A2  | Nút Re-Open hiện message còn lượt: _"One edit of items, prices left; locks once paid."_                 | VP-3914                                     | ✅   | ✅   | ✅        | ✅    |
| A3  | Reopen không sửa gì → cả 4 tender đều $0.00, chỉ còn nút Re-Open Done                                   | VP-4067                                     | ✅   | ✅   | ✅        | ✅    |
| A4  | Home khi reopen: tổng giá các dòng = Subtotal                                                           | VP-4405 §4                                  | ✅   | ✅   | ✅        | ✅    |
| A5  | Số tiền thu thêm: Card **$76.79**, Cash/GC/Other **$74.55** (đúng công thức SF/CD/Tax, có thuế product) | VP-3931, VP-3957, VP-4012, VP-4013, VP-4079 | ✅   | ✅   | ✅        | ✅    |
| A6  | Thu chênh lệch tạo transaction mới, Order History khớp tổng                                             | VP-2585 TC18/TC22                           | ✅   | ✅   | ✅        | ✅    |
| A7  | Re-Open lần 2: message _"Items and prices are locked…"_, thêm staff/item không được                     | VP-3913                                     | ✅   | ✅   | ✅        | ✅    |

Chi tiết A4–A6:

|                        | Card                                              | Cash                                              | Gift Card                   | Other                       |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------- | --------------------------- | --------------------------- |
| Đơn                    | OD261022-16855793                                 | OD261022-16994595                                 | OD261022-17091602           | OD261022-17290322           |
| Home sau khi thêm item | $63.86 + $36.05 + $37.08 = **$136.99** = Subtotal | $62.99 + $35.56 + $36.58 = **$135.13** = Subtotal | như Cash                    | như Cash                    |
| Transaction            | Card $67.05 + Card $76.79                         | Cash $65.10 + Cash $74.55                         | GC $65.10 + GC $74.55       | Other $65.10 + Other $74.55 |
| Order History          | Subtotal $136.99 · Tax $6.85 · **Total $143.84**  | Subtotal $133.00 · Tax $6.65 · **Total $139.65**  | $139.65                     | $139.65                     |
| Số dư gift card        | —                                                 | —                                                 | $745.26 → $680.16 → $605.61 | —                           |

## B. Giảm tiền (Void-All)

| #   | Test case                                                                | Ticket            | Card | Cash | Gift Card | Other |
| --- | ------------------------------------------------------------------------ | ----------------- | ---- | ---- | --------- | ----- |
| B1  | Reopen, xóa service $35 (tổng giảm) → Void-All rồi thanh toán lại từ đầu | VP-2585 TC23–TC26 | ❌   | ❌   | ❌        | ❌    |

- Đơn: Card OD261022-17390786 · Cash OD261022-17784010 · Gift Card OD261022-17847993 · Other OD261022-17919268 (đơn $62 + $35).
- **Kết quả:** xóa item thì Home cập nhật đúng (Subtotal $62.00, Total $65.10). Nhưng bấm Pay thì app chặn với dialog **"Cannot continue yet — Add a service priced $35.00 to balance this order."** Không vào được màn thanh toán, không có Void-All.
- **Mong đợi (spec VP-2585 §3):** giảm tiền → void toàn bộ transaction thành công cũ → tính lại → thanh toán lại bằng method bất kỳ. Comment QC trên VP-2585 ghi TC23 đã PASS ở bản 1.1.22.
- Cần dev/PO xác nhận: đây là lỗi hay rule mới (chặn giảm tiền). Nếu là rule mới thì phải cập nhật lại spec và AC của VP-2585.

## C. Bằng tiền, đổi phương thức, split

| #   | Test case                                                                                                          | Ticket                  | Kết quả | Ghi chú                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Sửa nhưng tổng không đổi (xóa $35 rồi thêm lại $35 cho thợ khác) → $0.00, Done không tạo transaction, vẫn còn lượt | VP-2585 TC27/TC28, TC15 | ✅      | Card OD261022-17390786: vẫn 1 transaction $104.91, reopen lại vẫn báo còn lượt. Cash OD261022-17784010 cũng còn lượt. Với Gift Card và Other, Done chạy thành công nhưng chưa reopen lại để kiểm tra lượt sửa |
| C2  | Đơn trả Gift Card, thu thêm bằng Card (method khác)                                                                | VP-2585 TC22            | ✅      | OD261022-16664372: GC $65.10 + Card $38.93 = $104.03                                                                                                                                                          |
| C3  | Split Cash + Other → Reopen không sửa → không phát sinh số lẻ                                                      | VP-4067                 | ✅      | OD261022-18097560: Cash $50.92 + Other $50.93; reopen cả 4 tender $0.00                                                                                                                                       |
| C4  | Đơn split → chặn sửa tiền                                                                                          | VP-2585 TC03            | ✅      | Message "Items and prices are locked" ngay lần reopen đầu                                                                                                                                                     |
| C5  | Màn split: Total sau khi trả check 1 bằng Cash                                                                     | VP-4405 §2              | ✅      | Total **$103.38** = $50.92 (Cash) + $52.46 (check còn lại)                                                                                                                                                    |
| C6  | Item Gift Card khi reopen: không xóa / không sửa được                                                              | VP-2585 TC12            | ✅      | OD261022-18996938: nút xóa disable (opacity-30), dialog chỉ để xem, không có nút lưu                                                                                                                          |

## D. Quick Pay và làm tròn

| #   | Test case                                                          | Ticket     | Kết quả               | Ghi chú                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------ | ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Reopen + Quick Pay $25: tổng dòng = Subtotal                       | VP-4405 §5 | ✅                    | OD261022-17784010: $62.38 + $35.22 + $25.15 = $122.75 = Subtotal. Thu thêm Card $27.04 / Cash $26.25 (đúng)                                                                                                              |
| D2  | Giá dòng Quick Pay trên Home hiện số nhập ($25.00) hay giá phân bổ | VP-4405 §5 | ⚠️ Chờ PO             | Home hiện **$25.15**, Order History lưu **$25.00**. PO cần chốt cách hiển thị                                                                                                                                            |
| D3  | Lệch 1¢ thuế/tổng tiền trên đơn mới                                | VP-4405 §1 | ⚠️ Chưa tái hiện được | 5 mức giá ($19.00 / $23.45 / $37.77 / $19.99 / $45.67): Cash/GC/Other = net × 1.05 và Card = net × 1.03 + 5% đều khớp tới từng cent. Ticket chỉ lỗi khi SF ≠ CD (vd SF 4% / CD 3.5%), còn merchant này đang SF = CD = 3% |

## E. Customer & loyalty

| #   | Test case                                                               | Ticket           | Kết quả | Ghi chú                                                                           |
| --- | ----------------------------------------------------------------------- | ---------------- | ------- | --------------------------------------------------------------------------------- |
| E1  | Reopen: xóa customer rồi thêm customer mới                              | VP-3982          | ✅      | Gỡ lam_doan_b → thêm lam_doan_a thành công                                        |
| E2  | Thanh toán xong điểm được cộng thật                                     | VP-4792          | ✅      | Màn khách hiện "earned 153, current 257"; mở lại customer thấy Point **257**      |
| E3  | Đơn có customer gốc, reopen đổi A → B                                   | VP-3598, VP-4085 | ✅      | OD261022-18583896: lam_doan_b 244 → **208** (−36), lam_doan_a 257 → **293** (+36) |
| E4  | Reopen gỡ customer → thu hồi điểm                                       | VP-3726, VP-4085 | ✅      | lam_doan_a 293 → **257** (−36)                                                    |
| E5  | Reopen không đổi gì → Done: visit không tăng                            | VP-3969          | ❌      | Xem lỗi #2                                                                        |
| E6  | Đơn không có customer, gán customer khi reopen, rồi đổi sang khách khác | VP-4085          | ❌      | Xem lỗi #3                                                                        |

### Lỗi #2 — Reopen làm tăng visit (VP-3969 tái lỗi)

- **Đơn:** OD261022-18583896 (Cash $36.75, khách lam_doan_b)
- **Các bước:** tạo đơn có lam_doan_b → thanh toán (visit 2 → 3, điểm 208 → 244) → Order History → Re-Open → không sửa gì → Re-Open Done → mở lại customer
- **Thực tế:** Total visits **4** (điểm vẫn 244)
- **Mong đợi:** visit giữ nguyên **3**

### Lỗi #3 — Điểm sai khi customer được gán trong lúc reopen

- **Đơn:** OD261022-17390786 (Card $104.91, ban đầu không có customer)
- **Các bước và kết quả:**
  1. Reopen → gán lam_doan_a → Done → lam_doan_a: **104 điểm, visit 1** (đúng)
  2. Reopen → đổi lam_doan_a → lam_doan_b → Done → lam_doan_b: **104 điểm, visit 1** (đúng), nhưng lam_doan_a **vẫn 104 điểm, visit 1** (sai: phải về 0). Đã chờ hơn 10 phút, kiểm tra lại vẫn 104.
  3. Reopen → gỡ lam_doan_b, chọn lam_doan_a, rồi gỡ ra chọn lại lam_doan_b (khách cuối cùng không đổi) → Done → lam_doan_b: **208 điểm, visit 2** (sai: bị cộng thêm 104 điểm và 1 visit, không có thanh toán mới)
- **So sánh:** cùng thao tác đổi khách trên đơn **có customer từ lúc thanh toán** (E3) thì đúng. Lỗi chỉ xảy ra khi customer được gán lần đầu trong lúc reopen. Khả năng chủ sở hữu điểm (`pointBonusCustomerId`) không được ghi ở nhánh này.
- **Ảnh hưởng dữ liệu test:** lam_doan_a thừa 104 điểm, lam_doan_b thừa 104 điểm + 1 visit.

## F. Chưa test / ngoài phạm vi lần này

| Mục                                                     | Lý do                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| VP-4077 — toggle gift-card service fee snapshot         | Phải đổi setting trên Portal giữa lúc tạo đơn và lúc reopen             |
| Offline (VP-2585 TC38–TC40)                             | Phải ngắt mạng máy test                                                 |
| Chia lại tip khi thêm/xóa staff (TC16–TC17)             | Merchant chạy tip trên màn khách. Lần này chọn No Tip cho mọi giao dịch |
| Promotion / reward / cashback chặn sửa tiền (TC04–TC05) | Chưa có dữ liệu đơn khuyến mãi                                          |
| VP-4405 §3 — đơn trả trên P8D, Windows reopen           | Cần thiết bị P8D                                                        |

## Ghi nhận phụ

- Đơn mới OD261022-17390786: lúc vào checkout có hiện dialog **"Order in use — This order is currently being used on another device"**, dù đơn vừa tạo trên chính máy này. Bấm OK thì vẫn thanh toán bình thường.
- Checkout đơn mới chưa thanh toán đồng nào nhưng dòng **Remaining** hiện $0.00 thay vì tổng tiền.
