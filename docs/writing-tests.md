# Writing tests

Conventions for adding coverage. They exist so that a spec written today still runs in six months,
and so that a failure names its own cause instead of pointing at a selector.

---

## The shape of a spec

```ts
import { expect } from '@wdio/globals';
import { createOrder, goToOrderHistory, payInCash, returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryPage } from '../../../src/pages/index.js';
import { step } from '../../../src/helpers/steps.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';

describe('Checkout — cash', () => {
  before(async () => {
    // Signing in is the ROOT HOOK's job (tests/setup/rootHooks.ts) and runs once
    // per spec file. A spec only has to state the screen it wants to start on.
    await returnToHome();
  });

  it(
    title('A cash payment closes the order and lands in history', Tag.REGRESSION, Tag.CRITICAL, Tag.WRITE),
    async () => {
      const { orderId } = await createOrder();

      const checkout = await step('Read the amount due', () => homePage.pressPay());
      const totalCents = await checkout.totalCents();

      await payInCash(orderId, { tenderedCents: totalCents });

      await goToOrderHistory();
      const row = await orderHistoryPage.findRowByOrderId(orderId);
      expectCentsEqual(row?.total ?? 0, totalCents, 'order-history row total');
    },
  );
});
```

What the example is demonstrating:

- **Every relative import ends in `.js`.** This is an ESM project run through `tsx`; an
  extensionless relative import fails at runtime, not at compile time.
- **Page objects are singletons imported from the barrel**, lowercase — `homePage`, not
  `new HomePage()`. They hold locators and intent, never per-test state, so there is nothing for a
  second instance to own. The exported class beside each one is for type annotations.
- **The title is built with `title()` and tags from `src/types/testTags.ts`**, never hand-typed.
  Mocha has no tag concept — tags are substrings in the title selected by `--mochaOpts.grep`, and a
  hand-typed `@Smoke` silently removes the test from its lane.
- **The spec contains no selector.** It calls flows and page objects.
- **`step()` names the phase** in the terminal, in the Allure timeline, and in the on-screen overlay
  inside the app window, so someone watching the machine can see where a run is.
- **Assertions live in the spec.** Flows act; specs decide whether the result is right.

### File layout and naming

| Path                                | Holds                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/smoke/*.spec.ts`             | Read-only checks. The only suite that may run against production.                                                                        |
| `tests/regression/<area>/*.spec.ts` | Functional coverage: `home/`, `checkout/`, `order-history/`, `settings/`. The suite names in `wdio.shared.conf.ts` map to these folders. |
| `src/pages/<area>/<Screen>Page.ts`  | One page object per screen, e.g. `src/pages/pos/CheckoutPage.ts`. Re-exported from `src/pages/index.ts`.                                 |
| `src/components/<area>/<Thing>.ts`  | Dialogs, sheets, keypads, chrome. Re-exported from `src/components/index.ts`.                                                            |
| `src/flows/<area>.flow.ts`          | Multi-screen business actions. Re-exported from `src/flows/index.ts`.                                                                    |
| `src/constants/testids.ts`          | **Every** selector in the suite. Page objects import from here; nothing declares its own.                                                |

Spec files are kebab-case; page objects and components are PascalCase, matching the class they
export. Both singleton and class are exported from the barrel.

---

## One page object per screen

A page object owns exactly one route. It declares `name`, `route` (from `src/constants/routes.ts`)
and `readyAnchor`, exposes intent-shaped methods — never raw elements — and ends the file with the
singleton the barrel re-exports.

```ts
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { CheckoutIds, checkoutKeypadKey } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';

/** The id sits in the MIDDLE of the path, so `route` cannot carry it — see `isActive()`. */
const CHECKOUT_PATH = /^\/order\/([^/]+)\/checkout\/?$/;

export class CheckoutPage extends BasePage {
  readonly name = 'Checkout';
  readonly route = '/order';

  protected readonly readyAnchor: Locator = CheckoutIds.completePaymentBtn;

  override async isActive(): Promise<boolean> {
    return CHECKOUT_PATH.test(await this.currentPath());
  }

  async typeDigits(digits: string): Promise<this> {
    for (const digit of digits) {
      await this.click(checkoutKeypadKey(digit));
    }
    return this;
  }

  async remainingCents(): Promise<number> {
    return parseMoney(await this.text(CheckoutIds.remaining, { timeout: Timeouts.MEDIUM }));
  }
}

export default new CheckoutPage();
```

Rules worth stating explicitly:

- **Selectors live in `src/constants/testids.ts`, not in the page object.** That single catalogue is
  what `npm run audit:testids` walks to diff the suite's dependencies against the app source, and
  what stops the same element being reached three different ways from three files. A page object
  imports a group (`CheckoutIds`) or a factory (`checkoutKeypadKey`) and never calls `locator()`
  itself — the two places that do carry a written justification for why the id cannot be catalogued
  yet.
- **`readyAnchor` must be data-dependent.** Pick the total, the table body, the primary action —
  something that only exists once the IPC round trip returned. A static header paints immediately
  and lets the spec race ahead of its own data. `waitForReady()` races that anchor against the app's
  error boundary and the forced-update screen, so a bad environment fails in a second with a real
  message instead of burning the full timeout and blaming the selector.
- **A route that carries an id overrides `isActive()`.** `/order/{id}/checkout` has no usable static
  prefix — `/order` also covers payment-success and split-order — so the regex is the real test and
  `route` is only what failure messages print.
- **No `$()` outside `src/pages` and `src/components`.** Everything goes through the protected
  `UiObject` helpers: `find`, `findAll`, `exists`, `isVisible`, `click`, `setValue`, `addValue`,
  `text`, `value`, `waitGone`.
- **A page object does not assert.** It returns values; the spec decides.
- **A page object does not reach into another page object.** If an action spans screens, it is a
  flow. The one concession is a page object RETURNING the next screen (`homePage.pressPay()` hands
  back `checkoutPage`), and where that would close an import cycle it is resolved with a dynamic
  `import()` — see the note on `HomePage.pressPay`.

### Components for subtrees

Anything that is a dialog, a sheet or a repeated region is a `BaseComponent` with a `root`, and
every lookup inside it goes through `inside()` / `insideAll()`.

```ts
import { CommonIds, passcodeDigit } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { BaseComponent } from '../BaseComponent.js';

export class PasscodeDialog extends BaseComponent {
  readonly name = 'Passcode guard';

  protected readonly root: Locator = CommonIds.passcodeGuardDialog;

  async enter(passcode: string): Promise<void> {
    await this.waitOpen();
    for (const digit of passcode) {
      const key = await this.inside(passcodeDigit(digit));
      await key.click();
    }
    await this.waitClosed();
  }
}

export const passcodeDialog = new PasscodeDialog();
```

Scoping is not tidiness. This UI keeps closed Radix dialogs mounted in the DOM and reuses testids
across the order list, the split-order sheet and the receipt preview. An unscoped `$()` returns the
copy inside the hidden dialog, and the resulting "element not interactable" points nowhere near the
cause.

**The exception is chrome that spans two subtrees.** `AppNav` (`src/components/nav/AppNav.ts`) owns
the header's left group and the sidebar drawer, which are not nested — the sidebar is a Radix
`Sheet` portalled to `document.body`. It extends `UiObject` rather than `BaseComponent` and its
sidebar locators carry their own `[data-slot="sidebar"]` scope, because a `root` of `body` would
make the scoping guarantee decorative. Anything that genuinely is one subtree stays a
`BaseComponent`.

---

## Flows for multi-screen business actions

A flow is a business action that crosses screens. "Create an order for a walk-in customer, pay it
in cash, confirm the passcode" spans home, checkout, the passcode dialog and the payment-success
screen. That sequence appears in a dozen specs, so it lives once.

```ts
import { Timeouts } from '../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../configs/env/loadEnv.js';
import { passcodeDialog } from '../components/index.js';
import { step } from '../helpers/steps.js';
import { checkoutPage, paymentSuccessPage } from '../pages/index.js';
import type { PaymentSuccessPage } from '../pages/index.js';

/** `requireCheckoutFor` is a module-local helper — see `src/flows/checkout.flow.ts`. */
export async function payInCash(orderId: string, tender: CashTender = {}): Promise<PaymentSuccessPage> {
  // First statement, before a single click: a production build talks to the live
  // gateway and pushes every row upstream.
  assertWritesAllowed('take a cash payment');

  return step('Pay in cash', async () => {
    // The id is a PRECONDITION, not a parameter: it is compared against the one
    // in the checkout URL so a stray navigation cannot charge the wrong check.
    await requireCheckoutFor(orderId, 'cash');

    await checkoutPage.payWithCash(tender.tenderedCents);

    // Whether the guard appears at all is merchant configuration — the staff's
    // `completed_payment` permission, and the "skip for 30 minutes" tick. A flow
    // that always typed a passcode would fail on a till configured without it.
    await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);

    return paymentSuccessPage.waitForNavigation(Timeouts.API);
  });
}
```

- **Flows act, specs assert.** A flow may wait for a screen to be ready — that is part of doing the
  action — but the pass/fail decision belongs to the spec.
- **`assertWritesAllowed('<action>')` is the first line of every data-creating flow.** Putting the
  guard here rather than in each spec means a new spec cannot forget it, and the thrown message
  names the action, the environment and the upstream host. Navigation flows have no such line, on
  purpose: moving between screens writes nothing.
- **Flows contain no selectors.** They compose page objects and components. A flow that needs an
  element means a page object is missing a method — that is what keeps the whole testid catalogue in
  one file instead of scattered through business logic.
- **A flow returns what the spec needs to work with** — the next page object, an order id — not an
  element.
- **Flows never navigate by URL.** `browser.url()` works against the custom protocol, but it is a
  document load: it re-runs the entire splash boot (migrations, three SQLCipher opens, a sync
  handshake) and discards the step overlay. `navigation.flow.ts` clicks the same chrome a cashier
  would, so a screen the app refuses to leave is reported rather than bulldozed.

### The navigation flows

`returnToHome()`, `goToOrderHistory()` and `goToSettings()` exist because the app's chrome is not
uniform, and no page object may know about the screens either side of it:

| From                          | Exit                                  | Why not the logo                                       |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `/order/{id}/payment-success` | "No Receipt"                          | `header.tsx` hides the header outright on this route.  |
| `/order/{id}/checkout`        | The header back arrow                 | `header-left.tsx` replaces the whole left nav with it. |
| anything else                 | The logo, a plain `<Link to="/home">` | —                                                      |

Two consequences worth knowing before writing a spec that navigates. Settings is reachable **only**
through the sidebar — the header quick-nav carries order history and appointments and nothing else.
And the checkout back button reuses the hamburger's hardcoded `aria-label="Open sidebar"`, so
`AppNav.openSidebar()` refuses to run on a checkout path instead of quietly navigating away;
`goToSettings()` returns to the till first when it has to.

---

## Tags

Tags are appended to the title by `title()` and selected with `--mochaOpts.grep` or through the
suite folders. Full table in `src/types/testTags.ts`.

| Tag            | Meaning                                                                                                     | Consequence                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@smoke`       | Read-only, creates nothing, safe anywhere                                                                   | The only tag production may run                                                                |
| `@regression`  | Full functional coverage                                                                                    | dev / staging only                                                                             |
| `@critical`    | Revenue path that gates a release                                                                           | Selected by `npm run test:critical`                                                            |
| `@write`       | Creates an order, takes a payment, issues a refund                                                          | Requires `WRITE_ALLOWED`; the flow must call the guard                                         |
| `@payment`     | Touches the payment gateway                                                                                 | Never production                                                                               |
| `@exclusive`   | Mutates merchant-**global** state: app language, passcode-verification switch, business info, turn settings | Runs last and alone; two of these corrupt each other regardless of which staff member they use |
| `@dual-window` | Asserts across both the staff window and the customer display                                               | Must switch back to `main` before finishing                                                    |
| `@db`          | Needs the local database to re-derive an expected number                                                    | Filesystem-level only — the databases are encrypted                                            |
| `@slow`        | App boot, sync waits, report generation                                                                     | Documentation for whoever reads the timing                                                     |
| `@flaky`       | Quarantined                                                                                                 | Runs, but never gates a merge                                                                  |

A spec tagged `@smoke` that creates anything is a bug in the spec, not a policy question: it will
eventually run against a production till.

---

## Selectors, and when a fallback is acceptable

Every selector is a `Locator`: a name, the `data-testid` the app is expected to expose, and an
ordered list of fallbacks.

```ts
const PAY = locator(
  'complete payment button', // name — appears in logs and failure messages
  'checkout-complete-payment-btn', // the testid the app should have
  '//button[@data-slot="checkout-primary-action"]', // reviewed fallback, temporary
);
```

`UiObject.find` tries the whole chain, re-tries the whole chain on each poll, and prefers the
earliest match each round — so the testid wins the moment it exists, even if a fallback matched
first while the screen was still mounting.

### Never invent a testid

Use one that exists in the app source or in the `feat/VP-802` reference suite. If neither has it,
declare the id the app **should** expose — the one you will ask the app team for — and pair it with
a real fallback. Do not make up an id you have no intention of requesting.

### A fallback is acceptable when

- the testid does not exist in the app yet **and** an audit entry or a ticket exists asking for it;
- it is anchored to something structural: a `role`, an `aria-label`, an `id`, a `data-slot`, or a
  parent testid plus one child relationship;
- a reviewer read it and agreed it identifies the element rather than its position;
- it is the shortest thing that works, and it is written down in the `locator()` call where the
  audit can see it.

### A fallback is not acceptable when

- it depends on **text**. The app runs i18next and the UI language is merchant state, so
  `//button[text()="Pay"]` stops matching the day someone switches the till to Vietnamese. The
  text helpers in `src/helpers/selectors.ts` are for **values** — a price, a customer name, an order
  number — and say so in their doc comments.
- it depends on a Tailwind class (`.bg-primary`, `.flex.items-center`). Those are regenerated by a
  restyle.
- it depends on position: `:nth-child(3)`, `div > div > div`, `//table//tr[2]/td[4]`.
- the testid already exists and someone added a fallback "just in case". That hides a real breakage
  behind a working-by-accident selector.

---

## The data-testid workflow

The app ships 23 `data-testid` attributes on `develop`. The unmerged `feat/VP-802` branch adds
roughly 157 more. Fallbacks are the bridge, and the bridge is meant to be dismantled.

**1. Audit.** `npm run audit:testids` reads every `locator()` declaration in this repo, greps the
app source under `VOLT_POS_SRC`, and prints which ids are present and which are missing. Run it
before writing a page object, so you know which parts of the screen already have a stable handle,
and again before opening a pull request.

**2. Ask the app team for the missing ids.** One ticket per screen, not per element. Give them
something they can apply mechanically — the component file, the element, the exact id, and why:

> `src/routes/_app/order/-checkout/checkout-summary.tsx` — the "Complete Payment" button needs
> `data-testid="checkout-complete-payment-btn"`. E2E currently reaches it through
> `//button[@data-slot="checkout-primary-action"]`, which breaks on any restyle of that button.

Follow the naming already in use: `<screen>-<thing>-<role>`, kebab-case, with the identifier last
for repeated rows — `checkout-tab-cash`, `order-history-item-<orderId>`, `home-customer-keypad-7`,
`passcode-guard-dialog-button-3`. Do not invent a second naming scheme.

**3. Delete the fallback the moment the id lands.** When `audit:testids` reports the testid as
present, remove the fallback from the `locator()` call in the same pull request. A fallback that
outlives its reason is how a suite ends up silently depending on a CSS path nobody remembers
choosing.

---

## Waiting

- **No `browser.pause()` as a synchronization primitive** in specs, flows or page objects. It is a
  guess that becomes a flake on a slower machine and dead time on a faster one. `UiObject` polls
  internally on short intervals; everything above it waits on state.
- **Use the named budgets** from `configs/constants/timeouts.ts` — `SHORT` for something already on
  screen, `MEDIUM` for an element gated by a local IPC round trip, `LONG` / `API` for an upstream
  call, `NAVIGATION` for a route change, `APP_BOOT` for the splash. An ad-hoc `{ timeout: 30000 }`
  makes a slow environment look like a broken selector, and re-tuning the suite means editing one
  table rather than grepping for numbers.
- **Wait for the state you actually care about.** `waitForReady()` for a screen, `waitOpen()` /
  `waitClosed()` for a dialog, `waitGone()` for a spinner. Waiting for a click to "settle" is not a
  state.

---

## Money

The app stores every amount as **integer cents** and formats it for display. Do not do float
arithmetic on a value you scraped from the UI, and do not compare formatted strings across locales.

Parse the displayed value into cents and compare integers, or compare the exact formatted string
only when the merchant's locale is fixed for that spec. Amounts passed into flows and page objects
are cents, and the parameter names say so: `payInCash(orderId, { tenderedCents: 5000 })` is $50.00,
and so is `checkoutPage.enterAmount(5000)`.

The checkout keypad makes this literal rather than a convention — `checkout-payment.tsx` renders
`money(amount || 0)` over a **cents string** that the keypad appends raw digits to, so pressing
`1`,`2`,`3` shows `$1.23`. Reach for `expectCentsEqual()` from `src/utils/money.ts`: it refuses a
non-integer before comparing, which catches a dollars-for-cents parse at the read rather than 100×
later.

---

## Dual-window specs

A session has two OS windows: `main` (title `VOLT POS`) and `customer` (title
`VOLT POS - Customer Display`, route `/customer`). Switch through `src/helpers/window.ts` —
`switchToMain()`, `switchToCustomer()`, `withCustomerWindow()` — never by driving
`browser.getWindowHandles()` from a spec: the handles are not ordered, so identifying a window means
reading its title or its route, and doing that inline is how a spec ends up asserting against
whichever window the driver happened to hand it.

Tag the spec `@dual-window`, and **switch back to `main` before the test ends**. The next spec
assumes it starts on the staff window, and a session left on the customer display fails in a way
that has nothing to do with the spec that actually broke.

---

## Test independence

- A spec must set up what it needs. Do not depend on a spec earlier in the file having created an
  order, and never on the order of files.
- `before` hooks may sign in and reach a starting screen; that is what the `MOCHA_HOOK` budget is
  for.
- Prefer creating your own data over asserting on data that happens to be in the merchant's
  database. When you must rely on seeded data (a service, a staff member, a gift card), state the
  prerequisite in the `describe` block so a failure on a fresh merchant is self-explanatory.
- `@exclusive` specs mutate merchant-global settings. Restore what you changed, and expect to run
  last and alone.

---

## Before you open the pull request

```powershell
npm run audit:testids   # any fallback you can now delete?
npm run verify          # typecheck + lint + format:check
npm run test:spec -- tests/regression/<area>/<your>.spec.ts
```

The review checklist is in [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
