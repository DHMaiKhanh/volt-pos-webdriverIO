---
title: 'Device Pending'
source: https://linear.app/fastboy/document/device-pending-a98d6c65061a
linear_id: 032147b6-9d0a-4ee3-bd1d-3cdb10ed2224
team: VOLT
updated: 2026-06-11T09:59:34.218Z
---

# Device Pending

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **POS Portal - Device Management & POS Login Control**

## **1. Summary**

Xây dựng trang **Device Management** trên Portal để quản lý tập trung toàn bộ thiết bị POS trong hệ thống, bao gồm:

- Kiểm soát trạng thái thiết bị (Pending / Active / Inactive)
- Thiết lập workflow phê duyệt device trước khi login POS
- Hỗ trợ login POS bằng OTP trong trường hợp scan QR lỗi
- Theo dõi thông tin device, merchant và app version

---

## **2. Problem**

Hiện tại:

- Không có cơ chế quản lý tập trung device POS
- Device có thể login mà không có bước xác thực/phê duyệt
- Khi login bằng QR lỗi, không có phương án fallback
- Không kiểm soát được device nào đang hoạt động trong hệ thống

---

## **3. Goal**

- Kiểm soát toàn bộ device POS trong hệ thống
- Đảm bảo chỉ device được phê duyệt mới có thể sử dụng POS
- Hỗ trợ login nhanh bằng OTP khi cần
- Tăng tính bảo mật và khả năng vận hành

---

## **4. Scope**

### **4.1. Device Management Page (Portal)**

- Menu **không phụ thuộc Merchant Selector**
- Hiển thị toàn bộ device trong hệ thống

#### **Fields hiển thị:**

- Device ID
- Merchant Name
- WHMCS ID
- Status: Pending / Active / Inactive
- App Version (POS version gần nhất)
- Registered At
- Last Active At _(đề xuất)_
- Action

### **4.2. Actions**

| Status   | Available Actions                 |
| -------- | --------------------------------- |
| Pending  | Activate / Inactive               |
| Active   | Inactive / Get Merchant Login OTP |
| Inactive | Activate                          |

### **4.3. Search & Filter**

- Search:
  - Device ID
  - Merchant Name
  - WHMCS ID
- Filter:
  - Status
  - App Version
  - Date (Registered At)
- Sort:
  - Registered At
  - Last Active At

---

## **5. Device Lifecycle & Flow**

### **5.1. Tạo device (Auto registration)**

- Khi user login POS:
  - App gửi **Device ID** lên Portal
- Nếu device chưa tồn tại:
  - Tạo mới với:
    - Status = **Pending**
    - Lưu Merchant
    - Lưu App Version
    - Lưu Registered At

### **5.2. Login control**

- Device **Pending** → Không login được
- Device **Active** → Login thành công
- Device **Inactive** → Không login được

### **5.3. Cập nhật device**

Nếu device đã tồn tại:

- Update:
  - App Version
  - Last Active At
- Không thay đổi status

---

## **6. Status & Transition Rule**

### **6.1. Status definition**

- **Pending**
  - Device mới
  - Chưa được phê duyệt
  - Không được login
- **Active**
  - Đã được phê duyệt
  - Được phép login POS
  - Có thể generate OTP
- **Inactive**
  - Bị vô hiệu hóa
  - Không login được

### **6.2. Transition Rule**

- Pending → Active / Inactive
- Active → Inactive only
- Inactive → Active only
- Không cho phép chuyển về Pending trong mọi trường hợp

---

## **7. OTP Login Flow**

### **7.1. Use case**

- Device đang Active nhưng POS bị logout
- Login bằng QR lỗi → Dùng OTP để login nhanh

### **7.2. Portal action**

- Button: **Get Merchant Login OTP**
- Chỉ áp dụng cho device: Status = Active

### **7.3. OTP Rule**

- Hiệu lực: **5 phút**
- Dùng **1 lần duy nhất**
- Gắn với **1 device cụ thể**
- Generate OTP mới → invalidate OTP cũ
- Mỗi device chỉ có **1 OTP active tại 1 thời điểm**

### **7.4. UI OTP Modal**

- Device ID
- Merchant Name
- OTP Code
- Countdown (5 phút)
- Action:
  - Copy OTP
  - Close

### **7.5. POS Login Flow**

#### **Thêm option:**

- Login by QR Code (existing)
- **Login by OTP (new)**

#### **Validate:**

- OTP hợp lệ
- OTP chưa hết hạn
- Đúng device
- Device = Active

### **7.6. Error message**

- Invalid OTP
- OTP expired
- Device not activated
- OTP not valid for this device

---

## **8. Device Status Actions (UI)**

### **Activate**

- Applies: Pending, Inactive
- Confirm modal:
  - “This device will be allowed to use POS”

---

### **Deactivate**

- Applies: Active
- Confirm modal:
  - “This device will no longer be allowed to log in to POS”

---

### **Get OTP**

- Applies: Active only

---

## **9. Data Rules**

### **Device uniqueness:** Device ID là unique

### **Merchant mapping**

- **1 device chỉ thuộc 1 merchant**
- Không auto change merchant khi login khác merchant

### **Tracking**

- Update:
  - Last Active At khi device call lên system
  - App Version khi có thay đổi

---

## **10. Audit Log**

Track các action:

- Device created
- Activate / Deactivate
- OTP generated

Fields:

- Device ID
- Merchant
- Action
- Performed by
- Timestamp

---

## **11. Edge Cases**

- Pending login nhiều lần → vẫn fail
- Active → Inactive khi đang login:
  - Đề xuất: không force logout, chỉ chặn login tiếp theo
- OTP:
  - Generate liên tục → chỉ OTP mới nhất valid
  - OTP hết hạn khi đang nhập → fail
- Device gửi sai ID → cần validate/log
- Attempt chuyển status về Pending → reject

---

### **Login control**

- Chỉ Active mới login được

---

_Source: Google Docs — "Device Pending" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
