# Screen documentation

Per-screen reference for the app under test. **56 documents across 25 screens**,
imported from the Playwright suite at `D:/2.POS/volt-pos-playwright`.

## What is here

Each screen folder holds up to three documents:

| File                      | What it is                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `<screen>-code-detail.md` | How the screen is built — routes, components, GraphQL queries, state. Written by reading the app source. |
| `<screen>-test-cases.md`  | The numbered test cases for that screen (`TC-01`, `TC-02`, …). **~4,900 lines in total.**                |
| `<screen>-i18n-scan.md`   | Which strings on that screen are still untranslated.                                                     |

## How to use them

**The test-case files are the backlog.** They are the reason this folder was
imported: 306 tests in the Playwright suite were written against these numbers,
and porting a spec means picking its `TC-` ids out of the relevant file rather
than re-deriving what to check. A ported spec should name its test cases in the
title so the two stay traceable — `TC19.20.21` in a filename, or `(TC-34)` in an
`it(...)` string.

**The code-detail files are reference, not truth.** They describe the app as it
was when they were written, and the app has moved. Three concrete examples found
while porting the page objects:

- The Daily Sale Report's chart cards are documented as four; the app now
  defines six in `CHART_TYPES` (`netIncome` and `totalRefund` were added).
- The turn board is documented as a page at `/turn`. There is no such route —
  `TurnBoardDialog` is mounted app-wide in `_app.tsx` and reached from the
  floating quick-view.
- Several income queries are documented under their pre-`vReport*` names.

So: read them to understand a screen, then confirm against
`${VOLT_POS_SRC}/src` before writing a selector or an assertion against them.

## What was deliberately NOT imported

Screenshots. The originals reference PNGs under `<screen>-assets/`, which are
~2.7 MB of a state the app has since left. A stale screenshot is worse than no
screenshot — it invites a reader to trust a layout that has changed — and the
links resolving to nothing is the honest signal. Take fresh captures when a
document genuinely needs one.
