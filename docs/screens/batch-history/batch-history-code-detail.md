---
title: Code Detail — Batch History (Lịch sử Batch)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Batch History (Lịch sử Batch) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Batch History (Lịch sử Batch)** · route `/batch-history` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **4** · 📐 UI vỡ **0**
> Số liệu máy quét: 48 cặp EN↔VI · ✅ đúng glossary 22 · ⚠️ suspect 0 · dữ liệu 20 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/batch-history/compare.json` · HTML: `reports/batch-history/batch-history.html`
> Cách quét: `I18N_SCREEN=batch-history I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Màn mới trong sidebar (giữa Order History và Daily Sale Report), route **gated** (passcode). Quét cả bảng danh sách và panel **Đối soát chốt batch** — mở bằng cách bấm số tiền ở cột “Tổng tiền”; click cả hàng KHÔNG mở panel.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                         | Gốc (EN)                                  | Nên dùng (chuẩn)                                                     | Vì sao                                                                                                                   |
| ------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lịch sử Batch / Ngày batch / Số batch | Batch History / Batch Date / Batch Number | **Thống nhất chữ thường: “Lịch sử batch”, “Ngày batch”, “Số batch”** | Cùng một từ “batch” nhưng tiêu đề viết hoa **Batch**, cột lại viết thường **batch**. Tiếng Việt không viết hoa giữa câu. |
| Quản lý lô (ở màn Permissions)        | Batch Management                          | **Quản lý batch**                                                    | Màn Quyền hạn dịch batch = **lô**, màn này giữ **batch** → cùng nghiệp vụ, 2 từ khác nhau ở 2 màn.                       |
| Mở                                    | Open                                      | **Đang mở**                                                          | Đây là **trạng thái** của batch; “Mở” một chữ dễ đọc thành động từ/nút.                                                  |
| Chưa chọn mục nào                     | No item selected                          | **Chưa chọn batch nào**                                              | Cụ thể hoá đối tượng cho đúng ngữ cảnh màn.                                                                              |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`. Bảng 5 cột + panel đối soát (~50 đơn) hiển thị đủ ở bản VI, không cắt chữ.

### 4. ✅ Đã dịch đúng (mẫu)

- Đối soát chốt batch (Batch Close Review)
- Chưa chốt batch (Not closed yet) · Trạng thái (Status)
- Tổng thanh toán (Total Payment) · Tổng tiền (Total Amount)
- Mã đơn (OD Code) · Tạm tính (Subtotal) · Tiền boa (Tip) · Tổng cộng (Total)
- 7 ngày qua (Last 7 Days) · 14/08/2026 - 20/08/2026 (ngày localize đúng)

### 5. Ghi chú / đề xuất bổ sung glossary

- Màn này **chưa có tài liệu** trong `docs/screens/` trước lần quét này → chưa có test case. Muốn có, chạy skill `screen-test-generator` cho `batch-history`.
- **Đề xuất `GLOSSARY`:** `Batch History: ['Lịch sử batch']`, `Batch Close Review: ['Đối soát chốt batch']`, `Batch Management: ['Quản lý batch']`, `Not closed yet: ['Chưa chốt batch']`.
- Không còn chuỗi tiếng Anh nào ở màn này (kể cả panel đối soát) — chỉ là vấn đề nhất quán thuật ngữ.

### 6. Nguồn tham chiếu

- JSON: `reports/batch-history/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `batch-history`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
