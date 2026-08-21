import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExperienceIR, ScenarioIR } from "@eac/ir";
import { previewScript } from "./preview-page.js";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Embeds IR as JSON data inside a script block. Every sequence that could close the block or start a
 * comment is escaped, so a node id, text string, or asset path cannot break out into executable
 * context. The page never evaluates project source: the runtime is a prebuilt trusted bundle.
 */
const embedJson = (value: unknown): string =>
  JSON.stringify(value ?? null)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");

/**
 * The bundle sits beside the compiled module in `dist`. Tests import this file from `src`, so both
 * layouts are tried rather than assuming one.
 */
const bundleCandidates = (): readonly string[] => {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    join(here, "preview-runtime", "bundle.js"),
    join(here, "..", "dist", "preview-runtime", "bundle.js"),
  ];
};

export async function previewRuntimeBundle(): Promise<string> {
  for (const candidate of bundleCandidates()) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      /* try the next layout */
    }
  }
  throw new Error(
    "Preview runtime bundle is missing. Run `pnpm build` to produce packages/cli/dist/preview-runtime/bundle.js.",
  );
}

const STYLE =
  "body{font:14px system-ui;background:#111;color:#eee;margin:0;display:grid;place-items:center;min-height:100vh}" +
  "main{width:min(1200px,94vw);padding:16px 0}header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}" +
  "h1{font-size:20px;margin:0}p[role=note]{color:#9ca3af;margin:6px 0}" +
  "#stage{display:grid;place-items:center;min-height:52vh;touch-action:none}" +
  "#stage svg{max-width:min(92vw,100%);max-height:64vh;background:#000;cursor:crosshair;user-select:none}" +
  "nav{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}" +
  "input[type=range]{flex:1 1 240px}button{font:inherit;background:#1f2937;color:#eee;border:1px solid #374151;border-radius:6px;padding:4px 10px;cursor:pointer}" +
  "button[aria-pressed=true]{background:#b91c1c;border-color:#ef4444}" +
  "#mode{font-weight:600;color:#38bdf8}output{font-variant-numeric:tabular-nums}" +
  "#panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:16px}" +
  "section{background:#171717;border:1px solid #262626;border-radius:8px;padding:10px 12px}" +
  "h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin:0 0 6px}" +
  "pre{margin:0;font:12px ui-monospace,monospace;white-space:pre-wrap;color:#d1d5db;max-height:170px;overflow:auto}";

export function previewDocument(
  experience: ExperienceIR,
  runtime: string,
  scenario?: ScenarioIR,
): string {
  const title = escapeHtml(experience.name);
  const audioCount = experience.scenes.reduce(
    (total, scene) => total + scene.audioClips.length + scene.reactive.sounds.length,
    0,
  );
  const notes = [
    "Live: pointer, keyboard, and wheel input drive the same EaC runtime the checker and renderer use.",
    audioCount === 0
      ? ""
      : `${String(audioCount)} audio clip${audioCount === 1 ? "" : "s"}: preview is silent; playSound actions still appear in the transition history and are muxed by eac render.`,
  ].filter((line) => line.length > 0);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title} — EaC Preview</title>
<style>${STYLE}</style>
</head><body><main>
<header><h1>${title}</h1><span>${experience.duration.value.toFixed(3)}s · ${String(experience.fps)}fps · <span id="mode">Live</span></span></header>
${notes.map((line) => `<p role="note">${escapeHtml(line)}</p>`).join("")}
<div id="stage"></div>
<nav aria-label="Timeline controls"><button id="play" type="button">Play</button><button id="back" type="button" aria-label="Previous frame">−1f</button><input id="time" aria-label="Seek" type="range" min="0" max="${String(Math.max(0, Math.floor(experience.duration.value * experience.fps + 1e-9)))}" value="0" step="1"><button id="forward" type="button" aria-label="Next frame">+1f</button><output id="label">0.000s / ${experience.duration.value.toFixed(3)}s</output></nav>
<nav aria-label="Session controls"><button id="record" type="button" aria-pressed="false">Record</button><button id="replay" type="button">Replay recording</button><button id="golive" type="button">Go live</button><button id="reset" type="button">Reset</button><button id="export" type="button">Export scenario</button><output id="recorded">not recording</output></nav>
<div id="panels">
<section><h2>Timeline</h2><pre id="targets">(none)</pre></section>
<section><h2>State</h2><pre id="states">(none)</pre></section>
<section><h2>Signals</h2><pre id="signals">(none)</pre></section>
<section><h2>Latest events</h2><pre id="events">(none)</pre></section>
<section><h2>State transitions</h2><pre id="transitions">(none)</pre></section>
</div></main>
<script>${runtime}</script>
<script>var EAC_EXPERIENCE=${embedJson(experience)};var EAC_SCENARIO=${embedJson(scenario)};</script>
<script>${previewScript}</script>
</body></html>`;
}

export async function writePreview(
  experience: ExperienceIR,
  output: string,
  scenario?: ScenarioIR,
): Promise<void> {
  const runtime = await previewRuntimeBundle();
  await writeFile(output, previewDocument(experience, runtime, scenario));
}
