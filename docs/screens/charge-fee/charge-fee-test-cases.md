---
title: Charge & Fee (Phí & Phụ thu)
route: /settings/charge-fee
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Charge & Fee — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Ba nhóm cấu hình cho bước thanh toán, nằm trong 3 section gập/mở được, dùng **một nút
`Save` duy nhất ở cấp màn**:

1. **Tip Setting** — hình thức tip được phép, thời điểm hỏi tip, đơn vị tip ($ hay %),
   và **danh sách tip option** (bảng có thể sửa/xoá/kéo-thả).
2. **Tax Setting** — một ô phần trăm thuế.
3. **Signature** — bật/tắt ký số và thời điểm ký.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần       | Vai trò (role/label)                                                                                                                      | Trạng thái lúc quét     | Ghi chú                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề          | `getByRole('heading', { name: 'Charge & Fee' })` (level 3)                                                                                |                         |                                                                                                                     |
| Nút lưu          | `getByRole('button', { name: 'Save' })`                                                                                                   | **disabled**            | gate theo dirty của cả màn                                                                                          |
| Section header   | `button[aria-expanded]` bọc `heading` level 4: `Tip Setting`, `Tax Setting`, `Signature`                                                  | cả 3 **expanded**       | click để gập/mở                                                                                                     |
| Tip Method       | 4 `checkbox`: `Card`, `Cash`, `Gift Card`, `Other`                                                                                        | tất cả checked          |                                                                                                                     |
| Tip Timing       | `radiogroup` — `#charge-fee-tip-timing-before` (`before_payment`), `#charge-fee-tip-timing-after`                                         | `After Payment` checked | kèm `paragraph` "Before: tip included in charge, After: tip added later, allows adjustment."                        |
| Tip Amount       | `radiogroup` — `#charge-fee-tip-type-percent` (`percent`), `#charge-fee-tip-type-amount`                                                  | `$` checked             |                                                                                                                     |
| Nút thêm option  | `getByRole('button', { name: 'Add Tip Option' })`                                                                                         | enabled                 | mở dialog "Tip Settings"                                                                                            |
| Bảng tip option  | `table`                                                                                                                                   | 4 dòng                  | cột: `Reorder` / `Tip Amount ($)` / `Tip Suggestion` / `Status` / `Action`                                          |
| Dòng tip option  | mỗi dòng: tay kéo + số thứ tự, giá trị, ô suggestion (rỗng), `switch` (checked), `button` `Edit Tip Option`, `button` `Delete Tip Option` | $10 / $25 / $50 / $100  |                                                                                                                     |
| Tax              | `input[name="taxPercentage"]`, `getByRole('textbox', { name: 'Tax' })`, suffix `%`                                                        | `10`                    |                                                                                                                     |
| Signature switch | `getByRole('switch', { name: 'Require Digital Signature' })`                                                                              | **unchecked**           | kèm `paragraph` "Enabled: customer signs on screen, waiving if skipped. Disabled: customer signs on paper receipt." |
| Signature Timing | `radiogroup` — `#charge-fee-signature-timing-before`, `#charge-fee-signature-timing-after`                                                | `After Payment` checked | kèm `paragraph` "Before: signature collected before charging. After: signature collected after charge approval."    |

**Dialog "Tip Settings"** (mở từ `Add Tip Option`)

| Field       | Locator                                                                                                          | Giá trị mặc định     |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| Amount      | `getByRole('textbox', { name: 'Amount' })`, `name="amount"`, placeholder `Enter tip amount`                      | `$0.00`              |
| Percentage  | `getByRole('textbox', { name: 'Percentage' })`, `name="percent"`, placeholder `Enter tip percentage`, suffix `%` | `0`                  |
| Status      | `getByRole('switch', { name: 'Status Active' })`                                                                 | checked (Active)     |
| Description | `name="desc"`, placeholder `Enter description`                                                                   | rỗng                 |
| Submit      | `button` `Add`                                                                                                   | **disabled** ban đầu |

**Dialog xác nhận xoá**: `alertdialog` → `heading` "Delete Tip Option" · `paragraph`
"Are you sure you want to delete this tip option?" · `button` `Cancel` · `button` `Delete`.

### 3. Luồng chính đã quan sát

1. Mở màn → 3 section mở sẵn, `Save` disabled.
2. `Delete Tip Option` → alertdialog xác nhận → `Cancel` → không xoá gì.
3. `Add Tip Option` → dialog "Tip Settings"; gõ `7` vào Amount đang `$0.00` → `$70.00`, nút `Add` bật; Escape đóng, không thêm dòng.
4. Đổi Tip Amount sang `%` → header bảng đổi thành `Tip Amount (%)` **và toàn bộ 4 dòng đổi giá trị** thành `15 / 18 / 20 / 25`; `Save` bật.
5. Đổi lại `$` → bảng về `$10.00 / $25.00 / $50.00 / $100.00`, `Save` **disabled** trở lại.
6. Ô Tax: gõ `abc-999` → value `100`; `Save` bật; gõ lại `10` → `Save` disabled.
7. `Edit Tip Option` dòng 1 → **sửa inline ngay trong dòng** (cell giá thành textbox `$10.00`, cell suggestion thành textbox); Escape **không** thoát chế độ sửa; click lại `Edit Tip Option` mới thoát.
8. Click header `Tip Setting` → `aria-expanded="false"`, nội dung ẩn (nhưng `table` **vẫn còn trong DOM**).

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- **Hai danh sách tip option độc lập**: một cho đơn vị `$`, một cho `%`. Đổi radio
  `Tip Amount` là đổi hẳn tập dữ liệu đang hiển thị, không phải quy đổi giá trị.
- **Dirty tracking theo giá trị**: sửa rồi trả lại đúng giá trị cũ thì `Save` disabled lại
  (đã kiểm chứng ở cả radio Tip Amount và ô Tax).
- **Ô Tax bỏ chữ, bỏ dấu trừ, clamp ở 100** — không có message lỗi, chỉ âm thầm cắt.
- **Sửa tip option là inline, không phải dialog**; dialog chỉ dùng khi **thêm mới**.
- Xoá tip option có xác nhận 2 bước (an toàn cho test).

### 5. Trạng thái / quyền / edge case

- Không có passcode gate.
- Cột `Tip Suggestion` rỗng ở cả 4 dòng ⇒ chưa có dữ liệu mẫu để kiểm tra hiển thị.
- ⚠️ **`Require Digital Signature` đang OFF nhưng nhóm `Signature Timing` vẫn enabled**
  (không `disabled`, không mờ). Khác pattern của Turn Settings (service-based OFF thì
  disable switch decimals) ⇒ cần xác nhận đây là chủ ý hay thiếu ràng buộc.
- Gập section không unmount nội dung ⇒ assert phải dùng **visibility**, không dùng count.
- ⚠️ Test đổi Tip Amount / Tax / Signature **phải khôi phục** vì đây là cấu hình merchant
  ảnh hưởng mọi đơn hàng.

## Test Cases

| ID        | Tiêu đề                                       | Tiền điều kiện               | Các bước                                                               | Kết quả mong đợi                                                                                                                                            | Ưu tiên |
| --------- | --------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-CHF-01 | Màn render 3 section, mở sẵn                  | Đã đăng nhập                 | 1. Goto `/settings/charge-fee`                                         | `heading` "Charge & Fee"; 3 `heading` level 4: `Tip Setting`, `Tax Setting`, `Signature`, cả 3 `aria-expanded="true"`                                       | P1      |
| TC-CHF-02 | Save disabled khi chưa thay đổi               | Vừa mở màn                   | 1. Đọc nút `Save`                                                      | `disabled`                                                                                                                                                  | P1      |
| TC-CHF-03 | Tip Method có đúng 4 hình thức                | Section Tip Setting mở       | 1. Đếm checkbox trong "Tip Method"                                     | 4 checkbox: `Card`, `Cash`, `Gift Card`, `Other` — tất cả checked                                                                                           | P1      |
| TC-CHF-04 | Tip Timing có 2 lựa chọn, mặc định After      | Section Tip Setting mở       | 1. Đọc `#charge-fee-tip-timing-before` / `-after`                      | `After Payment` `aria-checked="true"`; kèm paragraph "Before: tip included in charge, After: tip added later, allows adjustment."                           | P1      |
| TC-CHF-05 | Tip Amount có 2 đơn vị, mặc định $            | Section Tip Setting mở       | 1. Đọc `#charge-fee-tip-type-percent` / `-amount`                      | `$` checked                                                                                                                                                 | P1      |
| TC-CHF-06 | Bảng tip option đủ cột                        | Section Tip Setting mở       | 1. Đọc `thead`                                                         | `Reorder` / `Tip Amount ($)` / `Tip Suggestion` / `Status` / `Action`                                                                                       | P1      |
| TC-CHF-07 | Mỗi dòng có switch + Edit + Delete            | Section Tip Setting mở       | 1. Đọc 1 dòng                                                          | Có `switch` (checked), `button` `Edit Tip Option`, `button` `Delete Tip Option`, tay kéo + số thứ tự                                                        | P1      |
| TC-CHF-08 | Đổi sang % đổi cả header và dữ liệu           | Đang ở đơn vị `$`            | 1. Click `#charge-fee-tip-type-percent`                                | Header cột 2 thành `Tip Amount (%)`; 4 dòng đổi thành `15 / 18 / 20 / 25` (tập dữ liệu khác, không phải quy đổi); `Save` enabled                            | P1      |
| TC-CHF-09 | Đổi lại $ phục hồi dữ liệu và tắt Save        | Đang ở đơn vị `%`            | 1. Click `#charge-fee-tip-type-amount`                                 | Header về `Tip Amount ($)`; dòng về `$10.00 / $25.00 / $50.00 / $100.00`; `Save` **disabled** (dirty tính theo giá trị)                                     | P1      |
| TC-CHF-10 | Dialog Add Tip Option đủ field                | Section Tip Setting mở       | 1. Click `Add Tip Option`                                              | `heading` "Tip Settings"; `Amount` = `$0.00`, `Percentage` = `0` + suffix `%`, `switch` "Status Active" checked, `Description` rỗng; nút `Add` **disabled** | P1      |
| TC-CHF-11 | Nhập Amount bật nút Add                       | Dialog Add Tip Option mở     | 1. Gõ `7` vào `Amount`                                                 | Value thành `$70.00`; nút `Add` enabled                                                                                                                     | P1      |
| TC-CHF-12 | Escape đóng dialog, không thêm dòng           | Dialog đang có dữ liệu       | 1. Nhấn `Escape`                                                       | Dialog đóng; bảng vẫn 4 dòng                                                                                                                                | P1      |
| TC-CHF-13 | Delete có bước xác nhận                       | Section Tip Setting mở       | 1. Click `Delete Tip Option` dòng cuối                                 | `alertdialog` "Delete Tip Option" + `paragraph` "Are you sure you want to delete this tip option?" + `Cancel` / `Delete`                                    | P1      |
| TC-CHF-14 | Cancel không xoá dòng                         | Dialog xác nhận xoá đang mở  | 1. Click `Cancel`                                                      | Dialog đóng; bảng vẫn đủ 4 dòng                                                                                                                             | P1      |
| TC-CHF-15 | Edit Tip Option là sửa inline                 | Section Tip Setting mở       | 1. Click `Edit Tip Option` dòng 1                                      | Cell `Tip Amount` thành `textbox` giá trị `$10.00` (placeholder `$0.00`); cell `Tip Suggestion` thành `textbox`; **không** mở dialog                        | P1      |
| TC-CHF-16 | 🐞 Escape không thoát chế độ sửa inline       | Đang sửa inline dòng 1       | 1. Nhấn `Escape`                                                       | Dòng **vẫn** ở chế độ sửa (2 `input` còn đó) — khác mọi dialog khác trên app đóng bằng Escape                                                               | P2      |
| TC-CHF-17 | Click Edit lần nữa thoát chế độ sửa           | Đang sửa inline dòng 1       | 1. Click lại `Edit Tip Option`                                         | Dòng trở về text `$10.00`, 0 `input`; `Save` vẫn disabled (không thay đổi gì)                                                                               | P2      |
| TC-CHF-18 | Ô Tax hiển thị giá trị hiện tại               | Section Tax Setting mở       | 1. Đọc `input[name="taxPercentage"]`                                   | Value `10`, có suffix `%`                                                                                                                                   | P1      |
| TC-CHF-19 | Ô Tax bỏ chữ và dấu trừ, clamp ở 100          | Section Tax Setting mở       | 1. Select-all, gõ `abc-999`                                            | Value = `100`; không có message lỗi; `Save` enabled                                                                                                         | P1      |
| TC-CHF-20 | Trả Tax về giá trị gốc tắt Save               | Vừa làm TC-CHF-19            | 1. Select-all, gõ `10`                                                 | Value `10`; `Save` **disabled**                                                                                                                             | P1      |
| TC-CHF-21 | Signature switch mặc định OFF                 | Section Signature mở         | 1. Đọc `switch` "Require Digital Signature"                            | `aria-checked="false"`                                                                                                                                      | P1      |
| TC-CHF-22 | ⚠️ Signature Timing vẫn enabled khi ký số OFF | Signature switch OFF         | 1. Đọc `#charge-fee-signature-timing-before` / `-after`                | Cả 2 radio **không** `disabled`; `After Payment` vẫn checked → cần xác nhận có phải thiếu ràng buộc                                                         | P2      |
| TC-CHF-23 | Bật Signature switch làm dirty                | Signature switch OFF         | 1. Click switch                                                        | `aria-checked="true"`; `Save` enabled. **Cleanup: tắt lại về OFF**                                                                                          | P2      |
| TC-CHF-24 | Gập section ẩn nội dung                       | Section Tip Setting mở       | 1. Click header `Tip Setting`                                          | `aria-expanded="false"`; bảng tip option không còn **visible** (lưu ý: vẫn còn trong DOM → assert bằng visibility)                                          | P2      |
| TC-CHF-25 | Mở lại section hiện lại nội dung              | Section Tip Setting đang gập | 1. Click lại header                                                    | `aria-expanded="true"`; bảng hiện lại đủ 4 dòng                                                                                                             | P2      |
| TC-CHF-26 | Cleanup: mọi cấu hình trở về nguyên trạng     | Sau các case trên            | 1. Kiểm tra Tip Amount = `$`, Tax = `10`, Signature = OFF, bảng 4 dòng | `Save` disabled và giá trị khớp trạng thái ban đầu                                                                                                          | P1      |
