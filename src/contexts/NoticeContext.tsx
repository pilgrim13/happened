import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type NoticeContextValue = {
  notice: string | null;
  showNotice: (message: string) => void;
  clearNotice: () => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string) => setNotice(message), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => ({ notice, showNotice, clearNotice }), [notice, showNotice, clearNotice]);
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function useNotice() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error('useNotice must be used inside NoticeProvider');
  return ctx;
}
