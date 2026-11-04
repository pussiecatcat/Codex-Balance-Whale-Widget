# 大肥鱼配置定位索引与 Agent 修改约定

状态：**方案阶段的源码定位索引，尚不是已经验收的完整配置操作手册。** 日期：2026-10-03。

本轮已核对下面的主要配置来源。后续实施任务 T01／T06 必须补齐每个动态子字段、运行中修改入口、热更新和实际验证案例，才满足“Agent 可直接修改所有可配置项”。不要把计划中的命令当成已经存在的功能。

## 1. 先确定要改什么

| 用户的要求 | 修改对象 | 不应误改 |
| --- | --- | --- |
| “把我的鲸鱼调小一点” | 当前用户的 `scale` | 代码里的全体新用户默认值 |
| “以后默认不要点击出声” | 新用户默认值及说明 | 已有用户明确保存的偏好 |
| “这句话看不懂” | 界面标签／帮助内容 | 底层配置键、数据内容 |
| “完成提示多停留几秒” | `turnCostCloseMs` | 点击查看订阅额度时的气泡序列 |
| “这个模型价格改成……” | 指定模型的价格 | 整个模型列表或其他服务商 |

修改运行中配置应通过已支持的服务入口，回读并验证挂件实际更新。现在部分设置依赖渲染器本地状态，单独写文件或调用保存接口不一定立即刷新挂件；任务 T03 负责补全统一更新机制。

## 0. 逐字段目录（自动生成）

<!-- BEGIN GENERATED: settings-catalog -->

> 本节由 `node scripts/generate-config-doc.mjs` 从 `desktop/ui/settings-catalog.js` 生成，
> 不要手工编辑。改了目录请重新运行生成器，CI 用 `--check` 校验是否过期。

当前共 54 个条目，其中一级快捷菜单直接展示 7 个，需要画布、只能回到挂件里细调的有 6 个。

## 索引

| 配置 ID | 名称 | 分类 | 层级 | 存储域 | 存储键 |
| --- | --- | --- | --- | --- | --- |
| `size.scale` | 大小 | 外观与显示 | 一级 | size | `scale` |
| `size.sound` | 点击音效 | 声音与提醒 | 一级 | size | `sound` |
| `size.vol` | 点击音量 | 声音与提醒 | 二级 | size | `vol` |
| `size.soundSet` | 音效组 | 声音与提醒 | 二级 | size | `soundSet` |
| `size.usageMode` | 用量来源（旧字段） | 外观与显示 | 二级 | size | `usageMode` |
| `size.bubbleOn` | 显示气泡 | 气泡内容 | 一级 | size | `bubbleOn` |
| `size.turnCostOn` | 任务结束后显示用量 | 声音与提醒 | 一级 | size | `turnCostOn` |
| `size.turnCostCloseMs` | 任务用量提示显示多久 | 声音与提醒 | 二级 | size | `turnCostCloseMs` |
| `size.scrollGapOn` | 避开右侧滚动条 | 位置与交互 | 二级 | size | `scrollGapOn` |
| `size.scrollGapPx` | 避让距离 | 位置与交互 | 二级 | size | `scrollGapPx` |
| `size.menuBtnHide` | 隐藏菜单按钮 | 位置与交互 | 二级 | size | `menuBtnHide` |
| `ui.accountView` | 查看数据 | 外观与显示 | 一级 | displayMode | `mode` |
| `ui.role` | 角色 | 外观与显示 | 一级 | ui | `dshw-role` |
| `ui.displayCurrency` | 显示币种 | 外观与显示 | 二级 | ui | `dshw-display-currency` |
| `ui.bubbleShape` | 气泡形状 | 气泡内容 | 二级 | ui | `dshw-bubble-shape` |
| `ui.feel` | 按压手感 | 声音与提醒 | 二级 | ui | `dshw-v3-feedback.feel` |
| `ui.feedbackEvent` | 各事件音色与独立音量 | 声音与提醒 | 二级 | ui | `dshw-v3-feedback.events.<event>` |
| `ui.pos` | 挂件位置 | 位置与交互 | 二级 | ui | `dshw-pos` |
| `ui.snap` | 自动贴边与翻转 | 位置与交互 | 二级 | ui | `dshw-snap` |
| `usage.taskEndOn` | 完成提醒 | 声音与提醒 | 一级 | usage | `taskEnd.on / turnCostOn` |
| `usage.taskEndSel` | 完成提示音 | 声音与提醒 | 二级 | usage | `taskEnd.sel` |
| `usage.taskEndVol` | 完成提示音量 | 声音与提醒 | 二级 | usage | `taskEnd.vol / taskEnd.volSet` |
| `usage.alertOn` | 余额预警 | API 与用量 | 二级 | usage | `alert.on` |
| `usage.alertBelow` | 余额预警阈值 | API 与用量 | 二级 | usage | `alert.below` |
| `usage.budgetOn` | 每日预算提醒 | API 与用量 | 二级 | usage | `budget.on` |
| `usage.budgetAmount` | 每日预算阈值 | API 与用量 | 二级 | usage | `budget.amount` |
| `usage.alertMsg` | 提醒文字 | API 与用量 | 二级 | usage | `alert.msg / budget.msg` |
| `usage.alertAutoClose` | 预警自动关闭 | API 与用量 | 二级 | usage | `alert.autoClose / budget.autoClose` |
| `usage.alertTtlSec` | 预警停留秒数 | API 与用量 | 二级 | usage | `alert.ttlSec / budget.ttlSec` |
| `usage.reminderModules` | 提醒气泡内容与样式 | API 与用量 | 二级 | usage | `<domain>.lines` |
| `api.provider` | 余额接口 | API 与用量 | 二级 | api | `provider` |
| `api.baseUrl` | API 地址 | API 与用量 | 二级 | api | `baseUrl` |
| `api.keyEnv` | 密钥环境变量名 | API 与用量 | 二级 | api | `keyEnv` |
| `api.profile` | Codex 配置方案 | API 与用量 | 二级 | api | `profile` |
| `api.projectDir` | 项目目录 | API 与用量 | 二级 | api | `projectDir` |
| `api.currency` | 自定义金额币种 | API 与用量 | 二级 | api | `currency` |
| `api.balancePath` | 余额路径 | API 与用量 | 二级 | api | `balancePath` |
| `api.balanceField` | 余额字段 | API 与用量 | 二级 | api | `balanceField` |
| `api.usedField` | 累计消耗字段 | API 与用量 | 二级 | api | `usedField` |
| `api.balanceScale` | 金额换算系数 | API 与用量 | 二级 | api | `balanceScale` |
| `api.billingUsageDivisor` | 账单用量除数 | API 与用量 | 二级 | api | `billingUsageDivisor` |
| `api.quotaPerUnit` | 每货币单位的 quota | API 与用量 | 二级 | api | `quotaPerUnit` |
| `api.dashboardUrl` | 账单页面地址 | API 与用量 | 二级 | api | `dashboardUrl` |
| `api.monitorSessions` | 记录本机 token 与任务状态 | API 与用量 | 二级 | api | `monitorSessions` |
| `api.refreshSeconds` | 余额刷新间隔 | API 与用量 | 二级 | api | `refreshSeconds` |
| `api.models` | 主接口每轮费用估算价格 | API 与用量 | 二级 | api | `models.<model>` |
| `api.customModels` | 独立 API 模型 | API 与用量 | 二级 | apiModels | `models[<id>].<field>` |
| `api.manualQuota` | 手动额度 | API 与用量 | 二级 | apiModels | `manualQuota` |
| `bubble.sequences` | 气泡点击序列 | 气泡内容 | 二级 | bubble | `items / subscriptionItems` |
| `bubble.lib` | 气泡模块库 | 气泡内容 | 二级 | bubble | `lib` |
| `media.roles` | 角色素材 | 素材管理 | 二级 | media | `roles[<id>]` |
| `media.audio` | 音效素材 | 素材管理 | 二级 | media | `groups / fragments` |
| `media.bubbleImgs` | 气泡图片 | 素材管理 | 二级 | media | `bubbleImgs[<id>]` |
| `media.workshop` | 素材包导入导出 | 素材管理 | 二级 | media | `—` |

## 逐字段契约

### 外观与显示（`appearance`）

角色、大小、桌面显示方式与数据显示来源。

#### `size.scale` — 大小

- **用途**：调整鲸鱼在桌面上的整体大小。
- **类型**：range，单位 倍，范围 0.6 – 2.5，步长 0.1
- **默认值**：1.5（来源 `runtime/size-settings.mjs:6`）
- **存储**：`.dshw-size.json` 的 `scale`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：最小 0.6
- **生效**：立即生效

**`.help`**

- 有什么用：缩放角色图片本身，不改变气泡、菜单和文字的清晰度策略。
- 怎么调：0.6 到 2.5，步长 0.1。滑块只显示「小—大」，精确值在完整设置里输入。旧菜单的 1–20 刻度只是显示映射，底层存的是倍数。
- 什么时候生效：拖动即时生效并立即保存。
- 适合怎么选：笔记本和外接屏混用时，1080p 屏建议 1.2–1.4，4K 屏建议 1.6–1.8。

#### `size.usageMode` — 用量来源（旧字段）

- **用途**：历史遗留字段，当前实现已固定。
- **类型**：locked
- **默认值**：ledger（来源 `runtime/size-settings.mjs:10`）
- **存储**：`.dshw-size.json` 的 `usageMode`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：写入时归一为 ledger
- **生效**：需要重载后生效

**`.help`**

- 有什么用：早期用来切换用量统计口径的字段。
- 怎么调：不可修改。读和写都会归一为 ledger，界面上只读展示。
- 什么时候生效：不适用。
- 适合怎么选：不用管。显示数据来源请改「数据显示」那一项。

#### `ui.accountView` — 查看数据

- **用途**：决定鲸鱼点开后显示订阅额度还是 API 余额。
- **类型**：select，选项 Codex 额度 / API 余额
- **默认值**：subscription（来源 `runtime/composition.mjs:50`）
- **存储**：`display-mode.json` 的 `mode`
- **读取**：`GET /api/display-mode`
- **修改**：`POST /api/display-mode`
- **空值**：非法值按 subscription 处理
- **生效**：立即生效

**`.help`**

- 有什么用：这是显示来源的切换，不改变你的账号登录状态，也不改变 API 配置。
- 怎么调：二选一。选 Codex 额度看 5 小时与周额度；选 API 余额看你配置的接口余额。
- 什么时候生效：立即生效。
- 适合怎么选：用订阅账号就选 Codex 额度；用 API key 计费就选 API 余额。

#### `ui.role` — 角色

- **用途**：选择鲸鱼当前使用的形象。
- **类型**：role
- **默认值**：默认角色（来源 `assets/whale-widget.js:147`）
- **存储**：`ui-state.json` 的 `dshw-role`
- **读取**：`GET /dsh-whale/roles.json`
- **修改**：`POST /dsh-whale/role-pin.json + ui-state.json`
- **空值**：留空按角色库默认处理
- **生效**：立即生效

**`.help`**

- 有什么用：只切换显示哪一张角色图，不影响任何额度或用量统计。
- 怎么调：点缩略图选择；导入按钮在选择器尾部，用来添加自己的图片。支持 PNG / GIF / APNG。
- 什么时候生效：立即生效并立即保存。
- 适合怎么选：先按默认角色用；需要换形象时再导入并选择。

#### `ui.displayCurrency` — 显示币种

- **用途**：决定界面上的金额用美元还是人民币显示。
- **类型**：select，选项 美元 USD / 人民币 CNY
- **默认值**：USD（来源 `desktop/ui/money.js:13`）
- **存储**：`ui-state.json` 的 `dshw-display-currency`
- **读取**：`本地偏好 + GET /api/fx/usd-cny`
- **修改**：`localStorage → whale-save-storage`
- **空值**：非法值按 USD 处理
- **生效**：立即生效

**`.help`**

- 有什么用：只改显示，不改账本。换算用的是参考汇率，账目本身保持原币种。
- 怎么调：二选一。选人民币时会用缓存的美元兑人民币汇率。
- 什么时候生效：立即生效。
- 适合怎么选：按你习惯的币种看；核对账单时切回原币种。

### 声音与提醒（`sound`）

什么时候出声、显示什么提醒。

#### `size.sound` — 点击音效

- **用途**：控制按下和松开鲸鱼时是否发声。
- **类型**：boolean
- **默认值**：true（来源 `runtime/size-settings.mjs:7`）
- **存储**：`.dshw-size.json` 的 `sound`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：缺省按 true 处理
- **生效**：立即生效

**`.help`**

- 有什么用：只管点击鲸鱼本身的手感音，不管任务完成、余额预警的提示音。
- 怎么调：开关。关掉后各事件仍有自己的音色和音量设置，只是按下与松开不发声。
- 什么时候生效：立即生效。
- 适合怎么选：在会议室或共享空间关掉；其余情况保留，它也是「鲸鱼在响应」的反馈。

#### `size.vol` — 点击音量

- **用途**：按下与松开音量的总音量。
- **类型**：range，单位 百分比，范围 0 – 1，步长 0.01
- **默认值**：0.9（来源 `runtime/size-settings.mjs:8`）
- **存储**：`.dshw-size.json` 的 `vol`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.sound`
- **空值**：缺省按 0.9 处理
- **生效**：立即生效

**`.help`**

- 有什么用：总音量。它会乘到每个事件自己的独立音量上，不是二选一。
- 怎么调：0 到 1，步长 0.01。实际响度 = 本项 × 对应事件的独立音量 × 事件是否静音。
- 什么时候生效：立即生效。
- 适合怎么选：先用 0.9；要单独调某个事件时只改那一个事件，不要动这里。
- 例子：点击音量 0.9、按下独立音量 0.8，按下实际输出 0.72。

#### `size.soundSet` — 音效组

- **用途**：选择按下与松开使用的音色素材组。
- **类型**：select，选项 小黄鸭（内置） / 音效1（内置）
- **默认值**：duck（来源 `runtime/size-settings.mjs:9`）
- **存储**：`.dshw-size.json` 的 `soundSet`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.sound`
- **空值**：留空按 duck 处理
- **生效**：立即生效

**`.help`**

- 有什么用：决定「现有音效」这一档具体放什么声音。
- 怎么调：下拉列出全部内置音效组和你导入的音效组。切换后立刻用当前音量试听。
- 什么时候生效：立即生效。
- 适合怎么选：先用内置组；导入自定义组后在素材管理里试听再选。

#### `size.turnCostOn` — 任务结束后显示用量

- **用途**：一轮任务结束后弹出本轮用量气泡。
- **类型**：boolean
- **默认值**：true（来源 `runtime/size-settings.mjs:12`）
- **存储**：`.dshw-size.json` 的 `turnCostOn`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.bubbleOn`
- **空值**：缺省按 true 处理
- **生效**：立即生效

**`.help`**

- 有什么用：订阅模式显示本轮 token，API 模式显示本轮观测到的消耗。
- 怎么调：开关。依赖「显示气泡」开着才有意义。
- 什么时候生效：立即生效。
- 适合怎么选：长任务密集时打开，跑批时关掉。

#### `size.turnCostCloseMs` — 任务用量提示显示多久

- **用途**：控制任务结束用量气泡的停留时间。
- **类型**：number，单位 秒，范围 0 – 3600，步长 1
- **默认值**：5（来源 `runtime/size-settings.mjs:13`）
- **存储**：`.dshw-size.json` 的 `turnCostCloseMs`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.turnCostOn`
- **空值**：缺省按 5000 毫秒处理
- **生效**：立即生效

**`.help`**

- 有什么用：用量气泡自动消失前的停留时间。
- 怎么调：0 到 3600 秒，0 表示不自动关闭、由你手动关掉。存储单位是毫秒。
- 什么时候生效：立即生效。
- 适合怎么选：先用 5 秒；数字多到来不及看就调到 10 秒以上，或者选 0 手动关。
- 例子：填 8 秒，底层保存 8000。

#### `ui.feel` — 按压手感

- **用途**：调整按下与松开的动画节奏。
- **类型**：select，选项 均衡 / 清脆 / 柔和
- **默认值**：balanced（来源 `desktop/ui/preferences-v3.js:4`）
- **存储**：`ui-state.json` 的 `dshw-v3-feedback.feel`
- **读取**：`localStorage 读取`
- **修改**：`localStorage → whale-save-storage`
- **空值**：留空按 balanced 处理
- **生效**：立即生效

**`.help`**

- 有什么用：只影响鲸鱼被按下时的回弹速度，不改变音量。
- 怎么调：三档：均衡约 75/140 毫秒、清脆约 65/125 毫秒、柔和约 85/155 毫秒（按下 / 松开）。
- 什么时候生效：立即生效。
- 适合怎么选：默认用均衡；觉得反应慢换清脆，觉得太生硬换柔和。

#### `ui.feedbackEvent` — 各事件音色与独立音量

- **用途**：分别设置按下、松开、完成、取消、拥挤失败的声音。
- **类型**：group
- **默认值**：按下/松开/完成为「现有音效」；取消与拥挤失败为「静音」；各事件独立音量 0.8（来源 `desktop/ui/preferences-v3.js:4`）
- **存储**：`ui-state.json` 的 `dshw-v3-feedback.events.<event>`
- **读取**：`localStorage 读取`
- **修改**：`localStorage → whale-save-storage`
- **依赖**：`size.vol`
- **空值**：缺事件按默认补
- **生效**：立即生效
  - 子字段 `press` — 按下（可选「现有音效」）
  - 子字段 `release` — 松开（可选「现有音效」）
  - 子字段 `success` — 完成提示（可选「现有音效」）
  - 子字段 `cancelled` — 取消提示
  - 子字段 `failed` — 拥挤失败提示

**`.help`**

- 有什么用：让不同事件用不同声音，提示「完成」和「拥挤失败」听得出来。
- 怎么调：每个事件两行：音色可选「现有音效」（仅按下/松开/完成）或珍珠、水泡、风铃、静音；独立音量 0 到 1。
- 什么时候生效：立即生效。
- 适合怎么选：按下与松开用「现有音效」+ 0.8；完成提示用风铃；拥挤失败保持静音或用水泡。
- 例子：按下独立音量 0.8、点击音量 0.9 → 实际输出 0.72；选了静音则强制为 0。

#### `usage.taskEndOn` — 完成提醒

- **用途**：任务结束后用气泡、声音或两者一起提醒。
- **类型**：combo
- **默认值**：气泡和声音（来源 `runtime/ledger.mjs:157`）
- **存储**：`usage-settings.json + .dshw-size.json` 的 `taskEnd.on / turnCostOn`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.bubbleOn`
- **空值**：缺省气泡开、声音关
- **生效**：立即生效
- **组合字段**：由 `size.turnCostOn` + `usage.taskEnd.on` 共同决定

**`.help`**

- 有什么用：决定一轮任务跑完后你会被怎么通知。这是常用组合，一个下拉就够了。
- 怎么调：三选一：关闭（都不提示）、仅气泡（只显示用量）、气泡和声音（都开）。
- 什么时候生效：立即生效。
- 适合怎么选：专注写代码时选「气泡和声音」；跑长批处理时选「关闭」。

#### `usage.taskEndSel` — 完成提示音

- **用途**：选择任务结束时播放的声音。
- **类型**：select，选项 小黄鸭·按下 / 小黄鸭·松开 / 音效1·按下 / 音效1·松开
- **默认值**：preset:duck:press（来源 `runtime/ledger.mjs:157`）
- **存储**：`usage-settings.json` 的 `taskEnd.sel`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`usage.taskEndOn`
- **空值**：空表示使用声音编辑器的回退选项
- **生效**：立即生效

**`.help`**

- 有什么用：决定「完成了」这一声长什么样。
- 怎么调：下拉会列出全部音效组（点按）、内置预设和你导入的音频片段。值分三类：grp:音效组、preset:内置、frag:自定义片段。
- 什么时候生效：立即生效。
- 适合怎么选：和按下音区分开，选一个音色差异大的，比如风铃。

#### `usage.taskEndVol` — 完成提示音量

- **用途**：单独调节任务完成音的响度。
- **类型**：range，单位 百分比，范围 0 – 1，步长 0.01
- **默认值**：跟随点击音量（来源 `runtime/ledger.mjs:157`）
- **存储**：`usage-settings.json` 的 `taskEnd.vol / taskEnd.volSet`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`usage.taskEndOn`、`size.vol`
- **空值**：volSet 为 false 时跟随点击音量
- **生效**：立即生效

**`.help`**

- 有什么用：完成提示通常应该比点击音更轻或更重，这个开关就是单独调它。
- 怎么调：拖动即设为独立音量；打开独立后不再跟随点击音量。实际输出 = 完成音量 × 0（静音时）。
- 什么时候生效：立即生效。
- 适合怎么选：先保持跟随；觉得完成提示太吵再单独调到 0.5 左右。

### 气泡内容（`bubble`）

气泡开关、形状、点击序列与模块。

#### `size.bubbleOn` — 显示气泡

- **用途**：控制鲸鱼说话时是否弹出气泡。
- **类型**：boolean
- **默认值**：true（来源 `runtime/size-settings.mjs:11`）
- **存储**：`.dshw-size.json` 的 `bubbleOn`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：缺省按 true 处理
- **生效**：立即生效

**`.help`**

- 有什么用：关掉后余额、任务完成、余额预警这些气泡都不再出现，点击鲸鱼也不会弹。
- 怎么调：开关。关闭不会改动你已经编辑好的气泡内容，重新打开即可恢复显示。
- 什么时候生效：立即生效。
- 适合怎么选：只想少打扰但仍要看关键数字时，用「完成提醒」选「仅气泡」比直接关掉更合适。

#### `ui.bubbleShape` — 气泡形状

- **用途**：切换鲸鱼说话时气泡的外形。
- **类型**：select，选项 椭圆 / 圆角方形
- **默认值**：ellipse（来源 `assets/whale-widget.js:3654`）
- **存储**：`ui-state.json` 的 `dshw-bubble-shape`
- **读取**：`localStorage 读取`
- **修改**：`localStorage → whale-save-storage`
- **空值**：留空按 ellipse 处理
- **生效**：立即生效

**`.help`**

- 有什么用：两种形状外框一样大，区别在于内部能放下多少内容。
- 怎么调：二选一。椭圆更圆润；圆角方形内接矩形更大，气泡内容多时不会溢出到外面。
- 什么时候生效：立即生效。
- 适合怎么选：气泡里有两个以上额度卡片或长文本时选圆角方形。

#### `bubble.sequences` — 气泡点击序列

- **用途**：点击鲸鱼时依次弹出哪些气泡。
- **类型**：
- **默认值**：由内置默认序列决定（来源 `assets/whale-widget.js:1362`）
- **存储**：`.dshw-bubble.json` 的 `items / subscriptionItems`
- **读取**：`GET /dsh-whale/bubble.json`
- **修改**：`POST /dsh-whale/bubble.json`
- **依赖**：`size.bubbleOn`
- **空值**：空数组表示清空该模式序列
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」
  - 子字段 `items` — API 模式序列
  - 子字段 `subscriptionItems` — 订阅模式序列
  - 子字段 `tapAdvance` — API 模式点击切换
  - 子字段 `subscriptionTapAdvance` — 订阅模式点击切换

**`.help`**

- 有什么用：两种模式各有一套序列，切换模式不会互相覆盖。
- 怎么调：在挂件的「自定义泡泡」编辑器里调整，序列是一串气泡模块。
- 什么时候生效：保存后用于下一次点击。
- 适合怎么选：把常用的放前面：余额、额度、状态。

#### `bubble.lib` — 气泡模块库

- **用途**：可以复用的气泡内容片段。
- **类型**：
- **默认值**：空（来源 `assets/whale-widget.js:5517`）
- **存储**：`.dshw-bubble.json` 的 `lib`
- **读取**：`GET /dsh-whale/bubble.json`
- **修改**：`POST /dsh-whale/bubble.json`
- **依赖**：`bubble.sequences`
- **空值**：空数组表示清空模块库
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」
  - 子字段 `type` — 模块类型
  - 子字段 `layout` — 布局
  - 子字段 `color` — 颜色
  - 子字段 `size` — 字号
  - 子字段 `weight` — 随机权重
  - 子字段 `modelId` — 绑定模型

**`.help`**

- 有什么用：把常用的一段气泡内容存起来，之后一键插入，不用每次重打。
- 怎么调：模块类型有文字、图片、链接、随机、额度等，各自有布局、颜色、字号、随机权重和模型绑定等子项。
- 什么时候生效：保存后用于下一次编辑序列。
- 适合怎么选：先把序列调顺，再把稳定的片段存进模块库。

### 位置与交互（`position`）

贴边、翻转、避让与菜单按钮。

#### `size.scrollGapOn` — 避开右侧滚动条

- **用途**：让挂件右侧留出空隙，减少遮挡滚动条。
- **类型**：boolean
- **默认值**：false（来源 `runtime/size-settings.mjs:14`）
- **存储**：`.dshw-size.json` 的 `scrollGapOn`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：缺省按 false 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：把挂件整体左移一点，避免压住 Codex 窗口右边的滚动条。
- 怎么调：开关。开启后用下面的距离决定留多少。
- 什么时候生效：保存后重新摆放挂件位置。
- 适合怎么选：鲸鱼停在屏幕右侧、且你会滚 Codex 右侧内容时打开。

#### `size.scrollGapPx` — 避让距离

- **用途**：避开右侧滚动条时留出的宽度。
- **类型**：number，单位 像素，范围 0 – 200，步长 1
- **默认值**：17（来源 `runtime/size-settings.mjs:15`）
- **存储**：`.dshw-size.json` 的 `scrollGapPx`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.scrollGapOn`
- **空值**：0 表示不留距离
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：距离越大，鲸鱼离屏幕右边缘越远。
- 怎么调：单位像素，0 表示不留距离。17 是当前实现的回退值，适合先试这个。
- 什么时候生效：保存后重新摆放挂件；关闭开关时已填的距离会保留，再次启用即可恢复。
- 适合怎么选：先用 17。滚动条被挡住时再加到 24–32。

#### `size.menuBtnHide` — 隐藏菜单按钮

- **用途**：收起鲸鱼身上那个 ☰ 按钮。
- **类型**：boolean
- **默认值**：false（来源 `runtime/size-settings.mjs:16`）
- **存储**：`.dshw-size.json` 的 `menuBtnHide`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：缺省按 false 处理
- **生效**：立即生效

**`.help`**

- 有什么用：让鲸鱼只显示角色本身，不显示左上角的菜单按钮。
- 怎么调：开关。隐藏后仍可通过右键鲸鱼打开菜单，菜单不会失联。
- 什么时候生效：立即生效。
- 适合怎么选：觉得按钮碍眼时打开。

#### `ui.pos` — 挂件位置

- **用途**：记录鲸鱼停靠在桌面的哪个位置。
- **类型**：position
- **默认值**：右下角（来源 `assets/whale-widget.js:4454`）
- **存储**：`ui-state.json` 的 `dshw-pos`
- **读取**：`localStorage 读取`
- **修改**：`localStorage → whale-save-storage`
- **依赖**：`ui.snap`
- **空值**：留空按右下角处理
- **生效**：立即生效

**`.help`**

- 有什么用：拖动鲸鱼时会自动记住位置，这里只用来查看和复位。
- 怎么调：直接拖动即可，或点「移回右下角」复位。
- 什么时候生效：拖动结束立即保存。
- 适合怎么选：不需要手动设置，拖到你顺手的位置就行。

#### `ui.snap` — 自动贴边与翻转

- **用途**：控制鲸鱼靠近屏幕边缘时的吸附范围和朝向翻转。
- **类型**：snap
- **默认值**：比例模式：左右 10%、下 15%、上 0%；翻转线 50%（来源 `assets/whale-widget.js:3763`）
- **存储**：`ui-state.json` 的 `dshw-snap`
- **读取**：`localStorage 读取`
- **修改**：`localStorage → whale-save-storage`
- **依赖**：`ui.pos`
- **空值**：留空按默认比例处理
- **生效**：立即生效

**`.help`**

- 有什么用：拖到靠近边缘时自动吸附摆正，走到屏幕另一半时自动翻转朝向。
- 怎么调：三档模式：按比例、按像素、关闭。比例模式下左右各 10%、下 15%、上 0%；像素模式下左右各 80 像素、四边翻转线为 -1（即默认不翻转）。翻转线 F 表示走到屏幕宽度的百分之几时翻面。
- 什么时候生效：立即生效。
- 适合怎么选：多显示器或经常拖到边角时用比例模式；希望完全手动控制就关闭。
- 例子：比例模式下把左边吸附设为 20，鲸鱼在屏幕左侧 20% 范围内会贴左边。

### 素材管理（`media`）

角色图片、气泡图片与音效素材。

#### `media.roles` — 角色素材

- **用途**：鲸鱼形象图片库。
- **类型**：
- **默认值**：内置角色（来源 `lib/widget-host.mjs:193`）
- **存储**：`whale-roles/roles.json` 的 `roles[<id>]`
- **读取**：`GET /dsh-whale/roles.json`
- **修改**：`POST /dsh-whale/role-pin.json / role-delete.json`
- **依赖**：`ui.role`
- **空值**：删除素材需要用户明确确认
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」
  - 子字段 `id` — 素材 ID
  - 子字段 `format` — 格式
  - 子字段 `name` — 名称
  - 子字段 `pinned` — 置顶
  - 子字段 `order` — 排序

**`.help`**

- 有什么用：存放你导入的角色图片。支持 PNG / GIF / APNG，导入时可以裁切和翻转。
- 怎么调：导入、置顶、排序、删除。删除会二次确认。
- 什么时候生效：导入后需要选中才生效，导入不等于已选择。
- 适合怎么选：单张不超过 20 MB，最多 256 个素材，总占用 256 MB 以内。

#### `media.audio` — 音效素材

- **用途**：音效组和音频片段库。
- **类型**：
- **默认值**：内置 duck / fx1（来源 `lib/widget-host.mjs:34`）
- **存储**：`whale-audio/audio.json` 的 `groups / fragments`
- **读取**：`GET /dsh-whale/audio.json`
- **修改**：`POST /dsh-whale/audio.json`
- **依赖**：`size.soundSet`
- **空值**：删除素材需要用户明确确认
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」
  - 子字段 `groups` — 音效组
  - 子字段 `press` — 按下引用
  - 子字段 `release` — 松开引用
  - 子字段 `fragments` — 音频片段

**`.help`**

- 有什么用：一个音效组包含按下和松开两段声音，可以整体切换。
- 怎么调：可以上传音频片段并裁切，再组装成音效组。内置素材不能删也不能改。
- 什么时候生效：保存后用于下一次播放。
- 适合怎么选：先在音效组编辑器里试听，满意再设为主音效组。

#### `media.bubbleImgs` — 气泡图片

- **用途**：气泡里可以引用的图片库。
- **类型**：
- **默认值**：内置图片（来源 `lib/widget-host.mjs:52`）
- **存储**：`whale-bubble-imgs/bubble-imgs.json` 的 `bubbleImgs[<id>]`
- **读取**：`GET /dsh-whale/bubble-imgs.json`
- **修改**：`POST /dsh-whale/bubble-img-upload.json`
- **依赖**：`bubble.lib`
- **空值**：删除素材需要用户明确确认
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」
  - 子字段 `id` — 图片 ID
  - 子字段 `name` — 名称
  - 子字段 `pinned` — 置顶

**`.help`**

- 有什么用：给气泡的图片模块提供素材。
- 怎么调：上传、置顶、删除。单张不超过 8 MB，最多 256 个。
- 什么时候生效：保存后用于下一次渲染。
- 适合怎么选：图片会按模块里的缩放设置显示，别用超大图。

#### `media.workshop` — 素材包导入导出

- **用途**：把角色、图片、音频打包带走或迁移。
- **类型**：action
- **默认值**：—（来源 `lib/workshop.mjs:28`）
- **存储**：`（即时操作，不落配置）` 的 `—`
- **读取**：`GET /api/workshop/export`
- **修改**：`POST /api/workshop/import`
- **空值**：—
- **生效**：保存后用于下一次
- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」

**`.help`**

- 有什么用：导出一个 JSON 包，含角色、气泡图片、音频片段和音效组四类。
- 怎么调：即时操作，不属于配置。包格式标识 api-balance-whale-workshop，当前版本 1，单包不超过 24 MB。
- 什么时候生效：导入是即时的，取消不会产生误保存。
- 适合怎么选：导入包不等于已经选中其中的角色，导入后还要去角色页选一次。

### API 与用量（`api`）

接口状态、币种、预警、预算与每轮费用。

#### `usage.alertOn` — 余额预警

- **用途**：API 余额低于阈值时提醒。
- **类型**：boolean
- **默认值**：true（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `alert.on`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`ui.accountView`、`size.bubbleOn`
- **空值**：缺省按 true 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：余额快用完时先提醒，避免扣费中断。
- 怎么调：开关。阈值单独设置，金额按 API 币种计算。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：按 API key 计费时务必打开。

#### `usage.alertBelow` — 余额预警阈值

- **用途**：余额低于多少时触发预警。
- **类型**：number，单位 与 API 同币种，范围 0 – 不限，步长 0.01
- **默认值**：5（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `alert.below`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`usage.alertOn`
- **空值**：0 表示不预警
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：余额掉到这个数以下就提醒你充值。
- 怎么调：非负数。填 0 等于关闭这条提醒。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：按你一次充值的量估一个月消耗的十分之一作为阈值。

#### `usage.budgetOn` — 每日预算提醒

- **用途**：当天观测到的用量超过预算时提醒。
- **类型**：boolean
- **默认值**：true（来源 `runtime/ledger.mjs:182`）
- **存储**：`usage-settings.json` 的 `budget.on`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`ui.accountView`、`size.bubbleOn`
- **空值**：缺省按 true 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：防止某天跑飞了花超。
- 怎么调：开关。这只是提醒，不会拦截任何调用，也不是硬限额。
- 什么时候生效：保存后用于下一次用量观测。
- 适合怎么选：用 API key 且偶尔跑大任务时打开。

#### `usage.budgetAmount` — 每日预算阈值

- **用途**：当天用量超过多少时提醒。
- **类型**：number，单位 与 API 同币种，范围 0 – 不限，步长 0.01
- **默认值**：10（来源 `runtime/ledger.mjs:182`）
- **存储**：`usage-settings.json` 的 `budget.amount`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`usage.budgetOn`
- **空值**：0 表示不提醒
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：一天花到这个数就提醒你收一收。
- 怎么调：非负数。金额按 API 币种，和余额预警用的是同一个币种。
- 什么时候生效：保存后用于下一次用量观测。
- 适合怎么选：先设成你日均预算的 1.5 倍作为预警线。

#### `usage.alertMsg` — 提醒文字

- **用途**：自定义预警与预算提醒的文案。
- **类型**：message
- **默认值**：余额已低于 {currency}{below} / 今日已观测用量达到 {currency}{amount}（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `alert.msg / budget.msg`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **空值**：留空按默认文案
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：改你在提醒里看到的句子。
- 怎么调：纯文本。变量：{currency} 币种符号、{below} 余额阈值、{amount} 预算阈值。
- 什么时候生效：保存后用于下一次提醒。
- 适合怎么选：保留 {currency} 和阈值变量，只改固定文字。
- 例子：余额快没了：{currency}{below}，赶紧续费

#### `usage.alertAutoClose` — 预警自动关闭

- **用途**：控制余额预警和预算提醒是否自动消失。
- **类型**：boolean
- **默认值**：false（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `alert.autoClose / budget.autoClose`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.bubbleOn`
- **空值**：缺省按 false 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：预警气泡不自动关的话会一直挂在桌面上，直到你手动关掉。
- 怎么调：开关，两种提醒共用一个设置。
- 什么时候生效：保存后用于下一次提醒。
- 适合怎么选：开启，余额预警是最容易被忽略的信息。

#### `usage.alertTtlSec` — 预警停留秒数

- **用途**：预警气泡自动关闭前的停留时间。
- **类型**：number，单位 秒，范围 0 – 3600，步长 1
- **默认值**：6（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `alert.ttlSec / budget.ttlSec`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`usage.alertAutoClose`
- **空值**：0 表示不自动关闭
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：决定预警挂多久。
- 怎么调：0 到 3600 秒。只有在「预警自动关闭」打开时才起作用。注意它的单位是秒，和「任务用量提示显示多久」一样，但两者互不影响。
- 什么时候生效：保存后用于下一次提醒。
- 适合怎么选：6 秒偏短，建议 8–10 秒。

#### `usage.reminderModules` — 提醒气泡内容与样式

- **用途**：自定义任务用量、余额预警、预算提醒三类气泡的模块。
- **类型**：group
- **默认值**：任务用量 3 行、余额预警 4 行、预算提醒 2 行（来源 `runtime/ledger.mjs:176`）
- **存储**：`usage-settings.json` 的 `<domain>.lines`
- **读取**：`GET /api/sound-settings`
- **修改**：`POST /api/sound-settings`
- **依赖**：`size.bubbleOn`
- **空值**：提交空数组表示清空该组
- **生效**：保存后用于下一次
  - 子字段 `turnCost.lines` — 任务用量提示
  - 子字段 `alert.lines` — 余额预警
  - 子字段 `budget.lines` — 每日预算提醒

**`.help`**

- 有什么用：改提醒气泡里显示哪些内容、按什么样式排。
- 怎么调：每一行是一个模块，类型有文字、图片、链接。文字支持变量 {turn_title}、{turn_primary}、{turn_detail}、{currency}、{below}、{amount}。数组是整体替换的：提交新的行会覆盖该组原有的全部行。
- 什么时候生效：保存后用于下一次该类提醒。
- 适合怎么选：先只调颜色和字号，别动行数；行数变了容易放不下。
- 例子：把任务用量第一行改成 {turn_title} 之外的内容，其余两行保持不动。

#### `api.provider` — 余额接口

- **用途**：选择用哪种方式读取 API 余额。
- **类型**：select，选项 自动识别当前 API（推荐） / 兼容账单接口 / 兼容密钥额度接口 / 自定义 JSON 余额接口 / 原生余额接口
- **默认值**：auto（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `provider`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`ui.accountView`
- **空值**：留空按 auto 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：决定去哪里读余额。自动识别会沿用你 Codex 当前的配置。
- 怎么调：五选一。只有当你的服务商不在自动识别的范围内时才需要手动选。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：保持「自动识别」。

#### `api.baseUrl` — API 地址

- **用途**：指定余额接口的根地址。
- **类型**：url
- **默认值**：留空表示沿用 Codex 当前配置（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `baseUrl`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **空值**：留空表示跟随 Codex
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：换了服务商或自建中转时，指定去哪里读余额。
- 怎么调：完整地址，必须是 https（本机 127.0.0.1 和局域网地址可以用 http）。不能带密钥、查询参数或片段。
- 什么时候生效：保存后按新地址查询。
- 适合怎么选：不确定就别填，保持跟随 Codex。

#### `api.keyEnv` — 密钥环境变量名

- **用途**：告诉挂件从哪个已有环境变量读取密钥。
- **类型**：text
- **默认值**：留空使用 Codex 的现有密钥（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `keyEnv`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.baseUrl`
- **空值**：留空表示使用默认
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：当你的密钥不在 Codex 默认变量里时，告诉挂件去哪儿找。
- 怎么调：只填变量名，例如 MY_API_KEY，**不要填密钥本身**。这个名字必须已经存在于系统环境里。
- 什么时候生效：保存后按该变量名查找。
- 适合怎么选：换个域名就必须换成该服务专用的变量，不能沿用旧的。

#### `api.profile` — Codex 配置方案

- **用途**：指定读取哪一个 Codex profile。
- **类型**：text
- **默认值**：默认方案（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `profile`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **空值**：留空使用默认方案
- **生效**：需要重载后生效
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：你有多份 Codex 配置时要读非默认的那份。
- 怎么调：填 profile 名称，最多 128 字符。
- 什么时候生效：需要重载后生效。
- 适合怎么选：只有一个配置方案时留空。

#### `api.projectDir` — 项目目录

- **用途**：从指定目录里的 .codex/config.toml 读取配置。
- **类型**：text
- **默认值**：留空读取当前配置（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `projectDir`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.profile`
- **空值**：留空使用当前目录
- **生效**：需要重载后生效
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：在同一个机器上用不同项目的配置时使用。
- 怎么调：填该项目的绝对路径，目录里需要有 .codex/config.toml。相对路径无效。
- 什么时候生效：需要重载后生效。
- 适合怎么选：不需要就留空，默认读当前项目的配置。

#### `api.currency` — 自定义金额币种

- **用途**：指定接口返回金额的币种代码。
- **类型**：text，单位 三位大写字母
- **默认值**：USD（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `currency`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`api.provider`
- **空值**：留空按 USD 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：让余额数字带上正确的货币单位。
- 怎么调：三位大写字母，例如 USD、CNY、JPY。兼容账单接口固定为 USD。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：不确定就用 USD，再用「显示币种」做换算显示。

#### `api.balancePath` — 余额路径

- **用途**：自定义接口里余额数据的请求路径。
- **类型**：text
- **默认值**：由服务商模板决定（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `balancePath`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.provider`
- **空值**：留空使用服务商默认
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：自建中转接口路径和常见服务商不一样时使用。
- 怎么调：以 / 开头的路径，例如 /api/account/balance。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：用「自定义 JSON 余额接口」时才需要填。

#### `api.balanceField` — 余额字段

- **用途**：指定余额在返回 JSON 里的位置。
- **类型**：text
- **默认值**：data.balance（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `balanceField`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.balancePath`
- **空值**：留空按 data.balance 处理
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：接口返回结构不同时，告诉挂件去哪取余额数字。
- 怎么调：点号分隔的路径，只能用字母数字、下划线、点和短横线，例如 data.balance。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：「恢复默认」会把它重置为 data.balance。

#### `api.usedField` — 累计消耗字段

- **用途**：指定累计已用金额在返回 JSON 里的位置。
- **类型**：text
- **默认值**：留空表示不读取累计消耗（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `usedField`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.balanceField`
- **空值**：留空表示该接口不提供累计消耗
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：接口能给出累计消耗时，用来算日用量。
- 怎么调：点号分隔路径。留空表示这个接口只能给余额，用量得靠余额差值推算。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：接口文档里有 used / total_used 这类字段才填。

#### `api.balanceScale` — 金额换算系数

- **用途**：把接口返回的原始数字换算成真实金额。
- **类型**：number，范围 1e-9 – 不限
- **默认值**：1（来源 `runtime/config.mjs:10`）
- **存储**：`api-settings.json` 的 `balanceScale`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`api.balanceField`
- **空值**：留空按 1 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：有些接口返回的是分、微单位或 token 计数，需要换算。
- 怎么调：正数，范围 1e-9 到 1e12。真实金额 = 返回值 × 本系数。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：默认 1。接口以「分」为单位时填 0.01。
- 例子：接口返回 12345 且单位是分，填 0.01 后显示 123.45。

#### `api.billingUsageDivisor` — 账单用量除数

- **用途**：把账单接口的用量数值还原成真实量。
- **类型**：number，范围 0.000001 – 不限
- **默认值**：100（来源 `runtime/config.mjs:11`）
- **存储**：`api-settings.json` 的 `billingUsageDivisor`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`api.provider`
- **空值**：留空按 100 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：账单接口常把用量放大 100 倍返回。
- 怎么调：正数，范围 1e-6 到 1e12。真实用量 = 返回值 ÷ 本项。
- 什么时候生效：保存后用于下一次用量观测。
- 适合怎么选：按接口文档填；以「分」为单位返回时是 100。

#### `api.quotaPerUnit` — 每货币单位的 quota

- **用途**：把原始 quota 换算成金额。
- **类型**：number，范围 0.000001 – 不限
- **默认值**：500000（来源 `runtime/config.mjs:11`）
- **存储**：`api-settings.json` 的 `quotaPerUnit`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`api.provider`
- **空值**：留空按 500000 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：只有返回原始 quota 的接口才需要它。
- 怎么调：正数，范围 1e-6 到 1e12。金额 = quota ÷ 本项。
- 什么时候生效：保存后用于下一次余额刷新。
- 适合怎么选：500000 是常见默认值，按服务商文档调整。

#### `api.dashboardUrl` — 账单页面地址

- **用途**：点提醒气泡里的链接时打开的页面。
- **类型**：url
- **默认值**：留空使用当前服务商（来源 `runtime/config.mjs:9`）
- **存储**：`api-settings.json` 的 `dashboardUrl`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config`
- **依赖**：`api.provider`
- **空值**：留空使用服务商默认
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留

**`.help`**

- 有什么用：余额预警气泡里那个链接点开后去哪里充值或看账单。
- 怎么调：完整 https 地址。
- 什么时候生效：保存后用于下一次点击链接。
- 适合怎么选：大多数情况让服务商默认值就够。

#### `api.monitorSessions` — 记录本机 token 与任务状态

- **用途**：让挂件知道你每轮任务用了多少。
- **类型**：boolean
- **默认值**：true（来源 `runtime/config.mjs:12`）
- **存储**：`api-settings.json` 的 `monitorSessions`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **空值**：缺省按 true 处理
- **生效**：需要重载后生效

**`.help`**

- 有什么用：开启后才能显示本轮 token、任务完成提醒和用量气泡。订阅和 API 两种模式都依赖它。
- 怎么调：开关。关闭后不再统计 token，但余额本身还能显示。
- 什么时候生效：需要重载后生效。
- 适合怎么选：保持开启。它只读取本机 Codex 的 token 记录，不发送聊天内容。

#### `api.refreshSeconds` — 余额刷新间隔

- **用途**：多久重新读一次 API 余额。
- **类型**：number，单位 秒，范围 15 – 3600，步长 1
- **默认值**：60（来源 `runtime/config.mjs:12`）
- **存储**：`api-settings.json` 的 `refreshSeconds`
- **读取**：`GET /api/config`
- **修改**：`PUT /api/config`
- **依赖**：`ui.accountView`
- **空值**：留空按 60 处理
- **生效**：保存后用于下一次

**`.help`**

- 有什么用：余额是定时拉取的，不是实时的。
- 怎么调：15 到 3600 秒。
- 什么时候生效：保存后用于下一次刷新。
- 适合怎么选：保持 60 秒。太频繁没有意义，部分服务商还有频率限制。

#### `api.models` — 主接口每轮费用估算价格

- **用途**：按模型单价把本轮 token 换算成金额。
- **类型**：group
- **默认值**：空表示不估算，按观测到的扣费显示（来源 `runtime/config.mjs:12`）
- **存储**：`api-settings.json` 的 `models.<model>`
- **读取**：`GET /api/config（只返回已配置标记）`
- **修改**：`PUT /api/config（pricingUpdate）`
- **依赖**：`api.provider`、`api.currency`
- **空值**：留空保留全部现有价格
- **生效**：保存后用于下一次
- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留
  - 子字段 `input` — 输入价格
  - 子字段 `cachedInput` — 缓存命中价格
  - 子字段 `output` — 输出价格
  - 子字段 `cacheWrite` — 缓存写入价格（可选）

**`.help`**

- 有什么用：没配价格时，显示的是本轮期间观测到的 API 扣费，可能包含同密钥的其他调用。配了价格才按你的 token 记录精确估算。
- 怎么调：单位是每百万 token，币种用上面的自定义金额币种。必须同时填输入、缓存命中、输出三项，缓存写入可选。模型名称要和 Codex 里完全一致。
- 什么时候生效：保存后用于下一次用量估算。
- 适合怎么选：只给常用模型配价格；模型名写错会导致永远匹配不上。
- 例子：只更新 gpt-5 的价格，其他模型不动。

#### `api.customModels` — 独立 API 模型

- **用途**：为每个 API 模型单独配置接口、提醒、价格和额度。
- **类型**：group
- **默认值**：由所选服务商模板提供（来源 `runtime/api-models.mjs:6`）
- **存储**：`api-models.json` 的 `models[<id>].<field>`
- **读取**：`GET /api/models`
- **修改**：`PUT /api/models`
- **依赖**：`api.provider`
- **空值**：多数字段留空保留原值；价格和阈值留空会清除
- **生效**：保存后用于下一次
  - 子字段 `template` — 服务商模板
  - 子字段 `name` — 显示名称
  - 子字段 `currency` — 币种
  - 子字段 `keyEnv` — 密钥环境变量名
  - 子字段 `baseUrl` — API 地址
  - 子字段 `balanceUrl` — 余额查询地址
  - 子字段 `balanceField` — 余额字段
  - 子字段 `usedField` — 累计消耗字段
  - 子字段 `scale` — 金额换算系数
  - 子字段 `matchIds` — 用量匹配模型名
  - 子字段 `alerts.balance` — 余额预警阈值
  - 子字段 `alerts.dailyTokens` — 每日 token 阈值
  - 子字段 `alerts.dailyBudget` — 每日预算
  - 子字段 `alerts.quotaRemainingBelow` — 剩余 quota 阈值
  - 子字段 `messages.balance` — 余额提醒文字
  - 子字段 `messages.budget` — 预算提醒文字
  - 子字段 `messages.quota` — quota 提醒文字
  - 子字段 `prices.input` — 输入价格
  - 子字段 `prices.cached` — 缓存价格
  - 子字段 `prices.output` — 输出价格
  - 子字段 `manualQuota` — 手动额度
  - 子字段 `bubbleSettings` — 提醒气泡内容

**`.help`**

- 有什么用：想同时盯多个 API 服务商时用。34 个服务商模板任选。
- 怎么调：表单里的字段名和保存后的字段名不完全一致：表单填 balanceBelow / dailyTokens / dailyBudget / quotaRemainingBelow，保存后变成 alerts.below / alerts.dailyTokens / alerts.dailyBudget / alerts.quotaRemainingBelow；表单的 inputPrice / cachedPrice / outputPrice 保存后变成 prices.input / prices.cached / prices.output。切换模板会把该模型其他字段重置为模板默认值。
- 什么时候生效：保存后用于下一次该模型的查询。
- 适合怎么选：先选模板、测试通过，再改价格和提醒。
- 例子：删除一个模型的价格：把对应价格三项清空再保存。

#### `api.manualQuota` — 手动额度

- **用途**：当接口不返回剩余额度时，由你手填一个数字。
- **类型**：group
- **默认值**：未设置（来源 `runtime/api-models.mjs:105`）
- **存储**：`api-models.json` 的 `manualQuota`
- **读取**：`GET /api/models`
- **修改**：`PUT /api/models`
- **依赖**：`api.customModels`
- **空值**：清空该组即删除手动额度
- **生效**：保存后用于下一次
  - 子字段 `remaining` — 剩余额度
  - 子字段 `total` — 总额度
  - 子字段 `mode` — 计算方式
  - 子字段 `period` — 周期

**`.help`**

- 有什么用：某些服务商只给总额不给余额。你可以按自己的消耗填一个剩余值，它会覆盖接口显示。
- 怎么调：计算方式 manual 或 auto；周期 none、daily 或 weekly。daily 按当天 0 点重置，weekly 按本周一重置。
- 什么时候生效：保存后用于下一次显示。
- 适合怎么选：知道这个数是手填的，不要当成官方余额。

<!-- END GENERATED: settings-catalog -->

下面各节是对这个目录的补充分析：存储总表、各存储的写入语义、并发风险和历史遗留字段。

## 2. 数据目录与调用路径

`runtime/paths.mjs` 定义：

- 仓库根目录 `ROOT`，不是外层“大肥鱼”。
- `CODEX_HOME`：优先使用进程已配置的该变量，否则为用户目录下 `.codex`。
- `DATA_HOME`：优先使用已配置的 `WHALE_HOME`，否则为 `CODEX_HOME/whale-widget`。
- 不要把默认路径硬编码为当前用户路径，也不要为了测试改动真实环境文件。

当前桌面通过 `whale://widget/` 的本地协议调用 `runtime/dispatcher.mjs`。外部脚本可使用 `runtime/process.mjs` 导出的 `serviceRequest()`，底层为 `runtime/bridge.mjs` 的本机连接，不是公开 HTTP 接口。不要把路径写成可以直接 `curl localhost` 的服务。

当前可用的控制命令在 `scripts/control.mjs`，包括 `status`、`open`、`desktop`、`follow`、`reset-position` 等。**没有已经实现的通用 `config set` 命令。** 不调用安装或监督进程启动来完成纯文档任务。

## 3. 主要配置存储总表

| 配置域 | 当前持久化位置（相对 DATA_HOME） | 读写入口／逻辑 | 关键注意 |
| --- | --- | --- | --- |
| 尺寸、基础声音、气泡总开关等 | `.dshw-size.json`，兼容回退 `profiles/web/.dshw-size.json` | `/dsh-whale/size.json`；`lib/widget-host.mjs` | 当前写入是完整结构，必须带 `scale`；不是任意字段补丁 |
| 显示数据来源 | `display-mode.json` | `/api/display-mode` GET／POST | mode 为 `subscription` 或 `api`；页面还缓存 `dshw-account-view` |
| 角色选择、位置、吸附、手感、显示币种 | `ui-state.json` 中的 `dshw-*` 字符串值 | `localStorage` → `desktop/ui/input.js` → `UiStateStore`；另有 `/api/ui-state` | 当前整份替换；同名接口不等于所有缓存都立即同步 |
| 完成声音、用量提示、预算、余额预警 | `usage-settings.json` | `/dsh-whale/usage-settings.json`；`runtime/service.mjs` | 顶层域合并，域内部浅合并；数组整体替换 |
| API 主接口及单模型价格 | `api-settings.json` | `/api/config`；`runtime/config.mjs` | 部分字段只返回 configured 标志，不能由脱敏响应重建整个文件 |
| 独立 API 模型 | `api-models.json` | `/api/models`；`runtime/api-models.mjs` | 保存请求字段与最终嵌套存储字段不完全一致 |
| 气泡序列和模块库 | `.dshw-bubble.json` | `/dsh-whale/bubble.json` | API／订阅序列分别保存，lib 共用；注意 editingMode |
| 角色素材 | `whale-roles/roles.json` 及素材文件；有 profiles/web 回退 | `/dsh-whale/roles.json` 及同组资源接口 | 选择角色另存 `dshw-role`，不要只写素材索引 |
| 音效组和音频片段 | `whale-audio/audio.json` 及音频文件；有 profiles/web 回退 | `/dsh-whale/audio.json` 及同组资源接口 | 内置素材与用户素材有不同编辑／删除约束 |
| 气泡图片 | `whale-bubble-imgs/bubble-imgs.json` 及图片 | `/dsh-whale/bubble-imgs.json` 等 | 不与角色图库混用；导入走既有媒体校验 |
| 运行方式 | `follow-config.json` 及主进程当前状态 | `/api/desktop-mode`、`scripts/control.mjs` | 普通模式切换不等于授权重装自动跟随服务 |
| 汇率缓存 | `display-fx.json` | `/api/fx/usd-cny`；`runtime/fx.mjs` | 是缓存与刷新状态，不能当成任意可填汇率偏好 |

不要修改真实账本、任务序号、余额观测、迁移标记来改变设置。这些属于运行数据。

## 4. 基础设置字段

来源：`lib/widget-host.mjs` 的 `readSizeConfig`、`writeSizeConfig` 与 `assets/whale-widget.js` 的 setter。

| 字段 | 含义／取值 | 已核对的注意点 |
| --- | --- | --- |
| `scale` | 角色大小，界面当前底层范围 0.6–2.5 | 旧数字框显示 1–20 刻度，与底层比例不同；写入接口要求存在数字 scale |
| `sound` | 点击／松开音效开关 | 缺省读取为 true；不是所有任务声音的总开关 |
| `vol` | 点击音量，UI 使用 0–1 | 缺省读取 0.9；任务音量可跟随或独立，不能直接改名总音量 |
| `soundSet` | 当前音效组 ID | 缺省 duck；内置还有 fx1，可引用用户导入组 |
| `usageMode` | 旧用量模式字段 | 现实现按 ledger 处理；不等于 subscription／api 的数据显示来源 |
| `bubbleOn` | 气泡总开关 | 缺省 true；与任务用量提示存在依赖，实施时验证组合 |
| `turnCostOn` | 每轮完成后显示用量 | 缺省 true；订阅模式展示本机 token，API 模式展示相应费用／用量 |
| `turnCostCloseMs` | 完成用量提示自动关闭时间，毫秒 | 缺省 5000；0 为手动；声音编辑器以秒输入，当前支持 0–3600 秒 |
| `scrollGapOn` | 右侧滚动条避让 | 缺省 false |
| `scrollGapPx` | 避让距离，像素 | 缺省读取 17；写入缺值会归为 0，因此不能只发送其他字段 |
| `menuBtnHide` | 隐藏挂件菜单按钮 | 缺省 false；隐藏后仍应通过右键等入口找回设置 |
| `updatedAt` | 保存时间 | 自动生成，非用户偏好 |

保存规则：读取最新完整基础配置 → 仅修改目标字段 → 沿既有校验写入 → 回读其他字段未变化 → 通知挂件更新。并发控制由实施任务补齐。

## 5. UI 状态字段

`ui-state.json` 的值是字符串。JSON 对象字段需要先解析，再局部修改，再序列化；不能把对象直接塞进要求字符串的保存接口。

| 键 | 内容 | 源码 |
| --- | --- | --- |
| `dshw-role` | 已选角色 ID | `assets/whale-widget.js` 的角色选择逻辑 |
| `dshw-pos` | 版本、水平／垂直锚点与距离等 | 同文件的位置保存／恢复；优先调用现有 reset-position 动作 |
| `dshw-snap` | `v`、`mode`、`ratio`、`px` | 同文件 `SNAP_DEFAULTS`、`fixSnapConfig`、`saveSnap` 相关逻辑 |
| `dshw-v3-feedback` | `feel`、`events` | `desktop/ui/preferences-v3.js` |
| `dshw-display-currency` | USD 或 CNY | `desktop/ui/money.js`；显示换算不改变原币账本 |
| `dshw-account-view` | subscription 或 api 的页面缓存 | `desktop/ui/account-view.js`；服务端 display-mode 为持久化来源 |

吸附：`mode` 为 ratio／px／off。`ratio` 和 `px` 下的 L、T、R、B 是四边吸附范围，F 为翻转线。现默认 ratio 为 L10/T0/R10/B15/F50；px 为 L80/T0/R80/B80/F-1。F 的特殊值、屏幕尺寸修正等须沿现有 `fixSnapConfig` 解释与校验，不能仅靠数值表判断。

手感：`feel` 为 balanced／crisp／soft。`events` 下有 press、release、success、cancelled、failed，每项含 preset 与 volume。现默认独立 volume 为 0.8；前三者 preset 为 original，后两者为 silent。允许的其他预设及“原音效”可用事件以现有 UI 为准。

不把 `dshw-last-seq`、`dshw-last-turn-id`、`dshw-api-alert:*` 当成用户配置，它们用于任务与提醒去重。

## 6. 提醒与声音

来源：`runtime/ledger.mjs` 的 `usageDefaults()`、`runtime/service.mjs` 的读写方法、`desktop/ui/sound-settings.js`。

| 字段模式 | 用途 | 注意 |
| --- | --- | --- |
| `taskEnd.on` | 任务完成提示音开关 | 默认 false |
| `taskEnd.sel` | 提示音引用 | 服务默认空；声音编辑器有自己的回退选项，需统一解释 |
| `taskEnd.vol` / `taskEnd.volSet` | 提示音音量与是否独立设置 | 未独立设置时按编辑器逻辑跟随点击音量 |
| `turnCost.lines[]` | 每轮用量提示的模块 | 默认有 turn_title／turn_primary／turn_detail 三行 |
| `alert.on` / `alert.below` | 余额预警与阈值 | 默认开启、阈值 5；金额与 API 币种有关 |
| `budget.on` / `budget.amount` | 每日预算提醒与阈值 | 默认开启、阈值 10；不阻止调用，不等于硬限额 |
| `alert.msg` / `budget.msg` | 提醒文字 | 模板变量需保留语义 |
| `alert.lines[]` / `budget.lines[]` | 提醒模块与样式 | 与基础 msg 的使用优先关系需按渲染逻辑记录 |
| `alert.autoClose` / `budget.autoClose` | 是否自动关闭 | 当前默认 false |
| `alert.ttlSec` / `budget.ttlSec` | 自动关闭秒数 | 当前默认 6，与 turnCostCloseMs 的单位不同 |

各事件音色／音量另在 `dshw-v3-feedback`，不是本文件字段。后续文档须给出最终声音计算关系和至少一个实测例子。

## 7. API 主配置

默认值与校验在 `runtime/config.mjs` 的 `DEFAULT_CONFIG`、`validateConfig()`；界面在 `widget.html` 和 `client.js`。

| 字段 | 含义／默认 |
| --- | --- |
| `provider` | auto（默认）／billing／newapi／custom-json／deepseek |
| `baseUrl` | API 根地址；空表示按现有 Codex 配置解析 |
| `keyEnv` | 密钥环境变量名；不是密钥 |
| `profile` / `projectDir` | 指定 Codex 配置方案／项目目录 |
| `currency` | 三位币种代码，默认 USD；具体 provider 可能有固定币种 |
| `balancePath` / `balanceField` / `usedField` | 自定义余额路径／余额字段／累计消耗字段；balanceField 默认 data.balance |
| `balanceScale` | 余额换算系数，默认 1，校验范围 1e-9–1e12 |
| `billingUsageDivisor` | 账单用量除数，默认 100，校验范围 1e-6–1e12 |
| `quotaPerUnit` | 每货币单位对应原始 quota，默认 500000，校验范围 1e-6–1e12 |
| `dashboardUrl` | 账单页面地址 |
| `monitorSessions` | 记录本机 token 与任务状态，默认 true |
| `refreshSeconds` | 默认 60，校验 15–3600；字段存在不代表已被所有刷新路径采用，实施前追踪实际消费者 |
| `models[model]` | 主接口费用估算价格，字段 input／cachedInput／output，可选 cacheWrite；每百万 token |

`PRIVATE_SETTING_FIELDS` 包含 baseUrl、keyEnv、profile、projectDir、dashboardUrl、balancePath、balanceField、usedField、models。`GET /api/config` 只给这些字段的存在标记，不返回原内容。

- `PUT /api/config` 使用局部补丁；私密字段留空保留是界面提交逻辑，不可推断为接口收到空字符串也保留。
- 单模型价格使用 `pricingUpdate: {model, prices}`；prices 为 null 表示删除指定模型价格。删除操作需要相应用户授权。
- 主接口价格的 cachedInput 与下节独立模型价格的 cached 不同，不能混写。
- 自定义地址必须经过现有 URL 与凭据目的地校验。禁止把示例密钥写进配置。

## 8. 独立 API 模型

来源：`runtime/api-models.mjs` 的 `ApiModelRegistry.save()`；编辑器 `desktop/ui/api-models.js`。

| 配置组 | 当前字段／请求映射 |
| --- | --- |
| 标识与模板 | id、template、name、currency |
| 接口 | keyEnv、baseUrl、balanceUrl、balanceField、usedField、scale |
| 用量匹配 | matchIds，模型名匹配列表 |
| 提醒阈值 | 请求 balanceBelow／dailyTokens／dailyBudget／quotaRemainingBelow → alerts 对应字段 |
| 提醒文字 | 请求 balanceMessage／budgetMessage／quotaMessage → messages.balance／budget／quota |
| 价格 | 请求 inputPrice／cachedPrice／outputPrice → prices.input／cached／output |
| 手动额度 | manualQuota.total／remaining／resetsAt／mode／period；resetBase 是操作参数 |
| 提醒气泡 | bubbleSettings.balance／budget／quota，各含 lines／autoClose／ttlSec |

手动额度 mode 为 manual／auto，period 为 none／daily／weekly。observedAt、baseAt 为运行时记录，不应直接当普通表单字段修改。手动值不是官方返回值。

更新已有模型必须保留其 ID 和模板语义；表单留空时，有些字段保留，有些价格／阈值字段会清除。后续逐字段契约必须写明，不允许用一种空值规则概括整个模型编辑器。

## 9. 气泡与素材：实施时必须继续展开的契约

### 已核对的气泡顶层结构

- `v`、`items`（API 序列）、`subscriptionItems`（订阅序列）、`lib`（模块库）。
- `tapAdvance`、`subscriptionTapAdvance`：对应模式的点击切换偏好。
- 写入时 `editingMode` 是请求中的编辑上下文，不是需要当作用户字段存储的配置。
- `/dsh-whale/bubble.json` 按 editingMode 保留另一模式序列；不要用空数组覆盖不在编辑的模式。
- 接口需要 items 和 lib 数组。模块使用 text、image、link、random、quota 等类型，并有布局、颜色、字号、随机权重、模型绑定等子字段。

**本轮尚未逐一列完模块子字段。** T01 必须从实际编辑器与渲染逻辑逐项补齐。至少覆盖：点击序列／并列关系、模块库、模块类型、文本与变量、链接、字体／字号／字重／斜体／下划线、纯色与动态配色、背景／折行、图片引用／缩放／独占行、随机文本／图片与权重、额度窗口与展示样式、模型绑定。不能用本段清单替代最终字段文档。

### 素材契约

- 原始素材文件与索引关联；图片、音频上传使用既有资源接口，遵守 `lib/media-validation.mjs`。
- ID、格式、名称、排序／置顶、音效组按下／松开引用、音频裁切范围等均须有操作与存储映射。
- 工坊导入／导出用 `/api/workshop/import`、`/api/workshop/export`，实现 `lib/workshop.mjs`；包 schema 为 api-balance-whale-workshop，当前版本 1。
- 角色、图片、音频片段、音效组四类分别维护；导入包不等于已经选择其中角色。
- 资源删除属于用户明确授权的操作，不因文档提供路径就批量清理。

## 10. 完整配置条目格式（交付要求）

每个字段应包含：

```text
settingId:
用户名称与常见说法:
所在页面／适用模式:
类型／单位／范围／可选项:
当前默认值及源码来源:
字段依赖与空值语义:
存储位置及真实键:
读取与修改入口:
保存／预览／热更新规则:
界面帮助文案:
Agent 修改示例:
回读与行为验证:
恢复单项旧值／默认值的方法:
```

重复动态条目可以使用 ID 模式，例如 `feedback.events.<event>.volume`、`apiModels.<id>.prices.<kind>`。模式下每个支持的子字段仍需明确说明。

## 11. Agent 修改流程与验证

1. 读取项目约定，确认用户要求的是当前偏好或程序默认值。
2. 解析实际数据目录和运行状态，只读取本次需要的数据，私密值不输出到日志。
3. 按字段文档检查单位、合法值、模式与依赖；明确实际要变更的字段集合。
4. 通过受支持入口提交变化，不用脱敏结果重建配置，不提交过时整份快照。
5. 回读目标字段，比较同一保存域的其他字段；确认挂件实际更新。
6. 失败时报告真实状态；恢复时使用此前读取的目标旧值，不能恢复整份旧文件覆盖并发修改。
7. 若必须重启、修改环境变量、删除资源等超出当前授权范围，说明具体阻塞操作，继续其他可完成工作。

### 当前可参考的只读查询示例

在仓库根目录、服务已运行的情况下，下面代码只显示 API 的非私密配置和私密字段存在标记。本轮未连接真实服务执行：

```js
import { serviceRequest } from './runtime/process.mjs';
const info = await serviceRequest('/api/config');
console.log({ settings: info.settings, configured: info.configured });
```

该示例只能说明调用路径，不证明所有字段已有热更新支持。后续通用写入命令和示例必须在隔离数据上实际运行后再写入本手册，验证场景见任务书 T06。

## 12. 验收前剩余工作

- [ ] 气泡／素材／API 等全部动态字段的逐项契约。
- [ ] 各音量层级、气泡与任务提示的准确依赖说明。
- [ ] 刷新间隔等“字段存在但消费者待核实”的状态确认。
- [ ] 统一多窗口写入与热更新方法，经过实际验证。
- [ ] 任务书规定的 8 个 Agent 修改案例。
- [ ] UI 配置 ID、说明、文档覆盖对应检查和语义抽查。

完成这些项后，才能将本文状态改为“完整操作手册，已验证”。
