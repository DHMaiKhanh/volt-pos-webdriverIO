# Volt POS Test Runner (GUI desktop)

Cửa sổ desktop để **chọn tính năng và chạy auto test** WebdriverIO cho app Volt POS mà không cần gõ lệnh: tick tính năng ở cột trái, bấm **▶ Chạy**, rồi xem kết quả từng test ngay khi chạy.

---

## 1. Mở GUI

Chạy ở thư mục gốc repo (`D:\Project\webdriverIO_volt_pos`):

```bash
npm run runner:gui
```

Hoặc **double-click `VoltTestRunner.cmd`** ở thư mục gốc.

- Lần đầu sẽ tự build giao diện (vài giây).
- Cửa sổ mở bằng Microsoft Edge ở chế độ app (không có thanh địa chỉ, có icon riêng trên taskbar). Không cần cài Electron.
- Server chạy ở `http://127.0.0.1:4322`. Nếu Edge không có, mở địa chỉ này bằng trình duyệt bất kỳ.
- Đóng cửa sổ thì server tự tắt. **Riêng khi đang có lần chạy dở**, server vẫn chạy tiếp để test không bị ngắt; chạy lại lệnh để mở cửa sổ xem tiếp.

Sau khi sửa code giao diện (`dashboard/src/`), build lại rồi mở:

```bash
npm run runner:gui:build
```

Khi dev giao diện (Vite tự reload, cổng 4321 + runner 4322):

```bash
npm run dashboard:full
```

---

## 2. Bố cục màn hình

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Volt POS Test Runner │ ENV: dev ▾ │ ● Đang chạy 5/8 │ ≈1m ước tính │ ↻ Test lỗi lần trước │ ■ Dừng │ ◐ │
├───────────────────────────┬──────────────────────────────────────────────┤
│ 🔍 Tìm tính năng, file, TC │ Dashboard │ Kết quả │ Chạy & Console │ Lịch sử │ Lên lịch │ Thông báo │
│ @regression @smoke …      │                                              │
│ ☑ Chọn tất cả  Bỏ chọn    │   (nội dung tab)                              │
│ ▸ ☐ Tính năng A   ✓7 ✗1 8 │                                              │
│ ▸ ☐ Tính năng B        95 │                                              │
└───────────────────────────┴──────────────────────────────────────────────┘
```

### Thanh trên cùng

| Thành phần                          | Ý nghĩa                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ENV**                             | `dev` / `staging` / `prod`. Mỗi ENV là một bản build `.exe` khác nhau. **prod chỉ cho chạy `tests/smoke`** (chỉ xem, không tạo dữ liệu).                                       |
| **Trạng thái**                      | Sẵn sàng / Đang chạy x/y / Xong · n lỗi / Server offline.                                                                                                                      |
| **≈ … ước tính**                    | Thời gian còn lại, tính từ thời lượng các spec ở lần chạy trước (spec chưa có lịch sử tính 60 giây).                                                                           |
| **↻ Test lỗi lần trước (N)**        | Chạy lại các spec có lỗi ở lần chạy gần nhất.                                                                                                                                  |
| **▶ Chạy N spec · M test / ■ Dừng** | Chạy các spec đang tick / dừng ngay (tắt cả cây tiến trình: wdio, driver, app). **Spec = 1 file `*.spec.ts`, test = 1 `it(...)` bên trong**; M đã tính theo chip tag đang bật. |
| **◐**                               | Đổi giao diện sáng / tối.                                                                                                                                                      |

Tiêu đề cửa sổ hiện tiến độ, ví dụ `(305/1362) Volt POS Test Runner`, nên nhìn taskbar là biết đang chạy tới đâu.

### Cột trái: cây tính năng

Tự quét toàn bộ `tests/**/*.spec.ts` (208 spec, khoảng 2.500 test, 25 nhóm). Cấu trúc 3 tầng:

**Tính năng → file spec → từng test**

- **Ô tìm kiếm** (phím tắt `/`): tìm theo tên tính năng, tên file, tên test hoặc mã TC (vd `TC-ORDERFLOW-13`).
- **Chip tag**: `@regression`, `@smoke`, `@critical`, `@write`, `@payment`, `@exclusive`, `@dual-window`, `@slow`… Bật chip thì cây chỉ hiện test có tag đó, **và khi chạy cũng chỉ chạy test có tag đó** (lọc bằng `mochaOpts.grep`).
- **✗ Chỉ test lỗi**: chỉ hiện spec có lỗi ở lần chạy hiện tại hoặc gần nhất.
- **Checkbox 3 trạng thái**: tick tính năng là chọn cả nhóm; ô gạch ngang nghĩa là chọn một phần.
- **Chọn tất cả / Bỏ chọn**: khi đang lọc thì chỉ áp dụng cho các mục đang hiện.
- **⊞ / ⊟**: mở hết / thu gọn cây.
- **Số bên phải**: `✓` số đạt, `✗` số lỗi (từ lần chạy hiện tại, nếu chưa có thì lấy lần chạy gần nhất), ô xám là tổng số test.
- **▶ khi rê chuột vào dòng**: chạy riêng **một spec** hoặc **một test**. Chạy một test thì tắt retry để thấy kết quả thật.
- Spec đang chạy được tô màu và có vòng xoay; mỗi test có chấm màu trạng thái.

Lựa chọn, tag, ENV và tab đang mở được nhớ lại cho lần mở sau.

---

## 3. Các tab

### 🎯 Dashboard

Tổng quan **lần chạy gần nhất** đã ghi vào lịch sử: các ô KPI (tỉ lệ đạt, tổng số, thời gian), biểu đồ tỉ lệ đạt qua các lần chạy, kết quả theo spec.

### 📊 Kết quả (trực tiếp)

Màn hình chính khi đang chạy, cập nhật mỗi giây:

- **Vòng tròn % ĐẠT**: tỉ lệ (đạt + flaky) / (đạt + flaky + lỗi). Màu xanh = đạt, cam = flaky, đỏ = lỗi, vàng = bỏ qua.
- **Các ô số**: đạt · lỗi · flaky · bỏ qua · thời gian, kèm thanh tiến độ và spec đang chạy.
- **🗺 Bản đồ màn hình**: mỗi tính năng một ô, viền theo màu trạng thái, thanh tỉ lệ và số `✗lỗi !flaky ✓đạt/tổng`. **Bấm một ô để lọc hộp thư lỗi theo tính năng đó.**
- **📥 Hộp thư lỗi**: danh sách test lỗi và flaky, mới nhất ở trên, lọc _Tất cả / Lỗi / Flaky_.
  - Mỗi dòng ghi: tính năng · file · **thử lần N** · _chập chờn_ (nếu flaky) · _hook_ (nếu lỗi ở before/after).
  - Bấm vào dòng để xem thông báo lỗi.
  - Nút **↻** chạy lại riêng test đó.

**Flaky (chập chờn)** = test lỗi ở lần thử trước nhưng đạt khi spec được chạy lại (`specFileRetries`), hoặc đạt sau khi Mocha retry.

### ⚡ Chạy & Console

Log thô của `wdio` (giống chạy trong terminal), tô màu dòng `[PASS]` / `[FAIL]` / `[SKIP]`. Có ô lọc dòng, tự cuộn, Copy, Xoá. Chỉ hiển thị 4.000 dòng cuối cho nhẹ.

### 🕘 Lịch sử

50 lần chạy gần nhất (`dashboard/public/data/history.json`). Chọn một lần để xem chi tiết từng spec và test.

### ⏰ Lên lịch

Hẹn giờ chạy tự động **từ lựa chọn hiện tại** (spec đang tick + tag + ENV):

1. Tick spec / bật tag ở cột trái.
2. Nhập tên, giờ, chọn ngày trong tuần (CN–T7).
3. Bấm **+ Lưu lịch**.

Có thể bật/tắt hoặc xoá từng lịch; cột "lần cuối" cho biết lịch đã chạy hay bị bỏ qua.

> Lịch **chỉ chạy khi cửa sổ Runner (server) đang mở**. Đây không phải Windows Task Scheduler. Nếu đến giờ mà đang có lần chạy khác thì lịch đó bị bỏ qua. Lịch lưu ở `.tmp/gui-schedules.json`.

### 🔔 Thông báo

Khi một lần chạy kết thúc:

- **Thông báo Windows** (toast góc màn hình). Lần đầu bấm _Cho phép thông báo_.
- **Chỉ báo khi có lỗi**.
- **Âm báo**: 2 tiếng cao = đạt, 2 tiếng thấp = có lỗi.
- Nút **Gửi thử** để kiểm tra.

---

## 4. Các nhóm tính năng

| Nhóm trong GUI                                         | Thư mục `tests/`                      |
| ------------------------------------------------------ | ------------------------------------- |
| Kiểm tra nhanh toàn app (Smoke) — chỉ xem              | `smoke`                               |
| Home: tạo đơn, chấm công, Turn board                   | `regression/home`                     |
| Luồng đơn hàng: tạo đơn, thanh toán, refund, tách đơn  | `regression/order-flow`               |
| Thanh toán tiền mặt (Checkout)                         | `regression/checkout`                 |
| Lịch hẹn (Appointment)                                 | `regression/appointment`              |
| Lịch sử đơn (Order History)                            | `regression/order-history`            |
| Báo cáo thu nhập & Lương thợ                           | `regression/incomes`                  |
| Cài đặt (Settings)                                     | `regression/settings`                 |
| Tải lại app (Reload)                                   | `regression/app`                      |
| Kiểm tra nhanh Home, Lịch sử đơn, Lịch hẹn — chỉ xem   | `regression/volt-qc/pos`              |
| Tạo đơn ở Home & Đơn chờ (pending)                     | `regression/volt-qc/home-pend`        |
| Thanh toán: tiền mặt, Other, phí, thẻ                  | `regression/volt-qc/pay`              |
| Thanh toán thẻ qua máy cà thẻ (terminal)               | `regression/volt-qc/card-terminal`    |
| Khuyến mãi · Gift card · Tách đơn                      | `regression/volt-qc/promo-split`      |
| Lịch sử đơn · Huỷ đơn · Hoá đơn · Mở lại đơn           | `regression/volt-qc/oh-reopen`        |
| Lịch hẹn · Chấm công · Turn thợ                        | `regression/volt-qc/appt-time-turn`   |
| Màn hình khách (Customer Display)                      | `regression/volt-qc/cd-e2e`           |
| Báo cáo: Batch, Daily Sale, đối chiếu — chỉ xem        | `regression/volt-qc/reports-time`     |
| Cài đặt & Quản lý thiết bị — chỉ xem                   | `regression/volt-qc/settings-devm`    |
| Giao diện chung & Phân quyền passcode — chỉ xem        | `regression/volt-qc/app-perm`         |
| Giao diện chung & Phân quyền passcode — có đổi cài đặt | `regression/volt-qc/app-rpt-set-perm` |
| Lỗi theo ticket VP (thẻ, gift card, thanh toán)        | `regression/volt-qc/vp-tickets`       |
| Case kiểm tay — chỉ ghi nhận, không tự chạy            | `regression/volt-qc/_manual`          |
| Khôi phục app (Recovery)                               | `_recovery`                           |
| Web GoPOS / GoCheckin (tạo lịch hẹn, check-in)         | `web`                                 |

"Chỉ xem" = không tạo đơn, không đổi cài đặt. Các nhóm còn lại **có tạo dữ liệu thật** trên tiệm của ENV đang chọn. Rê chuột vào tên nhóm để xem thư mục gốc.

Muốn đổi tên hiển thị: sửa bảng `FEATURE_NAMES` trong `dashboard/server/catalog.mjs`, rồi mở lại Runner (hoặc bấm **↻ Quét lại spec** nếu chỉ thêm/bớt file spec).

---

## 5. Cách hoạt động (cho dev)

```
 GUI (React, dashboard/src)  ──HTTP /api/gui/*──▶  runner.mjs (Node, cổng 4322)
        ▲  poll 1 s                                    │ ghi .tmp/wdio.gui.conf.ts
        │                                              │ spawn: npm run preflight && npx wdio run …
        │                                              ▼
        └──── kết quả từng test ◀── reports/.gui-live/events.jsonl ◀── DashboardReporter (worker)
```

| File                                                                                                           | Vai trò                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/server/desktop.mjs`                                                                                 | Build UI nếu thiếu, khởi động server, mở cửa sổ Edge app mode.                                                                                  |
| `dashboard/server/runner.mjs`                                                                                  | API chạy/dừng, ghép kết quả live, phục vụ UI đã build, chạy lịch. Mỗi lúc chỉ 1 lần chạy (suite điều khiển 1 app qua 1 phiên WebDriver).        |
| `dashboard/server/catalog.mjs`                                                                                 | Đọc text các spec, lấy tiêu đề `describe`/`it` và tag (`title('…', Tag.X)` hoặc `@tag` trong chuỗi).                                            |
| `configs/reporters/DashboardReporter.ts`                                                                       | Ngoài việc ghi lịch sử, nó **ghi từng test ra file JSONL** khi biến `GUI_LIVE_FILE` được đặt (chỉ khi chạy từ GUI; chạy terminal không đổi gì). |
| `dashboard/src/App.tsx`, `dashboard/src/components/gui/*`, `dashboard/src/lib/gui.ts`, `dashboard/src/gui.css` | Giao diện.                                                                                                                                      |

**Chọn spec chuyển thành lệnh chạy như thế nào:** server sinh `.tmp/wdio.gui.conf.ts` kế thừa config của ENV (`configs/wdio/wdio.<env>.conf.ts`) và ghi đè `specs` + `mochaOpts.grep`. Nhờ vậy không bị giới hạn độ dài dòng lệnh của cmd (8.191 ký tự) khi chọn hàng trăm spec.

**API:**

| Method    | Đường dẫn                        | Mô tả                                                       |
| --------- | -------------------------------- | ----------------------------------------------------------- |
| GET       | `/api/gui/catalog[?refresh=1]`   | Cây tính năng → spec → test                                 |
| GET       | `/api/gui/state?since=<version>` | Trạng thái lần chạy + kết quả (chỉ trả lại khi có thay đổi) |
| GET       | `/api/gui/log?offset=<n>`        | Log từ vị trí `n`                                           |
| POST      | `/api/gui/run`                   | `{ env, specs[], tags?[], titles?[], label?, retries? }`    |
| POST      | `/api/gui/stop`                  | Dừng lần chạy                                               |
| GET / PUT | `/api/gui/schedules`             | Đọc / lưu danh sách lịch                                    |

---

## 6. Xử lý sự cố

| Hiện tượng                               | Cách xử lý                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| "Không kết nối được runner server"       | Server chưa chạy: mở bằng `npm run runner:gui`.                                              |
| Cửa sổ mở nhưng giao diện cũ             | Chạy `npm run runner:gui:build`.                                                             |
| Báo cổng 4322 đã dùng                    | Đã có một Runner khác đang chạy; cửa sổ mới tự nối vào nó. Đổi cổng bằng biến `RUNNER_PORT`. |
| Bấm Chạy báo "Đang có một lần chạy khác" | Chờ xong hoặc bấm **■ Dừng**.                                                                |
| ENV prod báo "chỉ được chạy tests/smoke" | Cố ý: prod là app thật của tiệm.                                                             |
| Mọi spec lỗi ngay ở `before all`         | Thường do app bị đăng xuất / thiếu passcode / app khác đang giữ cửa sổ; xem tab Console.     |
| Không thấy spec mới thêm                 | Bấm **↻ Quét lại spec** ở thanh tab.                                                         |
