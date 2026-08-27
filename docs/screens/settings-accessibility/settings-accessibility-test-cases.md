---
title: settings-accessibility — Tài liệu hợp nhất (i18n + Passcode Setting feature/testcase)
screen: settings-accessibility
route: /settings/accessibility
scanned-at: 2026-07-06
feature-scanned-at: 2026-07-21
source: compare.json + compare.html (TC-i18n-screen-compare, quét sau khi cuộn hết trang); VP-2400 (Linear, https://linear.app/fastboy/issue/VP-2400) + quét trực tiếp bằng Playwright MCP
---

# Hiển thị (Accessibility) — Feature Overview & Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi (VP-2400)

Thêm section **Passcode Setting** trong **Settings → General → Accessibility**, cho phép
merchant chủ động **bật/tắt** việc hiển thị modal **Passcode Verification** trên POS, thay
vì phải dùng tuỳ chọn tạm thời "Do not require passcode for the next 30 minutes" mỗi lần.
Hữu ích cho các tiệm cần thao tác nhanh, liên tục (ví dụ thanh toán dồn dập).

### 2. Các luồng chính (từ Linear)

- Section **Passcode Setting** chứa 1 switch: **Enable Passcode Verification** — `ON` (mặc
  định) / `OFF`.
- **Khi ON (mặc định):** hệ thống hoạt động như hiện tại — mọi action đang yêu cầu passcode
  (ví dụ mở các màn "gated" như Business Info, các báo cáo Income…) vẫn hiển thị modal
  "Enter your passcode" trước khi cho vào/thực hiện.
- **Khi OFF:** modal passcode **không hiển thị** cho các action đó — merchant vào/thực hiện
  ngay lập tức, không cần xác thực.
- **Business Rules:**
  - Giá trị mặc định: **ON**.
  - Setting lưu theo **merchant** (không phải theo từng thiết bị).
  - Thay đổi có hiệu lực **ngay lập tức** cho toàn bộ POS của merchant (không cần
    reload/re-login) — xem mục Đối chiếu bên dưới, đây là điểm đang **lệch** so với thực tế
    (VP-2586).
  - **Không** ảnh hưởng tới Permission/phân quyền hiện có — switch chỉ bỏ qua bước xác thực
    bằng passcode, không cấp thêm quyền.

### 3. Thành phần UI thực tế (quét bằng Playwright MCP, `/settings/accessibility`)

| Thành phần                                                                 | Vai trò                                | Trạng thái                                                    | Ghi chú                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `switch "Enable Passcode Verification"`                                    | Bật/tắt yêu cầu passcode               | mặc định `checked` (ON)                                       | Nằm trong khối "Passcode Setting", label phụ: "When off, actions that require a passcode run immediately without verification." |
| `switch "Show the virtual keyboard"`                                       | Cài đặt bàn phím ảo (Keyboard Setting) | độc lập với Passcode Setting                                  | Không bị ảnh hưởng khi toggle Passcode Setting (đã kiểm tra qua quét MCP).                                                      |
| `dialog "Enter your passcode"` (trên màn khác, ví dụ `/settings/business`) | Modal xác thực passcode                | chỉ xuất hiện khi Enable = ON và điều hướng tới route "gated" | Locator có sẵn ở `src/components/modal/PasscodeDialog.ts`.                                                                      |

### 4. Nghiệp vụ & ràng buộc

- Route `/settings/business`, `/incomes/income-daily`, `/incomes/income-summary`,
  `/incomes/income-staff` đã được khai báo `gated: true` trong
  `src/domains/i18n/i18nCompare.ts` (`SCREENS`) — đây là các route dùng để verify hành vi
  bật/tắt passcode (dùng `/settings/business` làm route đại diện, đơn giản nhất để mở).
- Passcode đúng dùng trong môi trường test: biến `OWNER_PASSCODE` (mặc định `8888`,
  `configs/env/.env.example`).

### 5. Trạng thái / quyền / edge case

- Trạng thái mặc định khi vào lần đầu: **ON**.
- Toggle OFF → điều hướng tới route gated → **không** có dialog passcode, nội dung hiện
  ngay.
- Toggle ON → điều hướng tới route gated → dialog passcode hiện lại như cũ.
- Giá trị của switch **được lưu bền** (persist) qua một lần **full reload** trên cùng một
  máy/session (đã verify bằng MCP: tắt → `page.goto` reload trang Accessibility → switch
  vẫn ở trạng thái OFF).
- **Known bug — VP-2586** (sub-task của VP-2400, trạng thái Todo tại thời điểm viết tài
  liệu): setting **không đồng bộ giữa các máy/thiết bị** của cùng merchant. Tắt trên máy A
  thì máy B vẫn hiển thị ON cho tới khi máy B tự reload/refetch — vi phạm Business Rule
  "áp dụng ngay cho toàn bộ POS của merchant". Test case tương ứng được viết ở dạng
  `test.fail` (giống mẫu `TC-LANG-05` trong `TC-language-switch.spec.ts`) để theo dõi bug
  này, sẽ gỡ `test.fail` khi bug được fix.

### 6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

| Điểm trong Linear (VP-2400)                                         | Thực tế UI (quét MCP 2026-07-21)                                                   | Khớp/Lệch                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| Section "Passcode Setting" trong Settings → General → Accessibility | Đúng vị trí, đúng tên section                                                      | ✅ Khớp                        |
| Mặc định ON                                                         | Switch có `checked` khi vào lần đầu                                                | ✅ Khớp                        |
| OFF → không hiện modal passcode                                     | Xác nhận: điều hướng `/settings/business` khi OFF không có dialog                  | ✅ Khớp                        |
| ON → hiện lại modal như cũ                                          | Xác nhận: dialog "Enter your passcode" xuất hiện lại khi bật ON                    | ✅ Khớp                        |
| "Thay đổi setting có hiệu lực ngay cho toàn bộ POS của merchant"    | Sub-task VP-2586 ghi nhận: **không đồng bộ giữa 2 máy** cùng merchant              | ❌ Lệch (bug đang mở, VP-2586) |
| "Không ảnh hưởng đến các chức năng/phân quyền khác"                 | Toggle Keyboard Setting (switch riêng) không bị ảnh hưởng khi đổi Passcode Setting | ✅ Khớp                        |

### 7. Nguồn tham chiếu

- Linear: [VP-2400](https://linear.app/fastboy/issue/VP-2400/pos-them-passcode-settings-dje-cau-hinh-cac-tinh-nang-yeu-cau-xac-thuc)
  (PR đính kèm: `FastboyMarketing/volt-pos#2146`); sub-task bug:
  [VP-2586](https://linear.app/fastboy/issue/VP-2586/enable-passcode-verification-setting-khong-djong-bo-giua-cac-may).
  Related: VP-2326.
  Quét trực tiếp: Playwright MCP tại `http://localhost:1420/settings/accessibility` và
  `http://localhost:1420/settings/business`, 2026-07-21.
- HTML i18n (mục dưới): `reports/settings-accessibility/compare.html` · JSON:
  `reports/settings-accessibility/compare.json`.

## Test Cases

| ID             | Tiêu đề                                                                  | Tiền điều kiện                                                             | Các bước                                                                                                                                                              | Kết quả mong đợi                                                                                                                                                         | Loại       | Ưu tiên |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| TC-PASSCODE-01 | Mặc định "Enable Passcode Verification" là ON                            | Vào `/settings/accessibility` lần đầu (chưa từng đổi setting)              | 1. Điều hướng tới `/settings/accessibility`                                                                                                                           | Switch "Enable Passcode Verification" ở trạng thái `checked` (ON)                                                                                                        | regression | P1      |
| TC-PASSCODE-02 | Tắt Passcode Verification ẩn modal passcode trên route gated             | Đang ở `/settings/accessibility`, switch đang ON                           | 1. Click switch để tắt (OFF)<br>2. Điều hướng tới `/settings/business` (route gated)                                                                                  | Không có `dialog "Enter your passcode"`; nội dung Business Info hiện ngay lập tức                                                                                        | regression | P1      |
| TC-PASSCODE-03 | Bật lại Passcode Verification hiện lại modal passcode                    | Switch đang OFF (từ TC-02)                                                 | 1. Quay lại `/settings/accessibility`, click switch để bật lại (ON)<br>2. Điều hướng tới `/settings/business`                                                         | `dialog "Enter your passcode"` hiển thị; nhập đúng `OWNER_PASSCODE` (8888) đóng dialog và vào được Business Info                                                         | regression | P1      |
| TC-PASSCODE-04 | Trạng thái switch được lưu bền qua reload                                | Switch đã tắt (OFF)                                                        | 1. Tắt switch<br>2. `page.reload()` (hoặc điều hướng lại `/settings/accessibility` bằng full navigation)                                                              | Switch vẫn ở trạng thái OFF sau reload (không revert về ON)                                                                                                              | regression | P2      |
| TC-PASSCODE-05 | Tắt Passcode Setting không ảnh hưởng Keyboard Setting                    | Switch Passcode đang ON                                                    | 1. Ghi nhận trạng thái switch "Show the virtual keyboard"<br>2. Tắt switch "Enable Passcode Verification"<br>3. Kiểm tra lại switch "Show the virtual keyboard"       | Trạng thái "Show the virtual keyboard" không đổi (độc lập với Passcode Setting)                                                                                          | regression | P3      |
| TC-PASSCODE-06 | (Known bug VP-2586) Setting không đồng bộ giữa 2 phiên/máy cùng merchant | Mở 2 `BrowserContext` (mô phỏng máy A & máy B) cùng đăng nhập một merchant | 1. Máy A: vào `/settings/accessibility`, tắt "Enable Passcode Verification"<br>2. Máy B (không reload): kiểm tra lại trạng thái switch trên `/settings/accessibility` | _Mong đợi (đúng Business Rule):_ máy B cập nhật OFF ngay. _Thực tế hiện tại:_ máy B vẫn hiển thị ON → test viết ở dạng `test.fail` để track VP-2586, gỡ khi bug được fix | regression | P2      |
| TC-PASSCODE-07 | Đưa switch về lại trạng thái mặc định (dọn dẹp)                          | Sau khi chạy các case trên, switch đang OFF                                | 1. Bật lại "Enable Passcode Verification" (ON)                                                                                                                        | Switch trở về `checked` (ON) — đảm bảo môi trường sạch cho lần chạy tiếp theo                                                                                            | regression | P3      |

### Câu lệnh chạy test

```bash
# Chạy toàn bộ suite (headless)
npx playwright test tests/regression/settings/TC-passcode-setting.spec.ts

# Chạy có trình duyệt (headed), tuần tự từng test để dễ theo dõi
npx playwright test tests/regression/settings/TC-passcode-setting.spec.ts --headed --workers=1

# Xem report HTML sau khi chạy
npx playwright show-report
```

# Hiển thị — Quét Tiếng Việt / UI vỡ / dịch đúng chuẩn

> **Tài liệu hợp nhất (1 file/màn).** Hiện mới có **PHẦN i18n** (quét Tiếng Việt + nghĩa). Đặc tả tính năng & test case sẽ bổ sung vào chính file này khi chạy skill 1/2. Luồng code-gen (nếu có) giữ riêng ở codegen-flow/ + codegen-detail/. Kết quả HTML: reports/settings-accessibility/settings-accessibility.html.

## Tổng quan

> **Chuỗi UI đối chiếu 30** · ❌ chưa dịch **0** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **0** · ✅ thuật ngữ đúng **30** · (data bỏ qua: 2 · tổng pair 37)
> Quét EN↔VI **sau khi cuộn hết trang** (`scrollThroughPage`). 🎉 **Không còn tiếng Anh & không sai chuẩn** trên view mặc định.
> Report trực quan: `reports/settings-accessibility/compare.html`

## 1. ❌ Chưa dịch (còn tiếng Anh)

> Không có.

## 2. ⚠️ Dịch chưa đúng chuẩn

> Không có. 30/30 thuật ngữ khớp glossary (view mặc định).

## 3. 📐 Vỡ giao diện (chỉ báo cáo)

> Không phát hiện: `xOverflow = 0px`, không có chuỗi bị cắt (`clipped = []`).

## 4. ✅ Đã dịch đúng (mẫu)

| EN                            | VI                           |
| ----------------------------- | ---------------------------- |
| Pending Orders                | Đơn đang chờ                 |
| Order History                 | Lịch sử đơn hàng             |
| Appointment                   | Lịch hẹn                     |
| Scanner                       | Quét mã                      |
| Internet connection restored. | Đã kết nối internet trở lại. |
| Setting                       | Cài đặt                      |
| Store & Account               | Cửa hàng & Tài khoản         |
| Business Info                 | Thông tin doanh nghiệp       |

## 5. Ghi chú / đề xuất bổ sung glossary

- View mặc định sạch. Nếu màn có **popup / dialog / form con** (thêm/sửa) → cần deep-scan bổ sung (mở dialog rồi quét) để phủ 100%.
- Chưa có sub-task Linear nào (VP-2252) chỉ đích danh màn này.

## 6. Nguồn tham chiếu

- HTML: `reports/settings-accessibility/compare.html` · JSON: `reports/settings-accessibility/compare.json`
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['settings-accessibility']`)
