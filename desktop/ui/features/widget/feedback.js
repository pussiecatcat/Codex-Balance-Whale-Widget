import { sound } from '../../services/sound.js';
import { UI_DEFAULTS } from '../../shared/ui-defaults.js';

  const storage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem() {} };
  const key = 'dshw-v3-feedback', events = { press: '按下', release: '松开', success: '完成提示', cancelled: '取消提示', failed: '拥挤失败提示' };
  const defaults = () => structuredClone(UI_DEFAULTS.feedback);
  const clone = value => JSON.parse(JSON.stringify(value));
  let settings = defaults();
  // 设置窗口保存后由主进程广播过来，这里重新读一次 localStorage 即可生效。
  function load() {
    settings = defaults();
    try { const saved = JSON.parse(storage.getItem(key)); if (saved) { settings.feel = saved.feel || settings.feel; for (const k of Object.keys(events)) if (saved.events?.[k]) settings.events[k] = saved.events[k]; } } catch {}
    sound.reload({ feedback: settings });
    return clone(settings);
  }
  load();
  function play(event, url, master = 1, override) {
    const cfg = (override || settings).events[event];
    if (!cfg) return false;
    sound.play(event, { url, volume: master, feedback: override || settings });
    return true;
  }
  function saveSettings(value) {
    const next = clone(value || defaults());
    storage.setItem(key, JSON.stringify(next));
    settings = next;
    sound.reload({ feedback: settings });
    return clone(settings);
  }
  function open() {
    const draft = JSON.parse(JSON.stringify(settings)), dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    const title = document.createElement('h2'); title.textContent = '音效、提示与手感'; dialog.append(title);
    const help = document.createElement('p'); help.textContent = '保存后生效；取消或 Esc 放弃本次修改。总音量仍控制所有事件。原音效使用现有音效组，新增预设为原创合成短音。'; dialog.append(help);
    const feelLabel = document.createElement('label'); feelLabel.textContent = '按压手感'; const feel = document.createElement('select');
    for (const [value, text] of Object.entries({ balanced: '均衡 · 220/220ms', crisp: '清脆 · 65/125ms', soft: '柔和 · 85/155ms' })) feel.add(new Option(text, value));
    feel.value = draft.feel; feel.onchange = () => { draft.feel = feel.value; }; feelLabel.append(feel); dialog.append(feelLabel);
    for (const [event, label] of Object.entries(events)) {
      const row = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label; row.append(legend);
      const select = document.createElement('select');
      for (const [value, text] of Object.entries({ original: '现有音效', pearl: '珍珠', bubble: '水泡', glass: '风铃', silent: '静音' })) { if (value === 'original' && !['press','release','success'].includes(event)) continue; select.add(new Option(text, value)); }
      select.value = draft.events[event].preset; select.onchange = () => { draft.events[event].preset = select.value; };
      const volume = document.createElement('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '.01'; volume.value = draft.events[event].volume; volume.setAttribute('aria-label', label + '音量');
      const number = document.createElement('output'); number.textContent = Math.round(volume.value * 100) + '%';
      volume.oninput = () => { draft.events[event].volume = Number(volume.value); number.textContent = Math.round(volume.value * 100) + '%'; };
      const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = '试听'; preview.onclick = () => play(event, sound.urlFor({ groupId: sound.snapshot().size.soundSet || 'duck', slot: event }), 1, draft);
      row.append(select, volume, number, preview); dialog.append(row);
    }
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.onclick = () => dialog.close();
    const save = document.createElement('button'); save.textContent = '保存'; save.className = 'primary'; save.onclick = () => { try { saveSettings(draft); dialog.close(); } catch { window.whaleToast?.('设置未能保存，请检查存储空间。'); } };
    actions.append(cancel, save); dialog.append(actions); dialog.addEventListener('close', () => { sound.stop(); dialog.remove(); }); document.body.append(dialog); dialog.showModal();
  }
export const WhaleFeedback = { play, open, save: saveSettings, reload: load, snapshot: () => clone(settings), defaults: () => clone(defaults()), get feel() { return settings.feel; } };
export default WhaleFeedback;

