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
} as const;

export const gradients = {
  app: ['#05070D', '#071218', '#0C1116'] as const,
  unlocked: ['rgba(57, 217, 242, 0.95)', 'rgba(199, 249, 91, 0.95)'] as const,
  locked: ['rgba(255, 111, 97, 0.95)', 'rgba(248, 216, 78, 0.95)'] as const,
  heat: ['#39D9F2', '#C7F95B', '#F8D84E', '#FF6F61'] as const,
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

export const fonts = {
  display: 'Avenir Next',
  body: 'Avenir Next',
} as const;
