"use strict";
(() => {
  // src/engine/constants.ts
  var MOODS = [
    { id: "chill", label: "Chill" },
    { id: "focus", label: "Focus" },
    { id: "hype", label: "Hype" },
    { id: "sad", label: "Sad" },
    { id: "drive", label: "Drive" },
    { id: "romantic", label: "Romantic" },
    { id: "party", label: "Party" },
    { id: "workout", label: "Workout" },
    { id: "sleep", label: "Sleep" },
    { id: "acoustic", label: "Acoustic" },
    { id: "indie", label: "Indie" },
    { id: "electronic", label: "Electronic" }
  ];
  var EQ_COLS = 13;
  var EQ_ROWS = 7;
  var EQ_COLS_MINI = 9;
  var EQ_ROWS_MINI = 5;

  // src/engine/prefs.ts
  var STORAGE_KEY = "mywave:prefs:v1";
  var FRESHNESS_HARD_DAYS = 7;
  var FRESHNESS_SOFT_DAYS = 30;
  var PLAYED_CAP = 2e3;
  var ARTIST_SCORE_MIN = -6;
  var ARTIST_SCORE_MAX = 10;
  var ARTIST_REJECT_THRESHOLD = -4;
  var LISTEN_RATIO = 0.8;
  var SKIP_SECONDS = 10;
  var EVENTS_CAP = 3e3;
  var DEFAULT = {
    played: {},
    artistScores: {},
    discoveryOnly: false,
    events: [],
    lastReportAt: 0
  };
  function loadRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const parsed = JSON.parse(raw);
      return {
        played: parsed.played && typeof parsed.played === "object" ? parsed.played : {},
        artistScores: parsed.artistScores && typeof parsed.artistScores === "object" ? parsed.artistScores : {},
        discoveryOnly: !!parsed.discoveryOnly,
        events: Array.isArray(parsed.events) ? parsed.events : [],
        lastReportAt: Number(parsed.lastReportAt) || 0
      };
    } catch {
      return { ...DEFAULT };
    }
  }
  var PrefsStore = class {
    constructor() {
      this.saveTimer = null;
      this.data = loadRaw();
    }
    // -- persistence -------------------------------------------------
    scheduleSave() {
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
    recordPlayed(uri) {
      if (!uri) return;
      const prev = this.data.played[uri];
      this.data.played[uri] = {
        t: Date.now(),
        n: (prev?.n || 0) + 1
      };
      this.capPlayed();
      this.scheduleSave();
    }
    capPlayed() {
      const entries = Object.entries(this.data.played);
      if (entries.length <= PLAYED_CAP) return;
      entries.sort((a, b) => a[1].t - b[1].t);
      const keep = entries.slice(entries.length - PLAYED_CAP);
      const next = {};
      for (const [k, v] of keep) next[k] = v;
      this.data.played = next;
    }
    getPlayedAt(uri) {
      return this.data.played[uri]?.t ?? null;
    }
    // Freshness: 0 = blocked, 1 = soft (deprioritize), 2 = ok
    freshness(uri) {
      const t2 = this.getPlayedAt(uri);
      if (!t2) return 2;
      const days = (Date.now() - t2) / 864e5;
      if (days < FRESHNESS_HARD_DAYS) return 0;
      if (days < FRESHNESS_SOFT_DAYS) return 1;
      return 2;
    }
    // -- artist scoring ----------------------------------------------
    bumpArtist(name, delta) {
      if (!name) return;
      const cur = this.data.artistScores[name] || 0;
      const next = Math.max(ARTIST_SCORE_MIN, Math.min(ARTIST_SCORE_MAX, cur + delta));
      if (next === 0) delete this.data.artistScores[name];
      else this.data.artistScores[name] = next;
      this.scheduleSave();
    }
    getArtistScore(name) {
      return this.data.artistScores[name] || 0;
    }
    isArtistRejected(name) {
      return this.getArtistScore(name) <= ARTIST_REJECT_THRESHOLD;
    }
    topArtists(limit = 10) {
      return Object.entries(this.data.artistScores).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, score]) => ({ name, score }));
    }
    // -- play verdict from duration ratio ----------------------------
    // Called when a track transitions to a new one. Returns the verdict
    // applied so callers can log / notify.
    registerVerdict(uri, artist, playedMs, totalMs) {
      if (!uri || !artist || totalMs <= 0) return "neutral";
      const ratio = playedMs / totalMs;
      let verdict;
      if (playedMs / 1e3 <= SKIP_SECONDS) {
        this.bumpArtist(artist, -2);
        verdict = "skipped";
      } else if (ratio >= LISTEN_RATIO) {
        this.bumpArtist(artist, 1);
        verdict = "listened";
      } else {
        verdict = "neutral";
      }
      this.data.events.push({
        t: Date.now(),
        v: verdict === "listened" ? 2 : verdict === "skipped" ? 0 : 1,
        a: artist,
        ms: Math.max(0, Math.floor(playedMs))
      });
      if (this.data.events.length > EVENTS_CAP) {
        this.data.events.splice(0, this.data.events.length - EVENTS_CAP);
      }
      this.scheduleSave();
      return verdict;
    }
    // -- weekly report -----------------------------------------------
    // Aggregate verdict events into (current period, previous period, diffs).
    getReport(days = 7) {
      const now = Date.now();
      const DAY = 864e5;
      const currentSince = now - days * DAY;
      const previousSince = now - 2 * days * DAY;
      const curEvents = this.data.events.filter((e) => e.t >= currentSince);
      const prevEvents = this.data.events.filter((e) => e.t >= previousSince && e.t < currentSince);
      const stats = (events) => {
        let listenedMs = 0, listenedCount = 0, skippedCount = 0;
        const artistMs = {};
        const artistPlays = {};
        for (const e of events) {
          if (e.v === 2) {
            listenedMs += e.ms;
            listenedCount++;
          } else if (e.v === 0) {
            skippedCount++;
          }
          artistMs[e.a] = (artistMs[e.a] || 0) + e.ms;
          artistPlays[e.a] = (artistPlays[e.a] || 0) + 1;
        }
        const topArtists = Object.entries(artistMs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, ms]) => ({ name, ms, plays: artistPlays[name] || 0 }));
        const total = listenedCount + skippedCount;
        return {
          listenedMs,
          listenedCount,
          skippedCount,
          uniqueArtists: Object.keys(artistPlays).length,
          skipRate: total > 0 ? skippedCount / total : 0,
          topArtists
        };
      };
      const current2 = stats(curEvents);
      const previous = stats(prevEvents);
      const dailyMin = (events, startMs) => {
        const buckets = new Array(days).fill(0);
        for (const e of events) {
          if (e.v !== 2) continue;
          const idx = Math.floor((e.t - startMs) / DAY);
          if (idx >= 0 && idx < days) buckets[idx] += e.ms / 6e4;
        }
        return buckets;
      };
      const dailyMinutes = dailyMin(curEvents, currentSince);
      const prevDailyMinutes = dailyMin(prevEvents, previousSince);
      const prevNames = previous.topArtists.map((a) => a.name);
      const curNames = current2.topArtists.map((a) => a.name);
      const newIn = curNames.filter((n) => !prevNames.includes(n));
      const dropped = prevNames.filter((n) => !curNames.includes(n));
      const risers = curNames.map((name, i) => {
        const j = prevNames.indexOf(name);
        if (j < 0 || j - i < 2) return null;
        return { name, from: j + 1, to: i + 1 };
      }).filter((x) => x != null);
      return {
        days,
        hasData: curEvents.length > 0,
        // flat current
        listenedMs: current2.listenedMs,
        listenedCount: current2.listenedCount,
        skippedCount: current2.skippedCount,
        uniqueArtists: current2.uniqueArtists,
        skipRate: current2.skipRate,
        topArtists: current2.topArtists,
        // rich
        current: current2,
        previous,
        dailyMinutes,
        prevDailyMinutes,
        movers: { newIn, dropped, risers }
      };
    }
    shouldShowWeeklyReport() {
      const WEEK = 7 * 864e5;
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
    getDiscoveryOnly() {
      return this.data.discoveryOnly;
    }
    setDiscoveryOnly(v) {
      this.data.discoveryOnly = v;
      this.scheduleSave();
    }
    // -- high-level filter used by the engine ------------------------
    // Returns true if the uri should be dropped from recommendation batch.
    shouldReject(uri, artist, libraryArtists) {
      if (this.freshness(uri) === 0) return true;
      if (artist && this.isArtistRejected(artist)) return true;
      if (this.data.discoveryOnly && artist && libraryArtists?.has(artist)) return true;
      return false;
    }
    // Soft-prefer: sort a batch so that higher-scoring artists + fresher tracks come first.
    rankBatch(batch) {
      return [...batch].sort((a, b) => {
        const fa = this.freshness(a.uri);
        const fb = this.freshness(b.uri);
        if (fa !== fb) return fb - fa;
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
        bottomArtists: Object.entries(this.data.artistScores).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([name, score]) => ({ name, score })),
        discoveryOnly: this.data.discoveryOnly
      };
    }
    reset() {
      this.data = { ...DEFAULT };
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
      }
    }
  };
  var prefs = new PrefsStore();
  function moodOfTheDay(availableMoodIds) {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    let preferred;
    if (hour >= 6 && hour < 11) preferred = ["chill", "acoustic", "focus", "indie"];
    else if (hour >= 11 && hour < 17) preferred = ["focus", "indie", "electronic", "chill"];
    else if (hour >= 17 && hour < 22) preferred = ["hype", "party", "drive", "workout"];
    else preferred = ["sleep", "chill", "acoustic", "sad"];
    for (const id of preferred) {
      if (availableMoodIds.includes(id)) return id;
    }
    return availableMoodIds[0] || null;
  }

  // src/engine/audioFeatures.ts
  var STORAGE_KEY2 = "mywave:af:v1";
  var CACHE_CAP = 5e3;
  var BATCH_SIZE = 100;
  var NEGATIVE_TTL = 6 * 60 * 60 * 1e3;
  var MAX_TEMPO_DIFF = 28;
  var MAX_ENERGY_DIFF = 0.38;
  var MAX_VALENCE_DIFF = 0.55;
  var cache = {};
  var loaded = false;
  var saveTimer = null;
  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY2);
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
          entries.sort((a, b) => a[1].t - b[1].t);
          const keep = entries.slice(entries.length - CACHE_CAP);
          cache = Object.fromEntries(keep);
        }
        localStorage.setItem(STORAGE_KEY2, JSON.stringify(cache));
      } catch {
      }
    }, 1200);
  }
  var inflight = null;
  async function fetchBatch(ids) {
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
              acousticness: f.acousticness
            }
          };
        } else {
          cache[id] = { t: now, f: null };
        }
      }
      scheduleSave();
    } catch (e) {
      const now = Date.now();
      for (const id of ids) {
        if (!cache[id]) cache[id] = { t: now, f: null };
      }
      console.log("[MyWave] audio-features fetch failed:", e?.message || e);
    }
  }
  async function getFeatures(uris) {
    ensureLoaded();
    const ids = uris.map((u) => u.includes(":") ? u.split(":").pop() : u).filter(Boolean);
    const now = Date.now();
    const missing = [];
    for (const id of ids) {
      const e = cache[id];
      if (!e) {
        missing.push(id);
      } else if (e.f === null && now - e.t > NEGATIVE_TTL) {
        missing.push(id);
      }
    }
    if (missing.length > 0) {
      if (inflight) {
        try {
          await inflight;
        } catch {
        }
      }
      inflight = (async () => {
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
          await fetchBatch(missing.slice(i, i + BATCH_SIZE));
        }
      })();
      try {
        await inflight;
      } finally {
        inflight = null;
      }
    }
    const out = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const e = cache[id];
      if (e?.f) out.set(id, e.f);
    }
    return out;
  }
  function tooFarFromAnchor(anchor, cand) {
    if (Math.abs(anchor.tempo - cand.tempo) > MAX_TEMPO_DIFF) return true;
    if (Math.abs(anchor.energy - cand.energy) > MAX_ENERGY_DIFF) return true;
    if (Math.abs(anchor.valence - cand.valence) > MAX_VALENCE_DIFF) return true;
    return false;
  }
  function distanceFromAnchor(anchor, cand) {
    const dt = Math.abs(anchor.tempo - cand.tempo) / MAX_TEMPO_DIFF;
    const de = Math.abs(anchor.energy - cand.energy) / MAX_ENERGY_DIFF;
    const dv = Math.abs(anchor.valence - cand.valence) / MAX_VALENCE_DIFF;
    return dt + de * 1.2 + dv * 0.8;
  }
  async function filterAndRankByFeatures(anchorUri, batch) {
    if (!anchorUri || batch.length === 0) return batch;
    const allUris = [anchorUri, ...batch.map((b) => b.uri)];
    let feats;
    try {
      feats = await getFeatures(allUris);
    } catch {
      return batch;
    }
    const anchorId = anchorUri.split(":").pop();
    const anchor = feats.get(anchorId);
    if (!anchor) return batch;
    const kept = [];
    for (const item of batch) {
      const id = item.uri.split(":").pop();
      const f = feats.get(id);
      if (!f) {
        kept.push({ item, dist: 999 });
        continue;
      }
      if (tooFarFromAnchor(anchor, f)) continue;
      kept.push({ item, dist: distanceFromAnchor(anchor, f) });
    }
    kept.sort((a, b) => a.dist - b.dist);
    return kept.map((k) => k.item);
  }

  // src/engine/spotifyApi.ts
  async function getAccessToken() {
    try {
      const platform = Spicetify.Platform;
      if (platform?.Session?.accessToken) return platform.Session.accessToken;
      const state = await platform?.AuthorizationAPI?.getState?.();
      if (state?.token?.accessToken) return state.token.accessToken;
    } catch {
    }
    return null;
  }
  async function getUserPlaylists() {
    try {
      const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
      const items = rootlist?.items || [];
      return items.filter((i) => i.type === "playlist").slice(0, 20).map((pl) => ({
        name: pl.name || "Untitled",
        uri: pl.uri,
        imageUrl: pl.images?.[0]?.url || ""
      }));
    } catch {
    }
    return [];
  }
  async function searchArtists(query) {
    const encoded = encodeURIComponent(query);
    const token = await getAccessToken();
    if (!token) {
      console.error("[MyWave] No access token available");
      return [];
    }
    try {
      const resp = await fetch(
        `https://spclient.wg.spotify.com/searchview/km/v4/search/${encoded}?limit=6&catalogue=&entityType=artist&platform=desktop`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        console.log("[MyWave] spclient search response:", data);
        const hits = data?.results?.artists?.hits || data?.artists?.hits || [];
        if (hits.length > 0) {
          return hits.map((a) => ({
            name: a.name || "",
            id: a.uri?.split(":").pop() || "",
            imageUrl: a.image || a.imageUrl || ""
          }));
        }
      } else {
        console.log("[MyWave] spclient search status:", resp.status);
      }
    } catch (e) {
      console.log("[MyWave] spclient search failed:", e);
    }
    try {
      const resp = await fetch(
        `https://api.spotify.com/v1/search?q=${encoded}&type=artist&limit=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        return (data?.artists?.items || []).map((a) => ({
          name: a.name,
          id: a.id,
          imageUrl: a.images?.[a.images.length - 1]?.url || ""
        }));
      }
    } catch (e) {
      console.error("[MyWave] All search methods failed:", e);
    }
    return [];
  }
  async function searchPlaylists(query) {
    const token = await getAccessToken();
    if (!token) return [];
    const encoded = encodeURIComponent(query);
    try {
      const resp = await fetch(
        `https://spclient.wg.spotify.com/searchview/km/v4/search/${encoded}?limit=6&catalogue=&entityType=playlist&platform=desktop`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const hits = data?.results?.playlists?.hits || data?.playlists?.hits || [];
        if (hits.length > 0) {
          return hits.map((p) => ({
            name: p.name || "",
            uri: p.uri || "",
            imageUrl: p.image || p.imageUrl || "",
            owner: p.owner?.name || ""
          }));
        }
      }
    } catch {
    }
    try {
      const resp = await fetch(
        `https://api.spotify.com/v1/search?q=${encoded}&type=playlist&limit=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        return (data?.playlists?.items || []).map((p) => ({
          name: p.name,
          uri: p.uri,
          imageUrl: p.images?.[p.images.length - 1]?.url || "",
          owner: p.owner?.display_name || ""
        }));
      }
    } catch {
    }
    return [];
  }
  async function searchInternal(query, type, limit) {
    const token = await getAccessToken();
    if (token) {
      try {
        const resp = await fetch(
          `https://spclient.wg.spotify.com/searchview/km/v4/search/${encodeURIComponent(query)}?limit=${limit}&catalogue=&entityType=${type}&platform=desktop`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) return await resp.json();
      } catch {
      }
    }
    return Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );
  }
  async function resolveArtistId(artistName, topLikedArtist, topLikedArtistUri) {
    if (topLikedArtistUri && artistName === topLikedArtist) {
      return topLikedArtistUri.split(":").pop() || null;
    }
    try {
      const token = await getAccessToken();
      if (token) {
        const resp = await fetch(
          `https://spclient.wg.spotify.com/searchview/km/v4/search/${encodeURIComponent(artistName)}?limit=3&catalogue=&entityType=artist&platform=desktop`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const data = await resp.json();
          const hits = data?.results?.artists?.hits || data?.artists?.hits || [];
          const match = hits.find((a) => (a.name || "").toLowerCase() === artistName.toLowerCase()) || hits[0];
          if (match?.uri) return match.uri.split(":").pop() || null;
        }
      }
    } catch (e) {
      console.log("[MyWave] spclient artist resolve failed:", e);
    }
    try {
      const res = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`
      );
      return res?.artists?.items?.[0]?.id || null;
    } catch {
    }
    return null;
  }

  // src/engine/WaveEngine.ts
  var _WaveEngine = class _WaveEngine {
    constructor() {
      this.playedUris = /* @__PURE__ */ new Set();
      this.blacklist = /* @__PURE__ */ new Set();
      this.isActive = false;
      this.isLoading = false;
      this.seedTrackName = "";
      this.currentTrackName = "";
      this.currentArtistName = "";
      this.currentImageUrl = "";
      this.currentUri = "";
      this.lockedArtist = null;
      this.preLockState = null;
      this.songChangeListener = null;
      this.librarySeeds = [];
      this.stateListeners = /* @__PURE__ */ new Set();
      this.history = [];
      this.activeMood = null;
      this.isFavoritesMode = false;
      this.historyReplayUri = null;
      this.sessionStart = 0;
      this.uniqueArtists = /* @__PURE__ */ new Set();
      this.artistCounts = /* @__PURE__ */ new Map();
      this.activeContextUri = null;
      this._isAdopting = false;
      this._pendingAdoptSeed = null;
      this._recsBackoffUntil = 0;
      this.topLikedArtist = null;
      this.topLikedArtistUri = null;
      this.pinnedMoods = ["__favorites__"];
      this.pinnedArtists = [];
      this.pinnedPlaylists = [];
      // Skip-learning: track timing of the currently-playing track so we can
      // issue a verdict (listened / skipped) when the user advances.
      this._trackStartMs = 0;
      this._lastTrackUri = "";
      this._lastTrackArtist = "";
      this._lastTrackDurationMs = 0;
      this._refillSeedPool = [];
      // rotating pool of good recent seeds
      this._refillSeedIdx = 0;
      this._tracksSinceReseed = 0;
      this._nextReseedAt = 0;
      // auto-reseed after this many tracks
      this._consecutiveSkips = 0;
      this._isRefilling = false;
      this.loadPins();
    }
    // skip streak counter
    _addPlayedUri(uri) {
      if (this.playedUris.has(uri)) {
        this.playedUris.delete(uri);
      } else if (this.playedUris.size >= _WaveEngine.PLAYED_URIS_CAP) {
        const oldest = this.playedUris.values().next().value;
        if (oldest) this.playedUris.delete(oldest);
      }
      this.playedUris.add(uri);
    }
    loadPins() {
      try {
        const raw = localStorage.getItem(_WaveEngine.STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.moods)) this.pinnedMoods = data.moods;
          if (Array.isArray(data.artists)) this.pinnedArtists = data.artists;
          if (Array.isArray(data.playlists)) this.pinnedPlaylists = data.playlists;
        }
      } catch {
      }
    }
    savePins() {
      try {
        localStorage.setItem(_WaveEngine.STORAGE_KEY, JSON.stringify({
          moods: this.pinnedMoods,
          artists: this.pinnedArtists,
          playlists: this.pinnedPlaylists
        }));
      } catch {
      }
    }
    getState() {
      const topArtists = [...this.artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
      return {
        isActive: this.isActive,
        isLoading: this.isLoading,
        seedTrackName: this.seedTrackName,
        currentTrackName: this.currentTrackName,
        currentArtistName: this.currentArtistName,
        currentImageUrl: this.currentImageUrl,
        currentUri: this.currentUri,
        lockedArtist: this.lockedArtist,
        playedCount: this.playedUris.size,
        history: this.history,
        activeMood: this.activeMood,
        isFavoritesMode: this.isFavoritesMode,
        sessionMinutes: this.sessionStart ? Math.floor((Date.now() - this.sessionStart) / 6e4) : 0,
        uniqueArtistsCount: this.uniqueArtists.size,
        topArtists,
        topLikedArtist: this.topLikedArtist,
        pinnedMoods: [...this.pinnedMoods],
        pinnedArtists: [...this.pinnedArtists],
        pinnedPlaylists: [...this.pinnedPlaylists],
        discoveryOnly: prefs.getDiscoveryOnly()
      };
    }
    subscribe(cb) {
      this.stateListeners.add(cb);
      return () => this.stateListeners.delete(cb);
    }
    notify() {
      this.stateListeners.forEach((cb) => cb());
    }
    async start(moodId) {
      if (this.isActive || this.isLoading) return;
      if (!moodId) {
        const currentTrack = Spicetify.Player.data?.item;
        if (!currentTrack) {
          Spicetify.showNotification("Play a track first to start Mix", true);
          return;
        }
      }
      this.isLoading = true;
      this.activeMood = moodId || null;
      this.notify();
      try {
        this.playedUris.clear();
        this.blacklist.clear();
        this.history = [];
        this.uniqueArtists.clear();
        this.artistCounts.clear();
        this.sessionStart = Date.now();
        this.lockedArtist = null;
        this.isFavoritesMode = false;
        this.preLockState = null;
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        if (moodId) {
          this.seedTrackName = MOODS.find((m) => m.id === moodId)?.label || moodId;
          await this.startMoodStation(moodId);
        } else {
          const currentTrack = Spicetify.Player.data.item;
          this.seedTrackName = currentTrack.metadata?.title || "Unknown";
          this.currentTrackName = this.seedTrackName;
          this.currentArtistName = currentTrack.metadata?.artist_name || "";
          this.currentImageUrl = currentTrack.metadata?.image_url || "";
          this.currentUri = currentTrack.uri;
          await this.loadLibrarySeeds();
          await this.startMultiSeed(currentTrack.uri);
        }
        this.isActive = true;
        this.isLoading = false;
        this.attachListener();
        this._captureContext();
        this.notify();
        Spicetify.showNotification("Mix started!");
      } catch (err) {
        console.error("[MyWave] Failed to start:", err);
        this.isLoading = false;
        this.notify();
        Spicetify.showNotification("Failed to start mix", true);
      }
    }
    async startFromPlaylist(playlistUri, playlistName) {
      if (this.isActive || this.isLoading) return;
      this.isLoading = true;
      this.activeMood = null;
      this.isFavoritesMode = false;
      this.notify();
      try {
        this.playedUris.clear();
        this.blacklist.clear();
        this.history = [];
        this.uniqueArtists.clear();
        this.artistCounts.clear();
        this.sessionStart = Date.now();
        this.lockedArtist = null;
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        const content = await Spicetify.Platform.PlaylistAPI.getContents(playlistUri);
        const tracks = (content?.items || []).filter((t2) => t2.uri?.startsWith("spotify:track:")).map((t2) => t2.uri);
        if (tracks.length === 0) {
          Spicetify.showNotification("Playlist is empty", true);
          this.isLoading = false;
          this.notify();
          return;
        }
        this.librarySeeds = tracks;
        this.seedTrackName = playlistName || "Playlist";
        await this.startMultiSeed(tracks[0]);
        this.isActive = true;
        this.isLoading = false;
        this.attachListener();
        this._captureContext();
        this.notify();
        Spicetify.showNotification("Mix started from playlist!");
      } catch (err) {
        console.error("[MyWave] Playlist start failed:", err);
        this.isLoading = false;
        this.notify();
        Spicetify.showNotification("Failed to start from playlist", true);
      }
    }
    async reseed() {
      if (!this.isActive) return;
      this.isLoading = true;
      this.notify();
      try {
        if (this.lockedArtist) {
          await this.startArtistStation();
        } else if (this.isFavoritesMode) {
          await this.loadLibrarySeeds();
          if (this.librarySeeds.length > 0) {
            const randomSeed = this.librarySeeds[Math.floor(Math.random() * this.librarySeeds.length)];
            this.seedTrackName = "My Favorites";
            await this.startMultiSeed(randomSeed);
          }
        } else if (this.activeMood) {
          this.seedTrackName = MOODS.find((m) => m.id === this.activeMood)?.label || this.activeMood;
          await this.startMoodStation(this.activeMood);
        } else {
          const cur = Spicetify.Player.data?.item;
          if (cur?.uri) {
            this.seedTrackName = cur.metadata?.title || "Unknown";
            await this.startMultiSeed(cur.uri);
          }
        }
        this._captureContext();
        this.isLoading = false;
        this.notify();
        Spicetify.showNotification("New mix started!");
      } catch (e) {
        this.isLoading = false;
        this.notify();
        console.error("[MyWave] Reseed failed:", e);
      }
    }
    async reseedFromTrack() {
      if (!this.isActive) return;
      const cur = Spicetify.Player.data?.item;
      if (!cur?.uri) return;
      this.isLoading = true;
      this.lockedArtist = null;
      this.activeMood = null;
      this.seedTrackName = cur.metadata?.title || "Unknown";
      this.notify();
      try {
        await this.startMultiSeed(cur.uri);
        this._captureContext();
        this.isLoading = false;
        this.notify();
        Spicetify.showNotification(`Mix from: ${this.seedTrackName}`);
      } catch (e) {
        this.isLoading = false;
        this.notify();
        console.error("[MyWave] Reseed from track failed:", e);
      }
    }
    togglePinMood(moodId) {
      const idx = this.pinnedMoods.indexOf(moodId);
      if (idx >= 0) {
        this.pinnedMoods.splice(idx, 1);
        Spicetify.showNotification("Unpinned");
      } else {
        this.pinnedMoods.push(moodId);
        Spicetify.showNotification(`Pinned: ${MOODS.find((m) => m.id === moodId)?.label || moodId}`);
      }
      this.savePins();
      this.notify();
    }
    togglePinFavorites() {
      const idx = this.pinnedMoods.indexOf("__favorites__");
      if (idx >= 0) {
        this.pinnedMoods.splice(idx, 1);
        Spicetify.showNotification("Favorites unpinned");
      } else {
        this.pinnedMoods.push("__favorites__");
        Spicetify.showNotification("Pinned: Favorites");
      }
      this.savePins();
      this.notify();
    }
    togglePinArtist(name) {
      const idx = this.pinnedArtists.indexOf(name);
      if (idx >= 0) {
        this.pinnedArtists.splice(idx, 1);
        Spicetify.showNotification(`Unpinned: ${name}`);
      } else {
        this.pinnedArtists.push(name);
        Spicetify.showNotification(`Pinned: ${name}`);
      }
      this.savePins();
      this.notify();
    }
    togglePinPlaylist(name, uri) {
      const idx = this.pinnedPlaylists.findIndex((p) => p.uri === uri);
      if (idx >= 0) {
        this.pinnedPlaylists.splice(idx, 1);
        Spicetify.showNotification(`Unpinned: ${name}`);
      } else {
        this.pinnedPlaylists.push({ name, uri });
        Spicetify.showNotification(`Pinned: ${name}`);
      }
      this.savePins();
      this.notify();
    }
    async searchPlaylists(query) {
      return searchPlaylists(query);
    }
    getAccessToken() {
      return getAccessToken();
    }
    async getUserPlaylists() {
      return getUserPlaylists();
    }
    async searchArtists(query) {
      return searchArtists(query);
    }
    async startFavorites() {
      if (this.isActive || this.isLoading) return;
      this.isLoading = true;
      this.isFavoritesMode = true;
      this.activeMood = null;
      this.notify();
      try {
        this.playedUris.clear();
        this.blacklist.clear();
        this.history = [];
        this.uniqueArtists.clear();
        this.artistCounts.clear();
        this.sessionStart = Date.now();
        this.lockedArtist = null;
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        await this.loadLibrarySeeds();
        if (this.librarySeeds.length === 0) {
          Spicetify.showNotification("No liked songs found", true);
          this.isLoading = false;
          this.isFavoritesMode = false;
          this.notify();
          return;
        }
        this.seedTrackName = "My Favorites";
        await this.startMultiSeed(this.librarySeeds[0]);
        this.isActive = true;
        this.isLoading = false;
        this.attachListener();
        this._captureContext();
        this.notify();
        Spicetify.showNotification("Mix: Playing from your favorites!");
      } catch (err) {
        console.error("[MyWave] Favorites start failed:", err);
        this.isLoading = false;
        this.isFavoritesMode = false;
        this.notify();
        Spicetify.showNotification("Failed to start favorites mix", true);
      }
    }
    toggleLockArtist() {
      if (!this.isActive) return;
      if (this.lockedArtist) {
        const prev = this.preLockState;
        this.lockedArtist = null;
        this.preLockState = null;
        if (prev) {
          this.activeMood = prev.activeMood;
          this.isFavoritesMode = prev.isFavoritesMode;
          this.seedTrackName = prev.seedTrackName;
          this.notify();
          this.reseed().catch(() => {
          });
        } else {
          this.notify();
        }
        Spicetify.showNotification("Artist unlocked");
      } else {
        this.preLockState = {
          activeMood: this.activeMood,
          isFavoritesMode: this.isFavoritesMode,
          seedTrackName: this.seedTrackName
        };
        this.lockedArtist = this.currentArtistName;
        this.activeMood = null;
        this.isFavoritesMode = false;
        this.seedTrackName = this.currentArtistName;
        this.notify();
        Spicetify.showNotification(`Mixing from ${this.currentArtistName}`);
        this.startArtistStation().catch(() => {
        });
      }
    }
    async likeCurrentTrack() {
      if (!this.currentUri) return;
      try {
        await Spicetify.Platform.LibraryAPI.add({ uris: [this.currentUri] });
        if (this.currentArtistName) prefs.bumpArtist(this.currentArtistName, 4);
        Spicetify.showNotification("Added to Liked Songs");
      } catch {
      }
    }
    async dislikeCurrentTrack() {
      if (!this.currentUri) return;
      this.blacklist.add(this.currentUri);
      if (this.currentArtistName) prefs.bumpArtist(this.currentArtistName, -10);
      Spicetify.Player.next();
    }
    async moreLikeThis() {
      if (!this.isActive || !this.currentUri) return;
      const seedId = this.currentUri.split(":").pop();
      if (!seedId) return;
      Spicetify.showNotification("Finding more like this...");
      try {
        const rec = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/recommendations?seed_tracks=${seedId}&limit=30`
        );
        if (rec?.tracks?.length > 0) {
          const candidates = rec.tracks.map((t2) => ({ uri: t2.uri, artist: t2.artists?.[0]?.name })).filter((c) => c.uri && !this.playedUris.has(c.uri) && !this.blacklist.has(c.uri) && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists));
          const ranked = prefs.rankBatch(candidates);
          const filtered = await filterAndRankByFeatures(this.currentUri, ranked);
          const picks = (filtered.length > 0 ? filtered : ranked).slice(0, 15);
          if (picks.length > 0) {
            await Spicetify.addToQueue(picks.map((c) => ({ uri: c.uri })));
            this.seedTrackName = this.currentTrackName;
            this._tracksSinceReseed = 0;
            this._nextReseedAt = this._pickReseedInterval();
            this._refillSeedPool.unshift(this.currentUri);
            if (this._refillSeedPool.length > 8) this._refillSeedPool.pop();
            this.notify();
            Spicetify.showNotification(`Queued ${picks.length} similar tracks`);
            return;
          }
        }
        Spicetify.showNotification("No similar tracks found", true);
      } catch (e) {
        console.log("[MyWave] moreLikeThis failed:", e);
        Spicetify.showNotification("Failed to find similar tracks", true);
      }
    }
    playFromHistory(uri) {
      this.historyReplayUri = uri;
      try {
        Spicetify.Platform.PlayerAPI.play({ uri }, {}, {});
      } catch {
      }
    }
    // Multi-seed: try recommendations API with 429 backoff, fallback to station
    async startMultiSeed(currentUri) {
      const seeds = this.pickMultipleSeeds(currentUri, 5);
      const seedIds = seeds.map((s) => s.split(":").pop()).filter(Boolean);
      if (Date.now() > this._recsBackoffUntil) {
        try {
          const token = await this.getAccessToken();
          const url = `https://spclient.wg.spotify.com/inspiredby-mix/v2/seed_to_playlist/${seedIds.map((id) => `spotify:track:${id}`).join(",")}?responseFormat=json`;
          let uris = [];
          if (token) {
            try {
              const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
              if (resp.ok) {
                const data = await resp.json();
                uris = (data?.tracks || []).map((t2) => t2.uri).filter(Boolean);
              }
            } catch {
            }
          }
          if (uris.length === 0) {
            const rec = await Spicetify.CosmosAsync.get(
              `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=50`
            );
            uris = (rec?.tracks || []).map((t2) => t2.uri).filter(Boolean);
          }
          if (uris.length > 0) {
            const filtered = uris.filter((u) => !this.playedUris.has(u) && !this.blacklist.has(u));
            const toPlay = filtered.length > 0 ? filtered : uris;
            await Spicetify.addToQueue(toPlay.slice(0, 20).map((u) => ({ uri: u })));
            await Spicetify.Platform.PlayerAPI.play({ uri: toPlay[0] }, {}, {});
            console.log("[MyWave] Started via recommendations,", toPlay.length, "tracks");
            return;
          }
        } catch (e) {
          const status = e?.status || e?.response?.status || e?.statusCode;
          if (status === 429) {
            const retryAfter = parseInt(e?.headers?.["retry-after"] || "300", 10);
            console.log(`[MyWave] Recommendations 429, backing off ${retryAfter}s`);
            this._recsBackoffUntil = Date.now() + retryAfter * 1e3;
          } else {
            console.log("[MyWave] Recommendations failed (status:", status, "):", e);
          }
        }
      }
      const seedId = seedIds[0];
      await this.playStation(`spotify:station:track:${seedId}`);
    }
    pickMultipleSeeds(currentUri, count) {
      const result = [currentUri];
      const pool = [...this.librarySeeds].filter((u) => u !== currentUri);
      for (let i = 0; i < count - 1 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        result.push(pool.splice(idx, 1)[0]);
      }
      return result;
    }
    async startArtistStation() {
      if (!this.lockedArtist) return;
      const item = Spicetify.Player.data?.item;
      const artistUri = item?.metadata?.artist_uri || item?.artists?.[0]?.uri;
      if (artistUri) {
        const artistId2 = artistUri.split(":").pop();
        try {
          await this.playStation(`spotify:station:artist:${artistId2}`);
          return;
        } catch {
        }
      }
      const artistId = await this.resolveArtistId(this.lockedArtist);
      if (artistId) {
        await this.playStation(`spotify:station:artist:${artistId}`);
      }
    }
    searchInternal(query, type, limit) {
      return searchInternal(query, type, limit);
    }
    async startMoodStation(moodId) {
      const data = await this.searchInternal(moodId, "playlist", 5);
      const hits = data?.results?.playlists?.hits || data?.playlists?.items || [];
      if (hits.length > 0) {
        const best = hits.find((p) => {
          const owner = p.owner?.name || p.owner?.display_name || p.owner?.id || "";
          return owner.toLowerCase() === "spotify";
        }) || hits[0];
        const uri = best.uri || (best.id ? `spotify:playlist:${best.id}` : null);
        if (uri) {
          const wasShuffle = !!Spicetify.Player.getShuffle?.();
          Spicetify.Player.setShuffle?.(true);
          await Spicetify.Platform.PlayerAPI.play(
            { uri },
            {},
            { skipTo: { trackIndex: Math.floor(Math.random() * 30) } }
          );
          if (!wasShuffle) setTimeout(() => Spicetify.Player.setShuffle?.(false), 2e3);
          return;
        }
      }
      throw new Error("Could not start mood station");
    }
    async playStation(stationUri) {
      try {
        await Spicetify.Platform.PlayerAPI.play(
          { uri: stationUri },
          {},
          { skipTo: { trackIndex: 0 } }
        );
        return;
      } catch (e) {
        console.log("[MyWave] PlayerAPI failed:", e);
      }
      try {
        await Spicetify.Player.playUri(stationUri);
        return;
      } catch (e) {
        console.log("[MyWave] playUri failed:", e);
      }
      throw new Error("Could not start station");
    }
    async loadLibrarySeeds() {
      try {
        const liked = await Spicetify.Platform.LibraryAPI.getTracks({
          limit: 200,
          offset: 0,
          sort: { field: "ADDED_AT", order: "DESC" }
        });
        if (liked?.items?.length) {
          this.librarySeeds = liked.items.map((t2) => t2.uri).filter(Boolean);
          return;
        }
      } catch {
      }
      try {
        const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
        const playlists = rootlist?.items?.filter((i) => i.type === "playlist") || [];
        const seeds = [];
        for (const pl of playlists.slice(0, 5)) {
          try {
            const content = await Spicetify.Platform.PlaylistAPI.getContents(pl.uri);
            if (content?.items) {
              for (const item of content.items.slice(0, 50)) {
                if (item.uri?.startsWith("spotify:track:")) seeds.push(item.uri);
              }
            }
          } catch {
          }
        }
        this.librarySeeds = seeds;
      } catch {
      }
    }
    async loadTopLikedArtist() {
      try {
        const liked = await Spicetify.Platform.LibraryAPI.getTracks({
          limit: 200,
          offset: 0,
          sort: { field: "ADDED_AT", order: "DESC" }
        });
        if (!liked?.items?.length) return;
        const counts = /* @__PURE__ */ new Map();
        for (const t2 of liked.items) {
          const name = t2.artists?.[0]?.name || t2.metadata?.artist_name;
          const uri = t2.artists?.[0]?.uri || t2.metadata?.artist_uri;
          if (name) {
            const prev = counts.get(name);
            counts.set(name, { count: (prev?.count || 0) + 1, uri: uri || prev?.uri || "" });
          }
        }
        let top = "";
        let topUri = "";
        let max = 0;
        for (const [name, data] of counts) {
          if (data.count > max) {
            top = name;
            topUri = data.uri;
            max = data.count;
          }
        }
        if (top) {
          this.topLikedArtist = top;
          this.topLikedArtistUri = topUri || null;
          if (this.pinnedArtists.length === 0) {
            this.pinnedArtists.push(top);
            this.savePins();
          }
          console.log("[MyWave] Top liked artist:", top, topUri);
          this.notify();
        }
      } catch (e) {
        console.log("[MyWave] Failed to load top artist:", e);
      }
    }
    resolveArtistId(artistName) {
      return resolveArtistId(artistName, this.topLikedArtist, this.topLikedArtistUri);
    }
    async startFromArtistName(artistName) {
      if (this.isActive || this.isLoading) return;
      this.isLoading = true;
      this.activeMood = null;
      this.isFavoritesMode = false;
      this.notify();
      try {
        this.playedUris.clear();
        this.blacklist.clear();
        this.history = [];
        this.uniqueArtists.clear();
        this.artistCounts.clear();
        this.sessionStart = Date.now();
        this.lockedArtist = artistName;
        this.seedTrackName = artistName;
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        const artistId = await this.resolveArtistId(artistName);
        if (artistId) {
          await this.playStation(`spotify:station:artist:${artistId}`);
        } else {
          throw new Error(`Could not find artist: ${artistName}`);
        }
        this.isActive = true;
        this.isLoading = false;
        this.attachListener();
        this._captureContext();
        this.notify();
        Spicetify.showNotification(`Mix: ${artistName}!`);
      } catch (err) {
        console.error("[MyWave] Artist start failed:", err);
        this.isLoading = false;
        this.lockedArtist = null;
        this.notify();
        Spicetify.showNotification("Failed to start artist mix", true);
      }
    }
    stop() {
      this.isActive = false;
      this.isLoading = false;
      this.activeMood = null;
      this.isFavoritesMode = false;
      this.lockedArtist = null;
      this.activeContextUri = null;
      this._isAdopting = false;
      this._pendingAdoptSeed = null;
      this._lastTrackUri = "";
      this._trackStartMs = 0;
      this._refillSeedPool = [];
      this._refillSeedIdx = 0;
      this.detachListener();
      this.notify();
      Spicetify.showNotification(`Mix stopped (${this.playedUris.size} tracks)`);
    }
    // ========================================================================
    // Discovery Only mode — hides tracks from artists already in the library.
    // ========================================================================
    getDiscoveryOnly() {
      return prefs.getDiscoveryOnly();
    }
    setDiscoveryOnly(v) {
      prefs.setDiscoveryOnly(v);
      this.notify();
      Spicetify.showNotification(v ? "Discovery Only: on" : "Discovery Only: off");
    }
    // ========================================================================
    // Save current mix history as a new Spotify playlist.
    // Takes the last `limit` history entries (most recent first) and creates
    // a dated playlist. Best-effort: uses internal PlaylistAPI then falls back
    // to the Web API. Returns true on success.
    // ========================================================================
    async saveMixAsPlaylist(limit = 30) {
      if (this.history.length === 0) {
        Spicetify.showNotification("Nothing to save yet", true);
        return false;
      }
      const uris = this.history.slice(0, limit).map((h10) => h10.uri).reverse();
      const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
      const baseName = this.seedTrackName || "Mix";
      const name = `mixline \u2014 ${baseName} \xB7 ${stamp}`;
      try {
        const api = Spicetify.Platform?.RootlistAPI;
        const plApi = Spicetify.Platform?.PlaylistAPI;
        if (api?.createPlaylist && plApi?.add) {
          const created = await api.createPlaylist(name, { after: null });
          const newUri = created?.uri || created;
          if (newUri) {
            await plApi.add(newUri, uris, { before: "end" });
            Spicetify.showNotification(`Saved: ${name}`);
            return true;
          }
        }
      } catch (e) {
        console.log("[MyWave] Internal playlist save failed, trying Web API", e);
      }
      try {
        const token = await this.getAccessToken();
        if (!token) throw new Error("no token");
        const me = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${token}` }
        }).then((r) => r.json());
        const uid = me?.id;
        if (!uid) throw new Error("no user id");
        const pl = await fetch(`https://api.spotify.com/v1/users/${uid}/playlists`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: `Generated by mixline from "${baseName}"`, public: false })
        }).then((r) => r.json());
        if (!pl?.id) throw new Error("create failed");
        await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/tracks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris })
        });
        Spicetify.showNotification(`Saved: ${name}`);
        return true;
      } catch (e) {
        console.error("[MyWave] saveMixAsPlaylist failed:", e);
        Spicetify.showNotification("Failed to save mix", true);
        return false;
      }
    }
    // Debug diagnostics exposed for the ?mywave-debug overlay.
    getDebugSnapshot() {
      return {
        isActive: this.isActive,
        isLoading: this.isLoading,
        isRefilling: this._isRefilling,
        refillSeedPool: [...this._refillSeedPool],
        refillSeedIdx: this._refillSeedIdx,
        currentUri: this.currentUri,
        trackStartMs: this._trackStartMs,
        lastTrackDurationMs: this._lastTrackDurationMs,
        playedUrisSize: this.playedUris.size,
        recsBackoffMs: Math.max(0, this._recsBackoffUntil - Date.now()),
        prefs: prefs.snapshot()
      };
    }
    resetLearning() {
      prefs.reset();
      this.notify();
      Spicetify.showNotification("Learning reset");
    }
    attachListener() {
      this.detachListener();
      this.songChangeListener = () => this.onSongChange();
      Spicetify.Player.addEventListener("songchange", this.songChangeListener);
    }
    detachListener() {
      if (this.songChangeListener) {
        Spicetify.Player.removeEventListener("songchange", this.songChangeListener);
        this.songChangeListener = null;
      }
    }
    _captureContextImmediate() {
      this.activeContextUri = Spicetify.Player.data?.context?.uri || null;
      console.log("[MyWave] Captured context (immediate):", this.activeContextUri);
    }
    _captureContext() {
      this._captureContextImmediate();
      setTimeout(() => {
        const updated = Spicetify.Player.data?.context?.uri || null;
        if (updated && updated !== this.activeContextUri) {
          this.activeContextUri = updated;
          console.log("[MyWave] Captured context (delayed update):", this.activeContextUri);
        }
      }, 800);
    }
    // Adopt: let current track finish, then start station from it on next songchange
    adoptTrack(uri) {
      if (!this.isActive || this._isAdopting) return;
      this.seedTrackName = Spicetify.Player.data?.item?.metadata?.title || "Manual pick";
      this._pendingAdoptSeed = uri;
      this.activeContextUri = Spicetify.Player.data?.context?.uri || null;
      Spicetify.showNotification("Mix continues from this track");
    }
    _pickReseedInterval() {
      return 5 + Math.floor(Math.random() * 4);
    }
    async _autoReseed() {
      if (!this.isActive || this._isRefilling) return;
      const seedUris = [];
      if (this.currentUri) seedUris.push(this.currentUri);
      for (const u of this._refillSeedPool) {
        if (!seedUris.includes(u)) seedUris.push(u);
        if (seedUris.length >= 5) break;
      }
      for (const h10 of this.history) {
        if (!seedUris.includes(h10.uri)) seedUris.push(h10.uri);
        if (seedUris.length >= 5) break;
      }
      const seedIds = seedUris.map((u) => u.split(":").pop()).filter(Boolean);
      if (seedIds.length === 0) {
        console.log("[MyWave] Auto-reseed: no seeds available, skipping");
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        return;
      }
      console.log(`[MyWave] Auto-reseed triggered (${this._tracksSinceReseed} tracks, threshold ${this._nextReseedAt}), seeds: ${seedIds.length}`);
      this._isRefilling = true;
      try {
        const allSeeds = seedIds.join(",");
        const rec = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/recommendations?seed_tracks=${allSeeds}&limit=40`
        );
        if (rec?.tracks?.length > 0) {
          const candidates = rec.tracks.map((t2) => ({ uri: t2.uri, artist: t2.artists?.[0]?.name })).filter(
            (c) => c.uri && !this.playedUris.has(c.uri) && !this.blacklist.has(c.uri) && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists)
          );
          let ranked = prefs.rankBatch(candidates);
          const featureFiltered = await filterAndRankByFeatures(this.currentUri, ranked);
          const final = featureFiltered.length > 0 ? featureFiltered : ranked;
          const picks = final.slice(0, 15);
          if (picks.length > 0) {
            await Spicetify.addToQueue(picks.map((c) => ({ uri: c.uri })));
            console.log("[MyWave] Auto-reseed: queued", picks.length, "new tracks");
          } else {
            console.log("[MyWave] Auto-reseed: all candidates filtered out");
          }
        } else {
          console.log("[MyWave] Auto-reseed: recommendations API returned 0 tracks");
        }
      } catch (e) {
        console.log("[MyWave] Auto-reseed failed:", e);
      } finally {
        this._isRefilling = false;
        this._tracksSinceReseed = 0;
        this._nextReseedAt = this._pickReseedInterval();
        console.log("[MyWave] Next reseed in", this._nextReseedAt, "tracks");
      }
    }
    async checkAndRefillQueue() {
      if (this._isRefilling || !this.isActive) return;
      try {
        const queue = await Spicetify.CosmosAsync.get("sp://player/v2/main");
        const nextTracks = queue?.next_tracks || [];
        const remaining = nextTracks.filter((t2) => !t2.removed).length;
        console.log("[MyWave] Queue remaining:", remaining);
        if (remaining <= 3) {
          this._isRefilling = true;
          try {
            const currentUri = Spicetify.Player.data?.item?.uri;
            let seedUri;
            if (this._refillSeedPool.length > 0) {
              seedUri = this._refillSeedPool[this._refillSeedIdx % this._refillSeedPool.length];
              this._refillSeedIdx++;
            } else if (currentUri) {
              seedUri = currentUri;
            }
            if (seedUri) {
              const seedId = seedUri.split(":").pop();
              if (seedId) {
                const url = `https://api.spotify.com/v1/recommendations?seed_tracks=${seedId}&limit=20`;
                const rec = await Spicetify.CosmosAsync.get(url);
                if (rec?.tracks?.length > 0) {
                  const candidates = rec.tracks.map((t2) => ({ uri: t2.uri, artist: t2.artists?.[0]?.name })).filter(
                    (c) => c.uri && !this.playedUris.has(c.uri) && !this.blacklist.has(c.uri) && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists)
                  );
                  let ranked = prefs.rankBatch(candidates);
                  const anchor = Spicetify.Player.data?.item?.uri || seedUri;
                  const featureFiltered = await filterAndRankByFeatures(anchor, ranked);
                  const final = featureFiltered.length > 0 ? featureFiltered : ranked;
                  const picks = final.slice(0, 10);
                  if (picks.length > 0) {
                    await Spicetify.addToQueue(picks.map((c) => ({ uri: c.uri })));
                    console.log("[MyWave] Refilled queue with", picks.length, "tracks (seed:", seedId, ", feats-kept:", featureFiltered.length, "/", ranked.length, ")");
                  }
                }
              }
            }
          } catch (e) {
            console.log("[MyWave] Refill failed:", e);
          } finally {
            this._isRefilling = false;
          }
        }
      } catch (e) {
        console.log("[MyWave] Queue check failed:", e);
        this._isRefilling = false;
      }
    }
    onSongChange() {
      if (!this.isActive) return;
      const item = Spicetify.Player.data?.item;
      if (!item) return;
      if (this.blacklist.has(item.uri)) {
        console.log("[MyWave] Skipping blacklisted track");
        setTimeout(() => Spicetify.Player.next(), 200);
        return;
      }
      if (this._lastTrackUri && this._lastTrackUri !== item.uri && this._trackStartMs > 0) {
        const playedMs = Date.now() - this._trackStartMs;
        const verdict = prefs.registerVerdict(
          this._lastTrackUri,
          this._lastTrackArtist,
          playedMs,
          this._lastTrackDurationMs
        );
        if (verdict !== "neutral") {
          console.log(`[MyWave] ${verdict} "${this._lastTrackArtist}" (${Math.round(playedMs / 1e3)}s / ${Math.round(this._lastTrackDurationMs / 1e3)}s)`);
          if (verdict === "listened") {
            this._refillSeedPool.unshift(this._lastTrackUri);
            if (this._refillSeedPool.length > 8) this._refillSeedPool.pop();
            this._consecutiveSkips = 0;
          }
          if (verdict === "skipped") {
            this._consecutiveSkips++;
            if (this._consecutiveSkips >= 3) {
              console.log("[MyWave] Skip streak! 3 skips in a row, emergency reseed");
              this._consecutiveSkips = 0;
              this._autoReseed();
            }
          }
        }
      }
      this.currentTrackName = item.metadata?.title || "Unknown";
      this.currentArtistName = item.metadata?.artist_name || "";
      this.currentImageUrl = item.metadata?.image_url || "";
      this.currentUri = item.uri;
      this._addPlayedUri(item.uri);
      prefs.recordPlayed(item.uri);
      const durMs = Number(item.duration?.milliseconds) || Number(item.duration_ms) || Number(item.duration) || 0;
      this._trackStartMs = Date.now();
      this._lastTrackUri = item.uri;
      this._lastTrackArtist = this.currentArtistName;
      this._lastTrackDurationMs = durMs;
      if (this.currentArtistName) {
        this.uniqueArtists.add(this.currentArtistName);
        this.artistCounts.set(
          this.currentArtistName,
          (this.artistCounts.get(this.currentArtistName) || 0) + 1
        );
      }
      if (this.historyReplayUri === item.uri) {
        this.historyReplayUri = null;
        this.notify();
        return;
      }
      this.historyReplayUri = null;
      this.history.unshift({
        uri: item.uri,
        name: this.currentTrackName,
        artist: this.currentArtistName,
        imageUrl: this.currentImageUrl,
        timestamp: Date.now()
      });
      if (this.history.length > 50) this.history.pop();
      this.notify();
      this._tracksSinceReseed++;
      console.log(`[MyWave] Track ${this._tracksSinceReseed}/${this._nextReseedAt} until reseed`);
      if (this._nextReseedAt > 0 && this._tracksSinceReseed >= this._nextReseedAt) {
        this._autoReseed();
      } else {
        this.checkAndRefillQueue();
      }
    }
  };
  _WaveEngine.STORAGE_KEY = "mywave:pins";
  _WaveEngine.PLAYED_URIS_CAP = 500;
  var WaveEngine = _WaveEngine;

  // src/ui/hooks.ts
  var engine;
  function setHooksEngine(e) {
    engine = e;
  }
  function useEngineState() {
    const React2 = Spicetify.React;
    const [state, setState] = React2.useState(engine.getState());
    const pending = React2.useRef(false);
    React2.useEffect(() => {
      const unsub = engine.subscribe(() => {
        if (pending.current) return;
        pending.current = true;
        requestAnimationFrame(() => {
          pending.current = false;
          setState({ ...engine.getState() });
        });
      });
      return () => {
        unsub();
      };
    }, []);
    return state;
  }
  function useTimeTick(active) {
    const React2 = Spicetify.React;
    const [, setTick] = React2.useState(0);
    React2.useEffect(() => {
      if (!active) return;
      const id = setInterval(() => {
        engine.notify?.();
        setTick((t2) => t2 + 1);
      }, 3e4);
      return () => clearInterval(id);
    }, [active]);
  }
  var visListeners = /* @__PURE__ */ new Set();
  var _visible = !document.hidden;
  function _onVisChange() {
    _visible = !document.hidden;
    if (_visible) document.body.classList.remove("mw-paused");
    else document.body.classList.add("mw-paused");
    visListeners.forEach((cb) => cb(_visible));
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", _onVisChange);
    if (document.hidden) document.body.classList.add("mw-paused");
  }
  function useAppVisible() {
    const React2 = Spicetify.React;
    const [vis, setVis] = React2.useState(_visible);
    React2.useEffect(() => {
      visListeners.add(setVis);
      return () => {
        visListeners.delete(setVis);
      };
    }, []);
    return vis;
  }

  // src/ui/icons.tsx
  var h = (...args) => Spicetify.React.createElement(...args);
  function WaveIcon({ size }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", className: "mw-wave-icon" },
      h("rect", { className: "mw-wbar mw-wbar-1", x: 1, y: 6, width: 2, height: 4, rx: 1 }),
      h("rect", { className: "mw-wbar mw-wbar-2", x: 5, y: 3, width: 2, height: 10, rx: 1 }),
      h("rect", { className: "mw-wbar mw-wbar-3", x: 9, y: 5, width: 2, height: 6, rx: 1 }),
      h("rect", { className: "mw-wbar mw-wbar-4", x: 13, y: 4, width: 2, height: 8, rx: 1 })
    );
  }
  function PlayIcon({ size = 20 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
      h("path", { d: "M8 5v14l11-7z" })
    );
  }
  function StopIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
      h("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2 })
    );
  }
  function HeartIcon({ size = 16, filled = false }) {
    return filled ? h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
      h("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" })
    ) : h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 },
      h("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" })
    );
  }
  function ThumbDownIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" })
    );
  }
  function HistoryIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("circle", { cx: 12, cy: 12, r: 10 }),
      h("polyline", { points: "12 6 12 12 16 14" })
    );
  }
  function StatsIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("rect", { x: 3, y: 12, width: 4, height: 9, rx: 1 }),
      h("rect", { x: 10, y: 7, width: 4, height: 14, rx: 1 }),
      h("rect", { x: 17, y: 3, width: 4, height: 18, rx: 1 })
    );
  }
  function MoodIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("circle", { cx: 12, cy: 12, r: 10 }),
      h("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
      h("line", { x1: 9, y1: 9, x2: 9.01, y2: 9 }),
      h("line", { x1: 15, y1: 9, x2: 15.01, y2: 9 })
    );
  }
  function PinIcon({ size = 14, filled = false }) {
    return filled ? h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" },
      h("path", { d: "M16 2l-4 4-1.5-1.5L7 8l3 3-5.5 5.5L6 18l5.5-5.5 3 3 3.5-3.5L16.5 11l4-4z" })
    ) : h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("line", { x1: 12, y1: 17, x2: 12, y2: 22 }),
      h("path", { d: "M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" })
    );
  }
  function SaveIcon({ size = 14 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }),
      h("polyline", { points: "17 21 17 13 7 13 7 21" }),
      h("polyline", { points: "7 3 7 8 15 8" })
    );
  }
  function ShareIcon({ size = 14 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("circle", { cx: 18, cy: 5, r: 3 }),
      h("circle", { cx: 6, cy: 12, r: 3 }),
      h("circle", { cx: 18, cy: 19, r: 3 }),
      h("line", { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }),
      h("line", { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 })
    );
  }
  function CompassIcon({ size = 14 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("circle", { cx: 12, cy: 12, r: 10 }),
      h("polygon", { points: "16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" })
    );
  }
  function SparkleIcon({ size = 14 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" }),
      h("path", { d: "M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" })
    );
  }
  function MixIcon({ size = 16 }) {
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
      h("polyline", { points: "16 3 21 3 21 8" }),
      h("line", { x1: 4, y1: 20, x2: 21, y2: 3 }),
      h("polyline", { points: "21 16 21 21 16 21" }),
      h("line", { x1: 15, y1: 15, x2: 21, y2: 21 }),
      h("line", { x1: 4, y1: 4, x2: 9, y2: 9 })
    );
  }

  // src/engine/share.ts
  function toB64Url(s) {
    const b64 = btoa(unescape(encodeURIComponent(s)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64Url(s) {
    const pad = "=".repeat((4 - s.length % 4) % 4);
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return decodeURIComponent(escape(atob(b64)));
  }
  function encodeShare(p) {
    try {
      return toB64Url(JSON.stringify(p));
    } catch {
      return "";
    }
  }
  function decodeShare(token) {
    try {
      const raw = fromB64Url(token);
      const obj = JSON.parse(raw);
      if (obj && obj.v === 1 && typeof obj.k === "string" && typeof obj.u === "string") {
        return obj;
      }
    } catch {
    }
    return null;
  }
  function payloadFromState(state) {
    const seeds = (state.history || []).slice(0, 5).map((h10) => h10.uri);
    const disc = state.discoveryOnly || void 0;
    if (state.lockedArtist) {
      return { v: 1, k: "artist", u: state.lockedArtist, n: state.lockedArtist, s: seeds, d: disc };
    }
    if (state.activeMood) {
      return { v: 1, k: "mood", u: state.activeMood, s: seeds, d: disc };
    }
    if (state.isFavoritesMode) {
      return { v: 1, k: "favorites", u: "", n: "Favorites", s: seeds, d: disc };
    }
    const pl = state.pinnedPlaylists.find((p) => p.name === state.seedTrackName);
    if (pl) {
      return { v: 1, k: "playlist", u: pl.uri, n: pl.name, s: seeds, d: disc };
    }
    if (state.currentUri) {
      return { v: 1, k: "track", u: state.currentUri, n: state.currentTrackName, s: seeds, d: disc };
    }
    return null;
  }
  var PARAM = "mywave";
  function buildShareUrl(p) {
    const base = "https://open.spotify.com/";
    return `${base}#${PARAM}=${encodeShare(p)}`;
  }
  function parseShareFromLocation() {
    try {
      const hash = window.location.hash || "";
      const hashMatch = hash.match(new RegExp(`${PARAM}=([A-Za-z0-9_-]+)`));
      if (hashMatch) return decodeShare(hashMatch[1]);
      const search = window.location.search || "";
      const qsMatch = search.match(new RegExp(`[?&]${PARAM}=([A-Za-z0-9_-]+)`));
      if (qsMatch) return decodeShare(qsMatch[1]);
    } catch {
    }
    return null;
  }
  function clearShareFromLocation() {
    try {
      if (window.location.hash?.includes(PARAM)) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } catch {
    }
  }
  async function applyShare(engine6, p) {
    try {
      if (p.d) engine6.setDiscoveryOnly(true);
      switch (p.k) {
        case "mood":
          await engine6.start(p.u);
          break;
        case "favorites":
          await engine6.startFavorites();
          break;
        case "artist":
          await engine6.startFromArtistName?.(p.u);
          break;
        case "playlist":
          await engine6.startFromPlaylist(p.u, p.n);
          break;
        case "track": {
          try {
            await Spicetify.Platform?.PlayerAPI?.play({ uri: p.u }, {}, {});
            await new Promise((r) => setTimeout(r, 600));
          } catch {
          }
          await engine6.start();
          break;
        }
        default:
          return false;
      }
      if (p.s && p.s.length > 0) {
        try {
          const seedIds = p.s.map((u) => u.split(":").pop()).filter(Boolean).slice(0, 5);
          if (seedIds.length > 0) {
            const rec = await Spicetify.CosmosAsync.get(
              `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=10`
            );
            if (rec?.tracks?.length > 0) {
              const uris = rec.tracks.map((t2) => ({ uri: t2.uri }));
              await Spicetify.addToQueue(uris);
              console.log("[MyWave] Shared session: queued", uris.length, "tracks from shared seeds");
            }
          }
        } catch (e) {
          console.log("[MyWave] Shared seed queue failed:", e);
        }
      }
      return true;
    } catch (e) {
      console.error("[MyWave] applyShare failed:", e);
    }
    return false;
  }
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
    }
    return false;
  }

  // src/engine/toast.ts
  var listeners = /* @__PURE__ */ new Set();
  var current = null;
  var seq = 0;
  var clearTimer = null;
  function emit() {
    listeners.forEach((cb) => {
      try {
        cb(current);
      } catch {
      }
    });
  }
  function pushToast(msg, opts = {}) {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    current = {
      id: ++seq,
      msg,
      kind: opts.kind || "info",
      at: Date.now()
    };
    emit();
    clearTimer = setTimeout(() => {
      current = null;
      clearTimer = null;
      emit();
    }, opts.durationMs ?? 2400);
  }
  function subscribeToast(cb) {
    listeners.add(cb);
    cb(current);
    return () => listeners.delete(cb);
  }

  // src/ui/visualizers.tsx
  var h2 = (...args) => Spicetify.React.createElement(...args);
  var newMixCounter = 0;
  var newMixListeners = /* @__PURE__ */ new Set();
  function triggerNewMix() {
    newMixCounter++;
    newMixListeners.forEach((cb) => cb());
  }
  function useNewMixSignal() {
    const [count, setCount] = Spicetify.React.useState(newMixCounter);
    Spicetify.React.useEffect(() => {
      const cb = () => setCount(newMixCounter);
      newMixListeners.add(cb);
      return () => {
        newMixListeners.delete(cb);
      };
    }, []);
    return count;
  }
  function AsciiWave({ active, mini }) {
    const cols = mini ? EQ_COLS_MINI : EQ_COLS;
    const rows = mini ? EQ_ROWS_MINI : EQ_ROWS;
    const visible = useAppVisible();
    const idle = Spicetify.React.useMemo(() => Array.from({ length: cols }, (_, i) => {
      const c = (cols - 1) / 2;
      return (1 - Math.abs(i - c) / c * 0.6) * rows * 0.25;
    }), [cols, rows]);
    const [bars, setBars] = Spicetify.React.useState(idle);
    Spicetify.React.useEffect(() => {
      if (!active || !visible) {
        if (!active) setBars(idle);
        return;
      }
      const cur = idle.map((v) => v);
      const tgt = cur.map(() => Math.random() * rows);
      let timer;
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
    const lines = [];
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
    return h2("pre", { className: `mw-eq${active ? " mw-eq-on" : ""}${mini ? " mw-eq-mini" : ""}` }, lines.join("\n"));
  }
  var MIX_EXTRAS = [
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
    "/WAIT THIS SLAPS."
  ];
  var MIX_RARE = "/MIIIIIIIX 0_0";
  var mixCycleCount = 0;
  var extraQueue = [];
  function shuffleExtras() {
    extraQueue = [...MIX_EXTRAS];
    for (let i = extraQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [extraQueue[i], extraQueue[j]] = [extraQueue[j], extraQueue[i]];
    }
  }
  function pickPhrase() {
    mixCycleCount++;
    if (Math.random() < 0.01) return MIX_RARE;
    if (mixCycleCount % 6 === 0) {
      if (extraQueue.length === 0) shuffleExtras();
      return extraQueue.pop();
    }
    return "/MIX...";
  }
  var mixLabelState = {
    text: "",
    listeners: /* @__PURE__ */ new Set(),
    phase: "typing",
    target: "/MIX...",
    timer: null,
    running: false,
    notify() {
      this.listeners.forEach((cb) => cb());
    },
    start() {
      if (this.running) return;
      this.running = true;
      this.tick();
    },
    stop() {
      this.running = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    },
    pause() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
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
          this.timer = setTimeout(() => {
            this.phase = "hold";
            this.tick();
          }, 2200);
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
    }
  };
  function PanelMixLabel() {
    const [text, setText] = Spicetify.React.useState(mixLabelState.text);
    const sig = useNewMixSignal();
    const prevRef = Spicetify.React.useRef(sig);
    const visible = useAppVisible();
    Spicetify.React.useEffect(() => {
      const cb = () => setText(mixLabelState.text);
      mixLabelState.listeners.add(cb);
      mixLabelState.start();
      return () => {
        mixLabelState.listeners.delete(cb);
        if (mixLabelState.listeners.size === 0) mixLabelState.stop();
      };
    }, []);
    Spicetify.React.useEffect(() => {
      if (visible) mixLabelState.resume();
      else mixLabelState.pause();
    }, [visible]);
    Spicetify.React.useEffect(() => {
      if (sig !== prevRef.current) {
        mixLabelState.forceNewMix();
        prevRef.current = sig;
      }
    }, [sig]);
    return h2(
      "span",
      { className: "mw-ascii-label" },
      h2("span", null, text),
      h2("span", { className: "mw-cursor" }, "\u2588")
    );
  }
  var SEA_ROWS = [
    { chars: "\xB7   ~   \xB7  ~    \xB7   ~   \xB7  ~    ", speed: 28, op: 0.12 },
    { chars: " ~ \u2591\u2591 ~  \u2591  ~ \u2591\u2591 ~  \u2591  ", speed: 20, op: 0.2 },
    { chars: "\u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   \u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   ", speed: 15, op: 0.3 },
    { chars: "\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591", speed: 11, op: 0.4 },
    { chars: "\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592", speed: 8, op: 0.5 }
  ];
  function SeaWaves() {
    return h2(
      "div",
      { className: "mw-sea" },
      SEA_ROWS.map((row, i) => {
        const tile = row.chars.repeat(4);
        return h2("div", {
          key: i,
          className: "mw-sea-row",
          style: { opacity: row.op, animationDuration: `${row.speed}s`, contain: "layout paint" }
        }, tile + tile);
      })
    );
  }

  // src/ui/panel.tsx
  var h3 = (...args) => Spicetify.React.createElement(...args);
  function ScrollText({ className, children }) {
    const ref = Spicetify.React.useRef(null);
    const [scrolling, setScrolling] = Spicetify.React.useState(false);
    const prevText = Spicetify.React.useRef(children);
    Spicetify.React.useEffect(() => {
      if (children !== prevText.current) {
        setScrolling(false);
        prevText.current = children;
      }
    }, [children]);
    Spicetify.React.useEffect(() => {
      if (scrolling) return;
      const el = ref.current;
      if (!el) return;
      const id = requestAnimationFrame(() => {
        if (el.scrollWidth > el.clientWidth + 2) setScrolling(true);
      });
      return () => cancelAnimationFrame(id);
    }, [children, scrolling]);
    if (scrolling) {
      return h3(
        "div",
        { className: `${className} mw-scroll` },
        h3(
          "span",
          { className: "mw-scroll-track" },
          h3("span", null, children),
          h3("span", { className: "mw-scroll-gap" }, "\xA0\xA0\xA0\xB7\xA0\xA0\xA0"),
          h3("span", null, children)
        )
      );
    }
    return h3("div", { ref, className }, children);
  }
  var engine2;
  function setEngine(e) {
    engine2 = e;
  }
  function NowPlayingCard({ state }) {
    return h3(
      "div",
      { className: "mw-np" },
      h3(
        "div",
        { className: "mw-np-top" },
        h3(
          "div",
          { className: "mw-np-art-wrap" },
          state.currentImageUrl && h3("img", { className: "mw-np-art-glow", src: state.currentImageUrl, alt: "" }),
          state.currentImageUrl ? h3("img", { className: "mw-np-art", src: state.currentImageUrl, alt: "" }) : h3("div", { className: "mw-np-art mw-np-ph" })
        ),
        h3(
          "div",
          { className: "mw-np-info" },
          h3(ScrollText, { className: "mw-np-name", children: state.currentTrackName }),
          h3(ScrollText, { className: "mw-np-artist", children: state.currentArtistName })
        )
      ),
      h3(
        "div",
        { className: "mw-np-controls" },
        h3("button", {
          className: "mw-np-btn mw-np-like",
          onClick: () => engine2.likeCurrentTrack(),
          title: "Like"
        }, h3(HeartIcon, { size: 14 })),
        h3("button", {
          className: "mw-np-btn mw-np-dislike",
          onClick: () => engine2.dislikeCurrentTrack(),
          title: "Dislike & skip"
        }, h3(ThumbDownIcon, { size: 14 })),
        h3("button", {
          className: `mw-np-btn mw-np-discovery${state.discoveryOnly ? " mw-np-locked" : ""}`,
          onClick: () => engine2.setDiscoveryOnly(!state.discoveryOnly),
          title: state.discoveryOnly ? "Discovery Only: on" : "Discovery Only: only unfamiliar artists"
        }, h3(CompassIcon, { size: 14 })),
        h3("button", {
          className: "mw-np-btn mw-np-save",
          onClick: () => engine2.saveMixAsPlaylist(),
          title: "Save current mix as playlist"
        }, h3(SaveIcon, { size: 14 })),
        h3("button", {
          className: "mw-np-btn mw-np-share",
          onClick: async () => {
            const payload = payloadFromState(state);
            if (!payload) {
              pushToast("/nothing to share", { kind: "error" });
              return;
            }
            const url = buildShareUrl(payload);
            const ok = await copyToClipboard(url);
            pushToast(ok ? "/link copied" : "/copy failed", { kind: ok ? "info" : "error" });
          },
          title: "Copy share link for this mix"
        }, h3(ShareIcon, { size: 14 })),
        h3("button", {
          className: "mw-np-btn mw-np-mixfrom",
          onClick: () => {
            triggerNewMix();
            engine2.reseedFromTrack();
          },
          title: "Mix from this track"
        }, h3(MixIcon, { size: 14 })),
        h3("button", {
          className: "mw-np-btn mw-np-morelike",
          onClick: () => engine2.moreLikeThis(),
          title: "More like this \u2014 queue similar tracks"
        }, h3(SparkleIcon, { size: 14 }))
      )
    );
  }
  function MainTab({ state }) {
    if (state.isActive) {
      return h3(
        Spicetify.React.Fragment,
        null,
        h3(PinnedMoodRow, { state }),
        h3(InlineStats, { state })
      );
    }
    const track = Spicetify.Player.data?.item;
    const trackName = track?.metadata?.title || null;
    const artistName = track?.metadata?.artist_name || null;
    const imageUrl = track?.metadata?.image_url || null;
    return h3(
      Spicetify.React.Fragment,
      null,
      h3(
        "div",
        { className: "mw-hero" },
        h3(AsciiWave, { active: false }),
        h3("div", { className: "mw-hero-text" }, "Your infinite mix")
      ),
      h3(
        "div",
        { className: "mw-start-section" },
        h3("button", {
          className: `mw-start-btn${state.isLoading ? " mw-loading" : ""}`,
          onClick: () => engine2.startFavorites()
        }, h3(PlayIcon, { size: 16 }), "Start"),
        trackName && h3("button", {
          className: `mw-start-btn mw-start-alt${state.isLoading ? " mw-loading" : ""}`,
          onClick: () => engine2.start(),
          title: `Mix from: ${trackName}`
        }, h3(MixIcon, { size: 14 }), "Mix from this track")
      ),
      h3(PinnedMoodRow, { state })
    );
  }
  function PinnedMoodRow({ state }) {
    const pinned = state.pinnedMoods;
    const moodPins = pinned.filter((id) => id !== "__favorites__").map((id) => MOODS.find((m) => m.id === id)).filter(Boolean);
    if (pinned.length === 0 && state.pinnedArtists.length === 0 && state.pinnedPlaylists.length === 0) {
      return h3(
        "div",
        { className: "mw-moods" },
        h3("div", { className: "mw-moods-empty" }, "Pin items in the Mood tab")
      );
    }
    return h3(
      "div",
      { className: "mw-moods" },
      h3(
        "div",
        { className: "mw-moods-row" },
        pinned.includes("__favorites__") && h3("button", {
          key: "favorites",
          className: `mw-mood mw-mood-fav${state.isFavoritesMode ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.isFavoritesMode && state.isActive) {
              engine2.stop();
              return;
            }
            if (state.isActive) engine2.stop();
            setTimeout(() => engine2.startFavorites(), 100);
          }
        }, h3(HeartIcon, { size: 11, filled: true }), " Favorites"),
        state.pinnedArtists.map((name) => h3("button", {
          key: `artist-${name}`,
          className: `mw-mood mw-mood-artist${state.lockedArtist === name && state.isActive ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.lockedArtist === name && state.isActive) {
              engine2.stop();
              return;
            }
            if (state.isActive) engine2.stop();
            setTimeout(() => engine2.startFromArtistName(name), 100);
          }
        }, `\u2605 ${name}`)),
        state.pinnedPlaylists.map((pl) => h3("button", {
          key: `pl-${pl.uri}`,
          className: `mw-mood mw-mood-playlist${state.seedTrackName === pl.name && state.isActive ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.seedTrackName === pl.name && state.isActive) {
              engine2.stop();
              return;
            }
            if (state.isActive) engine2.stop();
            setTimeout(() => engine2.startFromPlaylist(pl.uri, pl.name), 100);
          }
        }, `\u266A ${pl.name}`)),
        moodPins.map((mood) => h3("button", {
          key: mood.id,
          className: `mw-mood${state.activeMood === mood.id ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.activeMood === mood.id) {
              engine2.stop();
              return;
            }
            if (state.isActive) engine2.stop();
            setTimeout(() => engine2.start(mood.id), 100);
          }
        }, mood.label))
      )
    );
  }
  function UserPlaylists({ state }) {
    const [playlists, setPlaylists] = Spicetify.React.useState([]);
    const [loaded2, setLoaded] = Spicetify.React.useState(false);
    Spicetify.React.useEffect(() => {
      if (loaded2) return;
      engine2.getUserPlaylists().then((r) => {
        setPlaylists(r);
        setLoaded(true);
      });
    }, [loaded2]);
    if (!loaded2) return h3("div", { className: "mw-mt-loading" }, "Loading...");
    if (playlists.length === 0) return null;
    const pinnedUris = state.pinnedPlaylists.map((p) => p.uri);
    return h3(
      "div",
      { className: "mw-mt-list mw-mt-mypl" },
      playlists.map((pl) => {
        const isPinned = pinnedUris.includes(pl.uri);
        return h3(
          "div",
          {
            key: pl.uri,
            className: `mw-mt-artist-btn${isPinned ? " mw-mt-artist-active" : ""}`
          },
          pl.imageUrl && h3("img", { className: "mw-mt-artist-img mw-mt-pl-cover", src: pl.imageUrl, alt: "" }),
          h3("span", { className: "mw-mt-pl-name" }, pl.name),
          h3("button", {
            className: `mw-mood-pin${isPinned ? " mw-mood-pin-on" : ""}`,
            onClick: () => engine2.togglePinPlaylist(pl.name, pl.uri),
            title: isPinned ? "Unpin" : "Pin to main"
          }, h3(PinIcon, { size: 12, filled: isPinned }))
        );
      })
    );
  }
  function MoodTab({ state }) {
    const pinned = state.pinnedMoods;
    const [artistResults, setArtistResults] = Spicetify.React.useState([]);
    const [artistSearching, setArtistSearching] = Spicetify.React.useState(false);
    const [artistQuery, setArtistQuery] = Spicetify.React.useState(false);
    const artistRef = Spicetify.React.useRef(null);
    const artistTimer = Spicetify.React.useRef(null);
    const [plResults, setPlResults] = Spicetify.React.useState([]);
    const [plSearching, setPlSearching] = Spicetify.React.useState(false);
    const [plQuery, setPlQuery] = Spicetify.React.useState(false);
    const plRef = Spicetify.React.useRef(null);
    const plTimer = Spicetify.React.useRef(null);
    const doArtistSearch = Spicetify.React.useCallback((val) => {
      if (artistTimer.current) clearTimeout(artistTimer.current);
      if (!val.trim()) {
        setArtistResults([]);
        setArtistQuery(false);
        return;
      }
      setArtistQuery(true);
      artistTimer.current = setTimeout(async () => {
        setArtistSearching(true);
        try {
          setArtistResults(await engine2.searchArtists(val.trim()));
        } catch {
        }
        setArtistSearching(false);
      }, 600);
    }, []);
    const doPlSearch = Spicetify.React.useCallback((val) => {
      if (plTimer.current) clearTimeout(plTimer.current);
      if (!val.trim()) {
        setPlResults([]);
        setPlQuery(false);
        return;
      }
      setPlQuery(true);
      plTimer.current = setTimeout(async () => {
        setPlSearching(true);
        try {
          setPlResults(await engine2.searchPlaylists(val.trim()));
        } catch {
        }
        setPlSearching(false);
      }, 600);
    }, []);
    Spicetify.React.useEffect(() => {
      const el = artistRef.current;
      if (!el) return;
      const handler = () => doArtistSearch(el.value);
      el.addEventListener("input", handler);
      return () => el.removeEventListener("input", handler);
    }, [doArtistSearch]);
    Spicetify.React.useEffect(() => {
      const el = plRef.current;
      if (!el) return;
      const handler = () => doPlSearch(el.value);
      el.addEventListener("input", handler);
      return () => el.removeEventListener("input", handler);
    }, [doPlSearch]);
    const pickArtist = (name) => {
      engine2.togglePinArtist(name);
      if (artistRef.current) artistRef.current.value = "";
      setArtistResults([]);
      setArtistQuery(false);
    };
    const pickPlaylist = (name, uri) => {
      engine2.togglePinPlaylist(name, uri);
      if (plRef.current) plRef.current.value = "";
      setPlResults([]);
      setPlQuery(false);
    };
    const pinnedUris = state.pinnedPlaylists.map((p) => p.uri);
    return h3(
      "div",
      { className: "mw-mood-tab" },
      // Artist section
      h3(
        "div",
        { className: "mw-mt-section" },
        h3("div", { className: "mw-moods-label" }, "ARTISTS"),
        state.pinnedArtists.length > 0 && h3(
          "div",
          { className: "mw-mt-list" },
          state.pinnedArtists.map((name) => h3(
            "button",
            {
              key: name,
              className: "mw-mt-artist-btn mw-mt-artist-active",
              onClick: () => engine2.togglePinArtist(name)
            },
            `\u2605 ${name}`,
            h3(PinIcon, { size: 12, filled: true })
          ))
        ),
        h3("input", {
          ref: artistRef,
          className: "mw-mt-search",
          type: "text",
          placeholder: "Search artists..."
        }),
        artistQuery && h3(
          "div",
          { className: "mw-mt-list" },
          artistSearching && h3("div", { className: "mw-mt-loading" }, "Searching..."),
          artistResults.map((a) => h3(
            "button",
            {
              key: a.id,
              className: `mw-mt-artist-btn${state.pinnedArtists.includes(a.name) ? " mw-mt-artist-active" : ""}`,
              onClick: () => pickArtist(a.name)
            },
            a.imageUrl && h3("img", { className: "mw-mt-artist-img", src: a.imageUrl, alt: "" }),
            a.name
          ))
        )
      ),
      // Playlist section
      h3(
        "div",
        { className: "mw-mt-section" },
        h3("div", { className: "mw-moods-label" }, "PLAYLISTS"),
        state.pinnedPlaylists.length > 0 && h3(
          "div",
          { className: "mw-mt-list" },
          state.pinnedPlaylists.map((pl) => h3(
            "button",
            {
              key: pl.uri,
              className: "mw-mt-artist-btn mw-mt-artist-active",
              onClick: () => engine2.togglePinPlaylist(pl.name, pl.uri)
            },
            `\u266A ${pl.name}`,
            h3(PinIcon, { size: 12, filled: true })
          ))
        ),
        h3("input", {
          ref: plRef,
          className: "mw-mt-search",
          type: "text",
          placeholder: "Search playlists..."
        }),
        plQuery && h3(
          "div",
          { className: "mw-mt-list" },
          plSearching && h3("div", { className: "mw-mt-loading" }, "Searching..."),
          plResults.map((p) => h3(
            "button",
            {
              key: p.uri,
              className: `mw-mt-artist-btn${pinnedUris.includes(p.uri) ? " mw-mt-artist-active" : ""}`,
              onClick: () => pickPlaylist(p.name, p.uri)
            },
            p.imageUrl && h3("img", { className: "mw-mt-artist-img", src: p.imageUrl, alt: "" }),
            h3(
              "div",
              { className: "mw-mt-pl-info" },
              h3("div", null, p.name),
              p.owner && h3("div", { className: "mw-mt-pl-owner" }, p.owner)
            )
          ))
        )
      ),
      // Favorites section — liked songs pin + user's own playlists
      h3(
        "div",
        { className: "mw-mt-section" },
        h3(
          "div",
          { className: "mw-mt-section-header" },
          h3("div", { className: "mw-moods-label" }, "MY LIBRARY"),
          h3(
            "button",
            {
              className: `mw-mood-pin${pinned.includes("__favorites__") ? " mw-mood-pin-on" : ""}`,
              onClick: () => engine2.togglePinFavorites(),
              title: pinned.includes("__favorites__") ? "Unpin Liked Songs" : "Pin Liked Songs"
            },
            h3(HeartIcon, { size: 12, filled: true }),
            h3(PinIcon, { size: 12, filled: pinned.includes("__favorites__") })
          )
        ),
        h3(UserPlaylists, { state })
      ),
      // Moods section
      h3(
        "div",
        { className: "mw-mt-section" },
        h3("div", { className: "mw-moods-label" }, "MOODS"),
        h3(
          "div",
          { className: "mw-mood-grid" },
          MOODS.map((mood) => h3(
            "div",
            {
              key: mood.id,
              className: `mw-mood-item${state.activeMood === mood.id ? " mw-mood-item-on" : ""}`
            },
            h3("button", {
              className: "mw-mood-item-btn",
              onClick: () => {
                if (state.activeMood === mood.id) {
                  engine2.stop();
                  return;
                }
                if (state.isActive) engine2.stop();
                setTimeout(() => engine2.start(mood.id), 100);
              }
            }, mood.label),
            h3("button", {
              className: `mw-mood-pin${pinned.includes(mood.id) ? " mw-mood-pin-on" : ""}`,
              onClick: () => engine2.togglePinMood(mood.id),
              title: pinned.includes(mood.id) ? "Unpin" : "Pin to main"
            }, h3(PinIcon, { size: 12, filled: pinned.includes(mood.id) }))
          ))
        )
      )
    );
  }
  function InlineStats({ state }) {
    const source = state.lockedArtist ? `Artist: ${state.lockedArtist}` : state.activeMood ? `Mood: ${state.activeMood}` : state.isFavoritesMode ? "Favorites" : state.seedTrackName || "Your library";
    return h3(
      "div",
      { className: "mw-isource" },
      h3("span", { className: "mw-isource-lbl" }, "Mixing from"),
      h3("span", { className: "mw-isource-val" }, source)
    );
  }
  function HistoryTab({ history: history2 }) {
    if (history2.length === 0) {
      return h3("div", { className: "mw-empty" }, "No tracks played yet");
    }
    return h3(
      "div",
      { className: "mw-hist" },
      history2.slice(0, 20).map((entry, i) => h3(
        "div",
        {
          key: entry.uri + entry.timestamp,
          className: "mw-hist-row",
          style: { animationDelay: `${i * 30}ms` }
        },
        h3("div", { className: "mw-hist-num" }, `${i + 1}`),
        entry.imageUrl ? h3("img", { className: "mw-hist-art", src: entry.imageUrl, alt: "", onClick: () => engine2.playFromHistory(entry.uri) }) : h3("div", { className: "mw-hist-art mw-hist-ph", onClick: () => engine2.playFromHistory(entry.uri) }),
        h3(
          "div",
          { className: "mw-hist-info", onClick: () => engine2.playFromHistory(entry.uri) },
          h3(ScrollText, { className: "mw-hist-name", children: entry.name }),
          h3(ScrollText, { className: "mw-hist-artist", children: entry.artist })
        ),
        h3(LikeButton, { uri: entry.uri })
      ))
    );
  }
  function LikeButton({ uri }) {
    const [liked, setLiked] = Spicetify.React.useState(false);
    Spicetify.React.useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await Spicetify.Platform.LibraryAPI.contains(uri);
          if (!cancelled) setLiked(Array.isArray(res) ? !!res[0] : !!res);
        } catch {
          try {
            const res = await Spicetify.CosmosAsync.get(
              `https://api.spotify.com/v1/me/tracks/contains?ids=${uri.split(":").pop()}`
            );
            if (!cancelled && Array.isArray(res)) setLiked(res[0]);
          } catch {
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [uri]);
    const toggle = async (e) => {
      e.stopPropagation();
      try {
        if (liked) {
          await Spicetify.Platform.LibraryAPI.remove({ uris: [uri] });
        } else {
          await Spicetify.Platform.LibraryAPI.add({ uris: [uri] });
        }
        setLiked(!liked);
      } catch {
      }
    };
    return h3("button", {
      className: `mw-like${liked ? " mw-liked" : ""}`,
      onClick: toggle
    }, h3(HeartIcon, { size: 14, filled: liked }));
  }
  function StatsTab({ state }) {
    useTimeTick(state.isActive);
    if (!state.isActive && state.history.length === 0) {
      return h3("div", { className: "mw-empty" }, "Start a mix to see stats");
    }
    const mins = state.sessionMinutes;
    const timeStr = mins < 1 ? "<1m" : `${mins}m`;
    return h3(
      "div",
      { className: "mw-stats-tab" },
      h3(
        "div",
        { className: "mw-stats-grid" },
        h3(
          "div",
          { className: "mw-stat-card" },
          h3("div", { className: "mw-stat-val" }, `${state.playedCount}`),
          h3("div", { className: "mw-stat-lbl" }, "tracks")
        ),
        h3(
          "div",
          { className: "mw-stat-card" },
          h3("div", { className: "mw-stat-val" }, timeStr),
          h3("div", { className: "mw-stat-lbl" }, "listened")
        ),
        h3(
          "div",
          { className: "mw-stat-card" },
          h3("div", { className: "mw-stat-val" }, `${state.uniqueArtistsCount}`),
          h3("div", { className: "mw-stat-lbl" }, "artists")
        )
      ),
      state.topArtists.length > 0 && h3(
        "div",
        { className: "mw-top-artists" },
        h3("div", { className: "mw-top-label" }, "TOP ARTISTS"),
        state.topArtists.map((a, i) => h3(
          "div",
          { key: a.name, className: "mw-top-row", style: { animationDelay: `${i * 40}ms` } },
          h3("div", { className: "mw-top-rank" }, `${i + 1}`),
          h3("div", { className: "mw-top-name" }, a.name),
          h3("div", { className: "mw-top-count" }, `${a.count} plays`)
        ))
      ),
      state.seedTrackName && h3(
        "div",
        { className: "mw-stat-seed" },
        h3(
          "span",
          { className: "mw-stat-seed-lbl" },
          state.activeMood ? "Mood" : state.isFavoritesMode ? "Mode" : "Seed"
        ),
        h3("span", null, state.seedTrackName)
      )
    );
  }

  // src/ui/HomeBanner.tsx
  var h4 = (...args) => Spicetify.React.createElement(...args);
  var engine3;
  function setHomeBannerEngine(e) {
    engine3 = e;
  }
  function HomeBanner() {
    const state = useEngineState();
    const handleMood = (moodId) => {
      if (state.activeMood === moodId) {
        engine3.stop();
        return;
      }
      if (state.isActive) engine3.stop();
      setTimeout(() => engine3.start(moodId), 100);
    };
    return h4(
      "div",
      { className: "mw-home" },
      h4(SeaWaves),
      h4("div", { className: "mw-home-glow" }),
      h4(
        "div",
        { className: "mw-home-inner" },
        // Brand + label
        h4(
          "div",
          { className: "mw-home-top-row" },
          h4(
            "div",
            { className: "mw-home-brand" },
            h4(WaveIcon, { size: 16 }),
            h4("span", null, "MIX LINE")
          ),
          h4(
            "div",
            { className: "mw-home-tag" },
            h4(PanelMixLabel)
          )
        ),
        // Now playing or description
        state.isActive ? h4(
          "div",
          { className: "mw-home-np" },
          state.currentImageUrl && h4("img", { className: "mw-home-np-art", src: state.currentImageUrl, alt: "" }),
          h4(
            "div",
            { className: "mw-home-np-text" },
            h4(ScrollText, { className: "mw-home-np-name", children: state.currentTrackName }),
            h4(ScrollText, { className: "mw-home-np-artist", children: state.currentArtistName })
          )
        ) : (() => {
          const todayId = moodOfTheDay(MOODS.map((m) => m.id));
          const todayMood = todayId ? MOODS.find((m) => m.id === todayId) : null;
          return h4(
            "div",
            { className: "mw-home-desc" },
            "Endless mix from your taste",
            todayMood && h4("button", {
              className: "mw-home-today",
              onClick: () => {
                if (state.isActive) engine3.stop();
                setTimeout(() => engine3.start(todayMood.id), 100);
              },
              title: "Today's suggestion \u2014 click to start",
              style: {
                marginLeft: 10,
                padding: "2px 8px",
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                background: "transparent",
                border: "1px solid currentColor",
                borderRadius: 10,
                opacity: 0.7,
                cursor: "pointer",
                color: "inherit"
              }
            }, `today \xB7 ${todayMood.label}`)
          );
        })(),
        // Buttons
        h4(
          "div",
          { className: "mw-home-btns" },
          state.isActive ? h4(
            Spicetify.React.Fragment,
            null,
            h4(
              "button",
              { className: "mw-home-btn mw-home-btn-stop", onClick: () => engine3.stop() },
              h4(StopIcon, { size: 12 }),
              "Stop"
            ),
            h4(
              "button",
              { className: "mw-home-btn mw-home-btn-mix", onClick: () => {
                triggerNewMix();
                engine3.reseed();
              } },
              h4(MixIcon, { size: 12 }),
              "New mix"
            ),
            h4(
              "div",
              { className: "mw-home-live" },
              h4("span", { className: "mw-home-dot" }),
              `${state.playedCount} tracks`
            )
          ) : h4(
            "button",
            { className: "mw-home-btn mw-home-btn-play", onClick: () => engine3.startFavorites() },
            h4(PlayIcon, { size: 14 }),
            "Start"
          )
        ),
        // Pinned items — synced with mini-menu
        h4(
          "div",
          { className: "mw-home-moods" },
          state.pinnedMoods.includes("__favorites__") && h4("button", {
            key: "favorites",
            className: `mw-home-mood mw-home-mood-fav${state.isFavoritesMode ? " mw-home-mood-on" : ""}`,
            onClick: () => {
              if (state.isFavoritesMode && state.isActive) {
                engine3.stop();
                return;
              }
              if (state.isActive) engine3.stop();
              setTimeout(() => engine3.startFavorites(), 100);
            }
          }, "\u2665 Favorites"),
          state.pinnedArtists.map((name) => h4("button", {
            key: `artist-${name}`,
            className: `mw-home-mood mw-home-mood-artist${state.lockedArtist === name && state.isActive ? " mw-home-mood-on" : ""}`,
            onClick: () => {
              if (state.lockedArtist === name && state.isActive) {
                engine3.stop();
                return;
              }
              if (state.isActive) engine3.stop();
              setTimeout(() => engine3.startFromArtistName(name), 100);
            }
          }, `\u2605 ${name}`)),
          state.pinnedPlaylists.map((pl) => h4("button", {
            key: `pl-${pl.uri}`,
            className: `mw-home-mood mw-home-mood-playlist${state.seedTrackName === pl.name && state.isActive ? " mw-home-mood-on" : ""}`,
            onClick: () => {
              if (state.seedTrackName === pl.name && state.isActive) {
                engine3.stop();
                return;
              }
              if (state.isActive) engine3.stop();
              setTimeout(() => engine3.startFromPlaylist(pl.uri, pl.name), 100);
            }
          }, `\u266A ${pl.name}`)),
          state.pinnedMoods.filter((id) => id !== "__favorites__").map((id) => {
            const mood = MOODS.find((m) => m.id === id);
            if (!mood) return null;
            return h4("button", {
              key: id,
              className: `mw-home-mood${state.activeMood === id ? " mw-home-mood-on" : ""}`,
              onClick: () => handleMood(id)
            }, mood.label);
          }).filter(Boolean)
        )
      )
    );
  }

  // src/ui/Onboarding.tsx
  var h5 = (...args) => Spicetify.React.createElement(...args);
  var STORAGE_KEY3 = "mywave:onboarding-done";
  var LANG_KEY = "mywave:lang";
  function getSavedLang() {
    try {
      return localStorage.getItem(LANG_KEY);
    } catch {
      return null;
    }
  }
  function saveLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
    }
  }
  function hasSeenOnboarding() {
    try {
      return localStorage.getItem(STORAGE_KEY3) === "1";
    } catch {
      return false;
    }
  }
  function markOnboardingSeen() {
    try {
      localStorage.setItem(STORAGE_KEY3, "1");
    } catch {
    }
  }
  function IconRow({ icon, label }) {
    return h5(
      "div",
      { className: "mw-ob-row" },
      h5("div", { className: "mw-ob-icon" }, icon),
      h5("div", { className: "mw-ob-text" }, label)
    );
  }
  var t = {
    en: {
      welcomeDesc: "Endless mix from your music taste. MIX LINE builds an infinite radio based on your liked songs, favorite artists, and moods.",
      welcomeHint: "Let's walk through the basics.",
      controls: "Controls",
      startDesc: "Start \u2014 launches a mix from your favorites",
      mixFromTrackDesc: "Mix from this track \u2014 start a mix based on the current track",
      stopDesc: "Stop \u2014 stops the current mix",
      newMixDesc: "New Mix \u2014 reshuffles the mix, fresh tracks",
      autoNote: "Tracks change automatically \u2014 no need to press anything for the next song.",
      nowPlaying: "Now Playing",
      npDesc: "While a mix is running, the Now Playing card shows the current track with quick actions:",
      likeDesc: "Like \u2014 save track to your library (+4 artist score)",
      dislikeDesc: "Dislike \u2014 skip and blacklist the track (-10 artist score)",
      moreLikeDesc: "More like this \u2014 instantly queue 15 similar tracks",
      discoveryDesc: "Discovery Only \u2014 only play unfamiliar artists",
      saveDesc: "Save as Playlist \u2014 save the current mix to your library",
      shareDesc: "Share \u2014 copy a link that recreates this mix for anyone",
      mixFromDesc: "Mix from Track \u2014 reseed the mix based on current track",
      smartTitle: "Smart Features",
      smartAutoReseed: "Auto-reseed \u2014 every 5-8 tracks the mix shifts direction seamlessly",
      smartSkipStreak: "Skip streak \u2014 3 skips in a row triggers an automatic reseed",
      smartLearning: "Learning \u2014 likes (+4) and dislikes (-10) teach the algorithm your taste",
      tabs: "Tabs",
      tabMain: "Main \u2014 controls, pinned items, now playing",
      tabMoods: "Moods \u2014 pick artists and moods, pin them to main",
      tabHistory: "History \u2014 last 20 played tracks",
      tabStats: "Stats \u2014 session stats and top artists",
      pinsMoods: "Pins & Moods",
      pinsDesc: "In the Moods tab you can customize what appears on the main screen:",
      pinAction: "Pin/Unpin \u2014 add or remove items from main screen",
      pinsDetail: "Search and pin artists and playlists. Pin moods like Chill, Hype, or Focus. Your own playlists are in My Library.",
      lastHint: "You can reopen this guide anytime from the button in the panel header.",
      next: "Next \u2192",
      back: "\u2190 Back",
      skip: "Skip",
      gotIt: "Got it!"
    },
    ru: {
      welcomeDesc: "\u0411\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u043C\u0438\u043A\u0441 \u043F\u043E\u0434 \u0442\u0432\u043E\u0439 \u0432\u043A\u0443\u0441. MIX LINE \u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u0431\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u043E\u0435 \u0440\u0430\u0434\u0438\u043E \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0442\u0432\u043E\u0438\u0445 \u043B\u0430\u0439\u043A\u043D\u0443\u0442\u044B\u0445 \u043F\u0435\u0441\u0435\u043D, \u043B\u044E\u0431\u0438\u043C\u044B\u0445 \u0430\u0440\u0442\u0438\u0441\u0442\u043E\u0432 \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0439.",
      welcomeHint: "\u0414\u0430\u0432\u0430\u0439 \u0440\u0430\u0437\u0431\u0435\u0440\u0451\u043C\u0441\u044F \u043A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442.",
      controls: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
      startDesc: "Start \u2014 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043C\u0438\u043A\u0441 \u0438\u0437 \u043B\u0430\u0439\u043A\u043D\u0443\u0442\u044B\u0445",
      mixFromTrackDesc: "Mix from this track \u2014 \u043C\u0438\u043A\u0441 \u043E\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0442\u0440\u0435\u043A\u0430",
      stopDesc: "Stop \u2014 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 \u043C\u0438\u043A\u0441",
      newMixDesc: "New Mix \u2014 \u043C\u0435\u043D\u044F\u0435\u0442 \u043F\u043E\u0434\u0431\u043E\u0440 \u043C\u0438\u043A\u0441\u043E\u0432",
      autoNote: "\u0422\u0440\u0435\u043A\u0438 \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u2014 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E \u043D\u0430\u0436\u0438\u043C\u0430\u0442\u044C \u043D\u0438\u0447\u0435\u0433\u043E.",
      nowPlaying: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0433\u0440\u0430\u0435\u0442",
      npDesc: "\u041A\u043E\u0433\u0434\u0430 \u043C\u0438\u043A\u0441 \u0437\u0430\u043F\u0443\u0449\u0435\u043D, \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0442\u0440\u0435\u043A \u0441 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F\u043C\u0438:",
      likeDesc: "Like \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0443 (+4 \u043E\u0447\u043A\u0430 \u0430\u0440\u0442\u0438\u0441\u0442\u0443)",
      dislikeDesc: "Dislike \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0438 \u0432 \u0447\u0451\u0440\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A (-10 \u043E\u0447\u043A\u043E\u0432)",
      moreLikeDesc: "More like this \u2014 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C 15 \u043F\u043E\u0445\u043E\u0436\u0438\u0445 \u0442\u0440\u0435\u043A\u043E\u0432",
      discoveryDesc: "Discovery Only \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0435\u0437\u043D\u0430\u043A\u043E\u043C\u044B\u0435 \u0430\u0440\u0442\u0438\u0441\u0442\u044B",
      saveDesc: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043C\u0438\u043A\u0441 \u043A\u0430\u043A \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442",
      shareDesc: "\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u2014 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u043C\u0438\u043A\u0441 \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u0438\u0445",
      mixFromDesc: "Mix from Track \u2014 \u043F\u0435\u0440\u0435\u0441\u0438\u0434\u0438\u0442\u044C \u043E\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0442\u0440\u0435\u043A\u0430",
      smartTitle: "\u0423\u043C\u043D\u044B\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438",
      smartAutoReseed: "\u0410\u0432\u0442\u043E-\u0440\u0435\u0441\u0438\u0434 \u2014 \u043A\u0430\u0436\u0434\u044B\u0435 5-8 \u0442\u0440\u0435\u043A\u043E\u0432 \u043C\u0438\u043A\u0441 \u043F\u043B\u0430\u0432\u043D\u043E \u043C\u0435\u043D\u044F\u0435\u0442 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
      smartSkipStreak: "\u0421\u043A\u0438\u043F-\u0441\u0442\u0440\u0438\u043A \u2014 3 \u0441\u043A\u0438\u043F\u0430 \u043F\u043E\u0434\u0440\u044F\u0434 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043C\u0435\u043D\u044F\u044E\u0442 \u043F\u043E\u0434\u0431\u043E\u0440",
      smartLearning: "\u041E\u0431\u0443\u0447\u0435\u043D\u0438\u0435 \u2014 \u043B\u0430\u0439\u043A\u0438 (+4) \u0438 \u0434\u0438\u0437\u043B\u0430\u0439\u043A\u0438 (-10) \u0443\u0447\u0430\u0442 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C",
      tabs: "\u0412\u043A\u043B\u0430\u0434\u043A\u0438",
      tabMain: "Main \u2014 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435, \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
      tabMoods: "Moods \u2014 \u0430\u0440\u0442\u0438\u0441\u0442\u044B \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F, \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E",
      tabHistory: "History \u2014 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 20 \u0442\u0440\u0435\u043A\u043E\u0432",
      tabStats: "Stats \u2014 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0441\u0435\u0441\u0441\u0438\u0438 \u0438 \u0442\u043E\u043F \u0430\u0440\u0442\u0438\u0441\u0442\u043E\u0432",
      pinsMoods: "\u041F\u0438\u043D\u044B \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F",
      pinsDesc: "\u0412\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 Moods \u043C\u043E\u0436\u043D\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0447\u0442\u043E \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u043E\u043C \u044D\u043A\u0440\u0430\u043D\u0435:",
      pinAction: "Pin/Unpin \u2014 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u0441 \u0433\u043B\u0430\u0432\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430",
      pinsDetail: "\u0418\u0449\u0438 \u0438 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u044F\u0439 \u0430\u0440\u0442\u0438\u0441\u0442\u043E\u0432 \u0438 \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442\u044B. \u0417\u0430\u043A\u0440\u0435\u043F\u043B\u044F\u0439 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F: Chill, Hype, Focus. \u0422\u0432\u043E\u0438 \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442\u044B \u0432 My Library.",
      lastHint: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u044D\u0442\u043E\u0442 \u0433\u0430\u0439\u0434 \u0441\u043D\u043E\u0432\u0430 \u043C\u043E\u0436\u043D\u043E \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u0432 \u0448\u0430\u043F\u043A\u0435 \u043F\u0430\u043D\u0435\u043B\u0438.",
      next: "\u0414\u0430\u043B\u0435\u0435 \u2192",
      back: "\u2190 \u041D\u0430\u0437\u0430\u0434",
      skip: "\u041F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C",
      gotIt: "\u041F\u043E\u043D\u044F\u0442\u043D\u043E!"
    }
  };
  function getPages(lang) {
    const s = t[lang];
    return [
      // Page 0: Welcome
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5(
          "div",
          { className: "mw-ob-hero" },
          h5(WaveIcon, { size: 32 }),
          h5("div", { className: "mw-ob-title" }, "MIX LINE")
        ),
        h5("div", { className: "mw-ob-desc" }, s.welcomeDesc),
        h5("div", { className: "mw-ob-hint" }, s.welcomeHint)
      ),
      // Page 1: Controls
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5("div", { className: "mw-ob-heading" }, s.controls),
        h5(IconRow, { icon: h5(PlayIcon, { size: 16 }), label: s.startDesc }),
        h5(IconRow, { icon: h5(MixIcon, { size: 16 }), label: s.mixFromTrackDesc }),
        h5(IconRow, { icon: h5(StopIcon, { size: 16 }), label: s.stopDesc }),
        h5(IconRow, { icon: h5(MixIcon, { size: 16 }), label: s.newMixDesc }),
        h5("div", { className: "mw-ob-hint" }, s.autoNote)
      ),
      // Page 2: Now Playing
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5("div", { className: "mw-ob-heading" }, s.nowPlaying),
        h5("div", { className: "mw-ob-desc" }, s.npDesc),
        h5(IconRow, { icon: h5(HeartIcon, { size: 16 }), label: s.likeDesc }),
        h5(IconRow, { icon: h5(ThumbDownIcon, { size: 16 }), label: s.dislikeDesc }),
        h5(IconRow, { icon: h5(SparkleIcon, { size: 16 }), label: s.moreLikeDesc }),
        h5(IconRow, { icon: h5(CompassIcon, { size: 16 }), label: s.discoveryDesc }),
        h5(IconRow, { icon: h5(MixIcon, { size: 16 }), label: s.mixFromDesc }),
        h5(IconRow, { icon: h5(SaveIcon, { size: 16 }), label: s.saveDesc }),
        h5(IconRow, { icon: h5(ShareIcon, { size: 16 }), label: s.shareDesc })
      ),
      // Page 3: Smart Features
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5("div", { className: "mw-ob-heading" }, s.smartTitle),
        h5(IconRow, { icon: h5(MixIcon, { size: 16 }), label: s.smartAutoReseed }),
        h5(IconRow, { icon: h5(StopIcon, { size: 16 }), label: s.smartSkipStreak }),
        h5(IconRow, { icon: h5(HeartIcon, { size: 16 }), label: s.smartLearning })
      ),
      // Page 4: Tabs
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5("div", { className: "mw-ob-heading" }, s.tabs),
        h5(IconRow, { icon: h5(WaveIcon, { size: 16 }), label: s.tabMain }),
        h5(IconRow, { icon: h5(MoodIcon, { size: 16 }), label: s.tabMoods }),
        h5(IconRow, { icon: h5(HistoryIcon, { size: 16 }), label: s.tabHistory }),
        h5(IconRow, { icon: h5(StatsIcon, { size: 16 }), label: s.tabStats })
      ),
      // Page 5: Pins & Moods
      () => h5(
        Spicetify.React.Fragment,
        null,
        h5("div", { className: "mw-ob-heading" }, s.pinsMoods),
        h5("div", { className: "mw-ob-desc" }, s.pinsDesc),
        h5(IconRow, { icon: h5(PinIcon, { size: 16, filled: true }), label: s.pinAction }),
        h5("div", { className: "mw-ob-desc" }, s.pinsDetail),
        h5("div", { className: "mw-ob-hint" }, s.lastHint)
      )
    ];
  }
  function OnboardingModal({ onClose }) {
    const savedLang = getSavedLang();
    const [lang, setLang] = Spicetify.React.useState(savedLang || "en");
    const [langChosen, setLangChosen] = Spicetify.React.useState(!!savedLang);
    const [page, setPage] = Spicetify.React.useState(0);
    const pages = getPages(lang);
    const isLast = page === pages.length - 1;
    const s = t[lang];
    const pickLang = (l) => {
      setLang(l);
      saveLang(l);
      setLangChosen(true);
    };
    const next = () => {
      if (isLast) {
        markOnboardingSeen();
        onClose();
      } else setPage(page + 1);
    };
    const prev = () => {
      if (page > 0) setPage(page - 1);
    };
    const skip = () => {
      markOnboardingSeen();
      onClose();
    };
    if (!langChosen) {
      return h5(
        "div",
        { className: "mw-ob-backdrop" },
        h5(
          "div",
          { className: "mw-ob-modal" },
          h5(
            "div",
            { className: "mw-ob-content" },
            h5(
              "div",
              { className: "mw-ob-hero" },
              h5(WaveIcon, { size: 32 }),
              h5("div", { className: "mw-ob-title" }, "MIX LINE")
            ),
            h5(
              "div",
              { className: "mw-ob-desc", style: { textAlign: "center" } },
              "Choose language / \u0412\u044B\u0431\u0435\u0440\u0438 \u044F\u0437\u044B\u043A"
            ),
            h5(
              "div",
              { className: "mw-ob-lang-row" },
              h5(
                "button",
                { className: "mw-ob-lang", onClick: () => pickLang("en") },
                "EN  English"
              ),
              h5(
                "button",
                { className: "mw-ob-lang", onClick: () => pickLang("ru") },
                "RU  \u0420\u0443\u0441\u0441\u043A\u0438\u0439"
              )
            )
          )
        )
      );
    }
    return h5(
      "div",
      { className: "mw-ob-backdrop", onClick: (e) => {
        if (e.target === e.currentTarget) skip();
      } },
      h5(
        "div",
        { className: "mw-ob-modal" },
        h5("div", { key: page, className: "mw-ob-content" }, pages[page]()),
        h5(
          "div",
          { className: "mw-ob-footer" },
          h5(
            "div",
            { className: "mw-ob-dots" },
            pages.map((_, i) => h5("div", { key: i, className: `mw-ob-dot${i === page ? " mw-ob-dot-on" : ""}` }))
          ),
          h5(
            "div",
            { className: "mw-ob-btns" },
            page > 0 && h5("button", { className: "mw-ob-btn mw-ob-btn-back", onClick: prev }, s.back),
            h5(
              "button",
              { className: "mw-ob-btn mw-ob-btn-next", onClick: next },
              isLast ? s.gotIt : s.next
            ),
            !isLast && h5("button", { className: "mw-ob-btn mw-ob-btn-skip", onClick: skip }, s.skip)
          )
        )
      )
    );
  }

  // src/ui/BottomBarWidget.tsx
  var h6 = (...args) => Spicetify.React.createElement(...args);
  var engine4;
  function setBottomBarEngine(e) {
    engine4 = e;
  }
  function BottomBarWidget() {
    const state = useEngineState();
    const [panelOpen, setPanelOpen] = Spicetify.React.useState(false);
    const [tab, setTab] = Spicetify.React.useState("main");
    const [showGuide, setShowGuide] = Spicetify.React.useState(!hasSeenOnboarding());
    const [toast, setToast] = Spicetify.React.useState(null);
    const panelRef = Spicetify.React.useRef(null);
    Spicetify.React.useEffect(() => {
      const handler = (e) => {
        if (panelRef.current && !panelRef.current.contains(e.target)) {
          setPanelOpen(false);
        }
      };
      if (panelOpen) document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [panelOpen]);
    Spicetify.React.useEffect(() => subscribeToast(setToast), []);
    Spicetify.React.useEffect(() => {
      if (panelOpen) setTab("main");
    }, [panelOpen]);
    return h6(
      Spicetify.React.Fragment,
      null,
      showGuide && h6(OnboardingModal, { onClose: () => setShowGuide(false) }),
      h6(
        "div",
        { className: "mw-bottombar", ref: panelRef },
        panelOpen && h6(
          "div",
          { className: "mw-panel" },
          h6(
            "div",
            { className: "mw-panel-inner" },
            // Header
            h6(
              "div",
              { className: "mw-header" },
              h6(
                "div",
                { className: "mw-header-left" },
                h6("div", { className: "mw-logo" }, h6(WaveIcon, { size: 14 })),
                h6("span", { className: "mw-header-title" }, "MIX LINE"),
                h6("button", {
                  className: "mw-guide-btn",
                  onClick: () => setShowGuide(true),
                  title: "Guide"
                }, "?")
              ),
              h6(
                "div",
                { className: "mw-header-tabs" },
                h6("button", {
                  className: `mw-htab${tab === "main" ? " mw-htab-on" : ""}`,
                  onClick: () => setTab("main")
                }, h6(WaveIcon, { size: 15 })),
                h6("button", {
                  className: `mw-htab${tab === "moods" ? " mw-htab-on" : ""}`,
                  onClick: () => setTab("moods")
                }, h6(MoodIcon, { size: 15 })),
                h6("button", {
                  className: `mw-htab${tab === "history" ? " mw-htab-on" : ""}`,
                  onClick: () => setTab("history")
                }, h6(HistoryIcon, { size: 15 })),
                h6("button", {
                  className: `mw-htab${tab === "stats" ? " mw-htab-on" : ""}`,
                  onClick: () => setTab("stats")
                }, h6(StatsIcon, { size: 15 }))
              )
            ),
            // Transient status line — CLI-style "/link copied", etc.
            toast && h6("div", {
              key: toast.id,
              className: `mw-toast${toast.kind === "error" ? " mw-toast-err" : ""}`
            }, toast.msg),
            // Tab content with fade transition
            h6(
              "div",
              { key: tab, className: "mw-tab-body" },
              tab === "main" && state.isActive && h6(
                "div",
                { className: "mw-ascii-banner" },
                h6(AsciiWave, { active: true }),
                h6(
                  "div",
                  { className: "mw-ascii-overlay" },
                  h6(PanelMixLabel)
                )
              ),
              tab === "main" && state.isActive && h6(NowPlayingCard, { state }),
              tab === "main" && h6(MainTab, { state }),
              tab === "moods" && h6(MoodTab, { state }),
              tab === "history" && h6(HistoryTab, { history: state.history }),
              tab === "stats" && h6(StatsTab, { state })
            ),
            // Bottom actions (main tab only)
            tab === "main" && state.isActive && h6(
              "div",
              { className: "mw-actions" },
              h6(
                "button",
                { className: "mw-act mw-act-stop", onClick: () => engine4.stop() },
                h6(StopIcon, { size: 14 }),
                "Stop"
              ),
              h6(
                "button",
                { className: "mw-act mw-act-reseed", onClick: () => {
                  triggerNewMix();
                  engine4.reseed();
                } },
                h6(MixIcon, { size: 14 }),
                "New mix"
              )
            )
          )
        ),
        // Trigger button
        h6(
          "button",
          {
            className: `mw-trigger${state.isActive ? " mw-trigger-on" : ""}`,
            onClick: () => setPanelOpen(!panelOpen)
          },
          h6("div", { className: "mw-trigger-icon" }, h6(WaveIcon, { size: 14 }))
        )
      )
    );
  }

  // src/ui/DebugOverlay.tsx
  var h7 = (...args) => Spicetify.React.createElement(...args);
  var engineRef = null;
  function setDebugEngine(e) {
    engineRef = e;
  }
  function isDebugEnabled() {
    try {
      const loc = window.location.href || "";
      if (loc.includes("mywave-debug")) return true;
      if (localStorage.getItem("mywave:debug") === "1") return true;
    } catch {
    }
    return false;
  }
  function DebugOverlay() {
    const [tick, setTick] = Spicetify.React.useState(0);
    const [open, setOpen] = Spicetify.React.useState(true);
    const visible = useAppVisible();
    Spicetify.React.useEffect(() => {
      if (!engineRef || !visible) return;
      const unsub = engineRef.subscribe(() => setTick((t2) => t2 + 1));
      const id = setInterval(() => setTick((t2) => t2 + 1), 2e3);
      return () => {
        unsub?.();
        clearInterval(id);
      };
    }, [visible]);
    if (!engineRef) return null;
    const snap = engineRef.getDebugSnapshot();
    const fmtMs = (ms) => ms > 0 ? `${Math.round(ms / 1e3)}s` : "-";
    const style = {
      root: {
        position: "fixed",
        right: 12,
        top: 12,
        zIndex: 99999,
        width: 340,
        maxHeight: "calc(100vh - 24px)",
        overflow: "auto",
        background: "rgba(10,10,10,0.92)",
        border: "1px solid #1db954",
        borderRadius: 6,
        color: "#e8e8e8",
        fontFamily: "JetBrains Mono, Menlo, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: open ? "10px 12px" : "4px 10px",
        backdropFilter: "blur(4px)"
      },
      head: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
        color: "#1db954",
        letterSpacing: 1.5,
        fontWeight: 600,
        textTransform: "uppercase",
        fontSize: 10
      },
      row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0" },
      key: { color: "#888" },
      val: { color: "#e8e8e8", textAlign: "right", wordBreak: "break-all" },
      section: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #222" },
      sectionTitle: { fontSize: 9, color: "#1db954", letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" },
      btn: {
        marginTop: 8,
        width: "100%",
        background: "transparent",
        color: "#e8e8e8",
        border: "1px solid #333",
        padding: "4px 8px",
        borderRadius: 3,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 10,
        letterSpacing: 1
      }
    };
    const row = (k, v) => h7(
      "div",
      { style: style.row, key: k },
      h7("span", { style: style.key }, k),
      h7("span", { style: style.val }, String(v))
    );
    return h7(
      "div",
      { style: style.root },
      h7("div", {
        style: style.head,
        onClick: () => setOpen(!open)
      }, h7("span", null, "mixline // debug"), h7("span", null, open ? "\u25BC" : "\u25B2")),
      open && h7(
        "div",
        null,
        row("active", snap.isActive),
        row("loading", snap.isLoading),
        row("refilling", snap.isRefilling),
        row("played (session)", snap.playedUrisSize),
        row("played (persist)", snap.prefs.playedCount),
        row("artists tracked", snap.prefs.artistsTracked),
        row("backoff", fmtMs(snap.recsBackoffMs)),
        row("track elapsed", snap.trackStartMs ? fmtMs(Date.now() - snap.trackStartMs) : "-"),
        row("track duration", fmtMs(snap.lastTrackDurationMs)),
        row("discovery only", snap.prefs.discoveryOnly ? "on" : "off"),
        h7(
          "div",
          { style: style.section },
          h7("div", { style: style.sectionTitle }, "refill seed pool"),
          snap.refillSeedPool.length === 0 ? h7("div", { style: style.key }, "(empty)") : snap.refillSeedPool.map((u, i) => h7("div", { key: i, style: { color: i === (snap.refillSeedIdx - 1 + snap.refillSeedPool.length) % snap.refillSeedPool.length ? "#1db954" : "#888", fontSize: 10 } }, u.split(":").pop()))
        ),
        h7(
          "div",
          { style: style.section },
          h7("div", { style: style.sectionTitle }, "top artists"),
          snap.prefs.topArtists.length === 0 ? h7("div", { style: style.key }, "(none)") : snap.prefs.topArtists.map((a, i) => h7(
            "div",
            { style: style.row, key: i },
            h7("span", { style: style.key }, a.name),
            h7("span", { style: { color: "#1db954" } }, "+" + a.score)
          ))
        ),
        h7(
          "div",
          { style: style.section },
          h7("div", { style: style.sectionTitle }, "bottom artists"),
          snap.prefs.bottomArtists.length === 0 ? h7("div", { style: style.key }, "(none)") : snap.prefs.bottomArtists.map((a, i) => h7(
            "div",
            { style: style.row, key: i },
            h7("span", { style: style.key }, a.name),
            h7("span", { style: { color: "#e55" } }, a.score)
          ))
        ),
        h7("button", {
          style: style.btn,
          onClick: () => engineRef?.setDiscoveryOnly(!snap.prefs.discoveryOnly)
        }, snap.prefs.discoveryOnly ? "disable discovery only" : "enable discovery only"),
        h7("button", {
          style: style.btn,
          onClick: () => engineRef?.saveMixAsPlaylist()
        }, "save mix as playlist"),
        h7("button", {
          style: { ...style.btn, borderColor: "#552", color: "#e55" },
          onClick: () => {
            if (confirm("Reset all learning (played tracks + artist scores)?")) {
              engineRef?.resetLearning();
            }
          }
        }, "reset learning")
      )
    );
  }

  // src/ui/WeeklyReport.tsx
  var h8 = (...args) => Spicetify.React.createElement(...args);
  function fmtDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1e3));
    const h_ = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    return { h: h_, m, text: h_ > 0 ? `${h_}h ${m}m` : `${m}m` };
  }
  function fmtPct(r, digits = 0) {
    return `${(r * 100).toFixed(digits)}%`;
  }
  function pctDelta(cur, prev) {
    if (prev <= 0 && cur <= 0) return { sign: "flat", text: "\u2014" };
    if (prev <= 0) return { sign: "up", text: "NEW" };
    const d = (cur - prev) / prev * 100;
    if (Math.abs(d) < 1) return { sign: "flat", text: "\xB10%" };
    const sign = d > 0 ? "up" : "down";
    const pref = d > 0 ? "\u25B2 +" : "\u25BC ";
    return { sign, text: `${pref}${d.toFixed(0)}%` };
  }
  function absDelta(cur, prev) {
    const d = cur - prev;
    if (d === 0) return { sign: "flat", text: "\xB10" };
    if (d > 0) return { sign: "up", text: `\u25B2 +${d}` };
    return { sign: "down", text: `\u25BC ${d}` };
  }
  function sparkPath(values, w, hgt) {
    if (values.length === 0) return { line: "", area: "", lastX: w, lastY: hgt };
    const max = Math.max(1, ...values);
    const stepX = values.length > 1 ? w / (values.length - 1) : w;
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = hgt - v / max * (hgt - 4) - 2;
      return { x, y };
    });
    const line = pts.map((p, i) => i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${hgt} L0,${hgt} Z`;
    const last = pts[pts.length - 1];
    return { line, area, lastX: last.x, lastY: last.y };
  }
  function dayLabels() {
    const names = ["S", "M", "T", "W", "T", "F", "S"];
    const today = (/* @__PURE__ */ new Date()).getDay();
    const out = [];
    for (let i = 6; i >= 0; i--) out.push(names[(today - i + 7) % 7]);
    return out;
  }
  function StatListened({ report }) {
    const cur = fmtDuration(report.current.listenedMs);
    const delta = pctDelta(report.current.listenedMs, report.previous.listenedMs);
    const spark = sparkPath(report.dailyMinutes, 100, 28);
    return h8(
      "div",
      { className: "mw-wk-stat" },
      h8(
        "div",
        { className: "mw-wk-stat-head" },
        h8("span", { className: "mw-wk-stat-label" }, "Listened"),
        h8("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)
      ),
      h8(
        "div",
        { className: "mw-wk-big-num" },
        cur.h,
        h8("span", { className: "mw-wk-stat-unit" }, "h"),
        cur.m,
        h8("span", { className: "mw-wk-stat-unit" }, "m")
      ),
      h8(
        "svg",
        { className: "mw-wk-spark", viewBox: "0 0 100 28", preserveAspectRatio: "none" },
        spark.area && h8("path", { className: "mw-wk-spark-area", d: spark.area }),
        spark.line && h8("path", { className: "mw-wk-spark-line", d: spark.line }),
        h8("circle", { className: "mw-wk-spark-dot", cx: spark.lastX, cy: spark.lastY, r: 2 })
      )
    );
  }
  function StatTracks({ report }) {
    const delta = absDelta(report.current.listenedCount, report.previous.listenedCount);
    const max = Math.max(1, ...report.dailyMinutes);
    const labels = dayLabels();
    return h8(
      "div",
      { className: "mw-wk-stat" },
      h8(
        "div",
        { className: "mw-wk-stat-head" },
        h8("span", { className: "mw-wk-stat-label" }, "Tracks"),
        h8("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)
      ),
      h8("div", { className: "mw-wk-big-num" }, String(report.current.listenedCount)),
      h8(
        "div",
        { className: "mw-wk-mbars" },
        report.dailyMinutes.map((v, i) => h8("div", {
          key: i,
          className: "mw-wk-mbar",
          style: { height: `${Math.max(4, v / max * 100)}%`, animationDelay: `${i * 60}ms` }
        }))
      ),
      h8(
        "div",
        { className: "mw-wk-mbar-label" },
        labels.map((l, i) => h8("span", { key: i }, l))
      )
    );
  }
  function StatSkipRate({ report }) {
    const cur = report.current.skipRate;
    const prev = report.previous.skipRate;
    const diff = (cur - prev) * 100;
    const sign = Math.abs(diff) < 0.5 ? "flat" : diff > 0 ? "up" : "down";
    const deltaCls = sign === "down" ? "good-down" : sign === "up" ? "down" : "flat";
    const deltaTxt = sign === "flat" ? "\xB10pp" : `${diff > 0 ? "\u25B2 +" : "\u25BC "}${Math.abs(diff).toFixed(0)}pp`;
    const r = 24;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - cur);
    return h8(
      "div",
      { className: "mw-wk-stat" },
      h8(
        "div",
        { className: "mw-wk-stat-head" },
        h8("span", { className: "mw-wk-stat-label" }, "Skip rate"),
        h8("span", { className: `mw-wk-stat-delta ${deltaCls === "good-down" || deltaCls === "flat" ? "" : "neg"}` }, deltaTxt)
      ),
      h8(
        "div",
        { className: "mw-wk-ring-wrap" },
        h8(
          "svg",
          { className: "mw-wk-ring", viewBox: "0 0 56 56" },
          h8("circle", { className: "mw-wk-ring-track", cx: 28, cy: 28, r }),
          h8("circle", {
            className: "mw-wk-ring-fill",
            cx: 28,
            cy: 28,
            r,
            strokeDasharray: circumference.toFixed(1),
            strokeDashoffset: offset.toFixed(1)
          }),
          h8("text", { className: "mw-wk-ring-text", x: 28, y: 28 }, fmtPct(cur))
        ),
        h8(
          "div",
          { className: "mw-wk-ring-meta" },
          h8(
            "div",
            { className: "mw-wk-ring-big" },
            report.current.skippedCount,
            h8("span", { className: "mw-wk-stat-unit" }, `/${report.current.listenedCount + report.current.skippedCount}`)
          ),
          h8("div", { className: "mw-wk-ring-small" }, "skipped / total")
        )
      )
    );
  }
  function StatArtists({ report }) {
    const delta = absDelta(report.current.uniqueArtists, report.previous.uniqueArtists);
    const spark = sparkPath(
      // rough per-day distinct proxy: cap each day's listened minutes scaled
      report.dailyMinutes.map((m) => Math.min(m, 60)),
      100,
      28
    );
    return h8(
      "div",
      { className: "mw-wk-stat" },
      h8(
        "div",
        { className: "mw-wk-stat-head" },
        h8("span", { className: "mw-wk-stat-label" }, "New artists"),
        h8("span", { className: `mw-wk-stat-delta${delta.sign === "down" ? " neg" : ""}` }, delta.text)
      ),
      h8("div", { className: "mw-wk-big-num" }, String(report.current.uniqueArtists)),
      h8(
        "svg",
        { className: "mw-wk-spark", viewBox: "0 0 100 28", preserveAspectRatio: "none" },
        spark.area && h8("path", { className: "mw-wk-spark-area", d: spark.area }),
        spark.line && h8("path", { className: "mw-wk-spark-line", d: spark.line }),
        h8("circle", { className: "mw-wk-spark-dot", cx: spark.lastX, cy: spark.lastY, r: 2 })
      )
    );
  }
  function PageThisWeek({ report }) {
    const maxMs = Math.max(1, ...report.topArtists.map((a) => a.ms));
    return h8(
      "div",
      { className: "mw-wk-page" },
      h8(
        "div",
        { className: "mw-wk-grid" },
        h8(StatListened, { report }),
        h8(StatTracks, { report }),
        h8(StatSkipRate, { report }),
        h8(StatArtists, { report })
      ),
      h8(
        "div",
        { className: "mw-wk-section" },
        h8(
          "div",
          { className: "mw-wk-section-label" },
          "Top artists",
          h8("span", { className: "mw-wk-thin" })
        ),
        report.topArtists.length === 0 ? h8("div", { className: "mw-wk-movers-empty" }, "(not enough data)") : report.topArtists.map((a, i) => h8(
          "div",
          { className: "mw-wk-artist", key: a.name },
          h8("span", { className: "mw-wk-artist-rank" }, String(i + 1).padStart(2, "0")),
          h8("span", { className: "mw-wk-artist-name" }, a.name),
          h8(
            "span",
            { className: "mw-wk-artist-bar" },
            h8("span", { className: "mw-wk-artist-bar-fill", style: { width: `${a.ms / maxMs * 100}%` } })
          ),
          h8("span", { className: "mw-wk-artist-time" }, fmtDuration(a.ms).text)
        ))
      )
    );
  }
  function CmpCard({ icon, label, current: current2, previous, delta, unit }) {
    const cls = delta.kind === "good-down" ? "good-down" : delta.sign;
    return h8(
      "div",
      { className: "mw-wk-cmp" },
      h8("div", { className: "mw-wk-cmp-icon" }, icon),
      h8(
        "div",
        { className: "mw-wk-cmp-body" },
        h8("div", { className: "mw-wk-cmp-label" }, label),
        h8(
          "div",
          { className: "mw-wk-cmp-row" },
          h8("span", { className: "mw-wk-cmp-now" }, current2, unit && h8("span", { className: "mw-wk-stat-unit" }, unit)),
          h8("span", { className: "mw-wk-cmp-prev" }, "was ", h8("span", { className: "mw-wk-v" }, previous))
        )
      ),
      h8("span", { className: `mw-wk-cmp-delta ${cls}` }, delta.text)
    );
  }
  function DualChart({ now, prev }) {
    const max = Math.max(1, ...now, ...prev);
    const w = 300, hgt = 70;
    const toPath = (vals) => {
      if (vals.length === 0) return { line: "", area: "", lastX: w, lastY: hgt };
      const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
      const pts = vals.map((v, i) => ({
        x: i * stepX,
        y: hgt - v / max * (hgt - 10) - 6
      }));
      const line = pts.map((p, i) => i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${hgt} L0,${hgt} Z`;
      const last = pts[pts.length - 1];
      return { line, area, lastX: last.x, lastY: last.y };
    };
    const nowP = toPath(now);
    const prevP = toPath(prev);
    return h8(
      "div",
      { className: "mw-wk-dual" },
      h8(
        "div",
        { className: "mw-wk-dual-head" },
        h8("span", { className: "mw-wk-dual-title" }, "Daily listening (min)"),
        h8(
          "span",
          { className: "mw-wk-dual-legend" },
          h8("span", null, h8("span", { className: "k k-now" }), "now"),
          h8("span", null, h8("span", { className: "k k-prev" }), "prev")
        )
      ),
      h8(
        "svg",
        { className: "mw-wk-dual-svg", viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "none" },
        h8("line", { className: "mw-wk-dual-grid", x1: 0, y1: 17, x2: w, y2: 17 }),
        h8("line", { className: "mw-wk-dual-grid", x1: 0, y1: 35, x2: w, y2: 35 }),
        h8("line", { className: "mw-wk-dual-grid", x1: 0, y1: 53, x2: w, y2: 53 }),
        prevP.line && h8("path", { className: "mw-wk-dual-prev-line", d: prevP.line }),
        nowP.area && h8("path", { className: "mw-wk-dual-now-area", d: nowP.area }),
        nowP.line && h8("path", { className: "mw-wk-dual-now-line", d: nowP.line }),
        h8("circle", { className: "mw-wk-dual-dot", cx: nowP.lastX, cy: nowP.lastY, r: 2.4 }),
        h8("text", { className: "mw-wk-dual-axis", x: 0, y: 68 }, "7D AGO"),
        h8("text", { className: "mw-wk-dual-axis", x: w - 28, y: 68 }, "TODAY")
      )
    );
  }
  function PageVsLast({ report }) {
    const curL = fmtDuration(report.current.listenedMs).text;
    const prevL = fmtDuration(report.previous.listenedMs).text;
    const listenedDelta = pctDelta(report.current.listenedMs, report.previous.listenedMs);
    const tracksDelta = absDelta(report.current.listenedCount, report.previous.listenedCount);
    const artistsDelta = absDelta(report.current.uniqueArtists, report.previous.uniqueArtists);
    const pp = (report.current.skipRate - report.previous.skipRate) * 100;
    const skipKind = pp < 0 ? "good-down" : "normal";
    const skipSign = Math.abs(pp) < 0.5 ? "flat" : pp > 0 ? "up" : "down";
    const skipText = skipSign === "flat" ? "\xB10pp" : `${pp > 0 ? "\u25B2 +" : "\u25BC "}${Math.abs(pp).toFixed(0)}pp`;
    const { newIn, dropped, risers } = report.movers;
    return h8(
      "div",
      { className: "mw-wk-page" },
      h8(CmpCard, {
        icon: "HR",
        label: "Listened",
        current: curL,
        previous: prevL,
        delta: listenedDelta
      }),
      h8(CmpCard, {
        icon: "TR",
        label: "Tracks",
        current: String(report.current.listenedCount),
        previous: String(report.previous.listenedCount),
        delta: tracksDelta
      }),
      h8(CmpCard, {
        icon: "SK",
        label: "Skip rate",
        current: fmtPct(report.current.skipRate),
        previous: fmtPct(report.previous.skipRate),
        delta: { sign: skipSign, text: skipText, kind: skipKind }
      }),
      h8(CmpCard, {
        icon: "AR",
        label: "Unique artists",
        current: String(report.current.uniqueArtists),
        previous: String(report.previous.uniqueArtists),
        delta: artistsDelta
      }),
      h8(DualChart, { now: report.dailyMinutes, prev: report.prevDailyMinutes }),
      h8(
        "div",
        { className: "mw-wk-movers" },
        h8(
          "div",
          { className: "mw-wk-movers-col" },
          h8(
            "div",
            { className: "mw-wk-movers-head" },
            h8("span", { className: "sym" }, "\u25B2"),
            "New in top"
          ),
          newIn.length === 0 && risers.length === 0 ? h8("div", { className: "mw-wk-movers-empty" }, "(none)") : h8(
            Spicetify.React.Fragment,
            null,
            newIn.slice(0, 3).map((n) => h8(
              "div",
              { className: "mw-wk-movers-item", key: n },
              h8("span", { className: "mark" }, "NEW"),
              h8("span", { className: "mw-wk-movers-name" }, n)
            )),
            risers.slice(0, 2).map((r) => h8(
              "div",
              { className: "mw-wk-movers-item", key: r.name },
              h8("span", { className: "mark" }, `\u2191 ${r.from - r.to}`),
              h8("span", { className: "mw-wk-movers-name" }, r.name)
            ))
          )
        ),
        h8(
          "div",
          { className: "mw-wk-movers-col" },
          h8(
            "div",
            { className: "mw-wk-movers-head down" },
            h8("span", { className: "sym" }, "\u25BC"),
            "Dropped"
          ),
          dropped.length === 0 ? h8("div", { className: "mw-wk-movers-empty" }, "(none)") : dropped.slice(0, 5).map((n) => h8(
            "div",
            { className: "mw-wk-movers-item down", key: n },
            h8("span", { className: "mark" }, "OUT"),
            h8("span", { className: "mw-wk-movers-name" }, n)
          ))
        )
      )
    );
  }
  function demoReport() {
    const cur = {
      listenedMs: (4 * 3600 + 32 * 60) * 1e3,
      listenedCount: 87,
      skippedCount: 12,
      uniqueArtists: 23,
      skipRate: 12 / 99,
      topArtists: [
        { name: "Tame Impala", ms: 48 * 6e4, plays: 14 },
        { name: "King Krule", ms: 35 * 6e4, plays: 10 },
        { name: "Mac DeMarco", ms: 26 * 6e4, plays: 8 },
        { name: "Men I Trust", ms: 19 * 6e4, plays: 6 },
        { name: "Beach House", ms: 14 * 6e4, plays: 4 }
      ]
    };
    const prev = {
      listenedMs: (3 * 3600 + 50 * 60) * 1e3,
      listenedCount: 75,
      skippedCount: 15,
      uniqueArtists: 18,
      skipRate: 15 / 90,
      topArtists: [
        { name: "Tame Impala", ms: 42 * 6e4, plays: 12 },
        { name: "King Krule", ms: 30 * 6e4, plays: 9 },
        { name: "Radiohead", ms: 24 * 6e4, plays: 7 },
        { name: "Parcels", ms: 17 * 6e4, plays: 5 },
        { name: "Unknown Mortal Orchestra", ms: 12 * 6e4, plays: 4 }
      ]
    };
    return {
      days: 7,
      hasData: true,
      listenedMs: cur.listenedMs,
      listenedCount: cur.listenedCount,
      skippedCount: cur.skippedCount,
      uniqueArtists: cur.uniqueArtists,
      skipRate: cur.skipRate,
      topArtists: cur.topArtists,
      current: cur,
      previous: prev,
      dailyMinutes: [22, 31, 26, 48, 37, 54, 62],
      prevDailyMinutes: [18, 24, 16, 32, 22, 38, 40],
      movers: {
        newIn: ["Men I Trust", "Beach House"],
        dropped: ["Radiohead", "Unknown Mortal Orchestra"],
        risers: [{ name: "Mac DeMarco", from: 6, to: 3 }]
      }
    };
  }
  function WeeklyReportModal({ onClose, demo = false }) {
    const report = Spicetify.React.useMemo(() => {
      const r = prefs.getReport(7);
      return demo || !r.hasData ? demoReport() : r;
    }, [demo]);
    const [page, setPage] = Spicetify.React.useState(1);
    const onDismiss = () => {
      prefs.markReportShown();
      onClose();
    };
    const shareText = () => {
      const cur = fmtDuration(report.current.listenedMs).text;
      const lines = [
        `mixline \xB7 last ${report.days}d`,
        `${cur} \xB7 ${report.current.listenedCount} tracks \xB7 ${report.current.uniqueArtists} artists`,
        "Top: " + report.topArtists.slice(0, 3).map((a) => a.name).join(", ")
      ];
      return lines.join("\n");
    };
    return h8(
      "div",
      {
        className: "mw-wk-backdrop",
        onClick: (e) => {
          if (e.target === e.currentTarget) onDismiss();
        }
      },
      h8(
        "div",
        { className: "mw-wk-card" },
        // Corner brackets — stay on the OUTER card so they hug the border
        h8("div", { className: "mw-wk-corner mw-wk-corner-tl" }),
        h8("div", { className: "mw-wk-corner mw-wk-corner-tr" }),
        h8("div", { className: "mw-wk-corner mw-wk-corner-bl" }),
        h8("div", { className: "mw-wk-corner mw-wk-corner-br" }),
        // Decorations — live on OUTER card so they can overflow / sit on top of border
        h8("div", { className: "mw-wk-deco mw-wk-deco-tag" }, "// 07d"),
        h8("div", { className: "mw-wk-deco mw-wk-deco-glitch mw-wk-deco-bl" }),
        h8("div", { className: "mw-wk-deco mw-wk-deco-glitch mw-wk-deco-br" }),
        // Scrollable inner body — content lives here, scrollbar hidden, no jitter
        h8(
          "div",
          { className: "mw-wk-card-body" },
          // Shared sparkline gradient (#mwWkGrad referenced by multiple svgs)
          h8(
            "svg",
            { width: 0, height: 0, style: { position: "absolute" } },
            h8(
              "defs",
              null,
              h8(
                "linearGradient",
                { id: "mwWkGrad", x1: "0", y1: "0", x2: "0", y2: "1" },
                h8("stop", { offset: "0%", stopColor: "#1db954", stopOpacity: "0.55" }),
                h8("stop", { offset: "100%", stopColor: "#1db954", stopOpacity: "0" })
              )
            )
          ),
          // Header
          h8(
            "div",
            { className: "mw-wk-tag" },
            h8("span", { className: "mw-wk-tag-dot" }),
            h8("span", null, "mixline // digest"),
            h8("span", { className: "mw-wk-tag-bar" }),
            h8("span", null, "v1")
          ),
          h8("div", { className: "mw-wk-title", "data-text": "Your week in mixes" }, "Your week in mixes"),
          h8(
            "div",
            { className: "mw-wk-subtitle" },
            page === 1 ? "// last 7d \xB7 compiled from session events" : "// last 7d vs previous 7d \xB7 diff report"
          ),
          // Pager
          h8(
            "div",
            { className: "mw-wk-pager" },
            h8("button", {
              className: `mw-wk-pager-tab${page === 1 ? " on" : ""}`,
              onClick: () => setPage(1)
            }, h8("span", { className: "mw-wk-ix" }, "01"), "this week"),
            h8("button", {
              className: `mw-wk-pager-tab${page === 2 ? " on" : ""}`,
              onClick: () => setPage(2)
            }, h8("span", { className: "mw-wk-ix" }, "02"), "vs last week")
          ),
          // Page content (key forces remount -> animation replays)
          h8(
            "div",
            { key: page },
            page === 1 ? h8(PageThisWeek, { report }) : h8(PageVsLast, { report })
          ),
          // Actions
          h8(
            "div",
            { className: "mw-wk-actions" },
            h8("span", { className: "mw-wk-actions-fill" }, "> end_of_digest"),
            h8("button", { className: "mw-wk-btn", onClick: onDismiss }, "Dismiss"),
            h8("button", {
              className: "mw-wk-btn mw-wk-btn-primary",
              onClick: () => {
                navigator.clipboard?.writeText(shareText());
                Spicetify.showNotification("Report copied to clipboard");
                onDismiss();
              }
            }, "Share")
          )
        )
      )
    );
  }
  function renderReport(reactDOM) {
    const prior = document.getElementById("mywave-weekly");
    if (prior) {
      try {
        reactDOM.unmountComponentAtNode(prior);
      } catch {
      }
      prior.remove();
    }
    const container = document.createElement("div");
    container.id = "mywave-weekly";
    document.body.appendChild(container);
    const close = () => {
      try {
        reactDOM.unmountComponentAtNode(container);
      } catch {
      }
      container.remove();
    };
    reactDOM.render(h8(WeeklyReportModal, { onClose: close }), container);
  }
  function maybeShowWeeklyReport(reactDOM) {
    window.__mwShowReport = () => renderReport(reactDOM);
    if (!prefs.shouldShowWeeklyReport()) return;
    setTimeout(() => renderReport(reactDOM), 8e3);
  }

  // src/styles/base.ts
  var cssBase = `
    :root {
      --mw-ease: cubic-bezier(0.23, 1, 0.32, 1);
      --mw-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
      --mw-g: #1DB954;
      --mw-g2: #1ed760;
      --mw-bg: #0a0a0a;
      --mw-card: #141414;
      --mw-border: #1e1e1e;
      --mw-text: #e8e8e8;
      --mw-sub: #6a6a6a;
      --mw-glow: rgba(29,185,84,.12);
      --mw-mono: 'Courier New', 'Consolas', 'Monaco', monospace;
    }

    .mw-wave-icon { display:flex; flex-shrink:0; }
    .mw-wbar { fill:currentColor; transform-origin:bottom center; }
    .mw-trigger-on .mw-wbar-1 { animation:mw-b .45s ease-in-out infinite alternate; }
    .mw-trigger-on .mw-wbar-2 { animation:mw-b .45s ease-in-out .07s infinite alternate; }
    .mw-trigger-on .mw-wbar-3 { animation:mw-b .45s ease-in-out .14s infinite alternate; }
    .mw-trigger-on .mw-wbar-4 { animation:mw-b .45s ease-in-out .21s infinite alternate; }
    @keyframes mw-marquee {
      0%, 15% { transform: translateX(0); }
      85%, 100% { transform: translateX(calc(-50% - 0.5em)); }
    }
    .mw-scroll { text-overflow: clip !important; }
    .mw-scroll-track {
      display: inline-block;
      white-space: nowrap;
      animation: mw-marquee 16s linear infinite;
    }
    .mw-scroll-gap { opacity: 0.3; }
    @keyframes mw-b { 0%{transform:scaleY(.25)} 100%{transform:scaleY(1)} }
    @keyframes mw-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

    /* ===== EQUALIZER VISUALIZER ===== */
    .mw-eq {
      font-family: var(--mw-mono);
      font-size: 9px;
      line-height: 1.1;
      text-align: center;
      color: rgba(29,185,84,.18);
      padding: 8px 0;
      margin: 0;
      user-select: none;
      letter-spacing: 2.5px;
      white-space: pre;
    }
    .mw-eq-mini { font-size: 7px; letter-spacing: 2px; padding: 4px 0; }
    .mw-eq-on { color: var(--mw-g); text-shadow: 0 0 6px rgba(29,185,84,.5), 0 0 14px rgba(29,185,84,.15); }

    /* ===== ASCII BANNER IN PANEL ===== */
    .mw-ascii-banner {
      position: relative;
      border-radius: 12px;
      background: radial-gradient(ellipse at center, rgba(29,185,84,.06) 0%, transparent 70%);
      overflow: hidden;
      padding: 4px 0;
      animation: mw-in 300ms var(--mw-ease) both;
    }
    .mw-ascii-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .mw-ascii-label {
      font-family: var(--mw-mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #fff;
      text-shadow: 0 0 6px var(--mw-g), 0 0 14px rgba(29,185,84,.4), 0 0 28px rgba(29,185,84,.12);
      display: flex;
      align-items: center;
    }

    /* ===== CONSOLE CURSOR ===== */
    .mw-cursor {
      animation: mw-cursor-blink 1s step-end infinite;
      opacity: 1;
      font-size: 0.9em;
    }
    @keyframes mw-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }

    /* ===== PAUSE ALL ANIMATIONS WHEN HIDDEN ===== */
    .mw-paused .mw-scroll-track,
    .mw-paused .mw-sea-row,
    .mw-paused .mw-cursor,
    .mw-paused .mw-wbar,
    .mw-paused .mw-wk-mbar,
    .mw-paused .mw-wk-tag-dot {
      animation-play-state: paused !important;
    }
    .mw-paused .mw-eq-ch { transition: none !important; }
`;

  // src/styles/home.ts
  var cssHome = `
    /* ===== KILL SPOTIFY PURPLE BG ===== */
    #mywave-home ~ *,
    [data-testid="home-page"] > [style*="background-color"],
    .main-home-homeHeader,
    .main-home-homeHeader[style] { background-color: transparent !important; }

    /* ===== SEA WAVES ===== */
    .mw-sea {
      position: absolute;
      inset: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      font-family: var(--mw-mono);
      color: var(--mw-g);
      font-size: 9px;
      line-height: 1.35;
      letter-spacing: 1.5px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .mw-sea-row {
      white-space: nowrap;
      animation: mw-sea-scroll linear infinite;
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    @keyframes mw-sea-scroll {
      from { transform: translate3d(0,0,0); }
      to { transform: translate3d(-50%,0,0); }
    }

    /* ===== HOME BANNER ===== */
    #mywave-home { padding: 0 32px; margin-bottom: 8px; }
    .mw-home {
      position: relative;
      border-radius: 14px;
      background: linear-gradient(180deg, #050a05 0%, #030503 100%);
      border: 1px solid rgba(29,185,84,.08);
      overflow: hidden;
      cursor: default;
      min-height: 130px;
      transition: border-color 400ms var(--mw-ease), box-shadow 400ms var(--mw-ease);
    }
    .mw-home:hover { border-color: rgba(29,185,84,.2); box-shadow:0 4px 30px rgba(29,185,84,.06); }
    .mw-home-glow {
      position: absolute;
      top: -30%; left: 25%;
      width: 50%; height: 160%;
      background: radial-gradient(ellipse, rgba(29,185,84,.06) 0%, transparent 65%);
      pointer-events: none;
      z-index: 1;
      animation:mw-home-glow-drift 8s ease-in-out infinite;
    }
    @keyframes mw-home-glow-drift {
      0%,100% { transform:translateX(0); opacity:1; }
      50% { transform:translateX(8px); opacity:.8; }
    }
    .mw-home-inner {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px 14px;
    }
    /* Top: brand + typing tag */
    .mw-home-top-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mw-home-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 800;
      color: var(--mw-text);
      letter-spacing: -0.3px;
    }
    .mw-home-brand svg { color: var(--mw-g); }
    .mw-home-tag {
      flex-shrink: 0;
    }
    .mw-home-tag .mw-ascii-label {
      font-size: 10px;
      letter-spacing: 2px;
      min-width: 100px;
      color: var(--mw-g);
      text-shadow: 0 0 8px rgba(29,185,84,.4);
    }
    .mw-home-desc {
      font-size: 12px;
      color: var(--mw-sub);
      font-family: var(--mw-mono);
      letter-spacing: 0.5px;
    }
    .mw-home-np {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mw-home-np-art {
      width: 32px; height: 32px;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 0 10px rgba(29,185,84,.15);
    }
    .mw-home-np-text { min-width: 0; }
    .mw-home-np-name {
      font-size: 13px; font-weight: 600; color: var(--mw-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-np-artist {
      font-size: 11px; color: var(--mw-sub);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-btns {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mw-home-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms, transform 200ms var(--mw-spring), box-shadow 150ms;
    }
    .mw-home-btn:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-btn-play { background: var(--mw-g); color: black; box-shadow:0 2px 10px rgba(29,185,84,.2); }
    .mw-home-btn-play:hover { background: var(--mw-g2); box-shadow: 0 4px 20px rgba(29,185,84,.35); }
    .mw-home-btn-fav { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-fav:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-fav svg { color: #E91E63; }
    .mw-home-btn-stop { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-stop:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-mix { background: rgba(29,185,84,.15); color: var(--mw-g); border: 1px solid rgba(29,185,84,.2); }
    .mw-home-btn-mix:hover { background: rgba(29,185,84,.25); }
    .mw-home-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--mw-g);
      font-family: var(--mw-mono);
    }
    .mw-home-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--mw-g);
      box-shadow: 0 0 6px var(--mw-g), 0 0 12px rgba(29,185,84,.3);
      animation: mw-blink 2s ease-in-out infinite;
    }
    .mw-home-moods {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .mw-home-moods::-webkit-scrollbar { display: none; }
    .mw-home-mood {
      flex-shrink: 0;
      padding: 5px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: var(--mw-sub);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms var(--mw-ease), border-color 150ms, color 150ms, transform 200ms var(--mw-spring);
    }
    .mw-home-mood:hover { color: var(--mw-text); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.08); }
    .mw-home-mood:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-mood-on { background: var(--mw-g); border-color: var(--mw-g); color: black; box-shadow:0 2px 10px rgba(29,185,84,.25); }
    .mw-home-mood-on:hover { background: var(--mw-g2); border-color: var(--mw-g2); box-shadow:0 2px 14px rgba(29,185,84,.35); }
    .mw-home-mood-artist { border-color: rgba(29,185,84,.3); color: var(--mw-g); }
    .mw-home-mood-artist.mw-home-mood-on { background:rgba(29,185,84,.15); border-color:var(--mw-g); color:var(--mw-g); box-shadow:0 2px 10px rgba(29,185,84,.25); }
    .mw-home-mood-artist.mw-home-mood-on:hover { background:rgba(29,185,84,.22); box-shadow:0 2px 14px rgba(29,185,84,.35); }
    .mw-home-mood-playlist { border-color:rgba(100,150,255,.3); color:rgba(100,150,255,.9); }
    .mw-home-mood-playlist.mw-home-mood-on { background:rgba(100,150,255,.15); border-color:rgba(100,150,255,.7); color:rgba(100,150,255,1); box-shadow:0 2px 10px rgba(100,150,255,.25); }
    .mw-home-mood-playlist.mw-home-mood-on:hover { background:rgba(100,150,255,.22); box-shadow:0 2px 14px rgba(100,150,255,.35); }
    .mw-home-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; }
    .mw-home-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-home-mood-fav.mw-home-mood-on { background:rgba(233,30,99,.15); border-color:#E91E63; color:#E91E63; box-shadow:0 2px 10px rgba(233,30,99,.25); }
    .mw-home-mood-fav.mw-home-mood-on:hover { background:rgba(233,30,99,.22); border-color:#E91E63; box-shadow:0 2px 14px rgba(233,30,99,.35); }
`;

  // src/styles/panel.ts
  var cssPanel = `
    /* ===== TRIGGER ===== */
    #mywave-bb { display:flex; align-items:center; margin:0 4px; }
    .mw-bottombar { position:relative; display:flex; align-items:center; }
    .mw-trigger {
      display:flex; align-items:center; gap:8px;
      border:none; border-radius:6px; padding:4px 8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:color 150ms var(--mw-ease), background 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-trigger:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-trigger:active { transform:scale(.97); transition-duration:80ms; }
    .mw-trigger-on { color:var(--mw-g); }
    .mw-trigger-on .mw-trigger-icon {
      animation:mw-tpulse 2.5s ease-in-out infinite;
    }
    @keyframes mw-tpulse {
      0%,100% { filter:drop-shadow(0 0 3px rgba(29,185,84,.3)); }
      50% { filter:drop-shadow(0 0 8px rgba(29,185,84,.6)); }
    }
    .mw-trigger-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; }

    /* ===== PANEL ===== */
    .mw-panel {
      position:absolute; bottom:44px; right:-8px; width:360px;
      border-radius:16px; background:rgba(10,10,10,.96);
      backdrop-filter:blur(20px) saturate(1.3);
      -webkit-backdrop-filter:blur(20px) saturate(1.3);
      border:1px solid rgba(255,255,255,.06);
      box-shadow: 0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(29,185,84,.06), 0 0 40px rgba(29,185,84,.04);
      overflow:hidden; z-index:10000;
      transform-origin:bottom right;
      animation:mw-pop 300ms var(--mw-ease) forwards;
    }
    @keyframes mw-pop { from{opacity:0;transform:scale(.94) translateY(6px)} to{opacity:1;transform:none} }
    .mw-panel-inner { padding:16px; display:flex; flex-direction:column; gap:14px; max-height:calc(100vh - 120px); overflow-y:auto; }
    .mw-panel-inner::-webkit-scrollbar { width:3px; }
    .mw-panel-inner::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* Tab body \u2014 fade transition + fixed min height */
    .mw-tab-body {
      min-height:280px;
      display:flex; flex-direction:column; gap:14px;
      animation:mw-tab-fade 220ms var(--mw-ease) both;
    }
    @keyframes mw-tab-fade {
      from { opacity:0; transform:translateY(6px); }
      to { opacity:1; transform:translateY(0); }
    }

    /* ===== HEADER ===== */
    .mw-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-header-left { display:flex; align-items:center; gap:10px; }
    .mw-header-title { font-size:16px; font-weight:800; color:var(--mw-text); letter-spacing:-0.3px; }
    .mw-logo {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px;
      background:linear-gradient(135deg, var(--mw-g) 0%, #17a34a 100%);
      color:black;
      box-shadow: 0 2px 12px rgba(29,185,84,.35), 0 0 0 1px rgba(29,185,84,.1);
    }
    .mw-header-tabs { display:flex; gap:2px; }
    .mw-htab {
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border:none; border-radius:8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-htab:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-htab:active { transform:scale(.9); transition-duration:80ms; }
    .mw-htab-on { background:var(--mw-glow); color:var(--mw-g); }

    /* ===== CLI-style transient status line ===== */
    .mw-toast {
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 1px;
      color: var(--mw-g);
      padding: 4px 12px 0 12px;
      margin-top: -2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      animation: mw-toast-in 220ms var(--mw-ease);
    }
    .mw-toast-err { color: #ff6b6b; }
    @keyframes mw-toast-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ===== IDLE START CARD ===== */
    .mw-idle-np {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--mw-border);
      margin-bottom: 8px;
      animation: mw-in 250ms var(--mw-ease) both;
    }
    .mw-idle-art {
      width: 42px;
      height: 42px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .mw-idle-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .mw-idle-name {
      font-family: var(--mw-mono);
      font-size: 11px;
      font-weight: 700;
      color: var(--mw-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mw-idle-artist {
      font-family: var(--mw-mono);
      font-size: 9px;
      color: var(--mw-sub);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mw-idle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 0.5px;
      border: 1px solid var(--mw-border);
      border-radius: 6px;
      padding: 5px 10px;
      background: transparent;
      color: var(--mw-sub);
      cursor: pointer;
      transition: all 150ms var(--mw-ease);
      white-space: nowrap;
    }
    .mw-idle-btn:hover {
      color: var(--mw-text);
      border-color: var(--mw-sub);
      background: rgba(255,255,255,.04);
    }
    .mw-idle-btn-primary {
      color: var(--mw-g);
      border-color: var(--mw-g);
      background: rgba(29,185,84,.08);
    }
    .mw-idle-btn-primary:hover {
      background: rgba(29,185,84,.18);
      color: var(--mw-g2);
      border-color: var(--mw-g2);
    }

    /* ===== HERO (inactive state) ===== */
    .mw-hero {
      text-align: center;
      padding: 4px 0 8px;
      animation: mw-in 250ms var(--mw-ease) both;
    }
    .mw-hero-text {
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--mw-sub);
      margin-top: 4px;
    }

    /* ===== NOW PLAYING ===== */
    .mw-np {
      display:flex; flex-direction:column; gap:8px;
      padding:12px; border-radius:12px;
      background:linear-gradient(135deg, rgba(20,20,20,.9) 0%, rgba(14,14,14,.95) 100%);
      border:1px solid rgba(255,255,255,.05);
      animation:mw-in 280ms var(--mw-ease) both;
      transition:border-color 300ms var(--mw-ease);
    }
    .mw-np:hover { border-color:rgba(255,255,255,.08); }
    .mw-np-top { display:flex; align-items:center; gap:12px; }
    .mw-np-art-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
    .mw-np-art-glow {
      position:absolute; inset:-8px; width:calc(100% + 16px); height:calc(100% + 16px);
      border-radius:14px; object-fit:cover;
      filter:blur(12px) saturate(2) brightness(0.6);
      opacity:0.6; z-index:0; pointer-events:none;
      animation:mw-glow-breathe 3s ease-in-out infinite;
    }
    @keyframes mw-glow-breathe {
      0%,100% { opacity:0.5; filter:blur(12px) saturate(2) brightness(0.6); }
      50% { opacity:0.65; filter:blur(14px) saturate(2.2) brightness(0.65); }
    }
    .mw-np-art {
      position:relative; z-index:1;
      width:44px; height:44px; border-radius:8px; object-fit:cover; flex-shrink:0;
      background:linear-gradient(135deg,#0d1a0d,#080808);
      box-shadow: 0 0 12px rgba(29,185,84,.08);
    }
    .mw-np-ph { background:linear-gradient(135deg,rgba(29,185,84,.15),#080808); }
    .mw-np-info { flex:1; min-width:0; }
    .mw-np-name { font-size:14px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-np-artist { font-size:12px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-np-controls { display:flex; flex-wrap:wrap; align-items:center; gap:4px; row-gap:4px; padding-top:4px; border-top:1px solid var(--mw-border); }
    .mw-np-btn {
      display:flex; align-items:center; gap:5px;
      border:none; border-radius:6px; padding:5px 10px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      font-size:11px; font-weight:600;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-np-btn:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-np-btn:active { transform:scale(.93); transition-duration:80ms; }
    .mw-np-like:hover { color:#E91E63; }
    .mw-np-dislike:hover { color:#ff5252; }
    .mw-np-locked { color:var(--mw-g) !important; background:var(--mw-glow) !important; }
    .mw-np-lock { margin-left:auto; }
    .mw-np-mixfrom { color:var(--mw-g); }
    .mw-np-mixfrom:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }
    .mw-np-discovery:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }
    .mw-np-save:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }
    .mw-np-share:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }

    /* ===== MOOD CHIPS (main tab \u2014 pinned only) ===== */
    .mw-moods { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) 50ms both; }
    .mw-moods-label {
      font-family: var(--mw-mono);
      font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
    }
    .mw-moods-empty { font-size:12px; color:var(--mw-sub); font-style:italic; }
    .mw-moods-row { display:flex; gap:6px; flex-wrap:wrap; }
    .mw-mood {
      padding:6px 16px; border-radius:20px; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-text); font-size:13px; font-weight:600; cursor:pointer;
      transition:background 150ms var(--mw-ease), border-color 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood:hover { background:rgba(255,255,255,.04); border-color:#333; }
    .mw-mood:active { transform:scale(.95); transition-duration:80ms; }
    .mw-mood-on { background:var(--mw-g); border-color:var(--mw-g); color:black; box-shadow:0 2px 12px rgba(29,185,84,.3), 0 0 0 1px rgba(29,185,84,.15); }
    .mw-mood-on:hover { background:var(--mw-g2); border-color:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.4); }
    .mw-mood-artist { border-color:rgba(29,185,84,.3); color:var(--mw-g); }
    .mw-mood-artist:hover { border-color:rgba(29,185,84,.5); background:rgba(29,185,84,.08); }
    .mw-mood-artist.mw-mood-on { background:rgba(29,185,84,.15); border-color:var(--mw-g); color:var(--mw-g); box-shadow:0 2px 12px rgba(29,185,84,.25); }
    .mw-mood-artist.mw-mood-on:hover { background:rgba(29,185,84,.22); box-shadow:0 2px 16px rgba(29,185,84,.35); }
    .mw-mood-playlist { border-color:rgba(100,150,255,.3); color:rgba(100,150,255,.9); }
    .mw-mood-playlist:hover { border-color:rgba(100,150,255,.5); background:rgba(100,150,255,.08); }
    .mw-mood-playlist.mw-mood-on { background:rgba(100,150,255,.15); border-color:rgba(100,150,255,.7); color:rgba(100,150,255,1); box-shadow:0 2px 12px rgba(100,150,255,.25); }
    .mw-mood-playlist.mw-mood-on:hover { background:rgba(100,150,255,.22); box-shadow:0 2px 16px rgba(100,150,255,.35); }
    .mw-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; display:flex; align-items:center; gap:2px; }
    .mw-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-mood-fav.mw-mood-on { background:rgba(233,30,99,.15); border-color:#E91E63; color:#E91E63; box-shadow:0 2px 12px rgba(233,30,99,.25); }
    .mw-mood-fav.mw-mood-on:hover { background:rgba(233,30,99,.22); box-shadow:0 2px 16px rgba(233,30,99,.35); }

    /* ===== MOOD TAB (all moods with pin toggles) ===== */
    .mw-mood-tab { display:flex; flex-direction:column; gap:10px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-mood-grid { display:flex; flex-direction:column; gap:4px; }
    .mw-mood-item {
      display:flex; align-items:center; gap:4px;
      padding:4px; border-radius:10px;
      transition:background 150ms var(--mw-ease);
    }
    .mw-mood-item:hover { background:rgba(255,255,255,.03); }
    .mw-mood-item-on .mw-mood-item-btn { color:var(--mw-g); }
    .mw-mood-item-btn {
      flex:1; display:flex; align-items:center; gap:8px;
      border:none; background:none; color:var(--mw-text);
      font-size:13px; font-weight:600; cursor:pointer; padding:8px 10px; border-radius:8px;
      transition:background 150ms var(--mw-ease), color 150ms;
    }
    .mw-mood-item-btn:hover { background:rgba(255,255,255,.05); }
    .mw-mood-item-btn:active { transform:scale(.97); }
    .mw-mood-pin {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border:none; border-radius:8px;
      background:transparent; color:var(--mw-sub); cursor:pointer; flex-shrink:0;
      transition:color 150ms var(--mw-ease), background 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood-pin:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-mood-pin:active { transform:scale(.85); transition-duration:80ms; }
    .mw-mood-pin-on { color:var(--mw-g); }
    .mw-mood-pin-on:hover { color:var(--mw-g2); background:rgba(29,185,84,.1); }

    /* ===== MOOD TAB SECTIONS ===== */
    .mw-mt-section { display:flex; flex-direction:column; gap:6px; }
    .mw-mt-section + .mw-mt-section { margin-top:6px; padding-top:10px; border-top:1px solid var(--mw-border); }
    .mw-mt-section-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-mt-current {
      font-size:13px; font-weight:600; color:var(--mw-g); padding:6px 0;
    }
    .mw-mt-search {
      width:100%; padding:8px 12px; border-radius:8px;
      border:1px solid var(--mw-border); background:rgba(255,255,255,.04);
      color:var(--mw-text); font-size:13px; font-family:inherit;
      outline:none; transition:border-color 200ms var(--mw-ease);
    }
    .mw-mt-search::placeholder { color:var(--mw-sub); }
    .mw-mt-search:focus { border-color:rgba(29,185,84,.4); }
    .mw-mt-list { display:flex; flex-direction:column; gap:2px; max-height:160px; overflow-y:auto; }
    .mw-mt-list::-webkit-scrollbar { width:3px; }
    .mw-mt-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-mt-artist-btn {
      display:flex; align-items:center; gap:8px;
      width:100%; border:none; background:none; color:var(--mw-text);
      font-size:13px; font-weight:500; cursor:pointer; padding:8px 10px; border-radius:8px;
      text-align:left; transition:background 150ms var(--mw-ease);
    }
    .mw-mt-artist-btn:hover { background:rgba(255,255,255,.05); }
    .mw-mt-artist-active { color:var(--mw-g); font-weight:600; }
    .mw-mt-artist-img { width:24px; height:24px; border-radius:50%; object-fit:cover; flex-shrink:0; }
    .mw-mt-pl-info { display:flex; flex-direction:column; min-width:0; }
    .mw-mt-pl-owner { font-size:10px; color:rgba(255,255,255,.3); font-weight:400; }
    .mw-mt-pl-cover { border-radius:4px !important; }
    .mw-mt-pl-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mw-mt-mypl { max-height:200px; overflow-y:auto; }
    .mw-mt-plays { margin-left:auto; font-size:11px; color:var(--mw-sub); font-family:var(--mw-mono); }
    .mw-mt-loading { font-size:12px; color:var(--mw-sub); padding:8px 10px; }

    /* ===== INLINE STATS ===== */
    .mw-isource {
      display:flex; align-items:center; gap:8px;
      padding:8px 12px; border-radius:10px;
      background:var(--mw-card); border:1px solid var(--mw-border);
      animation:mw-in 250ms var(--mw-ease) 100ms both;
    }
    .mw-isource-lbl { font-size:10px; color:var(--mw-sub); font-weight:600; font-family:var(--mw-mono); text-transform:uppercase; letter-spacing:1px; flex-shrink:0; }
    .mw-isource-val { font-size:13px; color:var(--mw-text); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* ===== START ===== */
    .mw-start-section { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-start-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:12px; border:none; border-radius:12px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
      background:var(--mw-g); color:black;
    }
    .mw-start-btn:hover { background:var(--mw-g2); box-shadow:0 4px 24px rgba(29,185,84,.3); }
    .mw-start-btn:active { transform:scale(.97); transition-duration:80ms; }
    .mw-start-fav { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-start-fav:hover { background:#1a1a1a; box-shadow:none; }
    .mw-start-fav svg { color:#E91E63; }
    .mw-start-alt {
      background:transparent; color:var(--mw-sub); border:1px solid var(--mw-border);
      font-size:11px; padding:9px 12px; font-weight:600;
    }
    .mw-start-alt:hover { color:var(--mw-g); border-color:var(--mw-g); background:rgba(29,185,84,.06); box-shadow:none; }
    .mw-loading { opacity:.5; pointer-events:none; }

    /* ===== HISTORY ===== */
    .mw-hist { display:flex; flex-direction:column; gap:2px; max-height:280px; overflow-y:auto; }
    .mw-hist::-webkit-scrollbar { width:3px; }
    .mw-hist::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-hist-row { display:flex; align-items:center; gap:10px; padding:6px 6px; border-radius:8px; animation:mw-in 200ms var(--mw-ease) both; transition:background 200ms var(--mw-ease); }
    .mw-hist-row:hover { background:rgba(255,255,255,.04); }
    .mw-hist-num { font-family:var(--mw-mono); font-size:10px; color:rgba(255,255,255,.15); width:16px; text-align:center; flex-shrink:0; font-weight:600; }
    .mw-hist-art { width:36px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0; cursor:pointer; background:linear-gradient(135deg,#1a1a1a,#0a0a0a); transition:transform 200ms var(--mw-spring), box-shadow 200ms var(--mw-ease); }
    .mw-hist-art:hover { transform:scale(1.06); box-shadow:0 2px 10px rgba(0,0,0,.4); }
    .mw-hist-ph { background:linear-gradient(135deg,#222,#111); }
    .mw-hist-info { flex:1; min-width:0; cursor:pointer; }
    .mw-hist-name { font-size:13px; font-weight:500; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-hist-artist { font-size:11px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-like {
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border:none; border-radius:50%;
      background:transparent; color:rgba(255,255,255,.15); cursor:pointer; flex-shrink:0;
      transition:color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-like:hover { color:rgba(255,255,255,.4); transform:scale(1.15); }
    .mw-like:active { transform:scale(.9); transition-duration:80ms; }
    .mw-liked { color:#E91E63 !important; filter:drop-shadow(0 0 4px rgba(233,30,99,.35)); }

    /* ===== STATS TAB ===== */
    .mw-stats-tab { display:flex; flex-direction:column; gap:12px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-stats-grid { display:flex; gap:8px; }
    .mw-stat-card { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); transition:border-color 200ms var(--mw-ease), background 200ms var(--mw-ease); }
    .mw-stat-card:hover { border-color:rgba(255,255,255,.08); background:rgba(22,22,22,.9); }
    .mw-stat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-stat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    .mw-top-artists { display:flex; flex-direction:column; gap:4px; }
    .mw-top-label { font-family:var(--mw-mono); font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase; margin-bottom:4px; }
    .mw-top-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); animation:mw-in 200ms var(--mw-ease) both; transition:border-color 200ms var(--mw-ease), background 200ms var(--mw-ease); }
    .mw-top-row:hover { border-color:rgba(29,185,84,.15); background:rgba(22,22,22,.9); }
    .mw-top-rank { font-family:var(--mw-mono); font-size:14px; font-weight:800; color:var(--mw-g); width:18px; }
    .mw-top-name { flex:1; font-size:13px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-top-count { font-family:var(--mw-mono); font-size:11px; color:var(--mw-sub); flex-shrink:0; }

    .mw-stat-seed { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mw-sub); padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-seed-lbl { font-family:var(--mw-mono); font-weight:700; color:var(--mw-g); text-transform:uppercase; font-size:9px; letter-spacing:1px; }

    /* ===== BOTTOM ACTIONS ===== */
    .mw-actions { display:flex; gap:8px; padding-top:2px; }
    .mw-act {
      display:flex; align-items:center; justify-content:center; gap:6px;
      flex:1; padding:10px; border-radius:10px; border:none;
      font-size:13px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
    }
    .mw-act:active { transform:scale(.96); transition-duration:80ms; }
    .mw-act-stop { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-act-stop:hover { background:#1a1a1a; }
    .mw-act-reseed { background:var(--mw-g); color:black; box-shadow:0 2px 8px rgba(29,185,84,.15); }
    .mw-act-reseed:hover { background:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.3); }

    .mw-empty { font-size:13px; color:var(--mw-sub); text-align:center; padding:24px 0; }

    @keyframes mw-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ===== GUIDE BUTTON ===== */
    .mw-guide-btn {
      width:20px; height:20px; border-radius:50%; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-sub); font-size:11px; font-weight:700;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:color 150ms, border-color 150ms, background 150ms;
      font-family:var(--mw-mono);
    }
    .mw-guide-btn:hover { color:var(--mw-text); border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.05); }
`;

  // src/styles/onboarding.ts
  var cssOnboarding = `
    /* ===== ONBOARDING MODAL ===== */
    .mw-ob-backdrop {
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,.75); backdrop-filter:blur(8px);
      display:flex; align-items:center; justify-content:center;
      animation:mw-ob-fade-in 300ms ease both;
    }
    @keyframes mw-ob-fade-in { from { opacity:0; } to { opacity:1; } }

    .mw-ob-modal {
      width:380px; max-width:90vw; max-height:80vh;
      background:rgba(18,18,18,.98); border:1px solid rgba(255,255,255,.08);
      border-radius:16px; overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04);
      display:flex; flex-direction:column;
      animation:mw-ob-slide-in 400ms cubic-bezier(.23,1,.32,1) both;
    }
    @keyframes mw-ob-slide-in { from { opacity:0; transform:translateY(20px) scale(.97); } to { opacity:1; transform:none; } }

    .mw-ob-content {
      padding:28px 24px 16px;
      flex:1; overflow-y:auto;
      animation:mw-tab-fade 200ms ease both;
    }

    .mw-ob-hero {
      display:flex; flex-direction:column; align-items:center; gap:12px;
      padding:16px 0 8px; color:var(--mw-g);
    }
    .mw-ob-title {
      font-size:24px; font-weight:900; letter-spacing:-0.5px; color:var(--mw-text);
      font-family:var(--mw-mono);
    }

    .mw-ob-heading {
      font-size:16px; font-weight:800; color:var(--mw-text); margin-bottom:14px;
      letter-spacing:-0.3px;
    }

    .mw-ob-desc {
      font-size:13px; color:var(--mw-sub); line-height:1.55; margin-bottom:12px;
    }
    .mw-ob-hint {
      font-size:11px; color:rgba(255,255,255,.3); font-style:italic; margin-top:8px;
    }

    .mw-ob-row {
      display:flex; align-items:center; gap:12px;
      padding:8px 10px; margin-bottom:6px;
      border-radius:10px; background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.04);
    }
    .mw-ob-icon {
      flex-shrink:0; width:28px; height:28px;
      display:flex; align-items:center; justify-content:center;
      border-radius:8px; background:rgba(29,185,84,.1); color:var(--mw-g);
    }
    .mw-ob-text { font-size:12.5px; color:var(--mw-sub); line-height:1.4; }

    .mw-ob-footer {
      padding:12px 24px 20px;
      display:flex; flex-direction:column; align-items:center; gap:12px;
      border-top:1px solid rgba(255,255,255,.04);
      flex-shrink:0;
    }
    .mw-ob-dots {
      display:flex; gap:6px;
    }
    .mw-ob-dot {
      width:6px; height:6px; border-radius:50%;
      background:rgba(255,255,255,.15); transition:background 200ms, transform 200ms;
    }
    .mw-ob-dot-on { background:var(--mw-g); transform:scale(1.3); }

    .mw-ob-lang-row { display:flex; gap:10px; justify-content:center; margin-top:8px; }
    .mw-ob-lang {
      display:flex; align-items:center; gap:10px;
      padding:14px 24px; border-radius:12px;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06);
      color:var(--mw-sub); font-size:15px; font-weight:600; cursor:pointer;
      transition:background 150ms, border-color 150ms, color 150ms, transform 150ms;
    }
    .mw-ob-lang:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.12); color:var(--mw-text); }
    .mw-ob-lang:active { transform:scale(.97); }
    .mw-ob-lang-on { border-color:var(--mw-g); background:rgba(29,185,84,.08); color:var(--mw-text); }
    .mw-ob-flag { font-size:20px; line-height:1; }

    .mw-ob-btns { display:flex; gap:8px; width:100%; flex-shrink:0; }
    .mw-ob-btn {
      padding:9px 16px; border-radius:8px; border:none;
      font-size:13px; font-weight:700; cursor:pointer;
      transition:background 150ms, transform 150ms;
      white-space:nowrap; line-height:1.2;
    }
    .mw-ob-btn:active { transform:scale(.96); }
    .mw-ob-btn-next {
      flex:1; background:var(--mw-g) !important; color:black !important;
      -webkit-mask-image:none !important; mask-image:none !important;
      -webkit-text-fill-color:black !important;
      -webkit-background-clip:padding-box !important; background-clip:padding-box !important;
      overflow:visible;
    }
    .mw-ob-btn-next:hover { background:var(--mw-g2) !important; }
    .mw-ob-btn-back {
      background:rgba(255,255,255,.06); color:var(--mw-sub);
    }
    .mw-ob-btn-back:hover { background:rgba(255,255,255,.1); color:var(--mw-text); }
    .mw-ob-btn-skip {
      background:transparent; color:rgba(255,255,255,.25);
      padding:9px 12px;
    }
    .mw-ob-btn-skip:hover { color:rgba(255,255,255,.5); }
`;

  // src/styles/weekly.ts
  var cssWeekly = `
    /* ============================================================
       WEEKLY REPORT \u2014 stylised digest modal with glitch decorations
       ============================================================ */
    .mw-wk-backdrop{
      position:fixed; inset:0; z-index:99998;
      background:rgba(0,0,0,.78); backdrop-filter:blur(6px);
      display:grid; place-items:center;
      animation:mw-wk-fadein 220ms var(--mw-ease);
    }
    @keyframes mw-wk-fadein{ from{opacity:0} to{opacity:1} }

    .mw-wk-card{
      position:relative; width:460px; max-width:calc(100vw - 32px);
      background:linear-gradient(180deg,#0e1a11 0%,#070a08 100%);
      border:1px solid rgba(29,185,84,.35); border-radius:12px;
      box-shadow:0 20px 60px rgba(0,0,0,.6), 0 0 55px rgba(29,185,84,.13),
                 inset 0 0 0 1px rgba(255,255,255,.02);
      font-family:var(--mw-mono);
      overflow:visible;
    }
    .mw-wk-card-body{
      padding:30px 30px 26px;
      max-height:calc(100vh - 40px);
      overflow-y:auto;
      scrollbar-width:none;
      -ms-overflow-style:none;
    }
    .mw-wk-card-body::-webkit-scrollbar{ width:0; height:0; display:none }

    /* Corner tick-marks (4 green L-brackets) */
    .mw-wk-corner{ position:absolute; width:16px; height:16px; border:1px solid var(--mw-g); opacity:.75; pointer-events:none }
    .mw-wk-corner-tl{ top:-1px; left:-1px;  border-right:none; border-bottom:none }
    .mw-wk-corner-tr{ top:-1px; right:-1px; border-left:none;  border-bottom:none }
    .mw-wk-corner-bl{ bottom:-1px; left:-1px;  border-right:none; border-top:none }
    .mw-wk-corner-br{ bottom:-1px; right:-1px; border-left:none;  border-top:none }

    /* Decorations: tag top-left, glitch bottom corners */
    .mw-wk-deco{ position:absolute; font-family:var(--mw-mono); white-space:pre; pointer-events:none; z-index:12; line-height:1 }
    .mw-wk-deco-tag{
      top:-12px; left:-12px; font-size:10px; letter-spacing:1px;
      color:var(--mw-g); opacity:.9;
      text-shadow:0 0 8px rgba(29,185,84,.6);
      background:#070a08; padding:2px 6px;
      border:1px solid rgba(29,185,84,.4); border-radius:3px;
    }
    .mw-wk-deco-glitch{
      font-size:13px; line-height:1; color:var(--mw-g); opacity:.75;
      text-shadow:0 0 6px rgba(29,185,84,.45);
    }
    .mw-wk-deco-bl{ bottom:-14px; left:-14px }
    .mw-wk-deco-br{ bottom:-14px; right:-14px; text-align:right }
    .mw-wk-deco-bl::before,.mw-wk-deco-br::before{
      content:""; display:block; font-family:var(--mw-mono); white-space:pre;
      animation:mw-wk-gc-a 2.4s steps(1) infinite;
    }
    .mw-wk-deco-br::before{ animation-name:mw-wk-gc-b; animation-duration:2.8s }
    @keyframes mw-wk-gc-a{
      0%  { content:"\u2593\u2591\u2573\u2592\u2591" }
      20% { content:"\u2591\u2593\u2592\u2573\u2593" }
      40% { content:"\u2573\u2592\u2593\u2591\u2573" }
      55% { content:"\u2592\u2591\u2573\u2593\u2592" }
      70% { content:"\u2593\u2573\u2591\u2592\u2591" }
      85% { content:"\u2591\u2591\u2593\u2573\u2592" }
      100%{ content:"\u2573\u2593\u2592\u2591\u2593" }
    }
    @keyframes mw-wk-gc-b{
      0%  { content:"\u2573\u2591\u2593\u2592\u2573" }
      18% { content:"\u2592\u2593\u2591\u2573\u2593" }
      36% { content:"\u2591\u2573\u2592\u2593\u2591" }
      52% { content:"\u2593\u2591\u2573\u2592\u2593" }
      68% { content:"\u2573\u2592\u2591\u2593\u2573" }
      84% { content:"\u2592\u2593\u2573\u2591\u2592" }
      100%{ content:"\u2593\u2591\u2592\u2573\u2591" }
    }
    .mw-wk-deco-bl::after,.mw-wk-deco-br::after{
      content:""; display:block; margin-top:2px;
      font-family:var(--mw-mono); white-space:pre; font-size:10px; opacity:.55;
      animation:mw-wk-gc2a 3.6s steps(1) infinite;
    }
    .mw-wk-deco-br::after{ animation-name:mw-wk-gc2b; text-align:right; animation-duration:4.2s }
    @keyframes mw-wk-gc2a{
      0%  { content:"> 0x1DB9" }
      25% { content:"> 0xF4C5" }
      50% { content:"> 0x0E1A" }
      75% { content:"> 0xAE37" }
      100%{ content:"> 0x1DB9" }
    }
    @keyframes mw-wk-gc2b{
      0%  { content:"ERR_01 ]" }
      20% { content:"SYS_LO ]" }
      45% { content:"OK_0xFF]" }
      70% { content:"LOG 1/7]" }
      100%{ content:"ERR_01 ]" }
    }

    /* Header */
    .mw-wk-tag{
      font-size:10px; letter-spacing:2.5px; text-transform:uppercase;
      color:var(--mw-g); font-weight:700; margin-bottom:6px;
      display:flex; align-items:center; gap:8px;
    }
    .mw-wk-tag-dot{
      width:6px; height:6px; border-radius:50%;
      background:var(--mw-g); box-shadow:0 0 8px var(--mw-g);
      animation:mw-wk-pulse 1.6s ease-in-out infinite;
    }
    @keyframes mw-wk-pulse{ 0%,100%{opacity:1} 50%{opacity:.25} }
    .mw-wk-tag-bar{
      flex:1; height:1px;
      background:linear-gradient(90deg,var(--mw-g),transparent); opacity:.4;
    }

    .mw-wk-title{
      font-size:24px; font-weight:700; color:#fff;
      margin-bottom:4px; letter-spacing:-.5px;
      text-shadow:
        -1.2px 0 0 rgba(255,77,126,.55),
        1.2px 0 0 rgba(29,185,84,.55);
    }

    .mw-wk-subtitle{
      font-size:10px; letter-spacing:1.2px; color:var(--mw-sub);
      margin-bottom:22px; text-transform:uppercase;
    }

    /* Pager tabs */
    .mw-wk-pager{
      display:flex; gap:2px; margin-bottom:14px;
      border:1px solid rgba(255,255,255,.06); border-radius:6px;
      padding:2px; background:rgba(0,0,0,.3);
    }
    .mw-wk-pager-tab{
      flex:1; padding:5px 10px; background:transparent; border:none; cursor:pointer;
      font-family:var(--mw-mono); font-size:9px; letter-spacing:1.5px; text-transform:uppercase;
      color:var(--mw-sub); border-radius:4px;
      transition:all 180ms var(--mw-ease); text-align:left;
    }
    .mw-wk-pager-tab .mw-wk-ix{ opacity:.5; margin-right:6px; font-weight:700 }
    .mw-wk-pager-tab:hover{ color:var(--mw-text); background:rgba(255,255,255,.03) }
    .mw-wk-pager-tab.on{
      background:rgba(29,185,84,.12); color:var(--mw-g);
      box-shadow:inset 0 0 0 1px rgba(29,185,84,.3);
    }
    .mw-wk-pager-tab.on .mw-wk-ix{ opacity:1 }

    /* Page container with crossfade */
    .mw-wk-page{ animation:mw-wk-page-in 280ms var(--mw-ease) both }
    @keyframes mw-wk-page-in{
      from{ opacity:0; transform:translateY(6px) }
      to  { opacity:1; transform:translateY(0) }
    }

    /* ---- Stat cards (page 1) ---- */
    .mw-wk-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px }
    .mw-wk-stat{
      padding:12px 14px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06);
      border-radius:8px; position:relative; overflow:hidden; min-height:92px;
    }
    .mw-wk-stat::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-stat-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px }
    .mw-wk-stat-label{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase }
    .mw-wk-stat-delta{ font-size:9px; color:var(--mw-g); letter-spacing:.5px; font-variant-numeric:tabular-nums }
    .mw-wk-stat-delta.neg{ color:#ff6b6b }
    .mw-wk-stat-unit{ font-size:12px; color:var(--mw-sub); font-weight:400; margin-left:3px }
    .mw-wk-big-num{ font-size:28px; font-weight:700; color:#fff; letter-spacing:-1px; line-height:1 }
    .mw-wk-big-num .mw-wk-stat-unit{ font-size:14px }

    /* Sparkline */
    .mw-wk-spark{ display:block; margin-top:8px; width:100%; height:28px; overflow:visible }
    .mw-wk-spark-area{ fill:url(#mwWkGrad); opacity:.5 }
    .mw-wk-spark-line{ fill:none; stroke:var(--mw-g); stroke-width:1.4;
      filter:drop-shadow(0 0 3px rgba(29,185,84,.8)) }
    .mw-wk-spark-dot{ fill:var(--mw-g); filter:drop-shadow(0 0 4px var(--mw-g)) }

    /* Mini bars */
    .mw-wk-mbars{ display:flex; align-items:flex-end; gap:3px; height:32px; margin-top:8px }
    .mw-wk-mbar{
      flex:1; min-height:2px; border-radius:1.5px; transform-origin:bottom;
      background:linear-gradient(to top,var(--mw-g),var(--mw-g2));
      box-shadow:0 0 4px rgba(29,185,84,.5);
      animation:mw-wk-bar-in .7s cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes mw-wk-bar-in{ from{transform:scaleY(0);opacity:0} to{transform:scaleY(1);opacity:1} }
    .mw-wk-mbar-label{
      display:flex; justify-content:space-between; margin-top:3px;
      font-size:7px; color:var(--mw-sub); letter-spacing:.5px; font-family:var(--mw-mono);
    }

    /* Circular ring (skip rate) */
    .mw-wk-ring-wrap{ display:flex; align-items:center; gap:12px; margin-top:2px }
    .mw-wk-ring{ width:56px; height:56px; flex-shrink:0 }
    .mw-wk-ring-track{ fill:none; stroke:rgba(255,255,255,.06); stroke-width:3 }
    .mw-wk-ring-fill{
      fill:none; stroke:var(--mw-g); stroke-width:3; stroke-linecap:round;
      opacity:.85; transform:rotate(-90deg); transform-origin:center;
    }
    .mw-wk-ring-text{
      font-family:var(--mw-mono); font-size:14px; font-weight:700; fill:#fff;
      text-anchor:middle; dominant-baseline:central;
    }
    .mw-wk-ring-meta{ flex:1; min-width:0 }
    .mw-wk-ring-big{ font-size:18px; font-weight:700; color:#fff; line-height:1 }
    .mw-wk-ring-small{ font-size:9px; color:var(--mw-sub); margin-top:4px;
      letter-spacing:.8px; text-transform:uppercase }

    /* ---- Top artists (page 1 bottom) ---- */
    .mw-wk-section{ margin-top:16px }
    .mw-wk-section-label{
      font-size:10px; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
      margin-bottom:10px; font-weight:600;
      display:flex; align-items:center; gap:8px;
    }
    .mw-wk-section-label::before{ content:"\u25C8"; color:var(--mw-g); opacity:.8 }
    .mw-wk-section-label .mw-wk-thin{
      flex:1; height:1px;
      background:linear-gradient(90deg,rgba(255,255,255,.1),transparent);
    }
    .mw-wk-artist{
      display:flex; align-items:center; gap:12px; padding:7px 0; font-size:13px;
      border-bottom:1px solid rgba(255,255,255,.04);
    }
    .mw-wk-artist:last-child{ border-bottom:none }
    .mw-wk-artist-rank{ color:var(--mw-g); font-weight:700; width:22px;
      font-size:11px; font-variant-numeric:tabular-nums }
    .mw-wk-artist-name{ flex:1; color:var(--mw-text);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
    .mw-wk-artist-bar{ flex:0 0 60px; height:3px;
      background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden }
    .mw-wk-artist-bar-fill{ height:100%; background:var(--mw-g);
      box-shadow:0 0 6px rgba(29,185,84,.7) }
    .mw-wk-artist-time{ color:var(--mw-sub); font-size:11px;
      font-variant-numeric:tabular-nums; width:50px; text-align:right }

    /* ---- Comparison cards (page 2) ---- */
    .mw-wk-cmp{
      display:flex; align-items:center; gap:14px;
      padding:12px 14px; background:rgba(255,255,255,.025);
      border:1px solid rgba(255,255,255,.06); border-radius:8px;
      margin-bottom:8px; position:relative; overflow:hidden;
    }
    .mw-wk-cmp::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-cmp-icon{
      width:30px; height:30px; flex-shrink:0;
      display:grid; place-items:center;
      color:var(--mw-g); background:rgba(29,185,84,.08); border-radius:6px;
      font-family:var(--mw-mono); font-size:11px; font-weight:700; letter-spacing:.5px;
    }
    .mw-wk-cmp-body{ flex:1; min-width:0 }
    .mw-wk-cmp-label{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub);
      text-transform:uppercase; margin-bottom:4px }
    .mw-wk-cmp-row{ display:flex; align-items:baseline; gap:8px }
    .mw-wk-cmp-now{ font-size:22px; font-weight:700; color:#fff;
      font-variant-numeric:tabular-nums; letter-spacing:-.5px; line-height:1 }
    .mw-wk-cmp-now .mw-wk-stat-unit{ font-size:12px }
    .mw-wk-cmp-prev{ font-size:10px; color:var(--mw-sub); letter-spacing:.5px }
    .mw-wk-cmp-prev .mw-wk-v{ font-variant-numeric:tabular-nums }
    .mw-wk-cmp-delta{
      margin-left:auto; display:inline-flex; align-items:center; gap:4px;
      padding:3px 8px; border-radius:10px;
      font-size:10px; font-weight:700;
      font-variant-numeric:tabular-nums; letter-spacing:.5px;
    }
    .mw-wk-cmp-delta.up, .mw-wk-cmp-delta.good-down{
      background:rgba(29,185,84,.15); color:var(--mw-g2);
    }
    .mw-wk-cmp-delta.down{
      background:rgba(255,107,107,.15); color:#ff8a8a;
    }
    .mw-wk-cmp-delta.flat{
      background:rgba(255,255,255,.06); color:var(--mw-sub);
    }

    /* Dual-line chart (page 2) */
    .mw-wk-dual{
      margin-top:14px; padding:12px 14px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06);
      border-radius:8px; position:relative;
    }
    .mw-wk-dual::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-dual-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px }
    .mw-wk-dual-title{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase }
    .mw-wk-dual-legend{ display:flex; gap:10px; font-size:9px; color:var(--mw-sub) }
    .mw-wk-dual-legend .k{ display:inline-block; width:10px; height:2px; margin-right:4px;
      vertical-align:middle; border-radius:1px }
    .mw-wk-dual-legend .k-now{ background:var(--mw-g); box-shadow:0 0 4px var(--mw-g) }
    .mw-wk-dual-legend .k-prev{ background:rgba(255,255,255,.3) }
    .mw-wk-dual-svg{ width:100%; height:70px; display:block }
    .mw-wk-dual-now-line{ fill:none; stroke:var(--mw-g); stroke-width:1.8;
      filter:drop-shadow(0 0 3px rgba(29,185,84,.7)) }
    .mw-wk-dual-now-area{ fill:url(#mwWkGrad); opacity:.35 }
    .mw-wk-dual-prev-line{ fill:none; stroke:rgba(255,255,255,.35); stroke-width:1.2;
      stroke-dasharray:3 3 }
    .mw-wk-dual-grid{ stroke:rgba(255,255,255,.05); stroke-width:1 }
    .mw-wk-dual-dot{ fill:var(--mw-g); filter:drop-shadow(0 0 4px var(--mw-g)) }
    .mw-wk-dual-axis{ font-family:var(--mw-mono); font-size:7px; fill:var(--mw-sub); letter-spacing:.5px }

    /* Movers (page 2 bottom) */
    .mw-wk-movers{ margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px }
    .mw-wk-movers-col{ padding:10px 12px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06); border-radius:6px }
    .mw-wk-movers-head{
      font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase;
      margin-bottom:6px; display:flex; align-items:center; gap:6px;
    }
    .mw-wk-movers-head .sym{ color:var(--mw-g); font-size:10px }
    .mw-wk-movers-head.down .sym{ color:#ff8a8a }
    .mw-wk-movers-item{
      font-size:11px; color:var(--mw-text); padding:3px 0;
      border-bottom:1px solid rgba(255,255,255,.04);
      display:flex; align-items:center; gap:6px;
    }
    .mw-wk-movers-item:last-child{ border-bottom:none }
    .mw-wk-movers-item .mark{ font-size:8px; color:var(--mw-g); letter-spacing:.5px; font-weight:700; min-width:26px }
    .mw-wk-movers-item.down .mark{ color:#ff8a8a }
    .mw-wk-movers-name{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0 }
    .mw-wk-movers-empty{ font-size:10px; color:var(--mw-sub); font-style:italic; padding:4px 0 }

    /* Actions footer */
    .mw-wk-actions{ margin-top:22px; display:flex; gap:8px; justify-content:flex-end; align-items:center }
    .mw-wk-actions-fill{ flex:1; font-size:9px; color:var(--mw-sub); letter-spacing:1px; opacity:.55 }
    .mw-wk-btn{
      padding:8px 16px; background:transparent; color:var(--mw-text);
      border:1px solid #333; border-radius:20px; cursor:pointer;
      font-family:inherit; font-size:11px; letter-spacing:1px; text-transform:uppercase;
      transition:all 180ms var(--mw-ease);
    }
    .mw-wk-btn:hover{ border-color:#666; background:rgba(255,255,255,.04) }
    .mw-wk-btn-primary{
      background:var(--mw-g); color:#000; border-color:var(--mw-g); font-weight:700;
    }
    .mw-wk-btn-primary:hover{
      background:var(--mw-g2); border-color:var(--mw-g2);
      box-shadow:0 0 18px rgba(29,185,84,.45);
    }
`;

  // src/styles/index.ts
  var cssReducedMotion = `
    @media (prefers-reduced-motion:reduce) {
      .mw-panel,.mw-np,.mw-hist-row,.mw-moods,.mw-istats,.mw-stat-card,.mw-start-section,.mw-wbar,.mw-top-row,.mw-eq,.mw-np-art-glow,.mw-trigger-icon,.mw-home-glow,.mw-home-dot,.mw-tab-body,.mw-ob-backdrop,.mw-ob-modal,.mw-ob-content { animation:none !important; transition:none !important; }
      .mw-wk-backdrop,.mw-wk-page,.mw-wk-title::before,.mw-wk-title::after,.mw-wk-tag-dot,.mw-wk-mbar,.mw-wk-deco-bl::before,.mw-wk-deco-br::before,.mw-wk-deco-bl::after,.mw-wk-deco-br::after { animation:none !important; }
    }
`;
  function injectStyles() {
    if (document.getElementById("mywave-styles")) return;
    const s = document.createElement("style");
    s.id = "mywave-styles";
    s.textContent = cssBase + cssHome + cssPanel + cssOnboarding + cssWeekly + cssReducedMotion;
    document.head.appendChild(s);
  }

  // src/app.tsx
  var React;
  var ReactDOM;
  var engine5 = new WaveEngine();
  var h9 = (...args) => Spicetify.React.createElement(...args);
  function cleanupPreviousInstance() {
    if (engine5.getState().isActive) {
      engine5.stop();
    }
    const oldBb = document.getElementById("mywave-bb");
    if (oldBb) {
      ReactDOM.unmountComponentAtNode(oldBb);
      oldBb.remove();
    }
    const oldHome = document.getElementById("mywave-home");
    if (oldHome) {
      ReactDOM.unmountComponentAtNode(oldHome);
      oldHome.remove();
    }
    const oldStyles = document.getElementById("mywave-styles");
    if (oldStyles) oldStyles.remove();
    const oldDbg = document.getElementById("mywave-debug");
    if (oldDbg) {
      ReactDOM.unmountComponentAtNode(oldDbg);
      oldDbg.remove();
    }
    const oldWk = document.getElementById("mywave-weekly");
    if (oldWk) {
      ReactDOM.unmountComponentAtNode(oldWk);
      oldWk.remove();
    }
    if (window.__mywaveObserver) {
      window.__mywaveObserver.disconnect();
      window.__mywaveObserver = null;
    }
    if (window.__mywaveCtxMenu) {
      try {
        window.__mywaveCtxMenu.deregister();
      } catch {
      }
      window.__mywaveCtxMenu = null;
    }
    console.log("[MyWave] Cleaned up previous instance");
  }
  async function main() {
    while (!Spicetify?.React || !Spicetify?.ReactDOM) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    React = Spicetify.React;
    ReactDOM = Spicetify.ReactDOM;
    console.log("[MyWave] Initializing...");
    setHooksEngine(engine5);
    setEngine(engine5);
    setHomeBannerEngine(engine5);
    setBottomBarEngine(engine5);
    setDebugEngine(engine5);
    cleanupPreviousInstance();
    injectStyles();
    registerContextMenu();
    engine5.loadTopLikedArtist();
    injectHomeBanner();
    mountDebugOverlay();
    const bbContainer = document.createElement("div");
    bbContainer.id = "mywave-bb";
    const repeatBtn = document.querySelector("[data-testid='control-button-repeat']") || document.querySelector("button[aria-label='Repeat']") || document.querySelector("button[aria-label*='repeat' i]");
    let bbMounted = false;
    if (repeatBtn?.parentElement) {
      repeatBtn.parentElement.insertBefore(bbContainer, repeatBtn.nextSibling);
      bbMounted = true;
    }
    if (!bbMounted) {
      const ctrl = document.querySelector(".player-controls__buttons") || document.querySelector("[data-testid='player-controls']") || document.querySelector(".player-controls");
      if (ctrl) {
        ctrl.appendChild(bbContainer);
        bbMounted = true;
      }
    }
    if (!bbMounted) {
      bbContainer.style.cssText = "position:fixed;bottom:80px;right:16px;z-index:9999";
      document.body.appendChild(bbContainer);
    }
    ReactDOM.render(h9(BottomBarWidget), bbContainer);
    const sharePayload = parseShareFromLocation();
    if (sharePayload) {
      clearShareFromLocation();
      setTimeout(() => {
        applyShare(engine5, sharePayload).then((ok) => {
          if (ok) Spicetify.showNotification("Applied shared mix");
        });
      }, 1500);
    }
    maybeShowWeeklyReport(ReactDOM);
  }
  function mountDebugOverlay() {
    if (!isDebugEnabled()) return;
    const container = document.createElement("div");
    container.id = "mywave-debug";
    document.body.appendChild(container);
    ReactDOM.render(h9(DebugOverlay), container);
    console.log("[MyWave] Debug overlay mounted");
  }
  function registerContextMenu() {
    try {
      const CtxMenu = Spicetify.ContextMenu;
      if (!CtxMenu) {
        console.log("[MyWave] ContextMenu API not available");
        return;
      }
      const menuItem = new CtxMenu.Item(
        "Start Mix from this",
        (uris) => {
          const uri = uris[0];
          if (uri?.includes("playlist")) {
            engine5.startFromPlaylist(uri);
          }
        },
        (uris) => {
          return uris.length === 1 && uris[0]?.includes("playlist");
        }
      );
      menuItem.register();
      window.__mywaveCtxMenu = menuItem;
      console.log("[MyWave] Context menu registered");
    } catch (e) {
      console.log("[MyWave] Failed to register context menu:", e);
    }
  }
  function injectHomeBanner() {
    let mounted = false;
    function tryInject() {
      if (mounted && document.getElementById("mywave-home")) return;
      const old = document.getElementById("mywave-home");
      if (old) {
        old.remove();
        mounted = false;
      }
      const homeContent = document.querySelector('[data-testid="home-page"]') || document.querySelector(".main-home-content");
      if (!homeContent) return;
      const container = document.createElement("div");
      container.id = "mywave-home";
      const children = homeContent.children;
      if (children.length > 0) {
        try {
          homeContent.insertBefore(container, children[0]);
        } catch {
          try {
            homeContent.prepend(container);
          } catch {
            homeContent.appendChild(container);
          }
        }
      } else {
        homeContent.appendChild(container);
      }
      ReactDOM.render(h9(HomeBanner), container);
      mounted = true;
      console.log("[MyWave] Home banner injected");
    }
    setTimeout(tryInject, 2e3);
    setTimeout(tryInject, 5e3);
    let debounceTimer = null;
    const obs = new MutationObserver(() => {
      if (document.hidden) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tryInject, 500);
    });
    const mainView = document.querySelector(".Root__main-view") || document.body;
    obs.observe(mainView, { childList: true, subtree: true });
    window.__mywaveObserver = obs;
  }
  (async () => {
    await main();
  })();
})();
