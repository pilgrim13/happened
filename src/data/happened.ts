import { colors } from '../theme/tokens';
import type { FeedMode, MemoryPost, PlaceBubble, TimelineMonth } from '../types/happened';

export const feedModes: FeedMode[] = ['Following', 'Nearby', 'Memories'];

export const memoryPosts: MemoryPost[] = [
  {
    id: 'seolleung-cafe-2023',
    mode: 'Memories',
    authorName: 'Junn',
    authorHandle: '@junn',
    placeName: 'Seolleung Station Cafe',
    city: 'Seoul',
    distanceMeters: 84,
    unlockRadiusMeters: 200,
    unlockState: 'open',
    visibility: 'Followers',
    caption: 'Rain on the glass, three years later, same corner seat.',
    timeLabel: '3 years ago',
    recallLabel: '3 years ago at this place',
    mediaColors: ['#20313A', '#355D63', '#C7F95B'],
    accentColor: colors.lime,
    stats: { echoes: 18, replies: 4, saves: 9 },
  },
  {
    id: 'hongdae-alley-night',
    mode: 'Following',
    authorName: 'Mina',
    authorHandle: '@min.archive',
    placeName: 'Hongdae Alley Stage',
    city: 'Seoul',
    distanceMeters: 1320,
    unlockRadiusMeters: 200,
    unlockState: 'locked',
    visibility: 'Followers',
    caption: 'The chorus everyone remembered before the lights went out.',
    timeLabel: 'last autumn',
    mediaColors: ['#1C1420', '#225C66', '#FF6F61'],
    accentColor: colors.coral,
    stats: { echoes: 42, replies: 11, saves: 20 },
  },
  {
    id: 'school-yard-2019',
    mode: 'Nearby',
    authorName: 'Tae',
    authorHandle: '@tae.days',
    placeName: 'Daechi School Yard',
    city: 'Seoul',
    distanceMeters: 218,
    unlockRadiusMeters: 300,
    unlockState: 'nearby',
    visibility: 'Public',
    caption: 'One lap before graduation. Someone kept the sound of the bell.',
    timeLabel: 'May 2019',
    mediaColors: ['#07151A', '#286876', '#F8D84E'],
    accentColor: colors.yellow,
    stats: { echoes: 73, replies: 19, saves: 31 },
  },
  {
    id: 'river-steps-dawn',
    mode: 'Following',
    authorName: 'Ara',
    authorHandle: '@ara.walks',
    placeName: 'Han River Steps',
    city: 'Seoul',
    distanceMeters: 640,
    unlockRadiusMeters: 200,
    unlockState: 'locked',
    visibility: 'Followers',
    caption: 'We said we would come back when it got warmer.',
    timeLabel: 'Feb 12',
    mediaColors: ['#091117', '#3A6073', '#39D9F2'],
    accentColor: colors.cyan,
    stats: { echoes: 28, replies: 6, saves: 12 },
  },
];

export const placeBubbles: PlaceBubble[] = [
  { id: 'seolleung', name: 'Seolleung', subtitle: '12 memories', x: 54, y: 38, intensity: 0.92, unlocked: true },
  { id: 'office', name: 'Office', subtitle: '8 stories', x: 32, y: 52, intensity: 0.68, unlocked: true },
  { id: 'cafe', name: 'Corner Cafe', subtitle: '5 locked', x: 68, y: 58, intensity: 0.56, unlocked: false },
  { id: 'school', name: 'School Yard', subtitle: '24 stories', x: 42, y: 70, intensity: 0.82, unlocked: false },
  { id: 'river', name: 'River Steps', subtitle: '9 echoes', x: 76, y: 28, intensity: 0.48, unlocked: false },
];

export const timelineMonths: TimelineMonth[] = [
  {
    id: '2026-04',
    title: 'April 2026',
    placeName: 'Seolleung Station Cafe',
    items: [
      { id: 'a1', title: 'Checked in after lunch', meta: 'Open within 200m', unlocked: true },
      { id: 'a2', title: 'Window seat note', meta: 'Followers only', unlocked: true },
    ],
  },
  {
    id: '2025-11',
    title: 'November 2025',
    placeName: 'Hongdae Alley Stage',
    items: [
      { id: 'b1', title: 'Street set after rain', meta: 'Return to unlock', unlocked: false },
      { id: 'b2', title: 'Mina left a reply', meta: '1.3km away', unlocked: false },
    ],
  },
  {
    id: '2023-04',
    title: 'April 2023',
    placeName: 'Seolleung Station Cafe',
    items: [
      { id: 'c1', title: 'Same corner table', meta: 'Recalled today', unlocked: true },
    ],
  },
];
