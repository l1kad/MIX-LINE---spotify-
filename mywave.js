"use strict";
// MyWave — Infinite music stream for Spotify
const MOODS = [
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
    { id: "electronic", label: "Electronic" },
];
// Equalizer bar count / height for panel vs mini
const EQ_COLS = 13;
const EQ_ROWS = 7;
const EQ_COLS_MINI = 9;
const EQ_ROWS_MINI = 5;
// ============================================================
// Wave Engine
// ============================================================
class WaveEngine {
    constructor() {
        this.playedUris = new Set();
        this.blacklist = new Set();
        this.isActive = false;
        this.isLoading = false;
        this.seedTrackName = "";
        this.currentTrackName = "";
        this.currentArtistName = "";
        this.currentImageUrl = "";
        this.currentUri = "";
        this.lockedArtist = null;
        this.songChangeListener = null;
        this.librarySeeds = [];
        this.stateListeners = new Set();
        this.history = [];
        this.activeMood = null;
        this.isFavoritesMode = false;
        this.historyReplayUri = null;
        this.sessionStart = 0;
        this.uniqueArtists = new Set();
        this.artistCounts = new Map();
        this.activeContextUri = null;
        this._isAdopting = false;
        this._pendingAdoptSeed = null;
        this._recsBackoffUntil = 0;
        this.topLikedArtist = null;
        this.topLikedArtistUri = null;
        this.pinnedMood = null;
        this._isRefilling = false;
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
            pinnedMood: this.pinnedMood,
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
        if (this.isActive || this.isLoading)
            return;
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
            }
            else {
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
        }
        catch (err) {
            console.error("[MyWave] Failed to start:", err);
            this.isLoading = false;
            this.notify();
            Spicetify.showNotification("Failed to start mix", true);
        }
    }
    async startFromPlaylist(playlistUri) {
        if (this.isActive || this.isLoading)
            return;
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
            const content = await Spicetify.Platform.PlaylistAPI.getContents(playlistUri);
            const tracks = (content?.items || [])
                .filter((t) => t.uri?.startsWith("spotify:track:"))
                .map((t) => t.uri);
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
        }
        catch (err) {
            console.error("[MyWave] Playlist start failed:", err);
            this.isLoading = false;
            this.notify();
            Spicetify.showNotification("Failed to start from playlist", true);
        }
    }
    async reseed() {
        if (!this.isActive)
            return;
        this.isLoading = true;
        this.notify();
        // Pinned mood/favorites override current mode for reseed
        const effectiveMood = this.pinnedMood || this.activeMood;
        const effectiveFavorites = this.pinnedMood === "__favorites__" || (!this.pinnedMood && this.isFavoritesMode);
        try {
            if (this.lockedArtist && !this.pinnedMood) {
                await this.startArtistStation();
            }
            else if (effectiveFavorites) {
                await this.loadLibrarySeeds();
                if (this.librarySeeds.length > 0) {
                    const randomSeed = this.librarySeeds[Math.floor(Math.random() * this.librarySeeds.length)];
                    this.seedTrackName = "My Favorites";
                    this.isFavoritesMode = true;
                    this.activeMood = null;
                    await this.startMultiSeed(randomSeed);
                }
            }
            else if (effectiveMood && effectiveMood !== "__favorites__") {
                this.activeMood = effectiveMood;
                this.isFavoritesMode = false;
                this.seedTrackName = MOODS.find(m => m.id === effectiveMood)?.label || effectiveMood;
                await this.startMoodStation(effectiveMood);
            }
            else {
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
        }
        catch (e) {
            this.isLoading = false;
            this.notify();
            console.error("[MyWave] Reseed failed:", e);
        }
    }
    async reseedFromTrack() {
        if (!this.isActive)
            return;
        const cur = Spicetify.Player.data?.item;
        if (!cur?.uri)
            return;
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
        }
        catch (e) {
            this.isLoading = false;
            this.notify();
            console.error("[MyWave] Reseed from track failed:", e);
        }
    }
    togglePinMood(moodId) {
        if (this.pinnedMood === moodId) {
            this.pinnedMood = null;
            this.notify();
            Spicetify.showNotification("Mood unpinned");
        }
        else {
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
        }
        else {
            this.pinnedMood = "__favorites__";
            this.notify();
            Spicetify.showNotification("Pinned: Favorites");
        }
    }
    async startFavorites() {
        if (this.isActive || this.isLoading)
            return;
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
        }
        catch (err) {
            console.error("[MyWave] Favorites start failed:", err);
            this.isLoading = false;
            this.isFavoritesMode = false;
            this.notify();
            Spicetify.showNotification("Failed to start favorites mix", true);
        }
    }
    toggleLockArtist() {
        if (!this.isActive)
            return;
        if (this.lockedArtist) {
            this.lockedArtist = null;
            this.notify();
            Spicetify.showNotification("Artist unlocked");
        }
        else {
            this.lockedArtist = this.currentArtistName;
            this.notify();
            Spicetify.showNotification(`Locked to ${this.currentArtistName}`);
            this.startArtistStation().catch(() => { });
        }
    }
    async likeCurrentTrack() {
        if (!this.currentUri)
            return;
        try {
            await Spicetify.Platform.LibraryAPI.add({ uris: [this.currentUri] });
            Spicetify.showNotification("Added to Liked Songs");
        }
        catch { }
    }
    async dislikeCurrentTrack() {
        if (!this.currentUri)
            return;
        this.blacklist.add(this.currentUri);
        Spicetify.Player.next();
    }
    playFromHistory(uri) {
        this.historyReplayUri = uri;
        try {
            Spicetify.Platform.PlayerAPI.play({ uri }, {}, {});
        }
        catch { }
    }
    // Multi-seed: try recommendations API with 429 backoff, fallback to station
    async startMultiSeed(currentUri) {
        const seeds = this.pickMultipleSeeds(currentUri, 5);
        const seedIds = seeds.map(s => s.split(":").pop()).filter(Boolean);
        if (Date.now() > this._recsBackoffUntil) {
            try {
                const url = `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=50`;
                const rec = await Spicetify.CosmosAsync.get(url);
                if (rec?.tracks?.length > 0) {
                    const uris = rec.tracks.map((t) => t.uri).filter(Boolean);
                    await Spicetify.addToQueue(uris.slice(0, 20).map((u) => ({ uri: u })));
                    await Spicetify.Platform.PlayerAPI.play({ uri: uris[0] }, {}, {});
                    console.log("[MyWave] Started via recommendations,", uris.length, "tracks");
                    return;
                }
            }
            catch (e) {
                const status = e?.status || e?.response?.status || e?.statusCode;
                if (status === 429) {
                    const retryAfter = parseInt(e?.headers?.["retry-after"] || "300", 10);
                    console.log(`[MyWave] Recommendations 429, backing off ${retryAfter}s`);
                    this._recsBackoffUntil = Date.now() + retryAfter * 1000;
                }
                else {
                    console.log("[MyWave] Recommendations failed (status:", status, "):", e);
                }
            }
        }
        const seedId = seedIds[0];
        await this.playStation(`spotify:station:track:${seedId}`);
    }
    pickMultipleSeeds(currentUri, count) {
        const result = [currentUri];
        const pool = [...this.librarySeeds].filter(u => u !== currentUri);
        for (let i = 0; i < count - 1 && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            result.push(pool.splice(idx, 1)[0]);
        }
        return result;
    }
    async startArtistStation() {
        if (!this.lockedArtist)
            return;
        const item = Spicetify.Player.data?.item;
        const artistUri = item?.metadata?.artist_uri || item?.artists?.[0]?.uri;
        if (artistUri) {
            const artistId = artistUri.split(":").pop();
            try {
                await this.playStation(`spotify:station:artist:${artistId}`);
                return;
            }
            catch { }
        }
        try {
            const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(this.lockedArtist)}&type=artist&limit=1`);
            const id = res?.artists?.items?.[0]?.id;
            if (id) {
                await this.playStation(`spotify:station:artist:${id}`);
                return;
            }
        }
        catch { }
    }
    async startMoodStation(moodId) {
        // 1) Try genre station directly
        try {
            await this.playStation(`spotify:station:genre:${moodId}`);
            return;
        }
        catch { }
        // 2) Try Spotify search for a playlist matching the mood
        try {
            const results = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(moodId + " mood")}&type=playlist&limit=5`);
            const items = results?.playlists?.items;
            if (items?.length) {
                // Prefer playlists by Spotify
                const best = items.find((p) => p.owner?.id === "spotify") || items[0];
                const pid = best.uri?.split(":").pop() || best.id;
                if (pid) {
                    await this.playStation(`spotify:station:playlist:${pid}`);
                    return;
                }
            }
        }
        catch { }
        // 3) Fallback: try playing the playlist directly (not as station)
        try {
            const results = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(moodId)}&type=playlist&limit=5`);
            const items = results?.playlists?.items;
            if (items?.length) {
                const best = items.find((p) => p.owner?.id === "spotify") || items[0];
                if (best.uri) {
                    await Spicetify.Platform.PlayerAPI.play({ uri: best.uri }, {}, { skipTo: { trackIndex: 0 } });
                    return;
                }
            }
        }
        catch { }
        throw new Error("Could not start mood station");
    }
    async playStation(stationUri) {
        try {
            await Spicetify.Platform.PlayerAPI.play({ uri: stationUri }, {}, { skipTo: { trackIndex: 0 } });
            return;
        }
        catch (e) {
            console.log("[MyWave] PlayerAPI failed:", e);
        }
        try {
            await Spicetify.Player.playUri(stationUri);
            return;
        }
        catch (e) {
            console.log("[MyWave] playUri failed:", e);
        }
        throw new Error("Could not start station");
    }
    async loadLibrarySeeds() {
        try {
            const liked = await Spicetify.Platform.LibraryAPI.getTracks({
                limit: 200, offset: 0, sort: { field: "ADDED_AT", order: "DESC" },
            });
            if (liked?.items?.length) {
                this.librarySeeds = liked.items.map((t) => t.uri).filter(Boolean);
                return;
            }
        }
        catch { }
        try {
            const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
            const playlists = rootlist?.items?.filter((i) => i.type === "playlist") || [];
            const seeds = [];
            for (const pl of playlists.slice(0, 5)) {
                try {
                    const content = await Spicetify.Platform.PlaylistAPI.getContents(pl.uri);
                    if (content?.items) {
                        for (const item of content.items.slice(0, 50)) {
                            if (item.uri?.startsWith("spotify:track:"))
                                seeds.push(item.uri);
                        }
                    }
                }
                catch { }
            }
            this.librarySeeds = seeds;
        }
        catch { }
    }
    async loadTopLikedArtist() {
        try {
            const liked = await Spicetify.Platform.LibraryAPI.getTracks({
                limit: 200, offset: 0, sort: { field: "ADDED_AT", order: "DESC" },
            });
            if (!liked?.items?.length)
                return;
            const counts = new Map();
            for (const t of liked.items) {
                const name = t.artists?.[0]?.name || t.metadata?.artist_name;
                const uri = t.artists?.[0]?.uri || t.metadata?.artist_uri;
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
                console.log("[MyWave] Top liked artist:", top, topUri);
                this.notify();
            }
        }
        catch (e) {
            console.log("[MyWave] Failed to load top artist:", e);
        }
    }
    async startFromArtistName(artistName) {
        if (this.isActive || this.isLoading)
            return;
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
            let artistId = null;
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
            }
            else {
                throw new Error("No artist data available");
            }
            this.isActive = true;
            this.isLoading = false;
            this.attachListener();
            this._captureContext();
            this.notify();
            Spicetify.showNotification(`Mix: ${artistName}!`);
        }
        catch (err) {
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
        // Try immediately, then recheck after Spotify updates context
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
        if (!this.isActive || this._isAdopting)
            return;
        this.seedTrackName = Spicetify.Player.data?.item?.metadata?.title || "Manual pick";
        this._pendingAdoptSeed = uri;
        this.activeContextUri = Spicetify.Player.data?.context?.uri || null;
        Spicetify.showNotification("Mix continues from this track");
    }
    async checkAndRefillQueue() {
        if (this._isRefilling || !this.isActive)
            return;
        try {
            const queue = await Spicetify.CosmosAsync.get("sp://player/v2/main");
            const nextTracks = queue?.next_tracks || [];
            const remaining = nextTracks.filter((t) => !t.removed).length;
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
                                    .map((t) => t.uri)
                                    .filter((u) => u && !this.playedUris.has(u) && !this.blacklist.has(u));
                                if (uris.length > 0) {
                                    await Spicetify.addToQueue(uris.slice(0, 10).map((u) => ({ uri: u })));
                                    console.log("[MyWave] Refilled queue with", Math.min(uris.length, 10), "tracks");
                                    this._isRefilling = false;
                                    return;
                                }
                            }
                        }
                        catch (e) {
                            console.log("[MyWave] Refill via recommendations failed:", e);
                        }
                    }
                }
                this._isRefilling = false;
            }
        }
        catch (e) {
            console.log("[MyWave] Queue check failed:", e);
            this._isRefilling = false;
        }
    }
    onSongChange() {
        if (!this.isActive)
            return;
        const item = Spicetify.Player.data?.item;
        if (!item)
            return;
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
            this.artistCounts.set(this.currentArtistName, (this.artistCounts.get(this.currentArtistName) || 0) + 1);
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
        if (this.history.length > 50)
            this.history.pop();
        this.notify();
        // Auto-refill queue when running low
        this.checkAndRefillQueue();
    }
}
// ============================================================
// UI
// ============================================================
let React;
let ReactDOM;
const engine = new WaveEngine();
let newMixCounter = 0;
const newMixListeners = new Set();
function triggerNewMix() { newMixCounter++; newMixListeners.forEach(cb => cb()); }
function useNewMixSignal() {
    const [count, setCount] = React.useState(newMixCounter);
    React.useEffect(() => {
        const cb = () => setCount(newMixCounter);
        newMixListeners.add(cb);
        return () => { newMixListeners.delete(cb); };
    }, []);
    return count;
}
function useEngineState() {
    const [state, setState] = React.useState(engine.getState());
    React.useEffect(() => {
        const unsub = engine.subscribe(() => setState({ ...engine.getState() }));
        return () => { unsub(); };
    }, []);
    return state;
}
function useTimeTick(active) {
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
        if (!active)
            return;
        const id = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(id);
    }, [active]);
}
const h = (...args) => React.createElement(...args);
// --- Icons ---
function WaveIcon({ size }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", className: "mw-wave-icon" }, h("rect", { className: "mw-wbar mw-wbar-1", x: 1, y: 6, width: 2, height: 4, rx: 1 }), h("rect", { className: "mw-wbar mw-wbar-2", x: 5, y: 3, width: 2, height: 10, rx: 1 }), h("rect", { className: "mw-wbar mw-wbar-3", x: 9, y: 5, width: 2, height: 6, rx: 1 }), h("rect", { className: "mw-wbar mw-wbar-4", x: 13, y: 4, width: 2, height: 8, rx: 1 }));
}
function PlayIcon({ size = 20 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" }, h("path", { d: "M8 5v14l11-7z" }));
}
function StopIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" }, h("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2 }));
}
function RefreshIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M21 2v6h-6" }), h("path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8" }), h("path", { d: "M3 22v-6h6" }), h("path", { d: "M21 12a9 9 0 0 1-15 6.7L3 16" }));
}
function HeartIcon({ size = 16, filled = false }) {
    return filled
        ? h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" }, h("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" }))
        : h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 }, h("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" }));
}
function ThumbDownIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" }));
}
function LockIcon({ size = 14, locked = false }) {
    return locked
        ? h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" }, h("rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }), h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4", fill: "none", stroke: "currentColor", strokeWidth: 2 }))
        : h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }), h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }));
}
function HistoryIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("circle", { cx: 12, cy: 12, r: 10 }), h("polyline", { points: "12 6 12 12 16 14" }));
}
function StatsIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("rect", { x: 3, y: 12, width: 4, height: 9, rx: 1 }), h("rect", { x: 10, y: 7, width: 4, height: 14, rx: 1 }), h("rect", { x: 17, y: 3, width: 4, height: 18, rx: 1 }));
}
function MoodIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("circle", { cx: 12, cy: 12, r: 10 }), h("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }), h("line", { x1: 9, y1: 9, x2: 9.01, y2: 9 }), h("line", { x1: 15, y1: 9, x2: 15.01, y2: 9 }));
}
function MixIcon({ size = 16 }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }, h("polyline", { points: "16 3 21 3 21 8" }), h("line", { x1: 4, y1: 20, x2: 21, y2: 3 }), h("polyline", { points: "21 16 21 21 16 21" }), h("line", { x1: 15, y1: 15, x2: 21, y2: 21 }), h("line", { x1: 4, y1: 4, x2: 9, y2: 9 }));
}
// ========== EQUALIZER VISUALIZER ==========
function AsciiWave({ active, mini }) {
    const cols = mini ? EQ_COLS_MINI : EQ_COLS;
    const rows = mini ? EQ_ROWS_MINI : EQ_ROWS;
    // Idle bar heights (bell curve — center taller)
    const idle = React.useMemo(() => Array.from({ length: cols }, (_, i) => {
        const c = (cols - 1) / 2;
        return (1 - Math.abs(i - c) / c * 0.6) * rows * 0.25;
    }), [cols, rows]);
    const [bars, setBars] = React.useState(idle);
    React.useEffect(() => {
        if (!active) {
            setBars(idle);
            return;
        }
        const cur = idle.map(v => v);
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
    }, [active, idle, cols, rows]);
    return h("div", { className: `mw-eq${active ? " mw-eq-on" : ""}${mini ? " mw-eq-mini" : ""}` }, Array.from({ length: rows }, (_, r) => {
        const rowBot = rows - 1 - r;
        return h("div", { key: r, className: "mw-eq-row" }, Array.from({ length: cols }, (_, c) => {
            const bh = bars[c];
            let ch;
            if (bh > rowBot + 0.75)
                ch = "\u2588";
            else if (bh > rowBot + 0.5)
                ch = "\u2593";
            else if (bh > rowBot + 0.25)
                ch = "\u2592";
            else if (bh > rowBot)
                ch = "\u2591";
            else
                ch = " ";
            return h("span", { key: c, className: ch !== " " ? "mw-eq-ch" : "mw-eq-sp" }, ch);
        }));
    }));
}
// ========== CONSOLE TYPING LABEL ==========
function MixLabel({ isNewMix }) {
    const [text, setText] = React.useState("");
    const [phase, setPhase] = React.useState("typing");
    const targetRef = React.useRef("/MIX...");
    const triggerRef = React.useRef(0);
    React.useEffect(() => {
        if (isNewMix) {
            targetRef.current = "/NEW MIX...";
            setText("");
            setPhase("typing");
            triggerRef.current++;
        }
    }, [isNewMix]);
    React.useEffect(() => {
        let timer;
        const target = targetRef.current;
        if (phase === "typing") {
            if (text.length < target.length) {
                timer = setTimeout(() => setText(target.slice(0, text.length + 1)), 60 + Math.random() * 40);
            }
            else {
                timer = setTimeout(() => setPhase("hold"), 1800);
            }
        }
        else if (phase === "hold") {
            timer = setTimeout(() => setPhase("erasing"), 200);
        }
        else if (phase === "erasing") {
            if (text.length > 0) {
                timer = setTimeout(() => setText(text.slice(0, -1)), 30);
            }
            else {
                targetRef.current = "/MIX...";
                timer = setTimeout(() => setPhase("typing"), 400);
            }
        }
        return () => clearTimeout(timer);
    }, [text, phase]);
    return h("span", { className: "mw-ascii-label" }, h("span", null, text), h("span", { className: "mw-cursor" }, "\u2588"));
}
function PanelMixLabel() {
    const sig = useNewMixSignal();
    const [isNew, setIsNew] = React.useState(false);
    const prevRef = React.useRef(sig);
    React.useEffect(() => {
        if (sig !== prevRef.current) {
            setIsNew(true);
            prevRef.current = sig;
        }
        else {
            setIsNew(false);
        }
    }, [sig]);
    return h(MixLabel, { isNewMix: isNew });
}
// ========== SEA WAVES BACKGROUND ==========
const SEA_ROWS = [
    { chars: "\u00B7   ~   \u00B7  ~    \u00B7   ~   \u00B7  ~    ", speed: 28, op: 0.12 },
    { chars: " ~ \u2591\u2591 ~  \u2591  ~ \u2591\u2591 ~  \u2591  ", speed: 20, op: 0.2 },
    { chars: "\u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   \u2591\u2592\u2593\u2592\u2591  \u2591\u2592\u2593\u2592\u2591   ", speed: 15, op: 0.3 },
    { chars: "\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591", speed: 11, op: 0.4 },
    { chars: "\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592\u2593\u2588\u2588\u2588\u2588\u2593\u2592", speed: 8, op: 0.5 },
];
function SeaWaves() {
    return h("div", { className: "mw-sea" }, SEA_ROWS.map((row, i) => h("div", {
        key: i,
        className: "mw-sea-row",
        style: { opacity: row.op, animationDuration: `${row.speed}s` },
    }, row.chars.repeat(6))));
}
// ========== HOME PAGE BANNER ==========
function HomeBanner() {
    const state = useEngineState();
    const handleMood = (moodId) => {
        if (state.activeMood === moodId) {
            engine.stop();
            return;
        }
        if (state.isActive)
            engine.stop();
        setTimeout(() => engine.start(moodId), 100);
    };
    return h("div", { className: "mw-home" }, h(SeaWaves), h("div", { className: "mw-home-glow" }), h("div", { className: "mw-home-inner" }, 
    // Brand + label
    h("div", { className: "mw-home-top-row" }, h("div", { className: "mw-home-brand" }, h(WaveIcon, { size: 16 }), h("span", null, "MIX LINE")), h("div", { className: "mw-home-tag" }, h(PanelMixLabel))), 
    // Now playing or description
    state.isActive
        ? h("div", { className: "mw-home-np" }, state.currentImageUrl && h("img", { className: "mw-home-np-art", src: state.currentImageUrl, alt: "" }), h("div", { className: "mw-home-np-text" }, h("div", { className: "mw-home-np-name" }, state.currentTrackName), h("div", { className: "mw-home-np-artist" }, state.currentArtistName)))
        : h("div", { className: "mw-home-desc" }, "Endless mix from your taste"), 
    // Buttons
    h("div", { className: "mw-home-btns" }, state.isActive
        ? h(React.Fragment, null, h("button", { className: "mw-home-btn mw-home-btn-stop", onClick: () => engine.stop() }, h(StopIcon, { size: 12 }), "Stop"), h("button", { className: "mw-home-btn mw-home-btn-mix", onClick: () => { triggerNewMix(); engine.reseed(); } }, h(MixIcon, { size: 12 }), "New mix"), h("div", { className: "mw-home-live" }, h("span", { className: "mw-home-dot" }), `${state.playedCount} tracks`))
        : h(React.Fragment, null, h("button", { className: "mw-home-btn mw-home-btn-play", onClick: () => engine.start() }, h(PlayIcon, { size: 14 }), "Start"), h("button", { className: "mw-home-btn mw-home-btn-fav", onClick: () => engine.startFavorites() }, h(HeartIcon, { size: 12, filled: true }), "Favorites"))), 
    // Mood chips
    h("div", { className: "mw-home-moods" }, state.topLikedArtist && h("button", {
        key: "artist",
        className: "mw-home-mood mw-home-mood-artist",
        onClick: () => {
            if (state.isActive)
                engine.stop();
            setTimeout(() => engine.startFromArtistName(state.topLikedArtist), 100);
        },
    }, `\u2605 ${state.topLikedArtist}`), MOODS.slice(0, 4).map(mood => h("button", {
        key: mood.id,
        className: `mw-home-mood${state.activeMood === mood.id ? " mw-home-mood-on" : ""}`,
        onClick: () => handleMood(mood.id),
    }, mood.label)))));
}
// ========== BOTTOM BAR WIDGET ==========
function BottomBarWidget() {
    const state = useEngineState();
    const [panelOpen, setPanelOpen] = React.useState(false);
    const [tab, setTab] = React.useState("main");
    const panelRef = React.useRef(null);
    React.useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setPanelOpen(false);
            }
        };
        if (panelOpen)
            document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [panelOpen]);
    React.useEffect(() => {
        if (panelOpen)
            setTab("main");
    }, [panelOpen]);
    return h("div", { className: "mw-bottombar", ref: panelRef }, panelOpen && h("div", { className: "mw-panel" }, h("div", { className: "mw-panel-inner" }, 
    // Header with ASCII glow
    h("div", { className: "mw-header" }, h("div", { className: "mw-header-left" }, h("div", { className: "mw-logo" }, h(WaveIcon, { size: 14 })), h("span", { className: "mw-header-title" }, "MIX LINE")), h("div", { className: "mw-header-tabs" }, h("button", {
        className: `mw-htab${tab === "main" ? " mw-htab-on" : ""}`,
        onClick: () => setTab("main"),
    }, h(MoodIcon, { size: 15 })), h("button", {
        className: `mw-htab${tab === "history" ? " mw-htab-on" : ""}`,
        onClick: () => setTab("history"),
    }, h(HistoryIcon, { size: 15 })), h("button", {
        className: `mw-htab${tab === "stats" ? " mw-htab-on" : ""}`,
        onClick: () => setTab("stats"),
    }, h(StatsIcon, { size: 15 })))), 
    // ASCII Equalizer Banner + Now Playing (main tab only when active)
    tab === "main" && state.isActive && h("div", { className: "mw-ascii-banner" }, h(AsciiWave, { active: true }), h("div", { className: "mw-ascii-overlay" }, h(PanelMixLabel))), tab === "main" && state.isActive && h(NowPlayingCard, { state }), 
    // Tab content
    tab === "main" && h(MainTab, { state }), tab === "history" && h(HistoryTab, { history: state.history }), tab === "stats" && h(StatsTab, { state }), 
    // Bottom actions
    state.isActive && h("div", { className: "mw-actions" }, h("button", { className: "mw-act mw-act-stop", onClick: () => engine.stop() }, h(StopIcon, { size: 14 }), "Stop"), h("button", { className: "mw-act mw-act-reseed", onClick: () => { triggerNewMix(); engine.reseed(); } }, h(MixIcon, { size: 14 }), "New mix")))), 
    // Trigger button
    h("button", {
        className: `mw-trigger${state.isActive ? " mw-trigger-on" : ""}`,
        onClick: () => setPanelOpen(!panelOpen),
    }, h("div", { className: "mw-trigger-icon" }, h(WaveIcon, { size: 14 }))));
}
// --- Now Playing Card ---
function NowPlayingCard({ state }) {
    return h("div", { className: "mw-np" }, h("div", { className: "mw-np-top" }, h("div", { className: "mw-np-art-wrap" }, state.currentImageUrl && h("img", { className: "mw-np-art-glow", src: state.currentImageUrl, alt: "" }), state.currentImageUrl
        ? h("img", { className: "mw-np-art", src: state.currentImageUrl, alt: "" })
        : h("div", { className: "mw-np-art mw-np-ph" })), h("div", { className: "mw-np-info" }, h("div", { className: "mw-np-name" }, state.currentTrackName), h("div", { className: "mw-np-artist" }, state.currentArtistName))), h("div", { className: "mw-np-controls" }, h("button", {
        className: "mw-np-btn mw-np-like",
        onClick: () => engine.likeCurrentTrack(),
        title: "Like",
    }, h(HeartIcon, { size: 14 })), h("button", {
        className: "mw-np-btn mw-np-dislike",
        onClick: () => engine.dislikeCurrentTrack(),
        title: "Dislike & skip",
    }, h(ThumbDownIcon, { size: 14 })), h("button", {
        className: `mw-np-btn mw-np-lock${state.lockedArtist ? " mw-np-locked" : ""}`,
        onClick: () => engine.toggleLockArtist(),
        title: state.lockedArtist ? `Unlock ${state.lockedArtist}` : "Lock to this artist",
    }, h(LockIcon, { size: 14, locked: !!state.lockedArtist }), state.lockedArtist ? state.lockedArtist : "Lock artist"), h("button", {
        className: "mw-np-btn mw-np-mixfrom",
        onClick: () => { triggerNewMix(); engine.reseedFromTrack(); },
        title: "Mix from this track",
    }, h(MixIcon, { size: 14 }), "Mix from track")));
}
// --- Main Tab ---
function MainTab({ state }) {
    if (state.isActive) {
        return h(React.Fragment, null, h(MoodChips, { activeMood: state.activeMood, isActive: true, topLikedArtist: state.topLikedArtist, isFavoritesMode: state.isFavoritesMode, pinnedMood: state.pinnedMood }), h(InlineStats, { state }));
    }
    return h(React.Fragment, null, 
    // ASCII wave hero when not active
    h("div", { className: "mw-hero" }, h(AsciiWave, { active: false }), h("div", { className: "mw-hero-text" }, "Your infinite mix")), h("div", { className: "mw-start-section" }, h("button", {
        className: `mw-start-btn${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.start(),
    }, h(PlayIcon, { size: 18 }), "Start"), h("button", {
        className: `mw-start-btn mw-start-fav${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.startFavorites(),
    }, h(HeartIcon, { size: 16, filled: true }), "My Favorites")), h(MoodChips, { activeMood: null, isActive: false, topLikedArtist: state.topLikedArtist, isFavoritesMode: false, pinnedMood: state.pinnedMood }));
}
// --- Mood Chips ---
function MoodChips({ activeMood, isActive, topLikedArtist, isFavoritesMode, pinnedMood }) {
    const [expanded, setExpanded] = React.useState(false);
    const visible = expanded ? MOODS : MOODS.slice(0, 4);
    return h("div", { className: "mw-moods" }, h("div", { className: "mw-moods-header" }, h("div", { className: "mw-moods-label" }, "MOOD"), expanded && h("button", {
        className: "mw-moods-collapse",
        onClick: () => setExpanded(false),
    }, "\u2715")), h("div", { className: `mw-moods-row${expanded ? " mw-moods-expanded" : ""}` }, 
    // Favorites chip
    h("button", {
        key: "favorites",
        className: `mw-mood mw-mood-fav${isFavoritesMode ? " mw-mood-on" : ""}${pinnedMood === "__favorites__" ? " mw-mood-pinned" : ""}`,
        onClick: () => {
            if (isFavoritesMode && isActive) {
                engine.stop();
                return;
            }
            if (isActive)
                engine.stop();
            setTimeout(() => engine.startFavorites(), 100);
        },
        onContextMenu: (e) => { e.preventDefault(); engine.togglePinFavorites(); },
    }, h(HeartIcon, { size: 11, filled: true }), pinnedMood === "__favorites__" ? " Favorites \u{1F4CC}" : " Favorites"), 
    // Top artist chip
    topLikedArtist && h("button", {
        key: "top-artist",
        className: "mw-mood mw-mood-artist",
        onClick: () => {
            if (isActive)
                engine.stop();
            setTimeout(() => engine.startFromArtistName(topLikedArtist), 100);
        },
    }, `\u2605 ${topLikedArtist}`), 
    // Mood chips
    visible.map(mood => h("button", {
        key: mood.id,
        className: `mw-mood${activeMood === mood.id ? " mw-mood-on" : ""}${pinnedMood === mood.id ? " mw-mood-pinned" : ""}`,
        onClick: () => {
            if (activeMood === mood.id) {
                engine.stop();
                return;
            }
            if (isActive)
                engine.stop();
            setTimeout(() => engine.start(mood.id), 100);
        },
        onContextMenu: (e) => { e.preventDefault(); engine.togglePinMood(mood.id); },
    }, pinnedMood === mood.id ? `${mood.label} \u{1F4CC}` : mood.label)), !expanded && h("button", {
        key: "more",
        className: "mw-mood mw-mood-more",
        onClick: () => setExpanded(true),
    }, `+${MOODS.length - 4}`)));
}
// --- Inline Stats ---
function InlineStats({ state }) {
    useTimeTick(state.isActive);
    const mins = state.sessionMinutes;
    const timeStr = mins < 1 ? "<1m" : `${mins}m`;
    return h("div", { className: "mw-istats" }, h("div", { className: "mw-istat" }, h("div", { className: "mw-istat-val" }, `${state.playedCount}`), h("div", { className: "mw-istat-lbl" }, "tracks")), h("div", { className: "mw-istat" }, h("div", { className: "mw-istat-val" }, timeStr), h("div", { className: "mw-istat-lbl" }, "listened")), h("div", { className: "mw-istat" }, h("div", { className: "mw-istat-val" }, `${state.uniqueArtistsCount}`), h("div", { className: "mw-istat-lbl" }, "artists")));
}
// --- History Tab ---
function HistoryTab({ history }) {
    if (history.length === 0) {
        return h("div", { className: "mw-empty" }, "No tracks played yet");
    }
    return h("div", { className: "mw-hist" }, history.slice(0, 20).map((entry, i) => h("div", {
        key: entry.uri + entry.timestamp,
        className: "mw-hist-row",
        style: { animationDelay: `${i * 30}ms` },
    }, h("div", { className: "mw-hist-num" }, `${i + 1}`), entry.imageUrl
        ? h("img", { className: "mw-hist-art", src: entry.imageUrl, alt: "", onClick: () => engine.playFromHistory(entry.uri) })
        : h("div", { className: "mw-hist-art mw-hist-ph", onClick: () => engine.playFromHistory(entry.uri) }), h("div", { className: "mw-hist-info", onClick: () => engine.playFromHistory(entry.uri) }, h("div", { className: "mw-hist-name" }, entry.name), h("div", { className: "mw-hist-artist" }, entry.artist)), h(LikeButton, { uri: entry.uri }))));
}
// --- Like Button (history rows) ---
function LikeButton({ uri }) {
    const [liked, setLiked] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await Spicetify.Platform.LibraryAPI.contains(uri);
                if (!cancelled)
                    setLiked(!!res);
            }
            catch {
                // Some Spicetify versions use a different API shape
                try {
                    const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/me/tracks/contains?ids=${uri.split(":").pop()}`);
                    if (!cancelled && Array.isArray(res))
                        setLiked(res[0]);
                }
                catch { }
            }
        })();
        return () => { cancelled = true; };
    }, [uri]);
    const toggle = async (e) => {
        e.stopPropagation();
        try {
            if (liked) {
                await Spicetify.Platform.LibraryAPI.remove({ uris: [uri] });
            }
            else {
                await Spicetify.Platform.LibraryAPI.add({ uris: [uri] });
            }
            setLiked(!liked);
        }
        catch { }
    };
    return h("button", {
        className: `mw-like${liked ? " mw-liked" : ""}`,
        onClick: toggle,
    }, h(HeartIcon, { size: 14, filled: liked }));
}
// --- Stats Tab ---
function StatsTab({ state }) {
    useTimeTick(state.isActive);
    if (!state.isActive && state.history.length === 0) {
        return h("div", { className: "mw-empty" }, "Start a mix to see stats");
    }
    const mins = state.sessionMinutes;
    const timeStr = mins < 1 ? "<1m" : `${mins}m`;
    return h("div", { className: "mw-stats-tab" }, h("div", { className: "mw-stats-grid" }, h("div", { className: "mw-stat-card" }, h("div", { className: "mw-stat-val" }, `${state.playedCount}`), h("div", { className: "mw-stat-lbl" }, "tracks")), h("div", { className: "mw-stat-card" }, h("div", { className: "mw-stat-val" }, timeStr), h("div", { className: "mw-stat-lbl" }, "listened")), h("div", { className: "mw-stat-card" }, h("div", { className: "mw-stat-val" }, `${state.uniqueArtistsCount}`), h("div", { className: "mw-stat-lbl" }, "artists"))), state.topArtists.length > 0 && h("div", { className: "mw-top-artists" }, h("div", { className: "mw-top-label" }, "TOP ARTISTS"), state.topArtists.map((a, i) => h("div", { key: a.name, className: "mw-top-row", style: { animationDelay: `${i * 40}ms` } }, h("div", { className: "mw-top-rank" }, `${i + 1}`), h("div", { className: "mw-top-name" }, a.name), h("div", { className: "mw-top-count" }, `${a.count} plays`)))), state.seedTrackName && h("div", { className: "mw-stat-seed" }, h("span", { className: "mw-stat-seed-lbl" }, state.activeMood ? "Mood" : state.isFavoritesMode ? "Mode" : "Seed"), h("span", null, state.seedTrackName)));
}
// ============================================================
// Entry Point
// ============================================================
function cleanupPreviousInstance() {
    // Stop engine if it was running
    if (engine.getState().isActive) {
        engine.stop();
    }
    // Remove old DOM elements
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
    if (oldStyles)
        oldStyles.remove();
    // Disconnect previous observer
    if (window.__mywaveObserver) {
        window.__mywaveObserver.disconnect();
        window.__mywaveObserver = null;
    }
    // Deregister previous context menu
    if (window.__mywaveCtxMenu) {
        try {
            window.__mywaveCtxMenu.deregister();
        }
        catch { }
        window.__mywaveCtxMenu = null;
    }
    console.log("[MyWave] Cleaned up previous instance");
}
async function main() {
    while (!Spicetify?.React || !Spicetify?.ReactDOM) {
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    React = Spicetify.React;
    ReactDOM = Spicetify.ReactDOM;
    console.log("[MyWave] Initializing...");
    cleanupPreviousInstance();
    injectStyles();
    registerContextMenu();
    engine.loadTopLikedArtist();
    injectHomeBanner();
    const bbContainer = document.createElement("div");
    bbContainer.id = "mywave-bb";
    const repeatBtn = document.querySelector("[data-testid='control-button-repeat']") ||
        document.querySelector("button[aria-label='Repeat']") ||
        document.querySelector("button[aria-label*='repeat' i]");
    let bbMounted = false;
    if (repeatBtn?.parentElement) {
        repeatBtn.parentElement.insertBefore(bbContainer, repeatBtn.nextSibling);
        bbMounted = true;
    }
    if (!bbMounted) {
        const ctrl = document.querySelector(".player-controls__buttons") ||
            document.querySelector("[data-testid='player-controls']") ||
            document.querySelector(".player-controls");
        if (ctrl) {
            ctrl.appendChild(bbContainer);
            bbMounted = true;
        }
    }
    if (!bbMounted) {
        bbContainer.style.cssText = "position:fixed;bottom:80px;right:16px;z-index:9999";
        document.body.appendChild(bbContainer);
    }
    ReactDOM.render(h(BottomBarWidget), bbContainer);
}
// --- Context Menu ---
function registerContextMenu() {
    try {
        const CtxMenu = Spicetify.ContextMenu;
        if (!CtxMenu) {
            console.log("[MyWave] ContextMenu API not available");
            return;
        }
        const menuItem = new CtxMenu.Item("Start Mix from this", (uris) => {
            const uri = uris[0];
            if (uri?.includes("playlist")) {
                engine.startFromPlaylist(uri);
            }
        }, (uris) => {
            return uris.length === 1 && uris[0]?.includes("playlist");
        });
        menuItem.register();
        window.__mywaveCtxMenu = menuItem;
        console.log("[MyWave] Context menu registered");
    }
    catch (e) {
        console.log("[MyWave] Failed to register context menu:", e);
    }
}
// --- Home Page Banner ---
function injectHomeBanner() {
    let mounted = false;
    function tryInject() {
        if (mounted && document.getElementById("mywave-home"))
            return;
        const old = document.getElementById("mywave-home");
        if (old) {
            old.remove();
            mounted = false;
        }
        const homeContent = document.querySelector('[data-testid="home-page"]') ||
            document.querySelector('.main-home-content');
        if (!homeContent)
            return;
        const container = document.createElement("div");
        container.id = "mywave-home";
        // Find a valid direct child to insert before
        const children = homeContent.children;
        if (children.length > 0) {
            try {
                homeContent.insertBefore(container, children[0]);
            }
            catch {
                // If insertBefore fails, try prepend or append
                try {
                    homeContent.prepend(container);
                }
                catch {
                    homeContent.appendChild(container);
                }
            }
        }
        else {
            homeContent.appendChild(container);
        }
        ReactDOM.render(h(HomeBanner), container);
        mounted = true;
        console.log("[MyWave] Home banner injected");
    }
    setTimeout(tryInject, 2000);
    setTimeout(tryInject, 5000);
    let debounceTimer = null;
    const obs = new MutationObserver(() => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(tryInject, 300);
    });
    const mainView = document.querySelector('.Root__main-view') || document.body;
    obs.observe(mainView, { childList: true, subtree: true });
    // Store reference for cleanup
    window.__mywaveObserver = obs;
}
// ============================================================
// Styles
// ============================================================
function injectStyles() {
    if (document.getElementById("mywave-styles"))
        return;
    const s = document.createElement("style");
    s.id = "mywave-styles";
    s.textContent = `
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
      user-select: none;
      letter-spacing: 2.5px;
    }
    .mw-eq-mini { font-size: 7px; letter-spacing: 2px; padding: 4px 0; }
    .mw-eq-on { color: var(--mw-g); }
    .mw-eq-row { white-space: pre; height: 1.1em; }
    .mw-eq-ch {
      transition: opacity 0.12s;
    }
    .mw-eq-on .mw-eq-ch {
      text-shadow: 0 0 6px rgba(29,185,84,.5), 0 0 14px rgba(29,185,84,.15);
    }
    .mw-eq:not(.mw-eq-on) .mw-eq-ch { opacity: 0.35; }
    .mw-eq-sp { opacity: 0; }

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
      text-shadow: 0 0 6px var(--mw-g), 0 0 16px rgba(29,185,84,.5);
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
      font-size: 11px;
      line-height: 1.5;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .mw-sea-row {
      white-space: nowrap;
      animation: mw-sea-scroll linear infinite;
    }
    @keyframes mw-sea-scroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    /* ===== HOME BANNER ===== */
    #mywave-home { padding: 0 32px; margin-bottom: 8px; }
    .mw-home {
      position: relative;
      border-radius: 14px;
      background: linear-gradient(180deg, #040804 0%, #030603 100%);
      border: 1px solid rgba(29,185,84,.1);
      overflow: hidden;
      cursor: default;
      min-height: 130px;
      transition: border-color 300ms var(--mw-ease);
    }
    .mw-home:hover { border-color: rgba(29,185,84,.25); }
    .mw-home-glow {
      position: absolute;
      top: -30%; left: 30%;
      width: 40%; height: 160%;
      background: radial-gradient(ellipse, rgba(29,185,84,.08) 0%, transparent 70%);
      pointer-events: none;
      z-index: 1;
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
    .mw-home-btn-play { background: var(--mw-g); color: black; }
    .mw-home-btn-play:hover { background: var(--mw-g2); box-shadow: 0 2px 16px rgba(29,185,84,.3); }
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
      box-shadow: 0 0 6px var(--mw-g);
      animation: mw-blink 1.5s ease-in-out infinite;
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
    .mw-home-mood-on { background: var(--mw-g); border-color: var(--mw-g); color: black; }
    .mw-home-mood-on:hover { background: var(--mw-g2); border-color: var(--mw-g2); }
    .mw-home-mood-artist { border-color: rgba(29,185,84,.3); color: var(--mw-g); }

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
    .mw-trigger-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; }

    /* ===== PANEL ===== */
    .mw-panel {
      position:absolute; bottom:44px; right:-8px; width:360px;
      border-radius:16px; background:var(--mw-bg);
      border:1px solid var(--mw-border);
      box-shadow: 0 24px 80px rgba(0,0,0,.8), 0 0 1px rgba(29,185,84,.15);
      overflow:hidden; z-index:10000;
      transform-origin:bottom right;
      animation:mw-pop 250ms var(--mw-ease) forwards;
    }
    @keyframes mw-pop { from{opacity:0;transform:scale(.96) translateY(4px)} to{opacity:1;transform:none} }
    .mw-panel-inner { padding:16px; display:flex; flex-direction:column; gap:14px; max-height:520px; overflow-y:auto; }
    .mw-panel-inner::-webkit-scrollbar { width:3px; }
    .mw-panel-inner::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* ===== HEADER ===== */
    .mw-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-header-left { display:flex; align-items:center; gap:10px; }
    .mw-header-title { font-size:16px; font-weight:800; color:var(--mw-text); letter-spacing:-0.3px; }
    .mw-logo {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px;
      background:var(--mw-g); color:black;
      box-shadow: 0 0 12px rgba(29,185,84,.3);
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
      background:var(--mw-card);
      border:1px solid var(--mw-border);
      animation:mw-in 250ms var(--mw-ease) both;
    }
    .mw-np-top { display:flex; align-items:center; gap:12px; }
    .mw-np-art-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
    .mw-np-art-glow {
      position:absolute; inset:-6px; width:calc(100% + 12px); height:calc(100% + 12px);
      border-radius:12px; object-fit:cover;
      filter:blur(10px) saturate(1.8) brightness(0.7);
      opacity:0.55; z-index:0; pointer-events:none;
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

    .mw-np-controls { display:flex; align-items:center; gap:4px; padding-top:4px; border-top:1px solid var(--mw-border); }
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

    /* ===== MOOD CHIPS ===== */
    .mw-moods { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) 50ms both; }
    .mw-moods-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-moods-label {
      font-family: var(--mw-mono);
      font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
    }
    .mw-moods-collapse {
      border:none; background:none; color:var(--mw-sub); cursor:pointer; font-size:12px; padding:2px 6px; border-radius:4px;
      transition: color 150ms, background 150ms;
    }
    .mw-moods-collapse:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-moods-row { display:flex; gap:6px; flex-wrap:wrap; overflow:hidden; }
    .mw-moods-expanded .mw-mood { animation: mw-in 150ms var(--mw-ease) both; }
    .mw-mood {
      padding:6px 16px; border-radius:20px; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-text); font-size:13px; font-weight:600; cursor:pointer;
      transition:background 150ms var(--mw-ease), border-color 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood:hover { background:rgba(255,255,255,.04); border-color:#333; }
    .mw-mood:active { transform:scale(.95); transition-duration:80ms; }
    .mw-mood-on { background:var(--mw-g); border-color:var(--mw-g); color:black; }
    .mw-mood-on:hover { background:var(--mw-g2); border-color:var(--mw-g2); }
    .mw-mood-artist { border-color:rgba(29,185,84,.3); color:var(--mw-g); }
    .mw-mood-artist:hover { border-color:rgba(29,185,84,.5); background:rgba(29,185,84,.08); }
    .mw-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; display:flex; align-items:center; gap:2px; }
    .mw-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-mood-fav.mw-mood-on { background:#E91E63; border-color:#E91E63; color:white; }
    .mw-mood-pinned { box-shadow:0 0 0 1.5px var(--mw-g) inset; border-color:var(--mw-g); }
    .mw-mood-more { border-style:dashed; color:var(--mw-sub); }
    .mw-mood-more:hover { border-style:solid; }

    /* ===== INLINE STATS ===== */
    .mw-istats { display:flex; gap:8px; animation:mw-in 250ms var(--mw-ease) 100ms both; }
    .mw-istat { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-istat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-istat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    /* ===== START ===== */
    .mw-start-section { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-start-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:12px; border:none; border-radius:12px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
      background:var(--mw-g); color:black;
    }
    .mw-start-btn:hover { background:var(--mw-g2); box-shadow:0 4px 24px rgba(29,185,84,.25); }
    .mw-start-btn:active { transform:scale(.97); transition-duration:80ms; }
    .mw-start-fav { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-start-fav:hover { background:#1a1a1a; box-shadow:none; }
    .mw-start-fav svg { color:#E91E63; }
    .mw-loading { opacity:.5; pointer-events:none; }

    /* ===== HISTORY ===== */
    .mw-hist { display:flex; flex-direction:column; gap:2px; max-height:280px; overflow-y:auto; }
    .mw-hist::-webkit-scrollbar { width:3px; }
    .mw-hist::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-hist-row { display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:8px; animation:mw-in 200ms var(--mw-ease) both; transition:background 150ms var(--mw-ease); }
    .mw-hist-row:hover { background:rgba(255,255,255,.03); }
    .mw-hist-num { font-family:var(--mw-mono); font-size:10px; color:rgba(255,255,255,.15); width:16px; text-align:center; flex-shrink:0; font-weight:600; }
    .mw-hist-art { width:36px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0; cursor:pointer; background:linear-gradient(135deg,#1a1a1a,#0a0a0a); transition:transform 200ms var(--mw-spring); }
    .mw-hist-art:hover { transform:scale(1.08); }
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
    .mw-liked { color:#E91E63 !important; }

    /* ===== STATS TAB ===== */
    .mw-stats-tab { display:flex; flex-direction:column; gap:12px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-stats-grid { display:flex; gap:8px; }
    .mw-stat-card { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-stat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    .mw-top-artists { display:flex; flex-direction:column; gap:4px; }
    .mw-top-label { font-family:var(--mw-mono); font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase; margin-bottom:4px; }
    .mw-top-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); animation:mw-in 200ms var(--mw-ease) both; }
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
    .mw-act-reseed { background:var(--mw-g); color:black; }
    .mw-act-reseed:hover { background:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.2); }

    .mw-empty { font-size:13px; color:var(--mw-sub); text-align:center; padding:24px 0; }

    @keyframes mw-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    @media (prefers-reduced-motion:reduce) {
      .mw-panel,.mw-np,.mw-hist-row,.mw-moods,.mw-istats,.mw-stat-card,.mw-start-section,.mw-wbar,.mw-top-row,.mw-eq-row,.mw-eq-ch { animation:none !important; transition:none !important; }
    }
  `;
    document.head.appendChild(s);
}
(async () => { await main(); })();
