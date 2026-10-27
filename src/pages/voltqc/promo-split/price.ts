import { app, money, r2, vqEnv } from './vqApp.js';

/**
 * Port of volt-qc `src/core/price.ts` — the merchant's price model, MEASURED on
 * the app (never assumed): tile price b, order line b·(1+fee), Subtotal = Σ lines,
 * Tax = Subtotal·tax, Card = Subtotal + Tax, Cash/Other/Gift Card = Σb·(1+tax).
 * With fee = tax = 0 every formula collapses to the base price.
 */
export interface PriceModel {
  fee: number;
  tax: number;
  measuredAt: string;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export const lineOf = (m: PriceModel, b: number): number => r2(b * (1 + m.fee));
export const subtotalOf = (m: PriceModel, bases: number[]): number => r2(sum(bases.map((b) => lineOf(m, b))));
export const taxOf = (m: PriceModel, bases: number[]): number => r2(subtotalOf(m, bases) * m.tax);
export const cardTotalOf = (m: PriceModel, bases: number[]): number =>
  r2(subtotalOf(m, bases) + taxOf(m, bases));
export const cashTotalOf = (m: PriceModel, bases: number[]): number => r2(sum(bases) * (1 + m.tax));
export const methodTotalOf = (
  m: PriceModel,
  method: 'Card' | 'Cash' | 'Other' | 'Gift Card',
  bases: number[],
): number => (method === 'Card' ? cardTotalOf(m, bases) : cashTotalOf(m, bases));

let cached: PriceModel | null = null;

/** Base price on the service tile (Home must show the service grid). */
export function basePrice(service: string): Promise<number> {
  return app.basePrice(service);
}

/**
 * Measure once per worker: a one-line order of the test service, read tile /
 * line / Subtotal / Tax, then delete the order.
 */
export async function priceModel(opts: { refresh?: boolean } = {}): Promise<PriceModel> {
  if (cached && !opts.refresh) return cached;
  await app.quickCheckout();
  const base = await basePrice(vqEnv.testService);
  const id = await app.createOrder({ services: [vqEnv.testService] });
  const line = money(/\$[\d,.]+/.exec(await app.itemRowText(vqEnv.testService))?.[0]);
  const t = await app.text('main');
  const p = (label: string): number => money(new RegExp(`\\| ${label} \\| (-?\\s*\\$[\\d,.]+)`).exec(t)?.[1]);
  const subtotal = p('Subtotal');
  const taxAmt = p('Tax');
  await app.deleteCurrentOrder().catch(() => undefined);
  app.createdOrders.delete(id);
  cached = {
    fee: Number.isFinite(line / base) ? r2(line / base - 1) : 0,
    tax: Number.isFinite(taxAmt) && subtotal > 0 ? Math.round((taxAmt / subtotal) * 10_000) / 10_000 : 0,
    measuredAt: new Date().toISOString(),
  };
  return cached;
}
