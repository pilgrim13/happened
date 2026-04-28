import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PlaceBubble } from '../types/happened';

type PlacesContextValue = {
  places: PlaceBubble[];
  setPlaces: React.Dispatch<React.SetStateAction<PlaceBubble[]>>;
};

const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<PlaceBubble[]>([]);

  const value = useMemo<PlacesContextValue>(
    () => ({ places, setPlaces }),
    [places],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

/** 장소 상태와 setter에 접근. AppDataContext orchestrator 내부 전용. */
export function usePlacesContext() {
  const ctx = useContext(PlacesContext);
  if (!ctx) throw new Error('usePlacesContext must be used inside PlacesProvider');
  return ctx;
}

/** 장소 목록만 필요한 외부 consumer용 hook. */
export function usePlaces() {
  const { places } = usePlacesContext();
  return { places };
}
