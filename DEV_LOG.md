# ScheduleFlow — DEV_LOG

## 현재 세션 컨텍스트

| 항목 | 내용 |
|------|------|
| 최종 갱신 | 2026-06-09 |
| 브랜치 | master |
| 최신 커밋 | ba50051 |
| 미커밋 변경 | 없음 |

---

## 2026-06-09

### 완료 작업

**리얼타임 크로스-디바이스 동기화**
- `app.js`: `startRealtimeSync(uid)` — Firestore `onSnapshot` 리스너 (todos/trips 각 1개)
- 필터: `fromCache=false && hasPendingWrites=false && 데이터 변경 시`만 반응 → 자기 기기 쓰기 무시, 무한루프 방지
- 다른 기기에서 변경 시 Cache + localStorage 즉시 갱신 후 현재 페이지 자동 재렌더링
- `_showSyncToast()` — "다른 기기에서 변경사항이 동기화됨" 토스트 2.5초 표시
- `manualRefresh()` — 헤더 ↺ 버튼으로 강제 pull, 완료 시 "새로고침 완료" 토스트
- `auth.js`: `enterApp` → `startRealtimeSync`, `signOut` → `stopRealtimeSync`
- SW CACHE_VER `sf-v23` → `sf-v24`, CSS/JS 버전 증가

**CLAUDE.md 오류 수정 (claude-md-improver)**
- `getData/setData` → `Store.getTodos/getTrips/saveTodos/saveTrips` 정정
- `showPage()` → `navigate()` 정정
- `document.body` → `document.documentElement` 정정
- 리얼타임 동기화 패턴 신규 추가

### 다음 할 일

- [ ] 일정 충돌 감지 및 알림 (Phase 4) — 출장 기간 겹침 / TODO 마감 충돌 감지
- [ ] 문서 템플릿 UX 개선 — 저장 여부 표시 등 (Phase 3 잔여)
- [ ] `public/` 임시 파일 정리: `icon.svg.tmp.*`, `index.html.tmp.*`

---

## 2026-06-03

### 완료 작업

**iOS PWA 로그인 최종 해결**
- `authDomain: "my-scheduleflow-dev.web.app"` 변경으로 cross-origin postMessage 문제 해결
- Google Cloud Console → APIs & Services → Credentials → Web client → 승인된 리디렉션 URI에 `https://my-scheduleflow-dev.web.app/__/auth/handler` 수동 등록
- OAuth 변경 적용 후 PWA 로그인 정상 확인

**모바일 UI 버그 수정**
- 헤더 `대시보드` 타이틀 2줄: `.page-title { font-size: 1rem; white-space: nowrap }` + `#btn-search span { display: none }` (Ctrl+K 텍스트 숨김)
- TODO 페이지 가로 폭 이탈(배율 변경): `.todo-meta { flex-wrap: wrap }` 추가로 날짜·태그·출장 배지 overflow 방지

**프로젝트 설정 개선**
- `.claude/settings.local.json` git 추적 시작 — 다른 PC pull 시 MCP 설정 연속성 유지
- CLAUDE.md 대폭 개선: sw.js/manifest/icon.svg 구조, PWA/iOS 로그인 전략, SW 캐시 버전 동기화 규칙, 이중 바인딩 주의사항, Firebase CLI 토큰 경로

### 의사결정

- **authDomain = web.app 유지**: `firebaseapp.com`으로 복귀하면 iOS PWA standalone에서 cross-origin popup postMessage 재차단. 비가역적 선택
- **OAuth redirect URI는 UI 전용 작업**: REST API로 수정 불가. Google Cloud Console에서 수동 유지 필요

### 다음 할 일

- [ ] Phase 4: AI 문서 초안 (Claude API) — P-003 결정 필요 (직접 호출 vs Firebase Functions)
- [ ] 모바일 TODO 페이지 추가 UX 검토 (drag handle 터치 지원 여부)
- [ ] Phase 3 잔여: 문서 템플릿 기본값 저장 후 UX 개선 (기존 저장 여부 표시)

---

## 2026-06-02

### 완료 작업

**프로젝트 폴더 구조 재정비**
- 소스 파일 전체 `public/` 디렉토리로 이동, `firebase.json` 수정
- 프로젝트 문서 체계 구축: `CLAUDE.md`, `ROADMAP.md`, `DECISIONS.md`, `DEV_LOG.md`, `작업실록.md`
- 전역 커맨드 등록: `scheduleflow-start`, `scheduleflow-exit`

**Direction B Phase 1 디자인 적용**
- CSS: warm cream → neutral gray 팔레트 전체 교체 (Direction B 스펙)
- 사이드바: 2-column (52px dark rail + 200px white panel) + Lucide 아이콘
- 버그 #1~#10 중 9개 수정 (todoAppearsOn, isoDate UTC, esc 중복, DnD, deleteTrip, window.open, isTrip, now 클로저)

**신규 기능**
- 전역 검색 (Ctrl+K): todos/trips/docs 통합 검색, 키보드 네비
- 데이터 JSON 내보내기/가져오기 (헤더 버튼)
- 반복 일정 캘린더 렌더링: 매일/매주/매월 패턴을 캘린더·대시보드에 표시

### 다음 할 일

- [x] Phase 3: TODO → 캘린더 드래그로 날짜 변경
- [x] Phase 3: 알림/리마인더 (브라우저 Notification API)
- [x] 문서 템플릿 커스터마이징 UI
- [ ] Phase 4: AI 문서 초안 (Claude API)

**Phase 3 완료 작업 (2026-06-02)**
- TODO → 캘린더 드래그: `todo.js` dragstart에 `text/plain:todo:{id}` 세팅; `calendar.js` `calDayDrop()` 함수 + `.drop-target` CSS
- 알림/리마인더: `app.js` Notification API + setInterval 1분 체크; 마감 30분 전/오늘 마감 알림; settings 패널 토글 스위치
- 문서 템플릿: `Store.getDocTemplate/saveDocTemplate` + 사전신청서·보고서 폼에 "기본값 저장" 버튼 + 저장된 기본값 자동 채움

---

## 2026-06-02 (추가)

### 완료 작업

**PWA 설치 지원 (Phase 3)**
- `public/manifest.json`: name/short_name/theme_color/#1C1C1E/display:standalone
- `public/icon.svg`: 512×512 SVG 캘린더 아이콘 (maskable + any purpose)
- `public/sw.js`: Cache-first 서비스 워커, Firebase 도메인 캐시 스킵, 오프라인 폴백
- `index.html`: manifest link, PWA 메타태그(apple-mobile-web-app-*), SW 등록 스크립트
- `app.js v16`: `beforeinstallprompt` 핸들러 + "앱 설치" 버튼(헤더, 평소 hidden)
