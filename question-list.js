(() => {
  const get = id => document.getElementById(id);
  const status = get('questions-status'), list = get('question-list');
  const more = get('questions-more'), retry = get('questions-retry');
  const input = get('query'), clear = get('search-clear');
  let offset = 0, term = '', generation = 0, busy = false;
  async function load(reset = false) {
    if (busy && !reset) return;
    const version = ++generation;
    busy = true;
    more.disabled = true;
    more.hidden = true;
    retry.hidden = true;
    if (reset) { offset = 0; list.replaceChildren(); }
    const requestOffset = offset, requestTerm = term;
    get('questions-heading').textContent = term ? '搜索结果' : '最近的问题';
    clear.hidden = !term;
    status.textContent = term ? '正在搜索…' : '正在读取问题…';
    try {
      const result = requestTerm ? await window.questionSearch.search(requestTerm,requestOffset)
        : await window.questionStore.list({offset:requestOffset});
      if (version !== generation) return;
      const seen = new Set(Array.from(list.children).map(el => el.dataset.questionId));
      result.items.forEach(item => {
        if (seen.has(item.id)) return;
        const card = window.questionStore.card(item);
        card.dataset.questionId = item.id;
        list.append(card);
        seen.add(item.id);
      });
      offset = requestOffset + result.items.length;
      more.hidden = !result.hasMore;
      status.textContent = list.children.length
        ? (term ? '关键词“' + term + '” · 已显示' + list.children.length + '条' : '')
        : (term ? '没有找到相关问题，换个关键词试试。' : '还没有问题。点击“提个问题”写下你的疑问。');
    } catch (error) {
      if (version !== generation) return;
      status.textContent = window.questionStore.errorMessage(error);
      retry.hidden = false;
    } finally {
      if (version === generation) { busy = false; more.disabled = false; }
    }
  }
  function fromUrl() {
    term = new URL(location.href).searchParams.get('q') || '';
    input.value = term;
    load(true);
  }
  function navigate(next) {
    const url = new URL(location.href);
    if (next) url.searchParams.set('q',next); else url.searchParams.delete('q');
    history.pushState(null,'',url);
    fromUrl();
  }
  get('search-form').addEventListener('submit',event => {
    event.preventDefault();
    const next = input.value.trim();
    if (Array.from(next).length > 120) { status.textContent = '搜索词最多120字。'; input.focus(); return; }
    navigate(next);
  });
  clear.addEventListener('click',()=>navigate(''));
  window.addEventListener('popstate',fromUrl);
  more.addEventListener('click',()=>load());
  retry.addEventListener('click',()=>load(true));
  fromUrl();
})();
