# clipcv

> 把你正在浏览的网页一键转成干净的 PDF 或 DOCX，本地完成，使用你自己的 Vision LLM API key。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-MV3-success.svg)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Chrome](https://img.shields.io/badge/Chrome-%E2%89%A5116-brightgreen.svg)](#%E5%AE%89%E8%A3%85)
[![BYOK](https://img.shields.io/badge/Mode-BYOK-orange.svg)](#byok-%E9%85%8D%E7%BD%AE)
[![No Telemetry](https://img.shields.io/badge/Telemetry-none-lightgrey.svg)](#%E9%9A%90%E7%A7%81)
[![Release](https://github.com/JamesbbBriz/clipcv/actions/workflows/release.yml/badge.svg)](https://github.com/JamesbbBriz/clipcv/actions/workflows/release.yml)

**语言**：[English](./README.md) · [简体中文](./README.zh-CN.md)

---

clipcv 是一款开源的 Chrome 扩展（Manifest V3），它把你当前正在浏览的网页转成结构化的 PDF 或 DOCX 文件。提取过程由你自己配置的 Vision LLM 端点完成 —— BYOK（Bring Your Own Key，自带密钥）。所有运算都在你的浏览器内进行，clipcv 项目不运行任何服务器。

## 目录

- [核心特性](#核心特性)
- [工作原理](#工作原理)
- [安装](#安装)
- [BYOK 配置](#byok-配置)
- [隐私](#隐私)
- [合规使用](#合规使用)
- [技术栈](#技术栈)
- [项目状态](#项目状态)
- [从源码构建](#从源码构建)
- [参与贡献](#参与贡献)
- [发布流程](#发布流程)
- [许可证](#许可证)

## 核心特性

| | |
|---|---|
| **一键捕获** | 当前页面右下角注入一个浮动按钮，点击触发单页、用户主动发起的捕获。不支持批量、不支持脚本化自动化。 |
| **Vision LLM 提取** | 抓取下采样后的视口截图（≤1280px）和可见 DOM，发送到你配置的 LLM 端点；模型返回结构化 JSON，由 [zod](https://zod.dev) 校验。 |
| **PDF 或 DOCX 输出** | 用 [pdf-lib](https://github.com/Hopding/pdf-lib) 渲染 PDF、用 [docx](https://github.com/dolanmiu/docx) 渲染 DOCX；可在设置中选择 PDF、DOCX 或同时输出。 |
| **BYOK，任意 OpenAI 兼容端点** | 你自己提供 provider、base URL、模型和 API key。支持 OpenAI、OpenRouter、qwen-vl 兼容层、vLLM、本地 llama.cpp，以及任何实现 `/chat/completions` + `image_url` 的端点。 |
| **静态加密** | API key 用 WebCrypto AES-GCM 加密后存入 `chrome.storage.local`；明文 key 永不落盘，加密密钥永不离开你的浏览器。 |
| **零遥测** | 无 analytics、无错误上报、无更新心跳。扩展唯一对外的 HTTP 请求就是发往你自己配置的 LLM 端点。 |
| **MIT 协议** | 无闭源服务器组件、无代理、无内置 API key。 |

## 工作原理

```
 ┌──────────────┐    1. 点击        ┌──────────────────┐
 │  当前 Tab     │ ───────────────▶ │ 浮动按钮         │
 └──────────────┘                  │ (Content Script) │
                                   └────────┬─────────┘
                                            │ 2. capture-request
                                            ▼
 ┌────────────────────────────────────────────────────┐
 │  Service Worker（MV3，可被随时回收）                │
 │   • chrome.tabs.captureVisibleTab → PNG（≤1280px） │
 │   • DOM 序列化，剥离 script/style                   │
 │   • 总载荷上限 1 MB                                 │
 └────────────────────────────────────────────────────┘
                                            │ 3. POST /chat/completions
                                            ▼
                                ┌──────────────────────────┐
                                │  你配置的 Vision LLM 端点 │
                                └──────────────┬───────────┘
                                               │ 4. JSON
                                               ▼
                            ┌──────────────────────────────┐
                            │  zod 校验 → pdf-lib / docx   │
                            │  渲染输出文件                 │
                            └──────────────┬───────────────┘
                                           │ 5. 浏览器下载
                                           ▼
                                  本地磁盘上的文件
```

文件下载到本地后如何使用，由你自己决定。clipcv 不指定任何下游用途。

## 安装

### Chrome Web Store

商店上架审核中。上架后链接会更新到这里。

### 手动安装（带签名的 `.crx`）

每个发布的 tag 都会在 [Releases](https://github.com/JamesbbBriz/clipcv/releases) 页面附上签名好的 `.crx` 和 `.zip`。开启开发者模式后，把 `.crx` 拖入 `chrome://extensions` 即可安装。

### 开发者模式（unpacked）

参见 [从源码构建](#从源码构建)。

> 首次启动时会弹出一次性免责声明对话框，必须接受后才能进行任何捕获。接受状态绑定到当前扩展版本，升级后需要重新接受。

## BYOK 配置

clipcv 不内置默认 API key、免费额度或代理。运行任何捕获之前都必须自行配置 LLM provider。

1. 打开扩展选项页：右键工具栏图标 → **选项**，或者 `chrome://extensions` → clipcv → **详情** → **扩展程序选项**。
2. 选择 **provider**：
   - **OpenAI** —— 直连 OpenAI API。
   - **OpenRouter** —— 经由 [OpenRouter](https://openrouter.ai) 统一网关访问多个 vision 模型。
   - **OpenAI-compatible custom** —— 任意实现 OpenAI `/chat/completions` 协议、且支持 vision `image_url` content 的端点（qwen-vl 兼容层、vLLM、本地 llama.cpp 服务器等）。
3. 填写 **base URL**（如 `https://api.openai.com/v1`）、**model**（你的 provider 提供的支持视觉的模型 id）、以及你的 **API key**。
4. 选择 **默认输出格式**：PDF、DOCX 或两者都要。
5. 点击 **Test connection** 发起一次 1-token 的小请求验证凭据。错误以类型化错误码的形式呈现 —— `auth_failed`、`timeout`、`model_not_found`、`bad_request`、`rate_limited`、`unknown` —— 任何形如 `sk-…` 或 `Bearer …` 的字符串在显示前都会被脱敏。
6. 点击 **Save**。你的 API key 会被 WebCrypto AES-GCM 加密后写入 `chrome.storage.local`。

可在选项页撤销免责声明的接受状态；下次打开 popup 时会重新弹出免责声明对话框。

## 隐私

详见 [PRIVACY.md](./PRIVACY.md)。简而言之：

- **没有 clipcv 服务器**。无 analytics、无遥测、无错误上报。
- **捕获的数据直接发送**到你配置的 LLM 端点 —— 该 provider 的服务条款决定他们如何处理你发送的数据。
- **所有扩展状态都保存在你的浏览器里**，clipcv 不会把任何东西镜像到设备外。
- **API key 静态加密**：WebCrypto AES-GCM、每个安装实例独立的 256-bit 随机密钥；明文从不落盘；UI 上呈现的任何错误信息都会先做密钥脱敏。

## 合规使用

你需要为自己在使用 clipcv 时所访问的每个网站的服务条款负责。clipcv 是单页、单击、用户主动触发的工具。**不要**把它用于批量抓取、脚本化批跑，或访问你没有正当授权访问的内容。详见 [DISCLAIMER.md](./DISCLAIMER.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 构建 | [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev)（MV3） |
| UI | React 18 + TypeScript（strict 模式） |
| 样式 | Tailwind CSS；Content Script 内部走 Shadow DOM 隔离 |
| 校验 | [zod](https://zod.dev) —— LLM 响应契约的唯一权威来源 |
| PDF | [pdf-lib](https://github.com/Hopding/pdf-lib) |
| DOCX | [docx](https://github.com/dolanmiu/docx) |
| 存储 | `chrome.storage.local` + WebCrypto AES-GCM |
| 测试 | [vitest](https://vitest.dev) —— 8 个 suite，74 个用例 |
| CI | GitHub Actions —— tag 触发 → 构建 → 带签名的 `.crx` + `.zip` 草稿 Release |

无后端、无 analytics SDK、无基于 npm 的 LLM SDK —— 所有 LLM 调用都用 `fetch` 直接发送，传输格式直接从源码可审计。

## 项目状态

| | |
|---|---|
| 版本 | `0.1.0`（MVP） |
| Manifest | V3 |
| 最低 Chrome 版本 | 116 |
| 测试 | 74 / 74 通过 |
| 代码量 | 生产代码 ~2.8K 行，测试 ~1.2K 行 |
| Web Store | 商店上架准备中 |

## 从源码构建

```bash
git clone https://github.com/JamesbbBriz/clipcv.git
cd clipcv
npm install
npm run build
```

然后在 Chrome 中：

1. 打开 `chrome://extensions`。
2. 开启 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择构建生成的 `dist/` 目录。

### 质量门禁

```bash
npm run typecheck    # tsc --noEmit，strict 模式
npm run test         # vitest run，74 个用例
npm run build        # vite build → dist/
npm run package      # 产出 release/clipcv-v<version>.{zip,crx}
```

## 参与贡献

clipcv 采用 MIT 协议，欢迎贡献。在提交 PR 之前请：

1. Fork 仓库，从 `main` 切出 feature 分支。
2. 跑通 `npm install` 和 `npm run build`，确认扩展能正常构建。
3. 通过所有质量门禁（`typecheck`、`test`、`build`）。
4. 改动保持小而单一；commit message 使用 [Conventional Commits](https://www.conventionalcommits.org) 前缀（`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:` / `ci:`）。

### 硬性规则 —— 违反任一条的 PR 会被拒绝

- 内联 script、`eval`、`Function(...)` 构造器，或任何形式的远程代码执行。Manifest V3 禁止，本项目也禁止。
- 由 clipcv 项目运营的服务器、代理，或任何非 LLM 端点的对外 HTTP 请求。
- 针对任何特定网站的硬编码 URL、CSS selector 或 DOM 探测。提取必须保持纯 prompt 驱动 —— 同一份代码路径处理所有页面。
- Analytics、错误上报或任何形式的遥测。
- 在用户可见层面（README、popup UI、选项页、生成文件元数据、商店描述、demo 视频…）将用户引向某个具体下游服务。本工具产出文件，下游用途由用户自己决定。
- 在 commit、PR 描述或代码注释里加入 AI 署名。

更大的变更（新增依赖、架构改动），请先开 issue 讨论设计。

## 发布流程

每次推送 `v*` tag 都会触发 GitHub Actions 自动发布。

1. 在 `src/manifest.json` 中升 `version` 并提交。
2. 给提交打 tag：`git tag v<version>`（如 `git tag v0.2.0`）。
3. 推送 tag：`git push origin v<version>`。
4. [`release.yml`](./.github/workflows/release.yml) 工作流会拉取 tag，依次执行 `npm ci`、`npm run build`、`npm run package`，然后创建一个**草稿** GitHub Release，把 `release/clipcv-v<version>.zip` 和 `release/clipcv-v<version>.crx` 作为附件。Release 保持在 draft 状态，由维护者审核产物并撰写发布说明后再发布。
5. CRX 签名 key 来自仓库 secret `CRX_PRIVATE_KEY` —— 一份 PEM 编码的 RSA-2048 私钥。用 `openssl genrsa -out clipcv.pem 2048` 生成一次，把内容粘贴到仓库 secret 里。后续每次发版都必须用同一把 key，扩展的 `.crx` id 才能保持稳定。PEM 文件绝不能提交（`*.pem` 已被 gitignore）。

如果想在不发正式版的情况下烟雾测试整个流程，可以推一个像 `v0.0.1-test` 这样的预发布 tag。工作流照常运行并把产物挂到 draft release，维护者事后删掉即可。

## 许可证

[MIT](./LICENSE) © clipcv 贡献者。
