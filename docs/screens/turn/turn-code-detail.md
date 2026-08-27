---
title: Code Detail — Turn (Bảng lượt)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Turn (Bảng lượt) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Turn (Bảng lượt)** · route `/home?dialog=turn-board` · scanned-at: 2026-08-20
> ❌ chưa dịch **2** · ⚠️ sai chuẩn / lệch thuật ngữ **4** · 📐 UI vỡ **0**
> Số liệu máy quét: 171 cặp EN↔VI · ✅ đúng glossary 55 · ⚠️ suspect 1 · dữ liệu 40 · scanner-missing 4 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 2
> Dữ liệu thô: `reports/turn/compare.json` · HTML: `reports/turn/turn.html`
> Cách quét: `I18N_SCREEN=turn I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Turn là **dialog** (`?dialog=turn-board`) nên bản quét bắt luôn chuỗi của route nền `/home`; phần dưới chỉ tính chuỗi **của riêng Turn** (dialog chính + `Chỉnh lượt thủ công` + `Cài đặt phiên làm việc`). Quét thêm bằng MCP với ngày **13/08/2026** (ngày có thợ chấm công) để bảng có dữ liệu, vì hôm nay bảng rỗng.

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)                       | Đang hiển thị (VI)  | Nên dịch    | Nguồn (data-tsd-source)                                            |
| -------------------------------- | ------------------- | ----------- | ------------------------------------------------------------------ |
| increase / decrease (aria-label) | increase / decrease | Tăng / Giảm | turn-board-adjust-dialog.tsx — nút +/− trong `Chỉnh lượt thủ công` |
| Search... (aria-label)           | Search...           | Tìm kiếm…   | icon.tsx:64 — icon ô tìm kiếm của route nền                        |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)                                            | Gốc (EN)                                            | Nên dùng (chuẩn)                                            | Vì sao                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phiên làm việc                                           | Turn                                                | **Lượt (tiêu đề: “Bảng lượt”)**                             | Cùng thuật ngữ Turn nhưng thân dialog lại dịch là **lượt** (“Ít lượt nhất trước”, “Chỉnh lượt”, đơn vị “Lượt”). Tiêu đề dialog + menu sidebar là chỗ duy nhất dùng “Phiên làm việc” → lệch chuẩn ngay trong cùng một màn; “Phiên làm việc” = work session, không phải lượt chia khách. |
| Cài đặt phiên làm việc                                   | Turn Settings                                       | **Cài đặt lượt**                                            | Cùng lỗi trên; dialog Setting mở từ Turn và mục Turn Settings trong Business Info đều dùng “phiên làm việc”.                                                                                                                                                                           |
| Giá trị phiên (số tiền tối thiểu của đơn để tính 1 lượt) | Turn value (minimum order amount counted as 1 turn) | **Giá trị lượt (số tiền tối thiểu của đơn để tính 1 lượt)** | Trong CÙNG một câu đã dùng “lượt” nhưng chủ ngữ lại là “Giá trị phiên” → đọc rất lệch.                                                                                                                                                                                                 |
| Khuyến mãi & Phần thưởng                                 | Promo & Rewards                                     | **Khuyến mãi & Thưởng**                                     | Chuỗi của route nền `/home` (không thuộc Turn) — glossary chốt “Thưởng”.                                                                                                                                                                                                               |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Không tràn ngang (`xOverflow 0`) và **không có nhãn nào của Turn bị cắt**. Sau khi sửa detector (bỏ qua phần tử `sr-only` — xem mục 6), lượt quét lại chỉ còn 2 chuỗi bị ellipsis và cả 2 đều là **dữ liệu của route nền** `/home`: `"MANICURE & PEDICURE"` (tên danh mục) và `"SuperLongServiceNameWithoutAnySpace…"` (tên dịch vụ test cố tình dài). Bảng lượt, dialog Chỉnh lượt và dialog Cài đặt hiển thị đủ chữ.

### 4. ✅ Đã dịch đúng (mẫu)

- Ít lượt nhất trước (Fewest turns first)
- Chỉnh lượt (Adjust Turn) · Chỉnh lượt thủ công (Adjust Manual Turn)
- Chưa có thợ nào chấm công ngày này (No staff clocked in for this day)
- Hiện tại: 0.02 · Lưu · Đặt lại (Current / Save / Reset)
- Tính lượt theo dịch vụ thay vì theo đơn hàng · Tính lượt theo số thập phân thay vì làm tròn

### 5. Ghi chú / đề xuất bổ sung glossary

- **Đề xuất bổ sung `GLOSSARY`** (`src/domains/i18n/i18nCompare.ts`): `Turn: ['Lượt']`, `Turn Settings: ['Cài đặt lượt']`, `Turn value: ['Giá trị lượt']`, `Adjust Turn: ['Chỉnh lượt']`. Hiện chưa có key nào cho “Turn” nên scan xếp “Phiên làm việc” là `ok` — đúng blind-spot mà SKILL cảnh báo.
- Tab nổi **Turn Quick View** không render khi hôm nay chưa ai chấm công → chưa quét được; cần check-in 1 thợ rồi quét lại.
- Bảng lượt chỉ có dòng khi ngày đó có bản ghi chấm công (lần này dùng 13/08/2026).

### 6. Nguồn tham chiếu

- JSON: `reports/turn/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `turn`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
