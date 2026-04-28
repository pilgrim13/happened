/**
 * Apple identityToken RS256 서명 검증 헬퍼.
 * apple-signin-auth 라이브러리를 사용해 Apple JWKS로 서명을 검증한다.
 */
import appleSignin from 'apple-signin-auth';

export interface AppleTokenPayload {
  sub: string;
  email?: string;
}

export class AppleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleTokenError';
  }
}

/**
 * Apple identityToken을 검증하고 payload를 반환한다.
 * audience는 APPLE_AUDIENCE → APPLE_BUNDLE_ID 순으로 읽는다.
 * prod 환경에서 audience 환경변수가 없으면 에러를 던진다.
 */
export async function verifyAppleToken(identityToken: string): Promise<AppleTokenPayload> {
  const audience = process.env.APPLE_AUDIENCE ?? process.env.APPLE_BUNDLE_ID;

  if (!audience) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APPLE_AUDIENCE 또는 APPLE_BUNDLE_ID 환경변수가 설정되지 않았습니다.');
    }
    // dev 환경: 경고 후 기존 fallback (서명 검증 없이 decode)
    console.warn(
      '[appleVerify] APPLE_AUDIENCE/APPLE_BUNDLE_ID not set — skipping JWT signature verification (dev only)',
    );
    const parts = identityToken.split('.');
    if (parts.length !== 3) throw new AppleTokenError('JWT 형식 오류');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as {
      sub?: string;
      email?: string;
    };
    if (!payload.sub) throw new AppleTokenError('sub 클레임 없음');
    return { sub: payload.sub, email: payload.email };
  }

  let payload: { sub: string; email?: string };
  try {
    payload = await appleSignin.verifyIdToken(identityToken, {
      audience,
      issuer: 'https://appleid.apple.com',
    }) as { sub: string; email?: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppleTokenError(`Apple 토큰 검증 실패: ${msg}`);
  }

  if (!payload.sub) throw new AppleTokenError('sub 클레임 없음');
  return { sub: payload.sub, email: payload.email };
}
