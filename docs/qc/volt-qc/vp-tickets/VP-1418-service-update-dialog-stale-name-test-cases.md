---
title: Update Service dialog hiển thị tên cũ sau khi sửa service trong category (POS) — test cases
ticket: VP-1418 — https://linear.app/fastboy/issue/VP-1418/pos-service-update-dialog-shows-stale-name-after-editing-category
feature-spec: docs/screens/settings-services/settings-services-test-cases.md
spec-files: tests/regression/settings/vp-1418-service-update-dialog-stale-name.spec.ts
imported-at: 2026-11-02
---

# Test Cases – [POS] Service update dialog shows stale name after editing category service

**Ticket:** [VP-1418](https://linear.app/fastboy/issue/VP-1418/pos-service-update-dialog-shows-stale-name-after-editing-category) · PR volt-pos#1630
**Dev:** Nam Pham · **QC:** khanh_do — 7/7 PASS trên dev 1.1.62 (26/10/2026), QC Completed · Không có sub-issue.

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows bản cài (≥ 1.1.62), ngôn ngữ **English**.
- Đã đăng nhập POS. Luồng: ≡ → **Setting** → **Services & Products** → chọn 1 category service → nút **Edit** của 1 service
  → dialog **Update Service** (Service Name, Category, Price, Service Duration giờ + phút, Supply Fee, Service Description, Visibility).
- Nút **Update** chỉ bật khi form có thay đổi; Update thành công → toast "Service updated successfully" và dialog đóng. Nút X đóng không lưu.
- Spec automation chọn **category service đầu tiên có dòng** (không phải Product / Gift Card) và **service dòng đầu**, chụp lại toàn bộ giá trị
  ban đầu, đổi tên sang `QA1418-<tag>-A/B/C/D` rồi **trả lại nguyên trạng** ở `after()` (tên, mô tả, Supply Fee, thời lượng, Web Booking).
  Test tay 26/10 dùng category "Other test" → service "aaa".
- Spec có GHI dữ liệu (sửa service thật) → chỉ chạy DEV / staging.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Mở lại dialog sau khi Update

| TC ID        | Title                              | Priority | Precondition        | Test Data                                                                                   | Steps                                                                                            | Expected Result                                                                     | Status |
| ------------ | ---------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------ |
| TC-VP1418-01 | Đổi tên service rồi mở lại dialog  | Critical | Category có service | victory123 → victory456 (auto: tên gốc → `QA1418-<tag>-A`)                                  | 1. Edit service. 2. Đổi tên. 3. Update. 4. Mở lại Update Service của service đó                  | Bảng hiện tên mới; dialog mở lại hiển thị **tên mới**, không phải tên cũ            | ✅     |
| TC-VP1418-02 | Các field khác không bị dữ liệu cũ | High     | Như TC-01           | Description "QC desc VP-1418", Supply Fee $2.50, Duration 15 mins, bật Shown on Web Booking | 1. Edit. 2. Sửa Description, Supply Fee, phút Duration, Web Booking. 3. Update. 4. Mở lại dialog | Tất cả field hiển thị **giá trị vừa lưu** (Web Booking chỉ kiểm khi service Active) | ✅     |
| TC-VP1418-03 | Sửa liên tiếp nhiều lần            | Medium   | Đang ở màn category | victory456 → victory789 → victory999 (auto: A → B → C)                                      | 1. Sửa → Update → mở lại. 2. Sửa tiếp → Update → mở lại                                          | Mỗi lần mở lại đều hiện **tên mới nhất**                                            | ✅     |
| TC-VP1418-07 | Sửa nhưng không lưu                | Low      | Đang mở dialog      | Gõ `QA1418-DRAFT`, bấm X                                                                    | 1. Sửa tên. 2. Đóng dialog bằng X (không Update). 3. Mở lại                                      | Hiển thị **tên đã lưu**, không giữ bản nháp                                         | ✅     |

## 2. Dữ liệu mới ở nơi khác / sau khi đổi màn

| TC ID        | Title                                        | Priority | Precondition                | Test Data                                       | Steps                                                                                      | Expected Result                    | Status |
| ------------ | -------------------------------------------- | -------- | --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- | ------ |
| TC-VP1418-04 | Chuyển category khác rồi quay lại            | Medium   | Đã lưu tên mới              | Category khác (vd Skincare) ↔ category test     | 1. Chọn category khác. 2. Quay lại category test. 3. Mở dialog của service                 | Hiển thị **tên mới**               | ✅     |
| TC-VP1418-05 | Tên mới hiển thị ở màn Home                  | Medium   | Đã lưu tên mới              | Tên mới                                         | 1. Về Home. 2. Tìm service theo tên mới (ô Search service) / mở category                   | Ô service hiện **tên mới**         | ✅     |
| TC-VP1418-06 | Reload app rồi mở lại dialog                 | Medium   | Đổi tên sang tên mới khác   | victory999 → victory123 (auto: C → D)           | 1. Update. 2. Reload app (≡ → Reload). 3. Vào lại Setting → Services. 4. Mở dialog         | Hiển thị **tên vừa lưu**           | ✅     |
| TC-VP1418-08 | Dữ liệu service giữ đúng qua đổi version POS | Medium   | Có bản cài cũ hơn + mới hơn | 1.1.62 → cài 1.1.59 → Version Update lên 1.1.62 | 1. Sửa field, Update. 2. Cài bản cũ rồi nâng cấp lại bằng Version Update. 3. Mở lại dialog | Tất cả field vẫn là giá trị đã lưu | 🧱     |

Lý do 🧱 TC-08: phải gỡ / cài bản POS khác và khởi động lại app (mất phiên WebDriver) — chỉ test tay.

## Kết quả test tay (26/10/2026, POS Windows dev 1.1.62)

Pass 7 / Fail 0 (TC01–TC07 của comment QC, TC02 kiểm sau khi đổi version 1.1.62 → 1.1.59 → 1.1.62). Sau test đã trả service "aaa" về như cũ
(không mô tả, Supply Fee $0.00, 0 mins, tắt Shown on Web Booking).

## Kết quả automation

Chưa chạy (spec mới 02/11/2026). Lệnh: `npm run test:attach -- --spec tests/regression/settings/vp-1418-service-update-dialog-stale-name.spec.ts`.
