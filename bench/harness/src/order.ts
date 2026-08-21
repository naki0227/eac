import type { BenchmarkTask, Condition } from "./types.js";

export type RunPair = Readonly<{ condition: Condition; taskId: string }>;

function seedHash(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: { value: number }): number {
  state.value += 0x6d2b79f5;
  let value = state.value;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

export function createRunOrder(tasks: readonly BenchmarkTask[], seed: string): readonly RunPair[] {
  const pairs: RunPair[] = (["A", "B", "C"] as const).flatMap((condition) =>
    tasks.map((task) => ({ condition, taskId: task.id })),
  );
  const state = { value: seedHash(seed) };
  for (let index = pairs.length - 1; index > 0; index--) {
    const other = Math.floor(nextRandom(state) * (index + 1));
    const currentValue = pairs[index];
    const otherValue = pairs[other];
    if (currentValue === undefined || otherValue === undefined) continue;
    pairs[index] = otherValue;
    pairs[other] = currentValue;
  }
  return pairs;
}

export function assertCompletedPrefix(
  order: readonly RunPair[],
  completedKeys: ReadonlySet<string>,
): void {
  const known = new Set(order.map(({ condition, taskId }) => `${condition}/${taskId}`));
  for (const key of completedKeys)
    if (!known.has(key)) throw new Error(`Existing result is not in the frozen order: ${key}`);
  let gapFound = false;
  for (const { condition, taskId } of order) {
    const completed = completedKeys.has(`${condition}/${taskId}`);
    if (!completed) gapFound = true;
    else if (gapFound)
      throw new Error("Existing results are not a prefix of the frozen run order.");
  }
}
