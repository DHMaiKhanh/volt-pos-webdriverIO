# Contributing

This repository is the automated E2E suite for Volt POS. It is a separate repository from the
application, and it has one job: produce results a release manager can act on. A test that fails
for its own reasons costs more than no test at all, so the bar for merging is "this will still be
trustworthy in six months", not "it passed once on my machine".

---

## What belongs here, and what does not

| Change                                     | Where it goes                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| A new spec, page object, flow or component | Here.                                                                           |
| A timeout, tag, lane or service change     | Here.                                                                           |
| **Adding a missing `data-testid`**         | The **app** repository. Open a ticket or a PR there; link it from your PR here. |
| Fixing a product bug the suite found       | The app repository. This repo records the failure, it does not work around it.  |

Never modify the app under test to make a test pass. If a spec needs the app to change, that is an
app change with its own review.

---

## Branches

Default branch: `master`. Branch from it, and name the branch after the work:

```
feat/VP-1234-checkout-gift-card-specs
fix/VP-1240-order-history-flaky-filter
chore/bump-wdio-9.32
docs/environments-clarify-compile-time
```

One logical change per branch. A new area of coverage and a framework refactor are two branches.

## Commits

Conventional Commits, with the Linear issue in the subject when there is one — the same shape the
app repository uses:

```
feat(checkout): cover gift-card partial redemption [VP-1234]
fix(order-history): scope the filter dialog lookups to its root [VP-1240]
chore(drivers): pin msedgedriver resolution to .drivers first
docs(troubleshooting): add the WebView2 version-mismatch hang
```

Write the body for someone reading `git log` a year from now: what was wrong, and why this is the
fix. "Fix flaky test" tells them nothing.

---

## The verify gate

```powershell
npm run verify
```

That is `typecheck` + `lint` + `format:check`, and it must be clean before you open a pull request.
CI runs the same command; there is no separate, laxer local standard.

- **`typecheck`** — `tsc --noEmit` under `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` and
  `noUnusedParameters`. Indexed access returns `T | undefined`; handle it rather than asserting it
  away. Every exported function has an explicit return type.
- **`lint`** — ESLint with `--max-warnings 0`, including `@typescript-eslint/no-floating-promises`
  and the `wdio` plugin on `tests/`, `src/pages`, `src/components` and `src/flows`. The WDIO rules
  catch the classic mistake of forgetting `await` on a command, which otherwise passes silently and
  asserts on a promise.
- **`format:check`** — Prettier: single quotes, semicolons, trailing commas, print width 110.
  `npm run format` fixes it.

The husky pre-commit hook runs `typecheck` and `lint-staged`, so most of this is caught before the
commit exists.

You are also expected to have run the specs you touched:

```powershell
npm run test:spec -- tests/regression/<area>/<your>.spec.ts
```

Paste the result in the PR description. A spec nobody has watched run is not evidence.

---

## Pull requests

Include, in the description:

1. **What this covers and why.** Link the Linear issue and the test case it automates.
2. **The environment you ran against** — `ENV`, the resolved binary path, and the app version from
   the run banner. "Passed on dev" is not enough; three different builds answer to that name.
3. **The run output** for the specs you added or changed, including how long they took.
4. **Any `data-testid` you had to work around**, with a link to the app-repo ticket asking for it.
5. **Anything you could not make deterministic**, stated plainly. A known limitation written down
   is useful; a quiet `@flaky` tag is not.

Keep pull requests small enough to actually review. A twelve-spec PR gets skimmed.

---

## Review checklist for a new spec

A reviewer should be able to walk this list top to bottom. Anything unchecked is a comment.

**Placement and tagging**

- [ ] The spec is in the right folder — `tests/smoke/` only if it creates nothing at all.
- [ ] The title is built with `title()` and tags from `src/types/testTags.ts`, not hand-typed.
- [ ] Tags are accurate. `@write` on anything that creates data, `@payment` on anything touching
      the gateway, `@exclusive` on anything mutating merchant-global settings.
- [ ] If it is tagged `@smoke`, it genuinely creates nothing. This one runs against production.

**Layering**

- [ ] The spec contains no selector.
- [ ] Multi-screen actions are in `src/flows/`, not inlined in the spec.
- [ ] Any data-creating flow calls `assertWritesAllowed('<action>')` before it acts.
- [ ] Page objects do not assert, and do not reach into another page object.
- [ ] Component lookups are scoped through `inside()` / `insideAll()`, not raw `$()`.

**Selectors**

- [ ] Every selector is a `locator()` declaration with a real `data-testid` as the primary
      candidate.
- [ ] No invented testids. Each one exists in the app source or in the `feat/VP-802` reference, or
      is one the team has been asked to add (link the ticket).
- [ ] Every fallback is justified: structural, not text, not a Tailwind class, not positional.
- [ ] `npm run audit:testids` was run, and any fallback whose testid now exists has been deleted.

**Waiting and stability**

- [ ] No `browser.pause()` used as a synchronization primitive.
- [ ] Timeouts come from `configs/constants/timeouts.ts`, not literal numbers.
- [ ] The page's `readyAnchor` is data-dependent — not a static header that paints before the data
      arrives.
- [ ] The spec sets up its own data and does not depend on execution order.
- [ ] `@dual-window` specs switch back to the `main` window before finishing.

**Correctness of the assertion**

- [ ] The assertion would actually fail if the feature broke. An `isExisting()` on a container that
      is always mounted proves nothing.
- [ ] Money is compared as integer cents or as an exact formatted value, never through float
      arithmetic on scraped text.
- [ ] The failure message a reviewer would see names the real cause.

**Hygiene**

- [ ] `npm run verify` is clean.
- [ ] No `console.log` outside `scripts/` — use `moduleLogger()`.
- [ ] Comments explain **why**, not what. No step-by-step narration of the code.
- [ ] Relative imports end in `.js`.

---

## Changing the framework itself

Edits to `configs/`, `src/support/` or the services affect every spec at once. In addition to the
checklist above:

- Say in the PR description what breaks if the change is wrong, and how you verified it did not.
- Run a full `npm run test:dev`, not a single spec.
- Timeout changes need a reason from a measurement, not a feeling. `configs/constants/timeouts.ts`
  documents what each budget is for; keep it accurate.
- The safety rails in `wdio.prod.conf.ts` and `loadEnv()` are not refactoring targets. If you have
  a reason to weaken one, that is a conversation before it is a diff.
