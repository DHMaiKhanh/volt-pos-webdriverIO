---
title: 'Recalculate Report'
source: https://linear.app/fastboy/document/recalculate-report-84a21a4ac2ce
linear_id: e83825f4-bff4-4792-970e-02623d2352af
team: VOLT
updated: 2026-06-11T09:59:22.841Z
---

# Recalculate Report

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **Recalculate Report for Unprinted Payroll Period**

# **Overview**

Cho phép Owner/Admin thực hiện **Recalculate Payroll** đối với các kỳ lương chưa được Print Check nhằm xử lý các trường hợp Payroll được generate trước khi Compensation của staff được cấu hình đầy đủ hoặc được cập nhật chính xác.

Sau khi Compensation được cập nhật, hệ thống cho phép tính toán lại Payroll và đồng bộ toàn bộ dữ liệu liên quan để đảm bảo các báo cáo luôn phản ánh số liệu mới nhất.

---

# **Business Problem**

Hiện tại có thể xảy ra trường hợp:

- Payroll Period đã được generate.
- Một hoặc nhiều staff chưa được cấu hình Compensation.
- Payroll được tính ra không chính xác.
- Sau đó Owner mới cập nhật Compensation cho staff.

Trong trường hợp này, hệ thống cần cho phép tính lại Payroll mà không cần tạo lại Payroll Period.

---

# **Scope**

In Scope

- Recalculate Payroll Period chưa Print Check.
- Áp dụng lại Compensation hiện tại của staff.
- Cập nhật lại Payroll data.
- Đồng bộ lại các báo cáo liên quan.
- Giữ nguyên các dữ liệu nhập thủ công.
- Ghi nhận Audit Log.

Out of Scope

- Payroll đã Print Check.

---

# **Permission**

Cho phép các role có quyền Payroll thực hiện trên Portal.

---

# **UI Proposal**

Payroll Detail

Hiển thị action: Recalculate Payroll

Điều kiện hiển thị

Hiển thị khi:

- Payroll chưa Print Check

Ẩn hoặc Disable khi:

- Payroll đã Print Check

Tooltip:

Payroll cannot be recalculated after checks have been printed.

---

# **Recalculate Flow**

**Step 1:** Tại kì Payroll đang xem, click chọn Recalculate Payroll

**Step 2:** Hiển thị Confirmation Dialog

**Title:** Recalculate Payroll

Message

_Payroll amounts will be recalculated using current compensation settings._

_Manual adjustments will remain unchanged._

_Do you want to continue?_

Actions

- Cancel
- Recalculate

**Step 3:** System thực hiện Recalculate.

**Step 4:** Hiển thị kết quả.

Ví dụ: Payroll recalculated successfully.

---

# **Business Rules**

**Rule 1 – Compensation**

Khi thực hiện Recalculate:

Hệ thống áp dụng tất cả các setting trong Compensation hiện tại của staff.

---

**Rule 2 – Staff chưa có Compensation**

Nếu staff chưa được cấu hình Compensation:

- Vẫn hiển thị trong Payroll.
- Payroll Amount = $0.
- Không chặn quá trình Recalculate.
- Không phát sinh lỗi.

---

**Rule 3 – Các khoản được tính lại**

Hệ thống tính lại toàn bộ dữ liệu Payroll được generate tự động:

- Commission
- Salary
- Pay1/Pay2
- Các setting khác phát sinh từ Compensation

---

**Rule 4 – Recalculate nhiều lần**

Cho phép Recalculate nhiều lần.

Mỗi lần thực hiện:

- Sử dụng Compensation hiện tại.
- Ghi đè kết quả Payroll do hệ thống tự động tính trước đó.

---

# **Data Synchronization**

Sau khi Recalculate thành công, hệ thống phải đồng bộ lại tất cả module liên quan.

- Staff Payroll
- Staff Income Repor
- Income Summary Report

---

# **Processing Sequence**

Khi user thực hiện Recalculate Payroll:

```
Recalculate Staff Payroll
        ↓
Update Staff Income Report
        ↓
Update Income Summary Report
        ↓
Save Audit Log
```

Chỉ được xem là thành công khi toàn bộ các bước hoàn tất.

---

# **Transaction Rule**

Toàn bộ quá trình phải thực hiện trong cùng một action.

Nếu bất kỳ bước nào thất bại:

- Rollback toàn bộ dữ liệu.
- Không lưu dữ liệu một phần.

Ví dụ không được xảy ra trường hợp:

- Staff Payroll = dữ liệu mới
- Staff Income = dữ liệu cũ
- Income Summary = dữ liệu cũ

---

# **Audit Log**

Bắt buộc lưu Audit Log cho user thực hiện action Recalculate

---

# **Error Handling**

Payroll đã Print Check

Không cho phép Recalculate. Disable button action

Message: _Payroll cannot be recalculated after checks have been printed._

---

Không có thay đổi dữ liệu

Message: _Payroll recalculated successfully. No payroll changes detected._

---

# **Acceptance Criteria**

**AC01**

Given Payroll chưa Print Check

When user chọn Recalculate Payroll

Then hệ thống cho phép thực hiện Recalculate.

---

**AC02**

Given Payroll đã Print Check

When user chọn Recalculate Payroll

Then hệ thống không cho phép thực hiện.

---

**AC03**

Given Compensation của staff đã được cập nhật

When Payroll được Recalculate

Then Payroll Amount phải được tính lại theo Compensation mới nhất.

---

**AC04**

Given Staff chưa có Compensation

When Payroll được Recalculate

Then Payroll Amount của staff vẫn bằng $0.

---

**AC05**

Given Payroll có Bonus hoặc Deduction nhập thủ công

When Payroll được Recalculate

Then các giá trị này vẫn được giữ nguyên.

---

**AC06**

Given User thực hiện Recalculate Payroll

When quá trình hoàn tất

Then hệ thống phải lưu Audit Log.

---

**AC07**

Given User thực hiện Recalculate nhiều lần

When mỗi lần Recalculate hoàn tất

Then hệ thống luôn sử dụng Compensation hiện tại để tính toán.

---

**AC08**

Given Payroll được Recalculate thành công

When User mở Staff Payroll

Then dữ liệu phải phản ánh kết quả mới nhất.

---

**AC09**

Given Payroll được Recalculate thành công

When User mở Staff Income Report

Then dữ liệu phải phản ánh kết quả mới nhất.

---

**AC10**

Given Payroll được Recalculate thành công

When User mở Income Summary Report

Then dữ liệu phải phản ánh kết quả mới nhất.

---

**AC11**

Given một bước trong quá trình cập nhật dữ liệu thất bại

When Recalculate Payroll đang thực hiện

Then hệ thống phải rollback toàn bộ transaction.

---

**AC12**

Given Payroll được Recalculate thành công

When User xem các module Payroll, Staff Income và Income Summary

Then số liệu giữa các module phải đồng nhất và không được lệch nhau.

---

_Source: Google Docs — "Recalculate Report" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
