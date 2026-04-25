import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

function getViewportHeight(fallbackHeight: number) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return fallbackHeight;
  }

  if (window.innerWidth >= 720) {
    return Math.round(window.innerHeight ?? fallbackHeight);
  }

  return Math.round(window.visualViewport?.height ?? window.innerHeight ?? fallbackHeight);
}

export function useVisualViewportHeight() {
  const { height } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight(height));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setViewportHeight(height);
      return undefined;
    }

    const updateHeight = () => {
      setViewportHeight(getViewportHeight(height));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('scroll', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('scroll', updateHeight);
    };
  }, [height]);

  return viewportHeight;
}
