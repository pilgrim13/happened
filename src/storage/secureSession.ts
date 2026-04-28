// 장기적으로는 HttpOnly 쿠키 + BFF 패턴으로 전환 예정 (TODO Sprint 7+)
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { AuthSession } from '../types/happened';

/** 레거시 키 (localStorage 사용 시절) — 마이그레이션 후 삭제됨 */
const LEGACY_SESSION_KEY = 'happened-session';
const TUTORIAL_STORAGE_KEY = 'happened-tutorial-v1';

const isWeb = Platform.OS === 'web';
const hasWindow = typeof window !== 'undefined';

/** origin-bound 세션 키: 서브도메인 leak 위험 감소 */
function webSessionKey(): string {
  const origin = hasWindow ? window.location.origin : 'unknown';
  return `happened-session-${origin}`;
}

/** localStorage → sessionStorage 1회성 마이그레이션 */
function migrateSessionIfNeeded(): void {
  if (!hasWindow) return;
  const legacy = window.localStorage.getItem(LEGACY_SESSION_KEY);
  if (legacy) {
    window.sessionStorage.setItem(webSessionKey(), legacy);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    if (isWeb) {
      if (!hasWindow) return null;
      migrateSessionIfNeeded();
      const raw = window.sessionStorage.getItem(webSessionKey());
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    }
    const raw = await SecureStore.getItemAsync(LEGACY_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession | null): Promise<void> {
  try {
    if (isWeb) {
      if (!hasWindow) return;
      if (!session) {
        window.sessionStorage.removeItem(webSessionKey());
      } else {
        window.sessionStorage.setItem(webSessionKey(), JSON.stringify(session));
      }
      return;
    }
    if (!session) {
      await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
    } else {
      await SecureStore.setItemAsync(LEGACY_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    /* ignore */
  }
}

function tutorialKey(userId: string) {
  return `${TUTORIAL_STORAGE_KEY}:${userId}`;
}

export async function hasSeenTutorial(userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    if (isWeb) {
      if (!hasWindow) return false;
      return window.localStorage.getItem(tutorialKey(userId)) === '1';
    }
    const raw = await SecureStore.getItemAsync(tutorialKey(userId));
    return raw === '1';
  } catch {
    return false;
  }
}

export async function markTutorialSeen(userId?: string): Promise<void> {
  if (!userId) return;
  try {
    if (isWeb) {
      if (!hasWindow) return;
      window.localStorage.setItem(tutorialKey(userId), '1');
      return;
    }
    await SecureStore.setItemAsync(tutorialKey(userId), '1');
  } catch {
    /* ignore */
  }
}
