---
description: ScheduleFlow 세션 종료 — 작업 내용을 DEV_LOG.md·DECISIONS.md에 기록하고 GitHub에 푸시
---

# ScheduleFlow 세션 종료

세션에서 완료된 작업을 DEV_LOG.md와 DECISIONS.md에 기록하고 GitHub에 푸시한다.

## 실행 순서

### 1. 이번 세션 작업 파악

```bash
# 이번 세션 커밋 목록
git log --oneline -10

# 현재 미커밋 변경사항
git status
git diff
```

대화 히스토리도 참고해 커밋에 포함되지 않은 작업(디버깅, 조사, 의사결정)도 놓치지 않는다.

### 2. 미커밋 변경사항 처리

코드/스크립트 변경사항이 있으면 적절한 커밋 메시지로 먼저 커밋한다.
문서(DEV_LOG.md, DECISIONS.md, ROADMAP.md) 변경은 마지막에 별도로 커밋한다.

커밋 컨벤션:
- `feat:` 새 기능
- `fix:` 버그 수정
- `style:` CSS/UI 변경
- `refactor:` 리팩토링
- `docs:` 문서 (DEV_LOG, DECISIONS, ROADMAP 등)
- `chore:` 설정/Firebase 설정

### 3. DEV_LOG.md 갱신

`DEV_LOG.md` 상단 "현재 세션 컨텍스트" 테이블과 날짜 항목을 갱신한다.

포함 내용:
- 오늘 날짜 (`## YYYY-MM-DD`)
- 완료된 작업 목록 (핵심 파일, 변경 내용 위주)
- 수정한 버그 (원인과 해결 방법)
- 의사결정 (왜 그렇게 했는지 이유)
- 다음 할 일 (다음 세션 인계)

### 4. 작업실록.md 갱신

`작업실록.md` 맨 위에 오늘 날짜 섹션을 추가하고 이번 세션 작업 내용을 한 줄씩 기록한다.

### 5. DECISIONS.md 갱신

이번 세션에서 결정된 사항이 있으면:
- 미결 항목(P-*)을 확정 항목으로 이동
- 새로운 미결 사항 추가

### 6. ROADMAP.md 갱신

완료된 체크박스를 체크한다.

### 7. 문서 커밋 및 푸시

```bash
git add DEV_LOG.md DECISIONS.md ROADMAP.md 작업실록.md
git commit -m "docs: 세션 종료 — 작업 기록 갱신 ($(date +%Y-%m-%d))"
git push
```

### 8. 완료 보고

```
[ScheduleFlow 세션 종료]
완료한 작업: <목록>
업데이트한 문서: <목록>
커밋: <커밋 해시>
push: 완료
다음 할 일: <1~3개>
```

## 주의사항

- 커밋 전 `firebase-init.js`의 API 키는 Firebase Hosting 공개 프로젝트 기준으로 노출되어도 무방하나, Firestore 보안 규칙 확인 권장
- `public/` 디렉토리가 Firebase Hosting root — 루트에 HTML/JS 파일이 없어야 함
- CSS/JS 캐시 버스팅 버전 번호 (`?v=N`) 증가 여부 확인
