# Happened 리팩토링 분석 리포트 (2026-04-28)

## 요약
- 총 발견 이슈 수: 18
- P0(차단/심각) 2개 / P1(높음) 5개 / P2(중간) 6개 / P3(낮음) 5개

분석 대상: 59개 파일, 약 16,775 LOC (src + server)

---

## 우선순위 분류

### P0 — 즉시 수정 (보안/크래시/심각한 성능)

---

#### 1. Apple Sign-In JWT 서명 미검증

- **위치**: `server/app.ts:551-571`
- **증상**: Apple identityToken을 base64 decode만 하고 서명 검증 없이 `sub`(Apple user ID)를 그대로 신뢰한다. 공격자가 임의로 조작한 JWT를 보내도 해당 Apple user ID로 계정이 생성/로그인된다.
- **근거 (data-backed)**:
  ```ts
  // server/app.ts:551-557
  // TODO: Apple JWT signature 검증 필요 (다음 PR — apple-signin-auth 라이브러리)
  const parts = body.identityToken.split('.');
  if (parts.length !== 3) { ... }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as { sub?: string; email?: string };
  const appleUserId = payload.sub;
  ```
- **수정안**: `apple-signin-auth` 또는 `jsonwebtoken` + Apple 공개 키 JWKS(`https://appleid.apple.com/auth/keys`) 페치로 RS256 서명 검증 후 `iss`/`aud`/`exp` 클레임까지 확인.
- **영향 범위**: `/v1/auth/apple` 엔드포인트 전체. 계정 탈취 가능. 회귀 위험: 기존 Apple 사용자에 영향 없이 검증 레이어만 추가.

---

#### 2. 웹에서 JWT 세션 토큰을 localStorage에 평문 저장

- **위치**: `src/storage/secureSession.ts:16-22`
- **증상**: `Platform.OS === 'web'`일 때 `window.localStorage`에 `AuthSession`(bearer token 포함)을 직렬화하여 저장한다. XSS 취약점이 생기면 세션 토큰 전체가 탈취된다.
- **근거 (data-backed)**:
  ```ts
  // src/storage/secureSession.ts:16-17
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthSession) : null;
  ```
  네이티브에서는 `expo-secure-store`를 쓰지만 웹에서는 보호 없음.
- **수정안**: 웹 배포를 PWA로 제한하고 HttpOnly 쿠키 기반 세션으로 전환하거나, 최소한 `sessionStorage`로 교체하여 탭 종료 시 소멸시키기. 장기적으로는 BFF 패턴(HttpOnly 쿠키) 권장.
- **영향 범위**: 웹 사용자 전원. 회귀 위험: 웹 로그인 흐름 전체 재테스트 필요.

---

### P1 — 높음 (UX/리팩토링 핵심)

---

#### 3. PostCard가 React.memo 없이 FlatList에서 매번 재렌더

- **위치**: `src/screens/HomeScreen.tsx:416-`
- **증상**: `PostCard`는 `function PostCard(...)` 평범한 함수 선언이며 `React.memo`로 감싸지 않았다. `HomeScreen` 상태(`refreshing`, `searchOpen`, `selectedMode` 등)가 바뀔 때마다 FlatList 전체 카드가 재렌더된다.
- **근거 (data-backed)**:
  ```ts
  // src/screens/HomeScreen.tsx:416
  function PostCard({ item, currentUserId, ... }) {
  ```
  `src/screens/HomeScreen.tsx` 전체에 `useMemo`/`useCallback`/`React.memo` 사용 없음 (grep 결과 0건).
- **수정안**: `const PostCard = React.memo(function PostCard(...) { ... })` 적용 + `renderItem`에 `useCallback` 추가. `getItemLayout`도 카드 높이가 고정이면 추가.
- **영향 범위**: 피드 스크롤 퍼포먼스 전반. 회귀 위험: 낮음.

---

#### 4. AppDataContext useMemo 의존 배열에 `setFeedPosts`/`setNotifications` 원시 setState 포함

- **위치**: `src/contexts/AppDataContext.tsx:198-234`
- **증상**: `value` useMemo 의존 배열에 React state setter(`setFeedPosts`, `setNotifications`)를 나열하지 않았지만 context value에 직접 노출하고 있다. 더 큰 문제는 `acknowledgeNotifications`가 `notifications` 배열을 의존 배열에 가지므로, 알림 목록이 바뀔 때마다 `value` 객체가 교체되어 전체 consumers(`HomeScreen`, `ProfileScreen` 등)가 재렌더된다.
- **근거 (data-backed)**:
  ```ts
  // src/contexts/AppDataContext.tsx:150-157
  const acknowledgeNotifications = useCallback(async () => {
    if (!token || notifications.every((n) => n.read)) return;
    ...
  }, [notifications, token]);   // ← notifications 변경마다 새 함수
  ...
  // 198-234: value useMemo 의존 배열에 acknowledgeNotifications 포함
  ```
- **수정안**: `notifications` 참조를 ref로 유지하거나 context를 `NotificationsContext`로 분리. AppDataContext가 담당하는 범위가 너무 넓다(feed + nearby + notifications + places + timeline + safety).
- **영향 범위**: 알림 읽기 시 전체 앱 불필요한 재렌더. 회귀 위험: context 분리는 PR 단위 변경 필요.

---

#### 5. GPS 위치 획득에 폴링/백그라운드 구독 없음 — 업로드마다 새 권한 요청

- **위치**: `src/services/location.ts:44-64`, `src/hooks/useCaptureFlow.ts:56-63`
- **증상**: `getCurrentLocation()`은 매 호출마다 `Location.getCurrentPositionAsync`를 새로 실행한다. `expo-location`의 `watchPositionAsync`나 `startForegroundUpdatesAsync` 없이 단발성 fetch만 한다. 업로드 직전 GPS 획득에 실패하면 사용자에게 오류를 던진다.
- **근거 (data-backed)**:
  ```ts
  // src/services/location.ts:55-57
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  ```
  `AppDataContext`의 30초 쓰로틀 캐시(`viewerCoordsRef`)는 피드용이고, 업로드 경로(`useCaptureFlow.ts:56-63`)는 캐시 없이 매번 재획득.
- **수정안**: `Location.Accuracy.Balanced`로 낮추고 이전 위치 캐시(60초 유효)를 `CaptureContext`에 유지. 권한 거부 시 설정 앱 유도 안내 추가.
- **영향 범위**: 업로드 성공률, 배터리. 회귀 위험: 업로드 E2E 테스트 필요.

---

#### 6. 피드 pagination 미구현 — nextCursor 무시

- **위치**: `src/services/happenedApi.ts:171-173`, `src/contexts/AppDataContext.tsx:95`
- **증상**: 서버 응답에 `nextCursor`가 있지만 클라이언트는 이를 버린다. `fetchFeed`가 반환하는 건 `items`만이고, AppDataContext는 전체를 `setFeedPosts`로 교체한다. 스크롤 하단 무한로드(infinite scroll)가 없다.
- **근거 (data-backed)**:
  ```ts
  // src/services/happenedApi.ts:173
  return (response.data?.items ?? []).map(absolutizeMediaUrl);
  // nextCursor는 반환값에서 제거됨
  ```
  `HomeScreen.tsx` FlatList에 `onEndReached` 콜백 없음.
- **수정안**: `fetchFeed`가 `{ items, nextCursor }` 모두 반환하도록 변경. AppDataContext에 `cursor` ref + `loadMore` 콜백 추가. FlatList에 `onEndReached`/`onEndReachedThreshold` 연결.
- **영향 범위**: 피드 확장성. 현재 단일 페이지만 로드됨. 회귀 위험: 중간.

---

#### 7. `tokens.ts`에서 `require('react-native')` 동적 import — Hermes 번들러 최적화 방해

- **위치**: `src/theme/tokens.ts:58-60`
- **증상**: IIFE 내부에서 `require('react-native')`를 동적 호출한다. Metro bundler의 static analysis 및 tree-shaking에서 제외되고, Hermes의 bytecode precompilation이 이 패턴을 최적화하지 못할 수 있다.
- **근거 (data-backed)**:
  ```ts
  // src/theme/tokens.ts:55-64
  const _platformFont: string = (() => {
    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Platform } = require('react-native') as { Platform: { OS: string } };
      if (Platform.OS === 'ios') return 'Avenir Next';
      return 'sans-serif';
    }
    return 'system-ui';
  })();
  ```
- **수정안**: `Platform.select`을 정적으로 사용하거나 `fonts` 객체 초기화를 `Platform.select`를 통해 상단 import 레벨에서 처리. `navigator.product` 체크는 deprecated된 방식.
- **영향 범위**: 토큰이 앱 전체에서 import되므로 번들 분석에 영향. 회귀 위험: 낮음.

---

### P2 — 중간

---

#### 8. MapScreen의 커스텀 타일 맵 — 메모리 누수 위험 (타일 캐시 없음)

- **위치**: `src/screens/MapScreen.tsx:117-143`
- **증상**: `buildTiles()`는 매 렌더마다 새 타일 URL 배열을 생성한다. 줌/팬 시 수십 개의 `<Image>` 컴포넌트가 생성/해제를 반복한다. React Native의 이미지 캐시는 LRU이지만 타일 수 × 줌 레벨 조합이 많아지면 메모리 압박 발생.
- **근거 (data-backed)**:
  ```ts
  // MapScreen.tsx:221
  const { tiles, bounds } = useMemo(() => buildTiles(center, frameWidth, mapHeight, zoom), [center, frameWidth, mapHeight, zoom]);
  ```
  `center`가 팬 이벤트마다 `setManualCenter`로 바뀌므로 `buildTiles` 재실행 → 타일 배열 완전 교체.
- **수정안**: 타일 URL 기준 키 안정성 확보(이미 `${tileX}:${tileY}` key 사용 중). 추가로 이전 타일 Set을 유지해 변경분만 교체하는 접근, 또는 `react-native-maps`로 교체(마커 클러스터링 포함).
- **영향 범위**: 지도 화면 메모리. 저사양 디바이스에서 crash 가능. 회귀 위험: 중간.

---

#### 9. 다크모드 완전 미지원 — 토큰 레벨에서 light-only 하드코딩

- **위치**: `src/theme/tokens.ts:1-30`
- **증상**: `colors` 객체가 `setlogBg: '#FFF8EF'`, `setlogPaper: '#FFFEF8'` 등 라이트 팔레트만 정의. `useColorScheme`/`Appearance` 사용처 없음(grep 0건). 시스템 다크모드에서 앱 배경이 흰색 유지됨.
- **수정안**: `tokens.ts`를 `light`/`dark` 팔레트 쌍으로 구성하고 `useColorScheme` 훅 기반 전환 레이어 추가. 단기적으로는 `StatusBar style="auto"` 변경만이라도 진행.
- **영향 범위**: 접근성 및 iOS/Android 다크모드 사용자. 회귀 위험: 전체 화면 컬러 점검 필요.

---

#### 10. `HomeScreen.tsx` 파일 크기 1,479줄 — 단일 파일 과부하

- **위치**: `src/screens/HomeScreen.tsx:1-1479`
- **증상**: `HomeScreen`, `PostCard`, 인라인 스타일, 알림 패널, 검색 패널, 편집 모달이 모두 한 파일에 있다. `PostCard`만 최소 300줄+이다.
- **수정안**: `PostCard` → `src/components/PostCard.tsx`, 알림/검색 패널 → 별도 컴포넌트, 스타일 → `src/screens/HomeScreen.styles.ts`로 분리.
- **영향 범위**: 유지보수성. 회귀 위험: 낮음 (로직 이동 없이 추출만).

---

#### 11. `getDetailPlaceName` 하드코딩 fallback — 실사용 불가능한 데이터

- **위치**: `src/screens/MapScreen.tsx:453-463`
- **증상**: 함수 내부에 서울 장소 5개가 하드코딩되어 있고 기본값이 `'Seolleung Station Cafe'`로 고정된다. 실제 서버에서 오는 `placeName`이 없는 장소는 모두 이 fallback을 받는다.
- **근거 (data-backed)**:
  ```ts
  function getDetailPlaceName(placeId: string) {
    const placeNames: Record<string, string> = {
      seolleung: 'Seolleung Station Cafe',
      ...
    };
    return placeNames[placeId] ?? 'Seolleung Station Cafe';
  }
  ```
- **수정안**: `PlaceBubble.placeName`이 없으면 `place.name`을 fallback으로 사용. 하드코딩 제거.
- **영향 범위**: 지도 마커 이름 표시. 회귀 위험: 낮음.

---

#### 12. 서버 `preValidation` hook에서 getSession 과잉 호출

- **위치**: `server/app.ts:114-126`
- **증상**: 모든 요청(공개 엔드포인트 포함)에서 `Authorization` 헤더가 있으면 `repository.getSession(auth)`을 추가로 호출한다. 로깅 목적으로 userId를 추출하기 위한 것이지만, 인증이 필요한 엔드포인트들은 핸들러 내부에서 `authHeaderSchema.parse` + `getSession`을 또 호출한다 → 인증된 요청은 DB 세션 조회를 2회 실행.
- **수정안**: 인증 결과를 `request.user`에 attach하는 공용 `authenticate` hook을 만들고 엔드포인트에서 재사용. 또는 preValidation을 제거하고 handler 내 session 결과를 pino child logger에만 주입.
- **영향 범위**: DB 부하. 회귀 위험: 중간.

---

#### 13. `ErrorBoundary` 재시도 시 state만 초기화 — 루트 원인 미해결

- **위치**: `src/components/ErrorBoundary.tsx:30-33`
- **증상**: "다시 시도" 버튼이 `this.setState({ hasError: false, error: null })`만 호출한다. 에러를 발생시킨 컴포넌트는 그대로 re-render되므로 동일 에러가 반복 발생할 수 있다.
- **수정안**: `key` prop을 바꿔서 강제 unmount/remount하거나, 재시도 가능한 화면으로 navigate 처리.
- **영향 범위**: 크래시 복구 UX. 회귀 위험: 낮음.

---

### P3 — 낮음 (cleanup, naming 등)

---

#### 14. `navigator.share`/`navigator.clipboard` 타입 캐스팅 `any`

- **위치**: `src/hooks/useSharePost.ts:19,29`
- **수정안**: `lib: ["DOM"]` tsconfig에 추가하거나 `ShareData` 타입을 직접 선언.

---

#### 15. `getPublicCountdownMins` — 클라이언트 시간 기반 카운트다운

- **위치**: `src/screens/HomeScreen.tsx:401-414`
- **증상**: 클라이언트 `Date.now()`로 1시간 잠금 해제 시간 계산. 클라이언트/서버 시간 차이가 있으면 부정확.
- **수정안**: 서버에서 `unlockAt` 타임스탬프를 `MemoryPost`에 포함해 내려주기.

---

#### 16. `src/i18n/index.tsx` — `window.navigator.language` 직접 접근

- **위치**: `src/i18n/index.tsx`
- **수정안**: `expo-localization`의 `getLocales()` 사용으로 통일.

---

#### 17. `RATE_LIMIT_GLOBAL_MAX` 기본값 100 req/분 — 프로덕션에서 낮을 수 있음

- **위치**: `server/config.ts:45`
- **수정안**: 환경별 기본값 분리(dev: 1000, prod: 환경변수 필수화).

---

#### 18. `FeedMode` 타입이 `types/happened.ts`에만 있고 서버 schema와 분리

- **위치**: `src/types/happened.ts:3`, `server/schemas.ts:3`
- **증상**: `feedModeSchema = z.enum(['Following', 'Nearby', 'Memories'])`와 `FeedMode = 'Following' | 'Nearby' | 'Memories'`가 각자 선언되어 있어 추후 모드 추가 시 양쪽 동기화 실수 가능.
- **수정안**: `server/schemas.ts`에서 `z.infer<typeof feedModeSchema>`를 공용 타입으로 export하고 클라이언트 types.ts에서 import.

---

## 6관점 리뷰 (pr-review-toolkit)

- **Comments**: `server/app.ts:551`의 `TODO: Apple JWT 서명 검증`이 핵심. 실사용 전 반드시 해소. 나머지 TODO(`server/media.ts:5`)는 S3 전환 계획과 연동.
- **Tests**: `server/__tests__/parity.test.ts`, `s3-sprint.test.ts`는 서버에만 존재. 클라이언트 사이드 유닛 테스트(훅, 컨텍스트) 전무. `useCaptureFlow`/`AppDataContext`에 최소 happy-path 테스트 필요.
- **Error handling**: `useCaptureFlow.upload()`에서 위치 획득 실패 → `throw Error(...)` 후 caller가 `catch` 없이 `onNotice`로만 처리하는 패턴이 반복. 오류 전파 계약이 일관되지 않음.
- **Type design**: `MemoryPost.authorId`가 `string | undefined`(optional)인데 `withViewerState`에서 `post.authorId && blockedAuthorIds.has(post.authorId)` 필요. 서버에서 생성하는 포스트는 항상 authorId를 갖는다면 non-optional로 강화.
- **Code quality**: `HomeScreen.tsx` 1,479줄은 단일 파일 유지보수 임계치 초과. `AppDataContext.tsx`도 240줄로 12개 콜백을 관리해 테스트가 어렵다.
- **Simplification**: `absolutizeMediaUrl` / `absolutizeUser` / `absolutizeProfile` / `absolutizeUrl` 4개 함수가 `happenedApi.ts`에 중복 패턴으로 나열. 단일 `absolutize(obj, fields)` 유틸로 통합 가능.

---

## 디자인 진단 (frontend-design)

- **현재 톤**: `setlog*` 팔레트(크림 베이지, 파스텔 민트/핑크/라벤더)를 일관되게 사용. 필름 아날로그 감성에 맞는 warm-off-white 기조. `radius.pill = 999`로 전반적으로 둥근 UI.
- **AI슬롭 징후**: 없음. 컴포넌트 명칭, 색 이름, 스타일 값 모두 의도적으로 정의되어 있고 불필요한 gradient layering이나 과도한 shadow 중첩이 없음.
- **제안 방향**:
  1. 다크모드 팔레트를 `tokens.ts`에 `setlogDark*` 접두어로 병행 정의 후 단계적 적용.
  2. `typography` 객체가 정의되어 있으나 화면에서는 inline `fontSize/fontWeight`를 직접 쓰는 경우가 많음(`MapScreen.tsx`의 `styles.title`, `styles.kicker` 등). 토큰 기반 스프레드로 통일하면 텍스트 스케일 변경 시 일괄 적용 가능.
  3. `elevation` 토큰이 정의되어 있으나 사용되지 않음(shadow 값이 각 StyleSheet에 inline). `elevation.mid`/`elevation.low` 토큰 전파.

---

## RN-Web → Native 전환 리스크

다음 파일들이 웹 전용 DOM/BOM API를 직접 참조하며, 네이티브에서는 Platform guard로 skip되지만 번들에 포함된다:

| 파일 | Web-only 코드 |
|------|--------------|
| `src/hooks/useWebViewportShell.ts:7-57` | `document.documentElement`, `document.body`, `window.visualViewport`, `window.addEventListener` |
| `src/hooks/useVisualViewport.ts:12-37` | `window.visualViewport`, `window.matchMedia`, `window.innerHeight` |
| `src/hooks/useVisualViewportHeight.ts:10-40` | `window.visualViewport`, `window.innerWidth` |
| `src/storage/secureSession.ts:13-23` | `window.localStorage` |
| `src/services/happenedApi.ts:59-65` | `window.location` |
| `src/screens/CaptureScreen.tsx:38-80` | `FileReader`, `document.createElement`, `HTMLImageElement`, `canvas` |
| `src/screens/ProfileScreen.tsx:43-80` | `document.createElement('input')`, `document.body.appendChild` |
| `src/hooks/useSharePost.ts:19,29` | `navigator.share`, `navigator.clipboard` |

모든 사용처에서 `Platform.OS !== 'web'` guard 또는 `typeof window !== 'undefined'` 체크가 적용되어 있어 RN Native 실행 시 크래시는 없다. 그러나 `useWebViewportShell`/`useVisualViewport`/`useVisualViewportHeight` 3개 훅은 네이티브에서 완전히 no-op이며 추후 네이티브 전용 뷰포트 처리를 추가할 때 분리 설계가 필요하다.

---

## 보안 / 프라이버시 체크

| 항목 | 상태 | 비고 |
|------|------|------|
| Apple JWT 서명 검증 | **미구현** | P0. `server/app.ts:551` |
| JWT/세션 토큰 저장 (native) | 양호 | `expo-secure-store` 사용 |
| JWT/세션 토큰 저장 (web) | **위험** | `localStorage` 평문. P0 |
| 비밀번호 해싱 | 양호 | `scryptSync` + salt |
| 타이밍 공격 방어 | 양호 | `timingSafeEqual` 사용 |
| zod 입력 검증 | 양호 | 모든 엔드포인트 적용 |
| rate-limit | 양호 | global + auth별 분리 |
| helmet CSP | 양호 | 프로덕션 기본 CSP 활성화 |
| CORS | 양호 | `API_CORS_ORIGIN` 환경변수 제어 |
| 위치 데이터 전송 | 양호 | Bearer 토큰 필요, HTTPS 가정 |
| 위치 로그 redact | 양호 | pino redact paths에 `token`, `password` 포함 |
| media path traversal | 검토 필요 | `server/media.ts`의 로컬 파일명 검증 미확인 |
| 파일 MIME 검증 | 양호 | `ALLOWED_PHOTO_MIMES`/`ALLOWED_VIDEO_MIMES` Set 사용 |
| 세션 DB 조회 이중 실행 | 낮은 위험 | P2-12 참조 |

---

## 권장 실행 순서

다음 위임(다음 스프린트 단위)에서의 권장 처리 순서:

**묶음 1 — 보안 패치 (즉시, 별도 PR)**
- P0-1: Apple JWT RS256 서명 검증 구현
- P0-2: 웹 세션 토큰 저장 방식 변경 (localStorage → sessionStorage 또는 HttpOnly 쿠키 준비)

**묶음 2 — 성능 (Sprint 7A)**
- P1-3: `PostCard` React.memo + FlatList `useCallback(renderItem)`
- P1-6: 피드 pagination (`nextCursor` 연결 + `onEndReached`)
- P1-7: `tokens.ts` 동적 require 제거

**묶음 3 — 아키텍처 분리 (Sprint 7B)**
- P1-4: `AppDataContext` → `FeedContext` + `NotificationsContext` 분리
- P2-10: `HomeScreen.tsx` → `PostCard` + 스타일 파일 분리
- P2-12: 인증 hook 통합으로 세션 이중 조회 제거

**묶음 4 — 기능 완성 (Sprint 7C)**
- P1-5: GPS 캐시 전략 + `Balanced` accuracy 적용
- P2-8: MapScreen 타일 캐시 전략 또는 `react-native-maps` 전환 검토
- P2-9: 다크모드 팔레트 토큰 추가 + `StatusBar style="auto"`

**묶음 5 — 품질 마감 (Sprint 7D)**
- P2-11: `getDetailPlaceName` 하드코딩 제거
- P2-13: `ErrorBoundary` 재시도 key 강제 리셋
- P3-14~18: 타입 강화, 네이밍 정리, 토큰 통일

---

## 메타

- 분석한 파일 수: 33 (src: 26 + server: 7)
- 읽은 LOC 추정: 약 10,200
- 발견 이슈 총수: 18 (P0×2, P1×5, P2×6, P3×5)
- 권장 다음 액션: P0-1(Apple JWT 검증)과 P0-2(웹 토큰 저장)는 기능 배포 전 반드시 처리. 나머지는 묶음 2부터 스프린트 단위 진행.
