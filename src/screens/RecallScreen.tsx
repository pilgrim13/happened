import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenState } from '../components/ScreenState';
import { fetchRecallFeed, dismissRecallEvent, type RecallFeedItem } from '../services/happenedApi';
import { useSession } from '../contexts/SessionContext';
import { colors, fonts } from '../theme/tokens';

type Props = {
  onBack: () => void;
  onOpenPost?: (postId: string) => void;
};

function formatAnniversaryLabel(scheduledFor: string) {
  const date = new Date(scheduledFor);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - year;

  if (yearsAgo <= 0) {
    return `${month}월 ${day}일`;
  }
  if (yearsAgo === 1) {
    return `작년 오늘`;
  }
  return `${yearsAgo}년 전 오늘`;
}

export function RecallScreen({ onBack, onOpenPost }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [items, setItems] = useState<RecallFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchRecallFeed(session?.token);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleDismiss = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await dismissRecallEvent(id, session?.token);
    } catch {
      // 조용히 실패 처리
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <X color={colors.setlogInk} size={22} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.title}>회상</Text>
        </View>
        <ScreenState variant="loading" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <X color={colors.setlogInk} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.title}>회상</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          error ? (
            <ScreenState variant="error" message={error} action={{ label: '다시 시도', onPress: () => { setLoading(true); void load(); } }} />
          ) : (
            <ScreenState
              variant="empty"
              title="회상이 없어요"
              message="작년 오늘 찍은 사진이 있으면 여기 나타나요"
            />
          )
        }
        renderItem={({ item }) => (
          <RecallCard
            item={item}
            onDismiss={() => void handleDismiss(item.id)}
            onOpenPost={item.sourcePostId ? () => onOpenPost?.(item.sourcePostId!) : undefined}
          />
        )}
      />
    </View>
  );
}

function RecallCard({
  item,
  onDismiss,
  onOpenPost,
}: {
  item: RecallFeedItem;
  onDismiss: () => void;
  onOpenPost?: () => void;
}) {
  const label = formatAnniversaryLabel(item.scheduledFor);
  const placeName = item.placeName ?? '그 장소';

  return (
    <View style={styles.card}>
      <View style={styles.cardMedia}>
        {item.mediaUrl ? (
          <Image source={{ uri: item.mediaUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#E8E4FF', '#FFE4F0']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.48)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
          <X color={colors.setlogPaper} size={16} strokeWidth={2.8} />
        </Pressable>
        <View style={styles.cardOverlay}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={styles.cardPlace}>{placeName}</Text>
        </View>
      </View>

      {onOpenPost ? (
        <Pressable style={styles.revisitButton} onPress={onOpenPost}>
          <Text style={styles.revisitText}>다시 가보기</Text>
          <ArrowRight color={colors.setlogInk} size={16} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.revisitButton}>
          <Text style={[styles.revisitText, { color: colors.setlogMuted }]}>추억이에요</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.setlogBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '900',
  },
  list: {
    paddingHorizontal: 14,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  cardMedia: {
    aspectRatio: 1.4,
    backgroundColor: '#F3EDE3',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  cardOverlay: {
    position: 'absolute',
    left: 14,
    bottom: 14,
  },
  cardLabel: {
    color: 'rgba(255,254,248,0.8)',
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  cardPlace: {
    color: colors.setlogPaper,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '900',
  },
  revisitButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  revisitText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
});
