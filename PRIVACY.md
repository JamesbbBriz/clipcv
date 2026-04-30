# clipcv — Privacy Policy

*Last updated: 2026-04-30*

## TL;DR

clipcv runs entirely in your browser. Your captured page data goes
directly to **your own** LLM provider using **your own** API key. The
clipcv project does not operate any server that sees your captures, your
API keys, your extracted data, or your downloaded files.

## What clipcv stores locally

The extension stores the following in your browser's local storage
(chrome.storage.local), encrypted at rest with a key generated on your
device:

- Your LLM provider configuration (provider name, base URL, model name).
- Your LLM API key (encrypted with WebCrypto AES-GCM; the encryption key
  never leaves your browser).
- Your output preference (PDF / DOCX / both).
- Your acceptance of the disclaimer (boolean + timestamp + version).

Local storage data is removed if you uninstall the extension or clear
browser storage.

## What clipcv sends, and where

When you click the capture button on a page:

1. A screenshot of the visible viewport and a snapshot of the visible DOM
   are produced **inside your browser**.
2. The extension sends them to the LLM endpoint you configured.
3. The LLM returns structured JSON.
4. The extension renders that JSON to a PDF or DOCX file and triggers a
   browser download to your local machine.

**No data is sent to any clipcv-operated server.** There is no clipcv
server.

## What the LLM provider sees

The LLM provider you configure sees:

- The viewport screenshot.
- The visible DOM HTML (with `<script>` / `<style>` / `<noscript>` stripped).
- Your prompt instructing the model to extract structured profile data
  as JSON.

Your contractual relationship with the LLM provider governs how that
provider may use, retain, or process the data you send. clipcv is not
party to that relationship.

## Permissions explanation

| Permission | Why |
|---|---|
| `activeTab` | Read the active tab's content when you click the capture button. |
| `storage` | Save your encrypted config and acceptance state locally. |
| `downloads` | Trigger the browser save dialog for the generated file. |
| `<all_urls>` host permission | Inject the floating capture button on the page you choose to capture. |

The extension does **not** request permission to read your browsing
history, cookies, or background tabs.

## What we do not collect

clipcv has no analytics, no telemetry, no error reporting, no crash
reporting, and no update beacons beyond what Chrome does for any
extension installed from its store.

## Open source

clipcv is open source under the MIT License. You can audit every line of
code at the public GitHub repository. There is no closed-source server
component.

## Contact

For privacy questions, open an issue on the public GitHub repository.
