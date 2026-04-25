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
        enableHighAccuracy: true,
        maximumAge: 20_000,
        timeout: 10_000,
      },
    );
  });
}

export async function getCurrentLocation(): Promise<UserLocation> {
  if (Platform.OS === 'web') {
    return getBrowserLocation();
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Location permission was not granted.');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
  };
}
