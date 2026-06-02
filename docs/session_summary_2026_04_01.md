# ScheduleFlow 세션 요약 (2026-04-01) - 클라우드 동기화 및 모바일 웹앱 런칭 

이 문서는 이전 세션에서 진행된 ScheduleFlow 프로젝트의 진척 상황, 기술적 결정, 문제 해결 과정을 요약한 것입니다. 다음 세션(새 에이전트 환경)에서 작업의 연속성을 확보하기 위해 작성되었습니다.

---

## 1. 주요 구현 완료 사항 (Achievements)

### A. Firebase 연동 및 클라우드 아키텍처 구축
- **Google 소셜 로그인 지원**: `firebase-auth-compat`를 사용해 구글 로그인 인증 모듈(`auth.js`) 구현 완료. 오류 대기 6초 타임아웃(Timeout) 및 `localStorage` 폴백 방어 로직 적용.
- **Firestore 데이터 동기화**: `app.js`의 핵심 `Store` 객체를 Write-Through Cache 패턴으로 리팩토링.
  - 데이터 저장 흐름: `Cache -> localStorage -> Firestore(/users/{uid}/sf-data/)`
- **데이터 마이그레이션 UI**: 기존 로컬 환경 사용자의 데이터를 클라우드로 마이그레이션할지 묻는 모달 오버레이 구현 (로그인 직후 표시).
- **Firebase Security Rules 구성**: 로그인한 고유 사용자(`userId`)만 자신의 `sf-data` 문서에 접근하여 CRUD 할 수 있도록 규칙 배포.

### B. 모바일 반응형(Responsive) 환경 최적화
- **사이드바(Sidebar) 햄버거 메뉴**: 화면 너비가 768px 이하(스마트폰 크기)인 경우 좌측 사이드바가 화면 밖으로 밀려나 숨겨지고(Off-canvas), 토글 버튼으로 슬라이드인(Slide-in) 형태로 등장하게 개편.
- **백드롭 레이어(`.sidebar-backdrop`)**: 오버레이 열림/닫힘 UI/UX 적용 완료 및 빈 공간 터치 시 자동 닫힘 이벤트(`app.js`) 적용.
- **바텀 시트(Bottom Sheet) 계정 설정 패널**: 모바일에서 가려지던 컴포넌트 오류 수정(`z-index: 650`), 모바일에서 너비 100%로 아래쪽부터 올라오는 모던한 UI 적용.

### C. 클라우드 호스팅 배포 (Firebase Hosting)
- **앱의 웹 배포 파일 설정**: `firebase.json` 및 `.firebaserc` 셋업 완료.
- **Windows 터미널 명령어 충돌 해결**:
  - `firebase.js` 파일명이 `firebase-tools` CLI 명령어(윈도우에서 `firebase`)와 충돌하여 자바스크립트 파일이 열리는 현상 발견.
  - 이를 해결하기 위해 초기화 코드를 **`firebase-init.js`** 로 리네이밍 및 `index.html` 소스 연결 수정 완료.
  - 안전한 전역 모듈 호출을 위해 `firebase.cmd deploy --only hosting` 명령어 가이드라인 수립.

---

## 2. 발생했던 오류 (Mistake Patterns & Lessons Learned)
1. **Firestore `Unexpected match` 규칙 오류**: 루트 블록 선언 없이 `match`만 복사해 발생. `service cloud.firestore` 블록 전체 덮어쓰기로 해결.
2. **모바일 z-index 충돌**: 기존 `z-index: 500`의 사이드바 아래 계정 설정 메뉴(460)가 가려져 보이지 않던 이슈 발생, 설정 패널의 `z-index`를 최상단 팝업 레벨(650)로 재조정하여 해결.
3. **앱 무한 로딩 (App Hanging)**: 빈 DB나 초기 상태에서 Firebase 응답이 누락될 시 앱이 무한 대기하던 문제. Timeout 폴백 설계(`setTimeout`, 6000ms)를 통해 로컬 환경으로 즉시 진입하는 '안정성(resilience)' 확보.
4. **모바일 브라우저 강제 캐시(Cache) 문제**: `index.css` 변경 사항이 모바일 기기에 즉각 반영되지 않는 현상이 발생함. `index.html`에서 JS/CSS를 호출할 때 `?v=3` 등 쿼리스트링을 추가하는 Cache-Busting 기법으로 해결.
5. **계정 표시 영역 텍스트 넘침(Overflow)**: 긴 이메일 주소가 모바일 패널 영역 바깥으로 밀려나는 문제 발생. 텍스트 부모 컨테이너에 `flex:1`, `min-width:0`을 주고, 텍스트 자체에 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis;` 구조를 배포(`auth.js`)하여 안정적인 잘림 처리 구현.

---

## 3. 남은 작업 보류 목록 (Next Action Items)
다음 세션을 이어받을 AI 에이전트는 아래 항목을 우선적으로 고려하여 작업을 재개해야 합니다.

* [ ] 모바일 환경에서 캘린더나 출장(Trips), 문서(Docs) 메뉴 접근 시, 페이지 콘텐츠 렌더링 성능 최적화 검토
* [ ] 모바일 `PWA (Progressive Web App)` 기능 전환 (현재는 단순 모바일 호환 호스팅 방식. `manifest.json`, `sw.js` 추가 여부 차기 결정)
* [ ] 할 일(Todo) 및 출장(Trips) 관련 Cloud Firestore 로드 및 스케줄 수정 시 양방향 연동 안정성 심층 테스트 
* [ ] 로그아웃/계정 삭제 후 기존 로컬 데이터를 깨끗하게 정리 및 캐시 정리 로직 재확인

*(해당 문서는 작성 완료되었습니다. 이 파일(`docs/session_summary_2026_04_01.md`) 내용을 기반으로 자연스럽게 다음 작업을 지시해 주시면 됩니다.)*
