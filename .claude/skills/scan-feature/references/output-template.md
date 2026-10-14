# Output template — `<screen>-test-cases.md`

Match the repo's existing screen docs exactly (see `docs/screens/order-flow/order-flow-test-cases.md`,
`docs/screens/README.md`). Write ONE file per feature at
`docs/screens/<screen>/<screen>-test-cases.md`. If a doc already exists, UPDATE it (add a dated
verify log + drift table) rather than replacing the curated history.

---

## 1. Frontmatter (required)

```yaml
---
title: "<Screen name> (<route>) — Tính năng & test case"
route: /<route>
source-linear: <Linear doc URL, or "offline: docs/specs/<file>.md", or "n/a">
scanned-at: <YYYY-MM-DD>
scanned-by: raw-CDP-attach (WebView2 CDP 9222)   # or "playwright-mcp (cdp-endpoint 9222)"
env: app cài thật (http://tauri.localhost/...), merchant <id>, staff "<name>"
app-observed: WebView2 / Edge <ver>, Tauri v2
baseline: <existing doc paths, or "none — first scan">
---
```

## 2. Body sections (in order)

1. `## 0. Cách quét` — one paragraph: attach lane used, nav-by-click constraint, throwaway-safe note.
2. `## 1. Sơ đồ luồng` — an ASCII flow of the feature with TC ids annotated on each branch.
3. `## 2. Feature inventory` — grouped tables (one per sub-area). Columns:
   `| Tính năng | Mô tả | Trạng thái |` where Trạng thái uses the status legend below + TC id.
4. `## 3. Test cases` — the numbered TC table (section 3 below).
5. `## 4. Nhật ký live scan <date>` — step-by-step evidence table of what was driven + observed values.
6. `## 5. Khoảng trống` — what could NOT be verified live and the concrete precondition needed.
7. `## 6. Tham chiếu` — baseline docs, attach conf, Linear, screenshots.

## 3. Test case table (the backlog format)

Numbered `TC-<SCREEN>-01`, `TC-<SCREEN>-02`, … (kebab screen slug, e.g. `TC-ORDERFLOW-01`,
`TC-CHECKOUT-01`). Full detail table:

```markdown
| ID             | Tiêu đề          | Tiền điều kiện  | Các bước  | Kết quả mong đợi                                          | Loại                  | Ưu tiên    |
| -------------- | ---------------- | --------------- | --------- | --------------------------------------------------------- | --------------------- | ---------- |
| TC-<SCREEN>-01 | <what it checks> | <preconditions> | 1. … 2. … | <expected, with EXACT observed values when live-verified> | e2e\|regression\|edge | P1\|P2\|P3 |
```

Rules:

- **`Loại`** = one of `e2e` / `regression` / `edge`. **`Ưu tiên`** = `P1` (revenue/critical path) /
  `P2` (functional) / `P3` (edge).
- **Put EXACT observed values** in Kết quả mong đợi when live-verified (amounts, labels, counts,
  order ids) — e.g. "Subtotal $27.50 / Tax $2.75 / Total $30.25", not "totals correct".
- **Mark provenance** in Kết quả: `✅<date>` live-verified · `⚠️<date>` verified-with-drift ·
  `🧱` blocked (needs settled order / terminal / dual-screen) · `📄 [LINEAR-ONLY]` spec-only, UI not built.
- Keep a compact status column too (see order-flow-scan example) if the detail table is long.

## 4. Status legend (reuse verbatim)

> ✅ = quét live khớp · ⚠️ = có drift/điều kiện · 🧱 = chưa quét được (cần order settled/dual-screen/terminal) · 📄 = từ document, chưa dựng UI.

## 5. Traceability to specs (why the ids matter)

The TC ids ARE the backlog — a ported WebdriverIO spec names them in its title so the two stay
linked (`docs/writing-tests.md`, `docs/screens/README.md`). Example spec title:
`title('A cash payment closes the order (TC-CHECKOUT-42)', Tag.REGRESSION, Tag.CRITICAL)`.
So: never renumber existing TC ids; append new ones at the end.

## 6. Tag hint column (optional but useful)

When a TC is a clear spec candidate, note the WDIO tag it would carry (from `src/types/testTags.ts`):
`@smoke` (read-only), `@regression`, `@critical`, `@write`, `@payment`, `@dual-window`, `@exclusive`.
This tells the porter which lane the spec belongs in.
