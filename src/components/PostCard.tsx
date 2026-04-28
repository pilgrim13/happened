import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ChevronLeft, ChevronRight, Clock, Globe, Heart, Lock, MapPin, MessageCircle, MoreHorizontal, Plus, RadioTower, Send } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MediaRenderer } from './MediaRenderer';
import { PostEditModal } from './PostEditModal';
import { localizePlaceName, localizeRecallLabel, localizeTimeLabel, useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';
import type { FeedMode, MemoryPost, MemoryPostAction, UnlockState, Visibility } from '../types/happened';

export function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

export function formatDistance(distanceMeters: number | null, t: ReturnType<typeof useI18n>['t']): string | null {
  if (distanceMeters === null || distanceMeters === undefined) return null;
  if (distanceMeters >= 1000) {
    return t('home.distanceKm', { kilometers: (distanceMeters / 1000).toFixed(1) });
  }

  return t('home.distanceMeters', { meters: distanceMeters });
}

export function unlockCopy(state: UnlockState, t: ReturnType<typeof useI18n>['t']) {
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

export function matchesQuery(post: MemoryPost, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [post.authorName, post.authorHandle, post.placeName, post.city, post.caption]
    .some((value) => value.toLowerCase().includes(normalized));
}

function getPublicCountdownMins(item: MemoryPost, currentUserId?: string): number | null {
  if (item.visibility !== 'PublicAfter1h' || !currentUserId || item.authorId !== currentUserId) {
    return null;
  }
  const unlockAtMs = item.unlockAt
    ? new Date(item.unlockAt).getTime()
    : item.createdAt
      ? new Date(item.createdAt).getTime() + 60 * 60 * 1000
      : null;
  if (!unlockAtMs) return null;
  const remainMs = unlockAtMs - Date.now();
  if (remainMs <= 0) return null;
  return Math.ceil(remainMs / (60 * 1000));
}

type PostCardProps = {
  item: MemoryPost;
  currentUserId?: string;
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onNotice?: (message: string) => void;
  onPostAction?: (postId: string, action: MemoryPostAction, input?: { body?: string }) => void | Promise<void>;
  onEditPost?: (postId: string, input: { caption?: string; visibility?: Visibility }) => void | Promise<void>;
  onDeletePost?: (postId: string) => void | Promise<void>;
  onSharePost?: (post: MemoryPost) => void | Promise<void>;
  onBlockAuthor?: (handle: string) => void | Promise<void>;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (handle: string) => void;
  t: ReturnType<typeof useI18n>['t'];
};

export const PostCard = React.memo(function PostCard({
  item,
  currentUserId,
  onOpenPlace,
  onCaptureAtPlace,
  onNotice,
  onPostAction,
  onEditPost,
  onDeletePost,
  onSharePost,
  onBlockAuthor,
  onOpenPost,
  onOpenProfile,
  t,
}: PostCardProps) {
  const locked = item.unlockState === 'locked';
  const state = unlockCopy(item.unlockState, t);
  const initials = item.authorName.slice(0, 1).toUpperCase();
  const Icon = state.Icon;
  const countdownMins = getPublicCountdownMins(item, currentUserId);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('Public');
  const isOwn = Boolean(currentUserId && item.authorId === currentUserId);
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
            {item.visibility === 'Public' ? (
              <View style={styles.visBadge}>
                <Globe color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                <Text style={styles.visBadgeText}>{t('visibility.Public.short')}</Text>
              </View>
            ) : item.visibility === 'PublicAfter1h' ? (
              <View style={styles.visBadge}>
                <Clock color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                <Text style={styles.visBadgeText}>{t('visibility.PublicAfter1h.short')}</Text>
              </View>
            ) : item.visibility === 'Followers' ? (
              <View style={styles.visBadge}>
                <Lock color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                <Text style={styles.visBadgeText}>{t('visibility.Followers.short')}</Text>
              </View>
            ) : null}
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
          {isOwn ? (
            <>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setEditCaption(item.caption);
                  setEditVisibility(item.visibility as Visibility);
                  setEditOpen(true);
                }}
              >
                <Text style={styles.menuText}>{t('home.editPost')}</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  Alert.alert(
                    t('home.deleteConfirmTitle'),
                    t('home.deleteConfirmText'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('home.deleteConfirmAction'),
                        style: 'destructive',
                        onPress: () => {
                          Promise.resolve(onDeletePost?.(item.id)).catch((error) => {
                            onNotice?.(error instanceof Error ? error.message : t('home.actionFailed'));
                          });
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={[styles.menuText, styles.menuDangerText]}>{t('home.deletePost')}</Text>
              </Pressable>
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      ) : null}

      {editOpen ? (
        <PostEditModal
          caption={editCaption}
          visibility={editVisibility}
          onCaptionChange={setEditCaption}
          onVisibilityChange={setEditVisibility}
          onCancel={() => setEditOpen(false)}
          onSave={() => {
            Promise.resolve(
              onEditPost?.(item.id, { caption: editCaption, visibility: editVisibility }),
            )
              .then(() => setEditOpen(false))
              .catch((error) => {
                onNotice?.(error instanceof Error ? error.message : t('home.actionFailed'));
              });
          }}
        />
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
            style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ touchAction: mediaUrls.length > 1 ? 'pan-x' : 'pan-y' } as any) : null]}
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
          <Text style={[styles.statusBadgeText, { color: state.color }]}>
            {countdownMins !== null ? t('home.publicCountdown', { min: countdownMins }) : state.label}
          </Text>
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
          {formatDistance(item.distanceMeters, t) !== null ? (
            <Text style={styles.mediaDistance}>{formatDistance(item.distanceMeters, t)}</Text>
          ) : null}
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
});

const styles = StyleSheet.create({
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
    fontSize: 16,
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
  visBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  visBadgeText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
  },
});
