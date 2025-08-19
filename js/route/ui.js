
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
  addBtn  = document.getElementById('add-stop-btn');

  // Static buttons
  swapBtn?.addEventListener('click', onSwapClick);
  addBtn?.addEventListener('click', addStopBeforeDestination);

  // Attach AC to origin/destination once
  const originInput = document.getElementById('origin-input');
  const destInput   = document.getElementById('destination-input');

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
  const dropdown   = document.getElementById('diff-dropdown');
  const panel      = document.getElementById('diff-panel');
  const resetBtn   = document.getElementById('diff-reset');
  const boxes      = panel?.querySelectorAll('input[type="checkbox"][name="difficulty"]') || [];

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
  const dest   = document.getElementById('destination-input');

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
    attachAutocomplete(input, { onPlace: p => {
      input.value = formatPlaceText(p);  // keep text visible immediately
      setPlaceAt(i, p);
    }});

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
    const sep   = seps[i];
    const mid   = (above.offsetTop + above.offsetHeight + below.offsetTop) / 2;
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