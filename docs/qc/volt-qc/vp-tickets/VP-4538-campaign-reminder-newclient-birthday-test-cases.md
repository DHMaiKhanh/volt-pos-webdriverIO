---
title: POS hỗ trợ Campaign Reminder, New Client và Birthday — test cases
ticket: VP-4538 — https://linear.app/fastboy/issue/VP-4538/kiem-tra-pos-ho-tro-campaign-reminder-new-client-va-birthday
feature-spec: docs/specs/customer-management.md
spec-files: tests/regression/order-flow/vp-4538-campaign-promotions.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – Kiểm tra POS hỗ trợ Campaign Reminder, New Client và Birthday

**Ticket:** [VP-4538](https://linear.app/fastboy/issue/VP-4538/kiem-tra-pos-ho-tro-campaign-reminder-new-client-va-birthday) · không có sub-issue
**Dev:** Thanh Lam (`lam_doan`) · **QC:** Võ Minh Hưng — PASS trên POS **1.1.57** (23/10/2026) · **Trạng thái:** QC Completed
**Diễn biến từ comment:**

- 12/10 — **New Client** lỗi: DTS tạo mã New Client nhưng khi sync về POS, mã tới trước thông tin khách → mã không gắn với khách → POS không thấy (đã fix). **Birthday**: DTS chưa tạo mã Birthday nào cho tiệm 14.
- 13/10 — tiệm **#19388** (campaign tạo trước khi onboard): snap lại dữ liệu → đã có campaign.
- 22/10 — Rule Birthday (PO): campaign Birthday phải gửi **SMS** tới SĐT khách, khách dùng đúng SĐT đó check-in/checkout mới thấy Birthday. Tiệm không mua SMS → không thấy Birthday là **đúng rule**.
- 23/10 — Sự cố: ai đó trên DTS đổi tên group "QA Group" → "QA Group Edit" (trùng group đã có) → POS không cho trùng tên → **kẹt toàn bộ sync customer** DTS → POS (khách DTS không về POS, khách POS không nhận New Client). Đã gỡ, tiệm 14 & 100004 sync đủ.

## Điều kiện chung

- Môi trường DEV, tiệm #14 "Volt POS tiem test 14 v1" (và tiệm #100004 / #19388 khi cần), POS Windows **≥ 1.1.57**.
- Campaign tạo trên **DTS**. Khách chỉ thấy campaign khi có **mã `campaign_customer`** do DTS cấp (New Client: khi khách mới sync lên; Birthday: khi gửi SMS; Reminder: theo lịch) — mã chưa dùng, chưa hết hạn.
- Luồng xem: Home → Quick Checkout → chọn staff → gắn khách (SĐT) → **Promo & Rewards** → mục Promotions.
- Spec đọc dữ liệu POS (GraphQL `campaignList`, `campaignCustomerList`, `customerList`) để biết dialog **phải** hiện gì; tiệm không có campaign / không có khách giữ mã loại đó → TC **skip** (không pass).
- Order nháp được xóa sau mỗi TC; khách mới (SĐT 832… ngẫu nhiên) ở TC-02 không xóa được trên POS.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện (dữ liệu campaign trên DTS) · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Dữ liệu campaign trên POS

| TC ID        | Title                                     | Priority | Precondition                                        | Test Data         | Steps                          | Expected Result                                                                   | Status |
| ------------ | ----------------------------------------- | -------- | --------------------------------------------------- | ----------------- | ------------------------------ | --------------------------------------------------------------------------------- | ------ |
| TC-VP4538-01 | Campaign của tiệm trên DTS đã sync về POS | High     | Tiệm có campaign trên DTS (kể cả tạo trước onboard) | Tiệm #14 / #19388 | 1. Đọc `campaignList` trên POS | Có campaign, nhận diện được loại Reminder / New Client / Birthday (type hoặc tên) | ✅     |

## 2. New Client

| TC ID        | Title                                            | Priority | Precondition                         | Test Data                            | Steps                                                                                                                        | Expected Result                                                                                       | Status |
| ------------ | ------------------------------------------------ | -------- | ------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4538-02 | Khách tạo mới trên POS thấy promotion New Client | Critical | Campaign New Client đang bật         | SĐT 832xxxxxxx, tên `QC Camp <rand>` | 1. Quick Checkout → staff → nhập SĐT mới → Done → tên → Save. 2. Chờ DTS cấp mã. 3. Mở order mới cho khách → Promo & Rewards | Mục Promotions có campaign **New Client** (trước fix: POS không hiện, DTS vẫn hiện)                   | ⚠️     |
| TC-VP4538-03 | Mã New Client gắn đúng khách trong dữ liệu POS   | High     | TC-02 đã tạo khách                   | Khách của TC-02                      | 1. Đọc `campaignCustomerList` theo customerId                                                                                | Có mã New Client, `customerId` = khách, chưa dùng / chưa hết hạn (lỗi race mã-tới-trước-khách đã fix) | ⚠️     |
| TC-VP4538-04 | Khách tạo trên DTS sync về POS                   | High     | Sync customer DTS → POS không bị kẹt | Khách mới trên DTS                   | 1. Tạo khách trên DTS. 2. Tìm khách trên POS                                                                                 | POS thấy khách mới                                                                                    | 🧱     |
| TC-VP4538-08 | Áp promotion New Client vào order                | Medium   | TC-02 thấy New Client                | Khách của TC-02                      | 1. Order có 1 dịch vụ có giá (order $0 không có gì để giảm). 2. Promo & Rewards → chọn New Client → Apply                    | Order hiện dòng **Promotion** trong phần tổng (order nháp, xóa sau test)                              | ✅     |

## 3. Reminder

| TC ID        | Title                                        | Priority | Precondition                                     | Test Data                           | Steps                                   | Expected Result                         | Status |
| ------------ | -------------------------------------------- | -------- | ------------------------------------------------ | ----------------------------------- | --------------------------------------- | --------------------------------------- | ------ |
| TC-VP4538-05 | Khách có mã Reminder thấy promotion Reminder | High     | Campaign Reminder bật, có khách giữ mã chưa dùng | Khách lấy từ `campaignCustomerList` | 1. Mở order cho khách → Promo & Rewards | Mục Promotions có campaign **Reminder** | ⚠️     |

## 4. Birthday

| TC ID        | Title                                                        | Priority | Precondition                             | Test Data             | Steps                                                                                                                | Expected Result                                                 | Status |
| ------------ | ------------------------------------------------------------ | -------- | ---------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| TC-VP4538-06 | Khách đã được gửi SMS Birthday thấy promotion Birthday       | High     | Tiệm có gói SMS, khách có mã Birthday    | Khách giữ mã Birthday | 1. Mở order, gõ SĐT; nếu hiện "Customers Found" (SĐT trùng nhiều khách) chọn đúng TÊN khách giữ mã → Promo & Rewards | Mục Promotions có campaign **Birthday**                         | ✅     |
| TC-VP4538-07 | Không có mã Birthday (không gửi SMS) thì không hiện Birthday | Medium   | Campaign Birthday bật, khách không có mã | Khách của TC-02       | 1. Promo & Rewards của khách                                                                                         | **Không** có campaign Birthday — đúng rule (tiệm không mua SMS) | ⚠️     |
| TC-VP4538-09 | SMS Birthday tới được SĐT khách                              | Medium   | Tiệm có gói SMS                          | SĐT thật              | 1. Đến ngày gửi. 2. Kiểm tra tin nhắn                                                                                | Khách nhận SMS chứa mã Birthday                                 | 🧱     |

## 5. Ngoài phạm vi automation POS

| TC ID        | Title                                                    | Priority | Precondition | Test Data                    | Steps                                                   | Expected Result                                                     | Status |
| ------------ | -------------------------------------------------------- | -------- | ------------ | ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| TC-VP4538-10 | Đổi tên group trùng trên DTS không làm kẹt sync customer | High     | —            | "QA Group" → "QA Group Edit" | 1. Đổi tên group trùng trên DTS. 2. Tạo khách DTS / POS | Sync customer vẫn chạy; khách DTS về POS, khách POS nhận New Client | 🧱     |

## Ghi chú automation

- 🧱 TC-04, TC-10: cần thao tác trên DTS web.
- 🧱 TC-09: SMS, không quan sát được từ POS.
- TC-02 chờ DTS cấp mã New Client tối đa `Timeouts.APP_BOOT`; TC-03 / 07 / 08 dùng lại khách TC-02 (TC-02 không chạy → skip).
- Loại campaign nhận diện theo `campaign.type` hoặc tên (`remind`, `new client`, `birth`) — kiểu chuỗi type của DTS chưa được tài liệu hóa phía POS.

Chạy: `npm run test:attach -- --spec tests/regression/order-flow/vp-4538-campaign-promotions.spec.ts`
