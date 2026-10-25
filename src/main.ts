import { activeChoices, choiceLabel, PROVINCE_FILES, provinceIdsFor } from "./groups.ts";
import { lineLength, scoreDrawing } from "./score.ts";
import { cheer, resultRank } from "./rank.ts";
import { project, WORLD_KM } from "./project.ts";

type Point = [number, number];
type Ring = Point[];
type Poly = Ring[];

interface Unit {
  id: string;
  name: string;
  island: boolean;
  label: Point;
  polygons: Poly[];
  borders: Ring[];
}

interface Frame {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Pack {
  regionId: string;
  regionLabel: string;
  frame: Frame;
  units: Unit[];
}

interface Sheet {
  frame: Frame;
  image: HTMLImageElement;
}

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("map") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;

let pack: Pack | null = null;
let units: Unit[] = [];
let sheets: Sheet[] = [];
let w = 800;
let h = 600;
let dpr = 1;
let view = { x: 0.5, y: 0.4, scale: 8000 };
let fitScale = 8000;
let phase: "idle" | "playing" | "reveal" | "finished" = "idle";
let target: Unit | null = null;
let strokes: Ring[] = [];
let current: Ring | null = null;
let mode: "pen" | "pan" | "erase" = "pen";
let deadline = 0;
let tickHandle = 0;
let showAnswer = false;
let revealUntil = 0;
let busy = false;
let space = false;
const pointers = new Map<number, Point>();
let gesture: { distance: number; world: Point; scale: number } | null = null;
let drag: { id: number; last: Point; pan: boolean } | null = null;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const cosY = (y: number) => 1 / Math.cosh(Math.PI * (1 - 2 * y));

function frameCorners() {
  if (!pack) throw new Error("地図がまだありません");
  const nw = project(pack.frame.west, pack.frame.north);
  const se = project(pack.frame.east, pack.frame.south);
  return { x0: nw[0], y0: nw[1], x1: se[0], y1: se[1] };
}

let sized = false;

function resize() {
  const rect = canvas.getBoundingClientRect();
  w = rect.width;
  h = rect.height;
  if (w < 2 || h < 2) return;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  if (!pack) return;
  if (phase === "reveal" || phase === "finished") fitTarget();
  else if (!sized) {
    fitAll();
    sized = true;
  }
  render();
}

function fitAll() {
  const { x0, y0, x1, y1 } = frameCorners();
  view.x = (x0 + x1) / 2;
  view.y = (y0 + y1) / 2;
  view.scale = Math.min((w - 48) / (x1 - x0), (h - 150) / (y1 - y0));
  fitScale = view.scale;
}

function fitTarget() {
  if (!target) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const line of target.borders) {
    for (const p of line) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
  }
  const pad = 1.45;
  view.x = (x0 + x1) / 2;
  view.y = (y0 + y1) / 2;
  view.scale = clamp(
    Math.min((w - 80) / Math.max(0.002, (x1 - x0) * pad), (h - 160) / Math.max(0.002, (y1 - y0) * pad)),
    700,
    220000,
  );
}

function constrain() {
  const { x0, y0, x1, y1 } = frameCorners();
  view.x = clamp(view.x, x0 - (x1 - x0) * 0.25, x1 + (x1 - x0) * 0.25);
  view.y = clamp(view.y, y0 - (y1 - y0) * 0.25, y1 + (y1 - y0) * 0.25);
}

function worldToScreen(p: Point): Point {
  return [(p[0] - view.x) * view.scale + w / 2, (p[1] - view.y) * view.scale + h / 2];
}

function screenToWorld(p: Point): Point {
  return [(p[0] - w / 2) / view.scale + view.x, (p[1] - h / 2) / view.scale + view.y];
}

function pointerPoint(e: { clientX: number; clientY: number }): Point {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function pointInRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi) inside = !inside;
  }
  return inside;
}

function isLand(p: Point) {
  for (const unit of units) {
    for (const poly of unit.polygons) {
      if (!pointInRing(p[0], p[1], poly[0])) continue;
      let hole = false;
      for (let i = 1; i < poly.length; i++) if (pointInRing(p[0], p[1], poly[i])) hole = true;
      if (!hole) return true;
    }
  }
  return false;
}

function distToSegKm(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = dx * dx + dy * dy;
  const t = denom === 0 ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom, 0, 1);
  const q: Point = [a[0] + t * dx, a[1] + t * dy];
  return Math.hypot(p[0] - q[0], p[1] - q[1]) * WORLD_KM * cosY((p[1] + q[1]) / 2);
}

function isNearCoast(p: Point) {
  for (const unit of units) {
    for (const poly of unit.polygons) {
      const ring = poly[0];
      for (let i = 1; i < ring.length; i++) {
        if (distToSegKm(p, ring[i - 1], ring[i]) < 1.4) return true;
      }
    }
  }
  return false;
}

function onPaper(p: Point) {
  return isLand(p) || isNearCoast(p);
}

function drawLines(lines: Ring[], color: string, width: number, dash: number[] = []) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(dash.map((v) => v / view.scale));
  ctx.strokeStyle = "#fffdf7";
  ctx.lineWidth = (width + 3) / view.scale;
  for (const line of lines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i][0], line[i][1]);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width / view.scale;
  for (const line of lines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i][0], line[i][1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function partialBorder(progress: number) {
  if (!target) return [] as Ring[];
  const total = target.borders.reduce((n, line) => n + Math.max(0, line.length - 1), 0);
  let left = Math.floor(total * progress);
  const out: Ring[] = [];
  for (const line of target.borders) {
    if (left <= 0) break;
    const count = Math.min(line.length, left + 1);
    out.push(line.slice(0, count));
    left -= line.length - 1;
  }
  return out;
}

function drawSheets() {
  const halfW = w / 2 / view.scale;
  const halfH = h / 2 / view.scale;
  const vx0 = view.x - halfW;
  const vx1 = view.x + halfW;
  const vy0 = view.y - halfH;
  const vy1 = view.y + halfH;
  for (const sheet of sheets) {
    const nw = project(sheet.frame.west, sheet.frame.north);
    const se = project(sheet.frame.east, sheet.frame.south);
    if (se[0] < vx0 || nw[0] > vx1 || se[1] < vy0 || nw[1] > vy1) continue;
    ctx.drawImage(sheet.image, nw[0], nw[1], se[0] - nw[0], se[1] - nw[1]);
  }
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#d7e3e4";
  ctx.fillRect(0, 0, w, h);
  if (!pack) return;
  ctx.save();
  ctx.translate(w / 2 - view.x * view.scale, h / 2 - view.y * view.scale);
  ctx.scale(view.scale, view.scale);
  drawSheets();
  const mine = current ? [...strokes, current] : strokes;
  if (mine.length) drawLines(mine, "#d24b3a", 3);
  if (showAnswer && target) {
    const lines = phase === "reveal" ? partialBorder(Math.min(1, (performance.now() - (revealUntil - 1000)) / 1000)) : target.borders;
    drawLines(lines, "#1a6f9a", 4, [8, 6]);
  }
  if (showAnswer) {
    ctx.fillStyle = "#173a3c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${13 / view.scale}px sans-serif`;
    ctx.lineWidth = 4 / view.scale;
    ctx.strokeStyle = "#fffff6";
    for (const unit of units) {
      if (view.scale < fitScale * 1.4 && unit !== target) continue;
      const at = project(unit.label[0], unit.label[1]);
      ctx.strokeText(unit.name, at[0], at[1]);
      ctx.fillText(unit.name, at[0], at[1]);
    }
  }
  ctx.restore();
}

function toast(message: string) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 2400);
}

function sync() {
  $("strokeCount").innerHTML = `${strokes.length}<small>本</small>`;
  $("drawDistance").innerHTML = `${Math.round(strokes.reduce((n, line) => n + lineLength(line), 0))}<small>km</small>`;
  ($("undoBtn") as HTMLButtonElement).disabled = phase !== "playing" || !strokes.length;
  ($("clearBtn") as HTMLButtonElement).disabled = phase !== "playing" || !strokes.length;
  ($("region") as HTMLSelectElement).disabled = phase === "playing" || phase === "reveal";
  const scoreBtn = $("scoreBtn") as HTMLButtonElement;
  scoreBtn.disabled = busy || !pack;
  scoreBtn.textContent =
    phase === "idle" ? "描き始める" : phase === "playing" ? "提出する" : phase === "reveal" ? "採点しています" : "もう一問";
  for (const [id, name] of [
    ["penBtn", "pen"],
    ["panBtn", "pan"],
    ["eraseBtn", "erase"],
  ] as const) {
    $(id).classList.toggle("active", mode === name);
    $(id).setAttribute("aria-pressed", String(mode === name));
  }
  canvas.style.cursor = mode === "pan" ? "grab" : mode === "erase" ? "cell" : "crosshair";
  if (target) {
    try {
      const best = JSON.parse(localStorage.getItem("kabupaten-ou-best") || "{}") as Record<string, number>;
      $("bestScore").textContent = best[target.id] != null ? `${best[target.id].toFixed(1)}%` : "—";
    } catch {
      $("bestScore").textContent = "—";
    }
  }
}

function setMode(next: "pen" | "pan" | "erase") {
  mode = next;
  sync();
}

function zoomAt(factor: number, point: Point = [w / 2, h / 2]) {
  const before = screenToWorld(point);
  view.scale = clamp(view.scale * factor, fitScale * 0.7, 220000);
  const after = screenToWorld(point);
  view.x += before[0] - after[0];
  view.y += before[1] - after[1];
  constrain();
  render();
}

function pickUnit() {
  const key = `kabupaten-ou-history:${pack?.regionId ?? "jawa"}`;
  let history: { seen?: string[]; lastId?: string } = {};
  try {
    history = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    history = {};
  }
  const seen = new Set(history.seen || []);
  let pool = units.filter((unit) => !seen.has(unit.id));
  const reset = pool.length === 0;
  if (reset) pool = units.filter((unit) => unit.id !== history.lastId);
  if (!pool.length) pool = units;
  const unit = pool[Math.floor(Math.random() * pool.length)];
  const nextSeen = reset ? [unit.id] : [...(history.seen || []), unit.id];
  localStorage.setItem(key, JSON.stringify({ seen: nextSeen, lastId: unit.id }));
  return unit;
}

function startRound() {
  if (busy || phase === "playing" || phase === "reveal") return;
  target = pickUnit();
  strokes = [];
  current = null;
  showAnswer = false;
  phase = "playing";
  deadline = performance.now() + 30000;
  $("roundName").textContent = target.name;
  $("roundState").textContent = target.island ? "大きい島の海岸をなぞる" : "この県の陸の境目をなぞる";
  $("result").hidden = true;
  setMode("pen");
  fitAll();
  sync();
  tick();
  render();
}

function clipLand(lines: Ring[]) {
  const kept: Ring[] = [];
  for (const line of lines) {
    let piece: Ring | null = null;
    for (const p of line) {
      if (onPaper(p)) {
        if (!piece) piece = [];
        piece.push(p);
      } else if (piece) {
        if (piece.length > 1) kept.push(piece);
        piece = null;
      }
    }
    if (piece && piece.length > 1) kept.push(piece);
  }
  return kept;
}

function finishRound() {
  if (phase !== "playing" || !target) return;
  phase = "reveal";
  clearTimeout(tickHandle);
  if (current && current.length > 1 && lineLength(current) > 0.015) strokes.push(current);
  current = null;
  busy = true;
  $("timer").textContent = "終了";
  sync();
  const borders = target.borders.map((points) => ({ points }));
  const score = scoreDrawing(clipLand(strokes), borders);
  const rank = resultRank(score.percent, target.name);
  try {
    const best = JSON.parse(localStorage.getItem("kabupaten-ou-best") || "{}") as Record<string, number>;
    best[target.id] = Math.max(best[target.id] || 0, score.percent);
    localStorage.setItem("kabupaten-ou-best", JSON.stringify(best));
  } catch {
    /* 保存できなくても遊べる */
  }
  showAnswer = true;
  revealUntil = performance.now() + 1000;
  fitTarget();
  const step = () => {
    render();
    if (performance.now() < revealUntil) requestAnimationFrame(step);
    else showCard(score.percent, score.points, rank);
  };
  requestAnimationFrame(step);
}

function showCard(percent: number, points: number, rank: ReturnType<typeof resultRank>) {
  phase = "finished";
  busy = false;
  $("result").hidden = false;
  $("resultTitle").textContent = `${target!.name}の採点`;
  $("rankLabel").textContent = rank.title;
  $("rankSymbol").textContent = rank.letter;
  $("rankBadge").dataset.rank = rank.letter;
  $("points").textContent = points.toLocaleString("ja-JP");
  $("resultMessage").textContent = `30秒の県境。一致率 ${percent.toFixed(1)}%。${cheer(percent)}`;
  $("roundState").textContent = "答え合わせ";
  sync();
  render();
}

function tick() {
  clearTimeout(tickHandle);
  if (phase !== "playing") return;
  const left = Math.max(0, (deadline - performance.now()) / 1000);
  const timer = $("timer");
  timer.textContent = `${left.toFixed(1)}秒`;
  timer.classList.toggle("urgent", left <= 5);
  if (left <= 0) {
    finishRound();
    return;
  }
  tickHandle = window.setTimeout(tick, 40);
}

function share() {
  if (!target || phase !== "finished") return;
  const points = $("points").textContent;
  const letter = $("rankSymbol").textContent;
  const title = $("rankLabel").textContent;
  const message = `${target.name}を30秒でなぞった。${points}点（10万点満点）、ランク${letter} ${title}\n#カブパテン王`;
  navigator.clipboard?.writeText(message).then(
    () => toast("結果の文をコピーしました"),
    () => toast(message),
  );
}

function commit() {
  if (current && current.length > 1 && lineLength(current) > 0.015) strokes.push(current);
  current = null;
  sync();
}

function eraseAt(screen: Point) {
  const p = screenToWorld(screen);
  const limit = 18 / view.scale;
  let best = limit;
  let index = -1;
  strokes.forEach((line, n) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const denom = dx * dx + dy * dy || 1;
      const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom, 0, 1);
      const dist = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
      if (dist < best) {
        best = dist;
        index = n;
      }
    }
  });
  if (index >= 0) {
    strokes.splice(index, 1);
    sync();
    render();
  }
}

canvas.addEventListener("pointerdown", (e) => {
  if (!pack || e.button > 0) return;
  if (phase === "playing" && performance.now() >= deadline) {
    finishRound();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  const p = pointerPoint(e);
  pointers.set(e.pointerId, p);
  if (pointers.size >= 2) {
    const pts = [...pointers.values()];
    const mid: Point = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    gesture = {
      distance: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
      world: screenToWorld(mid),
      scale: view.scale,
    };
    current = null;
    drag = null;
    return;
  }
  const world = screenToWorld(p);
  const pan = phase !== "playing" || mode === "pan" || space || (mode === "pen" && !onPaper(world));
  drag = { id: e.pointerId, last: p, pan };
  if (!pan && mode === "erase" && phase === "playing") eraseAt(p);
  else if (!pan && phase === "playing") current = [world];
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = pointerPoint(e);
  pointers.set(e.pointerId, p);
  if (pointers.size >= 2 && gesture) {
    const pts = [...pointers.values()];
    const mid: Point = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    const dist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
    view.scale = clamp((gesture.scale * dist) / Math.max(1, gesture.distance), fitScale * 0.7, 220000);
    view.x = gesture.world[0] - (mid[0] - w / 2) / view.scale;
    view.y = gesture.world[1] - (mid[1] - h / 2) / view.scale;
    constrain();
    render();
    return;
  }
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.pan) {
    view.x -= (p[0] - drag.last[0]) / view.scale;
    view.y -= (p[1] - drag.last[1]) / view.scale;
    constrain();
    render();
  } else if (mode === "erase" && phase === "playing") eraseAt(p);
  else if (current && phase === "playing") {
    const world = screenToWorld(p);
    const last = current.at(-1)!;
    if (Math.hypot(world[0] - last[0], world[1] - last[1]) * view.scale > 0.8 && current.length < 20000) current.push(world);
    render();
  }
  drag.last = p;
});

function release(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) gesture = null;
  if (drag?.id === e.pointerId) {
    if (!drag.pan) commit();
    drag = null;
    render();
  }
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}

canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (pack) zoomAt(Math.exp(-e.deltaY * 0.0015), pointerPoint(e));
  },
  { passive: false },
);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

$("scoreBtn").onclick = () => {
  if (phase === "playing") finishRound();
  else startRound();
};
$("againBtn").onclick = () => startRound();
$("shareBtn").onclick = () => share();
$("penBtn").onclick = () => setMode("pen");
$("panBtn").onclick = () => setMode("pan");
$("eraseBtn").onclick = () => setMode("erase");
$("undoBtn").onclick = () => {
  if (phase !== "playing") return;
  strokes.pop();
  sync();
  render();
};
$("clearBtn").onclick = () => {
  if (phase !== "playing") return;
  strokes = [];
  current = null;
  sync();
  render();
};
$("zoomIn").onclick = () => zoomAt(1.6);
$("zoomOut").onclick = () => zoomAt(1 / 1.6);
$("fitBtn").onclick = () => {
  fitAll();
  render();
};
$("helpBtn").onclick = () => ($("helpDialog") as HTMLDialogElement).showModal();
$("closeHelp").onclick = () => ($("helpDialog") as HTMLDialogElement).close();

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.code === "Space") {
    e.preventDefault();
    space = true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (phase === "playing") {
      strokes.pop();
      sync();
      render();
    }
  }
  if (e.key === "+" || e.key === "=") zoomAt(1.5);
  if (e.key === "-") zoomAt(1 / 1.5);
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") space = false;
});

function toWorldUnit(raw: {
  id: string;
  name: string;
  island: boolean;
  label: [number, number];
  polygons: number[][][][];
  borders: number[][][];
}): Unit {
  return {
    id: raw.id,
    name: raw.name,
    island: raw.island,
    label: raw.label,
    polygons: raw.polygons.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => project(lon, lat)))),
    borders: raw.borders.map((ring) => ring.map(([lon, lat]) => project(lon, lat))),
  };
}

let loadToken = 0;
let watching = false;

function resetRound() {
  phase = "idle";
  target = null;
  strokes = [];
  current = null;
  showAnswer = false;
  $("result").hidden = true;
  $("roundName").textContent = "";
  $("roundState").textContent = "スタートでお題を抽選";
  $("timer").textContent = "30秒";
  $("timer").classList.remove("urgent");
}

function unionFrame(frames: Frame[]): Frame {
  return {
    west: Math.min(...frames.map((frame) => frame.west)),
    south: Math.min(...frames.map((frame) => frame.south)),
    east: Math.max(...frames.map((frame) => frame.east)),
    north: Math.max(...frames.map((frame) => frame.north)),
  };
}

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("地形図を読み込めませんでした"));
    next.src = src;
  });
}

function fillRegionSelect() {
  const select = $("region") as HTMLSelectElement;
  const previous = select.value;
  const choices = activeChoices();
  select.replaceChildren(
    ...choices.map((choice) => {
      const option = document.createElement("option");
      option.value = choice.id;
      option.textContent = choice.label;
      return option;
    }),
  );
  select.value = choices.some((choice) => choice.id === previous) ? previous : choices[0].id;
}

async function loadChoice(id: string) {
  const ids = provinceIdsFor(id);
  const label = choiceLabel(id);
  const token = ++loadToken;
  const loading = $("loading");
  loading.classList.remove("hidden");
  loading.innerHTML = "<b>地図を読み込んでいます</b>";
  const parts = await Promise.all(
    ids.map(async (provinceId) => {
      const file = PROVINCE_FILES[provinceId];
      if (!file) throw new Error("その地方はまだありません");
      const response = await fetch(assetUrl(`data/dist/${file}`));
      if (!response.ok) throw new Error("地図データがありません");
      const raw = (await response.json()) as {
        frame: Frame;
        image: string;
        units: Parameters<typeof toWorldUnit>[0][];
      };
      const image = await loadImage(assetUrl(`data/dist/${raw.image}`));
      return { raw, image };
    }),
  );
  if (token !== loadToken) return;
  units = parts.flatMap((part) => part.raw.units.map(toWorldUnit));
  sheets = parts.map((part) => ({ frame: part.raw.frame, image: part.image }));
  pack = {
    regionId: id,
    regionLabel: label,
    frame: unionFrame(sheets.map((sheet) => sheet.frame)),
    units,
  };
  canvas.setAttribute("aria-label", `${label}の色別標高図。陸をドラッグすると県境を描けます。`);
  resetRound();
  sized = false;
  loading.classList.add("hidden");
  if (!watching) {
    watching = true;
    new ResizeObserver(resize).observe(canvas);
  }
  resize();
  sync();
}

$("region").addEventListener("change", () => {
  const select = $("region") as HTMLSelectElement;
  if (phase === "playing" || phase === "reveal") {
    if (pack) select.value = pack.regionId;
    return;
  }
  loadChoice(select.value).catch((error: Error) => {
    $("loading").classList.remove("hidden");
    $("loading").textContent = error.message;
  });
});

fillRegionSelect();
loadChoice((($("region") as HTMLSelectElement).value) || "jawa").catch((error: Error) => {
  $("loading").textContent = error.message;
});
