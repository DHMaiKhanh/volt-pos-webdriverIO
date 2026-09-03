---
title: 'Merchant Overview'
source: https://linear.app/fastboy/document/merchant-overview-48df980f19e3
linear_id: 8e891c1c-83f4-4c5d-9088-d6f4afa9b68c
team: VOLT
updated: 2026-06-11T09:59:47.102Z
---

# Merchant Overview

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Merchant Overview**  
[Settings](https://linear.app/fastboy/document/settings-6fe2b4cc81a4)

Sau khi login Admin site, chọn Merchant thì sẽ hiển thị page overview của merchant trước, thể hiện những thông tin cơ bản của merchant, để có cái nhìn tổng quát về tiệm, rồi sau đó muốn vào một page cụ thể nào đó thì sẽ chọn từ thanh menu bên trái.

## **Mô tả:**

Merchant overview sẽ gồm những thông tin cơ bản sau:

1. **Merchant Information**

- Merchant Avatar
- Merchant Name
- Merchant Whmcs ID
- Merchant Status
- POS Package
- Active Date

2. **Merchant Contact**

- Merchant Owner name
- Merchant Owner phone
- Merchant Owner email
- Merchant address

3. **Device Overview**

- Tổng số device
- Danh sách device:
  - Device name / ID: POS / DOT / Printer / Cash Drawer
  - Device type (Bamboo POS / Bamboo Terminal / Printer / Cash Drawer …)
  - Device status:
    - Connected
    - Disconnected

4. **Order Report**

- Order report tổng hợp (ở mức summary)
  - Total order
  - Total Appointment
  - …
- Số liệu phản ánh tình trạng hiện tại của merchant

5. **Batch History (Summary)**: Giúp Admin biết merchant đã close batch gần nhất hay chưa.

- Batch Date gần nhất: today
- Batch Status: Open / Closed

## **Tổng quan bố cục (1 screen)**

**Header:** Merchant Name + Status

---

### **Block 1: Today Summary**

**Mục đích:** Cho phép Admin xem nhanh tình trạng hoạt động trong ngày của merchant.

Display merchant daily operational summary.

- Total Orders: tổng số order được create thành công, không tính Cancel/Refund/Partial Refund
- Total Tips: tổng số tiền tip thu được trên total order
- Average Order: trung bình mỗi order khách thanh toán bao nhiêu
- Total Refunds: tổng số tiền bị refund/partial refund
- Total Appointments: tổng số appointment được book trong ngày hôm nay
- Total Payment (Revenue) = **Sale - Refund + Tip + Tax Collected**
  - Final revenue includes Gift Card Redemption
- Button: View All.
  - Clicking this button will redirect you to the Income Report menu for more details.

Lưu ý: All Today Summary data must follow: Merchant Timezone

---

### **Block 2: Merchant Information**

Merchant Profile

- Merchant Avatar
- Merchant Name
- Merchant WHMCS ID
- Merchant Status
- POS Package
- Active Date

Merchant Contact

- Merchant Owner Name
- Merchant Owner Phone
- Merchant Owner Email
- Merchant Address

Card này **không cần action**, chỉ để nhận diện & kiểm soát trạng thái.

---

### **Block 3: Device Summary**

**Mục đích:** Giúp Admin theo dõi tình trạng kết nối và hoạt động của thiết bị merchant.

Device Structure

Mỗi Bamboo POS sẽ bao gồm:

- 1 Bamboo DOT / Bamboo Terminal
- 1 Printer

Device Status Sync

- Device status được sync mỗi 1 tiếng/lần.

Device Summary Display

Mỗi device group hiển thị:

- Bamboo POS name / ID
- POS status:
  - Online
  - Offline
- Bamboo DOT status:
  - Connected
  - Disconnected
- Printer status:
  - Connected
  - Disconnected

Device Detail Drawer

Khi click vào một Bamboo POS:

- Hệ thống mở Device Detail drawer.

Device Detail Information

- Device Name
- Device Status
- Device ID
- Terminal Serial
- Last Connected
- Last Disconnected
- Uptime (7 ngày gần nhất)

Connection History

Hiển thị:

- Date
- Uptime %
- Status:
  - Online
  - Offline

UX Requirements

- Device offline/disconnected phải hiển thị warning state.
- Nếu không có dữ liệu connection history thì hiển thị empty state.

---

### **Block 4: Batch History**

**Mục đích:** Giúp Admin nhanh chóng xác định merchant đã close batch hay chưa.

Thông tin hiển thị

- Batch Date
- Batch Number
- Amount
- Status:
  - Open
  - Closed

**B**utton:View All

**Behavior:** Khi click View All

- Hệ thống redirect user đến menu: Batch History
- User có thể xem toàn bộ batch history và thông tin chi tiết liên quan.

---

_Source: Google Docs — "Merchant Overview" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
