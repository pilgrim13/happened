import { Platform } from 'react-native';

import { seedMediaUrls } from '../data/happened';
import type {
  AuthSession,
  BlockResult,
  CheckInToken,
  FeedMode,
  FollowResult,
  MemoryPost,
  MemoryPostAction,
  MemoryPostActionResult,
  MemoryPostUpdateResult,
  NotificationItem,
  PlaceBubble,
  PostDetail,
  ProfileUpdateResult,
  PublicProfile,
  SafetySummary,
  SearchResults,
  TimelineMonth,
  UserConnections,
  UserLocation,
  Visibility,
} from '../types/happened';

type ApiEnvelope<T> = {
  data: T;
};

type CreateMemoryResponse = {
  memory: MemoryPost;
  checkInToken?: CheckInToken;
};

type PlaceDetailResponse = {
  place: {
    id: string;
    name: string;
    city: string;
    subtitle?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    unlocked: boolean;
    unlockRadiusMeters: number;
    uploadRadiusMeters: number;
    memoryCount: number;
  };
  posts: MemoryPost[];
  timeline: TimelineMonth[];
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getWebDefaultApiUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
}

export function getApiBaseUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_HAPPENED_API_URL?.trim();

  if (explicitUrl) {
    return trimTrailingSlash(explicitUrl);
  }

  const webDefault = getWebDefaultApiUrl();
  return webDefault ? trimTrailingSlash(webDefault) : null;
}

function absolutizeMediaUrl<T extends MemoryPost>(post: T): T {
  if (post.unlockState === 'locked') {
    return {
      ...post,
      caption: '',
      mediaUrl: undefined,
      mediaUrls: [],
    };
  }

  const baseUrl = getApiBaseUrl();
  const fallbackMediaUrl = seedMediaUrls[post.id as keyof typeof seedMediaUrls];
  const mediaUrl = post.mediaUrl ?? fallbackMediaUrl;
  const rawMediaUrls = post.mediaUrls?.length ? post.mediaUrls : mediaUrl ? [mediaUrl] : [];
  const mediaUrls = rawMediaUrls.map((url) => (baseUrl && url.startsWith('/') ? `${baseUrl}${url}` : url));

  if (!mediaUrls.length) {
    return post;
  }

  return {
    ...post,
    mediaUrl: mediaUrls[0],
    mediaUrls,
  };
}

function absolutizeUrl(url?: string) {
  const baseUrl = getApiBaseUrl();

  if (!url || !baseUrl || !url.startsWith('/')) {
    return url;
  }

  return `${baseUrl}${url}`;
}

function absolutizeUser<T extends { avatarUrl?: string }>(user: T): T {
  return {
    ...user,
    avatarUrl: absolutizeUrl(user.avatarUrl),
  };
}

async function requestApi<T>(path: string, init?: RequestInit, sessionToken?: string | null): Promise<T> {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error('Happened API URL is not configured.');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : null),
      ...(init?.body ? { 'Content-Type': 'application/json' } : null),
      ...init?.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    let message = typeof body?.message === 'string' ? body.message : `Happened API request failed with ${response.status}.`;
    if (Array.isArray(body?.issues) && body.issues.length > 0) {
      const details = body.issues
        .map((issue: { path?: string; message?: string }) => {
          const field = issue.path ?? '';
          const detail = issue.message ?? '';
          return field ? `${field}: ${detail}` : detail;
        })
        .filter(Boolean)
        .join(' / ');
      if (details) {
        message = `${message} (${details})`;
      }
    }
    throw new Error(message);
  }

  return body as T;
}

export async function fetchFeed(mode?: FeedMode, sessionToken?: string | null, viewerCoords?: { lat: number; lng: number }) {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (viewerCoords) {
    params.set('lat', String(viewerCoords.lat));
    params.set('lng', String(viewerCoords.lng));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await requestApi<ApiEnvelope<{ items: MemoryPost[]; nextCursor: string | null }>>(`/v1/feed${query}`, undefined, sessionToken);

  return (response.data?.items ?? []).map(absolutizeMediaUrl);
}

export async function fetchSearchResults(query: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<SearchResults>>(`/v1/search?q=${encodeURIComponent(query)}`, undefined, sessionToken);

  return {
    ...response.data,
    users: response.data.users.map(absolutizeUser),
    posts: response.data.posts.map(absolutizeMediaUrl),
  };
}

export async function fetchPlaces() {
  const response = await requestApi<ApiEnvelope<PlaceBubble[]>>('/v1/places');

  return response.data;
}

export async function fetchPlace(placeKey: string) {
  const response = await requestApi<ApiEnvelope<PlaceDetailResponse>>(`/v1/places/${encodeURIComponent(placeKey)}`);

  return {
    ...response.data,
    posts: response.data.posts.map(absolutizeMediaUrl),
  };
}

export async function fetchTimeline() {
  const response = await requestApi<ApiEnvelope<TimelineMonth[]>>('/v1/timeline');

  return response.data;
}

export async function fetchSession(sessionToken: string) {
  const response = await requestApi<ApiEnvelope<AuthSession>>('/v1/auth/session', undefined, sessionToken);

  return {
    ...response.data,
    user: absolutizeUser(response.data.user),
  };
}

export async function updateProfile(input: { displayName?: string; handle?: string; bio?: string; avatarDataUrl?: string; avatarFileName?: string }, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<ProfileUpdateResult>>('/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, sessionToken);

  return {
    ...response.data,
    session: {
      ...response.data.session,
      user: absolutizeUser(response.data.session.user),
    },
    profile: absolutizeProfile(response.data.profile),
  };
}

export async function registerAccount(input: { email: string; displayName: string; handle: string; password: string }) {
  const response = await requestApi<ApiEnvelope<AuthSession>>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return {
    ...response.data,
    user: absolutizeUser(response.data.user),
  };
}

export async function loginAccount(input: { email: string; password: string }) {
  const response = await requestApi<ApiEnvelope<AuthSession>>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return {
    ...response.data,
    user: absolutizeUser(response.data.user),
  };
}

export async function updatePostAction(postId: string, action: MemoryPostAction, input?: { body?: string }, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<MemoryPostActionResult>>(`/v1/posts/${encodeURIComponent(postId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      action,
      body: input?.body,
    }),
  }, sessionToken);

  return {
    ...response.data,
    post: absolutizeMediaUrl(response.data.post),
  };
}

export async function fetchPostDetail(postId: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<PostDetail>>(`/v1/posts/${encodeURIComponent(postId)}`, undefined, sessionToken);

  return {
    ...response.data,
    post: absolutizeMediaUrl(response.data.post),
  };
}

export async function deletePostComment(postId: string, commentId: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<PostDetail>>(`/v1/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  }, sessionToken);

  return {
    ...response.data,
    post: absolutizeMediaUrl(response.data.post),
  };
}

function absolutizeProfile(profile: PublicProfile): PublicProfile {
  return {
    ...profile,
    user: absolutizeUser(profile.user),
    posts: profile.posts.map(absolutizeMediaUrl),
    savedPosts: profile.savedPosts.map(absolutizeMediaUrl),
  };
}

export async function fetchProfile(handle: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<PublicProfile>>(`/v1/users/${encodeURIComponent(handle)}`, undefined, sessionToken);

  return absolutizeProfile(response.data);
}

export async function fetchConnections(handle: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<UserConnections>>(`/v1/users/${encodeURIComponent(handle)}/connections`, undefined, sessionToken);

  return {
    followers: response.data.followers.map(absolutizeUser),
    following: response.data.following.map(absolutizeUser),
  };
}

export async function toggleFollow(handle: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<FollowResult>>(`/v1/users/${encodeURIComponent(handle)}/follow`, {
    method: 'POST',
  }, sessionToken);

  return {
    ...response.data,
    profile: absolutizeProfile(response.data.profile),
  };
}

export async function toggleBlock(handle: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<BlockResult>>(`/v1/users/${encodeURIComponent(handle)}/block`, {
    method: 'POST',
  }, sessionToken);

  return {
    ...response.data,
    profile: absolutizeProfile(response.data.profile),
  };
}

export async function fetchSafetySummary(sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<SafetySummary>>('/v1/me/safety', undefined, sessionToken);

  return response.data;
}

export async function fetchNotifications(sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<NotificationItem[]>>('/v1/notifications', undefined, sessionToken);

  return response.data.map((notification) => ({
    ...notification,
    actor: absolutizeUser(notification.actor),
  }));
}

export async function markNotificationsRead(sessionToken?: string | null, notificationIds?: string[]) {
  const response = await requestApi<ApiEnvelope<NotificationItem[]>>('/v1/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ notificationIds }),
  }, sessionToken);

  return response.data.map((notification) => ({
    ...notification,
    actor: absolutizeUser(notification.actor),
  }));
}

export async function updateMemoryPost(postId: string, input: { caption?: string; visibility?: Visibility }, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<MemoryPostUpdateResult>>(`/v1/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, sessionToken);

  return {
    ...response.data,
    post: absolutizeMediaUrl(response.data.post),
  };
}

export async function deleteMemoryPost(postId: string, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<{ postId: string; message: string }>>(`/v1/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  }, sessionToken);

  return response.data;
}

export async function issueCheckInToken(placeName: string, input?: { distanceMeters?: number; location?: UserLocation }, sessionToken?: string | null) {
  const response = await requestApi<ApiEnvelope<CheckInToken>>('/v1/check-ins', {
    method: 'POST',
    body: JSON.stringify({
      placeName,
      distanceMeters: input?.distanceMeters,
      location: input?.location,
    }),
  }, sessionToken);

  return response.data;
}

export type RecallFeedItem = {
  id: string;
  kind: 'anniversary' | 'proximity';
  sourcePostId: string | null;
  placeId: string | null;
  scheduledFor: string;
  deliveredAt: string | null;
  createdAt: string;
  placeName: string | null;
  mediaUrl: string | null;
};

export async function fetchRecallFeed(sessionToken?: string | null): Promise<RecallFeedItem[]> {
  const response = await requestApi<ApiEnvelope<RecallFeedItem[]>>('/v1/recall/feed', undefined, sessionToken);
  return response.data.map((item) => ({
    ...item,
    mediaUrl: item.mediaUrl ? absolutizeUrl(item.mediaUrl) ?? item.mediaUrl : null,
  }));
}

export async function dismissRecallEvent(id: string, sessionToken?: string | null): Promise<void> {
  await requestApi<ApiEnvelope<{ ok: boolean }>>(`/v1/recall/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }, sessionToken);
}

export async function registerPushToken(token: string, platform: 'ios' | 'android' | 'web', sessionToken?: string | null): Promise<void> {
  await requestApi<ApiEnvelope<{ ok: boolean }>>('/v1/push/register', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  }, sessionToken);
}

export async function revokePushToken(token: string, sessionToken?: string | null): Promise<void> {
  await requestApi<ApiEnvelope<{ ok: boolean }>>('/v1/push/register', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  }, sessionToken);
}

export async function loginWithApple(identityToken: string, fullName?: { givenName?: string | null; familyName?: string | null } | null): Promise<AuthSession> {
  const response = await requestApi<ApiEnvelope<AuthSession>>('/v1/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ identityToken, fullName }),
  });
  return {
    ...response.data,
    user: absolutizeUser(response.data.user),
  };
}

export async function fetchReverseGeocode(lat: number, lng: number): Promise<string> {
  const response = await requestApi<ApiEnvelope<string>>(`/v1/places/reverse-geocode?lat=${lat}&lng=${lng}`);
  return response.data;
}

export async function createPlace(
  input: { lat: number; lng: number; name?: string },
  sessionToken?: string | null,
) {
  const response = await requestApi<ApiEnvelope<PlaceBubble>>('/v1/places', {
    method: 'POST',
    body: JSON.stringify(input),
  }, sessionToken);
  return response.data;
}

export async function createMemory(
  input: {
    lat: number;
    lng: number;
    placeName?: string;
    caption: string;
    visibility: Visibility;
    mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
  },
  sessionToken?: string | null,
) {
  const response = await requestApi<ApiEnvelope<CreateMemoryResponse>>('/v1/memories', {
    method: 'POST',
    body: JSON.stringify({
      lat: input.lat,
      lng: input.lng,
      placeName: input.placeName,
      caption: input.caption,
      visibility: input.visibility,
      mediaItems: input.mediaItems,
    }),
  }, sessionToken);

  return {
    memory: absolutizeMediaUrl(response.data.memory),
  };
}
