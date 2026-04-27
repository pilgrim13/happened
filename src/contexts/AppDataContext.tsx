import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  createMemory as createApiMemory,
  deleteMemoryPost as deleteApiMemoryPost,
  fetchFeed,
  fetchNotifications,
  fetchPlaces,
  fetchSafetySummary,
  fetchSearchResults,
  fetchTimeline,
  markNotificationsRead,
  toggleBlock as toggleApiBlock,
  updateMemoryPost as updateApiMemoryPost,
  updatePostAction as updateApiPostAction,
} from '../services/happenedApi';
import { getCurrentLocation } from '../services/location';
import { useSession } from './SessionContext';
import type {
  MemoryPost,
  MemoryPostAction,
  NotificationItem,
  PlaceBubble,
  SafetySummary,
  SearchResults,
  TimelineMonth,
  Visibility,
} from '../types/happened';

type AppDataContextValue = {
  feedPosts: MemoryPost[];
  setFeedPosts: React.Dispatch<React.SetStateAction<MemoryPost[]>>;
  nearbyPosts: MemoryPost[];
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  places: PlaceBubble[];
  timeline: TimelineMonth[];
  safetySummary: SafetySummary | null;
  refresh: () => Promise<void>;
  refreshNearby: () => Promise<void>;
  uploadMemory: (input: {
    lat: number;
    lng: number;
    placeName?: string;
    caption: string;
    visibility?: Visibility;
    mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
  }) => Promise<{ memory: MemoryPost }>;
  performPostAction: (postId: string, action: MemoryPostAction, input?: { body?: string }) => Promise<{ message: string; post: MemoryPost }>;
  editPost: (postId: string, input: { caption?: string; visibility?: Visibility }) => Promise<{ post: MemoryPost; message: string }>;
  deletePost: (postId: string) => Promise<void>;
  acknowledgeNotifications: () => Promise<void>;
  blockAuthor: (handle: string) => Promise<{ message: string }>;
  search: (query: string) => Promise<SearchResults>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [feedPosts, setFeedPosts] = useState<MemoryPost[]>([]);
  const [nearbyPosts, setNearbyPosts] = useState<MemoryPost[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [places, setPlaces] = useState<PlaceBubble[]>([]);
  const [timeline, setTimeline] = useState<TimelineMonth[]>([]);
  const [safetySummary, setSafetySummary] = useState<SafetySummary | null>(null);
  const token = session?.token;

  // viewer 위치 캐시 (30초 쓰로틀)
  const viewerCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastLocationFetchRef = useRef<number>(0);

  const refreshViewerCoords = useCallback(async () => {
    const now = Date.now();
    if (now - lastLocationFetchRef.current < 30_000) return;
    lastLocationFetchRef.current = now;
    try {
      const loc = await getCurrentLocation();
      viewerCoordsRef.current = { lat: loc.latitude, lng: loc.longitude };
    } catch {
      // 권한 거부 → null 유지 (모자이크 기본값)
    }
  }, []);

  // 앱 진입 시 1회 위치 확보 (silent)
  useEffect(() => {
    refreshViewerCoords().catch(() => undefined);
  }, [refreshViewerCoords]);

  const refresh = useCallback(async () => {
    // 위치 갱신 시도 (30초 쓰로틀)
    await refreshViewerCoords().catch(() => undefined);

    // feed 먼저 fetch → 즉시 렌더링
    const posts = await fetchFeed(undefined, token, viewerCoordsRef.current ?? undefined);
    setFeedPosts(posts);

    // 나머지는 비동기 백그라운드
    setTimeout(() => {
      fetchPlaces().then(setPlaces).catch(() => undefined);
      fetchTimeline().then(setTimeline).catch(() => undefined);
      fetchNotifications(token).then(setNotifications).catch(() => undefined);
      if (token) {
        fetchSafetySummary(token).then(setSafetySummary).catch(() => undefined);
      }
    }, 0);
  }, [token, refreshViewerCoords]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const uploadMemory = useCallback(
    async ({
      lat,
      lng,
      placeName,
      caption,
      visibility = 'PublicAfter1h',
      mediaItems,
    }: {
      lat: number;
      lng: number;
      placeName?: string;
      caption: string;
      visibility?: Visibility;
      mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
    }) => {
      const result = await createApiMemory({ lat, lng, placeName, caption, visibility, mediaItems }, token);
      setFeedPosts((current) => [result.memory, ...current.filter((post) => post.id !== result.memory.id)]);
      return result;
    },
    [token],
  );

  const performPostAction = useCallback(
    async (postId: string, action: MemoryPostAction, input?: { body?: string }) => {
      const result = await updateApiPostAction(postId, action, input, token);
      if (action === 'hide') {
        setFeedPosts((current) => current.filter((post) => post.id !== postId));
      } else {
        setFeedPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      }
      fetchNotifications(token).then(setNotifications).catch(() => undefined);
      return result;
    },
    [token],
  );

  const acknowledgeNotifications = useCallback(async () => {
    if (!token || notifications.every((n) => n.read)) return;
    try {
      setNotifications(await markNotificationsRead(token));
    } catch {
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    }
  }, [notifications, token]);

  const refreshNearby = useCallback(async () => {
    await refreshViewerCoords().catch(() => undefined);
    if (!viewerCoordsRef.current) {
      throw new Error('위치 권한이 필요해요');
    }
    const posts = await fetchFeed('Nearby', token, viewerCoordsRef.current);
    setNearbyPosts(posts);
  }, [token, refreshViewerCoords]);

  const editPost = useCallback(
    async (postId: string, input: { caption?: string; visibility?: Visibility }) => {
      const result = await updateApiMemoryPost(postId, input, token);
      setFeedPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      setNearbyPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      return result;
    },
    [token],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      await deleteApiMemoryPost(postId, token);
      setFeedPosts((current) => current.filter((post) => post.id !== postId));
      setNearbyPosts((current) => current.filter((post) => post.id !== postId));
    },
    [token],
  );

  const blockAuthor = useCallback(
    async (handle: string) => {
      const result = await toggleApiBlock(handle, token);
      await refresh();
      return result;
    },
    [refresh, token],
  );

  const search = useCallback((query: string) => fetchSearchResults(query, token), [token]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      feedPosts,
      setFeedPosts,
      nearbyPosts,
      notifications,
      setNotifications,
      places,
      timeline,
      safetySummary,
      refresh,
      refreshNearby,
      uploadMemory,
      performPostAction,
      editPost,
      deletePost,
      acknowledgeNotifications,
      blockAuthor,
      search,
    }),
    [
      feedPosts,
      nearbyPosts,
      notifications,
      places,
      timeline,
      safetySummary,
      refresh,
      refreshNearby,
      uploadMemory,
      performPostAction,
      editPost,
      deletePost,
      acknowledgeNotifications,
      blockAuthor,
      search,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
