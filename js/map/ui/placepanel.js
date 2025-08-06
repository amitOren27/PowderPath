let root; // the panel element

export function open(place) {
  ensureRoot();
  root.innerHTML = render(place);
  root.classList.add('open');
  root.querySelector('.place-panel-close')?.addEventListener('click', close);
  // Notify listeners (home/route pages can react)
  window.dispatchEvent(new CustomEvent('placepanel:opened', { detail: { place } }));
}

export function close() {
  ensureRoot();
  root.classList.remove('open');
  // Notify listeners (clear markers, etc.)
  window.dispatchEvent(new CustomEvent('placepanel:closed'));
}

function ensureRoot() {
  if (root) return;
  root = document.getElementById('place-panel');
  if (!root) {
    root = document.createElement('aside');
    root.id = 'place-panel';
    document.body.appendChild(root);
  }
}

function render(place) {
  const name  = esc(place.name || 'Place');
  const addr  = esc(place.formatted_address || place.vicinity || '');
  const photoUrl = readPhoto(place);

  const { ratingHtml } = buildRating(place);
  const priceHtml      = buildPriceLevel(place);
  const { typeIcon, typeLabel } = primaryType(place.types || []);
  const { statusHtml, weekHtml } = buildHoursBlock(place);

  return `
    ${photoUrl ? `
      <div class="place-hero">
        <img src="${photoUrl}" alt="${name} photo">
      </div>
    ` : ''}

    <header class="place-panel-header">
      <h2>${name}</h2>
      <button class="place-panel-close" aria-label="Close">
        <span class="material-icons">close</span>
      </button>
    </header>

    <div class="place-meta">
      ${ratingHtml || ''}
      ${priceHtml ? `<span class="dot">•</span>${priceHtml}` : ''}
      ${typeLabel ? `<span class="dot">•</span>
        <span class="type"><span class="material-icons">${typeIcon}</span>${esc(typeLabel)}</span>` : ''}
    </div>

    <div class="place-panel-body">

      ${addr ? `
        <div class="place-section">
          <div class="place-panel-row">
            <span class="material-icons" aria-hidden="true">place</span>
            <span>${addr}</span>
          </div>
        </div>
      ` : ''}

      ${(statusHtml || weekHtml) ? `
        <div class="place-section">
          <div class="place-panel-row">
            <span class="material-icons" aria-hidden="true">schedule</span>
            <span>${statusHtml || ''}</span>
          </div>
          ${weekHtml || ''}
        </div>
      ` : ''}

      ${place.international_phone_number ? `
        <div class="place-section">
          <div class="place-panel-row">
            <span class="material-icons" aria-hidden="true">call</span>
            <span>${esc(place.international_phone_number)}</span>
          </div>
        </div>
      ` : ''}

      ${(place.website || place.url) ? `
        <div class="place-section">
          <div class="place-panel-links">
            ${place.website ? `<a href="${esc(place.website)}" target="_blank" rel="noopener">Website</a>` : ''}
            ${place.url ? `<a href="${esc(place.url)}" target="_blank" rel="noopener">Open in Google Maps</a>` : ''}
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

function readPhoto(place) {
  if (place?.photos?.length) {
    return place.photos[0].getUrl({ maxWidth: 960, maxHeight: 540 });
  }
  return null;
}

function buildRating(place) {
  const rating = typeof place.rating === 'number' ? place.rating.toFixed(1) : null;
  const total  = place.user_ratings_total || 0;
  if (!rating) return { ratingHtml: '' };

  const star = `<span class="material-icons star" aria-hidden="true">star_rate</span>`;
  const totalHtml = total ? `<span class="muted">(${total})</span>` : '';
  return { ratingHtml: `<span class="rating">${star}<strong>${rating}</strong> ${totalHtml}</span>` };
}

function buildPriceLevel(place) {
  if (typeof place.price_level !== 'number') return '';
  const n = place.price_level;
  const symbols = '$'.repeat(Math.max(1, n + 1));
  const labels  = ['Free', 'Inexpensive', 'Moderate', 'Expensive', 'Very expensive'];
  const label   = labels[n] || '';
  return `<span class="price" title="${esc(label)}">${symbols}</span>`;
}

function primaryType(types) {
  if (!types || !types.length) return { typeIcon: 'place', typeLabel: '' };
  const map = {
    bar: 'local_bar',
    cafe: 'local_cafe',
    restaurant: 'restaurant',
    lodging: 'hotel',
    park: 'park',
    museum: 'museum',
    ski_resort: 'downhill_skiing',
    tourist_attraction: 'attractions',
    store: 'store',
    supermarket: 'local_grocery_store',
    bakery: 'bakery',
    pharmacy: 'local_pharmacy'
  };

  const known = types.find(t => map[t]);
  const icon  = known ? map[known] : 'place';
  const label = known ? pretty(known) : pretty(types[0]);
  return { typeIcon: icon, typeLabel: label };
}

function buildHoursBlock(place) {
  const oh = place.current_opening_hours || place.opening_hours;
  if (!oh) return { statusHtml: '', weekHtml: '' };

  // Status
  let openNow = false;
  try {
    if (typeof oh.isOpen === 'function') openNow = oh.isOpen();
    else if (typeof oh.open_now === 'boolean') openNow = oh.open_now;
  } catch (_) {}

  const statusHtml = openNow
    ? `<span class="open">Open</span>`
    : `<span class="closed">Closed</span>`;

  // Full week list (weekday_text comes localized, usually Mon..Sun)
  const weekdayText = Array.isArray(oh.weekday_text) ? oh.weekday_text.slice() : [];
  let weekHtml = '';
  if (weekdayText.length) {
    const todayIdx = new Date().getDay(); // 0=Sun..6=Sat
    // Normalize order to Sun..Sat to match getDay(); if it seems Mon..Sun we’ll rotate
    const looksMonFirst = weekdayText[0]?.toLowerCase().startsWith('mon');
    const normalized = looksMonFirst ? rotateMonFirstToSunFirst(weekdayText) : weekdayText;

    weekHtml = `
      <ul class="hours-list">
        ${normalized.map((line, i) => {
          // split "Sunday: 9AM–10PM" into label + value
          const [label, ...rest] = line.split(':');
          const val = rest.join(':').trim() || '—';
          const isToday = i === todayIdx;
          return `<li class="${isToday ? 'today' : ''}">
            <span class="hours-day">${esc(label)}</span>
            <span class="hours-val">${esc(val)}</span>
          </li>`;
        }).join('')}
      </ul>
    `;
  }

  return { statusHtml, weekHtml };
}

function rotateMonFirstToSunFirst(arr) {
  // ["Monday: …", …, "Sunday: …"] → ["Sunday: …", "Monday: …", …, "Saturday: …"]
  const idx = arr.findIndex(s => s.toLowerCase().startsWith('sun'));
  if (idx === -1) return arr; // give up, show as-is
  return arr.slice(idx).concat(arr.slice(0, idx));
}

function pretty(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function esc(str) {
  return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
