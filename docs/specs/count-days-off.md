---
title: 'Count Days Off'
source: https://linear.app/fastboy/document/count-days-off-8a55b2dcc45e
linear_id: 9d25b6e0-c84b-45f6-b112-e81260ace54a
team: VOLT
updated: 2026-06-25T17:50:51.257Z
---

# Count Days Off

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Feature Definition — Count Days Off**

# **1. Business Purpose**

Tính năng **Count Days Off** được sử dụng để hỗ trợ cơ chế thỏa thuận trả lương giữa Chủ tiệm (Owner) và Nhân viên/Thợ (Staff).

Trong mô hình này, Staff có thể được áp dụng:

- Salary cố định
- Commission theo doanh thu/dịch vụ

Tính năng này cho phép Owner kiểm soát điều kiện nghỉ làm của Staff để xác định Staff có đủ điều kiện nhận Commission hay không.

---

# **2. Feature Overview**

Setting Name: Limit days off for this staff

Mục đích: cho phép giới hạn

- Số ngày nghỉ tối đa
- Các ngày không được phép nghỉ

Nếu Staff vi phạm bất kỳ điều kiện nào, Staff sẽ không đủ điều kiện nhận Commission và chỉ được nhận Salary.

---

# **3. Settings Configuration**

3.1. Enable/Disable Count Days Off

Field: Limit days off for this staff

Values

- OFF → Không áp dụng kiểm tra ngày nghỉ
- ON → Áp dụng kiểm tra ngày nghỉ

3.2. Maximum Days Allowed to Be Off

Field: Max days off allowed

Definition: Số ngày nghỉ tối đa mà Staff được phép nghỉ trong một payroll period.

Example: Max days off allowed = 2 → Staff chỉ được nghỉ tối đa 2 ngày.

| Total Day Off | Result   |
| ------------- | -------- |
| ≤ 2           | Valid    |
| \> 2          | Violated |

3.3. Days Not Allowed to Be Off

Field: Days not allowed to be off

Definition: Các ngày trong tuần mà Staff không được phép nghỉ.

**Example**

Selected:

- Friday
- Saturday
- Sunday

→ Staff không được nghỉ vào Friday, Saturday hoặc Sunday.

Nếu Staff nghỉ vào bất kỳ ngày nào trong danh sách này → Vi phạm rule.

---

# **4. Time Keeping Integration**

Business Requirement: Để xác định Staff có nghỉ làm hay không, hệ thống sẽ sử dụng dữ liệu từ tính năng **Time Keeping**.

Staff bắt buộc phải:

- Check-in khi đến làm việc
- Check-out khi kết thúc ca làm (optional)

---

# **5. Day Off Definition**

Một ngày được xem là **Day Off** khi:

```
Staff không có check-in/check-out hợp lệ trong ngày làm việc được yêu cầu
```

---

# **6. Valid Attendance Definition**

Một ngày được xem là làm việc hợp lệ khi:

- Staff có check-in hợp lệ trên Time Keeping
- Staff có check-out hợp lệ (opional)
- HOẶC hệ thống thực hiện Auto Check-out thành công  
  6.1. Auto Check-out Mechanism  
  Business Rule

Trong trường hợp Staff:

- đã check-in
- nhưng quên check-out

Hệ thống sẽ tự động thực hiện:

```
Auto Check-out at end of day
```

Ngày làm việc đó vẫn được xem là:

```
Valid Attendance
```

và KHÔNG bị tính là Day Off.

6.2. Day Off Definition (Updated)

Một ngày chỉ được tính là Day Off khi:

```
Staff không có check-in hợp lệ trong ngày làm việc được yêu cầu
```

Điều này có nghĩa:

- Có check-in nhưng quên check-out → vẫn được xem là đi làm hợp lệ nhờ Auto Check-out
- Không có check-in → mới bị xem là nghỉ làm (Day Off)

---

# **7. Violation Rules**

Staff được xem là vi phạm Count Days Off nếu:

```
Total Day Off  > Max days off allowed
```

HOẶC

```
Staff takes off on restricted weekdays
```

Ví dụ:

- Nghỉ vào Friday/Saturday/Sunday
- Dù tổng số ngày nghỉ chưa vượt mức cho phép  
  → vẫn bị xem là vi phạm.

---

# **8. Payroll Calculation Logic**

**Case 1 — Count Days Off = OFF**  
Condition

```
Limit days off for this staff = OFF
```

Business Rule

Hệ thống sẽ so sánh:

- Salary
- Commission

Payroll Logic

| Condition           | Final Payment  |
| ------------------- | -------------- |
| Commission > Salary | Pay Commission |
| Commission ≤ Salary | Pay Salary     |

Formula

```
Final Payment = MAX(Salary, Commission)
```

---

**Case 2 — Count Days Off = ON**  
Condition

```
Limit days off for this staff = ON
```

Hệ thống sẽ kiểm tra:

- Maximum days allowed to be off
- Days not allowed to be off

---

8.1. Staff DOES NOT violate any day-off rules  
Conditions

Staff đồng thời thỏa:

- Total Day Off ≤ Max days off allowed
- Không nghỉ vào restricted weekdays

Payroll Logic

| Condition           | Final Payment  |
| ------------------- | -------------- |
| Commission > Salary | Pay Commission |
| Commission ≤ Salary | Pay Salary     |

Formula

```
Final Payment = MAX(Salary, Commission)
```

---

8.2. Staff VIOLATES any day-off rule  
Conditions - Staff vi phạm ít nhất 1 rule:

- Total Day Off > Max days off allowed  
  HOẶC
- Nghỉ vào restricted weekdays

Payroll Logic

Staff sẽ mất quyền nhận Commission.

Hệ thống mặc định:

```
Final Payment = Salary
```

Kể cả khi:

```
Commission > Salary
```

→ Staff vẫn chỉ nhận Salary.

---

# **9. Payroll Rule Priority**

Khi Count Days Off được bật:

| Priority  | Rule                            |
| --------- | ------------------------------- |
| Highest   | Count Days Off validation       |
| Secondary | Salary vs Commission comparison |

Điều này có nghĩa:

- Nếu Staff vi phạm day-off rules  
  → hệ thống bỏ qua Commission calculation  
  → chỉ trả Salary.

---

# **10. Payroll Flow**

```
Step 1:
Check if Count Days Off is enabled

Step 2:
If OFF
→ Final Payment = MAX(Salary, Commission)

Step 3:
If ON
→ Validate attendance from Time Keeping

Step 4:
Check:
- Total Day Off
- Restricted weekdays off

Step 5:
If violation exists
→ Final Payment = Salary only

Else
→ Final Payment = MAX(Salary, Commission)
```

---

# **11. Examples**

**Example 1 — Count Days Off OFF**

| Salary | Commission | Result         |
| ------ | ---------- | -------------- |
| $1,000 | $1,500     | Receive $1,500 |
| $1,000 | $800       | Receive $1,000 |

---

**Example 2 — Count Days Off ON and NO violation**

Setting

- Max days off allowed = 2
- Restricted weekdays = Friday, Saturday

Actual

- Staff nghỉ 1 ngày
- Không nghỉ Friday/Saturday
- Salary = $1,000
- Commission = $1,500

Result

```
Final Payment = $1,500
```

---

**Example 3 — Violate Maximum Days Off**

Setting

- Max days off allowed = 2

Actual

- Staff nghỉ 3 ngày
- Salary = $1,000
- Commission = $1,500

Result

```
Final Payment = $1,000
```

Commission sẽ không được áp dụng.

---

**Example 4 — Violate Restricted Weekday**

Setting

- Restricted weekdays = Saturday

Actual

- Staff nghỉ Saturday
- Salary = $1,000
- Commission = $2,000

Result

```
Final Payment = $1,000
```

Dù Commission cao hơn vẫn chỉ nhận Salary.

---

# **12. Edge Cases / Clarification Needed**

**12.1. Missing Check-out**

Nếu Staff:

- Có check-in
- Cuối ngày sẽ có auto checkout

Attendance vẫn hợp lệ

Không tính Day Off

Không ảnh hưởng Count Days Off validation

---

**12.2. Manual Attendance Adjustment**

Owner/Manager có thể:

- chỉnh sửa Time Keeping
- approve attendance thủ công

Attendance đã approve sẽ được xem là hợp lệ.

---

**12.3. Non-working Schedule**

Nếu Staff không được schedule làm việc trong ngày đó:  
→ ngày đó không được tính là Day Off.

---

12.4. **Count days off không apply cho Salary by Period.**
Với staff có Compensation = **Commission + Salary** và Salary type = **Salary by Period**, hệ thống luôn so sánh:

> Final Payroll = Max(Commission, Salary by Period)

Tức là:

- Commission > Salary → trả Commission
- Commission < Salary → trả Salary
- Không xét ngày nghỉ
- Không cần check-in/check-out
- Count days off vẫn giữ setting, nhưng chỉ apply cho salary Wage per day / Wage per Hour

Lý do nên làm vậy:

Salary by Period là “lương cứng theo kỳ”, nên nếu đã không cần checkin/checkout chính xác thì cũng không nên dùng Count days off để tự động phạt/thay đổi cách tính. Nếu vẫn dùng sẽ dễ gây sai payroll vì hệ thống không biết thợ nghỉ thật hay chỉ không check-in.

---

_Source: Google Docs — "Count Days Off" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
