// Audio-features cache + similarity filter.
// Wraps Spotify's /v1/audio-features endpoint with a local cache so we can
// decide whether a candidate track "fits" next to the anchor (current track)
// based on tempo / energy / valence.
//
// Degrades silently: if the endpoint is unavailable (rate limited, removed,
// etc.) we simply return empty features and skip the filter step — the
// recommendation flow still works, just without fine similarity control.

const STORAGE_KEY = "mywave:af:v1";
const CACHE_CAP = 5000;
const BATCH_SIZE = 100;
const NEGATIVE_TTL = 6 * 60 * 60 * 1000; // 6h for failed lookups

// Distance thresholds — tracks outside these are rejected as "too different"
// when we have an anchor to compare against.
const MAX_TEMPO_DIFF = 28;       // BPM
const MAX_ENERGY_DIFF = 0.38;    // 0..1
const MAX_VALENCE_DIFF = 0.55;   // 0..1

export interface Features {
  id: string;
  tempo: number;        // BPM
  energy: number;       // 0..1
  danceability: number; // 0..1
  valence: number;      // 0..1
  acousticness: number; // 0..1
}

interface CacheEntry {
  f: Features | null;   // null = known missing (don't retry for NEGATIVE_TTL)
  t: number;            // cached at
}

// -----------------------------------------------------------------------
// Load / save — localStorage with size cap
// -----------------------------------------------------------------------
let cache: Record<string, CacheEntry> = {};
let loaded = false;
let saveTimer: any = null;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cache = JSON.parse(raw) || {};
  } catch {
    cache = {};
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const entries = Object.entries(cache);
      if (entries.length > CACHE_CAP) {
        // evict oldest by cached-at time
        entries.sort((a, b) => a[1].t - b[1].t);
        const keep = entries.slice(entries.length - CACHE_CAP);
        cache = Object.fromEntries(keep);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {}
  }, 1200);
}

// -----------------------------------------------------------------------
// Fetching
// -----------------------------------------------------------------------
let inflight: Promise<void> | null = null;

async function fetchBatch(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const url = `https://api.spotify.com/v1/audio-features?ids=${ids.join(",")}`;
    const res = await Spicetify.CosmosAsync.get(url);
    const arr = res?.audio_features || [];
    const now = Date.now();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const f = arr[i];
      if (f && typeof f.tempo === "number") {
        cache[id] = {
          t: now,
          f: {
            id,
            tempo: f.tempo,
            energy: f.energy,
            danceability: f.danceability,
            valence: f.valence,
            acousticness: f.acousticness,
          },
        };
      } else {
        // record a negative so we don't hammer
        cache[id] = { t: now, f: null };
      }
    }
    scheduleSave();
  } catch (e) {
    // Mark all as negative to avoid repeated failures for the same batch
    const now = Date.now();
    for (const id of ids) {
      if (!cache[id]) cache[id] = { t: now, f: null };
    }
    console.log("[MyWave] audio-features fetch failed:", (e as any)?.message || e);
  }
}

// Returns a map id->Features (missing keys = no data available).
// Accepts full uris or ids.
export async function getFeatures(uris: string[]): Promise<Map<string, Features>> {
  ensureLoaded();
  const ids = uris.map((u) => (u.includes(":") ? u.split(":").pop()! : u)).filter(Boolean);
  const now = Date.now();
  const missing: string[] = [];

  for (const id of ids) {
    const e = cache[id];
    if (!e) {
      missing.push(id);
    } else if (e.f === null && now - e.t > NEGATIVE_TTL) {
      // negative expired, retry
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    // Serialize fetch rounds to avoid parallel bursts during quick refills.
    // One in-flight at a time is fine — batches are fast.
    if (inflight) { try { await inflight; } catch {} }
    inflight = (async () => {
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        await fetchBatch(missing.slice(i, i + BATCH_SIZE));
      }
    })();
    try { await inflight; } finally { inflight = null; }
  }

  const out = new Map<string, Features>();
  for (const id of ids) {
    const e = cache[id];
    if (e?.f) out.set(id, e.f);
  }
  return out;
}

// -----------------------------------------------------------------------
// Similarity scoring
// -----------------------------------------------------------------------
export function tooFarFromAnchor(anchor: Features, cand: Features): boolean {
  if (Math.abs(anchor.tempo - cand.tempo) > MAX_TEMPO_DIFF) return true;
  if (Math.abs(anchor.energy - cand.energy) > MAX_ENERGY_DIFF) return true;
  if (Math.abs(anchor.valence - cand.valence) > MAX_VALENCE_DIFF) return true;
  return false;
}

// Smaller score = closer to the anchor.
export function distanceFromAnchor(anchor: Features, cand: Features): number {
  const dt = Math.abs(anchor.tempo - cand.tempo) / MAX_TEMPO_DIFF;
  const de = Math.abs(anchor.energy - cand.energy) / MAX_ENERGY_DIFF;
  const dv = Math.abs(anchor.valence - cand.valence) / MAX_VALENCE_DIFF;
  return dt + de * 1.2 + dv * 0.8;
}

// Given an anchor uri and a batch of candidates, drop too-different ones
// and sort remaining by proximity. If we can't get features for the anchor
// the batch is returned unchanged.
export async function filterAndRankByFeatures<T extends { uri: string }>(
  anchorUri: string | null | undefined,
  batch: T[],
): Promise<T[]> {
  if (!anchorUri || batch.length === 0) return batch;
  const allUris = [anchorUri, ...batch.map((b) => b.uri)];
  let feats: Map<string, Features>;
  try {
    feats = await getFeatures(allUris);
  } catch {
    return batch;
  }
  const anchorId = anchorUri.split(":").pop()!;
  const anchor = feats.get(anchorId);
  if (!anchor) return batch; // no anchor data -> don't filter

  const kept: { item: T; dist: number }[] = [];
  for (const item of batch) {
    const id = item.uri.split(":").pop()!;
    const f = feats.get(id);
    if (!f) { kept.push({ item, dist: 999 }); continue; } // unknown -> neutral
    if (tooFarFromAnchor(anchor, f)) continue;
    kept.push({ item, dist: distanceFromAnchor(anchor, f) });
  }
  kept.sort((a, b) => a.dist - b.dist);
  return kept.map((k) => k.item);
}
