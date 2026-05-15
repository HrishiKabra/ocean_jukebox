(function () {
  const CATEGORY_LABELS = {
    all: 'All',
    whale: 'Whales',
    dolphin: 'Dolphins',
    fish: 'Fish',
    invertebrate: 'Invertebrates',
    'marine mammal': 'Marine mammals',
    weather: 'Weather',
    vessel: 'Vessels',
    human: 'Human',
    soundscape: 'Soundscapes',
  };

  const SORT_LABELS = {
    curated: 'Catalog order',
    newest: 'Newest',
    oldest: 'Oldest',
    sanctuary: 'Sanctuary',
  };

  const FALLBACK_CATALOG = {
    source: 'https://sanctsound.ioos.us/sounds.html',
    baseUrl: 'https://sanctsound.ioos.us/files/',
    generatedAt: null,
    archiveNote: 'NOAA SanctSound is a historical passive acoustic archive. These clips are recordings from the 2018-2021/2022 project period, not realtime audio.',
    tracks: [],
  };

  const els = {};
  const state = {
    catalog: window.OCEAN_JUKEBOX_CATALOG || FALLBACK_CATALOG,
    tracks: [],
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    shuffled: false,
    order: [],
    currentIndex: 0,
    visibleIndexes: [],
    playing: false,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function formatDate(value) {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  function formatCount(count) {
    return `${count} ${count === 1 ? 'recording' : 'recordings'}`;
  }

  function searchable(track) {
    return [
      track.label,
      track.description,
      track.sanctuary,
      track.category,
      track.site,
      track.filename,
    ].join(' ').toLowerCase();
  }

  function recordedTime(track) {
    return track.recordedAt ? Date.parse(track.recordedAt) : 0;
  }

  function sortedIndexes(indexes) {
    const sorted = [...indexes];
    if (state.sort === 'newest') {
      sorted.sort((a, b) => recordedTime(state.tracks[b]) - recordedTime(state.tracks[a]));
    } else if (state.sort === 'oldest') {
      sorted.sort((a, b) => recordedTime(state.tracks[a]) - recordedTime(state.tracks[b]));
    } else if (state.sort === 'sanctuary') {
      sorted.sort((a, b) => {
        const sanctuary = state.tracks[a].sanctuary.localeCompare(state.tracks[b].sanctuary);
        return sanctuary || state.tracks[a].label.localeCompare(state.tracks[b].label);
      });
    }
    return sorted;
  }

  function recomputeVisible() {
    const query = state.query.trim().toLowerCase();
    const filtered = state.order.filter(index => {
      const track = state.tracks[index];
      return (state.category === 'all' || track.category === state.category)
        && (state.sanctuary === 'all' || track.sanctuary === state.sanctuary)
        && (!query || searchable(track).includes(query));
    });
    state.visibleIndexes = sortedIndexes(filtered);
    if (state.visibleIndexes.length && !state.visibleIndexes.includes(state.currentIndex)) {
      state.currentIndex = state.visibleIndexes[0];
      setTrack(state.currentIndex, { autoplay: state.playing });
    }
  }

  function categoryList() {
    const fromCatalog = [...new Set(state.tracks.map(track => track.category))].sort();
    return ['all', ...fromCatalog.filter(category => category !== 'all')];
  }

  function sanctuaryList() {
    return ['all', ...new Set(state.tracks.map(track => track.sanctuary).sort())];
  }

  function updateMeta() {
    const generated = state.catalog.generatedAt ? formatDate(state.catalog.generatedAt) : 'Unknown';
    els.catalogMeta.textContent = `${formatCount(state.tracks.length)} from NOAA SanctSound · catalog refreshed ${generated}`;
    els.archiveNote.textContent = state.catalog.archiveNote || FALLBACK_CATALOG.archiveNote;
    els.resultCount.textContent = formatCount(state.visibleIndexes.length);
  }

  function setPlayingState(value) {
    state.playing = value;
    els.waveform.classList.toggle('active', value);
    els.playIcon.className = value ? 'ti ti-player-pause' : 'ti ti-player-play';
    els.playButton.setAttribute('aria-label', value ? 'Pause' : 'Play');
  }

  function mediaUrl(track) {
    return track.url || `${state.catalog.baseUrl}${track.filename}`;
  }

  function setTrack(index, options = {}) {
    if (!state.tracks[index]) return;
    state.currentIndex = index;
    const track = state.tracks[index];
    els.sanctuary.textContent = track.sanctuary;
    els.category.textContent = CATEGORY_LABELS[track.category] || track.category;
    els.label.textContent = track.label;
    els.description.textContent = track.description || 'No description available from the source catalog.';
    els.date.textContent = formatDate(track.recordedAt);
    els.site.textContent = track.site || 'Unknown site';
    els.filename.textContent = track.filename;
    els.audio.src = mediaUrl(track);
    els.audio.load();
    highlightCurrent();
    if (options.autoplay) {
      els.audio.play().then(() => setPlayingState(true)).catch(() => setPlayingState(false));
    }
  }

  function highlightCurrent() {
    document.querySelectorAll('.trow').forEach(row => {
      row.classList.toggle('now', Number(row.dataset.index) === state.currentIndex);
    });
  }

  function playPause() {
    if (!state.tracks.length) return;
    if (!state.playing) {
      els.audio.play().then(() => setPlayingState(true)).catch(() => setPlayingState(false));
    } else {
      els.audio.pause();
      setPlayingState(false);
    }
  }

  function navigate(delta) {
    if (!state.visibleIndexes.length) return;
    const visiblePosition = state.visibleIndexes.indexOf(state.currentIndex);
    const safePosition = visiblePosition === -1 ? 0 : visiblePosition;
    const nextPosition = (safePosition + delta + state.visibleIndexes.length) % state.visibleIndexes.length;
    setTrack(state.visibleIndexes[nextPosition], { autoplay: state.playing });
  }

  function shuffleOrder() {
    state.order = state.tracks.map((_, index) => index);
    if (state.shuffled) {
      for (let i = state.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
      }
    }
    recomputeVisible();
    renderTrackList();
  }

  function buildFilters() {
    els.categoryBar.innerHTML = '';
    categoryList().forEach(category => {
      const button = document.createElement('button');
      button.className = `chip${category === state.category ? ' on' : ''}`;
      button.textContent = CATEGORY_LABELS[category] || category;
      button.setAttribute('aria-pressed', category === state.category ? 'true' : 'false');
      button.addEventListener('click', () => {
        state.category = category;
        buildFilters();
        recomputeVisible();
        renderTrackList();
        updateMeta();
      });
      els.categoryBar.appendChild(button);
    });

    els.sanctuarySelect.innerHTML = '';
    sanctuaryList().forEach(sanctuary => {
      const option = document.createElement('option');
      option.value = sanctuary;
      option.textContent = sanctuary === 'all' ? 'All sanctuaries' : sanctuary;
      els.sanctuarySelect.appendChild(option);
    });
  }

  function renderTrackList() {
    els.trackList.innerHTML = '';
    els.emptyState.hidden = state.visibleIndexes.length > 0;
    const grouped = new Map();

    state.visibleIndexes.forEach(index => {
      const track = state.tracks[index];
      const groupName = state.sort === 'sanctuary' || state.sanctuary === 'all' ? track.sanctuary : CATEGORY_LABELS[track.category] || track.category;
      if (!grouped.has(groupName)) grouped.set(groupName, []);
      grouped.get(groupName).push(index);
    });

    grouped.forEach((indexes, groupName) => {
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = groupName;
      els.trackList.appendChild(label);

      indexes.forEach(index => {
        const track = state.tracks[index];
        const row = document.createElement('button');
        row.className = `trow${index === state.currentIndex ? ' now' : ''}`;
        row.dataset.index = index;
        row.type = 'button';
        row.setAttribute('aria-label', `${track.label} - ${track.sanctuary}`);
        row.innerHTML = `
          <span class="t-num">${String(index + 1).padStart(2, '0')}</span>
          <span class="t-info">
            <span class="t-name">${track.label}</span>
            <span class="t-meta">${CATEGORY_LABELS[track.category] || track.category} · ${formatDate(track.recordedAt)} · ${track.site || 'site unknown'}</span>
          </span>
          <i class="ti ti-player-play t-play-icon" aria-hidden="true"></i>
        `;
        row.addEventListener('click', () => {
          setTrack(index, { autoplay: true });
        });
        els.trackList.appendChild(row);
      });
    });
    updateMeta();
  }

  function updateProgress() {
    const duration = els.audio.duration || 0;
    const current = els.audio.currentTime || 0;
    els.progress.max = duration || 0;
    els.progress.value = current;
    els.time.textContent = `${formatTime(current)} / ${duration ? formatTime(duration) : '0:00'}`;
  }

  function formatTime(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function bindEvents() {
    els.playButton.addEventListener('click', playPause);
    els.prevButton.addEventListener('click', () => navigate(-1));
    els.nextButton.addEventListener('click', () => navigate(1));
    els.shuffleButton.addEventListener('click', () => {
      state.shuffled = !state.shuffled;
      els.shuffleButton.classList.toggle('active-btn', state.shuffled);
      shuffleOrder();
    });
    els.query.addEventListener('input', () => {
      state.query = els.query.value;
      recomputeVisible();
      renderTrackList();
    });
    els.sanctuarySelect.addEventListener('change', () => {
      state.sanctuary = els.sanctuarySelect.value;
      recomputeVisible();
      renderTrackList();
    });
    els.sortSelect.addEventListener('change', () => {
      state.sort = els.sortSelect.value;
      recomputeVisible();
      renderTrackList();
    });
    els.progress.addEventListener('input', () => {
      els.audio.currentTime = Number(els.progress.value);
    });
    els.audio.addEventListener('play', () => setPlayingState(true));
    els.audio.addEventListener('pause', () => setPlayingState(false));
    els.audio.addEventListener('ended', () => navigate(1));
    els.audio.addEventListener('timeupdate', updateProgress);
    els.audio.addEventListener('loadedmetadata', updateProgress);
    els.audio.addEventListener('waiting', () => {
      els.status.textContent = 'Loading audio...';
    });
    els.audio.addEventListener('playing', () => {
      els.status.textContent = '';
    });
    els.audio.addEventListener('error', () => {
      els.status.textContent = 'This recording could not be loaded from NOAA right now.';
      setPlayingState(false);
    });
  }

  function cacheElements() {
    Object.assign(els, {
      audio: byId('audio'),
      waveform: byId('waveform'),
      playIcon: byId('play-icon'),
      playButton: byId('btn-play'),
      prevButton: byId('btn-prev'),
      nextButton: byId('btn-next'),
      shuffleButton: byId('btn-shuffle'),
      sanctuary: byId('s-sanctuary'),
      category: byId('s-cat'),
      label: byId('s-label'),
      description: byId('s-desc'),
      date: byId('s-date'),
      site: byId('s-site'),
      filename: byId('s-file'),
      categoryBar: byId('cat-bar'),
      sanctuarySelect: byId('sanctuary-filter'),
      sortSelect: byId('sort-select'),
      query: byId('search-input'),
      trackList: byId('tlist'),
      emptyState: byId('empty-state'),
      catalogMeta: byId('catalog-meta'),
      archiveNote: byId('archive-note'),
      resultCount: byId('result-count'),
      progress: byId('progress'),
      time: byId('time'),
      status: byId('status'),
    });
  }

  function init() {
    cacheElements();
    state.tracks = state.catalog.tracks || [];
    state.order = state.tracks.map((_, index) => index);
    state.visibleIndexes = [...state.order];

    Object.entries(SORT_LABELS).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.sortSelect.appendChild(option);
    });

    bindEvents();
    buildFilters();
    recomputeVisible();
    renderTrackList();

    if (state.tracks.length) {
      setTrack(state.visibleIndexes[0] || 0);
    } else {
      els.status.textContent = 'No recordings found. Refresh the catalog with node scripts/catalog.mjs.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
