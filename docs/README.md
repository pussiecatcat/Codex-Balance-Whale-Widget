# docs 索引

本目录按用途分组。**改代码前不需要通读 `docs/`**：先看根目录 [CLAUDE.md](../CLAUDE.md)；
只有在要弄清某项行为「为什么是这样」时，再按下面的分组挑一份读。

## 架构与重构

| 文档 | 内容 |
|---|---|
| [架构审阅与渐进重构方案](REFACTOR-PLAN.md) | 基于 `c799866` 的代码证据、目标边界、分阶段实施顺序、验收和回滚；阶段 0–2 已实施 |
| [阶段 0–2 基线与验收记录](REFACTOR-BASELINE.md) | 路由/事件/存储归属、合成样本、测试入口、故障恢复和可维护性指标 |

## 规格与产品决定（改行为前必读）

| 文档 | 什么时候读 |
|---|---|
| [v0.3 实施范围与来源](V0.3-PLAN-AND-PROVENANCE.md) | **数据口径的权威定义**：订阅额度、API 余额、本机观测 token 各自的确切语义与边界。另有 macOS 来源与本版限制 |
| [空白点击设计决定](OUTSIDE-CLICK-DECISION.md) | 想加「点击空白关闭」之前必读 —— 记录为什么刻意不做 |
| [紧凑菜单与原 B 版功能对照](DASHBOARD-B.md) | 要动菜单或面板布局之前必读；记录了 B 版大面板撤下的产品决定，对应实现 `desktop/ui/dashboard.js` 已删除 |

## 当前版本的验收证据

| 文档 | 内容 |
|---|---|
| [v0.3(fixed) 验证记录](VERIFICATION-0.3.md) | 已有证据范围、已知测试限制、尚待用户验收项 |
| [用户测试清单](USER_TEST_CHECKLIST.md) | 交给用户的逐项验收步骤 |

判定口径：**旧版测试数量不能替代当前版本的通过证据**。

## 功能对照

| 文档 | 内容 |
|---|---|
| [DSH 功能报告逐项对照](ORIGINAL-FEATURE-AUDIT.md) | 上游 DSH 原版各章功能与本适配的补齐情况 |

## 使用与平台

| 文档 | 内容 |
|---|---|
| [Codex 额度 DIY 气泡](CODEX-QUOTA-DIY.md) | 订阅额度气泡的配置用法 |
| [macOS 安装、验证与回滚](MACOS.md) | 仅静态验证，待实机验收 |

## 发布与署名

| 文档 | 内容 |
|---|---|
| [GitHub 发布与仓库维护](GITHUB_PUBLISHING.md) | 分支与版本、发布包重建、发布前检查 |
| [来源与署名](ATTRIBUTION.md) | 上游署名与素材条款 |

根目录另有 [PROVENANCE.md](../PROVENANCE.md)、[SECURITY.md](../SECURITY.md)、[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)、[CHANGELOG.md](../CHANGELOG.md)、[RELEASE_NOTES.md](../RELEASE_NOTES.md)。

## v0.3 过程记录（历史，仅追溯时读）

以下文档记录 v0.3 那一轮的排查与修复过程，**不是当前行为的规格**。要理解现状，读上面的「规格与产品决定」就够。

| 文档 | 内容 |
|---|---|
| [v0.3(fixed) 开发摘要](DEVELOPMENT_SUMMARY.md) | 下面各篇的一页版摘要 —— 先读它即可，不必逐篇展开 |
| [v0.3 交互问题修复](FEEDBACK-FIX-0.3.md) | 问题定位与修复记录 |
| [气泡收起与菜单悬停修复](SURFACE-LIFECYCLE-FIX.md) | 绘制生命周期与悬停范围修复 |
| [Windows 显示候选修复](VISIBILITY-CANDIDATE.md) | 显示候选改动、复现与回滚 |

## 上游快照

| 文档 | 内容 |
|---|---|
| [上游 README 快照](UPSTREAM-README.md) | DeepSeek 版原 README，仅作来源记录；其中安装与计费口径**不适用**于本插件 |
