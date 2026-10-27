/**
 * volt-qc per-ticket rows that the WDIO lane cannot automate — one Mocha pending
 * test per row, grouped by ticket. Each row is `[id, summary, reason]`; the
 * reason is why the row needs a human (Portal web, CSV import, overnight jobs,
 * card terminals, printers, a second till, a cut network, staged data).
 *
 * Automated rows of the same tickets live in tests/regression/volt-qc/vp-tickets/.
 * The coverage script counts a row as MANUAL only when every spec naming it is
 * under a `_manual/` folder, so the automated specs do not mention these ids.
 */

import { manualRows } from '../vp-tickets/vp-tickets.helpers.js';

describe('card-charge-payment-success-fail-test-cases — manual rows (from vp-tickets/card-charge-payment-success-fail.spec.ts)', () => {
  const TERMINAL = 'needs a card terminal and a specific test card / fault staged by an operator';
  manualRows([
    ['card-charge-payment-success-fail-test-cases A4', 'Tip entered on the card reader', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases A5',
      'Several different cards for several orders in a day',
      TERMINAL,
    ],
    [
      'card-charge-payment-success-fail-test-cases A6',
      'Retry after a soft failure succeeds the second time',
      TERMINAL,
    ],
    ['card-charge-payment-success-fail-test-cases A8', 'Contactless / tap payment', TERMINAL],
    ['card-charge-payment-success-fail-test-cases A9', 'Offline signature instead of PIN', TERMINAL],
    ['card-charge-payment-success-fail-test-cases B1', 'Declined — insufficient funds', TERMINAL],
    ['card-charge-payment-success-fail-test-cases B2', 'Expired card', TERMINAL],
    ['card-charge-payment-success-fail-test-cases B3', 'Network / terminal lost mid-processing', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases B4',
      'Timeout but the bank approved (delayed response)',
      TERMINAL,
    ],
    ['card-charge-payment-success-fail-test-cases B5', 'Customer cancels on the terminal', TERMINAL],
    ['card-charge-payment-success-fail-test-cases B6', 'Card reported lost / stolen', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases B7',
      'Wrong amount sent to the terminal (rounding / tip)',
      TERMINAL,
    ],
    ['card-charge-payment-success-fail-test-cases B8', 'Charge recorded against the wrong order', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases B9',
      'Card brand the terminal does not support (Amex)',
      TERMINAL,
    ],
    ['card-charge-payment-success-fail-test-cases B11', 'Partial approval', TERMINAL],
    ['card-charge-payment-success-fail-test-cases B12', 'Refund declined by the gateway', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases B13',
      'Power loss / app crash while the terminal processes',
      TERMINAL,
    ],
    [
      'card-charge-payment-success-fail-test-cases B14',
      'Test/demo card in production',
      `${TERMINAL}; production only`,
    ],
    [
      'card-charge-payment-success-fail-test-cases B15',
      'Charge amount 0 or negative (order bug)',
      `${TERMINAL}; needs a $0 card checkout state the cart refuses to build`,
    ],
    ['card-charge-payment-success-fail-test-cases B16', 'Daily card limit exceeded', TERMINAL],
    [
      'card-charge-payment-success-fail-test-cases B17',
      'Bluetooth / USB terminal drops mid-transaction',
      TERMINAL,
    ],
    [
      'card-charge-payment-success-fail-test-cases B18',
      'Charge succeeds but receipt print fails',
      `${TERMINAL}; needs a printer`,
    ],
  ]);
});

describe('card-charge-test-cases — manual rows (from vp-tickets/card-charge.spec.ts)', () => {
  const ORDERS =
    'needs orders of a configured staff (card_comm% / card_tip%) paid with a chosen tender mix in one pay period';
  manualRows([
    ['card-charge-test-cases A1', 'Commission staff, order paid by Card → card charge applied', ORDERS],
    ['card-charge-test-cases A2', 'Commission staff, order paid by Cash → no card charge', ORDERS],
    ['card-charge-test-cases A3', 'Commission staff, order paid by Gift Card → no card charge', ORDERS],
    ['card-charge-test-cases A4', 'Split Card + Cash → charge only on the card part', ORDERS],
    ['card-charge-test-cases A5', 'Supply fee on a card-paid service', ORDERS],
    ['card-charge-test-cases A6', 'Tip by Card, service by Cash', ORDERS],
    ['card-charge-test-cases A7', 'Commission + Salary staff, Commission > Salary in the period', ORDERS],
    ['card-charge-test-cases A8', 'Salary staff receiving a card tip', ORDERS],
    ['card-charge-test-cases A9', 'Refund of a card-charged order', `${ORDERS}; refund moves money`],
    ['card-charge-test-cases A10', 'Many card orders in the period, no cash order', ORDERS],
    [
      'card-charge-test-cases A11',
      'card_comm% = 0 disables the fee',
      'needs the staff card_comm% set to 0 (Portal)',
    ],
    ['card-charge-test-cases A13', 'TOTAL STAFF PAYOUT deducts the card charge', ORDERS],
    ['card-charge-test-cases A14', 'Salon TOTAL EARNING adds the card charge back', ORDERS],
    ['card-charge-test-cases B2', 'Commission + Salary, Salary > Commission, still charged', ORDERS],
    [
      'card-charge-test-cases B3',
      'Partial refund does not reduce the card charge',
      `${ORDERS}; refund moves money`,
    ],
    ['card-charge-test-cases B4', 'Supply fee deducted twice', ORDERS],
    ['card-charge-test-cases B5', 'Split payment treated as all-card', ORDERS],
    ['card-charge-test-cases B6', 'Gift card mistaken for card and charged', ORDERS],
    ['card-charge-test-cases B7', 'Cash tip counted in Card Charge – Tip', ORDERS],
    [
      'card-charge-test-cases B8',
      'card_comm% / card_tip% empty or null',
      'needs a staff with blank card fee settings (Portal)',
    ],
    [
      'card-charge-test-cases B9',
      'Staff changes compensation path mid-period',
      'needs a compensation change inside an open period',
    ],
    ['card-charge-test-cases B10', 'Multi-staff service on one order', ORDERS],
    ['card-charge-test-cases B12', 'TOTAL STAFF PAYOUT deducts the card charge twice', ORDERS],
    ['card-charge-test-cases B13', 'Salon earning does not add the card charge back', ORDERS],
    [
      'card-charge-test-cases B14',
      'Open payroll estimates the wrong active path',
      'needs a Commission + Salary staff in an open period',
    ],
    ['card-charge-test-cases B15', 'Voided card order still charged', `${ORDERS}; needs a voided card order`],
    ['card-charge-test-cases B16', 'Rounding drift of card_comm% on odd amounts', ORDERS],
    [
      'card-charge-test-cases B17',
      'Different card brands with different fees',
      'needs per-brand fee config and cards of each brand',
    ],
    [
      'card-charge-test-cases B18',
      'Card charge applied to product lines too',
      `${ORDERS}; needs a product sold to the staff`,
    ],
  ]);
});

describe('gift-card-pos-test-cases — manual rows (from vp-tickets/gift-card-pos.spec.ts)', () => {
  manualRows([
    [
      'gift-card-pos-test-cases TC-05',
      'Scan the QR / barcode of a physical card',
      'needs a physical card and a scanner',
    ],
    [
      'gift-card-pos-test-cases TC-10',
      "History rows match the card's past orders",
      "needs the card's order list from CRM to cross-check",
    ],
    [
      'gift-card-pos-test-cases TC-23',
      'Add the gift card to the order',
      'Add writes a line and reserves the card; the cart line has no testid on 1.1.x',
    ],
    [
      'gift-card-pos-test-cases TC-24',
      'Update value / bonus / discount after adding',
      'needs an added gift-card line (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-25',
      'Gift card needs no staff',
      'needs an added gift-card line (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-26',
      'Gift card is not tied to a customer',
      'needs an added gift-card line (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-27',
      'A card cannot sit in two processing orders',
      'needs two open orders holding the same card',
    ],
    [
      'gift-card-pos-test-cases TC-28',
      'The card is reusable once the first order closes',
      'needs the first order closed (settles money)',
    ],
    [
      'gift-card-pos-test-cases TC-29',
      'Pay a gift-card sale with each payment method',
      'settles money (card needs a terminal)',
    ],
    [
      'gift-card-pos-test-cases TC-30',
      'Selling a gift card records no revenue yet',
      'needs a settled sale + report refresh',
    ],
    [
      'gift-card-pos-test-cases TC-31',
      'Revenue is recorded on redeem',
      'needs a redemption + report refresh',
    ],
    [
      'gift-card-pos-test-cases TC-32',
      'Not Sold Yet → Active after the sale completes',
      'consumes a Not-Sold-Yet card (settles money)',
    ],
    ['gift-card-pos-test-cases TC-33', 'Add Fund raises an Active card balance', 'settles money'],
    ['gift-card-pos-test-cases TC-34', 'Active → Used up at balance 0', 'needs a card spent to zero'],
    [
      'gift-card-pos-test-cases TC-35',
      'A Used-up card can be funded again?',
      'needs a used-up card and a settled fund',
    ],
    [
      'gift-card-pos-test-cases TC-36',
      'Gift card sale adds to the Gift Card Sale report',
      'needs a settled sale + report refresh',
    ],
    [
      'gift-card-pos-test-cases TC-37',
      'Redeem does not raise Gift Card Sale',
      'needs a redemption + report refresh',
    ],
    [
      'gift-card-pos-test-cases TC-38',
      'Gift card list & status match CRM',
      'CRM is a Portal/back-office screen',
    ],
    [
      'gift-card-pos-test-cases TC-39',
      'Several different gift cards in one order',
      'needs added gift-card lines (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-40',
      'The same code twice in one order',
      'needs added gift-card lines (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-41',
      'Buy New + Add Fund mixed in one order',
      'needs added gift-card lines (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-42',
      'Remove the gift-card line before completing',
      'needs an added gift-card line (see TC-23)',
    ],
    [
      'gift-card-pos-test-cases TC-43',
      'Void an order holding a paid gift card',
      'needs a settled gift-card sale',
    ],
    ['gift-card-pos-test-cases TC-44', 'Refund a gift-card sale', 'refunds money (REFUND_SETTLE)'],
    [
      'gift-card-pos-test-cases TC-45',
      'Partial redeem',
      'covered live by order-flow/gift-card-payment.spec.ts (spends a real card)',
    ],
    [
      'gift-card-pos-test-cases TC-46',
      'Redeem above the balance',
      'covered live by order-flow/gift-card-guards.spec.ts (needs a funded card)',
    ],
    [
      'gift-card-pos-test-cases TC-47',
      'Redeem with an Inactive / Used-up card',
      'needs an Inactive/Used-up card at checkout',
    ],
  ]);
});

describe('Split-Order-test-cases — manual rows (from vp-tickets/split-order.spec.ts)', () => {
  manualRows([
    [
      'Split-Order-test-cases TC-08',
      'Choosing a check updates the Pay button amount',
      'SplitOrderPage exposes no Pay-button amount read; 1.1.x stripped the check radio testids',
    ],
    [
      'Split-Order-test-cases TC-11',
      'Tax shown only on the order total, never per check',
      'needs a taxed PRODUCT line — the merchant fixture has services only',
    ],
    [
      'Split-Order-test-cases TC-12',
      'Tip entered per check at payment, not distributed',
      'pays checks (money) — covered live by order-flow/split-tip.spec.ts',
    ],
    ['Split-Order-test-cases TC-14', 'A paid check cannot be cleared', 'needs a paid check (settles money)'],
    [
      'Split-Order-test-cases TC-15',
      'Split method locked once a payment exists',
      'needs a paid check (settles money)',
    ],
    [
      'Split-Order-test-cases TC-16',
      'One payment method per check',
      'needs a check payment in progress (settles money)',
    ],
    [
      'Split-Order-test-cases TC-17',
      'Order status Processing → Successful by check progress',
      'needs paid checks (settles money)',
    ],
    [
      'Split-Order-test-cases TC-18',
      'Gift card enough / not enough balance per split method',
      'needs a funded + an underfunded gift card on the merchant and real redemption',
    ],
    [
      'Split-Order-test-cases TC-19',
      'Gift card check supports Void only, no Refund',
      'needs a settled gift-card check',
    ],
    [
      'Split-Order-test-cases TC-20',
      'Full / partial refund reverses revenue, tax, commission, tip',
      'refunds a settled order (money) and reads reports after sync',
    ],
    ['Split-Order-test-cases TC-21', 'Void Check and Void Order', 'needs a paid split order to void'],
    [
      'Split-Order-test-cases TC-22',
      'Re-open keeps the split structure; only non-amount fields editable',
      'needs a completed split order',
    ],
    [
      'Split-Order-test-cases TC-23',
      'Receipt per check + Final Receipt with signatures',
      'needs a printer and signed card checks',
    ],
    [
      'Split-Order-test-cases TC-24',
      'Split does not change reports or commission',
      'compares two settled orders across reports after sync',
    ],
    ['Split-Order-test-cases TC-25', 'Audit log records split events', 'audit log lives on the Portal'],
  ]);
});

describe('VP-1048 DSR — manual rows (from vp-tickets/vp-1048-daily-sale-report.spec.ts)', () => {
  manualRows([
    [
      'VP-1048 DSR TC-03',
      'Tooltip on the Total Order card',
      'the (i) icons carry no testid on 1.1.x and their hover popover is not modelled',
    ],
    ['VP-1048 DSR TC-05', 'Tooltip on the Sale card', 'tooltip hover not modelled (see TC-03)'],
    ['VP-1048 DSR TC-07', 'Tooltip on the Total Tip card', 'tooltip hover not modelled (see TC-03)'],
    ['VP-1048 DSR TC-09', 'Tooltip on the Total Payment card', 'tooltip hover not modelled (see TC-03)'],
    [
      'VP-1048 DSR TC-11',
      'Sale chart bars sit on the right hour',
      'chart is a canvas/SVG with no per-bar handle',
    ],
    [
      'VP-1048 DSR TC-15',
      'Sale/Refund column after discount per row',
      'needs a seeded order (Sale 30, Discount 5) — sheet data',
    ],
    ['VP-1048 DSR TC-16', 'New Tax column per order row', 'needs a seeded taxed order ($8.80) — sheet data'],
    ['VP-1048 DSR TC-17', 'Tip column per order row', 'needs a seeded order with a $10 tip — sheet data'],
    [
      'VP-1048 DSR TC-22',
      'Refund / partial refund lowers Sale',
      'needs a day seeded with refunds (VP-1048-test-data-setup.md)',
    ],
    [
      'VP-1048 DSR TC-23',
      'Cancelled order excluded from Sale, Tip, Total Order',
      'needs a day seeded with a cancelled order',
    ],
    [
      'VP-1048 DSR TC-24',
      'Gift Card Redemption in Total Payment, not in Sale',
      'needs a day seeded with a redemption',
    ],
    ['VP-1048 DSR TC-25', 'Print outputs the day on screen', 'needs a printer'],
    [
      'VP-1048 DSR TC-31',
      'Reload keeps activeChart and from/to',
      'Tauri app Reload lands on /home (VP-1873); a browser F5 is not available',
    ],
    [
      'VP-1048 DSR TC-37',
      'Refund row shown red with a minus sign',
      'needs a day with a refund row and a styled-cell read not modelled',
    ],
    [
      'VP-1048 DSR TC-39',
      'Yesterday (settled query) unaffected by a new order',
      'needs a second writer between two reads',
    ],
    ['VP-1048 DSR TC-40', 'Skeletons while data loads', 'transient (< 300 ms) — needs a throttled network'],
    ['VP-1048 DSR TC-41', 'GraphQL failure shows the error fallback', 'needs the network cut / a mocked 500'],
    [
      'VP-1048 DSR TC-43',
      'Split Card + Cash + Gift Card order lands in each tender',
      'needs a card terminal and a funded gift card',
    ],
    [
      'VP-1048 DSR TC-44',
      'Orders at 23:59 / 00:01 land on the right store-timezone day',
      'needs orders created at midnight',
    ],
  ]);
});

describe('VP-1048 IS — manual rows (from vp-tickets/vp-1048-income-summary.spec.ts)', () => {
  manualRows([
    [
      'VP-1048 IS TC-02',
      'Week/Month year dropdown switches the year',
      'the year dropdown has no page-object handle; TC-05/07 cover past years via the URL range',
    ],
    [
      'VP-1048 IS TC-08',
      'Total Income % vs the previous equal-length period',
      'needs two seeded periods (VP-1048-test-data-setup.md)',
    ],
    [
      'VP-1048 IS TC-09',
      'Compare label "vs. Previous period" / "vs. Last year" by mode',
      'compare label is on V4 cards not modelled by IncomeSummaryPage',
    ],
    ['VP-1048 IS TC-10', 'Trend arrow colour and direction', 'styled-icon read not modelled'],
    [
      'VP-1048 IS TC-11',
      'Negative Total Income shown negative, not clamped',
      'needs a seeded negative period',
    ],
    [
      'VP-1048 IS TC-12',
      'Gross Income = sale before refund, excl. tip/tax/gift card load',
      'Gross/Net Income cards are V4-only and need seeded data',
    ],
    [
      'VP-1048 IS TC-13',
      'Net Income = sale after refund, excl. tip/cancel/gift card sale',
      'needs seeded refunds',
    ],
    ['VP-1048 IS TC-14', 'Gross/Net never add Gift Card sale (old bug)', 'needs a seeded gift-card sale'],
    ['VP-1048 IS TC-35', 'Supply Fee nets refunds', 'needs a seeded refund on a supply-fee service'],
    [
      'VP-1048 IS TC-36',
      'Staff Supply Share follows the Commission Setting %',
      'needs the staff commission setting (Portal)',
    ],
    [
      'VP-1048 IS TC-38',
      'Staff Commission uses the service rate %',
      'needs per-staff rates (Portal) and seeded orders',
    ],
    ['VP-1048 IS TC-39', 'Salary-only staff → Commission 0', 'needs a salary-only staff with orders'],
    ['VP-1048 IS TC-40', 'Clean up fee = Deduction/day × days worked', 'needs attendance + deduction config'],
    ['VP-1048 IS TC-41', 'Salary by Period prorated per day', 'needs salary config + a closed period'],
    ['VP-1048 IS TC-42', 'Wage Per Hour salary', 'needs wage config + attendance hours'],
    ['VP-1048 IS TC-43', 'Wage Per Day salary', 'needs wage config + attendance days'],
    [
      'VP-1048 IS TC-44',
      'TOTAL STAFF PAYOUT = Commission + Tip − Clean up + Salary',
      'card-fee / discount charges also enter the shipped payout; needs seeded data to pin the formula',
    ],
    [
      'VP-1048 IS TC-45',
      'Pay 1 text % follows the setting',
      'needs a non-default Pay 1 % configured (Portal)',
    ],
    [
      'VP-1048 IS TC-46',
      'Pay 2 text % follows the setting (no hardcoded 70%)',
      'needs a non-default Pay 2 % configured (Portal)',
    ],
    [
      'VP-1048 IS TC-48',
      'Show more / Show less toggles Pay 1 & Pay 2',
      'toggle is not modelled on IncomeSummaryPage (readDetail reads the expanded panel)',
    ],
    [
      'VP-1048 IS TC-49',
      'Open pay period → max(Commission, Salary) estimate',
      'needs a Commission + Salary staff in an open period',
    ],
    [
      'VP-1048 IS TC-50',
      'Closed pay period → the locked figure',
      'needs a closed payroll period (overnight / Portal)',
    ],
    [
      'VP-1048 IS TC-51',
      'Custom Pay Period with 4 marks splits Pay 1/Pay 2 four ways',
      'needs a custom pay period configured (Portal)',
    ],
    [
      'VP-1048 IS TC-52',
      'Salon Commission = Total Service × owner % − Salon Supply Share',
      'needs the owner rate (Portal)',
    ],
    ['VP-1048 IS TC-53', 'Net Earnings formula', 'needs seeded product sale/refund data'],
    ['VP-1048 IS TC-54', 'Total Earning formula, negative allowed', 'needs seeded data'],
    [
      'VP-1048 IS TC-55',
      'Salon Earnings and Staff Payout computed independently',
      'needs seeded data to tell the two apart',
    ],
    [
      'VP-1048 IS TC-57',
      'Net Total ↔ Sale ↔ Total Income agree',
      'Total Income card is V4-only; needs seeded period',
    ],
    [
      'VP-1048 IS TC-60',
      'Total Refund matches Daily Sale Report',
      'Daily Sale Report shows no refund total to compare',
    ],
    ['VP-1048 IS TC-61', 'Printed receipt matches the screen', 'needs a printer'],
    [
      'VP-1048 IS TC-62',
      'Gift-card-only day: Gross/Net 0, Total Sale includes GC',
      'needs a seeded gift-card-only day',
    ],
    [
      'VP-1048 IS TC-64',
      'Custom Pay Period save blocked without a date',
      'custom pay period lives on the Portal',
    ],
  ]);
});

describe('VP-1148 — manual rows (from vp-tickets/vp-1148-wage-per-day.spec.ts)', () => {
  manualRows([
    [
      'VP-1148 TC-02',
      'Wage Per Day + Pay 1/Pay 2 + Deduction save and persist after reload',
      'mutates a real staff compensation; needs a disposable staff',
    ],
    [
      'VP-1148 TC-03',
      'At least one check-in in a day = one full day salary',
      'needs check-ins placed on chosen days of a pay period',
    ],
    ['VP-1148 TC-04', 'A day without check-in is not paid', 'needs a controlled attendance history'],
    [
      'VP-1148 TC-05',
      'Several check-ins in one day still count one day',
      'needs a controlled attendance history',
    ],
    [
      'VP-1148 TC-06',
      'Missing check-out is auto-closed at end of day, day still counts',
      'auto check-out is an end-of-day job',
    ],
  ]);
});

describe('VP-1168 — manual rows (from vp-tickets/vp-1168-import-staff-csv.spec.ts)', () => {
  const PORTAL = 'Portal web feature (Staffs → Import Staff); the WDIO lane drives the POS till only';
  manualRows([
    ['VP-1168 TC-01', 'Download the CSV template', PORTAL],
    ['VP-1168 TC-02', 'Valid CSV passes validation and opens Preview', PORTAL],
    ['VP-1168 TC-03', 'Non-.csv file is rejected', PORTAL],
    ['VP-1168 TC-04', 'Header-only file (no data rows)', PORTAL],
    ['VP-1168 TC-05', 'Wrong / missing required header columns', PORTAL],
    ['VP-1168 TC-06', 'UTF-8 file with Vietnamese diacritics', PORTAL],
    ['VP-1168 TC-07', 'Large file (100 staff)', PORTAL],
    ['VP-1168 TC-08', 'Re-pick / remove the chosen file before Confirm', PORTAL],
    ['VP-1168 TC-09', 'Each of the 7 required fields missing on a row', PORTAL],
    ['VP-1168 TC-10', 'Required field with whitespace only', PORTAL],
    ['VP-1168 TC-11', 'Boundary: name of exactly 50 characters is valid', PORTAL],
    ['VP-1168 TC-12', 'Boundary: name of 51 characters fails', PORTAL],
    ['VP-1168 TC-13', 'Duplicate Employee Code inside the file fails the file (VP-2687)', PORTAL],
    ['VP-1168 TC-14', 'Employee Code clashing with an existing staff', PORTAL],
    ['VP-1168 TC-15', 'Unique Employee Code creates the staff with that code', PORTAL],
    ['VP-1168 TC-16', 'E.164 (+1) phone is valid', PORTAL],
    ['VP-1168 TC-17', 'Malformed phone fails (VP-2688)', PORTAL],
    ['VP-1168 TC-18', 'Same phone on two rows', PORTAL],
    ['VP-1168 TC-19', 'Valid email imports', PORTAL],
    ['VP-1168 TC-20', 'Malformed email fails', PORTAL],
    ['VP-1168 TC-21', 'Empty email still imports (optional)', PORTAL],
    ['VP-1168 TC-22', 'Services Active Full / Booking Online Active accept 0 and 1', PORTAL],
    ['VP-1168 TC-23', 'Empty boolean defaults to 1', PORTAL],
    ['VP-1168 TC-24', 'Boolean outside 0/1 fails', PORTAL],
    ['VP-1168 TC-25', 'Working Hours Active column in spec but not in template', PORTAL],
    ['VP-1168 TC-26', 'Existing role name maps to the role', PORTAL],
    ['VP-1168 TC-27', 'Unknown role fails', PORTAL],
    ['VP-1168 TC-28', 'Role with wrong case / extra spaces', PORTAL],
    ['VP-1168 TC-29', 'Compensation = Commission maps the default Commission setting', PORTAL],
    ['VP-1168 TC-30', 'Compensation = Salary maps the default Salary setting', PORTAL],
    ['VP-1168 TC-31', 'Compensation = Commission & Salary maps the matching default', PORTAL],
    ['VP-1168 TC-32', 'Compensation outside the 3 allowed values fails', PORTAL],
    ['VP-1168 TC-33', 'No default compensation setting for the chosen type → import fails', PORTAL],
    ['VP-1168 TC-34', 'Compensation in a different case than the spec', PORTAL],
    ['VP-1168 TC-35', 'No compensation detail is imported from the file', PORTAL],
    ['VP-1168 TC-36', 'All optional fields empty still imports', PORTAL],
    ['VP-1168 TC-37', 'Status column (active/inactive) in the template', PORTAL],
    ['VP-1168 TC-38', 'Full address imports field by field', PORTAL],
    ['VP-1168 TC-39', 'Preview shows the right row count and data', PORTAL],
    ['VP-1168 TC-40', 'Preview does not allow inline edits', PORTAL],
    ['VP-1168 TC-41', 'Preview offers Confirm and Cancel', PORTAL],
    ['VP-1168 TC-42', 'Cancel on Preview imports nothing', PORTAL],
    ['VP-1168 TC-43', 'Confirm creates the staff', PORTAL],
    ['VP-1168 TC-44', 'Double-submit on Confirm is prevented', PORTAL],
    ['VP-1168 TC-45', 'One bad row in a multi-row file fails the whole file', PORTAL],
    ['VP-1168 TC-46', 'Error popup lists the failing rows', PORTAL],
    ['VP-1168 TC-47', 'Reported error row numbers match the CSV lines', PORTAL],
    ['VP-1168 TC-48', 'Fixing the file and re-importing succeeds', PORTAL],
    ['VP-1168 TC-49', 'User with Create Staff permission can import', PORTAL],
    ['VP-1168 TC-50', 'User without Create Staff permission cannot import', PORTAL],
    ['VP-1168 TC-51', 'Successful import writes an audit log entry', PORTAL],
    ['VP-1168 TC-52', 'Failed import writes an audit log entry', PORTAL],
    ['VP-1168 TC-53', 'Cancel on Preview writes no import audit entry', PORTAL],
  ]);
});

describe('VP-1198 — manual rows (from vp-tickets/vp-1198-device-management.spec.ts)', () => {
  const PORTAL = 'Portal web device-management screen; the WDIO lane drives the POS till only';
  manualRows([
    ['VP-1198 TC-01', 'POS list shows the merchant devices', PORTAL],
    ['VP-1198 TC-02', 'POS status Online / Offline', `${PORTAL}; needs a till taken offline`],
    [
      'VP-1198 TC-03',
      'Terminal & printer connection status (several devices)',
      `${PORTAL}; needs terminals and printers`,
    ],
    ['VP-1198 TC-04', 'Status refreshes on its ~hourly cycle', `${PORTAL}; waits on the hourly job`],
    [
      'VP-1198 TC-05',
      '"Last connected" updates on each trigger',
      `${PORTAL}; needs connect events on a till`,
    ],
    [
      'VP-1198 TC-06',
      '"Last disconnected" updates on each trigger',
      `${PORTAL}; needs disconnect events on a till`,
    ],
    ['VP-1198 TC-07', 'Detail page shows the POS information', PORTAL],
    ['VP-1198 TC-08', '7-day connection history', `${PORTAL}; needs a week of history`],
    ['VP-1198 TC-09', 'Terminal list in the detail (no remote on terminals)', `${PORTAL}; needs terminals`],
    ['VP-1198 TC-10', 'Remote View works without re-entering credentials', PORTAL],
    [
      'VP-1198 TC-11',
      'Remote on an offline POS is clickable and shows the reason',
      `${PORTAL}; needs a till taken offline`,
    ],
    ['VP-1198 TC-12', 'Remote failure reasons', `${PORTAL}; needs each failure condition staged`],
    ['VP-1198 TC-13', 'Sensitive actions are not blocked inside remote', PORTAL],
    ['VP-1198 TC-14', 'Disconnect one POS', `${PORTAL}; disconnects a real till`],
    [
      'VP-1198 TC-15',
      'User without permission cannot see/use credential & remote',
      `${PORTAL}; needs a restricted Portal user`,
    ],
    ['VP-1198 TC-16', 'User with permission can see/use credential & remote', PORTAL],
    ['VP-1198 TC-17', 'Every page action is logged', PORTAL],
    ['VP-1198 TC-18', 'Audit log filter', PORTAL],
  ]);
});

describe('VP-1252 — manual rows (from vp-tickets/vp-1252-pending-order.spec.ts)', () => {
  manualRows([
    [
      'VP-1252 TC-02',
      'Checkout from an Appointment creates a Pending Order',
      'needs an appointment for today (web lane: npm run test:web2pos)',
    ],
    [
      'VP-1252 TC-03',
      'One active Pending Order per appointment_id — second Checkout redirects',
      'needs an appointment checked out twice',
    ],
    [
      'VP-1252 TC-04',
      'A GoCheckin check-in auto-creates a Pending Order',
      'needs the GoCheckin kiosk (web lane)',
    ],
    [
      'VP-1252 TC-05',
      'One active Pending Order per checkin_id — no duplicate',
      'needs a GoCheckin check-in replayed',
    ],
    [
      'VP-1252 TC-10',
      'Filter the queue by source / tag',
      'the build ships no source/tag filter control on /order-pending',
    ],
    [
      'VP-1252 TC-12',
      'Left sidebar mini list switches orders quickly',
      'the Pending Orders sidebar has no page-object handle',
    ],
    [
      'VP-1252 TC-14',
      'Assign / change the staff of a service on a pending order',
      'change-staff dialog not modelled for a reopened pending order',
    ],
    [
      'VP-1252 TC-15',
      'Apply discount / promotion / reward on a pending order',
      'promotion/reward catalogue needs Portal setup',
    ],
    ['VP-1252 TC-19', 'Create a Pending Order offline + indicator', 'needs the network cut'],
    ['VP-1252 TC-20', 'Offline allows Cash only, then auto-syncs', 'needs the network cut'],
  ]);
});

describe('VP-1252-5 — manual rows (from vp-tickets/vp-1252-pending-order.spec.ts)', () => {
  manualRows([
    [
      'VP-1252-5 TC-02',
      'One active Pending Order per appointment_id — second Checkout redirects',
      'needs an appointment (web lane)',
    ],
    [
      'VP-1252-5 TC-03',
      'Check-in auto-creates a Pending Order, no duplicate per checkin_id',
      'needs the GoCheckin kiosk (web lane)',
    ],
    [
      'VP-1252-5 TC-04',
      'Order Date = payment time, not creation; pending never expires overnight',
      'needs a pending order carried past midnight',
    ],
  ]);
});

describe('VP-1261 — manual rows (from vp-tickets/vp-1261-gift-card-offline.spec.ts)', () => {
  const OFFLINE = 'needs the till network cut and restored (fault injection — out of scope for the lane)';
  manualRows([
    ['VP-1261 TC-01', 'Sell a gift card while offline (happy path)', OFFLINE],
    ['VP-1261 TC-02', 'Reload a gift card while offline', OFFLINE],
    ['VP-1261 TC-03', 'Offline gift card order allows Cash only', OFFLINE],
    [
      'VP-1261 TC-04',
      'Gift card data stored encrypted locally',
      `${OFFLINE}; inspects the local SQLCipher DB`,
    ],
    ['VP-1261 TC-05', 'Offline gift card order queues a pending-sync transaction', OFFLINE],
    ['VP-1261 TC-06', 'Auto-sync when the network returns', OFFLINE],
    ['VP-1261 TC-07', 'Retry when the network drops again during sync', OFFLINE],
    [
      'VP-1261 TC-08',
      'Server activates/reloads only after validation; POS refreshes balance',
      `${OFFLINE}; verifies server state`,
    ],
    ['VP-1261 TC-09', 'Warning before completing an offline gift card order', OFFLINE],
    ['VP-1261 TC-10', 'Several pending-sync transactions sync once each, in order', OFFLINE],
  ]);
});

describe('VP-1341 — manual rows (from vp-tickets/vp-1341-payroll-salary.spec.ts)', () => {
  manualRows([
    [
      'VP-1341 TC-02',
      'Exclude Tips state persists per employee',
      'flips the switch on a real staff; needs a disposable staff',
    ],
    [
      'VP-1341 TC-03',
      'Checked → Tip NOT added to Cash/Check Income',
      'needs the switch ON + a tipped settled order + report refresh',
    ],
    [
      'VP-1341 TC-04',
      'Unchecked → Tip added to Cash/Check Income (old behaviour)',
      'needs a tipped settled order + report refresh',
    ],
    [
      'VP-1341 TC-05',
      'Split-tip / multi-technician order: each staff applies own setting',
      'needs two staff with opposite settings on one settled order',
    ],
    [
      'VP-1341 TC-10',
      'Commission + Salary: violation flag decides Commission vs Salary',
      'needs days-off rules + attendance history (see VP-1343)',
    ],
  ]);
});

describe('VP-1343 — manual rows (from vp-tickets/vp-1343-count-days-off.spec.ts)', () => {
  const SETUP =
    'needs a Commission + Salary staff with days-off limits configured and a staged attendance history';
  manualRows([
    ['VP-1343 TC-01', 'Days-off rule only affects income for Commission + Salary', SETUP],
    ['VP-1343 TC-02', 'Limit days off OFF → never a violation → Income = MAX(Salary, Commission)', SETUP],
    ['VP-1343 TC-03', 'Limit ON, no violation, Commission > Salary → Income = Commission', SETUP],
    ['VP-1343 TC-04', 'Limit ON, no violation, Salary > Commission → Income = Salary', SETUP],
    ['VP-1343 TC-05', 'Over Max days off → violation → Salary only', SETUP],
    ['VP-1343 TC-06', 'Day off on a forbidden weekday → violation → Salary only', SETUP],
    ['VP-1343 TC-07', 'Days off exactly = Max → no violation → MAX', SETUP],
    ['VP-1343 TC-08', 'Days off = Max + 1 → violation → Salary only', SETUP],
    [
      'VP-1343 TC-09',
      'Missed check-out auto-closed → day valid, not a day off',
      `auto check-out is an end-of-day job; ${SETUP}`,
    ],
    ['VP-1343 TC-10', 'Unscheduled day does not count as a day off', SETUP],
    [
      'VP-1343 TC-11',
      'Owner/Manager manual approval → day valid',
      `approval happens on the Portal; ${SETUP}`,
    ],
    ['VP-1343 TC-12', 'Rule 1 + Rule 2 violated together → one flag → Salary only', SETUP],
    ['VP-1343 TC-13', 'Violation → Salary only = Wage Per Day × Working Days', SETUP],
    ['VP-1343 TC-14', 'No violation and MAX picks Commission → Commission (For Service 50%) correct', SETUP],
    ['VP-1343 TC-15', 'Violation with Salary already > Commission → still Salary', SETUP],
    ['VP-1343 TC-16', 'Violation with Salary = 0 → income 0, no fallback to Commission', SETUP],
    [
      'VP-1343 TC-17',
      'Violation is per pay period, not carried over',
      `needs two closed pay periods; ${SETUP}`,
    ],
    [
      'VP-1343 TC-18',
      'Changing Max days off then re-running payroll updates income',
      `mutates staff config and re-runs payroll; ${SETUP}`,
    ],
    [
      'VP-1343 TC-19',
      'Approved Leave counts / does not count as a day off',
      `leave approval on the Portal; ${SETUP}`,
    ],
    ['VP-1343 TC-20', 'Violation shows "Salary only" reason on the income report', SETUP],
  ]);
});

describe('VP-1761 — manual rows (from vp-tickets/vp-1761-turn-suggestion.spec.ts)', () => {
  manualRows([
    [
      'VP-1761 TC-06',
      'Legend chips hide/show bars, state not persisted',
      'legend chips and bars have no page-object handle',
    ],
    [
      'VP-1761 TC-08',
      'Completing an order re-sorts the board',
      'needs an order completed by the top staff (settles money)',
    ],
    [
      'VP-1761 TC-12',
      'Decimal ON + service-based ON: Σ list price ÷ turn value, 2 decimals',
      'needs orders with chosen service prices; invariant form in turn-board-2.spec.ts',
    ],
    [
      'VP-1761 TC-13',
      'Service-based ON + decimal OFF: +1 per service ≥ turn value',
      'needs orders with chosen service prices',
    ],
    [
      'VP-1761 TC-14',
      'Service-based OFF: one turn per completed order',
      'needs completed orders; changes merchant turn config',
    ],
    [
      'VP-1761 TC-15',
      'Turn value $0 zeroes every count, adjustments included',
      'covered as TC-TURN-35 (exclusive config change)',
    ],
    [
      'VP-1761 TC-16',
      'Products and gift cards never add turns',
      'needs an order with product + gift card lines',
    ],
    ['VP-1761 TC-17', 'Turns use list price, not the discounted price', 'needs a discounted completed order'],
    ['VP-1761 TC-18', 'Each staff counts only their own services', 'needs a two-staff completed order'],
    ['VP-1761 TC-19', 'Voiding a completed order recalculates turns', 'needs a completed then voided order'],
    [
      'VP-1761 TC-20',
      'Partial refund reduces turns proportionally',
      'needs a settled order and a partial refund',
    ],
    [
      'VP-1761 TC-24',
      'Adjust delta is per day and expires the next day',
      'needs a delta saved on one day and read the next',
    ],
    [
      'VP-1761 TC-25',
      'Checkout staff sort "Turn Count" matches the board',
      'staff-sort popover on the checkout staff picker not modelled by HomePage',
    ],
  ]);
});

describe('VP-2065 — manual rows (from vp-tickets/vp-2065-payroll-lock.spec.ts)', () => {
  const LOCK =
    'needs a payroll period locked at a chosen lockedAt (Portal / payroll close job) and a back-dated entry';
  manualRows([
    ['VP-2065 TC-01', 'Check-in on the lock day (lockedAt 00:00) is blocked', LOCK],
    ['VP-2065 TC-02', 'Check-in on the lock day with lockedAt 23:30 is still blocked', LOCK],
    ['VP-2065 TC-03', 'Check-in on the day after the lock is accepted (lockedAt late evening)', LOCK],
    ['VP-2065 TC-04', 'Check-in on a day before the lock is blocked', LOCK],
    ['VP-2065 TC-05', 'Check-out on the lock day is blocked like check-in', LOCK],
    ['VP-2065 TC-06', 'Check-out on the day after the lock is accepted', LOCK],
    ['VP-2065 TC-07', 'Check-in at 00:00:00 of the next day is not counted in the lock day', LOCK],
    ['VP-2065 TC-09', 'lockLabel keeps the "MMM d, yyyy" format in the error', LOCK],
    ['VP-2065 TC-11', 'Check-in 1 hour after lockedAt but on the next calendar day is accepted', LOCK],
  ]);
});

describe('VP-2400 — manual rows (from vp-tickets/vp-2400-passcode-settings-extra.spec.ts)', () => {
  manualRows([
    [
      'VP-2400 TC-17',
      'Only Owner/Admin may change the passcode setting',
      'needs a staff login without Settings permission',
    ],
  ]);
});
