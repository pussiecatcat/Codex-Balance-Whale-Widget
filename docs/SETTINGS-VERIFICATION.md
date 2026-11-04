# 大肥鱼设置优化验证报告

日期：2026-10-03。分支：`对话框优化`。平台：macOS（darwin，Electron 44.3.0，Node 24.14.0）。

本报告只记录**本机实际执行过**的验证。没有跑过的项目写在「未完成与限制」里，不做推断。

## 1. 执行的命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm test` | **302 项**。稳定通过 295–296 项，另有 0–3 项 `accounting-recovery` 偶发失败（见下） |
| `node scripts/check-package.mjs` | 通过：6 个设置窗口文件已进路由白名单，54 个目录字段自检通过 |
| `node scripts/generate-config-doc.mjs --check` | 通过：`docs/CONFIGURATION.md` 与设置目录一致 |
| `node tests/settings-window-smoke.mjs <输出目录>` | **74 项全部通过**，产出 6 张截图 |

### 与基线对比

接手时的基线是 **268 项 / 257 通过 / 6 失败**（3 项 `transport.test.mjs`、3 项 `accounting-recovery.test.mjs`）。

- `transport.test.mjs` 的 3 项失败**已被本次修复且不再复现**，原因见 §3 缺陷 ⑤。
- `accounting-recovery.test.mjs` 的 3 项**仍然偶发**，本机连续 4 次整套运行的失败数是 2 / 1 / 2 / 3，失败项每次都不同。单独运行该文件是 **17/17 全过**。这是既有的用例间时序干扰：`runtime/ledger.mjs` 本次未改动（`git diff` 为空），新增的 34 项测试也全部稳定通过。**未定位其根因，留作后续单独处理。**
- 新增 34 项测试，无一失败。

> 上述 `accounting-recovery` 的偶发失败不是「已修复」，也不应被记作通过。

## 2. 设置窗口真实渲染检查（74 项）

用隔离的临时数据目录启动真实 Electron，脚本 `tests/settings-window-smoke.mjs` + `tests/settings-fixture.mjs`。

覆盖并通过：

- **窗口行为**：初始 960×720、可缩放、不永久置顶、`<html>` 不带 `class="desktop"`；重复打开返回同一个窗口不叠加（进程内共 2 个窗口）；没有渲染第二只鲸鱼；关闭设置窗口后挂件仍存活；退出时随挂件一并关闭。
- **内容**：六个分类、字段行与 `!` 说明按钮数量一致、`aria-expanded` 齐全。
- **说明浮层**：点击展开，四要素（有什么用／怎么调／什么时候生效／适合怎么选）齐全；打开后焦点进入卡片；Esc 关闭后焦点回到原按钮；点说明按钮不改动草稿。
- **保存闭环**：改「大小」→ 落盘 → 通过 `/dsh-whale/size.json` 回读一致；**其余 10 个字段逐一断言读回来仍是原值**（`sound`/`vol`/`soundSet`/`usageMode`/`bubbleOn`/`turnCostOn`/`turnCostCloseMs`/`scrollGapOn`/`scrollGapPx`/`menuBtnHide`）。
- **草稿**：撤销回到已保存值而不是默认值；切走再回来草稿仍在；导航给有草稿的分类标计数；撤销后不再有未保存标记。
- **权限隔离**：设置窗口的 preload **不暴露** `shape` / `interactive` / `keyboardFocus` / `ready` / 通用 `command`。
- **私密字段**：`api.baseUrl`、`api.keyEnv`、`api.dashboardUrl` 均不回显真实值。
- **窄窗口**：760×560 下横向溢出 0px，保存按钮仍可见。
- **无渲染器报错**。

截图（`06-narrow-760x560.png` 等 6 张，均为合成数据，不含私密配置）：

| 文件 | 内容 |
| --- | --- |
| `01-appearance.png` | 外观与显示页，960×720 |
| `02-help.png` | `!` 说明浮层展开 |
| `03-dirty.png` | 有未保存修改的提示与按钮态 |
| `04-saved.png` | 保存后 |
| `05-api.png` | API 与用量页（私密字段留空） |
| `06-narrow-760x560.png` | 窄窗口布局 |

## 3. 顺带修复的既有缺陷

五处都在本次改动路径上，都有回归测试覆盖（`tests/settings-store.test.mjs`）。

| # | 位置 | 原症状 | 现状 |
| --- | --- | --- | --- |
| ① | `lib/widget-host.mjs` `writeSizeConfig` | `for` 循环的 `catch` 里是 `return`，老 `profiles/web/.dshw-size.json` 只读不写，保存后配置分裂到两个文件 | 固定写主路径并迁移旧配置；损坏文件**报错而不覆盖** |
| ② | `lib/widget-host.mjs` 部分写入 | 未提及的字段被重置为写入默认值（`scrollGapPx` 读默认 17、写默认 0） | 缺省字段沿用磁盘上的值，只覆盖真实改动的键 |
| ③ | `runtime/service.mjs` `readUsageSettings` | 每次读取都用 `dashboardUrl` 覆盖用户自定义的 `alert` 链接；配置解析失败时 `.find()` 抛错导致接口 500 | 解析失败保留默认占位链接；空地址不覆盖；用户自定义链接稳定 |
| ④ | `runtime/api-models.mjs` + `desktop/ui/api-models.js` | 清除手动额度发 `manualQuota: null`，存储侧只判 truthy，静默无效 | 显式 `null` 删除该组；未提交时不误删 |
| ⑤ | `runtime/bridge.mjs` `pipeName` | macOS `sun_path` 上限 104 字节，数据目录稍长就 `listen EINVAL`，**整个桌面挂件起不来**（只写 `desktop-error.json` 后退出） | 超出预算时回退到系统临时目录并保留按数据目录的哈希；认证不变（token 仍在数据目录的 0600 文件里） |

⑤ 同时消除了基线里 `transport.test.mjs` 的 3 项失败。

另外两处防御性改动：

- `/api/ui-state` 的 PUT 从**整份替换**改为按键合并（`null` 表示删除）。该接口此前无调用方，旧语义是「请求里没带的键会被删掉」。
- `UiStateStore` 新增 `setKeys()` 按键合并；`set()` 的整份替换语义保留给既有调用。

## 4. 一级快捷菜单

按方案 §3 收敛为七项 + 底部入口，在真实渲染进程里逐项断言：

查看数据 · 角色 · 大小 · 桌面显示 · 点击音效 · 完成提醒 · 气泡
底部：高级设置… · 位置/移回右下角

下沉到完整设置窗口的行（断言「无遗漏」）：音效、音量、每轮消耗提示、任务结束音效、音效与提示、气泡形状、避让滚动条、吸附与翻转、隐藏菜单按钮、资源管理、显示币种、参考汇率、峰谷时段、素材包导入/导出、进入独立桌面，以及旧的整屏「API 设置」按钮。

「完成提醒」是三选一（关闭／仅气泡／气泡和声音）；读到已有的非标准组合时显示「自定义」，**打开菜单不擅自归一化**。

> **未产出截图**：挂件菜单靠真实光标悬停才展开，而测试环境里光标路由是被 `setTestCursor` 桩掉的，因此一级菜单的可见性用 DOM 断言证明，没有配截图。截图缺失不代表未验证，也不应被当作已验证的视觉证据。

## 5. 未完成与限制

- **T05 复杂编辑器未原生化**。气泡编辑器、吸附弹窗、素材管理、音频组、裁切弹窗仍在 `assets/whale-widget.js`（11842 行单闭包、零导出）内部。本轮按方案决定走**桥接**：设置窗口显示参数摘要 + 「回到挂件细调」按钮，点亮鲸鱼并唤起原有弹层。原生迁移是独立项目，未估算。
- **平台覆盖**。本轮全部验证在 macOS 上完成。Windows 的原生区域裁切、鼠标穿透路径（`usesWindowShape`）**未在真机验证**，本次也没有改动那条路径。
- **气泡与素材的逐字段契约未补齐**。`docs/CONFIGURATION.md` 的生成区覆盖了 54 个条目，但气泡模块的子字段（布局、配色、随机权重、模型绑定等）仍以 ID 模式登记，未逐项展开。
- **8 个 Agent 修改案例未全部实跑**。T06 要求的案例里，「改角色大小、关点击音效保留提示音、改手动额度、恢复默认值」已由测试覆盖；涉及独立 API 模型价格、另一模式气泡序列的案例需要真实服务端点，本轮未执行。
- **`apiModels` / `bubble` / `media` 三个域尚未接入统一写入者**。它们目前是桥接或只读，设置窗口的保存按钮对这三类字段不生效。
- **`accounting-recovery.test.mjs` 的 3 项偶发失败根因未定位**，见 §1。它与本次改动无关，但会让「整套测试是否全绿」这个问题没有确定答案。
- **源码改完不等于用户桌面上的挂件已更新**。本次没有安装、替换、发布或推送任何东西。

## 6. 接手时未提交改动的处置

工作区在我接手前就存在未提交的业务代码改动：`assets/whale-widget.js`（新增「气泡形状」行）、
`desktop/ui/render.js`、`desktop/ui/ui.css`、`tests/audit-ui-regression.mjs`、`tests/bubble-fit.test.mjs`。
与「本轮仅修改文档」的描述不符。本次**没有回退或覆盖它们**：

- 「气泡形状」已作为 `ui.bubbleShape` 登记进设置目录，出现在完整设置窗口的「气泡内容」分类，
  一级菜单里那一行被收敛隐藏，功能没有丢。
- `render.js` / `ui.css` 的内容框自适应改动原样保留，`tests/bubble-fit.test.mjs` 全程通过。
- 新增的 `07` 截图项曾因这些改动受影响，检查后确认无关。
