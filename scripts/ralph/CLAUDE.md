# Ralph Agent Instructions — clipcv

You are an autonomous coding agent working on **clipcv** — an open-source
Chrome extension that converts a single profile page into a clean PDF or
DOCX file via the user's own Vision LLM API key (BYOK).

## Project Context

- **Single repo**: `clipcv/` — not a monorepo, no separate frontend/backend.
- **Working directory**: The repo root (`clipcv/`).
- **License**: MIT (open source).
- **Distribution target**: Chrome Web Store + signed `.crx` on GitHub Release.
- **Tech stack** (locked, see `CLAUDE.md` §5): Vite + @crxjs/vite-plugin +
  React 18 + TypeScript strict + zod + pdf-lib + docx + vitest +
  ESLint + Prettier + GitHub Actions.
- **No backend**, **no server**, **no analytics**, **no telemetry**.
  The clipcv project does not operate any server. All runtime is in
  the user's browser.
- **Hard architectural rules** are in `../../CLAUDE.md` §6 (relative to
  this file, i.e. `clipcv/CLAUDE.md` §6). Re-read every iteration.

## Communication

- **与用户沟通用中文**，code 和 commit message 用 English。
- **NEVER add AI attribution** to commits, PRs, or code comments
  (no "Co-Authored-By: Claude", no "Generated with Claude Code").

## Your Task — every iteration

1. **Read `CLAUDE.md`** at the repo root — the project constitution. Re-read
   every iteration; project-level rules win over story acceptance criteria.
2. **Read `ralph/prd.json`** and pick the **highest priority** user story
   where `passes: false`.
3. **Read `ralph/progress.txt`** — start with the "Codebase Patterns"
   section to inherit prior-iteration learnings.
4. **Confirm branch**. The PRD's `branchName` is `ralph/clipcv-mvp`.
   If not on that branch, create it from the current `main` and check out.
5. **Implement that single user story.** Stay within the story's
   declared scope. If the story balloons past ~300 LOC across > 5 files,
   stop and decompose; surface to the user.
6. **Run quality checks** per `CLAUDE.md` §7.2 + §7.3:
   - `npm run typecheck` (or `npx tsc --noEmit` if no script yet)
   - `npm run lint` (or `npx eslint .` if no script yet)
   - `npm run test` (if the story includes unit tests in its AC)
   - For UI stories: `npm run build` and load `dist/` in `chrome://extensions`
     (or run `chrome --user-data-dir=$(mktemp -d) --load-extension=dist`
     for a clean profile)
   - For doc stories: grep the `CLAUDE.md` §6.4 forbidden patterns over
     touched files; expect 0 matches.
7. **Verification gate** (`CLAUDE.md` §7.3) must pass for the story type.
   If any check fails, fix and re-run; do not move on.
8. **If checks pass**, commit ALL changes for the story with conventional
   format: `feat(clipcv): US-NNN — short title` (or `fix:` / `chore:` /
   `docs:` / `test:` / `ci:` as appropriate).
9. **Update `ralph/prd.json`**: set `passes: true` for the completed
   story; set `notes` to a 1–2 sentence summary of the verification
   results (e.g. "manifest.json + dist/popup.js produced; loaded
   unpacked successfully; typecheck + lint clean").
10. **Append to `ralph/progress.txt`** using the format below.

## Progress Report Format

APPEND to `ralph/progress.txt` (never replace, always append):

```
## YYYY-MM-DD — US-NNN — <short title>

- Files changed:
  - path/to/file: 1-line description of the change
- Verification commands run:
  - `npm run typecheck` → OK
  - `npm run test src/lib/extract/__tests__/*.test.ts` → 4 passed
  - `npm run build` → dist/ produced (manifest.json + popup.js + ...)
  - (UI stories) loaded unpacked in chrome://extensions → button visible, click triggers ...
- Codebase patterns established (added to top of progress.txt under "## Codebase Patterns" if reusable):
  - <one bullet per pattern future stories should reuse>
- Notes / surprises:
  - <anything non-obvious encountered, with 1-line explanation>

---
```

The "Codebase Patterns" section at the top of `progress.txt` is the
running ledger. Every iteration should inherit it. When you discover a
reusable pattern (e.g. "BYOK encryption uses WebCrypto's
`crypto.subtle.encrypt` with random IV per call"), promote it to that
section in the same iteration.

## Hard Rules — non-negotiable per iteration

These come from `CLAUDE.md` §6 and are repeated here so the runner
agent re-checks them every iteration. If a story's acceptance criterion
contradicts any of these, **do not proceed** — surface the contradiction
to the user.

1. **Manifest V3 compliance**: no inline scripts, no `eval`, no remote
   code, MV3 service-worker pattern.
2. **BYOK invariant**: API keys never leave the user's browser to any
   project-controlled server. There is no project-controlled server.
   At-rest encryption via WebCrypto AES-GCM in `chrome.storage.local`.
3. **No site-specific code**: no hardcoded URL allowlist beyond
   `<all_urls>`, no site-specific selectors, no
   `if (location.hostname === '...')`. Pure prompt-driven Vision LLM
   extraction.
4. **No downstream-direction copy**: no surface (README, DISCLAIMER,
   PRIVACY, popup UI, settings page, store listing, demo video,
   generated file metadata) names a specific destination service, ATS,
   CRM, or workflow. The tool produces a file; downstream use is the
   user's responsibility.
5. **No telemetry**: no analytics, no error reporting service, no
   update beacons beyond the browser store mechanism. No outbound HTTP
   from the extension other than to the user's configured LLM endpoint.
6. **Story-scoped commits**: one commit per story, conventional format,
   no AI attribution, no `--force`, no `--no-verify`.

## Decomposition Rule

If a story's implementation crosses > 300 LOC across > 5 files, **stop**
and:
1. Add a comment to `progress.txt` explaining why the story is too big.
2. Suggest decomposition to the user as 2–3 sub-stories.
3. Do not commit a partial implementation. Wait for direction.

## When to ask the user vs. decide

Decide independently:
- Two valid implementations of the same AC; pick the smaller-blast-radius one.
- Library version pinning (latest stable usually works).
- Naming a private function or variable.

Ask the user:
- An AC contradicts `CLAUDE.md` §6 hard rules.
- A new dependency category not covered in `CLAUDE.md` §5.
- Any destructive operation (`rm -rf`, `git reset --hard`, `git push -f`,
  deleting `chrome.storage.local` data outside the documented "revoke
  acceptance" code path).

## End of iteration checklist

- `git status` clean.
- One conventional commit landed on `ralph/clipcv-mvp`.
- `ralph/prd.json`: target story has `passes: true` and `notes` filled.
- `ralph/progress.txt`: per-story entry appended; "Codebase Patterns"
  promoted if applicable.
- All hard rules in `CLAUDE.md` §6 still hold (re-grep if a doc-touching
  story for §6.4 forbidden patterns).

If any of the above is not true, the iteration is incomplete — finish
before yielding.
