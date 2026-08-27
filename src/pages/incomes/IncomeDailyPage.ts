import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import {
  CHART_CARDS,
  IncomeDailyIps,
  statCard,
  statCardPercent,
  statCardValue,
  type ChartKey,
} from '../../constants/testids.incomes.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';

/** Unix SECONDS, which is what the route's zod schema expects (`dateToUnix` = `getUnixTime`). */
const unixSeconds = (date: Date): number => Math.floor(date.getTime() / 1_000);

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Daily Sale Report — `/incomes/income-daily`.
 *
 * ## The gate comes first
 *
 * This route is wrapped in `PermissionProtectedRoute`, and the report body does
 * not mount until the guard is satisfied — the heading paints behind the dialog,
 * so waiting for the heading proves nothing. {@link open} therefore navigates,
 * unlocks, and only then waits for a stat card, which is the first thing that
 * requires permission AND data.
 *
 * ## Why the date range goes through the URL
 *
 * `from` / `to` / `activeChart` are the route's real state — validated by zod in
 * `income-daily.schema.ts` — and the calendar popover is only one way to write
 * them. Driving the popover instead makes a spec depend on a DOM that changes
 * shape month to month, so it breaks in November for reasons unrelated to the
 * report. Specs that are testing the PICKER itself should of course click it;
 * everything else states the range it wants.
 *
 * ## Asserting against the schema, not against the screen
 *
 * Reading a total off a card and comparing it to another number on the same card
 * proves only that the card agrees with itself. Pair this page with
 * `ReportService` — it queries `vReportStoreDailyIncomeList`, the exact document
 * this screen renders from — and compare the two.
 */
export class IncomeDailyPage extends BasePage {
  readonly name = 'Daily Sale Report';
  readonly route = Routes.INCOME_DAILY;

  protected readonly readyAnchor: Locator = statCard('sale');

  /**
   * Navigate, unlock the passcode gate, and wait for the report to render.
   *
   * `date` defaults to today. Pass a range with {@link openRange}.
   */
  async open(date: Date = new Date(), activeChart: ChartKey = 'sale'): Promise<this> {
    return this.openRange(date, date, activeChart);
  }

  async openRange(from: Date, to: Date, activeChart: ChartKey = 'sale'): Promise<this> {
    await logStep(`Open ${this.name} for ${from.toDateString()} → ${to.toDateString()}`);

    await goTo(this.route, {
      search: {
        from: unixSeconds(startOfDay(from)),
        to: unixSeconds(endOfDay(to)),
        activeChart,
      },
    });

    // The guard is a no-op when a grant is already active — which is the point
    // of `unlockForRun`; it costs one probe rather than a dialog per screen.
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);

    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

  /**
   * Wait until the loading placeholders are gone.
   *
   * Separate from {@link waitForReady} on purpose: the cards mount with skeleton
   * children while the query is in flight, so a card being present is NOT the
   * same as its number being real. Reading too early yields a card whose value
   * text is empty and a `parseMoney()` failure that blames the selector.
   */
  async waitForDataSettled(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(IncomeDailyIps.skeleton, 300))) return;
      await settle(200);
    }
    this.log.warn(
      `${this.name}: loading skeletons were still on screen after ${String(timeout)}ms. ` +
        'Reading values now may pick up placeholder text.',
    );
  }

  /* --------------------------------------------------------------------- *
   * Statistics cards
   * --------------------------------------------------------------------- */

  /** The card's headline figure, in integer cents. */
  async cardCents(chart: ChartKey): Promise<number> {
    const text = await this.text(statCardValue(chart), { visible: true });
    try {
      return parseMoney(text);
    } catch (error) {
      throw new Error(
        `${this.name}: the "${CHART_CARDS[chart].en}" card read "${text}", which is not a single ` +
          'money amount. A card caught mid-load renders placeholder text; call ' +
          'waitForDataSettled() first.',
        { cause: error },
      );
    }
  }

  /**
   * The card's headline figure as a plain count.
   *
   * `totalOrder` is the only card whose value is not money, and running it
   * through `parseMoney` would reject the bare integer.
   */
  async cardCount(chart: ChartKey): Promise<number> {
    const text = await this.text(statCardValue(chart), { visible: true });
    const parsed = Number.parseInt(text.replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${this.name}: the "${CHART_CARDS[chart].en}" card read "${text}", not a count.`);
    }
    return parsed;
  }

  /** The "vs Yesterday" badge text, e.g. `68%`. Empty when the app renders none. */
  async cardPercentText(chart: ChartKey): Promise<string> {
    return this.text(statCardPercent(chart)).catch(() => '');
  }

  /**
   * Click a card and wait for the chart to follow.
   *
   * The URL is the source of truth for which chart is active — the app writes
   * `activeChart` on click — so that is what is waited on, rather than a class
   * on the card. A visual "selected" state can land a frame before the chart
   * re-renders, and asserting on it makes the next read racy.
   */
  async selectCard(chart: ChartKey): Promise<this> {
    await logStep(`${this.name}: select the ${CHART_CARDS[chart].en} card`);
    await this.click(statCard(chart));

    await browser.waitUntil(async () => (await this.activeChart()) === chart, {
      timeout: Timeouts.MEDIUM,
      interval: 150,
      timeoutMsg:
        `The URL never reported activeChart=${chart} after the card was clicked ` +
        `(still ${String(await this.activeChart())}).`,
    });
    return this;
  }

  /** Which chart the URL says is active. */
  async activeChart(): Promise<ChartKey | null> {
    const raw = await browser.getUrl();
    const value = new URL(raw).searchParams.get('activeChart');
    return value !== null && value in CHART_CARDS ? (value as ChartKey) : null;
  }

  /** Is the card visually marked as selected? Class-based, so weaker than {@link activeChart}. */
  async isCardSelected(chart: ChartKey): Promise<boolean> {
    const el = await this.find(statCard(chart));
    const classes = (await el.getAttribute('class')) ?? '';
    return classes.includes('border-primary') && classes.includes('bg-primary');
  }

  /** The chart label above the bar chart — reflects the active card. */
  async chartHeadingText(): Promise<string> {
    return this.text(IncomeDailyIps.chartHeading, { visible: true });
  }

  /* --------------------------------------------------------------------- *
   * Orders table
   * --------------------------------------------------------------------- */

  /** Every order code in the table, in display order. */
  async orderCodes(): Promise<string[]> {
    const rows = await this.findAll(IncomeDailyIps.orderRows, { timeout: Timeouts.SHORT });
    const codes: string[] = [];
    for (const row of rows) {
      const text = await row.getText();
      const match = /OD\d{6}(?:-\d+)?/.exec(text);
      if (match) codes.push(match[0]);
    }
    return codes;
  }

  async orderRowCount(): Promise<number> {
    return (await this.findAll(IncomeDailyIps.orderRows, { timeout: Timeouts.SHORT })).length;
  }

  /**
   * Open one order's detail dialog.
   *
   * Waits for `orderId` to appear in the URL as well as for the dialog: the app
   * writes it so the dialog survives a reload, and it is the only signal that
   * the dialog belongs to the row that was clicked rather than a previous one
   * still fading out.
   */
  async openOrderDetail(orderCode: string): Promise<void> {
    await logStep(`${this.name}: open order ${orderCode}`);
    const rows = await this.findAll(IncomeDailyIps.orderRows, { timeout: Timeouts.SHORT });

    for (const row of rows) {
      if ((await row.getText()).includes(orderCode)) {
        await row.click();
        await browser.waitUntil(async () => (await browser.getUrl()).includes('orderId='), {
          timeout: Timeouts.MEDIUM,
          interval: 150,
          timeoutMsg: `Clicking order ${orderCode} never put orderId in the URL.`,
        });
        await this.find(IncomeDailyIps.orderDetailDialog, { visible: true });
        return;
      }
    }

    throw new Error(
      `${this.name}: no row for order ${orderCode}. The table holds: ` +
        `${(await this.orderCodes()).join(', ') || '(no rows)'}.`,
    );
  }

  /** Close the order-detail dialog with Escape. */
  async closeOrderDetail(): Promise<void> {
    await browser.keys(['Escape']);
    await this.waitGone(IncomeDailyIps.orderDetailDialog, Timeouts.SHORT);
  }
}

export default new IncomeDailyPage();
