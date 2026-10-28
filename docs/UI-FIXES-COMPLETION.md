# UI fixes completion — 25 October 2026

Branch: `fix/ui-navigation-accessibility`. Original audit: commit `ae3854b` on `audit/ui-usability-review`.

The documented, actionable UI findings have implementation changes on this branch. The original palette, typography, artwork, and component design are retained. This closes the implementation pass; it does not claim physical-device or screen-reader certification.

## Previous batches

F01–F07: drawer and dialog focus, keyboard/touch navigation, useful link names, collapsed-content access, category navigation, and fullscreen close controls.

F09–F15: image failure/retry, diagram keyboard controls, clipboard recovery, immediate summaries, settings names/state/validation, motion guards, TOC history/focus, progress semantics, and visible row controls. Footer statistics, friend avatar fallback, and default Auto validation were also fixed (F16/F17/F36). Search loading feedback is visible (F40).

## Final batch

| Findings | Changes |
| --- | --- |
| F08/F12 | Audio/video/BGM failures have visible retry feedback. YouTube initialization and playback startup have bounded waits. Stale play rejections are ignored. Settings/BGM chunk loading and failure have visible, dismissible feedback and retry. BGM has a dialog name. |
| F09/F13/F15 | Pinch-to-one-finger drag rebases its origin; touch cancellation ends dragging. Existing Motion components and floating/heading scroll controls respect reduced motion. Inline image fullscreen controls become visible on keyboard focus. |
| F16 | Recommendation headings distinguish related and random posts. Both columns share selection to exclude duplicates and the current post. Non-article pages omit unrelated reading lists. |
| F17 | Contribution loading/failure is readable, with retry and a profile link. The existing grid keeps its palette and geometry; one keyboard stop provides arrow/Home/End navigation and visible day details. |
| F18 | Announcements use the shared named dialog with focus management, Escape, dismissal, and scroll lock. Read actions and links are separate controls. Read state changes through explicit actions instead of hover dwell. Footer expansion state follows the dialog. |
| F19 | Bangumi selects an available group, exposes loading and selected filters, and retains retry. |
| F20 | Moments filters retain the current typed query. The attachment overlay reveals all attachments. Fast pagination no longer waits for an artificial minimum duration. |
| F21 | Password inputs have persistent accessible names; wrong-password errors stay visible and are announced. Both block and full-post unlock initialize nested controls and move focus to unlocked content. Decryption rescans retain existing portals. |
| F22/F23 | Quiz answer names include the answer text; result/reveal focus stays useful. Markdown tabs have panel associations, roving focus, arrows, Home/End, and isolated nested groups. Blur spoilers support keyboard reveal. |
| F24 | CMS search controls remain mounted during refresh; older list responses cannot replace newer results. |
| F25–F28/F39 | Untouched metadata and multiple category paths survive unrelated edits. Save validates title/date, serializes concurrent requests, and preserves the dirty state of later edits. Empty bodies are tracked. Unchanged bodies retain original source even when visual-editor import normalizes the document. Editing detected source-sensitive Markdown requires an explicit conversion warning; Cancel preserves the file. |
| F29–F35/F38 | CMS creation exposes all categories, guards pending dismissal, and bounds the dialog. The narrow editor uses an accessible sidebar overlay; resizing supports pointer and keyboard input. Preview is refreshed and the external link says Saved preview. UI labels/validation use English. Table sort/actions expose context and shared row pending guards. Category hints use `/categories/`. Save toasts remain mounted in the editor. |
| F37 | CMS creation serializes structured YAML, so punctuation in normal titles/tags/categories cannot corrupt frontmatter. |

## Verification

- Focused Chromium fixtures passed for tabs, blur spoilers, four quiz types, persistent password errors, decrypted nested code controls, contribution failure/profile access, announcement dismissal, and mobile document bounds.
- Rejected media playback showed a visible error and working retry action.
- CMS browser checks used intercepted APIs only: delayed search retained focus; metadata and source were preserved; concurrent saves were blocked; later edits remained unsaved; invalid dates blocked saving; save feedback was visible. No real posts were written.
- Tracked-file Biome checks pass. `pnpm check` reports zero errors and warnings; unrelated untracked CTF JavaScript adds diagnostic hints.
- Public production build passes (103 pages). CMS production build passes with existing bundle/externalization warnings.
- Standalone CMS TypeScript validation still has existing errors in `api/list.ts`, `api/write.ts`, `EmbedHydrator.tsx`, `lib/index.ts`, and `marked-link-embed.ts`; changed UI files have no reported type errors.
- Full `pnpm lint` also scans the user's unrelated, untracked `kpmg-ctf/` directory and fails on that material. It was not edited or excluded through a project-wide configuration change.

## Remaining verification limits

Physical Android/iOS gestures, Safari/WebKit, native browser zoom, and actual screen-reader speech remain manual checks, as previously deferred. Optional integrations are still disabled/unconfigured on this blog; source fixes do not establish live service behavior. Arbitrary Markdown/MDX round-trip fidelity is not guaranteed by the visual CMS: the warning is a data-loss safeguard, not a parser compatibility claim.

## Local main merge check — 28 October 2026

Merged `fix/ui-navigation-accessibility` into local `main` by fast-forward to `d4ee2ab`. Nothing was pushed.

- Public production build: passed, 103 pages. CMS production build: passed, with existing bundle warnings.
- Astro validation: zero errors and warnings (68 hints, including unrelated untracked CTF JavaScript).
- Tracked-file Biome check: passed, 519 files. Full `pnpm lint` still fails on the unrelated untracked `kpmg-ctf/` material; it remains untouched.
- Config tests: 18 passed. Markdown tests: 21 passed. TOC tests: 12 passed. Moments tests: 61 passed after updating the stale assertion that required the removed artificial loading delay.
- Migration/backup tests: 34 passed, 22 failed. An isolated checkout of pre-merge `main` (`3a55d7d`) reproduced the same 22 failing test names. These failures predate the UI merge; the migration implementation is unchanged by it.
- Standalone CMS type checking still reports the previously recorded errors outside the changed UI files.
- Chromium production smoke checks passed: keyboard Posts menu, Search, Settings Auto and associated numeric errors, TOC hash/focus, fullscreen close, About/Friends/categories/tags/archives routes, mobile drawer focus restoration and document bounds. No public-page JavaScript errors were observed in these flows.
- CMS smoke checks passed against its local server: dashboard/list loading, retained search focus, Create dialog dismissal, and reachable dialog bounds at 640 × 360. No posts were written.

The merge is validated for these checks. The full repository test command is not green because of the pre-existing migration failures. Previously deferred physical-device and screen-reader checks remain deferred.
