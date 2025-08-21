// js/route/recent_api.js
import { requireLogin } from '../core/auth.js';
import { RECENT_LOCATIONS_FRONT_URL } from './config.js';

export async function fetchRecentLocations(limit = 5) {
  const userId = await requireLogin();
  const url = `${RECENT_LOCATIONS_FRONT_URL}?user_id=${encodeURIComponent(userId)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`fetchRecentLocations failed: ${res.status} ${t}`);
  }
  const { items } = await res.json();
  return items;
}
