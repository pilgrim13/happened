import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Camera, Check, Images, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onComplete: () => void;
};

const permissionItems = [
  { id: 'location', title: 'Location', copy: '체크인과 잠금 해제를 검증한다.', Icon: MapPin },
  { id: 'camera', title: 'Camera', copy: '현장에서 바로 기억을 남긴다.', Icon: Camera },
  { id: 'photos', title: 'Photos', copy: '체크인 후 12시간 안에 업로드한다.', Icon: Images },
  { id: 'notifications', title: 'Notifications', copy: '재방문 회상을 알려준다.', Icon: Bell },
] as const;

export function PermissionsScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const allGranted = permissionItems.every((item) => granted[item.id]);

  return (
    <LinearGradient colors={['#05070D', '#0C1116', '#091916']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View>
          <Text style={styles.kicker}>Permissions</Text>
          <Text style={styles.title}>장소에서 열리는 기억을 위해</Text>
          <Text style={styles.copy}>실제 OS 권한 요청은 연결 전이다. 지금은 권한 UX와 거부/허용 상태를 테스트한다.</Text>
        </View>

        <View style={styles.list}>
          {permissionItems.map(({ id, title, copy, Icon }) => {
            const active = granted[id];
            return (
              <Pressable key={id} style={[styles.permissionRow, active && styles.permissionRowActive]} onPress={() => setGranted((current) => ({ ...current, [id]: !current[id] }))}>
                <View style={[styles.permissionIcon, active && styles.permissionIconActive]}>
                  {active ? <Check color={colors.ink} size={19} strokeWidth={3} /> : <Icon color={colors.text} size={19} />}
                </View>
                <View style={styles.permissionCopy}>
                  <Text style={styles.permissionTitle}>{title}</Text>
                  <Text style={styles.permissionMeta}>{copy}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.primaryButton, allGranted && styles.primaryButtonReady]} onPress={onComplete}>
          <Text style={styles.primaryText}>{allGranted ? 'Enter Happened' : 'Skip permission setup'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  kicker: {
    color: colors.cyan,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 8,
  },
  copy: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  list: {
    gap: 11,
    marginTop: 30,
  },
  permissionRow: {
    minHeight: 80,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  permissionRowActive: {
    borderColor: 'rgba(199, 249, 91, 0.38)',
    backgroundColor: 'rgba(199, 249, 91, 0.1)',
  },
  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 247, 242, 0.08)',
    marginRight: 12,
  },
  permissionIconActive: {
    backgroundColor: colors.lime,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  permissionMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  primaryButton: {
    height: 56,
    borderRadius: radius.panel,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    marginTop: 'auto',
  },
  primaryButtonReady: {
    backgroundColor: colors.lime,
  },
  primaryText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
});
