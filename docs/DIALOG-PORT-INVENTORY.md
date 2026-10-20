# 对话框优化迁移：来源行为 × 目标实现对照表

> 2026-10-17 复核修复补充见 [DIALOG-PORT-FIXES.md](DIALOG-PORT-FIXES.md)。设置读取/预览现为异步，挂件写入改为按键补丁加基线校验，编辑器路由与跳转文案已修复。

日期：2026-10-17。基线：origin/main `2de43f3`（2026-10-16 联网核实）。来源：`e6abcb5..37f3b57`（对话框优化，两个提交）。
本文登记每个来源行为的处理结论。判定依据来自本轮实际代码核对与验证，不是照抄旧报告。

## 1. 批次一：兼容与配置修复（T02/T03）

| 来源行为 | 新主线入口 | 结论 | 依据 |
| --- | --- | --- | --- |
| `app-server` 参数协商（`--listen stdio://` 优先、回退 `--stdio`、缓存、重新协商） | `runtime/codex-rate-limits.mjs` | **已移植并扩展** | 一次性查询（`readCodexRateLimits`）按来源原样移植；常驻连接 `createCodexRateLimitsClient` 是主线新增路径，来源未覆盖——已把协商缓存接入 `connect()`/close/重试（有界 2 次），命中缓存在参数再被拒（就地升级）时重新协商 |
| stderr 仅内部判定，不透出原始内容 | 同上 | **已移植** | `looksLikeArgsRejected` 正则只产出布尔值与固定中文错误 |
| 登录/网络/RPC 失败不切换写法 | 同上 | **已移植** | 只有 `close` 时 stderr 命中特征才 `noteAppServerArgsRejected`；超时/取消路径 `own.dead` 已置位，不碰缓存 |
| unix socket 超出 `sun_path` 预算回退临时目录（缺陷 ⑤） | `runtime/bridge.mjs` `pipeName` | **已移植** | 主线 pipeName 与来源基线相同；基线 3 项 `transport.test.mjs` 失败在本环境复现，移植后 9/9 通过 |
| `.dshw-size.json` 固定写主路径 + 部分写入保留字段（缺陷 ①②） | `runtime/size-settings.mjs` `SizeSettingsStore` | **主线已覆盖，未移植** | 主线用多候选文件选择 + `prepare` 合并 + 损坏报错（`readResourceJson` 抛错不覆盖）；来源的"固定写主路径"策略按任务书要求不照搬，回归测试改写为按主线语义（`tests/settings-store.test.mjs`） |
| 读取提醒设置不因配置未就绪失败、不覆盖自定义链接（缺陷 ③） | `runtime/service.mjs` `resolveUsageSettings` | **已移植** | 主线仍有无条件 `defaults.alert.lines.find(...).url = dashboardUrl`；已包 try/catch + 空值守卫，测试见 `tests/usage-settings-reliability.test.mjs` |
| 提醒域 null 显式恢复默认、非法输入明确报错 | `runtime/service.mjs` `prepareUsageSettings` | **已移植并扩展** | 主线把 usage 拆成 prepare/commit 事务；null 重置与非法报错移植进 `prepareUsageSettings`（含 `events` 域），落盘走 `writeUsageSettings` 回读一致 |
| 手动额度显式 null 删除（缺陷 ④） | `runtime/api-models.mjs` `save` | **主线已覆盖，未移植** | 主线重建 `model` 对象，`keep('manualQuota', null)` 为 null 时字段自然不落盘；空对象仍报错（符合"非法输入明确报错"）；回归见 `tests/settings-store.test.mjs` 的 manualQuota 两条 |
| `/api/ui-state` PUT 按键合并 | 路由已删除 | **按主线架构改写，未照搬** | 主线无该路由；改为 `UiStateStore.setKeys()`（按键合并、null 删除），供设置窗口的 `ui` 域写入使用；复核后挂件渲染器的 `save()` 也改为带基线的按键补丁，旧整份快照被拒绝，退出写入使用同一协议 |
| 每轮提示音量/按压手感等 | `runtime/sound-settings.mjs` | **主线已覆盖，未移植** | 主线的 SoundSettingsService（事务 + journal + 恢复）是来源实施之后的演进，来源对应代码已过时 |

## 2. 批次二：气泡与额度卡排版（T04）

| 来源行为 | 新主线入口 | 结论 | 依据 |
| --- | --- | --- | --- |
| BUBBLE_SHAPES（椭圆/圆角方形）+ `applyBubbleShape` + 持久化 `dshw-bubble-shape` | `assets/whale-widget.js`（气泡装配区） | **已移植** | 主线原只有单一椭圆；另暴露 `window.WhaleBubbleShape` 供菜单与设置窗口调用（来源经菜单 select 引用，主线改为全局入口） |
| 菜单「气泡形状」行 | `assets/whale-widget.js` 菜单构建区 | **已移植** | 与来源相同：`dshwCustSel` 下拉 + change 落 localStorage；主线要求先 append 再 enhance（主线 `custom-select.enhance` 对未挂载节点直接跳过，来源版本会包裹——这是移植中发现的行为差异） |
| 内容盒 `--dshw-box-wu/hu/card-wu`（椭圆 505×305、圆角 655×325） | `desktop/ui/ui.css` | **已移植** | 主线 ui.css 额度卡区域与来源基线逐行一致，diff 干净套用 |
| `fitFrameToBubble`：按真实 SVG path 测量缩放、ResizeObserver 跟踪、`refitBubble` | `desktop/ui/render.js` | **已移植** | 主线 render.js 与来源基线一致，diff 干净套用；晚到额度/倒计时/形状切换覆盖见视觉检查 |
| 行宽上限按形状（`bubbleRowCapU`，不写死 560u） | `desktop/ui/features/widget/bubble-rows-view.js` | **已移植（位置不同）** | 主线已把行渲染拆到 bubble-rows-view 模块；两处 560u 上限改为读 `--dshw-box-wu`，预览裁切高度（560/1026）保持不变（与来源一致） |
| 订阅默认两张额度卡共享 row:1；旧三模块默认迁移 | `desktop/ui/features/widget/default-content.js` | **已移植** | 主线 default-content 是来源对应函数的模块化版本，逐字移植 |
| `bubble-fit.test.mjs` 形态断言 | `tests/bubble-fit.test.mjs` | **已适配** | 不机械复制：BUBBLE_SHAPES 仍在装配入口，但默认队列断言改读 `default-content.js`、行宽断言改读 `bubble-rows-view.js`（任务书明确要求适配，不复制字符串匹配） |
| `bubble-visual*` Electron 目视工具 | `tests/bubble-visual.mjs` + `bubble-visual-fixture.mjs` | **已移植并加强** | 形状切换改走真实 `WhaleBubbleShape.apply`（来源只切 class 不换 path，是来源版缺陷）；每场景增加与 audit 相同的"文本四角落在白色区域内"几何断言；Electron 定位按平台 + `WHALE_HOME` |
| audit 的形状包含断言 | `tests/audit-ui-regression.mjs` | **已移植** | 依赖 `#dshw-bubble-shape` 菜单控件（已移植）；受桌面审计既有环境不稳定影响未跑完（见验证报告） |
| `desktop-audit-smoke` electron.exe 硬编码 | `tests/desktop-audit-smoke.mjs` | **已适配** | 按平台定位 + `WHALE_HOME`；`desktop-audit-fixture.mjs` 的原生裁切段（Windows 专属）加平台守卫；`test-harness.run` 对 macOS 提供恒等 `dipToScreenRect/screenToDipRect` 夹具装配 |

## 3. 批次三：独立设置窗口与快捷菜单（T05/T06）

| 来源行为 | 新主线入口 | 结论 | 依据 |
| --- | --- | --- | --- |
| 六个分类、54 字段目录、`!` 说明、草稿/冲突/保存闭环 UI | `desktop/ui/settings.{html,css,js}`、`settings-catalog.js`、`settings-pages.js`、`settings-help.js` | **已移植** | 原样复制 + 三处适配：`settings.js` 转 ES module 用共享 `requestJson`（架构红线：渲染进程裸 fetch 只许降）；目录的 size/usage 读写路由改为主线 `/api/sound-settings`；`defaultSource` 行号全部重定位到主线文件 |
| `SettingsStore`（域适配、按键合并、冲突检测、preview） | `desktop/settings-store.cjs` | **已移植并扩展** | 主线音效事务是异步队列，`save` 改为 async（成功确认后才回报），测试同步更新 |
| 域写入 | `desktop/main.cjs` | **按主线架构重写** | size/usage 域走主线 `SoundSettingsService` 同一事务（journal + 恢复），不再建第二写入者；`ui` 域走 `UiStateStore.setKeys`；`displayMode` 域直写 `display-mode.json`（与 `/api/display-mode` 同格式；不经路由是为守住 SettingsStore 的同步 read 契约） |
| 窗口角色化 IPC（senderRole / 主框架校验） | `desktop/ipc-window.cjs`、`ipc-handlers.cjs`、`preload.cjs` | **已移植（位置不同）** | 主线 IPC 集中在 ipc-handlers 表；角色判定加进该表，挂件专用通道仍只认挂件窗口，设置窗口只拿 `whale-settings-read/write/preview` 与 `focus-whale`/`open-editor` 白名单命令 |
| 单实例设置窗口、960×720 钳制工作区、关闭不退挂件、退出清理 | `desktop/main.cjs` `openSettingsWindow/closeSettingsWindow` | **已移植** | 渲染器错误收集改用主线 `harness.watchRenderer`；托盘「API 设置」改为打开设置窗口 |
| 主线新增项入目录（按压、每轮结束、提问、授权提示等） | `desktop/ui/settings-catalog.js` | **已核对** | usage.events 四类（press/turnCost/question/approval）在目录与主线 `resolveUsageSettings`/`validateUsageSettings` 一致；usageMode 按主线固定为 ledger（目录已标注"旧字段"） |
| 一级快捷菜单收敛（七项 + 高级设置… + 移回右下角，其余下沉） | `assets/whale-widget.js` `compactLevel1Menu` | **已移植（清单适配）** | 主线没有「进入独立桌面」独立行、素材包按钮合在「查看数据」行内，下沉清单相应缩减；`syncLevel1Controls` 改读主线 `/api/sound-settings` 单快照 |
| 设置保存广播 → 挂件即时生效 | `whale-widget.js` `onSettingsChanged` 镜像 | **已移植** | localStorage 镜像 + 气泡形状/角色/按压手感即时执行；82 项冒烟含"保存后挂件立即切圆角方形"断言 |
| 「回到挂件细调」编辑器唤起 | `whale-widget.js` `whale-open-editor` 监听 | **已移植** | role/snap/bubble/reminder/workshop 五个入口；workshop 需要 `window.WhaleWorkshopOpen`（已加）；挂件先收到 `show()` 再开弹层 |
| workshop/preferences-v3/account-view 小改 | `desktop/ui/*` | **已移植** | WhaleWorkshopOpen 导出、WhaleFeedback.reload、「数据显示」→「查看数据」 |
| check-package 登记设置文件 | `scripts/check-package.mjs` | **已适配** | 主线 dispatcher 按路径解析 UI 文件（无白名单表），改为文件存在性 + 目录 validate() 校验 |
| `generate-config-doc.mjs` + `docs/CONFIGURATION.md` | `scripts/generate-config-doc.mjs` | **已移植** | 54 条目生成并 `--check` 通过 |
| settings 三份测试 | `tests/settings-{catalog,store,fixture}.mjs`、`settings-window-smoke.mjs` | **已移植并适配** | 夹具的 `dispatcher.host.writeSizeConfig`/`/dsh-whale/size.json` 改为 `soundSettings.load/save`；下沉清单适配主线菜单；测试装配进主线 `test-harness`（不塞回 main.cjs） |

## 4. 明确不迁入（任务书 §3/§4）

- 喂米饭互动分支（d0e635c 之后的未提交工作）及其目录的未提交修改。
- 「设置优化实施」分支（a331235）的另一套设置实现。
- 来源 AGENTS.md（旧分支规则，不复制到新基线）。
- 复杂编辑器（气泡/素材/音频/API 模型）原生化进设置窗口——按任务书默认走桥接，复用挂件现有编辑器。
