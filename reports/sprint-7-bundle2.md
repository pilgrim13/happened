# Sprint 7 Bundle 2 — 성능 P1 (P1-3, P1-6, P1-7)

**날짜**: 2026-04-28
**범위**: P1-3 (PostCard memo), P1-6 (feed pagination), P1-7 (tokens dynamic require 제거)

---

## 변경 목록

### P1-7: tokens.ts dynamic require 제거 (선행 처리)

| 파일 | 변경 내용 |
|------|-----------|
| `src/theme/tokens.shared.ts` | 신규 생성. colors/gradients/radius/spacing — RN 미의존 |
| `src/theme/tokens.ts` | `require('react-native')` IIFE 제거 → `import { Platform } from 'react-native'` 정적 import + `tokens.shared`에서 re-export |
| `server/repository.ts` | `../src/theme/tokens` → `../src/theme/tokens.shared` |
| `src/data/happened.ts` | `../theme/tokens` → `../theme/tokens.shared` (server 번들 체인 차단) |

**발견 사항**: `server/repository.ts → src/data/happened.ts → src/theme/tokens` 경로로 react-native가 esbuild에 유입되고 있었음. `data/happened.ts`도 함께 수정해야 빌드가 통과됨.

---

### P1-3: PostCard React.memo + useCallback

| 파일 | 변경 내용 |
|------|-----------|
| `src/screens/HomeScreen.tsx` | `React, useCallback` import 추가; `ActivityIndicator` 추가 |
| `src/screens/HomeScreen.tsx` | `function PostCard` → `const PostCard = React.memo(function PostCard(...))` |
| `src/screens/HomeScreen.tsx` | `keyExtractor` useCallback 추출 (deps: []) |
| `src/screens/HomeScreen.tsx` | `renderItem` useCallback 추출 (deps: 모든 PostCard props) |
| `src/screens/HomeScreen.tsx` | FlatList `keyExtractor`/`renderItem` 교체 |

**getItemLayout**: 카드 높이가 미디어 개수·캡션 길이에 따라 가변적 → skip.

**다른 화면 동일 패턴 (수정 제외, 언급만)**:
- `NotificationsScreen`: FlatList 없음 (map 렌더링)
- `TimelineScreen`: 있음 — keyExtractor 인라인, renderItem 인라인 (별도 묶음 처리 권장)
- `MapScreen`: 마커 리스트 없음 (map marker 직접 렌더)

---

### P1-6: 피드 pagination (nextCursor + onEndReached)

서버 측 `/v1/feed`는 이미 cursor-based pagination 지원 확인 (base64url 인코딩된 `{createdAt, id}`).

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/happenedApi.ts` | `fetchFeed` — `cursor?` 파라미터 추가; 반환 `{ items, nextCursor }` (items에만 absolutizeMediaUrl) |
| `src/contexts/AppDataContext.tsx` | `feedCursorRef`, `loadingMoreFeedRef` 추가 |
| `src/contexts/AppDataContext.tsx` | `refresh` — cursor 리셋 후 nextCursor 저장 |
| `src/contexts/AppDataContext.tsx` | `refreshNearby` — 구조분해 대응 |
| `src/contexts/AppDataContext.tsx` | `loadMoreFeed` 콜백 추가 (중복 로드 guard, 중복 id 필터) |
| `src/contexts/AppDataContext.tsx` | context type/value에 `loadMoreFeed` 노출 |
| `src/screens/HomeScreen.tsx` | `onLoadMore?` prop 추가; `loadingMore` state |
| `src/screens/HomeScreen.tsx` | `handleLoadMore` useCallback; FlatList `onEndReached`, `onEndReachedThreshold={0.5}`, `ListFooterComponent` (ActivityIndicator) |
| `src/navigation/tabRoutes.tsx` | `loadMoreFeed` 추출 → `HomeScreen onLoadMore` 연결 |

---

## 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| `npm run test:server` | ✅ 전체 통과 (parity 5 + s3-sprint 12개 ok) |
| `npx expo export --platform web` | ✅ 정상 (2502 modules, 경고 증가 없음) |
| `git diff --stat` | 7파일 변경 +82/-89, 신규 `tokens.shared.ts` 52줄 |

---

## 회귀 위험

| 항목 | 위험 | 비고 |
|------|------|------|
| `tokens.shared.ts` 미존재 환경 | 낮음 | 신규 파일, esbuild/metro 모두 정상 처리 |
| `PostCard` memo로 인한 props 비교 | 낮음 | 모든 function props는 useCallback/stable ref. `t` 함수는 언어 변경 시 교체됨 — 정상 동작 |
| `loadMoreFeed` 중복 호출 | 낮음 | `loadingMoreFeedRef` guard로 방어 |
| cursor 없을 때 onEndReached 무동작 | 의도된 동작 | `feedCursorRef.current === null`이면 loadMoreFeed 즉시 return |
| `renderItem` useCallback deps 누락 | 낮음 | 모든 PostCard props 명시적 나열 |
