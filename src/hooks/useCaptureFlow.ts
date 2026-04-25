import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppData } from '../contexts/AppDataContext';
import { useNotice } from '../contexts/NoticeContext';
import { useI18n, localizePlaceName, translateServerMessage } from '../i18n';
import { distanceMeters, getCurrentLocation } from '../services/location';
import type { CheckInToken, PlaceBubble, UserLocation, Visibility } from '../types/happened';

type CapturePlaceCandidate = {
  placeName: string;
  distanceMeters: number;
  uploadRadiusMeters: number;
};

function getCapturePlaceCandidate(
  placeName: string | null,
  places: PlaceBubble[],
  location: UserLocation | null,
): CapturePlaceCandidate | null {
  if (!placeName || !location) return null;
  const place = places.find((c) => c.placeName === placeName || c.name === placeName);
  if (!place?.coordinates) return null;
  return {
    placeName: place.placeName ?? place.name,
    distanceMeters: distanceMeters(location, place.coordinates),
    uploadRadiusMeters: place.uploadRadiusMeters ?? 120,
  };
}

function findUploadableCapturePlace(places: PlaceBubble[], location: UserLocation | null) {
  if (!location) return null;
  const nearest = places
    .filter((p) => p.coordinates)
    .map((place) => ({
      place,
      distanceMeters: distanceMeters(location, place.coordinates!),
      uploadRadiusMeters: place.uploadRadiusMeters ?? 120,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  if (!nearest || nearest.distanceMeters > nearest.uploadRadiusMeters) return null;
  return nearest.place.placeName ?? nearest.place.name;
}

export function useCaptureFlow() {
  const { places, checkInToken, setCheckInToken, issueCheckIn, uploadMemory } = useAppData();
  const { showNotice } = useNotice();
  const { language, t } = useI18n();

  const [capturePlace, setCapturePlace] = useState<string | null>(null);
  const [capturePlaceMode, setCapturePlaceMode] = useState<'auto' | 'manual'>('auto');
  const [lastLocation, setLastLocation] = useState<UserLocation | null>(null);
  const autoLocateAttempted = useRef(false);

  const selectAutoCapturePlace = useCallback(
    (location: UserLocation | null) => {
      const next = findUploadableCapturePlace(places, location);
      setCheckInToken((current: CheckInToken | null) =>
        current?.placeName === next ? current : null,
      );
      setCapturePlace(next);
      return next;
    },
    [places, setCheckInToken],
  );

  const ensureLocation = useCallback(async () => {
    if (lastLocation) return lastLocation;
    try {
      const loc = await getCurrentLocation();
      setLastLocation(loc);
      return loc;
    } catch {
      return null;
    }
  }, [lastLocation]);

  // Auto-locate when capture tab is active in auto mode
  useEffect(() => {
    if (capturePlaceMode !== 'auto' || lastLocation || autoLocateAttempted.current) return;
    autoLocateAttempted.current = true;
    getCurrentLocation()
      .then((loc) => {
        setLastLocation(loc);
        const next = selectAutoCapturePlace(loc);
        if (!next) showNotice(t('app.noUploadablePlaceShort'));
      })
      .catch(() => undefined);
  }, [capturePlaceMode, lastLocation, selectAutoCapturePlace, showNotice, t]);

  useEffect(() => {
    if (capturePlaceMode === 'auto' && lastLocation) {
      selectAutoCapturePlace(lastLocation);
    }
  }, [capturePlaceMode, lastLocation, selectAutoCapturePlace]);

  const captureAtPlace = useCallback(
    (placeName: string) => {
      setCheckInToken((current: CheckInToken | null) =>
        current?.placeName === placeName ? current : null,
      );
      setCapturePlace(placeName);
      setCapturePlaceMode('manual');
      showNotice(t('app.readyAt', { placeName: localizePlaceName(placeName, language) }));
    },
    [language, setCheckInToken, showNotice, t],
  );

  const startPostFromHome = useCallback(() => {
    setCapturePlaceMode('auto');
    selectAutoCapturePlace(lastLocation);
    if (lastLocation) return;
    getCurrentLocation()
      .then((loc) => {
        setLastLocation(loc);
        const next = selectAutoCapturePlace(loc);
        if (!next) showNotice(t('app.noUploadablePlaceShort'));
      })
      .catch(() => undefined);
  }, [lastLocation, selectAutoCapturePlace, showNotice, t]);

  const issueCheckInToken = useCallback(async () => {
    if (!capturePlace) {
      showNotice(t('app.noUploadablePlace'));
      throw new Error(t('app.noUploadablePlace'));
    }
    let location: UserLocation | null = null;
    let clientDistance: number | undefined;
    try {
      location = await getCurrentLocation();
      setLastLocation(location);
      const place = places.find(
        (c) => c.placeName === capturePlace || c.name === capturePlace,
      );
      if (place?.coordinates) clientDistance = distanceMeters(location, place.coordinates);
    } catch {
      setLastLocation(null);
    }
    try {
      await issueCheckIn(capturePlace, {
        distanceMeters: clientDistance ?? 84,
        location: location ?? undefined,
      });
      showNotice(t('app.checkInIssued'));
    } catch (error) {
      showNotice(
        error instanceof Error
          ? translateServerMessage(error.message, language)
          : t('app.checkInFailed'),
      );
      throw error;
    }
  }, [capturePlace, issueCheckIn, language, places, showNotice, t]);

  const upload = useCallback(
    async ({
      visibility = 'PublicAfter1h',
      caption,
      mediaItems,
    }: {
      visibility?: Visibility;
      caption: string;
      mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }>;
    }) => {
      if (!checkInToken) {
        await issueCheckInToken();
        return null;
      }
      if (checkInToken.uploadsRemaining <= 0) {
        showNotice(t('app.noUploads'));
        return null;
      }
      if (!checkInToken.id) {
        showNotice(t('app.invalidToken'));
        return null;
      }
      try {
        const result = await uploadMemory({
          checkInTokenId: checkInToken.id,
          caption: caption || t('capture.defaultCaption'),
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
    [checkInToken, issueCheckInToken, language, showNotice, t, uploadMemory],
  );

  // Labels
  const locationLabel = (() => {
    if (!capturePlace) {
      return lastLocation ? t('app.noUploadablePlace') : t('app.captureFindingLocation');
    }
    if (!lastLocation) return t('app.captureNeedsLocation');
    const place = places.find(
      (c) => c.placeName === capturePlace || c.name === capturePlace,
    );
    if (!place?.coordinates) return t('app.locationCaptured');
    const meters = distanceMeters(lastLocation, place.coordinates);
    const uploadRadius = place.uploadRadiusMeters ?? 120;
    return t('app.distanceFromPlace', { meters, radius: uploadRadius });
  })();

  const distanceLabel = (() => {
    if (!capturePlace) return t('capture.noPlacePill');
    const candidate = getCapturePlaceCandidate(capturePlace, places, lastLocation);
    if (!candidate) return t('capture.distanceUnknown');
    return t('capture.distanceMeters', { meters: candidate.distanceMeters });
  })();

  const blockedMessage = (() => {
    if (!capturePlace) return t('app.noUploadablePlace');
    const candidate = getCapturePlaceCandidate(capturePlace, places, lastLocation);
    if (!candidate || candidate.distanceMeters <= candidate.uploadRadiusMeters) return null;
    return t('app.outsideUploadRadius', {
      distance: candidate.distanceMeters,
      radius: candidate.uploadRadiusMeters,
    });
  })();

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

  return {
    capturePlace,
    capturePlaceMode,
    setCapturePlaceMode,
    lastLocation,
    setLastLocation,
    locateMe,
    ensureLocation,
    captureAtPlace,
    startPostFromHome,
    issueCheckInToken,
    upload,
    locationLabel,
    distanceLabel,
    blockedMessage,
    displayPlaceName: capturePlace
      ? localizePlaceName(capturePlace, language)
      : t('capture.currentLocation'),
  };
}
