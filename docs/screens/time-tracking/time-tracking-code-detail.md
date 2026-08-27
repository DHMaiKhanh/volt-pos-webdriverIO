---
title: Code Detail — Time Tracking (Quản lý chấm công)
source: playwright-mcp-scan + TC-i18n-screen-compare
scanned-at: 2026-08-20
---

# Time Tracking (Quản lý chấm công) — Code Detail

> File này hiện chỉ có mục **i18n Notes** (kết quả quét Tiếng Việt 2026-08-20).
> Mục `## Flow Map` / `## Code Detail` sẽ do skill `codegen-flow` bổ sung khi màn được sinh test.

## i18n Notes

> **Quét Tiếng Việt (EN↔VI) — Time Tracking (Quản lý chấm công)** · route `/time-tracking` · scanned-at: 2026-08-20
> ❌ chưa dịch **0** · ⚠️ sai chuẩn / lệch thuật ngữ **3** · 📐 UI vỡ **0**
> Số liệu máy quét: 48 cặp EN↔VI · ✅ đúng glossary 18 · ⚠️ suspect 0 · dữ liệu 3 · scanner-missing 0 · tràn ngang 0px · chuỗi bị ellipsis (thô, gồm cả dữ liệu) 0
> Dữ liệu thô: `reports/time-tracking/compare.json` · HTML: `reports/time-tracking/time-tracking.html`
> Cách quét: `I18N_SCREEN=time-tracking I18N_LENIENT=1 npx playwright test tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry` (+ soi popup/panel bằng Playwright MCP)

Bảng bản ghi giờ vào/ra theo ngày (route **gated** bằng passcode). Hôm nay chưa có bản ghi → quét được cả empty state.

### 1. ❌ Chưa dịch (còn tiếng Anh)

> 🎉 Không còn chuỗi UI tiếng Anh nào của màn này (đã lọc tên nhân viên / tên dịch vụ / mã đơn — dữ liệu, không phải nhãn).

### 2. ⚠️ Dịch chưa đúng chuẩn / chưa nhất quán

| Hiện tại (VI)     | Gốc (EN)           | Nên dùng (chuẩn)                                                           | Vì sao                                                                                                                                                                                                               |
| ----------------- | ------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quản lý chấm công | Time Tracking      | **Bảng công (hoặc “Lịch sử chấm công”)**                                   | Sidebar đang có 2 mục gần như trùng tên: **Chấm công** (dialog Time Keeping, để bấm vào/ra) và **Quản lý chấm công** (màn này, để xem/sửa bản ghi). Tên hiện tại không cho biết mục nào để chấm, mục nào để tra cứu. |
| Lưu ý (cột Note)  | Note               | **Ghi chú**                                                                | Với một **cột dữ liệu** thì “Ghi chú” mới đúng; “Lưu ý” mang nghĩa cảnh báo. Glossary cho phép cả hai nên scan không bắt được.                                                                                       |
| Giờ vào / Giờ ra  | Date IN / Date OUT | **Giờ vào / Giờ ra (giữ) — nên sửa **bản EN** thành “Time In / Time Out”** | Bản VI đúng hơn bản EN (ô hiển thị cả ngày + giờ, nhưng nghiệp vụ là giờ vào/ra). Ghi nhận để sửa phía EN.                                                                                                           |

### 3. 📐 Vỡ giao diện (chỉ báo cáo)

Sạch: `xOverflow 0`, `clipped 0` (cả bảng 8 cột lẫn empty state).

### 4. ✅ Đã dịch đúng (mẫu)

- Tổng giờ (Total Hours) · Ngày tạo / Ngày cập nhật (Created At / Updated At) · Hành động (Action)
- Không có bản ghi chấm công (No time tracking records)
- Không có dữ liệu chấm công cho khoảng ngày đã chọn.
- Hôm nay (Today) · 20/08/2026 (ngày localize đúng)

### 5. Ghi chú / đề xuất bổ sung glossary

- **Chưa quét**: dialog Thêm/Sửa bản ghi chấm công (`time-tracking-add-dialog`, `-update-dialog`) — chứa form ngày/giờ + ghi chú, khả năng cao có chuỗi chưa phủ.
- Cùng lỗi **giờ 12h AM/PM** như Time Keeping nếu bảng có dữ liệu (xem màn `time-keeping`).

### 6. Nguồn tham chiếu

- JSON: `reports/time-tracking/compare.json` (sinh tự động, không sửa tay)
- Glossary chuẩn: `GLOSSARY` trong [`src/domains/i18n/i18nCompare.ts`](../../../src/domains/i18n/i18nCompare.ts)
- Registry màn quét: `SCREENS` trong cùng file (màn này: `time-tracking`)
- Sửa bộ quét trong lượt này: `detectBody()` bỏ qua phần tử **visually-hidden** (`sr-only`) khi tìm chữ bị cắt — trước đó mọi nhãn `sr-only` của nút icon (`Đóng`, `Chuyển đổi`, `Cập nhật`…) đều bị báo là "UI vỡ" dù màn hình hiển thị bình thường.
- Lỗi dùng chung cả app (không lặp lại ở từng màn): aria-label khung app chưa dịch (`Open sidebar`, `Open pending orders`, `Search...`, `icon-calendar`, `Notifications alt+T`) · **giờ vẫn định dạng 12h AM/PM** ở bản VI dù ngày đã đổi sang dd/mm/yyyy · badge `DEV` là nhãn môi trường, không dịch.
