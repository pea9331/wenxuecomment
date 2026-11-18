(() => {
 const store=window.bookmarkStore;
 const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 window.mountBookmarks=async(container,ownerId,isCurrent)=>{
  let offset=0,busy=false;
  const status=node('p','正在读取收藏…'),list=node('div'),more=node('button','加载更多'),retry=node('button','重新读取');
  status.setAttribute('role','status');
  more.type=retry.type='button';more.className=retry.className='secondary';
  more.hidden=retry.hidden=true;container.append(status,list,more,retry);
  async function load(reset=false){
   if(busy||!isCurrent())return;
   busy=true;more.disabled=true;retry.hidden=true;
   if(reset){offset=0;list.replaceChildren();}
   try{
    const result=await store.list(ownerId,offset);
    if(!isCurrent())return;
    for(const saved of result.items){
     const card=window.questionStore.card(saved.questions);
     const remove=node('button','取消收藏');remove.type='button';remove.className='secondary';
     remove.addEventListener('click',async()=>{
      if(busy||!isCurrent())return;
      busy=true;more.disabled=true;remove.disabled=true;
      try{
       await store.remove(saved.question_id,ownerId);
       if(!isCurrent())return;
       status.textContent='已取消收藏。';
      }catch(error){if(isCurrent())status.textContent=store.errorMessage(error);return;}
      finally{busy=false;more.disabled=false;remove.disabled=false;}
      if(isCurrent())await load(true);
     });
     card.append(remove);list.append(card);
    }
    offset+=result.items.length;more.hidden=!result.hasMore;
    status.textContent=offset?'':'还没有收藏。打开一个问题，点击“收藏问题”即可保存在这里。';
   }catch(error){if(isCurrent()){status.textContent=store.errorMessage(error);retry.hidden=false;}}
   finally{busy=false;more.disabled=false;}
  }
  more.addEventListener('click',()=>load());retry.addEventListener('click',()=>load(true));
  await load();
 };
 const host=document.getElementById('bookmark-actions');
 if(!host)return;
 const button=node('button','收藏问题'),status=node('span');
 button.type='button';button.className='secondary';button.setAttribute('aria-pressed','false');
 status.setAttribute('role','status');host.append(button,status);
 let user=window.readerUser||null,id=null,saved=false,known=false,busy=false,version=0;
 function paint(){
  button.disabled=busy;
  button.textContent=!user?'登录后收藏':!known?'读取收藏状态':saved?'取消收藏':'收藏问题';
  button.setAttribute('aria-pressed',String(known&&saved));
 }
 async function refresh(){
  const current=++version,target=id,owner=user?.id;
  known=false;saved=false;status.textContent='';busy=false;
  if(!target||!owner){paint();return;}
  busy=true;paint();
  try{const value=await store.has(target,owner);if(current!==version)return;saved=value;known=true;}
  catch(error){if(current===version){status.textContent=store.errorMessage(error);button.textContent='重试读取收藏状态';}}
  finally{if(current===version){busy=false;paint();if(!known)button.textContent='重试读取收藏状态';}}
 }
 window.addEventListener('reader-auth',event=>{
  if(user?.id===event.detail?.id)return;
  user=event.detail;refresh();
 });
 window.addEventListener('question-view',event=>{
  const q=event.detail.question;host.hidden=!event.detail.visible;
  if(q?.id===id)return;id=q?.id||null;refresh();
 });
 button.addEventListener('click',async()=>{
  if(busy||!id)return;
  if(!user){document.querySelector('[data-feature="登录与注册"]').click();return;}
  if(!known){refresh();return;}
  const current=++version,target=id,owner=user.id,wasSaved=saved;
  busy=true;status.textContent='';paint();
  try{
   await (wasSaved?store.remove(target,owner):store.save(target,owner));
   if(current!==version)return;
   saved=!wasSaved;known=true;status.textContent=saved?'已收藏，可在“我的主页 → 我的收藏”查看。':'已取消收藏。';
  }catch(error){if(current===version){known=false;status.textContent=store.errorMessage(error);}}
  finally{if(current===version){busy=false;paint();}}
 });
 paint();
})();
