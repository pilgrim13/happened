import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Camera, CalendarDays, Lock, MapPin, RadioTower } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memoryPosts, timelineMonths } from '../data/happened';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  placeName: string;
  onBack: () => void;
  onCapture: () => void;
};

export function PlaceDetailScreen({ placeName, onBack, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const placePosts = memoryPosts.filter((post) => post.placeName === placeName);
  const relatedMonths = timelineMonths.filter((month) => month.placeName === placeName);
  const openCount = placePosts.filter((post) => post.unlockState === 'open').length;
  const lockedCount = Math.max(0, placePosts.length - openCount);

  return (
    <LinearGradient colors={['#05070D', '#12110D', '#091916']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={onBack}>
            <ArrowLeft color={colors.text} size={21} />
          </Pressable>
          <Pressable style={styles.captureButton} onPress={onCapture}>
            <Camera color={colors.ink} size={17} />
            <Text style={styles.captureText}>Capture here</Text>
          </Pressable>
        </View>

        <View style={styles.cover}>
          <LinearGradient colors={['#2B2118', '#355D63', '#1A0F0A']} style={StyleSheet.absoluteFill} />
          <View style={styles.filmRail}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={styles.filmHole} />
            ))}
          </View>
          <View style={styles.paperLabel}>
            <Text style={styles.paperText}>PLACE ROLL / 200M</Text>
          </View>
          <View style={styles.coverCopy}>
            <View style={styles.statusRow}>
              <MapPin color={colors.lime} size={16} />
              <Text style={styles.statusText}>{openCount} open · {lockedCount} locked</Text>
            </View>
            <Text style={styles.title}>{placeName}</Text>
            <Text style={styles.subtitle}>Stories develop here when you return.</Text>
          </View>
        </View>

        <View style={styles.ruleCard}>
          <View style={styles.ruleIcon}>
            <RadioTower color={colors.lime} size={22} />
          </View>
          <View style={styles.ruleCopy}>
            <Text style={styles.ruleTitle}>Unlock rule</Text>
            <Text style={styles.ruleMeta}>Full memories open within 200m. Uploads require a verified 120m check-in token.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Monthly timeline</Text>
        {relatedMonths.length ? (
          <View style={styles.monthList}>
            {relatedMonths.map((month) => (
              <View key={month.id} style={styles.monthBlock}>
                <View style={styles.monthHeader}>
                  <CalendarDays color={colors.cyan} size={18} />
                  <Text style={styles.monthTitle}>{month.title}</Text>
                </View>
                {month.items.map((item) => (
                  <View key={item.id} style={styles.memoryRow}>
                    <View style={[styles.memoryDot, { backgroundColor: item.unlocked ? colors.lime : colors.coral }]} />
                    <View style={styles.memoryCopy}>
                      <Text style={styles.memoryTitle}>{item.title}</Text>
                      <Text style={styles.memoryMeta}>{item.meta}</Text>
                    </View>
                    {item.unlocked ? <Text style={styles.openText}>Open</Text> : <Lock color={colors.muted} size={16} />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No monthly roll yet</Text>
            <Text style={styles.emptyMeta}>Capture at this place to start the first story strip.</Text>
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
    backgroundColor: 'rgba(245, 247, 242, 0.08)',
    borderColor: colors.line,
    borderWidth: 1,
  },
  captureButton: {
    height: 42,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  captureText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  cover: {
    height: 330,
    borderRadius: radius.panel,
    overflow: 'hidden',
    borderColor: 'rgba(231, 216, 185, 0.34)',
    borderWidth: 2,
    marginBottom: 14,
  },
  filmRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: 'rgba(26, 15, 10, 0.82)',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  filmHole: {
    width: 11,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.paper,
    opacity: 0.78,
  },
  paperLabel: {
    position: 'absolute',
    top: 18,
    right: 16,
    borderRadius: 3,
    backgroundColor: colors.paper,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  paperText: {
    color: colors.negative,
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
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  ruleCard: {
    minHeight: 84,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
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
    backgroundColor: 'rgba(199, 249, 91, 0.12)',
    marginRight: 12,
  },
  ruleCopy: {
    flex: 1,
  },
  ruleTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  ruleMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  sectionLabel: {
    color: colors.lime,
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
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    padding: 13,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  monthTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  memoryRow: {
    minHeight: 54,
    borderTopColor: colors.line,
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
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  memoryMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  openText: {
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    padding: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
