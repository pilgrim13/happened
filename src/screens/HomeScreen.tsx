import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, Eye, Flag, Heart, MessageCircle, MoreVertical, UsersRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusPill } from '../components/StatusPill';
import { feedModes, memoryPosts } from '../data/happened';
import { colors, fonts, radius } from '../theme/tokens';
import type { FeedMode, MemoryPost } from '../types/happened';

type HomeScreenProps = {
  initialIndex?: number;
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onPostAction?: (message: string) => void;
};

export function HomeScreen({ initialIndex = 0, onOpenPlace, onCaptureAtPlace, onPostAction }: HomeScreenProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const requestedPost = memoryPosts[Math.max(0, Math.min(initialIndex, memoryPosts.length - 1))];
  const [selectedMode, setSelectedMode] = useState<FeedMode>(requestedPost?.mode ?? 'Following');
  const visiblePosts = memoryPosts.filter((post) => post.mode === selectedMode);
  const requestedIndex = visiblePosts.findIndex((post) => post.id === requestedPost?.id);
  const safeInitialIndex = Math.max(0, requestedIndex);

  return (
    <View style={styles.screen}>
      <FlatList
        key={selectedMode}
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        initialScrollIndex={safeInitialIndex}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FeedItem
            item={item}
            height={height}
            topInset={insets.top}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            onOpenPlace={onOpenPlace}
            onCaptureAtPlace={onCaptureAtPlace}
            onPostAction={onPostAction}
          />
        )}
      />
    </View>
  );
}

function FeedItem({
  item,
  height,
  topInset,
  selectedMode,
  onModeChange,
  onOpenPlace,
  onCaptureAtPlace,
  onPostAction,
}: {
  item: MemoryPost;
  height: number;
  topInset: number;
  selectedMode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  onOpenPlace?: (placeName: string) => void;
  onCaptureAtPlace?: (placeName: string) => void;
  onPostAction?: (message: string) => void;
}) {
  const locked = item.unlockState === 'locked';
  const placeTitle = formatPlaceTitle(item.placeName);

  return (
    <View style={[styles.feedItem, { height }]}>
      <LinearGradient colors={item.mediaColors} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(231, 216, 185, 0.18)', 'rgba(5, 7, 13, 0)', 'rgba(242, 169, 59, 0.12)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.lightBand, { backgroundColor: item.accentColor }]} />
      <View style={styles.paperMatte} />
      <View style={styles.mediaGrain}>
        <View style={[styles.mediaBlock, styles.mediaBlockA]} />
        <View style={[styles.mediaBlock, styles.mediaBlockB]} />
        <View style={[styles.mediaBlock, styles.mediaBlockC]} />
        <View style={styles.contactSheet}>
          <View style={styles.contactThumb} />
          <View style={[styles.contactThumb, styles.contactThumbDim]} />
          <View style={styles.contactThumb} />
        </View>
      </View>
      <FilmFrame stamp={item.filmStamp} placeName={item.placeName} />
      <LinearGradient colors={['rgba(5, 7, 13, 0.1)', 'rgba(5, 7, 13, 0.18)', 'rgba(5, 7, 13, 0.86)']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255, 111, 97, 0.22)', 'rgba(255, 111, 97, 0)']} style={styles.lightLeak} />

      {locked ? (
        <BlurView intensity={48} tint="dark" style={styles.lockedLayer}>
          <View style={styles.lockedFrame}>
            <Eye color={colors.text} size={22} strokeWidth={2.4} />
            <Text style={styles.lockedTitle}>Preview only</Text>
            <Text style={styles.lockedText}>Return to {item.placeName} to develop the full frame.</Text>
          </View>
        </BlurView>
      ) : null}

      <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
        <Text style={styles.brand}>Happened</Text>
        <View style={styles.modeRow}>
          {feedModes.map((mode) => (
            <Pressable key={mode} style={[styles.modePill, mode === selectedMode && styles.modePillActive]} onPress={() => onModeChange(mode)}>
              <Text style={[styles.modeText, mode === selectedMode && styles.modeTextActive]}>{mode}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actionRail}>
        <RailButton icon={<Heart color={colors.text} size={22} />} label={item.stats.echoes} onPress={() => onPostAction?.('Echo saved')} />
        <RailButton icon={<MessageCircle color={colors.text} size={22} />} label={item.stats.replies} onPress={() => onPostAction?.('Reply composer is ready')} />
        <RailButton icon={<Bookmark color={colors.text} size={22} />} label={item.stats.saves} onPress={() => onPostAction?.('Saved to your roll')} />
        <RailButton icon={<Flag color={colors.faint} size={20} />} label="Hide" muted onPress={() => onPostAction?.('Post hidden from this feed')} />
        <MoreVertical color={colors.muted} size={22} />
      </View>

      <View style={styles.story}>
        {item.recallLabel ? <Text style={styles.recall}>{item.recallLabel}</Text> : null}
        <Pressable style={styles.placeButton} onPress={() => onOpenPlace?.(item.placeName)}>
          <StatusPill state={item.unlockState} distanceMeters={item.distanceMeters} radiusMeters={item.unlockRadiusMeters} />
          <View style={styles.paperLabel}>
            <Text style={styles.paperLabelText}>{item.filmStamp}</Text>
          </View>
          <Text style={styles.place}>{placeTitle}</Text>
          <View style={styles.placeMetaRow}>
            <Text style={styles.placeMeta}>{item.city}</Text>
            <View style={styles.dot} />
            <Text style={styles.placeMeta}>{item.visibility}</Text>
            <View style={styles.dot} />
            <Text style={styles.placeMeta}>{item.timeLabel}</Text>
          </View>
        </Pressable>
        <Text style={styles.caption}>{item.caption}</Text>
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { borderColor: item.accentColor }]}>
            <Text style={styles.avatarText}>{item.authorName.slice(0, 1)}</Text>
          </View>
          <View>
            <Text style={styles.author}>{item.authorName}</Text>
            <Text style={styles.handle}>{item.authorHandle}</Text>
          </View>
          <Pressable style={styles.followPill} onPress={() => onCaptureAtPlace?.(item.placeName)}>
            <UsersRound color={colors.ink} size={14} strokeWidth={2.8} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function formatPlaceTitle(placeName: string) {
  const words = placeName.split(' ');

  if (words.length <= 2) {
    return placeName;
  }

  return `${words.slice(0, -1).join(' ')}\n${words.at(-1)}`;
}

function FilmFrame({ stamp, placeName }: { stamp: string; placeName: string }) {
  const holes = Array.from({ length: 13 }, (_, index) => index);

  return (
    <View pointerEvents="none" style={styles.filmOverlay}>
      <View style={styles.negativeFrame} />
      <View style={styles.filmStripLeft}>
        {holes.map((hole) => (
          <View key={`left-${hole}`} style={styles.filmHole} />
        ))}
      </View>
      <View style={styles.filmStripRight}>
        {holes.map((hole) => (
          <View key={`right-${hole}`} style={styles.filmHole} />
        ))}
      </View>
      <View style={styles.filmTopStamp}>
        <Text style={styles.filmText}>HAPPENED 400</Text>
        <Text style={styles.filmText}>{stamp}</Text>
      </View>
      <View style={styles.filmBottomStamp}>
        <Text style={styles.filmText}>PLACE ROLL</Text>
        <Text style={styles.filmText}>{placeName.toUpperCase().slice(0, 24)}</Text>
      </View>
      <View style={styles.dateBurn}>
        <Text style={styles.dateBurnText}>{stamp.split('/')[0].trim()}</Text>
      </View>
    </View>
  );
}

function RailButton({ icon, label, muted = false, onPress }: { icon: ReactNode; label: string | number; muted?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.railButton} onPress={onPress}>
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
    width: 92,
    height: '120%',
    right: 32,
    top: -40,
    opacity: 0.18,
    transform: [{ rotate: '15deg' }],
  },
  paperMatte: {
    position: 'absolute',
    left: 29,
    right: 29,
    top: 112,
    bottom: 154,
    borderColor: 'rgba(231, 216, 185, 0.42)',
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(231, 216, 185, 0.045)',
  },
  mediaGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  lightLeak: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 170,
    height: 360,
    opacity: 0.75,
  },
  filmOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  negativeFrame: {
    position: 'absolute',
    left: 23,
    right: 23,
    top: 104,
    bottom: 145,
    borderColor: 'rgba(26, 15, 10, 0.82)',
    borderWidth: 8,
    borderRadius: 10,
  },
  filmStripLeft: {
    position: 'absolute',
    left: 5,
    top: 96,
    bottom: 136,
    width: 22,
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.88,
    backgroundColor: 'rgba(26, 15, 10, 0.5)',
    borderRadius: 4,
    paddingVertical: 9,
  },
  filmStripRight: {
    position: 'absolute',
    right: 5,
    top: 96,
    bottom: 136,
    width: 22,
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.62,
    backgroundColor: 'rgba(26, 15, 10, 0.36)',
    borderRadius: 4,
    paddingVertical: 9,
  },
  filmHole: {
    width: 11,
    height: 22,
    borderRadius: 3,
    backgroundColor: 'rgba(231, 216, 185, 0.78)',
    borderColor: 'rgba(5, 7, 13, 0.3)',
    borderWidth: 1,
  },
  filmTopStamp: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 109,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.72,
  },
  filmBottomStamp: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 154,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.64,
  },
  filmText: {
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  dateBurn: {
    position: 'absolute',
    right: 38,
    top: 186,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(26, 15, 10, 0.58)',
    borderColor: 'rgba(242, 169, 59, 0.34)',
    borderWidth: 1,
  },
  dateBurnText: {
    color: colors.amber,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  mediaBlock: {
    position: 'absolute',
    borderColor: 'rgba(231, 216, 185, 0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(231, 216, 185, 0.11)',
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
  contactSheet: {
    position: 'absolute',
    left: 45,
    right: 45,
    top: 123,
    height: 52,
    flexDirection: 'row',
    gap: 8,
    opacity: 0.42,
  },
  contactThumb: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 15, 10, 0.58)',
    borderColor: 'rgba(231, 216, 185, 0.36)',
    borderWidth: 1,
  },
  contactThumbDim: {
    opacity: 0.56,
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
    borderColor: 'rgba(231, 216, 185, 0.48)',
    borderWidth: 2,
    padding: 18,
    backgroundColor: 'rgba(26, 15, 10, 0.58)',
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
  placeButton: {
    alignItems: 'flex-start',
    gap: 9,
  },
  recall: {
    alignSelf: 'flex-start',
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  paperLabel: {
    alignSelf: 'flex-start',
    borderRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(231, 216, 185, 0.92)',
    transform: [{ rotate: '-1deg' }],
  },
  paperLabelText: {
    color: colors.negative,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  place: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 37,
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
    borderRadius: radius.pill,
    width: 38,
    height: 32,
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
});
