# CLAUDE.md — ScheduleFlow 프로젝트 AI 에이전트 진입점

이 문서는 이 저장소에서 작업하는 모든 AI 에이전트가 **가장 먼저** 읽어야 한다.

---

## 작업 시작 전 필독 순서

1. **`ROADMAP.md`** — 개발 단계와 현재 위치
2. **`DECISIONS.md`** — 확정/미결 결정사항 (작업 전 반드시 확인)
3. **`DEV_LOG.md`** — 최근 세션 컨텍스트 및 다음 작업
4. **`작업실록.md`** — 최근 2~3개 날짜 항목 (작업 흐름 파악)

---

## 프로젝트 핵심 컨셉

> **ScheduleFlow**: 출장·일정·문서를 하나로 관리하는 개인용 웹 앱.
> Firebase 기반 순수 Vanilla JS, 빌드 도구 없음.

### 핵심 사용 흐름
```
Google 로그인
    ↓
대시보드 (오늘 할 일 / 다가오는 출장 / 미니 캘린더)
    ↓
TODO 관리 (생성/수정/삭제, 상태/우선순위/태그/마감일)
    ↓
캘린더 뷰 (월간, 일정 바, 날짜 클릭 → 상세 패널)
    ↓
출장 등록 → 출장 카드에서 📝신청서 / 📋보고서 직접 작성
```

> **문서 탭**: 사이드바에서 숨김 처리 (display:none). 코드·페이지 섹션은 유지.
> 문서 접근은 반드시 `openTripDoc(tripId, 'pre'|'post')` 경유.

### 기술 스택
- **Firebase Hosting** — 정적 파일 서빙
- **Firebase Auth** — Google OAuth
- **Firestore** — 클라우드 데이터 동기화
- **Vanilla JS** — 빌드 도구 없음, CDN 기반
- **SortableJS** — 대시보드 카드 Drag & Drop

---

## 디렉토리 구조

```
ScheduleFlow/
├── CLAUDE.md               ← 지금 이 파일
├── ROADMAP.md              ← 개발 단계
├── DECISIONS.md            ← 설계 결정 로그
├── DEV_LOG.md              ← 개발 일지 (세션 컨텍스트)
├── 작업실록.md              ← 날짜별 작업 이력
├── firebase.json           ← Firebase Hosting + Firestore rules 참조
├── firestore.rules         ← Firestore 보안 규칙
│
├── cloudflare-worker/      ← webcal 피드 서버
│   ├── worker.js           ← Cloudflare Worker (ICS 서빙)
│   └── wrangler.toml       ← Worker 배포 설정
│
├── public/                 ← Firebase Hosting root (배포 대상)
│   ├── index.html          ← 진입점 + 전체 HTML 구조
│   ├── index.css           ← 전체 스타일 (CSS 변수 기반 테마)
│   ├── firebase-init.js    ← Firebase 초기화 (설정값 포함)
│   ├── firebase.js         ← Firebase 헬퍼 (auth, db 래퍼)
│   ├── app.js              ← 라우터 + 테마 + Write-Through Cache + Store + ICS 생성
│   ├── auth.js             ← 로그인/로그아웃/계정 삭제 (모바일·PWA 분기 포함)
│   ├── todo.js             ← TODO CRUD + 필터 + 모달
│   ├── calendar.js         ← 캘린더 렌더링 + 날짜 패널 + TODO 드래그 드롭
│   ├── trips.js            ← 출장 CRUD + 상태 관리 + 문서 접근(openTripDoc)
│   ├── documents.js        ← 문서 편집기 (신청서/보고서, 탭은 숨김)
│   ├── dashboard.js        ← 대시보드 위젯 + 카드 순서
│   ├── holidays.js         ← 한국 공휴일 데이터
│   ├── sw.js               ← 서비스 워커 (오프라인 캐시, CACHE_VER 관리)
│   ├── manifest.json       ← PWA 매니페스트
│   └── icon.svg            ← 앱 아이콘
│
└── docs/
    ├── sessions/           ← 과거 세션 작업 기록
    ├── design/             ← UX/디자인 관련 문서
    └── specs/              ← 기능 명세
```

---

## 개발 명령어

```bash
# Firebase 로컬 에뮬레이터 (호스팅 미리보기)
firebase serve --only hosting

# Firebase 배포 (호스팅만)
firebase deploy --only hosting

# Firebase 배포 (호스팅 + Firestore 규칙)
firebase deploy --only hosting,firestore:rules

# Firebase 배포 (미리보기 채널)
firebase hosting:channel:deploy preview

# Cloudflare Worker 배포 (캘린더 연동)
cd cloudflare-worker && wrangler deploy
```

> **주의**: 빌드 스텝 없음. `public/` 파일을 직접 수정하면 바로 반영됨.

---

## 데이터 구조 (Firestore)

```
users/{uid}/sf-data/todos    → { list: [...], updatedAt }
users/{uid}/sf-data/trips    → { list: [...], updatedAt }
publicCalendars/{token}      → { content: "BEGIN:VCALENDAR...", updatedAt }
```

`publicCalendars` 컬렉션은 누구나 읽기 가능 (Firestore rules). 쓰기는 인증 필요.
`token`은 `crypto.randomUUID()`로 생성, localStorage `sf_cal_token`에 저장.

### TODO 항목 스키마
```js
{
  id: string,          // crypto.randomUUID()
  title: string,
  status: 'todo' | 'in-progress' | 'done',
  priority: 'low' | 'medium' | 'high',
  dueDate: string,     // 'YYYY-MM-DD' or ''
  tags: string[],
  tripId: string | null,
  createdAt: number    // Date.now()
}
```

### 출장(Trip) 항목 스키마
```js
{
  id: string,
  title: string,
  destination: string,
  startDate: string,    // 'YYYY-MM-DD'
  startTime: string | null, // 'HH:MM'
  endDate: string,      // 'YYYY-MM-DD'
  endTime: string | null,
  status: 'planned' | 'in-progress' | 'completed',
  project: string,      // 사업명(계약명) — 있으면 사업 출장, 없으면 일반 출장
  purpose: string,
  transport: string,
  companions: string,
  preReport: object | null,   // 출장사전신청서 데이터
  postReport: object | null,  // 외근출장보고서 데이터
  createdAt: string     // ISO string
}
```

---

## 주요 패턴

### Write-Through Cache (app.js)
```js
// 읽기
Store.getTodos()  // → Cache.todos (in-memory)
Store.getTrips()  // → Cache.trips (in-memory)

// 쓰기: Cache 즉시 갱신 → localStorage 즉시 저장 → Firestore debounce(1500ms)
Store.saveTodos(list)
Store.saveTrips(list)
```

### 리얼타임 크로스-디바이스 동기화 (app.js)
- `startRealtimeSync(uid)` — 로그인 시 호출, Firestore `onSnapshot` 리스너 등록
- `stopRealtimeSync()` — 로그아웃 시 호출, 리스너 해제
- 필터 조건: `fromCache=false && hasPendingWrites=false && data !== Cache`
  (로컬 쓰기 확인·캐시 데이터 무시, 원격 변경만 반응)

### Store 확장 API (app.js)
```js
Store.getDocTemplate() / Store.saveDocTemplate(obj)    // localStorage: sf_doc_template
Store.getNotifEnabled() / Store.saveNotifEnabled(bool) // localStorage: sf_notif
Store.getCalToken() / Store.saveCalToken(str|null)     // localStorage: sf_cal_token
Store.getCalWorkerUrl() / Store.saveCalWorkerUrl(str)  // localStorage: sf_cal_worker
```

### 페이지 전환 (app.js)
- `navigate(page)` — 활성 `<section>` 전환 + 네비 하이라이트
- `<section id="page-*">` 패턴으로 모든 페이지 관리

---

## 커밋 컨벤션

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 |
| `chore:` | 설정/Firebase 설정 |
| `style:` | CSS/UI 변경 |
| `refactor:` | 리팩토링 |

---

## Gotchas

### 빌드 없는 순수 JS
- `import/export` 없음 — 모든 함수는 전역 스코프
- `index.html` 하단 `<script>` 태그 순서 중요: `firebase-init.js` → `app.js` → 나머지

### Firebase 캐시 무효화
- `index.html`에서 JS/CSS는 `?v=N` 쿼리스트링으로 캐시 버스팅
- 파일 변경 시 버전 번호 수동 증가 필요

### Firestore 동기화 타이밍
- 앱 로드 시 Firestore에서 데이터 pull → localStorage + Cache에 저장
- 이후 변경은 Cache → localStorage 즉시, Firestore는 1.5초 debounce

### 테마
- CSS 변수 기반 (`--color-primary`, `--bg-main` 등)
- `document.documentElement.setAttribute('data-theme', theme)` 로 전환
- localStorage `sf_theme` 에 저장

### PWA / iOS 로그인 전략 (auth.js)
- **데스크탑 / Standalone PWA** → `signInWithPopup` 사용
- **일반 모바일 브라우저** → `signInWithRedirect` 사용 (팝업 차단 우회)
- iOS Standalone에서 `signInWithRedirect`는 PWA 컨텍스트를 영구 이탈시키므로 금지
- `authDomain`은 반드시 `web.app` 유지 (`firebaseapp.com`으로 되돌리면 iOS PWA에서 cross-origin postMessage 차단됨)
- `web.app/__/auth/handler`는 Google Cloud Console OAuth 클라이언트의 승인된 리디렉션 URI에 등록 필요
  → GCC → APIs & Services → Credentials → Web client → 승인된 리디렉션 URI
  → REST API로는 OAuth 클라이언트 수정 불가 (UI 전용 작업)

### 서비스 워커 캐시 버전 동기화 (sw.js)
- `public/` 파일 변경 시 반드시 **세 곳** 동시 업데이트:
  1. `index.html` — 해당 파일의 `?v=N` 쿼리스트링 증가
  2. `sw.js` — `CACHE_VER` 문자열 증가 + `PRECACHE` 배열의 버전 번호 동기화
- `CACHE_VER`이 바뀌면 activate 시 이전 캐시 자동 삭제됨
- **주의**: 파일을 수정하고 `index.html`의 버전만 올리거나 `sw.js`만 올리면 캐시 불일치 발생
  → 실제 사례: `auth.js` 수정 후 버전 누락 → 브라우저가 구버전 캐시 서빙 → 신규 기능 미표시

### Firebase CLI 토큰
- 경로: `C:/Users/{user}/.config/configstore/firebase-tools.json` → `tokens.access_token`
- 스코프: `cloud-platform` (IAM·Firebase·Firestore API 호출 가능, OAuth 클라이언트 관리 불가)

### 이벤트 핸들러 이중 바인딩 주의
- HTML에 `onclick="fn()"` 속성이 있는 요소에 `addEventListener('click', fn)`을 추가하면 함수가 두 번 호출됨
- 테마 토글 등 동적으로 addEventListener를 쓰는 경우 HTML onclick 속성 제거 필수

### 문서 탭 접근 방식
- 사이드바 문서 탭은 `display:none` (숨김). `navigate('documents')`는 여전히 동작함
- **반드시 `openTripDoc(tripId, 'pre'|'post')`를 통해 접근** — `navigate('documents')` 직접 호출 금지
- 출장 카드 버튼, 출장 상세 모달, 대시보드 미완료 문서 항목 모두 `openTripDoc` 경유

### webcal 캘린더 동기화 패턴
- `Store.saveTodos/saveTrips` 호출 시 `scheduleCalSync()` 자동 트리거 (3초 debounce)
- `_pushCalendar()` → `generateICS(trips, todos)` → Firestore `publicCalendars/{token}` 저장
- Cloudflare Worker가 해당 문서를 읽어 `text/calendar` 응답
- 토큰 없으면 동기화 스킵 (연동 비활성 상태)

---

## 에이전트 작업 규칙

1. **설계 변경** → `DECISIONS.md` 관련 항목 먼저 확인
2. **새 설계 결정** → 즉시 `DECISIONS.md`에 기록
3. **주요 진행** → `DEV_LOG.md`에 날짜와 함께 기록
4. **새 기능** → `public/` 하위 해당 JS 파일에 작성
5. **Firebase 설정 변경** → `firebase.json` 또는 `public/firebase-init.js` 수정
6. **CSS 변경 후** → 캐시 버스팅 버전 번호 증가 확인
