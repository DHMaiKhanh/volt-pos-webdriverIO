# Linear VP — Volt POS (Nail, Windows) test-case catalog

> Nguồn: quét toàn bộ backlog team **VOLT (VP)** trên Linear — ~2,280 issues, 16 trang,
> `orderBy=updatedAt` tới `hasNextPage=false` (27/10/2026).
> Phạm vi: **chỉ app Volt POS Nail chạy Windows** (Tauri/WebView2, tiệm 14 / 20258).
> Restaurant (R0–R3), Android/tablet hardware (D5/P18/P8D/A8/D8/P12 semi), Portal-web,
> API/CI/infra, i18n string, MCP plugin → xếp **out-of-scope** ở Mục C.
>
> Mỗi dòng ở Mục A/B là một **test case cần có** cho POS Windows. Cột "test intent" =
> hành vi đúng mà spec phải assert. Trạng thái (Done / Verified Prod / QC / Todo…) là
> trạng thái dev của ticket, KHÔNG phải trạng thái coverage của suite.

---

## A. In-scope features / enhancements (Windows POS) — cần test case

### Checkout / Payment / Fees / Receipt

| VP-id             | type    | status        | title                                                           | test intent                                                                                     | area                      |
| ----------------- | ------- | ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| VP-4591           | feature | Done          | Checkout Type Setting (Windows+Android)                         | Auto / Hybrid / Manual checkout type chi phối award point & auto-checkout theo setting merchant | Checkout Type             |
| VP-5098           | enh     | QC Completed  | Move Checkout setting up, Point config vào Hybrid               | Point config chỉ sửa được trong Hybrid (không còn block read-only)                              | Checkout Type             |
| VP-4554           | feature | Done          | Checkout Type Auto/Hybrid + auto-checkout Hybrid 23:59          | Order Hybrid tự complete cuối ngày; Auto vs Hybrid đúng                                         | Checkout Type             |
| VP-3334           | feature | Verified Prod | Apply Service Tax ở order level — checkout & split              | Service tax đúng ở checkout và split order                                                      | Checkout                  |
| VP-3335           | feature | Verified Prod | Service Tax phản ánh ở receipt, cancel, refund, order history   | Service tax nhất quán mọi bề mặt order                                                          | Checkout                  |
| VP-3827/3879/4083 | enh     | Verified Prod | Loại Gift Card Sale khỏi Service Fee & Cash Discount (+ toggle) | Dòng bán GC không bị service fee/CD; toggle "Apply Service Fee to Gift Card" được tôn trọng     | Checkout/Gift Card        |
| VP-4194           | enh     | Verified Prod | Tắt Tip màn phụ + Cash amount cộng dồn                          | Setting ẩn tip trên màn khách; nhập cash cộng dồn                                               | Checkout/Customer Display |
| VP-3437           | enh     | Verified Prod | Cash Enter Amount: entry mới REPLACE giá cũ, Change nổi bật     | Keypad cash thay giá (không cộng); số Change highlight                                          | Checkout                  |
| VP-2596           | enh     | Backlog       | Thêm phương thức Check                                          | "Check" chọn được như tender                                                                    | Checkout                  |
| VP-2676           | feature | Todo          | Manual Refund bằng Cash/Other                                   | Refund thủ công qua Cash/Other                                                                  | Refund                    |
| VP-4290/4295      | enh     | Verified Prod | Auth Code trên receipt (card)                                   | Card Auth Code in trên receipt                                                                  | Checkout/Receipt          |
| VP-4304           | feature | Verified Prod | Chữ ký khách trên receipt                                       | Chữ ký đã ký render trên receipt                                                                | Checkout/Receipt          |
| VP-3366/3363      | enh     | Verified Prod | Tách toggle từng dòng summary trên receipt                      | Mỗi dòng summary bật/tắt độc lập                                                                | Settings/Receipt          |
| VP-3431           | enh     | Verified Prod | Phóng to Total Paid / Change / Remaining                        | 3 nhãn to/đậm hơn                                                                               | Checkout                  |
| VP-3766           | enh     | Verified Prod | Nút Accept chữ ký to/nổi bật                                    | Accept to hơn ở bước ký                                                                         | Checkout                  |
| VP-4326           | enh     | Verified Prod | Keypad số cho ô nhập tiền                                       | Ô tiền hiện keypad số                                                                           | Checkout                  |
| VP-4701           | feature | Todo          | Semi Cloud — Devices popover, Card tile state                   | Card tile phản ánh trạng thái kết nối terminal cloud                                            | Checkout                  |

### Split Order

| VP-id   | type     | status | title                                                 | test intent                                                   | area        |
| ------- | -------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| VP-3788 | bug/feat | Todo   | Split Order — GC partial redemption mất tip của check | Redeem GC một phần trên check split phải giữ tip của check đó | Split Order |

### Reopen / Edit completed Order

| VP-id                  | type    | status       | title                                                       | test intent                                      | area       |
| ---------------------- | ------- | ------------ | ----------------------------------------------------------- | ------------------------------------------------ | ---------- |
| VP-2585                | feature | QC Completed | Reopen — sửa item service/product và staff 1 lần            | Reopen cho sửa item/staff số lần giới hạn        | Reopen     |
| VP-4085                | enh     | QC Completed | Reopen — cập nhật point & checkinAndCheckout theo model mới | Reopen tính lại điểm đúng                        | Reopen     |
| VP-4077                | enh     | QC Completed | Reopen — tính lại theo GC service-fee toggle đã lưu         | Reopen tôn trọng toggle service-fee GC của order | Reopen     |
| VP-2591/2593           | feature | QC Testing   | Update order info không đổi giá                             | Sửa metadata (staff/tên service) không đổi total | Edit Order |
| VP-3148/3670/3376/4113 | enh     | In Progress  | Reopen — chuyển từng service giữa các staff                 | Chuyển 1 dòng service sang tech khác khi reopen  | Reopen     |

### Order History / Pending Orders

| VP-id        | type | status        | title                                                       | test intent                                     | area                   |
| ------------ | ---- | ------------- | ----------------------------------------------------------- | ----------------------------------------------- | ---------------------- |
| VP-4035      | enh  | Done          | Sort staff đã check-in theo thứ tự check-in (Pending)       | Danh sách staff Pending sắp theo giờ check-in   | Pending                |
| VP-1974      | enh  | Backlog       | Panel Pending collapse/pin                                  | Drawer collapse/pin được                        | Pending/Home           |
| VP-3314      | enh  | Todo          | Chặn auto-link/auto-complete pending trùng phone            | 2 pending cùng phone không bị gộp/auto-complete | Pending                |
| VP-4506      | enh  | Verified Prod | Tag payment method ở Order History                          | Dòng order hiện tag tender                      | Order History          |
| VP-1963      | enh  | Backlog       | Giới hạn filter ngày 6 tháng                                | Filter cap 6 tháng                              | Order History          |
| VP-3592/3823 | enh  | Verified Prod | Yêu cầu staff code để xem Order History (+limit theo staff) | Passcode gate + visibility theo staff           | Order History/Passcode |
| VP-3822      | enh  | Verified Prod | Yêu cầu staff code trước khi xoá order                      | Xoá order gated passcode (guard 2 bước)         | Order History/Passcode |
| VP-3147/3156 | enh  | Verified Prod | QR trên preview ticket receipt                              | Preview ticket hiện QR quét được                | Order History/Receipt  |

### Home / Create Order / Discount ⭐ (ưu tiên luồng tạo order)

| VP-id        | type    | status        | title                                                    | test intent                                                               | area          |
| ------------ | ------- | ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| VP-4802      | enh     | QC Completed  | Hiện tổng Promotion & Reward khi tạo order               | Màn tạo order hiện tổng promo/reward khả dụng                             | Home          |
| VP-3285/2611 | enh     | Verified Prod | Tách Discount Setting Promotion vs Custom Promotion      | 2 setting split discount độc lập                                          | Home/Discount |
| VP-3433      | bug/enh | Verified Prod | Dời Discount Setting từ Tipping sang Charge & Fee        | Setting ở mục Charge & Fee                                                | Settings      |
| VP-3247/3434 | enh     | Verified Prod | Hiện staff status (Available/Busy) ở Turn                | Turn board hiện trạng thái thật, không "Available" trước khi chọn service | Home/Turn     |
| VP-2907      | enh     | Verified Prod | Hiện Turn & staff status ở Check-out                     | Turn/status thấy ở checkout                                               | Home/Turn     |
| VP-1572      | bug     | Verified Prod | Không chọn được staff sau khi search                     | Staff chọn được sau search                                                | Home          |
| VP-4375      | bug     | In Review     | Promo/reward FIXED lớn hơn phần giảm được vẫn lưu nguyên | Discount cap theo phần giảm được                                          | Home/Discount |
| VP-3436      | bug     | Verified Prod | Discount Charge gồm cả discount product (no-staff)       | Discount charge chỉ tính service                                          | Discount      |

### Points / Loyalty / Rewards

| VP-id        | type    | status        | title                                           | test intent                                            | area             |
| ------------ | ------- | ------------- | ----------------------------------------------- | ------------------------------------------------------ | ---------------- |
| VP-3979/4045 | feature | Verified Prod | Point Configuration                             | Point-per-dollar cấu hình theo tender; đúng ở checkout | Points           |
| VP-3445/3653 | enh     | Verified Prod | Ẩn reward points + option redeem trên màn khách | Màn khách ẩn điểm / cho redeem reward                  | Customer Display |

### Appointment

| VP-id        | type    | status          | title                                                  | test intent                                                   | area        |
| ------------ | ------- | --------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ----------- |
| VP-3446/3435 | enh     | Verified Prod   | Gate mọi write appointment sau 1 flag ON/OFF           | Flag off → ẩn Create/Edit/Confirm/Cancel; vẫn read & checkout | Appointment |
| VP-3151      | feature | Verified Prod   | Checkout cả nhóm service của appointment trong 1 order | Nhóm multi-service checkout 1 order                           | Appointment |
| VP-3132      | enh     | Verified Prod   | Badge count & default status filter                    | Badge & filter mặc định đúng                                  | Appointment |
| VP-1975      | enh     | Ready to Review | Nút Add Appointment trên Today list                    | Có nút add appt từ Today                                      | Appointment |
| VP-4402      | enh     | In Progress     | Sắp xếp cột staff thủ công + màu appointment           | Thứ tự cột staff & màu persist                                | Appointment |

### Settings / Passcode / Tax / Dark mode / Update

| VP-id             | type    | status           | title                                                                                    | test intent                                             | area                 |
| ----------------- | ------- | ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| VP-3281/3253      | feature | Verified Prod    | Passcode Settings — cấu hình feature nào cần passcode                                    | Toggle passcode theo feature được enforce               | Settings/Passcode    |
| VP-4815/4860      | enh     | In Progress/Done | Passcode cho Quick Checkout/Quick Pay/Gift Card/Calendar/Service price + Customer Status | Mỗi action gated passcode khi bật                       | Settings/Passcode    |
| VP-3115           | enh     | Verified Prod    | Passcode khi dùng Quick Pay                                                              | Quick Pay hỏi passcode                                  | Settings/Passcode    |
| VP-3442           | enh     | Verified Prod    | Tách "passcode khi payment" khỏi "passcode xem income"                                   | 2 toggle passcode độc lập                               | Settings/Passcode    |
| VP-3863           | enh     | Verified Prod    | Tắt passcode cho Time Tracking                                                           | Time Tracking tắt passcode được                         | Settings/Passcode    |
| VP-3430           | enh     | Verified Prod    | Gom Settings dưới "Payment & Receipt"                                                    | Nhóm settings                                           | Settings             |
| VP-2608/3905/2627 | enh     | Done             | 2 cách tính Supply Share (% vs $ cố định)                                                | Supply share theo phương pháp chọn                      | Settings/Staff&Money |
| VP-3768           | enh     | Done             | Trừ staff discount trước khi chia commission                                             | Base commission theo toggle                             | Settings/Staff&Money |
| VP-3394/3331      | enh     | Done             | Service Tax (vd 8.25%) + tax number portal                                               | Service tax cấu hình & áp dụng                          | Settings/Tax         |
| VP-3798–3808      | feature | QC Completed     | Dark mode POS: Light/Dark, nhớ, áp cả 2 cửa sổ                                           | Appearance toggle persist + theme màn chính + màn khách | Settings             |
| VP-3457           | enh     | QC Completed     | Chỉ hiện staff đã check-in (toggle) + Dark Mode                                          | Toggle lọc danh sách staff                              | Settings             |
| VP-2691/2787      | enh     | QC Completed     | Bỏ popup auto-update; thêm trang update info                                             | Không ép popup; có trang update                         | Settings/Update      |
| VP-5102           | bug     | QC Completed     | Toast "Update failed" tràn, nút Update Now bị che                                        | Toast vừa khung, nút retry tới được                     | Settings/Update      |
| VP-4431           | feature | Backlog          | Thêm Membership vào Volt POS                                                             | Bán/áp dụng gói membership                              | Membership           |

### Reports / Income / Payroll (render trên POS)

| VP-id                  | type    | status        | title                                                          | test intent                        | area    |
| ---------------------- | ------- | ------------- | -------------------------------------------------------------- | ---------------------------------- | ------- |
| VP-4027                | feature | Verified Prod | Daily Sale Report                                              | Số/biểu đồ daily sale đúng         | Reports |
| VP-4028                | feature | Verified Prod | Income Summary                                                 | Total + so sánh kỳ đúng            | Income  |
| VP-4029                | feature | Verified Prod | Staff Income                                                   | Chi tiết service/ngày đúng         | Income  |
| VP-4030                | feature | Verified Prod | Staff Payroll                                                  | Payroll kỳ hiện tại + kỳ đóng      | Payroll |
| VP-2587                | feature | Verified Prod | Income Engine V2 (Rust local)                                  | Income tính local khớp V1          | Reports |
| VP-1992/1870/1990/1991 | feature | Verified Prod | Report Template Configuration                                  | Template cấu hình render trên POS  | Reports |
| VP-4565                | enh     | Verified Prod | Ẩn report V1 cũ khỏi sidebar                                   | V1 bị ẩn                           | Reports |
| VP-3451/3282/3317      | enh     | Verified Prod | Staff Income: cột Date, group theo effective date, tên service | Group đúng + có tên service        | Income  |
| VP-3162                | enh     | Verified Prod | Tip detail theo payment method (V2)                            | Tip tách theo tender               | Income  |
| VP-4790                | feature | Todo          | Report V4: chọn chế độ rounding                                | Exact vs legacy rounding chọn được | Reports |

---

## B. In-scope bugs (Windows POS) — regression test case (assert hành vi ĐÃ fix)

### Checkout / Card / Payment

| VP-id                       | status        | title                                                             | test intent                                               | area              |
| --------------------------- | ------------- | ----------------------------------------------------------------- | --------------------------------------------------------- | ----------------- |
| VP-2919                     | Verified Prod | Phantom card payment — order success dù charge fail/chưa gửi      | Order chỉ complete khi charge thật thành công             | Checkout          |
| VP-4786                     | Todo          | Không complete order chưa trả đủ                                  | Card partial/fail để order unpaid                         | Checkout          |
| VP-4356                     | Verified Prod | Card "Processing" sau charge                                      | Card đã charge thoát Processing                           | Checkout          |
| VP-4287                     | Verified Prod | POS & FBP lệch sau terminal disconnect timeout (checkout & split) | Disconnect reconcile sạch                                 | Checkout          |
| VP-4338                     | Done          | Bamboo charge thành công nhưng báo fail sau 19s stale             | Charge thành công không báo fail                          | Checkout          |
| VP-4168                     | Done          | Double charge sau disconnect outcome UNKNOWN                      | UNKNOWN không re-charge                                   | Checkout          |
| VP-2214/4707/4697/4770/4985 | Todo/Backlog  | Double-charge/MagTek/Semi retry                                   | Không double-charge, reader approve đơn lẻ không complete | Checkout          |
| VP-3272                     | Backlog       | Card Processing sau crash app ở popup chờ                         | Recover trạng thái đúng                                   | Checkout          |
| VP-3070                     | Todo          | Charge thẻ hết hạn vẫn thành công                                 | Thẻ hết hạn bị decline                                    | Checkout          |
| VP-4019                     | Verified Prod | Nhiều preset tip 0% cùng highlight                                | Chỉ 1 preset tip được chọn                                | Tip               |
| VP-3963                     | Verified Prod | Tip % nhỏ chặn Continue                                           | Tip % hợp lệ cho Continue                                 | Tip               |
| VP-3593                     | Verified Prod | Quick Cash cộng dồn thay vì replace                               | Quick Cash mới replace                                    | Checkout          |
| VP-3566                     | Verified Prod | Total Paid/Change/Remaining đổi số sang đen                       | Chỉ nhãn đổi màu, số giữ màu                              | Checkout          |
| VP-3533                     | Verified Prod | Custom Discount không reset owner/staff %                         | % reset đúng                                              | Checkout/Discount |
| VP-3400                     | Verified Prod | order_item.tax_amount âm vỡ sync (422)                            | Tax không push âm                                         | Checkout          |

### Split Order

| VP-id   | status        | title                                                       | test intent                      | area        |
| ------- | ------------- | ----------------------------------------------------------- | -------------------------------- | ----------- |
| VP-4255 | Verified Prod | Split: tip nhập ở cashier không hiện màn khách khi trả card | Màn khách mirror tip cashier     | Split Order |
| VP-4084 | Done          | Split: nút Pay disabled cho Card                            | Pay Card enable trên check split | Split Order |

### Gift Card

| VP-id        | status        | title                                                | test intent                              | area      |
| ------------ | ------------- | ---------------------------------------------------- | ---------------------------------------- | --------- |
| VP-4894      | Todo          | GC inactive/chưa bán còn balance vẫn nhận ở checkout | GC inactive bị từ chối checkout          | Gift Card |
| VP-4934      | Verified Prod | GC Add Funds từ scanner cộng vào order Home đang mở  | Add-funds tạo order mới, không append    | Gift Card |
| VP-3565      | Verified Prod | GC redemption lệch số & không link transaction       | Số redeem khớp & link order              | Gift Card |
| VP-4176      | Verified Prod | Hiện balance GC trên receipt                         | In balance còn lại                       | Gift Card |
| VP-4379/3812 | Done          | GC sale bị charge Service Fee / Cash Discount        | GC sale loại khỏi SF/CD                  | Gift Card |
| VP-4160      | Verified Prod | GC rớt giá khi có promotion dù promo loại GC         | Promotion không giảm dòng GC             | Gift Card |
| VP-4162      | Verified Prod | Promo/Reward chọn được trên order chỉ bán GC         | Promo/Reward chặn khi order GC-sale only | Gift Card |
| VP-3444      | Verified Prod | Void GC trong split thành công nhưng GC không hoàn   | Void re-credit gift card                 | Gift Card |

### Reopen / Edit Order (cụm lớn, nhiều TC còn mỏng)

| VP-id                  | status          | title                                                                         | test intent                                     | area          |
| ---------------------- | --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| VP-3969                | Done            | Reopen tăng visit khách +1                                                    | Reopen không thêm visit ảo                      | Reopen        |
| VP-4980                | Ready to Review | Reopen đổi customer không thu hồi điểm cũ; thêm lại double count              | Điểm/visit chuyển đúng, không double            | Reopen        |
| VP-4792                | Ready to Review | Điểm không cộng dù success screen báo có điểm                                 | Điểm cộng thật khi complete                     | Reopen/Points |
| VP-5020                | Todo            | Reopen Windows ép Void All với split hoàn tất ở Android                       | Không ép void-all                               | Reopen/Split  |
| VP-4079                | QC Completed    | Reopen: product tax không áp cho Card khi thêm Product                        | Product tax áp cho card như cash/other          | Reopen        |
| VP-4012/4013/3931/3957 | QC Completed    | Reopen add service: tax base/Total sai nhiều tender                           | Total add-service đúng mọi tender               | Reopen        |
| VP-3913/3914           | QC Completed    | Reopen vô hạn sau khi hết lượt; không hiện "edits remaining"                  | Chặn reopen khi hết lượt; hiện message còn lượt | Reopen        |
| VP-4037                | QC Completed    | Edit Order vẫn sửa được khi Reopen/Pending/Cancel                             | Edit bị chặn các state đó                       | Edit Order    |
| VP-4968                | QC Completed    | Edit Order: đổi staff với Manual tip reset tip $0                             | Tip theo staff mới, không reset                 | Edit Order    |
| VP-4965                | QC Completed    | Edit Order: tên service rỗng vẫn lưu                                          | Tên service rỗng bị chặn                        | Edit Order    |
| VP-4964/4963/4973/4972 | QC Completed    | Edit Order: thiếu tag Updated, copy confirm sai, toast đôi, staff ngoài store | Hành vi/copy đúng                               | Edit Order    |
| VP-4913                | QC Completed    | Adjust Tip sau split chọn nguồn tiền                                          | Chọn nguồn tip post-split                       | Adjust Tip    |

### Adjust Tip

| VP-id   | status        | title                                 | test intent                | area       |
| ------- | ------------- | ------------------------------------- | -------------------------- | ---------- |
| VP-2705 | Verified Prod | Tip kẹt "Adjusting tip"               | Adjust tip xong, không kẹt | Adjust Tip |
| VP-4157 | Done          | Adjust tip fail cho mọi merchant user | Adjust tip thành công      | Adjust Tip |
| VP-2808 | Verified Prod | Cho adjust Tip trên order Settled     | Settled adjust tip được    | Adjust Tip |

### Void / Refund / Cancel

| VP-id   | status        | title                                                          | test intent                      | area                 |
| ------- | ------------- | -------------------------------------------------------------- | -------------------------------- | -------------------- |
| VP-4376 | In Review     | GC cancel guard chặn nhầm "insufficient balance" khi code rỗng | Lookup card rỗng không chặn void | Void/Gift Card       |
| VP-3342 | Verified Prod | Hiện refund cũ ở Order History theo ngày refund                | Refund hiện đúng ngày thực hiện  | Order History/Refund |

### Order History / Pending / Scan

| VP-id             | status        | title                                                       | test intent                     | area          |
| ----------------- | ------------- | ----------------------------------------------------------- | ------------------------------- | ------------- |
| VP-4858           | In Review     | Scan order ở Order History mở nhầm order đầu                | Scan mở đúng order              | Order History |
| VP-3262/3595/3379 | Verified Prod | Scan receipt QR không mở được/ký tự thừa "ODER:"            | Scan mở đúng order, parse sạch  | Order History |
| VP-3257           | Verified Prod | Filter Date Completed vẫn hiện Pending/In Use ở tab All     | Completed loại pending          | Order History |
| VP-3256           | Verified Prod | Filter staff search không chính xác                         | Staff search chính xác          | Order History |
| VP-5111           | Todo          | Complete POS pending đánh cắp check-in GoCheckIn cùng khách | Không đánh cắp check-in         | Pending       |
| VP-4286           | Done          | Check-in khách không hiện đủ order ở Pending                | Hiện đủ pending                 | Pending       |
| VP-5120           | QC Testing    | Home header 2 icon ≡, nút "Show pending sidebar" dính       | 1 control rõ ràng, spacing đúng | Home/Pending  |
| VP-2472           | Todo          | Batch-close total gồm cả GC transaction                     | GC loại khỏi total batch-close  | Batch         |

### Home / Create Order / Discount / Points

| VP-id             | status             | title                                                            | test intent                         | area                    |
| ----------------- | ------------------ | ---------------------------------------------------------------- | ----------------------------------- | ----------------------- |
| VP-1418           | QC Completed       | Service update dialog hiện tên cũ sau khi sửa category service   | Dialog hiện tên service đã cập nhật | Home/Settings           |
| VP-1572           | Verified Prod      | Không chọn được staff sau search                                 | Staff chọn được sau search          | Home                    |
| VP-4167           | Verified Prod      | Points gồm cả tip                                                | Points loại tip                     | Points                  |
| VP-4171           | Verified Prod      | GC sale không loại khỏi points                                   | GC sale loại khỏi tính điểm         | Points/Gift Card        |
| VP-4377           | Verified Prod      | Over-award điểm khi card decline trước charge thành công         | Điểm award 1 lần cho charge cuối    | Points                  |
| VP-5112           | QC Testing         | Màn khách "You've earned 1 points" (số ít/nhiều)                 | Đúng số ít/nhiều                    | Customer Display/Points |
| VP-3564/3974/4335 | Verified Prod/Done | Reward hiện trước khi chọn khách / reward $0 / reward không sync | Reward hiện đúng khi đủ điều kiện   | Rewards                 |

### App stability / Sync (Windows)

| VP-id                       | status                    | title                                               | test intent                            | area          |
| --------------------------- | ------------------------- | --------------------------------------------------- | -------------------------------------- | ------------- |
| VP-4187                     | Backlog                   | Volt POS Windows freeze / Not Responding            | App giữ responsive                     | Platform      |
| VP-2735                     | Verified Prod             | Splash crash khi startup error                      | Startup error xử lý, không crash       | Platform      |
| VP-3989                     | Done                      | HttpPuller "database is locked" (code 5)            | Không lỗi DB-lock khi pull             | Platform/Sync |
| VP-3929                     | Verified Prod             | Token hết hạn hiện "contact support" thay vì Login  | Token hết hạn route Login              | Platform      |
| VP-3725/3779/4856/4004/3590 | Verified Prod/In Progress | Stale whole-row push đẩy order đã trả về Pending    | Order settled không bao giờ về Pending | Order/Sync    |
| VP-3341                     | Verified Prod             | POS freeze khi check-in khách mới trên order đã trả | Không freeze                           | Platform      |

### Reports / Income / Payroll (render trên POS) — bugs

| VP-id                  | status        | title                                                                        | test intent                           | area                   |
| ---------------------- | ------------- | ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------- |
| VP-3891/3356           | QC Completed  | Staff Payroll ẩn staff Subtotal≠0 nhưng Total=0                              | Vẫn liệt kê staff đó                  | Payroll                |
| VP-3242                | Verified Prod | Staff Income cột "Card Charge Tip" luôn $0                                   | Khớp V1                               | Income                 |
| VP-4571                | QC Completed  | Working Hours bị làm tròn                                                    | Hiện giờ thật                         | Payroll                |
| VP-4849/4850/4851      | Verified Prod | Report V4 Income Summary: Total $0, detail $0, Date "-", thiếu Print/compare | Tile/detail đúng số + compare + Print | Income (V4 POS)        |
| VP-4852/4853/4891      | Verified Prod | Report V4 Staff Payroll: thiếu Working Days, "x 20.000000%", $0+No data      | Format & nội dung đúng                | Payroll (V4 POS)       |
| VP-4874/4937/4936/4939 | Verified Prod | Report V4 chart axis/tooltip/text khác V1                                    | Axis & tooltip đúng, text khớp V1     | Reports (V4 POS)       |
| VP-4888/4887           | Verified Prod | Export sai filename ngày; CSV chỉ 30 dòng                                    | Filename đúng, export đủ              | Reports/Export         |
| VP-4848                | Verified Prod | POS Data Verification                                                        | Số report POS khớp nguồn dữ liệu      | Reports (verification) |

---

## C. Out-of-scope (Android / Restaurant / Portal / Infra) — liệt kê cho đủ, KHÔNG viết spec Windows

- **Android tablet / device hardware** (D5, P18, P8D, A8, D8, P12 semi, Nebullar): build theo máy, WebView fallback, USB/semi-terminal/cáp/cash-drawer/printer/NFC, pairing & activation, perf/soak. (VP-4645–4931, 4705–4762, 4793–5114, 4542/4544/4549/4586/4772/4773/4804…)
- **P8D UI/UX pixel-QC theo Figma** (VP-3462–3576, 3835–3876, 3641–3875…).
- **Restaurant (R0–R3 / VOLT Dine / POC)**: dine-in, KDS, waiter, counter, table/seat/86, floor plan, kitchen ticket (VP-4211–4300, 4455–5119 Restaurant-labelled…).
- **Portal-web-only**: Report V4 Config builder, device/version/monitor/remote, onboarding, RBAC UI, Checkout-Type Portal, service-reorder Portal (VP-3789/5115/5116…).
- **API / backend / sync / CDC**, **Build/release/CI/Sentry/SSO Keycloak**, **MCP/ChatGPT plugin**.
- **~400 one-off `[Request] Edit OD…` support** = sửa dữ liệu production đơn lẻ (feature phía sau đã nằm ở A/B).
- **i18n string**, **foundational/plumbing cũ**, **Cashback (đã bỏ)**.

---

## D. Coverage hints — issue khớp spec đã có

- **VP-4591** Checkout Type (memory `vp-4591-checkout-type-qc`).
- **VP-4848** POS Data Verification (memory `prod-report-verify-beebee`, `report-v1-vs-v4-routes` — V4 = `/report-pages/v4/*`).
- **VP-4913** Adjust Tip sau split chọn nguồn tiền — đã có spec maintenance.
- **VP-1418** service-update stale name — vùng service editor.
- **VP-1432/1433/1434/1873/2400/2465** — KHÔNG có trong sweep VOLT hiện tại; port từ project **volt-qc** (ngoài team này), coi như đã cover bởi 6 spec `vp-*`.
- Suite đã cover: order-flow TC-01..81, card-payment TC-82..87, payment-flows guards, reopen RO-01..09, gift-card multi-pay/top-up, web→POS sync. Cụm **Edit-Order (VP-4963–4973)** và **Report V4 POS (VP-4849–4891)** đang **mỏng** — ưu tiên bổ sung.
