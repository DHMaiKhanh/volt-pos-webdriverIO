---
title: 'Login flow'
source: https://linear.app/fastboy/document/login-flow-0a3c431463e0
linear_id: 3bc954e6-0c70-460f-930a-ccb0c2e8b6f3
team: VOLT
updated: 2026-06-11T10:00:08.208Z
---

# Login flow

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Login flow, chỉ support login 1 cách suy nhất thông qua Business App**

1. **Create order từ CRM và có WhmcsID**
2. **Dùng thông tin WhmcsID + Package để create account POS**
3. **Sử dụng Business app và login bằng cách Scan QCcode**

- App Business: [https://dev.business.gocheckin.net/](https://dev.business.gocheckin.net/)
- Tiệm: Volt POS 14 - WhmcsID 14
- Owner phone: 205 205 2052 / 123456
- **Lưu ý**:
  - Phải login bằng thông tin Owner tiệm
  - Account Test: chọn đúng tiệm 14 rồi sau đó mới thực hiện Scan QR code

---

_Source: Google Docs — "Login flow" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
