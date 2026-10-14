---
title: Payment Flows — Tổng hợp test case (Document → Reality) từ Linear VOLT
scope: Split Order · Reopen · Cancel · Refund/Partial Refund · Adjust/Split Tip · Gift Card · Double charge / Charge fail
team: VOLT (VP) — https://linear.app/fastboy/team/VP
sources:
  documents:
    - Order Flow — https://linear.app/fastboy/document/order-flow-1bd212f296da
    - Split Order — https://linear.app/fastboy/document/split-order-a317435c0a01
    - Sell Gift Card — https://linear.app/fastboy/document/sell-gift-card-812b56914491
    - Service Fee — https://linear.app/fastboy/document/service-fee-dedcb36a56e3
    - Order Pending — https://linear.app/fastboy/document/order-pending-caa07c054f23
  reality: ~80 issues VP-* (bug/feature/SS request) quét 2026-10-11
compiled-at: 2026-10-11
status: APPROVED — đã chốt 4 quyết định (xem §9), triển khai theo đợt
decisions:
  - '🔌 fault-injection: KHÔNG làm (không dựng harness gateway/proxy)'
  - '🌙 Settled: lọc order đã Settled sẵn rồi refund (không chờ qua đêm / không seed script)'
  - 'Bug còn mở: vẫn viết test chạy thật, để fail → hiển thị lỗi lên dashboard (không skip/xfail)'
  - 'Task Canceled (VP-3390): bỏ khỏi file, không viết'
---

# Payment Flows — Test Case tổng hợp (Document → Reality)

> **Mục đích:** gộp **đặc tả (document Linear)** và **lỗi thực tế (bug/ticket Linear)** của 7 nhóm
> luồng thanh toán thành một bộ test case thống nhất để bạn review, rồi mới triển khai code E2E
> (WebdriverIO attach — merchant 20258).
>
> **Hai loại case:**
>
> - **SPEC** = hành vi chuẩn lấy từ document (phải đúng theo spec).
> - **GUARD** 🐞 = regression lấy từ bug thực tế (mỗi bug = 1 case canh hồi quy, gắn mã VP-xxxx).
>
> **Chú thích trạng thái chạy được:**
> `✅` chạy được bằng harness hiện tại (cash/read-only) ·
> `💳` cần thẻ thật + terminal (CARD_SETTLE=1) ·
> `🌙` cần order đã **Settled** → **lọc order đã Settled sẵn trong Order History rồi refund** (KHÔNG chờ qua đêm / KHÔNG seed script) ·
> `🖥️` cần **dual-screen** (màn khách — không drive được bằng attach, xem [[orderflow-live-scan-attach]]) ·
> `🔌` cần **fault-injection** — **OUT OF SCOPE** (đã chốt: không dựng harness; xem §7) ·
> `📄` thuần spec, UI chưa dựng/chưa quét.
>
> **Ưu tiên:** P1 (tiền sai / double charge / chặn nghiệp vụ) · P2 · P3 (hiển thị/i18n).

---

## 0. Tổng quan & cách đọc

Mỗi nhóm có 2 phần:

1. **Spec tóm tắt** — trích từ document, là điều kiện ĐÚNG mà test khẳng định.
2. **Bảng case** — cột `Nguồn` phân biệt SPEC vs bug VP-xxxx; cột `Trạng thái ticket` cho biết bug
   đã fix hay còn mở (còn mở ⇒ có thể phải chờ dev fix trước khi test PASS).

Mã TC theo prefix nhóm để không đụng bộ `TC-01..87` đã có trong
[order-flow-test-cases.md](order-flow-test-cases.md):
`SPL` Split · `ROP` Reopen · `CAN` Cancel · `RFD` Refund · `TIP` Tip · `GC` Gift Card ·
`PAY` Payment reliability.

**Bộ đếm nguồn (reality):** ~80 issue VP-* liên quan thanh toán đã quét. Nhóm lớn nhất là
Double charge/Charge fail (>30 ticket, gồm ~19 ticket dọn dữ liệu đơn bị double — KHÔNG thành
E2E case, chỉ là bằng chứng cho các GUARD về reliability).

---

## 1. SPLIT ORDER

### 1.1 Spec tóm tắt (doc _Split Order_ + _Order Flow_)

- Chỉ cho Split khi **Total Order > $5**. Split **không** đổi Order gốc / service / staff /
  commission / promotion / discount / tax / revenue — chỉ là cách **chia thanh toán**.
- **3 method:** Split Equally (N≥2, check cuối bù chênh lệch — VD $100/3 = 33.33/33.33/33.34) ·
  Split by Amount (nhập (N-1) check, check cuối auto = Total − Σ; chặn ≤0, Σ(N-1) < Total,
  check cuối âm) · Split by Items (mỗi item thuộc đúng 1 check; **disable** khi order chỉ 1 item).
- **Tax:** chỉ áp Product; By Items → tax hiển thị trên check chứa Product; Equally/By Amount →
  tax chỉ ở tổng Order.
- **Discount / Service Fee / Cash Discount:** phân bổ theo tỷ lệ Amount của item.
- **Tip:** KHÔNG phân bổ khi split; nhập tại lúc thanh toán từng check; ghi riêng mỗi check.
- **Payment per check:** mỗi check **đúng 1 method** (Card/Cash/Gift Card/Other), không mix trong 1 check.
- **Order status:** ≥1 check đã trả → **Processing**; tất cả check đã trả → **Successful**.
- **Gift Card thiếu balance:** popup hỏi tạo check mới cho phần còn lại — **chỉ hỗ trợ Split by Amount**;
  Equally/By Items không auto-create, phải đổi method hoặc chia lại.
- **Clear check:** xoá được check chưa trả, phải còn tối thiểu 2 check; **không xoá check đã trả**
  (phải Void trước). After payment exists → không đổi split method.
- **Reopen:** giữ nguyên Split Method/Check Structure/Amount/Payment-Tip-Refund-Void History.
- **Refund per check:** Card partial refund không refund Tip; gift card không refund (chỉ Void).
- **Receipt:** không in receipt từng check lúc trả; Order History hỗ trợ xem receipt + chữ ký **từng check**.

### 1.2 Case

| TC        | Loại  | Case                                                                                                  | Nguồn          | Expected                                                                                                         | Ưu tiên | Trạng thái ticket | Chạy |
| --------- | ----- | ----------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | ------- | ----------------- | ---- |
| SPL-01    | SPEC  | Chỉ cho Split khi Total > $5; ≤ $5 ẩn/disable Split                                                   | doc            | Order ≤$5 không vào được split                                                                                   | P1      | —                 | ✅   |
| SPL-02    | SPEC  | 3 method; By Items disable khi order 1 item                                                           | doc (TC-26)    | By Items disabled với 1 item                                                                                     | P1      | —                 | 📄   |
| SPL-03    | SPEC  | Equally N check, check cuối bù lẻ ($100/3 → 33.33/33.33/33.34)                                        | doc (TC-27/28) | Tổng các check = Total                                                                                           | P1      | —                 | 📄   |
| SPL-04    | SPEC  | By Amount: check cuối auto; chặn ≤0 / Σ>Total / check cuối âm                                         | doc (TC-29/30) | Validate đúng, check cuối = Total−Σ                                                                              | P1      | —                 | 📄   |
| SPL-05    | SPEC  | By Items: gán item vào từng check, mỗi item 1 check                                                   | doc (TC-33)    | Check total = Σ item gán                                                                                         | P2      | —                 | 📄   |
| SPL-06    | SPEC  | Mỗi check trả độc lập 1 method; ≥1 trả → Processing, tất cả trả → Successful                          | doc (TC-31/32) | Status chuyển đúng                                                                                               | P1      | —                 | 🌙   |
| SPL-07    | SPEC  | Gift Card thiếu balance (By Amount) → popup tạo check mới cho phần dư                                 | doc            | Chỉ By Amount auto-create; Equally/By Items báo chọn method khác                                                 | P2      | —                 | 💳   |
| SPL-08    | SPEC  | Clear check (còn ≥2 check); không xoá check đã trả                                                    | doc            | Chặn xoá check paid                                                                                              | P2      | —                 | 📄   |
| SPL-R1 🐞 | GUARD | Trả 1 check bằng **Card** → các check còn lại tự nhập lại thành **1 check**                           | **VP-4353**    | Các check còn lại giữ nguyên số lượng/amount; chỉ check vừa trả đổi trạng thái                                   | P1      | Ready to Review   | 💳   |
| SPL-R2 🐞 | GUARD | Gift card thiếu balance "Pay & create new check" → **tip bị gộp vào principal**, biến mất khỏi report | **VP-3788**    | Tip chuyển sang remainder check (`tipAmount`), ghi vào `order.tipAmount` + transaction; tiền khách trả không đổi | P1      | Todo              | 💳   |
| SPL-R3 🐞 | GUARD | Trả check bằng Card: **tip nhập ở cashier không hiện trên màn khách**                                 | **VP-4255**    | Màn khách hiển thị đúng tip của check                                                                            | P2      | Verified Prod     | 🖥️💳 |
| SPL-R4 🐞 | GUARD | Split card: sau Pay **không hiện màn Tip suggestion**                                                 | **VP-4227**    | Hiện màn gợi ý tip trước khi charge                                                                              | P2      | Done              | 💳   |
| SPL-R5 🐞 | GUARD | **Pay button disabled** cho method Card trong split                                                   | **VP-4084**    | Pay enable với Card                                                                                              | P1      | Done              | 💳   |
| SPL-R6 🐞 | GUARD | Card mất kết nối terminal lúc timeout (checkout & split) → POS/FBP lệch transaction                   | **VP-4287**    | Reconcile khớp, không double                                                                                     | P1      | Verified Prod     | 🔌   |
| SPL-R7 🐞 | GUARD | Split Total **tụt** sau khi trả 1 check bằng Cash (SF4/CD4/Tax10: $112.20 → $111.98, thiếu $0.22)     | **VP-4405 #2** | Total = tổng thực thu ($112.20); Print Check khớp                                                                | P1      | Ready to Review   | 🌙   |

---

## 2. REOPEN ORDER

### 2.1 Spec tóm tắt (doc _Order Flow_ §Reopen + _Split Order_ §Re-open)

- **Chỉ reopen 1 lần/order**; status về **Successful − Unsettled**. Order đang reopen mà thoát ra →
  nút đổi thành **Continue Re-open**.
- Bỏ void từng transaction, thay bằng **Void all** (hiện khi sửa service làm số tiền không khớp:
  `totalPaid < new Total`, hoặc thay đổi tax).
- Phải **thanh toán lại thành công** mới Complete/thoát flow reopen.
- **Report effect:** đang reopen → loại khỏi mọi Income/Report; complete lại → tính lại toàn bộ.
- **Field bị ảnh hưởng:** Discount/Promotion/Reward & Tax **khoá theo version cũ**; Service Fee
  **tính lại** theo subtotal mới; Cashback redeem restore rồi apply lại; Cashback earn tính lại.
- **Special case:** đổi method / total thấp hơn / đổi tax → **Void & charge lại**; total cao hơn →
  **charge thêm**; xoá hết staff chỉ còn Store (đã tip) → Void & charge lại; thay toàn bộ service mới →
  cảnh báo recalc rồi tính như order mới. Phải lưu log version trước/sau reopen.
- **Allowed khi reopen:** Customer info, Note, metadata (không ảnh hưởng Amount). Với **split**:
  không Add/Remove item, không đổi price/qty/discount/promotion/tax/fee/check amount/split method.

### 2.2 Case

| TC         | Loại  | Case                                                                                                                                                                                                                | Nguồn                | Expected                     | Ưu tiên | Trạng thái ticket       | Chạy |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------- | ------- | ----------------------- | ---- |
| ROP-01     | SPEC  | Chỉ reopen 1 lần; lần 2 nút là Continue/ẩn                                                                                                                                                                          | doc + VP-2585        | Không reopen lần 2           | P1      | QC Completed            | 🌙   |
| ROP-02     | SPEC  | Void all xuất hiện khi totalPaid < newTotal hoặc đổi tax                                                                                                                                                            | doc                  | Hiện Void all đúng điều kiện | P1      | —                       | 🌙   |
| ROP-03     | SPEC  | Reopen chỉ cho sửa service/product/staff 1 lần (price/items/staff)                                                                                                                                                  | VP-2585              | Sửa đúng 1 lần               | P1      | QC Completed            | 🌙   |
| ROP-04     | SPEC  | Field khoá theo version cũ (discount/promo/reward/tax); SF tính lại                                                                                                                                                 | doc                  | Khoá đúng field              | P1      | —                       | 🌙   |
| ROP-R1 🐞  | GUARD | **Reopen không giới hạn số lần** dù đã hết lượt sửa (`reopenEditCount`)                                                                                                                                             | **VP-3913**          | Chỉ 1 lần                    | P1      | QC Completed            | 🌙   |
| ROP-R2 🐞  | GUARD | Nút Re-Open không hiện message "còn lượt sửa" khi order còn lượt                                                                                                                                                    | **VP-3914**          | Hiện message còn lượt        | P2      | QC Completed            | 🌙   |
| ROP-R3 🐞  | GUARD | Reopen sau settle split (Cash+Other) → **số lẻ phải trả thêm 1 lần nữa**                                                                                                                                            | **VP-4067**          | Không phát sinh số lẻ        | P1      | QC Completed            | 🌙   |
| ROP-R4 🐞  | GUARD | Reopen +service, trả Cash → Cash/Other hiện **$110.17** thay vì **$110.00** (dư $0.17)                                                                                                                              | **VP-4013**          | Total = $110.00              | P1      | QC Completed            | 🌙   |
| ROP-R5 🐞  | GUARD | Reopen +item: **Card tax tính sai base** (thiếu Service Fee), Card ≠ Cash/Other                                                                                                                                     | **VP-4012**          | Card khớp Cash/Other         | P1      | QC Completed            | 🌙💳 |
| ROP-R6 🐞  | GUARD | Reopen +service (Card): **Total sai khi có Service Fee + Tax**                                                                                                                                                      | **VP-3957**          | Total đúng                   | P1      | QC Completed            | 🌙💳 |
| ROP-R7 🐞  | GUARD | Reopen +service (Cash): bỏ qua tax service mới → **$67.20 thay vì $68.20**                                                                                                                                          | **VP-3931**          | Total = $68.20               | P1      | QC Completed            | 🌙   |
| ROP-R8 🐞  | GUARD | Reopen +Product (Card): **product tax không apply** (OK cho Store/service)                                                                                                                                          | **VP-4079**          | Tax apply cho Product        | P1      | QC Completed            | 🌙💳 |
| ROP-R9 🐞  | GUARD | Reopen recompute phải theo **toggle gift-card service fee đã lưu** của order                                                                                                                                        | **VP-4077**          | Recompute đúng toggle        | P2      | QC Completed            | 🌙   |
| ROP-R10 🐞 | GUARD | **Edit Order vẫn cho sửa** khi order ở Reopen/Pending/Cancel                                                                                                                                                        | **VP-4037**          | Chặn edit ở các status này   | P1      | QC Completed            | 🌙   |
| ROP-R11 🐞 | GUARD | Reopen: **xoá customer rồi thêm customer mới không thành công**                                                                                                                                                     | **VP-3982**          | Thêm customer mới OK         | P1      | QC Completed            | 🌙   |
| ROP-R12 🐞 | GUARD | Reopen làm **visit customer +1** (tổng 2 thay vì 1)                                                                                                                                                                 | **VP-3969**          | Visit không tăng             | P2      | Done                    | 🌙   |
| ROP-R13 🐞 | GUARD | Reopen cập nhật point & checkinAndCheckout theo point model mới                                                                                                                                                     | **VP-4085**, VP-3200 | Point đúng sau re-complete   | P1      | QC Completed / Verified | 🌙   |
| ROP-R14 🐞 | GUARD | **PR#2175 side effects** (chùm lỗi): lệch 1¢ tax ($20.67 vs $20.66); split Total sai; **điểm không thu hồi** khi P8D→Windows reopen bỏ/đổi customer; Home tổng dòng ≠ Subtotal khi có SF; Quick Pay $25 hiện $27.50 | **VP-4405**          | Xem 7 AC trong ticket        | P1      | Ready to Review         | 🌙💳 |

> ROP-R14 là ticket lớn nhất của nhóm reopen, nhiều sub-case (mục 1–5). Khi implement nên tách
> thành ROP-R14a..e theo từng mục; một số cần PO chốt (cách làm tròn tax, Quick Pay hiện số nào).

---

## 3. CANCEL ORDER

### 3.1 Spec tóm tắt (doc _Order Flow_ §Order workflow)

- Cancel (chỉ ở **Successful − Unsettled** theo action-table) → **void toàn bộ payment** → status
  **Canceled** (xám). Yêu cầu **staff code** + **reason** (list reason có sẵn).
- Gift Card method: Cancel/Void → **tự động hoàn balance** đã trả về gift card.
- **Cancel Issue:** order nhiều payment, 1 payment cancel FAIL → order mark **Cancel Issue**
  (Portal không retry, phải Cancel lại thủ công payment đó).
- Cancel Information trong detail: Amount / Date&Time / By Staff / Reason.

### 3.2 Case

| TC        | Loại  | Case                                                                                | Nguồn                       | Expected                                      | Ưu tiên | Trạng thái ticket | Chạy                      |
| --------- | ----- | ----------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------- | ------- | ----------------- | ------------------------- |
| CAN-01    | SPEC  | Cancel void tất cả payment → Canceled; reason + staff code bắt buộc                 | doc (TC-64)                 | Dialog "All payments will be voided" + reason | P1      | —                 | ✅ (dialog, không submit) |
| CAN-02    | SPEC  | Gift Card: Cancel/Void auto-restore balance                                         | doc                         | Balance gift card được hoàn                   | P1      | —                 | 💳                        |
| CAN-03    | SPEC  | Cancel Issue khi 1 payment cancel fail                                              | doc                         | Status = Cancel Issue                         | P2      | —                 | 🔌                        |
| CAN-R1 🐞 | GUARD | Cancel order **nhiều thanh toán gift card** → hoàn balance gift card **sai**        | **VP-3727**                 | Hoàn đúng balance từng gift card              | P1      | Verified Prod     | 💳                        |
| CAN-R2 🐞 | GUARD | POS hiện **Canceled/Refunded** trong khi P8D vẫn **Canceling/Refunding**            | **VP-3374**                 | Status đồng bộ 2 đầu                          | P2      | Done              | 🌙                        |
| CAN-R3 🐞 | GUARD | Order **kẹt Canceling** khi batch close chạy giữa lúc cancel; staff income vẫn tính | **VP-3278**                 | Không kẹt; income không tính đơn canceled     | P1      | Verified Prod     | 🌙                        |
| CAN-R4 🐞 | GUARD | Edit Order cho sửa khi order đang Cancel                                            | **VP-4037** (chung ROP-R10) | Chặn edit                                     | P1      | QC Completed      | 🌙                        |

> Spec gốc cancel/refund/partial refund: VP-840 (Backlog), VP-932 (Backlog), VP-594 (Done BE),
> VP-4010 (API Delete Cash Order — In Progress). VP-2396 Cashback Revert (cancel/refund) đã **Canceled**.

---

## 4. REFUND / PARTIAL REFUND

### 4.1 Spec tóm tắt (doc _Order Flow_ §Refund + _Split Order_ §Refund Rules)

- Chỉ thực hiện ở **Successful − Settled**. Nếu còn credit transaction **chưa Batch/Close** →
  **disable Refund** + alert "Refund Not Available" (enable lại khi tất cả card tx đã batch close).
- **1 form "Refund" gộp**: chọn All = **Full Refund** (autofill = total order); chọn 1 phần =
  **Partial Refund** (autofill = giá service được chọn). Refund method: Cash/Card/Other
  (**không Gift Card** — gift card chỉ Void). Reason optional.
- **Refund trên giá sau discount** (phân bổ % discount cho từng service); **Promotion giữ nguyên**
  dù partial refund kéo tổng xuống dưới ngưỡng ("thu bao nhiêu trả bấy nhiêu").
- Payment **Auth + Tip**: partial refund chỉ hết **base amount**, KHÔNG refund Tip. Payment **Sale**:
  refund tới hết **Amount + Tip**.
- Nhiều lần partial → hết amount → **Refunded**; 1 phần → **Partial Refunded**; refund card FAIL →
  **Refund Issue** (Portal retry thành Refunded thì order update lại).
- Split: partial refund **trên từng check**; nếu 1 item lớn hơn các check hiện có → chỉ cho full refund.

### 4.2 Case

| TC        | Loại  | Case                                                                         | Nguồn           | Expected                                    | Ưu tiên | Trạng thái ticket | Chạy |
| --------- | ----- | ---------------------------------------------------------------------------- | --------------- | ------------------------------------------- | ------- | ----------------- | ---- |
| RFD-01    | SPEC  | Refund chỉ ở Settled; card chưa batch → disable + alert                      | doc             | Alert "Refund Not Available"                | P1      | —                 | 🌙   |
| RFD-02    | SPEC  | Chọn All = Full (autofill total); chọn phần = Partial (autofill giá service) | doc (TC-60..63) | Autofill đúng                               | P1      | —                 | 🌙   |
| RFD-03    | SPEC  | Refund theo giá sau discount; promotion giữ nguyên                           | doc             | VD discount $20/$200: refund service1 = $90 | P1      | —                 | 🌙   |
| RFD-04    | SPEC  | Auth+Tip: partial refund không refund Tip; Sale: refund tới Amount+Tip       | doc             | Auth chặn refund tip                        | P1      | —                 | 🌙💳 |
| RFD-05    | SPEC  | Gift Card không refund (chỉ Void)                                            | doc             | Gift Card không xuất hiện ở refund method   | P2      | —                 | 💳   |
| RFD-06    | SPEC  | Nhiều lần partial → Refunded; fail card → Refund Issue                       | doc             | Status chuyển đúng                          | P2      | —                 | 🔌   |
| RFD-R1 🐞 | GUARD | Partial refund: **vẫn sửa được service của staff đã refund** và báo lỗi      | **VP-4051**     | Chặn edit service đã refund                 | P1      | QC Completed      | 🌙   |
| RFD-R2 🐞 | GUARD | P8D hiện **"Refunding"** trong khi POS đã Refunded/Partial Refund            | **VP-3109**     | Status đồng bộ                              | P2      | Done              | 🌙   |
| RFD-R3 🐞 | GUARD | Refund order cũ phải hiện trong **Order History của ngày refund**            | **VP-3342**     | Order refund xuất hiện đúng ngày            | P2      | Verified Prod     | 🌙   |
| RFD-R4 🐞 | GUARD | Service Tax phản ánh đúng ở **cancel/refund/order history/receipt**          | **VP-3335**     | Tax đúng mọi nơi                            | P2      | Verified Prod     | 🌙   |

> Liên quan: VP-2676 Manual Refund Cash/Other (Todo), VP-4073 Portal E2E refund/cancel/tip
> (QC Completed) — có thể tham khảo golden expected từ bộ Portal.

---

## 5. ADJUST TIP & SPLIT TIP

### 5.1 Spec tóm tắt (doc _Order Flow_ §Adjust Tip + §Split Tip)

- **Adjust Tip** chỉ khi order **Successful − Unsettled**, payment **Card (status Auth) / Cash / Other**
  (**KHÔNG** Gift Card). Order nhiều method → phải **chọn 1 method** để adjust. Sau adjust, order
  nhiều staff → **auto re-split** tip. Chỉ cho add tip khi order có Staff.
- **Split Tip** 3 mode: **Split Evenly** (chia đều, remainder dồn người cuối: 3 staff/$10 →
  3.4/3.4/3.2) · **Proportion** (theo (service/total)×tip) · **Manual** (nhập tay, tổng = Total Tip).
  Ẩn khi order 1 staff. Hiện ở Payment Successful (reception) và Order Detail (Successful−Unsettled).

### 5.2 Case

| TC        | Loại  | Case                                                                           | Nguồn           | Expected                          | Ưu tiên | Trạng thái ticket | Chạy |
| --------- | ----- | ------------------------------------------------------------------------------ | --------------- | --------------------------------- | ------- | ----------------- | ---- |
| TIP-01    | SPEC  | Adjust Tip chỉ Unsettled + Card(Auth)/Cash/Other, không Gift Card              | doc (TC-69)     | Gift Card ẩn Adjust Tip           | P1      | —                 | 🌙   |
| TIP-02    | SPEC  | Order nhiều method → chọn 1 method để adjust                                   | doc (TC-70)     | Bắt chọn method                   | P2      | —                 | 🌙   |
| TIP-03    | SPEC  | Split Tip 3 mode (Evenly/Proportion/Manual), ẩn khi 1 staff                    | doc (TC-34..38) | 3 tab + Confirm; tổng = Total Tip | P2      | —                 | ✅   |
| TIP-R1 🐞 | GUARD | Adjust Tip **prefill tip cũ** thay vì bắt đầu **$0**                           | **VP-3936**     | Bắt đầu $0                        | P2      | Done              | 🌙   |
| TIP-R2 🐞 | GUARD | Adjust Tip cho nhập tip ≤ tip gốc, **chỉ fail lúc processing**                 | **VP-3935**     | Validate ngay khi nhập            | P2      | Done              | 🌙   |
| TIP-R3 🐞 | GUARD | **Adjust tip fail cho mọi merchant user**                                      | **VP-4157**     | Adjust tip thành công             | P1      | Done              | 🌙💳 |
| TIP-R4 🐞 | GUARD | Tính **point đang bao gồm tiền tip**                                           | **VP-4167**     | Point loại trừ tip                | P1      | Verified Prod     | 🌙   |
| TIP-R5 🐞 | GUARD | Modal Split Tip tab "Split Evenly" **hiển thị sai giá trị ban đầu** khi vừa mở | **VP-4192**     | Giá trị đúng ngay khi mở          | P2      | In Review         | 🌙   |
| TIP-R6 🐞 | GUARD | Tip **luôn Proportion** trên đơn P8D-completed dù setting Split Evenly         | **VP-3976**     | Honor setting                     | P2      | Done              | 🌙   |
| TIP-R7 🐞 | GUARD | Card + Split tip **kẹt processing → Payment Failed**                           | **VP-4209**     | Thanh toán thành công             | P1      | Done              | 💳   |
| TIP-R8 🐞 | GUARD | Thiếu **Split Tip** cho order Successful-Unsettled có Tip trong Order History  | **VP-3884**     | Có action Split Tip               | P2      | Done              | 🌙   |

---

## 6. GIFT CARD (bán & thanh toán)

### 6.1 Spec tóm tắt (doc _Sell Gift Card_ + _Split Order_ §Gift Card)

- Gift Card là **prepaid product**; doanh thu ghi nhận lúc **redeem** (không phải lúc bán).
- Status: **Not sold yet** → (complete order bán) **Active** → **Used up** (balance 0) → **Inactive**.
- Bán: category Gift Card → nhập/scan code → **GIFT CARD VALUE** (custom max **$10,000**, quick
  $25/$50/$100) + **Bonus** (%/$ tặng thêm) / **Discount** (%/$ giảm tiền trả) → **BALANCE = VALUE + Bonus**.
- Gift Card gắn **Store** (WhmcsID), không gắn customer/staff; 1 gift card chỉ nằm trong **1 order
  processing** tại một thời điểm.
- **Loại Gift Card Sale khỏi Service Fee / Cash Discount / Promotion / Point** (các quy tắc đã chốt).
- Thanh toán bằng Gift Card: validate balance realtime; **không refund** (chỉ Void auto-restore balance).
- Split: gift card per check (balance rules, remainder check, **no tip** — VP-3584).

### 6.2 Case

| TC        | Loại  | Case                                                                                        | Nguồn       | Expected                           | Ưu tiên | Trạng thái ticket | Chạy |
| --------- | ----- | ------------------------------------------------------------------------------------------- | ----------- | ---------------------------------- | ------- | ----------------- | ---- |
| GC-01     | SPEC  | Bán gift card: VALUE + Bonus/Discount → Balance = VALUE+Bonus                               | doc         | Balance đúng công thức             | P1      | —                 | ✅   |
| GC-02     | SPEC  | Custom value max $10,000; quick $25/$50/$100                                                | doc         | Chặn > $10,000                     | P2      | —                 | ✅   |
| GC-03     | SPEC  | Thanh toán gift card validate balance realtime; đủ/không đủ                                 | doc         | Đủ → tiếp; thiếu → popup/thông báo | P1      | —                 | 💳   |
| GC-04     | SPEC  | Gift Card không refund (chỉ Void restore balance)                                           | doc         | Không có refund gift card          | P2      | —                 | 💳   |
| GC-R1 🐞  | GUARD | Redemption **amount mismatch** + redemption **không link** tới order transaction            | **VP-3565** | Amount khớp + link đúng tx         | P1      | Verified Prod     | 💳   |
| GC-R2 🐞  | GUARD | (chung SPL-R2) Partial redemption split **mất tip của check**                               | **VP-3788** | Tip giữ trên remainder check       | P1      | Todo              | 💳   |
| GC-R3 🐞  | GUARD | (chung CAN-R1) Cancel nhiều gift card → hoàn balance **sai**                                | **VP-3727** | Hoàn đúng từng gift card           | P1      | Verified Prod     | 💳   |
| GC-R4 🐞  | GUARD | Scan hiện **Active** nhưng "**Invalid gift card number**" khi add value                     | **VP-3547** | Add funds thành công               | P1      | Done              | 💳   |
| GC-R5 🐞  | GUARD | Scan **chỉ chạy lần đầu**, "Scan again" không ra kết quả                                    | **VP-3910** | Scan lại luôn ra kết quả           | P2      | Done              | ✅   |
| GC-R6 🐞  | GUARD | Gift card sale **không bị loại khỏi tính point** (tax bị chia tỷ lệ, thiếu 5 point)         | **VP-4171** | Point loại trừ gift card sale      | P1      | Verified Prod     | 🌙   |
| GC-R7 🐞  | GUARD | Gift Card **giá bị giảm $105 → $104.75** khi apply Promotion dù promo không apply gift card | **VP-4160** | Giá gift card giữ $105             | P1      | Verified Prod     | ✅   |
| GC-R8 🐞  | GUARD | Loại Gift Card Sale khỏi **Service Fee & Cash Discount**                                    | **VP-3827** | GC Sale không tính SF/CD           | P1      | Verified Prod     | ✅   |
| GC-R9 🐞  | GUARD | GC Sale **vẫn bị tính Service Fee** dù CD                                                   | **VP-3812** | GC Sale không tính SF              | P1      | In Progress       | ✅   |
| GC-R10 🐞 | GUARD | Scan gift card **không hiện Transaction History**                                           | **VP-3235** | Hiện lịch sử giao dịch             | P3      | Ready to Review   | ✅   |

---

## 7. PAYMENT RELIABILITY — Double charge / Charge fail

> ⛔ **OUT OF SCOPE (đã chốt — quyết định (a)):** KHÔNG dựng lane fault-injection (VP-4414). Các case
> `🔌` dưới đây giữ lại **chỉ để tham chiếu regression risk**, KHÔNG implement E2E. Lý do: chúng là lỗi
> timing mạng / gateway / terminal, không tái hiện được bằng happy-path, cần proxy inject fault hoặc
> firewall DROP mà ta không dựng.
>
> **Vẫn làm trong nhóm này:** chỉ các case **không** gắn 🔌 — tức canh phần **UI/status hiển thị** và
> **log/last-4** bằng order đã Settled (🌙) hoặc read-only (✅): **PAY-R11, PAY-R17, PAY-R18, PAY-R19**.

### 7.1 Spec/nguyên tắc (doc _Order Flow_ §Handling Network Disconnects + các ticket fix)

- Card mất mạng giữa chừng: cho trả offline bằng Cash; "Try again" khi online → nếu xuất hiện
  transaction card mới → Complete payment (không tạo tx $0), **khoá nút back**; nếu không → trả method khác.
- Sau thanh toán **luôn check Order History** để void transaction trùng (đảm bảo consistency tiền).
- Nguyên tắc chống double charge (từ fix): **sale timeout ≤10–15s** (ngắn hơn cửa sổ ARPC reader);
  **charge trên fresh connection** (không reuse pooled socket); **không auto-retry charge** (không idempotent);
  **verify-by-reference** sau timeout (GET tìm payment Settled → approve thay vì charge lại);
  **cross-check**: reader Approved nhưng online-auth không success → báo **FAILED**.

### 7.2 Case

| TC         | Loại  | Case                                                                                                   | Nguồn          | Expected                                                                                | Ưu tiên | Trạng thái ticket | Chạy |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------- | ------- | ----------------- | ---- |
| PAY-01     | SPEC  | Card mất mạng → trả offline Cash; Try again reconcile; khoá back                                       | doc (TC-52/53) | 2 nhánh xử lý đúng                                                                      | P1      | —                 | 🔌   |
| PAY-R1 🐞  | GUARD | **Phantom payment**: order Successful trong khi charge failed/never sent                               | **VP-2919**    | Reader Approved nhưng online-auth fail → POS FAILED; timeout ≤15s; order không complete | P1      | Verified Prod     | 🔌   |
| PAY-R2 🐞  | GUARD | Bamboo **charged nhưng báo failed sau đúng 19s** (stale pooled connection) → cashier chạy lại → double | **VP-4338**    | 2 charge cách ~70s đều success; không còn fail 19s                                      | P1      | Done              | 🔌   |
| PAY-R3 🐞  | GUARD | **Double charge** sau terminal disconnect, outcome UNKNOWN (Semi mode)                                 | **VP-4168**    | Không double; reconcile                                                                 | P1      | Done              | 🔌   |
| PAY-R4 🐞  | GUARD | (chung SPL-R6) POS/FBP lệch transaction sau terminal disconnect lúc timeout                            | **VP-4287**    | Reconcile khớp                                                                          | P1      | Verified Prod     | 🔌   |
| PAY-R5 🐞  | GUARD | Card **success trên FBP nhưng POS báo Failed/Decline** → double charge + double income                 | **VP-2828**    | POS nhận charge success; không double income                                            | P1      | Verified Prod     | 🔌   |
| PAY-R6 🐞  | GUARD | Semi mode: đóng popup card-read error → Android **kẹt awaiting payment** → charge lặp                  | **VP-4087**    | Không charge lặp                                                                        | P1      | Done              | 🔌🖥️ |
| PAY-R7 🐞  | GUARD | Charge success trên FBP nhưng POS **bắt thanh toán lại** khi complete                                  | **VP-4195**    | POS nhận diện đã charge                                                                 | P1      | Verified Prod     | 🔌   |
| PAY-R8 🐞  | GUARD | OD vẫn **Pending** dù transaction Charge Success, POS đòi charge lại                                   | **VP-4334**    | POS nhận diện transaction đã success                                                    | P1      | Todo              | 🔌   |
| PAY-R9 🐞  | GUARD | Card transaction hiện **Processing** status sau charge                                                 | **VP-4356**    | Chuyển trạng thái đúng                                                                  | P2      | Verified Prod     | 🔌   |
| PAY-R10 🐞 | GUARD | **Loyalty point over-awarded** khi có lần charge bị decline trước lần success                          | **VP-4377**    | Point tính đúng 1 lần                                                                   | P1      | Verified Prod     | 🔌   |
| PAY-R11 🐞 | GUARD | Complete flow **re-push stale snapshot** → đơn đã trả revert về Pending                                | **VP-3725**    | Không revert                                                                            | P1      | Verified Prod     | 🌙   |
| PAY-R12 🐞 | GUARD | Double charge $150 khi thanh toán card                                                                 | **VP-3591**    | Không double                                                                            | P1      | In Progress       | 🔌   |
| PAY-R13 🐞 | GUARD | Fix double charge: 10s CHARGE_TIMEOUT + verify-by-reference                                            | **VP-3958**    | Timeout→verify→approve, không charge lại                                                | P1      | Done              | 🔌   |
| PAY-R14 🐞 | GUARD | Handle Double Charge **Warning** cho Magensa payment                                                   | **VP-2214**    | Hiện cảnh báo double charge                                                             | P2      | Todo              | 🔌   |
| PAY-R15 🐞 | GUARD | Card read error "Try again/Cancel" chỉ hiện trên P8D, **không trên cashier**                           | **VP-4169**    | Hiện cả 2 màn                                                                           | P2      | Ready to Review   | 🖥️   |
| PAY-R16 🐞 | GUARD | Cho cashier **rời màn card an toàn** khi reader đang chờ                                               | **VP-4133**    | Rời màn không kẹt                                                                       | P2      | Backlog           | 🖥️   |
| PAY-R17 🐞 | GUARD | Hiển thị **4 số cuối card** + lưu **log payment failed**                                               | **VP-4511**    | UI last-4 + log fail                                                                    | P2      | Todo              | ✅   |
| PAY-R18 🐞 | GUARD | Payment Details **không ghi thẻ success**, chỉ hiện các lần charge fail                                | **VP-3063**    | Ghi nhận charge success                                                                 | P2      | Verified Prod     | 🌙   |
| PAY-R19 🐞 | GUARD | Order **Successful** nhưng Payment Detail báo **Failed**                                               | **VP-2825**    | Detail khớp order status                                                                | P2      | Verified Prod     | 🌙   |

> **Dữ liệu dọn dẹp (không phải E2E case):** VP-2837 (sweep 19 đơn double-charge) và ~15 ticket
> VP-284x/285x "Resolve double charge for OD..." là remediation production — dùng làm bằng chứng
> cho các GUARD ở trên, không viết thành test. VP-4208/VP-4044/VP-4038 là hạ tầng log/index/settle hỗ trợ.

---

## 8. Đối chiếu với suite hiện có & khoảng trống

- Bộ `TC-01..87` trong [order-flow-test-cases.md](order-flow-test-cases.md) + các spec
  `charge-*-matrix*.spec.ts`, `split-order*.spec.ts`, `reopen.spec.ts`, `refund.spec.ts`,
  `adjust-tip.spec.ts`, `gift-card-payment.spec.ts` đã phủ phần **SPEC (happy-path)**.
- **Phần GUARD 🐞 (regression từ bug) hầu như CHƯA có** — đây là phần mới cần bổ sung.
- Điều kiện chạy sau khi chốt 4 quyết định:
  - `💳` card thật cần `CARD_SETTLE=1` (đã bật ở `.env.dev`) + terminal 20258 — xem [[card-settle-default-env-dev]].
  - `🌙` cần order đã Settled → **lọc order Settled sẵn trong Order History rồi refund** (không chờ qua đêm/seed).
  - `🔌` fault-injection → **OUT OF SCOPE**, không implement (xem §7).
  - Bug còn mở → **vẫn viết test chạy thật**; test fail = bug còn sống, hiển thị đỏ trên dashboard
    ([[run-dashboard]]) làm bằng chứng regression — KHÔNG skip/xfail.

## 9. Thứ tự triển khai (ĐÃ CHỐT)

**Quyết định đã chốt (2026-10-11):**

- **(a) 🔌 fault-injection: KHÔNG làm.** Bỏ toàn bộ case gắn 🔌 (giữ trong doc để tham chiếu, không code).
- **(b) 🌙 Settled: lọc order đã Settled rồi refund** — thêm filter `status = Settled` trong Order History,
  pick order đủ điều kiện, chạy refund flow trên đó. Không chờ qua đêm, không viết seed script.
- **(c) Bug còn mở: viết test chạy thật, để fail** → dashboard hiện đỏ làm bằng chứng. Không skip/xfail.
- **(d) Task Canceled (VP-3390 / cũ là SPL-R8): đã bỏ khỏi file.**

**Thứ tự đợt:**

1. **Đợt 1 — GUARD ✅ chạy ngay (cash/read-only, không cần terminal):**
   GC-R5, GC-R7, GC-R8, GC-R9, GC-R10, PAY-R17, CAN-01 (dialog), TIP-03.
2. **Đợt 2 — GUARD 🌙 (lọc order Settled + refund) & Unsettled:**
   RFD-01..06, RFD-R1..R4, ROP-R1..R13, TIP-R1/R2/R4/R5/R6/R8, CAN-R2/R3/R4,
   GC-R6, PAY-R11/R18/R19.
3. **Đợt 3 — GUARD 💳 thẻ thật (terminal 20258):**
   SPL-R1/R2/R3/R4/R5/R7, GC-R1/R2/R3/R4, TIP-R3/R7, CAN-R1/R2.
4. **Đợt 4 — OUT OF SCOPE (không code, chỉ ghi nhận risk):**
   toàn bộ case 🔌 (PAY-R1..R10/R12..R16, SPL-R6, CAN-03, RFD-06, PAY-01) và các case 🖥️ thuần
   dual-screen (SPL-R3 nếu không drive được màn khách, PAY-R6/R15/R16).

> Mỗi đợt code xong chạy qua dashboard ([[run-dashboard]]); case bug-còn-mở fail là đúng kỳ vọng
> (bằng chứng bug), ghi chú trong test để không bị nhầm là lỗi harness.
