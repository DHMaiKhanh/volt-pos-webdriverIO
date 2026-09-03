---
title: 'POS for Android Device - P8 Dual'
source: https://linear.app/fastboy/document/pos-for-android-device-p8-dual-0c753006a132
linear_id: 1d53c803-9ebc-4a4c-80a6-534777d30ed6
team: VOLT
updated: 2026-06-26T10:38:11.552Z
---

# POS for Android Device - P8 Dual

# **1. Giới thiệu**

## **P8 Android POS là gì?**

P8 Android POS là phiên bản POS chạy trên thiết bị Android P8, được phát triển nhằm mang đến một giải pháp bán hàng nhỏ gọn, linh hoạt nhưng vẫn hoạt động trong cùng hệ sinh thái với Fastboy POS.

Merchant có thể sử dụng P8 như một thiết bị POS độc lập hoặc vận hành song song với Windows POS trong cùng cửa hàng.

Toàn bộ dữ liệu trên P8 được đồng bộ với Windows POS và Portal, bao gồm:

- Services
- Staff
- Customers
- Orders
- Payments
- Gift Cards
- Promotions
- Discounts
- Rewards
- Reports
- Merchant Settings

P8 không xây dựng business logic riêng. Toàn bộ quy trình nghiệp vụ, công thức tính toán và dữ liệu đều sử dụng chung với Windows POS nhằm đảm bảo tính nhất quán trên toàn hệ thống.

---

# **2. Order Management**

Order Management là chức năng cốt lõi của P8, cho phép merchant tạo, quản lý và thanh toán Order tương tự Windows POS.

---

## **Pending Orders**

Pending Order giúp merchant lưu lại các Order chưa thanh toán để tiếp tục xử lý sau.

### **Chức năng**

- Xem danh sách Pending Orders.
- Tạo Pending Order mới.
- Chỉnh sửa Pending Order.
- Tiếp tục thanh toán Pending Order.

Pending Order luôn được đồng bộ giữa tất cả thiết bị POS của cùng Merchant.

Ví dụ:

- Order được tạo trên Windows POS sẽ xuất hiện trên P8.
- Order được tạo trên P8 cũng sẽ xuất hiện trên Windows POS.

---

## **Create Order**

Merchant có thể tạo Order bằng cách:

- Chọn Customer.
- Thêm Service.
- Chỉ định Staff thực hiện dịch vụ.
- Thêm Note (nếu cần).
- Kiểm tra thông tin trước khi Checkout.

---

## **Order History**

Merchant có thể xem lại các Order đã tạo.

Hỗ trợ:

- Danh sách Order.
- Search Order.
- Filter theo ngày.
- Xem chi tiết Order.

---

## **Payment**

P8 hỗ trợ đầy đủ các hình thức thanh toán hiện có trên Windows POS.

### **Payment Methods**

- Card
- Cash
- Gift Card
- Other

---

### **Card Payment (App-to-App)**

Đối với thanh toán bằng **Card**, P8 sử dụng cơ chế **App-to-App** để giao tiếp với ứng dụng **BambooPay** trên cùng thiết bị.

P8 không trực tiếp xử lý giao dịch thẻ mà BambooPay sẽ đảm nhiệm toàn bộ quá trình thanh toán.

### **Quy trình thanh toán**

1. Merchant chọn **Card** trên P8.
2. P8 gửi thông tin giao dịch sang ứng dụng BambooPay.
3. BambooPay thực hiện giao dịch thẻ.
4. Sau khi hoàn tất, BambooPay trả kết quả về P8.
5. P8 cập nhật:
   - Payment Status.
   - Order Status.
   - Batch.
   - Reports.
6. Dữ liệu được đồng bộ sang Windows POS và Portal.

### **Các trường hợp xử lý**

- Thanh toán thành công.
- Thanh toán thất bại.
- Merchant hủy giao dịch.
- Không kết nối được BambooPay.
- Timeout hoặc BambooPay không phản hồi.

Nếu giao dịch không thành công, Order vẫn giữ nguyên trạng thái trước khi thanh toán để merchant có thể thực hiện lại hoặc chọn phương thức thanh toán khác.

---

### **Sau khi thanh toán thành công**

- Order chuyển sang trạng thái Completed.
- Payment được lưu vào hệ thống.
- Batch được cập nhật.
- Reports được cập nhật.
- Đồng bộ dữ liệu sang Windows POS và Portal.

---

## **Promotion, Reward & Item Discount**

Trong quá trình Checkout, merchant có thể áp dụng:

- Promotion
- Reward
- Item Discount

Business logic và công thức tính hoàn toàn giống Windows POS.

---

# **3. Split Order**

## **Giới thiệu**

Split Order cho phép merchant chia một Order thành nhiều Check để khách hàng có thể thanh toán riêng.

Phù hợp trong các trường hợp:

- Một nhóm khách muốn chia hóa đơn.
- Mỗi khách thanh toán phần dịch vụ của mình.
- Một Order cần chia thành nhiều lần thanh toán.

Sau khi Split, tất cả Check vẫn thuộc cùng một Order.

---

## **Các hình thức Split**

### **Split by Items**

Merchant chọn từng Service để đưa vào các Check khác nhau.

### **Split by Amount**

Merchant nhập số tiền mong muốn cho từng Check.

### **Split Equally**

Hệ thống tự động chia đều tổng tiền thành nhiều Check.

---

## **Thanh toán**

Mỗi Check có:

- Payment Method riêng.
- Payment Status riêng.
- Receipt riêng.
- Card Signature riêng (đối với Card Payment).

Order chỉ hoàn thành khi tất cả Check đã được thanh toán.

---

## **Lưu ý**

- Không thể thay đổi cách Split sau khi có Check đã thanh toán.
- Muốn Split lại cần Void các Check đã thanh toán trước.
- Tip được nhập riêng cho từng Check.
- Tax, Discount và Promotion được phân bổ tự động theo business rule hiện hành.

---

# **4. Merge Order**

## **Giới thiệu**

Merge Order cho phép merchant gộp nhiều Pending Order thành một Order duy nhất trước khi thanh toán.

Phù hợp trong các trường hợp:

- Nhiều khách muốn thanh toán chung.
- Nhiều Order cần gộp thành một hóa đơn.
- Nhiều nhân viên tạo Order riêng nhưng cần Checkout cùng lúc.

---

## **Cách hoạt động**

Merchant chọn từ hai Pending Order trở lên để Merge.

Sau khi Merge:

- Tất cả Service được gộp vào cùng một Order.
- Tổng tiền được tính lại.
- Promotion, Discount và Tax được tính lại theo Order mới.

---

## **Sau khi Merge**

Merchant có thể:

- Checkout.
- Áp dụng Promotion.
- Áp dụng Reward.
- Áp dụng Discount.
- Tiếp tục Split Order (nếu được hỗ trợ).

---

## **Lưu ý**

- Chỉ hỗ trợ Merge Pending Order.
- Không hỗ trợ Merge Order đã thanh toán.
- Sau khi Merge thành công, các Pending Order cũ sẽ được thay thế bằng Order mới.

---

# **5. Gift Card**

Gift Card giúp merchant tra cứu nhanh thông tin của thẻ quà tặng.

## **Chức năng**

Merchant có thể:

- Nhập Gift Card Code.
- Quét QR Code.
- Kiểm tra Balance.
- Xem Status.
- Xem Transaction History.

Thông tin hiển thị gồm:

- Gift Card Number
- Current Balance
- Status
- Transaction History

---

# **6. Batch History**

Batch History giúp merchant theo dõi các Batch đã được đóng.

## **Chức năng**

Merchant có thể:

- Xem danh sách Batch.
- Filter theo ngày.
- Filter theo trạng thái.
- Xem chi tiết từng Batch.

Thông tin hiển thị:

- Batch Date
- Batch Status
- Total Amount
- Total Orders

Merchant cũng có thể xem danh sách Order thuộc từng Batch.

---

# **8. Refund / Void**

Refund và Void cho phép merchant xử lý các giao dịch đã thanh toán trong trường hợp cần hủy giao dịch hoặc hoàn tiền cho khách hàng.

---

## **Void Payment**

Void được sử dụng khi Payment đã thanh toán nhưng chưa được Batch Close.

Merchant có thể:

- Void toàn bộ Payment.
- Hủy giao dịch trước khi Batch được đóng.

Sau khi Void thành công:

- Payment chuyển sang trạng thái Void.
- Order được cập nhật.
- Reports được cập nhật.
- Batch được cập nhật.
- Đồng bộ sang Windows POS và Portal.

---

## **Refund Payment**

Refund được sử dụng khi Payment cần hoàn tiền cho khách hàng.

Merchant có thể:

- Full Refund.
- Partial Refund (đối với Payment Method được hỗ trợ).

Sau khi Refund thành công:

- Payment History được cập nhật.
- Order được cập nhật.
- Reports được tính toán lại.
- Income và Payroll của Staff được điều chỉnh theo business rule hiện hành.
- Đồng bộ sang Windows POS và Portal.

---

## **Refund History**

Merchant có thể xem:

- Refund Amount.
- Refund Time.
- Refund Status.
- Refund Reason.
- Người thực hiện Refund.

---

## **Lưu ý**

- Khả năng Void hoặc Refund phụ thuộc vào trạng thái Payment và Payment Gateway.
- Quy trình xử lý hoàn toàn giống Windows POS.

---

# **9. Receipt Management**

Receipt Management cho phép merchant xem, in hoặc gửi lại hóa đơn sau khi Order hoàn tất.

---

## **View Receipt**

Merchant có thể xem lại Receipt bất kỳ lúc nào.

Receipt hiển thị:

- Merchant Information
- Customer Information
- Order Information
- Services
- Staff
- Discount
- Promotion
- Tax
- Tip
- Payment Information
- Total Amount

---

## **Print Receipt**

Merchant có thể in lại Receipt.

Receipt sẽ được gửi đến máy in đã cấu hình trên P8.

---

## **Send Receipt**

Merchant có thể gửi Receipt cho khách hàng thông qua các phương thức được hệ thống hỗ trợ.

Ví dụ:

- Email
- SMS

---

## **Receipt History**

Receipt có thể được xem lại từ:

- Order History.
- Payment Detail.
- Transaction Detail.

---

## **Lưu ý**

- Receipt luôn hiển thị dữ liệu mới nhất của Order.
- Nếu Order đã Refund hoặc Void, Receipt sẽ hiển thị trạng thái tương ứng.
- Receipt trên P8 sử dụng cùng mẫu và Receipt Settings với Windows POS.

---

# **7. Reports**

P8 hỗ trợ các báo cáo quan trọng giúp merchant theo dõi hoạt động kinh doanh.

- Daly Sale Report
- Staff Income

---

## **Daily Sale Report**

Hiển thị:
**Daily Sale Report detail:**

List Order Detail

- Order #: orderCode
- Sale: total amount service sale/refund trên order sau Discount
- Tax = Tax trên order
- Tip = Tip (Total tip trên order)
- Total = Total Sale + Tip + Tax
  —
  **INCOME DETAIL**
- Sale = Total Sale/Refund amount sau Discount
- Tip = Total tip
- Tax Collected = total Tax
- **Total Payment = Sale + Tip + Tax Collected**
  **—**
  **PAYMENT DETAIL**
- Card = Total Sale amount by Card = (Total Sale Card - Total Refund Card )
- Cash = Total Sale amount by Cash = (Total Sale Cash - Total Refund Cash)
- Others = Total Sale amount by Others = (Total Sale Others - Total Refund Others)
- **Amount Collected = Card + Cash + Others**
- Gift Card Redemption: Total gift card redemption
- **TOTAL PAYMENT = Amount Collected + Gift Card Redemption**

Giúp merchant theo dõi doanh thu trong ngày.

---

## **Staff Income**

Hiển thị:

- Staff listing: gồm những thông tin sau:
  - Search: Staff Nickname
  - Filter:
    - Filter theo Payroll Period
    - Đối với kỳ lương hiện tại chưa chốt, hiển thị ở đầu danh sách: Current Period (06/15 - 06/28)
  - Data table: gồm những column
    - Staff: show staff nickname
    - Orders: tổng số lượng order của staff
    - Total Income
- Staff Income detail theo từng staff và theo từng setting Compensation của staff đó:

1. **STAFF INCOME - Commission**
   - **Satff Info:**
     - Staff Name: Nickname
     - Date:
       - Xem theo 1 ngày:
         - Date: 04/15/2025
       - Xem theo range:
         - Date: 04/15/2025 - 04/30/2025
         - No. of WD: 8 days
   - **Order listing**
     - Order#
     - Sale/Refund: total amount order sale/refund
     - Supply: total supply trên tất cả sevice trên order
     - Tip: total tip trên order
   - **Staff Income Detail**
     - Sale = total amount SALE của order
     - Refund = total amount REFUND của order
     - **Subtotal = Sale - Refund**
     - Supply Fee (incl. Sale & Refund)
     - **Staff Commission = (Subtotal - Supply fee) x 60%**
     - Discount Charge*: Tổng số tiền promotion staff chia với chủ tiệm*
     - Card Charge - Commission: _Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Commission, được setting trong Staff Compensation - On Staff Commission_
     - _Card Charge - Tip: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Tip, được setting trong Staff Compensation - On Credit Card Tip_
     - Clean Up Fee/Deduction: số $ setting trong staff và nhân lên theo số ngày xem report
     - Tip = Total tip
     - **TOTAL INCOME = (Staff Commission - Clean up fee + Tip - Card Charge Commission - Card Charge Tip – Discount Charge)**
       - Pay 1 = (Staff Commission x 30% - Clean up fee - Card Charge Commission - Card Charge Tip – Discount Charge)
       - Pay 2 = (Staff Commission x 70% + Tip)
2. **STAFF INCOME (1 day) - Salary / Commission + Salary**
   **Pay by Hour/Day/Period**
   - **Satff Info:**
     - Staff Name: Nickname
     - Date: 04/15/2025
     - Clock In: 9:00:00 AM
     - Clock Out: 5:00:00 PM
     - Working Hours: 8
   - **Order listing**
     - Order#
     - Sale/Refund: total amount order sale/refund
     - Tip: total tip trên order
   - **Staff Income Detail**
     - Sale = total amount SALE của order
     - Refund = total amount REFUND của order
     - **Subtotal = Sale - Refund**
     - Rate: số được setting trong staff Compensation - Salary
       - Nếu là Salary by Period: lương 1 kì nhưng được chia cho số ngày trong kì đó, để nếu xem report cho số ngày nhỏ hơn 1 kì lương, thì Gross Income mới show đúng = Số ngày đang xem x số lương của 1 ngày trong kì đó. VD:
         - Pay Period: 1 week
         - Salary by Period = $7000
         - Xem report cho 3 ngày
         - Rate = $1000
         - Gross Income = $1000 * 3 = $3000
       - Wage Per Hour: lương 1h
       - Wage Per Day: lương 1 ngày
     - Gross Income: [số ngày/giờ làm việc] x [rate]
     - Clean Up Fee/Deduction: số $ setting trong staff và nhân lên theo số ngày xem report
     - Tip = Total tip
     - **TOTAL INCOME = Gross Income + Clean Up Fee + Tip**
       (Hourly Pay - Clean up fee + Tip)

**Một số lưu ý:**

- Salary by Period: trả lương theo kì payroll
- Wage Per Hour: trả lương theo giờ, cần Checkin - Checkout để count được số giờ làm việc.
- Wage Per Day: trả lương theo ngày, cần Checkin để count được số ngày có đến tiệm làm việc.
- Clean Up Fee/Deduction: nếu tính Salary by Period, thì tính fee trên số ngày nhận lương của kì đó
- Staff Income chỉ là report dự trù số tiền Staff sẽ được nhận, con số chính xác vẫn là trong Payroll khi chốt kì lương.
- Clock In/Clock Out:
  - Nếu xem theo 1 ngày, và chỉ có 1 ca được checkin, thì show Clock In/Clock Out cụ thể
  - Nếu xem theo 1 range date:
    - Để trống Clock In/Clock Out
    - Wage Per Hour: show tổng Working Hours
    - Wage Per Day: show tổng Working Days
    - Salary by Period: luôn để trống Clock In/Clock Out và show tổng Working Days
- Nếu Staff đang có setting **Salary** hoặc **Commission + Salary,** thì trên Staff Income luôn show cả 2 phần cho cả Commission và Salary, nhưng Total Income sẽ show phần Salary. Vì chỗ này còn phụ thuộc vào setting **Staff Days Off Setting** > thì mới chốt được là staff này nhận Commission hay Salary

Giúp merchant theo dõi thu nhập của từng nhân viên.

---

# **10. Đồng bộ dữ liệu**

P8 hoạt động như một thiết bị POS trong cùng hệ thống với Windows POS và Portal.

## **Đồng bộ Master Data**

Khi Merchant thay đổi dữ liệu trên Windows POS hoặc Portal, P8 sẽ tự động cập nhật.

Bao gồm:

- Services
- Staff
- Customers
- Promotions
- Rewards
- Discounts
- Taxes
- Price List
- Gift Cards
- Merchant Settings
- Payment Settings
- Order Settings

---

## **Đồng bộ Order & Payment**

- Order tạo trên Windows POS sẽ xuất hiện trên P8.
- Order tạo trên P8 sẽ xuất hiện trên Windows POS.
- Pending Order luôn được đồng bộ giữa các thiết bị.
- Khi Order được thanh toán, trạng thái sẽ được cập nhật trên toàn bộ hệ thống.
- Payment, Batch và Reports được cập nhật ngay sau khi giao dịch hoàn tất.

---

# **11. Hardware & System Integration**

Ngoài việc sử dụng chung dữ liệu với Windows POS, P8 còn tích hợp với các thiết bị và ứng dụng bên ngoài để phục vụ quá trình bán hàng.

## **BambooPay**

Thanh toán thẻ được thực hiện thông qua cơ chế **App-to-App** với ứng dụng BambooPay.

BambooPay chịu trách nhiệm xử lý toàn bộ giao dịch thẻ và trả kết quả về P8 sau khi hoàn tất.

## **Printer**

P8 hỗ trợ kết nối với máy in để:

- In Receipt.
- In lại Receipt sau khi Order hoàn tất.

## **QR Scanner / Camera**

P8 sử dụng Camera hoặc QR Scanner của thiết bị để:

- Quét Gift Card.
- Quét các mã QR khác được hệ thống hỗ trợ trong tương lai.

---

# **12. Nguyên tắc hoạt động**

- P8 sử dụng cùng business logic với Windows POS.
- Không xây dựng business logic riêng cho P8.
- Dữ liệu giữa P8, Windows POS và Portal luôn được đồng bộ.
- Merchant có thể sử dụng P8 song song với Windows POS mà không làm thay đổi quy trình vận hành hiện tại.

---

# **13. So sánh tính năng giữa Windows POS và P8**

| **Chức năng**                       | **Windows POS**    | **P8**            |
| ----------------------------------- | ------------------ | ----------------- |
| Pending Order                       | ✅                 | ✅                |
| Create Order                        | ✅                 | ✅                |
| Order History                       | ✅                 | ✅                |
| Payment                             | ✅                 | ✅                |
| Card Payment (App-to-App BambooPay) | ❌ Magensa Gateway | ✅ Bamboo Gateway |
| Promotion / Reward / Item Discount  | ✅                 | ✅                |
| Split Order                         | ✅                 | ✅                |
| Merge Order                         | ✅                 | ✅                |
| Gift Card Balance                   | ✅                 | ✅                |
| Batch History                       | ✅                 | ✅                |
| Daily Sale Report                   | ✅                 | ✅                |
| Staff Income                        | ✅                 | ✅                |
| Refund / Void                       | ✅                 | ✅                |
| Receipt Management                  | ✅                 | ✅                |
