export const colors = {
  ink: '#05070D',
  graphite: '#0B0F14',
  panel: 'rgba(13, 18, 26, 0.72)',
  panelStrong: 'rgba(9, 12, 18, 0.88)',
  line: 'rgba(255, 255, 255, 0.12)',
  text: '#F5F7F2',
  muted: 'rgba(245, 247, 242, 0.68)',
  faint: 'rgba(245, 247, 242, 0.42)',
  cyan: '#39D9F2',
  lime: '#C7F95B',
  coral: '#FF6F61',
  yellow: '#F8D84E',
  red: '#F44E5E',
  violet: '#9B8CFF',
  paper: '#E7D8B9',
  amber: '#F2A93B',
  negative: '#1A0F0A',
  setlogBg: '#FFF8EF',
  setlogPaper: '#FFFEF8',
  setlogInk: '#17120F',
  setlogMuted: '#746B62',
  setlogFaint: '#ADA49A',
  setlogLine: 'rgba(23, 18, 15, 0.14)',
  setlogPink: '#FFB7C8',
  setlogLavender: '#BDA8FF',
  setlogMint: '#87F0B6',
  setlogBlue: '#B9D8FF',
  setlogYellow: '#FFE893',
} as const;

export const gradients = {
  app: ['#05070D', '#071218', '#0C1116'] as const,
  unlocked: ['rgba(185, 216, 255, 0.95)', 'rgba(135, 240, 182, 0.95)'] as const,
  locked: ['rgba(255, 183, 200, 0.95)', 'rgba(255, 232, 147, 0.95)'] as const,
  heat: ['#B9D8FF', '#87F0B6', '#FFE893', '#FFB7C8'] as const,
} as const;

export const radius = {
  panel: 8,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// platform-safe font: iOS=Avenir Next / Android=sans-serif / Web=system-ui
// Platform.select은 react-native import를 피하기 위해 런타임 감지로 처리
const _platformFont: string = (() => {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    // React Native 환경: OS별 분기
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    if (Platform.OS === 'ios') return 'Avenir Next';
    return 'sans-serif';
  }
  return 'system-ui';
})();

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
