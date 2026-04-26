<h1 align="center">MIX LINE</h1>
<p align="center">
  <b>Infinite music stream for Spotify Desktop</b><br/>
  <sub>Spicetify Extension</sub>
</p>

<p align="center">
  <a href="#-installation">Install</a> &bull;
  <a href="#-features">Features</a> &bull;
  <a href="#-how-it-works">How it works</a> &bull;
  <a href="#-по-русски">Русский</a>
</p>

<p align="center">
  <img src="12.gif" alt="MIX LINE Demo" width="700" />
</p>

---

## What is MIX LINE?

MIX LINE turns Spotify into an infinite radio that learns your taste. Press **Start** and it builds a never-ending mix from your liked songs, favorite artists, and moods — like Yandex.Music "My Wave" or VK Mix, but for Spotify.

No playlists to manage, no manual skipping through Discover Weekly. Just music that keeps going.

---

## Installation

### One-Line Install (PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/install.ps1 | iex
```

This downloads MIX LINE, installs Spicetify if needed, and applies everything automatically.

### Quick Install (Windows)

1. Download the [latest release](https://github.com/l1kad/MIX-LINE---spotify-/releases/latest) — `MIX-LINE-v1.0.0.zip`
2. Extract and run `install.bat`
3. Spotify restarts → look for the **MIX LINE** button in the bottom bar

### Manual Install

1. Install [Spicetify](https://spicetify.app/docs/getting-started)
2. Copy `mywave.js` to `%APPDATA%\spicetify\Extensions\`
3. Run:
```powershell
spicetify config extensions mywave.js
spicetify apply
```

### Uninstall

```powershell
iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/uninstall.ps1 | iex
```

Or manually:
```powershell
spicetify config extensions mywave.js-
spicetify apply
```

---

## Features

### Controls
| Button | Action |
|--------|--------|
| **Start** | Launch a mix from your liked songs |
| **Mix from this track** | Start a mix seeded from the current track |
| **Stop** | Stop the mix |
| **New mix** | Reshuffle — fresh batch of tracks |

### Now Playing Card
| Button | Action |
|--------|--------|
| **Like** | Save to library (+4 artist score) |
| **Dislike** | Skip & blacklist (-10 artist score) |
| **More like this** | Instantly queue 15 similar tracks |
| **Discovery Only** | Toggle: only play unfamiliar artists |
| **Mix from Track** | Reseed mix from current track |
| **Save as Playlist** | Save the entire mix to your Spotify library |
| **Share** | Copy a link that recreates this mix for anyone |

### Smart Features
- **Auto-reseed** — every 5–8 tracks the mix seamlessly shifts direction
- **Skip streak** — 3 skips in a row triggers an automatic reseed
- **Learning** — likes (+4) and dislikes (-10) teach the algorithm your taste over time
- **Blacklist** — disliked tracks never appear again

### Tabs
| Tab | Description |
|-----|-------------|
| **Main** | Controls, pinned items, now playing |
| **Moods** | Pick artists, playlists, and moods — pin them to main |
| **History** | Last 20 played tracks |
| **Stats** | Session stats & top artists |

### Other
- **12 mood presets** — Chill, Focus, Hype, Sad, Drive, Romantic, Party, Workout, Sleep, Acoustic, Indie, Electronic
- **Pin system** — pin moods, artists, and playlists to the main screen and home banner
- **Home banner** — MIX LINE widget on Spotify's home page with quick-launch buttons
- **Bilingual guide** — built-in onboarding in English and Russian
- **Performance** — all animations pause when Spotify is minimized or hidden

---

## How it works

1. Seeds recommendations from Spotify's internal radio API (`radio-apollo`)
2. Maintains a rolling buffer of upcoming tracks
3. Monitors playback via `Spicetify.Player` and auto-appends before the queue runs out
4. Tracks played songs to avoid repeats (per session + persistent)
5. Artist scoring model learns from your likes/dislikes/skips

---

## Build from Source

```bash
npm install
npm run build
```

Output: `dist/app.js` → copy to `%APPDATA%\spicetify\Extensions\mywave.js`

### Dev mode
```bash
npm run watch
```

---

## Tech Stack

- **TypeScript** + **esbuild** (bundled to single IIFE)
- **Spicetify API** — React, Player, CosmosAsync, Platform
- Zero external runtime dependencies

---

## Project Structure

```
src/
├── app.tsx              # Entry point, routing, injection
├── engine/
│   ├── WaveEngine.ts    # Core: queue, recommendations, playback
│   ├── constants.ts     # Mood presets, EQ config
│   ├── prefs.ts         # Persistent preferences & learning model
│   ├── share.ts         # Share link encode/decode
│   └── toast.ts         # Toast notification system
├── ui/
│   ├── BottomBarWidget.tsx  # Main panel widget
│   ├── HomeBanner.tsx       # Home page banner
│   ├── Onboarding.tsx       # Guide modal (EN/RU)
│   ├── DebugOverlay.tsx     # Debug panel (?mywave-debug)
│   ├── panel.tsx            # Panel tabs & now playing card
│   ├── visualizers.tsx      # ASCII equalizer, sea waves, typing label
│   ├── hooks.ts             # React hooks (engine state, visibility)
│   └── icons.tsx            # SVG icon components
├── styles/
│   ├── base.ts          # Core styles
│   ├── panel.ts         # Panel & widget styles
│   ├── home.ts          # Home banner styles
│   └── onboarding.ts    # Guide modal styles
└── types/
    └── spicetify.d.ts   # Spicetify type declarations
```

---

## License

[MIT](LICENSE)

---

---

# По-русски

## Что такое MIX LINE?

MIX LINE превращает Spotify в бесконечное радио, которое учится вашему вкусу. Нажмите **Start** — и расширение создаст бесконечный микс из ваших лайкнутых песен, любимых артистов и настроений. Как «Моя Волна» в Яндекс.Музыке или VK Mix, но для Spotify.

Никаких плейлистов. Просто музыка, которая не заканчивается.

---

## Установка

### Установка одной командой (PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/install.ps1 | iex
```

Скачает MIX LINE, установит Spicetify (если нужно) и применит всё автоматически.

### Быстрая установка (Windows)

1. Скачайте [последний релиз](https://github.com/l1kad/MIX-LINE---spotify-/releases/latest) — `MIX-LINE-v1.0.0.zip`
2. Распакуйте и запустите `install.bat`
3. Spotify перезапустится → ищите кнопку **MIX LINE** в нижней панели

### Ручная установка

1. Установите [Spicetify](https://spicetify.app/docs/getting-started)
2. Скопируйте `mywave.js` в `%APPDATA%\spicetify\Extensions\`
3. Выполните:
```powershell
spicetify config extensions mywave.js
spicetify apply
```

### Удаление

```powershell
iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/uninstall.ps1 | iex
```

Или вручную:
```powershell
spicetify config extensions mywave.js-
spicetify apply
```

---

## Возможности

### Управление
| Кнопка | Действие |
|--------|----------|
| **Start** | Запустить микс из лайкнутых |
| **Mix from this track** | Микс от текущего трека |
| **Stop** | Остановить микс |
| **New mix** | Перемешать — свежая подборка |

### Карточка «Сейчас играет»
| Кнопка | Действие |
|--------|----------|
| **Like** | Сохранить в библиотеку (+4 очка артисту) |
| **Dislike** | Пропустить и в чёрный список (-10 очков) |
| **More like this** | Мгновенно добавить 15 похожих треков |
| **Discovery Only** | Только незнакомые артисты |
| **Mix from Track** | Пересидить от текущего трека |
| **Save as Playlist** | Сохранить микс как плейлист |
| **Share** | Скопировать ссылку на микс |

### Умные функции
- **Авто-ресид** — каждые 5–8 треков микс плавно меняет направление
- **Скип-стрик** — 3 скипа подряд автоматически меняют подбор
- **Обучение** — лайки (+4) и дизлайки (-10) учат алгоритм вашему вкусу
- **Чёрный список** — дизлайкнутые треки больше не появятся

### Вкладки
| Вкладка | Описание |
|---------|----------|
| **Main** | Управление, закреплённые элементы, текущий трек |
| **Moods** | Артисты, плейлисты, настроения — закрепление на главную |
| **History** | Последние 20 треков |
| **Stats** | Статистика сессии и топ артистов |

### Прочее
- **12 настроений** — Chill, Focus, Hype, Sad, Drive, Romantic, Party, Workout, Sleep, Acoustic, Indie, Electronic
- **Система пинов** — закрепляйте настроения, артистов и плейлисты на главный экран
- **Баннер на главной** — виджет MIX LINE на домашней странице Spotify
- **Гайд на двух языках** — встроенная инструкция на английском и русском
- **Оптимизация** — все анимации ставятся на паузу, когда Spotify свёрнут или скрыт

---

## Как это работает

1. Получает рекомендации через внутренний API Spotify (`radio-apollo`)
2. Поддерживает буфер предстоящих треков
3. Следит за воспроизведением через `Spicetify.Player` и подгружает треки до окончания очереди
4. Запоминает проигранные треки, чтобы не повторять (за сессию + между сессиями)
5. Модель оценки артистов учится на ваших лайках/дизлайках/скипах

---

## Сборка из исходников

```bash
npm install
npm run build
```

Результат: `dist/app.js` → скопировать в `%APPDATA%\spicetify\Extensions\mywave.js`

---

## Лицензия

[MIT](LICENSE)
