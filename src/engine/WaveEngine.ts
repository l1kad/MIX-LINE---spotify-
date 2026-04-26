import { HistoryEntry } from "./types";
import { MOODS } from "./constants";
import { prefs } from "./prefs";
import { filterAndRankByFeatures } from "./audioFeatures";
import {
  getAccessToken,
  getUserPlaylists as _getUserPlaylists,
  searchArtists as _searchArtists,
  searchPlaylists as _searchPlaylists,
  searchInternal as _searchInternal,
  resolveArtistId as _resolveArtistId,
} from "./spotifyApi";

export class WaveEngine {
  private playedUris: Set<string> = new Set();
  private blacklist: Set<string> = new Set();
  private isActive: boolean = false;
  private isLoading: boolean = false;
  private seedTrackName: string = "";
  private currentTrackName: string = "";
  private currentArtistName: string = "";
  private currentImageUrl: string = "";
  private currentUri: string = "";
  private lockedArtist: string | null = null;
  private preLockState: { activeMood: string | null; isFavoritesMode: boolean; seedTrackName: string } | null = null;
  private songChangeListener: ((event: Event) => void) | null = null;
  private librarySeeds: string[] = [];
  private stateListeners: Set<() => void> = new Set();
  private history: HistoryEntry[] = [];
  private activeMood: string | null = null;
  private isFavoritesMode: boolean = false;
  private historyReplayUri: string | null = null;
  private sessionStart: number = 0;
  private uniqueArtists: Set<string> = new Set();
  private artistCounts: Map<string, number> = new Map();
  private activeContextUri: string | null = null;
  private _isAdopting: boolean = false;
  private _pendingAdoptSeed: string | null = null;
  private _recsBackoffUntil: number = 0;
  private topLikedArtist: string | null = null;
  private topLikedArtistUri: string | null = null;
  private pinnedMoods: string[] = ["__favorites__"];
  private pinnedArtists: string[] = [];
  private pinnedPlaylists: { name: string; uri: string }[] = [];
  private static STORAGE_KEY = "mywave:pins";
  private static PLAYED_URIS_CAP = 500;

  // Skip-learning: track timing of the currently-playing track so we can
  // issue a verdict (listened / skipped) when the user advances.
  private _trackStartMs: number = 0;
  private _lastTrackUri: string = "";
  private _lastTrackArtist: string = "";
  private _lastTrackDurationMs: number = 0;
  private _refillSeedPool: string[] = [];   // rotating pool of good recent seeds
  private _refillSeedIdx: number = 0;
  private _tracksSinceReseed: number = 0;
  private _nextReseedAt: number = 0;       // auto-reseed after this many tracks
  private _consecutiveSkips: number = 0;   // skip streak counter

  private _addPlayedUri(uri: string) {
    // LRU cap: evict oldest when exceeding PLAYED_URIS_CAP to prevent unbounded growth
    // during long sessions. Set preserves insertion order, so re-adding moves to end.
    if (this.playedUris.has(uri)) {
      this.playedUris.delete(uri);
    } else if (this.playedUris.size >= WaveEngine.PLAYED_URIS_CAP) {
      const oldest = this.playedUris.values().next().value;
      if (oldest) this.playedUris.delete(oldest);
    }
    this.playedUris.add(uri);
  }

  constructor() {
    this.loadPins();
  }

  private loadPins() {
    try {
      const raw = localStorage.getItem(WaveEngine.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.moods)) this.pinnedMoods = data.moods;
        if (Array.isArray(data.artists)) this.pinnedArtists = data.artists;
        if (Array.isArray(data.playlists)) this.pinnedPlaylists = data.playlists;
      }
    } catch {}
  }

  private savePins() {
    try {
      localStorage.setItem(WaveEngine.STORAGE_KEY, JSON.stringify({
        moods: this.pinnedMoods,
        artists: this.pinnedArtists,
        playlists: this.pinnedPlaylists,
      }));
    } catch {}
  }

  getState() {
    const topArtists = [...this.artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

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
      sessionMinutes: this.sessionStart ? Math.floor((Date.now() - this.sessionStart) / 60000) : 0,
      uniqueArtistsCount: this.uniqueArtists.size,
      topArtists,
      topLikedArtist: this.topLikedArtist,
      pinnedMoods: [...this.pinnedMoods],
      pinnedArtists: [...this.pinnedArtists],
      pinnedPlaylists: [...this.pinnedPlaylists],
      discoveryOnly: prefs.getDiscoveryOnly(),
    };
  }

  subscribe(cb: () => void) {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  notify() {
    this.stateListeners.forEach((cb) => cb());
  }

  async start(moodId?: string) {
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
        this.seedTrackName = MOODS.find(m => m.id === moodId)?.label || moodId;
        await this.startMoodStation(moodId);
      } else {
        const currentTrack = Spicetify.Player.data!.item!;
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

  async startFromPlaylist(playlistUri: string, playlistName?: string) {
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

      const content = await (Spicetify as any).Platform.PlaylistAPI.getContents(playlistUri);
      const tracks = (content?.items || [])
        .filter((t: any) => t.uri?.startsWith("spotify:track:"))
        .map((t: any) => t.uri);

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
        this.seedTrackName = MOODS.find(m => m.id === this.activeMood)?.label || this.activeMood;
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

  togglePinMood(moodId: string) {
    const idx = this.pinnedMoods.indexOf(moodId);
    if (idx >= 0) {
      this.pinnedMoods.splice(idx, 1);
      Spicetify.showNotification("Unpinned");
    } else {
      this.pinnedMoods.push(moodId);
      Spicetify.showNotification(`Pinned: ${MOODS.find(m => m.id === moodId)?.label || moodId}`);
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

  togglePinArtist(name: string) {
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

  togglePinPlaylist(name: string, uri: string) {
    const idx = this.pinnedPlaylists.findIndex(p => p.uri === uri);
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

  async searchPlaylists(query: string) { return _searchPlaylists(query); }

  private getAccessToken() { return getAccessToken(); }

  async getUserPlaylists() { return _getUserPlaylists(); }

  async searchArtists(query: string) { return _searchArtists(query); }

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
      // Restore pre-lock state
      const prev = this.preLockState;
      this.lockedArtist = null;
      this.preLockState = null;
      if (prev) {
        this.activeMood = prev.activeMood;
        this.isFavoritesMode = prev.isFavoritesMode;
        this.seedTrackName = prev.seedTrackName;
        this.notify();
        // Reseed from restored state
        this.reseed().catch(() => {});
      } else {
        this.notify();
      }
      Spicetify.showNotification("Artist unlocked");
    } else {
      // Save current state before locking
      this.preLockState = {
        activeMood: this.activeMood,
        isFavoritesMode: this.isFavoritesMode,
        seedTrackName: this.seedTrackName,
      };
      this.lockedArtist = this.currentArtistName;
      this.activeMood = null;
      this.isFavoritesMode = false;
      this.seedTrackName = this.currentArtistName;
      this.notify();
      Spicetify.showNotification(`Mixing from ${this.currentArtistName}`);
      this.startArtistStation().catch(() => {});
    }
  }

  async likeCurrentTrack() {
    if (!this.currentUri) return;
    try {
      await (Spicetify as any).Platform.LibraryAPI.add({ uris: [this.currentUri] });
      if (this.currentArtistName) prefs.bumpArtist(this.currentArtistName, +4);
      Spicetify.showNotification("Added to Liked Songs");
    } catch {}
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
        const candidates = rec.tracks
          .map((t: any) => ({ uri: t.uri as string, artist: t.artists?.[0]?.name as string | undefined }))
          .filter((c: { uri: string; artist?: string }) =>
            c.uri && !this.playedUris.has(c.uri) && !this.blacklist.has(c.uri)
            && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists));
        const ranked = prefs.rankBatch(candidates);
        const filtered = await filterAndRankByFeatures(this.currentUri, ranked);
        const picks = (filtered.length > 0 ? filtered : ranked).slice(0, 15);
        if (picks.length > 0) {
          await Spicetify.addToQueue(picks.map((c: { uri: string }) => ({ uri: c.uri })));
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

  playFromHistory(uri: string) {
    this.historyReplayUri = uri;
    try {
      (Spicetify as any).Platform.PlayerAPI.play({ uri }, {}, {});
    } catch {}
  }

  // Multi-seed: try recommendations API with 429 backoff, fallback to station
  private async startMultiSeed(currentUri: string) {
    const seeds = this.pickMultipleSeeds(currentUri, 5);
    const seedIds = seeds.map(s => s.split(":").pop()).filter(Boolean);

    if (Date.now() > this._recsBackoffUntil) {
      try {
        const token = await this.getAccessToken();
        const url = `https://spclient.wg.spotify.com/inspiredby-mix/v2/seed_to_playlist/${seedIds.map(id => `spotify:track:${id}`).join(",")}?responseFormat=json`;
        let uris: string[] = [];

        // Try spclient inspired-by endpoint
        if (token) {
          try {
            const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (resp.ok) {
              const data = await resp.json();
              uris = (data?.tracks || []).map((t: any) => t.uri).filter(Boolean);
            }
          } catch {}
        }

        // Fallback to public recommendations API
        if (uris.length === 0) {
          const rec = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=50`
          );
          uris = (rec?.tracks || []).map((t: any) => t.uri).filter(Boolean);
        }

        if (uris.length > 0) {
          const filtered = uris.filter((u: string) => !this.playedUris.has(u) && !this.blacklist.has(u));
          const toPlay = filtered.length > 0 ? filtered : uris;
          await Spicetify.addToQueue(toPlay.slice(0, 20).map((u: string) => ({ uri: u })));
          await (Spicetify as any).Platform.PlayerAPI.play({ uri: toPlay[0] }, {}, {});
          console.log("[MyWave] Started via recommendations,", toPlay.length, "tracks");
          return;
        }
      } catch (e: any) {
        const status = e?.status || e?.response?.status || e?.statusCode;
        if (status === 429) {
          const retryAfter = parseInt(e?.headers?.["retry-after"] || "300", 10);
          console.log(`[MyWave] Recommendations 429, backing off ${retryAfter}s`);
          this._recsBackoffUntil = Date.now() + retryAfter * 1000;
        } else {
          console.log("[MyWave] Recommendations failed (status:", status, "):", e);
        }
      }
    }

    const seedId = seedIds[0];
    await this.playStation(`spotify:station:track:${seedId}`);
  }

  private pickMultipleSeeds(currentUri: string, count: number): string[] {
    const result = [currentUri];
    const pool = [...this.librarySeeds].filter(u => u !== currentUri);
    for (let i = 0; i < count - 1 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  private async startArtistStation() {
    if (!this.lockedArtist) return;
    const item = Spicetify.Player.data?.item;
    const artistUri = (item as any)?.metadata?.artist_uri || (item as any)?.artists?.[0]?.uri;
    if (artistUri) {
      const artistId = artistUri.split(":").pop();
      try {
        await this.playStation(`spotify:station:artist:${artistId}`);
        return;
      } catch {}
    }
    const artistId = await this.resolveArtistId(this.lockedArtist);
    if (artistId) {
      await this.playStation(`spotify:station:artist:${artistId}`);
    }
  }

  private searchInternal(query: string, type: string, limit: number) { return _searchInternal(query, type, limit); }

  private async startMoodStation(moodId: string) {
    const data = await this.searchInternal(moodId, "playlist", 5);
    const hits = data?.results?.playlists?.hits || data?.playlists?.items || [];
    if (hits.length > 0) {
      const best = hits.find((p: any) => {
        const owner = p.owner?.name || p.owner?.display_name || p.owner?.id || "";
        return owner.toLowerCase() === "spotify";
      }) || hits[0];
      const uri = best.uri || (best.id ? `spotify:playlist:${best.id}` : null);
      if (uri) {
        // Play playlist directly in shuffle — fast, no extra API calls
        const wasShuffle = !!Spicetify.Player.getShuffle?.();
        Spicetify.Player.setShuffle?.(true);
        await (Spicetify as any).Platform.PlayerAPI.play(
          { uri }, {}, { skipTo: { trackIndex: Math.floor(Math.random() * 30) } }
        );
        // Restore shuffle state after playback starts
        if (!wasShuffle) setTimeout(() => Spicetify.Player.setShuffle?.(false), 2000);
        return;
      }
    }
    throw new Error("Could not start mood station");
  }

  private async playStation(stationUri: string) {
    try {
      await (Spicetify as any).Platform.PlayerAPI.play(
        { uri: stationUri }, {}, { skipTo: { trackIndex: 0 } }
      );
      return;
    } catch (e) {
      console.log("[MyWave] PlayerAPI failed:", e);
    }
    try {
      await (Spicetify.Player as any).playUri(stationUri);
      return;
    } catch (e) {
      console.log("[MyWave] playUri failed:", e);
    }
    throw new Error("Could not start station");
  }

  private async loadLibrarySeeds() {
    try {
      const liked = await (Spicetify as any).Platform.LibraryAPI.getTracks({
        limit: 200, offset: 0, sort: { field: "ADDED_AT", order: "DESC" },
      });
      if (liked?.items?.length) {
        this.librarySeeds = liked.items.map((t: any) => t.uri).filter(Boolean);
        return;
      }
    } catch {}
    try {
      const rootlist = await (Spicetify as any).Platform.RootlistAPI.getContents();
      const playlists = rootlist?.items?.filter((i: any) => i.type === "playlist") || [];
      const seeds: string[] = [];
      for (const pl of playlists.slice(0, 5)) {
        try {
          const content = await (Spicetify as any).Platform.PlaylistAPI.getContents(pl.uri);
          if (content?.items) {
            for (const item of content.items.slice(0, 50)) {
              if (item.uri?.startsWith("spotify:track:")) seeds.push(item.uri);
            }
          }
        } catch {}
      }
      this.librarySeeds = seeds;
    } catch {}
  }

  async loadTopLikedArtist() {
    try {
      const liked = await (Spicetify as any).Platform.LibraryAPI.getTracks({
        limit: 200, offset: 0, sort: { field: "ADDED_AT", order: "DESC" },
      });
      if (!liked?.items?.length) return;
      const counts = new Map<string, { count: number; uri: string }>();
      for (const t of liked.items) {
        const name = t.artists?.[0]?.name || (t as any).metadata?.artist_name;
        const uri = t.artists?.[0]?.uri || (t as any).metadata?.artist_uri;
        if (name) {
          const prev = counts.get(name);
          counts.set(name, { count: (prev?.count || 0) + 1, uri: uri || prev?.uri || "" });
        }
      }
      let top = "";
      let topUri = "";
      let max = 0;
      for (const [name, data] of counts) {
        if (data.count > max) { top = name; topUri = data.uri; max = data.count; }
      }
      if (top) {
        this.topLikedArtist = top;
        this.topLikedArtistUri = topUri || null;
        if (this.pinnedArtists.length === 0) { this.pinnedArtists.push(top); this.savePins(); }
        console.log("[MyWave] Top liked artist:", top, topUri);
        this.notify();
      }
    } catch (e) {
      console.log("[MyWave] Failed to load top artist:", e);
    }
  }

  private resolveArtistId(artistName: string) {
    return _resolveArtistId(artistName, this.topLikedArtist, this.topLikedArtistUri);
  }

  async startFromArtistName(artistName: string) {
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
  getDiscoveryOnly(): boolean { return prefs.getDiscoveryOnly(); }
  setDiscoveryOnly(v: boolean) {
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
  async saveMixAsPlaylist(limit: number = 30): Promise<boolean> {
    if (this.history.length === 0) {
      Spicetify.showNotification("Nothing to save yet", true);
      return false;
    }
    const uris = this.history.slice(0, limit).map((h) => h.uri).reverse();
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const baseName = this.seedTrackName || "Mix";
    const name = `mixline — ${baseName} · ${stamp}`;

    // Try internal PlaylistAPI first (no extra network auth needed)
    try {
      const api = (Spicetify as any).Platform?.RootlistAPI;
      const plApi = (Spicetify as any).Platform?.PlaylistAPI;
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

    // Fallback: Web API
    try {
      const token = await this.getAccessToken();
      if (!token) throw new Error("no token");
      const me = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      const uid = me?.id;
      if (!uid) throw new Error("no user id");
      const pl = await fetch(`https://api.spotify.com/v1/users/${uid}/playlists`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: `Generated by mixline from "${baseName}"`, public: false }),
      }).then((r) => r.json());
      if (!pl?.id) throw new Error("create failed");
      await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris }),
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
      prefs: prefs.snapshot(),
    };
  }

  resetLearning() {
    prefs.reset();
    this.notify();
    Spicetify.showNotification("Learning reset");
  }

  private attachListener() {
    this.detachListener();
    this.songChangeListener = () => this.onSongChange();
    Spicetify.Player.addEventListener("songchange", this.songChangeListener as any);
  }

  private detachListener() {
    if (this.songChangeListener) {
      Spicetify.Player.removeEventListener("songchange", this.songChangeListener as any);
      this.songChangeListener = null;
    }
  }

  private _captureContextImmediate() {
    this.activeContextUri = (Spicetify.Player.data as any)?.context?.uri || null;
    console.log("[MyWave] Captured context (immediate):", this.activeContextUri);
  }

  private _captureContext() {
    // Try immediately, then recheck after Spotify updates context
    this._captureContextImmediate();
    setTimeout(() => {
      const updated = (Spicetify.Player.data as any)?.context?.uri || null;
      if (updated && updated !== this.activeContextUri) {
        this.activeContextUri = updated;
        console.log("[MyWave] Captured context (delayed update):", this.activeContextUri);
      }
    }, 800);
  }

  // Adopt: let current track finish, then start station from it on next songchange
  adoptTrack(uri: string) {
    if (!this.isActive || this._isAdopting) return;
    this.seedTrackName = Spicetify.Player.data?.item?.metadata?.title || "Manual pick";
    this._pendingAdoptSeed = uri;
    this.activeContextUri = (Spicetify.Player.data as any)?.context?.uri || null;
    Spicetify.showNotification("Mix continues from this track");
  }

  private _isRefilling: boolean = false;

  private _pickReseedInterval(): number {
    return 5 + Math.floor(Math.random() * 4); // 5..8
  }

  private async _autoReseed() {
    if (!this.isActive || this._isRefilling) return;

    // Build seed list: current track + recent listened + recent history
    const seedUris: string[] = [];
    if (this.currentUri) seedUris.push(this.currentUri);
    for (const u of this._refillSeedPool) {
      if (!seedUris.includes(u)) seedUris.push(u);
      if (seedUris.length >= 5) break;
    }
    // Fill from history if still short
    for (const h of this.history) {
      if (!seedUris.includes(h.uri)) seedUris.push(h.uri);
      if (seedUris.length >= 5) break;
    }

    const seedIds = seedUris.map(u => u.split(":").pop()).filter(Boolean);
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
        const candidates = rec.tracks
          .map((t: any) => ({ uri: t.uri as string, artist: t.artists?.[0]?.name as string | undefined }))
          .filter((c: { uri: string; artist?: string }) =>
            c.uri
            && !this.playedUris.has(c.uri)
            && !this.blacklist.has(c.uri)
            && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists),
          );
        let ranked = prefs.rankBatch(candidates);
        const featureFiltered = await filterAndRankByFeatures(this.currentUri, ranked);
        const final = featureFiltered.length > 0 ? featureFiltered : ranked;
        const picks = final.slice(0, 15);
        if (picks.length > 0) {
          await Spicetify.addToQueue(picks.map((c: { uri: string }) => ({ uri: c.uri })));
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

  private async checkAndRefillQueue() {
    if (this._isRefilling || !this.isActive) return;
    try {
      const queue = await Spicetify.CosmosAsync.get("sp://player/v2/main");
      const nextTracks = queue?.next_tracks || [];
      const remaining = nextTracks.filter((t: any) => !t.removed).length;
      console.log("[MyWave] Queue remaining:", remaining);

      if (remaining <= 3) {
        this._isRefilling = true;
        try {
          // Multi-seed rotation: prefer seeds from tracks the user actually
          // listened to in this session; fall back to the current track.
          const currentUri = Spicetify.Player.data?.item?.uri;
          let seedUri: string | undefined;
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
                const candidates = rec.tracks
                  .map((t: any) => ({ uri: t.uri as string, artist: t.artists?.[0]?.name as string | undefined }))
                  .filter((c: { uri: string; artist?: string }) =>
                    c.uri
                    && !this.playedUris.has(c.uri)
                    && !this.blacklist.has(c.uri)
                    && !prefs.shouldReject(c.uri, c.artist, this.uniqueArtists),
                  );
                // Prefs-based ranking first (freshness + artist scores)
                let ranked = prefs.rankBatch(candidates);
                // Then audio-features proximity filter (BPM/energy/valence vs anchor)
                const anchor = Spicetify.Player.data?.item?.uri || seedUri;
                const featureFiltered = await filterAndRankByFeatures(anchor, ranked);
                // Fallback: if features filter wiped everything out (e.g. API down
                // or unusually restrictive anchor), use unfiltered ranked list.
                const final = featureFiltered.length > 0 ? featureFiltered : ranked;
                const picks = final.slice(0, 10);
                if (picks.length > 0) {
                  await Spicetify.addToQueue(picks.map((c: { uri: string }) => ({ uri: c.uri })));
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

  private onSongChange() {
    if (!this.isActive) return;
    const item = Spicetify.Player.data?.item;
    if (!item) return;

    // Skip blacklisted tracks
    if (this.blacklist.has(item.uri)) {
      console.log("[MyWave] Skipping blacklisted track");
      setTimeout(() => Spicetify.Player.next(), 200);
      return;
    }

    // === Skip-learning: issue verdict on the track we are leaving ===
    if (this._lastTrackUri && this._lastTrackUri !== item.uri && this._trackStartMs > 0) {
      const playedMs = Date.now() - this._trackStartMs;
      const verdict = prefs.registerVerdict(
        this._lastTrackUri,
        this._lastTrackArtist,
        playedMs,
        this._lastTrackDurationMs,
      );
      if (verdict !== "neutral") {
        console.log(`[MyWave] ${verdict} "${this._lastTrackArtist}" (${Math.round(playedMs / 1000)}s / ${Math.round(this._lastTrackDurationMs / 1000)}s)`);
        // A listened track becomes a candidate seed for rotation refills.
        if (verdict === "listened") {
          this._refillSeedPool.unshift(this._lastTrackUri);
          if (this._refillSeedPool.length > 8) this._refillSeedPool.pop();
          this._consecutiveSkips = 0;
        }
        // Skip streak: 3 skips → emergency reseed from last good track
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

    // Update current track state
    this.currentTrackName = item.metadata?.title || "Unknown";
    this.currentArtistName = item.metadata?.artist_name || "";
    this.currentImageUrl = item.metadata?.image_url || "";
    this.currentUri = item.uri;
    this._addPlayedUri(item.uri);
    prefs.recordPlayed(item.uri);

    // Prime timing for the incoming track
    const durMs = Number((item as any).duration?.milliseconds)
      || Number((item as any).duration_ms)
      || Number((item as any).duration)
      || 0;
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
      timestamp: Date.now(),
    });
    if (this.history.length > 50) this.history.pop();

    this.notify();

    // Auto-reseed: seamlessly shift recommendation vector every 5-8 tracks
    this._tracksSinceReseed++;
    console.log(`[MyWave] Track ${this._tracksSinceReseed}/${this._nextReseedAt} until reseed`);
    if (this._nextReseedAt > 0 && this._tracksSinceReseed >= this._nextReseedAt) {
      this._autoReseed();
    } else {
      // Normal refill when queue runs low
      this.checkAndRefillQueue();
    }
  }
}
