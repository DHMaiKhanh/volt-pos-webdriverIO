---
title: Code Detail — Cash Drawer (route /cash-drawer — trang demo nội bộ)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Cash Drawer (route /cash-drawer — trang demo nội bộ) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Cash Drawer (route /cash-drawer — trang demo nội bộ)** · route `/cash-drawer` · scanned-at: 2026-08-20
> ❌ chưa dịch **5** · ⚠️ sai chuẩn / lệch thuật ngữ **0** · 📐 UI vỡ **0**
> Số liệu máy quét: 23 cặp EN↔VI · ✅ đúng glossary 6 · ⚠️ suspect 0 · dữ liệu 0 · scanner-missing 12 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/cash-drawer/compare.json` · HTML: `reports/cash-drawer/cash-drawer.html`
> Cách quét: `I18N_SCREEN=cash-drawer I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

**Đây KHÔNG phải tính năng Két tiền.** Route `/cash-drawer` không có trong sidebar và nội dung là một **trang demo component** (khu “Alerts”, khu “Dialogs”, các nút mở thử dialog) do dev để lại — xem `src/routes/_app/cash-drawer.tsx` ở app repo (import Dialog/AlertDialog/Tabs rồi render nút thử).

### 1. ❌ Chưa dịch (còn tiếng Anh)

| Chuỗi (EN)                                                 | Đang hiển thị (VI)   | Nên dịch                      | Nguồn (data-tsd-source)           |
| ---------------------------------------------------------- | -------------------- | ----------------------------- | --------------------------------- |
| Alerts / Dialogs                                           | Alerts / Dialogs     | (không cần dịch — trang demo) | card.tsx:120 — tiêu đề 2 khu demo |
| Show Dialog / Filter                                       | Show Dialog / Filter | (không cần dịch — trang demo) | button.tsx:92                     |
| Remove Customer Phone / Remove Service Item / Remove Staff | giữ nguyên           | (không cần dịch — trang demo) | button.tsx:92 — nút mở thử alert  |
| Delete Order / Void Order / Refund Payment                 | giữ nguyên           | (không cần dịch — trang demo) | button.tsx:92 — nút mở thử alert  |
| Add a Tip / Split Tip                                      | giữ nguyên           | (không cần dịch — trang demo) | button.tsx:92                     |

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

> Không phát hiện chuỗi dịch lệch chuẩn ở phạm vi đã quét.

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0`.

### 4. ✅ Đã dịch đúng (mẫu)

- Chỉ khung app (header/sidebar) là đã dịch; toàn bộ nội dung trong trang là chuỗi hardcode tiếng Anh

### 5. Ghi chú / đề xuất bổ sung glossary

- **Kết luận:** 12 chuỗi “chưa dịch” ở đây **không phải bug sản phẩm**. Đề xuất: (a) chặn route này khỏi build production, hoặc (b) loại `cash-drawer` khỏi phạm vi quét i18n (bỏ khỏi `SCREENS` trong `src/domains/i18n/i18nCompare.ts`).
- Quyền **Cash Drawer → “Khay tiền”** ở màn Quyền hạn là tính năng thật, không liên quan trang demo này.

### 6. Nguồn tham chiếu

- JSON: `reports/cash-drawer/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `cash-drawer`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
