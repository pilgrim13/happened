import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ban, Bell, Check, ImagePlus, Pencil, Shield, Trash2, UserRound, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRenderer } from '../components/MediaRenderer';
import { localizePlaceName, translateServerMessage, translateVisibility, useI18n } from '../i18n';
import { deleteMemoryPost, fetchConnections, updateMemoryPost, updateProfile } from '../services/happenedApi';
import { colors, fonts, radius } from '../theme/tokens';
import type { AuthSession, MemoryPost, PlaceBubble, SafetySummary, UserConnection, UserConnections, Visibility } from '../types/happened';

type Props = {
  session?: AuthSession | null;
  posts?: MemoryPost[];
  places?: PlaceBubble[];
  safetySummary?: SafetySummary | null;
  onSignOut?: () => void;
  onSessionChange?: (session: AuthSession) => void;
  onOpenProfile?: (handle: string) => void;
  onOpenPost?: (postId: string) => void;
  onPostsChanged?: () => void | Promise<void>;
  onNotice?: (message: string) => void;
};

type AvatarMedia = {
  previewUri: string;
  dataUrl: string;
  fileName: string;
};

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function pickWebAvatar() {
  return new Promise<AvatarMedia | null>((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const rawDataUrl = await readBlobAsDataUrl(file);
        const image = await new Promise<HTMLImageElement>((imageResolve, imageReject) => {
          const nextImage = document.createElement('img');
          nextImage.onload = () => imageResolve(nextImage);
          nextImage.onerror = () => imageReject(new Error('Image could not be loaded.'));
          nextImage.src = rawDataUrl;
        });
        const size = Math.min(960, image.naturalWidth, image.naturalHeight);
        const sourceX = Math.max(0, Math.round((image.naturalWidth - size) / 2));
        const sourceY = Math.max(0, Math.round((image.naturalHeight - size) / 2));
        const outputSize = Math.min(720, size);
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext('2d');
        const dataUrl = context
          ? (() => {
              context.drawImage(image, sourceX, sourceY, size, size, 0, 0, outputSize, outputSize);
              return canvas.toDataURL('image/jpeg', 0.78);
            })()
          : rawDataUrl;

        resolve({
          previewUri: dataUrl,
          dataUrl,
          fileName: file.name?.replace(/\.[^.]+$/, '.jpg') || 'avatar.jpg',
        });
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

export function ProfileScreen({ session, posts = [], places = [], safetySummary, onSignOut, onSessionChange, onOpenProfile, onOpenPost, onPostsChanged, onNotice }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t, toggleLanguage } = useI18n();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(session?.user.displayName ?? '');
  const [handleInput, setHandleInput] = useState(session?.user.handle ?? '');
  const [bioInput, setBioInput] = useState(session?.user.bio ?? '');
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | undefined>(session?.user.avatarUrl);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>();
  const [avatarFileName, setAvatarFileName] = useState<string | undefined>();
  const [connections, setConnections] = useState<UserConnections>({ followers: [], following: [] });
  const [connectionTab, setConnectionTab] = useState<'followers' | 'following'>('followers');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postCaptionInput, setPostCaptionInput] = useState('');
  const [postVisibilityInput, setPostVisibilityInput] = useState<Visibility>('Followers');
  const [postWorking, setPostWorking] = useState<string | null>(null);
  const displayName = session?.user.displayName ?? t('common.guest');
  const handle = session?.user.handle ? `@${session.user.handle}` : '@guest';
  const initials = displayName.slice(0, 1).toUpperCase();
  const bio = session?.user.bio?.trim();
  const userPosts = session?.user.id ? posts.filter((post) => post.authorId === session.user.id) : posts.filter((post) => post.authorHandle === '@you');
  const moderatedCount = (safetySummary?.hiddenCount ?? 0) + (safetySummary?.reportedCount ?? 0);
  const visibleConnections = connectionTab === 'followers' ? connections.followers : connections.following;
  const safetyRows = [
    { id: 'block', label: t('profile.blocked'), value: `${safetySummary?.blockedCount ?? 0}`, Icon: Ban },
    { id: 'report', label: t('profile.reports'), value: moderatedCount ? `${moderatedCount}` : t('common.saved'), Icon: Shield },
    { id: 'notify', label: t('profile.notify'), value: t('profile.on'), Icon: Bell },
    { id: 'delete', label: t('profile.delete'), value: safetySummary?.accountDeletionState === 'By request' || !safetySummary?.accountDeletionState ? t('profile.byRequest') : safetySummary.accountDeletionState, Icon: Trash2 },
  ];

  const loadConnections = useCallback(async () => {
    if (!session?.user.handle) {
      setConnections({ followers: [], following: [] });
      return;
    }

    try {
      setConnections(await fetchConnections(session.user.handle, session.token));
    } catch {
      setConnections({ followers: [], following: [] });
    }
  }, [session?.token, session?.user.handle]);

  useEffect(() => {
    setDisplayNameInput(session?.user.displayName ?? '');
    setHandleInput(session?.user.handle ?? '');
    setBioInput(session?.user.bio ?? '');
    setAvatarPreviewUri(session?.user.avatarUrl);
    setAvatarDataUrl(undefined);
    setAvatarFileName(undefined);
    loadConnections().catch(() => undefined);
  }, [loadConnections, session?.user.avatarUrl, session?.user.bio, session?.user.displayName, session?.user.handle]);

  const pickAvatar = async () => {
    try {
      if (Platform.OS === 'web') {
        const media = await pickWebAvatar();
        if (!media) {
          return;
        }
        setAvatarPreviewUri(media.previewUri);
        setAvatarDataUrl(media.dataUrl);
        setAvatarFileName(media.fileName);
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onNotice?.(t('permissions.photosDenied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.75,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      if (asset.base64) {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        setAvatarPreviewUri(asset.uri);
        setAvatarDataUrl(`data:${mimeType};base64,${asset.base64}`);
        setAvatarFileName(asset.fileName ?? 'avatar.jpg');
      }
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('profile.photoFailed'));
    }
  };

  const saveProfile = async () => {
    if (!session?.token || saving) {
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfile({
        displayName: displayNameInput.trim(),
        handle: handleInput.trim(),
        bio: bioInput.trim(),
        avatarDataUrl,
        avatarFileName,
      }, session.token);
      onSessionChange?.(result.session);
      setEditing(false);
      onNotice?.(translateServerMessage(result.message, language));
      setConnections(await fetchConnections(result.session.user.handle, result.session.token));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('profile.profileSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const beginPostEdit = (post: MemoryPost) => {
    setEditingPostId(post.id);
    setPostCaptionInput(post.caption);
    setPostVisibilityInput(post.visibility);
  };

  const savePost = async (postId: string) => {
    if (!session?.token || postWorking) {
      return;
    }

    setPostWorking(postId);
    try {
      const result = await updateMemoryPost(postId, {
        caption: postCaptionInput.trim(),
        visibility: postVisibilityInput,
      }, session.token);
      onNotice?.(translateServerMessage(result.message, language));
      setEditingPostId(null);
      await onPostsChanged?.();
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('profile.postSaveFailed'));
    } finally {
      setPostWorking(null);
    }
  };

  const deletePost = async (postId: string) => {
    if (!session?.token || postWorking) {
      return;
    }

    setPostWorking(postId);
    try {
      const result = await deleteMemoryPost(postId, session.token);
      onNotice?.(translateServerMessage(result.message, language));
      await onPostsChanged?.();
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('profile.postDeleteFailed'));
    } finally {
      setPostWorking(null);
    }
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.frame}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {session?.user.avatarUrl ? <Image source={{ uri: session.user.avatarUrl }} resizeMode="cover" style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.handle}>{handle}</Text>
              {bio ? <Text numberOfLines={2} style={styles.bio}>{bio}</Text> : null}
            </View>
            <View style={styles.profileActions}>
              <Pressable style={styles.languageButton} onPress={toggleLanguage}>
                <Text style={styles.languageText}>{t('language.switchTo')}</Text>
              </Pressable>
              {session ? (
                <Pressable style={styles.editIconButton} onPress={() => setEditing((current) => !current)}>
                  {editing ? <X color={colors.setlogInk} size={18} strokeWidth={2.5} /> : <Pencil color={colors.setlogInk} size={18} strokeWidth={2.5} />}
                </Pressable>
              ) : null}
            </View>
          </View>

          {editing ? (
            <View style={styles.editCard}>
              <Text style={styles.sectionLabel}>{t('profile.editProfile')}</Text>
              <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
                <View style={styles.avatarPickerPreview}>
                  {avatarPreviewUri ? <Image source={{ uri: avatarPreviewUri }} resizeMode="cover" style={styles.avatarImage} /> : <ImagePlus color={colors.setlogInk} size={22} strokeWidth={2.5} />}
                </View>
                <View style={styles.avatarPickerCopy}>
                  <Text style={styles.avatarPickerTitle}>{t('profile.photo')}</Text>
                  <Text style={styles.avatarPickerMeta}>{t('profile.photoMeta')}</Text>
                </View>
              </Pressable>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('profile.name')}</Text>
                <TextInput
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  autoCapitalize="words"
                  placeholder={t('profile.name')}
                  placeholderTextColor={colors.setlogFaint}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('profile.handle')}</Text>
                <TextInput
                  value={handleInput}
                  onChangeText={(value) => setHandleInput(value.replace(/^@+/, '').toLowerCase())}
                  autoCapitalize="none"
                  placeholder={t('profile.handle')}
                  placeholderTextColor={colors.setlogFaint}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('profile.bio')}</Text>
                <TextInput
                  value={bioInput}
                  onChangeText={setBioInput}
                  multiline
                  placeholder={t('profile.bioPlaceholder')}
                  placeholderTextColor={colors.setlogFaint}
                  style={[styles.input, styles.bioInput]}
                />
              </View>
              <View style={styles.editActions}>
                <Pressable style={styles.cancelButton} disabled={saving} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.saveButton, saving && styles.disabledButton]} disabled={saving} onPress={saveProfile}>
                  <Check color={colors.setlogInk} size={18} strokeWidth={2.7} />
                  <Text style={styles.saveText}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.stats}>
            <Stat label={t('common.memories')} value={`${userPosts.length}`} />
            <Stat label={t('common.followers')} value={`${connections.followers.length}`} />
            <Stat label={t('common.following')} value={`${connections.following.length}`} />
          </View>

          <View style={styles.defaultCard}>
            <Text style={styles.sectionLabel}>{t('profile.defaultVisibility')}</Text>
            <Text style={styles.defaultTitle}>{t('profile.followersOnly')}</Text>
            <Text style={styles.defaultText}>{t('profile.defaultText')}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{t('profile.friends')}</Text>
              <View style={styles.friendTabs}>
                <Pressable style={[styles.friendTab, connectionTab === 'followers' && styles.friendTabActive]} onPress={() => setConnectionTab('followers')}>
                  <Text style={[styles.friendTabText, connectionTab === 'followers' && styles.friendTabTextActive]}>{t('common.followers')}</Text>
                </Pressable>
                <Pressable style={[styles.friendTab, connectionTab === 'following' && styles.friendTabActive]} onPress={() => setConnectionTab('following')}>
                  <Text style={[styles.friendTabText, connectionTab === 'following' && styles.friendTabTextActive]}>{t('common.following')}</Text>
                </Pressable>
              </View>
            </View>
            {visibleConnections.length ? visibleConnections.slice(0, 8).map((user) => (
              <ConnectionRow key={user.id} user={user} onOpenProfile={onOpenProfile} />
            )) : (
              <View style={styles.emptyFriendRow}>
                <Text style={styles.emptyFriendText}>{connectionTab === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.myPosts')}</Text>
            {userPosts.length ? userPosts.slice(0, 8).map((post) => (
              <View key={post.id} style={styles.myPostRow}>
                <Pressable style={styles.myPostThumb} onPress={() => onOpenPost?.(post.id)}>
                  {post.mediaUrls?.[0] ?? post.mediaUrl ? <MediaRenderer uri={post.mediaUrls?.[0] ?? post.mediaUrl} resizeMode="cover" style={styles.myPostImage} /> : null}
                </Pressable>
                <View style={styles.myPostCopy}>
                  {editingPostId === post.id ? (
                    <>
                      <TextInput
                        value={postCaptionInput}
                        onChangeText={setPostCaptionInput}
                        multiline
                        style={[styles.input, styles.postEditInput]}
                      />
                      <View style={styles.visibilityMiniRow}>
                        {(['Followers', 'PublicAfter1h', 'Public'] as const).map((item) => (
                          <Pressable key={item} style={[styles.visibilityMini, postVisibilityInput === item && styles.visibilityMiniActive]} onPress={() => setPostVisibilityInput(item)}>
                            <Text style={[styles.visibilityMiniText, postVisibilityInput === item && styles.visibilityMiniTextActive]}>{translateVisibility(item, t)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text numberOfLines={2} style={styles.myPostCaption}>{post.caption}</Text>
                      <Text numberOfLines={1} style={styles.myPostMeta}>{localizePlaceName(post.placeName, language)} · {translateVisibility(post.visibility, t)}</Text>
                    </>
                  )}
                  <View style={styles.myPostActions}>
                    {editingPostId === post.id ? (
                      <>
                        <Pressable style={styles.smallButton} disabled={postWorking === post.id} onPress={() => savePost(post.id)}>
                          <Text style={styles.smallButtonText}>{t('common.save')}</Text>
                        </Pressable>
                        <Pressable style={styles.smallButton} disabled={postWorking === post.id} onPress={() => setEditingPostId(null)}>
                          <Text style={styles.smallButtonMutedText}>{t('common.cancel')}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable style={styles.smallButton} onPress={() => beginPostEdit(post)}>
                          <Text style={styles.smallButtonText}>{t('common.edit')}</Text>
                        </Pressable>
                        <Pressable style={styles.smallButton} disabled={postWorking === post.id} onPress={() => deletePost(post.id)}>
                          <Text style={styles.smallButtonDangerText}>{t('common.delete')}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )) : (
              <View style={styles.emptyFriendRow}>
                <Text style={styles.emptyFriendText}>{t('profile.noMyPosts')}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('common.safety')}</Text>
            {safetyRows.map(({ id, label, value, Icon }) => (
              <View key={id} style={styles.safetyRow}>
                <View style={styles.safetyIcon}>
                  <Icon color={colors.setlogInk} size={18} strokeWidth={2.4} />
                </View>
                <Text style={styles.safetyLabel}>{label}</Text>
                <Text style={styles.safetyValue}>{value}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </Pressable>
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
      <View style={styles.connectionState}>
        <UserRound color={colors.setlogInk} size={15} strokeWidth={2.4} />
        <Text style={styles.connectionStateText}>{user.viewer.isSelf ? t('tabs.profile') : user.viewer.isFollowing ? t('common.following') : t('common.follow')}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  frame: {
    width: '100%',
    maxWidth: 560,
    minWidth: 0,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginRight: 13,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileActions: {
    alignItems: 'flex-end',
    gap: 7,
  },
  languageButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    backgroundColor: colors.setlogPaper,
  },
  languageText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  editIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  name: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 31,
    fontWeight: '900',
  },
  handle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  bio: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  stats: {
    minHeight: 76,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    marginBottom: 14,
  },
  editCard: {
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  avatarPicker: {
    minHeight: 62,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFEF8',
  },
  avatarPickerPreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.setlogYellow,
    marginRight: 10,
  },
  avatarPickerCopy: {
    flex: 1,
    minWidth: 0,
  },
  avatarPickerTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  avatarPickerMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 44,
    borderRadius: 16,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    backgroundColor: '#FFFEF8',
  },
  bioInput: {
    minHeight: 74,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  cancelText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  saveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.setlogMint,
  },
  disabledButton: {
    opacity: 0.58,
  },
  saveText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  defaultCard: {
    borderRadius: 22,
    borderColor: colors.setlogBlue,
    borderWidth: 1,
    backgroundColor: 'rgba(185, 216, 255, 0.24)',
    padding: 15,
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  defaultTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  defaultText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 5,
    flexShrink: 1,
  },
  section: {
    gap: 9,
    marginBottom: 18,
  },
  sectionHeader: {
    gap: 8,
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
    minHeight: 58,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  connectionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginRight: 10,
    overflow: 'hidden',
  },
  connectionAvatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '900',
  },
  connectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  connectionName: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  connectionHandle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  connectionState: {
    minHeight: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(114, 230, 156, 0.28)',
  },
  connectionStateText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyFriendRow: {
    minHeight: 54,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  emptyFriendText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  myPostRow: {
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    padding: 10,
  },
  myPostThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E9F9EF',
    marginRight: 10,
  },
  myPostImage: {
    width: '100%',
    height: '100%',
  },
  myPostCopy: {
    flex: 1,
    minWidth: 0,
  },
  myPostCaption: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  myPostMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  myPostActions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  smallButton: {
    minHeight: 32,
    borderRadius: 14,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFEF8',
  },
  smallButtonText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  smallButtonMutedText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  smallButtonDangerText: {
    color: colors.coral,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  postEditInput: {
    minHeight: 64,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  visibilityMiniRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
  },
  visibilityMini: {
    minHeight: 30,
    borderRadius: 13,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.setlogPaper,
  },
  visibilityMiniActive: {
    backgroundColor: colors.setlogMint,
    borderColor: colors.setlogMint,
  },
  visibilityMiniText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  visibilityMiniTextActive: {
    color: colors.setlogInk,
  },
  safetyRow: {
    minHeight: 58,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  safetyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 183, 200, 0.22)',
    marginRight: 10,
  },
  safetyLabel: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  safetyValue: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
    marginLeft: 8,
  },
  signOutButton: {
    height: 50,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: colors.setlogPaper,
  },
  signOutText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
});
