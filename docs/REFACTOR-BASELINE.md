# 重构阶段 0–2 基线与验收记录

日期：2026-10-09。重构前基线：`c799866d38392e52cd464156cfaaa69cce16e4b2`。

本文记录前三阶段的行为边界、可重复验证入口和结构改善指标。性能部分只规定同机测量方法；当前没有稳定的重构前桌面耗时样本，因此不宣称 CPU、内存、启动时间或帧率提高了某个百分比。

## 1. 数据与接口归属

| 路径或事件 | 负责人 | 当前用途 | 兼容状态 |
|---|---|---|---|
| `GET/PUT /api/sound-settings` | `SoundSettingsService` | 一次读取或提交 size 与 usage 的规范化快照；使用 revision 防止覆盖并发修改 | 新的唯一 renderer 写入口 |
| ~~`/dsh-whale/size.json`~~ | 已删除 | 旧 size 写入端点 | 已移除；renderer 改用 `GET/PUT /api/sound-settings` 做读-改-写 |
| ~~`/dsh-whale/usage-settings.json`~~ | 已删除 | 旧 usage 写入端点 | 已移除；renderer 改用 `GET/PUT /api/sound-settings` 做读-改-写 |
| `/dsh-whale/audio.json` | 旧音频素材库 | 音频组和片段的独立导入、编辑与目录读取 | 素材操作不进入设置事务 |
| `/dsh-whale/wait.json` | `WhaleService` | 当前提问或授权等待状态 | 等待控制器只读 |
| `whale-legacy-sound-ready` | legacy sound adapter | 通知 ESM 入口显式适配器已可用 | 迁移期事件 |
| `whale-sound-settings-applied` | sound controller | 让等待提示立即采用规范化后的 usage 快照 | 迁移期跨功能通知 |
| `whale-wait-dismissed` | 等待提示交互 | 记录同一 pending 已被用户收起 | 现有行为保留 |

| 文件 | 最终写入负责人 | 一致性策略 |
|---|---|---|
| `.dshw-size.json` | `SizeSettingsStore` | 单文件原子替换；组合保存由事务服务协调 |
| `usage-settings.json` | `WhaleService.commitUsageSettings()` | 单文件原子替换；组合保存由事务服务协调 |
| `sound-settings-transaction.json` | `SoundSettingsService` | 先写 prepared journal；提交前崩溃恢复旧快照，committed 后崩溃重放新快照 |
| `whale-audio/audio.json` 与 WAV 素材 | 资源仓库 | 保持现有导入和索引策略，本阶段未改变格式 |

组合保存保持现有数据文件格式，也保留未知字段。成功响应只在两份文件都写入并持久记录 committed 状态之后返回。损坏的 journal 不会被猜测修复；该功能返回可识别的 503 错误并保留现场。

## 2. 合成样本

可重复的历史样本位于 [`tests/fixtures/refactor-baseline-history.json`](../tests/fixtures/refactor-baseline-history.json)。它只包含固定的虚构会话、主任务、子任务和 token 数，不含用户路径、账号、接口地址或凭据。

[`tests/refactor-baseline-fixture.test.mjs`](../tests/refactor-baseline-fixture.test.mjs)把样本送入真实 `SessionParser`，验证主任务与子任务投影，避免样本随实现变化后失效。音效事务测试都在操作系统临时目录生成数据，不读取用户配置。

## 3. 验收入口

| 命令 | 验证内容 |
|---|---|
| `npm test` / `npm run test:unit` | 默认 Node 回归测试；原命令保持不变 |
| `npm run check:architecture` | 新音效边界不得出现中文 DOM 查询、模拟旧按钮点击、`MutationObserver`、直接 `fetch` 或 size/usage 双写端点 |
| `npm run check:package` | 新 renderer 和 runtime 模块都进入运行依赖图 |
| `npm run verify` | 单测、包依赖、架构边界和发布包检查 |
| `npm run test:desktop` | 隔离数据目录中的 Windows Electron 桌面审计 |

桌面场景的预期结果：

1. 紧凑菜单仍出现“音效与提示 / 全局设置”，四个设置分区保持原样。
2. 取消和 Escape 不写文件；保存只调用一次组合设置端点。
3. 静音、独立音量、跟随按压音量、试听与提示内容编辑保持现有语义。
4. “新建音效组”直接调用 adapter；取消返回 `cancelled`，保存返回 `saved` 和新目录，父设置草稿不依赖样式观察。
5. 设置保存后，当前等待提示缓存失效并按新配置重新判断。
6. 退出后重启，保存的 size 与 usage 要么都是旧值，要么都是新值，不允许混合。

Windows GUI 结果单独记录。macOS 路径继续做静态和通用 Node 验证；没有 Mac 实机结果时不标记为实机通过。

## 4. 故障注入门槛

[`tests/sound-settings.test.mjs`](../tests/sound-settings.test.mjs)覆盖：

- stale revision 和两个并发保存只有一个成功；
- 第二文件写入失败后完整回滚；
- journal、size、usage、commit 四个阶段的突然退出与重启恢复；
- 回滚自身失败时保留 journal，下一次启动继续恢复；
- 原文件不存在时恢复“仍不存在”；
- journal 损坏时拒绝猜测状态。

[`tests/sound-settings-ui.test.mjs`](../tests/sound-settings-ui.test.mjs)覆盖请求错误分类、声音引用、草稿隔离、取消零写入、单次组合 PUT、等待提示去重和生命周期销毁。

## 5. 可维护性指标

指标由 [`scripts/refactor-metrics.mjs`](../scripts/refactor-metrics.mjs)计算并由单测守护。

| 指标 | 重构前 | 阶段 2 后 |
|---|---:|---:|
| `desktop/ui/sound-settings.js` | 306 行、视图/请求/提交混合 | 23 行启动入口 |
| 经典脚本标签 | 19 | 17；两个入口改为 ESM |
| 新音效边界中的中文 DOM/标题查找 | 2 | 0 |
| 模拟旧按钮 `.click()` | 1 | 0 |
| 以 `MutationObserver` 猜编辑完成 | 1 | 0 |
| 新音效边界中的直接 `fetch` | 1 个封装 | 0；统一走 request client |
| renderer 直接引用 size/usage 写端点 | 2 | 0 |
| renderer 保存设置的写请求 | 2 次加可能的补偿写 | 1 次组合 PUT |
| 可直接 import 的音效前端模块 | 0 | request、sound reference、model、controller、view |

`assets/whale-widget.js` 暂时增加了小型 legacy adapter，因此本阶段的目标是降低依赖和修改扩散，并非减少总代码行数。adapter 在后续迁移完成后再删除。

## 6. 性能记录方法

在同一机器、显示缩放、Electron 版本与合成数据目录下，各运行至少五次并报告中位数和范围：

1. 从进程启动到角色可交互的毫秒数；
2. 打开音效设置的请求数量及从点击到面板可见的毫秒数；
3. 显示、隐藏各 60 秒的进程 CPU 与任务数；
4. 关闭音效面板和等待控制器后残留的 timer、listener 与 pending request 数；
5. 保存一次设置的写请求数、文件替换数和 journal 生命周期。

本阶段已有可稳定断言的结构基线和请求次数；桌面耗时与资源使用仍需同机前后样本，不能从单测耗时推导。

## 7. 2026-10-09 实际验收结果

| 验证项 | 结果 |
|---|---|
| `npm test` | 284 项通过，0 失败、0 跳过 |
| `npm run check:architecture` | 通过；新音效边界的 5 类禁止依赖均为 0，组合端点引用为 2 |
| `npm run check:package` | 通过；新增 renderer/runtime 模块均在依赖图中 |
| `npm run test:desktop` | 通过；隔离 Windows Electron 审计完成 16 项行为检查，renderer 控制台错误为 0 |
| `git diff --check` | 通过 |
| `python scripts/build-release.py` | 通过；发布包清单、隐私扫描、归档完整性与本地链接检查均通过 |

桌面审计实际覆盖组合音效面板的保存、取消与 Escape，四角菜单和 360×320 小视口，原生命中区域，透明区域穿透，外部拖拽，桌面/随行模式切换，设置与消费记录窗口，以及被故意卡死的 renderer 退出清理。

本次没有 macOS 实机，因此 macOS 只由通用 Node 测试、静态平台分支测试和发布包检查覆盖。性能仍按第 6 节的方法保留为后续同机对照项。
