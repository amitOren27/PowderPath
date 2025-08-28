
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
  return Array.isArray(data?.items) ? data.items : [];
}

export async function saveRoute({ start, end, route_name } = {}) {
  const u = await requireLogin();
  const user_id = (typeof u === 'string') ? u : (u?.userId ?? u?.sub ?? u?.id ?? u?.user_id);

  if (!start || !end) throw new Error('start and end are required');

  const body = { user_id, start, end };
  if (route_name) body.route_name = route_name;

  const res = await fetch(SAVED_ROUTES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || 'Failed to save route';
    throw new Error(msg);
  }
  return data;
}
