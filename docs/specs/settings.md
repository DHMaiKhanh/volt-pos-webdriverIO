---
title: 'Settings'
source: https://linear.app/fastboy/document/settings-6fe2b4cc81a4
linear_id: efc46a16-ceb1-482b-933f-e598888037b1
team: VOLT
updated: 2026-06-11T09:59:56.338Z
---

# Settings

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# \[Volt POS\] POS Setting

# POS_Business Account

## Business Info

### Information

- Business Name: read-only
- Legal Name: read-only
- Phone Number: read-only
- Website: optional
- Address: max 50 characters
- Country: select
- State: select theo country
- City: max 50 characters
- Postal / Zip Code: không validate, lấy theo CRM

Note: trừ những field thông tin read-only được lấy từ page Admin, còn lại là required

### Work Hours

- Configuration of open/close hours for the merchant, set for each day of the week.
- Nếu ngày nào Inactive thì sẽ show là Closed và không show setting time
- Following fields:
  - YES/NO toggle: Active/Inactive
  - Day
  - Open Time (Time picker)
  - Close Time (Time picker)
- **Example:**

  | Active | Day | Open Time | Close Time | | YES/NO | Monday | 08:00 AM | 08:00 PM | | YES/NO | Tuesday | 08:00 AM | 08:00 PM | | YES/NO | Wednesday | 08:00 AM | 08:00 PM |

### Pay Period

## 1\. Start Date là gì?

Là **ngày bắt đầu tính kỳ lương đầu tiên** khi tiệm bắt đầu dùng POS.

- Weekly & Biweekly → cần Start Date.
- Monthly & Custom → không dùng Start Date.

---

# ✅ Các kiểu Pay Period

### **1️⃣ Weekly (7 ngày)**

~~Tính 7 ngày từ Start Date → rồi tiếp tục 7 ngày → 7 ngày. → Tạo thành các kỳ 1, 2, 3… liền nhau.~~  
Chọn Sunday là ngày chốt kì lương, k qtam Start Date

### **2️⃣ Biweekly (14 ngày)**

~~Giống Weekly nhưng dài 14 ngày.~~  
Chọn Sunday là ngày chốt kì lương, k qtam Start Date

### **3️⃣ Monthly (theo tháng)**

Lấy ngày 01 → đến ngày cuối tháng (28/30/31). Không dùng Start Date.

### **4️⃣ Custom (ngày cố định)**

Ví dụ chọn ngày 20 → mỗi tháng ngày 20 chốt lương. Nếu chọn ngày 31 nhưng tháng chỉ có 28 → chốt vào ngày cuối tháng (28/30).

---

# ✅ Cách hệ thống chạy Pay Period

### ✔ Khi kỳ hiện tại kết thúc → **block lại** (không chỉnh nữa).

### ✔ Hệ thống **tự tạo kỳ tiếp theo ngay lập tức**.

### ✔ Không bao giờ bị “hở ngày” giữa 2 kỳ lương.

---

# ✅ Khi bạn đổi setting trong lúc kỳ đang chạy

Nếu đang trong kỳ payroll hiện tại mà bạn:

- đổi setting staff, hoặc
- đổi loại Pay Period (ví dụ Custom → Weekly)

→ POS sẽ hiện popup:

👉 **“Changes will apply to Next Period”** → Và lưu lại log.

---

# ✅ Những phần bị block sau khi qua kỳ payroll

Khi kỳ payroll hiện tại đã kết thúc:

- Không cho chỉnh những setting liên quan, ví dụ: update order, update check…
- Các màn hình như Print Check / Payroll chỉ được chọn những kỳ đã block.

---

# ✅ Compensation liên quan Pay Period

Trong Compensation của staff:

- Luôn đánh dấu ngày cuối kỳ.
- Nếu chỉnh Compensation trong kỳ hiện tại → hỏi: **Apply for This Period hay Next Period?**

---

### Store Branding

- Store Logo: JPG or PNG file no larger than 5MB
- Cover Photo: JPG or PNG file no larger than 5MB

### Store Policies

- Description: You can add your liability policies here so customers will need to agree with it when they check-in or check-out.
- Liability Policies
- Cancellation Policies
- Other Policies

## Passcode (không còn menu này trên Setting)

Admin Passcode

- Admin password cho internal: \[Admin@Admin!\] -> dùng thể thoát ra khỏi app.

# POS_Employees Management

- Staff Role: Owner / Manager / Partner / Staff
- Permission: thêm option- Technician (toggle) - Nếu staff được enable option này thì sẽ là staff được hiển thị trong POS / Booking … để create order/booking.
- Sau khi create merchant sucess, sẽ auto gen Owner code (4 digits) lưu chung với thông tin account của merchant trên page Insight. Sau đó support create staff đầu tiên với:
  - Role: Owner
  - Code: Owner code (4 digits) Mục đích: sau khi có tiệm, thì gửi passcode này cho owner để họ có thể access và tất cả những menu trên app POS và báo họ trước, nếu muốn đổi passcode này thì lên Setting để chủ động đổi trên staff của mình.
- Menu Employees Management gồm những sub menu sau:

1. **Employees**: show list employee của tiệm

**Show theo 2 section:**

- **List staff:**
  - Staff Avatar + Nick Name
  - Staff status: Active / Inactive
  - Search staff: search nick name
  - Filter status staff: All / Active / Inactive - Default filter Active
  - Button: Add New Staff
  - Sort: Created At/Updated At
- **Detail information của staff**: gồm 5 sections
  - **Avatar / Nick Name / Status Staff**
  - **Information tab:**
    - Appointment Staff
    - Profile:
      - First Name
      - Last Name
      - Nick Name
      - Phone
      - Email
      - SSN (Optional)
      - Staff Code
      - Address
      - Countr
      - State
      - City
      - Postal / Zip Code
    - Staff Role:
      - Role: Manager / Partner / Staff
      - Extra Permission: show list extra permission của employee đó
- **Compensation:** gồm 3 types
  - **Commission**
    - Commission Setting
      - For Service: Staff 00% - Owner 00%
      - For Product: Staff 00% - Owner 00%
      - For Gift Card: Staff 00% - Owner 00%
    - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
    - Deduction Per Day: $0.00
    - Card Fee Charge
      - Description: _Do you want to take a small card fee from staff earnings? You can charge a fee on commission and/or tip paid by card._
      - On Staff Commission: 0%
      - On Credit Card Tip: 0%
      - Checkbox: Add credit card tips to staff paycheck
- **Commission + Salary:** gồm 2 setting cho Commission và Salary
  - Salary Setting: input amount
  - Radio:
    - Salary by Period
    - Wage Per Day
    - Wage Per Hour - $0.00
  - Commission Setting
    - For Service: Staff 00% - Owner 00%
    - For Product: Staff 00% - Owner 00%
    - For Gift Card: Staff 00% - Owner 00%
  - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
  - Deduction Per Day: $0.00
  - Card Fee Charge
    - Description: _Do you want to take a small card fee from staff earnings? You can charge a fee on commission and/or tip paid by card._
    - On Staff Commission: 0%
    - On Credit Card Tip: 0%
    - Checkbox: Add credit card tips to staff paycheck
  - Staff Days Off Setting
  - Checkbox: Limit days off for this staff
  - Max days off allowed: 0
  - Days not allowed to be off: Mon / Tue / Wed / Thu / Fri / Sat / Sun
- **Salary**
  - Salary Setting
    - Radio:
      - Salary By Period
      - Wage Per Day
      - Wage Per Hour - $0.00
    - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
    - Deduction Per Day: $0.00
    - Staff Days Off Setting
      - Checkbox: Limit days off for this staff
      - Max days off allowed: 0
      - Days not allowed to be off: Mon / Tue / Wed / Thu / Fri / Sat / Sun
- **Service Skills**
  - Display a list of services grouped by Category (fetched from Setting Service).
  - Each service within a category will have a selection option.
  - Option to select individual services and entire categories.
  - **Example:**
    - **Category 1:**
      - [ ] Service 1
        - [ ] Service 2
- **Work Hours**:
  - Show bookable hours for the staff member, set for each day of the week.
  - Following fields:
    - YES/NO toggle: Active/Inactive
    - Day
    - In Time (Time picker)
    - Out Time (Time picker)

—-------------------------------------------------

### **Add New Staff**

- **Title:** Add New Staff
- **Profile Information**
  - Avatar
  - First Name: required, max 25 character
  - Last Name: required, max 25 character
  - Nick Name: required, max 25 character
  - SSN: number, optional
  - Phone: required, format (xxx) xxx xxxx
  - Email: required, unique
  - Staff Code: required, 4 digits
  - Address: optional
  - Country: optional
  - State: optional
  - City: optional
  - Postal / Zip Code: optional
- Staff Role:
  - Role: dropdown gồm 3 option Manager / Partner / Staff
  - Extra Permission: show list permission không thuộc role đang chọn, để có thể add thêm permission cho employee đó.
    - UI sẽ hiện thị tương tự như bên tab permission, nhưng chỉ hiển thị những permission không thuộc role đang được chọn, nếu chọn lại Role khác thì fetch lại list extra permission tương ứng
- **Color:** show list color để tick chọn
- Button:
  - Create
  - (X)

Sau khi done form create new staff với đầy đủ Information, click Create sẽ show screen Staff Detail để tiến hành setting cho những thông tin ở 3 tab tiếp theo:

- **Compensation:** chỉ được chọn 1 trong 3 setting để apply cho staff
  - **Commission:** trả lương theo hoa hồng trên order staff đã làm được
    - Commission Setting
      - For Service:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
      - For Product:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
      - For Gift Card:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
    - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
      - Pay 1: chọn phần trăm từ list sẵn có từ 10% đến 100%
      - Pay 2: sau khi chọn xong cho Pay 1 thì phần trăm của Pay 2 = 100 - % Pay 1
    - Deduction Per Day: $0.00
    - Card Fee Charge
    - Description: _Do you want to take a small card fee from staff earnings? You can charge a fee on commission and/or tip paid by card._
    - On Staff Commission: input số, 0.00%
    - On Credit Card Tip: input số, 0.00%
    - Checkbox: Add credit card tips to staff paycheck
  - **Commission + Salary:** gồm 2 setting cho Commission và Salary. Lương của staff 1 phần trên hoa hồng order và 1 phần từ lương cứng
    - Salary Setting: nhập số tiền
      - Radio: bắt buộc chọn 1 trong 3 options
        - Salary by Period: trả lương theo kì (vd kì 2 tuần, kì 1 tháng …)
        - Wage Per Day - $0.00: trả lương theo ngày, bao nhiêu $/1d
        - Wage Per Hour - $0.00: trả lương theo giờ, bao nhiêu $/1h
    - Commission Setting: lương theo hoa hồng trên order staff đã làm được
      - For Service:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
      - For Product:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
      - For Gift Card:
        - Staff: chọn phần trăm từ list sẵn có từ 10% đến 100%
        - Owner: sau khi chọn xong cho staff thì phần trăm của Owner = 100 - % Staff
    - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
      - Pay 1: chọn phần trăm từ list sẵn có từ 10% đến 100%
      - Pay 2: sau khi chọn xong cho Pay 1 thì phần trăm của Pay 2 = 100 - % Pay 1
    - Deduction Per Day: $0.00
    - Card Fee Charge
      - Description: _Do you want to take a small card fee from staff earnings? You can charge a fee on commission and/or tip paid by card._
      - On Staff Commission: input số, 0.00%
      - On Credit Card Tip: input số, 0.00%
      - Checkbox: Add credit card tips to staff paycheck
    - Staff Days Off Setting: setting số lượng ngày được off và những ngày không được off cố định của 1 staff1
      - Checkbox - Limit days off for this staff: nếu check thì mới được edit 2 fields bên dưới
      - Max days off allowed: input số ngày
      - Days not allowed to be off: click vào những ngày mà staff không được nghỉ, nếu nghỉ phải trừ những ngày này ra
        - Mon / Tue / Wed / Thu / Fri / Sat / Sun
  - **Salary:** lương cứng theo giờ làm hoặc theo period
    - Salary Setting: nhập số tiền
      - Radio: bắt buộc chọn 1 trong 3 options
        - Salary by Period: trả lương theo kì (vd kì 2 tuần, kì 1 tháng …)
        - Wage Per Day - $0.00: trả lương theo ngày, bao nhiêu $/1d
        - Wage Per Hour - $0.00: trả lương theo giờ, bao nhiêu $/1h
    - Pay 1 - Pay 2 Split: Pay 1 00% - Pay 2 00%
      - Pay 1: chọn phần trăm từ list sẵn có từ 10% đến 100%
      - Pay 2: sau khi chọn xong cho Pay 1 thì phần trăm của Pay 2 = 100 - % Pay 1
    - Deduction Per Day: $0.00
    - Card Fee Charge
      - Description: _Do you want to take a small card fee from staff earnings? You can charge a fee on commission and/or tip paid by card._
      - On Staff Commission: input số, 0.00%
      - On Credit Card Tip: input số, 0.00%
      - Checkbox: Add credit card tips to staff paycheck
- Business flow for Compensation:
  - Không cho phép đóng tất cả option, sẽ luôn có 1 option được chọn mở
  - Mở option nào thì option đó sẽ được chọn
  - Trong quá trình chỉnh sửa, dữ liệu của các option có thể sẽ khác nhau, nếu option đó chưa có dữ liệu đã chỉnh sữa sẽ được reset về default. Note: Sẽ không có trường hợp staff không có compensation.
- **Service Skills**
  - Display a list of services grouped by Category (fetched from Setting Service).
  - Each service within a category will have a selection option.
  - Option to select individual services and entire categories.
  - **Example:**
    - **Category 1:**
      - [ ] Service 1
        - [ ] Service 2
      * ...
- **Work Hours**
  - Show bookable hours for the staff member, set for each day of the week.
  - Following fields:
    - YES/NO toggle: Active/Inactive
    - Day
    - In Time (Time picker)
    - Out Time (Time picker)
  - **Example:**

    | Active | Day | In Time | Out Time | | YES/NO | Monday | 08:00 AM | 08:00 PM | | YES/NO | Tuesday | 08:00 AM | 08:00 PM | | YES/NO | Wednesday | 08:00 AM | 08:00 PM |

—-------------------------------------------------

### **Update Staff**

- Allows updating all information of an existing staff member.
- (Follows the same field structure as "Add New Staff" with pre-filled data.)
- **Buttons:**
  - Cancel
  - Save

—-------------------------------------------------

- **Một số lưu ý khi thực hiện thêm Extra Permission cho employee:**
  - Chỉ Additive → chỉ thêm permisison so với role
  - Không được remove quyền có sẵn của role
  - Logic khi Change Role: Khi update role của Employee:
    - System reset toàn bộ Extra Permission hiện tại
    - Apply permission mặc định của role mới
    - Nếu muốn thêm quyền → user phải assign lại Extra Permission

2. **Role**

- **Xem các role mặc định trong hệ thống**
- **Xem list employee của từng role**
- **Update role cho employee trực tiếp tại page này**
- Một số lưu ý:
  - Permission không edit ở page này
  - Edit sẽ thực hiện ở Permission Page

3. **Permissions**

- **Nguyên tắc Role:**
- Hệ thống chỉ có 4 role mặc định: Owner / Manager / Partner / Staff
- Không được tạo thêm role
- Không được xóa role
- Mỗi Employee bắt buộc phải có đúng 1 Role

## Services & Products

### Service Listing Page

Show 2 sessions:

- **Category:** Displayed in two tabs:
  - **Active:** List of active categories.
    - Category Color
    - Category Name
    - **Action:**
      - Update
    - Button: Add New Category
  - **Inactive:** List of inactive categories.
    - Category Color
    - Category Name
    - **Action:**
      - Update
  - **Button:** Add New Category
- **Service Listing:** Dynamically displays services belonging to the selected Category.
  - Service Name & Description
  - Price
  - Duration
  - Supply Fee
  - Active Status
  - **Action:**
    - Update
  - **Button:** Add New Service
  - Filter status: All / Active / Inactive - Default filter Active

### Add New Category

- **Title:** Create Category
- Fields\*\*:\*\*
  - **Category Information**
    - **Category Name (required):** Unlimited
    - Status: Toggle Active / Inactive - default Active
  - **Category Color:** Default selection of the first color in the available list.
- **Buttons:**
  - Create
  - (X)

### Add New Service

**Add Service :**

- **Title:** Add New Item
- Fields\*\*:\*\*
  - **Item Type**: radio Service - Product
  - **Information:**
    - Name (required): Maximum 50 characters.
    - Category Name: chọn list category đã được tạo trước đó
    - Price: Maximum $9,999,999.99 (validation required).
    - Check box Flexible Pricing: field này để chủ động set price cho service trên order, thay vì set trên setting, nên nếu field này đc check thì Service Price là $0
      - Checked: disable field Service Price
      - Un-check: enable field Service Price
    - Service Duration:
      - Hour: Dropdown with options (1h, 2h, ...).
      - Minute: Dropdown with options (0 min, 5 mins, 10 mins, ...).
    - Supply Fee: Maximum $9,999,999.99 (validation required).
    - Service Description (optional): Maximum 255 characters.
  - **Visibility Setting:** **(PENDING)**
    - Active: Toggle switch, default to "Active" (assuming "Active" means shown).
    - Shown on Web Booking: Toggle switch, default to "Active" (assuming "Active" means shown).
    - Shown on Go Check In: Toggle switch, default to "Active" (assuming "Active" means shown).
    - Shown on Go POS: Toggle switch, default to "Active" (assuming "Active" means shown).
- **Buttons:**
  - Add
  - (X)

**Add Product:**

- **Title:** Add New Item
- Fields\*\*:\*\*
  - **Item Type**: radio Service - Product
  - **Information:**
    - Name (required): Maximum 50 characters.
    - Category Name: chọn list category đã được tạo trước đó
    - Price: Maximum $9,999,999.99 (validation required).
    - Check box Flexible Pricing: field này để chủ động set price cho service trên order, thay vì set trên setting, nên nếu field này đc check thì Service Price là $0
      - Checked: disable field Service Price
      - Un-check: enable field Service Price
    - Service Description (optional): Maximum 255 characters.
    - **Visibility Setting:** **(PENDING)**
      - Active: Toggle switch, default to "Active" (assuming "Active" means shown).
- **Buttons:**
  - Add
  - (X)

### Update Category

- Allows updating all information of an existing category.
- (Follows the same field structure as "Create Category" with pre-filled data.)
- **Buttons:**
  - Update
  - (X)

### Update Service

- Allows updating all information of an existing service.
- (Follows the same field structure as "Add New Service" with pre-filled data.)
- **Buttons:**
  - Update
  - (X)

# POS_Payment & Transactions

## Tipping Settings

Đây là nơi merchant setting tip khi thanh toán 1 payment, phần settings này sẽ được hiển thị ở màn hình customer screen. Chỉ được chọn active 4 items maximum, item nào được chọn thì mới hiển thì ngoài màn hình customer screen.

- **Tip Suggestions:**
  - Set Default % (e.g. 15%, 18%, 20%)
  - Allow Custom Amount
- **Tip Timing:**
  - Before Payment
  - After Payment
- **Tip Payment Methods:** Allow Tips by: Gift Card, Cash, Credit, Other
- **Tip Type**: Percentage and Dollar

Tham khảo UI:

## Cash Discount

- Cash Discount setting
  - Toggle: Enable/Disable
  - Discount Type: % or Fixed Amount ($)
  - Hard setting: Enable - 3%
- Service Fee:
  - Toggle: Enable/Disable
  - Discount Type: % or Fixed Amount ($)
  - Hard setting: Enable - 3%

## Signature Setting

- Requirement: Use radio buttons for each selection option.
- Options:
  - Require Signature:
    - Always require e-signature
    - Require e-signature for amounts over **\[a specified amount\]** _<- Textbox_
    - Always require physical receipt _(disables “When to ask for signature” options)_
  - When ask for signature:
    - Before process payment
    - After payment successfully

## Receipt & Split Check

- Gồm 2 phần: Receipt Setting - Receipt Preview

1. **Receipt Setting:** gồm những setting sau

- Printing Preferences:
  - Requirement: ON/OFF toggle for each selection and description
  - Selections:
    - **Auto-print customer receipt after each order** _Automatically prints the customer receipt immediately after completing an order, skipping the receipt option screen and starting a new order._
    - ~~**Auto-print owner receipt after each order**~~ \~\~ _Automatically prints the owner's receipt immediately after completing an order._\~\~
    - **Auto-print customer receipt after each split check** _Automatically prints the customer receipt after a split check payment is successful, skipping the receipt option screen and moving to the next split check payment._
    - ~~\*\*Auto-print owner receipt after each split check~~\*\* **\~\~_Automatically prints the owner's receipt immediately after a split check payment is completed._**\~\~
    - ~~\*\*Print staff receipt at check-out~~\*\* **\~\~_Prints a receipt for each staff member with completed orders, including their total sales and any tips earned._**\~\~
    - **Auto-print cancel/refund receipts** _Automatically prints a receipt whenever an order is canceled or refunded._
    - **Print separate gift card receipts at check-out** _Automatically prints a separate receipt for each gift card sold, including the last 4 digits of the card number, remaining balance, purchase date, and expiration date._
- Logo & Branding:
  - Business logo or custom image: Receipt image options
    - Use business logo
    - Upload custom image - Choose file
  - Business name
  - Business address
  - Business phone
- Receipt Message:
  - Header text: max 512 characters
  - Footer text: max 512 characters
  - Marketing opt-in prompt: max 512 characters
- Display Options:
  - Cashier name: Employee login POS
  - Order ID
  - Check-in time
  - Customer info
  - Current points
  - Visit Time
  - Group items by staff or guest
  - Items (Services & Products)
  - Subtotal / Total Discount / Tip / Total
  - Show payment method
  - Signature
  - Business note
  - Barcode (print receipts only)

2. **Receipt Preview**

## Cash Drawer

- Enable/Disable Cash Drawer
- Test Drawer Button
- Permission Control: Require Staff Code to Open Drawer or check-out order pay by cash

## Other Setting

- Setting max Price Service & Amount Order
  - Max Price Per Service: default maximum service $1K
  - Max Order Amount: default maximum order $10K
  - Note: nếu nhập vượt quá thì hiện popup “This amount seems unusually high. Please confirm or contact manager."
- Service Fee:
  - Toggle: Enable/Disable
  - Discount Type: % or Fixed Amount ($)
- Tax Setting:
  - Service Tax (%)
  - Product Tax (%)

# POS_Hardware Setting

## Terminal

- Add/Manage Payment Terminal Devices
- Show Device ID and name
- Test Terminal Connection
- Show Terminal Status

## Printer

- Add/Manage Multiple Printers
- Test Printer Button
- Printer Status: Connected / Disconnected

**Last Updated:** 09/09/2025 at 08:24:11 GMT+07:00 **Updater:** @thom_mac (cc @loan_dang @hung_vo @tienpd ) **Design Reference:** Implement the 'READY TO DEV' design.

**Driver Detection:**

- The system must check for a specific printer driver name to determine connectivity.
  - Ensure the target printer driver is named precisely POS-80-Series, as this is the default name provided during the official setup.

**Header Status Indicator:**

- The main application header must display the printer's real-time connection status\*\*. (duration 5000ms)\*\*
- The status logic is as follows:
  - **Show "Connected"**: When the POS-80-Series driver is successfully detected and the printer is responsive.
  - **Show "Disconnected"**: When the POS-80-Series driver is not installed or cannot be found.

**Before Update: Test Printer Button => After Update: Haven't test printer button**

_The current_ Printer Settings _section is incomplete. It needs to be expanded to provide users with more comprehensive information and control._

## Dual Screen Display

- Enable/Disable Dual Screen
- Able upload image for display screen
- Show:
  - Cart info when creating order
  - Enable/Disable num-pad to check-in

# POS_Network Connections

- Wi-Fi / Network Settings
- Show Current Connection Status

# POS_General Setting

## Language Setting

- Language Selector
- Default: English
- Other Options: Vietnamese, etc.

## Software Update

- **Show:**
  - **Current App Version**
  - **Last Update Date/Time**
- **Actions:**
  - Manual Update Button
- **Logs:**
  - Version History
  - Notes / Fixes / Changes

## Appearance Setting

- Show: Theme/Layout
- Action: Select Theme/Layout

# POS_Fastboy Support

- **Show:**
  - Fastboy Support Phone
  - Customer ID
  - Ultraviewer ID

# Conflict Data

| Data Type                             | Critical Level | Conflict Handling                                   |
| ------------------------------------- | -------------- | --------------------------------------------------- |
| Orders ID                             | Critical       | Must resolve immediately before continuing          |
| Payments (Only use Cash)              | Critical       | Must resolve immediately before continuing          |
| Reports                               |                |                                                     |
| (Store income, Staff income, Payroll) | Critical       | Must resolve immediately before continuing          |
| Rewards & Promotion                   | Semi-critical  | Allow continue, but flag conflict and resolve later |
| Customer Info                         |                |                                                     |
| (Phone, email, points.)               | Semi-critical  | Allow continue, but flag conflict and resolve later |
| Settings_Business Setting             |                |                                                     |
| (Store & Account)                     | Semi-critical  | Allow continue, but flag conflict and resolve later |
| Settings_Service & Staff Setting      | Semi-critical  | Allow continue, but flag conflict and resolve later |
| Settings_Device & Integration         | Non-critical   | Can auto-resolve or ignore, minimal impact          |
| Settings_Receipt & Payment            | Non-critical   | Can auto-resolve or ignore, minimal impact          |
| Dual Screen Content                   | Non-critical   | Can auto-resolve or ignore, minimal impact          |

---

_Source: Google Docs — "Settings" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
