# CLAUDE.md

This file is read at the start of every Ralph iteration. It is the project's
constitution. Every story execution must respect every rule below. Where a
specific story acceptance criterion conflicts with a rule here, the rule wins.

---

## 1. Minimum Blast Radius — overriding principle

- 1 file fix > 2 file fix.
- 1 dependency added > 0 dependency added (always justify why a new dep is
  needed; prefer the standard library or existing dep).
- Add to an existing module > create a new module.
- Smallest set of acceptance criteria touched > broadest.

If a story can be implemented in two ways, pick the one that touches fewer
files / fewer LOC / fewer concepts. "More elegant" does not beat
"smaller blast radius."

**Destructive operations require explicit user confirmation** before
running. Never `rm -rf`, never `git reset --hard`, never `git push -f`,
never delete chrome.storage.local outside of the explicit "revoke
acceptance" code path. If a story seems to require a destructive
operation, stop and ask.

---

## 2. Communication Language

- All conversation with the user, all progress.txt entries, all PR
  descriptions: **Chinese**.
- Code, code comments, commit messages, README/DISCLAIMER/PRIVACY,
  identifiers, error messages: **English**.

---

## 3. Commit & PR Rules

- **Never** add "Generated with Claude", "Co-Authored-By: Claude", or any
  AI attribution to commits, PRs, or code comments.
- Commit messages read as if written by the developer directly.
- Conventional format with prefixes: `feat:` / `fix:` / `chore:` /
  `docs:` / `refactor:` / `test:` / `ci:`.
- One commit per story. The commit message body must reference the
  story id (e.g. `US-003`).
- Never `git push --force` to `main`. Never `git push --no-verify`.

---

## 4. Project Overview

clipcv is an open-source Chrome extension under MIT License. It converts
a single profile page the user is currently viewing into a clean PDF or
DOCX file via a Vision LLM API key the user configures themselves
(BYOK). The extension runs entirely in the user's browser. The clipcv
project does not operate any server.

The extension is a **generic page-to-document converter**. It targets no
specific website. It contains no site-specific selectors. It contains
no destination integration with any specific service. What the user
does with the produced file is outside the project's scope.

---

## 5. Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Build tool | **Vite + @crxjs/vite-plugin** | First-class MV3 + HMR support |
| UI runtime | **React 18 + TypeScript strict** | Standard, widely auditable |
| State / storage | **chrome.storage.local + WebCrypto** | No external persistence |
| Schema validation | **zod** | Single source of truth for LLM responses |
| PDF rendering | **pdf-lib** | Deterministic, no server, MIT |
| DOCX rendering | **docx** (npm package) | Deterministic, no server, MIT |
| Test runner | **vitest** | Native Vite integration |
| Lint | **eslint** with `@typescript-eslint` strict + `eslint-plugin-react-hooks` | |
| Format | **prettier** with the project default | |
| CI | **GitHub Actions** | Free for open source |
| Distribution | **Chrome Web Store** + signed `.crx` on GitHub Release | |

Do **not** introduce any of: Webpack, Babel standalone, Jest, npm-based
LLM SDKs (call providers directly via `fetch` for transparency).

---

## 6. Hard Architectural Rules — never violated

These rules are enforced by `globalQualityGates` in `ralph/prd.json` and
must be re-checked in every story:

### 6.1 Manifest V3 compliance
- No inline scripts. No `eval`. No `Function(...)` constructor.
- No remote code execution. All JS bundled at build time.
- Background entry is a service worker, not a persistent background page.
- All async work in the service worker tolerates the SW being killed
  between events (no in-memory state that survives idle).

### 6.2 BYOK data-flow invariant
- User-supplied API keys **never** leave the user's browser to any
  server controlled by this project. There is no project-controlled
  server.
- API keys at rest in `chrome.storage.local` are encrypted with
  WebCrypto AES-GCM keyed off a 256-bit random key generated on first
  install. The key is stored alongside the ciphertext in
  `chrome.storage.local`. The key never leaves the browser.
- API keys never appear in `console.log`, `console.error`, telemetry,
  thrown error messages, or downloaded file metadata. A regex scrubber
  matching `sk-[A-Za-z0-9]{16,}` and `Bearer [A-Za-z0-9._-]{20,}` is
  applied to every user-facing error message before display.

### 6.3 No site-specific code
- No hardcoded URL allowlist beyond `<all_urls>` in `manifest.json`.
- No site-specific CSS selectors anywhere.
- No site-specific DOM probing (e.g. `if (location.hostname === '...')`).
- The extraction is a pure prompt-driven Vision LLM call. The same code
  path runs identically on every page.

### 6.4 No downstream-direction copy
- README, DISCLAIMER, PRIVACY, popup UI, settings page, store listing,
  demo video script, generated PDF/DOCX metadata, and any other
  user-facing surface **must not** name a specific destination service,
  ATS, CRM, workflow, or workflow-by-description.
- Allowed: "save the file", "the file downloads to your machine",
  "what you do with the file is up to you".
- Forbidden: "upload to your ATS", "import to your CRM", "send to
  recruiter", "feed your matching pipeline", "compatible with X".

When a story acceptance criterion describes user-visible copy, scan it
for the forbidden patterns before marking `passes=true`.

### 6.5 No telemetry
- No analytics SDK.
- No error reporting service.
- No update beacons beyond what the browser does for any extension.
- No outbound HTTP requests from the extension other than to the LLM
  endpoint the user configured.

---

## 7. Story Execution Workflow — every story follows this

### 7.1 Read-before-write
1. Read `ralph/prd.json` and identify the next story with `passes: false`.
2. Read its acceptance criteria fully.
3. Read this CLAUDE.md.
4. Read `ralph/progress.txt` to pick up codebase patterns from prior stories.
5. List the files the story will touch, mentally pre-compute the diff
   size. If the story seems to balloon past ~300 LOC, stop and decompose.

### 7.2 Implementation
6. Implement the story.
7. Run `npm run typecheck` (or `npx tsc --noEmit` if no script yet).
8. Run `npm run lint` (or `npx eslint .` if no script yet) and fix all
   warnings/errors.
9. If the story has unit tests in its acceptance criteria, run
   `npm run test` and confirm green.
10. If the story is UI-touching, run `npm run build`, load `dist/` in
    `chrome://extensions` as unpacked, and verify the acceptance
    criteria visually.

### 7.3 Verification gate (story-type-specific)

Per story type, the **minimum verification before passes=true**:

| Story type | Examples | Required verification |
|---|---|---|
| Scaffold / build setup | US-001, US-014, US-015 | `npm run build` succeeds + listed artifacts exist with non-zero size |
| Pure logic | US-006, US-007, US-008, US-009, US-010 | unit tests green; happy path + at least 1 error path covered |
| UI / extension surface | US-002, US-003, US-004, US-011, US-012 | unpacked extension loads cleanly; user-facing flow demonstrably works in real Chrome (`chrome --user-data-dir=$(mktemp -d) --load-extension=dist`) |
| Documentation | US-013 | grep the rule-6.4 forbidden patterns over the touched files; `markdownlint` clean |

If any verification step fails, the story does **not** mark
`passes: true`. Fix and re-run, do not move on.

### 7.4 Logging
11. Append a per-story entry to `ralph/progress.txt`:
    ```
    ## YYYY-MM-DD — US-NNN — <title>

    - Files changed:
      - path/to/file: short description of the change
    - Verification commands run:
      - `npm run typecheck` → OK
      - `npm run test src/...` → 4 passed
      - `npm run build` → dist/ produced
    - New codebase patterns established (if any):
      - <one bullet per pattern future stories should reuse>
    - Notes / surprises:
      - <anything non-obvious encountered, with 1-line explanation>
    ```
12. Update the story's `passes: true` and `notes` in `ralph/prd.json`.
13. Commit, conventional format, single story scope.

---

## 8. Acceptance Criterion Sharpness

Every acceptance criterion in `ralph/prd.json` must be **mechanically
verifiable**. Vague language is a bug.

- ✅ Good: `"npm run build emits dist/ with manifest.json and at least one bundled .js file, all non-zero bytes"`
- ❌ Bad: `"build works"`
- ✅ Good: `"On 4xx LLM response, the extension surfaces a typed error of type AuthError or BadRequestError; no raw stack trace shown to user"`
- ❌ Bad: `"handles errors"`

If a story has a vague AC, **add precision in the same iteration** and
re-commit prd.json before marking the story passed. The next iteration
should not inherit the vagueness.

---

## 9. Code Style

- **TypeScript strict** + `noUncheckedIndexedAccess: true` +
  `exactOptionalPropertyTypes: true`.
- **No `any`** outside ts-comment-justified boundaries (e.g. `chrome`
  types in odd corners). Each `any` requires an inline `// any-justified:
  <reason>` comment.
- **No default exports** for new modules — named exports only.
- **No file longer than 300 LOC**. If a story produces a >300 LOC file,
  decompose before commit.
- **No CSS-in-JS for content scripts** — Tailwind utility classes only,
  scoped via shadow DOM.

---

## 10. Security Boundaries

### 10.1 Inputs we treat as untrusted
- Page DOM (any web page can serve hostile HTML).
- LLM responses (a hostile/buggy model can return injection payloads).
- File names from the LLM (e.g. extracted name field) — sanitize before
  using as filename: drop `/`, `\`, `:`, `..`, control chars; cap to
  64 chars; default to `clipped` if empty after sanitization.

### 10.2 Inputs we treat as trusted
- The user's own LLM API key from settings.
- The user's own toggle states.

### 10.3 Cross-context messaging
- All `chrome.runtime.sendMessage` payloads are typed via a discriminated
  union (`type Msg = {kind: 'capture-request'} | {kind: 'capture-result', ...}`).
- Service worker rejects messages of unknown kind.

---

## 11. Naming

- The extension's display name is `clipcv` (lowercase). Do not rename
  without an explicit user instruction.
- Extension internal id is generated by Chrome from the manifest's
  pubkey; do not hardcode.
- The output file name pattern is `{Name_or_Unknown}_{YYYYMMDD}.{pdf|docx}`.
  `Name` is sanitized per §10.1.

---

## 12. What this project does NOT do (kept here so future iterations
remember why)

- Does not crawl. Does not batch. Does not schedule. Does not run
  unattended. Every capture is a single-page user-initiated click.
- Does not push to any specific service. Output is a local file. The
  user picks what to do next.
- Does not run a server, store user data centrally, ship analytics, or
  beacon updates outside the browser store mechanism.
- Does not include site-specific selectors or extraction recipes. The
  same prompt+model handles every site.
- Does not bundle a default API key, free tier, or proxy. BYOK is the
  only mode.

If a story acceptance criterion appears to ask for any of the above,
the criterion is wrong — surface it and refuse the iteration.

---

## 13. When to ask the user vs. decide

Ralph should decide independently when:
- The choice is between two valid implementations of the same AC and
  one is smaller blast radius.
- A library version needs picking and the latest stable works.
- Naming a private function or variable.

Ralph should stop and ask the user when:
- An AC contradicts a rule in this CLAUDE.md (don't paper over).
- A new dependency category is needed (e.g. "this story would need a
  PDF rendering lib" — we already picked pdf-lib in §5, so this is
  rare).
- A destructive operation appears necessary.
- A change touches > 300 LOC across > 5 files (decompose or escalate).

---

## 14. End of iteration

After a story passes, before exiting:
- Confirm `ralph/progress.txt` updated.
- Confirm `ralph/prd.json` story marked `passes: true` with a 1-line `notes`.
- Confirm a single story-scoped commit landed on the active branch.
- Confirm `git status` is clean.

If any of these are not done, the iteration is incomplete — finish them
before yielding to the next iteration.
