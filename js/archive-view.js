import {
  CATEGORY_LABELS,
  SORT_LABELS,
  buildTrackDetail,
  formatCount,
  formatDate,
  trackId,
} from '../app-core.mjs';

import {
  categoryList,
  currentAudioArtifact,
  currentTrack,
  recomputeVisible,
  sanctuaryList,
} from './app-state.js';

import { syncUrl } from './routes.js';

function mediaUrl(state, track) {
  if (!track) return '';
  return track.url || `${state.catalog.baseUrl || ''}${track.filename || ''}`;
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  return Number.isFinite(seconds) ? formatTime(seconds) : 'Preview only';
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function populateOptions(select, options, labelFor) {
  if (!select) return;
  select.innerHTML = '';
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labelFor(value);
    select.appendChild(option);
  });
}

function updateSelectedTrack(state, els, track) {
  if (!track) return;
  setText(els.sanctuary, track.sanctuary || 'Unknown sanctuary');
  setText(els.category, CATEGORY_LABELS[track.category] || track.category || 'Unknown category');
  setText(els.label, track.label || 'Untitled recording');
  setText(els.description, track.description || 'No description available from the source catalog.');
  setText(els.date, formatDate(track.recordedAt));
  setText(els.site, track.site || 'Unknown site');
  setText(els.filename, track.filename || 'Unknown file');
  renderWaveform(state, els, track);
}

export function updateMeta(state, els) {
  const generated = state.catalog.generatedAt ? formatDate(state.catalog.generatedAt) : 'Unknown';
  setText(els.catalogMeta, `${formatCount(state.tracks.length)} from NOAA SanctSound · catalog refreshed ${generated}`);
  setText(els.archiveNote, state.catalog.archiveNote || 'NOAA SanctSound is a historical passive acoustic archive. These clips are recordings from the 2018-2021/2022 project period, not realtime audio.');
  setText(els.resultCount, formatCount(state.visibleIndexes.length));
}

export function renderWaveform(state, els, track) {
  if (!els.waveform) return;
  const artifact = track ? currentAudioArtifact(state, track) : null;
  const peaks = artifact?.waveformPeaks || [];
  const fallback = Array.from({ length: 32 }, (_, index) => (
    0.12 + Math.sin((index / 31) * Math.PI) * 0.42
  ));
  const values = peaks.length ? peaks : fallback;

  els.waveform.innerHTML = '';
  values.forEach(value => {
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.style.height = `${Math.max(4, Math.round(Number(value) * 34))}px`;
    els.waveform.appendChild(bar);
  });
  els.waveform.setAttribute(
    'aria-label',
    artifact ? `Waveform preview generated ${formatDate(state.audioArtifacts.generatedAt)}` : 'Generated waveform preview',
  );
}

export function renderVariantAlternates(state, els, actions, track) {
  if (!els.detailVariants || !track) return;
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
      if (index >= 0) actions.setTrack(index, { autoplay: state.playing, history: 'pushState' });
    });
    els.detailVariants.appendChild(button);
  });
}

export function renderTrackDetail(state, els, actions) {
  const track = currentTrack(state);
  if (!track) return;

  updateSelectedTrack(state, els, track);

  const detail = buildTrackDetail(track);
  const sourceUrl = detail.sourceUrl || mediaUrl(state, track);
  const artifact = currentAudioArtifact(state, track);
  const profile = artifact?.acousticProfile;

  setText(els.detailTitle, detail.title);
  setText(els.detailSanctuary, detail.sanctuary);
  setText(els.detailCategory, detail.category);
  setText(els.detailRecorded, detail.recorded);
  setText(els.detailSite, detail.site);
  setText(els.detailDeployment, detail.deployment);
  setText(els.detailDuration, formatDuration(profile?.durationSeconds));
  setText(
    els.detailProfile,
    profile
      ? `${artifact.analysisStatus === 'analyzed' ? 'Analyzed' : 'Preview'} · ${profile.recordedYear || 'unknown year'} · ${profile.variant || 'original'}`
      : 'Catalog metadata',
  );
  setText(els.detailFilename, detail.filename);
  setText(els.detailDescription, detail.description);
  if (els.detailSourceLink) {
    els.detailSourceLink.href = sourceUrl;
    els.detailSourceLink.textContent = sourceUrl;
  }
  renderVariantAlternates(state, els, actions, track);
}

export function openTrackDetail(els) {
  if (!els.detailPanel) return;
  els.detailPanel.hidden = false;
  if (els.detailsButton) els.detailsButton.setAttribute('aria-expanded', 'true');
  if (els.detailCloseButton) els.detailCloseButton.focus();
}

export function closeTrackDetail(els) {
  if (els.detailPanel) els.detailPanel.hidden = true;
  if (els.detailsButton) {
    els.detailsButton.setAttribute('aria-expanded', 'false');
    els.detailsButton.focus();
  }
}

export function copySourceUrl(state, els) {
  const track = currentTrack(state);
  if (!track) return;
  const sourceUrl = mediaUrl(state, track);
  const clipboard = window.navigator && window.navigator.clipboard;
  if (!clipboard || !clipboard.writeText) {
    setText(els.status, 'Copy unavailable in this browser.');
    return;
  }
  clipboard.writeText(sourceUrl)
    .then(() => {
      setText(els.status, 'Source URL copied.');
    })
    .catch(() => {
      setText(els.status, 'Copy unavailable in this browser.');
    });
}

export function buildFilters(state, els, actions) {
  if (els.categoryBar) {
    els.categoryBar.innerHTML = '';
    categoryList(state).forEach(category => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chip${category === state.category ? ' on' : ''}`;
      button.textContent = CATEGORY_LABELS[category] || category;
      button.setAttribute('aria-pressed', category === state.category ? 'true' : 'false');
      button.addEventListener('click', () => {
        state.category = category;
        recomputeVisible(state);
        syncUrl(state, 'pushState');
        actions.renderAll();
      });
      els.categoryBar.appendChild(button);
    });
  }

  populateOptions(
    els.sanctuarySelect,
    sanctuaryList(state),
    sanctuary => (sanctuary === 'all' ? 'All sanctuaries' : sanctuary),
  );

  populateOptions(
    els.sortSelect,
    Object.keys(SORT_LABELS),
    sort => SORT_LABELS[sort] || sort,
  );

  if (els.sanctuarySelect) els.sanctuarySelect.value = state.sanctuary;
  if (els.sortSelect) els.sortSelect.value = state.sort;
}

export function renderTrackList(state, els, actions) {
  if (!els.trackList) return;
  els.trackList.innerHTML = '';
  if (els.emptyState) els.emptyState.hidden = state.visibleIndexes.length > 0;

  const grouped = new Map();
  state.visibleIndexes.forEach(index => {
    const track = state.tracks[index];
    const groupName = state.sort === 'sanctuary' || state.sanctuary === 'all'
      ? track.sanctuary
      : CATEGORY_LABELS[track.category] || track.category;
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
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      const row = document.createElement('button');
      row.className = `trow${index === state.currentIndex ? ' now' : ''}`;
      row.dataset.index = String(index);
      row.dataset.trackIndex = String(index);
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
        actions.setTrack(index, { autoplay: true, history: 'pushState' });
      });
      row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        actions.setTrack(index, { autoplay: true, history: 'pushState' });
      });
      item.appendChild(row);
      els.trackList.appendChild(item);
    });
  });
}

export function highlightCurrent(_state, els) {
  const root = els.trackList || document;
  root.querySelectorAll('.trow').forEach(row => {
    row.classList.toggle('now', Number(row.dataset.index) === _state.currentIndex);
  });
}

export function syncControlsFromState(state, els) {
  if (els.query) els.query.value = state.query;
  if (els.sanctuarySelect) els.sanctuarySelect.value = state.sanctuary;
  if (els.sortSelect) els.sortSelect.value = state.sort;
  if (els.mapCategoryFilter) els.mapCategoryFilter.value = state.category;
  if (els.mapYearFilter) els.mapYearFilter.value = state.selectedYear;

  if (els.tabs) {
    els.tabs.forEach(tab => {
      const active = tab.dataset.tab === state.activeTab;
      tab.classList.toggle('on', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });
  }
  if (els.archivePanel) els.archivePanel.hidden = state.activeTab !== 'archive';
  if (els.mapPanel) els.mapPanel.hidden = state.activeTab !== 'map';
  if (els.livePanel) els.livePanel.hidden = state.activeTab !== 'live';
  if (els.spectrogramPanel) els.spectrogramPanel.hidden = state.activeTab !== 'spectrogram';
}
