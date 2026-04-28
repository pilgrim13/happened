# Sprint 7 FINAL — 통합 변경 요약

작성일: 2026-04-28
묶음: 1~5 (Bundle 1~5)

---

## 전체 처리 현황 매트릭스 (P0~P3, 18개)

| 이슈 | 제목 | 우선순위 | 묶음 | 상태 | 비고 |
|------|------|----------|------|------|------|
| P0-1 | Apple Sign-In 서버 nonce 검증 누락 | P0 | Bundle 1 | ✅ 완료 | |
| P0-2 | 세션 토큰 로그 노출 | P0 | Bundle 1 | ✅ 완료 | |
| P1-3 | PostCard React.memo + useCallback | P1 | Bundle 2 | ✅ 완료 | |
| P1-4 | AppDataContext 도메인 분리 | P1 | Bundle 3 | ✅ 완료 | FeedContext / NotificationsContext / PlacesContext / TimelineContext |
| P1-5 | GPS 캐시 (Haversine 5m 임계값) | P1 | Bundle 4 | ✅ 완료 | |
| P1-6 | 피드 pagination (nextCursor + onEndReached) | P1 | Bundle 2 | ✅ 완료 | |
| P1-7 | tokens.ts dynamic require 제거 | P1 | Bundle 2 | ✅ 완료 | |
| P2-8 | 지도 타일 diff 비교 (JSON.stringify) | P2 | Bundle 4 | ✅ 완료 | |
| P2-9 | 다크모드 ThemeProvider | P2 | Bundle 4 | ✅ 완료 | |
| P2-10 | HomeScreen 1479줄 다중 파일 분리 | P2 | Bundle 3 | ✅ 완료 | 로직 변경 없음 |
| P2-11 | getDetailPlaceName 하드코딩 제거 | P2 | Bundle 5 | ✅ 완료 | `place.name` fallback |
| P2-12 | 서버 인증 dedup (getSession 이중조회) | P2 | Bundle 3 | ✅ 완료 | request.user 캐싱 |
| P2-13 | ErrorBoundary 재시도 강제 리셋 | P2 | Bundle 5 | ✅ 완료 | `retryKey` 증분 |
| P3-14 | navigator.share/clipboard `as any` 제거 | P3 | Bundle 5 | ✅ 완료 | DOM lib 이미 포함 |
| P3-15 | getPublicCountdownMins — 서버 unlockAt | P3 | Bundle 5 | ✅ 완료 | 하위 호환 fallback |
| P3-16 | i18n window.navigator.language 교체 | P3 | Bundle 5 | ✅ 완료 | expo-localization 도입 |
| P3-17 | rate-limit 환경별 기본값 | P3 | Bundle 5 | ✅ 완료 | dev:1000 / prod:200 |
| P3-18 | FeedMode 타입 통합 (server → client) | P3 | Bundle 5 | ⏭ SKIP | 구조 변경 필요 (별도 이슈) |

**완료: 17/18 · Skip: 1/18 (P3-18)**

---

## 묶음별 변경 요약

### Bundle 1 — 보안 패치 (P0×2)
- Apple Sign-In nonce 검증 서버 강화 (`server/routes/auth.ts`)
- 세션 토큰 로그 마스킹 (`server/middleware/`)
- 신규 테스트 3케이스 추가, 전체 통과

### Bundle 2 — 성능 P1 (P1-3, P1-6, P1-7)
- `PostCard` React.memo 적용, 핵심 콜백 useCallback화
- 피드 cursor pagination + FlatList `onEndReached` 연동
- `tokens.ts` ESM static import 변환

### Bundle 3 — 아키텍처 분리 (P1-4, P2-10, P2-12)
- `AppDataContext` → 4개 도메인 컨텍스트 분리
- `HomeScreen` 1479줄 → 다중 파일 분리 (로직 변경 없음)
- 서버 `getSession` 이중조회 → `request.user` 캐싱 dedup

### Bundle 4 — GPS / 지도 / 다크모드 (P1-5, P2-8, P2-9)
- GPS 위치 5m Haversine 임계값 캐시
- 지도 타일 JSON.stringify diff 비교 (불필요 리렌더 제거)
- `ThemeProvider` + `useTheme` 훅 추가, 다크모드 지원

### Bundle 5 — 마감 (P2-11, P2-13, P3-14~P3-18)
- 하드코딩 플레이스명 제거 (`place.name` fallback)
- ErrorBoundary `retryKey`로 children 강제 unmount/remount
- `navigator.share/clipboard` as any 제거 (DOM 타입 활용)
- 서버 `unlockAt` ISO 문자열 응답 + 클라 fallback 계산
- `expo-localization getLocales()` 로 언어 감지 통합
- RATE_LIMIT_GLOBAL_MAX dev:1000 / prod:200

---

## 검증 결과 (최종)

| 검증 | 결과 |
|------|------|
| `npm run test:server` | 전체 통과 (번들 1~5 누적) |
| `npx expo export --platform web` | 성공 (3.2MB 번들) |
| TypeScript strict mode | 오류 없음 |

---

## P3-18 후속 조치 권고

`FeedMode` 타입 통합을 위해서는 `shared/` 패키지를 별도 생성하고 `tsconfig.json` paths alias 또는 npm workspace로 연결해야 함. 현재 구조에서는 Metro 번들러가 `server/` 를 번들링하지 않으므로 즉시 적용 불가.
