---
title: Receipt hiển thị đầy đủ Business Phone thay vì che số — test cases
ticket: VP-4390 — https://linear.app/fastboy/issue/VP-4390/receipt-hien-thi-djay-dju-business-phone-thay-vi-che-so
sub-issues: —
spec-files: tests/regression/settings/vp-4390-receipt-business-phone.spec.ts, tests/web/portal-vp-4390-receipt-business-phone.spec.ts
imported-at: 2026-11-05
updated-at: 2026-11-05
---

# Test Cases – Receipt: Hiển thị đầy đủ Business Phone thay vì che số

**Ticket:** [VP-4390](https://linear.app/fastboy/issue/VP-4390/receipt-hien-thi-djay-dju-business-phone-thay-vi-che-so) · project Maintenance 2026-Q4-M11-W1 · Urgent
**Dev:** Ngan Huynh (`ngan_huynh`) · PR FastboyMarketing/volt-pos#3337 (`receipt-preview-header.tsx`, vào `develop` 04/11) · PR FastboyMarketing/fastboy-portal#960 (`order-receipt-merchant-header.tsx`, vào `main` 04/11)
**Trạng thái:** QC Completed — test tay trên dev 1.1.98 + Portal DEV (05/11/2026): 6/6 PASS.
**Tự động (05/11/2026, dev 1.1.98):** spec POS 5/5 PASS (TC-01..05) + spec Portal TC-06 PASS (`npm run portal:vp-4390`, sau `npm run portal:login` khi `.portal-profile/` hết phiên). Tổng 6 PASS / 0 FAIL.

## Hành vi mong đợi

1. Bật **Business phone** trong Setting → Receipt → Logo & Branding → receipt hiện **đủ** số điện thoại doanh nghiệp, định dạng `(xxx) xxx-xxxx`, không có dấu `*`.
2. Áp dụng cho: Receipt Preview (Setting → Receipt), Receipt Details trên POS (Order History → Receipt, dùng chung `ReceiptPreviewHeader`), bản in, và Receipt details trên web (Portal → Orders → order → Receipt).
3. Tắt Business phone → không có dòng số điện thoại.
4. Chỉ số của **khách** vẫn bị che (`***-***-1234`) — không đổi.

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", Business phone (888) 887-6789. POS Windows **≥ 1.1.98** (có PR #3337).
- Setting → Receipt: **Business phone = ON** (đã lưu). Spec chỉ bật/tắt trên form rồi trả lại, **không Save**.
- `VP4390_CUSTOMER_ORDER` — order đã thanh toán có khách gắn SĐT (mặc định `OD261104-30413574`, khách thien duy `***-***-3456`).
- `VP4390_PORTAL_ORDER_ID` — id (uuid) của order đó trên Portal (mặc định `01a1a5ab-0f06-778e-8581-3a563c79b806`).
- Không cần máy in: Print vẫn gửi `mutation print` (base64 ESC/POS) qua IPC rồi mới báo "Printer not connected"; spec bắt payload bằng wrap `window.fetch` (helper VP-5634) và giải mã.
- Portal chạy trên lane web (`.portal-profile/` đã đăng nhập, `npm run portal:login`).

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu · 🐞 đang FAIL do bug đã log.

## 1. Setting → Receipt (Receipt Preview)

| TC ID        | Title                                  | Priority | Precondition        | Test Data      | Steps                                                               | Expected Result                                                           | Status |
| ------------ | -------------------------------------- | -------- | ------------------- | -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| TC-VP4390-01 | Receipt Preview hiện đủ Business phone | High     | Business phone = ON | (888) 887-6789 | 1. Setting → Receipt. 2. Đọc Receipt Preview                        | Preview có "(888) 887-6789" (đủ 10 số), không có `*`                      | ✅     |
| TC-VP4390-02 | Tắt Business phone → ẩn dòng số        | Medium   | Như TC-01           | —              | 1. Bỏ tick Business phone. 2. Đọc preview. 3. Tick lại (không Save) | Tắt → không còn số; bật lại → hiện đủ số; Save không bật (form không đổi) | ✅     |
| TC-VP4390-03 | Số trên preview khớp Business Info     | Medium   | —                   | —              | 1. Setting → Business Info, đọc Business phone. 2. So với preview   | Cùng 10 chữ số, cùng định dạng `(xxx) xxx-xxxx`                           | ✅     |

## 2. Order History → Receipt Details (POS) + bản in

| TC ID        | Title                                           | Priority | Precondition           | Test Data               | Steps                                                      | Expected Result                                                                   | Status |
| ------------ | ----------------------------------------------- | -------- | ---------------------- | ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| TC-VP4390-04 | Receipt Details trên POS hiện đủ Business phone | High     | Có order đã thanh toán | Order mới nhất          | 1. Order History → mở order. 2. Bấm Receipt                | Dialog "Receipt Details" có "(888) 887-6789", không có `(***)`/`***-***` ở header | ✅     |
| TC-VP4390-05 | SĐT khách vẫn che + bản in                      | High     | Order có khách gắn SĐT | `VP4390_CUSTOMER_ORDER` | 1. Mở order → Receipt. 2. Bấm Print (bắt payload, giải mã) | Dialog + bản in: Business phone đủ số; SĐT khách dạng `***-***-NNNN`              | ✅     |

## 3. Web (Portal)

| TC ID        | Title                                  | Priority | Precondition        | Test Data                | Steps                                    | Expected Result                                           | Status                                        |
| ------------ | -------------------------------------- | -------- | ------------------- | ------------------------ | ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| TC-VP4390-06 | Receipt details trên Portal hiện đủ số | High     | Portal đã đăng nhập | `VP4390_PORTAL_ORDER_ID` | 1. Portal → order detail. 2. Bấm Receipt | Panel "Receipt details" có "(888) 887-6789", không có `*` | ⚠️ cần `.portal-profile/` còn phiên đăng nhập |
