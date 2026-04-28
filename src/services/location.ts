import { Platform } from 'react-native';
import * as Location from 'expo-location';

import type { Coordinates, UserLocation } from '../types/happened';

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

// 모듈 스코프 인메모리 캐시 — 60초 유효
const LOCATION_CACHE_TTL_MS = 60_000;
let _locationCache: { location: UserLocation; timestamp: number } | null = null;

function getBrowserLocation() {
  return new Promise<UserLocation>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser geolocation is not available.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => reject(new Error('Location permission was not granted.')),
      {
        enableHighAccuracy: false,
        maximumAge: LOCATION_CACHE_TTL_MS,
        timeout: 10_000,
      },
    );
  });
}

/**
 * 현재 위치를 반환한다.
 * - 기본: 60초 인메모리 캐시 사용 (배터리 절약)
 * - forceRefresh: true → 캐시 무시하고 새로 fetch
 */
export async function getCurrentLocation(
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<UserLocation> {
  // 캐시 히트
  if (!forceRefresh && _locationCache && Date.now() - _locationCache.timestamp < LOCATION_CACHE_TTL_MS) {
    return _locationCache.location;
  }

  if (Platform.OS === 'web') {
    const location = await getBrowserLocation();
    _locationCache = { location, timestamp: Date.now() };
    return location;
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Location permission was not granted.');
  }

  const result = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const location: UserLocation = {
    latitude: result.coords.latitude,
    longitude: result.coords.longitude,
    accuracyMeters: result.coords.accuracy,
  };

  _locationCache = { location, timestamp: Date.now() };
  return location;
}
