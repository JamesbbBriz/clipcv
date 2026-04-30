# clipcv

> Save any profile page as a clean PDF or DOCX, locally, with your own
> Vision LLM API key.

clipcv is an open-source Chrome extension that converts a single web page
you are currently viewing into a structured PDF or DOCX file. It uses a
Vision LLM API key you configure yourself (BYOK — bring your own key).
Everything runs locally in your browser. The clipcv project does not
operate any server.

## Features

- **One-click capture** — a small floating button on the page you are
  viewing kicks off the capture. Single-page, single-click,
  user-initiated only.
- **Vision LLM extraction** — the visible viewport screenshot and the
  visible DOM are sent to the LLM endpoint you configured. The model
  returns structured profile data as JSON.
- **PDF or DOCX output** — render the structured data to a clean PDF
  (via [pdf-lib](https://github.com/Hopding/pdf-lib)) or DOCX
  (via [docx](https://github.com/dolanmiu/docx)). Pick PDF, DOCX, or
  both in settings.
- **BYOK** — you supply your own LLM provider, base URL, model, and API
  key. The extension supports any OpenAI-compatible Vision endpoint.
- **At-rest encryption** — your API key is encrypted with WebCrypto
  AES-GCM and stored in `chrome.storage.local`. The key never leaves
  your browser.
- **No telemetry** — no analytics, no error reporting, no update
  beacons. The only outbound HTTP request is the one to the LLM
  endpoint you configured.
- **MIT licensed**, open source, no closed-source server component.

## How it works

1. You're viewing a profile page in Chrome.
2. Click the floating clipcv button injected on the page.
3. A viewport screenshot and the visible DOM are sent to the Vision LLM
   provider you configured.
4. The model returns structured JSON.
5. clipcv renders the JSON to a PDF or DOCX file and triggers a browser
   download to your local machine.

What you do with the downloaded file is up to you. clipcv does not
specify a destination or any downstream use for the file.

## Install

Coming soon to the Chrome Web Store. To build from source:

```bash
git clone <repo-url>
cd clipcv
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

On first launch the extension shows a one-time disclaimer modal. You
must accept the disclaimer before any capture works.

## BYOK setup

clipcv does not bundle a default API key, free tier, or proxy. You must
configure your own LLM provider before the extension will run a
capture.

1. Open the extension's options page (right-click the toolbar icon →
   **Options**, or `chrome://extensions` → clipcv → **Details** →
   **Extension options**).
2. Pick a **provider**:
   - **OpenAI** — use the OpenAI API.
   - **OpenRouter** — use [OpenRouter](https://openrouter.ai) as a
     unified gateway to many vision models.
   - **OpenAI-compatible custom** — point at any endpoint that
     implements the OpenAI `/chat/completions` shape with vision
     `image_url` content (qwen-vl, Claude on a compatibility shim,
     local llama.cpp servers, vLLM, etc.).
3. Fill in **base URL** (e.g. `https://api.openai.com/v1`),
   **model** (e.g. a vision-capable model id offered by your
   provider), and your **API key**.
4. Pick a **default output format**: PDF, DOCX, or both.
5. Click **Test connection** to issue a tiny single-token request and
   confirm the credentials work. Errors are surfaced as typed codes
   (`auth_failed`, `timeout`, `model_not_found`, `bad_request`,
   `rate_limited`, `unknown`); secret-looking strings are scrubbed
   from any error message before display.
6. Click **Save**. Your API key is encrypted at rest with WebCrypto
   AES-GCM and stored in `chrome.storage.local`.

You can revoke your disclaimer acceptance from the same options page;
on next popup-open the disclaimer modal will re-appear.

## Privacy

See [PRIVACY.md](./PRIVACY.md). In short:

- No clipcv server. No analytics. No telemetry.
- Your captures go directly from your browser to the LLM endpoint you
  configured. The contractual terms with that provider govern how the
  provider may use the data you send.
- The only data persisted by the extension lives in your browser's
  local storage.

## Use responsibly

You are responsible for complying with the terms of service of every
website you use clipcv on. clipcv is a single-page, single-click,
user-initiated capture tool. Never use it for bulk extraction,
scripted runs, or to access content you do not have legitimate
authorization for. See [DISCLAIMER.md](./DISCLAIMER.md).

## Tech stack

- **Build**: Vite + [@crxjs/vite-plugin](https://crxjs.dev) for MV3.
- **UI**: React 18 + TypeScript strict.
- **Schema**: [zod](https://zod.dev) for the LLM response contract.
- **Renderers**: [pdf-lib](https://github.com/Hopding/pdf-lib) and
  [docx](https://github.com/dolanmiu/docx).
- **Tests**: [vitest](https://vitest.dev).
- **Storage**: `chrome.storage.local` + WebCrypto AES-GCM.
- **Manifest**: V3, service-worker background.

No backend. No analytics SDK. No npm-based LLM SDKs (calls to LLM
providers go through `fetch` directly so the wire format is
auditable).

## Contributing

clipcv is MIT-licensed and welcomes contributions.

1. Fork the repository and create a feature branch from `main`.
2. Run `npm install` then `npm run build` to confirm the extension
   builds cleanly.
3. Run the quality gates locally:
   - `npm run typecheck` — TypeScript strict, no errors.
   - `npm run test` — vitest, all green.
   - `npm run build` — the extension builds and `dist/` loads as an
     unpacked extension without errors.
4. Keep changes small. Each pull request should be scoped to one
   logical change. Commits use the conventional prefix
   (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:` /
   `ci:`).
5. **Hard rules** — pull requests are rejected if they:
   - Introduce inline scripts, `eval`, or remote code execution
     (Manifest V3 forbids them).
   - Add a clipcv-operated server or any non-LLM outbound HTTP
     request.
   - Hardcode any specific website's URL, selectors, or DOM probes.
     The extraction must remain a pure prompt-driven Vision LLM call.
   - Add analytics, error reporting, or telemetry of any kind.
   - Direct the user toward a specific destination service in any
     user-facing copy (README, popup UI, options page, generated file
     metadata, store listing, demo video, …). The tool produces a
     file; downstream use is the user's responsibility.
   - Add an AI attribution line to a commit, PR description, or
     code comment.

For larger changes (new dependency, architectural shift), open an
issue first to discuss the design.

## Releasing

Releases are produced by GitHub Actions on every `v*` tag push.

1. Bump `version` in `src/manifest.json` and commit.
2. Tag the commit: `git tag v<version>` (e.g. `git tag v0.2.0`).
3. Push the tag: `git push origin v<version>`.
4. The `.github/workflows/release.yml` workflow checks out the tag,
   installs dependencies (`npm ci`), runs `npm run build`, runs
   `npm run package`, and creates a **draft** GitHub Release with
   `release/clipcv-v<version>.zip` and `release/clipcv-v<version>.crx`
   attached. The release is left in draft state so a maintainer can
   review the artifacts and write the user-facing notes before
   publishing.
5. The CRX signing key is consumed from the `CRX_PRIVATE_KEY` repo
   secret — a PEM-encoded RSA-2048 private key. Generate it once
   with `openssl genrsa -out clipcv.pem 2048` and paste the contents
   into the repository secret. The same key must be used for every
   subsequent release so the extension's `.crx` keeps a stable id.
   The PEM must never be committed (`*.pem` is gitignored).

To smoke-test the workflow without producing a public release, push a
prerelease tag such as `v0.0.1-test`. The workflow still runs and
attaches the artifacts to a draft release, which a maintainer can
delete afterward.

## License

MIT — see [LICENSE](./LICENSE).
