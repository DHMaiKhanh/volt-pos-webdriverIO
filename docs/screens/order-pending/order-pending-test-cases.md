---
title: Đơn đang chờ (/order-pending) — Tài liệu hợp nhất (tính năng + test case + quét Tiếng Việt)
route: /order-pending
scanned-at: 2026-07-06
consolidates: feature-spec + test cases + i18n (coverage + meaning)
excludes: docs/codegen-flow/order-pending-flow.md · docs/codegen-detail/order-pending-detail.md (giữ riêng)
---

# Đơn đang chờ (`/order-pending`) — Tài liệu hợp nhất

> MỘT file duy nhất: gộp đặc tả tính năng + test case + kết quả quét Tiếng Việt (còn tiếng Anh + dịch đúng chuẩn). Kết quả trực quan: [reports/order-pending/order-pending-scan.html](../../reports/order-pending/order-pending-scan.html). Luồng code-gen giữ riêng: [codegen-flow/order-pending-flow.md](../order-pending/order-pending-code-detail.md) · [codegen-detail/order-pending-detail.md](../order-pending/order-pending-code-detail.md).

# PHẦN A — Đặc tả tính năng

> Nguồn: spec offline Linear (`docs/linear/order-pending.md`) + **quét màn hình thật** bằng Playwright MCP trên app đang chạy `http://localhost:1420/order-pending` (2026-07-06).

## A1. Mục tiêu & phạm vi

Xây dựng workflow **Pending Order** cho POS để tách rời **phục vụ** khỏi **thanh toán**:

- Tạo order **trước khi** thanh toán (walk-in, khách đang làm dịch vụ).
- Hỗ trợ luồng **GoCheckin** (queue management, theo dõi khách đang ở tiệm).
- Thoát khỏi flow cứng `Create Order → Checkout → Payment Success` hiện tại.

Màn `/order-pending` là **Pending Orders Queue** — màn hình vận hành chính: theo dõi khách, trạng thái xử lý, mở nhanh order cần thao tác, quản lý queue. **KHÔNG** dùng để edit sâu order (việc đó nằm ở màn Create/Update Order — Order Workspace).

## A2. Các luồng chính (từ Linear)

- **Định nghĩa Pending Order:** status `Pending` = order chưa checkout hoàn tất (chưa thanh toán). **Không** hiển thị trong Order History cho tới khi `Completed`.
- **3 nguồn tạo Pending Order:**
  1. **Create Order thủ công** — `POS Home → Create Order → Pending Order` (walk-in).
  2. **Checkout từ Appointment** — `Appointment → Checkout → Pending Order → thanh toán sau`.
  3. **GoCheckin** — `Check-in success → auto-create Pending Order → tag: Checked in`.
- **Vòng đời:** `Create Order → Pending → Service Processing → Checkout → Payment Success → Completed`.
- **GoCheckin flow:** `GoCheckin → Auto-create Pending → xử lý dịch vụ → Checkout → Payment Success`.

## A3. Thành phần UI thực tế (quét bằng Playwright MCP, 2026-07-06)

Ảnh: [order-pending-assets/queue.png](order-pending-assets/queue.png)

| Thành phần                               | Vai trò                                       | Trạng thái | Ghi chú                                  |
| ---------------------------------------- | --------------------------------------------- | ---------- | ---------------------------------------- |
| Header — nút **Pending Orders**          | Đang active, mở panel/queue đơn chờ           | Hoạt động  | Cạnh Order History, Appointment, Scanner |
| Link **Order History** / **Appointment** | Điều hướng chéo                               | Hoạt động  | Appointment kèm `?date=<epoch>`          |
| **Search order** (textbox)               | Lọc theo _order ID, customer name hoặc phone_ | Hoạt động  | placeholder tiếng Anh                    |
| Filter **Staff (15)**                    | Lọc theo nhân viên; badge đếm 15              | Hoạt động  | Mở dropdown chọn staff                   |
| Combobox **Sort**                        | Sắp xếp danh sách                             | Hoạt động  | Options: **Latest** / **Oldest**         |
| Combobox **Date range** (preset "Today") | Chọn khoảng ngày                              | Hoạt động  | Đi kèm date-picker calendar              |
| Nút **calendar** `07/05/2026`            | Chọn ngày cụ thể                              | Hoạt động  | Ngày mặc định = hôm nay theo TZ shop     |
| Nút **Quick Checkout**                   | Thanh toán nhanh                              | Hoạt động  | Action chính bên phải toolbar            |
| **Pending Order Card**                   | Một đơn chờ, click để mở workspace            | Hoạt động  | Xem cấu trúc card bên dưới               |
| Banner **connection**                    | "Internet connection restored."               | Hoạt động  | Liên quan Offline Mode                   |

**Cấu trúc Pending Order Card** (khớp spec Linear §4.1):

| Field           | Ví dụ quét được                                               | Ghi chú                                           |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Order ID        | `OD260705-14849180`, `OD260706-13470271`, `OD260706-01297238` | Mã đơn                                            |
| Tag "In Use"    | có/không                                                      | Badge trạng thái sử dụng (card thứ 3 có "In Use") |
| Customer name   | `Unknown`                                                     | Khách chưa gán → Unknown                          |
| Phone / Points  | `N/A` · `0 Pts`                                               | SĐT và điểm thành viên                            |
| Created at      | `11:07 PM`, `10:44 PM`, `07:21 PM`                            | Giờ tạo                                           |
| Status          | `Processing`                                                  | Trạng thái xử lý dịch vụ                          |
| Service · Staff | `Regular Pedicure` · `Linda`                                  | Chỉ hiện khi đơn đã có dịch vụ/nhân viên          |

## A4. Nghiệp vụ & ràng buộc

- Pending Order **không tự complete/cancel** khi qua ngày mới; vẫn cho thanh toán đơn Pending của **ngày quá khứ** — complete lúc nào thì **Order Date** = lúc đó.
- Nếu đã Checkout từ Appointment nhưng chưa thanh toán → click Checkout tiếp **redirect** về Order Pending đã checkout trước đó (chống tạo trùng).
- Mọi thay đổi trên Pending Order đều được ghi nhận cho đến khi `payment success → Completed`.

## A5. Trạng thái / quyền / edge case

- **Offline Mode:** vẫn tạo được Pending Order khi offline (`order_status = Pending`). Chỉ cho **Complete bằng Cash** khi offline rồi sync lại khi online.
- **Offline indicators:** `Waiting for sync`, `Sync failed`, `Conflict detected`.
- **Chống duplicate:** Pending Orders hiển thị đồng thời ở `Pending Orders Queue` và `Order Workspace`.
- Card `Unknown` / `N/A` / `0 Pts`: đơn tạo trước, chưa gán khách.

## A6. Đối chiếu Linear ↔ UI thực tế (khớp / lệch)

- **Khớp:** Card hiển thị đúng `Order ID, Customer name, Phone, Tag, Created at, Status: Pending` như spec §4.1. Header actions có Search + Date picker + Create/Quick Checkout.
- **Lệch / cần lưu ý:**
  - Spec nêu header action **"Create Order"**; UI thực tế nút bên phải là **"Quick Checkout"** (Create Order có thể ở Home). Cần xác nhận với PO.
  - Spec §4.1 nêu **Filters** chung; UI thực tế cụ thể hoá thành **Staff filter + Sort (Latest/Oldest) + Date range**.
  - Status trên card hiển thị **"Processing"** (không phải literal "Pending") — là trạng thái xử lý dịch vụ bên trong lifecycle Pending.

# PHẦN B — Quét Tiếng Việt (i18n)

> Cơ chế: quét 1 lần **EN** → đổi sang **Tiếng Việt** → quét lại → ghép theo đường dẫn DOM. Nguồn số liệu: [reports/order-pending/compare.json](../../reports/order-pending/compare.json). Bổ sung ngữ cảnh từ [order-pending-translation-map.md](../order-pending/order-pending-code-detail.md 'i18n Notes section').

## B0. Tổng quan (số liệu từ i18n-result.md / compare.json)

Bản kết luận đã review (6 bề mặt **luôn hiển thị** — header + filter bar):

> tổng **6** · ❌ chưa dịch **1** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **0** (xOverflow 0, không chuỗi bị cắt)

Các bề mặt luôn hiển thị (header + filter bar) đã dịch tốt. Chỉ còn **1 chuỗi tiếng Anh** rò rỉ là fallback tên khách **"Unknown"**. Không phát hiện vỡ giao diện (tiếng Việt không đẩy tràn ngang).

Số liệu thô `compare.json` (bắt cả dữ liệu động + aria-label + devtools làm nhiễu):

> total **39** · missing **1** · suspect **0** · ok **21** · data **2** — `uiBroken.xOverflow = 0`, `clipped = []`

Chênh lệch giữa 2 con số là do `compare.json` gộp thêm các phần tử **dữ liệu động** (mã đơn `OD…`, giờ tạo, tên KH/dịch vụ như `Linda`, `Regular Pedicure`) và các `aria-label` hệ thống (`Open sidebar`, `Notifications alt+T`, `Open TanStack Devtools`) — những mục này **không phải nhãn UI cần dịch**, đã lọc khỏi kết luận review.

## B1. ❌ Còn tiếng Anh (nhãn UI thật)

| Chuỗi (EN) | Đang hiển thị (VI)     | Nên dịch     | Nguồn                                                                  |
| ---------- | ---------------------- | ------------ | ---------------------------------------------------------------------- |
| `Unknown`  | `Unknown` (giữ nguyên) | **Không rõ** | fallback tên khách trên thẻ đơn — `pending-order-card.tsx` (~dòng 132) |

> "Unknown" **không phải** dữ liệu khách thật mà là **chuỗi fallback hardcode** khi đơn chưa gán khách → cần đưa qua `t()` (vd `common.unknownCustomer` = "Không rõ"). Map cũ xếp cột tên KH là "data động — không dịch", nhưng riêng giá trị fallback này là **UI string** và là lỗi dịch thật.

## B2. ⚠️ Dịch chưa đúng chuẩn

Không có. 6/6 thuật ngữ khớp glossary POS.

## B3. ✅ Đã dịch đúng (mẫu)

| Text (EN)      | Hiển thị (VI)    |
| -------------- | ---------------- |
| Pending Orders | Đơn đang chờ     |
| Order History  | Lịch sử đơn hàng |
| Appointment    | Lịch hẹn         |
| Scanner        | Quét mã          |
| Staff          | Nhân viên        |
| Quick Checkout | Thanh toán nhanh |

Ngoài 6 bề mặt luôn hiển thị, các chuỗi có điều kiện đã bắt được trong lần quét cũng dịch đúng: `Latest` → Mới nhất, `Today` → Hôm nay, `Processing` → Đang xử lý, `In Use` → Đang dùng, `N/A` → Không có, `0 Pts` → 0 Điểm, placeholder `Search order ID, customer name or phone` → Tìm mã đơn hàng, tên khách hàng hoặc SĐT.

## B4. 📐 UI vỡ (chỉ báo cáo)

Không có: `xOverflow = 0`, danh sách `clipped` rỗng. Bản dịch tiếng Việt của header/filter không làm tràn ngang hay cắt chữ ở viewport 1920×1080.

## B5. Ghi chú / đề xuất bổ sung glossary

- **Phạm vi lần quét này:** compare bắt **6 bề mặt luôn hiển thị**. Nhiều chuỗi **có điều kiện** chưa được ép hiện nên chưa vào compare — cần **quét sâu** để phủ (tham chiếu map §1b/§2/§3):
  - Sort `Latest/Oldest` (`global.latest/oldest`), DatePicker preset `Today/Yesterday…`, badge `Processing` (`common.processing`), `In Use`, `Checked-in`, `+N more service(s)`.
  - **DatePicker — lưới lịch** vẫn còn tiếng Anh (tên tháng "July 2026" + thứ "Mo Tu We…"), đã ghi ⚠️ trong map §1c; từ điển chung không bắt được → cần dò riêng.
  - Empty/Error/Toast (`No pending orders`, `Couldn't load…`, các toast lỗi) chỉ hiện khi có điều kiện nghiệp vụ → ghi nhận thủ công từ source, chưa vào compare.
- **Đề xuất glossary** (`src/utils/i18nCompare.ts` → `GLOSSARY`): thêm `Unknown: ['Không rõ']` để lần quét sau tự phân loại `missing`/`suspect` cho chuỗi này.
- **KHÔNG tự sửa source app** — việc thêm `t()` cho "Unknown" + dịch lưới lịch là của dev.

## B6. Cách tái tạo

```bash
I18N_SCREEN=order-pending I18N_LENIENT=1 npx playwright test \
  tests/regression/i18n/TC-i18n-screen-compare.spec.ts --project=no-retry --reporter=line
# → reports/order-pending/compare.json
```

# PHẦN C — Test cases

> Đầu ra **Skill 2/4** (`linear-testcase-gen`). Selector đều bắt nguồn từ kết quả quét thật (không bịa).
>
> **Cấu trúc spec (2026-07-06):** đã gộp thành **1 test lớn** kiểu Home (`TC-OP-ALL`) — mỗi TC dưới đây là một `test.step` chạy qua helper `check(...)`, kết quả xuất ra `reports/order-pending/order-pending-scan.{html,json}` (xem skill `screen-suite-report`). File: [TC-order-pending.spec.ts](../../tests/regression/orders/order-pending/TC-order-pending.spec.ts).

## Ma trận test case

| ID       | Tiêu đề                            | Tiền điều kiện         | Các bước                                                    | Kết quả mong đợi                                                                                     | Loại              | Ưu tiên |
| -------- | ---------------------------------- | ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- | ------- |
| TC-OP-01 | Tải màn hình & toolbar hiển thị    | App đã đăng nhập       | 1. `goto('/order-pending')`                                 | Heading "Pending Orders" hiển thị; toolbar có Search, Staff filter, Sort, Date range, Quick Checkout | regression, smoke | P1      |
| TC-OP-02 | Card đơn chờ đúng cấu trúc         | Có ≥1 Pending Order    | 1. Mở màn 2. Đọc card đầu                                   | Card có mã dạng `OD######-########`, giờ tạo, trạng thái "Processing"                                | regression        | P1      |
| TC-OP-03 | Tìm theo Order ID lọc đúng         | Có ≥1 order, biết 1 mã | 1. Gõ 8 số cuối của 1 mã vào Search                         | Chỉ còn card khớp; các card khác biến mất                                                            | regression, ui    | P1      |
| TC-OP-04 | Tìm không khớp → rỗng              | Có ≥1 order            | 1. Gõ chuỗi không tồn tại `ZZZ000000`                       | Danh sách card = 0                                                                                   | regression        | P2      |
| TC-OP-05 | Sort Latest ↔ Oldest đảo thứ tự    | Có ≥2 order khác giờ   | 1. Ghi mã card đầu (Latest) 2. Chọn "Oldest"                | Card đầu sau khi đổi khác card đầu ban đầu                                                           | regression        | P2      |
| TC-OP-06 | Sort chỉ có 2 lựa chọn             | App mở                 | 1. Mở combobox Sort                                         | Options đúng là `Latest`, `Oldest`                                                                   | regression        | P3      |
| TC-OP-07 | Quick Checkout khả dụng            | App mở                 | 1. Quan sát toolbar                                         | Nút "Quick Checkout" hiển thị & enabled                                                              | regression        | P2      |
| TC-OP-08 | Staff filter có badge đếm          | App mở                 | 1. Quan sát nút Staff                                       | Nút "Staff" hiển thị kèm số đếm (vd 15)                                                              | regression        | P3      |
| TC-OP-09 | Date range mặc định = Today        | App mở                 | 1. Quan sát cụm date                                        | Combobox preset "Today"; nút calendar hiện ngày `MM/DD/YYYY`                                         | regression        | P3      |
| TC-OP-10 | Điều hướng chéo từ header          | App mở                 | 1. Click "Order History" 2. Quay lại 3. Click "Appointment" | URL đổi sang `/order-history` rồi `/appointment`                                                     | regression        | P2      |
| TC-OP-11 | Đơn đã thanh toán rời khỏi Pending | Biết 1 mã chưa tồn tại | 1. `expectOrderAbsent(<mã lạ>)`                             | Order không xuất hiện trong list (count 0)                                                           | regression        | P3      |

## Ghi chú thực thi

- **Trạng thái rỗng:** nếu shop không có Pending Order nào, TC-02/03/05 tự **skip an toàn** (guard theo số lượng card) thay vì fail giả.
- **i18n:** chuỗi tiếng Anh còn lộ (Quick Checkout, Latest/Oldest, Today, Processing…) do **Skill 5** xử lý — không assert nội dung dịch ở đây.
- Không tạo order mới / không checkout thật trong suite này (đọc-hiểu queue). Luồng tạo đơn end-to-end đã có ở [bulkCreateOrders.regression.spec.ts](../../tests/regression/orders/bulkCreateOrders.regression.spec.ts).

## Cách chạy

```bash
npx playwright test tests/regression/orders/order-pending/TC-order-pending.spec.ts --project=chromium
```

## Nguồn tham chiếu

- Spec/glossary: [docs/i18n/order-pending-translation-map.md](../order-pending/order-pending-code-detail.md 'i18n Notes section') (giữ riêng)
- Luồng code-gen (tách riêng): [codegen-flow/order-pending-flow.md](../order-pending/order-pending-code-detail.md) · [codegen-detail/order-pending-detail.md](../order-pending/order-pending-code-detail.md)
- Test/helper + dữ liệu thô JSON: [reports/order-pending/compare.json](../../reports/order-pending/compare.json)
- Spec Linear (offline): [docs/linear/order-pending.md](../linear/order-pending.md)
- Ảnh quét: [order-pending-assets/queue.png](order-pending-assets/queue.png)
- App live: `http://localhost:1420/order-pending` (BASE_URL mặc định, TZ theo shop)
