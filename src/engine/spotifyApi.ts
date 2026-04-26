// Spotify API helpers — extracted from WaveEngine for reuse and clarity.

export async function getAccessToken(): Promise<string | null> {
  try {
    const platform = (Spicetify as any).Platform;
    // Try multiple token sources
    if (platform?.Session?.accessToken) return platform.Session.accessToken;
    const state = await platform?.AuthorizationAPI?.getState?.();
    if (state?.token?.accessToken) return state.token.accessToken;
  } catch {}
  return null;
}

export async function getUserPlaylists(): Promise<{ name: string; uri: string; imageUrl: string }[]> {
  try {
    const rootlist = await (Spicetify as any).Platform.RootlistAPI.getContents();
    const items = rootlist?.items || [];
    return items
      .filter((i: any) => i.type === "playlist")
      .slice(0, 20)
      .map((pl: any) => ({
        name: pl.name || "Untitled",
        uri: pl.uri,
        imageUrl: pl.images?.[0]?.url || "",
      }));
  } catch {}
  return [];
}

export async function searchArtists(query: string): Promise<{ name: string; id: string; imageUrl: string }[]> {
  const encoded = encodeURIComponent(query);
  const token = await getAccessToken();
  if (!token) {
    console.error("[MyWave] No access token available");
    return [];
  }

  // Use spclient internal endpoint (separate rate limits from api.spotify.com)
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
        return hits.map((a: any) => ({
          name: a.name || "",
          id: a.uri?.split(":").pop() || "",
          imageUrl: a.image || a.imageUrl || "",
        }));
      }
    } else {
      console.log("[MyWave] spclient search status:", resp.status);
    }
  } catch (e) {
    console.log("[MyWave] spclient search failed:", e);
  }

  // Fallback: public Web API
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/search?q=${encoded}&type=artist&limit=6`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (resp.ok) {
      const data = await resp.json();
      return (data?.artists?.items || []).map((a: any) => ({
        name: a.name,
        id: a.id,
        imageUrl: a.images?.[a.images.length - 1]?.url || "",
      }));
    }
  } catch (e) {
    console.error("[MyWave] All search methods failed:", e);
  }
  return [];
}

export async function searchPlaylists(query: string): Promise<{ name: string; uri: string; imageUrl: string; owner: string }[]> {
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
        return hits.map((p: any) => ({
          name: p.name || "",
          uri: p.uri || "",
          imageUrl: p.image || p.imageUrl || "",
          owner: p.owner?.name || "",
        }));
      }
    }
  } catch {}
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/search?q=${encoded}&type=playlist&limit=6`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (resp.ok) {
      const data = await resp.json();
      return (data?.playlists?.items || []).map((p: any) => ({
        name: p.name,
        uri: p.uri,
        imageUrl: p.images?.[p.images.length - 1]?.url || "",
        owner: p.owner?.display_name || "",
      }));
    }
  } catch {}
  return [];
}

export async function searchInternal(query: string, type: string, limit: number): Promise<any> {
  const token = await getAccessToken();
  if (token) {
    try {
      const resp = await fetch(
        `https://spclient.wg.spotify.com/searchview/km/v4/search/${encodeURIComponent(query)}?limit=${limit}&catalogue=&entityType=${type}&platform=desktop`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) return await resp.json();
    } catch {}
  }
  // Fallback to public API
  return Spicetify.CosmosAsync.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
  );
}

export async function resolveArtistId(
  artistName: string,
  topLikedArtist?: string | null,
  topLikedArtistUri?: string | null,
): Promise<string | null> {
  // 1) Check saved top liked artist
  if (topLikedArtistUri && artistName === topLikedArtist) {
    return topLikedArtistUri.split(":").pop() || null;
  }
  // 2) Search via spclient
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
        const match = hits.find((a: any) => (a.name || "").toLowerCase() === artistName.toLowerCase()) || hits[0];
        if (match?.uri) return match.uri.split(":").pop() || null;
      }
    }
  } catch (e) {
    console.log("[MyWave] spclient artist resolve failed:", e);
  }
  // 3) Fallback: CosmosAsync search
  try {
    const res = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`
    );
    return res?.artists?.items?.[0]?.id || null;
  } catch {}
  return null;
}
