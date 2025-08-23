
import { emit } from '../core/events.js';
import { attachAutocomplete } from '../places/autocomplete.js';
import { getColorByDifficulty } from '../map/common/draw.js';
import {
  getRoute, addStopBeforeDestination, removeStopAt,
  swapEnds, setPlaceAt, setAllowedDifficulties
} from './state.js';

let stackEl, swapBtn, addBtn;

export function initRouteUI() {
  stackEl = document.querySelector('.pill-stack');
  swapBtn = document.getElementById('swap-btn');
  addBtn = document.getElementById('add-stop-btn');

  // Static buttons
  swapBtn?.addEventListener('click', onSwapClick);
  addBtn?.addEventListener('click', addStopBeforeDestination);

  // Attach AC to origin/destination once
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('destination-input');

  attachAutocomplete(originInput, {
    onPlace: p => {
      originInput.value = formatPlaceText(p);  // keep text visible
      setPlaceAt(0, p);
      emit('route:placeSelected', { place: p });
    }
  });

  attachAutocomplete(destInput, {
    onPlace: p => {
      destInput.value = formatPlaceText(p);    // keep text visible
      // destination index can change when stops are added; compute at click time
      setPlaceAt(getRoute().stops.length - 1, p);
      emit('route:placeSelected', { place: p });
    }
  });

  render(); // initial DOM sync

  // Wire difficulties dropdown
  const dropdown = document.getElementById('diff-dropdown');
  const panel = document.getElementById('diff-panel');
  const resetBtn = document.getElementById('diff-reset');
  const boxes = panel?.querySelectorAll('input[type="checkbox"][name="difficulty"]') || [];

  const apply = () => {
    const allowed = [...boxes].filter(b => b.checked).map(b => b.value);
    setAllowedDifficulties(allowed); // triggers route:changed
  };
  boxes.forEach(b => b.addEventListener('change', (e) => {
    // Count after this toggle (the event has already flipped the checkbox)
    const selected = [...boxes].filter(x => x.checked);
    if (selected.length === 0) {
      // Prevent deselecting the last remaining difficulty
      e.target.checked = true;
      return; // don't call apply()
    }
    apply();
  }));
  resetBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    boxes.forEach(b => b.checked = true);
    apply();
  });

  apply(); // initial sync (all selected)
}

function formatPlaceText(place) {
  if (!place) return '';
  return place.name || place.formatted_address || place.vicinity || '';
}

function onSwapClick() {
  const origin = document.getElementById('origin-input');
  const dest = document.getElementById('destination-input');

  // Swap the visible text values
  [origin.value, dest.value] = [dest.value, origin.value];

  // Swap the stored places in the route model
  swapEnds();

  // Recenter the swap arrow (and keep separators correct)
  positionOverlays();
}

/** Rebuild intermediate rows, toggle swap, rebuild separators, and position overlays */
export function render() {
  // Remove existing intermediate rows
  stackEl.querySelectorAll('.stop-row.intermediate').forEach(el => el.remove());

  const model = getRoute();
  const destEl = stackEl.querySelector('.stop-row.destination');

  // Insert intermediates (indices 1..length-2)
  for (let i = 1; i < model.stops.length - 1; i++) {
    const row = document.createElement('div');
    row.className = 'stop-row intermediate';
    row.innerHTML = `
      <span class="stop-icon material-icons">stop_circle</span>
      <input type="text" class="stop-input" placeholder="Intermediate stop" />
      <button type="button" class="delete-stop" aria-label="Remove stop">
        <span class="material-icons">close</span>
      </button>
    `;
    destEl.before(row);

    const input = row.querySelector('.stop-input');

    // Attach AC
    attachAutocomplete(input, {
      onPlace: p => {
        input.value = formatPlaceText(p);  // keep text visible immediately
        setPlaceAt(i, p);
      }
    });

    // hydrate from state if this stop already has a place
    const storedPlace = model.stops[i]?.place;
    if (storedPlace) {
      input.value = formatPlaceText(storedPlace);
      input.title = input.value;
    }

    row.querySelector('.delete-stop').addEventListener('click', () => removeStopAt(i));
  }

  // Toggle swap button (visible only when no intermediates)
  const hasIntermediates = model.stops.length > 2;
  if (swapBtn) swapBtn.style.display = hasIntermediates ? 'none' : 'block';

  // Rebuild separators: one between each adjacent pair of visible rows
  stackEl.querySelectorAll('.stop-separator').forEach(el => el.remove());
  const rows = [...stackEl.querySelectorAll('.stop-row')];
  for (let i = 0; i < rows.length - 1; i++) {
    const sep = document.createElement('div');
    sep.className = 'stop-separator';
    sep.innerHTML = '<span class="material-icons">more_vert</span>';
    stackEl.appendChild(sep);
  }

  positionOverlays();
}

/** Center each separator between its pair; center swap arrow if visible */
export function positionOverlays() {
  const rows = [...stackEl.querySelectorAll('.stop-row')];
  const seps = [...stackEl.querySelectorAll('.stop-separator')];

  for (let i = 0; i < seps.length; i++) {
    const above = rows[i];
    const below = rows[i + 1];
    const sep = seps[i];
    const mid = (above.offsetTop + above.offsetHeight + below.offsetTop) / 2;
    sep.style.top = (mid - sep.offsetHeight / 2) + 'px';
  }

  // Center swap arrow when it's shown (no intermediates)
  if (rows.length === 2 && document.getElementById('swap-btn')?.style.display !== 'none') {
    const [origin, dest] = rows;
    const mid = (origin.offsetTop + origin.offsetHeight + dest.offsetTop) / 2;
    const btn = document.getElementById('swap-btn');
    btn.style.top = (mid - btn.offsetHeight / 2) + 'px';
  }
}

// ─────────────────────────────────────────────────────────────
// Recent places (UI) – shows only if there are items
// ─────────────────────────────────────────────────────────────
let recentSection, recentListEl;

export function mountRecentUI(opts = {}) {
  if (recentSection) return recentSection;

  recentSection = document.createElement('section');
  recentSection.id = 'recent-section';
  recentSection.className = 'recent hidden';
  recentSection.innerHTML = `
    <div class="recent-header">
      <span class="material-icons">schedule</span>
      <span class="recent-title">Recent places</span>
    </div>
    <ul class="recent-list" role="listbox" aria-label="Recent places"></ul>
  `;
  recentListEl = recentSection.querySelector('.recent-list');

  const insertAfter = (ref, node) => ref.parentNode.insertBefore(node, ref.nextSibling);
  const q = sel => document.querySelector(sel);
  const resolveEl = (x) => typeof x === 'string' ? q(x) : x;

  const dropdown = document.getElementById('diff-dropdown'); // <details …>
  const panel = document.getElementById('diff-panel');       // התוכן הפנימי של הלשונית

  // 1) אם הועבר anchor מפורש או קיים #recent-root – נעדיף אותו
  let target = resolveEl(opts.anchor) || document.getElementById('recent-root');
  if (target && target.parentNode) {
    insertAfter(target, recentSection);
  } else if (dropdown && dropdown.parentNode) {
    // 2) ברירת מחדל: להציב אחרי <details id="diff-dropdown"> (מחוץ לפאנל)
    insertAfter(dropdown, recentSection);
  } else {
    // 3) גיבוי: סוף הטופס
    (document.getElementById('route-form') || document.body).appendChild(recentSection);
  }

  // מאבטח: אם איכשהו נכנסנו לתוך הפאנל – מוציאים החוצה מתחת ל-<details>
  if (panel && panel.contains(recentSection) && dropdown && dropdown.parentNode) {
    insertAfter(dropdown, recentSection);
  }

  // ונשמור שזה לא יקרה שוב (אם קומפוננטה אחרת תנסה להזריק פנימה)
  if (panel && dropdown && dropdown.parentNode) {
    const mo = new MutationObserver(() => {
      if (panel.contains(recentSection)) insertAfter(dropdown, recentSection);
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  return recentSection;
}

export function renderRecent(items = []) {
  mountRecentUI();

  if (!items.length) {
    recentSection?.classList.add('hidden');
    if (recentListEl) recentListEl.innerHTML = '';
    return;
  }

  recentSection.classList.remove('hidden');
  recentListEl.innerHTML = items.map(toItemHTML).join('');

  // העשרה בדירוג ותמונה "אמיתית" (רצים לאחר הרנדר; מתחילים מתמונת Static)
  enrichVisibleWithPlaces();

  // קליקים על פריטים ממלאים את הפיל הפנוי הבא
  recentListEl.querySelectorAll('.recent-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-name') || 'Unnamed';
      const lat = parseFloat(el.getAttribute('data-lat'));
      const lng = parseFloat(el.getAttribute('data-lng'));

      const place = { name, geometry: { location: new google.maps.LatLng(lat, lng) } };

      const route = getRoute();
      let idx = route.stops.findIndex(s => !s.place);
      if (idx === -1) idx = route.stops.length - 1;

      setPlaceAt(idx, place);
      emit('route:placeSelected', { place });
    });
  });
}

function toItemHTML(it) {
  const safe = escapeHTML(it.name || 'Unnamed');
  const thumb = staticThumb(it.lat, it.lng);
  return `
    <li class="recent-item" data-name="${safe}" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="recent-main">
        <div class="recent-name" title="${safe}">${safe}</div>
        <div class="recent-meta">
          <span class="stars" data-rating=""></span>
          <span class="count" data-count=""></span>
        </div>
      </div>
      ${thumb
      ? `<img class="recent-thumb" src="${thumb}" alt="" loading="lazy">`
      : `<span class="material-icons recent-icon">history</span>`
    }
    </li>
  `;
}

function escapeHTML(s = '') {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Thumbs (Static Maps) ──
function getMapsApiKey() {
  const s = Array.from(document.scripts).find(sc => sc.src.includes('maps.googleapis.com/maps/api/js'));
  if (!s) return '';
  try { return new URL(s.src).searchParams.get('key') || ''; }
  catch { return ''; }
}
const _STATIC_KEY = getMapsApiKey();

function staticThumb(lat, lng) {
  if (!_STATIC_KEY) return '';
  const p = `${lat},${lng}`;
  return `https://maps.googleapis.com/maps/api/staticmap?key=${_STATIC_KEY}&center=${p}&zoom=16&size=80x80&scale=2&maptype=terrain&markers=color:0x4285F4|${p}`;
}

// ── Ratings enrichment (lazy) ──
let _placesSvc;
function placesSvc() {
  if (_placesSvc) return _placesSvc;
  _placesSvc = new google.maps.places.PlacesService(document.createElement('div'));
  return _placesSvc;
}
function enrichVisibleWithPlaces() {
  const els = Array.from(recentListEl.querySelectorAll('.recent-item'));
  els.forEach((el) => {
    const name = el.getAttribute('data-name');
    const lat = parseFloat(el.getAttribute('data-lat'));
    const lng = parseFloat(el.getAttribute('data-lng'));
    textSearchForDetails(name, lat, lng).then(d => {
      if (!d) return;
      const starsEl = el.querySelector('.stars');
      const countEl = el.querySelector('.count');
      if (starsEl) starsEl.innerHTML = renderStars(d.rating || 0);
      if (countEl) countEl.textContent = d.user_ratings_total ? `(${d.user_ratings_total})` : '';
      // אם נמצאה תמונת Places – נעדיף אותה על ה-Static
      if (d.photo && el.querySelector('.recent-thumb')) {
        el.querySelector('.recent-thumb').src = d.photo;
      }
    }).catch(() => { });
  });
}

function textSearchForDetails(name, lat, lng) {
  return new Promise((resolve) => {
    const svc = placesSvc();
    const req = {
      query: name,
      location: new google.maps.LatLng(lat, lng),
      radius: 800
    };
    svc.textSearch(req, (results, status) => {
      if (!results || status !== google.maps.places.PlacesServiceStatus.OK) return resolve(null);
      const best = results[0];
      resolve({
        rating: best.rating,
        user_ratings_total: best.user_ratings_total,
        photo: best.photos && best.photos[0] ? best.photos[0].getUrl({ maxWidth: 160, maxHeight: 160 }) : null
      });
    });
  });
}

function renderStars(r) {
  const n = Math.max(0, Math.min(5, r || 0));
  const full = Math.floor(n);
  const half = (n - full) >= 0.25 && (n - full) < 0.75 ? 1 : 0;
  const empty = 5 - full - half;
  return [
    ...Array(full).fill('<span class="material-icons star">star</span>'),
    ...Array(half).fill('<span class="material-icons star">star_half</span>'),
    ...Array(empty).fill('<span class="material-icons star">star_border</span>')
  ].join('');
}
