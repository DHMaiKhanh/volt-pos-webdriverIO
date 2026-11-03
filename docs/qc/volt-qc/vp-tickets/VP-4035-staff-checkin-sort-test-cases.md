---
title: Sort staff đã check-in theo thứ tự check-in (Home / Pending) — test cases
ticket: VP-4035 — https://linear.app/fastboy/issue/VP-4035/sort-checked-in-staff-by-check-in-order-on-pending-orders-screen
feature-spec: docs/qc/volt-qc/windows-regression/06-pending-checkin.md
spec-files: tests/regression/home/vp-4035-staff-checkin-sort.spec.ts
imported-at: 2026-11-02
updated-at: 2026-11-02
---

# Test Cases – Sort checked-in staff by check-in order on Pending Orders screen

**Ticket:** [VP-4035](https://linear.app/fastboy/issue/VP-4035/sort-checked-in-staff-by-check-in-order-on-pending-orders-screen) · không có sub-issue
**Dev:** Thien Duy (`thienduy_vo`) · **Trạng thái:** Done — QC PASS 7/7 trên POS Windows DEV **1.1.62** (26/10/2026)
**Yêu cầu:** danh sách staff đã check-in sắp xếp tăng dần theo giờ check-in (check-in sớm nhất lên đầu), staff check-in sau nối đuôi theo đúng thứ tự.

## Điều kiện chung

- Môi trường DEV, tiệm #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.62**.
- Vị trí test: **Home** → (Pending sidebar → Quick Checkout để mở khung order trống) → khu vực chọn staff → nút **Sort** cạnh ô "Search staff" → popover **Sort by** → **Staff Checked In** → **Ascending / Descending**.
- Check in / check out qua dialog **Time Keeping** (`/home?dialog=time-keeping`, passcode 8888 nếu tiệm bật). Giờ check-in đối chiếu ở cột "Available Staff" (IN).
- Spec chọn 2 staff đang **OUT** (A, B) và chạy theo chuỗi: A check-in → B check-in → A check-out → A check-in lại. Cuối spec check-out mọi staff đã check-in và trả sort về **Default Order**.
- Lưới staff bị virtualise → spec cuộn hết lưới để đọc toàn bộ thứ tự.
- Ghi chú: dữ liệu chấm công là thật (time_keeping) — chỉ chạy trên dev.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Sắp xếp theo thứ tự check-in

| TC ID        | Title                                                             | Priority | Precondition                                     | Test Data                                                   | Steps                                                                   | Expected Result                                                                                                                                   | Status |
| ------------ | ----------------------------------------------------------------- | -------- | ------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4035-01 | Sort theo thứ tự check-in (Ascending)                             | High     | Có staff đã check-in trong ngày                  | Lần test tay: 24234 → 1001vvv → 333 → … → Angela (11:31 AM) | 1. Sort → Staff Checked In → Ascending. 2. Đọc toàn bộ lưới staff       | Nhóm đã check-in đứng trước nhóm chưa check-in; staff check-in sớm nhất lên đầu                                                                   | ✅     |
| TC-VP4035-02 | Staff check-in mới nối đuôi phía sau                              | High     | Sort Staff Checked In – Ascending; ≥ 2 staff OUT | A rồi B (lần test tay: Pamela 05:59 PM → Zelene 06:00 PM)   | 1. Time Keeping → Check In A. 2. Check In B. 3. Về Home, đọc lưới       | A, B nằm sau mọi staff đã check-in trước đó; A trước B (… Angela → Pamela → Zelene)                                                               | ✅     |
| TC-VP4035-03 | Staff chưa check-in nằm sau nhóm đã check-in                      | Medium   | Như TC-02                                        | Hiha1, Thalia, Kani…                                        | 1. Đọc lưới ở Default Order. 2. Đọc lưới ở Staff Checked In – Ascending | Staff chưa check-in xếp sau nhóm checked-in, giữ đúng thứ tự mặc định giữa họ                                                                     | ✅     |
| TC-VP4035-04 | Sort Descending                                                   | Medium   | Như TC-02                                        | —                                                           | 1. Sort → Staff Checked In → Descending                                 | Staff chưa check-in lên trước (giữ thứ tự mặc định — sort ổn định, không đảo nhóm này), nhóm checked-in ở cuối từ mới nhất → sớm nhất (B trước A) | ✅     |
| TC-VP4035-05 | Staff check-out bị bỏ khỏi nhóm checked-in                        | Medium   | A đang check-in                                  | Check Out A                                                 | 1. Time Keeping → Check Out A. 2. Về Home, Ascending                    | A không còn trong nhóm checked-in, về nhóm chưa check-in (sau B)                                                                                  | ✅     |
| TC-VP4035-06 | Check-out rồi check-in lại trong ngày giữ vị trí lần check-in đầu | Medium   | A vừa check-out, B vẫn check-in                  | Check In lại A                                              | 1. Time Keeping → Check In A. 2. Về Home, Ascending                     | A quay lại nhóm checked-in, giữ vị trí theo lần check-in **đầu tiên** trong ngày → A trước B                                                      | ✅     |
| TC-VP4035-07 | Đối chiếu với Time Keeping                                        | Medium   | Có nhiều staff check-in                          | Giờ IN của A, B lúc check-in lần đầu                        | 1. So thứ tự trên Home với giờ IN ở Time Keeping                        | Thứ tự khớp giờ check-in (giờ A ≤ giờ B ⇔ A đứng trước B)                                                                                         | ✅     |

## 2. Ghi nhận ngoài phạm vi

| TC ID        | Title                                       | Priority | Precondition               | Test Data | Steps                            | Expected Result                                                                                         | Status |
| ------------ | ------------------------------------------- | -------- | -------------------------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP4035-08 | Reload app thì Sort quay về "Default Order" | Low      | Đang chọn Staff Checked In | —         | 1. Reload app. 2. Mở lại Sort by | Sort về "Default Order" (không giữ "Staff Checked In") — ghi nhận để team tham khảo, không thuộc ticket | 📄     |

## Ghi chú automation

- Các TC 02–07 chạy nối tiếp trên cùng 2 staff A, B (mỗi TC tự kiểm tra bước trước đã xong, nếu không thì skip).
- TC-07 dùng giờ IN hiển thị theo phút (h:mm AM/PM); 2 check-in trong cùng phút vẫn đúng vì điều kiện là "≤".
- 📄 TC-08: hành vi ngoài phạm vi, cần reload app trên POS dùng chung.

Chạy: `npm run test:attach -- --spec tests/regression/home/vp-4035-staff-checkin-sort.spec.ts`
