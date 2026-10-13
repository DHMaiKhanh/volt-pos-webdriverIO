# Test Commands — Volt POS E2E (WebdriverIO)

Tổng hợp tất cả câu lệnh chạy test. Mỗi lane E2E (`test:dev/staging/prod/all/dashboard`) tự chạy `preflight` trước
(kiểm tra driver có sẵn + resolve app binary + không còn instance cũ đang chạy).

> **Điều kiện cần:** device **20258 phải đã đăng nhập**. Nếu bị sign-out → mọi spec chết ở root before-all
> `STAFF_TOKEN is empty`. Passcode nhân viên: **8888**.

---

## 0. Cài đặt lần đầu

```bash
npm run setup          # npm install + cài driver (setup:drivers)
```

Nếu sau này gặp lỗi driver (version mismatch / không khởi động được):

```bash
npm run setup:drivers  # cài lại driver, thêm --force nếu cần
```

---

## 1. Chạy tất cả

| Mục tiêu                                                                                       | Lệnh                     |
| ---------------------------------------------------------------------------------------------- | ------------------------ |
| **TẤT CẢ** — 18 unit + 227 E2E = 245 case                                                      | `npm run test:all`       |
| Toàn bộ E2E (227 spec, có preflight), ENV=dev                                                  | `npm test`               |
| Toàn bộ E2E rồi mở dashboard xem kết quả                                                       | `npm run test:dashboard` |
| Như trên nhưng **đợi chạy xong** mới mở viewer (có progress marker, tránh xem nhầm kết quả cũ) | `npm run test:fresh`     |

`test:all` dùng `&` (toán tử tuần tự của cmd) nên lane E2E vẫn chạy dù unit có fail.
Dashboard chỉ phản ánh 227 E2E — unit test không feed vào.

> Dùng `test:fresh` khi `test:dashboard` chỉ hiện kết quả cũ (stale history) do viewer mở trước khi lane chạy xong.

---

## 2. Theo môi trường (binary khác nhau)

`ENV` quyết định **build .exe nào** được drive — dev/staging/prod là 3 bản build riêng, không phải flag runtime.

| Môi trường                     | Lệnh                   |
| ------------------------------ | ---------------------- |
| Dev (mặc định)                 | `npm run test:dev`     |
| Staging                        | `npm run test:staging` |
| Prod (chỉ `@smoke`, read-only) | `npm run test:prod`    |

---

## 3. Theo suite / tag

| Phạm vi                                          | Lệnh                      |
| ------------------------------------------------ | ------------------------- |
| Smoke (read-only, suite duy nhất được đụng prod) | `npm run test:smoke`      |
| Regression                                       | `npm run test:regression` |
| Chỉ case gắn `@critical`                         | `npm run test:critical`   |
| Unit (~1s, không cần app/driver)                 | `npm run test:unit`       |

---

## 4. Chạy spec cụ thể

```bash
# Một spec
npm run test:spec tests/regression/order-flow/card-payment.spec.ts

# Nhiều spec (lặp lại flag --spec hoặc truyền path phân tách)
npm run test:spec tests/regression/order-flow/split-order.spec.ts tests/regression/order-flow/adjust-tip.spec.ts
```

Lọc theo tên test (grep title):

```bash
cross-env ENV=dev wdio run configs/wdio/wdio.dev.conf.ts --mochaOpts.grep "TC-84"
```

---

## 5. Attach mode (drive app đang chạy sẵn qua CDP)

Dùng khi cần drive **bản cài production tại chỗ** thay vì để tauri-driver tự launch.

```bash
npm run app:launch    # bật app với WebView2 remote debugging (CDP 9222)
npm run test:attach   # kết nối vào app đang chạy
npm run app:kill      # tắt app
```

---

## 6. Dashboard xem kết quả

```bash
npm run dashboard:install   # chạy 1 lần đầu
npm run dashboard           # mở React viewer (poll history.json mỗi 5s)
npm run dashboard:build     # build bản tĩnh
```

`DashboardReporter` ghi `dashboard/public/data/history.json` ở `onComplete` sau mỗi lane.

---

## 7. Báo cáo Allure

```bash
npm run report:allure   # generate từ reports/allure-results
npm run report:open     # mở report đã generate
npm run report:serve    # generate + serve tạm
```

---

## 8. Chất lượng & bảo trì (không chạy test app)

| Việc                                                 | Lệnh                                      |
| ---------------------------------------------------- | ----------------------------------------- |
| Gate trước commit (typecheck + lint + format + unit) | `npm run verify`                          |
| Typecheck                                            | `npm run typecheck`                       |
| Lint / auto-fix                                      | `npm run lint` / `npm run lint:fix`       |
| Format / check                                       | `npm run format` / `npm run format:check` |
| Cài driver (chạy sau setup hoặc khi lỗi driver)      | `npm run setup:drivers`                   |
| Preflight thủ công                                   | `npm run preflight`                       |
| Reset / backup DB                                    | `npm run db:reset` / `npm run db:backup`  |
| Audit data-testid                                    | `npm run audit:testids`                   |
| Dọn reports/logs/.tmp                                | `npm run clean`                           |
