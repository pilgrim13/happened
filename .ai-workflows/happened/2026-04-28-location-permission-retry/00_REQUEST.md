---
feature_id: 2026-04-28-location-permission-retry
status: requested
owner: riri
created_at: 2026-04-28
base_tier: T2
risk_flags: [location_permission_change]
final_tier: T3
agents_planned: [planner, spec_critic, developer, qa]
---

## Original Request
드라이런 작업 — happened 다중 에이전트 워크플로우 첫 실전 검증.

GPT 검토 + 리리 분석 결과 happened의 권한 거부 UX가 약함. 거부 후 재시도 플로우를 사용자 친화적으로 개선한다.

## Context
- 관련 화면: `src/screens/PermissionsScreen.tsx` (온보딩 권한 화면)
- 관련 서비스: `src/services/location.ts` (런타임 위치 조회)
- 관련 훅: `src/hooks/useCaptureFlow.ts` (메모 작성 플로우에서 위치 사용)
- 사용 라이브러리: `expo-location` (foreground permission)

### 현재 동작 (리리 코드 리딩 결과)
1. `PermissionsScreen.requestPermission('location')`은 단순히 `Location.requestForegroundPermissionsAsync()` 재호출
2. OS가 한 번 거부 후에는 다이얼로그를 다시 안 띄움 (iOS는 특히 첫 거부 후 영구 거부 상태). 사용자 입장에선 "재시도 버튼이 안 먹는다"로 보임
3. `canAskAgain` 플래그 미활용 — expo-location이 제공하는 정보를 안 씀
4. 시스템 설정 앱으로 보내는 딥링크 없음 (iOS: `Linking.openSettings()`)
5. 화면 다시 진입해도 OS 권한 상태 재조회 안 함 (in-memory state만 유지)
6. `services/location.ts`의 `getCurrentLocation()`은 거부 시 `throw new Error('...')` 만 하고 caller가 안내 못함

### 사용자가 보는 증상
- 위치 권한 거부 → "재시도" 버튼 누름 → 아무 일 안 일어남 → 설정으로 가야 하는지 모름
- 앱 죽이고 다시 켜도 화면이 거부 상태로 안 보일 수 있음

## 리리 티어 판정

### Base tier
**T2** — UI + 작은 로직 변경. 한 화면 + 서비스 한 군데.

### Risk flags 체크
- [x] **위치/권한/저장소 변경** → 최소 T3 (자동 승급)
- [ ] 데이터 모델/마이그레이션
- [ ] EAS/네이티브 config (단, iOS Settings 딥링크는 `Linking` 표준이라 native config 변경 없음)
- [ ] 개인정보/보안 영향 (권한 안내 문구만 변경, 권한 자체 확장 아님)
- [ ] 같은 버그 2회 재발 (첫 케이스)
- [ ] 기존 테스트 없음 + 로직 변경 → Test Engineer 후보지만, Developer TDD로 갈음 (드라이런 검증 목적)

### Final tier
**max(T2, T3) = T3** — Spec Critic 포함.

### 동원할 에이전트
- [x] Planner CC
- [x] Spec Critic CC (T3+)
- [x] Developer CC (TDD 강제)
- [x] QA CC (T2+)
- [ ] Designer (UI 큰 변경 아님, 기존 톤 유지)
- [ ] Test Engineer (Developer TDD로 충분)
- [ ] Privacy Reviewer (외부 배포 아님)

## Open Questions for Planner
1. 거부 후 "재시도" 버튼 누를 때 OS 다이얼로그 못 띄우는 상황(`canAskAgain=false`)이면, 시스템 설정으로 보내는 게 나은지 / 인앱 안내 모달로 갈지?
2. iOS / Android 분기 처리 어떻게? (Android는 `canAskAgain=false`라도 한 번 더 띄울 여지 있음)
3. `services/location.ts`의 throw 방식을 캡처 플로우에서 어떻게 처리하게 할지? (caller 책임 vs 서비스에서 권한상태 같이 반환)
4. 화면 재진입/포그라운드 복귀 시 권한 상태 재조회 트리거 어디에? (`useFocusEffect` 후보)

## Constraints
- happened repo는 **GitHub Actions / CI 워크플로우 추가 절대 금지** (.github/workflows 사용 안 함)
- `package.json` / `app.json` / `eas.json` / native config 변경 금지 (expo-location 이미 설치됨)
- 기존 톤/디자인 유지 (Designer 안 부름)
- Recall/Capture 플로우 회귀 금지 (`useCaptureFlow`에서 위치 사용)
