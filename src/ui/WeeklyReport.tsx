// Weekly digest modal — stylised with glitch corner decorations, pager,
// and a comparison page showing current vs previous 7 days.
// Driven entirely by prefs.getReport(7); CSS lives in styles.ts.

import { prefs, WeeklyReport as WR } from "../engine/prefs";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

// ---------- number formatters ----------
function fmtDuration(ms: number): { h: number; m: number; text: string } {
  const total = Math.max(0, Math.round(ms / 1000));
  const h_ = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return { h: h_, m, text: h_ > 0 ? `${h_}h ${m}m` : `${m}m` };
}
function fmtPct(r: number, digits = 0): string {
  return `${(r * 100).toFixed(digits)}%`;
}
function pctDelta(cur: number, prev: number): { sign: "up" | "down" | "flat"; text: string } {
  if (prev <= 0 && cur <= 0) return { sign: "flat", text: "—" };
  if (prev <= 0) return { sign: "up", text: "NEW" };
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 1) return { sign: "flat", text: "±0%" };
  const sign = d > 0 ? "up" : "down";
  const pref = d > 0 ? "▲ +" : "▼ ";
  return { sign, text: `${pref}${d.toFixed(0)}%` };
}
function absDelta(cur: number, prev: number): { sign: "up" | "down" | "flat"; text: string } {
  const d = cur - prev;
  if (d === 0) return { sign: "flat", text: "±0" };
  if (d > 0) return { sign: "up", text: `▲ +${d}` };
  return { sign: "down", text: `▼ ${d}` };
}

// ---------- SVG sparkline path from values ----------
function sparkPath(values: number[], w: number, hgt: number): { line: string; area: string; lastX: number; lastY: number } {
  if (values.length === 0) return { line: "", area: "", lastX: w, lastY: hgt };
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = hgt - (v / max) * (hgt - 4) - 2;
    return { x, y };
  });
  const line = pts.map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${hgt} L0,${hgt} Z`;
  const last = pts[pts.length - 1];
  return { line, area, lastX: last.x, lastY: last.y };
}

// ---------- day-of-week labels starting from 6 days ago ----------
function dayLabels(): string[] {
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay();
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(names[(today - i + 7) % 7]);
  return out;
}

// ========================================================================
//  STAT CARD BUILDERS — each returns a React element
// ========================================================================

function StatListened({ report }: { report: WR }) {
  const cur = fmtDuration(report.current.listenedMs);
  const delta = pctDelta(report.current.listenedMs, report.previous.listenedMs);
  const spark = sparkPath(report.dailyMinutes, 100, 28);
  return h("div", { className: "mw-wk-stat" },
    h("div", { className: "mw-wk-stat-head" },
      h("span", { className: "mw-wk-stat-label" }, "Listened"),
      h("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)),
    h("div", { className: "mw-wk-big-num" },
      cur.h, h("span", { className: "mw-wk-stat-unit" }, "h"),
      cur.m, h("span", { className: "mw-wk-stat-unit" }, "m")),
    h("svg", { className: "mw-wk-spark", viewBox: "0 0 100 28", preserveAspectRatio: "none" },
      spark.area && h("path", { className: "mw-wk-spark-area", d: spark.area }),
      spark.line && h("path", { className: "mw-wk-spark-line", d: spark.line }),
      h("circle", { className: "mw-wk-spark-dot", cx: spark.lastX, cy: spark.lastY, r: 2 }),
    ),
  );
}

function StatTracks({ report }: { report: WR }) {
  const delta = absDelta(report.current.listenedCount, report.previous.listenedCount);
  const max = Math.max(1, ...report.dailyMinutes);
  const labels = dayLabels();
  return h("div", { className: "mw-wk-stat" },
    h("div", { className: "mw-wk-stat-head" },
      h("span", { className: "mw-wk-stat-label" }, "Tracks"),
      h("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)),
    h("div", { className: "mw-wk-big-num" }, String(report.current.listenedCount)),
    h("div", { className: "mw-wk-mbars" },
      report.dailyMinutes.map((v, i) => h("div", {
        key: i,
        className: "mw-wk-mbar",
        style: { height: `${Math.max(4, (v / max) * 100)}%`, animationDelay: `${i * 60}ms` },
      }))),
    h("div", { className: "mw-wk-mbar-label" },
      labels.map((l, i) => h("span", { key: i }, l))),
  );
}

function StatSkipRate({ report }: { report: WR }) {
  const cur = report.current.skipRate;
  const prev = report.previous.skipRate;
  const diff = (cur - prev) * 100;  // percentage points
  const sign: "up" | "down" | "flat" = Math.abs(diff) < 0.5 ? "flat" : (diff > 0 ? "up" : "down");
  // For skip rate, going DOWN is good → use "good-down" class (green)
  const deltaCls = sign === "down" ? "good-down" : sign === "up" ? "down" : "flat";
  const deltaTxt = sign === "flat" ? "±0pp" : `${diff > 0 ? "▲ +" : "▼ "}${Math.abs(diff).toFixed(0)}pp`;

  const r = 24;
  const circumference = 2 * Math.PI * r; // ~150.8
  const offset = circumference * (1 - cur);

  return h("div", { className: "mw-wk-stat" },
    h("div", { className: "mw-wk-stat-head" },
      h("span", { className: "mw-wk-stat-label" }, "Skip rate"),
      h("span", { className: `mw-wk-stat-delta ${deltaCls === "good-down" || deltaCls === "flat" ? "" : "neg"}` }, deltaTxt)),
    h("div", { className: "mw-wk-ring-wrap" },
      h("svg", { className: "mw-wk-ring", viewBox: "0 0 56 56" },
        h("circle", { className: "mw-wk-ring-track", cx: 28, cy: 28, r }),
        h("circle", {
          className: "mw-wk-ring-fill",
          cx: 28, cy: 28, r,
          strokeDasharray: circumference.toFixed(1),
          strokeDashoffset: offset.toFixed(1),
        }),
        h("text", { className: "mw-wk-ring-text", x: 28, y: 28 }, fmtPct(cur)),
      ),
      h("div", { className: "mw-wk-ring-meta" },
        h("div", { className: "mw-wk-ring-big" },
          report.current.skippedCount,
          h("span", { className: "mw-wk-stat-unit" }, `/${report.current.listenedCount + report.current.skippedCount}`)),
        h("div", { className: "mw-wk-ring-small" }, "skipped / total"))),
  );
}

function StatArtists({ report }: { report: WR }) {
  const delta = absDelta(report.current.uniqueArtists, report.previous.uniqueArtists);
  const spark = sparkPath(
    // rough per-day distinct proxy: cap each day's listened minutes scaled
    report.dailyMinutes.map(m => Math.min(m, 60)),
    100, 28,
  );
  return h("div", { className: "mw-wk-stat" },
    h("div", { className: "mw-wk-stat-head" },
      h("span", { className: "mw-wk-stat-label" }, "New artists"),
      h("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)),
    h("div", { className: "mw-wk-big-num" }, String(report.current.uniqueArtists)),
    h("svg", { className: "mw-wk-spark", viewBox: "0 0 100 28", preserveAspectRatio: "none" },
      spark.area && h("path", { className: "mw-wk-spark-area", d: spark.area }),
      spark.line && h("path", { className: "mw-wk-spark-line", d: spark.line }),
      h("circle", { className: "mw-wk-spark-dot", cx: spark.lastX, cy: spark.lastY, r: 2 })),
  );
}

// ========================================================================
//  PAGE 1 — this week
// ========================================================================
function PageThisWeek({ report }: { report: WR }) {
  const maxMs = Math.max(1, ...report.topArtists.map(a => a.ms));
  return h("div", { className: "mw-wk-page" },
    h("div", { className: "mw-wk-grid" },
      h(StatListened, { report }),
      h(StatTracks, { report }),
      h(StatSkipRate, { report }),
      h(StatArtists, { report })),

    h("div", { className: "mw-wk-section" },
      h("div", { className: "mw-wk-section-label" },
        "Top artists",
        h("span", { className: "mw-wk-thin" })),
      report.topArtists.length === 0
        ? h("div", { className: "mw-wk-movers-empty" }, "(not enough data)")
        : report.topArtists.map((a, i) =>
            h("div", { className: "mw-wk-artist", key: a.name },
              h("span", { className: "mw-wk-artist-rank" }, String(i + 1).padStart(2, "0")),
              h("span", { className: "mw-wk-artist-name" }, a.name),
              h("span", { className: "mw-wk-artist-bar" },
                h("span", { className: "mw-wk-artist-bar-fill", style: { width: `${(a.ms / maxMs) * 100}%` } })),
              h("span", { className: "mw-wk-artist-time" }, fmtDuration(a.ms).text)))),
  );
}

// ========================================================================
//  PAGE 2 — vs last week
// ========================================================================
function CmpCard({ icon, label, current, previous, delta, unit }: {
  icon: string;
  label: string;
  current: string;
  previous: string;
  delta: { sign: "up" | "down" | "flat"; text: string; kind?: "normal" | "good-down" };
  unit?: string;
}) {
  const cls = delta.kind === "good-down" ? "good-down" : delta.sign;
  return h("div", { className: "mw-wk-cmp" },
    h("div", { className: "mw-wk-cmp-icon" }, icon),
    h("div", { className: "mw-wk-cmp-body" },
      h("div", { className: "mw-wk-cmp-label" }, label),
      h("div", { className: "mw-wk-cmp-row" },
        h("span", { className: "mw-wk-cmp-now" }, current, unit && h("span", { className: "mw-wk-stat-unit" }, unit)),
        h("span", { className: "mw-wk-cmp-prev" }, "was ", h("span", { className: "mw-wk-v" }, previous)))),
    h("span", { className: `mw-wk-cmp-delta ${cls}` }, delta.text));
}

function DualChart({ now, prev }: { now: number[]; prev: number[] }) {
  const max = Math.max(1, ...now, ...prev);
  const w = 300, hgt = 70;
  const toPath = (vals: number[]) => {
    if (vals.length === 0) return { line: "", area: "", lastX: w, lastY: hgt };
    const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
    const pts = vals.map((v, i) => ({
      x: i * stepX,
      y: hgt - (v / max) * (hgt - 10) - 6,
    }));
    const line = pts.map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${hgt} L0,${hgt} Z`;
    const last = pts[pts.length - 1];
    return { line, area, lastX: last.x, lastY: last.y };
  };
  const nowP = toPath(now);
  const prevP = toPath(prev);

  return h("div", { className: "mw-wk-dual" },
    h("div", { className: "mw-wk-dual-head" },
      h("span", { className: "mw-wk-dual-title" }, "Daily listening (min)"),
      h("span", { className: "mw-wk-dual-legend" },
        h("span", null, h("span", { className: "k k-now" }), "now"),
        h("span", null, h("span", { className: "k k-prev" }), "prev"))),
    h("svg", { className: "mw-wk-dual-svg", viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "none" },
      h("line", { className: "mw-wk-dual-grid", x1: 0, y1: 17, x2: w, y2: 17 }),
      h("line", { className: "mw-wk-dual-grid", x1: 0, y1: 35, x2: w, y2: 35 }),
      h("line", { className: "mw-wk-dual-grid", x1: 0, y1: 53, x2: w, y2: 53 }),
      prevP.line && h("path", { className: "mw-wk-dual-prev-line", d: prevP.line }),
      nowP.area && h("path", { className: "mw-wk-dual-now-area", d: nowP.area }),
      nowP.line && h("path", { className: "mw-wk-dual-now-line", d: nowP.line }),
      h("circle", { className: "mw-wk-dual-dot", cx: nowP.lastX, cy: nowP.lastY, r: 2.4 }),
      h("text", { className: "mw-wk-dual-axis", x: 0, y: 68 }, "7D AGO"),
      h("text", { className: "mw-wk-dual-axis", x: w - 28, y: 68 }, "TODAY")),
  );
}

function PageVsLast({ report }: { report: WR }) {
  const curL = fmtDuration(report.current.listenedMs).text;
  const prevL = fmtDuration(report.previous.listenedMs).text;
  const listenedDelta = pctDelta(report.current.listenedMs, report.previous.listenedMs);
  const tracksDelta = absDelta(report.current.listenedCount, report.previous.listenedCount);
  const artistsDelta = absDelta(report.current.uniqueArtists, report.previous.uniqueArtists);

  // Skip rate delta in percentage points; lower is good
  const pp = (report.current.skipRate - report.previous.skipRate) * 100;
  const skipKind: "good-down" | "normal" = pp < 0 ? "good-down" : "normal";
  const skipSign: "up" | "down" | "flat" = Math.abs(pp) < 0.5 ? "flat" : pp > 0 ? "up" : "down";
  const skipText = skipSign === "flat" ? "±0pp" : `${pp > 0 ? "▲ +" : "▼ "}${Math.abs(pp).toFixed(0)}pp`;

  const { newIn, dropped, risers } = report.movers;

  return h("div", { className: "mw-wk-page" },
    h(CmpCard, {
      icon: "HR", label: "Listened",
      current: curL, previous: prevL, delta: listenedDelta,
    }),
    h(CmpCard, {
      icon: "TR", label: "Tracks",
      current: String(report.current.listenedCount),
      previous: String(report.previous.listenedCount),
      delta: tracksDelta,
    }),
    h(CmpCard, {
      icon: "SK", label: "Skip rate",
      current: fmtPct(report.current.skipRate),
      previous: fmtPct(report.previous.skipRate),
      delta: { sign: skipSign, text: skipText, kind: skipKind },
    }),
    h(CmpCard, {
      icon: "AR", label: "Unique artists",
      current: String(report.current.uniqueArtists),
      previous: String(report.previous.uniqueArtists),
      delta: artistsDelta,
    }),

    h(DualChart, { now: report.dailyMinutes, prev: report.prevDailyMinutes }),

    h("div", { className: "mw-wk-movers" },
      h("div", { className: "mw-wk-movers-col" },
        h("div", { className: "mw-wk-movers-head" },
          h("span", { className: "sym" }, "▲"),
          "New in top"),
        (newIn.length === 0 && risers.length === 0)
          ? h("div", { className: "mw-wk-movers-empty" }, "(none)")
          : h(Spicetify.React.Fragment, null,
              newIn.slice(0, 3).map((n) => h("div", { className: "mw-wk-movers-item", key: n },
                h("span", { className: "mark" }, "NEW"),
                h("span", { className: "mw-wk-movers-name" }, n))),
              risers.slice(0, 2).map((r) => h("div", { className: "mw-wk-movers-item", key: r.name },
                h("span", { className: "mark" }, `↑ ${r.from - r.to}`),
                h("span", { className: "mw-wk-movers-name" }, r.name))))),
      h("div", { className: "mw-wk-movers-col" },
        h("div", { className: "mw-wk-movers-head down" },
          h("span", { className: "sym" }, "▼"),
          "Dropped"),
        dropped.length === 0
          ? h("div", { className: "mw-wk-movers-empty" }, "(none)")
          : dropped.slice(0, 5).map((n) => h("div", { className: "mw-wk-movers-item down", key: n },
              h("span", { className: "mark" }, "OUT"),
              h("span", { className: "mw-wk-movers-name" }, n))))),
  );
}

// ========================================================================
//  MODAL SHELL — glitch decos, pager, actions
// ========================================================================
function demoReport(): WR {
  const cur = {
    listenedMs: (4 * 3600 + 32 * 60) * 1000, listenedCount: 87, skippedCount: 12,
    uniqueArtists: 23, skipRate: 12 / 99,
    topArtists: [
      { name: "Tame Impala", ms: 48 * 60000, plays: 14 },
      { name: "King Krule", ms: 35 * 60000, plays: 10 },
      { name: "Mac DeMarco", ms: 26 * 60000, plays: 8 },
      { name: "Men I Trust", ms: 19 * 60000, plays: 6 },
      { name: "Beach House", ms: 14 * 60000, plays: 4 },
    ],
  };
  const prev = {
    listenedMs: (3 * 3600 + 50 * 60) * 1000, listenedCount: 75, skippedCount: 15,
    uniqueArtists: 18, skipRate: 15 / 90,
    topArtists: [
      { name: "Tame Impala", ms: 42 * 60000, plays: 12 },
      { name: "King Krule", ms: 30 * 60000, plays: 9 },
      { name: "Radiohead", ms: 24 * 60000, plays: 7 },
      { name: "Parcels", ms: 17 * 60000, plays: 5 },
      { name: "Unknown Mortal Orchestra", ms: 12 * 60000, plays: 4 },
    ],
  };
  return {
    days: 7, hasData: true,
    listenedMs: cur.listenedMs, listenedCount: cur.listenedCount,
    skippedCount: cur.skippedCount, uniqueArtists: cur.uniqueArtists,
    skipRate: cur.skipRate, topArtists: cur.topArtists,
    current: cur, previous: prev,
    dailyMinutes: [22, 31, 26, 48, 37, 54, 62],
    prevDailyMinutes: [18, 24, 16, 32, 22, 38, 40],
    movers: {
      newIn: ["Men I Trust", "Beach House"],
      dropped: ["Radiohead", "Unknown Mortal Orchestra"],
      risers: [{ name: "Mac DeMarco", from: 6, to: 3 }],
    },
  };
}

export function WeeklyReportModal({ onClose, demo = false }: { onClose: () => void; demo?: boolean }) {
  const report = Spicetify.React.useMemo<WR>(() => {
    const r = prefs.getReport(7);
    return (demo || !r.hasData) ? demoReport() : r;
  }, [demo]);
  const [page, setPage] = Spicetify.React.useState(1 as 1 | 2);

  const onDismiss = () => { prefs.markReportShown(); onClose(); };

  const shareText = () => {
    const cur = fmtDuration(report.current.listenedMs).text;
    const lines = [
      `mixline · last ${report.days}d`,
      `${cur} · ${report.current.listenedCount} tracks · ${report.current.uniqueArtists} artists`,
      "Top: " + report.topArtists.slice(0, 3).map(a => a.name).join(", "),
    ];
    return lines.join("\n");
  };

  return h("div", {
    className: "mw-wk-backdrop",
    onClick: (e: any) => { if (e.target === e.currentTarget) onDismiss(); },
  },
    h("div", { className: "mw-wk-card" },
      // Corner brackets — stay on the OUTER card so they hug the border
      h("div", { className: "mw-wk-corner mw-wk-corner-tl" }),
      h("div", { className: "mw-wk-corner mw-wk-corner-tr" }),
      h("div", { className: "mw-wk-corner mw-wk-corner-bl" }),
      h("div", { className: "mw-wk-corner mw-wk-corner-br" }),
      // Decorations — live on OUTER card so they can overflow / sit on top of border
      h("div", { className: "mw-wk-deco mw-wk-deco-tag" }, "// 07d"),
      h("div", { className: "mw-wk-deco mw-wk-deco-glitch mw-wk-deco-bl" }),
      h("div", { className: "mw-wk-deco mw-wk-deco-glitch mw-wk-deco-br" }),

      // Scrollable inner body — content lives here, scrollbar hidden, no jitter
      h("div", { className: "mw-wk-card-body" },

        // Shared sparkline gradient (#mwWkGrad referenced by multiple svgs)
        h("svg", { width: 0, height: 0, style: { position: "absolute" } },
          h("defs", null,
            h("linearGradient", { id: "mwWkGrad", x1: "0", y1: "0", x2: "0", y2: "1" },
              h("stop", { offset: "0%", stopColor: "#1db954", stopOpacity: "0.55" }),
              h("stop", { offset: "100%", stopColor: "#1db954", stopOpacity: "0" })))),

        // Header
        h("div", { className: "mw-wk-tag" },
          h("span", { className: "mw-wk-tag-dot" }),
          h("span", null, "mixline // digest"),
          h("span", { className: "mw-wk-tag-bar" }),
          h("span", null, "v1")),
        h("div", { className: "mw-wk-title", "data-text": "Your week in mixes" }, "Your week in mixes"),
        h("div", { className: "mw-wk-subtitle" },
          page === 1
            ? "// last 7d · compiled from session events"
            : "// last 7d vs previous 7d · diff report"),

        // Pager
        h("div", { className: "mw-wk-pager" },
          h("button", {
            className: `mw-wk-pager-tab${page === 1 ? " on" : ""}`,
            onClick: () => setPage(1),
          }, h("span", { className: "mw-wk-ix" }, "01"), "this week"),
          h("button", {
            className: `mw-wk-pager-tab${page === 2 ? " on" : ""}`,
            onClick: () => setPage(2),
          }, h("span", { className: "mw-wk-ix" }, "02"), "vs last week")),

        // Page content (key forces remount -> animation replays)
        h("div", { key: page },
          page === 1 ? h(PageThisWeek, { report }) : h(PageVsLast, { report })),

        // Actions
        h("div", { className: "mw-wk-actions" },
          h("span", { className: "mw-wk-actions-fill" }, "> end_of_digest"),
          h("button", { className: "mw-wk-btn", onClick: onDismiss }, "Dismiss"),
          h("button", {
            className: "mw-wk-btn mw-wk-btn-primary",
            onClick: () => {
              navigator.clipboard?.writeText(shareText());
              Spicetify.showNotification("Report copied to clipboard");
              onDismiss();
            },
          }, "Share")))));
}

// ========================================================================
//  Controller — mounts once per 7 days, or on demand via __mwShowReport().
// ========================================================================
function renderReport(reactDOM: typeof Spicetify.ReactDOM) {
  // Clean up any prior instance so repeated calls just re-open.
  const prior = document.getElementById("mywave-weekly");
  if (prior) {
    try { reactDOM.unmountComponentAtNode(prior); } catch {}
    prior.remove();
  }
  const container = document.createElement("div");
  container.id = "mywave-weekly";
  document.body.appendChild(container);
  const close = () => {
    try { reactDOM.unmountComponentAtNode(container); } catch {}
    container.remove();
  };
  reactDOM.render(h(WeeklyReportModal, { onClose: close }), container);
}

export function maybeShowWeeklyReport(reactDOM: typeof Spicetify.ReactDOM) {
  // Expose a global so the user can trigger it on demand from DevTools.
  (window as any).__mwShowReport = () => renderReport(reactDOM);

  if (!prefs.shouldShowWeeklyReport()) return;
  setTimeout(() => renderReport(reactDOM), 8000);
}
