import { px, scenario, sec } from "@eac/core";

// A saved interaction trace. Replaying it reproduces the exact same experience every time.
export default scenario("replay", { duration: sec(6) }, (input) => {
  input.pointerMove(sec(0.6), px(180), px(180));
  input.click(sec(1.2));
  input.expectState(sec(1.5), "armed", true);
  input.expectHover(sec(1.5), "trigger", true);

  input.pointerMove(sec(2.4), px(460), px(180));
  input.expectHover(sec(2.6), "trigger", false);
  input.expectProperty(sec(2.6), "lamp", "opacity", 1);

  input.pointerMove(sec(3.6), px(180), px(180));
  input.click(sec(4.2));
  input.expectState(sec(4.6), "armed", false);
  input.expectProperty(sec(4.6), "lamp", "opacity", 0.15);
});
