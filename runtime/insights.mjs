import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {pricingSchedule} from './pricing-schedule.mjs';
import {readCodexRateLimits} from './codex-rate-limits.mjs';
export function createInsightsService(config,{readRateLimits=readCodexRateLimits,clock=Date.now}={}) {
  let cache=null,pending=null,lastKey='',worker=null,readerAbort=null,closed=false;
  function startRead(monitored,force) {
    if(closed)return Promise.resolve([{tokens:null,windows:[],observedAt:null},null]);
    if(pending){
      if(!force||pending.force)return pending.promise;
      return pending.promise.catch(()=>null).then(()=>startRead(monitored,true));
    }
    readerAbort=new AbortController();
    const currentAbort=readerAbort,current={force,promise:null};
    current.promise=Promise.all([monitored ? new Promise(resolve=>{
      worker=new Worker(new URL('./insights-worker.mjs',import.meta.url),{workerData:{codexHome:config.codexHome,now:clock()}});
      const currentWorker=worker;let finished=false;
      const done=data=>{if(finished)return;finished=true;clearTimeout(timeout);void currentWorker.terminate();if(worker===currentWorker)worker=null;resolve(data);};
      const timeout=setTimeout(()=>done({error:'observation-timeout'}),8000);timeout.unref();
      currentWorker.once('message',done);currentWorker.once('error',()=>done({error:'local-observation-unavailable'}));currentWorker.once('exit',()=>done({error:'local-observation-unavailable'}));
    }) : Promise.resolve({tokens:null,windows:[],observedAt:null}),
    readRateLimits({codexHome:config.codexHome,signal:currentAbort.signal}).catch(()=>null)]).finally(()=>{
      if(pending===current)pending=null;
      if(readerAbort===currentAbort)readerAbort=null;
    });
    pending=current;
    return current.promise;
  }
  async function get({force=false}={}) {
    const now=clock(), c=config.resolve(), pricing=pricingSchedule(c,now);
    const monitored=c.setting.monitorSessions !== false;
    let auth={},authChangedAt=0;try{const file=path.join(config.codexHome,'auth.json'),stat=fs.statSync(file);authChangedAt=stat.mtimeMs;if(stat.size<1024*1024)auth=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
    const subscribed=!c.key && c.id==='openai' && (auth.auth_mode==='chatgpt' || !!auth.tokens?.access_token);
    // A new account or API mode invalidates the old cached view. Credential stays local.
    const key=crypto.createHash('sha256').update(c.accountId+'\0'+String(auth.tokens?.account_id||'')+'\0'+String(monitored)).digest('hex');
    auth=null;
    if(lastKey!==key){cache=null;lastKey=key;}
    if(closed)return {ok:true,pricing,subscription:{available:false,windows:[],reason:'额度服务已关闭'},tokens:null};
    if(force || !cache || now-cache.at>30000){
      const [data,direct]=await startRead(monitored,force); if(key===lastKey)cache={at:clock(),data,direct};
    }
    const data=cache?.data||{},direct=cache?.direct;
    const windows=direct ? direct.windows : subscribed && data.observedAt>=authChangedAt ? data.windows||[] : [];
    const observedAt=direct?.observedAt || data.observedAt || null;
    const source=direct ? 'codex-app-server' : 'local-session';
    return {ok:true,pricing,tokens:data.tokens||null,subscription:{available:windows.length>0,windows,observedAt,source,
      planType:direct?.planType||null,
      reason:windows.length ? '' : direct ? 'Codex 当前未提供五小时或每周额度' : !subscribed ? '当前连接不是可识别的 ChatGPT 订阅登录' : '直接查询暂不可用，且尚未观测到本机会话额度记录',error:data.error||null}};
  }
  return {get,close(){closed=true;readerAbort?.abort();readerAbort=null;void worker?.terminate();worker=null;cache=null;}};
}
