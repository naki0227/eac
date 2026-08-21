import { writeFile } from "node:fs/promises";
import type { ExperienceIR, ScenarioIR } from "@eac/ir";
import { renderSvg } from "@eac/renderer-svg";
import { ExperienceSession } from "@eac/runtime";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

type FrameState = Readonly<{
  time: number;
  hover: string | null;
  states: Readonly<Record<string, string>>;
  events: readonly string[];
}>;

/**
 * The preview replays with the same `ExperienceSession` the checker and renderer use. It never
 * re-implements reactive evaluation in the browser: recorded input becomes a scenario file, and the
 * scenario is replayed through the one engine. See the v0.3 specification for the limitation this
 * deliberately accepts.
 */
export function previewDocument(experience: ExperienceIR, scenario?: ScenarioIR): string {
  const fps = Math.min(experience.fps, 30);
  const times = Array.from({ length: Math.ceil(experience.duration.value * fps) + 1 }, (_, frame) =>
    Math.min(frame / fps, experience.duration.value),
  );
  const session = scenario === undefined ? undefined : new ExperienceSession(experience, scenario);
  const frames = times.map((time) => renderSvg(experience, time, session?.overridesAt(time)));
  const replay: readonly FrameState[] =
    session === undefined
      ? []
      : times.map((time) => {
          const result = session.replayTo(time);
          return {
            time,
            hover: result.state.hoverTarget ?? null,
            states: Object.fromEntries(
              Object.entries(result.state.states).map(([name, value]) => [name, String(value)]),
            ),
            events: result.events
              .filter((item) => item.at <= time)
              .slice(-4)
              .map(
                (item) =>
                  `${item.at.toFixed(3)}s ${item.event.name}${item.event.target === undefined ? "" : `(${item.event.target})`}`,
              ),
          };
        });
  const transitions =
    session === undefined
      ? []
      : session
          .replayTo(experience.duration.value)
          .transitions.map(
            (item) =>
              `${item.at.toFixed(3)}s ${item.event}${item.target === undefined ? "" : `(${item.target})`} → ${item.state}: ${String(item.from)} → ${String(item.to)}`,
          );
  const title = escapeHtml(experience.name);
  const audioCount =
    experience.scenes.reduce((total, scene) => total + scene.audioClips.length, 0) +
    experience.scenes.reduce((total, scene) => total + scene.reactive.sounds.length, 0);
  const notices = [
    audioCount === 0
      ? ""
      : `${String(audioCount)} audio clip${audioCount === 1 ? "" : "s"}: HTML preview is silent; audio is muxed during MP4 render.`,
    scenario === undefined
      ? "No scenario loaded. Record an interaction, export it, then re-run eac preview --scenario to replay it."
      : `Replaying scenario ${escapeHtml(scenario.name)} — ${String(scenario.events.length)} input events.`,
  ].filter((line) => line.length > 0);
  const notice = notices.map((line) => `<p role="note">${line}</p>`).join("");
  const canvasWidth = experience.canvas.width.value;
  const canvasHeight = experience.canvas.height.value;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title} — EaC Preview</title>
<style>body{font:14px system-ui;background:#111;color:#eee;margin:0;display:grid;place-items:center;min-height:100vh}main{width:min(1200px,94vw);padding:16px 0}header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}h1{font-size:20px;margin:0}p[role=note]{color:#9ca3af;margin:6px 0}#stage{display:grid;place-items:center;min-height:52vh;touch-action:none}#stage svg{max-width:min(92vw,100%);max-height:64vh;background:#000;cursor:crosshair}nav{display:grid;grid-template-columns:auto auto 1fr auto auto auto;gap:10px;align-items:center;margin-top:12px}input[type=range]{width:100%}button,select{font:inherit;background:#1f2937;color:#eee;border:1px solid #374151;border-radius:6px;padding:4px 10px}button[aria-pressed=true]{background:#b91c1c;border-color:#ef4444}output{font-variant-numeric:tabular-nums;min-width:12ch;text-align:right}#panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:16px}section{background:#171717;border:1px solid #262626;border-radius:8px;padding:10px 12px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin:0 0 6px}pre{margin:0;font:12px ui-monospace,monospace;white-space:pre-wrap;color:#d1d5db;max-height:180px;overflow:auto}@media(max-width:700px){nav{grid-template-columns:auto auto 1fr auto}select{grid-column:1/3}}</style>
</head><body><main>
<header><h1>${title}</h1><span>${experience.duration.value.toFixed(3)}s · ${String(fps)}fps preview</span></header>
${notice}
<div id="stage"></div>
<nav aria-label="Timeline controls"><button id="play" type="button">Play</button><button id="back" type="button" aria-label="Previous frame">−1f</button><input id="time" aria-label="Seek" type="range" min="0" max="${String(frames.length - 1)}" value="0"><button id="forward" type="button" aria-label="Next frame">+1f</button><select id="speed" aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select><output id="label">0.000s / ${experience.duration.value.toFixed(3)}s</output></nav>
<nav aria-label="Recording controls"><button id="record" type="button" aria-pressed="false">Record</button><button id="reset" type="button">Reset</button><button id="export" type="button">Export scenario</button><output id="recorded">0 events recorded</output></nav>
<div id="panels">
<section><h2>State</h2><pre id="states">(none)</pre></section>
<section><h2>Signals</h2><pre id="signals">(none)</pre></section>
<section><h2>Recent events</h2><pre id="events">(none)</pre></section>
<section><h2>State transitions</h2><pre id="transitions">${transitions.length === 0 ? "(none)" : escapeHtml(transitions.join("\n"))}</pre></section>
</div></main>
<script>
const frames=${scriptJson(frames)};const times=${scriptJson(times)};const replay=${scriptJson(replay)};
const fps=${String(fps)};const duration=${String(experience.duration.value)};
const canvas={width:${String(canvasWidth)},height:${String(canvasHeight)}};
const $=(id)=>document.querySelector(id);
const stage=$('#stage'),time=$('#time'),label=$('#label'),play=$('#play'),speed=$('#speed');
const recordButton=$('#record'),recorded=$('#recorded');
let timer,recording=false,events=[],pointer={x:null,y:null,down:false},scroll={x:0,y:0};
const currentTime=()=>times[+time.value];
function svgPoint(event){const svg=stage.querySelector('svg');if(!svg)return null;const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return null;return{x:(event.clientX-rect.left)/rect.width*canvas.width,y:(event.clientY-rect.top)/rect.height*canvas.height}}
function push(kind,payload){if(!recording)return;events.push(Object.assign({at:+currentTime().toFixed(6),order:events.length,kind:kind},payload||{}));recorded.textContent=events.length+' event'+(events.length===1?'':'s')+' recorded'}
function panels(){const index=+time.value;const state=replay[index];
$('#states').textContent=state&&Object.keys(state.states).length?Object.entries(state.states).map(([k,v])=>k+' = '+v).join('\\n'):'(none)';
$('#signals').textContent=['pointer.x = '+(pointer.x===null?'—':pointer.x.toFixed(1)),'pointer.y = '+(pointer.y===null?'—':pointer.y.toFixed(1)),'pointer.down = '+pointer.down,'scroll.x = '+scroll.x,'scroll.y = '+scroll.y,'hover = '+(state&&state.hover?state.hover:'—')].join('\\n');
$('#events').textContent=state&&state.events.length?state.events.join('\\n'):'(none)'}
function draw(){const index=+time.value;stage.innerHTML=frames[index];label.value=times[index].toFixed(3)+'s / '+duration.toFixed(3)+'s';panels()}
function stop(){if(timer){clearInterval(timer);timer=undefined}play.textContent='Play'}
function step(delta){time.value=Math.max(0,Math.min(frames.length-1,+time.value+delta));draw()}
function start(){play.textContent='Pause';timer=setInterval(()=>{if(+time.value>=frames.length-1){stop();return}step(1)},1000/(fps*+speed.value))}
time.oninput=draw;$('#back').onclick=()=>{stop();step(-1)};$('#forward').onclick=()=>{stop();step(1)};
speed.onchange=()=>{if(timer){stop();start()}};play.onclick=()=>timer?stop():start();
stage.addEventListener('pointermove',(event)=>{const point=svgPoint(event);if(!point)return;
if(pointer.x===null||Math.abs(point.x-pointer.x)>=1||Math.abs(point.y-pointer.y)>=1){pointer.x=point.x;pointer.y=point.y;push('pointerMove',{x:+point.x.toFixed(3),y:+point.y.toFixed(3)})}panels()});
stage.addEventListener('pointerdown',(event)=>{const point=svgPoint(event);if(point){pointer.x=point.x;pointer.y=point.y}pointer.down=true;push('pointerDown');panels()});
stage.addEventListener('pointerup',()=>{pointer.down=false;push('pointerUp');panels()});
stage.addEventListener('pointerleave',()=>{pointer.x=null;pointer.y=null;pointer.down=false;push('pointerLeave');panels()});
stage.addEventListener('wheel',(event)=>{event.preventDefault();scroll.x=Math.max(0,scroll.x+event.deltaX);scroll.y=Math.max(0,scroll.y+event.deltaY);push('scroll',{x:+scroll.x.toFixed(3),y:+scroll.y.toFixed(3)});panels()},{passive:false});
recordButton.onclick=()=>{recording=!recording;recordButton.setAttribute('aria-pressed',String(recording));recordButton.textContent=recording?'Stop':'Record'};
$('#reset').onclick=()=>{stop();events=[];recording=false;recordButton.setAttribute('aria-pressed','false');recordButton.textContent='Record';recorded.textContent='0 events recorded';pointer={x:null,y:null,down:false};scroll={x:0,y:0};time.value=0;draw()};
$('#export').onclick=()=>{const scenario={version:'0.3',scenarioVersion:1,name:'recorded',duration:+duration.toFixed(6),events:events,assertions:[]};
const blob=new Blob([JSON.stringify(scenario,null,2)+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob);
const link=document.createElement('a');link.href=url;link.download='recorded.eac-scenario.json';document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url)};
document.onkeydown=(event)=>{if(event.target!==document.body)return;
if(event.key==='ArrowLeft'){stop();step(-1)}if(event.key==='ArrowRight'){stop();step(1)}
if(event.key==='Home'){stop();time.value=0;draw()}if(event.key==='End'){stop();time.value=frames.length-1;draw()}
if(event.key===' '){event.preventDefault();timer?stop():start()}
if(recording&&event.key.length>0&&!['ArrowLeft','ArrowRight','Home','End',' '].includes(event.key))push('keyDown',{code:event.key})};
document.onkeyup=(event)=>{if(recording&&event.key.length>0&&!['ArrowLeft','ArrowRight','Home','End',' '].includes(event.key))push('keyUp',{code:event.key})};
draw()</script></body></html>`;
}

export async function writePreview(
  experience: ExperienceIR,
  output: string,
  scenario?: ScenarioIR,
): Promise<void> {
  await writeFile(output, previewDocument(experience, scenario));
}
