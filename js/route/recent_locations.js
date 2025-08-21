
import { RECENT_LOCATIONS_URL } from './config.js';

// מצפה לקבל user_id מבחוץ (מה-entry), ושולח ללמבדא
export async function saveRecentLocation({ user_id, name, lat, lng }) {
  const res = await fetch(RECENT_LOCATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, name, lat, lng }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`recent save failed: ${res.status} ${t}`);
  }
  return res.json();
}
