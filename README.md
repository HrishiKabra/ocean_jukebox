# Ocean Jukebox

A jukebox for the ocean. 131 real underwater recordings from NOAA's National Marine Sanctuaries — whale song, snapping shrimp, naval sonar, scuba bubbles, hurricanes, and more — streamed directly from NOAA's public hydrophone archive.

**Archive source:** [sanctsound.ioos.us](https://sanctsound.ioos.us)

---

## What it is

Ocean Jukebox is a static web app that pulls audio directly from NOAA's publicly accessible SanctSound archive. No backend, no API key, no server. You open `index.html` and it works.

The SanctSound project was a collaboration between NOAA's Office of National Marine Sanctuaries and the U.S. Navy, deploying hydrophones (underwater microphones) across seven national marine sanctuaries and one marine monument from 2018 to 2022. The resulting recordings are public domain.

The recordings are archival, not realtime. The bundled catalog can be refreshed from NOAA's current example-sounds page, but the sounds themselves are historical SanctSound clips.

---

## Sanctuaries covered

| Sanctuary | Location |
|---|---|
| Hawaiian Islands Humpback Whale | Maui, Oahu, Kauai |
| Channel Islands | Southern California |
| Monterey Bay | Central California |
| Olympic Coast | Washington State |
| Gray's Reef | Off Georgia |
| Stellwagen Bank | Off Boston, Massachusetts |
| Papahānaumokuākea | Northwestern Hawaiian Islands |
| Florida Keys | South Florida |

---

## Sound categories

- **Whales** — humpback song, blue whale calls (near the limit of human hearing), orca social calls, fin whale pulses, gray whale rumbles, right whale upcalls, sperm whale clicks, minke whale "boings"
- **Dolphins** — echolocation clicks, signature whistles, burst pulses
- **Fish** — midshipman humming, fish choruses, Atlantic cod grunts, haddock knocks, red grouper spawning calls
- **Invertebrates** — snapping shrimp (sounds like popcorn or frying food — very familiar to divers)
- **Marine mammals** — sea lion barks and buzzing
- **Weather** — hurricanes (including Dorian), rainstorms, winter storms heard from below
- **Vessels** — commercial ship propulsion, recreational boats
- **Human** — naval sonar, seal bomb blasts, fishing pingers, SCUBA diver breathing
- **Soundscapes** — complete sanctuary snapshots: reefs at night, shipping lanes with whales, the remote Pacific

---

## How it works

The app is a static HTML/CSS/JS site. The local catalog lives in `sounds.json` and `sounds.js`; the audio files are served directly from NOAA's servers at `https://sanctsound.ioos.us/files/`. Nothing is hosted locally except the catalog metadata — the sounds stream on demand.

```
https://sanctsound.ioos.us/files/SanctSound_HI01_01_humpbackwhale_20190216T045823Z.mp4
```

Each filename encodes the site ID, deployment number, species/sound type, and UTC timestamp of the recording.

### File naming convention

```
SanctSound_[SITE]_[DEPLOY]_[SOUND]_[TIMESTAMP].mp4

HI  = Hawaiian Islands Humpback Whale sanctuary
CI  = Channel Islands
MB  = Monterey Bay
OC  = Olympic Coast
GR  = Gray's Reef
SB  = Stellwagen Bank
PM  = Papahānaumokuākea
FK  = Florida Keys
```

---

## Running it

No build step. No dependencies to install. Just open `index.html` in any modern browser:

```bash
open index.html
# or
python3 -m http.server 8000  # then visit localhost:8000
```

If you want to self-host on GitHub Pages, Netlify, Vercel, or any static host, drop `index.html` in the repo root and deploy. The audio streams from NOAA either way.

---

## Features

- **131-track generated catalog** from NOAA's example-sounds page
- **Play/pause** with animated waveform visualizer, progress, and time display
- **Previous / next** track navigation
- **Shuffle** — randomises playback order across the full catalog
- **Category, sanctuary, search, and sort controls** — filter to just whales, weather, a sanctuary, a site code, or a filename
- **Shareable URLs** — track, category, sanctuary, search, sort, and tab state can be encoded in query parameters
- **Auto-advance** — plays the next track automatically when one ends
- **Grouped track list** — organized by sanctuary, with sound category labels
- **Recording metadata** — date, site code, and original filename
- **Dark mode** — respects `prefers-color-scheme`
- **Keyboard accessible** — all tracks navigable with Enter/Space
- **No cookies, no tracking, no ads**

---

## Extending it

### Refresh the recording catalog

The SanctSound archive page changes independently of this repo. Refresh the generated local catalog with:

```bash
node scripts/catalog.mjs
```

That command fetches [sanctsound.ioos.us/sounds.html](https://sanctsound.ioos.us/sounds.html), parses the media entries, preserves curated labels/descriptions already present in `sounds.json`, and writes both:

- `sounds.json` — readable catalog data
- `sounds.js` — browser-friendly catalog wrapper so `index.html` still works when opened directly from disk

If you want to add a hand-curated description, edit the matching record in `sounds.json`, then run the refresh script. The script keeps curated fields by filename.

### Add a real spectrogram

The waveform visualizer is CSS-only (decorative). To get a real frequency visualization tied to the audio, you'd need:

1. A CORS proxy (NOAA's files don't send `Access-Control-Allow-Origin` headers, so Web Audio API canvas access is blocked cross-origin)
2. Web Audio API `AnalyserNode` hooked to the `<audio>` element
3. `requestAnimationFrame` loop drawing frequency bins to a `<canvas>`

A simple approach with a proxy:

```javascript
const ctx = new AudioContext();
const analyser = ctx.createAnalyser();
const source = ctx.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(ctx.destination);

function draw() {
  requestAnimationFrame(draw);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  // draw data to canvas
}
draw();
```

### Add a map

Each recording has a known lat/lon. Add Leaflet.js and plot markers, then pan to the active sanctuary when a track plays:

```javascript
const LOCS = {
  'Hawaiian Islands': [20.7, -156.5],
  'Monterey Bay':     [36.8, -121.9],
  // ...
};

map.flyTo(LOCS[currentSanction], 7, { duration: 1.2 });
```

### Add NOAA buoy weather

NOAA's buoy API (`https://www.ndbc.noaa.gov/data/realtime2/`) has near-real-time wave height and sea surface temperature for stations near each sanctuary. You could show current conditions alongside the historical recordings.

### Add live or near-live audio

SanctSound itself is an archive, not a realtime audio feed. A live section should use a separate source and label it separately from the historical catalog. MBARI's Monterey Bay hydrophone stream is one possible near-live source when available, but it should be treated as a distinct integration rather than mixed into the SanctSound catalog.

---

## Deploying as a real site

### GitHub Pages (free)

```bash
git init
git add index.html README.md
git commit -m "ocean jukebox"
gh repo create ocean-jukebox --public --push --source=.
# then enable Pages in repo Settings → Pages → deploy from main
```

### Netlify (free, drag-and-drop)

Drag the folder to [app.netlify.com/drop](https://app.netlify.com/drop). Done in 10 seconds.

### Custom domain

Buy `oceanjukebox.com` (~$12/yr), point the DNS to your host, done.

---

## Tech stack

- Vanilla HTML/CSS/JS — no framework, no bundler
- Node.js script for catalog refresh and tests
- [Tabler Icons](https://tabler.io/icons) (webfont, loaded from jsDelivr CDN)
- Audio from NOAA's SanctSound archive (public domain, streamed on demand)
- CSS `prefers-color-scheme` for automatic dark mode

---

## Data attribution

All audio recordings are from the **NOAA SanctSound Project**:

> NOAA's Office of National Marine Sanctuaries and the U.S. Navy, in collaboration with NOAA Fisheries, NOAA's National Centers for Environmental Information, and the U.S. Integrated Ocean Observing System. 2018–2022.

Portal: [sanctsound.ioos.us](https://sanctsound.ioos.us)  
Data archive: [NOAA NCEI Passive Acoustic Data Archive](https://www.ncei.noaa.gov/products/passive-acoustic-data)

Audio is public domain. Please cite NOAA PMEL Acoustics Program as the source if you reproduce recordings.
