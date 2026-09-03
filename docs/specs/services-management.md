---
title: 'Services Management'
source: https://linear.app/fastboy/document/services-management-bb5c06fb3976
linear_id: c882ec10-a767-41bf-b03e-958c37a4000e
team: VOLT
updated: 2026-06-11T09:59:42.957Z
---

# Services Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Services Management**  
[Settings](https://linear.app/fastboy/document/settings-6fe2b4cc81a4)

### 1\. Services Management listing page

- The left menu (navigation sidebar) will display an option for Services Management. When clicked, it will display the following actions:
- List of Items: This is the default view showing all services/products. Ngoài category Product là item type Product, còn lại là item type Service
- This could be a table or card list of all items (services/products) with options for Add, Edit, and Delete next to each item.
- Gồm những thông tin sau:
  - Button: Import Service
  - Search bar: service name
  - Category list:
    - Button: Add Category
    - Status: Active / Inactive (default show list Active)
    - Category Name
    - Category color
    - Action: Edit
  - Service field: show list service thuộc category đang được select, gồm:
    - Button: Add Service
    - Filter: status, default - Active
    - Service Name - Description
    - Price
    - Duration
    - Supply Fee
    - Status
    - Action: Edit

### 2\. Add New Category

When the user selects Add from the menu or the list of category items:  
Action: Click Add → Display the form to add a new item  
**UI Elements:**

- Form Fields: Display all the necessary fields for adding a new service/product.
  - Title: Create Category
  - Category Information
    - Category Name (required): Unlimited
    - Status: Toggle Active / Inactive - default Active
  - Category Color: Default selection of the first color in the available list.
  - Buttons:
    - Add: To save the new item.
    - Cancel: To discard the action and return to the previous page or list.

**Flow:**

- Once the Save button is clicked, the new item is added to the list, and the UI returns to the list of items view with the newly added item visible.
- If the Cancel button is clicked, the user is returned to the list of items without saving the new item.

### 3\. Add New Service

When the user selects Add from the menu or the list of items:  
Action: Click Add → Display the form to add a new item  
**UI Elements:**

- Form Fields: Display all the necessary fields for adding a new **SERVICE**
  - Service Name (Text Input)
  - Category Selection (Dropdown)
  - Price (Number Input)
  - Flexible Pricing: checkbox
  - Duration (Time Picker or Dropdown)
  - Supply Fee (Number Input)
  - Description (Text Area)
  - Visibility Setting: toggle option
    - Active
    - Shown on Go Checkin
    - Shown on Web Booking
    - Shown on Go POS
- Form Fields: Display all the necessary fields for adding a new **PRODUCT**.
  - Product Name (Text Input)
  - Category Selection (Dropdown)
  - Price (Number Input)
  - Flexible Pricing: checkbox
  - Description (Text Area)
  - Visibility Setting: toggle option
    - Active
- Buttons:
  - Add: To save the new item.
  - Cancel: To discard the action and return to the previous page or list.

**Flow:**

- Once the Save button is clicked, the new item is added to the list, and the UI returns to the list of items view with the newly added item visible.
- If the Cancel button is clicked, the user is returned to the list of items without saving the new item.

### 4\. Edit an existing Category

When the user selects Edit next to an item in the list:  
Action: Click Edit → Display a form pre-filled with the existing details of the selected item.  
**UI Elements:**

- Form Fields: Display all the necessary fields for adding a new service/product.
  - Title: Create Category
  - Category Information
    - Category Name (required): Unlimited
    - Status: Toggle Active / Inactive - default Active
  - Category Color: Default selection of the first color in the available list.
- Buttons:
  - Save: To save the changes made to the item.
  - Cancel: To discard the changes and return to the list of items.

**Flow**:

- Once Save is clicked, the item is updated with the new information and returned to the list of items view.
- If Cancel is clicked, the user is returned to the list of items without saving the changes.

### 5\. Edit an existing Service

When the user selects Edit next to an item in the list:  
Action: Click Edit → Display a form pre-filled with the existing details of the selected item.  
**UI Elements:**

- Pre-filled Fields: Display all editable fields with the current values populated.
  - Service/Product Name (Text Input)
  - Category Selection (Dropdown)
  - Price (Number Input)
  - Flexible Pricing: checkbox
  - Duration (Time Picker or Dropdown)
  - Supply Fee (Number Input)
  - Description (Text Area)
  - Visibility Setting: toggle option
- Buttons:
  - Save: To save the changes made to the item.
  - Cancel: To discard the changes and return to the list of items.

**Flow**:

- Once Save is clicked, the item is updated with the new information and returned to the list of items view.
- If Cancel is clicked, the user is returned to the list of items without saving the changes.

### 6\. Import Service

6.1 Mục tiêu

Bổ sung tính năng **Import Service** trong POS Portal, tại menu **Service Management**, nhằm hỗ trợ merchant/user import hàng loạt Service hoặc Product bằng file Excel thay vì phải tạo từng item thủ công.

---

6.2 **Vị trí tính năng**

**POS Portal → Service Management**

Thêm các UI components:

- Button: **Download Template**
- Button: **Import Service**

---

6.3. User Flow

1. User vào màn **Service Management**
2. Click **Download Template** → tải file Excel mẫu
3. Điền dữ liệu vào file
4. Click **Import Service**
5. Upload file Excel
6. System validate dữ liệu:
   - Nếu invalid → show error popup
   - Nếu valid → hiển thị Preview
7. User chọn:
   - **Confirm** → thực hiện import
   - **Cancel** → hủy
8. System xử lý import
9. Hiển thị kết quả

---

6.4. Import Template

File format:

- Chỉ support: **Excel (.xlsx)**
- Template: [https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=589564261#gid=589564261](https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=589564261#gid=589564261)

| Column                     | Required | Rule                  |
| -------------------------- | -------- | --------------------- |
| STT                        | No       | Dùng để tham chiếu    |
| Category (\*)              | Yes      | Tên category          |
| ~~Service Item Type (\*)~~ | ~~Yes~~  | ~~Service / Product~~ |
| Services Name (\*)         | Yes      | Max 50 ký tự          |
| Price                      | No       | Blank → 0             |
| Service Description        | No       | Max 80 ký tự          |
| Duration (Minutes)         | No       | Blank → 0             |
| Supply Share               | No       | Blank → 0             |
| Show On Checkin            | No       | 0 / 1                 |
| Show On Booking            | No       | 0 / 1                 |
| Show On POS                | No       | 0 / 1                 |

---

6.5. Business Rules

Category

- Import bằng tên
- Nếu tồn tại → dùng lại
- Nếu chưa tồn tại → auto create
- Không được để trống
- Lưu ý: Nếu trong tiệm đang có sẵn 2 category trùng name, thì báo lỗi khi review file import.

---

~~Service Item Type~~

- ~~Bắt buộc~~
- ~~Chỉ nhận:~~
  - ~~Service~~
  - ~~Product~~
- ~~Sai value → fail import~~

---

Services Name

- Bắt buộc
- Max length: 50 ký tự
- Cho phép trùng với data hiện tại
- Import luôn:
  - Tạo mới record
  - Không update record cũ
- Nếu:
  - Trống → fail
  - 50 ký tự → fail

---

Service Description

- Optional
- Max length: 80 ký tự
- 80 ký tự → fail

---

Price

- Optional
- Blank → default = 0
- Nếu có value:
  - Phải là số hợp lệ
  - = 0

---

**Duration (Minutes)**

- Optional
- Blank → 0
- Phải là số nguyên ≥ 0

---

**Supply Share**

- Optional
- Blank → 0
- Phải là số ≥ 0

---

**Boolean Fields**

Áp dụng cho:

- Show On Checkin
- Show On Booking
- Show On POS

Rule:

- Chỉ nhận 0 hoặc 1
- 1 = Show
- 0 = Hide
- Value khác → fail

---

6.6. Import Logic

Rule: All or Nothing

- Nếu tất cả rows hợp lệ → import toàn bộ
- Nếu có ít nhất 1 row lỗi → không import bất kỳ row nào

---

6.7. Preview Screen

Hiển thị sau khi upload file hợp lệ.

Yêu cầu:

- Show toàn bộ data
- Không cho chỉnh sửa
- Có:
  - Button **Confirm**
  - Button **Cancel**

Hành vi:

- Confirm → thực hiện import
- Cancel → hủy

---

6.8. Error Handling

Khi có lỗi:

- Show popup lỗi tổng quát
- Có chỉ rõ row bị lỗi

Format message:

Ví dụ:

Import failed. Please check row 3, row 7.

---

6.9. Permission

User có thể import nếu có quyền: **Create Staff**

---

6.10. Audit Log

Mỗi lần import cần lưu:

- User thực hiện
- Thời gian
- Tổng số record thành công
- Tổng số record failed
- Status:
  - Success
  - Failed

Theo rule All-or-Nothing:

- Success:
  - success = total rows
  - failed = 0
- Failed:
  - success = 0
  - failed = số row lỗi

---

6. UI Requirements

Download Template

- Button visible tại Service Management
- Download file Excel mẫu chuẩn format

Import Button

- Mở dialog upload file

---

### **7. Export Service**

**7.1 Objective**

Cho phép user export danh sách **Service/Product** theo nhu cầu cụ thể, thay vì export toàn bộ mặc định.

User có thể:

- Lựa chọn định dạng file
- Lọc dữ liệu cần export
- Chọn các trường thông tin cần export

Mục tiêu:

- Tăng tính linh hoạt
- Giảm dữ liệu không cần thiết
- Phục vụ nhiều use case (report, audit, chỉnh sửa)

---

**7.2. Location**

**POS Portal → Service Management**

Thêm: Button **Export Service**

---

**7.3. User Flow**

1. User vào màn **Service Management**
2. Click **Export Service**
3. System mở **Export Modal**
4. User cấu hình:
   - Export format
   - Filters
   - Columns
5. Click **Export**
6. System generate file và download

---

7.4. Export Modal UI

**7.4.1 Modal Title: Export Service**

**7.4.2 Modal Sections**

**Export Format**

User có thể chọn:

- CSV (.csv)
- Excel (.xlsx)

  Default:

- Excel (.xlsx)  
  **Filters**

  Service Item Type

- Service
- Product  
  → Multi-select  
  → Default: tất cả

  Category

- Multi-select từ danh sách category hiện có  
  → Default: tất cả

  Visibility

  Áp dụng cho:

- Show On Checkin
- Show On Booking
- Show On POS

  → Cho phép filter  
  → Default: không giới hạn

**7.4.3. Select Columns to Export**

User chọn các trường cần export

Group: Basic Information

- Category
- Service Item Type
- Services Name  
  Group: Pricing & Duration
- Price
- Duration (Minutes)
- Supply Share  
  Group: Description
- Service Description  
  Group: Visibility
- Show On Checkin
- Show On Booking
- Show On POS  
  Default: tất cả columns được chọn

**7.4.4 Modal Actions (Buttons)**

- **Cancel**
  - Đóng modal
  - Không thực hiện export
- **Export**
  - Trigger export file
  - Disabled nếu:
    - Không có column nào được chọn

---

**7.5. Business Rules**

**7.5.1 Column Selection**

- User phải chọn ít nhất **1 column**
- Nếu không chọn column nào:
  - Disable nút Export

**7.5.2 Filter Logic**

- Áp dụng **AND logic giữa các nhóm filter**
- Ví dụ:
  - Type = Service
  - Category = Manicure  
    → chỉ export service phù hợp

**7.5.3 Data Scope**

- Nếu không chọn filter → export toàn bộ Service/Product

**7.5.4 Boolean Fields**

- Export dưới dạng:
  - 1 = enabled / hiển thị
  - 0 = disabled / ẩn

**7.5.5 Output Format**

CSV

- Plain text
- Không format

Excel

- Có header
- Header được format (bold)

**7.5.6 Data Snapshot**

- Data export là snapshot tại thời điểm click Export

---

**7.6. File Naming Convention**

Excel:

```
service_export_YYYYMMDD_HHMM.xlsx
```

CSV:

```
service_export_YYYYMMDD_HHMM.csv
```

---

**7.7. Permission**

User có thể export nếu có quyền:

**View Service Management**

---

**7.8. Audit Log**

System cần lưu:

- User thực hiện export
- Thời gian export
- File name
- Trạng thái:
  - Success
  - Failed

---

**7.9. Error Handling**

Trường hợp: User không chọn column

→ Disable nút Export

Trường hợp: System không generate được file

→ Hiển thị message: Export failed. Please try again.

---

_Source: Google Docs — "Services Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
