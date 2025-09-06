// js/route/recent_locations.js
import { RECENT_LOCATIONS_URL } from './config.js';

// מצפה לקבל user_id מבחוץ (מה-entry), ושולח ללמבדא
// opts אופציונלי: { timeoutMs?: number, signal?: AbortSignal }
export async function saveRecentLocation({ user_id, name, lat, lng }, opts = {}) {
  if (!user_id && user_id !== 0) {
    throw new Error('recent save failed: missing user_id');
  }
  const _lat = Number(lat);
  const _lng = Number(lng);
  if (!Number.isFinite(_lat) || !Number.isFinite(_lng)) {
    throw new Error('recent save failed: invalid lat/lng');
  }

  const payload = {
    user_id: String(user_id),
    name: (name ?? '').toString().trim(),
    lat: _lat,
    lng: _lng
  };

  // Timeout אופציונלי (ברירת מחדל 8s) + תמיכה ב-signal חיצוני
  const ac = new AbortController();
  const timeoutMs = Number(opts?.timeoutMs ?? 8000);
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

  // שרשור ביטולים אם הועבר signal חיצוני
  if (opts?.signal) {
    if (opts.signal.aborted) ac.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', () => ac.abort(opts.signal.reason), { once: true });
  }

  try {
    const res = await fetch(RECENT_LOCATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal
    });

    if (!res.ok) {
      // ננסה להוציא הודעת שגיאה קריאה
      let msg = `recent save failed: ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = `recent save failed: ${j.error}`;
      } catch {
        try {
          const t = await res.text();
          if (t) msg = `recent save failed: ${res.status} ${t}`;
        } catch { /* ignore */ }
      }
      throw new Error(msg);
    }

    // חוזר בדיוק כמו קודם (JSON מהשרת), עם גיבוי לאובייקט ריק
    return await res.json().catch(() => ({}));
  } finally {
    if (to) clearTimeout(to);
  }
}
