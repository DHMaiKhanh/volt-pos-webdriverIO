---
title: 'Cashback'
source: https://linear.app/fastboy/document/cashback-07289dfa5ed2
linear_id: 8bd5bb3e-2a05-4c48-8952-7a58b3d0a74b
team: VOLT
updated: 2026-07-08T04:57:12.913Z
---

# Cashback

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Cashback** là tính năng cho phép tiệm **hoàn lại giá trị giao dịch cho khách hàng dưới dạng point**, được tính **theo % của giá trị dịch vụ hoặc trên amount cụ thể**, thay vì cách tính point cố định truyền thống (ví dụ: $1 = 1 point).

1. **Cách hoạt động**

- Thực hiện create order, đến bước apply Promo/Reward > Chọn Cashback
- Hệ thống xác định **eligible amount** (số tiền đủ điều kiện tích điểm)
- Áp dụng **cashback** tương ứng
- Quy đổi % cashback thành Cash tích lũy và cộng vào current Cash của customer sau khi complete order
- Số tiền tích lũy được sử dụng cho các giao dịch tiếp theo theo rule đã cấu hình

2. **Cashback Rule Configuration**

- Toggle: Do you want to use Cashback?
  - **Enable**
    - Merchant có thể cấu hình: Cashback Percentage / Minimum Redeemable Amount / Maximum Redeem per Transaction
    - Khi Complete Order:
      - Hệ thống tính Earn Cashback theo rule đã cấu hình.
      - Customer có thể sử dụng Available Store Credit để Redeem Cashback trên các order tiếp theo nếu đủ điều kiện.
  - **Disable**
    - Không cho phép Earn Cashback trên bất kỳ order mới nào.
    - Không cho phép Redeem Cashback khi thanh toán.
    - Tất cả Cashback Rules sẽ không được áp dụng, bao gồm: Cashback Percentage / Minimum Redeemable Amount / Maximum Redeem per Transaction
- Available Store Credit = Số dư cashback của customer, được tích lũy sau mỗi order success, được tính bằng công thức sau:
  - Setting Rule: Hệ thống tự động quy đổi Cashback dựa trên tổng giá trị đơn hàng (Order Total) và Cashback Percentage do tiệm cấu hình.

    **\[cashback_amount = order_total × cashback_percentage / 100\]**

    Lưu ý: Order_total: giá trị order sau Discount/Cashback Redeem và chưa tính Tax/Tip
- Setting:
  - Minimum redeemable amount: số tiền balance tối thiểu được sử dụng để trừ ngược vào order đang thanh toán
  - Maximum redeem per transaction: Ngưỡng max được apply số dư cash back vào order (VD setting là $20, thì nếu số dư Cash đang là $50, thì chỉ được sử dụng $20 cho order)
    - _Description: Cap per use regardless of balance_
  - Cashback percentage (%): phần trăm được apply cashback trên order total
    - Description: _If total bill is $100 and cashback percentage will be 10%, customer can redeem up to $10._

3. **Workflow - Apply Cash back: tích lũy Cash**

- Create Order: chọn staff - Service
- Chọn Reward > chọn tab Cashback > Toggle: Do you want to use Cashback? - Enable
- Chọn Setting Cashback
- Tại field: Cashback Percentage (%) > nhập số %
- Complete Order: thì dựa vào total order và nhân với % cashback, sẽ tính được số Cash tích lũy của order đó theo công thức:

  **\[cashback_amount = order_total × cashback_percentage / 100\]**

- Số tiền tích lũy sẽ được sử dụng vào những order sau, nếu đã đủ điều kiện sử dụng

!\[\]\[image17\]  
!\[\]\[image18\]  
!\[\]\[image19\]

4. **Workflow - Apply Reward - Cash back: sử dụng số dư Cash Back vào order**

- Create Order: chọn staff - Service
- Chọn Reward > chọn tab Cashback > Toggle: Do you want to use Cashback? - Enable
- Nhập Amount muốn trừ trực tiếp cho order, số amount phải thỏa điều kiện được apply của Cashback. VD dưới hình:
  - Minimum: $10
  - Maximun: $200
  - Available Store Credit (Current Cash balance): $573.11
  - Amount được cho phép: $10 - $200
- Cash back sẽ được trừ trực tiếp vào order, tương tự như apply Reward
- Cashback không áp dụng cho tax, tip.

!\[\]\[image20\]  
!\[\]\[image21\]

5. **Giao diện những vị trí ảnh hưởng**

- **Create Order:**
- Thêm field: **Cashback Redeemed** tại order summary, là field con của Total Discount
- Thể hiện số tiền cashback được sử dụng redeem cho order hiện tại
- **Order History:** cộng chung vào Total Discount
- **Report**: Cashback Redeemed sẽ được tính chung vào Discount của order (bao gồm cả Promotion/Reward)

6. **Workflow khi có Re-open / Cancel / Refund / Partial Refund**
7. **Re-open Order**

- Cashback chưa finalize, hệ thống sẽ recalculate lại Earn Cashback theo total mới của order khi order được close lại.
- Cashback đã redeem tạm thời giữ nguyên, sẽ được tính lại nếu order thay đổi giá trị.

2. **Cancel Order / Full Refund**

- Return toàn bộ cashback đã redeem vào wallet của customer.
- Reverse toàn bộ cashback earn từ order đó.

3. **Partial Refund**

- Cashback earn: bị reverse theo tỷ lệ giá trị refund so với tổng order ban đầu.
- Cashback redeem: được hoàn lại theo tỷ lệ refund tương ứng.

**Tóm lại:**

- Earn cashback → reverse theo phần order bị huỷ/refund.
- Redeem cashback → hoàn lại cho customer theo phần order bị huỷ/refund.

**Lưu ý:**

- Không xoá transaction cashback cũ, hệ thống nên tạo transaction đảo chiều (adjustment/reverse) để đảm bảo audit rõ ràng.
- Cashback nên được quản lý theo ledger transaction (earn / redeem / reverse / restore) để tránh sai lệch số dư wallet.
- Trường hợp cashback earn của order đã được customer dùng cho order khác trước khi refund, hệ thống vẫn phải reverse cashback của order gốc, và có thể cần xử lý balance adjustment trong wallet.

7. **Cashback Wallet (Cashback history)**  
   [Customer Management](https://linear.app/fastboy/document/customer-management-5a2f35d3c8fc)
8. **Một số lưu ý**

- Luồng apply Cash Back cho order và sử dụng số dư Cash Back vào order là khác nhau
- Khi chọn Reward: chỉ được chọn apply 1 trong 2 option - Reward hoặc Cash Back, không apply cùng lúc cả 2 options
- Sau khi Complete order:
  - Available Store Credit bị trừ đi khoản Amount đã được sử dụng trong order trước đó
  - Available Store Credit sẽ được cộng thêm tiền theo % cashback nếu có setting
  - Point: vẫn sẽ được cộng theo Total Order đã complete (đổi điểm theo setting của tiệm, vd $1 = 1 point)

---

_Source: Google Docs — "Cashback" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
