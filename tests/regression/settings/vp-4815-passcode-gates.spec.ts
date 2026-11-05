/**
 * VP-4815 — passcode gates for Quick Checkout / Quick Pay / Sell Gift Card /
 * Edit Service Price / Calendar (volt-pos#3317) and the Customer Status badge
 * (volt-pos#3319).
 *
 * Source: `docs/qc/volt-qc/vp-tickets/VP-4815-passcode-gates-customer-status-test-cases.md`
 * (TC-VP4815-01 … 21).
 *
 * ## Why @exclusive
 *
 * The gates are MERCHANT-GLOBAL (`merchant_passcode_settings`). `before`
 * snapshots every gate and turns the five under test ON; `after` restores the
 * snapshot exactly — also when a case failed half-way — and re-arms the run's
 * 30-minute grant so later specs do not start prompting.
 *
 * ## Order of the cases
 *
 * TC-01…04 start ONE order through the Quick Checkout gate and TC-08/09/10/12/13
 * reuse it (Quick Pay, Gift Card and the line editor all need an open order),
 * so the file runs them in that order rather than by number. Every case that
 * opens an order deletes it again.
 *
 * Every probe clears the grant first: with "skip for 30 minutes" live the guard
 * never mounts, and an "ON → prompts" assertion would fail for the wrong reason.
 *
 * TC-07 needs an active gift card the Scanner resolves REMOTELY (`giftCardQueryByCode`)
 * — pin one with VP4815_GIFT_CARD, else the first that resolves; skipped when none.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToOrderHistory, returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryPage, accessibilitySettingsPage } from '../../../src/pages/index.js';
import type { PasscodeGateState } from '../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  ALL_OFF,
  ALL_ON,
  NO_PERMISSION_RE,
  VP4815_GATES,
  customerTypes,
  customersFoundRows,
  customersNamed,
  customersWhere,
  discardCreatedOrder,
  expectedLabel,
  freeStaffId,
  openScannerAddFunds,
  scannerGiftCard,
  openAccessibility,
  setGates,
  startEmptyCart,
  storedGates,
  unlockIfPrompted,
  visibleStatusBadges,
  vp4815,
} from './vp-4815.helpers.js';

const TAGS = [Tag.REGRESSION, Tag.WRITE, Tag.EXCLUSIVE] as const;

let snapshot: PasscodeGateState | null = null;

async function expectPrompt(screen: RegExp): Promise<void> {
  const up = await passcodeDialog.waitForPrompt(screen, Timeouts.MEDIUM);
  expect(await passcodeDialog.promptTitle()).toMatch(screen);
  expect(up).toBe(true);
}

async function expectRefused(code: string): Promise<void> {
  const message = await passcodeDialog.enterExpectingRefusal(code);
  expect(message).toMatch(NO_PERMISSION_RE);
  expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(true);
}

async function expectNoPrompt(): Promise<void> {
  expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
}

describe('VP-4815 — passcode gates + customer status', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change merchant passcode gates');
    await openAccessibility();
    snapshot = await accessibilitySettingsPage.readGates();
    for (const gate of VP4815_GATES) {
      if (!(gate in snapshot)) {
        throw new Error(
          `VP-4815: Passcode Setting has no "${gate}" switch — this build predates the ticket (needs ≥ 1.1.99).`,
        );
      }
    }
    await setGates(ALL_ON);
  });

  /**
   * A failed case stops before its own discardCreatedOrder(), leaving its order
   * on Pending (3 such orders after the first runs on 1.1.100). Clean up here
   * too — but only after a failure, because TC-01…04 hand their open order on
   * to TC-08…13 on purpose.
   */
  afterEach(async function (this: Mocha.Context): Promise<void> {
    if (this.currentTest?.state !== 'failed') return;
    this.timeout(Timeouts.MOCHA_HOOK);
    await unlockIfPrompted().catch(() => undefined);
    await discardCreatedOrder().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await unlockIfPrompted().catch(() => undefined);
    await discardCreatedOrder().catch(() => undefined);
    if (snapshot) await setGates(snapshot);
    await returnToHome();
    await ensurePasscodeGrant();
  });

  /* ------------------------------------------------------------------- *
   * 1. Quick Checkout — one order, reused by Quick Pay / Gift Card / price
   * ------------------------------------------------------------------- */

  it(
    title(
      'TC-VP4815-01 Empty cart: tapping a staff asks for the Quick Checkout passcode',
      Tag.CRITICAL,
      ...TAGS,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await startEmptyCart();
      await homePage.selectStaff(await freeStaffId());
      await expectPrompt(/Quick Checkout/i);
      expect(await homePage.hasActiveDraft(Timeouts.ANIMATION)).toBe(false);
    },
  );

  it(
    title('TC-VP4815-02 A Staff-role code is refused at the Quick Checkout prompt', Tag.CRITICAL, ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await expectRefused(vp4815.staff);
      expect(await homePage.hasActiveDraft(Timeouts.ANIMATION)).toBe(false);
    },
  );

  it(
    title('TC-VP4815-03 The Owner code passes and the order is created', Tag.CRITICAL, ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await passcodeDialog.enter(vp4815.owner);
      expect(await homePage.hasActiveDraft(Timeouts.MEDIUM)).toBe(true);
    },
  );

  it(
    title('TC-VP4815-04 Order open: tapping a service adds it without a prompt', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await clearPasscodeGrant();
      await homePage.addFirstService();
      await expectNoPrompt();
      expect(await homePage.cartSubtotal()).toBeGreaterThan(0);
    },
  );

  it(
    title('TC-VP4815-08 Quick Pay asks for a passcode and refuses a Staff-role code', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await clearPasscodeGrant();
      await homePage.tapQuickPayTile();
      await expectPrompt(/Quick Pay/i);
      await expectRefused(vp4815.staff);
    },
  );

  it(title('TC-VP4815-09 A Partner (holds quick_pay) opens Quick Pay', ...TAGS), async function () {
    this.timeout(Timeouts.MOCHA_HOOK);
    await passcodeDialog.enter(vp4815.partner);
    expect(await homePage.isQuickPayDialogShown()).toBe(true);
    await homePage.closeQuickPayDialog();
  });

  it(
    title(
      'TC-VP4815-10 Order open: Gift Card asks once (Sell Gift Card); Staff refused, Manager passes',
      ...TAGS,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await clearPasscodeGrant();
      await homePage.tapGiftCardTile();
      await expectPrompt(/Sell Gift Card|Bán thẻ quà tặng/i);
      await expectRefused(vp4815.staff);
      await passcodeDialog.enter(vp4815.manager);
      expect(await homePage.isSellGiftCardOpen(Timeouts.MEDIUM)).toBe(true);
      await homePage.closeSellGiftCard();
    },
  );

  it(
    title('TC-VP4815-12 Line editor: changing only the note saves without a prompt', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await clearPasscodeGrant();
      await homePage.openServiceEditor();
      await homePage.setServiceNote('VP4815 note only');
      await homePage.pressServiceEditorSave();
      await expectNoPrompt();
      expect(await homePage.isServiceEditorShown()).toBe(false);
    },
  );

  it(
    title(
      'TC-VP4815-13 Changing the price asks; Staff refused, Manager saves the new price',
      Tag.CRITICAL,
      ...TAGS,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await clearPasscodeGrant();
      await homePage.openServiceEditor();
      const before = await homePage.serviceEditorPriceCents();
      const target = before - 500;
      await homePage.setServiceEditorPrice(target);
      await homePage.pressServiceEditorSave();
      await expectPrompt(/Edit Service Price|giá dịch vụ/i);
      await expectRefused(vp4815.staff);
      await passcodeDialog.enter(vp4815.manager);
      expect(await homePage.isServiceEditorShown()).toBe(false);

      await homePage.openServiceEditor();
      expect(await homePage.serviceEditorPriceCents()).toBe(target);
      await homePage.closeServiceEditor();
      await discardCreatedOrder();
    },
  );

  /* ------------------------------------------------------------------- *
   * 1b. Quick Checkout — other entry points
   * ------------------------------------------------------------------- */

  it(
    title('TC-VP4815-05 Empty cart: picking a customer asks; Staff refused; closing starts nothing', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await startEmptyCart();
      await homePage.typeCustomerSearch(vp4815.vipPhone);
      await homePage.tapCustomerSearchResult(vp4815.vipPhone);
      await expectPrompt(/Quick Checkout/i);
      await expectRefused(vp4815.staff);
      await passcodeDialog.dismiss();
      expect(await homePage.hasActiveDraft(Timeouts.ANIMATION)).toBe(false);
    },
  );

  it(
    title(
      'TC-VP4815-06 Empty cart: tapping a service shows "Select Staff First" and starts nothing',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await startEmptyCart();
      await homePage.addFirstService().catch(() => undefined);
      expect(await homePage.isSelectStaffFirstShown()).toBe(true);
      await expectNoPrompt();
      await homePage.dismissSelectStaffFirst();
      expect(await homePage.hasActiveDraft(Timeouts.ANIMATION)).toBe(false);
    },
  );

  it(
    title(
      'TC-VP4815-07 Scanner → Add Funds asks Quick Checkout (Staff refused), then Sell Gift Card',
      ...TAGS,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      const code = await scannerGiftCard();
      if (!code) this.skip(); // no active card the remote lookup resolves
      await startEmptyCart();
      await openScannerAddFunds(code);
      await expectPrompt(/Quick Checkout/i);
      await expectRefused(vp4815.staff);
      // Sell Gift Card's guard replaces this one at once — see TC-11.
      await passcodeDialog.typeCode(vp4815.owner);
      await expectPrompt(/Sell Gift Card|Bán thẻ quà tặng/i);
      await passcodeDialog.enter(vp4815.owner);
      expect(await homePage.isSellGiftCardOpen(Timeouts.MEDIUM)).toBe(true);
      await discardCreatedOrder();
    },
  );

  it(
    title(
      'TC-VP4815-11 Empty cart + both gates: Gift Card asks Quick Checkout, then Sell Gift Card',
      ...TAGS,
    ),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await startEmptyCart();
      await homePage.tapGiftCardTile();
      await expectPrompt(/Quick Checkout/i);
      // The Sell Gift Card guard replaces this one at once, so enter() would read
      // "still prompting" as a refusal — type, then wait for the second title.
      await passcodeDialog.typeCode(vp4815.owner);
      await expectPrompt(/Sell Gift Card|Bán thẻ quà tặng/i);
      await passcodeDialog.enter(vp4815.owner);
      expect(await homePage.isSellGiftCardOpen(Timeouts.MEDIUM)).toBe(true);
      await homePage.closeSellGiftCard();
      await discardCreatedOrder();
    },
  );

  /* ------------------------------------------------------------------- *
   * Calendar
   * ------------------------------------------------------------------- */

  it(
    title('TC-VP4815-14 Appointment asks for the Calendar passcode; Staff refused', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      await clearPasscodeGrant();
      await appNav.goToAppointment();
      await expectPrompt(/Calendar|Lịch/i);
      await expectRefused(vp4815.staff);
    },
  );

  it(title('TC-VP4815-15 The Owner code opens the Calendar', ...TAGS), async function () {
    this.timeout(Timeouts.MOCHA_HOOK);
    await passcodeDialog.enter(vp4815.owner);
    expect(await appNav.currentPath()).toMatch(new RegExp(`^${Routes.APPOINTMENT}`));
    await expectNoPrompt();
    await returnToHome();
  });

  /* ------------------------------------------------------------------- *
   * Gates off / Passcode Setting
   * ------------------------------------------------------------------- */

  it(title('TC-VP4815-16 All five gates OFF: nothing prompts', Tag.CRITICAL, ...TAGS), async function () {
    this.timeout(Timeouts.MOCHA_HOOK * 2);
    await setGates(ALL_OFF);
    const stored = await storedGates();
    for (const gate of VP4815_GATES) expect(stored[gate]).toBe(false);

    await appNav.goToAppointment();
    await expectNoPrompt();

    await startEmptyCart();
    await homePage.selectStaff(await freeStaffId());
    await expectNoPrompt();
    expect(await homePage.hasActiveDraft(Timeouts.MEDIUM)).toBe(true);

    await homePage.addFirstService();
    await homePage.openServiceEditor();
    await homePage.setServiceEditorPrice((await homePage.serviceEditorPriceCents()) - 100);
    await homePage.pressServiceEditorSave();
    await expectNoPrompt();

    await homePage.tapQuickPayTile();
    await expectNoPrompt();
    expect(await homePage.isQuickPayDialogShown()).toBe(true);
    await homePage.closeQuickPayDialog();

    await homePage.tapGiftCardTile();
    await expectNoPrompt();
    expect(await homePage.isSellGiftCardOpen(Timeouts.MEDIUM)).toBe(true);
    await homePage.closeSellGiftCard();

    await discardCreatedOrder();
    await setGates(ALL_ON);
  });

  it(
    title('TC-VP4815-17 Passcode Setting lists the four new rows and Save stores them', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      for (const gate of ['quick_checkout', 'gift_card_sale', 'edit_service_price', 'calendar'] as const) {
        expect(await accessibilitySettingsPage.hasGate(gate)).toBe(true);
        expect(await accessibilitySettingsPage.isGateOn(gate)).toBe(true);
      }
      const stored = await storedGates();
      for (const gate of VP4815_GATES) expect(stored[gate]).toBe(true);
      await returnToHome();
    },
  );

  /* ------------------------------------------------------------------- *
   * Customer Status
   * ------------------------------------------------------------------- */

  it(
    title('TC-VP4815-18 Customer field on the order shows the status badge from v_customer_type', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      const [vip] = await customersWhere({ phone: { eq: vp4815.vipPhone } });
      if (!vip) this.skip();
      const want = expectedLabel((await customerTypes([vip.id]))[vip.id]);

      await startEmptyCart();
      await homePage.typeCustomerSearch(vp4815.vipPhone);
      await homePage.tapCustomerSearchResult(vp4815.vipPhone);
      if (await passcodeDialog.isPrompting(Timeouts.SHORT)) await passcodeDialog.enter(vp4815.owner);
      expect(await homePage.hasActiveDraft(Timeouts.MEDIUM)).toBe(true);

      const badges = await visibleStatusBadges();
      if (want) expect(badges).toContain(want);
      else expect(badges).toHaveLength(0);
    },
  );

  it(title('TC-VP4815-20 Customer Information shows the same badge', ...TAGS), async function () {
    this.timeout(Timeouts.MOCHA_HOOK);
    const [vip] = await customersWhere({ phone: { eq: vp4815.vipPhone } });
    const want = expectedLabel((await customerTypes([vip!.id]))[vip!.id]);

    await homePage.openCustomerInformation();
    const badges = await visibleStatusBadges('Customer Information');
    if (want) expect(badges).toContain(want);
    else expect(badges).toHaveLength(0);
    await homePage.closeCustomerInformation();
    await discardCreatedOrder();
  });

  it(
    title('TC-VP4815-19 Customer search rows: each badge matches its type; normal shows none', ...TAGS),
    async function () {
      this.timeout(Timeouts.MOCHA_HOOK);
      for (const name of [vp4815.searchName, vp4815.atRiskName]) {
        const customers = await customersNamed(name);
        const types = await customerTypes(customers.map((c) => c.id));

        await startEmptyCart();
        await homePage.typeCustomerSearch(name);
        const rows = await customersFoundRows();
        expect(rows.length).toBeGreaterThan(0);

        const mismatches: string[] = [];
        for (const row of rows) {
          const last4 = row.phone.slice(-4);
          // The same name + phone can exist twice (a booking record and a walk-in
          // one), each with its own type — a row is right if it matches ANY of them.
          const matches = customers.filter(
            (c) => (c.name ?? '').trim() === row.name && (c.phone ?? '').endsWith(last4),
          );
          if (matches.length === 0) continue;
          const wants = matches.map((c) => expectedLabel(types[c.id]));
          if (!wants.includes(row.badge))
            mismatches.push(
              `${row.name} …${last4}: want ${wants.map((w) => w ?? 'none').join(' | ')}, got ${row.badge ?? 'none'}`,
            );
        }
        expect(mismatches).toEqual([]);
        await returnToHome();
      }
    },
  );

  it(title('TC-VP4815-21 Order History Detail shows the customer badge', ...TAGS), async function () {
    this.timeout(Timeouts.MOCHA_HOOK);
    const [customer] = (await customersNamed(vp4815.historyCustomer)).filter(
      (c) => (c.name ?? '').trim() === vp4815.historyCustomer,
    );
    if (!customer) this.skip();
    const want = expectedLabel((await customerTypes([customer.id]))[customer.id]);

    await goToOrderHistory();
    await orderHistoryPage.search(vp4815.historyCustomer);
    const id = await orderHistoryPage.waitForRows(1).then(() => orderHistoryPage.firstOrderId());
    if (!id) this.skip();
    await orderHistoryPage.openOrder(id);
    const badges = await visibleStatusBadges();
    if (want) expect(badges).toContain(want);
    else expect(badges).toHaveLength(0);
    await orderHistoryPage.clearSearch();
    await returnToHome();
    await clearPasscodeGrant();
  });
});
