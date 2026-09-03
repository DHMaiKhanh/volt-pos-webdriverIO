---
title: 'Order Management'
source: https://linear.app/fastboy/document/order-management-afeb73979dd4
linear_id: 0ce3807f-e79b-4e1f-bb86-82a76f6c914f
team: VOLT
updated: 2026-06-11T09:59:38.933Z
---

# Order Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **PORTAL DOCUMENTATION: ORDER MANAGEMENT** [Order Flow](https://linear.app/fastboy/document/order-flow-1bd212f296da)

## **1. Tổng quan (Overview)**

Module **Order Management** trên Portal cho phép Admin/Owner theo dõi toàn bộ lịch sử giao dịch diễn ra tại cửa hàng theo thời gian thực. Tại đây, người quản trị có thể tra cứu chi tiết đơn hàng, kiểm tra trạng thái thanh toán và thực hiện các nghiệp vụ xử lý sau bán hàng (Void/Refund) mà không cần thao tác trực tiếp trên máy POS.

## **2. Danh sách đơn hàng (Order Listing)**

### **2.1. Bộ lọc và Tìm kiếm (Filter & Search)**

Giao diện cung cấp các công cụ lọc để Admin nhanh chóng tìm thấy giao dịch cần thiết:

- **Search:** Tìm kiếm theo **Order ID** hoặc **Tên/Số điện thoại khách hàng**.
- **Date Range:** Lọc theo ngày tạo đơn (Created At) hoặc ngày cập nhật trạng thái (Updated At).
- **Payment Method:** Lọc theo hình thức thanh toán (Cash, Card, Gift Card, Other).
- **Status:** Lọc theo trạng thái đơn hàng (Successful, Refunded, Canceled, v.v.).

### **2.2. Thông tin hiển thị (Columns)**

Bảng danh sách hiển thị các thông tin tóm tắt:

- **Order ID:** Mã định danh duy nhất (VD: #OD10023).
- **Date/Time:** Thời gian giao dịch.
- **Customer:** Tên khách hàng (hoặc "Walk-in" nếu không có tên).
- **Total Amount:** Tổng giá trị đơn hàng.
- **Payment Method:** Phương thức thanh toán.
- **Status:** Trạng thái hiện tại (Được mã hóa màu sắc để dễ nhận diện).

---

## **3. Chi tiết đơn hàng (Order Details)** Khi nhấp vào một Order ID, hệ thống hiển thị chi tiết giao dịch bao gồm các phần sau:

### **3.1. Thông tin chung (Order Info)**

- **Order Summary:**
  - Subtotal (Tổng tiền dịch vụ/sản phẩm).
  - Discount (Giảm giá).
  - Tax (Thuế - nếu có).
  - Tip (Tiền boa).
  - **Total (Tổng thanh toán cuối cùng).**
- **Customer Info:** Tên, Số điện thoại, Nhóm khách hàng.

### **3.2. Chi tiết dịch vụ (Service Details)**

Liệt kê các dịch vụ/sản phẩm trong đơn hàng:

- Tên dịch vụ/sản phẩm.
- Nhân viên thực hiện (Staff name).
- Giá tiền: Giá cuối cùng và phần (-số tiền đã giảm/ % đã giảm)

### **3.3. Chi tiết thanh toán (Payment Details)**

Hiển thị lịch sử các lần thanh toán (Checks) trong đơn hàng:

- **Card:** Loại thẻ (Visa/Master...), 4 số cuối (Last 4 digits), Mã giao dịch (Auth Code/Trans ID).
- **Cash:** Số tiền khách đưa và tiền thừa (Change).
- **Gift Card:** Mã thẻ quà tặng đã sử dụng.

### **3.4. Lịch sử hoàn tiền/hủy (Refund/Void Logs)**

Nếu đơn hàng đã bị chỉnh sửa, mục này hiển thị,:

- Người thực hiện (By Staff).
- Thời gian thực hiện.
- Số tiền (Amount).
- Lý do (Reason: Staff mistake, Customer request, v.v.).

---

## **4. Định nghĩa trạng thái đơn hàng (Order Status Definitions)**

Admin cần nắm rõ các trạng thái sau để quản lý đối soát:

| Trạng thái                 | Mô tả                                                                                                 | Hành động cho phép trên Portal                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Successful - Unsettled** | Đơn hàng đã thanh toán nhưng chưa chốt sổ (Batch Close). Thường là các giao dịch trong ngày hiện tại. | View, Void (Cancel), Adjust Tip                               |
| **Successful - Settled**   | Đơn hàng đã hoàn tất và đã chốt sổ (tiền đã về hoặc đang xử lý bank).                                 | View, Refund (Full/Partial).                                  |
| **Canceled (Void)**        | Đơn hàng đã bị hủy toàn bộ giao dịch trước khi chốt sổ.                                               | View Only.                                                    |
| **Refunded**               | Đơn hàng đã được hoàn tiền 100%.                                                                      | View Only.                                                    |
| **Partial Refunded**       | Đơn hàng đã được hoàn tiền một phần.                                                                  | View, Partial Refund.                                         |
| **Refund Issue**           | **Quan trọng:** Giao dịch hoàn tiền qua thẻ bị lỗi từ phía Gateway.                                   | **Retry Refund** (Thực hiện lại lệnh hoàn tiền trên Gateway). |

_Lưu ý: Trạng thái **Refund Issue** là trường hợp đặc biệt chỉ xảy ra với thẻ (Card). Trên POS không thể xử lý lại, bắt buộc Admin phải vào Portal để kiểm tra và Retry lại giao dịch này_ trên Gateway\*.\*

---

## **5. Các tính năng quản trị (Admin Actions)**

Dựa trên trạng thái đơn hàng, Admin có thể thực hiện các hành động sau:

### **5.1. Void Order (Hủy đơn hàng)**

- **Điều kiện:** Chỉ áp dụng cho đơn hàng **Successful - Unsettled**.
- **Tác động:** Hủy toàn bộ giao dịch (Void transaction). Tiền sẽ không bị trừ khỏi thẻ khách hàng (đối với thẻ) hoặc ghi nhận trả lại tiền mặt.
- **Báo cáo:** Ghi nhận trạng thái Canceled, không tính vào doanh thu.

### **5.2. Refund / Partial Refund (Hoàn tiền)**

- **Điều kiện:**
  - Áp dụng cho đơn hàng **Successful - Settled**.
  - Nếu trong 1 Order có credit transaction chưa Batch/Close → disable nút Refund
- **Partial Refund (Hoàn một phần):**
  - Bắt buộc phải chọn service/product (Item) để thực hiện partial refund
  - Nếu chọn All option, tức là chọn hết service trong order đó > thì thực hiện full refund
  - Nếu chọn ít hơn total service > thì thực hiện partial refund
  - **Specical Case: Khi select service để partial refund mà trong order có discount/TAX:** Thì mình cũng sẽ refund trên giá service sau discount, phần discount apply cho order thì mình chia phần trăm tỉ lệ trên từng service, rồi sau refund trên giá đó
  - **Specical Case: nếu 1 cái promotion rule apply là đối với order từ $100 trở lên, nên partial refund sẽ giảm order về dưới $100, thì cái promotion cũ mình nên giữ không?**
    - Promotion vẫn nên giữ, tại vì đúng là đã chốt tại lúc checkout order (settled) rồi > k thay đổi gì cả
- **Quy tắc tiền Tip (Lưu ý quan trọng):**
  - Nếu giao dịch gốc là **Auth** (thường thấy ở nhà hàng/nail salon): Chỉ được hoàn tối đa số tiền gốc (Base Amount), **không hoàn được tiền Tip** khi Partial Refund.
  - Nếu giao dịch gốc là **Sale**: Có thể hoàn cả Tip.
- **Full Refund:** Hoàn trả 100% bao gồm cả Tip và Service Fee.

### **5.3. Adjust Tip**

Adjust Tip: chỉnh sửa lại số tiền Tip sau khi order đã được thanh toán thành công. Thêm action Adjust Tip trong Order Detail đối với những order thỏa điều kiện sau:

- Status của order: **Successful - Unsettled**
- Payment trong order được thanh toán bằng method: **Card / Cash / Other**
- Riêng đối với method Card, status của payment trong order: **Auth**
- Đối với order có nhiều payment method: hiển thị list payment method và phải select 1 payment method cụ thể để thực hiện Adjust Tip

**Lưu ý:**

- Đối với method Gift Card: KHÔNG cho phép Adjust Tip
- Sau khi Adjust TIP, nếu order có nhiều Staff, thì auto update lại Split Tip với tip mới.
- Chỉ cho phép add Tip khi có Staff trong order

### **5.4. Xử lý sự cố giao dịch (Issue Handling)**

- **Retry Refund:** Đối với các đơn hàng có trạng thái **Refund Issue**, Admin sử dụng Portal để gửi lại lệnh hoàn tiền trên Gateway.
- **View Receipt:** Xem và in lại hóa đơn (gửi email cho khách nếu cần).

---

## **6. Logic Báo cáo liên quan (Report Impact)**

Mọi thao tác trên Order Management sẽ ảnh hưởng trực tiếp đến báo cáo tài chính trên Portal,:

- **Net Income** = (Total Sale - Total Refund) - Total Discount + Tip - Gift Card Sale.
- **Amount Collected** (Tiền thực thu) = Card + Cash + Others + Tip.
- **Gift Card Sales:** Doanh thu bán Gift Card chưa được tính là thu nhập (Income) cho đến khi thẻ đó được dùng để thanh toán cho một đơn hàng khác (Redeemed).

---

_Source: Google Docs — "Order Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
