import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Camera, Check, Images, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePushRegistration } from '../hooks/usePushRegistration';
import { useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onComplete: () => void;
};

const permissionItems = [
  { id: 'location', titleKey: 'permissions.location', copyKey: 'permissions.locationCopy', Icon: MapPin },
  { id: 'camera', titleKey: 'permissions.camera', copyKey: 'permissions.cameraCopy', Icon: Camera },
  { id: 'photos', titleKey: 'permissions.photos', copyKey: 'permissions.photosCopy', Icon: Images },
  { id: 'notifications', titleKey: 'permissions.notifications', copyKey: 'permissions.notificationsCopy', Icon: Bell },
] as const;

type PermissionId = (typeof permissionItems)[number]['id'];

export function PermissionsScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { register: registerPush, isRegistered: pushRegistered } = usePushRegistration();
  const [granted, setGranted] = useState<Record<PermissionId, boolean>>({
    location: false,
    camera: false,
    photos: false,
    notifications: false,
  });
  const [notes, setNotes] = useState<Partial<Record<PermissionId, string>>>({});

  const setPermissionState = (id: PermissionId, enabled: boolean, note?: string) => {
    setGranted((current) => ({ ...current, [id]: enabled }));
    setNotes((current) => ({ ...current, [id]: note }));
  };

  const requestPermission = async (id: PermissionId) => {
    try {
      if (id === 'location') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          setPermissionState(id, true);
          return;
        }

        setPermissionState(id, false, t('permissions.locationDenied'));
        return;
      }

      if (id === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        setPermissionState(id, permission.granted, permission.granted ? undefined : t('permissions.cameraDenied'));
        return;
      }

      if (id === 'photos') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        setPermissionState(id, permission.granted, permission.granted ? undefined : t('permissions.photosDenied'));
        return;
      }

      if (id === 'notifications') {
        if (Platform.OS === 'web') {
          setPermissionState(id, false, t('permissions.notificationsWeb'));
          return;
        }
        const registered = await registerPush();
        setPermissionState(id, registered, registered ? undefined : t('permissions.notificationsDenied'));
        return;
      }
    } catch {
      setPermissionState(id, false, t('permissions.requestFailed'));
      return;
    }

    setPermissionState(id, !granted[id]);
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.kicker}>{t('permissions.kicker')}</Text>
          <Text style={styles.title}>{t('permissions.title')}</Text>
          <Text style={styles.copy}>{t('permissions.copy')}</Text>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationTopRow}>
            <View style={[styles.permissionIcon, granted.location && styles.permissionIconActive]}>
              {granted.location ? <Check color={colors.setlogInk} size={20} strokeWidth={3} /> : <MapPin color={colors.setlogInk} size={20} />}
            </View>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>{t('permissions.locationBenefitTitle')}</Text>
              <Text style={styles.permissionMeta}>{notes.location ?? t('permissions.locationBenefitText')}</Text>
            </View>
          </View>
          <Pressable style={[styles.locationButton, granted.location && styles.locationButtonDone]} onPress={() => requestPermission('location')}>
            <Text style={styles.locationButtonText}>{granted.location ? t('permissions.allowed') : notes.location ? t('permissions.retry') : t('permissions.primaryLocation')}</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {permissionItems.filter((item) => item.id !== 'location').map(({ id, titleKey, copyKey, Icon }) => (
            <Pressable
              key={id}
              style={[styles.permissionRow, (granted[id] || (id === 'notifications' && pushRegistered)) && styles.permissionRowActive]}
              onPress={() => requestPermission(id)}
            >
              <View style={[styles.permissionIcon, (granted[id] || (id === 'notifications' && pushRegistered)) && styles.permissionIconActive]}>
                {(granted[id] || (id === 'notifications' && pushRegistered)) ? (
                  <Check color={colors.setlogInk} size={19} strokeWidth={3} />
                ) : (
                  <Icon color={colors.setlogInk} size={19} />
                )}
              </View>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>{t(titleKey)}</Text>
                <Text style={styles.permissionMeta}>{notes[id] ?? t(copyKey)}</Text>
              </View>
              {!(granted[id] || (id === 'notifications' && pushRegistered)) ? (
                <View style={styles.laterPill}>
                  <Text style={styles.laterText}>{t('permissions.later')}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.primaryButton} onPress={onComplete}>
          <Text style={styles.primaryText}>{granted.location ? t('common.continue') : t('permissions.secondarySkip')}</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  kicker: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 8,
  },
  copy: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  list: {
    gap: 11,
    marginTop: 14,
  },
  locationCard: {
    borderRadius: 22,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 14,
    marginTop: 28,
  },
  locationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationButton: {
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
    marginTop: 14,
  },
  locationButtonDone: {
    backgroundColor: colors.setlogMint,
  },
  locationButtonText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  permissionRow: {
    minHeight: 74,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  permissionRowActive: {
    borderColor: colors.setlogMint,
    backgroundColor: 'rgba(135, 240, 182, 0.22)',
  },
  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 183, 200, 0.22)',
    marginRight: 12,
  },
  permissionIconActive: {
    backgroundColor: colors.setlogMint,
  },
  permissionCopy: {
    flex: 1,
    minWidth: 0,
  },
  permissionTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  permissionMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  laterPill: {
    borderRadius: 14,
    backgroundColor: 'rgba(23, 18, 15, 0.06)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 8,
  },
  laterText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  primaryButton: {
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
    marginTop: 'auto',
  },
  primaryText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
});
