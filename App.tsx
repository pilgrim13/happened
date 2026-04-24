import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabs } from './src/components/BottomTabs';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { colors } from './src/theme/tokens';
import type { TabKey } from './src/types/happened';

function getPrototypeParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { screen: 'home' as TabKey, homePost: 0, capture: false };
  }

  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen') as TabKey | null;
  const homePost = Number.parseInt(params.get('homePost') ?? '0', 10);
  const validScreens: TabKey[] = ['home', 'map', 'capture', 'timeline', 'profile'];

  return {
    screen: screen && validScreens.includes(screen) ? screen : 'home',
    homePost: Number.isFinite(homePost) ? homePost : 0,
    capture: params.get('capture') === '1',
  };
}

function AppShell() {
  const prototypeParams = getPrototypeParams();
  const [activeTab, setActiveTab] = useState<TabKey>(prototypeParams.screen);

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

  const renderScreen = () => {
    switch (activeTab) {
      case 'map':
        return <MapScreen />;
      case 'capture':
        return <CaptureScreen />;
      case 'timeline':
        return <TimelineScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'home':
      default:
        return <HomeScreen initialIndex={prototypeParams.homePost} />;
    }
  };

  return (
    <View style={[styles.app, prototypeParams.capture && styles.captureApp]}>
      <StatusBar style="light" />
      {renderScreen()}
      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
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
});
