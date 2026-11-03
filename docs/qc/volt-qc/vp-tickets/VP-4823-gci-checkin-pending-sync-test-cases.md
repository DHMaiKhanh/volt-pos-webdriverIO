---
title: GoCheckin kiosk check-in → Pending Orders trên Volt POS (1/18 bị mất) — test cases
ticket: VP-4823 — https://linear.app/fastboy/issue/VP-4823/tiem-14-check-in-gocheckin-kiosk-thanh-cong-nhung-khong-len-order
feature-spec: docs/qc/volt-qc/windows-regression/06-pending-checkin.md
spec-files: tests/regression/order-flow/vp-4823-gci-checkin-pending-sync.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – [Tiệm 14] Check-in GoCheckin kiosk thành công nhưng không lên order pending trên Volt POS (1/18 bị mất)

**Ticket:** [VP-4823](https://linear.app/fastboy/issue/VP-4823/tiem-14-check-in-gocheckin-kiosk-thanh-cong-nhung-khong-len-order) · không có sub-issue
**Dev:** Thanh Lam (`lam_doan`) · **Trạng thái:** QC Completed — PASS trên dev **1.1.56** (22/10/2026)
**Lỗi gốc (20/10/2026):** chạy 18 check-in liên tiếp trên kiosk → 17/18 lên Pending Orders, mất **Bulk017 T76605** — SĐT **876-605-0017**, Gel Shellac / 1001vvv, tạo 10:08:52 giờ VN (03:08:52 UTC). Check-in #016 và #018 hiện bình thường → không phải do sync chậm.

## Điều kiện chung

- Môi trường DEV. Kiosk: GAP `gap.gocheckin.net` → đăng nhập OWNER tiệm **14** → mini app **GoCheckin**. Volt POS (Windows) đăng nhập **cùng tiệm** (`MERCHANT_ID` = `WEB_MERCHANT_ID`), nếu khác tiệm thì không thể sync → spec skip.
- Check-in tạo bằng web lane (Edge), mỗi check-in là khách mới: SĐT → tên → skip email/birthday → dịch vụ → thợ → ký → NEXT. Key được ghi ra `.tmp/`:
  - Batch: `CHECKIN_COUNT=18 CHECKIN_BULK_RESET=1 npm run web:checkin-bulk` → `.tmp/web-checkin-bulk.json` (tên dạng `BulkNNN T76605`, SĐT `876605NNNN`).
  - Một check-in: `npm run web:checkin` → `.tmp/web-checkin-handoff.json`.
- Card Pending Orders chỉ hiện **2 chữ đầu của tên** + SĐT che `***-***-NNNN`.
- Oracle 2 lớp để biết check-in mất ở đâu: (1) dữ liệu POS — GraphQL `orderList` status `pending` + `customer.phone` + `customerCheckin.status = active`; (2) màn **Pending Orders** cuộn hết danh sách.
- Cửa sổ sync: poll tới `Timeouts.APP_BOOT`, mỗi 5 s (lỗi gốc đã quét 22 lần trong > 3 phút).

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện (cần web lane tạo check-in trước) · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Check-in hàng loạt (tái hiện ticket)

| TC ID        | Title                                                                 | Priority | Precondition                                           | Test Data                                            | Steps                                                                                         | Expected Result                                                                                     | Status |
| ------------ | --------------------------------------------------------------------- | -------- | ------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4823-01 | 18 check-in kiosk liên tiếp đều lên Pending Orders                    | Critical | Batch ≥ 18 check-in trong `.tmp/web-checkin-bulk.json` | `BulkNNN T76605`, Gel Shellac / 1001vvv, ~1 phút/cái | 1. Tạo batch trên kiosk. 2. POS → Pending Orders. 3. Cuộn hết danh sách, đối chiếu từng khách | **18/18** khách hiện (khớp tên 2 chữ đầu hoặc `***-***-NNNN`); không thiếu khách nào                | ⚠️     |
| TC-VP4823-02 | Mỗi check-in có order pending + check-in **active** trong dữ liệu POS | Critical | Như TC-01                                              | SĐT đầy đủ của từng khách                            | 1. GraphQL `orderList` pending (500 dòng mới nhất). 2. Lọc theo SĐT                           | Mỗi SĐT có ≥ 1 order pending với `customerCheckin.status = active` (thiếu → check-in không tới POS) | ⚠️     |
| TC-VP4823-03 | Mỗi check-in tạo đúng **1** order pending (không nhân đôi)            | High     | Như TC-01                                              | —                                                    | 1. Đếm order pending theo SĐT                                                                 | Không SĐT nào có > 1 order pending                                                                  | ⚠️     |

## 2. Một check-in end-to-end

| TC ID        | Title                                                       | Priority | Precondition                       | Test Data                           | Steps                                                                                 | Expected Result                                               | Status |
| ------------ | ----------------------------------------------------------- | -------- | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| TC-VP4823-04 | 1 check-in kiosk lên card Pending Orders đúng tên + SĐT che | High     | Có `.tmp/web-checkin-handoff.json` | Khách mới của `npm run web:checkin` | 1. Chờ order pending của SĐT trong dữ liệu POS. 2. Pending Orders → tìm theo mã order | Card hiện, chứa tên khách + `***-***-NNNN`; check-in `active` | ⚠️     |

## 3. Batch tải (ghi chú cuối ticket)

| TC ID        | Title                                | Priority | Precondition                      | Test Data        | Steps                                                              | Expected Result                | Status |
| ------------ | ------------------------------------ | -------- | --------------------------------- | ---------------- | ------------------------------------------------------------------ | ------------------------------ | ------ |
| TC-VP4823-05 | Batch 100 check-in không mất cái nào | Medium   | Batch ≥ 100 (`CHECKIN_COUNT=100`) | `BulkNNN T02785` | 1. Tạo 100 check-in. 2. Đối chiếu dữ liệu POS + màn Pending Orders | Tỉ lệ mất **0/100** ở cả 2 lớp | ⚠️     |

## 4. Ngoài phạm vi automation POS

| TC ID        | Title                                                           | Priority | Precondition                     | Test Data                             | Steps                                        | Expected Result                                                                                   | Status |
| ------------ | --------------------------------------------------------------- | -------- | -------------------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4823-06 | Kiosk báo lỗi khi submit bị rớt (không im lặng quay về màn SĐT) | Medium   | Server không nhận check-in       | —                                     | 1. Submit check-in khi server lỗi            | Kiosk hiện lỗi, không quay về màn nhập SĐT như đã thành công                                      | 🧱     |
| TC-VP4823-07 | Tra backend SĐT bị mất 8766050017                               | High     | Quyền xem log GAP / volt-pos-api | 876-605-0017, 20/10/2026 03:08:52 UTC | 1. Tra check-in. 2. Tra order. 3. Tra sync   | Xác định lỗi ở: server không nhận / có check-in nhưng không tạo order / có order nhưng không sync | 🧱     |
| TC-VP4823-08 | Mở lại app vẫn đủ check-in                                      | Medium   | Batch đã sync                    | —                                     | 1. Đóng / mở lại Volt POS. 2. Pending Orders | Đủ toàn bộ check-in của batch                                                                     | 🧱     |
| TC-VP4823-09 | POS và kiosk phải cùng tiệm mới sync                            | Low      | —                                | `MERCHANT_ID`, `WEB_MERCHANT_ID`      | —                                            | Khác tiệm thì không sync — đúng thiết kế, không phải bug                                          | 📄     |

## Ghi chú automation

- 🧱 TC-06: lỗi nằm ở kiosk / backend, không gây ra được từ POS.
- 🧱 TC-07: chỉ tra được trên log backend (GAP, volt-pos-api).
- 🧱 TC-08: cần restart app — không làm trên POS dùng chung (attach lane).
- 📄 TC-09: điều kiện tiên quyết; spec tự skip khi `MERCHANT_ID` ≠ `WEB_MERCHANT_ID`.
- Spec chỉ đọc (READ-ONLY); order pending do kiosk tạo vẫn nằm lại trên tiệm 14 sau khi chạy.

Chạy: `npm run test:attach -- --spec tests/regression/order-flow/vp-4823-gci-checkin-pending-sync.spec.ts`
