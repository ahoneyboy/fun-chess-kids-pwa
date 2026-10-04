/* ============================================================
 * 趣棋小将 · Service Worker
 * 缓存优先策略：全部静态资源一次缓存，离线也能完整使用。
 * 更新版本时请同步把 CACHE 版本号 +1。
 * ============================================================ */
const CACHE = 'funchess-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css?v=3',
  'js/chess-core.js',
  'js/engine.js',
  'js/analysis.js',
  'js/content.js',
  'js/sounds.js',
  'js/store.js',
  'js/ui.js',
  'js/board.js',
  'js/app.js',
  'js/play.js',
  'js/learn.js',
  'js/review.js',
  'js/data-views.js',
  'workers/engine-worker.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 页面导航：网络优先，失败回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html'))
    );
    return;
  }
  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
