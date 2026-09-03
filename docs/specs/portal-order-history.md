---
title: 'Portal Order History'
source: https://linear.app/fastboy/document/portal-order-history-ba2903a15df5
linear_id: 09314f50-bf15-4369-ac55-3f8a37c2e830
team: VOLT
updated: 2026-06-11T09:59:29.753Z
---

# Portal Order History

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# Portal Order History — Backend Business Rules

**Audience:** Backend team **Purpose:** Business rules, action conditions, validation logic, and data flows. Backend team decides API/database design.

---

## 1\. Order Status Display

The portal shows these statuses to users. Both `status` and `settled` flag are needed to display correctly:

| Status             | Settled? | Display label          |
| ------------------ | -------- | ---------------------- |
| `successful`       | `false`  | Successful - Unsettled |
| `successful`       | `true`   | Successful - Settled   |
| `canceled`         | —        | Canceled               |
| `canceling`        | —        | Canceling              |
| `cancel_issue`     | —        | Cancel Issue           |
| `refunded`         | —        | Refunded               |
| `partial_refunded` | —        | Partial Refunded       |
| `refund_issue`     | —        | Refund Issue           |
| `refunding`        | —        | Refunding              |
| `re_open`          | —        | Re-opened              |

**Default filter:** Exclude `pending` orders from the list.

---

## 2\. Settled vs. Unsettled — The Critical Distinction

The `settled` flag controls which actions are available. This is a **payment processor constraint**, not just a business rule.

|                      | Unsettled (`settled = false`) | Settled (`settled = true`) |
| -------------------- | ----------------------------- | -------------------------- |
| **Meaning**          | Card batch still open         | Card batch closed          |
| **Cancel/Void**      | Yes                           | No                         |
| **Reopen**           | Yes                           | No                         |
| **Adjust Tip**       | Yes (with conditions)         | No                         |
| **Refund (full)**    | No                            | Yes (with conditions)      |
| **Refund (partial)** | No                            | Yes (with conditions)      |
| **Send Receipt**     | Yes                           | Yes                        |

The portal does NOT control when batches close — this happens automatically (typically daily at the time configured in `merchant_setting.batch_close_time`).

---

## 3\. Order Status Lifecycle

```
                          +-------------------------------------+
                          |                                     |
  +---------+    payment  |  +------------+                     |
  | pending |------------>|  | successful |                     |
  +---------+             |  +-----+------+                     |
                          |        |                            |
               +----------+--------+------------+               |
               |          |        |            |               |
          [unsettled]     |   [settled]    [unsettled]          |
               |          |        |            |               |
               v          |        v            v               |
        +----------+      |  +----------+  +----------+        |
        |canceling |      |  |refunding |  | re_open  |--------+
        +----+-----+      |  +----+-----+  +----------+
             |            |       |          (back to successful
        +----+----+       |  +----+----+     after re-checkout)
        |         |       |  |         |
        v         v       |  v         v
  +----------+ +--------+ | +--------+ +------------------+
  | canceled | |cancel_ | | |refunded| |partial_refunded  |
  +----------+ | issue  | | +--------+ +-------+----------+
               +--------+ |                    |
                           |              [can refund again]
                           |                    |
                           |                    v
                           |              +----------+
                           |              |refunding |--> refunded / partial_refunded
                           |              +----+-----+
                           |                   |
                           |                   v
                           |             +-----------+
                           |             |refund_    |
                           |             |  issue    |
                           |             +-----------+
                           +----------------------------
```

### Transition rules

| From                     | To                 | Trigger                     |
| ------------------------ | ------------------ | --------------------------- |
| `pending`                | `successful`       | Payment completed           |
| `successful` (unsettled) | `canceling`        | Cancel initiated            |
| `successful` (settled)   | `refunding`        | Refund initiated            |
| `successful` (unsettled) | `re_open`          | Reopen initiated            |
| `canceling`              | `canceled`         | Cancel succeeded            |
| `canceling`              | `cancel_issue`     | Cancel failed               |
| `cancel_issue`           | `canceling`        | User retries cancel         |
| `refunding`              | `refunded`         | Full refund succeeded       |
| `refunding`              | `partial_refunded` | Partial refund succeeded    |
| `refunding`              | `refund_issue`     | Refund failed               |
| `partial_refunded`       | `refunding`        | Another refund initiated    |
| `re_open`                | `successful`       | Re-checkout completed       |
| `re_open`                | `canceling`        | User cancels reopened order |

### Transitional state blocking

When an order is in `refunding` or `canceling`, **all actions must be blocked**. The user must wait for the operation to complete or fail before taking another action.

---

## 4\. Action Conditions & Flows

### 4.1 Full Refund

**All conditions must be true:**

| \#  | Condition                                                                          |
| --- | ---------------------------------------------------------------------------------- |
| 1   | Order `settled = true`                                                             |
| 2   | Order `status` is `successful` or `partial_refunded`                               |
| 3   | Order has at least one non-gift-card payment (cannot refund gift-card-only orders) |
| 4   | Order is NOT in a transitional state (`refunding`, `canceling`)                    |
| 5   | User has `refund` permission                                                       |

**Required input:** Reason (see [Section 5](#5-reasons))

**What happens on execution:**

1. Order status changes to `refunding`
2. A refund transaction is created for each original sale transaction, linked via `reference_id`
3. Card transactions: process refund through payment gateway
4. Cash / gift card / other: record the refund (no gateway needed)
5. Each refund transaction amount = original sale amount (excluding tip for card payments)
6. Update `refunded_amount` on all order items
7. Update `refunded_amount` on all tip shares
8. **Success** → status becomes `refunded`
9. **Failure** → status becomes `refund_issue` (no auto-retry, requires manual resolution)

---

### 4.2 Partial Refund

**All conditions must be true:**

| \#  | Condition                                                                  |
| --- | -------------------------------------------------------------------------- |
| 1   | Order `settled = true`                                                     |
| 2   | Order `status` is `successful` or `partial_refunded`                       |
| 3   | The selected transaction exists on this order                              |
| 4   | The selected transaction has remaining refund balance > 0                  |
| 5   | If card payment: card batch must be closed (`batch_closed_at` is not null) |
| 6   | Refund amount > 0                                                          |
| 7   | Refund amount <= remaining balance                                         |
| 8   | Order is NOT in a transitional state                                       |
| 9   | User has `refund` permission                                               |

**Required input:** Transaction ID, refund amount (integer cents). Reason is optional.

**Remaining balance calculation:**

- **Card payments:** `remaining = original_amount - original_tip - SUM(previous refunds on this transaction)`
  - Card refunds exclude the tip portion from the refundable amount
- **Cash / gift card / other:** `remaining = original_amount - SUM(previous refunds on this transaction)`

"Previous refunds" = all transactions where `reference_id` points to the target transaction and `transaction_type = 'refund'`.

**Condition 5 — batch not closed error message:**

"The transaction batch is not closed. Refund not available until batch is closed."

**What happens on execution:**

1. Order status changes to `refunding`
2. A single refund transaction is created, linked to the target transaction via `reference_id`
3. **Success** → status becomes `partial_refunded`
4. **Failure** → status becomes `refund_issue`

**Note:** A `partial_refunded` order can be refunded again for remaining balances on any transaction, following the same flow.

---

### 4.3 Cancel / Void

**All conditions must be true:**

| \#  | Condition                                                                        |
| --- | -------------------------------------------------------------------------------- |
| 1   | Order `settled = false`                                                          |
| 2   | Order `status` is `successful`, `pending`, `partial_refunded`, or `cancel_issue` |
| 3   | Order is NOT in a transitional state (except `cancel_issue` which allows retry)  |
| 4   | User has `cancel_order_void` permission                                          |

**Required input:** Reason (see [Section 5](#5-reasons))

**What happens on execution:**

1. Order status changes to `canceling`
2. All sale transactions are voided — a new void transaction is created for each, linked via `reference_id`
3. Card transactions: process void through payment gateway
4. **Success** → status becomes `canceled`
5. **Failure** → status becomes `cancel_issue`

**Cancel vs. Refund:** Cancel/void is for **unsettled** orders (batch still open, transactions can be reversed). Refund is for **settled** orders (batch closed, requires a new reverse transaction). This is a payment processor constraint.

**Retry:** `cancel_issue` can be retried from the portal (goes back to `canceling`). `refund_issue` **cannot** be retried from the portal — requires manual resolution.

---

### 4.4 Reopen Order

**All conditions must be true:**

| \#  | Condition                                   |
| --- | ------------------------------------------- |
| 1   | Order `settled = false`                     |
| 2   | Order `status` is `successful` or `re_open` |
| 3   | User has `edit_order` permission            |

If status is already `re_open`, the button label should be "Continue Re-open" instead of "Re-Open Order".

**What happens on execution:**

1. Order status changes to `re_open`
2. Order enters edit mode where the user can:
   - Add / remove / modify line items (service, price, staff assignment, discount)
   - Adjust order-level amounts (subtotal, tax, total, discount, tip)
   - Update notes
3. Order stays in `re_open` until payment is reprocessed → then back to `successful`

---

### 4.5 Adjust Tip

**All conditions must be true:**

| \#  | Condition                                              |
| --- | ------------------------------------------------------ |
| 1   | Order `settled = false`                                |
| 2   | Order `status` is `successful`                         |
| 3   | Merchant's tip timing is configured as `AFTER_PAYMENT` |
| 4   | Order has at least one assigned staff member           |
| 5   | User has `adjust_tip` permission                       |

**Required input:** Transaction ID, new tip amount, split tip will auto convert to `evenly`.

**What happens on execution:**

1. Selected transaction's tip amount is updated
2. Order's total `tip_amount` is recalculated (SUM of all transaction tips)
3. Tip share records are updated based on split method:
   - **Evenly** — tip divided equally among all staff on the order
   - **Proportional** — tip divided based on each staff's service price proportion (`staff's total final_price / order subtotal`)
   - **Manual** — user-specified amounts per staff (must sum to the new tip total)
4. Order's `tip_split_method` is updated

---

### 4.6 Send Receipt

**Conditions:** Any order, any status. User needs `view_orders` permission.

**Required input:** Delivery method (`email` or `sms`) and recipient.

**Validation:**

- Email: valid email format
- SMS: valid phone number (10+ digits)

Pre-fill recipient with the customer's email/phone if available.

---

### 4.7 Export

**Conditions:** Available on the order list view. User needs `export_orders` permission.

**Input:** Current filter state + format choice (`csv` or `pdf`)

**Export columns:** Order Code, Date/Time, Location, Status (including settled/unsettled for successful), Total, Tip, Payment Method(s), Staff Name(s), Customer Name.

---

## 5\. Reasons

Both refund and cancel share the same reason list:

| Value                      | Display label            |
| -------------------------- | ------------------------ |
| `customer_request`         | Customer Request         |
| `service_issue`            | Service Issue            |
| `incorrect_order`          | Incorrect Order          |
| `duplicate_payment`        | Duplicate Payment        |
| `promotion_discount_error` | Promotion/Discount Error |
| `staff_mistake`            | Staff Mistake            |
| `other`                    | Other                    |

- **Required** for: Full refund, Cancel/void
- **Optional** for: Partial refund

---

## 6\. Permission Matrix

| Action                   | Permission key      |
| ------------------------ | ------------------- |
| View order list & detail | `view_orders`       |
| Full refund              | `refund`            |
| Partial refund           | `refund`            |
| Cancel/void              | `cancel_order_void` |
| Reopen order             | `edit_order`        |
| Adjust tip               | `adjust_tip`        |
| Send receipt             | `view_orders`       |
| Export orders            | `export_orders`     |

If the user lacks a permission, the action button is hidden.

---

## 7\. Multi-Location

- A portal user can access **multiple** store locations
- Default view: all orders across all accessible locations
- Location filter narrows to a specific store
- Each order belongs to exactly one location
- If user requests an order from a location they don't have access to, treat as not found

---

## 8\. Order List Filters & Search

| Filter                   | Behavior                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Search by order code** | Partial match, case-insensitive                                                                                           |
| **Search by customer**   | Match on customer name, phone, or email                                                                                   |
| **Location**             | Single-select from user's accessible locations                                                                            |
| **Status**               | Multi-select. `Successful - Settled` and `Successful - Unsettled` are separate options (differentiated by `settled` flag) |
| **Payment method**       | Multi-select: Card, Cash, Gift Card, Other                                                                                |
| **Staff**                | Multi-select: orders where any item was assigned to selected staff                                                        |
| **Date range**           | Presets: Today, Yesterday, Last 7 days, Last 30 days, This month. Also custom range.                                      |
| **Sort by**              | Created date (default) or Updated date. Ascending or descending.                                                          |

**Pagination:** 20 orders per page. Default sort: newest first by created date.

---

## 9\. Issue Status Handling

| Status         | Can retry from portal?                             | Resolution                                           |
| -------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `cancel_issue` | **Yes** — user can retry, goes back to `canceling` | Portal retry or manual resolution                    |
| `refund_issue` | **No** — cannot retry from portal                  | Requires manual resolution via support or POS device |

Both issue statuses should display a message explaining what went wrong.

---

## 10\. Audit Log

This is **new for the portal** — the POS does not have an audit log.

Every action on an order should be logged with:

- **What** happened (action label)
- **Who** did it (staff name, portal user name, or "System")
- **Where** it was done from (`pos` or `portal`)
- **When** it happened
- **Context** (refund amount, reason, etc.)

### Actions to log

| Action                     | When                                  |
| -------------------------- | ------------------------------------- |
| `created`                  | Order first created                   |
| `payment_completed`        | Payment processed successfully        |
| `settled`                  | Batch settled                         |
| `refund_initiated`         | User starts a refund                  |
| `refund_completed`         | Refund succeeds                       |
| `refund_failed`            | Refund fails                          |
| `partial_refund_completed` | Partial refund succeeds               |
| `cancel_initiated`         | User starts a cancel                  |
| `cancel_completed`         | Cancel succeeds                       |
| `cancel_failed`            | Cancel fails                          |
| `reopened`                 | Order reopened for editing            |
| `order_updated`            | Reopened order items/amounts modified |
| `tip_adjusted`             | Tip amount changed                    |
| `receipt_sent`             | Receipt emailed or SMS'd              |

Entries are displayed chronologically (oldest first) in the order detail view.

---

## 11\. Transaction Reference Chain

When a refund or void happens, a new transaction record is created with:

- `transaction_type`: `refund` or `void`
- `reference_id`: points to the original `sale` transaction

This chain enables:

- Tracking which payment was refunded/voided
- Calculating remaining refund balance per transaction
- Grouping related transactions in the detail view (original sale + all its refunds/voids shown together)

---

## 12\. Money Rules

- All amounts stored as **integer cents** (e.g., $50.00 = `5000`)
- Never use floating point for money calculations
- Currency code accompanies all amounts
- Frontend displays using `money()` helper

---

## 13\. Tip Split Methods

| Method           | Calculation                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Evenly**       | Equal share to all staff on the order                                                        |
| **Proportional** | Based on each staff's service price relative to total (`staff_final_price / order_subtotal`) |
| **Manual**       | Specific amounts assigned per staff by the user                                              |

---

## 14\. POS Parity Notes

The portal and POS both operate on the same cloud database. Key consistency requirements:

1. **Same data shape** — Refund/cancel results must be identical whether initiated from POS or portal (same transaction records, same status transitions, same `refunded_amount` updates).
2. **Status values are exact lowercase strings** — `pending`, `successful`, `canceled`, `canceling`, `cancel_issue`, `refunded`, `partial_refunded`, `refund_issue`, `refunding`, `re_open`.
3. **Settled flag** is set to `true` when the card batch closes (a payment processor operation). Neither POS nor portal controls when this happens.
4. **Tip adjustments** must update: the transaction's `tip`, the order's `tip_amount`, and the `order_tip_share` records — same as POS does.

---

## 15\. Summary of Action Eligibility (Quick Reference)

| Action               | Settled? | Allowed statuses                                            | Extra conditions                                     |
| -------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| **Refund (full)**    | Yes      | `successful`, `partial_refunded`                            | Not gift-card-only                                   |
| **Refund (partial)** | Yes      | `successful`, `partial_refunded`                            | Transaction has remaining balance; card batch closed |
| **Cancel/Void**      | No       | `successful`, `pending`, `partial_refunded`, `cancel_issue` | —                                                    |
| **Reopen**           | No       | `successful`, `re_open`                                     | —                                                    |
| **Adjust Tip**       | No       | `successful`                                                | Tip timing = AFTER_PAYMENT; has staff                |
| **Send Receipt**     | Any      | Any                                                         | Valid email or phone                                 |
| **Export**           | Any      | Any                                                         | —                                                    |

---

_Source: Google Docs — "Portal Order History" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
