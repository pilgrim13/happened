import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { getConfig, type ApiConfig } from './config';
import { checkDatabase, closeDatabase } from './db';
import { createMediaStorage } from './media';
import { createRepository, RepositoryError } from './repository';
import {
  authHeaderSchema,
  authLoginRequestSchema,
  authRegisterRequestSchema,
  checkInRequestSchema,
  feedQuerySchema,
  memoryCreateRequestSchema,
  memoryUpdateRequestSchema,
  notificationReadRequestSchema,
  commentParamsSchema,
  postActionRequestSchema,
  postParamsSchema,
  placeParamsSchema,
  profileUpdateRequestSchema,
  searchQuerySchema,
  nearbyQuerySchema,
  userParamsSchema,
} from './schemas';

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

export async function buildServer(config: ApiConfig = getConfig()) {
  const app = Fastify({
    bodyLimit: Math.max(80 * 1024 * 1024, config.media.maxBytes * 10),
    logger: config.logRequests
      ? {
          redact: ['req.headers.authorization', 'body.password', 'password'],
        }
      : false,
  });
  const repository = await createRepository(config.databaseUrl);
  const mediaStorage = createMediaStorage(config.media);

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'bad_request',
        message: 'Request validation failed.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof RepositoryError) {
      return reply.status(statusForRepositoryError(error)).send({
        error: error.code,
        message: error.message,
      });
    }

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

  app.post('/v1/auth/register', async (request, reply) => {
    const body = authRegisterRequestSchema.parse(request.body);
    const session = await repository.registerUser(body);

    return reply.status(201).send({
      data: session,
    });
  });

  app.post('/v1/auth/login', async (request) => {
    const body = authLoginRequestSchema.parse(request.body);

    return {
      data: await repository.loginUser(body),
    };
  });

  app.get('/v1/auth/session', async (request, reply) => {
    const token = authHeaderSchema.parse(request.headers.authorization);
    const session = await repository.getSession(token);

    if (!session) {
      return reply.status(401).send({
        error: 'auth_failed',
        message: 'Session is missing or expired.',
      });
    }

    return {
      data: session,
    };
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
      data: await repository.getFeed(query.mode, sessionToken),
    };
  });

  app.get('/v1/search', async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.searchContent(query.q, sessionToken),
    };
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

    return {
      data: await repository.deleteMemoryPost(params.postId, sessionToken),
    };
  });

  app.get('/v1/posts/:postId', async (request) => {
    const params = postParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.getPostDetail(params.postId, sessionToken),
    };
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

    return {
      data: await repository.getProfile(params.handle, sessionToken),
    };
  });

  app.get('/v1/users/:handle/connections', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.getConnections(params.handle, sessionToken),
    };
  });

  app.post('/v1/users/:handle/follow', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.toggleFollow(params.handle, sessionToken),
    };
  });

  app.post('/v1/users/:handle/block', async (request) => {
    const params = userParamsSchema.parse(request.params);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.toggleBlock(params.handle, sessionToken),
    };
  });

  app.get('/v1/me/safety', async (request) => {
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.getSafetySummary(sessionToken),
    };
  });

  app.get('/v1/notifications', async (request) => {
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.getNotifications(sessionToken),
    };
  });

  app.post('/v1/notifications/read', async (request) => {
    const body = notificationReadRequestSchema.parse(request.body ?? {});
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);

    return {
      data: await repository.markNotificationsRead(sessionToken, body.notificationIds),
    };
  });

  app.get('/v1/places', async () => ({
    data: await repository.getPlaces(),
  }));

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

    return {
      data: await repository.getPlace(params.placeKey),
    };
  });

  app.get('/v1/timeline', async () => ({
    data: await repository.getTimeline(),
  }));

  app.post('/v1/check-ins', async (request, reply) => {
    const body = checkInRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    const token = await repository.issueCheckIn({ ...body, sessionToken });

    return reply.status(201).send({
      data: token,
    });
  });

  app.post('/v1/memories', async (request, reply) => {
    const body = memoryCreateRequestSchema.parse(request.body);
    const sessionToken = authHeaderSchema.parse(request.headers.authorization);
    const requestedMedia = body.mediaItems?.length
      ? body.mediaItems
      : body.mediaDataUrl
        ? [{ mediaDataUrl: body.mediaDataUrl, mediaFileName: body.mediaFileName }]
        : [];
    const savedMedia = await Promise.all(requestedMedia.map((item) => mediaStorage.saveDataUrl(item.mediaDataUrl, item.mediaFileName)));
    const result = await repository.createMemory({
      ...body,
      sessionToken,
      mediaUrl: savedMedia[0]?.url,
      mediaUrls: savedMedia.map((media) => media.url),
    });

    return reply.status(201).send({
      data: result,
    });
  });

  app.get('/uploads/:fileName', async (request, reply) => {
    const params = request.params as { fileName?: string };
    const fileName = params.fileName ?? '';
    const media = await mediaStorage.read(fileName);

    if (!media) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Media file was not found.',
      });
    }

    const range = request.headers.range;
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);

      if (!match) {
        return reply
          .status(416)
          .header('content-range', `bytes */${media.size}`)
          .send();
      }

      const [, rawStart, rawEnd] = match;
      const suffixLength = !rawStart && rawEnd ? Number.parseInt(rawEnd, 10) : null;
      const requestedStart = suffixLength ? media.size - suffixLength : rawStart ? Number.parseInt(rawStart, 10) : 0;
      const requestedEnd = suffixLength ? media.size - 1 : rawEnd ? Number.parseInt(rawEnd, 10) : media.size - 1;
      const start = Math.max(0, requestedStart);
      const end = Math.min(media.size - 1, requestedEnd);

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= media.size) {
        return reply
          .status(416)
          .header('content-range', `bytes */${media.size}`)
          .send();
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
