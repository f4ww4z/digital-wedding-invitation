import { createLucideIcon } from 'lucide-react';

/**
 * Infishol: a man and a woman with a partition between them, drawn on Lucide's 24px grid so it
 * matches the other etiquette icons (stroke, size and colour props work the same).
 */
export const Separated = createLucideIcon('separated', [
  // Partition
  ['path', { d: 'M12 2v20', key: 'wall' }],
  // Man: head and shoulders
  ['circle', { cx: '6', cy: '6.5', r: '2.5', key: 'man-head' }],
  ['path', { d: 'M2.5 21v-5.5a3.5 3.5 0 0 1 7 0V21', key: 'man-body' }],
  // Woman: head and long dress
  ['circle', { cx: '18', cy: '6.5', r: '2.5', key: 'woman-head' }],
  ['path', { d: 'M16.5 12h3l2.5 9h-8z', key: 'woman-body' }],
]);
