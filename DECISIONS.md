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

---

## 🔲 미결 사항

| ID | 항목 | 현재 방향 | 결정 필요 시점 |
|----|------|-----------|--------------|
| P-001 | PDF 내보내기 방식 | `window.print()` vs `jsPDF` vs 서버사이드 | Phase 2 문서 기능 시작 전 |
| P-002 | PWA 지원 | manifest.json + service worker 추가 | Phase 3 시작 전 |
| P-003 | AI 문서 초안 | Claude API 직접 호출 vs Firebase Functions 경유 | Phase 4 시작 전 (보안 고려) |
