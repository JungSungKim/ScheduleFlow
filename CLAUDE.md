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
대시보드 (오늘 할 일 / 다가오는 출장 / 미완료 문서 / 미니 캘린더)
    ↓
TODO 관리 (생성/수정/삭제, 상태/우선순위/태그/마감일)
    ↓
캘린더 뷰 (월간, 일정 바, 날짜 클릭 → 상세 패널)
    ↓
출장 등록 → 문서 작성 (사전신청서 / 출장보고서 자동 채움)
```

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
├── firebase.json           ← Firebase Hosting 설정 (public: "public")
│
├── public/                 ← Firebase Hosting root (배포 대상)
│   ├── index.html          ← 진입점 + 전체 HTML 구조
│   ├── index.css           ← 전체 스타일 (CSS 변수 기반 테마)
│   ├── firebase-init.js    ← Firebase 초기화 (설정값 포함)
│   ├── firebase.js         ← Firebase 헬퍼 (auth, db 래퍼)
│   ├── app.js              ← 라우터 + 테마 + Write-Through Cache
│   ├── auth.js             ← 로그인/로그아웃/계정 삭제
│   ├── todo.js             ← TODO CRUD + 필터 + 모달
│   ├── calendar.js         ← 캘린더 렌더링 + 날짜 패널
│   ├── trips.js            ← 출장 CRUD + 상태 관리
│   ├── documents.js        ← 문서 편집기 (신청서/보고서)
│   ├── dashboard.js        ← 대시보드 위젯 + 카드 순서
│   └── holidays.js         ← 한국 공휴일 데이터
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

# Firebase 배포
firebase deploy --only hosting

# Firebase 배포 (미리보기 채널)
firebase hosting:channel:deploy preview
```

> **주의**: 빌드 스텝 없음. `public/` 파일을 직접 수정하면 바로 반영됨.

---

## 데이터 구조 (Firestore)

```
users/{uid}/sf-data/todos    → { list: [...], updatedAt }
users/{uid}/sf-data/trips    → { list: [...], updatedAt }
users/{uid}/sf-data/documents → { list: [...], updatedAt }
```

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
  startDate: string,   // 'YYYY-MM-DD'
  endDate: string,     // 'YYYY-MM-DD'
  status: 'planned' | 'in-progress' | 'completed',
  purpose: string,
  createdAt: number
}
```

---

## 주요 패턴

### Write-Through Cache (app.js)
```js
// 읽기: Cache 우선 → localStorage fallback
getData(key)

// 쓰기: Cache 즉시 갱신 → localStorage 즉시 저장 → Firestore debounce(1500ms)
setData(key, data)
```

### 페이지 전환 (app.js)
- `showPage(pageId)` — 활성 `<section>` 전환 + 네비 하이라이트
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
- `document.body.setAttribute('data-theme', 'dark')` 로 전환
- localStorage `sf_theme` 에 저장

---

## 에이전트 작업 규칙

1. **설계 변경** → `DECISIONS.md` 관련 항목 먼저 확인
2. **새 설계 결정** → 즉시 `DECISIONS.md`에 기록
3. **주요 진행** → `DEV_LOG.md`에 날짜와 함께 기록
4. **새 기능** → `public/` 하위 해당 JS 파일에 작성
5. **Firebase 설정 변경** → `firebase.json` 또는 `public/firebase-init.js` 수정
6. **CSS 변경 후** → 캐시 버스팅 버전 번호 증가 확인
