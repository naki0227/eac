// The preview tests assert on the shipped browser bundle, so it must exist before they run.
// Building it here keeps `pnpm test` self-sufficient regardless of whether `pnpm build` ran first.
import { buildPreviewRuntime } from "./build-preview-runtime.mjs";

export default async function setup() {
  await buildPreviewRuntime();
}
