(() => {
  const get = id => document.getElementById(id);
  const store = window.answerStore;
  let user = window.readerUser || null;
  let questionId = null;
  let items = [];
  let offset = 0;
  let hasMore = false;
  let listVersion = 0;
  let identityVersion = 0;
  let writing = false;
  let loading = false;
  let editing = null;
  let autoBusy = false;
  let writeVersion = 0;
  let draftId = crypto.randomUUID();

  function message(text) { get('answer-status').textContent = text; }
  function node(tag,text) {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    return result;
  }
  function clearEditor() {
    editing = null;
    draftId = crypto.randomUUID();
    get('answer-form').reset();
    get('answer-form-label').textContent = '写下你的回答';
    get('answer-submit').textContent = '发表回答';
    get('answer-cancel').hidden = true;
  }
  function controls() {
    get('answer-form').hidden = !user;
    get('answer-login-note').hidden = !!user;
    get('answer-submit').disabled = writing;
    get('answer-cancel').disabled = writing;
    get('answers-refresh').disabled = loading || writing;
    get('answers-more').disabled = loading || writing;
    get('answers-more').hidden = !hasMore;
    get('answer-list').querySelectorAll('button').forEach(button => button.disabled = writing);
  }
  function renderItems() {
    get('answer-list').replaceChildren();
    for (const answer of items) {
      const article = node('article');
      article.className = 'answer-card';
      const meta = node('p', answer.author_name + ' · ' + new Date(answer.created_at).toLocaleString('zh-CN'));
      meta.className = 'question-meta';
      article.append(meta,node('p',answer.body));
      if (answer.author_id === user?.id) {
        const actions = node('div');
        actions.className = 'question-actions answer-actions';
        const edit = node('button','编辑');
        edit.type = 'button';
        edit.className = 'secondary';
        edit.addEventListener('click', () => {
          if (writing) return;
          editing = answer;
          get('answer-body-input').value = answer.body;
          get('answer-form-label').textContent = '编辑你的回答';
          get('answer-submit').textContent = '保存修改';
          get('answer-cancel').hidden = false;
          get('answer-body-input').focus();
          get('answer-form').scrollIntoView({behavior:'smooth',block:'center'});
        });
        const remove = node('button','删除');
        remove.type = 'button';
        remove.className = 'secondary';
        remove.addEventListener('click', () => {
          if (writing || !confirm('删除你自己的这条回答？此操作无法在网页中撤销。')) return;
          write(async ownerId => {
            await store.remove(answer,ownerId);
            return '回答已删除。';
          }, editing?.id === answer.id);
        });
        actions.append(edit,remove);
        article.append(actions);
      }
      get('answer-list').append(article);
    }
    controls();
  }
  async function load(reset = false) {
    if (!questionId || writing || loading) return;
    const version = ++listVersion;
    const targetQuestion = questionId;
    loading = true;
    if (reset) offset = 0;
    controls();
    message('正在读取回答…');
    try {
      const result = await store.list(targetQuestion,offset);
      if (version !== listVersion || questionId !== targetQuestion) return;
      if (reset) items = [];
      const seen = new Set(items.map(answer => answer.id));
      items.push(...result.items.filter(answer => !seen.has(answer.id)));
      offset += result.items.length;
      hasMore = result.hasMore;
      renderItems();
      message(items.length ? '' : '还没有回答，可以留下第一条看法。');
      return true;
    } catch (error) {
      if (version === listVersion) message(store.errorMessage(error));
    } finally {
      if (version === listVersion) { loading = false; controls(); }
    }
  }
  // Refresh only the loaded portion; leave the composer and its draft untouched.
  async function autoRefresh() {
    if (!questionId || document.hidden || get('answers').hidden || writing || loading || autoBusy) return;
    autoBusy = true;
    const version = listVersion;
    const targetQuestion = questionId;
    const identity = identityVersion;
    const writeGeneration = writeVersion;
    const pageCount = Math.max(1, Math.ceil(items.length / 20));
    try {
      const fresh = [];
      let more = false;
      for (let page = 0; page < pageCount; page++) {
        const result = await store.list(targetQuestion, page * 20);
        fresh.push(...result.items);
        more = result.hasMore;
        if (!more) break;
      }
      if (version !== listVersion || identity !== identityVersion || writeGeneration !== writeVersion ||
          targetQuestion !== questionId || writing || loading) return;
      const changed = JSON.stringify(items) !== JSON.stringify(fresh) || hasMore !== more;
      if (changed) {
        // Avoid replacing a keyboard user's focused edit/delete control.
        if (get('answer-list').contains(document.activeElement)) return;
        items = fresh;
        offset = fresh.length;
        hasMore = more;
        renderItems();
        message(items.length ? '回答已自动更新。' : '还没有回答，可以留下第一条看法。');
      }
    } catch (_) {
      // Keep existing content and drafts; retry on the next tick.
    } finally {
      autoBusy = false;
    }
  }
  window.setInterval(autoRefresh, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) autoRefresh();
  });
  window.addEventListener('focus', autoRefresh);
  async function write(action, resetEditor) {
    if (writing || !user) return;
    const ownerId = user.id;
    const version = identityVersion;
    ++writeVersion; // Ignore background results started before this write.
    writing = true;
    controls();
    message('正在提交…');
    let success = false;
    let successMessage = '';
    try {
      successMessage = await action(ownerId);
      if (version !== identityVersion || user?.id !== ownerId) return;
      if (resetEditor) clearEditor();
      success = true;
    } catch (error) {
      if (version === identityVersion) message(store.errorMessage(error));
    } finally {
      writing = false;
      controls();
    }
    if (success) {
      const refreshed = await load(true);
      if (refreshed && version === identityVersion && user?.id === ownerId) message(successMessage);
    }
  }
  window.addEventListener('reader-auth', event => {
    const next = event.detail;
    if (user?.id !== next?.id) {
      identityVersion++;
      clearEditor();
      message('');
    }
    user = next;
    renderItems();
  });
  window.addEventListener('question-view', event => {
    const {question,visible} = event.detail;
    get('answers').hidden = !visible;
    if (!visible || !question || question.id === questionId) return;
    questionId = question.id;
    items = [];
    offset = 0;
    hasMore = false;
    clearEditor();
    renderItems();
    load(true);
  });
  get('answer-login').addEventListener('click', () => document.querySelector('[data-feature="登录与注册"]').click());
  get('answer-cancel').addEventListener('click', clearEditor);
  get('answers-refresh').addEventListener('click', () => load(true));
  get('answers-more').addEventListener('click', () => load());
  get('answer-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!questionId) return;
    const body = get('answer-body-input').value;
    const editedAnswer = editing;
    write(async ownerId => {
      if (editedAnswer) await store.update(editedAnswer,body,ownerId);
      else await store.create(draftId,questionId,body,ownerId);
      return editedAnswer ? '回答已更新。' : '回答已发表。';
    }, true);
  });
  controls();
})();
