import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, Eye, Flag, Heart, MessageCircle, MoreVertical, UsersRound } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusPill } from '../components/StatusPill';
import { feedModes, memoryPosts } from '../data/happened';
import { colors, fonts, radius } from '../theme/tokens';
import type { FeedMode, MemoryPost } from '../types/happened';

const selectedMode: FeedMode = 'Following';

export function HomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <FlatList
        data={memoryPosts}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <FeedItem item={item} height={height} topInset={insets.top} />}
      />
    </View>
  );
}

function FeedItem({ item, height, topInset }: { item: MemoryPost; height: number; topInset: number }) {
  const locked = item.unlockState === 'locked';

  return (
    <View style={[styles.feedItem, { height }]}>
      <LinearGradient colors={item.mediaColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.lightBand, { backgroundColor: item.accentColor }]} />
      <View style={styles.mediaGrain}>
        <View style={[styles.mediaBlock, styles.mediaBlockA]} />
        <View style={[styles.mediaBlock, styles.mediaBlockB]} />
        <View style={[styles.mediaBlock, styles.mediaBlockC]} />
      </View>
      <LinearGradient colors={['rgba(5, 7, 13, 0.1)', 'rgba(5, 7, 13, 0.18)', 'rgba(5, 7, 13, 0.86)']} style={StyleSheet.absoluteFill} />

      {locked ? (
        <BlurView intensity={48} tint="dark" style={styles.lockedLayer}>
          <View style={styles.lockedFrame}>
            <Eye color={colors.text} size={22} strokeWidth={2.4} />
            <Text style={styles.lockedTitle}>Preview only</Text>
            <Text style={styles.lockedText}>Return to {item.placeName} to open the full memory.</Text>
          </View>
        </BlurView>
      ) : null}

      <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
        <Text style={styles.brand}>Happened</Text>
        <View style={styles.modeRow}>
          {feedModes.map((mode) => (
            <View key={mode} style={[styles.modePill, mode === selectedMode && styles.modePillActive]}>
              <Text style={[styles.modeText, mode === selectedMode && styles.modeTextActive]}>{mode}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionRail}>
        <RailButton icon={<Heart color={colors.text} size={22} />} label={item.stats.echoes} />
        <RailButton icon={<MessageCircle color={colors.text} size={22} />} label={item.stats.replies} />
        <RailButton icon={<Bookmark color={colors.text} size={22} />} label={item.stats.saves} />
        <RailButton icon={<Flag color={colors.faint} size={20} />} label="Hide" muted />
        <MoreVertical color={colors.muted} size={22} />
      </View>

      <View style={styles.story}>
        {item.recallLabel ? <Text style={styles.recall}>{item.recallLabel}</Text> : null}
        <StatusPill state={item.unlockState} distanceMeters={item.distanceMeters} radiusMeters={item.unlockRadiusMeters} />
        <Text style={styles.place}>{item.placeName}</Text>
        <View style={styles.placeMetaRow}>
          <Text style={styles.placeMeta}>{item.city}</Text>
          <View style={styles.dot} />
          <Text style={styles.placeMeta}>{item.visibility}</Text>
          <View style={styles.dot} />
          <Text style={styles.placeMeta}>{item.timeLabel}</Text>
        </View>
        <Text style={styles.caption}>{item.caption}</Text>
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { borderColor: item.accentColor }]}>
            <Text style={styles.avatarText}>{item.authorName.slice(0, 1)}</Text>
          </View>
          <View>
            <Text style={styles.author}>{item.authorName}</Text>
            <Text style={styles.handle}>{item.authorHandle}</Text>
          </View>
          <View style={styles.followPill}>
            <UsersRound color={colors.ink} size={14} strokeWidth={2.8} />
            <Text style={styles.followText}>Following</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function RailButton({ icon, label, muted = false }: { icon: React.ReactNode; label: string | number; muted?: boolean }) {
  return (
    <Pressable style={styles.railButton}>
      <View style={[styles.railIcon, muted && styles.railIconMuted]}>{icon}</View>
      <Text style={[styles.railLabel, muted && styles.railLabelMuted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  feedItem: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  lightBand: {
    position: 'absolute',
    width: 110,
    height: '120%',
    right: 32,
    top: -40,
    opacity: 0.14,
    transform: [{ rotate: '15deg' }],
  },
  mediaGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  mediaBlock: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mediaBlockA: {
    width: 220,
    height: 280,
    left: 24,
    top: 150,
    borderRadius: radius.panel,
    transform: [{ rotate: '-7deg' }],
  },
  mediaBlockB: {
    width: 170,
    height: 230,
    right: 26,
    top: 250,
    borderRadius: radius.panel,
    transform: [{ rotate: '6deg' }],
  },
  mediaBlockC: {
    width: 280,
    height: 180,
    left: 70,
    bottom: 210,
    borderRadius: radius.panel,
    transform: [{ rotate: '2deg' }],
  },
  lockedLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  lockedFrame: {
    width: '100%',
    maxWidth: 330,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 18,
    backgroundColor: 'rgba(5, 7, 13, 0.46)',
    alignItems: 'center',
    gap: 7,
  },
  lockedTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '900',
  },
  lockedText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    gap: 14,
  },
  brand: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modePill: {
    borderRadius: radius.pill,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(5, 7, 13, 0.28)',
  },
  modePillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  modeText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  modeTextActive: {
    color: colors.ink,
  },
  actionRail: {
    position: 'absolute',
    right: 13,
    bottom: 155,
    alignItems: 'center',
    gap: 14,
  },
  railButton: {
    alignItems: 'center',
    gap: 5,
  },
  railIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 13, 0.48)',
    borderColor: colors.line,
    borderWidth: 1,
  },
  railIconMuted: {
    backgroundColor: 'rgba(5, 7, 13, 0.24)',
  },
  railLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  railLabelMuted: {
    color: colors.faint,
  },
  story: {
    position: 'absolute',
    left: 16,
    right: 72,
    bottom: 104,
    gap: 9,
  },
  recall: {
    alignSelf: 'flex-start',
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  place: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  placeMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.faint,
  },
  caption: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 13, 0.62)',
  },
  avatarText: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '900',
  },
  author: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  handle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  followPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.lime,
  },
  followText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
});
