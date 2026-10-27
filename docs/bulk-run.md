# Chạy toàn bộ suite nhanh nhất có thể (`test:bulk`)

Mục tiêu: quét hết ~2208 test case trong ít giờ nhất mà **không đổi build, không
bỏ settle thật, không mất coverage thực**.

## Sự thật phải biết trước: 1 máy KHÔNG thể < 1h

`configs/wdio/wdio.shared.conf.ts` khoá cứng `maxInstances: 1`. Đây **không phải
tham số tinh chỉnh được**:

- `tauri-driver` chỉ proxy **một** session WebDriver.
- App ép single-instance qua `tauri-plugin-single-instance`.
- Màn staff + màn khách dùng chung **một** database SQLCipher trên máy này.

→ Worker thứ hai sẽ attach vào app của worker thứ nhất và làm hỏng cả hai run.
Nên 2208 case chạy **tuần tự**. Riêng việc boot app, navigate, sync API và settle
card thật đã khiến trung bình ~10–15s/case. Để < 1h cần < 1.6s/case — **bất khả
thi về vật lý trên một máy**.

| Cấu hình                                        | Thời gian ước tính (2208 case)            |
| ----------------------------------------------- | ----------------------------------------- |
| Lane cũ (retry 2, có Allure, không quarantine)  | ~9–10h (và thường chết giữa chừng)        |
| `test:bulk` (retry 0, không Allure, quarantine) | **ngắn hơn nhiều giờ** — mục tiêu thực tế |
| `test:bulk` + shard qua 4–6 máy                 | ~30–40 phút (**< 1h** — xem _Sharding_)   |

## Lane bulk cắt gì (và KHÔNG cắt gì)

`npm run test:bulk` dùng `configs/wdio/wdio.bulk.conf.ts`:

1. **Retry 0** (`SPEC_RETRIES=0`). Lane dev để `specFileRetries=1–2`, nên mỗi spec
   fail chạy lại 2–3 lần ngay giữa run — đốt timeout và kéo dài "đuôi" cuối run
   (đo thực tế: 19/67 phút của một run là deferred retries). Bulk để nó fail một
   lần, quét xong thật nhanh, rồi gom reds chạy lại bằng `test:failures`.
   **Đây là khoản tiết kiệm lớn nhất.**
2. **Không Allure.** Reporter Allure mặc định log **mỗi lệnh WebDriver** thành một
   step và chụp screenshot từng bước. Bỏ nó = bớt I/O thật trên mỗi lệnh, **không
   mất coverage**. `spec` + `DashboardReporter` vẫn chạy → GUI live + history vẫn đủ.
3. **`SHOW_STEPS=false`** — tắt overlay vẽ step trong app (một DOM write mỗi step).
4. **Quarantine + manual bị loại khỏi `specs`:**
   - File đỏ do **bug app đã xác nhận** → thêm vào `configs/wdio/quarantine.ts`
     (loại ở mức file, không tốn boot).
   - Test đỏ lẻ trong file còn xanh → gắn `Tag.BROKEN` (`@broken`) vào title; bulk
     tự `grep @broken --invert` để bỏ qua.
   - `_manual/*.spec.ts` (toàn `it.skip` nhưng vẫn boot worker) bị loại.

**Giữ nguyên:** đúng build dev, **settle card/cash/gift thật**, và mọi spec xanh.

## Quy trình dùng

```bash
# 1) Quét toàn bộ, fail một lần, nhanh nhất có thể
npm run test:bulk

# 2) Chạy lại CHỈ những spec vừa fail (đọc từ history của run gần nhất)
npm run test:failures

# 3) Xem danh sách đỏ mà không chạy lại — để quyết định quarantine
npm run test:failures -- --dry
```

Khi `--dry` chỉ ra một file đỏ **do bug app** (đã có ticket VP), thêm nó vào
`configs/wdio/quarantine.ts` để lần bulk sau không tốn thời gian chứng minh lại bug
đã biết. **Xoá entry ngay khi app fix** — quarantine cũ âm thầm ngừng test một tính
năng đã chạy lại được.

## Sharding — con đường THỰC SỰ để < 1h

Vì một máy = một app = tuần tự, cách duy nhất xuống dưới 1h là chạy **nhiều phần
song song trên nhiều máy/thiết bị**, mỗi máy một app + một merchant/DB riêng:

- Chia 208 spec file thành N nhóm (ví dụ theo thư mục `tests/regression/*`).
- Mỗi máy chạy `wdio run wdio.bulk.conf.ts --spec <nhóm của nó>`.
- Mỗi máy trỏ `MERCHANT_ID` / DB khác nhau để không đụng single-instance.
- Thời gian ≈ nhóm chậm nhất. Full bulk ~2.5h / 1 máy → 4–6 máy ≈ 30–40 phút.

Hạ tầng cần: nhiều máy (hoặc VM) + nhiều account merchant test. Khi có, đây là
bước kế tiếp để đạt mốc < 1h.
