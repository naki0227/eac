export type DiagnosticSeverity = "error" | "warning";
export type Diagnostic = Readonly<{
  severity: DiagnosticSeverity;
  id: `eac::${string}`;
  what: string;
  where: string;
  why: string;
  how: readonly string[];
  details?: readonly string[];
}>;

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const details = diagnostic.details?.length ? `\n\n${diagnostic.details.join("\n")}` : "";
  return `${diagnostic.severity}[${diagnostic.id}]\n\n${diagnostic.what}\n\nWhere:\n${diagnostic.where}${details}\n\nWhy:\n${diagnostic.why}\n\nPossible fixes:\n${diagnostic.how.map((item) => `- ${item}`).join("\n")}`;
}

export const error = (
  id: `eac::${string}`,
  what: string,
  where: string,
  why: string,
  how: readonly string[],
  details?: readonly string[],
): Diagnostic => ({
  severity: "error",
  id,
  what,
  where,
  why,
  how,
  ...(details === undefined ? {} : { details }),
});

export const warning = (
  id: `eac::${string}`,
  what: string,
  where: string,
  why: string,
  how: readonly string[],
  details?: readonly string[],
): Diagnostic => ({
  severity: "warning",
  id,
  what,
  where,
  why,
  how,
  ...(details === undefined ? {} : { details }),
});
