import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { memoryPosts as initialMemoryPosts } from '../data/happened';
import {
  createMemory as createApiMemory,
  fetchFeed,
  fetchNotifications,
  fetchPlaces,
  fetchSafetySummary,
  fetchSearchResults,
  fetchTimeline,
  issueCheckInToken as issueApiCheckInToken,
  markNotificationsRead,
  toggleBlock as toggleApiBlock,
  updatePostAction as updateApiPostAction,
} from '../services/happenedApi';
import { useSession } from './SessionContext';
import type {
  CheckInToken,
  MemoryPost,
  MemoryPostAction,
  NotificationItem,
  PlaceBubble,
  SafetySummary,
  SearchResults,
  TimelineMonth,
  UserLocation,
  Visibility,
} from '../types/happened';

type AppDataContextValue = {
  feedPosts: MemoryPost[];
  setFeedPosts: React.Dispatch<React.SetStateAction<MemoryPost[]>>;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  places: PlaceBubble[];
  timeline: TimelineMonth[];
  safetySummary: SafetySummary | null;
  refresh: () => Promise<void>;
  // checkin/upload
  checkInToken: CheckInToken | null;
  setCheckInToken: React.Dispatch<React.SetStateAction<CheckInToken | null>>;
  issueCheckIn: (placeName: string, opts: { distanceMeters?: number; location?: UserLocation }) => Promise<CheckInToken>;
  uploadMemory: (input: {
    checkInTokenId: string;
    caption: string;
    visibility?: Visibility;
    mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
  }) => Promise<{ memory: MemoryPost; checkInToken: CheckInToken }>;
  performPostAction: (postId: string, action: MemoryPostAction, input?: { body?: string }) => Promise<{ message: string; post: MemoryPost }>;
  acknowledgeNotifications: () => Promise<void>;
  blockAuthor: (handle: string) => Promise<{ message: string }>;
  search: (query: string) => Promise<SearchResults>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [feedPosts, setFeedPosts] = useState<MemoryPost[]>(initialMemoryPosts);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [places, setPlaces] = useState<PlaceBubble[]>([]);
  const [timeline, setTimeline] = useState<TimelineMonth[]>([]);
  const [safetySummary, setSafetySummary] = useState<SafetySummary | null>(null);
  const [checkInToken, setCheckInToken] = useState<CheckInToken | null>(null);

  const token = session?.token;

  const refresh = useCallback(async () => {
    const [posts, apiPlaces, months, nextNotifications, nextSafety] = await Promise.all([
      fetchFeed(undefined, token),
      fetchPlaces(),
      fetchTimeline(),
      fetchNotifications(token),
      token ? fetchSafetySummary(token).catch(() => null) : Promise.resolve(null),
    ]);
    setFeedPosts(posts);
    setPlaces(apiPlaces);
    setTimeline(months);
    setNotifications(nextNotifications);
    setSafetySummary(nextSafety);
  }, [token]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const issueCheckIn = useCallback(
    async (placeName: string, opts: { distanceMeters?: number; location?: UserLocation }) => {
      const result = await issueApiCheckInToken(
        placeName,
        { distanceMeters: opts.distanceMeters ?? 84, location: opts.location },
        token,
      );
      setCheckInToken(result);
      return result;
    },
    [token],
  );

  const uploadMemory = useCallback(
    async ({
      checkInTokenId,
      caption,
      visibility = 'PublicAfter1h',
      mediaItems,
    }: {
      checkInTokenId: string;
      caption: string;
      visibility?: Visibility;
      mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
    }) => {
      const result = await createApiMemory(checkInTokenId, caption, visibility, { mediaItems }, token);
      setCheckInToken(result.checkInToken);
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
      notifications,
      setNotifications,
      places,
      timeline,
      safetySummary,
      refresh,
      checkInToken,
      setCheckInToken,
      issueCheckIn,
      uploadMemory,
      performPostAction,
      acknowledgeNotifications,
      blockAuthor,
      search,
    }),
    [
      feedPosts,
      notifications,
      places,
      timeline,
      safetySummary,
      refresh,
      checkInToken,
      issueCheckIn,
      uploadMemory,
      performPostAction,
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
