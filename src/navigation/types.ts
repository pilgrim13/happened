import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Auth: { mode?: 'register' | 'login' } | undefined;
};

export type MainTabsParamList = {
  Home: { initialPostIndex?: number } | undefined;
  Map: undefined;
  Capture: undefined;
  Timeline: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  Permissions: undefined;
  Tutorial: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  PlaceDetail: { placeName: string };
  PostDetail: { postId: string };
  UserProfile: { handle: string };
  Recall: undefined;
};
