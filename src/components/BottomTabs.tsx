import { BlurView } from 'expo-blur';
import { Camera, Clock3, Home, Map, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';
import type { TabKey } from '../types/happened';

type TabItem = {
  key: TabKey;
  label: string;
  Icon: typeof Home;
};

const tabs: TabItem[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'map', label: 'Map', Icon: Map },
  { key: 'capture', label: 'Capture', Icon: Camera },
  { key: 'timeline', label: 'Timeline', Icon: Clock3 },
  { key: 'profile', label: 'Profile', Icon: UserRound },
];

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export function BottomTabs({ activeTab, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView intensity={38} tint="dark" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.inner}>
        {tabs.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          const isCapture = key === 'capture';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={key}
              onPress={() => onChange(key)}
              style={[styles.tab, isCapture && styles.captureTab, active && styles.activeTab]}
            >
              <Icon color={active ? colors.ink : colors.text} size={isCapture ? 25 : 21} strokeWidth={active ? 2.6 : 2} />
              {!isCapture ? <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  inner: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(5, 7, 13, 0.62)',
  },
  tab: {
    width: 62,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.panel,
  },
  activeTab: {
    backgroundColor: 'rgba(199, 249, 91, 0.92)',
  },
  captureTab: {
    width: 54,
    height: 54,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.text,
    borderColor: 'rgba(57, 217, 242, 0.86)',
    borderWidth: 2,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  activeLabel: {
    color: colors.ink,
  },
});
