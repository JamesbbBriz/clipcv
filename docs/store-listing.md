# clipcv — Chrome Web Store listing

This document is the canonical source for store-listing copy and asset
specs. Submitting maintainers paste from here verbatim.

## Short description (≤132 chars)

> Save any profile page as a clean PDF or DOCX, locally, with your own
> Vision LLM API key. Open source. No server.

(Length: 112 chars including spaces. Under the 132-char Chrome Web Store
short-description cap.)

## Long description

clipcv is an open-source Chrome extension that converts a single web
page you are currently viewing into a clean PDF or DOCX file using a
Vision LLM API key you configure yourself.

Everything runs locally. The clipcv project does not operate any server.
The only outbound HTTP request the extension makes is the one to the
LLM endpoint you configured.

What clipcv does:

- Adds a small floating button to the page you are viewing.
- On click, sends a viewport screenshot and the visible DOM to the
  Vision LLM endpoint you configured.
- Receives structured JSON back from the model.
- Renders the JSON to a PDF or DOCX file (your choice in settings, or
  both) and triggers a browser download to your local machine.

What you do with the downloaded file is up to you. clipcv does not
specify a destination or any downstream use for the file.

Why BYOK:

- You pick the model that fits your privacy / cost / accuracy trade-off.
- Your API key is encrypted at rest with WebCrypto AES-GCM and stored
  in chrome.storage.local. The encryption key is generated on your
  device and never leaves your browser.
- The extension is provider-agnostic and works with any
  OpenAI-compatible Vision endpoint (OpenAI, OpenRouter, qwen-vl,
  local llama.cpp / vLLM / Ollama servers exposing a compatible API,
  and more).

What clipcv is not:

- Not a web scraper. Each capture is a single-page, single-click,
  user-initiated action. There is no batch mode, no automated crawl,
  no scheduled run, no scripted trigger.
- Not a circumvention tool. clipcv does not bypass authentication,
  paywalls, or bot-detection measures.
- Not a redistribution platform. The output goes to your local
  machine. clipcv does not store, transmit, or republish data on any
  server controlled by the project.

You are responsible for complying with the terms of service of every
website you use clipcv on, with applicable data-protection laws in
your jurisdiction (GDPR, PIPL, PDPA, CCPA, and others), and with the
content policies of the LLM provider you configure.

Open source under the MIT License. Audit every line at the public
GitHub repository. No telemetry. No analytics. No update beacons
beyond what Chrome does for any extension.

## Permissions justification

| Permission | Why |
|---|---|
| `storage` | Save your encrypted provider config and disclaimer-acceptance state in `chrome.storage.local`. |
| `downloads` | Trigger the browser save dialog for the generated PDF / DOCX file. |
| `<all_urls>` host permission | Inject the floating capture button on the page you choose to capture, and let the service worker call `chrome.tabs.captureVisibleTab` to grab the viewport screenshot. The extension makes no outbound HTTP request to any host other than the LLM endpoint you configured. |

The extension does not request `tabs`, `cookies`, `history`, `webRequest`,
`webNavigation`, `bookmarks`, or any background-tab read permission.

## Screenshot specs (5 required)

Chrome Web Store accepts PNG or JPEG at 1280×800 or 640×400. All shots
listed below are captured at 1280×800 against a neutral light theme. None
of them feature a specific named website or third-party brand.

1. **Floating button on a generic article page** —
   `screenshots/01-floating-button.png` (1280×800).
   A neutral-styled web page (a mock blog "About the author" page or a
   public personal homepage) with the floating clipcv button visible
   in the bottom-right corner. Caption: "One-click capture from any
   page you're viewing."
2. **Capture progress** —
   `screenshots/02-capture-progress.png` (1280×800).
   Same page, button mid-flow showing the spinner + the text label
   "Reading page" or "Building file". Cancel button visible.
   Caption: "See progress at every step. Cancel any time."
3. **Generated PDF preview** —
   `screenshots/03-pdf-output.png` (1280×800).
   The PDF output rendered in Chrome's built-in PDF viewer, showing
   the section structure (Header → Summary → Experience → Education →
   Skills) on a fictional sample profile.
   Caption: "Clean A4 PDF. Or DOCX. Or both."
4. **Options / BYOK setup page** —
   `screenshots/04-options-byok.png` (1280×800).
   The extension's options page with provider dropdown, base URL,
   model name, and API key fields visible. The API key field shows a
   masked placeholder (`sk-•••••••••••••••`). The "Test connection"
   button is visible.
   Caption: "Bring your own key. Encrypted at rest with WebCrypto."
5. **Disclaimer modal** —
   `screenshots/05-disclaimer.png` (1280×800).
   The first-launch disclaimer modal in the popup, scrollable, with the
   "I accept" button visible at the bottom.
   Caption: "One-time disclaimer on first install. Acceptance is
   stored locally."

Notes for whoever captures the screenshots:

- Use a freshly-installed Chrome profile with default theme.
- Use a generic mock page (e.g. `about:blank` rendered with sample
  inline HTML) for shots 1–3. Do not use a real, identifiable
  third-party platform's UI in any screenshot.
- All sample personal data (name, email, etc.) must be obviously
  fictional (e.g. "Jane Doe", "j.doe@example.com").
- Crop to exactly 1280×800; do not include the OS title bar or the
  Chrome toolbar's address bar URL string in shots 1–3.

## 30-second demo video script

Target length: 30 s ± 2 s. 1280×800 screen capture, no narration
voiceover (captions only, so the video is portable and accessibility-
friendly). Every visible page is a generic mock or sample page; no
identifiable third-party platform appears.

| t (s) | On-screen | Caption |
|---|---|---|
| 0–3 | Title card: "clipcv — page → file, locally" on a plain background. | clipcv |
| 3–6 | Cursor hovers a generic personal-profile mock page; floating clipcv button is visible bottom-right. | One click. |
| 6–9 | Click the floating button; spinner appears, label changes to "Reading page". | Capture starts. |
| 9–13 | Label cycles "Building file" → "Saving". A subtle progress micro-animation. | Vision LLM extracts. |
| 13–16 | Browser save dialog appears with `Doe_Jane_20260430.pdf` pre-filled. | PDF or DOCX. |
| 16–20 | The saved PDF opens in Chrome's PDF viewer, scrolling through the section structure. | Clean. Local. Yours. |
| 20–24 | Cut to the options page. Provider dropdown opens, showing OpenAI / OpenRouter / Custom. | Bring your own key. |
| 24–27 | The API key field is filled in; "Test connection" returns a green latency indicator. | Encrypted at rest. |
| 27–30 | Title card: "Open source. MIT. github.com/<owner>/clipcv". | clipcv — github.com/<owner>/clipcv |

Hard constraints for the editor:

- Do not include audio voiceover that names a specific third-party
  destination service or downstream tool.
- Do not include any third-party platform's logo, color scheme, or
  identifiable UI chrome.
- Do not show real personal data; use obviously fictional placeholders
  (Jane Doe, j.doe@example.com).
- Do not show any unmasked API key on screen at any frame.

## Submission checklist

Before submitting to the Chrome Web Store:

- [ ] Manifest version in `src/manifest.json` bumped from any
  previously-published version.
- [ ] `npm run typecheck` clean.
- [ ] `npm run test` all green.
- [ ] `npm run build` produces `dist/` that loads as an unpacked
  extension without console errors.
- [ ] A clean test profile (`chrome --user-data-dir=$(mktemp -d)
  --load-extension=dist`) shows the disclaimer modal on first popup
  open.
- [ ] After accepting the disclaimer and configuring a real API key,
  end-to-end capture on a sample blog page produces a valid PDF.
- [ ] Privacy policy URL on the listing points at the rendered
  `PRIVACY.md` (GitHub Pages or the raw GitHub URL).
- [ ] All five screenshots committed under `docs/screenshots/`
  matching the specs above.
- [ ] No copy on the listing or in the demo video names a specific
  third-party destination service or downstream tool.
