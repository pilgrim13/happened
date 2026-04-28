# Sprint 7 Bundle 5 리포트 — P2-11, P2-13, P3-14~P3-18

작성일: 2026-04-28

## 처리 항목

### P2-11: getDetailPlaceName 하드코딩 제거
- **변경**: `src/screens/MapScreen.tsx`
- `getPlaceName(place)` — `place.placeName ?? getDetailPlaceName(place.id)` → `place.placeName ?? place.name`
- `getDetailPlaceName` 함수(12줄) 전체 삭제
- `PlaceBubble.name` 은 항상 존재하는 필드로 안전한 fallback

### P2-13: ErrorBoundary 재시도 강제 리셋
- **변경**: `src/components/ErrorBoundary.tsx`
- `State`에 `retryKey: number` 추가
- `render()` 에서 children을 `<React.Fragment key={retryKey}>` 로 래핑 → key 변경 시 unmount/remount 보장
- `onPress`에서 `retryKey: s.retryKey + 1` 증분 → 이전에는 setState만 했으므로 에러 상태가 남아있는 children이 재마운트되지 않는 버그 수정

### P3-14: navigator.share/clipboard `as any` 제거
- **변경**: `src/hooks/useSharePost.ts`
- `expo/tsconfig.base`가 `lib: ["DOM", "ESNext"]`를 포함하므로 `navigator.share`, `navigator.clipboard`는 이미 DOM 타입으로 선언됨
- `(navigator as any).share` → `navigator.share` (2곳 제거)
- LOC 변경: -4

### P3-15: getPublicCountdownMins — 서버 unlockAt
- **변경**: `src/types/happened.ts`, `server/repository.ts`, `src/components/PostCard.tsx`
- `MemoryPost` 타입에 `unlockAt?: string | null` 추가
- `rowToPost()` — visibility가 `PublicAfter1h`일 때 `createdAt + 1h` 를 ISO 문자열로 `unlockAt` 설정, 나머지는 `null`
- `getPublicCountdownMins()` — `item.unlockAt` 우선 사용, 없으면 `createdAt + 1h` fallback (하위 호환)

### P3-16: i18n window.navigator.language → expo-localization
- **변경**: `src/i18n/index.tsx`, `package.json`
- `npx expo install expo-localization` (55.x 호환 버전 자동 선택)
- `import { getLocales } from 'expo-localization'` 추가
- `window.navigator.languages / window.navigator.language` 참조 제거 → `getLocales()[0]?.languageCode` 사용
- 웹/네이티브 모두 동작; localStorage·URL 파라미터 우선순위는 유지

### P3-17: rate-limit 환경별 기본값
- **변경**: `server/config.ts`
- `RATE_LIMIT_GLOBAL_MAX` 스키마: `default(100)` → `.optional()`
- `getConfig()` 에서 `e.RATE_LIMIT_GLOBAL_MAX ?? (isProd ? 200 : 1000)`
- dev 환경 기본값 100 → **1000** (개발 편의), prod 환경 명시적 env var 없으면 **200**

### P3-18: FeedMode 타입 통합 — SKIP
- **이유**: 클라이언트(`src/`)는 Metro 번들러로 빌드되고, `server/`는 별도 Node.js 프로세스
- tsconfig에 path alias 없음, Metro는 `server/` 를 번들링하지 않음
- 통합하려면 `shared/` 패키지 분리 또는 monorepo 구성 필요
- **결론**: 구조 변경 없이 즉시 적용 불가 → 별도 이슈로 등록 권장

---

## 검증 결과

| 검증 | 결과 |
|------|------|
| `npm run test:server` | 전체 통과 (ok 라인 모두 pass, fail 없음) |
| `npx expo export --platform web` | 성공 (`dist/` 생성, 3.2MB 번들) |

---

## 변경 파일 요약

| 파일 | 항목 | 변경 LOC |
|------|------|----------|
| `src/screens/MapScreen.tsx` | P2-11 | -13 |
| `src/components/ErrorBoundary.tsx` | P2-13 | +5 |
| `src/hooks/useSharePost.ts` | P3-14 | -4 |
| `src/types/happened.ts` | P3-15 | +1 |
| `server/repository.ts` | P3-15 | +3 |
| `src/components/PostCard.tsx` | P3-15 | +4 |
| `src/i18n/index.tsx` | P3-16 | +1/-3 |
| `package.json` | P3-16 | +1 (expo-localization) |
| `server/config.ts` | P3-17 | +1 |
