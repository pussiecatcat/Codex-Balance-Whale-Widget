import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiModelRegistry, API_TEMPLATES, pickJsonPath } from '../runtime/api-models.mjs';
import { cleanUrl } from '../runtime/config.mjs';

const fixture = t => { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'whale-api-models-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir; };
const response = value => ({ok:true,headers:{get(){return null;}},text:async()=>JSON.stringify(value)});

test('report catalog exposes all 34 templates and nested JSON paths are safe', () => {
  assert.equal(Object.keys(API_TEMPLATES).length, 34);
  assert.equal(pickJsonPath({a:{b:[{c:7}]}},'a.b[0].c'),7);
  assert.equal(pickJsonPath({},'__proto__.polluted'),undefined);
});

test('model registry keeps only environment names and parses balance and multi-window quota', async t => {
  const dir=fixture(t),calls=[];
  const registry=new ApiModelRegistry({dataDir:dir,env:{DEEPSEEK_API_KEY:'secret-value',OPENCODE_GO_API_KEY:'quota-secret'},fetchImpl:async(url,init)=>{calls.push({url,auth:init.headers.authorization});return url.includes('opencode.ai')?response({usage:{rolling:{percent:25,resetsAt:'2026-10-02T12:00:00Z'},weekly:{percent:60,resetsAt:'2026-10-05T12:00:00Z'},monthly:{percent:10,resetsAt:'2026-11-01T00:00:00Z'}}}):response({balance_infos:[{total_balance:'12.50'}]});}});
  registry.save({id:'deep',template:'deepseek'});registry.save({id:'go',template:'opencode_go'});
  const saved=fs.readFileSync(path.join(dir,'api-models.json'),'utf8');assert.equal(saved.includes('secret-value'),false);assert.equal(saved.includes('quota-secret'),false);
  const balance=await registry.read('deep');assert.equal(balance.balance,12.5);assert.equal(balance.currency,'CNY');
  const quota=await registry.read('go');assert.deepEqual(quota.windows.map(item=>item.key),['rolling','weekly','monthly']);assert.equal(quota.windows[1].usedPercent,60);
  assert.equal(calls[0].auth,'Bearer secret-value');
});

test('cloud metadata and link-local destinations are rejected while local model servers remain allowed', () => {
  for(const url of ['https://metadata.google.internal/latest','https://100.100.100.200/latest','https://169.254.169.254/latest','https://0.1.2.3/test','https://[fe80::1]/'])assert.throws(()=>cleanUrl(url),/元数据|链路本地/);
  assert.equal(cleanUrl('http://127.0.0.1:11434/v1'),'http://127.0.0.1:11434/v1');
});

test('optimistic reconciliation rejects stale revisions and keeps a bounded correction log', async t => {
  const {UsageLedger}=await import('../runtime/ledger.mjs');const dir=fixture(t),ledger=new UsageLedger(dir),scope='a'.repeat(24)+'-CNY',now=Date.parse('2026-10-02T02:00:00Z');
  ledger.observe(scope,{totalBalance:90,totalUsed:null},now);
  const first=ledger.reconcile(scope,{revision:ledger.records(scope,now).revision,date:'2026-10-02',opening:100,credits:0,otherDebits:0,last:90},now+1);assert.equal(first.amount,10);assert.equal(first.revision,2);
  assert.throws(()=>ledger.reconcile(scope,{revision:0,opening:100,credits:0,otherDebits:0,last:80},now+2),error=>error.status===409);
  assert.equal(ledger.records(scope,now+2).today.source,'balance-corrected');
});

test('template scale survives edits, blank alerts clear, and foreign destinations cannot receive provider credentials', async t => {
  const registry=new ApiModelRegistry({dataDir:fixture(t),env:{NOVITA_API_KEY:'fixture-key'},fetchImpl:async()=>response({availableBalance:125000})});
  registry.save({id:'nov',template:'novita',balanceBelow:10});
  assert.equal((await registry.read('nov')).balance,12.5);
  registry.save({id:'nov',template:'novita',name:'edited',balanceBelow:''});
  assert.equal(registry.model('nov').scale,.0001);assert.deepEqual(registry.model('nov').alerts,{});
  assert.throws(()=>registry.save({id:'nov',template:'novita',balanceUrl:'https://example.invalid/balance'}),/专用密钥/);
  registry.save({id:'nov',template:'novita',balanceUrl:'https://example.invalid/balance',keyEnv:'MY_PRIVATE_GATEWAY_KEY'});
});

test('billing subscription and usage endpoints combine distinct units without duplicating /v1', async t => {
  const calls=[],registry=new ApiModelRegistry({dataDir:fixture(t),env:{CUSTOM_API_KEY:'fixture-key'},fetchImpl:async(url,init)=>{
    calls.push(url);assert.equal(init.redirect,'error');return response(url.endsWith('/subscription')?{hard_limit_usd:20}:{total_usage:1234});
  }});
  registry.save({id:'gateway',template:'openai_compat',baseUrl:'http://192.168.1.2:8000/v1'});
  assert.equal((await registry.read('gateway')).balance,7.66);
  assert.ok(calls.every(url=>!url.includes('/v1/v1')));
  assert.equal((await registry.read('gateway',{probe:true})).ok,true);
});

test('unavailable balance is explicit without a key; manual quotas and incomplete estimates remain truthful', async t => {
  const registry=new ApiModelRegistry({dataDir:fixture(t),env:{},fetchImpl:async()=>{throw Error('unexpected network');}});
  registry.save({id:'open',template:'openai'});assert.equal((await registry.read('open')).noBalanceApi,true);
  registry.save({id:'open',template:'openai',manualQuota:{remaining:25,total:100,resetsAt:'2030-01-01T00:00:00Z'},inputPrice:2,outputPrice:10});
  const value=await registry.read('open');assert.equal(value.windows[0].usedPercent,75);assert.equal(value.source,'manual');
  assert.equal(registry.estimate(registry.model('open'),{byModel:{gpt:{input_tokens:1e6,output_tokens:1e6}}}),12);
  assert.equal(registry.estimate(registry.model('open'),{byModel:{gpt:{input_tokens:1e6,cached_input_tokens:5}}}),null);
  registry.save({id:'open',template:'openai',manualQuota:null});assert.equal((await registry.read('open')).noBalanceApi,true);
});

test('missing quota fields are unknown and HTTP 200 business errors fail probes', async t => {
  const registry=new ApiModelRegistry({dataDir:fixture(t),env:{KIMI_CODING_KEY:'fixture-key'},fetchImpl:async()=>response({success:false})});
  registry.save({id:'kimi',template:'kimi_coding'});
  assert.equal(registry.quotaResult('kimi',{},{percent:'missing',resetAt:'missing'}).available,false);
  await assert.rejects(registry.read('kimi',{probe:true}),/业务错误/);
});

test('ledger changes invalidate reconciliation, reject bad decimal amounts, and archive before pruning', async t => {
  const {UsageLedger}=await import('../runtime/ledger.mjs');const dir=fixture(t),ledger=new UsageLedger(dir),scope='b'.repeat(24)+'-USD',now=Date.parse('2026-10-02T02:00:00Z');
  ledger.observe(scope,{totalBalance:100},now);const revision=ledger.records(scope,now).revision;
  ledger.observe(scope,{totalBalance:90},now+100);
  ledger.observe(scope,{totalBalance:1},now-100);assert.equal(ledger.load(scope).lastObservation.balance,90);
  assert.throws(()=>ledger.reconcile(scope,{revision,opening:100,credits:0,otherDebits:0,last:90},now+101),error=>error.status===409);
  const latest=ledger.records(scope,now).revision;
  for(const raw of ['',null,'-1','1e3','0.123456789'])assert.throws(()=>ledger.reconcile(scope,{revision:latest,opening:raw,credits:0,otherDebits:0,last:0},now),/校正金额/);
  ledger.append(scope,{id:'historic',ts:now-100*86400000});
  const archived=JSON.parse(fs.readFileSync(ledger.archiveFile(scope),'utf8'));assert.equal(archived.events[0].id,'historic');assert.equal(ledger.load(scope).events.length,0);
});

test('automatic DIY quotas use their local token baseline and support reset periods', async t => {
  const registry=new ApiModelRegistry({dataDir:fixture(t),env:{}});
  registry.save({id:'budget',template:'openai',manualQuota:{remaining:800,total:1000,resetsAt:'2030-01-01T00:00:00Z',mode:'auto'}});
  const value=await registry.read('budget',{usage:{todayTokens:300}});
  assert.equal(value.windows[0].usedPercent,50);assert.equal(value.source,'local-estimate');
  registry.save({id:'budget',template:'openai',manualQuota:{remaining:1000,total:1000,resetsAt:'2030-01-01T00:00:00Z',mode:'auto',period:'daily',resetBase:true}});
  assert.equal(new Date(registry.quotaPeriodStart(registry.model('budget'))+8*3600000).getUTCHours(),0);
  assert.equal(registry.quotaStart(registry.model('budget')),registry.model('budget').manualQuota.baseAt);
});

test('eight-decimal correction uses fixed point even when float additions would lose a unit', async t => {
  const {UsageLedger}=await import('../runtime/ledger.mjs');const ledger=new UsageLedger(fixture(t)),scope='c'.repeat(24)+'-USD',now=Date.now();
  const result=ledger.reconcile(scope,{revision:0,opening:'0.10000000',credits:'0.20000000',otherDebits:'0',last:'0.29999999'},now);
  assert.equal(result.amount,0.00000001);
});
