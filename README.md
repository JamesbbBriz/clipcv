# clipcv

> Save any profile page as a clean PDF or DOCX, locally, with your own AI key.

A Chrome extension that uses your own Vision LLM API key (BYOK) to extract
structured profile data from a page you're viewing and renders it to a
PDF or DOCX file. Everything runs locally. The clipcv project does not
operate any server.

## How it works

1. You're on a profile page in your browser.
2. Click the floating clipcv button.
3. The extension sends a viewport screenshot and the visible DOM to the
   Vision LLM provider you configured (qwen-vl, Claude vision, GPT-4
   vision, or any OpenAI-compatible vision endpoint you set up yourself).
4. The model returns structured profile data as JSON.
5. clipcv renders the JSON to a PDF or DOCX file that downloads to your
   machine.

What you do with that file is up to you. clipcv does not specify a
destination, an integration, or a workflow.

## Use responsibly

You are responsible for complying with the terms of service of every
website you use clipcv on. clipcv is a single-page, single-click,
user-initiated capture tool — never use it for bulk extraction, scripted
runs, or to access content you do not have legitimate authorization for.
See [DISCLAIMER.md](./DISCLAIMER.md).

## Install

Coming soon to the Chrome Web Store. To build from source:

```bash
git clone <repo-url>
cd clipcv
npm install
npm run build
# In Chrome: chrome://extensions, enable Developer mode, "Load unpacked",
# select the dist/ folder.
```

## License

MIT — see [LICENSE](./LICENSE).
