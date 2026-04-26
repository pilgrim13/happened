import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';

import { registerPushToken, revokePushToken } from '../services/happenedApi';
import { useSession } from '../contexts/SessionContext';

export function usePushRegistration() {
  const { session } = useSession();
  const [isRegistered, setIsRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  const register = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    setBusy(true);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        // 사용자가 거부 — 조용히 종료
        return false;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await registerPushToken(tokenData.data, platform, session?.token);
      setIsRegistered(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [session?.token]);

  const revoke = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web') {
      return;
    }

    setBusy(true);
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await revokePushToken(tokenData.data, session?.token);
      setIsRegistered(false);
    } catch {
      setIsRegistered(false);
    } finally {
      setBusy(false);
    }
  }, [session?.token]);

  return { register, revoke, isRegistered, busy };
}
