// js/route/saved_ui.js

/** בודק אם הסקשן קיים בדום */
export function isSavedMounted() {
  return !!document.getElementById('saved-routes');
}

/** מסיר את הסקשן מהדום (אם קיים) */
export function unmountSavedUI() {
  const s = document.getElementById('saved-routes');
  if (s) s.remove();
}

/** יוצר/מבטיח שיש Section של Saved routes ומחזיר רפרנסים */
export function mountSavedUI() {
  const afterEl =
    document.getElementById('diff-dropdown') ||
    document.getElementById('route-form') ||
    document.getElementById('sidebar') ||
    document.body;

  let section = document.getElementById('saved-routes');
  if (!section) {
    section = document.createElement('section');
    section.id = 'saved-routes';
    section.className = 'saved';
    section.innerHTML = `
      <div class="saved-header" style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <span class="material-icons" aria-hidden="true">favorite_border</span>
        <span>Saved routes</span>
      </div>
      <ul id="saved-list" class="saved-list" aria-live="polite" style="margin:0;padding:0;list-style:none;"></ul>
      <div id="saved-empty" class="saved-empty" hidden>No saved routes yet.</div>
    `;
    afterEl.insertAdjacentElement('afterend', section);
  }

  const listEl = section.querySelector('#saved-list');
  const emptyEl = section.querySelector('#saved-empty');
  return { section, listEl, emptyEl };
}

/** רינדור הרשימה — מניח שהסקשן כבר קיים (ה-Controller אחראי להרכיב/להסיר) */
export function renderSaved(items = []) {
  const section = document.getElementById('saved-routes');
  if (!section) return; // אין סקשן → לא מרנדרים

  const listEl = section.querySelector('#saved-list');
  const emptyEl = section.querySelector('#saved-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    // בדרישה החדשה: לא משאירים סקשן ריק; ה-Controller ידאג להסרה.
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const it of items) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:8px 0;border-bottom:1px solid #f1f3f4;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;';
    li.dataset.id = String(it.id);

    const title = (it.route_name && it.route_name.trim())
      ? it.route_name
      : `${safeName(it.start)} → ${safeName(it.end)}`;

    // ----- רק שורת שם (בלי קואורדינטות) -----
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
    const nameEl = document.createElement('div');
    nameEl.textContent = title;
    nameEl.style.cssText = 'font-size:14px;color:#202124;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    left.appendChild(nameEl);
    // -----------------------------------------

    const right = document.createElement('span');
    right.className = 'material-icons';
    right.textContent = 'chevron_right';
    right.setAttribute('aria-hidden', 'true');

    li.appendChild(left);
    li.appendChild(right);

    li.addEventListener('click', () => {
      const payload = {
        id: it.id,
        user_id: it.user_id,
        route_name: it.route_name,
        start: it.start,
        end: it.end
      };
      document.dispatchEvent(new CustomEvent('saved:select', { detail: payload }));
    });

    listEl.appendChild(li);
  }

}

function safeName(p) {
  if (!p) return 'Point';
  return (p.name && String(p.name).trim()) || 'Point';
}

function fmtPoint(p) {
  if (!p) return '';
  const lat = Number(p.lat).toFixed(4);
  const lng = Number(p.lng).toFixed(4);
  const nm = (p.name && String(p.name).trim()) || '';
  return nm ? `${nm} (${lat}, ${lng})` : `(${lat}, ${lng})`;
}
