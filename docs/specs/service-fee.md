---
title: 'Service Fee'
source: https://linear.app/fastboy/document/service-fee-dedcb36a56e3
linear_id: 80891ed0-168f-4df9-a2e5-96888393e985
team: VOLT
updated: 2026-06-11T09:59:50.323Z
---

# Service Fee

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# Subtotal & Service Fee – Base-Price Ratio Allocation

### Mục đích

Tính tổng tiền (subtotal) cho 1 order có nhiều dịch vụ.

Mỗi dịch vụ có:

- Giá gốc (price)
- Phần trăm giảm giá (discount)
- Phí dịch vụ (service fee) tính theo phần trăm

Phí dịch vụ được tính dựa trên **tổng sau giảm giá**, nhưng **chia lại cho từng dịch vụ theo tỷ lệ giá gốc**.

**Tính phần tiền được tính phí**

→ Lấy giá gốc \* (1 - discount%) cho từng dịch vụ

→ Cộng tất cả lại

2️⃣ **Tính tổng service fee**

→ Lấy tổng vừa tính \* phần trăm service fee

3️⃣ **Chia fee cho từng dịch vụ**

→ Dựa theo tỷ lệ giá gốc của dịch vụ

(Ví dụ dịch vụ 1 = 5$, dịch vụ 2 = 15$ → tổng 20$

→ tỉ lệ = 25% và 75%)

4️⃣ **Tính tiền cuối của từng dịch vụ**

→ Giá gốc + fee được chia

5️⃣ **Subtotal (tổng cuối)**

→ Tổng tất cả giá gốc + tổng service fee

(Discount **không trừ** trong subtotal, chỉ dùng để tính fee)

Giả sử:

- Service 1: 5$ giảm 10%
- Service 2: 17$ giảm 50%
- Service fee = 10%

Bước tính:

- Sau giảm giá: 4.5 + 8.5 = 13
- Service fee = 13 × 10% = **1.3**
- Tỷ lệ giá gốc: 5/22 và 17/22
- Fee chia ra: 0.3 và 1.0
- Tổng từng service: 5.3 và 18.0
- **Subtotal = 23.3**

| Service      | Giá gốc | Giảm giá | Fee       | Tổng (đã gồm fee) |
| ------------ | ------- | -------- | --------- | ----------------- |
| Service 1    | $5      | 10%      | $0.30     | $5.30             |
| Service 2    | $17     | 50%      | $1.00     | $18.00            |
| **Subtotal** |         |          | **$1.30** | **$23.30** ✅     |

---

_Source: Google Docs — "Service Fee" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
