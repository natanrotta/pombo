// `as const` matters: framer-motion 12 types a cubic-bezier easing as a
// 4-tuple, and a plain `number[]` no longer satisfies it.
export const EASE_ORGANIC: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

export const TRANSITION_FAST = { duration: 0.2, ease: EASE_ORGANIC };
export const TRANSITION_DEFAULT = { duration: 0.25, ease: EASE_ORGANIC };
export const TRANSITION_SLOW = { duration: 0.3, ease: EASE_ORGANIC };
export const TRANSITION_PAGE_SWAP = { duration: 0.4, ease: EASE_ORGANIC };
