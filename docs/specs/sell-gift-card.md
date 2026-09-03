---
title: 'Sell Gift Card'
source: https://linear.app/fastboy/document/sell-gift-card-812b56914491
linear_id: 8fcaa335-4677-4890-8fa4-03c89364b83f
team: VOLT
updated: 2026-06-11T09:59:18.728Z
---

# Sell Gift Card

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **1. Mục tiêu**

- Gift Card là sản phẩm prepaid của tiệm, cho phép:
- Khách mua để tặng người khác
- Hoặc mua để sử dụng sau
- Gift Card là tiền trả trước, chỉ khi khách dùng Gift Card để thanh toán thì hệ thống mới ghi nhận đó là doanh thu.
- Có nhiều cách để add balance cho gift card:
- Page Admin quản lý gift card của Fastboy (dành cho Fastboy support)
- POS: tạo order, chọn sản phẩm là Gift Card, sau đó nhập số tiền muốn add cho gift card, hay còn gọi là:
  - Buy New Gift Card: đối với gift card có status - Not sold yet (sau khi complete order bán giftcard thì status auto update qua Active)
  - Add Fund: đối với gift card có status - Active

# **2. Cách bán Gift Card**

- Gift Card được hiển thị là một Category riêng trong POS - **Gift Card**
- Sau khi Fastboy bán Gift Card cho chủ tiệm, kiểm tra tại CRM: [https://develop.gci-sell-gift-card-admin-web.pages.dev/fastboy-merchant/gift-cards](https://develop.gci-sell-gift-card-admin-web.pages.dev/fastboy-merchant/gift-cards)
- Tiệm sẽ có 1 list Gift Card Code / Physical card tương ứng, với những status của Gift card như sau:
  - Not sold yet: Gift card mới hoàn toàn, chưa đc bán cho customer, balance có thể >= 0
  - Active: Gift card đã bán cho customer và đang có balance > 0
  - Used up: Gift card đã bán cho customer và đang có balance = 0
  - Inactive: Gift card đã bán cho customer và đã bị inactive, không cho phép sử dụng hay check balance

1. **Flow sell gift card tại POS, Cashier:**
   - Create order
   - Chọn category Gift Card
   - Nhập gift card code hoặc scan Code / QR code trên physical card
   - Nhập giá trị của gift card: nhập tự do (custom amount)
   - Có thể áp dụng: Bonus / Discount
   - Sau đó hệ thống tính toán ra Gift Card Balance
2. **Thanh toán khi bán Gift Card**

- Gift Card được bán như một sản phẩn trong order bình thường
- Thanh toán bằng các payment method hiện có (Cash / Card / Gift Card / Other.)
- Doanh thu được ghi nhận tại thời điểm Gift Card được sử dụng - Redeeem (Gift Card được xem là sản phẩm, không phải payment lúc này)

3. **Một số lưu ý:**
   - Gift Card không gắn với customer, là Gift Card chung của tiệm (gắn với WhmcsID)
   - Khi bán GC, thì GC sẽ gắn với Store, không cần chọn Staff (tương tự Product)
   - Ai có code đều có thể sử dụng
   - Gift Card đang không giới hạn số lượng kí tự

# **3. Giao diện trên POS**

- Tại màn hình create order, chọn categoy - Gift Card, sẽ hiển thị Sell Gift Card dialog, với những thông tin như sau:
  - Title: Sell Gift Card
  - Content: Sell Physical Gift Card
  - CARD NUMBER: 2 options,
    - Input gift card code
    - Sử dụng option Scan
    - Sau khi nhập valid gift card, sẽ hiển thị thông tin current balance của gift card đó:
      - Balance: $10.00
      - Button: Balance Detai, click sẽ show thông tin Check Gift Card nếu là flow Add Fund, gồm:
        - Balance: current balance
        - Status
        - Gift Card History: Date / Order ID / Amount / Balance
  - GIFT CARD VALUE: field nhập số tiền để add fund vào gift card, là số tiền customer phải thanh toán cho giftcard
    - Quick option: $25 / $50 / $100
    - Custom: max $10.000,00
    - Discount/Bonus option:
      - Bonus: hình thức tặng thêm, tăng balance sử dụng khi mua giftcard
        - Theo %
        - Theo $
      - Discount: giảm số tiền thanh toán giftcard
        - Theo %
        - Theo $
    - GIFT CARD BALANCE: số tiền cuối cùng sẽ được add vào gift card, bằng \[GIFT CARD VALUE + Bonus\]
  - Button: Add, click để add vào order

!\[\]\[image22\]  
!\[\]\[image23\]

- Trong oder detail sẽ hiện thị như sau:
  - Service Name: Gift Card \[giftcard code\]
  - Price: GIFT CARD VALUE
  - Thông tin Bonus / Discount

!\[\]\[image24\]

**Một số lưu ý:**

- Một gift card chỉ được tồn tại trong 1 oder đang processing
- Có thể update GIFT CARD VALUE, Bonus/Discount
- Gift card sau khi bán thành công sẽ cộng tiền vào những report tương ứng tại field Gift Card Sale

Note: Tham khảo UI theo design mới: [https://www.figma.com/design/VrTGyRCkK1jBuWZ21Qcs8a/GO-POS-WEB---VER-2025---MAIN?node-id=15697-188640&t=xXWzj4gmDXjiUhVm-0](https://www.figma.com/design/VrTGyRCkK1jBuWZ21Qcs8a/GO-POS-WEB---VER-2025---MAIN?node-id=15697-188640&t=xXWzj4gmDXjiUhVm-0)

---

_Source: Google Docs — "Sell Gift Card" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
