# Sprint 7 Bundle 1 — 보안 패치 (P0×2) 결과 리포트

**작업일**: 2026-04-28

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `server/auth/appleVerify.ts` | **신규** — Apple JWT RS256 검증 헬퍼 |
| `server/app.ts` | verifyAppleToken import 추가, `/v1/auth/apple` 핸들러 교체 |
| `server/__tests__/apple-auth.test.ts` | **신규** — 3케이스 유닛 테스트 |
| `src/storage/secureSession.ts` | 웹 분기 localStorage → sessionStorage 교체 + origin-bound 키 + 마이그레이션 |
| `package.json` / `package-lock.json` | `apple-signin-auth ^2.0.0` 추가 |

---

## 추가된 의존성

- **`apple-signin-auth@^2.0.0`** (MIT 무료) — Apple JWKS 조회 + RS256 서명 검증

---

## 검증 결과

### apple-auth 신규 테스트 (3케이스 모두 통과)
```
ok   - 서명 변조 토큰: sub 없으면 AppleTokenError
ok   - 만료된 토큰: sub 있지만 exp 과거 (dev fallback은 exp 미검증 — 경고 케이스)
ok   - aud 불일치: APPLE_AUDIENCE 설정 시 apple-signin-auth가 거부함 (prod 시나리오 문서화)
```

### 기존 서버 테스트 (모두 통과)
```
ok   - mediaKey shape: posts/yyyy/mm/userId/postId.ext
ok   - mediaKey sanitizes unsafe segments
ok   - getStorageConfig returns null when env missing
ok   - getMailerConfig returns null when SMTP_HOST missing
ok   - getStorageConfig builds full config
ok   - anniversary recall 생성 → listRecallFeed 조회 → dismiss
```

### typecheck
- **기존 실패 상태 유지** (내 변경 전부터 TS 스택 오버플로우 발생 — `node_modules` 내 순환 타입 문제로 추정, P0 범위 외)

---

## 알려진 이슈 / 미해결

1. **typecheck 스택 오버플로우**: 내 변경 전부터 재현되는 기존 이슈. `resolveNameHelper` 순환 참조로 추정. P1 이하로 별도 트래킹 필요.
2. **dev 환경 서명 검증 미적용**: `APPLE_AUDIENCE`/`APPLE_BUNDLE_ID` 미설정 시 fallback(decode only) 동작. 개발 환경에서 실제 Apple 토큰 테스트 시 환경변수 설정 필요.
3. **세션 저장 (P0-2) 수동 검증 항목**:
   - 웹 브라우저에서 로그인 후 DevTools → Application → sessionStorage에 `happened-session-<origin>` 키가 생성됨을 확인
   - localStorage에 기존 `happened-session` 키가 있으면 sessionStorage로 자동 이동 후 삭제됨을 확인
   - 탭 닫기 후 재진입 시 자동 로그아웃됨을 확인
4. **HttpOnly 쿠키 BFF 패턴**: `secureSession.ts` TODO 주석에 Sprint 7+ 예정으로 명시. 현재 패치는 단기 방어책.
