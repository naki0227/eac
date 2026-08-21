import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { checkExperience, formatCheckResult } from "@eac/checker";
import { encodeMp4, renderPng, renderPngSequence, renderSvg } from "@eac/renderer-svg";
import * as prettier from "prettier";
import { guide, help } from "./content.js";
import { apiDocs, categorizeDocs, categoryForDoc, formatApiDoc, searchDocs } from "./docs.js";
import { formatInspection, inspectExperience } from "./inspection.js";
import { findProject, loadProject } from "./project.js";
import { writePreview } from "./preview.js";
import { loadScenario, scenarioArgument } from "./scenario-file.js";
import { ExperienceSession } from "@eac/runtime";

const valueAfter = (args: readonly string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const projectArgument = (args: readonly string[]): string | undefined =>
  args.find((arg) => arg.endsWith(".mjs") || arg.endsWith(".json"));

async function formatOptions(path: string): Promise<prettier.Options> {
  return { ...(await prettier.resolveConfig(path)), filepath: path };
}

async function formatIsValid(path: string): Promise<boolean> {
  const source = await readFile(path, "utf8");
  return prettier.check(source, await formatOptions(path));
}

async function formatProject(args: readonly string[]): Promise<number> {
  const project = await findProject(projectArgument(args));
  const source = await readFile(project, "utf8");
  const formatted = await prettier.format(source, await formatOptions(project));
  if (source !== formatted) await writeFile(project, formatted);
  console.log(`${source === formatted ? "Already formatted" : "Formatted"} ${project}`);
  return 0;
}

async function init(): Promise<number> {
  const target = resolve("eac.config.mjs");
  const template = `import { experience, px, sec } from "@eac/core";\n\nconst project = experience({ name: "my-experience", width: px(1280), height: px(720), duration: sec(5) });\nconst scene = project.scene("main");\nscene.circle("dot", { position: { x: px(100), y: px(360) }, radius: px(24), fill: "#7c3aed" });\n\nexport default project;\n`;
  await writeFile(target, template, { flag: "wx" });
  console.log(`Created ${basename(target)}\nNext: eac check`);
  return 0;
}

const optionalScenario = async (args: readonly string[]) => {
  const path = scenarioArgument(args);
  return path === undefined ? undefined : await loadScenario(path);
};

async function inspect(args: readonly string[]): Promise<number> {
  const project = await findProject(projectArgument(args));
  const experience = await loadProject(project);
  const scenario = await optionalScenario(args);
  const result = checkExperience(experience, scenario);
  const inspection = inspectExperience(experience, result, scenario);
  console.log(
    args.includes("--json") ? JSON.stringify(inspection, null, 2) : formatInspection(inspection),
  );
  return result.errors === 0 ? 0 : 1;
}

async function check(args: readonly string[]): Promise<number> {
  const project = await findProject(projectArgument(args));
  const experience = await loadProject(project);
  const scenario = await optionalScenario(args);
  const formatted = await formatIsValid(project);
  if (!formatted)
    console.log(
      `error[eac::format::required]\n\n${project} is not formatted.\n\nWhy:\nConsistent source formatting makes agent edits and reviews deterministic.\n\nPossible fixes:\n- run eac format ${JSON.stringify(project)}\n`,
    );
  const result = checkExperience(experience, scenario);
  console.log(formatCheckResult(result));
  return result.errors === 0 && formatted ? 0 : 1;
}

async function preview(args: readonly string[]): Promise<number> {
  const project = await findProject(projectArgument(args));
  const output = resolve(valueAfter(args, "--output") ?? "preview.html");
  await writePreview(await loadProject(project), output, await optionalScenario(args));
  console.log(`Preview written to ${output}`);
  return 0;
}

async function render(args: readonly string[]): Promise<number> {
  const project = await findProject(projectArgument(args));
  const experience = await loadProject(project);
  const scenario = await optionalScenario(args);
  const frame = valueAfter(args, "--frame");
  if (frame !== undefined) {
    const frameNumber = Number.parseInt(frame, 10);
    const output = resolve(valueAfter(args, "--output") ?? `frame-${frameNumber}.png`);
    const time = frameNumber / experience.fps;
    const overrides =
      scenario === undefined
        ? undefined
        : new ExperienceSession(experience, scenario).overridesAt(time);
    await writeFile(output, renderPng(experience, time, overrides));
    await writeFile(
      output.replace(new RegExp(`${extname(output)}$`), ".svg"),
      renderSvg(experience, time, overrides),
    );
    console.log(`Frame ${frameNumber} written to ${output}`);
    return 0;
  }
  const frames = valueAfter(args, "--frames");
  if (frames !== undefined) {
    const count = await renderPngSequence(experience, resolve(frames));
    console.log(`${count} PNG frames written to ${resolve(frames)}`);
    return 0;
  }
  const output = resolve(valueAfter(args, "--output") ?? "output.mp4");
  const temporary = await mkdtemp(join(tmpdir(), "eac-render-"));
  try {
    await renderPngSequence(experience, temporary, scenario === undefined ? {} : { scenario });
    await encodeMp4(temporary, experience.fps, output, {
      experience,
      ...(scenario === undefined ? {} : { scenario }),
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(`MP4 written to ${output}`);
  return 0;
}

export async function runCli(args: readonly string[]): Promise<number> {
  const [command = "help", ...rest] = args;
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(help);
    return 0;
  }
  if (command === "guide") {
    console.log(guide);
    return 0;
  }
  if (command === "init") return init();
  if (command === "format") return formatProject(rest);
  if (command === "docs") {
    if (rest[0] === "search") {
      const query = rest.slice(1).join(" ");
      const results = searchDocs(query);
      console.log(
        results.length
          ? `Relevant APIs:\n\n${results.map((doc) => `[${categoryForDoc(doc)}] ${doc.name} — ${doc.summary}`).join("\n")}\n\nSee:\n${results.map((doc) => `eac docs ${doc.name}`).join("\n")}`
          : `No APIs matched "${query}". Try a simpler action or object name.`,
      );
      return results.length ? 0 : 1;
    }
    if (rest[0] === undefined) {
      const categories = [...categorizeDocs()]
        .map(
          ([category, docs]) =>
            `${category}:\n${docs.map((doc) => `  ${doc.name} — ${doc.summary}`).join("\n")}`,
        )
        .join("\n\n");
      console.log(`Available APIs:\n\n${categories}\n\nFor details:\neac docs <api>`);
      return 0;
    }
    const topic = rest[0] === "trajectory" && rest[1] !== undefined ? rest[1] : rest[0];
    const doc = apiDocs.find((item) => item.name.toLowerCase() === topic.toLowerCase());
    if (!doc) {
      console.error(`Unknown API \`${topic}\`. Run eac docs search "<what you want to do>".`);
      return 1;
    }
    console.log(formatApiDoc(doc));
    return 0;
  }
  if (command === "inspect") return inspect(rest);
  if (command === "check") return check(rest);
  if (command === "preview") return preview(rest);
  if (command === "render") return render(rest);
  console.error(`Unknown command \`${command}\`. Run eac help.`);
  return 1;
}
