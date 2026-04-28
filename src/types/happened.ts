export type TabKey = 'home' | 'map' | 'capture' | 'timeline' | 'profile';

export type FeedMode = 'Following' | 'Nearby' | 'Memories';

export type UnlockState = 'open' | 'nearby' | 'locked';

export type Visibility = 'Followers' | 'PublicAfter1h' | 'Public';

export type AppStage = 'welcome' | 'auth' | 'permissions' | 'app';

export type MemoryPostAction = 'echo' | 'save' | 'reply' | 'hide' | 'report';

export type MemoryPost = {
  id: string;
  mode: FeedMode;
  authorId?: string;
  authorName: string;
  authorHandle: string;
  placeId?: string;
  placeName: string;
  city: string;
  distanceMeters: number | null;
  unlockRadiusMeters: number;
  unlockState: UnlockState;
  visibility: Visibility;
  createdAt?: string;
  unlockAt?: string | null;
  caption: string;
  timeLabel: string;
  filmStamp: string;
  recallLabel?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaColors: readonly [string, string, string];
  accentColor: string;
  stats: {
    echoes: number;
    replies: number;
    saves: number;
  };
  viewer?: {
    echoed: boolean;
    saved: boolean;
    hidden?: boolean;
    reported?: boolean;
    blockedAuthor?: boolean;
  };
};

export type CheckInToken = {
  id?: string;
  placeName: string;
  issuedAt?: string;
  expiresAt?: string;
  issuedAtLabel: string;
  expiresInLabel: string;
  uploadsRemaining: number;
  unlockRadiusMeters?: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type UserLocation = Coordinates & {
  accuracyMeters?: number | null;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    handle: string;
    bio?: string;
    avatarUrl?: string;
  };
};

export type MemoryPostActionResult = {
  post: MemoryPost;
  echoed: boolean;
  saved: boolean;
  message: string;
};

export type PublicUser = {
  id: string;
  displayName: string;
  handle: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
};

export type MemoryPostUpdateResult = {
  post: MemoryPost;
  message: string;
};

export type UserConnection = PublicUser & {
  viewer: {
    isSelf: boolean;
    isFollowing: boolean;
    isBlocked: boolean;
  };
};

export type PostComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  createdAtLabel: string;
  author: PublicUser;
  canDelete: boolean;
};

export type PostDetail = {
  post: MemoryPost;
  comments: PostComment[];
};

export type PublicProfile = {
  user: PublicUser;
  stats: {
    posts: number;
    followers: number;
    following: number;
    echoes: number;
    saves: number;
  };
  viewer: {
    isSelf: boolean;
    isFollowing: boolean;
    isBlocked: boolean;
    blocksViewer?: boolean;
  };
  posts: MemoryPost[];
  savedPosts: MemoryPost[];
};

export type FollowResult = {
  profile: PublicProfile;
  following: boolean;
  message: string;
};

export type BlockResult = {
  profile: PublicProfile;
  blocked: boolean;
  message: string;
};

export type UserConnections = {
  followers: UserConnection[];
  following: UserConnection[];
};

export type ProfileUpdateResult = {
  session: AuthSession;
  profile: PublicProfile;
  message: string;
};

export type SafetySummary = {
  blockedCount: number;
  hiddenCount: number;
  reportedCount: number;
  notificationsEnabled: boolean;
  accountDeletionState: string;
};

export type NotificationItem = {
  id: string;
  type: 'echo' | 'save' | 'reply' | 'follow';
  actor: PublicUser;
  postId?: string;
  body?: string;
  createdAt: string;
  createdAtLabel: string;
  message: string;
  read: boolean;
};

export type SearchResults = {
  users: PublicUser[];
  places: PlaceBubble[];
  posts: MemoryPost[];
};

export type PlaceBubble = {
  id: string;
  name: string;
  placeName?: string;
  subtitle: string;
  city?: string;
  coordinates?: Coordinates;
  x: number;
  y: number;
  intensity: number;
  unlocked: boolean;
  unlockRadiusMeters?: number;
  uploadRadiusMeters?: number;
  memoryCount?: number;
  openCount?: number;
  lockedCount?: number;
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
