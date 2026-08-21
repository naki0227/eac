import { experience, px, sec } from "@eac/core";
import { describe, expect, it } from "vitest";
import { previewDocument } from "./preview.js";

describe("preview document", () => {
  it("provides seek, stepping, speed, time, and safe embedded content", () => {
    const project = experience({
      name: '</title><script id="unsafe">',
      width: px(100),
      height: px(100),
      duration: sec(1),
      fps: 10,
    });
    project.scene("main").text("title", "</script>", {
      position: { x: px(10), y: px(10) },
      fontSize: px(12),
      fill: "white",
    });
    project.scene("sound").audio("assets/sting.wav", { at: sec(0.25), duration: sec(0.5) });

    const html = previewDocument(project.build());

    expect(html).toContain('id="back"');
    expect(html).toContain('id="forward"');
    expect(html).toContain('id="speed"');
    expect(html).toContain("0.000s / 1.000s");
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("HTML preview is silent; audio is muxed during MP4 render.");
    expect(html).not.toContain('<script id="unsafe">');
    expect(html).not.toContain('const frames=["<');
  });
});
