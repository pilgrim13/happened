import { Camera, Clock3, Home, Map, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n';
import { colors, fonts } from '../theme/tokens';
import type { TabKey } from '../types/happened';

type TabItem = {
  key: TabKey;
  labelKey: 'tabs.home' | 'tabs.map' | 'tabs.capture' | 'tabs.timeline' | 'tabs.profile';
  Icon: typeof Home;
};

const tabs: TabItem[] = [
  { key: 'home', labelKey: 'tabs.home', Icon: Home },
  { key: 'map', labelKey: 'tabs.map', Icon: Map },
  { key: 'capture', labelKey: 'tabs.capture', Icon: Camera },
  { key: 'timeline', labelKey: 'tabs.timeline', Icon: Clock3 },
  { key: 'profile', labelKey: 'tabs.profile', Icon: UserRound },
];

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export function BottomTabs({ activeTab, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View testID="bottom-tabs" style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={styles.inner}>
        {tabs.map(({ key, labelKey, Icon }) => {
          const active = activeTab === key;
          const isCapture = key === 'capture';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={key}
              onPress={() => onChange(key)}
              style={[styles.tab, active && styles.activeTab, isCapture && styles.captureTab, isCapture && active && styles.captureTabActive]}
            >
              <Icon color={colors.setlogInk} size={isCapture ? 24 : 21} strokeWidth={active ? 2.7 : 2.1} />
              <Text numberOfLines={1} style={[styles.label, active && styles.activeLabel]}>{t(labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: colors.setlogPaper,
    borderTopColor: colors.setlogLine,
    borderTopWidth: 1,
    overflow: 'hidden',
    zIndex: 20,
  },
  inner: {
    width: '100%',
    maxWidth: 560,
    minHeight: 62,
    paddingHorizontal: 0,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.setlogPaper,
  },
  tab: {
    width: '20%',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderTopColor: 'transparent',
    borderTopWidth: 3,
  },
  activeTab: {
    borderTopColor: colors.setlogInk,
    backgroundColor: 'rgba(23, 18, 15, 0.04)',
  },
  captureTab: {
    borderLeftColor: colors.setlogLine,
    borderLeftWidth: 1,
    borderRightColor: colors.setlogLine,
    borderRightWidth: 1,
    backgroundColor: 'rgba(255, 183, 200, 0.12)',
  },
  captureTabActive: {
    borderTopColor: colors.setlogPink,
    backgroundColor: 'rgba(255, 183, 200, 0.22)',
  },
  label: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  activeLabel: {
    color: colors.setlogInk,
    fontWeight: '900',
  },
});
