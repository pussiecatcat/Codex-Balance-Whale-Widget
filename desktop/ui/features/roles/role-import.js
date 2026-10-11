import { createLifecycle } from '../../services/lifecycle.js';
import { requestJson } from '../../services/request.js';

export function createRoleImport(ports) {
const lifecycle = createLifecycle();
var CROP_BOX = 260;
var cropMask = ports.document.createElement('div');
cropMask.className = 'dshwv-cropmask';
cropMask.style.display = 'none';
var cropCard = ports.document.createElement('div');
cropCard.className = 'dshwv-cropwin';
var cropTitle = ports.document.createElement('div');
cropTitle.className = 'dshwv-croptitle';
cropTitle.textContent = '裁剪角色图片';
var cropBox = ports.document.createElement('div');
cropBox.className = 'dshwv-cropbox';
var cropCanvas = ports.document.createElement('canvas');
cropCanvas.width = CROP_BOX;
cropCanvas.height = CROP_BOX;
cropBox.appendChild(cropCanvas);
var cropZoom = ports.document.createElement('input');
cropZoom.type = 'range';
cropZoom.min = '0.3';
cropZoom.max = '3';
cropZoom.step = '0.01';
cropZoom.value = '1';
cropZoom.className = 'dshwv-cropzoom';
var cropZoomWrap = ports.document.createElement('div');
cropZoomWrap.className = 'dshwv-cropctrl';
var cropZoomLabel = ports.document.createElement('span');
cropZoomLabel.className = 'dshwv-croplabel';
cropZoomLabel.textContent = '缩放';
var cropZoomNum = ports.document.createElement('input');
cropZoomNum.type = 'number';
cropZoomNum.min = '30';
cropZoomNum.max = '300';
cropZoomNum.step = '1';
cropZoomNum.value = '100';
cropZoomNum.className = 'dshwv-cropnum';
cropZoomWrap.appendChild(cropZoomLabel);
cropZoomWrap.appendChild(cropZoom);
cropZoomWrap.appendChild(cropZoomNum);
var cropNameInput = ports.document.createElement('input');
cropNameInput.type = 'text';
cropNameInput.className = 'dshwv-cropname';
cropNameInput.maxLength = 16;
cropNameInput.placeholder = '角色名称';
var cropAngleWrap = ports.document.createElement('div');
cropAngleWrap.className = 'dshwv-cropctrl';
var cropAngleLabel = ports.document.createElement('span');
cropAngleLabel.className = 'dshwv-croplabel';
cropAngleLabel.textContent = '旋转';
var cropFlipHBtn = ports.document.createElement('button');
cropFlipHBtn.type = 'button';
cropFlipHBtn.className = 'dshwv-cropflip';
cropFlipHBtn.textContent = '⇋';
cropFlipHBtn.title = '水平翻转';
var cropFlipVBtn = ports.document.createElement('button');
cropFlipVBtn.type = 'button';
cropFlipVBtn.className = 'dshwv-cropflip';
cropFlipVBtn.textContent = '⇅';
cropFlipVBtn.title = '垂直翻转';
var cropAngle = ports.document.createElement('input');
cropAngle.type = 'range';
cropAngle.min = '-360';
cropAngle.max = '360';
cropAngle.step = '1';
cropAngle.value = '0';
cropAngle.className = 'dshwv-cropzoom';
var cropAngleNum = ports.document.createElement('input');
cropAngleNum.type = 'number';
cropAngleNum.min = '-360';
cropAngleNum.max = '360';
cropAngleNum.step = '1';
cropAngleNum.value = '0';
cropAngleNum.className = 'dshwv-cropnum';
cropAngleWrap.appendChild(cropAngleLabel);
cropAngleWrap.appendChild(cropFlipHBtn);
cropAngleWrap.appendChild(cropFlipVBtn);
cropAngleWrap.appendChild(cropAngle);
cropAngleWrap.appendChild(cropAngleNum);
var cropBtns = ports.document.createElement('div');
cropBtns.className = 'dshwv-cropbtns';
var cropCancelBtn = ports.document.createElement('button');
cropCancelBtn.type = 'button';
cropCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
cropCancelBtn.textContent = '取消';
var cropResetBtn = ports.document.createElement('button');
cropResetBtn.type = 'button';
cropResetBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
cropResetBtn.textContent = '重置';
cropResetBtn.title = '重置缩放、旋转和位置';
var cropOkBtn = ports.document.createElement('button');
cropOkBtn.type = 'button';
cropOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
cropOkBtn.textContent = '确认';
cropBtns.appendChild(cropCancelBtn);
cropBtns.appendChild(cropResetBtn);
cropBtns.appendChild(cropOkBtn);
cropCard.appendChild(cropTitle);
cropCard.appendChild(cropBox);
cropCard.appendChild(cropNameInput);
cropCard.appendChild(cropZoomWrap);
cropCard.appendChild(cropAngleWrap);
cropCard.appendChild(cropBtns);
cropMask.appendChild(cropCard);
ports.document.body.appendChild(cropMask);
lifecycle.listen(cropBox, 'pointerdown', onCropDown);
lifecycle.listen(cropBox, 'pointermove', onCropMove);
lifecycle.listen(cropBox, 'pointerup', onCropUp);
lifecycle.listen(cropBox, 'pointercancel', onCropUp);
lifecycle.listen(cropBox, 'pointerleave', onCropUp);
lifecycle.listen(cropBox, 'wheel', onCropWheel, {
      passive: false
    });
lifecycle.listen(cropAngle, 'input', function () {
      if (cropState) {
        cropState.rotation = clampAngle(Number(cropAngle.value));
        cropAngleNum.value = String(cropState.rotation);
        positionCrop();
      }
    });
lifecycle.listen(cropAngleNum, 'input', function () {
      if (cropState) {
        var v = Math.round(Number(cropAngleNum.value));
        if (!isFinite(v)) v = 0;
        cropState.rotation = clampAngle(v);
        cropAngle.value = String(cropState.rotation);
        positionCrop();
      }
    });
lifecycle.listen(cropAngleNum, 'change', function () {
      if (cropState) cropAngleNum.value = String(cropState.rotation);
    });
lifecycle.listen(cropZoom, 'input', function () {
      if (cropState) {
        cropState.zoom = Number(cropZoom.value);
        cropZoomNum.value = String(Math.round(cropState.zoom * 100));
        positionCrop();
      }
    });
lifecycle.listen(cropZoomNum, 'input', function () {
      if (cropState) {
        var pct = Number(cropZoomNum.value);
        if (!isFinite(pct)) pct = 100;
        cropState.zoom = Math.min(3, Math.max(0.3, pct / 100));
        cropZoom.value = String(cropState.zoom);
        positionCrop();
      }
    });
lifecycle.listen(cropZoomNum, 'change', function () {
      if (cropState) cropZoomNum.value = String(Math.round(cropState.zoom * 100));
    });
lifecycle.listen(cropCancelBtn, 'click', function () {
      hideCropModal();
    });
lifecycle.listen(cropResetBtn, 'click', function () {
      resetCrop();
    });
lifecycle.listen(cropOkBtn, 'click', function () {
      confirmCrop();
    });
lifecycle.listen(cropFlipHBtn, 'click', function (e) {
      e.stopPropagation();
      flipCrop('H');
    });
lifecycle.listen(cropFlipVBtn, 'click', function (e) {
      e.stopPropagation();
      flipCrop('V');
    });
var gifMask = ports.document.createElement('div');
gifMask.className = 'dshwv-gifmask';
gifMask.style.display = 'none';
var gifCard = ports.document.createElement('div');
gifCard.className = 'dshwv-gifwin';
var gifTitle = ports.document.createElement('div');
gifTitle.className = 'dshwv-giftitle';
gifTitle.textContent = '导入动图角色';
var gifPreviewBox = ports.document.createElement('div');
gifPreviewBox.className = 'dshwv-gifpreview';
var gifPreviewImg = ports.document.createElement('img');
gifPreviewImg.className = 'dshwv-gifpreviewimg';
gifPreviewImg.alt = '动图预览';
gifPreviewImg.draggable = false;
gifPreviewBox.appendChild(gifPreviewImg);
var gifHint = ports.document.createElement('div');
gifHint.className = 'dshwv-gifhint';
gifHint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
var gifNameInput = ports.document.createElement('input');
gifNameInput.type = 'text';
gifNameInput.className = 'dshwv-gifname';
gifNameInput.maxLength = 16;
gifNameInput.placeholder = '角色名称';
var gifBtns = ports.document.createElement('div');
gifBtns.className = 'dshwv-cropbtns';
var gifCancelBtn = ports.document.createElement('button');
gifCancelBtn.type = 'button';
gifCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
gifCancelBtn.textContent = '取消';
var gifOkBtn = ports.document.createElement('button');
gifOkBtn.type = 'button';
gifOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
gifOkBtn.textContent = '确认';
gifBtns.appendChild(gifCancelBtn);
gifBtns.appendChild(gifOkBtn);
gifCard.appendChild(gifTitle);
gifCard.appendChild(gifPreviewBox);
gifCard.appendChild(gifHint);
gifCard.appendChild(gifNameInput);
gifCard.appendChild(gifBtns);
gifMask.appendChild(gifCard);
ports.document.body.appendChild(gifMask);
lifecycle.listen(gifCancelBtn, 'click', hideGifRoleModal);
lifecycle.listen(gifOkBtn, 'click', confirmGifRole);
var gifRoleDataUrl = null;
var gifRoleAnimType = 'gif';
function openGifRoleModal(dataUrl, fileName, animType) {
      gifRoleDataUrl = dataUrl;
      gifRoleAnimType = animType === 'apng' ? 'apng' : 'gif';
      if (gifRoleAnimType === 'apng') {
        gifTitle.textContent = '导入 APNG 动图角色';
        gifHint.textContent = 'APNG 动图不支持裁剪，将按原始尺寸原样导入';
      } else {
        gifTitle.textContent = '导入 GIF 动图角色';
        gifHint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
      }
      gifNameInput.value = '';
      gifPreviewImg.src = dataUrl;
      gifMask.style.display = 'flex';
    }
function hideGifRoleModal() {
      gifMask.style.display = 'none';
      gifRoleDataUrl = null;
      gifRoleAnimType = 'gif';
      gifPreviewImg.src = '';
    }
function confirmGifRole() {
      try {
        var name = (gifNameInput.value || '').trim().slice(0, 16) || '新角色';
        if (!gifRoleDataUrl) {
          hideGifRoleModal();
          return;
        }
        requestJson(ports.ROLE_URL, { signal: lifecycle.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            name: name,
            image: gifRoleDataUrl,
            format: gifRoleAnimType
          }
        }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            ports.roleManager.useImported(d.roles);
            hideGifRoleModal();
          }
        })).catch(lifecycle.guard(ports.assetFailure));
      } catch (err) { ports.assetFailure(err); }
    }
var cropState = null;
async function onRoleFileChosen(input) {
      try {
        var f = input && input.files && input.files[0];
        input.value = '';
        if (!f) return;
        ports.WhaleMediaGuard.checkFile(f, 'role');
        var bytes = await f.arrayBuffer();
        var media = ports.WhaleMediaGuard.inspectImage(bytes, 'role');
        var dataUrl = await ports.mediaDataUrl(new Blob([bytes], { type: media.mime }));
        if (lifecycle.disposed) return;
        if (media.animated && (media.format === 'gif' || media.format === 'apng')) openGifRoleModal(dataUrl, f.name, media.format);
        else if (media.animated) throw new Error('动态角色请选择 GIF 或 APNG，避免导入后丢失动画');
        else openCropModal(dataUrl, f.name);
      } catch (err) { if (!lifecycle.disposed) ports.assetNotice(err.message); }
    }
function openCropModal(dataUrl, fileName) {
      try {
        var imgEl = new Image();
        imgEl.onload = lifecycle.guard(function () {
          cropState = {
            img: imgEl,
            zoom: 1,
            ox: 0,
            oy: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            baseScale: Math.max(CROP_BOX / imgEl.width, CROP_BOX / imgEl.height)
          };
          cropNameInput.value = '';
          cropZoom.value = '1';
          cropZoomNum.value = '100';
          cropAngle.value = '0';
          cropAngleNum.value = '0';
          positionCrop();
          cropMask.style.display = 'flex';
        });
        imgEl.onerror = lifecycle.guard(function () { ports.assetNotice('图片解码失败，请选择其他图片'); });
        imgEl.src = dataUrl;
      } catch (err) {}
    }
function clampAngle(v) {
      var n = Number(v);
      if (!isFinite(n)) return 0;
      return Math.min(360, Math.max(-360, Math.round(n)));
    }
function cropDisplaySize() {
      var s = cropState.baseScale * cropState.zoom;
      var w = cropState.img.width * s;
      var h = cropState.img.height * s;
      var rad = cropState.rotation * Math.PI / 180;
      var c = Math.abs(Math.cos(rad));
      var sn = Math.abs(Math.sin(rad));
      return {
        w: w * c + h * sn,
        h: w * sn + h * c,
        s: s
      };
    }
function positionCrop() {
      if (!cropState) return;
      var d = cropDisplaySize();
      var maxOx = Math.max(0, (d.w - CROP_BOX) / 2);
      var maxOy = Math.max(0, (d.h - CROP_BOX) / 2);
      cropState.ox = Math.min(maxOx, Math.max(-maxOx, cropState.ox));
      cropState.oy = Math.min(maxOy, Math.max(-maxOy, cropState.oy));
      drawCrop();
    }
function drawCrop() {
      try {
        if (!cropState) return;
        var ctx = cropCanvas.getContext('2d');
        var s = cropState.baseScale * cropState.zoom;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s;
        var h = cropState.img.height * s;
        ctx.clearRect(0, 0, CROP_BOX, CROP_BOX);
        ctx.save();
        ctx.translate(CROP_BOX / 2 + cropState.ox, CROP_BOX / 2 + cropState.oy);
        ctx.rotate(rad);
        ctx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        ctx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch (err) {}
    }
var cropDrag = null;
function onCropDown(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      cropDrag = {
        x: e.clientX,
        y: e.clientY,
        ox: cropState.ox,
        oy: cropState.oy
      };
    }
function onCropMove(e) {
      if (!cropDrag || !cropState) return;
      cropState.ox = cropDrag.ox + (e.clientX - cropDrag.x);
      cropState.oy = cropDrag.oy + (e.clientY - cropDrag.y);
      positionCrop();
    }
function onCropUp() {
      cropDrag = null;
    }
function onCropWheel(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var delta = (e.deltaY > 0 ? -1 : 1) * 0.05;
      cropState.zoom = Math.min(3, Math.max(0.3, cropState.zoom + delta));
      cropZoom.value = String(Math.round(cropState.zoom * 100) / 100);
      cropZoomNum.value = String(Math.round(cropState.zoom * 100));
      positionCrop();
    }
function resetCrop() {
      if (!cropState) return;
      cropState.zoom = 1;
      cropState.ox = 0;
      cropState.oy = 0;
      cropState.rotation = 0;
      cropState.flipH = false;
      cropState.flipV = false;
      cropZoom.value = '1';
      cropZoomNum.value = '100';
      cropAngle.value = '0';
      cropAngleNum.value = '0';
      cropFlipHBtn.classList.remove('dshwv-cropflip-on');
      cropFlipVBtn.classList.remove('dshwv-cropflip-on');
      positionCrop();
    }
var cropFlipTimer = null;
function flipCrop(axis) {
      if (!cropState) return;
      try {
        if (cropFlipTimer) {
          clearTimeout(cropFlipTimer);
          cropFlipTimer = null;
        }
      } catch (err) {}
      var flipTarget = axis === 'H' ? 'scaleX(-1)' : 'scaleY(-1)';
      cropCanvas.style.transition = 'transform .3s ease';
      cropCanvas.style.transform = flipTarget;
      cropFlipTimer = lifecycle.timeout(function () {
        cropFlipTimer = null;
        try {
          if (axis === 'H') {
            cropState.flipH = !cropState.flipH;
            cropFlipHBtn.classList.toggle('dshwv-cropflip-on', cropState.flipH);
          } else {
            cropState.flipV = !cropState.flipV;
            cropFlipVBtn.classList.toggle('dshwv-cropflip-on', cropState.flipV);
          }
          positionCrop();
          lifecycle.frame(function () {
            cropCanvas.style.transition = '';
            cropCanvas.style.transform = '';
          });
        } catch (err) {}
      }, 300);
    }
function confirmCrop() {
      try {
        if (!cropState) return;
        var name = (cropNameInput.value || '').trim().slice(0, 16) || '新角色';
        var s = cropState.baseScale * cropState.zoom;
        var k = 610 / CROP_BOX;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s * k;
        var h = cropState.img.height * s * k;
        var out = ports.document.createElement('canvas');
        out.width = 610;
        out.height = 610;
        var octx = out.getContext('2d');
        octx.translate(305 + cropState.ox * k, 305 + cropState.oy * k);
        octx.rotate(rad);
        octx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        octx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        var dataUrl = out.toDataURL('image/png');
        requestJson(ports.ROLE_URL, { signal: lifecycle.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            name: name,
            image: dataUrl
          }
        }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            ports.roleManager.useImported(d.roles);
            hideCropModal();
          }
        })).catch(lifecycle.guard(ports.assetFailure));
      } catch (err) { ports.assetFailure(err); }
    }
function hideCropModal() {
      cropMask.style.display = 'none';
      cropState = null;
      cropDrag = null;
    }
function dispose() { lifecycle.dispose(); hideCropModal(); hideGifRoleModal(); cropMask.remove(); gifMask.remove(); clearTimeout(cropFlipTimer); }
return { dispose, onRoleFileChosen };
}
