import { WaveIcon, PlayIcon, StopIcon, HeartIcon, MixIcon, MoodIcon, HistoryIcon, StatsIcon, ThumbDownIcon, PinIcon, CompassIcon, SaveIcon, ShareIcon, SparkleIcon } from "./icons";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

const STORAGE_KEY = "mywave:onboarding-done";
const LANG_KEY = "mywave:lang";

export type Lang = "en" | "ru";

export function getSavedLang(): Lang | null {
  try { return localStorage.getItem(LANG_KEY) as Lang | null; } catch { return null; }
}

function saveLang(lang: Lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
}

export function hasSeenOnboarding(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export function markOnboardingSeen() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

function IconRow({ icon, label }: { icon: any; label: string }) {
  return h("div", { className: "mw-ob-row" },
    h("div", { className: "mw-ob-icon" }, icon),
    h("div", { className: "mw-ob-text" }, label));
}

const t = {
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
    gotIt: "Got it!",
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
    gotIt: "\u041F\u043E\u043D\u044F\u0442\u043D\u043E!",
  },
};

function getPages(lang: Lang) {
  const s = t[lang];
  return [
    // Page 0: Welcome
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-hero" },
        h(WaveIcon, { size: 32 }),
        h("div", { className: "mw-ob-title" }, "MIX LINE")),
      h("div", { className: "mw-ob-desc" }, s.welcomeDesc),
      h("div", { className: "mw-ob-hint" }, s.welcomeHint)),

    // Page 1: Controls
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-heading" }, s.controls),
      h(IconRow, { icon: h(PlayIcon, { size: 16 }), label: s.startDesc }),
      h(IconRow, { icon: h(MixIcon, { size: 16 }), label: s.mixFromTrackDesc }),
      h(IconRow, { icon: h(StopIcon, { size: 16 }), label: s.stopDesc }),
      h(IconRow, { icon: h(MixIcon, { size: 16 }), label: s.newMixDesc }),
      h("div", { className: "mw-ob-hint" }, s.autoNote)),

    // Page 2: Now Playing
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-heading" }, s.nowPlaying),
      h("div", { className: "mw-ob-desc" }, s.npDesc),
      h(IconRow, { icon: h(HeartIcon, { size: 16 }), label: s.likeDesc }),
      h(IconRow, { icon: h(ThumbDownIcon, { size: 16 }), label: s.dislikeDesc }),
      h(IconRow, { icon: h(SparkleIcon, { size: 16 }), label: s.moreLikeDesc }),
      h(IconRow, { icon: h(CompassIcon, { size: 16 }), label: s.discoveryDesc }),
      h(IconRow, { icon: h(MixIcon, { size: 16 }), label: s.mixFromDesc }),
      h(IconRow, { icon: h(SaveIcon, { size: 16 }), label: s.saveDesc }),
      h(IconRow, { icon: h(ShareIcon, { size: 16 }), label: s.shareDesc }),
    ),

    // Page 3: Smart Features
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-heading" }, s.smartTitle),
      h(IconRow, { icon: h(MixIcon, { size: 16 }), label: s.smartAutoReseed }),
      h(IconRow, { icon: h(StopIcon, { size: 16 }), label: s.smartSkipStreak }),
      h(IconRow, { icon: h(HeartIcon, { size: 16 }), label: s.smartLearning })),

    // Page 4: Tabs
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-heading" }, s.tabs),
      h(IconRow, { icon: h(WaveIcon, { size: 16 }), label: s.tabMain }),
      h(IconRow, { icon: h(MoodIcon, { size: 16 }), label: s.tabMoods }),
      h(IconRow, { icon: h(HistoryIcon, { size: 16 }), label: s.tabHistory }),
      h(IconRow, { icon: h(StatsIcon, { size: 16 }), label: s.tabStats })),

    // Page 5: Pins & Moods
    () => h(Spicetify.React.Fragment, null,
      h("div", { className: "mw-ob-heading" }, s.pinsMoods),
      h("div", { className: "mw-ob-desc" }, s.pinsDesc),
      h(IconRow, { icon: h(PinIcon, { size: 16, filled: true }), label: s.pinAction }),
      h("div", { className: "mw-ob-desc" }, s.pinsDetail),
      h("div", { className: "mw-ob-hint" }, s.lastHint)),
  ];
}

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const savedLang = getSavedLang();
  const [lang, setLang] = Spicetify.React.useState(savedLang || "en" as Lang);
  const [langChosen, setLangChosen] = Spicetify.React.useState(!!savedLang);
  const [page, setPage] = Spicetify.React.useState(0);
  const pages = getPages(lang);
  const isLast = page === pages.length - 1;
  const s = t[lang];

  const pickLang = (l: Lang) => {
    setLang(l);
    saveLang(l);
    setLangChosen(true);
  };

  const next = () => {
    if (isLast) { markOnboardingSeen(); onClose(); }
    else setPage(page + 1);
  };

  const prev = () => { if (page > 0) setPage(page - 1); };
  const skip = () => { markOnboardingSeen(); onClose(); };

  // Language picker (only if never chosen before)
  if (!langChosen) {
    return h("div", { className: "mw-ob-backdrop" },
      h("div", { className: "mw-ob-modal" },
        h("div", { className: "mw-ob-content" },
          h("div", { className: "mw-ob-hero" },
            h(WaveIcon, { size: 32 }),
            h("div", { className: "mw-ob-title" }, "MIX LINE")),
          h("div", { className: "mw-ob-desc", style: { textAlign: "center" } },
            "Choose language / \u0412\u044B\u0431\u0435\u0440\u0438 \u044F\u0437\u044B\u043A"),
          h("div", { className: "mw-ob-lang-row" },
            h("button", { className: "mw-ob-lang", onClick: () => pickLang("en") },
              "EN  English"),
            h("button", { className: "mw-ob-lang", onClick: () => pickLang("ru") },
              "RU  \u0420\u0443\u0441\u0441\u043A\u0438\u0439")))));
  }

  return h("div", { className: "mw-ob-backdrop", onClick: (e: any) => { if (e.target === e.currentTarget) skip(); } },
    h("div", { className: "mw-ob-modal" },
      h("div", { key: page, className: "mw-ob-content" }, pages[page]()),
      h("div", { className: "mw-ob-footer" },
        h("div", { className: "mw-ob-dots" },
          pages.map((_, i) =>
            h("div", { key: i, className: `mw-ob-dot${i === page ? " mw-ob-dot-on" : ""}` }))),
        h("div", { className: "mw-ob-btns" },
          page > 0 && h("button", { className: "mw-ob-btn mw-ob-btn-back", onClick: prev }, s.back),
          h("button", { className: "mw-ob-btn mw-ob-btn-next", onClick: next },
            isLast ? s.gotIt : s.next),
          !isLast && h("button", { className: "mw-ob-btn mw-ob-btn-skip", onClick: skip }, s.skip)))));
}
