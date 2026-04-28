import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { TimelineMonth } from '../types/happened';

type TimelineContextValue = {
  timeline: TimelineMonth[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineMonth[]>>;
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState<TimelineMonth[]>([]);

  const value = useMemo<TimelineContextValue>(
    () => ({ timeline, setTimeline }),
    [timeline],
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

/** 타임라인 상태와 setter에 접근. AppDataContext orchestrator 내부 전용. */
export function useTimelineContext() {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useTimelineContext must be used inside TimelineProvider');
  return ctx;
}

/** 타임라인만 필요한 외부 consumer용 hook. */
export function useTimeline() {
  const { timeline } = useTimelineContext();
  return { timeline };
}
