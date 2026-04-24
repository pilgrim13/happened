import { LinearGradient } from 'expo-linear-gradient';
import { Camera, MapPin, Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onCreateAccount: () => void;
  onSkipToApp: () => void;
};

export function WelcomeScreen({ onCreateAccount, onSkipToApp }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#05070D', '#12110D', '#091916']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <View>
          <Text style={styles.brand}>Happened</Text>
          <Text style={styles.kicker}>Location-locked memories</Text>
        </View>

        <View style={styles.heroFrame}>
          <View style={styles.filmRail}>
            {Array.from({ length: 9 }).map((_, index) => (
              <View key={index} style={styles.filmHole} />
            ))}
          </View>
          <LinearGradient colors={['#2B2118', '#355D63', '#1A0F0A']} style={styles.heroImage}>
            <View style={styles.paperLabel}>
              <Text style={styles.paperText}>APR 2023 / ISO 400</Text>
            </View>
            <Sparkles color={colors.paper} size={32} />
            <Text style={styles.heroTitle}>여기서 남긴 순간은 여기서 다시 열린다</Text>
          </LinearGradient>
        </View>

        <View style={styles.principles}>
          <Principle icon={<MapPin color={colors.lime} size={19} />} text="장소 근처에서만 완전 열람" />
          <Principle icon={<Camera color={colors.cyan} size={19} />} text="현장 체크인 후 12시간 업로드" />
          <Principle icon={<Sparkles color={colors.coral} size={19} />} text="다시 방문하면 예전 기억 회상" />
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={onCreateAccount}>
            <Text style={styles.primaryText}>Start with mock account</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onSkipToApp}>
            <Text style={styles.secondaryText}>Explore prototype</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

function Principle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.principle}>
      <View style={styles.principleIcon}>{icon}</View>
      <Text style={styles.principleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 42,
    fontWeight: '900',
  },
  kicker: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  heroFrame: {
    minHeight: 340,
    borderRadius: radius.panel,
    borderColor: 'rgba(231, 216, 185, 0.34)',
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.negative,
  },
  filmRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 34,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(26, 15, 10, 0.84)',
    zIndex: 2,
  },
  filmHole: {
    width: 12,
    height: 26,
    borderRadius: 4,
    backgroundColor: colors.paper,
    opacity: 0.76,
  },
  heroImage: {
    flex: 1,
    marginLeft: 34,
    padding: 22,
    justifyContent: 'flex-end',
    gap: 14,
  },
  paperLabel: {
    position: 'absolute',
    top: 22,
    right: 20,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.paper,
    transform: [{ rotate: '1deg' }],
  },
  paperText: {
    color: colors.negative,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  principles: {
    gap: 10,
  },
  principle: {
    minHeight: 54,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  principleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 247, 242, 0.08)',
    marginRight: 10,
  },
  principleText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    height: 56,
    borderRadius: radius.panel,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
  primaryText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radius.panel,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.line,
    borderWidth: 1,
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
});
