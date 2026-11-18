(() => {
  function client() {
    if (!window.readerClient) throw new Error('账号服务未连接，请刷新重试。');
    return window.readerClient;
  }
  async function identity(ownerId) {
    const {data,error} = await client().auth.getUser();
    if(error || !data.user) throw new Error('请先登录，再操作收藏。');
    if(data.user.id !== ownerId) throw new Error('登录账号已变化，请重试。');
  }
  function validId(id) {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new Error('问题编号无效。');
  }
  async function has(id,ownerId) {
    validId(id);await identity(ownerId);
    const {data,error}=await client().from('question_bookmarks').select('question_id')
      .eq('user_id',ownerId).eq('question_id',id).maybeSingle();
    if(error) throw error;
    return !!data;
  }
  async function save(id,ownerId) {
    validId(id);await identity(ownerId);
    const {error}=await client().from('question_bookmarks').insert({user_id:ownerId,question_id:id});
    if(error && error.code!=='23505') throw error; // Re-saving is harmless.
  }
  async function remove(id,ownerId) {
    validId(id);await identity(ownerId);
    const {error}=await client().from('question_bookmarks').delete().eq('user_id',ownerId).eq('question_id',id);
    if(error)throw error; // Already removed is also a success.
  }
  async function list(ownerId,offset=0) {
    await identity(ownerId);
    if(!Number.isInteger(offset)||offset<0)throw new Error('分页参数无效。');
    const {data,error}=await client().from('question_bookmarks')
      .select('question_id,created_at,questions!inner(id,author_id,author_name,title,body,book,created_at,updated_at)')
      .eq('user_id',ownerId).order('created_at',{ascending:false}).order('question_id',{ascending:false})
      .range(offset,offset+20);
    if(error)throw error;
    return {items:data.slice(0,20),hasMore:data.length>20};
  }
  function errorMessage(error) {
    if(['42P01','PGRST205'].includes(error?.code))return '收藏表未配置，请先执行 update-setup.sql。';
    if(error?.code==='23503')return '这个问题已被删除，无法收藏。';
    if(error?.code==='42501')return '没有收藏操作权限，请重新登录或检查数据库配置。';
    if(error instanceof Error && !error.code && !error.message.includes('fetch'))return error.message;
    return '收藏请求失败，请检查网络后重试。';
  }
  window.bookmarkStore={has,save,remove,list,errorMessage};
})();
