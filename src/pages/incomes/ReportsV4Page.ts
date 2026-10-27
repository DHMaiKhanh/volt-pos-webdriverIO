import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { Routes } from '../../constants/routes.js';
import {
  ReportChromeIds,
  ReportsV4Ids,
  tableRowCell,
  V4_ROUTE_PREFIX,
  V4Labels,
  v4Heading,
  type Bilingual,
  type V4Slug,
} from '../../constants/testids.reports-v4.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { ReportBasePage } from './ReportBasePage.js';
import {
  cardValueText,
  countOf,
  findTable,
  isCountText,
  labelMoneyPairs,
  linesAfter,
  moneyCents,
  visibleLines,
  type ReportTable,
} from './reportDom.js';

/** One staff row of Staff Income / Staff Payroll (V1 and V4 share the shape). */
export interface StaffReportRow {
  name: string;
  orders: number;
  subtotalCents: number;
  supplyFeeCents: number;
  tipCents: number;
  totalIncomeCents: number;
}

/** One order row of the DSR V4 orders table. */
export interface OrderReportRow {
  orderCode: string;
  saleCents: number;
  tipCents: number;
  taxCents: number;
  totalCents: number;
}

/** One period row of an Income Summary table (V1 and V4). */
export interface IncomePeriodRow {
  date: string;
  saleCents: number;
  tipCents: number;
  taxCents: number;
  totalPaymentCents: number;
}

/**
 * Shared reads for the card-and-table report screens. Parameterised by route
 * so the V4 reports and their V1 counterparts (used for V1↔V4 parity) share
 * one implementation; each instance still owns exactly one route.
 */
abstract class CardTableReportPage extends ReportBasePage {
  protected readonly readyAnchor: Locator = ReportChromeIds.presetCombobox;

  /** Every visible text line of the screen, in document order. */
  async lines(): Promise<string[]> {
    return visibleLines();
  }

  /** A card's raw value text, or `null` when the card is not rendered. */
  async cardText(title: Bilingual): Promise<string | null> {
    return cardValueText(await this.lines(), title);
  }

  /** A money card in cents. Throws with the screen text when unreadable. */
  async cardCents(title: Bilingual): Promise<number> {
    const text = await this.cardText(title);
    if (text === null || isCountText(text)) {
      throw new Error(
        `${this.name}: the "${title[0]}" card is missing or not money (read ${JSON.stringify(text)}).`,
      );
    }
    return moneyCents(text);
  }

  /** A count card (Total Order, Total staff, …). Throws when unreadable. */
  async cardCount(title: Bilingual): Promise<number> {
    const text = await this.cardText(title);
    if (text === null) throw new Error(`${this.name}: the "${title[0]}" card is not on screen.`);
    return countOf(text);
  }

  /** The lines right after a card title (description, value, %, "vs Yesterday"). */
  async cardTrailingLines(title: Bilingual, lookahead = 5): Promise<string[]> {
    return linesAfter(await this.lines(), title, lookahead);
  }

  async table(marker: Bilingual): Promise<ReportTable | null> {
    return findTable(marker);
  }

  /** Staff Income / Payroll rows. The name cell carries an avatar initial line first — the name is its LAST line. */
  async staffRows(): Promise<StaffReportRow[]> {
    const table = await findTable(V4Labels.supplyFeeHead);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 6)
      .map((cells) => {
        const [nameCell, orders, subtotal, supply, tip, income] = cells as [
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        const nameLines = nameCell.split('\n');
        return {
          name: nameLines[nameLines.length - 1] ?? '',
          orders: countOf(orders),
          subtotalCents: moneyCents(subtotal),
          supplyFeeCents: moneyCents(supply),
          tipCents: moneyCents(tip),
          totalIncomeCents: moneyCents(income),
        };
      });
  }

  /** Income Summary period rows (Date / Sale / Tip / Tax / Total Payment). */
  async incomePeriodRows(): Promise<IncomePeriodRow[]> {
    const table = await findTable(V4Labels.totalPayment);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 5)
      .map((cells) => {
        const [date, sale, tip, tax, total] = cells as [string, string, string, string, string];
        return {
          date: date.replace(/\s+/g, ' '),
          saleCents: moneyCents(sale),
          tipCents: moneyCents(tip),
          taxCents: moneyCents(tax),
          totalPaymentCents: moneyCents(total),
        };
      });
  }

  async search(text: string): Promise<this> {
    await logStep(`${this.name}: search "${text}"`);
    await this.setValue(ReportsV4Ids.search, text);
    await settle(Timeouts.DEBOUNCE);
    await this.waitForDataSettled();
    return this;
  }

  async clearSearch(): Promise<this> {
    const el = await this.find(ReportsV4Ids.search, { visible: true });
    await el.clearValue();
    // React only sees an emptied controlled input through a key event.
    await el.addValue(' ');
    await browser.keys(['Backspace']);
    await settle(Timeouts.DEBOUNCE);
    await this.waitForDataSettled();
    return this;
  }

  async isNoIncomeSwitchOn(): Promise<boolean> {
    const el = await this.find(ReportsV4Ids.noIncomeSwitch, { visible: true, timeout: Timeouts.SHORT });
    const state = await el.getAttribute('data-state');
    if (state !== null) return state === 'checked';
    return (await el.getAttribute('aria-checked')) === 'true';
  }

  async toggleNoIncomeSwitch(): Promise<this> {
    await logStep(`${this.name}: toggle "Show staff with no income"`);
    await this.click(ReportsV4Ids.noIncomeSwitch);
    await this.waitForDataSettled();
    return this;
  }

  async url(): Promise<string> {
    return browser.getUrl();
  }

  /** The period combobox text (Staff Payroll) — the first combobox on the screen. */
  async firstComboboxText(): Promise<string> {
    return this.text(ReportChromeIds.presetCombobox, { visible: true });
  }
}

/**
 * Reports V4 — `/report-pages/v4/<slug>`.
 *
 * One page object for the four V4 reports; {@link open} takes the slug. Each
 * report carries a "V4" badge beside its title, which is the readiness anchor
 * (the V1 copies at `/report-pages/<slug>` have none).
 *
 * The reports are reached from the ☰ drawer's "Reports V4" group (collapsed by
 * default) or by direct route; {@link expandMenuGroup} / {@link menuHrefs}
 * read the drawer once the SPEC has opened it through `appNav`.
 */
export class ReportsV4Page extends CardTableReportPage {
  readonly name = 'Reports V4';
  readonly route = V4_ROUTE_PREFIX.replace(/\/$/, '');

  protected override readonly readyAnchor: Locator = ReportsV4Ids.v4Badge;

  async open(slug: V4Slug): Promise<this> {
    await logStep(`Open ${this.name}: ${slug}`);
    await goTo(`${V4_ROUTE_PREFIX}${slug}`);
    // No-op when no guard prompts — costs one short probe.
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.find(v4Heading(slug), { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitForDataSettled();
    return this;
  }

  async hasV4Badge(): Promise<boolean> {
    return this.isVisible(ReportsV4Ids.v4Badge, Timeouts.SHORT);
  }

  async isHeadingVisible(slug: V4Slug): Promise<boolean> {
    return this.isVisible(v4Heading(slug), Timeouts.SHORT);
  }

  /* ---------------- drawer (opened by the spec via appNav) ---------------- */

  /** Expand the drawer's "Reports V4" group unless its links are already shown. */
  async expandMenuGroup(): Promise<this> {
    if (await this.isVisible(ReportsV4Ids.menuLinks, 800)) return this;
    await logStep(`${this.name}: expand the drawer group`);
    await this.click(ReportsV4Ids.menuGroup);
    await this.find(ReportsV4Ids.menuLinks, { visible: true, timeout: Timeouts.SHORT }).catch(
      () => undefined,
    );
    return this;
  }

  /** Every V4 link href in the open drawer. */
  async menuHrefs(): Promise<string[]> {
    const links = await this.findAll(ReportsV4Ids.menuLinks, { timeout: Timeouts.SHORT });
    const hrefs: string[] = [];
    for (const link of links) {
      if (!(await link.isDisplayed())) continue;
      const href = await link.getAttribute('href');
      if (href !== null) hrefs.push(new URL(href, 'http://x').pathname);
    }
    return hrefs;
  }

  /* ---------------- Daily Sale Report ---------------- */

  /** DSR orders table rows that carry an order code (empty-state rows excluded). */
  async orderRows(): Promise<OrderReportRow[]> {
    const table = await findTable(V4Labels.orderNumberHead);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 5 && /OD\d{6}/.test(cells[0] ?? ''))
      .map((cells) => {
        const [code, sale, tip, tax, total] = cells as [string, string, string, string, string];
        return {
          orderCode: code.trim(),
          saleCents: moneyCents(sale),
          tipCents: moneyCents(tip),
          taxCents: moneyCents(tax),
          totalCents: moneyCents(total),
        };
      });
  }

  /**
   * "Gift Card Redemption" from the DSR Payment Details block, in cents. Opens
   * the Payment Details tab when the value is not already on screen; `null` if
   * it still cannot be found.
   */
  async giftCardRedemptionCents(): Promise<number | null> {
    const find = async (): Promise<number | null> => {
      const hit = labelMoneyPairs(await this.lines()).find((p) =>
        (V4Labels.giftCardRedemption as readonly string[]).includes(p.label),
      );
      return hit ? moneyCents(hit.text) : null;
    };
    const first = await find();
    if (first !== null) return first;
    if (await this.isVisible(ReportsV4Ids.paymentDetailsTab, 1_000)) {
      await this.click(ReportsV4Ids.paymentDetailsTab);
      await this.waitForDataSettled();
      return find();
    }
    return null;
  }

  /* ---------------- Income Summary ---------------- */

  /** Click the N-th period row of the Income Summary table. */
  async openIncomeRow(n = 1): Promise<this> {
    await logStep(`${this.name}: open income row ${String(n)}`);
    await this.click(tableRowCell(V4Labels.totalPayment, n));
    await this.waitGone(ReportsV4Ids.noDetail, Timeouts.MEDIUM).catch(() => undefined);
    await this.waitForDataSettled();
    return this;
  }

  /** Visible text after the Income Summary table — its detail panel. */
  async incomeDetailLines(): Promise<string[]> {
    return visibleLines({ afterTableWithHead: V4Labels.totalPayment });
  }

  /* ---------------- Staff Payroll ---------------- */

  /** Wait (bounded) for the app to write `period_id` into the URL; returns the URL either way. */
  async waitForPeriodIdInUrl(timeout: number = Timeouts.MEDIUM): Promise<string> {
    await browser
      .waitUntil(async () => (await browser.getUrl()).includes('period_id='), { timeout, interval: 200 })
      .catch(() => undefined);
    return browser.getUrl();
  }
}

/**
 * A V1 report at a fixed route (`/incomes/income-staff`, `/incomes/staff-payroll`),
 * used only as the comparison side of V1↔V4 parity checks. Owner passcode gated.
 */
export class LegacyReportPage extends CardTableReportPage {
  constructor(
    readonly name: string,
    readonly route: string,
  ) {
    super();
  }

  async open(): Promise<this> {
    await logStep(`Open ${this.name}`);
    await goTo(this.route);
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }
}

export const legacyStaffIncomeReport = new LegacyReportPage('Staff Income (V1)', Routes.INCOME_STAFF);
export const legacyStaffPayrollReport = new LegacyReportPage('Staff Payroll (V1)', Routes.STAFF_PAYROLL);

export default new ReportsV4Page();
