# tests/

Where the executable specs live. Page objects, components and flows are in `src/`; this folder
holds assertions and nothing else.

## Layout

| Path                                | Holds                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `tests/smoke/*.spec.ts`             | Read-only checks. The **only** suite allowed to run against a production till. |
| `tests/regression/<area>/*.spec.ts` | Functional coverage: `home/`, `checkout/`, `order-history/`, `settings/`.      |
| `tests/setup/rootHooks.ts`          | Mocha root hooks — sign-in, window reset, updater watcher.                     |

The `<area>` folders are not decoration: `configs/wdio/wdio.shared.conf.ts` maps a `--suite` name
onto each one (`smoke`, `regression`, `home`, `checkout`, `orderHistory`, `settings`), so a spec in
the wrong folder silently drops out of its lane.

## Lanes and tags

Mocha has no tag concept. `title()` from `src/types/testTags.ts` appends the tag to the test title
and `--mochaOpts.grep` selects on it, which is why a tag is never hand-typed.

| Tag            | Means                                                     | Lane / consequence                                              |
| -------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| `@smoke`       | Read-only. Creates nothing, anywhere.                     | `npm run test:smoke`; the only tag `npm run test:prod` may run. |
| `@regression`  | Full functional coverage. Creates data.                   | `npm run test:regression` — dev / staging only.                 |
| `@critical`    | Revenue path that gates a release.                        | `npm run test:critical`.                                        |
| `@write`       | Creates an order, takes a payment, issues a refund.       | Needs `WRITE_ALLOWED`; guarded by `assertWritesAllowed()`.      |
| `@payment`     | Touches the payment gateway.                              | Never production.                                               |
| `@exclusive`   | Mutates merchant-**global** state (language, turn, info). | Runs last and alone.                                            |
| `@dual-window` | Asserts across the staff window and the customer display. | Must switch back to `main` before the test ends.                |
| `@db`          | Re-derives an expected number from the local database.    | Filesystem-level only — the databases are SQLCipher-encrypted.  |
| `@slow`        | App boot, sync waits, report generation.                  | Documentation for whoever reads the timing.                     |
| `@flaky`       | Quarantined.                                              | Runs, but never gates a merge.                                  |

### Current coverage

| Spec                                                  | Tags                                             |
| ----------------------------------------------------- | ------------------------------------------------ |
| `smoke/app-launch.spec.ts`                            | `@smoke`, `@dual-window`                         |
| `smoke/authentication.spec.ts`                        | `@smoke`, `@critical`                            |
| `smoke/home-screen.spec.ts`                           | `@smoke`                                         |
| `smoke/order-history.spec.ts`                         | `@smoke`                                         |
| `regression/home/create-order.spec.ts`                | `@regression`, `@write`, `@critical`             |
| `regression/checkout/cash-payment.spec.ts`            | `@regression`, `@write`, `@payment`, `@critical` |
| `regression/order-history/listing-and-detail.spec.ts` | `@regression`, `@write`                          |
| `regression/settings/language-switch.spec.ts`         | `@regression`, `@write`, `@exclusive`            |

## The placement rule

**A spec that creates data must never live under `tests/smoke/`.**

This is not a style preference. `tests/smoke/**` is the entire body of `--suite smoke`, and
`--suite smoke` is what `npm run test:prod` runs against a **production build** — a binary compiled
against the live upstream (`src-tauri/build.rs` bakes the backend in) and wired to the live payment
gateway. Every local row it writes is pushed by `/syncing/pushing`. A checkout spec that drifts into
this folder bills a real merchant, and it will do so quietly, because the test passes.

Three checks keep it honest, in order of how early they catch the mistake:

1. **`@smoke` and `@write` are mutually exclusive.** If a spec needs `Tag.WRITE`, it belongs under
   `tests/regression/`.
2. **The data-creating flow carries the rail.** `assertWritesAllowed('<action>')` throws on a build
   with `WRITE_ALLOWED=false`, naming the action and the environment. A spec that mutates state
   without going through a flow — the language switch is the one such case here — states the rail in
   its own `before` hook.
3. **Read-only means read-only in the spec, too.** `tests/smoke/order-history.spec.ts` opens the
   filter dialog and dismisses it with Escape; it never presses Confirm, because Confirm applies
   filters and that is a change.

## Root hooks

`tests/setup/rootHooks.ts` exports `mochaHooks` and is loaded through `mochaOpts.require` — see the
comment at the top of that file for the exact config entry. It signs in once per spec file, returns
the session to the staff window before every test, and hands the next file a known screen. It does
**not** reset the screen after every passing test: specs whose second `it` deliberately continues on
the screen the first one reached (order history opens the row it just asserted on) rely on that.
