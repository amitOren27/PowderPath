// js/route/saved_routes.js
import { fetchSavedRoutes } from './saved_api.js';
import { mountSavedUI, renderSaved, unmountSavedUI, isSavedMounted } from './saved_routes_ui.js';

// ─── Global flags to avoid double init ───
if (!window.__pp_flags) window.__pp_flags = {};

let _state = {
  items: [],
  isLoading: false,
  lastError: null
};

// sequence counter to ignore stale async responses
let _loadSeq = 0;

function setLoading(on) {
  _state.isLoading = on;
  const section = document.getElementById('saved-routes');
  // מציגים "Loading…" רק אם הסקשן כבר קיים (לא נרצה ליצור סקשן לצורך ספינר בלבד)
  if (!section) return;

  let spinner = section.querySelector('.saved-loading');
  if (on) {
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.className = 'saved-loading';
      spinner.textContent = 'Loading…';
      spinner.style.cssText = 'font-size:12px;color:#5f6368;margin:6px 0;';
      const list = section.querySelector('#saved-list');
      section.insertBefore(spinner, list || section.firstChild);
    }
  } else {
    spinner?.remove();
  }
}

async function loadItems(limit = 20) {
  const mySeq = ++_loadSeq;    // mark this request as the newest
  setLoading(true);
  try {
    const items = await fetchSavedRoutes(limit);
    // if a newer request started meanwhile, ignore this result
    if (mySeq !== _loadSeq) return null;

    _state.items = items;
    _state.lastError = null;
    return items;
  } catch (err) {
    if (mySeq !== _loadSeq) return null; // stale error, ignore
    _state.lastError = err;
    console.error('[saved] load failed:', err);
    return [];
  } finally {
    if (mySeq === _loadSeq) setLoading(false);
  }
}

/** טעינה ראשונית: רק אם יש פריטים – נרכיב UI; אחרת לא נראה כלום */
export async function initSavedRoutes({ limit = 20 } = {}) {
  if (window.__pp_flags.savedRoutes_inited) return;
  window.__pp_flags.savedRoutes_inited = true;

  const items = await loadItems(limit);
  if (!items) return; // stale call ignored

  if (items.length > 0) {
    mountSavedUI();         // should be idempotent in UI layer
    renderSaved(items);
  } else {
    // ודא שלא נשאר סקשן ישן
    if (isSavedMounted()) unmountSavedUI();
  }
}

/** רענון לאחר שמירה: אם נוצר פריט ראשון – נרכיב; אם התרוקן – נסיר */
export async function refreshSavedRoutes({ limit = 20 } = {}) {
  const items = await loadItems(limit);
  if (!items) return; // stale call ignored

  if (items.length > 0) {
    if (!isSavedMounted()) mountSavedUI();
    renderSaved(items);
  } else {
    if (isSavedMounted()) unmountSavedUI();
  }
}

/** עוזר לדיבאוג */
export function getSavedState() {
  return { ..._state, items: [..._state.items] };
}
