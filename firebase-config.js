// Firebase Project Configuration for Random Character Defense (Web + PWA + Android APK)
// Firebase 콘솔(프로젝트 설정 -> 내 앱 -> 웹 앱)에서 발급받은 config 값을 채워 넣으세요.
// 값이 비어 있으면 자동으로 오프라인(localStorage + live_config.json) 모드로 동작합니다.
(function (global) {
  const DEFAULT_CONFIG = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  };

  let active = Object.assign({}, DEFAULT_CONFIG);
  try {
    if (!active.apiKey && global.localStorage) {
      const ov = global.localStorage.getItem('rcd_firebase_config_override');
      if (ov) {
        const parsed = JSON.parse(ov);
        if (parsed && typeof parsed === 'object' && parsed.apiKey && parsed.projectId) {
          active = Object.assign({}, DEFAULT_CONFIG, parsed);
        }
      }
    }
  } catch (_) {}

  global.RCD_FIREBASE_CONFIG = active;
  global.RCD_IS_FIREBASE_READY = function () {
    const c = global.RCD_FIREBASE_CONFIG;
    return !!(c && typeof c.apiKey === 'string' && c.apiKey.trim().length > 8 && typeof c.projectId === 'string' && c.projectId.trim().length > 0);
  };
})(typeof window !== 'undefined' ? window : globalThis);
