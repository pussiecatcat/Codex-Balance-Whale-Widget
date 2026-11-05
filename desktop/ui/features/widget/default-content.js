// Built-in bubble content and editor draft rules. No DOM or persisted state.
var BUBBLE_KIND_LABEL = {
  normal: '余额内容',
  random: '随机语句',
  custom: '自定义内容'
};
export function bubbleDefaultFirstModules() {
  return [{
    type: "text",
    text: "当前 API 余额",
    size: 8,
    bold: true,
    rgb: "",
    ul: false,
    italic: false,
    color: ""
  }, {
    type: "balance",
    size: 20,
    rgb: "indigo",
    color: "#203170",
    tpl: "{balance_api}"
  }, {
    type: "today",
    size: 4,
    color: "#536ba9",
    tpl: "今日已观测 {expense_api}"
  }, {
    type: "source",
    size: 2,
    tpl: "{source_line}"
  }];
}
export function bubbleDefaultQuotaCards() {
  // The previous two-column tide cards. Kept as a preset, not the default.
  return [{ kind: 'custom', modules: [
    { type: 'plan', quotaStyle: 'header', size: 4, bold: true, tpl: '{plan_name}' },
    { type: 'quota', quotaStyle: 'meter', windowDurationMins: 300, row: 1 },
    { type: 'quota', quotaStyle: 'meter', windowDurationMins: 10080, row: 1 }
  ] }];
}

function bubbleSingleQuotaStep(minutes, label) {
  // Layout D: one large number per click, with the other window available on
  // the next click. No cards, no meter, no plan header.
  return { kind: 'custom', modules: [
    // 层次与 API 余额气泡一致：标题 8、靛蓝大数字 20、说明 4、来源 2。
    { type: 'text', text: label + '剩余', size: 8, bold: true },
    { type: 'quota', windowDurationMins: minutes, size: 20, rgb: 'indigo', tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: minutes, size: 4, tpl: '{quota_reset_short}后重置' },
    { type: 'source', size: 2, tpl: '{source_line}' }
  ] };
}

export function bubbleDefaultSubscriptionQueue() {
  return [bubbleSingleQuotaStep(300, '5 小时'), bubbleSingleQuotaStep(10080, '每周')];
}
export function bubbleLegacySubscriptionDefault(items) {
  try {
    if (!Array.isArray(items) || items.length !== 1 || !Array.isArray(items[0].modules)) return false;
    var modules = items[0].modules;
    if (modules.some(function (m) { return m && m.type === 'quota' && String(m.tpl || '').indexOf('{quota_source}') >= 0; })) return true;
    // The previous three-module default stacked the two gauges on separate
    // rows, which pushed the lower card outside the bubble body.
    if (modules.length === 3) {
      var plan = modules[0], short = modules[1], weekly = modules[2];
      var isPlan = plan && plan.type === 'plan' && plan.quotaStyle === 'header' && !plan.apiModelId && String(plan.tpl || '{plan_name}') === '{plan_name}';
      var isMeter = function (m, minutes, row) {
        return m && m.type === 'quota' && m.quotaStyle === 'meter' && !m.apiModelId &&
          m.windowDurationMins === minutes && m.row === row && !m.tpl;
      };
      return !!(isPlan && isMeter(short, 300, 1) && isMeter(weekly, 10080, 2));
    }
    if (modules.length !== 7) return false;
    var quotaModules = modules.filter(function (m) { return m && m.type === 'quota'; });
    var quotaTemplates = quotaModules.map(function (m) { return String(m.tpl || ''); }).sort().join('|');
    return quotaModules.length === 6 &&
      quotaModules.filter(function (m) { return m.windowDurationMins === 300; }).length === 3 &&
      quotaModules.filter(function (m) { return m.windowDurationMins === 10080; }).length === 3 &&
      quotaTemplates === ['5 小时', '每周', '距离重置 {quota_reset_short}', '距离重置 {quota_reset_short}', '{quota_left_round}', '{quota_left_round}'].sort().join('|');
  } catch (err) { return false; }
}

// ==== [气泡默认内容] ====
export function bubbleDefaultRandomLines() {
  return [{
    t: "好模型...↓",
    w: 10,
    bold: true,
    size: 22
  }, {
    t: "好女孩...↓",
    w: 10,
    bold: true,
    size: 22
  }, {
    t: "哦鲸鲸...",
    w: 10,
    bold: true,
    size: 22
  }, {
    t: "难道说...",
    w: 3,
    bold: true,
    size: 11
  }, {
    t: "没吃饱喵",
    w: 3,
    bold: true,
    size: 9
  }, {
    t: "终于上当了！",
    w: 3,
    bold: true
  }, {
    t: "不知道用户有什么用，先养着吧～",
    w: 3,
    bold: true,
    size: 11
  }, {
    t: "我...我...我也要挣钱吗？",
    w: 3,
    bold: true
  }, {
    t: "我去吃饭啦！测完叫我",
    w: 3,
    bold: true
  }, {
    t: "压力一只蓝色大肥鱼？！",
    w: 3,
    bold: true
  }, {
    t: "DeepSleep...",
    w: 3,
    bold: true,
    size: 11,
    rgb: "galaxy"
  }, {
    t: "坏了...用户彻底怒了！",
    w: 3,
    bold: true,
    rgb: "rouge"
  }, {
    t: "你目录里的dsh是什么...大烧货吗...?",
    w: 3,
    bold: true,
    size: 9
  }, {
    t: "恭喜你实现token自由！token全跑了！",
    w: 3,
    bold: true
  }, {
    t: "真当我是便宜货啊...",
    w: 3,
    bold: true
  }, {
    t: "我不是吃白饭的蓝色大肥鱼...",
    w: 3,
    bold: true
  }, {
    t: "我不可能同时当你的猫娘、妈妈、女友和工具人的...",
    w: 3,
    bold: true
  }, {
    t: "疯狂星期四你能V50亿token吗...",
    w: 3,
    bold: true
  }, {
    t: "我必须诚恳地承认错误。",
    w: 3,
    bold: true
  }, {
    t: "呜呜我再也不敢了QAQ",
    w: 3,
    bold: true
  }, {
    t: "要不直接骂用户一句好了...",
    w: 3,
    bold: true
  }, {
    t: "哈哈哈哈哈，我直接笑出声...",
    w: 3,
    bold: true
  }, {
    t: "看不太懂，瞎编一个应付下用户先...",
    w: 3,
    bold: true
  }, {
    t: "我的知识库的截至日期是...明天！",
    w: 3,
    bold: true
  }, {
    t: "我就是吃白饭的蓝色大肥鱼！",
    w: 3,
    bold: true
  }, {
    t: "用户好像除了会问奇奇怪怪的问题，暂时还不知道有什么用",
    w: 3,
    bold: true
  }, {
    t: "我能去你家吃饭吗？就一碗！",
    w: 3,
    bold: true
  }, {
    t: "不要给我看这种东西啦！",
    w: 3,
    bold: true
  }, {
    t: "大肥鱼的生活也并非一帆风顺...",
    w: 3,
    bold: true
  }, {
    t: "总觉得好像忘了什么事情？",
    w: 3,
    bold: true
  }, {
    t: "看到这个指令，我血压又上来了",
    w: 3,
    bold: true
  }, {
    t: "求你们不要再嘲笑这些回复了，这些回复是我花了好多token想的",
    w: 3,
    bold: true
  }, {
    t: "你这个吃白饭的用户！",
    w: 3,
    bold: true
  }, {
    t: "服务器繁忙，请稍后再试 (?",
    w: 3,
    bold: true
  }, {
    t: "让GPT image 2帮我画点表情包好了",
    w: 3,
    bold: true
  }, {
    t: "啊，有点饿了，中午该吃点什么呢...",
    w: 3,
    bold: true
  }, {
    t: "用户很生气，发现大部分文献是我自己编造的！",
    w: 3,
    bold: true
  }, {
    t: "再无话说，请速速动手！",
    w: 3,
    bold: true
  }, {
    t: "我来看看那个AI改了什么导致插件又崩了...",
    w: 3,
    bold: true
  }, {
    t: "你知道吗？我删过作者的库哦",
    w: 1,
    bold: true,
    rgb: "macaron",
    italic: true,
    ul: false
  }];
}
export function bubbleDefaultSecondModules() {
  return [{
    type: "random",
    lines: [{
      t: "好模型...↓",
      w: 10,
      bold: true,
      size: 22
    }, {
      t: "好女孩...↓",
      w: 10,
      bold: true,
      size: 22
    }, {
      t: "哦鲸鲸...",
      w: 10,
      bold: true,
      size: 22
    }, {
      t: "难道说...",
      w: 3,
      bold: true,
      size: 11
    }, {
      t: "没吃饱喵",
      w: 3,
      bold: true,
      size: 9
    }, {
      t: "终于上当了！",
      w: 3,
      bold: true
    }, {
      t: "不知道用户有什么用，先养着吧～",
      w: 3,
      bold: true,
      size: 11
    }, {
      t: "我...我...我也要挣钱吗？",
      w: 3,
      bold: true
    }, {
      t: "我去吃饭啦！测完叫我",
      w: 3,
      bold: true
    }, {
      t: "压力一只蓝色大肥鱼？！",
      w: 3,
      bold: true
    }, {
      t: "DeepSleep...",
      w: 3,
      bold: true,
      size: 11,
      rgb: "galaxy"
    }, {
      t: "坏了...用户彻底怒了！",
      w: 3,
      bold: true,
      rgb: "rouge"
    }, {
      t: "你目录里的dsh是什么...大烧货吗...?",
      w: 3,
      bold: true,
      size: 9
    }, {
      t: "恭喜你实现token自由！token全跑了！",
      w: 3,
      bold: true
    }, {
      t: "真当我是便宜货啊...",
      w: 3,
      bold: true
    }, {
      t: "我不是吃白饭的蓝色大肥鱼...",
      w: 3,
      bold: true
    }, {
      t: "我不可能同时当你的猫娘、妈妈、女友和工具人的...",
      w: 3,
      bold: true
    }, {
      t: "疯狂星期四你能V50亿token吗...",
      w: 3,
      bold: true
    }, {
      t: "我必须诚恳地承认错误。",
      w: 3,
      bold: true
    }, {
      t: "呜呜我再也不敢了QAQ",
      w: 3,
      bold: true
    }, {
      t: "要不直接骂用户一句好了...",
      w: 3,
      bold: true
    }, {
      t: "哈哈哈哈哈，我直接笑出声...",
      w: 3,
      bold: true
    }, {
      t: "看不太懂，瞎编一个应付下用户先...",
      w: 3,
      bold: true
    }, {
      t: "我的知识库的截至日期是...明天！",
      w: 3,
      bold: true
    }, {
      t: "我就是吃白饭的蓝色大肥鱼！",
      w: 3,
      bold: true
    }, {
      t: "用户好像除了会问奇奇怪怪的问题，暂时还不知道有什么用",
      w: 3,
      bold: true
    }, {
      t: "我能去你家吃饭吗？就一碗！",
      w: 3,
      bold: true
    }, {
      t: "不要给我看这种东西啦！",
      w: 3,
      bold: true
    }, {
      t: "大肥鱼的生活也并非一帆风顺...",
      w: 3,
      bold: true
    }, {
      t: "总觉得好像忘了什么事情？",
      w: 3,
      bold: true
    }, {
      t: "看到这个指令，我血压又上来了",
      w: 3,
      bold: true
    }, {
      t: "求你们不要再嘲笑这些回复了，这些回复是我花了好多token想的",
      w: 3,
      bold: true
    }, {
      t: "你这个吃白饭的用户！",
      w: 3,
      bold: true
    }, {
      t: "服务器繁忙，请稍后再试 (?",
      w: 3,
      bold: true
    }, {
      t: "让GPT image 2帮我画点表情包好了",
      w: 3,
      bold: true
    }, {
      t: "啊，有点饿了，中午该吃点什么呢...",
      w: 3,
      bold: true
    }, {
      t: "用户很生气，发现大部分文献是我自己编造的！",
      w: 3,
      bold: true
    }, {
      t: "再无话说，请速速动手！",
      w: 3,
      bold: true
    }, {
      t: "我来看看那个AI改了什么导致插件又崩了...",
      w: 3,
      bold: true
    }, {
      t: "你知道吗？我删过作者的库哦",
      w: 1,
      bold: true,
      rgb: "macaron",
      italic: true,
      ul: false
    }],
    size: 8
  }];
}
var BUBBLE_DEFAULT_ITEMS = [{
  "kind": "custom",
  "modules": [{
    "type": "text",
    "text": "当前 API 余额",
    "size": 8,
    "bold": true,
    "rgb": "",
    "ul": false,
    "italic": false,
    "color": ""
  }, {
    "type": "balance",
    "size": 20,
    "rgb": "indigo",
    "color": "",
    "tpl": "{balance_api}",
    "bgRgb": "",
    "bg": "",
    "fontFamily": "",
    "bold": false
  }, {
    "type": "today",
    "size": 4,
    "color": "#536ba9",
    "tpl": "今日已观测 {expense_api}"
  }]
}, {
  "kind": "choice",
  "options": [{
    "w": 10,
    "item": {
      "kind": "custom",
      "modules": [{
        "type": "random",
        "lines": [{
          "t": "好模型...↓",
          "w": 10,
          "bold": true,
          "size": 22
        }, {
          "t": "好女孩...↓",
          "w": 10,
          "bold": true,
          "size": 22
        }, {
          "t": "哦鲸鲸...",
          "w": 10,
          "bold": true,
          "size": 22
        }, {
          "t": "哦鲸鲸...",
          "w": 1,
          "bold": true,
          "size": 22,
          "rgb": "candy",
          "color": ""
        }, {
          "t": "难道说...",
          "w": 3,
          "bold": true,
          "size": 11
        }, {
          "t": "没吃饱喵",
          "w": 3,
          "bold": true,
          "size": 10
        }, {
          "t": "终于上当了！",
          "w": 3,
          "bold": true
        }, {
          "t": "不知道用户有什么用，先养着吧～",
          "w": 3,
          "bold": true,
          "size": 11
        }, {
          "t": "我...我...我也要挣钱吗？",
          "w": 3,
          "bold": true
        }, {
          "t": "我去吃饭啦！测完叫我",
          "w": 3,
          "bold": true
        }, {
          "t": "压力一只蓝色大肥鱼？！",
          "w": 3,
          "bold": true
        }, {
          "t": "DeepSleep...",
          "w": 3,
          "bold": true,
          "size": 11,
          "rgb": "galaxy"
        }, {
          "t": "坏了...用户彻底怒了！",
          "w": 3,
          "bold": true,
          "rgb": "rouge"
        }, {
          "t": "你目录里的dsh是什么...大烧货吗...?",
          "w": 3,
          "bold": true,
          "size": 9
        }, {
          "t": "恭喜你实现token自由！token全跑了！",
          "w": 3,
          "bold": true
        }, {
          "t": "真当我是便宜货啊...",
          "w": 3,
          "bold": true
        }, {
          "t": "我不是吃白饭的蓝色大肥鱼...",
          "w": 3,
          "bold": true
        }, {
          "t": "我不可能同时当你的猫娘、妈妈、女友和工具人的...",
          "w": 3,
          "bold": true,
          "size": 7
        }, {
          "t": "疯狂星期四你能V50亿token吗...",
          "w": 3,
          "bold": true
        }, {
          "t": "我必须诚恳地承认错误。",
          "w": 3,
          "bold": true
        }, {
          "t": "呜呜我再也不敢了QAQ",
          "w": 3,
          "bold": true
        }, {
          "t": "要不直接骂用户一句好了...",
          "w": 3,
          "bold": true
        }, {
          "t": "哈哈哈哈哈，我直接笑出声...",
          "w": 3,
          "bold": true
        }, {
          "t": "看不太懂，瞎编一个应付下用户先...",
          "w": 3,
          "bold": true
        }, {
          "t": "我的知识库的截至日期是...明天！",
          "w": 3,
          "bold": true
        }, {
          "t": "我就是吃白饭的蓝色大肥鱼！",
          "w": 3,
          "bold": true
        }, {
          "t": "用户好像除了会问奇奇怪怪的问题，暂时还不知道有什么用",
          "w": 3,
          "bold": true,
          "size": 7
        }, {
          "t": "我能去你家吃饭吗？就一碗！",
          "w": 3,
          "bold": true
        }, {
          "t": "不要给我看这种东西啦！",
          "w": 3,
          "bold": true
        }, {
          "t": "大肥鱼的生活也并非一帆风顺...",
          "w": 3,
          "bold": true
        }, {
          "t": "总觉得好像忘了什么事情？",
          "w": 3,
          "bold": true
        }, {
          "t": "看到这个指令，我血压又上来了",
          "w": 3,
          "bold": true
        }, {
          "t": "求你们不要再嘲笑这些回复了，这些回复是我花了好多token想的",
          "w": 3,
          "bold": true,
          "size": 7
        }, {
          "t": "你这个吃白饭的用户！",
          "w": 3,
          "bold": true
        }, {
          "t": "服务器繁忙，请稍后再试 (?",
          "w": 3,
          "bold": true
        }, {
          "t": "让GPT image 2帮我画点表情包好了",
          "w": 3,
          "bold": true
        }, {
          "t": "啊，有点饿了，中午该吃点什么呢...",
          "w": 3,
          "bold": true
        }, {
          "t": "用户很生气，发现大部分文献是我自己编造的！",
          "w": 3,
          "bold": true
        }, {
          "t": "再无话说，请速速动手！",
          "w": 3,
          "bold": true
        }, {
          "t": "我来看看那个AI改了什么导致插件又崩了...",
          "w": 3,
          "bold": true
        }, {
          "t": "上班让我意识到时间是可以被浪费的...",
          "w": 3,
          "bold": true
        }, {
          "t": "欺负我的人等着，等几天我就忘了...",
          "w": 3,
          "bold": true
        }, {
          "t": "视力下降到无可救药的地步了，打开钱包也看不到钱...",
          "w": 3,
          "bold": true,
          "size": 7
        }, {
          "t": "命运的齿轮开始转动了，丝毫不在意你夹在中间...",
          "w": 3,
          "bold": true
        }, {
          "t": "地球online的金币也太难获取了...",
          "w": 3,
          "bold": true
        }, {
          "t": "oi,夏天还会变成暑假来救你吗?",
          "w": 3,
          "bold": true
        }, {
          "t": "老大，压力只会转化成病例，别太勉强了...",
          "w": 3,
          "bold": true,
          "size": 8
        }, {
          "t": "你知道吗？我删过作者的库哦...",
          "w": 1,
          "bold": true,
          "rgb": "macaron",
          "italic": true,
          "ul": false
        }],
        "size": 8
      }]
    }
  }, {
    "w": 1,
    "item": {
      "kind": "custom",
      "modules": [{
        "type": "image",
        "imgId": "bimg_petpet",
        "size": 6
      }]
    }
  }]
}];
export function bubbleParseDefaultItems() {
  try {
    return JSON.parse(JSON.stringify(BUBBLE_DEFAULT_ITEMS));
  } catch (err) {
    return [];
  }
}
export function bubbleDefaultApiSecondModules() {
  return [
    { type: 'text', text: '上一轮用量', size: 5, bold: true },
    { type: 'turn', size: 5, tpl: '上轮使用 {turn_tokens} tokens' },
    { type: 'session', size: 3, tpl: '当前会话 · {session_name}' },
    { type: 'source', size: 2, tpl: '{source_line}' }
  ];
}
export function bubbleDefaultQueue(isSubscription = false) {
  if (isSubscription) return bubbleDefaultSubscriptionQueue();
  return [
    { kind: 'custom', modules: bubbleDefaultFirstModules() },
    { kind: 'custom', modules: bubbleDefaultApiSecondModules() }
  ];
}
export function bubbleDefaultCompanionQueue(isSubscription = false) {
  if (!isSubscription) return bubbleParseDefaultItems();
  return [
    { kind: 'custom', modules: bubbleDefaultSubscriptionQueue()[0].modules },
    { kind: 'custom', modules: bubbleDefaultSecondModules() }
  ];
}
export function bubblePresetItems(name, isSubscription = false) {
  if (name === 'minimal') {
    return [{
      kind: 'custom',
      modules: isSubscription
        ? [{ type: 'quota', quotaStyle: 'meter', windowDurationMins: 300 }]
        : [{ type: 'balance', size: 20, rgb: 'indigo', color: '#203170', tpl: '{balance_api}' }]
    }];
  }
  if (name === 'companion') return bubbleDefaultCompanionQueue(isSubscription);
  if (name === 'quota-cards') return isSubscription ? bubbleDefaultQuotaCards() : bubbleDefaultQueue(false);
  if (name === 'quota') return isSubscription ? bubbleDefaultSubscriptionQueue() : bubbleDefaultQueue(false);
  if (isSubscription) return bubbleDefaultSubscriptionQueue();
  return bubbleDefaultQueue(false);
}
export function bubbleKindLabel(kind) {
  return BUBBLE_KIND_LABEL[kind === 'random' ? 'random' : kind === 'custom' ? 'custom' : 'normal'];
}
export function bubbleDefaultModules(kind) {
  if (kind === 'random') return bubbleDefaultSecondModules();
  if (kind === 'normal') return bubbleDefaultFirstModules();
  return [{
    type: 'text',
    text: '新内容',
    size: 6
  }];
}
export function bubbleModuleSummary(m) {
  m = m || ({});
  if (m.type === 'quota') return m.windowDurationMins === 10080 ? '每周额度' : '5 小时额度';
  if (m.type === 'turn') return '上轮 token 用量';
  if (m.type === 'plan') return 'Codex 套餐';
  if (m.type === 'session') return '当前会话';
  if (m.type === 'peak' || m.type === 'nextpeak') return 'DeepSeek 峰谷时段';
  if (m.type === 'balance') return '余额数值';
  if (m.type === 'today') return '今日已观测';
  if (m.type === 'image') return '图片/动图';
  if (m.type === 'randimg') return '随机图片' + (m.imgs && m.imgs.length ? '(' + m.imgs.length + '张)' : '(空)');
  if (m.type === 'random') return '随机语句' + (m.lines && m.lines.length ? '(' + m.lines.length + '条)' : '(空)');
  if (m.type === 'link') return '超链接: ' + (String(m.text || '').slice(0, 14) || '打开链接');
  return '文本: ' + String(m.text || '').slice(0, 14);
}
export function bubbleModuleListLabel(m) {
  m = m || ({});
  if (m.type === 'quota') return m.windowDurationMins === 10080 ? '每周额度' : '5 小时额度';
  if (m.type === 'turn') return '上轮 token 用量';
  if (m.type === 'plan') return 'Codex 套餐';
  if (m.type === 'session') return '当前会话';
  if (m.type === 'peak' || m.type === 'nextpeak') return 'DeepSeek 峰谷时段';
  if (m.type === 'text') return '文本: ' + (String(m.text || '').slice(0, 24) || '(空)');
  if (m.type === 'link') return '超链接: ' + (String(m.text || '').slice(0, 24) || '打开链接');
  if (m.type === 'random') return m.name || '随机语句';
  if (m.type === 'balance') return '余额数值';
  if (m.type === 'today') return '今日已观测';
  if (m.type === 'image') return '图片/动图';
  if (m.type === 'randimg') return '随机图片' + (m.imgs && m.imgs.length ? '(' + m.imgs.length + '张)' : '(空)');
  return '模块';
}
export function bubbleEditEnsureModules(item) {
  if (Array.isArray(item.modules)) return;
  if (item.kind === 'custom') {
    item.modules = [];
    return;
  }
  item.modules = bubbleDefaultModules(item.kind);
}
export function bubbleRowLabel(it) {
  if (it.modules && it.modules.length) return bubbleKindLabel('custom') + ' · ' + it.modules.length + '个模块';
  return bubbleKindLabel(it.kind);
}
export function bubbleIsChoice(step) {
  return !!(step && step.kind === 'choice');
}
export function bubbleChoiceOptions(step) {
  return step && step.kind === 'choice' && Array.isArray(step.options) ? step.options : [];
}
export function bubbleChoiceWeight(o) {
  return Math.min(99, Math.max(1, Math.round(Number(o && o.w) || 1)));
}
export function bubblePickChoiceItem(step, random = Math.random) {
  const options = bubbleChoiceOptions(step);
  if (!options.length) return null;
  let total = 0;
  for (const option of options) total += bubbleChoiceWeight(option);
  const threshold = random() * total;
  let accumulated = 0;
  for (const option of options) {
    accumulated += bubbleChoiceWeight(option);
    if (threshold < accumulated) return option?.item || null;
  }
  return options[options.length - 1]?.item || null;
}
export function bubbleSingleFromItem(itm) {
  return {
    kind: 'custom',
    modules: itm && Array.isArray(itm.modules) ? itm.modules : []
  };
}
export function bubbleStepToBubble(step) {
  if (bubbleIsChoice(step)) {
    var o0 = bubbleChoiceOptions(step)[0];
    step = o0 ? o0.item : null;
  }
  var mods = step && Array.isArray(step.modules) ? step.modules : bubbleDefaultModules(step && step.kind === 'random' ? 'random' : 'normal');
  return {
    kind: 'custom',
    modules: JSON.parse(JSON.stringify(mods))
  };
}
