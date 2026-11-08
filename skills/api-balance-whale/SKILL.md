---
name: api-balance-whale
description: 显示跟随 Codex 窗口的 Codex 小龙娘（小鲸鱼），查询 API 余额与已观测用量，并通过受限的本地设置命令修改常用偏好、提醒和气泡。适用于用户提到 Codex 小龙娘、小鲸鱼、挂件设置、API 余额或挂件用量；普通编码任务无需使用。
---

# Codex 小龙娘 v0.3.1

只处理 Codex 小龙娘（小鲸鱼）及 API 余额相关请求。优先使用本插件已连接的 MCP 工具；工具不可用时，可从插件根目录运行 `node scripts/control.mjs status` 检查，明确说明实际结果。

使用数据目录的现有设置。不要展示或复制 API 密钥、提供商名称、接口地址、账号、个人文件路径、原始聊天或会话日志。向用户报告通用接口状态、可观测金额及必要的错误类别。不要为了展示余额而更改 Codex 的模型或 API 配置。

## 修改个人设置

用户要求修改小龙娘的设置时，从插件根目录调用 `node scripts/agent-settings.mjs`。这是本地 IPC 命令，不是公开网页服务。现有 MCP 工具可以查余额、用量、状态和打开挂件，但不负责写设置。

操作顺序：

1. 运行 `node scripts/agent-settings.mjs catalog` 查找设置 ID、范围、选项和支持的操作。只处理返回的第一阶段支持项；排除清单中的服务商、模型和素材管理暂不支持。
2. 运行 `node scripts/agent-settings.mjs get <settingId>` 读取当前值和 `revision`。气泡序列必须指定模式：`get bubble.sequences api` 或 `get bubble.sequences subscription`。
3. 修改前先核对单位、范围、当前值和模式。大小用 1–20 档，提示停留时间用秒；API 与订阅气泡序列相互独立。
4. 预览或保存时，把 JSON 请求通过标准输入交给命令。请求须包含 `settingId`、`value` 和刚读取的 `expectedRevision`；气泡序列还须包含 `mode`，且 `value` 形如 `{ "mode": "api", "items": [...] }`。
5. 保存后再次运行 `get`，确认目标设置已更新。若返回冲突，重新读取、重新计算后再尝试；不得去掉 `expectedRevision` 或直接编辑配置文件。

例如，先读取 `size.scale`，再把读到的 `revision` 原样填入请求：

```sh
node scripts/agent-settings.mjs apply <<'JSON'
{"settingId":"size.scale","value":8,"expectedRevision":"将这里替换为 get 返回的 revision"}
JSON
```

气泡序列请求还要包含模式，例如 `"mode":"subscription"`，并让 `value.mode` 与其一致。

常用命令：

```text
node scripts/agent-settings.mjs catalog
node scripts/agent-settings.mjs get size.scale
node scripts/agent-settings.mjs preview    # 从标准输入读取 JSON，最多 48 KB
node scripts/agent-settings.mjs apply      # 从标准输入读取 JSON，最多 48 KB
node scripts/agent-settings.mjs reset ui.snap
node scripts/agent-settings.mjs reset bubble.sequences api <revision>
```

`ui.pos` 只支持读取和 `reset`（移回右下角），不接受坐标写入。选角色或音效只允许选择当前已导入的素材；本阶段不上传或删除素材。重置气泡序列必须指定 `api` 或 `subscription`。用户已明确要求修改时，完成预览、保存和回读即可，不要再要求重复确认。

本阶段不支持修改 API 服务商、接口地址、密钥环境配置、自定义模型与素材文件。密钥值不由该命令读取或保存。设置命令不可用时，不绕过它直接改数据文件；报告当前无法通过受支持入口修改，并可按用户要求打开挂件设置界面。

插件支持 Windows/macOS，采用本地 IPC，无独立网页。Windows 计划任务或 macOS LaunchAgent 启动；可切换“窗口随行”与“桌面驻留”模式。用户显式隐藏或退出挂件时应尊重其选择。

## 安装和维护

完整安装使用 `scripts/install-package.ps1`。仅检查时传 `-CheckOnly`。需要 Node.js 24+ 和支持 `plugin add` 的 Codex CLI。脚本检查默认个人市场，备份本插件和用户数据，然后安装桌面组件、插件和自动跟随。不得手动删除其他市场条目、修改系统执行策略或终止未核实的进程。

停止自动跟随使用 `scripts/uninstall-follow.ps1`。恢复本次安装使用 `scripts/rollback-package.ps1`，可先传 `-CheckOnly`。回滚必须读取本次安装生成的私有回执；没有回执时报告没有可用备份，不猜测历史备份路径。个人备份、设置和账本不加入公开插件包。

更新安装后提醒用户新建 Codex 聊天，以加载新的技能和 MCP 工具。完整步骤见插件根目录 README.md。

## 余额、失败和隐私

ChatGPT 订阅额度不是 API 余额。没有余额接口时报告不可查询。每轮观测消费不等于精确逐请求账单；并行调用、延迟扣费或估算会影响口径。保留原始精度，不因为显示两位小数删除小额消费。

失败、取消不显示独立趣味气泡；只有明确的拥挤错误造成最终失败才提示“挤不进去...”。运行中取消仍以中性文案报告消耗，沿用每轮消耗提示开关；金额未知或待记账时保留该状态和已记录的 token，不报成零，不播放成功音效。取消优先于此前的拥挤报错，不能把取消称为“挤不进去...”。汇率说明通过“刷新汇率”旁的灰色感叹号按钮点击展开。

最小化时隐藏，恢复时重新显示。另存为对话框关闭后回到 Codex 应恢复。排查时区分窗口不可见、进程退出、用户隐藏与自动跟随未启用，不把未运行的测试说成通过。

## v0.3 新增操作

使用插件现有接口和本地 IPC。鲸鱼菜单可打开“音效与手感”“额度与用量”“本地创意工坊”，托盘可切换“桌面驻留 / 窗口随行”并恢复显示。

订阅额度来自本机官方窗口快照；本机滚动 token 统计不等于官方剩余 token。非订阅登录不显示旧订阅窗口。DeepSeek 峰谷只对已识别的官方端点展示，不能把中转服务当作官方计价。

macOS兼容必须保留原PR及平台分支：https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128 。当前Windows环境的测试不能声称Mac实机通过。Windows回滚用scripts/rollback-package.ps1的本次私有回执，Mac用scripts/rollback-macos.mjs。
