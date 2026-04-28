import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MutableRefObject } from 'react';

import type { MemoryPost } from '../types/happened';

type FeedContextValue = {
  feedPosts: MemoryPost[];
  setFeedPosts: React.Dispatch<React.SetStateAction<MemoryPost[]>>;
  nearbyPosts: MemoryPost[];
  setNearbyPosts: React.Dispatch<React.SetStateAction<MemoryPost[]>>;
  // 페이지네이션/위치 ref — AppDataContext orchestrator에서 사용
  feedCursorRef: MutableRefObject<string | null>;
  loadingMoreFeedRef: MutableRefObject<boolean>;
  viewerCoordsRef: MutableRefObject<{ lat: number; lng: number } | null>;
  lastLocationFetchRef: MutableRefObject<number>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feedPosts, setFeedPosts] = useState<MemoryPost[]>([]);
  const [nearbyPosts, setNearbyPosts] = useState<MemoryPost[]>([]);
  const feedCursorRef = useRef<string | null>(null);
  const loadingMoreFeedRef = useRef(false);
  const viewerCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastLocationFetchRef = useRef<number>(0);

  const value = useMemo<FeedContextValue>(
    () => ({
      feedPosts,
      setFeedPosts,
      nearbyPosts,
      setNearbyPosts,
      feedCursorRef,
      loadingMoreFeedRef,
      viewerCoordsRef,
      lastLocationFetchRef,
    }),
    [feedPosts, nearbyPosts],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

/** 피드 상태와 ref에 접근. AppDataContext orchestrator 내부 전용. */
export function useFeedContext() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeedContext must be used inside FeedProvider');
  return ctx;
}

/** 피드 게시물만 필요한 외부 consumer용 hook. */
export function useFeed() {
  const { feedPosts, nearbyPosts } = useFeedContext();
  return { feedPosts, nearbyPosts };
}
