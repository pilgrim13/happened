import { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { useAppData } from '../contexts/AppDataContext';
import { useNotice } from '../contexts/NoticeContext';
import { useI18n, translateServerMessage } from '../i18n';
import { getCurrentLocation } from '../services/location';
import type { UserLocation, Visibility } from '../types/happened';

function showLocationPermissionAlert(
  title: string,
  message: string,
  openLabel: string,
  cancelLabel: string,
) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: openLabel, onPress: () => Linking.openSettings() },
  ]);
}

export function useCaptureFlow() {
  const { uploadMemory } = useAppData();
  const { showNotice } = useNotice();
  const { language, t } = useI18n();

  const [lastLocation, setLastLocation] = useState<UserLocation | null>(null);

  const handleLocationError = useCallback(
    (error: unknown) => {
      const isPermissionError =
        error instanceof Error && error.message.includes('permission');

      if (isPermissionError && Platform.OS !== 'web') {
        showLocationPermissionAlert(
          t('app.locationPermissionTitle'),
          t('app.locationPermissionMessage'),
          t('app.openSettings'),
          t('common.cancel'),
        );
      } else {
        showNotice(t('app.locationUnavailable'));
      }
    },
    [showNotice, t],
  );

  const locateMe = useCallback(async () => {
    try {
      // 사용자가 명시적으로 요청 → 캐시 무시하고 새로 fetch
      const location = await getCurrentLocation({ forceRefresh: true });
      setLastLocation(location);
      showNotice(
        t('app.locationUpdated', { accuracy: Math.round(location.accuracyMeters ?? 0) }),
      );
      return location;
    } catch (error) {
      handleLocationError(error);
      throw new Error(t('app.locationUnavailable'));
    }
  }, [handleLocationError, showNotice, t]);

  // HomeScreen의 "여기서 촬영" 버튼 → 캡처 탭으로 이동하기 전 위치 갱신 (캐시 OK)
  const captureAtPlace = useCallback((_placeName: string) => {
    getCurrentLocation()
      .then((loc) => setLastLocation(loc))
      .catch(() => undefined);
  }, []);

  const startPostFromHome = useCallback(() => {
    getCurrentLocation()
      .then((loc) => setLastLocation(loc))
      .catch(() => undefined);
  }, []);

  const upload = useCallback(
    async ({
      visibility = 'PublicAfter1h',
      caption,
      placeName,
      mediaItems,
    }: {
      visibility?: Visibility;
      caption: string;
      placeName?: string;
      mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
    }) => {
      // GPS 위치 획득 (캐시 OK — 업로드 직전 새 fetch 불필요)
      let location: UserLocation;
      try {
        location = await getCurrentLocation();
        setLastLocation(location);
      } catch (error) {
        handleLocationError(error);
        throw new Error('Location permission was not granted.');
      }

      try {
        const result = await uploadMemory({
          lat: location.latitude,
          lng: location.longitude,
          placeName,
          caption,
          visibility,
          mediaItems,
        });
        showNotice(t('app.memorySaved', { placeName: result.memory.placeName }));
        return result;
      } catch (error) {
        showNotice(
          error instanceof Error
            ? translateServerMessage(error.message, language)
            : t('app.memoryUploadFailed'),
        );
        throw error;
      }
    },
    [handleLocationError, language, showNotice, t, uploadMemory],
  );

  return {
    lastLocation,
    setLastLocation,
    locateMe,
    captureAtPlace,
    startPostFromHome,
    upload,
  };
}
