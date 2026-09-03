---
title: 'Order Flow'
source: https://linear.app/fastboy/document/order-flow-1bd212f296da
linear_id: 633fec43-fcc4-426b-9b95-f3e4263ed237
team: VOLT
updated: 2026-07-09T07:01:59.094Z
---

# Order Flow

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# \[Volt POS\] POS Home screen (Order Flow)

# Header Bar

## Quick Redirect - Appointment

Link booking online: [https://booking.gocheckin.net/v2/3](https://booking.gocheckin.net/v2/3), thực hiện book appointment từ site này, và hiển thị lên Calendar Appointment của POS.

Thời điểm hiện tại, chỉ read-only những appointment đến từ booking online, không create appointment từ POS.

Click Check-out từ appointment, sẽ tạo ra order trên POS và không quan tâm đến status của Appointment, muốn tạo order thì click Checkout và sẽ fill những service/staff từ appointment qua Order.

Trong một thời điểm chỉ được create 1 order từ 1 appointment.

**Mô tả chi tiết như sau:**

- **Appointment Calendar:** gồm những thông tin sau
  - Date: default today
  - Time: 12:00AM - 11:45PM
  - List Staff available:
    - Staff status Active
    - Column đầu tiên là Unassigned (có hoặc ẩn tùy theo setting)
    - List staff: theo thứ tự alphabet nickname
    - Show available time theo Work Hour của staff đó
  - Line current time
  - Filter:
    - Staff:
      - Unassigned
      - Staff Nickname
      - All
    - Status: Scheduled / Canceled / Confirmed / Done
    - Date: default Today
  - Button: New Appointment
- **Appointment List:** gồm những thông tin sau
  - Customer info: 1 trong 2 thông tin sau
    - Customer Name
    - Customer phone: 4 số cuối nếu không có customer name
  - Service Name
  - Duration
  - Appointment Note
- **Appointment detail modal**: gồm những thông tin sau
  - Appointment status
  - Customer Name
  - Customer phone
  - Service name
  - Duration time
  - Staff nick name
  - Appointment Note
  - Action button: Checkout / Edit / Cancel / Confirm
- **Add new Appointment:** form create new appointment gồm những thông tin sau
  - Title: Add New Appointment
  - Customer Phone (required)
  - Customer Name (optional)
  - Date: chọn chọn tạo appointment, có thể chọn ngày trong quá khứ
  - Service/Staff:
    - Start time: thời gian đặt hẹn
    - Staff:
      - Any Staff
      - Show list staff nickname - status Active
    - Duration: thời gian thực hiện service, default sẽ hiển thị Duration của service theo setting
    - Service: list service available
    - Một số lưu ý:
      - Sau khi chọn Service, có thể update Duration tùy ý
      - Nếu chọn Any Staff, thì appointment đó sẽ được gán cho Unassigned column
      - Có thể chọn nhiều Service, nhiều Staff trong 1 appointment
      - Một Start Time sẽ tạo thành 1 label appointment trong Calendar
      - Có thể chọn nhiều service cho cùng 1 staff với cùng Start Time
  - Tag: được update tự do, không có ràng buộc, chỉ là dấu hiệu nhận biết trong appointment, không ảnh hưởng đến logic.
    - Requested (Khách gửi yêu cầu đặt lịch nhưng chưa được tiệm xác nhận.)
    - Highlight (Appointment được đánh dấu nổi bật để dễ nhận biết.)
    - No Show (Khách không đến và không thông báo.)
    - Lưu ý: sau khi Save Appointment và mở lại appointment đó thì mới xuất hiện option No Show
- **Edit Appointment/Appointment Detail**: được update những thông tin sau
  - Date
  - Customer phone
  - Customer name
  - Service/Staff/Start Time/Duration
  - Add more Service/Staff
  - Delete Service/Staff: nhưng tối thiểu phải có 1 service/staff trong appoinment
  - Appointment Notes
  - Tag: được update tự do, không có ràng buộc, chỉ là dấu hiệu nhận biết trong appointment, không ảnh hưởng đến logic.
    - Requested
    - Highlight
    - No Show
  - Ngoài ra, sẽ hiển thị thêm thông tin về Checkin/Order/Appointment của Customer đó, gồm:
    - Appointment: total appointment (status: Scheduled / Canceled / Confirmed / Done)
    - Spent: tổng số tiền đã dùng
    - Point: số điểm hiện tại
    - Visit: tổng số lần đến tiệm
    - Checkin tab: show list checkin đến thời điểm hiện tại của customer, gồm:
      - Checkin/checkout date: thời gian tạo order
      - Status
      - Point
    - Order tab: show list order đến thời điểm hiện tại của customer, gồm:
      - Order created at
      - Staff
      - Service
      - Total Amount
    - Appointment tab: show list appointment đến thời điểm hiện tại của customer, gồm:
      - Appointment Date
      - Staff
      - Service
      - Duration
      - Status
- **Lưu ý đặc biệt:**
  - Khi 1 order đang create, và user back ra overview checkout 1 order mới từ Appointment, thì:
    - 1 - phải complete order này trước, xong sau đó back ra check out order khac từ appointment
    - 2 - sẽ thoát order hiện tại (order này chỉ đang tạo và chưa thanh toán gì cả), checkout order từ appointment thì replace order đang thực hiện bằng thông tin của appointment đang checkout.Đồng thời sẽ hiển thị popup warning replace thông tin của order bằng thông tin từ appointment vào order hiện tại:

      **Title:** Update Order from Appointment

      **Message:** We will update this order using information from the selected appointment.  
      Current order changes will be replaced.

      Would you like to continue?

      **Actions:**
- Keep Current Order
- Update Order
- **Appointment workflow :**

| Status / Action                                                                            | Edit                                                                  | Cancel           | Confirm                                    | Check Out                                  |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------- | ------------------------------------------ | ------------------------------------------ |
| **Scheduled** \[Appointment vừa mới được tạo, phải Confirm mới có thể convert sang Order\] | Yes Date / Time Staff / Service Customer: Phone/Name Appointment note | Yes              | Yes Create an order with appointment info. | No                                         |
| **Canceled** \[Appointment bị cancel\]                                                     | No                                                                    | No               | No                                         | No                                         |
| **Confirmed** \[Appointment đã được confirm, có thể convert sang Order\]                   | Yes Date / Time Staff / Service Customer: Phone/Name Appointment note | Yes Order Delete | No                                         | Yes Redirect to the checkout order screen. |
| **Done** \[Appointment đã convert sang Order và Order đã Complete\]                        | No                                                                    | No               | No                                         | No                                         |

- **Một số lưu ý:**
  - Chỉ được tạo appointment cho staff vào Work Hour của staff đó
  - Chỉ có Booking online từ [https://booking.gocheckin.net/v2/3](https://booking.gocheckin.net/v2/3) mới bị depend lên Business Work Hour của tiệm. Đối với POS thì sẽ mở full khung giờ trong ngày
  - Vẫn được tạo appointment cho ngày quá khứ, nhưng khi Checkout appointment đó thì created at của order là sẽ thời điểm click Checkout appointment
  - Nếu click Checkout và update list service/staff trong order sẽ không ảnh hưởng đến detail hiện tại của appointment
- **Một số setting liên quan đến Appointment cóc thể thực hiện trên giao diện:**
  - "Any Staff" option will be used when your customer doesn't know who to book online.
  - Hide unassigned column when having no appointment
  - You don't need to confirm your online bookings, which means all online bookings from your customers will be automatically confirmed right after they book.
- **Một số key setting trên Insight:**

| Setting Key                                            | Description                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| config.appointment.active                              |                                                                                                                               |
| module.appointment.active                              |                                                                                                                               |
| module.appointment.book_time_limit                     |                                                                                                                               |
| module.appointment.book_day_limit                      |                                                                                                                               |
| module.appointment.split_time                          | (Booking online) Chia khung thời gian để book, hiện tại là 15 phút                                                            |
| module.appointment.page_staff.active                   | (Booking online)                                                                                                              |
| module.appointment.page_service.active                 | (Booking online)                                                                                                              |
| module.appointment.any_staff                           |                                                                                                                               |
| module.appointment.any_staff.auto_assign               | (0) Auto assign to available staff if choose any staff (1) Customer will assign staff manually                                |
| module.appointment.skip_owner_confirm                  | (0) Appointment sau khi được create sẽ có status **Scheduled** (1) Appointment sau khi được create sẽ có status **Confirmed** |
| module.appointment.show_duration                       |                                                                                                                               |
| module.appointment.web_booking.block_time_by_confirmed | (Booking online)                                                                                                              |
| module.appointment.email_required                      |                                                                                                                               |

## Quick Redirect - Cash Drawer

Click sẽ mở Cash Drawer

## Scan

Scan 2 thông tin sau:

- Scan Barcode/QR code Giftcard: Check nhanh thông tin của Giftcard
- Scan Order QR code, click sẽ redirect đến Order History

## Search

- Customer: customer name, customer phone
- Order: order ID
  - Khi search sẽ show những data liên quan đến thông tin đang search, gồm 4 tab thông tin:
    - **All:** show tất cả thông tin của 3 tabs còn lại
    - **Appointment:** list appointment của customer phone, show all, gồm những field thông tin sau:
      - Date & time
      - Customer info: Name / 4 số cuối phone number
      - Service name / Staff nickname
      - Status
      - Click sẽ show appointment detail:
        - Date
        - Customer phone
        - Customer name
        - Service/Staff/Start Time/Duration
        - Add more Service/Staff
        - Appointment Notes
        - Ngoài ra, sẽ hiển thị thêm thông tin về Checkin/Order/Appointment của Customer đó, gồm:
          - Appointment: total appointment (status: Scheduled / Canceled / Confirmed / Done)
          - Spent: tổng số tiền đã dùng
          - Point: số điểm hiện tại
          - Visit: tổng số lần đến tiệm
          - Checkin tab: show list checkin đến thời điểm hiện tại của customer, gồm:
            - Checkin/checkout date: thời gian tạo order
            - Status: Pending/Completed
            - Point
          - Order tab: show list order đến thời điểm hiện tại của customer, gồm:
            - Order created at
            - Staff
            - Service
            - Total Amount
          - Appointment tab: show list appointment đến thời điểm hiện tại của customer, gồm:
            - Appointment Date
            - Staff
            - Service
            - Duration
            - Status
            - Tag (nếu có)
    - **Order:** show list order trùng với thông tin customer hoặc orderID trùng, gồm những thông tin sau:
      - Order ID
      - Date
      - Customer info: name/phone
      - Order staff nickname / Order service name
      - Order status
      - Click sẽ redirect đến Order History của order đó
    - **Customer:** gồm những thông tin sau:
      - Customer name
      - Customer phone
      - Points
      - Total visit
      - Customer group
      - Click Customer thì show customer info detail modal
    - Một số lưu ý:
    - Nếu không có data liên quan: show icon No data

## Software Update Notification

## Devices Status Summary

## Notifications

Gồm những notification type sau:

- **Appointment:**
  - **New appointment:** **status Scheduled**
    - Content được highlight xanh: \[Customer Name\] scheduled a new appointment with you on \[appointment date - time mm/dd/yyyy hh:mm AM/PM\].
    - Status: Scheduled
    - Tag: Requested / Highlight (nếu có)
    - Created At: thời gian book appointment success
  - **Appointment confirm: Status: Confirmed**
    - Content chữ đen: \[Customer Name\] appointment on \[appointment date - time mm/dd/yyyy hh:mm AM/PM\] has been confirmed.
    - Status: Confirmed
    - Tag: Requested / Highlight / No Show (nếu có)
    - Created At: thời gian confirmed appointment success
  - **Appointment Cancel:** Status: Canceled
    - Content được highlight đỏ: \[Customer Name\] appointment on \[appointment date - time mm/dd/yyyy hh:mm AM/PM\] is canceled.
    - Status: Canceled
    - Tag: Requested / Highlight / No Show (nếu có)
    - Created At: thời gian canceled appointment success
  - **Change appointment Info:** Date / Start Time / Staff / Service / Customer / Add Note / Add Tag của appointment - **đều gửi notify mới theo status hiện tại của appointment đó**
    - VD:  
      Appointment được book nhưng chưa Confirm (1) > sau đó Confimed (2) > sau đó change staff của appointment Confirmed (3)  
      Content của noti (3) sẽ là: **<tên Customer> appointment on 04/01/2026 04:59 PM has been Confirmed.**
  - Sort: Desc theo Created At
  - Click vào nottify sẽ mở modal:
    - Edit Appointment: với appointment Scheduled / Confirmed
    - Appointment Information: với appointment đã Canceled / Done
  - Button: View all Scheduled / View all Appointment (support xem những appointment chưa được confirm để ưu tiên process)
  - Một số lưu ý:
    - Appointment Done sẽ không có notify
    - Khi mở notify đã cũ thì vẫn phải show status hiện tại của appointment đó
- **System: (PENDING)**
  - Announcement từ Fastboy Portal

# Login

## Login information

Có 2 hướng login POS:

- Login via GAP
- Login with username/password

```
Flow cho máy không có serial number, login thẳng:
```

- Install app POS
- Máy tự động gen UUIDv7
- Team Support setup merchant dựa trên WhmcsID
- Đem UUIDv7 này lên page Management để gán vào account của 1 merchant cố định (action đem UUIDv7 này lên cloud onboard cho tiệm)
- Dùng user name/ password login vào app là done

```
Flow cho máy không có serial number, login qua GAP:
```

- Login GAP bằng account của merchant
  - Nếu máy đã setup UUID gắn với merchant đúng với GAP > vào thẳng, không yêu cầu login
  - Nếu máy đã setup UUID gắn với merchant khác GAP > chặn, không vào được app POS
  - Nếu máy chưa setup UUID gắn với merchant (UUID đang free trên cloud) > link UUID free đó với account GAP của merchant
- Click vào icon app Volt POS > vào thẳng, không yêu cầu login lại

Note:

- UUID thuộc merchant nào, thì chỉ có merchant đó login vào mới dùng được
  - EX: UUID1 - WhmcsID 3 > Login bằng WhmcsID 4 > Block
- Một tiệm có 10 máy thì chỉ login bằng 1 account chạy theo merchant ID (WhmcsID)
- Cần đăng nhập được 1 lần đầu khi có mạng, để cloud có thể verify được, sau đó mới sử dụng được sau khi tắt mạng.

```
Page management để quản lý merchant
```

[https://insight2020.gci.fast-boy.net/](https://insight2020.gci.fast-boy.net/)

- Sử dụng page Insight của DTS, để setup tiệm (tạo merchant / setup device / …), để dùng tạm trước khi có site portal.
- Define thông tin page (WAITING)

Tham khảo UI như bên dưới:

- GAP_Login with ID/Username/Password

# Home screen

## Staff list

- Staff list detail:
  - Show list staff theo thứ tự alphabet (của mỗi group) và staff có status Active
  - Mỗi field staff show:
    - Staff nickname - Staff avatar
    - Next appt - thời gian của appointment gần nhất trong ngày **(PENDING)**
    - Total số lượng booking hiện tại trong ngày của staff chưa được checkout **(PENDING)**
  - Click avatar: show Staff Information
  - Click số: show appointment list của staff **(PENDING)**
- Search staff: search staff Nickname

## Group Staff

- Show list Group Staff status Active và theo thứ tự alphabet từ trái qua phải
- Tab đầu tiên là All, show tất cả staff của tiệm rồi mới đến Group Staff

## Service List

Gồm 2 fiels: Category và Service

- **Category**:
  - Show list Category Active
  - Quick Pay là option đầu tiên, sau đó là list Category theo thứ tự alphabet
    - Quick pay: option nhập nhanh service + amount để add vào order khi không có sẵn service đó trong hệ thống. Service khi được add từ Quick Pay chỉ được dùng cho order hiện tại, sẽ không được lưu vào hệ thống. Click Quick Pay sẽ show dialog, gồm:
      - Title: Quick Pay
      - Custom Amount: Maximum $9,999,999.99 (validation required).
      - Service Name (validation required).
      - Add note (optional)
      - Button:
        - Add: chỉ được enable sau khi input đủ thông tin required
        - (X)
      - Note: Quick Pay không apply item discount, chỉ được apply order discount
      - Bàn phím ảo để nhập data
  - Card Category gồm:
    - Category Name
    - Category color
    - Tổng số lượng service (Active) thuộc category
  - Click vào Category nào thì sẽ show list Service - Active thuộc Category đó
- **Service**:
  - Click vào Category nào sẽ show list service của category đó, theo thứ tự alphabet
  - Default là list service thuộc category đầu tiên
  - Card service gồm những thông tin:
    - Service Name
    - Service Description: chỉ show 25 character đầu tiên, còn lại show …
    - Service Color (giống màu Category)
    - Service Price
- Search Service: search service name, trả về kết quả Category tương ứng với service được search

## Enter Customer Phone

- Gồm 3 fields:
  - Field nhập số phone customer
  - Checkin Today
  - Appointment Today
- Enter Customer Phone: show bàn phím số và Phone format: (xxx) xxx xxxx
  - **New Customer:**
    - Sau khi nhập xong số phone valid, sẽ enable button Done
    - Click Done, show dialog để add new customer:
      - Phone (show lại số phone đã nhập trước đó)
      - Customer Name (Optional) - Nếu không nhập tên thì Unknownxxxx (4 last digits phone) > Không được để trống
      - Group: ex - New
        - Default lấy option đầu tiên, nếu đã được tạo trước đó
        - Những group khác sẽ được Add new ngay tại vị trí chọn Group (tương tự như (Group Staff)
        - Được chọn nhiều Group cho 1 customer
      - Button:
        - Save / (X)
        - View More
          - Click View More sẽ show dialog Customer Information, gồm những thông tin như bên dưới và có thể update được:
            - Customer Phone (Locked)
            - Customer Name
            - Customer Group
            - Customer Email
            - Customer Birthday
            - Note
            - **Total Spent:** total amount của tất cả những order đã complete
              - _Total amount của order \[(Successful - Unsettle) + (Successful - Settle)\]_
              - _Không tính order Refund / Partial Refund / Cancel_
            - **Average Spent:** Trung bình 1 order bao nhiêu
              - _\[Total Spent\] : \[Total Visit\]_
            - **Total Visit:** Tổng số order complete bao gồm những status:
              - Successful – Unsettle, Successful – Settle, Refund và Partial Refund
            - **Highest Single Transaction:** Order status _Successful_ - Unsettle hoặc _Successful_ - Settle có total amount cao nhất là bao nhiêu
            - **Total Discount:** Tổng số tiền discount trên tất cả những order _Successful_
              - Không tính order Refund / Partial Refund / Cancel
            - **Point Balance:** Tổng điểm đang có
            - **Total Tip:** Tổng số tiền Tip trên tất cả những order complete (_Successfull_ - Unsettle/_Successfull_ - Settle/Partial Refund)
              - Không tính order Refund / Cancel
            - **Promotion & Reward:** số lượng promo và reward đang available của customer này
            - Appointment **(PENDING)**
            - Oder: show list order của cuattomer, gồm những thông tin sau:
              - Order Date & Time: Thời gian complete order
              - Total
              - Tip
              - Status
            - Button: Save / (X)
  - **Exist Customer**: show list customer đã lưu để search theo số phone đang input **(PENDING)**
    - List exist customer:
      - Customer Phone Number
      - Customer Name
    - Chọn exits customer sau đó click Done sẽ show Customer này trong form create order

Note:

- Sau khi chọn customer từ danh sách, nếu customer đó có tồn tại Customer Note được save trong Customer Information thì sẽ show ra popup:
- Nếu không có customer note thì không show popup
- Sau khi chọn Done để confirm Customer Note thì click Done để show thông tin Customer cho order:
- Nếu không có Customer, chọn option Skip tại field Enter Phone Number, show Customer - Unknown
- Khi nhập số phone bị trùng lặp trong hệ thống, màn hình hiển thị danh sách Customer. Nếu không chọn Customer và nhấn button Done, hệ thống tự động chọn số phone đầu tiên trong danh sách Customer -> Tiếp tục luồng tạo Order bình thường

## Checkin Today

**Check-in Today** dùng để: Quản lý toàn bộ khách hàng đã check-in (walk-in) trong ngày hiện tại. Sau khi thực hiện Checkin xong, sẽ dựa trên thông tin đó để create order với status Processing.

**>> Khi khách đã có mặt tại tiệm và sẵn sàng chờ hoặc làm dịch vụ.**

Cụ thể là:

- Khách **đã bước vào tiệm**
- Đã **xác nhận đúng tên / số điện thoại trên app GoCheckin**

**(UI chỉ tham khảo, hiển thị đúng theo requirement)**

### **1. Những đối tượng xuất hiện trong Check-in Today**

- Khách **walk-in** (không appointment), thực hiện checkin trực tiếp khi đến tiệm

### **2. Thông tin hiển thị trên mỗi khách check-in**

- Customer Name
- Phone number (rút gọn)
- Check-in time: thời gian thực hiện checkin
- Countdown time: so sánh vơi thời gian hiện tại và thời gian Checkin:
  - 5 mins ago / 45 mins ago
  - Sau 1 tiếng thì show: Checked in 2:00PM
- Tag: Walk-in
- Staff: staff nickname, nếu nhiều staff thì show \[Staff: Staff 01, Staff 02, …\]
- Status:
  - Pending (Checked In, đã check in thành công và order chưa được thanh toán)
  - Completed (Checked Out, order đã được thanh toán thành công, order status Successful)
- Sort: asc theo thời gian checkin
  - Filter status: Default All
  - All
  - Pending
  - Completed
- Show/Hide option: default Hide, muốn xem thì chọn action Show để expend list checkin
- Count: đếm tổng số lượng Checkin của ngày hôm nay, của tất cả status. Nếu filter theo status thì count lại theo đúng status.

**Lưu ý:**

- Click vào Checkin record thì redirect đến:
  - Order processing nếu order chưa complete
  - Order History detail nếu order đã complete

### 3\. Một số lưu ý:

- Status của checkin record trong tab Checkin của Customer Information:
  - Pending (Checked In, đã check in thành công và order chưa được thanh toán)
  - Completed (Checked Out, order đã được thanh toán thành công, order status Successful)
- Ngoài ra, nếu customer đã book appointment, sau đó complete luôn order từ appointment đó > sinh ra record Check In - Completed trong tab Check In

## Appointment Today

**Appointment Today** dùng để: Quản lý toàn bộ các cuộc hẹn (appointments) diễn ra trong ngày hôm nay, bất kể khách đã đến hay chưa.

**(UI chỉ tham khảo, hiển thị đúng theo requirement)**

### **1. Đối tượng xuất hiện trong Appointment Today**

Bao gồm:

- Appointment có **date = hôm nay**
- Appointment tạo từ:
  - Online booking
  - POS
- Appointment status:
  - Scheduled
  - Confirmed
  - Cancelled
  - Done

Không bao gồm:

- Appointment của ngày khác
- Walk-in chưa tạo appointment

### **2. Thông tin hiển thị trên mỗi Appointment**

- Appointment Time (Start time)
- Thông tin khách hàng:
  - Customer Name
  - Phone number
- Staff: staff nickname, nếu nhiều staff thì show: \[Staff: Staff 01, Staff 02, …\]
- Status:
  - Scheduled
  - Confirmed
  - Cancelled
  - Done
- Tag: nếu có thì show, k có thì k show, chỉ là dấu hiệu nhận biết trong appointment, không ảnh hưởng đến logic.
  - Requested (Khách gửi yêu cầu đặt lịch nhưng chưa được tiệm xác nhận)
  - Highlight (Appointment được đánh dấu nổi bật để dễ nhận biết)
  - No Show (Khách không đến và không thông báo)
- Sort: asc theo thời start time của appointment
- Filter status: default All
  - All
  - Scheduled
  - Confirmed
  - Cancelled
  - Done
- Show/Hide option: default Hide, muốn xem thì chọn action Show để expend list checkin
- Count: đếm tổng số lượng Appointment của ngày hôm nay, của tất cả status. Nếu filter theo status thì count lại theo đúng status.
- Click vào Appointment record, thì show:
  - Nếu appointment chưa checkout, thì show appointment detail
  - Nếu appointment đã checkout thì show order detail

# Create Order

## Create order

Sau khi có Customer:

- **Order ID**: Order #1, generate order theo số thứ tự từ 1
- Action: Delete order
  - Click sẽ delete order hiện tại và show lại field Enter Phone Number
- **Field Customer info:**
  - Customer Name
  - Customer Group: show max 3 group label, còn lại vào Customer Information để xem
  - Phone Number
  - Point/Visit **(PENDING)**
  - Action:
    - Update: click sẽ mở dialog Customer Information, cho phép update:
      - Customer Name
      - Customer Group
      - Customer Email
      - Customer Birthday
      - Note
    - Delete: delete Customer khỏi order, show option Enter Phone Number để chọn lại Customer mới, hoặc Skip nếu không muốn để lại thông tin Customer
- **Field show staff/service:**
  - Khi chưa chọn staff/service show place holder: _Add Staffs and Services_
  - Nếu user click chọn Service trước khi chọn Staff thì hiển thị popup Select Staff First:
- Chọn Staff trước, show place holder: _Choose Services_
- Sau khi chọn đầy đủ Staff và service của staff, thông tin sẽ show trong cart như sau:
  - Staff: Staff Nickname
    - Action: Update / Delete
  - Service list:
    - Service name / Service note (nếu có)
    - Price:
      - Nếu có edit price thì show chính xác số tiền sau khi được edit
      - Nếu có apply Item Discount, thì show như hình sau: giá gốc - apply discount % or $ và ghi số tiền discount chính xác

Đối với những case trên, thì sẽ show trong receipt như sau:

- Edit price: show trực tiếp giá cuối cùng, sau khi edit
- Apply Item Discount: show giá gốc, phần số tiền discount hiển thị ở mục Item Discount
- Action: Update / Delete
- Option: chọn thêm service cho staff với place holder _Choose more Services_
- Staff action detail:
  - Update: Chọn staff khác trong list staff bên trái
  - Delete: Xoá tất cả staff và service thuộc staff đó trong order
  - Service action detail:
    - Click vào service sẽ show update 3 thông tin:
      - Price: cho update lại giá mới của tất cả service
        - Giá mới chỉ apply cho order hiện tại
        - Cho update về $0, chặn số tiền âm
        - Show thẳng new price cho service
      - Note: (optional) cho add thêm note cho service
        - Max 50 character
        - Show dưới name service
      - Apply Discount: toggle Yes/No
        - No: không show thêm gì
        - Yes: show 2 option % và $
          - %: min 1%, max 100%
          - $: nhỏ hơn hoặc bằng Price của service
        - Show số tiền trước và sau apply Discount
      - Button: Save / (X)
      - Virtual keyboard
    - **Note**:
      - Khi điều chỉnh giá của service, sẽ cho tăng/giảm price của service
      - Nếu bấm chọn lại service đó thì phải theo giá đã set up trước đó, nếu có apply discount thì sẽ apply cho giá đã setup trước đó
      - Còn apply Discount thì chỉ có giảm giá service

**Flow create Order**:

## Cart Order

- Promo: click sẽ show dialog Add Promo, gồm:
  - List Promo được tạo từ hệ thống **(PENDING)**
  - Custom: tạo promotion cho order hiện tại, gồm 2 option:
    - %: min 0,1%, max 100%
    - $: nhỏ hơn hoặc bằng Price chưa apply Reward và Tax
- Reward **(PENDING)**
- Note: thêm note cho order, max 50 characters
- Summary order:
  - Subtotal: tổng price service chưa bao gồm discount
  - Item Discount: tổng số tiền được discount trên từng item (service)
  - Promotion: tổng số tiền được apply promotion dựa trên Price đã apply Item Discount
  - Reward Redemption **(PENDING)**
  - Tax **(PENDING)**
  - Total: số tiền khách thực trả sau khi đã apply Item Discount/Promotion/Reward/Tax
- Button:
  - Print: click để in trước receipt order order, không bao gồm Payment Method
  - Pay: click pay để checkout order

```
Update 25/08/2025
```

- **Summary order:**
  - Subtotal: tổng price service chưa bao gồm discount
  - Item Discount: tổng số tiền được discount trên từng item (service)
  - Promotion: tổng số tiền được apply promotion dựa trên Price đã apply Item Discount
  - Reward Redemption (PENDING)
  - Tax (PENDING)
  - Tip
  - Total: số tiền khách thực trả sau khi đã apply Item Discount/Promotion/Reward/Tax
- **Button actions:**
  - Promo & Rewards (PENDING)
  - Tip
  - Print (click để in trước receipt order order, không bao gồm Payment Method)
  - Order Note
  - Split
- **Choose payment method**
  - Card
  - Cash
  - Gift Card
  - Other

**Payment Flow (Per Check)**

- Show check amount + item list
- Select payment method
- Input tip (before or after payment request)
- Process payment
- Print check receipt (optional)

## Check-out Order

### Check-out flow

[https://app.diagrams.net/#G1nBFyGfho_VrHfH530bVgdBxH4aQ1dy0f#%7B%22pageId%22%3A%22wBCLhKNKL97IqZbfEJKO%22%7D](https://app.diagrams.net/#G1nBFyGfho_VrHfH530bVgdBxH4aQ1dy0f#%7B%22pageId%22%3A%22wBCLhKNKL97IqZbfEJKO%22%7D)

[https://app.diagrams.net/#G1nBFyGfho_VrHfH530bVgdBxH4aQ1dy0f#%7B%22pageId%22%3A%22wBCLhKNKL97IqZbfEJKO%22%7D](https://app.diagrams.net/#G1nBFyGfho_VrHfH530bVgdBxH4aQ1dy0f#%7B%22pageId%22%3A%22wBCLhKNKL97IqZbfEJKO%22%7D)

- Gồm 3 fields:
  - List payment method:
    - Card / Cash / Gift Card / Other
    - Show rõ số tiền cần thanh toán của mỗi method trên UI
    - Thanh toán bằng tất cả các method đều apply Service Fee
    - Riêng khi thanh toán bằng 2 method Cash và Gift Card thì được apply Cash Discount
  - Enter Amount: bàn phím số để nhập số tiền
    - Summary:
      - Total Paid
  - Order Receipt: template (như hình)
  - Action:
    - Cash Drawer **(PENDING)**
    - Print: in receipt ở thời điểm hiện tại, để customer review, nên chỉ bao gồm staff - service - order summary
    - Tip: click vào sẽ mở dialog phía Customer nhập Tip (Chỉ cho phép add Tip khi có Staff trong order)
- Complete Payment: click để done process và show screen Payment Successful! với 4 options
  - No Receipt: không in receipt
  - Print: in receipt
  - SMS (Text Message): gửi receipt đến số phone customer **(PENDING)**
  - Email: gửi receipt đến email customer **(PENDING)**

### **Pay By Cash**

Gồm những field thông tin sau:

- Enter Amount: bàn phím số để nhập số tiền, amount này là số tiền mặt khách đưa cho thu ngân
  - Quick amount: $100 / $50 / $20 / $10
- Summary:
  - Total Paid: số tiền đã thanh toán trước đó (nếu có)
  - Change: Tiền thối lại, khi nhập Amount > Total Order
  - Remaining: Số tiền còn lại cần phải thanh toán
- Order Receipt: template (như hình)
- Action:
  - Cash Drawer
  - Print: In trước hóa đơn chưa thanh toán để customer xem trước, in tương tự hình ảnh trên giai diện và không bao gồm payment method
  - Tip: click vào sẽ mở dialog nhập Tip **(Waiting Design)**
  - Pay hoặc Complete Payment
    - Pay: Khi chưa nhập Amount hoặc đã nhập Amount nhưng Remaining > 0
    - Complete Payment: Khi đã nhập Amount lớn hơn hoặc bằng Total Order (Remaining = 0)

Sau khi nhập amount, click Pay/Complete Payment:

Sau khi thanh toán thành công sẽ show chi tiết nội dung gồm:

- Cash (Received $0.00 - Change $0.00) --— $0.00 (Total Order)

**Note**:

- Nếu nhập Amount > Total Order, thì mới hiển thị field **Change**
- Chỉ có thanh toán bằng Cash mới show **Quick amount** để chọn nhanh
- Có thể thanh toán nhiều lần đến khi nào **Complete Order**
- Một lần partial pay sẽ tạo ra 1 payment
- Thường thì những payment Cash sẽ không add Tip, vì khách đã đưa trực tiếp cho Staff. Nhưng vẫn có tiệm muốn note lại cuối ngày mới trả cho Staff thì vẫn ghi nhận payment Cash có Tip như bình thường

**Special case:** khi reopen order, void 1 payment card và charge lại 1 payemnt cash khác, thì apply Cash Discount ntn

- Ví dụ total order là $100
  - Card: $50 => charge $50 + $3 (3% cash discount )
  - Cash: $50
  - Total charge = $103
- Sau đó edit order, Void payment cash:
  - Card $50 => charge $50 + $3 (3% cash discount )
  - Card (thay cash trước đó) $50 => charge $50 + $3 (3% cash discount )
  - Total charge là $106

### Dual Screen - Pay By Cash

| Action                            | Reception                                                                                                                                                                                                                                                                                                                                                | Customer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POS home screen**               |                                                                                                                                                                                                                                                                                                                                                          | Show Welcome Screen gồm: Description: WELCOME TO \[MERCHANT NAME\]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Customer phone_Exist customer** | Reception: sau khi nhập/select xong sẽ show Customer Note (nếu có), note này chỉ xem, không update tại vị trí này, nếu muốn update thì vào Customer Info để update Update số phone customer vừa nhập và số đó đã tồn tại Show popup: Check-in Successfull                                                                                                | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Số phone vừa được reception nhập, verify có đã đúng số của mình hay chưa? + Nếu đúng, click: YES > show màn hình check-in thành công + Nếu chưa, click: No, enter again > show màn hình enter phone number để customer nhập lại và được cập nhật lại vào phần Customer trên order phía reception > Done sẽ show màn hình Check-in thành công Screen check-in thành công: show một số thông tin - Visit: số order success với số phone customer đó - Points (PENDING) - Reward (PENDING) - Promotion (PENDING) |
| **Customer phone_New customer**   | Reception: nhập số phone Sau khi có số phone chính xác, phía reception: - Input Name / Group và click Save - Click View More để đi đến Customer Info nhập thêm thông tin của Customer và Save                                                                                                                                                            | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Số phone vừa được reception nhập, verify có đã đúng số của mình hay chưa? + Nếu đúng, click: YES + Nếu chưa, click: No, enter again > show màn hình enter phone number để customer nhập lại và được cập nhật lại vào phần Customer trên order phía reception > Done Screen check-in thành công: show một số thông tin: - Title: Check-in Successfull - Phone number - Visit: số order success với số phone customer đó - Your curent points (PENDING) - Redeem your posints for (PENDING)                     |
| **Customer phone_No customer**    | Luôn luôn show màn hình nhập số phone và để trống                                                                                                                                                                                                                                                                                                        | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Enter customer phone: luôn luôn show màn hình nhập số phone                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Add Staff/Service**             | Chọn staff/service                                                                                                                                                                                                                                                                                                                                       | Show staff/service và price tương ứng ở Order Detail Lưu ý: chỉ show Service name, không show Service Note (service note chỉ show trong order receipt) Update real-time cho order summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Pay order**                     | Click Pay order Chọn hình thức thanh toán Cash Enter Amount Click TIP > Show màn hình waiting Show màn hình waiting Cập nhật Amount + TIP, sẵn sáng để thanh toán Click PAY or Complete Payment Done - show payment successful screen, gồm: - Tip total: nếu có nhiều hơn 1 staff - Payment method - 4 action: No Receipt / Print / Text Message / Email | Show same above Show same above Show same above Customer: show 2 section - Add a tip: 4 options quick tip / No Tip / Custom Tip (Tip bases on charge amount) - Add signature Input tip (Tip bases on charge amount) Click Continue Show màn hình thanh toán với số tiền bao gồm Amount + Tip Payment success screen Done - show order complete screen với 4 action: No Receipt / Print / Text Message / Email                                                                                                                                                                                                                                                                                                                       |

### Pay By Card

Gồm những field thông tin sau:

- Enter Amount: bàn phím số để nhập số tiền sẽ thanh toán
- Summary:
  - Total Paid: số tiền đã thanh toán trước đó (nếu có)
  - Remaining: Số tiền còn lại cần phải thanh toán
- Order Receipt: template (như hình)
- Action:
  - Cash Drawer
  - Print: In trước hóa đơn chưa thanh toán để customer xem trước, in tương tự hình ảnh trên giai diện và không bao gồm payment method
  - Tip: click vào sẽ mở dialog nhập Tip **(Waiting Design)**
  - Pay hoặc Complete Payment
    - Pay: Khi chưa nhập Amount hoặc đã nhập Amount nhưng Remaining > 0
      - Thực hiện thanh toán nhiều lần
      - Sau khi nhập Amount đang nhỏ hơn Total Order, show button Pay, lúc này receiption sẽ click action Tip để customer add tip từ dual screen.
      - Customer nhập Tip xong, sẽ cập nhật lại số tiền khách sẽ thanh toán
      - Sau khi đã thanh toán tahnfh công sẽ hiển thị dialog confirm payment như hình:
      - Click **Continue Payment** để tiến hành thanh toán tiếp Remaining. UI sẽ hiển thị thêm 1 field thông tin Payment method đã được thực hiện trước đó
      - Tiếp tục thực hiện thanh toán cho đến khi Complete Payment
    - Complete Payment: Khi đã nhập Amount bằng Total Order (Remaining = 0)
  - **Note**:
    - Có thể thanh toán nhiều lần đến khi nào **Complete Order**
    - Một lần partial pay sẽ tạo ra 1 payment

### Dual Screen - Pay By Gift Card

Gồm 2 mode: được setting trong Setting page

- Entered by Reception (Add Signature before Payment)
- Entered by Customer (Add Signature after Payment)

1. **Entered by Reception (Add Signature before Payment)**

| Action                            | Reception                                                                                                                                                                                                                                                                                                                                                                          | Customer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POS home screen**               |                                                                                                                                                                                                                                                                                                                                                                                    | Show Welcome Screen gồm: Description: WELCOME TO \[MERCHANT NAME\]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Customer phone_Exist customer** | Reception: sau khi nhập/select xong sẽ show Customer Note (nếu có), note này chỉ xem, không update tại vị trí này, nếu muốn update thì vào Customer Info để update Show popup: Check-in Successfull phía reception                                                                                                                                                                 | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Số phone vừa được reception nhập, verify có đã đúng số của mình hay chưa? + Nếu đúng, click: YES > show màn hình check-in thành công + Nếu chưa, click: No, enter again > show màn hình enter phone number để customer nhập lại và được cập nhật lại vào phần Customer trên order phía reception > Done sẽ show màn hình Check-in thành công Screen check-in thành công: show một số thông tin - Visit: số order success với số phone customer đó - Points (PENDING) - Reward (PENDING) - Promotion (PENDING) |
| **Customer phone_New customer**   | Reception: nhập số phone Sau khi có số phone chính xác, phía reception: - Input Name / Group và click Save - Click View More để đi đến Customer Info nhập thêm thông tin của Customer và Save                                                                                                                                                                                      | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Số phone vừa được reception nhập, verify có đã đúng số của mình hay chưa? + Nếu đúng, click: YES + Nếu chưa, click: No, enter again > show màn hình enter phone number để customer nhập lại và được cập nhật lại vào phần Customer trên order phía reception > Done Screen check-in thành công: show một số thông tin: - Title: Check-in Successfull - Phone number - Visit: số order success với số phone customer đó - Your curent points (PENDING) - Redeem your posints for (PENDING)                     |
| **Customer phone_No customer**    | Luôn luôn show màn hình nhập số phone và để trống                                                                                                                                                                                                                                                                                                                                  | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Enter customer phone: luôn luôn show màn hình nhập số phone                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Add Staff/Service**             | Chọn staff/service                                                                                                                                                                                                                                                                                                                                                                 | Show staff/service và price tương ứng ở Order Detail Lưu ý: chỉ show Service name, không show Service Note (service note chỉ show trong order receipt) Update real-time cho order summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Pay order**                     | Click Pay order Chọn hình thức thanh toán Card Enter Amount Click TIP > Show màn hình waiting Show màn hình waiting Cập nhật Amount + TIP, sẵn sáng để thanh toán Show screen waiting payment Show screen waiting payment Done - show payment successful screen, gồm: - Tip total: nếu có nhiều hơn 1 staff - Payment method - 4 action: No Receipt / Print / Text Message / Email | Show same above Show same above Show same above Customer: show 2 section - Add a tip: 4 options quick tip / No Tip / Custom Tip (Tip bases on charge amount) - Add signature Input tip (Tip bases on charge amount) Add signature Click Continue Show màn hình present card với số tiền bao gồm Amount + Tip Tap/Insert/Swipe card > payment processing Payment success screen Done - show order complete screen với 4 action: No Receipt / Print / Text Message / Email                                                                                                                                                                                                                                                            |

2. **Entered by Customer (Add Signature after Payment)**

| Action                            | Reception                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Customer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POS home screen**               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Show Welcome Screen gồm: Description: WELCOME TO \[MERCHANT NAME\]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Customer phone_Exist customer** | Không nhập customer phone mà chọn 1 staff để start flow Update số phone customer vừa nhập và số đó đã tồn tại Show popup: Check-in Successfull                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Enter Phone Number: nhập số phone và click Done Screen check-in thành công: show một số thông tin - Visit: số order success với số phone customer đó - Points (PENDING) - Reward (PENDING) - Promotion (PENDING)                                                                                                                                                                                                                                                                                                         |
| **Customer phone_New customer**   | Không nhập customer phone mà chọn 1 staff để start flow Sau khi có số phone chính xác, phía reception: - Input Name / Group và click Save - Click View More để đi đến Customer Info nhập thêm thông tin của Customer và Save                                                                                                                                                                                                                                                                                                                                                                                                 | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Enter Phone Number: nhập số phone và click Done Screen check-in thành công: show một số thông tin: - Title: Check-in Successfull - Phone number - Visit: số order success với số phone customer đó - Your curent points (PENDING) - Redeem your posints for (PENDING)                                                                                                                                                                                                                                                    |
| **Customer phone_No customer**    | Luôn luôn show màn hình nhập số phone và để trống                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Customer: show 2 sections - Order detail: + Những field thông tin luôn mặc định show của order summary + Khi reception chọn Staff/Service thì sẽ update real-time vào phần order detail và update cho order summary - Enter customer phone: luôn luôn show màn hình nhập số phone                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Add Staff/Service**             | Chọn staff/service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Show staff/service và price tương ứng ở Order Detail Lưu ý: chỉ show Service name, không show Service Note (service note chỉ show trong order receipt) Update real-time cho order summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Pay order**                     | Click Pay order Chọn hình thức thanh toán Card Enter Amount Click TIP > Show màn hình waiting Show màn hình waiting Cập nhật Amount + TIP, sẵn sáng để thanh toán Show screen waiting payment Payment failed: show popup Payment Failed và button Try Again 1. Click Try Again 2. Click X hoặc hay click ngoài màn hình thì quay về screen input amount bên ngoài Payment success: Vẫn show screen waiting payment Payment success: Vẫn show screen waiting payment Done - show payment successful screen, gồm: - Tip total: nếu có nhiều hơn 1 staff - Payment method - 4 action: No Receipt / Print / Text Message / Email | Show same above Show same above Show same above Show Add a tip screen với 3 options: - Quick tip: 4 options - No Tip - Custom Tip (Tip bases on charge amount) Input tip (Tip bases on charge amount) Click Continue Show màn hình present card với số tiền bao gồm Amount + Tip Tap/Insert/Swipe card > payment processing Show Payment Failed screen 1. Show màn hình present card với số tiền bao gồm Amount + Tip 2. Show màn hình gần nhất trước đó gồm: - Order detail - Enter Customer Phone / Check-in success Sau khi present card thành công thì sẽ show 2 sections: - Payment successfull - Add Signature Add signature và click Continue Done - show order complete screen với 4 action: No Receipt / Print / Text Message / Email |

### Pay by Gift Card

1/ Không support Refund cho GiftCard method trong phase này, để chủ tiệm check bằng tay và restore balance trên GiftCard Management (CRM)

2/ Cancel (Void) order dùng GiftCard method: tự động hoàn lại balance đã thanh toán trước đó vào GiftCard

### Dual Screen - Pay By Gift Card

### Pay by Other

- “Other” là một payment type linh hoạt, cho phép tiệm tự định nghĩa hoặc xử lý các hình thức thanh toán đặc biệt khác Cash/Card/Gift card.
- “Other” không liên kết trực tiếp với cổng thanh toán (gateway), mà chỉ được ghi nhận nội bộ trong POS.
- Cho phép ghi nhận TIP bằng hình thức Other.
- **Refund / Cancel** của “Other” cũng phải thực hiện thủ công tương tự Cash.
- Khi chọn hình thức thanh toán Other: cần nhập số tiền cần thanh toán + Input payment method name (Optional)
- Tham khảo UI:

### Dual Screen - Pay By Other

### Split Tip

- Được click action Split Tip ở 2 vị trí:
  - Order success: reception screen
  - Order detail tại Order History với status: Successful - Unsettled
- Nếu order chỉ có 1 staff thì ẩn action Split Tip
- Sau khi Complete Payment, nếu order có Tip và có hơn 1 staff, sẽ hiển thị action Split Tip
- Gồm 3 option:
  - **Split Evenly:** Default ban đầu
    - Chia đều cho tất cả staff trong order
    - Special case: order 3 staff, khách tip $10. Thì chia 3 thì 2ng trên là là 3.4 còn người cuối cùng sẽ chịu thiệt một xíu là 3.2.
  - **Proportion:**
    - Chia theo phần trăm tổng số tiền thợ làm/total order
    - Vd: Total service của Anna là $60, Hannah là $40. Total order là $100, Total tip là $20. => Anna tip = (60/100) \* 20 = $12 => Hannah tip = (40/100) \* 20 = $8
  - **Manual:**
    - Nhập tip riêng cho từng staff, phải dựa trên total Tip

### Split Order

Flow chart: [POS Split Order](https://drive.google.com/file/d/1-mMNkzAoY-R_Mgq_B2aTRe62XFscPJLb/view)

Split Methods

1. **Split Equally**

- User choose number of checks (e.g., 2, 3...), default is 2
- The system divides the total amount evenly.
- If the total doesn't divide evenly, rounding is applied. Final check adjusts the difference.
- Logic:
  - **User Action:** Enter the number of checks (N ≥ 2).
  - **System Behavior:**
    - Divide order total evenly among checks.
    - Apply rounding to 2 decimal places.
    - Last check adjusts to cover any rounding difference.
  - **Example:** Order total $100, N=3 → $33.33, $33.33, $33.34.

2. **Split by Amount**

- The user manually inputs how much each check will pay.
- System validates that the total of all checks = 100% of order total.
- Login:
  - **User Action:** Select number of checks (N ≥ 2).
  - **System Behavior:**
    - Checks **1 to (N-1)**: User manually enters amount.
    - Check **N**: System auto calculates as:
  - **Validation Rules:**
    - No check amount ≤ 0.
    - Sum of (N-1) entered amounts < Order Total.
    - Final total must match Order Total.
    - Auto-adjust ± $0.01 as “Adjustment” line if needed for rounding.
  - **Example:** Order $100, N=3
    - Check 1 = $30, Check 2 = $50, Check 3 = auto → $20 -> OK
    - If Check 1 = $50, Check 2 = $60 → Auto = -$10  -> WRONG

3. **Split by Items**

- The user manually assigns items to checks.
- The system calculates each check’s total based on assigned items.
- Logic:
  - **User Action:** Assign specific items to each check.
  - **System Behavior:**
    - Calculate check total based on assigned items.
    - Each item can only belong to one check.

### **Order History**

### Order workflow

- Status: (Định nghĩa)

| Status                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Note                                                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pending**                         | Order not yet checked out or reopened for editing. Not shown in Order History.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Not close order yet                                                                                                                                                                                                                                             |
| **Successful - Unsettled**          | Order is closed but payment(s) not yet settled. Still editable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Order has been closed but unsettled                                                                                                                                                                                                                             |
| **Successful - Settled (Captured)** | The order was checked out and closed. No changes allowed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Order has been closed and settled \* Đối với những hình thức thanh toán khác Card, qua ngày mới theo merchant timezone sẽ chuyển sang Settled \* Nếu trong 1 order có 2 method Card và Cash thì sẽ chuyển cả order sang Settled theo thời gian của payment Card |
| **Canceled**                        | Order was canceled or all payments were voided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | All payments have been settled.                                                                                                                                                                                                                                 |
| **Refunded**                        | All payments in the order have been refunded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | All payments have been settled.                                                                                                                                                                                                                                 |
| **Partial Refunded**                | One or more payments refunded, but not all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | All payments have been settled.                                                                                                                                                                                                                                 |
| **(Action) Re-Open Order**          | Khi order có nhiều payment method và customer muốn Void 1 phần của order hoặc vì lý do: - Charge nhầm tiền, re-open để charge lại - Charge dư của khách, nên sẽ phải Void ngược lại cho khách                                                                                                                                                                                                                                                                                                                                                                           | Sau khi bị Void đi 1 phần amount rồi, thì sẽ tồn tại remaining > 0, nên phải update lại Service/Price or Delete service đi để remaining = 0 và Complete Order - Status order quay về Successful- Unsettled                                                      |
| **Refund Issue**                    | Khi refund order với 2 transactions, trong đó có 1 cái thành công và 1 cái thất bại thì status của order lúc này sẽ là **Refund Issue** - Đối với những method khác Card chắc chắn k có case fail. - Nhưng transaction fail đó là của Card thì khác, vì bên Magensa gateway không có cơ chế refund lại được payment đã refund fail trước đó. Nếu refund fail là payment đó có status cuối cùng là FAILED luôn. - Cũng k để order status là Partial Refund được, vì partial refund thì vẫn sẽ refund tiếp được - Note: Order History phải có hỗ trợ status Refund Issue. | * Chỉ xảy ra đối với payment method Card \* Khi nào bên phía Fastboy Portal retry lại payment Refund Failed đó thành Refunded > thì order sẽ update status lại từ **Refund Issue > Refunded**                                                                   |
| **Cancel Issue**                    | Tương tự với case Refund ở trên, khi thực hiện Cancel Order có nhiều payment, có 1 payment bị Cancel Fail (payment status -FAILED), thì lúc này cả Order được mark là **Cancel Issue** - Case Cancel (Void) fail hiếm xảy ra, nhưng nếu có, thì bên anh Fastboy Portal k retry case này, mà bắt buộc phía con người phải click Cancel lại lần nữa cho payment bị cancel fail đó                                                                                                                                                                                         |                                                                                                                                                                                                                                                                 |
| **Re-open**                         | * Khi bấm vào Re-open order thì update lại status "re-open". \* Chỉnh sửa, thanh toán xong thì nhấn Re-open done để chuyển về status trước đó. \* Tại Page Order History: thì order đang ở trạng thái re-open thì nút Re-open chuyển thành Continue Re-open                                                                                                                                                                                                                                                                                                             |                                                                                                                                                                                                                                                                 |

- Action theo status:

| Status / Action            | Receipt                                  | Cancel Order                                                              | Re-Open Order                                                                                                             | Continue Re-open                                                                                                                                | Refund                                                                           | Partial Refund                                                                                                        | Split Tip | Adjust Tip                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Successful - Unsettled** | Yes - Allow viewing and printing receipt | Yes - Voids all payments - Changes status to Canceled - Marked Gray in UI | Yes - Allows voiding one or more payments - Allows changing or re-applying payment - Allows editing items (Service/Staff) | No - Hide action                                                                                                                                | No                                                                               | No                                                                                                                    | Yes       | Yes \* Payment trong order được thanh toán bằng method: **Card / Cash / Other** \* Riêng đối với method Card, status của payment trong order: **Auth** \* Đối với method Gift Card: KHÔNG cho phép Adjust Tip |
| **Successful - Settled**   | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | No - Hide action                                                                                                                                | Yes - Refunds 100% of payment(s) - Changes status to Refunded - Marked Red in UI | Yes - Refund one or more payments (or part of a payment) - Changes status to Partially Refunded - Marked Orange in UI | No        | No                                                                                                                                                                                                            |
| **Canceled (Same VOID)**   | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | No - Hide action                                                                                                                                | No                                                                               | No                                                                                                                    | No        | No                                                                                                                                                                                                            |
| **Refunded**               | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | No - Hide action                                                                                                                                | No                                                                               | No                                                                                                                    | No        | No                                                                                                                                                                                                            |
| **Partial Refunded**       | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | No - Hide action                                                                                                                                | No                                                                               | Yes - Refund one or more payments (or part of a payment) - Changes status to Partial Refunded - Marked Orange in UI   | No        | No                                                                                                                                                                                                            |
| **Refund Issue**           | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | No - Hide action                                                                                                                                | No                                                                               | No                                                                                                                    | No        | No                                                                                                                                                                                                            |
| **Cancel Issue**           | Yes - Allow viewing and printing receipt | Yes                                                                       | No                                                                                                                        | No - Hide action                                                                                                                                | No                                                                               | No                                                                                                                    | No        |                                                                                                                                                                                                               |
| **Re-open**                | Yes - Allow viewing and printing receipt | No                                                                        | No                                                                                                                        | Yes - Chỉ xuất hiện khi order đang trong process re-open mà bị thoát ra ngoài, thì bắt buộc phải tiếp tục process re-open đến khi Re-open Done. | No                                                                               | No                                                                                                                    | No        | No                                                                                                                                                                                                            |

List Reason for Cancel / Refund / Partial Refund

| Reason for Cancel / Refund / Partial Refund |
| ------------------------------------------- |
| Customer request                            |
| Service issue                               |
| Incorrect order                             |
| Duplicate payment                           |
| Promotion / Discount error                  |
| Staff mistake                               |
| Other                                       |

**Receipt & History behavior:**

| Action         | Display on Receipt?           | Show in Order History? |
| -------------- | ----------------------------- | ---------------------- |
| Void Payment   | Yes, marked as void           | Yes                    |
| (Full) Refund  | Yes, show refund              | Yes                    |
| Partial Refund | Yes, highlight refund line(s) | Yes                    |
| Cancel Order   | Yes, show “Canceled”          | Yes                    |
| Reopen Order   | Show updated payment or items | Yes                    |

### Order History listing

- Title: Order History
- Filter Date: Created At/Updated At của order (Updated At đối với những order change status)
  - Nếu filter date range, thì list order trả về được group by theo từng ngày
- Search: Order ID
- Filter:
  - Staff - check box:
    - Select staff (nickname)
    - Search staff nickname
  - Payment Method - check box: Card/Cash/Gift Card/Other
  - Status - check box:
    - Successful - Unsettled
    - Successful - Settled
    - Canceled
    - Refunded
    - Partial Refunded
  - Button: Clear / Confirm
- Order listing:
  - OD ID
  - Payment Method: Card/Cash/Gift Card/Other
  - Staff nickname: nếu nhiều hơn 2 staff thì show \[Staff1, Staff 2, …\]
  - Status:
    - Successful - Unsettled
    - Successful - Settled
    - Canceled
    - Refunded
    - Partial Refunded
  - Amount
  - Created At/Updated At: Mmm dd, yyyy hh:mm AM/PM
  - Sort: default Desc

### Order detail

- Title:
  - Order #ODxxxx
  - Button action: tùy theo status của order sẽ hiển thị những action khác nhau
- Order Information:
  - Status
  - Order ID
  - QR code
  - Order Date: Created At (thời gian order đc thanh toán thành công)
  - Customer: Customer name
- Order Summary:
  - Subtotal
  - Service Fee
  - Total Discount (show item discount, chưa có Order Discount)
  - Tip
  - Total
- Service Details:
  - Last updated: Mmm dd, yyyy hh:mm AM/PM (trùng với Created At/Updated At của order)
  - Staff:
    - Staff nickname
    - Service name - service note
    - Price: Giá cuối cùng và phần (-số tiền đã giảm/ % đã giảm)
- Tip:
  - Show list staff và tip hiện tại của mỗi staff
  - Date: default show created at của order, nếu có update thì show thời gian updated Tip
  - Action Split Tip: (Nếu có nhiều hơn 1 staff) modal Split Tip sẽ gồm những thông tin sau:
    - Title: Split Tip
    - Total Tip: total tip của order
    - 3 options: **Split Evenly / Proportion / Manual**
      - **Split Evenly:** Chia đều total tip cho tất cả staff trong order
      - **Proportion:**
        - Chia theo phần trăm tổng số tiền thợ làm/total order
        - Vd: Total service của Anna là $60, Hannah là $40. Total order là $100, Total tip là $20. => Anna tip = (60/100) \* 20 = $12 => Hannah tip = (40/100) \* 20 = $8
      - **Manual:** Nhập tip riêng cho từng staff, dựa trên total Tip
    - List Staff - nickname đang có trong order
    - Button: Confirm
  - Note: Chỉ cho phép Split Tip trong order trước thời gian chốt trả lương cho staff, tạm thời cho update thoải mái, sẽ required lại khi có setting Period Payroll.
- Payment Details: thông tin payment method đã thanh toán order trên từng check, có thể gồm:
  - Check 1: OrderID -1 -— Card: Visa (Debit) \*\*\*\*1234 - Amount (bao gồm cả tip - nếu có)
  - Check 2: OrderID -2 -— Cash:
    - Amount: số tiền khách đưa (bao gồm cả tip - nếu có)
    - Change: tiền thừa thối lại
  - Check 3: OrderID -3 -— Gift Card: gift card number (PENDING)
  - Check 4: OrderID -4 -— Other (PENDING)
- Order Note: hiển thị order note đã nhập trước đó lúc create order

```
Order Detail: Successful - Unsettled
```

Gồm những thông tin đặc biệt sau:

- Status: Successful - Unsettled
- Button action:
  - Receipt
  - Re-Open Order
  - Cancel Order
- Split Tip action is allow

```
Order Detail: Successful - Settled
```

Gồm những thông tin đặc biệt sau:

- Status: Successful - Settled
- Button action:
  - Receipt
  - Refund
  - Partial Refund

```
Order Detail: Canceled
```

Gồm những thông tin đặc biệt sau:

- Status: Canceled
- Button action:
  - Receipt
- Cancel Information:
  - Amount (Total amount order bị cancel)
  - Date & Time (Updated At, thời gian thực hiện cancel order)
  - By Staff (user thực hiện action Cancel, vì muốn Cancel order phải nhập staff code)
  - Reason

```
Order Detail: Refunded
```

Gồm những thông tin đặc biệt sau:

- Status: Refunded
- Button action:
  - Receipt
- Refund Information:
  - Title: Refund #OD - ID - Check ID
  - Amount (amount order-check bị cancel)
  - Date & Time (Updated At, thời gian thực hiện refund order-check)
  - Method
  - By Staff (user thực hiện action refund, vì muốn refund order phải nhập staff code)
  - Reason

```
Order Detail: Partial Refunded
```

Gồm những thông tin đặc biệt sau:

- Status: Partial Refunded
- Button action:
  - Receipt
  - Refund (Nếu order gồm nhiều check, chỉ vừa mới partial refund 1 check, thì khi chọn Refund sẽ refund hết cho những check còn lại)
  - Partial Refund
- Refund Information:
  - Title: Refund #OD - ID - Check ID
  - Amount (amount order-check bị cancel)
  - Date & Time (Updated At, thời gian thực hiện refund order-check)
  - Method
  - By Staff (user thực hiện action refund, vì muốn refund order phải nhập staff code)
  - Reason

### **Adjust Tip**

Adjust Tip: chỉnh sửa lại số tiền Tip sau khi order đã được thanh toán thành công. Thêm action Adjust Tip trong Order Detail đối với những order thỏa điều kiện sau:

- Status của order: **Successful - Unsettled**
- Payment trong order được thanh toán bằng method: **Card / Cash / Other**
- Riêng đối với method Card, status của payment trong order: **Auth**
- Đối với order có nhiều payment method: hiển thị list payment method và phải select 1 payment method cụ thể để thực hiện Adjust Tip

Lưu ý:

- Đối với method Gift Card: KHÔNG cho phép Adjust Tip
- Sau khi Adjust TIP, nếu order có nhiều Staff, thì auto update lại Split Tip với tip mới.
- Chỉ cho phép add Tip khi có Staff trong order

—------------------------------------------------------------------------------------------------------------------

### **Refund/Partial Refund**

1. **Định nghĩa:**

- Refund = hoàn toàn bộ phần tiền của order đã thanh toán.
- Partial Refund = hoàn lại một phần tiền của order đã thanh toán, thay vì hoàn toàn bộ
  - Áp dụng khi:
- Khách không hài lòng một dịch vụ
- Một service không được thực hiện
- Nhân viên làm lỗi một phần
- Giá cần điều chỉnh sau thanh toán

2. **Điều kiện:**

- Order status được thực hiện Refund/Partial Refund: **Successful - Settled**
- Nếu trong 1 Order có credit transaction chưa Batch/Close → disable nút Refund:
  - Refund button: Disabled
  - Nếu user cố click → hiển thị alert:  
    **Title:** Refund Not Available

    **Message:** This transaction has not been batch closed yet. Refund can only be processed after it has been batch closed.

    **Enable lại khi:** Tất cả card transactions trong order đã được Batch Close.

3. **Workflow**:

- Gom lại thành 1 form, tên chung là **Refund** và dựa vào service được chọn để biết là thực hiện Full Refund hay Partial Refund:
  - Nếu order chỉ có 1 service, thì sau khi chọn service đó sẽ tiến hành Full Refund, và Amount được autofill sẽ là total amount của order đó (nếu bao gồm cả Tip)
  - Nếu order có nhiều service và không được chọn all service thì sẽ thực hiện Partial Refund, và Amount được autofill là giá tiền trên những service được chọn
  - Nếu sau khi thực hiện Partial Refund và trong order vẫn còn service để thực hiện partial refund được tiếp tục nữa, thì lúc này button action vẫn là **Refund**, status order là **Partial Refund**
- **Specical Case: Khi select service để partial refund mà trong order có discount/TAX:**
  - Thì mình cũng sẽ refund trên giá service sau discount, phần discount apply cho order thì mình chia phần trăm tỉ lệ trên từng service, rồi sau refund trên giá đó
  - VD:  
    service 1 giá $100   
    service 2 giá $50  
    service 3 giá $50

    Total $200 Discount $20 > khách thanh toán $180

    Thì chia theo phần trăm:  
    service 1 chiếm 50% > discount $10   
    service 2 chiếm 25% > discount $5  
    service 3 chiếm 25% > discount $5

    Partial Refund service 1 > thì sẽ trả lại cho khách $90
- **Specical Case: nếu 1 cái promotion rule apply là đối với order từ $100 trở lên, nên partial refund sẽ giảm order về dưới $100, thì cái promotion cũ mình nên giữ không?**
  - Promotion vẫn nên giữ, tại vì đúng là đã chốt tại lúc checkout order (settled) rồi > k thay đổi gì cả
  - Khi partial refund thì theo vd như hình, thì nó giống vd ở trên luôn, partial refund 1 service $30, thì order còn lại $70 >> total vẫn là $100 là giá sau discount
  - ![](https://uploads.linear.app/48af1d4d-bdb8-403a-a96b-66898fda1a34/d6d94913-d520-4301-93c6-1151f9e26547/2a6186e7-2650-42f4-95a1-fe75297809ed?signature=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRoIjoiLzQ4YWYxZDRkLWJkYjgtNDAzYS1hOTZiLTY2ODk4ZmRhMWEzNC9kNmQ5NDkxMy1kNTIwLTQzMDEtOTNjNi0xMTUxZjllMjY1NDcvMmE2MTg2ZTctMjY1MC00MmY0LTk1YTEtZmU3NTI5NzgwOWVkIiwiaWF0IjoxNzg4MzYwODM2LCJleHAiOjE3ODgzNjExMzZ9.2hs1QYvbeI0FO51M66GguISa-hdOjE1ZvbC_axCNbrA)
  - Theo business logic, nếu thu của khách bao nhiêu thì phải trả lại bấy nhiêu, chứ lúc thu đã apply promo mà lúc refund lại refund giá gốc thì k hợp lý, vậy thì khách lời - chủ tiệm sẽ lỗ

4. **Hiển thị trong order gồm những field thông tin sau:**

- Click button Refund sẽ show dialog gồm những thông tin sau:
  - **Title**: Refund
  - **Description**: _Enter amount or select check payment you want to refund._
  - **Select services/products**
    - Option All: để chọn tất cả service đang có để thực hiện refund full
    - List service/produc, gồm:
      - Service Name
      - Service price: giá cuối cùng để thực hiện refund
  - **Refund method:**
    - Show list payemnt method đã được thực hiện trong order, chọn 1 để thực hiện partial refund
    - Cash / Card / Other (Không refund GiftCard)
  - **Refund amount:** sau khi chọn list Service/Product, thì điền sẵn số tiền của những service/product trên
  - **Select a reason for refund (Optional):** \[List Reason for Cancel / Refund / Partial Refund\]
  - Button: Cancel / Refund

5. **Order History update sau khi được partial refund**

- Ghi nhận trong Payment Detail session (order logs)
- Xuất hiện thêm session: Refund Information, gồm những thông tin sau:
  - Title: Refund Information
  - RF OD334589-1: order refund code
  - Amount: số tiền bị refund/partial refund
  - Date & Time: thời gian thực hiện refund/partial refund
  - Method: hình thức refund
  - By Staff: staff thực hiện refund
  - Reason
- Receipt: hiển thị thêm session Refund Information khi view/print receipt

6. **Một số lưu ý:**

- Sau khi thực hiện partial refund success, status của order chuyển sang Partial Refunded
- Sau khi thực hiện partial refund nhiều lần đề khi hết amount của order, status của order chuyển sang Refunded
- Nếu partial refund failed, status của order chuyển sang Refund Issue
- Có thể thực hiện partial refund nhiều lần cho đến khi hết amount của order, nhưng:
  - Đối với payment Auth có Tip, chỉ được partial refund hết base amount, không partial refund được Tip
  - Đối với payment Sale, được partial refund đến khi hết Amount + Tip

—-----------------------------------------------------------------------------------------------------------------

### **Reopen Order**

1. **Support thêm status "re-open" cho Order**

- Khi bấm vào Re-open order thì update lại status "re-open".
- Chỉnh sửa, thanh toán xong thì nhấn Re-open done để chuyển về status truoc đó.
- Tại Page OrderHistory: thì order đang ở trạng thái re-open thì nút Re-open chuyển thành Continue Re-open.
- Một order chỉ được phép Reopen một lần.

2. **Layout:**

- List transaction paid: bỏ X ở từng transaction - sẽ không còn void từng transaction.
- Thay bằng 1 nút chung để Void tất cả các transaction đang có.
- Xuất hiện confirm

3. **Điều kiện:**

- Sau khi thêm/xóa/sửa các service trong order làm số tiền cần thành toán khó tính toán ra đúng thì sẽ xuất hiện nút Void all(\*)

4. **Mong muốn:**

- Không thay đổi status của Order.
- Tính toán lại số liệu của service mới và theo setting mới như 1 order mới
- Phải thanh toán thành công lại, mới dc complete payment và thoát flow re-open

5. **Report Efffect**

- Khi Order được Re-open:
  - Loại bỏ Order khỏi tất cả các Income/Reports.
  - Không tính Income/Commission/Payroll report và các số liệu liên quan của Order trong thời gian Order đang ở trạng thái Re-open.
- Khi Order được Complete lại:
  - Hệ thống tính toán lại toàn bộ dữ liệu của Order theo thông tin mới nhất.
  - Ghi nhận lại vào tất cả các Income/Reports liên quan.

(\*) Nếu:

- Số tiền đã thành toán (totalPaid) < new Total Order.
- Update item có thay đổi về tax or order có paid tax trước đó nhưng reopen thanh toán lại bằng method khác

Special Case:

**1. Cho phép reopen order 1 lần duy nhất và status order - Success Unsettle.**  
**2. Những field bị ảnh hưởng khi thực hiện Reopen:**

- Discount / Promotion / Reward: block lại ở version order trước khi reopen
- Service fee: Recalculate lại theo subtotal mới
- Tax: block tax theo version order trước khi reopen
- Cashback redeem: Restore cashback đã dùng trước đó. Apply lại theo order mới
- Cashback earn: Cashback chưa finalize, hệ thống sẽ recalculate lại Earn Cashback theo total mới của order khi order được close lại.

**3. Một số special case khi thực hiện Reopen và cách xử lý:**

1. Thay đổi hình thức thanh toán > Void > charge lại
2. Thay đổi total thấp hơn giá trị hiện tại > Void > charge lại
3. Thay đổi total cao hơn giá trị hiện tại > charge thêm
4. Thay đổi tiền thuế (thêm/bớt món, đổi giá, discount, promotion, reward, ...) làm thay đổi số tiền thuế so với lúc khách thanh toán > Void > charge lại
5. Nếu order đang có service và product và đã tip > mà repoen xoá hết staff chỉ con store > Void > charge lại
6. User xoá hết service của order cũ và thay bằng list service mới, thì vẫn nên cho phép nhưng sẽ show thêm cảnh báo:  
   "You are replacing all services in this order.  
   This will:  
   Recalculate pricing  
   Update staff commission  
   May change total payment  
   …

- Thì lúc này sẽ clear hết tất cả và tính toán lại như 1 order mới, và quay về case trước đó:
  - Nếu total thấp hơn > force Void > tạo lại order mới
  - Nếu total cao hơn > charge thêm
  - Tất cả phải lưu được log các version order trước và sau khi reopen.

—------------------------------------------------------------------------------------------------------------------

## **Handling Network Disconnects: Card đang thanh toán bị mất mạng giữa chừng**

1. **Tiếp tục thanh toán offline với Cash.**

- Thanh toán Cash: done
- Check Order History(\*)

2. **Try again lại khi online.**

Action : (1) Nhấn try again/Pay to Cash => background refresh/pull transaction mới để biết thành công hay thất bại

TH 1: Nhấn (1) -> xuất hiện transaction card mới thành toán.

- Tính lại số tiền cần thanh toán = 0
- Cho Complete payment (không tạo transaction bằng 0)
- Khóa nút <- back , không cho back ra home, bắt buộc phải complete payment
- Done

TH 2: Nhấn (1) -> không xuất hiện transaction card mới thành toán.

- Số tiền cần thanh toán không thay đổi
- Thanh toán tiếp với method bất kỳ: Done
- Check Order History(\*)

**(\*) Check Order History Sau thanh toán cần check để biết cần void transaction không**

TH 1: Không xuất hiện transaction card mới lúc mất kết nối: Done không làm gì.

TH 2: Xuất hiện transaction card mới lúc mất kết nối:

- Void transaction Card dc tạo lúc mất kết nối => Xong
- Void transaction method thành công mới nhất => Nếu ko thể complete payment (do nhiều nguyên nhân: lệnh phí service fee, cash discount, tax, discount,…) => Cần void hết hết transaction để đảm bảo consistent về tiền

# Feature Requirement: Customer & Order Search Module

## 1\. Overview

The Search feature allows users to look up Customer Name, Customer Phone, or Order ID.

Search results are displayed across 5 sections: All, Appointment, Checkin, Order, Customer.

---

## 2\. Search Result Structure

### 2.1 Tabs

- All: Shows combined data from Appointment, Checkin, and Order.
- Appointment: Shows appointment list related to the customer phone.
- Checkin: Shows all checkins of the customer.
- Order: Shows orders matching customer info or the searched Order ID.
- Customer: Displays customer profile information.

---

## 3\. Appointment Tab

### 3.1 Appointment List Display

Each appointment shows:

- Date and time
- Customer name + last 4 digits of phone number
- Service name / Staff nickname
- Status (Scheduled, Confirmed, Canceled, Done)

### 3.2 Appointment Detail View

When clicking an appointment:

- Date
- Customer phone
- Customer name
- Service / Staff / Start Time / Duration
- Add more Service or Staff
- Appointment notes

### 3.3 Customer Insight Section

- Total appointments by status (Scheduled, Confirmed, Canceled, Done)
- Total amount spent
- Current loyalty points
- Total visit count

---

## 4\. Checkin Tab

### 4.1 Checkin List Fields

- Checkin / Checkout date (order creation timestamp)
- Status
- Point earned or used

---

## 5\. Order Tab

### 5.1 Order List Display

Each order shows:

- Order created at
- Staff
- Service
- Total amount

### 5.2 Order Action

Clicking an order redirects to the Order History Detail screen.

---

## 6\. Customer Tab

### 6.1 Customer Information Display

- Customer name
- Customer phone
- Points
- Total visits
- Customer group

### 6.2 Customer Info Action

Clicking the customer opens the Customer Info Detail Modal.

---

## 7\. Order Search Result (Search by Customer Info or Order ID)

### 7.1 Order Result Fields

- Order ID
- Date
- Customer name / phone
- Order staff nickname
- Order service name
- Order status

### 7.2 Order Result Action

Clicking an order redirects to Order History Detail.

---

## 8\. Empty State

### 8.1 No Data Handling

When no data is found:

- Display "No data" icon
- Display a message indicating no records available

---

## 9\. Functional Requirements Summary

### 9.1 Input

- Customer name
- Customer phone
- Order ID

### 9.2 Output

- Appointment list
- Checkin list
- Order list
- Customer profile
- Customer insights

### 9.3 Non-functional Requirements

- Realtime search
- Data loaded per tab
- UI consistent with Volt POS design

---

## 10\. Acceptance Criteria

### 10.1 Search Behavior

- Searching by phone returns Customer, Appointment, Checkin, and Order.
- Searching by name returns the correct customer and related data.
- Searching by Order ID returns the correct order and supports redirection.
- If no results match, show "No data".

### 10.2 User Interaction

- Clicking an appointment opens appointment detail + insight section.
- Clicking customer opens the customer detail modal.
- Clicking an order redirects to Order History Detail.

---

_Source: Google Docs — "Order Flow" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
