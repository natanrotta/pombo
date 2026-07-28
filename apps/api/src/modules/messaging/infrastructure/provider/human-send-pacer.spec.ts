import { HumanSendPacer } from "./human-send-pacer";

// Deterministic RNG: dequeues the provided values in order, then repeats the
// last one so an over-consuming call never returns undefined.
const rng = (values: number[]): (() => number) => {
  let i = 0;
  // `?? 0` only satisfies noUncheckedIndexedAccess — the fallback fires only on
  // an empty `values`, which the calling convention never passes.
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
};

// Fixed tuning for readable expectations:
// msPerChar=50, min=1500, max=20000, jitter=0.3, longP=0.15, longMin=30000, longMax=120000.
const make = (random: () => number): HumanSendPacer =>
  new HumanSendPacer(50, 1500, 20000, 0.3, 0.15, 30000, 120000, random);

describe("HumanSendPacer.typingDelayMs", () => {
  it("scales with text length (jitter neutral at random=0.5)", () => {
    // factor = 1 + (0.5*2-1)*0.3 = 1 → 100 * 50
    expect(make(rng([0.5])).typingDelayMs(100)).toBe(5000);
  });

  it("clamps to minMs for short text", () => {
    // 5 * 50 = 250 < 1500 → minMs
    expect(make(rng([0.5])).typingDelayMs(5)).toBe(1500);
  });

  it("clamps to maxMs for very long text", () => {
    // 1000 * 50 = 50000 > 20000 → maxMs
    expect(make(rng([0.5])).typingDelayMs(1000)).toBe(20000);
  });

  it("applies negative jitter at random=0 (factor 1 - jitterPct)", () => {
    // factor = 1 + (0*2-1)*0.3 = 0.7 → 200*50*0.7 = 7000
    expect(make(rng([0])).typingDelayMs(200)).toBe(7000);
  });

  it("applies positive jitter at random=1 (factor 1 + jitterPct)", () => {
    // factor = 1 + (1*2-1)*0.3 = 1.3 → 200*50*1.3 = 13000
    expect(make(rng([1])).typingDelayMs(200)).toBe(13000);
  });

  it("never drops below minMs even with max negative jitter", () => {
    // 40*50 = 2000; factor 0.7 → 1400 < 1500 → clamps to 1500
    expect(make(rng([0])).typingDelayMs(40)).toBe(1500);
  });

  it("treats negative length as zero → clamps to minMs", () => {
    expect(make(rng([0.5])).typingDelayMs(-10)).toBe(1500);
  });

  it("clamps an empty message (length 0) to minMs", () => {
    expect(make(rng([0.5])).typingDelayMs(0)).toBe(1500);
  });
});

describe("HumanSendPacer.longPauseMs", () => {
  it("returns 0 when the gate draw is >= probability", () => {
    // gate 0.5 >= 0.15 → 0 (value draw unused)
    expect(make(rng([0.5])).longPauseMs()).toBe(0);
  });

  it("returns a value in [min,max] when the gate draw is < probability", () => {
    // gate 0.1 < 0.15 → fire; value 0.5 → 30000 + 0.5*90000 = 75000
    expect(make(rng([0.1, 0.5])).longPauseMs()).toBe(75000);
  });

  it("returns longPauseMin at value draw 0 and longPauseMax at draw 1", () => {
    expect(make(rng([0, 0])).longPauseMs()).toBe(30000);
    expect(make(rng([0, 1])).longPauseMs()).toBe(120000);
  });
});
