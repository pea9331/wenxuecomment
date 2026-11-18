(() => {
  const fields = 'id,question_id,author_id,author_name,body,created_at,updated_at';
  function client() {
    if (!window.readerClient) throw new Error('账号服务未连接，请刷新重试。');
    return window.readerClient;
  }
  function validate(body) {
    if (typeof body !== 'string') throw new Error('请填写回答正文。');
    const text = body.trim();
    const length = Array.from(text).length;
    if (!length || length > 5000) throw new Error('回答需要1至5000字。');
    return text;
  }
  async function identity(expectedId) {
    const {data,error} = await client().auth.getUser();
    if (error || !data.user) throw new Error('请先登录，再操作回答。');
    if (data.user.id !== expectedId) throw new Error('登录账号发生变化，请重新打开回答表单。');
    return data.user;
  }
  function errorMessage(error) {
    if (error?.code === 'PGRST205' || error?.code === '42P01') return '回答表未配置，请先执行 answers-setup.sql。';
    if (error?.code === '23503') return '对应的问题已被删除，请返回首页。';
    if (error?.code === '23514') return '请检查回答长度，并确认已设置昵称。';
    if (error?.code === '42501') return '没有操作权限，请检查登录状态。';
    if (error?.code === '23505') return '这条回答可能已发表，请刷新列表确认。';
    if (error instanceof Error && !error.code && !error.message.includes('fetch')) return error.message;
    return '请求失败，请检查网络后重试。';
  }
  async function list(questionId, offset = 0) {
    const {data,error} = await client().from('answers').select(fields).eq('question_id',questionId)
      .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+20);
    if (error) throw error;
    return {items:data.slice(0,20),hasMore:data.length>20};
  }
  async function received(userId, offset = 0) {
    await identity(userId);
    const {data,error} = await client().from('answers')
      .select(fields+',questions!inner(id,title,author_id)').eq('questions.author_id',userId)
      .neq('author_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false})
      .range(offset,offset+20);
    if (error) throw error;
    return {items:data.slice(0,20),hasMore:data.length>20};
  }
  async function create(id,questionId,body,ownerId) {
    const text = validate(body);
    await identity(ownerId);
    const {data:existing,error:readError} = await client().from('answers').select(fields).eq('id',id).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      if (existing.author_id !== ownerId || existing.question_id !== questionId) throw new Error('回答编号冲突，请重新打开页面。');
      return existing;
    }
    const {data,error} = await client().from('answers').insert({id,question_id:questionId,body:text}).select(fields).single();
    if (error) throw error;
    return data;
  }
  async function update(answer,body,ownerId) {
    const text = validate(body);
    if (answer.author_id !== ownerId) throw new Error('只能修改自己的回答。');
    await identity(ownerId);
    const {data,error} = await client().from('answers').update({body:text})
      .eq('id',answer.id).eq('updated_at',answer.updated_at).select(fields).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('回答已更新、删除或权限改变，请刷新后再编辑。');
    return data;
  }
  async function remove(answer,ownerId) {
    if (answer.author_id !== ownerId) throw new Error('只能删除自己的回答。');
    await identity(ownerId);
    const {data,error} = await client().from('answers').delete().eq('id',answer.id)
      .eq('updated_at',answer.updated_at).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('回答已变化，请刷新后确认。');
  }
  window.answerStore = {validate,list,received,create,update,remove,errorMessage};
})();
