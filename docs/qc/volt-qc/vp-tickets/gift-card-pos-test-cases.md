# Gift Card (POS) — Test Cases

> Nguồn: Tài liệu yêu cầu "Gift Card" (mục 1 Mục tiêu → 3 Giao diện trên POS) + UI design Figma (node 15697-188640).
> Phạm vi: Bán Gift Card tại POS (Buy New Gift Card / Add Fund), dialog Sell Gift Card, hiển thị trong order, thanh toán & ghi nhận doanh thu, status & validation, report Gift Card Sale.
> Loại: Functional / UI / Boundary / State-transition — thực hiện thủ công.
>
> ⚠️ **Các điểm cần xác nhận (ambiguity):**
>
> - **Discount có cộng vào balance không?** Tài liệu định nghĩa `GIFT CARD BALANCE = GIFT CARD VALUE + Bonus` (KHÔNG có Discount). Suy ra Discount **chỉ giảm số tiền customer thanh toán**, không ảnh hưởng balance nạp vào thẻ. Các TC bám theo công thức này → cần PO xác nhận. // NOTE: cần xác nhận
> - **"Custom: max $10.000,00"** được hiểu là tối đa **$10,000.00** (định dạng số EU trong doc). // NOTE: cần xác nhận
> - **Not sold yet có thể balance ≥ 0** → khi Buy New có cho phép VALUE = $0 (chỉ kích hoạt thẻ) không, hay bắt buộc > 0? Các TC giả định bắt buộc > 0 ở luồng bán. // NOTE: cần xác nhận
> - **Bonus/Discount có giới hạn trần** (vd Discount ≤ VALUE, Bonus % ≤ 100%) không? Doc không nêu. // NOTE: cần xác nhận

---

## A. Category Gift Card & mở dialog

### TC-01 — Gift Card hiển thị là category riêng

**Tiền điều kiện:** Cashier đã đăng nhập POS; tiệm đã được Fastboy bán Gift Card (có sẵn list code trên CRM).
**Bước:**

1. Tạo order mới (Create order).
2. Quan sát danh sách category.
   **Mong đợi:**

- Có category **Gift Card** tách riêng khỏi các category sản phẩm/dịch vụ thường.

### TC-02 — Chọn category Gift Card mở dialog Sell Gift Card

**Tiền điều kiện:** Đang ở màn hình create order.
**Bước:**

1. Chọn category **Gift Card**.
   **Mong đợi:**

- Hiển thị dialog với **Title: "Sell Gift Card"**, **Content: "Sell Physical Gift Card"**.
- Có khu vực **CARD NUMBER** với 2 lựa chọn: nhập code thủ công và nút **Scan**.
- Các field GIFT CARD VALUE, Bonus/Discount, GIFT CARD BALANCE, nút **Add** hiển thị đúng theo design.

---

## B. CARD NUMBER — nhập code / scan & validation

### TC-03 — Nhập gift card code hợp lệ (Not sold yet)

**Tiền điều kiện:** Có code thẻ status **Not sold yet** trên CRM.
**Bước:**

1. Nhập code hợp lệ vào CARD NUMBER.
   **Mong đợi:**

- Hệ thống nhận code, hiển thị **current balance** của thẻ (vd `Balance: $0.00` hoặc số dư hiện có ≥ 0).
- Vào luồng **Buy New Gift Card**.

### TC-04 — Nhập gift card code hợp lệ (Active)

**Tiền điều kiện:** Có code thẻ status **Active**, balance > 0 (vd $10.00).
**Bước:**

1. Nhập code hợp lệ.
   **Mong đợi:**

- Hiển thị `Balance: $10.00`.
- Vào luồng **Add Fund**; nút **Balance Detail** hiển thị.

### TC-05 — Scan QR / barcode trên physical card

**Tiền điều kiện:** Có physical card hợp lệ + thiết bị scan.
**Bước:**

1. Chọn option **Scan**.
2. Scan QR/barcode trên thẻ.
   **Mong đợi:**

- Code được điền tự động vào CARD NUMBER, cho kết quả giống nhập tay (hiển thị balance tương ứng).

### TC-06 — Code không tồn tại / sai

**Tiền điều kiện:** —.
**Bước:**

1. Nhập một chuỗi không khớp thẻ nào.
   **Mong đợi:**

- Báo lỗi "code không hợp lệ / không tìm thấy"; không hiển thị balance; không cho bấm Add.

### TC-07 — Code thẻ status Inactive

**Tiền điều kiện:** Có code thẻ status **Inactive**.
**Bước:**

1. Nhập code thẻ Inactive.
   **Mong đợi:**

- Hệ thống chặn: **không cho phép sử dụng và không cho check balance** (theo định nghĩa Inactive); báo lỗi rõ ràng.

### TC-08 — Code không giới hạn số ký tự

**Tiền điều kiện:** Có thẻ với code rất dài (nhiều ký tự).
**Bước:**

1. Nhập/scan code dài.
   **Mong đợi:**

- Hệ thống chấp nhận, không cắt bớt, không báo lỗi giới hạn độ dài.

---

## C. Balance Detail — Check Gift Card (luồng Add Fund)

### TC-09 — Mở Balance Detail của thẻ Active

**Tiền điều kiện:** Đã nhập code thẻ **Active** (luồng Add Fund).
**Bước:**

1. Bấm nút **Balance Detail**.
   **Mong đợi:**

- Hiển thị màn **Check Gift Card** gồm: **Balance** (current), **Status**, và **Gift Card History** với các cột **Date / Order ID / Amount / Balance**.

### TC-10 — Gift Card History phản ánh đúng lịch sử giao dịch

**Tiền điều kiện:** Thẻ Active đã có ≥ 1 giao dịch trước đó.
**Bước:**

1. Mở Balance Detail.
2. Đối chiếu từng dòng history với các order đã phát sinh.
   **Mong đợi:**

- Mỗi dòng có Date, Order ID, Amount, Balance đúng; Balance lũy kế khớp với current balance ở trên.

### TC-11 — History rỗng (thẻ chưa có giao dịch)

**Tiền điều kiện:** Thẻ vừa Active nhưng chưa có lịch sử (hoặc thẻ mới).
**Bước:**

1. Mở Balance Detail.
   **Mong đợi:**

- Khu vực Gift Card History hiển thị trạng thái rỗng (empty state), không lỗi.

---

## D. GIFT CARD VALUE — nhập số tiền & boundary

### TC-12 — Quick option $25 / $50 / $100

**Tiền điều kiện:** Đang ở dialog Sell Gift Card với code hợp lệ.
**Bước (mỗi giá trị kiểm tra riêng):**

1. Chọn quick option **$25**.
2. Chọn quick option **$50**.
3. Chọn quick option **$100**.
   **Mong đợi:**

- GIFT CARD VALUE = đúng giá trị được chọn; GIFT CARD BALANCE tính lại tương ứng (= VALUE + Bonus).

### TC-13 — Custom amount hợp lệ

**Tiền điều kiện:** —.
**Bước:**

1. Nhập custom VALUE (vd $73.50).
   **Mong đợi:**

- Field nhận đúng giá trị, định dạng tiền tệ chuẩn; BALANCE cập nhật.

### TC-14 — Boundary: custom = max $10,000.00

**Tiền điều kiện:** —.
**Bước:**

1. Nhập VALUE = **$10,000.00**.
   **Mong đợi:**

- Chấp nhận (đúng biên trên).

### TC-15 — Boundary: custom > max

**Tiền điều kiện:** —.
**Bước:**

1. Nhập VALUE = **$10,000.01** (hoặc lớn hơn).
   **Mong đợi:**

- Bị chặn / báo lỗi vượt mức tối đa; không cho Add. // NOTE: xác nhận thông báo lỗi cụ thể

### TC-16 — Boundary: VALUE = 0 hoặc bỏ trống

**Tiền điều kiện:** —.
**Bước:**

1. Để VALUE = $0.00 (hoặc trống) rồi bấm Add.
   **Mong đợi:**

- Không cho thêm vào order (VALUE phải > 0 ở luồng bán). // NOTE: cần xác nhận với case Not sold yet balance ≥ 0

---

## E. Bonus / Discount — tính toán

### TC-17 — Bonus theo % cộng vào balance

**Tiền điều kiện:** VALUE = $100.
**Bước:**

1. Đặt Bonus = **10%**.
   **Mong đợi:**

- Bonus = $10; **GIFT CARD BALANCE = $110** (VALUE + Bonus).
- Số tiền customer thanh toán = VALUE = $100 (Bonus không tính tiền).

### TC-18 — Bonus theo $ cộng vào balance

**Tiền điều kiện:** VALUE = $100.
**Bước:**

1. Đặt Bonus = **$15**.
   **Mong đợi:**

- GIFT CARD BALANCE = **$115**; tiền thanh toán = $100.

### TC-19 — Discount theo % giảm tiền thanh toán

**Tiền điều kiện:** VALUE = $100, không Bonus.
**Bước:**

1. Đặt Discount = **10%**.
   **Mong đợi:**

- Số tiền customer **thanh toán = $90**.
- **GIFT CARD BALANCE = $100** (Discount KHÔNG ảnh hưởng balance — theo công thức BALANCE = VALUE + Bonus). // NOTE: cần xác nhận

### TC-20 — Discount theo $ giảm tiền thanh toán

**Tiền điều kiện:** VALUE = $100.
**Bước:**

1. Đặt Discount = **$20**.
   **Mong đợi:**

- Thanh toán = $80; BALANCE = $100 (chưa tính Bonus).

### TC-21 — Bonus + Discount đồng thời

**Tiền điều kiện:** VALUE = $100.
**Bước:**

1. Bonus = $10, Discount = $15.
   **Mong đợi:**

- GIFT CARD BALANCE = **$110** (VALUE + Bonus).
- Tiền thanh toán = **$85** (VALUE − Discount).

### TC-22 — Boundary Discount ≥ VALUE

**Tiền điều kiện:** VALUE = $50.
**Bước:**

1. Đặt Discount = $50 (hoặc $60).
   **Mong đợi:**

- Thanh toán = $0 (hoặc bị chặn nếu Discount > VALUE). // NOTE: cần xác nhận có cho phép thanh toán $0 không

---

## F. Add vào order & Order detail

### TC-23 — Add gift card vào order

**Tiền điều kiện:** Đã nhập code + VALUE hợp lệ.
**Bước:**

1. Bấm **Add**.
   **Mong đợi:**

- Dialog đóng; dòng item xuất hiện trong order detail.
- **Service Name: "Gift Card [giftcard code]"**, **Price = GIFT CARD VALUE**, kèm thông tin **Bonus / Discount**.

### TC-24 — Update VALUE / Bonus / Discount sau khi đã add

**Tiền điều kiện:** Gift card đã có trong order (đang processing).
**Bước:**

1. Mở lại item Gift Card.
2. Sửa VALUE và/hoặc Bonus/Discount.
3. Lưu.
   **Mong đợi:**

- Order detail cập nhật Price, Bonus/Discount, GIFT CARD BALANCE mới đúng.

### TC-25 — Gift Card không cần chọn Staff

**Tiền điều kiện:** —.
**Bước:**

1. Add Gift Card vào order.
   **Mong đợi:**

- Item Gift Card **không yêu cầu chọn Staff** (gắn với Store, tương tự Product); có thể complete order mà không gán nhân viên cho item này.

### TC-26 — Gift Card không gắn customer

**Tiền điều kiện:** —.
**Bước:**

1. Add Gift Card; kiểm tra liên kết dữ liệu.
   **Mong đợi:**

- Gift Card gắn với **Store / WhmcsID** của tiệm, **không** bắt buộc gắn customer.

---

## G. Ràng buộc 1 thẻ — 1 order đang processing

### TC-27 — Không cho thẻ vào 2 order processing cùng lúc

**Tiền điều kiện:** Thẻ code X đang nằm trong order A (đang processing, chưa complete).
**Bước:**

1. Tạo order B, nhập code X.
   **Mong đợi:**

- Bị chặn / báo "thẻ đang ở order khác"; không cho add vào order B.

### TC-28 — Thẻ dùng lại được sau khi order trước đóng

**Tiền điều kiện:** Order A chứa thẻ X đã complete (hoặc đã hủy/xóa item).
**Bước:**

1. Tạo order B, nhập code X.
   **Mong đợi:**

- Cho phép add bình thường (Add Fund nếu thẻ giờ Active).

---

## H. Thanh toán & ghi nhận doanh thu

### TC-29 — Thanh toán bán Gift Card bằng các payment method

**Tiền điều kiện:** Order có item Gift Card, tiền thanh toán đã tính.
**Bước (mỗi method kiểm tra riêng):**

1. Thanh toán bằng **Cash**.
2. Thanh toán bằng **Card**.
3. Thanh toán bằng **Gift Card** (thẻ khác).
4. Thanh toán bằng **Other**.
   **Mong đợi:**

- Mọi method hoàn tất order; Gift Card được xử lý như **một sản phẩm trong order**.

### TC-30 — Bán Gift Card KHÔNG ghi nhận doanh thu ngay

**Tiền điều kiện:** Vừa complete order bán Gift Card.
**Bước:**

1. Kiểm tra báo cáo doanh thu (revenue).
   **Mong đợi:**

- Tại thời điểm bán, **chưa ghi nhận doanh thu** (đây là tiền trả trước). Số tiền vào field **Gift Card Sale** chứ không vào revenue.

### TC-31 — Doanh thu ghi nhận khi Redeem

**Tiền điều kiện:** Có thẻ Active đã bán, balance > 0.
**Bước:**

1. Tạo order thường, dùng Gift Card để thanh toán (redeem).
   **Mong đợi:**

- **Doanh thu được ghi nhận tại thời điểm redeem** (Gift Card lúc này đóng vai trò payment method, không phải sản phẩm).

---

## I. State transition của Gift Card

### TC-32 — Not sold yet → Active sau khi complete order bán

**Tiền điều kiện:** Thẻ status **Not sold yet**.
**Bước:**

1. Buy New Gift Card: add VALUE > 0, complete & thanh toán order.
2. Kiểm tra status thẻ trên CRM.
   **Mong đợi:**

- Status tự động chuyển **Not sold yet → Active**; balance = GIFT CARD BALANCE đã nạp.

### TC-33 — Add Fund làm tăng balance thẻ Active

**Tiền điều kiện:** Thẻ Active balance $10.
**Bước:**

1. Add Fund VALUE = $50, complete order.
   **Mong đợi:**

- Balance mới = $60 (+ Bonus nếu có); thẻ vẫn Active.

### TC-34 — Active → Used up khi balance = 0

**Tiền điều kiện:** Thẻ Active balance $20.
**Bước:**

1. Redeem hết $20 trong order thanh toán.
   **Mong đợi:**

- Balance = $0; status chuyển **Used up**.

### TC-35 — Thẻ Used up có thể Add Fund trở lại không

**Tiền điều kiện:** Thẻ **Used up** (balance = 0).
**Bước:**

1. Nhập code thẻ Used up trong dialog Sell Gift Card.
   **Mong đợi:**

- // NOTE: cần xác nhận — doc chưa nêu Used up có cho Add Fund (về Active) hay không. Ghi nhận hành vi thực tế.

---

## J. Report Gift Card Sale

### TC-36 — Tiền bán Gift Card cộng vào report Gift Card Sale

**Tiền điều kiện:** Đã bán thành công ≥ 1 Gift Card trong kỳ báo cáo.
**Bước:**

1. Mở report tương ứng.
   **Mong đợi:**

- Field **Gift Card Sale** tăng đúng bằng tổng VALUE/tiền thanh toán Gift Card đã bán (không lẫn vào revenue).

### TC-37 — Redeem không làm tăng Gift Card Sale

**Tiền điều kiện:** Có order redeem Gift Card.
**Bước:**

1. Kiểm tra report sau redeem.
   **Mong đợi:**

- Gift Card Sale không tăng do redeem; thay vào đó doanh thu (revenue) ghi nhận.

---

## K. Đối chiếu CRM

### TC-38 — List Gift Card & status khớp CRM

**Tiền điều kiện:** Truy cập CRM `fastboy-merchant/gift-cards`.
**Bước:**

1. Đối chiếu code/balance/status giữa POS và CRM sau khi bán & redeem.
   **Mong đợi:**

- 4 status hiển thị đúng: **Not sold yet / Active / Used up / Inactive**; balance đồng bộ giữa POS và CRM.

---

## L. Nhiều Gift Card trong một order

### TC-39 — Thêm nhiều gift card khác nhau vào cùng order

**Tiền điều kiện:** Có ≥ 2 code thẻ hợp lệ khác nhau.
**Bước:**

1. Add thẻ A (VALUE $25).
2. Mở lại dialog, add thẻ B (VALUE $50).
   **Mong đợi:**

- Order detail hiển thị 2 dòng Gift Card riêng biệt, mỗi dòng đúng code/Price/Bonus-Discount.
- Tổng tiền order = tổng tiền thanh toán của 2 thẻ.

### TC-40 — Thêm trùng cùng một code 2 lần trong 1 order

**Tiền điều kiện:** Thẻ A đã có trong order đang processing.
**Bước:**

1. Mở dialog, nhập lại code A.
   **Mong đợi:**

- Không tạo dòng trùng; hệ thống đưa về update dòng hiện có **hoặc** chặn (theo ràng buộc "1 thẻ chỉ ở 1 order"). // NOTE: cần xác nhận hành vi mong muốn

### TC-41 — Trộn Buy New + Add Fund trong cùng order

**Tiền điều kiện:** 1 thẻ Not sold yet (A) + 1 thẻ Active (B).
**Bước:**

1. Add A (Buy New), add B (Add Fund), complete order.
   **Mong đợi:**

- Sau complete: A chuyển Active, B tăng balance; cả hai cộng đúng vào Gift Card Sale.

---

## M. Xóa / sửa / hủy item & order

### TC-42 — Xóa item Gift Card khỏi order trước khi complete

**Tiền điều kiện:** Order đang processing có item Gift Card thẻ A.
**Bước:**

1. Xóa dòng Gift Card khỏi order.
   **Mong đợi:**

- Item biến mất; thẻ A được giải phóng (có thể add ở order khác — xem TC-28); balance/status thẻ A không đổi.

### TC-43 — Hủy / void order chứa Gift Card đã thanh toán

**Tiền điều kiện:** Order bán Gift Card (thẻ A Not sold yet → vừa Active) đã complete.
**Bước:**

1. Thực hiện void/cancel order.
   **Mong đợi:**

- // NOTE: cần xác nhận — balance đã nạp có bị rollback không; status A có quay về Not sold yet không; Gift Card Sale có trừ lại không. Doc chưa nêu — ghi nhận hành vi thực tế.

### TC-44 — Refund order bán Gift Card

**Tiền điều kiện:** Order bán Gift Card đã complete.
**Bước:**

1. Thực hiện refund.
   **Mong đợi:**

- // NOTE: cần xác nhận chính sách refund đối với prepaid (rollback balance vs giữ nguyên).

---

## N. Redeem nâng cao

### TC-45 — Redeem một phần (partial)

**Tiền điều kiện:** Thẻ Active balance $50.
**Bước:**

1. Dùng Gift Card thanh toán order trị giá $30.
   **Mong đợi:**

- Balance còn $20; thẻ vẫn Active; doanh thu ghi nhận $30; History thêm dòng tương ứng.

### TC-46 — Redeem vượt balance

**Tiền điều kiện:** Thẻ Active balance $20, order $50.
**Bước:**

1. Chọn Gift Card thanh toán.
   **Mong đợi:**

- Chỉ trừ tối đa $20 từ thẻ; phần còn lại ($30) yêu cầu payment method khác (split payment), hoặc báo không đủ số dư. // NOTE: cần xác nhận có split không

### TC-47 — Redeem bằng thẻ Inactive / Used up

**Tiền điều kiện:** Thẻ Inactive hoặc Used up.
**Bước:**

1. Thử dùng làm payment method.
   **Mong đợi:**

- Bị chặn: Used up (balance $0) không thanh toán được; Inactive không cho dùng/không check được balance.

---

## O. Định dạng, làm tròn & độ tin cậy hiển thị

### TC-48 — Làm tròn Bonus/Discount theo %

**Tiền điều kiện:** VALUE = $33.33.
**Bước:**

1. Bonus = 10% (→ $3.333).
   **Mong đợi:**

- Hiển thị & lưu làm tròn 2 chữ số ($3.33); GIFT CARD BALANCE khớp quy tắc làm tròn, không sai số tích lũy. // NOTE: xác nhận quy tắc làm tròn

### TC-49 — Định dạng tiền tệ nhất quán

**Tiền điều kiện:** —.
**Bước:**

1. Nhập các giá trị: $5, $1,000, $10,000.
   **Mong đợi:**

- Hiển thị đúng định dạng tiền tệ (dấu phân cách hàng nghìn, 2 số lẻ) ở mọi field: VALUE, Balance, BALANCE, order detail, History.

### TC-50 — Nhập ký tự không hợp lệ vào VALUE

**Tiền điều kiện:** —.
**Bước:**

1. Thử nhập chữ cái, số âm, hoặc nhiều dấu chấm vào GIFT CARD VALUE.
   **Mong đợi:**

- Field từ chối input không hợp lệ; không cho âm; không cho Add.

---

### Coverage map

| Mục tài liệu / Acceptance                                 | Test case                         |
| --------------------------------------------------------- | --------------------------------- |
| Category Gift Card riêng trong POS                        | TC-01                             |
| Dialog Sell Gift Card (title/content/các field)           | TC-02                             |
| CARD NUMBER: nhập code / scan                             | TC-03, TC-04, TC-05               |
| Validation code (sai / Inactive / không giới hạn ký tự)   | TC-06, TC-07, TC-08               |
| Balance Detail → Check Gift Card (Balance/Status/History) | TC-09, TC-10, TC-11               |
| GIFT CARD VALUE: quick + custom + max $10,000             | TC-12, TC-13, TC-14, TC-15, TC-16 |
| Bonus (%/$) cộng balance                                  | TC-17, TC-18, TC-21               |
| Discount (%/$) giảm thanh toán                            | TC-19, TC-20, TC-21, TC-22        |
| GIFT CARD BALANCE = VALUE + Bonus                         | TC-17, TC-18, TC-19, TC-21        |
| Order detail: Service Name / Price / Bonus-Discount       | TC-23                             |
| Update VALUE/Bonus/Discount                               | TC-24                             |
| Không cần Staff / không gắn customer / gắn Store-WhmcsID  | TC-25, TC-26                      |
| 1 thẻ chỉ ở 1 order processing                            | TC-27, TC-28                      |
| Thanh toán Cash/Card/Gift Card/Other                      | TC-29                             |
| Doanh thu ghi nhận khi Redeem (không phải lúc bán)        | TC-30, TC-31                      |
| Buy New: Not sold yet → Active                            | TC-32                             |
| Add Fund (Active) tăng balance                            | TC-33                             |
| Active → Used up                                          | TC-34                             |
| Used up / Inactive xử lý                                  | TC-07, TC-35                      |
| Report Gift Card Sale                                     | TC-36, TC-37, TC-41               |
| Đối chiếu CRM & 4 status                                  | TC-38                             |
| Nhiều gift card / trùng code trong 1 order                | TC-39, TC-40                      |
| Trộn Buy New + Add Fund                                   | TC-41                             |
| Xóa item / void / refund order chứa GC                    | TC-42, TC-43, TC-44               |
| Redeem một phần / vượt balance / thẻ chết                 | TC-45, TC-46, TC-47               |
| Làm tròn %, định dạng tiền tệ, input không hợp lệ         | TC-48, TC-49, TC-50               |
