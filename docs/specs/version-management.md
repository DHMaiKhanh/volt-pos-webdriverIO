---
title: 'Version Management'
source: https://linear.app/fastboy/document/version-management-df865e39d169
linear_id: 4e51fce1-a889-48a1-bb35-6fbc7d984527
team: VOLT
updated: 2026-06-11T09:59:27.272Z
---

# Version Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

### **Version Management – POS App**

### **Overview**

Tính năng Version Management cho phép Admin quản lý các version của POS app trực tiếp từ Portal, bao gồm việc publish version mới, thay thế version hiện tại và kiểm soát hành vi update của POS.

Mục tiêu là đảm bảo việc release version được kiểm soát chặt chẽ, an toàn và tránh các rủi ro như downgrade hoặc sử dụng version lỗi.

### **Business Objectives**

- Quản lý tập trung tất cả version của POS app
- Chủ động kiểm soát version đang được sử dụng trên hệ thống
- Đảm bảo POS luôn update theo chiều hướng nâng cấp (không downgrade)
- Cho phép xử lý nhanh khi cần thay thế version lỗi (force update)
- Đơn giản hóa flow vận hành cho team internal

---

### **Key Behaviors**

#### **1. Version Visibility**

- Tất cả version từ BE sẽ được hiển thị trên Portal
- Mỗi version có trạng thái rõ ràng:
  - Unpublished (chưa sử dụng)
  - Published (đang active)
  - Deprecated (không còn sử dụng)

#### **2. Publish Version**

- Admin có thể chọn publish một version mới
- Khi publish:
  - Version đó trở thành version chính thức trên POS
  - Version trước đó sẽ tự động bị thay thế (deprecated)
- Có thể cấu hình:
  - Force Update (bắt buộc POS update)

#### **3. Deprecate (Replace Version)**

- Không đơn thuần là “tắt” version hiện tại
- Khi thực hiện Deprecate:
  - Hệ thống sẽ tự động chuyển sang version mới nhất chưa publish
  - Đồng thời bật Force Update để đảm bảo tất cả POS update ngay

Mục tiêu: xử lý nhanh các trường hợp cần thay thế version lỗi

#### **4. Version Control Rules**

- Tại một thời điểm chỉ có **1 version active**
- Không cho phép downgrade:
  - POS chỉ được update lên version cao hơn
  - Không cho phép publish version thấp hơn version hiện tại

#### **5. Update Control (POS Behavior)**

- POS sẽ:
  - Tự động update khi có version mới cao hơn
  - Bắt buộc update nếu Force Update được bật
- Nếu version thấp hơn hoặc bằng → không thực hiện update

#### **6. Safety & Operational Control**

- Không cho phép sử dụng lại version cũ (rollback bằng cách release version mới)
- Tránh việc merchant sử dụng version lỗi hoặc không phù hợp
- Đảm bảo quá trình update diễn ra đồng nhất trên toàn hệ thống

---

### **Expected Outcome**

- Quản lý version POS một cách tập trung và minh bạch
- Giảm rủi ro khi release version mới
- Có khả năng phản ứng nhanh khi có sự cố (force update)
- Đảm bảo tất cả merchant sử dụng version hợp lệ và mới nhất

---

_Source: Google Docs — "Version Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
