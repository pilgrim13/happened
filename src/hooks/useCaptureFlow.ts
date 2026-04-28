import { useCallback, useState } from 'react';

import { useAppData } from '../contexts/AppDataContext';
import { useNotice } from '../contexts/NoticeContext';
import { useI18n, translateServerMessage } from '../i18n';
import { getCurrentLocation } from '../services/location';
import type { UserLocation, Visibility } from '../types/happened';

export function useCaptureFlow() {
  const { uploadMemory } = useAppData();
  const { showNotice } = useNotice();
  const { language, t } = useI18n();

  const [lastLocation, setLastLocation] = useState<UserLocation | null>(null);

  const locateMe = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      setLastLocation(location);
      showNotice(
        t('app.locationUpdated', { accuracy: Math.round(location.accuracyMeters ?? 0) }),
      );
      return location;
    } catch {
      showNotice(t('app.locationUnavailable'));
      throw new Error(t('app.locationUnavailable'));
    }
  }, [showNotice, t]);

  // HomeScreen의 "여기서 촬영" 버튼 → 캡처 탭으로 이동하기 전 위치 갱신
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
      // GPS 위치 획득
      let location: UserLocation;
      try {
        location = await getCurrentLocation();
        setLastLocation(location);
      } catch {
        showNotice(t('capture.locationRequired'));
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
    [language, showNotice, t, uploadMemory],
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
