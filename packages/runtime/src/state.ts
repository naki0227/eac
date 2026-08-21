import type { ScenarioIR, SignalValue, StateDeclIR } from "@eac/ir";

/**
 * Everything replay needs to resume from a point in time. Serializable by construction so a
 * checkpoint is ordinary data, never a live object graph.
 */
export type ReplayState = Readonly<{
  stepIndex: number;
  time: number;
  pointer: Readonly<{ x: number; y: number; down: boolean; present: boolean }>;
  scroll: Readonly<{ x: number; y: number }>;
  keys: readonly string[];
  states: Readonly<Record<string, SignalValue>>;
  hoverTarget?: string;
  pressedTarget?: string;
  sounds: readonly Readonly<{ sound: string; at: number }>[];
}>;

export type StateTransition = Readonly<{
  at: number;
  stepIndex: number;
  event: string;
  target?: string;
  state: string;
  from: SignalValue;
  to: SignalValue;
}>;

export function initialReplayState(
  states: readonly StateDeclIR[],
  scenario: ScenarioIR | undefined,
): ReplayState {
  const values: Record<string, SignalValue> = {};
  for (const declaration of states) values[declaration.name] = declaration.initial;
  const pointer = scenario?.initialPointer;
  const scroll = scenario?.initialScroll;
  return {
    stepIndex: -1,
    time: 0,
    pointer: {
      x: pointer?.x.value ?? Number.NaN,
      y: pointer?.y.value ?? Number.NaN,
      down: false,
      present: pointer !== undefined,
    },
    scroll: { x: scroll?.x.value ?? 0, y: scroll?.y.value ?? 0 },
    keys: [],
    states: values,
    sounds: [],
  };
}

export const cloneStates = (
  states: Readonly<Record<string, SignalValue>>,
): Record<string, SignalValue> => ({
  ...states,
});
