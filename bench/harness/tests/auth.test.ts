import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCodexAuthentication } from "../src/auth.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "eac-auth-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("Codex authentication", () => {
  it("uses the default ChatGPT auth cache without requiring an API key", async () => {
    const home = await temporaryDirectory();
    await mkdir(resolve(home, ".codex"));
    await writeFile(resolve(home, ".codex/auth.json"), "{}");

    await expect(resolveCodexAuthentication({}, home)).resolves.toEqual({
      kind: "chatgpt",
      authFile: await realpath(resolve(home, ".codex/auth.json")),
    });
  });

  it("honors an explicit auth cache path", async () => {
    const home = await temporaryDirectory();
    const authFile = resolve(home, "benchmark-auth.json");
    await writeFile(authFile, "{}");

    await expect(
      resolveCodexAuthentication({ EAC_CODEX_AUTH_FILE: authFile }, home),
    ).resolves.toEqual({ kind: "chatgpt", authFile: await realpath(authFile) });
  });

  it("keeps API-key authentication as an optional fallback", async () => {
    const home = await temporaryDirectory();

    await expect(
      resolveCodexAuthentication({ OPENAI_API_KEY: "test-only" }, home),
    ).resolves.toEqual({ kind: "api-key" });
  });

  it("fails clearly when neither authentication method is available", async () => {
    const home = await temporaryDirectory();

    await expect(resolveCodexAuthentication({}, home)).rejects.toThrow(
      "Run `codex login` to create ~/.codex/auth.json",
    );
  });

  it("does not silently fall back when an explicit auth path is invalid", async () => {
    const home = await temporaryDirectory();

    await expect(
      resolveCodexAuthentication(
        { EAC_CODEX_AUTH_FILE: resolve(home, "missing.json"), OPENAI_API_KEY: "test-only" },
        home,
      ),
    ).rejects.toThrow("EAC_CODEX_AUTH_FILE does not reference a regular file");
  });
});
