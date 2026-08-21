import type { ApiDoc } from "./docs.js";

export const assetDocs: readonly ApiDoc[] = [
  {
    name: "image",
    summary: "Creates an image from a safe project-relative PNG, JPEG, or SVG asset.",
    signature: "scene.image(id, { src, position, width, height, fit? })",
    example:
      'scene.image("photo", { src: "assets/photo.png", position, width: px(320), height: px(180), fit: "cover" })',
    keywords: ["image", "asset", "photo", "picture", "png", "jpeg", "svg", "contain", "cover"],
  },
  {
    name: "asset",
    summary: "Creates a validated local asset reference; remote and traversing paths are rejected.",
    signature: "asset(projectRelativePath)",
    example: 'const photo = asset("assets/photo.png")',
    keywords: ["asset", "local", "file", "path", "security", "image"],
  },
];
