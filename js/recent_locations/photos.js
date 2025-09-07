
import { MAX_CONCURRENCY } from '../route/config.js';

/* Wraps PlacesService.findPlaceFromQuery in a Promise. */
function findPlaceByText(placesSvc, { query, lat, lng, radius = 500 }) {
  return new Promise((resolve, reject) => {
    const req = {
      query,
      fields: ['photos', 'place_id', 'name', 'geometry'],
      // Location bias helps return the right place for common names
      locationBias: (Number.isFinite(lat) && Number.isFinite(lng))
        ? { center: { lat, lng }, radius }
        : undefined
    };
    placesSvc.findPlaceFromQuery(req, (res, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && res && res.length) {
        resolve(res);
      } else {
        resolve([]); // treat as empty, not an error
      }
    });
  });
}

/** Wraps PlacesService.nearbySearch in a Promise (fallback when name has no photo). */
function nearbyWithPhotos(placesSvc, { lat, lng, radius = 300 }) {
  return new Promise((resolve) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return resolve([]);
    placesSvc.nearbySearch(
      {
        location: { lat, lng },
        radius,
        type: ['point_of_interest']
      },
      (res, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && res && res.length) {
          resolve(res);
        } else {
          resolve([]);
        }
      }
    );
  });
}

/** Picks the best photo URL (if any) from a Places result item. */
function firstPhotoUrl(place, { maxWidth = 640, maxHeight = 360 } = {}) {
  try {
    const ph = place?.photos?.[0];
    return ph ? ph.getUrl({ maxWidth, maxHeight }) : null;
  } catch {
    return null;
  }
}

/**
 * Enriches recent items with `photoUrl` using the provided PlacesService.
 * items: [{ name, lat, lng, ... }]
 * returns a NEW array with the same objects plus { photoUrl } (or null).
 */
export async function enrichRecentWithPhotos(items = [], placesSvc) {
  if (!Array.isArray(items) || !items.length || !placesSvc) return items;

  // small concurrency to keep UI snappy & respect quota
  const queue = items.map((it, idx) => ({ it, idx }));
  const out = items.map(x => ({ ...x, photoUrl: null }));

  async function worker() {
    while (queue.length) {
      const { it, idx } = queue.shift();

      // Strategy:
      // 1) Try findPlaceFromQuery with name (biased near its lat/lng).
      // 2) If no photo, try nearbySearch around lat/lng and pick first with photo.
      let url = null;

      if (it.name) {
        try {
          const res = await findPlaceByText(placesSvc, { query: it.name, lat: it.lat, lng: it.lng });
          url = firstPhotoUrl(res[0]) || null;
        } catch {}
      }

      if (!url) {
        try {
          const res2 = await nearbyWithPhotos(placesSvc, { lat: it.lat, lng: it.lng });
          const withPhoto = res2.find(p => p?.photos?.length);
          url = firstPhotoUrl(withPhoto) || null;
        } catch {}
      }

      out[idx] = { ...out[idx], photoUrl: url };
    }
  }

  const runners = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, worker);
  await Promise.all(runners);
  return out;
}
