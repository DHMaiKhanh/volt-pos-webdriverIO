---
title: '📋 VOLT POS — Release Notes'
source: https://linear.app/fastboy/document/volt-pos-release-notes-10de31de66dd
linear_id: 989ed4ee-c4b9-4a58-a7a1-788715f3c1b8
team: VOLT
updated: 2026-06-18T05:22:25.440Z
---

# 📋 VOLT POS — Release Notes

📌 Source of truth: Linear

Living changelog for VOLT POS — newest release on top. End-user-facing notes; internal back-end/refactor items are listed separately for traceability only.

---

# v1.0.31

**Release date:** June 18, 2026

This release adds check management and payroll-check printing, expands customer tools, and delivers a large accuracy fix across the Income/Reports suite. _(Issue references in parentheses for internal traceability.)_

## 🚀 New Features

**Split Order & Check Management** ([VP-206](https://linear.app/fastboy/issue/VP-206/split-order-and-check-management))

- Split a single order into multiple checks, either **By Amount** or **Equally**.
- **Merge Checks** and merge in-progress orders at checkout ([VP-1708](https://linear.app/fastboy/issue/VP-1708/pos-merge-checks), [VP-1784](https://linear.app/fastboy/issue/VP-1784/pos-merge-order-merge-processing-orders-at-checkout)).

**Print Check — Portal** ([VP-1435](https://linear.app/fastboy/issue/VP-1435/portal-print-check), [VP-1625](https://linear.app/fastboy/issue/VP-1625/fe-print-check))

- **Bank Account Management** for paycheck printing ([VP-1751](https://linear.app/fastboy/issue/VP-1751/bank-account-management)).
- **Check List** with Add Staff and Signature support ([VP-1752](https://linear.app/fastboy/issue/VP-1752/check-list-add-staff-signature)).
- **Check Detail** view ([VP-1753](https://linear.app/fastboy/issue/VP-1753/check-detail)).

**Edit Customer — Portal** ([VP-1785](https://linear.app/fastboy/issue/VP-1785/portal-edit-customer), [VP-1624](https://linear.app/fastboy/issue/VP-1624/fe-edit-customer)) — edit customer details directly from the Portal.

**Customer Search by Name or Email** ([VP-1235](https://linear.app/fastboy/issue/VP-1235/support-customer-search-by-name-on-create-order-screen), [VP-1755](https://linear.app/fastboy/issue/VP-1755/pos-support-customer-search-by-name-on-create-order-screen)) — find existing customers by name or email on the Create Order screen.

**Staff Payroll — Salary Type** ([VP-1341](https://linear.app/fastboy/issue/VP-1341/staff-payroll-calculation-salary-type)) — payroll now supports salary-type staff in addition to commission.

**Appointment Tags on Check-in** ([VP-1775](https://linear.app/fastboy/issue/VP-1775/pos-display-appointment-tag-on-check-in-today-records-linked-to), [VP-1783](https://linear.app/fastboy/issue/VP-1783/pos-display-appointment-tag-on-check-in-today-records-linked-to)) — check-in records linked to an appointment now display the appointment tag; improved tag display on order cards ([VP-1823](https://linear.app/fastboy/issue/VP-1823/pos-improve-display-tag-on-order-card-tag-tren-order-card)).

**Sync with Business Hours** ([VP-1170](https://linear.app/fastboy/issue/VP-1170/add-sync-with-business-hours-button-in-employee-settings-work-hours), [VP-1756](https://linear.app/fastboy/issue/VP-1756/pos-add-sync-with-business-hours-button-in-employee-settings-work)) — new button in Employee Settings → Work Hours to sync an employee's hours to the business hours.

## ✨ Improvements

- **Appointment page UI** — wider, clearer appointment cards ([VP-1895](https://linear.app/fastboy/issue/VP-1895/pos-improve-appointment-overview-layout)); cleaner overall layout ([VP-1284](https://linear.app/fastboy/issue/VP-1284/improve-appointment-page-ui), [VP-1616](https://linear.app/fastboy/issue/VP-1616/pos-improvement-appointment)).
- **Order History** — display card brand + last 4 digits and a quick date filter ([VP-1856](https://linear.app/fastboy/issue/VP-1856/portal-order-history-show-card-brand-last4-quick-date-filter)); show order _create_ time ([VP-1826](https://linear.app/fastboy/issue/VP-1826/order-history-display-create-order-time-instead-of-complete-order-time)); hide the Refund button on $0 orders ([VP-1811](https://linear.app/fastboy/issue/VP-1811/improvement-production-order-history-disablehide-refund-button-for)).
- **Merchant Overview** — added metric descriptions to summary cards ([VP-1799](https://linear.app/fastboy/issue/VP-1799/add-metric-descriptions-to-merchant-overview-summary-cards)).
- **Order Detail / Payment Detail** — improved layout and added payment info ([VP-1371](https://linear.app/fastboy/issue/VP-1371/improve-ui-order-detail-payment-detail), [VP-1372](https://linear.app/fastboy/issue/VP-1372/be-support-get-information)).
- **Staff income commission rate** enhancement ([VP-1889](https://linear.app/fastboy/issue/VP-1889/staff-income-commission-rate-enhancement)).
- **Inactive staff** — defined behavior when tapping inactive-staff notifications; checkout from an appointment with a pending order now opens that order ([VP-1244](https://linear.app/fastboy/issue/VP-1244/define-system-behavior-when-clicking-notifications-of-inactive-staff), [VP-1325](https://linear.app/fastboy/issue/VP-1325/pos-checkout-from-appointment-with-pending-order-should-redirect-to)).

## 🐛 Bug Fixes

**Income & Reports accuracy** ([VP-1711](https://linear.app/fastboy/issue/VP-1711/list-bug-production-income-summary-daily-sale-report-staff-income))

- Gross Income now correctly subtracts discounts ([VP-1805](https://linear.app/fastboy/issue/VP-1805/production-income-summary-gross-income-tinh-sai-khong-tru-discount)).
- Total Staff Payout now includes Staff Salary and uses the correct Clean Up Fee ([VP-1713](https://linear.app/fastboy/issue/VP-1713/income-summary-total-staff-payout-tinh-sai-bo-sot-staff-salary-and)).
- Staff/Salon Supply Share now splits correctly by commission % and no longer rounds inconsistently ([VP-1712](https://linear.app/fastboy/issue/VP-1712/production-income-summary-staffsalon-supply-share-tinh-sai-khong-chia), [VP-1714](https://linear.app/fastboy/issue/VP-1714/income-summary-salon-earnings-tinh-sai-do-salon-supply-share-sai), [VP-1798](https://linear.app/fastboy/issue/VP-1798/production-income-summary-staffsalon-supply-share-lam-tron-lech), [VP-1861](https://linear.app/fastboy/issue/VP-1861/staff-supply-share-hien-thi-2-gia-tri-khac-nhau-trong-income-summary), [VP-1868](https://linear.app/fastboy/issue/VP-1868/staff-salon-supply-share-khong-cong-khop-total-supply-fee-giua-cac)).
- Tip totals now match between Income Summary blocks ([VP-1874](https://linear.app/fastboy/issue/VP-1874/tip-lech-dollar004-giua-cac-block-trong-income-summary-total-tip)).
- Staff Income detail panel now shows the selected staff ([VP-1884](https://linear.app/fastboy/issue/VP-1884/staff-income-click-vao-1-staff-nhung-panel-chi-tiet-hien-thi-thong-tin)).
- Date-range filter no longer drops current-day (End Date) orders ([VP-1810](https://linear.app/fastboy/issue/VP-1810/production-staff-income-loi-bo-loc-khoang-ngay-bo-sot-toan-bo-djon)); $0 refund orders now appear in the detail list ([VP-1808](https://linear.app/fastboy/issue/VP-1808/production-staff-income-djon-hang-refund-0dj-cua-nhan-vien-khong-hien)).
- Orders created today now appear in Daily Sale Report, Income Summary & Staff Income ([VP-1725](https://linear.app/fastboy/issue/VP-1725/order-tao-trong-ngay-khong-hien-thi-o-daily-sale-report-income-summary)).
- **Receipt printing** — correct "Sale Details" heading ([VP-1832](https://linear.app/fastboy/issue/VP-1832/receipt-printing-sai-tua-dje-khoi-du-lieu-hien-thi-income-details-thay)); refund minus sign restored in Sale/Refund & Supply columns ([VP-1813](https://linear.app/fastboy/issue/VP-1813/receipt-printing-djon-hang-refund-hien-thi-sai-djinh-dang-thieu-dau)); tax note line no longer wraps/misaligns ([VP-1812](https://linear.app/fastboy/issue/VP-1812/receipt-printing-dong-ghi-chu-tax-bi-vo-thanh-2-dong-va-lech-hang-tren)).
- Daily Sale Report date picker redesigned ([VP-1687](https://linear.app/fastboy/issue/VP-1687/ui-redesign-calendar-date-picker-tren-daily-sale-report), [VP-1631](https://linear.app/fastboy/issue/VP-1631/hien-thi-mo-ta-cua-card-dang-text-co-djinh-thay-vi-tooltip)).

**Split Order**

- Cash Drawer button now works and only appears for Cash payments ([VP-1932](https://linear.app/fastboy/issue/VP-1932/split-order-button-cash-drawer-chua-hoat-djong-va-hien-thi-sai-theo)).
- "By Amount" split totals now match the order total — no missing money ([VP-1919](https://linear.app/fastboy/issue/VP-1919/split-order-by-amount-tong-cac-check-khong-khop-tong-order-bi-thieu)); "Equally" totals corrected ([VP-1891](https://linear.app/fastboy/issue/VP-1891/sai-lech-tong-tien-khi-split-order-equally)).
- Fixed $0.01 orders being splittable and $0.00 checks being unpayable ([VP-1867](https://linear.app/fastboy/issue/VP-1867/order-dollar001-van-split-djuoc-check-dollar000-khong-the-pay)); added scrollbar to the check list ([VP-1864](https://linear.app/fastboy/issue/VP-1864/split-order-check-list-thieu-scrollbar)).

**Appointments**

- Staff work hours now show on Fridays when enabled ([VP-1839](https://linear.app/fastboy/issue/VP-1839/appointment-khong-hien-thi-gio-lam-viec-cua-staff-vao-thu-6-du-work)).
- Calendar shows day numbers and allows selecting future dates ([VP-1837](https://linear.app/fastboy/issue/VP-1837/calendar-khong-cho-chon-ngay-trong-tuong-lai), [VP-1838](https://linear.app/fastboy/issue/VP-1838/calendar-mat-hien-thi-so-ngay-o-cac-ngay-tuong-lai)).
- Correct layout for bookings that cross midnight ([VP-1758](https://linear.app/fastboy/issue/VP-1758/appointment-hien-thi-sai-layout-khi-booking-keo-dai-qua-1200-am-qua)).

**Payroll & Pay Periods**

- Weekly pay period now uses the correct date range ([VP-1842](https://linear.app/fastboy/issue/VP-1842/bug-prod-weekly-pay-period-calculated-with-incorrect-date-range)) and periods display in the correct order ([VP-1841](https://linear.app/fastboy/issue/VP-1841/bug-prod-portal-payroll-periods-displayed-in-incorrect-order)).
- Total Payment by Hour calculation corrected ([VP-1827](https://linear.app/fastboy/issue/VP-1827/bug-portal-total-payment-by-hour-calculation-incorrect)).
- Tips are no longer added to pay when "Exclude Tips From Cash/Check Income" is enabled ([VP-1791](https://linear.app/fastboy/issue/VP-1791/tip-van-cong-vao-luong-khi-bat-exclude-tips-from-cashcheck-income)).

**Customer**

- Customer page now refreshes when switching merchants on the Portal ([VP-1899](https://linear.app/fastboy/issue/VP-1899/bugportal-customer-page-khong-refresh-khi-switch-merchant)).
- Search by email now works on Create Order ([VP-1894](https://linear.app/fastboy/issue/VP-1894/create-order-khong-tim-djuoc-khach-hang-bang-email-search-by-email)); fixed result rows overlapping with long names ([VP-1893](https://linear.app/fastboy/issue/VP-1893/customer-search-loi-vo-giao-dien-cac-dong-ket-qua-bi-chong-chap-dje)).

**Other**

- Inactive staff: canceling the change-staff prompt no longer creates an order for an inactive staff ([VP-1769](https://linear.app/fastboy/issue/VP-1769/inactive-staff-nhan-cancel-o-prompt-djoi-staff-van-tao-djuoc-order-cho)); removed quotes around staff names in notifications ([VP-1768](https://linear.app/fastboy/issue/VP-1768/notification-bo-dau-ngoac-kep-quanh-ten-staff-trong-thong-bao-inactive)).
- Corrected time-tracking modal titles ([VP-1779](https://linear.app/fastboy/issue/VP-1779/time-keeping-thieu-khoang-trang-timekeeping-phai-la-time-keeping), [VP-1562](https://linear.app/fastboy/issue/VP-1562/topic-13-incorrect-titles-in-time-tracking-modals)).
- Gift card history now shows top-ups in the correct order after offline sync ([VP-1549](https://linear.app/fastboy/issue/VP-1549/gift-card-history-hien-thi-sai-thu-tu-top-up-sau-khi-sync-tu-offline)).
- Tip Settings no longer allows a $0.00 / 0% option ([VP-1745](https://linear.app/fastboy/issue/VP-1745/validation-tip-settings-cho-phep-them-option-voi-gia-tri-0-dollar000)).
- "Do not require passcode" checkbox can now be checked ([VP-1722](https://linear.app/fastboy/issue/VP-1722/cannot-check-do-not-require-passcode-checkbox-on-passcode-popup)).
- Card Charge Fee fix ([VP-1871](https://linear.app/fastboy/issue/VP-1871/bug-card-charge-fee)).
- Pending Orders now show the date (not just the time) when filtering across multiple days ([VP-1728](https://linear.app/fastboy/issue/VP-1728/pending-orders-chi-hien-thi-gio-tao-djon-thieu-ngay-khi-filter-theo)).

---

_Internal-only (not user-visible) — for traceability:_ [VP-1726](https://linear.app/fastboy/issue/VP-1726/be-implement-vp-1693-optimize-staff-queries-fix-inactive-staff-unify)_,_ [VP-1618](https://linear.app/fastboy/issue/VP-1618/be-fix-staff-summary-response-format-remove-ldjson-wrapper)_,_ [VP-1764](https://linear.app/fastboy/issue/VP-1764/upgrade-payment-api-add-x-gci-service-header-for-payment-routing)_,_ [VP-1693](https://linear.app/fastboy/issue/VP-1693/optimize-payroll-staff-query-to-avoid-iterating-all-historical-staff)_,_ [VP-1836](https://linear.app/fastboy/issue/VP-1836/rust-report-staff-today)_,_ [VP-1792](https://linear.app/fastboy/issue/VP-1792/rust-exclude-tips-from-cashcheck-income)_,_ [VP-1851](https://linear.app/fastboy/issue/VP-1851/be-tip-for-staff-0-when-function-exclude-tip-from-cashcheck-enable)_,_ [VP-1814](https://linear.app/fastboy/issue/VP-1814/fix-vp-1808)_,_ [VP-1875](https://linear.app/fastboy/issue/VP-1875/fix-vp-1874)_,_ [VP-1209](https://linear.app/fastboy/issue/VP-1209/pos-update-all-claude-configurations)_,_ [VP-1820](https://linear.app/fastboy/issue/VP-1820/fe-integrate-updated-api-for-bank-account-management)_,_ [VP-1821](https://linear.app/fastboy/issue/VP-1821/fe-integrate-updated-api)_,_ [VP-1822](https://linear.app/fastboy/issue/VP-1822/fe-integrate-updated-api-for-history-and-audit-log)_,_ [VP-1877](https://linear.app/fastboy/issue/VP-1877/fe-update-payload-for-edit-customer)_,_ [VP-778](https://linear.app/fastboy/issue/VP-778/order-history)_,_ [VP-1869](https://linear.app/fastboy/issue/VP-1869/pos-improvement-ui)_,_ [VP-1705](https://linear.app/fastboy/issue/VP-1705/pos-split-order-and-check-management)_,_ [VP-963](https://linear.app/fastboy/issue/VP-963/portal-daily-sale-report-income-summary-staff-income)_,_ [VP-734](https://linear.app/fastboy/issue/VP-734/integration-time-tracking-management)_,_ [VP-1548](https://linear.app/fastboy/issue/VP-1548/list-bug-offline-gift-card-sale)_,_ [VP-1740](https://linear.app/fastboy/issue/VP-1740/list-bug-time-tracking-management)_,_ [VP-1767](https://linear.app/fastboy/issue/VP-1767/list-bug-inactive-staff-notification)_,_ [VP-1627](https://linear.app/fastboy/issue/VP-1627/list-bug-daily-sale-report)_,_ [VP-1744](https://linear.app/fastboy/issue/VP-1744/list-bug-charge-and-fee)_,_ [VP-1634](https://linear.app/fastboy/issue/VP-1634/pos-improve-pending-order)_,_ [VP-1892](https://linear.app/fastboy/issue/VP-1892/list-bug-support-customer-search-by-name-on-create-order-screen)_._
