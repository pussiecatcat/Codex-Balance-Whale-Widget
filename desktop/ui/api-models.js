(() => {
  'use strict';
  let registry = { templates: [], models: [] }, loadedAt = 0, pending = null;
  const values = new Map(), bindings = new Map();
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(url, { method, cache: 'no-store', headers: body === undefined ? {} : {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json(); if (!response.ok || data.ok === false) throw Error(data.error || '操作失败'); return data;
  };
  async function load(force = false) {
    if (pending) return pending;
    if (!force && Date.now() - loadedAt < 30000) return registry;
    pending = request('/api/models').then(data => { registry = data; loadedAt = Date.now(); return data; }).finally(() => { pending = null; });
    return pending;
  }
  const modelName = id => registry.models.find(item => item.id === id)?.name || 'API 模型';
  const formatMoney=(amount,currency)=>window.WhaleMoney?.formatMoney(amount,currency)||new Intl.NumberFormat('zh-CN',{style:'currency',currency}).format(amount);
  function valueText(module, value) {
    if(loadedAt&&!registry.models.some(model=>model.id===module.apiModelId))return 'API 模型未配置';
    if (!value) return modelName(module.apiModelId) + ' · 加载中';
    if (value.error) return modelName(module.apiModelId) + ' · 暂不可用';
    if (module.type === 'today') { const tokens=Number(value.todayTokens||0).toLocaleString()+' tokens',cost=value.todayEstimate==null?'金额未知':formatMoney(value.todayEstimate,value.currency||registry.models.find(item=>item.id===module.apiModelId)?.currency||'USD')+'（估算）';return (module.tpl || '今日 {api_tokens}').replaceAll('{api_tokens}',tokens).replaceAll('{expense_api}',cost).replaceAll('{api_cost}',cost).replaceAll('{api_name}',modelName(module.apiModelId)); }
    if (module.type === 'plan') return (module.tpl || '{plan_name}').replaceAll('{plan_name}',modelName(module.apiModelId)+(value.level?' · '+value.level:'')).replaceAll('{plan_type}',value.kind||'API');
    if (module.type === 'quota') {
      const item = value.windows?.find(item => module.quotaKey ? item.key === module.quotaKey : true);
      const expired = item?.resetsAt && item.resetsAt <= Date.now();
      const left = item && Number.isFinite(item.usedPercent) && !expired ? Math.max(0, 100 - item.usedPercent) : null;
      const leftText=left===null?'未观测':left.toFixed(1)+'%',usedText=item&&Number.isFinite(item.usedPercent)?item.usedPercent.toFixed(1)+'%':'未观测';
      return (module.tpl || '{api_name} 剩余 {api_quota_left}').replaceAll('{api_name}',modelName(module.apiModelId)).replaceAll('{api_quota_left}',leftText).replaceAll('{api_quota_used}',usedText).replaceAll('{quota_left}',leftText).replaceAll('{quota_left_round}',left===null?'未观测':Math.round(left)+'%').replaceAll('{quota_used}',usedText).replaceAll('{quota_label}',item?.label||'当前周期').replaceAll('{quota_reset_short}',window.WhaleQuota?.countdownShort(item?.resetsAt)||'等待同步').replaceAll('{quota_reset_at}',window.WhaleQuota?.resetAt(item?.resetsAt)||'等待同步').replaceAll('{quota_reset}',window.WhaleQuota?.countdown(item?.resetsAt)||'未观测').replaceAll('{quota_bar}',window.WhaleQuota?.quotaBar(left)||'────────')+(expired?'（数据已过期）':value.source==='manual'?'（手动）':value.source==='local-estimate'?'（本机估算）':'');
    }
    if (value.noBalanceApi || value.available === false) return modelName(module.apiModelId) + ' · 无公开余额接口';
    const amount = Number(value.balance); const display = Number.isFinite(amount) ? formatMoney(amount,value.currency||'USD') : '未观测';
    return (module.tpl || '{api_name} {api_balance}').replaceAll('{api_name}',modelName(module.apiModelId)).replaceAll('{api_balance}',display).replaceAll('{balance_api}',display).replaceAll('{balance_ds}',display);
  }
  async function refreshValue(id, force = false) {
    const old = values.get(id); if (!force && old && Date.now() - old.at < 30000) return old.data;
    try { const data = await request('/api/models/value?id=' + encodeURIComponent(id)); values.set(id,{at:Date.now(),data}); }
    catch (error) { values.set(id,{at:Date.now(),data:{error:error.message}}); }
    paint(); checkAlerts(id, values.get(id).data); return values.get(id).data;
  }
  function checkAlerts(id,value) {
    const model=registry.models.find(item=>item.id===id),alerts=model?.alerts||{};
    if(!model||value?.error)return;
    const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
    const first=value.windows?.[0],left=first&&Number.isFinite(first.usedPercent)?100-first.usedPercent:null;
    const map={api_name:model.name,api_balance:value.balance??'未知',api_cost:value.todayEstimate??'未知',api_quota_left:left===null?'未知':left.toFixed(1)+'%'};
    const fire=(kind,fallback,rank)=>{
      const key='dshw-api-alert:'+day+':'+id+':'+kind;
      try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1');}catch{}
      const message=(model.messages?.[kind]||fallback).replace(/\{(api_name|api_balance|api_cost|api_quota_left)\}/g,(all,name)=>String(map[name]));
      const config=model.bubbleSettings?.[kind];const resolve=value=>Array.isArray(value)?value.map(resolve):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolve(item)])):typeof value==='string'?value.replace(/\{(api_name|api_balance|api_cost|api_quota_left|below|amount|currency)\}/g,(all,name)=>name==='below'?String(kind==='quota'?alerts.quotaRemainingBelow:alerts.balanceBelow):name==='amount'?String(alerts.dailyBudget):name==='currency'?model.currency:String(map[name])):value;window.dispatchEvent(new CustomEvent('whale-api-model-alert',{detail:{message,rank,lines:config?.lines?.length?resolve(config.lines):null,config}}));
    };
    if(Number.isFinite(alerts.balanceBelow)&&Number.isFinite(value.balance)&&value.balance<=alerts.balanceBelow)fire('balance',model.name+' 余额已低于 '+alerts.balanceBelow+' '+model.currency,2);
    if(Number.isFinite(alerts.dailyTokens)&&Number(value.todayTokens)>=alerts.dailyTokens)fire('tokens',model.name+' 今日 token 已达到 '+Number(alerts.dailyTokens).toLocaleString(),1);
    if(Number.isFinite(alerts.dailyBudget)&&Number.isFinite(value.todayEstimate)&&value.todayEstimate>=alerts.dailyBudget)fire('budget',model.name+' 今日估算费用达到 '+value.todayEstimate.toFixed(4)+' '+model.currency,1);
    if(Number.isFinite(alerts.quotaRemainingBelow)&&left!==null&&!(first.resetsAt&&first.resetsAt<=Date.now())&&left<=alerts.quotaRemainingBelow)fire('quota',model.name+' 额度仅剩 '+left.toFixed(1)+'%',2);
  }
  function paint() { for (const [element,module] of bindings) { if (!element.isConnected) {bindings.delete(element);continue;} element.textContent = valueText(module, values.get(module.apiModelId)?.data); } }
  function bind(element,module) { bindings.set(element,module); element.textContent=valueText(module,values.get(module.apiModelId)?.data); load().then(()=>refreshValue(module.apiModelId)).catch(()=>{}); }
  function clearBindings(root) { for(const element of bindings.keys())if(element===root||root.contains(element))bindings.delete(element); }
  async function options(select, selected, changed) { await load(); select.replaceChildren(new Option('当前主 API','')); for(const model of registry.models)select.append(new Option(model.name,model.id));select.value=selected||'';select.onchange=()=>changed(select.value); }

  function initPanel() {
    const root=document.getElementById('api-models-root'); if(!root)return;
    const el=(parent,tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;parent.append(node);return node;};
    const numeric=value=>Number.isFinite(Number(value))?Number(value):null;
    const money=(value,currency)=>numeric(value)===null?'—':formatMoney(Number(value),currency||'USD');
    const button=(parent,text,cls,handler)=>{const node=el(parent,'button',text,cls);node.type='button';node.onclick=handler;return node;};
    const closeDialog=dialog=>{if(dialog.open)dialog.close();dialog.remove();};
    const currentModel=id=>registry.models.find(model=>model.id===id)||null;
    const notifyChanged=()=>window.dispatchEvent(new Event('whale-api-model-changed'));
    const finishSave=async id=>{if(id)values.delete(id);loadedAt=0;await load(true);paint();notifyChanged();};

    async function render() {
      root.replaceChildren(); let data; try{data=await load(true);}catch(error){el(root,'p',error.message,'notice');return;}
      const list=el(root,'div','','api-model-list');
      for(const model of data.models){
        const row=el(list,'div','','api-model-row'),meta=el(row,'div','', 'api-model-meta');
        el(meta,'strong',model.name);el(meta,'small',(model.kind==='quota'?'订阅额度':model.kind==='codex'?'本地统计':model.noBalanceApi?'无余额接口':'余额接口')+' · '+model.currency);
        button(row,'测试','quiet',async event=>{const test=event.currentTarget;test.disabled=true;try{const result=await request('/api/models/probe','POST',{id:model.id});window.whaleToast?.(result.detail||'连接正常');}catch(error){window.whaleToast?.(error.message);}finally{test.disabled=false;}});
        button(row,'设置','quiet',()=>openModelDetail(model));
        button(row,'删除','quiet',async()=>{if(!await confirmRemoval(model))return;await request('/api/models?id='+encodeURIComponent(model.id),'DELETE',{});values.delete(model.id);loadedAt=0;await render();paint();notifyChanged();});
      }
      button(root,'添加 API 模型','primary',()=>editor(null));
      el(root,'p','密钥只读取环境变量，配置文件不保存密钥内容。余额、预算和额度提醒在每个模型的“设置”中单独管理。','help');
    }

    function confirmRemoval(model) {
      return new Promise(resolve=>{
        const dialog=el(document.body,'dialog','','api-model-card api-model-confirm-card');el(dialog,'h3','删除 API 模型');
        el(dialog,'p','删除 '+model.name+'？引用它的气泡会显示未配置。');
        const actions=el(dialog,'div','','dialog-actions'),done=value=>{closeDialog(dialog);resolve(value);};
        button(actions,'取消','quiet',()=>done(false));button(actions,'删除','primary',()=>done(true));
        dialog.addEventListener('cancel',event=>{event.preventDefault();done(false);});dialog.showModal();
      });
    }

    function detailRow(parent,label,value,actionText,onAction,helpText='') {
      const row=el(parent,'div','','api-model-detail-row');
      const name=el(row,'span',label,'api-model-detail-label');
      if(helpText){const help=el(name,'span','?','api-model-help-dot');help.title=helpText;}
      el(row,'span',value,'api-model-detail-value');
      if(onAction)button(row,actionText||'编辑','dshwv-roleimport api-model-detail-button',onAction);
      return row;
    }

    function balanceSummary(model,value) {
      if(value?.error)return '读取失败';
      if(value?.noBalanceApi||value?.available===false)return '余额 —（无接口）';
      return numeric(value?.balance)===null?'余额尚未观测':'余额 '+money(value.balance,value.currency||model.currency);
    }

    function quotaSummary(model,value) {
      const windows=Array.isArray(value?.windows)?value.windows:[];
      if(windows.length){
        return windows.map(item=>{
          const left=Number.isFinite(item.usedPercent)?Math.max(0,100-item.usedPercent):null;
          return (item.label||'当前周期')+' '+(left===null?'未观测':left.toFixed(1)+'%');
        }).join(' · ');
      }
      return model.manualQuota?'已设置手动额度':'已关闭';
    }

    function priceSummary(model) {
      const prices=model.prices||{},configured=['input','cached','output'].some(key=>Number.isFinite(prices[key]));
      if(model.template==='deepseek'&&!configured)return '内置峰谷价（内置模型不支持自定义单价）';
      if(!configured)return '未设置';
      return '入 '+(Number.isFinite(prices.input)?prices.input:'—')+' / 缓 '+(Number.isFinite(prices.cached)?prices.cached:'—')+' / 出 '+(Number.isFinite(prices.output)?prices.output:'—')+'（每百万 token）';
    }

    async function openModelDetail(model) {
      model=currentModel(model.id)||model;
      const dialog=el(document.body,'dialog','','api-model-card api-model-detail-card');
      const title=el(dialog,'h3',model.name+(model.template==='deepseek'?'（内置）':''),'dshwv-bubtitle');
      const summary=el(dialog,'div','正在读取模型状态…','api-model-detail-summary');
      const rows=el(dialog,'div','','api-model-detail-rows');
      const actions=el(dialog,'div','','dshwv-bubbtns api-model-detail-actions');
      let finished=false;
      const done=next=>{if(finished)return;finished=true;closeDialog(dialog);if(next)next();};
      button(actions,'密钥 / 接口','dshwv-bubbtn api-model-secondary',()=>done(()=>editor(model,{returnTo:model.id})));
      button(actions,'关闭','dshwv-bubbtn dshwv-bubbtn-ok',()=>done());
      dialog.addEventListener('cancel',event=>{event.preventDefault();done();});
      dialog.showModal();
      let value;try{value=await refreshValue(model.id,true);}catch(error){value={error:error.message};}
      if(finished)return;
      const alerts=model.alerts||{};
      const balance=balanceSummary(model,value),estimate=numeric(value?.todayEstimate);
      summary.textContent=balance+' · 今日已用 '+(estimate===null?'—':money(estimate,value.currency||model.currency));
      rows.replaceChildren();
      detailRow(rows,'余额预警',Number.isFinite(alerts.balanceBelow)?'余额 ≤ '+money(alerts.balanceBelow,model.currency)+' 时提醒':'已关闭','编辑',()=>done(()=>openAlertEditor(model,'balance')));
      const budgetStatus=Number.isFinite(alerts.dailyBudget)?'今日已用 ≥ '+money(alerts.dailyBudget,model.currency)+' 时提醒':Number.isFinite(alerts.dailyTokens)?'今日 token ≥ '+Number(alerts.dailyTokens).toLocaleString()+' 时提醒':'已关闭';
      detailRow(rows,'今日预算',budgetStatus,'编辑',()=>done(()=>openAlertEditor(model,'budget')));
      const quotaAlert=Number.isFinite(alerts.quotaRemainingBelow)?' · 剩余 ≤ '+alerts.quotaRemainingBelow+'% 时提醒':'';
      detailRow(rows,'额度（订阅/资源包）',quotaSummary(model,value)+quotaAlert,'编辑',()=>done(()=>openQuotaEditor(model)));
      detailRow(rows,'单价',priceSummary(model));
      detailRow(rows,'已观测消费',estimate===null?'暂无金额记录':'已观测消费 '+money(estimate,value.currency||model.currency),'','', '来自本机已记录的会话用量，金额按当前模型价格估算。');
      if(model.template==='deepseek')detailRow(rows,'余额校正',numeric(value?.balance)===null?'尚未观测余额':'已观测余额','校正',()=>done(()=>window.dispatchEvent(new Event('whale-open-balance-reconcile'))));
      title.textContent=model.name+(model.template==='deepseek'?'（内置）':'');
    }

    const alertSpecs={
      balance:{title:'余额预警',threshold:'balanceBelow',message:'balanceMessage',bubble:'balance',defaultValue:5,unit:'金额',placeholder:'余额低于阈值时提醒'},
      budget:{title:'今日预算',threshold:'dailyBudget',message:'budgetMessage',bubble:'budget',defaultValue:10,unit:'金额',placeholder:'今日估算费用达到阈值时提醒'}
    };

    function formLine(parent,label,input,tail='') {
      const row=el(parent,'label','','api-model-edit-row');el(row,'span',label,'api-model-edit-label');row.append(input);if(tail)el(row,'span',tail,'api-model-edit-tail');return row;
    }

    function inputNode(type,value='') {const input=document.createElement('input');input.type=type;input.value=value;if(type==='number'){input.min='0';input.step='any';}return input;}

    function openAlertEditor(model,key) {
      const spec=alertSpecs[key],dialog=el(document.body,'dialog','','api-model-card api-model-mini-card');
      el(dialog,'h3',spec.title,'dshwv-bubtitle');
      const alerts=model.alerts||{},enabled=inputNode('checkbox');enabled.checked=Number.isFinite(alerts[spec.threshold]);
      const threshold=inputNode('number',alerts[spec.threshold]??spec.defaultValue),message=inputNode('text',model.messages?.[spec.bubble]||'');
      threshold.className='api-model-number';message.placeholder=spec.placeholder;
      formLine(dialog,'启用提醒',enabled);formLine(dialog,'提醒阈值',threshold,spec.unit);
      if(key==='budget'){
        const tokens=inputNode('number',alerts.dailyTokens??'');tokens.className='api-model-number';tokens.placeholder='留空关闭';formLine(dialog,'每日 token',tokens,'tokens');dialog._dailyTokens=tokens;
      }
      formLine(dialog,'提示文字',message);
      const bubble=button(dialog,'编辑提示气泡内容','api-model-wide-action',async()=>{
        try{const updated=await persist(false);closeDialog(dialog);openBubbleEditor(updated,spec);}catch(error){showError(error);}
      });
      const notice=el(dialog,'p','','notice');notice.hidden=true;
      const actions=el(dialog,'div','','dshwv-bubbtns');
      button(actions,'取消','dshwv-bubbtn api-model-secondary',()=>{closeDialog(dialog);openModelDetail(currentModel(model.id)||model);});
      const save=button(actions,'保存','dshwv-bubbtn dshwv-bubbtn-ok',async()=>{save.disabled=true;try{const updated=await persist(true);closeDialog(dialog);openModelDetail(updated);}catch(error){showError(error);save.disabled=false;}});
      function showError(error){notice.textContent=error.message||String(error);notice.hidden=false;bubble.disabled=false;}
      async function persist(announce){
        const body={id:model.id,template:model.template,[spec.threshold]:enabled.checked?threshold.value:'',[spec.message]:message.value.trim()};
        if(key==='budget')body.dailyTokens=dialog._dailyTokens.value;
        const result=await request('/api/models','PUT',body);await finishSave(model.id);if(announce)window.whaleToast?.(spec.title+'已保存');return result.model;
      }
      const sync=()=>{threshold.disabled=!enabled.checked;};enabled.onchange=sync;sync();
      dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);openModelDetail(currentModel(model.id)||model);});dialog.showModal();
    }

    function toLocalDateTime(value) {
      const time=Date.parse(value||'');if(!Number.isFinite(time))return '';
      const date=new Date(time),local=new Date(time-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);
    }

    function openQuotaEditor(model) {
      const dialog=el(document.body,'dialog','','api-model-card api-model-mini-card api-model-quota-card');
      el(dialog,'h3','额度（订阅/资源包）','dshwv-bubtitle');
      const q=model.manualQuota||{},alerts=model.alerts||{};
      const alertOn=inputNode('checkbox');alertOn.checked=Number.isFinite(alerts.quotaRemainingBelow);
      const alertAt=inputNode('number',alerts.quotaRemainingBelow??20);alertAt.max='100';alertAt.className='api-model-number';
      formLine(dialog,'额度提醒',alertOn);formLine(dialog,'剩余低于',alertAt,'%');
      const manualOn=inputNode('checkbox');manualOn.checked=!!model.manualQuota;formLine(dialog,'手动额度',manualOn);
      const mode=document.createElement('select');mode.append(new Option('自行填写剩余值','manual'),new Option('按本机 token 自动扣减（估算）','auto'));mode.value=q.mode||'manual';
      const period=document.createElement('select');period.append(new Option('指定时间','none'),new Option('每天（北京时间）','daily'),new Option('每周一（北京时间）','weekly'));period.value=q.period||'none';
      const total=inputNode('number',q.total??''),remaining=inputNode('number',q.remaining??''),reset=inputNode('datetime-local',toLocalDateTime(q.resetsAt)),baseline=inputNode('checkbox');
      total.className=remaining.className='api-model-number';
      const manualFields=[];
      manualFields.push(formLine(dialog,'计算方式',mode),formLine(dialog,'重置周期',period),formLine(dialog,'总额度',total),formLine(dialog,'剩余额度',remaining),formLine(dialog,'重置时间',reset),formLine(dialog,'重新计数',baseline));
      const bubble=button(dialog,'编辑额度提示气泡内容','api-model-wide-action',async()=>{try{const updated=await persist(false);closeDialog(dialog);openBubbleEditor(updated,{title:'额度提醒',threshold:'quotaRemainingBelow',bubble:'quota',defaultValue:20});}catch(error){showError(error);}});
      const notice=el(dialog,'p','','notice');notice.hidden=true;
      const actions=el(dialog,'div','','dshwv-bubbtns');
      button(actions,'取消','dshwv-bubbtn api-model-secondary',()=>{closeDialog(dialog);openModelDetail(currentModel(model.id)||model);});
      const save=button(actions,'保存','dshwv-bubbtn dshwv-bubbtn-ok',async()=>{save.disabled=true;try{const updated=await persist(true);closeDialog(dialog);openModelDetail(updated);}catch(error){showError(error);save.disabled=false;}});
      function showError(error){notice.textContent=error.message||String(error);notice.hidden=false;bubble.disabled=false;}
      async function persist(announce){
        const manual=manualOn.checked?{mode:mode.value,period:period.value,total:total.value,remaining:remaining.value,resetsAt:reset.value,resetBase:baseline.checked}:null;
        const result=await request('/api/models','PUT',{id:model.id,template:model.template,quotaRemainingBelow:alertOn.checked?alertAt.value:'',manualQuota:manual});
        await finishSave(model.id);if(announce)window.whaleToast?.('额度设置已保存');return result.model;
      }
      const sync=()=>{alertAt.disabled=!alertOn.checked;for(const row of manualFields){row.classList.toggle('is-disabled',!manualOn.checked);for(const control of row.querySelectorAll('input,select'))control.disabled=!manualOn.checked;}};
      alertOn.onchange=manualOn.onchange=sync;sync();
      dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);openModelDetail(currentModel(model.id)||model);});dialog.showModal();
    }

    function openBubbleEditor(model,spec) {
      document.getElementById('settings-dialog')?.close();
      const old=model.bubbleSettings?.[spec.bubble]||{};
      const config={...old,layoutOnly:true,previewNotice:{apiName:model.name,apiBalance:'12.00 '+model.currency,apiCost:'0.08 '+model.currency,apiQuotaLeft:'75%'},on:Number.isFinite(model.alerts?.[spec.threshold]),currency:model.currency,below:model.alerts?.[spec.threshold]??spec.defaultValue,amount:model.alerts?.[spec.threshold]??spec.defaultValue,
        lines:old.lines||[{type:'text',text:model.name+' '+spec.title,size:6,bold:true},{type:'text',text:spec.bubble==='budget'?'{api_cost}':spec.bubble==='balance'?'{api_balance}':'{api_quota_left}',size:12,color:'#4059b3'}]};
      window.dispatchEvent(new CustomEvent('whale-edit-api-reminder',{detail:{key:spec.bubble,config,save:async edited=>{
        try{await request('/api/models','PUT',{id:model.id,template:model.template,bubbleSettings:{[spec.bubble]:edited}});await finishSave(model.id);window.whaleToast?.('提示气泡已保存');}
        catch(error){window.whaleToast?.(error.message);}
      }}}));
    }

    function editor(existing,options={}) {
      const overlay=el(document.body,'dialog','','api-model-card api-model-connection-card');
      el(overlay,'h3',existing?'密钥 / 接口 · '+existing.name:'添加 API 模型','dshwv-bubtitle');
      const fields={},basic=el(overlay,'div','','api-model-fields');
      const field=(parent,name,label,type='text',value='')=>{
        const wrap=el(parent,'label',label),input=el(wrap,type==='select'?'select':'input');
        if(type!=='select')input.type=type;if(type==='number'){input.min='0';input.step='any';}
        fields[name]=input;input.dataset.field=name;input.value=value;return input;
      };
      const template=field(basic,'template','服务商模板','select');for(const item of registry.templates)template.append(new Option(item.name,item.id));template.value=existing?.template||'openai';
      const selected=()=>registry.templates.find(item=>item.id===template.value);
      field(basic,'name','显示名称','text',existing?.name||selected()?.name||'');field(basic,'keyEnv','密钥环境变量名','text',existing?.keyEnv??selected()?.keyEnv??'');field(basic,'currency','币种','text',existing?.currency||selected()?.currency||'USD');
      const section=title=>{const node=el(overlay,'details');el(node,'summary',title);return node;};
      const connection=section('接口与用量匹配');field(connection,'baseUrl','Base URL（需要时填写）','url',existing?.baseUrl||'');field(connection,'balanceUrl','自定义余额 URL','url',existing?.balanceUrl||'');field(connection,'balanceField','余额 JSON 路径','text',existing?.balanceField||'');field(connection,'usedField','累计用量 JSON 路径','text',existing?.usedField||'');field(connection,'scale','金额倍率','number',existing?.scale??selected()?.scale??1);field(connection,'matchIds','模型名匹配（逗号分隔）','text',(existing?.matchIds||selected()?.matchIds||[]).join(', '));
      el(connection,'p','自定义地址使用专用密钥环境变量；支持本机模型服务。','help');
      const prices=section('价格估算（每百万 token）');for(const [key,label] of [['input','未缓存输入'],['cached','缓存输入'],['output','输出']])field(prices,key+'Price',label,'number',existing?.prices?.[key]??'');
      el(prices,'p','余额、预算、额度和提醒气泡请返回模型设置卡编辑。','help');
      template.onchange=()=>{const t=selected();if(!t)return;fields.name.value=t.name;fields.keyEnv.value=t.keyEnv||'';fields.currency.value=t.currency||'USD';fields.scale.value=t.scale||1;fields.matchIds.value=(t.matchIds||[]).join(', ');for(const key of ['baseUrl','balanceUrl','balanceField','usedField'])fields[key].value='';};
      const error=el(overlay,'p','','notice');error.hidden=true;
      const actions=el(overlay,'div','','dialog-actions');
      const back=()=>{closeDialog(overlay);if(options.returnTo)openModelDetail(currentModel(options.returnTo)||existing);};
      button(actions,'取消','quiet',back);const save=button(actions,'保存','primary',async()=>{
        save.disabled=true;error.hidden=true;
        try{const body={id:existing?.id,template:template.value};for(const [key,input] of Object.entries(fields))if(key!=='template')body[key]=input.value.trim();body.scale=Number(body.scale);body.matchIds=body.matchIds.split(',').map(value=>value.trim()).filter(Boolean);const result=await request('/api/models','PUT',body);await finishSave(existing?.id||result.model.id);closeDialog(overlay);await render();if(existing)openModelDetail(currentModel(result.model.id)||result.model);}
        catch(ex){error.textContent=ex.message;error.hidden=false;save.disabled=false;}
      });
      overlay.addEventListener('cancel',event=>{event.preventDefault();back();});overlay.showModal();fields.name.focus();
    }

    window.addEventListener('whale-api-model-edit',async event=>{try{const data=await load(true),id=event.detail?.id;if(id){const model=data.models.find(item=>item.id===id);if(model)openModelDetail(model);else window.whaleToast?.('模型不存在');}else editor(null);}catch(error){window.whaleToast?.(error.message||'模型设置打开失败');}});
    document.getElementById('api-models-panel')?.addEventListener('toggle',event=>{if(event.target.open)render();});
  }
  window.WhaleApiModels={load,options,bind,clearBindings,text:module=>valueText(module,values.get(module.apiModelId)?.data),refresh:refreshValue};
  function monitor(){load().then(data=>Promise.allSettled(data.models.map(model=>refreshValue(model.id)))).catch(()=>{});}setInterval(monitor,60000);
  setInterval(()=>{if(bindings.size)paint();},1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initPanel();window.WhaleMoney?.onChange(paint);monitor();},{once:true});else{initPanel();window.WhaleMoney?.onChange(paint);monitor();}
})();



