# CLAUDE.md

Codex 桌面额度小鲸鱼：跟随 Codex 窗口的桌面挂件（Electron + Node.js），显示 Codex 订阅额度、API 余额、本机观测用量与本地记账。主要面向 Windows；macOS 兼容代码和安装脚本已保留，但尚未实机验收。

## 运行与测试

- 需要 Node.js 24+。
- `npm start` 启动挂件（= `node scripts/control.mjs open`）；`npm run desktop` 为独立桌面模式。
- 测试：`npm test`（= `node --test tests/*.test.mjs`）。`tests/lint-rules.test.mjs` 会 import ESLint，所以新克隆要先 `npm ci`，否则它是唯一会失败的那一个文件。
- 静态检查：`npm ci` 一次性装好 devDependency（只有 ESLint），然后 `npm run lint`、`npm run check:package`、`npm run check:architecture`；`npm run verify` 串起全部检查加发布包构建。
- 自检：`node scripts/control.mjs status | balance | usage | stop`。

## 架构

**没有 HTTP 端口，也没有独立网页。** 渲染进程走自定义协议 `whale://widget/widget.html`；后台服务与 CLI/桌面之间走具名管道 IPC（Windows `\\.\pipe\codex-whale-*`，macOS 走 unix socket），且只有 `runtime/bridge.mjs` 中 `ALLOWED` 白名单内的路径能跨进程。

- `scripts/control.mjs` — CLI 入口
- `runtime/dispatcher.mjs` — 请求路径：校验 → 端点表 → 静态文件 → 挂件路由。只做分发，不再组装服务
- `runtime/composition.mjs` — 组合根：构造 WhaleService / fx / insights / apiModels / soundSettings / SessionMonitor，返回一个容器；加协作方改这里，加端点改 `routes/`
- `runtime/routes/core.mjs` — 核心端点表（`/api/*` 与 `/dsh-whale/wait.json`）。挂件路由注册进同一张查询，只有一条优先级规则
- `runtime/http-shim.mjs` — 没有服务器的那一小片 HTTP：MIME 表（`desktop/ui/` 用 `MIME`，`assets/` 只服务媒体用 `ASSET_MIME`）、CSP、`jsonResult`、统一附加安全响应头
- `runtime/faults.mjs` — 意外异常的环形缓冲，即 `/api/status` 的 `faults`
- `lib/errors.mjs` — `DomainError`：调用方能自己修的失败，带自己的状态码和消息（4xx）。**没有抛 DomainError 的异常一律按本进程缺陷处理**，记引用号、细节写 stderr、对外回 500，不再伪装成「请检查设置」
- `runtime/service.mjs` — WhaleService：余额、配置、账本
- `runtime/bridge.mjs` — 具名管道 IPC（`ALLOWED` 与 `HOST_ROUTES` 两张表合起来才是完整的外部可达路径集）
- `runtime/process.mjs` — 拉起/探测服务（Windows schtasks，macOS launchctl）
- `lib/atomic-write.mjs` — 全项目唯一的原子写入实现（独占临时文件 + Windows 重命名重试 + 可选 fsync）。同步 `writeFileAtomicSync` 给 runtime/lib 与 Electron 主进程用，异步 `writeFileAtomic` 给 `UiStateStore` 这类在 promise 链上的调用者用。`lib/` 是最底层，`runtime/` 与 `desktop/` 都依赖它。Electron 侧用 `require()` 加载它（Electron 44 的 Node 支持 require ESM）
- `lib/widget-host.mjs` — 挂件资源层。用 `ctx.declareRoute({ path, methods, bodyLimit, stripRetired, handler })` 声明全部 `/dsh-whale/*` 路由并返回应答值，不再注册进一个假的 web server、也不往收集器里写
- `lib/route-response.mjs` — `json` / `raw` / `text` / `empty` 四种应答值，以及唯一把它们翻成 `{status, headers, body}` 的 `toResponse`。dispatcher 和直接驱动 host 的测试都走它，两边不会漂移
- `desktop/main.cjs` — Electron 主进程：窗口、透明度、点击穿透、跟随。它自己的职责边界见下面三条
- `desktop/ipc-handlers.cjs` — 渲染进程能触达的全部 IPC 通道，一张表。主进程通过 `ipcHost` 对象把动作传进来，所以「渲染进程能调什么」写在一处可审
- `desktop/diagnostics.cjs` — `diagnose()` 与可见性记录（`visibility-status.json` 的环形历史）。主进程把状态快照传给它，而不是反过来
- `desktop/test-harness.cjs` — Electron 测试夹具：按需 import `tests/*-fixture.mjs`、收集渲染进程 console 错误、记录被打开的外链、手工指定光标、驱动 `verifyDesktop`。**未启用时每个方法都是空操作**，所以 `main.cjs` 无条件调用它们；`main.cjs` 里只剩 `harness.enabled` 做守卫，守卫的都是「测试模式下要抑制的生产行为」（stdout 的 overlay handle、诊断快捷键、原生模式归属），不是测试代码
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
- **版本号只有一处真源**：`.codex-plugin/plugin.json` 的 `version`（`基础版本+构建后缀`，安装器比对的就是它）。`runtime/paths.mjs` 从它推导出 `VERSION`，不再自带字面量；`package.json` 仍留一份给 npm，由 `tests/release-version.test.mjs` 断言与真源一致。发版只改 plugin.json 一处，改了 package.json 忘了同步会被测试拦下。
- **`main.cjs` 里不该再出现测试代码**：夹具分支都在 `desktop/test-harness.cjs`，加新的一条就加到那里。另外 `tests/desktop-mode.test.mjs` 会把 `main.cjs` 的 `setHost` / `setMode` 源码切出来在 vm 沙箱里跑，沙箱里手工列出了主进程的作用域名字（`harness`、`diagnostics`、`normalizeHostState` 等）——**改这两个函数引用到的名字，要同步改那个沙箱**，否则它会以 `ReferenceError` 红掉。
- **渲染进程的依赖边有门禁，两套规则**：`npm run check:architecture` 拦下三件事——已迁出模块新增或加量的 `window.Whale*` 访问、跨功能导入（`features/a` 引 `features/b`）、绕过 `desktop/ui/services/request.js` 的直接 `fetch`，另加「不得新增 `window` 全局名」。存量冻结在 `scripts/refactor-metrics.mjs` 的 `MODULE_GLOBAL_READS`、`MODULE_DIRECT_REQUESTS` 和 `GLOBAL_SURFACE`（当前 11 个名字），只减不增；preload 契约 `window.whaleDesktop` 按设计放行。`assets/whale-widget.js` 与 `desktop/ui/*.js` 这些**还没拆分的文件不适用「按模块计数」**——它们各是一个文件，所以另由 `LEGACY_DIRECT_FETCH_BUDGET`（当前 29）一个总上限管住，随迁移推进逐格下降。功能迁走后要顺手删掉基线里对应的条目，否则它会在 `--json` 输出里一直报成 stale。
- **隐私**：API 密钥、提供商名称、账号、本机路径、会话日志不得出现在公开仓库、UI 或日志里。
- **新增根目录文件必须同步加进 `scripts/build-release.py` 的 `root_files`**，否则 `python scripts/build-release.py` 会以 `Unexpected file: <名字>` 断言失败。`.github/workflows/verify.yml` 会在 push/PR 上跑这道检查，所以忘了登记会在 CI 上直接红，不必等到打包。
- `vendor/`（smol-toml，运行时依赖，进发布包）与 `archive/`（0.2.x 归档，不进发布包）是第三方或历史产物，一般不动。历史发布包只放 Release 页，已不再提交进仓库（`.gitignore` 含 `/packages/`）。
- 提交前跑 `npm run verify`（lint + 单测 + 包依赖 + 架构边界 + 发布包）；`.github/workflows/verify.yml` 会在每次 push/PR 上跑同一套，所以忘了本地跑也会在 CI 上红。`main` 已放开 PR 强制（仍禁强推与删除分支）。
