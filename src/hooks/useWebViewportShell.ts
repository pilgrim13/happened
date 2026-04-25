import { useEffect } from 'react';
import { Platform } from 'react-native';

import { colors } from '../theme/tokens';

export function useWebViewportShell() {
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const setViewportHeight = () => {
      const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const height = Math.round(
        viewportWidth >= 720
          ? window.innerHeight
          : window.visualViewport?.height ?? window.innerHeight,
      );
      document.documentElement.style.setProperty('--happened-viewport-height', `${height}px`);
    };

    setViewportHeight();
    document.documentElement.style.backgroundColor = colors.setlogBg;
    document.documentElement.style.height = 'var(--happened-viewport-height)';
    document.documentElement.style.width = '100vw';
    document.documentElement.style.maxWidth = '100vw';
    document.body.style.backgroundColor = colors.setlogBg;
    document.body.style.height = 'var(--happened-viewport-height)';
    document.body.style.width = '100vw';
    document.body.style.maxWidth = '100vw';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';

    const root = document.getElementById('root');
    if (root) {
      root.style.height = 'var(--happened-viewport-height)';
      root.style.minHeight = 'var(--happened-viewport-height)';
      root.style.width = '100vw';
      root.style.maxWidth = '100vw';
      root.style.overflow = 'hidden';
      root.style.backgroundColor = colors.setlogBg;
    }

    window.addEventListener('resize', setViewportHeight);
    window.visualViewport?.addEventListener('resize', setViewportHeight);
    window.visualViewport?.addEventListener('scroll', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.visualViewport?.removeEventListener('resize', setViewportHeight);
      window.visualViewport?.removeEventListener('scroll', setViewportHeight);
    };
  }, []);
}
