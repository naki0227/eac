import { experience, px, sec } from "@eac/core";
import { describe, expect, it } from "vitest";
import { previewDocument } from "./preview.js";

describe("preview document", () => {
  it("ships the controls, panels, and safely embedded IR the live runtime needs", () => {
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

    const html = previewDocument(project.build(), "/* runtime */");

    for (const control of [
      "play",
      "back",
      "forward",
      "time",
      "record",
      "replay",
      "golive",
      "reset",
      "export",
    ])
      expect(html).toContain(`id="${control}"`);
    for (const panel of ["targets", "states", "signals", "events", "transitions"])
      expect(html).toContain(`id="${panel}"`);
    expect(html).toContain("0.000s / 1.000s");
    expect(html).toContain("preview is silent");
    expect(html).toContain("playSound actions still appear in the transition history");
    expect(html).not.toContain('<script id="unsafe">');
    expect(html).not.toContain("</script></title>");
    expect(html).toContain("\\u003c/script\\u003e");
  });

  it("embeds a scenario when one is supplied and null when one is not", () => {
    const project = experience({
      name: "plain",
      width: px(100),
      height: px(100),
      duration: sec(1),
      fps: 10,
    });
    project.scene("main").rect("box", {
      position: { x: px(50), y: px(50) },
      width: px(10),
      height: px(10),
      fill: "white",
    });

    expect(previewDocument(project.build(), "/* runtime */")).toContain("var EAC_SCENARIO=null;");
  });
});
