# Retest Reopen — Card / Cash / Gift Card / Other (22/10/2026)

Retest toàn bộ test case trong project Linear **Reopen order — update item & staff**:
[VP-2585](https://linear.app/fastboy/issue/VP-2585), [VP-4405](https://linear.app/fastboy/issue/VP-4405) và tất cả sub-task.
Không dùng code test: điều khiển trực tiếp app Volt POS đang cài trên máy (thao tác qua WebView2 remote debugging), kiểm tra bằng số liệu trên màn hình.

## Môi trường

| Mục              | Giá trị                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| App              | Volt POS **1.1.41** (DEV), bản cài tại `%LOCALAPPDATA%\Volt POS`                    |
| Merchant setting | Service Fee **3%** · Cash Discount **3%** · Product Tax **5%** · Service Tax **5%** |
| Card             | Terminal đã kết nối, giao dịch duyệt thật (Visa 0043)                               |
| Gift Card        | `****0511` (thanh toán), `****1736` (bán gift card)                                 |
| Khách test       | lam_doan_a (`***9443`), lam_doan_b (`***9442`)                                      |

## Ký hiệu

| Ký hiệu | Ý nghĩa                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| ✅      | PASS                                                                          |
| ❌      | FAIL                                                                          |
| ⚠️      | Một phần / chưa kết luận / chờ PO chốt                                        |
| ⛔      | Blocked — không chạy được vì bị bug khác chặn                                 |
| ⬜      | Chưa test lần này (lý do ghi ở cột Ghi chú)                                   |
| —       | Không áp dụng cho phương thức này (case không phụ thuộc tender hoặc không có) |

## Tổng kết

### Theo checklist 46 test case của VP-2585

| PASS   | FAIL  | Một phần | Blocked | Chưa test | Tổng   |
| ------ | ----- | -------- | ------- | --------- | ------ |
| **18** | **3** | **1**    | **4**   | **20**    | **46** |

### Theo từng task trên Linear

| Task                                                | Nội dung                                           | Trạng thái Linear | Kết quả retest                                              |
| --------------------------------------------------- | -------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| [VP-2585](https://linear.app/fastboy/issue/VP-2585) | Reopen — sửa item/giá/staff 1 lần (ticket cha)     | QC Completed      | ❌ 3 FAIL, xem mục 2                                        |
| [VP-4405](https://linear.app/fastboy/issue/VP-4405) | Side effects PR #2175 (1¢, split, P8D, Home)       | QC Testing        | ⚠️ PASS mục 2, 4, 5; mục 1 chưa tái hiện; mục 3 cần P8D     |
| [VP-4792](https://linear.app/fastboy/issue/VP-4792) | Điểm không cộng sau thanh toán                     | Ready to Review   | ✅                                                          |
| [VP-4077](https://linear.app/fastboy/issue/VP-4077) | Recompute theo toggle gift-card service fee đã lưu | QC Completed      | ⬜ Cần đổi toggle trên Portal                               |
| [VP-4085](https://linear.app/fastboy/issue/VP-4085) | Point & checkinAndCheckout theo mô hình mới        | QC Completed      | ❌ Lỗi lại một nhánh → VP-4980                              |
| [VP-3726](https://linear.app/fastboy/issue/VP-3726) | [BE] Request là nguồn sự thật khi gỡ khách         | Done              | ✅                                                          |
| [VP-3598](https://linear.app/fastboy/issue/VP-3598) | [BE] Đổi customer A → B chuyển điểm                | Done              | ✅ đơn có khách gốc · ❌ đơn gán khách lúc reopen (VP-4980) |
| [VP-4079](https://linear.app/fastboy/issue/VP-4079) | Thuế product khi add Product trả Card              | QC Completed      | ✅                                                          |
| [VP-4067](https://linear.app/fastboy/issue/VP-4067) | Split Cash + Other reopen phát sinh số lẻ          | QC Completed      | ✅                                                          |
| [VP-4012](https://linear.app/fastboy/issue/VP-4012) | Card tax sai base khi add item                     | QC Completed      | ✅                                                          |
| [VP-4013](https://linear.app/fastboy/issue/VP-4013) | Cash/Other dư $0.17 khi add service                | QC Completed      | ✅                                                          |
| [VP-3914](https://linear.app/fastboy/issue/VP-3914) | Nút Re-Open không báo "còn lượt"                   | QC Completed      | ✅                                                          |
| [VP-3913](https://linear.app/fastboy/issue/VP-3913) | Re-open không giới hạn sau khi hết lượt            | QC Completed      | ✅                                                          |
| [VP-3982](https://linear.app/fastboy/issue/VP-3982) | Xóa customer rồi thêm customer mới không được      | QC Completed      | ✅                                                          |
| [VP-3931](https://linear.app/fastboy/issue/VP-3931) | Add service trả Cash bỏ qua tax                    | QC Completed      | ✅                                                          |
| [VP-3957](https://linear.app/fastboy/issue/VP-3957) | Add service trả Card sai Total khi có SF + Tax     | QC Completed      | ✅                                                          |
| [VP-3969](https://linear.app/fastboy/issue/VP-3969) | Reopen làm tăng visit                              | Done              | ❌ Lỗi lại → VP-4979                                        |
| [VP-4015](https://linear.app/fastboy/issue/VP-4015) | Chỉ cho tăng tip                                   | Canceled          | — Không test (ticket đã hủy)                                |
| [VP-4016](https://linear.app/fastboy/issue/VP-4016) | Sửa không giới hạn khi total bằng total ban đầu    | Canceled          | — Đúng rule đã chốt: sửa bằng tiền không tốn lượt (TC27)    |
| [VP-3563](https://linear.app/fastboy/issue/VP-3563) | Lưu app version vào userInput                      | Duplicate         | — Không kiểm được trên UI                                   |
| [VP-4364](https://linear.app/fastboy/issue/VP-4364) | Ticket CRM tổng hợp                                | In Progress       | — Không có case test riêng                                  |

### Bug đã log

1. [VP-4978](https://linear.app/fastboy/issue/VP-4978) — **Giảm tiền khi reopen bị chặn, không còn đi luồng Void-All** (cả 4 phương thức). Đã PASS ở bản 1.1.22 → lỗi lại hoặc đổi hành vi.
2. [VP-4979](https://linear.app/fastboy/issue/VP-4979) — **Reopen không sửa gì, bấm Done → visit của customer +1** (VP-3969 lỗi lại).
3. [VP-4980](https://linear.app/fastboy/issue/VP-4980) — **Điểm loyalty sai khi customer được gán trong lúc reopen**: đổi sang khách khác thì khách cũ không bị trừ điểm; gỡ rồi chọn lại cùng khách thì bị cộng điểm + visit lần nữa.

---

## 1. Đơn dùng để test

| Mã đơn            | Thanh toán                             | Dùng cho                                                       |
| ----------------- | -------------------------------------- | -------------------------------------------------------------- |
| OD261022-16855793 | Card $67.05 + Card $76.79              | Luồng chính — Card                                             |
| OD261022-16994595 | Cash $65.10 + Cash $74.55              | Luồng chính — Cash                                             |
| OD261022-17091602 | GC $65.10 + GC $74.55                  | Luồng chính — Gift Card                                        |
| OD261022-17290322 | Other $65.10 + Other $74.55            | Luồng chính — Other                                            |
| OD261022-16345374 | Cash $65.10 + Cash $36.75              | Luồng chính — Cash (lần chạy đầu, chỉ thêm service)            |
| OD261022-16664372 | GC $65.10 + Card $38.93                | Thu thêm bằng method khác; thêm product                        |
| OD261022-17390786 | Card $104.91                           | Giảm tiền (Card), sửa bằng tiền, đổi staff, customer (VP-4980) |
| OD261022-17784010 | Cash $101.85 + Cash $26.25             | Giảm tiền (Cash), Quick Pay                                    |
| OD261022-17847993 | GC $101.85                             | Giảm tiền (Gift Card)                                          |
| OD261022-17919268 | Other $101.85                          | Giảm tiền (Other)                                              |
| OD261022-18097560 | Split: Cash $50.92 + Other $50.93      | Split, reopen đơn split                                        |
| OD261022-18583896 | Cash $36.75                            | Visit (VP-4979), đổi khách A → B, gỡ khách                     |
| OD261022-18367079 | Cash $153.17                           | Điểm sau thanh toán (VP-4792), làm tròn                        |
| OD261022-18996938 | Cash $25.00 (bán gift card `****1736`) | Item gift card khi reopen                                      |

---

## 2. VP-2585 — checklist 46 test case

### 2.1 Điều kiện & phạm vi áp dụng

| #    | Test case                                                            | Card | Cash | Gift Card | Other | Ghi chú                                                                                                                                |
| ---- | -------------------------------------------------------------------- | ---- | ---- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TC01 | Đơn successful + chưa settle → reopen sửa được tiền (giá/item/staff) | ✅   | ✅   | ✅        | ✅    | Reopen xong vào được Edit Order, thêm service + product, thêm staff                                                                    |
| TC02 | Đơn đã settled → không cho reopen                                    | ⬜   | ⬜   | ⬜        | ⬜    | Chưa mở đơn Settled để kiểm                                                                                                            |
| TC03 | Đơn split → chặn sửa tiền, chỉ cho non-money                         | —    | ✅   | —         | ✅    | OD261022-18097560 (Cash + Other): lần reopen đầu đã báo "Items and prices are locked", thêm item không được                            |
| TC04 | Đơn có promotion/reward/campaign/custom-discount → chặn sửa tiền     | ⬜   | ⬜   | ⬜        | ⬜    | Chưa có đơn khuyến mãi                                                                                                                 |
| TC05 | Đơn có cashback → chặn sửa tiền                                      | ⬜   | ⬜   | ⬜        | ⬜    | Chưa có đơn cashback                                                                                                                   |
| TC06 | Hết lượt → chỉ sửa non-money, nút Re-Open báo hết lượt               | ✅   | ✅   | ✅        | ✅    | Message: _"Items and prices are locked. Staff, customer and notes can still change."_; thêm staff/item không được, Subtotal giữ nguyên |
| TC07 | Còn lượt → nút Re-Open báo còn lượt                                  | ✅   | ✅   | ✅        | ✅    | Message: _"One edit of items, prices left; locks once paid."_ (VP-3914)                                                                |

### 2.2 Sửa item / giá / discount

| #    | Test case                                                  | Card | Cash | Gift Card | Other | Ghi chú                                                                                                                                |
| ---- | ---------------------------------------------------------- | ---- | ---- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TC08 | Sửa giá service/product → tính đúng chênh lệch             | ⬜   | ⬜   | ⬜        | ⬜    | Chưa sửa giá trực tiếp trên item                                                                                                       |
| TC09 | Sửa item-discount trên item                                | ⬜   | ⬜   | ⬜        | ⬜    | Chưa test                                                                                                                              |
| TC10 | Add item mới → stamp taxPercent theo rate đã lưu của order | ✅   | ✅   | ✅        | ✅    | Service + product mới đều tính tax 5% đúng. Merchant không đổi setting giữa chừng nên chưa phân biệt được rate đã lưu và rate hiện tại |
| TC11 | Xóa item                                                   | ❌   | ❌   | ❌        | ❌    | Xóa trên Home được, nhưng bấm Pay bị chặn "Cannot continue yet" → không hoàn tất được (VP-4978)                                        |
| TC12 | Item gift card: edit read-only, delete disable             | —    | ✅   | —         | —     | OD261022-18996938: nút xóa disable (opacity-30), dialog chỉ xem, không có nút lưu. Không phụ thuộc tender                              |

### 2.3 Staff

| #    | Test case                                                    | Card | Cash | Gift Card | Other | Ghi chú                                                                             |
| ---- | ------------------------------------------------------------ | ---- | ---- | --------- | ----- | ----------------------------------------------------------------------------------- |
| TC13 | Thêm staff mới vào order                                     | ✅   | ✅   | ✅        | ✅    | Thêm Kani + service $35 khi reopen                                                  |
| TC14 | Xóa staff khỏi order                                         | ⬜   | ⬜   | ⬜        | ⬜    | Chỉ xóa item, chưa xóa cả staff                                                     |
| TC15 | Sửa/gán lại item cho từng staff                              | ✅   | ⬜   | ⬜        | ⬜    | OD261022-17390786: item $35 chuyển từ Pamela sang Kani, Order History cập nhật đúng |
| TC16 | Thêm/xóa staff → tip chia đều lại, `tipAmount == Σ share`    | ⬜   | ⬜   | ⬜        | ⬜    | Mọi giao dịch đều chọn No Tip                                                       |
| TC17 | Tăng tiền + đổi staff → tip đã trả của staff cũ không bị sai | ⬜   | ⬜   | ⬜        | ⬜    | Như TC16                                                                            |

### 2.4 Xử lý tiền — Tăng tiền

| #    | Test case                                                           | Card | Cash | Gift Card | Other | Ghi chú                                                                                                            |
| ---- | ------------------------------------------------------------------- | ---- | ---- | --------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| TC18 | Charge đúng phần chênh `newTotal − paidTotal`, tạo transaction mới  | ✅   | ✅   | ✅        | ✅    | Card $76.79; Cash/GC/Other $74.55. Order History có 2 transaction, tổng khớp Total                                 |
| TC19 | Cho nhập tip lúc charge thêm, `totalTip = paidTip + tip`            | ⚠️   | ⚠️   | ⚠️        | ⚠️    | Màn nhập tip hiện ra ở lần charge thêm cho cả 4 phương thức, nhưng chưa nhập tip thật để kiểm tổng                 |
| TC20 | Recompute đúng SF%/CD%/tax% theo rate đã lưu của order              | ✅   | ✅   | ✅        | ✅    | Số tiền khớp công thức SF 3% / CD 3% / Tax 5%. Như TC10: setting không đổi nên chưa phân biệt rate đã lưu/hiện tại |
| TC21 | Tăng tiền nhưng thuế giảm → Void-All, không tạo transaction thuế âm | ⬜   | ⬜   | ⬜        | ⬜    | Merchant này product tax = service tax = 5% nên không dựng được case thuế giảm                                     |
| TC22 | Thanh toán thêm bằng mọi method                                     | ✅   | ✅   | ✅        | ✅    | Mỗi method trả thêm bằng chính nó; thêm 1 case đổi method: đơn GC trả thêm bằng Card (OD261022-16664372)           |

### 2.5 Xử lý tiền — Giảm tiền (Void-All)

| #    | Test case                                                         | Card | Cash | Gift Card | Other | Ghi chú                                                                                                                    |
| ---- | ----------------------------------------------------------------- | ---- | ---- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| TC23 | Giảm tiền → void toàn bộ transaction cũ, tính lại, thanh toán lại | ❌   | ❌   | ❌        | ❌    | Dialog **"Cannot continue yet — Add a service priced $35.00 to balance this order."**, không vào được thanh toán (VP-4978) |
| TC24 | Void-All chỉ void transaction SUCCESS, bỏ qua FAIL/PROCESSING     | ⛔   | ⛔   | ⛔        | ⛔    | Bị TC23 chặn                                                                                                               |
| TC25 | Giảm tiền → tip về 0, nhập lại sạch                               | ⛔   | ⛔   | ⛔        | ⛔    | Bị TC23 chặn                                                                                                               |
| TC26 | Giảm tiền qua gift card → hoàn balance về thẻ                     | —    | —    | ⛔        | —     | Bị TC23 chặn                                                                                                               |

### 2.6 Bằng tiền (money-neutral)

| #    | Test case                                                        | Card | Cash | Gift Card | Other | Ghi chú                                                                                                                                                               |
| ---- | ---------------------------------------------------------------- | ---- | ---- | --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC27 | Sửa nhưng tổng không đổi → không tạo transaction, không trừ lượt | ✅   | ✅   | ⚠️        | ⚠️    | Xóa $35 rồi thêm lại $35 → cả 4 tender $0.00, Done không tạo transaction. Card và Cash reopen lại vẫn báo còn lượt. GC/Other: Done được, chưa reopen lại để kiểm lượt |
| TC28 | Thoát bằng Done → recompute đúng, không tốn lượt                 | ✅   | ✅   | ⚠️        | ⚠️    | Như TC27                                                                                                                                                              |
| TC29 | Thoát bằng Cancel Reopen → giữ nguyên, không tốn lượt            | ⬜   | ⬜   | ⬜        | ⬜    | Chưa test                                                                                                                                                             |

### 2.7 Customer CRUD & Loyalty

| #    | Test case                                      | Card | Cash | Gift Card | Other | Ghi chú                                                                                                                                                          |
| ---- | ---------------------------------------------- | ---- | ---- | --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC30 | Đổi customer A → B → trừ điểm A, cộng cho B    | ❌   | ✅   | ⬜        | ⬜    | Cash OD261022-18583896 (có khách từ lúc thanh toán): b 244 → 208, a 257 → 293 ✅. Card OD261022-17390786 (khách gán lúc reopen): khách cũ không bị trừ (VP-4980) |
| TC31 | Gán customer mới cho đơn chưa có customer      | ✅   | ⬜   | ⬜        | ⬜    | OD261022-17390786: gán lam_doan_a → +104 điểm, visit 1                                                                                                           |
| TC32 | Gỡ customer khỏi đơn                           | ⬜   | ✅   | ⬜        | ⬜    | OD261022-18583896: gỡ lam_doan_a → 293 → 257 (thu hồi đúng 36)                                                                                                   |
| TC33 | Tăng tiền có customer → cộng thêm phần điểm dư | ⬜   | ⬜   | ⬜        | ⬜    | Chưa test đơn có khách + tăng tiền                                                                                                                               |
| TC34 | Giảm tiền có customer → trừ điểm rồi tính lại  | ⛔   | ⛔   | ⛔        | ⛔    | Bị TC23 chặn                                                                                                                                                     |

### 2.8 Giới hạn số lần sửa

| #    | Test case                                               | Card | Cash | Gift Card | Other | Ghi chú                                                   |
| ---- | ------------------------------------------------------- | ---- | ---- | --------- | ----- | --------------------------------------------------------- |
| TC35 | Sửa tiền lần 1 + thanh toán thật → `reopenEditCount` +1 | ✅   | ✅   | ✅        | ✅    | Sau khi thu chênh lệch, reopen lần sau báo hết lượt       |
| TC36 | Complete bằng tiền → không +1                           | ✅   | ✅   | ⚠️        | ⚠️    | Như TC27                                                  |
| TC37 | Hết lượt → reopen sau chỉ sửa non-money                 | ✅   | ✅   | ✅        | ✅    | Thêm staff/item không được, Subtotal giữ nguyên (VP-3913) |

### 2.9 Offline

| #    | Test case                                          | Card | Cash | Gift Card | Other | Ghi chú                                                   |
| ---- | -------------------------------------------------- | ---- | ---- | --------- | ----- | --------------------------------------------------------- |
| TC38 | Offline giảm tiền → void, ghi `canceling`, tự push | ⬜   | ⬜   | ⬜        | ⬜    | Phải ngắt mạng máy test; giảm tiền đang bị chặn (VP-4978) |
| TC39 | Offline tăng tiền → chỉ cho Cash                   | ⬜   | ⬜   | ⬜        | ⬜    | Phải ngắt mạng máy test                                   |
| TC40 | Offline bằng tiền → không phát sinh thanh toán     | ⬜   | ⬜   | ⬜        | ⬜    | Phải ngắt mạng máy test                                   |

### 2.10 Thoát giữa chừng / Edge case

| #    | Test case                                                    | Card | Cash | Gift Card | Other | Ghi chú                                         |
| ---- | ------------------------------------------------------------ | ---- | ---- | --------- | ----- | ----------------------------------------------- |
| TC41 | Thoát reopen giữa chừng → giữ status `reopen`, không crash   | ⬜   | ⬜   | ⬜        | ⬜    | Chưa test                                       |
| TC42 | Complete lại sau khi thoát giữa chừng → chuẩn hóa trạng thái | ⬜   | ⬜   | ⬜        | ⬜    | Chưa test                                       |
| TC43 | Đơn cũ chưa stamp `taxPercent` → fallback rate merchant      | ⬜   | ⬜   | ⬜        | ⬜    | Cần đơn từ app version cũ                       |
| TC44 | Đơn miễn thuế stamp `taxPercent = 0` → giữ miễn thuế         | ⬜   | ⬜   | ⬜        | ⬜    | Merchant đang có thuế 5%, chưa có đơn miễn thuế |

### 2.11 Report / Income

| #    | Test case                                                        | Card | Cash | Gift Card | Other | Ghi chú                    |
| ---- | ---------------------------------------------------------------- | ---- | ---- | --------- | ----- | -------------------------- |
| TC45 | Income/report không double-count sau charge thêm / void + resale | ⬜   | ⬜   | ⬜        | ⬜    | Chưa đối chiếu report      |
| TC46 | Kỳ income-staff đã lock → không reopen được                      | ⬜   | ⬜   | ⬜        | ⬜    | Chưa có kỳ đã lock để test |

### 2.12 Số liệu chi tiết luồng chính (TC01, TC10, TC13, TC18, TC20, TC22, TC35)

Kịch bản: đơn 1 service $62 (Pamela) → thanh toán → Re-Open → không sửa → Edit Order thêm service $35 (Kani) + product $36 → thu chênh lệch bằng chính phương thức đó → Order History → Re-Open lần 2.

|                                | Card                                              | Cash                                              | Gift Card                   | Other                       |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------- | --------------------------- | --------------------------- |
| Đơn                            | OD261022-16855793                                 | OD261022-16994595                                 | OD261022-17091602           | OD261022-17290322           |
| Thanh toán lần đầu             | $67.05                                            | $65.10                                            | $65.10                      | $65.10                      |
| Reopen không sửa               | 4 tender $0.00                                    | 4 tender $0.00                                    | 4 tender $0.00              | 4 tender $0.00              |
| Home sau khi thêm item         | $63.86 + $36.05 + $37.08 = **$136.99** = Subtotal | $62.99 + $35.56 + $36.58 = **$135.13** = Subtotal | như Cash                    | như Cash                    |
| Số tiền thu thêm (Card / khác) | $76.79 / $74.55                                   | $76.79 / $74.55                                   | $76.79 / $74.55             | $76.79 / $74.55             |
| Transaction                    | Card $67.05 + Card $76.79                         | Cash $65.10 + Cash $74.55                         | GC $65.10 + GC $74.55       | Other $65.10 + Other $74.55 |
| Order History                  | Subtotal $136.99 · Tax $6.85 · **Total $143.84**  | Subtotal $133.00 · Tax $6.65 · **Total $139.65**  | $139.65                     | $139.65                     |
| Số dư gift card                | —                                                 | —                                                 | $745.26 → $680.16 → $605.61 | —                           |
| Reopen lần 2                   | Hết lượt, khóa                                    | Hết lượt, khóa                                    | Hết lượt, khóa              | Hết lượt, khóa              |

---

## 3. VP-4405 — Acceptance Criteria và các mục

| #   | Test case                                                       | Card | Cash | Gift Card | Other | Kết quả | Ghi chú                                                                                                                                                                               |
| --- | --------------------------------------------------------------- | ---- | ---- | --------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1  | Không lệch 1¢ thuế/tổng tiền trên đơn mới; có golden fixture    | ✅   | ✅   | ✅        | ✅    | ⚠️      | 5 mức giá ($19.00 / $23.45 / $37.77 / $19.99 / $45.67) khớp tới từng cent. Chưa tái hiện được: lỗi chỉ xảy ra khi SF ≠ CD, merchant đang SF = CD = 3%. Golden fixture là việc của dev |
| §1  | Release lockstep Windows + P8D                                  | —    | —    | —         | —     | —       | Quy trình release, không test trên app                                                                                                                                                |
| §2  | Màn split sau khi trả check bằng Cash: Total = tổng thực thu    | —    | ✅   | —         | ✅    | ✅      | OD261022-18097560: Total **$103.38** = $50.92 + $52.46. Chưa kiểm Print Check                                                                                                         |
| §3  | Đơn trả trên P8D, Windows reopen gỡ khách → trừ điểm; đổi A → B | ⬜   | ⬜   | ⬜        | ⬜    | ⬜      | Cần thiết bị P8D. Cùng thao tác với đơn trả trên Windows: xem TC30, TC32                                                                                                              |
| §3  | Complete trên P8D giữ key bảo vệ trong `userInput`              | ⬜   | ⬜   | ⬜        | ⬜    | ⬜      | Cần P8D và đọc DB                                                                                                                                                                     |
| §4  | Reopen đơn cash có SF, thêm service: tổng dòng Home = Subtotal  | ✅   | ✅   | ✅        | ✅    | ✅      | Xem bảng 2.12                                                                                                                                                                         |
| §4  | Reopen đơn có SF, sửa giá item: tổng dòng Home = Subtotal       | ⬜   | ⬜   | ⬜        | ⬜    | ⬜      | Chưa sửa giá item (TC08)                                                                                                                                                              |
| §5  | Reopen + Quick Pay: tổng dòng Home = Subtotal                   | —    | ✅   | —         | —     | ✅      | OD261022-17784010: $62.38 + $35.22 + $25.15 = $122.75 = Subtotal. Thu thêm Card $27.04 / Cash $26.25                                                                                  |
| §5  | PO chốt Quick Pay trên Home hiện số nhập ($25.00) hay giá thẻ   | —    | ⚠️   | —         | —     | ⚠️      | Home hiện **$25.15**, Order History lưu **$25.00**. Chờ PO                                                                                                                            |

---

## 4. VP-4077 — Toggle gift-card service fee đã lưu theo order

| #   | Toggle lúc tạo đơn | Toggle hiện tại | Thao tác reopen                        | Kết quả | Ghi chú                                                            |
| --- | ------------------ | --------------- | -------------------------------------- | ------- | ------------------------------------------------------------------ |
| 1   | ON                 | ON              | Sửa item                               | ⬜      | Cần đổi toggle `merchant_gift_card_top_up_service_fee` trên Portal |
| 2   | ON                 | OFF             | Không sửa, Done → total giữ nguyên     | ⬜      | như trên                                                           |
| 3   | ON                 | OFF             | Sửa service → SF/CD vẫn tính trên GC   | ⬜      | như trên                                                           |
| 4   | OFF                | ON              | Sửa service → SF/CD không tính trên GC | ⬜      | như trên                                                           |
| 5   | OFF                | OFF             | Thêm staff → SF/CD giữ nguyên          | ⬜      | như trên                                                           |
| 6   | OFF                | ON              | Giảm tiền → void-all → thanh toán lại  | ⛔      | Thêm vào đó giảm tiền đang bị chặn (VP-4978)                       |
| 7   | ON                 | OFF             | Đơn split có gift card                 | ⬜      | như trên                                                           |

---

## 5. VP-4085 — Point & checkinAndCheckout

| #   | Acceptance Criteria                                               | Kết quả | Ghi chú                                                                              |
| --- | ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 1   | Đổi customer A → B: trừ đúng A, cộng đúng B                       | ❌      | Đúng với đơn có khách từ lúc thanh toán; sai khi khách được gán lúc reopen (VP-4980) |
| 2   | Gỡ customer: earn cũ được thu hồi                                 | ✅      | lam_doan_a 293 → 257                                                                 |
| 3   | Đơn không có customer: không ghi `point_bonus`, không gọi checkin | ⬜      | Không quan sát được trên UI, cần đọc DB/log                                          |
| 4   | Reopen tăng/giảm tiền: điểm đúng theo rule                        | ⬜ / ⛔ | Tăng tiền có khách chưa test (TC33); giảm tiền bị chặn (VP-4978)                     |
| 5   | gql gộp đủ tham số, codegen sạch                                  | —       | Review code, không test trên app                                                     |
| 6   | Không còn code chết luồng ghi điểm cũ                             | —       | Review code                                                                          |
| 7   | Có test phủ các case                                              | —       | Unit test phía dev                                                                   |

---

## 6. Các bug cũ — retest từng ticket

| Ticket  | Kịch bản gốc                                                | Retest                                                                                 | Kết quả    |
| ------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| VP-4792 | Màn thanh toán báo cộng điểm nhưng customer không được cộng | OD261022-18367079: màn khách "earned 153, current 257"; mở lại customer thấy Point 257 | ✅         |
| VP-4079 | Add Product trả Card không có thuế product                  | Thêm product $36: Card $38.93 (= 36 × 1.03 + 5%), Cash/GC/Other $37.80                 | ✅         |
| VP-4067 | Split Cash + Other, reopen phát sinh số lẻ                  | OD261022-18097560: reopen cả 4 tender $0.00                                            | ✅         |
| VP-4012 | Đơn trả Cash, reopen add item, Card tax sai base            | Đơn Cash reopen thêm item: Card $76.79 khớp Cash $74.55 theo cùng công thức            | ✅         |
| VP-4013 | Cash/Other dư $0.17 khi add service                         | Cash/Other ra số chẵn đúng ($74.55, $36.75), không dư cent                             | ✅         |
| VP-3914 | Nút Re-Open không báo còn lượt                              | Báo "One edit of items, prices left" — cả 4 phương thức                                | ✅         |
| VP-3913 | Re-open không giới hạn sau khi hết lượt                     | Lần 2 báo "Items and prices are locked", thêm item không được — cả 4 phương thức       | ✅         |
| VP-3982 | Xóa customer rồi thêm customer mới không được               | Gỡ lam_doan_b → thêm lam_doan_a thành công                                             | ✅         |
| VP-3931 | Add service trả Cash bỏ qua tax                             | Add $35 trả Cash: $36.75 (= 35 × 1.05)                                                 | ✅         |
| VP-3957 | Add service trả Card sai Total                              | Add $35 trả Card: $37.85 (= 35 × 1.03 + 5%)                                            | ✅         |
| VP-3969 | Reopen làm tăng visit                                       | OD261022-18583896: reopen không sửa → Done → visit 3 → 4                               | ❌ VP-4979 |
| VP-3598 | Đổi customer A → B chuyển điểm                              | Đúng với đơn có khách gốc; sai với khách gán lúc reopen                                | ❌ VP-4980 |
| VP-3726 | Gỡ customer thu hồi điểm                                    | Thu hồi đúng 36 điểm                                                                   | ✅         |

---

## 7. Chi tiết 3 lỗi

### Lỗi #1 — Giảm tiền bị chặn ([VP-4978](https://linear.app/fastboy/issue/VP-4978))

- **Đơn:** Card OD261022-17390786 · Cash OD261022-17784010 · Gift Card OD261022-17847993 · Other OD261022-17919268 (đơn $62 + $35).
- **Các bước:** thanh toán → Re-Open → Edit Order → xóa service $35 → Remove → bấm Pay.
- **Thực tế:** Home cập nhật đúng (Subtotal $62.00, Total $65.10), nhưng bấm Pay thì dialog **"Cannot continue yet — Add a service priced $35.00 to balance this order."** chặn lại, không có Void-All.
- **Mong đợi (spec VP-2585 §3):** void toàn bộ transaction thành công cũ → tính lại → thanh toán lại bằng method bất kỳ. TC23 đã PASS ở bản 1.1.22.
- Cần dev/PO xác nhận là lỗi hay rule mới. Nếu là rule mới thì cập nhật spec và AC của VP-2585.

### Lỗi #2 — Reopen làm tăng visit ([VP-4979](https://linear.app/fastboy/issue/VP-4979))

- **Đơn:** OD261022-18583896 (Cash $36.75, khách lam_doan_b).
- **Các bước:** tạo đơn có lam_doan_b → thanh toán (visit 2 → 3, điểm 208 → 244) → Re-Open → không sửa → Re-Open Done → mở lại customer.
- **Thực tế:** Total visits **4** (điểm vẫn 244).
- **Mong đợi:** visit giữ nguyên **3**.

### Lỗi #3 — Điểm sai khi customer được gán lúc reopen ([VP-4980](https://linear.app/fastboy/issue/VP-4980))

- **Đơn:** OD261022-17390786 (Card $104.91, ban đầu không có customer).
- **Các bước và kết quả:**
  1. Reopen → gán lam_doan_a → Done → lam_doan_a: **104 điểm, visit 1** (đúng).
  2. Reopen → đổi lam_doan_a → lam_doan_b → Done → lam_doan_b: **104 điểm, visit 1** (đúng), nhưng lam_doan_a **vẫn 104 điểm, visit 1** (sai: phải về 0). Chờ hơn 10 phút vẫn 104.
  3. Reopen → gỡ lam_doan_b, chọn lam_doan_a, gỡ ra chọn lại lam_doan_b → Done → lam_doan_b: **208 điểm, visit 2** (sai: cộng thêm 104 điểm và 1 visit, không có thanh toán mới).
- **So sánh:** đổi khách trên đơn có customer từ lúc thanh toán (TC30, Cash) thì đúng. Khả năng `pointBonusCustomerId` không được ghi khi khách được gán lần đầu trong lúc reopen.
- **Ảnh hưởng dữ liệu test:** lam_doan_a thừa 104 điểm, lam_doan_b thừa 104 điểm + 1 visit.

---

## 8. Ghi nhận phụ (chưa log bug)

- Đơn mới OD261022-17390786: lúc vào checkout hiện dialog **"Order in use — This order is currently being used on another device"**, dù đơn vừa tạo trên chính máy này. Bấm OK vẫn thanh toán bình thường.
- Checkout đơn mới chưa thanh toán đồng nào nhưng dòng **Remaining** hiện $0.00 thay vì tổng tiền.
