# Cross‑surface E2E: tạo appointment trên web → verify trong app Volt POS

> Tài liệu cho kịch bản **xuyên 2 bề mặt**: tạo một appointment trên **GoPOS web**
> (`pos.gocheckin.net`) bằng trình duyệt, rồi mở **app Volt POS** (desktop Tauri)
> để xác nhận appointment đó đã đồng bộ về. Dựng và chạy thật PASS 2026‑10‑14.

---

## 1. Tổng quan

Đây là bài test chứng minh luồng dữ liệu đi qua backend: **Web (browser) → backend
sync → App (desktop)**. Vì hai bề mặt chạy trên hai công nghệ khác nhau, framework
tách thành **hai lane WebdriverIO độc lập**, nối nhau bằng một **file handoff**.

```
┌─────────────────────────┐        .tmp/web-appointment-        ┌──────────────────────────┐
│  PHASE A — WEB lane      │        handoff.json                 │  PHASE B — APP lane       │
│  MS Edge + msedgedriver  │  ───────────────────────────────▶  │  tauri-driver (launch)    │
│  tạo appointment         │   {customerName, phone, staff,      │  mở /appointment, poll    │
│  (pos.gocheckin.net)     │    service, createdAtLabel}         │  tới khi thấy tên khách   │
└─────────────────────────┘                                     └──────────────────────────┘
```

**Vì sao 2 lane tách rời, nối bằng file?**
Mỗi lane là một tiến trình WDIO riêng với config riêng (một bên là browser web,
một bên là tauri‑driver khởi chạy app). Không gộp chung được, nên Phase A ghi khóa
đối chiếu ra `.tmp/web-appointment-handoff.json`, Phase B đọc lại. Không có file
handoff ⇒ Phase B **skip** (chứ không fail) — nó chỉ là nửa sau, không có gì để verify.

---

## 2. Cách chạy

```bash
# Gộp 1 lệnh: web tạo → app verify (dừng nếu web lỗi)
npm run test:web2pos

# Hoặc tách 2 nửa
npm run web:appointment      # Phase A: web tạo appointment + ghi handoff
npm run test:web-to-pos      # Phase B: launch app, verify appointment đã về
```

Phase B dùng **launch lane** (tauri‑driver tự mở cửa sổ till). KHÔNG dùng attach,
vì attach qua CDP 9222 trên máy này **chỉ expose cửa sổ màn khách** (`/customer/`),
không drive được màn till chính.

Kết quả đo được khi dựng:

- Phase A: PASS 3/3 ổn định, ~25–28s.
- Phase B: PASS, ~13s (cold boot lần đầu cần ~chục giây để sync kéo về).

---

## 3. Các file trong source

| File                                                     | Vai trò                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `configs/wdio/wdio.web.conf.ts`                          | Config lane web độc lập (MS Edge, **không** tauri/rootHooks). WDIO v9 tự quản `msedgedriver`. |
| `src/pages/web/OrderSitePage.ts`                         | POM web: login 2 bước + `createAppointment()`.                                                |
| `src/pages/web/handoff.ts`                               | `writeHandoff()` / `readHandoff()` — ghi/đọc `.tmp/web-appointment-handoff.json`.             |
| `tests/web/create-appointment.spec.ts`                   | Phase A.                                                                                      |
| `tests/regression/order-flow/web-to-pos-pending.spec.ts` | Phase B (app verify).                                                                         |
| `src/pages/pos/AppointmentPage.ts`                       | Thêm `hasAppointmentFor(name)`.                                                               |
| `configs/env/loadEnv.ts` + `.env.example`                | Khai báo biến `WEB_*`.                                                                        |
| `package.json`                                           | Scripts `web:appointment`, `test:web-to-pos`, `test:web2pos`.                                 |

---

## 4. Luồng chi tiết trên web (GoPOS)

### 4.1. Login — 2 bước

1. `/login`: ô textbox **"ID"** → nhập `WEB_MERCHANT_ID` (14 = Fastboy Nails) → nút **"Log In"**.
2. `/login/confirm` ("Welcome Fastboy Nails"): **Username** + **Password** → **"Log In"** → vào màn lịch (`/`).

### 4.2. Tạo appointment

1. Bấm **"New Appointment"** → dialog "Add New Appointment".
2. **Customer Phone** (bắt buộc): gõ số → chọn khách từ dropdown.
3. **Staff**: click field → modal "Change Staff" → chọn thẻ nhân viên.
4. **Service**: click field → modal "Change Service" → chọn nhóm → chọn dịch vụ con.
5. Start time / Duration / Date để mặc định → **"Save Appointment"**.
   Thành công: dialog đóng, card appointment hiện trên lịch, counter Processing tăng.

---

## 5. Những cạm bẫy đã xử lý (QUAN TRỌNG khi nghiên cứu lại)

Trang GoPOS web **không có `data-testid`** — DOM toàn `div` ẩn danh — nên mọi
selector đi theo text/placeholder/role. Các vấn đề thực tế gặp phải:

1. **Nhiều form ẩn trùng text.** Trang render sẵn rất nhiều bản dialog ẩn (batch
   close, giftcard, confirm…). `$()` thường trả về bản **ẩn** → mọi wait timeout.
   → Helper `visible()` duyệt `$$()` và chỉ lấy phần tử **đang displayed**.

2. **Ô Customer Phone có mask định dạng** `(xxx) xxx-xxxx`. `setValue` bị **rớt chữ
   số** → báo "Phone number must be 10 or 11 digits", dropdown ra danh sách mặc
   định (không lọc ra đúng khách).
   → `typePhone()` gõ **từng chữ số** (`addValue` per‑char) + đọc lại value, retry
   nếu chưa đủ số.

3. **`#home-left-scroll` bao cả dialog LẪN lịch.** Mỗi appointment từng tạo để lại
   một card mang tên khách trên lịch. Selector theo tên khách sẽ **trúng card lịch**
   (là `<div>`) thay vì option dropdown → không gắn được khách → Save no‑op → dialog treo.
   → Chọn khách nhắm đúng `<li class="...cursor-pointer">` trong dropdown của ô phone
   (card lịch là `div`, tự loại). Xác nhận gắn khách bằng **dropdown đóng** (li biến mất).

4. **Click bị overlay che / stale.** Text nằm trong `<p>` con bị layer khác che →
   WebDriver từ chối "not clickable at point"; list re‑render khi stream kết quả →
   "element wasn't found".
   → `clickEl()` fallback **JS click** (`node.click()`), `clickSelector()` **re‑find
   và click lại** khi gặp stale.

5. **Picker Staff/Service là modal riêng** (không phải `<select>`), có search box.
   Bản ẩn trùng khiến check "modal đóng" bằng `isExisting` không bao giờ đúng.
   → `waitGone()` check theo **displayed** (bỏ qua bản ẩn).

---

## 6. Phía app Volt POS

- **Attach bất khả dụng cho màn till trên máy này.** `GET http://127.0.0.1:9222/json`
  chỉ trả target `http://tauri.localhost/customer/` (màn khách). Màn till chính không
  expose CDP page → attach lane không drive được. ⇒ Phase B dùng **launch lane**.
- **Build cài sẵn strip `data-testid`.** `AppointmentPage.open()` chết ở readyAnchor
  (`appointment-heading`). ⇒ Phase B **không** gọi `open()`; thay vào đó `goTo(/appointment)`
  rồi poll `document.body.innerText` chứa tên khách. Đọc text trang né sạch mọi vấn đề
  testid/class từng card.
- **Cold boot sync lag.** Lần boot đầu, sync kéo appointment về có thể trễ → timeout
  poll đặt `Timeouts.APP_BOOT` (90s).

---

## 7. Merchant & đồng bộ

Verify chỉ đúng khi **web và app cùng một tiệm**.

- Web login: `WEB_MERCHANT_ID` (hiện `14` = Fastboy Nails).
- App: `MERCHANT_ID`. Máy này app đang đăng nhập tiệm **14** (thấy ở
  `%APPDATA%\VoltPOS\Databases\14`), nên đã set `MERCHANT_ID=14` cho khớp.
- Phase B có **guard**: nếu `WEB_MERCHANT_ID !== MERCHANT_ID` thì **skip** (khác tiệm
  thì appointment không thể sync về — là đúng, không phải bug). Khi đổi tiệm, chỉnh
  cả hai cho khớp trong `.env.dev`.

---

## 8. Bảo mật / PII

- Thông tin đăng nhập web **và dữ liệu khách (PII)** chỉ nằm trong `configs/env/.env.dev`
  (**git‑ignored**). Source public tuyệt đối **không** hardcode tên/SĐT khách.
- `.env.example` (tracked) chỉ có placeholder rỗng để mô tả schema.
- Biến liên quan:
  ```
  WEB_URL, WEB_MERCHANT_ID, WEB_USERNAME, WEB_PASSWORD
  WEB_CUSTOMER_PHONE, WEB_CUSTOMER_NAME   # PII — chỉ ở .env.dev
  WEB_STAFF, WEB_SERVICE                  # nhãn của tiệm
  ```
- ⚠️ Cẩn thận: `dashboard/public/data/history.json` (tracked) có thể **ghi lại tên
  khách** trong thông điệp lỗi của run fail. Nếu chạy fail, đừng commit file dashboard
  đó lên repo public — khôi phục về bản origin trước khi commit.

---

## 9. Mở rộng về sau

- Tạo khách MỚI trên web (thay vì chọn khách có sẵn) để test full đường UI tạo khách.
- Tạo qua **API backend** thay vì UI để ổn định hơn (nhưng bỏ phần test UI web).
- Verify chi tiết hơn trong app: khớp cả **giờ + dịch vụ**, không chỉ tên khách.
- Nếu app bật được màn till qua CDP, chuyển Phase B sang attach để không phải boot lại app.

---

## 10. Troubleshooting nhanh

| Triệu chứng                                                     | Nguyên nhân & cách xử                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase A: "Phone number must be 10 or 11 digits"                 | Mask rớt số — đã fix bằng gõ từng chữ số; nếu tái phát, tăng `settle` giữa các phím.                                                            |
| Phase A: "did not attach after 3 attempts"                      | Dropdown khách không ra (sai SĐT trong `.env.dev`) hoặc trúng card lịch — kiểm `WEB_CUSTOMER_PHONE`.                                            |
| Phase B: skip với log "WEB_MERCHANT_ID … but app MERCHANT_ID …" | Web và app khác tiệm — chỉnh cho khớp.                                                                                                          |
| Phase B: "did not appear … within the sync window"              | Sync chưa về / khác tiệm / app chưa login. Chạy `npm run app:launch` kiểm tra app ở tiệm đúng; đảm bảo `npm run web:appointment` đã chạy trước. |
| Phase B chết ở rootHooks "Return to the till"                   | Đang chạy **attach** (chỉ thấy màn khách) — dùng launch lane (`npm run test:web-to-pos`).                                                       |
