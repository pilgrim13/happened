import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { memoryPosts, placeBubbles, timelineMonths } from '../src/data/happened';
import type { CheckInToken, MemoryPost, MemoryPostAction, PlaceBubble, TimelineMonth } from '../src/types/happened';

export type StoreUser = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  bio?: string;
  avatarUrl?: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type StoreSession = {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

export type StorePostAction = {
  id: string;
  postId: string;
  userId?: string | null;
  actorKey: string;
  action: MemoryPostAction;
  body?: string;
  createdAt: string;
};

export type StoreFollow = {
  followerId: string;
  followingId: string;
  createdAt: string;
};

export type StoreBlock = {
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

export type StoreNotificationRead = {
  userId: string;
  notificationId: string;
  readAt: string;
};

export type LocalStoreState = {
  version: 1;
  users: StoreUser[];
  sessions: StoreSession[];
  posts: MemoryPost[];
  places: PlaceBubble[];
  timelineMonths: TimelineMonth[];
  checkInTokens: Array<CheckInToken & { userId?: string | null }>;
  postActions: StorePostAction[];
  follows: StoreFollow[];
  blocks: StoreBlock[];
  notificationReads: StoreNotificationRead[];
};

function createInitialState(): LocalStoreState {
  return {
    version: 1,
    users: [],
    sessions: [],
    posts: [...memoryPosts],
    places: [...placeBubbles],
    timelineMonths: [...timelineMonths],
    checkInTokens: [],
    postActions: [],
    follows: [],
    blocks: [],
    notificationReads: [],
  };
}

export class LocalStore {
  private readonly filePath: string;
  private state: LocalStoreState;

  constructor(filePath = path.join(process.cwd(), '.local', 'happened-store.json')) {
    this.filePath = filePath;
    this.state = this.load();
  }

  get data() {
    return this.state;
  }

  save() {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  private load() {
    if (!existsSync(this.filePath)) {
      const initial = createInitialState();
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, `${JSON.stringify(initial, null, 2)}\n`);
      return initial;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as LocalStoreState;

      return {
        ...createInitialState(),
        ...parsed,
        version: 1 as const,
        posts: parsed.posts?.length ? parsed.posts : [...memoryPosts],
        places: parsed.places?.length ? parsed.places : [...placeBubbles],
        timelineMonths: parsed.timelineMonths?.length ? parsed.timelineMonths : [...timelineMonths],
      };
    } catch {
      return createInitialState();
    }
  }
}
