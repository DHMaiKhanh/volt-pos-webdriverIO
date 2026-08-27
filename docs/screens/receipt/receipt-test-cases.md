---
title: Receipt (Hóa đơn — mẫu in)
route: /settings/receipt
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Receipt — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Cấu hình **mẫu hóa đơn in** cho merchant. Layout 3 cột: sidebar Settings · panel
`Receipt Setting` (4 section accordion) · panel `Receipt Preview` (hóa đơn mẫu render
**realtime** theo cấu hình đang chọn).

Một nút `Save` duy nhất ở cấp màn, gate theo dirty.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

Màn này là màn **có nhiều `id` ổn định nhất** trong nhóm Settings (29 id) ⇒ codegen nên
dùng `page.locator('#<id>')` thay vì role/name.

| Section             | Locator header                                                                                | Thành phần                                        |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Printing Preference | `getByRole('button', { name: 'Printing Preference' })` (`aria-expanded`, `data-state="open"`) | 4 switch                                          |
| Logo & Branding     | `getByRole('button', { name: 'Logo & Branding' })`                                            | 1 switch + 2 radio + nút `Choose file` + 3 switch |
| Receipt Message     | `getByRole('button', { name: 'Receipt Message' })`                                            | 3 switch + 3 textarea                             |
| Display Options     | `getByRole('button', { name: 'Display Options' })`                                            | 13 switch                                         |

**Printing Preference** — cả 4 đều OFF lúc quét:

| id                           | Nhãn                                               |
| ---------------------------- | -------------------------------------------------- |
| `#auto-print-complete-order` | Auto-print customer receipt after each order       |
| `#auto-print-cancel-refund`  | Auto-print cancel/refund receipts                  |
| `#auto-print-split-order`    | Auto-print customer receipt after each split check |
| `#auto-print-gift-card`      | Print separate gift card receipts at check-out     |

**Logo & Branding** — `#show-logo` (ON, nhãn "Business logo or custom image"),
radio `#logo-default` (value `default`, **checked**) / `#logo-custom` (value `custom`),
nút `Choose file`, và `#show-business-name` / `#show-business-address` /
`#show-business-phone` (đều ON).

**Receipt Message** — 3 cặp switch + textarea, cả 3 switch ON, cả 3 textarea **rỗng**:

| Switch                     | Textarea                           | `name`             | placeholder                         |
| -------------------------- | ---------------------------------- | ------------------ | ----------------------------------- |
| `#header-text`             | `#header-text-content`             | `headerMessage`    | Enter header message                |
| `#footer-text`             | `#footer-text-content`             | `footerMessage`    | Enter footer message                |
| `#marketing-opt-in-prompt` | `#marketing-opt-in-prompt-content` | `marketingMessage` | Enter message for marketing consent |

**Display Options** — 13 switch, tất cả ON lúc quét: `#cashier-name`, `#order-id`,
`#check-in-time`, `#customer-info`, `#current-points`, `#visit-time`,
`#group-items-by-staff-or-guest`, `#items-services-products`,
`#subtotal-total-discount-tip-total`, `#show-payment-method`, `#signature`,
`#business-note`, `#qr-code`.

**Receipt Preview** — `heading` level 3 "Receipt Preview". Nội dung mẫu lúc quét:
`img[alt="Business Logo"]` · `Test 100004` · `No.269, Wujiang Road F2, Huangpuhui` ·
`***-***-9088` · `Name / 0000` · `MM.DD.YYYY 00:00 AM` · `Customer Name / (xxx) xxx-xxxx` ·
`Current points: xxx` · `Total visit: xxx` · `Staff: Staff: John Doe` + `Service A/B/C`
kèm `(Note: Service X)` và `$xx.xx`.

### 3. Luồng chính đã quan sát

1. Mở màn → 4 section mở sẵn, `Save` disabled.
2. Tắt `#customer-info` → dòng `Customer Name` **biến mất khỏi preview ngay lập tức**
   (`Current points` vẫn còn vì do `#current-points` điều khiển); `Save` enabled.
3. Reload không Save → `#customer-info` trở lại ON, `Save` disabled ⇒ thay đổi bị bỏ.
4. Chọn `#logo-custom` → nút `Choose file` vẫn enabled/visible; `Save` enabled.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- **Preview là realtime, không cần Save** — dùng chính preview để verify từng switch
  Display Options thay vì phải in hóa đơn thật.
- Thay đổi chỉ áp dụng khi bấm `Save`; reload là mất.
- Không có confirm khi rời trang với thay đổi chưa lưu (khác `/settings/payment-transaction`).

### 5. Trạng thái / quyền / edge case

- ⚠️ **Sync window**: ngay sau khi app khởi động lại, route này render error boundary
  `Something went wrong / Unknown type "Setting"` (GraphQL chưa có type `Setting`).
  Đã xác nhận hết lỗi sau khi sync xong (`{ __type(name:"Setting"){name} }` trả về có).
  ⇒ Test phải preflight schema/`staffList` như `tests/setup/pos.setup.ts` đang làm, và
  `BasePage.expectReady()` sẽ bắt đúng nguyên nhân này.
- ⚠️ **Ảnh logo "vỡ" khi test bằng browser — KHÔNG phải bug của app**:
  `img[alt="Business Logo"]` có `naturalWidth = 0` và console báo
  `ERR_UNKNOWN_URL_SCHEME @ asset://localhost/`. Nguyên nhân: `src` là
  `asset://localhost/C%3A%5CUsers%5C...%5CVoltPOS%5CObjectFiles%5C...` — **protocol
  `asset://` của Tauri**, chỉ giải được bên trong Tauri webview. Playwright chạy Chromium
  thường nên không tải được.
  ⇒ **Tuyệt đối không** viết test assert "logo phải load"; sẽ fail mãi trong CI dù app
  thật vẫn đúng. Thay vào đó assert **scheme của `src`**.
- 🐞 **Nhãn nhân viên bị lặp**: preview in `Staff: Staff: John Doe` (chuỗi `"Staff: Staff:"`
  xuất hiện **2 lần** trong DOM, tương ứng 2 nhân viên mẫu).
- ⚠️ **Không có `input[type="file"]` trong DOM** kể cả sau khi chọn `#logo-custom` ⇒ nút
  `Choose file` mở **hộp thoại file của hệ điều hành (Tauri dialog)**, không phải input
  HTML. Playwright **không** dùng được `setInputFiles` ở đây; luồng upload logo tuỳ chỉnh
  không tự động hoá được bằng browser automation.

## Test Cases

| ID        | Tiêu đề                                            | Tiền điều kiện                     | Các bước                                                                                                                                                 | Kết quả mong đợi                                                                                                                                                                                                          | Ưu tiên |
| --------- | -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-RCP-01 | Màn render 4 section + preview                     | Đã đăng nhập, DB đã sync           | 1. Goto `/settings/receipt`                                                                                                                              | `heading` "Receipt Setting" và "Receipt Preview"; 4 nút section `Printing Preference`, `Logo & Branding`, `Receipt Message`, `Display Options` đều `aria-expanded="true"`                                                 | P1      |
| TC-RCP-02 | Save disabled khi chưa thay đổi                    | Vừa mở màn                         | 1. Đọc nút `Save`                                                                                                                                        | `disabled`                                                                                                                                                                                                                | P1      |
| TC-RCP-03 | Printing Preference có đúng 4 switch, mặc định OFF | Section mở                         | 1. Đọc 4 id `#auto-print-*`                                                                                                                              | Tồn tại cả 4, `aria-checked="false"`                                                                                                                                                                                      | P1      |
| TC-RCP-04 | Logo & Branding có radio default/custom            | Section mở                         | 1. Đọc `#logo-default`, `#logo-custom`                                                                                                                   | `#logo-default` checked (`value="default"`); `#logo-custom` (`value="custom"`) unchecked                                                                                                                                  | P1      |
| TC-RCP-05 | 3 switch thông tin doanh nghiệp đều ON             | Section Logo & Branding mở         | 1. Đọc `#show-business-name`, `#show-business-address`, `#show-business-phone`                                                                           | Cả 3 `aria-checked="true"`                                                                                                                                                                                                | P2      |
| TC-RCP-06 | Receipt Message có 3 cặp switch + textarea         | Section mở                         | 1. Đọc `#header-text` + `#header-text-content`, `#footer-text` + `#footer-text-content`, `#marketing-opt-in-prompt` + `#marketing-opt-in-prompt-content` | 3 switch ON; 3 textarea rỗng với placeholder tương ứng (`Enter header message`, `Enter footer message`, `Enter message for marketing consent`)                                                                            | P1      |
| TC-RCP-07 | Display Options có đúng 13 switch                  | Section mở                         | 1. Đọc 13 id trong bảng ở trên                                                                                                                           | Tất cả tồn tại và `aria-checked="true"`                                                                                                                                                                                   | P1      |
| TC-RCP-08 | Preview hiển thị thông tin cửa hàng                | Vừa mở màn                         | 1. Đọc panel `Receipt Preview`                                                                                                                           | Thấy `Test 100004`, địa chỉ `No.269, Wujiang Road F2, Huangpuhui`, số điện thoại dạng che `***-***-9088`                                                                                                                  | P2      |
| TC-RCP-09 | Tắt Display Option cập nhật preview ngay           | Vừa mở màn                         | 1. Click `#customer-info`                                                                                                                                | `aria-checked="false"`; chuỗi `Customer Name` **mất khỏi preview** ngay, không cần Save; `Save` enabled                                                                                                                   | P1      |
| TC-RCP-10 | Các option khác không bị ảnh hưởng                 | Vừa làm TC-RCP-09                  | 1. Kiểm tra preview                                                                                                                                      | `Current points` vẫn còn (do `#current-points` vẫn ON) ⇒ mỗi switch chỉ điều khiển đúng phần của nó                                                                                                                       | P2      |
| TC-RCP-11 | Bật lại Display Option phục hồi preview            | Vừa làm TC-RCP-09                  | 1. Click lại `#customer-info`                                                                                                                            | `aria-checked="true"`; `Customer Name` xuất hiện lại                                                                                                                                                                      | P1      |
| TC-RCP-12 | Thay đổi không Save bị bỏ sau reload               | Đã tắt `#customer-info`, chưa Save | 1. Reload route                                                                                                                                          | `#customer-info` về `true`; `Save` disabled                                                                                                                                                                               | P1      |
| TC-RCP-13 | Chọn logo custom làm dirty                         | `#logo-default` đang checked       | 1. Click `#logo-custom`                                                                                                                                  | `#logo-custom` checked; `Save` enabled; nút `Choose file` visible + enabled                                                                                                                                               | P2      |
| TC-RCP-14 | ⚠️ Upload logo không tự động hoá được              | Đã chọn `#logo-custom`             | 1. Đếm `input[type="file"]` trong DOM                                                                                                                    | **0** — nút `Choose file` gọi hộp thoại file của OS (Tauri), nên `setInputFiles` không dùng được ⇒ case upload phải test tay                                                                                              | P2      |
| TC-RCP-15 | Logo preview trỏ qua protocol `asset://` của Tauri | Vừa mở màn                         | 1. Đọc `src` của `img[alt="Business Logo"]`                                                                                                              | `src` bắt đầu bằng `asset://localhost/` và trỏ tới `VoltPOS/ObjectFiles/...`. **Không** assert `naturalWidth > 0`: trong Chromium ảnh luôn `naturalWidth = 0` (`ERR_UNKNOWN_URL_SCHEME`) dù app thật hiển thị bình thường | P2      |
| TC-RCP-16 | 🐞 Preview lặp nhãn "Staff:"                       | Vừa mở màn                         | 1. Đếm chuỗi `Staff: Staff:` trong preview                                                                                                               | Xuất hiện **2** lần (`Staff: Staff: John Doe`, `Staff: Staff: Jane Doe`) — nhãn bị nối 2 lần                                                                                                                              | P2      |
| TC-RCP-17 | Gập section ẩn nội dung                            | Section `Printing Preference` mở   | 1. Click nút `Printing Preference`                                                                                                                       | `aria-expanded="false"`, `data-state="closed"`; 4 switch không còn visible                                                                                                                                                | P2      |
| TC-RCP-18 | Mở lại section                                     | Section đang gập                   | 1. Click lại nút                                                                                                                                         | `aria-expanded="true"`; 4 switch visible trở lại                                                                                                                                                                          | P2      |
| TC-RCP-19 | Nhập header message làm dirty                      | Section Receipt Message mở         | 1. Fill `#header-text-content` = "QA header"                                                                                                             | Textarea nhận giá trị; `Save` enabled. **Không Save — reload để bỏ**                                                                                                                                                      | P2      |
| TC-RCP-20 | Route chịu sync window sau khi app restart         | App vừa khởi động lại              | 1. Goto route ngay                                                                                                                                       | Có thể render error boundary "Something went wrong / Unknown type \"Setting\"" ⇒ test phải preflight schema rồi mới assert; `BasePage.expectReady()` báo đúng nguyên nhân thay vì timeout selector                        | P1      |
