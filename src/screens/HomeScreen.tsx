import { Bell, Camera, Clock, RefreshCw, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationsPanel } from '../components/NotificationsPanel';
import { PostCard, matchesQuery } from '../components/PostCard';
import { SearchPanel } from '../components/SearchPanel';
import { ScreenState } from '../components/ScreenState';
import { feedModes } from '../data/happened';
import { translateFeedMode, useI18n } from '../i18n';
import { colors } from '../theme/tokens';
import type { FeedMode, MemoryPost, MemoryPostAction, NotificationItem, SearchResults, Visibility } from '../types/happened';
import { styles } from './HomeScreen.styles';

type HomeScreenProps = {
  initialIndex?: number;
  posts?: MemoryPost[];
  nearbyPosts?: MemoryPost[];
  currentUserId?: string;
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onNotice?: (message: string) => void;
  onStartPost?: () => void;
  onRefresh?: () => void | Promise<void>;
  onNearbyRequest?: () => void | Promise<void>;
  onPostAction?: (postId: string, action: MemoryPostAction, input?: { body?: string }) => void | Promise<void>;
  onEditPost?: (postId: string, input: { caption?: string; visibility?: Visibility }) => void | Promise<void>;
  onDeletePost?: (postId: string) => void | Promise<void>;
  onSharePost?: (post: MemoryPost) => void | Promise<void>;
  onBlockAuthor?: (handle: string) => void | Promise<void>;
  notifications?: NotificationItem[];
  notificationUnreadCount?: number;
  onNotificationsOpen?: () => void | Promise<void>;
  onSearch?: (query: string) => Promise<SearchResults>;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (handle: string) => void;
  recallCount?: number;
  onOpenRecall?: () => void;
  onLoadMore?: () => Promise<void>;
};

export function HomeScreen({
  initialIndex = 0,
  posts = [],
  nearbyPosts = [],
  currentUserId,
  onOpenPlace,
  onCaptureAtPlace,
  onNotice,
  onStartPost,
  onRefresh,
  onNearbyRequest,
  onPostAction,
  onEditPost,
  onDeletePost,
  onSharePost,
  onBlockAuthor,
  notifications = [],
  notificationUnreadCount = notifications.filter((notification) => !notification.read).length,
  onNotificationsOpen,
  onSearch,
  onOpenPost,
  onOpenProfile,
  recallCount = 0,
  onOpenRecall,
  onLoadMore,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const requestedPost = posts[Math.max(0, Math.min(initialIndex, posts.length - 1))];
  const [selectedMode, setSelectedMode] = useState<FeedMode>(initialIndex > 0 ? requestedPost?.mode ?? 'Following' : 'Following');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteSearch, setRemoteSearch] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevModeRef = useRef(selectedMode);
  const trimmedQuery = query.trim();
  const usingRemoteSearch = Boolean(remoteSearch && trimmedQuery.length >= 2);
  const sourcePosts = usingRemoteSearch ? (remoteSearch?.posts ?? []) : selectedMode === 'Nearby' ? nearbyPosts : posts;
  const visiblePosts = sourcePosts.filter((post) =>
    (usingRemoteSearch || selectedMode === 'Nearby' || selectedMode === 'Following' || post.mode === selectedMode) &&
    (usingRemoteSearch || matchesQuery(post, query)),
  );

  // Nearby 탭 전환 시 서버에 위치 기반 요청
  useEffect(() => {
    if (selectedMode === 'Nearby' && prevModeRef.current !== 'Nearby') {
      Promise.resolve(onNearbyRequest?.()).catch((err: unknown) => {
        onNotice?.(err instanceof Error ? err.message : '위치 권한이 필요해요');
      });
    }
    prevModeRef.current = selectedMode;
  }, [selectedMode, onNearbyRequest, onNotice]);

  useEffect(() => {
    if (!searchOpen || !onSearch || trimmedQuery.length < 2) {
      setRemoteSearch(null);
      setSearching(false);
      return undefined;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      onSearch(trimmedQuery)
        .then((results) => {
          if (active) {
            setRemoteSearch(results);
          }
        })
        .catch(() => {
          if (active) {
            setRemoteSearch(null);
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [onSearch, searchOpen, trimmedQuery]);

  const toggleNotifications = () => {
    setNotificationsOpen((current) => {
      const next = !current;
      if (next) {
        Promise.resolve(onNotificationsOpen?.()).catch(() => undefined);
      }
      return next;
    });
  };

  const refreshFeed = () => {
    if (!onRefresh) {
      return;
    }

    setRefreshing(true);
    Promise.resolve(onRefresh())
      .then(() => onNotice?.(t('home.refreshed')))
      .catch((error) => onNotice?.(error instanceof Error ? error.message : t('home.refreshFailed')))
      .finally(() => setRefreshing(false));
  };

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || loadingMore) return;
    setLoadingMore(true);
    onLoadMore().finally(() => setLoadingMore(false));
  }, [onLoadMore, loadingMore]);

  const keyExtractor = useCallback((item: MemoryPost) => item.id, []);

  const renderItem = useCallback(({ item }: { item: MemoryPost }) => (
    <PostCard
      item={item}
      currentUserId={currentUserId}
      onOpenPlace={onOpenPlace}
      onCaptureAtPlace={onCaptureAtPlace}
      onNotice={onNotice}
      onPostAction={onPostAction}
      onEditPost={onEditPost}
      onDeletePost={onDeletePost}
      onSharePost={onSharePost}
      onBlockAuthor={onBlockAuthor}
      onOpenPost={onOpenPost}
      onOpenProfile={onOpenProfile}
      t={t}
    />
  ), [currentUserId, onOpenPlace, onCaptureAtPlace, onNotice, onPostAction, onEditPost, onDeletePost, onSharePost, onBlockAuthor, onOpenPost, onOpenProfile, t]);

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        data={visiblePosts}
        key={selectedMode}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.brand}>Happened</Text>
                <Text style={styles.tagline}>{t('home.tagline')}</Text>
              </View>
              <View style={styles.headerActions}>
                {onOpenRecall ? (
                  <Pressable style={styles.headerButton} onPress={onOpenRecall}>
                    <Clock color={colors.setlogInk} size={20} strokeWidth={2.4} />
                    {recallCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{recallCount > 9 ? '9+' : recallCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                <Pressable style={[styles.headerButton, searchOpen && styles.headerButtonActive]} onPress={() => setSearchOpen((current) => !current)}>
                  <Search color={colors.setlogInk} size={20} strokeWidth={2.4} />
                </Pressable>
                <Pressable style={[styles.headerButton, notificationsOpen && styles.headerButtonActive]} onPress={toggleNotifications}>
                  <Bell color={colors.setlogInk} size={20} strokeWidth={2.4} />
                  {notificationUnreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
                {onRefresh ? (
                  <Pressable style={styles.headerButton} onPress={refreshFeed} disabled={refreshing}>
                    <RefreshCw color={colors.setlogInk} size={19} strokeWidth={2.4} />
                  </Pressable>
                ) : null}
                {onStartPost ? (
                  <Pressable style={styles.postButton} onPress={onStartPost}>
                    <Camera color={colors.setlogInk} size={19} strokeWidth={2.7} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {searchOpen ? (
              <View style={styles.searchBox}>
                <Search color={colors.setlogMuted} size={17} strokeWidth={2.4} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  placeholder={t('home.searchPlaceholder')}
                  placeholderTextColor={colors.setlogFaint}
                  style={styles.searchInput}
                />
              </View>
            ) : null}

            {searchOpen && trimmedQuery.length >= 2 ? (
              <SearchPanel
                searching={searching}
                remoteSearch={remoteSearch}
                onOpenProfile={onOpenProfile}
                onOpenPlace={onOpenPlace}
              />
            ) : null}

            {notificationsOpen ? (
              <NotificationsPanel
                notifications={notifications}
                onOpenPost={onOpenPost}
                onOpenProfile={onOpenProfile}
              />
            ) : null}

            <View style={styles.modeRow}>
              {feedModes.map((mode) => (
                <Pressable key={mode} style={[styles.modePill, mode === selectedMode && styles.modePillActive]} onPress={() => setSelectedMode(mode)}>
                  <Text style={[styles.modeText, mode === selectedMode && styles.modeTextActive]}>{translateFeedMode(mode, t)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          query ? (
            <ScreenState
              variant="empty"
              title={t('home.noPosts')}
              message={t('home.noSearch')}
            />
          ) : (
            <ScreenState
              variant="empty"
              title={t('home.noMemories')}
              message={t('home.noMemoriesText')}
              action={onStartPost ? { label: t('home.goCapture'), onPress: onStartPost } : undefined}
            />
          )
        }
        refreshing={refreshing}
        onRefresh={onRefresh ? refreshFeed : undefined}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 102, 118) }]}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        onEndReached={onLoadMore ? handleLoadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadMoreSpinner} color={colors.setlogMuted} /> : null}
      />
    </View>
  );
}
