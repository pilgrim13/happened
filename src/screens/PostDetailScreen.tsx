import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Clock, Globe, Heart, Lock, MapPin, MessageCircle, Send, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInput as TextInputType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRenderer } from '../components/MediaRenderer';
import { localizePlaceName, localizeTimeLabel, useI18n } from '../i18n';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { deletePostComment, fetchPostDetail } from '../services/happenedApi';
import { colors, fonts, radius } from '../theme/tokens';
import type { MemoryPost, MemoryPostAction, PostDetail } from '../types/happened';

type Props = {
  postId: string;
  initialPost?: MemoryPost;
  sessionToken?: string | null;
  onBack: () => void;
  onOpenPlace?: (placeName: string) => void;
  onOpenProfile?: (handle: string) => void;
  onPostAction?: (postId: string, action: MemoryPostAction, input?: { body?: string }) => void | Promise<void>;
  onNotice?: (message: string) => void;
};

function handleLabel(value: string) {
  return value.startsWith('@') ? value : `@${value}`;
}

export function PostDetailScreen({ postId, initialPost, sessionToken, onBack, onOpenPlace, onOpenProfile, onPostAction, onNotice }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const keyboardHeight = useVisualViewport();
  const [detail, setDetail] = useState<PostDetail | null>(initialPost ? { post: initialPost, comments: [] } : null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const mediaScrollRef = useRef<ScrollView>(null);
  const outerScrollRef = useRef<ScrollView>(null);
  const commentsAnchorY = useRef(0);
  const inputRef = useRef<TextInputType>(null);
  const prevUnlockStateRef = useRef<string | undefined>(undefined);
  const scrollToComments = useCallback(() => {
    outerScrollRef.current?.scrollTo({ y: Math.max(0, commentsAnchorY.current - 12), animated: true });
  }, []);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchPostDetail(postId, sessionToken));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('post.failed'));
    } finally {
      setLoading(false);
    }
  }, [onNotice, postId, sessionToken]);

  useEffect(() => {
    loadDetail().catch(() => undefined);
  }, [loadDetail]);

  // locked → 비잠금 전환 시 1회성 toast
  useEffect(() => {
    const currentState = detail?.post?.unlockState;
    if (prevUnlockStateRef.current === 'locked' && currentState && currentState !== 'locked') {
      onNotice?.(t('post.unlockedByComment'));
    }
    if (currentState !== undefined) {
      prevUnlockStateRef.current = currentState;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.post?.unlockState]);

  const runAction = async (action: MemoryPostAction, input?: { body?: string }) => {
    setSubmitting(true);
    try {
      await onPostAction?.(postId, action, input);
      setDetail(await fetchPostDetail(postId, sessionToken));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('home.actionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    const body = replyText.trim();

    if (!body) {
      onNotice?.(t('home.emptyReply'));
      return;
    }

    await runAction('reply', { body });
    setReplyText('');
    inputRef.current?.blur();
  };

  const deleteComment = async (commentId: string) => {
    setSubmitting(true);
    try {
      setDetail(await deletePostComment(postId, commentId, sessionToken));
      onNotice?.(t('post.deleted'));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('post.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const post = detail?.post;
  const locked = post?.unlockState === 'locked';
  const mediaUrls = post && !locked ? post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : [] : [];
  const displayPlaceName = post ? localizePlaceName(post.placeName, language) : '';

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

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={outerScrollRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom + 34, 70) + keyboardHeight }]}
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? ({ overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as any) : undefined}
      >
        <View style={styles.frame}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={onBack}>
              <ArrowLeft color={colors.setlogInk} size={22} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('common.post')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading && !post ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('post.loading')}</Text>
            </View>
          ) : null}

          {post ? (
            <>
              <View style={styles.card}>
                <View style={styles.authorRow}>
                  <Pressable style={[styles.avatar, { backgroundColor: post.accentColor }]} onPress={() => onOpenProfile?.(post.authorHandle)}>
                    <Text style={styles.avatarText}>{post.authorName.slice(0, 1).toUpperCase()}</Text>
                  </Pressable>
                  <Pressable style={styles.authorCopy} onPress={() => onOpenProfile?.(post.authorHandle)}>
                    <Text style={styles.authorName}>{post.authorName}</Text>
                    <View style={styles.authorMeta}>
                      <Text style={styles.authorHandle}>{handleLabel(post.authorHandle)} · {localizeTimeLabel(post.timeLabel, language)}</Text>
                      {post.visibility === 'Public' ? (
                        <View style={styles.visBadge}>
                          <Globe color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                          <Text style={styles.visBadgeText}>{t('visibility.Public.short')}</Text>
                        </View>
                      ) : post.visibility === 'PublicAfter1h' ? (
                        <View style={styles.visBadge}>
                          <Clock color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                          <Text style={styles.visBadgeText}>{t('visibility.PublicAfter1h.short')}</Text>
                        </View>
                      ) : post.visibility === 'Followers' ? (
                        <View style={styles.visBadge}>
                          <Lock color={colors.setlogMuted} size={10} strokeWidth={2.4} />
                          <Text style={styles.visBadgeText}>{t('visibility.Followers.short')}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </View>

                <Pressable style={styles.placeRow} onPress={() => onOpenPlace?.(post.placeName)}>
                  <MapPin color={colors.setlogMuted} size={15} strokeWidth={2.4} />
                  <Text style={styles.placeText}>{displayPlaceName}</Text>
                </Pressable>

                <View style={styles.mediaShell} onLayout={(event) => setMediaWidth(event.nativeEvent.layout.width)}>
                  <LinearGradient pointerEvents="none" colors={post.mediaColors} style={StyleSheet.absoluteFill} />
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
                  {locked ? (
                    <View style={styles.lockOverlay}>
                      <View style={styles.lockCircle}>
                        <Lock color={colors.setlogPaper} size={24} strokeWidth={2.6} />
                      </View>
                      <Text style={styles.lockTitle}>{t('home.lockedTitle')}</Text>
                      <Text style={styles.lockText}>{t('home.lockedText', { meters: post.unlockRadiusMeters })}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.caption}>{locked ? t('home.lockedText', { meters: post.unlockRadiusMeters }) : post.caption}</Text>

                {!locked ? <View style={styles.actionRow}>
                  <Pressable style={styles.actionButton} disabled={submitting} onPress={() => runAction('echo')}>
                    <Heart color={post.viewer?.echoed ? colors.coral : colors.setlogInk} fill={post.viewer?.echoed ? colors.coral : 'transparent'} size={22} strokeWidth={2.3} />
                    <Text style={styles.actionText}>{post.stats.echoes}</Text>
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={scrollToComments} accessibilityRole="button" accessibilityLabel="댓글로 이동">
                    <MessageCircle color={colors.setlogInk} size={22} strokeWidth={2.3} />
                    <Text style={styles.actionText}>{post.stats.replies}</Text>
                  </Pressable>
                  <Pressable style={styles.actionButton} disabled={submitting} onPress={() => runAction('save')}>
                    <Bookmark color={post.viewer?.saved ? colors.setlogMint : colors.setlogInk} fill={post.viewer?.saved ? colors.setlogMint : 'transparent'} size={22} strokeWidth={2.3} />
                    <Text style={styles.actionText}>{post.stats.saves}</Text>
                  </Pressable>
                </View> : null}
              </View>

              {!locked ? <View style={styles.replyBox}>
                <TextInput
                  ref={inputRef}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder={t('home.writeReply')}
                  placeholderTextColor={colors.setlogFaint}
                  style={styles.replyInput}
                  multiline
                />
                <Pressable style={[styles.replyButton, submitting && styles.disabledButton]} disabled={submitting} onPress={submitReply}>
                  <Send color={colors.setlogInk} size={18} strokeWidth={2.6} />
                </Pressable>
              </View> : null}

              {!locked ? <View style={styles.commentsBlock} onLayout={(e) => { commentsAnchorY.current = e.nativeEvent.layout.y; }}>
                <Text style={styles.sectionTitle}>{t('common.replies')}</Text>
                {detail.comments.length ? detail.comments.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <Pressable style={styles.commentAvatar} onPress={() => onOpenProfile?.(comment.author.handle)}>
                      <Text style={styles.commentAvatarText}>{comment.author.displayName.slice(0, 1).toUpperCase()}</Text>
                    </Pressable>
                    <View style={styles.commentCopy}>
                      <Pressable onPress={() => onOpenProfile?.(comment.author.handle)}>
                        <Text style={styles.commentAuthor}>{comment.author.displayName} <Text style={styles.commentMeta}>@{comment.author.handle} · {comment.createdAtLabel}</Text></Text>
                      </Pressable>
                      <Text style={styles.commentText}>{comment.body}</Text>
                    </View>
                    {comment.canDelete ? (
                      <Pressable style={styles.deleteButton} disabled={submitting} onPress={() => deleteComment(comment.id)}>
                        <Trash2 color={colors.setlogMuted} size={18} strokeWidth={2.2} />
                      </Pressable>
                    ) : null}
                  </View>
                )) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>{t('post.noReplies')}</Text>
                    <Text style={styles.emptyText}>{t('post.noRepliesText')}</Text>
                  </View>
                )}
              </View> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.setlogBg,
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
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '900',
  },
  card: {
    borderRadius: 26,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    overflow: 'hidden',
  },
  authorRow: {
    minHeight: 62,
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
  authorCopy: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  authorHandle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
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
  placeRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderTopColor: colors.setlogLine,
    borderTopWidth: 1,
  },
  placeText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  mediaShell: {
    aspectRatio: 0.92,
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
    bottom: 12,
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
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 18, 15, 0.56)',
    paddingHorizontal: 28,
  },
  lockCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 254, 248, 0.2)',
    marginBottom: 14,
  },
  lockTitle: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  lockText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  caption: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 12,
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
    fontWeight: '900',
  },
  replyBox: {
    minHeight: 56,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 10,
  },
  replyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogMint,
  },
  disabledButton: {
    opacity: 0.55,
  },
  commentsBlock: {
    marginTop: 18,
    gap: 10,
  },
  sectionTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: '900',
  },
  commentRow: {
    minHeight: 70,
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    padding: 11,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginRight: 10,
  },
  commentAvatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '900',
  },
  commentCopy: {
    flex: 1,
    minWidth: 0,
  },
  commentAuthor: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  commentMeta: {
    color: colors.setlogMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    minHeight: 126,
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
