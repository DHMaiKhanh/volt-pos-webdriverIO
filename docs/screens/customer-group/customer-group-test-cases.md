---
title: Customer Group — cho phép trùng tên (POS) — test cases
ticket: VP-4566 — https://linear.app/fastboy/issue/VP-4566/bo-required-trung-ten-khi-tao-customer-group
feature-spec: docs/specs/customer-management.md
spec-files: tests/regression/customer-group/customer-group-duplicate.spec.ts
imported-at: 2026-10-29
updated-at: 2026-10-29
---

# Test Cases – [POS] Bỏ required trùng tên khi tạo Customer Group

**Ticket:** [VP-4566](https://linear.app/fastboy/issue/VP-4566/bo-required-trung-ten-khi-tao-customer-group) · PR volt-pos#3149 (POS + Android) · volt-pos-api#1567 (API)
**Dev:** Thanh Lam (`lam_doan`) · **Bug Portal liên quan:** VP-5214, VP-5215, VP-5216 (Portal only — POS không bị)

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **1.1.78** (Version Update báo "You're Up to Date").
- Đã đăng nhập POS, đứng ở màn Home.
- Luồng mở danh sách group: Home → Quick Checkout → gõ số điện thoại mới vào ô "Phone, name or email" → **Done**
  → dialog thêm khách nhanh → combobox **Select customer group** → popover **Add group**.
  - **New Group** → dialog có ô "Enter group name" + nút **Create**.
  - Bút chì **Edit group name** → dialog **Edit Group** + nút **Save**.
- Thông báo lỗi validate dùng chung: **"Group name is required."**
- POS không xóa được group → mỗi lần chạy spec để lại group test (tên có hậu tố ngẫu nhiên). Dọn trên Portal nếu cần.

Chú thích trạng thái: ✅ đã test tay khớp (29/10, 1.1.78) · ⚠️ có điều kiện · 🧱 chưa tự động được · 📄 chỉ tài liệu.

## 1. Danh sách & tạo group

| TC ID           | Title                                           | Priority | Precondition                                       | Test Data                | Steps                                                                                    | Expected Result                                                                                           | Status |
| --------------- | ----------------------------------------------- | -------- | -------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| TC-CUSTGROUP-01 | Popover "Add group" hiện đủ các group trùng tên | High     | Merchant đã có ≥ 2 group cùng tên (tạo nhiều ngày) | Tên `QC Dup <rand>` × 2  | 1. Tạo 2 group cùng tên (TC-03). 2. Mở lại popover Add group. 3. Đếm số dòng mang tên đó | Hiện **đủ 2 dòng** cùng tên, mỗi dòng có checkbox + bút chì riêng; group đã xóa không hiện                | ✅     |
| TC-CUSTGROUP-02 | Bỏ trống tên khi tạo group                      | High     | Đang mở dialog New Group                           | Tên rỗng                 | 1. New Group. 2. Để trống tên. 3. Create                                                 | Báo **"Group name is required."**, dialog vẫn mở, không tạo group                                         | ✅     |
| TC-CUSTGROUP-03 | Tạo group trùng tên group đã có                 | Critical | Đã có group tên X                                  | X = `QC Dup <rand>`      | 1. New Group → nhập X → Create. 2. New Group → nhập lại X → Create                       | Lần 2 **tạo thành công** (không còn lỗi "already in use"), group mới được tick sẵn; danh sách có 2 dòng X | ✅     |
| TC-CUSTGROUP-04 | Tạo group khác hoa/thường                       | Medium   | Đã có group X                                      | `x` = X viết thường      | 1. New Group → nhập X viết thường → Create                                               | Tạo thành công, hiện đúng chữ thường như đã nhập                                                          | ✅     |
| TC-CUSTGROUP-05 | Tên chỉ có khoảng trắng                         | High     | Đang mở dialog New Group                           | `"     "`                | 1. New Group. 2. Nhập toàn khoảng trắng. 3. Create                                       | Báo **"Group name is required."**, không tạo group                                                        | ✅     |
| TC-CUSTGROUP-06 | Tên có khoảng trắng đầu/cuối được trim          | Medium   | Đang mở dialog New Group                           | `"   QC Trim <rand>   "` | 1. New Group → nhập tên có space 2 đầu → Create                                          | Group lưu với tên **đã trim** `QC Trim <rand>`                                                            | ✅     |

## 2. Sửa tên group

| TC ID           | Title                              | Priority | Precondition                   | Test Data                                 | Steps                                                         | Expected Result                                                    | Status |
| --------------- | ---------------------------------- | -------- | ------------------------------ | ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| TC-CUSTGROUP-07 | Edit đổi tên thành tên group đã có | Critical | Có group A và group B khác tên | A = `QC Trim <rand>`, B = `QC Dup <rand>` | 1. Bút chì của A. 2. Đổi tên thành B. 3. Save                 | Lưu thành công, dialog Edit Group đóng, danh sách có thêm 1 dòng B | ✅     |
| TC-CUSTGROUP-08 | Edit thành tên chỉ có khoảng trắng | High     | Có group A                     | `"   "`                                   | 1. Bút chì của A. 2. Xóa tên, nhập toàn khoảng trắng. 3. Save | Báo **"Group name is required."**, tên A giữ nguyên                | ✅     |

## 3. Gán group cho khách

| TC ID           | Title                                                       | Priority | Precondition                  | Test Data                                     | Steps                                                         | Expected Result                                                                                        | Status |
| --------------- | ----------------------------------------------------------- | -------- | ----------------------------- | --------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| TC-CUSTGROUP-09 | Gán group trùng tên cho khách mới, group cũ không ảnh hưởng | Critical | Có 2 group cùng tên X (TC-03) | Khách `QC VP4566 <rand>`, SĐT ngẫu nhiên 832… | 1. Thêm khách nhanh. 2. Chỉ tick group X **mới tạo**. 3. Save | Khách lưu thành công, order mở với khách đó, thanh khách hiện chip X; group X cũ vẫn **không** bị tick | ✅     |

## Kết quả test tay (29/10/2026, POS Windows 1.1.78)

Pass 9 / Fail 0 — đã comment vào VP-4566. Android chưa test (cần APK build từ develop).

## Kết quả automation (29/10/2026, POS Windows 1.1.78, attach mode)

`npm run test:attach -- --spec tests/regression/customer-group/customer-group-duplicate.spec.ts` → **9 passing** (≈1m15s).
Mỗi lần chạy để lại 5 group `QC Dup <rand>` / `qc dup <rand>` trên merchant 14 (POS không xóa được group).
