import { buildLiveSourceCards, formatDate } from '../app-core.mjs';

const LIVE_SOURCE_NOTE = 'Live and near-live sources are separate from the historical NOAA SanctSound archive. Availability, latency, and playback support depend on the source.';

function appendLiveMeta(parent, label, value) {
  if (!parent || value === undefined || value === null || value === '') return;
  const item = document.createElement('span');
  item.textContent = `${label}: ${value}`;
  parent.appendChild(item);
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (_error) {
    return '';
  }
}

export function renderLiveSources(state, els) {
  if (!els.liveGrid) return;

  const note = els.livePanel?.querySelector('.live-note');
  if (note) note.textContent = LIVE_SOURCE_NOTE;

  els.liveGrid.innerHTML = '';
  const cards = buildLiveSourceCards(state.liveSources);
  if (!cards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No live or near-live sources are configured.';
    els.liveGrid.appendChild(empty);
    return;
  }

  cards.forEach(cardSource => {
    const originalSource = state.liveSources.find(source => source.id === cardSource.id) || {};
    const source = { ...originalSource, ...cardSource };
    const card = document.createElement('article');
    card.className = `live-card ${source.playable ? 'playable' : 'check-only'}`;

    const header = document.createElement('div');
    header.className = 'live-card-head';

    const title = document.createElement('h3');
    title.textContent = source.name;
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = `live-status ${source.status}`;
    status.textContent = source.statusLabel || source.status;
    if (source.statusDetail) status.title = source.statusDetail;
    header.appendChild(status);
    card.appendChild(header);

    const description = document.createElement('p');
    description.className = 'live-desc';
    description.textContent = source.description || 'No description available.';
    card.appendChild(description);

    const meta = document.createElement('div');
    meta.className = 'live-meta';
    appendLiveMeta(meta, 'Latency', source.latency);
    appendLiveMeta(meta, 'Location', source.location);
    if (source.checkedAt) appendLiveMeta(meta, 'Checked', formatDate(source.checkedAt));
    if (source.statusCode !== undefined) appendLiveMeta(meta, 'HTTP', source.statusCode);
    appendLiveMeta(meta, 'Status', source.statusDetail);
    card.appendChild(meta);

    const safeUrl = safeHttpUrl(source.url || source.pageUrl);
    if (safeUrl) {
      const link = document.createElement('a');
      link.className = 'ctrl live-link';
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = source.actionLabel;
      card.appendChild(link);
    } else {
      const disabled = document.createElement('span');
      disabled.className = 'ctrl live-link disabled';
      disabled.setAttribute('aria-disabled', 'true');
      disabled.textContent = source.actionLabel || 'Source unavailable';
      card.appendChild(disabled);
    }

    els.liveGrid.appendChild(card);
  });
}
