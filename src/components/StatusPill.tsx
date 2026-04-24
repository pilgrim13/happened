import { LinearGradient } from 'expo-linear-gradient';
import { Lock, MapPin, RadioTower } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gradients, radius } from '../theme/tokens';
import type { UnlockState } from '../types/happened';

type Props = {
  state: UnlockState;
  distanceMeters: number;
  radiusMeters: number;
};

function distanceLabel(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)}km`;
  }
  return `${distanceMeters}m`;
}

export function StatusPill({ state, distanceMeters, radiusMeters }: Props) {
  const open = state === 'open';
  const nearby = state === 'nearby';
  const Icon = open ? MapPin : nearby ? RadioTower : Lock;
  const label = open ? 'Open here' : nearby ? 'Almost here' : 'Locked by place';
  const gradient = open ? gradients.unlocked : gradients.locked;

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shell}>
      <View style={styles.inner}>
        <Icon color={colors.ink} size={15} strokeWidth={2.8} />
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.meta}>
          {distanceLabel(distanceMeters)} / {radiusMeters}m
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    padding: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  meta: {
    color: 'rgba(5, 7, 13, 0.72)',
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
});
