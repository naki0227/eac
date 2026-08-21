import type { LocalAssetIR } from "@eac/ir";

export function asset(path: string): LocalAssetIR {
  const normalized = path.replaceAll("\\", "/");
  const invalid =
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    normalized.split("/").includes("..") ||
    normalized.includes("\0");
  if (invalid)
    throw new TypeError("asset path must be a non-empty project-relative path without traversal");
  return Object.freeze({ kind: "local", path: normalized });
}
