---
title: Settings
source: playwright-mcp-scan
scanned-at: 2026-08-10
route: /settings (redirects to /settings/business), sidebar shell shared by all /settings/* pages
---

# Settings — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Màn **Settings** là khung điều hướng (shell) chung cho toàn bộ nhóm trang cấu hình
merchant: một sidebar bên trái ("Setting") liệt kê các nhóm mục, một khu vực nội dung
chính hiển thị trang con đang chọn, và một khối chân trang (Account/Logout, version,
device ID, support). Vào `/settings` sẽ tự động redirect tới `/settings/business`.

Phạm vi tài liệu này **chỉ** cover hành vi của cái shell (gate passcode, sidebar
navigation, active state, Logout, footer info) — nội dung chi tiết của từng trang con
đã/sẽ có doc riêng:

- Đã có doc riêng: `settings-business`, `settings-accessibility`, `settings-language`,
  `settings-roles`, `settings-services`, `settings-staffs`.
- Có trong sidebar nhưng **chưa có doc riêng** (ghi nhận để làm sau, không go sâu ở đây):
  `Permissions` (`/settings/permissions`), `Receipt` (`/settings/receipt`), `Charge & Fee`
  (`/settings/charge-fee`), `Tipping Settings` (`/settings/payment-transaction`),
  `Payment Gateway` (`/settings/payment-gateway`).

### 2. Gate truy cập

Mọi lần **navigate trực tiếp bằng URL** vào bất kỳ trang `/settings/*` đều hiện dialog
`"Enter staff code to access Merchant Settings Page"` (bàn phím số 0-9, không có nút
Cancel/đóng rõ ràng ngoài phím tắt) trước khi hiển thị nội dung — kể cả khi trước đó đã
nhập đúng passcode và đang ở trong khu vực Settings, nếu reload/điều hướng lại bằng URL
mới thì dialog vẫn xuất hiện lại (trừ khi tick "Do not require passcode for the next 30
minutes" — khi đó điều hướng nội bộ trong Settings, qua các link sidebar, sẽ không hỏi
lại; hành vi có thể phụ thuộc thêm vào switch "Enable Passcode Verification" ở
`/settings/accessibility`, xem `settings-accessibility-test-cases.md`).

- Passcode đúng dùng trong môi trường test: biến `OWNER_PASSCODE` (mặc định `8888`).
- Nhập sai/không đủ 4 số: chưa quan sát được vì test chỉ nhập đúng — cần bổ sung khi có
  case thất bại thật (không suy đoán ở đây).

### 3. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần                                                                                                                  | Vai trò / role                | Trạng thái                                | Ghi chú                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dialog "Enter staff code to access Merchant Settings Page"`                                                                | Passcode gate                 | Hiện khi vào `/settings/*` bằng URL mới   | Bàn phím số `getByRole('button', { name: '0'..'9', exact: true })`; checkbox "Do not require passcode for the next 30 minutes".                                                                                    |
| `heading "Setting" [level=3]`                                                                                               | Tiêu đề sidebar               | Luôn hiện khi đã qua gate                 | Không đổi theo trang con.                                                                                                                                                                                          |
| `navigation` (sidebar)                                                                                                      | Điều hướng giữa các trang con | Link đang active có thuộc tính `[active]` | Xem mục 6 danh sách đầy đủ nhóm/link.                                                                                                                                                                              |
| `link "Business Info"` → `/settings/business`                                                                               | Store & Account               | Active state khi đang ở trang tương ứng   | —                                                                                                                                                                                                                  |
| `link "Services & Products"` → `/settings/services`                                                                         | Service & Staff               | —                                         | —                                                                                                                                                                                                                  |
| `link "Employees"` → `/settings/staffs`, `link "Roles"` → `/settings/roles`, `link "Permissions"` → `/settings/permissions` | Employees Management          | —                                         | "Permissions" là trang nghiệp vụ đầy đủ (bảng quyền Owner/Manager/Partner/Staff theo module), chưa có doc riêng.                                                                                                   |
| `link "Receipt"` → `/settings/receipt`, `link "Charge & Fee"` → `/settings/charge-fee`                                      | Receipt & Payment             | —                                         | Chưa có doc riêng.                                                                                                                                                                                                 |
| `link "Tipping Settings"` → `/settings/payment-transaction`, `link "Payment Gateway"` → `/settings/payment-gateway`         | Payment & Transaction         | —                                         | Chưa có doc riêng.                                                                                                                                                                                                 |
| `link "Accessibility"` → `/settings/accessibility`, `link "Language"` → `/settings/language`                                | General                       | —                                         | Có doc riêng.                                                                                                                                                                                                      |
| `button "Logout"`                                                                                                           | Đăng xuất                     | Mở `alertdialog "Confirm Logout"`         | Nội dung: "Are you sure you want to logout? You will need to login again to access the application." — 2 nút: `button "Cancel"` (mặc định active/focus) và `button "Logout"`. Cancel đóng dialog, không đăng xuất. |
| `generic "Version: 0.1.0"`                                                                                                  | Hiển thị version app          | Tĩnh                                      | Giá trị build cụ thể sẽ đổi theo release, không hardcode assertion theo số version.                                                                                                                                |
| `button "Device ID:<uuid>"`                                                                                                 | Hiển thị/copy Device ID       | Click được                                | Không quan sát được toast/feedback rõ ràng trong accessibility snapshot sau click — cần xác nhận lại bằng clipboard hoặc screenshot nếu cần assert hành vi copy.                                                   |
| `generic "Support: (832) 968 9900"`                                                                                         | Số hotline support            | Tĩnh                                      | —                                                                                                                                                                                                                  |

### 4. Luồng chính đã quan sát

1. Vào `/settings` → redirect `/settings/business` → hiện dialog passcode → nhập đúng
   4 số → dialog đóng, nội dung "Business Info" hiện trong khu vực chính, sidebar hiện
   đầy đủ các nhóm mục.
2. Click 1 link sidebar (ví dụ "Permissions") → URL đổi sang `/settings/permissions`,
   link đó nhận `[active]`, nội dung chính đổi thành trang tương ứng, sidebar không phải
   nhập lại passcode (điều hướng nội bộ, không phải load URL mới).
3. Click "Logout" → `alertdialog "Confirm Logout"` hiện với 2 lựa chọn → click "Cancel"
   → dialog đóng, vẫn ở nguyên trang Settings, session không đổi.

### 5. Nghiệp vụ & ràng buộc suy ra từ UI

- Sidebar Settings nhóm các trang con theo 6 category cố định: Store & Account, Service &
  Staff, Employees Management, Receipt & Payment, Payment & Transaction, General — cộng
  thêm khối Account (Logout) và khối footer (version/device id/support) không thuộc
  navigation.
- Route `/settings` không có trang riêng — chỉ là alias redirect tới
  `/settings/business` (trang đầu tiên trong danh sách).
- Gate passcode áp dụng đồng nhất cho toàn bộ `/settings/*`, không riêng từng trang con.

### 6. Trạng thái / quyền / edge case

- Chưa quan sát được: nhập sai passcode, đóng dialog passcode bằng cách khác (Esc/click
  ra ngoài), hành vi khi checkbox "Do not require passcode..." được tick rồi reload
  trang, và nội dung chi tiết của các trang con chưa có doc riêng (Permissions, Receipt,
  Charge & Fee, Tipping Settings, Payment Gateway) — không suy đoán, để trống cho lần
  quét sau hoặc khi có yêu cầu tạo doc riêng cho từng trang đó.
- Không quan sát được toast/feedback khi click "Device ID" — cần xác minh thêm trước khi
  viết code test cho hành vi copy.

## Test Cases

| ID             | Tiêu đề                                                               | Tiền điều kiện                                        | Các bước                                                                                                     | Kết quả mong đợi                                                                                                                                                                    | Ưu tiên |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-SETTINGS-01 | Vào `/settings` redirect đúng trang mặc định                          | Đã đăng nhập POS, chưa mở Settings trong session này  | 1. Navigate tới `/settings`.                                                                                 | URL đổi thành `/settings/business`; dialog passcode hiện trước khi thấy nội dung.                                                                                                   | P1      |
| TC-SETTINGS-02 | Gate passcode chặn truy cập khi chưa xác thực                         | Chưa tick "Do not require passcode..."                | 1. Navigate trực tiếp tới `/settings/business` (URL mới, chưa qua gate).                                     | `dialog "Enter staff code to access Merchant Settings Page"` hiện, nội dung Business Info chưa hiển thị.                                                                            | P1      |
| TC-SETTINGS-03 | Nhập đúng passcode mở được Settings                                   | Dialog passcode đang mở                               | 1. Click 4 phím số đúng `OWNER_PASSCODE` (mặc định `8888`) qua `getByRole('button', { name, exact: true })`. | Dialog đóng; sidebar "Setting" + nội dung "Business Info" hiển thị.                                                                                                                 | P1      |
| TC-SETTINGS-04 | Tick "Do not require passcode for the next 30 minutes" trước khi nhập | Dialog passcode đang mở                               | 1. Tick checkbox "Do not require passcode for the next 30 minutes". 2. Nhập đúng passcode.                   | Vào được Settings như bình thường; điều hướng nội bộ tiếp theo trong sidebar không hỏi lại passcode (đã xác nhận qua bước điều hướng sidebar).                                      | P2      |
| TC-SETTINGS-05 | Sidebar liệt kê đủ 6 nhóm mục và các link con                         | Đã qua gate passcode, đang ở `/settings/business`     | 1. Snapshot sidebar navigation.                                                                              | Có đủ: Business Info; Services & Products; Employees, Roles, Permissions; Receipt, Charge & Fee; Tipping Settings, Payment Gateway; Accessibility, Language.                        | P1      |
| TC-SETTINGS-06 | Click 1 link sidebar chuyển đúng trang con và cập nhật active state   | Đang ở `/settings/business`                           | 1. Click `link "Permissions"`.                                                                               | URL đổi thành `/settings/permissions`; link "Permissions" nhận `[active]`; nội dung chính đổi thành heading "Permissions".                                                          | P1      |
| TC-SETTINGS-07 | Điều hướng nội bộ giữa các trang con không hỏi lại passcode           | Đã qua gate, đang ở 1 trang con bất kỳ trong Settings | 1. Click lần lượt 2-3 link sidebar khác nhau (ví dụ Roles → Language → Business Info).                       | Không có dialog passcode xuất hiện lại giữa các lần click; mỗi lần chuyển trang nội dung chính đổi đúng theo link đã click.                                                         | P2      |
| TC-SETTINGS-08 | Click Logout mở dialog xác nhận                                       | Đang ở bất kỳ trang con Settings                      | 1. Click `button "Logout"` trong khối Account.                                                               | `alertdialog "Confirm Logout"` hiện với text "Are you sure you want to logout? You will need to login again to access the application." và 2 nút Cancel/Logout.                     | P1      |
| TC-SETTINGS-09 | Cancel Logout không đăng xuất                                         | `alertdialog "Confirm Logout"` đang mở                | 1. Click `button "Cancel"`.                                                                                  | Dialog đóng; vẫn ở nguyên trang Settings hiện tại; session không đổi (không bị đưa về màn login).                                                                                   | P1      |
| TC-SETTINGS-10 | Confirm Logout đăng xuất khỏi ứng dụng                                | `alertdialog "Confirm Logout"` đang mở                | 1. Click `button "Logout"` trong dialog xác nhận.                                                            | Ứng dụng đăng xuất, yêu cầu đăng nhập lại (chưa verify trực tiếp trong lần quét này — tránh làm mất session đang dùng để quét; cần test riêng, độc lập, có khả năng đăng nhập lại). | P2      |
| TC-SETTINGS-11 | Footer hiển thị version, device ID, support                           | Đã qua gate, đang ở bất kỳ trang con Settings         | 1. Snapshot khối footer dưới cùng sidebar.                                                                   | Hiển thị `"Version: 0.1.0"` (hoặc version hiện hành), `button "Device ID:<uuid>"`, `"Support: (832) 968 9900"`.                                                                     | P3      |
| TC-SETTINGS-12 | Click Device ID không gây lỗi                                         | Đang ở bất kỳ trang con Settings                      | 1. Click `button "Device ID:<uuid>"`.                                                                        | Không có lỗi console mới phát sinh; hành vi copy/feedback cụ thể (toast) chưa xác nhận được qua accessibility snapshot — cần bổ sung khi rõ hơn.                                    | P3      |
