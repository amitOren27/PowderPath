
import { getColorByDifficulty, makeOutlinedCircle, makePistePolyline, makeLiftPolyline } from '../map/common/draw.js';

let map = null;

/** Overlays we manage */
let pistePolylines = [];   // solid colored segments by difficulty
let liftOverlays   = [];   // dotted purple segments (like aerialways)
let fallbackPolylines = []; // dashed straight-line fallbacks
let walkingPolylines = [];  // dashed grey walking legs
let walkingConnectorPolylines = [];

/**
 * Initialize with the Google Map instance created in entry.js.
 * Called once during bootstrap.
 */
export function init(m) {
  map = m;
}

/** Remove any existing lines from the map. */
export function clearRoute() {
  for (const pl of pistePolylines) if (pl) pl.setMap(null);
  for (const pl of liftOverlays)   if (pl) pl.setMap(null);
  for (const pl of fallbackPolylines) if (pl) pl.setMap(null);
  for (const pl of walkingPolylines) if (pl) pl.setMap(null);
  for (const pl of walkingConnectorPolylines) if (pl) pl.setMap(null);
  pistePolylines = [];
  liftOverlays = [];
  fallbackPolylines = [];
  walkingPolylines = [];
  walkingConnectorPolylines = [];
}

/**
 * Draw segments:
 *  - piste segments: solid colored line by difficulty
 *  - lift segments: purple dotted, outlined dots (same style as home aerialways)
 * @param {{name:string|null, difficulty:string|null, path: google.maps.LatLngLiteral[]}[]} segments
 */
export function drawSegments(segments = []) {
  // Clear previous
  clearRoute();

  if (!map || !segments.length) return;

  for (const seg of segments) {
    if (!Array.isArray(seg.path) || seg.path.length < 2) continue;

    if (!seg.difficulty) {
      // Dotted purple with white outline (outlined-dot style)
      liftOverlays.push(makeLiftPolyline(map, seg.path));
    } else {
      // Solid color by difficulty
      pistePolylines.push(makePistePolyline(map, seg.path, getColorByDifficulty(seg.difficulty)));
    }
  }
}

/** Draw dashed straight lines for legs with no route. */
export function drawFallbacks(fallbacks = []) {
  for (const pl of fallbackPolylines) if (pl) pl.setMap(null);
  fallbackPolylines = [];
  if (!map || !fallbacks.length) return;

  const dashSymbol = { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2, strokeColor: '#5f6368' };

  for (const seg of fallbacks) {
    const pl = new google.maps.Polyline({
      map,
      path: [seg.start, seg.end],
      strokeOpacity: 0,
      zIndex: 11,
      icons: [{ icon: dashSymbol, offset: '0', repeat: '12px' }]
    });
    fallbackPolylines.push(pl);
  }
}

export function drawWalkingPolylines(paths = []) {
  if (!map) return;
  const dash = {
    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
    offset: '0',
    repeat: '10px'
  };
  for (const path of paths) {
    if (!Array.isArray(path) || path.length < 2) continue;
    const pl = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#666666',
      strokeWeight: 1,
      strokeOpacity: 0,
      clickable: false,
      zIndex: 11,
      icons: [dash]
    });
    walkingPolylines.push(pl);
  }
}

export function drawWalkingConnectors(paths = []) {
  if (!map) return;
  const dot = {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#666666',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeOpacity: 1,
      strokeWeight: 1.2,     // ring thickness
      scale: 1.5           // dot radius (px). tweak with repeat below
    },
  offset: '0',
  repeat: '5px'         // spacing between dots
};
  for (const path of paths) {
    if (!Array.isArray(path) || path.length < 2) continue;
    const pl = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#666666',
      strokeWeight: 1,
      strokeOpacity: 0,
      clickable: false,
      zIndex: 11,
      icons: [dot]
    });
    walkingConnectorPolylines.push(pl);
  }
}

/** Fit the map to available geometry (prefer full path, else fallbacks). */
export function fitToRoute(path = [], fallbacks = []) {
  if (!map) return;

  const bounds = new google.maps.LatLngBounds();
  let hasAny = false;

  if (path?.length) {
    hasAny = true;
    for (const p of path) bounds.extend(p);
  } else if (fallbacks?.length) {
    hasAny = true;
    for (const f of fallbacks) { bounds.extend(f.start); bounds.extend(f.end); }
  }

  if (hasAny) {
    map.fitBounds(bounds, { top: 20, left: 20, right: 20, bottom: 80 });
  }
}
