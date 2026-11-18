(() => {
  const get = id => document.getElementById(id);
  const dialog = get('account-dialog');
  const authButton = document.querySelector('[data-feature="登录与注册"]');
  const profileButton = document.querySelector('[data-feature="个人主页"]');
  let client = null;
  let user = null;
  let signup = false;
  let busy = false;
  let previousFocus = null;
  let generation = 0;

  function message(text) {
    get('account-status').textContent = text;
  }

  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll('button:not([value="close"])').forEach(button => {
      if (button.closest('form[method="dialog"]')) return;
      button.disabled = value;
    });
  }

  function readableError(error) {
    const translations = {
      invalid_credentials: '邮箱或密码不正确。',
      email_not_confirmed: '请先打开注册邮件完成邮箱验证，再回来登录。',
      user_already_exists: '请尝试登录已有账号。',
      over_email_send_rate_limit: '邮件发送过于频繁，请稍后重试。',
      weak_password: '密码强度不足，请使用更长、更复杂的密码。',
      signup_disabled: '当前项目尚未开放注册。'
    };
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return '资料表尚未配置，请先在 Supabase 执行 setup.sql。';
    }
    return translations[error?.code] || '请求失败，请检查网络或项目配置后重试。';
  }

  function render() {
    get('credentials-view').hidden = !!user;
    get('profile-view').hidden = !user;
    get('account-title').textContent = user ? '我的资料' : signup ? '创建账号' : '登录';
    get('account-submit').textContent = signup ? '注册' : '登录';
    get('account-toggle').textContent = signup ? '已有账号，去登录' : '创建账号';
    get('account-password').autocomplete = signup ? 'new-password' : 'current-password';
    authButton.textContent = user ? '账号' : '登录 / 注册';
    get('account-email-display').textContent = user?.email || '';
  }

  async function loadProfile() {
    const currentUser = user;
    const currentGeneration = ++generation;
    if (!currentUser) return;
    get('profile-nickname').value = '';
    get('profile-bio').value = '';
    message('正在读取资料…');
    const {data, error} = await client.from('reader_profiles')
      .select('nickname,bio').eq('id', currentUser.id).maybeSingle();
    if (currentGeneration !== generation || user?.id !== currentUser.id) return;
    if (error) throw error;
    get('profile-nickname').value = data?.nickname || '';
    get('profile-bio').value = data?.bio || '';
    message(data ? '' : '设置一个昵称，建立你的阅读资料。');
  }

  async function perform(action) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      message(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function openAccount() {
    previousFocus = document.activeElement;
    render();
    if (!dialog.open) dialog.showModal();
    if (!client) {
      message('账号服务等待配置。请站点维护者填写 config.js 并执行 setup.sql。');
      get('credentials-view').hidden = true;
      return;
    }
    await perform(async () => {
      const {data, error} = await client.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      user = data.user;
      render();
      if (user) await loadProfile();
      else {
        message('');
        get('account-email').focus();
      }
    });
  }

  authButton.addEventListener('click', openAccount);
  profileButton.addEventListener('click', openAccount);
  dialog.addEventListener('close', () => {
    get('account-password').value = '';
    previousFocus?.focus();
  });
  get('account-toggle').addEventListener('click', () => {
    signup = !signup;
    get('account-password').value = '';
    message('');
    render();
  });

  get('credentials-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!client) return;
    perform(async () => {
      message(signup ? '正在注册…' : '正在登录…');
      const credentials = {
        email: get('account-email').value.trim(),
        password: get('account-password').value
      };
      const redirect = new URL('./', location.href).href;
      const result = signup
        ? await client.auth.signUp({...credentials, options: {emailRedirectTo: redirect}})
        : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      get('account-password').value = '';
      user = result.data.session?.user || null;
      render();
      if (user) await loadProfile();
      else message('如果此邮箱可以注册，验证邮件将发送到邮箱。请检查邮件及垃圾箱，完成验证后再登录。');
    });
  });

  get('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!client || !user) return;
    const nickname = get('profile-nickname').value.trim();
    const bio = get('profile-bio').value.trim();
    if (!nickname) {
      message('昵称不能为空。');
      get('profile-nickname').focus();
      return;
    }
    perform(async () => {
      message('正在保存…');
      const {data: auth, error: authError} = await client.auth.getUser();
      if (authError || !auth.user) throw authError || new Error('Missing user');
      const {error} = await client.from('reader_profiles').upsert({
        id: auth.user.id, nickname, bio
      }, {onConflict: 'id'});
      if (error) throw error;
      message('资料已保存。');
    });
  });

  get('account-signout').addEventListener('click', () => {
    perform(async () => {
      const {error} = await client.auth.signOut({scope: 'local'});
      if (error) throw error;
      user = null;
      generation++;
      get('profile-form').reset();
      render();
      message('已退出登录。');
    });
  });

  const config = window.APP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabasePublishableKey || !window.supabase) return;
  try {
    const projectUrl = new URL(config.supabaseUrl);
    if (projectUrl.protocol !== 'https:' || !config.supabasePublishableKey.startsWith('sb_publishable_')) return;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
    });
    client.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      generation++;
      render();
      if (!user) get('profile-form').reset();
      // SDK callbacks stay synchronous. Profile queries run outside this callback.
      if (user && dialog.open && !busy) {
        setTimeout(() => perform(loadProfile), 0);
      }
    });
    client.auth.getSession().then(({data}) => {
      user = data.session?.user || null;
      render();
    }).catch(() => message('登录状态读取失败，请重新登录。'));
  } catch (_error) {
    client = null;
  }
})();
