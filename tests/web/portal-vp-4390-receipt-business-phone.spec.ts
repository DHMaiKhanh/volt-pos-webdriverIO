import { expect } from '@wdio/globals';
import { portalOrderPage } from '../../src/pages/web/PortalOrderPage.js';
import { Tag, title } from '../../src/types/testTags.js';

/**
 * Fastboy Portal half of VP-4390 (receipt shows the full business phone) —
 * fastboy-portal#960 (`order-receipt-merchant-header.tsx`).
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-4390-receipt-business-phone-full-test-cases.md
 * (TC-VP4390-06). The POS cases live in tests/regression/settings/vp-4390-receipt-business-phone.spec.ts.
 *
 * READ-ONLY. Data (merchant #14 dev defaults):
 *   VP4390_PORTAL_ORDER_ID — Portal order id of a paid order ("01a1a5ab-…" = OD261104-30413574)
 *   VP4390_BUSINESS_PHONE  — expected display number ("(888) 887-6789")
 *
 * Runs in Edge on the signed-in `.portal-profile/`: `npm run portal:vp-4390`.
 */
const orderId = process.env.VP4390_PORTAL_ORDER_ID?.trim() || '01a1a5ab-0f06-778e-8581-3a563c79b806';
const phone = process.env.VP4390_BUSINESS_PHONE?.trim() || '(888) 887-6789';

describe('Portal — VP-4390 receipt business phone', () => {
  it(
    title('TC-VP4390-06: Portal Receipt details shows the business phone in full', Tag.REGRESSION),
    async () => {
      await portalOrderPage.open(orderId);
      const text = await portalOrderPage.receiptText();
      // Merchant header + customer block = everything before the first "Staff:" group.
      // (The order code is not always in the panel's text; the footer has "*Subtotal …".)
      const staffAt = text.indexOf('Staff:');
      const top = staffAt > 0 ? text.slice(0, staffAt) : text.slice(0, text.indexOf(phone) + phone.length);

      expect(text).toContain(phone);
      expect(top).not.toContain('*');
    },
  );
});
