# GitHub 发布与仓库维护

当前 Codex 适配版发布到独立仓库 `pussiecatcat/Codex-Balance-Whale-Widget`。原始仓库 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 继续作为上游来源；独立发布不会改写上游分支、标签或 Release。

## 分支与版本

- 默认分支：`main`
- 本地开发分支：`For-Codex`
- 发行标签：`codex-v0.3.0-fixed.3`
- Release 标题：`Codex 额度小鲸鱼 v0.3(fixed)`
- 插件构建标识：`0.3.0+codex.20261003-quota-tide`

首次发布时将整理后的 `For-Codex` 提交推送为个人仓库的 `main`。保留本地 `origin` 指向上游，个人仓库使用单独的 `personal` 远端，避免以后误推上游。

## 仓库包含的内容

仓库提交完整的可维护源码与有价值的开发材料：

- Electron 桌面端、Windows 原生窗口代码和 macOS 兼容代码；
- Codex 额度读取、会话监测、API DIY、记账、资源和工坊逻辑；
- 角色、气泡、音效等上游随项目分发的素材；
- 安装、回滚、构建与验证脚本；
- 单元、界面、桌面和原生窗口测试；
- README、功能对照、验证记录、来源、许可和安全文档；
- 0.2.4 适配归档，用于追溯历史实现。

生成目录、安装暂存目录、测试截图、日志、用户配置、账本、个人额度快照、密钥、IPC 令牌、安装回执和本机备份不会提交。

## Release 附件

- `api-balance-whale-v0.3(fixed).zip`
- `api-balance-whale-v0.3(fixed)-source.zip`
- 两份对应的 `.sha256`
- `release-manifest.json`
- `verification-report.json`（如构建生成）

安装包不内置 Electron，首次安装需要联网。文件名中的括号是名称的一部分，命令行使用时应引用完整文件名。

## 重建发行包

在仓库根目录使用 Python 3.10+：

```powershell
python scripts/build-release.py --release-tag codex-v0.3.0-fixed.3
```

构建器会：

1. 按公开文件清单收集源码、文档和素材；
2. 排除 Git 元数据、历史包、运行数据、私密配置、聊天媒体和测试原始输出；
3. 对公开内容执行隐私扫描和本地 Markdown 链接检查；
4. 统一文本换行，并保留 Windows 脚本所需的 CRLF；
5. 验证 ZIP 完整性并生成 SHA-256 与构建清单。

`vendor/smol-toml/dist` 是运行依赖，不应因为目录名包含 `dist` 而删除。

## 发布前检查

1. `npm test` 全部通过。
2. `git diff --check` 无空白错误。
3. Git 跟踪列表不包含 `outputs/`、`packages/`、`.codex/`、用户配置、日志或密钥。
4. README 中的安装方法、功能、限制、测试数量和构建标识与代码一致。
5. `LICENSE`、`PROVENANCE.md`、`THIRD_PARTY_NOTICES.md` 及 macOS PR #128 署名保留。
6. 发行包隐私扫描、ZIP 完整性和 Markdown 链接检查通过。

## 许可与数据边界

代码和文档沿用 MIT 许可。原图片、动图和音频按上游条款随挂件分发，不被重新声明为个人原创。个人仓库和 Release 均不得包含 API 密钥、账号配置、账本、会话正文、真实账号截图、额度快照、运行日志、IPC 令牌、安装回执或本机备份。

完整来源边界见 [PROVENANCE.md](../PROVENANCE.md)，第三方依赖见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
