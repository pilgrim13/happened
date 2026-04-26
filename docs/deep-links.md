# Happened — 딥링크 정책

앱 내 특정 화면으로 직접 진입하기 위한 딥링크 매트릭스.

## 스킴 매트릭스

| 목적 | 커스텀 스킴 | Universal / App Link |
|------|-------------|----------------------|
| 게시물 상세 | `happened://post/:id` | `https://happened.app/p/:id` |
| 장소 상세 | `happened://place/:placeId` | `https://happened.app/places/:placeId` |
| 유저 프로필 | `happened://u/:handle` | `https://happened.app/u/:handle` |
| Recall 진입 | `happened://recall/:recallId` | `https://happened.app/recall/:recallId` |
| 이메일 인증 | — | `https://happened.app/verify-email?token=:token` |
| 비밀번호 재설정 | — | `https://happened.app/reset-password?token=:token` |

## 플랫폼별 설정

### iOS — Universal Links (AASA)

1. `apple-app-site-association` 파일을 **루트 도메인** 및 서브도메인에 서빙:
   - URL: `https://happened.app/.well-known/apple-app-site-association`
   - Content-Type: `application/json` (확장자 없이)
2. 파일 예시:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "<TEAM_ID>.<BUNDLE_ID>",
           "paths": ["/p/*", "/places/*", "/u/*", "/recall/*", "/verify-email", "/reset-password"]
         }
       ]
     }
   }
   ```
3. **위치**: CDN 또는 Fastify 정적 서빙. `server/app.ts` 에서 `/.well-known/apple-app-site-association` GET 라우트로 JSON 응답.
4. Expo 설정 (`app.json`):
   ```json
   {
     "expo": {
       "ios": {
         "associatedDomains": ["applinks:happened.app"]
       }
     }
   }
   ```

### Android — App Links (assetlinks.json)

1. `assetlinks.json` 파일 위치: `https://happened.app/.well-known/assetlinks.json`
2. 파일 예시:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "app.happened",
         "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT>"]
       }
     }
   ]
   ```
3. Expo 설정 (`app.json`):
   ```json
   {
     "expo": {
       "android": {
         "intentFilters": [
           {
             "action": "VIEW",
             "autoVerify": true,
             "data": [{"scheme": "https", "host": "happened.app"}],
             "category": ["BROWSABLE", "DEFAULT"]
           }
         ]
       }
     }
   }
   ```

### 커스텀 스킴 (fallback)

- Expo: `app.json` → `"scheme": "happened"`
- Web 브라우저에서 `happened://` 는 동작하지 않음 → Universal/App Link 우선 사용
- 개발 환경: `exp://` 스킴 (Expo Go) 또는 커스텀 스킴 모두 사용 가능

## 서버 측 라우팅

- `APP_PUBLIC_URL` 환경변수로 도메인을 주입 (이메일 링크, AASA URL 생성 등)
- `server/app.ts` 에 AASA / assetlinks 엔드포인트 추가 예정 (Sprint 6)

## Recall 딥링크 흐름

```
푸시 알림 수신
  → 탭
  → happened://recall/:recallId  또는  https://happened.app/recall/:recallId
  → RecallScreen (recallId 로 GET /v1/recall/feed 조회)
  → dismiss 버튼 → POST /v1/recall/:id/dismiss
```
