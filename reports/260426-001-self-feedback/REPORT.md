# Happened 자가 피드백 리포트 — 출시 가능성 6각 진단

작성일: 2026-04-26
범위: `~/codex-projects/happened` 전체
톤: 가차없이. "출시 가능한가? No, 왜냐하면…"

> TL;DR — 현재 빌드는 **친한 친구 ~10명이 ngrok으로 둘러보는 라이브 프로토타입** 수준이다. 제품 컨셉(장소 잠금/회상)은 명확하지만, **출시(앱스토어/공개 SNS)** 까지는 6개 측면 모두에서 결정적 결손이 있다. "인기 SNS"까지의 거리는 지금부터 1~2개 분기 분량의 작업이다.

---

## 1. 기획 (Product)

**현재 상태:** 컨셉은 또렷하지만 "왜 매일 다시 여느냐"의 답이 비어 있다.

### 출시 수준 대비 부족 (구체)
- `docs/product-brief.md:39` 에 정의된 핵심 루프(발견 → 해제 → 기록 → 재방문 → 축적)에서 **재방문/축적 단계가 실제 구현된 적이 없다.** 코드상 "Recall 카드"는 `docs/design-prototype.md:23`에만 있고 `src/screens/`에 Recall 화면이 없으며, `repository.ts`에도 재방문 트리거(예: 과거 방문 위치 재진입 감지) 로직이 0줄이다. 즉 "다시 가면 열린다"는 핵심 약속이 **푸시/알림/회상 카드 형태로 사용자에게 도달하지 못한다.**
- 푸시 인프라가 없다. `docs/local-vs-production.md:21` "Notifications: in-app notification list only, no native/web push yet." → 위치 기반 SNS의 핵심인 **"근처 도착 알림"이 0**. 사용자는 앱을 능동적으로 열어야만 잠금 해제를 알 수 있는데, 이건 위치 기반 앱의 본질적 자살.
- 바이럴 루프 부재: `docs/product-brief.md:42` V1 기능에 공유/초대/외부 링크 없음. `repository.ts`/`app.ts`에 share-token 엔드포인트, deep link, 친구 초대 코드 같은 구조가 0. SNS는 외부에서 들어오는 링크가 있어야 성장한다.
- 콜드 스타트 문제: 신규 유저가 앱을 열면 자기 동네에 콘텐츠가 0개일 가능성 100%. `repository.ts:1825` `select * from places order by created_at asc`는 글로벌 시드일 뿐이고, "내 동네에 인기 장소 0건일 때의 시드 전략" 문서/구현 없음.
- 리텐션 훅 부재: 데일리 회상 알림, 작년 오늘 카드, 친구 새 글 푸시 — 전부 없음. 앱 진입 동기가 "내가 어디 갔다는 것을 직접 인지하고 자발적으로 켜기"에만 의존.
- 타깃 명확도: `docs/product-brief.md:14` "개인/친구/팬덤" 셋 다 동등하게 거론됨. 출시 단계는 **하나의 첨예한 페르소나**가 필요. 지금처럼 셋을 동시에 만족시키려는 기획은 V1을 무겁게 만든다.

### 인기 SNS 되려면 추가/수정
1. **푸시 알림 인프라** (Expo Push + 백엔드 큐) — 근처 도달, 친구 새 글, 1년 전 오늘.
2. **공유 링크/딥링크**: `/p/<postId>`, `/u/<handle>`, `/place/<key>`. 외부에서 들어와도 잠금 프리뷰까지 보여 다운로드 동기 형성.
3. **콜드 스타트 큐레이션**: 도시별 "오늘의 장소", 유명 랜드마크 시드 콘텐츠.
4. **Recall 화면 실 구현** — 디자인만 있고 화면 없음.
5. **"작년 오늘 그 자리" 회상 푸시** — 위치 기반 SNS만 가능한 차별화 훅.
6. **초대 코드 / 친구 가져오기** (연락처 기반 추천 — privacy 정책 동반).
7. 페르소나 V1을 "내 동네 친구 5–20명과 같은 카페에서 추억 공유"로 축소, 팬덤/크리에이터 보드는 V2로 명시 분리.

---

## 2. 디자인 (Visual)

**현재 상태:** 토큰과 컨셉(아날로그 필름)은 잘 정리되어 있으나 **일관성을 강제하는 컴포넌트 시스템이 없어 화면마다 결이 흩어진다.**

### 출시 수준 대비 부족
- `src/theme/tokens.ts:1-56` — 컬러/그라디언트/스페이싱/폰트 토큰만 존재. `typography` 토큰(사이즈/라인하이트/웨이트), `shadow`, `motion`(duration/easing), `border` 토큰 부재. 결국 각 스크린이 `fontSize: 14`, `fontSize: 16` 같은 매직 넘버를 직접 박는다 (예: `HomeScreen.tsx`, `ProfileScreen.tsx` 다수).
- `tokens.ts:54-56` `fonts: { display: 'Avenir Next', body: 'Avenir Next' }` — **iOS-only 시스템 폰트**. Android/Web에서는 fallback되어 디자인 톤 깨짐. `expo-font`로 커스텀 폰트 임베드 안 되어 있음(package.json `expo-font` 미존재).
- 아날로그 필름 컨셉 강도: `docs/design-prototype.md:41` 가 "필름 네거티브 프레임, 종이 라벨, 라이트 리크, 날짜 번인, 컨택트시트"를 선언했으나, `tokens.ts`에 grain/noise 텍스처 자산도 없고 `assets/` 디렉토리에 필름 프레임 SVG가 없다. `reports/260424-003-stronger-analog-film-direction/` 보드는 SVG로만 존재, 코드에 미반영.
- 다크 모드 외 라이트 모드 / 컬러 대비 검증 없음 — `colors.muted: rgba(245,247,242,0.68)` 위 어두운 배경은 OK지만 `setlogBg: #FFF8EF` 위 `setlogMuted: #746B62`(WCAG AA 통과 4.5:1 미검증).
- 디자인 컴포넌트 라이브러리 없음 — `src/components/`에 `BottomTabs/MediaRenderer/StatusPill` 3개뿐. Button, Card, Avatar, FilmFrame, GrainOverlay 같은 재사용 컴포넌트 0. 화면들이 각자 `Pressable + StyleSheet`를 손으로 짠다 → 시각적 표준이 강제되지 않음.
- 아이콘: `lucide-react-native@1.9.0` 사용 — 깔끔하긴 하나 **필름/추억 컨셉**과 톤 부조화. 커스텀 아이콘 셋이 없음.
- 스플래시/아이콘: `app.json:11-13` `./assets/splash-icon.png` 단일 — **대비/세이프존 가이드라인 검증 없음**.

### 인기 SNS 되려면
1. `tokens.ts`에 `typography`, `motion`, `elevation`, `border` 추가.
2. 커스텀 폰트 1세리프(필름 라벨용) + 1산세리프(본문용) `expo-font`로 임베드.
3. `<FilmFrame>`, `<Grain>`, `<DateBurnIn>`, `<ContactSheet>` 4개 컴포넌트로 컨셉을 코드화.
4. 디자인 시스템 스토리북(또는 `/v1/design` route)에서 모든 컴포넌트 한 화면에 모아 회귀 검증.
5. 라이트 모드/접근성 대비 자동 체크 (color-contrast lint).
6. 앱 아이콘/스플래시 iOS/Android/web favicon 풀 세트.

---

## 3. UI/UX

**현재 상태:** 9개 화면이 동작하지만, **상태 머신이 `App.tsx` 한 파일 849줄에 압축**되어 있고, 정작 핵심 UX(잠금 해제 애니메이션, 빈 상태, 에러 상태)는 미완.

### 출시 수준 대비 부족
- `App.tsx:1-849` 단일 파일에 모든 글로벌 상태(stage, session, posts, places, notifications, search, location…)와 fetch가 섞여 있음. **네비게이션 라이브러리(React Navigation/Expo Router) 없음** → URL 기반 라우팅이 `getPrototypeParams()` 쿼리스트링 파싱으로 임시 대체 (`App.tsx:49-80`). 백 버튼/딥링크/모달 스택이 native에서 깨짐.
- `package.json:24-44` 의존성에 `@react-navigation/*`, `expo-router`, `@react-native-async-storage/async-storage`, `expo-secure-store` 전부 없음. 즉 **로그인 토큰을 native에서 영속화하지 않는다.** `App.tsx:178` `window.localStorage.getItem(SESSION_STORAGE_KEY)` — 웹 한정. iOS/Android 네이티브에서는 앱 종료 시 세션이 날아간다. → "친구 테스트는 웹"이라 가려져 있는 핵심 결함.
- 온보딩 흐름: `WelcomeScreen.tsx`(372줄) → `AuthScreen.tsx`(335줄) → `PermissionsScreen.tsx`(260줄) → `TutorialScreen.tsx`(203줄). Auth는 이메일+패스워드만 (`AuthScreen.tsx`에 Google/Apple 버튼 없음, `grep` 결과 0). `docs/product-brief.md:45-46` 약속한 Google/Apple 로그인 미구현.
- 캡처 플로우: `CaptureScreen.tsx:100` `input.accept = 'image/*,video/*'` — **웹은 input 파일 업로드, 네이티브는 expo-image-picker** 분기. native 카메라 캡처 UX는 `Platform.OS === 'web'` 분기(`CaptureScreen.tsx:143,196,223`)가 갈리는데 native 측 실제 카메라 프리뷰 컴포넌트는 없음 → 캡처는 시스템 picker 호출만 함. 컨셉 핵심인 "현장에서 찍어 잠금 해제 토큰 발급" 의 시각적 임팩트가 0.
- 위치 정확도 UI 표면 없음 — `services/location.ts`는 `accuracyMeters` 반환하지만 화면에 "GPS 정확도 50m 이하 필요" 진행 인디케이터 없음. 사용자는 왜 업로드가 거부되는지 알지 못함.
- 빈 상태/에러 상태: `repository.ts`는 `RepositoryError` 코드 12종을 던지지만, UI 측에는 `i18n` 메시지 fallback만 있고 **재시도/네트워크 끊김 화면**, **권한 거부 후 회복 화면** 미구현. `App.tsx`에 `try/catch` 있지만 토스트/상태 UI는 빈약.
- 오프라인 처리 0. 비행기 모드 → 흰 화면.
- 햅틱(`expo-haptics`)은 의존성에 있으나 핵심 모먼트(잠금 해제, 체크인 성공)에 적용 흔적 없음(`grep -r expo-haptics src` 거의 없음 — 직접 검증 필요).
- 접근성: `accessibilityLabel`, `accessibilityRole` 사용 거의 없음 (코드 grep 시 0~소수). 스크린리더 사용자 0 명 가정.
- 키보드 회피, 안전영역 처리는 `react-native-safe-area-context` 사용 중이나 `KeyboardAvoidingView` 부재.

### 인기 SNS 되려면
1. **React Navigation(또는 Expo Router) 도입** + 네이티브 딥링크 (`happened://post/:id`).
2. **네이티브 세션 영속화** (`expo-secure-store`).
3. **Google / Apple 로그인** (`expo-auth-session`, `expo-apple-authentication`).
4. **현장 카메라 풀스크린 캡처** (`expo-camera`) + 잠금 해제 애니메이션 (`react-native-reanimated`).
5. **Pull-to-refresh, infinite scroll, optimistic UI** (현재 피드 fetch는 단발성).
6. **오프라인 캐시** (`@tanstack/react-query` + AsyncStorage persistor).
7. **에러/빈/로딩 상태 컴포넌트 표준화** (`<ScreenState />`).
8. 햅틱: 잠금 해제, 체크인 성공, 좋아요에 `expo-haptics` 명시 호출.
9. 접근성 라벨 일괄 추가 + Dynamic Type.

---

## 4. 백엔드 (server/)

**현재 상태:** Fastify + Postgres + zod 로 구조는 깔끔하지만 **운영 SNS 백엔드의 기본 위생(인증/레이트리밋/페이지네이션/모더레이션) 거의 다 빠져 있다.**

### 출시 수준 대비 부족
- **인증**: `server/repository.ts:90-101` scrypt(N=기본값) + 16바이트 salt 자체는 OK, 하지만:
  - 세션은 단순 랜덤 토큰을 DB의 `sessions` 테이블에 저장(`migrations/001_initial.sql:11`). **만료 외 회전(rotation), 디바이스 식별, 로그아웃 시 invalidate 엔드포인트 없음** (`app.ts`에 `POST /v1/auth/logout` 없음).
  - **이메일 인증, 비밀번호 재설정, 2FA 모두 없음.** `docs/local-vs-production.md:43` "Add production auth hardening, rate limits, email verification, and password reset"으로 자인된 미구현 항목.
  - `DEV_TEST_ACCOUNT`(`repository.ts:104-111`) 비밀번호 `happened-test-1` 이 **프로덕션 코드 경로에 하드코딩**되어 자동 시딩됨 (`repository.ts:337`, `1449`). 출시 전 환경 분기 필수.
- **레이트리밋 / 보안 헤더 0**: `app.ts:1` `@fastify/cors`만 등록. `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/csrf-protection` 미설치 (package.json 확인). 가입/로그인 brute force 방어 0. CORS는 `API_CORS_ORIGIN=*`(`.env.example:3`)이 default.
- **권한·블록 강제 누락 가능성**: `app.ts:259` `POST /v1/users/:handle/block` 토글만 있고, 피드/댓글/검색에서 `user_blocks`를 조인 필터로 강제하는지는 `repository.ts`의 `select * from memory_posts order by created_at desc`(`repository.ts:1846`) 같은 단순 쿼리에 안 보임 → block 우회 가능성 점검 필요.
- **페이지네이션 없음**: `repository.ts:1807, 1846` 피드/검색 모두 `select *` 후 `order by created_at desc` 단일 쿼리, `LIMIT/OFFSET/cursor` 미사용. 사용자가 1000명, 글이 10만이 되면 무너진다.
- **모더레이션 도구 0**: 신고(`post_actions.action='report'`)가 DB에 쌓이지만 운영자용 admin 엔드포인트/대시보드 없음.
- **Body 바디 한도**: `app.ts:56` `Math.max(80MB, mediaMaxBytes*10)` = 최소 80MB. 비디오 포함 데이터 URL 직접 POST → CPU/메모리 폭주 위험. **multipart/form-data + 스트리밍 업로드** 없이 base64 dataURL을 JSON으로 받음 → 33% 오버헤드.
- **로깅/관측**: `config.logRequests` off가 default (`config.ts:68`), 외부 APM/로그 수집 없음. 트레이싱 0.
- **헬스체크**: `app.ts:96` `/health`만 있음. `/ready`, 메트릭(`/metrics` Prometheus) 없음.
- **인덱싱 미흡**: `migrations/001_initial.sql:86-89`에 mode/place_name/sessions/check_in_tokens user_id 인덱스만. `memory_posts.user_id`, `memory_posts.created_at`, `memory_posts.place_id` 인덱스 없음.
- **트랜잭션 경계 부재**: 게시물 작성 → 미디어 저장 → DB 삽입 흐름(`app.ts:319-338`)에서 **DB 실패 시 디스크의 미디어 파일이 고아가 됨** (롤백/cleanup 없음).
- **테스트 0**: `find -name "*.test.*"` 결과 0. CI 0. 회귀 검증 수단 없음.

### 인기 SNS 되려면
1. `@fastify/rate-limit`, `@fastify/helmet`, IP+사용자별 throttling.
2. 세션 회전 + `/v1/auth/logout` + 디바이스 목록.
3. 이메일 인증/패스워드 리셋(transactional email — Resend/Postmark).
4. **커서 기반 페이지네이션** (`createdAt + id` 복합 커서).
5. **multipart 업로드 + presigned URL**(미디어가 S3/R2로 가면 자동), 데이터 URL 단일 POST 폐기.
6. **블록·신고 강제 미들웨어** + 운영자 admin 엔드포인트.
7. 트랜잭션 + 미디어 cleanup queue.
8. 인덱스 추가, slow query 로깅, OpenTelemetry.
9. 통합/계약 테스트(`vitest` + `supertest`).

---

## 5. 프론트엔드 (App.tsx, src/)

**현재 상태:** 단일 거대 컨테이너 컴포넌트 + fetch가 직접 상태에 들어가는 구조. 로컬 데모는 OK, 출시는 아님.

### 출시 수준 대비 부족
- `App.tsx`가 849줄로 11개 화면의 코디네이터/데이터레이어/네비게이션을 겸함. 상태 라이브러리(redux/zustand/jotai) 없음. 서버 캐시 라이브러리(react-query/swr) 없음 → **캐싱·중복 요청 제거·재시도·만료 정책 0**. 모든 화면 진입 시 fetch 새로 발생.
- 네비게이션 미존재: 위 3절. `App.tsx:49-80` 쿼리스트링 라우팅은 web 디버깅용에 가까움.
- 타입 안전성: `tsconfig.json`이 `expo/tsconfig.base + strict: true`. 좋음. 그러나 `npm run typecheck`가 CI로 강제되지 않음(`.github/` 없음). PR 게이트 0.
- 에러 바운더리 없음: `grep -r ErrorBoundary src App.tsx` 0. 하나의 throw가 전체 앱을 흰 화면으로 만듦.
- 로깅: `console.*` 호출이 0건(검사 결과)인데 이는 **에러 진단 수단이 사실상 없다**는 뜻이기도 함. Sentry/Bugsnag 미설치.
- 환경변수: `EXPO_PUBLIC_HAPPENED_API_URL`(`happenedApi.ts:68`) 안 잡으면 native에서는 `null`을 반환(`getApiBaseUrl`). 즉 native 빌드에서 API 베이스가 비면 조용히 실패. 명시적 에러 toast 없음.
- 미디어 렌더: `MediaRenderer.tsx:22-44` 비디오는 web에서만 동작하고 native에서는 "Video preview is available on web." placeholder. 네이티브 비디오 재생 미구현 (`expo-av`/`expo-video` 미설치). 출시 앱이 비디오를 못 재생함.
- 지도: `MapScreen.tsx:114` 직접 OSM 타일 URL을 `<Image>`로 다운로드. **OSM tile usage policy 위반 가능성**(헤비 트래픽 시 차단), 줌 한도, 클러스터링, 핀 인터랙션, 사용자 GPS 따라오기, 오프라인 캐시 전무. native에서 `react-native-maps` 미사용.
- i18n: `src/i18n/index.tsx` 존재. ko/en 가정 — 검증 필요. 날짜/숫자 로컬라이즈는 `Intl` 직접 호출.
- 성능: `FlatList` 사용은 OK, 그러나 `getItemLayout`, `windowSize`, `removeClippedSubviews` 튜닝 코드 없음. 미디어 프리로드/이미지 크기 최적화 없음.
- 보안: web에서 세션 토큰을 `localStorage`(`App.tsx:194-196`)에 평문 저장 — XSS 1회면 즉시 계정 탈취. CSP 헤더 없음.

### 인기 SNS 되려면
1. **상태/서버 캐시**: `zustand` + `@tanstack/react-query` (오프라인 persist).
2. 화면 단위로 컴포넌트 분리(폴더 구조 개편), `App.tsx`는 200줄 미만으로.
3. **에러 바운더리 + Sentry** + 사용자 친화 에러 화면.
4. **네이티브 비디오 재생**(`expo-video`), HLS 지원 시 라이브 가능.
5. **react-native-maps** 또는 MapLibre + 자체 타일 캐싱(또는 라이선스 있는 타일 공급자).
6. 토큰 — native: SecureStore, web: HttpOnly cookie 기반 세션.
7. CI: `typecheck + lint + test` PR 게이트.

---

## 6. DB / 데이터 모델

**현재 상태:** Postgres + 단순 lat/lng + JSONB. **PostGIS 없이** 위치 기반 SNS를 운영 중.

### 출시 수준 대비 부족
- `migrations/001_initial.sql:23-24` `lat double precision, lng double precision`. **`geography(Point,4326)` 컬럼 + GIST 인덱스 없음.** "근처 200m 안의 글" 같은 쿼리는 현재 in-memory haversine 계산(`repository.ts:311-322`)으로 처리되며 → DB가 아닌 앱 메모리에서 풀스캔. 글 1만 개부터 무너진다.
- **반경 쿼리 SQL이 아예 없음.** `grep ST_` 결과 0. 모든 거리 필터가 코드 레벨에서 일어남.
- `places.map_x/map_y/intensity`(`001_initial.sql:25-27`)는 디자인 시드용으로 보임 — 운영에서 의미 모호. 정규화 부족.
- `memory_posts.media_colors`, `stats`(`001_initial.sql:51,54`) JSONB로 통계 저장 — 추후 집계 쿼리/인덱스 어려움. 카운트는 별도 컬럼 또는 materialized view가 표준.
- `memory_posts.distance_meters`(`001_initial.sql:43`) — **저장 시점의 거리**가 컬럼으로 박혀 있음. 사용자가 다른 위치에서 보면 무의미. 이 값은 클라이언트에서 viewer 위치와 place로 계산해야 함.
- `places` 좌표가 글로벌 unique(예: 같은 카페 다른 지점)인지 보장 안 됨. `places.id`가 text PK인데 외부 place provider(Google Places, OSM Nominatim) 매핑 컬럼 없음 → 같은 장소 중복 생성 가능.
- `migrations/001_initial.sql:34` `memory_posts.user_id ... on delete set null` → 사용자가 탈퇴해도 글이 author_name 텍스트로 남음. GDPR/한국 개인정보보호법상 **삭제 요청 시 콘텐츠 처리 정책** 미정의.
- `migrations/007` 까지 7개 마이그레이션이 단방향. **down/rollback 없음.**
- `migrations/006` 의 `bio` 컬럼 default `''` not null — 좋음. 그러나 새 컬럼이 늘 `default + alter`로만 들어가는지 정책 명시 없음.
- 인덱스 부족(4절 참조).
- **백업/복구 런북 없음.** `docs/local-vs-production.md:42` 에서 자인됨.
- 미디어: 로컬 파일시스템(`server/media.ts:120`) — 파일 1개당 최대 40MB(`.env.example:12` 기본). CDN/객체스토리지 마이그레이션 미실행. media url이 DB에 절대/상대 혼재 (`happenedApi.ts:78` `absolutizeMediaUrl`로 보정).
- `check_in_tokens`(`001_initial.sql:58`) — 12시간 만료, 사용 횟수 카운트만. **위치 검증 결과/실측 좌표/디바이스 핑거프린트** 같은 위변조 검출 컬럼 0. 위치 위조 클라이언트가 무한히 토큰 발급 가능.

### 인기 SNS 되려면
1. **PostGIS + GIST 인덱스**: `places.geog geography(Point,4326)`, `memory_posts.geog`. `ST_DWithin` 기반 반경 쿼리.
2. 외부 place provider 매핑(`places.osm_id`, `places.google_place_id`).
3. 마이그레이션 도구 표준화(`drizzle-kit` / `node-pg-migrate`) + rollback.
4. **객체 스토리지 + CDN** (R2/S3 + CloudFront). presigned upload.
5. 백업: WAL + 일일 logical dump, 미디어 cross-region replication.
6. 카운터는 별도 테이블(`post_stats` materialized) 또는 pg-listen 트리거.
7. 계정 삭제 워크플로 (cascade 정책 + 비식별화 + 미디어 만료).
8. check-in 위변조 방지: 서버측 위치 재검증, accuracy 보증, 토큰 1회성.

---

## 부록 A. dev=prod parity, 테스트, CI/CD, 시크릿, 의존성

| 항목 | 상태 | 근거 |
|---|---|---|
| `docker-compose.dev.yml` | ⚠️ Postgres 1대만. API, 미디어 스토리지(S3 모킹), 푸시, 메일 부재 | `docker-compose.dev.yml:1-20` (postgres 단일 서비스). API는 host node에서 `tsx`로 실행. |
| dev=prod 동일 경험 | ❌ | `docs/local-vs-production.md:14-22` 본문이 **6개 항목을 "Local Substitutes"로 명시 자인** (호스팅, DB 호스팅, 미디어, 맵, 위치 완화, 알림). dev에서 푸시/객체스토리지/관리DB 시뮬레이션 없음. |
| 테스트 커버리지 | ❌ 0% | `find . -name '*.test.*' -o -name '*.spec.*'` 결과 0. `package.json`에 `test` 스크립트 자체 없음. |
| CI/CD | ❌ 없음 | `.github/` 디렉토리 없음. EAS Build/Submit 설정 없음(`eas.json` 미존재). 배포는 Mac mini 수동. |
| `.env.example` | ⚠️ 기본만 | `.env.example:1-14` 14줄. `JWT_SECRET`, `SESSION_SECRET`, OAuth 클라이언트 ID, Sentry DSN, 이메일 SMTP, Push 키 0. 출시 시 시크릿 매트릭스 부족. `.env`는 `.gitignore` 확인 필요. |
| `.gitignore` | OK 추정 | `.env`/`.local`/`node_modules` 포함 추정 — 빠른 확인 권장. |
| 의존성 최신성 | ❌ Expo SDK 54 vs latest 55 | `npm outdated`: `expo 54.0.33→55.0.17`, `expo-* 15.x→55.x`(여러 개), `react 19.1→19.2`, `react-native 0.81→0.85`. **Expo SDK 한 메이저 뒤짐.** |
| 보안 audit | ⚠️ moderate 11건 | `npm audit`: moderate 11, high 0, critical 0. transitive deps. |
| 라이선스/약관 | ❌ | `docs/`에 privacy policy, ToS 없음. 위치/미디어 처리 SNS는 이게 필수. |

---

## 출시까지 우선순위 TOP 10 액션 아이템

1. **네비게이션 + 세션 영속화 + Google/Apple 로그인** 도입 — React Navigation, expo-secure-store, expo-auth-session, expo-apple-authentication. (App.tsx 분해 시작점.)
2. **푸시 알림 인프라(Expo Push) + 서버측 디스패처** — "근처 도달", "친구 새 글", "1년 전 오늘". 위치 SNS의 핵심 리텐션 훅.
3. **PostGIS 도입 + `ST_DWithin` 기반 반경 피드/검색** + 인덱스. 현재 in-memory haversine 폐기.
4. **객체 스토리지(S3/R2) + CDN + presigned multipart 업로드** — 데이터 URL JSON POST 제거, 미디어 cleanup queue 포함.
5. **백엔드 위생: rate-limit, helmet, 페이지네이션(cursor), 트랜잭션, 블록 강제 미들웨어, /logout, 이메일 인증/패스워드 리셋.**
6. **Sentry + 에러 바운더리 + 구조화 로깅(Pino)** — 운영 가시성 0 → 안전한 출시 불가.
7. **react-query + zustand**로 데이터 레이어 표준화 + 오프라인 캐시 + optimistic UI + 풀투리프레시.
8. **공유 링크/딥링크(`happened://`, `https://happened.app/p/:id`)** + 잠금 프리뷰 + 콜드 스타트 큐레이션 데이터 — 바이럴 루프 점화.
9. **Recall 화면 + "작년 오늘 그 자리" 회상 카드** 실 구현 — 제품 약속의 마지막 30%.
10. **CI 파이프라인(GitHub Actions): typecheck + lint + test + EAS preview build** + `.env.example` 시크릿 매트릭스 완비 + `eas.json` 작성, 앱스토어 메타데이터(Privacy Manifest, ATT, Android Data Safety) 준비.

---

## 결론

> **출시 가능한가? No.** 컨셉의 진심과 서버 구조의 청결도는 인상적이지만, **푸시·딥링크·반경 SQL·세션 영속화·관측·테스트·CI** 가 모두 비어 있고, "다시 가면 열린다"의 두 번째 약속(재방문 회상)이 코드에 0줄 존재한다. 지금 형태는 *친구 10명용 라이브 데모로는 통과*, *공개 SNS로는 미달*. TOP 10을 마치면 베타 가능, 인기 SNS 진입은 그 다음 분기 작업이다.
