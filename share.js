(() => {
  const button = document.querySelector('[data-share-page]');
  if (!button) return;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'share-heading');
  const heading = document.createElement('h2');
  heading.id = 'share-heading';
  heading.textContent = '分享文学问答';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const label = document.createElement('label');
  label.textContent = '页面链接';
  const input = document.createElement('input');
  input.type = 'url';
  input.readOnly = true;
  input.style.cssText = 'display:block;width:100%;margin:12px 0;padding:10px;font:inherit;box-sizing:border-box';
  label.append(input);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'primary';
  copy.textContent = '复制链接';
  const nativeShare = document.createElement('button');
  nativeShare.type = 'button';
  nativeShare.textContent = '系统分享';
  nativeShare.style.marginLeft = '12px';
  nativeShare.hidden = typeof navigator.share !== 'function';
  const closeForm = document.createElement('form');
  closeForm.method = 'dialog';
  const close = document.createElement('button');
  close.textContent = '关闭';
  closeForm.append(close);
  dialog.append(heading, status, label, copy, nativeShare, closeForm);
  document.body.append(dialog);

  // Share only the public home URL. Authentication fragments and query parameters
  // may contain sensitive values and must never be copied into a shared link.
  function publicUrl() {
    const url = new URL('./', location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  }

  button.addEventListener('click', () => {
    input.value = publicUrl();
    status.textContent = '将网站链接发送给朋友。';
    if (!dialog.open) dialog.showModal();
    copy.focus();
  });
  copy.addEventListener('click', async () => {
    copy.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(publicUrl());
      status.textContent = '链接已复制，可以粘贴发送。';
    } catch (_) {
      status.textContent = '自动复制不可用，请复制下面选中的链接。';
      input.focus();
      input.select();
    } finally {
      copy.disabled = false;
    }
  });
  nativeShare.addEventListener('click', async () => {
    nativeShare.disabled = true;
    try {
      await navigator.share({title: '文学问答', url: publicUrl()});
      status.textContent = '已交给系统分享面板。';
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? '已取消分享。'
        : '系统分享不可用，可以复制链接。';
    } finally {
      nativeShare.disabled = false;
    }
  });
  dialog.addEventListener('close', () => button.focus());
})();
