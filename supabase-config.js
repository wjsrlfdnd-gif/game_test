// Supabase Project Configuration for Random Character Defense (Web + PWA + Android APK)
// Supabase 대시보드(Project Settings -> API)에서 Project URL과 anon public key를 채워 넣으세요.
// 값이 비어 있으면 자동으로 로컬(localStorage + live_config.json) 모드로 동작합니다.
(function (global) {
  const DEFAULT_CONFIG = {
    url: '',
    anonKey: ''
  };

  let active = Object.assign({}, DEFAULT_CONFIG);
  try {
    if ((!active.url || !active.anonKey) && global.localStorage) {
      const ov = global.localStorage.getItem('rcd_supabase_config_override');
      if (ov) {
        const parsed = JSON.parse(ov);
        if (parsed && typeof parsed === 'object' && parsed.url && parsed.anonKey) {
          active = Object.assign({}, DEFAULT_CONFIG, parsed);
        }
      }
    }
  } catch (_) {}

  global.RCD_SUPABASE_CONFIG = active;
  global.RCD_IS_SUPABASE_READY = function () {
    const c = global.RCD_SUPABASE_CONFIG;
    return !!(
      c &&
      typeof c.url === 'string' &&
      /^https?:\/\/.+/i.test(c.url.trim()) &&
      typeof c.anonKey === 'string' &&
      c.anonKey.trim().length > 20
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);
