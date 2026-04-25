import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { BottomTabs } from '../components/BottomTabs';
import {
  CaptureRoute,
  HomeRoute,
  MapRoute,
  ProfileRoute,
  TimelineRoute,
} from './tabRoutes';
import type { MainTabsParamList } from './types';
import type { TabKey } from '../types/happened';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const ROUTE_TO_TAB: Record<keyof MainTabsParamList, TabKey> = {
  Home: 'home',
  Map: 'map',
  Capture: 'capture',
  Timeline: 'timeline',
  Profile: 'profile',
};

const TAB_TO_ROUTE: Record<TabKey, keyof MainTabsParamList> = {
  home: 'Home',
  map: 'Map',
  capture: 'Capture',
  timeline: 'Timeline',
  profile: 'Profile',
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index].name as keyof MainTabsParamList;
  const activeTab = ROUTE_TO_TAB[activeRoute];
  return (
    <BottomTabs
      activeTab={activeTab}
      onChange={(tab) => {
        const target = TAB_TO_ROUTE[tab];
        navigation.navigate(target as never);
      }}
    />
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeRoute} />
      <Tab.Screen name="Map" component={MapRoute} />
      <Tab.Screen name="Capture" component={CaptureRoute} />
      <Tab.Screen name="Timeline" component={TimelineRoute} />
      <Tab.Screen name="Profile" component={ProfileRoute} />
    </Tab.Navigator>
  );
}
