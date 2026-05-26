# Journal Sort Toggle — Design

**Date:** 2026-05-26
**Branch:** `maintenance-topic`
**Scope:** Add a sort toggle (Alphabetical / Impact Factor) to the Journals filter list in the home sidebar.

## Problem

The Journals list in the left sidebar (Home → Journals tab) renders 37 journals in the order they are declared in `src/lib/constants/journals.ts`. The declaration order mixes dedicated allergy journals (IF-descending) with general/respiratory journals appended at the end, so visually the order looks "뒤죽박죽" to users. There is no way to re-sort the list at runtime.

## Goal

Let the user choose between two sort orders for the Journals list:

1. **Alphabetical (A→Z)** — default
2. **Impact factor (IF ↓)** — highest first

The choice persists across visits.

## Scope

**In scope:** UI control + sort logic + localStorage persistence + a unit test.
**Out of scope:** new sort dimensions (date, color, IF↑), server-side persistence, dropdown variant, mobile-specific UI changes.

## Architecture

One-file change: `src/components/layout/journal-filter-panel.tsx` becomes stateful.

- Add internal `useState<SortOrder>('alpha')` (default).
- Add `useEffect` (mount-only) to hydrate from `localStorage[my-allergy:journal-sort]` — initial render uses the default to avoid SSR/CSR hydration mismatch; the persisted preference applies after mount.
- Add `useEffect` to write the value back on every change.
- Add `useMemo` that returns a sorted copy of `journals` based on the current `sortOrder` (never mutates the prop).
- Render a segmented toggle between the "All journals" button and the journal list.

Props/contract unchanged → no edits to `HomeSidebar` or any other caller.

## Sort logic

```ts
type SortOrder = 'alpha' | 'if';

function sortJournals(journals: JournalConfig[], order: SortOrder): JournalConfig[] {
  const copy = [...journals];
  if (order === 'alpha') {
    return copy.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  }
  // IF descending; nulls last; tie-break alphabetically by abbreviation
  return copy.sort((a, b) => {
    const ai = a.impactFactor;
    const bi = b.impactFactor;
    if (ai == null && bi == null) return a.abbreviation.localeCompare(b.abbreviation);
    if (ai == null) return 1;   // a goes after
    if (bi == null) return -1;  // b goes after
    if (ai !== bi) return bi - ai;
    return a.abbreviation.localeCompare(b.abbreviation);
  });
}
```

- **Alpha sort key = `abbreviation`** because that is the label the user sees in the list (e.g. `Lancet` not `The Lancet`).
- **IF nulls last** per user decision. Currently only 1 journal (`Int Arch Allergy Immunol`) has `impactFactor: null`.
- **Stable tie-break** via abbreviation alphabetical because the constants file contains several IF ties (e.g. 4.6 × 3 journals, 2.2 × 2 journals).

## UI

Segmented toggle, two buttons, sits between "All journals" and the journal list.

```
All journals
─────────────────────────
Sort  [ A→Z ]  [ IF ↓ ]
─────────────────────────
● Allergol Immunopathol (Madr)
● Allergol Int
● Allergy
...
```

- Active button reuses the existing `bg-blue-50 / dark:bg-blue-900/30 font-semibold text-blue-700` styling for visual consistency with `All journals` / selected journals.
- Inactive button gets the same muted-grey + hover state used by inactive list items.
- A small uppercase tracking-wide "Sort" label sits to the left so the row's purpose is obvious without a tooltip.
- Buttons are `text-xs`, compact padding, so the row does not crowd the list.

## Persistence

- localStorage key: **`my-allergy:journal-sort`**
- Value: `'alpha' | 'if'`. Any other value (including absent / parse failure) falls back to `'alpha'`.
- Read once on mount inside `useEffect` (client-only). Written on every state change.
- No SSR cookie — the first paint always shows alphabetical; the persisted choice swaps in after hydration. Acceptable because the journal list is below the fold on most viewports and the swap is instant.

## Testing

New test file: `src/components/layout/__tests__/journal-filter-panel.test.tsx`

Cases:

1. Default render uses alpha order — first item is the first abbreviation alphabetically.
2. Clicking the "IF ↓" toggle reorders the list so `Lancet` (88.5) is first and `Int Arch Allergy Immunol` (null) is last.
3. Toggle state writes the expected value to `localStorage['my-allergy:journal-sort']`.
4. When localStorage already contains `'if'`, the post-mount order is IF-descending.

Uses `@testing-library/react` (already a dep) and the existing Vitest setup. localStorage is mocked per-test.

## Risk & rollback

- Risk surface is one component; no API, no DB, no shared state.
- Failure mode: a broken sort would just show journals in odd order — no data loss.
- Rollback: revert the single commit.

## Non-goals (YAGNI)

- IF ascending toggle
- Sort by recency / color / topic
- Server-persisted preference (would require auth coupling for an aesthetic choice)
- Dropdown variant — can be added later by replacing the segmented toggle if more sort modes appear.
