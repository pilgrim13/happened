---
feature_id: 2026-04-28-location-permission-retry
status: review_done
spec_version_reviewed: 1
owner: critic
created_at: 2026-04-28
---

## Verdict
REQUEST_CHANGES

---

## Critical Issues

### [C1] `locateMe()` catch 블록이 SPEC 범위에서 누락됨

**문제**: `useCaptureFlow.locateMe()`도 `getCurrentLocation()`을 호출한다. `location.ts` 변경 후 권한 없으면 `LocationPermissionError`가 throw된다. 그런데 SPEC §Technical AC / §Test Plan에서 `locateMe()` catch 처리가 전혀 언급되지 않았다.

**왜**: 현재 `locateMe()`의 catch는 `showNotice(t('app.locationUnavailable'))`로 generic 처리한다. 변경 후에는 권한 오류인데 "위치를 가져올 수 없음" 메시지를 보여주게 된다 — 사용자 입장에서 원인을 알 수 없다.

**수정 제안**: `locateMe()` catch에서 `LocationPermissionError` 감지 → 설정 이동 안내 처리를 `upload()`와 동일 패턴으로 명시하거나, 명시적으로 non-goal로 선언하라.

---

### [C2] 웹 플랫폼 `LocationPermissionError` 불일치 미처리

**문제**: `location.ts`에는 `Platform.OS === 'web'`일 때 `getBrowserLocation()`을 실행하는 분기가 있다. SPEC 변경은 네이티브 경로(`getForegroundPermissionsAsync()`)만 다루고 웹 경로는 건드리지 않는다.

**왜**: 변경 후 네이티브는 `LocationPermissionError`를 throw하지만 웹은 generic `Error`를 throw한다. `useCaptureFlow.upload()`에서 `instanceof LocationPermissionError` 체크가 웹에서는 false → 권한 오류인데 `capture.locationRequired` 대신 일반 에러 처리 경로로 빠진다.

**수정 제안**: 웹을 non-goal로 명확히 선언하거나, `getBrowserLocation()`도 `LocationPermissionError`를 throw하도록 SPEC에 포함시켜라.

---

### [C3] `canAskAgain=true` 거부 상태(Android 첫 거부)의 서브카피 미정의

**문제**: AC6은 `canAskAgain=false`일 때 서브카피를 정의한다. 그런데 Android 첫 거부(`canAskAgain=true`, 버튼 텍스트는 "재시도") 상태의 서브카피가 AC에도, Edge Cases 표에도 없다.

**왜**: 현재 코드에서 거부 후 `notes.location`에 `t('permissions.locationDenied')`가 들어간다. 변경 후 `canAskAgain=true`인 거부 상태의 서브카피가 동일한가, 변경되는가, 새 i18n 키를 쓰는가 — Developer가 결정해야 하는 상황이 된다.

**수정 제안**: Edge Cases 표에 `canAskAgain=true + 거부` 행 추가, 이때의 서브카피와 버튼 텍스트를 명시하라.

---

## Major Issues

### [M1] `canAskAgain` 상태 변수 명세 부재

SPEC §변경 허용 파일에 "canAskAgain 상태 관리"라고만 적혀 있다. 현재 `PermissionsScreen`의 상태 구조는 `Record<PermissionId, boolean>`인 `granted`와 `Partial<Record<PermissionId, string>>`인 `notes`다. `canAskAgain`은 위치 전용 플래그인데, state 변수명, 초기값, 타입이 명시되지 않았다. Developer가 `Record<PermissionId, boolean>`에 추가할지 별도 `boolean` state로 만들지 구현이 갈린다.

**수정 제안**: `const [locationCanAskAgain, setLocationCanAskAgain] = useState<boolean>(true)` 수준으로 state 변수 명세를 SPEC에 포함하라.

---

### [M2] `Linking.openSettings()` 실패 시 "아무 것도 안 일어남" — 동일 증상 재발

SPEC §Edge Cases: `Linking.openSettings()` 실패 시 무시. 시뮬레이터에서 사용자가 버튼을 탭해도 아무 반응 없음. 이것은 원래 제거하려던 "버튼이 안 먹힌다" 증상과 동일하다. 에뮬레이터/시뮬레이터에서는 QA가 이 경로를 검증할 방법이 없어진다.

**수정 제안**: 실패 시 최소한 console.warn 이상의 처리를 명시하거나, QA 수동 절차에 "실기기에서만 이 경로 검증" 등 명확한 가이드를 추가하라.

---

### [M3] `captureAtPlace()` / `startPostFromHome()`의 silent fail이 회귀 리스크 표에 없음

두 함수는 현재도 `.catch(() => undefined)`로 에러를 삼킨다. 변경 후에도 동일하게 `LocationPermissionError`를 무시한다. SPEC §Regression Risks 표에는 이 두 함수가 없다. `upload`와 `locateMe`만 언급된다.

**왜 문제**: QA가 이 경로를 테스트할 이유를 모른다. "캡처 탭으로 이동하기 전 위치 갱신"이 조용히 실패해도 `lastLocation`이 null 상태로 남고, 이후 `upload()`에서 새로 위치를 요청하므로 실질적 regression은 없다. 하지만 SPEC이 이 결론에 의식적으로 도달했는지 알 수 없다.

**수정 제안**: Regression Risks 표에 `captureAtPlace` / `startPostFromHome` 행을 추가하고 "silent fail 유지, 영향 없음" 을 명시해 의도를 문서화하라.

---

### [M4] AC4 "즉시" 업데이트 — QA PASS/FAIL 기준 모호

AC4: "앱으로 돌아오면 즉시 허용됨 상태로 자동 업데이트". `useFocusEffect`는 React Navigation의 focus event에 의존한다. OS 앱 전환 후 focus event가 발생하기까지의 지연이 존재한다. "즉시"는 몇 초 이내를 의미하는가 — QA가 판정할 수 없다.

**수정 제안**: "즉시"를 "별도 버튼 탭 없이, 앱 포어그라운드 복귀 후 2초 이내" 또는 "버튼 조작 없이 자동으로" 등 측정 가능한 표현으로 대체하라.

---

## Minor Issues

### [m1] 자동 테스트 환경 존재 여부 미확인

SPEC §Test Plan이 `src/services/location.test.ts`, `src/hooks/useCaptureFlow.test.ts`를 명시한다. 현재 프로젝트에 테스트 러너(Jest 등) 설정이 존재하는지, 기존 테스트 파일이 있는지 SPEC이 검증하지 않았다. `package.json` 변경 금지 제약과 충돌할 가능성 있음 (테스트 러너 미설치 시).

### [m2] `LocationPermissionError` import 경로 미명시

SPEC은 `location.ts`에서 정의한다고 했으나, `useCaptureFlow.ts`에서 어떤 경로로 import하는지 명시 없음. Developer가 `types/` 파일에 넣거나 별도 `errors.ts`로 분리할 수 있다. 변경 허용 파일 표에 `src/types/` 또는 `src/errors/`가 없으므로 추가가 필요한지 불명확.

### [m3] i18n 파일 경로가 `src/i18n/` 으로만 표기 — locale 파일 특정 필요

SPEC §변경 허용 파일: `src/i18n/ (해당 locale 파일)`. 실제 locale 파일 구조(단일 파일 vs 언어별 분리)를 확인하지 않은 상태에서 추가할 키 목록만 나열됐다. Developer가 어느 파일을 수정해야 하는지 경로를 SPEC이 직접 명시해야 한다.

---

## Risk Flags (재확인)

- 위치: **yes** — `useFocusEffect` + `getForegroundPermissionsAsync()` 매 포커스 호출
- 권한: **yes** — `canAskAgain` 분기 로직 신규, `Linking.openSettings()` 호출
- 데이터 모델: **no**
- 마이그레이션: **no**
- 같은 버그 재발: **yes (잠재)** — `locateMe()` catch 미처리 시, 권한 오류인데 generic 메시지 표시 — 원래 증상("버튼이 안 먹힌다")과 다른 형태로 재발 가능

---

## Suggested Tier Adjustment

현재 T3. 권장 T3 유지 — `locateMe()` 누락과 웹 플랫폼 불일치가 Critical이므로 T3의 Spec Critic 검토가 정당하다. 범위 인플레이션은 없음.

---

## Notes for Planner

SPEC v2에 반영할 항목:

- [ ] `locateMe()` catch: `LocationPermissionError` 감지 처리 명시 또는 non-goal 선언
- [ ] 웹 플랫폼 처리 방침 명시 (non-goal 선언 또는 `getBrowserLocation()` 동일 에러 클래스 throw)
- [ ] `canAskAgain=true` + 거부 상태의 서브카피 및 버튼 텍스트 정의 (Edge Cases 표에 추가)
- [ ] `canAskAgain` state 변수 타입 및 초기값 명세
- [ ] `Linking.openSettings()` 실패 시 동작 명확화 (무시 의도적임을 QA 절차에 명시)
- [ ] Regression Risks 표에 `captureAtPlace` / `startPostFromHome` 행 추가 (silent fail 유지 의도 문서화)
- [ ] AC4 "즉시"를 측정 가능한 표현으로 교체
- [ ] 자동 테스트 환경(테스트 러너) 존재 여부 확인 후 SPEC에 명시
- [ ] `LocationPermissionError` import 경로 및 파일 위치 명시 (변경 허용 파일 표 업데이트)
- [ ] i18n locale 파일 정확한 경로 특정
