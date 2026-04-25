import { LinearGradient } from 'expo-linear-gradient';
import { Camera, MapPin, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { seedMediaUrls } from '../data/happened';
import { useI18n } from '../i18n';
import { colors, fonts } from '../theme/tokens';

type Props = {
  onComplete: () => void;
};

const slides = [
  {
    id: 'places',
    image: seedMediaUrls['seolleung-cafe-2023'],
    Icon: MapPin,
    titleKey: 'tutorial.placesTitle',
    textKey: 'tutorial.placesText',
  },
  {
    id: 'capture',
    image: seedMediaUrls['river-steps-dawn'],
    Icon: Camera,
    titleKey: 'tutorial.captureTitle',
    textKey: 'tutorial.captureText',
  },
  {
    id: 'friends',
    image: seedMediaUrls['hongdae-alley-night'],
    Icon: Users,
    titleKey: 'tutorial.friendsTitle',
    textKey: 'tutorial.friendsText',
  },
] as const;

export function TutorialScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = slide.Icon;
  const isLast = index === slides.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
      return;
    }

    setIndex((current) => current + 1);
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{t('tutorial.kicker')}</Text>
          <Pressable style={styles.skipButton} onPress={onComplete}>
            <Text style={styles.skipText}>{t('tutorial.skip')}</Text>
          </Pressable>
        </View>

        <View style={styles.imageFrame}>
          <Image source={{ uri: slide.image }} resizeMode="cover" style={styles.image} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.54)']} style={StyleSheet.absoluteFill} />
          <View style={styles.imageBadge}>
            <Icon color={colors.setlogInk} size={20} strokeWidth={2.5} />
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{t(slide.titleKey)}</Text>
          <Text style={styles.copy}>{t(slide.textKey)}</Text>
        </View>

        <View style={styles.dots}>
          {slides.map((item, dotIndex) => (
            <View key={item.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={styles.nextText}>{isLast ? t('tutorial.start') : t('common.continue')}</Text>
        </Pressable>
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
  },
  header: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  skipButton: {
    minHeight: 34,
    borderRadius: 17,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.setlogPaper,
  },
  skipText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  imageFrame: {
    flex: 1,
    minHeight: 330,
    maxHeight: 470,
    borderRadius: 26,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: colors.setlogPaper,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogMint,
  },
  copyBlock: {
    minHeight: 138,
    justifyContent: 'center',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
  },
  copy: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 9,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.setlogLine,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.setlogInk,
  },
  nextButton: {
    height: 54,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
  },
  nextText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
});
