# happened AI Workflows

happened 프로젝트의 다중 에이전트 작업 산출물 디렉토리.

## 구조
```
.ai-workflows/happened/
  README.md                          # 이 파일
  <YYYY-MM-DD-feature-slug>/
    00_REQUEST.md                    # 원본 요청 + 리리 티어 판정
    01_SPEC.md                       # Planner 산출물
    02_SPEC_REVIEW.md                # Spec Critic (T3+)
    03_IMPLEMENTATION_PLAN.md        # (선택) Developer 사전 계획
    04_DONE.md                       # Developer 완료 보고 (QA 차단)
    05_QA.md                         # QA 판정
    06_ISSUES.md                     # 결함 리스트 (재작업 트리거)
    07_DECISION_LOG.md               # 사후 회고 + 메트릭
    artifacts/
      screenshots/
      logs/
```

## 운영
- 모든 파일은 frontmatter 필수 (feature_id / status / owner / spec_version 등)
- Hermes 스킬: `autonomous-ai-agents/happened-ai-team-workflow`
- 역할 프롬프트: 스킬 references/role-prompts/
- 템플릿: 스킬 templates/

## status 상태머신
```
requested → draft → approved → implemented → qa_passed → accepted
                ↘ revising ↙          ↘ qa_failed (→ revising)
```

## 규칙
- QA에는 `04_DONE.md`를 직접 노출하지 않는다 (의도 오염 방지). 리리가 SPEC + diff + test output + 로그만 큐레이션해 전달.
- `feature_id`는 `<YYYY-MM-DD-kebab-slug>` 형식.
- 작업 종료 시 `07_DECISION_LOG.md` 메트릭 기록 필수.
- 월 1회 회고: 디렉토리 전체 훑어보고 삭제할 규칙/패치할 스킬 항목 도출.
