import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bookmark, Grid2X2, Heart, MapPin, MessageCircle, UserCheck, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRenderer } from '../components/MediaRenderer';
import { localizePlaceName, translateServerMessage, useI18n } from '../i18n';
import { fetchConnections, fetchProfile, toggleBlock, toggleFollow } from '../services/happenedApi';
import { colors, fonts, radius } from '../theme/tokens';
import type { MemoryPost, PublicProfile, UserConnection, UserConnections } from '../types/happened';

type Props = {
  handle: string;
  initialPosts?: MemoryPost[];
  sessionToken?: string | null;
  onBack: () => void;
  onOpenPost?: (postId: string) => void;
  onOpenPlace?: (placeName: string) => void;
  onOpenProfile?: (handle: string) => void;
  onNotice?: (message: string) => void;
  onBlockedChange?: () => void | Promise<void>;
};

function displayHandle(handle: string) {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function createInitialProfile(handle: string, posts: MemoryPost[] = []): PublicProfile | null {
  const normalizedHandle = handle.replace(/^@+/, '').toLowerCase();
  const profilePosts = posts.filter((post) => post.authorHandle.replace(/^@+/, '').toLowerCase() === normalizedHandle);
  const firstPost = profilePosts[0];

  if (!firstPost) {
    return null;
  }

  return {
    user: {
      id: firstPost.authorId ?? `seed:${normalizedHandle}`,
      displayName: firstPost.authorName,
      handle: normalizedHandle,
    },
    stats: {
      posts: profilePosts.length,
      followers: 0,
      following: 0,
      echoes: profilePosts.reduce((total, post) => total + post.stats.echoes, 0),
      saves: profilePosts.reduce((total, post) => total + post.stats.saves, 0),
    },
    viewer: {
      isSelf: false,
      isFollowing: false,
      isBlocked: false,
      blocksViewer: false,
    },
    posts: profilePosts,
    savedPosts: [],
  };
}

export function UserProfileScreen({ handle, initialPosts = [], sessionToken, onBack, onOpenPost, onOpenPlace, onOpenProfile, onNotice, onBlockedChange }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const [profile, setProfile] = useState<PublicProfile | null>(() => createInitialProfile(handle, initialPosts));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<'posts' | 'saved'>('posts');
  const [connectionTab, setConnectionTab] = useState<'followers' | 'following'>('followers');
  const [connections, setConnections] = useState<UserConnections>({ followers: [], following: [] });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const nextProfile = await fetchProfile(handle, sessionToken);
      setProfile(nextProfile);
      setConnections(await fetchConnections(nextProfile.user.handle, sessionToken));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('user.failed'));
    } finally {
      setLoading(false);
    }
  }, [handle, onNotice, sessionToken]);

  useEffect(() => {
    loadProfile().catch(() => undefined);
  }, [loadProfile]);

  const follow = async () => {
    if (!profile || working) {
      return;
    }

    setWorking(true);
    try {
      const result = await toggleFollow(profile.user.handle, sessionToken);
      setProfile(result.profile);
      onNotice?.(translateServerMessage(result.message, language));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('user.followFailed'));
    } finally {
      setWorking(false);
    }
  };

  const block = async () => {
    if (!profile || working) {
      return;
    }

    setWorking(true);
    try {
      const result = await toggleBlock(profile.user.handle, sessionToken);
      setProfile(result.profile);
      onNotice?.(translateServerMessage(result.message, language));
      await onBlockedChange?.();
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('user.blockFailed'));
    } finally {
      setWorking(false);
    }
  };

  const visiblePosts = tab === 'saved' ? profile?.savedPosts ?? [] : profile?.posts ?? [];
  const initials = profile?.user.displayName.slice(0, 1).toUpperCase() ?? '?';
  const FollowIcon = profile?.viewer.isFollowing ? UserCheck : UserPlus;

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom + 36, 74) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={onBack}>
              <ArrowLeft color={colors.setlogInk} size={22} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.headerTitle}>{profile ? displayHandle(profile.user.handle) : t('tabs.profile')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading && !profile ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('user.loading')}</Text>
            </View>
          ) : null}

          {profile ? (
            <>
              <View style={styles.profileBlock}>
                <View style={styles.profileTop}>
                  <View style={styles.avatar}>
                    {profile.user.avatarUrl ? <Image source={{ uri: profile.user.avatarUrl }} resizeMode="cover" style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.name}>{profile.user.displayName}</Text>
                    <Text style={styles.handle}>{displayHandle(profile.user.handle)}</Text>
                    {profile.user.bio ? <Text numberOfLines={2} style={styles.bio}>{profile.user.bio}</Text> : null}
                  </View>
                  {!profile.viewer.isSelf ? (
                    <Pressable style={[styles.followButton, profile.viewer.isFollowing && styles.followingButton]} disabled={working} onPress={follow}>
                      <FollowIcon color={profile.viewer.isFollowing ? colors.setlogInk : colors.setlogInk} size={18} strokeWidth={2.6} />
                      <Text style={[styles.followText, profile.viewer.isFollowing && styles.followingText]}>{profile.viewer.isFollowing ? t('common.following') : t('common.follow')}</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.stats}>
                  <Stat label={t('common.posts')} value={`${profile.stats.posts}`} />
                  <Stat label={t('common.followers')} value={`${profile.stats.followers}`} />
                  <Stat label={t('common.following')} value={`${profile.stats.following}`} />
                </View>

                {!profile.viewer.isSelf ? (
                  <Pressable style={[styles.blockButton, profile.viewer.isBlocked && styles.unblockButton]} disabled={working} onPress={block}>
                    <Text style={[styles.blockText, profile.viewer.isBlocked && styles.unblockText]}>{profile.viewer.isBlocked ? t('user.unblock') : t('user.block')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.connectionBlock}>
                <View style={styles.friendTabs}>
                  <Pressable style={[styles.friendTab, connectionTab === 'followers' && styles.friendTabActive]} onPress={() => setConnectionTab('followers')}>
                    <Text style={[styles.friendTabText, connectionTab === 'followers' && styles.friendTabTextActive]}>{t('common.followers')}</Text>
                  </Pressable>
                  <Pressable style={[styles.friendTab, connectionTab === 'following' && styles.friendTabActive]} onPress={() => setConnectionTab('following')}>
                    <Text style={[styles.friendTabText, connectionTab === 'following' && styles.friendTabTextActive]}>{t('common.following')}</Text>
                  </Pressable>
                </View>
                {(connectionTab === 'followers' ? connections.followers : connections.following).length ? (
                  (connectionTab === 'followers' ? connections.followers : connections.following).slice(0, 6).map((user) => (
                    <ConnectionRow key={user.id} user={user} onOpenProfile={onOpenProfile} />
                  ))
                ) : (
                  <View style={styles.emptyConnection}>
                    <Text style={styles.emptyConnectionText}>{connectionTab === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}</Text>
                  </View>
                )}
              </View>

              <View style={styles.segment}>
                <Pressable style={[styles.segmentItem, tab === 'posts' && styles.segmentItemActive]} onPress={() => setTab('posts')}>
                  <Grid2X2 color={tab === 'posts' ? colors.setlogPaper : colors.setlogMuted} size={17} strokeWidth={2.5} />
                  <Text style={[styles.segmentText, tab === 'posts' && styles.segmentTextActive]}>{t('common.posts')}</Text>
                </Pressable>
                {profile.viewer.isSelf ? (
                  <Pressable style={[styles.segmentItem, tab === 'saved' && styles.segmentItemActive]} onPress={() => setTab('saved')}>
                    <Bookmark color={tab === 'saved' ? colors.setlogPaper : colors.setlogMuted} size={17} strokeWidth={2.5} />
                    <Text style={[styles.segmentText, tab === 'saved' && styles.segmentTextActive]}>{t('common.saved')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.posts}>
                {visiblePosts.length ? visiblePosts.map((post) => (
                  <ProfilePost key={post.id} post={post} onOpenPost={onOpenPost} onOpenPlace={onOpenPlace} />
                )) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>{profile.viewer.isBlocked ? t('user.blockedByYou') : profile.viewer.blocksViewer ? t('user.blocksViewer') : tab === 'saved' ? t('user.noSaved') : t('user.noPosts')}</Text>
                    <Text style={styles.emptyText}>{tab === 'saved' ? t('user.noSavedText') : t('user.noPostsText')}</Text>
                  </View>
                )}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ConnectionRow({ user, onOpenProfile }: { user: UserConnection; onOpenProfile?: (handle: string) => void }) {
  const { t } = useI18n();

  return (
    <Pressable style={styles.connectionRow} onPress={() => onOpenProfile?.(user.handle)}>
      <View style={styles.connectionAvatar}>
        {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} resizeMode="cover" style={styles.avatarImage} /> : <Text style={styles.connectionAvatarText}>{user.displayName.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.connectionCopy}>
        <Text numberOfLines={1} style={styles.connectionName}>{user.displayName}</Text>
        <Text numberOfLines={1} style={styles.connectionHandle}>@{user.handle}</Text>
      </View>
      <Text style={styles.connectionStateText}>{user.viewer.isSelf ? t('tabs.profile') : user.viewer.isFollowing ? t('common.following') : t('common.follow')}</Text>
    </Pressable>
  );
}

function ProfilePost({ post, onOpenPost, onOpenPlace }: { post: MemoryPost; onOpenPost?: (postId: string) => void; onOpenPlace?: (placeName: string) => void }) {
  const { language } = useI18n();

  return (
    <Pressable style={styles.postCard} onPress={() => onOpenPost?.(post.id)}>
      <View style={styles.postMedia}>
        <LinearGradient colors={post.mediaColors} style={StyleSheet.absoluteFill} />
        {post.mediaUrls?.[0] ?? post.mediaUrl ? <MediaRenderer uri={post.mediaUrls?.[0] ?? post.mediaUrl} resizeMode="cover" style={styles.postImage} /> : null}
      </View>
      <View style={styles.postCopy}>
        <Text numberOfLines={2} style={styles.postCaption}>{post.caption}</Text>
        <Pressable style={styles.postPlace} onPress={() => onOpenPlace?.(post.placeName)}>
          <MapPin color={colors.setlogMuted} size={13} strokeWidth={2.4} />
          <Text numberOfLines={1} style={styles.postPlaceText}>{localizePlaceName(post.placeName, language)}</Text>
        </Pressable>
        <View style={styles.postStats}>
          <View style={styles.postStat}>
            <Heart color={colors.setlogMuted} size={14} strokeWidth={2.4} />
            <Text style={styles.postStatText}>{post.stats.echoes}</Text>
          </View>
          <View style={styles.postStat}>
            <MessageCircle color={colors.setlogMuted} size={14} strokeWidth={2.4} />
            <Text style={styles.postStatText}>{post.stats.replies}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  frame: {
    width: '100%',
    maxWidth: 560,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  profileBlock: {
    borderRadius: 26,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 14,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 27,
    fontWeight: '900',
  },
  handle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  bio: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  followButton: {
    minHeight: 38,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 13,
    backgroundColor: colors.setlogMint,
  },
  followingButton: {
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  followText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  followingText: {
    color: colors.setlogInk,
  },
  blockButton: {
    minHeight: 42,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 183, 200, 0.18)',
  },
  unblockButton: {
    backgroundColor: colors.setlogPaper,
  },
  blockText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  unblockText: {
    color: colors.setlogMuted,
  },
  connectionBlock: {
    gap: 8,
    marginTop: 12,
  },
  friendTabs: {
    minHeight: 40,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
    backgroundColor: colors.setlogPaper,
  },
  friendTab: {
    flex: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendTabActive: {
    backgroundColor: colors.setlogInk,
  },
  friendTabText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  friendTabTextActive: {
    color: colors.setlogPaper,
  },
  connectionRow: {
    minHeight: 54,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  connectionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.setlogYellow,
    marginRight: 10,
  },
  connectionAvatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '900',
  },
  connectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  connectionName: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  connectionHandle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  connectionStateText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 8,
  },
  emptyConnection: {
    minHeight: 52,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  emptyConnectionText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  stats: {
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 232, 147, 0.24)',
    flexDirection: 'row',
    marginTop: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  segment: {
    minHeight: 44,
    borderRadius: 20,
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
    marginTop: 12,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentItemActive: {
    backgroundColor: colors.setlogInk,
  },
  segmentText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: colors.setlogPaper,
  },
  posts: {
    gap: 12,
    marginTop: 12,
  },
  postCard: {
    borderRadius: 24,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
  },
  postMedia: {
    aspectRatio: 1.2,
    backgroundColor: '#F3EDE3',
  },
  postImage: {
    ...StyleSheet.absoluteFillObject,
  },
  postCopy: {
    padding: 12,
  },
  postCaption: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  postPlace: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  postPlaceText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  postStats: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyBox: {
    minHeight: 142,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
});
