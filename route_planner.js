/* global google */
let map;
let originAC, destinationAC;

const acOptions = {
  fields: ['place_id', 'geometry', 'name', 'formatted_address'],
};

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 },
    zoom: 13,
    mapId: 'POWDERPATH_BASE'
  });

  initAutocomplete();
  initUIEvents();
  updateStopsUI(); // build initial separator + arrow position
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
  document.getElementById('swap-btn').addEventListener('click', swapOriginDestination);
  document.getElementById('add-stop-btn').addEventListener('click', addStopRow);
  window.addEventListener('resize', updateStopsUI);
}

function swapOriginDestination() {
  const a = document.getElementById('origin-input');
  const b = document.getElementById('destination-input');
  [a.value, b.value] = [b.value, a.value];
  updateStopsUI(); // reposition arrow/separator
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
  label.textContent = count > 0 ? 'Add destination' : 'Add stop';
}

/**
 * Build dotted separators between each adjacent pair of stops.
 * Show/hide swap button. Position separators & arrow.
 */
function updateStopsUI() {
  const stack = document.querySelector('.pill-stack');
  const swapBtn = document.getElementById('swap-btn');

  // Remove existing separators
  stack.querySelectorAll('.stop-separator').forEach(el => el.remove());

  const stops = Array.from(stack.querySelectorAll('.stop-row'));
  const hasIntermediate = stack.querySelectorAll('.stop-row.intermediate').length > 0;

  // Toggle swap button
  swapBtn.style.display = hasIntermediate ? 'none' : 'block';

  // Create separators for each adjacent pair
  for (let i = 0; i < stops.length - 1; i++) {
    const sep = document.createElement('div');
    sep.className = 'stop-separator';
    sep.innerHTML = '<span class="material-icons">more_vert</span>';
    stack.appendChild(sep);
  }

  // Position separators & arrow after they exist in DOM
  positionOverlayElements();
}

function positionOverlayElements() {
  const stack = document.querySelector('.pill-stack');
  const stops = Array.from(stack.querySelectorAll('.stop-row'));
  const separators = Array.from(stack.querySelectorAll('.stop-separator'));
  const swapBtn = document.getElementById('swap-btn');

  // Position each separator between its pair
  for (let i = 0; i < separators.length; i++) {
    const above = stops[i];
    const below = stops[i + 1];
    const sep = separators[i];
    const aboveBottom = above.offsetTop + above.offsetHeight;
    const belowTop = below.offsetTop;
    const mid = (aboveBottom + belowTop) / 2;
    sep.style.top = (mid - sep.offsetHeight / 2) + 'px';
  }

  // Position arrow only if visible (no intermediates)
  if (swapBtn.style.display !== 'none' && stops.length === 2) {
    const origin = stops[0];
    const dest = stops[1];
    const originBottom = origin.offsetTop + origin.offsetHeight;
    const destTop = dest.offsetTop;
    const mid = (originBottom + destTop) / 2;
    swapBtn.style.top = (mid - swapBtn.offsetHeight / 2) + 'px';
  }
}

window.initMap = initMap;
