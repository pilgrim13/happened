import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Circle, Clock, ImagePlus, MapPin, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';
import type { CheckInToken, Visibility } from '../types/happened';

type Props = {
  placeName: string;
  token: CheckInToken | null;
  onIssueToken: () => void;
  onUpload: () => void;
  onOpenPlace?: (placeName: string) => void;
};

export function CaptureScreen({ placeName, token, onIssueToken, onUpload, onOpenPlace }: Props) {
  const insets = useSafeAreaInsets();
  const [visibility, setVisibility] = useState<Visibility>('Followers');
  const activeToken = token?.placeName === placeName ? token : null;

  const handlePress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    action();
  };

  return (
    <LinearGradient colors={['#05070D', '#101018', '#091A19']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 18 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => onOpenPlace?.(placeName)}>
            <Text style={styles.kicker}>Capture here</Text>
            <Text style={styles.title}>{placeName}</Text>
          </Pressable>
          <View style={styles.radiusPill}>
            <MapPin color={colors.ink} size={15} strokeWidth={2.8} />
            <Text style={styles.radiusText}>84m</Text>
          </View>
        </View>

        <View style={styles.viewfinder}>
          <LinearGradient colors={['rgba(57, 217, 242, 0.28)', 'rgba(199, 249, 91, 0.12)', 'rgba(255, 111, 97, 0.16)']} style={StyleSheet.absoluteFill} />
          <View style={styles.frameMarkTop} />
          <View style={styles.frameMarkBottom} />
          <Camera color={colors.text} size={54} strokeWidth={1.8} />
          <Text style={styles.viewfinderPlace}>Verified place capture</Text>
        </View>

        <View style={styles.tokenPanel}>
          <View style={styles.tokenIcon}>
            <ShieldCheck color={activeToken ? colors.lime : colors.muted} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.tokenCopy}>
            <Text style={styles.tokenTitle}>{activeToken ? 'Check-in token active' : 'Check-in required'}</Text>
            <Text style={styles.tokenMeta}>
              {activeToken
                ? `${activeToken.expiresInLabel} left · ${activeToken.uploadsRemaining} mock uploads remaining`
                : 'Issue a 12h token inside 120m before uploading.'}
            </Text>
          </View>
          <Clock color={colors.muted} size={21} />
        </View>

        <View style={styles.visibilityRow}>
          {(['Followers', 'Public'] as const).map((item) => (
            <Pressable key={item} style={[styles.visibilityPill, visibility === item && styles.visibilityPillActive]} onPress={() => setVisibility(item)}>
              <Text style={[styles.visibilityText, visibility === item && styles.visibilityTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.sideButton} onPress={() => handlePress(activeToken ? onUpload : onIssueToken)}>
            <ImagePlus color={colors.text} size={25} />
          </Pressable>
          <Pressable style={styles.shutter} onPress={() => handlePress(activeToken ? onUpload : onIssueToken)}>
            <Circle color={colors.ink} size={62} fill={colors.text} />
          </Pressable>
          <Pressable style={styles.sideButton} onPress={() => handlePress(onIssueToken)}>
            <Text style={styles.modeText}>{activeToken ? 'Re' : '12h'}</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 126,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  kicker: {
    color: colors.cyan,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
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
    backgroundColor: colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  radiusText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  viewfinder: {
    flex: 1,
    minHeight: 420,
    borderRadius: radius.panel,
    borderColor: 'rgba(245, 247, 242, 0.18)',
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#071017',
  },
  frameMarkTop: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(245, 247, 242, 0.26)',
  },
  frameMarkBottom: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(245, 247, 242, 0.26)',
  },
  viewfinderPlace: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  tokenPanel: {
    minHeight: 72,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
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
    backgroundColor: 'rgba(199, 249, 91, 0.12)',
    marginRight: 11,
  },
  tokenCopy: {
    flex: 1,
  },
  tokenTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  tokenMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  controls: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
  },
  visibilityPill: {
    flex: 1,
    height: 42,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 247, 242, 0.06)',
  },
  visibilityPillActive: {
    borderColor: 'rgba(199, 249, 91, 0.42)',
    backgroundColor: 'rgba(199, 249, 91, 0.15)',
  },
  visibilityText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  visibilityTextActive: {
    color: colors.text,
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: 'rgba(245, 247, 242, 0.08)',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.coral,
    borderWidth: 3,
  },
  modeText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
});
