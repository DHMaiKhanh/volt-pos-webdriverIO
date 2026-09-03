---
title: 'Customer Management'
source: https://linear.app/fastboy/document/customer-management-5a2f35d3c8fc
linear_id: b8656c71-958a-4c4a-b8ff-7ef70443a0eb
team: VOLT
updated: 2026-06-11T09:59:35.264Z
---

# Customer Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

1. **Tổng quan**

Customer Management cho phép Admin (toàn hệ thống) và Merchant:

- Xem danh sách customer theo từng merchant
- Xem order history
- Quản lý Loyalty (chỉnh điểm thủ công)
- Xem lịch sử thay đổi điểm
- Tier được auto tính theo rule
- Customer unique theo phone number trong từng merchant.

2. **Cấu trúc menu**

- Gồm 3 phần chính:
  - Customer List
  - Customer Detail
    - Profile tab
    - Order History tab
    - Points History tab

3. **Customer Listing Page**

- Column hiển thị:
  - Name
  - Phone (unique – không cho edit)
  - Email
  - Total Visit
  - Current Points
  - Cashback Balance: số tiền tích được từ Cashback
  - ~~Tier~~
  - Last Visit Date
  - Action: View Detail
- Search: Search theo Phone / Name
- Filter: Filter theo: Tier / Last Visit Date (date range)
- Sort mặc định theo Created At (DESC)

4. **Customer Detail Page**

Khi click vào 1 customer, sẽ chia thành 3 tabs như sau:

- **Profile tab**
  - Hiển thị:
    - Customer Name (editable)
    - Phone (read-only)
    - Email (editable)
    - Total Visit (editable)
    - Current Points (editable)
    - Reward balance: số tiền tích được từ Cashback
    - Tier (editable)
    - Birthday (editable)
    - Note (editable)
    - Created At
  - Rule\*\*:\*\* Khi update
    - Lưu Audit Log
    - Không gửi notification
    - Không cho update Phone
- **Order History tab**
  - Default hiển thị đơn hàng trong 30 ngày gần nhất
  - Chỉ View
  - Không có action (refund, edit, etc.)
  - Có thể paginate nếu nhiều đơn
  - Gồm những thông tin sau:
    - Checkin At
    - Checkout At
    - Point: số điểm ngay sau khi checkout order success
    - Reward/Discount: total amount được Reward/Discount trong order
    - Checkout By: staff thực hiện complete order
    - Staff: staff trong order
    - Services/Products: list service/product trong order
- **Points History tab**
  - Current Points
  - Tier (auto tính, read-only)
  - Data table gồm những column:
    - Content: gồm những loại sau
      - Complete order #ODcode
      - Reward title: số điểm được redeem từ Reward nào
      - Update point: Manual Adjustment từ Volt POS
      - Update point: Manual update từ DTS
    - Action Type:
      - Redeem: số điểm được redeem từ Reward
      - Checkout: được cộng Point sau khi Complete order
      - Review (Pending - new feature)
      - Update: volt_pos_update update manual từ Portal (Manual Adjustment)
      - Update: chủ tiệm update Point từ Admin POS DTS
    - Points: số điểm cộng hay trừ từ những action trên
    - Update By:
      - Account email: đối với Volt POS update từ portal
      - System: dành cho những casecòn lại
    - Updated At (datetime)

| Content                        | Action Type                    | Point | Updated By             | Updated At |
| ------------------------------ | ------------------------------ | ----- | ---------------------- | ---------- |
| Redeem: Free Gel Manicure      | Redeem                         | +20   | System                 |            |
| Complete order #OD20260315-001 | Checkout                       | +50   | System                 |            |
| Update point (-5)              | Manual Adjustment              | \-5   | User đang login Portal |            |
| Update point (+5)              | Update                         | +5    | System                 |            |
| *                              | Review (Pending - new feature) | *     | *                      |            |

5. **Points History - Loyalty Logic:**

- **Points Adjustment: Admin hoặc Merchant được phép update trực tiếp Point từ Portal**
  - Nhập số điểm >= 0, không cho tổng điểm âm
  - Nếu muốn trừ quá số hiện tại → chỉ được đưa về 0
- **Points Adjustment Rules**
  - Không cần nhập Reason
  - Không gửi notification
  - Bắt buộc lưu Points History Log

6. **Tier Logic**

- **Tier gồm:**
- New: Visit Count = 1 & Last Visit < 14 Days
- At Risk: Khác VIP & Last Visit > 60 Days
- Regular: Khác VIP & Visit Count > 2 & Last Visit < 14 Days
- Vip: 10 Visit Count hoặc 1000 Point
- Normal: Visit Count = 0 hoặc Last Visit > 15 Days và Last Visit < 60
- Import: Customer Import lần đầu
- Booking: Customer Booking lần đầu
- **Rule:**
  - Tier auto tính
  - Không cho chỉnh tay
  - Không cho override rule
  - Khi point/visit count thay đổi → tier tự động update theo rule system

7. **Customer Group Management**

Là một tab trong menu Customer

**Mục tiêu:** Cho phép tạo và quản lý các **Customer Group** để phục vụ cho việc quản lí khách và chọn nhóm khách hàng khi tạo Campaign. Campaign sẽ được gửi đến các customer thuộc những group đã chọn.

Gồm những thông tin sau:

1. **Customer Group Listing**

Hiển thị danh sách Customer Group dưới dạng table, gồm các cột:

- Group Name
- Description
- Total Customers
- Created At
- Action: View / Edit / Delete

Các chức năng hỗ trợ:

- Search theo **Customer Group Name**
-

## Button: **Create Group**

2. **Create Customer Group**

Khi click **Create Group**, mở modal:

**Title:** Create Customer Group

**Fields:**

- **Group Name** _(required)_
- **Description** _(optional)_

**Buttons:**

- Cancel
- Create Group

**Validation:**

-

## Không cho phép tạo group nếu chưa nhập **Group Name**

3. **Update Customer Group**

Khi click **Edit**, mở modal:

**Title:** Update Customer Group

**Fields:**

- **Group Name** _(required)_
- **Description** _(optional)_

**Buttons:**

- Cancel
- Update Group

**Validation:**

-

## Không cho phép update nếu **Group Name** để trống

4. **Delete Customer Group**

Khi click **Delete**, mở modal confirm:

**Title:** Delete Customer Group

**Description:**  
Are you sure you want to delete this customer group? This action will remove the group only. Customers currently in this group will not be deleted from the system.

**Buttons:**

- Cancel
- Delete Group

**Validation:** nếu group đang có customer vẫn cho phép xóa bình thường, và customer không còn group đó nữa thôi (đối với customer, group là optional)

---

5. **View Customer Group Detail**

Khi click **View**, hiển thị thông tin chi tiết của group gồm:

**Group information:**

- **Group Name**
- **Description**
- **Total Customers**

**Customer listing** trong group, gồm các cột:

- Name
- Phone
- Email
-

## Added At

6. **Manage Group Members**

   **Add Member**

Action: **Add Member**

Khi chọn **Add Member**:

- Hiển thị danh sách **Customer đang có trong hệ thống nhưng chưa thuộc group hiện tại**
- Cho phép chọn một hoặc nhiều customer để add vào group

  **Remove Member**

Action: **Remove Member**

- Mỗi customer trong group có checkbox để chọn
- Merchant chọn một hoặc nhiều member, sau đó click **Remove Member** để xóa khỏi group
-

## Action này chỉ xóa customer khỏi group, **không xóa customer khỏi hệ thống**

7. **Business Purpose**

- Merchant có thể chủ động phân loại customer theo từng mục đích chăm sóc hoặc marketing
- Khi tạo **Campaign**, merchant có thể chọn một hoặc nhiều **Customer Group** làm đối tượng nhận campaign
-

## Hệ thống sẽ gửi campaign đến toàn bộ customer thuộc các group đã chọn

8. **Cashback History**

Lưu lại Cashback log khi có sự thay đổi số dư của ví cashback, gồm những thông tin sau:

- Date/Time: order create date/time
- Type: Earn / Redeem / Reverse / Restore
- Amount: được cộng trừ
- Balance: số tiền tích luỹ được ở thời điểm đó
- Order: số tiền được cộng/trừ từ order ID nào
- Description: mô tả chi tiết action được cộng/trừ cashback
- Sort: default DESC theo Date/Time

VD cho những case cụ thể:

- Re-open Order:

| Time  | Type    | Amount | Balance | Order | Description                      |
| ----- | ------- | ------ | ------- | ----- | -------------------------------- |
| 10:00 | Earn    | +5     | 5       | #1001 | Earn cashback                    |
| 10:10 | Reverse | \-5    | 0       | #1001 | Re-open order → reverse cashback |
| 10:15 | Earn    | +3     | 3       | #1001 | Recalculated cashback            |

- Full Refund:

| Time  | Type    | Amount | Balance | Order | Description                         |
| ----- | ------- | ------ | ------- | ----- | ----------------------------------- |
| 09:00 | Earn    | +5     | 5       | #1001 | Earn cashback                       |
| 09:30 | Redeem  | \-3    | 2       | #1002 | Redeem cashback                     |
| 10:00 | Reverse | \-5    | \-3     | #1001 | Full refund → reverse earn          |
| 10:00 | Restore | +3     | 0       | #1002 | Refund Order #1001 → restore redeem |

---

_Source: Google Docs — "Customer Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
