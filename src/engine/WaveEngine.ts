import { HistoryEntry } from "./types";
import { MOODS } from "./constants";

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
  private pinnedMood: string | null = null;

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
      pinnedMood: this.pinnedMood,
    };
  }

  subscribe(cb: () => void) {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  private notify() {
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

  async startFromPlaylist(playlistUri: string) {
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
      this.seedTrackName = "Playlist";
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

    // Pinned mood/favorites override current mode for reseed
    const effectiveMood = this.pinnedMood || this.activeMood;
    const effectiveFavorites = this.pinnedMood === "__favorites__" || (!this.pinnedMood && this.isFavoritesMode);

    try {
      if (this.lockedArtist && !this.pinnedMood) {
        await this.startArtistStation();
      } else if (effectiveFavorites) {
        await this.loadLibrarySeeds();
        if (this.librarySeeds.length > 0) {
          const randomSeed = this.librarySeeds[Math.floor(Math.random() * this.librarySeeds.length)];
          this.seedTrackName = "My Favorites";
          this.isFavoritesMode = true;
          this.activeMood = null;
          await this.startMultiSeed(randomSeed);
        }
      } else if (effectiveMood && effectiveMood !== "__favorites__") {
        this.activeMood = effectiveMood;
        this.isFavoritesMode = false;
        this.seedTrackName = MOODS.find(m => m.id === effectiveMood)?.label || effectiveMood;
        await this.startMoodStation(effectiveMood);
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
    if (this.pinnedMood === moodId) {
      this.pinnedMood = null;
      this.notify();
      Spicetify.showNotification("Mood unpinned");
    } else {
      this.pinnedMood = moodId;
      this.notify();
      Spicetify.showNotification(`Pinned: ${MOODS.find(m => m.id === moodId)?.label || moodId}`);
    }
  }

  togglePinFavorites() {
    if (this.pinnedMood === "__favorites__") {
      this.pinnedMood = null;
      this.notify();
      Spicetify.showNotification("Favorites unpinned");
    } else {
      this.pinnedMood = "__favorites__";
      this.notify();
      Spicetify.showNotification("Pinned: Favorites");
    }
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
      this.lockedArtist = null;
      this.notify();
      Spicetify.showNotification("Artist unlocked");
    } else {
      this.lockedArtist = this.currentArtistName;
      this.notify();
      Spicetify.showNotification(`Locked to ${this.currentArtistName}`);
      this.startArtistStation().catch(() => {});
    }
  }

  async likeCurrentTrack() {
    if (!this.currentUri) return;
    try {
      await (Spicetify as any).Platform.LibraryAPI.add({ uris: [this.currentUri] });
      Spicetify.showNotification("Added to Liked Songs");
    } catch {}
  }

  async dislikeCurrentTrack() {
    if (!this.currentUri) return;
    this.blacklist.add(this.currentUri);
    Spicetify.Player.next();
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
        const url = `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=50`;
        const rec = await Spicetify.CosmosAsync.get(url);
        if (rec?.tracks?.length > 0) {
          const uris = rec.tracks.map((t: any) => t.uri).filter(Boolean);
          await Spicetify.addToQueue(uris.slice(0, 20).map((u: string) => ({ uri: u })));
          await (Spicetify as any).Platform.PlayerAPI.play({ uri: uris[0] }, {}, {});
          console.log("[MyWave] Started via recommendations,", uris.length, "tracks");
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
    try {
      const res = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(this.lockedArtist)}&type=artist&limit=1`
      );
      const id = res?.artists?.items?.[0]?.id;
      if (id) {
        await this.playStation(`spotify:station:artist:${id}`);
        return;
      }
    } catch {}
  }

  private async startMoodStation(moodId: string) {
    // 1) Try genre station directly
    try {
      await this.playStation(`spotify:station:genre:${moodId}`);
      return;
    } catch {}

    // 2) Try Spotify search for a playlist matching the mood
    try {
      const results = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(moodId + " mood")}&type=playlist&limit=5`
      );
      const items = results?.playlists?.items;
      if (items?.length) {
        // Prefer playlists by Spotify
        const best = items.find((p: any) => p.owner?.id === "spotify") || items[0];
        const pid = best.uri?.split(":").pop() || best.id;
        if (pid) {
          await this.playStation(`spotify:station:playlist:${pid}`);
          return;
        }
      }
    } catch {}

    // 3) Fallback: try playing the playlist directly (not as station)
    try {
      const results = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(moodId)}&type=playlist&limit=5`
      );
      const items = results?.playlists?.items;
      if (items?.length) {
        const best = items.find((p: any) => p.owner?.id === "spotify") || items[0];
        if (best.uri) {
          await (Spicetify as any).Platform.PlayerAPI.play(
            { uri: best.uri }, {}, { skipTo: { trackIndex: 0 } }
          );
          return;
        }
      }
    } catch {}

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
        console.log("[MyWave] Top liked artist:", top, topUri);
        this.notify();
      }
    } catch (e) {
      console.log("[MyWave] Failed to load top artist:", e);
    }
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

      let artistId: string | null = null;

      // 1) Use saved URI if this is the top liked artist
      if (this.topLikedArtistUri && artistName === this.topLikedArtist) {
        artistId = this.topLikedArtistUri.split(":").pop() || null;
      }

      // 2) Fallback: try liked songs to find a track by this artist, use station from that track
      if (!artistId) {
        const trackByArtist = this.librarySeeds.length > 0
          ? this.librarySeeds[0]
          : Spicetify.Player.data?.item?.uri;
        if (trackByArtist) {
          const trackId = trackByArtist.split(":").pop();
          if (trackId) {
            await this.playStation(`spotify:station:track:${trackId}`);
            this.isActive = true;
            this.isLoading = false;
            this.attachListener();
            this._captureContext();
            this.notify();
            Spicetify.showNotification(`Mix: ${artistName}!`);
            return;
          }
        }
      }

      if (artistId) {
        await this.playStation(`spotify:station:artist:${artistId}`);
      } else {
        throw new Error("No artist data available");
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
    this.detachListener();
    this.notify();
    Spicetify.showNotification(`Mix stopped (${this.playedUris.size} tracks)`);
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

  private async checkAndRefillQueue() {
    if (this._isRefilling || !this.isActive) return;
    try {
      const queue = await Spicetify.CosmosAsync.get("sp://player/v2/main");
      const nextTracks = queue?.next_tracks || [];
      const remaining = nextTracks.filter((t: any) => !t.removed).length;
      console.log("[MyWave] Queue remaining:", remaining);

      if (remaining <= 3) {
        this._isRefilling = true;
        const currentUri = Spicetify.Player.data?.item?.uri;
        if (currentUri) {
          const seedId = currentUri.split(":").pop();
          if (seedId) {
            try {
              const url = `https://api.spotify.com/v1/recommendations?seed_tracks=${seedId}&limit=20`;
              const rec = await Spicetify.CosmosAsync.get(url);
              if (rec?.tracks?.length > 0) {
                const uris = rec.tracks
                  .map((t: any) => t.uri)
                  .filter((u: string) => u && !this.playedUris.has(u) && !this.blacklist.has(u));
                if (uris.length > 0) {
                  await Spicetify.addToQueue(uris.slice(0, 10).map((u: string) => ({ uri: u })));
                  console.log("[MyWave] Refilled queue with", Math.min(uris.length, 10), "tracks");
                  this._isRefilling = false;
                  return;
                }
              }
            } catch (e) {
              console.log("[MyWave] Refill via recommendations failed:", e);
            }
          }
        }
        this._isRefilling = false;
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

    // Update current track state
    this.currentTrackName = item.metadata?.title || "Unknown";
    this.currentArtistName = item.metadata?.artist_name || "";
    this.currentImageUrl = item.metadata?.image_url || "";
    this.currentUri = item.uri;
    this.playedUris.add(item.uri);
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

    // Auto-refill queue when running low
    this.checkAndRefillQueue();
  }
}
