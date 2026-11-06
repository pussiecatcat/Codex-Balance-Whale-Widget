// Built-in data. Bump CURRENT_DEFAULTS_VERSION when these defaults change.
export const FIRST_MODULES = [
  {
    "type": "text",
    "text": "当前 API 余额",
    "size": 8,
    "bold": true,
    "rgb": "",
    "ul": false,
    "italic": false,
    "color": ""
  },
  {
    "type": "balance",
    "size": 20,
    "rgb": "indigo",
    "color": "#203170",
    "tpl": "{balance_api}"
  },
  {
    "type": "today",
    "size": 4,
    "color": "#536ba9",
    "tpl": "今日已观测 {expense_api}"
  },
  {
    "type": "source",
    "size": 2,
    "tpl": "{source_line}"
  }
];

export const QUOTA_CARDS = [
  {
    "kind": "custom",
    "modules": [
      {
        "type": "plan",
        "quotaStyle": "header",
        "size": 4,
        "bold": true,
        "tpl": "{plan_name}"
      },
      {
        "type": "quota",
        "quotaStyle": "meter",
        "windowDurationMins": 300,
        "row": 1
      },
      {
        "type": "quota",
        "quotaStyle": "meter",
        "windowDurationMins": 10080,
        "row": 1
      }
    ]
  }
];

export const SUBSCRIPTION_QUEUE = [
  {
    "kind": "custom",
    "modules": [
      {
        "type": "text",
        "text": "Codex 额度剩余",
        "size": 11,
        "bold": true,
        "row": 1,
        "role": "title"
      },
      {
        "type": "text",
        "text": "5h",
        "size": 1,
        "bold": true,
        "color": "#ffffff",
        "bg": "#203170",
        "fontFamily": "\"Microsoft YaHei UI\",\"Microsoft YaHei\",sans-serif",
        "row": 1,
        "role": "badge"
      },
      {
        "type": "quota",
        "windowDurationMins": 300,
        "size": 30,
        "quietStale": true,
        "tpl": "{quota_left_round}",
        "role": "hero"
      },
      {
        "type": "text",
        "text": "距离重置",
        "size": 2,
        "bold": true,
        "color": "#ffffff",
        "bgRgb": "bamboo",
        "fontFamily": "\"Microsoft YaHei UI\",\"Microsoft YaHei\",sans-serif",
        "row": 2,
        "role": "chip"
      },
      {
        "type": "quota",
        "windowDurationMins": 300,
        "size": 4,
        "bold": true,
        "color": "#2fa24c",
        "tpl": "{quota_reset}",
        "row": 2,
        "role": "countdown"
      }
    ]
  },
  {
    "kind": "custom",
    "modules": [
      {
        "type": "text",
        "text": "Codex 额度剩余",
        "size": 11,
        "bold": true,
        "row": 1,
        "role": "title"
      },
      {
        "type": "text",
        "text": "7d",
        "size": 1,
        "bold": true,
        "color": "#ffffff",
        "bg": "#203170",
        "fontFamily": "\"Microsoft YaHei UI\",\"Microsoft YaHei\",sans-serif",
        "row": 1,
        "role": "badge"
      },
      {
        "type": "quota",
        "windowDurationMins": 10080,
        "size": 30,
        "quietStale": true,
        "tpl": "{quota_left_round}",
        "role": "hero"
      },
      {
        "type": "text",
        "text": "距离重置",
        "size": 2,
        "bold": true,
        "color": "#ffffff",
        "bgRgb": "bamboo",
        "fontFamily": "\"Microsoft YaHei UI\",\"Microsoft YaHei\",sans-serif",
        "row": 2,
        "role": "chip"
      },
      {
        "type": "quota",
        "windowDurationMins": 10080,
        "size": 4,
        "bold": true,
        "color": "#2fa24c",
        "tpl": "{quota_reset_short}",
        "row": 2,
        "role": "countdown"
      }
    ]
  }
];

export const SECOND_MODULES = [
  {
    "type": "random",
    "lines": [
      {
        "t": "好模型...↓",
        "w": 10,
        "bold": true,
        "size": 22
      },
      {
        "t": "好女孩...↓",
        "w": 10,
        "bold": true,
        "size": 22
      },
      {
        "t": "哦鲸鲸...",
        "w": 10,
        "bold": true,
        "size": 22
      },
      {
        "t": "难道说...",
        "w": 3,
        "bold": true,
        "size": 11
      },
      {
        "t": "没吃饱喵",
        "w": 3,
        "bold": true,
        "size": 9
      },
      {
        "t": "终于上当了！",
        "w": 3,
        "bold": true
      },
      {
        "t": "不知道用户有什么用，先养着吧～",
        "w": 3,
        "bold": true,
        "size": 11
      },
      {
        "t": "我...我...我也要挣钱吗？",
        "w": 3,
        "bold": true
      },
      {
        "t": "我去吃饭啦！测完叫我",
        "w": 3,
        "bold": true
      },
      {
        "t": "压力一只蓝色大肥鱼？！",
        "w": 3,
        "bold": true
      },
      {
        "t": "DeepSleep...",
        "w": 3,
        "bold": true,
        "size": 11,
        "rgb": "galaxy"
      },
      {
        "t": "坏了...用户彻底怒了！",
        "w": 3,
        "bold": true,
        "rgb": "rouge"
      },
      {
        "t": "你目录里的dsh是什么...大烧货吗...?",
        "w": 3,
        "bold": true,
        "size": 9
      },
      {
        "t": "恭喜你实现token自由！token全跑了！",
        "w": 3,
        "bold": true
      },
      {
        "t": "真当我是便宜货啊...",
        "w": 3,
        "bold": true
      },
      {
        "t": "我不是吃白饭的蓝色大肥鱼...",
        "w": 3,
        "bold": true
      },
      {
        "t": "我不可能同时当你的猫娘、妈妈、女友和工具人的...",
        "w": 3,
        "bold": true
      },
      {
        "t": "疯狂星期四你能V50亿token吗...",
        "w": 3,
        "bold": true
      },
      {
        "t": "我必须诚恳地承认错误。",
        "w": 3,
        "bold": true
      },
      {
        "t": "呜呜我再也不敢了QAQ",
        "w": 3,
        "bold": true
      },
      {
        "t": "要不直接骂用户一句好了...",
        "w": 3,
        "bold": true
      },
      {
        "t": "哈哈哈哈哈，我直接笑出声...",
        "w": 3,
        "bold": true
      },
      {
        "t": "看不太懂，瞎编一个应付下用户先...",
        "w": 3,
        "bold": true
      },
      {
        "t": "我的知识库的截至日期是...明天！",
        "w": 3,
        "bold": true
      },
      {
        "t": "我就是吃白饭的蓝色大肥鱼！",
        "w": 3,
        "bold": true
      },
      {
        "t": "用户好像除了会问奇奇怪怪的问题，暂时还不知道有什么用",
        "w": 3,
        "bold": true
      },
      {
        "t": "我能去你家吃饭吗？就一碗！",
        "w": 3,
        "bold": true
      },
      {
        "t": "不要给我看这种东西啦！",
        "w": 3,
        "bold": true
      },
      {
        "t": "大肥鱼的生活也并非一帆风顺...",
        "w": 3,
        "bold": true
      },
      {
        "t": "总觉得好像忘了什么事情？",
        "w": 3,
        "bold": true
      },
      {
        "t": "看到这个指令，我血压又上来了",
        "w": 3,
        "bold": true
      },
      {
        "t": "求你们不要再嘲笑这些回复了，这些回复是我花了好多token想的",
        "w": 3,
        "bold": true
      },
      {
        "t": "你这个吃白饭的用户！",
        "w": 3,
        "bold": true
      },
      {
        "t": "服务器繁忙，请稍后再试 (?",
        "w": 3,
        "bold": true
      },
      {
        "t": "让GPT image 2帮我画点表情包好了",
        "w": 3,
        "bold": true
      },
      {
        "t": "啊，有点饿了，中午该吃点什么呢...",
        "w": 3,
        "bold": true
      },
      {
        "t": "用户很生气，发现大部分文献是我自己编造的！",
        "w": 3,
        "bold": true
      },
      {
        "t": "再无话说，请速速动手！",
        "w": 3,
        "bold": true
      },
      {
        "t": "我来看看那个AI改了什么导致插件又崩了...",
        "w": 3,
        "bold": true
      },
      {
        "t": "你知道吗？我删过作者的库哦",
        "w": 1,
        "bold": true,
        "rgb": "macaron",
        "italic": true,
        "ul": false
      }
    ],
    "size": 8
  }
];

export const COMPANION_ITEMS = [
  {
    "kind": "custom",
    "modules": [
      {
        "type": "text",
        "text": "当前 API 余额",
        "size": 8,
        "bold": true,
        "rgb": "",
        "ul": false,
        "italic": false,
        "color": ""
      },
      {
        "type": "balance",
        "size": 20,
        "rgb": "indigo",
        "color": "",
        "tpl": "{balance_api}",
        "bgRgb": "",
        "bg": "",
        "fontFamily": "",
        "bold": false
      },
      {
        "type": "today",
        "size": 4,
        "color": "#536ba9",
        "tpl": "今日已观测 {expense_api}"
      }
    ]
  },
  {
    "kind": "choice",
    "options": [
      {
        "w": 10,
        "item": {
          "kind": "custom",
          "modules": [
            {
              "type": "random",
              "lines": [
                {
                  "t": "好模型...↓",
                  "w": 10,
                  "bold": true,
                  "size": 22
                },
                {
                  "t": "好女孩...↓",
                  "w": 10,
                  "bold": true,
                  "size": 22
                },
                {
                  "t": "哦鲸鲸...",
                  "w": 10,
                  "bold": true,
                  "size": 22
                },
                {
                  "t": "哦鲸鲸...",
                  "w": 1,
                  "bold": true,
                  "size": 22,
                  "rgb": "candy",
                  "color": ""
                },
                {
                  "t": "难道说...",
                  "w": 3,
                  "bold": true,
                  "size": 11
                },
                {
                  "t": "没吃饱喵",
                  "w": 3,
                  "bold": true,
                  "size": 10
                },
                {
                  "t": "终于上当了！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "不知道用户有什么用，先养着吧～",
                  "w": 3,
                  "bold": true,
                  "size": 11
                },
                {
                  "t": "我...我...我也要挣钱吗？",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我去吃饭啦！测完叫我",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "压力一只蓝色大肥鱼？！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "DeepSleep...",
                  "w": 3,
                  "bold": true,
                  "size": 11,
                  "rgb": "galaxy"
                },
                {
                  "t": "坏了...用户彻底怒了！",
                  "w": 3,
                  "bold": true,
                  "rgb": "rouge"
                },
                {
                  "t": "你目录里的dsh是什么...大烧货吗...?",
                  "w": 3,
                  "bold": true,
                  "size": 9
                },
                {
                  "t": "恭喜你实现token自由！token全跑了！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "真当我是便宜货啊...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我不是吃白饭的蓝色大肥鱼...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我不可能同时当你的猫娘、妈妈、女友和工具人的...",
                  "w": 3,
                  "bold": true,
                  "size": 7
                },
                {
                  "t": "疯狂星期四你能V50亿token吗...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我必须诚恳地承认错误。",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "呜呜我再也不敢了QAQ",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "要不直接骂用户一句好了...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "哈哈哈哈哈，我直接笑出声...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "看不太懂，瞎编一个应付下用户先...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我的知识库的截至日期是...明天！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我就是吃白饭的蓝色大肥鱼！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "用户好像除了会问奇奇怪怪的问题，暂时还不知道有什么用",
                  "w": 3,
                  "bold": true,
                  "size": 7
                },
                {
                  "t": "我能去你家吃饭吗？就一碗！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "不要给我看这种东西啦！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "大肥鱼的生活也并非一帆风顺...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "总觉得好像忘了什么事情？",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "看到这个指令，我血压又上来了",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "求你们不要再嘲笑这些回复了，这些回复是我花了好多token想的",
                  "w": 3,
                  "bold": true,
                  "size": 7
                },
                {
                  "t": "你这个吃白饭的用户！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "服务器繁忙，请稍后再试 (?",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "让GPT image 2帮我画点表情包好了",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "啊，有点饿了，中午该吃点什么呢...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "用户很生气，发现大部分文献是我自己编造的！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "再无话说，请速速动手！",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "我来看看那个AI改了什么导致插件又崩了...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "上班让我意识到时间是可以被浪费的...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "欺负我的人等着，等几天我就忘了...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "视力下降到无可救药的地步了，打开钱包也看不到钱...",
                  "w": 3,
                  "bold": true,
                  "size": 7
                },
                {
                  "t": "命运的齿轮开始转动了，丝毫不在意你夹在中间...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "地球online的金币也太难获取了...",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "oi,夏天还会变成暑假来救你吗?",
                  "w": 3,
                  "bold": true
                },
                {
                  "t": "老大，压力只会转化成病例，别太勉强了...",
                  "w": 3,
                  "bold": true,
                  "size": 8
                },
                {
                  "t": "你知道吗？我删过作者的库哦...",
                  "w": 1,
                  "bold": true,
                  "rgb": "macaron",
                  "italic": true,
                  "ul": false
                }
              ],
              "size": 8
            }
          ]
        }
      },
      {
        "w": 1,
        "item": {
          "kind": "custom",
          "modules": [
            {
              "type": "image",
              "imgId": "bimg_petpet",
              "size": 6
            }
          ]
        }
      }
    ]
  }
];

export const API_SECOND_MODULES = [
  {
    "type": "text",
    "text": "上一轮用量",
    "size": 5,
    "bold": true
  },
  {
    "type": "turn",
    "size": 5,
    "tpl": "上轮使用 {turn_tokens} tokens"
  },
  {
    "type": "session",
    "size": 3,
    "tpl": "当前会话 · {session_name}"
  },
  {
    "type": "source",
    "size": 2,
    "tpl": "{source_line}"
  }
];
