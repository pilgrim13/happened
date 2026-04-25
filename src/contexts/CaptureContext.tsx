import { createContext, useContext, type ReactNode } from 'react';

import { useCaptureFlow } from '../hooks/useCaptureFlow';

type CaptureContextValue = ReturnType<typeof useCaptureFlow>;

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const value = useCaptureFlow();
  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be used inside CaptureProvider');
  return ctx;
}
