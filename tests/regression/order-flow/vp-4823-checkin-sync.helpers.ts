/**
 * VP-4823 helpers — where did a GoCheckin kiosk check-in go missing?
 *
 * NOT a spec. Two independent reads of the same question, so a miss can be
 * pinned to a layer the way the ticket asks ("server never got it" / "no order
 * created" / "order exists but is not shown"):
 *
 * - {@link pendingCheckinRows} — POS's own GraphQL (`orderList`, status pending,
 *   with the customer phone and the check-in). A row here means the order
 *   reached the till's database.
 * - {@link collectPendingText} — the Pending Orders screen as a cashier sees it,
 *   scrolled end to end (the list virtualises past ~30 cards).
 *
 * Read-only.
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { gql } from '../../../src/api/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { VpPendingOrders } from '../../../src/constants/testids.vp-loyalty-pending.js';
import { goTo } from '../../../src/helpers/navigate.js';
import { settle } from '../../../src/helpers/wait.js';
import type { CheckinHandoff } from '../../../src/pages/web/CheckinKioskPage.js';

/** How many pending orders to pull — a 100-check-in batch plus the till's own backlog. */
const PENDING_LIMIT = 500;

const PENDING_WITH_CUSTOMER = `
  query vp4823PendingCheckins($limit: Int) {
    orderList(where: { status: { eq: "pending" } }, orderBy: [{ createdAt: desc }], limit: $limit) {
      id
      orderCode
      createdAt
      customerCheckinId
      customer {
        name
        phone
      }
      customerCheckin {
        id
        status
        checkinAt
      }
    }
  }
`;

interface PendingResponse {
  orderList: Array<{
    id: string;
    orderCode: string;
    createdAt: string | null;
    customerCheckinId: string | null;
    customer: { name: string | null; phone: string | null } | null;
    customerCheckin: { id: string; status: string | null; checkinAt: string | null } | null;
  }>;
}

export interface PendingCheckinRow {
  id: string;
  orderCode: string;
  phone: string;
  name: string;
  checkinStatus: string | null;
  checkinAt: string | null;
}

const digits = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '');

/** Every pending order on the till that carries a customer, newest first. */
export async function pendingCheckinRows(): Promise<PendingCheckinRow[]> {
  const data = await gql().query<PendingResponse>(PENDING_WITH_CUSTOMER, {
    operationName: 'vp4823PendingCheckins',
    variables: { limit: PENDING_LIMIT },
  });
  return data.orderList
    .filter((o) => digits(o.customer?.phone) !== '')
    .map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      phone: digits(o.customer?.phone),
      name: o.customer?.name ?? '',
      checkinStatus: o.customerCheckin?.status ?? null,
      checkinAt: o.customerCheckin?.checkinAt ?? null,
    }));
}

/** Pending rows for one kiosk check-in, matched by full phone. */
export const rowsFor = (rows: readonly PendingCheckinRow[], c: CheckinHandoff): PendingCheckinRow[] =>
  rows.filter((r) => r.phone === digits(c.phone));

/** Scroll every scrollable element on Pending Orders top→bottom, collecting innerText. */
export async function collectPendingText(): Promise<string> {
  await goTo(Routes.ORDER_PENDING).catch(() => undefined);
  await settle(Timeouts.ANIMATION);
  const chunks: string[] = [];
  for (let i = 0; i < 80; i += 1) {
    const { text, atEnd } = await browser.execute((n: number) => {
      const scrollers = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
        (el) => el.scrollHeight > el.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      let end = true;
      for (const el of scrollers) {
        if (n === 0) el.scrollTop = 0;
        else el.scrollTop += el.clientHeight * 0.8;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 4) end = false;
      }
      return { text: document.body.innerText, atEnd: end };
    }, i);
    chunks.push(text);
    if (atEnd && i > 0) break;
    await settle(250);
  }
  return chunks.join('\n').toLowerCase();
}

/** A card shows only the first two words of the name and a masked phone. */
const nameKey = (name: string): string => name.split(' ').slice(0, 2).join(' ').toLowerCase();

/** Is this check-in visible in the collected Pending Orders text? */
export const listedOnScreen = (text: string, c: CheckinHandoff): boolean =>
  text.includes(nameKey(c.name)) || text.includes(VpPendingOrders.maskedPhone(c.last4).toLowerCase());

/**
 * Poll `check` until it holds or the sync window closes. Returns the last
 * value; the spec asserts on it so the failure lists what is missing.
 */
export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (v: T) => boolean,
  timeout: number = Timeouts.APP_BOOT,
  interval = 5_000,
): Promise<T> {
  let last = await read();
  if (done(last)) return last;
  await browser
    .waitUntil(
      async () => {
        last = await read();
        return done(last);
      },
      { timeout, interval },
    )
    .catch(() => undefined);
  return last;
}
