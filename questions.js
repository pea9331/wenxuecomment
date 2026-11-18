(() => {
  const fields = 'id,author_id,author_name,title,body,book,created_at,updated_at';
  const count = text => Array.from(text).length;

  function validate(values) {
    const title = String(values.title ?? '').trim();
    const body = String(values.body ?? '').trim();
    const book = String(values.book ?? '').trim();
    if (count(title) < 1 || count(title) > 120) throw new Error('标题需要1至120字。');
    if (count(body) < 1 || count(body) > 10000) throw new Error('正文需要1至10000字。');
    if (count(book) > 100) throw new Error('书名最多100字。');
    return {title, body, book};
  }

  function client() {
    if (!window.readerClient) throw new Error('账号服务未连接，请刷新或检查配置。');
    return window.readerClient;
  }

  function errorMessage(error) {
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return '问题表尚未配置，请先执行本轮 questions-setup.sql。';
    }
    if (error?.code === '23514') return '请检查内容长度，并先在我的主页设置昵称。';
    if (error?.code === '42501') return '没有操作权限，请确认已登录。';
    if (error?.code === '23505') return '这次发布已提交，请刷新查看。';
    if (error instanceof Error && !error.code && !error.message.includes('fetch')) return error.message;
    return '请求失败，请检查网络后重试。';
  }

  async function currentUser() {
    const {data, error} = await client().auth.getUser();
    if (error || !data.user) throw new Error('请先登录，再进行操作。');
    return data.user;
  }

  async function list({author, offset = 0} = {}) {
    let query = client().from('questions').select(fields)
      .order('created_at', {ascending: false}).order('id', {ascending: false});
    if (author) query = query.eq('author_id', author);
    const {data, error} = await query.range(offset, offset + 20);
    if (error) throw error;
    return {items: data.slice(0, 20), hasMore: data.length > 20};
  }

  async function detail(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('问题链接无效。');
    }
    const {data, error} = await client().from('questions').select(fields).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('该问题不存在或已被删除。');
    return data;
  }

  async function create(id, values, expectedUserId) {
    const input = validate(values);
    const user = await currentUser();
    if (user.id !== expectedUserId) throw new Error('账号发生变化，请重新打开提问页面。');
    const {data: existing, error: readError} = await client().from('questions')
      .select(fields).eq('id', id).maybeSingle();
    if (readError) throw readError;
    // A retry uses the same UUID after a network interruption.
    if (existing) {
      if (existing.author_id !== user.id) throw new Error('问题编号冲突，请重新打开提问页面。');
      return existing;
    }
    const {data, error} = await client().from('questions').insert({id, ...input}).select(fields).single();
    if (error) throw error;
    return data;
  }

  async function update(question, values) {
    const input = validate(values);
    const user = await currentUser();
    if (user.id !== question.author_id) throw new Error('只能修改自己的问题。');
    const {data, error} = await client().from('questions').update(input)
      .eq('id', question.id).eq('updated_at', question.updated_at).select(fields).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('问题已更新、删除或权限改变。请重新打开问题后再编辑。');
    return data;
  }

  async function remove(question) {
    const user = await currentUser();
    if (user.id !== question.author_id) throw new Error('只能删除自己的问题。');
    const {data, error} = await client().from('questions').delete()
      .eq('id', question.id).eq('updated_at', question.updated_at).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('问题已变化，请刷新后确认。');
  }

  function card(question) {
    const article = document.createElement('article');
    article.className = 'question-card';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = './question.html?id=' + encodeURIComponent(question.id);
    link.textContent = question.title;
    heading.append(link);
    const meta = document.createElement('div');
    meta.className = 'question-meta';
    meta.textContent = [question.book, question.author_name,
      new Date(question.created_at).toLocaleString('zh-CN')].filter(Boolean).join(' · ');
    const excerpt = document.createElement('p');
    excerpt.className = 'question-excerpt';
    excerpt.textContent = Array.from(question.body).slice(0, 120).join('') + (count(question.body) > 120 ? '…' : '');
    article.append(heading, meta, excerpt);
    return article;
  }

  window.questionStore = {validate, list, detail, create, update, remove, card, errorMessage};
})();
