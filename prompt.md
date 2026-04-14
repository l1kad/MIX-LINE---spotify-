Create a Spicetify extension called "MyWave" that adds a Yandex-style infinite music stream to Spotify Desktop.



\## Core feature

A "My Wave" button that starts an infinite auto-playing queue of recommended tracks, similar to Yandex.Music "My Wave" or VK Mix.



\## Technical requirements

\- Spicetify extension (TypeScript, compiled to JS)

\- Use Spicetify.CosmosAsync to call internal Spotify endpoints

\- Use the radio/station API: `hm://radio-apollo/v3/stations/{trackUri}` to seed recommendations

\- Use `Spicetify.Player` to monitor playback and auto-append tracks before queue ends

\- Keep a rolling buffer of 5-10 upcoming tracks

\- Avoid repeating tracks (maintain a Set of played URIs per session)



\## UI

\- Add a "My Wave" button to the top bar (next to Now Playing or in the main nav)

\- Button states: idle / loading / active (show waveform animation when active)

\- Show current track context: "Based on: \[track name]"

\- Stop button to exit wave mode

\- All UI via Spicetify.React and Spicetify.ReactDOM (already available globally)



\## Queue logic

1\. On activation: get current track URI

2\. Fetch station seed from radio endpoint

3\. Load first 10 tracks into Spicetify queue

4\. Listen to `Spicetify.Player.addEventListener("songchange")` 

5\. When 3 tracks remain in queue, fetch next batch and append

6\. Filter out already-played tracks



\## File structure

\- `src/app.tsx` — main logic

\- `src/styles.css` — button + animation styles

\- `manifest.json` — Spicetify extension manifest



\## Extras

\- Optional: filter by energy/mood using Spotify audio features endpoint

\- Optional: "seed from playlist" mode — seed wave from a selected playlist's vibe

\- Handle API errors gracefully (fallback to Spotify's own radio if station endpoint fails)



Build this step by step, starting with the core queue logic, then UI, then extras.

