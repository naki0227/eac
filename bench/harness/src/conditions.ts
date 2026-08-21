import type { Condition } from "./types.js";

const commands: Readonly<Record<Condition, ReadonlySet<string>>> = Object.freeze({
  A: new Set<string>(),
  B: new Set(["help", "guide", "docs"]),
  C: new Set(["help", "guide", "docs", "check"]),
});

export function allowedCommands(condition: Condition): readonly string[] {
  return [...commands[condition]];
}

export function commandIsAllowed(condition: Condition, command: string): boolean {
  return commands[condition].has(command);
}

export function categorizeArgs(command: string, args: readonly string[]): string {
  if (command === "docs" && args[0] === "search") return "docs-search";
  if (command === "docs" && args.length > 0) return "docs-topic";
  if (command === "check") return "project-check";
  return "none";
}
