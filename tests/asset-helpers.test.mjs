import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetHelpers } from '../desktop/ui/features/widget/asset-helpers.js';

test('asset failures are toasts, warnings are de-duplicated and save replies are checked', () => {
  const toasts = [];
  const helpers = createAssetHelpers({ window: { whaleToast: message => toasts.push(message) }, FileReader: class {} });
  helpers.failure(new Error('导入失败'));
  helpers.warning({ warning: '仅保留前 100 帧' });
  helpers.warning({ warning: '仅保留前 100 帧' });
  assert.deepEqual(toasts, ['导入失败', '仅保留前 100 帧']);
  assert.throws(() => helpers.requireSaved({ ok: false, error: '磁盘已满' }), /磁盘已满/);
  assert.deepEqual(helpers.requireSaved({ ok: true }), { ok: true });
});

test('mediaDataUrl resolves the FileReader result and rejects a failed read', async () => {
  class Reader {
    readAsDataURL() { this.onload(); }
  }
  const helpers = createAssetHelpers({ window: {}, FileReader: Reader });
  const original = Reader.prototype.readAsDataURL;
  Reader.prototype.readAsDataURL = function () { this.result = 'data:image/png;base64,AA'; this.onload(); };
  assert.equal(await helpers.mediaDataUrl({}), 'data:image/png;base64,AA');
  Reader.prototype.readAsDataURL = function () { this.onerror(); };
  await assert.rejects(helpers.mediaDataUrl({}), /文件读取失败/);
  Reader.prototype.readAsDataURL = original;
});
