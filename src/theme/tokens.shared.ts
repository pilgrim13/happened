// platform-agnostic 토큰 — server/node 환경에서도 안전하게 import 가능
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
