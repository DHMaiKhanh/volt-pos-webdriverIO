# Quét tính năng (Feature scanning) — bản thay thế Playwright cho WebdriverIO

> **TL;DR.** App dưới test là **Tauri v2 + WebView2** (một `.exe`), không phải website,
> nên không chạy được Playwright MCP ở chế độ mặc định (nó tự mở Chromium mới).
> Nhưng WebView2 **là** Chromium và nói chuyện bằng **CDP (Chrome DevTools Protocol)**.
> Khi `npm run app:launch` mở app, nó phơi CDP ở `127.0.0.1:9222` — đó là điểm móc để
> "quét field / quét màn hình" y hệt Playwright làm với web.
>
> Công cụ chính của repo là **`cdp.mjs`** (attach raw CDP, không phụ thuộc gì). Nếu muốn
> đúng trải nghiệm MCP Playwright (agent tự lái bằng `browser_snapshot` / `browser_click`),
> chỉ cần trỏ Playwright MCP vào cùng cổng 9222 bằng `--cdp-endpoint`.

Tài liệu này giải thích **tại sao** và **bằng cách nào** chúng ta quét tính năng của app
trong dự án WebdriverIO, thay cho cách làm cũ bằng Playwright.

---

## Dùng bằng chat (không cần code)

1. `npm run app:launch` (mở app + CDP 9222). Lần đầu: khởi động lại phiên Claude Code để nạp MCP `volt-app` từ `.mcp.json`.
2. Nhắn: `/scan-feature checkout giảm giá` — hoặc nói tự nhiên "quét tính năng order history, tìm bug".
3. Claude tự lái app (snapshot → click/gõ → so kỳ vọng), nghe lỗi JS/API (`cdp.mjs watch` hoặc `browser_console_messages`), rồi ghi:
   - `reports/scans/<ngày>-<feature>/bugs.md` + screenshot (bug đã tái hiện 2 lần, mức độ, bước, kỳ vọng vs thực tế)
   - `docs/screens/<screen>/<screen>-test-cases.md` (TC mới, append)
4. Muốn thành code: `/cases-to-specs docs/screens/<screen>/<screen>-test-cases.md`.

Tuỳ chọn trong câu lệnh: "chỉ đọc", "quét sâu", "có thanh toán thật" (mặc định KHÔNG charge thẻ/refund/settle).

---

## 1. Bối cảnh: tại sao không dùng thẳng Playwright MCP

|                                        | Playwright (web thuần)                        | Dự án này (Volt POS)                                              |
| -------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Thứ bị lái                             | Website trong Chromium Playwright tự mở       | App desktop `.exe` dựng bằng Tauri v2, UI chạy trong **WebView2** |
| Cách Playwright MCP mặc định hoạt động | Tự khởi chạy một Chromium sạch rồi điều khiển | **Không áp dụng** — nó không biết khởi chạy binary Tauri của bạn  |
| Điểm móc để quét                       | DevTools / accessibility tree của trang       | **CDP endpoint của WebView2** (`127.0.0.1:9222`)                  |

Điểm mấu chốt: WebView2 là Chromium bên dưới. Khi app được mở với cờ
`--remote-debugging-port` (đã lo sẵn trong [scripts/launch-app.ts](scripts/launch-app.ts),
cùng cơ chế với [configs/wdio/wdio.attach.conf.ts](configs/wdio/wdio.attach.conf.ts)), nó
phơi một endpoint CDP. Mọi công cụ nói được CDP đều attach vào **app thật đang chạy** để
đọc DOM, liệt kê field, chụp màn hình, click — đúng những gì `browser_snapshot` của
Playwright cung cấp.

> **Không tìm "WebdriverIO MCP".** WDIO mạnh ở vai trò **test runner**, không phải công cụ
> explore/snapshot. Kiến trúc đúng là: giữ WDIO để chạy suite, dùng **CDP-attach** để quét
> và khám phá. Đó chính là những gì mô tả dưới đây.

---

## 2. Ba lớp quét

```
                    ┌─────────────────────────────────────────────┐
                    │  Volt POS .exe  (Tauri v2 / WebView2)         │
                    │  npm run app:launch  →  CDP @ 127.0.0.1:9222  │
                    └───────────────┬─────────────────────────────┘
                                    │ CDP (WebSocket)
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                          │
   ┌──────▼───────┐        ┌────────▼─────────┐       ┌────────▼──────────┐
   │ 1. cdp.mjs   │        │ 2. Playwright MCP│       │ 3. audit:testids  │
   │ (raw CDP)    │        │  --cdp-endpoint  │       │ (quét SOURCE tĩnh)│
   │ CÔNG CỤ CHÍNH│        │ (agent tự lái)   │       │ không cần app chạy│
   └──────────────┘        └──────────────────┘       └───────────────────┘
      live, nhanh,            giống hệt MCP               đối chiếu testid
      zero-dependency          Playwright bạn quen          suite ⇄ app
```

| Lớp                            | Khi nào dùng                                                            | Cần app chạy?      | Phụ thuộc             |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------ | --------------------- |
| **1. `cdp.mjs`**               | Quét nhanh màn hình đang chạy, zero-dep, bền với mọi version WebView2   | Có (`app:launch`)  | Không (chỉ Node ≥ 22) |
| **2. Playwright MCP qua CDP**  | Muốn agent tự lái với `browser_snapshot`/`browser_click`/`browser_type` | Có (`app:launch`)  | `@playwright/mcp`     |
| **3. `npm run audit:testids`** | Biết app ship `data-testid` nào, đối chiếu với locator suite mong đợi   | Không (đọc source) | `VOLT_POS_SRC`        |

---

## 3. Lớp 1 — `cdp.mjs`: công cụ quét chính (thay cho `browser_snapshot`)

Script: [.claude/skills/scan-feature/scripts/cdp.mjs](.claude/skills/scan-feature/scripts/cdp.mjs).
Nó attach raw CDP qua WebSocket — **không npm dependency**, và vì không bị ràng buộc version
giữa Playwright và Edge/WebView2 runtime nên **bền hơn** Playwright MCP cho WebView2.

### Chuẩn bị (một lần mỗi phiên)

```bash
npm run app:launch        # mở app thật, phơi CDP ở 127.0.0.1:9222
# ... quét bằng các lệnh bên dưới ...
npm run app:kill          # đóng app + driver khi xong
```

### Các lệnh

```bash
# chạy từ gốc repo
node .claude/skills/scan-feature/scripts/cdp.mjs <lệnh> [tham số]
```

| Lệnh                         | Việc nó làm                                            | Tương đương Playwright    |
| ---------------------------- | ------------------------------------------------------ | ------------------------- |
| `targets`                    | Liệt kê mọi webview (url + id)                         | chọn tab/trang            |
| `scan [urlSubstr]`           | **Dump màn hình có cấu trúc (JSON)** — "biết field gì" | `browser_snapshot`        |
| `text [urlSubstr]`           | `innerText` thô của `<body>`                           | đọc nội dung trang        |
| `shot <outPath> [urlSubstr]` | Lưu PNG screenshot                                     | `browser_take_screenshot` |
| `eval <jsFile> [urlSubstr]`  | Chạy một file JS trong trang, in JSON kết quả          | `browser_evaluate`        |
| `click "<text>" [urlSubstr]` | Click theo text/role hiển thị, in URL mới              | `browser_click`           |
| `nav-home [urlSubstr]`       | Về màn hình `/home`                                    | điều hướng                |

> `urlSubstr` chọn **webview nào**: bỏ trống = cửa sổ POS chính (không phải `/customer/`);
> truyền `"customer"` để lái màn hình khách hàng (customer display).

### `scan` trả về gì — đây chính là "biết field gì"

```jsonc
{
  "url": "http://tauri.localhost/home",
  "title": "...",
  "headings": ["..."], // h1..h4 + role=heading hiển thị
  "interactive": [
    // button / a / role=button,tab,menuitem,combobox
    { "role": "button", "text": "Charge", "disabled": false, "testid": "checkout-charge" },
  ],
  "inputs": [
    // ← CÁC FIELD NHẬP LIỆU chính là đây
    { "type": "text", "placeholder": "Customer name", "value": "", "testid": "customer-name" },
  ],
  "links": [{ "href": "/order-history", "text": "History" }],
  "dialogs": ["..."], // role=dialog / alertdialog đang mở
  "counts": { "interactive": 12, "testids": 34, "inputs": 3 },
  "testids": [{ "id": "...", "tag": "button", "text": "...", "vis": true }],
}
```

- **`inputs`** = câu trả lời trực tiếp cho "màn hình này có field gì" (type, placeholder, value, testid).
- **`interactive`** = nút/tab/menu bấm được, kèm `disabled` và `testid`.
- **`testids`** = toàn bộ `data-testid` đang render — chính là locator để viết spec WDIO.

### Ví dụ một phiên quét

```bash
npm run app:launch
node .claude/skills/scan-feature/scripts/cdp.mjs targets          # xem có những webview nào
node .claude/skills/scan-feature/scripts/cdp.mjs scan             # quét cửa sổ POS chính
node .claude/skills/scan-feature/scripts/cdp.mjs click "Checkout" # điều hướng vào màn hình cần quét
node .claude/skills/scan-feature/scripts/cdp.mjs scan             # quét field của màn hình mới
node .claude/skills/scan-feature/scripts/cdp.mjs shot .tmp/checkout.png
npm run app:kill
```

---

## 4. Lớp 2 — Playwright MCP qua `--cdp-endpoint` (giống hệt MCP Playwright bạn quen)

Nếu muốn **agent tự lái** bằng đúng các tool `browser_*` của Playwright MCP (snapshot,
click, type, fill_form…), không cần Chromium mới — chỉ trỏ Playwright MCP vào cùng cổng
CDP mà attach lane đã phơi:

```bash
# B1: mở app với CDP (như trên)
npm run app:launch                 # → CDP ở 127.0.0.1:9222

# B2: chạy Playwright MCP ATTACH vào app đang chạy (KHÔNG mở Chromium mới)
npx @playwright/mcp@latest --cdp-endpoint http://127.0.0.1:9222
```

Cấu hình MCP (đặt ở `.mcp.json` tại gốc repo, hoặc `claude mcp add`):

```json
{
  "mcpServers": {
    "playwright-volt": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--cdp-endpoint", "http://127.0.0.1:9222"]
    }
  }
}
```

Sau đó agent dùng `browser_snapshot` để thấy field và `browser_click` / `browser_type` để
thao tác — y hệt với web, chỉ khác là nó đang lái cửa sổ Tauri của bạn.

> **Lựa chọn tương đương:** `chrome-devtools-mcp` (của Google) cũng attach vào instance đang
> chạy: `npx chrome-devtools-mcp@latest --browser-url http://127.0.0.1:9222`. Cũng hợp vì
> WebView2 là Chromium.
>
> **Lưu ý version:** `connectOverCDP` của Playwright nhắm vào Chromium; WebView2 chạy tốt
> trong thực tế nhưng đôi khi version Edge/WebView2 runtime vênh với kỳ vọng của Playwright.
> Khi gặp trục trặc đó, quay về **`cdp.mjs`** (raw CDP) là chắc nhất — nó không có ràng buộc
> version nào.

---

## 5. Lớp 3 — `npm run audit:testids`: quét tĩnh từ source

Không cần app chạy. Script [scripts/audit-testids.ts](scripts/audit-testids.ts) đọc source
React của app (`VOLT_POS_SRC`) và đối chiếu mọi `data-testid` **app thật render** với mọi
locator **suite mong đợi** (`src/constants/testids.ts`), rồi in ra khoảng cách.

```bash
# trỏ tới checkout của app (thư mục chứa src/ và src-tauri/)
# configs/env/.env.dev:  VOLT_POS_SRC=D:/2.POS/volt-pos/volt-pos
npm run audit:testids
npm run audit:testids -- --missing-only   # chỉ in những cái còn thiếu
npm run audit:testids -- --strict         # exit 1 nếu thiếu (dùng cho CI)
```

Đây là góc "biết field gì" từ phía **code** — bổ sung cho lớp quét live. Dùng nó để biết
testid nào nên bảo team app thêm vào (để bỏ bớt fallback selector).

---

## 6. Quy trình chuẩn: từ quét → ra tài liệu test case

Việc quét không phải mục tiêu cuối — nó nuôi các **file test-case** trong
[docs/screens/](docs/screens/) (xem [docs/screens/README.md](docs/screens/README.md)). Các
`TC-` id chính là backlog mà spec WDIO tham chiếu lại trong tiêu đề.

1. `npm run app:launch` để mở app thật.
2. Dùng `cdp.mjs scan` (hoặc Playwright MCP) đi qua từng bước của tính năng, ghi lại field /
   nút / giá trị quan sát được. Điều hướng **bằng click** (`cdp.mjs click "..."`), không nhảy
   URL trực tiếp.
3. Viết/ cập nhật `docs/screens/<screen>/<screen>-test-cases.md` theo đúng mẫu ở
   [.claude/skills/scan-feature/references/output-template.md](.claude/skills/scan-feature/references/output-template.md):
   frontmatter (ghi `scanned-by: raw-CDP-attach (WebView2 CDP 9222)` hoặc
   `playwright-mcp (cdp-endpoint 9222)`), sơ đồ luồng, feature inventory, bảng `TC-<SCREEN>-NN`,
   nhật ký live scan, khoảng trống, tham chiếu.
4. Khi port một spec WDIO, đặt `TC-` id vào tiêu đề để giữ liên kết (xem
   [docs/screens/README.md](docs/screens/README.md)).

> **Chế độ attach là throwaway-safe cho smoke/repro, không cho regression.** State của app là
> thứ người dùng để lại, không phải boot sạch — nên lane này để quét / tái hiện lỗi, còn
> regression suite vẫn chạy qua `tauri-driver` từ màn hình đã biết.

---

## 7. Bảng ánh xạ nhanh: Playwright ⇄ dự án này

| Bạn từng làm với Playwright        | Ở đây làm bằng                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `browser_snapshot` (biết field gì) | `cdp.mjs scan` **hoặc** Playwright MCP `--cdp-endpoint` → `browser_snapshot` |
| `browser_click`                    | `cdp.mjs click "<text>"`                                                     |
| `browser_type` / điền form         | `cdp.mjs eval <jsFile>` **hoặc** Playwright MCP `browser_type`               |
| `browser_take_screenshot`          | `cdp.mjs shot <out.png>`                                                     |
| Chọn tab/trang                     | `cdp.mjs targets` + tham số `urlSubstr`                                      |
| Biết selector nào tồn tại          | `npm run audit:testids` (tĩnh) + trường `testids` trong `scan` (live)        |
| Chạy test thật                     | **giữ nguyên WebdriverIO** (`npm test`, `test:attach`, …)                    |

---

## 8. Xử lý sự cố

| Triệu chứng                                   | Nguyên nhân thường gặp & cách xử lý                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CDP endpoint not reachable on :9222`         | App chưa chạy → `npm run app:launch`. Hoặc instance cũ còn sống nuốt lần mở mới (`tauri-plugin-single-instance`) → `npm run app:kill` rồi mở lại. |
| `No matching target`                          | Sai `urlSubstr`. Chạy `cdp.mjs targets` xem url thật rồi truyền lại.                                                                              |
| Port 9222 bị chiếm                            | Đổi `REMOTE_DEBUG_PORT` trong `configs/env/.env.<ENV>` (mặc định `9222`; `DRIVER_PORT` mặc định `4444`).                                          |
| Playwright MCP không attach được vào WebView2 | Vênh version Edge/WebView2 runtime ↔ Playwright. Quay về `cdp.mjs` (raw CDP, không ràng buộc version).                                            |
| `audit:testids` báo "cannot run"              | `VOLT_POS_SRC` chưa set/sai. Trỏ tới repo root của app (thư mục chứa `src/` và `src-tauri/`).                                                     |

---

## 9. Tham chiếu

- Công cụ quét: [.claude/skills/scan-feature/scripts/cdp.mjs](.claude/skills/scan-feature/scripts/cdp.mjs)
- Mẫu tài liệu đầu ra: [.claude/skills/scan-feature/references/output-template.md](.claude/skills/scan-feature/references/output-template.md)
- Attach lane (cùng cơ chế CDP): [configs/wdio/wdio.attach.conf.ts](configs/wdio/wdio.attach.conf.ts), [scripts/launch-app.ts](scripts/launch-app.ts)
- Quét testid tĩnh: [scripts/audit-testids.ts](scripts/audit-testids.ts)
- Tài liệu màn hình & backlog TC: [docs/screens/README.md](docs/screens/README.md)
- Cổng mặc định: `REMOTE_DEBUG_PORT=9222`, `DRIVER_PORT=4444` (xem `configs/env/.env.dev`)
</content>

</invoke>
