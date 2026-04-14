import { EQ_COLS, EQ_ROWS, EQ_COLS_MINI, EQ_ROWS_MINI } from "../engine/constants";

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

  // Idle bar heights (bell curve — center taller)
  const idle = Spicetify.React.useMemo(() =>
    Array.from({ length: cols }, (_, i) => {
      const c = (cols - 1) / 2;
      return (1 - Math.abs(i - c) / c * 0.6) * rows * 0.25;
    }), [cols, rows]);

  const [bars, setBars] = Spicetify.React.useState<number[]>(idle);

  Spicetify.React.useEffect(() => {
    if (!active) { setBars(idle); return; }
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
  }, [active, idle, cols, rows]);

  return h("div", { className: `mw-eq${active ? " mw-eq-on" : ""}${mini ? " mw-eq-mini" : ""}` },
    Array.from({ length: rows }, (_, r) => {
      const rowBot = rows - 1 - r;
      return h("div", { key: r, className: "mw-eq-row" },
        Array.from({ length: cols }, (_, c) => {
          const bh = bars[c];
          let ch: string;
          if (bh > rowBot + 0.75) ch = "\u2588";
          else if (bh > rowBot + 0.5) ch = "\u2593";
          else if (bh > rowBot + 0.25) ch = "\u2592";
          else if (bh > rowBot) ch = "\u2591";
          else ch = " ";
          return h("span", { key: c, className: ch !== " " ? "mw-eq-ch" : "mw-eq-sp" }, ch);
        }));
    }));
}

// ========== CONSOLE TYPING LABEL ==========
export function MixLabel({ isNewMix }: { isNewMix?: boolean }) {
  const [text, setText] = Spicetify.React.useState("");
  const [phase, setPhase] = Spicetify.React.useState("typing" as "typing" | "hold" | "erasing");
  const targetRef = Spicetify.React.useRef("/MIX...");
  const triggerRef = Spicetify.React.useRef(0);

  Spicetify.React.useEffect(() => {
    if (isNewMix) {
      targetRef.current = "/NEW MIX...";
      setText("");
      setPhase("typing");
      triggerRef.current++;
    }
  }, [isNewMix]);

  Spicetify.React.useEffect(() => {
    let timer: any;
    const target = targetRef.current;

    if (phase === "typing") {
      if (text.length < target.length) {
        timer = setTimeout(() => setText(target.slice(0, text.length + 1)), 60 + Math.random() * 40);
      } else {
        timer = setTimeout(() => setPhase("hold"), 1800);
      }
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("erasing"), 200);
    } else if (phase === "erasing") {
      if (text.length > 0) {
        timer = setTimeout(() => setText(text.slice(0, -1)), 30);
      } else {
        targetRef.current = "/MIX...";
        timer = setTimeout(() => setPhase("typing"), 400);
      }
    }
    return () => clearTimeout(timer);
  }, [text, phase]);

  return h("span", { className: "mw-ascii-label" },
    h("span", null, text),
    h("span", { className: "mw-cursor" }, "\u2588"));
}

export function PanelMixLabel() {
  const sig = useNewMixSignal();
  const [isNew, setIsNew] = Spicetify.React.useState(false);
  const prevRef = Spicetify.React.useRef(sig);
  Spicetify.React.useEffect(() => {
    if (sig !== prevRef.current) { setIsNew(true); prevRef.current = sig; }
    else { setIsNew(false); }
  }, [sig]);
  return h(MixLabel, { isNewMix: isNew });
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
    SEA_ROWS.map((row, i) =>
      h("div", {
        key: i,
        className: "mw-sea-row",
        style: { opacity: row.op, animationDuration: `${row.speed}s` } as any,
      }, row.chars.repeat(6))));
}
