/* global google */
let map;
let originAutocomplete, destinationAutocomplete;

function initMap() {
  // Basic map centred roughly on Val Thorens for now
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.580 },
    zoom: 13,
    mapId: 'POWDERPATH_BASE', // optional custom map style
  });

  initAutocomplete();
  initUIEvents();
}

/* ---------- Places Autocomplete on the two mandatory inputs ---------- */
function initAutocomplete() {
  const originInput = document.getElementById('origin-input');
  const destInput   = document.getElementById('destination-input');

  const opts = {
    fields: ['place_id', 'geometry', 'name', 'formatted_address'],
  };

  originAutocomplete      = new google.maps.places.Autocomplete(originInput, opts);
  destinationAutocomplete = new google.maps.places.Autocomplete(destInput, opts);

  // In later stages we'll read the geometry here and call routing
}

/* ---------- Basic UI wiring (collapse, swap, add stop) ---------- */
function initUIEvents() {
  /* panel collapse on mobile */
  const sidebar   = document.getElementById('sidebar');
  const collapseB = document.getElementById('collapse-btn');
  collapseB.addEventListener('click', () => sidebar.classList.add('collapsed'));

  // Tap map to reopen panel on mobile
  map.addListener('click', () => {
    if (window.innerWidth <= 768) sidebar.classList.remove('collapsed');
  });

  /* swap origin ↔︎ destination */
  document.getElementById('swap-btn').addEventListener('click', () => {
    const originVal = document.getElementById('origin-input').value;
    const destVal   = document.getElementById('destination-input').value;
    document.getElementById('origin-input').value = destVal;
    document.getElementById('destination-input').value = originVal;
  });

  /* add stop (placeholder div – drag/sort comes in Stage 3) */
  document.getElementById('add-stop-btn').addEventListener('click', addStopRow);
}

let stopCount = 0;
function addStopRow() {
  stopCount += 1;

  const container = document.getElementById('stops-container');
  const row = document.createElement('div');
  row.className   = 'stop-row';
  row.dataset.index = stopCount;

  row.innerHTML = `
    <input type="text" class="stop-input" placeholder="Intermediate stop" />
    <button type="button" class="delete-stop" title="Remove">✕</button>
  `;
  container.appendChild(row);

  // simple remove handler
  row.querySelector('.delete-stop').addEventListener('click', () => row.remove());

  // Stage 2 +: plug each new input into Autocomplete as well
}

function positionSwapArrow() {
  const stack  = document.querySelector('.pill-stack');
  const origin = stack.querySelector('.stop-row.origin');
  const dest   = stack.querySelector('.stop-row.destination');
  const arrow  = document.getElementById('swap-btn');
  if (!origin || !dest || !arrow) return;

  const originBottom = origin.offsetTop + origin.offsetHeight;
  const destTop      = dest.offsetTop;
  const mid          = (originBottom + destTop) / 2;          // middle between pills

  arrow.style.top = (mid - (arrow.offsetHeight / 2) + 2) + 'px';
}
window.addEventListener('load', positionSwapArrow);
window.addEventListener('resize', positionSwapArrow);

