import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'happened://', 'https://happened.app'],
  config: {
    screens: {
      AuthStack: {
        screens: {
          Welcome: 'welcome',
          Auth: 'auth',
        },
      },
      Permissions: 'permissions',
      Tutorial: 'tutorial',
      MainTabs: {
        screens: {
          Home: 'home',
          Map: 'map',
          Capture: 'capture',
          Timeline: 'timeline',
          Profile: 'profile',
        },
      },
      PlaceDetail: 'place/:placeName',
      PostDetail: 'post/:postId',
      UserProfile: 'u/:handle',
    },
  },
};
