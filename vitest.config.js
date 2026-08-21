import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@eac/units": source("./packages/units/src/index.ts"),
      "@eac/ir": source("./packages/ir/src/index.ts"),
      "@eac/core": source("./packages/core/src/index.ts"),
      "@eac/checker": source("./packages/checker/src/index.ts"),
      "@eac/renderer-svg": source("./packages/renderer-svg/src/index.ts"),
    },
  },
});
