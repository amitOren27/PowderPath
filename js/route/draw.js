
let map = null;
let routePolyline = null;
let fallbackPolylines = [];

/**
 * Initialize with the Google Map instance created in entry.js.
 * Called once during bootstrap.
 */
export function init(m) {
  map = m;
}

/** Remove any existing lines from the map. */
export function clearRoute() {
  if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
  for (const pl of fallbackPolylines) if (pl) pl.setMap(null);
  fallbackPolylines = [];
}

/**
 * Draw the solid route path.
 */
export function drawRoute(path) {
  if (!map) return;
  if (!path || !path.length) return;

  if (!routePolyline) {
    routePolyline = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#1a73e8',
      strokeWeight: 4,
      strokeOpacity: 0.9
    });
  } else {
    routePolyline.setPath(path);
    routePolyline.setMap(map);
  }
}

/**
 * Draw dashed straight lines for legs with no route (fallbacks).
 * Overwrites any previous dashed lines.
 * @param {{start:{lat:number,lng:number}, end:{lat:number,lng:number}}[]} fallbacks
 */
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
      zIndex: 8,
      icons: [{ icon: dashSymbol, offset: '0', repeat: '12px' }]
    });
    fallbackPolylines.push(pl);
  }
}

/**
 * Fit the map to the available geometry (route or fallbacks).
 */
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
