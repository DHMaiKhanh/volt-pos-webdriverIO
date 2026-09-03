---
title: 'Time Keeping'
source: https://linear.app/fastboy/document/time-keeping-e0f3efd072d0
linear_id: 65af5d69-4a4e-4e33-bc0d-c4fe7d4ef102
team: VOLT
updated: 2026-06-11T09:59:52.399Z
---

# Time Keeping

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

1. **Time Keeping**

## **1. Mục đích**

- Ghi nhận thời gian làm việc thực tế của nhân viên (Check-In / Check-Out).
- Dùng dữ liệu này để:
  - Giờ làm việc (Working Hours)
  - Tính Tip / Commission / Payroll
  - Tính giờ làm – lương (Salary per hour)
  - Quản lý ca làm (shift) và attendance (đi trễ / về sớm).
- Menu nằm chung với home

## **2. Tích hợp với các module**

- **Payroll** (tính lương): Lấy dữ liệu giờ làm × rate (lương/giờ) để tính tổng lương cho staff.
- **Staff Report**: Hiển thị tổng giờ, doanh thu, tip, commission trong ngày/tuần/tháng.
- **Permission:** chỉ user có permission mới được view và action trên Time Keeping management của tiệm

## 3\. **Workflow**

1. **Check-In**
   - Khi nhân viên đến tiệm → mở POS → chọn “Check In”.
   - Hệ thống lưu lại:
     - Giờ Check-In (Local Time)
     - Nickname staff

(Nếu POS có **Dual Screen**, có thể cho phép nhân viên nhập mã staff code hoặc quét mã QR để Check-In > Optional)

2. **Check-Out**
   - Khi kết thúc ca làm, nhân viên chọn “Check Out”.
   - Hệ thống lưu lại:
     - Giờ Check-Out (Local Time)
     - Tổng thời gian làm việc (Total Hours = Check-Out – Check-In)
     - Chưa Check-In thì không Check-Out được
3. **Auto Check-Out**
   - Nếu nhân viên **q**uên Check-Out, hệ thống có thể:
     - Tự động Check-Out lúc 23:59:59 (Local Time)
     - Owner có quyền chỉnh sửa ca làm thủ công.
4. Một số lưu ý
   - Nếu quên Check-Out, ca đó không được tính cho đến khi Owner xác nhận hoặc auto Checkout vào lúc **23:59:59 cùng ngày**
   - Có checkin thì được tính là ngày đó có đi làm.
   - Dual Screen Support: Cho phép nhân viên Check-In/Out trên màn hình khách > optional, support sau
   - Không block create order với những staff không Check-Out – Check-In, vì có staff tính lương theo Commission
   - Offline Mode: Nếu POS offline, vẫn lưu local và sync lại khi có mạng
5. **Các TH không cho phép update thời gian CHECK-IN/CHECK-OUT của staff:**
   - Đã khóa kỳ Payroll (Payroll Locked): Nếu Timekeeping nằm trong kỳ lương đã được locked, không được phép chỉnh sửa.
   - Không có permission.

## **4. Giao diện Check in / Check out Staff**

- Chỉ hiển thị list Staff - Active
- Gồm những field thông tin sau:
  - Unavailable Staff:
    - Staff nickname
    - Staff avatar
    - OUT date gần nhất: thời gian checkout trước đó
    - Sắp xếp theo staff nickname alphabet
  - Available Staff
    - Staff nickname
    - Staff avatar
    - IN date: thời gian thực hiện checkin
    - Sắp xếp theo thời gian checkin, user checkin mới nhất nằm trên cùng
- Action:
  - Click chọn staff ở tab Unavailable Staff để thực hiện Check In
  - Click chọn staff ở tab Available Staff để thực hiện Check Out

---

2. **Time Tracking**

- Thông tin staff sau khi thực hiện Check-In Check-Out sẽ được quản lý trong Time Keeping management
- Edit Time Keeping: Chỉ Owner có quyền:
  - Chỉnh sửa giờ Check-In / Check-Out (khi nhân viên quên thao tác)
  - Lý do chỉnh sửa cần được ghi lại (log).
- Vị trí: là 1 tab nằm trong home, dưới Time Keeping

1. **Time Keeping listing gồm những thông tin sau:**
   - Staff nickname
   - Date IN: format \[mm/dd/yyyy hh:mm AM/PM\]
   - Date OUT: format \[mm/dd/yyyy hh:mm AM/PM\]
   - Total Hours (= CheckOut – CheckIn): tính ra theo đơn vị giờ
   - Created At: thời gian staff thực hiện checkin hoặc thời gian owner add time keeping
   - Updated At: thời gian update time keeping trong Time Keeping management gần nhất
   - Action:
     - Edit: Update time keeping của staff
     - Delete: xóa time keeping của staff
   - Filter date range: Date IN - Date OUT
   - Search: staff nickname
   - Button action:
     - Add: add new time keeping cho staff chưa thực hiện Checkin
     - Export (later)

Note:

- Trong page này hiển thị tất cả Staff, kể cả Inactive
- Vẫn cho phép action trên những record time tracking của inactive staff nếu không rơi vào kì payroll đã locking.

2. **Action Add: mở modal add new time keeping với những thông tin sau**
   - Title: Add new time keeping
   - Staff: (required) staff listing - status Active
   - Date IN: (required) format \[mm/dd/yyyy hh:mm AM/PM\]
   - Date OUT: (optional) format \[mm/dd/yyyy hh:mm AM/PM\]
   - Note: (optional) max 255 characters
   - Button:
     - Submit
     - Cancel
3. **Action Edit: mở modal edit new time keeping với những thông tin có thể được update như sau**
   - Title: Edit time keeping
   - Staff: staff nickname - Disable, không được update
   - Date IN: format \[mm/dd/yyyy hh:mm AM/PM\]
   - Date OUT: format \[mm/dd/yyyy hh:mm AM/PM\]
   - Note: max 255 characters
   - Button:
     - Submit
     - Cancel
4. **Action Delete: remove time keeping khỏi hệ thống**
   - Title: Delete Timekeeping Record
   - Description: _Are you sure you want to delete this time record of_ **Staff: {Staff Nickname}**_?_ _This action cannot be undone._
   - Button:
     - Delete
     - Cancel
   - Lưu ý:
     - Không cho phép delete nếu time keeping này thuộc Payroll locked
     - Show message: _This record cannot be deleted because it’s included in locked payroll._

   _!\[\]\[image2\]_

5. **Một số lưu ý:**

- Một nhân viên chỉ có 1 ca đang mở (Check-In): Không được Check-In lần nữa nếu chưa Check-Out ca trước
- Cho phép 1 staff Check-In / Check-Out nhiều lần trong 1 ngày (staff làm nhiều ca). Nhưng không được trùng thời gian trước đó (chỉ xảy ra khi owner add new time keeping manual cho staff)
- Không cho phép Check-In / Check-Out là 2 ngày khác nhau
- Log: Mọi thay đổi thời gian phải có log (ai chỉnh, lúc nào, note)

---

_Source: Google Docs — "Time Keeping" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
