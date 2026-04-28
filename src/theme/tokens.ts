import { Platform } from 'react-native';

import { colors } from './tokens.shared';

export { colors, gradients, radius, spacing } from './tokens.shared';

// platform-safe font: iOS=Avenir Next / Android=sans-serif / Web=system-ui
const _platformFont: string =
  Platform.OS === 'ios' ? 'Avenir Next' : Platform.OS === 'android' ? 'sans-serif' : 'system-ui';

export const fonts = {
  display: _platformFont,
  body: _platformFont,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '900' as const, letterSpacing: -0.5 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '900' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '900' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '800' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, letterSpacing: 0 },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 0.2 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '700' as const, letterSpacing: 0.3 },
} as const;

export const elevation = {
  none: { shadowColor: '#17120F', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  low: { shadowColor: '#17120F', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  mid: { shadowColor: '#17120F', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  high: { shadowColor: '#17120F', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
} as const;

export const motion = {
  duration: { quick: 120, base: 250, slow: 400 },
  easing: { standard: 'ease-in-out', decelerate: 'ease-out', accelerate: 'ease-in' },
} as const;

export const border = {
  thin: { width: 1, color: colors.setlogLine },
  medium: { width: 2, color: 'rgba(23, 18, 15, 0.18)' },
  thick: { width: 3, color: 'rgba(23, 18, 15, 0.22)' },
  focus: { width: 2, color: colors.setlogLavender },
} as const;
