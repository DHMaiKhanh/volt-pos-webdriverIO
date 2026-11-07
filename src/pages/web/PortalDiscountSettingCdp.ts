import { loadEnv } from '../../../configs/env/loadEnv.js';
import type { PortalCdp } from '../../support/portal/PortalCdp.js';

const env = loadEnv();

export interface PortalSplit {
  availableOwner: number;
  availableStaff: number;
  customOwner: number;
  customStaff: number;
}

/** Tag the two inputs under each section heading (data-vp5627p="a0|a1|c0|c1") and return their values. */
const STAMP = `
  const out = {};
  for (const [h, p] of [['Available promotions', 'a'], ['Custom promotion', 'c']]) {
    const label = Array.from(document.querySelectorAll('body *')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === h);
    let box = label;
    while (box && box.querySelectorAll('input').length < 2) box = box.parentElement;
    const ins = box ? box.querySelectorAll('input') : [];
    if (ins.length < 2) return null;
    ins[0].setAttribute('data-vp5627p', p + '0');
    ins[1].setAttribute('data-vp5627p', p + '1');
    out[p + '0'] = ins[0].value; out[p + '1'] = ins[1].value;
  }
  return out;`;

/**
 * Fastboy Portal › Store Settings › Payment & transactions › Discount setting
 * (VP-5627), driven through {@link PortalCdp} from an app-lane spec.
 * The Portal ships no data-testids: sections are found by their heading text.
 */
export class PortalDiscountSettingCdp {
  constructor(private readonly cdp: PortalCdp) {}

  get url(): string {
    return `${env.PORTAL_URL}/pos/nail/${env.PORTAL_MERCHANT_ID}/setting?tab=payment-transactions`;
  }

  /** Open the tab; false when the profile's session is gone (redirected to /login). */
  async open(): Promise<boolean> {
    await this.cdp.goto(this.url);
    await this.cdp.waitFor(
      `return location.pathname.includes('/login') || !!Array.from(document.querySelectorAll('body *')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Custom promotion');`,
      30_000,
      'Portal login page or the Custom promotion section',
    );
    if (!(await this.cdp.isSignedIn())) return false;
    await this.waitStored();
    return true;
  }

  /** The card renders before the stored values load — wait until both sections hold numbers. */
  private async waitStored(): Promise<void> {
    await this.cdp.waitFor(
      `const v = (() => { ${STAMP} })(); return !!v && v.c0 !== '' && v.a0 !== '';`,
      20_000,
      'split values',
    );
    await new Promise((r) => setTimeout(r, 1_500));
  }

  /** Reload the tab and wait until the card holds its stored values again. */
  async reload(): Promise<void> {
    await this.cdp.reload();
    await this.waitStored();
  }

  /** Bring the Discount setting card into view (for screenshots). */
  async scrollToCard(): Promise<void> {
    await this.cdp.eval(
      `const l = Array.from(document.querySelectorAll('body *')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Custom promotion'); if (l) l.scrollIntoView({ block: 'center' }); return true;`,
    );
    await new Promise((r) => setTimeout(r, 400));
  }

  async read(): Promise<PortalSplit> {
    const v = await this.cdp.eval<Record<string, string> | null>(STAMP);
    if (!v) throw new Error('PortalDiscountSettingCdp: split inputs not found');
    return {
      availableOwner: Number(v.a0),
      availableStaff: Number(v.a1),
      customOwner: Number(v.c0),
      customStaff: Number(v.c1),
    };
  }

  private async typeInto(key: string, value: string): Promise<void> {
    await this.cdp.eval(
      `(() => { ${STAMP} })(); const i = document.querySelector('[data-vp5627p="${key}"]'); i.scrollIntoView({ block: 'center' }); i.focus(); i.select(); return true;`,
    );
    await this.cdp.insertText(value);
  }

  /** Type the Custom split, Save, reload and wait until the Portal shows it stored. */
  async setCustom(owner: number, staff: number): Promise<PortalSplit> {
    await this.typeInto('c0', String(owner));
    await this.typeInto('c1', String(staff));
    await new Promise((r) => setTimeout(r, 500));
    const clicked = await this.cdp.eval<boolean>(
      `const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'Save' && !x.disabled); if (!b) return false; b.click(); return true;`,
    );
    if (!clicked)
      throw new Error(
        `PortalDiscountSettingCdp: no enabled Save after typing ${String(owner)}/${String(staff)}`,
      );
    await new Promise((r) => setTimeout(r, 2_500));
    await this.cdp.reload();
    await this.waitStored();
    const deadline = Date.now() + 15_000;
    let s = await this.read();
    while (s.customOwner !== owner && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1_000));
      s = await this.read();
    }
    return s;
  }
}
