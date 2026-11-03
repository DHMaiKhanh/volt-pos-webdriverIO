/**
 * VP-4538 — POS supports the DTS campaign types Reminder, New Client and Birthday.
 *
 * docs/qc/volt-qc/vp-tickets/VP-4538-campaign-reminder-newclient-birthday-test-cases.md (TC-VP4538-01..11)
 *
 * ## Oracle
 *
 * A campaign reaches a customer only through a `campaign_customer` code that
 * DTS issues (New Client on sign-up, Birthday when its SMS goes out, Reminder
 * on schedule). Promo & Rewards lists the campaigns behind the customer's
 * unused, unexpired codes. So each case reads POS's own data first
 * (vp-4538-campaigns.helpers.ts), decides what the dialog SHOULD show, and only
 * then opens the dialog on a draft order. A store without a live campaign of the
 * kind, or without a holder of its code, SKIPS the case — never passes it.
 *
 * Orders opened here are drafts and are deleted afterwards (`cleanupOrders`);
 * TC-02 creates one new customer (random 832… phone) on the merchant, which
 * POS cannot delete.
 *
 *   npm run test:attach -- --spec tests/regression/order-flow/vp-4538-campaign-promotions.spec.ts
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import {
  attachNewCustomer,
  cleanupOrders,
  closeStrayDialogs,
  createOrder,
  discover,
  randomPhone,
  summary,
  uniqueName,
} from '../../../src/pages/voltqc/home-pend/homePendProbe.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  applyPromo,
  attachExistingCustomer,
  closeDialogX,
  openPromo,
  promoDlg,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import {
  campaigns,
  codesOfCustomer,
  customerIdByPhone,
  holderOf,
  isLive,
  isRedeemable,
  kindOf,
  liveCampaigns,
  type CampaignRow,
} from './vp-4538-campaigns.helpers.js';

const log = moduleLogger('vp-4538');

/** How long DTS may take to issue a New Client code after the customer syncs up. */
const NEW_CLIENT_CODE_WAIT = Timeouts.APP_BOOT;

let staff = '';
/** A priced service — a promotion on an empty ($0) order has nothing to discount. */
let service = '';
/** The customer TC-02 creates — reused by TC-03 / TC-07 / TC-08. */
let newClient: { phone: string; name: string; customerId: string | null } | null = null;

function skip(ctx: Mocha.Context, reason: string): never {
  log.info(`SKIP — ${reason}`);
  ctx.skip();
  throw new Error(reason); // unreachable: skip() throws Mocha's Pending marker
}

/** Draft order for `phone` (existing customer) or a brand-new customer, then the Promo & Rewards text. */
async function promoTextFor(
  customer: { phone: string; name?: string; isNew?: boolean },
  services: string[] = [],
): Promise<string> {
  await createOrder(staff, services);
  if (customer.isNew === true)
    await attachNewCustomer(customer.phone, customer.name ?? uniqueName('QC Camp'));
  else await attachExistingCustomer(customer.phone, customer.name);
  await openPromo();
  const text = await P.textOf(promoDlg);
  log.info(`Promo & Rewards for ${customer.phone}: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
  return text;
}

async function closePromoIfOpen(): Promise<void> {
  if (await P.has(promoDlg)) await closeDialogX().catch(() => undefined);
}

describe('VP-4538 — campaigns Reminder / New Client / Birthday on POS', function () {
  this.timeout(Timeouts.MOCHA_HOOK * 4);

  before(async function () {
    assertWritesAllowed('open draft orders and create a customer');
    await returnToHome();
    const till = await discover();
    staff = till.staff[0] ?? '';
    service = till.services[0]?.name ?? '';
    if (staff === '') skip(this, 'no selectable staff on this till');
  });

  afterEach(async () => {
    await closePromoIfOpen();
    await closeStrayDialogs().catch(() => undefined);
    await cleanupOrders();
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  describe('1. Campaign data on POS', () => {
    it(
      title("TC-VP4538-01: the store's DTS campaigns are synced to POS (campaignList)", Tag.REGRESSION),
      async function () {
        const all = await campaigns();
        log.info(
          `campaigns: ${all.map((c) => `${c.name} [${c.type ?? '-'}]${isLive(c) ? '' : ' (off)'}`).join(', ')}`,
        );
        if (all.length === 0) skip(this, 'merchant has no campaign at all on DTS');
        const kinds = new Set(all.map(kindOf).filter((k) => k !== null));
        expect(kinds.size).toBeGreaterThan(0);
      },
    );
  });

  describe('2. New Client', () => {
    it(
      title(
        'TC-VP4538-02: a customer created on POS sees the New Client promotion in Promo & Rewards',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.SLOW,
      ),
      async function () {
        const live = await liveCampaigns('newClient');
        if (live.length === 0) skip(this, 'no live New Client campaign on this store');
        const phone = randomPhone();
        const name = uniqueName('QC Camp');
        // Create the customer through a draft order; the code is issued by DTS after the sync.
        await createOrder(staff);
        await attachNewCustomer(phone, name);
        await closeStrayDialogs();
        await cleanupOrders();

        const customerId = await step(`Wait for ${phone} to exist in POS data`, async () => {
          let id: string | null = null;
          await browser.waitUntil(async () => (id = await customerIdByPhone(phone)) !== null, {
            timeout: Timeouts.API,
            interval: 2_000,
          });
          return id;
        });
        newClient = { phone, name, customerId };

        await step('Wait for DTS to issue the New Client code', () =>
          browser
            .waitUntil(
              async () =>
                (await codesOfCustomer(customerId ?? '')).some((cc) =>
                  live.some((c) => c.id === cc.campaignId),
                ),
              { timeout: NEW_CLIENT_CODE_WAIT, interval: 5_000 },
            )
            .catch(() => undefined),
        );

        const text = await promoTextFor({ phone });
        const shown = live.filter((c) => text.includes(c.name));
        expect(shown.map((c) => c.name)).not.toEqual([]);
      },
    );

    it(
      title(
        'TC-VP4538-03: the New Client code is linked to the new customer in POS data (code-before-customer race fixed)',
        Tag.REGRESSION,
      ),
      async function () {
        if (newClient?.customerId == null) skip(this, 'TC-02 did not create a customer');
        const live = await liveCampaigns('newClient');
        const codes = await codesOfCustomer(newClient.customerId ?? '');
        const linked = codes.filter((cc) => live.some((c) => c.id === cc.campaignId));
        expect(linked.length).toBeGreaterThan(0);
        expect(linked.every((cc) => cc.customerId === newClient?.customerId)).toBe(true);
        expect(linked.some((cc) => isRedeemable(cc))).toBe(true);
      },
    );

    it(
      title(
        'TC-VP4538-04: a customer created on DTS syncs down to POS — PENDING ' +
          '(needs the DTS web UI to create the customer; not driven from POS)',
      ),
    );

    it(
      title(
        'TC-VP4538-08: applying the New Client promotion puts a Promotion line on the order',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (newClient === null) skip(this, 'TC-02 did not create a customer');
        const live = await liveCampaigns('newClient');
        if (service === '') skip(this, 'no priced service on this till');
        const text = await promoTextFor({ phone: newClient.phone }, [service]);
        const campaign: CampaignRow | undefined = live.find((c) => text.includes(c.name));
        if (!campaign) skip(this, 'New Client promotion not offered (see TC-02)');
        await P.clickQ([promoDlg, { css: `label[for="${campaign.id}"]` }]);
        await applyPromo();
        expect((await summary()).promotion).not.toBeNull();
      },
    );
  });

  describe('3. Reminder', () => {
    it(
      title(
        'TC-VP4538-05: a customer holding a Reminder code sees the Reminder promotion',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        const holder = await holderOf('reminder');
        if (!holder) skip(this, 'no customer holds a redeemable code of a live Reminder campaign');
        const text = await promoTextFor({ phone: holder.phone, name: holder.name });
        expect(text).toContain(holder.campaign.name);
      },
    );
  });

  describe('4. Birthday', () => {
    it(
      title(
        'TC-VP4538-06: a customer whose Birthday SMS was sent sees the Birthday promotion',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        const holder = await holderOf('birthday');
        if (!holder) {
          skip(this, 'no customer holds a Birthday code (store has no SMS package → no code, by rule)');
        }
        const text = await promoTextFor({ phone: holder.phone, name: holder.name });
        expect(text).toContain(holder.campaign.name);
      },
    );

    it(
      title(
        'TC-VP4538-07: without a Birthday code (no SMS sent) the Birthday promotion is NOT offered',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (newClient?.customerId == null) skip(this, 'TC-02 did not create a customer');
        const live = await liveCampaigns('birthday');
        if (live.length === 0) skip(this, 'no live Birthday campaign on this store');
        const codes = await codesOfCustomer(newClient.customerId ?? '');
        if (codes.some((cc) => live.some((c) => c.id === cc.campaignId))) {
          skip(this, 'the new customer already holds a Birthday code');
        }
        const text = await promoTextFor({ phone: newClient.phone });
        for (const c of live) expect(text).not.toContain(c.name);
      },
    );

    it(
      title(
        "TC-VP4538-09: the Birthday SMS reaches the customer's phone — PENDING (SMS delivery, not observable from POS)",
      ),
    );
  });

  describe('5. Not automatable here', () => {
    it(
      title(
        'TC-VP4538-10: renaming a customer group to a duplicate name on DTS must not stall customer sync — PENDING ' +
          '(DTS UI + BE sync; regression of the 22/10 incident)',
      ),
    );
  });
});
