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

  const DEFAULT_ROUTE = {
    track: '',
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    tab: 'archive',
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
    sanctuaries: window.OCEAN_JUKEBOX_SANCTUARIES || [],
    tracks: [],
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    activeTab: 'archive',
    shuffled: false,
    order: [],
    currentIndex: 0,
    visibleIndexes: [],
    variantGroups: new Map(),
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

  function trackId(track) {
    return (track.filename || '').replace(/\.[^.]*$/, '');
  }

  function parseRoute(search = '') {
    const params = new URLSearchParams(search);
    return {
      track: params.get('track') || DEFAULT_ROUTE.track,
      category: params.get('category') || DEFAULT_ROUTE.category,
      sanctuary: params.get('sanctuary') || DEFAULT_ROUTE.sanctuary,
      query: params.get('q') || DEFAULT_ROUTE.query,
      sort: params.get('sort') || DEFAULT_ROUTE.sort,
      tab: params.get('tab') || DEFAULT_ROUTE.tab,
    };
  }

  function allowedValue(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function normalizeRoute(route, { categories = ['all'], sanctuaries = ['all'], tabs = ['archive'] } = {}) {
    const sorts = Object.keys(SORT_LABELS);
    return {
      track: route.track || DEFAULT_ROUTE.track,
      category: allowedValue(route.category, categories, DEFAULT_ROUTE.category),
      sanctuary: allowedValue(route.sanctuary, sanctuaries, DEFAULT_ROUTE.sanctuary),
      query: route.query || DEFAULT_ROUTE.query,
      sort: allowedValue(route.sort, sorts, DEFAULT_ROUTE.sort),
      tab: allowedValue(route.tab, tabs, DEFAULT_ROUTE.tab),
    };
  }

  function serializeRoute(route) {
    const params = new URLSearchParams();
    if (route.track) params.set('track', route.track);
    if (route.category && route.category !== DEFAULT_ROUTE.category) params.set('category', route.category);
    if (route.tab && route.tab !== DEFAULT_ROUTE.tab) params.set('tab', route.tab);
    if (route.sanctuary && route.sanctuary !== DEFAULT_ROUTE.sanctuary) params.set('sanctuary', route.sanctuary);
    if (route.query) params.set('q', route.query);
    if (route.sort && route.sort !== DEFAULT_ROUTE.sort) params.set('sort', route.sort);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    const currentTrack = state.tracks[state.currentIndex];
    const query = serializeRoute({
      track: currentTrack ? trackId(currentTrack) : '',
      category: state.category,
      sanctuary: state.sanctuary,
      query: state.query,
      sort: state.sort,
      tab: state.activeTab,
    });
    const nextUrl = `${window.location.pathname}${query}${window.location.hash}`;
    try {
      window.history.replaceState(null, '', nextUrl);
    } catch (_error) {
      // Some file:// contexts can reject history updates; playback should still work.
    }
  }

  function applyRoute(route) {
    const normalized = normalizeRoute(route, {
      categories: categoryList(),
      sanctuaries: sanctuaryList(),
      tabs: tabList(),
    });
    state.category = normalized.category;
    state.sanctuary = normalized.sanctuary;
    state.query = normalized.query;
    state.sort = normalized.sort;
    state.activeTab = normalized.tab;

    const routeTrackIndex = state.tracks.findIndex(track => trackId(track) === normalized.track);
    if (routeTrackIndex !== -1) {
      state.currentIndex = routeTrackIndex;
    }
  }

  function syncControlsFromState() {
    els.query.value = state.query;
    els.sanctuarySelect.value = state.sanctuary;
    els.sortSelect.value = state.sort;
  }

  function setTab(tabName, options = {}) {
    state.activeTab = tabList().includes(tabName) ? tabName : DEFAULT_ROUTE.tab;
    if (els.tabs) {
      els.tabs.forEach(tab => {
        const active = tab.dataset.tab === state.activeTab;
        tab.classList.toggle('on', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    if (els.mapPanel) {
      els.mapPanel.hidden = state.activeTab !== 'map';
    }
    if (state.activeTab === 'map') renderMap();
    if (options.sync !== false) syncUrl();
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

  function tabList() {
    const tabs = els.tabs ? [...els.tabs].map(tab => tab.dataset.tab).filter(Boolean) : [];
    const normalized = ['archive', 'map', 'live', 'spectrogram'];
    tabs.forEach(tab => {
      if (!normalized.includes(tab)) normalized.push(tab);
    });
    return normalized;
  }

  window.OCEAN_JUKEBOX_ROUTE_HELPERS = Object.freeze({
    buildMapPins,
    buildTrackDetail,
    normalizeRoute,
    parseRoute,
    projectMapPosition,
    serializeRoute,
    trackId,
  });

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

  function buildTrackDetail(track) {
    return {
      id: trackId(track),
      title: track.label,
      sanctuary: track.sanctuary,
      category: track.category,
      description: track.description || 'No description available from the source catalog.',
      recorded: formatDate(track.recordedAt),
      site: track.site || 'Unknown site',
      deployment: track.deployment || 'Unknown deployment',
      filename: track.filename,
      sourceUrl: track.url,
    };
  }

  function buildVariantGroupsForBrowser(tracks) {
    const groups = new Map();
    tracks.forEach(track => {
      const key = track.groupKey || trackId(track);
      if (!groups.has(key)) groups.set(key, { original: null, enhanced: [] });
      const group = groups.get(key);
      if (track.variant === 'enhanced') {
        group.enhanced.push(track);
      } else if (!group.original) {
        group.original = track;
      } else {
        group.enhanced.push(track);
      }
    });
    return groups;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function projectMapPosition(point, bounds, inset = 18) {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lngRange = bounds.maxLng - bounds.minLng || 1;
    const rawX = ((point.lng - bounds.minLng) / lngRange) * 100;
    const rawY = ((bounds.maxLat - point.lat) / latRange) * 100;
    return {
      x: clamp(rawX, inset, 100 - inset),
      y: clamp(rawY, inset, 100 - inset),
    };
  }

  function conflictsWithPlacedPins(pin, placedPins, minGap) {
    return placedPins.some(placed => (
      Math.abs(pin.x - placed.x) < minGap
      && Math.abs(pin.y - placed.y) < minGap
    ));
  }

  function separateMapPins(pins, minGap = 12) {
    const placedPins = [];
    return pins.map(pin => {
      const positioned = { ...pin };
      const offsets = [0, minGap, -minGap, minGap * 2, -minGap * 2, minGap * 3, -minGap * 3];

      for (const offset of offsets) {
        const candidateX = clamp(pin.x + offset, 18, 82);
        positioned.x = candidateX;
        if (!conflictsWithPlacedPins(positioned, placedPins, minGap)) break;
      }

      placedPins.push(positioned);
      return positioned;
    });
  }

  function buildMapPins(sanctuaries, tracks, activeSanctuary = 'all') {
    const counts = new Map();
    tracks.forEach(track => {
      if (!track.sanctuary) return;
      counts.set(track.sanctuary, (counts.get(track.sanctuary) || 0) + 1);
    });

    const bounds = sanctuaries.reduce((acc, sanctuary) => {
      const [lat, lng] = sanctuary.coordinates || [0, 0];
      return {
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
      };
    }, {
      minLat: 20,
      maxLat: 48,
      minLng: -172,
      maxLng: -70,
    });

    const pins = sanctuaries.map(sanctuary => {
      const [lat, lng] = sanctuary.coordinates || [0, 0];
      const position = projectMapPosition({ lat, lng }, bounds);
      return {
        ...sanctuary,
        lat,
        lng,
        count: counts.get(sanctuary.name) || 0,
        active: activeSanctuary !== 'all' && sanctuary.name === activeSanctuary,
        x: position.x,
        y: position.y,
      };
    });

    return separateMapPins(pins);
  }

  function renderMap() {
    if (!els.mapCanvas || !els.mapSummary) return;
    const currentTrack = state.tracks[state.currentIndex];
    const activeSanctuary = state.sanctuary !== 'all'
      ? state.sanctuary
      : currentTrack && currentTrack.sanctuary
        ? currentTrack.sanctuary
        : 'all';
    const pins = buildMapPins(state.sanctuaries, state.tracks, activeSanctuary);

    els.mapCanvas.innerHTML = '';
    if (!pins.length) {
      els.mapSummary.textContent = 'No sanctuary map metadata available.';
      return;
    }

    pins.forEach(pin => {
      const button = document.createElement('button');
      button.type = 'button';
      const labelPlacement = pin.y > 62 ? ' label-north' : '';
      button.className = `map-pin${labelPlacement}${pin.active ? ' active' : ''}${pin.count ? '' : ' empty'}`;
      button.style.left = `${pin.x}%`;
      button.style.top = `${pin.y}%`;
      button.dataset.sanctuary = pin.name;
      button.setAttribute('aria-pressed', pin.active ? 'true' : 'false');
      button.setAttribute('aria-label', `${pin.name}, ${formatCount(pin.count)}`);
      button.innerHTML = `
        <span class="pin-dot">${pin.count}</span>
        <span class="pin-label">
          <strong>${pin.name}</strong>
          <span>${pin.region} · ${formatCount(pin.count)}</span>
        </span>
      `;
      button.addEventListener('click', () => {
        state.sanctuary = pin.name;
        syncControlsFromState();
        recomputeVisible();
        renderTrackList();
        renderMap();
        syncUrl();
      });
      els.mapCanvas.appendChild(button);
    });

    const activePin = pins.find(pin => pin.active);
    els.mapSummary.textContent = activePin
      ? `${activePin.name}: ${activePin.note} ${formatCount(activePin.count)} in the archive.`
      : `${pins.length} sanctuary listening regions mapped from the current archive.`;
  }

  function renderVariantAlternates(track) {
    const group = state.variantGroups.get(track.groupKey || trackId(track));
    els.detailVariants.innerHTML = '';
    if (!group) return;

    const alternates = [group.original, ...group.enhanced]
      .filter(variant => variant && variant !== track);
    if (!alternates.length) return;

    const label = document.createElement('span');
    label.className = 'variant-list-label';
    label.textContent = 'Alternates';
    els.detailVariants.appendChild(label);

    alternates.forEach(variant => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'variant-button';
      button.textContent = variant.variant === 'enhanced' ? 'Enhanced' : 'Original';
      button.setAttribute('aria-label', `Switch to ${variant.label}`);
      button.addEventListener('click', () => {
        const index = state.tracks.indexOf(variant);
        if (index >= 0) setTrack(index, { autoplay: state.playing });
      });
      els.detailVariants.appendChild(button);
    });
  }

  function renderTrackDetail() {
    const track = state.tracks[state.currentIndex];
    if (!track) return;
    const detail = buildTrackDetail(track);
    const sourceUrl = detail.sourceUrl || mediaUrl(track);

    els.detailTitle.textContent = detail.title;
    els.detailSanctuary.textContent = detail.sanctuary;
    els.detailCategory.textContent = detail.category;
    els.detailRecorded.textContent = detail.recorded;
    els.detailSite.textContent = detail.site;
    els.detailDeployment.textContent = detail.deployment;
    els.detailFilename.textContent = detail.filename;
    els.detailDescription.textContent = detail.description;
    els.detailSourceLink.href = sourceUrl;
    els.detailSourceLink.textContent = sourceUrl;
    renderVariantAlternates(track);
  }

  function openTrackDetail() {
    if (!state.tracks[state.currentIndex]) return;
    renderTrackDetail();
    els.detailPanel.hidden = false;
    els.detailsButton.setAttribute('aria-expanded', 'true');
    els.detailCloseButton.focus();
  }

  function closeTrackDetail() {
    els.detailPanel.hidden = true;
    els.detailsButton.setAttribute('aria-expanded', 'false');
    els.detailsButton.focus();
  }

  function copySourceUrl() {
    const track = state.tracks[state.currentIndex];
    if (!track) return;
    const sourceUrl = mediaUrl(track);
    const clipboard = window.navigator && window.navigator.clipboard;
    if (!clipboard || !clipboard.writeText) {
      els.status.textContent = 'Copy unavailable in this browser.';
      return;
    }
    clipboard.writeText(sourceUrl)
      .then(() => {
        els.status.textContent = 'Source URL copied.';
      })
      .catch(() => {
        els.status.textContent = 'Copy unavailable in this browser.';
      });
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
    if (!els.detailPanel.hidden) renderTrackDetail();
    if (options.sync !== false) syncUrl();
    if (state.activeTab === 'map') renderMap();
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
        syncControlsFromState();
        recomputeVisible();
        renderTrackList();
        if (state.activeTab === 'map') renderMap();
        updateMeta();
        syncUrl();
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
      syncUrl();
    });
    els.detailsButton.addEventListener('click', openTrackDetail);
    els.detailCloseButton.addEventListener('click', closeTrackDetail);
    els.copySourceButton.addEventListener('click', copySourceUrl);
    els.query.addEventListener('input', () => {
      state.query = els.query.value;
      recomputeVisible();
      renderTrackList();
      if (state.activeTab === 'map') renderMap();
      syncUrl();
    });
    els.sanctuarySelect.addEventListener('change', () => {
      state.sanctuary = els.sanctuarySelect.value;
      recomputeVisible();
      renderTrackList();
      if (state.activeTab === 'map') renderMap();
      syncUrl();
    });
    els.sortSelect.addEventListener('change', () => {
      state.sort = els.sortSelect.value;
      recomputeVisible();
      renderTrackList();
      if (state.activeTab === 'map') renderMap();
      syncUrl();
    });
    els.progress.addEventListener('input', () => {
      els.audio.currentTime = Number(els.progress.value);
    });
    els.audio.addEventListener('play', () => setPlayingState(true));
    els.audio.addEventListener('pause', () => setPlayingState(false));
    els.audio.addEventListener('ended', () => navigate(1));
    els.audio.addEventListener('timeupdate', updateProgress);
    els.audio.addEventListener('loadedmetadata', updateProgress);
    if (els.tabs) {
      els.tabs.forEach(tab => {
        tab.addEventListener('click', () => setTab(tab.dataset.tab));
      });
    }
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
      detailsButton: byId('btn-details'),
      detailPanel: byId('track-detail'),
      detailCloseButton: byId('btn-detail-close'),
      detailTitle: byId('detail-title'),
      detailSanctuary: byId('detail-sanctuary'),
      detailCategory: byId('detail-category'),
      detailRecorded: byId('detail-recorded'),
      detailSite: byId('detail-site'),
      detailDeployment: byId('detail-deployment'),
      detailFilename: byId('detail-filename'),
      detailDescription: byId('detail-description'),
      detailSourceLink: byId('detail-source-link'),
      detailVariants: byId('detail-variants'),
      copySourceButton: byId('btn-copy-source'),
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
      mapPanel: byId('map-panel'),
      mapCanvas: byId('map-canvas'),
      mapSummary: byId('map-summary'),
      tabs: document.querySelectorAll('.tab'),
    });
  }

  function init() {
    cacheElements();
    state.tracks = state.catalog.tracks || [];
    state.variantGroups = buildVariantGroupsForBrowser(state.tracks);
    state.order = state.tracks.map((_, index) => index);
    state.visibleIndexes = [...state.order];
    applyRoute(parseRoute(window.location.search));

    Object.entries(SORT_LABELS).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.sortSelect.appendChild(option);
    });

    bindEvents();
    buildFilters();
    syncControlsFromState();
    setTab(state.activeTab, { sync: false });
    recomputeVisible();
    renderTrackList();

    if (state.tracks.length) {
      setTrack(state.currentIndex, { sync: false });
      syncUrl();
    } else {
      els.status.textContent = 'No recordings found. Refresh the catalog with node scripts/catalog.mjs.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
