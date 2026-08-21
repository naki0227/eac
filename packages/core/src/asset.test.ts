import { describe, expect, it } from "vitest";
import { asset, experience, px, sec } from "./index.js";

describe("local image assets", () => {
  it("creates an image node with a normalized project-relative reference", () => {
    const project = experience({
      name: "image",
      width: px(200),
      height: px(100),
      duration: sec(1),
    });
    const image = project.scene("main").image("photo", {
      src: "assets\\photo.png",
      position: { x: px(100), y: px(50) },
      width: px(120),
      height: px(80),
      fit: "cover",
    });

    expect(image.ir.geometry).toEqual(
      expect.objectContaining({
        kind: "image",
        asset: { kind: "local", path: "assets/photo.png" },
        fit: "cover",
      }),
    );
  });

  it("rejects remote, absolute, empty, and traversing references early", () => {
    for (const path of ["", "https://example.com/a.png", "/tmp/a.png", "../a.png", "C:\\a.png"])
      expect(() => asset(path)).toThrow("project-relative");
  });
});
