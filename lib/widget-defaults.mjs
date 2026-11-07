export const ROLE_DEFAULT_ID = 'default';

export const PRESET_GROUPS = {
  duck: { id: 'duck', name: '小黄鸭', press: 'ya1', release: 'ya2', preset: true },
  fx1: { id: 'fx1', name: '音效1', press: 'd1', release: 'd2', preset: true },
};

export const PRESET_FRAGMENTS = {
  ya1: { id: 'ya1', name: '小黄鸭·按下', preset: true },
  ya2: { id: 'ya2', name: '小黄鸭·松开', preset: true },
  d1: { id: 'd1', name: '音效1·按下', preset: true },
  d2: { id: 'd2', name: '音效1·松开', preset: true },
};

export const DEFAULT_BUBBLE_IMGS = [
  { id: 'bimg_petpet', name: 'petpet', file: 'bubble-petpet.gif', format: 'gif' },
  { id: 'bimg_yue_money', name: 'Yue_要米', file: 'bubble-yue-money.gif', format: 'gif' },
];
