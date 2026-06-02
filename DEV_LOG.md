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
- 소스 파일 전체 `public/` 디렉토리로 이동 (Firebase Hosting root 분리)
- `firebase.json` `"public": "."` → `"public": "public"` 수정
- `docs/` 하위 구조 정리: `sessions/`, `design/`, `specs/`
- 기존 세션 문서(`docs/*.md`) → `docs/sessions/`, `docs/design/` 로 재배치
- 프로젝트 문서 생성: `CLAUDE.md`, `ROADMAP.md`, `DECISIONS.md`, `DEV_LOG.md`, `작업실록.md`
- 전역 커맨드 등록: `scheduleflow-start`, `scheduleflow-exit`

### 다음 할 일

- [ ] Phase 2: 문서 PDF 내보내기 구현
- [ ] Phase 2: 문서 템플릿 커스터마이징 UI
- [ ] Phase 3: 반복 일정 기능
