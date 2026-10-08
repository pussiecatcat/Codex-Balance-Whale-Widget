# Codex 额度小鲸鱼

<p align="center">
  <img src="assets/DSniang1.png" alt="Codex 额度小鲸鱼" width="260">
</p>

把 [DeepSeek Balance Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的桌面宠物、气泡、音效、资源管理和本地记账能力适配到 Codex。当前构建标识为 `0.3.0+codex.20261008-quota-refresh`，主要面向 Windows；macOS 兼容代码与安装脚本已保留，但尚未完成实机验收。

这个版本的重点是 **Codex Plus 订阅额度**：鲸鱼跟随 Codex 窗口，点击后显示五小时额度、每周额度、各自剩余百分比和重置倒计时。API 余额与本地账本仍完整保留，并放在独立模式中，不会把订阅额度、API 余额和本机 token 混为一谈。

## 主要功能

### Codex 订阅额度

- 通过本机 `codex app-server` 的 `account/rateLimits/read` 读取当前登录账号提供的额度窗口。
- 自动识别五小时与每周额度，用双色“潮汐卡片”显示剩余百分比、水位进度珠和逐秒更新的重置倒计时。
- 手动刷新会跳过 30 秒快照缓存；每轮对话结束后在 1.5 秒与 8 秒各强制读取一次，兼顾快速反馈和官方稍晚结算。
- 卡片显示本次官方快照的更新时间；官方返回小数百分比时保留一位，官方只返回整数时不虚构额外精度。
- 额度读取失败时回退到本机会话里的 `rate_limits` 事件；两种来源都不可用时明确显示“未观测”。
- 数据过期、重置时间异常或扫描不完整时给出状态说明，不用 token 数虚构官方剩余额度。
- 当前 Plus 登录已在 Windows 实机验证；额度数值会实时变化，因此仓库不保存个人额度快照。

### 原版风格的气泡交互

- 第一次点击角色打开气泡；气泡打开后继续点击角色只播放按压、回弹和音效，方便连续“搓”桌宠。
- 点击气泡切换到下一泡，最后一泡再次点击后收起。
- Codex 订阅气泡不会在阅读过程中自动消失；API 气泡保留原有关闭时间。
- 气泡、尾泡与文字按真实动画生命周期完整淡出，避免 Windows 原生窗口区域提前裁切。
- 透明区域穿透到下面的应用，人物、菜单和气泡仍保持准确命中。

### 自定义气泡

- Codex 订阅与 API 余额各自保存独立的气泡序列。
- 每个序列支持最多 6 行、每行最多 6 个模块，可拖放排序并从模块库复用。
- 内置模块包括文本、余额、今日用量、峰谷、下次峰谷、额度、套餐、随机文本、随机图片、固定图片、链接、本轮用量和会话标签。
- Codex 专用模块提供“5 小时额度”和“每周额度”；可选新的“潮汐卡片”，也保留纯文字、进度条、自定义颜色与 `{quota_*}` 变量。
- 每行可调字号、字重、斜体、下划线、文字颜色、底色和折行；图片支持独占行、缩放和权重随机。
- 保留 15 种跑马灯颜色方案、五种峰谷显示样式，以及跨峰谷切换点的原地文字和配色更新。
- 链接模块只在真实气泡中打开，编辑预览不会跳转；外部地址会经过桌面桥校验。

### 每轮对话用量

- 监测本机 Codex 会话，在一轮完成后显示输入、缓存、输出、推理和总 token。
- 子任务用量归入主轮；迟到的子任务会修订记录，但不会重复弹泡或重复播放完成音。
- API 模式可显示观测金额、价格估算、待记账或未知状态；订阅模式显示真实 token，不把百分比变化伪造成单轮额度消耗。
- 失败、取消和被下一轮替代的未结束轮次保留已观测用量，并使用中性提示；重试中的瞬时错误不会提前结算。

### API 余额与 DIY 模型

- “小龙娘记账”按原版模型账本结构显示模型名称、余额/额度摘要、刷新、设置和自定义 API 添加入口；本机模型费用、近 7 天记录和更多消费记录紧随其后。
- 每个模型的“设置”使用原版 DSH 风格详情卡，集中管理余额预警、今日预算、订阅额度、价格估算、已观测消费和可用的余额校正；“密钥 / 接口”与提示气泡编辑从详情卡进入。
- 小龙娘记账与控制面板使用相同的半透明底色和完整高度；中文分区标题使用原版界面粗体，模型、日期、金额和 API 字母使用 Consolas 等宽字体，整个内容区统一上下滚动。
- “近 7 天使用记录”完整展开七行，不再使用独立的狭窄滚动框；今日模型费用也随内容自然增长。
- 保留原版 API 余额、今日消费、汇率、账本、对账、消费记录和余额校正。
- 内置 34 个 DIY 模板，覆盖无余额接口、订阅配额、本地统计、兼容账单和自定义 JSON 端点等类型。
- 支持 JSON 点路径与数组索引、多个额度窗口、模型名匹配、独立价格、每日 token、每日估算费用与提醒阈值。
- 支持手动额度，以及按本机已记录 token 扣减的每日/每周 DIY 额度；估算值始终明确标注，不冒充供应商账单。
- 凭据配置只保存环境变量名；带凭据的请求受目标地址、跳转、响应大小和超时限制。
- DeepSeek 官方直连时可显示工作日/周末峰谷与下次切换倒计时；其他接口不会套用 DeepSeek 计价规则。

> 34 个模板表示配置能力，不代表 34 家服务商都公开余额接口或都已用真实账号测试。无真实密钥的第三方接口使用模拟响应验证。

### 紧凑设置与音效

- 设置页沿用原版小尺寸平铺布局，包含角色、大小、气泡开关、滚动条避让、吸附、翻转、菜单按钮、资源管理和模式切换。
- “提示与音效设置”完整复刻原版四个折叠入口：按压音效、每轮消耗提示、提问提示和授权提示，默认全部收起并在入口显示当前状态摘要。
- 按压区提供音效组、新建音效组、音量和试听；每轮区提供冒泡内容、自动关闭、任务结束音、独立音量和试听；提问/授权区分别提供总开关、冒泡内容、音效开关、选音、音量和试听。
- 设置先在草稿中编辑；只有保存才生效，取消、Esc 或点击遮罩会放弃本次改动。“恢复默认”也只修改草稿，可以继续取消。
- Codex 进入等待回答或等待授权时会触发对应提示；提示常驻到交互完成，也可点气泡收起。可选“点按角色关闭提示气泡”，同一条挂起提示被收起后不会反复弹回。
- 支持内置音效组、自定义音效组、试听和 WAV 片段裁剪；关闭某项音效时下拉与音量置灰，音效开关和试听仍可操作。
- 音效、API 模型、账户显示和按压手感等选择框统一使用原版风格的白色浮层；列表会避开窗口边缘，动态选项和禁用状态会自动同步。

### 角色与资源管理

- 支持 PNG、GIF、APNG 等角色素材，保留动画播放。
- 支持裁剪、旋转、翻转、缩放、角色列表、固定角色、删除和默认回退。
- 支持图片库、随机图片、音频片段、泡泡配置和模块库。
- 素材包可以导入或导出角色、气泡图、音频片段和音效组；导入采用新 ID 并在校验失败时回滚。
- 素材包不包含 API 凭据、个人设置、账本、聊天内容或额度快照。

### 窗口随行与桌面驻留

- 默认跟随 Codex 窗口移动、缩放、最小化和恢复。
- 一个状态按钮在“桌面驻留”和“窗口随行”之间切换，并与素材包入口紧凑排在同一行。
- 桌面驻留不依赖 Codex 窗口存活；两种模式的位置、缩放、翻转和显示状态分别保存。
- Windows 提供 `Ctrl+Alt+W` 恢复显示，以及 `Ctrl+Alt+Shift+F10` 静默保存窗口诊断。
- 显示恢复不会抢焦点、移动 Codex 或截取聊天内容。

### 本地数据与安全

- 桌面端使用受限 preload、CSP、本地 IPC 和 `whale://` 协议，不开启本地 HTTP 服务。
- 导航、外部链接、媒体、导入包、API 地址、重定向和响应大小均有校验。
- 设置、账本和资源使用临时文件加同目录重命名进行原子保存；Windows 占用错误会有限重试。
- 账本使用固定精度金额，处理充值、乱序余额观测、版本冲突、历史裁剪和归档。
- 会话扫描在独立 worker 中运行，设有单文件、文件数和总读取量上限；不发送聊天正文。

## 安装

### 环境要求

- Node.js 24 或更高版本，并包含 npm。
- 支持插件功能的 Codex 桌面应用。
- Windows x64 为已验证环境；桌面组件使用 Electron 44.3.0。
- 首次安装需要联网下载 Electron。发行 ZIP 不内置 Electron 运行时，也不是独立 EXE。

### Windows

1. 下载 Release 中的 `api-balance-whale-v0.3(fixed).zip` 并完整解压到固定目录。
2. 不要直接从 ZIP 内运行脚本；双击 `launchers/安装插件.cmd`。
3. 安装完成后新建一个 Codex 聊天，让 Codex 加载新版插件工具。

也可以在 PowerShell 中先检查再安装：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

安装器会检查本地插件市场、备份旧插件、保留用户数据、注册插件并启动跟随服务。只有验证全部通过才会报告成功。

如果 Electron 下载缓慢，可以在同一 PowerShell 会话中临时设置镜像：

```powershell
$env:ELECTRON_MIRROR = 'https://mirrors.huaweicloud.com/electron/'
$env:ELECTRON_CUSTOM_DIR = '{{ version }}'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

### macOS

保留旧版本目录后运行 `launchers/安装 Mac 自动跟随.command`。安装需要 Xcode Command Line Tools 提供 Swift 编译器。macOS 脚本会安装桌面组件和 LaunchAgent，但目前不自动完成 Codex 插件市场注册；Apple Silicon/Intel、Spaces、多屏和睡眠唤醒仍需实机验证。详见 [macOS 说明](docs/MACOS.md)。

## 日常使用

1. 打开 Codex 后等待鲸鱼出现；移动或缩放 Codex，确认鲸鱼跟随。
2. 点击鲸鱼打开额度气泡，点击气泡依次浏览，继续点击角色可触发按压互动。
3. 在紧凑菜单底部切换“Codex 订阅”与“API 余额”。
4. 进入“自定义泡泡”编辑两种模式各自的序列、模块与样式。
5. 在“音效与提示”中调整按压、每轮结束、提问与授权的气泡、音效和音量。
6. 如果挂件不可见，使用托盘中的“恢复显示小鲸鱼”或按 `Ctrl+Alt+W`。

退出挂件不会取消正在运行的 Codex 任务。

## 回滚

Windows 双击 `launchers/回滚本次安装.cmd`，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1
```

回滚使用安装时生成的私有回执恢复旧代码和启动任务，同时保留最新设置、素材与账本。没有有效回执时脚本不会猜测备份位置。macOS 可运行 `launchers/回滚 Mac 更新.command`。

## 数据位置与隐私边界

用户数据位于 `$CODEX_HOME/whale-widget`，默认是 `~/.codex/whale-widget`；也可以通过 `WHALE_HOME` 指定独立目录。

以下内容不会提交到本仓库，也不会进入公开发行包：

- API 密钥、账号资料和私有接口配置；
- `runtime.json`、IPC 令牌、锁文件和运行日志；
- 个人额度快照、账本、聊天/会话正文和真实账户截图；
- 安装备份、回滚回执、桌面测试输出和本机路径。

诊断文件只记录有限的窗口状态元数据。分享诊断前仍应自行检查内容。

## 数据口径

- **订阅额度**来自 Codex 当前登录账号提供的窗口百分比；它不是固定 token 总额。
- **本机 token**来自当前电脑上可扫描到的 Codex 会话；它可能缺少其他设备或未被扫描的记录。
- **API 余额变化**是余额观测差额，不能保证等于每一次请求的精确账单。
- **价格估算**使用用户配置的模型价格与汇率，始终与供应商实际账单区分。
- **峰谷提示**只展示规则，不自动改写历史账本。

## 验证状态

- 263 项 Node 单元测试通过。
- Windows Electron 紧凑菜单与 DSH 四段式音效页面审查通过。
- Windows 原生区域、透明穿透和焦点专项验证通过。
- 完整桌面烟测通过，包括宿主遮挡以及 72 次跟随移动/缩放。
- 当前 Plus 登录的五小时和每周额度直读已验证。
- macOS 实机、跨额度重置点刷新和长期多设备稳定性仍待验证。

完整证据与限制见 [验证记录](docs/VERIFICATION-0.3.md)，原版报告逐项覆盖情况见 [DSH 功能对照](docs/ORIGINAL-FEATURE-AUDIT.md)。

## 开发与项目结构

```text
assets/              原版角色、气泡、音频与共享前端逻辑
desktop/             Electron 宿主、窗口跟随、原生窗口与界面
runtime/             本地服务、额度读取、会话监测、账本与 API 模型
lib/                 资源、媒体与工坊逻辑
scripts/             安装、回滚、构建和验证脚本
skills/              Codex 插件技能说明
tests/               单元、界面、桌面与原生窗口测试
vendor/              随源码分发的第三方运行依赖
docs/                设计、功能审查、验证、平台和维护文档
archive/             旧版 Codex 适配归档，便于追溯
```

运行单元测试：

```powershell
npm test
```

构建公开发行包：

```powershell
python scripts/build-release.py --release-tag codex-v0.3.0-fixed.16
```

构建器会执行公开文件清单、隐私扫描、ZIP 完整性和本地链接检查。生成目录、安装暂存目录和测试输出被 `.gitignore` 排除。

## 已知限制

- Codex 没有提供可可靠归属于单轮对话的“额度百分比消耗”，因此每轮提示展示真实 token，不显示伪造的百分比差值。
- 本地工坊是离线素材管理器，不是在线市场。
- 桌面模式是独立透明浮窗，不会嵌入系统壁纸层。
- 第三方 API 模板需要相应服务提供接口并由用户自行配置；模板存在不等于服务可用。
- 旧版本已经删除的历史数据无法恢复。

## 文档

- [Codex 额度 DIY 说明](docs/CODEX-QUOTA-DIY.md)
- [DSH 原版功能逐项对照](docs/ORIGINAL-FEATURE-AUDIT.md)
- [开发摘要](docs/DEVELOPMENT_SUMMARY.md)
- [验证记录](docs/VERIFICATION-0.3.md)
- [用户验收清单](docs/USER_TEST_CHECKLIST.md)
- [显示与气泡生命周期说明](docs/SURFACE-LIFECYCLE-FIX.md)
- [来源与改编范围](PROVENANCE.md)
- [安全说明](SECURITY.md)

## 来源、贡献与许可

- 上游项目：[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，作者 [MeteorNOX](https://github.com/MeteorNOX)。
- Codex 适配历史维护者：[Yang-huai406](https://github.com/Yang-huai406)。
- macOS 兼容实现来源：[PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)，贡献者 [1llysviel](https://github.com/1llysviel)。
- 代码与文档沿用 MIT 许可，见 [LICENSE](LICENSE)。
- 原图片、动图和音频按上游分发条款随项目提供，本仓库不把这些素材重新声明为原创或扩大其许可范围。
- 第三方依赖见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
