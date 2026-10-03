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
    const el=(parent,tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;parent.append(node);return node;};
    async function render() {
      root.replaceChildren(); let data; try{data=await load(true);}catch(error){el(root,'p',error.message,'notice');return;}
      const list=el(root,'div','','api-model-list');
      for(const model of data.models){const row=el(list,'div','','api-model-row');const meta=el(row,'div','', 'api-model-meta');el(meta,'strong',model.name);el(meta,'small',(model.kind==='quota'?'订阅额度':model.kind==='codex'?'本地统计':model.noBalanceApi?'无余额接口':'余额接口')+' · '+model.currency);const test=el(row,'button','测试','quiet');test.type='button';test.onclick=async()=>{test.disabled=true;try{const result=await request('/api/models/probe','POST',{id:model.id});window.whaleToast?.(result.detail||'连接正常');}catch(error){window.whaleToast?.(error.message);}finally{test.disabled=false;}};const edit=el(row,'button','编辑','quiet');edit.type='button';edit.onclick=()=>editor(model);const remove=el(row,'button','删除','quiet');remove.type='button';remove.onclick=async()=>{if(!await confirmRemoval(model))return;await request('/api/models?id='+encodeURIComponent(model.id),'DELETE',{});values.delete(model.id);loadedAt=0;await render();paint();};}
      for(const [index,model] of data.models.entries()) {
        const row=list.children[index],custom=el(row,'button','泡泡','quiet');custom.type='button';
        custom.onclick=()=>{
          const dialog=el(document.body,'dialog','','api-model-card');el(dialog,'h3',model.name+' · 提醒布局');
          for(const [key,label,threshold] of [['balance','余额提醒','balanceBelow'],['budget','今日预算','dailyBudget'],['quota','额度提醒','quotaRemainingBelow']]) {
            const button=el(dialog,'button',label,'quiet');button.type='button';
            button.onclick=()=>{
              dialog.close();dialog.remove();document.getElementById('settings-dialog')?.close();
              const old=model.bubbleSettings?.[key]||{};
              const cfg={...old,layoutOnly:true,previewNotice:{apiName:model.name,apiBalance:'12.00 '+model.currency,apiCost:'0.08 '+model.currency,apiQuotaLeft:'75%'},on:Number.isFinite(model.alerts?.[threshold]),currency:model.currency,below:model.alerts?.[threshold]??5,amount:model.alerts?.[threshold]??10,
                lines:old.lines||[{type:'text',text:model.name+' '+label,size:6,bold:true},{type:'text',text:key==='budget'?'{api_cost}':key==='balance'?'{api_balance}':'{api_quota_left}',size:12,color:'#4059b3'}]};
              window.dispatchEvent(new CustomEvent('whale-edit-api-reminder',{detail:{key,config:cfg,save:async edited=>{
                try{const body={id:model.id,template:model.template,bubbleSettings:{[key]:edited}};
                  await request('/api/models','PUT',body);loadedAt=0;await load(true);window.whaleToast?.('模型提醒已保存');
                }catch(error){window.whaleToast?.(error.message);}
              }}}));
            };
          }
          const close=el(dialog,'button','关闭','quiet');close.type='button';close.onclick=()=>{dialog.close();dialog.remove();};
          dialog.addEventListener('cancel',event=>{event.preventDefault();close.click();});dialog.showModal();
        };
      }
      const add=el(root,'button','添加 API 模型','primary');add.type='button';add.onclick=()=>editor(null);
      el(root,'p','密钥只读取环境变量；配置文件不保存密钥内容。可为每个模型分别设置余额、每日 token 与剩余额度提醒。','help');
    }
    function confirmRemoval(model) {
      return new Promise(resolve=>{
        const dialog=el(document.body,'dialog','','api-model-card');el(dialog,'h3','删除 API 模型');
        el(dialog,'p','删除 '+model.name+'？引用它的气泡会显示未配置。');
        const actions=el(dialog,'div','','dialog-actions'),cancel=el(actions,'button','取消','quiet'),remove=el(actions,'button','删除','primary');
        const done=value=>{dialog.close();dialog.remove();resolve(value);};
        cancel.type=remove.type='button';cancel.onclick=()=>done(false);remove.onclick=()=>done(true);
        dialog.addEventListener('cancel',event=>{event.preventDefault();done(false);});dialog.showModal();cancel.focus();
      });
    }
    function editor(existing) {
      const overlay=el(document.body,'dialog','','api-model-card');
      el(overlay,'h3',existing?'编辑 API 模型':'添加 API 模型');
      const fields={},basic=el(overlay,'div','','api-model-fields');
      const field=(parent,name,label,type='text',value='')=>{
        const wrap=el(parent,'label',label),input=el(wrap,type==='select'?'select':'input');
        if(type!=='select')input.type=type;if(type==='number'){input.min='0';input.step='any';}
        fields[name]=input;input.dataset.field=name;input.value=value;return input;
      };
      const template=field(basic,'template','服务商模板','select');
      for(const item of registry.templates)template.append(new Option(item.name,item.id));
      template.value=existing?.template||'openai';
      const selected=()=>registry.templates.find(item=>item.id===template.value);
      field(basic,'name','显示名称','text',existing?.name||selected()?.name||'');
      field(basic,'keyEnv','密钥环境变量名','text',existing?.keyEnv??selected()?.keyEnv??'');
      field(basic,'currency','币种','text',existing?.currency||selected()?.currency||'USD');
      const section=title=>{const node=el(overlay,'details');el(node,'summary',title);return node;};
      const connection=section('接口与用量匹配');
      field(connection,'baseUrl','Base URL（需要时填写）','url',existing?.baseUrl||'');
      field(connection,'balanceUrl','自定义余额 URL','url',existing?.balanceUrl||'');
      field(connection,'balanceField','余额 JSON 路径','text',existing?.balanceField||'');
      field(connection,'usedField','累计用量 JSON 路径','text',existing?.usedField||'');
      field(connection,'scale','金额倍率','number',existing?.scale??selected()?.scale??1);
      field(connection,'matchIds','模型名匹配（逗号分隔）','text',(existing?.matchIds||selected()?.matchIds||[]).join(', '));
      el(connection,'p','自定义地址使用专用密钥环境变量；支持本机模型服务。','help');
      const reminders=section('独立提醒');
      field(reminders,'balanceBelow','余额低于时提醒','number',existing?.alerts?.balanceBelow??'');
      field(reminders,'dailyTokens','每日 token 达到时提醒','number',existing?.alerts?.dailyTokens??'');
      field(reminders,'dailyBudget','每日估算费用达到时提醒','number',existing?.alerts?.dailyBudget??'');
      field(reminders,'quotaRemainingBelow','剩余额度低于百分比时提醒','number',existing?.alerts?.quotaRemainingBelow??'');
      field(reminders,'balanceMessage','余额提醒文字','text',existing?.messages?.balance||'');
      field(reminders,'budgetMessage','预算提醒文字','text',existing?.messages?.budget||'');
      field(reminders,'quotaMessage','额度提醒文字','text',existing?.messages?.quota||'');
      el(reminders,'p','可使用 {api_name}、{api_balance}、{api_cost}、{api_quota_left}；留空使用默认文字。','help');
      const prices=section('价格估算（每百万 token）');
      for(const [key,label] of [['input','未缓存输入'],['cached','缓存输入'],['output','输出']])field(prices,key+'Price',label,'number',existing?.prices?.[key]??'');
      el(prices,'p','依据本机会话记录估算；请填写全部实际使用的 token 价格。','help');
      const manual=section('手动额度（覆盖接口显示）');
      const quotaMode=field(manual,'manualMode','计算方式','select');
      quotaMode.append(new Option('自行填写剩余值','manual'),new Option('按本机 token 自动扣减（估算）','auto'));quotaMode.value=existing?.manualQuota?.mode||'manual';
      const quotaPeriod=field(manual,'manualPeriod','重置周期','select');
      quotaPeriod.append(new Option('指定时间','none'),new Option('每天（北京时间）','daily'),new Option('每周一（北京时间）','weekly'));quotaPeriod.value=existing?.manualQuota?.period||'none';
      field(manual,'manualTotal','总额度','number',existing?.manualQuota?.total??'');
      field(manual,'manualRemaining','剩余额度','number',existing?.manualQuota?.remaining??'');
      const reset=existing?.manualQuota?.resetsAt;
      const localReset=reset?new Date(Date.parse(reset)-new Date(reset).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
      field(manual,'manualReset','重置时间','datetime-local',localReset);
      const baseline=field(manual,'manualResetBase','保存时从现在重新计数','checkbox');baseline.checked=false;
      el(manual,'p','这是自行录入值，重置后标记过期；清空三项可恢复接口查询。','help');
      template.onchange=()=>{
        const t=selected();if(!t)return;
        fields.name.value=t.name;fields.keyEnv.value=t.keyEnv||'';fields.currency.value=t.currency||'USD';
        fields.scale.value=t.scale||1;fields.matchIds.value=(t.matchIds||[]).join(', ');
        for(const key of ['baseUrl','balanceUrl','balanceField','usedField'])fields[key].value='';
      };
      const error=el(overlay,'p','','notice');error.hidden=true;
      const actions=el(overlay,'div','','dialog-actions'),cancel=el(actions,'button','取消','quiet'),save=el(actions,'button','保存','primary');
      const close=()=>{overlay.close();overlay.remove();};
      overlay.addEventListener('cancel',event=>{event.preventDefault();close();});
      cancel.type=save.type='button';cancel.onclick=close;
      save.onclick=async()=>{
        save.disabled=true;error.hidden=true;
        try{
          const body={id:existing?.id,template:template.value};
          for(const [key,input] of Object.entries(fields))if(key!=='template'&&!key.startsWith('manual'))body[key]=input.value.trim();
          body.scale=Number(body.scale);body.matchIds=body.matchIds.split(',').map(value=>value.trim()).filter(Boolean);
          const total=fields.manualTotal.value,remaining=fields.manualRemaining.value,date=fields.manualReset.value;
          body.manualQuota=total||remaining||date?{total,remaining,resetsAt:date,mode:fields.manualMode.value,period:fields.manualPeriod.value,resetBase:fields.manualResetBase.checked}:null;
          await request('/api/models','PUT',body);
          if(existing)values.delete(existing.id);close();loadedAt=0;await render();
        }catch(ex){error.textContent=ex.message;error.hidden=false;save.disabled=false;}
      };
      overlay.showModal();fields.name.focus();
    }
    document.getElementById('api-models-panel')?.addEventListener('toggle',event=>{if(event.target.open)render();});
  }
  window.WhaleApiModels={load,options,bind,clearBindings,text:module=>valueText(module,values.get(module.apiModelId)?.data),refresh:refreshValue};
  function monitor(){load().then(data=>Promise.allSettled(data.models.map(model=>refreshValue(model.id)))).catch(()=>{});}setInterval(monitor,60000);
  setInterval(()=>{if(bindings.size)paint();},1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initPanel();window.WhaleMoney?.onChange(paint);monitor();},{once:true});else{initPanel();window.WhaleMoney?.onChange(paint);monitor();}
})();





