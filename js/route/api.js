
import { ROUTE_URL } from './config.js';

// GeoJSON [lon, lat] -> {lat, lng}
function toLatLng([lon, lat]) {
  return { lat, lng: lon };
}

// GeoJSON [lat, lng] -> {lat, lng}
function toLatLngLiteral([lat, lng]) {
  return { lat: lat, lng: lng };
}

/** Read response once and return status + text + parsed JSON if possible. */
async function readResponse(resp) {
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: resp.ok, status: resp.status, text, json };
}

/** Normalize Lambda envelope into { route: [...] } or return null. */
function normalizeRoutePayload(payload) {
  if (!payload) return null;
  if (Array.isArray(payload.route)) return payload;
  if (typeof payload.body === 'string') {
    try {
      const inner = JSON.parse(payload.body);
      if (Array.isArray(inner?.route)) return inner;
    } catch {}
  }
  return null;
}

/**
 * Request a single leg. Never throws: on any error or empty route,
 * returns a dashed-line fallback between start and end.
 */
export async function fetchLeg(start, end, signal) {
  try {
    const resp = await fetch(ROUTE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Lambda expects [lat, lon]
        start: [start.lat, start.lng],
        end:   [end.lat,   end.lng]
      }),
      signal
    });

    const { ok, status, text, json } = await readResponse(resp);

    if (!ok) {
      // Likely no CORS headers on error -> body not exposed. Log what we can.
      const msg =
        (json && (json.error || (typeof json.body === 'string' && json.body))) ||
        text || `HTTP ${status}`;
      console.error('[route] leg HTTP error:', status, String(msg).slice(0, 300));
      return { path: [], segments: [], fallback: { start, end } };
    }

    const normalized = normalizeRoutePayload(json);
    if (!normalized) {
      console.error('[route] unexpected payload:', json ?? text);
      return { path: [], segments: [], fallback: { start, end } };
    }

    const snapped_start = normalized.snapped_start;
    const snapped_end   = normalized.snapped_end;

    const segments = [];
    const flattened = [];

    for (const seg of normalized.route) {
      const geom = seg?.geometry;
      if (!geom || !geom.type || !geom.coordinates) continue;

      const difficulty = seg?.difficulty ?? null;
      const name       = seg?.name ?? null;

      if (geom.type === 'LineString') {
        const ll = geom.coordinates.map(toLatLng);
        segments.push({ name, difficulty, path: ll });
        flattened.push(...ll);
      } else if (geom.type === 'MultiLineString') {
        for (const part of geom.coordinates) {
          const ll = part.map(toLatLng);
          segments.push({ name, difficulty, path: ll });
          flattened.push(...ll);
        }
      }
    }

    if (!flattened.length) {
      // 200 but no usable path: draw dashed straight
      return { path: [], segments: [], fallback: { start, end } };
    }

    return { path: flattened, segments, fallback: null, snapped_start, snapped_end };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { path: [], segments: [], fallback: null };
    }
    console.error('[route] leg fetch error:', err);
    return { path: [], segments: [], fallback: { start, end } };
  }
}

/**
 * Multi-leg sequencing: origin -> (stops...) -> destination
 * Skips empty pills; preserves order.
 * Returns merged path + merged segments + per-leg fallbacks.
 */
export async function fetchMultiLeg(stopsInOrder, signal) {
  if (!stopsInOrder || stopsInOrder.length < 2) {
    return { path: [], legs: [], fallbacks: [] };
  }

  const legs = [];
  const fallbacks = [];
  const allSegments = [];

  for (let i = 0; i < stopsInOrder.length - 1; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const a = stopsInOrder[i];
    const b = stopsInOrder[i + 1];
    const leg = await fetchLeg(a, b, signal);
    legs.push(leg);
    if (leg.fallback) fallbacks.push(leg.fallback);
    allSegments.push(...leg.segments);
  }

  const merged = [];
  for (const leg of legs) merged.push(...leg.path);

  // Build walking hints for every leg
  const walking = legs.map((leg, i) => ({
  // user stop i  -> leg.snapped_start
    toSnap:   { origin: stopsInOrder[i], destination: toLatLngLiteral(leg.snapped_start) },
    // leg.snapped_end -> user stop i+1
    fromSnap: { origin: toLatLngLiteral(leg.snapped_end), destination: stopsInOrder[i + 1] }
  }));

  console.log(walking);

  return { path: merged, segments: allSegments, fallbacks, walking };
}