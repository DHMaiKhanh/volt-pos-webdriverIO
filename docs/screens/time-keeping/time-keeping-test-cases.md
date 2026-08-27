---
title: time-keeping — Tài liệu hợp nhất
screen: time-keeping
route: /home?dialog=time-keeping
scanned-at: 2026-08-05
source: MCP Playwright (dialog không phải route — quét trực tiếp EN + VI; test case bổ sung 2026-08-05 bằng screen-test-generator)
---

# Chấm công (Time Keeping) — Feature Overview, Test Cases, Quét Tiếng Việt / UI vỡ

> **Tài liệu hợp nhất (1 file/màn).** Có PHẦN i18n (quét Tiếng Việt + nghĩa, 2026-07-05)
> và PHẦN Feature Overview + Test Cases (quét UI trực tiếp bằng Playwright MCP,
> 2026-08-05). Luồng code-gen (nếu có) giữ riêng ở codegen-flow/ + codegen-detail/.
> Kết quả HTML: reports/time-keeping/time-keeping.html.

## Feature Overview

### 1. Mục tiêu & phạm vi

Dialog **Time Keeping** mở từ icon đồng hồ trên header màn Home (deep-link
`/home?dialog=time-keeping`), dùng cho **nhân viên tự thao tác Check In / Check Out**
trong ca làm — khác với màn `/time-tracking` (owner quản trị Add/Edit/Delete bản ghi,
xem `docs/screens/time-tracking/time-tracking-test-cases.md`). Dialog này **không bị
passcode gate** khi mở qua deep-link (khác `/time-tracking`).

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần             | Vai trò (role/label)                                                         | Trạng thái                                        | Ghi chú                                                                            |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Dialog                 | `dialog` heading "Time Keeping"                                              | Mở qua deep-link, không cần passcode              | Nút "Close"                                                                        |
| Ô tìm kiếm             | `textbox` "Search staff"                                                     | —                                                 | Lọc đồng thời cả 2 cột theo tên/nickname                                           |
| Cột trái               | "Unavailable Staff" + badge số lượng                                         | Danh sách staff **chưa check-in** (đang OUT)      | Mỗi thẻ: avatar chữ cái đầu, tên, trạng thái "OUT" (+ mốc giờ OUT gần nhất nếu có) |
| Cột phải               | "Available Staff" + badge số lượng                                           | Danh sách staff **đã check-in** (đang IN)         | Mỗi thẻ: avatar, tên, "IN" + mốc giờ check-in                                      |
| Nút hành động trên thẻ | `button` "Check In" (cột Unavailable) / `button` "Check Out" (cột Available) | Chỉ hiện khi hover/click vào thẻ staff            | Click thẻ → lộ nút hành động tương ứng                                             |
| Empty state            | text "No staffs found."                                                      | Khi cột Available rỗng hoặc search không khớp     | **Chưa dịch tiếng Việt** — xem mục i18n bên dưới                                   |
| Toast                  | Notifications region (`alt+T`)                                               | "Check in successfully", "Check out successfully" |                                                                                    |

### 3. Luồng chính đã quan sát

1. Mở `/home?dialog=time-keeping` → dialog "Time Keeping" hiện ngay, không có passcode
   gate → 2 cột Unavailable/Available Staff hiển thị theo dữ liệu hiện tại.
2. Click vào 1 thẻ staff ở cột "Unavailable Staff" → thẻ lộ nút "Check In" → bấm nút →
   toast "Check in successfully" → staff chuyển sang cột "Available Staff" với nhãn
   "IN" + giờ hiện tại, badge số lượng 2 cột cập nhật (Unavailable -1, Available +1).
3. Click vào thẻ staff vừa check-in ở cột "Available Staff" → lộ nút "Check Out" →
   bấm nút → toast "Check out successfully" → staff quay lại cột "Unavailable Staff"
   với nhãn "OUT" + giờ hiện tại.
4. Gõ tên vào ô "Search staff" (vd "Bob") → cả 2 cột chỉ còn thẻ khớp tên; badge số
   lượng cập nhật theo kết quả lọc; nếu không khớp gì ở cột nào → cột đó hiện
   "No staffs found."

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- Một nhân viên chỉ ở đúng 1 trong 2 trạng thái tại một thời điểm: IN (Available) hoặc
  OUT (Unavailable) — khớp tài liệu Linear "chỉ có 1 ca đang mở".
- Check In/Out ở dialog này là **tự phục vụ, không cần chọn ngày giờ thủ công** (khác
  hẳn dialog Add/Edit ở `/time-tracking` cho phép owner chỉnh giờ) — hệ thống tự lấy
  giờ hiện tại.
- Search lọc đồng thời cả 2 cột theo cùng 1 từ khoá.

### 5. Trạng thái / quyền / edge case

- Empty state cột Available khi chưa ai check-in: "No staffs found." (chưa dịch —
  xem mục i18n).
- Chưa quan sát: hành vi khi 1 staff Inactive (theo Linear vẫn phải hiển thị trong
  Time Keeping listing nhưng dialog Home này chỉ hiện Active); giới hạn/permission
  khi user không có quyền check-in hộ người khác; đồng bộ giữa dialog này và bảng
  `/time-tracking` sau khi check-in/out (nên có bản ghi mới xuất hiện ở đó).

## Test Cases

| ID       | Tiêu đề                                                            | Tiền điều kiện                               | Các bước                                                                                                  | Kết quả mong đợi                                                                                                                                 | Ưu tiên |
| -------- | ------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| TC-TK-01 | Mở dialog Time Keeping qua deep-link, không bị passcode gate       | Chưa mở dialog                               | 1. Điều hướng `/home?dialog=time-keeping`                                                                 | Dialog "Time Keeping" hiện ngay lập tức, không có passcode dialog che                                                                            | P1      |
| TC-TK-02 | Danh sách Unavailable/Available Staff hiển thị đúng badge số lượng | Dialog đang mở                               | 1. Quan sát 2 cột                                                                                         | Badge số bên cạnh "Unavailable Staff" / "Available Staff" khớp số thẻ thực tế hiển thị trong từng cột                                            | P2      |
| TC-TK-03 | Check In một nhân viên (happy path)                                | Có ít nhất 1 staff ở cột Unavailable         | 1. Click vào thẻ staff ở cột Unavailable 2. Bấm nút "Check In" xuất hiện                                  | Toast "Check in successfully"; staff biến mất khỏi Unavailable, xuất hiện ở Available với nhãn "IN" + giờ hiện tại; badge 2 cột cập nhật         | P1      |
| TC-TK-04 | Check Out một nhân viên (happy path)                               | Staff đang ở cột Available (đã check-in)     | 1. Click vào thẻ staff ở cột Available 2. Bấm nút "Check Out" xuất hiện                                   | Toast "Check out successfully"; staff quay lại cột Unavailable với nhãn "OUT" + giờ hiện tại                                                     | P1      |
| TC-TK-05 | Tìm kiếm nhân viên lọc đồng thời cả 2 cột                          | Dialog đang mở, có dữ liệu ở cả 2 cột        | 1. Nhập tên/nickname staff vào ô "Search staff"                                                           | Cả 2 cột chỉ còn thẻ khớp từ khoá; cột không có kết quả hiện "No staffs found."                                                                  | P2      |
| TC-TK-06 | Đóng dialog bằng nút Close                                         | Dialog đang mở                               | 1. Bấm nút "Close" trên dialog                                                                            | Dialog đóng, quay về màn Home bình thường                                                                                                        | P3      |
| TC-TK-07 | Không cho Check-In 2 lần liên tiếp khi chưa Check-Out              | Staff đang ở trạng thái Available (đã IN)    | 1. Thử tìm cách Check In lại chính staff đó (staff không còn ở cột Unavailable nên không có nút Check In) | Không có đường thao tác Check-In lần 2 khi chưa Check-Out — UI tự đảm bảo ràng buộc bằng cách staff chỉ xuất hiện đúng 1 cột                     | P2      |
| TC-TK-08 | Bản ghi Check-In/Out đồng bộ sang bảng /time-tracking              | Vừa Check In một staff ở dialog Time Keeping | 1. Mở `/time-tracking`, unlock passcode 2. Tìm bản ghi của staff vừa check-in                             | Xuất hiện row mới với Date IN đúng thời điểm vừa check-in ở dialog Time Keeping (chưa xác minh trực tiếp trong lần quét này — cần test liên màn) | P2      |

Dialog mở từ **icon đồng hồ trên header** màn Home. Có **deep-link**:
`/home?dialog=time-keeping` (mở thẳng dialog — dùng cho scan tự động, ổn định hơn
click theo vị trí icon). Trước đây chỉ được đụng gián tiếp qua `HEADER_PANELS`
(idx 1, click mù theo vị trí) trong [`src/utils/i18nHome.ts`](../../src/utils/i18nHome.ts);
nay có scan riêng `scanTimeKeepingDialog`.

## Tổng quan

> tổng 6 nhãn chrome · ❌ chưa dịch **1** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **0**

## 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)         | Đang hiển thị (VI)              | Nên dịch                      | Nguồn (app)                                                |
| ------------------ | ------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `No staffs found.` | `No staffs found.` (giữ nguyên) | **Không tìm thấy nhân viên.** | `src/components/time-keeping/time-keeping-section.tsx:104` |

> Empty state của cột **"Nhân viên sẵn sàng"** khi chưa ai check-in. Đã có bản sửa ở
> **PR #1947** (app `volt-pos`): `t("global.noStaffsFound")` + key `vi` = "Không tìm thấy nhân viên."
> — PR chưa merge nên app đang chạy vẫn hiển thị tiếng Anh.

## 2. ⚠️ Dịch chưa đúng chuẩn

Không có. Các thuật ngữ đều khớp glossary / văn phong POS.

## 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không phát hiện tràn ngang hay cắt chữ. Lưu ý theo dõi: nhãn cột tiếng Việt
("Nhân viên chưa sẵn sàng") dài hơn EN ("Unavailable Staff") ~1.6× — hiện vẫn vừa khung
ở 1920px; cần kiểm tra lại ở màn hẹp.

## 4. ✅ Đã dịch đúng (mẫu)

| EN                | VI                      |
| ----------------- | ----------------------- |
| Time Keeping      | Chấm công               |
| Search staff      | Tìm nhân viên           |
| Unavailable Staff | Nhân viên chưa sẵn sàng |
| Available Staff   | Nhân viên sẵn sàng      |
| OUT (trạng thái)  | RA                      |
| Close             | Đóng                    |

Số đếm badge ("15" / "0"), tên nhân viên (Andy, Bob…), chữ cái avatar (A/B…) và
mốc thời gian (06/29/2026 11:42 AM) là **dữ liệu**, không tính vào lỗi dịch.

## 5. Ghi chú / đề xuất

- **Code-gen**: thêm `scanTimeKeepingDialog()` vào `src/utils/i18nHome.ts` (mở qua
  deep-link `/home?dialog=time-keeping`, quét portal dialog) và gọi trong
  `tests/regression/i18n/TC-i18n-home-vietnamese-scan.spec.ts`. Ổn định hơn
  `HEADER_PANELS` (click mù theo vị trí icon).
- **Glossary**: cân nhắc chốt cặp trạng thái chấm công **IN → VÀO**, **OUT → RA**
  vào `GLOSSARY` (`src/utils/i18nCompare.ts`) để lần sau tự phân loại `ok`.
- Sau khi PR #1947 merge, chạy lại scan để xác nhận "No staffs found." đã hết.
