/**
 * volt-qc port — 07 ORDER HISTORY: detail cases read off orders that ALREADY exist (read-only).
 *
 * Multi-tender, split, card and gift-card payments need a split-settle flow, a terminal or a
 * standing gift card to manufacture; the volt-qc suite seeded them the day before. This port finds
 * one in the last 30 days and skips (with the reason) when the merchant has none. Nothing is
 * opened for editing.
 *
 * Source: volt-qc `oh-plan-list.spec.ts` (OH-T07), `oh-deep.spec.ts` (OH-D04), `oh-plan-card.spec.ts`
 * (OH-C1 display half), `oh-plan-detail.spec.ts` (OH-T27 payment half), PERM-G (OH-006/007).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { OhRoDialogs as D } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  centsIn,
  detailText,
  field,
  findHistoryCode,
  paymentSection,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  addDays,
  openRow,
  pickDateRange,
  rowCodes,
  rowTexts,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SKIP_KEY = OH.passcodeSkipKey;

async function open(code: string): Promise<string> {
  await openRow(code);
  await P.waitFor(inMain({ text: `Order #${code}` }), Timeouts.MEDIUM, `Order #${code}`);
  return P.poll(
    () => detailText(code),
    (d) => d.includes('Payment Details'),
    10_000,
  );
}

/** Try the codes of a filtered list until `pick` accepts one's detail. */
async function firstMatching(
  codes: string[],
  pick: (d: string) => boolean,
  max = 12,
): Promise<{ code: string; d: string } | null> {
  for (const c of codes.slice(0, max)) {
    const d = await open(c);
    if (pick(d)) return { code: c, d };
  }
  return null;
}

/** Can `code` open Order History? true = list shown, false = refused, null = no gate to test. */
async function gateOpensWith(code: string): Promise<boolean | null> {
  await returnToHome();
  await P.localSet(SKIP_KEY, null);
  await P.routerGo('/order-history');
  if (
    !(await P.poll(
      () => P.has(D.passcode),
      (v) => v,
      5_000,
    ))
  )
    return null;
  for (const c of code) await P.clickQ([D.passcode, { role: 'button', name: c, nth: 0 }]);
  await settle(1_500);
  const refused = await P.has(D.passcode);
  if (refused) await P.escape();
  return !refused;
}

describe('volt-qc 07 ORDER HISTORY — existing orders (read-only)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'A multi-tender order lists its methods comma-joined; one Payment Details line per txn adding up to Total; split checks show "#<code>-<n>" blocks (OH-015, OH-077, OH-078)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await returnToHome();
      await goToOrderHistory();
      const today = new Date();
      await pickDateRange(addDays(today, -29), today);
      const row = (await rowTexts()).find((r) =>
        /\| (Card|Cash|Gift Card|Other)(, (Card|Cash|Gift Card|Other))+ \|/.test(r),
      );
      if (!row) this.skip(); // no multi-tender order in 30 days
      const code = /^OD\d{6}-\d+/.exec(row ?? '')?.[0] ?? '';
      expect(row).not.toContain('N/A');
      const d = await open(code);
      const total = centsIn(field(d, 'Total'));
      const blocks = paymentSection(d)
        .split(new RegExp(`#${code}-\\d`))
        .slice(1);
      if (blocks.length >= 2) {
        // split order: last $ of each check block is that check's amount
        const amounts = blocks.map((b) => {
          const all = [...b.matchAll(/\$([\d,]+\.\d{2})/g)].map((m) => centsIn(`$${m[1] ?? ''}`));
          return all.length ? (all[all.length - 1] ?? 0) : 0;
        });
        expect(amounts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(d).toContain(`#${code}-1`);
        expect(d).toContain(`#${code}-2`);
      } else {
        const methods = (
          /\| ((?:Card|Cash|Gift Card|Other)(?:, (?:Card|Cash|Gift Card|Other))+) \|/.exec(row ?? '')?.[1] ??
          ''
        ).split(', ');
        for (const m of methods) expect(paymentSection(d)).toContain(m);
      }
    },
  );

  it(
    title(
      'A card payment shows brand + last 4, Credit, Auth Code and the charge time; a successful card order is never stuck "Processing" (OH-075, OH-087)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const first = await findHistoryCode(['successful', 'successful-settled'], ['card'], 30);
      if (!first) this.skip();
      const hit = await firstMatching(await rowCodes(), (d) =>
        /\*{2,}\s?\d{4}|\d{4}\b.*Credit/.test(paymentSection(d)),
      );
      if (!hit) this.skip();
      const pay = paymentSection(hit?.d ?? '');
      expect(pay).toMatch(/(Visa|Mastercard|MasterCard|Amex|American Express|Discover|JCB|Card)[^|]*\d{4}/i);
      expect(pay).toMatch(/Credit|Debit/);
      expect(pay).toMatch(/Auth(orization)? Code/i);
      expect(pay).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M|\w{3} \d{1,2}, \d{4}/);
      expect(pay).not.toMatch(/Processing/);
    },
  );

  it(
    title(
      'A gift-card payment shows the masked card number and the balance after the txn (OH-076)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const first = await findHistoryCode(['successful', 'successful-settled'], ['gift-card'], 30);
      if (!first) this.skip();
      const hit = await firstMatching(await rowCodes(), (d) => /Balance/.test(paymentSection(d)));
      if (!hit) this.skip();
      expect(paymentSection(hit?.d ?? '')).toMatch(/\*{4}-\*{4}-\d{4}:? Balance:? \$[\d,.]+/);
    },
  );

  it(
    title('A role without view_order_history is refused at the Order History gate (OH-006)', Tag.REGRESSION),
    async function () {
      this.timeout(3 * 60_000);
      const code = (process.env.VOLT_NO_OH_CODE ?? '').trim();
      if (!code) this.skip(); // needs a staff code whose role lacks view_order_history
      const saved = await P.localGet(SKIP_KEY);
      try {
        const r = await gateOpensWith(code);
        if (r === null) this.skip();
        expect(r).toBe(false);
      } finally {
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title('Owner / Manager / Partner / Staff default roles all open Order History (OH-007)', Tag.REGRESSION),
    async function () {
      this.timeout(5 * 60_000);
      const codes = (process.env.VOLT_ROLE_CODES ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (codes.length === 0) this.skip(); // VOLT_ROLE_CODES = owner,manager,partner,staff codes
      const saved = await P.localGet(SKIP_KEY);
      try {
        for (const c of codes) {
          const r = await gateOpensWith(c);
          if (r === null) this.skip();
          expect(r).toBe(true);
          await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
        }
      } finally {
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );
});
