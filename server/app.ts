import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { getConfig, type ApiConfig } from './config';
import { checkDatabase, closeDatabase } from './db';
import { createMediaStorage } from './media';
import { createMailer } from './mailer';
import { createObjectStorage, mediaKey } from './storage';
import { createRepository, RepositoryError, reverseGeocode } from './repository';
import { verifyAppleToken } from './auth/appleVerify';
import {
  authHeaderSchema,
  authLoginRequestSchema,
  authRegisterRequestSchema,
  checkInRequestSchema,
  feedQuerySchema,
  cursorQuerySchema,
  memoryCreateRequestSchema,
  memoryUpdateRequestSchema,
  notificationReadRequestSchema,
  commentParamsSchema,
  postActionRequestSchema,
  postParamsSchema,
  placeParamsSchema,
  placeCreateSchema,
  presignRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  verifyEmailConfirmSchema,
  sessionParamsSchema,
  profileUpdateRequestSchema,
  searchQuerySchema,
  nearbyQuerySchema,
  userParamsSchema,
  pushRegisterSchema,
  pushRevokeSchema,
  recallParamsSchema,
  appleAuthSchema,
} from './schemas';

const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function statusForRepositoryError(error: RepositoryError) {
  switch (error.code) {
    case 'place_not_found':
    case 'post_not_found':
    case 'profile_not_found':
    case 'comment_not_found':
    case 'token_not_found':
      return 404;
    case 'auth_failed':
      return 401;
    case 'email_taken':
    case 'handle_taken':
    case 'follow_self':
    case 'block_self':
      return 409;
    case 'outside_radius':
    case 'location_accuracy_low':
    case 'post_owner_required':
      return 403;
    case 'token_expired':
    case 'token_spent':
      return 409;
    default:
      return 500;
  }
}

function buildLoggerOptions(config: ApiConfig) {
  if (!config.logRequests) return false;
  const redactPaths = [
    'req.headers.authorization',
    'req.headers.cookie',
    'body.password',
    'body.token',
    'password',
    'token',
  ];
  if (config.isProd) {
    return { level: config.logLevel, redact: { paths: redactPaths, censor: '[REDACTED]' } };
  }
  return {
    level: config.logLevel,
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
    },
  };
}

export async function buildServer(config: ApiConfig = getConfig()) {
  const app = Fastify({
    bodyLimit: Math.max(80 * 1024 * 1024, config.media.maxBytes * 10),
    logger: buildLoggerOptions(config) as any,
    genReqId: () => `req_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
  });

  const repository = await createRepository(config.databaseUrl);
  const mediaStorage = createMediaStorage(config.media);
  const objectStorage = config.storage ? createObjectStorage(config.storage) : null;
  const mailer = config.mailer ? createMailer(config.mailer) : null;

  // x-request-id reflection
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // 인증된 요청이면 userId를 로그 컨텍스트에 포함
  app.addHook('preValidation', async (request) => {
    const auth = request.headers.authorization;
    if (auth) {
      try {
        const session = await repository.getSession(auth);
        if (session) {
          request.log = request.log.child({ userId: session.user.id });
        }
      } catch {
        // 로깅 목적 실패는 무시
      }
    }
  });

  // Helmet (relax CSP in dev so /uploads/preview works).
  await app.register(helmet, {
    contentSecurityPolicy: config.isProd
      ? undefined
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.globalMax,
    timeWindow: config.rateLimit.timeWindowMs,
    allowList: (request) => request.url === '/health',
    keyGenerator: (request) => request.ip,
  });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn({ issues: error.issues }, 'request validation failed');
      return reply.status(400).send({
        error: 'bad_request',
        message: '입력값을 확인해주세요.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof RepositoryError) {
      const status = statusForRepositoryError(error);
      if (status >= 500) {
        request.log.error({ err: error, code: error.code }, 'repository error');
      } else {
        request.log.info({ code: error.code }, 'repository error');
      }
      return reply.status(status).send({
        error: error.code,
        message: error.message,
      });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.send(error);
  });

  app.addHook('onClose', async () => {
    await closeDatabase();
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'happened-api',
    environment: config.nodeEnv,
    database: await checkDatabase(config.databaseUrl),
    media: await mediaStorage.health(),
  }));

  // Auth endpoints have stricter rate limits.
  const authRateLimit = {
    config: {
      rateLimit: { max: config.rateLimit.authMax, timeWindow: config.rateLimit.timeWindowMs },
    },
  };

  app.post('/v1/auth/register', authRateLimit as any, async (request, reply) => {
    const body = authRegisterRequestSchema.parse(request.body);
    const session = await repository.registerUser({
      ...body,
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    });
    return reply.status(201).send({ data: session });
  });

  app.post('/v1/auth/login', authRateLimit as any, async (request) => {
    const body = authLoginRequestSchema.parse(request.body);
    return {
      data: await repository.loginUser({
        ...body,
        userAgent: request.headers['user-agent'] ?? null,
        ip: request.ip,
      }),
    };
  });

  app.post('/v1/auth/logout', authRateLimit as any, async (request) => {
    const token = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.logoutSession(token) };
  });

  app.get('/v1/auth/sessions', async (request) => {
    const token = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.listSessions(token) };
  });

  app.delete('/v1/auth/sessions/:id', async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const token = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.revokeSession(token, params.id) };
  });

  app.get('/v1/auth/session', async (request, reply) => {
    const token = authHeaderSchema.parse(request.headers.authorization);
    const session = await repository.getSession(token);
    if (!session) {
      return reply.status(401).send({ error: 'auth_failed', message: '세션이 없거나 만료되었어요. 다시 로그인해 주세요.' });
    }
    return { data: session };
  });

  // Email verification
  app.post('/v1/auth/verify-email/request', authRateLimit as any, async (request) => {
    const token = authHeaderSchema.parse(request.headers.authorization);
    const issued = await repository.requestEmailVerification(token);
    if (mailer) {
      const link = `${config.appPublicUrl}/verify-email?token=${encodeURIComponent(issued.token)}`;
      try {
        await mailer.sendVerificationEmail(issued.email, issued.token, link);
      } catch (err) {
        request.log.warn({ err }, 'failed to send verification email');
      }
    }
    return { data: { ok: true, expiresAt: issued.expiresAt } };
  });

  app.post('/v1/auth/verify-email/confirm', authRateLimit as any, async (request) => {
    const body = verifyEmailConfirmSchema.parse(request.body);
    return { data: await repository.confirmEmailVerification(body.token) };
  });

  app.post('/v1/auth/password-reset/request', authRateLimit as any, async (request) => {
    const body = passwordResetRequestSchema.parse(request.body);
    const issued = await repository.requestPasswordReset(body.email);
    if (mailer && issued.token) {
      const link = `${config.appPublicUrl}/reset-password?token=${encodeURIComponent(issued.token)}`;
      try {
        await mailer.sendPasswordResetEmail(body.email, link);
      } catch (err) {
        request.log.warn({ err }, 'failed to send password reset email');
      }
    }
    return { data: { ok: true } };
  });

  app.post('/v1/auth/password-reset/confirm', authRateLimit as any, async (request) => {
    const body = passwordResetConfirmSchema.parse(request.body);
    return { data: await repository.confirmPasswordReset(body.token, body.password) };
  });

  // Presigned upload
  app.post('/v1/media/presign', async (request, reply) => {
    if (!objectStorage) {
      return reply.status(503).send({ error: 'storage_unavailable', message: '파일 저장소가 구성되어 있지 않아요.' });
    }
    const token = authHeaderSchema.parse(request.headers.authorization);
    const session = await repository.getSession(token);
    if (!session) {
      return reply.status(401).send({ error: 'auth_failed', message: '로그인이 필요해요.' });
    }
    const body = presignRequestSchema.parse(request.body);

    const allowed = body.kind === 'photo' ? ALLOWED_PHOTO_MIMES : ALLOWED_VIDEO_MIMES;
    if (!allowed.has(body.contentType.toLowerCase())) {
      return reply.status(400).send({ error: 'unsupported_media', message: `Content type ${body.contentType} is not allowed.` });
    }
    const cap = body.kind === 'photo' ? config.media.photoMaxBytes : config.media.videoMaxBytes;
    if (body.contentLength > cap) {
      return reply.status(413).send({ error: 'payload_too_large', message: `Max ${cap} bytes for ${body.kind}.` });
    }
    const ext = body.ext || (body.contentType.split('/')[1] ?? 'bin');
    // postId placeholder — uses a UUID for grouping, client supplies as "draft".
    const draftPostId = `draft-${Math.random().toString(36).slice(2, 10)}`;
    const key = mediaKey(session.user.id, draftPostId, ext);
    const presigned = await objectStorage.createPresignedUploadUrl({
      key,
      contentType: body.contentType,
      maxBytes: body.contentLength,
      expiresInSeconds: 600,
    });
    request.log.info({ key, kind: body.kind, userId: session.user.id }, 'presigned upload issued');
    return { data: { ...presigned, key } };
  });

  app.patch('/v1/me/profile', async (request) => {
    const body = profileUpdateRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    const avatar = body.avatarDataUrl ? await mediaStorage.saveDataUrl(body.avatarDataUrl, body.avatarFileName) : null;
    return {
      data: await repository.updateProfile({
        displayName: body.displayName,
        handle: body.handle,
        bio: body.bio,
        avatarUrl: avatar?.url,
        sessionToken,
      }),
    };
  });

  app.get('/v1/feed', async (request) => {
    const query = feedQuerySchema.parse(request.query);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return {
      data: await repository.getFeed(query.mode, sessionToken, { cursor: query.cursor ?? null, limit: query.limit }, query.lat, query.lng),
    };
  });

  app.get('/v1/search', async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.searchContent(query.q, sessionToken) };
  });

  app.post('/v1/posts/:postId/actions', async (request) => {
    const params = postParamsSchema.parse(request.params);
    const body = postActionRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return {
      data: await repository.updatePostAction({
        postId: params.postId,
        action: body.action,
        body: body.body,
        sessionToken,
      }),
    };
  });

  app.patch('/v1/posts/:postId', async (request) => {
    const params = postParamsSchema.parse(request.params);
    const body = memoryUpdateRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return {
      data: await repository.updateMemoryPost({
        postId: params.postId,
        caption: body.caption,
        visibility: body.visibility,
        sessionToken,
      }),
    };
  });

  app.delete('/v1/posts/:postId', async (request) => {
    const params = postParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.deleteMemoryPost(params.postId, sessionToken) };
  });

  app.get('/v1/posts/:postId', async (request) => {
    const params = postParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.getPostDetail(params.postId, sessionToken) };
  });

  app.delete('/v1/posts/:postId/comments/:commentId', async (request) => {
    const params = commentParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return {
      data: await repository.deleteComment({
        postId: params.postId,
        commentId: params.commentId,
        sessionToken,
      }),
    };
  });

  app.get('/v1/users/:handle', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.getProfile(params.handle, sessionToken) };
  });

  app.get('/v1/users/:handle/connections', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.getConnections(params.handle, sessionToken) };
  });

  app.post('/v1/users/:handle/follow', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.toggleFollow(params.handle, sessionToken) };
  });

  app.post('/v1/users/:handle/block', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.toggleBlock(params.handle, sessionToken) };
  });

  app.get('/v1/me/safety', async (request) => {
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.getSafetySummary(sessionToken) };
  });

  app.get('/v1/notifications', async (request) => {
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.getNotifications(sessionToken) };
  });

  app.post('/v1/notifications/read', async (request) => {
    const body = notificationReadRequestSchema.parse(request.body ?? {});
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.markNotificationsRead(sessionToken, body.notificationIds) };
  });

  // 사용자 GPS 위치 기반 장소 생성 또는 기존 장소 반환
  app.post('/v1/places', async (request, reply) => {
    const body = placeCreateSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    const session = await repository.getSession(sessionToken);
    if (!session) {
      return reply.status(401).send({ error: 'auth_failed', message: '로그인이 필요해요.' });
    }
    const place = await repository.createOrFindPlace({
      userId: session.user.id,
      lat: body.lat,
      lng: body.lng,
      name: body.name,
    });
    return reply.status(201).send({ data: place });
  });

  app.get('/v1/places', async () => ({ data: await repository.getPlaces() }));

  app.get('/v1/places/reverse-geocode', async (request) => {
    const query = nearbyQuerySchema.parse(request.query);
    const address = await reverseGeocode(query.lat, query.lng);
    return { data: address };
  });

  app.get('/v1/places/nearby', async (request) => {
    const query = nearbyQuerySchema.parse(request.query);
    return {
      data: await repository.findNearbyPlaces({
        latitude: query.lat,
        longitude: query.lng,
        radiusMeters: query.radius,
        limit: query.limit,
      }),
    };
  });

  app.get('/v1/places/:placeKey', async (request) => {
    const params = placeParamsSchema.parse(request.params);
    return { data: await repository.getPlace(params.placeKey) };
  });

  app.get('/v1/timeline', async () => ({ data: await repository.getTimeline() }));

  app.post('/v1/check-ins', async (request, reply) => {
    const body = checkInRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    const token = await repository.issueCheckIn({ ...body, sessionToken });
    return reply.status(201).send({ data: token });
  });

  app.post('/v1/memories', async (request, reply) => {
    const body = memoryCreateRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    // S3 presigned 업로드 플로우: mediaKeys 검증 후 포스트 생성
    if (body.mediaKeys?.length) {
      if (!objectStorage) {
        return reply.status(503).send({ error: 'storage_unavailable', message: '파일 저장소가 구성되어 있지 않아요.' });
      }
      const verified = await Promise.all(body.mediaKeys.map(async (k) => ({
        key: k,
        exists: await objectStorage.objectExists(k),
        publicUrl: objectStorage.publicUrlFor(k),
      })));
      const missing = verified.filter((v) => !v.exists);
      if (missing.length) {
        return reply.status(400).send({ error: 'media_missing', message: '업로드한 미디어 파일을 찾을 수 없어요.', missing: missing.map((m) => m.key) });
      }
      const result = await repository.createMemory({
        checkInTokenId: body.checkInTokenId,
        lat: body.lat,
        lng: body.lng,
        placeName: body.placeName,
        caption: body.caption,
        visibility: body.visibility,
        mediaUrl: verified[0]?.publicUrl,
        mediaUrls: verified.map((v) => v.publicUrl),
        mediaKeys: verified.map((v) => v.key),
        sessionToken,
      });
      return reply.status(201).send({ data: result });
    }

    // dataURL 업로드 플로우 (신규 GPS 기반 + 구형 토큰 기반 모두 처리)
    const requestedMedia = body.mediaItems?.length
      ? body.mediaItems
      : body.mediaDataUrl
        ? [{ mediaDataUrl: body.mediaDataUrl, mediaFileName: body.mediaFileName }]
        : [];
    const savedMedia = await Promise.all(
      requestedMedia.map((item) => mediaStorage.saveDataUrl(item.mediaDataUrl, item.mediaFileName)),
    );
    const result = await repository.createMemory({
      checkInTokenId: body.checkInTokenId,
      lat: body.lat,
      lng: body.lng,
      placeName: body.placeName,
      caption: body.caption,
      visibility: body.visibility,
      sessionToken,
      mediaUrl: savedMedia[0]?.url,
      mediaUrls: savedMedia.map((media) => media.url),
    });

    return reply.status(201).send({ data: result });
  });

  // ─── 푸시 토큰 등록/폐기 ────────────────────────────────────────────────────

  // ─── Apple Sign-In ───────────────────────────────────────────────────────────

  app.post('/v1/auth/apple', authRateLimit as any, async (request, reply) => {
    const body = appleAuthSchema.parse(request.body);
    let appleUserId: string;
    let appleEmail: string | undefined;
    try {
      const payload = await verifyAppleToken(body.identityToken);
      appleUserId = payload.sub;
      appleEmail = payload.email;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apple 토큰 검증 실패';
      // prod에서 환경변수 미설정이면 500, 그 외 토큰 오류는 401
      const status = (err instanceof Error && err.message.includes('환경변수')) ? 500 : 401;
      return reply.status(status).send({ error: 'INVALID_APPLE_TOKEN', message: msg });
    }
    const displayName = [body.fullName?.givenName, body.fullName?.familyName].filter(Boolean).join(' ') || null;
    const session = await repository.loginOrRegisterAppleUser({
      appleUserId,
      email: appleEmail ?? null,
      displayName,
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    });
    return reply.status(200).send({ data: session });
  });

  app.post('/v1/push/register', async (request, reply) => {
    const body = pushRegisterSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    await repository.registerPushToken(sessionToken, body.token, body.platform);
    return reply.status(201).send({ data: { ok: true } });
  });

  app.delete('/v1/push/register', async (request) => {
    const body = pushRevokeSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    await repository.revokePushToken(sessionToken, body.token);
    return { data: { ok: true } };
  });

  // ─── Recall 피드 조회 / dismiss ──────────────────────────────────────────────

  app.get('/v1/recall/feed', async (request) => {
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.listRecallFeed(sessionToken) };
  });

  app.post('/v1/recall/:id/dismiss', async (request) => {
    const params = recallParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    return { data: await repository.dismissRecall(sessionToken, params.id) };
  });

  app.get('/uploads/:fileName', async (request, reply) => {
    const params = request.params as { fileName?: string };
    const fileName = params.fileName ?? '';
    const media = await mediaStorage.read(fileName);

    if (!media) {
      return reply.status(404).send({ error: 'not_found', message: 'Media file was not found.' });
    }

    const range = request.headers.range;
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        return reply.status(416).header('content-range', `bytes */${media.size}`).send();
      }
      const [, rawStart, rawEnd] = match;
      const suffixLength = !rawStart && rawEnd ? Number.parseInt(rawEnd, 10) : null;
      const requestedStart = suffixLength ? media.size - suffixLength : rawStart ? Number.parseInt(rawStart, 10) : 0;
      const requestedEnd = suffixLength ? media.size - 1 : rawEnd ? Number.parseInt(rawEnd, 10) : media.size - 1;
      const start = Math.max(0, requestedStart);
      const end = Math.min(media.size - 1, requestedEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= media.size) {
        return reply.status(416).header('content-range', `bytes */${media.size}`).send();
      }
      return reply
        .status(206)
        .header('content-type', media.mimeType)
        .header('accept-ranges', 'bytes')
        .header('content-range', `bytes ${start}-${end}/${media.size}`)
        .header('content-length', end - start + 1)
        .header('cache-control', 'public, max-age=31536000, immutable')
        .send(media.body.subarray(start, end + 1));
    }

    return reply
      .header('content-type', media.mimeType)
      .header('accept-ranges', 'bytes')
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(media.body);
  });

  return app;
}
