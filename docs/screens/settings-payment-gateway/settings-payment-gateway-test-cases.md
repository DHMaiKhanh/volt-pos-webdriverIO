---
title: Payment Gateway (Cổng thanh toán)
route: /settings/payment-gateway
source: playwright-mcp-scan
scanned-at: 2026-08-21
viewport: 1920x1080
---

# Payment Gateway — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

Màn nhỏ nhất trong nhóm Settings: **một switch duy nhất** quyết định thẻ được charge
trực tiếp qua Fastboy Payment gateway (ON) hay đi qua API upstream cũ (OFF).

Không có passcode gate, không có nút Save — bật/tắt là lưu ngay.

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

| Thành phần   | Vai trò (role/label)                                                                                  | Trạng thái           | Ghi chú                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Tiêu đề      | `getByRole('heading', { name: 'Payment Gateway' })` (level 3)                                         |                      |                                                       |
| Mô tả màn    | `paragraph` "Choose how card payments are processed."                                                 |                      |                                                       |
| Nhãn switch  | `label[for="direct-gateway"]` — "Charge directly via Fastboy Payment gateway"                         | `cursor: pointer`    | click nhãn cũng đổi switch                            |
| Mô tả switch | `paragraph` "When off, card charges route through the legacy upstream API."                           |                      |                                                       |
| Switch       | `getByRole('switch', { name: 'Charge directly via Fastboy Payment gateway' })`, `id="direct-gateway"` | **checked** lúc quét | mặc định code là ON (`DEFAULT_DIRECT_GATEWAY = true`) |

### 3. Luồng chính đã quan sát

1. Mở `/settings/payment-gateway` → switch ON.
2. Click switch → `aria-checked = "false"`, **không có toast** thành công.
3. Reload trang → switch vẫn OFF ⇒ đã lưu.
4. Click lại → về ON, giá trị lưu lại thành `true`.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

- State nằm trong **tauriStore (`settings.json`)** với key `payment_direct_gateway`,
  không phải trong DB/GraphQL ⇒ **cấu hình theo THIẾT BỊ**, không đồng bộ giữa máy/phiên.
- Khi chạy trong Chromium thường (không phải Tauri webview), `@tauri-apps/plugin-store`
  fallback về **localStorage** với key `tauri-store:settings.json`, giá trị
  `{"payment_direct_gateway":true}`. Đây là điểm tựa để test assert/khôi phục nhanh.
- Chỉ có toast khi **lỗi**: `toast.error(t("global.paymentGatewaySaveFailed"))`.
  Thành công thì im lặng.

### 5. Trạng thái / quyền / edge case

- Không có passcode gate, không có empty/loading state đáng kể (state đọc từ store local).
- ⚠️ **Nguy cơ rò rỉ giữa các test**: vì giá trị lưu ở localStorage và suite dùng
  `storageState` chung (`.auth/pos-storage-state.json`), một test tắt switch mà không
  khôi phục sẽ đổi hành vi thanh toán thẻ của các test sau. Test bắt buộc phải restore.

## Test Cases

| ID        | Tiêu đề                                  | Tiền điều kiện         | Các bước                                                                          | Kết quả mong đợi                                                                   | Ưu tiên |
| --------- | ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| TC-PGW-01 | Màn render đủ tiêu đề và mô tả           | Đã đăng nhập           | 1. Goto `/settings/payment-gateway`                                               | `heading` "Payment Gateway"; `paragraph` "Choose how card payments are processed." | P1      |
| TC-PGW-02 | Không có passcode gate                   | Chưa unlock passcode   | 1. Goto route                                                                     | Không có dialog "Enter staff code"; switch hiển thị ngay                           | P1      |
| TC-PGW-03 | Switch có accessible name đúng           | Ở màn payment-gateway  | 1. `getByRole('switch', { name: 'Charge directly via Fastboy Payment gateway' })` | Khớp đúng 1 element, `id="direct-gateway"`                                         | P1      |
| TC-PGW-04 | Mặc định là ON                           | Store chưa từng bị đổi | 1. Đọc `aria-checked`                                                             | `"true"` (default `DEFAULT_DIRECT_GATEWAY = true`)                                 | P1      |
| TC-PGW-05 | Tắt switch cập nhật ngay, không cần Save | Switch đang ON         | 1. Click switch                                                                   | `aria-checked = "false"`; không có nút Save nào trên màn                           | P1      |
| TC-PGW-06 | Tắt switch không hiện toast thành công   | Switch đang ON         | 1. Click switch 2. Chờ 1s                                                         | Không có `[data-sonner-toast]` nào xuất hiện (chỉ lỗi mới có toast)                | P2      |
| TC-PGW-07 | Giá trị lưu vào tauri-store              | Vừa tắt switch         | 1. Đọc `localStorage['tauri-store:settings.json']`                                | JSON chứa `"payment_direct_gateway":false`                                         | P2      |
| TC-PGW-08 | OFF giữ nguyên sau reload                | Vừa tắt switch         | 1. Reload `/settings/payment-gateway`                                             | `aria-checked = "false"`                                                           | P1      |
| TC-PGW-09 | Bật lại về ON và lưu                     | Switch đang OFF        | 1. Click switch                                                                   | `aria-checked = "true"`; store = `"payment_direct_gateway":true`                   | P1      |
| TC-PGW-10 | Click nhãn cũng đổi switch               | Ở màn payment-gateway  | 1. Click text "Charge directly via Fastboy Payment gateway"                       | `aria-checked` đảo trạng thái (label có `htmlFor="direct-gateway"`)                | P3      |
| TC-PGW-11 | Cleanup: khôi phục ON sau khi test       | Sau các case trên      | 1. Đặt lại switch về ON                                                           | Môi trường sạch — tránh đổi hành vi charge thẻ của các test sau                    | P1      |
