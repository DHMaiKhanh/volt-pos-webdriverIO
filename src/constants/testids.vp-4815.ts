/**
 * VP-4815 — passcode gates for Quick Checkout / Quick Pay / Sell Gift Card /
 * Edit Service Price / Calendar, and the Customer Status badge.
 *
 * The app (1.1.99) puts no testid on any of these, so each locator names the
 * testid a future build could add and falls back to what the live DOM renders.
 */

import { locator } from '../helpers/selectors.js';
import type { Locator } from '../helpers/selectors.js';

/** Status labels `CustomerTypeBadge` renders (en + vi of `customer.type.*`). */
export const CUSTOMER_TYPE_LABELS = {
  vip: ['VIP'],
  new: ['New', 'Mới'],
  regular: ['Regular', 'Thường xuyên'],
  at_risk: ['At Risk', 'Có nguy cơ'],
  booking: ['Booking', 'Đặt lịch'],
  import: ['Import', 'Nhập'],
} as const;

export type CustomerType = keyof typeof CUSTOMER_TYPE_LABELS | 'normal';

const anyText = (labels: readonly string[]): string =>
  labels.map((l) => `normalize-space(.)="${l}"`).join(' or ');

export const Vp4815Ids = {
  /**
   * The pinned "Gift Card" category tile (title-only, centred) — NOT the "Gift
   * Card · N Services" category, whose heading is `truncate` instead.
   */
  giftCardTile: locator(
    'gift card category tile',
    'home-service-category-gift-card',
    `//div[contains(@class,"cursor-pointer")][.//h3[contains(@class,"text-center")][${anyText(['Gift Card', 'Thẻ quà tặng'])}]]`,
  ),

  /** The Sell Gift Card dialog (opened by the tile once the gates let it). */
  sellGiftCardDialog: locator(
    'sell gift card dialog',
    'sell-gift-card-dialog',
    `//*[@role="dialog"][.//*[${anyText(['Sell Gift Card', 'Bán thẻ quà tặng'])}]]`,
  ),

  /** The Quick Pay dialog title. */
  quickPayDialog: locator(
    'quick pay dialog',
    'quick-pay-dialog',
    `//*[@role="dialog"][.//*[self::h2 or self::h3 or self::p][${anyText(['Quick Pay', 'Thanh toán nhanh'])}]]`,
  ),

  /** "Customer Information" dialog (edit-customer pencil on the order panel). */
  customerInformationDialog: locator(
    'customer information dialog',
    'customer-information-dialog',
    // The title also holds the status badge ("Customer Information VIP"), so match its start.
    `//*[@role="dialog"][.//*[starts-with(normalize-space(.),"Customer Information") or starts-with(normalize-space(.),"Thông tin khách hàng")]]`,
  ),

  /** "Customers Found" popover under the customer search box. */
  customersFoundPanel: locator(
    'customers found panel',
    'home-customer-search-results',
    `//*[normalize-space(.)="Customers Found" or normalize-space(.)="Khách hàng tìm thấy"]/ancestor::div[.//div[contains(@class,"active:bg-accent")]][1]`,
  ),
} as const;

/** One status badge (`data-slot="badge"`), excluding the header's DEV/env badge. */
export const customerTypeBadge = (labels: readonly string[]): Locator =>
  locator(
    `customer status badge ${labels[0]}`,
    `customer-type-badge-${labels[0]}`,
    `//*[@data-slot="badge"][not(ancestor-or-self::*[@data-testid="env-badge"])][${anyText(labels)}]`,
  );
