#!/usr/bin/env node
// Bundles the shared semantic runtime for the browser preview.
//
// The bundle contains @eac/runtime, its browser input adapter, and the SVG renderer's pure
// lowering path. It deliberately does NOT contain the Node render pipeline (ffmpeg, resvg,
// workers, filesystem): those live behind @eac/renderer-svg's default entry, and the preview
// imports @eac/renderer-svg/svg instead.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stdout } from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "packages/cli/dist/preview-runtime/entry.js");
const output = resolve(root, "packages/cli/dist/preview-runtime/bundle.js");

await mkdir(dirname(output), { recursive: true });
const result = await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "iife",
  globalName: "EaCPreviewRuntime",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  logLevel: "warning",
  metafile: true,
});

const bundled = Object.keys(
  result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].inputs,
);
const forbidden = bundled.filter((file) => /node_modules\/(?!\.)/.test(file));
const source = await readFile(output, "utf8");
for (const banned of ["eval(", "new Function", "require(", "node:"]) {
  if (source.includes(banned)) {
    throw new Error(`preview runtime bundle must not contain \`${banned}\``);
  }
}
await writeFile(output, source);
stdout.write(
  `Preview runtime bundled: ${(source.length / 1024).toFixed(1)} KiB from ${bundled.length} modules` +
    (forbidden.length > 0
      ? `, external deps: ${forbidden.join(", ")}`
      : ", no external dependencies"),
);
