import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Lock, MapPin, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { timelineMonths } from '../data/happened';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onOpenPlace?: (placeName: string) => void;
};

export function TimelineScreen({ onOpenPlace }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#05070D', '#0A1215', '#111017']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Place timeline</Text>
          <Text style={styles.title}>Stories accumulate by month</Text>
        </View>

        <Pressable style={styles.recallCard} onPress={() => onOpenPlace?.('Seolleung Station Cafe')}>
          <View style={styles.recallIcon}>
            <Sparkles color={colors.ink} size={22} strokeWidth={2.8} />
          </View>
          <View style={styles.recallCopy}>
            <Text style={styles.recallTitle}>3 years ago at Seolleung Station Cafe</Text>
            <Text style={styles.recallMeta}>Reopened because you are back within 200m.</Text>
          </View>
        </Pressable>

        <View style={styles.monthList}>
          {timelineMonths.map((month) => (
            <Pressable key={month.id} style={styles.monthBlock} onPress={() => onOpenPlace?.(month.placeName)}>
              <View style={styles.monthHeader}>
                <CalendarDays color={colors.cyan} size={18} />
                <Text style={styles.monthTitle}>{month.title}</Text>
              </View>
              <View style={styles.placeLine}>
                <MapPin color={colors.muted} size={14} />
                <Text style={styles.placeText}>{month.placeName}</Text>
              </View>
              {month.items.map((item) => (
                <View key={item.id} style={styles.memoryRow}>
                  <View style={[styles.memoryDot, { backgroundColor: item.unlocked ? colors.lime : colors.coral }]} />
                  <View style={styles.memoryCopy}>
                    <Text style={styles.memoryTitle}>{item.title}</Text>
                    <Text style={styles.memoryMeta}>{item.meta}</Text>
                  </View>
                  {item.unlocked ? <Text style={styles.openText}>Open</Text> : <Lock color={colors.muted} size={17} />}
                </View>
              ))}
            </Pressable>
          ))}
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
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  header: {
    marginBottom: 16,
  },
  kicker: {
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  recallCard: {
    minHeight: 96,
    borderRadius: radius.panel,
    borderColor: 'rgba(199, 249, 91, 0.28)',
    borderWidth: 1,
    backgroundColor: 'rgba(199, 249, 91, 0.1)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recallIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    marginRight: 12,
  },
  recallCopy: {
    flex: 1,
  },
  recallTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  recallMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  monthList: {
    gap: 13,
  },
  monthBlock: {
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    padding: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '900',
  },
  placeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  placeText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  memoryRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
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
});
