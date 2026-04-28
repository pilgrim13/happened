import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NoticeOverlay } from './src/components/NoticeOverlay';
import { AppDataProvider } from './src/contexts/AppDataContext';
import { CaptureProvider } from './src/contexts/CaptureContext';
import { NoticeProvider } from './src/contexts/NoticeContext';
import { SessionProvider } from './src/contexts/SessionContext';
import { useWebViewportShell } from './src/hooks/useWebViewportShell';
import { I18nProvider } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

function AppShell() {
  useWebViewportShell();
  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
      <NoticeOverlay />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
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
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
