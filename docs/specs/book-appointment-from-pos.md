---
title: 'Book Appointment from POS'
source: https://linear.app/fastboy/document/book-appointment-from-pos-77e8461bc641
linear_id: 64dcf1dd-7329-4e31-b499-9fa81582057f
team: VOLT
updated: 2026-08-14T07:44:55.444Z
---

# Book Appointment from POS

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Book Appointment from POS**

# **A. Setting Go Booking (Web Booking - POS Booking)**

1. **Booking Hours**

- Thiết lập thời gian được phép đặt hẹn tại trang website book hẹn. Có thể thiết lập riêng hoặc giống thời gian làm việc của tiệm thông qua việc chọn nút Sync with Business work hour.

!\[\]\[image28\]

2. **SMS Content**

- Các nội dung tin nhắn chỉ được thiết lập trong phạm vi 160 ký tự bao gồm cả tên tiệm theo quy định SMS quốc tế. Trường hợp lố ký tự sẽ dẫn đến không gửi tin nhắn ra được. Số lượng ký tự có thể xem ở cuối mỗi dòng.

| SMS Content                                                |                                                                                                                                  | Ý nghĩa / Điều kiện                                                                                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SMS sent when you can't fulfill an appointment request** |                                                                                                                                  | Chủ tiệm hủy lịch hẹn Appointment Status = Cancelled                                                                                                                                                    |
|                                                            | Sorry we’re busy at the time you request the appointment, please make another appointment, thanks! {link}. Reply STOP to opt out |                                                                                                                                                                                                         |
| **SMS sent when customer’s booking is confirmed**          |                                                                                                                                  | Appointment đã được phía tiệm xác nhận Appointment Status = Confirmed                                                                                                                                   |
|                                                            | Your appointment with {business_name} has been confirmed. {link}. Reply STOP to opt out                                          |                                                                                                                                                                                                         |
| **SMS sent when your customer completes a booking online** |                                                                                                                                  | Book appoinment online thành công (đây là tin nhắn trước khi nhận được tin confirmed ở trên) Appointment Status = Scheduled                                                                             |
|                                                            | Your appointment with {business_name} has been sent to the owner, please wait for his/her confirmation. {link}                   |                                                                                                                                                                                                         |
| **SMS sent reminder customer**                             |                                                                                                                                  | Là nội dung tin nhắn gửi ra để nhắc nhở khách hàng về cuộc hẹn sắp tới. Thông thường mặc định sẽ được thiết lập 3 tiếng trước khi đến giờ hẹn (Khách có thể nhờ bên mình thiết lập mốc thời gian khác). |
|                                                            | Hi {customer_name}, don't forget your appointment at {business_name} on {date} at {time}. {link}. Reply STOP to opt out          |                                                                                                                                                                                                         |
| **SMS sent for waiting customer**                          |                                                                                                                                  | Là nội dung tin nhắn gửi ra nhằm báo với khách hàng đang trong danh sách chờ khi tiệm đông rằng tiệm đã sẵn sàng phục vụ.                                                                               |
|                                                            | {business_name}: We're ready for you, please come back as soon as you can.                                                       |                                                                                                                                                                                                         |

3. **Block Time**

- Là một tính năng dùng để chặn (block) một khoảng thời gian trên lịch đặt hẹn, để khách hàng không thể đặt lịch trong khoảng thời gian đó. Nói đơn giản: tưởng tượng lịch đặt hẹn giống một cuốn sổ lịch của tiệm. Bình thường khách có thể chọn bất kỳ ô giờ nào còn trống. Nhưng Block time giống như đặt một tấm biển “⛔ Không nhận khách khung giờ này”
- **Business Block Time:** Tạm thời chặn hẹn toàn bộ tiệm vào ngày cụ thể.  
  !\[\]\[image29\]  
  Tại đây tiệm có thể thêm ngày cụ thể muốn tạm thời chặn đặt hẹn thông qua việc chọn dấu + ở góc phải  
  !\[\]\[image30\]  
  Lúc này sẽ có các thiết lập như hình:
  - **Day Off:** ngày muốn chặn đặt hẹn.
  - **Duration:** khung thời gian muốn chặn đặt hẹn của ngày hôm đó.(hoặc có thể tích chọn ô All day để hệ thống hiểu rằng sẽ chặn cả ngày hôm đó)
  - **Recurring?:** Là tính năng cho phép thiết lập sự lặp lại. Sau khi kích hoạt sẽ có các tính năng phía dưới.
  - **Repeat:** Lặp lại hàng tuần hoặc hàng tháng.
  - **End Date:** Sự lặp lại sẽ kết thúc vào ngày nào tùy theo thiết lập tiệm.
  - **Description:** Dùng để thêm mô tả, nguyên nhân của ngày chặn đặt hẹn này (chỉ tiệm thấy, khách hàng khi đặt hẹn sẽ không thấy phần này)
- **Staff Block Time:** Tạm thời chặn đặt hẹn đối với thợ chỉ định  
  !\[\]\[image31\]  
  Tại đây tiệm có thể thêm ngày cụ thể muốn tạm thời chặn đặt hẹn thông qua việc chọn Add Time Off  
  !\[\]\[image32\]
- Lúc này sẽ có các thiết lập giống như Business Block Time:
  - **Day Off:** ngày muốn chặn đặt hẹn.
  - **Duration:** khung thời gian muốn chặn đặt hẹn của ngày hôm đó.(hoặc có thể tích chọn ô All day để hệ thống hiểu rằng sẽ chặn cả ngày hôm đó)
  - **Recurring?:** Là tính năng cho phép thiết lập sự lặp lại. Sau khi kích hoạt sẽ có các tính năng phía dưới.
  - **Repeat:** Lặp lại hàng tuần hoặc hàng tháng.
  - **End Date:** Sự lặp lại sẽ kết thúc vào ngày nào tùy theo thiết lập tiệm.
  - **Description:** Dùng để thêm mô tả, nguyên nhân của ngày chặn đặt hẹn này (chỉ tiệm thấy, khách hàng khi đặt hẹn sẽ không thấy phần này)

4. **Popup Message (Web Booking)**

- Đây sẽ là thiết lập thông báo ngay khi khách hàng truy cập vào trang đặt hẹn. Sau khi nhập nội dung bất kỳ và Save lại, sẽ được kết quả tại trang book hẹn ngay khi vừa truy cập như hình dưới.  
  **!\[\]\[image33\]**  
  **!\[\]\[image34\]**

5. **Appointment Deposit (Web Booking)**

- Đây là tính năng đặt cọc trước mỗi khi khách hàng đặt hẹn vào tiệm.
- **Setting deposit type:** Mức đặt cọc mà khách phải ứng trước khi đặt hẹn. Tại đây có thể chọn theo phần trăm giá tiền dịch vụ với **Percentage deposit**, hoặc theo số tiền cụ thể mà tiệm có thể thiết lập ở **Fixed deposit amount**.
- **Setting cancel policy:** Nếu kích hoạt nút Allow, thì lúc này tiệm cho phép khách hàng hủy hẹn và hoàn tiền. Tuy nhiên thời hạn để thực hiện thao tác trong phạm vi thời gian nhất định sau khi đặt hẹn. Có thể cài đặt 24 tiếng, 48 tiếng như mặc định hoặc thời gian khác bằng cách chọn Custom Hours.  
  **!\[\]\[image35\]**

6. **Web Booking Settings**

!\[\]\[image36\]

- **Display Settings**: Cài đặt giao diện hiển thị trên trang **Web Booking**

!\[\]\[image37\]

| Action                                         | Ý nghĩa                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Show skip button on your online booking page   | Hiển thị nút Skip trên trang đặt hẹn online. Giúp người đặt hẹn có thể skip qua một số bước (tính năng này chỉ áp dụng cho link web booking 2.0). |
| Show service price on your online booking page | Hiển thị giá của services trên trang đặt hẹn.                                                                                                     |
| Show Standard Service Duration                 | Hiển thị Duration (thời gian làm một service) trên trang đặt hẹn.                                                                                 |
| Show the staff name of the confirmation page   | Hiển thị tên thợ trên trang confirm sau khi đặt hẹn xong.                                                                                         |
| Show Staff Selection Page                      | Hiển thị trang chọn staffs cho người đặt có thể tùy ý chọn thợ mình muốn.                                                                         |

- **Staff Selection & Assignment**: Mục này dùng để thiết lập cách client chọn thợ và cách hệ thống tự động assign staff cho các cuộc hẹn **Web Booking.**

!\[\]\[image38\]

- **“Any Staff” option will be used when your customer doesn’t know who to book online:** Hiển thị và cho phép người đặt chọn thợ ngẫu nhiên bằng cách chọn vào thợ tên “Any available staff”.
- **Appointment will be assigned automatically by the system to any staff available that time and can do the service:** Tính năng này chỉ active được khi sử dụng Any Staff phía trên. Lúc này sau khi người đặt chọn Any Staff available, system sẽ tự động assign sang ngẫu nhiên người thợ phù hợp trong khung giờ đó.
  - Any staff color: màu sắc hiển thị mặc định khi book “Any available staff”
  - Booking done color: màu sắc mặc định khi book hẹn đã chuyển sang Done
  - Booking cancel color: màu sắc mặc định khi book hẹn đã được cancel.
- **Allow selecting staff per service when booking:** Hiển thị thợ “Staff per service” để khách tạm thời lựa chọn. Thợ này chủ yếu dùng để khách chọn tạm thời để hoàn tất việc chọn service trước, sau đó sẽ chọn thợ cụ thể sau để hoàn tất đặt hẹn.
- **Web Booking Rules & Behavior**: Thiết lập các quy tắc, hành vi từ Web booking vào hệ thống

!\[\]\[image39\]

- **Allow customers to submit booking requests for time slots that are unavailable in the system:** Cho phép khách gửi yêu cầu booking vào khung giờ đang không available. Booking sẽ ở dạng request, owner/staff sẽ kiểm tra và xử lý thủ công.
- **Allow adding multiple guests in a single booking:** Cho phép khách thêm nhiều guest trong một booking. Phù hợp với booking đi theo nhóm / gia đình.

  Khi khách sử dụng tính năng này, service của Guest 2 sẽ bắt đầu cùng thời gian với Guest 1 và không cho phép 2 Guest đặt cùng 1 thợ.

- **Maximum Number of Days Customers Can Book in Advance:** Giới hạn số ngày tối đa khách có thể đặt hẹn trước. Ví dụ: Setup 30 ngày → khách chỉ đặt được trong vòng 30 ngày tới.
- **Minimum Advance Days Required Before Booking:** Thiết lập số ngày tối thiểu khách phải đặt trước. Ví dụ: Setup 0 ngày → khách có thể đặt trong ngày.
- **Allow Customers to Cancel Bookings:** Cho phép khách tự hủy booking sau khi đã đặt. Owner có thể kết hợp với các rule khác để kiểm soát lịch trống.
- **Require Note Input:** Bắt buộc khách nhập ghi chú khi đặt lịch.Giúp tiệm nắm trước yêu cầu hoặc lưu ý đặc biệt của khách.
- **Go Booking Rules & Behavior:** Cấu hình quy tắc, hành vi đặt hẹn từ hệ thống tới người sử dụng Dashboard. Dùng để thiết lập các quy tắc hiển thị và cách xử lý booking trên màn hình Go Booking tại tiệm.

!\[\]\[image40\]

- **Hide unassigned column when having no appointment:** Ẩn cột Unassigned khi không có appointment. Giúp màn hình Go Booking gọn gàng, dễ theo dõi
- **You don't need to confirm your online bookings, which means all online bookings from your customers will be automatically confirmed right after they book:** Tất cả booking online của khách sẽ được auto confirm ngay sau khi đặt hẹn. Phù hợp với các tiệm không có lễ tân hay thời gian để kiểm tra từng lịch hẹn.
- **Block create warning appointment:** Chặn việc tạo warning appointment. Giúp hạn chế các lịch hẹn không available hoặc không hợp lệ (staff không làm hoặc bận trong khung giờ đó/ Staff không thể làm service đó, bt thì vẫn cho tạo nhưng có message cảnh báo trước)
  - Cố tình tạo appoinment với thông tin Staff/Service/Date không available, thì khi click Book sẽ hiển thị popup confirm:
    - Title: Confirmation
    - Description: There are warnings about these appointments, please check again.
    - Button: Accept

  !\[\]\[image41\]

- **Security & Validation**: Cài đặt bảo mật và xác thực thông tin khi khách đặt lịch **(Web booking)**

!\[\]\[image42\]

- **Require login before booking:** Yêu cầu khách đăng nhập trước khi đặt lịch. Phù hợp với tiệm có khách quen / member.  
  !\[\]\[image43\]
- **Enable CAPTCHA Verification for Booking:** Bật CAPTCHA khi booking. Giúp hạn chế bot / booking spam.
- **Require Customers to Enter Email When Booking:** Bắt buộc khách nhập email khi đặt lịch. Dùng để gửi confirmation / notification sau booking
- **Display a notification message when the selected service is invalid:** Hiển thị thông báo khi service khách chọn không hợp lệ.  
  Ví dụ thông báo:  
  \t _“No staff available for this service on this time. Please select other date & time!”_  
  \tOwner có thể chỉnh nội dung thông báo để phù hợp với cách giao tiếp của tiệm.
- **Pricing & Payment Settings**: Quản lý giá dịch vụ và dual pricing cho web booking

!\[\]\[image44\]

- **The service price will include the service fee:**

  ON: Giá service hiển thị trên Web Booking đã bao gồm service fee  
  → Khách thấy giá cuối cùng khi đặt lịch

  OFF: Giá service hiển thị chưa bao gồm service fee  
  → Service fee sẽ được tính riêng ở bước thanh toán

- **System Configuration**: Các cấu hình hệ thống chung liên quan đến **Web Booking**

!\[\]\[image45\]

- **Set Up Store Timezone:** Cài đặt múi giờ của tiệm.
- **Please press "Activate" only when you have completed all information in Setting, Services and Staff tabs. After you hit "Activate", all information will officially appear on your online booking and customers can start booking with your business:** Cần phải kích hoạt để trang Web Booking đi vào hoạt động. Trường hợp tiệm cần tạm tắt trang đặt hẹn có thể tắt chức năng này.
- **Enable Booking V3 Redirect:** Chức này cho phép các tiệm đang sử dụng Version 2.0 có thể tự động chuyển sang Version 3.0 ngay lập tức và ngược lại.
- **Sync data to web booking:** Tính năng Sync data to Web Booking dùng để đồng bộ dữ liệu từ hệ thống lên trang Web Booking.

**!\[\]\[image46\]**

Khi thực hiện sync, hệ thống sẽ cập nhật các thông tin sau lên Web Booking:

- Settings
- Services
- Staff
- Các thay đổi liên quan đến cấu hình booking
- Lưu ý cho owner:
  - Nên sync dữ liệu sau khi có thay đổi về setting, service hoặc staff.
  - Đảm bảo Web Booking hiển thị đúng và mới nhất trước khi Activate hoặc trước khi khách bắt đầu booking

# **B. Setting apply cho POS Booking**

1. **Booking Hours**

- Thiết lập thời gian được phép đặt hẹn tại trang website book hẹn. Có thể thiết lập riêng hoặc giống thời gian làm việc của tiệm thông qua việc chọn nút Sync with Business work hour.
- Lưu ý: thời gian booking trên POS không chỉ phụ thuộc vào Booking Hours, mà còn phụ thuộc vào
  - Business Hours
  - Staff Booking Hours
- Rule:

```
- Calendar hiển thị theo Booking Hours ± 1 tiếng.
Ví dụ:
Booking Hours: 7AM - 9PM
=> Calendar hiển thị: 6AM - 10PM
- Staff chỉ được nhận booking trong:
Calendar visible time VÀ Staff Booking Hours
- Business Hours là giờ hoạt động của tiệm, không quyết định trực tiếp khung giờ hiển thị Calendar.
```

| Booking Hours: 7:00 AM - 9:00 PM &#10;Staff Booking Hours: 10:00 AM - 5:00 PM                                         | Calendar: 6:00 AM - 10:00 PM &#10;Staff chỉ được booking: 10:00 AM - 5:00 PM                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Business Hours: 8:00 AM - 8:00 PM &#10;Booking Hours: 7:00 AM - 9:00 PM &#10;Staff Booking Hours: 12:00 AM - 11:59 PM | Calendar hiển thị: 6:00 AM - 10:00 PM &#10;Staff được phép nhận booking: 6:00 AM - 10:00 PM |

2. **SMS Content**
3. **Block Time**
4. **Web Booking Settings - Go Booking Rules & Behavior**
5. **Một số setting chỉ apply cho Calendar Booking UI**

!\[\]\[image47\]

| Setting                                            | Ý nghĩa                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Show unavailable staff                             | Cho phép hiển thị staff không available trên Calendar và dropdown staff.                                                                                                                                                                    |
| Show with most booking                             | Sắp xếp staff theo số lượng booking nhiều nhất.                                                                                                                                                                                             |
| Show customer phone                                | Hiển thị phone number trên appointment card.                                                                                                                                                                                                |
| Change edit start time mode                        | Cho phép thay đổi UI (dialog) start time của appointment. Enable: sửa thời gian trực tiếp ngay tại appointment detail, và chọn thời gian nào cũng được Disable: show dialog Edit date & Time, show tất cả khung thời gian trực quan để chọn |
| Set appointment color                              | Cho phép dùng màu cho appointment (màu theo staff).                                                                                                                                                                                         |
| Show only business work hours                      | Calendar chỉ hiển thị trong khoảng business hours.                                                                                                                                                                                          |
| Require passcode to cancel appointment             | Yêu cầu nhập passcode để cancel appointment                                                                                                                                                                                                 |
| Unlock customer phone for 30 minute                | Cho phép show full phone customer trong 30 phút sau khi unlock. Chỉ apply cho appointment.                                                                                                                                                  |
| Require Passcode to Edit Appointment               | Edit appointment cần passcode.                                                                                                                                                                                                              |
| Require Staff Code to Edit Appointment             | Staff phải nhập staff code để edit.                                                                                                                                                                                                         |
| Require Staff Code to Create new appointment       | Khi create appointment: yêu cầu staff code.                                                                                                                                                                                                 |
| Show Repeat Appointment feature                    | Hiển thị tính năng repeat appointment trong appointment detail. Để tạo 1 appointment tương tự cho ngày được chọn.                                                                                                                           |
| Show quick info when cursor is over an appointment | Hiển thị tooltip/quick info khi hover appointment.                                                                                                                                                                                          |

# **C. Flow Create Appointment từ POS**

## **1. Mở form Create Appointment**

- User click button: New Appointment trên Calendar POS để mở modal
- Hoặc click thẳng từ calendar
- Lưu ý: nếu click thẳng từ Calendar:
- Chọn thời gian trong quá khứ, không effect
- Chọn vào Block Time, show message:
  - Title: Information
  - Description: _Can not schedule appointment outside your normal business hours!_
  - Button: OK

## **2. Chọn hoặc tạo Customer**

**Search customer:** User có thể search theo:

- Customer name
- Phone number

**Existing customer:** Nếu customer tồn tại

- Show customer list bên trái
- Click customer để select appointment customer

Thông tin hiển thị:

- Customer name
- Masked phone number

Ví dụ:

```
Test
(***) ***-2619
```

**Create new customer**

Nếu không tìm thấy customer. User click: + Create new client để tạo customer mới và tiếp tục booking appointment.

---

## **3. Chọn ngày Appointment**

Date picker hiển thị phía trên form.

**Default:** Default theo ngày đang chọn trên Calendar.

Behavior

- Cho phép booking:
  - Hiện tại
  - Tương lai

Lưu ý: không được tạo appointmnet trực tiếp cho ngày trong quá khứ, nhưng nếu user dùng action kéo - thả appointment trên calendar thì vẫn được cho phép

---

## **4. Nhập thông tin Appointment Line**

Mỗi appointment gồm ít nhất 1 line.

Mỗi line gồm:

```
- Start time
- Duration
- Staff
- Service
```

---

## **5. Start Time**

Default

- Nếu click từ calendar slot:
  - Lấy đúng selected slot time
- Nếu click từ header:
  - Lấy current time
  - Round lên nearest 15 phút

---

## **6. Duration**

**Default:** Default theo service duration nếu đã chọn service.

**Editable:** User có thể edit duration của service

---

## **7. Staff**

**Chọn staff:** User có thể

- Chọn staff cụ thể
- Chọn: Any Staffs
- Hoặc để Unassigned, thì sẽ tự động lưu thành Any Staffs sau khi save appointment
- Filter:
  - All
  - Staff is available (Avalable)
  - Staff is currently busy (Busy)
- Search: staff nickname
- Lưu ý: trong list staff show rõ status hiện tại của staff
  - Avalable:
    - Staff Status - Active
    - Staff Booking status - Active
    - Khoảng thời gian chưa có appointment nào được assgn cho staff
    - check Staff Booking Hours / overlap appointment / staff availability
  - Busy:
    - Chọn start time không available cho staff đó, staff đang có appointment khác
    - Not in woking time của staff đó (ngày nghỉ)
    - Staff đang apply Block Time
    - Nếu cố tính chọn thì show message: _This Staff is not available for this time._

---

## **8. Service**

**Optional:** Service không bắt buộc khi create appointment.

Cho phép: Tạo appointment trước, Checkout order thì mới chọn service

- Khi click vào field chọn service, sẽ show tất cả service - Active theo từng Category, gồm:
  - Service Name
  - Duration
  - Price
  - Trạng thái:
    - Available cho staff đang chọn
    - Busy cho staff đang chọn: _Service unavailable for \[Staff\]_
- Filter:
  - All
  - Service is available (Avalable)
  - Service is currently busy (Busy)
- Search: staff nickname
- Lưu ý:
  - Trong list service show rõ trạng thái hiện tại của service đối với staff đang được chọn
  - Riêng đối với Any Staffs, tất cả service đều available
  - Nếu chưa chọn Staff, mà chọn Service trước, thì luôn show thêm note _Service unavailable for_

---

## **9. Add More**

User click: + Add More để thêm appointment line trong cùng appointment.

**Rule:** Line tiếp theo

- default start time = previous line end time

Cho phép:

- Khác staff
- Khác service
- Khác duration

---

## **10. Appointment Tags**

User có thể chọn:

- **Requested:** Tag đánh dấu appointment request
- **Highlight:** Tag đánh dấu appointment nổi bật
- **No-show:** Tag đánh dấu customer không đến
- **Repeat:** Cho phép tạo recurring appointment khi thực hiện create một new appointment.
  - Nếu setting Show Repeat Appointment feature = ON
  - Nếu click repeat, sẽ show field Repeat Setting và chọn End date, sẽ tạo ra những appointment tương tự thông tin của appointment gốc cho ngày được chọn
  - Action: Cancel Repeat Appointments, click sẽ cancel cả appointment gốc và appointment repeat.
  - Lưu ý: nếu update appointment cũ thì ẩn option Repeat.

---

## **11. Appointment Note**

User có thể nhập: Appointment Note

Rule

- Max length = 255 chars
- Hiển thị trong:
  - Appointment detail
  - Calendar card
  - Hover quick info

---

## **12. Validation khi Book**

Chỉ required: Customer

System validation gồm:

- Customer tồn tại hoặc tạo mới thành công
- Staff availability
- Staff Booking Hours
- Booking Hours
- Business Hours
- Duration validity
- Appointment overlap

---

## **13. Booking Hours Rule**

```
Calendar hiển thị theo Booking Hours ± 1 tiếng.

Ví dụ:
Booking Hours: 7AM - 9PM
=> Calendar hiển thị: 6AM - 10PM

Staff chỉ được nhận booking trong:
- Calendar visible time
- Staff Booking Hours

Business Hours không quyết định trực tiếp khung giờ hiển thị Calendar.
```

---

## **14. Save Appointment**

User click: Book để tạo appointment.

Lưu ý:

- Đối với những appointment được book với thông tin như bên dưới:
  - Staff: _This Staff is not available for this time._
  - Service: _Service unavailable for \[...\]_

  thì được xem là warning booking, khi click Book, sẽ show message confirm và không tạo được appointment:

- Title: Confirmation
- Description: There are warnings about these appointments, please check again.
- Button: Accept

---

## **15. Sau khi create thành công**

System sẽ:

- Đóng modal
- Tạo appointment với: source = POS / Status= Confirmed
- Show appointment trên Calendar, gồm những thông tin sau:
  - Customer Name
  - Service Name
  - Tag (nếu có)
  - Appointment note (nếu có)
  - Booking time: start - end
- Show đúng staff column
- Nếu không có staff: show tại Unassigned column
- Update Appointment Today nếu appointment date = today
- Recalculate count
- Show toast: Appointment created successfully

# **D. Update Appointment**

Status / Action trên appointment

| Appointment Status / Action | Update | Confirm | Cancel | Checkout |
| --------------------------- | ------ | ------- | ------ | -------- |
| **Scheduled**               | Yes    | Yes     | Yes    | No       |
| **Confirmed**               | Yes    | No      | Yes    | Yes      |
| **Canceled**                | No     | No      | No     | No       |
| **Done**                    | No     | No      | No     | No       |

1. **Edit appointment**

- Status appointment: Confirmed / Scheduled
- Được update tất cả các thông tin của appointment, bao gồm:
  - Customer
  - Date
  - Start Time
  - Duration
  - Staff
  - Service
  - Add more
  - Tag
  - Appointment Note
- Button:
  - Cancel: cancel appointment
  - Confirm (nếu status là Scheduled): để confirm appointment
  - Save appointment:lưu lại những thay đổi trên appointment mà không thay đổi status của appointment. Click sẽ show popup Confirmation
    - Title: Confirmation
    - Description: _Do you want to send a message to \[Cusomter name\] notifying about this change?_
    - Button: Don’t Send / Send

2. **Confirm appointment**

- Status appointment: Scheduled
- Đối với những appointment được book từ Web Booking và setting \[You don't need to confirm your online bookings, which means all online bookings from your customers will be automatically confirmed right after they book\] - disable
- Click vào appointment, sẽ show appointment detail và button:
  - Cancel: cancel appointment
  - Save appointment:lưu lại những thay đổi trên appointment mà không thay đổi status của appointment.
  - Confirm: click sẽ show popup confirmation
    - Title: Confirmation
    - Description: _Are you sure to confirm this appointment?_
    - Button:
      - Cancel
      - Accept: click sẽ show message confirm thành công, gửi thông tin đến customer, và có notification trên POS.

3. **Cancel appointment**

- Status appointment: Confirmed / Scheduled
- Click vào appointment, sẽ show appointment detail và button:
  - Confirm (nếu status là Scheduled): để confirm appointment
  - Save appointment:lưu lại những thay đổi trên appointment mà không thay đổi status của appointment.
  - Cancel: click sẽ show popup confirmation
    - Title: Confirmation
    - Description: _Are you sure to cancel this appointment?_
    - Button:
      - Cancel
      - Accept: click sẽ show message cancel thành công, gửi thông tin đến customer, và có notification trên POS.

4. **Checkout Order từ appointment**

- Status appointment: Confirmed
- Click vào appointment, sẽ show appointment detail và button:
  - Cancel: cancel appointment
  - Save appointment:lưu lại những thay đổi trên appointment mà không thay đổi status của appointment.
  - Checkout: click sẽ rediect qua màn hình create order và fill sẵn những thông tin trên appoinment qua order
    - Lúc này trong màn hình create order sẽ show thêm 1 dòng hiển thị thời gian booking: Booking Time: 8:00AM (start time của appointment)
    - Tiến hành tạo order và thanh toán như bình thường
    - Link hết tất cả service/staff có trong appointment qua Order
    - Nếu appointment có nhiều service/staff, click Checkout từ service/staff nào thì cũng link đến cùng 1 order
    - Sau khi order complete:
      - Tự động update status appointment - Done
      - Nếu appointment có nhiều service/staff, thì complete order sẽ update trạng thái Done cho tất cả các record service /staff của apointment đó
      - Không thể update thông tin của appointment nữa > end flow
    - Trên giao diện của Appoitnment sẽ show thêm thông tin: Order ID

## **Một số case đặc biệt**

1. Một appointment đã được checkout, nhưng order chưa Complete, thì khi click lại vào Checkout từ appointment thì sẽ redirect đến đúng order đã được checkout trước đó
2. Một appointment đã được checkout, nhưng order chưa Complete → thực hiện Cancel appoitment:
   - Cancel appointment thành công, status - Canceled
   - Order vẫn không ảnh hưởng
   - Sau đó Complete order:
     - Appointment update status - Done
3. Một appointment đã được checkout, nhưng order chưa Complete → thực hiện Delete Order → Appointment không ảnh hưởng, có thể thực hiện Checkout tiếp tục và tạo ra order mới.
4. Nếu quá thời gian của appointment, nhưng khách k đến, cũng như không checkout order, thì status của appointmentvẫn giữ nguyên không thay đổi, và vẫn cho phép thực hiện các action trên appointment.
5. Những appoitnment được book trước khi bị set Block Time vẫn được action như trên một appointment bình thường.

# **E. Go Check-In integration**

1. **Đã có Appointment_Customer thực hiện link Checkin Today vào Appointment**

- Khi customer đã book Appointment, sau đó đến tiệm và thực hiện Checkin
- Nếu số phone trùng với phone đã book appointment trước đó thì sẽ hiển thị 1 step để customer link thông tin Checkin vào Appointment:
  - **Nếu customer chọn Yes:**
    - Gửi noti đến POS, để confirm customer đã đến tiệm và checkin trên appointment
    - Tạo order cho Appointment trước đó sau khi confirm Checkin có link đến appointment thành công
  - **Order Pending:**
    - HIển thị thông tin customer vừa được checkin trên order
    - Hiển thị tag Checked-in
    - Không link danh sách service/staff từ appointment vào order (order trống)
    - Complete order thì Done Appointment và Completed Checkin Today
  - **Appointment action:** nếu 1 appointment có nhiều staff/service
    - Trên thông tin Appointment gắn thêm tag **Checked in**
    - Checkout: checkout từ staff nào cũng redirect đến order Pending hiện tại
    - Complete Order thì tất cả các record service/staff trên appointment đều Done
    - Cancel:
      - Thực hiện cancel từ GoBooking, nếu chọn staff/service nào thì chỉ Cancel cho Staff Service đó
      - Những staff/service còn lại đều có thể checkout được.

2. **Đã có Appointment_Customer không link Checkin Today vào Appointment**

- Khách thực hiện Checkin thành công → tạo được order Pending không liên quan đến appointment trước đó
- Thông tin của order Pending từ Checkin vẫn như cũ, không link staff/service vào order
- Thông tin của appointment trước đó k bị ảnh hưởng
- Thực hiện Checkout Order từ Appointment sẽ tạo ra 1 order mới hoàn toàn, và link được staff/service vào order sau khi click Checkout

3. **Chưa có Appointment**

- Khách thực hiện Checkin thành công → tạo được order Pending
- Trên giao diện Calendar, sẽ có thêm Walk-in Sidebar, show danh sách khách đã thực hiện checkin trong hôm nay, gồm:
  - Customer Name
  - Customer Phone
  - Thời gian checkin thành công
- Action: support tạo appointment trên thông tin Checkin, bằng cách kéo - thả thông tin checkin vào khung thời gian/staff muốn tạo appointment trên calendar.
- Thông tin trong appointment sẽ bao gồm:
  - Order ID
  - Những thông tin service trên Checkin
  - Appointment status - Confirmed
  - Tag: Checked-in, tag này chỉ show cho những appointment được tạo Checkin
- Vì khi thực hiện checkin thành công đã tạo ra một order, nên thực hiện Checkout thì rediect đến order đã được tạo trước đó.
- Được action trên appointment như bình thường
- Lưu ý: chỉ có case này mới show thông tin Checkin trên Walk-in Sidebar ,

---

_Source: Google Docs — "Book Appointment from POS" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
