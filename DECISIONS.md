# ScheduleFlow — 설계 결정 로그

확정된 결정과 미해결 사항을 함께 관리한다.
작업 시작 전 반드시 확인하고, 미결 항목이 있으면 먼저 결정한다.

---

## ✅ 확정된 결정사항

### 아키텍처

| ID | 항목 | 결정 | 근거 |
|----|------|------|------|
| A-001 | 플랫폼 | **Firebase Hosting + Firestore** | 무서버, 무비용(무료 티어), 빠른 배포 |
| A-002 | 프론트엔드 | **Vanilla JS (빌드 도구 없음)** | 단순성 우선, 의존성 최소화 |
| A-003 | 인증 | **Firebase Auth (Google OAuth)** | 빠른 구현, Google 계정 기반 |
| A-004 | 데이터 동기화 | **Write-Through Cache** (Cache → localStorage → Firestore) | 오프라인 지원 + 클라우드 백업 |
| A-005 | UI 프레임워크 | **없음 (CSS 커스텀 변수 + 순수 CSS)** | 번들러 없이 CDN 방식으로 유지 |
| A-006 | 소스 구조 | **`public/` 디렉토리 분리** | Firebase Hosting root = `public/`, 문서는 루트에 분리 |

### 데이터 모델

| ID | 항목 | 결정 | 근거 |
|----|------|------|------|
| D-001 | Firestore 경로 | `users/{uid}/sf-data/{key}` | 유저별 완전 격리 |
| D-002 | 로컬 캐시 키 | `sf_{key}` (localStorage) | 다른 앱과 키 충돌 방지 |
| D-003 | Firestore Debounce | 1500ms | 타이핑 중 과도한 쓰기 방지 |

### 기능

| ID | 항목 | 결정 | 근거 |
|----|------|------|------|
| F-001 | Drag & Drop | **SortableJS CDN** | 모바일 터치 지원, HTML5 DnD API의 모바일 채터링 문제 해결 |
| F-002 | 공휴일 | **한국 공휴일 하드코딩** (holidays.js) | 외부 API 의존성 제거 |
| F-003 | 캘린더 바 | **겹침 스택 알고리즘** | 다중 출장 기간 시각화 |
| F-004 | 테마 | **CSS 변수 기반 다크/라이트** | 런타임 전환, 별도 CSS 파일 불필요 |
| F-005 | 디자인 방향 | **Direction B — Modern Minimal** (중립 그레이 팔레트) | 따뜻한 크림 계열(Direction A)에서 중립 회색 계열로 전환. Phase 1 적용 완료 (2026-06-02) |
| F-006 | 사이드바 구조 | **2-column: 52px rail(dark) + 200px panel(white)** | Direction B 핸즈오프 스펙 Phase 1 채택. rail은 icon-only, panel은 text label. Lucide CDN 아이콘 사용 |
| F-007 | isTrip 판별 | **`'preReport' in t`** | `destination` 유무는 취약 (trip-linked TODO도 destination 가질 수 있음). preReport/postReport는 Trip 객체 전용 필드 |
| F-008 | UUID 생성 | **`crypto.randomUUID()`** | 기존 11자리 hex는 충돌 가능성. crypto.randomUUID()가 표준이며 모든 현대 브라우저 지원 |
| F-009 | DnD 순서 보존 | **`sortOrder` 필드 스탬핑** | DnD 후 todos 배열에 `sortOrder: index` 부여, renderTodos에서 sortOrder 우선 정렬 |
| F-010 | PWA 아이콘 | **SVG 단일 아이콘** (`icon.svg`) | PNG 생성 도구 없이 SVG one-file로 any + maskable 두 purpose 모두 커버. Chrome 93+ 지원 |
| F-011 | SW 캐시 전략 | **Cache-first + SW 버전 = 앱 버전** (`sf-v23`) | 오프라인 지원 + 새 배포 시 CACHE_VER + PRECACHE 목록을 sw.js에서 함께 올려야 함 |
| F-012 | Firebase authDomain | **`web.app` 고정** (`my-scheduleflow-dev.web.app`) | `firebaseapp.com` 사용 시 iOS PWA standalone에서 cross-origin postMessage 차단. `web.app/__/auth/handler`를 GCC OAuth 클라이언트 redirect URI에 등록 필요 (UI 전용, API 불가) |
| F-013 | 모바일 로그인 전략 | **Standalone → popup / 일반 모바일 → redirect** | iOS Standalone에서 redirect는 PWA 컨텍스트 영구 이탈. `_isMobile` + `_isStandalone` 플래그로 분기 (auth.js) |

---

## 🔲 미결 사항

| ID | 항목 | 현재 방향 | 결정 필요 시점 |
|----|------|-----------|--------------|
| P-001 | PDF 내보내기 방식 | `window.print()` vs `jsPDF` vs 서버사이드 | Phase 2 문서 기능 시작 전 |
| ~~P-002~~ | ~~PWA 지원~~ | ✅ 완료 (2026-06-02) | |
