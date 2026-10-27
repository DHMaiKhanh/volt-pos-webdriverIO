import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcGiftCard, VqcHome, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { parseMoney } from '../../../utils/money.js';
import { voltQcProbe as P } from './VoltQcProbe.js';

/**
 * The "Sell Gift Card" dialog (Home → Gift Card tile), for the volt-qc 04-promo
 * port (volt-qc `src/flows/promo.ts` → `gc*`). Closing the dialog without
 * pressing Add writes nothing — every helper here stops short of Add.
 */

const D = VqcGiftCard.dialog;
export const gcIn = (q: VqcQuery): readonly VqcQuery[] => [D, q];

export const gcCodeBox = gcIn(VqcGiftCard.codeBox);
export const gcCustomAmount = gcIn(VqcGiftCard.customAmount);
export const gcAdd = gcIn(VqcGiftCard.add);
export const gcQuick = (label: string): readonly VqcQuery[] => gcIn({ role: 'button', name: label });
export const gcTab = (name: 'Bonus' | 'Discount'): readonly VqcQuery[] => gcIn({ role: 'tab', name });
/** The value box of the active Bonus/Discount tab panel. */
export const gcPanelBox: readonly VqcQuery[] = [D, { role: 'tabpanel', nth: 0 }, { role: 'textbox', nth: 0 }];

/** Gift Card tile → dialog (the till must already show an empty order frame). */
export async function openSellGiftCard(): Promise<void> {
  await P.clickQ(VqcHome.giftCardTile);
  await P.waitFor(D, Timeouts.SHORT, 'Sell Gift Card dialog');
}

export async function closeSellGiftCard(): Promise<void> {
  if (!(await P.has(D))) return;
  await P.clickQ(gcIn({ role: 'button', name: 'Close', nth: 0 }));
  await P.waitGoneQ(D, Timeouts.SHORT, 'Sell Gift Card dialog');
}

/** Type a code and wait for the lookup (Balance line or "Invalid gift card number"). */
export async function gcEnterCode(code: string): Promise<void> {
  await P.fillQ(gcCodeBox, code);
  await P.waitFor(
    gcIn({ textRe: 'Balance: \\$|Invalid gift card number', nth: 0 }),
    Timeouts.MEDIUM,
    'gift card lookup',
  );
}

/** Is a $25/$50/$100 preset rendered as selected (primary fill, white text)? */
export async function gcQuickSelected(label: string): Promise<boolean> {
  const cls = (await P.attrOf(gcQuick(label), 'class')) ?? '';
  return /(^|\s)text-white(\s|$)/.test(cls);
}

/** Pick the Bonus/Discount tab, its %/$ unit, then type the raw value. */
export async function gcBonusOrDiscount(
  tab: 'Bonus' | 'Discount',
  unit: '%' | '$',
  raw: string,
): Promise<void> {
  await P.clickQ(gcTab(tab));
  const combo: readonly VqcQuery[] = [D, { role: 'tabpanel', nth: 0 }, { role: 'combobox', nth: 0 }];
  const current = (await P.textOf(combo)).trim() || '%';
  if (current !== unit) {
    await P.clickQ(combo);
    await P.clickQ({ role: 'option', name: unit });
  }
  await P.fillQ(gcPanelBox, raw);
  await settle(300);
}

export interface GiftCardSummary {
  value: number;
  bonus: number;
  totalBalance: number;
  discount: number;
  customerPays: number;
  text: string;
}

/** The summary block at the bottom of the dialog, in CENTS (NaN when a row is missing). */
export async function gcSummary(): Promise<GiftCardSummary> {
  const raw = (await P.rawText(D)) ?? '';
  const t = raw.replace(/\s*\n+\s*/g, ' | ');
  const s = t.slice(t.lastIndexOf('Gift Card Value'));
  const f = (label: string): number => {
    const m = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| (-?\\$[\\d,.]+)`).exec(s);
    return m?.[1] ? parseMoney(m[1]) : Number.NaN;
  };
  return {
    value: f('Gift Card Value'),
    bonus: f('Bonus'),
    totalBalance: f('Total Balance'),
    discount: f('Discount'),
    customerPays: f('Customer Pays'),
    text: t,
  };
}

/** The "Balance: $x.xx" figure shown after a successful lookup, in cents. */
export async function gcBalanceCents(): Promise<number> {
  const t = await P.textOf(gcIn({ textRe: '^Balance: \\$', nth: 0 }));
  const m = /\$[\d,.]+/.exec(t);
  return m ? parseMoney(m[0]) : Number.NaN;
}
