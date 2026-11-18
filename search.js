(() => {
  async function search(text, offset = 0) {
    const term = String(text ?? '').trim();
    if (!term || Array.from(term).length > 120) throw new Error('搜索词需要1至120字。');
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new Error('请缩小关键词范围后重新搜索。');
    if (!window.readerClient) throw new Error('服务未连接，请刷新重试。');
    const {data,error} = await window.readerClient.rpc('search_questions',{search_text:term,page_offset:offset});
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') throw new Error('搜索尚未配置，请先执行 search-setup.sql。');
      throw error;
    }
    return {items:data.slice(0,20),hasMore:data.length>20};
  }
  window.questionSearch = {search};
})();
