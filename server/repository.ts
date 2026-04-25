import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { memoryPosts, placeBubbles, timelineMonths } from '../src/data/happened';
import { colors } from '../src/theme/tokens';
import type {
  AuthSession,
  CheckInToken,
  FeedMode,
  MemoryPost,
  MemoryPostAction,
  NotificationItem,
  PlaceBubble,
  PostComment,
  PublicProfile,
  PublicUser,
  SafetySummary,
  SearchResults,
  TimelineMonth,
  UserConnection,
  UserConnections,
  UserLocation,
  Visibility,
} from '../src/types/happened';
import { migrateDatabase, queryDatabase } from './db';
import { LocalStore, type StorePostAction, type StoreUser } from './localStore';

type RepositoryErrorCode =
  | 'auth_failed'
  | 'email_taken'
  | 'handle_taken'
  | 'profile_not_found'
  | 'comment_not_found'
  | 'post_owner_required'
  | 'follow_self'
  | 'block_self'
  | 'place_not_found'
  | 'post_not_found'
  | 'outside_radius'
  | 'location_accuracy_low'
  | 'token_not_found'
  | 'token_expired'
  | 'token_spent';

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function normalize(value: string) {
  return decodeURIComponent(value).trim().toLowerCase();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeHandle(value: string) {
  return normalize(value).replace(/^@+/, '');
}

function getActorKey(user: StoreUser | null, sessionToken?: string | null) {
  if (user) {
    return `user:${user.id}`;
  }

  return `anon:${sessionToken || 'public-preview'}`;
}

function placeNameMatches(placeNameValue: string, placeKey: string) {
  const key = normalize(placeKey);
  const placeName = normalize(placeNameValue);

  return placeName === key || placeName.includes(key) || key.includes(placeName);
}

function formatFilmStamp(now: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  })
    .format(now)
    .toUpperCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const DEV_TEST_ACCOUNT = {
  id: 'dev-test-user',
  email: 'test@happened.dev',
  displayName: 'Junn',
  handle: 'junn',
  bio: '서울 곳곳에서 다시 열리는 기억을 모으는 중.',
  password: 'happened-test-1',
} as const;

function toPublicUser(user: StoreUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    handle: user.handle,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  };
}

function toProfileUser(user: StoreUser): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    handle: user.handle,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  };
}

function fallbackUserFromAction(action: { actorKey?: string | null; userId?: string | null; displayName?: string | null; handle?: string | null }): PublicUser {
  if (action.userId && action.displayName && action.handle) {
    return {
      id: action.userId,
      displayName: action.displayName,
      handle: action.handle,
    };
  }

  const handle = action.actorKey?.startsWith('anon:') ? 'guest' : 'unknown';
  return {
    id: action.userId ?? action.actorKey ?? 'unknown',
    displayName: handle === 'guest' ? 'Guest' : 'Unknown user',
    handle,
  };
}

function formatRelativeLabel(value?: Date | string | null) {
  if (!value) {
    return 'just now';
  }

  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;

  if (!Number.isFinite(timestamp) || diffMs < 60_000) {
    return 'just now';
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(timestamp));
}

function buildProfile({
  profileUser,
  posts,
  savedPosts,
  followerCount,
  followingCount,
  viewer,
  isFollowing,
  isBlocked,
  blocksViewer,
  viewerActions,
}: {
  profileUser: PublicUser;
  posts: MemoryPost[];
  savedPosts: MemoryPost[];
  followerCount: number;
  followingCount: number;
  viewer: StoreUser | null;
  isFollowing: boolean;
  isBlocked: boolean;
  blocksViewer?: boolean;
  viewerActions: Array<{ postId: string; action: MemoryPostAction }>;
}): PublicProfile {
  return {
    user: profileUser,
    stats: {
      posts: posts.length,
      followers: followerCount,
      following: followingCount,
      echoes: posts.reduce((total, post) => total + post.stats.echoes, 0),
      saves: posts.reduce((total, post) => total + post.stats.saves, 0),
    },
    viewer: {
      isSelf: Boolean(viewer && viewer.id === profileUser.id),
      isFollowing,
      isBlocked,
      blocksViewer,
    },
    posts: posts.map((post) => withViewerState(post, viewerActions)),
    savedPosts: savedPosts.map((post) => withViewerState(post, viewerActions)),
  };
}

function actionMessage(action: MemoryPostAction, actorName: string, placeName?: string | null) {
  if (action === 'echo') {
    return `${actorName} echoed your memory${placeName ? ` at ${placeName}` : ''}`;
  }

  if (action === 'save') {
    return `${actorName} saved your memory${placeName ? ` at ${placeName}` : ''}`;
  }

  if (action === 'reply') {
    return `${actorName} replied to your memory${placeName ? ` at ${placeName}` : ''}`;
  }

  return `${actorName} interacted with your memory`;
}

function textMatchesQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return false;
  }

  return values.some((value) => normalize(value ?? '').includes(normalizedQuery));
}

function toTokenResponse(token: CheckInToken): CheckInToken {
  const expiresAt = token.expiresAt ? new Date(token.expiresAt) : new Date(Date.now() + 12 * 60 * 60 * 1000);
  const expiresInMs = Math.max(0, expiresAt.getTime() - Date.now());
  const expiresInHours = Math.floor(expiresInMs / 3_600_000);
  const expiresInMinutes = Math.floor((expiresInMs % 3_600_000) / 60_000);

  return {
    ...token,
    expiresInLabel: `${expiresInHours}h ${expiresInMinutes}m`,
  };
}

function clampStat(value: number) {
  return Math.max(0, value);
}

function resolveScheduledVisibility(post: MemoryPost): Visibility {
  if (post.visibility !== 'PublicAfter1h') {
    return post.visibility;
  }

  const createdAt = post.createdAt ? new Date(post.createdAt).getTime() : Number.NaN;

  if (Number.isFinite(createdAt) && Date.now() - createdAt >= 60 * 60 * 1000) {
    return 'Public';
  }

  return post.visibility;
}

function withViewerState(post: MemoryPost, actions: Array<{ postId: string; action: MemoryPostAction }>, blockedAuthorIds = new Set<string>()): MemoryPost {
  const postActions = actions.filter((action) => action.postId === post.id);

  const postWithViewerState: MemoryPost = {
    ...post,
    visibility: resolveScheduledVisibility(post),
    viewer: {
      echoed: postActions.some((action) => action.action === 'echo'),
      saved: postActions.some((action) => action.action === 'save'),
      hidden: postActions.some((action) => action.action === 'hide') || undefined,
      reported: postActions.some((action) => action.action === 'report') || undefined,
      blockedAuthor: Boolean(post.authorId && blockedAuthorIds.has(post.authorId)) || undefined,
    },
  };

  if (postWithViewerState.unlockState !== 'locked') {
    return postWithViewerState;
  }

  return {
    ...postWithViewerState,
    caption: '',
    mediaUrl: undefined,
    mediaUrls: [],
  };
}

function distanceMeters(a: UserLocation, b: { latitude: number; longitude: number }) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function createLocalRepository(store = new LocalStore()) {
  function ensureDevUser() {
    const normalizedEmail = normalize(DEV_TEST_ACCOUNT.email);
    const normalizedHandle = normalize(DEV_TEST_ACCOUNT.handle);
    const existingUser = store.data.users.find((user) => user.id === DEV_TEST_ACCOUNT.id || normalize(user.email) === normalizedEmail || normalize(user.handle) === normalizedHandle);

    if (existingUser) {
      existingUser.email = DEV_TEST_ACCOUNT.email;
      existingUser.displayName = DEV_TEST_ACCOUNT.displayName;
      existingUser.handle = DEV_TEST_ACCOUNT.handle;
      existingUser.bio = DEV_TEST_ACCOUNT.bio;
    } else {
      const passwordDigest = hashPassword(DEV_TEST_ACCOUNT.password);
      store.data.users.push({
        id: DEV_TEST_ACCOUNT.id,
        email: DEV_TEST_ACCOUNT.email,
        displayName: DEV_TEST_ACCOUNT.displayName,
        handle: DEV_TEST_ACCOUNT.handle,
        bio: DEV_TEST_ACCOUNT.bio,
        passwordHash: passwordDigest.hash,
        passwordSalt: passwordDigest.salt,
        createdAt: new Date().toISOString(),
      });
    }

    for (const post of store.data.posts) {
      if (normalizeHandle(post.authorHandle) === normalizedHandle) {
        post.authorId = DEV_TEST_ACCOUNT.id;
        post.authorName = DEV_TEST_ACCOUNT.displayName;
        post.authorHandle = `@${DEV_TEST_ACCOUNT.handle}`;
      }
    }

    store.save();
  }

  ensureDevUser();

  function getUserFromSession(sessionToken: string | null) {
    if (!sessionToken) {
      return null;
    }

    const session = store.data.sessions.find((candidate) => candidate.id === sessionToken);

    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return store.data.users.find((user) => user.id === session.userId) ?? null;
  }

  function createSession(user: StoreUser): AuthSession {
    const session = {
      id: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    store.data.sessions.push(session);
    store.save();

    return {
      token: session.id,
      expiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  }

  function registerUser({ email, displayName, handle, password }: { email: string; displayName: string; handle: string; password: string }) {
    const normalizedEmail = normalize(email);
    const normalizedHandle = handle.trim().replace(/^@/, '').toLowerCase();

    if (store.data.users.some((user) => normalize(user.email) === normalizedEmail)) {
      throw new RepositoryError('email_taken', 'Email is already registered.');
    }

    if (store.data.users.some((user) => normalize(user.handle) === normalizedHandle)) {
      throw new RepositoryError('handle_taken', 'Handle is already taken.');
    }

    const passwordDigest = hashPassword(password);
    const user: StoreUser = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName,
      handle: normalizedHandle,
      passwordHash: passwordDigest.hash,
      passwordSalt: passwordDigest.salt,
      createdAt: new Date().toISOString(),
    };

    store.data.users.push(user);
    return createSession(user);
  }

  function loginUser({ email, password }: { email: string; password: string }) {
    const user = store.data.users.find((candidate) => normalize(candidate.email) === normalize(email));

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new RepositoryError('auth_failed', 'Email or password is incorrect.');
    }

    return createSession(user);
  }

  function getSession(sessionToken: string | null) {
    const user = getUserFromSession(sessionToken);

    if (!user) {
      return null;
    }

    const session = store.data.sessions.find((candidate) => candidate.id === sessionToken);

    return {
      token: sessionToken ?? '',
      expiresAt: session?.expiresAt ?? new Date().toISOString(),
      user: toPublicUser(user),
    };
  }

  function updateProfile({
    displayName,
    handle,
    bio,
    avatarUrl,
    sessionToken,
  }: {
    displayName?: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    sessionToken?: string | null;
  }) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to update your profile.');
    }

    const nextHandle = handle ? normalizeHandle(handle) : viewer.handle;
    const nextDisplayName = displayName?.trim() || viewer.displayName;
    const existingHandleUser = store.data.users.find((user) => user.id !== viewer.id && normalize(user.handle) === nextHandle);

    if (existingHandleUser) {
      throw new RepositoryError('handle_taken', 'Handle is already taken.');
    }

    viewer.displayName = nextDisplayName;
    viewer.handle = nextHandle;
    if (bio !== undefined) {
      viewer.bio = bio.trim();
    }
    if (avatarUrl !== undefined) {
      viewer.avatarUrl = avatarUrl;
    }

    for (const post of store.data.posts) {
      if (post.authorId === viewer.id) {
        post.authorName = nextDisplayName;
        post.authorHandle = `@${nextHandle}`;
      }
    }

    store.save();

    const session = getSession(sessionToken ?? null);

    if (!session) {
      throw new RepositoryError('auth_failed', 'Session is missing or expired.');
    }

    return {
      session,
      profile: getProfile(viewer.handle, sessionToken),
      message: 'Profile updated',
    };
  }

  function getActorKey(user: StoreUser | null, sessionToken?: string | null) {
    if (user) {
      return `user:${user.id}`;
    }

    return `anon:${sessionToken || 'public-preview'}`;
  }

  function getBlockedAuthorIds(viewer: StoreUser | null) {
    if (!viewer) {
      return new Set<string>();
    }

    return new Set(store.data.blocks.filter((block) => block.blockerId === viewer.id).map((block) => block.blockedId));
  }

  function getMutedAuthorIds(viewer: StoreUser | null) {
    if (!viewer) {
      return new Set<string>();
    }

    return new Set(
      store.data.blocks
        .filter((block) => block.blockerId === viewer.id || block.blockedId === viewer.id)
        .map((block) => (block.blockerId === viewer.id ? block.blockedId : block.blockerId)),
    );
  }

  function getBlockState(viewer: StoreUser | null, targetUserId: string) {
    return {
      isBlocked: Boolean(viewer && store.data.blocks.some((block) => block.blockerId === viewer.id && block.blockedId === targetUserId)),
      blocksViewer: Boolean(viewer && store.data.blocks.some((block) => block.blockerId === targetUserId && block.blockedId === viewer.id)),
    };
  }

  function toConnectionUser(user: StoreUser, viewer: StoreUser | null): UserConnection {
    return {
      ...toProfileUser(user),
      viewer: {
        isSelf: Boolean(viewer && viewer.id === user.id),
        isFollowing: Boolean(viewer && store.data.follows.some((follow) => follow.followerId === viewer.id && follow.followingId === user.id)),
        isBlocked: Boolean(viewer && store.data.blocks.some((block) => block.blockerId === viewer.id && block.blockedId === user.id)),
      },
    };
  }

  function getFeed(mode?: FeedMode, sessionToken?: string | null) {
    const user = getUserFromSession(sessionToken ?? null);
    const actorKey = getActorKey(user, sessionToken);
    const viewerActions = store.data.postActions.filter((action) => action.actorKey === actorKey);
    const hiddenPostIds = new Set(viewerActions.filter((action) => action.action === 'hide').map((action) => action.postId));
    const blockedAuthorIds = getBlockedAuthorIds(user);
    const mutedAuthorIds = getMutedAuthorIds(user);
    const posts = mode && mode !== 'Following'
      ? store.data.posts.filter((post) => post.mode === mode)
      : store.data.posts;

    return posts
      .filter((post) => !hiddenPostIds.has(post.id))
      .filter((post) => !post.authorId || !mutedAuthorIds.has(post.authorId))
      .map((post) => withViewerState(post, viewerActions, blockedAuthorIds));
  }

  function updatePostAction({
    postId,
    action,
    body,
    sessionToken,
  }: {
    postId: string;
    action: MemoryPostAction;
    body?: string;
    sessionToken?: string | null;
  }) {
    const post = store.data.posts.find((candidate) => candidate.id === postId);

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const user = getUserFromSession(sessionToken ?? null);
    const actorKey = getActorKey(user, sessionToken);
    const createdAt = new Date().toISOString();
    let message = 'Updated.';

    if (action === 'echo' || action === 'save') {
      const existingIndex = store.data.postActions.findIndex(
        (candidate) => candidate.postId === postId && candidate.actorKey === actorKey && candidate.action === action,
      );
      const statKey = action === 'echo' ? 'echoes' : 'saves';

      if (existingIndex >= 0) {
        store.data.postActions.splice(existingIndex, 1);
        post.stats[statKey] = clampStat(post.stats[statKey] - 1);
        message = action === 'echo' ? 'Echo removed' : 'Removed from saved';
      } else {
        store.data.postActions.push({
          id: randomUUID(),
          postId,
          userId: user?.id ?? null,
          actorKey,
          action,
          createdAt,
        });
        post.stats[statKey] += 1;
        message = action === 'echo' ? 'Echo saved' : 'Saved to your roll';
      }
    } else if (action === 'reply') {
      store.data.postActions.push({
        id: randomUUID(),
        postId,
        userId: user?.id ?? null,
        actorKey,
        action,
        body,
        createdAt,
      });
      post.stats.replies += 1;
      message = 'Reply posted';
    } else {
      const existing = store.data.postActions.find(
        (candidate) => candidate.postId === postId && candidate.actorKey === actorKey && candidate.action === action,
      );

      if (!existing) {
        store.data.postActions.push({
          id: randomUUID(),
          postId,
          userId: user?.id ?? null,
          actorKey,
          action,
          body,
          createdAt,
        });
      }

      message = action === 'hide' ? 'Post hidden from this session' : 'Report saved for review';
    }

    store.save();

    return {
      post: withViewerState(post, store.data.postActions.filter((candidate) => candidate.actorKey === actorKey)),
      echoed: store.data.postActions.some((candidate) => candidate.postId === postId && candidate.actorKey === actorKey && candidate.action === 'echo'),
      saved: store.data.postActions.some((candidate) => candidate.postId === postId && candidate.actorKey === actorKey && candidate.action === 'save'),
      message,
    };
  }

  function getPlaces() {
    return store.data.places.map((bubble) => {
      const detailName = bubble.placeName ?? bubble.name;
      const relatedPosts = store.data.posts.filter((post) => placeNameMatches(post.placeName, detailName));

      return {
        ...bubble,
        memoryCount: relatedPosts.length,
        openCount: relatedPosts.filter((post) => post.unlockState === 'open').length,
        lockedCount: relatedPosts.filter((post) => post.unlockState === 'locked').length,
      };
    });
  }

  function getPlace(placeKey: string) {
    const key = normalize(placeKey);
    const bubble = store.data.places.find((candidate) => normalize(candidate.id) === key || normalize(candidate.name) === key || normalize(candidate.placeName ?? '') === key);
    const displayName = bubble?.placeName ?? bubble?.name ?? placeKey;
    const relatedPosts = store.data.posts.filter((post) => placeNameMatches(post.placeName, displayName));
    const relatedTimeline: TimelineMonth[] = store.data.timelineMonths.filter((month) => placeNameMatches(month.placeName, displayName));
    const primaryPost = relatedPosts[0];

    if (!bubble && !primaryPost && relatedPosts.length === 0) {
      throw new RepositoryError('place_not_found', `No place matched "${placeKey}".`);
    }

    return {
      place: {
        id: bubble?.id ?? slugify(primaryPost?.placeName ?? displayName),
        name: primaryPost?.placeName ?? displayName,
        city: bubble?.city ?? primaryPost?.city ?? 'Seoul',
        subtitle: bubble?.subtitle ?? `${relatedPosts.length} memories`,
        coordinates: bubble?.coordinates,
        unlocked: bubble?.unlocked ?? primaryPost?.unlockState === 'open',
        unlockRadiusMeters: bubble?.unlockRadiusMeters ?? primaryPost?.unlockRadiusMeters ?? 200,
        uploadRadiusMeters: bubble?.uploadRadiusMeters ?? 120,
        memoryCount: relatedPosts.length,
      },
      posts: relatedPosts,
      timeline: relatedTimeline,
    };
  }

  function getTimeline() {
    return store.data.timelineMonths;
  }

  function issueCheckIn({ placeName, distanceMeters: suppliedDistance, location, sessionToken }: { placeName: string; distanceMeters?: number; location?: UserLocation; sessionToken?: string | null }) {
    const user = getUserFromSession(sessionToken ?? null);
    const place = getPlace(placeName);
    const uploadRadiusMeters = place.place.uploadRadiusMeters ?? 120;
    const unlockRadiusMeters = place.place.unlockRadiusMeters ?? 200;
    let currentDistance = suppliedDistance ?? 0;

    if (location && place.place.coordinates && process.env.HAPPENED_DEV_LOCATION_OVERRIDE === '0') {
      currentDistance = distanceMeters(location, place.place.coordinates);
    }

    if (location?.accuracyMeters && location.accuracyMeters > 50 && process.env.HAPPENED_DEV_LOCATION_OVERRIDE === '0') {
      throw new RepositoryError('location_accuracy_low', `Location accuracy is ${Math.round(location.accuracyMeters)}m; check-in requires 50m or better.`);
    }

    if (currentDistance > uploadRadiusMeters) {
      throw new RepositoryError(
        'outside_radius',
        `Current distance is ${currentDistance}m, outside the ${uploadRadiusMeters}m upload radius.`,
      );
    }

    const issuedAt = new Date();
    const token: CheckInToken & { userId?: string | null } = {
      id: randomUUID(),
      placeName: place.place.name,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      issuedAtLabel: 'just now',
      expiresInLabel: '12h 0m',
      uploadsRemaining: 3,
      unlockRadiusMeters,
      userId: user?.id ?? null,
    };

    store.data.checkInTokens.push(token);
    store.save();

    return toTokenResponse(token);
  }

  function createMemory({
    checkInTokenId,
    caption,
    visibility,
    mediaUrl,
    mediaUrls,
    sessionToken,
  }: {
    checkInTokenId: string;
    caption: string;
    visibility: Visibility;
    mediaUrl?: string;
    mediaUrls?: string[];
    sessionToken?: string | null;
  }) {
    const token = store.data.checkInTokens.find((candidate) => candidate.id === checkInTokenId);

    if (!token) {
      throw new RepositoryError('token_not_found', 'Check-in token was not found.');
    }

    if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
      throw new RepositoryError('token_expired', 'Check-in token has expired.');
    }

    if (token.uploadsRemaining <= 0) {
      throw new RepositoryError('token_spent', 'Check-in token has no uploads remaining.');
    }

    const user = getUserFromSession(sessionToken ?? null);
    token.uploadsRemaining -= 1;

    const now = new Date();
    const memory: MemoryPost = {
      id: `memory-${randomUUID()}`,
      mode: 'Memories',
      authorId: user?.id,
      authorName: user?.displayName ?? 'You',
      authorHandle: user ? `@${user.handle}` : '@you',
      placeName: token.placeName,
      city: 'Seoul',
      distanceMeters: 0,
      unlockRadiusMeters: token.unlockRadiusMeters ?? 200,
      unlockState: 'open',
      visibility,
      createdAt: now.toISOString(),
      caption,
      timeLabel: 'just now',
      filmStamp: `${formatFilmStamp(now)} / CHECK-IN`,
      recallLabel: 'Saved at this place',
      mediaUrl,
      mediaUrls: mediaUrls?.length ? mediaUrls : mediaUrl ? [mediaUrl] : [],
      mediaColors: ['#07151A', '#2B5B61', '#C7F95B'],
      accentColor: colors.lime,
      stats: { echoes: 0, replies: 0, saves: 0 },
    };

    store.data.posts.unshift(memory);
    store.save();

    return {
      memory,
      checkInToken: toTokenResponse(token),
    };
  }

  function updateMemoryPost({
    postId,
    caption,
    visibility,
    sessionToken,
  }: {
    postId: string;
    caption?: string;
    visibility?: Visibility;
    sessionToken?: string | null;
  }) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to edit posts.');
    }

    const post = store.data.posts.find((candidate) => candidate.id === postId);

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    if (post.authorId !== viewer.id) {
      throw new RepositoryError('post_owner_required', 'You can only edit your own posts.');
    }

    if (caption !== undefined) {
      post.caption = caption;
    }
    if (visibility !== undefined) {
      post.visibility = visibility;
    }

    store.save();

    return {
      post: withViewerState(post, viewerActionsFor(viewer, sessionToken)),
      message: 'Post updated',
    };
  }

  function deleteMemoryPost(postId: string, sessionToken?: string | null) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to delete posts.');
    }

    const postIndex = store.data.posts.findIndex((candidate) => candidate.id === postId);
    const post = store.data.posts[postIndex];

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    if (post.authorId !== viewer.id) {
      throw new RepositoryError('post_owner_required', 'You can only delete your own posts.');
    }

    store.data.posts.splice(postIndex, 1);
    store.data.postActions = store.data.postActions.filter((action) => action.postId !== postId);
    store.save();

    return {
      postId,
      message: 'Post deleted',
    };
  }

  function findProfileUser(handleOrId: string) {
    const key = normalizeHandle(handleOrId);
    return store.data.users.find((candidate) => normalize(candidate.id) === normalize(handleOrId) || normalize(candidate.handle) === key) ?? null;
  }

  function viewerActionsFor(user: StoreUser | null, sessionToken?: string | null) {
    const actorKey = getActorKey(user, sessionToken);
    return store.data.postActions
      .filter((action) => action.actorKey === actorKey)
      .map((action) => ({
        postId: action.postId,
        action: action.action,
      }));
  }

  function getProfile(handleOrId: string, sessionToken?: string | null) {
    const viewer = getUserFromSession(sessionToken ?? null);
    const profileUser = findProfileUser(handleOrId);
    const key = normalizeHandle(handleOrId);
    const viewerActions = viewerActionsFor(viewer, sessionToken);

    if (profileUser) {
      const blockState = getBlockState(viewer, profileUser.id);
      const hideProfilePosts = blockState.isBlocked || blockState.blocksViewer;
      const posts = store.data.posts.filter((post) => post.authorId === profileUser.id || normalizeHandle(post.authorHandle) === normalize(profileUser.handle));
      const savedIds = new Set(
        viewer?.id === profileUser.id
          ? store.data.postActions
              .filter((action) => action.actorKey === getActorKey(profileUser, sessionToken) && action.action === 'save')
              .map((action) => action.postId)
          : [],
      );
      const savedPosts = store.data.posts.filter((post) => savedIds.has(post.id));

      return buildProfile({
        profileUser: toProfileUser(profileUser),
        posts: hideProfilePosts ? [] : posts,
        savedPosts: hideProfilePosts ? [] : savedPosts,
        followerCount: store.data.follows.filter((follow) => follow.followingId === profileUser.id).length,
        followingCount: store.data.follows.filter((follow) => follow.followerId === profileUser.id).length,
        viewer,
        isFollowing: Boolean(viewer && store.data.follows.some((follow) => follow.followerId === viewer.id && follow.followingId === profileUser.id)),
        ...blockState,
        viewerActions,
      });
    }

    const authoredPosts = store.data.posts.filter((post) => normalizeHandle(post.authorHandle) === key);
    const firstPost = authoredPosts[0];

    if (!firstPost) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    return buildProfile({
      profileUser: {
        id: `seed:${key}`,
        displayName: firstPost.authorName,
        handle: key,
      },
      posts: authoredPosts,
      savedPosts: [],
      followerCount: 0,
      followingCount: 0,
      viewer,
      isFollowing: false,
      isBlocked: false,
      blocksViewer: false,
      viewerActions,
    });
  }

  function getConnections(handleOrId: string, sessionToken?: string | null): UserConnections {
    const viewer = getUserFromSession(sessionToken ?? null);
    const profileUser = findProfileUser(handleOrId);

    if (!profileUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    const blockState = getBlockState(viewer, profileUser.id);
    if (blockState.isBlocked || blockState.blocksViewer) {
      return {
        followers: [],
        following: [],
      };
    }

    const mutedAuthorIds = getMutedAuthorIds(viewer);
    const usersById = new Map(store.data.users.map((user) => [user.id, user]));
    const visibleConnection = (user: StoreUser | undefined): user is StoreUser => Boolean(user && !mutedAuthorIds.has(user.id));
    const followers = store.data.follows
      .filter((follow) => follow.followingId === profileUser.id)
      .map((follow) => usersById.get(follow.followerId))
      .filter(visibleConnection)
      .map((user) => toConnectionUser(user, viewer));
    const following = store.data.follows
      .filter((follow) => follow.followerId === profileUser.id)
      .map((follow) => usersById.get(follow.followingId))
      .filter(visibleConnection)
      .map((user) => toConnectionUser(user, viewer));

    return { followers, following };
  }

  function toggleFollow(handleOrId: string, sessionToken?: string | null) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to follow people.');
    }

    const targetUser = findProfileUser(handleOrId);

    if (!targetUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    if (targetUser.id === viewer.id) {
      throw new RepositoryError('follow_self', 'You cannot follow yourself.');
    }

    const existingIndex = store.data.follows.findIndex((follow) => follow.followerId === viewer.id && follow.followingId === targetUser.id);
    const following = existingIndex < 0;

    if (existingIndex >= 0) {
      store.data.follows.splice(existingIndex, 1);
    } else {
      store.data.follows.push({
        followerId: viewer.id,
        followingId: targetUser.id,
        createdAt: new Date().toISOString(),
      });
    }

    store.save();

    return {
      profile: getProfile(targetUser.handle, sessionToken),
      following,
      message: following ? `Following ${targetUser.displayName}` : `Unfollowed ${targetUser.displayName}`,
    };
  }

  function toggleBlock(handleOrId: string, sessionToken?: string | null) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to block people.');
    }

    const targetUser = findProfileUser(handleOrId);

    if (!targetUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    if (targetUser.id === viewer.id) {
      throw new RepositoryError('block_self', 'You cannot block yourself.');
    }

    const existingIndex = store.data.blocks.findIndex((block) => block.blockerId === viewer.id && block.blockedId === targetUser.id);
    const blocked = existingIndex < 0;

    if (existingIndex >= 0) {
      store.data.blocks.splice(existingIndex, 1);
    } else {
      store.data.blocks.push({
        blockerId: viewer.id,
        blockedId: targetUser.id,
        createdAt: new Date().toISOString(),
      });
      store.data.follows = store.data.follows.filter(
        (follow) =>
          !(
            (follow.followerId === viewer.id && follow.followingId === targetUser.id) ||
            (follow.followerId === targetUser.id && follow.followingId === viewer.id)
          ),
      );
    }

    store.save();

    return {
      profile: getProfile(targetUser.handle, sessionToken),
      blocked,
      message: blocked ? `Blocked ${targetUser.displayName}` : `Unblocked ${targetUser.displayName}`,
    };
  }

  function getSafetySummary(sessionToken?: string | null): SafetySummary {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to view safety settings.');
    }

    const actorKey = getActorKey(viewer, sessionToken);

    return {
      blockedCount: store.data.blocks.filter((block) => block.blockerId === viewer.id).length,
      hiddenCount: store.data.postActions.filter((action) => action.actorKey === actorKey && action.action === 'hide').length,
      reportedCount: store.data.postActions.filter((action) => action.actorKey === actorKey && action.action === 'report').length,
      notificationsEnabled: true,
      accountDeletionState: 'By request',
    };
  }

  function searchContent(query: string, sessionToken?: string | null): SearchResults {
    const viewer = getUserFromSession(sessionToken ?? null);
    const actorKey = getActorKey(viewer, sessionToken);
    const viewerActions = store.data.postActions.filter((action) => action.actorKey === actorKey);
    const hiddenPostIds = new Set(viewerActions.filter((action) => action.action === 'hide').map((action) => action.postId));
    const blockedAuthorIds = getBlockedAuthorIds(viewer);
    const mutedAuthorIds = getMutedAuthorIds(viewer);
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return { users: [], places: [], posts: [] };
    }

    const users = store.data.users
      .filter((user) => !mutedAuthorIds.has(user.id))
      .filter((user) => textMatchesQuery(normalizedQuery, [user.displayName, user.handle]))
      .slice(0, 10)
      .map(toProfileUser);

    const places = store.data.places
      .filter((place) => textMatchesQuery(normalizedQuery, [place.name, place.placeName, place.city, place.subtitle]))
      .slice(0, 10);

    const posts = store.data.posts
      .filter((post) => !hiddenPostIds.has(post.id))
      .filter((post) => !post.authorId || !mutedAuthorIds.has(post.authorId))
      .filter((post) => textMatchesQuery(normalizedQuery, [post.authorName, post.authorHandle, post.placeName, post.city, post.caption]))
      .slice(0, 24)
      .map((post) => withViewerState(post, viewerActions, blockedAuthorIds));

    return { users, places, posts };
  }

  function applyNotificationReadState(viewer: StoreUser, notifications: NotificationItem[]): NotificationItem[] {
    const readIds = new Set(store.data.notificationReads.filter((read) => read.userId === viewer.id).map((read) => read.notificationId));

    return notifications.map((notification) => ({
      ...notification,
      read: readIds.has(notification.id),
    }));
  }

  function getPostComments(postId: string, viewer: StoreUser | null, post: MemoryPost): PostComment[] {
    return store.data.postActions
      .filter((action) => action.postId === postId && action.action === 'reply' && action.body)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((action) => {
        const author = action.userId ? store.data.users.find((candidate) => candidate.id === action.userId) : null;
        return {
          id: action.id,
          postId,
          body: action.body ?? '',
          createdAt: action.createdAt,
          createdAtLabel: formatRelativeLabel(action.createdAt),
          author: author ? toProfileUser(author) : fallbackUserFromAction({ actorKey: action.actorKey, userId: action.userId }),
          canDelete: Boolean(viewer && (action.userId === viewer.id || post.authorId === viewer.id)),
        };
      });
  }

  function getPostDetail(postId: string, sessionToken?: string | null) {
    const post = store.data.posts.find((candidate) => candidate.id === postId);

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const viewer = getUserFromSession(sessionToken ?? null);
    const viewerActions = viewerActionsFor(viewer, sessionToken);

    const protectedPost = withViewerState(post, viewerActions);

    return {
      post: protectedPost,
      comments: protectedPost.unlockState === 'locked' ? [] : getPostComments(postId, viewer, post),
    };
  }

  function deleteComment({ postId, commentId, sessionToken }: { postId: string; commentId: string; sessionToken?: string | null }) {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to delete replies.');
    }

    const post = store.data.posts.find((candidate) => candidate.id === postId);

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const index = store.data.postActions.findIndex((action) => action.id === commentId && action.postId === postId && action.action === 'reply');
    const comment = store.data.postActions[index];

    if (!comment) {
      throw new RepositoryError('comment_not_found', 'Reply was not found.');
    }

    if (comment.userId !== viewer.id && post.authorId !== viewer.id) {
      throw new RepositoryError('auth_failed', 'You can only delete your own replies.');
    }

    store.data.postActions.splice(index, 1);
    post.stats.replies = clampStat(post.stats.replies - 1);
    store.save();

    return getPostDetail(postId, sessionToken);
  }

  function getNotifications(sessionToken?: string | null): NotificationItem[] {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      return [];
    }

    const ownPostIds = new Set(store.data.posts.filter((post) => post.authorId === viewer.id).map((post) => post.id));
    const mutedAuthorIds = getMutedAuthorIds(viewer);
    const actionNotifications = store.data.postActions
      .filter((action) => ownPostIds.has(action.postId) && action.userId !== viewer.id && ['echo', 'save', 'reply'].includes(action.action))
      .filter((action) => !action.userId || !mutedAuthorIds.has(action.userId))
      .map((action) => {
        const post = store.data.posts.find((candidate) => candidate.id === action.postId);
        const actor = action.userId ? store.data.users.find((user) => user.id === action.userId) : null;
        const publicActor = actor ? toProfileUser(actor) : fallbackUserFromAction({ actorKey: action.actorKey, userId: action.userId });
        return {
          id: action.id,
          type: action.action as NotificationItem['type'],
          actor: publicActor,
          postId: action.postId,
          body: action.body,
          createdAt: action.createdAt,
          createdAtLabel: formatRelativeLabel(action.createdAt),
          message: actionMessage(action.action, publicActor.displayName, post?.placeName),
          read: false,
        };
      });

    const followNotifications = store.data.follows
      .filter((follow) => follow.followingId === viewer.id)
      .filter((follow) => !mutedAuthorIds.has(follow.followerId))
      .map((follow) => {
        const actor = store.data.users.find((user) => user.id === follow.followerId);
        const publicActor = actor ? toProfileUser(actor) : fallbackUserFromAction({ userId: follow.followerId });
        return {
          id: `follow:${follow.followerId}:${follow.followingId}`,
          type: 'follow' as const,
          actor: publicActor,
          createdAt: follow.createdAt,
          createdAtLabel: formatRelativeLabel(follow.createdAt),
          message: `${publicActor.displayName} started following you`,
          read: false,
        };
      });

    return applyNotificationReadState(viewer, [...actionNotifications, ...followNotifications])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
  }

  function markNotificationsRead(sessionToken?: string | null, notificationIds?: string[]): NotificationItem[] {
    const viewer = getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to update notifications.');
    }

    const visibleNotifications = getNotifications(sessionToken);
    const visibleIds = new Set(visibleNotifications.map((notification) => notification.id));
    const targetIds = notificationIds?.length ? notificationIds.filter((id) => visibleIds.has(id)) : [...visibleIds];
    const now = new Date().toISOString();

    for (const notificationId of targetIds) {
      const existing = store.data.notificationReads.find((read) => read.userId === viewer.id && read.notificationId === notificationId);
      if (!existing) {
        store.data.notificationReads.push({
          userId: viewer.id,
          notificationId,
          readAt: now,
        });
      }
    }

    store.save();

    return getNotifications(sessionToken);
  }

  return {
    registerUser,
    loginUser,
    getSession,
    updateProfile,
    getFeed,
    searchContent,
    updatePostAction,
    updateMemoryPost,
    deleteMemoryPost,
    getProfile,
    getConnections,
    toggleFollow,
    toggleBlock,
    getPostDetail,
    deleteComment,
    getNotifications,
    markNotificationsRead,
    getSafetySummary,
    getPlaces,
    getPlace,
    getTimeline,
    issueCheckIn,
    createMemory,
  };
}

type DbUserRow = {
  id: string;
  email: string;
  display_name: string;
  handle: string;
  bio?: string;
  avatar_url?: string | null;
  password_hash: string;
  password_salt: string;
  created_at: Date | string;
};

type DbPlaceRow = {
  id: string;
  name: string;
  city: string;
  subtitle: string;
  lat: number;
  lng: number;
  map_x: number;
  map_y: number;
  intensity: number;
  unlocked: boolean;
  unlock_radius_meters: number;
  upload_radius_meters: number;
};

type DbPostRow = {
  id: string;
  mode: FeedMode;
  user_id: string | null;
  author_name: string;
  author_handle: string;
  place_id: string | null;
  place_name: string;
  city: string;
  distance_meters: number;
  unlock_radius_meters: number;
  unlock_state: MemoryPost['unlockState'];
  visibility: Visibility;
  created_at: Date | string;
  caption: string;
  time_label: string;
  film_stamp: string;
  recall_label: string | null;
  media_colors: MemoryPost['mediaColors'];
  media_url: string | null;
  media_urls?: string[] | null;
  accent_color: string;
  stats: MemoryPost['stats'];
};

type DbTokenRow = {
  id: string;
  user_id: string | null;
  place_id: string | null;
  place_name: string;
  issued_at: Date | string;
  expires_at: Date | string;
  uploads_remaining: number;
  unlock_radius_meters: number;
};

type DbPostActionRow = {
  id?: string;
  post_id: string;
  user_id?: string | null;
  actor_key?: string;
  action: MemoryPostAction;
  body?: string | null;
  created_at?: Date | string;
  display_name?: string | null;
  handle?: string | null;
};

function rowToUser(row: DbUserRow): StoreUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function rowToPlace(row: DbPlaceRow): PlaceBubble {
  return {
    id: row.id,
    name: row.name,
    placeName: row.name,
    city: row.city,
    subtitle: row.subtitle,
    coordinates: { latitude: row.lat, longitude: row.lng },
    x: row.map_x,
    y: row.map_y,
    intensity: row.intensity,
    unlocked: row.unlocked,
    unlockRadiusMeters: row.unlock_radius_meters,
    uploadRadiusMeters: row.upload_radius_meters,
  };
}

function rowToPost(row: DbPostRow): MemoryPost {
  return {
    id: row.id,
    mode: row.mode,
    authorId: row.user_id ?? undefined,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    placeId: row.place_id ?? undefined,
    placeName: row.place_name,
    city: row.city,
    distanceMeters: row.distance_meters,
    unlockRadiusMeters: row.unlock_radius_meters,
    unlockState: row.unlock_state,
    visibility: row.visibility,
    createdAt: new Date(row.created_at).toISOString(),
    caption: row.caption,
    timeLabel: row.time_label,
    filmStamp: row.film_stamp,
    recallLabel: row.recall_label ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaUrls: Array.isArray(row.media_urls) && row.media_urls.length ? row.media_urls : row.media_url ? [row.media_url] : [],
    mediaColors: row.media_colors,
    accentColor: row.accent_color,
    stats: row.stats,
  };
}

function rowToToken(row: DbTokenRow): CheckInToken {
  return toTokenResponse({
    id: row.id,
    placeName: row.place_name,
    issuedAt: new Date(row.issued_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    issuedAtLabel: 'just now',
    expiresInLabel: '12h 0m',
    uploadsRemaining: row.uploads_remaining,
    unlockRadiusMeters: row.unlock_radius_meters,
  });
}

async function ensurePostgresSeed(databaseUrl: string) {
  const passwordDigest = hashPassword(DEV_TEST_ACCOUNT.password);

  await queryDatabase(databaseUrl, `
    delete from memory_posts
    where caption ilike '%QA%'
       or lower(author_handle) = '@tester'
       or lower(author_handle) like '@qa%'
       or lower(author_handle) like '@viewer%'
  `);
  await queryDatabase(databaseUrl, `
    delete from users
    where email like '%@happened.test'
       or handle ~ '^(qa|viewer|qaedit)[0-9]+$'
  `);

  await queryDatabase(databaseUrl, `
    insert into users (id, email, display_name, handle, bio, password_hash, password_salt)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (email) do update
      set display_name = excluded.display_name,
          handle = excluded.handle,
          bio = excluded.bio
  `, [
    DEV_TEST_ACCOUNT.id,
    DEV_TEST_ACCOUNT.email,
    DEV_TEST_ACCOUNT.displayName,
    DEV_TEST_ACCOUNT.handle,
    DEV_TEST_ACCOUNT.bio,
    passwordDigest.hash,
    passwordDigest.salt,
  ]);

  const existingPlaces = await queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from places');

  if (Number(existingPlaces.rows[0]?.count ?? 0) === 0) {
    for (const place of placeBubbles) {
      await queryDatabase(databaseUrl, `
        insert into places (id, name, city, subtitle, lat, lng, map_x, map_y, intensity, unlocked, unlock_radius_meters, upload_radius_meters)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        place.id,
        place.placeName ?? place.name,
        place.city ?? 'Seoul',
        place.subtitle,
        place.coordinates?.latitude ?? 37.5047,
        place.coordinates?.longitude ?? 127.0491,
        place.x,
        place.y,
        place.intensity,
        place.unlocked,
        place.unlockRadiusMeters ?? 200,
        place.uploadRadiusMeters ?? 120,
      ]);
    }
  }

  const existingPosts = await queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from memory_posts');

  if (Number(existingPosts.rows[0]?.count ?? 0) === 0) {
    for (const post of memoryPosts) {
      const place = placeBubbles.find((candidate) => (candidate.placeName ?? candidate.name) === post.placeName);
      await queryDatabase(databaseUrl, `
        insert into memory_posts (
          id, mode, user_id, author_name, author_handle, place_id, place_name, city,
          distance_meters, unlock_radius_meters, unlock_state, visibility, caption,
          time_label, film_stamp, recall_label, media_colors, media_url, media_urls, accent_color, stats
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19::jsonb, $20, $21::jsonb)
      `, [
        post.id,
        post.mode,
        normalizeHandle(post.authorHandle) === DEV_TEST_ACCOUNT.handle ? DEV_TEST_ACCOUNT.id : null,
        post.authorName,
        post.authorHandle,
        place?.id ?? null,
        post.placeName,
        post.city,
        post.distanceMeters,
        post.unlockRadiusMeters,
        post.unlockState,
        post.visibility,
        post.caption,
        post.timeLabel,
        post.filmStamp,
        post.recallLabel ?? null,
        JSON.stringify(post.mediaColors),
        post.mediaUrl ?? null,
        JSON.stringify(post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : []),
        post.accentColor,
        JSON.stringify(post.stats),
      ]);
    }
  }

  await queryDatabase(databaseUrl, `
    update memory_posts
    set user_id = $1,
        author_name = $2,
        author_handle = $3
    where lower(replace(author_handle, '@', '')) = $4
  `, [DEV_TEST_ACCOUNT.id, DEV_TEST_ACCOUNT.displayName, `@${DEV_TEST_ACCOUNT.handle}`, DEV_TEST_ACCOUNT.handle]);

  const existingTimeline = await queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from timeline_months');

  if (Number(existingTimeline.rows[0]?.count ?? 0) === 0) {
    for (const month of timelineMonths) {
      await queryDatabase(databaseUrl, 'insert into timeline_months (id, title, place_name) values ($1, $2, $3)', [
        month.id,
        month.title,
        month.placeName,
      ]);

      for (const [index, item] of month.items.entries()) {
        await queryDatabase(databaseUrl, `
          insert into timeline_items (id, month_id, title, meta, unlocked, sort_order)
          values ($1, $2, $3, $4, $5, $6)
        `, [item.id, month.id, item.title, item.meta, item.unlocked, index]);
      }
    }
  }
}

function createPostgresRepository(databaseUrl: string) {
  async function getUserFromSession(sessionToken: string | null) {
    if (!sessionToken) {
      return null;
    }

    const result = await queryDatabase<DbUserRow>(databaseUrl, `
      select users.*
      from sessions
      join users on users.id = sessions.user_id
      where sessions.id = $1 and sessions.expires_at > now()
    `, [sessionToken]);

    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async function createSession(user: StoreUser): Promise<AuthSession> {
    const session = {
      id: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await queryDatabase(databaseUrl, 'insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [
      session.id,
      session.userId,
      session.expiresAt,
    ]);

    return {
      token: session.id,
      expiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  }

  async function getBlockedAuthorIds(viewer: StoreUser | null) {
    if (!viewer) {
      return new Set<string>();
    }

    const result = await queryDatabase<{ blocked_id: string }>(databaseUrl, 'select blocked_id from user_blocks where blocker_id = $1', [viewer.id]);
    return new Set(result.rows.map((row) => row.blocked_id));
  }

  async function getMutedAuthorIds(viewer: StoreUser | null) {
    if (!viewer) {
      return new Set<string>();
    }

    const result = await queryDatabase<{ user_id: string }>(databaseUrl, `
      select blocked_id as user_id from user_blocks where blocker_id = $1
      union
      select blocker_id as user_id from user_blocks where blocked_id = $1
    `, [viewer.id]);

    return new Set(result.rows.map((row) => row.user_id));
  }

  async function getBlockState(viewer: StoreUser | null, targetUserId: string) {
    if (!viewer) {
      return {
        isBlocked: false,
        blocksViewer: false,
      };
    }

    const result = await queryDatabase<{ blocker_id: string; blocked_id: string }>(databaseUrl, `
      select blocker_id, blocked_id
      from user_blocks
      where (blocker_id = $1 and blocked_id = $2)
         or (blocker_id = $2 and blocked_id = $1)
    `, [viewer.id, targetUserId]);

    return {
      isBlocked: result.rows.some((block) => block.blocker_id === viewer.id && block.blocked_id === targetUserId),
      blocksViewer: result.rows.some((block) => block.blocker_id === targetUserId && block.blocked_id === viewer.id),
    };
  }

  async function getViewerConnectionSets(viewer: StoreUser | null) {
    if (!viewer) {
      return {
        followingIds: new Set<string>(),
        blockedIds: new Set<string>(),
      };
    }

    const [followingResult, blockedResult] = await Promise.all([
      queryDatabase<{ following_id: string }>(databaseUrl, 'select following_id from follows where follower_id = $1', [viewer.id]),
      queryDatabase<{ blocked_id: string }>(databaseUrl, 'select blocked_id from user_blocks where blocker_id = $1', [viewer.id]),
    ]);

    return {
      followingIds: new Set(followingResult.rows.map((row) => row.following_id)),
      blockedIds: new Set(blockedResult.rows.map((row) => row.blocked_id)),
    };
  }

  function toConnectionUser(user: StoreUser, viewer: StoreUser | null, sets: { followingIds: Set<string>; blockedIds: Set<string> }): UserConnection {
    return {
      ...toProfileUser(user),
      viewer: {
        isSelf: Boolean(viewer && viewer.id === user.id),
        isFollowing: sets.followingIds.has(user.id),
        isBlocked: sets.blockedIds.has(user.id),
      },
    };
  }

  async function registerUser({ email, displayName, handle, password }: { email: string; displayName: string; handle: string; password: string }) {
    const normalizedEmail = normalize(email);
    const normalizedHandle = handle.trim().replace(/^@/, '').toLowerCase();
    const existing = await queryDatabase<{ email: string; handle: string }>(databaseUrl, 'select email, handle from users where email = $1 or handle = $2', [
      normalizedEmail,
      normalizedHandle,
    ]);

    if (existing.rows.some((user) => normalize(user.email) === normalizedEmail)) {
      throw new RepositoryError('email_taken', 'Email is already registered.');
    }

    if (existing.rows.some((user) => normalize(user.handle) === normalizedHandle)) {
      throw new RepositoryError('handle_taken', 'Handle is already taken.');
    }

    const passwordDigest = hashPassword(password);
    const user: StoreUser = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName,
      handle: normalizedHandle,
      passwordHash: passwordDigest.hash,
      passwordSalt: passwordDigest.salt,
      createdAt: new Date().toISOString(),
    };

    await queryDatabase(databaseUrl, `
      insert into users (id, email, display_name, handle, password_hash, password_salt, created_at)
      values ($1, $2, $3, $4, $5, $6, $7)
    `, [user.id, user.email, user.displayName, user.handle, user.passwordHash, user.passwordSalt, user.createdAt]);

    return createSession(user);
  }

  async function loginUser({ email, password }: { email: string; password: string }) {
    const result = await queryDatabase<DbUserRow>(databaseUrl, 'select * from users where email = $1', [normalize(email)]);
    const row = result.rows[0];

    if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
      throw new RepositoryError('auth_failed', 'Email or password is incorrect.');
    }

    return createSession(rowToUser(row));
  }

  async function getSession(sessionToken: string | null) {
    const user = await getUserFromSession(sessionToken);

    if (!user) {
      return null;
    }

    const result = await queryDatabase<{ expires_at: Date | string }>(databaseUrl, 'select expires_at from sessions where id = $1', [sessionToken]);

    return {
      token: sessionToken ?? '',
      expiresAt: new Date(result.rows[0]?.expires_at ?? new Date()).toISOString(),
      user: toPublicUser(user),
    };
  }

  async function updateProfile({
    displayName,
    handle,
    bio,
    avatarUrl,
    sessionToken,
  }: {
    displayName?: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    sessionToken?: string | null;
  }) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to update your profile.');
    }

    const nextHandle = handle ? normalizeHandle(handle) : viewer.handle;
    const nextDisplayName = displayName?.trim() || viewer.displayName;
    const existingHandle = await queryDatabase<{ id: string }>(databaseUrl, 'select id from users where handle = $1 and id <> $2', [
      nextHandle,
      viewer.id,
    ]);

    if (existingHandle.rows[0]) {
      throw new RepositoryError('handle_taken', 'Handle is already taken.');
    }

    await queryDatabase(databaseUrl, 'update users set display_name = $1, handle = $2, bio = $3, avatar_url = coalesce($4, avatar_url) where id = $5', [
      nextDisplayName,
      nextHandle,
      bio?.trim() ?? viewer.bio ?? '',
      avatarUrl ?? null,
      viewer.id,
    ]);
    await queryDatabase(databaseUrl, 'update memory_posts set author_name = $1, author_handle = $2 where user_id = $3', [
      nextDisplayName,
      `@${nextHandle}`,
      viewer.id,
    ]);

    const session = await getSession(sessionToken ?? null);

    if (!session) {
      throw new RepositoryError('auth_failed', 'Session is missing or expired.');
    }

    return {
      session,
      profile: await getProfile(nextHandle, sessionToken),
      message: 'Profile updated',
    };
  }

  async function getFeed(mode?: FeedMode, sessionToken?: string | null) {
    const user = await getUserFromSession(sessionToken ?? null);
    const actorKey = user ? `user:${user.id}` : `anon:${sessionToken || 'public-preview'}`;
    const [blockedAuthorIds, mutedAuthorIds] = await Promise.all([
      getBlockedAuthorIds(user),
      getMutedAuthorIds(user),
    ]);
    const result = mode && mode !== 'Following'
      ? await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where mode = $1 order by created_at desc', [mode])
      : await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts order by created_at desc');
    const actionResult = await queryDatabase<DbPostActionRow>(databaseUrl, 'select post_id, action from post_actions where actor_key = $1', [actorKey]);
    const hiddenPostIds = new Set(actionResult.rows.filter((action) => action.action === 'hide').map((action) => action.post_id));
    const viewerActions = actionResult.rows.map((action) => ({
      postId: action.post_id,
      action: action.action,
    }));

    return result.rows
      .map(rowToPost)
      .filter((post) => !hiddenPostIds.has(post.id))
      .filter((post) => !post.authorId || !mutedAuthorIds.has(post.authorId))
      .map((post) => withViewerState(post, viewerActions, blockedAuthorIds));
  }

  async function getPlaces() {
    const [placesResult, postsResult] = await Promise.all([
      queryDatabase<DbPlaceRow>(databaseUrl, 'select * from places order by created_at asc'),
      queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts'),
    ]);
    const posts = postsResult.rows.map(rowToPost);

    return placesResult.rows.map((row) => {
      const bubble = rowToPlace(row);
      const relatedPosts = posts.filter((post) => placeNameMatches(post.placeName, bubble.placeName ?? bubble.name));

      return {
        ...bubble,
        memoryCount: relatedPosts.length,
        openCount: relatedPosts.filter((post) => post.unlockState === 'open').length,
        lockedCount: relatedPosts.filter((post) => post.unlockState === 'locked').length,
      };
    });
  }

  async function getPlace(placeKey: string) {
    const key = normalize(placeKey);
    const places = (await queryDatabase<DbPlaceRow>(databaseUrl, 'select * from places')).rows.map(rowToPlace);
    const posts = (await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts order by created_at desc')).rows.map(rowToPost);
    const bubble = places.find((candidate) => normalize(candidate.id) === key || normalize(candidate.name) === key || normalize(candidate.placeName ?? '') === key);
    const displayName = bubble?.placeName ?? bubble?.name ?? placeKey;
    const relatedPosts = posts.filter((post) => placeNameMatches(post.placeName, displayName));
    const relatedTimeline = (await getTimeline()).filter((month) => placeNameMatches(month.placeName, displayName));
    const primaryPost = relatedPosts[0];

    if (!bubble && !primaryPost && relatedPosts.length === 0) {
      throw new RepositoryError('place_not_found', `No place matched "${placeKey}".`);
    }

    return {
      place: {
        id: bubble?.id ?? slugify(primaryPost?.placeName ?? displayName),
        name: primaryPost?.placeName ?? displayName,
        city: bubble?.city ?? primaryPost?.city ?? 'Seoul',
        subtitle: bubble?.subtitle ?? `${relatedPosts.length} memories`,
        coordinates: bubble?.coordinates,
        unlocked: bubble?.unlocked ?? primaryPost?.unlockState === 'open',
        unlockRadiusMeters: bubble?.unlockRadiusMeters ?? primaryPost?.unlockRadiusMeters ?? 200,
        uploadRadiusMeters: bubble?.uploadRadiusMeters ?? 120,
        memoryCount: relatedPosts.length,
      },
      posts: relatedPosts,
      timeline: relatedTimeline,
    };
  }

  async function getTimeline() {
    const months = await queryDatabase<{ id: string; title: string; place_name: string }>(databaseUrl, 'select * from timeline_months order by id desc');
    const items = await queryDatabase<{ id: string; month_id: string; title: string; meta: string; unlocked: boolean }>(databaseUrl, 'select * from timeline_items order by sort_order asc');

    return months.rows.map<TimelineMonth>((month) => ({
      id: month.id,
      title: month.title,
      placeName: month.place_name,
      items: items.rows
        .filter((item) => item.month_id === month.id)
        .map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.meta,
          unlocked: item.unlocked,
        })),
    }));
  }

  async function updatePostAction({
    postId,
    action,
    body,
    sessionToken,
  }: {
    postId: string;
    action: MemoryPostAction;
    body?: string;
    sessionToken?: string | null;
  }) {
    const postResult = await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where id = $1', [postId]);
    const row = postResult.rows[0];

    if (!row) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const user = await getUserFromSession(sessionToken ?? null);
    const actorKey = user ? `user:${user.id}` : `anon:${sessionToken || 'public-preview'}`;
    const stats = { ...row.stats };
    let message = 'Updated.';

    if (action === 'echo' || action === 'save') {
      const existing = await queryDatabase<{ id: string }>(databaseUrl, 'select id from post_actions where post_id = $1 and actor_key = $2 and action = $3', [
        postId,
        actorKey,
        action,
      ]);
      const statKey = action === 'echo' ? 'echoes' : 'saves';

      if (existing.rows[0]) {
        await queryDatabase(databaseUrl, 'delete from post_actions where id = $1', [existing.rows[0].id]);
        stats[statKey] = clampStat(stats[statKey] - 1);
        message = action === 'echo' ? 'Echo removed' : 'Removed from saved';
      } else {
        await queryDatabase(databaseUrl, 'insert into post_actions (id, post_id, user_id, actor_key, action) values ($1, $2, $3, $4, $5)', [
          randomUUID(),
          postId,
          user?.id ?? null,
          actorKey,
          action,
        ]);
        stats[statKey] += 1;
        message = action === 'echo' ? 'Echo saved' : 'Saved to your roll';
      }
    } else if (action === 'reply') {
      await queryDatabase(databaseUrl, 'insert into post_actions (id, post_id, user_id, actor_key, action, body) values ($1, $2, $3, $4, $5, $6)', [
        randomUUID(),
        postId,
        user?.id ?? null,
        actorKey,
        action,
        body,
      ]);
      stats.replies += 1;
      message = 'Reply posted';
    } else {
      const existing = await queryDatabase<{ id: string }>(databaseUrl, 'select id from post_actions where post_id = $1 and actor_key = $2 and action = $3', [
        postId,
        actorKey,
        action,
      ]);

      if (!existing.rows[0]) {
        await queryDatabase(databaseUrl, 'insert into post_actions (id, post_id, user_id, actor_key, action, body) values ($1, $2, $3, $4, $5, $6)', [
          randomUUID(),
          postId,
          user?.id ?? null,
          actorKey,
          action,
          body,
        ]);
      }

      message = action === 'hide' ? 'Post hidden from this session' : 'Report saved for review';
    }

    const updated = await queryDatabase<DbPostRow>(databaseUrl, 'update memory_posts set stats = $1::jsonb where id = $2 returning *', [
      JSON.stringify(stats),
      postId,
    ]);
    const viewerActions = await queryDatabase<DbPostActionRow>(databaseUrl, 'select post_id, action from post_actions where post_id = $1 and actor_key = $2', [
      postId,
      actorKey,
    ]);
    const viewerStateActions = viewerActions.rows.map((action) => ({
      postId: action.post_id,
      action: action.action,
    }));

    return {
      post: withViewerState(rowToPost(updated.rows[0]), viewerStateActions),
      echoed: viewerStateActions.some((viewerAction) => viewerAction.action === 'echo'),
      saved: viewerStateActions.some((viewerAction) => viewerAction.action === 'save'),
      message,
    };
  }

  async function issueCheckIn({ placeName, distanceMeters: suppliedDistance, location, sessionToken }: { placeName: string; distanceMeters?: number; location?: UserLocation; sessionToken?: string | null }) {
    const user = await getUserFromSession(sessionToken ?? null);
    const place = await getPlace(placeName);
    const uploadRadiusMeters = place.place.uploadRadiusMeters ?? 120;
    const unlockRadiusMeters = place.place.unlockRadiusMeters ?? 200;
    let currentDistance = suppliedDistance ?? 0;

    if (location && place.place.coordinates && process.env.HAPPENED_DEV_LOCATION_OVERRIDE === '0') {
      currentDistance = distanceMeters(location, place.place.coordinates);
    }

    if (location?.accuracyMeters && location.accuracyMeters > 50 && process.env.HAPPENED_DEV_LOCATION_OVERRIDE === '0') {
      throw new RepositoryError('location_accuracy_low', `Location accuracy is ${Math.round(location.accuracyMeters)}m; check-in requires 50m or better.`);
    }

    if (currentDistance > uploadRadiusMeters) {
      throw new RepositoryError('outside_radius', `Current distance is ${currentDistance}m, outside the ${uploadRadiusMeters}m upload radius.`);
    }

    const issuedAt = new Date();
    const tokenId = randomUUID();
    const result = await queryDatabase<DbTokenRow>(databaseUrl, `
      insert into check_in_tokens (id, user_id, place_id, place_name, issued_at, expires_at, uploads_remaining, unlock_radius_meters)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *
    `, [
      tokenId,
      user?.id ?? null,
      place.place.id,
      place.place.name,
      issuedAt.toISOString(),
      new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      3,
      unlockRadiusMeters,
    ]);

    return rowToToken(result.rows[0]);
  }

  async function createMemory({
    checkInTokenId,
    caption,
    visibility,
    mediaUrl,
    mediaUrls,
    sessionToken,
  }: {
    checkInTokenId: string;
    caption: string;
    visibility: Visibility;
    mediaUrl?: string;
    mediaUrls?: string[];
    sessionToken?: string | null;
  }) {
    const tokenResult = await queryDatabase<DbTokenRow>(databaseUrl, 'select * from check_in_tokens where id = $1', [checkInTokenId]);
    const token = tokenResult.rows[0];

    if (!token) {
      throw new RepositoryError('token_not_found', 'Check-in token was not found.');
    }

    if (new Date(token.expires_at).getTime() <= Date.now()) {
      throw new RepositoryError('token_expired', 'Check-in token has expired.');
    }

    if (token.uploads_remaining <= 0) {
      throw new RepositoryError('token_spent', 'Check-in token has no uploads remaining.');
    }

    const user = await getUserFromSession(sessionToken ?? null);
    const now = new Date();
    const memory: MemoryPost = {
      id: `memory-${randomUUID()}`,
      mode: 'Memories',
      authorId: user?.id,
      authorName: user?.displayName ?? 'You',
      authorHandle: user ? `@${user.handle}` : '@you',
      placeId: token.place_id ?? undefined,
      placeName: token.place_name,
      city: 'Seoul',
      distanceMeters: 0,
      unlockRadiusMeters: token.unlock_radius_meters,
      unlockState: 'open',
      visibility,
      createdAt: now.toISOString(),
      caption,
      timeLabel: 'just now',
      filmStamp: `${formatFilmStamp(now)} / CHECK-IN`,
      recallLabel: 'Saved at this place',
      mediaUrl,
      mediaUrls: mediaUrls?.length ? mediaUrls : mediaUrl ? [mediaUrl] : [],
      mediaColors: ['#07151A', '#2B5B61', '#C7F95B'],
      accentColor: colors.lime,
      stats: { echoes: 0, replies: 0, saves: 0 },
    };

    await queryDatabase(databaseUrl, 'update check_in_tokens set uploads_remaining = uploads_remaining - 1 where id = $1', [checkInTokenId]);
    const inserted = await queryDatabase<DbPostRow>(databaseUrl, `
      insert into memory_posts (
        id, mode, user_id, author_name, author_handle, place_id, place_name, city,
        distance_meters, unlock_radius_meters, unlock_state, visibility, caption,
        time_label, film_stamp, recall_label, media_colors, media_url, media_urls, accent_color, stats
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19::jsonb, $20, $21::jsonb)
      returning *
    `, [
      memory.id,
      memory.mode,
      memory.authorId ?? null,
      memory.authorName,
      memory.authorHandle,
      memory.placeId ?? null,
      memory.placeName,
      memory.city,
      memory.distanceMeters,
      memory.unlockRadiusMeters,
      memory.unlockState,
      memory.visibility,
      memory.caption,
      memory.timeLabel,
      memory.filmStamp,
      memory.recallLabel ?? null,
      JSON.stringify(memory.mediaColors),
      memory.mediaUrl ?? null,
      JSON.stringify(memory.mediaUrls ?? []),
      memory.accentColor,
      JSON.stringify(memory.stats),
    ]);
    const updatedToken = await queryDatabase<DbTokenRow>(databaseUrl, 'select * from check_in_tokens where id = $1', [checkInTokenId]);

    return {
      memory: rowToPost(inserted.rows[0]),
      checkInToken: rowToToken(updatedToken.rows[0]),
    };
  }

  async function updateMemoryPost({
    postId,
    caption,
    visibility,
    sessionToken,
  }: {
    postId: string;
    caption?: string;
    visibility?: Visibility;
    sessionToken?: string | null;
  }) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to edit posts.');
    }

    const existing = await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where id = $1', [postId]);
    const post = existing.rows[0];

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    if (post.user_id !== viewer.id) {
      throw new RepositoryError('post_owner_required', 'You can only edit your own posts.');
    }

    const updated = await queryDatabase<DbPostRow>(databaseUrl, `
      update memory_posts
      set caption = coalesce($1, caption),
          visibility = coalesce($2, visibility)
      where id = $3
      returning *
    `, [caption ?? null, visibility ?? null, postId]);
    const viewerActions = await viewerActionsFor(viewer, sessionToken);

    return {
      post: withViewerState(rowToPost(updated.rows[0]), viewerActions),
      message: 'Post updated',
    };
  }

  async function deleteMemoryPost(postId: string, sessionToken?: string | null) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to delete posts.');
    }

    const existing = await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where id = $1', [postId]);
    const post = existing.rows[0];

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    if (post.user_id !== viewer.id) {
      throw new RepositoryError('post_owner_required', 'You can only delete your own posts.');
    }

    await queryDatabase(databaseUrl, 'delete from memory_posts where id = $1', [postId]);

    return {
      postId,
      message: 'Post deleted',
    };
  }

  async function findProfileUser(handleOrId: string) {
    const key = normalizeHandle(handleOrId);
    const result = await queryDatabase<DbUserRow>(databaseUrl, 'select * from users where id = $1 or handle = $2', [handleOrId, key]);

    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async function viewerActionsFor(user: StoreUser | null, sessionToken?: string | null) {
    const actorKey = getActorKey(user, sessionToken);
    const result = await queryDatabase<DbPostActionRow>(databaseUrl, 'select post_id, action from post_actions where actor_key = $1', [actorKey]);

    return result.rows.map((action) => ({
      postId: action.post_id,
      action: action.action,
    }));
  }

  async function getProfile(handleOrId: string, sessionToken?: string | null) {
    const viewer = await getUserFromSession(sessionToken ?? null);
    const profileUser = await findProfileUser(handleOrId);
    const viewerActions = await viewerActionsFor(viewer, sessionToken);

    if (profileUser) {
      const blockState = await getBlockState(viewer, profileUser.id);
      const hideProfilePosts = blockState.isBlocked || blockState.blocksViewer;
      const [postsResult, followerResult, followingResult, followResult] = await Promise.all([
        queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where user_id = $1 or lower(replace(author_handle, $2, $3)) = $4 order by created_at desc', [
          profileUser.id,
          '@',
          '',
          normalize(profileUser.handle),
        ]),
        queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from follows where following_id = $1', [profileUser.id]),
        queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from follows where follower_id = $1', [profileUser.id]),
        viewer
          ? queryDatabase<{ following: boolean }>(databaseUrl, 'select exists(select 1 from follows where follower_id = $1 and following_id = $2) as following', [
              viewer.id,
              profileUser.id,
            ])
          : Promise.resolve({ rows: [{ following: false }] }),
      ]);
      const posts = postsResult.rows.map(rowToPost);
      const savedPosts = viewer?.id === profileUser.id
        ? (await queryDatabase<DbPostRow>(databaseUrl, `
            select p.*
            from post_actions a
            join memory_posts p on p.id = a.post_id
            where a.actor_key = $1 and a.action = 'save'
            order by a.created_at desc
          `, [getActorKey(profileUser, sessionToken)])).rows.map(rowToPost)
        : [];

      return buildProfile({
        profileUser: toProfileUser(profileUser),
        posts: hideProfilePosts ? [] : posts,
        savedPosts: hideProfilePosts ? [] : savedPosts,
        followerCount: Number(followerResult.rows[0]?.count ?? 0),
        followingCount: Number(followingResult.rows[0]?.count ?? 0),
        viewer,
        isFollowing: Boolean(followResult.rows[0]?.following),
        ...blockState,
        viewerActions,
      });
    }

    const key = normalizeHandle(handleOrId);
    const seedPostsResult = await queryDatabase<DbPostRow>(databaseUrl, `
      select *
      from memory_posts
      where lower(replace(author_handle, '@', '')) = $1
      order by created_at desc
    `, [key]);
    const seedPosts = seedPostsResult.rows.map(rowToPost);
    const firstPost = seedPosts[0];

    if (!firstPost) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    return buildProfile({
      profileUser: {
        id: `seed:${key}`,
        displayName: firstPost.authorName,
        handle: key,
      },
      posts: seedPosts,
      savedPosts: [],
      followerCount: 0,
      followingCount: 0,
      viewer,
      isFollowing: false,
      isBlocked: false,
      blocksViewer: false,
      viewerActions,
    });
  }

  async function getConnections(handleOrId: string, sessionToken?: string | null): Promise<UserConnections> {
    const viewer = await getUserFromSession(sessionToken ?? null);
    const profileUser = await findProfileUser(handleOrId);

    if (!profileUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    const blockState = await getBlockState(viewer, profileUser.id);
    if (blockState.isBlocked || blockState.blocksViewer) {
      return {
        followers: [],
        following: [],
      };
    }

    const [mutedAuthorIds, viewerSets, followersResult, followingResult] = await Promise.all([
      getMutedAuthorIds(viewer),
      getViewerConnectionSets(viewer),
      queryDatabase<DbUserRow>(databaseUrl, `
        select u.*
        from follows f
        join users u on u.id = f.follower_id
        where f.following_id = $1
        order by f.created_at desc
      `, [profileUser.id]),
      queryDatabase<DbUserRow>(databaseUrl, `
        select u.*
        from follows f
        join users u on u.id = f.following_id
        where f.follower_id = $1
        order by f.created_at desc
      `, [profileUser.id]),
    ]);
    const visibleConnection = (user: StoreUser) => !mutedAuthorIds.has(user.id);
    const followers = followersResult.rows
      .map(rowToUser)
      .filter(visibleConnection)
      .map((user) => toConnectionUser(user, viewer, viewerSets));
    const following = followingResult.rows
      .map(rowToUser)
      .filter(visibleConnection)
      .map((user) => toConnectionUser(user, viewer, viewerSets));

    return { followers, following };
  }

  async function toggleFollow(handleOrId: string, sessionToken?: string | null) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to follow people.');
    }

    const targetUser = await findProfileUser(handleOrId);

    if (!targetUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    if (targetUser.id === viewer.id) {
      throw new RepositoryError('follow_self', 'You cannot follow yourself.');
    }

    const existing = await queryDatabase<{ follower_id: string }>(databaseUrl, 'select follower_id from follows where follower_id = $1 and following_id = $2', [
      viewer.id,
      targetUser.id,
    ]);
    const following = existing.rows.length === 0;

    if (following) {
      await queryDatabase(databaseUrl, 'insert into follows (follower_id, following_id) values ($1, $2) on conflict do nothing', [viewer.id, targetUser.id]);
    } else {
      await queryDatabase(databaseUrl, 'delete from follows where follower_id = $1 and following_id = $2', [viewer.id, targetUser.id]);
    }

    return {
      profile: await getProfile(targetUser.handle, sessionToken),
      following,
      message: following ? `Following ${targetUser.displayName}` : `Unfollowed ${targetUser.displayName}`,
    };
  }

  async function toggleBlock(handleOrId: string, sessionToken?: string | null) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to block people.');
    }

    const targetUser = await findProfileUser(handleOrId);

    if (!targetUser) {
      throw new RepositoryError('profile_not_found', 'Profile was not found.');
    }

    if (targetUser.id === viewer.id) {
      throw new RepositoryError('block_self', 'You cannot block yourself.');
    }

    const existing = await queryDatabase<{ blocker_id: string }>(databaseUrl, 'select blocker_id from user_blocks where blocker_id = $1 and blocked_id = $2', [
      viewer.id,
      targetUser.id,
    ]);
    const blocked = existing.rows.length === 0;

    if (blocked) {
      await queryDatabase(databaseUrl, 'insert into user_blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing', [viewer.id, targetUser.id]);
      await queryDatabase(databaseUrl, `
        delete from follows
        where (follower_id = $1 and following_id = $2)
           or (follower_id = $2 and following_id = $1)
      `, [viewer.id, targetUser.id]);
    } else {
      await queryDatabase(databaseUrl, 'delete from user_blocks where blocker_id = $1 and blocked_id = $2', [viewer.id, targetUser.id]);
    }

    return {
      profile: await getProfile(targetUser.handle, sessionToken),
      blocked,
      message: blocked ? `Blocked ${targetUser.displayName}` : `Unblocked ${targetUser.displayName}`,
    };
  }

  async function getSafetySummary(sessionToken?: string | null): Promise<SafetySummary> {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to view safety settings.');
    }

    const actorKey = getActorKey(viewer, sessionToken);
    const [blocked, hidden, reported] = await Promise.all([
      queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from user_blocks where blocker_id = $1', [viewer.id]),
      queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from post_actions where actor_key = $1 and action = $2', [actorKey, 'hide']),
      queryDatabase<{ count: string }>(databaseUrl, 'select count(*)::text as count from post_actions where actor_key = $1 and action = $2', [actorKey, 'report']),
    ]);

    return {
      blockedCount: Number(blocked.rows[0]?.count ?? 0),
      hiddenCount: Number(hidden.rows[0]?.count ?? 0),
      reportedCount: Number(reported.rows[0]?.count ?? 0),
      notificationsEnabled: true,
      accountDeletionState: 'By request',
    };
  }

  async function searchContent(query: string, sessionToken?: string | null): Promise<SearchResults> {
    const viewer = await getUserFromSession(sessionToken ?? null);
    const actorKey = getActorKey(viewer, sessionToken);
    const [blockedAuthorIds, mutedAuthorIds] = await Promise.all([
      getBlockedAuthorIds(viewer),
      getMutedAuthorIds(viewer),
    ]);
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return { users: [], places: [], posts: [] };
    }

    const likeQuery = `%${normalizedQuery}%`;
    const [usersResult, placesResult, postsResult, actionResult] = await Promise.all([
      queryDatabase<DbUserRow>(databaseUrl, `
        select *
        from users
        where lower(display_name) like $1 or lower(handle) like $1
        order by created_at desc
        limit 10
      `, [likeQuery]),
      queryDatabase<DbPlaceRow>(databaseUrl, `
        select *
        from places
        where lower(name) like $1 or lower(city) like $1 or lower(subtitle) like $1
        order by created_at asc
        limit 10
      `, [likeQuery]),
      queryDatabase<DbPostRow>(databaseUrl, `
        select *
        from memory_posts
        where lower(author_name) like $1
           or lower(replace(author_handle, '@', '')) like $1
           or lower(place_name) like $1
           or lower(city) like $1
           or lower(caption) like $1
        order by created_at desc
        limit 50
      `, [likeQuery]),
      queryDatabase<DbPostActionRow>(databaseUrl, 'select post_id, action from post_actions where actor_key = $1', [actorKey]),
    ]);
    const hiddenPostIds = new Set(actionResult.rows.filter((action) => action.action === 'hide').map((action) => action.post_id));
    const viewerActions = actionResult.rows.map((action) => ({
      postId: action.post_id,
      action: action.action,
    }));
    const users = usersResult.rows
      .map(rowToUser)
      .filter((user) => !mutedAuthorIds.has(user.id))
      .map(toProfileUser);
    const places = placesResult.rows.map(rowToPlace);
    const posts = postsResult.rows
      .map(rowToPost)
      .filter((post) => !hiddenPostIds.has(post.id))
      .filter((post) => !post.authorId || !mutedAuthorIds.has(post.authorId))
      .slice(0, 24)
      .map((post) => withViewerState(post, viewerActions, blockedAuthorIds));

    return { users, places, posts };
  }

  async function applyNotificationReadState(viewer: StoreUser, notifications: NotificationItem[]): Promise<NotificationItem[]> {
    const notificationIds = notifications.map((notification) => notification.id);

    if (!notificationIds.length) {
      return notifications;
    }

    const result = await queryDatabase<{ notification_id: string }>(databaseUrl, `
      select notification_id
      from notification_reads
      where user_id = $1 and notification_id = any($2::text[])
    `, [viewer.id, notificationIds]);
    const readIds = new Set(result.rows.map((row) => row.notification_id));

    return notifications.map((notification) => ({
      ...notification,
      read: readIds.has(notification.id),
    }));
  }

  async function getPostDetail(postId: string, sessionToken?: string | null) {
    const postResult = await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where id = $1', [postId]);
    const row = postResult.rows[0];

    if (!row) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const viewer = await getUserFromSession(sessionToken ?? null);
    const viewerActions = await viewerActionsFor(viewer, sessionToken);
    const commentsResult = await queryDatabase<DbPostActionRow>(databaseUrl, `
      select pa.id, pa.post_id, pa.user_id, pa.actor_key, pa.action, pa.body, pa.created_at, u.display_name, u.handle
      from post_actions pa
      left join users u on u.id = pa.user_id
      where pa.post_id = $1 and pa.action = 'reply' and pa.body is not null
      order by pa.created_at asc
    `, [postId]);
    const post = rowToPost(row);
    const comments = commentsResult.rows.map<PostComment>((comment) => {
      const actor = fallbackUserFromAction({
        actorKey: comment.actor_key,
        userId: comment.user_id,
        displayName: comment.display_name,
        handle: comment.handle,
      });

      return {
        id: comment.id ?? '',
        postId,
        body: comment.body ?? '',
        createdAt: new Date(comment.created_at ?? new Date()).toISOString(),
        createdAtLabel: formatRelativeLabel(comment.created_at),
        author: actor,
        canDelete: Boolean(viewer && (comment.user_id === viewer.id || row.user_id === viewer.id)),
      };
    });

    const protectedPost = withViewerState(post, viewerActions);

    return {
      post: protectedPost,
      comments: protectedPost.unlockState === 'locked' ? [] : comments,
    };
  }

  async function deleteComment({ postId, commentId, sessionToken }: { postId: string; commentId: string; sessionToken?: string | null }) {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to delete replies.');
    }

    const postResult = await queryDatabase<DbPostRow>(databaseUrl, 'select * from memory_posts where id = $1', [postId]);
    const post = postResult.rows[0];

    if (!post) {
      throw new RepositoryError('post_not_found', 'Post was not found.');
    }

    const commentResult = await queryDatabase<DbPostActionRow>(databaseUrl, 'select * from post_actions where id = $1 and post_id = $2 and action = $3', [
      commentId,
      postId,
      'reply',
    ]);
    const comment = commentResult.rows[0];

    if (!comment) {
      throw new RepositoryError('comment_not_found', 'Reply was not found.');
    }

    if (comment.user_id !== viewer.id && post.user_id !== viewer.id) {
      throw new RepositoryError('auth_failed', 'You can only delete your own replies.');
    }

    const stats = {
      ...post.stats,
      replies: clampStat(post.stats.replies - 1),
    };

    await queryDatabase(databaseUrl, 'delete from post_actions where id = $1', [commentId]);
    await queryDatabase(databaseUrl, 'update memory_posts set stats = $1::jsonb where id = $2', [JSON.stringify(stats), postId]);

    return getPostDetail(postId, sessionToken);
  }

  async function getNotifications(sessionToken?: string | null): Promise<NotificationItem[]> {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      return [];
    }

    const mutedAuthorIds = await getMutedAuthorIds(viewer);
    type ActionNotificationRow = DbPostActionRow & {
      place_name: string | null;
    };
    const actionsResult = await queryDatabase<ActionNotificationRow>(databaseUrl, `
      select pa.id, pa.post_id, pa.user_id, pa.actor_key, pa.action, pa.body, pa.created_at, u.display_name, u.handle, p.place_name
      from post_actions pa
      join memory_posts p on p.id = pa.post_id
      left join users u on u.id = pa.user_id
      where p.user_id = $1
        and (pa.user_id is null or pa.user_id <> $1)
        and pa.action in ('echo', 'save', 'reply')
      order by pa.created_at desc
      limit 30
    `, [viewer.id]);
    const actionNotifications = actionsResult.rows.filter((action) => !action.user_id || !mutedAuthorIds.has(action.user_id)).map<NotificationItem>((action) => {
      const actor = fallbackUserFromAction({
        actorKey: action.actor_key,
        userId: action.user_id,
        displayName: action.display_name,
        handle: action.handle,
      });

      return {
        id: action.id ?? '',
        type: action.action as NotificationItem['type'],
        actor,
        postId: action.post_id,
        body: action.body ?? undefined,
        createdAt: new Date(action.created_at ?? new Date()).toISOString(),
        createdAtLabel: formatRelativeLabel(action.created_at),
        message: actionMessage(action.action, actor.displayName, action.place_name),
        read: false,
      };
    });

    const followsResult = await queryDatabase<{ follower_id: string; created_at: Date | string; display_name: string; handle: string }>(databaseUrl, `
      select f.follower_id, f.created_at, u.display_name, u.handle
      from follows f
      join users u on u.id = f.follower_id
      where f.following_id = $1 and f.follower_id <> $1
      order by f.created_at desc
      limit 30
    `, [viewer.id]);
    const followNotifications = followsResult.rows.filter((follow) => !mutedAuthorIds.has(follow.follower_id)).map<NotificationItem>((follow) => {
      const actor = {
        id: follow.follower_id,
        displayName: follow.display_name,
        handle: follow.handle,
      };

      return {
        id: `follow:${follow.follower_id}:${viewer.id}`,
        type: 'follow',
        actor,
        createdAt: new Date(follow.created_at).toISOString(),
        createdAtLabel: formatRelativeLabel(follow.created_at),
        message: `${actor.displayName} started following you`,
        read: false,
      };
    });

    return applyNotificationReadState(viewer, [...actionNotifications, ...followNotifications])
      .then((notifications) => notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30));
  }

  async function markNotificationsRead(sessionToken?: string | null, notificationIds?: string[]): Promise<NotificationItem[]> {
    const viewer = await getUserFromSession(sessionToken ?? null);

    if (!viewer) {
      throw new RepositoryError('auth_failed', 'Sign in to update notifications.');
    }

    const visibleNotifications = await getNotifications(sessionToken);
    const visibleIds = new Set(visibleNotifications.map((notification) => notification.id));
    const targetIds = notificationIds?.length ? notificationIds.filter((id) => visibleIds.has(id)) : [...visibleIds];

    for (const notificationId of targetIds) {
      await queryDatabase(databaseUrl, `
        insert into notification_reads (user_id, notification_id)
        values ($1, $2)
        on conflict (user_id, notification_id) do nothing
      `, [viewer.id, notificationId]);
    }

    return getNotifications(sessionToken);
  }

  return {
    registerUser,
    loginUser,
    getSession,
    updateProfile,
    getFeed,
    searchContent,
    updatePostAction,
    updateMemoryPost,
    deleteMemoryPost,
    getProfile,
    getConnections,
    toggleFollow,
    toggleBlock,
    getPostDetail,
    deleteComment,
    getNotifications,
    markNotificationsRead,
    getSafetySummary,
    getPlaces,
    getPlace,
    getTimeline,
    issueCheckIn,
    createMemory,
  };
}

export async function createRepository(databaseUrl?: string | null) {
  if (databaseUrl) {
    await migrateDatabase(databaseUrl);
    await ensurePostgresSeed(databaseUrl);
    return createPostgresRepository(databaseUrl);
  }

  return createLocalRepository();
}
