import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthRoute, WelcomeRoute } from './routes';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeRoute} />
      <Stack.Screen name="Auth" component={AuthRoute} />
    </Stack.Navigator>
  );
}
