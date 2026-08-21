import { walkNodes, type ExperienceIR } from "@eac/ir";
import { error, type Diagnostic } from "./diagnostic.js";

export function runAssetRules(experience: ExperienceIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const scene of experience.scenes)
    for (const { node } of walkNodes(scene.nodes)) {
      if (node.kind !== "object" || node.geometry.kind !== "image") continue;
      const asset = node.geometry.asset;
      if (asset.kind === "local")
        diagnostics.push(
          error(
            "eac::asset::unresolved",
            `Image \`${node.id}\` has an unresolved local asset.`,
            `${scene.id}.${node.id}.asset (${asset.path})`,
            "Local assets must be resolved relative to the project before checking or rendering.",
            ["run the project through the eac CLI", "verify the asset path is project-relative"],
          ),
        );
      else if (asset.kind === "invalid")
        diagnostics.push(
          error(
            `eac::asset::${asset.reason}`,
            `Image \`${node.id}\` could not load \`${asset.path}\`.`,
            `${scene.id}.${node.id}.asset`,
            asset.detail,
            ["use a readable local PNG, JPEG, or safe SVG", "keep the asset inside the project"],
          ),
        );
      else if (
        !["image/png", "image/jpeg", "image/svg+xml"].includes(asset.mimeType) ||
        asset.data.length === 0
      )
        diagnostics.push(
          error(
            "eac::asset::unsupported-format",
            `Image \`${node.id}\` has invalid embedded asset data.`,
            `${scene.id}.${node.id}.asset`,
            "Embedded image data must use a supported MIME type and non-empty base64 payload.",
            ["resolve the original local asset again"],
          ),
        );
      else if (
        !Number.isFinite(asset.intrinsicWidth) ||
        !Number.isFinite(asset.intrinsicHeight) ||
        asset.intrinsicWidth <= 0 ||
        asset.intrinsicHeight <= 0
      )
        diagnostics.push(
          error(
            "eac::asset::invalid-dimensions",
            `Image \`${node.id}\` has invalid intrinsic dimensions.`,
            `${scene.id}.${node.id}.asset`,
            "Decoded image dimensions must be positive and finite.",
            ["replace or repair the source image"],
          ),
        );
    }
  return diagnostics;
}
