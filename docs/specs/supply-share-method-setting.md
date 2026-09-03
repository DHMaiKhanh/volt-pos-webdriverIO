---
title: 'Supply Share Method setting'
source: https://linear.app/fastboy/document/supply-share-method-setting-785d20754279
linear_id: c06758ce-4b03-4324-8035-ea148cd4d0d8
team: VOLT
updated: 2026-07-30T03:05:22.846Z
---

# Supply Share Method setting

## 1. Tổng quan

Hệ thống hỗ trợ hai phương pháp tính **Supply Share** đối với nhân viên được trả lương theo Commission.

Merchant có thể lựa chọn một phương pháp và áp dụng chung cho toàn bộ staff trong tiệm.

Setting được cấu hình tại:

**Merchant Settings → Payment & Transaction → Supply Share**

---

## 2. Phạm vi áp dụng

Phương pháp tính Supply Share được áp dụng tại:

- Staff Income
- Staff Payroll
- Income Summary
- Payroll Check/Print

Áp dụng cho các Compensation Type có tính Commission:

- Commission Only
- Commission + Salary, trong trường hợp kỳ Payroll được trả theo Commission

Không áp dụng cho Salary Only.

---

## 3. Cách cấu hình

Tại section **Supply Share**, merchant chọn field:

**Supply Share Calculation Method**

Hệ thống hỗ trợ hai lựa chọn:

- **Deduct Before Commission**
- **Deduct After Commission**

Giá trị mặc định là:

**Deduct Before Commission**

Setting được lưu theo merchant và áp dụng chung cho tất cả staff. Hiện tại không hỗ trợ chọn phương pháp riêng cho từng staff.

Merchant có thể cập nhật setting trên POS hoặc Portal. Thay đổi ở một bên sẽ được đồng bộ sang bên còn lại.

---

# 4. Phương pháp 1: Deduct Before Commission

## Ý nghĩa

Supply Share được trừ khỏi Subtotal trước, sau đó hệ thống mới tính Commission cho staff.

Đây là phương pháp mặc định và cũng là công thức hệ thống đang sử dụng hiện tại.

## Công thức

`Commission = (Subtotal - Supply Share) × Commission Rate`

## Ví dụ

- Subtotal: $95.00
- Supply Share: $10.00
- Commission Rate: 60%

Kết quả:

`($95.00 - $10.00) × 60% = $51.00`

Staff nhận Commission là **$51.00**.

## Cách phân bổ chi phí

Với phương pháp này, Supply Share được chia giữa staff và tiệm theo tỷ lệ Commission.

Trong ví dụ trên:

- Phần Supply Share staff chịu: `$10 × 60% = $6`
- Phần Supply Share tiệm chịu: `$10 × 40% = $4`

Phương pháp này phù hợp khi tiệm muốn chia chi phí supply giữa staff và tiệm.

---

# 5. Phương pháp 2: Deduct After Commission

## Ý nghĩa

Hệ thống tính Commission trên toàn bộ Subtotal trước, sau đó trừ toàn bộ Supply Share khỏi Commission của staff.

## Công thức

`Commission = (Subtotal × Commission Rate) - Supply Share`

## Ví dụ

- Subtotal: $95.00
- Supply Share: $10.00
- Commission Rate: 60%

Kết quả:

`($95.00 × 60%) - $10.00 = $47.00`

Staff nhận Commission là **$47.00**.

## Cách phân bổ chi phí

Với phương pháp này, staff chịu toàn bộ Supply Share.

- Staff chịu: $10.00
- Tiệm không chịu phần Supply Share này

Phương pháp này phù hợp khi chính sách của tiệm quy định staff chịu 100% chi phí supply.

---

## 6. So sánh hai phương pháp

| Nội dung                     | Deduct Before Commission | Deduct After Commission |
| ---------------------------- | ------------------------ | ----------------------- |
| Subtotal                     | $95.00                   | $95.00                  |
| Supply Share                 | $10.00                   | $10.00                  |
| Commission Rate              | 60%                      | 60%                     |
| Commission của staff         | $51.00                   | $47.00                  |
| Phần Supply Share staff chịu | $6.00                    | $10.00                  |
| Phần Supply Share tiệm chịu  | $4.00                    | $0.00                   |

Điểm khác biệt chính:

- **Deduct Before Commission:** staff và tiệm cùng chia Supply Share theo tỷ lệ Commission.
- **Deduct After Commission:** staff chịu toàn bộ Supply Share.

---

## 7. Các quy tắc cần lưu ý

- Giá trị mặc định là **Deduct Before Commission** để không làm thay đổi cách tính hiện tại của merchant.
- Phương pháp được chọn áp dụng chung cho toàn bộ staff.
- Subtotal dùng để tính Commission không bao gồm Service Fee.
- Việc thay đổi setting không làm thay đổi các kỳ Payroll đã chốt hoặc đã print.
- Setting mới áp dụng theo effective date và logic Payroll hiện tại của hệ thống.
- POS và Portal luôn sử dụng cùng một phương pháp tính.
- Staff Income, Staff Payroll, Income Summary và Payroll Check phải hiển thị kết quả đồng nhất.
- Các Compensation Setting khác không bị ảnh hưởng.
