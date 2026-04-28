import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { NotificationItem } from '../types/happened';

type NotificationsContextValue = {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, setNotifications }),
    [notifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** 알림 상태와 setter에 접근. AppDataContext orchestrator 내부 전용. */
export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used inside NotificationsProvider');
  return ctx;
}

/** 알림 목록만 필요한 외부 consumer용 hook. */
export function useNotifications() {
  const { notifications } = useNotificationsContext();
  return { notifications };
}
