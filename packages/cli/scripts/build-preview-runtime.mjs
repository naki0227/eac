#!/usr/bin/env node
// Bundles the shared semantic runtime for the browser preview.
//
// The bundle contains @eac/runtime, its browser input adapter, and the SVG renderer's pure
// lowering path. It deliberately does NOT contain the Node render pipeline (ffmpeg, resvg,
// workers, filesystem): those live behind @eac/renderer-svg's default entry, and the preview
// imports @eac/renderer-svg/svg instead.
//
// It builds from TypeScript source rather than from `dist`, so `pnpm test` and `pnpm build` can
// each produce it without depending on the other having run first. It lives inside @eac/cli because
// it produces a @eac/cli artifact, and because the benchmark evaluator image copies `packages` but
// not the repository-root `scripts` directory.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { argv, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = (path) => resolve(root, path);

export const PREVIEW_BUNDLE = resolve(root, "packages/cli/dist/preview-runtime/bundle.js");

const BANNED = ["eval(", "new Function", "require(", "node:", "child_process", "worker_threads"];

export async function buildPreviewRuntime() {
  await mkdir(dirname(PREVIEW_BUNDLE), { recursive: true });
  const result = await build({
    entryPoints: [source("packages/cli/src/preview-runtime/entry.ts")],
    outfile: PREVIEW_BUNDLE,
    bundle: true,
    format: "iife",
    globalName: "EaCPreviewRuntime",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    metafile: true,
    alias: {
      "@eac/units": source("packages/units/src/index.ts"),
      "@eac/ir": source("packages/ir/src/index.ts"),
      "@eac/runtime": source("packages/runtime/src/index.ts"),
      "@eac/runtime/browser": source("packages/runtime/src/browser.ts"),
      "@eac/renderer-svg/svg": source("packages/renderer-svg/src/svg.ts"),
    },
  });

  const text = await readFile(PREVIEW_BUNDLE, "utf8");
  for (const banned of BANNED)
    if (text.includes(banned))
      throw new Error(`preview runtime bundle must not contain \`${banned}\``);
  await writeFile(PREVIEW_BUNDLE, text);

  const outputs = result.metafile.outputs;
  const modules = Object.keys(outputs[Object.keys(outputs)[0]].inputs);
  const external = modules.filter((file) => file.includes("node_modules"));
  return { bytes: text.length, modules: modules.length, external };
}

if (import.meta.url === `file://${argv[1]}`) {
  const { bytes, modules, external } = await buildPreviewRuntime();
  stdout.write(
    `Preview runtime bundled: ${(bytes / 1024).toFixed(1)} KiB from ${modules} modules` +
      (external.length > 0
        ? `, external deps: ${external.join(", ")}`
        : ", no external dependencies") +
      "\n",
  );
}
