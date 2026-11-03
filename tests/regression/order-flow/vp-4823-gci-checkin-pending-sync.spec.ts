/**
 * VP-4823 — [Tiệm 14] a GoCheckin kiosk check-in succeeds but never becomes a
 * pending order on Volt POS (1 of 18 lost: Bulk017 T76605, 876-605-0017).
 *
 * docs/qc/volt-qc/vp-tickets/VP-4823-gci-checkin-pending-sync-test-cases.md (TC-VP4823-01..09)
 *
 * ## How to run it
 *
 * Two halves, like the other GoCheckin cross-surface specs. The web lane makes
 * the check-ins and leaves their keys in `.tmp/`; this file only reads.
 *
 *   CHECKIN_COUNT=18 npm run web:checkin-bulk     # TC-01..03 (CHECKIN_COUNT=100 for TC-05)
 *   npm run web:checkin                           # TC-04
 *   npm run test:attach -- --spec tests/regression/order-flow/vp-4823-gci-checkin-pending-sync.spec.ts
 *
 * No handoff → the case skips. The app must be signed into the store the kiosk
 * checked in on (`MERCHANT_ID` = `WEB_MERCHANT_ID`), otherwise nothing can sync
 * and every case skips.
 *
 * ## What is asserted
 *
 * Each kiosk check-in is looked for twice — in POS's database (GraphQL
 * `orderList` pending + customer phone + active check-in) and on the Pending
 * Orders screen — so a miss names its layer: absent from both = never reached
 * the till; in the data but not on screen = filtered by the UI.
 *
 * READ-ONLY on the app.
 */

import { expect } from '@wdio/globals';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { orderPendingPage } from '../../../src/pages/index.js';
import type { CheckinHandoff } from '../../../src/pages/web/CheckinKioskPage.js';
import { readCheckinBulk, readCheckinHandoff } from '../../../src/pages/web/checkinHandoff.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import {
  collectPendingText,
  listedOnScreen,
  pendingCheckinRows,
  pollUntil,
  rowsFor,
  type PendingCheckinRow,
} from './vp-4823-checkin-sync.helpers.js';

const log = moduleLogger('vp-4823');
const env = loadEnv();

/** The batch size the ticket reproduced with, and the follow-up load batch. */
const TICKET_BATCH = 18;
const LOAD_BATCH = 100;

const label = (c: CheckinHandoff): string => `${c.name} ${c.phone} (${c.createdAtLabel ?? '?'})`;

function requireSameStore(ctx: Mocha.Context): void {
  if (env.MERCHANT_ID !== env.WEB_MERCHANT_ID) {
    log.info(`SKIP — app MERCHANT_ID=${env.MERCHANT_ID} ≠ kiosk store ${env.WEB_MERCHANT_ID}; cannot sync`);
    ctx.skip();
  }
}

/** The bulk batch, or skip when it is smaller than `min`. */
function requireBatch(ctx: Mocha.Context, min: number): CheckinHandoff[] {
  const batch = readCheckinBulk();
  if (batch.length < min) {
    log.info(
      `SKIP — .tmp/web-checkin-bulk.json has ${String(batch.length)} check-ins, needs ≥ ${String(min)} ` +
        `(run \`CHECKIN_COUNT=${String(min)} CHECKIN_BULK_RESET=1 npm run web:checkin-bulk\`)`,
    );
    ctx.skip();
  }
  return batch;
}

/** Check-ins of `batch` with no pending order in POS data, polled across the sync window. */
async function missingInData(batch: readonly CheckinHandoff[]): Promise<CheckinHandoff[]> {
  const missing = (rows: PendingCheckinRow[]): CheckinHandoff[] =>
    batch.filter((c) => !rowsFor(rows, c).some((r) => r.checkinStatus === 'active'));
  const rows = await pollUntil(pendingCheckinRows, (r) => missing(r).length === 0);
  return missing(rows);
}

/** Check-ins of `batch` not visible on the Pending Orders screen, polled across the sync window. */
async function missingOnScreen(batch: readonly CheckinHandoff[]): Promise<CheckinHandoff[]> {
  const missing = (text: string): CheckinHandoff[] => batch.filter((c) => !listedOnScreen(text, c));
  const text = await pollUntil(collectPendingText, (t) => {
    const n = missing(t).length;
    log.info(`found ${String(batch.length - n)}/${String(batch.length)} on /order-pending`);
    return n === 0;
  });
  return missing(text);
}

describe('VP-4823 — GoCheckin kiosk check-in → Volt POS Pending Orders', () => {
  before(async () => {
    await returnToHome();
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  describe('1. Bulk check-ins (ticket repro: 18 in a row)', () => {
    it(
      title(
        `TC-VP4823-01: every check-in of a ${String(TICKET_BATCH)}-check-in kiosk batch shows on Pending Orders`,
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.SLOW,
      ),
      async function () {
        requireSameStore(this);
        const batch = requireBatch(this, TICKET_BATCH);
        const missing = await step('Scan Pending Orders for every check-in', () => missingOnScreen(batch));
        for (const c of missing) log.info(`MISSING on screen: ${label(c)}`);
        expect(missing.map(label)).toEqual([]);
      },
    );

    it(
      title(
        'TC-VP4823-02: every check-in of the batch has a pending order with an ACTIVE check-in in POS data',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.SLOW,
      ),
      async function () {
        requireSameStore(this);
        const batch = requireBatch(this, TICKET_BATCH);
        const missing = await step('Look every check-in up in POS orderList', () => missingInData(batch));
        for (const c of missing) log.info(`MISSING in POS data (never reached the till?): ${label(c)}`);
        expect(missing.map(label)).toEqual([]);
      },
    );

    it(
      title('TC-VP4823-03: each kiosk check-in becomes exactly ONE pending order', Tag.REGRESSION),
      async function () {
        requireSameStore(this);
        const batch = requireBatch(this, TICKET_BATCH);
        const rows = await pendingCheckinRows();
        const counts = batch.map((c) => ({ c, n: rowsFor(rows, c).length }));
        const duplicated = counts.filter(({ n }) => n > 1).map(({ c, n }) => `${label(c)} ×${String(n)}`);
        expect(duplicated).toEqual([]);
      },
    );
  });

  describe('2. One check-in, end to end', () => {
    it(
      title(
        'TC-VP4823-04: a single kiosk check-in syncs as a pending card with the name and masked phone',
        Tag.REGRESSION,
      ),
      async function () {
        requireSameStore(this);
        const handoff = readCheckinHandoff();
        if (!handoff) {
          log.info('SKIP — no .tmp/web-checkin-handoff.json; run `npm run web:checkin` first');
          this.skip();
          return;
        }
        const rows = await step(`Wait for ${handoff.phone}'s pending order in POS data`, () =>
          pollUntil(pendingCheckinRows, (r) => rowsFor(r, handoff).length > 0),
        );
        const row = rowsFor(rows, handoff)[0];
        expect(row).toBeDefined();
        if (!row) return;
        expect(row.checkinStatus).toBe('active');

        await orderPendingPage.open();
        await orderPendingPage.search(row.orderCode);
        expect(await orderPendingPage.isOrderListed(row.orderCode)).toBe(true);
        const card = (await orderPendingPage.cardText(row.orderCode)) ?? '';
        expect(card).toContain(`***-***-${handoff.last4}`);
        expect(card.toLowerCase()).toContain(handoff.name.split(' ')[0]?.toLowerCase() ?? '');
        await orderPendingPage.clearSearch();
      },
    );
  });

  describe('3. Load batch (follow-up in the ticket)', () => {
    it(
      title(
        `TC-VP4823-05: a ${String(LOAD_BATCH)}-check-in batch loses none (POS data and screen)`,
        Tag.REGRESSION,
        Tag.SLOW,
      ),
      async function () {
        requireSameStore(this);
        const batch = requireBatch(this, LOAD_BATCH);
        const inData = await step('Look every check-in up in POS orderList', () => missingInData(batch));
        const onScreen = await step('Scan Pending Orders for every check-in', () => missingOnScreen(batch));
        log.info(
          `RESULT total=${String(batch.length)} missingData=${String(inData.length)} ` +
            `missingScreen=${String(onScreen.length)}`,
        );
        expect({ data: inData.map(label), screen: onScreen.map(label) }).toEqual({ data: [], screen: [] });
      },
    );
  });

  describe('4. Not automatable here', () => {
    it(
      title(
        'TC-VP4823-06: kiosk reports an error when the submit is dropped — PENDING ' +
          '(kiosk / backend side; the drop cannot be provoked from POS)',
      ),
    );

    it(
      title(
        'TC-VP4823-07: backend lookup of the lost phone 8766050017 (received? order created? synced?) — PENDING ' +
          '(BE-only: GAP / volt-pos-api logs)',
      ),
    );

    it(
      title(
        'TC-VP4823-08: the batch is still complete after reopening Volt POS — PENDING ' +
          '(needs an app restart, not allowed on the shared attach till)',
      ),
    );

    it(
      title(
        'TC-VP4823-09: POS and the kiosk must be the same store for sync — PENDING ' +
          '(doc-only precondition; enforced by the MERCHANT_ID = WEB_MERCHANT_ID gate)',
      ),
    );
  });
});
