<div align="center">

<img src="docs/xiaolongniang.png" alt="Codex 小龙娘" width="200">

# Codex 小龙娘

**窗边的小龙娘：守护订阅额度与 API 余额，帮你记下coding一点一滴。支持气泡、音效与角色自定义。**

[![版本](https://img.shields.io/github/v/release/pussiecatcat/Codex-Balance-Whale-Widget?label=%E7%89%88%E6%9C%AC&color=203170)](https://github.com/pussiecatcat/Codex-Balance-Whale-Widget/releases/latest)
[![许可证](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT-536ba9)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-%E5%B7%B2%E9%AA%8C%E8%AF%81-2fa24c)](#系统要求)
[![macOS](https://img.shields.io/badge/macOS-%E5%BE%85%E5%AE%9E%E6%9C%BA%E9%AA%8C%E6%94%B6-9ba5bc)](docs/MACOS.md)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-536ba9)](https://nodejs.org/)

[概述](#概述) · [功能](#功能) · [安装](#安装) · [使用](#使用) · [数据来源](#数据来源) · [隐私与安全](#隐私与安全) · [故障排查](#故障排查) · [开发](#开发)

</div>

## 概述

Codex 小龙娘是 Codex 桌面应用的桌面挂件。它跟随 Codex 窗口显示，让你无需离开当前工作，就能查看订阅额度、API 余额和本机用量。

本项目基于 [DeepSeek Balance Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 适配。

> **注意：** 本项目不是 OpenAI 官方产品，也不代表上游发布。

## 功能

| 功能 | 说明 |
| --- | --- |
| 订阅额度 | 分别显示五小时和每周窗口的剩余百分比与重置倒计时 |
| API 余额与记账 | 显示余额、今日已观测消费和近 7 天记录，支持预警与每日预算 |
| 每轮用量 | 任务结束后显示 token 用量；API 模式可显示观测金额或价格估算 |
| DIY 模型 | 提供 34 个服务商模板，可配置接口、价格、提醒和手动额度 |
| 自定义气泡 | 订阅和 API 模式各保存一套气泡序列，可调整内容块、字号、颜色和图片 |
| 角色与素材 | 支持 PNG、GIF 和 APNG，可裁剪、翻转，并导入或导出素材包 |
| 音效与提醒 | 可分别设置按压、任务完成、提问和授权提示 |
| 显示模式 | 可跟随 Codex 窗口或常驻桌面，两种模式分别保存位置和大小 |

> **注意：** 34 个模板表示可配置的类型，不代表这些服务商都公开余额接口，也不代表都已使用真实账号测试。

## 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows x64（已验证）；macOS 兼容代码已保留，尚未完成实机验收 |
| Node.js | 24 或更高版本，包含 npm |
| Codex | 支持插件功能的 Codex 桌面应用 |
| 网络 | 首次安装时需要下载 Electron |

发行包不内置 Electron，也不是独立的可执行文件。

## 安装

### Windows

1. 从 [Releases](https://github.com/pussiecatcat/Codex-Balance-Whale-Widget/releases/latest) 下载 `api-balance-whale-版本号.zip`。请勿下载文件名带 `source` 的源码包。
2. 将 ZIP 完整解压到一个固定目录。
3. 双击 `launchers/安装插件.cmd`。
4. 安装完成后，在 Codex 中新建聊天，以加载新版插件。

也可以使用 PowerShell，先检查再安装：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

安装器会备份旧插件并保留用户数据。所有验证通过后，才会报告安装成功。

如果 Electron 下载缓慢，请在同一 PowerShell 会话中设置镜像，然后运行安装命令：

```powershell
$env:ELECTRON_MIRROR = 'https://mirrors.huaweicloud.com/electron/'
$env:ELECTRON_CUSTOM_DIR = '{{ version }}'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

### macOS

> **注意：** macOS 版本尚未完成实机验收。Apple Silicon、Intel、Spaces、多屏和睡眠唤醒都需要进一步验证。

1. 安装 Xcode Command Line Tools。
2. 运行 `launchers/安装 Mac 自动跟随.command`。

该脚本会安装桌面组件和 LaunchAgent，但不会自动注册 Codex 插件市场。详情请参阅 [macOS 说明](docs/MACOS.md)。

### 回滚

在 Windows 上，双击 `launchers/回滚本次安装.cmd`，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1
```

回滚会恢复旧代码和启动任务，并保留最新的设置、素材和账本。在 macOS 上，请运行 `launchers/回滚 Mac 更新.command`。

## 使用

### 查看额度或余额

1. 打开 Codex，等待角色出现。
2. 点击角色，打开气泡。
3. 点击气泡，查看下一条内容。在最后一条上再次点击，可收起气泡。气泡打开后再点角色，只会触发按压动画，不会切换内容。

### 切换数据来源

在菜单的 **数据来源** 中选择 **Codex 订阅** 或 **API 余额**。两种模式的数据和气泡序列相互独立。

### 自定义外观与内容

- 如需更换角色或调整大小，请使用菜单中的对应选项。
- 如需编辑气泡内容，请打开菜单中的 **气泡DIY**。
- 如需调整按压音效和各类提示，请打开菜单中的 **音效与提示**。
- 如需查看全部选项，请打开完整设置窗口。你可以从菜单的 **高级设置** 或系统托盘进入。

### 快捷键（Windows）

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl+Alt+W` | 恢复显示 |
| `Ctrl+Alt+Shift+F10` | 静默保存窗口诊断信息 |

恢复显示不会抢占焦点、移动 Codex 窗口或截取聊天内容。退出挂件也不会取消正在运行的 Codex 任务。

### 刷新频率

| 状态 | 订阅额度更新频率 |
| --- | --- |
| 气泡关闭 | 约每 30 秒 |
| 气泡打开 | 约每 10 秒 |
| 点击角色打开气泡 | 立即刷新 |

## 数据来源

不同来源的数据含义不同，请勿直接比较或相加。

| 数据 | 来源 | 限制 |
| --- | --- | --- |
| 订阅额度 | Codex 当前登录账号提供的窗口百分比 | 不代表固定的 token 总额 |
| 本机 token | 当前电脑上可扫描到的 Codex 会话 | 可能缺少其他设备的记录 |
| API 余额变化 | 余额观测差额 | 不保证等于每次请求的精确账单 |
| 价格估算 | 你配置的模型价格与汇率 | 不等同于服务商账单 |
| 峰谷提示 | 已识别的官方规则 | 仅用于展示，不会改写历史账本 |

查询失败时，界面会保留上次成功的数值并标注时间。没有可用数据时，界面显示等待同步，不会用 0% 代替未知值。

## 隐私与安全

- **存储位置：** 用户数据保存在 `$CODEX_HOME/whale-widget`，默认路径为 `~/.codex/whale-widget`。你可以使用 `WHALE_HOME` 指定其他目录。
- **凭据：** 配置中只保存环境变量名称，不保存密钥本身。
- **本地通信：** 桌面端使用受限 preload、CSP 和本地 IPC，不开启本地 HTTP 服务。
- **会话数据：** 统计用量时读取本机会话记录，不发送聊天正文。
- **素材包：** 不包含 API 凭据、个人设置、账本、聊天内容或额度快照。

如需了解更多信息，请参阅 [安全说明](SECURITY.md)。

## 卸载

1. 双击 `launchers/停用自动跟随.cmd`，停止随 Codex 启动的跟随任务。
2. 从托盘菜单退出小龙娘（或运行 `node scripts/control.mjs stop`），确认没有残留进程。
3. 删除插件安装目录（默认在 `%USERPROFILE%\.claude\pluginspi-balance-whale`，以你安装时的位置为准）。
4. 如需彻底清除本地数据，删除 `%USERPROFILE%\.codex\whale-widget\`（包含账本、设置、角色与素材、日志）。
5. 想保留数据只回退版本时，不要删除第 4 步的目录，按 [发布与回滚](docs/RELEASING.md#回滚) 操作。

## 故障排查

| 问题 | 解决方法 |
| --- | --- |
| 角色不显示 | 按 `Ctrl+Alt+W`，或在系统托盘中选择 **恢复显示小龙娘**。在跟随模式下，Codex 窗口最小化时角色也会隐藏 |
| 额度显示「上次数据」 | 最近一次查询失败，界面正在显示上次成功的数值。连接恢复后会自动更新 |
| 第三方 API 读不到余额 | 该服务可能没有公开余额接口。请改用手动额度或估算，详情请参阅 [额度 DIY 说明](docs/CODEX-QUOTA-DIY.md) |

其他问题请参阅 [故障排查指南](docs/TROUBLESHOOTING.md)。

### 已知限制

- Codex 未提供可归属到单轮对话的额度变化，因此每轮提示显示 token，不显示额度百分比差值。
- 桌面模式是独立的透明浮窗，不会嵌入系统壁纸层。
- 本地工坊是离线素材管理器，不是在线市场。
- 第三方 API 模板需要服务商提供相应接口，并由你自行配置。

## 开发

```powershell
git clone https://github.com/pussiecatcat/Codex-Balance-Whale-Widget.git
cd Codex-Balance-Whale-Widget
npm ci
npm test
npm run verify
npm start
```

| 命令 | 用途 |
| --- | --- |
| `npm test` | 运行单元测试 |
| `npm run verify` | 运行提交前的完整检查 |
| `npm start` | 启动挂件 |

### 项目结构

```text
assets/      角色、气泡、音频和前端装配入口
desktop/     Electron 宿主、窗口跟随和界面
docs/        设计、验证、平台和维护文档
launchers/   用户双击入口
lib/         资源、媒体和工坊逻辑
runtime/     本地服务、额度读取、会话监测、账本和 API 模型
scripts/     安装、回滚、构建和验证脚本
tests/       单元、界面和桌面测试
```

### 相关文档

- [CLAUDE.md](CLAUDE.md)：架构与开发约定
- [文档索引](docs/README.md)：全部文档
- [架构](docs/ARCHITECTURE.md)：进程、依赖规则与状态归属
- [开发](docs/DEVELOPMENT.md)：环境、测试与调试入口
- [发布](docs/RELEASING.md)：构建、发布前检查与回滚
- [功能对照](docs/history/ORIGINAL-FEATURE-AUDIT.md)：与原版的逐项对照（历史）

## 致谢与许可

- **上游项目：** [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，作者 [MeteorNOX](https://github.com/MeteorNOX)
- **当前维护者：** [pussiecatcat](https://github.com/pussiecatcat)
- **Codex 适配历史维护者：** [Yang-huai406](https://github.com/Yang-huai406)
- **macOS 兼容实现：** [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)，贡献者 [1llysviel](https://github.com/1llysviel)
- **贡献者：** [halamadrid66666-cmyk](https://github.com/halamadrid66666-cmyk)

代码和文档采用 [MIT 许可](LICENSE)。原有图片、动图和音频的再分发条款尚待上游作者书面确认；本仓库不将这些素材声明为原创，也不扩大其许可范围。详情请参阅 [来源与署名](docs/ATTRIBUTION.md)、[第三方声明](THIRD_PARTY_NOTICES.md) 和 [PROVENANCE.md](PROVENANCE.md)。
