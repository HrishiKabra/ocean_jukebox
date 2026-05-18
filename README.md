# Ocean Jukebox

A jukebox for the ocean. 131 real underwater recordings from NOAA's National Marine Sanctuaries — whale song, snapping shrimp, naval sonar, scuba bubbles, hurricanes, and more — streamed directly from NOAA's public hydrophone archive.

**Live:** [https://hrishikabra.github.io/ocean_jukebox/](https://hrishikabra.github.io/ocean_jukebox/)

**Archive source:** [sanctsound.ioos.us](https://sanctsound.ioos.us)

---

## What it is

Ocean Jukebox is a static web app that pulls audio directly from NOAA's publicly accessible SanctSound archive. It has no custom backend and no API key, but it must be served over HTTP(S) with GitHub Pages, another static host, or a local static server so the ES modules load correctly.

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

The app is a static HTML/CSS/JS site. The local catalog lives in `sounds.json` and `sounds.js`; the audio files are served directly from NOAA's servers at `https://sanctsound.ioos.us/files/`. Nothing is hosted locally except the catalog metadata — the sounds stream on demand. The Map tab loads Leaflet from a CDN and displays OpenStreetMap tiles, so that view needs network access.

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

No build step. No dependencies to install. Serve the repo over HTTP so the ES modules load correctly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

GitHub Pages and static hosts such as Netlify or Vercel are supported. Deploy the full static asset set in this repo root. `index.html` depends on `js/main.js`, the supporting modules in `js/`, `app-core.mjs`, `sounds.js`, `sanctuaries.js`, `live-sources.js`, `audio-artifacts.js`, `site.webmanifest`, `sw.js`, and optional generated spectrogram PNGs in `spectrograms/`. The audio streams from NOAA either way.

---

## Features

- **131-track generated catalog** from NOAA's example-sounds page
- **Play/pause** with animated waveform visualizer, progress, and time display
- **Previous / next** track navigation
- **Shuffle** — randomises playback order across the full catalog
- **Category, sanctuary, search, and sort controls** — filter to just whales, weather, a sanctuary, a site code, or a filename
- **Leaflet sanctuary map** — marker counts update by category and recording year
- **Shareable URLs** — track, category, sanctuary, search, sort, tab, and map year state can be encoded in query parameters
- **Offline app shell** — over HTTP(S), `js/main.js` registers `sw.js` to cache the static explorer shell and generated local metadata for repeat visits
- **Auto-advance** — plays the next track automatically when one ends
- **Grouped track list** — organized by sanctuary, with sound category labels
- **Recording metadata** — date, site code, and original filename
- **Dark mode** — respects `prefers-color-scheme`
- **Keyboard accessible** — all tracks navigable with Enter/Space
- **No cookies, no tracking, no ads**

---

## Shareable URLs

Ocean Jukebox keeps the current explorer state in the URL. You can share a link to a specific track, category, sanctuary, search term, sort order, or tab without a backend.

Example:

```text
/?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather
```

The app also accepts combined route state such as:

```text
/?track=SanctSound_GR03_02_hurricane_20190904T221437Z&category=weather&q=dorian
/?tab=map&sanctuary=Monterey+Bay
/?tab=map&category=whale&year=2020
/?tab=spectrogram&track=SanctSound_GR03_02_hurricane_20190904T221437Z
```

---

## Map view

The Map tab shows a Leaflet/OpenStreetMap view of sanctuary-level listening regions for the generated SanctSound catalog. Coordinates are approximate sanctuary reference points, not exact hydrophone deployment locations.

Map marker counts respect the active category filter and the map year dropdown, which is derived from `recordedAt` years in the generated catalog. Clicking a map marker filters the catalog to that sanctuary, marks the marker active, and updates the URL with `tab=map&sanctuary=...` plus any active `category` or `year` filters so the filtered map view can be shared.

---

## Live sources

The Live tab lists live or near-live listening sources that are separate from NOAA SanctSound. These sources are not part of the historical SanctSound archive and should not be treated as the same dataset.

Live streams may be delayed, temporarily unavailable, or offline at the source. Cards link to the source page or stream when available; the app does not embed a live player.

Refresh the generated live-source status fields with:

```bash
node scripts/check-live-sources.mjs
```

The checker updates `live-sources.js` with `checkedAt`, `status`, `statusCode`, `statusLabel`, and `statusDetail`. A reachable source page without a direct stream URL is marked as `source-page`, not playable realtime audio.

---

## Spectrograms

Generated spectrogram PNG files are optional enhancements. The Spectrogram tab looks for static generated PNG assets under `spectrograms/`; if a matching image exists, it is displayed for the active track, and otherwise the app shows a non-error empty state without a broken image.

Generate a spectrogram for a SanctSound file with:

```bash
node scripts/generate-spectrograms.mjs SanctSound_GR03_02_hurricane_20190904T221437Z.mp4
```

The generator writes `spectrograms/SanctSound_GR03_02_hurricane_20190904T221437Z.png`. It expects local command-line media tooling such as FFmpeg to be available.

Generate waveform preview data and acoustic profile metadata with:

```bash
node scripts/analyze-audio.mjs
```

By default this writes deterministic preview artifacts for every checked-in track to `audio-artifacts.json` and `audio-artifacts.js`. When media analysis has not been run, the player waveform uses the checked-in preview peak data from `audio-artifacts.js`, which keeps the waveform and detail panel useful without local media tooling. To attempt FFmpeg/FFprobe media analysis against the NOAA-hosted files, run:

```bash
node scripts/analyze-audio.mjs --analyze-media
```

---

## Extending it

### Refresh the recording catalog

The SanctSound archive page changes independently of this repo. Refresh the generated local catalog with:

```bash
node scripts/catalog.mjs
```

That command fetches [sanctsound.ioos.us/sounds.html](https://sanctsound.ioos.us/sounds.html), parses the media entries, preserves curated labels/descriptions already present in `sounds.json`, backfills enhanced-variant descriptions from their original clips, validates the result, and writes:

- `sounds.json` — readable catalog data
- `sounds.js` — browser-friendly catalog wrapper loaded by the HTTP-served app
- `catalog-report.json` — machine-readable validation report
- `catalog-report.md` — concise human-readable validation report

Validate the checked-in catalog without fetching NOAA again with:

```bash
node scripts/validate-catalog.mjs
```

The validator checks required metadata, duplicate filenames and explicit ids, malformed or mismatched URLs, malformed SanctSound timestamps, and unmapped sanctuary/category values. The command exits non-zero when errors are found.

If you want to add a hand-curated description, edit the matching record in `sounds.json`, then run the refresh script. The script keeps curated fields by filename.

### Add NOAA buoy weather

NOAA's buoy API (`https://www.ndbc.noaa.gov/data/realtime2/`) has near-real-time wave height and sea surface temperature for stations near each sanctuary. You could show current conditions alongside the historical recordings.

### Offline shell

When served over HTTP(S), `js/main.js` registers `sw.js`. The service worker caches the static explorer shell and generated local metadata (`index.html`, catalog wrappers, sanctuary metadata, live-source status, manifest, and core scripts) with relative URLs so the same files work under a GitHub Pages project path. It does not cache NOAA audio, Leaflet tiles, OpenStreetMap data, or CDN-hosted icon/map assets. After a previous visit, the Archive list can be inspected offline, but playback and map tiles still depend on remote sources.

---

## Deploying as a real site

### GitHub Pages (free)

```bash
git init
git add index.html js app-core.mjs sounds.js sounds.json sanctuaries.js live-sources.js audio-artifacts.js audio-artifacts.json site.webmanifest sw.js catalog-overrides.json scripts tests spectrograms README.md
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
- [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles for the sanctuary map
- Service worker and web app manifest for a cached static app shell
- Audio from NOAA's SanctSound archive (public domain, streamed on demand)
- CSS `prefers-color-scheme` for automatic dark mode

---

## Data attribution

All audio recordings are from the **NOAA SanctSound Project**:

> NOAA's Office of National Marine Sanctuaries and the U.S. Navy, in collaboration with NOAA Fisheries, NOAA's National Centers for Environmental Information, and the U.S. Integrated Ocean Observing System. 2018–2022.

Portal: [sanctsound.ioos.us](https://sanctsound.ioos.us)  
Data archive: [NOAA NCEI Passive Acoustic Data Archive](https://www.ncei.noaa.gov/products/passive-acoustic-data)

Audio is public domain. Please cite NOAA PMEL Acoustics Program as the source if you reproduce recordings.
