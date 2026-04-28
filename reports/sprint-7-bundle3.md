# Sprint 7 · 묶음 3 — 아키텍처 분리 리포트

작성일: 2026-04-28

---

## 완료 항목

| 항목 | 커밋 |
|------|------|
| P2-12: 서버 인증 이중조회 제거 | `0237e9b` |
| P1-4: AppDataContext 도메인별 분리 | `a2f5e98` |
| P2-10: HomeScreen 다중 파일 분리 | `4730ea6` |

---

## P2-12: 인증 hook 통합 (서버 세션 이중조회 제거)

### 변경 파일
- `server/auth/authenticate.ts` (신규)
- `server/app.ts`

### 문제
`preValidation` 훅이 모든 요청에서 `Bearer` 원본 문자열을 그대로 `getSession`에 전달 → 파싱 오류로 항상 null 반환 (로깅이 사실상 비동작). 동시에 `/v1/media/presign`, `/v1/places` 핸들러가 별도로 `getSession` 호출 → DB 2회 조회.

### 해결
- `preValidation`: `"Bearer "` 접두어 제거 후 올바른 토큰으로 `getSession` 1회 호출, 결과를 `request.user`(Fastify decorator)에 캐시.
- `requireAuth(request)`: 캐시된 `request.user` 반환, 없으면 `statusCode: 401` 에러 throw.
- `/v1/media/presign`, `/v1/places`: `requireAuth(request)` 사용으로 DB 재조회 제거.
- `/v1/auth/session`은 full session 객체 반환이 필요하므로 현행 유지.

### 공개 엔드포인트 영향
없음 — `preValidation`은 `Authorization` 헤더 없으면 skip, `requireAuth`는 인증이 필요한 핸들러에서만 호출.

---

## P1-4: AppDataContext 분리

### 변경 파일
- `src/contexts/FeedContext.tsx` (신규)
- `src/contexts/NotificationsContext.tsx` (신규)
- `src/contexts/PlacesContext.tsx` (신규)
- `src/contexts/TimelineContext.tsx` (신규)
- `src/contexts/AppDataContext.tsx` (리팩토링)

### 분리 구조

```
AppDataProvider (public export)
  └── FeedProvider          → feedPosts, nearbyPosts, ref 소유
  └── NotificationsProvider → notifications 상태
  └── PlacesProvider        → places 상태
  └── TimelineProvider      → timeline 상태
  └── AppDataOrchestrator   → 액션 함수 + safetySummary
```

- 각 서브 컨텍스트는 `useMemo` + 의존 배열 최소화.
- `AppDataOrchestrator`: 서브 context setter에 직접 접근하여 `refresh()` 등 교차 도메인 작업 조율.
- `useAppData()`: **기존 consumer 호환 backward-compat hook 유지** (`@deprecated` + TODO 주석). 서브 context 전체를 flat merge하여 반환.
- 개별 hook(`useFeed`, `useNotifications`, `usePlaces`, `useTimeline`) re-export → 향후 consumer 마이그레이션 가능.

### 리렌더 개선 효과
`notifications` 변경이 `feedPosts`를 subscribe하는 컴포넌트를 재렌더하지 않음.
현재 consumer는 `useAppData()` 유지 → 마이그레이션 시 각 hook으로 전환하면 완전한 격리 달성.

---

## P2-10: HomeScreen.tsx 분리 (1,479줄 → 다중 파일)

### 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/PostCard.tsx` | PostCard memo 컴포넌트 + helper(formatCount, formatDistance, unlockCopy, matchesQuery) |
| `src/components/PostEditModal.tsx` | 캡션/공개범위 인라인 편집 모달 |
| `src/components/NotificationsPanel.tsx` | 알림 패널 (notificationText 포함) |
| `src/components/SearchPanel.tsx` | 검색 결과 패널 |
| `src/screens/HomeScreen.styles.ts` | HomeScreen 전용 StyleSheet |
| `src/screens/HomeScreen.tsx` | 위 컴포넌트 조합 (로직 변경 없음) |

**원칙 준수**: 추출만, 동작 동일성 유지. 상태/로직 이동 없음.

---

## 검증 결과

### 자동 검증

```
npm run test:server   → 17/17 ok (FAIL 0)
npx expo export --platform web → Bundled 605ms (2506 modules), Exported: dist
```

### 수동 검증 항목 (QA 체크리스트)

기기/시뮬레이터 또는 웹 브라우저에서 아래 항목을 확인한다:

#### 피드 화면 (HomeRoute)
- [ ] 앱 진입 시 피드 게시물이 로드된다
- [ ] 새로고침(Pull-to-refresh 또는 RefreshCw 버튼)이 동작한다
- [ ] "Nearby" 탭 전환 시 위치 기반 게시물이 로드된다
- [ ] 스크롤 하단 도달 시 추가 게시물이 로드된다(cursor pagination)
- [ ] PostCard 미디어 캐러셀이 좌/우 탐색된다
- [ ] PostCard 편집(캡션·공개범위 변경)이 저장된다
- [ ] PostCard 삭제 확인 후 피드에서 제거된다
- [ ] Echo/Save/Reply/Share 액션이 동작한다
- [ ] Hide/Report/Block 액션이 동작한다

#### 알림 패널
- [ ] Bell 아이콘 탭 시 알림 패널이 노출된다
- [ ] 알림 항목 탭 시 해당 게시물 또는 프로필로 이동한다
- [ ] 알림 오픈 시 읽음 처리된다(unread badge 해제)

#### 검색 패널
- [ ] Search 아이콘 탭 시 검색 입력창이 노출된다
- [ ] 2글자 이상 입력 시 사용자/장소 검색 결과가 노출된다

#### 프로필/지도/타임라인 화면
- [ ] 프로필 화면에 게시물·장소·안전 요약이 표시된다
- [ ] 지도 화면에 장소 버블이 렌더된다
- [ ] 타임라인 화면에 월별 데이터가 표시된다

---

## 강제 규칙 준수 확인

- [x] `.github/workflows` 수정 없음
- [x] `reports/refactor-analysis-*.md` 수정 없음
- [x] `reports/sprint-cost-log.md` 수정 없음
- [x] `npm run test:server` 통과
- [x] `npx expo export --platform web` 통과
