# 安全策略（Security Policy）

## 支持范围

本分支（**For-Codex**）当前交付为 **api-balance-whale v0.3.0**。Windows x64 已做本机回归；macOS 兼容源自 PR #128，实机及完整集成待验证。历史 0.2.4 代码仍保留于 archive/for-codex-0.2.4。漏洞报告渠道与披露方式沿用本仓库既有策略。

上游主分支（DSH Web 版 `dsh-whale-widget`）的问题请提到上游 issue；如果是**两者共有的代码**（例如 `assets/` 素材、前端渲染逻辑），也欢迎在本仓库提出，我们会与上游对齐。

## 报告漏洞

**请不要用公开 issue 报告安全漏洞。** 任选一种私下渠道：

1. **GitHub 私密漏洞报告**（推荐）：仓库 → **Security** → **Report a vulnerability**（Private vulnerability reporting）。若该入口不可用，用第 2 种。
2. **邮件**：发到维护者邮箱（见仓库主页/提交记录），标题以 `[SECURITY] api-balance-whale` 开头。

请尽量包含：

- 受影响的版本（`.codex-plugin/plugin.json` 里的 `version`）与操作系统版本；
- 复现步骤或最小样例（PoC）；若涉及密钥/账本，请**脱敏**后再贴；
- 影响评估：能读到什么、能改到什么、是否需要本地代码执行权限；
- 是否已在别处公开（我们会据此调整披露节奏）。

**请勿在报告里附带真实 API 密钥、`auth.json`、`config.toml` 原文、`runtime.json` 或完整账本。** `runtime.json` 含有本地 IPC token。我们不需要这些也能定位问题。

## 我们的处理方式

- **48 小时内**确认收到并给出初步判断；
- 给出修复计划或说明为何不修（含理由）；
- 修复发布后，在 CHANGELOG 与 Release 说明中致谢（除非你要求匿名）；
- 默认协调披露：修复版本发布后再公开细节；如需 CVE 或更长静默期，请在报告里说明。

## 本插件的安全边界（哪些算漏洞、哪些是设计）

**属于安全问题的例子**

- 读取或输出密钥、`auth.json`、`config.toml` 原文；
- 把余额/用量数据、聊天内容或本机路径发送到非用户配置的第三方；
- Windows 本地命名管道（`\\.\pipe\codex-whale-*`）或 macOS Unix socket 可被同机其他进程无凭据调用；
- 越权路径穿越、符号链接逃逸、素材目录外的读写；
- 导入素材时绕过格式/尺寸/帧数/配额校验，或损坏文件导致拒绝服务。

**属于已知设计（不算漏洞，欢迎提改进建议）**

- 不校验余额接口服务商的真实性：插件按你配置的地址与密钥查询，返回什么就显示什么；
- 汇率来自公开接口（`api.frankfurter.dev`），不做可信度背书；
- 原生窗口跟随依赖 Win32 窗口句柄或 macOS `CGWindowList` 与用户态权限，不设提权；
- 金额为**观测估算**，不是服务商正式账单。

## 密钥绑定：凭据只会发往哪个域名

上游 DSH Web 版在 v0.3.15 修过一类「凭据外带」问题：让宿主动用真实 API 密钥去请求攻击者可控的 URL。本插件对同一类问题有**三层独立防护**，改动这段代码前请先读本节。

**第一层 · 本地 IPC 白名单。** `runtime/bridge.mjs` 的 `ALLOWED` 只放行只读或停止类路由（`/api/status`、两份 `dsh-whale/*.json`、`/api/show`、`/api/stop`）。**写入设置（`/api/config` PUT）与写入 API 模型（`/api/models` PUT/POST/DELETE）不在其中**，因此同机其他进程即使读到 `runtime.json` 里的 IPC token，也改不了端点或凭据。注意 token 面向当前用户会话，**它本身不是安全边界，白名单才是**。

**第二层 · 设置写入校验。** `runtime/config.mjs` 的 `cleanUrl` 拒绝 URL 内嵌凭据、查询串与片段；非本机地址强制 HTTPS；并封堵云元数据与链路本地地址（`metadata.google.internal`、`100.100.100.200`、`169.254.*`、`0.*`、`fe80::/10`），以免被用作 SSRF 跳板。`keyEnv` 只接受环境变量名，`save()` 拒绝任何形如 secret / token / api_key / password 的字段 —— **本插件不落盘密钥**。`balancePath` 必须是当前域名下的绝对路径，不能是绝对 URL。

**第三层 · 密钥与域名绑定。** 当「默认或全局」凭据会被发往与原服务不同的域名时，以下位置**直接抛错**，不会转发：

| 位置 | 规则 |
|---|---|
| `runtime/config.mjs` | 项目内 `.codex/config.toml` 更换 API 域名 —— 该文件可能来自下载的仓库 |
| `runtime/config.mjs` | 设置里的 API 地址更换域名 |
| `runtime/api-models.mjs` | 自定义余额地址跨源，且仍使用模板默认密钥 |

绕过这三处的唯一方式是**显式指定另一个密钥环境变量名** —— 那是设计意图（自定义端点须使用专用凭据），不是漏洞。另外所有出网请求都带 `redirect: 'error'`，服务商被 302 到陌生主机也不会跟随。

这套规则由测试钉住（`tests/transport.test.mjs`、`tests/security.test.mjs`、`tests/core.test.mjs`、`tests/api-models.test.mjs`）。**放宽其中任何一条都会让测试失败** —— 不要为了通过测试而删断言。

## 加固建议（使用者）

- 只从本仓库或可信来源获取插件；升级前备份插件目录与 `~/.codex/whale-widget`（Windows 为 `%USERPROFILE%\.codex\whale-widget`）；
- 不要把密钥写进插件设置：本插件只保存**密钥环境变量名**，密钥请放在 Codex 配置或系统环境变量里；
- 若在多用户或共享机器上使用，注意本插件的本地 IPC 面向当前用户会话。
