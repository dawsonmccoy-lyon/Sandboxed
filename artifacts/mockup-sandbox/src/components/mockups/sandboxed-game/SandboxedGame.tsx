import { useCallback, useEffect, useRef, useState } from "react";

type MaterialName = "Stone" | "Sand" | "Water" | "Steam" | "Wood" | "Fire";
type Material = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type World = {
  cells: Uint8Array;
  heat: Float32Array;
  burn: Uint8Array;
  moved: Uint8Array;
};

const COLS = 180;
const ROWS = 104;
const TOTAL = COLS * ROWS;

const MATERIALS: {
  name: MaterialName;
  id: Material;
  key: string;
  descriptor: string;
  tone: string;
}[] = [
  { name: "Stone", id: 1, key: "1", descriptor: "solid", tone: "#85898b" },
  { name: "Sand", id: 2, key: "2", descriptor: "powder", tone: "#c4c0b4" },
  { name: "Water", id: 3, key: "3", descriptor: "liquid", tone: "#aab4b9" },
  { name: "Steam", id: 4, key: "4", descriptor: "gas", tone: "#e0e1df" },
  { name: "Wood", id: 5, key: "5", descriptor: "reactive", tone: "#73736f" },
  { name: "Fire", id: 6, key: "6", descriptor: "heat", tone: "#f0eee8" },
];

const COLORS: Record<number, [number, number, number]> = {
  0: [5, 6, 7],
  1: [119, 124, 126],
  2: [183, 178, 165],
  3: [128, 141, 148],
  4: [205, 207, 205],
  5: [91, 91, 87],
  6: [238, 237, 230],
  7: [104, 103, 98],
};

function indexAt(x: number, y: number): number {
  return y * COLS + x;
}

function swap(world: World, from: number, to: number): void {
  world.cells[to] = world.cells[from];
  world.heat[to] = world.heat[from];
  world.burn[to] = world.burn[from];
  world.cells[from] = 0;
  world.heat[from] = 0;
  world.burn[from] = 0;
  world.moved[to] = 1;
}

function fillCircle(world: World, cx: number, cy: number, radius: number, material: Material): void {
  const r = Math.max(1, radius);
  for (let y = Math.max(0, cy - r); y <= Math.min(ROWS - 1, cy + r); y += 1) {
    for (let x = Math.max(0, cx - r); x <= Math.min(COLS - 1, cx + r); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const insideBrush = dx * dx + dy * dy <= r * r;
      const depositPixel = material === 0 || Math.random() > 0.12;
      if (insideBrush && depositPixel) {
        const i = indexAt(x, y);
        world.cells[i] = material;
        world.heat[i] = material === 6 ? 1 : 0;
        world.burn[i] = material === 6 ? 90 : 0;
      }
    }
  }
}

function seedWorld(world: World): void {
  // A few quiet samples give a new bench some motion without taking over the canvas.
  for (let x = 12; x < 169; x += 1) {
    world.cells[indexAt(x, 96)] = 1;
    world.cells[indexAt(x, 97)] = 1;
  }
  for (let x = 31; x < 52; x += 1) {
    const height = Math.max(1, Math.floor(7 - Math.abs(x - 41) * 0.6));
    for (let y = 96 - height; y < 96; y += 1) {
      if (Math.random() > 0.08) world.cells[indexAt(x, y)] = 2;
    }
  }
  for (let x = 72; x < 88; x += 1) {
    world.cells[indexAt(x, 95)] = 3;
    world.cells[indexAt(x, 94)] = 3;
  }
  for (let y = 87; y < 95; y += 1) {
    world.cells[indexAt(122, y)] = 5;
    world.cells[indexAt(133, y)] = 5;
  }
  for (let x = 122; x <= 133; x += 1) {
    world.cells[indexAt(x, 87)] = 5;
    world.cells[indexAt(x, 91)] = 5;
  }
  for (let x = 124; x <= 131; x += 1) {
    world.cells[indexAt(x, 90)] = 2;
    world.cells[indexAt(x, 89)] = 2;
  }
  fillCircle(world, 127, 85, 2, 6);
}

function tick(world: World, frame: number): void {
  world.moved.fill(0);
  const leftToRight = frame % 2 === 0;
  // Bottom-up gives falling matter a natural one-cell step; the moved mask keeps each
  // particle from being processed twice when gases travel in the opposite direction.
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    const start = leftToRight ? 0 : COLS - 1;
    const end = leftToRight ? COLS : -1;
    const stride = leftToRight ? 1 : -1;
    for (let x = start; x !== end; x += stride) {
      const i = indexAt(x, y);
      const kind = world.cells[i];
      if (kind === 0) {
        world.heat[i] = Math.max(0, world.heat[i] - 0.007);
        continue;
      }
      if (world.moved[i]) continue;

      if (kind === 6) {
        world.heat[i] = 1;
        if (world.burn[i] > 0) world.burn[i] -= 1;
        if (Math.random() < 0.035) world.burn[i] = Math.max(0, world.burn[i] - 2);
        const nearby = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
          [x + 1, y - 1], [x - 1, y - 1],
        ];
        for (const [nx, ny] of nearby) {
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          const ni = indexAt(nx, ny);
          world.heat[ni] = Math.min(1, world.heat[ni] + 0.09);
          if (world.cells[ni] === 5 && Math.random() < 0.08) {
            world.cells[ni] = 6;
            world.burn[ni] = 110 + Math.floor(Math.random() * 80);
            world.heat[ni] = 1;
          }
        }
        if (y > 0 && world.cells[indexAt(x, y - 1)] === 0 && Math.random() < 0.25) {
          swap(world, i, indexAt(x, y - 1));
        } else if (world.burn[i] === 0 && Math.random() < 0.1) {
          world.cells[i] = 7;
          world.heat[i] = 0.4;
        }
        continue;
      }

      world.heat[i] = Math.max(0, world.heat[i] - (kind === 4 ? 0.018 : 0.007));

      if (kind === 5 && world.heat[i] > 0.7 && Math.random() < 0.006) {
        world.cells[i] = 6;
        world.burn[i] = 115 + Math.floor(Math.random() * 80);
        continue;
      }

      if (kind === 3 && world.heat[i] > 0.73) {
        world.cells[i] = 4;
        world.heat[i] = 0.6;
        world.moved[i] = 1;
        continue;
      }

      if (kind === 4 && world.heat[i] < 0.08 && Math.random() < 0.035) {
        world.cells[i] = 3;
        world.moved[i] = 1;
        continue;
      }

      const down = y + 1 < ROWS ? indexAt(x, y + 1) : -1;
      const up = y - 1 >= 0 ? indexAt(x, y - 1) : -1;
      const side = Math.random() < 0.5 ? -1 : 1;
      const firstSide = x + side >= 0 && x + side < COLS ? indexAt(x + side, y) : -1;
      const secondSide = x - side >= 0 && x - side < COLS ? indexAt(x - side, y) : -1;

      if (kind === 2) {
        if (down >= 0 && world.cells[down] === 0) swap(world, i, down);
        else {
          const diagonalA = x + side >= 0 && x + side < COLS && y + 1 < ROWS
            ? indexAt(x + side, y + 1) : -1;
          const diagonalB = x - side >= 0 && x - side < COLS && y + 1 < ROWS
            ? indexAt(x - side, y + 1) : -1;
          if (diagonalA >= 0 && world.cells[diagonalA] === 0) swap(world, i, diagonalA);
          else if (diagonalB >= 0 && world.cells[diagonalB] === 0) swap(world, i, diagonalB);
        }
      } else if (kind === 3) {
        if (down >= 0 && world.cells[down] === 0) swap(world, i, down);
        else if (firstSide >= 0 && world.cells[firstSide] === 0) swap(world, i, firstSide);
        else if (secondSide >= 0 && world.cells[secondSide] === 0 && Math.random() < 0.7) {
          swap(world, i, secondSide);
        }
      } else if (kind === 4) {
        if (up >= 0 && world.cells[up] === 0) swap(world, i, up);
        else if (firstSide >= 0 && world.cells[firstSide] === 0) swap(world, i, firstSide);
        else if (secondSide >= 0 && world.cells[secondSide] === 0 && Math.random() < 0.6) {
          swap(world, i, secondSide);
        }
      } else if (kind === 7 && Math.random() < 0.005) {
        world.cells[i] = 0;
        world.heat[i] = 0;
      }
    }
  }
}

function Icon({ kind }: { kind: "play" | "pause" | "clear" }) {
  if (kind === "play") {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5 12 8l-7 4.5z" fill="currentColor" /></svg>;
  }
  if (kind === "pause") {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.5h2.6v9H4.5zm4.4 0h2.6v9H8.9z" fill="currentColor" /></svg>;
  }
  if (kind === "clear") {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5m-5.5 0 .6 8h5.8l.6-8M6.5 7v3.5m3-3.5v3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return null;
}

export function SandboxedGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const selectedRef = useRef<Material>(2);
  const activeMaterialRef = useRef<Material>(2);
  const pausedRef = useRef(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Material>(2);
  const [paused, setPaused] = useState(false);

  selectedRef.current = selected;
  pausedRef.current = paused;

  const clearWorld = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cells.fill(0);
    world.heat.fill(0);
    world.burn.fill(0);
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((value) => !value);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;

    canvas.width = COLS;
    canvas.height = ROWS;
    const world: World = {
      cells: new Uint8Array(TOTAL),
      heat: new Float32Array(TOTAL),
      burn: new Uint8Array(TOTAL),
      moved: new Uint8Array(TOTAL),
    };
    seedWorld(world);
    worldRef.current = world;

    const image = context.createImageData(COLS, ROWS);
    let frame = 0;
    let animation = 0;

    const render = () => {
      if (!pausedRef.current && frame % 2 === 0) tick(world, frame);
      frame += 1;
      const pixels = image.data;
      for (let i = 0; i < TOTAL; i += 1) {
        const kind = world.cells[i];
        const color = COLORS[kind];
        const heat = world.heat[i];
        const shimmer = kind === 6 ? (frame + i * 13) % 3 : 0;
        const offset = i * 4;
        pixels[offset] = Math.min(255, color[0] + shimmer * 5 + heat * 10);
        pixels[offset + 1] = Math.min(255, color[1] + shimmer * 5 + heat * 10);
        pixels[offset + 2] = Math.min(255, color[2] + shimmer * 5 + heat * 10);
        pixels[offset + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      animation = window.requestAnimationFrame(render);
    };
    animation = window.requestAnimationFrame(render);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const material = MATERIALS.find((item) => item.key === event.key);
      if (material) {
        setSelected(material.id);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key.toLowerCase() === "c") {
        clearWorld();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener("keydown", onKeyDown);
      worldRef.current = null;
    };
  }, [clearWorld]);

  const paintAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(COLS - 1, Math.floor(((clientX - rect.left) / rect.width) * COLS)));
    const y = Math.max(0, Math.min(ROWS - 1, Math.floor(((clientY - rect.top) / rect.height) * ROWS)));
    const current = lastPointRef.current;
    const steps = current ? Math.max(Math.abs(x - current.x), Math.abs(y - current.y), 1) : 1;
    for (let step = 0; step <= steps; step += 1) {
      const drawX = current ? Math.round(current.x + ((x - current.x) * step) / steps) : x;
      const drawY = current ? Math.round(current.y + ((y - current.y) * step) / steps) : y;
      fillCircle(world, drawX, drawY, 4, activeMaterialRef.current);
    }
    lastPointRef.current = { x, y };
  }, []);

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 2 && event.pointerType !== "touch") return;
    activeMaterialRef.current = event.button === 2 ? 0 : selectedRef.current;
    drawingRef.current = true;
    lastPointRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintAt(event.clientX, event.clientY);
  };
  const continueDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current) paintAt(event.clientX, event.clientY);
  };
  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  return (
    <main className="sb-shell">
      <style>{`
        .sb-shell {
          --sb-ink: #f0f0ed;
          --sb-muted: #777b7c;
          --sb-dim: #4d5152;
          --sb-line: #242728;
          --sb-panel: #0b0d0e;
          min-height: 100dvh;
          box-sizing: border-box;
          padding: 26px clamp(16px, 4vw, 56px) 22px;
          background: #050606;
          color: var(--sb-ink);
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          letter-spacing: -0.015em;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sb-shell *, .sb-shell *::before, .sb-shell *::after { box-sizing: border-box; }
        .sb-topbar {
          width: min(100%, 1360px);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 46px;
        }
        .sb-brand { display: flex; align-items: center; gap: 14px; }
        .sb-mark {
          width: 30px; height: 30px; border: 1px solid #5d6262;
          display: grid; place-items: center; position: relative;
        }
        .sb-mark::before, .sb-mark::after {
          content: ""; position: absolute; background: #bfc2bf;
        }
        .sb-mark::before { width: 13px; height: 1px; }
        .sb-mark::after { height: 13px; width: 1px; }
        .sb-wordmark {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 14px; font-weight: 600; letter-spacing: .15em;
        }
        .sb-edition {
          color: #686d6e; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .14em; text-transform: uppercase; margin-top: 4px;
        }
        .sb-top-meta {
          display: flex; align-items: center; gap: 24px; color: #818586;
          font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .sb-live { display: inline-flex; align-items: center; gap: 8px; color: #c2c5c2; }
        .sb-live span { width: 5px; height: 5px; border-radius: 50%; background: #bec2bf; }
        .sb-rule { width: min(100%, 1360px); height: 1px; background: var(--sb-line); margin: 18px auto 0; }
        .sb-heading {
          width: min(100%, 1360px); margin: 0 auto;
          display: flex; align-items: flex-end; justify-content: space-between;
          padding: 28px 0 22px; gap: 22px;
        }
        .sb-kicker {
          margin: 0 0 9px; color: #84898a;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .16em; text-transform: uppercase;
        }
        .sb-title { margin: 0; font-size: clamp(22px, 3vw, 31px); font-weight: 420; letter-spacing: -.055em; }
        .sb-deck { margin: 7px 0 0; color: #888d8e; font-size: 12px; line-height: 1.55; }
        .sb-temperature {
          display: flex; align-items: center; gap: 10px; color: #8b9091;
          border: 1px solid var(--sb-line); padding: 10px 12px;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em;
          text-transform: uppercase; white-space: nowrap;
        }
        .sb-temp-bar { display: flex; gap: 2px; }
        .sb-temp-bar i { width: 3px; height: 10px; background: #555a5b; }
        .sb-temp-bar i:nth-child(-n+2) { background: #aeb1ae; }
        .sb-temp-bar.is-warm i:nth-child(n+3) { background: #aeb1ae; }
        .sb-temp-bar.is-heated i { background: #e0e1dc; }
        .sb-workspace {
          width: min(100%, 1360px); margin: 0 auto;
          display: grid; grid-template-columns: 164px minmax(0, 1fr);
          min-height: 0; flex: 1;
          border: 1px solid #242728; background: #090b0c;
        }
        .sb-tool-rail {
          padding: 18px 12px 14px; border-right: 1px solid var(--sb-line);
          display: flex; flex-direction: column; min-width: 0;
        }
        .sb-section-label {
          display: flex; justify-content: space-between; align-items: center;
          color: #777c7d; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .12em; text-transform: uppercase; padding: 0 7px 12px;
        }
        .sb-material-list { display: grid; gap: 4px; }
        .sb-material {
          appearance: none; border: 1px solid transparent; background: transparent;
          color: #a8acad; cursor: pointer; min-height: 44px;
          display: flex; align-items: center; gap: 10px; padding: 6px 8px;
          text-align: left; transition: background .16s ease, border-color .16s ease, color .16s ease;
          font: inherit;
        }
        .sb-material:hover { background: #111415; color: #e4e5e1; }
        .sb-material[aria-pressed="true"] { background: #171a1b; border-color: #373b3b; color: #f2f2ef; }
        .sb-swatch {
          width: 17px; height: 17px; border: 1px solid #ffffff20; flex: 0 0 auto;
          image-rendering: pixelated;
        }
        .sb-material-copy { flex: 1; min-width: 0; }
        .sb-material-name { display: block; font-size: 11px; line-height: 1.2; }
        .sb-material-type {
          display: block; color: #717778; margin-top: 3px;
          font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .sb-key {
          color: #626768; border: 1px solid #343839; min-width: 18px;
          text-align: center; padding: 3px 4px;
          font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .sb-tools-bottom { margin-top: auto; padding-top: 18px; }
        .sb-brush-label {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 0 7px 10px; color: #a0a5a6;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .sb-brush-label output { color: #d9dbd8; letter-spacing: 0; }
        .sb-range {
          display: block; width: calc(100% - 14px); margin: 0 7px;
          height: 3px; appearance: none; border-radius: 0; background: #363b3c;
          outline: none; cursor: pointer;
        }
        .sb-range::-webkit-slider-thumb {
          appearance: none; width: 12px; height: 12px; border: 1px solid #d9dbd8;
          background: #111415; border-radius: 0;
        }
        .sb-range::-moz-range-thumb {
          width: 11px; height: 11px; border: 1px solid #d9dbd8;
          background: #111415; border-radius: 0;
        }
        .sb-brush-scale {
          display: flex; justify-content: space-between; padding: 9px 7px 0;
          color: #5e6364; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .sb-stage { min-width: 0; padding: 14px; display: flex; flex-direction: column; }
        .sb-stage-head {
          display: flex; justify-content: space-between; align-items: center;
          min-height: 24px; padding: 0 2px 12px; gap: 12px;
        }
        .sb-stage-label {
          display: flex; align-items: center; gap: 9px; color: #a2a7a7;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .12em; text-transform: uppercase;
        }
        .sb-stage-label .sb-index { color: #5d6263; }
        .sb-stage-tools { display: flex; align-items: center; gap: 7px; }
        .sb-action {
          appearance: none; display: inline-flex; align-items: center; gap: 7px;
          height: 29px; padding: 0 10px; border: 1px solid #333839;
          background: #0d1011; color: #bfc3c2; cursor: pointer;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .06em; text-transform: uppercase;
          transition: color .15s ease, background .15s ease, border-color .15s ease;
        }
        .sb-action:hover { color: #f4f4f0; border-color: #707575; background: #16191a; }
        .sb-action svg { width: 14px; height: 14px; }
        .sb-action-primary { color: #101212; background: #d8dad6; border-color: #d8dad6; }
        .sb-action-primary:hover { color: #090a0a; background: #f0f0ed; border-color: #f0f0ed; }
        .sb-canvas-frame {
          position: relative; flex: 1; min-height: 300px; overflow: hidden;
          border: 1px solid #1f2324; background: #050606;
          background-image: radial-gradient(ellipse at 50% 70%, #101213 0%, #080a0b 55%, #050606 100%);
        }
        .sb-canvas {
          display: block; width: 100%; height: 100%; image-rendering: pixelated;
          touch-action: none; cursor: crosshair; outline: none;
        }
        .sb-canvas:focus-visible { outline: 1px solid #949999; outline-offset: -3px; }
        .sb-corner {
          position: absolute; color: #565b5c; pointer-events: none;
          font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .sb-corner-tl { top: 12px; left: 13px; }
        .sb-corner-br { right: 13px; bottom: 11px; }
        .sb-stage-foot {
          display: flex; justify-content: space-between; align-items: center; gap: 14px;
          color: #717677; padding: 11px 2px 0;
          font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .035em;
        }
        .sb-stat-row { display: flex; gap: 17px; align-items: center; flex-wrap: wrap; }
        .sb-stat { display: inline-flex; gap: 7px; align-items: center; }
        .sb-stat strong { color: #c4c7c4; font-weight: 500; }
        .sb-hint { color: #64696a; text-align: right; }
        .sb-status {
          position: fixed; bottom: 18px; left: 50%; z-index: 5;
          transform: translate(-50%, 8px); opacity: 0; pointer-events: none;
          border: 1px solid #3b4040; background: #111415; color: #e4e5e1;
          padding: 9px 13px; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
          transition: opacity .18s ease, transform .18s ease;
        }
        .sb-status.is-visible { opacity: 1; transform: translate(-50%, 0); }
        .sb-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        @media (min-height: 800px) {
          .sb-shell { padding-top: 32px; padding-bottom: 28px; }
          .sb-stage { padding: 18px; }
          .sb-tool-rail { padding-top: 22px; }
        }
        @media (max-width: 760px) {
          .sb-shell { padding: 15px 12px 14px; min-height: 100dvh; }
          .sb-topbar { min-height: 35px; }
          .sb-mark { width: 26px; height: 26px; }
          .sb-top-meta { gap: 10px; font-size: 8px; }
          .sb-edition { display: none; }
          .sb-rule { margin-top: 12px; }
          .sb-heading { padding: 20px 0 15px; align-items: flex-start; }
          .sb-deck { max-width: 230px; font-size: 11px; }
          .sb-temperature { padding: 8px; font-size: 8px; gap: 6px; }
          .sb-workspace { display: flex; flex-direction: column; }
          .sb-tool-rail { order: 2; border-right: 0; border-top: 1px solid var(--sb-line); padding: 11px; }
          .sb-section-label { padding: 0 2px 8px; }
          .sb-material-list { display: flex; overflow-x: auto; gap: 5px; padding-bottom: 3px; scrollbar-width: thin; }
          .sb-material { min-width: 92px; min-height: 47px; padding: 5px 7px; }
          .sb-material-copy { flex: initial; }
          .sb-key { margin-left: auto; }
          .sb-tools-bottom { margin-top: 12px; padding-top: 10px; border-top: 1px solid #202425; }
          .sb-brush-label { padding-bottom: 9px; }
          .sb-range { width: calc(100% - 14px); }
          .sb-stage { order: 1; min-height: 0; padding: 10px; flex: 1; }
          .sb-canvas-frame { min-height: 250px; }
          .sb-stage-foot { font-size: 8px; align-items: flex-start; }
          .sb-hint { max-width: 145px; }
        }
        @media (max-width: 440px) {
          .sb-temperature { align-self: flex-end; }
          .sb-temperature .sb-temp-word { display: none; }
          .sb-heading { gap: 10px; }
          .sb-stage-head { align-items: flex-start; }
          .sb-action { padding: 0 8px; font-size: 8px; }
          .sb-action svg { width: 12px; }
          .sb-stage-foot { flex-direction: column; gap: 7px; }
          .sb-hint { text-align: left; max-width: none; }
          .sb-canvas-frame { min-height: 225px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sb-shell * { transition-duration: 0.01ms !important; }
        }
        .sb-shell {
          width: 100%;
          height: 100dvh;
          min-height: 0;
          padding: 0;
          margin: 0;
          overflow: hidden;
        }
        .sb-workspace {
          width: 100%;
          max-width: none;
          height: 100%;
          margin: 0;
          display: grid;
          grid-template-columns: 148px minmax(0, 1fr);
          grid-template-rows: minmax(0, 1fr) 52px;
          border: 0;
          background: #050606;
        }
        .sb-tool-rail {
          grid-column: 1;
          grid-row: 1;
          min-height: 0;
          padding: 8px;
          overflow-y: auto;
          border-right: 1px solid var(--sb-line);
        }
        .sb-material-list { display: grid; gap: 3px; }
        .sb-material {
          width: 100%;
          min-height: 42px;
          gap: 9px;
          padding: 6px 8px;
          border-color: transparent;
        }
        .sb-material-copy { flex: 1; min-width: 0; }
        .sb-material-name { display: block; font-size: 11px; line-height: 1.2; }
        .sb-stage {
          grid-column: 2;
          grid-row: 1;
          min-height: 0;
          padding: 0;
        }
        .sb-canvas-frame {
          width: 100%;
          min-height: 0;
          border: 0;
          background: #050606;
          background-image: none;
        }
        .sb-bottom-bar {
          grid-column: 1 / -1;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 6px 10px;
          border-top: 1px solid var(--sb-line);
          background: #090b0c;
        }
        .sb-action {
          min-width: 84px;
          height: 34px;
          justify-content: center;
          padding: 0 12px;
          font-size: 10px;
        }
        .sb-action:focus-visible,
        .sb-material:focus-visible {
          outline: 2px solid #d8dad6;
          outline-offset: 2px;
        }
        @media (max-width: 700px) {
          .sb-workspace {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr) 48px;
          }
          .sb-tool-rail {
            grid-column: 1;
            grid-row: 1;
            padding: 6px;
            border-right: 0;
            border-bottom: 1px solid var(--sb-line);
          }
          .sb-material-list {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 3px;
          }
          .sb-material {
            min-width: 0;
            min-height: 52px;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
            padding: 4px 2px;
          }
          .sb-swatch { width: 15px; height: 15px; }
          .sb-material-copy { flex: initial; }
          .sb-material-name { font-size: 9px; }
          .sb-stage {
            grid-column: 1;
            grid-row: 2;
          }
          .sb-bottom-bar {
            grid-row: 3;
            justify-content: center;
          }
        }
      `}</style>

      <section className="sb-workspace" aria-label="Material sandbox">
        <aside className="sb-tool-rail" aria-label="Materials">
          <div className="sb-material-list" role="group" aria-label="Choose a material">
            {MATERIALS.map((material) => (
              <button
                type="button"
                key={material.id}
                className="sb-material"
                aria-pressed={selected === material.id}
                aria-label={material.name}
                title={material.name}
                onClick={() => setSelected(material.id)}
              >
                <span className="sb-swatch" style={{ backgroundColor: material.tone }} />
                <span className="sb-material-copy">
                  <span className="sb-material-name">{material.name}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="sb-stage">
          <div className="sb-canvas-frame">
            <canvas
              ref={canvasRef}
              className="sb-canvas"
              role="img"
              aria-label="Interactive falling sand simulation. Draw with the selected material. Right-click and drag to erase."
              tabIndex={0}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onLostPointerCapture={stopDrawing}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>
        <div className="sb-bottom-bar" aria-label="Simulation controls">
          <button
            type="button"
            className="sb-action sb-action-primary"
            onClick={togglePaused}
            aria-label={paused ? "Resume simulation" : "Pause simulation"}
          >
            <Icon kind={paused ? "play" : "pause"} />
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="sb-action" onClick={clearWorld} aria-label="Clear the simulation">
            <Icon kind="clear" />
            Clear
          </button>
        </div>
      </section>
    </main>
  );
}
