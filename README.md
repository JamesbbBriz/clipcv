# clipcv

> Save the web page you are viewing as a clean PDF or DOCX, locally, using your own Vision LLM API key.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-MV3-success.svg)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Chrome](https://img.shields.io/badge/Chrome-%E2%89%A5116-brightgreen.svg)](#install)
[![BYOK](https://img.shields.io/badge/Mode-BYOK-orange.svg)](#byok-setup)
[![No Telemetry](https://img.shields.io/badge/Telemetry-none-lightgrey.svg)](#privacy)
[![Release](https://github.com/JamesbbBriz/clipcv/actions/workflows/release.yml/badge.svg)](https://github.com/JamesbbBriz/clipcv/actions/workflows/release.yml)

**Languages**: [English](./README.md) · [简体中文](./README.zh-CN.md)

---

clipcv is an open-source Chrome extension (Manifest V3) that converts a single web page you are currently viewing into a structured PDF or DOCX file. Extraction is performed by a Vision LLM endpoint **you configure yourself** — bring your own key (BYOK). Everything runs in your browser. The clipcv project operates no server.

## Table of contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [Install](#install)
- [BYOK setup](#byok-setup)
- [Privacy](#privacy)
- [Use responsibly](#use-responsibly)
- [Tech stack](#tech-stack)
- [Project status](#project-status)
- [Build from source](#build-from-source)
- [Contributing](#contributing)
- [Releasing](#releasing)
- [License](#license)

## Highlights

| | |
|---|---|
| **One-click capture** | A small floating button on the active page triggers a single-page, user-initiated capture. No bulk runs, no scripted automation. |
| **Vision LLM extraction** | A downsampled viewport screenshot and the visible DOM are sent to the endpoint you configured. The model returns structured profile data as JSON, validated by [zod](https://zod.dev). |
| **PDF or DOCX output** | Renders the structured data to a clean PDF (via [pdf-lib](https://github.com/Hopding/pdf-lib)) or DOCX (via [docx](https://github.com/dolanmiu/docx)). Pick PDF, DOCX, or both in settings. |
| **BYOK, any OpenAI-compatible endpoint** | Supply your own provider, base URL, model, and API key. Works with OpenAI, OpenRouter, qwen-vl on a compatibility shim, vLLM, llama.cpp, and any endpoint implementing `/chat/completions` with `image_url` content. |
| **At-rest encryption** | API keys are encrypted with WebCrypto AES-GCM and stored in `chrome.storage.local`. Plaintext keys are never persisted. The encryption key never leaves your browser. |
| **No telemetry** | No analytics SDK, no error reporting, no update beacons. The only outbound HTTP request is the one to the LLM endpoint you configured. |
| **MIT licensed** | No closed-source server component, no proxy, no bundled API key. |

## How it works

```
 ┌──────────────┐    1. click       ┌──────────────────┐
 │  Active tab  │ ───────────────▶ │ Floating button  │
 └──────────────┘                  │ (content script) │
                                   └────────┬─────────┘
                                            │ 2. capture-request
                                            ▼
 ┌────────────────────────────────────────────────────┐
 │  Service worker (MV3, ephemeral)                   │
 │   • chrome.tabs.captureVisibleTab → PNG (≤1280px)  │
 │   • DOM serialized, scripts/styles stripped        │
 │   • payload capped at 1 MB                         │
 └────────────────────────────────────────────────────┘
                                            │ 3. POST /chat/completions
                                            ▼
                                ┌──────────────────────────┐
                                │  Your Vision LLM endpoint │
                                │  (the one you configured) │
                                └──────────────┬───────────┘
                                               │ 4. JSON
                                               ▼
                            ┌──────────────────────────────┐
                            │  zod validates → render PDF  │
                            │  or DOCX via pdf-lib / docx  │
                            └──────────────┬───────────────┘
                                           │ 5. browser download
                                           ▼
                                  Local file on your disk
```

What you do with the downloaded file is up to you. clipcv does not specify a destination or any downstream use for the file.

## Install

### Chrome Web Store

Listing pending review. Once published, the link will appear here.

### Manual install (signed `.crx`)

Each tagged release attaches a signed `.crx` and a `.zip` to the [Releases page](https://github.com/JamesbbBriz/clipcv/releases). Drag the `.crx` onto `chrome://extensions` (Developer mode enabled) to install.

### Developer mode (unpacked)

See [Build from source](#build-from-source).

> On first launch the extension shows a one-time disclaimer modal. You must accept the disclaimer before any capture works. Acceptance is scoped to the current extension version; re-accept on upgrade.

## BYOK setup

clipcv does not bundle a default API key, free tier, or proxy. You configure your own LLM provider before the extension will run a capture.

1. Open the options page: right-click the toolbar icon → **Options**, or `chrome://extensions` → clipcv → **Details** → **Extension options**.
2. Pick a **provider**:
   - **OpenAI** — the OpenAI API.
   - **OpenRouter** — [OpenRouter](https://openrouter.ai) as a unified gateway to many vision models.
   - **OpenAI-compatible custom** — any endpoint implementing the OpenAI `/chat/completions` shape with vision `image_url` content (qwen-vl on a compatibility shim, vLLM, local llama.cpp servers, etc.).
3. Fill in **base URL** (e.g. `https://api.openai.com/v1`), **model** (a vision-capable model id offered by your provider), and your **API key**.
4. Pick a **default output format**: PDF, DOCX, or both.
5. Click **Test connection** to issue a 1-token request and verify credentials. Errors are surfaced as typed codes — `auth_failed`, `timeout`, `model_not_found`, `bad_request`, `rate_limited`, `unknown` — and any string matching `sk-…` or `Bearer …` is scrubbed before display.
6. Click **Save**. Your API key is encrypted at rest with WebCrypto AES-GCM and stored in `chrome.storage.local`.

You can revoke disclaimer acceptance from the same options page; the disclaimer modal will reappear on next popup open.

## Privacy

See [PRIVACY.md](./PRIVACY.md). In summary:

- **No clipcv server.** No analytics, no telemetry, no error reporting.
- **Your captures travel directly** from your browser to the LLM endpoint you configured. The contractual terms with that provider govern how it may use the data you send.
- **All extension state lives in your browser.** Nothing is mirrored off-device by clipcv.
- **API keys are encrypted at rest.** WebCrypto AES-GCM, per-install random 256-bit key. Plaintext is never persisted; secret-shaped strings are scrubbed from any error surfaced to the UI.

## Use responsibly

You are responsible for complying with the terms of service of every website you use clipcv on. clipcv is a single-page, single-click, user-initiated tool. **Do not** use it for bulk extraction, scripted runs, or to access content you are not authorized to access. See [DISCLAIMER.md](./DISCLAIMER.md).

## Tech stack

| Layer | Choice |
|---|---|
| Build | [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev) (MV3) |
| UI | React 18 + TypeScript (strict mode) |
| Styling | Tailwind CSS, scoped via shadow DOM in content scripts |
| Schema | [zod](https://zod.dev) — single source of truth for the LLM response contract |
| PDF | [pdf-lib](https://github.com/Hopding/pdf-lib) |
| DOCX | [docx](https://github.com/dolanmiu/docx) |
| Storage | `chrome.storage.local` + WebCrypto AES-GCM |
| Tests | [vitest](https://vitest.dev) — 74 unit tests, 8 suites |
| CI | GitHub Actions — tag → build → signed `.crx` + `.zip` draft Release |

No backend. No analytics SDK. No npm-based LLM SDKs — calls go through `fetch` directly so the wire format is auditable from the source tree.

## Project status

| | |
|---|---|
| Version | `0.1.0` (MVP) |
| Manifest | V3 |
| Minimum Chrome | 116 |
| Tests | 74 / 74 passing |
| Lines of code | ~2.8K production, ~1.2K test |
| Web Store | Listing in preparation |

## Build from source

```bash
git clone https://github.com/JamesbbBriz/clipcv.git
cd clipcv
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist/` folder.

### Quality gates

```bash
npm run typecheck    # tsc --noEmit, strict mode
npm run test         # vitest run, 74 tests
npm run build        # vite build → dist/
npm run package      # produce release/clipcv-v<version>.{zip,crx}
```

## Contributing

clipcv is MIT-licensed and welcomes contributions. Before opening a PR:

1. Fork the repository and create a feature branch from `main`.
2. Run `npm install`, then `npm run build` to confirm the extension builds cleanly.
3. Pass all quality gates (`typecheck`, `test`, `build`).
4. Keep the change small and scoped to one logical concern. Use a [Conventional Commits](https://www.conventionalcommits.org) prefix (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:` / `ci:`).

### Hard rules — PRs that violate any of these will be rejected

- Inline scripts, `eval`, the `Function(...)` constructor, or any form of remote code execution. Manifest V3 forbids them and so does this project.
- A clipcv-operated server, proxy, or any non-LLM outbound HTTP request.
- Hardcoded URLs, CSS selectors, or DOM probes for any specific website. Extraction must remain a pure prompt-driven Vision LLM call — the same code path runs on every page.
- Analytics, error reporting, or telemetry of any kind.
- User-facing copy (README, popup UI, options page, generated file metadata, store listing, demo video, …) that directs the user toward a specific destination service. The tool produces a file; downstream use is the user's responsibility.
- AI attribution lines in commits, PR descriptions, or code comments.

For larger changes (new dependency, architectural shift), open an issue first to discuss the design.

## Releasing

Releases are produced by GitHub Actions on every `v*` tag push.

1. Bump `version` in `src/manifest.json` and commit.
2. Tag the commit: `git tag v<version>` (e.g. `git tag v0.2.0`).
3. Push the tag: `git push origin v<version>`.
4. The [`release.yml`](./.github/workflows/release.yml) workflow checks out the tag, runs `npm ci`, `npm run build`, and `npm run package`, then creates a **draft** GitHub Release with `release/clipcv-v<version>.zip` and `release/clipcv-v<version>.crx` attached. The release stays in draft so a maintainer can review the artifacts and write user-facing notes before publishing.
5. The CRX signing key is consumed from the `CRX_PRIVATE_KEY` repository secret — a PEM-encoded RSA-2048 private key. Generate it once with `openssl genrsa -out clipcv.pem 2048` and paste the contents into the secret. The same key must be used for every subsequent release so the extension's `.crx` retains a stable id. The PEM must never be committed (`*.pem` is gitignored).

To smoke-test the workflow without a public release, push a prerelease tag such as `v0.0.1-test`. The workflow attaches artifacts to a draft release, which a maintainer can delete afterward.

## License

[MIT](./LICENSE) © clipcv contributors.
