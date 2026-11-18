(() => {
  const status = document.getElementById('questions-status');
  const list = document.getElementById('question-list');
  const more = document.getElementById('questions-more');
  const retry = document.getElementById('questions-retry');
  let offset = 0;
  let busy = false;
  async function load(reset = false) {
    if (busy) return;
    busy = true;
    more.disabled = true;
    retry.hidden = true;
    if (reset) { offset = 0; list.replaceChildren(); }
    status.textContent = '正在读取问题…';
    try {
      const result = await window.questionStore.list({offset});
      result.items.forEach(item => list.append(window.questionStore.card(item)));
      offset += result.items.length;
      more.hidden = !result.hasMore;
      status.textContent = offset ? '' : '还没有问题。点击“提个问题”写下你的疑问。';
    } catch (error) {
      status.textContent = window.questionStore.errorMessage(error);
      retry.hidden = false;
    } finally {
      busy = false;
      more.disabled = false;
    }
  }
  more.addEventListener('click', () => load());
  retry.addEventListener('click', () => load(true));
  load(true);
})();
