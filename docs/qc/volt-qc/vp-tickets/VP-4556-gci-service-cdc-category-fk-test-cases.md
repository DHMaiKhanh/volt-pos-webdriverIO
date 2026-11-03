---
title: GCI service CDC update lỗi FK category khi category bị xóa đồng thời (BE) — test cases
ticket: VP-4556 — https://linear.app/fastboy/issue/VP-4556/be-gci-service-cdc-update-fails-with-category-fk-violation-when-the
spec-files: tests/regression/settings/vp-4556-gci-service-category-sync.spec.ts
imported-at: 2026-11-02
---

# Test Cases – [BE] GCI service CDC update fails with category FK violation when the category is deleted concurrently

**Ticket:** [VP-4556](https://linear.app/fastboy/issue/VP-4556/be-gci-service-cdc-update-fails-with-category-fk-violation-when-the) · PR volt-pos-api#1552 "fix(cdc): lock the category read in GCI service/item sync"
**Dev:** Thanh Lam, Võ Minh Hưng · **QC:** khanh_do — 5/5 PASS trên dev (02/11/2026) · Không có sub-issue.

## Điều kiện chung

- Lỗi gốc (prod 13/10/2026, merchant #21362): pipeline `syncing-cdc`, operation `service_update`, bảng `service` →
  `pq: insert or update on table "service" violates foreign key constraint "fk_e19d9ad212469de2" (23503)` khi merchant xóa category trên GCI
  trong lúc service của category đó đang được update. Fix: resolve category **1 lần** trong CTE dùng chung cho `category_id` và điều kiện guard
  (áp dụng cả `service_insert` và item).
- Môi trường DEV: GCI `pos.gocheckin.net` (Tenant Test Volpos) ↔ Volt POS merchant **#14** "Volt POS tiem test 14 v1".
- Cách verify phía BE: Portal → System → Monitoring → **Report tasks** → Type **Sys Notify Cdc Failure** (alert `syncing-cdc … fk_e19d9ad212469de2`).
- Phía POS chỉ quan sát được **kết quả sync** (category / service có hay không trong Setting → Services & Products). Tạo / xóa category trên GCI
  và đọc Monitoring trên Portal là thao tác tay — spec POS không làm được.
- Biến môi trường cho phần POS của spec: `VP4556_SYNC_CATEGORY` (tên category vừa tạo trên GCI, vd `QC-4556-A`), `VP4556_SYNC_COUNT` (số service
  mong đợi, vd `30`), `VP4556_DELETED_PREFIX` (tiền tố category đã xóa trên GCI, mặc định `QC-4556`).

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Sync GCI → POS (quan sát trên POS)

| TC ID        | Title                                               | Priority | Precondition                                        | Test Data                                          | Steps                                                                                     | Expected Result                                                                                  | Status |
| ------------ | --------------------------------------------------- | -------- | --------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| TC-VP4556-01 | Tạo category + nhiều service trên GCI sync sang POS | High     | Đã tạo trên GCI (Gap Setting → Service), đợi sync   | `QC-4556-A` + 30 service; `QC-4556-B` + 15 service | 1. Tạo category + service trên GCI. 2. POS: Setting → Services & Products. 3. Mở category | Category có trên POS, **đủ số service** (30/30, 15/15), đúng category                            | ⚠️     |
| TC-VP4556-04 | Dữ liệu POS sau khi xóa category trên GCI           | High     | Đã xóa `QC-4556-A` / `QC-4556-B` trên GCI, đợi sync | Tiền tố `QC-4556`                                  | 1. POS: Setting → Services & Products. 2. Xem tab Active và Inactive                      | Không còn category `QC-4556-*` ở cả 2 tab; service của chúng không còn hiển thị (status deleted) | ⚠️     |

## 2. Không còn lỗi CDC (BE / Portal Monitoring)

| TC ID        | Title                                                                 | Priority | Precondition                                  | Test Data                    | Steps                                                                                          | Expected Result                                                                                      | Status |
| ------------ | --------------------------------------------------------------------- | -------- | --------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4556-02 | Xóa category đang có 30 service (đúng case prod)                      | Critical | TC-01 xong (`QC-4556-A` có 30 service)        | `QC-4556-A`                  | 1. Xóa `QC-4556-A` trên GCI. 2. Portal → Monitoring → Report tasks, lọc Sys Notify Cdc Failure | Không phát sinh Sys Notify Cdc Failure / lỗi `fk_e19d9ad212469de2` (23503) sau thời điểm xóa         | 🧱     |
| TC-VP4556-03 | Xóa category đang có 15 service — test lại                            | High     | `QC-4556-B` có 15 service                     | `QC-4556-B`                  | 1. Xóa `QC-4556-B` trên GCI. 2. Đợi > 1 phút, Refresh Monitoring                               | Không có task Sys Notify Cdc Failure mới liên quan service / category                                | 🧱     |
| TC-VP4556-05 | Hồi quy: create / update service bình thường                          | High     | Category còn tồn tại                          | Service mới + sửa service cũ | 1. Tạo mới & update service trên GCI. 2. Kiểm tra POS và Monitoring                            | Sync bình thường lên POS, không có Sys Notify Cdc Failure                                            | 🧱     |
| TC-VP4556-06 | `service_insert` khi category bị xóa cùng lúc                         | Medium   | Tạo service và xóa category gần như đồng thời | —                            | 1. Trên GCI tạo service trong category X rồi xóa ngay X. 2. Xem Monitoring                     | Message insert được xử lý gọn (skip hoặc `category_id = NULL` theo hành vi đã chốt), không lỗi 23503 | 🧱     |
| TC-VP4556-07 | Resource tương tự (`staff_service`, `customer_checkin_service`, item) | Medium   | Có data liên kết với parent bị xóa            | —                            | 1. Xóa parent (category / service) khi bản ghi con đang sync. 2. Xem Monitoring                | Không phát sinh lỗi FK cùng kiểu cho các resource resolve parent bằng `ref_id`                       | 🧱     |
| TC-VP4556-08 | Hành vi khi category tham chiếu không còn được ghi tài liệu           | Low      | PR volt-pos-api#1552 đã merge                 | —                            | 1. Đọc PR / tài liệu pipeline `redpanda-connect/resource/gci/catalog/service.yaml`             | Có mô tả rõ: bỏ qua update hay update với `category_id = NULL`                                       | 📄     |

Lý do 🧱: thao tác trên GCI (`pos.gocheckin.net`, user tự đăng nhập) và đọc Portal Monitoring — ngoài tầm POS Windows. Lỗi gốc là race condition,
không tái hiện chắc chắn đúng thời điểm; QC đo bằng "không có alert mới".

## Kết quả test tay (02/11/2026, dev)

**5/5 PASS** — TC-01 (30/30, 15/15 service sync đúng category), TC-02 (xóa `QC-4556-A` ~11:20, không có Sys Notify Cdc Failure liên quan service),
TC-03 (xóa `QC-4556-B` ~14:49, vẫn 31 task, mới nhất 11:49 của #100004), TC-04 (category không còn, 30 + 15 service chuyển **deleted**), TC-05.
Task 11:29 của #14 là lỗi `customer_group` (`syncing-dts`, "Volt Pos Metadata must be a string") — không liên quan.

## Kết quả automation

Chưa chạy (spec mới 02/11/2026). Lệnh: `npm run test:attach -- --spec tests/regression/settings/vp-4556-gci-service-category-sync.spec.ts`
(TC-01 cần `VP4556_SYNC_CATEGORY`, nếu không đặt thì skip).
