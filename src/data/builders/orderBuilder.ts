import type { CreateOrderInput } from '../../flows/order.flow.js';
import type { ServiceRef, StaffRef } from '../../types/models.js';
import { uniqueSuffix } from '../../utils/string.js';
import { requireServiceRef } from '../static/services.js';
import { requireStaffRef } from '../static/staff.js';

/**
 * The input to `createOrder()`, assembled a decision at a time.
 *
 * ## Why a builder for two optional fields
 *
 * Not for the fields — for the DEFAULTS. `anOrder()` is a runnable order on any
 * merchant (first staff tile, first service tile), and each `with*` call
 * replaces exactly one of those defaults. A spec therefore states only what it
 * cares about, and a reader can tell at a glance which values are load-bearing
 * for the assertion and which are scenery:
 *
 * ```ts
 * const { orderId } = await createOrder(anOrder().build());
 * const { orderId } = await createOrder(anOrder().withService(primaryService).build());
 * ```
 *
 * ## Why the reference exists
 *
 * Nothing wipes the merchant between runs: rows a spec creates are pushed
 * upstream through `/syncing/pushing` and come back on every later session, so a
 * fixed label like "E2E order" accumulates duplicates until a search step
 * matches the wrong one — and two workers running the same spec in parallel
 * collide outright. {@link OrderBuilder.build} therefore mints a fresh
 * {@link uniqueSuffix} on every call, and the spec has a token it can attach to
 * an order note or a customer name and search for afterwards without ambiguity.
 *
 * The import from `src/flows/` is TYPE-ONLY, so it is erased at compile time and
 * creates no runtime edge from data to flows — the dependency runs one way, from
 * the spec, into both.
 */
export interface OrderDraft extends CreateOrderInput {
  /**
   * A token unique to this build: `e2e-order-<base36 time>-<random>`.
   *
   * Not part of what `createOrder()` reads — the till has no free-text field on
   * the order itself — but safe to pass along with it and available for whatever
   * the spec labels afterwards.
   */
  reference: string;
}

export class OrderBuilder {
  private staff: StaffRef | undefined;
  private service: ServiceRef | undefined;
  private prefix = 'e2e-order';

  /**
   * Book the order to a named staff member.
   *
   * Validated here rather than at `build()` so an unset `STAFF_ID` fails on the
   * line that named it, where the stack still points at the spec.
   */
  withStaff(staff: StaffRef, envVar?: string): this {
    this.staff = requireStaffRef(staff, envVar);
    return this;
  }

  /** Sell a named item. Same fail-fast validation as {@link withStaff}. */
  withService(service: ServiceRef, envVar?: string): this {
    this.service = requireServiceRef(service, envVar);
    return this;
  }

  /**
   * Take whoever sorts first in the staff panel.
   *
   * The default, and worth stating explicitly when a spec deliberately does not
   * care who takes the order — otherwise the next reader adds a fixture to "fix"
   * the omission and couples the spec to an account it did not need.
   */
  withAnyStaff(): this {
    this.staff = undefined;
    return this;
  }

  /** Take whichever service tile renders first. The default; see {@link withAnyStaff}. */
  withAnyService(): this {
    this.service = undefined;
    return this;
  }

  /**
   * Change the prefix of the generated {@link OrderDraft.reference}.
   *
   * Worth doing when the token ends up somewhere a human reads later — a refund
   * spec's rows are easier to find in the merchant's order history as
   * `refund-…` than as one more `e2e-order-…`.
   */
  labeled(prefix: string): this {
    const cleaned = prefix.trim();
    if (cleaned === '') throw new Error('labeled() needs a non-empty prefix.');
    this.prefix = cleaned;
    return this;
  }

  /**
   * Freeze the current choices into one order's input.
   *
   * Every call mints a NEW reference, so one builder can drive a loop —
   * `for (…) await createOrder(builder.build())` — and each order still carries
   * a token of its own. The returned object shares no state with the builder.
   */
  build(): OrderDraft {
    return {
      staff: this.staff,
      service: this.service,
      reference: uniqueSuffix(this.prefix),
    };
  }
}

/** Start a draft: `anOrder().withService(primaryService).build()`. */
export function anOrder(): OrderBuilder {
  return new OrderBuilder();
}
