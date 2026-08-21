import { px, scenario, sec } from "@eac/core";

// The canonical trace: hover, click, scroll, and settle. Rendering it produces the demo video.
export default scenario("showcase", { duration: sec(8) }, (input) => {
  input.pointerMove(sec(1.2), px(160), px(200));
  input.expectHover(sec(1.4), "badge", true);

  input.pointerMove(sec(2.2), px(360), px(200));
  input.expectHover(sec(2.4), "toggle", true);

  input.click(sec(3));
  input.expectState(sec(3.3), "detail", true);
  input.expectProperty(sec(3.3), "detail", "opacity", 1);

  input.scrollTo(sec(4.2), px(0), px(120));
  input.scrollTo(sec(4.8), px(0), px(240));
  input.expectProperty(sec(5), "toggle", "y", 170, 0.001);

  input.scrollTo(sec(5.6), px(0), px(0));
  input.click(sec(6.4));
  input.expectState(sec(6.8), "detail", false);
  input.expectProperty(sec(6.8), "detail", "opacity", 0);
});
