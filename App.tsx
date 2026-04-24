import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabs } from './src/components/BottomTabs';
import { AuthScreen } from './src/screens/AuthScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { PermissionsScreen } from './src/screens/PermissionsScreen';
import { PlaceDetailScreen } from './src/screens/PlaceDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, fonts, radius } from './src/theme/tokens';
import type { AppStage, CheckInToken, TabKey } from './src/types/happened';

function getPrototypeParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { screen: 'home' as TabKey, homePost: 0, capture: false, stage: null as AppStage | null, place: null as string | null };
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
  };
}

function AppShell() {
  const prototypeParams = getPrototypeParams();
  const [stage, setStage] = useState<AppStage>(prototypeParams.stage ?? (prototypeParams.capture ? 'app' : 'welcome'));
  const [activeTab, setActiveTab] = useState<TabKey>(prototypeParams.screen);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(prototypeParams.place);
  const [capturePlace, setCapturePlace] = useState('Seolleung Station Cafe');
  const [checkInToken, setCheckInToken] = useState<CheckInToken | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.documentElement.style.backgroundColor = colors.ink;
    document.documentElement.style.height = '100%';
    document.body.style.backgroundColor = colors.ink;
    document.body.style.height = '100%';
    document.body.style.margin = '0';

    const root = document.getElementById('root');
    if (root) {
      root.style.minHeight = '100vh';
      root.style.backgroundColor = colors.ink;
    }
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
    showNotice('Mock session active');
  }, [showNotice]);

  const openPlace = useCallback((placeName: string) => {
    setSelectedPlace(placeName);
  }, []);

  const captureAtPlace = useCallback(
    (placeName: string) => {
      setCheckInToken((current) => (current?.placeName === placeName ? current : null));
      setCapturePlace(placeName);
      setSelectedPlace(null);
      setActiveTab('capture');
      showNotice(`Ready to check in at ${placeName}`);
    },
    [showNotice],
  );

  const issueCheckInToken = useCallback(() => {
    setCheckInToken({
      placeName: capturePlace,
      issuedAtLabel: 'just now',
      expiresInLabel: '11h 59m',
      uploadsRemaining: 3,
    });
    showNotice('12h check-in token issued');
  }, [capturePlace, showNotice]);

  const uploadMemory = useCallback(() => {
    if (!checkInToken) {
      issueCheckInToken();
      return;
    }

    if (checkInToken.uploadsRemaining <= 0) {
      showNotice('No mock uploads remaining on this token');
      return;
    }

    setCheckInToken({
      ...checkInToken,
      uploadsRemaining: checkInToken.uploadsRemaining - 1,
    });
    showNotice(`Memory saved to ${checkInToken.placeName}`);
  }, [checkInToken, issueCheckInToken, showNotice]);

  const renderScreen = () => {
    if (stage === 'welcome') {
      return <WelcomeScreen onCreateAccount={() => setStage('auth')} onSkipToApp={enterApp} />;
    }

    if (stage === 'auth') {
      return <AuthScreen onBack={() => setStage('welcome')} onComplete={() => setStage('permissions')} />;
    }

    if (stage === 'permissions') {
      return <PermissionsScreen onComplete={enterApp} />;
    }

    if (selectedPlace) {
      return <PlaceDetailScreen placeName={selectedPlace} onBack={() => setSelectedPlace(null)} onCapture={() => captureAtPlace(selectedPlace)} />;
    }

    switch (activeTab) {
      case 'map':
        return <MapScreen onOpenPlace={openPlace} />;
      case 'capture':
        return (
          <CaptureScreen
            placeName={capturePlace}
            token={checkInToken}
            onIssueToken={issueCheckInToken}
            onUpload={uploadMemory}
            onOpenPlace={openPlace}
          />
        );
      case 'timeline':
        return <TimelineScreen onOpenPlace={openPlace} />;
      case 'profile':
        return <ProfileScreen onNotice={showNotice} onSignOut={() => setStage('welcome')} />;
      case 'home':
      default:
        return <HomeScreen initialIndex={prototypeParams.homePost} onOpenPlace={openPlace} onCaptureAtPlace={captureAtPlace} onPostAction={showNotice} />;
    }
  };

  return (
    <View style={[styles.app, prototypeParams.capture && styles.captureApp]}>
      <StatusBar style="light" />
      {renderScreen()}
      {stage === 'app' && !selectedPlace ? <BottomTabs activeTab={activeTab} onChange={setActiveTab} /> : null}
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
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.ink,
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
    borderRadius: radius.panel,
    borderColor: 'rgba(199, 249, 91, 0.34)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(5, 7, 13, 0.88)',
  },
  noticeText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});
