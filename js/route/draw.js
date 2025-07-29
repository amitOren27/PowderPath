
import { routeSegment } from './api.js';

let mapRef = null;
let polylines = [];

/**
 * Initialize with the Google Map instance created in entry.js.
 * Call this once during bootstrap.
 */
export function init(map) {
  mapRef = map;
}

/** Remove any existing polylines from the map. */
export function clear() {
  for (const pl of polylines) pl.setMap(null);
  polylines = [];
}

/**
 * Render the route as segments between consecutive *selected* stops.
 * Empty pills are ignored, order is preserved.
 *
 * @param {{stops: Array<{place?: google.maps.places.PlaceResult|null}>}} route
 */
export async function update(route) {
  if (!mapRef) return;

  // 1) Collect only the filled stops (have geometry), in visual order
  const filled = route.stops
    .map(s => s?.place?.geometry?.location)
    .filter(Boolean)               // keep only defined locations
    .map(loc => loc.toJSON());     // LatLngLiteral {lat, lng}

  // Need at least two to draw anything
  if (filled.length < 2) {
    clear();
    return;
  }

  // 2) Build segments between consecutive filled stops only
  //    (Origin→Int1, Int1→Int3, Int3→Destination if Int2 is empty)
  const segmentPromises = [];
  for (let i = 0; i < filled.length - 1; i++) {
    segmentPromises.push(routeSegment(filled[i], filled[i + 1]));
  }

  // Resolve in order; each result has { path: LatLngLiteral[] }
  let results = [];
  try {
    results = await Promise.all(segmentPromises);
  } catch (err) {
    // If any segment fails, clear overlays for now.
    clear();
    return;
  }

  const segments = results
    .map(r => Array.isArray(r?.path) ? r.path : [])
    .filter(path => path.length >= 2);

  // 3) Draw and fit
  drawSegments(segments);
  fitToSegments(segments);
}

/** Create one polyline per segment with a consistent style. */
function drawSegments(segments) {
  clear();

  for (const path of segments) {
    const pl = new google.maps.Polyline({
      map: mapRef,
      path,
      strokeColor: '#1a73e8',
      strokeOpacity: 1.0,
      strokeWeight: 2,
      geodesic: true,
      zIndex: 10
    });
    polylines.push(pl);
  }
}

/** Fit bounds to the union of all segment points, with padding. */
function fitToSegments(segments) {
  if (!segments.length) return;

  const bounds = new google.maps.LatLngBounds();
  for (const path of segments) {
    for (const p of path) bounds.extend(p);
  }

  // Adjust padding to your UI (bottom nav, sidebar)
  const padding = { top: 20, left: 20, right: 20, bottom: 80 };
  mapRef.fitBounds(bounds, padding);
}