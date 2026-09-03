---
title: 'Income Report'
source: https://linear.app/fastboy/document/income-report-94d2aa985225
linear_id: c868dd0f-ef6e-4822-96c1-c826cad6663f
team: VOLT
updated: 2026-08-06T07:13:20.378Z
---

# Income Report

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

Define specs: [https://docs.google.com/spreadsheets/d/1NtBfxEsGjaijFWn7rlzR79sLzmeHTAjNqMDatAnY0wo/edit?gid=1736528834#gid=1736528834](https://docs.google.com/spreadsheets/d/1NtBfxEsGjaijFWn7rlzR79sLzmeHTAjNqMDatAnY0wo/edit?gid=1736528834#gid=1736528834)

## **Daily Sale Report**

Update giao diện, thêm một số thông tin show trong chart: [Business Snapshot](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit?pli=1&tab=t.wgdnihz0qr1u)

- **Daily Sale Report Chart**
  - **Orders**
    - Tooltip: _Total number of order, excluding cancel/refunds/ manual refunds._
  - **Sale** = total sale/refund/partial refund sau Discount và không tính Tip, Tax, không tính order Cancel (Card/Cash/Other/GiftCard)
    - Tooltip: _Total sale amount of the order, including refund/partial refund values after discount is applied, excluding Tax and Tip._
  - **Total Tips** = total Tip (không tính order Cancel)
    - Tooltip: _Total tips received, not included in sales revenue but counted in collected amounts._
  - **Total Payment**
    - Tooltip: _The final revenue includes Gift Card Redemption._  
      _—_
  - **Filter:**
    - Default: Today
    - Cho phép xem theo từng ngày được chọn
- **Daily Sale Report detail:**

```
 List Order Detail
```

- Order #: orderCode
- Sale: total amount service sale/refund trên order sau Discount
- Tax = Tax trên order
- Tip = Tip (Total tip trên order)
- Total = Total Sale + Tip + Tax  
  —  
  **INCOME DETAIL**
- Sale = Total Sale/Refund amount sau Discount
- Tip = Total tip
- Tax Collected = total Tax
- **Total Payment = Sale + Tip + Tax Collected**  
  **—**  
  **PAYMENT DETAIL**
- Card = Total Sale amount by Card = (Total Sale Card - Total Refund Card )
- Cash = Total Sale amount by Cash = (Total Sale Cash - Total Refund Cash)
- Others = Total Sale amount by Others = (Total Sale Others - Total Refund Others)
- **Amount Collected = Card + Cash + Others**
- Gift Card Redemption: Total gift card redemption
- **TOTAL PAYMENT = Amount Collected + Gift Card Redemption**

**—------------------------------------------------------------------------------------------------**

## **Income Summary**

- **Income Summary chart**
  - **Filter**: date range và chọn xem data bên dưới theo Day/Week/Month
    - Default: Day - Today
    - Chọn Day: show list report cho từng ngày theo date range được chọn, 1 day là 1 record
    - Chọn Week:
      - Show list report theo week của năm hiện tại, show đến week hiện tại. Một week là 1 record
      - Filter date show: 2026
      - Nếu chọn năm trong quá khứ (2025), thì show list report theo tất cả week của năm đó.
    - Chọn Month:
      - Show list report theo tháng của năm hiện tại, show đến tháng hiện tại. Một tháng là 1 record.
      - Nếu chọn năm trong quá khứ thì show đủ 12 tháng
  - **Total Income:** Total Net Income, theo thời gian đã chọn và luôn luôn compare với khoảng thời gian đó trước đó
    - Total Income chart: theo 3 thông số
      - **Gross Income**: Total amount of sales, sau discount và trước refunds. Does not include tips, tax and gift card loads and activations
        - _Note: gift card loads - là tiền được nạp vào GiftCard, không được cộng vào report của POS._
      - **Net Income**: Total sale amount sau discount, sau refund/partial refund và không tính Tip, tax, không tính order Cancel, không tính gift card loads and activations.
      - **Total Tip**
  - **Total Income table:**
    - **Date**
    - **Sale**: total sale/refund/partial refund, sau discount và không tính Tip, Tax, không tính order Cancel (Card/Cash/Other/GiftCard) trên tất cả order của ngày xem report.
    - **Tip**
    - **Tax**
    - **Total Payment**: (Sale + Tip + Tax) The final revenue includes Gift Card Redemption.
- **Income Summary detail**

  **PAYMENT DETAILS**
  - Card = Total Sale amount by Card = (Total Sale Card - Total Refund Card + Total tip by card + Total tax Card)
    - Sale: Total Sale Card
    - Refund: Total Refund Card
    - Tip: Total tip by card
    - Tax: Total tax by card
  - Cash = Total Sale amount by Cash = (Total Sale Cash - Total Refund Cash + Total tip by Cash + Total tax Cash)
    - Sale: Total Sale Cash
    - Refund: Total Refund Cash
    - Tip: Total tip by Cash
    - Tax: Total tax by cash
  - Others = Total Sale amount by Others = (Total Sale Others - Total Refund Others + Total tip Others + Total tax Others)
    - Sale: Total Sale Others
    - Refund: Total Refund Others
    - Tip: Total tip by Others
    - Tax: Total tax by Others
  - **Amount Collected = Card + Cash + Others**
  - Gift Card Redemption: Total gift card redemption (Payments covered by previously sold gift cards)
    - Sale: Total Sale by gift card
    - Tip: Total tip by gift card
    - Tax: Total tax by gift card
  - **TOTAL PAYMENT = Amount Collected + Gift Card Redemption**

    **—**

  **SALE DETAILS **

---

**(Note:** Tính trên giá gốc, không bao gồm Service Fee)

- **Total Sale = Gift card Sale + Service Sale + Product Sale**
  - Service Sale: total amount bán Service
  - Product Sale: total amount bán Product
  - Gift card Sale: total amount bán Giftcard (Add Fund cho giftcard khi create order)
- **Total Refund = Service Refund + Product Refund**
  - Service Refund
  - Product Refund
- **Subtotal = Total Sale - Total Refund**
- Discount = Discount - Discount Reversed
  - _Discount: All discounts: promotions, service discounts, loyalty rewards_
  - _Discount Reversed (The discount was taken back due to a refund) (Số tiền discount trong payment refund, sẽ được trừ trả lại)_
- Service Fee
- Cash Discount
- **Net Total = Subtotal - Discount + Service Fee - Cash Discount**
- Tip = total tip của tất cả các hình thức thanh toán
- Tax Collected = total tax của tất cả các hình thức thanh toán
- **TOTAL PAYMENT = Net Total + Tax +Tip**

  **—**

**SUPPLY FEE**

- Total Supply Fee: Total Supply fee theo từng Service, được setting trong Service detail
- Staff Supply Share = Total Supply Fee * 0.6
  - _Supply fee của service mà staff chia với chủ tiệm, phần trăm theo setting trong Staff Commission Setting - For Service, vd: setting Staff 60% - Owner 40%_
- Salon Supply Share = Total Supply Fee - Staff Supply Share
  - _Supply fee của service mà chủ tiệm chịu chung với staff, phần trăm theo setting trong Staff Commission Setting - For Service,_ vd: setting Staff 60% - Owner 40%

Lưu ý: nếu chọn cách tính Supply Fee theo 1 trong 2 method dưới đây:

- **Method 1 — Trừ Supply Share trước khi tính Commission** > thì show đúng như mô tả trên
- **Method 2 — Trừ Supply Share sau khi tính Commission** > thì Salon Supply Share = 0

—

**STAFF PAYOUT**

- Total Service = (Service Sale - Service Refund)
  - **Note:** Tính trên giá gốc, không bao gồm Service Fee
- Staff Supply Share (incl. Sale & Refund)
- **Staff Commission (60%) = (Total Service x 60%) - Staff Supply Share**
  - _Staff Commission (60%): dựa trên setting Commission Setting - For Service của từng staff, nếu staff chỉ setting Salary thì chỗ này bằng 0._ Vd: setting Staff 60% - Owner 40%
- Tip = total tip
- Clean up fee/Deduction: _số $ setting Deduction Per Day trong staff và nhân lên theo số ngày đã làm việc của staff tới thời điểm xem report (phí dọn dẹp)_
- _Discount Charge: Tổng số tiền promotion staff chia với chủ tiệm_
- _Card Charge Commission: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Commission, được setting trong Staff Compensation - On Staff Commission_
- _Card Charge Tip: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Tip, được setting trong Staff Compensation - On Credit Card Tip_
- **Staff Salary:** lương cứng của staff, theo setting, được cộng dồn theo tổng số staff tính lương theo Salary trên tổng số ngày xem report, theo rule như sau:
- Salary by Period: lương 1 kì nhưng được chia cho số ngày trong kì đó, để nếu xem report cho số ngày nhỏ hơn 1 kì lương, thì **Staff Salary** show đúng = Số ngày đang xem x số lương của 1 ngày trong kì đó.
  - VD:
    - Pay Period: 1 week
    - Salary by Period = $7000
    - Xem report cho 3 ngày
    - Rate = $1000
    - **Staff Salary = $1000 * 3 = $3000**
- Wage Per Hour: lương 1h
  - **Staff Salary = [Lương 1h * số giờ]**
- Wage Per Day: lương 1 ngày
  - **Staff Salary = [Lương 1 ngày * số ngày]**

**Lưu ý:** nếu staff đó đang setting theo Commission + Salary, nhưng thuộc kì lương chưa chốt, thì chọn show con số lớn hơn trong report, còn nếu đã chốt thì phải show con số được chọn để tính lương cho staff đó.

- **TOTAL STAFF PAYOUT =** Staff Commission + Tips + Salary – Supply Fee – Cleanup Fee – Discount Charge - Card Charge Commission - Card Charge Tip
  - Pay 1 = TOTAL STAFF PAYOUT * Pay 1 rate
  - Pay 2 = TOTAL STAFF PAYOUT - Pay 1
    - _Staff Salary / Staff Commission x 30%: dựa trên setting **Pay 1 - Pay 2 Split** của từng staff_

_Lưu ý: phần STAFF PAYOUT, show Commission hay Salary:_

- _Nếu như xem report cho thời gian chưa được chốt kì lương, thì sẽ lấy số lớn hơn để tính Income Summary (lúc này có thể hiểu là nó đang estimate)_
- _Còn khi đã chốt kì lương, thì update lại bằng con số chính xác_
- _Nếu như xem report cho thời gian chưa được chốt kì lương, thì sẽ lấy số lớn hơn để tính Income Summary (lúc này có thể hiểu là nó đang estimate)_
- _Còn khi đã chốt kì lương, thì update lại bằng con số chính xác_
- **Special Case: Credit Card Tips Added to Check**
  - Trường hợp setting OFF: không có gì thay đổi
  - Trường hợp setting ON: Khi Credit Card Tips Added to Check = ON:
    - Tip by Card được tách khỏi phần thu nhập dùng để chia tỷ lệ.
    - 100% Tip by Card được cộng trực tiếp vào Pay 2.
    - Các khoản thu nhập còn lại tiếp tục được chia theo Pay 1 / Pay 2 Percentage.

—

**SALON EARNINGS**

- Total Service = (Service Sale - Service Refund)
- Salon Supply Share (incl. Sale & Refund)
- **Salon Commission (40%) = (Total Service x 40%) - Salon Supply Share**
  - **Lưu ý: nếu staff đó đang setting theo Commission + Salary, nhưng thuộc kì lương chưa chốt, thì chọn show con số lớn hơn để tính thông số này trong report, còn nếu đã chốt thì phải show con số được chọn để tính lương cho staff đó.**
- Product Sale
- Product Refund
- Total Discount = Discount - Discount Reversed
  - _Discount_
  - _Discount Reversed_
- Service Fee
- Cash Discount
- **Net Earnings = Salon Commission + Product Sale - Product Refund – Total Discounts + Service Fee - Cash Discount**
- Staff Supply Share
- Clean up fee
- _Staff Discount Charge: Tổng số tiền promotion staff chia với chủ tiệm_
- _Staff Card Charge - Commission: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Commission, được setting trong Staff Compensation - On Staff Commission_
- _Staff Card Charge - Tip: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Tip, được setting trong Staff Compensation - On Credit Card Tip_
- **Staff Salary:** lương cứng của staff, theo setting, được cộng dồn theo tổng số staff tính lương theo Salary trên tổng số ngày xem report, theo rule như sau:
  - Salary by Period: lương 1 kì nhưng được chia cho số ngày trong kì đó, để nếu xem report cho số ngày nhỏ hơn 1 kì lương, thì **Staff Salary** mới show đúng = Số ngày đang xem x số lương của 1 ngày trong kì đó.
    - VD:
      - Pay Period: 1 week
      - Salary by Period = $7000
      - Xem report cho 3 ngày
      - Rate = $1000
      - **Staff Salary = $1000 * 3 = $3000**
  - Wage Per Hour: lương 1h
    - **Staff Salary = [Lương 1h * số giờ]**
  - Wage Per Day: lương 1 ngày
    - **Staff Salary = [Lương 1 ngày * số ngày]**

**Lưu ý:** nếu staff đó đang setting theo Commission + Salary, nhưng thuộc kì lương chưa chốt, thì chọn show con số lớn hơn trong report, còn nếu đã chốt thì phải show con số được chọn để tính lương cho staff đó.

- **TOTAL EARNING = Net Earnings + Staff Supply Share + Cleanup Fee + Staff Discount Charge – Staff Salary + Staff Card Charge Commission + Staff Card Charge Tip**
  - _Vì số tiền cho Supply fee của service chủ tiệm đã bỏ ra rồi, thì sau khi tổng kết lại tổng số tiền chủ tiệm thu được sẽ gồm (Supply fee service / phần promotion / phần khấu trừ dựa trên phí thanh toán card và tip) mà staff chia 1 phần và trả cho chủ tiệm_
- Tax Collected: total tax

—---------------------------------------------------------------------------------

## **Staff Income**

**(Note:** Tính trên giá gốc, không bao gồm Service Fee)

- Staff listing: gồm những thông tin sau:
  - Search: Staff Nickname
  - Filter: ~~ngày xem report~~
    - Filter theo Payroll Period
    - Đối với kỳ lương hiện tại chưa chốt, hiển thị ở đầu danh sách: Current Period (06/15 - 06/28)
  - Data table: gồm những column
    - Staff: show staff nickname
    - Orders: tổng số lượng order của staff
    - Subtotal = Sale - Refund
    - Supply Fee
    - Tip
    - Total Income
- Staff Income detail theo từng staff và theo từng setting Compensation của staff đó:

1. **STAFF INCOME - Commission**
   - **Satff Info:**
     - Staff Name: Nickname
     - Date:
       - Xem theo 1 ngày:
         - Date: 04/15/2025
       - Xem theo range:
         - Date: 04/15/2025 - 04/30/2025
         - No. of WD: 8 days
   - **Order listing**
     - Order#
     - Sale/Refund: total amount order sale/refund
     - Supply: total supply trên tất cả sevice trên order
     - Tip: total tip trên order
   - **Staff Income Detail**
     - Sale = total amount SALE của order
     - Refund = total amount REFUND của order
     - **Subtotal = Sale - Refund**
     - Supply Fee (incl. Sale & Refund)
     - **Staff Commission = (Subtotal - Supply fee) x 60%**
     - Discount Charge\*: Tổng số tiền promotion staff chia với chủ tiệm\*
     - Card Charge Commission: _Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Commission, được setting trong Staff Compensation - On Staff Commission_
     - _Card Charge Tip: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Tip, được setting trong Staff Compensation - On Credit Card Tip_
     - Clean Up Fee/Deduction: số $ setting trong staff và nhân lên theo số ngày xem report
     - Tip = (Card Tip − Card Charge Tip) + Cash Tip + Gift Card Tip + Other Tip
       - Default là **Collapse,** click vào Tip hoặc icon expand, sẽ show chi tiết Tip của từng method như bên dưới:
         - Card
         - Cash
         - Gift Card
         - Other
     - **TOTAL INCOME = (Staff Commission - Clean up fee + Tip - Card Charge Commission - Card Charge Tip – Discount Charge)**
       - Pay 1 = TOTAL INCOME * Pay 1 rate
       - Pay 2 = TOTAL INCOME - Pay 1

         ***
         - **Special Case: Credit Card Tips Added to Check**
           - Trường hợp setting OFF: không có gì thay đổi
           - Trường hợp setting ON: Khi Credit Card Tips Added to Check = ON:
             - Tip by Card được tách khỏi phần thu nhập dùng để chia tỷ lệ.
             - 100% Tip by Card được cộng trực tiếp vào Pay 2.
             - Các khoản thu nhập còn lại tiếp tục được chia theo Pay 1 / Pay 2 Percentage.
2. **STAFF INCOME (1 day) - Salary / Commission + Salary**  
   **Pay by Hour/Day/Period**
   - **Satff Info:**
     - Staff Name: Nickname
     - Date: 04/15/2025
     - Clock In: 9:00:00 AM
     - Clock Out: 5:00:00 PM
     - Working Hours: 8
   - **Order listing**
     - Order#
     - Sale/Refund: total amount order sale/refund
     - Tip: total tip trên order
   - **Staff Income Detail**
     - Sale = total amount SALE của order
     - Refund = total amount REFUND của order
     - **Subtotal = Sale - Refund**
     - Rate: số được setting trong staff Compensation - Salary
       - Nếu là Salary by Period: lương 1 kì nhưng được chia cho số ngày trong kì đó, để nếu xem report cho số ngày nhỏ hơn 1 kì lương, thì Gross Income mới show đúng = Số ngày đang xem x số lương của 1 ngày trong kì đó. VD:
         - Pay Period: 1 week
         - Salary by Period = $7000
         - Xem report cho 3 ngày
         - Rate = $1000
         - Gross Income = $1000 \* 3 = $3000
       - Wage Per Hour: lương 1h
       - Wage Per Day: lương 1 ngày
     - Gross Income: \[số ngày/giờ làm việc\] x \[rate\]
     - Clean Up Fee/Deduction: số $ setting trong staff và nhân lên theo số ngày xem report
     - Tip = (Card Tip − Card Charge Tip) + Cash Tip + Gift Card Tip + Other Tip
       - Default là **Collapse,** click vào Tip hoặc icon expand, sẽ show chi tiết Tip của từng method như bên dưới:
         - Card
         - Cash
         - Gift Card
         - Other
     - Card Charge Tip
     - **TOTAL INCOME = Gross Income + Clean Up Fee + Tip**
       - Pay 1 = TOTAL INCOME * Pay 1 rate
       - Pay 2 = TOTAL INCOME - Pay 1

**Một số lưu ý:**

- Salary by Period: trả lương theo kì payroll
- Wage Per Hour: trả lương theo giờ, cần Checkin - Checkout để count được số giờ làm việc.
- Wage Per Day: trả lương theo ngày, cần Checkin để count được số ngày có đến tiệm làm việc.
- Clean Up Fee/Deduction: nếu tính Salary by Period, thì tính fee trên số ngày nhận lương của kì đó
- Staff Income chỉ là report dự trù số tiền Staff sẽ được nhận, con số chính xác vẫn là trong Payroll khi chốt kì lương.
- Clock In/Clock Out:
  - Nếu xem theo 1 ngày, và chỉ có 1 ca được checkin, thì show Clock In/Clock Out cụ thể
  - Nếu xem theo 1 range date:
    - Để trống Clock In/Clock Out
    - Wage Per Hour: show tổng Working Hours
    - Wage Per Day: show tổng Working Days
    - Salary by Period: luôn để trống Clock In/Clock Out và show tổng Working Days
- Nếu Staff đang có setting **Salary** hoặc **Commission + Salary,** thì trên Staff Income luôn show cả 2 phần cho cả Commission và Salary, nhưng Total Income sẽ show phần Salary. Vì chỗ này còn phụ thuộc vào setting **Staff Days Off Setting** > thì mới chốt được là staff này nhận Commission hay Salary
- **Special Case: Credit Card Tips Added to Check**
  - Trường hợp setting OFF: không có gì thay đổi
  - Trường hợp setting ON: Khi Credit Card Tips Added to Check = ON:
    - Tip by Card được tách khỏi phần thu nhập dùng để chia tỷ lệ.
    - 100% Tip by Card được cộng trực tiếp vào Pay 2.
    - Các khoản thu nhập còn lại tiếp tục được chia theo Pay 1 / Pay 2 Percentage.

—----------------------------------------------------------------------------

## **Staff Payroll**

Staff Income detail theo từng staff: theo 2 setting Commission và Salary

1. **STAFF PAYROLL - Commission**

- **Satff Info:**
  - Staff Name: Nickname
  - Pay Period: Date: 04/15/2025 - 04/30/2025
  - Working Days: 8 days
- **Order listing**
  - Date
  - Sale: total amount order sale trong ngày
  - Refund: total amount order refund trong ngày (số âm)
  - Supply: total supply trên tất cả sevice trong order trong ngày
  - Tip: total tip của tất cả order trong ngày
- **Staff Income Detail**
  - Sale = total Sale
  - Refund = total refund
  - **Subtotal = Total (Sale - Refund)**
  - Supply Fee (incl. Sale & Refund) = Total Supply
  - **Staff Commission = (Subtotal - Supply fee) x 60%**
  - Discount Charge\*: Tổng số tiền promotion staff chia với chủ tiệm\*
  - Card Charge Commission: _Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Commission, được setting trong Staff Compensation - On Staff Commission_
  - _Card Charge Tip: Tổng số tiền chiết khấu trừ dựa trên phí thanh toán thẻ trên Tip, được setting trong Staff Compensation - On Credit Card Tip_
  - Clean Up Fee: số $ setting trong staff và nhân lên theo số ngày xem report
    - VD: Clean Up Fee = deduction fee \* số ngày tính lương
  - Tip = (Card Tip − Card Charge Tip) + Cash Tip + Gift Card Tip + Other Tip
    - Default là Collapse**,** click vào Tip hoặc icon expand, sẽ show chi tiết Tip của từng method như bên dưới:
      - Card
      - Cash
      - Gift Card
      - Other
  - **TOTAL INCOME = (Staff Commission - Clean up fee + Tip - Card Charge Commission - Card Charge Tip – Discount Charge)**
    - Pay 1 = TOTAL INCOME * Pay 1 rate
    - Pay 2 = TOTAL INCOME - Pay 1

2. **STAFF PAYROLL - Salary**

- **Staff Info:**
  - Staff Name: Nickname
  - Pay Period: Date: 04/15/2025 - 04/30/2025
- **Staff Payroll Detail**
  - Working Days: tổng số ngày làm việc
  - Working Hours: tổng số giờ làm việc
  - **Salary Amount: tổng số lương phải trả**
    - Salary by Period: ghi nhận con số được setting trong Employee Compensation/Salary by Period
    - **Wage Per Day:** Salary Amount = \[số được setting trong Employee Compensation/Wage Per Day\] \* \[Working Days\]
    - **Wage Per Hour:** Salary Amount = \[số được setting trong Employee Compensation/Wage Per Day\] \* \[Working Hour\]
  - Deduction/Clean up fee: số $ setting trong staff và nhân lên theo số ngày tính lương
    - VD: Clean Up Fee = deduction fee \* số ngày tính lương
  - Tip = (Card Tip − Card Charge Tip) + Cash Tip + Gift Card Tip + Other Tip
    - Default là **Collapse,** click vào Tip hoặc icon expand, sẽ show chi tiết Tip của từng method như bên dưới:
      - Card
      - Cash
      - Gift Card
      - Other
  - Card Charge Tip
  - **TOTAL INCOME = Salary Amount - Clean up fee + Tip**  
    **(Salary - Clean up fee + Tip))**
    - Pay 1 = TOTAL INCOME * Pay 1 rate
    - Pay 2 = TOTAL INCOME - Pay 1

**Một số lưu ý:**

- Nếu staff đang được setting theo Commission + Salary: thì tùy thuộc vào staff đó có setting **Staff Days Off Setting** > thì mới chốt được là staff này nhận Commission hay Salary
- Phần Tip sẽ được cộng vào hoặc trừ ra tùy thuộc vào setting **Exclude Tips From Cash/Check Income** của mỗi staff đang enable hay disable

---

### Promotion Cost Sharing

- Merchant luôn có thể cấu hình tỷ lệ phân chia Promotion giữa **Owner** và **Staff**.
- Phần Promotion thuộc về Staff sẽ được phân bổ cho tất cả staff tham gia order theo tỷ lệ giá trị service của từng người, không phụ thuộc Compensation hiện tại.
- Tuy nhiên, chỉ những staff có Compensation chứa Commission mới thực sự chịu phần Promotion đó khi tính Income/Payroll. Phần Promotion được phân bổ cho staff Salary-only sẽ do Owner chịu.

### Khi tính Income / Payroll

#### Staff có Compensation chứa Commission

Bao gồm:

- Commission
- Salary + Commission

Phần Promotion được phân bổ cho staff này sẽ được dùng để giảm Income/Commission theo quy tắc.

#### Staff chỉ có Salary

Phần Promotion được phân bổ cho staff này chỉ được ghi nhận để phục vụ việc phân bổ trên order, nhưng **không ảnh hưởng đến Income hoặc Payroll của staff**.

Khoản Promotion này sẽ được chuyển sang phần chi phí mà Owner chịu.

---

**Description cho một số vị trí, khi xem report cho nhiều kì lương. thì sẽ show rõ thông số setting của mỗi kì như sau:**

**Staff Income Report: tại những field sau**

- **Đối với staff setting Commission**
  - Staff Commission
    - Commission Rate (mm/dd/yyyy - mm/dd/yyyy): x%
    - Commission Rate (mm/dd/yyyy - mm/dd/yyyy): x%
  - Total Income
    - Pay 1
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
    - Pay 2
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
      - Pay 2 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
- **Đối với staff setting Commission + Salary và Salary**
  - Rate
    - Rate (mm/dd/yyyy - mm/dd/yyyy): x%
    - Rate (mm/dd/yyyy - mm/dd/yyyy): x%
  - Total Income
    - Pay 1
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
    - Pay 2
      - Pay 1 Rate (mm/dd/yyyy - mm/dd/yyyy): x%
      - Pay 2 Rate (mm/dd/yyyy - mm/dd/yyyy): x%

---

## Special Case: Credit Card Tips Added to Check

### Trường hợp setting OFF: không có gì thay đổi

### Trường hợp setting ON

Khi **Credit Card Tips Added to Check = ON**:

- Tip by Card được tách khỏi phần thu nhập dùng để chia tỷ lệ.
- 100% Tip by Card được cộng trực tiếp vào Pay 2.
- Các khoản thu nhập còn lại tiếp tục được chia theo Pay 1 / Pay 2 Percentage.

### Công thức

`Total Tip = Tip by Card + Tip Non Card - Card Charge Tip`

`Total Income = Commission + Total Tip - Total Deductions`

`Pay 1 = (Total Income - Tip by Card) × Pay 1 Percentage`

`Pay 2 = Total Income - Pay 1`

Tương đương với:

`Pay 2 = [(Total Income - Tip by Card) × Pay 2 Percentage] + Tip by Card`

---

## Calculation Supply Fee Methods

### Method 1 — Deduct Before Commission

Formula**:** `Commission = (Subtotal - Supply Share) × Commission Rate`

### Method 2 — Deduct After Commission

Formula**:** `Commission = (Subtotal × Commission Rate) - Supply Share`

---

_Source: Google Docs — "Income Version 2" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit).y 1 Rate_
