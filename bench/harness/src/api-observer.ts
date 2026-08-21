export type ApiEvidence = Readonly<{ name: string; excerpt: string }>;

export function findUndefinedApiCandidates(
  evidence: string,
  publicMembers: ReadonlySet<string>,
): readonly ApiEvidence[] {
  const candidates: ApiEvidence[] = [];
  const pattern = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of evidence.matchAll(pattern)) {
    const receiver = match[1];
    const name = match[2];
    if (receiver === undefined || name === undefined || publicMembers.has(name)) continue;
    if (!["project", "scene", "object", "dot", "star", "card", "title"].includes(receiver))
      continue;
    candidates.push({ name, excerpt: match[0] });
  }
  return candidates;
}
