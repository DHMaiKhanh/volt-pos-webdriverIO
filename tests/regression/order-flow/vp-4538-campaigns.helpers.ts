/**
 * VP-4538 helpers — DTS campaigns (Reminder / New Client / Birthday) as POS sees them.
 *
 * NOT a spec. Reads are the app's own GraphQL documents
 * (`src/routes/_app/home/-customer/-promotion/promotions.gql.ts`): a campaign
 * reaches a customer only through a `campaign_customer` row (the code DTS
 * issues — New Client on sign-up, Birthday when the SMS goes out, Reminder on
 * its schedule), and Promo & Rewards lists the campaigns behind the customer's
 * unused, unexpired codes. So the data tells a spec what the dialog SHOULD show
 * before it is opened.
 *
 * Read-only here; the order a case opens is deleted by the spec.
 */

import { gql } from '../../../src/api/index.js';
import { VpCampaignKind, type VpCampaignKindKey } from '../../../src/constants/testids.vp-loyalty-pending.js';

export interface CampaignRow {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean | null;
  startDate: string | null;
  expirationDate: string | null;
}

export interface CampaignCustomerRow {
  id: string;
  campaignId: string;
  customerId: string;
  code: string | null;
  isUsed: boolean | null;
  expiredDate: string | null;
}

const CAMPAIGNS = `
  query vp4538Campaigns {
    campaignList(orderBy: [{ updatedAt: desc }], limit: 200) {
      id
      name
      type
      isActive
      startDate
      expirationDate
    }
  }
`;

const CUSTOMER_BY_PHONE = `
  query vp4538CustomerByPhone($phone: String!) {
    customerList(where: { phone: { like: $phone } }, orderBy: { id: desc }) {
      id
      name
      phone
    }
  }
`;

const CODES_OF_CUSTOMER = `
  query vp4538CodesOfCustomer($customerId: String!) {
    campaignCustomerList(where: { customerId: { eq: $customerId } }) {
      id
      campaignId
      customerId
      code
      isUsed
      expiredDate
    }
  }
`;

const CODES_OF_CAMPAIGNS = `
  query vp4538CodesOfCampaigns($ids: [String!]) {
    campaignCustomerList(where: { campaignId: { in: $ids } }, limit: 200) {
      id
      campaignId
      customerId
      code
      isUsed
      expiredDate
    }
  }
`;

const CUSTOMER_BY_PK = `
  query vp4538CustomerByPk($id: String!) {
    customerByPk(id: $id) {
      id
      name
      phone
    }
  }
`;

/** Which of the three ticket kinds a campaign is (type first, name as fallback), or null. */
export function kindOf(c: Pick<CampaignRow, 'type' | 'name'>): VpCampaignKindKey | null {
  for (const field of [c.type ?? '', c.name]) {
    for (const [kind, re] of Object.entries(VpCampaignKind) as Array<[VpCampaignKindKey, RegExp]>) {
      if (re.test(field)) return kind;
    }
  }
  return null;
}

const notPast = (iso: string | null, now: number): boolean => iso === null || Date.parse(iso) >= now;

/** Active campaign whose window contains now. */
export const isLive = (c: CampaignRow, now = Date.now()): boolean =>
  c.isActive !== false &&
  (c.startDate === null || Date.parse(c.startDate) <= now) &&
  notPast(c.expirationDate, now);

/** An unused, unexpired code — what Promo & Rewards offers. */
export const isRedeemable = (cc: CampaignCustomerRow, now = Date.now()): boolean =>
  cc.isUsed !== true && notPast(cc.expiredDate, now);

export async function campaigns(): Promise<CampaignRow[]> {
  const data = await gql().query<{ campaignList: CampaignRow[] | null }>(CAMPAIGNS, {
    operationName: 'vp4538Campaigns',
  });
  return data.campaignList ?? [];
}

/** Live campaigns of one kind. */
export async function liveCampaigns(kind: VpCampaignKindKey): Promise<CampaignRow[]> {
  return (await campaigns()).filter((c) => isLive(c) && kindOf(c) === kind);
}

export async function customerIdByPhone(phone: string): Promise<string | null> {
  const data = await gql().query<{ customerList: Array<{ id: string; phone: string | null }> | null }>(
    CUSTOMER_BY_PHONE,
    { operationName: 'vp4538CustomerByPhone', variables: { phone } },
  );
  const digits = phone.replace(/\D/g, '');
  return data.customerList?.find((c) => (c.phone ?? '').replace(/\D/g, '') === digits)?.id ?? null;
}

export async function codesOfCustomer(customerId: string): Promise<CampaignCustomerRow[]> {
  const data = await gql().query<{ campaignCustomerList: CampaignCustomerRow[] | null }>(CODES_OF_CUSTOMER, {
    operationName: 'vp4538CodesOfCustomer',
    variables: { customerId },
  });
  return data.campaignCustomerList ?? [];
}

/**
 * A customer holding a redeemable code of a live campaign of `kind`, with that
 * campaign — or null when the store has none (e.g. Birthday without SMS).
 * The phone may be shared by several customers (DEV has 5 on 2052052052), so
 * attach by phone AND name.
 */
export async function holderOf(
  kind: VpCampaignKindKey,
): Promise<{ phone: string; name: string; campaign: CampaignRow } | null> {
  const live = await liveCampaigns(kind);
  if (live.length === 0) return null;
  const data = await gql().query<{ campaignCustomerList: CampaignCustomerRow[] | null }>(CODES_OF_CAMPAIGNS, {
    operationName: 'vp4538CodesOfCampaigns',
    variables: { ids: live.map((c) => c.id) },
  });
  for (const cc of (data.campaignCustomerList ?? []).filter((r) => isRedeemable(r))) {
    const c = await gql().query<{ customerByPk: { name: string | null; phone: string | null } | null }>(
      CUSTOMER_BY_PK,
      { operationName: 'vp4538CustomerByPk', variables: { id: cc.customerId } },
    );
    const phone = (c.customerByPk?.phone ?? '').replace(/\D/g, '');
    const campaign = live.find((l) => l.id === cc.campaignId);
    const name = (c.customerByPk?.name ?? '').trim();
    if (phone.length >= 10 && name !== '' && campaign) return { phone, name, campaign };
  }
  return null;
}
