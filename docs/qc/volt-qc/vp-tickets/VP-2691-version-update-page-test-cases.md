---
title: Version Update — bỏ popup auto update, thêm trang thông tin POS update (POS Windows) — test cases
ticket: VP-2691 — https://linear.app/fastboy/issue/VP-2691/bo-popup-auto-update-va-them-trang-thong-tin-pos-update
sub-issues: VP-2787 (POS), VP-5102 (bug toast "Update failed" tràn nút)
spec-files: tests/regression/app/vp-2691-version-update.spec.ts
imported-at: 2026-11-02
---

# Test Cases – Bỏ popup auto update và thêm trang thông tin POS update

**Ticket:** [VP-2691](https://linear.app/fastboy/issue/VP-2691/bo-popup-auto-update-va-them-trang-thong-tin-pos-update) · sub-task POS [VP-2787](https://linear.app/fastboy/issue/VP-2787/pos-bo-popup-auto-update-va-them-trang-thong-tin-pos-update) (PR "feat(updater): replace auto-update popup with a software update page and dialog") · bug [VP-5102](https://linear.app/fastboy/issue/VP-5102/pos-toast-update-failed-bi-tran-nut-update-now-thu-lai-bi-che-khuat) (volt-pos#3157)
**Dev:** Nam Pham, Ngan Huynh · **QC:** khanh_do — 13/13 PASS trên 1.1.59 (26/10/2026), VP-5102 4/4 PASS

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows bản cài (≥ 1.1.59), ngôn ngữ **English**.
- Đã đăng nhập POS, đứng ở màn Home / Pending Orders.
- Luồng mở trang: header **≡ (Open sidebar)** → **Version Update** → dialog "Version Update" (URL thêm `?dialog=version-update`), mỗi lần mở tự kiểm tra lại.
- Server dev **không có bản mới hơn** bản đang cài → các case "có bản mới" dùng **updater giả lập** trong app:
  wrap `window.fetch` để trả lời lệnh IPC check của plugin updater bằng bản `<current + 1 patch>` (release notes trong `body` JSON),
  trả `null` (không có bản mới) hoặc lỗi mạng; lệnh **download / install luôn trả lỗi** → không bao giờ tải hay cài bản thật.
- Reload app là mất giả lập → cuối spec reload để trả POS về trạng thái thật. Watcher tự đóng toast updater của rootHooks được **tắt** trong spec này.
- Click bằng JS / text (không theo toạ độ): khi dialog Radix đang mở, toast nằm ngoài dialog bị `pointer-events: none`.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu.

## 1. Trang Version Update — server thật

| TC ID        | Title                                 | Priority | Precondition                            | Test Data          | Steps                                                                     | Expected Result                                                                                                                  | Status |
| ------------ | ------------------------------------- | -------- | --------------------------------------- | ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP2691-01 | Menu có mục Version Update (VU-01)    | High     | Đã đăng nhập POS                        | —                  | 1. Mở menu trái (≡). 2. Đọc danh sách mục + khối About                    | Có mục **Version Update**; footer hiện **Version: x.y.z**                                                                        | ✅     |
| TC-VP2691-02 | Trạng thái đã là bản mới nhất (VU-02) | High     | Server dev không có bản mới hơn bản cài | Version bản cài    | 1. Menu → Version Update. 2. Bấm refresh, chờ kiểm tra xong               | **You're Up to Date** + "Volt POS is running the latest version", Current version = version ở About, **không** có nút Update Now | ⚠️     |
| TC-VP2691-03 | Kiểm tra lại bằng nút refresh (VU-03) | Medium   | Đang mở Version Update                  | Check trả chậm ~2s | 1. Bấm icon refresh (Check for updates). 2. Quan sát trong lúc kiểm tra   | Hiện **Checking for Updates**, nút refresh bị khoá; xong thì quay về **You're Up to Date**, nút mở lại                           | ✅     |
| TC-VP2691-04 | Không còn popup auto update (VU-04)   | High     | Server không có bản mới                 | —                  | 1. Reload app (≡ → Reload). 2. Chuyển Order History, về Home. 3. Quan sát | Không có popup / dialog update nào bật lên (không "A New Update…", không "Update Required", không "Software Updating")           | ✅     |
| TC-VP2691-10 | Đóng trang Version Update (VU-10)     | Low      | Đang mở Version Update                  | —                  | 1. Bấm X của dialog                                                       | Dialog đóng, URL bỏ `?dialog=version-update`, vẫn ở màn hình cũ                                                                  | ✅     |

## 2. Có bản mới (giả lập) — thông báo & trang thông tin

| TC ID        | Title                                                   | Priority | Precondition                              | Test Data                     | Steps                                                                                               | Expected Result                                                                                                                                    | Status |
| ------------ | ------------------------------------------------------- | -------- | ----------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP2691-05 | Có bản mới: chỉ hiện toast, không chặn màn hình (VU-05) | High     | Updater giả lập có bản `<current+1>`      | Bản `<current+1>`             | 1. App phát hiện bản mới. 2. Chuyển Order History, về Home. 3. Đóng toast (X). 4. Chuyển trang tiếp | Toast **A New Update is Available** góc phải, không có popup/dialog chặn, POS thao tác bình thường. Đóng toast thì không hiện lại khi chuyển trang | ✅     |
| TC-VP2691-06 | Trang Version Update hiển thị đủ thông tin (VU-06)      | High     | Updater giả lập có bản `<current+1>`      | Release notes "E2E VP-2691 …" | 1. Menu → Version Update                                                                            | **A New Update is Available**, Current version = bản cài, Latest version = `<current+1>`, **Description** = release notes, có nút **Update Now**   | ✅     |
| TC-VP2691-07 | Bấm Update Now → Cancel (VU-07)                         | Medium   | Như TC-06                                 | —                             | 1. Bấm Update Now. 2. Bấm Cancel                                                                    | Hiện confirm **Update to version `<current+1>`?**; Cancel thì đóng, **không download**, trang vẫn còn bản mới                                      | ✅     |
| TC-VP2691-09 | Bản mới bị gỡ trước khi cài (VU-09)                     | Medium   | Có bản lúc mở trang, sau đó server bỏ     | Check đổi sang "không có bản" | 1. Update Now. 2. Xác nhận Update Now                                                               | Toast **No update is currently available.**, trang quay về **You're Up to Date**, không download                                                   | ✅     |
| TC-VP2691-11 | Mất mạng khi kiểm tra (VU-11)                           | Medium   | Chưa có bản mới trong app; check lỗi mạng | Check trả lỗi mạng            | 1. Bấm refresh                                                                                      | **Couldn't Check for Updates** + "Check the network connection and try again", không báo sai là đã mới nhất                                        | ✅     |
| TC-VP2691-12 | Menu báo có bản mới (VU-12)                             | Medium   | Updater giả lập có bản `<current+1>`      | —                             | 1. Mở menu trái (khi không có bản mới). 2. Có bản mới → mở lại menu                                 | Không có bản mới: không icon. Có bản mới: mục **Version Update** có icon cảnh báo (tam giác)                                                       | ✅     |

## 3. Update Now → download lỗi → toast "Update failed" (VP-5102)

| TC ID        | Title                                                | Priority | Precondition                                   | Test Data             | Steps                                                                                | Expected Result                                                                                                                                         | Status |
| ------------ | ---------------------------------------------------- | -------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP2691-08 | Update Now → download lỗi → toast lỗi (VU-08)        | Critical | Có bản `<current+1>` (giả lập), download lỗi   | Download trả lỗi      | 1. Update Now. 2. Xác nhận Update Now. 3. Download lỗi                               | Hiện **Software Updating** → toast **Update failed. Please try again.** có 2 nút **Update Later** / **Update Now** và nút X; overlay đóng               | ✅     |
| TC-VP2691-13 | Toast lỗi: thử lại / Update Later / X (VU-13)        | High     | Đang hiện toast "Update failed"                | —                     | 1. Bấm Update Now trên toast. 2. Lỗi lại → Update Later. 3. Lỗi lại → X              | Update Now chạy lại download; Update Later và X đóng toast, bản `<current+1>` vẫn còn trên trang Version Update                                         | ✅     |
| TC-VP2691-14 | VP-5102 BUG-01: toast lỗi hiển thị gọn, đủ 2 nút     | Critical | Toast "Update failed" đang hiện, màn 1920×1080 | getBoundingClientRect | 1. Đo khung toast và 2 nút. 2. Đo cỡ chữ. 3. Kiểm tra điểm giữa mỗi nút không bị che | Toast nằm trong màn hình; **Update Later** và **Update Now** nằm **trong** khung toast và trong màn hình, chữ ≥ 16px (fix: 20px), không phần tử nào che | ✅     |
| TC-VP2691-15 | VP-5102 BUG-02: bấm Update Now trên toast để thử lại | Critical | Đang hiện toast lỗi                            | —                     | 1. Bấm Update Now trên toast                                                         | Toast đóng, chạy lại **Software Updating** và download lại; lỗi tiếp thì toast hiện lại                                                                 | ✅     |
| TC-VP2691-16 | VP-5102 BUG-03: bấm Update Later                     | Medium   | Đang hiện toast lỗi                            | —                     | 1. Bấm Update Later                                                                  | Toast đóng, trang Version Update vẫn còn bản `<current+1>` và nút Update Now                                                                            | ✅     |
| TC-VP2691-17 | VP-5102 BUG-04: bấm X đóng toast                     | Low      | Đang hiện toast lỗi                            | —                     | 1. Bấm X                                                                             | Toast đóng giống Update Later, bản `<current+1>` vẫn còn                                                                                                | ✅     |

## 4. Ngoài phạm vi automation

| TC ID        | Title                                                         | Priority | Precondition                                   | Test Data  | Steps                                                                      | Expected Result                                                                                                                 | Status |
| ------------ | ------------------------------------------------------------- | -------- | ---------------------------------------------- | ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP2691-18 | Update thật: tải + cài, app khởi động lại lên bản mới         | High     | Server có bản Published mới hơn (lên kế hoạch) | Bản thật X | 1. Version Update → Update Now → xác nhận. 2. Chờ installer. 3. App mở lại | Software Updating chạy tới 100%, installer chạy, app mở lại; About = X; dữ liệu order/setting còn nguyên, đăng nhập/passcode OK | 🧱     |
| TC-VP2691-19 | Force update (bản đang chạy bị Deprecated) không bị ảnh hưởng | High     | Admin Deprecate bản đang chạy trên Portal      | —          | 1. Mở app / đổi route. 2. Nhấn Esc, click ngoài                            | Chuyển `/force-update` "Update Required", tự cài; không đóng được; Customer Display sang `/customer/force-update`               | 🧱     |

Lý do 🧱: TC-18 cài bản thật làm app restart (mất phiên WebDriver, không rollback được); TC-19 cần Portal Deprecate version và màn force-update tự cài ngay khi mở — không được chạy trên POS dùng chung.

## Kết quả test tay

- 26/10/2026 dev **1.1.57**: 10/11 PASS — FAIL VU-08 (nút Update Now của toast lỗi nằm x = 1907–1991, ngoài màn 1920px) → tách bug VP-5102.
- 26/10/2026 dev **1.1.59**: **13/13 PASS**, VP-5102 4/4 PASS (toast x = 1220–1896; Update Later 1326–1448, Update Now 1480–1598, chữ 20px). VP-2691, VP-2787, VP-5102 → QC Completed.

## Kết quả automation

Chưa chạy (spec mới 02/11/2026). Lệnh: `npm run test:attach -- --spec tests/regression/app/vp-2691-version-update.spec.ts`.
