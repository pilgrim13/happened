import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Circle, Clock, ImagePlus, MapPin, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';

export function CaptureScreen() {
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  return (
    <LinearGradient colors={['#05070D', '#101018', '#091A19']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 18 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Capture here</Text>
            <Text style={styles.title}>Seolleung Station Cafe</Text>
          </View>
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
            <ShieldCheck color={colors.lime} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.tokenCopy}>
            <Text style={styles.tokenTitle}>Check-in token ready</Text>
            <Text style={styles.tokenMeta}>120m upload radius, 12h later upload window</Text>
          </View>
          <Clock color={colors.muted} size={21} />
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.sideButton} onPress={handlePress}>
            <ImagePlus color={colors.text} size={25} />
          </Pressable>
          <Pressable style={styles.shutter} onPress={handlePress}>
            <Circle color={colors.ink} size={62} fill={colors.text} />
          </Pressable>
          <Pressable style={styles.sideButton} onPress={handlePress}>
            <Text style={styles.modeText}>12h</Text>
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
    height: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
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
