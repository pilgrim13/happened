import { LinearGradient } from 'expo-linear-gradient';
import { LocateFixed, Lock, MapPin, Minus, Navigation, Plus, RadioTower } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ImageStyle, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { placeBubbles } from '../data/happened';
import { localizePlaceName, useI18n } from '../i18n';
import { distanceMeters } from '../services/location';
import { colors, gradients, fonts, radius } from '../theme/tokens';
import type { Coordinates, PlaceBubble, UserLocation } from '../types/happened';

type Props = {
  places?: PlaceBubble[];
  userLocation?: UserLocation | null;
  onOpenPlace?: (placeName: string) => void;
  onLocate?: () => void | UserLocation | Promise<void | UserLocation>;
};

type ProjectedPoint = {
  x: number;
  y: number;
};

const TILE_SIZE = 256;
const DEFAULT_MAP_ZOOM = 14;
const MIN_MAP_ZOOM = 12;
const MAX_MAP_ZOOM = 17;
const SEOUL_CENTER = { latitude: 37.5047, longitude: 127.0491 };
const TILE_SOURCE_ZOOM_OFFSET = Platform.OS === 'web' ? 1 : 0;
const RENDER_TILE_SIZE = TILE_SIZE / 2 ** TILE_SOURCE_ZOOM_OFFSET;
const mapWebInteractionStyle = Platform.OS === 'web'
  ? ({
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
  } as unknown as ViewStyle)
  : null;
const passiveTileWebStyle = Platform.OS === 'web'
  ? ({
    filter: 'contrast(1.08) saturate(1.08)',
    pointerEvents: 'none',
  } as unknown as ImageStyle)
  : null;

function formatDistance(value: number | null, pendingLabel: string) {
  if (value === null) {
    return pendingLabel;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }

  return `${value} m`;
}

function getPlaceName(place: PlaceBubble) {
  return place.placeName ?? getDetailPlaceName(place.id);
}

function projectCoordinate(coordinate: Coordinates, zoom: number): ProjectedPoint {
  const sinLatitude = Math.sin((coordinate.latitude * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((coordinate.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

function unprojectCoordinate(point: ProjectedPoint, zoom: number): Coordinates {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const normalizedY = 0.5 - point.y / scale;
  const latitude = (90 - (360 * Math.atan(Math.exp(-normalizedY * 2 * Math.PI))) / Math.PI);

  return {
    latitude,
    longitude,
  };
}

function getMapCenter(places: PlaceBubble[], userLocation?: UserLocation | null): Coordinates {
  if (userLocation) {
    return userLocation;
  }

  const coordinates = places
    .map((place) => place.coordinates)
    .filter((coordinate): coordinate is Coordinates => Boolean(coordinate));

  if (!coordinates.length) {
    return SEOUL_CENTER;
  }

  return {
    latitude: coordinates.reduce((total, coordinate) => total + coordinate.latitude, 0) / coordinates.length,
    longitude: coordinates.reduce((total, coordinate) => total + coordinate.longitude, 0) / coordinates.length,
  };
}

function getMetersPerPixel(latitude: number, zoom: number) {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

function wrapTileX(x: number, zoom: number) {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
}

function getTileUrl(x: number, y: number, zoom: number) {
  return `https://tile.openstreetmap.org/${zoom}/${wrapTileX(x, zoom)}/${y}.png`;
}

function buildTiles(center: Coordinates, width: number, height: number, zoom: number) {
  const centerPoint = projectCoordinate(center, zoom);
  const left = centerPoint.x - width / 2;
  const top = centerPoint.y - height / 2;
  const sourceZoom = zoom + TILE_SOURCE_ZOOM_OFFSET;
  const minTileX = Math.floor(left / RENDER_TILE_SIZE);
  const maxTileX = Math.floor((left + width) / RENDER_TILE_SIZE);
  const minTileY = Math.max(0, Math.floor(top / RENDER_TILE_SIZE));
  const maxTileY = Math.min(2 ** sourceZoom - 1, Math.floor((top + height) / RENDER_TILE_SIZE));
  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      tiles.push({
        key: `${tileX}:${tileY}`,
        url: getTileUrl(tileX, tileY, sourceZoom),
        left: tileX * RENDER_TILE_SIZE - left,
        top: tileY * RENDER_TILE_SIZE - top,
      });
    }
  }

  return {
    tiles,
    bounds: { left, top },
  };
}

function getScreenPoint(coordinate: Coordinates, bounds: { left: number; top: number }, zoom: number) {
  const point = projectCoordinate(coordinate, zoom);

  return {
    left: point.x - bounds.left,
    top: point.y - bounds.top,
  };
}

function getPlaceDistance(place: PlaceBubble, userLocation?: UserLocation | null) {
  if (!place.coordinates || !userLocation) {
    return null;
  }

  return distanceMeters(userLocation, place.coordinates);
}

function touchDistance(touches?: ArrayLike<{ pageX: number; pageY: number }>) {
  if (!touches || touches.length < 2) {
    return null;
  }

  const first = touches[0];
  const second = touches[1];

  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
}

function getDynamicPlaceState(place: PlaceBubble, userLocation: UserLocation | null | undefined, t: ReturnType<typeof useI18n>['t']) {
  const distance = getPlaceDistance(place, userLocation);

  if (distance === null) {
    return {
      label: place.unlocked ? t('map.knownPlace') : t('common.locked'),
      color: place.unlocked ? colors.setlogMint : colors.setlogPink,
    };
  }

  if (distance <= (place.uploadRadiusMeters ?? 120)) {
    return {
      label: t('map.checkIn'),
      color: colors.setlogMint,
    };
  }

  if (distance <= (place.unlockRadiusMeters ?? 200)) {
    return {
      label: t('common.open'),
      color: colors.setlogBlue,
    };
  }

  return {
    label: t('common.locked'),
    color: colors.setlogPink,
  };
}

export function MapScreen({ places = placeBubbles, userLocation, onOpenPlace, onLocate }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const { width } = useWindowDimensions();
  const [locating, setLocating] = useState(false);
  const [mapDragging, setMapDragging] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [manualCenter, setManualCenter] = useState<Coordinates | null>(null);
  const panStartCenter = useRef<Coordinates | null>(null);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef(DEFAULT_MAP_ZOOM);
  const frameWidth = Math.max(288, Math.min(width - 32, 560));
  const mapHeight = Math.max(390, Math.min(500, Math.round(frameWidth * 1.18)));
  const defaultCenter = useMemo(() => getMapCenter(places, userLocation), [places, userLocation]);
  const center = manualCenter ?? defaultCenter;
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const metersPerPixel = getMetersPerPixel(center.latitude, zoom);
  const { tiles, bounds } = useMemo(() => buildTiles(center, frameWidth, mapHeight, zoom), [center, frameWidth, mapHeight, zoom]);

  // 타일 캐시 — 이전 타일 Set을 유지, buildTiles 결과와 diff하여 변경분만 mount/unmount
  const tileMapRef = useRef(new Map<string, { key: string; url: string; left: number; top: number }>());
  const displayTiles = useMemo(() => {
    const map = tileMapRef.current;
    const activeKeys = new Set(tiles.map((t) => t.key));

    // 뷰포트 밖 타일 제거
    for (const key of map.keys()) {
      if (!activeKeys.has(key)) map.delete(key);
    }

    // 신규/위치 변경 타일 추가
    for (const tile of tiles) {
      map.set(tile.key, tile);
    }

    return Array.from(map.values());
  }, [tiles]);
  const userPoint = userLocation ? getScreenPoint(userLocation, bounds, zoom) : null;

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches?.length >= 2,
        onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches?.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          return touches?.length >= 2 || Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
        },
        onMoveShouldSetPanResponderCapture: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          return touches?.length >= 2 || Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
        },
        onPanResponderGrant: (event) => {
          panStartCenter.current = centerRef.current;
          pinchStartDistance.current = touchDistance(event.nativeEvent.touches);
          pinchStartZoom.current = zoomRef.current;
          setMapDragging(true);
        },
        onPanResponderMove: (event, gesture) => {
          const pinchDistance = touchDistance(event.nativeEvent.touches);

          if (pinchDistance) {
            if (!pinchStartDistance.current) {
              pinchStartDistance.current = pinchDistance;
              pinchStartZoom.current = zoomRef.current;
              return;
            }

            const scale = pinchDistance / pinchStartDistance.current;

            if (scale > 1.18 && zoomRef.current < MAX_MAP_ZOOM) {
              setZoom((current) => Math.min(MAX_MAP_ZOOM, current + 1));
              pinchStartDistance.current = pinchDistance;
              pinchStartZoom.current = Math.min(MAX_MAP_ZOOM, pinchStartZoom.current + 1);
            } else if (scale < 0.84 && zoomRef.current > MIN_MAP_ZOOM) {
              setZoom((current) => Math.max(MIN_MAP_ZOOM, current - 1));
              pinchStartDistance.current = pinchDistance;
              pinchStartZoom.current = Math.max(MIN_MAP_ZOOM, pinchStartZoom.current - 1);
            }
            return;
          }

          const currentZoom = zoomRef.current;
          const startCenter = panStartCenter.current ?? centerRef.current;
          const startPoint = projectCoordinate(startCenter, currentZoom);
          setManualCenter(unprojectCoordinate({
            x: startPoint.x - gesture.dx,
            y: startPoint.y - gesture.dy,
          }, currentZoom));
        },
        onPanResponderRelease: () => {
          pinchStartDistance.current = null;
          setMapDragging(false);
        },
        onPanResponderTerminate: () => {
          pinchStartDistance.current = null;
          setMapDragging(false);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => false,
      }),
    [],
  );

  useEffect(() => {
    if (userLocation) {
      setManualCenter(userLocation);
    }
  }, [userLocation]);

  const locate = async () => {
    setLocating(true);
    try {
      const nextLocation = await onLocate?.();
      if (nextLocation) {
        setManualCenter(nextLocation);
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#F8F7FF', '#FFF2F5']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} scrollEnabled={!mapDragging} showsVerticalScrollIndicator={false}>
        <View style={[styles.frame, { width: frameWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t('map.live')}</Text>
              <Text style={styles.title}>{t('map.title')}</Text>
              <Text style={styles.subtitle}>{userLocation ? t('map.accuracy', { distance: formatDistance(Math.round(userLocation.accuracyMeters ?? 0), t('map.gpsPending')) }) : t('map.locateHint')}</Text>
            </View>
            <Pressable style={[styles.locationButton, locating && styles.locationButtonBusy]} onPress={locate} disabled={locating}>
              <LocateFixed color={colors.setlogInk} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View testID="map-stage" style={[styles.mapStage, mapWebInteractionStyle, { height: mapHeight }]} {...panResponder.panHandlers}>
            {displayTiles.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: tile.url }}
                resizeMode="stretch"
                style={[styles.mapTile, passiveTileWebStyle, { left: tile.left, top: tile.top }]}
              />
            ))}
            <View pointerEvents="none" style={styles.mapTint} />
            {places.map((place) => {
              const coordinate = place.coordinates;

              if (!coordinate) {
                return null;
              }

              const point = getScreenPoint(coordinate, bounds, zoom);
              const state = getDynamicPlaceState(place, userLocation, t);
              const radiusMeters = place.uploadRadiusMeters ?? 120;
              const radiusPixels = Math.max(18, Math.min(72, radiusMeters / metersPerPixel));

              return (
                <View key={place.id} style={[styles.placeLayer, { left: point.left, top: point.top }]}>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.radiusCircle,
                      {
                        width: radiusPixels * 2,
                        height: radiusPixels * 2,
                        borderRadius: radiusPixels,
                        left: -radiusPixels,
                        top: -radiusPixels,
                        borderColor: state.color,
                      },
                    ]}
                  />
                  <Pressable
                    testID={`place-marker-${place.id}`}
                    onPress={() => onOpenPlace?.(getPlaceName(place))}
                    style={[
                      styles.placeMarker,
                      {
                        backgroundColor: state.color,
                        borderColor: `${state.color}66`,
                      },
                    ]}
                  >
                    {state.label === t('common.locked') ? <Lock color={colors.setlogInk} size={14} strokeWidth={2.8} /> : <MapPin color={colors.setlogInk} size={14} strokeWidth={2.8} />}
                    <Text numberOfLines={1} style={styles.markerText}>{localizePlaceName(getPlaceName(place), language)}</Text>
                  </Pressable>
                </View>
              );
            })}
            {userPoint ? (
              <View style={[styles.userLayer, { left: userPoint.left, top: userPoint.top }]}>
                <View style={styles.userPulse} />
                <View testID="user-location-marker" style={styles.userMarker}>
                  <Navigation color={colors.setlogInk} size={16} fill={colors.setlogInk} />
                </View>
              </View>
            ) : null}
            <View pointerEvents="none" style={styles.attribution}>
              <Text style={styles.attributionText}>OpenStreetMap</Text>
            </View>
            <View style={styles.zoomControls}>
              <Pressable
                style={[styles.zoomButton, zoom >= MAX_MAP_ZOOM && styles.zoomButtonDisabled]}
                onPress={() => setZoom((current) => Math.min(MAX_MAP_ZOOM, current + 1))}
                disabled={zoom >= MAX_MAP_ZOOM}
              >
                <Plus color={colors.setlogInk} size={18} strokeWidth={3} />
              </Pressable>
              <Pressable
                style={[styles.zoomButton, zoom <= MIN_MAP_ZOOM && styles.zoomButtonDisabled]}
                onPress={() => setZoom((current) => Math.max(MIN_MAP_ZOOM, current - 1))}
                disabled={zoom <= MIN_MAP_ZOOM}
              >
                <Minus color={colors.setlogInk} size={18} strokeWidth={3} />
              </Pressable>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <RadioTower color={userLocation ? colors.setlogMint : colors.setlogMuted} size={18} strokeWidth={2.6} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>{userLocation ? t('map.liveActive') : t('map.locationInactive')}</Text>
              <Text style={styles.statusText}>{userLocation ? t('map.liveActiveText') : t('map.locationInactiveText')}</Text>
            </View>
          </View>

          <View style={styles.legendRow}>
            {gradients.heat.map((color, index) => (
              <View key={color} style={[styles.heatSegment, { backgroundColor: color, opacity: 0.45 + index * 0.14 }]} />
            ))}
          </View>

          <View style={styles.placeList}>
            {places.map((place) => {
              const distance = getPlaceDistance(place, userLocation);
              const state = getDynamicPlaceState(place, userLocation, t);

              return (
                <Pressable key={place.id} style={styles.placeRow} onPress={() => onOpenPlace?.(getPlaceName(place))}>
                  <View style={[styles.placeDot, { backgroundColor: state.color }]} />
                  <View style={styles.placeCopy}>
                    <Text style={styles.placeName}>{localizePlaceName(getPlaceName(place), language)}</Text>
                    <Text style={styles.placeSubtitle}>{formatDistance(distance, t('map.gpsPending'))} - {place.memoryCount ? t('map.memoryCount', { count: place.memoryCount }) : place.subtitle}</Text>
                  </View>
                  <Text style={[styles.placeState, { color: state.color }]}>{state.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function getDetailPlaceName(placeId: string) {
  const placeNames: Record<string, string> = {
    seolleung: 'Seolleung Station Cafe',
    office: 'Gangnam Office',
    cafe: 'Corner Cafe',
    school: 'Daechi School Yard',
    river: 'Han River Steps',
  };

  return placeNames[placeId] ?? 'Seolleung Station Cafe';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  frame: {
    maxWidth: 560,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 3,
  },
  subtitle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginLeft: 12,
  },
  locationButtonBusy: {
    opacity: 0.58,
  },
  mapStage: {
    width: '100%',
    borderRadius: 26,
    borderColor: colors.setlogLine,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
    shadowColor: colors.setlogInk,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  mapTile: {
    position: 'absolute',
    width: RENDER_TILE_SIZE,
    height: RENDER_TILE_SIZE,
  },
  mapTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  placeLayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusCircle: {
    position: 'absolute',
    borderWidth: 1,
    opacity: 0.24,
    backgroundColor: 'rgba(135, 240, 182, 0.06)',
  },
  placeMarker: {
    minWidth: 74,
    maxWidth: 116,
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    shadowColor: colors.setlogInk,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  markerText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    flexShrink: 1,
  },
  userLayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(185, 216, 255, 0.28)',
    borderColor: 'rgba(185, 216, 255, 0.72)',
    borderWidth: 1,
  },
  userMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogBlue,
    borderColor: colors.setlogPaper,
    borderWidth: 2,
  },
  attribution: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 254, 248, 0.82)',
  },
  attributionText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  zoomControls: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 254, 248, 0.9)',
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  zoomButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  zoomButtonDisabled: {
    opacity: 0.45,
  },
  statusCard: {
    minHeight: 68,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 12,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(135, 240, 182, 0.22)',
    marginRight: 10,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  statusText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 16,
  },
  heatSegment: {
    flex: 1,
  },
  placeList: {
    gap: 9,
  },
  placeRow: {
    minHeight: 64,
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.setlogPaper,
  },
  placeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  placeCopy: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  placeSubtitle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  placeState: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 8,
  },
});
