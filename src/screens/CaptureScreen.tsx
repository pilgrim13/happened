import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Clock, ImagePlus, MapPin, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRenderer } from '../components/MediaRenderer';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight';
import { translateVisibility, useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';
import type { CheckInToken, Visibility } from '../types/happened';

type Props = {
  placeName: string | null;
  displayPlaceName: string;
  token: CheckInToken | null;
  locationLabel?: string;
  distanceLabel?: string;
  verificationBlockedMessage?: string | null;
  onIssueToken: () => void | Promise<void>;
  onUpload: (input: { visibility: Visibility; caption: string; mediaItems?: Array<{ mediaDataUrl: string; mediaFileName?: string }> }) => void | Promise<void>;
  onOpenPlace?: (placeName: string) => void;
  onOpenMap?: () => void;
  onNotice?: (message: string) => void;
};

type PickedMedia = {
  previewUri: string;
  dataUrl: string;
  fileName: string;
  mimeType?: string;
};

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Photo could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function webFileToMedia(file: File): Promise<PickedMedia> {
  const rawDataUrl = await readBlobAsDataUrl(file);

  if (file.type.startsWith('video/')) {
    return {
      previewUri: rawDataUrl,
      dataUrl: rawDataUrl,
      fileName: file.name || 'memory-video.mp4',
      mimeType: file.type,
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = document.createElement('img');
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Photo could not be loaded.'));
    nextImage.src = rawDataUrl;
  });
  const maxEdge = 1800;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return {
      previewUri: rawDataUrl,
      dataUrl: rawDataUrl,
      fileName: file.name || 'memory.jpg',
    };
  }

  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

  return {
    previewUri: dataUrl,
    dataUrl,
    fileName: file.name?.replace(/\.[^.]+$/, '.jpg') || 'memory.jpg',
    mimeType: 'image/jpeg',
  };
}

function pickWebImages(useCamera: boolean) {
  return new Promise<PickedMedia[]>((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = useCamera ? 'image/*' : 'image/*,video/*';
    input.multiple = !useCamera;
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, 6);
      if (!files.length) {
        cleanup();
        resolve([]);
        return;
      }

      Promise.all(files.map(webFileToMedia))
        .then(resolve)
        .catch(reject)
        .finally(cleanup);
    };

    input.click();
  });
}

async function imagePickerAssetToMedia(asset: ImagePicker.ImagePickerAsset): Promise<PickedMedia | null> {
  if (asset.base64) {
    const mimeType = asset.mimeType ?? 'image/jpeg';
    return {
      previewUri: asset.uri,
      dataUrl: `data:${mimeType};base64,${asset.base64}`,
      fileName: asset.fileName ?? 'memory.jpg',
      mimeType,
    };
  }

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const dataUrl = await readBlobAsDataUrl(blob);
    return {
      previewUri: asset.uri,
      dataUrl,
      fileName: asset.fileName ?? 'memory.jpg',
      mimeType: asset.mimeType,
    };
  }

  return null;
}

export function CaptureScreen({ placeName, displayPlaceName, token, locationLabel, distanceLabel, verificationBlockedMessage, onIssueToken, onUpload, onOpenPlace, onOpenMap, onNotice }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const viewportHeight = useVisualViewportHeight();
  const viewfinderHeight = Math.max(260, Math.min(360, viewportHeight - 500));
  const [visibility, setVisibility] = useState<Visibility>('PublicAfter1h');
  const [caption, setCaption] = useState(t('capture.defaultCaption'));
  const [mediaItems, setMediaItems] = useState<PickedMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [working, setWorking] = useState(false);
  const activeToken = placeName && token?.placeName === placeName ? token : null;
  const activeMedia = mediaItems[Math.min(activeMediaIndex, Math.max(0, mediaItems.length - 1))];
  const canPost = Boolean(activeToken && mediaItems.length);
  const canVerify = Boolean(placeName && !verificationBlockedMessage);

  const handlePress = (action: () => void | Promise<void>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Promise.resolve(action()).catch((error) => {
      onNotice?.(error instanceof Error ? error.message : t('capture.photoFailed'));
    });
  };

  const applyPickedMedia = (media: PickedMedia[] | PickedMedia | null) => {
    const nextMedia = Array.isArray(media) ? media : media ? [media] : [];

    if (!nextMedia.length) {
      return;
    }

    setMediaItems((current) => {
      const merged = [...current, ...nextMedia].slice(0, 6);
      setActiveMediaIndex(merged.length - 1);
      return merged;
    });
    onNotice?.(t('capture.photoReady'));
  };

  const capturePhoto = async () => {
    if (Platform.OS === 'web') {
      applyPickedMedia(await pickWebImages(true));
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      onNotice?.(t('permissions.cameraDenied'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      base64: true,
      quality: 0.76,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    applyPickedMedia(await imagePickerAssetToMedia(result.assets[0]));
  };

  const pickMedia = async () => {
    if (Platform.OS === 'web') {
      applyPickedMedia(await pickWebImages(false));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      onNotice?.(t('permissions.photosDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 6,
      base64: true,
      quality: 0.76,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const pickedMedia = await Promise.all(result.assets.slice(0, 6).map(imagePickerAssetToMedia));
    applyPickedMedia(pickedMedia.filter((item): item is PickedMedia => Boolean(item)));
  };

  const removeMedia = () => {
    setMediaItems((current) => {
      const next = current.filter((_item, index) => index !== activeMediaIndex);
      setActiveMediaIndex(Math.max(0, Math.min(activeMediaIndex, next.length - 1)));
      return next;
    });
  };

  const clearMedia = () => {
    setMediaItems([]);
    setActiveMediaIndex(0);
  };

  const submitUpload = async () => {
    if (!placeName) {
      onNotice?.(locationLabel ?? t('app.noUploadablePlace'));
      onOpenMap?.();
      return;
    }

    if (!activeToken) {
      if (verificationBlockedMessage) {
        onNotice?.(verificationBlockedMessage);
        return;
      }
      await onIssueToken();
      return;
    }

    if (!mediaItems.length) {
      onNotice?.(t('capture.photoRequired'));
      await capturePhoto();
      return;
    }

    if (working) {
      return;
    }

    setWorking(true);
    try {
      await onUpload({
        visibility,
        caption: caption.trim() || t('capture.defaultCaption'),
        mediaItems: mediaItems.map((item) => ({
          mediaDataUrl: item.dataUrl,
          mediaFileName: item.fileName,
        })),
      });
      clearMedia();
    } finally {
      setWorking(false);
    }
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#F8F7FF', '#FFF2F5']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            paddingBottom: Math.max(insets.bottom + 126, 126),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable disabled={!placeName} onPress={() => placeName && onOpenPlace?.(placeName)}>
            <Text style={styles.kicker}>{t('capture.kicker')}</Text>
            <Text style={styles.title}>{displayPlaceName}</Text>
          </Pressable>
          <View style={styles.radiusPill}>
            <MapPin color={colors.setlogInk} size={15} strokeWidth={2.8} />
            <Text style={styles.radiusText}>{distanceLabel ?? t('capture.distanceUnknown')}</Text>
          </View>
        </View>

        <Pressable style={[styles.viewfinder, { height: viewfinderHeight }]} onPress={() => handlePress(capturePhoto)}>
          <LinearGradient colors={['rgba(255, 183, 200, 0.24)', 'rgba(189, 168, 255, 0.16)', 'rgba(135, 240, 182, 0.2)']} style={StyleSheet.absoluteFill} />
          {activeMedia ? <MediaRenderer uri={activeMedia.previewUri} resizeMode="cover" style={styles.previewImage} /> : null}
          <View style={styles.frameMarkTop} />
          <View style={styles.frameMarkBottom} />
          {!activeMedia ? (
            <>
              <Camera color={colors.setlogInk} size={54} strokeWidth={1.8} />
              <Text style={styles.viewfinderPlace}>{t('capture.takePhoto')}</Text>
            </>
          ) : (
            <View style={styles.readyBadge}>
              <Check color={colors.setlogInk} size={17} strokeWidth={2.7} />
              <Text style={styles.readyBadgeText}>{t('capture.selected')} · {activeMediaIndex + 1}/{mediaItems.length}</Text>
            </View>
          )}
        </Pressable>

        {mediaItems.length > 1 ? (
          <View style={styles.mediaDots}>
            {mediaItems.map((item, index) => (
              <Pressable
                key={`${item.fileName}-${index}`}
                style={[styles.mediaDot, activeMediaIndex === index && styles.mediaDotActive]}
                onPress={() => setActiveMediaIndex(index)}
              />
            ))}
          </View>
        ) : null}

        {activeMedia ? (
          <View style={styles.mediaActions}>
            <Pressable style={styles.mediaActionButton} onPress={() => handlePress(capturePhoto)}>
              <RotateCcw color={colors.setlogInk} size={16} strokeWidth={2.5} />
              <Text style={styles.mediaActionText}>{t('capture.retake')}</Text>
            </Pressable>
            <Pressable style={styles.mediaActionButton} onPress={removeMedia}>
              <Trash2 color={colors.setlogInk} size={16} strokeWidth={2.5} />
              <Text style={styles.mediaActionText}>{t('capture.removePhoto')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.tokenPanel}>
          <View style={styles.tokenIcon}>
            <ShieldCheck color={activeToken ? colors.setlogMint : canVerify ? colors.setlogMuted : colors.setlogPink} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.tokenCopy}>
            <Text style={styles.tokenTitle}>{activeToken ? t('capture.tokenActive') : canVerify ? t('capture.tokenRequired') : t('capture.noPlaceTitle')}</Text>
            <Text style={styles.tokenMeta}>
              {activeToken
                ? t('capture.tokenMeta', { expires: activeToken.expiresInLabel, uploads: activeToken.uploadsRemaining })
                : locationLabel ?? t('capture.tokenDefault')}
            </Text>
          </View>
          <Clock color={canVerify ? colors.setlogMuted : colors.setlogPink} size={21} />
        </View>

        {!canVerify ? (
          <Pressable style={styles.mapSelectButton} onPress={onOpenMap}>
            <MapPin color={colors.setlogInk} size={17} strokeWidth={2.6} />
            <Text style={styles.mapSelectText}>{t('capture.selectPlaceOnMap')}</Text>
          </Pressable>
        ) : null}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t('capture.caption')}
          placeholderTextColor={colors.setlogFaint}
          style={styles.captionInput}
        />

        <View style={styles.visibilityRow}>
          {(['Followers', 'PublicAfter1h', 'Public'] as const).map((item) => (
            <Pressable key={item} style={[styles.visibilityPill, visibility === item && styles.visibilityPillActive]} onPress={() => setVisibility(item)}>
              <Text style={[styles.visibilityText, visibility === item && styles.visibilityTextActive]}>{translateVisibility(item, t)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.sideButton} onPress={() => handlePress(capturePhoto)}>
            <Camera color={colors.setlogInk} size={24} strokeWidth={2.4} />
          </Pressable>
          <Pressable style={[styles.postActionButton, canPost && styles.postActionButtonReady, !canVerify && styles.postActionButtonBlocked, working && styles.disabledButton]} disabled={working} onPress={() => handlePress(submitUpload)}>
            <Text style={[styles.postActionText, canPost && styles.postActionTextReady]}>{!canVerify ? t('capture.selectPlaceOnMap') : !activeToken ? t('capture.verifyPlace') : canPost ? t('capture.postMemory') : t('capture.addPhoto')}</Text>
          </Pressable>
          <Pressable style={styles.sideButton} onPress={() => handlePress(pickMedia)}>
            <ImagePlus color={colors.setlogInk} size={25} strokeWidth={2.4} />
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  kicker: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    marginTop: 4,
    maxWidth: 250,
  },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.setlogYellow,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  radiusText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  viewfinder: {
    minHeight: 300,
    borderRadius: 30,
    borderColor: colors.setlogLine,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.setlogPaper,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.86,
  },
  frameMarkTop: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(23, 18, 15, 0.18)',
  },
  frameMarkBottom: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(23, 18, 15, 0.18)',
  },
  viewfinderPlace: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  readyBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    minHeight: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 254, 248, 0.9)',
  },
  readyBadgeText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  mediaDots: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  mediaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(23, 18, 15, 0.18)',
  },
  mediaDotActive: {
    width: 18,
    backgroundColor: colors.setlogInk,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  mediaActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.setlogPaper,
  },
  mediaActionText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  tokenPanel: {
    minHeight: 72,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    marginTop: 14,
  },
  tokenIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(135, 240, 182, 0.2)',
    marginRight: 11,
  },
  tokenCopy: {
    flex: 1,
  },
  tokenTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  tokenMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  mapSelectButton: {
    minHeight: 42,
    borderRadius: 18,
    borderColor: colors.setlogPink,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 183, 200, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  mapSelectText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  controls: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
  },
  captionInput: {
    minHeight: 46,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 12,
    marginTop: 10,
    backgroundColor: colors.setlogPaper,
  },
  visibilityPill: {
    flex: 1,
    height: 42,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
  },
  visibilityPillActive: {
    borderColor: colors.setlogMint,
    backgroundColor: 'rgba(135, 240, 182, 0.28)',
  },
  visibilityText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  visibilityTextActive: {
    color: colors.setlogInk,
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
  },
  postActionButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogPink,
    borderWidth: 2,
  },
  postActionButtonReady: {
    backgroundColor: colors.setlogMint,
    borderColor: colors.setlogMint,
  },
  postActionButtonBlocked: {
    borderColor: colors.setlogLine,
  },
  disabledButton: {
    opacity: 0.58,
  },
  postActionText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  postActionTextReady: {
    color: colors.setlogInk,
  },
  modeText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
});
