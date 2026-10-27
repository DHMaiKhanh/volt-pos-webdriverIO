# Card Charge (Staff Card Charge — Commission & Tip) — Test Cases

Nguồn logic tham chiếu: `.claude/skills/income-v2-report/references/formulas.md` (mục Staff Card Charge, TOTAL STAFF PAYOUT, TOTAL EARNING).

Công thức gốc:

- `Staff Card Charge — Commission = (Σ service$ paid by Card − Σ supply$ trên các service đó) × Svc% × card_comm%`
- `Staff Card Charge — Tip = card-paid tip × card_tip%`
- Chỉ áp dụng cho staff có **active path = Commission** (Commission+Salary chỉ bị charge khi commission > salary; Salary-active thì KHÔNG BAO GIỜ bị charge dù có tip trả bằng card).
- `TOTAL STAFF PAYOUT = Commission + Tips + Salary − Cleanup − Discount Charge − Card Charge(Comm+Tip)`
- `TOTAL EARNING (Salon) = Net Earnings + Staff Supply Share + Cleanup + Discount Charge − Salary + Card Charge(Comm+Tip)`

---

## A. CASE TỐT (Good / Expected-correct cases)

| #   | Case                                                             | Điều kiện                                                          | Kết quả mong đợi                                                                                  |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A1  | Commission staff, order trả bằng Card                            | Staff active = Commission; order service trả 100% Card             | Bị charge cả Card Charge – Commission và Tip (nếu tip cũng trả Card)                              |
| A2  | Commission staff, order trả bằng Cash                            | Staff active = Commission; service + tip đều trả Cash              | Card Charge = $0 (không có phần nào trả card)                                                     |
| A3  | Commission staff, order trả bằng Gift Card                       | Payment method = Gift Card                                         | Card Charge = $0 (Gift Card không tính là "Card" chịu phí)                                        |
| A4  | Commission staff, order Split Payment (1 phần Card, 1 phần Cash) | VD 60% Card / 40% Cash                                             | Chỉ phần service$ trả bằng Card được đưa vào công thức Card Charge – Commission                   |
| A5  | Commission staff có Supply Fee trên service trả Card             | service$ Card = 100, supply$ = 10                                  | Card-paid commission = (100 − 10) × Svc%; Card Charge tính trên phần đã trừ supply                |
| A6  | Tip trả Card, service trả Cash                                   | tip = Card, service = Cash                                         | Chỉ Card Charge – Tip phát sinh; Card Charge – Commission = $0                                    |
| A7  | Commission+Salary staff, Commission > Salary trong kỳ            | active path = Commission (vì commission thắng)                     | Áp dụng card charge như staff Commission thuần                                                    |
| A8  | Salary staff nhận tip qua Card                                   | active = Salary                                                    | Card Charge = $0 dù tip trả Card (đúng theo rule "Salary-active never card-charged")              |
| A9  | Refund order (đã card-charge trước đó)                           | Order gốc trả Card, sau đó bị refund toàn phần                     | Card Charge của phần doanh thu bị refund phải được reverse/loại khỏi kỳ tính, không double-charge |
| A10 | Nhiều order Card trong kỳ, staff không có order nào Cash         | Tổng hợp đúng Σ service$ Card qua nhiều order                      | Card Charge = tổng tất cả các order Card, khớp số report                                          |
| A11 | Staff Commission có card_comm% = 0% (cấu hình tắt phí)           | card_comm% = 0                                                     | Card Charge – Commission = $0 dù trả Card 100%                                                    |
| A12 | Staff Commission không có order nào trong kỳ                     | Không có order                                                     | Card Charge = $0, không lỗi/NaN                                                                   |
| A13 | TOTAL STAFF PAYOUT trừ đúng Card Charge                          | Payout = Commission+Tips+Salary−Cleanup−Discount−CardCharge        | Số cuối cùng phải khớp, Card Charge bị trừ đúng 1 lần                                             |
| A14 | TOTAL EARNING (Salon) cộng lại đúng Card Charge                  | Salon Earning = Net+SupplyShare+Cleanup+Discount−Salary+CardCharge | Salon nhận lại phần card charge đã trừ của staff                                                  |

## B. CASE XẤU (Bad / Edge / Bug-prone cases)

| #   | Case                                                                                       | Vấn đề có thể xảy ra                                                          | Kỳ vọng hệ thống phải xử lý đúng                                                                         |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| B1  | Salary-active staff bị charge nhầm khi có tip Card                                         | Bug: hệ thống charge card fee cho staff salary                                | Phải = $0, vì rule là chỉ Commission-active mới bị charge                                                |
| B2  | Commission+Salary staff, Salary > Commission nhưng vẫn bị charge                           | Bug: nhầm active path                                                         | Không được charge vì active path lúc này là Salary                                                       |
| B3  | Order refund một phần nhưng Card Charge không được điều chỉnh giảm                         | Bug: charge tính trên doanh thu gốc, không trừ phần refund                    | Card Charge phải tính trên NET (sau refund), không double count                                          |
| B4  | Supply Fee bị trừ 2 lần (1 lần ở Commission, 1 lần ở Card Charge)                          | Bug double-deduction                                                          | Supply chỉ được trừ đúng 1 lần trước khi nhân card_comm%                                                 |
| B5  | Split payment: toàn bộ order bị tính là "Card" dù chỉ 1 phần là Card                       | Bug: không phân bổ theo tỷ lệ                                                 | Chỉ phần thực trả bằng Card mới đưa vào công thức                                                        |
| B6  | Gift Card bị nhầm là "Card" và bị charge phí                                               | Bug: nhầm payment type                                                        | Gift Card phải loại trừ, không tính phí                                                                  |
| B7  | Tip trả Cash nhưng bị tính vào Card Charge – Tip                                           | Bug: gộp sai loại thanh toán                                                  | Chỉ tip trả thực sự bằng Card mới bị tính                                                                |
| B8  | card_comm% hoặc card_tip% để trống/null                                                    | Bug: crash hoặc tính ra NaN                                                   | Phải fallback về 0% hoặc báo lỗi rõ ràng, không crash                                                    |
| B9  | Staff đổi active path giữa kỳ (VD giữa kỳ payroll từ Salary sang Commission)               | Bug: tính card charge sai theo path cũ                                        | Phải tính theo active path tại thời điểm order diễn ra hoặc theo path cuối kỳ tùy business rule đã chốt  |
| B10 | Order có nhiều staff cùng phục vụ (multi-staff service)                                    | Bug: card charge tính trùng lặp trên toàn bộ order cho mỗi staff              | Mỗi staff chỉ bị charge trên phần service$ họ thực hiện                                                  |
| B11 | Card Charge âm (do tính sai công thức trừ supply)                                          | Bug: (service − supply) ra số âm                                              | Nếu kết quả âm, cần clamp về 0 hoặc xem lại data (supply > service là bất thường)                        |
| B12 | TOTAL STAFF PAYOUT bị trừ Card Charge 2 lần (1 lần ở Payout, 1 lần ở Commission)           | Bug double-subtract                                                           | Card Charge chỉ được trừ đúng 1 lần ở công thức Payout                                                   |
| B13 | Salon Earning không cộng lại Card Charge                                                   | Bug: Salon "mất" khoản phí đã thu từ staff                                    | Salon Earning phải cộng lại đúng phần Card Charge đã trừ của staff                                       |
| B14 | Payroll chưa closed, ước tính active path sai (dùng Salary thay vì max(Commission,Salary)) | Bug logic estimate                                                            | Với Commission+Salary chưa closed, phải dùng `max(Commission, Salary)` để quyết định có charge hay không |
| B15 | Order Card bị hủy/void nhưng vẫn tính card charge                                          | Bug: order void vẫn được tính vào doanh thu                                   | Order void/cancelled phải bị loại khỏi tính toán card charge                                             |
| B16 | Currency/rounding: card_comm% × số tiền lẻ gây sai lệch làm tròn tích lũy                  | Bug rounding                                                                  | Làm tròn phải nhất quán (2 chữ số thập phân) và khớp tổng report                                         |
| B17 | Nhiều loại thẻ khác nhau (Visa/Master/Amex) có phí khác nhau nhưng hệ thống áp 1 mức chung | Bug: không phân biệt loại card có phí khác nhau (nếu business có yêu cầu này) | Cần xác nhận business rule: có phân biệt loại thẻ hay áp dụng % đồng nhất                                |
| B18 | Staff Commission nhưng bị tính card charge trên cả phần Product (không phải Service)       | Bug: card charge áp nhầm lên doanh thu Product                                | Card Charge – Commission chỉ áp dụng trên **Service**, không áp dụng Product                             |

---

**Ghi chú:** Đây là danh sách case suy ra từ formula spec hiện có trong repo. Cần đối chiếu thêm với UI thực tế / Linear ticket liên quan đến "Card Charge" để bổ sung case cụ thể theo màn hình (VD: hiển thị trong Staff Income, Payroll Detail, Income Summary...).
