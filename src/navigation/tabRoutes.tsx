import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions, useNavigation } from '@react-navigation/native';

import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

import { useAppData } from '../contexts/AppDataContext';
import { useSession } from '../contexts/SessionContext';
import { useNotice } from '../contexts/NoticeContext';
import { useCapture } from '../contexts/CaptureContext';
import { useSharePost } from '../hooks/useSharePost';
import { useEffect, useState } from 'react';
import { fetchRecallFeed } from '../services/happenedApi';
import type { MainTabsParamList, RootStackParamList } from './types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function HomeRoute(_props: BottomTabScreenProps<MainTabsParamList, 'Home'>) {
  const navigation = useNavigation<RootNav>();
  const {
    feedPosts,
    notifications,
    performPostAction,
    blockAuthor,
    acknowledgeNotifications,
    search,
    refresh,
  } = useAppData();
  const { session } = useSession();
  const { showNotice } = useNotice();
  const { captureAtPlace, startPostFromHome } = useCapture();
  const sharePost = useSharePost();
  const initialIndex = (_props.route.params?.initialPostIndex as number | undefined) ?? 0;
  const [recallCount, setRecallCount] = useState(0);

  useEffect(() => {
    if (!session?.token) return;
    fetchRecallFeed(session.token)
      .then((items) => setRecallCount(items.length))
      .catch(() => undefined);
  }, [session?.token]);

  return (
    <HomeScreen
      initialIndex={initialIndex}
      posts={feedPosts}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
      onCaptureAtPlace={(placeName) => {
        captureAtPlace(placeName);
        navigation.navigate('MainTabs', { screen: 'Capture' });
      }}
      onNotice={showNotice}
      onStartPost={() => {
        startPostFromHome();
        navigation.navigate('MainTabs', { screen: 'Capture' });
      }}
      onRefresh={refresh}
      onPostAction={async (postId, action, input) => {
        await performPostAction(postId, action, input);
      }}
      onSharePost={sharePost}
      onBlockAuthor={async (handle) => {
        await blockAuthor(handle);
      }}
      notifications={notifications}
      notificationUnreadCount={notifications.filter((n) => !n.read).length}
      onNotificationsOpen={acknowledgeNotifications}
      onSearch={search}
      onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
      onOpenProfile={(handle) =>
        navigation.navigate('UserProfile', { handle: handle.replace(/^@+/, '') })
      }
      recallCount={recallCount}
      onOpenRecall={() => navigation.navigate('Recall')}
    />
  );
}

export function MapRoute(_props: BottomTabScreenProps<MainTabsParamList, 'Map'>) {
  const navigation = useNavigation<RootNav>();
  const { places } = useAppData();
  const { lastLocation, locateMe } = useCapture();
  return (
    <MapScreen
      places={places.length ? places : undefined}
      userLocation={lastLocation}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
      onLocate={locateMe}
    />
  );
}

export function CaptureRoute(_props: BottomTabScreenProps<MainTabsParamList, 'Capture'>) {
  const navigation = useNavigation<RootNav>();
  const { checkInToken } = useAppData();
  const { showNotice } = useNotice();
  const {
    capturePlace,
    displayPlaceName,
    locationLabel,
    distanceLabel,
    blockedMessage,
    issueCheckInToken,
    upload,
  } = useCapture();
  return (
    <CaptureScreen
      placeName={capturePlace}
      displayPlaceName={displayPlaceName}
      token={checkInToken}
      locationLabel={locationLabel}
      distanceLabel={distanceLabel}
      verificationBlockedMessage={blockedMessage}
      onIssueToken={issueCheckInToken}
      onUpload={async (input) => {
        const result = await upload(input);
        if (result) {
          navigation.dispatch(
            CommonActions.navigate({ name: 'MainTabs', params: { screen: 'Home' } }),
          );
        }
      }}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
      onOpenMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
      onNotice={showNotice}
    />
  );
}

export function TimelineRoute(_props: BottomTabScreenProps<MainTabsParamList, 'Timeline'>) {
  const navigation = useNavigation<RootNav>();
  const { timeline } = useAppData();
  return (
    <TimelineScreen
      months={timeline.length ? timeline : undefined}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
    />
  );
}

export function ProfileRoute(_props: BottomTabScreenProps<MainTabsParamList, 'Profile'>) {
  const navigation = useNavigation<RootNav>();
  const { session, setSession, signOut } = useSession();
  const { feedPosts, places, safetySummary, refresh } = useAppData();
  const { showNotice } = useNotice();
  return (
    <ProfileScreen
      session={session}
      places={places}
      posts={feedPosts}
      safetySummary={safetySummary}
      onSessionChange={(nextSession) => {
        setSession(nextSession);
        refresh().catch(() => undefined);
      }}
      onOpenProfile={(handle) =>
        navigation.navigate('UserProfile', { handle: handle.replace(/^@+/, '') })
      }
      onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
      onPostsChanged={refresh}
      onNotice={showNotice}
      onSignOut={() => {
        signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AuthStack', params: { screen: 'Welcome' } }],
          }),
        );
      }}
    />
  );
}
