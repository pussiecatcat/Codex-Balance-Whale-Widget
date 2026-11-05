// GIF/APNG role import dialog. Animated roles cannot be cropped, so this only
// previews the image, takes a name and uploads it through the role endpoint.
export function createGifRoleDialog({ document, requestJson, roleUrl, roleManager, requireSaved, assetFailure }) {
  const mask = document.createElement('div');
  mask.className = 'dshwv-gifmask';
  mask.style.display = 'none';
  const card = document.createElement('div');
  card.className = 'dshwv-gifwin';
  const title = document.createElement('div');
  title.className = 'dshwv-giftitle';
  title.textContent = '导入动图角色';
  const previewBox = document.createElement('div');
  previewBox.className = 'dshwv-gifpreview';
  const preview = document.createElement('img');
  preview.className = 'dshwv-gifpreviewimg';
  preview.alt = '动图预览';
  preview.draggable = false;
  previewBox.appendChild(preview);
  const hint = document.createElement('div');
  hint.className = 'dshwv-gifhint';
  hint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'dshwv-gifname';
  name.maxLength = 16;
  name.placeholder = '角色名称';
  const buttons = document.createElement('div');
  buttons.className = 'dshwv-cropbtns';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
  cancel.textContent = '取消';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
  ok.textContent = '确认';
  buttons.appendChild(cancel);
  buttons.appendChild(ok);
  card.appendChild(title);
  card.appendChild(previewBox);
  card.appendChild(hint);
  card.appendChild(name);
  card.appendChild(buttons);
  mask.appendChild(card);
  document.body.appendChild(mask);

  let dataUrl = null;
  let format = 'gif';

  function hide() {
    mask.style.display = 'none';
    dataUrl = null;
    format = 'gif';
    preview.src = '';
  }

  function open(url, fileName, animType) {
    dataUrl = url;
    format = animType === 'apng' ? 'apng' : 'gif';
    if (format === 'apng') {
      title.textContent = '导入 APNG 动图角色';
      hint.textContent = 'APNG 动图不支持裁剪，将按原始尺寸原样导入';
    } else {
      title.textContent = '导入 GIF 动图角色';
      hint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
    }
    name.value = '';
    preview.src = url;
    mask.style.display = 'flex';
  }

  function confirm() {
    try {
      const roleName = (name.value || '').trim().slice(0, 16) || '新角色';
      if (!dataUrl) { hide(); return; }
      requestJson(roleUrl, { method: 'POST', body: { name: roleName, image: dataUrl, format } }).then(data => {
        requireSaved(data);
        if (data && data.ok && Array.isArray(data.roles)) {
          roleManager.useImported(data.roles);
          hide();
        }
      }).catch(assetFailure);
    } catch (error) { assetFailure(error); }
  }

  cancel.addEventListener('click', hide);
  ok.addEventListener('click', confirm);
  return { open, hide, confirm, mask };
}
