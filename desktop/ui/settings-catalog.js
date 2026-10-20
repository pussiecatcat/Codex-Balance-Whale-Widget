// 大肥鱼设置目录 —— 界面控件、`!` 说明与 docs/CONFIGURATION.md 的唯一事实源。
//
// 加载方式：本文件同时是普通浏览器脚本与 CommonJS 模块。
// 浏览器：<script src="/settings-catalog.js">  → globalThis.WhaleSettingsCatalog
// Node：   require(...) 或 vm.runInNewContext   → module.exports
//
// 约定（由 tests/settings-catalog.test.mjs 强制）：
//   1. 每个字段的 help 四要素齐全：use / adjust / apply / recommend。
//   2. 禁止通用兜底文案。help.adjust 会被检查长度与禁用词。
//   3. defaultSource 必须写成 file:line，且该行真实存在。
//   4. 动态条目用 pattern:true + subFields，不能用一个笼统条目代替整个编辑器。
(() => {
  'use strict';

  // 二级设置窗口的六个固定分类。顺序即左侧导航顺序。
  const PAGES = [
    { id: 'appearance', label: '外观与显示', hint: '角色、大小、桌面显示方式与数据显示来源' },
    { id: 'sound', label: '声音与提醒', hint: '什么时候出声、显示什么提醒' },
    { id: 'bubble', label: '气泡内容', hint: '气泡开关、形状、点击序列与模块' },
    { id: 'position', label: '位置与交互', hint: '贴边、翻转、避让与菜单按钮' },
    { id: 'media', label: '素材管理', hint: '角色图片、气泡图片与音效素材' },
    { id: 'api', label: 'API 与用量', hint: '接口状态、币种、预警、预算与每轮费用' },
  ];

  // hotReload 三种取值：immediate 立即生效 / after-save 保存后用于下一次 / restart 需重载页面
  const FIELDS = [
    // ── 基础设置域：.dshw-size.json ────────────────────────────────────────────
    {
      id: 'size.scale', page: 'appearance', tier: 1, domain: 'size',
      label: '大小', purpose: '调整鲸鱼在桌面上的整体大小。',
      type: 'range', unit: '倍', min: 0.6, max: 2.5, step: 0.1,
      defaultValue: 1.5, defaultSource: 'runtime/size-settings.mjs:6',
      store: '.dshw-size.json', key: 'scale', emptyValue: '最小 0.6',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '缩放角色图片本身，不改变气泡、菜单和文字的清晰度策略。',
        adjust: '0.6 到 2.5，步长 0.1。滑块只显示「小—大」，精确值在完整设置里输入。旧菜单的 1–20 刻度只是显示映射，底层存的是倍数。',
        apply: '拖动即时生效并立即保存。',
        recommend: '笔记本和外接屏混用时，1080p 屏建议 1.2–1.4，4K 屏建议 1.6–1.8。',
      },
    },
    {
      id: 'size.sound', page: 'sound', tier: 1, domain: 'size',
      label: '点击音效', purpose: '控制按下和松开鲸鱼时是否发声。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/size-settings.mjs:7',
      store: '.dshw-size.json', key: 'sound', emptyValue: '缺省按 true 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '只管点击鲸鱼本身的手感音，不管任务完成、余额预警的提示音。',
        adjust: '开关。关掉后各事件仍有自己的音色和音量设置，只是按下与松开不发声。',
        apply: '立即生效。',
        recommend: '在会议室或共享空间关掉；其余情况保留，它也是「鲸鱼在响应」的反馈。',
      },
    },
    {
      id: 'size.vol', page: 'sound', tier: 2, domain: 'size',
      label: '点击音量', purpose: '按下与松开音量的总音量。',
      type: 'range', unit: '百分比', min: 0, max: 1, step: 0.01,
      defaultValue: 0.9, defaultSource: 'runtime/size-settings.mjs:8',
      store: '.dshw-size.json', key: 'vol', emptyValue: '缺省按 0.9 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.sound'], hotReload: 'immediate',
      help: {
        use: '总音量。它会乘到每个事件自己的独立音量上，不是二选一。',
        adjust: '0 到 1，步长 0.01。实际响度 = 本项 × 对应事件的独立音量 × 事件是否静音。',
        apply: '立即生效。',
        recommend: '先用 0.9；要单独调某个事件时只改那一个事件，不要动这里。',
        example: '点击音量 0.9、按下独立音量 0.8，按下实际输出 0.72。',
      },
    },
    {
      id: 'size.soundSet', page: 'sound', tier: 2, domain: 'size',
      label: '音效组', purpose: '选择按下与松开使用的音色素材组。',
      type: 'select',
      options: [{ value: 'duck', label: '小黄鸭（内置）' }, { value: 'fx1', label: '音效1（内置）' }],
      defaultValue: 'duck', defaultSource: 'runtime/size-settings.mjs:9',
      store: '.dshw-size.json', key: 'soundSet', emptyValue: '留空按 duck 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.sound'], hotReload: 'immediate',
      help: {
        use: '决定「现有音效」这一档具体放什么声音。',
        adjust: '下拉列出全部内置音效组和你导入的音效组。切换后立刻用当前音量试听。',
        apply: '立即生效。',
        recommend: '先用内置组；导入自定义组后在素材管理里试听再选。',
      },
    },
    {
      id: 'size.usageMode', page: 'appearance', tier: 2, domain: 'size',
      label: '用量来源（旧字段）', purpose: '历史遗留字段，当前实现已固定。',
      type: 'locked', value: 'ledger',
      defaultValue: 'ledger', defaultSource: 'runtime/size-settings.mjs:10',
      store: '.dshw-size.json', key: 'usageMode', emptyValue: '写入时归一为 ledger',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'restart',
      help: {
        use: '早期用来切换用量统计口径的字段。',
        adjust: '不可修改。读和写都会归一为 ledger，界面上只读展示。',
        apply: '不适用。',
        recommend: '不用管。显示数据来源请改「数据显示」那一项。',
      },
    },
    {
      id: 'size.bubbleOn', page: 'bubble', tier: 1, domain: 'size',
      label: '显示气泡', purpose: '控制鲸鱼说话时是否弹出气泡。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/size-settings.mjs:11',
      store: '.dshw-size.json', key: 'bubbleOn', emptyValue: '缺省按 true 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '关掉后余额、任务完成、余额预警这些气泡都不再出现，点击鲸鱼也不会弹。',
        adjust: '开关。关闭不会改动你已经编辑好的气泡内容，重新打开即可恢复显示。',
        apply: '立即生效。',
        recommend: '只想少打扰但仍要看关键数字时，用「完成提醒」选「仅气泡」比直接关掉更合适。',
      },
    },
    {
      id: 'size.turnCostOn', page: 'sound', tier: 1, domain: 'size',
      label: '任务结束后显示用量', purpose: '一轮任务结束后弹出本轮用量气泡。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/size-settings.mjs:12',
      store: '.dshw-size.json', key: 'turnCostOn', emptyValue: '缺省按 true 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.bubbleOn'], hotReload: 'immediate',
      help: {
        use: '订阅模式显示本轮 token，API 模式显示本轮观测到的消耗。',
        adjust: '开关。依赖「显示气泡」开着才有意义。',
        apply: '立即生效。',
        recommend: '长任务密集时打开，跑批时关掉。',
      },
    },
    {
      id: 'size.turnCostCloseMs', page: 'sound', tier: 2, domain: 'size',
      label: '任务用量提示显示多久', purpose: '控制任务结束用量气泡的停留时间。',
      type: 'number', unit: '秒', min: 0, max: 3600, step: 1,
      defaultValue: 5, defaultSource: 'runtime/size-settings.mjs:13',
      store: '.dshw-size.json', key: 'turnCostCloseMs', emptyValue: '缺省按 5000 毫秒处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.turnCostOn'], hotReload: 'immediate',
      help: {
        use: '用量气泡自动消失前的停留时间。',
        adjust: '0 到 3600 秒，0 表示不自动关闭、由你手动关掉。存储单位是毫秒。',
        apply: '立即生效。',
        recommend: '先用 5 秒；数字多到来不及看就调到 10 秒以上，或者选 0 手动关。',
        example: '填 8 秒，底层保存 8000。',
      },
    },
    {
      id: 'size.scrollGapOn', page: 'position', tier: 2, domain: 'size',
      label: '避开右侧滚动条', purpose: '让挂件右侧留出空隙，减少遮挡滚动条。',
      type: 'boolean',
      defaultValue: false, defaultSource: 'runtime/size-settings.mjs:14',
      store: '.dshw-size.json', key: 'scrollGapOn', emptyValue: '缺省按 false 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'after-save',
      help: {
        use: '把挂件整体左移一点，避免压住 Codex 窗口右边的滚动条。',
        adjust: '开关。开启后用下面的距离决定留多少。',
        apply: '保存后重新摆放挂件位置。',
        recommend: '鲸鱼停在屏幕右侧、且你会滚 Codex 右侧内容时打开。',
      },
    },
    {
      id: 'size.scrollGapPx', page: 'position', tier: 2, domain: 'size',
      label: '避让距离', purpose: '避开右侧滚动条时留出的宽度。',
      type: 'number', unit: '像素', min: 0, max: 200, step: 1,
      defaultValue: 17, defaultSource: 'runtime/size-settings.mjs:15',
      store: '.dshw-size.json', key: 'scrollGapPx', emptyValue: '0 表示不留距离',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.scrollGapOn'], hotReload: 'after-save',
      help: {
        use: '距离越大，鲸鱼离屏幕右边缘越远。',
        adjust: '单位像素，0 表示不留距离。17 是当前实现的回退值，适合先试这个。',
        apply: '保存后重新摆放挂件；关闭开关时已填的距离会保留，再次启用即可恢复。',
        recommend: '先用 17。滚动条被挡住时再加到 24–32。',
      },
    },
    {
      id: 'size.menuBtnHide', page: 'position', tier: 2, domain: 'size',
      label: '隐藏菜单按钮', purpose: '收起鲸鱼身上那个 ☰ 按钮。',
      type: 'boolean',
      defaultValue: false, defaultSource: 'runtime/size-settings.mjs:16',
      store: '.dshw-size.json', key: 'menuBtnHide', emptyValue: '缺省按 false 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '让鲸鱼只显示角色本身，不显示左上角的菜单按钮。',
        adjust: '开关。隐藏后仍可通过右键鲸鱼打开菜单，菜单不会失联。',
        apply: '立即生效。',
        recommend: '觉得按钮碍眼时打开。',
      },
    },

    // ── UI 状态域：ui-state.json（dshw-* 字符串键）──────────────────────────
    {
      id: 'ui.accountView', page: 'appearance', tier: 1, domain: 'displayMode',
      label: '查看数据', purpose: '决定鲸鱼点开后显示订阅额度还是 API 余额。',
      type: 'select',
      options: [{ value: 'subscription', label: 'Codex 额度' }, { value: 'api', label: 'API 余额' }],
      defaultValue: 'subscription', defaultSource: 'runtime/composition.mjs:50',
      store: 'display-mode.json', key: 'mode', emptyValue: '非法值按 subscription 处理',
      read: 'GET /api/display-mode', write: 'POST /api/display-mode',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '这是显示来源的切换，不改变你的账号登录状态，也不改变 API 配置。',
        adjust: '二选一。选 Codex 额度看 5 小时与周额度；选 API 余额看你配置的接口余额。',
        apply: '立即生效。',
        recommend: '用订阅账号就选 Codex 额度；用 API key 计费就选 API 余额。',
      },
    },
    {
      id: 'ui.role', page: 'appearance', tier: 1, domain: 'ui',
      label: '角色', purpose: '选择鲸鱼当前使用的形象。',
      type: 'role',
      defaultValue: '默认角色', defaultSource: 'assets/whale-widget.js:147',
      store: 'ui-state.json', key: 'dshw-role', emptyValue: '留空按角色库默认处理',
      read: 'GET /dsh-whale/roles.json', write: 'POST /dsh-whale/role-pin.json + ui-state.json',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '只切换显示哪一张角色图，不影响任何额度或用量统计。',
        adjust: '点缩略图选择；导入按钮在选择器尾部，用来添加自己的图片。支持 PNG / GIF / APNG。',
        apply: '立即生效并立即保存。',
        recommend: '先按默认角色用；需要换形象时再导入并选择。',
      },
    },
    {
      id: 'ui.displayCurrency', page: 'appearance', tier: 2, domain: 'ui',
      label: '显示币种', purpose: '决定界面上的金额用美元还是人民币显示。',
      type: 'select',
      options: [{ value: 'USD', label: '美元 USD' }, { value: 'CNY', label: '人民币 CNY' }],
      defaultValue: 'USD', defaultSource: 'desktop/ui/money.js:13',
      store: 'ui-state.json', key: 'dshw-display-currency', emptyValue: '非法值按 USD 处理',
      read: '本地偏好 + GET /api/fx/usd-cny', write: 'localStorage → whale-save-storage',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '只改显示，不改账本。换算用的是参考汇率，账目本身保持原币种。',
        adjust: '二选一。选人民币时会用缓存的美元兑人民币汇率。',
        apply: '立即生效。',
        recommend: '按你习惯的币种看；核对账单时切回原币种。',
      },
    },
    {
      id: 'ui.bubbleShape', page: 'bubble', tier: 2, domain: 'ui',
      label: '气泡形状', purpose: '切换鲸鱼说话时气泡的外形。',
      type: 'select',
      options: [{ value: 'ellipse', label: '椭圆' }, { value: 'round', label: '圆角方形' }],
      defaultValue: 'ellipse', defaultSource: 'assets/whale-widget.js:3654',
      store: 'ui-state.json', key: 'dshw-bubble-shape', emptyValue: '留空按 ellipse 处理',
      read: 'localStorage 读取', write: 'localStorage → whale-save-storage',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '两种形状外框一样大，区别在于内部能放下多少内容。',
        adjust: '二选一。椭圆更圆润；圆角方形内接矩形更大，气泡内容多时不会溢出到外面。',
        apply: '立即生效。',
        recommend: '气泡里有两个以上额度卡片或长文本时选圆角方形。',
      },
    },
    {
      id: 'ui.feel', page: 'sound', tier: 2, domain: 'ui',
      label: '按压手感', purpose: '调整按下与松开的动画节奏。',
      type: 'select',
      options: [
        { value: 'balanced', label: '均衡' },
        { value: 'crisp', label: '清脆' },
        { value: 'soft', label: '柔和' },
      ],
      defaultValue: 'balanced', defaultSource: 'desktop/ui/preferences-v3.js:4',
      store: 'ui-state.json', key: 'dshw-v3-feedback.feel', emptyValue: '留空按 balanced 处理',
      read: 'localStorage 读取', write: 'localStorage → whale-save-storage',
      dependsOn: [], hotReload: 'immediate',
      help: {
        use: '只影响鲸鱼被按下时的回弹速度，不改变音量。',
        adjust: '三档：均衡约 75/140 毫秒、清脆约 65/125 毫秒、柔和约 85/155 毫秒（按下 / 松开）。',
        apply: '立即生效。',
        recommend: '默认用均衡；觉得反应慢换清脆，觉得太生硬换柔和。',
      },
    },
    {
      id: 'ui.feedbackEvent', page: 'sound', tier: 2, domain: 'ui', pattern: true,
      label: '各事件音色与独立音量', purpose: '分别设置按下、松开、完成、取消、拥挤失败的声音。',
      type: 'group',
      subFields: [
        { key: 'press', label: '按下', hasOriginal: true },
        { key: 'release', label: '松开', hasOriginal: true },
        { key: 'success', label: '完成提示', hasOriginal: true },
        { key: 'cancelled', label: '取消提示', hasOriginal: false },
        { key: 'failed', label: '拥挤失败提示', hasOriginal: false },
      ],
      defaultValue: '按下/松开/完成为「现有音效」；取消与拥挤失败为「静音」；各事件独立音量 0.8',
      defaultSource: 'desktop/ui/preferences-v3.js:4',
      store: 'ui-state.json', key: 'dshw-v3-feedback.events.<event>', emptyValue: '缺事件按默认补',
      read: 'localStorage 读取', write: 'localStorage → whale-save-storage',
      dependsOn: ['size.vol'], hotReload: 'immediate',
      help: {
        use: '让不同事件用不同声音，提示「完成」和「拥挤失败」听得出来。',
        adjust: '每个事件两行：音色可选「现有音效」（仅按下/松开/完成）或珍珠、水泡、风铃、静音；独立音量 0 到 1。',
        apply: '立即生效。',
        recommend: '按下与松开用「现有音效」+ 0.8；完成提示用风铃；拥挤失败保持静音或用水泡。',
        example: '按下独立音量 0.8、点击音量 0.9 → 实际输出 0.72；选了静音则强制为 0。',
      },
    },
    {
      id: 'ui.pos', page: 'position', tier: 2, domain: 'ui',
      label: '挂件位置', purpose: '记录鲸鱼停靠在桌面的哪个位置。',
      type: 'position',
      defaultValue: '右下角', defaultSource: 'assets/whale-widget.js:4454',
      store: 'ui-state.json', key: 'dshw-pos', emptyValue: '留空按右下角处理',
      read: 'localStorage 读取', write: 'localStorage → whale-save-storage',
      dependsOn: ['ui.snap'], hotReload: 'immediate',
      help: {
        use: '拖动鲸鱼时会自动记住位置，这里只用来查看和复位。',
        adjust: '直接拖动即可，或点「移回右下角」复位。',
        apply: '拖动结束立即保存。',
        recommend: '不需要手动设置，拖到你顺手的位置就行。',
      },
    },
    {
      id: 'ui.snap', page: 'position', tier: 2, domain: 'ui',
      label: '自动贴边与翻转', purpose: '控制鲸鱼靠近屏幕边缘时的吸附范围和朝向翻转。',
      type: 'snap',
      defaultValue: '比例模式：左右 10%、下 15%、上 0%；翻转线 50%',
      defaultSource: 'assets/whale-widget.js:3763',
      store: 'ui-state.json', key: 'dshw-snap', emptyValue: '留空按默认比例处理',
      read: 'localStorage 读取', write: 'localStorage → whale-save-storage',
      dependsOn: ['ui.pos'], hotReload: 'immediate',
      help: {
        use: '拖到靠近边缘时自动吸附摆正，走到屏幕另一半时自动翻转朝向。',
        adjust: '三档模式：按比例、按像素、关闭。比例模式下左右各 10%、下 15%、上 0%；像素模式下左右各 80 像素、四边翻转线为 -1（即默认不翻转）。翻转线 F 表示走到屏幕宽度的百分之几时翻面。',
        apply: '立即生效。',
        recommend: '多显示器或经常拖到边角时用比例模式；希望完全手动控制就关闭。',
        example: '比例模式下把左边吸附设为 20，鲸鱼在屏幕左侧 20% 范围内会贴左边。',
      },
    },

    // ── 提醒与声音域：usage-settings.json ───────────────────────────────────
    {
      id: 'usage.taskEndOn', page: 'sound', tier: 1, domain: 'usage',
      label: '完成提醒', purpose: '任务结束后用气泡、声音或两者一起提醒。',
      type: 'combo', comboOf: ['size.turnCostOn', 'usage.taskEnd.on'],
      defaultValue: '气泡和声音', defaultSource: 'runtime/ledger.mjs:157',
      store: 'usage-settings.json + .dshw-size.json', key: 'taskEnd.on / turnCostOn', emptyValue: '缺省气泡开、声音关',
      read: 'GET /api/sound-settings',
      write: 'POST /api/sound-settings',
      dependsOn: ['size.bubbleOn'], hotReload: 'immediate',
      help: {
        use: '决定一轮任务跑完后你会被怎么通知。这是常用组合，一个下拉就够了。',
        adjust: '三选一：关闭（都不提示）、仅气泡（只显示用量）、气泡和声音（都开）。',
        apply: '立即生效。',
        recommend: '专注写代码时选「气泡和声音」；跑长批处理时选「关闭」。',
      },
    },
    {
      id: 'usage.taskEndSel', page: 'sound', tier: 2, domain: 'usage',
      label: '完成提示音', purpose: '选择任务结束时播放的声音。',
      type: 'select',
      options: [
        { value: 'preset:duck:press', label: '小黄鸭·按下' },
        { value: 'preset:duck:release', label: '小黄鸭·松开' },
        { value: 'preset:fx1:press', label: '音效1·按下' },
        { value: 'preset:fx1:release', label: '音效1·松开' },
      ],
      defaultValue: 'preset:duck:press', defaultSource: 'runtime/ledger.mjs:157',
      store: 'usage-settings.json', key: 'taskEnd.sel', emptyValue: '空表示使用声音编辑器的回退选项',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['usage.taskEndOn'], hotReload: 'immediate',
      help: {
        use: '决定「完成了」这一声长什么样。',
        adjust: '下拉会列出全部音效组（点按）、内置预设和你导入的音频片段。值分三类：grp:音效组、preset:内置、frag:自定义片段。',
        apply: '立即生效。',
        recommend: '和按下音区分开，选一个音色差异大的，比如风铃。',
      },
    },
    {
      id: 'usage.taskEndVol', page: 'sound', tier: 2, domain: 'usage',
      label: '完成提示音量', purpose: '单独调节任务完成音的响度。',
      type: 'range', unit: '百分比', min: 0, max: 1, step: 0.01,
      defaultValue: '跟随点击音量', defaultSource: 'runtime/ledger.mjs:157',
      store: 'usage-settings.json', key: 'taskEnd.vol / taskEnd.volSet', emptyValue: 'volSet 为 false 时跟随点击音量',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['usage.taskEndOn', 'size.vol'], hotReload: 'immediate',
      help: {
        use: '完成提示通常应该比点击音更轻或更重，这个开关就是单独调它。',
        adjust: '拖动即设为独立音量；打开独立后不再跟随点击音量。实际输出 = 完成音量 × 0（静音时）。',
        apply: '立即生效。',
        recommend: '先保持跟随；觉得完成提示太吵再单独调到 0.5 左右。',
      },
    },
    {
      id: 'usage.alertOn', page: 'api', tier: 2, domain: 'usage',
      label: '余额预警', purpose: 'API 余额低于阈值时提醒。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: 'alert.on', emptyValue: '缺省按 true 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['ui.accountView', 'size.bubbleOn'], hotReload: 'after-save',
      help: {
        use: '余额快用完时先提醒，避免扣费中断。',
        adjust: '开关。阈值单独设置，金额按 API 币种计算。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '按 API key 计费时务必打开。',
      },
    },
    {
      id: 'usage.alertBelow', page: 'api', tier: 2, domain: 'usage',
      label: '余额预警阈值', purpose: '余额低于多少时触发预警。',
      type: 'number', unit: '与 API 同币种', min: 0, step: 0.01,
      defaultValue: 5, defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: 'alert.below', emptyValue: '0 表示不预警',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['usage.alertOn'], hotReload: 'after-save',
      help: {
        use: '余额掉到这个数以下就提醒你充值。',
        adjust: '非负数。填 0 等于关闭这条提醒。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '按你一次充值的量估一个月消耗的十分之一作为阈值。',
      },
    },
    {
      id: 'usage.budgetOn', page: 'api', tier: 2, domain: 'usage',
      label: '每日预算提醒', purpose: '当天观测到的用量超过预算时提醒。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/ledger.mjs:182',
      store: 'usage-settings.json', key: 'budget.on', emptyValue: '缺省按 true 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['ui.accountView', 'size.bubbleOn'], hotReload: 'after-save',
      help: {
        use: '防止某天跑飞了花超。',
        adjust: '开关。这只是提醒，不会拦截任何调用，也不是硬限额。',
        apply: '保存后用于下一次用量观测。',
        recommend: '用 API key 且偶尔跑大任务时打开。',
      },
    },
    {
      id: 'usage.budgetAmount', page: 'api', tier: 2, domain: 'usage',
      label: '每日预算阈值', purpose: '当天用量超过多少时提醒。',
      type: 'number', unit: '与 API 同币种', min: 0, step: 0.01,
      defaultValue: 10, defaultSource: 'runtime/ledger.mjs:182',
      store: 'usage-settings.json', key: 'budget.amount', emptyValue: '0 表示不提醒',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['usage.budgetOn'], hotReload: 'after-save',
      help: {
        use: '一天花到这个数就提醒你收一收。',
        adjust: '非负数。金额按 API 币种，和余额预警用的是同一个币种。',
        apply: '保存后用于下一次用量观测。',
        recommend: '先设成你日均预算的 1.5 倍作为预警线。',
      },
    },
    {
      id: 'usage.alertMsg', page: 'api', tier: 2, domain: 'usage',
      label: '提醒文字', purpose: '自定义预警与预算提醒的文案。',
      type: 'message',
      defaultValue: '余额已低于 {currency}{below} / 今日已观测用量达到 {currency}{amount}',
      defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: 'alert.msg / budget.msg', emptyValue: '留空按默认文案',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: [], hotReload: 'after-save',
      help: {
        use: '改你在提醒里看到的句子。',
        adjust: '纯文本。变量：{currency} 币种符号、{below} 余额阈值、{amount} 预算阈值。',
        apply: '保存后用于下一次提醒。',
        recommend: '保留 {currency} 和阈值变量，只改固定文字。',
        example: '余额快没了：{currency}{below}，赶紧续费',
      },
    },
    {
      id: 'usage.alertAutoClose', page: 'api', tier: 2, domain: 'usage',
      label: '预警自动关闭', purpose: '控制余额预警和预算提醒是否自动消失。',
      type: 'boolean',
      defaultValue: false, defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: 'alert.autoClose / budget.autoClose', emptyValue: '缺省按 false 处理',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.bubbleOn'], hotReload: 'after-save',
      help: {
        use: '预警气泡不自动关的话会一直挂在桌面上，直到你手动关掉。',
        adjust: '开关，两种提醒共用一个设置。',
        apply: '保存后用于下一次提醒。',
        recommend: '开启，余额预警是最容易被忽略的信息。',
      },
    },
    {
      id: 'usage.alertTtlSec', page: 'api', tier: 2, domain: 'usage',
      label: '预警停留秒数', purpose: '预警气泡自动关闭前的停留时间。',
      type: 'number', unit: '秒', min: 0, max: 3600, step: 1,
      defaultValue: 6, defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: 'alert.ttlSec / budget.ttlSec', emptyValue: '0 表示不自动关闭',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['usage.alertAutoClose'], hotReload: 'after-save',
      help: {
        use: '决定预警挂多久。',
        adjust: '0 到 3600 秒。只有在「预警自动关闭」打开时才起作用。注意它的单位是秒，和「任务用量提示显示多久」一样，但两者互不影响。',
        apply: '保存后用于下一次提醒。',
        recommend: '6 秒偏短，建议 8–10 秒。',
      },
    },
    {
      id: 'usage.reminderModules', page: 'api', tier: 2, domain: 'usage', pattern: true,
      label: '提醒气泡内容与样式', purpose: '自定义任务用量、余额预警、预算提醒三类气泡的模块。',
      type: 'group',
      subFields: [
        { key: 'turnCost.lines', label: '任务用量提示' },
        { key: 'alert.lines', label: '余额预警' },
        { key: 'budget.lines', label: '每日预算提醒' },
      ],
      defaultValue: '任务用量 3 行、余额预警 4 行、预算提醒 2 行',
      defaultSource: 'runtime/ledger.mjs:176',
      store: 'usage-settings.json', key: '<domain>.lines', emptyValue: '提交空数组表示清空该组',
      read: 'GET /api/sound-settings', write: 'POST /api/sound-settings',
      dependsOn: ['size.bubbleOn'], hotReload: 'after-save',
      help: {
        use: '改提醒气泡里显示哪些内容、按什么样式排。',
        adjust: '每一行是一个模块，类型有文字、图片、链接。文字支持变量 {turn_title}、{turn_primary}、{turn_detail}、{currency}、{below}、{amount}。数组是整体替换的：提交新的行会覆盖该组原有的全部行。',
        apply: '保存后用于下一次该类提醒。',
        recommend: '先只调颜色和字号，别动行数；行数变了容易放不下。',
        example: '把任务用量第一行改成 {turn_title} 之外的内容，其余两行保持不动。',
      },
    },

    // ── API 主配置域：api-settings.json ─────────────────────────────────────
    {
      id: 'api.provider', page: 'api', tier: 2, domain: 'api',
      label: '余额接口', purpose: '选择用哪种方式读取 API 余额。',
      type: 'select',
      options: [
        { value: 'auto', label: '自动识别当前 API（推荐）' },
        { value: 'billing', label: '兼容账单接口' },
        { value: 'newapi', label: '兼容密钥额度接口' },
        { value: 'custom-json', label: '自定义 JSON 余额接口' },
        { value: 'deepseek', label: '原生余额接口' },
      ],
      defaultValue: 'auto', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'provider', emptyValue: '留空按 auto 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['ui.accountView'], hotReload: 'after-save',
      help: {
        use: '决定去哪里读余额。自动识别会沿用你 Codex 当前的配置。',
        adjust: '五选一。只有当你的服务商不在自动识别的范围内时才需要手动选。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '保持「自动识别」。',
      },
    },
    {
      id: 'api.baseUrl', page: 'api', tier: 2, domain: 'api', private: true,
      label: 'API 地址', purpose: '指定余额接口的根地址。',
      type: 'url',
      defaultValue: '留空表示沿用 Codex 当前配置', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'baseUrl', emptyValue: '留空表示跟随 Codex',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: [], hotReload: 'after-save',
      help: {
        use: '换了服务商或自建中转时，指定去哪里读余额。',
        adjust: '完整地址，必须是 https（本机 127.0.0.1 和局域网地址可以用 http）。不能带密钥、查询参数或片段。',
        apply: '保存后按新地址查询。',
        recommend: '不确定就别填，保持跟随 Codex。',
      },
    },
    {
      id: 'api.keyEnv', page: 'api', tier: 2, domain: 'api', private: true,
      label: '密钥环境变量名', purpose: '告诉挂件从哪个已有环境变量读取密钥。',
      type: 'text',
      defaultValue: '留空使用 Codex 的现有密钥', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'keyEnv', emptyValue: '留空表示使用默认',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.baseUrl'], hotReload: 'after-save',
      help: {
        use: '当你的密钥不在 Codex 默认变量里时，告诉挂件去哪儿找。',
        adjust: '只填变量名，例如 MY_API_KEY，**不要填密钥本身**。这个名字必须已经存在于系统环境里。',
        apply: '保存后按该变量名查找。',
        recommend: '换个域名就必须换成该服务专用的变量，不能沿用旧的。',
      },
    },
    {
      id: 'api.profile', page: 'api', tier: 2, domain: 'api', private: true,
      label: 'Codex 配置方案', purpose: '指定读取哪一个 Codex profile。',
      type: 'text',
      defaultValue: '默认方案', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'profile', emptyValue: '留空使用默认方案',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: [], hotReload: 'restart',
      help: {
        use: '你有多份 Codex 配置时要读非默认的那份。',
        adjust: '填 profile 名称，最多 128 字符。',
        apply: '需要重载后生效。',
        recommend: '只有一个配置方案时留空。',
      },
    },
    {
      id: 'api.projectDir', page: 'api', tier: 2, domain: 'api', private: true,
      label: '项目目录', purpose: '从指定目录里的 .codex/config.toml 读取配置。',
      type: 'text',
      defaultValue: '留空读取当前配置', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'projectDir', emptyValue: '留空使用当前目录',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.profile'], hotReload: 'restart',
      help: {
        use: '在同一个机器上用不同项目的配置时使用。',
        adjust: '填该项目的绝对路径，目录里需要有 .codex/config.toml。相对路径无效。',
        apply: '需要重载后生效。',
        recommend: '不需要就留空，默认读当前项目的配置。',
      },
    },
    {
      id: 'api.currency', page: 'api', tier: 2, domain: 'api',
      label: '自定义金额币种', purpose: '指定接口返回金额的币种代码。',
      type: 'text', unit: '三位大写字母', maxlength: 3,
      defaultValue: 'USD', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'currency', emptyValue: '留空按 USD 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '让余额数字带上正确的货币单位。',
        adjust: '三位大写字母，例如 USD、CNY、JPY。兼容账单接口固定为 USD。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '不确定就用 USD，再用「显示币种」做换算显示。',
      },
    },
    {
      id: 'api.balancePath', page: 'api', tier: 2, domain: 'api', private: true,
      label: '余额路径', purpose: '自定义接口里余额数据的请求路径。',
      type: 'text',
      defaultValue: '由服务商模板决定', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'balancePath', emptyValue: '留空使用服务商默认',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '自建中转接口路径和常见服务商不一样时使用。',
        adjust: '以 / 开头的路径，例如 /api/account/balance。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '用「自定义 JSON 余额接口」时才需要填。',
      },
    },
    {
      id: 'api.balanceField', page: 'api', tier: 2, domain: 'api', private: true,
      label: '余额字段', purpose: '指定余额在返回 JSON 里的位置。',
      type: 'text',
      defaultValue: 'data.balance', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'balanceField', emptyValue: '留空按 data.balance 处理',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.balancePath'], hotReload: 'after-save',
      help: {
        use: '接口返回结构不同时，告诉挂件去哪取余额数字。',
        adjust: '点号分隔的路径，只能用字母数字、下划线、点和短横线，例如 data.balance。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '「恢复默认」会把它重置为 data.balance。',
      },
    },
    {
      id: 'api.usedField', page: 'api', tier: 2, domain: 'api', private: true,
      label: '累计消耗字段', purpose: '指定累计已用金额在返回 JSON 里的位置。',
      type: 'text',
      defaultValue: '留空表示不读取累计消耗', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'usedField', emptyValue: '留空表示该接口不提供累计消耗',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.balanceField'], hotReload: 'after-save',
      help: {
        use: '接口能给出累计消耗时，用来算日用量。',
        adjust: '点号分隔路径。留空表示这个接口只能给余额，用量得靠余额差值推算。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '接口文档里有 used / total_used 这类字段才填。',
      },
    },
    {
      id: 'api.balanceScale', page: 'api', tier: 2, domain: 'api',
      label: '金额换算系数', purpose: '把接口返回的原始数字换算成真实金额。',
      type: 'number', min: 0.000000001, step: 'any',
      defaultValue: 1, defaultSource: 'runtime/config.mjs:10',
      store: 'api-settings.json', key: 'balanceScale', emptyValue: '留空按 1 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['api.balanceField'], hotReload: 'after-save',
      help: {
        use: '有些接口返回的是分、微单位或 token 计数，需要换算。',
        adjust: '正数，范围 1e-9 到 1e12。真实金额 = 返回值 × 本系数。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '默认 1。接口以「分」为单位时填 0.01。',
        example: '接口返回 12345 且单位是分，填 0.01 后显示 123.45。',
      },
    },
    {
      id: 'api.billingUsageDivisor', page: 'api', tier: 2, domain: 'api',
      label: '账单用量除数', purpose: '把账单接口的用量数值还原成真实量。',
      type: 'number', min: 0.000001, step: 'any',
      defaultValue: 100, defaultSource: 'runtime/config.mjs:11',
      store: 'api-settings.json', key: 'billingUsageDivisor', emptyValue: '留空按 100 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '账单接口常把用量放大 100 倍返回。',
        adjust: '正数，范围 1e-6 到 1e12。真实用量 = 返回值 ÷ 本项。',
        apply: '保存后用于下一次用量观测。',
        recommend: '按接口文档填；以「分」为单位返回时是 100。',
      },
    },
    {
      id: 'api.quotaPerUnit', page: 'api', tier: 2, domain: 'api',
      label: '每货币单位的 quota', purpose: '把原始 quota 换算成金额。',
      type: 'number', min: 0.000001, step: 'any',
      defaultValue: 500000, defaultSource: 'runtime/config.mjs:11',
      store: 'api-settings.json', key: 'quotaPerUnit', emptyValue: '留空按 500000 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '只有返回原始 quota 的接口才需要它。',
        adjust: '正数，范围 1e-6 到 1e12。金额 = quota ÷ 本项。',
        apply: '保存后用于下一次余额刷新。',
        recommend: '500000 是常见默认值，按服务商文档调整。',
      },
    },
    {
      id: 'api.dashboardUrl', page: 'api', tier: 2, domain: 'api', private: true,
      label: '账单页面地址', purpose: '点提醒气泡里的链接时打开的页面。',
      type: 'url',
      defaultValue: '留空使用当前服务商', defaultSource: 'runtime/config.mjs:9',
      store: 'api-settings.json', key: 'dashboardUrl', emptyValue: '留空使用服务商默认',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '余额预警气泡里那个链接点开后去哪里充值或看账单。',
        adjust: '完整 https 地址。',
        apply: '保存后用于下一次点击链接。',
        recommend: '大多数情况让服务商默认值就够。',
      },
    },
    {
      id: 'api.monitorSessions', page: 'api', tier: 2, domain: 'api',
      label: '记录本机 token 与任务状态', purpose: '让挂件知道你每轮任务用了多少。',
      type: 'boolean',
      defaultValue: true, defaultSource: 'runtime/config.mjs:12',
      store: 'api-settings.json', key: 'monitorSessions', emptyValue: '缺省按 true 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: [], hotReload: 'restart',
      help: {
        use: '开启后才能显示本轮 token、任务完成提醒和用量气泡。订阅和 API 两种模式都依赖它。',
        adjust: '开关。关闭后不再统计 token，但余额本身还能显示。',
        apply: '需要重载后生效。',
        recommend: '保持开启。它只读取本机 Codex 的 token 记录，不发送聊天内容。',
      },
    },
    {
      id: 'api.refreshSeconds', page: 'api', tier: 2, domain: 'api',
      label: '余额刷新间隔', purpose: '多久重新读一次 API 余额。',
      type: 'number', unit: '秒', min: 15, max: 3600, step: 1,
      defaultValue: 60, defaultSource: 'runtime/config.mjs:12',
      store: 'api-settings.json', key: 'refreshSeconds', emptyValue: '留空按 60 处理',
      read: 'GET /api/config', write: 'PUT /api/config',
      dependsOn: ['ui.accountView'], hotReload: 'after-save',
      help: {
        use: '余额是定时拉取的，不是实时的。',
        adjust: '15 到 3600 秒。',
        apply: '保存后用于下一次刷新。',
        recommend: '保持 60 秒。太频繁没有意义，部分服务商还有频率限制。',
      },
    },
    {
      id: 'api.models', page: 'api', tier: 2, domain: 'api', pattern: true, private: true,
      label: '主接口每轮费用估算价格', purpose: '按模型单价把本轮 token 换算成金额。',
      type: 'group',
      subFields: [
        { key: 'input', label: '输入价格' },
        { key: 'cachedInput', label: '缓存命中价格' },
        { key: 'output', label: '输出价格' },
        { key: 'cacheWrite', label: '缓存写入价格（可选）' },
      ],
      defaultValue: '空表示不估算，按观测到的扣费显示',
      defaultSource: 'runtime/config.mjs:12',
      store: 'api-settings.json', key: 'models.<model>', emptyValue: '留空保留全部现有价格',
      read: 'GET /api/config（只返回已配置标记）', write: 'PUT /api/config（pricingUpdate）',
      dependsOn: ['api.provider', 'api.currency'], hotReload: 'after-save',
      help: {
        use: '没配价格时，显示的是本轮期间观测到的 API 扣费，可能包含同密钥的其他调用。配了价格才按你的 token 记录精确估算。',
        adjust: '单位是每百万 token，币种用上面的自定义金额币种。必须同时填输入、缓存命中、输出三项，缓存写入可选。模型名称要和 Codex 里完全一致。',
        apply: '保存后用于下一次用量估算。',
        recommend: '只给常用模型配价格；模型名写错会导致永远匹配不上。',
        example: '只更新 gpt-5 的价格，其他模型不动。',
      },
    },
    {
      id: 'api.customModels', page: 'api', tier: 2, domain: 'apiModels', pattern: true,
      label: '独立 API 模型', purpose: '为每个 API 模型单独配置接口、提醒、价格和额度。',
      type: 'group',
      subFields: [
        { key: 'template', label: '服务商模板' },
        { key: 'name', label: '显示名称' },
        { key: 'currency', label: '币种' },
        { key: 'keyEnv', label: '密钥环境变量名' },
        { key: 'baseUrl', label: 'API 地址' },
        { key: 'balanceUrl', label: '余额查询地址' },
        { key: 'balanceField', label: '余额字段' },
        { key: 'usedField', label: '累计消耗字段' },
        { key: 'scale', label: '金额换算系数' },
        { key: 'matchIds', label: '用量匹配模型名' },
        { key: 'alerts.balance', label: '余额预警阈值' },
        { key: 'alerts.dailyTokens', label: '每日 token 阈值' },
        { key: 'alerts.dailyBudget', label: '每日预算' },
        { key: 'alerts.quotaRemainingBelow', label: '剩余 quota 阈值' },
        { key: 'messages.balance', label: '余额提醒文字' },
        { key: 'messages.budget', label: '预算提醒文字' },
        { key: 'messages.quota', label: 'quota 提醒文字' },
        { key: 'prices.input', label: '输入价格' },
        { key: 'prices.cached', label: '缓存价格' },
        { key: 'prices.output', label: '输出价格' },
        { key: 'manualQuota', label: '手动额度' },
        { key: 'bubbleSettings', label: '提醒气泡内容' },
      ],
      defaultValue: '由所选服务商模板提供',
      defaultSource: 'runtime/api-models.mjs:6',
      store: 'api-models.json', key: 'models[<id>].<field>', emptyValue: '多数字段留空保留原值；价格和阈值留空会清除',
      read: 'GET /api/models', write: 'PUT /api/models',
      dependsOn: ['api.provider'], hotReload: 'after-save',
      help: {
        use: '想同时盯多个 API 服务商时用。34 个服务商模板任选。',
        adjust: '表单里的字段名和保存后的字段名不完全一致：表单填 balanceBelow / dailyTokens / dailyBudget / quotaRemainingBelow，保存后变成 alerts.below / alerts.dailyTokens / alerts.dailyBudget / alerts.quotaRemainingBelow；表单的 inputPrice / cachedPrice / outputPrice 保存后变成 prices.input / prices.cached / prices.output。切换模板会把该模型其他字段重置为模板默认值。',
        apply: '保存后用于下一次该模型的查询。',
        recommend: '先选模板、测试通过，再改价格和提醒。',
        example: '删除一个模型的价格：把对应价格三项清空再保存。',
      },
    },
    {
      id: 'api.manualQuota', page: 'api', tier: 2, domain: 'apiModels', pattern: true,
      label: '手动额度', purpose: '当接口不返回剩余额度时，由你手填一个数字。',
      type: 'group',
      subFields: [
        { key: 'remaining', label: '剩余额度' },
        { key: 'total', label: '总额度' },
        { key: 'mode', label: '计算方式' },
        { key: 'period', label: '周期' },
      ],
      defaultValue: '未设置', defaultSource: 'runtime/api-models.mjs:105',
      store: 'api-models.json', key: 'manualQuota', emptyValue: '清空该组即删除手动额度',
      read: 'GET /api/models', write: 'PUT /api/models',
      dependsOn: ['api.customModels'], hotReload: 'after-save',
      help: {
        use: '某些服务商只给总额不给余额。你可以按自己的消耗填一个剩余值，它会覆盖接口显示。',
        adjust: '计算方式 manual 或 auto；周期 none、daily 或 weekly。daily 按当天 0 点重置，weekly 按本周一重置。',
        apply: '保存后用于下一次显示。',
        recommend: '知道这个数是手填的，不要当成官方余额。',
      },
    },
  ];

  // 气泡与素材域：这些是复杂编辑器，本轮通过「回到挂件细调」桥接到鲸鱼自身的弹层。
  // 这里仍然登记它们的 ID 模式和子字段，保证文档与说明不遗漏。
  const PATTERNS = [
    {
      id: 'bubble.sequences', page: 'bubble', tier: 2, domain: 'bubble', pattern: true, bridged: true,
      label: '气泡点击序列', purpose: '点击鲸鱼时依次弹出哪些气泡。',
      subFields: [
        { key: 'items', label: 'API 模式序列' },
        { key: 'subscriptionItems', label: '订阅模式序列' },
        { key: 'tapAdvance', label: 'API 模式点击切换' },
        { key: 'subscriptionTapAdvance', label: '订阅模式点击切换' },
      ],
      defaultValue: '由内置默认序列决定', defaultSource: 'assets/whale-widget.js:1362',
      store: '.dshw-bubble.json', key: 'items / subscriptionItems', emptyValue: '空数组表示清空该模式序列',
      read: 'GET /dsh-whale/bubble.json', write: 'POST /dsh-whale/bubble.json',
      dependsOn: ['size.bubbleOn'], hotReload: 'after-save',
      help: {
        use: '两种模式各有一套序列，切换模式不会互相覆盖。',
        adjust: '在挂件的「自定义泡泡」编辑器里调整，序列是一串气泡模块。',
        apply: '保存后用于下一次点击。',
        recommend: '把常用的放前面：余额、额度、状态。',
      },
    },
    {
      id: 'bubble.lib', page: 'bubble', tier: 2, domain: 'bubble', pattern: true, bridged: true,
      label: '气泡模块库', purpose: '可以复用的气泡内容片段。',
      subFields: [
        { key: 'type', label: '模块类型' },
        { key: 'layout', label: '布局' },
        { key: 'color', label: '颜色' },
        { key: 'size', label: '字号' },
        { key: 'weight', label: '随机权重' },
        { key: 'modelId', label: '绑定模型' },
      ],
      defaultValue: '空', defaultSource: 'assets/whale-widget.js:5517',
      store: '.dshw-bubble.json', key: 'lib', emptyValue: '空数组表示清空模块库',
      read: 'GET /dsh-whale/bubble.json', write: 'POST /dsh-whale/bubble.json',
      dependsOn: ['bubble.sequences'], hotReload: 'after-save',
      help: {
        use: '把常用的一段气泡内容存起来，之后一键插入，不用每次重打。',
        adjust: '模块类型有文字、图片、链接、随机、额度等，各自有布局、颜色、字号、随机权重和模型绑定等子项。',
        apply: '保存后用于下一次编辑序列。',
        recommend: '先把序列调顺，再把稳定的片段存进模块库。',
      },
    },
    {
      id: 'media.roles', page: 'media', tier: 2, domain: 'media', pattern: true, bridged: true,
      label: '角色素材', purpose: '鲸鱼形象图片库。',
      subFields: [
        { key: 'id', label: '素材 ID' },
        { key: 'format', label: '格式' },
        { key: 'name', label: '名称' },
        { key: 'pinned', label: '置顶' },
        { key: 'order', label: '排序' },
      ],
      defaultValue: '内置角色', defaultSource: 'lib/widget-host.mjs:193',
      store: 'whale-roles/roles.json', key: 'roles[<id>]', emptyValue: '删除素材需要用户明确确认',
      read: 'GET /dsh-whale/roles.json', write: 'POST /dsh-whale/role-pin.json / role-delete.json',
      dependsOn: ['ui.role'], hotReload: 'after-save',
      help: {
        use: '存放你导入的角色图片。支持 PNG / GIF / APNG，导入时可以裁切和翻转。',
        adjust: '导入、置顶、排序、删除。删除会二次确认。',
        apply: '导入后需要选中才生效，导入不等于已选择。',
        recommend: '单张不超过 20 MB，最多 256 个素材，总占用 256 MB 以内。',
      },
    },
    {
      id: 'media.audio', page: 'media', tier: 2, domain: 'media', pattern: true, bridged: true,
      label: '音效素材', purpose: '音效组和音频片段库。',
      subFields: [
        { key: 'groups', label: '音效组' },
        { key: 'press', label: '按下引用' },
        { key: 'release', label: '松开引用' },
        { key: 'fragments', label: '音频片段' },
      ],
      defaultValue: '内置 duck / fx1', defaultSource: 'lib/widget-host.mjs:34',
      store: 'whale-audio/audio.json', key: 'groups / fragments', emptyValue: '删除素材需要用户明确确认',
      read: 'GET /dsh-whale/audio.json', write: 'POST /dsh-whale/audio.json',
      dependsOn: ['size.soundSet'], hotReload: 'after-save',
      help: {
        use: '一个音效组包含按下和松开两段声音，可以整体切换。',
        adjust: '可以上传音频片段并裁切，再组装成音效组。内置素材不能删也不能改。',
        apply: '保存后用于下一次播放。',
        recommend: '先在音效组编辑器里试听，满意再设为主音效组。',
      },
    },
    {
      id: 'media.bubbleImgs', page: 'media', tier: 2, domain: 'media', pattern: true, bridged: true,
      label: '气泡图片', purpose: '气泡里可以引用的图片库。',
      subFields: [
        { key: 'id', label: '图片 ID' },
        { key: 'name', label: '名称' },
        { key: 'pinned', label: '置顶' },
      ],
      defaultValue: '内置图片', defaultSource: 'lib/widget-host.mjs:52',
      store: 'whale-bubble-imgs/bubble-imgs.json', key: 'bubbleImgs[<id>]', emptyValue: '删除素材需要用户明确确认',
      read: 'GET /dsh-whale/bubble-imgs.json', write: 'POST /dsh-whale/bubble-img-upload.json',
      dependsOn: ['bubble.lib'], hotReload: 'after-save',
      help: {
        use: '给气泡的图片模块提供素材。',
        adjust: '上传、置顶、删除。单张不超过 8 MB，最多 256 个。',
        apply: '保存后用于下一次渲染。',
        recommend: '图片会按模块里的缩放设置显示，别用超大图。',
      },
    },
    {
      id: 'media.workshop', page: 'media', tier: 2, domain: 'media', bridged: true,
      label: '素材包导入导出', purpose: '把角色、图片、音频打包带走或迁移。',
      type: 'action',
      defaultValue: '—', defaultSource: 'lib/workshop.mjs:28',
      store: '（即时操作，不落配置）', key: '—', emptyValue: '—',
      read: 'GET /api/workshop/export', write: 'POST /api/workshop/import',
      dependsOn: [], hotReload: 'after-save',
      help: {
        use: '导出一个 JSON 包，含角色、气泡图片、音频片段和音效组四类。',
        adjust: '即时操作，不属于配置。包格式标识 api-balance-whale-workshop，当前版本 1，单包不超过 24 MB。',
        apply: '导入是即时的，取消不会产生误保存。',
        recommend: '导入包不等于已经选中其中的角色，导入后还要去角色页选一次。',
      },
    },
  ];

  const ALL = FIELDS.concat(PATTERNS);
  const byId = new Map(ALL.map(field => [field.id, field]));

  const HELP_KEYS = ['use', 'adjust', 'apply', 'recommend'];
  // 「什么时候生效」本来就允许一句话回答（立即生效），其余三项必须说清实质内容。
  const HELP_MIN_LENGTH = { use: 8, adjust: 8, apply: 2, recommend: 6 };
  // 通用兜底文案一旦出现就说明该字段的说明没写完，覆盖检查会拒绝它。
  // 标记一律用不会出现在正常说明里的多字短语：单字标记会误伤，
  // 「略」会命中「策略」「忽略」，「自行」会命中任何正常句子。
  const GENERIC_HELP = [
    '调整此项', '同上', '自行查看', '自行查阅', '详见源码', '见源码',
    'TODO', '待补充', '待完善', '占位', '暂未实现',
  ];
  const containsGeneric = (text, marker) => String(text).includes(marker);

  const catalog = {
    version: 1,
    pages: PAGES,
    fields: ALL,
    helpKeys: HELP_KEYS,
    helpMinLength: HELP_MIN_LENGTH,
    genericHelpMarkers: GENERIC_HELP,
    containsGeneric,
    byId,
    /** 某分类下该展示的字段，按目录顺序。 */
    forPage(pageId) { return ALL.filter(field => field.page === pageId); },
    /** 一级快捷菜单直接展示的字段。 */
    tier1() { return ALL.filter(field => field.tier === 1); },
    /** 需要画布、只能回到挂件里细调的字段。 */
    bridged() { return ALL.filter(field => field.bridged); },
    /** 逐字段校验，供测试和文档生成器使用。 */
    validate() {
      const problems = [];
      const seen = new Set();
      for (const field of ALL) {
        if (seen.has(field.id)) problems.push({ id: field.id, problem: '重复的 setting ID' });
        seen.add(field.id);
        if (!PAGES.some(page => page.id === field.page)) problems.push({ id: field.id, problem: `未知分类 ${field.page}` });
        if (!field.label) problems.push({ id: field.id, problem: '缺少 label' });
        if (!field.purpose) problems.push({ id: field.id, problem: '缺少 purpose' });
        if (!field.defaultSource || !/^[^:]+:\d+$/.test(field.defaultSource)) {
          problems.push({ id: field.id, problem: `defaultSource 必须写成 file:line，实际 ${field.defaultSource}` });
        }
        const help = field.help;
        if (!help) { problems.push({ id: field.id, problem: '缺少 help' }); continue; }
        for (const key of HELP_KEYS) {
          if (!help[key] || !String(help[key]).trim()) problems.push({ id: field.id, problem: `help.${key} 为空` });
          else if (String(help[key]).trim().length < HELP_MIN_LENGTH[key]) {
            problems.push({ id: field.id, problem: `help.${key} 过短，疑似占位` });
          }
        }
        for (const key of HELP_KEYS) {
          const text = help && help[key] ? String(help[key]) : '';
          for (const marker of GENERIC_HELP) {
            if (containsGeneric(text, marker)) problems.push({ id: field.id, problem: `help.${key} 含通用兜底文案「${marker}」` });
          }
        }
        if (field.pattern && (!Array.isArray(field.subFields) || !field.subFields.length)) {
          problems.push({ id: field.id, problem: '动态条目必须列出 subFields' });
        }
        for (const sub of field.subFields || []) {
          if (!sub.key || !sub.label) problems.push({ id: field.id, problem: `subField 缺少 key 或 label：${JSON.stringify(sub)}` });
        }
      }
      return problems;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  if (typeof globalThis !== 'undefined') globalThis.WhaleSettingsCatalog = catalog;
})();
