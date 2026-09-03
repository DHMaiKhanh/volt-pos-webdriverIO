---
title: 'Business Snapshot'
source: https://linear.app/fastboy/document/business-snapshot-ac4f3735e3c2
linear_id: e9f55c9f-6a4e-4931-aea7-e018a1b168cf
team: VOLT
updated: 2026-06-11T09:59:19.957Z
---

# Business Snapshot

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**\[Daily Sale Report\] Update**

Màn hình dashboard tổng quan trong POS, giúp Merchant/Admin nắm nhanh tình hình kinh doanh hiện tại thông qua các chỉ số chính như doanh thu, số giao dịch và trạng thái thanh toán. Tính năng này không thay thế báo cáo chi tiết mà đóng vai trò “check nhanh sức khỏe business”.

Mục tiêu là xem nhanh – hiểu nhanh – click để xem xu hướng, không đi sâu chi tiết ở màn này.

- **Dữ liệu: Realtime (nếu hệ thống cho phép)**
- **Default period: Today**
- **Cho phép chọn period khác**
- **So sánh:**
  - **Previous period cùng độ dài**
  - **Hiển thị dưới dạng % tăng / giảm**

Gồm những field thông tin như sau:

1. **Date range picker:** Default period: Today
2. **Cards info**

- **Total Orders**: hiển thị số lượng order được create mới vào ngày đang xem report. Khi click vào card này, show column chart ghi nhận order theo giờ
- Lưu ý:
  - Chỉ ghi nhận order được create, còn đối với những order Refund / Partial Refund thì được cộng giá trị vào những card info khác.
  - Đối với order bị Cancel, thì Total Order KHÔNG countt
- **Sale Income**
- **Total Tip**
- **Total Refund** (Refund + Partial Refund)
- **Net Income**
- **Amount Collected**

Mỗi card gồm:

- Giá trị hiện tại theo date đang được chọn
- % so với previous period
- Mũi tên tăng / giảm
- Click vào mối card info, show column chart data theo giờ

---

_Source: Google Docs — "Business Snapshot" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
