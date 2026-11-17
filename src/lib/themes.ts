export const THEMES = [
  { id: 'sage', name: '세이지', color: '#4F6F55', tint: '#EEF2EC' },
  { id: 'mocha', name: '모카', color: '#7A5C45', tint: '#F3EDE7' },
  { id: 'blue', name: '더스티 블루', color: '#4E6680', tint: '#ECF0F4' },
  { id: 'charcoal', name: '차콜', color: '#45453F', tint: '#EFEFEC' }
];
export type Theme = (typeof THEMES)[number];
