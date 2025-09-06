// js/route/recent_api.js
import { requireLogin } from '../core/auth.js';
import { RECENT_LOCATIONS_FRONT_URL } from './config.js';

function normRecent(it = {}) {
  const lat = Number(it.lat);
  const lng = Number(it.lng);
  return {
    // משאיר שדות קיימים כפי שהם, ומוסיף נרמול עדין
    ...it,
    id: it.id ?? it._id ?? it.uuid ?? it.pk ?? undefined,
    name: (it.name ?? '').toString(),
    lat: lat,
    lng: lng
  };
}

export async function fetchRecentLocations(limit = 10, opts = {}) {
  const u = await requireLogin();
  const user_id = (typeof u === 'string') ? u : (u?.userId ?? u?.sub ?? u?.id ?? u?.user_id);

  const url = new URL(RECENT_LOCATIONS_FRONT_URL);
  url.searchParams.set('user_id', String(user_id));
  url.searchParams.set('limit', String(limit));

  // Timeout אופציונלי (ברירת מחדל 10s), בלי לשנות חתימה קיימת
  const ac = new AbortController();
  const timeoutMs = Number(opts?.timeoutMs ?? 10000);
  const to = timeoutMs > 0
    ? setTimeout(() => {
      try {
        const e = typeof DOMException !== 'undefined'
          ? new DOMException('Timeout', 'AbortError')
          : Object.assign(new Error('Timeout'), { name: 'AbortError' });
        ac.abort(e);
      } catch { ac.abort(); }
    }, timeoutMs)
    : null;

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: ac.signal
    });
    if (!res.ok) {
      // שומר הודעת שגיאה קריאה
      let msg = `fetchRecentLocations failed: ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }

    const data = await res.json().catch(() => ({}));
    // תמיכה גם במקרה שה־API מחזיר מערך ישירות ולא { items: [] }
    const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    return arr.map(normRecent).filter(it =>
      Number.isFinite(it.lat) && Number.isFinite(it.lng)
    ); // מסנן רשומות ללא קואורדינטות תקינות
  } finally {
    if (to) clearTimeout(to);
  }
}
