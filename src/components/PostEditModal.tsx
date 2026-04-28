import { Clock, Globe, Lock } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';
import type { Visibility } from '../types/happened';
import { useI18n } from '../i18n';

type Props = {
  caption: string;
  visibility: Visibility;
  onCaptionChange: (text: string) => void;
  onVisibilityChange: (v: Visibility) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function PostEditModal({ caption, visibility, onCaptionChange, onVisibilityChange, onCancel, onSave }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.editBox}>
      <TextInput
        value={caption}
        onChangeText={onCaptionChange}
        multiline
        style={styles.editInput}
        placeholder={t('home.editCaption')}
        placeholderTextColor={colors.setlogFaint}
      />
      <View style={styles.editVisRow}>
        {([
          { key: 'Followers' as Visibility, Icon: Lock },
          { key: 'PublicAfter1h' as Visibility, Icon: Clock },
          { key: 'Public' as Visibility, Icon: Globe },
        ]).map(({ key, Icon }) => (
          <Pressable
            key={key}
            style={[styles.visChip, visibility === key && styles.visChipActive]}
            onPress={() => onVisibilityChange(key)}
          >
            <Icon
              color={visibility === key ? colors.setlogPaper : colors.setlogMuted}
              size={11}
              strokeWidth={2.4}
            />
            <Text style={[styles.visChipText, visibility === key && styles.visChipTextActive]}>
              {t(`visibility.${key}.label`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.editActions}>
        <Pressable style={styles.editCancelBtn} onPress={onCancel}>
          <Text style={styles.editCancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable style={styles.editSaveBtn} onPress={onSave}>
          <Text style={styles.editSaveText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  editInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.setlogInk,
    minHeight: 60,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  editVisRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogBg,
  },
  visChipActive: {
    backgroundColor: colors.setlogInk,
    borderColor: colors.setlogInk,
  },
  visChipText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    color: colors.setlogMuted,
  },
  visChipTextActive: {
    color: colors.setlogPaper,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  editCancelText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.setlogMuted,
  },
  editSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.setlogInk,
  },
  editSaveText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.setlogPaper,
  },
});
