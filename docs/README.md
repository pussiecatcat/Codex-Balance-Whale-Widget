# docs 索引

改代码前不需要通读 `docs/`：先看根目录 [CLAUDE.md](../CLAUDE.md) 和 [ARCHITECTURE.md](ARCHITECTURE.md)。
只有要弄清某项行为「为什么是这样」时，再按下面的分组挑一份读。

## 架构与开发

| 文档 | 内容 |
|---|---|
| [架构](ARCHITECTURE.md) | 进程与入口、依赖规则、状态归属、变更传播、生命周期、扩展方式、兼容清单 |
| [开发](DEVELOPMENT.md) | 环境、运行、测试分层、调试入口、代码约定 |
| [发布与仓库维护](RELEASING.md) | 分支与版本、构建、发布前检查、安装验证、回滚 |
| [功能对照](history/ORIGINAL-FEATURE-AUDIT.md) | 上游 DSH 原版各章功能与本适配的补齐情况（历史） |

## 规格与产品决定（改行为前必读）

| 文档 | 什么时候读 |
|---|---|
| [数据口径](decisions/DATA-SEMANTICS.md) | **权威定义**：订阅额度、API 余额、本机观测 token 各自的确切语义与边界 |
| [空白点击设计决定](decisions/OUTSIDE-CLICK.md) | 想加「点击空白关闭」之前必读 —— 记录为什么刻意不做 |
| [紧凑菜单](decisions/COMPACT-MENU.md) | 要动菜单或面板布局之前必读（已按当前菜单更新） |
| [表面生命周期](decisions/SURFACE-LIFECYCLE.md) | 动气泡淡出、表面生命周期之前必读 |

## 使用与平台

| 文档 | 内容 |
|---|---|
| [配置项](CONFIGURATION.md) | 由设置目录生成的字段说明、默认值与生效方式 |
| [订阅额度 DIY 气泡](CODEX-QUOTA-DIY.md) | 订阅额度气泡的配置用法 |
| [故障排查](TROUBLESHOOTING.md) | 按状态表排查「请登录」「暂无额度」「未找到 Codex」等常见状态 |
| [macOS 安装、验证与回滚](MACOS.md) | 仅静态验证，待实机验收 |
| [来源与署名](ATTRIBUTION.md) | 上游署名与素材条款 |

## 历史（仅追溯时读，不是当前规格）

`history/` 保存整改前的审阅方案、阶段基线、设置窗口任务书、对话框移植记录和 v0.3 过程记录。
它们记录「当时为什么那样做」，**不要用它们推导当前行为**；当前规格以 `ARCHITECTURE.md` 和 `decisions/` 为准。

根目录另有 [PROVENANCE.md](../PROVENANCE.md)、[SECURITY.md](../SECURITY.md)、[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)、[CHANGELOG.md](../CHANGELOG.md)、[RELEASE_NOTES.md](../RELEASE_NOTES.md)。
