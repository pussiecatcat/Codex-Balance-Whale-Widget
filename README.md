<div align="center">

<img src="docs/xiaolongniang.png" alt="Codex 小龙娘" width="240">

# Codex 小龙娘

**窗边的小龙娘：守护订阅额度与 API 余额，帮你记下coding一点一滴。支持气泡、音效与角色自定义。**

[![最新版本](https://img.shields.io/github/v/release/pussiecatcat/Codex-Balance-Whale-Widget?label=%E7%89%88%E6%9C%AC&color=203170)](https://github.com/pussiecatcat/Codex-Balance-Whale-Widget/releases/latest)
[![许可证](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT-536ba9)](LICENSE)
[![平台](https://img.shields.io/badge/Windows-%E5%B7%B2%E9%AA%8C%E8%AF%81-2fa24c)](#快速开始)
[![macOS](https://img.shields.io/badge/macOS-%E5%BE%85%E5%AE%9E%E6%9C%BA%E9%AA%8C%E6%94%B6-9ba5bc)](docs/MACOS.md)
[![Node](https://img.shields.io/badge/Node.js-24%2B-536ba9)](https://nodejs.org/)

[认识她](#认识她) · [能做什么](#能做什么) · [快速开始](#快速开始) · [日常相处](#日常相处) · [数据与隐私](#数据与隐私) · [常见问题](#常见问题) · [参与开发](#参与开发)

</div>

---

## 认识她

写代码的时候，最怕数字悄悄溜走：五小时的额度还剩多少，这周还能用多久，API 余额又在什么时候见了底。

小龙娘便是为此而来。她是一只轻巧的桌面挂件，安静地停在 Codex 窗口的一角，随窗口移动，也随窗口隐去。想知道额度时轻轻点她一下，气泡里便是答案；一轮任务结束，她也会告诉你这一轮用了多少。

透明的地方不挡路，点击会穿过她，落到你正在用的软件上。平日里，她只占一隅。

> 本项目基于 [DeepSeek Balance Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 适配而来，保留了原版的桌宠、气泡与记账手感。它不是 OpenAI 官方产品，也不代表上游发布。

## 能做什么

| | 功能 | 说明 |
| --- | --- | --- |
| **额度** | Codex 订阅额度 | 五小时与每周窗口分开显示剩余百分比和重置倒计时 |
| **余额** | API 余额与记账 | 余额、今日已观测消费、近 7 天记录、预警与预算 |
| **用量** | 每轮任务回执 | 一轮结束后显示 token 用量，API 模式还可显示观测金额或价格估算 |
| **模型** | DIY 模型 | 内置 34 个服务商模板，可配置独立接口、价格、提醒和手动额度 |
| **气泡** | 自定义内容 | 两种模式各有一套气泡序列，内容、字号、颜色和图片都能调 |
| **形象** | 角色与素材 | 支持 PNG、GIF、APNG 角色，可裁剪、翻转，素材包可导入导出 |
| **声音** | 音效与提醒 | 按压、任务完成、提问和授权提示可分别设置气泡、音效和音量 |
| **陪伴** | 两种停靠方式 | 跟随 Codex 窗口，或独自常驻桌面，位置和大小分别保存 |

<details>
<summary><b>展开看更多细节</b></summary>

### 订阅额度

- 通过本机 `codex app-server` 读取当前登录账号提供的额度窗口。
- 气泡关闭时约每 30 秒更新一次，打开期间约每 10 秒更新一次；点开气泡时会强制刷新。
- 查询失败时保留上次成功的数值并明确标注；确实没有数据时显示等待同步，绝不以 0% 代替未知。
- 退出、切换账号或登录失效时清除旧数据，避免串号。

### 气泡交互

- 点击角色打开气泡，点击气泡翻到下一条，最后一条再点一下便收起。
- 也可以开启「点按角色推进」，让角色来翻页。
- 同一步可以放两条随机内容，并按权重决定各自出现的比例。
- 链接只在真实气泡中打开，编辑预览不会跳转。

### 记账与 DIY 模型

- 账本使用固定精度金额，能处理充值、乱序余额观测、版本冲突和历史归档。
- 模板支持 JSON 路径、多个额度窗口、模型匹配、每日 token 与估算费用提醒。
- 支持手动额度，以及按本机 token 扣减的每日或每周额度；估算值始终明确标注。
- 34 个模板代表配置能力，不代表 34 家服务商都公开余额接口，或都已用真实账号测试。

### 窗口与快捷键

- 默认跟随 Codex 移动、缩放、最小化和恢复。
- Windows 上按 `Ctrl+Alt+W` 可恢复显示，按 `Ctrl+Alt+Shift+F10` 可静默保存窗口诊断。
- 显示恢复不会抢焦点、移动 Codex 或截取聊天内容。

</details>

## 快速开始

### 准备

| 需要 | 说明 |
| --- | --- |
| 系统 | Windows x64 为已验证环境；macOS 兼容代码已保留，尚未完成实机验收 |
| Node.js | 24 或更高版本，并包含 npm |
| Codex | 支持插件功能的 Codex 桌面应用 |
| 网络 | 首次安装需要下载 Electron；发行包不内置 Electron，也不是独立 EXE |

### Windows 安装

1. 在 [Releases](https://github.com/pussiecatcat/Codex-Balance-Whale-Widget/releases/latest) 下载 `api-balance-whale-版本号.zip`（不是带 `source` 的源码包），完整解压到一个固定目录。
2. 双击 `launchers/安装插件.cmd`。请不要直接在 ZIP 内运行。
3. 安装完成后，在 Codex 里新建一个聊天，让它加载新版插件。

如果喜欢命令行，可以先检查再安装：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

安装器会备份旧插件、保留你的数据，并在全部验证通过后才报告成功。

<details>
<summary><b>Electron 下载太慢？</b></summary>

在同一个 PowerShell 窗口里临时设置镜像，再运行安装：

```powershell
$env:ELECTRON_MIRROR = 'https://mirrors.huaweicloud.com/electron/'
$env:ELECTRON_CUSTOM_DIR = '{{ version }}'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

</details>

<details>
<summary><b>macOS 用户</b></summary>

运行 `launchers/安装 Mac 自动跟随.command`，需要 Xcode Command Line Tools。脚本会安装桌面组件和 LaunchAgent，但目前不会自动注册 Codex 插件市场。Apple Silicon、Intel、Spaces、多屏和睡眠唤醒都还待实机验证，详见 [macOS 说明](docs/MACOS.md)。

</details>

## 日常相处

1. **见面：** 打开 Codex，稍等片刻她便会出现。移动窗口，她会跟着走。
2. **问询：** 点她一下，气泡里是当前的额度或余额；点气泡看下一条。
3. **切换：** 在菜单里选择「Codex 订阅」或「API 余额」，两边的数字各走各的，从不混算。
4. **打扮：** 在菜单里换角色、调大小，或进入「自定义泡泡」编排气泡内容。
5. **细调：** 其余选项都在完整设置窗口里，从菜单或托盘都能打开。

一时找不到她，可以按 `Ctrl+Alt+W`，或在托盘选择「恢复显示小龙娘」。退出挂件不会打断正在运行的 Codex 任务。

### 想回到上一个版本

双击 `launchers/回滚本次安装.cmd`，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1
```

回滚会恢复旧代码和启动任务，同时保留最新的设置、素材与账本。macOS 可运行 `launchers/回滚 Mac 更新.command`。

## 数据与隐私

### 每个数字从哪里来

小龙娘不把不同来源的数字混在一起，也不替它们粉饰：

| 数字 | 来源 | 请这样理解 |
| --- | --- | --- |
| 订阅额度 | Codex 当前登录账号提供的窗口百分比 | 不是固定的 token 总额 |
| 本机 token | 这台电脑上可扫描到的 Codex 会话 | 可能缺少其他设备的记录 |
| API 余额变化 | 余额观测差额 | 不保证等于每次请求的精确账单 |
| 价格估算 | 你配置的模型价格与汇率 | 不等同于服务商账单 |
| 峰谷提示 | 已识别的官方规则 | 只作展示，不改写历史账本 |

### 你的东西留在你这里

- 数据保存在 `$CODEX_HOME/whale-widget`，默认是 `~/.codex/whale-widget`，也可以用 `WHALE_HOME` 指定目录。
- 凭据配置只保存环境变量名，不保存密钥本身。
- 桌面端使用受限 preload、CSP 和本地 IPC，不开启本地 HTTP 服务。
- 统计本机用量时读取本机会话记录，不发送聊天正文。
- 素材包不包含 API 凭据、个人设置、账本、聊天内容或额度快照。

更多说明见 [安全说明](SECURITY.md)。

## 常见问题

<details>
<summary><b>她怎么不见了？</b></summary>

先按 `Ctrl+Alt+W`，或在托盘选择「恢复显示小龙娘」。如果 Codex 窗口已最小化，跟随模式下她也会一起隐去。其他情况请看 [故障排查](docs/TROUBLESHOOTING.md)。

</details>

<details>
<summary><b>为什么每轮提示只显示 token，不显示额度消耗了几个百分点？</b></summary>

Codex 没有提供可以可靠归属到单轮对话的额度变化。与其算出一个好看却不可靠的数字，不如如实显示 token。

</details>

<details>
<summary><b>额度显示「上次数据」是什么意思？</b></summary>

最近一次查询没有成功，她仍在展示上一次成功的数值，并标明了时间。网络恢复后会自动更新。

</details>

<details>
<summary><b>第三方 API 模板为什么读不到余额？</b></summary>

有模板不等于服务一定公开余额接口。可以在模型设置里改用手动额度或估算，详见 [Codex 额度 DIY 说明](docs/CODEX-QUOTA-DIY.md)。

</details>

<details>
<summary><b>能把她设成桌面壁纸吗？</b></summary>

不能。桌面模式是一个独立的透明浮窗，不会嵌入系统壁纸层。

</details>

## 参与开发

```powershell
git clone https://github.com/pussiecatcat/Codex-Balance-Whale-Widget.git
cd Codex-Balance-Whale-Widget
npm ci
npm test            # 单元测试
npm run verify      # 提交前的完整检查
npm start           # 启动挂件
```

```text
assets/    角色、气泡、音频与前端装配入口
desktop/   Electron 宿主、窗口跟随与界面
runtime/   本地服务、额度读取、会话监测、账本与 API 模型
lib/       资源、媒体与工坊逻辑
scripts/   安装、回滚、构建和验证脚本
launchers/ 双击即用的入口
tests/     单元、界面与桌面测试
docs/      设计、验证、平台与维护文档
```

改代码前可以先读 [CLAUDE.md](CLAUDE.md) 和 [文档索引](docs/README.md)。验证现状见 [验证基线](docs/BASELINE.md)，与原版的逐项对照见 [功能对照](docs/ORIGINAL-FEATURE-AUDIT.md)。

## 致谢与许可

这只小龙娘站在许多人的肩上：

- **上游项目：** [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，作者 [MeteorNOX](https://github.com/MeteorNOX)
- **当前维护：** [pussiecatcat](https://github.com/pussiecatcat)
- **Codex 适配历史维护：** [Yang-huai406](https://github.com/Yang-huai406)
- **macOS 兼容实现：** [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)，贡献者 [1llysviel](https://github.com/1llysviel)
- **贡献者：** [halamadrid66666-cmyk](https://github.com/halamadrid66666-cmyk)

代码与文档沿用 [MIT 许可](LICENSE)。原有图片、动图和音频的再分发条款尚待上游作者书面确认，本仓库不把这些素材声明为原创，也不扩大其许可范围，详见 [来源与署名](docs/ATTRIBUTION.md)。第三方依赖见 [第三方声明](THIRD_PARTY_NOTICES.md)，改编范围见 [PROVENANCE.md](PROVENANCE.md)。

<div align="center">

如果她陪你度过了一段顺手的时光，欢迎点一颗 ⭐

</div>
