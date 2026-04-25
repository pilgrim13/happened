import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabs } from './src/components/BottomTabs';
import { memoryPosts } from './src/data/happened';
import { AuthScreen } from './src/screens/AuthScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { PermissionsScreen } from './src/screens/PermissionsScreen';
import { PlaceDetailScreen } from './src/screens/PlaceDetailScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { TutorialScreen } from './src/screens/TutorialScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useVisualViewportHeight } from './src/hooks/useVisualViewportHeight';
import { I18nProvider, localizePlaceName, translateServerMessage, useI18n } from './src/i18n';
import {
  createMemory as createApiMemory,
  fetchFeed,
  fetchNotifications,
  fetchPlaces,
  fetchSafetySummary,
  fetchSearchResults,
  fetchSession,
  fetchTimeline,
  issueCheckInToken as issueApiCheckInToken,
  markNotificationsRead,
  toggleBlock as toggleApiBlock,
  updatePostAction as updateApiPostAction,
} from './src/services/happenedApi';
import { distanceMeters, getCurrentLocation } from './src/services/location';
import { colors, fonts, radius } from './src/theme/tokens';
import type { AppStage, AuthSession, CheckInToken, MemoryPost, MemoryPostAction, NotificationItem, PlaceBubble, SafetySummary, SearchResults, TabKey, TimelineMonth, UserLocation, Visibility } from './src/types/happened';

const SESSION_STORAGE_KEY = 'happened-session';
const TUTORIAL_STORAGE_KEY = 'happened-tutorial-v1';

type CapturePlaceCandidate = {
  placeName: string;
  distanceMeters: number;
  uploadRadiusMeters: number;
};

function getPrototypeParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return {
      screen: 'home' as TabKey,
      homePost: 0,
      capture: false,
      stage: null as AppStage | null,
      place: null as string | null,
      postId: null as string | null,
      profile: null as string | null,
      tutorial: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen') as TabKey | null;
  const stage = params.get('stage') as AppStage | null;
  const homePost = Number.parseInt(params.get('homePost') ?? '0', 10);
  const validScreens: TabKey[] = ['home', 'map', 'capture', 'timeline', 'profile'];
  const validStages: AppStage[] = ['welcome', 'auth', 'permissions', 'app'];

  return {
    screen: screen && validScreens.includes(screen) ? screen : 'home',
    homePost: Number.isFinite(homePost) ? homePost : 0,
    capture: params.get('capture') === '1',
    stage: stage && validStages.includes(stage) ? stage : null,
    place: params.get('place'),
    postId: params.get('postId'),
    profile: params.get('profile'),
    tutorial: params.get('tutorial') === '1',
  };
}

function getCapturePlaceCandidate(placeName: string | null, places: PlaceBubble[], location: UserLocation | null): CapturePlaceCandidate | null {
  if (!placeName || !location) {
    return null;
  }

  const place = places.find((candidate) => candidate.placeName === placeName || candidate.name === placeName);

  if (!place?.coordinates) {
    return null;
  }

  return {
    placeName: place.placeName ?? place.name,
    distanceMeters: distanceMeters(location, place.coordinates),
    uploadRadiusMeters: place.uploadRadiusMeters ?? 120,
  };
}

function findUploadableCapturePlace(places: PlaceBubble[], location: UserLocation | null) {
  if (!location) {
    return null;
  }

  const nearest = places
    .filter((place) => place.coordinates)
    .map((place) => ({
      place,
      distanceMeters: distanceMeters(location, place.coordinates!),
      uploadRadiusMeters: place.uploadRadiusMeters ?? 120,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

  if (!nearest || nearest.distanceMeters > nearest.uploadRadiusMeters) {
    return null;
  }

  return nearest.place.placeName ?? nearest.place.name;
}

function getCaptureLocationLabel(placeName: string | null, places: PlaceBubble[], location: UserLocation | null, t: ReturnType<typeof useI18n>['t']) {
  if (!placeName) {
    return location ? t('app.noUploadablePlace') : t('app.captureFindingLocation');
  }

  if (!location) {
    return t('app.captureNeedsLocation');
  }

  const place = places.find((candidate) => candidate.placeName === placeName || candidate.name === placeName);

  if (!place?.coordinates) {
    return t('app.locationCaptured');
  }

  const meters = distanceMeters(location, place.coordinates);
  const uploadRadius = place.uploadRadiusMeters ?? 120;

  return t('app.distanceFromPlace', { meters, radius: uploadRadius });
}

function getCaptureDistanceLabel(placeName: string | null, places: PlaceBubble[], location: UserLocation | null, t: ReturnType<typeof useI18n>['t']) {
  if (!placeName) {
    return t('capture.noPlacePill');
  }

  const candidate = getCapturePlaceCandidate(placeName, places, location);

  if (!candidate) {
    return t('capture.distanceUnknown');
  }

  return t('capture.distanceMeters', { meters: candidate.distanceMeters });
}

function getCaptureBlockedMessage(placeName: string | null, places: PlaceBubble[], location: UserLocation | null, t: ReturnType<typeof useI18n>['t']) {
  if (!placeName) {
    return t('app.noUploadablePlace');
  }

  const candidate = getCapturePlaceCandidate(placeName, places, location);

  if (!candidate || candidate.distanceMeters <= candidate.uploadRadiusMeters) {
    return null;
  }

  return t('app.outsideUploadRadius', {
    distance: candidate.distanceMeters,
    radius: candidate.uploadRadiusMeters,
  });
}

function readCachedSession() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeCachedSession(session: AuthSession | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function tutorialKey(userId: string) {
  return `${TUTORIAL_STORAGE_KEY}:${userId}`;
}

function hasSeenTutorial(userId?: string) {
  if (!userId || Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(tutorialKey(userId)) === '1';
}

function markTutorialSeen(userId?: string) {
  if (!userId || Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(tutorialKey(userId), '1');
}

function AppShell() {
  const { language, t } = useI18n();
  const prototypeParams = getPrototypeParams();
  const cachedSession = readCachedSession();
  const viewportHeight = useVisualViewportHeight();
  const mapAutoLocateAttempted = useRef(false);
  const captureAutoLocateAttempted = useRef(false);
  const [stage, setStage] = useState<AppStage>(prototypeParams.stage ?? (prototypeParams.capture || cachedSession ? 'app' : 'welcome'));
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [activeTab, setActiveTab] = useState<TabKey>(prototypeParams.screen);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(prototypeParams.place);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(prototypeParams.postId);
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(prototypeParams.profile);
  const [capturePlace, setCapturePlace] = useState<string | null>(null);
  const [capturePlaceMode, setCapturePlaceMode] = useState<'auto' | 'manual'>('auto');
  const [checkInToken, setCheckInToken] = useState<CheckInToken | null>(null);
  const [session, setSession] = useState<AuthSession | null>(cachedSession);
  const [feedPosts, setFeedPosts] = useState<MemoryPost[]>(memoryPosts);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [places, setPlaces] = useState<PlaceBubble[]>([]);
  const [timeline, setTimeline] = useState<TimelineMonth[]>([]);
  const [safetySummary, setSafetySummary] = useState<SafetySummary | null>(null);
  const [lastLocation, setLastLocation] = useState<UserLocation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(prototypeParams.tutorial);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const refreshAppData = useCallback(async () => {
    const [posts, apiPlaces, months, nextNotifications, nextSafetySummary] = await Promise.all([
      fetchFeed(undefined, session?.token),
      fetchPlaces(),
      fetchTimeline(),
      fetchNotifications(session?.token),
      session?.token ? fetchSafetySummary(session.token).catch(() => null) : Promise.resolve(null),
    ]);
    setFeedPosts(posts);
    setPlaces(apiPlaces);
    setTimeline(months);
    setNotifications(nextNotifications);
    setSafetySummary(nextSafetySummary);
  }, [session?.token]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const setViewportHeight = () => {
      const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const height = Math.round(viewportWidth >= 720 ? window.innerHeight : window.visualViewport?.height ?? window.innerHeight);
      document.documentElement.style.setProperty('--happened-viewport-height', `${height}px`);
    };

    setViewportHeight();
    document.documentElement.style.backgroundColor = colors.setlogBg;
    document.documentElement.style.height = 'var(--happened-viewport-height)';
    document.documentElement.style.width = '100vw';
    document.documentElement.style.maxWidth = '100vw';
    document.body.style.backgroundColor = colors.setlogBg;
    document.body.style.height = 'var(--happened-viewport-height)';
    document.body.style.width = '100vw';
    document.body.style.maxWidth = '100vw';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';

    const root = document.getElementById('root');
    if (root) {
      root.style.height = 'var(--happened-viewport-height)';
      root.style.minHeight = 'var(--happened-viewport-height)';
      root.style.width = '100vw';
      root.style.maxWidth = '100vw';
      root.style.overflow = 'hidden';
      root.style.backgroundColor = colors.setlogBg;
    }

    window.addEventListener('resize', setViewportHeight);
    window.visualViewport?.addEventListener('resize', setViewportHeight);
    window.visualViewport?.addEventListener('scroll', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.visualViewport?.removeEventListener('resize', setViewportHeight);
      window.visualViewport?.removeEventListener('scroll', setViewportHeight);
    };
  }, []);

  useEffect(() => {
    refreshAppData()
      .catch(() => undefined);
  }, [refreshAppData]);

  useEffect(() => {
    if (!cachedSession?.token || prototypeParams.stage) {
      return undefined;
    }

    let active = true;

    fetchSession(cachedSession.token)
      .then((nextSession) => {
        if (!active) {
          return;
        }

        setSession(nextSession);
        writeCachedSession(nextSession);
        setStage('app');
        setTutorialVisible(!hasSeenTutorial(nextSession.user.id));
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setSession(null);
        writeCachedSession(null);
        setStage('welcome');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const enterApp = useCallback(() => {
    setStage('app');
    setActiveTab('home');
    if (session?.user.id && !hasSeenTutorial(session.user.id)) {
      setTutorialVisible(true);
      return;
    }
    showNotice(t('app.ready'));
  }, [session?.user.id, showNotice, t]);

  const completeTutorial = useCallback(() => {
    markTutorialSeen(session?.user.id);
    setTutorialVisible(false);
    setStage('app');
    setActiveTab('home');
    showNotice(t('app.ready'));
  }, [session?.user.id, showNotice, t]);

  const openPlace = useCallback((placeName: string) => {
    setSelectedPostId(null);
    setSelectedProfileHandle(null);
    setSelectedPlace(placeName);
  }, []);

  const openPost = useCallback((postId: string) => {
    setSelectedPlace(null);
    setSelectedProfileHandle(null);
    setSelectedPostId(postId);
  }, []);

  const openProfile = useCallback((handle: string) => {
    setSelectedPlace(null);
    setSelectedPostId(null);
    setSelectedProfileHandle(handle.replace(/^@+/, ''));
  }, []);

  const captureAtPlace = useCallback(
    (placeName: string) => {
      setCheckInToken((current) => (current?.placeName === placeName ? current : null));
      setCapturePlace(placeName);
      setCapturePlaceMode('manual');
      setSelectedPlace(null);
      setSelectedPostId(null);
      setSelectedProfileHandle(null);
      setActiveTab('capture');
      showNotice(t('app.readyAt', { placeName: localizePlaceName(placeName, language) }));
    },
    [language, showNotice, t],
  );

  const selectAutoCapturePlace = useCallback((location: UserLocation | null) => {
    const nextPlace = findUploadableCapturePlace(places, location);
    setCheckInToken((current) => (current?.placeName === nextPlace ? current : null));
    setCapturePlace(nextPlace);
    return nextPlace;
  }, [places]);

  const startPost = useCallback(() => {
    setCapturePlaceMode('auto');
    selectAutoCapturePlace(lastLocation);
    setSelectedPlace(null);
    setSelectedPostId(null);
    setSelectedProfileHandle(null);
    setActiveTab('capture');

    if (lastLocation) {
      return;
    }

    getCurrentLocation()
      .then((location) => {
        setLastLocation(location);
        const nextPlace = selectAutoCapturePlace(location);
        if (!nextPlace) {
          showNotice(t('app.noUploadablePlaceShort'));
        }
      })
      .catch(() => undefined);
  }, [lastLocation, selectAutoCapturePlace, showNotice, t]);

  const locateMe = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      setLastLocation(location);
      showNotice(t('app.locationUpdated', { accuracy: Math.round(location.accuracyMeters ?? 0) }));
      return location;
    } catch {
      showNotice(t('app.locationUnavailable'));
      throw new Error(t('app.locationUnavailable'));
    }
  }, [showNotice, t]);

  const handleTabChange = useCallback((tab: TabKey) => {
    if (tab !== 'capture') {
      setActiveTab(tab);
      return;
    }

    setCapturePlaceMode('auto');
    selectAutoCapturePlace(lastLocation);
    setActiveTab('capture');

    if (lastLocation) {
      return;
    }

    getCurrentLocation()
      .then((location) => {
        setLastLocation(location);
        const nextPlace = selectAutoCapturePlace(location);
        if (!nextPlace) {
          showNotice(t('app.noUploadablePlaceShort'));
        }
      })
      .catch(() => undefined);
  }, [lastLocation, selectAutoCapturePlace, showNotice, t]);

  useEffect(() => {
    if (stage !== 'app' || activeTab !== 'map' || lastLocation || mapAutoLocateAttempted.current) {
      return;
    }

    mapAutoLocateAttempted.current = true;
    locateMe().catch(() => undefined);
  }, [activeTab, lastLocation, locateMe, stage]);

  useEffect(() => {
    if (stage !== 'app' || activeTab !== 'capture' || capturePlaceMode !== 'auto' || lastLocation || captureAutoLocateAttempted.current) {
      return;
    }

    captureAutoLocateAttempted.current = true;
    getCurrentLocation()
      .then((location) => {
        setLastLocation(location);
        const nextPlace = selectAutoCapturePlace(location);
        if (!nextPlace) {
          showNotice(t('app.noUploadablePlaceShort'));
        }
      })
      .catch(() => undefined);
  }, [activeTab, capturePlaceMode, lastLocation, selectAutoCapturePlace, showNotice, stage, t]);

  useEffect(() => {
    if (stage !== 'app' || activeTab !== 'capture' || capturePlaceMode !== 'auto' || !lastLocation) {
      return;
    }

    selectAutoCapturePlace(lastLocation);
  }, [activeTab, capturePlaceMode, lastLocation, selectAutoCapturePlace, stage]);

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
      const place = places.find((candidate) => candidate.placeName === capturePlace || candidate.name === capturePlace);

      if (place?.coordinates) {
        clientDistance = distanceMeters(location, place.coordinates);
      }
    } catch {
      setLastLocation(null);
    }

    try {
      const token = await issueApiCheckInToken(
        capturePlace,
        {
          distanceMeters: clientDistance ?? 84,
          location: location ?? undefined,
        },
        session?.token,
      );
      setCheckInToken(token);
      showNotice(t('app.checkInIssued'));
    } catch (error) {
      showNotice(error instanceof Error ? translateServerMessage(error.message, language) : t('app.checkInFailed'));
      throw error;
    }
  }, [capturePlace, language, places, session?.token, showNotice, t]);

  const uploadMemory = useCallback(async ({ visibility = 'PublicAfter1h', caption, mediaItems }: { visibility?: Visibility; caption: string; mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }> }) => {
    if (!checkInToken) {
      await issueCheckInToken();
      return;
    }

    if (checkInToken.uploadsRemaining <= 0) {
      showNotice(t('app.noUploads'));
      return;
    }

    if (!checkInToken.id) {
      showNotice(t('app.invalidToken'));
      return;
    }

    try {
      const result = await createApiMemory(
        checkInToken.id,
        caption || t('capture.defaultCaption'),
        visibility,
        {
          mediaItems,
        },
        session?.token,
      );
      setCheckInToken(result.checkInToken);
      setFeedPosts((current) => [result.memory, ...current.filter((post) => post.id !== result.memory.id)]);
      setSelectedPlace(null);
      setActiveTab('home');
      showNotice(t('app.memorySaved', { placeName: result.memory.placeName }));
      refreshAppData().catch(() => undefined);
    } catch (error) {
      showNotice(error instanceof Error ? translateServerMessage(error.message, language) : t('app.memoryUploadFailed'));
      throw error;
    }
  }, [checkInToken, issueCheckInToken, language, refreshAppData, session?.token, showNotice, t]);

  const performPostAction = useCallback(async (postId: string, action: MemoryPostAction, input?: { body?: string }) => {
    const result = await updateApiPostAction(postId, action, input, session?.token);

    if (action === 'hide') {
      setFeedPosts((current) => current.filter((post) => post.id !== postId));
    } else {
      setFeedPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
    }

    showNotice(translateServerMessage(result.message, language));
    fetchNotifications(session?.token).then(setNotifications).catch(() => undefined);
  }, [language, session?.token, showNotice]);

  const searchContent = useCallback((query: string): Promise<SearchResults> => fetchSearchResults(query, session?.token), [session?.token]);

  const acknowledgeNotifications = useCallback(async () => {
    if (!session?.token || notifications.every((notification) => notification.read)) {
      return;
    }

    try {
      setNotifications(await markNotificationsRead(session.token));
    } catch {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    }
  }, [notifications, session?.token]);

  const blockAuthor = useCallback(async (handle: string) => {
    const result = await toggleApiBlock(handle, session?.token);

    showNotice(translateServerMessage(result.message, language));
    await refreshAppData();
  }, [language, refreshAppData, session?.token, showNotice]);

  const sharePost = useCallback(async (post: MemoryPost) => {
    const shareUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}?stage=app&screen=home&homePost=0`
      : 'https://happened.local';
    const shareText = `${post.authorName} at ${post.placeName}: ${post.caption}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: 'Happened',
        text: shareText,
        url: shareUrl,
      });
      showNotice(t('app.shareOpened'));
      return;
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      showNotice(t('app.shareCopied'));
      return;
    }
    showNotice(t('app.shareUnavailable'));
  }, [showNotice, t]);

  const renderScreen = () => {
    if (stage === 'welcome') {
      return (
        <WelcomeScreen
          onCreateAccount={() => {
            setAuthMode('register');
            setStage('auth');
          }}
          onLogIn={() => {
            setAuthMode('login');
            setStage('auth');
          }}
        />
      );
    }

    if (stage === 'auth') {
      return (
        <AuthScreen
          initialMode={authMode}
          onBack={() => setStage('welcome')}
          onComplete={(nextSession) => {
            setSession(nextSession);
            writeCachedSession(nextSession);
            setStage('permissions');
          }}
        />
      );
    }

    if (stage === 'permissions') {
      return <PermissionsScreen onComplete={enterApp} />;
    }

    if (stage === 'app' && tutorialVisible) {
      return <TutorialScreen onComplete={completeTutorial} />;
    }

    if (selectedPlace) {
      return (
        <PlaceDetailScreen
          placeName={selectedPlace}
          posts={feedPosts}
          months={timeline}
          onBack={() => setSelectedPlace(null)}
          onCapture={() => captureAtPlace(selectedPlace)}
        />
      );
    }

    if (selectedPostId) {
      return (
        <PostDetailScreen
          key={selectedPostId}
          postId={selectedPostId}
          initialPost={feedPosts.find((post) => post.id === selectedPostId)}
          sessionToken={session?.token}
          onBack={() => setSelectedPostId(null)}
          onOpenPlace={openPlace}
          onOpenProfile={openProfile}
          onPostAction={performPostAction}
          onNotice={showNotice}
        />
      );
    }

    if (selectedProfileHandle) {
      return (
        <UserProfileScreen
          key={selectedProfileHandle}
          handle={selectedProfileHandle}
          initialPosts={feedPosts}
          sessionToken={session?.token}
          onBack={() => setSelectedProfileHandle(null)}
          onOpenPost={openPost}
          onOpenPlace={openPlace}
          onOpenProfile={openProfile}
          onNotice={showNotice}
          onBlockedChange={refreshAppData}
        />
      );
    }

    switch (activeTab) {
      case 'map':
        return <MapScreen places={places.length ? places : undefined} userLocation={lastLocation} onOpenPlace={openPlace} onLocate={locateMe} />;
      case 'capture':
        return (
          <CaptureScreen
            placeName={capturePlace}
            displayPlaceName={capturePlace ? localizePlaceName(capturePlace, language) : t('capture.currentLocation')}
            token={checkInToken}
            locationLabel={getCaptureLocationLabel(capturePlace, places, lastLocation, t)}
            distanceLabel={getCaptureDistanceLabel(capturePlace, places, lastLocation, t)}
            verificationBlockedMessage={getCaptureBlockedMessage(capturePlace, places, lastLocation, t)}
            onIssueToken={issueCheckInToken}
            onUpload={uploadMemory}
            onOpenPlace={openPlace}
            onOpenMap={() => setActiveTab('map')}
            onNotice={showNotice}
          />
        );
      case 'timeline':
        return <TimelineScreen months={timeline.length ? timeline : undefined} onOpenPlace={openPlace} />;
      case 'profile':
        return (
          <ProfileScreen
            session={session}
            places={places}
            posts={feedPosts}
            safetySummary={safetySummary}
            onSessionChange={(nextSession) => {
              setSession(nextSession);
              writeCachedSession(nextSession);
              refreshAppData().catch(() => undefined);
            }}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
            onPostsChanged={refreshAppData}
            onNotice={showNotice}
            onSignOut={() => {
              setSession(null);
              setSafetySummary(null);
              setTutorialVisible(false);
              writeCachedSession(null);
              setStage('welcome');
            }}
          />
        );
      case 'home':
      default:
        return (
          <HomeScreen
            initialIndex={prototypeParams.homePost}
            posts={feedPosts}
            onOpenPlace={openPlace}
            onCaptureAtPlace={captureAtPlace}
            onNotice={showNotice}
            onStartPost={startPost}
            onRefresh={refreshAppData}
            onPostAction={performPostAction}
            onSharePost={sharePost}
            onBlockAuthor={blockAuthor}
            notifications={notifications}
            notificationUnreadCount={notifications.filter((notification) => !notification.read).length}
            onNotificationsOpen={acknowledgeNotifications}
            onSearch={searchContent}
            onOpenPost={openPost}
            onOpenProfile={openProfile}
          />
        );
    }
  };

  return (
    <View style={[styles.app, Platform.OS === 'web' && !prototypeParams.capture ? { height: viewportHeight, width: '100%', maxWidth: '100%' } : null, prototypeParams.capture && styles.captureApp]}>
      <StatusBar style="dark" />
      {renderScreen()}
      {stage === 'app' && !tutorialVisible && !selectedPlace && !selectedPostId && !selectedProfileHandle ? <BottomTabs activeTab={activeTab} onChange={handleTabChange} /> : null}
      {notice ? (
        <View pointerEvents="none" style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.setlogBg,
  },
  captureApp: {
    width: 390,
    height: 844,
    overflow: 'hidden',
  },
  notice: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 54,
    minHeight: 44,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 254, 248, 0.94)',
  },
  noticeText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});
