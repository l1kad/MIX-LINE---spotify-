import { EQ_COLS, EQ_ROWS, EQ_COLS_MINI, EQ_ROWS_MINI } from "../engine/constants";
import { useAppVisible, isAppVisible } from "./hooks";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

export let newMixCounter = 0;
export const newMixListeners = new Set<() => void>();
export function triggerNewMix() { newMixCounter++; newMixListeners.forEach(cb => cb()); }
export function useNewMixSignal() {
  const [count, setCount] = Spicetify.React.useState(newMixCounter);
  Spicetify.React.useEffect(() => {
    const cb = () => setCount(newMixCounter);
    newMixListeners.add(cb);
    return () => { newMixListeners.delete(cb); };
  }, []);
  return count;
}

// ========== EQUALIZER VISUALIZER ==========
export function AsciiWave({ active, mini }: { active: boolean; mini?: boolean }) {
  const cols = mini ? EQ_COLS_MINI : EQ_COLS;
  const rows = mini ? EQ_ROWS_MINI : EQ_ROWS;
  const visible = useAppVisible();

  // Idle bar heights (bell curve — center taller)
  const idle = Spicetify.React.useMemo(() =>
    Array.from({ length: cols }, (_, i) => {
      const c = (cols - 1) / 2;
      return (1 - Math.abs(i - c) / c * 0.6) * rows * 0.25;
    }), [cols, rows]);

  const [bars, setBars] = Spicetify.React.useState<number[]>(idle);

  Spicetify.React.useEffect(() => {
    if (!active || !visible) { if (!active) setBars(idle); return; }
    const cur = idle.map(v => v);
    const tgt = cur.map(() => Math.random() * rows);
    let timer: any;
    const tick = () => {
      for (let i = 0; i < cols; i++) {
        if (Math.random() < 0.15) {
          const c = (cols - 1) / 2;
          tgt[i] = Math.random() * rows * (1 - Math.abs(i - c) / c * 0.25);
        }
        cur[i] += (tgt[i] - cur[i]) * 0.28;
      }
      setBars([...cur]);
      timer = setTimeout(tick, 80);
    };
    tick();
    return () => clearTimeout(timer);
  }, [active, visible, idle, cols, rows]);

  // Build a single string — avoids 91+ span elements per frame
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const rowBot = rows - 1 - r;
    let line = "";
    for (let c = 0; c < cols; c++) {
      const bh = bars[c];
      if (bh > rowBot + 0.75) line += "\u2588";
      else if (bh > rowBot + 0.5) line += "\u2593";
      else if (bh > rowBot + 0.25) line += "\u2592";
      else if (bh > rowBot) line += "\u2591";
      else line += " ";
    }
    lines.push(line);
  }
  return h("pre", { className: `mw-eq${active ? " mw-eq-on" : ""}${mini ? " mw-eq-mini" : ""}` }, lines.join("\n"));
}

// ========== CONSOLE TYPING LABEL (global sync) ==========
const MIX_EXTRAS = [
  "/MIXING...",
  "/SOUNDS GOOD.",
  "/I LIKE THIS MIX.",
  "/FOUND NEW MIX.",
  "/MIX!!!",
  "/NOT BAD.",
  "/VIBES.",
  "/NICE ONE.",
  "/KEEP GOING...",
  "/GOOD STUFF.",
  "/OH THIS IS NICE.",
  "/WAIT THIS SLAPS.",
];
const MIX_RARE = "/MIIIIIIIX 0_0";
let mixCycleCount = 0;
let extraQueue: string[] = [];

function shuffleExtras() {
  extraQueue = [...MIX_EXTRAS];
  for (let i = extraQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [extraQueue[i], extraQueue[j]] = [extraQueue[j], extraQueue[i]];
  }
}

function pickPhrase(): string {
  mixCycleCount++;
  if (Math.random() < 0.01) return MIX_RARE;
  if (mixCycleCount % 6 === 0) {
    if (extraQueue.length === 0) shuffleExtras();
    return extraQueue.pop()!;
  }
  return "/MIX...";
}

// Single global animation state — all MixLabel instances subscribe
const mixLabelState = {
  text: "",
  listeners: new Set<() => void>(),
  phase: "typing" as "typing" | "hold" | "erasing",
  target: "/MIX...",
  timer: null as any,
  running: false,

  notify() { this.listeners.forEach(cb => cb()); },

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  },

  stop() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  },

  pause() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  },

  resume() {
    if (this.running && !this.timer) this.tick();
  },

  forceNewMix() {
    if (this.timer) clearTimeout(this.timer);
    this.target = "/NEW MIX...";
    this.text = "";
    this.phase = "typing";
    this.notify();
    this.tick();
  },

  tick() {
    if (!this.running) return;
    if (this.phase === "typing") {
      if (this.text.length < this.target.length) {
        this.text = this.target.slice(0, this.text.length + 1);
        this.notify();
        this.timer = setTimeout(() => this.tick(), 60 + Math.random() * 40);
      } else {
        this.notify();
        this.timer = setTimeout(() => { this.phase = "hold"; this.tick(); }, 2200);
      }
    } else if (this.phase === "hold") {
      this.phase = "erasing";
      this.timer = setTimeout(() => this.tick(), 200);
    } else if (this.phase === "erasing") {
      if (this.text.length > 0) {
        this.text = this.text.slice(0, -1);
        this.notify();
        this.timer = setTimeout(() => this.tick(), 30);
      } else {
        this.target = pickPhrase();
        this.phase = "typing";
        this.notify();
        this.timer = setTimeout(() => this.tick(), 400);
      }
    }
  },
};

export function PanelMixLabel() {
  const [text, setText] = Spicetify.React.useState(mixLabelState.text);
  const sig = useNewMixSignal();
  const prevRef = Spicetify.React.useRef(sig);

  const visible = useAppVisible();

  Spicetify.React.useEffect(() => {
    const cb = () => setText(mixLabelState.text);
    mixLabelState.listeners.add(cb);
    mixLabelState.start();
    return () => { mixLabelState.listeners.delete(cb); if (mixLabelState.listeners.size === 0) mixLabelState.stop(); };
  }, []);

  Spicetify.React.useEffect(() => {
    if (visible) mixLabelState.resume();
    else mixLabelState.pause();
  }, [visible]);

  Spicetify.React.useEffect(() => {
    if (sig !== prevRef.current) { mixLabelState.forceNewMix(); prevRef.current = sig; }
  }, [sig]);

  return h("span", { className: "mw-ascii-label" },
    h("span", null, text),
    h("span", { className: "mw-cursor" }, "\u2588"));
}

// ========== SEA WAVES BACKGROUND ==========
export const SEA_ROWS = [
  { chars: "\u00B7   ~   \u00B7  ~    \u00B7   ~   \u00B7  ~    ", speed: 28, op: 0.12 },
  { chars: " ~ \u2591\u2591 ~  \u2591  ~ \u2591\u2591 ~  \u2591  ", speed: 20, op: 0.2 },
  { chars: "\u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   \u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   ", speed: 15, op: 0.3 },
  { chars: "\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591", speed: 11, op: 0.4 },
  { chars: "\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592", speed: 8, op: 0.5 },
];

export function SeaWaves() {
  return h("div", { className: "mw-sea" },
    SEA_ROWS.map((row, i) => {
      // Double the content: first half scrolls out, second half is identical = seamless
      const tile = row.chars.repeat(4);
      return h("div", {
        key: i,
        className: "mw-sea-row",
        style: { opacity: row.op, animationDuration: `${row.speed}s`, contain: "layout paint" } as any,
      }, tile + tile);
    }));
}
