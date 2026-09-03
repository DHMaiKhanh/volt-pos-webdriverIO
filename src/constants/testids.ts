/**
 * The data-testid catalogue — the contract every page object consumes.
 *
 * ## Where these ids come from
 *
 * Two sources, and nothing else. Ids are never made up here.
 *
 * 1. **VP-802** (`feat/VP-802`, unmerged): a working WebdriverIO suite for this
 *    app carrying ~157 real testids. Those annotations were written against the
 *    app but the PR never landed, so the ids describe screens that exist while
 *    the attributes themselves do not.
 * 2. **The app on `develop` today**: 20 testids ship in product code
 *    (`git grep 'data-testid' src/ | grep -v __tests__`). A raw grep reports a
 *    higher number because `src/__tests__/*.test.tsx` mounts local stubs
 *    (`complete-button`, `waiting-progress-dialog`, …) that never reach a build.
 *
 * Each group header labels its ids so `scripts/audit-testids.ts` can report
 * against them without treating an un-merged annotation as a regression:
 *
 * - **CONFIRMED** — live in the app on `develop` today.
 * - **PENDING**   — VP-802 wrote it; the app does not ship it yet.
 * - **DERIVED**   — one member of a VP-802 family, spelled out for the other
 *   members using values read from the app's own constants (the four
 *   `payment-success-action-button-{value}` buttons, the payment column of the
 *   order-history filter). The scheme is VP-802's; only the value is new.
 * - **PROPOSED**  — in neither source. A handful of anchors the suite cannot do
 *   without: the splash screen, the settings nav, the order-history search box
 *   VP-802 reached by translated placeholder. Each follows the app's naming
 *   conventions and resolves today through its fallback.
 *
 * ## Why every locator carries a fallback
 *
 * A PENDING id resolves to nothing, so the page object would fail on every
 * screen. Each locator therefore declares reviewed fallbacks taken from JSX that
 * was actually read — a route `href`, a Radix `data-slot`, a hardcoded
 * `aria-label`, a DOM `id`, a semantic class. Delete the fallback the day
 * `npm run audit:testids` reports the id has landed.
 *
 * ## Fallbacks this app does NOT support
 *
 * - **SINGLE-LANGUAGE text for chrome.** i18next drives every label and the
 *   merchant can flip to Vietnamese from `/settings/language`, so
 *   `button=Delete Order` (VP-802 used it) breaks on a Vietnamese till.
 *
 *   The BILINGUAL helpers are a different matter and are used freely below.
 *   `src/locales/` holds exactly two bundles, `en` and `vi`, so
 *   {@link buttonWithAnyText} / {@link rowAmount} / {@link cardWithTitle} can
 *   enumerate every language the app is able to be in. Each call carries both
 *   strings copied verbatim out of `common.json`; a third bundle appearing in
 *   the app invalidates all of them, which is why `npm run audit:testids` is the
 *   gate rather than this paragraph. Prefer a structural selector where one
 *   exists — a text match is the last resort, not the first.
 *
 *   Digits and currency literals need none of this: `"7"` and `"$50"` are the
 *   same in both locales, which is why {@link buttonWithText} is used for
 *   keypads and nowhere else.
 * - **Icon names.** `<Icon name="icon-trash" />` (`src/components/icon.tsx`)
 *   inlines the raw SVG into a bare `<span>` and drops `name` entirely — nothing
 *   about the icon survives into the DOM.
 * - **Radix tab values.** `<TabsTrigger value="evenly">` reflects `role="tab"`
 *   and `data-state`, never the value; the generated `id` embeds a per-mount
 *   random `baseId`. Tabs can only be reached positionally.
 *
 * ## Collection locators
 *
 * A locator whose `testId` ends in `-` addresses a *set* of rows, so its first
 * fallback is the `byTestIdPrefix` form. The exact-match candidate that
 * {@link candidates} puts first simply never matches, which costs one failed
 * query and keeps the declared `testId` readable by the audit script.
 */

import {
  buttonContainingAnyText,
  buttonWithAnyText,
  buttonWithText,
  byAriaLabel,
  byRole,
  byTestIdPrefix,
  cardWithTitle,
  inputWithAnyPlaceholder,
  locator,
  rowAmount,
  rowAmountUnder,
  textIsAnyOf,
} from '../helpers/selectors.js';
import type { Locator } from '../helpers/selectors.js';
import { INCOME_LOCATOR_GROUPS } from './testids.incomes.js';
import { ORDER_FLOW_LOCATOR_GROUPS } from './testids.orders.js';
import { PAYROLL_LOCATOR_GROUPS } from './testids.payroll.js';
import { SETTINGS_LOCATOR_GROUPS } from './testids.settings.js';

/* ------------------------------------------------------------------------- *
 * Shared chrome
 * ------------------------------------------------------------------------- */

/**
 * Chrome and cross-screen dialogs.
 *
 * CONFIRMED: `env-badge`, `create-appointment-button`, `income-offline-banner`.
 * PENDING:   `passcode-guard-dialog`.
 * PROPOSED:  `passcode-guard-dialog-skip-30min`, `header-hamburger-menu`,
 *            `header-order-processing` — chrome the suite has to drive that
 *            VP-802 never annotated. All three resolve today through their
 *            fallbacks (a literal DOM id, two hardcoded English aria-labels).
 *
 * The last two CONFIRMED ids belong to screens outside the ten namespaces below
 * (`/appointment`, `/incomes`). They are parked here so the audit script still
 * accounts for every id the app ships rather than under-reporting coverage.
 */
export const CommonIds = {
  /**
   * Guards every permission-gated action (refund, void, cash drawer, complete
   * payment). Rendered by `src/routes/_app/settings/permissions/-components/
   * passcode-guard-dialog.tsx` through the shared `Dialog`, so Radix supplies
   * `role="dialog"` on the same node.
   */
  passcodeGuardDialog: locator('passcode guard dialog', 'passcode-guard-dialog', byRole('dialog')),

  /**
   * "Skip passcode for 30 minutes" checkbox. `CheckboxLabel` forwards its `id`
   * prop straight onto the Radix checkbox, so `#passcode-skip-30min` is a real
   * DOM id rather than a guess.
   */
  passcodeSkip30Min: locator(
    'skip passcode 30 min',
    'passcode-guard-dialog-skip-30min',
    '#passcode-skip-30min',
  ),

  /** Build-environment ribbon. `src/components/env-badge.tsx`. */
  envBadge: locator('environment badge', 'env-badge'),

  /**
   * Hamburger that opens the app sidebar. The aria-label is hardcoded English.
   *
   * The fallback is ambiguous on exactly one screen, and it matters:
   * `header-left.tsx` gives the checkout BACK button the same
   * `aria-label="Open sidebar"` — a copy-paste in the app, not a naming choice —
   * so on `/order/{id}/checkout` this locator resolves to Back and "open the
   * sidebar" quietly leaves the screen instead. Nothing in the DOM tells the two
   * apart: both are `variant="icon"` buttons wrapping an `<Icon>`, and
   * `icon.tsx` drops the icon name.
   *
   * They never render together — `HeaderLeft` returns one branch or the other —
   * so the guard is not a sharper selector but never pressing this off a
   * checkout screen. {@link CheckoutIds.backBtn} is the same element under its
   * real name, and `AppNav.openSidebar()` refuses to run where the two collide.
   */
  sidebarToggle: locator('sidebar toggle', 'header-hamburger-menu', byAriaLabel('Open sidebar')),

  /**
   * The app sidebar itself — the drawer the hamburger opens.
   *
   * PROPOSED. `ui/sidebar.tsx` renders it through a Radix `Sheet` and stamps
   * `data-slot="sidebar"` / `data-sidebar="sidebar"` onto the content node,
   * overriding the sheet's own `data-slot` because the props spread last. Being
   * a Sheet, it is PORTALLED to `document.body` and unmounted while closed, so
   * this locator doubles as the open/closed probe — there is no hidden copy to
   * mistake for an open one.
   */
  appSidebar: locator('app sidebar', 'app-sidebar', '[data-slot="sidebar"]', '[data-sidebar="sidebar"]'),

  /** Header button opening the pending-orders drawer. `src/components/header-order-processing.tsx`. */
  pendingOrders: locator(
    'pending orders button',
    'header-order-processing',
    byAriaLabel('Open pending orders'),
  ),

  /** `/appointment` → new appointment. `create-appointment-button.tsx`. */
  createAppointment: locator('create appointment button', 'create-appointment-button'),

  /** `/incomes` offline banner. `-components/income-offline-banner.tsx`. */
  incomeOfflineBanner: locator('income offline banner', 'income-offline-banner'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Splash
 * ------------------------------------------------------------------------- */

/**
 * `/splashscreen` — migrations, DB open and the sync handshake.
 *
 * PROPOSED: every id here. Neither source names the splash, but `BasePage`
 * requires a `readyAnchor` and the boot flow has to wait on something, so both
 * anchors are named after the elements they wrap and lean on their fallbacks.
 *
 * `bg-slate-950` is the full-bleed backdrop and appears nowhere else in `src/`
 * (`splashscreen/index.tsx` uses it twice — the pending component and the main
 * screen — which is the same screen, so the selector stays unambiguous).
 */
export const SplashIds = {
  screen: locator('splash screen', 'splash-screen', 'div.bg-slate-950'),

  /**
   * The animated progress bar. Its width is an inline style driven by
   * `animatedProgress`; the track is the only `bg-background/20` in `src/`.
   */
  progress: locator('splash progress bar', 'splash-progress', 'div.bg-background\\/20'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Login
 * ------------------------------------------------------------------------- */

/**
 * PENDING: all four ids.
 *
 * WARNING for the page-object author: `/login` on `develop` is a **QR login**
 * (`src/routes/login/index.tsx` renders a `QRCodeSVG` and polls
 * `useQrLogin`) — there is no username/password form on it at all. The
 * credential form VP-802 drove lives on `/login-staff-token`, reached from the
 * secret tap on the version line of `AboutInfo`, and it has a single
 * `staffToken` field rather than username + password.
 *
 * The VP-802 ids are kept verbatim so the audit script tracks the same names the
 * app team will merge, but `usernameInput`/`passwordInput` map onto that one
 * token field. Do not expect both to resolve on the same screen.
 */
export const LoginIds = {
  /** Either login route: both render a single shadcn `Card` as the form shell. */
  page: locator('login page', 'login-page', '[data-slot="card"]'),

  /** `/login-staff-token` → the `staffToken` field. `Input` puts `data-slot="input"` on the real `<input>`. */
  usernameInput: locator(
    'login username input',
    'username-login-input',
    '[data-slot="card"] [data-slot="input"]',
  ),

  /** No second credential field exists today; declared for parity with VP-802. */
  passwordInput: locator('login password input', 'password-login-input'),

  /** The only submit button inside the login card. */
  submitButton: locator(
    'login submit button',
    'login-submit-button',
    '[data-slot="card"] button[type="submit"]',
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Home — staff / customer / service / cart
 * ------------------------------------------------------------------------- */

/**
 * `/home` — the three-panel till: Staff | Order | Service.
 *
 * PENDING:  every VP-802 id in this group.
 * PROPOSED: `home-staff-listing` alone — VP-802 reached that container through
 *           the DOM id below rather than a testid, so the name here mirrors the
 *           id the app already has.
 *
 * The strongest fallback on this screen is `#home-staff-listing`, a literal DOM
 * id on the staff scroll container (`-staff/staff-tabs.tsx`). Staff tiles are
 * `div.cursor-pointer` inside it and service tiles are `li.cursor-pointer`
 * (`-service/service-items.tsx`) — the same two shapes VP-802's helpers fell
 * back to, so they are proven against a running build.
 *
 * The cart totals (`home-cart-subtotal` … `home-cart-total`) resolve through
 * {@link rowAmountUnder}. `-order/order-summary.tsx` renders each row as an
 * unmarked `div.flex.justify-between` holding a translated `<span>` and a
 * `money()` `<span>`, so the translated label is the only handle — an nth-child
 * chain is not an option, because rows render only when their amount is > 0 and
 * the index therefore shifts per order. The bilingual match is what makes the
 * label usable: `en` and `vi` are the only two bundles the app ships, so both
 * strings can be named at the selector.
 */
export const HomeIds = {
  // --- Staff panel ---
  staffSearchInput: locator(
    'staff search input',
    'home-staff-search-input',
    '#home-staff-listing ~ * [data-slot="input-group-control"]',
    '[data-slot="input-group"] [data-slot="input-group-control"]',
  ),
  staffListing: locator('staff listing container', 'home-staff-listing', '#home-staff-listing'),
  staffGroupAllTab: locator(
    'staff group "all" tab',
    'home-staff-group-all',
    `${byRole('tab')}:first-of-type`,
  ),
  staffGroupTabs: locator(
    'staff group tabs',
    'home-staff-group-',
    byTestIdPrefix('home-staff-group-'),
    byRole('tab'),
  ),
  staffItems: locator(
    'staff cards',
    'staff-item-',
    byTestIdPrefix('staff-item-'),
    '#home-staff-listing div.cursor-pointer',
  ),

  // --- Customer panel (phone keypad + suggestions + quick-add form) ---
  customerPhoneInput: locator(
    'customer phone input',
    'home-customer-phone-input',
    '[data-slot="popover-anchor"] [data-slot="input"]',
  ),
  customerKeypadClear: locator('customer keypad C', 'home-customer-keypad-clear', buttonWithText('C')),
  /**
   * The shared `Keypad` labels backspace with an `<Icon>`, so it has no text at
   * all — it is the last button of the last keypad row and nothing else.
   */
  customerKeypadBackspace: locator(
    'customer keypad backspace',
    'home-customer-keypad-backspace',
    // `DEFAULT_LAYOUT` in `components/keypad.tsx` puts the last row at
    // [C, 0, Backspace], so backspace is the one button that follows `0`.
    // Structural and language-proof: `0` is `0` in both locales.
    '//button[normalize-space()="0"]/following-sibling::button[1]',
  ),
  customerDoneBtn: locator(
    'customer done button',
    'home-customer-done-btn',
    buttonWithAnyText('Done', 'Hoàn tất'),
  ),
  customerBackBtn: locator(
    'customer back button',
    'home-customer-back-btn',
    buttonWithAnyText('Back', 'Quay lại'),
  ),
  customerSuggestionList: locator(
    'customer suggestion list',
    'home-customer-suggestion-list',
    '[data-slot="popover-content"]',
  ),
  customerSuggestionItems: locator(
    'customer suggestion rows',
    'home-customer-suggestion-item-',
    byTestIdPrefix('home-customer-suggestion-item-'),
    '[data-slot="popover-content"] div.active\\:bg-accent',
  ),
  createCustomerNameInput: locator(
    'create customer name input',
    'home-create-customer-name-input',
    // `customer-quick-add-form.tsx`: the only placeholdered Input in the dialog.
    inputWithAnyPlaceholder('Enter customer name', 'Nhập tên khách hàng'),
  ),
  createCustomerViewMoreBtn: locator(
    'create customer view-more button',
    'home-create-customer-view-more-btn',
    buttonWithAnyText('View More', 'Xem thêm'),
  ),
  createCustomerSaveBtn: locator(
    'create customer save button',
    'home-create-customer-save-btn',
    buttonWithAnyText('Save', 'Lưu'),
  ),
  createCustomerNewGroupBtn: locator(
    'create customer new-group button',
    'home-create-customer-new-group-btn',
    // `-customer/-group/customer-add-group-dialog.tsx` — the trigger inside the
    // group popover, an `icon-plus` beside `t("global.newGroup")`.
    buttonContainingAnyText('New Group', 'Nhóm mới'),
  ),

  // --- Service panel ---
  serviceSearchInput: locator(
    'service search input',
    'home-service-search-input',
    'section.is-changing-staff [data-slot="input-group-control"]',
  ),
  /**
   * Quick Pay is a pinned category tile, not a real category — `PINNED_CATEGORY_IDS`
   * in `@/shared/constants/service` decides which tiles render title-only and
   * centered, which is the one shape a selector can distinguish.
   */
  serviceCategoryQuickPay: locator(
    'quick pay category tile',
    'home-service-category-quick-pay',
    'div.cursor-pointer.items-center.justify-center',
  ),
  serviceCategories: locator(
    'service category tiles',
    'home-service-category-',
    byTestIdPrefix('home-service-category-'),
    'div.grid-cols-4 > div.cursor-pointer',
  ),
  serviceItems: locator(
    'service cards',
    'service-item-',
    byTestIdPrefix('service-item-'),
    'li.cursor-pointer',
  ),

  // --- Quick Pay dialog ---
  quickPayAmountInput: locator(
    'quick pay amount input',
    'home-quickpay-amount-input',
    '[data-slot="dialog-content"] [data-slot="input"]:nth-of-type(1)',
  ),
  quickPayNameInput: locator(
    'quick pay name input',
    'home-quickpay-name-input',
    // `quick-pay-dialog.tsx` names this field `serviceName`; the locator keeps
    // VP-802's `-name-` spelling, so the placeholder is what ties the two.
    inputWithAnyPlaceholder('Service Name', 'Tên dịch vụ'),
  ),
  quickPayNoteInput: locator('quick pay note input', 'home-quickpay-note-input', '[data-slot="textarea"]'),
  quickPayAddBtn: locator(
    'quick pay add button',
    'home-quickpay-add-btn',
    '[data-slot="dialog-footer"] button[type="submit"]',
  ),

  // --- Order panel actions ---
  orderDeleteBtn: locator(
    'delete order button',
    'home-order-delete-btn',
    // `-order/order-info.tsx` — the destructive-styled trigger in the order
    // header, labelled `t("global.remove")`. The class is what separates it from
    // the icon-only remove buttons on the service and staff rows, which carry no
    // text at all.
    '//button[contains(@class,"text-destructive")][normalize-space()="Remove" or normalize-space()="Xoá"]',
  ),
  /* Both customer buttons are icon-only `button.size-13.rounded-full`, side by
   * side in the order header's `min-w-[120px]` box, in the order [edit, remove]
   * (`-order/order-info.tsx`). Indexed with XPath rather than `nth-of-type`
   * because each one is wrapped in its own dialog trigger, so they are not
   * siblings in the DOM even though they look like a pair. */
  orderEditCustomerBtn: locator(
    'edit customer button',
    'home-order-edit-customer-btn',
    '(//div[contains(@class,"min-w-[120px]")]//button[contains(@class,"size-13")])[1]',
  ),
  orderRemoveCustomerBtn: locator(
    'remove customer button',
    'home-order-remove-customer-btn',
    '(//div[contains(@class,"min-w-[120px]")]//button[contains(@class,"size-13")])[2]',
  ),
  orderChangeStaffBtn: locator(
    'change staff button',
    'home-order-change-staff-btn',
    // `-order-item/index.tsx` — the inline link on a staff column header. Only
    // rendered while `canChangeStaff`.
    buttonWithAnyText('Change Staff', 'Đổi nhân viên'),
  ),
  orderChangeStaffCancelBtn: locator(
    'cancel change staff button',
    'home-order-change-staff-cancel-btn',
    // Its label is the bare `t("actions.cancel")`, which every dialog in the app
    // also uses — so this matches on POSITION instead: it is the one button
    // pinned `right-8` and styled destructive, and it only unhides
    // (`{ flex: isChanging }`) while a staff change is in progress. Structural,
    // hence no i18n exposure at all.
    '//button[contains(@class,"right-8")][contains(@class,"text-destructive")]',
  ),
  orderRemoveStaffBtn: locator(
    'remove staff button',
    'home-order-remove-staff-btn',
    // The one semantic class on this screen. `-order-item/index.tsx` puts
    // `remove-order-item-button` on the staff column's remove button — not a
    // Tailwind utility, so restyling does not move it.
    'button.remove-order-item-button',
    // Second candidate: the same button carries an `sr-only` label, which is the
    // only text an icon-only control can offer.
    buttonContainingAnyText('Delete Staff Order Item', 'Xoá mục đơn của nhân viên'),
  ),
  orderRemoveServiceBtns: locator(
    'remove service buttons',
    'home-order-remove-service-btn-',
    byTestIdPrefix('home-order-remove-service-btn-'),
  ),
  updateServiceDialog: locator('update service dialog', 'home-update-service-dialog', byRole('dialog')),
  updateServiceSaveBtn: locator(
    'update service save button',
    'home-update-service-save-btn',
    // `-order-item/order-item-dialog.tsx` — the footer submit. The label is
    // carried in the selector to separate it from the Quick Pay dialog's own
    // submit, which says `Add` / `Update` instead.
    '//*[@data-slot="dialog-content"]//button[@type="submit"][normalize-space()="Save" or normalize-space()="Lưu"]',
  ),

  // --- Cart footer ---
  cartPromoBtn: locator(
    'promo & rewards button',
    'home-cart-promo-btn',
    buttonContainingAnyText('Promo & Rewards', 'Khuyến mãi & Phần thưởng'),
  ),
  cartPromoDialog: locator('promo & rewards dialog', 'home-cart-promo-dialog', byRole('dialog')),
  cartPromoConfirmBtn: locator(
    'promo confirm button',
    'home-cart-promo-confirm-btn',
    buttonWithAnyText('Confirm', 'Xác nhận'),
  ),
  cartNoteBtn: locator(
    'order note button',
    'home-cart-note-btn',
    // CONTAINING, not exact: `order-note-dialog.tsx` builds the trigger as an
    // `<Icon>` plus the label, and an icon's inlined SVG is not guaranteed to be
    // text-free.
    buttonContainingAnyText('Note', 'Lưu ý'),
  ),
  cartNoteDialog: locator('order note dialog', 'home-cart-note-dialog', byRole('dialog')),
  cartNoteSaveBtn: locator(
    'order note save button',
    'home-cart-note-save-btn',
    buttonWithAnyText('Save', 'Lưu'),
  ),
  /**
   * The Merge Order action in the cart footer.
   *
   * Icon-plus-label, so matched by containment like {@link cartNoteBtn}. The app
   * renders it only once the order carries at least one line
   * (`-order/order-info.tsx`), which is exactly the state
   * TC-ORDERFLOW-20 asserts against.
   */
  cartMergeBtn: locator(
    'merge order button',
    'home-cart-merge-btn',
    buttonContainingAnyText('Merge Order', 'Gộp đơn'),
  ),
  cartPrintBtn: locator(
    'cart print button',
    'home-cart-print-btn',
    // Icon-only, so there is no text to match. `order-summary.tsx` renders the
    // footer's action row as [Print, Split?, Pay] and Pay is the only member
    // carrying `bg-green`, which pins the row without depending on whether Split
    // is present (it is hidden while re-opening an order).
    '//div[./button[contains(@class,"bg-green")]]/button[1]',
  ),
  /**
   * The cart's Split-Order icon — the middle member of the [Print, Split, Pay]
   * action row (`order-summary.tsx`). Icon-only, so matched positionally like
   * {@link cartPrintBtn}: the second button in the row whose last button is the
   * green Pay. Present only once the order has items (hidden while re-opening),
   * which is exactly when a spec would press it.
   */
  cartSplitBtn: locator(
    'cart split-order button',
    'home-cart-split-btn',
    '//div[./button[contains(@class,"bg-green")]]/button[2]',
  ),
  cartPayBtn: locator('cart pay button', 'home-cart-pay-btn', 'button.bg-green'),

  /* --- Cart footer totals ---------------------------------------------- *
   *
   * Each row is an unmarked `div.flex.justify-between` holding a translated
   * label span and a `money()` span (`-order/order-summary.tsx`), so the label
   * is the only thing identifying it — hence the bilingual match.
   *
   * `rowAmountUnder`, not `rowAmount`: the scope is the footer's own root,
   * `div.is-changing-staff`. `Total` is also a column header in the
   * customer-information dialog's order table, and unscoped, whichever came
   * first in document order would win.
   *
   * The selector returns the AMOUNT span rather than the row, which is what
   * keeps `parseMoney()` right on the deduction rows: read off the row their
   * text is `Item Discount -$5.00`, where the sign is no longer leading. */
  cartSubtotal: locator(
    'cart subtotal',
    'home-cart-subtotal',
    rowAmountUnder('is-changing-staff', 'Subtotal', 'Tạm tính'),
  ),
  cartItemDiscount: locator(
    'cart item discount',
    'home-cart-item-discount',
    rowAmountUnder('is-changing-staff', 'Item Discount', 'Giảm giá sản phẩm'),
  ),
  cartPromotion: locator(
    'cart promotion',
    'home-cart-promotion',
    rowAmountUnder('is-changing-staff', 'Promotion', 'Khuyến mãi'),
  ),
  cartReward: locator(
    'cart reward redemption',
    'home-cart-reward',
    rowAmountUnder('is-changing-staff', 'Reward Redemption', 'Đổi điểm thưởng'),
  ),
  cartTax: locator('cart tax', 'home-cart-tax', rowAmountUnder('is-changing-staff', 'Tax', 'Thuế')),
  cartTotal: locator(
    'cart total',
    'home-cart-total',
    rowAmountUnder('is-changing-staff', 'Total', 'Tổng cộng'),
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Checkout
 * ------------------------------------------------------------------------- */

/**
 * `/order/{id}/checkout` and its split-order sibling.
 *
 * CONFIRMED: `split-void-reason-other-input`.
 * PENDING:   everything else.
 *
 * Two corrections to VP-802's model of this screen, both read off
 * `-components/checkout-keypad.tsx` on `develop`:
 *
 * 1. The cash quick-select presets are **$5 / $10 / $50 / $100**
 *    (`["10000","5000","1000","500"]`), not the $20/$50/$100/$200 that
 *    `CheckoutPage.quickBtn()` assumed. `checkout-keypad-2000` matches nothing.
 * 2. The clear and backspace keys carry the values `C` and `back`, so the ids
 *    the app will most likely ship are `checkout-keypad-C` / `checkout-keypad-back`.
 *    VP-802's `checkout-keypad-clear` / `-backspace` are kept as the declared
 *    names because that is what its page object queried; flag the mismatch when
 *    the annotations are merged.
 *
 * The four payment tabs are `PAYMENT_METHODS` (card, cash, gift_card, other) in
 * that fixed order inside the `max-w-[600px]` sidebar, which is what makes the
 * positional fallbacks safe — the array is a module constant, not data.
 */
export const CheckoutIds = {
  // --- Payment method sidebar ---
  tabCard: locator('card tab', 'checkout-tab-card', 'div[class*="max-w-[600px]"] > button:nth-of-type(1)'),
  tabCash: locator('cash tab', 'checkout-tab-cash', 'div[class*="max-w-[600px]"] > button:nth-of-type(2)'),
  tabGiftCard: locator(
    'gift card tab',
    'checkout-tab-gift-card',
    'div[class*="max-w-[600px]"] > button:nth-of-type(3)',
  ),
  tabOther: locator('other tab', 'checkout-tab-other', 'div[class*="max-w-[600px]"] > button:nth-of-type(4)'),

  /**
   * The label an "Other" tender is recorded under.
   *
   * Renders ONLY while `paymentMethod === "other"`
   * (`checkout-payment.tsx:139`), which is what makes its presence the proof
   * that the Other tab is genuinely selected — the tab's own selected state is
   * a Tailwind class and reads the same a frame before the panel swaps.
   *
   * The value is echoed on the payment-success screen as `Other (<name>)`, so a
   * spec that writes it here can assert it downstream. `maxLength={255}`.
   */
  otherMethodName: locator(
    'other payment method name input',
    'checkout-other-method-name',
    inputWithAnyPlaceholder('Input payment method name', 'Nhập tên phương thức thanh toán'),
  ),

  // --- Amount entry ---
  enterAmountInput: locator('enter amount display', 'checkout-enter-amount-input', 'div.text-8xl'),
  keypadClear: locator(
    'checkout keypad C',
    'checkout-keypad-clear',
    '[data-testid="checkout-keypad-C"]',
    buttonWithText('C'),
  ),
  keypadBackspace: locator(
    'checkout keypad backspace',
    'checkout-keypad-backspace',
    '[data-testid="checkout-keypad-back"]',
  ),

  /* --- Order detail column (`-order-checkout-detail/`) ------------------ */
  orderId: locator(
    'checkout order number',
    'checkout-order-id',
    // `header-checkout-detail.tsx` renders `t("global.orderNumber", { code })`,
    // i.e. `Order #{{code}}` / `Đơn hàng #{{code}}`. Matched by PREFIX because
    // the code itself is order data, not part of the label.
    '//span[starts-with(normalize-space(),"Order #") or starts-with(normalize-space(),"Đơn hàng #")]',
  ),
  customerName: locator(
    'checkout customer name',
    'checkout-customer-name',
    // Same file: the customer block is the one `border-y border-dashed` box, and
    // holds exactly one `span.text-lg.font-semibold` (the name) beside one
    // `div.text-right...` (the phone). Structural, so no i18n exposure — the
    // value is customer data and is never translated.
    'div[class*="border-dashed"] span.text-lg.font-semibold',
  ),
  customerPhone: locator(
    'checkout customer phone',
    'checkout-customer-phone',
    'div[class*="border-dashed"] div.text-right.text-lg.font-semibold',
  ),
  staffs: locator(
    'checkout staff list',
    'checkout-staffs',
    // `content-checkout-detail.tsx` wraps `StaffItemsDetail` in the column's
    // only scroll container.
    'div[class*="overflow-y-scroll"][class*="space-y-4"]',
  ),
  services: locator(
    'checkout service list',
    'checkout-services',
    // `staff-items-detail.tsx` renders one `<ul>` of service `<li>`s per staff
    // block; this addresses the first, which is what a single-staff order has.
    'div[class*="overflow-y-scroll"] ul',
  ),
  notes: locator(
    'checkout order note',
    'checkout-notes',
    // `t("global.orderNoteValue", { note })` — `Order Note: {{note}}` /
    // `Ghi chú đơn: {{note}}`. Prefix again: the note is order data.
    '//div[starts-with(normalize-space(),"Order Note:") or starts-with(normalize-space(),"Ghi chú đơn:")]',
  ),

  /* --- Summary ---------------------------------------------------------- *
   *
   * `order-summary-detail.tsx` uses the same label-span / amount-span row as the
   * home cart footer, so {@link rowAmount} applies unchanged. No scope is needed
   * here: the labels are exact matches, and `Subtotal` / `Tip` / `Total` each
   * appear once on this screen — `Total Discount` and `Total Paid` are distinct
   * strings and do not collide with `Total` under `normalize-space()=`. */
  subtotal: locator('checkout subtotal', 'checkout-subtotal', rowAmount('Subtotal', 'Tạm tính')),
  discount: locator(
    'checkout discount',
    'checkout-discount',
    // The roll-up row, not the indented `Item Discount` / `Promotion` /
    // `Reward Redemption` breakdown beneath it.
    rowAmount('Total Discount', 'Tổng giảm giá'),
  ),
  tipAmount: locator('checkout tip amount', 'checkout-tip-amount', rowAmount('Tip', 'Tiền boa')),
  total: locator(
    'checkout total',
    'checkout-total',
    // `content-checkout-detail.tsx` renders the grand total OUTSIDE
    // `OrderSummaryDetail`, in the column's only `text-2xl font-bold` row. The
    // class is carried in the selector because this is the number every money
    // assertion in the suite reads — worth pinning to the exact row rather than
    // to the first `Total` label in the document.
    '//div[contains(@class,"text-2xl")][./span[normalize-space()="Total" or normalize-space()="Tổng cộng"]]/span[last()]',
  ),
  totalPaid: locator(
    'checkout total paid',
    'checkout-total-paid',
    // `-components/checkout-payment.tsx` — the tendered-so-far header above the
    // transaction list. Only rendered once a tender exists.
    rowAmount('Total Paid', 'Tổng đã trả'),
  ),
  /**
   * The "Remaining" row. It keeps its shape but SWAPS its background between
   * states: `bg-sherwood-green-20` (green) once the tender covers the balance, a
   * different colour while money is still owed (owed-state class dumped live:
   * `flex items-center justify-between rounded-lg px-6 py-4 text-lg font-semibold
   * bg-…`). The old green-only fallback missed every under-tender. Match on the
   * shared row shape plus the "Remaining" label so both states resolve;
   * `centsOf()` reads the amount out of the row text.
   */
  remaining: locator(
    'checkout remaining',
    'checkout-remaining',
    '//div[contains(@class,"rounded-lg") and contains(@class,"py-4")][contains(normalize-space(),"Remaining") or contains(normalize-space(),"Còn lại")]',
    'div.bg-sherwood-green-20',
  ),
  /** Cash-only row; its `#FFF4DD` background is unique to it. */
  change: locator('checkout change', 'checkout-change', 'div[class*="bg-[#FFF4DD]"]'),

  // --- Action buttons (`-order-checkout-detail/list-action-detail.tsx`) ---
  /**
   * `bg-green` is shared with the re-open "Done" and "Complete Done" variants,
   * which render in place of this button rather than beside it — one at a time,
   * so the selector stays unique on any given render.
   */
  completePaymentBtn: locator('complete payment button', 'checkout-complete-payment-btn', 'button.bg-green'),
  tipBtn: locator('checkout tip button', 'checkout-tip-btn', 'button[class*="bg-[#2ED5FF]"]'),
  printBtn: locator('checkout print button', 'checkout-print-btn', 'button.bg-primary'),
  cashDrawerBtn: locator('cash drawer button', 'checkout-cash-drawer-btn', 'button[class*="bg-[#DB4B91]"]'),

  /**
   * The header's back arrow — the only way off checkout that is not a payment.
   *
   * PROPOSED. `header-left.tsx` replaces the ENTIRE left nav (hamburger, logo,
   * order-history link) with this one button while the router is on a checkout
   * path, which is why a spec cannot leave via the logo here the way it does
   * from every other screen. It calls `router.history.back()`.
   *
   * Two caveats no selector can fix. It inherits the hamburger's hardcoded
   * `aria-label="Open sidebar"` (see {@link CommonIds.sidebarToggle}), hence the
   * `header` scope. And it is CONDITIONAL: `HeaderLeft` returns `null` once
   * `canCompleteSale()` reports the order fully tendered, so a checkout that is
   * ready to close has no back button at all — finish the payment instead of
   * trying to walk out of it.
   */
  backBtn: locator('checkout back button', 'checkout-back-btn', `header ${byAriaLabel('Open sidebar')}`),

  // --- Gift card tender ---
  gcScanDialog: locator('gift card scan dialog', 'checkout-gc-scan-dialog', byRole('dialog')),
  gcInputCodeBtn: locator(
    'gift card input-code button',
    'checkout-gc-input-code-btn',
    // The manual path out of the QR-scan dialog, which is the only path a test
    // rig without a scanner can take.
    buttonWithAnyText('Input Gift Card Code', 'Nhập mã thẻ quà tặng'),
  ),
  gcCodeInput: locator(
    'gift card code input',
    'checkout-gc-code-input',
    // `InputCode` renders its REAL <input> as `absolute inset-0 opacity-0` with
    // NEITHER a testid NOR `data-slot="input"` — verified live on the dev build
    // (the whole gift-card dialog carries no testids at all). So match the
    // dialog's single <input> by tag; the earlier `[data-slot="input"]` matched
    // nothing and stalled the whole redemption 15s in.
    '[data-slot="dialog-content"] input',
  ),
  gcInvalidMsg: locator(
    'gift card invalid message',
    'checkout-gc-invalid-msg',
    // `-gift-card-payment/content-gift-card-dialog.tsx`, `giftCardNotValid`.
    textIsAnyOf('Gift card is not valid', 'Thẻ quà tặng không hợp lệ'),
  ),
  gcBalanceInfo: locator(
    'gift card balance info',
    'checkout-gc-balance-info',
    // Same dialog, but NOT a `rowAmount` shape: this table's rows are
    // `div > div > p` (label) beside `div.text-right` (value), not span/span.
    '//div[./div/p[normalize-space()="Current Balance" or normalize-space()="Số dư hiện tại"]]/div[last()]',
  ),
  gcInsufficientMsg: locator(
    'gift card insufficient message',
    'checkout-gc-insufficient-msg',
    textIsAnyOf('Gift Card not Enough Balance', 'Thẻ quà tặng không đủ số dư'),
  ),
  /**
   * The **Confirm** button on the code-entry screen — verified label, so the
   * fallback is safe.
   *
   * The manual redemption flow is `Input Gift Card Code` → type → **Confirm** →
   * balance check → **Pay**. The original caution here — no fallback, lest an id
   * guess press the wrong of two buttons and take a payment — assumed Confirm and
   * Pay might be indistinguishable. Live DOM shows otherwise: they are DIFFERENT
   * screens of the same dialog (code entry vs balance confirmed) and never coexist,
   * and their labels differ outright ("Confirm" vs "Pay"). This build exposes NO
   * testids on the dialog, so the label, scoped to the dialog, is the only handle —
   * and it cannot collide with Pay.
   */
  gcRedeemBtn: locator(
    'gift card redeem button',
    'checkout-gc-redeem-btn',
    '//*[@data-slot="dialog-content"]//button[normalize-space()="Confirm" or normalize-space()="Xác nhận"]',
  ),
  gcAcceptedMsg: locator(
    'gift card accepted message',
    'checkout-gc-accepted-msg',
    textIsAnyOf('Gift Card Accepted', 'Thẻ quà tặng hợp lệ'),
  ),
  gcPayBtn: locator(
    'gift card pay button',
    'checkout-gc-pay-btn',
    // Scoped to the dialog: `Pay` is also the home cart's footer button, and the
    // gift-card dialog is portalled to `document.body`, so both can be in the
    // DOM at once.
    '//*[@data-slot="dialog-content"]//button[normalize-space()="Pay" or normalize-space()="Thanh toán"]',
  ),
  /**
   * The **Cancel** button that abandons the gift-card dialog WITHOUT redeeming.
   *
   * The accepted-balance screen renders `[Cancel, Pay]` (verified live on the dev
   * build) and — unlike most Radix dialogs — swallows the Escape key, so a spec
   * that wants to walk away without spending the card has to press Cancel. Scoped
   * to the dialog and matched on the exact label so it cannot collide with Pay.
   */
  gcCancelBtn: locator(
    'gift card cancel button',
    'checkout-gc-cancel-btn',
    '//*[@data-slot="dialog-content"]//button[normalize-space()="Cancel" or normalize-space()="Huỷ" or normalize-space()="Hủy"]',
  ),
  /**
   * The **Close** button on the gift-card SCAN screen (`[Close, Input Gift Card
   * Code]`). Reaching a full dismissal from the accepted-balance screen is a
   * two-hop path — Cancel returns to this scan screen, Close then unmounts the
   * dialog (verified live). Scoped to the dialog, matched on the exact label.
   */
  gcCloseBtn: locator(
    'gift card close button',
    'checkout-gc-close-btn',
    '//*[@data-slot="dialog-content"]//button[normalize-space()="Close" or normalize-space()="Đóng"]',
  ),

  /* --- Card tender ------------------------------------------------------ *
   *
   * The four status MESSAGES carry no fallback, and no honest one exists.
   * `-card-payment/content-progress-dialog.tsx` switches on
   * `PAYMENT_MESSAGE_STATUS` and renders every outcome — SUCCESSFUL, FAILED,
   * PROCESSING, TRANSACTION_TIMEOUT — into the SAME element:
   *
   * ```html
   * <p class="text-3xl font-semibold text-center mt-8">{cardMessage}</p>
   * ```
   *
   * `cardMessage` is text the payment terminal sent, not an i18n key, so it
   * cannot be enumerated the way a translated label can. The only thing that
   * differs between outcomes is the sibling `<Icon>` — and `Icon` inlines the
   * SVG into a bare `<span>`, dropping `name` (see the group note at the top of
   * this file). A selector here would resolve on EVERY outcome and report a
   * declined card as a successful charge, so these wait for the annotation.
   *
   * `cardCountdown` is unannotated for a different reason: it lives inside
   * `AnimatedLoadingCircleTimer`, which paints its seconds into an SVG rather
   * than into a readable text node.
   *
   * `cardChargeAmount` DOES have a fallback — see its own note. */
  cardChargingDialog: locator('card charging dialog', 'checkout-card-charging-dialog', byRole('dialog')),
  cardCountdown: locator('card countdown', 'checkout-card-countdown'),

  /**
   * The amount being charged.
   *
   * Unlike the outcome messages above, this one is safe to fall back on: it
   * reads a VALUE and does not claim to distinguish a state, so a selector that
   * resolves on every screen of the dialog cannot report a declined card as
   * approved.
   *
   * `content-progress-dialog.tsx:179` renders it as a leaf paragraph holding
   * `money(totalOrder)`, a sibling of the timer rather than a child of it — the
   * previous note in this group had that wrong. Matched on the money SHAPE (a
   * leaf `<p>` whose text starts with the currency symbol) because the figure is
   * data and carries no label. `[not(.//*)]` keeps it to the leaf; without it
   * the match walks up to the wrapper, whose text also contains the tip line. */
  cardChargeAmount: locator(
    'card charge amount',
    'checkout-card-charge-amount',
    `//*[@role="dialog"]//p[not(.//*)][starts-with(normalize-space(),"$")]`,
  ),
  cardTimeoutMsg: locator('card timeout message', 'checkout-card-timeout-msg'),
  cardFailedMsg: locator('card failed message', 'checkout-card-failed-msg'),
  cardSuccessMsg: locator('card success message', 'checkout-card-success-msg'),
  cardTryAgainBtn: locator(
    'card try again button',
    'checkout-card-try-again-btn',
    // CONTAINING: the label alternates between `t("actions.tryAgain")` and
    // `t("global.tryAgainCountdown")` — `Try Again` vs `Try Again (12s)` — while
    // the retry cooldown runs, and both must match the same locator.
    buttonContainingAnyText('Try Again', 'Thử lại'),
  ),

  // --- Waiting-on-customer dialogs (main window, while the customer display drives) ---
  waitingCustomerTipDialog: locator(
    'waiting for customer tip dialog',
    'waiting-customer-tip-dialog',
    byRole('dialog'),
  ),
  waitingCustomerSignatureDialog: locator(
    'waiting for customer signature dialog',
    'waiting-customer-signature-dialog',
    byRole('dialog'),
  ),

  // --- Split order ---
  /** CONFIRMED. `split-order/-void/void-confirm-dialog.tsx`. */
  splitVoidReasonOtherInput: locator('split void other-reason input', 'split-void-reason-other-input'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Payment success
 * ------------------------------------------------------------------------- */

/**
 * `/order/{id}/payment-success`.
 *
 * PENDING: `payment-success-action-button-no_receipt`.
 * DERIVED: the other three. VP-802 only ever clicked "No Receipt", but the
 *          `{value}` half of that id is `actionButtons[].value`, so `print`,
 *          `sms` and `email` are read straight off the app's own constant
 *          rather than guessed.
 *
 * The four receipt-delivery buttons come from `actionButtons` in
 * `-shared/payment-success.constants.ts` — a frozen `as const` array in the
 * order no_receipt, print, sms, email — rendered into a `grid-cols-2`. That
 * fixed order is what licenses the positional fallbacks; they are the only
 * non-text handle, since each button's own content is an `<Icon>` plus a
 * translated label.
 */
export const PaymentSuccessIds = {
  noReceiptBtn: locator(
    'no receipt button',
    'payment-success-action-button-no_receipt',
    'div.grid-cols-2 > button:nth-of-type(1)',
  ),
  printReceiptBtn: locator(
    'print receipt button',
    'payment-success-action-button-print',
    'div.grid-cols-2 > button:nth-of-type(2)',
  ),
  smsReceiptBtn: locator(
    'text message receipt button',
    'payment-success-action-button-sms',
    'div.grid-cols-2 > button:nth-of-type(3)',
  ),
  emailReceiptBtn: locator(
    'email receipt button',
    'payment-success-action-button-email',
    'div.grid-cols-2 > button:nth-of-type(4)',
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Order history — list
 * ------------------------------------------------------------------------- */

/**
 * `/order-history` — the searchable/filterable order list.
 *
 * PENDING:  all VP-802 ids.
 * PROPOSED: `oh-search-input` and `oh-filter-date-trigger`. VP-802 drove both by
 *           other means — `input[placeholder="Search order ID"]` for the search
 *           box (a translated placeholder, so it breaks the moment the merchant
 *           switches language) and `#selected-date-range` for the date trigger.
 *           The DOM id is a fine fallback; the placeholder is not, which is why
 *           the search box gets a name of its own here.
 * DERIVED:  `oh-filter-payment-{id}`. VP-802 annotated `oh-filter-status-{id}`
 *           for the status checkboxes; the payment column is the same widget in
 *           the same dialog, so it takes the matching name.
 *
 * Two solid fallbacks here. Every row is a TanStack `<Link to="/order-history/$orderId">`,
 * which renders a plain `<a href="/order-history/{uuid}">` — immune to both
 * restyling and translation. And the filter checkboxes get real DOM ids:
 * `CheckboxLabel` forwards `id` onto the Radix checkbox, and the option tables in
 * `-shared/order-history.constants.ts` hardcode them (`status-successful`,
 * `status-canceled`, … and `card`, `cash`, `gift-card`, `other`).
 *
 * `#selected-date-range` is likewise a literal id on the date-range trigger
 * (`src/components/date-range-picker.tsx`), which is what VP-802 already used.
 */
export const OrderHistoryIds = {
  searchInput: locator(
    'order search input',
    'oh-search-input',
    '[data-slot="input-group"] [data-slot="input-group-control"]',
  ),
  dateRangeTrigger: locator('date range trigger', 'oh-filter-date-trigger', '#selected-date-range'),
  filterBtn: locator('filter button', 'oh-filter-btn', '[data-slot="dialog-trigger"]'),
  filterDialog: locator('filter dialog', 'oh-filter-dialog', byRole('dialog')),
  filterClearBtn: locator('filter clear button', 'oh-filter-clear-btn', 'button.bg-cherry-red-20'),
  filterConfirmBtn: locator(
    'filter confirm button',
    'oh-filter-confirm-btn',
    '[data-slot="dialog-footer"] button:last-of-type',
  ),
  filterSortTrigger: locator('sort-by trigger', 'oh-filter-sort-trigger', '[data-slot="select-trigger"]'),
  filterStaffTrigger: locator(
    'staff filter trigger',
    'oh-filter-staff-trigger',
    '[data-slot="popover-trigger"]:nth-of-type(1)',
  ),
  filterPaymentTrigger: locator(
    'payment filter trigger',
    'oh-filter-payment-trigger',
    '[data-slot="popover-trigger"]:nth-of-type(2)',
  ),
  filterStatusTrigger: locator(
    'status filter trigger',
    'oh-filter-status-trigger',
    '[data-slot="popover-trigger"]:nth-of-type(3)',
  ),
  filterStatusOptions: locator(
    'status filter checkboxes',
    'oh-filter-status-',
    byTestIdPrefix('oh-filter-status-'),
    '[data-slot="popover-content"] [data-slot="checkbox"]',
  ),
  orderItems: locator(
    'order rows',
    'order-history-item-',
    byTestIdPrefix('order-history-item-'),
    'a[href^="/order-history/"]',
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Order history — detail pane and its dialogs
 * ------------------------------------------------------------------------- */

/**
 * `/order-history/{orderId}` — the detail pane plus receipt / cancel / refund /
 * re-open / split-tip / adjust-tip dialogs.
 *
 * CONFIRMED (9): `oh-cancel-reason-other-input`, `oh-refund-method-select`,
 * `oh-refund-reason-select`, `oh-refund-reason-other-input`,
 * `oh-refund-service-select`, `oh-refund-service-all`, `order-action-refund`,
 * `order-refund-dialog`, `order-refund-amount`, `order-refund-confirm-btn`
 * (plus the `oh-refund-service-item-{orderItemId}` factory below).
 * PENDING:  everything else.
 * PROPOSED: `oh-split-tip-close-btn`. VP-802 closed that dialog with
 *           `[data-testid="oh-split-tip-dialog"] button[data-slot="dialog-close"]`,
 *           which still works and is kept as the fallback.
 *
 * NAMING SPLIT — worth raising before VP-802 merges. The refund dialog that
 * shipped uses an `order-*` prefix (`order-action-refund`, `order-refund-dialog`,
 * `order-refund-confirm-btn`) while VP-802's page object queries the `oh-*`
 * prefix (`oh-action-refund`, `oh-refund-dialog`, `oh-refund-confirm-btn`) for
 * the same three elements. Both names are declared here, the shipped one as the
 * primary and the VP-802 one as a fallback candidate, so the suite works either
 * way and the audit report shows exactly which spelling is live.
 *
 * ADJUST-TIP KEYPAD — `src/components/tip/custom-tip-keypad.tsx` has no `C` key
 * and no minus key. Its layout is a preset row ($20/$50/$100/$200) then digits,
 * then `00`, `0`, `back`. VP-802's `adjust-tip-keypad-C` and `adjust-tip-keypad--`
 * describe a keypad that does not exist on `develop`; they are declared for
 * traceability and will fail until the layout changes or the ids are dropped.
 *
 * SECTION TITLES — `order-history-detail-section-Order Summary` embeds an
 * English title in the id. `OrderHistoryDetailSection` receives `title` already
 * run through `t()`, so an id built that way changes with the merchant language.
 * The factory below takes the title verbatim, but prefer the `data-slot="card"`
 * position over calling it.
 */
export const OrderHistoryDetailIds = {
  /* Both blocks are an `OrderHistoryDetailSection`, i.e. a shadcn `Card` whose
   * `CardTitle` holds the translated heading — so `data-slot="card"` scopes it
   * and the title identifies it. Note the app calls the second one "Payment
   * Details", not the "payment information" this locator's name suggests. */
  detailInformation: locator(
    'order information block',
    'order-history-detail-information',
    cardWithTitle('Order Information', 'Thông tin đơn hàng'),
  ),
  detailPayment: locator(
    'order payment block',
    'order-history-detail-payment',
    cardWithTitle('Payment Details', 'Chi tiết thanh toán'),
  ),

  // --- Action bar ---
  actionAdjustTip: locator(
    'adjust tip button',
    'oh-action-adjust-tip',
    // `order-history-detail-actions.tsx` — icon plus `t("global.adjustTip")`.
    buttonContainingAnyText('Adjust Tip', 'Chỉnh tiền boa'),
  ),
  /**
   * `.w-40` disambiguates the action-bar button from the per-check receipt badge
   * in the payment section, which reuses `bg-dark-sky-blue-100`.
   */
  actionReceipt: locator('receipt button', 'oh-action-receipt', 'button.w-40.bg-dark-sky-blue-100'),
  /** CONFIRMED under the shipped `order-*` spelling. */
  actionRefund: locator('refund button', 'order-action-refund', '[data-testid="oh-action-refund"]'),
  actionReopen: locator('re-open order button', 'oh-action-reopen', 'button.bg-persian-indigo-100'),
  actionCancel: locator(
    'cancel order button',
    'oh-action-cancel',
    'button[data-slot="button"].bg-destructive',
  ),

  // --- Cancel dialog ---
  cancelDialog: locator('cancel order dialog', 'oh-cancel-dialog', byRole('alertdialog')),
  cancelReasonSelect: locator(
    'cancel reason select',
    'oh-cancel-reason-select',
    '[data-slot="select-trigger"]',
  ),
  /** CONFIRMED. Only rendered once "Other" is picked. */
  cancelReasonOtherInput: locator('cancel other-reason input', 'oh-cancel-reason-other-input'),
  cancelConfirmBtn: locator(
    'cancel confirm button',
    'oh-cancel-confirm-btn',
    '[data-slot="alert-dialog-footer"] button:last-of-type',
  ),

  // --- Refund dialog ---
  /** CONFIRMED under the shipped `order-*` spelling. */
  refundDialog: locator(
    'refund dialog',
    'order-refund-dialog',
    '[data-testid="oh-refund-dialog"]',
    byRole('alertdialog'),
  ),
  /** CONFIRMED. */
  refundAmount: locator('refund amount input', 'order-refund-amount'),
  refundTabFully: locator('full refund tab', 'oh-refund-tab-fully', `${byRole('tab')}:nth-of-type(1)`),
  refundTabPartial: locator('partial refund tab', 'oh-refund-tab-partial', `${byRole('tab')}:nth-of-type(2)`),
  /** CONFIRMED. */
  refundReasonSelect: locator('refund reason select', 'oh-refund-reason-select'),
  /** CONFIRMED. */
  refundReasonOtherInput: locator('refund other-reason input', 'oh-refund-reason-other-input'),
  /** CONFIRMED. */
  refundMethodSelect: locator('refund method select', 'oh-refund-method-select'),
  /** CONFIRMED. `refund-service-select.tsx` also sets `role="combobox"` on the trigger. */
  refundServiceSelect: locator('refund service select', 'oh-refund-service-select', byRole('combobox')),
  /** CONFIRMED. `#refund-service-all` is a literal DOM id on the same row. */
  refundServiceAll: locator('refund all services checkbox', 'oh-refund-service-all', '#refund-service-all'),
  /** CONFIRMED under the shipped `order-*` spelling. */
  refundConfirmBtn: locator(
    'refund confirm button',
    'order-refund-confirm-btn',
    '[data-testid="oh-refund-confirm-btn"]',
  ),
  /**
   * NO FALLBACK, deliberately.
   *
   * `global.partialRefund` is present in both locale bundles but is referenced
   * from nowhere in `src/` — no component renders it. The button VP-802 named
   * either moved into the refund dialog's tab strip (see
   * {@link refundTabPartial}, which does resolve) or no longer exists. Nothing
   * to point a selector at until that is settled.
   */
  refundPartialBtn: locator('partial refund button', 'oh-refund-partial-btn'),

  // --- Receipt dialog ---
  receiptDialog: locator('receipt dialog', 'oh-receipt-dialog', byRole('dialog')),
  receiptPrintBtn: locator(
    'receipt print button',
    'oh-receipt-action-print',
    // `-receipt/receipt-actions.tsx` maps `RECEIPT_ACTIONS` into a `grid-cols-3`.
    // That constant is a frozen `as const` in the order print, sms, email, which
    // is what licenses the positional fallback — the same reasoning as
    // {@link PaymentSuccessIds}. Each button is an `<Icon>` plus a translated
    // label, so there is no non-positional handle.
    'div.grid-cols-3 > button:nth-of-type(1)',
  ),

  // --- Re-open dialog ---
  reopenDialog: locator('re-open dialog', 'oh-reopen-dialog', byRole('alertdialog')),
  reopenConfirmBtn: locator(
    're-open confirm button',
    'oh-reopen-confirm-btn',
    '[data-slot="alert-dialog-footer"] button:last-of-type',
  ),

  // --- Split tip dialog ---
  splitTipBtn: locator(
    'split tip button',
    'oh-split-tip-btn',
    // `order-history-detail-tip.tsx` — the label is a `span.text-primary`
    // inside the trigger, so match on containment rather than exactly.
    buttonContainingAnyText('Split Tip', 'Chia tiền boa'),
  ),
  splitTipDialog: locator('split tip dialog', 'oh-split-tip-dialog', byRole('dialog')),
  splitTipEvenly: locator('split evenly tab', 'oh-split-tip-evenly', `${byRole('tab')}:nth-of-type(1)`),
  splitTipProportion: locator(
    'split by proportion tab',
    'oh-split-tip-proportion',
    `${byRole('tab')}:nth-of-type(2)`,
  ),
  splitTipManual: locator('split manually tab', 'oh-split-tip-manual', `${byRole('tab')}:nth-of-type(3)`),
  splitTipConfirmBtn: locator(
    'split tip confirm button',
    'oh-split-tip-confirm-btn',
    '[data-slot="dialog-footer"] button[type="submit"]',
  ),
  splitTipCloseBtn: locator('split tip close button', 'oh-split-tip-close-btn', '[data-slot="dialog-close"]'),

  // --- Adjust tip: transaction picker (multi-tender orders only) ---
  adjustTipDialog: locator('adjust tip picker dialog', 'adjust-tip-dialog', byRole('dialog')),

  // --- Adjust tip: amount entry ---
  adjustTipTransactionDialog: locator(
    'adjust tip entry dialog',
    'adjust-tip-transaction-dialog',
    byRole('dialog'),
  ),
  adjustTipCurrentAmount: locator(
    'current tip amount',
    'adjust-tip-current-amount',
    'div.text-xl.font-semibold',
  ),
  adjustTipEnterAmount: locator('adjust tip amount display', 'adjust-tip-enter-amount', 'div.text-7xl'),
  adjustTipSaveBtn: locator(
    'adjust tip save button',
    'adjust-tip-save-btn',
    '[data-slot="dialog-footer"] button',
  ),
  /**
   * NO FALLBACK. The empty state VP-802 named has no counterpart in `src/`:
   * nothing under `order-history/` renders a "no staff" message, and no locale
   * key matches one. Either it was removed or it was never built.
   */
  adjustTipNoStaffsMsg: locator('adjust tip no-staff message', 'adjust-tip-no-staffs-msg'),
  /** Declared for traceability only — this keypad ships no `C` key. See group note. */
  adjustTipKeypadClear: locator('adjust tip keypad C', 'adjust-tip-keypad-C'),
  adjustTipKeypadBackspace: locator(
    'adjust tip keypad backspace',
    'adjust-tip-keypad-back',
    // `components/tip/custom-tip-keypad.tsx` ends its layout with
    // [`00`, `0`, `back`], so backspace is the button following `0`. The exact
    // match on `"0"` is what keeps `00` from winning, and digits are the same
    // string in both locales.
    '//button[normalize-space()="0"]/following-sibling::button[1]',
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Customer display (second window)
 * ------------------------------------------------------------------------- */

/**
 * The `customer` window — route `/customer`, title `VOLT POS - Customer Display`.
 *
 * CONFIRMED: the `customer-pay-by-{method}` family (factory below).
 * PENDING:   everything else.
 *
 * `customer-welcome-screen` is load-bearing beyond assertions: VP-802's
 * `ensureMainWindow()` identifies which window it is on by probing for it, so
 * the *absence* of this id is what marks the main window. Until it ships, use
 * `browser.getTitle()` — the two titles differ and are not translated.
 *
 * The tip presets are **not** a fixed 10/15/20/25 ladder. `view-content-tip.tsx`
 * renders whatever `buildTipQuickOptions()` returns from the merchant's tip
 * settings, in either percent or amount mode. `customerTipOption()` below keeps
 * VP-802's percent-keyed naming, but a spec that hardcodes "25%" will fail on a
 * merchant configured for fixed amounts — read the settings, don't assume.
 */
export const CustomerDisplayIds = {
  welcomeScreen: locator(
    'customer welcome screen',
    'customer-welcome-screen',
    // Anchors on the greeting, not the screen root: `customer-welcome-screen.tsx`
    // wraps everything in bare layout divs, and `t("global.welcomeTo")` is the
    // one node unique to this view. Enough to answer "is the idle screen up",
    // which is all this locator is asked.
    textIsAnyOf('Welcome to', 'Chào mừng đến'),
  ),
  tipPopup: locator('customer tip screen', 'customer-tip-popup', 'div.grid-cols-2.overflow-y-auto'),
  tipOptionCustom: locator(
    'custom tip button',
    'customer-tip-option-custom',
    'button[class*="bg-[#E0E9FF]"]:nth-of-type(1)',
  ),
  tipOptionNone: locator(
    'no tip button',
    'customer-tip-option-none',
    'button[class*="bg-[#E0E9FF]"]:nth-of-type(2)',
  ),
  tipContinueBtn: locator(
    'customer continue button',
    'customer-tip-continue-btn',
    buttonWithAnyText('Continue', 'Tiếp tục'),
  ),
  /** `signaturepad.tsx` mounts `signature_pad` on a real `<canvas>` — the only one in the app. */
  signaturePad: locator('customer signature pad', 'customer-signature-pad', 'canvas'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Settings
 * ------------------------------------------------------------------------- */

/**
 * `/settings/*`.
 *
 * CONFIRMED: `pay-period-current`, `pay-period-scheduled`,
 * `pay-period-schedule-note`, `pay-period-scheduled-note`.
 * PROPOSED:  the nav and language factories below — VP-802 never covered
 * settings, and the suite needs a way onto these screens.
 *
 * Both proposals lean on real DOM handles rather than the id: the sidebar renders
 * TanStack `<Link to="/settings/business">` etc. as plain anchors
 * (`-components/settings-sidebar.tsx`), and `language-list.tsx` passes the
 * language code straight into `RadioGroupItem id`, giving `#en` and `#vi`.
 */
export const SettingsIds = {
  /**
   * CONFIRMED — and confirmed the hard way.
   *
   * `pay-period-summary-card.tsx` stamps `data-testid={testId}`; the value comes
   * from its two call sites, `pay-period-current.tsx` and
   * `pay-period-scheduled.tsx`. So both ids DO ship, but neither string ever
   * appears beside the word `data-testid`, and `audit-testids.ts` used to report
   * them as MISSING. The script now reads `testId="…"` props too — these two
   * needed a fix to the audit, not a fallback.
   */
  payPeriodCurrent: locator('current pay period card', 'pay-period-current'),
  /** CONFIRMED. Same indirection as above. */
  payPeriodScheduled: locator('scheduled pay period card', 'pay-period-scheduled'),
  /** CONFIRMED. Inside the apply dialog. */
  payPeriodScheduleNote: locator('pay period schedule note', 'pay-period-schedule-note'),
  /** CONFIRMED. Inline note on the settings page itself. */
  payPeriodScheduledNote: locator('pay period scheduled note', 'pay-period-scheduled-note'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Parameterised locators
 * ------------------------------------------------------------------------- */

/*
 * Rows, tiles and keypad keys whose id carries a runtime value. Every factory
 * below builds on a prefix that appears in one of the two sources; none of them
 * invents a new scheme.
 *
 * Digit keys deserve a note: the shared `Keypad` (`src/components/keypad.tsx`)
 * renders `{key.label ?? key.value}`, so a numeric key's own digit IS its text
 * content. `buttonWithText('7')` is therefore an exact, i18n-proof fallback —
 * the one place text selection is safe in this app. The same holds for the
 * `$5`/`$50` preset labels. It does NOT hold for backspace, which labels itself
 * with an `<Icon>` and leaves the button empty.
 */

/** Header quick-nav link, e.g. `headerMenuItem('/order-history')`. */
export const headerMenuItem = (path: string): Locator =>
  locator(`header menu link ${path}`, `header-menu-item-${path}`, `a[href="${path}"]`, `a[href^="${path}"]`);

/** Passcode-guard digit key. The dialog renders each digit as the button's text. */
export const passcodeDigit = (digit: string): Locator =>
  locator(
    `passcode digit ${digit}`,
    `passcode-guard-dialog-button-${digit}`,
    `${byRole('dialog')} ${buttonWithText(digit)}`,
  );

/** One staff tile on `/home`. */
export const staffItem = (staffId: string): Locator =>
  locator(`staff card ${staffId}`, `staff-item-${staffId}`);

/** One staff group tab on `/home`. `groupId` is `'all'` for the default tab. */
export const staffGroupTab = (groupId: string): Locator =>
  locator(`staff group tab ${groupId}`, `home-staff-group-${groupId}`);

/** One service tile on `/home`. */
export const serviceItem = (serviceId: string): Locator =>
  locator(`service card ${serviceId}`, `service-item-${serviceId}`);

/** One service category tile on `/home`. */
export const serviceCategory = (categoryId: string): Locator =>
  locator(`service category ${categoryId}`, `home-service-category-${categoryId}`);

/** Customer phone keypad key. Uses the shared `Keypad` default layout. */
export const homeCustomerKeypadKey = (value: string): Locator =>
  locator(`customer keypad ${value}`, `home-customer-keypad-${value}`, buttonWithText(value));

/** A matched customer in the phone-lookup popover. */
export const customerSuggestionItem = (customerId: string): Locator =>
  locator(`customer suggestion ${customerId}`, `home-customer-suggestion-item-${customerId}`);

/** Per-line remove button inside the order panel. */
export const removeServiceBtn = (orderItemId: string): Locator =>
  locator(`remove service ${orderItemId}`, `home-order-remove-service-btn-${orderItemId}`);

/**
 * Checkout keypad key. `value` is a digit (`'7'`), `'C'`, `'back'`, or a preset
 * in **cents** — `'500' | '1000' | '5000' | '10000'` for $5/$10/$50/$100.
 * Presets render their dollar label, which is why it doubles as the fallback.
 */
export const checkoutKeypadKey = (value: string): Locator => {
  const presetLabels: Record<string, string> = { '500': '$5', '1000': '$10', '5000': '$50', '10000': '$100' };
  const label = presetLabels[value];
  return label === undefined
    ? locator(`checkout keypad ${value}`, `checkout-keypad-${value}`, buttonWithText(value))
    : locator(`checkout keypad ${label}`, `checkout-keypad-${value}`, buttonWithText(label));
};

/**
 * Adjust-tip keypad key. Presets are `'2000' | '5000' | '10000' | '20000'`
 * ($20/$50/$100/$200) — a different ladder from the checkout keypad.
 */
export const adjustTipKeypadKey = (value: string): Locator => {
  const presetLabels: Record<string, string> = {
    '2000': '$20',
    '5000': '$50',
    '10000': '$100',
    '20000': '$200',
  };
  const label = presetLabels[value];
  return label === undefined
    ? locator(`adjust tip keypad ${value}`, `adjust-tip-keypad-${value}`, buttonWithText(value))
    : locator(`adjust tip keypad ${label}`, `adjust-tip-keypad-${value}`, buttonWithText(label));
};

/** One order row in the `/order-history` list. */
export const orderHistoryItem = (orderId: string): Locator =>
  locator(`order row ${orderId}`, `order-history-item-${orderId}`, `a[href="/order-history/${orderId}"]`);

/** The detail pane bound to a specific order. */
export const orderHistoryDetail = (orderId: string): Locator =>
  locator(
    `order detail ${orderId}`,
    `order-history-detail-${orderId}`,
    'div[class*="order-history-detail-width"]',
  );

/**
 * A titled card inside the detail pane. `title` is the already-translated
 * heading (`'Order Summary'`, `'Service Details'`, `'Tip'`, `'Order Note'`),
 * so this id shifts with the merchant language — see the group note.
 */
export const orderHistoryDetailSection = (title: string): Locator =>
  locator(`detail section ${title}`, `order-history-detail-section-${title}`);

/** A status checkbox in the order-history filter. `-shared/order-history.constants.ts` hardcodes the DOM id. */
export const orderHistoryStatusFilter = (statusId: string): Locator =>
  locator(`status filter ${statusId}`, `oh-filter-status-${statusId}`, `#${statusId}`);

/** A payment-method checkbox in the order-history filter (`card`, `cash`, `gift-card`, `other`). */
export const orderHistoryPaymentFilter = (methodId: string): Locator =>
  locator(`payment filter ${methodId}`, `oh-filter-payment-${methodId}`, `#${methodId}`);

/** One refundable service row in the refund dialog. CONFIRMED — this id ships today. */
export const refundServiceItem = (orderItemId: string): Locator =>
  locator(`refund service ${orderItemId}`, `oh-refund-service-item-${orderItemId}`);

/** A tender row in the multi-transaction adjust-tip picker. `index` is 0-based. */
export const adjustTipPaymentItem = (index: number): Locator =>
  locator(`adjust tip tender ${index}`, `adjust-tip-payment-item-${index}`);

/** The "Adjust Tip" button on one tender row of the picker. */
export const adjustTipPaymentItemBtn = (index: number): Locator =>
  locator(`adjust tip tender button ${index}`, `adjust-tip-payment-item-btn-${index}`);

/** The method label on one tender row of the picker. */
export const adjustTipPaymentItemLabel = (index: number): Locator =>
  locator(`adjust tip tender label ${index}`, `adjust-tip-payment-item-label-${index}`);

/** The amount on one tender row of the picker. */
export const adjustTipPaymentItemAmount = (index: number): Locator =>
  locator(`adjust tip tender amount ${index}`, `adjust-tip-payment-item-amount-${index}`);

/** Receipt-delivery button on the payment-success screen (`no_receipt`/`print`/`sms`/`email`). */
export const paymentSuccessActionBtn = (value: string): Locator =>
  locator(`payment success action ${value}`, `payment-success-action-button-${value}`);

/**
 * A tip preset on the customer display, keyed by percent as VP-802 named them.
 * Only meaningful when the merchant runs percent-mode tipping.
 */
export const customerTipOption = (percent: number | string): Locator =>
  locator(`customer tip option ${percent}`, `customer-tip-option-${percent}`);

/**
 * Payment-method button on the customer display. CONFIRMED — this id ships today
 * (`customer/-view-cart/payment-method-buttons.tsx`). `method` is a `PAYMENT_TYPE`
 * value: `card`, `cash`, `gift_card`, `other`.
 */
export const customerPayBy = (method: string): Locator =>
  locator(`customer pay by ${method}`, `customer-pay-by-${method}`);

/**
 * PROPOSED. A settings sidebar entry, e.g. `settingsNavItem('/settings/language')`.
 * Named after the `header-menu-item-{path}` scheme VP-802 already established.
 */
export const settingsNavItem = (path: string): Locator =>
  locator(`settings nav link ${path}`, `settings-menu-item-${path}`, `a[href="${path}"]`);

/**
 * PROPOSED. An entry of the APP sidebar — the drawer behind the hamburger, e.g.
 * `appSidebarItem(Routes.SETTINGS_BUSINESS)`.
 *
 * Not {@link settingsNavItem}, which is the sidebar rendered INSIDE `/settings`.
 * This one is `app-sidebar.tsx`'s `menu` array and is the only route onto
 * `/settings`, `/incomes/*`, `/time-tracking` and `/batch-history` — the header
 * quick-nav carries just order history and appointments.
 *
 * The scope is what makes the `href` fallback unambiguous. `ui/sidebar.tsx`
 * builds the drawer as a Radix `Sheet` (`collapsible="offcanvas"`), so its
 * content is UNMOUNTED while closed and these anchors exist only once the
 * hamburger has been pressed — but `/home` and `/order-history` are ALSO in the
 * header, so an unscoped `a[href="/home"]` would match the logo instead and
 * "click the sidebar entry" would pass without the sidebar ever being open.
 */
export const appSidebarItem = (path: string): Locator =>
  locator(
    `app sidebar link ${path}`,
    `app-sidebar-item-${path}`,
    `[data-slot="sidebar"] a[href="${path}"]`,
    `[data-sidebar="sidebar"] a[href="${path}"]`,
  );

/** PROPOSED. A language radio on `/settings/language`. `code` is `en` or `vi`. */
export const settingsLanguageOption = (code: string): Locator =>
  locator(`language option ${code}`, `settings-language-option-${code}`, `#${code}`);

/* ------------------------------------------------------------------------- *
 * Registries
 * ------------------------------------------------------------------------- */

/**
 * Every namespace, keyed by name. `scripts/audit-testids.ts` walks this to
 * enumerate what the suite depends on and diff it against the app source, so a
 * new group is invisible to the report until it is listed here.
 */
export const ALL_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  ...INCOME_LOCATOR_GROUPS,
  ...ORDER_FLOW_LOCATOR_GROUPS,
  ...PAYROLL_LOCATOR_GROUPS,
  ...SETTINGS_LOCATOR_GROUPS,
  CommonIds,
  SplashIds,
  LoginIds,
  HomeIds,
  CheckoutIds,
  PaymentSuccessIds,
  OrderHistoryIds,
  OrderHistoryDetailIds,
  CustomerDisplayIds,
  SettingsIds,
};

/**
 * Prefixes the parameterised locators build on.
 *
 * The factories cannot be enumerated the way {@link ALL_LOCATOR_GROUPS} is —
 * their ids only exist once a runtime value is supplied — so the audit script
 * prefix-matches these against the app source instead. Without this list every
 * row, tile and keypad key would be silently absent from the coverage report.
 */
export const FACTORY_TESTID_PREFIXES: readonly string[] = [
  'header-menu-item-',
  'app-sidebar-item-',
  'passcode-guard-dialog-button-',
  'staff-item-',
  'home-staff-group-',
  'service-item-',
  'home-service-category-',
  'home-customer-keypad-',
  'home-customer-suggestion-item-',
  'home-order-remove-service-btn-',
  'checkout-keypad-',
  'adjust-tip-keypad-',
  'order-history-item-',
  'order-history-detail-',
  'order-history-detail-section-',
  'oh-filter-status-',
  'oh-filter-payment-',
  'oh-refund-service-item-',
  'adjust-tip-payment-item-',
  'payment-success-action-button-',
  'customer-tip-option-',
  'customer-pay-by-',
  'settings-menu-item-',
  'settings-language-option-',
];
