import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Bookmark, Camera, ChevronLeft, ChevronRight, Clock, Heart, Lock, MapPin, MessageCircle, MoreHorizontal, Plus, RadioTower, RefreshCw, Search, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRenderer } from '../components/MediaRenderer';
import { ScreenState } from '../components/ScreenState';
import { feedModes, memoryPosts } from '../data/happened';
import { localizePlaceName, localizeRecallLabel, localizeTimeLabel, translateFeedMode, useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';
import type { FeedMode, MemoryPost, MemoryPostAction, NotificationItem, SearchResults, UnlockState } from '../types/happened';

type HomeScreenProps = {
  initialIndex?: number;
  posts?: MemoryPost[];
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onNotice?: (message: string) => void;
  onStartPost?: () => void;
  onRefresh?: () => void | Promise<void>;
  onPostAction?: (postId: string, action: MemoryPostAction, input?: { body?: string }) => void | Promise<void>;
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
};

function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

function formatDistance(distanceMeters: number, t: ReturnType<typeof useI18n>['t']) {
  if (distanceMeters >= 1000) {
    return t('home.distanceKm', { kilometers: (distanceMeters / 1000).toFixed(1) });
  }

  return t('home.distanceMeters', { meters: distanceMeters });
}

function unlockCopy(state: UnlockState, t: ReturnType<typeof useI18n>['t']) {
  if (state === 'open') {
    return {
      label: t('home.echoOpen'),
      meta: t('home.echoOpenMeta'),
      Icon: MapPin,
      color: colors.setlogMint,
    };
  }

  if (state === 'nearby') {
    return {
      label: t('home.echoNearby'),
      meta: t('home.echoNearbyMeta'),
      Icon: RadioTower,
      color: colors.setlogYellow,
    };
  }

  return {
    label: t('home.echoLocked'),
    meta: t('home.echoLockedMeta'),
    Icon: Lock,
    color: colors.setlogPink,
  };
}

function matchesQuery(post: MemoryPost, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [post.authorName, post.authorHandle, post.placeName, post.city, post.caption]
    .some((value) => value.toLowerCase().includes(normalized));
}

function notificationText(notification: NotificationItem, t: ReturnType<typeof useI18n>['t']) {
  if (notification.type === 'echo') {
    return t('home.noticeEcho', { actor: notification.actor.displayName });
  }
  if (notification.type === 'save') {
    return t('home.noticeSave', { actor: notification.actor.displayName });
  }
  if (notification.type === 'reply') {
    return t('home.noticeReply', { actor: notification.actor.displayName });
  }
  if (notification.type === 'follow') {
    return t('home.noticeFollow', { actor: notification.actor.displayName });
  }

  return notification.message;
}

export function HomeScreen({
  initialIndex = 0,
  posts = memoryPosts,
  onOpenPlace,
  onCaptureAtPlace,
  onNotice,
  onStartPost,
  onRefresh,
  onPostAction,
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
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const requestedPost = posts[Math.max(0, Math.min(initialIndex, posts.length - 1))];
  const [selectedMode, setSelectedMode] = useState<FeedMode>(initialIndex > 0 ? requestedPost?.mode ?? 'Following' : 'Following');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteSearch, setRemoteSearch] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const trimmedQuery = query.trim();
  const usingRemoteSearch = Boolean(remoteSearch && trimmedQuery.length >= 2);
  const sourcePosts = usingRemoteSearch ? remoteSearch?.posts ?? [] : posts;
  const visiblePosts = sourcePosts.filter((post) => (selectedMode === 'Following' || post.mode === selectedMode) && (usingRemoteSearch || matchesQuery(post, query)));

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
      .catch((error) => onNotice?.(error instanceof Error ? error.message : t('home.refreshFailed')))
      .finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        data={visiblePosts}
        key={selectedMode}
        keyExtractor={(item) => item.id}
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
              <View style={styles.searchPanel}>
                {searching ? <Text style={styles.panelMeta}>{t('home.searching')}</Text> : null}
                {remoteSearch?.users.length ? (
                  <View style={styles.resultGroup}>
                    <Text style={styles.resultLabel}>{t('common.people')}</Text>
                    {remoteSearch.users.slice(0, 4).map((user) => (
                      <Pressable key={user.id} style={styles.resultRow} onPress={() => onOpenProfile?.(user.handle)}>
                        <View style={styles.resultAvatar}>
                          <Text style={styles.resultAvatarText}>{user.displayName.slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={styles.resultCopy}>
                          <Text numberOfLines={1} style={styles.resultTitle}>{user.displayName}</Text>
                          <Text numberOfLines={1} style={styles.resultMeta}>@{user.handle}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {remoteSearch?.places.length ? (
                  <View style={styles.resultGroup}>
                    <Text style={styles.resultLabel}>{t('common.places')}</Text>
                    {remoteSearch.places.slice(0, 4).map((place) => (
                      <Pressable key={place.id} style={styles.resultRow} onPress={() => onOpenPlace?.(place.placeName ?? place.name)}>
                        <View style={styles.resultIcon}>
                          <MapPin color={colors.setlogInk} size={17} strokeWidth={2.5} />
                        </View>
                        <View style={styles.resultCopy}>
                          <Text numberOfLines={1} style={styles.resultTitle}>{localizePlaceName(place.placeName ?? place.name, language)}</Text>
                          <Text numberOfLines={1} style={styles.resultMeta}>{place.city ?? place.subtitle}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {remoteSearch && !remoteSearch.users.length && !remoteSearch.places.length && !remoteSearch.posts.length && !searching ? (
                  <Text style={styles.panelMeta}>{t('home.noSearch')}</Text>
                ) : null}
              </View>
            ) : null}

            {notificationsOpen ? (
              <View style={styles.notificationPanel}>
                <Text style={styles.panelTitle}>{t('home.notifications')}</Text>
                {notifications.length ? notifications.map((notification) => (
                  <Pressable
                    key={notification.id}
                    style={styles.notificationRow}
                    onPress={() => {
                      if (notification.postId) {
                        onOpenPost?.(notification.postId);
                        return;
                      }
                      onOpenProfile?.(notification.actor.handle);
                    }}
                  >
                    <View style={[styles.notificationDot, { backgroundColor: notification.read ? colors.setlogLine : notification.type === 'follow' ? colors.setlogMint : colors.setlogPink }]} />
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationTitle}>{notificationText(notification, t)}</Text>
                      <Text style={styles.notificationMeta}>{notification.createdAtLabel}</Text>
                    </View>
                  </Pressable>
                )) : <Text style={styles.panelMeta}>{t('home.noNotifications')}</Text>}
              </View>
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
          <ScreenState
            variant="empty"
            title={t('home.noPosts')}
            message={query ? t('home.noSearch') : t('home.emptyFeed')}
          />
        }
        refreshing={refreshing}
        onRefresh={onRefresh ? refreshFeed : undefined}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 102, 118) }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onOpenPlace={onOpenPlace}
            onCaptureAtPlace={onCaptureAtPlace}
            onNotice={onNotice}
            onPostAction={onPostAction}
            onSharePost={onSharePost}
            onBlockAuthor={onBlockAuthor}
            onOpenPost={onOpenPost}
            onOpenProfile={onOpenProfile}
            t={t}
          />
        )}
      />
    </View>
  );
}

function PostCard({
  item,
  onOpenPlace,
  onCaptureAtPlace,
  onNotice,
  onPostAction,
  onSharePost,
  onBlockAuthor,
  onOpenPost,
  onOpenProfile,
  t,
}: {
  item: MemoryPost;
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onNotice?: (message: string) => void;
  onPostAction?: (postId: string, action: MemoryPostAction, input?: { body?: string }) => void | Promise<void>;
  onSharePost?: (post: MemoryPost) => void | Promise<void>;
  onBlockAuthor?: (handle: string) => void | Promise<void>;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (handle: string) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const locked = item.unlockState === 'locked';
  const state = unlockCopy(item.unlockState, t);
  const initials = item.authorName.slice(0, 1).toUpperCase();
  const Icon = state.Icon;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const mediaUrls = locked ? [] : item.mediaUrls?.length ? item.mediaUrls : item.mediaUrl ? [item.mediaUrl] : [];
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const mediaScrollRef = useRef<ScrollView>(null);
  const { language } = useI18n();
  const displayPlaceName = localizePlaceName(item.placeName, language);

  const selectMedia = (index: number) => {
    if (!mediaUrls.length) {
      return;
    }

    const nextIndex = (index + mediaUrls.length) % mediaUrls.length;
    setMediaIndex(nextIndex);
    if (mediaWidth > 0) {
      mediaScrollRef.current?.scrollTo({ x: mediaWidth * nextIndex, animated: true });
    }
  };

  const runAction = (action: MemoryPostAction, input?: { body?: string }) => {
    Promise.resolve(onPostAction?.(item.id, action, input)).catch((error) => {
      onNotice?.(error instanceof Error ? error.message : t('home.actionFailed'));
    });
  };

  const submitReply = () => {
    const body = replyText.trim();

    if (!body) {
      onNotice?.(t('home.emptyReply'));
      return;
    }

    runAction('reply', { body });
    setReplyText('');
    setReplyOpen(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.postHeader}>
        <Pressable style={[styles.avatar, { backgroundColor: item.accentColor }]} onPress={() => onOpenProfile?.(item.authorHandle)}>
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
        <View style={styles.authorBlock}>
          <View style={styles.authorLine}>
            <Pressable onPress={() => onOpenProfile?.(item.authorHandle)}>
              <Text style={styles.authorName}>{item.authorName}</Text>
            </Pressable>
            <Text style={styles.dotText}>·</Text>
            <Text style={styles.timeText}>{localizeTimeLabel(item.timeLabel, language)}</Text>
          </View>
          <Pressable style={styles.placeLine} onPress={() => onOpenPlace?.(item.placeName)}>
            <MapPin color={colors.setlogMuted} size={13} strokeWidth={2.4} />
            <Text numberOfLines={1} style={styles.placeText}>{displayPlaceName}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.iconButton} onPress={() => setMenuOpen((current) => !current)}>
          <MoreHorizontal color={colors.setlogMuted} size={22} />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.menuPanel}>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              runAction('hide');
            }}
          >
            <Text style={styles.menuText}>{t('home.hide')}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              runAction('report');
            }}
          >
            <Text style={[styles.menuText, styles.menuDangerText]}>{t('home.report')}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              Promise.resolve(onBlockAuthor?.(item.authorHandle)).catch((error) => {
                onNotice?.(error instanceof Error ? error.message : t('home.actionFailed'));
              });
            }}
          >
            <Text style={[styles.menuText, styles.menuDangerText]}>{t('home.blockAuthor', { handle: item.authorHandle })}</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        testID={`feed-media-${item.id}`}
        style={styles.mediaShell}
        onLayout={(event) => setMediaWidth(event.nativeEvent.layout.width)}
      >
        <LinearGradient pointerEvents="none" colors={item.mediaColors} style={StyleSheet.absoluteFill} />
        {mediaUrls.length ? (
          <ScrollView
            ref={mediaScrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={mediaUrls.length > 1}
            showsHorizontalScrollIndicator={false}
            style={StyleSheet.absoluteFill}
            onMomentumScrollEnd={(event) => {
              if (mediaWidth > 0) {
                setMediaIndex(Math.round(event.nativeEvent.contentOffset.x / mediaWidth));
              }
            }}
          >
            {mediaUrls.map((url, index) => (
              <View key={`${url}-${index}`} style={[styles.mediaPage, mediaWidth > 0 ? { width: mediaWidth } : null]}>
                <MediaRenderer uri={url} resizeMode="cover" style={styles.mediaImage} />
              </View>
            ))}
          </ScrollView>
        ) : null}
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.54)']} style={StyleSheet.absoluteFill} />
        {mediaUrls.length > 1 ? (
          <>
            <Pressable
              style={[styles.mediaNavButton, styles.mediaNavLeft]}
              onPress={() => selectMedia(mediaIndex - 1)}
            >
              <ChevronLeft color={colors.setlogPaper} size={19} strokeWidth={2.8} />
            </Pressable>
            <Pressable
              style={[styles.mediaNavButton, styles.mediaNavRight]}
              onPress={() => selectMedia(mediaIndex + 1)}
            >
              <ChevronRight color={colors.setlogPaper} size={19} strokeWidth={2.8} />
            </Pressable>
            <View style={styles.mediaDots}>
              {mediaUrls.map((url, index) => (
                <View key={`${url}-${index}`} style={[styles.mediaDot, mediaIndex === index && styles.mediaDotActive]} />
              ))}
            </View>
          </>
        ) : null}
        <View style={styles.statusBadge}>
          <Icon color={state.color} size={15} strokeWidth={2.7} />
          <Text style={[styles.statusBadgeText, { color: state.color }]}>{state.label}</Text>
        </View>
        {locked ? (
          <Pressable style={styles.lockOverlay} onPress={() => onNotice?.(t('home.lockedText', { meters: item.unlockRadiusMeters }))}>
            <View style={styles.lockCircle}>
              <Lock color={colors.setlogPaper} size={24} strokeWidth={2.6} />
            </View>
            <Text style={styles.lockTitle}>{t('home.lockedTitle')}</Text>
            <Text style={styles.lockText}>{t('home.lockedText', { meters: item.unlockRadiusMeters })}</Text>
          </Pressable>
        ) : null}
        <View style={styles.mediaFooter}>
          <Text style={styles.mediaPlace}>{item.city}</Text>
          <Text style={styles.mediaDistance}>{formatDistance(item.distanceMeters, t)}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <Pressable style={styles.actionButton} onPress={() => runAction('echo')}>
            <Heart color={item.viewer?.echoed ? colors.coral : colors.setlogInk} fill={item.viewer?.echoed ? colors.coral : 'transparent'} size={23} strokeWidth={2.3} />
            <Text style={styles.actionText}>{formatCount(item.stats.echoes)}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setReplyOpen((current) => !current)}>
            <MessageCircle color={colors.setlogInk} size={23} strokeWidth={2.3} />
            <Text style={styles.actionText}>{formatCount(item.stats.replies)}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => Promise.resolve(onSharePost?.(item)).catch(() => onNotice?.(t('home.shareFailed')))}>
            <Send color={colors.setlogInk} size={21} strokeWidth={2.3} />
          </Pressable>
        </View>
        <Pressable style={styles.actionButton} onPress={() => runAction('save')}>
          <Bookmark color={item.viewer?.saved ? colors.setlogMint : colors.setlogInk} fill={item.viewer?.saved ? colors.setlogMint : 'transparent'} size={23} strokeWidth={2.3} />
        </Pressable>
      </View>

      {replyOpen ? (
        <View style={styles.replyBox}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder={t('home.writeReply')}
            placeholderTextColor={colors.setlogFaint}
            style={styles.replyInput}
          />
          <Pressable style={styles.replyButton} onPress={submitReply}>
            <Text style={styles.replyButtonText}>{t('common.post')}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={styles.captionBlock}
        onPress={() => {
          if (locked) {
            onNotice?.(t('home.lockedText', { meters: item.unlockRadiusMeters }));
            return;
          }

          onOpenPost?.(item.id);
        }}
      >
        <Text style={styles.caption}>
          {locked ? (
            t('home.lockedText', { meters: item.unlockRadiusMeters })
          ) : (
            <>
              <Text style={styles.captionAuthor}>{item.authorHandle.replace('@', '')} </Text>
              {item.caption}
            </>
          )}
        </Text>
        {item.recallLabel ? <Text style={styles.recallText}>{localizeRecallLabel(item.recallLabel, language)}</Text> : null}
      </Pressable>

      <Pressable style={styles.placeCard} onPress={() => onCaptureAtPlace?.(item.placeName)}>
        <View style={[styles.placeIcon, { backgroundColor: `${state.color}22` }]}>
          <Plus color={state.color} size={18} strokeWidth={2.7} />
        </View>
        <View style={styles.placeCardCopy}>
          <Text style={styles.placeCardTitle}>{t('home.checkInAt', { placeName: displayPlaceName })}</Text>
          <Text style={styles.placeCardMeta}>{state.meta}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.setlogBg,
  },
  list: {
    width: '100%',
    maxWidth: 560,
  },
  listContent: {
    paddingHorizontal: 14,
  },
  header: {
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '900',
  },
  tagline: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.coral,
    borderColor: colors.setlogPaper,
    borderWidth: 1,
  },
  unreadBadgeText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '900',
  },
  headerButtonActive: {
    borderColor: colors.setlogPink,
    backgroundColor: '#FFF0F4',
  },
  postButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 10,
  },
  searchPanel: {
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 12,
    gap: 10,
    marginTop: 10,
  },
  panelMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  resultGroup: {
    gap: 7,
  },
  resultLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: colors.setlogYellow,
  },
  resultAvatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '900',
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#E9F9EF',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  resultMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  notificationPanel: {
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 12,
    gap: 9,
    marginTop: 14,
  },
  panelTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  notificationMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  modePill: {
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  modePillActive: {
    backgroundColor: colors.setlogInk,
    borderColor: colors.setlogInk,
  },
  modeText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  modeTextActive: {
    color: colors.setlogPaper,
  },
  card: {
    borderRadius: 26,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  postHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '900',
  },
  authorBlock: {
    flex: 1,
    minWidth: 0,
  },
  authorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  dotText: {
    color: colors.setlogFaint,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
  timeText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  placeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  placeText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPanel: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
  },
  menuItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomColor: colors.setlogLine,
    borderBottomWidth: 1,
  },
  menuText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  menuDangerText: {
    color: colors.coral,
  },
  mediaShell: {
    aspectRatio: 0.92,
    overflow: 'hidden',
    backgroundColor: '#F3EDE3',
  },
  mediaPage: {
    width: '100%',
    height: '100%',
  },
  mediaImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaNavButton: {
    position: 'absolute',
    top: '45%',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 18, 15, 0.42)',
    zIndex: 3,
  },
  mediaNavLeft: {
    left: 10,
  },
  mediaNavRight: {
    right: 10,
  },
  mediaDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 3,
  },
  mediaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 254, 248, 0.48)',
  },
  mediaDotActive: {
    width: 16,
    backgroundColor: colors.setlogPaper,
  },
  statusBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    minHeight: 34,
    borderRadius: 22,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 254, 248, 0.88)',
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(7,8,11,0.58)',
  },
  lockCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  lockTitle: {
    color: colors.setlogPaper,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '900',
  },
  lockText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  mediaFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaPlace: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  mediaDistance: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  replyBox: {
    marginHorizontal: 12,
    marginBottom: 10,
    minHeight: 50,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: '#FFF7E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 10,
  },
  replyButton: {
    height: 34,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
  },
  replyButtonText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  captionBlock: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  caption: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  captionAuthor: {
    fontWeight: '900',
  },
  recallText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  placeCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#FFF7E8',
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  placeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  placeCardTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  placeCardMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});

