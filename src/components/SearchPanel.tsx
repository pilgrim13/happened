import { MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { localizePlaceName, useI18n } from '../i18n';
import type { SearchResults } from '../types/happened';

type Props = {
  searching: boolean;
  remoteSearch: SearchResults | null;
  onOpenProfile?: (handle: string) => void;
  onOpenPlace?: (placeName: string) => void;
};

export function SearchPanel({ searching, remoteSearch, onOpenProfile, onOpenPlace }: Props) {
  const { language, t } = useI18n();

  return (
    <View style={styles.searchPanel}>
      {searching ? <Text style={styles.panelMeta}>{t('home.searching')}</Text> : null}
      {remoteSearch?.users.length ? (
        <View style={styles.resultGroup}>
          <Text style={styles.resultLabel}>{t('common.people')}</Text>
          {remoteSearch.users.slice(0, 4).map((user) => (
            <Pressable key={user.id} style={styles.resultRow} onPress={() => onOpenProfile?.(user.handle)}>
              <View style={styles.resultAvatar}>
                <Text style={styles.resultAvatarText}>{user.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.resultCopy}>
                <Text numberOfLines={1} style={styles.resultTitle}>{user.displayName}</Text>
                <Text numberOfLines={1} style={styles.resultMeta}>@{user.handle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {remoteSearch?.places.length ? (
        <View style={styles.resultGroup}>
          <Text style={styles.resultLabel}>{t('common.places')}</Text>
          {remoteSearch.places.slice(0, 4).map((place) => (
            <Pressable key={place.id} style={styles.resultRow} onPress={() => onOpenPlace?.(place.placeName ?? place.name)}>
              <View style={styles.resultIcon}>
                <MapPin color={colors.setlogInk} size={17} strokeWidth={2.5} />
              </View>
              <View style={styles.resultCopy}>
                <Text numberOfLines={1} style={styles.resultTitle}>{localizePlaceName(place.placeName ?? place.name, language)}</Text>
                <Text numberOfLines={1} style={styles.resultMeta}>{place.city ?? place.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {remoteSearch && !remoteSearch.users.length && !remoteSearch.places.length && !remoteSearch.posts.length && !searching ? (
        <Text style={styles.panelMeta}>{t('home.noSearch')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanel: {
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 12,
    gap: 10,
    marginTop: 10,
  },
  panelMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  resultGroup: {
    gap: 7,
  },
  resultLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: colors.setlogYellow,
  },
  resultAvatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '900',
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#E9F9EF',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  resultMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
