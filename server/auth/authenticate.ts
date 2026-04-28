import type { FastifyRequest } from 'fastify';

export type AuthUser = {
  id: string;
  [key: string]: unknown;
};

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

/**
 * preValidation 훅에서 request.user에 캐시된 사용자 정보를 반환한다.
 * 캐시 미적중 시(preValidation 실패 등) auth_failed 에러 throw.
 * - 인증이 필요한 핸들러에서 repository.getSession() 중복 호출을 방지.
 */
export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user) {
    const err = new Error('인증이 필요해요.');
    Object.assign(err, { statusCode: 401, code: 'auth_failed' });
    throw err;
  }
  return request.user;
}
