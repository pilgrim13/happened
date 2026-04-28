---
feature_id: 2026-04-28-location-permission-retry
status: approved
spec_version: 2
owner: planner
base_branch: main
work_branch: ai/location-permission-retry
created_at: 2026-04-28
revised_at: 2026-04-28
---

## Goal

위치 권한을 거부한 사용자가 "재시도" 버튼으로 OS 다이얼로그 재표시 또는 설정 앱 이동까지 명확하게 안내받아, "버튼이 안 먹힌다"는 경험을 제거한다.

---

## Non-goals

- 카메라·사진·알림 권한 UX 변경 없음
- 위치 권한 종류 변경 없음 (foreground only 유지)
- 백그라운드 위치 권한 요청 없음
- PermissionsScreen 디자인·레이아웃 재설계 없음 (기존 컴포넌트 구조 유지)
- 다국어(i18n) 키 추가 이외의 i18n 리팩토링 없음
- Android `RATIONALE` 다이얼로그 커스텀 없음 (OS 기본 다이얼로그 의존)
- CI/CD·GitHub Actions 추가 없음
- **웹 플랫폼 `getBrowserLocation()` 권한 오류 처리는 이번 작업에 포함** (geolocation error code 1 한정, §C2 참조)
- iOS precise vs approximate 위치 정밀도 처리 없음

---

## Open Questions에 대한 Planner 답변

### Q1. `canAskAgain=false`일 때 시스템 설정 이동 vs 인앱 모달?

**결정: 시스템 설정으로 직접 이동 (`Linking.openSettings()`)**

인앱 모달을 추가해도 결국 사용자는 설정 앱으로 가야 한다 — 중간 단계만 늘어난다.
버튼 텍스트를 "설정에서 허용하기"로 바꾸고 서브카피에 "설정 앱에서 위치 권한을 허용해주세요"를 인라인으로 표시. 별도 모달/오버레이 불필요.

### Q2. iOS / Android `canAskAgain` 분기 처리

**결정: `canAskAgain` 플래그만으로 분기 — `Platform.OS` 하드코딩 불필요**

| 상황 | 동작 |
|------|------|
| `canAskAgain=true` | `requestForegroundPermissionsAsync()` 재호출 → OS 다이얼로그 표시 |
| `canAskAgain=false` | `Linking.openSettings()` 호출 |

- iOS: 첫 거부 즉시 `canAskAgain=false`
- Android: 첫 거부는 `canAskAgain=true`(다이얼로그 한 번 더), 두 번째 거부부터 `canAskAgain=false`
- expo-location이 플랫폼 차이를 `canAskAgain`으로 이미 추상화하므로 `Platform.OS` 분기 코드 불필요

### Q3. `services/location.ts`의 throw 방식과 캡처 플로우 처리

**결정: `getCurrentLocation()`은 권한을 요청하지 않고 조회만 한다**

현재 `getCurrentLocation()`이 `requestForegroundPermissionsAsync()`를 호출하는 것은 잘못된 책임 분리다.
캡처 타이밍에 권한 다이얼로그가 뜨는 것은 UX상 이상하고, 이미 거부된 상태에선 효과도 없다.

변경:
- `location.ts`: `requestForegroundPermissionsAsync()` → `getForegroundPermissionsAsync()` (조회만)
- 거부 시 `code: 'PERMISSION_DENIED'` 프로퍼티를 가진 커스텀 Error를 throw
  - `class LocationPermissionError extends Error { code = 'PERMISSION_DENIED' }`
  - **정의 위치**: `src/services/location.ts` 내부에서 `export` — 별도 파일 추가 없음
  - **import 경로**: `useCaptureFlow.ts`에서 `import { LocationPermissionError } from '@/services/location'` (또는 프로젝트 alias 규칙에 따름)
- 웹 경로: `getBrowserLocation()`에서 Geolocation API 에러 `code === 1` (PERMISSION_DENIED)인 경우 동일하게 `LocationPermissionError`를 throw
- `useCaptureFlow.upload()`: `catch` 블록에서 `instanceof LocationPermissionError` 확인 → 권한 안내 공지 표시
- `useCaptureFlow.locateMe()`: 동일 패턴 — `instanceof LocationPermissionError` 확인 → 설정 이동 안내 공지 표시 (설정 이동은 `showNotice`의 action 콜백으로 `Linking.openSettings()` 연결)

### Q4. 화면 재진입/포그라운드 복귀 시 권한 상태 재조회 트리거

**결정: `PermissionsScreen`에서 `useFocusEffect` + `getForegroundPermissionsAsync()`**

- `useFocusEffect` (from `@react-navigation/native`, 이미 설치됨) 내에서 `Location.getForegroundPermissionsAsync()` 호출
- 결과로 `granted.location`과 `locationCanAskAgain` 상태를 동기화
- 사용자가 설정 앱에서 권한을 허용하고 돌아오면 버튼이 "허용됨" 상태로 자동 반영

---

## State 변수 명세 (PermissionsScreen)

`canAskAgain`은 위치 전용 플래그다. 기존 `granted: Record<PermissionId, boolean>`에 통합하지 않고 별도 state로 관리한다.

```ts
// PermissionsScreen.tsx에 추가
const [locationCanAskAgain, setLocationCanAskAgain] = useState<boolean>(true)
```

- **초기값**: `true` (앱 첫 진입 시 아직 거부된 적 없으므로 재요청 가능 가정)
- **갱신 시점**: `useFocusEffect` 내 `getForegroundPermissionsAsync()` 응답에서 `canAskAgain` 값으로 `setLocationCanAskAgain` 호출
- **사용 위치**: 버튼 텍스트 분기 (`locationCanAskAgain ? "재시도" 계열 : "설정에서 허용하기"`) 및 서브카피 분기

---

## User-visible Acceptance Criteria

- **AC1 — 최초 거부 후 재시도 (iOS)**
  iOS에서 위치 권한을 첫 번째 거부한 뒤 "재시도" 버튼을 누르면:
  버튼 텍스트가 "설정에서 허용하기" 형태로 변경되어 있고, 누르면 iOS 설정 앱이 열린다.

- **AC2 — 최초 거부 후 재시도 (Android, 두 번째 다이얼로그 가능)**
  Android에서 위치 권한을 첫 번째 거부한 뒤 "재시도" 버튼을 누르면:
  OS 권한 다이얼로그가 다시 표시된다. (Android `canAskAgain=true` 상태)

- **AC3 — 두 번째 거부 후 (Android)**
  Android에서 두 번 거부 후 "재시도" 버튼을 누르면:
  OS 설정 앱이 열린다. (canAskAgain=false)

- **AC4 — 설정에서 권한 허용 후 앱 복귀**
  설정 앱에서 위치 권한을 허용하고 앱으로 돌아오면:
  별도 버튼 탭 없이, 앱 포어그라운드 복귀 후 2초 이내에 PermissionsScreen의 위치 카드가 "허용됨" 상태(체크 아이콘, 민트 배경)로 업데이트된다.

- **AC5 — 캡처 플로우에서 권한 없음**
  위치 권한 없는 상태에서 메모 작성 시도 시:
  "위치 권한이 필요합니다" 공지가 표시되고 캡처 자체는 차단된다 (현재와 동일). 권한 요청 다이얼로그가 캡처 타이밍에 뜨지 않는다.

- **AC6 — 거부 상태 서브카피 안내 (canAskAgain=false)**
  `canAskAgain=false`인 경우, 위치 카드 서브카피가 "설정 앱에서 위치 권한을 허용해주세요" (또는 동등한 i18n 문자열)로 표시된다.

- **AC7 — 앱 재시작 후 거부 상태 반영**
  위치 권한을 거부한 채 앱을 종료하고 재시작해 PermissionsScreen에 진입하면:
  거부 상태가 올바르게 표시된다 (in-memory 초기값이 아닌 OS 실제 상태 기준).

- **AC8 — locateMe() 권한 없음 공지**
  위치 권한 없는 상태에서 `locateMe()` 실행 시:
  "위치 권한이 필요합니다" 계열 공지가 표시된다 (generic "위치를 가져올 수 없음" 메시지 금지).

---

## Technical Acceptance Criteria

- TypeScript 타입 체크 통과 (`npx tsc --noEmit`) — merge gate 필수
- ESLint 통과 — merge gate 필수
- `expo-doctor` 통과 — merge gate 필수
- `LocationPermissionError` 클래스는 `Error`를 상속하고 `code = 'PERMISSION_DENIED'` 프로퍼티를 가짐
- `getCurrentLocation()`의 반환 타입·인터페이스 변경 없음 (`Promise<UserLocation>` 유지)
- `useCaptureFlow`의 `upload` / `locateMe` 반환 타입 변경 없음

> **참고**: 클라이언트에 Jest 미설치 (`package.json`에 test 스크립트 없음, `src/` 하위 `.test.*` 없음). `npm test`는 merge gate에서 제외. 자동 테스트는 Phase 2(Test Engineer 도입 후)로 deferred.

### 변경 허용 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/screens/PermissionsScreen.tsx` | `locationCanAskAgain` state 추가, `useFocusEffect` 추가, `Linking.openSettings()` 호출, 버튼 텍스트 분기, 서브카피 분기 |
| `src/services/location.ts` | `requestForegroundPermissionsAsync` → `getForegroundPermissionsAsync`, `LocationPermissionError` 정의(export) 및 throw, `getBrowserLocation()` PERMISSION_DENIED(code 1) 분기 추가 |
| `src/hooks/useCaptureFlow.ts` | `LocationPermissionError` 감지 후 `upload()` 및 `locateMe()` catch에서 권한 안내 공지 처리 |
| `src/i18n/index.tsx` | 신규 i18n 키 추가 (`permissions.openSettings`, `permissions.locationBlockedCopy`, `permissions.locationDeniedCanRetry`, `capture.locationPermissionRequired` 등) |

### 변경 금지 파일

- `package.json` — 새 패키지 설치 금지
- `app.json` / `eas.json` / `app.config.ts` — native config 변경 금지
- `.github/workflows/` — CI 파일 추가 금지
- `src/theme/tokens.ts` — 디자인 토큰 변경 금지
- `src/types/happened.ts` — `UserLocation` 타입 변경 금지
- `src/types/` 디렉토리 — 신규 파일 추가 금지 (`LocationPermissionError`는 `location.ts`에 정의)

---

## Edge Cases

| 케이스 | 기대 동작 |
|--------|-----------|
| `canAskAgain=false` + 버튼 탭 | `Linking.openSettings()` 호출, 앱 이탈 |
| `canAskAgain=true` + 버튼 탭 | `requestForegroundPermissionsAsync()` 재호출 → 다이얼로그 표시 |
| **`canAskAgain=true` + 거부 상태 (Android 첫 거부)** | 버튼 텍스트: "재시도" 계열. 서브카피: "위치 권한이 거부되었습니다" 계열 (`permissions.locationDeniedCanRetry`). "설정에서 허용하기" 버튼/설정 이동 안내 표시 안 함. |
| 설정 앱 이동 후 권한 허용 + 복귀 | `useFocusEffect` 재실행 → `granted.location=true`, `locationCanAskAgain` 재설정 |
| 설정 앱 이동 후 권한 미변경 + 복귀 | 거부 상태 유지, 버튼 텍스트 변경 없음 |
| iOS precise vs approximate | foreground 권한만 다루므로 해당 없음 (Non-goal) |
| 위치 서비스 자체 OFF (iOS 설정) | `getForegroundPermissionsAsync()` → `status='denied'`로 처리됨. 동일 경로 |
| 캡처 중 권한 없음 (`upload()`) | `LocationPermissionError` throw → `useCaptureFlow.upload()` catch → 권한 안내 공지 표시, 업로드 차단 |
| `locateMe()` 중 권한 없음 | `LocationPermissionError` throw → `useCaptureFlow.locateMe()` catch → 설정 이동 안내 공지 표시 |
| 앱 첫 진입 (권한 미요청 상태) | `canAskAgain=true`, 버튼 텍스트 기존 그대로("위치 허용하기" 계열), 누르면 OS 다이얼로그 |
| 앱 재시작 후 PermissionsScreen 재진입 | `useFocusEffect`에서 `getForegroundPermissionsAsync()` 호출 → OS 실제 상태로 초기화 |
| `Linking.openSettings()` 실패 (에뮬레이터 등) | `try-catch`로 감싸고 실패 시 `console.warn` 출력 후 무시. 사용자에게 별도 오류 안내 불필요. **QA 수동 절차에서 이 경로는 실기기에서만 검증** (에뮬레이터에서 버튼 무반응은 허용) |
| 웹: geolocation error code 1 (PERMISSION_DENIED) | `getBrowserLocation()`에서 `LocationPermissionError` throw → `useCaptureFlow` catch 동일 처리 |
| 웹: geolocation error code 2/3 (UNAVAILABLE/TIMEOUT) | generic `Error` throw — `LocationPermissionError` 아님, 기존 처리 유지 |
| 네트워크 없음 | 권한 요청은 네트워크 무관 → 영향 없음 |

---

## Regression Risks

| 리스크 | 영향 범위 | 판단 및 검증 방법 |
|--------|-----------|-----------|
| `getCurrentLocation()`이 더 이상 권한을 요청하지 않음 | `useCaptureFlow.upload()`, `locateMe()`, `captureAtPlace()`, `startPostFromHome()` — 권한 없으면 바로 throw | 수동 QA: 권한 허용 상태에서 메모 작성 정상 동작 확인 |
| `LocationPermissionError` 감지 실패 | `useCaptureFlow` catch가 generic catch로 빠지면 기존 에러 메시지 표시 | 수동 QA: 권한 거부 상태에서 캡처·locateMe 시도 → 권한 안내 공지 확인 |
| `captureAtPlace()` / `startPostFromHome()` silent fail | 두 함수는 `.catch(() => undefined)`로 에러를 삼킨다. `LocationPermissionError`도 동일하게 무시. **의도적 유지**: `lastLocation=null` 상태로 남고 이후 `upload()`에서 새로 위치 요청하므로 실질적 regression 없음 | 의도 문서화로 충분. 별도 QA 불필요. |
| `useFocusEffect` 추가로 매 포커스마다 permission API 호출 | 불필요한 API 호출 증가 | `getForegroundPermissionsAsync()`는 OS 캐시 조회라 성능 영향 미미. 허용됨. |
| `canAskAgain` 상태가 `granted` 상태와 불일치 | 허용된 상태에서도 "설정 이동" 버튼 표시될 수 있음 | 수동 QA: 허용 → 거부 → 허용 순서로 상태 전환 확인 |

---

## Test Plan

### 자동 테스트 — Phase 2로 deferred

클라이언트에 Jest 미설치 (`package.json`에 `test` 스크립트 없음, `src/` 하위 `.test.*` 없음). 자동화 테스트는 **Test Engineer 도입 후(Phase 2)**에 작성한다. 이번 작업(Phase 1)은 수동 QA만으로 검증한다.

> Phase 2 예정 항목 (참고용, 이번 Developer 작업 범위 밖):
> - `location.ts`: `getForegroundPermissionsAsync` mock → `status='granted'`일 때 위치 반환, `status='denied'`일 때 `LocationPermissionError` throw
> - `useCaptureFlow.ts`: `LocationPermissionError` throw 시 권한 관련 공지 호출, generic Error throw 시 일반 에러 처리

### 수동 QA (QA가 실기기에서 실행) — Phase 1 검증 기준

**iOS 실기기 필수**

1. 앱 설치 후 PermissionsScreen 진입 → 위치 권한 "거부" 탭
   - 확인: 서브카피가 "설정 앱에서 위치 권한을 허용해주세요" 계열로 변경됨
   - 확인: 버튼 텍스트가 "설정에서 허용하기" 계열로 변경됨

2. "설정에서 허용하기" 버튼 탭
   - 확인: iOS 설정 앱이 열리고 해당 앱의 위치 권한 항목이 보임
   - 스크린샷 포인트 ①

3. 설정에서 권한 허용 → 앱으로 돌아오기
   - 확인: 앱 포어그라운드 복귀 후 2초 이내에 PermissionsScreen 위치 카드가 "허용됨" 상태로 표시됨 (체크 아이콘, 민트 배경). 버튼 탭 불필요.
   - 스크린샷 포인트 ②

4. 앱 강제 종료 → 재시작 → PermissionsScreen 진입
   - 확인: 허용 상태가 올바르게 반영됨 (in-memory 초기값 false로 시작하지 않음)

5. 위치 권한 거부 상태에서 메모 작성 시도 (캡처 탭 → 업로드)
   - 확인: "위치 권한이 필요합니다" 계열 공지 표시
   - 확인: OS 권한 다이얼로그가 뜨지 않음 (캡처 타이밍에 다이얼로그 금지)
   - 스크린샷 포인트 ③

6. 위치 권한 거부 상태에서 locateMe() 실행 (지도 화면 등)
   - 확인: "위치 권한이 필요합니다" 또는 설정 이동 안내 공지 표시
   - 확인: "위치를 가져올 수 없음" generic 메시지 표시 안 됨

**Android 실기기 (또는 에뮬레이터)**

7. 위치 권한 첫 번째 거부 → "재시도" 버튼 탭
   - 확인: OS 권한 다이얼로그가 다시 표시됨
   - 확인: 서브카피가 "위치 권한이 거부되었습니다" 계열 ("설정에서 허용하기" 안내 아님)

8. 두 번째 거부 → 버튼 탭
   - 확인: 설정 앱으로 이동 (실기기 필수; 에뮬레이터에서 무반응은 허용)

---

## Open Questions

(모두 위에서 답변됨 — 비어있음)
