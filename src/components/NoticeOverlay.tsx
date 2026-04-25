import { StyleSheet, Text, View } from 'react-native';

import { useNotice } from '../contexts/NoticeContext';
import { colors, fonts } from '../theme/tokens';

export function NoticeOverlay() {
  const { notice } = useNotice();
  if (!notice) return null;
  return (
    <View pointerEvents="none" style={styles.notice}>
      <Text style={styles.noticeText}>{notice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 54,
    minHeight: 44,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 254, 248, 0.94)',
    zIndex: 30,
  },
  noticeText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});
