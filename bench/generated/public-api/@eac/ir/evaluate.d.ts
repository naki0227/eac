import type { PropertyValue, TimedProperty, Vec2 } from "./types.js";
export declare function evaluateTimedProperty<T extends PropertyValue>(
  property: TimedProperty<T>,
  time: number,
): T;
export declare const defaultProperties: (position: Vec2) => {
  position: {
    kind: "timed";
    initial: Readonly<{
      x: import("@eac/units").Length;
      y: import("@eac/units").Length;
    }>;
    segments: never[];
  };
  rotation: {
    kind: "timed";
    initial: Readonly<{
      kind: "angle";
      value: number;
    }>;
    segments: never[];
  };
  opacity: {
    kind: "timed";
    initial: Readonly<{
      kind: "opacity";
      value: number;
    }>;
    segments: never[];
  };
  depth: {
    kind: "timed";
    initial: Readonly<{
      kind: "depth";
      value: number;
    }>;
    segments: never[];
  };
};
//# sourceMappingURL=evaluate.d.ts.map
