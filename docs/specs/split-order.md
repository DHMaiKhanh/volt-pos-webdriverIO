---
title: 'Split Order'
source: https://linear.app/fastboy/document/split-order-a317435c0a01
linear_id: 66075d01-9f88-4fcf-bd40-ce5ef87ce3b3
team: VOLT
updated: 2026-06-30T09:22:55.768Z
---

# Split Order

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

Flow chart: [POS Split Order](https://drive.google.com/file/d/1-mMNkzAoY-R_Mgq_B2aTRe62XFscPJLb/view)  
Reference: [https://youtu.be/60mPL-RQafg?si=uQ8iGJMsMUY_RRf7](https://youtu.be/60mPL-RQafg?si=uQ8iGJMsMUY_RRf7)

1. **Overview**

   Split Order cho phép chia một Order thành nhiều Check độc lập để khách hàng có thể thanh toán riêng biệt bằng các phương thức thanh toán khác nhau.  
   Mục tiêu của tính năng:

- Hỗ trợ nhiều khách hàng cùng sử dụng chung một Order nhưng thanh toán riêng.
- Hỗ trợ chia tiền thanh toán linh hoạt.
- Không làm thay đổi cấu trúc Order gốc, Service gốc, Staff mapping, Commission, Revenue hoặc Reporting hiện tại.
- Đảm bảo tương thích với các nghiệp vụ Refund, Void, Re-open Order và Staff Commission.

---

2. **Business Rules**

   Core Principle  
   Split Order chỉ là cách chia thanh toán.  
   Chỉ cho chọn Split order khi Total Order > $5
   Split Order không được làm thay đổi:

- Order gốc
- Service/Product gốc
- Staff assignment
- Commission calculation
- Promotion calculation
- Discount calculation
- Tax rule
- Revenue reporting  
  Toàn bộ dữ liệu nghiệp vụ vẫn được tính dựa trên Order gốc.

---

3. **Split Methods**

Hệ thống hỗ trợ 3 phương thức chia Check.

1. **Split Equally**

   User Action  
   Nhập số lượng Check cần tạo.  
   Ví dụ:

- 2 Checks
- 3 Checks
- 4 Checks  
  System Behavior  
  Tổng Order được chia đều cho tất cả Check.  
  Nếu phát sinh số lẻ:
- Làm tròn đến 2 chữ số thập phân.
- Check cuối cùng chịu phần chênh lệch.  
  Example  
  Order Total = $100  
  Split thành 3 Checks
- Check 1 = $33.33
- Check 2 = $33.33
- Check 3 = $33.34

---

2. **Split by Amount**

   User Action  
   Chọn số lượng Check.  
   Nhập số tiền cho từng Check.  
   System Behavior  
   Check cuối cùng được tự động tính.  
   Formula:  
   Check N = Order Total - Sum(Check 1 → Check N-1)  
   Validation  
   Không cho phép:

- Amount ≤ 0
- Tổng các Check vượt quá Order Total
- Check cuối cùng có giá trị âm  
  Example  
  Order = $100
- Check 1 = $30
- Check 2 = $50  
  System auto:
- Check 3 = $20

---

3. **Split by Items**

   User Action  
   Gán Service/Product vào từng Check.  
   System Behavior  
   Mỗi Item chỉ được thuộc về một Check duy nhất.  
   Check Total được tính dựa trên Item được gán.  
   Validation  
   Nếu Order chỉ có 1 Item:

- Không cho phép Split by Items.  
  Example  
  Order:
- Pedicure = $40
- Manicure = $30
- Product = $20  
  Check 1
- Pedicure  
  Check 2
- Manicure
- Product

---

4. **Item Distribution Rules**
5. **Discount**

   Order Discount  
   Được phân bổ theo tỷ lệ Amount của Item.  
   Item Discount  
   Đi theo Item tương ứng.

---

2. **Tax**

   Tax chỉ áp dụng cho Product.  
   Split by Items  
   Tax được hiển thị trên Check chứa Product.  
   Split Equally / Split by Amount  
   Không cần hiển thị Tax riêng trên từng Check.  
   Tax chỉ hiển thị ở tổng Order.

---

3. **Service Fee / Cash Discount**

   Được phân bổ theo tỷ lệ Amount của Item.

---

4. **Tip**

   Tip không được phân bổ khi Split.  
   Tip được nhập tại thời điểm thanh toán từng Check.  
   Tip được ghi nhận riêng cho từng Check.  
   Sau khi Order hoàn tất:

- Tip được phân bổ cho Staff theo Tip Rule hiện tại của Merchant.

---

5. **Check Management**
6. **Clear Check**

   Cho phép xóa Check chưa thanh toán.  
   Sau khi xóa:

- Hệ thống tự động tính lại các Check còn lại.  
  Validation:
- Phải còn tối thiểu 2 Check để được xem là Split Order.

---

2. **Paid Check**

   Không cho phép xóa Check đã thanh toán.  
   Nếu muốn thay đổi:

- Phải Void Check trước.

---

3. **Change Split Method**

   Before Payment  
   Cho phép:

- Đổi Split Method
-

## Chỉnh sửa Check

After Payment Exists  
Không cho phép:

- Đổi Split Method
- Tạo lại Split Structure  
  Nếu muốn thay đổi:
- Void toàn bộ Check đã thanh toán trước.

---

6. **Payment Flow**

Mỗi Check được thanh toán độc lập.

1. **Payment Information**

   Mỗi Check hiển thị:

- Check Number
- Item List (nếu có)
- Amount
- Tip
- Payment Status

---

2. **Payment Method**

   Một Check chỉ được thanh toán bằng duy nhất một Payment Method.  
   Hỗ trợ:

- Card
- Cash
- Gift Card
- Other  
  Không hỗ trợ:
- Card + Cash
- Card + Gift Card
- Cash + Gift Card
- Multiple Payments trong cùng Check  
  Nếu khách muốn dùng nhiều phương thức:
- Tạo thêm Check khác.

---

7. **Order Status**

   Khi có ít nhất một Check đã thanh toán:  
   Order Status = Processing  
   Khi toàn bộ Check đã thanh toán:  
   Order Status = Successful

---

8. **Gift Card Handling**

Gift Card Balance Validation

Khi chọn Gift Card:

Hệ thống kiểm tra Balance realtime.

Balance đủ

Tiếp tục thanh toán.

Balance không đủ

Hiển thị popup: _"Gift card balance is insufficient to pay this check. Would you like to create a new check for the remaining amount to be paid with another method?"_

---

User Selects Yes

System:

- Charge toàn bộ Gift Card Balance.
- Tạo Check mới cho phần còn lại.
-

## Chuyển sang màn hình thanh toán Check mới.

## User Selects No

Quay lại màn hình chọn Payment Method.

Lưu ý: Gift Card insufficient balance → Auto Create New Check chỉ hỗ trợ cho Split by Amount.  
Split Equally và Split by Items không hỗ trợ auto-create check khi Gift Card không đủ balance. User phải chọn payment method khác hoặc chỉnh lại split.  
Nếu Gift Card không đủ balance: Không tự động tạo Check mới.  
Show message: _Gift Card balance is insufficient for this check. Please select another payment method or modify the split configuration._  
User phải:

- Quay lại Split Screen
- Chia item lại
- Hoặc dùng payment method khác

---

9.  **Refund Rules**
10. **Full Refund**

    Cho phép Refund toàn bộ Order.  
    System:

- Refund tất cả Check đã thanh toán.
- Reverse Revenue.
- Reverse Commission.
- Reverse Tip.
- Reverse Tax.

---

2. **Partial Refund**

   ## Partial Refund luôn được thực hiện trên từng Check.

   Split by Items  
   User chọn Item trong Check cần Refund.  
   System Refund Item được chọn.

   Split Equally / Split by Amount  
   User chọn Check cần Refund.  
   System hiển thị danh sách Item của Order gốc.  
   User phải chọn Item cần Refund.  
   Không hỗ trợ Refund Amount tự do không gắn với Item.  
   Lý do:

- Đảm bảo Commission chính xác.
- Đảm bảo Revenue chính xác.
- Đảm bảo Tax chính xác.
- Đảm bảo Audit chính xác.

Lưu ý: khi partial refund mà có 1 item có amount lớn hơn các check hiện có thì chỉ cho full refund.

---

3. **Commission Reversal**

   Khi Refund Item:  
   System reverse:

- Revenue
- Tax
- Discount
- Commission  
  theo đúng Item được Refund.

---

4. **Tip Refund**

   Card Payment  
   Partial Refund:

- Refund Amount = Supported
- Refund Tip = Not Supported  
  Full Refund Check:
- Refund Amount = Supported
- Refund Tip = Supported

---

5. **Cash / Other Payment**

   Partial Refund:

- Refund Amount = Supported
- Refund Tip = Supported  
  Full Refund:
- Refund Amount = Supported
- Refund Tip = Supported

---

6. **Gift Card Payment**

   Không hỗ trợ Refund.  
   Chỉ hỗ trợ Void.

---

10. **Void Rules**
11. **Void Check**

    Cho phép Void từng Check.  
    Sau khi Void:

- Check quay về trạng thái chưa thanh toán.
- User có thể thực hiện Split lại.

---

2. **Void Order**

   Cho phép Void toàn bộ Order.  
   System Void toàn bộ Check liên quan.

---

11. **Re-open Order**
12. **Preserve Split Structure**

    Khi Re-open:  
    Hệ thống phải giữ nguyên:

- Split Method
- Check Structure
- Check Amount
- Payment History
- Tip History
- Refund History
- Void History

---

2. **Allowed Updates**

   Chỉ cho phép chỉnh sửa các thông tin không ảnh hưởng Amount:

- Customer Information
- Internal Note
- Staff Note
- Metadata khác

---

3. **Restricted Updates**

   Không cho phép:

- Add Item
- Remove Item
- Update Price
- Update Quantity
- Update Discount
- Update Promotion
- Update Tax
- Update Fee
- Update Surcharge
- Update Check Amount
- Change Split Method

---

12. **Receipt**

    Check Receipt: không in receipt cho từng check sau khi thanh toán xong.  
    Final Receipt  
    Hiển thị:

- Danh sách Check
- Amount từng Check
- Tip từng Check
- Payment Method từng Check
- Refund History
- Void History (nếu có)

---

13. **Audit Log**

    Ghi nhận:

- Cancel
- Refund
- Partial Refund
- Complete Order

---

14. **Reporting & Commission**

    Split Order không làm thay đổi:

- Revenue Report
- Sales Report
- Staff Commission
- Payroll Calculation
- Income Report  
  Tất cả Reporting vẫn dựa trên Order gốc.  
  Split Order chỉ là cơ chế chia thanh toán để phục vụ khách hàng.

---

15. **Receipt**

Khi sử dụng tính năng **Split Order**, chữ ký thanh toán được lưu theo từng check thay vì Order tổng. Do đó:

- Receipt của Order tổng có thể không hiển thị chữ ký.
- Trong **Order History**, cần hỗ trợ xem receipt của từng check.
- Receipt của mỗi check phải hiển thị đầy đủ thông tin thanh toán của check đó (items/services, subtotal, tax, tip, total, payment method, status, v.v.) cùng với chữ ký tương ứng.
- Điều này giúp đảm bảo khả năng đối soát và tra cứu chính xác đối với các order được thanh toán bằng nhiều check khác nhau.

---

- Mỗi check có action xem receipt riêng.
- Receipt của từng check cần hiển thị:
  - Check number
  - Subtotal, Discount, Tax, Tip, Total đã thanh toán trong check đó
  - Payment method
  - Payment status
  - Paid date/time
  - Customer signature của check đó (nếu có)

---

_Source: Google Docs — "Split Order" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._\*
\*_Note: 47 image(s) stripped from this export; see original Google Docs tab for visuals._
