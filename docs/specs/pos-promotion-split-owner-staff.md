---
title: '[POS] Promotion Split Between Owner & Staff'
source: https://linear.app/fastboy/document/pos-promotion-split-between-owner-and-staff-42155f32c420
linear_id: fd3221c1-239a-485b-907e-96261f7ec9e0
team: VOLT
updated: 2026-07-19T15:25:50.644Z
---

# [POS] Promotion Split Between Owner & Staff

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Tính năng: Chia Promotion giữa Chủ tiệm và Thợ**

# **Tổng quan**

Tính năng này cho phép salon cấu hình cách chia phần giảm giá của Promotion giữa:

- Chủ tiệm (Owner)
- Thợ (Staff)

Hiện tại Promotion chỉ giảm trực tiếp trên tổng bill nhưng chủ tiệm là người chịu phần discount này.  
Sau khi triển khai tính năng, hệ thống sẽ:

- Tính phần discount chủ tiệm chịu
- Tính phần discount thợ chịu
- Phân bổ phần discount của thợ cho nhiều thợ trong cùng order

**Mục tiêu nghiệp vụ**

Cho phép salon:

- Tự chịu toàn bộ promotion
- Chia promotion với thợ
- Theo dõi promotion cost theo từng nhân viên

**Phạm vi áp dụng**  
Áp dụng cho 2 loại discount: Promotion và Manual Promotion

Không áp dụng cho

- Reward
- Gift card
- Discount item/~~manual discount~~
- Reward balance
- Tax

---

**Yêu cầu chức năng**

# **1. Cấu hình chia Promotion**

Khi apply Promotion, hệ thống cho phép nhập:

- Percent for owner (%)
- Percent for staff (%)

Quy tắc

- Tổng phải bằng 100%
- Default:
  - Owner = 100%
  - Staff = 0%

---

# **2. Hỗ trợ các loại Promotion**

Logic chia áp dụng cho:

- Promotion theo %
- Promotion theo số tiền ($)

---

# **3. Logic tính Promotion Split**

Ví dụ

Order Total = $100  
 Promotion = $10  
Owner = 50%  
Staff = 50%

Kết quả

- Owner chịu: $5
- Staff chịu: $5

---

# **4. Chia Promotion cho nhiều thợ**

Nếu order có nhiều thợ, phần promotion của staff sẽ được chia theo tỷ lệ giá trị service mà mỗi thợ thực hiện.

**Công thức**

```
Staff Promo Allocation =
(Staff Service Total / Total Service Amount)× Total Staff Promotion Amount
```

Ví dụ

Service

| Staff   | Service Total |
| ------- | ------------- |
| Staff A | $70           |
| Staff B | $30           |

Promotion

- Total Promo = $10
- Staff Portion = $5

Kết quả

| Staff   | Promo Share |
| ------- | ----------- |
| Staff A | $3.50       |
| Staff B | $1.50       |

---

# **5. Lưu dữ liệu**

Hệ thống cần lưu snapshot promotion split theo từng order để đảm bảo dữ liệu lịch sử không bị thay đổi khi config thay đổi sau này.

Dữ liệu cần lưu

Order Level

```
{
 "promotion_discount": 10,
 "promo_split_owner_percent": 50,
 "promo_split_staff_percent": 50,
 "promo_owner_amount": 5,
 "promo_staff_amount": 5
}
```

Staff Allocation Level

```
[
 {
   "staff_id": "A",
   "service_total": 70,
   "promo_staff_amount": 3.5
 },
 {
   "staff_id": "B",
   "service_total": 30,
   "promo_staff_amount": 1.5
 }
]
```

---

# **6. Yêu cầu UI**

Promotion Modal, thêm section mới: **Order promotion discount setting**

**Bao gồm:**

- Percent for owner (%)
- Percent for staff (%)

**Behavior**

- Validate tổng = 100
- Không cho Confirm nếu invalid
- Default = 100 / 0

**Validation Rules**

| Rule                | Behavior                  |
| ------------------- | ------------------------- |
| Owner + Staff ≠ 100 | Hiển thị validation error |
| Giá trị âm          | Không cho phép            |
| Empty value         | Không cho phép            |
| Promotion = 0       | Không tạo allocation      |

---

# **7. Report / Income / Payroll**

Hệ thống cần expose:

- Owner promotion expense
- Staff promotion expense
- Promotion allocation theo từng thợ

Dữ liệu này sẽ được dùng cho:

- Payroll
- Commission
- Sale report

---

_Source: Google Docs — "\[POS\] Promotion Split Between Owner & Staff" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
