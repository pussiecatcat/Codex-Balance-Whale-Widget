# docs 索引

本目录按用途分组。**改代码前不需要通读 `docs/`**：先看根目录 [CLAUDE.md](../CLAUDE.md)；
只有在要弄清某项行为「为什么是这样」时，再按下面的分组挑一份读。

## 架构与重构

| 文档 | 内容 |
|---|---|
| [架构审阅与渐进重构方案](REFACTOR-PLAN.md) | 代码证据、目标边界、分阶段实施顺序、验收和回滚；阶段状态见文件开头 |
| [阶段 0–2 基线与验收记录](history/REFACTOR-BASELINE.md) | 历史记录：路由/事件/存储归属、合成样本、测试入口（已归档） |

## 规格与产品决定（改行为前必读）

| 文档 | 什么时候读 |
|---|---|
| [v0.3 实施范围与来源](V0.3-PLAN-AND-PROVENANCE.md) | **数据口径的权威定义**：订阅额度、API 余额、本机观测 token 各自的确切语义与边界 |
| [空白点击设计决定](OUTSIDE-CLICK-DECISION.md) | 想加「点击空白关闭」之前必读 —— 记录为什么刻意不做 |
| [紧凑菜单与原 B 版功能对照](DASHBOARD-B.md) | 要动菜单或面板布局之前必读 |
| [显示与气泡生命周期说明](SURFACE-LIFECYCLE-FIX.md) | 动气泡淡出、表面生命周期之前必读 |
| [界面与产品整改方案](DESIGN-REMEDIATION.md) | 执行界面整改之前必读：根因、设计规范、工作包和验收标准 |

## 当前版本的验收证据

| 文档 | 内容 |
|---|---|
| [验证基线](BASELINE.md) | 环境、命令结果、已知失败与未覆盖项；每次改动后更新 |
| [故障排查](TROUBLESHOOTING.md) | 按状态表排查「请登录」「暂无额度」「未找到 Codex」等常见状态 |

判定口径：**旧版测试数量不能替代当前版本的通过证据**。

## v0.3 过程记录（历史，仅追溯时读）

以下文档记录 v0.3 那一轮的排查与修复过程，**不是当前行为的规格**。

| 文档 | 内容 |
|---|---|
| [v0.3(fixed) 开发摘要](history/DEVELOPMENT_SUMMARY.md) | 一页版摘要 |
| [v0.3 交互问题修复](history/FEEDBACK-FIX-0.3.md) | 问题定位与修复记录 |
| [v0.3(fixed) 验证记录](history/VERIFICATION-0.3.md) | 历史证据范围与限制 |
| [用户测试清单](history/USER_TEST_CHECKLIST.md) | 历史验收步骤 |
| [阶段 4–5 记录](history/REFACTOR-STAGES-4-5.md) | 拆分阶段记录 |
| [Windows 显示候选修复](history/VISIBILITY-CANDIDATE.md) | 显示候选改动、复现与回滚 |
| [上游 README 快照](history/UPSTREAM-README.md) | 仅作来源记录；安装与计费口径不适用于本插件 |

## 功能对照

| 文档 | 内容 |
|---|---|
| [DSH 功能报告逐项对照](ORIGINAL-FEATURE-AUDIT.md) | 上游 DSH 原版各章功能与本适配的补齐情况 |

## 使用与平台

| 文档 | 内容 |
|---|---|
| [订阅额度 DIY 气泡](CODEX-QUOTA-DIY.md) | 订阅额度气泡的配置用法 |
| [macOS 安装、验证与回滚](MACOS.md) | 仅静态验证，待实机验收 |

## 发布与署名

| 文档 | 内容 |
|---|---|
| [GitHub 发布与仓库维护](GITHUB_PUBLISHING.md) | 分支与版本、发布包重建、发布前检查 |
| [来源与署名](ATTRIBUTION.md) | 上游署名与素材条款 |

根目录另有 [PROVENANCE.md](../PROVENANCE.md)、[SECURITY.md](../SECURITY.md)、[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)、[CHANGELOG.md](../CHANGELOG.md)、[RELEASE_NOTES.md](../RELEASE_NOTES.md)。
