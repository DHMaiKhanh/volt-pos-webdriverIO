# Test case đang FAIL (trạng thái mới nhất trong dashboard history, 27/10 → 03/11/2026)

277 TC / 99 spec. Cột [MM-DD] = lần chạy gần nhất của TC đó. Đã loại TC đã xoá/đổi tên (37) và TC Re-Open đang skip (57).

### tests/regression/appointment/appointment-create.spec.ts (1)

- L62 [11-01] Clicking a past slot is a no-op — no dialog opens (TC-OPEN-03) — WebDriverError: move target out of bounds

### tests/regression/earn-points-on-tip/earn-points-on-tip.spec.ts (1)

- L180 [11-01] EPT-05: OFF + Card with a 20% tip earns on the amount alone @critical @payment — Step "Pay by card" failed after 5502ms: Complete Payment stays disabled on the Card tender and the h

### tests/regression/home/turn-board-2.spec.ts (8)

- L190 [11-01] Save and Reset are disabled on an untouched row (TC-TURN-38) — expect(received).toBe(expected) // Object.is equality
- L199 [11-01] One increase makes only that row dirty (TC-TURN-39) — No Adjust row with Current: 0 — every staff on today's board already has turns.
- L218 [11-01] Decrease steps by exactly 1 and keeps the decimals (TC-TURN-40) — expect(received).toBe(expected) // Object.is equality
- L238 [11-01] Decrease clamps at 0 — never negative (TC-TURN-41) — expect(received).toBe(expected) // Object.is equality
- L255 [11-01] Decrease is disabled when Current is 0 (TC-TURN-42) — No Adjust row with Current: 0 — every staff on today's board already has turns.
- L265 [11-01] Reset returns one row to Current and leaves other dirty rows alone (TC-TURN-43) — expect(received).toBe(expected) // Object.is equality
- L288 [11-01] Saving an adjustment on today updates Current and the board (TC-TURN-44) — No Adjust row with Current: 0 — every staff on today's board already has turns.
- L337 [11-01] Undoing a saved adjustment needs a second Save, not Reset (TC-TURN-46) — No Adjust row with Current: 0 — every staff on today's board already has turns.

### tests/regression/home/turn-board.spec.ts (4)

- L115 [11-01] Open Turn from the sidebar (TC-TURN-01) — expect(received).toBe(expected) // Object.is equality
- L175 [11-01] Deep link on a gated route puts the passcode guard on top (TC-TURN-06) — expect(received).toBe(expected) // Object.is equality
- L294 [11-01] Clicking a row opens nothing (TC-TURN-09) — expect(received).toBe(expected) // Object.is equality
- L460 [11-01] "View Turn" opens the full board and collapses the tab (TC-TURN-53) — expect(received).toBe(expected) // Object.is equality

### tests/regression/incomes/batch-history.spec.ts (1)

- L64 [11-01] TC-BATCH-02: default preset is Last 7 Days, range today − 6 → today — expect(received).toContain(expected) // indexOf

### tests/regression/incomes/income-summary.spec.ts (1)

- L213 [11-01] TC-INCSUM-08: Payment Details Total Payment equals the selected row’s Total Payment @critical — TC-INCSUM-08 Nov 1: Payment Details Total Payment vs table Total Payment: expected $49,330.43 but go

### tests/regression/incomes/reports-v4.spec.ts (1)

- L168 [11-01] TC-RV4-05: Σ order Total equals the Total Payment tile (± Gift Card Redemption) @critical — TC-RV4-05 (⚠️ in the scan): Σ order Total $49,520.05 over 578 orders ≠ Total Payment tile $49,618.43

### tests/regression/incomes/time-tracking.spec.ts (1)

- L231 [11-01] Deleting a Time Keeping record succeeds (TC-TT-07) — element ("(//tbody/tr[./td[contains(normalize-space(),"QA-SCAN-20261025")]])[1]//button[@aria-label=

### tests/regression/order-flow/adjust-tip.spec.ts (1)

- L62 [11-03] The Adjust Tip dialog opens on an eligible order (TC-ORDERFLOW-69) — expect(received).toBe(expected) // Object.is equality

### tests/regression/order-flow/charge-card-matrix-2.spec.ts (10)

- L72 [11-01] No tip, Quick Pay $50, charges and settles (TC-ORDERFLOW-154) @payment @dual-window @critical — Step "Pay by card" failed after 15527ms: element ("button.bg-green") still not clickable after 15000
- L90 [11-01] Tip 20%, price-override $100, charges and settles (TC-ORDERFLOW-155) @payment @dual-window — Step "Pay by card" failed after 15603ms: element ("button.bg-green") still not clickable after 15000
- L107 [11-01] Tip 15%, price-override $250, charges and settles (TC-ORDERFLOW-156) @payment @dual-window — Step "Pay by card" failed after 15671ms: element ("button.bg-green") still not clickable after 15000
- L124 [11-01] Tip 25%, four-line order, charges and settles (TC-ORDERFLOW-157) @payment @dual-window — Step "Pay by card" failed after 15614ms: element ("button.bg-green") still not clickable after 15000
- L142 [11-01] No tip, five-line order, charges and settles (TC-ORDERFLOW-158) @payment @dual-window — Step "Pay by card" failed after 15593ms: element ("button.bg-green") still not clickable after 15000
- L160 [11-01] Tip 10%, noted line, charges and settles (TC-ORDERFLOW-159) @payment @dual-window — Step "Pay by card" failed after 15596ms: element ("button.bg-green") still not clickable after 15000
- L177 [11-01] Tip 20%, Quick Pay $80, charges and settles (TC-ORDERFLOW-160) @payment @dual-window — Step "Pay by card" failed after 15584ms: element ("button.bg-green") still not clickable after 15000
- L194 [11-01] No tip, price-override $500, charges and settles (TC-ORDERFLOW-161) @payment @dual-window — Step "Pay by card" failed after 15524ms: element ("button.bg-green") still not clickable after 15000
- L211 [11-01] Tip 20% + discount + price $100, charges and settles (TC-ORDERFLOW-162) @payment @dual-window — Step "Pay by card" failed after 15584ms: element ("button.bg-green") still not clickable after 15000
- L231 [11-01] Tip 15%, four-line + discount, charges and settles (TC-ORDERFLOW-163) @payment @dual-window — Step "Pay by card" failed after 15570ms: element ("button.bg-green") still not clickable after 15000

### tests/regression/order-flow/charge-card-matrix.spec.ts (10)

- L90 [11-01] No tip, single line, charges and settles (TC-ORDERFLOW-114) @payment @dual-window @critical — Step "Pay by card" failed after 15597ms: element ("button.bg-green") still not clickable after 15000
- L108 [11-01] Tip 10%, single line, charges and settles (TC-ORDERFLOW-115) @payment @dual-window — Step "Pay by card" failed after 15511ms: element ("button.bg-green") still not clickable after 15000
- L125 [11-01] Tip 15%, single line, charges and settles (TC-ORDERFLOW-116) @payment @dual-window — Step "Pay by card" failed after 15549ms: element ("button.bg-green") still not clickable after 15000
- L142 [11-01] Tip 20%, single line, charges and settles (TC-ORDERFLOW-117) @payment @dual-window — Step "Pay by card" failed after 15578ms: element ("button.bg-green") still not clickable after 15000
- L159 [11-01] Tip 25%, single line, charges and settles (TC-ORDERFLOW-118) @payment @dual-window — Step "Pay by card" failed after 15506ms: element ("button.bg-green") still not clickable after 15000
- L176 [11-01] No tip, two-line order, charges and settles (TC-ORDERFLOW-119) @payment @dual-window — Step "Pay by card" failed after 15574ms: element ("button.bg-green") still not clickable after 15000
- L194 [11-01] No tip, price-override ($30), charges and settles (TC-ORDERFLOW-120) @payment @dual-window — Step "Pay by card" failed after 15596ms: element ("button.bg-green") still not clickable after 15000
- L211 [11-01] Item discount + tip 20%, charges and settles (TC-ORDERFLOW-121) @payment @dual-window — Step "Pay by card" failed after 15616ms: element ("button.bg-green") still not clickable after 15000
- L231 [11-01] Item discount + no tip, two lines, charges and settles (TC-ORDERFLOW-122) @payment @dual-window — Step "Pay by card" failed after 15556ms: element ("button.bg-green") still not clickable after 15000
- L251 [11-01] Tip 15% + different staff/service tile, charges and settles (TC-ORDERFLOW-123) @payment @dual-window — Step "Pay by card" failed after 15567ms: element ("button.bg-green") still not clickable after 15000

### tests/regression/order-flow/customer-entry.spec.ts (1)

- L49 [11-03] A phone matching nobody opens the quick-add form (TC-ORDERFLOW-06) — "create customer name input" was still present after 5000ms.

### tests/regression/order-flow/home-cart.spec.ts (1)

- L173 [11-03] Editing a cart line changes its price (TC-ORDERFLOW-22) — cart subtotal after a price edit: expected $12.00 but got $13.20 (off by $1.20; 1200 vs 1320 cents).

### tests/regression/order-flow/order-detail-actions.spec.ts (2)

- L12 [11-01] Cancel Order opens its reason dialog (TC-ORDERFLOW-64) — expect(received).toBe(expected) // Object.is equality
- L96 [11-01] An unsettled order offers Cancel / Re-Open, not Refund (TC-ORDERFLOW-55) — expect(received).toBe(expected) // Object.is equality

### tests/regression/order-flow/payment-reliability.spec.ts (1)

- L73 [11-03] Payment Details shows the card last-4 and a failed-charge log (PAY-R17, VP-4511) — Could not find "payment filter trigger" within 15000ms.

### tests/regression/order-flow/quick-pay.spec.ts (4)

- L7 [11-03] Add unlocks only with an amount AND a name (TC-ORDERFLOW-15) — Could not find "quick pay amount input" within 15000ms.
- L70 [11-03] The Quick Pay dialog opens with Add disabled (TC-ORDERFLOW-14) — expect(received).toBe(expected) // Object.is equality
- L101 [11-03] The amount is capped at $9,999,999.99 (TC-ORDERFLOW-16) — Could not find "quick pay amount input" within 15000ms.
- L116 [11-03] A Quick Pay line is added; its discount is the dialog toggle, not a per-line item discount (TC-ORDERFLOW-17) — Could not find "quick pay amount input" within 15000ms.

### tests/regression/order-flow/tip-guards.spec.ts (1)

- L148 [10-31] Adjust Tip on a card (Auth) order saves and persists (TIP-R3, VP-4157) @payment @dual-window — Could not find "adjust tip tender button 0" within 15000ms.

### tests/regression/settings/settings-receipt.spec.ts (1)

- L133 [11-01] Display Options toggles all exist and are ON (TC-RCP-07) — expect(received).toEqual(expected) // deep equality

### tests/regression/settings/settings-services.spec.ts (1)

- L271 [11-01] Filter Inactive leaves only inactive rows, with an empty state when none — known bug (TC-SVC-11) — expect(received).toBe(expected) // Object.is equality

### tests/regression/settings/settings-staffs.spec.ts (9)

- L399 [11-01] The Extra Permission note names the staff's real role — known bug (TC-EMP-20) — expect(received).not.toMatch(expected)
- L445 [11-01] Editing a field makes the form dirty and enables Save (TC-EMP-23) — expect(received).toBe(expected) // Object.is equality
- L456 [11-01] Leaving discards the unsaved edit (TC-EMP-24) — expect(received).toBe(expected) // Object.is equality
- L477 [11-01] Create New Staff shows every field and select (TC-EMP-25) — Could not find "dialog close" within 15000ms.
- L495 [11-01] State stays disabled until a Country is chosen (TC-EMP-26) — Could not find "dialog close" within 15000ms.
- L504 [11-01] Create is enabled on an empty form — validation on submit (TC-EMP-27) — Could not find "dialog close" within 15000ms.
- L516 [11-01] Escape closes Create New Staff without adding anyone (TC-EMP-28) — Could not find "dialog close" within 15000ms.
- L526 [11-01] Create New Staff placeholders are as specified (TC-EMP-29) — Could not find "dialog close" within 15000ms.
- L545 [11-01] Opening a staff detail logs only the known, whitelisted console noise (TC-EMP-30) — Could not find "dialog close" within 15000ms.

### tests/regression/volt-qc/app-perm/app-shell.spec.ts (1)

- L208 [11-03] The Devices popover lists Terminal and Printer with a status, read-only (APP-060) — expect(received).not.toBeNull()

### tests/regression/volt-qc/app-rpt-set-perm/app-mutation.spec.ts (3)

- L140 [11-03] Two windows are open: "Volt POS" and "Volt POS - Customer Display" on /customer (APP-001) @dual-window — expect(received).toBe(expected) // Object.is equality
- L280 [11-03] Sidebar lists the 12 prod entries in order, with no "(V1)" suffix and no Version Update (APP-063) — expect(received).toBe(expected) // Object.is equality
- L532 [11-03] Notifications: an appointment item shows a status pill and a "MMM d, yyyy at h:mm AM" date (APP-124) — expect(received).toMatch(expected)

### tests/regression/volt-qc/app-rpt-set-perm/perm-gates-save.spec.ts (3)

- L139 [11-01] Each of the 15 gates saves on its own; three gates switched off stay off after leaving (PERM-034) @exclusive — Timeout
- L314 [11-01] Cancel Order and Re-Open gates OFF: void and re-open run with no passcode (PERM-048, PERM-050) @exclusive — Step "PERM-048 cancel order A — no passcode, toast" failed after 21932ms: Could not find "cancel ord
- L366 [11-01] Every gate OFF (Active All): a masked phone still asks "Enter staff code to continue" (PERM-058) @exclusive — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/app-rpt-set-perm/rpt-mutation.spec.ts (9)

- L207 [11-03] A new Cash (+ an Other) order: one row each, ascending by time, Δ Cash / Others in Payment Details (RPT-039, RPT-040, RPT-029) — expect(received).toBe(expected) // Object.is equality
- L237 [11-03] A cancelled (voided) order disappears from Daily Sale and is not counted (RPT-044) — expect(received).toBe(expected) // Object.is equality
- L256 [11-03] Adjust Tip after payment changes the row Tip / Total; Sale unchanged (RPT-048) — Could not find "adjust tip tender button 0" within 15000ms.
- L288 [11-03] A re-opened order leaves Daily Sale; completed again it is counted exactly once (RPT-049) — expect(received).toBe(expected) // Object.is equality
- L347 [11-03] Daily Sale money renders as $#,##0.00 on cards, table and detail (RPT-193) — expect(received).toEqual(expected) // deep equality
- L360 [11-03] Order Details from a Daily Sale row shows that order; X, Escape and an outside click all close it and keep the report (RPT-190) — expect(received).toEqual(expected) // deep equality
- L390 [11-03] Daily Sale opened by URL keeps the requested day and chart (RPT-191) — No visible "#selected-date-range" #0 inside "main"
- L407 [11-03] One new Cash order moves Daily Sale, Income Summary and Staff Income together; Summary Total = Sale + Tip + Tax (RPT-088, RPT-127, — expect(received).toBe(expected) // Object.is equality
- L440 [11-03] A voided order leaves Staff Income (orders count back) (RPT-130) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/app-rpt-set-perm/rpt-set-extra.spec.ts (4)

- L285 [11-03] Daily Sale: the hourly bars of Total Order add up to the Total Order card, and the Sale bars to the Sale card (RPT-035) — No visible ".//h4[normalize-space(.)="Total Order"]" #0 inside "[data-slot="income-layout-left"]"
- L313 [11-03] Order with a $1.00 custom promotion + $2.00 tip: Daily Sale row Sale = price − $1, Tip $2, Total = Sale + Tax + Tip; Δ Sale card = — expect(received).toBeDefined()
- L408 [11-01] A day set Closed in Business Info blocks the appointment board for that day; Work Hours restored (SET-023) @exclusive — expect(received).toBe(expected) // Object.is equality
- L543 [11-03] Compensation: Commission / Commission + Salary / Salary each show their own sections; Salary Setting has 3 options (draft, discard — expect(received).toEqual(expected) // deep equality

### tests/regression/volt-qc/app-rpt-set-perm/set-business-access.spec.ts (1)

- L262 [11-01] Work Hours: flip Sunday open/closed → Save; Sunday state and hours restored (SET-019) @exclusive — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex shr

### tests/regression/volt-qc/app-rpt-set-perm/set-catalog-write.spec.ts (2)

- L175 [11-01] A price change reaches the Home cart; the Active switch writes at once and an Inactive service leaves Home; editing it does not re — Step "SET-145 a new price is what Home puts in the cart" failed after 11121ms: expect(received).toCo
- L247 [11-01] New category is created and shows on Home once it holds a service; set Inactive it leaves Home (SET-132, SET-135) @exclusive — expect(received).toContain(expected) // indexOf

### tests/regression/volt-qc/app-rpt-set-perm/set-payment-receipt.spec.ts (3)

- L267 [11-01] Tip option: add → Save → on the customer screen; edit value + description → Save; Delete writes at once and renumbers (SET-069, SE — Step "SET-069 add → listed → Save → customer screen" failed after 15288ms: expect(received).toContai
- L373 [11-01] A 5th Active tip option saves; dragging the last QC option to #1 reorders the customer screen (SET-073, SET-076) @exclusive — Step "SET-076 drag the last QC option to #1 → Save" failed after 1357ms: expect(received).toBe(expec
- L514 [11-01] Supply Share: both formulas shown; switching method → Save → kept after leaving; restored (SET-065) @exclusive — Could not find a visible "Deduct Before Commission" within 15000ms.

### tests/regression/volt-qc/app-rpt-set-perm/set-staff-lang.spec.ts (7)

- L235 [11-01] Services: dragging a category in Reorder saves at once and Home follows; original order restored (SET-151) @exclusive — expect(received).toEqual(expected) // deep equality
- L287 [11-01] Add New Item: Price / Supply Fee cap at $9,999,999.99 and refuse negatives; nothing created (SET-139) — expect(received).toMatch(expected)
- L316 [11-01] Employee: edit Last Name → Save → kept after leaving; restored (SET-169) @exclusive — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex shr
- L432 [11-01] Create New Staff with every field empty: Nick name / Staff code / Role required, nothing created (SET-158) — expect(received).toEqual(expected) // deep equality
- L457 [11-01] Roles: each role page heading carries its name and the Assign button reads "Assign to <role> Role" (SET-122) — expect(received).toContain(expected) // indexOf
- L638 [11-01] Vietnamese: the Business Info guard title and the City validation message are Vietnamese (SET-112) @exclusive — expect(received).not.toBe(expected) // Object.is equality
- L678 [11-01] Vietnamese: the customer tip screen stays English; staff / service names and money format unchanged (SET-108, SET-109) @exclusive — Step "SET-108 customer tip screen in English" failed after 53916ms: cashToTipScreen(Đơn hàng #OD2611

### tests/regression/volt-qc/appt-time-turn/appt-board-ui.spec.ts (1)

- L117 [11-03] Default board is today with the red Now line scrolled to about the middle (APPT-009) — expect(received).toBeLessThanOrEqual(expected)

### tests/regression/volt-qc/appt-time-turn/appt-cards.spec.ts (3)

- L121 [11-03] Columns: Unassigned first then staff A→Z; each column badge = its cards; badges sum to the cards shown, none Canceled (APPT-020, A — expect(received).toEqual(expected) // deep equality
- L435 [11-03] Phone reveal: masked phone asks for a staff code; unknown code refused; Escape keeps it masked; Owner code shows it; 30-min skip s — Step "unknown code → "Failed to verify staff code", still masked" failed after 1775ms: WebDriverErro
- L510 [11-03] Home › Appointments Today: (N) = today's non-canceled lines, Show/Hide, row "time | name | Staff: … | masked phone", only today's — Step "count and Show / Hide" failed after 360ms: expect(received).toEqual(expected) // deep equality

### tests/regression/volt-qc/appt-time-turn/appt-checkout.spec.ts (2)

- L118 [11-03] Checkout creates a prefilled order; Pending shows it; the booking then has Order # + Checkout which reopens the same order; editin — Step "booking popover: Order #id1 and Checkout; Checkout reopens id1, one pending card" failed after
- L222 [11-03] Holding another order: Checkout asks "Open Appointment Order" — Cancel keeps the held order, Continue opens the booking's order an — Step "Checkout → dialog → Cancel: still on the board, held order unchanged" failed after 3602ms: exp

### tests/regression/volt-qc/appt-time-turn/time-keeping-write.spec.ts (2)

- L88 [10-31] Sidebar › Time Keeping opens the dialog over /order-pending with the dialog param, no passcode (TIME-001) — No visible ".//a[normalize-space(.)="Time Keeping"]" #0 inside "[data-sidebar="sidebar"]"
- L257 [10-31] Double-clicking Check In creates one record only (TIME-017) — expect(received).toHaveLength(expected)

### tests/regression/volt-qc/appt-time-turn/time-payroll-lock.spec.ts (2)

- L62 [11-03] Locked payroll: Add blocked before / on lockedAt (2 errors), allowed after; records before the lock are view-only, no Delete (TIME — Step "TIME-076 the day after the lock day 12:00–01:00 AM → saved" failed after 18716ms: Add 3333 10/
- L144 [11-01] No payroll locked yet → no lock-date constraint: a 01/01/2020 record saves (TIME-082) — Never appeared: [{"role":"dialog","hasText":"Add New Time Keeping","nth":-1},{"role":"option","nameR

### tests/regression/volt-qc/appt-time-turn/time-tracking-write.spec.ts (8)

- L139 [11-01] Add dialog defaults and validation, nothing saved: staff required, Date IN kept, 300-char paste, OUT ≤ IN, OUT on another day, Clo — Step "TIME-057 OUT before IN" failed after 15802ms: Never appeared: [{"role":"dialog","hasText":"Add
- L227 [11-01] Valid records: Total Hours rounded (1 / 1.33 / 1.5 / 1.17), yesterday with a note, "-" without, 255-char note (TIME-044, TIME-046, — Step "TIME-044 Total Hours 1 / 1.33 / 1.5 / 1.17" failed after 15828ms: Never appeared: [{"role":"di
- L300 [11-01] Overlap check on Add: inside, adjacent, open shift to end of day, one minute, other staff (TIME-060, TIME-061, TIME-062, TIME-063, — Never appeared: [{"role":"dialog","hasText":"Add New Time Keeping","nth":-1},{"role":"option","nameR
- L350 [11-01] Records drive the Time Keeping tile: inside a closed shift → inert; open record → Available; set OUT → Unavailable; delete the ope — Step "TIME-022 now inside a closed shift → tile inert, no action" failed after 15770ms: Never appear
- L464 [11-01] Edit: Staff read-only, Save locked until changed, hours recomputed, Created At kept; overlap ignores itself but blocks another rec — Never appeared: [{"role":"dialog","hasText":"Add New Time Keeping","nth":-1},{"role":"option","nameR
- L533 [11-01] Delete: confirm text, Cancel keeps the record, Delete removes it (TIME-088, TIME-089) — Never appeared: [{"role":"dialog","hasText":"Add New Time Keeping","nth":-1},{"role":"option","nameR
- L573 [11-01] Date OUT clock: 3 wheels (01–12, 00–59, AM/PM) pick 08:45 PM → record 08:00–08:45 PM is 0.75 h; future time today saves; tomorrow — Step "TIME-072 the wheels pick 08 / 45 / PM → Date OUT = 20:45" failed after 10026ms: expect(receive
- L652 [11-01] Boundary records 12:00–12:01 AM, adjacent 12:01–12:02, 11:00–11:59 PM; overlap at the day end; bad edit not saved; Today / Yesterd — Step "add 3 boundary records today (one adjacent) + 11 PM yesterday" failed after 15759ms: Never app

### tests/regression/volt-qc/appt-time-turn/turn-adjust-home.spec.ts (2)

- L66 [10-31] +2 then Save: Current updates, Save / Reset off; board, Turn Order and card add 2; a second adjustment starts at Current and accum — Step "TURN-066 +2 → Save" failed after 2981ms: expect(received).toBe(expected) // Object.is equality
- L123 [10-31] No negative turns: − is disabled at 0; saving 0 shows 0 on the board, never a negative (TURN-068) — element ("./button[@aria-label="decrease"]") still not clickable after 5000ms

### tests/regression/volt-qc/appt-time-turn/turn-board-write.spec.ts (3)

- L299 [10-31] A manual adjustment saved while the board shows a PAST day lands on TODAY; the past day is unchanged (TURN-073, TURN-074) — Step "Adjust abc xyz1 xyz +1" failed after 19462ms: Element <button data-slot="button" class="shrink
- L342 [10-31] Adjust Manual Turn: rows in board order, Current = board, ± not saved, Reset back to Current, X discards (TURN-065, TURN-070, TURN — Step "TURN-065 every row" failed after 105ms: expect(received).toBe(expected) // Object.is equality
- L550 [10-31] Dragging the tab: vertical clamp at 10 %, past mid-screen docks right with the popup opening leftwards; board keeps sort + date in — Step "TURN-058 Most turns first + yesterday survive close / reopen" failed after 20043ms: Element <b

### tests/regression/volt-qc/appt-time-turn/turn-count.spec.ts (9)

- L169 [10-31] Decimal $30: three $10 orders round on the DAY total (0.33 → 0.67 → 1); no minimum ($27 → +0.9 each) (TURN-030, TURN-031) @exclusi — Timeout
- L206 [10-31] Integer per service $25: only services ≥ $25 count (= $25 included); a $50 service is still 1 turn; orders add up (TURN-032, TURN- — Could not find "service-based switch" within 5000ms.
- L234 [10-31] Per order (service-based OFF, $100): every paid order is 1 turn whatever its price or line count (TURN-034) @exclusive — Could not find "turn settings dialog" within 15000ms.
- L256 [10-31] Turns use the line service price: an item discount does not reduce them; Cash counts like Other; an edited line price counts at th — Step "TURN-038 $30 Quick Pay with a 30 % item discount → still +1" failed after 41076ms: expect(rece
- L301 [10-31] Two-staff order: each staff counts their own services; the order re-sorts on Fewest; board, Turn Order and card agree (TURN-043, T — Timeout
- L357 [10-31] Cancel Order (void) on today's order takes its turns back (TURN-046) @exclusive — Could not find "cancel order button" within 15000ms.
- L420 [10-31] Saving the Turn value from board › Setting: toast, dialog closes, the board recomputes at once (past days too); Charge & Fee shows — Step "TURN-061 Charge & Fee › Turn Settings shows $50.00" failed after 17700ms: Never appeared: Char
- L527 [10-31] Manual adjustments survive a counting-mode switch (decimal ↔ per order); a hidden negative adjustment left after a void swallows t — Timeout
- L603 [10-31] Turn value $0: tab and card turn lines hidden, board still opens from the sidebar and Setting can switch Turn back on; Charge & Fe — Step "Clock in 1 staff" failed after 14601ms: Could not find "time keeping card action" within 5000m

### tests/regression/volt-qc/cd-e2e/cd-cart.spec.ts (1)

- L285 [11-01] Remove a line → it leaves the customer display and the tiles update; remove the last one → Welcome (CD-013) @dual-window — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/cd-e2e/cd-deep.spec.ts (1)

- L171 [10-31] Card + signature BEFORE (not required): preset → Present Card → Close → Complete again: the tip screen comes back with the same pr — Step "Custom $3.21 → Present Card → Close → back: Custom Tip lit, $3.21" failed after 32023ms: Neith

### tests/regression/volt-qc/cd-e2e/cd-payment.spec.ts (3)

- L135 [11-01] Send-receipt screens: Text Message pre-fills the phone, C + 9 digits disables Send, back → Payment complete; Email autofocus, "abc — Step "CD-065 Text Message" failed after 15725ms: expect(received).toBe(expected) // Object.is equali
- L209 [11-01] No raw i18n key and no page-level overflow on every customer screen (Welcome, cart, confirm, check-in, tip, custom tip, Payment co — Never appeared: {"css":"button.absolute.top-6.left-6","nth":0}
- L271 [11-01] Points shown after paying Cash, Other and Gift Card ("Congrats! You've earned" N > 0) (CD-061) @dual-window — Step "Cash (new customer)" failed after 31978ms: expect(received).toBeGreaterThan(expected)

### tests/regression/volt-qc/cd-e2e/cd-phone.spec.ts (2)

- L65 [11-01] Phone block: input, 0-9/C, backspace, Done disabled, consent + Terms + Privacy; Done only at 10 digits, backspace drops one, C cle — Step "CD-022 parts" failed after 3108ms: expect(received).toBe(expected) // Object.is equality
- L165 [11-01] Main attaches A → customer "No, enter again" → types B → Check-in B; remove, re-attach A → Yes: "Your current points" = Point on m — Step "CD-035 A again → Yes → points match" failed after 7285ms: expect(received).toBeGreaterThan(exp

### tests/regression/volt-qc/cd-e2e/cd-settings.spec.ts (2)

- L206 [11-01] Show Point / Show Reward: unsaved change → "Discard changes and leave?"; Point ON + Reward OFF → points, no reward list; both OFF — Step "CD-037.2 both OFF" failed after 40444ms: expect(received).toBe(expected) // Object.is equality
- L288 [11-01] Card + signature BEFORE required: tip + pad + Clear, Continue only once signed (CD-052) @exclusive @dual-window — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/cd-e2e/cd-tip.spec.ts (3)

- L249 [11-01] Card: preset → Continue → Present Card → Close → Complete again goes straight to Present Card carrying the tip (no TC id — volt-qc — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex shr
- L290 [11-01] Cashier tip $5.00 on main → Complete pushes no tip screen, paid with Total Tip $5.00 (CD-049) @dual-window — Passcode was not accepted: the guard is still prompting 15000ms after 4 digit(s) were entered. Check
- L314 [11-01] Cashier tip $0 counts as no tip → the Add a tip screen is still pushed (CD-050) @dual-window — Passcode was not accepted: the guard is still prompting 15000ms after 4 digit(s) were entered. Check

### tests/regression/volt-qc/cd-e2e/e2e-errors.spec.ts (3)

- L100 [11-01] Smoke close-out: a Cash and an Other order each land in Daily Sale with Total = paid and Tip $0.00, the staff is in Staff Income, — Timeout
- L146 [11-01] Cashier tip $2 on Cash → completes, the order never bounces back to Pending within 15 s; Order History Successful - Unsettled, cus — No "#OD…" order header on Home.
- L212 [11-01] Cancel while the customer picks a tip creates no transaction; double-clicking Complete Payment yields one passcode, one tip screen — Step "double-click Complete Payment" failed after 49074ms: Never reached Payment Successful within 4

### tests/regression/volt-qc/cd-e2e/e2e-extra.spec.ts (3)

- L102 [11-01] Adjust Tip after payment: Other order +$2.00 → Tip $2.00, Total = paid + $2, "<staff> - $2.00", still Unsettled; 2-staff Cash orde — Step "order A (Other, one staff) +$2.00" failed after 18053ms: Passcode was not accepted: the guard
- L145 [11-01] Void an unsettled Cash order: Canceled (never stuck Canceling), Cancel information with amount and reason, only Receipt left, and — expect(received).toMatch(expected)
- L206 [11-01] Re-open to change the staff (restricted mode): line price unchanged, every tender owes $0.00, Re-Open Done → Unsettled, same Total — Passcode was not accepted: the guard is still prompting 15000ms after 4 digit(s) were entered. Check

### tests/regression/volt-qc/cd-e2e/e2e-points-promo.spec.ts (3)

- L71 [11-01] No Receipt pressed right after paying still books points (> 0, POS Point = earned) and keeps the customer on the order (E2E-016) @ — expect(received).toBeGreaterThan(expected)
- L101 [11-03] Other + customer Custom Tip $2.00 → paid = Other + $2.00, points > 0 (tip in the base), tip in Order History and the Daily Sale ro — Step "Daily Sale row" failed after 184826ms: expect(received).toBe(expected) // Object.is equality
- L370 [11-03] Journey: new customer, 2 lines, −10% order discount, Other + 10% customer tip → points earned; Order History customer/discount/tip — Step "−10% on the order" failed after 15598ms: Never appeared: {"role":"button","name":"Promo & Rewa

### tests/regression/volt-qc/cd-e2e/e2e-reopen-split.spec.ts (1)

- L189 [11-03] Two-staff Cash order + cashier tip $3 → Split Tip evenly → each staff $1.50 on payment-success and Order History; Daily Sale row T — Step "Cash + tip $3.00" failed after 19569ms: Passcode was not accepted: the guard is still promptin

### tests/regression/volt-qc/cd-e2e/e2e-settings.spec.ts (2)

- L231 [11-01] Passcode "Completed Payment" OFF → payment asks no code while reports still do; back ON → asks again; ticking "skip 30 minutes" ca — Step "Daily Sale still gated" failed after 6641ms: expect(received).toBe(expected) // Object.is equa
- L362 [11-01] Show Point OFF → customer display shows no earned/current points, yet the points are still booked (POS "Point:" > 0) (E2E-050) @ex — expect(received).toBeGreaterThan(expected)

### tests/regression/volt-qc/home-pend/home-customer.spec.ts (9)

- L200 [11-03] An existing phone + Done picks that customer and opens the order, no quick-add (HOME-096) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L275 [11-03] A new phone + Done opens quick-add (phone title, name, group, View More, Save); closing it creates nothing (HOME-097, HOME-103) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L307 [11-03] Save with an empty name → customer "UNKNOWN<last 4>", order opened with it (HOME-098) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L325 [11-03] A 51-char name → "Customer name must be 50 characters or less", nothing created (HOME-099) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L346 [11-03] View More → "Customer Information" pre-filled (phone, name); a valid email → Save creates the customer + order (HOME-101) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L379 [11-03] Customer Information: email "abc@" → "Invalid email"; an 81-char note is refused; nothing saved (HOME-102) — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L406 [11-03] Groups: 2 groups → 2 chips; 3 groups keep the full name + 3 chips; "VIP" is a plain chip with no tier badge and no price change (H — Step "HOME-100 two groups" failed after 8650ms: WebDriverError: element click intercepted: Element <
- L444 [11-03] Customer bar: name, _**-**_-xxxx, Point: 0, Visit: 0, edit + remove buttons (HOME-106) — expect(received).toContain(expected) // indexOf
- L521 [11-03] View phone: an unknown code errors; a role without View Phone Number is refused; the phone stays masked (HOME-110) — expect(received).toMatch(expected)

### tests/regression/volt-qc/home-pend/home-items.spec.ts (2)

- L126 [11-03] Pinned Quick Pay + Gift Card lead the tiles, then categories; the first category is pre-selected (HOME-035) — expect(received).toBe(expected) // Object.is equality
- L298 [11-03] Same service twice → two separate lines at catalogue price; an edited line keeps its own price (HOME-044) — WebDriverError: element click intercepted: Element <span class="line-clamp-2 wrap-anywhere" data-vqc

### tests/regression/volt-qc/home-pend/home-order.spec.ts (7)

- L224 [11-03] An unpaid order has Remove (no Cancel Order); Remove → passcode FIRST → confirm → order gone (HOME-146, HOME-147) — expect(received).toBe(expected) // Object.is equality
- L254 [11-03] Remove → passcode → Cancel on "Delete Order" keeps the order, its line and customer (HOME-148) — expect(received).toBe(expected) // Object.is equality
- L276 [11-03] Remove → close the passcode with Escape / X: no confirm opens, the order stays (HOME-149) — expect(received).toBe(expected) // Object.is equality
- L301 [11-03] Remove → an unknown code is rejected; an Inactive staff code says "This staff is inactive" (HOME-150) — typeCode(): no passcode dialog is open
- L347 [11-03] Ticking "Do not require passcode for the next 30 minutes" on order 1 → order 2 Remove goes straight to confirm (HOME-152) — expect(received).toBe(expected) // Object.is equality
- L463 [11-03] Remove Staff removes every service of that staff and keeps the other group (HOME-080) — Step "Create order (Zelene Doyle + Lidasy, Lidasy)" failed after 12542ms: WebDriverError: element cl
- L622 [11-03] A group with 3 services has ONE Change Staff button for the whole group (HOME-088) — Step "Create order (Zelene Doyle + Lidasy, Lidasy, Lidasy)" failed after 12464ms: WebDriverError: el

### tests/regression/volt-qc/home-pend/home-panels.spec.ts (4)

- L108 [11-03] Merge Order: hidden on an empty order, shown once it has an item, hidden after a Custom Discount (HOME-125) — expect(received).toBe(expected) // Object.is equality
- L280 [11-03] Two-staff order: card names staff B; B then A + service lands in A's group, no duplicate group, still one card (HOME-032, HOME-034 — WebDriverError: element click intercepted: Element <span class="line-clamp-2 wrap-anywhere" data-vqc
- L532 [11-03] Header Search for a customer with a paid order: tab counts, per-tab rows, highlight; open the customer; open the order in Order Hi — Element <input data-slot="input" placeholder="Search..." readonly="" class="h-full w-full flex-1 rou
- L619 [11-03] A pending order is not in the header Search "Order" tab (HOME-159) — Element <input data-slot="input" placeholder="Search..." readonly="" class="h-full w-full flex-1 rou

### tests/regression/volt-qc/home-pend/home-virtual-keyboard.spec.ts (3)

- L101 [11-01] Quick Pay with the on-screen keypad: 1234 → $12.34; Reset amount → 0.00; then 5,0 → $0.50 (HOME-056) @exclusive — expect(received).toBe(expected) // Object.is equality
- L141 [11-01] Quick-add: letters typed on the keyboard, its Done hides it without submitting; Service Name keeps 50; Add stays reachable (HOME-1 — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-
- L198 [11-01] Keyboard OFF: Search staff / customer name never open it; ON: the Pending sidebar search never opens it (HOME-171) @exclusive — WebDriverError: element click intercepted: Element <button type="button" class="flex-center rounded-

### tests/regression/volt-qc/home-pend/pend-orders.spec.ts (3)

- L437 [11-01] Card content: Unknown / N/A / 0 Pts; "+ N more services"; services added on Home appear; sidebar card has total, points, time (PEN — Step "Create order (Zelene Doyle + Lidasy, Dark Queen, Lidasy, Dark Queen)" failed after 11834ms: We
- L917 [11-01] Add / remove a service on a pending order reopened from /order-pending: Total, sidebar card, page card and reopened data follow (P — WebDriverError: element click intercepted: Element <span class="line-clamp-2 wrap-anywhere" data-vqc
- L1056 [11-01] Checkin Today shows its count and one card per check-in; an Active card opens that pending order, a Completed one its detail (PEND — expect(received).toMatch(expected)

### tests/regression/volt-qc/oh-reopen/oh-cancel.spec.ts (4)

- L88 [11-01] Cancel dialog copy, 7 reasons in order, Confirm only with a reason, Keep Order changes nothing (OH-111, OH-112) — Step "Pay with other (E2E Other)" failed after 33847ms: The other payment for order 01a19601-d778-76
- L224 [11-01] A typed Other reason is shown verbatim in Cancel information (OH-115) — expect(received).toBe(expected) // Object.is equality
- L281 [11-01] Cancel Order (Void) gate OFF: Confirm Cancel runs with no passcode dialog (OH-119) — expect(received).toBe(expected) // Object.is equality
- L312 [11-01] Double-clicking Confirm Cancel creates one void only (OH-126) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/oh-reopen/oh-detail.spec.ts (2)

- L226 [11-01] Send SMS pre-fills the customer phone; empty / 9 digits cannot send; bad email blocked; focus caret at the end; reopening resets t — Could not find "cart pay button" within 15000ms.
- L293 [11-01] Canceled order offers only Receipt and its receipt shows the void; Refunded/Refund Issue/Canceling/Refunding (when present) only R — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/oh-reopen/oh-list.spec.ts (4)

- L333 [11-01] Deleting the term with Backspace (no x) restores the full list, same order, x hidden, no red dot (OH-217) — expect(received).toEqual(expected) // deep equality
- L385 [11-03] Header Scanner: a receipt QR opens the completed order (twice, no stray dialog); a pending QR opens Home (OH-037, OH-038, OH-039) — expect(received).toMatch(expected)
- L526 [11-03] Payment filter: Cash excludes a cancelled (voided) cash order; several methods are OR (OH-058, OH-059) — expect(received).toBe(expected) // Object.is equality
- L634 [11-01] A Re-open order shows the Re-open badge, the Status filter has no "Re-open", detail offers Continue Re-open (OH-066) — Could not find "cart pay button" within 15000ms.

### tests/regression/volt-qc/oh-reopen/oh-refund.spec.ts (3)

- L131 [11-03] A Partial Refunded settled order still offers Refund for the rest (OH-107) — expect(received).toBe(expected) // Object.is equality
- L141 [11-03] Refund dialog on a one-service order: FULL, amount = Total and locked, method locked, reason required (7, Other text ≤ 80) (OH-131 — Step "OH-131 defaults" failed after 55ms: expect(received).toMatch(expected)
- L188 [11-03] Two services: All services = FULL; one service = PARTIAL with that line's amount, method required showing Remaining; Cancel resets — Step "OH-132 All services → full" failed after 15029ms: Never appeared: [{"css":"[data-testid=\"orde

### tests/regression/volt-qc/oh-reopen/oh-tip.spec.ts (4)

- L147 [11-01] Tip keypad: presets add up, first digit replaces the pre-fill, delete key, $10,000 cap, Escape/outside do not close, X closes with — Could not find "cart pay button" within 15000ms.
- L246 [11-01] Split Tip shows only on an unsettled order with more than one staff (OH-200) — Could not find "cart pay button" within 15000ms.
- L300 [11-01] Split Tip: Confirm disabled with no change; Manual caps the second field at what is left; Split Evenly shows the even split at onc — Step "OH-204 Manual: sum below the tip locks Confirm; field 2 capped at the rest" failed after 2927m
- L373 [11-01] Two Other txns after a reopen: Adjust Tip opens the "Adjust Order Tip" list, one Adjust Tip per txn, the chosen one gets the tip ( — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/oh-reopen/oh-vq.spec.ts (2)

- L174 [11-03] Pending order with one check paid: Home › Cancel Order only points to Order History ("Order already has a payment"); detail says " — Never appeared: [{"role":"complementary","name":"Pending Orders sidebar"},{"role":"textbox","nth":0}
- L237 [11-03] The list for a date range agrees with the Daily Sale order count of the same range (OH-048) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/pay/pay-cash-other-settle.spec.ts (2)

- L268 [11-03] An Other name with Vietnamese diacritics and symbols survives to the success screen and Order History (PAY-035) @payment — expect(received).toContain(expected) // indexOf
- L385 [11-01] No drawer / printer on the till: Cash Drawer toasts "Open cash drawer failed" and Print on checkout toasts, payment still possible — Step "PAY-133: Cash Drawer → guard (if on) → drawer error toast; Complete still enabled" failed afte

### tests/regression/volt-qc/pay/pay-fee-card-reopen.spec.ts (1)

- L190 [11-01] Card charge through the terminal succeeds; success line reads "Card (Credit)"; Order History has one successful card payment (PAY- — Step "Pay by card" failed after 5493ms: Complete Payment stays disabled on the Card tender and the h

### tests/regression/volt-qc/pay/pay-keypad.spec.ts (1)

- L73 [11-03] Keypad: C → $0.00 then digits by cents, back-space drops the last digit down to $0.00, a key after the pre-fill appends or replace — Step "PAY-017: back-space ×5 from the due drops one cents digit each time, never below $0.00" failed

### tests/regression/volt-qc/pay/pay-tip.spec.ts (1)

- L361 [11-01] % presets on $33.33 round half-up to the cent (PAY-071) @payment @dual-window — Could not find "quick pay amount input" within 15000ms.

### tests/regression/volt-qc/pos/appointment.spec.ts (2)

- L133 [11-03] Many staff: columns are virtualised horizontally; scrolling to the end shows the last staff (APPT-026) — expect(received).toContain(expected) // indexOf
- L484 [11-03] Time axis has 96 quarter-hour labels; Unassigned is not hatched; no header badge on a day without appointments (APPT-018, APPT-023 — expect(received).toEqual(expected) // deep equality

### tests/regression/volt-qc/pos/home.spec.ts (8)

- L59 [11-03] Customer entry: keypad 0-9/C + backspace, Done disabled, phone mask, paste 11 digits drops the leading 1 (HOME-089, HOME-091, HOME — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L101 [11-03] Tile order Quick Pay, Gift Card, then categories; "N Service(s)" plural rule; service tiles show name + $x.xx (HOME-036, HOME-038) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L132 [11-03] Service search keeps only matching services and deselects the category; no match → "No services available." (HOME-039, HOME-040) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L154 [11-03] More than 8 tiles: dragging the carousel shows the rest and keeps the selected category (HOME-037) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L198 [11-03] Sort by popover lists every option; Name sorts A→Z then Z→A (HOME-023, HOME-024) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L274 [11-03] Home layout: 4 panels, no horizontal scroll, customer placeholder not clipped, sidebar has no collapse/pin (HOME-001, HOME-003, HO — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L310 [11-03] Typing one character in Search staff / Search service shows no "null"/"undefined" (HOME-002) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}
- L328 [11-03] Checkin Today / Appointments Today accordions toggle Show/Hide; none today → "No appointments today" (HOME-117) — Never appeared: {"role":"button","name":"Quick Checkout","nth":0}

### tests/regression/volt-qc/pos/order-history.spec.ts (1)

- L304 [11-03] Date range picker: Apply, Today, Cancel, future days disabled (OH-043, OH-044, OH-045, OH-046) — Step "OH-045 Cancel keeps the range" failed after 2648ms: expect(received).toEqual(expected) // deep

### tests/regression/volt-qc/pos/pending.spec.ts (1)

- L138 [11-03] Grid holds at most 4 cards a row and scrolls to the last card (Last 30 Days) (PEND-022) — expect(received).toContain(expected) // indexOf

### tests/regression/volt-qc/pos/turn.spec.ts (1)

- L73 [11-01] Board / Adjust Turn / Setting open with no passcode; Turn Settings labels + value = Charge & Fee; X saves nothing; service-based O — Step "TURN-060 the values match Settings › Charge & Fee › Turn Settings" failed after 17252ms: Never

### tests/regression/volt-qc/promo-split/promo-deep.spec.ts (3)

- L135 [11-01] PROMO-D01 Deep discount on a 2-line order: item discount 0 blocked → 10%; Custom 0 / 100% / $ above the budget; $5 split Owner 40 — Timeout
- L308 [11-03] PROMO-D02 Reopen Promo & Rewards after Custom 10%: preselected, tab %, box = 10, Apply disabled until changed; 15% → re-applied (P — expect(received).toBe(expected) // Object.is equality
- L386 [11-03] PROMO-D04 Points on cancel / re-open: new customer K pays Other → cancel keeps points (never negative); 2nd order Cash adds on; re — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex cur

### tests/regression/volt-qc/promo-split/promo-discount.spec.ts (2)

- L435 [11-03] PROMO-I Item discount %/$, over-price and >100% blocked, 100%, combined with promotion, Quick Pay with discount (PROMO-036, PROMO- — Step "PROMO-036 / PROMO-037 $30: 10% → "10% OFF -$3.00", Other = $27 + tax; $5.00 → "$5.00 OFF"" fai
- L585 [11-03] PROMO-J0 Custom 10% → no Merge Order button (PROMO-048) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/promo-split/promo-gaps.spec.ts (1)

- L116 [11-03] No Cashback section in Promo & Rewards on this build (PROMO-102) — Never appeared: {"role":"button","name":"Promo & Rewards","nth":0}

### tests/regression/volt-qc/promo-split/promo-points.spec.ts (6)

- L109 [11-03] PROMO-M0 New customer: Point 0 / Visit 0 on the customer bar, checkout and Pending card (PROMO-075) — expect(received).toBe(expected) // Object.is equality
- L212 [11-03] PROMO-PT Points include the tip, the gift-card part earns nothing, a gift-card-only sale = 0 points (PROMO-080, PROMO-082, PROMO-0 — Step "PROMO-080 Other + cashier tip $2 → points include the tip" failed after 21587ms: WebDriverErro
- L267 [11-01] PROMO-PT1 Floor rounding: Quick Pay $10.50 / $11.00 paid Cash → floor(paid incl. tax / rate) (PROMO-078, PROMO-079) @dual-window — Step "PROMO-078 Quick Pay $10.5 Cash → floor(paid / 1)" failed after 30784ms: expect(received).toBe(
- L300 [11-03] PROMO-PT2 Split Cash + Other: points = sum of per-tender points (floor per method) (PROMO-086) @dual-window — Element <span class="whitespace-nowrap text-lg font-semibold leading-8 text-foreground" data-vqc-hit
- L346 [11-03] PROMO-M2a Re-Open then finish again does not add a Visit (PROMO-098) — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex cur
- L380 [11-03] PROMO-M2c Change the customer before paying: only the last customer earns points (PROMO-100) @dual-window — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex cur

### tests/regression/volt-qc/promo-split/split-basic.spec.ts (1)

- L99 [11-03] SPLIT-C Even split 2 checks: Check 1 Cash, Check 2 Other with name → Complete Done (SPLIT-036, SPLIT-039, OH-078) — Step "Pay Check 2 with Other + method name" failed after 25356ms: Never appeared: [{"role":"dialog",

### tests/regression/volt-qc/promo-split/split-card.spec.ts (2)

- L114 [11-01] SPL-C1 Terminal not connected: Card on a check locks Pay; Cash still pays; Card again locks (SPLIT-041) — Step "Card + no terminal → Pay locked" failed after 9945ms: expect(received).toBe(expected) // Objec
- L256 [11-01] SPL-C4 Price per check method: check 1 Cash / Other / Gift Card shows the Cash price (no Service Fee), check 2 Card keeps the Card — WebDriverError: element click intercepted: Element <button data-slot="button" class="inline-flex shr

### tests/regression/volt-qc/promo-split/split-deep.spec.ts (2)

- L524 [11-03] SPLIT-D04 By Items 2 staff, 3 checks (1 item each): check = item Card price; Cash + $2 / Other + $1 / Other; Split Tip $3.00 Evenl — Step "Pay: check 1 Cash + $2, check 2 Other + $1, check 3 Other; each = item Cash price, Σ = order C
- L746 [10-31] SPLIT-D06 Vietnamese: Split screen (Chia đều / Theo số tiền / Theo món, "Thanh toán đơn N"), check payment dialogs, success page " — Step "Thanh toán đơn 2 in Khác → "Đã hoàn tất tất cả thanh toán đơn" → Hoàn tất → "Hoàn tất - Xong"

### tests/regression/volt-qc/promo-split/split-gaps.spec.ts (1)

- L295 [11-03] A split order with a paid check: Home offers Cancel → "Order already has a payment" instead of delete (SPLIT-067) — Never appeared: [{"role":"complementary","name":"Pending Orders sidebar"},{"role":"textbox","nth":0}

### tests/regression/volt-qc/promo-split/split-plan-a.spec.ts (3)

- L181 [11-03] SPLIT-E4 By Amount, Back to order, re-enter Split: checks sum = Total (SPLIT-010) — Never appeared: [{"css":"main"},{"role":"button","name":"Back to order","nth":0}]
- L812 [11-03] SPLIT-I4 Skip passcode 30 min: double click Pay in Other Payment creates 1 transaction; Check 2 asks no passcode (SPLIT-047, SPLIT — Never appeared: passcode dialog
- L872 [11-03] SPLIT-J1 Pay check with a wrong code → error, check unpaid (SPLIT-048) — Never appeared: passcode dialog

### tests/regression/volt-qc/promo-split/split-plan-b.spec.ts (3)

- L409 [11-03] SPLIT-L1 One check paid: Back to order hidden, leaving blocked "Please complete all checks before leaving"; voiding all restores B — expect(received).toBe(expected) // Object.is equality
- L705 [10-31] SPLIT-O1 Void Check 1 (Cash): "Are you sure you want to void Check 1 (Total Paid by Cash: $x)?", 7 reasons, Confirm Void disabled — Never appeared: passcode dialog
- L768 [10-31] SPLIT-O2 Reason Other required (empty/blank → disabled), max 80 chars; Keep and closing the passcode keep the paid check; reason t — Step "SPLIT-085: up to the passcode step, then close → check still paid" failed after 8926ms: Never

### tests/regression/volt-qc/reports-time/rpt-batch.spec.ts (2)

- L47 [11-01] Layout: heading, Last 7 Days, 5 columns, empty review panel; the Open batch is always first (RPT-164, RPT-165) — expect(received).toBe(expected) // Object.is equality
- L109 [11-01] Batch Close Review for a Closed and the Open batch; OD Code opens a view-only Order Details (RPT-167, RPT-168, RPT-169) — Step "RPT-167 Closed batch → review with date/time and OD Code | Subtotal | Tip | Total" failed afte

### tests/regression/volt-qc/reports-time/rpt-staff-income.spec.ts (2)

- L150 [11-03] Search is case/space-insensitive; no match / special chars / 200 chars → no rows; figures = Σ visible rows (RPT-091, RPT-092, RPT- — Step "RPT-091 two first letters / upper case with spaces / cleared" failed after 16147ms: Element <i
- L287 [11-01] Detail table: columns, service names, newest first; a row opens Order Details (RPT-098, RPT-100) — Step "RPT-100 a row → Order Details (orderId); closing keeps the staff selected" failed after 31109m

### tests/regression/volt-qc/reports-time/rpt-summary.spec.ts (3)

- L117 [11-01] The 10 presets in order, each with its comparison label; Last 7 Days = 7 rows (RPT-058) — Step "Last 7 Days" failed after 750ms: expect(received).toBe(expected) // Object.is equality
- L205 [11-01] This Month lists one row per day up to today (RPT-061) — expect(received).toBe(expected) // Object.is equality
- L307 [11-01] The % pill = |(c−p)/p|×100 with 2 decimals, coloured by sign (RPT-069) — Pill "134.80%" vs expected 152.47% (c=12013218, p=4758329) — volt-qc bug #25

### tests/regression/volt-qc/reports-time/time-keeping-dialog.spec.ts (1)

- L62 [11-01] Open from the header / URL, close 3 ways, column sort, search, empty state, one tile selected at a time (TIME-002, TIME-003, TIME- — Step "TIME-009 search by 3 middle letters, then the upper-case name with spaces" failed after 272ms:

### tests/regression/volt-qc/reports-time/time-tracking-page.spec.ts (2)

- L124 [11-01] This Year: scrolling loads more rows, # is continuous and rows are unique (TIME-051) — expect(received).toBe(expected) // Object.is equality
- L175 [11-01] Add dialog inputs: staff combobox with search, numeric time input, typed time, date change keeps the time (TIME-067, TIME-071, TIM — Step "TIME-067 the staff combobox has a search box; no match → "No results found."" failed after 778

### tests/regression/volt-qc/settings-devm/settings-general.spec.ts (1)

- L63 [11-03] Accessibility › Passcode Setting: Require Passcode For, Active All and the 14 gates in Reports / Orders / Others (SET-038) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/settings-devm/settings-nav-business.spec.ts (1)

- L532 [11-03] Pay Period: the Current plan card and exactly one pay-period radio checked (SET-024) — expect(received).toMatch(expected)

### tests/regression/volt-qc/settings-devm/settings-payment-receipt.spec.ts (2)

- L296 [11-03] Tipping Settings: sections, Tip Method / Timing / Amount, Tip Option table order, Signature, Save follows changes and the leave gu — Step "Page structure" failed after 151ms: expect(received).toBe(expected) // Object.is equality
- L595 [11-03] Receipt header: the business phone shows masked, asks a passcode on click and hides with its switch (SET-093) — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/settings-devm/settings-services-staff.spec.ts (2)

- L196 [11-03] Services: Create Category validation (no Create), Update Category closes without saving, Reorder dialog pins Quick Pay / Gift Card — Step "Create Category: name validation, Create stays disabled" failed after 8857ms: expect(received)
- L492 [11-03] Staff Information validation (no Save): nickname, staff code, names, email, phone, SSN, postal; duplicate nickname in Create New S — Step "Create New Staff: a nickname already in use is flagged (dialog closed, nothing created)" faile

### tests/regression/volt-qc/vp-tickets/card-charge-payment-success-fail.spec.ts (3)

- L2 [11-01] card-charge-payment-success-fail-test-cases A1 A tapped card with enough funds is approved and the order settles @payment @dual-wi — Step "Pay by card" failed after 5529ms: Complete Payment stays disabled on the Card tender and the h
- L2 [11-01] card-charge-payment-success-fail-test-cases A2 The full order total is paid with one card @payment @dual-window — Step "Pay by card" failed after 5440ms: Complete Payment stays disabled on the Card tender and the h
- L2 [11-01] card-charge-payment-success-fail-test-cases A10 The card is charged the total AFTER a line discount @payment @dual-window — Step "Pay by card" failed after 5440ms: Complete Payment stays disabled on the Card tender and the h

### tests/regression/volt-qc/vp-tickets/split-order.spec.ts (2)

- L47 [11-03] TC-01 Split is disabled for Total ≤ $5.00 and enabled for $5.01 — expect(received).toBe(expected) // Object.is equality
- L102 [11-03] TC-04 By Amount: Check 1 $30 + Check 2 $50 → Check 3 auto = Total − $80 — Could not find "split amount keypad backspace" within 15000ms.

### tests/regression/volt-qc/vp-tickets/vp-1048-daily-sale-report.spec.ts (4)

- L318 [11-01] VP-1048 DSR TC-32 Without a passcode grant the report is held behind the passcode guard — expect(received).toBe(expected) // Object.is equality
- L336 [11-01] VP-1048 DSR TC-33 A wrong passcode keeps the dialog open and the report hidden — expect(received).toBe(expected) // Object.is equality
- L358 [11-01] VP-1048 DSR TC-34 "Do not require passcode for 30 minutes" lets the next visit in without a prompt — Could not find "passcode guard dialog" within 15000ms.
- L409 [11-01] VP-1048 DSR TC-38 Today is live: a new cash order raises Total Order by 1 — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/vp-tickets/vp-1048-income-summary.spec.ts (2)

- L375 [11-01] VP-1048 IS TC-33 Tax Collected = Σ Tax of every tender — VP-1048 IS TC-33: expected $2,064.67 but got $2,067.13 (off by $2.46; 206467 vs 206713 cents).
- L419 [11-01] VP-1048 IS TC-56 Total Payment agrees: table = Payment Details = Sale Details @critical — Sale Details vs table: expected $45,399.90 but got $45,806.95 (off by $407.05; 4539990 vs 4580695 ce

### tests/regression/volt-qc/vp-tickets/vp-1148-wage-per-day.spec.ts (4)

- L78 [11-01] VP-1148 TC-07 Payroll Salary = Wage Per Day × Working Days — element ("a[href="/settings/staffs"]") still not clickable after 15000ms
- L94 [11-01] VP-1148 TC-08 Clean Up Fee/Deduction = Deduction Per Day × Working Days — element ("a[href="/settings/staffs"]") still not clickable after 15000ms
- L110 [11-01] VP-1148 TC-09 Pay 1 + Pay 2 = Total Income (base includes Salary) — element ("a[href="/settings/staffs"]") still not clickable after 15000ms
- L124 [11-01] VP-1148 TC-10 Salary is listed as an income line on the staff check — element ("a[href="/settings/staffs"]") still not clickable after 15000ms

### tests/regression/volt-qc/vp-tickets/vp-1252-5-pending-core.spec.ts (1)

- L74 [11-01] VP-1252-5 TC-05 Once paid it leaves the Pending queue and enters the report @critical — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/vp-tickets/vp-1252-pending-order.spec.ts (1)

- L153 [10-31] VP-1252 TC-13 Editing the service price on the pending order updates its total — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/vp-tickets/vp-1341-payroll-salary.spec.ts (2)

- L89 [11-01] VP-1341 TC-07 Wage Per Day: Salary Amount = Wage Per Day × Working Days — element ("a[href="/settings/staffs"]") still not clickable after 15000ms
- L103 [11-01] VP-1341 TC-08 Wage Per Hour: Salary Amount = Wage Per Hour × Working Hours — element ("a[href="/settings/staffs"]") still not clickable after 15000ms

### tests/regression/volt-qc/vp-tickets/vp-1761-turn-suggestion.spec.ts (3)

- L217 [11-03] VP-1761 TC-10 Setting asks for a staff code first — expect(received).toBe(expected) // Object.is equality
- L263 [11-03] VP-1761 TC-22 The stepper allows going below zero (negative delta) — element ("./button[@aria-label="decrease"]") still not clickable after 5000ms
- L278 [11-03] VP-1761 TC-23 Reset clears only the unsaved entry; saved turns stay — expect(received).toBe(expected) // Object.is equality

### tests/regression/volt-qc/vp-tickets/vp-2400-passcode-settings-extra.spec.ts (1)

- L128 [11-01] VP-2400 TC-15 OFF → ON again: an old 30-minute bypass does not suppress the modal @exclusive — expect(received).toBe(expected) // Object.is equality

SKIPPED NOW:

- tests/regression/order-flow/reopen-flow.spec.ts: 7
- tests/regression/volt-qc/oh-reopen/reopen-methods.spec.ts: 4
- tests/regression/volt-qc/oh-reopen/reopen-vq.spec.ts: 29
- tests/regression/volt-qc/oh-reopen/reopen-core.spec.ts: 17
