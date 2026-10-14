# Đóng gói test cho QA chạy (không cần môi trường dev)

Ghi chú tổng hợp: có thể gom toàn bộ test case cho QA bấm-phát-chạy không, và làm thế nào.

---

## 1. Kết luận ngắn

**Được** — nhưng KHÔNG phải dạng "1 file `.exe` đông cứng". Thứ đúng cần làm là một
**launcher `.exe` tự bootstrap**: vỏ `.exe` → `run.ps1` → lần đầu tự cài phụ thuộc +
khớp driver → hiện **menu chọn suite** để chạy.

---

## 2. Vì sao KHÔNG đóng được "1 file .exe đông cứng"

Ba chặn kỹ thuật, đến từ chính bản chất suite:

1. **Driver phải khớp từng máy QA (không thể đông cứng).**
   `scripts/setup-drivers.ts` đọc version **WebView2 Runtime trong registry của chính
   máy đó** rồi tải đúng `msedgedriver` khớp. Lệch version → **session treo im lặng,
   KHÔNG báo lỗi**, chết ở connection timeout trông như test flaky. Nhét sẵn 1
   `msedgedriver.exe` cố định rồi đưa đi mọi máy là sai → bắt buộc chạy `setup:drivers`
   **trên máy QA**.

2. **Specs là `.ts` nạp động.**
   wdio glob `tests/**/*.spec.ts`, root hooks bắt buộc `.ts`, chạy qua `tsx`. Tool đóng
   exe (`pkg` / Node SEA) không gói kiểu nạp-động + native driver này một cách sạch.

3. **Cần app thật + WebView2 Runtime trên máy QA.**
   Bundle không chứa được app — `tauri-driver` tự launch `APP_PATH`.

> `tauri-driver.exe` thì **đông cứng được** (nó là proxy, không gắn WebView2) → ship sẵn
> để máy QA khỏi phải cài Rust/cargo.

---

## 3. Kiến trúc bundle

```
VoltPOS-Tests/                 (= bản copy repo đã lọc rác)
├─ Run-Volt-Tests.exe          vỏ ps2exe (tuỳ chọn) — double-click là chạy
├─ run.ps1                     launcher menu + bootstrap
├─ node/node.exe               Node portable (nếu đóng kèm -NodeZip)
├─ .drivers/
│  ├─ tauri-driver.exe         ship sẵn (đông cứng OK)
│  └─ msedgedriver.exe         re-match theo máy QA ở lần chạy đầu
├─ configs/ src/ tests/ scripts/ package.json ...
├─ configs/env/.env.dev        secret thật + CARD_SETTLE=1 (charge thật)
└─ node_modules/               nếu dùng -VendorDeps; nếu không → npm ci lần đầu
```

---

## 4. Các file đã tạo trong `qa-pack/`

| File                 | Việc                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `run.ps1`            | Launcher **menu chọn suite**. Lần đầu tự `npm ci` + `setup:drivers`. Ưu tiên Node bundled.  |
| `package-qa.ps1`     | Gom bundle → `dist-qa/VoltPOS-Tests.zip`. Lọc `.git/reports/logs`, kèm driver + `.env.dev`. |
| `README-QA.txt`      | Hướng dẫn 3 bước cho QA + cảnh báo charge thật.                                             |
| `GHI-CHU-QA-PACK.md` | File này.                                                                                   |

### Menu của `run.ps1`

```
1  Smoke          read-only, nhanh
2  Regression     full functional (tạo đơn, charge thẻ)
3  Home           regression/home
4  Checkout       regression/checkout
5  Order History  regression/order-history
6  Settings       regression/settings
7  EVERYTHING     toàn bộ spec lane dev
8  Pick one spec  chọn 1 file .spec.ts
D  Re-match drivers / cài lại deps  (dùng khi run bị treo)
Q  Quit
```

---

## 5. Cách tạo bản QA (bạn chạy, 1 lần)

```powershell
# Tải node-v22.18.0-win-x64.zip từ https://nodejs.org/dist/v22.18.0/ rồi:
powershell -ExecutionPolicy Bypass -File qa-pack\package-qa.ps1 `
    -NodeZip C:\downloads\node-v22.18.0-win-x64.zip -VendorDeps

# (tuỳ chọn) bọc .exe:
Install-Module ps2exe -Scope CurrentUser
ps2exe dist-qa\VoltPOS-Tests\run.ps1 dist-qa\VoltPOS-Tests\Run-Volt-Tests.exe -title 'Volt POS Tests'
```

Kết quả: `dist-qa/VoltPOS-Tests.zip` → gửi QA → giải nén → double-click.

**Cờ `package-qa.ps1`:**

- `-NodeZip <path>` — nhúng Node portable (QA khỏi cài Node).
- `-VendorDeps` — nhúng luôn `node_modules` (lần đầu khỏi cần npm registry).
- `-NoZip` — chỉ dựng folder, không nén (để test lắp ráp).

---

## 6. QA VẪN phải có trên máy (bundle không thay được)

1. **App Volt POS dev** đã cài — `tauri-driver` launch chính binary đó.
2. **WebView2 Runtime** — thiếu thì app không render.
3. **Internet** — app sync backend dev + lần đầu tải `msedgedriver` khớp máy.

---

## 7. Cấu hình đã chốt cho bản này

- **Charge thật luôn**: kèm nguyên `.env.dev` → `CARD_SETTLE=1`, có `STAFF_TOKEN`.
  ⚠️ Chỉ đưa cho QA tin cậy; mọi lane thẻ/gift-card sẽ **quẹt thẻ thật**.
- **Menu chọn suite/spec** (không ép chạy toàn bộ).
- `ENV=dev` cố định trong launcher.

---

## 8. Bẫy hay gặp khi QA chạy

- **Run "đứng im / không làm gì"** → gần như luôn là `msedgedriver` lệch WebView2 (Windows
  tự update). Fix: menu **[D]**, hoặc đóng mở lại launcher. Nhớ: lệch driver **không báo
  lỗi**, chỉ treo rồi timeout.
- **Thiếu `.env.dev` trong bundle** → chạy bằng default (merchant 14, không token). Kiểm
  `configs/env/.env.dev` tồn tại trước khi đóng gói.
- **PowerShell chặn script** → chạy `powershell -ExecutionPolicy Bypass -File .\run.ps1`.

---

## 9. Ghi chú kỹ thuật phụ

- Đã sửa 1 bug: `break` trong `switch` không thoát vòng `while` của menu → đổi sang
  `:menu while {...} break menu`.
- Cả `run.ps1` và `package-qa.ps1` đã parse sạch (PowerShell AST parser).
- Node pin theo `.nvmrc`: **22.18.0** (suite yêu cầu >= 22.5 cho `node:sqlite`).
