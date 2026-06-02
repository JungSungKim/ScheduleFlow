# ScheduleFlow — DEV_LOG

## 현재 세션 컨텍스트

| 항목 | 내용 |
|------|------|
| 최종 갱신 | 2026-06-02 |
| 브랜치 | master |
| 최신 커밋 | 9b21a41 |
| 미커밋 변경 | 있음 (폴더 구조 재정비 진행 중) |

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
