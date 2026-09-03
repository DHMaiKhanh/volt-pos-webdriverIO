---
title: 'Merchants Management'
source: https://linear.app/fastboy/document/merchants-management-2f21dec89944
linear_id: 1f382a86-58f9-4b3c-90f7-8f26c43650b3
team: VOLT
updated: 2026-06-11T09:59:45.913Z
---

# Merchants Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

# **Merchants Management**

Left Sidebar Menu (Navigation Panel): Purpose: Provides quick access to various settings for the business. Clicking on each item will bring up the corresponding setting page.

- General Settings (Main section for configuring business-wide settings)
  - Business Profile
  - POS Package
  - Payment & Transactions
- Services & Products Management
- Employee Management

1. **General Settings Page (Main Area)**

- Once you click on General Settings from the sidebar menu, the user is directed to the General Settings Dashboard.
- General Settings Dashboard: The user can click on each tab to go directly to the respective section.
  - Business Profile
  - POS Package
  - Payment & Transactions
- **Business Profile:** Includes the following fields
  - Business Name: Text field but unable to edit unless admin role
  - Business Legal Name: Text field but unable to edit unless admin role.
  - Business Address: Unable to edit unless admin role.
    - Address: Text input for the business address.
    - City: Text input
    - State: Dropdown select a state and able to search
    - Zip code: Numeric input
    - Country: Dropdown select a country and able to search
  - Contact Owner Information:
    - Phone Number: Text input for the contact number.
    - Email: Text input for the business email.
    - Website URL: Text input for the business website link.
  - Business Hours: Toggle Open/Close per day and time picker for each open day.
  - Logo Upload: Button to upload the business logo (.png or jpg file - max 5MB).
  - Welcoming Sign Upload: Button to upload the welcoming sign which will be displayed on the customer view screen. If no image is uploaded then using a default welcoming sign. (.png or jpg file - max 5MB).
  - Info message: If you need to update business name, legal name or address, please contact Fastboy support at (832) 968 6668
  - Contact CRM (View only):
    - Retrieve data from the CRM, including: Phone, Business Phone, Email, Role, and Name of each contact.
    - Include both active and inactive contacts, but highlight active contacts.
  - Buttons:
    - Save: To save any changes to business profile settings.
    - Cancel: To discard changes and return to the General Settings page.

—----------------------------------------------------------------------------------------------------

- **POS Package:**
  - Show 3 POS packages; clicking on each package will display a list of the main features included in that package, allowing users to view the detailed content of each package.
  - Displaying the select button, there must always be a product package selected for that merchant.
    - GO POS BASIC
    - GO POS DELUXE
    - GO POS PREMIUM
  - Gán Package cho Merchant
- Mỗi merchant chỉ được gán 1 package tại 1 thời điểm
- Package được gán kèm:
  - Package name (Basic / Deluxe / Premium)
  - Effective date
- Effective date là ngày package bắt đầu có hiệu lực
- Trước effective date: Merchant vẫn sử dụng package cũ
- Đến effective date: Hệ thống tự động áp dụng package mới
- Không cho phép: 2 package cùng active
  - UI tham khảo:

| \-------------------------------------------------- |
| --------------------------------------------------- |
| CURRENT PACKAGE                                     |
|                                                     |
| Package: Deluxe                                     |
| Effective from: 01/01/2026                          |
| Status: Active                                      |
|                                                     |
|                                                     |
|                                                     |
| SCHEDULE NEW PACKAGE                                |
|                                                     |
| Package: \[ Premium \] \[dropdown\]                 |
| Effective date: \[ 01/02/2026 \]                    |
|                                                     |
| \[ Save Changes \]                                  |
|                                                     |

—----------------------------------------------------------------------------------------------------

- **Payment & Transactions:** includes the following subsections
  - Payment Methods: checkbox option
    - Credit Card: Checkbox to enable credit card payments.
    - Cash: Checkbox to enable cash payments.
    - Gift Cards: Checkbox to enable gift card payments.
    - Others: Checkbox to enable external payments.
  - Tax Settings:
    - Tax: Numeric input for sales tax percentage (e.g., 8% for services and products).
    - Tax Inclusive or Exclusive: Radio buttons to choose whether tax is included in the service/product price or added during checkout.
    - Tax Exemption: Checkbox to select tax-exempt services/products (e.g., medical treatments).
  - Tipping Setting:
    - Tip Acceptance:
      - Radio button: YES / NO to enable the "Ask for Tip" feature.
      - If YES is selected, display the following sections:
    - When Ask for Tip & Signature: Radio button options
      - Sign and leave a tip on the printed receipt.
      - Sign and leave tip before payment
      - Tip before, sign after payment success
    - Tip Options:
      - Description: Configure up to 4 default tip options for customers to select on the terminal during payment, or display these suggestions at the bottom of the printed receipt.
      - Show Tip In: Radio button: % / $.
      - Based on selections, display 4 numeric input boxes (for percentage or fixed amount).
      - Each option can have an optional label
      - Default setup: 15% , 18% , 20% , 25%
    - Tip Payment Method: Allow Tip By: Checkboxes to select applicable payment methods (Card, Cash, Gift Card, Others, etc.).
  - Receipt Setting:
    - Receipt Customize:
      - Receipt Types: Dropdown with options: Order, Gift Card, Gift Card Balance Check, Cancelled, Refund, etc.
      - Receipt Content: Checkbox list. Display based on selected receipt type. User can toggle switch info to show on receipt
    - Receipt Delivery Method: Checkbox list with options: Print paper receipt, Send e-receipt via email, Send e-receipt via phone number
  - Buttons:
    - Save: save all changes but not push the updates to devices
    - Cancel: cancel all changes
    - Publish to all devices: only enable when having any change. There are 2 options: Now or Schedule publish time.

---

_Source: Google Docs — "Merchants Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
