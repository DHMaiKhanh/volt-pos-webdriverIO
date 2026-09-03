---
title: 'Gift Card Management'
source: https://linear.app/fastboy/document/gift-card-management-aac032d6e34a
linear_id: 9b5a34e6-53c7-4ad3-a884-e3a9bf994720
team: VOLT
updated: 2026-06-11T09:59:37.939Z
---

# Gift Card Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Gift Card Management**

1. **Listing page**

Gồm những field thông tin sau:

- Search: Gift Card Code
- Filter Status
- Giftcard Code
- Status: Active / Inactive / Not Sold Yet / Used Up
- Balance: current balance cảu giftcard tại thời điểm xem thông tin
- Action:
  - View Detail: Gifcard history
  - Edit
  - Reset
  - Logs

| Merchant: Luna Nail Spa                             |              |             |                            |
| --------------------------------------------------- | ------------ | ----------- | -------------------------- |
|                                                     |              |             |                            |
| \[Overview\] \[Orders\] \[Payments\] \[Gift Cards\] |              |             |                            |
|                                                     |              |             |                            |
|                                                     |              |             |                            |
| Gift Cards                                          |              |             |                            |
|                                                     |              |             |                            |
| **Code**                                            | **Status**   | **Balance** | **Action**                 |
| 484377128970                                        | Active       | $75.00      | View Detail Edit ResetLogs |
| 045775308821                                        | Used Up      | $0.00       | View Detail EditLogs       |
| 930670412317                                        | Inactive     | $75.00      | View Detail EditLogs       |
| 537574237772                                        | Not sold yet | $100.00     | View Detail EditLogs       |

2. **Action - View Detail (Check Balance)**

- Mục đích: Admin kiểm tra nhanh tình trạng tiền/history của gift card để support merchant / customer.
- Click sẽ mở page giftcard detail gồm những field thông tin sau:
  - Gift Card Code
  - Status
  - Current Balance
  - Balance detail: click sẽ show list order có thông tin của giftcard đó, tham khảo UI như bên dưới:  
    !\[\]\[image14\]
  - Last Updated At
- Rule:
  - Action này read-only
  - Áp dụng cho mọi status

3. **Action - Edit**

- Edit Balance (Adjust): Admin điều chỉnh balance của gift card hiện có (Add balance / Deduct balance)
- Edit status của giftcard
- Click sẽ mở dialog gồm những field thông tin sau:
  - Title: Edit Giftcard
  - Balance
  - Status
  - Reason (required)
  - Button: Cancel / Save Changes
- Rule:
  - Remaining Balance sau adjust không được < 0
  - Không cho adjust khi: Status = Used Up
  - Sau mỗi lần adjust:
    - Update Remaining Balance
    - Ghi log đầy đủ

4. **Action - Reset Balance**

- Admin reset balance của gift card (ví dụ xử lý lỗi hệ thống / support đặc biệt).
- Click Reset sẽ apply với những thông tin sau:
  - Balance về $0.00
  - Price về $0.00
  - Status: Not Sold Yet
- UI:
  - Action riêng, confirm modal
  - Bắt buộc nhập reason
- Rule: Reset được ghi log là action riêng (không gộp với adjust)

5. **Action - View Logs**

- **Log khi có action từ site Admin, không phải Giftcard History**
- Mục đích: Khác với History: tập trung vào hành vi của Admin
- Nội dung log:
  - Time
  - Admin user: user thực hiện
  - Action:
    - Check balance
    - Edit balance
    - Reset balance
    - Change status
    - Old value → New value
    - Reason
  - Rule:
    - Log không được chỉnh sửa
    - Không cho delete
    - Luôn hiển thị đầy đủ (compliance-friendly)
  - UI
    - Có thể filter theo:
      - Admin user
      - Action type
      - Date range

---

_Source: Google Docs — "Gift Card Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
