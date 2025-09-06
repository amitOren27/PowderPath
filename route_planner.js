/* global google */

// ───────── State ─────────
let map;
let geocoder;
let originAC, destinationAC;
let startMarker = null;
let destMarker = null;

const acOptions = {
  fields: ['place_id', 'geometry', 'name', 'formatted_address'],
};

// ───────── Init ─────────
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 },
    zoom: 13,
    mapId: 'POWDERPATH_BASE',
    mapTypeId: 'terrain',
    clickableIcons: true,
  });

  geocoder = new google.maps.Geocoder();

  initAutocomplete();
  initUIEvents();
  wireMapClicks();          // תוספת עדינה – קליקים על המפה ממלאים שדות
  updateStopsUI();          // לבנות מפרידים ולמקם את החץ בהתחלה
}

function initAutocomplete() {
  originAC = new google.maps.places.Autocomplete(
    document.getElementById('origin-input'),
    acOptions
  );
  destinationAC = new google.maps.places.Autocomplete(
    document.getElementById('destination-input'),
    acOptions
  );
}

function attachAutocomplete(inputEl) {
  new google.maps.places.Autocomplete(inputEl, acOptions);
}

function initUIEvents() {
  document.getElementById('swap-btn')?.addEventListener('click', swapOriginDestination);
  document.getElementById('add-stop-btn')?.addEventListener('click', addStopRow);
  window.addEventListener('resize', updateStopsUI);
}

// ───────── UI actions (כמו בקודם) ─────────
function swapOriginDestination() {
  const a = document.getElementById('origin-input');
  const b = document.getElementById('destination-input');
  [a.value, b.value] = [b.value, a.value];
  updateStopsUI(); // מיקום חץ/מפרידים
}

function addStopRow() {
  const stack = document.querySelector('.pill-stack');
  const destinationRow = stack.querySelector('.stop-row.destination');

  const row = document.createElement('div');
  row.className = 'stop-row intermediate';
  row.innerHTML = `
    <span class="stop-icon material-icons">stop_circle</span>
    <input type="text" class="stop-input" placeholder="Intermediate stop" />
    <button type="button" class="delete-stop" aria-label="Remove stop">
      <span class="material-icons">close</span>
    </button>
  `;
  stack.insertBefore(row, destinationRow);
  attachAutocomplete(row.querySelector('.stop-input'));

  row.querySelector('.delete-stop').addEventListener('click', () => {
    row.remove();
    updateAddStopLabel();
    updateStopsUI();
  });

  updateAddStopLabel();
  updateStopsUI();
}

function updateAddStopLabel() {
  const label = document.getElementById('add-stop-label');
  const count = document.querySelectorAll('.pill-stack .stop-row.intermediate').length;
  if (label) label.textContent = count > 0 ? 'Add destination' : 'Add stop';
}

/**
 * בונה מפרידים מנוקדים, מציג/מסתיר את כפתור ה־swap, וממקם הכל
 */
function updateStopsUI() {
  const stack = document.querySelector('.pill-stack');
  const swapBtn = document.getElementById('swap-btn');
  if (!stack) return;

  // הסרת מפרידים קיימים
  stack.querySelectorAll('.stop-separator').forEach(el => el.remove());

  const stops = Array.from(stack.querySelectorAll('.stop-row'));
  const hasIntermediate = stack.querySelectorAll('.stop-row.intermediate').length > 0;

  // הצגת/הסתרת swap
  if (swapBtn) swapBtn.style.display = hasIntermediate ? 'none' : 'block';

  // יצירת מפריד לכל זוג סמוך
  for (let i = 0; i < stops.length - 1; i++) {
    const sep = document.createElement('div');
    sep.className = 'stop-separator';
    sep.innerHTML = '<span class="material-icons">more_vert</span>';
    stack.appendChild(sep);
  }

  // מיקום בפועל
  positionOverlayElements();
}

function positionOverlayElements() {
  const stack = document.querySelector('.pill-stack');
  if (!stack) return;

  const stops = Array.from(stack.querySelectorAll('.stop-row'));
  const separators = Array.from(stack.querySelectorAll('.stop-separator'));
  const swapBtn = document.getElementById('swap-btn');

  // מיקום כל מפריד בין הזוג שלו
  for (let i = 0; i < separators.length; i++) {
    const above = stops[i];
    const below = stops[i + 1];
    const sep = separators[i];
    const aboveBottom = above.offsetTop + above.offsetHeight;
    const belowTop = below.offsetTop;
    const mid = (aboveBottom + belowTop) / 2;
    sep.style.top = (mid - sep.offsetHeight / 2) + 'px';
  }

  // מיקום חץ ההחלפה רק אם מוצג (ולא קיימות תחנות ביניים)
  if (swapBtn && swapBtn.style.display !== 'none' && stops.length === 2) {
    const origin = stops[0];
    const dest = stops[1];
    const originBottom = origin.offsetTop + origin.offsetHeight;
    const destTop = dest.offsetTop;
    const mid = (originBottom + destTop) / 2;
    swapBtn.style.top = (mid - swapBtn.offsetHeight / 2) + 'px';
  }
}

// ───────── הוספת התמיכה מהגרסה החדשה: קליק על המפה ממלא שדות ─────────
function wireMapClicks() {
  if (!map) return;
  map.addListener('click', (e) => {
    if (e?.latLng) handleMapClick(e.latLng);
  });
}

function placeMarker(type, position) {
  const label = type === 'start' ? 'A' : 'B';
  const z = type === 'start' ? 20 : 19;

  // AdvancedMarkerElement אם זמין
  if (google.maps.marker?.AdvancedMarkerElement) {
    const pinEl = document.createElement('div');
    pinEl.style.cssText = `
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:50%;
      background:#1a73e8;color:#fff;font-weight:600;font-family:Arial,sans-serif;
    `;
    pinEl.textContent = label;

    const adv = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: pinEl,
      zIndex: z,
    });

    if (type === 'start') {
      if (startMarker) startMarker.map = null;
      startMarker = adv;
    } else {
      if (destMarker) destMarker.map = null;
      destMarker = adv;
    }
  } else {
    // נפילה למרקר רגיל
    const m = new google.maps.Marker({
      map,
      position,
      zIndex: z,
      label: { text: label, color: '#fff', fontWeight: '600' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#1a73e8',
        fillOpacity: 1,
        strokeColor: '#1a73e8',
        strokeOpacity: 1,
      },
    });
    if (type === 'start') {
      if (startMarker) startMarker.setMap(null);
      startMarker = m;
    } else {
      if (destMarker) destMarker.setMap(null);
      destMarker = m;
    }
  }
}

function reverseGeocode(latLng) {
  return new Promise((resolve) => {
    if (!geocoder) geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === 'OK' && results?.length) {
        resolve(results[0].formatted_address);
      } else {
        resolve(null);
      }
    });
  });
}

function formatLatLng(latLng) {
  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function setInputValue(id, text) {
  const el = document.getElementById(id);
  if (el) el.value = text || '';
}

async function handleMapClick(latLng) {
  // לוגיקה: אם אין A → הגדר A; אחרת אם אין B → הגדר B; אחרת תמיד עדכן B
  const target = !startMarker ? 'start' : (!destMarker ? 'dest' : 'dest');

  placeMarker(target, latLng);

  const addr = await reverseGeocode(latLng).catch(() => null);
  const text = addr || formatLatLng(latLng);

  if (target === 'start') {
    setInputValue('origin-input', text);       // ← התאמה ל-IDs המקוריים
    map.panTo(latLng);
    map.setZoom(Math.max(map.getZoom(), 14));
  } else {
    setInputValue('destination-input', text);  // ← התאמה ל-IDs המקוריים

    // לאחר שיש A+B נתאים גבולות
    const bounds = new google.maps.LatLngBounds();
    if (startMarker?.position) bounds.extend(startMarker.position);
    if (destMarker?.position) bounds.extend(destMarker.position);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 80);
    } else {
      map.panTo(latLng);
    }
  }
}

// Google callback
window.initMap = initMap;
