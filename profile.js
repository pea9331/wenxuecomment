(() => {
  const get = id => document.getElementById(id);
  const sections = {
    questions: ['我的提问', '提问功能接通后，你发布的问题会显示在这里。'],
    answers: ['收到的回答', '回答功能接通后，可以在这里查看谁回答了你的问题。'],
    saved: ['我的收藏', '收藏功能接通后，你保存的讨论会显示在这里。'],
    following: ['关注的问题', '关注功能接通后，你关注的问题会显示在这里。'],
    history: ['浏览历史', '问题详情接通后，会在这里提供浏览记录。'],
    settings: ['通知与账号', '']
  };
  let user = null;
  let requestVersion = 0;
  let busySigningOut = false;
  const editButton = document.querySelector('[data-edit-profile]');

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }

  function notificationPreference() {
    const label = element('label');
    label.className = 'setting';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const key = 'wenxue:reply-notice:' + user.id;
    try { input.checked = localStorage.getItem(key) === 'yes'; } catch (_) {}
    const text = element('span', '希望收到新回答提醒');
    text.append(element('small', '当前仅在本浏览器保存偏好。消息提醒和邮件发送尚待接入。'));
    input.addEventListener('change', () => {
      try {
        localStorage.setItem(key, input.checked ? 'yes' : 'no');
        get('page-status').textContent = '本浏览器的提醒偏好已保存。';
      } catch (_) {
        get('page-status').textContent = '浏览器阻止了设置保存，请允许本地存储后重试。';
      }
    });
    label.append(input, text);
    return label;
  }

  function renderSection() {
    const key = location.hash.slice(1) || 'questions';
    const section = sections[key];
    get('section-body').replaceChildren();
    document.querySelectorAll('.sidebar a').forEach(link => {
      if (link.hash === '#' + key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    get('section-title').textContent = section?.[0] || '未找到此页面';
    if (!section) {
      const home = element('a', '返回我的提问');
      home.href = '#questions';
      get('section-body').append(home);
      return;
    }
    if (!user) {
      const container = element('div');
      container.className = 'empty';
      container.append(element('p', '登录后查看自己的内容和设置。'));
      const login = element('button', '登录 / 注册');
      login.className = 'primary';
      login.addEventListener('click', () => document.querySelector('[data-feature="登录与注册"]').click());
      container.append(login);
      get('section-body').append(container);
      return;
    }
    if (key === 'settings') {
      const settings = element('div');
      settings.id = 'account-settings';
      settings.append(notificationPreference());
      const edit = element('button', '编辑昵称和简介');
      edit.className = 'secondary';
      edit.addEventListener('click', () => editButton.click());
      const signout = element('button', '退出登录');
      signout.className = 'secondary';
      signout.style.marginLeft = '12px';
      signout.addEventListener('click', async () => {
        if (busySigningOut) return;
        busySigningOut = true;
        signout.disabled = true;
        try {
          const {error} = await window.readerClient.auth.signOut({scope: 'local'});
          if (error) throw error;
          get('page-status').textContent = '已退出登录。';
        } catch (_) {
          get('page-status').textContent = '退出失败，请检查网络后重试。';
        } finally {
          busySigningOut = false;
          signout.disabled = false;
        }
      });
      settings.append(edit, signout);
      get('section-body').append(settings);
      return;
    }
    const container = element('div');
    container.className = 'empty';
    container.append(element('p', section[1]));
    const home = element('a', '返回问题首页');
    home.href = './';
    container.append(home);
    get('section-body').append(container);
  }

  function showProfile(profile) {
    get('reader-name').textContent = profile?.nickname || '尚未设置昵称';
    get('reader-bio').textContent = profile?.bio || '还没有填写简介。';
    get('reader-avatar').textContent = Array.from(profile?.nickname || '读')[0];
  }

  async function updateUser(nextUser) {
    const sameUser = nextUser?.id === user?.id;
    user = nextUser;
    editButton.hidden = !user;
    if (sameUser) return;
    const version = ++requestVersion;
    renderSection();
    if (!user) {
      get('reader-name').textContent = '我的主页';
      get('reader-bio').textContent = '登录后查看你的阅读资料。';
      get('reader-avatar').textContent = '读';
      return;
    }
    get('reader-name').textContent = '我的主页';
    get('reader-bio').textContent = '正在读取资料…';
    let data, error;
    try {
      ({data, error} = await window.readerClient.from('reader_profiles')
        .select('nickname,bio').eq('id', user.id).maybeSingle());
    } catch (requestError) {
      error = requestError;
    }
    if (version !== requestVersion) return;
    if (error) {
      get('reader-bio').textContent = '资料读取失败，请刷新重试。';
      return;
    }
    showProfile(data);
  }

  window.addEventListener('hashchange', renderSection);
  window.addEventListener('reader-auth', event => updateUser(event.detail));
  window.addEventListener('reader-profile-saved', event => {
    if (!user || event.detail.id !== user.id) return;
    requestVersion++;
    showProfile(event.detail);
    get('page-status').textContent = '资料已更新。';
  });
  renderSection();
  if (window.readerUser) updateUser(window.readerUser);
  else {
    get('reader-bio').textContent = '登录后查看你的阅读资料。';
    editButton.hidden = true;
  }
})();
