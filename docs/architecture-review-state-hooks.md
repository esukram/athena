# Architecture Review: React State Handling, Hooks & File Organization

**Scope:** `apps/web` (React 19 + TypeScript + Vite, tRPC/React Query, no global
state library)
**Type:** Written review — recommendations only, no code changes.
**Date:** 2026-05-29

---

## 1. Executive Summary

The web app has a **solid foundation**: consistent naming, a clean tRPC layer,
thin route files that delegate to feature components, disciplined React Query
invalidation, and one well-built custom hook (`useChapterVoicePlayback`) that
demonstrates the team can extract complex logic cleanly.

The main weaknesses are **concentration and duplication of stateful logic**:

1. **God components** — `LectureEdit.tsx` (933 lines) mixes lecture metadata,
   chapter CRUD, question management, debounced auto-save, and reordering in one
   file. `TrainingSession.tsx` (568) and `LectureLearn.tsx` (453) follow the same
   pattern.
2. **Duplicated edit-chapter form logic** — `LectureEdit.tsx` and `ChapterMenu.tsx`
   carry near-identical form state, handlers, and a question-sync effect.
3. **Inline cross-cutting concerns** — localStorage access, debouncing, and
   keyboard navigation are re-implemented inline in multiple components instead of
   living in dedicated hooks.

None of these are correctness bugs; they are maintainability and reuse issues.
The recommended direction is to apply the existing `hooks/` discipline more
consistently and split the largest components into composable pieces.

---

## 2. Current State Architecture

| State type            | Mechanism                                  | Example locations |
|-----------------------|--------------------------------------------|-------------------|
| Server / remote data  | tRPC + React Query (`*.useQuery/useMutation`) | every page/component |
| Navigation state      | URL params via React Router (`useParams`)  | `LectureLearn`, `TrainingSession` |
| Local UI state        | `useState`                                 | modals, search, form inputs |
| Async control flow     | `useRef` (epochs, timers, in-flight promises) | `useChapterVoicePlayback`, `LectureEdit` auto-save |
| DOM access            | `useRef`                                   | focus, scroll-into-view |
| Derived data          | `useMemo`                                  | filtered chapters, progress |
| Persisted preferences | `localStorage`                             | language, auto-advance, last association |

No Context API, Redux, or Zustand. For the current app size this is a reasonable
choice — server cache + URL state covers most needs. **No global state library is
recommended at this time.**

---

## 3. Hook Management

### 3.1 Current inventory

- `hooks/useChapterVoicePlayback.ts` (314 lines) — the only custom hook.
  Hands-free TTS playback with an epoch-ref cancellation pattern, pausable
  waits, and clean teardown on chapter change/unmount. Well-documented and a
  good model for how to extract complex stateful logic.

### 3.2 Gap analysis — logic that should be hooks but is inline

| Concern | Where it lives now | Problem |
|---------|--------------------|---------|
| Edit-chapter form state | `LectureEdit.tsx`, `ChapterMenu.tsx` | Duplicated state + handlers + sync effect |
| localStorage access | `i18n.ts:25-26`, `LectureLearn.tsx:35,66`, `EditChapterModal.tsx:76,150` | Raw string keys, repeated try/catch, no typing |
| Auto-save orchestration | `LectureEdit.tsx:240-375` | `autoSaveTimeoutRef` + `autoSavePromiseRef` + `isAutoSavingRef` coordination buried in a page |
| Debounced search | `GlobalSearch.tsx` | Debounce logic inline |
| Keyboard navigation | `GlobalSearch.tsx`, `EditChapterModal.tsx`, `TrainingSession.tsx` | Arrow/Enter/Escape handling repeated |

### 3.3 Recommended dedicated hooks

Each below is a new file under `hooks/`.

- **`useEditChapterForm`** *(highest value)* — absorbs the duplicated state
  (`editingAssociation`, `editingQuestions`, `initialAssociation`,
  `initialQuestions`), handlers (`handleAddQuestion`,
  `handleUpdateEditingQuestion`, `handleToggleQuestionExpanded`,
  `handleDeleteEditingQuestion`), and the "sync fetched questions on open" effect
  (`LectureEdit.tsx:79-120`, `ChapterMenu.tsx:46-74`). Both call sites converge on
  one implementation, removing the `react-hooks/set-state-in-effect` suppressions.
  Suggested shape:
  ```ts
  const form = useEditChapterForm({ chapterId, isOpen, isCreating });
  // -> { association, questions, initialAssociation, initialQuestions,
  //      setAssociation, addQuestion, updateQuestion, toggleExpanded,
  //      deleteQuestion, reset }
  ```

- **`useLocalStorage<T>(key, defaultValue)`** — one typed, SSR/private-mode-safe
  accessor replacing the three scattered sites. Centralizes keys (e.g. a
  `STORAGE_KEYS` const) to avoid typos.

- **`useAutoSaveQuestions`** — extracts the debounced auto-save ref orchestration
  from `LectureEdit.tsx` (the create-then-update dedup, in-flight promise
  awaiting, timeout cancellation), returning `{ scheduleAutoSave, flush, cancel }`.

- **`useDebouncedValue<T>(value, ms)`** — replaces inline debounce in
  `GlobalSearch.tsx`; reusable for any future search/filter input.

- **`useKeyboardNavigation`** (or a focused `useListKeyboardNav`) — shared
  Arrow/Enter/Escape handling for the suggestion/result lists currently
  duplicated across `GlobalSearch`, `EditChapterModal`, and `TrainingSession`.

---

## 4. File / Component Organization & God-Component Splitting

Directory layout (`components/`, `pages/`, `hooks/`, `utils/`, colocated
`*.test.*`) is clean and consistent. The issue is a handful of oversized files.

### 4.1 `pages/LectureEdit.tsx` (933 lines) — primary target

After moving form/auto-save logic into the hooks above, split the JSX into
focused components so the page becomes a thin composition:

- `LectureMetadataForm` — title/description form (`LectureEdit.tsx:639-711`).
- `ChapterList` / `ChapterRow` — the chapter rows with reorder dropdown, up/down
  controls, and action buttons (`LectureEdit.tsx:750-885`).
- Keep modals (`EditChapterModal`, `MoveChapterModal`) as-is; the page wires data.

Target: `LectureEdit.tsx` shrinks to orchestration (queries, mutations, layout)
well under ~250 lines.

### 4.2 `components/TrainingSession.tsx` (568 lines)

Extract sub-components: in-session search bar, question display, progress bar, and
the chapter sidebar. Move keyboard navigation into the shared hook (§3.3).

### 4.3 `pages/LectureLearn.tsx` (453 lines)

Separate navigation, the question display, and search; rely on
`useChapterVoicePlayback` (already extracted) plus `useLocalStorage` for
auto-advance persistence.

### 4.4 Naming nits

- `IconButtonDelete` / `IconButtonEdit` / `IconButtonMove` vs the `IconButton`
  base — confirm a consistent variant convention (already barrel-exported via
  `components/buttons/index.ts`).
- `utils/highlightText.tsx` correctly uses `.tsx` because it returns JSX; no
  change needed — just noting the rule for consistency.

---

## 5. Prioritized Recommendations

| Pri | Item | Affected files | Effort | Risk / blast radius |
|-----|------|----------------|--------|---------------------|
| P1  | Extract `useEditChapterForm`, dedupe two call sites | `LectureEdit.tsx`, `ChapterMenu.tsx`, new `hooks/useEditChapterForm.ts` | M | Medium — touches edit flows; cover with tests |
| P1  | Split `LectureEdit.tsx` into `LectureMetadataForm` + `ChapterList` | `LectureEdit.tsx`, new component files | M | Medium — large but mechanical |
| P2  | Add `useLocalStorage<T>` + centralized keys | 3 call sites + new hook | S | Low |
| P2  | Extract `useAutoSaveQuestions` | `LectureEdit.tsx`, new hook | M | Medium — async coordination; test carefully |
| P3  | `useDebouncedValue`, `useKeyboardNavigation` | `GlobalSearch`, `EditChapterModal`, `TrainingSession` | S–M | Low–Medium |
| P3  | Split `TrainingSession.tsx` / `LectureLearn.tsx` | those files + new components | M | Medium |
| P3  | Consider an app-level error boundary | `App.tsx` | S | Low |

Suggested sequence: land the hooks first (they reduce the surface area), then do
the component splits on top of the simplified state.

---

## 6. Out of Scope / Deliberately Fine

- **No global state library** — server cache + URL state is sufficient at current
  size; revisit only if the component tree deepens significantly.
- **Epoch-ref cancellation in `useChapterVoicePlayback`** — intentional and
  correct; leave as-is (well-documented).
- **Existing `exhaustive-deps` / `set-state-in-effect` suppressions** — documented
  and deliberate; the `useEditChapterForm` extraction removes the duplicated ones
  as a side effect, but they are not bugs today.
- **Test setup, i18n, build tooling** — out of scope for this review.
