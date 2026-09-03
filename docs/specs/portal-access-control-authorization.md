---
title: 'Portal Access Control & Authorization'
source: https://linear.app/fastboy/document/portal-access-control-and-authorization-5b0a253f7223
linear_id: 63bc67d2-1207-4e3b-9ef1-17743a24f4a1
team: VOLT
updated: 2026-06-11T09:59:16.249Z
---

# Portal Access Control & Authorization

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **Portal Access Control & Authorization**

## **1. Overview**

### **1.1 Background**

Portal là hệ thống dùng để:

- Quản lý merchant POS
- Onboard merchant
- Vận hành và support merchant

Hiện tại chưa có cơ chế phân quyền rõ ràng, dẫn đến:

- User có thể truy cập quá nhiều hoặc sai dữ liệu
- Khó kiểm soát thao tác nhạy cảm
- Không audit được thay đổi

### **1.2 Objective**

Xây dựng hệ thống **Access Control** đảm bảo:

- Phân quyền theo role
- Giới hạn truy cập theo merchant
- Hỗ trợ 2 nhóm user: Internal & External
- Hỗ trợ extra permission ở cấp user
- Permission đơn giản, dễ quản lý (hardcode)
- Có audit log cho các hành động quan trọng

---

## **2. Definitions**

| Term             | Description                                  |
| ---------------- | -------------------------------------------- |
| Permission       | Quyền thực hiện 1 action cụ thể              |
| Role             | Tập hợp các permission                       |
| Extra Permission | Permission được add thêm cho user ngoài role |
| Merchant Access  | Quyền truy cập vào merchant                  |
| Merchant Context | Merchant mà user đang thao tác               |
| Internal User    | User nội bộ Fastboy                          |
| External User    | User thuộc merchant                          |

---

## **3. User Scope**

## **3.1 Internal User**

### **Definition**

- Email domain: @[fastboy.net](http://fastboy.net)
- Login bằng Google SSO

### **Capabilities**

- Được assign:
  - Role
  - Merchant access (1 hoặc nhiều merchant)
  - Extra permission

### **Constraints**

- Chỉ truy cập được merchant được assign
- Permission giống nhau trên tất cả merchant

## **3.2 External User**

### **Definition**

- User thuộc merchant
- Truy cập qua Business App

### **Default Roles:** Owner / Manager / Partner / Staff

### **Capabilities**

- Có thể thuộc nhiều merchant
- Có role + extra permission
- Permission giống nhau trên tất cả merchant

---

## **4. Permission Model**

## **4.1 Permission**

### **Characteristics**

- Được hardcode bởi dev
- Không tạo từ UI
- Format: module.action

### **Example**

- merchant.view
- merchant.edit
- report.view
- report.export
- staff.manage

## **4.2 Role**

### **Characteristics**

- Là tập hợp permission
- Được quản lý tại Role level
- Không chỉnh trực tiếp trên user

## **4.3 Extra Permission (User-level)**

### **Supported Actions**

- Add extra permission
- Remove extra permission đã add

### **Not Supported**

- Không được remove permission từ role
- Không có negative permission

## **4.4 Effective Permission**

**Effective Permission = Role Permission + Extra Permission**

---

## **5. Merchant Access Model**

## **5.1 Separation of Concern**

| Layer           | Purpose                    |
| --------------- | -------------------------- |
| Merchant Access | User vào được merchant nào |
| Permission      | User làm được gì           |

## **5.2 Rules**

- User có thể thuộc nhiều merchant
- Permission không cấu hình theo merchant
- Permission áp dụng đồng nhất cho tất cả merchant

## **5.3 Merchant Context**

Mọi request phải:

- Xác định merchant_id
- Check user có access merchant đó
- Apply permission của user

## **5.4 Merchant Switching**

### **Behavior**

- Nếu user có 1 merchant → auto select
- Nếu nhiều → show merchant selector
- Cho phép switch merchant

---

## **6. Authentication & Access Flow**

## **6.1 Internal**

- Login bằng Google SSO
- Validate domain @fastboy.net

## **6.2 External**

- Truy cập từ Business App / QR
- Xác thực qua token/session

## **6.3 Authorization Flow**

- Authenticate user
- Xác định merchant context
- Check merchant access
- Load role + extra permission
- Check permission
- Allow / Deny

---

## **7. User Management**

## **7.1 Internal User Management**

### **Attributes**

- Name
- Email
- Role
- Merchant Access (multi)
- Extra Permission
- Status (Active / Disabled)

## **7.2 External User Management**

### **Attributes**

- Name
- Role
- Merchant Access (multi)
- Extra Permission
- Status

---

## **8. UI/UX Requirements (CRITICAL)**

## **8.1 Permission Display Structure**

UI phải tách rõ 2 phần:

### **A. Role Permission (Read-only)**

- Hiển thị permission từ role
- Không cho edit
- Label: **“From Role”**

### **B. Extra Permission (Editable)**

- Hiển thị permission có thể add
- Checkbox để add/remove
- Label: **“Custom”**

## **8.2 UI Rules**

- **Không hiển thị duplicate -** Permission đã có trong role → không hiển thị ở extra
- **Không cho remove role permission -** Không cho phép remove permission từ role
- **Group permission -** gom permission theo từng feature lớn để dễ handle (Merchant/Staff/Report…)
- **Visual distinction**
- Role permission → màu xám / disabled
- Extra permission → màu xanh / editable

## **8.3 Optional UX Enhancements**

- Search permission name / role name
- Tooltip giải thích hoặc description của từng permission
- Select all theo group

---

## **9. Audit Log**

## **9.1 Scope**

Log các action:

- Login (success / fail)
- Assign role
- Change role
- Add/remove merchant access
- Add/remove extra permission
- Enable/disable user
- Export data
- Edit merchant
- Onboard merchant
- …

## **9.2 Log Fields**

- actor_id
- actor_type (internal / external)
- merchant_id
- action
- target_type
- target_id
- before_data
- after_data
- timestamp

---

## **10. Business Rules**

1.  Permission được hardcode
2.  Role là nguồn permission chính
3.  User chỉ có thể add/remove extra permission
4.  Không được revoke permission từ role
5.  Permission không cấu hình theo merchant
6.  User có thể thuộc nhiều merchant
7.  Permission giống nhau trên tất cả merchant
8.  User chỉ truy cập merchant được assign
9.  Mọi action liên quan đến access control phải được audit log
10. Mọi API phải check merchant context
11. Không hỗ trợ permission khác nhau giữa các merchant cho cùng 1 user

---

## **11. Open Items (Future)**

- Internal invite flow
- External invite flow
- Permission dependency validation
- Advanced security (MFA, device control)

---

## **12. Permission List**

[https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=284235142#gid=284235142](https://docs.google.com/spreadsheets/d/14EG7souxH1ner_PNu9MAgOHui7fAEFJkYL41La5HHC8/edit?pli=1&gid=284235142#gid=284235142)

---

_Source: Google Docs — "Portal Access Control & Authorization" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
