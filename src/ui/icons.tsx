const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

export function WaveIcon({ size }: { size: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", className: "mw-wave-icon" },
    h("rect", { className: "mw-wbar mw-wbar-1", x: 1, y: 6, width: 2, height: 4, rx: 1 }),
    h("rect", { className: "mw-wbar mw-wbar-2", x: 5, y: 3, width: 2, height: 10, rx: 1 }),
    h("rect", { className: "mw-wbar mw-wbar-3", x: 9, y: 5, width: 2, height: 6, rx: 1 }),
    h("rect", { className: "mw-wbar mw-wbar-4", x: 13, y: 4, width: 2, height: 8, rx: 1 }));
}
export function PlayIcon({ size = 20 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
    h("path", { d: "M8 5v14l11-7z" }));
}
export function StopIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
    h("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2 }));
}
export function RefreshIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M21 2v6h-6" }),
    h("path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8" }),
    h("path", { d: "M3 22v-6h6" }),
    h("path", { d: "M21 12a9 9 0 0 1-15 6.7L3 16" }));
}
export function HeartIcon({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return filled
    ? h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
        h("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" }))
    : h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 },
        h("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" }));
}
export function ThumbDownIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" }));
}
export function LockIcon({ size = 14, locked = false }: { size?: number; locked?: boolean }) {
  return locked
    ? h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
        h("rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }),
        h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4", fill: "none", stroke: "currentColor", strokeWidth: 2 }))
    : h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
        h("rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }),
        h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }));
}
export function HistoryIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("circle", { cx: 12, cy: 12, r: 10 }),
    h("polyline", { points: "12 6 12 12 16 14" }));
}
export function StatsIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("rect", { x: 3, y: 12, width: 4, height: 9, rx: 1 }),
    h("rect", { x: 10, y: 7, width: 4, height: 14, rx: 1 }),
    h("rect", { x: 17, y: 3, width: 4, height: 18, rx: 1 }));
}
export function MoodIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("circle", { cx: 12, cy: 12, r: 10 }),
    h("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
    h("line", { x1: 9, y1: 9, x2: 9.01, y2: 9 }),
    h("line", { x1: 15, y1: 9, x2: 15.01, y2: 9 }));
}

export function MixIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
    h("polyline", { points: "16 3 21 3 21 8" }),
    h("line", { x1: 4, y1: 20, x2: 21, y2: 3 }),
    h("polyline", { points: "21 16 21 21 16 21" }),
    h("line", { x1: 15, y1: 15, x2: 21, y2: 21 }),
    h("line", { x1: 4, y1: 4, x2: 9, y2: 9 }));
}
