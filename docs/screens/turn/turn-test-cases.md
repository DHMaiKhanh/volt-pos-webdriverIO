---
title: Turn (Turn Board)
source: playwright-mcp-scan
scanned-at: 2026-08-13
---

# Turn (Turn Board) — Test Cases

## Feature Overview

### 1. Mục tiêu & phạm vi

**Turn KHÔNG phải một route** — đây là một **dialog** mở bằng search param
`?dialog=turn-board` trên bất kỳ route nào trong layout `_app`
(vd `http://localhost:1420/home?dialog=turn-board`). Sidebar (hamburger) có menu item
`button "Turn"` (giữa "Time Tracking" và "Setting") trỏ tới `url: "."` +
`dialog: "turn-board"`, nên nó mở dialog trên route hiện tại chứ không điều hướng.

Chức năng: hiển thị **bảng lượt (turn) của nhân viên theo NGÀY** — ai đang/đã chấm công
ngày đó, mỗi người "được" bao nhiêu turn tính từ doanh số dịch vụ trong ngày, sắp xếp
theo turn hoặc theo giờ check-in để quản lý thứ tự chia khách. Kèm 2 dialog con:

- **Adjust Manual Turn** — cộng/trừ turn thủ công cho từng nhân viên (ledger `turn_adjustment`).
- **Turn Settings** — cấu hình cách tính turn cho cả tiệm (`sys_setting.merchant_turn_default`).

Ngoài ra có **Turn Quick View**: một tab nổi `button "Turn"` ở cạnh màn hình, chỉ render
trên `/home`, `/order-pending`, `/order-history`, mở popover "Turn Order" xem nhanh bảng
turn hôm nay + `button "View Turn"` để mở dialog đầy đủ.

Quét trực tiếp bằng Playwright MCP trên `http://localhost:1420` (viewport 1920×1080, đúng
config repo), dữ liệu thật của merchant DEV. Các ngày dùng để quét: **13/08/2026 (hôm nay)**,
**27/07/2026** (6 staff chấm công, có doanh số), **05/08/2026** (1 staff, ca đã đóng),
**12/08/2026** (không ai chấm công → empty state).

> ⚠️ **Điều kiện dữ liệu bắt buộc:** bảng chỉ hiện nhân viên **có bản ghi chấm công của
> ngày đó**. Ngày không ai chấm công → luôn là empty state, không có cách nào hiện row.
> Muốn test bảng turn hôm nay phải Check In nhân viên trước (dialog Time Keeping —
> `?dialog=time-keeping`, xem `docs/screens/time-keeping/time-keeping-test-cases.md`).

### 2. Thành phần UI thực tế (quét bằng Playwright MCP)

**Dialog chính — `getByRole('dialog', { name: 'Turn' })`**

| Thành phần    | Vai trò (role/label)                                                   | Trạng thái                           | Ghi chú                                                                                 |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| Tiêu đề       | `heading "Turn"` (level 2)                                             | luôn hiện                            |                                                                                         |
| Đóng          | `button "Close"`                                                       | luôn hiện                            | đóng → URL bỏ `?dialog=turn-board`; ESC cũng đóng (đóng lớp trên cùng trước)            |
| Chọn ngày     | `button` chứa `generic "icon-calendar"` + text `MM/DD/YYYY`            | mặc định = hôm nay                   | mở popover date picker                                                                  |
| Sắp xếp       | `combobox` (không có aria-label, text = giá trị đang chọn)             | mặc định "Fewest turns first"        | 4 option, xem mục 3                                                                     |
| Điều chỉnh    | `button "Adjust Turn"` (icon bút)                                      | luôn hiện, kể cả khi bảng rỗng       | mở dialog "Adjust Manual Turn"                                                          |
| Cấu hình      | `button "Setting"` (icon bánh răng)                                    | luôn hiện, kể cả khi bảng rỗng       | mở dialog "Turn Settings"                                                               |
| Row nhân viên | `generic` (KHÔNG phải button/row) — thứ tự: hạng, avatar, tên, giá trị | 1 row / 1 nhân viên chấm công        | tên trong `paragraph`; **click row không làm gì** (không panel chi tiết, không đổi URL) |
| Hạng          | `generic` số `1..n`                                                    | theo thứ tự sort hiện tại            | đánh lại từ 1 mỗi lần đổi sort                                                          |
| Avatar        | `generic` 1 chữ cái đầu, màu theo `colorHex` của staff                 |                                      | không có ảnh trong bảng turn (khác thẻ staff ở Home)                                    |
| Giá trị turn  | `generic` số + `generic "Turns"`                                       | 0 hiển thị xám, >0 hiển thị xanh/đậm | 2 chữ số thập phân khi bật decimals (vd `4.24`, `0.46`, `3.62`)                         |
| Empty state   | `paragraph "No staff clocked in for this day"`                         | khi ngày đó không có ai chấm công    | toolbar (ngày/sort/Adjust/Setting) vẫn hiện đầy đủ                                      |

**Date picker (popover của nút ngày)**

| Thành phần | Vai trò (role/label)                           | Ghi chú                                                          |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Tháng      | `combobox` giá trị `Jan…Dec`                   | 12 `option`                                                      |
| Năm        | `combobox` giá trị năm                         | `option` từ **1970 → năm hiện tại (2026)**, không có năm sau     |
| Lưới ngày  | `grid "<Month> <Year>"` + `columnheader` Su…Sa | `status` hiển thị "August 2026"                                  |
| Ô ngày     | `button "Wednesday, August 12th, 2026"`        | hôm nay: `button "Today, Thursday, August 13th, 2026, selected"` |
| Ngày sau   | cùng dạng nhưng `[disabled]`                   | **mọi ngày > hôm nay đều disabled**                              |

**Dialog "Adjust Manual Turn" — `getByRole('dialog', { name: 'Adjust Manual Turn' })`**

| Thành phần | Vai trò (role/label)                                  | Trạng thái                                             | Ghi chú                                                              |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Tiêu đề    | `heading "Adjust Manual Turn"` (level 2)              |                                                        | mở từ `button "Adjust Turn"`                                         |
| Row        | avatar + `paragraph` tên + `paragraph "Current: <x>"` | 1 row / nhân viên, **thứ tự theo sort của bảng chính** |                                                                      |
| Giảm       | `button "decrease"` (aria-label)                      | `[disabled]` khi giá trị đang = 0                      | bước = 1, giữ phần thập phân (4.24 → 3.24); chặn ở 0 (0.46 → 0)      |
| Giá trị    | `generic` số đang chỉnh (pending)                     |                                                        | khác "Current" = row đang dirty                                      |
| Tăng       | `button "increase"` (aria-label)                      | luôn enable                                            | bước = 1                                                             |
| Lưu        | `button "Save"`                                       | `[disabled]` khi row chưa dirty                        | lưu riêng từng row; **không có toast**                               |
| Hoàn tác   | `button "Reset"`                                      | `[disabled]` khi row chưa dirty                        | chỉ revert pending về "Current" (local), KHÔNG xoá adjustment đã lưu |

**Dialog "Turn Settings" — `getByRole('dialog', { name: 'Turn Settings' })`**

| Thành phần | Vai trò (role/label)                                                                                | Trạng thái                                     | Ghi chú                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề    | `heading "Turn Settings"` (level 2)                                                                 |                                                | mở từ `button "Setting"`                                                                                            |
| Switch 1   | `switch "Calculate turns from services instead of orders"`                                          | mặc định môi trường quét: **checked**          | mô tả: "On: count a turn for each service, using the turn value below. Off: each completed order counts as 1 turn." |
| Switch 2   | `switch "Calculate turn values with decimals instead of rounding"`                                  | **`[disabled]` khi Switch 1 = Off**            | mô tả: "On: turn counts can include decimals (e.g. 1.6). Off: turn counts are whole numbers."                       |
| Turn value | `textbox "Turn value (minimum order amount counted as 1 turn)"`, placeholder `$0.00`                | vẫn **enable** dù Switch 1 = Off (dù vô nghĩa) | **mask tiền theo CENT**: gõ `25` → `$0.25`, gõ `2500` → `$25.00`; chữ và dấu `-` bị lọc (`abc-99` → `$0.99`)        |
| Helper     | `paragraph "The sales amount equal to one turn. Example: at $25, a $50 service counts as 2 turns."` |                                                |                                                                                                                     |
| Lưu        | `button "Save"`                                                                                     | luôn enable                                    | Save → dialog tự đóng, **không toast**, bảng turn tính lại ngay                                                     |

**Turn Quick View (chỉ trên `/home`, `/order-pending`, `/order-history`)**

| Thành phần | Vai trò (role/label)                    | Ghi chú                                                                                   |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tab nổi    | `button "Turn"` có `aria-expanded`      | **không render nếu bảng turn hôm nay rỗng**; kéo được, snap về cạnh gần nhất (left/right) |
| Popover    | `dialog` chứa `paragraph "Turn Order"`  | list row: hạng + avatar + tên + giá trị (KHÔNG có chữ "Turns", không có ngày/sort)        |
| Mở đầy đủ  | `button "View Turn"`                    | set `?dialog=turn-board`, mở dialog Turn, tab nổi tự collapse (`aria-expanded="false"`)   |
| Vị trí     | `localStorage.turn_quick_view_position` | `{"side":"left"\|"right","topPct":<number>}` — sống qua reload/điều hướng                 |

### 3. Luồng chính đã quan sát

1. **Mở** — hamburger → `button "Turn"` → sidebar đóng, URL thành `/home?dialog=turn-board`,
   dialog "Turn" hiện với ngày = hôm nay, sort = "Fewest turns first".
2. **Bảng theo ngày** — nếu hôm nay chưa ai chấm công → "No staff clocked in for this day".
   Sau khi Check In 2 nhân viên (Aubrey Shepard, Pamela) qua dialog Time Keeping → mở lại
   bảng thấy đúng 2 row: `Aubrey Shepard 1.02 Turns`, `Pamela 3.62 Turns`.
3. **Đổi sort** — chọn "Most turns first" → thứ tự đảo (Angela 4.24 → Alexander2 0.46 →
   nhóm 0 turn theo tên); "Earliest check-in first" và "Latest check-in first" cho 2 thứ tự
   **đảo ngược nhau chính xác** (Aubrey↔abc xyz1 xyz ở 2 đầu).
4. **Đổi ngày** — bấm nút ngày → popover → combobox tháng "Jul" → `button "Monday, July 27th, 2026"`
   → bảng nạp lại 6 nhân viên của ngày 27/07 (4 người 0 turn, Alexander2 0.46, Angela 4.24).
5. **Adjust Turn** — `button "Adjust Turn"` → dialog "Adjust Manual Turn" liệt kê đúng các
   nhân viên của bảng (cùng thứ tự sort), mỗi row `Current: <x>` + `−` / giá trị / `+` /
   Save / Reset. Bấm `+` → giá trị +1, Save & Reset chuyển enable **chỉ ở row đó**.
6. **Save trên bảng HÔM NAY** — Pamela `+` (3.62 → 4.62) → Save → `Current: 4.62`, row về
   trạng thái sạch (Save/Reset lại disabled), bảng phía sau cập nhật. Không có toast.
7. **Turn Settings** — `button "Setting"` → sửa Turn value/switch → Save → dialog đóng và
   bảng turn tính lại **ngay lập tức** (không cần reload). ESC/Close = huỷ, giá trị chưa lưu
   bị bỏ (mở lại thấy giá trị cũ trong DB).
8. **Quick View** — trên /home (khi có ít nhất 1 row hôm nay) có tab "Turn" ở cạnh trái;
   click → popover "Turn Order" với đúng 2 row + `button "View Turn"`; bấm "View Turn" →
   mở dialog Turn đầy đủ.
9. **Đóng** — `button "Close"` hoặc ESC → URL về `/home`. ESC khi đang mở dialog con thì
   đóng dialog con trước, ESC lần 2 mới đóng dialog Turn.

### 4. Nghiệp vụ & ràng buộc suy ra từ UI

**Ai được lên bảng (roster)**

- Row = nhân viên **có bản ghi chấm công của ngày được chọn**, không phải toàn bộ staff active.
- **Hôm nay**: chỉ nhân viên **đang trong ca** — kiểm chứng: Check In Aubrey + Pamela → 2 row;
  Check Out cả 2 → bảng hôm nay quay lại empty state ngay.
- **Ngày quá khứ**: ca đã đóng vẫn được liệt kê — 05/08/2026 hiện 1 row (staff `8888`) dù ca
  hôm đó đã check-out cùng ngày.

**Công thức turn (đã kiểm chứng bằng số thật)**

Mốc dữ liệu: **Angela Tyler 89999**, ngày 27/07/2026 — 9 order `successful` gồm 11 service,
tổng service price **$424.00** (1 order `canceled` $246.48 và 2 order `pending` KHÔNG được tính).

| Cấu hình                                | Turn value | Kết quả UI | Quy luật                                                                        |
| --------------------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------- |
| service-based **On** + decimals **On**  | $100.00    | `4.24`     | Σ(service price) / turn value, làm tròn 2 chữ số thập phân (424/100)            |
| service-based **On** + decimals **On**  | $25.00     | `16.96`    | 424/25 — tỉ lệ thuận, đổi setting là bảng tính lại ngay                         |
| service-based **On** + decimals **Off** | $25.00     | `7`        | **đếm số service có giá ≥ turn value** (7 service ≥ $25), tối đa 1 turn/service |
| service-based **On** + decimals **Off** | $60.00     | `3`        | 3 service ≥ $60 → khớp quy luật trên                                            |
| service-based **Off**                   | (bỏ qua)   | `9`        | **đếm số order `successful`** của nhân viên trong ngày                          |

- ⚠️ **decimals Off KHÔNG phải "làm tròn tổng"**: 16.96 → `7` chứ không phải `17`; Alexander2
  (4 service, tổng $46, mỗi service $15/$1 đều < $25) → `0` chứ không phải `2`. Đây là quy luật
  "mỗi service tối đa 1 turn, chỉ tính service đạt ngưỡng".
- Chỉ order **`successful`** được tính. Kiểm chứng thêm với Pamela ngày 13/08: 12 order
  successful $362.34 → `3.62`, trong khi $70 pending + $184 canceled + $170 cancel_issue bị bỏ.
- Turn value = **0** làm mọi row về `0 Turns` (không NaN, không lỗi) — xem mục 5.
- Adjustment thủ công **cộng thẳng vào** giá trị tính được: Aubrey doanh số $2.00 (= 0.02 turn)
  - adjustment `+1` → UI hiện `1.02`.

**Cấu hình & lưu trữ**

- Turn Settings là **cấu hình cả tiệm** (`sys_setting` key `merchant_turn_default`, value JSON
  `{turn_value, turn_service_based, turn_decimal}`, `turn_value` tính bằng **cent**) → đổi nó
  ảnh hưởng mọi máy/mọi worker test khác. Spec test cho màn này nên coi là **`@exclusive`**
  giống `TC-passcode-setting` / `TC-language-switch`, và phải **restore giá trị gốc** cuối test.
- Adjustment ghi vào ledger `turn_adjustment` (append-only, 1 row / 1 lần Save). "Reset" chỉ
  revert UI, không sinh row bù → muốn hoàn tác một `+1` đã lưu thì phải bấm `−` rồi Save lại.
- Ngày + sort đang chọn **sống qua close/reopen dialog** trong cùng session (đóng bằng Close
  rồi mở lại từ sidebar vẫn thấy `08/05/2026` + `Most turns first`), nhưng **reload trang thì
  reset** về hôm nay + "Fewest turns first".

**Quyền / gate**

- Dialog Turn **không có passcode gate** — deep-link `?dialog=turn-board` mở được ngay.
- Nếu deep-link trên một route bị gate (vd `/time-tracking?dialog=turn-board`) thì passcode
  dialog của **route nền** ("Enter staff code to access Time Tracking") phủ lên trên dialog Turn;
  bảng turn vẫn render phía sau nhưng bị chặn tương tác.

### 5. Trạng thái / quyền / edge case

- **Empty state**: `paragraph "No staff clocked in for this day"` — gặp ở 12/08/2026, ở hôm nay
  trước khi Check In, và ở hôm nay sau khi Check Out hết.
- **Ngày tương lai**: mọi ô ngày > hôm nay `[disabled]`; combobox năm chỉ tới năm hiện tại.
- **Row không tương tác**: click row không mở gì (không như Income Summary có detail panel).
- 🐞 **Adjust trên ngày quá khứ không có tác dụng lên ngày đó**: mở bảng 27/07/2026, Aubrey
  `Current: 0` → `+` → Save. Bảng 27/07 **vẫn hiện `0 Turns`**, `Current` vẫn `0`, và Save vẫn
  còn enable (row không về trạng thái sạch). Delta thực tế rơi vào **ngày hôm nay** — mở bảng
  13/08 thấy Aubrey `1.02` (= 0.02 doanh số + 1 adjustment). Ledger `turn_adjustment` ghi
  `createdAt = now`, còn bảng lọc adjustment theo ngày đang xem ⇒ adjustment cho ngày quá khứ
  là **ghi sai ngày và im lặng**. Cần confirm với dev: nên chặn Adjust khi ngày ≠ hôm nay, hay
  ghi delta theo ngày đang chọn.
- 🐞 **Turn value không validate**: xoá trắng ô rồi Save → lưu `turn_value = 0`, dialog đóng như
  bình thường, không lỗi/không toast; toàn bộ bảng chuyển `0 Turns` (Angela 16.96 → 0). Ô cũng
  không có min/max (mask chỉ lọc ký tự không phải số).
- 🐞 **Dirty state sai do số thực**: Aubrey `Current: 1.02`, bấm `−` → hiện `0.02` (trùng y hệt
  giá trị sau khi lưu) nhưng Save/Reset **vẫn enable** — do `1.02 - 1 = 0.020000000000000018`
  so sánh khác `0.02`. Hệ quả: bấm Save thêm lần nữa sẽ ghi thêm row ledger vô nghĩa.
- **Không có phản hồi thành công**: cả Save của Adjust và Save của Settings đều không có toast;
  test phải assert vào `Current:` / giá trị bảng, không assert toast.
- **Không có ô search** trong dialog Turn (khác Time Keeping) — bảng dài phải cuộn. Với 6 row
  (1000px dialog) chưa xuất hiện scroll container; cần ngày nhiều nhân viên để test cuộn.
- **A11y**: console cảnh báo `Missing "Description" or aria-describedby={undefined} for {DialogContent}`
  cho các dialog này; `combobox` sort không có aria-label (chỉ có text giá trị) nên codegen phải
  dùng `getByRole('dialog', { name: 'Turn' }).getByRole('combobox')` thay vì tìm theo tên.
- Lỗi console `asset://localhost/...webp — ERR_UNKNOWN_URL_SCHEME` xuất hiện suốt phiên quét
  nhưng **không liên quan Turn** (logo hoá đơn load qua scheme của Tauri, chạy trong Chrome thường
  sẽ luôn fail).

## Test Cases

| ID         | Tiêu đề                                                      | Tiền điều kiện                                                                   | Các bước                                                                                                                        | Kết quả mong đợi                                                                                                                                                                | Ưu tiên |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-TURN-01 | Mở Turn từ sidebar                                           | Đang ở `/home`                                                                   | 1. Bấm `button "Open sidebar"`. 2. Bấm `button "Turn"` (exact) trong `dialog "Sidebar"`.                                        | Sidebar đóng; URL = `/home?dialog=turn-board`; `dialog "Turn"` hiện với `heading "Turn"`.                                                                                       | P1      |
| TC-TURN-02 | Deep-link `?dialog=turn-board` mở dialog, không cần passcode | —                                                                                | Truy cập `/home?dialog=turn-board`.                                                                                             | Dialog "Turn" mở ngay, không có passcode dialog; toolbar hiện đủ ngày + combobox sort + `button "Adjust Turn"` + `button "Setting"`.                                            | P1      |
| TC-TURN-03 | Mặc định = hôm nay + "Fewest turns first"                    | Vừa reload trang rồi mở dialog                                                   | Quan sát toolbar.                                                                                                               | Nút ngày hiện `MM/DD/YYYY` của hôm nay; `combobox` hiện "Fewest turns first".                                                                                                   | P1      |
| TC-TURN-04 | Đóng bằng nút Close xoá search param                         | Dialog Turn đang mở                                                              | Bấm `button "Close"` trong dialog Turn.                                                                                         | Dialog đóng; URL về `/home` (không còn `?dialog=turn-board`).                                                                                                                   | P1      |
| TC-TURN-05 | ESC đóng lần lượt từng lớp dialog                            | Dialog Turn mở + đã mở "Adjust Manual Turn"                                      | 1. Nhấn `Escape`. 2. Nhấn `Escape` lần 2.                                                                                       | Lần 1: chỉ dialog "Adjust Manual Turn" đóng, dialog "Turn" còn mở, URL vẫn có `?dialog=turn-board`. Lần 2: dialog "Turn" đóng, URL về `/home`.                                  | P2      |
| TC-TURN-06 | Deep-link trên route bị gate → passcode phủ lên trên         | Chưa có grant passcode (gọi `armGate()` trước)                                   | Truy cập `/time-tracking?dialog=turn-board`.                                                                                    | Cả 2 dialog cùng mở: "Turn" ở dưới, passcode dialog "Enter staff code to access Time Tracking" ở trên; không tương tác được với bảng turn.                                      | P3      |
| TC-TURN-07 | Empty state khi ngày không ai chấm công                      | Chọn ngày không có bản ghi chấm công (vd 12/08/2026)                             | Mở dialog Turn → chọn ngày đó.                                                                                                  | Hiện `paragraph "No staff clocked in for this day"`; toolbar (ngày/sort/Adjust Turn/Setting) vẫn hiện đủ, không có row nào.                                                     | P1      |
| TC-TURN-08 | Row hiện đúng cấu trúc hạng/avatar/tên/turn                  | Ngày đang chọn có ≥1 nhân viên chấm công                                         | Quan sát 1 row bất kỳ.                                                                                                          | Row có số hạng (bắt đầu từ `1`), avatar 1 chữ cái đầu của tên, tên trong `paragraph`, giá trị turn + chữ `Turns`.                                                               | P1      |
| TC-TURN-09 | Click row không mở gì                                        | Bảng đang có row                                                                 | Click vào một row nhân viên.                                                                                                    | Không mở dialog/panel mới, URL không đổi, số dialog đang mở vẫn là 1.                                                                                                           | P2      |
| TC-TURN-10 | Check In → nhân viên xuất hiện trên bảng hôm nay             | Hôm nay chưa ai chấm công (bảng đang empty)                                      | 1. Mở `?dialog=time-keeping` → Check In 1 nhân viên. 2. Mở lại `?dialog=turn-board` (ngày = hôm nay).                           | Bảng có đúng 1 row = nhân viên vừa Check In; empty state biến mất.                                                                                                              | P1      |
| TC-TURN-11 | Check Out → nhân viên rời bảng hôm nay                       | Đã Check In 1 nhân viên (TC-TURN-10)                                             | 1. Mở Time Keeping → Check Out nhân viên đó. 2. Mở lại bảng Turn (hôm nay).                                                     | Nhân viên không còn trên bảng; nếu không còn ai đang trong ca → hiện lại `"No staff clocked in for this day"`.                                                                  | P1      |
| TC-TURN-12 | Ngày quá khứ vẫn liệt kê ca đã đóng                          | Có ngày quá khứ với ca check-in + check-out cùng ngày (05/08/2026)               | Mở bảng Turn → chọn ngày đó.                                                                                                    | Nhân viên của ca đã đóng vẫn hiện thành row (khác hẳn hành vi của ngày hôm nay).                                                                                                | P2      |
| TC-TURN-13 | Bảng chỉ hiện staff chấm công, không hiện toàn bộ staff      | Ngày có ít nhân viên chấm công hơn tổng staff active                             | So số row trên bảng với số thẻ staff ở màn Home.                                                                                | Số row ≪ số staff active; chỉ những người có bản ghi chấm công ngày đó xuất hiện.                                                                                               | P2      |
| TC-TURN-14 | Sort "Fewest turns first" (mặc định)                         | Ngày có ≥2 nhân viên với turn khác nhau (27/07/2026)                             | Quan sát thứ tự row.                                                                                                            | Turn tăng dần từ trên xuống (vd 0, 0, 0, 0, 0.46, 4.24); các row cùng giá trị giữ thứ tự theo tên.                                                                              | P1      |
| TC-TURN-15 | Sort "Most turns first" đảo thứ tự                           | Như TC-TURN-14                                                                   | Chọn `option "Most turns first"` trong combobox sort.                                                                           | Turn giảm dần (4.24 → 0.46 → nhóm 0); số hạng đánh lại từ 1.                                                                                                                    | P1      |
| TC-TURN-16 | Sort "Earliest check-in first"                               | Ngày có ≥3 nhân viên với giờ check-in khác nhau                                  | Chọn `option "Earliest check-in first"`, ghi lại thứ tự tên.                                                                    | Thứ tự khác thứ tự theo turn và khác thứ tự alphabet (giờ check-in không hiển thị trên row → chỉ assert thứ tự tên, không assert giờ).                                          | P2      |
| TC-TURN-17 | Sort "Latest check-in first" đảo đúng "Earliest"             | Đã ghi thứ tự ở TC-TURN-16                                                       | Chọn `option "Latest check-in first"`.                                                                                          | Danh sách tên là **đảo ngược chính xác** của kết quả TC-TURN-16.                                                                                                                | P2      |
| TC-TURN-18 | Combobox sort có đúng 4 option                               | Dialog Turn đang mở                                                              | Mở combobox sort.                                                                                                               | Đúng 4 `option`: "Fewest turns first", "Most turns first", "Earliest check-in first", "Latest check-in first"; option đang chọn có `[selected]`.                                | P2      |
| TC-TURN-19 | Date picker: cấu trúc + ngày hôm nay được chọn               | Dialog Turn đang mở, ngày = hôm nay                                              | Bấm nút ngày.                                                                                                                   | Popover có `combobox` tháng (`Jan…Dec`), `combobox` năm, `grid "<Month> <Year>"`, `columnheader` Su…Sa; ô hôm nay là `button "Today, …, selected"`.                             | P1      |
| TC-TURN-20 | Ngày tương lai bị disable                                    | Date picker đang mở ở tháng hiện tại                                             | Quan sát các ô ngày sau hôm nay.                                                                                                | Mọi `button` ngày > hôm nay có `[disabled]`; click không đổi được ngày.                                                                                                         | P1      |
| TC-TURN-21 | Combobox năm chỉ tới năm hiện tại                            | Date picker đang mở                                                              | Mở combobox năm.                                                                                                                | Option từ `1970` đến năm hiện tại (`2026`); không có năm tương lai.                                                                                                             | P3      |
| TC-TURN-22 | Đổi tháng rồi chọn ngày quá khứ → nạp lại bảng               | Dialog Turn đang mở                                                              | 1. Bấm nút ngày. 2. Chọn `option "Jul"`. 3. Bấm `button "Monday, July 27th, 2026"`.                                             | Popover đóng; nút ngày hiện `07/27/2026`; bảng nạp lại dữ liệu của ngày 27/07 (số row và giá trị turn thay đổi tương ứng).                                                      | P1      |
| TC-TURN-23 | Ngày + sort giữ nguyên khi đóng/mở lại dialog                | Dialog Turn đang mở                                                              | 1. Đổi ngày sang 05/08/2026 và sort sang "Most turns first". 2. Bấm `button "Close"`. 3. Mở lại Turn từ sidebar (KHÔNG reload). | Dialog mở lại vẫn giữ `08/05/2026` + "Most turns first".                                                                                                                        | P2      |
| TC-TURN-24 | Reload trang reset ngày + sort                               | Như TC-TURN-23 (đã đổi ngày/sort)                                                | Reload `/home?dialog=turn-board`.                                                                                               | Ngày về hôm nay, sort về "Fewest turns first".                                                                                                                                  | P2      |
| TC-TURN-25 | Turn Settings hiển thị đúng cấu hình đang lưu                | Dialog Turn đang mở                                                              | Bấm `button "Setting"`.                                                                                                         | `dialog "Turn Settings"` mở với 2 `switch` + `textbox "Turn value (minimum order amount counted as 1 turn)"` (giá trị đang lưu, vd `$100.00`) + helper text + `button "Save"`.  | P1      |
| TC-TURN-26 | Ô Turn value là mask tiền theo CENT                          | Dialog Turn Settings đang mở                                                     | 1. `fill('25')` vào ô Turn value → đọc value. 2. `fill('2500')` → đọc value.                                                    | Lần 1 = `$0.25`; lần 2 = `$25.00` (muốn $25 phải gõ `2500`).                                                                                                                    | P1      |
| TC-TURN-27 | Ô Turn value lọc chữ và dấu âm                               | Dialog Turn Settings đang mở                                                     | `fill('abc-99')` vào ô Turn value.                                                                                              | Value = `$0.99`; không nhập được ký tự chữ, không nhập được số âm.                                                                                                              | P2      |
| TC-TURN-28 | ESC/Close huỷ thay đổi Turn Settings chưa lưu                | Turn value đang lưu là `$100.00`                                                 | 1. Mở Turn Settings, `fill('2500')`. 2. Nhấn `Escape`. 3. Mở lại Turn Settings.                                                 | Ô Turn value hiện lại `$100.00`; 2 switch giữ trạng thái cũ; bảng turn không đổi.                                                                                               | P1      |
| TC-TURN-29 | Lưu Turn value mới → bảng tính lại ngay, dialog tự đóng      | Ngày đang chọn có nhân viên turn > 0 (Angela 4.24 @ $100)                        | 1. Mở Turn Settings → `fill('2500')` → `button "Save"`.                                                                         | Dialog Settings đóng (không toast); giá trị turn nhân 4 tương ứng ($100 → $25): 4.24 → `16.96`, 0.46 → `1.84`; không cần reload.                                                | P1      |
| TC-TURN-30 | decimals Off = đếm service đạt ngưỡng (KHÔNG làm tròn tổng)  | Turn value = `$25.00`, service-based On, Angela đang 16.96                       | Mở Turn Settings → tắt `switch "Calculate turn values with decimals instead of rounding"` → Save.                               | Angela hiện `7` (số service ≥ $25) chứ **không** phải `17`; Alexander2 (mọi service < $25) hiện `0` chứ không phải `2`.                                                         | P1      |
| TC-TURN-31 | decimals Off với ngưỡng khác vẫn theo quy luật đếm           | Tiếp TC-TURN-30 (decimals Off)                                                   | Đổi Turn value sang `$60.00` (`fill('6000')`) → Save.                                                                           | Angela hiện `3` = số service có giá ≥ $60.                                                                                                                                      | P2      |
| TC-TURN-32 | Tắt service-based → disable switch decimals                  | Dialog Turn Settings đang mở, service-based On                                   | Tắt `switch "Calculate turns from services instead of orders"`.                                                                 | `switch "Calculate turn values with decimals instead of rounding"` chuyển `[disabled]`; ô Turn value **vẫn enable**.                                                            | P2      |
| TC-TURN-33 | service-based Off → mỗi order successful = 1 turn            | Angela có 9 order `successful` ngày 27/07                                        | Tắt service-based → Save → xem bảng ngày 27/07.                                                                                 | Angela hiện `9`; Alexander2 (2 order successful) hiện `2`; order `canceled`/`pending` không được tính.                                                                          | P1      |
| TC-TURN-34 | Chỉ order `successful` được tính vào turn                    | Ngày có nhân viên vừa có order successful vừa có pending/canceled (Pamela 13/08) | Bật service-based + decimals, Turn value `$100.00`, xem row của nhân viên đó.                                                   | Turn = tổng service price của **order successful** / turn value (Pamela: $362.34 → `3.62`); tiền của order pending/canceled/cancel_issue bị loại.                               | P1      |
| TC-TURN-35 | 🐞 Turn value trống lưu thành 0, không validate              | Turn value đang là `$100.00`                                                     | 1. Mở Turn Settings → `fill('')` (xoá trắng) → `button "Save"`.                                                                 | **Bug**: dialog đóng, không báo lỗi, `turn_value` lưu = `0`; toàn bộ row trên bảng chuyển `0 Turns`. Kỳ vọng: chặn Save + báo lỗi bắt buộc/> 0.                                 | P1      |
| TC-TURN-36 | Mở Adjust Manual Turn từ bảng                                | Bảng đang có ≥1 row                                                              | Bấm `button "Adjust Turn"`.                                                                                                     | `dialog "Adjust Manual Turn"` mở; mỗi nhân viên 1 row với `paragraph "Current: <x>"` + `button "decrease"` + giá trị + `button "increase"` + `Save` + `Reset`.                  | P1      |
| TC-TURN-37 | Thứ tự row Adjust theo sort của bảng chính                   | Bảng đang sort "Latest check-in first"                                           | Mở "Adjust Manual Turn", so thứ tự tên với bảng.                                                                                | Thứ tự tên trong dialog Adjust trùng khớp thứ tự trên bảng Turn.                                                                                                                | P2      |
| TC-TURN-38 | Save/Reset disabled khi row chưa thay đổi                    | Dialog Adjust vừa mở                                                             | Quan sát nút của mọi row.                                                                                                       | Mọi `button "Save"` và `button "Reset"` đều `[disabled]`; giá trị pending = `Current`.                                                                                          | P1      |
| TC-TURN-39 | Tăng 1 bước → dirty chỉ ở row đó                             | Dialog Adjust đang mở, row A `Current: 0`                                        | Bấm `button "increase"` của row A.                                                                                              | Giá trị row A = `1`; Save + Reset của row A enable; các row khác vẫn `[disabled]`.                                                                                              | P1      |
| TC-TURN-40 | Giảm giữ phần thập phân, bước = 1                            | Row có `Current: 4.24`                                                           | Bấm `button "decrease"` của row đó.                                                                                             | Giá trị hiện `3.24` (trừ đúng 1, giữ `.24`).                                                                                                                                    | P2      |
| TC-TURN-41 | Không cho giá trị âm — chặn ở 0                              | Row có `Current: 0.46`                                                           | Bấm `button "decrease"` của row đó.                                                                                             | Giá trị về `0` (không phải `-0.54`); `button "decrease"` chuyển `[disabled]`.                                                                                                   | P1      |
| TC-TURN-42 | decrease disabled sẵn khi Current = 0                        | Row có `Current: 0`                                                              | Quan sát `button "decrease"` của row đó.                                                                                        | `[disabled]`; `button "increase"` vẫn enable.                                                                                                                                   | P2      |
| TC-TURN-43 | Reset revert pending về Current                              | Row đang dirty (đã bấm `−`/`+`)                                                  | Bấm `button "Reset"` của row đó.                                                                                                | Giá trị về đúng `Current`; Save + Reset của row đó `[disabled]` lại; các row dirty khác **không bị ảnh hưởng**.                                                                 | P1      |
| TC-TURN-44 | Save adjustment trên bảng HÔM NAY                            | Ngày = hôm nay, row Pamela `Current: 3.62`                                       | 1. Bấm `+` (→ 4.62). 2. Bấm `button "Save"` của row đó.                                                                         | `Current: 4.62`; giá trị pending = 4.62; Save/Reset trở lại `[disabled]`; bảng Turn phía sau hiện `4.62 Turns`. Không có toast (đừng assert toast).                             | P1      |
| TC-TURN-45 | Adjustment cộng thẳng vào turn tính từ doanh số              | Nhân viên có doanh số nhỏ hôm nay (Aubrey $2.00 → 0.02)                          | Adjust `+1` cho nhân viên đó rồi xem bảng.                                                                                      | Bảng hiện `1.02 Turns` (0.02 + 1) — adjustment là phép cộng, không thay thế.                                                                                                    | P1      |
| TC-TURN-46 | Hoàn tác adjustment đã lưu phải Save lần nữa                 | Đã lưu `+1` cho 1 nhân viên (TC-TURN-45)                                         | Bấm `−` (1.02 → 0.02) → `button "Save"`.                                                                                        | `Current` về `0.02`; bảng hiện `0.02 Turns`. (Ledger append-only: sinh thêm 1 row delta `-1`, tổng bằng 0 — "Reset" **không** làm được việc này.)                               | P2      |
| TC-TURN-47 | 🐞 Save adjustment khi đang xem ngày quá khứ                 | Bảng đang ở ngày quá khứ (27/07/2026), row `Current: 0`                          | 1. Bấm `+` (→ 1). 2. Bấm `Save`. 3. Xem lại bảng ngày 27/07. 4. Đổi ngày về hôm nay.                                            | **Bug**: bảng 27/07 vẫn `0 Turns`, `Current` vẫn `0`, Save vẫn enable; delta lại xuất hiện trên bảng **hôm nay** (+1). Kỳ vọng: hoặc chặn Adjust, hoặc ghi theo ngày đang chọn. | P1      |
| TC-TURN-48 | 🐞 Dirty state không tự sạch do sai số số thực               | Row `Current: 1.02` (do 0.02 + adjustment 1)                                     | Bấm `button "decrease"` → so giá trị hiển thị với `Current`.                                                                    | **Bug**: hiện `0.02` trùng với giá trị đã lưu nhưng Save/Reset vẫn enable (1.02 − 1 = 0.020000000000000018). Kỳ vọng: so sánh có epsilon → nút disabled.                        | P2      |
| TC-TURN-49 | Adjust Turn / Setting vẫn mở được khi bảng rỗng              | Ngày đang chọn là empty state                                                    | Bấm `button "Adjust Turn"`, đóng lại, bấm `button "Setting"`.                                                                   | "Adjust Manual Turn" mở nhưng không có row nào; "Turn Settings" mở bình thường và vẫn lưu được cấu hình.                                                                        | P3      |
| TC-TURN-50 | Quick View chỉ hiện trên 3 route                             | Hôm nay có ≥1 nhân viên trên bảng turn                                           | Lần lượt mở `/home`, `/order-pending`, `/order-history`, rồi `/time-tracking`.                                                  | Tab nổi `button "Turn"` xuất hiện ở 3 route đầu; **không** xuất hiện ở `/time-tracking`.                                                                                        | P2      |
| TC-TURN-51 | Quick View không render khi bảng hôm nay rỗng                | Hôm nay không ai đang trong ca                                                   | Mở `/home`.                                                                                                                     | Không có tab nổi `button "Turn"` nào trong DOM.                                                                                                                                 | P2      |
| TC-TURN-52 | Popover Quick View hiện đúng dữ liệu hôm nay                 | Hôm nay có ≥1 row (vd Aubrey 1.02, Pamela 3.62)                                  | Bấm tab nổi `button "Turn"`.                                                                                                    | Popover mở với `paragraph "Turn Order"` + các row hạng/avatar/tên/giá trị trùng đúng bảng turn hôm nay; `aria-expanded="true"` trên tab.                                        | P1      |
| TC-TURN-53 | "View Turn" mở dialog Turn đầy đủ                            | Popover Quick View đang mở                                                       | Bấm `button "View Turn"`.                                                                                                       | URL thành `?dialog=turn-board`; dialog "Turn" mở; popover đóng, tab nổi `aria-expanded="false"`.                                                                                | P1      |
| TC-TURN-54 | Kéo tab Quick View → snap cạnh + lưu vị trí                  | Tab nổi đang ở cạnh trái                                                         | 1. Kéo tab sang nửa phải màn hình. 2. Đọc `localStorage.turn_quick_view_position`. 3. Điều hướng sang `/order-pending`.         | Tab snap sát cạnh phải; localStorage lưu `{"side":"right","topPct":<số>}`; sau khi điều hướng/reload tab vẫn ở đúng vị trí đã lưu.                                              | P2      |
| TC-TURN-55 | Turn Settings là cấu hình toàn tiệm — phải restore           | Biết giá trị gốc (vd `{turn_value:10000, service_based:true, decimal:true}`)     | Đổi cấu hình trong test rồi restore lại đúng giá trị gốc ở bước cleanup.                                                        | Sau test, `sys_setting.merchant_turn_default` khớp giá trị gốc; các spec khác không bị lệch số turn. Spec nên chạy `@exclusive` (serial), không song song.                      | P1      |

> **Ghi chú cho bước sinh code (`testcase-to-code`)**
>
> - Dialog Turn không có route riêng → page object nên nhận `route` để mở deep-link
>   `<route>?dialog=turn-board` (mặc định `/home`), và có helper mở qua sidebar.
> - Không có toast cho cả 2 luồng Save → assert vào `paragraph "Current: …"` và giá trị row.
> - Row bảng turn là `generic`, không phải `row`/`button` → định vị bằng
>   `dialog.getByText(<tên staff>)` rồi lấy container cha, hoặc regex trên text cả row
>   (dạng `"<hạng><chữ cái><tên><giá trị>Turns"`).
> - `button "decrease"` / `"increase"` là aria-label, trùng nhau giữa các row → phải scope
>   theo row hoặc dùng `.nth(i)` theo đúng thứ tự sort hiện tại.
> - Ô Turn value là mask **cent**: muốn $25.00 phải `fill('2500')`.
> - Test cần dữ liệu → phải Check In nhân viên trước (Time Keeping) và Check Out ở cleanup;
>   test công thức turn nên chạy trên **ngày quá khứ có dữ liệu ổn định** (27/07/2026) để
>   không bị order mới của worker khác làm lệch số.
