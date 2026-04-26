// Persistent preferences + learning store for MyWave.
// localStorage-backed so sessions across Spotify restarts remember
// what was played and which artists the user likes / skips.

const STORAGE_KEY = "mywave:prefs:v1";

// Tuneables
const FRESHNESS_HARD_DAYS = 7;    // played within this window -> reject
const FRESHNESS_SOFT_DAYS = 30;   // within this window -> lower priority
const PLAYED_CAP = 2000;           // hard cap on persisted track entries
const ARTIST_SCORE_MIN = -6;       // clamp bounds
const ARTIST_SCORE_MAX = 10;
const ARTIST_REJECT_THRESHOLD = -4; // at or below -> never recommend

const LISTEN_RATIO = 0.8;          // >= this fraction of duration -> "listened"
const SKIP_SECONDS = 10;           // <= this played -> "skipped"

export interface PlayedEntry {
  t: number;      // last played timestamp (ms)
  n: number;      // play count
}

// One row per verdict we issue, capped to EVENTS_CAP. Lets us aggregate
// arbitrary time windows (weekly report) without a per-bucket schema.
export interface VerdictEvent {
  t: number;         // timestamp (ms)
  v: 0 | 1 | 2;      // 0=skipped, 1=neutral, 2=listened
  a: string;         // artist
  ms: number;        // played duration
}

const EVENTS_CAP = 3000;

export interface PeriodStats {
  listenedMs: number;
  listenedCount: number;
  skippedCount: number;
  uniqueArtists: number;
  skipRate: number;
  topArtists: { name: string; ms: number; plays: number }[];
}

export interface WeeklyReport {
  days: number;
  hasData: boolean;
  // flat shortcuts = current period (kept for legacy callers)
  listenedMs: number;
  listenedCount: number;
  skippedCount: number;
  uniqueArtists: number;
  skipRate: number;
  topArtists: { name: string; ms: number; plays: number }[];
  // comparison + daily breakdown
  current: PeriodStats;
  previous: PeriodStats;
  dailyMinutes: number[];      // 7 values, oldest -> newest
  prevDailyMinutes: number[];  // 7 values, oldest -> newest
  movers: {
    newIn: string[];
    dropped: string[];
    risers: { name: string; from: number; to: number }[];
  };
}

export interface PrefsData {
  played: Record<string, PlayedEntry>;
  artistScores: Record<string, number>;
  discoveryOnly: boolean;
  events: VerdictEvent[];
  lastReportAt: number;  // ms since last weekly report was acknowledged
}

const DEFAULT: PrefsData = {
  played: {},
  artistScores: {},
  discoveryOnly: false,
  events: [],
  lastReportAt: 0,
};

function loadRaw(): PrefsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      played: parsed.played && typeof parsed.played === "object" ? parsed.played : {},
      artistScores: parsed.artistScores && typeof parsed.artistScores === "object" ? parsed.artistScores : {},
      discoveryOnly: !!parsed.discoveryOnly,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      lastReportAt: Number(parsed.lastReportAt) || 0,
    };
  } catch {
    return { ...DEFAULT };
  }
}

class PrefsStore {
  private data: PrefsData;
  private saveTimer: any = null;

  constructor() {
    this.data = loadRaw();
  }

  // -- persistence -------------------------------------------------
  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.warn("[MyWave] prefs save failed", e);
      }
    }, 800);
  }

  // -- played tracks -----------------------------------------------
  recordPlayed(uri: string) {
    if (!uri) return;
    const prev = this.data.played[uri];
    this.data.played[uri] = {
      t: Date.now(),
      n: (prev?.n || 0) + 1,
    };
    this.capPlayed();
    this.scheduleSave();
  }

  private capPlayed() {
    const entries = Object.entries(this.data.played);
    if (entries.length <= PLAYED_CAP) return;
    // evict oldest by timestamp
    entries.sort((a, b) => a[1].t - b[1].t);
    const keep = entries.slice(entries.length - PLAYED_CAP);
    const next: Record<string, PlayedEntry> = {};
    for (const [k, v] of keep) next[k] = v;
    this.data.played = next;
  }

  getPlayedAt(uri: string): number | null {
    return this.data.played[uri]?.t ?? null;
  }

  // Freshness: 0 = blocked, 1 = soft (deprioritize), 2 = ok
  freshness(uri: string): 0 | 1 | 2 {
    const t = this.getPlayedAt(uri);
    if (!t) return 2;
    const days = (Date.now() - t) / 86_400_000;
    if (days < FRESHNESS_HARD_DAYS) return 0;
    if (days < FRESHNESS_SOFT_DAYS) return 1;
    return 2;
  }

  // -- artist scoring ----------------------------------------------
  bumpArtist(name: string, delta: number) {
    if (!name) return;
    const cur = this.data.artistScores[name] || 0;
    const next = Math.max(ARTIST_SCORE_MIN, Math.min(ARTIST_SCORE_MAX, cur + delta));
    if (next === 0) delete this.data.artistScores[name];
    else this.data.artistScores[name] = next;
    this.scheduleSave();
  }

  getArtistScore(name: string): number {
    return this.data.artistScores[name] || 0;
  }

  isArtistRejected(name: string): boolean {
    return this.getArtistScore(name) <= ARTIST_REJECT_THRESHOLD;
  }

  topArtists(limit = 10): { name: string; score: number }[] {
    return Object.entries(this.data.artistScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, score]) => ({ name, score }));
  }

  // -- play verdict from duration ratio ----------------------------
  // Called when a track transitions to a new one. Returns the verdict
  // applied so callers can log / notify.
  registerVerdict(uri: string, artist: string, playedMs: number, totalMs: number): "listened" | "skipped" | "neutral" {
    if (!uri || !artist || totalMs <= 0) return "neutral";
    const ratio = playedMs / totalMs;
    let verdict: "listened" | "skipped" | "neutral";
    if (playedMs / 1000 <= SKIP_SECONDS) {
      this.bumpArtist(artist, -2);
      verdict = "skipped";
    } else if (ratio >= LISTEN_RATIO) {
      this.bumpArtist(artist, +1);
      verdict = "listened";
    } else {
      verdict = "neutral";
    }
    // record event for weekly/report aggregation
    this.data.events.push({
      t: Date.now(),
      v: verdict === "listened" ? 2 : verdict === "skipped" ? 0 : 1,
      a: artist,
      ms: Math.max(0, Math.floor(playedMs)),
    });
    if (this.data.events.length > EVENTS_CAP) {
      this.data.events.splice(0, this.data.events.length - EVENTS_CAP);
    }
    this.scheduleSave();
    return verdict;
  }

  // -- weekly report -----------------------------------------------
  // Aggregate verdict events into (current period, previous period, diffs).
  getReport(days: number = 7): WeeklyReport {
    const now = Date.now();
    const DAY = 86_400_000;
    const currentSince = now - days * DAY;
    const previousSince = now - 2 * days * DAY;

    const curEvents = this.data.events.filter(e => e.t >= currentSince);
    const prevEvents = this.data.events.filter(e => e.t >= previousSince && e.t < currentSince);

    const stats = (events: VerdictEvent[]): PeriodStats => {
      let listenedMs = 0, listenedCount = 0, skippedCount = 0;
      const artistMs: Record<string, number> = {};
      const artistPlays: Record<string, number> = {};
      for (const e of events) {
        if (e.v === 2) { listenedMs += e.ms; listenedCount++; }
        else if (e.v === 0) { skippedCount++; }
        artistMs[e.a] = (artistMs[e.a] || 0) + e.ms;
        artistPlays[e.a] = (artistPlays[e.a] || 0) + 1;
      }
      const topArtists = Object.entries(artistMs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, ms]) => ({ name, ms, plays: artistPlays[name] || 0 }));
      const total = listenedCount + skippedCount;
      return {
        listenedMs,
        listenedCount,
        skippedCount,
        uniqueArtists: Object.keys(artistPlays).length,
        skipRate: total > 0 ? skippedCount / total : 0,
        topArtists,
      };
    };

    const current = stats(curEvents);
    const previous = stats(prevEvents);

    // Daily breakdown (listened minutes per day)
    const dailyMin = (events: VerdictEvent[], startMs: number): number[] => {
      const buckets = new Array(days).fill(0);
      for (const e of events) {
        if (e.v !== 2) continue;
        const idx = Math.floor((e.t - startMs) / DAY);
        if (idx >= 0 && idx < days) buckets[idx] += e.ms / 60_000;
      }
      return buckets;
    };
    const dailyMinutes = dailyMin(curEvents, currentSince);
    const prevDailyMinutes = dailyMin(prevEvents, previousSince);

    // Movers: new / dropped / risers in top 5
    const prevNames = previous.topArtists.map(a => a.name);
    const curNames = current.topArtists.map(a => a.name);
    const newIn = curNames.filter(n => !prevNames.includes(n));
    const dropped = prevNames.filter(n => !curNames.includes(n));
    const risers = curNames
      .map((name, i) => {
        const j = prevNames.indexOf(name);
        if (j < 0 || j - i < 2) return null;
        return { name, from: j + 1, to: i + 1 };
      })
      .filter((x): x is { name: string; from: number; to: number } => x != null);

    return {
      days,
      hasData: curEvents.length > 0,
      // flat current
      listenedMs: current.listenedMs,
      listenedCount: current.listenedCount,
      skippedCount: current.skippedCount,
      uniqueArtists: current.uniqueArtists,
      skipRate: current.skipRate,
      topArtists: current.topArtists,
      // rich
      current,
      previous,
      dailyMinutes,
      prevDailyMinutes,
      movers: { newIn, dropped, risers },
    };
  }

  shouldShowWeeklyReport(): boolean {
    const WEEK = 7 * 86_400_000;
    // Show if never shown AND we have some events, OR if 7+ days since last shown
    const hasEvents = this.data.events.length >= 10;
    if (!hasEvents) return false;
    if (!this.data.lastReportAt) return true;
    return Date.now() - this.data.lastReportAt >= WEEK;
  }

  markReportShown() {
    this.data.lastReportAt = Date.now();
    this.scheduleSave();
  }

  // -- discovery mode ----------------------------------------------
  getDiscoveryOnly(): boolean { return this.data.discoveryOnly; }
  setDiscoveryOnly(v: boolean) {
    this.data.discoveryOnly = v;
    this.scheduleSave();
  }

  // -- high-level filter used by the engine ------------------------
  // Returns true if the uri should be dropped from recommendation batch.
  shouldReject(uri: string, artist: string | undefined, libraryArtists?: Set<string>): boolean {
    if (this.freshness(uri) === 0) return true;
    if (artist && this.isArtistRejected(artist)) return true;
    if (this.data.discoveryOnly && artist && libraryArtists?.has(artist)) return true;
    return false;
  }

  // Soft-prefer: sort a batch so that higher-scoring artists + fresher tracks come first.
  rankBatch<T extends { uri: string; artist?: string }>(batch: T[]): T[] {
    return [...batch].sort((a, b) => {
      const fa = this.freshness(a.uri);
      const fb = this.freshness(b.uri);
      if (fa !== fb) return fb - fa; // fresher (higher) first
      const sa = a.artist ? this.getArtistScore(a.artist) : 0;
      const sb = b.artist ? this.getArtistScore(b.artist) : 0;
      return sb - sa;
    });
  }

  // -- diagnostics -------------------------------------------------
  snapshot() {
    return {
      playedCount: Object.keys(this.data.played).length,
      artistsTracked: Object.keys(this.data.artistScores).length,
      topArtists: this.topArtists(5),
      bottomArtists: Object.entries(this.data.artistScores)
        .sort((a, b) => a[1] - b[1]).slice(0, 5)
        .map(([name, score]) => ({ name, score })),
      discoveryOnly: this.data.discoveryOnly,
    };
  }

  reset() {
    this.data = { ...DEFAULT };
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

// Singleton — one store per extension instance.
export const prefs = new PrefsStore();

// ---------------------------------------------------------------
// Mood of the day — picks a mood id based on local hour.
// Pure function; UI can call whenever it needs a default suggestion.
// ---------------------------------------------------------------
export function moodOfTheDay(availableMoodIds: string[]): string | null {
  const hour = new Date().getHours();
  // bands: morning / work / evening / night
  let preferred: string[];
  if (hour >= 6 && hour < 11)       preferred = ["chill", "acoustic", "focus", "indie"];
  else if (hour >= 11 && hour < 17) preferred = ["focus", "indie", "electronic", "chill"];
  else if (hour >= 17 && hour < 22) preferred = ["hype", "party", "drive", "workout"];
  else                               preferred = ["sleep", "chill", "acoustic", "sad"];

  for (const id of preferred) {
    if (availableMoodIds.includes(id)) return id;
  }
  return availableMoodIds[0] || null;
}
