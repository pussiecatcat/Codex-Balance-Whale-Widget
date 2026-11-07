# 架构

本文是当前实现的规格：进程、入口、依赖方向、状态归属、变更传播与生命周期。历史整改过程已归档到 `docs/history/`，不要用那几份文件推导当前行为。

## 1. 进程与入口

| 进程 | 入口 | 说明 |
|---|---|---|
| 后台服务（Node） | `scripts/control.mjs` → service | 余额、额度、账本、资源路由；没有 HTTP 端口，CLI/桌面经具名管道 IPC 访问 |
| Electron 主进程 | `desktop/main.cjs` | 窗口、托盘、模式、设置窗口；只做装配，具体职责见下表 |
| 挂件渲染进程 | `desktop/ui/widget.html` → `/dsh-whale/widget.js` → `assets/whale-widget.js` | 一个模块入口；功能实现位于 `desktop/ui/features/**` 与 `desktop/ui/services/**` |
| 设置窗口 | `desktop/ui/settings.html` → `/settings.js` | 一个模块入口；目录、页面渲染与帮助分别 import |

主进程拆分为：

| 文件 | 职责 |
|---|---|
| `desktop/mode-controller.cjs` | `follow-codex` / `standalone` 状态、`setHost`、`setMode` |
| `desktop/settings-window.cjs` | 设置窗口的创建、导航、关闭确认、预览 |
| `desktop/settings-domains.cjs` | `SettingsStore` 的域适配（size/usage/ui/displayMode/api/...） |
| `desktop/legacy-storage-import.cjs` | 旧 web localStorage 的一次性迁移 |
| `desktop/tray.cjs` | 托盘命令表 |
| `desktop/app-actions.cjs` | 状态对话框、暂停退出、重启 |
| `desktop/renderer-lifecycle.cjs` | 显示与渲染进程恢复 |
| `desktop/chromium-switches.cjs` | app ready 前的 Chromium 开关 |
| `desktop/shortcuts.cjs` | 全局快捷键注册与冲突报告 |

`desktop/main.cjs` 有 450 行上限（`npm run check:architecture` 会拦）。

## 2. 依赖规则

1. **渲染进程不发布业务全局名**。`window.*` 只允许：
   - `window.whaleDesktop`：preload 契约；
   - `window.__whaleTest` 与 `__whaleRenderTest/__whaleInputTest/__whaleShapeTest/__whaleAccount/__whaleApiModels/__whaleSettingsTest`：仅 `testMode` / 设置窗口测试；
   - `window.__whaleShutdown.pendingStorage()`：主进程退出时的待同步 ui 键值。
2. **组合根构造、功能模块不自取依赖**。`assets/whale-widget.js` 按依赖顺序构造 services/features，然后显式传参；`settings.js` 同理。
3. **功能不导入功能**。`features/a` 不得 import `features/b`；共享代码放 `desktop/ui/services/` 或 `desktop/ui/shared/`。
4. **共享层保持纯粹**。`desktop/ui/shared/**` 不访问 `window`、`document`、`localStorage`、`fetch`。
5. **网络请求只有一个客户端**：`desktop/ui/services/request.js`。
6. **`localStorage` 只有一个入口**：`desktop/ui/services/ui-state.js`。
7. **设置只有一个写入者**：主进程 `SettingsStore`。渲染进程通过 `settings-client` 的 `read/write/preview/onChanged` 访问。
8. **每个窗口一个模块入口**：加文件只需被入口 import，`runtime/dispatcher.mjs` 的静态解析器会服务它。

门禁命令：

```bash
npm run check:architecture   # 依赖/全局名/样式预算
npm run check:package        # 入口依赖图完整
```

## 3. 状态归属

| 状态 | 唯一写入者 | 磁盘 |
|---|---|---|
| 挂件大小、点击音效、气泡开关（size 域） | `SettingsStore`（挂件与设置窗口共用） | `.dshw-size.json` |
| 提醒/任务结束音效（usage 域） | `SettingsStore` | `.dshw-usage.json` |
| 显示模式（订阅 / API） | `SettingsStore` | `display-mode.json` |
| 位置、角色、气泡形状、手感等 ui 键值 | `UiStateStore`（渲染进程经 `ui-state` 推送） | `ui-state.json` |
| 账户余额与记账 | `WhaleService` | `ledger.jsonl` 等 |
| 额度快照 | `SessionMonitor` / `codex-rate-limits` | 会话记录 + 缓存 |
| 气泡配置 | `lib/resources/bubble-config.mjs` | `.dshw-bubble.json` |
| 角色 / 气泡图 / 音频素材 | `lib/resources/*` | `whale-roles/`、`whale-*` |

## 4. 变更传播

```
SettingsStore ─┐
资源路由      ─┼─► createChangeBus ─► 两个窗口的 whale-settings-changed
服务运行状态  ─┘                        ├─ settings-client.onChanged
                                        ├─ ui-state.applyRemote (domain: ui)
                                        └─ 挂件重新读取需要的快照

NoticePublisher ─► dispatcher.onRuntimeEvent ─► main ─► whale-runtime-event
   (turn / wait)                                      └─ services/runtime-feed
```

规则：

- 每次成功写入恰好 publish 一次；失败不 publish。
- 渲染进程不轮询设置：`settings-client` 订阅变更。
- 任务完成与等待提示不再轮询：启动时各取一次快照，之后由 `runtime-feed` 推送。

## 5. 生命周期

- 每个功能从组合根拿到 `scope`（`services/scope.js`），监听、定时器、请求都挂上去；`pagehide` 时统一 dispose。
- 浮层使用 `services/popover.js`：同一时刻只有一个，Esc 关闭最上层，指针在浮层/锚点之外时关闭（只作用于挂件自己的下拉浮层，不改变菜单的空白点击决定）。
- 层级只用 `services/layers.js` 的 `LAYERS`；CSS 变量是唯一层级来源。
- 测量得到的 `left/top/width` 与 `--dshw-*` 自定义属性允许内联；静态颜色/字号必须用 class（门禁强制）。

## 6. 扩展方式

- **加功能模块**：在 `desktop/ui/features/<area>/` 新建 `create*` 工厂，参数接收 `document/window/scope` 与依赖；由 `assets/whale-widget.js` 构造并传参。不要发布全局名，不要发跨功能 `window` 事件。
- **加设置字段**：只改 `desktop/ui/settings-catalog.js`（目录唯一事实源），必要时改 `settings-pages.js` 的渲染类型；主进程只需保证 domain 已注册（`settings-domains.cjs`）。然后 `node scripts/generate-config-doc.mjs` 更新 `docs/CONFIGURATION.md`。
- **加资源路由**：在 `lib/resources/<name>.mjs` 导出 `declareRoutes(ctx, deps)`，并在 `lib/widget-host.mjs` 的模块列表登记；成功后调用 `ctx.changed({ domain, kind })`。
- **加服务商模板**：只改 `runtime/api-models.mjs` 的 `API_TEMPLATES`，前端不维护模板表。

## 7. 兼容能力清单

| 编号 | 兼容项 | 现状 |
|---|---|---|
| K1 | 旧 `dshw-*` 键名与字符串编码 | 保持不变；`ui-state` 原样读写 |
| K2 | 旧 `api-settings.json` / `api-models.json` | 首次写入合并进 `providers.json`，留 `.legacy-backup.json` |
| K3 | 旧 web localStorage | `legacy-storage-import.cjs` 一次导入并记录 marker |
| K4 | 气泡 schema 1 | `shared/bubble-config/migrate.js` 迁移，备份 `.dshw-bubble.schema1-backup.json` |
| K5 | 退出时未同步的 ui 键值 | 主进程 `executeJavaScript` 读取 `window.__whaleShutdown.pendingStorage()` |
| K6 | 安装包版本比对 | `.codex-plugin/plugin.json` 的 `version` 是唯一真源 |
| K7 | 旧日志 / 诊断文件 | `diagnostics.cjs` 保持 `visibility-status.json` 环形历史 |
| K8 | 旧音效引用 `grp:` / `frag:` / `preset:` | `services/sound-reference.js` 统一解析 |
| K9 | 旧 `whale://widget/...` 链接 | 自定义协议路由不变 |
| K10 | 旧 `whale-*` 资源目录位置 | `resource-store` 保持候选目录顺序 |
| K11 | 旧快捷键与托盘命令 | `shortcuts.cjs` / `tray.cjs` 保持语义 |
