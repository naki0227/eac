import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type CodexAuthentication =
  Readonly<{ kind: "chatgpt"; authFile: string }> | Readonly<{ kind: "api-key" }>;

async function regularFile(path: string): Promise<string | null> {
  try {
    const canonicalPath = await realpath(path);
    return (await stat(canonicalPath)).isFile() ? canonicalPath : null;
  } catch {
    return null;
  }
}

export async function resolveCodexAuthentication(
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): Promise<CodexAuthentication> {
  const rawConfiguredPath = environment.EAC_CODEX_AUTH_FILE?.trim();
  const configuredPath = rawConfiguredPath === "" ? undefined : rawConfiguredPath;
  const candidate = resolve(configuredPath ?? resolve(homeDirectory, ".codex/auth.json"));
  const authFile = await regularFile(candidate);
  if (authFile !== null) return { kind: "chatgpt", authFile };
  if (configuredPath)
    throw new Error(`EAC_CODEX_AUTH_FILE does not reference a regular file: ${candidate}`);
  if (environment.OPENAI_API_KEY?.trim()) return { kind: "api-key" };
  throw new Error(
    "No Codex authentication is available. Run `codex login` to create ~/.codex/auth.json, " +
      "or set EAC_CODEX_AUTH_FILE to a file-based Codex auth cache. OPENAI_API_KEY remains an optional fallback.",
  );
}
