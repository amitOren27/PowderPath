
import { ROUTE_CANDIDATES_URL, ROUTE_OPTIMIZE_URL, MAX_CONCURRENCY } from './config.js';
import { getWalkingPath, getWalkingConnectors } from './walking.js';

/** Small helper: sum great-circle meters for a path [] of {lat,lng}. */
function metersOfPath(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = new google.maps.LatLng(path[i - 1].lat, path[i - 1].lng);
    const b = new google.maps.LatLng(path[i].lat,     path[i].lng);
    total += google.maps.geometry.spherical.computeDistanceBetween(a, b);
  }
  return total;
}

/** Convert GeoJSON [lon,lat] coords to LatLngLiteral[] */
function gjToLatLngs(coords) {
  return coords.map(([lon, lat]) => ({ lat, lng: lon }));
}

/** Convert list of GeoJSON Line/MultiLine segments into {name,difficulty,path[]} segments */
function normalizeRouteSegments(segments = []) {
  const out = [];
  for (const seg of segments) {
    const geom = seg?.geometry;
    if (!geom?.type || !geom?.coordinates) continue;
    const base = { name: seg?.name ?? null, difficulty: seg?.difficulty ?? null };
    if (geom.type === 'LineString') {
      out.push({ ...base, path: gjToLatLngs(geom.coordinates) });
    } else if (geom.type === 'MultiLineString') {
      for (const part of geom.coordinates) out.push({ ...base, path: gjToLatLngs(part) });
    }
  }
  return out;
}

/**
 * Smart route:
 *  1) fetch K candidates per stop,
 *  2) compute walk-in meters per (stop,cand) using Routes API + connectors,
 *  3) call optimizer to pick the best chain,
 *  4) return drawables: {segments, path, walkingPaths, connectorPaths}
 */
export async function fetchSmartRoute(stopsInOrder, signal, {
  k = 3,
  allowedDifficulties = null,
  weights = { w_walk: 3.0, w_route: 1.0 }
} = {}) {
  if (!Array.isArray(stopsInOrder) || stopsInOrder.length < 2) {
    return { path: [], segments: [], fallbacks: [], walkingPaths: [], connectorPaths: [] };
  }

  // 1) candidates
  const candResp = await fetch(ROUTE_CANDIDATES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stops: stopsInOrder.map(ll => [ll.lat, ll.lng]), k }),
    signal
  });
  if (!candResp.ok) throw new Error(`candidates HTTP ${candResp.status}`);
  const candPayload = await candResp.json();
  const layers = candPayload?.candidates;
  if (!Array.isArray(layers) || layers.length !== stopsInOrder.length) {
    throw new Error('candidates payload malformed');
  }

  // 2) walk-in per (stop, candidate)
  // cache: map key "i:id" -> { path, connectors, meters }
  const walkCache = new Map();

  const jobs = [];

  for (let i = 0; i < layers.length; i++) {
    const stop = stopsInOrder[i];
    for (const c of layers[i]) {
      const key = `${i}:${c.id}`;
      jobs.push(async () => {
        try {
          const dest = { lat: c.lat, lng: c.lon ?? c.lng };
          const path = await getWalkingPath(stop, dest, signal);             // road/trail portion
          const conns = getWalkingConnectors(stop, dest, path, 0);           // offroad stubs
          let meters = metersOfPath(path);
          for (const pair of conns) {
            meters += google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(pair[0].lat, pair[0].lng),
              new google.maps.LatLng(pair[1].lat, pair[1].lng)
            );
          }
          walkCache.set(key, { path, connectors: conns, meters });
        } catch {
          walkCache.set(key, { path: [], connectors: [], meters: Number.POSITIVE_INFINITY });
        }
      });
    }
  }

  // Run with concurrency limit
  const runners = Array.from({ length: MAX_CONCURRENCY }, async () => {
    while (jobs.length) {
      const job = jobs.shift();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await job();
    }
  });
  await Promise.all(runners);

  // Build optimizer candidates with walk_in_m
  const optCandidates = layers.map((layer, i) =>
    layer.map(c => {
      const key = `${i}:${c.id}`;
      const item = walkCache.get(key);
      const walk_in_m = (item && Number.isFinite(item.meters)) ? item.meters : 1e12; // effectively disallow if failed
      return { id: c.id, lat: c.lat, lon: c.lon ?? c.lng, walk_in_m };
    })
  );

  // 3) optimize
  const optResp = await fetch(ROUTE_OPTIMIZE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      candidates: optCandidates,
      allowed: Array.isArray(allowedDifficulties) ? allowedDifficulties : undefined,
      weights
    }),
    signal
  });

  if (!optResp.ok) throw new Error(`optimize HTTP ${optResp.status}`);

  const opt = await optResp.json();
  const segments = normalizeRouteSegments(opt?.route || []);
  const path = segments.flatMap(s => s.path || []);

  // 4) pick walking overlays for the chosen snaps
  const walkingPaths = [];
  const connectorPaths = [];
  const snapped = Array.isArray(opt?.snapped) ? opt.snapped : [];
  for (let i = 0; i < snapped.length; i++) {
    const c = snapped[i];
    if (!c) continue;
    const key = `${i}:${c.id}`;
    const cached = walkCache.get(key);
    if (cached?.path?.length > 1) walkingPaths.push(cached.path);
    if (Array.isArray(cached?.connectors) && cached.connectors.length) {
      connectorPaths.push(...cached.connectors);
    }
  }

  const legsArr = Array.isArray(opt?.legs) ? opt.legs : [];
  for (let i = 1; i < layers.length; i++) {
    const legPrev = legsArr[i - 1];
    if (!legPrev || !Number.isInteger(legPrev.to_idx)) continue;

    const arrIdx = legPrev.to_idx;
    const arrCand = layers[i]?.[arrIdx];
    if (!arrCand) continue;

    // If snapped[i] already equals the arrival candidate, we already drew it.
    const depCandId = snapped?.[i]?.id;
    if (depCandId === arrCand.id) continue;

    const key = `${i}:${arrCand.id}`;
    const cached = walkCache.get(key);
    if (cached?.path?.length > 1) walkingPaths.push(cached.path);
    if (Array.isArray(cached?.connectors) && cached.connectors.length) {
        connectorPaths.push(...cached.connectors);
    }
  }

  return { path, segments, fallbacks: [], walkingPaths, connectorPaths };
}
