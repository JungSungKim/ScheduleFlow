---
description: ScheduleFlow 세션 시작 — git pull, 이전 작업 컨텍스트 복원, 환경 점검
---

# ScheduleFlow 세션 시작

ScheduleFlow 프로젝트 작업 세션을 시작한다. 아래 절차를 순서대로 실행한다.

## 실행 순서

### 1. 최신 코드 동기화

```bash
git pull 2>/dev/null || echo "⚠️ git pull 실패 (원격 없거나 네트워크 오류)"
git status
```

충돌이 있으면 사용자에게 알리고 중단한다.

### 2. 작업 컨텍스트 복원

다음 파일을 순서대로 읽어 현재 상태를 파악한다:

1. `DEV_LOG.md` — 최근 세션 컨텍스트와 다음 할 일
2. `DECISIONS.md` — 미결 사항(P-*) 확인
3. `ROADMAP.md` — 현재 Phase 위치
4. `작업실록.md` — 최근 2~3개 날짜 항목

### 3. 환경 점검

```bash
# Firebase CLI 설치 여부
firebase --version 2>/dev/null && echo "✅ Firebase CLI 있음" || echo "❌ Firebase CLI 없음 — npm install -g firebase-tools"

# public/ 구조 확인
ls public/

# 최근 커밋
git log --oneline -5
```

### 4. 세션 시작 브리핑

다음 내용을 정리해서 보고한다:

**현재 상태**
- 마지막 작업 날짜 및 완료 항목 요약
- 미결 설계 결정사항 (P-* 목록)
- 현재 ROADMAP Phase 및 진행률

**이번 세션 추천 작업**
- DEV_LOG.md의 다음 할 일 목록에서 우선도 순으로 1~3개

**환경 준비 상태**
- Firebase CLI 점검 결과 (✅/❌)

**주요 파일 경로**
- 소스: `public/*.js`
- 스타일: `public/index.css`
- 진입점: `public/index.html`
- Firebase 설정: `public/firebase-init.js`
- 로컬 미리보기: `firebase serve --only hosting`
- 배포: `firebase deploy --only hosting`
