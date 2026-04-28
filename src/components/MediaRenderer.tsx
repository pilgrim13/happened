import { createElement } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle, ViewProps } from 'react-native';

import { colors, fonts } from '../theme/tokens';

type Props = {
  uri?: string;
  resizeMode?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
};

export function isVideoUrl(uri?: string) {
  return Boolean(uri && (/^data:video\//i.test(uri) || /\.(mp4|mov|m4v|webm)(?:\?|#|$)/i.test(uri)));
}

export function MediaRenderer({ uri, resizeMode = 'cover', style }: Props) {
  if (!uri) {
    return null;
  }

  if (!isVideoUrl(uri)) {
    // web에서 touchAction: 'pan-y' 으로 수직 스크롤 통과 (이미지가 터치 스크롤 가로채는 문제 방지)
    const webScrollStyle: ViewProps['style'] = Platform.OS === 'web'
      ? { touchAction: 'pan-y' } as any
      : undefined;
    return (
      <View style={[style, webScrollStyle]} pointerEvents="none">
        <Image source={{ uri }} resizeMode={resizeMode} style={StyleSheet.absoluteFillObject} />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    // Wrap video in a View that allows vertical touch to pass through to parent ScrollView,
    // while video controls still work via tap.
    return (
      <View style={[style, { touchAction: 'pan-y' } as any]}>
        {createElement('video', {
          src: uri,
          controls: true,
          muted: true,
          playsInline: true,
          preload: 'metadata',
          style: {
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: resizeMode,
            touchAction: 'pan-y',
          },
        })}
      </View>
    );
  }

  return (
    <View style={[style as StyleProp<ViewStyle>, styles.unsupportedVideo]}>
      <Text style={styles.unsupportedVideoText}>Video preview is available on web.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupportedVideo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
  },
  unsupportedVideoText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
});
