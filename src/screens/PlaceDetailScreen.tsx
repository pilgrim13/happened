import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Camera, CalendarDays, Lock, MapPin, RadioTower } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memoryPosts, timelineMonths } from '../data/happened';
import { localizePlaceName, useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';
import type { MemoryPost, TimelineMonth } from '../types/happened';

type Props = {
  placeName: string;
  posts?: MemoryPost[];
  months?: TimelineMonth[];
  onBack: () => void;
  onCapture: () => void;
};

export function PlaceDetailScreen({ placeName, posts = memoryPosts, months = timelineMonths, onBack, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const placePosts = posts.filter((post) => post.placeName === placeName);
  const relatedMonths = months.filter((month) => month.placeName === placeName);
  const openCount = placePosts.filter((post) => post.unlockState === 'open').length;
  const lockedCount = Math.max(0, placePosts.length - openCount);
  const displayPlaceName = localizePlaceName(placeName, language);

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={onBack}>
            <ArrowLeft color={colors.setlogInk} size={21} />
          </Pressable>
          <Pressable style={styles.captureButton} onPress={onCapture}>
            <Camera color={colors.setlogInk} size={17} />
            <Text style={styles.captureText}>{t('place.captureHere')}</Text>
          </Pressable>
        </View>

        <View style={styles.cover}>
          <LinearGradient colors={['#FFE893', '#FFB7C8', '#B9D8FF']} style={StyleSheet.absoluteFill} />
          <View style={styles.filmRail}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={styles.filmHole} />
            ))}
          </View>
          <View style={styles.paperLabel}>
            <Text style={styles.paperText}>{t('place.roll')}</Text>
          </View>
          <View style={styles.coverCopy}>
            <View style={styles.statusRow}>
              <MapPin color={colors.setlogInk} size={16} />
              <Text style={styles.statusText}>{t('place.status', { open: openCount, locked: lockedCount })}</Text>
            </View>
            <Text style={styles.title}>{displayPlaceName}</Text>
            <Text style={styles.subtitle}>{t('place.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.ruleCard}>
          <View style={styles.ruleIcon}>
            <RadioTower color={colors.setlogMint} size={22} />
          </View>
          <View style={styles.ruleCopy}>
            <Text style={styles.ruleTitle}>{t('place.unlockRule')}</Text>
            <Text style={styles.ruleMeta}>{t('place.unlockMeta')}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('place.monthly')}</Text>
        {relatedMonths.length ? (
          <View style={styles.monthList}>
            {relatedMonths.map((month) => (
              <View key={month.id} style={styles.monthBlock}>
                <View style={styles.monthHeader}>
                  <CalendarDays color={colors.setlogLavender} size={18} />
                  <Text style={styles.monthTitle}>{month.title}</Text>
                </View>
                {month.items.map((item) => (
                  <View key={item.id} style={styles.memoryRow}>
                    <View style={[styles.memoryDot, { backgroundColor: item.unlocked ? colors.setlogMint : colors.setlogPink }]} />
                    <View style={styles.memoryCopy}>
                      <Text style={styles.memoryTitle}>{item.title}</Text>
                      <Text style={styles.memoryMeta}>{item.meta}</Text>
                    </View>
                    {item.unlocked ? <Text style={styles.openText}>{t('common.open')}</Text> : <Lock color={colors.setlogMuted} size={16} />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('place.noRoll')}</Text>
            <Text style={styles.emptyMeta}>{t('place.noRollMeta')}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  captureButton: {
    height: 42,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    backgroundColor: colors.setlogMint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  captureText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  cover: {
    height: 330,
    borderRadius: 28,
    overflow: 'hidden',
    borderColor: colors.setlogLine,
    borderWidth: 2,
    marginBottom: 14,
  },
  filmRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: 'rgba(255, 254, 248, 0.62)',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  filmHole: {
    width: 11,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.setlogBg,
    opacity: 0.78,
  },
  paperLabel: {
    position: 'absolute',
    top: 18,
    right: 16,
    borderRadius: 3,
    backgroundColor: colors.setlogPaper,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  paperText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  coverCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
    paddingLeft: 46,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statusText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  ruleCard: {
    minHeight: 84,
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 18,
  },
  ruleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(135, 240, 182, 0.22)',
    marginRight: 12,
  },
  ruleCopy: {
    flex: 1,
  },
  ruleTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  ruleMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  sectionLabel: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  monthList: {
    gap: 12,
  },
  monthBlock: {
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 13,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  monthTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  memoryRow: {
    minHeight: 54,
    borderTopColor: colors.setlogLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
  },
  memoryCopy: {
    flex: 1,
  },
  memoryTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  memoryMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  openText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 16,
  },
  emptyTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
