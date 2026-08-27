---
title: Dịch vụ & Sản phẩm (Services & Products)
route: /settings/services, /settings/services/$categoryId
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Dịch vụ & Sản phẩm — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Màn `/settings/services` là nơi merchant quản lý **danh mục (Category)**, **dịch vụ
(Service)** và **sản phẩm (Product)**. Layout 3 cột:

| Cột | Nội dung                                                                                       |
| --- | ---------------------------------------------------------------------------------------------- |
| 1   | Sidebar Settings dùng chung (`settings-sidebar`)                                               |
| 2   | Panel `Category` — tab Active/Inactive, nút Reorder, nút `+` tạo category                      |
| 3   | Panel chi tiết category — tiêu đề, nút `+` thêm item, filter trạng thái, bảng dịch vụ/sản phẩm |

Điểm khác biệt quan trọng so với `/settings/business`: **route này KHÔNG có passcode
gate** — mở trực tiếp là thấy dữ liệu ngay (đã xác nhận khi quét: không có dialog
"Enter staff code").

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần              | Vai trò (role/label)                                                          | Trạng thái quan sát được      | Ghi chú                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề panel category  | `heading` level 3 "Category"                                                  | luôn hiển thị                 |                                                                                                                                       |
| Nút reorder             | `getByRole('button', { name: 'Reorder Categories or Services' })`             | enabled                       | mở dialog reorder                                                                                                                     |
| Nút tạo category        | `button` không có accessible name (icon `+`), nằm cạnh nút reorder            | enabled                       | **không có name** → phải định vị theo parent/vị trí                                                                                   |
| Tab trạng thái category | `getByRole('tab', { name: 'Active', exact: true })` / `{ name: 'Inactive' }`  | Active mặc định selected      | **BẮT BUỘC `exact: true`** cho "Active": chuỗi "Inactive" chứa "Active" → không exact sẽ strict-mode violation (đã gặp thật khi quét) |
| Item category           | `getByRole('link', { name: '<tên> Update' })`, href `/settings/services/<id>` | 13 active / 7 inactive        | mỗi item có ô màu + tên + nút `Update` (icon bút)                                                                                     |
| Nút sửa category        | `button` "Update" bên trong link category                                     | enabled                       | click mở dialog Update Category                                                                                                       |
| Placeholder chi tiết    | `paragraph` "Select a category to view details."                              | khi chưa chọn category        |                                                                                                                                       |
| Tiêu đề chi tiết        | `heading` level 2 = tên category                                              |                               | riêng category "Product" hiển thị **"Products"** (label cứng, khác tên category)                                                      |
| Nút thêm item           | `button` icon `+` trong header chi tiết                                       | enabled                       | mở dialog "Add New Item"                                                                                                              |
| Filter trạng thái       | `button[role="combobox"]` hiển thị "All"                                      | mặc định All                  | options: `All`, `Active`, `Inactive`                                                                                                  |
| Bảng dịch vụ            | `table`                                                                       | 16 dòng ở MANICURE & PEDICURE | cột: (drag) / `Service name & Description` / `Price` / `Duration` / `Supply Fee` / `Active Status` / `Action`                         |
| Bảng sản phẩm           | `table`                                                                       | 8 dòng ở category "Product"   | cột: (drag) / `Product name & Description` / `Price` / `Active Status` / `Action` — **không có Duration/Supply Fee**                  |
| Switch trạng thái dòng  | `switch` trong cột Active Status                                              | checked                       |                                                                                                                                       |
| Nút sửa dòng            | `button` "Edit" trong cột Action                                              | enabled                       | mở dialog Update Service/Product                                                                                                      |
| Tay kéo dòng            | `button` "Reorder" trong cột đầu                                              | enabled                       | dnd-kit                                                                                                                               |

**Dialog "Create Category" / "Update Category"**

| Field      | Locator                                           | Ghi chú                                        |
| ---------- | ------------------------------------------------- | ---------------------------------------------- |
| Tên        | `getByRole('textbox', { name: 'Category Name' })` | placeholder `e.g. Manicure`                    |
| Trạng thái | `switch` + nhãn "Active"                          | mặc định ON khi tạo                            |
| Màu        | 20 `button` swatch trong nhóm "Color"             | không có accessible name                       |
| Submit     | `button` "Create" / "Update"                      | **disabled** khi form chưa hợp lệ / chưa dirty |
| Đóng       | `getByRole('button', { name: 'Close' })`          | Escape cũng đóng, **không có confirm discard** |

**Dialog "Add New Item" — biến thể SERVICE** (mở từ category dịch vụ)

`Service Name` (`Enter service name`) · `Category Name` (combobox, prefill category đang
mở) · `Service Price` (`$0.00`) · checkbox `Flexible Pricing` (**mặc định checked**) ·
`Service Duration` (2 combobox: `0 hours`, `0 mins`) · `Supply Fee` (`$0.00`) ·
`Service Description` · nhóm "Visibility Setting" gồm **4 switch**: `Active`,
`Shown on Web Booking`, `Shown on Go Checkin`, `Shown on Go POS` (đều ON).

**Dialog "Add New Item" — biến thể PRODUCT** (mở từ category "Product")

`Product Name` (`Enter product name`) · `Product Price` · checkbox `Flexible Pricing`
(checked) · `Product Description` · Visibility Setting chỉ **1 switch** `Active`.
Không có Category / Duration / Supply Fee.

**Dialog "Reorder Categories or Services"**

2 tab: `Category` và `All services`. Tab Category liệt kê 2 item ghim đầu
(`Quick Pay`, `Gift Card` — không có số lượng, không kéo được) rồi các category kèm
đếm `N Services` / `N Products`. Tab All services là **grid card kéo-thả** (4 cột),
mỗi card = tên dịch vụ + giá, tô màu theo category. **Không có nút Save** → thao tác
kéo-thả lưu ngay.

### 3. Luồng chính đã quan sát

1. Mở `/settings/services` → panel Category + placeholder "Select a category to view details.".
2. Click category → URL đổi thành `/settings/services/<uuid>`, panel 3 render bảng dịch vụ.
3. Click `+` panel Category → dialog Create Category; nhập tên → nút Create bật; Escape → đóng, không tạo gì.
4. Click `Update` trên category → dialog Update Category prefill; nút Update disabled cho tới khi có thay đổi.
5. Click `+` panel chi tiết → dialog Add New Item; bỏ tick Flexible Pricing → field giá bật.
6. Click `Edit` một dòng → dialog Update Service prefill; sửa giá → Update bật; Escape → dòng giữ giá cũ.
7. Đổi filter sang Inactive → bảng còn 0 dòng.
8. Click nút reorder → dialog 2 tab như trên.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- **Giá là cent-mask có trần**: gõ `abc-45x6` vào `Service Price` đang là `$20.00` cho
  ra `$10,000.00`; gõ tiếp `987654321` vẫn `$10,000.00` → chữ và dấu trừ bị bỏ, giá
  **clamp ở trần $10,000.00** thay vì báo lỗi.
- **Submit gate theo dirty**: dialog Update chỉ bật nút khi form khác giá trị ban đầu.
- **Flexible Pricing khoá field giá**: checked → `Service Price`/`Product Price` disabled.
- **Không có hành động xoá**: cả category, service và product đều chỉ bật/tắt bằng
  switch Active, không có nút Delete ở bất kỳ dialog nào đã quét.
- **Escape huỷ trắng**: mọi dialog ở màn này đóng bằng Escape mà không hỏi xác nhận,
  kể cả khi đang có thay đổi chưa lưu (khác `/settings/payment-transaction` có
  ConfirmDialog "Discard changes and leave?").

### 5. Trạng thái / quyền / edge case

- Không có passcode gate.
- Filter `Inactive` ở category MANICURE & PEDICURE → **0 dòng và không có empty-state
  message nào** (chỉ còn header bảng).
- Description `null` trong DB được render thành **chuỗi "null"** dưới tên dịch vụ
  (4 dòng: Milk and Honey Butter Pedicure, Take off Gel Only, Gel Manicure, Regular Pedicure).
- Tên dài bị cắt bằng ellipsis trong card reorder và trong cột tên bảng.
- **Bẫy DOM cho automation**: khi điều hướng giữa các category, panel chi tiết cũ vẫn
  còn mount trong DOM với `width = 0`. Ở thời điểm quét,
  `document.querySelectorAll('main table')` trả về **2** bảng (1 hiện, 1 ẩn) →
  `page.locator('table')` sẽ strict-mode violation. Code test phải scope theo panel
  đang hiện (lọc theo `boundingBox()` hoặc theo heading của panel).

## Test Cases

| ID        | Tiêu đề                                        | Tiền điều kiện                        | Các bước                                                                                 | Kết quả mong đợi                                                                                                                                                                                                                                                                                                                                                | Ưu tiên |
| --------- | ---------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-SVC-01 | Mở route không bị passcode gate                | Đã đăng nhập                          | 1. Goto `/settings/services`                                                             | Không có dialog passcode; panel `Category` render ngay                                                                                                                                                                                                                                                                                                          | P1      |
| TC-SVC-02 | Placeholder khi chưa chọn category             | Ở `/settings/services`                | 1. Quan sát panel phải                                                                   | Thấy `paragraph` "Select a category to view details."                                                                                                                                                                                                                                                                                                           | P2      |
| TC-SVC-03 | Tab Active liệt kê category đang bật           | Ở `/settings/services`                | 1. Tab Active đang selected                                                              | `tabpanel` Active có ≥1 `link` category, mỗi link kèm nút `Update`                                                                                                                                                                                                                                                                                              | P1      |
| TC-SVC-04 | Tab Inactive liệt kê category đã tắt           | Ở `/settings/services`                | 1. Click `getByRole('tab', { name: 'Inactive' })`                                        | Danh sách đổi sang nhóm category inactive (lúc quét: 7 item)                                                                                                                                                                                                                                                                                                    | P1      |
| TC-SVC-05 | Locator tab Active phải `exact: true`          | Ở `/settings/services`                | 1. `getByRole('tab', { name: 'Active', exact: true })`                                   | Chỉ khớp 1 element; nếu bỏ `exact` sẽ khớp cả "Inactive" → strict mode violation                                                                                                                                                                                                                                                                                | P2      |
| TC-SVC-06 | Click category điều hướng và render chi tiết   | Ở `/settings/services`                | 1. Click category `MANICURE & PEDICURE`                                                  | URL = `/settings/services/<uuid>`; `heading` level 2 = tên category; bảng dịch vụ render                                                                                                                                                                                                                                                                        | P1      |
| TC-SVC-07 | Cột bảng dịch vụ đúng thứ tự                   | Đang mở 1 category dịch vụ            | 1. Đọc `thead` của bảng đang hiện                                                        | Cột: (drag) / `Service name & Description` / `Price` / `Duration` / `Supply Fee` / `Active Status` / `Action`                                                                                                                                                                                                                                                   | P1      |
| TC-SVC-08 | Mỗi dòng có switch trạng thái và nút Edit      | Đang mở 1 category dịch vụ            | 1. Đọc 1 dòng bất kỳ                                                                     | Cột Active Status có `switch`; cột Action có `button` "Edit"                                                                                                                                                                                                                                                                                                    | P1      |
| TC-SVC-09 | 🐞 Description rỗng render thành chữ "null"    | Category `MANICURE & PEDICURE`        | 1. Tìm dòng "Milk and Honey Butter Pedicure"                                             | **Bug**: dưới tên hiện literal `null` thay vì để trống (lặp ở ≥4 dòng)                                                                                                                                                                                                                                                                                          | P2      |
| TC-SVC-10 | Filter trạng thái có 3 lựa chọn                | Đang mở 1 category                    | 1. Click combobox "All"                                                                  | `listbox` có option `All`, `Active`, `Inactive`                                                                                                                                                                                                                                                                                                                 | P1      |
| TC-SVC-11 | 🐞 Filter Inactive không có empty state        | Category chỉ có dịch vụ active        | 1. Chọn filter `Inactive`                                                                | Bảng còn 0 `tbody tr`; **không có** dòng chữ "No services"/empty-state nào — chỉ trơ header                                                                                                                                                                                                                                                                     | P2      |
| TC-SVC-12 | Filter quay lại All phục hồi danh sách         | Vừa filter Inactive                   | 1. Chọn lại `All`                                                                        | Số dòng trở về như ban đầu (16 với MANICURE & PEDICURE)                                                                                                                                                                                                                                                                                                         | P2      |
| TC-SVC-13 | Dialog Create Category mở đủ field             | Ở `/settings/services`                | 1. Click nút `+` cạnh nút reorder                                                        | `heading` "Create Category"; textbox `Category Name` (placeholder `e.g. Manicure`); switch Status ON nhãn "Active"; 20 swatch màu; nút `Create` **disabled**                                                                                                                                                                                                    | P1      |
| TC-SVC-14 | Nhập tên bật nút Create                        | Dialog Create Category đang mở        | 1. Fill `Category Name` = "QA scan probe"                                                | Nút `Create` chuyển sang enabled                                                                                                                                                                                                                                                                                                                                | P1      |
| TC-SVC-15 | Escape đóng Create Category, không tạo dữ liệu | Đã nhập tên, chưa submit              | 1. Nhấn `Escape`                                                                         | Dialog đóng, không có confirm discard; danh sách category **không** xuất hiện tên vừa nhập                                                                                                                                                                                                                                                                      | P1      |
| TC-SVC-16 | Dialog Update Category prefill + gate dirty    | Ở `/settings/services`                | 1. Click nút `Update` của category `MANICURE & PEDICURE`                                 | `heading` "Update Category"; textbox prefill đúng tên; switch Active checked; nút `Update` **disabled** khi chưa sửa gì                                                                                                                                                                                                                                         | P1      |
| TC-SVC-17 | Category không có hành động xoá                | Dialog Update Category đang mở        | 1. Liệt kê mọi `button` trong dialog                                                     | Chỉ có `Update`, `Close`, các swatch màu — **không có** nút Delete/Remove                                                                                                                                                                                                                                                                                       | P3      |
| TC-SVC-18 | Dialog Add New Item (service) đủ field         | Đang mở category dịch vụ              | 1. Click `+` ở header chi tiết                                                           | `heading` "Add New Item"; có `Service Name`, `Category Name` (prefill category đang mở), `Service Price`, checkbox `Flexible Pricing`, `Service Duration` (2 combobox `0 hours`/`0 mins`), `Supply Fee`, `Service Description`; 4 switch Visibility: `Active`, `Shown on Web Booking`, `Shown on Go Checkin`, `Shown on Go POS` — tất cả ON; nút `Add` disabled | P1      |
| TC-SVC-19 | Flexible Pricing mặc định khoá field giá       | Dialog Add New Item (service) mở      | 1. Đọc `input[name="price"]`                                                             | Checkbox `Flexible Pricing` checked và field giá `disabled`, giá trị `$0.00`                                                                                                                                                                                                                                                                                    | P1      |
| TC-SVC-20 | Bỏ tick Flexible Pricing bật field giá         | Dialog Add New Item (service) mở      | 1. Click checkbox `Flexible Pricing`                                                     | Field `Service Price` chuyển `disabled = false`, vẫn `$0.00`                                                                                                                                                                                                                                                                                                    | P1      |
| TC-SVC-21 | ⚠️ Add bật chỉ với tên, giá $0.00              | Đã bỏ tick Flexible Pricing           | 1. Fill `Service Name` = "QA probe service"                                              | Nút `Add` enabled dù giá vẫn `$0.00` và không có validation message → **khe hở validation**, cần xác nhận nghiệp vụ có cho phép giá 0 khi tắt flexible pricing                                                                                                                                                                                                  | P2      |
| TC-SVC-22 | Escape huỷ Add New Item                        | Dialog đang có dữ liệu nhập           | 1. Nhấn `Escape`                                                                         | Dialog đóng không confirm; bảng dịch vụ không có dòng mới                                                                                                                                                                                                                                                                                                       | P1      |
| TC-SVC-23 | Dialog Update Service prefill + gate dirty     | Đang mở category dịch vụ              | 1. Click `Edit` dòng đầu (`Regular Toe Polish Change`)                                   | `heading` "Update Service"; name/price/supplyFee prefill đúng (`$20.00`, `$1.00`); `Flexible Pricing` unchecked; nút `Update` disabled                                                                                                                                                                                                                          | P1      |
| TC-SVC-24 | Field giá bỏ chữ và dấu trừ                    | Dialog Update Service mở              | 1. `pressSequentially('abc-45x6')` vào `Service Price`                                   | Value chỉ chứa chữ số đã nhận, không có chữ cái hay `-`                                                                                                                                                                                                                                                                                                         | P1      |
| TC-SVC-25 | Field giá clamp ở trần $10,000.00              | Dialog Update Service mở              | 1. Select-all rồi gõ `987654321` vào `Service Price`                                     | Value = `$10,000.00` (không vượt trần, không báo lỗi)                                                                                                                                                                                                                                                                                                           | P2      |
| TC-SVC-26 | Escape huỷ sửa dịch vụ, dòng giữ giá cũ        | Đã sửa giá thành $10,000.00, chưa lưu | 1. Nhấn `Escape` 2. Đọc lại dòng đầu                                                     | Không còn dialog; dòng vẫn `$20.00` — thay đổi bị huỷ, không có confirm                                                                                                                                                                                                                                                                                         | P1      |
| TC-SVC-27 | Dialog Reorder có 2 tab                        | Ở `/settings/services`                | 1. Click `Reorder Categories or Services`                                                | `heading` cùng tên; `tab` `Category` (selected) và `tab` `All services`                                                                                                                                                                                                                                                                                         | P1      |
| TC-SVC-28 | Tab Category ghim Quick Pay / Gift Card        | Dialog Reorder mở                     | 1. Đọc nội dung tab Category                                                             | 2 item đầu là `Quick Pay`, `Gift Card` — không kèm số lượng, không có tay kéo; các category sau kèm đếm `N Services` / `N Products`                                                                                                                                                                                                                             | P2      |
| TC-SVC-29 | ⚠️ Đếm category trong Reorder lệch với sidebar | Dialog Reorder mở                     | 1. Đếm category ở tab Category 2. Đếm `link` ở tab Active của panel Category             | Lúc quét: Reorder liệt kê 11 category, sidebar Active có 13 (thiếu 2 category tên "Hung") → cần xác nhận có phải do category rỗng bị ẩn                                                                                                                                                                                                                         | P2      |
| TC-SVC-30 | Số dịch vụ trong Reorder khớp số dòng bảng     | Dialog Reorder mở                     | 1. Đọc `MANICURE & PEDICURE — 16 Services` 2. Đóng dialog, đếm dòng bảng của category đó | Hai số bằng nhau (16)                                                                                                                                                                                                                                                                                                                                           | P2      |
| TC-SVC-31 | Tab All services là grid card kéo-thả          | Dialog Reorder mở                     | 1. Click tab `All services`                                                              | Grid card 4 cột trong panel `[data-state="active"]`; mỗi card có tên + giá, tô màu theo category, có tay kéo                                                                                                                                                                                                                                                    | P2      |
| TC-SVC-32 | Reorder không có nút Save                      | Dialog Reorder mở                     | 1. Liệt kê `button` trong dialog                                                         | Chỉ có `Close`, 2 tab và các nút `Reorder` — không có Save/Apply → kéo-thả lưu ngay                                                                                                                                                                                                                                                                             | P3      |
| TC-SVC-33 | Category "Product" hiển thị tiêu đề "Products" | Ở `/settings/services`                | 1. Click category `Product`                                                              | `heading` level 2 = **"Products"** (label cứng), khác tên category `Product` trong sidebar                                                                                                                                                                                                                                                                      | P3      |
| TC-SVC-34 | Bảng sản phẩm có bộ cột riêng                  | Đang mở category `Product`            | 1. Đọc `thead` bảng đang hiện                                                            | Cột: (drag) / `Product name & Description` / `Price` / `Active Status` / `Action` — **không có** `Duration`, `Supply Fee`                                                                                                                                                                                                                                       | P1      |
| TC-SVC-35 | Dòng sản phẩm hiển thị description thật        | Đang mở category `Product`            | 1. Đọc dòng `Gel Manicure`                                                               | Dòng 2 hiển thị `Gel nail polish` (không phải "null")                                                                                                                                                                                                                                                                                                           | P2      |
| TC-SVC-36 | Dialog Add New Item biến thể product           | Đang mở category `Product`            | 1. Click `+` ở header chi tiết                                                           | `heading` "Add New Item"; field `Product Name`, `Product Price` (disabled), checkbox `Flexible Pricing` checked, `Product Description`; Visibility Setting chỉ **1 switch** `Active`; không có Category/Duration/Supply Fee; nút `Add` disabled                                                                                                                 | P1      |
| TC-SVC-37 | Bẫy DOM: 2 table cùng mount                    | Vừa điều hướng giữa 2 category        | 1. Đếm `main table`                                                                      | Có 2 `table` (panel cũ còn mount, `width = 0`) → test phải scope theo panel đang hiện, không dùng `page.locator('table')` trực tiếp                                                                                                                                                                                                                             | P1      |

## Ghi chú khi quét

- Quét ở viewport **1920×1080** (khớp `desktop` trong `playwright.config.ts`). Ở viewport
  mặc định của MCP (~930px) panel chi tiết bị đẩy ra ngoài khung nhìn — cần resize trước khi quét.
- App (Tauri dev) **crash** lúc 15:52:34 ngày 2026-08-21 với
  `STATUS_ILLEGAL_INSTRUCTION (0xc000001d)` sau ~11 phút chạy, ngay sau khi quét xong màn này.
  Không rõ có liên quan tới thao tác quét hay không — cần theo dõi khi chạy suite dài.
