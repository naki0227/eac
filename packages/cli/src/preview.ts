import { writeFile } from "node:fs/promises";
import type { ExperienceIR } from "@eac/ir";
import { renderSvg } from "@eac/renderer-svg";

export async function writePreview(experience: ExperienceIR, output: string): Promise<void> {
  const fps = Math.min(experience.fps, 30);
  const frames = Array.from(
    { length: Math.ceil(experience.duration.value * fps) + 1 },
    (_, frame) => renderSvg(experience, Math.min(frame / fps, experience.duration.value)),
  );
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${experience.name} — EaC Preview</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:0;display:grid;place-items:center;min-height:100vh}main{max-width:90vw}#stage svg{max-width:90vw;max-height:75vh;background:#000}nav{display:flex;gap:12px;align-items:center;margin-top:12px}input{flex:1}</style></head><body><main><div id="stage"></div><nav><button id="play">Play</button><input id="time" type="range" min="0" max="${frames.length - 1}" value="0"><output id="label">0.00s</output></nav></main><script>const frames=${JSON.stringify(frames)};const fps=${fps};const stage=document.querySelector('#stage');const time=document.querySelector('#time');const label=document.querySelector('#label');const play=document.querySelector('#play');let timer;function draw(){stage.innerHTML=frames[+time.value];label.value=(+time.value/fps).toFixed(2)+'s'}time.oninput=draw;play.onclick=()=>{if(timer){clearInterval(timer);timer=undefined;play.textContent='Play';return}play.textContent='Pause';timer=setInterval(()=>{time.value=(+time.value+1)%frames.length;draw()},1000/fps)};draw()</script></body></html>`;
  await writeFile(output, html);
}
