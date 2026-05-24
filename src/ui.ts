const HISTORY_LENGTH = 300;

const MIN_HZ = 50;
const MAX_HZ = 500;

const history: (number | null)[] = [];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let freqValueEl: HTMLElement | null = null;
let noteNameEl: HTMLElement | null = null;
let noteOctaveEl: HTMLElement | null = null;
let startScreen: HTMLElement | null = null;
let tunerUi: HTMLElement | null = null;
let startButton: HTMLButtonElement | null = null;
let stopButton: HTMLButtonElement | null = null;

function getStartScreenElements() {
  if (!startScreen) {
    startScreen = document.getElementById("start-screen");
    tunerUi = document.getElementById("tuner-ui");
    startButton = document.getElementById("start-button") as HTMLButtonElement | null;
    stopButton = document.getElementById("stop-button") as HTMLButtonElement | null;

    if (!startScreen || !tunerUi || !startButton || !stopButton) {
      throw new Error("Start screen UI elements not found in the document");
    }
  }

  return {
    startScreen: startScreen!,
    tunerUi: tunerUi!,
    startButton: startButton!,
    stopButton: stopButton!,
  };
}

export function hideStartScreen(): void {
  getStartScreenElements().startScreen.hidden = true;
}

export function showStartScreen(): void {
  getStartScreenElements().startScreen.hidden = false;
}

export function showTunerUi(): void {
  getStartScreenElements().tunerUi.hidden = false;
}

export function hideTunerUi(): void {
  getStartScreenElements().tunerUi.hidden = true;
}

export function onStartButtonClick(handler: () => void | Promise<void>): void {
  getStartScreenElements().startButton.addEventListener("click", () => {
    void handler();
  });
}

export function onStopButtonClick(handler: () => void | Promise<void>): void {
  getStartScreenElements().stopButton.addEventListener("click", () => {
    void handler();
  });
}

export function resetFrequencyDisplay(): void {
  history.length = 0;
  updateFrequency(null);
}

function getElements() {
  if (!canvas) {
    canvas = document.getElementById("freq-canvas") as HTMLCanvasElement | null;
    freqValueEl = document.getElementById("freq-value");
    noteNameEl = document.getElementById("note-name");
    noteOctaveEl = document.getElementById("note-octave");

    if (!canvas || !freqValueEl || !noteNameEl || !noteOctaveEl) {
      throw new Error("Tuner UI elements not found in the document");
    }

    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d canvas context");
  }

  return {
    canvas,
    ctx: ctx!,
    freqValueEl: freqValueEl!,
    noteNameEl: noteNameEl!,
    noteOctaveEl: noteOctaveEl!,
  };
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function hzToY(hz: number, height: number): number {
  const t = (hz - MIN_HZ) / (MAX_HZ - MIN_HZ);
  const clamped = Math.max(0, Math.min(1, t));
  return height - clamped * height;
}

function drawChart() {
  const { canvas, ctx } = getElements();
  resizeCanvas(canvas, ctx);

  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const gridHz = [82, 110, 147, 196, 247, 330];
  ctx.strokeStyle = "#2a2a34";
  ctx.lineWidth = 1;
  for (const hz of gridHz) {
    const y = hzToY(hz, h);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const data = history.slice(-HISTORY_LENGTH);
  if (data.length < 2) return;

  const step = w / (HISTORY_LENGTH - 1);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3dd68c";
  ctx.beginPath();

  let started = false;
  for (let i = 0; i < data.length; i++) {
    const hz = data[i];
    if (hz === null) {
      started = false;
      continue;
    }
    const x = i * step;
    const y = hzToY(hz, h);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  const latest = data[data.length - 1];
  if (latest !== null && latest !== undefined) {
    const x = (data.length - 1) * step;
    const y = hzToY(latest, h);
    ctx.fillStyle = "#e8c547";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Note display placeholder — wired to note detection later. */
function showNoteIdle(): void {
  const { noteNameEl, noteOctaveEl } = getElements();
  noteNameEl.textContent = "\u2014";
  noteNameEl.classList.add("idle");
  noteOctaveEl.textContent = "";
}

export function updateFrequency(freq: number | null): void {
  const { freqValueEl } = getElements();

  history.push(freq);
  if (history.length > HISTORY_LENGTH) {
    history.shift();
  }

  if (freq === null) {
    freqValueEl.textContent = "\u2014 Hz";
    freqValueEl.classList.add("idle");
    showNoteIdle();
  } else {
    freqValueEl.textContent = `${freq.toFixed(1)} Hz`;
    freqValueEl.classList.remove("idle");
    // Note name/octave will be driven by getNoteFromFrequency() later.
    showNoteIdle();
  }

  drawChart();
}
