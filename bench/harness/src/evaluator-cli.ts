import { resolve } from "node:path";
import { evaluateProject } from "./evaluation.js";

const project = process.argv[2];
if (project === undefined) throw new Error("Usage: evaluator-cli <eac.config.mjs>");
const result = await evaluateProject(resolve(project));
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.exitCode;
