import path from 'node:path';
import { readJson, writeJson } from './paths.mjs';
import { cleanUrl } from './config.mjs';
import { readBoundedBodyText } from './bounded-body.mjs';

const noBalance = (name, currency, keyEnv, probeUrl = '', matchIds = []) => ({ name, currency, keyEnv, noBalanceApi: true, probeUrl, matchIds });
export const API_TEMPLATES = Object.freeze({
  deepseek:{name:'DeepSeek',currency:'CNY',keyEnv:'DEEPSEEK_API_KEY',balance:{url:'https://api.deepseek.com/user/balance',remaining:'balance_infos[0].total_balance'}},
  openrouter:{name:'OpenRouter',currency:'USD',keyEnv:'OPENROUTER_API_KEY',balance:{url:'https://openrouter.ai/api/v1/credits',total:'data.total_credits',used:'data.total_usage'}},
  siliconflow_cn:noBalance('硅基流动（CN）','CNY','SILICONFLOW_API_KEY','https://api.siliconflow.cn/v1/models',['siliconflow','Qwen','deepseek-ai']),
  siliconflow_en:noBalance('硅基流动（EN）','USD','SILICONFLOW_API_KEY','https://api.siliconflow.com/v1/models',['siliconflow','Qwen','deepseek-ai']),
  moonshot:{name:'Kimi / Moonshot（CN）',currency:'CNY',keyEnv:'MOONSHOT_API_KEY',balance:{url:'https://api.moonshot.cn/v1/users/me/balance',remaining:'data.available_balance'},probeUrl:'https://api.moonshot.cn/v1/models',matchIds:['moonshot','kimi']},
  moonshot_intl:{name:'Kimi / Moonshot（国际）',currency:'USD',keyEnv:'MOONSHOT_INTL_API_KEY',balance:{url:'https://api.moonshot.ai/v1/users/me/balance',remaining:'data.available_balance'},probeUrl:'https://api.moonshot.ai/v1/models'},
  stepfun:{name:'阶跃星辰 StepFun',currency:'CNY',keyEnv:'STEPFUN_API_KEY',balance:{url:'https://api.stepfun.com/v1/accounts',remaining:'balance'},matchIds:['stepfun','step-']},
  novita:{name:'Novita AI',currency:'USD',keyEnv:'NOVITA_API_KEY',balance:{url:'https://api.novita.ai/v3/user/balance',remaining:'availableBalance',scale:.0001},matchIds:['novita']},
  volcengine_ark:noBalance('火山方舟 Ark','CNY','ARK_API_KEY','https://ark.cn-beijing.volces.com/api/v3/models',['doubao','ep-']),
  zhipu_glm_coding:{name:'智谱 GLM Coding Plan（订阅）',currency:'CNY',keyEnv:'ZHIPU_API_KEY',kind:'quota',quota:{url:'https://open.bigmodel.cn/api/monitor/usage/quota/limit',auth:'raw',percent:'data.limits[0].TOKENS_LIMIT.percentage',resetAt:'data.limits[0].nextResetTime',level:'data.level'}},
  kimi_coding:{name:'Kimi Coding（订阅）',currency:'CNY',keyEnv:'KIMI_CODING_KEY',kind:'quota',quota:{url:'https://api.kimi.com/coding/v1/usages',remain:'usage.remaining',total:'usage.limit',resetAt:'usage.resetTime'}},
  minimax_coding:{name:'MiniMax Coding（订阅）',currency:'CNY',keyEnv:'MINIMAX_API_KEY',kind:'quota',quota:{url:'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains',remainPct:'model_remains[0].current_interval_remaining_percent',weeklyRemainPct:'model_remains[0].current_weekly_remaining_percent',resetAt:'model_remains[0].end_time'}},
  opencode_go:{name:'OpenCode Go（订阅）',currency:'USD',keyEnv:'OPENCODE_GO_API_KEY',kind:'quota',quota:{url:'https://opencode.ai/zen/go/v1/usage',windows:[{key:'rolling',label:'5h',percent:'usage.rolling.percent',resetAt:'usage.rolling.resetsAt'},{key:'weekly',label:'周',percent:'usage.weekly.percent',resetAt:'usage.weekly.resetsAt'},{key:'monthly',label:'月',percent:'usage.monthly.percent',resetAt:'usage.monthly.resetsAt'}]}},
  openai_compat:{name:'OpenAI 兼容中转站',currency:'USD',keyEnv:'CUSTOM_API_KEY',needsBaseUrl:true,balance:{url:'{base}/v1/dashboard/billing/subscription',total:'hard_limit_usd',usageUrl:'{base}/v1/dashboard/billing/usage',used:'total_usage',usedScale:.01}},
  custom:{name:'自定义 HTTP',currency:'CNY',keyEnv:'CUSTOM_API_KEY',custom:true,balance:{}},
  codex:{name:'Codex（本地会话）',currency:'CNY',keyEnv:'',kind:'codex'},
  openai:noBalance('OpenAI','USD','OPENAI_API_KEY','https://api.openai.com/v1/models',['gpt','o1-','o3-','o4-','chatgpt']),
  anthropic:noBalance('Anthropic Claude','USD','ANTHROPIC_API_KEY','',['claude']),
  gemini:{...noBalance('Google Gemini','USD','GEMINI_API_KEY','https://generativelanguage.googleapis.com/v1beta/models',['gemini']),auth:'query'},
  xai:noBalance('xAI Grok','USD','XAI_API_KEY','https://api.x.ai/v1/models',['grok']),
  groq:noBalance('Groq','USD','GROQ_API_KEY','https://api.groq.com/openai/v1/models',['llama','mixtral','qwen','deepseek','gemma','whisper']),
  mistral:noBalance('Mistral AI','USD','MISTRAL_API_KEY','https://api.mistral.ai/v1/models',['mistral','codestral','magistral','pixtral','ministral']),
  together:noBalance('Together AI','USD','TOGETHER_API_KEY','https://api.together.xyz/v1/models',['meta-llama','Qwen','deepseek','mistralai','nvidia']),
  fireworks:noBalance('Fireworks AI','USD','FIREWORKS_API_KEY','https://api.fireworks.ai/inference/v1/models',['accounts/fireworks','llama-v3','qwen']),
  deepinfra:noBalance('DeepInfra','USD','DEEPINFRA_API_KEY','https://api.deepinfra.com/v1/openai/models',['meta-llama','Qwen','deepseek']),
  cerebras:noBalance('Cerebras','USD','CEREBRAS_API_KEY','https://api.cerebras.ai/v1/models',['llama','qwen']),
  dashscope:noBalance('阿里云百炼（通义千问）','CNY','DASHSCOPE_API_KEY','https://dashscope.aliyuncs.com/compatible-mode/v1/models',['qwen','qwq','qvq']),
  qianfan:noBalance('百度千帆（文心）','CNY','QIANFAN_API_KEY','https://qianfan.baidubce.com/v2/models',['ernie']),
  hunyuan:noBalance('腾讯混元','CNY','HUNYUAN_API_KEY','https://api.hunyuan.cloud.tencent.com/v1/models',['hunyuan']),
  spark:noBalance('讯飞星火','CNY','SPARK_API_KEY','https://spark-api-open.xf-yun.com/v1/models',['spark','generalv','4.0ultra']),
  modelscope:noBalance('魔搭 ModelScope','CNY','MODELSCOPE_API_KEY','https://api-inference.modelscope.cn/v1/models',['Qwen','deepseek','MiniMax','glm']),
  ollama:{...noBalance('本地模型（Ollama / LM Studio）','CNY','','{base}/v1/models',['llama','qwen','gemma','deepseek','mistral','phi']),needsBaseUrl:true},
  zhipu_glm_coding_intl:{name:'智谱 GLM Coding Plan（国际 z.ai）',currency:'USD',keyEnv:'ZHIPU_INTL_API_KEY',kind:'quota',quota:{url:'https://api.z.ai/api/monitor/usage/quota/limit',auth:'raw',percent:'data.limits[0].TOKENS_LIMIT.percentage',resetAt:'data.limits[0].nextResetTime',level:'data.level'}},
  minimax_coding_intl:{name:'MiniMax Coding（国际）',currency:'USD',keyEnv:'MINIMAX_INTL_API_KEY',kind:'quota',quota:{url:'https://api.minimax.io/v1/api/openplatform/coding_plan/remains',remainPct:'model_remains[0].current_interval_remaining_percent',weeklyRemainPct:'model_remains[0].current_weekly_remaining_percent',resetAt:'model_remains[0].end_time'}},
});

const idOk = value => /^[A-Za-z0-9_-]{1,64}$/.test(value || '') && !['__proto__','prototype','constructor'].includes(value);
export function pickJsonPath(value, expression) {
  let current=value;
  for(const key of String(expression||'').replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean)){
    if(current===null||current===undefined||['__proto__','prototype','constructor'].includes(key))return undefined;
    current=current[key];
  }
  return current;
}
const nonEmpty=(base,over)=>{const out=structuredClone(base||{});for(const [key,value] of Object.entries(over||{})){if(value===undefined||value===null||value==='')continue;out[key]=value&&typeof value==='object'&&!Array.isArray(value)?nonEmpty(out[key],value):value;}return out;};
function publicTemplate([id,t]) { return {id,name:t.name,currency:t.currency,keyEnv:t.keyEnv,scale:t.balance?.scale||1,kind:t.kind||'balance',needsBaseUrl:!!t.needsBaseUrl,noBalanceApi:!!t.noBalanceApi,matchIds:t.matchIds||[]}; }

const numeric = value => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value)) ? Number(value) : null;
export class ApiModelRegistry {
  constructor({dataDir,env=process.env,fetchImpl=fetch}={}) { this.dataDir=dataDir;this.file=path.join(dataDir,'api-models.json');this.env=env;this.fetch=fetchImpl; }
  load() {
    const data=readJson(this.file,{version:1,models:[]});
    if(!Array.isArray(data.models))throw Error('API 模型配置损坏，请从备份恢复');
    return data;
  }
  model(id) { return this.load().models.find(item=>item.id===id)||null; }
  list() { return {ok:true,templates:Object.entries(API_TEMPLATES).map(publicTemplate),models:this.load().models.map(model=>this.publicModel(model))}; }
  publicModel(model) {
    const t=API_TEMPLATES[model.template]||{};
    return {...model,kind:model.manualQuota?'quota':t.kind||'balance',noBalanceApi:!!t.noBalanceApi,
      configured:{key:!!this.key(model,t),endpoint:!!(model.balanceUrl||t.balance?.url||model.baseUrl||t.probeUrl)}};
  }
  save(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('API 模型格式无效');
    const t=API_TEMPLATES[input.template];if(!t)throw Error('未知服务商模板');
    const id=String(input.id||('api_'+Date.now().toString(36)));if(!idOk(id))throw Error('API 模型 ID 无效');
    const old=this.model(id),current=old?.template===input.template?old:{};
    const keep=(key,fallback='')=>Object.hasOwn(input,key)?input[key]:current[key]??fallback;
    const model={id,template:input.template,name:String(keep('name',t.name)||t.name).trim().slice(0,64),currency:String(keep('currency',t.currency||'USD')).toUpperCase(),
      keyEnv:String(keep('keyEnv',t.keyEnv||'')).trim(),baseUrl:String(keep('baseUrl')).trim(),balanceUrl:String(keep('balanceUrl')).trim(),
      balanceField:String(keep('balanceField')).trim(),usedField:String(keep('usedField')).trim(),scale:Number(keep('scale',t.balance?.scale||1)),
      matchIds:Array.isArray(input.matchIds)?input.matchIds.map(String).filter(Boolean).slice(0,12):current.matchIds||t.matchIds||[]};
    if(!/^[A-Z]{3}$/.test(model.currency))throw Error('币种须为三位代码');
    if(model.keyEnv&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(model.keyEnv))throw Error('密钥环境变量名无效');
    if(!Number.isFinite(model.scale)||model.scale<=0||model.scale>1e12)throw Error('金额倍率无效');
    for(const key of ['baseUrl','balanceUrl'])if(model[key])cleanUrl(model[key]);
    for(const key of ['balanceField','usedField'])if(model[key]&&!/^[A-Za-z0-9_.\[\]]+$/.test(model[key]))throw Error('JSON 字段路径无效');
    model.alerts={...(current.alerts||{})};
    for(const key of ['balanceBelow','dailyTokens','dailyBudget','quotaRemainingBelow'])if(Object.hasOwn(input,key)) {
      if(input[key]===''){delete model.alerts[key];continue;}
      const n=numeric(input[key]);if(n===null||n<0||n>(key==='quotaRemainingBelow'?100:1e15))throw Error('提醒阈值无效');model.alerts[key]=n;
    }
    model.messages = { ...(current.messages || {}) };
    for (const key of ['balance','budget','quota']) if (Object.hasOwn(input,key+'Message')) model.messages[key]=String(input[key+'Message']||'').slice(0,1000);
    model.bubbleSettings = { ...(current.bubbleSettings || {}) };
    if (input.bubbleSettings) for (const key of ['balance','budget','quota']) {
      const cfg=input.bubbleSettings[key];if(!cfg)continue;
      if(!Array.isArray(cfg.lines)||cfg.lines.length>36||JSON.stringify(cfg.lines).length>100000)throw Error('提醒泡泡模块超出限制');
      model.bubbleSettings[key]={lines:cfg.lines,autoClose:cfg.autoClose!==false,ttlSec:Math.max(0,Math.min(3600,Number(cfg.ttlSec)||0))};
    }
    model.prices={...(current.prices||{})};
    for(const key of ['input','cached','output'])if(Object.hasOwn(input,key+'Price')) {
      const value=input[key+'Price'];if(value===''){delete model.prices[key];continue;}
      const n=numeric(value);if(n===null||n<0||n>1e9)throw Error('每百万 token 价格无效');model.prices[key]=n;
    }
    const manual=keep('manualQuota',null);
    if(manual) {
      const remaining=numeric(manual.remaining),total=numeric(manual.total),reset=Date.parse(manual.resetsAt);
      if(remaining===null||total===null||remaining<0||total<=0||remaining>total||!Number.isFinite(reset))throw Error('手动额度须填写总额、剩余值和重置时间');
      const mode=manual.mode==='auto'?'auto':'manual',period=['daily','weekly'].includes(manual.period)?manual.period:'none';
      model.manualQuota={remaining,total,resetsAt:new Date(reset).toISOString(),observedAt:Date.now(),mode,period,baseAt:manual.resetBase?Date.now():current.manualQuota?.baseAt||Date.now()};
    }
    // A template credential is allowed only at its fixed provider origin. A
    // custom endpoint must use a separately named credential or be keyless.
    const builtIn=t.balance?.url||t.quota?.url||t.probeUrl;
    if(model.balanceUrl&&builtIn&&!builtIn.includes('{base}')&&new URL(model.balanceUrl).origin!==new URL(builtIn).origin&&model.keyEnv===t.keyEnv)throw Error('自定义地址须使用专用密钥环境变量，不能发送服务商默认密钥');
    const data=this.load(),index=data.models.findIndex(item=>item.id===id);
    if(index>=0)data.models[index]=model;else data.models.push(model);
    writeJson(this.file,data);return {ok:true,model:this.publicModel(model)};
  }
  delete(id) {
    if(!idOk(id))throw Error('API 模型 ID 无效');const data=this.load();
    if(!data.models.some(item=>item.id===id))throw Error('API 模型不存在');
    data.models=data.models.filter(item=>item.id!==id);writeJson(this.file,data);
    return {ok:true};
  }
  endpoint(model,t,kind) {
    let raw=kind==='probe'?(model.balanceUrl||t.probeUrl||t.balance?.url||t.quota?.url):kind==='usage'?t.balance?.usageUrl:kind==='quota'?t.quota?.url:model.balanceUrl||t.balance?.url;
    if(!raw)return '';
    let base=model.baseUrl?cleanUrl(model.baseUrl):'';
    if(raw.includes('{base}/v1/')&&base.endsWith('/v1'))base=base.slice(0,-3);
    return cleanUrl(String(raw).replace('{base}',base));
  }
  key(model,t) { const name=Object.hasOwn(model,'keyEnv')?model.keyEnv:t.keyEnv;return name?String(this.env[name]||'').trim():''; }
  async json(url,key,auth='bearer') {
    const headers={accept:'application/json'};let target=url;
    if(auth==='query'&&key){const parsed=new URL(url);parsed.searchParams.set('key',key);target=parsed.toString();}
    else if(key)headers.authorization=auth==='raw'?key:'Bearer '+key;
    if(auth==='anthropic'&&key){delete headers.authorization;headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);timer.unref?.();
    try {
      const response=await this.fetch(target,{headers,signal:controller.signal,redirect:'error'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const limit=2*1024*1024;
      const text=await readBoundedBodyText(response,{maxBytes:limit,tooLarge:()=>Error('响应过大'),unsupported:()=>Error('响应过大'),
        streamless:async r=>{const body=await r.text();if(Buffer.byteLength(body)>limit)throw Error('响应过大');return body;}});
      const data=JSON.parse(text);
      if(data?.success===false||data?.is_available===false||data?.error)throw Error('服务商返回业务错误');
      return data;
    } finally {clearTimeout(timer);}
  }
  quotaPeriodStart(model, now=Date.now()) {
    const q=model.manualQuota;if(!q)return null;
    if(q.period==='daily')return Date.parse(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00+08:00');
    if(q.period==='weekly'){const bj=new Date(now+8*3600000);const monday=now-((bj.getUTCDay()+6)%7)*86400000;return Date.parse(new Date(monday+8*3600000).toISOString().slice(0,10)+'T00:00:00+08:00');}
    return q.baseAt;
  }
  quotaStart(model, now=Date.now()) {
    return model.manualQuota ? Math.max(model.manualQuota.baseAt, this.quotaPeriodStart(model, now)) : null;
  }
  async read(id,{probe=false,usage=null}={}) {
    const model=this.model(id);if(!model)throw Error('API 模型不存在');const t=API_TEMPLATES[model.template];if(!t)throw Error('未知服务商模板');
    if(!probe&&model.manualQuota) {
      const q={...model.manualQuota},start=this.quotaPeriodStart(model);
      if(q.mode==='auto') {
        const renewed=q.period!=='none'&&start>q.baseAt;
        q.remaining=Math.max(0,(renewed?q.total:q.remaining)-(usage?.todayTokens||0));
        if(q.period!=='none')q.resetsAt=start+(q.period==='daily'?1:7)*86400000;
      }
      return this.quotaResult(id,{manual:q},{remain:'manual.remaining',total:'manual.total',resetAt:'manual.resetsAt'},q.mode==='auto'?'local-estimate':'manual');
    }
    if(t.kind==='codex')return {ok:true,id,kind:'codex',note:'Codex 本机统计由订阅额度与 token 页面提供'};
    if(t.noBalanceApi&&!probe&&!model.balanceUrl)return {ok:true,id,kind:'balance',available:false,noBalanceApi:true,note:'该服务商没有公开的 API key 余额接口'};
    const key=this.key(model,t);
    if(model.keyEnv&&!key)throw Error('未设置密钥环境变量 '+model.keyEnv);
    const kind=probe?'probe':t.kind==='quota'?'quota':'balance',endpoint=this.endpoint(model,t,kind);
    if(!endpoint)throw Error('未配置可查询接口');
    const data=await this.json(endpoint,key,t.auth||t.quota?.auth||'bearer');
    if(probe)return {ok:true,id,detail:'连接正常',models:Array.isArray(data?.data)?data.data.length:null};
    if(kind==='quota')return this.quotaResult(id,data,t.quota||{});
    const b=nonEmpty(t.balance,{remaining:model.balanceField,used:model.usedField,scale:model.scale});
    const billedUsage=b.usageUrl?await this.json(this.endpoint(model,t,'usage'),key,t.auth):data;
    const total=b.total?numeric(pickJsonPath(data,b.total)):null,used=b.used?numeric(pickJsonPath(billedUsage,b.used)):null;
    let remaining=b.remaining?numeric(pickJsonPath(data,b.remaining)):null;
    if(total!==null&&used!==null)remaining=total-used*(b.usedScale||1);
    if(remaining===null)throw Error('余额字段不存在或不是数字');
    return {ok:true,id,kind:'balance',available:true,balance:remaining*(b.scale||1),currency:model.currency,observedAt:Date.now()};
  }
  quotaResult(id,data,q,source='provider-api') {
    const number=expression=>numeric(pickJsonPath(data,expression));
    const reset=value=>{const n=numeric(value);if(n!==null)return n<1e12?n*1000:n;const time=Date.parse(value);return Number.isFinite(time)?time:null;};
    const windows=[];
    if(Array.isArray(q.windows))for(const w of q.windows){const used=number(w.percent);if(used!==null)windows.push({key:w.key,label:w.label,usedPercent:Math.max(0,Math.min(100,used)),resetsAt:reset(pickJsonPath(data,w.resetAt))});}
    else {
      let used=q.percent?number(q.percent):null;
      const remain=q.remainPct?number(q.remainPct):null;if(used===null&&remain!==null)used=100-remain;
      if(used===null&&q.remain&&q.total){const r=number(q.remain),total=number(q.total);if(r!==null&&total>0)used=100-r/total*100;}
      if(used!==null)windows.push({key:'primary',label:'当前周期',usedPercent:Math.max(0,Math.min(100,used)),resetsAt:reset(pickJsonPath(data,q.resetAt))});
      const weekly=q.weeklyRemainPct?number(q.weeklyRemainPct):null;if(weekly!==null)windows.push({key:'weekly',label:'每周',usedPercent:Math.max(0,Math.min(100,100-weekly)),resetsAt:reset(pickJsonPath(data,q.resetAt))});
    }
    return {ok:true,id,kind:'quota',available:windows.length>0,windows,source,observedAt:Date.now(),level:q.level?String(pickJsonPath(data,q.level)||''):''};
  }
  estimate(model,usage) {
    if(!Object.keys(model.prices||{}).length)return null;
    let total=0;
    for(const row of Object.values(usage.byModel||{})) {
      const input=Number(row.input_tokens)||0,output=Number(row.output_tokens)||0,cached=Math.min(input,Number(row.cached_input_tokens)||0);
      if(input>cached&&!Number.isFinite(model.prices.input)||cached>0&&!Number.isFinite(model.prices.cached)||output>0&&!Number.isFinite(model.prices.output))return null;
      total+=((input-cached)*(model.prices.input||0)+cached*(model.prices.cached||0)+output*(model.prices.output||0))/1e6;
    }
    return total;
  }
}
