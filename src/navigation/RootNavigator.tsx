import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import {
  PermissionsRoute,
  PlaceDetailRoute,
  PostDetailRoute,
  RecallRoute,
  TutorialRoute,
  UserProfileRoute,
} from './routes';
import { linking } from './linking';
import type { RootStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, hydrated, isFreshSession } = useSession();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.setlogBg,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  const isAuthenticated = !!session?.token;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="AuthStack" component={AuthStack} />
        ) : (
          <>
            {isFreshSession ? (
              <>
                <Stack.Screen name="Permissions" component={PermissionsRoute} />
                <Stack.Screen name="Tutorial" component={TutorialRoute} />
                <Stack.Screen name="MainTabs" component={MainTabs} />
              </>
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="Permissions" component={PermissionsRoute} />
                <Stack.Screen name="Tutorial" component={TutorialRoute} />
              </>
            )}
            <Stack.Screen
              name="PlaceDetail"
              component={PlaceDetailRoute}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailRoute}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileRoute}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="Recall"
              component={RecallRoute}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
