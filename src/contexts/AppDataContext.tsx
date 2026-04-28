import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
import { FeedProvider, useFeedContext } from './FeedContext';
import { NotificationsProvider, useNotificationsContext } from './NotificationsContext';
import { PlacesProvider, usePlacesContext } from './PlacesContext';
import { TimelineProvider, useTimelineContext } from './TimelineContext';
import type {
  MemoryPost,
  MemoryPostAction,
  SafetySummary,
  SearchResults,
  Visibility,
} from '../types/happened';

// ─── Orchestrator context (actions + safetySummary) ──────────────────────────

type AppDataOrchestratorValue = {
  safetySummary: SafetySummary | null;
  refresh: () => Promise<void>;
  refreshNearby: () => Promise<void>;
  loadMoreFeed: () => Promise<void>;
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

const AppDataOrchestratorContext = createContext<AppDataOrchestratorValue | null>(null);

function AppDataOrchestrator({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { setFeedPosts, setNearbyPosts, feedCursorRef, loadingMoreFeedRef, viewerCoordsRef } = useFeedContext();
  const { notifications, setNotifications } = useNotificationsContext();
  /* notifications는 acknowledgeNotifications에서 read 여부 판단에 사용 */
  const { setPlaces } = usePlacesContext();
  const { setTimeline } = useTimelineContext();
  const [safetySummary, setSafetySummary] = useState<SafetySummary | null>(null);
  const token = session?.token;

  const refreshViewerCoords = useCallback(async () => {
    try {
      // location 서비스 60s 캐시에 위임 — 별도 throttle 불필요
      const loc = await getCurrentLocation();
      viewerCoordsRef.current = { lat: loc.latitude, lng: loc.longitude };
    } catch {
      // 권한 거부 → null 유지 (모자이크 기본값)
    }
  }, [viewerCoordsRef]);

  // 앱 진입 시 1회 위치 확보 (silent)
  useEffect(() => {
    refreshViewerCoords().catch(() => undefined);
  }, [refreshViewerCoords]);

  const refresh = useCallback(async () => {
    // 위치 갱신 시도 (location 서비스 60s 캐시)
    await refreshViewerCoords().catch(() => undefined);

    // feed 먼저 fetch → 즉시 렌더링 (cursor 리셋)
    feedCursorRef.current = null;
    const { items: posts, nextCursor } = await fetchFeed(undefined, token, viewerCoordsRef.current ?? undefined);
    feedCursorRef.current = nextCursor;
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
  }, [token, refreshViewerCoords, feedCursorRef, viewerCoordsRef, setFeedPosts, setPlaces, setTimeline, setNotifications]);

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
    [token, setFeedPosts],
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
    [token, setFeedPosts, setNotifications],
  );

  const acknowledgeNotifications = useCallback(async () => {
    if (!token || notifications.every((n) => n.read)) return;
    try {
      setNotifications(await markNotificationsRead(token));
    } catch {
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    }
  }, [notifications, token, setNotifications]);

  const refreshNearby = useCallback(async () => {
    await refreshViewerCoords().catch(() => undefined);
    if (!viewerCoordsRef.current) {
      throw new Error('위치 권한이 필요해요');
    }
    const { items: posts } = await fetchFeed('Nearby', token, viewerCoordsRef.current);
    setNearbyPosts(posts);
  }, [token, refreshViewerCoords, viewerCoordsRef, setNearbyPosts]);

  const loadMoreFeed = useCallback(async () => {
    if (loadingMoreFeedRef.current || !feedCursorRef.current) return;
    loadingMoreFeedRef.current = true;
    try {
      const { items, nextCursor } = await fetchFeed(undefined, token, viewerCoordsRef.current ?? undefined, feedCursorRef.current);
      feedCursorRef.current = nextCursor;
      setFeedPosts((current) => {
        const existingIds = new Set(current.map((p) => p.id));
        return [...current, ...items.filter((p) => !existingIds.has(p.id))];
      });
    } finally {
      loadingMoreFeedRef.current = false;
    }
  }, [token, feedCursorRef, loadingMoreFeedRef, viewerCoordsRef, setFeedPosts]);

  const editPost = useCallback(
    async (postId: string, input: { caption?: string; visibility?: Visibility }) => {
      const result = await updateApiMemoryPost(postId, input, token);
      setFeedPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      setNearbyPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      return result;
    },
    [token, setFeedPosts, setNearbyPosts],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      await deleteApiMemoryPost(postId, token);
      setFeedPosts((current) => current.filter((post) => post.id !== postId));
      setNearbyPosts((current) => current.filter((post) => post.id !== postId));
    },
    [token, setFeedPosts, setNearbyPosts],
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

  const value = useMemo<AppDataOrchestratorValue>(
    () => ({
      safetySummary,
      refresh,
      refreshNearby,
      loadMoreFeed,
      uploadMemory,
      performPostAction,
      editPost,
      deletePost,
      acknowledgeNotifications,
      blockAuthor,
      search,
    }),
    [
      safetySummary,
      refresh,
      refreshNearby,
      loadMoreFeed,
      uploadMemory,
      performPostAction,
      editPost,
      deletePost,
      acknowledgeNotifications,
      blockAuthor,
      search,
    ],
  );

  return <AppDataOrchestratorContext.Provider value={value}>{children}</AppDataOrchestratorContext.Provider>;
}

// ─── Public provider (서브 컨텍스트 중첩) ──────────────────────────────────────

export function AppDataProvider({ children }: { children: ReactNode }) {
  return (
    <FeedProvider>
      <NotificationsProvider>
        <PlacesProvider>
          <TimelineProvider>
            <AppDataOrchestrator>
              {children}
            </AppDataOrchestrator>
          </TimelineProvider>
        </PlacesProvider>
      </NotificationsProvider>
    </FeedProvider>
  );
}

// ─── Backward-compat hook ─────────────────────────────────────────────────────

/**
 * @deprecated 개별 hook(useFeed, useNotifications, usePlaces, useTimeline) 사용 권장.
 * TODO: 각 consumer를 개별 hook으로 마이그레이션 후 제거.
 */
export function useAppData() {
  const feed = useFeedContext();
  const notifs = useNotificationsContext();
  const places = usePlacesContext();
  const timeline = useTimelineContext();
  const orchestrator = useContext(AppDataOrchestratorContext);
  if (!orchestrator) throw new Error('useAppData must be used inside AppDataProvider');

  return {
    feedPosts: feed.feedPosts,
    setFeedPosts: feed.setFeedPosts,
    nearbyPosts: feed.nearbyPosts,
    notifications: notifs.notifications,
    setNotifications: notifs.setNotifications,
    places: places.places,
    timeline: timeline.timeline,
    ...orchestrator,
  };
}

// ─── 개별 hook re-export (향후 직접 임포트용) ─────────────────────────────────

export { useFeed } from './FeedContext';
export { useNotifications } from './NotificationsContext';
export { usePlaces } from './PlacesContext';
export { useTimeline } from './TimelineContext';
