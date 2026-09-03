---
title: 'Promotion Management'
source: https://linear.app/fastboy/document/promotion-management-08b531d2158d
linear_id: 2ad922c5-bec5-4165-9283-538ff32acfb1
team: VOLT
updated: 2026-06-11T09:59:28.568Z
---

# Promotion Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Promotion Management Page**

- **Mục tiêu:** Xây dựng một trang quản lý Promotion cho tiệm Nail, cho phép:
- Tạo và quản lý các chương trình khuyến mãi
- Tự động áp dụng vào POS khi phù hợp
- Theo dõi lịch sử sử dụng và doanh thu từ promotion
- **Đối tượng sử dụng:**
- Chủ tiệm (Merchant)
- Admin (hỗ trợ vận hành)
- **Phạm vi:** Page gồm 4 nhóm chính:
- Promotion (giảm giá trực tiếp)
- Rewards (dùng điểm để đổi ưu đãi)
- Reminder (nhắc khách quay lại)
- Birthday (ưu đãi sinh nhật)
- **Tổng quan UI/UX**
- 1 màn hình duy nhất, chia thành 4 tab: Promotion | Rewards | Reminder | Birthday
- Mỗi tab gồm:
  - Danh sách (list view)
  - Filter theo status và thời gian
  - Create / Edit / Duplicate (làm sau)
  - View Usage History

1. **Promotion**

- Mô tả: Giảm giá trực tiếp trên toàn bộ bill
- POS Behavior:
  - Áp dụng cho toàn bộ bill
  - Hiển thị danh sách promotion hợp lệ tại màn hình checkout
  - Không hiển thị nếu không thỏa điều kiện
  - Highlight promotion “tốt nhất” (discount cao nhất) (nếu làm được)
  - Cho phép user chọn 1 promotion trên 1 order
- Rule:
  - Mỗi order chỉ áp dụng 1 promotion
  - Có thể thay đổi trước khi checkout
  - Sau khi checkout: Promotion bị lock
  - Khi reopen order: Không cho thay đổi hoặc thêm promotion mới
- Giao diện: sẽ bao gồm những thông tin sau:

1. **Promotion listing: gồm những thông tin sau**

- Campaign Name: tên promorion
- Offer: giảm giá bao nhiêu % order hay fixed amount
- Target Audience: group customer được apply promotion
- Schedule: thời điểm gửi thông tin promotion cho customer qua sms/email (có thể hiểu là Date Send)
- Valid Period: khoảng thời gian có thể sử dụng promotion
- Action: Update
- Button: Add New
- Filter:
  - Status: Active/Expired. Default Active
  - Campaign Name
- Sort: default desc theo Schedule

2. **Promotion Detail:** sau khi click vào một promotion, sẽ show những thông tin sau

- Campaign Name
- Campaign Info:
  - Offer
  - Created: Thời gian tạo promotion này
  - Valid Period: Khoảng thời gian áp dụng promotion này.
  - Send To: list customer group - Group khách hàng nhận được tin nhắn
- Performance:
  - Total Delivery: Email / SMS / Total - Tổng số lượng SMS và Email đã gửi
  - Redemption: số tiền promotion đã được apply vào tất cả order, quy ra số tiền
  - Conversion Rate (%) = Total Delivery / Redemption \* 100
    - Tỉ lệ sử dụng chiếm bao nhiêu % trên tổng income của tất cả order
  - Income: Tổng số tiền khách trả của những orders có redeem promotion này
  - Redemption amount: Tổng số tiền đã giảm
- Customers Who Used This Offer - danh sách customer đã sử dụng promotion
  - #: số thứ tự
  - Name: customer name
  - Phone: customer phone
  - Used Total: số lượng promotion mà customer này đã sử dụng
  - Income: Tổng số tiền khách đã trả của những orders có redeem promotion này
  - Redemption amount: Tổng số tiền khách đã được giảm

3. **Add New Promotion:** click sẽ mở dialog

- Title: Add New Campaign
- **Campaign Type**: Promotion | Rewards | Reminder | Birthday > chọn Promotion thì sẽ show list action bên dưới
- **Campaign Detail:**
  - Campaign Name: max 50 characters
  - What do you want to offer? - phần trăm trên tổng order hoặc fixed amount sẽ được apply cho order
    - Nhập số %
    - Nhập amount
  - Message to show customer: field nhập nội dung của campain, max 80 characters.
  - Reply STOP to opt out: checkbox
    - Check:
      - Show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo promotion này về số phone nữa
    - Uncheck:
      - Không show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo promotion này về số phone nữa ????
  - Valid: MM/DD/YYYY: checkbox
    - Check: Show thêm text “Valid: MM/DD/YYYY” trong Message to show customer. Ngày này lấy từ End Date của field **How long to offer?**
    - Uncheck: không show thêm text “Valid: MM/DD/YYYY” trong Message to show customer
- **Usage Limit:** Toggle - Promotion for one time use only
  - Enable: 1 customer chỉ được sử dụng promotion này 1 lần
  - Disable: 1 customer có thể dùng promotion này nhiều lần cho nhiều order, 1 order chỉ apply 1 promotion.
- **Who to Send To:**
  - Checkbox option
  - Tất cả các group customer đang có trong hệ thống. Và 1 option All để chọn tất cả
- **Campaign Schedule**
  - How long to offer? - Khoảng thời gian có hiệu lực sử dụng promotion
    - Start Date
    - End Date
  - When to send? - Thời điểm gửi thông tin promotion này ra cho customer
    - Date
    - Time:
      - Chỉ cho phép chọn từ 8:00 đến 20:00 để gửi
      - Description:
        - _Submission time must be between 8:00 and 20:00_
        - _TCPA Compliance Notice : Promotional SMS messages are legally restricted under the Telephone Consumer Protection Act (TCPA). Messages may only be sent between 8:00 AM – 8:00 PM (recipient’s local time). Sending messages outside this window may result in legal penalties of $500–$1,500 per message, and Fastboy is not responsible for violations caused by user action._
    - Sent Immediately: checkbox
      - Send ngay lập tức sau khi tạo promotion thành công
      - Nếu chọn option này thì disable 2 fields Date - Time, k cần chọn nữa
- **Test & Finalize**: test trước nội dung gửi ra cho customer
  - Phone number
    - Field nhập số phone, placeholder: _Enter phone number for test_
    - Button: Test Now
  - Email
    - Field nhập email, placeholder: _Enter email for test_
    - Button: Test Now
- Button:
  - Add: tạo promotion
  - (X): thoát khỏi form tạo promotion
- Một số lưu ý:
  - Không cho phép chọn **How long to offer?** thuộc thời điểm trong quá khứ
  - Không cho phép chọn **When to send?** thuộc thời điểm trong quá khứ và sau thời gian End Date của promotion

4. **Update Promotion**

- Chỉ được update promotion nếu promotion chưa đến thời gian schedual và chưa gửi thông tin ra cho Customer
- Nếu Promotion đã chạy, disable Save button và view only
- Nếu thỏa điều kiện được update, thì cho phép update tất cả các thông tin của promotion
- Promotion đã expired thì không sử dụng được nữa và không cho phép update lại

2. **Rewards**

- Mô tả: một dạng promotion, được sử dụng bằng cách đổi điểm tích lũy của khách hàng.
- Cơ chế tích điểm:
  - Sau khi order hoàn thành
  - Mặc định: $1 = 1 point (có thể cấu hình)
- POS Behavior:
  - Cho phép chọn 1 reward
  - Trừ điểm realtime khi checkout
- Rule:
  - Mỗi order chỉ áp dụng 1 reward
  - Không hoàn lại point khi refund
  - Không rollback điểm đã trừ
- Giao diện: sẽ bao gồm những thông tin sau:

1. **Rewards listing: gồm những thông tin sau**

- Reward Content: tên của reward
- Status: Active / Inactive
- Point: số điểm dùng để chuyển đổi
- Discount Value: số % hoặc fixed amount được apply khi đổi từ số point
- Action:
  - Update
- Lưu ý: Reward không có start date / end date, chỉ cần thỏa điều kiện point là có thể sử dụng

2. **Rewards Detail**

Gồm những thông tin sau:

3. **Update Rewards**

- Cho phép update reward thoải mái. Không phụ thuộc điều kiện gì. Update thì phải lưu lại log
- Không cho phép Delete, nếu k sử dụng nữa thì Inactive

4. **Add New Rewards**

- Title: Add New Campaign
- Campaign Type: Promotion | Rewards | Reminder | Birthday > chọn Rewards thì sẽ show list action bên dưới
- Reward name: input, max 50 characters
- What is the value of offer?
  - Theo %
  - Theo fixed amount $
- Point: nhập số điểm để đổi sang discount
- Status: default là Active
- Button:
  - Add: tạo reaward
  - (X): thoát khỏi form tạo reaward

3. **Reminder**

- Mô tả: Gửi thông báo nhắc khách quay lại nếu không phát sinh giao dịch sau một khoảng thời gian.
- Rule:
  - Chỉ gửi 1 lần khi thỏa điều kiện
  - Không gửi lại
  - Không reset sau khi gửi
- Giao diện: sẽ bao gồm những thông tin sau:

1. **Reminder listing: gồm những thông tin sau**

- Campaign Name: tên reminder
- Offer: giảm giá bao nhiêu % order hay fixed amount
- Target Audience: group customer được apply reminder
- Schedule: thời điểm gửi thông tin remindercho customer qua sms/email (có thể hiểu là Date Send)
  - Date sẽ được quy ra từ setting **Send to customers who haven’t visited for,** \[**Current Date - Last Visit Date**\] = ngày được setting
  - Time: default 09:00AM
- Valid Period:
  - Khoảng thời gian có thể sử dụng reminder
  - Lấy tử setting: **How long should this reminder be valid?**
- Action: Update
- Button: Add New
- Filter:
  - Status: Active/Inactive. Default Active
  - Campaign Name
- Sort: default desc theo Schedule

2. **Reminder Detail:** sau khi click vào một reminder, sẽ show những thông tin sau

- Campaign Name
- Campaign Info:
  - Offer
  - Created: Thời gian tạo promotion này
  - Valid Period: Khoảng thời gian áp dụng promotion này.
  - Send To: list customer group - Group khách hàng nhận được tin nhắn
- Performance:
  - Total Delivery: Email / SMS / Total - Tổng số lượng SMS và Email đã gửi
  - Redemption: số tiền promotion đã được apply vào tất cả order, quy ra số tiền
  - Conversion Rate (%) = Total Delivery / Redemption \* 100
    - Tỉ lệ sử dụng chiếm bao nhiêu % trên tổng income của tất cả order
  - Income: Tổng số tiền khách trả của những orders có redeem promotion này
  - Redemption amount: Tổng số tiền đã giảm
- Customers Who Used This Offer - danh sách customer đã sử dụng promotion
  - #: số thứ tự
  - Name: customer name
  - Phone: customer phone
  - Used Total: số lượng promotion mà customer này đã sử dụng
  - Income: Tổng số tiền khách đã trả của những orders có redeem promotion này
- Redemption amount: Tổng số tiền khách đã được giảm

3. **Add New Reminder:** click sẽ mở dialog

- Title: Add New Campaign
- **Campaign Type**: Promotion | Rewards | Reminder | Birthday > chọn Reminder thì sẽ show list action bên dưới
- **Campaign Detail:**
  - Campaign Name: max 50 characters
  - What do you want to offer? - phần trăm trên tổng order hoặc fixed amount sẽ được apply cho order
    - Nhập số %
    - Nhập amount
  - Message to show customer: field nhập nội dung của campaign, max 80 characters.
  - Reply STOP to opt out: checkbox
    - Check:
      - Show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo reminder này về số phone nữa
    - Uncheck:
      - Không show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo reminder này về số phone nữa ????
  - Valid: MM/DD/YYYY: checkbox
    - Check:
      - Show thêm text “Valid: MM/DD/YYYY” trong Message to show customer.
      - Ngày này được quy ra từ **How long should this reminder be valid?** setting, lấy ngày cuối cùng
    - Uncheck: không show thêm text “Valid: MM/DD/YYYY” trong Message to show customer
- **Usage Limit:** Toggle - Promotion for one time use only
  - Enable: 1 customer chỉ được sử dụng promotion này 1 lần
  - Disable: 1 customer có thể dùng promotion này nhiều lần cho nhiều order, 1 order chỉ apply 1 promotion.
- **Who to Send To:**
  - Checkbox option
  - Tất cả các group customer đang có trong hệ thống. Và 1 option All để chọn tất cả
- **Campaign Schedule**
  - Send to customers who haven’t visited for
    - Sẽ gửi thông tin promotion cho customer nếu số ngày mà customer đã không quay lại tiệm đúng bằng số ngày được setting, tính từ lần visit cuối cùng: \[**Current Date - Last Visit Date**\] = ngày được setting
    - Input: number (days)
  - How long should this reminder be valid?
    - Số ngày có thể sử dụng promotion này, kể từ ngày gửi thông tin promotion (reminder) cho customer.
    - Input: number (days)
- **Test & Finalize**: test trước nội dung gửi ra cho customer
  - Phone number
    - Field nhập số phone, placeholder: _Enter phone number for test_
    - Button: Test Now
  - Email
    - Field nhập email, placeholder: _Enter email for test_
    - Button: Test Now
- Button:
  - Add: tạo reminder
  - (X): thoát khỏi form tạo reminder

4. **Update Reminder**

- Reminder sẽ tương tự như Reward, sẽ k có Start Date và End Date, nên sẽ cho upadte thông tin của reminder thoải mái, không ràng buộc điều kiện
- Được update tất cả thông tin trong reminder.
- Đối với những customer đã được gửi reminder rồi, sau đó update lại reminder và customer đó vẫn thỏa điều kiện thì sẽ gửi tiếp tục cho customer.
- Không cho phép Delete, nếu k sử dụng nữa thì Inactive

4. **Birthday**

- Mô tả: Tự động gửi ưu đãi vào dịp sinh nhật khách hàng.
- Logic:
  - Gửi trước sinh nhật X ngày
  - Promotion có hiệu lực trong X ngày sau sinh nhật
- Rule:
  - Tự động gửi
  - Bỏ qua nếu customer không có ngày sinh
- Giao diện: sẽ bao gồm những thông tin sau

1. **Birthday listing: gồm những thông tin sau**

- Campaign Name: tên birthday compaign
- Offer: giảm giá bao nhiêu % order hay fixed amount
- Target Audience: group customer được apply birthday compaign
- Schedule:
  - Thời điểm gửi thông tin birthday compaign cho customer qua sms/email (có thể hiểu là Date Send)
  - Date sẽ được quy ra từ **Send this promotion before birthday** setting
  - Time: default 09:00AM
- Valid Period:
  - Khoảng thời gian có thể sử dụng birthday compaign.
  - Phụ thuộc vào **Promotion valid how long after birthday?** setting
- Action: Update
- Button: Add New
- Filter:
  - Status: Active/Inactive. Default Active
  - Campaign Name
- Sort: default desc theo Schedule

2. **Birthday Detail:** sau khi click vào một birthday compaign, sẽ show những thông tin sau

- Campaign Name
- Campaign Info:
  - Offer
  - Created: Thời gian tạo promotion này
  - Valid Period: Khoảng thời gian áp dụng promotion này.
  - Send To: list customer group - Group khách hàng nhận được tin nhắn
- Performance:
  - Total Delivery: Email / SMS / Total - Tổng số lượng SMS và Email đã gửi
  - Redemption: số tiền promotion đã được apply vào tất cả order, quy ra số tiền
  - Conversion Rate (%) = Total Delivery / Redemption \* 100
    - Tỉ lệ sử dụng chiếm bao nhiêu % trên tổng income của tất cả order
  - Income: Tổng số tiền khách trả của những orders có redeem promotion này
  - Redemption amount: Tổng số tiền đã giảm
- Customers Who Used This Offer - danh sách customer đã sử dụng promotion
  - #: số thứ tự
  - Name: customer name
  - Phone: customer phone
  - Used Total: số lượng promotion mà customer này đã sử dụng
  - Income: Tổng số tiền khách đã trả của những orders có redeem promotion này
  - Redemption amount: Tổng số tiền khách đã được giảm

3. **Add New Birthday:** click sẽ mở dialog

- Title: Add New Campaign
- **Campaign Type**: Promotion | Rewards | Reminder | Birthday > chọn Birthday thì sẽ show list action bên dưới
- **Campaign Detail:**
  - Campaign Name: max 50 characters
  - What do you want to offer? - phần trăm trên tổng order hoặc fixed amount sẽ được apply cho order
    - Nhập số %
    - Nhập amount
  - Message to show customer: field nhập nội dung của campaign, max 80 characters.
  - Reply STOP to opt out: checkbox
    - Check:
      - Show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo reminder này về số phone nữa
    - Uncheck:
      - Không show thêm text “Reply STOP to opt out” trong Message to show customer.
      - Khách hàng có thể nhắn “STOP” để không nhận tin nhắn quảng cáo reminder này về số phone nữa ????
  - Valid: MM/DD/YYYY: checkbox
    - Check:
      - Show thêm text “Valid: MM/DD/YYYY” trong Message to show customer.
      - Ngày này sẽ được quy ra từ filed **Promotion valid how long after birthday?** của mỗi customer, lấy ngày cuối cùng.
    - Uncheck: không show thêm text “Valid: MM/DD/YYYY” trong Message to show customer
- **Usage Limit:** Toggle - Promotion for one time use only
  - Enable: 1 customer chỉ được sử dụng promotion này 1 lần
  - Disable: 1 customer có thể dùng promotion này nhiều lần cho nhiều order, 1 order chỉ apply 1 promotion.
- **Who to Send To:**
  - Checkbox option
  - Tất cả các group customer đang có trong hệ thống. Và 1 option All để chọn tất cả
- **Campaign Schedule**
  - Send this promotion before birthday
    - Sẽ gửi thông tin birthday compaign cho customer trước ngày sinh nhật của customer x days
    - Input: number (days)
  - Promotion valid how long after birthday?
    - Số ngày có thể sử dụng birthday compaign này, kể từ ngày gửi thông tin promotion (birthday compaign) cho customer.
    - Input: number (days)
- **Test & Finalize**: test trước nội dung gửi ra cho customer
  - Phone number
    - Field nhập số phone, placeholder: _Enter phone number for test_
    - Button: Test Now
  - Email
    - Field nhập email, placeholder: _Enter email for test_
    - Button: Test Now
- Button:
  - Add: tạo reminder
  - (X): thoát khỏi form tạo reminder

4. **Update Birthday**

- Birthday campaign sẽ tương tự như Reward, sẽ k có Start Date và End Date, nên sẽ cho upadte thông tin của birthday campaign thoải mái, không ràng buộc điều kiện
- Được update tất cả thông tin trong birthday campaign.
- Đối với những customer đã được gửi birthday campaign rồi, sau đó update lại birthday campaign và customer đó vẫn thỏa điều kiện thì sẽ gửi tiếp tục cho customer.
- Không cho phép Delete, nếu k sử dụng nữa thì Inactive

---

_Source: Google Docs — "Promotion Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
