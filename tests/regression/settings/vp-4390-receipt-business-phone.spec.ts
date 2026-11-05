/**
 * VP-4390 — the receipt masked the business phone (`(***) ***-6789`). Fix:
 * PR volt-pos#3337 → develop (>= 1.1.98): `ReceiptPreviewHeader` (used by
 * Settings → Receipt AND Order History → Receipt Details) prints it in full.
 * The customer phone stays masked.
 *
 * docs/qc/volt-qc/vp-tickets/VP-4390-receipt-business-phone-full-test-cases.md (TC-VP4390-01..06)
 * Portal half (TC-06): tests/web/portal-vp-4390-receipt-business-phone.spec.ts
 *
 *   npm run test:attach -- --spec tests/regression/settings/vp-4390-receipt-business-phone.spec.ts
 *
 * READ-ONLY: the Business phone toggle is flipped on the form and put back,
 * never saved. Print is pressed once (no printer: payload captured, app toasts
 * "Printer not connected"). dev only.
 */

import { expect } from '@wdio/globals';
import { VpReceiptSf as R } from '../../../src/constants/testids.vp-receipt-sf.js';
import { returnToHome } from '../../../src/flows/index.js';
import { switchToMain } from '../../../src/helpers/window.js';
import receiptSettingsPage from '../../../src/pages/settings/ReceiptSettingsPage.js';
import { app } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { ensure } from '../volt-qc/cd-e2e/cd-e2e.helpers.js';
import { capturePrint } from '../checkout/vp-5634.helpers.js';
import {
  FULL_PHONE,
  MASKED_PHONE,
  PHONE_TOGGLE,
  businessPhone,
  digits,
  header,
  openReceiptDialog,
  openReceiptSettings,
  vp4390,
} from './vp-4390.helpers.js';

describe('VP-4390 — receipt shows the full business phone', () => {
  /** `(888) 887-6789` as saved in Business Info. */
  let phone = '';

  before(async function () {
    this.timeout(2 * 60_000);
    await switchToMain();
    await returnToHome();
    phone = await businessPhone();
    ensure(phone !== '', 'merchant has no 10-digit Business phone in Business Info');
    await openReceiptSettings();
    ensure(
      await receiptSettingsPage.isToggleOn(PHONE_TOGGLE),
      'Settings → Receipt "Business phone" is OFF (saved) — turn it on first',
    );
  });

  afterEach(async () => {
    await switchToMain().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  describe('1. Settings → Receipt preview', () => {
    it(
      title('TC-VP4390-01: Receipt Preview shows the business phone in full', Tag.REGRESSION, Tag.CRITICAL),
      async function () {
        this.timeout(2 * 60_000);
        await openReceiptSettings();
        const preview = await receiptSettingsPage.previewText();
        const top = header(preview, 'Name');

        expect(top).toContain(phone);
        expect(top).not.toContain('*');
      },
    );

    it(
      title(
        'TC-VP4390-02: unticking Business phone drops the row; ticking it back restores it (no Save)',
        Tag.REGRESSION,
      ),
      async function () {
        this.timeout(2 * 60_000);
        await openReceiptSettings();
        await receiptSettingsPage.toggle(PHONE_TOGGLE);
        const off = await receiptSettingsPage.previewText();
        await receiptSettingsPage.toggle(PHONE_TOGGLE);
        const on = await receiptSettingsPage.previewText();

        expect(off).not.toContain(phone);
        expect(header(off, 'Name')).not.toMatch(FULL_PHONE);
        expect(on).toContain(phone);
        expect(await receiptSettingsPage.isToggleOn(PHONE_TOGGLE)).toBe(true);
        expect(await receiptSettingsPage.isSaveEnabled()).toBe(false);
      },
    );

    it(
      title('TC-VP4390-03: the preview number is the Business Info number, digit for digit', Tag.REGRESSION),
      async function () {
        this.timeout(2 * 60_000);
        await openReceiptSettings();
        const shown = FULL_PHONE.exec(header(await receiptSettingsPage.previewText(), 'Name'))?.[0] ?? '';

        expect(shown).toBe(phone);
        expect(digits(shown)).toHaveLength(10);
      },
    );
  });

  describe('2. Order History → Receipt Details', () => {
    it(
      title(
        'TC-VP4390-04: Receipt Details of a paid order shows the business phone in full',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const { code, text } = await openReceiptDialog();
        const top = header(text, code);

        expect(top).toContain(phone);
        expect(top).not.toMatch(MASKED_PHONE);
        expect(top).not.toContain('*');
      },
    );

    it(
      title(
        'TC-VP4390-05: customer phone stays masked — on screen and on the printed receipt',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const { code, text } = await openReceiptDialog(vp4390.customerOrder);
        ensure(
          MASKED_PHONE.test(text),
          `${code} has no customer phone on its receipt — set VP4390_CUSTOMER_ORDER`,
        );
        const r = await capturePrint(() => P.clickQ(R.receiptDialogPrint));
        const printedTop = header(r.text, code);

        // Screen
        expect(header(text, code)).toContain(phone);
        expect(text).toMatch(MASKED_PHONE);
        // Print
        expect(r.text).toContain(code);
        expect(printedTop).toContain(phone);
        expect(printedTop).not.toContain('*');
        expect(r.text).toMatch(MASKED_PHONE);
      },
    );
  });

  // TC-VP4390-06 (⚠️): Portal → Receipt details — tests/web/portal-vp-4390-receipt-business-phone.spec.ts
});
