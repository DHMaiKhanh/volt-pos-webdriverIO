---
title: 'Payroll'
source: https://linear.app/fastboy/document/payroll-23dadb3e0003
linear_id: dec81408-5313-4db4-8867-ac81c24b11ac
team: VOLT
updated: 2026-07-09T04:50:20.600Z
---

# Payroll

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

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
  - Clean Up Fee: số $ setting trong staff và nhân lên theo số ngày xem report
    - VD: Clean Up Fee = deduction fee \* số ngày tính lương
  - Tip = Total Tip
  - Discount Charge
  - Card Charge - Commission
  - Card Charge - Tip
  - **TOTAL INCOME = (Staff Commission - Clean up fee + Tip - Card Charge Commission - Card Charge Tip – Discount Charge)**
    - Pay 1 (Staff Commission x 30% - Clean up fee - Card Charge Commission - Card Charge Tip – Discount Charge)
    - Pay 2 (Staff Commission x 70% + Tip)
      - _Staff Commission x 30%: dựa trên setting **Pay 1 - Pay 2 Split** của từng staff_

2. **STAFF PAYROLL - Salary**

- **Satff Info:**
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
  - **Tip** = Total Tip
  - Card Charge - Tip
  - **TOTAL INCOME = Salary Amount - Clean up fee + Tip - Card Charge Tip**
    - Pay 1 (Salary x 30% - Clean up fee **-** Card Charge Tip)
    - Pay 2 (Salary x 70% + Tip)
      - Salary _x 30%: dựa trên setting **Pay 1 - Pay 2 Split** của từng staff_

**Một số lưu ý:**

- Nếu staff đang được setting theo Commission + Salary: thì tùy thuộc vào staff đó có setting **Staff Days Off Setting** > so sánh trên Total Income của 2 type, thì mới chốt được là staff này nhận Commission hay Salary
- Phần Tip sẽ được cộng vào hoặc trừ ra tùy thuộc vào setting **Exclude Tips From Cash/Check Income** của mỗi staff đang enable hay disable

---

# Print Check

- “Print Check” là việc in phiếu lương (commission check) từ hệ thống POS, thể hiện thu nhập của từng nhân viên (staff) trong một kỳ làm việc (thường là 1 tuần hoặc 2 tuần).
- Phát phiếu check giấy (paycheck) để nhân viên mang ra ngân hàng hoặc mobile app deposit vào tài khoản của họ.
- Quy trình thực tế vận hành Print Check trong tiệm nail:
  - Tổng hợp doanh thu & tip:
    - POS hoặc kế toán tổng hợp service income, tip, commission rate theo từng nhân viên.
    - Dữ liệu lấy từ Order / Report / Time Keepings.
  - Tính toán lương (Commission or Salary): thường sẽ chia thành 2 hình thức
    - Trả tiền mặt
    - Check
  - In Check
  - Nhân viên đem phiếu ra ngân hàng

Mẫu giấy dùng để in check: [https://onedrive.live.com/?redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy9hNDMwMzRkYmNiMTIyZmQxL0VRWWg0ZE9QVEpKTnFuTFMyakxZWGlZQnozOTVrWFJQdTFhWVZIUTRhWFBTakE&cid=A43034DBCB122FD1&id=A43034DBCB122FD1%21sd3e121064c8f4d92aa72d2da32d85e26&parId=A43034DBCB122FD1%21sd7eb2564f3f14c83b35f1e2813891327&o=OneUp](https://onedrive.live.com/?redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy9hNDMwMzRkYmNiMTIyZmQxL0VRWWg0ZE9QVEpKTnFuTFMyakxZWGlZQnozOTVrWFJQdTFhWVZIUTRhWFBTakE&cid=A43034DBCB122FD1&id=A43034DBCB122FD1%21sd3e121064c8f4d92aa72d2da32d85e26&parId=A43034DBCB122FD1%21sd7eb2564f3f14c83b35f1e2813891327&o=OneUp)

## Bank Account

Danh sách thông tin account ngân hàng của chủ tiệm, gồm những thông tin sau:

- Bank Name
- Account Name
- Account Number
- Routing Number
- Bank Link
- Search: Bank Name / Account Name
- Action: Update
- Button: Create New
- Create New bank account, form create new gồm 3 fields thông tin sau:
  - Title: **Bank Information**
  - **(1) Bank Account Information: thông tin ngân hàn của chủ tiệm**
    - Account Name: (required), tên chủ tài khoản ngân hàng, là tên người hoặc doanh nghiệp đứng tên tài khoản.
    - Account Number: (required), dãy số định danh tài khoản của merchant tại ngân hàng
    - Bank Name: (required), tên ngân hàng mà merchant đang sử dụng
    - Routing Number: (required), số định tuyến ngân hàng tại Mỹ (ABA Routing Number), thường bao gồm 9 digits
    - Confirm Account Number: (required), nhập lại số tài khoản để xác nhận, field này phải khớp chính xác 100% với _Account Number_
    - Bank Website (Link): (required), địa chỉ website chính thức của ngân hàng.
  - **(2) Address Information: thông tin địa chỉ của tiệm**
    - Nick Name: (required), tên merchant
    - Address Line 1: (Optional)
    - Address Line 2: (Optional)
    - City: (required)
    - State: (required)
    - Zip: (required)
  - (3) **Contact Information: thông tin liên hệ của chủ tiệm**
    - Phone: (required)
    - Email: (required)
  - Button:
    - Default: set thành account default để print check
    - Create: click để create bank account

---

## Checks List

### Check List listing

Gồm những thông tin sau:

- ID: số thứ tự (ID) của check, count từ 1
- Employee Name: staff name
- Created At: thời gian create check (add staff để tạo check) hh:mm mm/dd/yyyy
- Check: amount check, số tiền thanh toán bằng hình thức check
- Memo: payroll được in check (dạng note)
- Actions: View / Print / Delete / Archive / Void
- Filter date: Created At
- Filter status:
  - Created: default
  - Printed
  - Voided
  - Deleted
- Signature
- Add Staff button

---

### Create Signature

- Là chữ ký của chủ tiệm (Owner), chữ ký của người có thẩm quyền phát hành chi phiếu (Authorized Signer)
- Mục đích:
  - Check được phê duyệt hợp lệ
  - Số tiền đã được ngân hàng cấp phép rút từ tài khoản của merchant
  - Đây là chi phiếu hợp pháp để nhân viên đem ra ngân hàng/cash check
- Hiển thị trên check

---

### Add Staff

Tạo check cho staff:

- Điều kiện hiển thị của list staff:
  - Chỉ staff Active mới được trả lương → mới hiện trong danh sách tạo check.
  - Nếu staff không có thu nhập trong kỳ trả lương → default không xuất hiện, do default filter là "Has staff income" (Staff phải có Timekeeping / Hour Worked / Commission để trả lương)
  - Staff chỉ được chọn nếu thuộc cùng Merchant đang tạo check.
  - Lưu ý: nếu staff đã được chọn để create check, nhưng check chưa được proccess, thì trong list staff vẫn hiển thị lại staff đó, nhưng bị disable đi (Đã tồn tại check cho staff đó ở thời điểm hiện tại)
- Filter:
  - Has Staff Income / All: staff đang có income đến thời điểm hiện tại hoặc show tất cả (kể cả những staff không có income)
  - Bank Account list: show list bank account được tạo ở tab Bank Account
  - Payroll:
    - Select date range theo payroll cố định của tiệm (dựa vào setting Pay Period)
    - Không cho phép chọn ngày lẻ (số lượng ngày lớn hơn hoặc nhỏ hơn payroll)
- Search: Staff name
- List Staff: gồm những field thông tin sau
  - Name (First name/Last name)
  - Income: total Staff Income đến thời điểm hiện tại của staff chưa được in check (Nếu gồm cả 2 payroll liên tiếp thì show tổng của 2 payroll)
  - Staff Role: role hiện tại của staff
  - Lastest Check: lần in Check gần nhất của staff
  - Sort theo alphabet Name
- Option Select All: chọn hết tất cả staff đang thỏa điều kiện để create check hàng loạt
- **Lưu ý:** nếu payroll đã được print check nhưng chỉ xuất cho pay 1, thì xem như payroll đó đã complete print check rồi, không hiển thị số tiền pay 2 chưa đc print check trong Income hiện tại của staff nữa. Vì thông thường sẽ trả bằng check một pay và trả bằng cash một pay để giảm phần thuế cho staff/store

---

### Check detail

Gồm những field thông tin sau:

- **(1) Thông tin merchant:**
  - Avatar merchant
  - Merchant name
  - Merchant Address
  - Bank name
  - Bank link
- **(2) Thông tin khởi tạo Check:**
  - Date (Issue Date): Ngày người dùng tạo check (ngày phát hành check)
    - Khi create Check, hệ thống sẽ tự động gán **Issue Date = current date**
    - Lưu ý:
      - Check được tạo vào ngày 11/17/2025 > **Issue Date = 11/17/2025** nhưng chưa được print
      - Đến ngày 11/18/2025, mở lại check đó để xử lý > **Issue Date = 11/18/2025**
      - Nhưng **Created At** ngoài Check List vẫn là **11/17/2025**
  - Check number: số định danh của tờ check
    - Là số tăng dần tự động mỗi khi tạo check mới
    - Thường có định dạng padding 6 digits: 000001, 000002…
    - Hiện thị ở 3 vị trí như trên hỉnh
    - Mục đích của Check number:
      - Nhận diện từng tờ check riêng biệt
      - Theo dõi lịch sử phát hành check
      - Dùng để đối chiếu với ngân hàng (bank verification)
      - Tránh trùng lặp hoặc gian lận payroll
- **(3) Thông tin số tiền sẽ thanh toán cho staff trên check:**
  - PAY TO THE ORDER OF - Staff Name: thanh toán cho staff nào
  - Amount in Number: số tiền của Pay được chọn trên list **Check 1 Payout** or **Check 2 Payout** or **Check 1&2 Payout**
  - Amount in Words: hiển thị số tiền ở dạng text theo **rules** để chuyển số → chữ theo format check của ngân hàng Mỹ

### Công thức/Quy tắc để chuyển amount → text trên check

**Công thức/Quy tắc để chuyển amount → text trên check**

Giả sử số tiền là **$1,902.34**, hệ thống sẽ convert thành:

➡️ **"ONE THOUSAND NINE HUNDRED TWO AND 34/100"**

Đây là đúng format của payroll check ở Mỹ.

---

**1) Phần nguyên (Dollar Amount)**

Chuyển từng nhóm số (clusters) theo cấu trúc:

- 1–19 → dùng bảng đặc biệt (one, two, three…)
- Tens (20, 30, 40…) → twenty, thirty…
- Hundred → “… hundred”
- Thousand → “… thousand”
- Million → “… million”
- Billion → “… billion”

**Ví dụ:** 1902 →

- 1 thousand → “one thousand”
- 900 → “nine hundred”
- 2 → “two”

Gộp lại: ➡️ **“one thousand nine hundred two”**

---

**2) Phần thập phân (Cents)**

Quy tắc cố định trong check Mỹ:

**XX/100**

Dựa trên 2 số cuối của số tiền:

- 0.05 → 05/100
- 0.30 → 30/100
- 0.99 → 99/100

Ví dụ 0.34 → **34/100**

---

**3) Gộp chung theo format của check**

Format chuẩn của US banking:

**\[DOLLAR WORDS\] AND \[CENTS\]/100**

Ví dụ: “ONE THOUSAND NINE HUNDRED TWO AND 34/100”

Không cần thêm “dollars”, vì từ “DOLLARS” đã in sẵn bên phải.

---

**4) Tất cả luôn viết in hoa (uppercase)**

Hầu hết hệ thống payroll/check đều in chữ hoa để:

- Dễ đọc với máy
- Tránh bị chỉnh sửa tay
- Chuẩn ngân hàng

**VD: $1276.37**

- Tách phần nguyên và phần thập phân
  - Số tiền: `$1276.37`
  - Phần nguyên: `1276`
  - Phần thập phân: `37` → cents
- Viết phần nguyên bằng chữ: 1276 = `One Thousand Two Hundred Seventy-Six`
- Viết phần thập phân: 37 cents → `37/100`
- Ghép lại theo chuẩn check: One Thousand Two Hundred Seventy-Six and 37/100 Dollars

---

- **(4) Thông tin pay period, chữ kí** **và MICR line:**
  - MEMO: auto fill pay period được tạo check **\[mm/dd/yyyy TO mm/dd/yyyy\] - Staff Nickname**
  - Chữ kĩ: chữ kí của owner được setup ở ngoài Check List listing page
  - Dãy số: "000786" |:111000611|: 585883120" > được gọi là MICR line (Magnetic Ink Character Recognition line)
    - 000786 - Check number
    - 111000611 - Routing Number của bank account được chọn khi create check
    - 585883120 - Account Number của bank account được chọn khi create check
    - Ký tự phân tách MICR: `:`, `|`… giúp máy nhận diện từng trường.
    - More info: mục đích chính của MICR line > Tự động hóa quá trình xử lý check. Ngân hàng sử dụng máy đọc MICR để scan nhanh thông tin routing number, account number và check number. Giúp xác định nguồn tiền và ngân hàng phát hành mà không cần nhập tay.
- **(5) Thông tin chi tiết của staff income trong pay period được tạo check:**
  - Show Staff Payroll theo từng ngày, gồm những column thông tin sau:
    - DATE
    - SALE/REFUND = Total (Sale - Refund)
    - SUPPLY
    - COMMISSION
    - TIP
    - TOTAL
  - Summary gồm những thông tin sau:
    - Total Sale = Total (Sale - Refund)
    - Supplies
    - Net Sale = Total Sale - Supplies
    - Commission (60%)
    - Clean Up Fee
    - Total tip
    - Pay 1
    - Pay 2
    - Total Pay
- **(6) Một số action:**
  - Edit Info Check: only check status - Created, sẽ được update những thông tin sau
    - Created At (Issue Date)
    - Check Number: update nhưng không được trùng với với những check number đang có ở hiện tại, ngoại trừ status Delete là vẫn được trùng
    - Nickname
    - Name
    - Pay 1
    - Pay 2
    - Memo: là field điền sẵn thông tin pay period được print check, nhưng nếu chủ tiệm muốn update sang ngày khác thì vẫn được phép. Vì check được in ra là dựa trên Pay Period cố định, field Memo không ảnh hưởng
    - **Lưu ý:** những thông tin sau khi update chỉ apply cho Check đó thôi, k ảnh hưởng đến những setting hiện tại của staff.
  - Select option: gồm 3 options
    - Check 1 Payout
    - Check 2 Payout
    - Check 1 & 2 Payout
  - Print Memo: print check

---

### **Workflow**

- **Status**:

| Status  | Định nghĩa                     |
| ------- | ------------------------------ |
| Created | Check vừa mới đc tạo ra        |
| Printed | Check đã được in               |
| Voided  | Cancel check vừa in (Printed)  |
| Deleted | Xóa check vừa tạo ra (Created) |

- **Action**:

| Action      | Định nghĩa                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **View**    | * Cho phép người dùng mở và xem toàn bộ thông tin của check. - Chỉ xem, không được chỉnh sửa thông tin check đã phát hành                                                                                                                                                      |
| **Print**   | * In ra phiếu lương (paycheck) cho staff. - Đây là bản chính để staff mang ra ngân hàng nhận tiền - Chỉ cho in đúng 1 lần và cần xác nhận nếu in lại (Reprint) - Click icon Print là được tính là đã in check, nếu có vấn đề về máy in cần in lại, thì sử dụng action Re-print |
| **Delete**  | * Xóa hoàn toàn check khỏi hệ thống (thường áp dụng cho check chưa in, chưa gửi nhân viên). - Chỉ cho phép delete khi check đang status Created - Xóa xong sẽ không thể khôi phục lại                                                                                          |
| **Archive** | * Ẩn check khỏi danh sách hiển thị chính nhưng vẫn giữ trong hệ thống để tra cứu khi cần                                                                                                                                                                                       |
| **Void**    | * Hủy hiệu lực của check đã phát hành (đặc biệt là check đã in), để đảm bảo không thể sử dụng để lấy tiền. - Check chuyển trạng thái Voided - Không được in hoặc sử dụng lại - Không thể xóa (Delete) sau khi Void                                                             |

- **Action trên check theo status:**

| Status / Action | View | Print                      | Delete                     | Archive                     | Void                      | Re-print                   |
| --------------- | ---- | -------------------------- | -------------------------- | --------------------------- | ------------------------- | -------------------------- |
| **Created**     | Yes  | Yes Status update: Printed | Yes Status update: Deleted | Yes Status update: Archived | No                        | No                         |
| **Printed**     | Yes  | No                         | No                         | No                          | Yes Status update: Voided | Yes Status update: Printed |
| **Voided**      | Yes  | No                         | No                         | No                          | No                        | No                         |
| **Deleted**     | Yes  | No                         | No                         | No                          | No                        | No                         |

Một số lưu ý sau khi create Check:

- **Created**: staff bị disable > phải Delete thì mới enable lại
- **Printed** (Đã xử lý):
  - Nếu staff vẫn còn Income chưa thanh toán, phải enable lại để có thể xuất check tiếp tục.
  - Nếu staff đã hết Income thì hiển thị giống hình
  - Nếu Void ngay check đó, thì enbale lại staff với số tiền Income đã Void để có thể xuất lại check đó

---

## **Quick Book**

Tạo nhanh 1 check cho list staff trong merchant, và không bị ảnh hưởng đến Income hay Payroll của staff đó, đơn giản là khoản bonus mà chủ tiệm muốn thanh toán cho staff.

Gồm những thông tin sau:

**Create Check section:**

- Bank Account: list bank account của chủ tiện đã tạo ở tab Bank Account
- Ending Balance: tổng số tiền thanh toán cho staff bằng Quick-Book, gồm tất cả các status của Check
- PAY TO THE ORDER OF: selector staff, show full list staff của tiệm, bao gồm status Inactive
- Amount ($): số tiền sẽ trả trên check
- Amount in Words: hiển thị số tiền ở dạng text theo **rules**
- MEMO

**Check listing section:**

- ID
- Employee Name: \[Nickname - Full name\]
- Created At: ngày create check
- Check
- Memo
- Action: View / Print / Delete / Archive / Void / Reprint

Một số lưu ý:

- Không cho phép Edit Check

---

## History

- List status riêng của History:
  - Active: đối với check đang có status là Created
  - Archive: đối với check đã printed và archive
  - Delete: đối với check đã bị delete
  - Void: đối với check đã bị void
- History listing gồm những thông tin sau:
  - ID
  - Employee: \[Nickname - Name\] của staff
  - Created At: thời gian tạo check \[hh:mm mm/dd/yyyy\]
  - Amount: số tiền bank sẽ thanh toán cho staff
  - Memo: pay period của check
  - Sort default desc theo ID
  - History Detail: gồm những thông tin sau
    - ID
    - Employee: \[Nickname - Name\]
    - Status: status hiện tại của check
    - Activities: ghi log khi có update trên check
      - User
      - Change Fields:
        - Field name: \[old value\] > \[new value\]
        - Field name: \[old value\] > \[new value\]
      - Action: những action sẽ ghi lại log
        - Edit check
        - Delete check
        - Reprint check
        - Void check
      - Reason
      - Updated At: \[hh:mm mm/dd/yyyy\]

---

---

_Source: Google Docs — "Payroll" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
