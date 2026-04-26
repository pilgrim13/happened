import { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions, useNavigation } from '@react-navigation/native';

import { WelcomeScreen } from '../screens/WelcomeScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { PlaceDetailScreen } from '../screens/PlaceDetailScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { RecallScreen } from '../screens/RecallScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';

import { useSession } from '../contexts/SessionContext';
import { useAppData } from '../contexts/AppDataContext';
import { useNotice } from '../contexts/NoticeContext';
import { markTutorialSeen, hasSeenTutorial } from '../storage/secureSession';
import type { AuthStackParamList, RootStackParamList } from './types';

type WelcomeProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;
export function WelcomeRoute({ navigation }: WelcomeProps) {
  return (
    <WelcomeScreen
      onCreateAccount={() => navigation.navigate('Auth', { mode: 'register' })}
      onLogIn={() => navigation.navigate('Auth', { mode: 'login' })}
    />
  );
}

type AuthProps = NativeStackScreenProps<AuthStackParamList, 'Auth'>;
export function AuthRoute({ navigation, route }: AuthProps) {
  const { setSession } = useSession();
  const initialMode = route.params?.mode ?? 'register';
  return (
    <AuthScreen
      initialMode={initialMode}
      onBack={() => navigation.goBack()}
      onComplete={(nextSession) => {
        setSession(nextSession, { fresh: true });
      }}
    />
  );
}

type PermissionsProps = NativeStackScreenProps<RootStackParamList, 'Permissions'>;
export function PermissionsRoute({ navigation }: PermissionsProps) {
  const { session, consumeFreshSession } = useSession();
  const handleComplete = useCallback(async () => {
    const seen = await hasSeenTutorial(session?.user.id);
    consumeFreshSession();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [seen ? { name: 'MainTabs' as const } : { name: 'Tutorial' as const }],
      }),
    );
  }, [consumeFreshSession, navigation, session?.user.id]);
  return <PermissionsScreen onComplete={handleComplete} />;
}

type TutorialProps = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;
export function TutorialRoute({ navigation }: TutorialProps) {
  const { session, consumeFreshSession } = useSession();
  const handleComplete = useCallback(async () => {
    await markTutorialSeen(session?.user.id);
    consumeFreshSession();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as const }] }),
    );
  }, [consumeFreshSession, navigation, session?.user.id]);
  return <TutorialScreen onComplete={handleComplete} />;
}

type PlaceDetailProps = NativeStackScreenProps<RootStackParamList, 'PlaceDetail'>;
export function PlaceDetailRoute({ navigation, route }: PlaceDetailProps) {
  const { feedPosts, timeline } = useAppData();
  const { placeName } = route.params;
  const nav = useNavigation<NativeStackScreenProps<RootStackParamList, 'PlaceDetail'>['navigation']>();
  return (
    <PlaceDetailScreen
      placeName={placeName}
      posts={feedPosts}
      months={timeline}
      onBack={() => navigation.goBack()}
      onCapture={() => {
        nav.navigate('MainTabs', { screen: 'Capture' });
      }}
    />
  );
}

type PostDetailProps = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;
export function PostDetailRoute({ navigation, route }: PostDetailProps) {
  const { feedPosts, performPostAction } = useAppData();
  const { session } = useSession();
  const { showNotice } = useNotice();
  const { postId } = route.params;
  return (
    <PostDetailScreen
      key={postId}
      postId={postId}
      initialPost={feedPosts.find((p) => p.id === postId)}
      sessionToken={session?.token}
      onBack={() => navigation.goBack()}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
      onOpenProfile={(handle) => navigation.navigate('UserProfile', { handle: handle.replace(/^@+/, '') })}
      onPostAction={async (id, action, input) => {
        await performPostAction(id, action, input);
      }}
      onNotice={showNotice}
    />
  );
}

type RecallProps = NativeStackScreenProps<RootStackParamList, 'Recall'>;
export function RecallRoute({ navigation }: RecallProps) {
  return (
    <RecallScreen
      onBack={() => navigation.goBack()}
      onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
    />
  );
}

type UserProfileProps = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;
export function UserProfileRoute({ navigation, route }: UserProfileProps) {
  const { feedPosts, refresh } = useAppData();
  const { session } = useSession();
  const { showNotice } = useNotice();
  const { handle } = route.params;
  return (
    <UserProfileScreen
      key={handle}
      handle={handle}
      initialPosts={feedPosts}
      sessionToken={session?.token}
      onBack={() => navigation.goBack()}
      onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
      onOpenPlace={(placeName) => navigation.navigate('PlaceDetail', { placeName })}
      onOpenProfile={(nextHandle) =>
        navigation.push('UserProfile', { handle: nextHandle.replace(/^@+/, '') })
      }
      onNotice={showNotice}
      onBlockedChange={refresh}
    />
  );
}
