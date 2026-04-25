import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Lock, MapPin, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { timelineMonths } from '../data/happened';
import { type LanguageCode, useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';
import type { TimelineMonth } from '../types/happened';

type Props = {
  months?: TimelineMonth[];
  onOpenPlace?: (placeName: string) => void;
};

type LocalizedTimelineMonth = TimelineMonth & { displayPlaceName?: string };

const timelineKo: Record<string, { title: string; placeName?: string; items: Record<string, { title: string; meta: string }> }> = {
  '2026-04': {
    title: '2026년 4월',
    placeName: '선릉역 카페',
    items: {
      a1: { title: '점심 뒤 현장 인증', meta: '200m 안에서 열림' },
      a2: { title: '창가 자리 메모', meta: '팔로워 공개' },
    },
  },
  '2025-11': {
    title: '2025년 11월',
    placeName: '홍대 골목 스테이지',
    items: {
      b1: { title: '비 온 뒤 거리 공연', meta: '다시 방문하면 열림' },
      b2: { title: 'Mina가 댓글을 남김', meta: '1.3km 거리' },
    },
  },
  '2023-04': {
    title: '2023년 4월',
    placeName: '선릉역 카페',
    items: {
      c1: { title: '같은 구석 테이블', meta: '오늘 다시 열림' },
    },
  },
};

function localizeMonth(month: TimelineMonth, language: LanguageCode): LocalizedTimelineMonth {
  if (language !== 'ko') {
    return month;
  }

  const localized = timelineKo[month.id];

  if (!localized) {
    return month;
  }

  return {
    ...month,
    title: localized.title,
    displayPlaceName: localized.placeName ?? month.placeName,
    items: month.items.map((item) => ({
      ...item,
      title: localized.items[item.id]?.title ?? item.title,
      meta: localized.items[item.id]?.meta ?? item.meta,
    })),
  };
}

export function TimelineScreen({ months = timelineMonths, onOpenPlace }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const localizedMonths = months.map((month) => localizeMonth(month, language));

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{t('timeline.kicker')}</Text>
          <Text style={styles.title}>{t('timeline.title')}</Text>
        </View>

        <Pressable style={styles.recallCard} onPress={() => onOpenPlace?.('Seolleung Station Cafe')}>
          <View style={styles.recallIcon}>
            <Sparkles color={colors.setlogInk} size={22} strokeWidth={2.8} />
          </View>
          <View style={styles.recallCopy}>
            <Text style={styles.recallTitle}>{t('timeline.recallTitle')}</Text>
            <Text style={styles.recallMeta}>{t('timeline.recallMeta')}</Text>
          </View>
        </Pressable>

        <View style={styles.monthList}>
          {localizedMonths.map((month) => (
            <Pressable key={month.id} style={styles.monthBlock} onPress={() => onOpenPlace?.(month.placeName)}>
              <View style={styles.monthHeader}>
                <CalendarDays color={colors.setlogLavender} size={18} />
                <Text style={styles.monthTitle}>{month.title}</Text>
              </View>
              <View style={styles.placeLine}>
                <MapPin color={colors.setlogMuted} size={14} />
                <Text style={styles.placeText}>{month.displayPlaceName ?? month.placeName}</Text>
              </View>
              {month.items.map((item) => (
                <View key={item.id} style={styles.memoryRow}>
                  <View style={[styles.memoryDot, { backgroundColor: item.unlocked ? colors.setlogMint : colors.setlogPink }]} />
                  <View style={styles.memoryCopy}>
                    <Text style={styles.memoryTitle}>{item.title}</Text>
                    <Text style={styles.memoryMeta}>{item.meta}</Text>
                  </View>
                  {item.unlocked ? <Text style={styles.openText}>{t('common.open')}</Text> : <Lock color={colors.setlogMuted} size={17} />}
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
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  recallCard: {
    minHeight: 96,
    borderRadius: 24,
    borderColor: colors.setlogMint,
    borderWidth: 1,
    backgroundColor: 'rgba(135, 240, 182, 0.22)',
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
    backgroundColor: colors.setlogMint,
    marginRight: 12,
  },
  recallCopy: {
    flex: 1,
  },
  recallTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  recallMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  monthList: {
    gap: 13,
  },
  monthBlock: {
    borderRadius: 24,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    color: colors.setlogInk,
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
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  memoryRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: colors.setlogLine,
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
});
