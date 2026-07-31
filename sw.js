// 本文件不再被 index.html 注册。
// 仅作兜底：若手机上仍有旧版 Service Worker 在运行，加载即自动卸载，
// 避免它用残血缓存导致黑屏。
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    self.registration.unregister().then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    })
  );
});
