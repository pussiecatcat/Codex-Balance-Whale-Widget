# 验证基线（2026-11-04）

一次性记录当前代码在本机跑出的结果，供以后的改动对照。评审 T-01 要求的是一份带日期的基线，而不是"应该能过"的声明。

## 环境

| | |
|---|---|
| 操作系统 | Windows 11 10.0.26200.9711 |
| Node.js | v24.21.0 |
| Python | 3.12.14 |
| 主机时区 | America/Los_Angeles |
| Codex CLI | 0.166.0-alpha.6（仅用于 MCP / app-server 相关验证） |
| 分支 | `review/2026-11-04-followups`（基于 `refactor/architecture-round-2` @ `7962203`） |
| 工作区 | 干净；本文档随本轮评审修复提交 |
| 采集时间 | 2026-11-04T20:03Z |

## 结果

| 命令 | 结果 |
|---|---|
| `npm run lint` | 通过 |
| `npm test` | **590 tests / 587 pass / 3 fail** |
| `npm run test:coverage` | 可运行；覆盖率数字按需查看，不设门槛 |
| `npm run test:desktop` | 通过；20 项 Electron 检查（角色、APNG、气泡、设置面板、模式切换、形状与退出） |
| `npm run check:package` | 通过 |
| `npm run check:architecture` | 通过（空 catch 290/290，CSS hex 138/138） |
| CI `verify.yml` | lint、test、architecture、bench:ledger、check:calendar、build-release 全部执行 |
| `npm run check:calendar` | 通过；提示峰谷日历覆盖到 2026-12-31 |
| `npm run bench:ledger` | 通过；20,000 条真实字段事件 / 90 天 / 30 MB：load 约 116 ms、records 约 118 ms、today 冷读约 108 ms / 缓存命中约 0 ms、写入约 443 ms、无变化观测约 115 ms |
| `python scripts/build-release.py` | 通过（文件总数随文档增减；sha 与文件数不记入基线） |

`npm run verify` 串起上述全部检查，在本机会停在测试步骤——原因见下节的 3 条已知失败。

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
- 深色模式与 150% 缩放的截图/对比度未验收。
- 未做真实服务商的「保存并测试连接」手工验收。
- 深色模式改为令牌覆盖，但未截图验收对比度；FIX-08 仍需 Electron 实机确认。
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
