// 오프라인에서도 열리게 하는 서비스 워커 (살림노트 sw.js 와 같은 방식)
// 온라인이면 항상 새 파일을 받고(업데이트 바로 반영), 오프라인이면 저장해 둔 파일을 씀
// kkonoo.github.io 의 다른 앱(살림노트 등)과 캐시 저장소를 같이 쓰므로 이름을 다르게, 남의 캐시는 지우지 않기
const CACHE = 'toybox-v1';
const SHELL = [
  './', 'manifest.webmanifest', 'css/base.css', 'css/home.css', 'js/ui.js', 'js/random.js', 'js/pwa.js', 'vendor/qrcode.js',
  'icons/app-192.png', 'icons/app-512.png', 'icons/app-maskable-192.png', 'icons/app-maskable-512.png', 'icons/apple-touch-icon.png',
  'games/lots/', 'games/lots/lots.css', 'games/lots/lots-core.js', 'games/lots/lots.js',
  'games/wheel/', 'games/wheel/wheel.css', 'games/wheel/wheel-core.js', 'games/wheel/wheel.js',
  'games/ladder/', 'games/ladder/ladder.css', 'games/ladder/ladder-core.js', 'games/ladder/ladder.js',
  'games/bomb/', 'games/bomb/bomb.css', 'games/bomb/bomb-core.js', 'games/bomb/bomb.js',
  'games/santa/', 'games/santa/me.html', 'games/santa/santa.css', 'games/santa/santa-core.js', 'games/santa/santa.js', 'games/santa/me.js',
  'games/tarot/', 'games/tarot/tarot.css', 'games/tarot/tarot-cards.js', 'games/tarot/tarot-core.js', 'games/tarot/tarot.js',
];

self.addEventListener('install', e => {
  self.skipWaiting(); // 새 서비스 워커를 앱을 껐다 켜지 않아도 바로 사용
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // 폰트 CDN·Claude API 같은 바깥 요청은 건드리지 않음
  e.respondWith(
    // no-cache: 브라우저 캐시(GitHub Pages는 10분)를 쓰기 전에 서버에 바뀌었는지 확인
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { cacheName: CACHE, ignoreSearch: true }))
  );
});
