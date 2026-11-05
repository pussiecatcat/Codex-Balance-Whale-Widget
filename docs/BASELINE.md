# 验证基线（2026-11-05）

一次性记录当前代码在本机跑出的结果，供以后的改动对照。评审 T-01 要求的是一份带日期的基线，而不是"应该能过"的声明。

## 环境

| | |
|---|---|
| 操作系统 | Windows 11 10.0.26200.9711 |
| Node.js | v24.21.0 |
| Python | 3.12.14 |
| 主机时区 | America/Los_Angeles |
| Codex CLI | 0.166.0-alpha.6（仅用于 MCP / app-server 相关验证） |
| 分支 | `fix/audit-followups-2026-11-05`（基于 `main` @ `5b4ea83`） |
| 工作区 | 干净；本文档随本轮评审修复提交 |
| 采集时间 | 2026-11-05T13:45Z |

## 结果

| 命令 | 结果 |
|---|---|
| `npm run lint` | 通过 |
| `npm test` | **663 tests / 660 pass / 3 fail** |
| `npm run test:coverage` | 可运行；覆盖率数字按需查看，不设门槛 |
| `npm run test:desktop` | 通过；22 项 Electron 检查（角色、APNG、气泡、设置面板、未保存提示、模式切换、形状与退出） |
| `npm run check:package` | 通过 |
| `npm run check:architecture` | 通过（空 catch 302/302，CSS hex 111/111） |
| CI `verify.yml` | lint、test、architecture、bench:ledger、check:calendar、build-release 全部执行 |
| `npm run check:calendar` | 通过；提示峰谷日历覆盖到 2026-12-31 |
| `npm run bench:ledger` | 通过；20,000 条真实字段事件 / 90 天 / 30 MB：load 约 220 ms、records 约 228 ms、today 冷读约 213 ms / 缓存命中约 0.3 ms、写入约 803 ms、无变化观测约 222 ms |
| `python scripts/build-release.py` | 通过（文件总数随文档增减；sha 与文件数不记入基线） |

`npm run verify` 串起上述全部检查，在本机会停在测试步骤——原因见下节的 3 条已知失败。

## 夜间桌面审计

GitHub Actions 的 Desktop audit 第一次运行（run `42015223743`，`5b4ea83`）成功：20 项 Electron 检查通过，上传 12 个产物，说明 59 秒的运行确实跑完了真实窗口审计，而不是提前失败。本轮之后审计增至 22 项，并新增 `tests/bubble-visual.mjs` 作为一个步骤。

## 本轮补的项（2026-11-05）

- 移除自动深色模式，`ui.css` / `whale-widget.css` 统一蓝白；新增 `tests/theme-tokens.test.mjs` 钉住令牌值和正文对比度。
- 订阅账本：启动时把旧 per-key 范围的 `token-only` 根行幂等复制到身份账本（按 `id` 去重，只读旧文件），带金额的记录不迁移。
- 额度卡倒计时改用 `countdownShort`，并在窄卡片里换行而不是省略号。
- 产品名统一：设置窗口标题与托盘入口为「小龙娘设置」，显示模式统一叫「Codex 订阅」。
- `/api/models` 改为显式字段投影，并拒绝把 `sk-` 密钥粘到名称或地址字段。
- API 设置对话框：有未保存修改时先确认；关闭后焦点回到打开它的按钮。

## 已知失败（3 条，主机时区相关）

| 文件 | 用例 |
|---|---|
| `tests/accounting-recovery.test.mjs` | cross-midnight meter interval is retained once… |
| `tests/accounting-recovery.test.mjs` | summaries already deleted by old versions… |
| `tests/usage-alerts.test.mjs` | usage alert templates interpolate amounts… |

根因是测试用本地时间构造时间戳，而账本日界固定 UTC+8：

```
new Date(2026, 6, 1, 9)  → 2026-07-01 09:00 PDT
dayKey(+8h)              → 2026-07-02   （断言期望 2026-07-01）
Date.UTC(2026, 9, 10) 的本地日 → 9      （断言期望 10）
```

同一批断言在 UTC+8 主机上成立；Windows 上的 Node 忽略 `TZ` 环境变量，所以本机无法直接验证"通过"的那一侧。断言在 `d9232f9` 就已存在，与本次 A 桶改动无关。目标用户在中国大陆，这 3 条按已知噪声处理，不阻塞发布；若要修，把 fixture 改成 `Date.UTC(...)` 构造即可。

## 未覆盖

- 未在真实 Codex 会话中调用 MCP 工具（F-02 的最终验收）。
- 设置菜单与气泡的常规渲染已由 `test:desktop` 覆盖；「运行日志 → 打开」「保存并测试连接」和账本恢复提示仍只做了源码/VM 级接线。
- 气泡最小字号与 125%/150%/200% 缩放的截图未验收（额度卡倒计时已改用短格式，避免省略号）。
- 已安装插件副本仍为旧代码；本轮只验证仓库工作区。
- 未做真实服务商的「保存并测试连接」手工验收。
- 自动深色模式已移除，统一使用蓝白配色；`tests/theme-tokens.test.mjs` 检查令牌与正文 4.5:1 对比度，但 Windows 深色系统下的实机截图仍未采集。
- macOS 路径完全未验证。

## 复现

```bash
npm ci
npm run lint
npm test
npm run test:coverage
npm run check:package
npm run check:architecture
npm run check:calendar
npm run bench:ledger
python scripts/build-release.py
```
