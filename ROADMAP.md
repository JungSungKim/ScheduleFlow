# ScheduleFlow — 개발 로드맵

## Phase 0 — 기반 구축 ✅
- [x] Firebase 프로젝트 세팅 (Auth + Firestore)
- [x] 기본 레이아웃 (사이드바 + 메인 콘텐츠)
- [x] Google 로그인 / 로그아웃
- [x] Write-Through Cache 구조 (Cache → localStorage → Firestore)
- [x] 다크/라이트 테마 전환
- [x] 프로젝트 폴더 구조 정비 (public/ 분리, 문서 체계)

## Phase 1 — 핵심 기능 (MVP) ✅
- [x] TODO 관리 (생성/수정/삭제, 상태/우선순위/태그/마감일)
- [x] TODO 필터 (전체/미완료/진행중/완료, 태그 필터, 출장 필터)
- [x] 캘린더 뷰 (월간, 일정 바 표시, 겹침 스택)
- [x] 날짜 상세 패널 (클릭 시 해당 날짜 일정 + 빠른 추가)
- [x] 출장 관리 (생성/수정/삭제, 상태 관리)
- [x] 한국 공휴일 표시
- [x] 대시보드 (오늘 할 일, 다가오는 출장, 미완료 문서, 미니 캘린더)
- [x] 대시보드 카드 Drag & Drop 순서 저장 (SortableJS)

## Phase 2 — 문서 기능 ✅
- [x] 출장 문서 편집기 (사전 출장신청서, 출장 보고서)
- [x] 문서 PDF/인쇄 내보내기 (window.open + print)
- [x] 데이터 JSON 내보내기/가져오기 (백업/복원)
- [x] 전역 검색 (Ctrl+K, todos/trips/docs 통합)

## Phase 3 — 고도화
- [x] 반복 일정 (매일/매주/매월) — todoMatchesRepeat + expandRecurringTodos
- [x] TODO → 캘린더 연동 강화 (드래그로 날짜 변경)
- [x] 알림 / 리마인더 (브라우저 Notification API, 마감 30분 전)
- [x] 모바일 PWA 설치 지원 (manifest.json + sw.js + beforeinstallprompt)
- [ ] 다중 계정 / 팀 공유

## Phase 4 — 고도화
- [ ] 일정 충돌 감지 및 알림
