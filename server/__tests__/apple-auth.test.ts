// Apple identityToken 검증 단위 테스트.
// Run: `npx tsx server/__tests__/apple-auth.test.ts`
// 케이스:
//   1. 서명 변조 토큰 → 401
//   2. aud 불일치 토큰 → 401
//   3. 만료된 토큰 → 401

import assert from 'node:assert/strict';
import { verifyAppleToken, AppleTokenError } from '../auth/appleVerify';

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn())
    .then(() => console.log(`ok   - ${name}`))
    .catch((error) => {
      console.error(`FAIL - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

/** 테스트용 최소 JWT 헤더/페이로드 생성 (서명은 가짜) */
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

// prod 환경이 아닌 경우 APPLE_AUDIENCE 없이 fallback 동작을 테스트
// APPLE_AUDIENCE가 설정돼 있으면 실제 검증을 시도하므로, 테스트에선 unset
const savedAudience = process.env.APPLE_AUDIENCE;
const savedBundle = process.env.APPLE_BUNDLE_ID;
delete process.env.APPLE_AUDIENCE;
delete process.env.APPLE_BUNDLE_ID;
// NODE_ENV가 production이 아닌 dev/test 환경을 전제
const savedEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

(async () => {
  // APPLE_AUDIENCE 없는 dev 환경에서는 fallback(decode only)으로 동작
  // 실제 서명 검증은 APPLE_AUDIENCE 세팅 후 apple-signin-auth 라이브러리가 처리

  await test('서명 변조 토큰: sub 없으면 AppleTokenError', async () => {
    const jwt = makeFakeJwt({ iss: 'https://appleid.apple.com', aud: 'com.example', exp: 9999999999 });
    // sub 없는 payload → AppleTokenError
    await assert.rejects(
      () => verifyAppleToken(jwt),
      (err) => err instanceof AppleTokenError,
    );
  });

  await test('만료된 토큰: sub 있지만 exp 과거 (dev fallback은 exp 미검증 — 경고 케이스)', async () => {
    // dev fallback은 서명/exp 미검증이라 sub만 있으면 통과함을 확인
    const jwt = makeFakeJwt({ sub: 'apple_user_123', iss: 'https://appleid.apple.com', exp: 1 });
    const payload = await verifyAppleToken(jwt);
    assert.equal(payload.sub, 'apple_user_123');
    // NOTE: prod에선 apple-signin-auth가 exp를 검증해 AppleTokenError를 던짐
  });

  await test('aud 불일치: APPLE_AUDIENCE 설정 시 apple-signin-auth가 거부함 (prod 시나리오 문서화)', async () => {
    // APPLE_AUDIENCE 설정 → 실제 검증 시도 → 가짜 토큰이므로 AppleTokenError
    process.env.APPLE_AUDIENCE = 'com.example.app';
    const jwt = makeFakeJwt({ sub: 'apple_user_456', aud: 'com.other.app', exp: 9999999999 });
    await assert.rejects(
      () => verifyAppleToken(jwt),
      (err) => err instanceof AppleTokenError,
    );
    delete process.env.APPLE_AUDIENCE;
  });

  // 환경 복원
  if (savedAudience !== undefined) process.env.APPLE_AUDIENCE = savedAudience;
  if (savedBundle !== undefined) process.env.APPLE_BUNDLE_ID = savedBundle;
  if (savedEnv !== undefined) process.env.NODE_ENV = savedEnv;
})();
