export interface HistoryEntry {
  uri: string;
  name: string;
  artist: string;
  imageUrl: string;
  timestamp: number;
}

export interface WaveState {
  isActive: boolean;
  isLoading: boolean;
  seedTrackName: string;
  currentTrackName: string;
  currentArtistName: string;
  currentImageUrl: string;
  currentUri: string;
  lockedArtist: string | null;
  playedCount: number;
  history: HistoryEntry[];
  activeMood: string | null;
  isFavoritesMode: boolean;
  sessionMinutes: number;
  uniqueArtistsCount: number;
  topArtists: { name: string; count: number }[];
  topLikedArtist: string | null;
  pinnedMoods: string[];
  pinnedArtists: string[];
  pinnedPlaylists: { name: string; uri: string }[];
  discoveryOnly: boolean;
}
