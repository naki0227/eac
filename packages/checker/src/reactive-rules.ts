import {
  expressionChildren,
  expressionSignals,
  printSignal,
  signalKey,
  typeOfExpression,
  walkNodes,
  type ExperienceIR,
  type ReactiveBindingIR,
  type ReactiveExpr,
  type ReactiveSceneIR,
  type SceneIR,
  type SignalRef,
  type SignalValueKind,
} from "@eac/ir";
import { error, type Diagnostic } from "./diagnostic.js";

const NUMERIC_PROPERTIES = ["rotation", "opacity", "depth", "blur"] as const;

/** Which expression type a binding slot requires. Every reactive target is numeric today. */
const bindingExpressions = (
  binding: ReactiveBindingIR,
): readonly Readonly<{ label: string; expression: ReactiveExpr }>[] => {
  if (binding.property === "position" || binding.property === "scale")
    return [
      { label: `${binding.property}.x`, expression: binding.x },
      { label: `${binding.property}.y`, expression: binding.y },
    ];
  if ("value" in binding) return [{ label: binding.property, expression: binding.value }];
  return [{ label: `${binding.property}.progress`, expression: binding.progress }];
};

function signalResolver(scene: SceneIR): (ref: SignalRef) => SignalValueKind | undefined {
  const states = new Map(scene.reactive.states.map((state) => [state.name, state.valueKind]));
  const nodes = new Set(walkNodes(scene.nodes).map(({ node }) => node.id));
  return (ref) => {
    if (ref.kind === "pointer")
      return ref.channel === "down" || ref.channel === "present" ? "boolean" : "number";
    if (ref.kind === "scroll" || ref.kind === "viewport") return "number";
    if (ref.kind === "key") return ref.code.length > 0 ? "boolean" : undefined;
    if (ref.kind === "hover" || ref.kind === "pressed")
      return nodes.has(ref.node) ? "boolean" : undefined;
    return states.get(ref.name);
  };
}

function stateDiagnostics(scene: SceneIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const state of scene.reactive.states) {
    if (seen.has(state.name))
      diagnostics.push(
        error(
          "eac::state::duplicate-name",
          `State \`${state.name}\` is declared more than once.`,
          `${scene.id}.state.${state.name}`,
          "A state name is the identity used by every binding, rule, and assertion.",
          ["rename one declaration", "reuse the existing state handle"],
        ),
      );
    seen.add(state.name);
    const expected = state.valueKind === "boolean" ? "boolean" : "number";
    if (
      typeof state.initial !== expected ||
      (expected === "number" && !Number.isFinite(state.initial))
    )
      diagnostics.push(
        error(
          "eac::state::invalid-initial-value",
          `State \`${state.name}\` has an initial value that is not a finite ${expected}.`,
          `${scene.id}.state.${state.name}`,
          "Replay starts from the declared initial value, so it must be a valid serializable value.",
          [`declare it with a ${expected} initial value`],
        ),
      );
  }
  return diagnostics;
}

function expressionDiagnostics(
  scene: SceneIR,
  where: string,
  label: string,
  expression: ReactiveExpr,
  expected: SignalValueKind,
): Diagnostic[] {
  const resolve = signalResolver(scene);
  const unknown = expressionSignals(expression).filter((ref) => resolve(ref) === undefined);
  if (unknown.length > 0)
    return unknown.map((ref) =>
      error(
        "eac::reactive::undefined-signal",
        `${label} reads \`${printSignal(ref)}\`, which does not exist.`,
        where,
        "Reactive expressions may only read declared state and the built-in signal registry.",
        [
          "declare the state with scene.state(name, initial)",
          "check the node id used by hover() or pressed()",
          "run eac docs signals for the built-in signal list",
        ],
      ),
    );
  const result = typeOfExpression(expression, resolve);
  if (!result.ok)
    return [
      error(
        "eac::reactive::type-mismatch",
        `${label} is not well typed: ${result.detail}.`,
        where,
        "Reactive expressions carry number or boolean values and are checked before rendering.",
        [
          "use when(condition, a, b) to turn a boolean into a number",
          "compare like-typed operands",
        ],
      ),
    ];
  if (result.kind !== expected)
    return [
      error(
        "eac::reactive::type-mismatch",
        `${label} produces ${result.kind} where ${expected} is required.`,
        where,
        "A binding target and a rule guard each require one specific value type.",
        [
          expected === "number"
            ? "wrap it in when(condition, whenTrue, whenFalse)"
            : "compare the value, for example greaterThan(value, 0)",
        ],
      ),
    ];
  return [];
}

function bindingDiagnostics(scene: SceneIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map(walkNodes(scene.nodes).map(({ node }) => [node.id, node]));
  const claimed = new Map<string, string[]>();
  for (const binding of scene.reactive.bindings) {
    const where = `${scene.id}.${binding.node}.${binding.property}`;
    const node = nodes.get(binding.node);
    if (node === undefined) {
      diagnostics.push(
        error(
          "eac::reactive::invalid-hit-target",
          `Binding \`${binding.id}\` targets unknown node \`${binding.node}\`.`,
          where,
          "A binding writes one property of one node that must exist in the scene.",
          ["check the node id", "run eac inspect to list node ids"],
        ),
      );
      continue;
    }
    if (
      (binding.property === "blur" ||
        binding.property === "fill" ||
        binding.property === "stroke") &&
      node.kind !== "object"
    )
      diagnostics.push(
        error(
          "eac::reactive::mixed-property-writers",
          `Binding \`${binding.id}\` sets \`${binding.property}\` on group \`${binding.node}\`.`,
          where,
          "Groups own transform properties only; appearance belongs to visual objects.",
          ["bind the property on a child object instead"],
        ),
      );
    const key = `${binding.node}.${binding.property}`;
    claimed.set(key, [...(claimed.get(key) ?? []), binding.id]);
    for (const { label, expression } of bindingExpressions(binding))
      diagnostics.push(
        ...expressionDiagnostics(
          scene,
          where,
          `Binding \`${binding.id}\` ${label}`,
          expression,
          "number",
        ),
      );
  }
  for (const [key, ids] of claimed)
    if (ids.length > 1)
      diagnostics.push(
        error(
          "eac::reactive::mixed-property-writers",
          `\`${key}\` has ${String(ids.length)} reactive bindings.`,
          `${scene.id}.${key}`,
          "A property has exactly one writer, whether that writer is timed or reactive.",
          ["remove one binding", "combine them into a single expression with when()"],
        ),
      );
  return diagnostics;
}

/** A property may be timed-driven or reactive-driven, never both. See ADR 0011. */
function mixedWriterDiagnostics(scene: SceneIR): Diagnostic[] {
  const nodes = new Map(walkNodes(scene.nodes).map(({ node }) => [node.id, node]));
  return scene.reactive.bindings.flatMap((binding) => {
    const node = nodes.get(binding.node);
    if (node === undefined) return [];
    const timed =
      binding.property === "fill" || binding.property === "stroke" || binding.property === "blur"
        ? node.kind === "object"
          ? node.appearance[binding.property].segments.length
          : 0
        : node.properties[binding.property].segments.length;
    if (timed === 0) return [];
    return [
      error(
        "eac::reactive::mixed-property-writers",
        `\`${binding.node}.${binding.property}\` has both a timed writer and a reactive binding.`,
        `${scene.id}.${binding.node}.${binding.property}`,
        "v0.3 keeps a property either timed-driven or reactive-driven so its value has one cause.",
        [
          "remove the timed motion on this property",
          "remove the reactive binding",
          "drive a different property reactively",
        ],
      ),
    ];
  });
}

function ruleDiagnostics(scene: SceneIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Set(walkNodes(scene.nodes).map(({ node }) => node.id));
  const states = new Set(scene.reactive.states.map((state) => state.name));
  const sounds = new Set(scene.reactive.sounds.map((sound) => sound.id));
  const stateKinds = new Map(scene.reactive.states.map((state) => [state.name, state.valueKind]));
  for (const rule of scene.reactive.rules) {
    const where = `${scene.id}.rule.${rule.id}`;
    if ("node" in rule.trigger && !nodes.has(rule.trigger.node))
      diagnostics.push(
        error(
          "eac::reactive::invalid-hit-target",
          `Rule \`${rule.id}\` triggers on unknown node \`${rule.trigger.node}\`.`,
          where,
          "Pointer triggers are resolved by hit-testing a node that must exist in the scene.",
          ["check the node id", "run eac inspect to list node ids"],
        ),
      );
    if ("code" in rule.trigger && rule.trigger.code.length === 0)
      diagnostics.push(
        error(
          "eac::reactive::invalid-event",
          `Rule \`${rule.id}\` has an empty key code.`,
          where,
          "A keyboard trigger matches one normalized key code.",
          ['use a code such as "Escape", "Space", or "ArrowLeft"'],
        ),
      );
    if (rule.guard !== undefined)
      diagnostics.push(
        ...expressionDiagnostics(scene, where, `Rule \`${rule.id}\` guard`, rule.guard, "boolean"),
      );
    if (rule.actions.length === 0)
      diagnostics.push(
        error(
          "eac::reactive::invalid-event",
          `Rule \`${rule.id}\` has no actions.`,
          where,
          "A rule with no actions cannot change anything and hides an authoring mistake.",
          ["add a setState, toggle, or playSound action", "remove the rule"],
        ),
      );
    const written = new Map<string, number>();
    for (const action of rule.actions) {
      if (action.kind === "playSound") {
        if (!sounds.has(action.sound))
          diagnostics.push(
            error(
              "eac::reactive::invalid-event",
              `Rule \`${rule.id}\` plays unknown sound \`${action.sound}\`.`,
              where,
              "A playSound action names a sound declared with scene.sound().",
              ["declare it with scene.sound(id, path)"],
            ),
          );
        continue;
      }
      if (!states.has(action.state)) {
        diagnostics.push(
          error(
            "eac::reactive::undefined-signal",
            `Rule \`${rule.id}\` writes unknown state \`${action.state}\`.`,
            where,
            "Rules may only write state that the scene declares.",
            ["declare it with scene.state(name, initial)"],
          ),
        );
        continue;
      }
      written.set(action.state, (written.get(action.state) ?? 0) + 1);
      if (action.kind === "toggleState" && stateKinds.get(action.state) !== "boolean")
        diagnostics.push(
          error(
            "eac::reactive::type-mismatch",
            `Rule \`${rule.id}\` toggles number state \`${action.state}\`.`,
            where,
            "Toggle flips a boolean; a number state needs an explicit value.",
            ["use setState(state, value)"],
          ),
        );
      if (action.kind === "setState")
        diagnostics.push(
          ...expressionDiagnostics(
            scene,
            where,
            `Rule \`${rule.id}\` sets \`${action.state}\``,
            action.value,
            stateKinds.get(action.state) ?? "number",
          ),
        );
    }
    for (const [name, count] of written)
      if (count > 1)
        diagnostics.push(
          error(
            "eac::reactive::multiple-state-writers",
            `Rule \`${rule.id}\` writes \`${name}\` ${String(count)} times.`,
            where,
            "Two writes to one state in one step have no defined order, so this is never resolved silently.",
            ["keep one write per state per rule", "combine them into one setState with when()"],
          ),
        );
  }
  return [...diagnostics, ...sameStepWriterDiagnostics(scene)];
}

/** Two different rules on the same trigger writing the same state collide within one step. */
function sameStepWriterDiagnostics(scene: SceneIR): Diagnostic[] {
  const byTrigger = new Map<string, Map<string, string[]>>();
  for (const rule of scene.reactive.rules) {
    const trigger =
      rule.trigger.kind === "scroll"
        ? "scroll"
        : "code" in rule.trigger
          ? `${rule.trigger.kind}:${rule.trigger.code}`
          : `${rule.trigger.kind}:${rule.trigger.node}`;
    const states = byTrigger.get(trigger) ?? new Map<string, string[]>();
    for (const action of rule.actions)
      if (action.kind !== "playSound")
        states.set(action.state, [...(states.get(action.state) ?? []), rule.id]);
    byTrigger.set(trigger, states);
  }
  const diagnostics: Diagnostic[] = [];
  for (const [trigger, states] of byTrigger)
    for (const [name, rules] of states)
      if (rules.length > 1)
        diagnostics.push(
          error(
            "eac::reactive::multiple-state-writers",
            `Rules ${rules.map((id) => `\`${id}\``).join(" and ")} both write \`${name}\` on \`${trigger}\`.`,
            `${scene.id}.state.${name}`,
            "Rules matching one event run in the same step, so two writers have no defined order.",
            ["merge the rules", "guard them so only one can apply", "write different states"],
          ),
        );
  return diagnostics;
}

/**
 * The phase model in ADR 0009 makes a same-step cycle between bindings impossible: an expression
 * reads only committed signals and state, and hover comes from the *previous* step's geometry. The
 * hover-scale interaction is therefore legal, not cyclic.
 *
 * What remains detectable — and what would otherwise overflow the stack at evaluation time — is a
 * self-referential expression graph, which raw or generated IR can construct.
 */
function cycleDiagnostics(scene: SceneIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const report = (where: string, label: string, path: readonly string[]): void => {
    diagnostics.push(
      error(
        "eac::reactive::cycle",
        `${label} contains an expression that refers to itself.`,
        `${where}\n   ${path.join("\n   ↓\n   ")}`,
        "A self-referential expression has no value and would recurse without end.",
        ["rebuild the expression with the core helpers", "remove the shared sub-expression"],
      ),
    );
  };
  const check = (where: string, label: string, expression: ReactiveExpr): void => {
    const active: ReactiveExpr[] = [];
    const trail: string[] = [];
    const visit = (node: ReactiveExpr): boolean => {
      if (active.includes(node)) {
        report(where, label, [...trail.slice(active.indexOf(node)), node.kind]);
        return true;
      }
      active.push(node);
      trail.push(node.kind);
      for (const child of expressionChildren(node)) if (visit(child)) return true;
      active.pop();
      trail.pop();
      return false;
    };
    visit(expression);
  };
  for (const binding of scene.reactive.bindings)
    for (const { label, expression } of bindingExpressions(binding))
      check(
        `${scene.id}.${binding.node}.${binding.property}`,
        `Binding \`${binding.id}\` ${label}`,
        expression,
      );
  for (const rule of scene.reactive.rules) {
    if (rule.guard !== undefined)
      check(`${scene.id}.rule.${rule.id}`, `Rule \`${rule.id}\` guard`, rule.guard);
    for (const action of rule.actions)
      if (action.kind === "setState")
        check(
          `${scene.id}.rule.${rule.id}`,
          `Rule \`${rule.id}\` sets \`${action.state}\``,
          action.value,
        );
  }
  return diagnostics;
}

const sceneReactiveDiagnostics = (scene: SceneIR): Diagnostic[] => [
  ...stateDiagnostics(scene),
  ...bindingDiagnostics(scene),
  ...mixedWriterDiagnostics(scene),
  ...ruleDiagnostics(scene),
  ...cycleDiagnostics(scene),
];

export const hasReactive = (reactive: ReactiveSceneIR): boolean =>
  reactive.states.length > 0 ||
  reactive.bindings.length > 0 ||
  reactive.rules.length > 0 ||
  reactive.sounds.length > 0;

export function runReactiveRules(experience: ExperienceIR): Diagnostic[] {
  return experience.scenes.flatMap(sceneReactiveDiagnostics);
}

export { NUMERIC_PROPERTIES, signalKey };
