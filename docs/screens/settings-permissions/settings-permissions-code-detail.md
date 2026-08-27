---
title: Code Detail — Permissions (Quyền hạn)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Permissions (Quyền hạn) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Permissions (Quyền hạn)** · route `/settings/permissions` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **2** · 📐 UI vỡ **0**
> Số liệu máy quét: 57 cặp EN↔VI · ✅ đúng glossary 49 · ⚠️ suspect 0 · dữ liệu 2 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/settings-permissions/compare.json` · HTML: `reports/settings-permissions/settings-permissions.html`
> Cách quét: `I18N_SCREEN=settings-permissions I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Bảng quyền theo vai trò (route có passcode guard riêng). Quét ở trạng thái thu gọn — chưa bấm “Mở rộng tất cả”.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI) | Gốc (EN)         | Nên dùng (chuẩn)                                                       | Vì sao                                                                                                                                     |
| ------------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Quản lý lô    | Batch Management | **Quản lý batch**                                                      | Màn **Lịch sử Batch** giữ nguyên từ “batch” (Ngày batch, Số batch, Chưa chốt batch) nhưng ở đây lại là “lô” → 2 từ cho cùng một nghiệp vụ. |
| Khay tiền     | Cash Drawer      | **Khay tiền (giữ) — hoặc “Két tiền” nếu muốn thống nhất với tài liệu** | Bản dịch hợp lý; chỉ lưu ý tài liệu test nội bộ đang gọi là “Két tiền”.                                                                    |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang và **không có UI vỡ**. Chuỗi "Chuyển đổi" từng bị báo cắt là nhãn **`sr-only`** của nút mở/gập nhóm quyền (`permission-table.tsx:130`) — vô hình có chủ đích.

### 4. ✅ Đã dịch đúng (mẫu)

- Truy cập (Access) · Chọn tất cả (Select All) · Mở rộng tất cả (Expand All)
- Quản lý đơn hàng (Order Management) · Thu nhập (Income) · Cài đặt hệ thống (System Setting)
- Chủ / Quản lý / Đối tác / Nhân viên (các cột vai trò)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: danh sách quyền con sau khi bấm “Mở rộng tất cả” (mỗi nhóm có hàng chục nhãn quyền) → nên quét bổ sung, đây là nơi dễ sót chuỗi nhất của màn này.
- Màn này chưa có tài liệu test case trong `docs/screens/` trước lần quét này.

### 6. Nguồn tham chiếu

- JSON: `reports/settings-permissions/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `settings-permissions`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
