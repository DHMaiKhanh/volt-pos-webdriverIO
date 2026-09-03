---
title: 'Order Pending'
source: https://linear.app/fastboy/document/order-pending-caa07c054f23
linear_id: 03845bad-0a98-47fa-8b3d-8d95407eb0e0
team: VOLT
updated: 2026-06-11T09:59:10.174Z
---

# Order Pending

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**POS Pending Orders**

1. **Mục tiêu**

Xây dựng workflow Pending Order trong POS nhằm hỗ trợ mô hình vận hành thực tế:

- Tạo order trước khi thanh toán
- Hỗ trợ luồng GoCheckin
- Theo dõi khách đang làm dịch vụ
- Tách biệt quá trình phục vụ và thanh toán

Hiện tại flow POS đang gắn chặt:

```
Create Order → Checkout → Payment Success
```

Điều này gây hạn chế:

- Không thể tạo trước order cho khách walk-in
- Không phù hợp với flow check-in và queue management
- Staff phải complete payment trước khi xử lý order tiếp theo
- Khó theo dõi khách đang làm dịch vụ
- Reopen order chưa có lifecycle rõ ràng

Đề xuất:

```
Tạo Pending Order trước
→ xử lý dịch vụ
→ thanh toán sau
```

2. **Định nghĩa Pending Order**

- Status: Pending
- Ý nghĩa:

```
Order chưa được checkout hoàn tất (chưa thanh toán)
Pending Orders sẽ không hiển thị trong Order History.
```

- Pending Order đại diện cho:

```
Khách đang trong quá trình phục vụ hoặc chờ thanh toán.
```

---

3. **Các nguồn tạo Pending Order**

Pending Order có thể được tạo từ 3 nguồn:

1. Create Order thủ công

Flow:

```
POS Home
→ Create Order
→ Tạo Pending Orderpar
```

Use case:

- Walk-in customer
- Staff tạo order trước
- Khách làm dịch vụ trước khi thanh toán

2. Checkout từ Appointment

Flow:

```
Appointment
→ Checkout
→ Tạo Pending Order
→ Thanh toán sau
```

Use case:

- Khách đến theo appointment
- Service có thể thay đổi trong lúc làm
- Thanh toán sau khi hoàn tất dịch vụ

3. GoCheckin

Flow:

```
Customer check-in success
→ Auto-create Pending Order
→ Order tag: Checked in
```

Use case:

- Queue management
- Theo dõi khách đang ở tiệm
- Staff chủ động xử lý order

---

## **4. Kiến trúc UX đề xuất**

Đề xuất tách thành 2 màn hình riêng biệt để:

- Giảm cognitive overload
- Tối ưu workflow vận hành
- Dễ scale khi số lượng order lớn

1. **Home Screen — Pending Orders Queue**

Mục tiêu: Đây là màn hình vận hành chính của POS.

Dùng để:

- Theo dõi khách đang ở tiệm
- Theo dõi trạng thái xử lý dịch vụ
- Mở nhanh order cần thao tác
- Quản lý queue

Màn hình này KHÔNG dùng để edit sâu order.

**Layout đề xuất**

Header actions

```
Search
Date picker
Filters
Create Order
```

---

Pending Order Card

Mỗi card hiển thị:

```
Order ID
Customer name
Cusotmer Phone
Tag
Created at
Status: Pending
```

2. **Create/Update Order — Order Workspace**

- Mục tiêu:
- Màn hình xử lý chi tiết order.
- Đây là nơi staff thao tác chính với order

**Layout đề xuất**

- **Left Sidebar**: Mini Pending Orders list.

Mục đích:

```
Switch nhanh giữa các order
Hỗ trợ multi-order workflow
Giữ continuity khi thao tác
```

Thông tin hiển thị:

```
Order ID
Customer Name
Customer Phone
Created At
```

- **Center Workspace**

Khu vực thao tác chính: như giao diện hiện tại, gồm:

- Customer Information
- Staff Management: Bảng staff
- Service Management: Bảng service
- Order Actions / Order Summary

---

## **5. Offline Mode**

POS vẫn có thể tạo Pending Order khi offline.

State:

```
order_status = Pending
```

Offline Indicators

UI cần hiển thị rõ, order này đang ở state nào, vd

```
Waiting for sync
Sync failed
Conflict detected
```

---

Chống duplicate

Để tránh tạo trùng Pending Order:

Quy tắc hiển thị Order  
Pending Orders

Hiển thị tại:

```
Pending Orders Queue
Order Workspace
```

---

Final UX Flow  
Create Order Flow (bao gồm cả Checkout Order từ Appointment)

```
Create Order
→ Pending
→ Service Processing
→ Checkout
→ Payment Success
→ Completed
```

---

GoCheckin Flow

```
GoCheckin
→ Auto-create Pending Order
→ Staff xử lý dịch vụ
→ Checkout
→ Payment Success
```

---

**Một số lưu ý:**

- Nếu đã thực hiện Checkout từ Appointment rồi, nhưng vẫn chưa thanh toán cho order, click Checkout tiếp thì vẫn redirect đến Order Pending đã checkout trước đó.
- Offline mode, chỉ cho Complete order bằng Cash và sync lại khi online.
- Order Pending không tự động complete hay cancel đi sau khi qua ngày mới, và vẫn cho phép thanh toán cho những order Pending của ngày trong quá khứ, thì complete order thời gian nào thì đó chính là Order Date
- Mọi thay được thực hiện trên Pending Order đều được ghi nhận, cho đến khi payment success → Completed

---

_Source: Google Docs — "Order Pending" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
