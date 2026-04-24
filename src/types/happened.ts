export type TabKey = 'home' | 'map' | 'capture' | 'timeline' | 'profile';

export type FeedMode = 'Following' | 'Nearby' | 'Memories';

export type UnlockState = 'open' | 'nearby' | 'locked';

export type Visibility = 'Followers' | 'Public';

export type AppStage = 'welcome' | 'auth' | 'permissions' | 'app';

export type MemoryPost = {
  id: string;
  mode: FeedMode;
  authorName: string;
  authorHandle: string;
  placeName: string;
  city: string;
  distanceMeters: number;
  unlockRadiusMeters: number;
  unlockState: UnlockState;
  visibility: Visibility;
  caption: string;
  timeLabel: string;
  filmStamp: string;
  recallLabel?: string;
  mediaColors: readonly [string, string, string];
  accentColor: string;
  stats: {
    echoes: number;
    replies: number;
    saves: number;
  };
};

export type CheckInToken = {
  placeName: string;
  issuedAtLabel: string;
  expiresInLabel: string;
  uploadsRemaining: number;
};

export type PlaceBubble = {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  intensity: number;
  unlocked: boolean;
};

export type TimelineMonth = {
  id: string;
  title: string;
  placeName: string;
  items: Array<{
    id: string;
    title: string;
    meta: string;
    unlocked: boolean;
  }>;
};
