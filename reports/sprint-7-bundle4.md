# Sprint 7 — Bundle 4 리포트 (GPS / 지도 / 다크모드)

**날짜**: 2026-04-28
**항목**: P1-5, P2-8, P2-9

---

## P1-5: GPS 캐시 전략 + Balanced accuracy

### 변경 파일
- `src/services/location.ts`
- `src/hooks/useCaptureFlow.ts`
- `src/contexts/AppDataContext.tsx`
- `src/contexts/FeedContext.tsx`
- `src/i18n/index.tsx`

### 핵심 변경 사항

#### `src/services/location.ts`
| 항목 | 이전 | 이후 |
|------|------|------|
| Accuracy | `Accuracy.High` | `Accuracy.Balanced` (배터리 절약) |
| 캐시 | 없음 — 매 호출마다 새 fetch | 모듈 스코프 60초 인메모리 캐시 |
| API | `getCurrentLocation()` | `getCurrentLocation({ forceRefresh?: boolean })` |

- `_locationCache: { location, timestamp } | null` 변수를 모듈 스코프에 선언.
- 60초 이내 재호출 시 캐시 반환, `forceRefresh: true`면 무조건 새 fetch.
- 웹 플랫폼도 동일 캐시 레이어 적용 (`maximumAge` 60s로 조정).

#### `src/hooks/useCaptureFlow.ts`
- `locateMe()`: `forceRefresh: true` — 사용자가 명시적으로 누른 경우 캐시 무시.
- `captureAtPlace()`, `startPostFromHome()`: 캐시 OK (default, `forceRefresh = false`).
- `upload()`: 캐시 OK — 업로드 직전 재fetch 불필요.
- **권한 거부 처리 강화**: `handleLocationError()` 헬퍼 추가.
  - 네이티브(iOS/Android)에서 권한 에러 감지 시 `Alert.alert()`로 "설정 열기" 버튼 포함 모달 표시.
  - `Linking.openSettings()` 호출로 시스템 설정으로 이동.
  - 웹은 기존 notice 표시 (시스템 설정 접근 불가).

#### `src/contexts/AppDataContext.tsx` + `src/contexts/FeedContext.tsx`
- **`lastLocationFetchRef` 완전 제거**: FeedContext 타입/값에서 삭제, AppDataContext destructuring에서도 삭제.
- `refreshViewerCoords()`의 30초 수동 throttle 제거 → `getCurrentLocation()` 60s 캐시에 위임.
- **location 서비스가 single source of truth**가 됨. 이전의 `lastLocationFetchRef` (30s) vs `getCurrentLocation()` (매번 fresh) 불일치 해소.

#### `src/i18n/index.tsx`
- `app.locationPermissionTitle`, `app.locationPermissionMessage`, `app.openSettings` 추가 (en/ko).

### 수동 검증 가이드
1. **권한 허용**: 앱 최초 실행 → 위치 권한 허용 → 지도/캡처 화면에서 정상 작동 확인.
2. **권한 거부**: 설정에서 위치 권한 제거 → 캡처 화면의 "내 위치" 버튼 → "설정 열기" 버튼이 있는 Alert 확인 → 버튼 탭 → 시스템 설정 이동 확인.
3. **캐시 동작**: 위치 업데이트 후 60초 이내 재요청 시 네트워크 호출 없이 즉시 반환 (Xcode/Android Studio 네트워크 모니터로 확인).

---

## P2-8: MapScreen 타일 캐시 전략

### 변경 파일
- `src/screens/MapScreen.tsx`

### 채택: 옵션 A (보수적 접근)

**옵션 B (react-native-maps 도입)는 보류**:
- 새 네이티브 의존성 + Expo config plugin 변경 필요
- 현 커스텀 Web Mercator 구현과 충돌 가능성
- 별도 의사결정 후 진행 권장

### 옵션 A 구현

```tsx
const tileMapRef = useRef(new Map<string, Tile>());

const displayTiles = useMemo(() => {
  const map = tileMapRef.current;
  const activeKeys = new Set(tiles.map((t) => t.key));
  for (const key of map.keys()) {
    if (!activeKeys.has(key)) map.delete(key); // 뷰포트 밖 타일 제거
  }
  for (const tile of tiles) {
    map.set(tile.key, tile); // 신규/위치 변경 타일 추가
  }
  return Array.from(map.values());
}, [tiles]);
```

- `tileMapRef`가 타일 Set의 단일 소유자 역할.
- `buildTiles()` 결과와 diff → 뷰포트 밖 타일만 unmount, 뷰포트 안 타일은 key 안정성 유지.
- React가 동일 key에 대해 Image 컴포넌트를 재마운트하지 않아, 이미 로드된 타일 이미지가 유지됨.
- 새 의존성 없음.

---

## P2-9: 다크모드 팔레트

### 변경/신규 파일
- `src/theme/tokens.shared.ts` — lightColors / darkColors 추가
- `src/theme/ThemeContext.tsx` — 신규 (ThemeProvider + useTheme)
- `App.tsx` — ThemeProvider 래핑 + StatusBar `style="auto"`

### 토큰 정의

`tokens.shared.ts`에 시맨틱 팔레트 2개 추가:

| 토큰 | lightColors | darkColors |
|------|------------|------------|
| bg | `#FFF8EF` (warm cream) | `#05070D` (deep space) |
| surface | `#FFFEF8` | `rgba(13,18,26,0.88)` |
| ink | `#17120F` | `#F5F7F2` |
| muted | `#746B62` | `rgba(245,247,242,0.68)` |
| faint | `#ADA49A` | `rgba(245,247,242,0.42)` |
| line | `rgba(23,18,15,0.14)` | `rgba(255,255,255,0.12)` |
| mint | `#87F0B6` | `#C7F95B` |
| lavender | `#BDA8FF` | `#9B8CFF` |
| blue | `#B9D8FF` | `#39D9F2` |
| pink | `#FFB7C8` | `#FF6F61` |
| yellow | `#FFE893` | `#F8D84E` |

### ThemeProvider
- `useColorScheme()` (React Native 빌트인) 기반으로 `light` / `dark` 감지.
- `ThemeContext.Provider`로 `{ scheme, colors }` 노출.
- `useTheme().colors`로 향후 컴포넌트가 점진적으로 마이그레이션 가능.

### 이번 묶음 범위
- [x] 토큰 정의 (`lightColors`, `darkColors`)
- [x] `ThemeProvider` + `useTheme()` hook
- [x] `App.tsx`에 `ThemeProvider` 래핑
- [x] `StatusBar style="dark"` → `style="auto"` (OS 테마 자동 반영)
- [ ] 화면별 색상 교체 — 다음 스프린트 (각 컴포넌트에서 `useTheme().colors` 마이그레이션)

---

## 검증 결과

| 항목 | 결과 |
|------|------|
| `npm run test:server` | 전체 통과 (17개 ok) |
| `npx expo export --platform web` | 성공 (dist/ 생성, 3.2MB bundle) |

## 수동 검증 가이드

### 권한 거부 흐름
1. 설정 > 앱 > 위치 권한 제거
2. 캡처 화면 → "내 위치" 버튼
3. "위치 권한이 필요합니다" Alert + "설정 열기" 버튼 확인
4. 버튼 탭 → 시스템 설정으로 이동 확인

### 다크모드 토글
1. iOS/Android 시스템 설정에서 다크 모드 전환
2. StatusBar 색상이 자동 반전되는지 확인
3. 향후 `useTheme().colors`를 사용하는 컴포넌트 추가 시 자동 반영됨
