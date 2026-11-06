import { openOver } from '../../services/layers.js';
export function encodeWav(buffer) {
      var numCh = buffer.numberOfChannels;
      var sampleRate = buffer.sampleRate;
      var len = buffer.length;
      var bytesPerSample = 2;
      var blockAlign = numCh * bytesPerSample;
      var dataSize = len * blockAlign;
      var ab = new ArrayBuffer(44 + dataSize);
      var dv = new DataView(ab);
      function writeStr(offset, s) {
        for (var i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      dv.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, numCh, true);
      dv.setUint32(24, sampleRate, true);
      dv.setUint32(28, sampleRate * blockAlign, true);
      dv.setUint16(32, blockAlign, true);
      dv.setUint16(34, 16, true);
      writeStr(36, 'data');
      dv.setUint32(40, dataSize, true);
      var offset = 44;
      for (var i = 0; i < len; i++) {
        for (var c = 0; c < numCh; c++) {
          var v = buffer.getChannelData(c)[i];
          var s = Math.max(-1, Math.min(1, v));
          dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([ab], {
        type: 'audio/wav'
      });
    }

// Audio crop editor: waveform drawing, dual-handle selection, preview and
// WAV encoding. The caller builds the DOM and supplies the upload callback.
export function createAudioCropEditor({ window, elements, requestJson, uploadFragment,
  getFragments, setFragments, getGroups, setGroups, applySlot, renderGroups,
  refreshSlot, previewEnsure, refreshTaskEnd, requireSaved, assetFailure, assetNotice }) {
  const audioCropMask = elements.mask, audioCropCanvas = elements.canvas;
  const audioCropStart = elements.start, audioCropStartNum = elements.startNum;
  const audioCropEnd = elements.end, audioCropEndNum = elements.endNum;
  const audioCropDual = elements.dual, audioCropDualFill = elements.dualFill;
  const audioCropDualStart = elements.dualStart, audioCropDualEnd = elements.dualEnd;
  const audioCropZoomRange = elements.zoomRange, audioCropZoomNum = elements.zoomNum;
  const audioCropTime = elements.time, audioCropName = elements.name;
  const audioCropOk = elements.ok, audioCropPlay = elements.play, audioCropCancel = elements.cancel;
  let audioCropTarget = null, audioCropCtx = null, audioCropBuffer = null;
  let audioCropZoom = 1, audioCropOffset = 0;
  function updateAudioCropOkState() { audioCropOk.disabled = false; }
    function openAudioCrop(arrayBuf, fileName) {
      try {
        audioCropZoom = 1;
        audioCropOffset = 0;
        stopAudioCropPreview();
        if (!audioCropCtx) {
          try {
            audioCropCtx = new (window.AudioContext || window.webkitAudioContext)();
          } catch (err) {
            audioCropCtx = null;
          }
        }
        if (!audioCropCtx) {
          assetNotice('当前环境不支持音频解码');
          return;
        }
        audioCropCtx.decodeAudioData(arrayBuf, function (buf) {
          var policy = WhaleMediaGuard.getPolicy();
          if (!isFinite(buf.duration) || buf.duration <= 0 || buf.duration > policy.maxAudioSeconds ||
              buf.numberOfChannels > policy.maxAudioChannels || buf.sampleRate > policy.maxAudioSampleRate) {
            assetNotice('音频超出时长、声道或采样率限制，请选择较短的音频');
            return;
          }
          audioCropBuffer = buf;
          audioCropStart.value = '0';
          audioCropEnd.value = '100';
          audioCropStartNum.max = buf.duration.toFixed(3);
          audioCropEndNum.max = buf.duration.toFixed(3);
          audioCropZoomRange.value = '1';
          audioCropZoomNum.value = '1';
          drawAudioCrop();
          try {
            audioCropName.value = '';
          } catch (err) {}
          updateAudioCropOkState();
          // The crop dialog opens from the audio-group editor, which the sound panel
          // lifts to 27000; without its own lift it would open behind both.
          openOver(null, audioCropMask);
          audioCropMask.style.display = 'flex';
        }, function () {
          assetNotice('音频解码失败');
        });
      } catch (err) {}
    }
    function audioCropRange() {
      var b = audioCropBuffer;
      if (!b) return null;
      var s = Number(audioCropStart.value) / 100;
      var e = Number(audioCropEnd.value) / 100;
      if (e < s) {
        var t = s;
        s = e;
        e = t;
      }
      return {
        start: b.duration * s,
        end: b.duration * e,
        s: s,
        e: e
      };
    }
    function onAudioCropWheel(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var maxOff = Math.max(0, 1 - 1 / audioCropZoom);
      if (maxOff <= 0) return;
      var dx = (e.deltaY || 0) + (e.deltaX || 0);
      if (dx === 0) return;
      var move = dx / audioCropCanvas.width / audioCropZoom;
      audioCropOffset = Math.min(maxOff, Math.max(0, audioCropOffset + move));
      drawAudioCrop();
    }
    function drawAudioCrop(skipSync) {
      try {
        if (!audioCropBuffer) return;
        var r = audioCropRange();
        audioCropTime.textContent = r.start.toFixed(1) + 's – ' + r.end.toFixed(1) + 's' + '（共 ' + audioCropBuffer.duration.toFixed(1) + 's，缩放 x' + audioCropZoom.toFixed(1) + '）';
        var ctx = audioCropCanvas.getContext('2d');
        var W = audioCropCanvas.width, H = audioCropCanvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#f3f5fb';
        ctx.fillRect(0, 0, W, H);
        var ch = audioCropBuffer.getChannelData(0);
        var totalLen = ch.length;
        var viewStart = audioCropOffset;
        var viewSpan = 1 / audioCropZoom;
        ctx.strokeStyle = '#9fb0d9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x < W; x++) {
          var g0 = viewStart + x / W * viewSpan;
          var g1 = viewStart + (x + 1) / W * viewSpan;
          var i0 = Math.max(0, Math.floor(g0 * totalLen));
          var i1 = Math.max(i0 + 1, Math.min(totalLen - 1, Math.ceil(g1 * totalLen)));
          var mn = 0, mx = 0;
          for (var i = i0; i < i1; i++) {
            var v = ch[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
          var yTop = H / 2 - mx * H / 2;
          var yBot = H / 2 - mn * H / 2;
          ctx.moveTo(x, yTop);
          ctx.lineTo(x, yBot);
        }
        ctx.stroke();
        var vx0 = (r.s - viewStart) / viewSpan * W;
        var vx1 = (r.e - viewStart) / viewSpan * W;
        var drawX0 = Math.max(0, vx0);
        var drawX1 = Math.min(W, vx1);
        if (drawX1 > drawX0) {
          ctx.fillStyle = 'rgba(32,49,112,.25)';
          ctx.fillRect(drawX0, 0, drawX1 - drawX0, H);
          ctx.strokeStyle = '#203170';
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX0 + 0.5, 0.5, drawX1 - drawX0, H - 1);
        }
        ctx.strokeStyle = 'rgba(32,49,112,.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.stroke();
        if (!skipSync) {
          audioCropStartNum.value = r.start.toFixed(3);
          audioCropEndNum.value = r.end.toFixed(3);
          audioCropZoomRange.value = String(audioCropZoom);
          audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
        }
        try {
          var trackW = audioCropDual.clientWidth || 200;
          var usable = Math.max(1, trackW - 8);
          audioCropDualStart.style.left = 4 + r.s * usable + 'px';
          audioCropDualEnd.style.left = 4 + r.e * usable + 'px';
          audioCropDualFill.style.left = 4 + r.s * usable + 'px';
          audioCropDualFill.style.width = Math.max(0, (r.e - r.s) * usable) + 'px';
        } catch (err) {}
      } catch (err) {}
    }
    function onAudioCropStartInput() {
      syncAudioCropStartNum();
      drawAudioCrop();
    }
    function syncAudioCropStartNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropStartNum.value = (b.duration * Number(audioCropStart.value) / 100).toFixed(3);
    }
    function onAudioCropEndInput() {
      syncAudioCropEndNum();
      drawAudioCrop();
    }
    function syncAudioCropEndNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropEndNum.value = (b.duration * Number(audioCropEnd.value) / 100).toFixed(3);
    }
    function onAudioCropStartNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
    function onAudioCropStartNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) v = 0;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
    function onAudioCropEndNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
    function onAudioCropEndNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) v = b.duration;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
    function applyAudioCropZoom(v, skipSync) {
      if (!audioCropBuffer) return;
      var next = Number(v);
      if (!isFinite(next) || next < 1) next = 1;
      if (next > 50) next = 50;
      var r = audioCropRange();
      var mid = (r.s + r.e) / 2;
      var viewSpan = 1 / audioCropZoom;
      var midInView = viewSpan > 0 ? (mid - audioCropOffset) / viewSpan : 0.5;
      audioCropZoom = next;
      var newSpan = 1 / audioCropZoom;
      audioCropOffset = mid - midInView * newSpan;
      audioCropOffset = Math.min(1 - 1 / audioCropZoom, Math.max(0, audioCropOffset));
      audioCropZoomRange.value = String(audioCropZoom);
      audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
      drawAudioCrop(skipSync);
    }
    function onAudioCropZoomInput() {
      applyAudioCropZoom(audioCropZoomRange.value);
    }
    function onAudioCropZoomNumInput() {
      var v = Number(audioCropZoomNum.value);
      if (!isFinite(v) || v < 1) return;
      if (v > 50) return;
      applyAudioCropZoom(v, true);
    }
    function onAudioCropZoomNumChange() {
      applyAudioCropZoom(audioCropZoomNum.value);
    }
    var audioCropSelDrag = null;
    function onAudioCropSelDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      audioCropSelDrag = {
        startRatio: globalRatio,
        moved: false
      };
      audioCropStart.value = String(globalRatio * 100);
      syncAudioCropStartNum();
      drawAudioCrop();
    }
    function onAudioCropSelMove(e) {
      if (!audioCropSelDrag || !audioCropBuffer) return;
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      if (Math.abs(globalRatio - audioCropSelDrag.startRatio) > 0.002) audioCropSelDrag.moved = true;
      if (audioCropSelDrag.moved) {
        var s = Math.min(audioCropSelDrag.startRatio, globalRatio);
        var en = Math.max(audioCropSelDrag.startRatio, globalRatio);
        audioCropStart.value = String(s * 100);
        audioCropEnd.value = String(en * 100);
        syncAudioCropStartNum();
        syncAudioCropEndNum();
        drawAudioCrop();
      }
    }
    function onAudioCropSelUp() {
      audioCropSelDrag = null;
    }
    var audioCropDualDrag = null;
    function onAudioCropDualDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var ratio = audioCropDualRatio(e);
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      var dStart = Math.abs(ratio - startV);
      var dEnd = Math.abs(ratio - endV);
      audioCropDualDrag = {
        side: dStart <= dEnd ? 'start' : 'end'
      };
      audioCropDualMoveTo(ratio);
    }
    function onAudioCropDualMove(e) {
      if (!audioCropDualDrag || !audioCropBuffer) return;
      audioCropDualMoveTo(audioCropDualRatio(e));
    }
    function audioCropDualRatio(e) {
      var rect = audioCropDual.getBoundingClientRect();
      var usable = Math.max(1, rect.width - 8);
      var ratio = (e.clientX - rect.left - 4) / usable;
      return Math.min(1, Math.max(0, ratio));
    }
    function audioCropDualMoveTo(ratio) {
      if (!audioCropDualDrag) return;
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      if (audioCropDualDrag.side === 'start') {
        if (ratio >= endV) ratio = Math.max(0, endV - 0.0001);
        audioCropStart.value = String(ratio * 100);
        syncAudioCropStartNum();
      } else {
        if (ratio <= startV) ratio = Math.min(1, startV + 0.0001);
        audioCropEnd.value = String(ratio * 100);
        syncAudioCropEndNum();
      }
      drawAudioCrop();
    }
    function onAudioCropDualUp() {
      audioCropDualDrag = null;
    }
    function hideAudioCrop() {
      stopAudioCropPreview();
      audioCropMask.style.display = 'none';
      audioCropBuffer = null;
      audioCropTarget = null;
      try {
        audioCropName.value = '';
      } catch (err) {}
      updateAudioCropOkState();
    }
    var audioCropPreviewNode = null;
    function stopAudioCropPreview() {
      try {
        if (audioCropPreviewNode) {
          audioCropPreviewNode.stop();
          audioCropPreviewNode.disconnect();
          audioCropPreviewNode = null;
        }
      } catch (err) {}
    }
    function previewAudioCrop() {
      try {
        if (!audioCropBuffer || !audioCropCtx) return;
        stopAudioCropPreview();
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) return;
        var slice = audioCropCtx.createBuffer(audioCropBuffer.numberOfChannels, len, audioCropBuffer.sampleRate);
        for (var c = 0; c < audioCropBuffer.numberOfChannels; c++) {
          var src = audioCropBuffer.getChannelData(c);
          var dst = slice.getChannelData(c);
          var off = Math.floor(r.start * audioCropBuffer.sampleRate);
          for (var i = 0; i < len; i++) dst[i] = src[off + i] || 0;
        }
        var srcNode = audioCropCtx.createBufferSource();
        srcNode.buffer = slice;
        srcNode.connect(audioCropCtx.destination);
        audioCropPreviewNode = srcNode;
        srcNode.onended = function () {
          if (audioCropPreviewNode === srcNode) audioCropPreviewNode = null;
        };
        srcNode.start();
      } catch (err) {}
    }
    function confirmAudioCrop() {
      try {
        if (!audioCropBuffer) return;
        stopAudioCropPreview();
        var fragName = String(audioCropName.value || '').trim();
        if (!fragName) {
          try {
            audioCropName.style.borderColor = '#e0433f';
            audioCropName.style.boxShadow = '0 0 0 2px rgba(224,67,63,.25)';
            audioCropName.focus();
            setTimeout(function () {
              audioCropName.style.borderColor = 'rgba(32,49,112,.4)';
              audioCropName.style.boxShadow = 'none';
            }, 1200);
          } catch (err) {}
          return;
        }
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) {
          assetNotice('所选片段为空');
          return;
        }
        if (44 + len * audioCropBuffer.numberOfChannels * 2 > WhaleMediaGuard.getPolicy().audioBytes) {
          assetNotice('所选音频片段过大，请缩短后再保存');
          return;
        }
        var slice = audioCropCtx.createBuffer(audioCropBuffer.numberOfChannels, len, audioCropBuffer.sampleRate);
        for (var c = 0; c < audioCropBuffer.numberOfChannels; c++) {
          var src = audioCropBuffer.getChannelData(c);
          var dst = slice.getChannelData(c);
          var off = Math.floor(r.start * audioCropBuffer.sampleRate);
          for (var i = 0; i < len; i++) dst[i] = src[off + i] || 0;
        }
        var blob = encodeWav(slice);
        WhaleMediaGuard.checkFile(blob, 'wav');
        var reader = new FileReader();
        reader.onload = function () {
          uploadAudioFragment(reader.result, fragName, function (ok) {
            if (ok) {
              if (lastUploadedFragmentId && audioCropTarget) applySlot(audioCropTarget, lastUploadedFragmentId);
              previewEnsure(true);
              hideAudioCrop();
            }
          });
        };
        reader.onerror = function () { assetNotice('音频读取失败，请重试'); };
        reader.readAsDataURL(blob);
      } catch (err) { assetNotice(err.message); }
    }
    var lastUploadedFragmentId = null;
    function uploadAudioFragment(dataUrl, name, cb) {
      try {
        uploadFragment(name, dataUrl).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.fragments)) {
            setFragments(d.fragments);
            lastUploadedFragmentId = d.id || null;
            refreshTaskEnd();
            if (cb) cb(true);
          } else {
            if (cb) cb(false);
          }
        }).catch(function (error) {
          assetFailure(error);
          if (cb) cb(false);
        });
      } catch (err) {
        if (cb) cb(false);
      }
    }
  audioCropCancel.addEventListener('click', hideAudioCrop);
  audioCropOk.addEventListener('click', confirmAudioCrop);
  audioCropPlay.addEventListener('click', previewAudioCrop);
  audioCropStart.addEventListener('input', onAudioCropStartInput);
  audioCropEnd.addEventListener('input', onAudioCropEndInput);
  audioCropStartNum.addEventListener('input', onAudioCropStartNumInput);
  audioCropStartNum.addEventListener('change', onAudioCropStartNumChange);
  audioCropEndNum.addEventListener('input', onAudioCropEndNumInput);
  audioCropEndNum.addEventListener('change', onAudioCropEndNumChange);
  audioCropZoomRange.addEventListener('input', onAudioCropZoomInput);
  audioCropZoomNum.addEventListener('input', onAudioCropZoomNumInput);
  audioCropZoomNum.addEventListener('change', onAudioCropZoomNumChange);
  audioCropCanvas.addEventListener('wheel', onAudioCropWheel, { passive: false });
  audioCropCanvas.addEventListener('pointerdown', onAudioCropSelDown);
  audioCropCanvas.addEventListener('pointermove', onAudioCropSelMove);
  audioCropCanvas.addEventListener('pointerup', onAudioCropSelUp);
  audioCropCanvas.addEventListener('pointercancel', onAudioCropSelUp);
  audioCropDual.addEventListener('pointerdown', onAudioCropDualDown);
  audioCropDual.addEventListener('pointermove', onAudioCropDualMove);
  audioCropDual.addEventListener('pointerup', onAudioCropDualUp);
  audioCropDual.addEventListener('pointercancel', onAudioCropDualUp);
  audioCropName.addEventListener('input', updateAudioCropOkState);
  return { open: openAudioCrop, hide: hideAudioCrop, confirm: confirmAudioCrop, setTarget: slot => { audioCropTarget = slot; }, mask: audioCropMask };
}
