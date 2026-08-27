---
title: Tipping Settings (Cài đặt chia tip)
route: /settings/payment-transaction
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Tipping Settings — Test Cases

> Lưu ý tên: sidebar và tiêu đề màn đều là **"Tipping Settings"**, nhưng route lại là
> `/settings/payment-transaction` và nhóm sidebar là "Payment & Transaction".

## Feature Overview

### 1. Mục tiêu & phạm vi

Chọn **phương thức chia tip mặc định** sẽ được preselect khi hoàn tất đơn. Chỉ 2 lựa
chọn hợp lệ làm mặc định: `Split Evenly` và `Proportion` — `Manual` là lựa chọn theo
từng đơn nên không có ở đây (xác nhận trong `TIP_SPLIT_METHOD_OPTIONS`).

Đây là màn **duy nhất** trong nhóm Settings đã quét có **nút Save riêng + chặn điều
hướng khi chưa lưu** (`ConfirmDialog` qua `blocker` của TanStack Router).

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần  | Vai trò (role/label)                                                                            | Trạng thái                     | Ghi chú    |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| Tiêu đề     | `getByRole('heading', { name: 'Tipping Settings' })` (level 3)                                  |                                |            |
| Mô tả       | `paragraph` "Manage how tips are handled during checkout."                                      |                                |            |
| Nút lưu     | `getByRole('button', { name: 'Save' })`                                                         | **disabled** khi chưa thay đổi | `min-w-40` |
| Card        | text "Split Tip Setting"                                                                        |                                |            |
| Mô tả card  | `paragraph` "Setting the tip split method that will be preselected when completing an order."   |                                |            |
| Radio group | `radiogroup`                                                                                    |                                |            |
| Radio 1     | `getByRole('radio', { name: 'Split Evenly' })`, `value="evenly"`, `id="split-tip-evenly"`       | checked lúc quét               |            |
| Radio 2     | `getByRole('radio', { name: 'Proportion' })`, `value="proportion"`, `id="split-tip-proportion"` |                                |            |

**Dialog chặn điều hướng** (khi có thay đổi chưa lưu):

`alertdialog` → `heading` "Discard changes and leave?" · `paragraph` "You have unsaved
changes. Do you want to undo changes and leave this page, or continue editing?" ·
`button` "Continue Editing" · `button` "Discard & Leave".

### 3. Luồng chính đã quan sát

1. Mở màn → `Split Evenly` checked, nút `Save` disabled.
2. Chọn `Proportion` → `Save` enabled.
3. Click link sidebar khác → **alertdialog** "Discard changes and leave?" xuất hiện, URL không đổi.
4. `Continue Editing` → dialog đóng, vẫn ở màn, `Proportion` vẫn được chọn, `Save` vẫn enabled.
5. Click link sidebar → dialog → `Discard & Leave` → điều hướng sang màn đích; quay lại thì về `Split Evenly`, `Save` disabled (thay đổi bị bỏ).
6. Chọn `Proportion` → `Save` → toast **"Split tip setting updated"**, `Save` disabled lại, radio giữ `Proportion`.
7. Reload → vẫn `Proportion` ⇒ lưu server-side.
8. Chọn lại `Split Evenly` → `Save` → toast như trên, về nguyên trạng.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- `Save` bị gate bởi `isDirty` **và** `selectedMethod !== null` **và** `!isSaving`.
- Sau khi lưu thành công, form reset dirty ⇒ `Save` disabled trở lại.
- Thay đổi **không** áp dụng cho tới khi bấm Save (khác payment-gateway lưu ngay).
- Giá trị này là **cấu hình merchant** (lưu server, sống qua reload), không phải local.

### 5. Trạng thái / quyền / edge case

- Không có passcode gate.
- Không quan sát được trạng thái `isSaving` (mutation trả về rất nhanh) — test nên assert
  theo toast/`Save` disabled thay vì cố bắt spinner.
- ⚠️ Test đổi giá trị này **phải khôi phục** vì nó đổi mặc định chia tip ở checkout của
  mọi test đơn hàng phía sau.

## Test Cases

| ID        | Tiêu đề                                  | Tiền điều kiện                  | Các bước                                                               | Kết quả mong đợi                                                                                                                                           | Ưu tiên |
| --------- | ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-TIP-01 | Màn render tiêu đề + mô tả + card        | Đã đăng nhập                    | 1. Goto `/settings/payment-transaction`                                | `heading` "Tipping Settings"; `paragraph` "Manage how tips are handled during checkout."; text "Split Tip Setting"                                         | P1      |
| TC-TIP-02 | Không có passcode gate                   | Chưa unlock                     | 1. Goto route                                                          | Không có dialog passcode                                                                                                                                   | P1      |
| TC-TIP-03 | Chỉ có đúng 2 lựa chọn chia tip          | Ở màn tipping                   | 1. Đếm `radio` trong `radiogroup`                                      | Đúng 2: `Split Evenly` (`value="evenly"`), `Proportion` (`value="proportion"`) — **không có** Manual                                                       | P1      |
| TC-TIP-04 | Save disabled khi chưa thay đổi          | Vừa mở màn                      | 1. Đọc trạng thái nút `Save`                                           | `disabled`                                                                                                                                                 | P1      |
| TC-TIP-05 | Chọn phương thức khác bật Save           | Đang ở `Split Evenly`           | 1. Click radio `Proportion`                                            | `Proportion` `aria-checked="true"`; `Save` enabled                                                                                                         | P1      |
| TC-TIP-06 | Điều hướng khi chưa lưu bị chặn          | Đã chọn `Proportion`, chưa Save | 1. Click link sidebar `Payment Gateway`                                | `alertdialog` "Discard changes and leave?" xuất hiện; URL **vẫn** `/settings/payment-transaction`                                                          | P1      |
| TC-TIP-07 | Nội dung dialog chặn đúng                | Dialog chặn đang mở             | 1. Đọc dialog                                                          | `paragraph` "You have unsaved changes. Do you want to undo changes and leave this page, or continue editing?"; 2 nút `Continue Editing`, `Discard & Leave` | P2      |
| TC-TIP-08 | Continue Editing giữ nguyên thay đổi     | Dialog chặn đang mở             | 1. Click `Continue Editing`                                            | Dialog đóng; vẫn ở route cũ; `Proportion` vẫn checked; `Save` vẫn enabled                                                                                  | P1      |
| TC-TIP-09 | Discard & Leave rời trang và bỏ thay đổi | Dialog chặn đang mở             | 1. Click `Discard & Leave` 2. Quay lại `/settings/payment-transaction` | Điều hướng thành công sang màn đích; khi quay lại radio về `Split Evenly` và `Save` disabled                                                               | P1      |
| TC-TIP-10 | Save hiện toast thành công               | Đã chọn `Proportion`            | 1. Click `Save`                                                        | Toast **"Split tip setting updated"**                                                                                                                      | P1      |
| TC-TIP-11 | Save xong Save disabled trở lại          | Vừa Save                        | 1. Đọc nút `Save`                                                      | `disabled` (form không còn dirty), radio giữ `Proportion`                                                                                                  | P1      |
| TC-TIP-12 | Giá trị đã lưu sống qua reload           | Vừa Save `Proportion`           | 1. Reload route                                                        | `Proportion` `aria-checked="true"` ⇒ lưu server-side, không phải local                                                                                     | P1      |
| TC-TIP-13 | Điều hướng sau khi Save không bị chặn    | Vừa Save, form không dirty      | 1. Click link sidebar khác                                             | Điều hướng ngay, **không** có dialog chặn                                                                                                                  | P2      |
| TC-TIP-14 | Cleanup: trả về `Split Evenly`           | Sau các case trên               | 1. Chọn `Split Evenly` 2. Save                                         | Toast thành công; giá trị merchant trở về nguyên trạng                                                                                                     | P1      |
