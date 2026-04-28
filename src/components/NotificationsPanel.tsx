import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { useI18n } from '../i18n';
import type { NotificationItem } from '../types/happened';

type Props = {
  notifications: NotificationItem[];
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (handle: string) => void;
};

function notificationText(notification: NotificationItem, t: ReturnType<typeof useI18n>['t']) {
  if (notification.type === 'echo') {
    return t('home.noticeEcho', { actor: notification.actor.displayName });
  }
  if (notification.type === 'save') {
    return t('home.noticeSave', { actor: notification.actor.displayName });
  }
  if (notification.type === 'reply') {
    return t('home.noticeReply', { actor: notification.actor.displayName });
  }
  if (notification.type === 'follow') {
    return t('home.noticeFollow', { actor: notification.actor.displayName });
  }

  return notification.message;
}

export function NotificationsPanel({ notifications, onOpenPost, onOpenProfile }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.notificationPanel}>
      <Text style={styles.panelTitle}>{t('home.notifications')}</Text>
      {notifications.length ? notifications.map((notification) => (
        <Pressable
          key={notification.id}
          style={styles.notificationRow}
          onPress={() => {
            if (notification.postId) {
              onOpenPost?.(notification.postId);
              return;
            }
            onOpenProfile?.(notification.actor.handle);
          }}
        >
          <View style={[styles.notificationDot, { backgroundColor: notification.read ? colors.setlogLine : notification.type === 'follow' ? colors.setlogMint : colors.setlogPink }]} />
          <View style={styles.notificationCopy}>
            <Text style={styles.notificationTitle}>{notificationText(notification, t)}</Text>
            <Text style={styles.notificationMeta}>{notification.createdAtLabel}</Text>
          </View>
        </Pressable>
      )) : <Text style={styles.panelMeta}>{t('home.noNotifications')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  notificationPanel: {
    borderRadius: 20,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    padding: 12,
    gap: 9,
    marginTop: 14,
  },
  panelTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  notificationMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  panelMeta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
});
