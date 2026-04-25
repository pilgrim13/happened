import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NoticeOverlay } from './src/components/NoticeOverlay';
import { AppDataProvider } from './src/contexts/AppDataContext';
import { CaptureProvider } from './src/contexts/CaptureContext';
import { NoticeProvider } from './src/contexts/NoticeContext';
import { SessionProvider } from './src/contexts/SessionContext';
import { useWebViewportShell } from './src/hooks/useWebViewportShell';
import { I18nProvider } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppShell() {
  useWebViewportShell();
  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
      <NoticeOverlay />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <NoticeProvider>
            <SessionProvider>
              <AppDataProvider>
                <CaptureProvider>
                  <AppShell />
                </CaptureProvider>
              </AppDataProvider>
            </SessionProvider>
          </NoticeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
