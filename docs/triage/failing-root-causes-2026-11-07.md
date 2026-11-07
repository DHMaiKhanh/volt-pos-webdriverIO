# Triage TC fail / skip — 07/11/2026

Nguồn: 50 run gần nhất trong `dashboard/public/data/history.json` (27/10 → 07/11) + evidence, đối chiếu 3 lượt chạy lại hôm nay
trên app dev đã cài (tiệm 14, lane launch). Báo cáo máy sinh: `reports/triage/2026-11-07T09-02-07/failures.md`.

## Tổng quan

|                                                | Trước khi sửa | Sau khi sửa + chạy lại                                                   |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| TC đang fail (OPEN)                            | 43            | **5 lỗi app thật** (đã chạy lại 07/11, vẫn fail) + **1 cần PO xác nhận** |
| Lượt chạy lại 10 spec fail (sau khi login lại) | 45 fail / 144 | —                                                                        |
| Lượt cuối 4 spec home-pend/pos-home            | —             | **63 pass / 3 fail / 4 skip** (70 TC)                                    |
| home-cart, VP-5634, VP-5627, VP-5685, VP-5195  | fail          | **PASS** cả spec                                                         |

| Nhóm nguyên nhân                        | Số TC | Trạng thái        |
| --------------------------------------- | ----- | ----------------- |
| UI_CHANGE (giao diện build 1.1.10x đổi) | ~40   | đã sửa code, PASS |
| ENV (dữ liệu/thiết bị đổi)              | 10    | đã sửa / tự hết   |
| TEST_CODE                               | 2     | đã sửa            |
| FLAKY                                   | 3     | chạy lại PASS     |
| **APP_BUG (lỗi thật)**                  | **5** | còn mở            |
| LOGIC_CHANGE? (cần PO xác nhận)         | 1     | còn mở            |

## 1. Lỗi thật của app (APP_BUG)

| #   | TC                                                                           | Tái hiện                                                         | Thực tế                                                                               | Mong đợi                           | Ticket                      |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------- |
| 1   | volt-qc/home-pend/home-customer — _Customer bar … Visit: 0 (HOME-106)_       | Quick Checkout → tạo khách mới bằng SĐT → xem thanh khách        | `Point: 0 Visit: ###`                                                                 | `Visit: 0`                         | chưa log (đã thấy từ 03/11) |
| 2   | appointment/vp-4402 TC-VP4402-12                                             | Appointment board, thợ không có màu                              | 27 cột màu xám `#4D4A5B`                                                              | `#5669FF` như GAP                  | VP-5481                     |
| 3   | appointment/vp-4402 TC-VP4402-13                                             | Appointment board, cột Unassigned                                | `#4D4A5B`                                                                             | `#5669FF`                          | VP-5481                     |
| 4   | volt-qc/pos/home — _Sort by … Name A→Z (HOME-023/024)_                       | Staff panel → Sort → Name                                        | sắp theo mã ASCII, phân biệt hoa/thường: `APIB1778506575 abc` đứng trước `Alexander2` | A→Z không phân biệt hoa/thường     | volt-qc bug #12             |
| 5   | volt-qc/home-pend/home-panels — _Merge Order hidden … after Custom Discount_ | Đơn có 1 dịch vụ → Promo & Rewards → Custom Discount 10% → Apply | nút **Merge Order vẫn hiện**                                                          | Merge Order ẩn sau Custom Discount | volt-qc bug #11             |

### Cần PO xác nhận (LOGIC_CHANGE?)

- **volt-qc/home-pend/home-items — _Pinned Quick Pay + Gift Card … first category pre-selected (HOME-035)_**: build mới **không chọn sẵn
  danh mục nào**, ô Quick Pay mang viền "đang chọn" (`outline-4`), lưới dịch vụ hiện **tất cả** dịch vụ. HOME-035 yêu cầu danh mục đầu
  tiên được chọn sẵn. Nếu PO xác nhận đây là thiết kế mới → sửa kỳ vọng test; nếu không → log bug.

## 2. Đã sửa code (không phải lỗi app)

| Gốc rễ                                                                                                                                                       | Nhóm      | TC ảnh hưởng                                                   | Sửa ở                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tiệm bật passcode **"Enter staff code to access Quick Checkout"** → dialog che till; mọi click sau "element click intercepted", chọn thợ "không mở được đơn" | ENV/UI    | ~30 TC home-panels / home-items / home-order                   | `src/pages/voltqc/pos/homeProbe.ts` (`unlockQuickCheckoutGate` trong `quickCheckout`), `homePendProbe.ts` `pickStaff` |
| Sidebar Pending Orders đóng sẵn khi mở app (toggle `global.showPendingSidebar`)                                                                              | UI_CHANGE | home-pend, pos/home                                            | `ensurePendingSidebarOpen` (HomePage.ts, homeProbe.ts, navigation.flow.ts)                                            |
| Thanh khách đổi class `h-24` → `min-h-24` (+ badge "Booking") → đọc thanh khách ra chuỗi rỗng                                                                | UI_CHANGE | 12 TC home-customer                                            | `src/constants/testids.voltqc-home-pend.ts` (`:is(.h-24, .min-h-24)`)                                                 |
| Click lần 2 vào cùng ô dịch vụ bị chính `<li>` chặn (animation nhấn)                                                                                         | TEST_CODE | 4 TC (Remove Staff, 3 services, two-staff, same service twice) | `homePendProbe.ts` `addService` → jsClick + fallback                                                                  |
| Mã "không tồn tại" mặc định `9137` nay là mã của 1 thợ **Inactive** → app báo "This staff is inactive"                                                       | ENV       | home-order HOME-077                                            | `unknownCode()` → `6402`; thêm `VOLT_INACTIVE_CODE=9137` vào `.env.dev` (bật luôn nhánh check Inactive)               |
| Kéo carousel bắt đầu ở x=r.x+600 (ngoài màn hình / ngoài khung) → "move target out of bounds"                                                                | TEST_CODE | pos/home HOME-037                                              | `tests/regression/volt-qc/pos/home.spec.ts`                                                                           |
| Service fee tiệm 14 đổi 3% → 10%, test hardcode 3% (`$12.36` vs `$13.20`)                                                                                    | ENV       | TC-ORDERFLOW-22                                                | `tests/regression/order-flow/home-cart.spec.ts` — tự suy phí từ giỏ                                                   |

## 3. Tự hết khi chạy lại (ENV / FLAKY)

| Spec                                                              | Lỗi cũ                                             | Kết luận                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| settings/vp-5685-default-screen                                   | `invalid session id` / switch window 06/11         | ENV — phiên WebDriver chết; 07/11 PASS                                               |
| settings/vp-5627-custom-promo-split                               | timeout 120s + click intercepted 06/11             | FLAKY; 07/11 PASS (TC-18 skip: hết phiên `.portal-profile` → `npm run portal:login`) |
| checkout/vp-5634 TC-07                                            | lệch dòng receipt 05/11                            | FLAKY; 07/11 PASS                                                                    |
| customer-display/vp-5195                                          | before-all không tìm thấy khách 2052051122 (05/11) | ENV dữ liệu; 07/11 PASS                                                              |
| Các hook before/after của home-pend (REGRESSED trong báo cáo máy) | timeout / passcode gate                            | Do gate Quick Checkout + đăng xuất; spec chạy hôm nay không còn lỗi hook             |

> Lượt chạy 14:18 hôm nay fail 10/10 vì **device bị đăng xuất** (STAFF_TOKEN trống, màn /login QR) — user đã quét QR lại.

## 4. TC đang SKIP

| TC                                                          | Lý do                                                                                                             | Cách bật                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| ~~pos/home HOME-017 Staff search không trả Inactive/Owner~~ | **ĐÃ BẬT 07/11** — `VOLT_INACTIVE_NAME=QA TEST S01` (đọc staffList app dev) → **PASS**                            | —                                          |
| home-order HOME-151 role không có Delete Order              | thiếu `VOLT_NO_DELETE_ORDER_CODE` (passcode thợ không đọc được qua API)                                           | mã của 1 thợ không có quyền Delete Order   |
| home-order Store group (gift card sale)                     | thiếu `VOLT_TEST_GIFT_CARD`; catalog `giftCards.json` là của tiệm 20258, không dùng được cho tiệm 14              | số thẻ gift card bán được trên tiệm 14 dev |
| vp-5627 TC-18 Portal ↔ POS sync                             | phiên `.portal-profile` hết hạn                                                                                   | `npm run portal:login` (quét QR)           |
| vp-5627 TC-19 offline                                       | cần tắt mạng thật                                                                                                 | chạy tay                                   |
| vp-4815 TC-07/22, vp-4402 TC-05/15/16                       | PENDING theo thiết kế (gift card dev bị từ chối, không có máy P8D, VP-5479 bị huỷ, so sánh trực quan GAP, chỉ BE) | không tự động hoá được                     |
| home-order HOME-015 Re-open → Edit Order                    | `it.skip` — PENDING 04/11 theo yêu cầu user                                                                       | grep `PENDING 04/11/2026`                  |
| vp-4912 TC-02/09/10, vp-5685 TC-06, pos/home carousel       | PARKED (`.skip`)                                                                                                  | như trên                                   |

## 5. Cần làm

1. Log bug: **Visit "###"** (chưa có ticket); xác nhận VP-5481 / bug #11 / bug #12 đã có ticket.
2. Hỏi PO về HOME-035 (danh mục chọn sẵn).
3. Điền 3 biến env ở mục 4 để bỏ skip.
4. Commit các thay đổi test (chưa commit).
