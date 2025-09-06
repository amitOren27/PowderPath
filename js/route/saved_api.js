// js/route/saved_api.js
import { SAVED_ROUTES_FRONT_URL, SAVED_ROUTES_URL } from './config.js';
import { requireLogin } from '../core/auth.js';

export async function fetchSavedRoutes(limit = 20) {
  const u = await requireLogin();
  const user_id = (typeof u === 'string') ? u : (u?.userId ?? u?.sub ?? u?.id ?? u?.user_id);

  const url = new URL(SAVED_ROUTES_FRONT_URL);
  url.searchParams.set('user_id', String(user_id));
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    let msg = 'Failed to fetch saved routes';
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { }
    throw new Error(msg);
  }
  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data?.items) ? data.items : [];
  // תאימות לאחור: אם אין stops, נבנה [start,end]
  return items.map(it => ({
    ...it,
    stops: Array.isArray(it.stops) && it.stops.length >= 2 ? it.stops : [it.start, it.end],
  }));
}

export async function saveRoute({ stops, route_name } = {}) {
  const u = await requireLogin();
  const user_id = (typeof u === 'string') ? u : (u?.userId ?? u?.sub ?? u?.id ?? u?.user_id);

  if (!Array.isArray(stops) || stops.length < 2) {
    throw new Error('stops must include at least start and end');
  }

  // תאימות לאחור: נשלח גם start/end בלחיצה — למקרה שהלמבדה הישנה רצה
  const start = stops[0];
  const end = stops[stops.length - 1];

  const body = { user_id, stops, start, end };
  if (route_name) body.route_name = route_name;

  const res = await fetch(SAVED_ROUTES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data = {};
  try { data = await res.json(); } catch { }

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `Failed to save route (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data; // {ok, id, exists, route_name}
}