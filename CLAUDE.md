# CLAUDE.md

Codex 桌面额度小鲸鱼：跟随 Codex 窗口的桌面挂件（Electron + Node.js），显示 Codex 订阅额度、API 余额、本机观测用量与本地记账。主要面向 Windows；macOS 兼容代码和安装脚本已保留，但尚未实机验收。

## 运行与测试

- 需要 Node.js 24+。
- `npm start` 启动挂件（= `node scripts/control.mjs open`）；`npm run desktop` 为独立桌面模式。
- 测试：`npm test`（= `node --test tests/*.test.mjs`）。
- 静态检查：`npm ci` 一次性装好 devDependency（只有 ESLint），然后 `npm run lint`、`npm run check:package`、`npm run check:architecture`；`npm run verify` 串起全部检查加发布包构建。
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
- `assets/whale-widget.js` — 挂件前端装配入口：ES module，导入 `desktop/ui/features/*` 与 `desktop/ui/services/*` 下的模块，经 `/dsh-whale/widget.js` 提供
- `launchers/*.cmd`、`launchers/*.command` — 终端用户双击入口（安装/启动/跟随/回滚）；内部用 `%~dp0..\scripts\` 定位仓库根，挪动脚本必须同步改这个上跳路径

## 改哪里

| 要改的东西 | 主要文件 |
|---|---|
| 订阅额度（5h/周额度、倒计时、潮汐卡片） | `runtime/codex-rate-limits.mjs`、`runtime/session-parser.mjs`、`runtime/session-monitor.mjs`、`desktop/ui/quota.js` |
| API 余额、模型模板 | `runtime/api-models.mjs`、`runtime/providers.mjs`、`runtime/balance-query.mjs`、`desktop/ui/api-models.js` |
| 本地记账、金额显示、每轮结算 | `runtime/ledger.mjs`、`runtime/turn-accounting.mjs`、`runtime/pricing-schedule.mjs`、`desktop/ui/money.js` |
| 汇率 | `runtime/fx.mjs` |
| 角色、音效、气泡、素材上传 | 前端在 `desktop/ui/features/widget/*`、`desktop/ui/features/sound-settings/*`、`desktop/ui/services/*`；后端在 `lib/widget-host.mjs`、`lib/resource-store.mjs`、`lib/media-validation.mjs`、`runtime/sound-settings.mjs`、`runtime/size-settings.mjs` |
| 挂件外观、样式 | `desktop/ui/whale-widget.css`（经 `widget.html` 的 `<link>` 加载） |
| 窗口形状、透明度、点击穿透、跟随 | `desktop/main.cjs`、`desktop/host-state.cjs`、`desktop/WindowApi.cs`、`desktop/supervisor.ps1` |
| 安装、回滚、发布 | `launchers/*.cmd`、`launchers/*.command`（用户双击入口）、`scripts/install-package.ps1`、`scripts/rollback-package.ps1`、`scripts/build-release.py` |

## 文档

改代码不需要通读 `docs/`。要弄清某项行为为什么是这样，查 [`docs/README.md`](docs/README.md) 的分组索引。最常需要的是：

- `docs/V0.3-PLAN-AND-PROVENANCE.md` —— 数据口径的权威定义（订阅额度 / API 余额 / 本机观测 token 的语义与边界）。
- `docs/DASHBOARD-B.md`、`docs/OUTSIDE-CLICK-DECISION.md` —— 菜单布局与「不做空白点击关闭」的产品决定，动了会踩。

`docs/` 里另有 v0.3 的过程记录，属历史，除追溯外不必读。

## 注意

- **口径必须分开**：ChatGPT 订阅额度、API 余额、本机观测 token 是三个不同来源，代码刻意分开显示。不要把观测值当官方账单，也不要为了显示好看删掉小额精度。
- **`assets/whale-widget.js` 现在是装配入口，不再是单体**：约 6,445 行 / 264 KB，只占第一方源码的三成；气泡、用量、角色、音效等实现已迁到 `desktop/ui/features/**`（36 个模块）与 `desktop/ui/services/**`（2 个共享模块）。文件顶部保留分段索引，先 `grep -n "==== \[" assets/whale-widget.js` 取区段行号再定点读。**改某个功能前先确认它是否已经迁出**——留在这里的多半只剩 DOM 装配和兼容适配。
- **挂件样式在 `desktop/ui/whale-widget.css`**，由 `widget.html` 以 `<link>` 加载。改外观不必碰 whale-widget.js。
- **API 模型模板只有一份**：34 个服务商模板全部定义在 `runtime/api-models.mjs` 的 `API_TEMPLATES`，经 `/api/models` 下发给前端。`desktop/ui/api-models.js` 只渲染后端返回的数据，自身不含模板表 —— 要加服务商，只改后端那个文件。
- **隐私**：API 密钥、提供商名称、账号、本机路径、会话日志不得出现在公开仓库、UI 或日志里。
- **新增根目录文件必须同步加进 `scripts/build-release.py` 的 `root_files`**，否则 `python scripts/build-release.py` 会以 `Unexpected file: <名字>` 断言失败。`.github/workflows/verify.yml` 会在 push/PR 上跑这道检查，所以忘了登记会在 CI 上直接红，不必等到打包。
- `vendor/`（smol-toml，运行时依赖，进发布包）与 `archive/`（0.2.x 归档，不进发布包）是第三方或历史产物，一般不动。历史发布包只放 Release 页，已不再提交进仓库（`.gitignore` 含 `/packages/`）。
- 提交前跑 `npm run verify`（lint + 单测 + 包依赖 + 架构边界 + 发布包）；`.github/workflows/verify.yml` 会在每次 push/PR 上跑同一套，所以忘了本地跑也会在 CI 上红。`main` 已放开 PR 强制（仍禁强推与删除分支）。
