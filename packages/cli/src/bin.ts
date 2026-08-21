#!/usr/bin/env node
import { runCli } from "./commands.js";

try {
  process.exitCode = await runCli(process.argv.slice(2));
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.error(`error[eac::cli::failure]\n\n${message}`);
  process.exitCode = 1;
}
