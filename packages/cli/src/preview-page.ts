/**
 * The preview page script. It is a *driver*, not an evaluator: every semantic decision — hit target,
 * pressed target, whether a click happened, state transitions, reactive values — is made by the
 * shared `LiveSession`/`ExperienceSession` from `@eac/runtime`. DOM events are input only.
 */
export const previewScript = String.raw`
(function () {
  var R = EaCPreviewRuntime;
  var experience = R.reviveExperience(EAC_EXPERIENCE);
  var replayScenario = R.reviveScenario(EAC_SCENARIO);
  var canvas = { width: experience.canvas.width.value, height: experience.canvas.height.value };
  var fps = experience.fps > 0 ? experience.fps : 1;
  var lastFrame = Math.max(0, Math.floor(experience.duration.value * fps + 1e-9));

  var live = new R.LiveSession(experience, { name: "recorded" });
  var coalescer = new R.PointerCoalescer(1);
  var mode = "live";
  var replaySession = null;
  var recording = false;
  var recordedScenario = null;
  var playing = false;
  var rafHandle = 0;
  var lastPaint = 0;
  var scroll = { x: 0, y: 0 };
  var pointerInside = false;

  var $ = function (id) { return document.querySelector(id); };
  var stage = $("#stage"), scrubber = $("#time"), label = $("#label");
  var playButton = $("#play"), recordButton = $("#record"), modeLabel = $("#mode");

  function frameCount() { return lastFrame; }

  function currentFrame() { return Number(scrubber.value); }

  // Semantic time is derived from the frame index, never from a wall clock.
  function semanticTime(frame) { return frame / fps; }

  function activeResult() {
    if (mode === "live") return { state: live.state, events: live.result.events };
    var time = semanticTime(currentFrame());
    var result = replaySession.replayTo(time);
    return { state: result.state, events: result.events };
  }

  function overridesForFrame() {
    if (mode === "live") return live.overrides();
    return replaySession.overridesAt(semanticTime(currentFrame()));
  }

  function draw() {
    var frame = currentFrame();
    var time = semanticTime(frame);
    stage.innerHTML = R.renderSvg(experience, time, overridesForFrame());
    label.value = time.toFixed(3) + "s / " + experience.duration.value.toFixed(3) + "s";
    panels(frame, time);
  }

  function panels(frame, time) {
    var snapshot = activeResult();
    var state = snapshot.state;
    var entries = Object.keys(state.states).map(function (name) {
      return name + " = " + String(state.states[name]);
    });
    $("#states").textContent = entries.length ? entries.join("\n") : "(none)";
    $("#signals").textContent = [
      "pointer.x = " + (state.pointer.present ? state.pointer.x.toFixed(1) : "—"),
      "pointer.y = " + (state.pointer.present ? state.pointer.y.toFixed(1) : "—"),
      "pointer.down = " + String(state.pointer.down),
      "pointer.present = " + String(state.pointer.present),
      "scroll.x = " + state.scroll.x,
      "scroll.y = " + state.scroll.y,
      "keys = " + (state.keys.length ? state.keys.join(", ") : "—"),
    ].join("\n");
    $("#targets").textContent = [
      "frame = " + frame + " / " + frameCount(),
      "time = " + time.toFixed(3) + "s",
      "hover = " + (state.hoverTarget || "—"),
      "pressed = " + (state.pressedTarget || "—"),
    ].join("\n");
    var recent = snapshot.events.slice(-6).map(function (item) {
      return item.at.toFixed(3) + "s " + item.event.name + (item.event.target ? "(" + item.event.target + ")" : "");
    });
    $("#events").textContent = recent.length ? recent.join("\n") : "(none)";
    var source = mode === "live" ? live.result : replaySession.replayTo(semanticTime(frameCount()));
    var moves = source.transitions.map(function (item) {
      return item.at.toFixed(3) + "s " + item.event + (item.target ? "(" + item.target + ")" : "") +
        " → " + item.state + ": " + String(item.from) + " → " + String(item.to);
    });
    $("#transitions").textContent = moves.length ? moves.join("\n") : "(none)";
    $("#recorded").textContent = recording
      ? live.scenario().events.length + " events recording"
      : recordedScenario
        ? recordedScenario.events.length + " events recorded"
        : "not recording";
  }

  function setMode(next, scenario) {
    mode = next;
    if (next === "replay") {
      replaySession = new R.ExperienceSession(experience, scenario);
      modeLabel.textContent = "Replay: " + scenario.name;
    } else {
      modeLabel.textContent = "Live";
    }
    draw();
  }

  // One normalized stream feeds the live session and the recording; they cannot diverge.
  function send(payload) {
    if (mode !== "live") return;
    live.queue(payload);
    if (!playing) commit(currentFrame());
  }

  function commit(frame) {
    live.advanceTo(frame);
    scrubber.value = String(live.frame);
    draw();
  }

  function pointFrom(event) {
    // The drawn SVG is the letterboxed element, so prefer its rect — but only once it has been laid
    // out. A zero-sized rect would otherwise swallow every pointer input.
    var rect = stage.getBoundingClientRect();
    var element = stage.querySelector("svg");
    if (element) {
      var inner = element.getBoundingClientRect();
      if (inner.width > 0 && inner.height > 0) rect = inner;
    }
    return R.toScenePoint(
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      canvas,
      event.clientX,
      event.clientY,
    );
  }

  stage.addEventListener("pointermove", function (event) {
    var point = pointFrom(event);
    if (!point || !R.isInsideCanvas(point, canvas)) return;
    pointerInside = true;
    if (coalescer.accept(point)) send(R.pointerMove(point));
  });
  stage.addEventListener("pointerdown", function (event) {
    var point = pointFrom(event);
    if (point && R.isInsideCanvas(point, canvas)) {
      if (coalescer.accept(point)) send(R.pointerMove(point));
      send(R.pointerDown());
    }
  });
  stage.addEventListener("pointerup", function () { if (pointerInside) send(R.pointerUp()); });
  stage.addEventListener("pointerleave", function () {
    if (!pointerInside) return;
    pointerInside = false;
    coalescer.reset();
    send(R.pointerLeave());
  });
  stage.addEventListener("wheel", function (event) {
    event.preventDefault();
    scroll.x = Math.max(0, scroll.x + event.deltaX);
    scroll.y = Math.max(0, scroll.y + event.deltaY);
    send(R.scrollTo(scroll.x, scroll.y));
  }, { passive: false });

  var RESERVED = ["ArrowLeft", "ArrowRight", "Home", "End", "Space"];
  document.addEventListener("keydown", function (event) {
    var code = R.normalizeKey(event);
    if (!code) return;
    if (RESERVED.indexOf(code) >= 0 && !event.shiftKey) return;
    if (event.repeat) return;
    send(R.keyDown(code));
  });
  document.addEventListener("keyup", function (event) {
    var code = R.normalizeKey(event);
    if (!code) return;
    if (RESERVED.indexOf(code) >= 0 && !event.shiftKey) return;
    send(R.keyUp(code));
  });

  function stop() {
    playing = false;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = 0; }
    playButton.textContent = "Play";
  }

  function start() {
    if (playing) return;
    playing = true;
    playButton.textContent = "Pause";
    lastPaint = 0;
    var tick = function (now) {
      if (!playing) return;
      // Wall clock decides *when* to paint; the frame index decides *what* is painted.
      if (lastPaint === 0 || now - lastPaint >= 1000 / fps) {
        lastPaint = now;
        var next = currentFrame() + 1;
        if (next > frameCount()) { stop(); return; }
        if (mode === "live") commit(next);
        else { scrubber.value = String(next); draw(); }
      }
      rafHandle = requestAnimationFrame(tick);
    };
    rafHandle = requestAnimationFrame(tick);
  }

  function seek(frame) {
    var target = Math.max(0, Math.min(frameCount(), frame));
    scrubber.value = String(target);
    if (mode === "live") live.advanceTo(target);
    draw();
  }

  playButton.onclick = function () { playing ? stop() : start(); };
  $("#back").onclick = function () { stop(); seek(currentFrame() - 1); };
  $("#forward").onclick = function () { stop(); seek(currentFrame() + 1); };
  scrubber.oninput = function () { stop(); seek(currentFrame()); };

  $("#reset").onclick = function () {
    stop();
    recording = false;
    recordedScenario = null;
    scroll = { x: 0, y: 0 };
    pointerInside = false;
    coalescer.reset();
    live.reset();
    recordButton.setAttribute("aria-pressed", "false");
    recordButton.textContent = "Record";
    scrubber.value = "0";
    setMode("live");
  };

  recordButton.onclick = function () {
    if (!recording) {
      live.reset();
      coalescer.reset();
      scroll = { x: 0, y: 0 };
      scrubber.value = "0";
      recording = true;
      recordedScenario = null;
      recordButton.setAttribute("aria-pressed", "true");
      recordButton.textContent = "Stop";
      setMode("live");
      start();
      return;
    }
    stop();
    recording = false;
    recordedScenario = live.scenario();
    recordButton.setAttribute("aria-pressed", "false");
    recordButton.textContent = "Record";
    draw();
  };

  $("#replay").onclick = function () {
    var scenario = recordedScenario || (recording ? live.scenario() : null) || replayScenario;
    if (!scenario) return;
    stop();
    scrubber.value = "0";
    setMode("replay", scenario);
    start();
  };

  $("#golive").onclick = function () { stop(); setMode("live"); seek(live.frame); };

  $("#export").onclick = function () {
    var scenario = recordedScenario || live.scenario();
    var blob = new Blob([R.scenarioToJson(scenario)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = scenario.name + ".eac-scenario.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  document.addEventListener("keydown", function (event) {
    if (event.target !== document.body) return;
    if (event.code === "ArrowLeft") { stop(); seek(currentFrame() - 1); }
    if (event.code === "ArrowRight") { stop(); seek(currentFrame() + 1); }
    if (event.code === "Home") { stop(); seek(0); }
    if (event.code === "End") { stop(); seek(frameCount()); }
    if (event.code === "Space") { event.preventDefault(); playing ? stop() : start(); }
  });

  if (replayScenario) setMode("replay", replayScenario);
  else setMode("live");
  window.__eacPreview = {
    live: live,
    send: send,
    commit: commit,
    seek: seek,
    draw: draw,
    scenario: function () { return recordedScenario || live.scenario(); },
    mode: function () { return mode; },
    state: function () { return activeResult().state; },
  };
})();
`;
