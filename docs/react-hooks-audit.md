# React Hooks Audit — `apps/web`

**Date:** 2026-06-03
**Scope:** React hook file organization, ESLint hooks configuration, and best-practice
compliance of the custom hook in the `apps/web` SPA (Vite + React 19.2).
**Method:** Multi-agent review (find → adversarial verify), cross-checked against
React's official Rules of Hooks / `eslint-plugin-react-hooks@7` docs and a second
independent model (codex / GPT-5.5).

> Note: this is a Vite SPA, not Next.js. "Vercel best practices" for hooks therefore
> map to React's own [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
> plus the React-Compiler-aware lint rules shipped in `eslint-plugin-react-hooks@7`.

---

## 1. Hook file organization — PASS (with an inverse caveat)

The web app has **exactly one** custom hook, and it is correctly organized:

- `apps/web/src/hooks/useChapterVoicePlayback.ts` — own dedicated file, correct
  `use`+PascalCase name, typed `Args`/`Result` interfaces, doc comment, and a
  colocated `useChapterVoicePlayback.test.tsx`. **Exemplary; nothing to fix.**

No custom hooks are defined inline inside any component or page. The literal question
("are they in their own files?") is a clean pass.

### Inverse problem: duplicated stateful logic that *should* be hooks

Several large components inline substantial, frequently **duplicated** stateful logic
that belongs in `src/hooks/`:

| Pattern | Occurrences | Suggested hook |
|---|---|---|
| close-on-click-outside | 5 (`GlobalSearch`, `EditChapterModal`, `NavMenu`, `LanguageSelector`, `ExpandableButton`) | `useClickOutside` |
| keyboard / arrow navigation | 6 (`TrainingSession`, `LectureLearn`, `GlobalSearch`, `EditChapterModal`, `ChapterMenu`, `ExpandableButton`) | `useArrowNavigation` / `useListKeyboardNavigation` |
| localStorage-backed prefs | 2 (`LectureLearn`, `EditChapterModal`) | `useLocalStorageState` |
| scroll-selected-into-view | 3 (`TrainingSession`, `LectureLearn`, `GlobalSearch`) | `useScrollIntoViewOnChange` |
| ~330-line auto-save engine | 1 (`LectureEdit.tsx`, 933 lines, 27 hook calls) | `useChapterAutoSave` + `useEditingQuestions` |
| audio synth + play | 2 (`SpeechPlayButton`, the voice hook) | `useSpeechPlayback` |

These are a separate cleanup pass — see issues below for the higher-priority items.

---

## 2. Confirmed findings

Severities below are **reconciled** between the workflow audit and the codex (GPT-5.5)
cross-check. Findings 1, 2, and 5 were corroborated by both models reading the real
code (highest confidence).

### F1 — `toggle` is not memoized (medium)

`useChapterVoicePlayback.ts:249` defines `toggle` as a plain arrow function returned in
the public interface (`:311`), so it gets a fresh identity every render. This forces the
consumer to suppress lint:

- `apps/web/src/pages/LectureLearn.tsx:254-259` excludes `voiceToggle` from a `useEffect`
  dep array with `// eslint-disable-next-line react-hooks/exhaustive-deps`.

**Fix:** wrap `toggle` in `useCallback` (read `enabled` via a ref or `useEffectEvent` for
a stable `[]`), then re-add `voiceToggle` to the consumer deps and drop the suppression.

> ⚠️ Caveat (both models): `toggle` calls `run`, which closes over `speak` → the tRPC
> `synthesize` mutation. Stabilize that chain (e.g. a `runRef`) or the memoized `toggle`
> captures a stale `run`.

> Severity note: downgraded from *high* — real callback-stability issue, but no proven
> stale-closure bug has occurred yet.

### F2 — refs written during render (medium, currently masked from lint)

`useChapterVoicePlayback.ts:79,81,83` assign `questionsRef.current = questions`,
`languageRef.current = language`, `statusRef.current = status` directly in the hook body.
This deviates from React's render-purity model and the `react-hooks/refs` rule.

- **Runtime impact: benign today** — these refs are write-only during render and read
  only post-commit inside the async runner (which is launched from the `toggle` event
  handler, never during render).
- **Currently not flagged** by ESLint due to a whole-hook analysis bailout; fixing F1
  (removing the unrelated suppression) can *unmask* 3 `react-hooks/refs` errors here.

**Fix:** move the mirroring into a `useEffect`, or pass `questions`/`language` as
arguments into `run()` from the event handler.

### F5 — `exhaustive-deps` suppression silences a whole effect (medium)

`LectureLearn.tsx:259` disables `exhaustive-deps` for an effect whose dep list spans
~10 reactive values (`pendingAutoStart`, `autoAdvance`, `voiceStatus`, `voiceIsActive`,
query state, arrays, routing values, `navigate`). ESLint cannot suppress only the intended
`voiceToggle` exclusion, so **future missing deps in this effect go unflagged.**

**Fix:** resolving F1 makes `voiceToggle` stable, allowing the suppression to be removed
entirely and the rule to lint the rest of the effect.

### F4 — `preserve-manual-memoization` suppression (medium — investigate before fixing)

`EditChapterModal.tsx:146` has `// eslint-disable-next-line react-hooks/preserve-manual-memoization`.
This rule protects React-Compiler memoization correctness, so suppressing it is a smell.

> Correction from codex cross-check: **do not blindly drop the `useCallback`.**
> `handleSave`'s deps (`association`, `onSave`) look complete and the setter is stable,
> and `handleSave` is itself a dependency of the keydown effect at `:184` — removing the
> memoization would ripple.

**Fix:** run `eslint --no-inline-config` on the file to read the exact diagnostic first,
then decide between completing the dep array, restructuring, or removing the memoization.

---

## 3. ESLint hooks configuration

`packages/eslint-config/react.js` uses `eslint-plugin-react-hooks@^7.0.1` (React-Compiler-aware)
with React 19. The v7 rules **are active** — verified empirically: `react-hooks/refs`,
`purity`, and `set-state-in-effect` resolve at error level, and 8 suppressions across the
codebase reference v7-only rules.

### F3 — legacy config accessor (low)

`react.js:38` spreads `...reactHooks.configs.recommended.rules`. This is a non-canonical
access path for v7 flat config, but **it works** (rules confirmed active), so this is low
priority.

> Correction from codex cross-check: the originally-suggested replacement
> (`reactHooks.configs['recommended-latest']`) is **not confirmed correct** — v7 flat
> presets may live under `reactHooks.configs.flat.*`, and `recommended-latest` skews toward
> newer/experimental rules. The worktree has no `node_modules`, so the exact export could
> not be introspected by either model.

**Fix (optional):** if changing, first introspect the installed plugin's exports —
`node -e "console.log(Object.keys(require('eslint-plugin-react-hooks').configs))"` — rather
than guessing the accessor.

### `set-state-in-effect` suppressions — all justified (no action)

The 6 `set-state-in-effect` disables (`Toast:27`, `ChapterMenu:58`, `TrainingSession:127`,
`GlobalSearch:30`, `EditChapterModal:78`, and one more) are legitimate guarded one-shot
init / sync-on-open patterns. No change required.

---

## 4. Refuted / non-issues

The adversarial verification pass **refuted 9 of 14 raised findings** on the voice hook.
The hook's epoch-based abort design + event-handler-initiated runner make most speculative
concerns benign. Notably:

- **`useEffectEvent` for the runner — refuted (would be invalid).** Effect Events may only
  be called from inside an Effect; the runner is click-driven, so this refactor would
  introduce a real Rules-of-Hooks violation.
- Effect-cleanup race concerns (audio `play()` rejection after teardown, resume re-play,
  setState-after-unmount) — all benign given the epoch guard + Promise settle-once +
  idempotent `releaseAudio`.
- `Date.now()` for pause/resume timing — cosmetic nit (sub-second inter-card gap only),
  not a hooks violation.
- The `abort` cleanup `exhaustive-deps` suppression (`:299`) — correct and intentional;
  removable only as lint-cleanliness polish.

---

## 5. Recommended action order

1. **F1** — memoize `toggle` (stabilize the `run`→`speak`→`synthesize` chain). Unblocks F5.
2. **F2** — move render-phase ref writes into an effect.
3. **F5** — remove the now-unnecessary blanket `exhaustive-deps` suppression in `LectureLearn`.
4. **F4** — inspect the `preserve-manual-memoization` diagnostic, then fix.
5. **F3** — optional ESLint-config cleanup (verify accessor empirically first).
6. Duplication extractions (`useClickOutside`, `useLocalStorageState`, etc.) — separate pass.

F1, F2, and F5 are the safe, two-model-corroborated starting point and are covered by the
existing `useChapterVoicePlayback.test.tsx` suite for validation.
