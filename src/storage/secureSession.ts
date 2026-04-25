import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { AuthSession } from '../types/happened';

const SESSION_STORAGE_KEY = 'happened-session';
const TUTORIAL_STORAGE_KEY = 'happened-tutorial-v1';

const isWeb = Platform.OS === 'web';
const hasWindow = typeof window !== 'undefined';

export async function loadSession(): Promise<AuthSession | null> {
  try {
    if (isWeb) {
      if (!hasWindow) return null;
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    }
    const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
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
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
      return;
    }
    if (!session) {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
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
