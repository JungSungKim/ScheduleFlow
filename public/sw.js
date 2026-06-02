/* ================================================
   ScheduleFlow — Service Worker
   버전을 올릴 때 CACHE_VER + PRECACHE 목록도 동기화할 것
   ================================================ */

const CACHE_VER = 'sf-v23';

// 오프라인 캐시 대상 (버전 쿼리스트링 포함)
const PRECACHE = [
  '/',
  '/index.css?v=17',
  '/firebase-init.js?v=3',
  '/holidays.js?v=2',
  '/app.js?v=18',
  '/auth.js?v=6',
  '/todo.js?v=12',
  '/calendar.js?v=10',
  '/trips.js?v=7',
  '/documents.js?v=5',
  '/dashboard.js?v=14',
  '/manifest.json',
  '/icon.svg',
];

// Firebase / Google 도메인 — 캐시 건너뜀
const SKIP_CACHE_HOSTS = [
  'firebaseio.com',
  'googleapis.com',
  'firebaseapp.com',
  'gstatic.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

function shouldSkip(url) {
  // Firebase 외부 도메인
  if (SKIP_CACHE_HOSTS.some(h => url.hostname.includes(h))) return true;
  // Firebase Auth 내부 경로 (/__/auth/) — 리다이렉트 로그인 흐름에 필수
  if (url.pathname.startsWith('/__/')) return true;
  return false;
}

// ── Install: 정적 자산 사전 캐시 ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: 이전 캐시 정리 ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: 캐시 우선, 네트워크 폴백 ──
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Firebase API 요청은 서비스 워커가 개입하지 않음
  if (shouldSkip(url)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // 유효한 응답만 캐시에 저장
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_VER).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인 + 캐시 없음 → HTML 요청이면 루트 페이지 반환
        if (e.request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});
