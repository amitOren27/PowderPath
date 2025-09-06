// js/route/saved_routes_ui.js

/** האם ה-section כבר קיים בדום */
export function isSavedMounted() {
  return !!document.getElementById('saved-routes');
}

/** הסרה נקייה של ה-section */
export function unmountSavedUI() {
  const s = document.getElementById('saved-routes');
  if (s) s.remove();
}

/** יצירה/הבטחה של Section ל-Saved routes והחזרת רפרנסים */
export function mountSavedUI() {
  // יעד עיקרי: להציב מתחת ל-<details id="diff-dropdown"> (מחוץ לפאנל הפנימי)
  const dropdown = document.getElementById('diff-dropdown');
  const panel = document.getElementById('diff-panel');

  // נפילה חכמה: אם אין dropdown נשתמש בטופס, ואז בסיידבר/בודי
  const afterEl =
    dropdown ||
    document.getElementById('route-form') ||
    document.getElementById('sidebar') ||
    document.body;

  let section = document.getElementById('saved-routes');
  if (!section) {
    section = document.createElement('section');
    section.id = 'saved-routes';
    section.className = 'saved';
    section.innerHTML = `
      <div class="saved-header">
        <span class="material-icons" aria-hidden="true">favorite_border</span>
        <span>Saved routes</span>
      </div>
      <ul id="saved-list" class="saved-list" role="listbox" aria-label="Saved routes" aria-live="polite"></ul>
      <div id="saved-empty" class="saved-empty" hidden>No saved routes yet.</div>
    `;
    afterEl.insertAdjacentElement('afterend', section);
  }

  // ודא שה-section לא יוזרק בטעות לתוך ה-panel; אם כן – העבר מיד החוצה
  if (panel && panel.contains(section) && dropdown && dropdown.parentNode) {
    dropdown.insertAdjacentElement('afterend', section);
  }
  // שמירת המיקום גם אם קומפוננטות אחרות משנות את ה-DOM
  if (panel && dropdown && dropdown.parentNode && !section.__pp_mo) {
    const mo = new MutationObserver(() => {
      if (panel.contains(section)) dropdown.insertAdjacentElement('afterend', section);
    });
    mo.observe(panel, { childList: true, subtree: true });
    section.__pp_mo = mo; // guard למניעת ריבוי observers
  }

  const listEl = section.querySelector('#saved-list');
  const emptyEl = section.querySelector('#saved-empty');
  return { section, listEl, emptyEl };
}

/** רינדור הרשימה — מניח שה-section קיים (ה-controller מרכיב/מסיר) */
export function renderSaved(items = []) {
  const section = document.getElementById('saved-routes');
  if (!section) return;

  const listEl = section.querySelector('#saved-list');
  const emptyEl = section.querySelector('#saved-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    // ה-controller בד"כ יסיר כשאין פריטים, אבל נשאיר הודעה אם נקרא ישירות
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'saved-item';
    li.setAttribute('role', 'option');
    li.style.cssText = 'cursor:pointer;'; // מינימום אינליין; עיצוב עיקרי ב-CSS
    li.dataset.id = String(it.id);

    const title = (it.route_name && it.route_name.trim())
      ? it.route_name
      : `${safeName(it.start)} → ${safeName(it.end)}`;

    const left = document.createElement('div');
    left.className = 'names';
    left.textContent = title;

    const right = document.createElement('span');
    right.className = 'material-icons chev';
    right.textContent = 'chevron_right';
    right.setAttribute('aria-hidden', 'true');

    // עטיפה לפי ה-CSS (grid: 1fr auto)
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;';
    row.appendChild(left);
    row.appendChild(right);

    li.appendChild(row);

    // אירוע בחירה: שליחת saved:select עם פרטי המסלול
    if (!li.__pp_bound) {
      li.addEventListener('click', () => {
        const payload = {
          id: it.id,
          user_id: it.user_id,
          route_name: it.route_name,
          start: it.start,
          end: it.end,
          stops: it.stops
        };
        document.dispatchEvent(new CustomEvent('saved:select', { detail: payload }));
      });
      li.__pp_bound = true;
    }

    listEl.appendChild(li);
  }
}

function safeName(p) {
  if (!p) return 'Point';
  return (p.name && String(p.name).trim()) || 'Point';
}
