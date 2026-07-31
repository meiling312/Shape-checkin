/* 塑形打卡 PWA Service Worker
 * 策略：
 *   - 导航 HTML -> Network First（离线回退缓存）
 *   - 静态资源 -> Stale-While-Revalidate
 *   - 没有缓存的页面兜底显示离线提示，绝不用坏缓存导致黑屏
 */
const CACHE_NAME = 'shape-cache-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // allSettled 避免某一个资源失败导致整个 install 失败
      return Promise.allSettled(
        PRECACHE.map(function (url) {
          return fetch(url, { cache: 'no-store' })
            .then(function (res) {
              if (res && res.status === 200) cache.put(url, res);
            })
            .catch(function () {});
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // 只处理同源 GET 请求
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 导航 HTML：Network First
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            if (cached) return cached;
            return new Response(
              '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>离线</title><style>' +
              'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#f4f5f7;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;}' +
              '.box{background:#fff;border-radius:18px;padding:28px 22px;text-align:center;max-width:320px;box-shadow:0 10px 30px rgba(0,0,0,.08);}' +
              '.title{color:#ff6b35;font-size:20px;font-weight:700;margin-bottom:10px;}' +
              '.desc{color:#8a90a0;font-size:14px;line-height:1.6;}' +
              '</style></head><body><div class="box"><div class="title">当前无网络</div><div class="desc">请连接网络后重新打开塑形打卡。<br>已缓存的数据会自动恢复。</div></div></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }

  // 静态资源：Cache First，同时后台刷新
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      }).catch(function () {});
      return cached || network;
    })
  );
});
