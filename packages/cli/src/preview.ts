import { writeFile } from "node:fs/promises";
import type { ExperienceIR } from "@eac/ir";
import { renderSvg } from "@eac/renderer-svg";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

export function previewDocument(experience: ExperienceIR): string {
  const fps = Math.min(experience.fps, 30);
  const times = Array.from({ length: Math.ceil(experience.duration.value * fps) + 1 }, (_, frame) =>
    Math.min(frame / fps, experience.duration.value),
  );
  const frames = times.map((time) => renderSvg(experience, time));
  const title = escapeHtml(experience.name);
  const audioCount = experience.scenes.reduce((total, scene) => total + scene.audioClips.length, 0);
  const audioNotice =
    audioCount === 0
      ? ""
      : `<p role="note">${audioCount} audio clip${audioCount === 1 ? "" : "s"}: HTML preview is silent; audio is muxed during MP4 render.</p>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title} — EaC Preview</title>
<style>body{font:14px system-ui;background:#111;color:#eee;margin:0;display:grid;place-items:center;min-height:100vh}main{width:min(1100px,92vw)}header{display:flex;justify-content:space-between;align-items:baseline}#stage{display:grid;place-items:center;min-height:60vh}#stage svg{max-width:92vw;max-height:72vh;background:#000}nav{display:grid;grid-template-columns:auto auto 1fr auto auto auto;gap:10px;align-items:center;margin-top:12px}input{width:100%}button,select{font:inherit}output{font-variant-numeric:tabular-nums;min-width:12ch;text-align:right}@media(max-width:700px){nav{grid-template-columns:auto auto 1fr auto}select{grid-column:1/3}}</style>
</head><body><main><header><h1>${title}</h1><span>${experience.duration.value.toFixed(3)}s · ${fps}fps preview</span></header>${audioNotice}<div id="stage"></div><nav aria-label="Timeline controls"><button id="play" type="button">Play</button><button id="back" type="button" aria-label="Previous frame">−1f</button><input id="time" aria-label="Seek" type="range" min="0" max="${frames.length - 1}" value="0"><button id="forward" type="button" aria-label="Next frame">+1f</button><select id="speed" aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select><output id="label">0.000s / ${experience.duration.value.toFixed(3)}s</output></nav></main>
<script>const frames=${scriptJson(frames)};const times=${scriptJson(times)};const fps=${fps};const duration=${experience.duration.value};const stage=document.querySelector('#stage');const time=document.querySelector('#time');const label=document.querySelector('#label');const play=document.querySelector('#play');const speed=document.querySelector('#speed');let timer;function draw(){const index=+time.value;stage.innerHTML=frames[index];label.value=times[index].toFixed(3)+'s / '+duration.toFixed(3)+'s'}function stop(){if(timer){clearInterval(timer);timer=undefined}play.textContent='Play'}function step(delta){time.value=Math.max(0,Math.min(frames.length-1,+time.value+delta));draw()}time.oninput=draw;document.querySelector('#back').onclick=()=>{stop();step(-1)};document.querySelector('#forward').onclick=()=>{stop();step(1)};speed.onchange=()=>{if(timer){stop();start()}};function start(){play.textContent='Pause';timer=setInterval(()=>{if(+time.value>=frames.length-1){stop();return}step(1)},1000/(fps*+speed.value))}play.onclick=()=>timer?stop():start();document.onkeydown=(event)=>{if(event.key==='ArrowLeft'){stop();step(-1)}if(event.key==='ArrowRight'){stop();step(1)}if(event.key==='Home'){stop();time.value=0;draw()}if(event.key==='End'){stop();time.value=frames.length-1;draw()}if(event.key===' '){event.preventDefault();timer?stop():start()}};draw()</script></body></html>`;
}

export async function writePreview(experience: ExperienceIR, output: string): Promise<void> {
  await writeFile(output, previewDocument(experience));
}
