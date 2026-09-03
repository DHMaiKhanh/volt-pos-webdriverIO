---
title: 'Staff Management'
source: https://linear.app/fastboy/document/staff-management-e01aa8aef908
linear_id: 5b8b466a-c274-4948-814b-aa4e03c4fa86
team: VOLT
updated: 2026-06-11T09:59:44.778Z
---

# Staff Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# VOLT POS — Staff Management Portal Module [Settings](https://linear.app/fastboy/document/settings-6fe2b4cc81a4)

## Overview

Central HR management system for Business Owners and Managers to configure employee data and sync to POS devices.

---

## Module Scope

| Section             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| Staff Directory     | List/grid view of all employees with search, filter, sort |
| Staff Detail Form   | 5-tab form for complete employee configuration            |
| Timekeeping         | Check-in/out tracking via staff code                      |
| Payroll Config      | Period management with lock/unlock functionality          |
| Staff Income Report | Commission + Tips + Salary − Deductions breakdown         |

## Staff Directory

**Features:**

- Search by: Name, nickname, email
- Filter by: All / Active (default) / Inactive
- Sort by: Created At, Updated At

Đây là nội dung mô tả tính năng "Import, Export Staff" (Nhập/Xuất Dữ liệu Nhân viên) mà bạn có thể thêm vào tài liệu:-----**Import/Export Staff (Nhập/Xuất Dữ liệu Nhân viên)**

Tính năng này được thêm vào trang quản lý (có thể là Management Page/Insight) để hỗ trợ việc quản lý và cập nhật dữ liệu nhân viên một cách hàng loạt.

- **Import Staff (Nhập Nhân viên):**
  - Cho phép người dùng tải lên một tập tin (CSV) để nhập thông tin nhân viên mới hoặc cập nhật thông tin nhân viên hiện có.
  - Cần có một template (mẫu) file nhập chuẩn để đảm bảo dữ liệu hợp lệ.
  - Các trường dữ liệu chính bao gồm: Nickname, first name, last name, Số điện thoại (Phone), Email, staff code, Trạng thái (Status - Active/Inactive),...
- **Export Staff (Xuất Nhân viên):**
  - Cho phép người dùng tải về một tập tin (CSV) chứa thông tin chi tiết của toàn bộ nhân viên.
  - Dữ liệu xuất có thể được sử dụng để backup hoặc thực hiện chỉnh sửa hàng loạt trước khi nhập lại (re-import) vào hệ thống.
  - File xuất ra bao gồm tất cả các thông tin chi tiết của nhân viên có trong hệ thống.

**Per-row actions:**

- View / Edit Staff
- Activate / Deactivate
- Toggle Technician ON/OFF

---

## Staff Detail Form (5 Tabs)

### Tab 1: Profile Information

| Field         | Rules                                 |
| ------------- | ------------------------------------- |
| Avatar        | JPG/PNG ≤5MB                          |
| First Name    | Required, max 25 chars                |
| Last Name     | Required, max 25 chars                |
| Nick Name     | Required, unique                      |
| Staff Code    | Required, 4 digits, unique (auth key) |
| Phone         | Required                              |
| Email         | Required, unique                      |
| SSN           | Optional                              |
| Display Color | Required                              |

### Tab 2: Role & Permissions

**Gồm 2 phần:**

- **Fixed Roles:** Owner, Manager, Partner, Staff
- Show dạng dropdown gồm 3 option Manager / Partner / Staff

| Permission               | Owner | Manager | Partner | Staff |
| ------------------------ | ----- | ------- | ------- | ----- |
| Turn Management          | ✓     | ✓       | ✓       | ✓     |
| View Income              | ✓     | ✓       | ✓       | ✓     |
| Staff Daily Income       | ✓     | ✓       | ✓       | —     |
| Payroll Access           | ✓     | ✓       | ✓       | —     |
| Batch Close / History    | ✓     | ✓       | —       | —     |
| Void / Refund (Critical) | ✓     | —       | —       | —     |
| Cash Drawer              | ✓     | ✓       | —       | —     |

- **Extra Permission:**
  - **Extra Permission: show list permission không thuộc role đang chọn, để có thể add thêm permission cho employee đó.**
  - **UI sẽ hiện thị tương tự như bên tab permission, nhưng chỉ hiển thị những permission không thuộc role đang được chọn, nếu chọn lại Role khác thì fetch lại list extra permission tương ứng**
  - Riêng đối với page Admin, tất cả đều phải lưu log, cũng như lưu log khi có sự thay đổi từ POS, sau đó sync lên page Admin.
    - Ví dụ log:
      - Employee: John
      - Role: Staff → Manager
      - Extra Permission Added: Refund
      - Source: POS / POS Admin
      - Created By / Updated By: user (name / email)
      - Created At / Updated At : 14:22 03/16/2026

### Tab 3: Compensation Configuration

**Model A — Commission Only**

- Service Commission %
- Product Commission %
- Gift Card Commission %

**Model B — Salary Only**

- Amount ($)
- Type: Per Hour / Per Day / Per Period

**Model C — Commission + Salary**

- Combination of above

**Sub-settings:**

- Paycheck Split (toggle)
- Deduction Per Day ($)
- Card Fee Charge (toggle)
- Tips on Check (default: ON)
- Days Off Limit

### Tab 4: Service Skills

- Checkbox tree: Category → Services
- Maps which services staff can perform

### Tab 5: Work Hours

- Weekly schedule per staff
- Per day: Active toggle, In Time, Out Time

---

## Staff Status Rules

| Status   | Login POS | Check-in/out | Assign Orders |
| -------- | --------- | ------------ | ------------- |
| Active   | ✓         | ✓            | ✓             |
| Inactive | ✗         | ✗            | ✗             |

**Technician Toggle:** Stored status; blocking rules in future phase.

---

## Timekeeping Module

- Check-in/out via 4-digit Staff Code
- No break/lunch tracking
- Owner can edit logs (if payroll not locked)
- View logs by date

---

## Employee Management

1. **Employee List**

View All Employees: A list of all employees (technicians, receptionists, etc.) in the salon.  
Location: This is the main screen when the user clicks on Employee Management from the left sidebar.

- Search Bar (at the top left of the list): Allows quick searching by employee name or role
- Add Button (at the top right of the list): Create a new staff member profile, enter details, assign a role, and set initial permissions.
- Import button: dùng để insert staff hàng loạt cho tiệm, thay vì add từng staff
  - Template import: [https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=1010353810#gid=1010353810](https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=1010353810#gid=1010353810)
- Filter (At the top of the list):
  - Employee Status (Active/Inactive)
  - Employee Role
- Table/Grid Layout: A clean grid or table layout to display the staff members with relevant information and actions.

| Employee Name |     | Role    | Status   | Phone Number | Email                                         | Actions |
| ------------- | --- | ------- | -------- | ------------ | --------------------------------------------- | ------- |
| Jane Doe      |     | Owner   | Active   | 123 456 7891 | [jane@example.com](mailto:jane@example.com)   | Edit    |
| John Smith    |     | Manager | Inactive | 123 456 7891 | [john@example.com](mailto:john@example.com)   | Edit    |
| Mary Johnson  |     | Staff   | Active   | 123 456 7891 | [marry@example.com](mailto:marry@example.com) | Edit    |

**Employee Info Columns:**

- Employee Name: Displays the name of the employee
- Role: Shows the employee's role
- Status: Indicates whether the employee is active or inactive (with an Active/Inactive toggle).
- Phone Number: Contact number for the employee.
- Email: Email address for communication.

**Actions**:

- Edit: Opens the profile to modify details (e.g., name, role, …).
- Change status Employee: Mark employees as inactive in their profiles when they leave.

2. **Employee Profile Detail**

Each employee will have a profile where all details are stored. For nail salons, the profile typically includes:  
**Profile Information:**

- Active/Inactive Toggle: Quickly change an employee's status (e.g., active if working or inactive if on leave).
- Appointment Staff Toggle: Marks whether an employee is available to handle customer appointments.
- First Name, Last Name, Nickname (for internal use or customer-facing).
- Phone Number, Email, Address (contact details for communication or scheduling).
- Staff Code: A unique identifier for each employee in the system.
- Role: Owner, Manager, Partner, Staff
- SSN (optional): For payroll purposes.
- Permission: toggle
  - Summary Income
  - Staff Payroll
  - Cancel Order
  - Open Cash Drawer
  - Daily Income
  - Batch History
  - Refund Order
  - Staff Income
  - Edit Order

**Compensation:**

- Commission
- Salary
- Commission + Salary

**Service Skills:** show full list service ở dạng checkbox  
**Work Hours:** Shift Availability: Indicate the days and hours the employee is available to work.  
**Actions:**

- Edit: Opens the profile to modify details (e.g., name, role, payroll).
- Remove: Option to remove the employee from the system (with confirmation).

3. **Add/Edit/View Employee Profile (Modal or New Screen)**

Location: This is opened when you Edit an employee from the list or Add a new employee.  
Form Fields for Employee Profile:

**Profile Information Section (on top):**

- Status Section (below role): Active/Inactive Toggle: A switch to mark employees as active (working) or inactive (on leave or terminated).
- Appointment Staff Toggle: Toggle to enable/disable the employee’s ability to take appointments.
- First Name, Last Name, Nickname (optional).
- Phone, Email, Address (contact information).
- Role: Dropdown to select the employee’s role
- Staff Code: Unique identifier for internal tracking
- SSN (optional): For payroll and tax purposes.
- Permissions Section (below status): A list of permissions that can be toggled for each employee based on their role:
- Access Summary Income: Toggle to give access to overall income reports.
- View Daily Income: Toggle for daily sales or tips reports.
- Access Staff Payroll: Enable or disable access to payroll info.
- Void/Refund/Cancel Orders: Allow certain staff to modify or cancel orders.
- Access Client Information: Toggle for receptionists or managers to access client booking details.
- Shift Management: Permission for scheduling shifts and tracking attendance.
- Open Cash Drawer: Permission for cashiers or front desk staff to open the drawer.  
  Note: Each toggle has a label for clarity and ease of understanding.

**Compensation:** show UI giống như POS, chọn option nào thì config cho option đó

- Commission
- Salary
- Commission + Salary

!\[\]\[image11\]  
**Service Skills:** show full list service ở dạng checkbox, show UI giống như POS  
!\[\]\[image12\]

**Work Hours:** Shift Availability: Indicate the days and hours the employee is available to work. Show UI giống như POS  
!\[\]\[image13\]  
**Buttons**:

- Save: Save the employee’s profile and return to the employee list.
- Cancel: Discard changes and return to the employee list.

4. **Import Staff**

**4.1. Objective**

Cho phép user import hàng loạt Staff (Employee) vào POS Portal thông qua file Excel, bao gồm:

- Thông tin nhân viên
- Role
- Trạng thái hoạt động
- Compensation logic cấu hình linh hoạt (Commission / Salary / Combination)

Tách riêng:

- Sheet 1: cấu hình compensation
- Sheet 2: danh sách staff

---

**4.2. Location**

POS Portal → Staff Management

UI:

- Button Download Template
- Button Import Staff

---

**4.3. User Flow**

1. User tải template (2 sheets)
2. Fill:
   - Sheet 1: Compensation Settings
   - Sheet 2: Staff List
3. Upload file
4. System validate:
   - Nếu lỗi → popup
   - Nếu hợp lệ → preview
5. User:
   - Confirm → import
   - Cancel → hủy

---

**4.4. File Format**

- **Support: .xlsx**
- **File gồm 2 sheets bắt buộc:**
  - **Compensation Settings**
  - **Staff List**

---

**5. SHEET 1 — COMPENSATION SETTINGS**  
**5.1 Purpose**

Define cấu hình compensation cho từng loại:

- Commission
- Salary
- Commission + Salary

---

**5.2 Structure**

Compensation Types:

- Commission
- Salary
- Commission + Salary

---

**5.3 Fields & Rules**

**A. Commission Settings**

| Field                       | Rule            |
| --------------------------- | --------------- |
| Commission for Service      | % Staff / Owner |
| Commission for Product      | % Staff / Owner |
| Commission for GiftCard     | % Staff / Owner |
| Pay 1 / Pay 2 Split         | Tổng = 100%     |
| Deduction per day           | \>= 0           |
| Card Fee – Staff Commission | %               |
| Card Fee – Credit Card Tip  | %               |

---

**B. Salary Settings**

| Field             | Rule        |
| ----------------- | ----------- |
| Salary by period  | \>= 0       |
| Wage per day      | \>= 0       |
| Wage per hour     | \>= 0       |
| Pay split         | Tổng = 100% |
| Deduction per day | \>= 0       |

---

**C. Commission + Salary**

Kết hợp toàn bộ:

- Salary settings
- Commission settings
- Pay split
- Deduction
- Card fee

---

**5.4 Validation Rules**

- Mỗi compensation type phải có đầy đủ config nếu được sử dụng
- % phải hợp lệ (0–100)
- Pay split:
  - Pay1 + Pay2 = 100%
- Không được để trống field quan trọng

---

**5.5 Business Rule**

- Sheet này là nguồn config duy nhất
- Staff sẽ reference theo Compensation Type

---

**4.6. SHEET 2 — STAFF LIST**  
**4.6.1 Template:** [https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=1010353810#gid=1010353810](https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=1010353810#gid=1010353810)

| Column                   | Required | Rule        |
| ------------------------ | -------- | ----------- |
| Employee First Name (\*) | Yes      | Max 50      |
| Employee Last Name (\*)  | Yes      | Max 50      |
| Employee Nickname (\*)   | Yes      | Max 50      |
| Employee Code (\*)       | Yes      | Unique      |
| Employee Role (\*)       | Yes      | Text        |
| SSN                      | No       | Text        |
| Employee Phone (\*)      | Yes      | Valid       |
| Employee Email           | No       | Valid email |
| Address                  | No       | Text        |
| Country                  | No       | Text        |
| State                    | No       | Text        |
| City                     | No       | Text        |
| Zip Code                 | No       | Text        |
| Compensation (\*)        | Yes      | 3 values    |
| Services Active Full     | No       | 0 / 1       |
| Working Hours Active     | No       | 0 / 1       |
| Booking Online Active    | No       | 0 / 1       |

---

**4.6.2 Compensation Type**

Chỉ nhận:

- Commission
- Salary
- Commission + Salary

---

4.6.3 Mapping Logic

| Staff chọn          | System lấy config    |
| ------------------- | -------------------- |
| Commission          | Sheet 1 → Commission |
| Salary              | Sheet 1 → Salary     |
| Commission + Salary | Sheet 1 → Combined   |

---

**4.6.4 Validation Rules**

**Employee Code**

- Required
- Unique
- Trùng → fail

---

**Name fields**

- Required
- Max 50 chars

---

**Phone**

- Required
- Format hợp lệ

---

**Email**

- Optional
- Nếu có → đúng format

---

**Role**

- Required

---

**Boolean fields**

- Chỉ nhận 0 / 1
- Blank → default = 0

---

**4.6.5 Business Rules**

- Không update staff cũ
- Luôn create mới
- Không dedupe theo email/phone (phase này)

---

**4.7. IMPORT LOGIC**

Rule: All or Nothing

- Có 1 lỗi → fail toàn bộ
- Không import partial

---

**4.8. PREVIEW SCREEN**

- Hiển thị toàn bộ staff
- Không cho edit
- Actions:
  - Confirm
  - Cancel

---

**4.9. ERROR HANDLING**

Popup:

Import failed. Please check row 2, row 5.

---

**4.10. PERMISSION**

User cần: Create Staff

---

**4.11. AUDIT LOG**

Lưu:

- User import
- Thời gian
- Tổng records success
- Tổng records failed
- Status

### **5. Export Staff**

**5.1 Objective**

Cho phép user tùy chọn dữ liệu cần export thay vì export toàn bộ mặc định.

Mục tiêu:

- Linh hoạt theo nhu cầu từng user
- Giảm file size
- Tăng usability (đặc biệt với data lớn)

---

**5.2. Entry Point**

POS Portal → Staff Management → Export Staff

---

**5.3. UX Flow**

1. User click **Export Staff**
2. System mở Export Modal
3. User chọn:
   - Format file
   - Filter data
   - Columns cần export
4. Click Export
5. System generate file

---

**5.4. Export Modal Structure**

**5. 4.1 Export Format**

Options:

- CSV (.csv)
- Excel (.xlsx)

Default: Excel (.xlsx)

---

**5.4.2 Filter – Staff Status**

Cho phép filter theo trạng thái:

- Active
- Inactive
- All (default = select all)

---

**5.4.3 Filter – Compensation Type**

- Commission
- Salary
- Commission + Salary

Multi-select  
Default: All selected

---

**5.4.4 Filter – Role**

- Owner
- Manager
- Partner
- Staff

Multi-select  
Default: All selected

---

**5.4.5 Select Columns to Export**

User có thể chọn field cần export

Group: Basic Info

- Employee First Name
- Employee Last Name
- Employee Nickname
- Employee Code

Group: Contact

- Phone
- Email
- Address
- Country
- State
- City
- Zip Code

Group: Work Info

- Role
- Compensation

Group: Status

- Services Active Full
- Working Hours Active
- Booking Online Active

Default:

- Select tất cả

---

**5.5. Business Rules**

\*\*5.\*\*5.1 Column Selection

- User phải chọn ít nhất 1 column
- Nếu không → disable Export button

---

\*\*5.\*\*5.2 Filter Logic

- Apply AND logic giữa các filter
- Ví dụ:
  - Status = Active
  - Compensation = Commission  
    → chỉ export staff thỏa cả 2

---

\*\*5.\*\*5.3 Data Scope

- Nếu không chọn filter → export toàn bộ

---

**5.5.4 Format Output**

CSV

- Plain data
- Không format

Excel

- Có header
- Có format basic (bold header)

---

**5.5.5 Boolean Fields**

- Export dạng 0 / 1

---

**5.5.6 Compensation**

- Chỉ export type (không export config)

---

**5.6. File Naming**

```
staff_export_YYYYMMDD_HHMM.xlsx
```

Nếu CSV:

```
staff_export_YYYYMMDD_HHMM.csv
```

---

**5.7. Permission**

User cần: View Staff Management

---

**5.8. Audit Log**

Lưu:

- User thực hiện export
- Thời gian export
- File name
- Trạng thái:
  - Success
  - Failed

---

**5.9. Error Handling**

- Không chọn column → disable Export
- System fail → show:  
  Export failed. Please try again.

---

_Source: Google Docs — "Staff Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
