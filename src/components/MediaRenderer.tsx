import { createElement } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts } from '../theme/tokens';

type Props = {
  uri?: string;
  resizeMode?: 'cover' | 'contain';
  style?: StyleProp<ImageStyle>;
};

export function isVideoUrl(uri?: string) {
  return Boolean(uri && (/^data:video\//i.test(uri) || /\.(mp4|mov|m4v|webm)(?:\?|#|$)/i.test(uri)));
}

export function MediaRenderer({ uri, resizeMode = 'cover', style }: Props) {
  if (!uri) {
    return null;
  }

  if (!isVideoUrl(uri)) {
    return <Image source={{ uri }} resizeMode={resizeMode} style={style} />;
  }

  if (Platform.OS === 'web') {
    return createElement('video', {
      src: uri,
      controls: true,
      muted: true,
      playsInline: true,
      preload: 'metadata',
      style: {
        ...StyleSheet.flatten(style),
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: resizeMode,
      },
    });
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
