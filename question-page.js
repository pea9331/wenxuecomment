(() => {
  const get = id => document.getElementById(id);
  const store = window.questionStore;
  const id = new URLSearchParams(location.search).get('id');
  const newId = crypto.randomUUID();
  let question = null;
  let user = window.readerUser || null;
  let draftOwner = null;
  let editing = !id;
  let busy = false;
  let loaded = false;

  function status(text) { get('question-status').textContent = text; }
  function ownerActions() {
    get('question-owner-actions').hidden = editing || !question || question.author_id !== user?.id;
  }
  function render() {
    get('question-detail').hidden = !question || editing;
    get('question-editor').hidden = !editing || !user;
    get('question-login').hidden = !!user || !editing;
    ownerActions();
    if (!user && editing) status('登录后可以发布问题。');
    if (!question || editing) return;
    document.title = question.title + ' · 文学问答';
    get('question-title').textContent = question.title;
    get('question-body').textContent = question.body;
    get('question-meta').textContent = [question.book, question.author_name,
      new Date(question.created_at).toLocaleString('zh-CN')].filter(Boolean).join(' · ');
  }
  async function perform(action) {
    if (busy) return;
    busy = true;
    ['question-submit','question-delete','question-edit','question-cancel'].forEach(key => get(key).disabled = true);
    try { await action(); }
    catch (error) { status(store.errorMessage(error)); }
    finally {
      busy = false;
      ['question-submit','question-delete','question-edit','question-cancel'].forEach(key => get(key).disabled = false);
    }
  }
  async function load() {
    if (!id) { loaded = true; render(); return; }
    get('question-retry').hidden = true;
    status('正在读取问题…');
    try {
      question = await store.detail(id);
      loaded = true;
      status('');
      render();
    } catch (error) {
      status(store.errorMessage(error));
      get('question-retry').hidden = false;
    }
  }
  window.addEventListener('reader-auth', event => {
    const nextUser = event.detail;
    if (user?.id !== nextUser?.id) {
      get('question-form').reset();
      draftOwner = nextUser?.id || null;
      if (id) editing = false;
    }
    user = nextUser;
    if (!draftOwner && user) draftOwner = user.id;
    if (!id && user) status('');
    if (loaded || !id) render();
  });
  get('question-login').addEventListener('click', () => document.querySelector('[data-feature="登录与注册"]').click());
  get('question-retry').addEventListener('click', load);
  get('question-edit').addEventListener('click', () => {
    if (!question || question.author_id !== user?.id) return;
    editing = true;
    draftOwner = user.id;
    get('editor-heading').textContent = '编辑问题';
    get('question-submit').textContent = '保存修改';
    get('question-title-input').value = question.title;
    get('question-book-input').value = question.book;
    get('question-body-input').value = question.body;
    status('');
    render();
  });
  get('question-cancel').addEventListener('click', () => {
    if (question) { editing = false; render(); }
    else location.href = new URL('./', location.href).href;
  });
  get('question-form').addEventListener('submit', event => {
    event.preventDefault();
    perform(async () => {
      const expectedUser = draftOwner || user?.id;
      if (!expectedUser || expectedUser !== user?.id) throw new Error('请重新登录后再发布。');
      const values = {title:get('question-title-input').value, book:get('question-book-input').value,
        body:get('question-body-input').value};
      status(question ? '正在保存…' : '正在发布…');
      const saved = question ? await store.update(question, values) : await store.create(newId, values, expectedUser);
      if (user?.id !== expectedUser) return;
      location.href = './question.html?id=' + encodeURIComponent(saved.id);
    });
  });
  get('question-delete').addEventListener('click', () => {
    if (!question || !confirm('删除这个问题？此操作无法在网页中撤销。')) return;
    perform(async () => {
      await store.remove(question);
      location.href = new URL('./', location.href).href;
    });
  });
  if (user) draftOwner = user.id;
  render();
  load();
})();
