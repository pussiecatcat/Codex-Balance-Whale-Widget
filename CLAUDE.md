# CLAUDE.md

Codex 桌面额度小鲸鱼：跟随 Codex 窗口的桌面挂件（Electron + Node.js），显示 Codex 订阅额度、API 余额、本机观测用量与本地记账。主要面向 Windows；macOS 兼容代码和安装脚本已保留，但尚未实机验收。

## 运行与测试

- 需要 Node.js 24+。
- `npm start` 启动挂件（= `node scripts/control.mjs open`）；`npm run desktop` 为独立桌面模式。
- 测试：`npm test`（= `node --test tests/*.test.mjs`）。
- 自检：`node scripts/control.mjs status | balance | usage | stop`。

## 架构

**没有 HTTP 端口，也没有独立网页。** 渲染进程走自定义协议 `whale://widget/widget.html`；后台服务与 CLI/桌面之间走具名管道 IPC（Windows `\\.\pipe\codex-whale-*`，macOS 走 unix socket），且只有 `runtime/bridge.mjs` 中 `ALLOWED` 白名单内的路径能跨进程。

- `scripts/control.mjs` — CLI 入口
- `runtime/dispatcher.mjs` — 中央路由，组装所有子服务
- `runtime/service.mjs` — WhaleService：余额、配置、账本
- `runtime/bridge.mjs` — 具名管道 IPC（含路径白名单与 token 校验）
- `runtime/process.mjs` — 拉起/探测服务（Windows schtasks，macOS launchctl）
- `lib/widget-host.mjs` — 挂件资源层，注册全部 `/dsh-whale/*` 路由
- `desktop/main.cjs` — Electron 主进程：窗口、透明度、点击穿透、跟随
- `desktop/ui/*` — 渲染进程页面与模块
- `assets/whale-widget.js` — 挂件前端单体，经 `/dsh-whale/widget.js` 提供

## 改哪里

| 要改的东西 | 主要文件 |
|---|---|
| 订阅额度（5h/周额度、倒计时、潮汐卡片） | `runtime/codex-rate-limits.mjs`、`runtime/session-monitor.mjs`、`desktop/ui/quota.js` |
| API 余额、模型模板 | `runtime/api-models.mjs`、`runtime/providers.mjs`、`desktop/ui/api-models.js` |
| 本地记账、金额显示 | `runtime/ledger.mjs`、`desktop/ui/money.js`、`runtime/pricing-schedule.mjs` |
| 汇率 | `runtime/fx.mjs` |
| 角色、音效、气泡、素材上传 | `lib/widget-host.mjs`、`lib/resource-store.mjs`、`lib/media-validation.mjs`、`desktop/ui/audio-engine.js` |
| 窗口形状、透明度、点击穿透、跟随 | `desktop/main.cjs`、`desktop/WindowApi.cs`、`desktop/supervisor.ps1` |
| 安装、回滚、发布 | `scripts/install-package.ps1`、`scripts/rollback-package.ps1`、`scripts/build-release.py` |

## 注意

- **口径必须分开**：ChatGPT 订阅额度、API 余额、本机观测 token 是三个不同来源，代码刻意分开显示。不要把观测值当官方账单，也不要为了显示好看删掉小额精度。
- **`assets/whale-widget.js` 是 509 KB / 11,842 行的单体文件**，比其余全部源码加起来还大。改前端行为时先 grep 定位，不要整文件读。
- **API 模型模板前后端各有一份**：`runtime/api-models.mjs` ↔ `desktop/ui/api-models.js`。改一处必须同步另一处。
- **隐私**：API 密钥、提供商名称、账号、本机路径、会话日志不得出现在公开仓库、UI 或日志里。
- `vendor/`（smol-toml）、`packages/`（历史发布包）、`archive/`（0.2.x 归档）是第三方或历史产物，一般不动。
- 提交前跑 `npm test`；`main` 有分支保护，改动走 PR。
