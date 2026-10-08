import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function verifyDesktop({ app, window, screen, setHost, setTestCursor, dataDir, openedLinks, errors, renderInfo }) {
  if (process.env.WHALE_SURFACE_AUDIT === '1') {
    const { verifySurfaceLifecycle } = await import('./surface-lifecycle-regression.mjs');
    return verifySurfaceLifecycle({ app, window, screen, setHost, setTestCursor, dataDir, renderInfo });
  }
  const output = path.resolve(process.env.WHALE_DESKTOP_VERIFY_DIR);
  fs.mkdirSync(output, { recursive: true });
  const checks = [], ev = code => window.webContents.executeJavaScript(code);
  const wait = async (code, message, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await ev(code)) return; await delay(50); }
    throw new Error('Timed out: ' + message);
  };
  try {
    const area = screen.getPrimaryDisplay().workArea;
    const dip = { x: area.x + 24, y: area.y + 24, width: 700, height: 550 };
    await setHost({ hostAlive: true, hostPid: 123456, window: '0', visible: true, attached: true, bounds: screen.dipToScreenRect(null, dip) });
    await wait("document.querySelector('.dshwv-img')?.naturalWidth > 0 && localStorage.getItem('dshw-role') === 'default'", 'bad saved image falls back to the built-in role');
    await wait("window.__whaleRenderTest.status().balance === 12.3456 && !window.__whaleRenderTest.status().busy", 'startup size settings and initial data complete');
    assert.equal(window.isVisible(), true);
    checks.push('a missing saved image with retained metadata recovers a visible clickable default role on first launch');
    await ev('window.__whaleRenderTest.place(140, 140, false)'); await delay(450);
    const viewport = await ev("(() => {const r=document.querySelector('.dshwv-img').getBoundingClientRect(),p=document.querySelector('.dshwv-position'),root=document.querySelector('.dshwv-root');return {width:innerWidth,height:innerHeight,position:p.getBoundingClientRect().toJSON(),positionStyle:p.style.cssText,root:root.getBoundingClientRect().toJSON(),pet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};})()");
    assert.ok(viewport.pet.width > 0 && viewport.pet.height > 0 && viewport.pet.left >= 0 && viewport.pet.top >= 0 && viewport.pet.right <= viewport.width && viewport.pet.bottom <= viewport.height, 'the complete role rectangle must be inside the fixture viewport: ' + JSON.stringify(viewport));
    const mask = await ev("WhaleRendering.hitCache.prepare('/dsh-whale/role-image.png?id=role_audit_apng').then(mask=>({width:mask.width,height:mask.height,alpha:[...mask.alpha]}))");
    assert.deepEqual(mask, { width: 2, height: 2, alpha: [0, 0, 255, 255] });
    checks.push('Chromium decodes the real two-frame APNG and both first-frame and later-frame pixels are clickable');
    assert.equal(await ev("whaleDesktop.openExternal('https://example.org/no-user-click')"), false);
    const edge = await ev(`(() => {
      const img=document.querySelector('.dshwv-img'),root=document.querySelector('.dshwv-root'),body=document.querySelector('.dshwv-body');
      const r=img.getBoundingClientRect(),candidates=[],flipped=WhaleRendering.mirrorScale(root)<0;
      for(let y=Math.ceil(r.top)+1;y<r.bottom-1;y+=2)for(let x=Math.ceil(r.left)+1;x<r.right-1;x+=2){
        const target=document.elementFromPoint(x,y);
        if(target?.closest('.dshwv-menu-btn,.dshwv-pop'))continue;
        if(WhaleRendering.hitCache.hit(img,x,y,flipped))candidates.push({x,y});
      }
      const css=body.style.cssText,transform=body.style.transform;body.style.transition='none';body.style.transform='scaleY(0.88) scaleX(1.05)';
      const result=candidates.find(p=>!WhaleRendering.hitCache.hit(img,p.x,p.y,flipped));body.style.transform=transform;void body.offsetWidth;body.style.cssText=css;
      document.addEventListener('pointerdown',e=>{window.__auditPointer=e.pointerId;},true);
      return result;
    })()`);
    assert.ok(edge, 'the original role must provide a press-animation boundary point');
    setTestCursor(edge); window.webContents.sendInputEvent({ type: 'mouseMove', ...edge }); await delay(120);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...edge }); await delay(320);
    assert.equal(await ev(`WhaleRendering.hitCache.hit(document.querySelector('.dshwv-img'),${edge.x},${edge.y},WhaleRendering.mirrorScale(document.querySelector('.dshwv-root'))<0)`), false, 'the test pixel must become transparent while pressed');
    assert.equal(renderInfo().inputEnabled, true, 'a captured press must not make the window click-through');
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...edge });
    await wait("window.__whaleRenderTest.status().shown && !window.__whaleRenderTest.status().switching", 'accepted edge press completes its bubble click after moving alpha');
    checks.push('an actual boundary press keeps native input captured through squish and opens its bubble on release');
    await ev('window.__whaleRenderTest.close()'); await delay(350);
    await ev("window.__whaleRenderTest.scene([{type:'link',text:'审计测试链接',url:'https://example.org/whale-audit',size:3}],0)");
    await wait("!window.__whaleRenderTest.status().switching && !!document.querySelector('.dshwv-frame:not([inert]) [title=\"https://example.org/whale-audit\"]')", 'the real custom bubble link is rendered');
    await delay(500);
    const link = await ev("(() => {const e=document.querySelector('.dshwv-frame:not([inert]) [title=\"https://example.org/whale-audit\"]');const r=e.getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),left:r.left,top:r.top,right:r.right,bottom:r.bottom};})()");
    assert.ok(link.left >= 0 && link.top >= 0 && link.right <= viewport.width && link.bottom <= viewport.height);
    setTestCursor({ x: link.x, y: link.y });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: link.x, y: link.y }); await delay(100);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: link.x, y: link.y }); await delay(30);
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: link.x, y: link.y });
    const linkDeadline = Date.now() + 3000;
    while (openedLinks.length === 0 && Date.now() < linkDeadline) await delay(30);
    assert.deepEqual(openedLinks, ['https://example.org/whale-audit']);
    assert.equal(await ev("whaleDesktop.openExternal('https://example.org/repeated')"), false);
    checks.push('actual Electron input clicks the real custom-bubble link through enableLinkRun and opens exactly one allowed HTTP/S URL');
    // Feedback controls are exercised through the combined compact sound panel.
    await ev("window.__whaleRenderTest.close();document.querySelector('.dshwv-menu-btn').click()");
    await wait("document.querySelector('.dshwv-menu').classList.contains('dshwv-menu-open')", 'compact menu opens for sound settings');
    await ev("(async()=>{window.__soundBefore=await fetch('/dsh-whale/size.json',{cache:'no-store'}).then(r=>r.json());[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='全局设置').click()})()");
    await wait("!!document.querySelector('.whale-sound-mask .whale-sound-volume-row input[type=range]')", 'combined sound settings opens');
    await ev("(()=>{const e=document.querySelector('.whale-sound-mask .whale-sound-volume-row input[type=range]');e.value='0';e.dispatchEvent(new Event('input'));})()");
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await wait("!document.querySelector('.whale-sound-mask')", 'Escape dismisses the combined sound draft');
    assert.equal(await ev("fetch('/dsh-whale/size.json',{cache:'no-store'}).then(r=>r.json()).then(v=>v.vol===window.__soundBefore.vol)"), true);
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='全局设置').click()");
    await wait("!!document.querySelector('.whale-sound-mask .whale-sound-volume-row input[type=range]')", 'combined sound settings reopens for save');
    await ev("(()=>{const d=document.querySelector('.whale-sound-card'),e=d.querySelector('.whale-sound-volume-row input[type=range]');e.value='0';e.dispatchEvent(new Event('input'));[...d.querySelectorAll('button')].find(b=>b.textContent==='保存').click();})()");
    await wait("!document.querySelector('.whale-sound-mask')", 'combined sound settings save');
    assert.equal(await ev("fetch('/dsh-whale/size.json',{cache:'no-store'}).then(r=>r.json()).then(v=>v.vol)"), 0);
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='全局设置').click()");
    await wait("!!document.querySelector('.whale-sound-mask .whale-sound-volume-row input[type=range]')", 'combined sound settings reopens for cancel');
    await ev("(()=>{const d=document.querySelector('.whale-sound-card'),e=d.querySelector('.whale-sound-volume-row input[type=range]');e.value='.5';e.dispatchEvent(new Event('input'));[...d.querySelectorAll('button')].find(b=>b.textContent==='取消').click();})()");
    assert.equal(await ev("fetch('/dsh-whale/size.json',{cache:'no-store'}).then(r=>r.json()).then(v=>v.vol)"), 0);
    checks.push('combined sound panel saves independent event volume and discards Cancel and Escape drafts');
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='全局设置').click()");
    await wait("!!document.querySelector('.whale-sound-mask')", 'combined sound settings opens for screenshot');
    assert.equal(await ev("document.querySelectorAll('.whale-sound-card>.whale-sound-block').length"), 4);
    assert.equal(await ev("[...document.querySelectorAll('.whale-sound-card>.whale-sound-block')].find(b=>b.querySelector('.whale-sound-block-title')?.textContent==='每轮消耗提示').querySelector('.whale-sound-wide-action').textContent"), '编辑提示内容');
    fs.writeFileSync(path.join(output, 'feedback-v3.png'), (await window.webContents.capturePage()).toPNG());
    await ev("(()=>{const b=[...document.querySelectorAll('.whale-sound-card>.whale-sound-block')].find(b=>b.querySelector('.whale-sound-block-title')?.textContent==='按压音效'),e=b.querySelector('summary input[type=checkbox]');if(!e.checked){e.checked=true;e.dispatchEvent(new Event('change'))}})()");
    await ev("[...document.querySelectorAll('.whale-sound-card button')].find(b=>b.textContent==='新建音效组').click()");
    await wait("[...document.querySelectorAll('.dshwv-audiomask')].some(m=>m.style.display==='flex'&&m.querySelector('.dshwv-audiotitle')?.textContent==='新建音效组')", 'sound panel opens the functional audio-group editor');
    assert.equal(await ev("[...document.querySelectorAll('.dshwv-audiomask')].filter(m=>m.style.display==='flex').map(m=>m.querySelector('.dshwv-audiotitle')?.textContent).includes('新建音效组')"), true);
    await ev("[...document.querySelectorAll('.dshwv-audiomask')].find(m=>m.style.display==='flex'&&m.querySelector('.dshwv-audiotitle')?.textContent==='新建音效组').querySelector('.dshwv-cropbtn-no').click(); WhaleAccountView.setMode('subscription')"); await delay(100);
    assert.equal(await ev("[...document.querySelectorAll('.dshwv-menu button')].some(b=>b.textContent==='会员额度详情')"), false);
    await ev(`(async()=>{const original=window.fetch;window.__quotaFetches=[];window.fetch=async input=>{
      const url=String(input);
      window.__quotaFetches.push(url);
      if(url.startsWith('/api/insights'))return new Response(JSON.stringify({subscription:{source:'codex-app-server',planType:'plus',observedAt:Date.now(),windows:[
        {windowDurationMins:300,usedPercent:36.4,resetsAt:Date.now()+4876000},
        {windowDurationMins:10080,usedPercent:21,resetsAt:Date.now()+392876000}
      ]}}),{status:200,headers:{'Content-Type':'application/json'}});
      if(url==='/api/pricing')return new Response(JSON.stringify({visible:false}),{status:200,headers:{'Content-Type':'application/json'}});
      return original(input);
    };await WhaleQuota.refresh(true);window.fetch=original;
    if(document.querySelector('.dshwv-menu')?.classList.contains('dshwv-menu-open'))document.querySelector('.dshwv-menu-btn').click();
    document.querySelectorAll('#toast,.whale-toast,.toast').forEach(element=>element.remove());
    window.__whaleRenderTest.place(140,140,false);
    window.__whaleRenderTest.scene([
      {type:'plan',quotaStyle:'header',tpl:'{plan_name}'},
      {type:'quota',quotaStyle:'meter',windowDurationMins:300,row:1},
      {type:'quota',quotaStyle:'meter',windowDurationMins:10080,row:2}
    ],0);})()`);
    await wait("document.querySelectorAll('.dshwv-quota-meter').length===2&&[...document.querySelectorAll('.dshwv-quota-meter-number')].map(e=>e.textContent).join(',')==='63.6,79'", 'tide quota meters render live percentages');
    const tideMeters = await ev("[...document.querySelectorAll('.dshwv-quota-meter')].map(e=>({tone:e.dataset.quotaTone,label:e.querySelector('.dshwv-quota-meter-label').textContent,updated:e.querySelector('.dshwv-quota-meter-reset-label').textContent,reset:e.querySelector('.dshwv-quota-meter-reset').textContent,aria:e.getAttribute('aria-label'),fill:e.querySelector('.dshwv-quota-meter-fill').style.width}))");
    assert.deepEqual(tideMeters.map(value => ({ tone:value.tone, label:value.label, fill:value.fill })), [
      {tone:'steady',label:'5 小时',fill:'63.6%'},
      {tone:'steady',label:'每周',fill:'79%'}
    ]);
    assert.ok(tideMeters.every(value => value.aria.includes('剩余') && value.updated.includes('更新') && value.reset.includes(':')));
    assert.ok(await ev("window.__quotaFetches.includes('/api/insights?refresh=1')"));
    await delay(500);
    fs.writeFileSync(path.join(output, 'quota-tide.png'), (await window.webContents.capturePage()).toPNG());
    checks.push('Codex five-hour and weekly quota render as compact tide gauges with live percentages, reset countdowns and accessible labels');
    await ev("window.__whaleRenderTest.close()"); await delay(320);
    await ev("WhaleAccountView.setMode('api')");
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='素材包导入/导出').click()"); await delay(100);
    fs.writeFileSync(path.join(output, 'workshop-v3.png'), (await window.webContents.capturePage()).toPNG());
    await ev("document.querySelector('.whale-v3-dialog[open]').close(); [...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='桌面驻留').click()"); await delay(150);
    assert.equal((await ev("whaleDesktop.command('mode')")), 'standalone');
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='窗口随行').click()"); await delay(150);
    assert.equal((await ev("whaleDesktop.command('mode')")), 'follow-codex');
    checks.push('feedback and material-package panels render; redundant member details are absent and one mode button toggles both directions');
    assert.equal(await ev("whaleDesktop.command('desktop')"), true);
    await delay(180);
    await setHost({hostAlive:false,hostPid:0,window:'0',visible:false,attached:false});
    await delay(180);
    assert.equal(window.isVisible(), true, 'standalone survives missing Codex host');
    await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,dip)});
    assert.equal(await ev("whaleDesktop.command('follow')"), true);
    await delay(180);
    assert.equal(window.isVisible(), true);
    assert.equal(window.getBounds().width, dip.width);
    checks.push('real Electron commands switch to desktop, survive absent host and return to the follow viewport');
    const savedConfig=fs.readFileSync(path.join(dataDir,'fixture-codex','config.toml'),'utf8');
    assert.equal(await ev("WhaleAccountView.setMode('subscription')"),true);
    assert.equal(await ev("WhaleAccountView.mode"),'subscription');
    await ev("WhaleAccountView.toggleBubble(document.querySelector('.dshwv-root'))");
    await wait("document.querySelector('.whale-account-card')?.textContent.includes('本机近 7 天')",'subscription card uses real insights route');
    assert.equal(await ev("document.querySelector('.whale-account-card').textContent.includes('不能用百分比换算剩余 token')"),true);
    fs.writeFileSync(path.join(output,'subscription-mode.png'),(await window.webContents.capturePage()).toPNG());
    assert.equal(await ev("WhaleAccountView.setMode('api')"),true);
    assert.equal(await ev("!!document.querySelector('.whale-account-card')"),false);
    assert.equal(fs.readFileSync(path.join(dataDir,'fixture-codex','config.toml'),'utf8'),savedConfig);
    await ev("document.querySelector('.dshwv-menu-btn').click(); const r=document.createRange();r.selectNodeContents(document.querySelector('.dshwv-menu'));getSelection().addRange(r); window.dispatchEvent(new Event('whale-mode-changing'));");
    assert.equal(await ev("getSelection().toString()"),'');
    assert.equal(await ev("document.querySelector('.dshwv-menu').classList.contains('dshwv-menu-open')"),false);
    assert.equal(await ev("getComputedStyle(document.querySelector('.dshwv-menu')).userSelect"),'none');
    checks.push('API/member switch changes the card only, preserves Codex config, and mode transition closes menu and clears selection');
    const p=await ev("(()=>{const r=document.querySelector('.dshwv-img').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,dip),mouseButtons:1});
    setTestCursor(p);await delay(180);assert.equal(renderInfo().inputEnabled,false,'external drag never activates overlay');
    await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,dip),mouseButtons:0});
    setTestCursor(p);await delay(180);
    checks.push('external mouse drag is passed through instead of stealing the host cursor');
    window.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 }); await delay(180);
    const shapes=renderInfo().windowShape;
    assert.ok(shapes?.length>0);
    assert.ok(shapes.reduce((n,r)=>n+r.width*r.height,0)<dip.width*dip.height*.5,'empty client area is not a native overlay');
    checks.push('native shape stays bounded to the visible pet and controls');
    const scale=await ev('Number(devicePixelRatio)');
    const python=process.env.WHALE_TEST_PYTHON;
    if(python){
      const result=await promisify(execFile)(python,[fileURLToPath(new URL('./region-probe.py',import.meta.url)),window.getNativeWindowHandle().readBigUInt64LE().toString(),String(process.pid),String(Math.round(2*scale)),String(Math.round(400*scale)),String(Math.round(p.x*scale)),String(Math.round(p.y*scale))],{windowsHide:true});
      const region=JSON.parse(result.stdout);assert.notEqual(region.kind,0);assert.deepEqual(region.contains,[false,true]);
      fs.writeFileSync(path.join(output,'native-region.json'),JSON.stringify(region));
      checks.push('native Windows region excludes the empty Codex text area and includes the whale');
    }
    await wait("!!document.querySelector('.whale-account-switch select')", 'visible account mode selector mounts after widget creation');
    for (const [x,y] of [[0,0],[520,0],[0,370],[520,370]]) {
      await ev(`window.__whaleRenderTest.place(${x},${y},false);document.querySelector('.dshwv-menu-btn').click()`); await delay(300);
      assert.equal(await ev("(()=>{const r=document.querySelector('.dshwv-menu').getBoundingClientRect(),b=document.querySelector('.whale-account-switch select').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&b.top>=r.top&&b.bottom<=r.bottom})()"),true,'corner menu and mode selector remain within viewport');
      await ev("document.querySelector('.dshwv-menu-btn').click()");
    }
    await ev("document.querySelector('.dshwv-menu-btn').click()"); await delay(200);
    fs.writeFileSync(path.join(output,'control-panel.png'),(await window.webContents.capturePage()).toPNG());
    await ev("(()=>{const e=document.querySelector('.whale-account-switch select');e.value='subscription';e.dispatchEvent(new Event('change'));})()");
    await wait("WhaleAccountView.mode==='subscription'",'subscription switch works through its actual selector');
    assert.equal(await ev("!!document.querySelector('.dshwv-menu-open')"),true,'display switch does not close the menu');
    await ev("(()=>{const e=document.querySelector('.whale-account-switch select');e.value='api';e.dispatchEvent(new Event('change'));})()");
    await wait("WhaleAccountView.mode==='api'",'API switch works');
    assert.equal(await ev("!!document.querySelector('.dshwv-menu-open')"),true,'return to API keeps the same menu open');
    await ev("window.__shapeResizeStyle=document.createElement('style');__shapeResizeStyle.textContent='html.desktop .dshwv-menu{width:270px!important}';document.head.append(__shapeResizeStyle)");
    await wait("(()=>{const m=document.querySelector('.dshwv-menu').getBoundingClientRect();return __whaleShapeTest.status().rectangles.some(r=>r.x<=m.left&&r.y<=m.top&&r.x+r.width>=m.right&&r.y+r.height>=m.bottom)})()",'CSS-only layout changes update full native menu region');
    await ev("__shapeResizeStyle.remove()"); await delay(100);
    await ev("[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='API 设置').click()");
    await wait("document.querySelector('#settings-dialog').open",'settings entry opens');
    assert.equal(await ev("__whaleInputTest.hit({x:1,y:1})"),false,'an open dialog cannot intercept the transparent viewport corner');
    assert.equal(await ev("getComputedStyle(document.querySelector('#settings-dialog'),'::backdrop').backgroundColor"),'rgba(0, 0, 0, 0)');
    fs.writeFileSync(path.join(output,'api-settings.png'),(await window.webContents.capturePage()).toPNG());
    await ev("document.querySelector('#settings-dialog').close();[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent==='查看 API 消费记录').click()");
    await wait("document.querySelector('.dshwv-usage-more')",'usage overview loaded'); await delay(300);
    await ev("document.querySelector('.dshwv-usage-more').click()");
    await wait("document.querySelector('.dshwv-usage-wintitle')?.textContent==='API 消费记录'",'history modal loaded');
    assert.equal(await ev("getComputedStyle(document.querySelector('.dshwv-usage-mask')).backgroundColor"),'rgba(0, 0, 0, 0)');
    assert.equal(await ev("__whaleInputTest.hit({x:1,y:1})"),false,'a modal mask cannot intercept the transparent viewport corner');
    fs.writeFileSync(path.join(output,'usage-history.png'),(await window.webContents.capturePage()).toPNG());
    await ev("document.querySelector('.dshwv-usage-close').click();[...document.querySelectorAll('.dshwv-menu button')].find(b=>b.textContent.includes('返回控制面板')).click()"); await delay(300);
    const settingsInventory=await ev("document.querySelector('.dshwv-menuview').innerText");
    for(const label of ['数据显示','角色','大小','音效与提示','自定义泡泡','币种','刷新汇率','吸附与翻转','资源管理','API 设置','桌面驻留','素材包导入/导出'])assert.ok(settingsInventory.includes(label),'retained setting entry: '+label);
    for(const removed of ['音效与手感','会员额度详情','本地创意工坊'])assert.ok(!settingsInventory.includes(removed),'removed duplicate setting: '+removed);
    fs.writeFileSync(path.join(output,'compact-settings.png'),(await window.webContents.capturePage()).toPNG());
    await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,{...dip,width:360,height:320})});await delay(250);
    assert.equal(await ev("(()=>{const menu=document.querySelector('.dshwv-menu'),m=menu.getBoundingClientRect(),v=document.querySelector('.dshwv-menuview');menu.scrollTop=menu.scrollHeight;const last=[...v.querySelectorAll('button,select,input')].filter(e=>e.offsetParent).at(-1)?.getBoundingClientRect();return m.left>=0&&m.top>=0&&m.right<=innerWidth&&m.bottom<=innerHeight&&last&&last.bottom<=m.bottom})()"),true,'small viewport keeps the compact menu bounded and its final control reachable');
    fs.writeFileSync(path.join(output,'compact-settings-small.png'),(await window.webContents.capturePage()).toPNG());
    await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,dip)});
    await ev("WhaleAccountView.setMode('api')");
    checks.push('compact original-style menu retains the complete settings inventory and remains scrollable at 360x320');
    await ev("if(document.querySelector('.dshwv-menu-open'))document.querySelector('.dshwv-menu-btn').click()");
    checks.push('mode switch and details entry are discoverable; four corner menus fit and dialogs have no dimming backdrop');
    await ev("whaleDesktop.command('reset-position')"); await delay(350);
    const anchor=await ev("JSON.parse(localStorage.getItem('dshw-pos'))");
    assert.equal(anchor.hAnchor,'right');assert.equal(anchor.vAnchor,'bottom');
    assert.equal(await ev("(()=>{const r=document.querySelector('.dshwv-root').getBoundingClientRect();return r.left>innerWidth/2&&r.top>innerHeight/2&&r.right<=innerWidth&&r.bottom<=innerHeight})()"),true,'reset commits a visible bottom-right position');
    const remapsBefore=renderInfo().visibility.remaps;
    for(let cycle=0;cycle<6;cycle++){
      await ev("__whaleRenderTest.showCost(.003,{completionKind:'success',amount:.003,currency:'USD',costState:'observed',tokens:40,label:'本轮已观测消耗:'})");await delay(250);
      await ev("__whaleRenderTest.close()");await delay(350);
      const point=await ev("(()=>{const r=document.querySelector('.dshwv-img').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
      assert.ok(renderInfo().windowShape.some(r=>point.x>=r.x&&point.x<r.x+r.width&&point.y>=r.y&&point.y<r.y+r.height),'closing completion bubble retains whale in native region');
      assert.equal(window.isVisible(),true);
    }
    assert.equal(renderInfo().visibility.remaps,remapsBefore,'completion bubble cycles never hide/show the window');
    checks.push('bottom-right reset persists; six completion bubble close cycles retain whale region and never remap');
    await ev("document.querySelector('.dshwv-img').dispatchEvent(new Event('error'))");
    await wait("document.querySelector('.dshwv-img').src.startsWith('data:image/png') && document.querySelector('.dshwv-img').naturalWidth > 0", 'emergency default-role art decodes');
    assert.equal(await ev("document.querySelector('.dshwv-img').alt"), '小鲸鱼恢复占位图');
    checks.push('default-art failure handler produces network-independent visible emergency art');    fs.writeFileSync(path.join(output, 'desktop-audit.png'), (await window.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(output, 'desktop-audit.json'), JSON.stringify({ ok: true, checks, viewport, link, expectedMissingImageConsoleMessages: errors.filter(message => /404|ERR_FILE_NOT_FOUND/.test(message)).length, dataDir }, null, 2));
    // Only this isolated test renderer is deliberately stalled. Production
    // Codex and its real companion remain untouched.
    ev('for (;;) {}').catch(() => {});
    await delay(80);
    app.quit();
  } catch (error) {
    const dialogs=await ev("[...document.querySelectorAll('dialog')].map(d=>({open:d.open,text:d.textContent.slice(0,1800)}))").catch(()=>[]);
    fs.writeFileSync(path.join(output, 'desktop-audit.json'), JSON.stringify({ ok: false, checks, error: error.message, errors, dialogs, dataDir }, null, 2));
    throw error;
  }
}
