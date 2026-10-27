import fs from 'node:fs';
import { browser } from '@wdio/globals';
import { checkinKioskPage, CHECKIN_DAILY_LIMIT_ERROR } from '../../src/pages/web/CheckinKioskPage.js';
import { appendCheckinBulk, readCheckinBulk, CHECKIN_BULK_FILE } from '../../src/pages/web/checkinHandoff.js';

/**
 * WEB-03 — bulk GoCheckin load: create `CHECKIN_COUNT` (default 100) kiosk
 * check-ins in one Edge session, each a fresh customer with a service picked,
 * so every one lands on the Volt POS Home as a PENDING ORDER.
 *
 * Resumable by design: each committed check-in is appended to
 * `.tmp/web-checkin-bulk.json` at once, and the loop only tops the file up to
 * `CHECKIN_COUNT`. A crash at #63 therefore continues from 63 on the next run
 * instead of minting duplicates. `CHECKIN_BULK_RESET=1` starts a new batch.
 *
 * ONE test with an in-body loop, not one `it` per check-in: mocha's timeout
 * does not cancel a slow body, so per-slot tests overlapped two wizards in the
 * same browser (duplicates) or burned slots waiting on each other. The loop
 * retries a failed walk after reopening the kiosk and gives up only after
 * `MAX_CONSECUTIVE_FAILURES` in a row. The npm script raises the mocha timeout
 * (`MOCHA_TIMEOUT`) to cover the whole batch.
 *
 * Run: `npm run web:checkin-bulk`, then `npm run test:checkin-bulk-to-pos`.
 */
if (process.env.CHECKIN_BULK_RESET === '1' && fs.existsSync(CHECKIN_BULK_FILE)) {
  fs.rmSync(CHECKIN_BULK_FILE);
}

const TARGET = Number(process.env.CHECKIN_COUNT ?? 100);
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Identity scheme, shaped by what the app can actually show: a Home/Pending card
 * renders only the first TWO words of the name and masks the phone to its last
 * four digits (`***-***-0042`). So the two name words must carry the key
 * (`Bulk042 T12345`) and the phone ends in `0<seq>` — unique last4 within a
 * batch, while the 5-digit batch stamp keeps phones fresh across batches.
 * A resumed batch keeps its stamp (read back from the file) so names stay uniform.
 */
const BATCH = (() => {
  const prior = readCheckinBulk()[0]?.name.match(/ T(\d{5})$/)?.[1];
  return prior ?? Date.now().toString().slice(-5);
})();

// The shared app glob (`tests/**/*.spec.ts`) also matches this file, and nobody
// wants 100 live check-ins as a side effect of `test:dev` — opt in explicitly.
const ENABLED = process.env.CHECKIN_BULK === '1';

(ENABLED ? describe : describe.skip)(`WEB-03 bulk check-ins on GoCheckin kiosk (target ${TARGET})`, () => {
  it(`creates ${TARGET} check-ins`, async () => {
    let needsReopen = true;
    let failuresInRow = 0;
    let totalFailures = 0;

    /* eslint-disable no-console */
    while (readCheckinBulk().length < TARGET) {
      const seq = String(readCheckinBulk().length + 1).padStart(3, '0');
      try {
        if (needsReopen) {
          await checkinKioskPage.login();
          await checkinKioskPage.openKiosk();
          needsReopen = false;
        }
        const handoff = await checkinKioskPage.createCheckin({
          phone: `8${BATCH}0${seq}`,
          name: `Bulk${seq} T${BATCH}`,
        });
        handoff.createdAtLabel = new Date().toISOString();
        appendCheckinBulk(handoff);
        failuresInRow = 0;
        console.log(`[WEB-03] #${seq} ${handoff.name} ${handoff.phone}`);
      } catch (error) {
        failuresInRow += 1;
        totalFailures += 1;
        needsReopen = true;
        console.log(
          `[WEB-03] #${seq} attempt failed (${failuresInRow} in a row): ${String(error).slice(0, 200)}`,
        );
        if (failuresInRow >= MAX_CONSECUTIVE_FAILURES) throw error;
        // The store's daily cap will not lift by retrying — stop the batch now.
        if (String(error).includes(CHECKIN_DAILY_LIMIT_ERROR)) throw error;
        // A frozen Edge tab times out every later command too (even navigate), and
        // a wedged GAP shell can hide the mini-app grid on every reopen — retrying
        // in the same session just repeats it, so start a fresh one.
        if (failuresInRow >= 2 || /timed out after/i.test(String(error))) {
          await browser.reloadSession().catch(() => undefined);
        }
      }
    }
    console.log(`[WEB-03] DONE ${readCheckinBulk().length}/${TARGET} (retried failures: ${totalFailures})`);
    /* eslint-enable no-console */
  });
});
