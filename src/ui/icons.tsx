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

export function PinIcon({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return filled
    ? h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
        h("path", { d: "M16 2l-4 4-1.5-1.5L7 8l3 3-5.5 5.5L6 18l5.5-5.5 3 3 3.5-3.5L16.5 11l4-4z" }))
    : h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
        h("line", { x1: 12, y1: 17, x2: 12, y2: 22 }),
        h("path", { d: "M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" }));
}

export function SaveIcon({ size = 14 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }),
    h("polyline", { points: "17 21 17 13 7 13 7 21" }),
    h("polyline", { points: "7 3 7 8 15 8" }));
}

export function ShareIcon({ size = 14 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("circle", { cx: 18, cy: 5, r: 3 }),
    h("circle", { cx: 6, cy: 12, r: 3 }),
    h("circle", { cx: 18, cy: 19, r: 3 }),
    h("line", { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }),
    h("line", { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }));
}

export function CompassIcon({ size = 14 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("circle", { cx: 12, cy: 12, r: 10 }),
    h("polygon", { points: "16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" }));
}

export function SparkleIcon({ size = 14 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" }),
    h("path", { d: "M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" }));
}

export function MixIcon({ size = 16 }: { size?: number }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
    h("polyline", { points: "16 3 21 3 21 8" }),
    h("line", { x1: 4, y1: 20, x2: 21, y2: 3 }),
    h("polyline", { points: "21 16 21 21 16 21" }),
    h("line", { x1: 15, y1: 15, x2: 21, y2: 21 }),
    h("line", { x1: 4, y1: 4, x2: 9, y2: 9 }));
}
