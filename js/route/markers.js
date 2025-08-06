
let mapRef = null;
let markers = []; // one per stop index (can be null)

/** Call once after map is created */
export function init(map) {
  mapRef = map;
  markers = [];
}

/** Remove all markers */
export function clear() {
  for (const m of markers) if (m) m.map = null;
  markers = [];
}

/**
 * Sync markers to the current route model.
 * @param {{stops: Array<{place?: google.maps.places.PlaceResult|null}>}} route
 */
export function sync(route) {
  if (!mapRef) return;
  const n = route.stops.length;

  // Grow/shrink markers array to length n
  if (markers.length < n) markers.length = n;
  if (markers.length > n) {
    for (let i = n; i < markers.length; i++) if (markers[i]) markers[i].map = null;
    markers.length = n;
  }

  for (let i = 0; i < n; i++) {
    const place = route.stops[i]?.place;
    const ll = place?.geometry?.location || null;

    if (!ll) {
      // no selection → remove marker if exists
      if (markers[i]) { markers[i].map = null; markers[i] = null; }
      continue;
    }

    // Make/refresh pin by role
    const role = i === 0 ? 'origin' : (i === n - 1 ? 'destination' : 'intermediate');
    const pin = makePinForRole(role);

    if (!markers[i]) {
      markers[i] = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef,
        position: ll,
        content: pin.element,
        zIndex: zForRole(role)
      });
    } else {
      markers[i].position = ll;
      markers[i].content = pin.element;
      markers[i].map = mapRef;
      markers[i].zIndex = zForRole(role);
    }
  }
}

function zForRole(role) {
  return role === 'destination' ? 40 : role === 'origin' ? 35 : 30;
}

function makePinForRole(role) {
  const { PinElement } = google.maps.marker;
  const palette = {
    destination: { bg: '#EA4335', border: '#960A0A', glyph: '#960A0A'},
    origin:      { bg: 'grey', border: '#ffffff', glyph: '#ffffff'},
    intermediate:{ bg: 'grey', border: '#ffffff', glyph: '#ffffff'}
  };
  const p = palette[role] || palette.intermediate;
  return new PinElement({
    background: p.bg,
    borderColor: p.border,
    glyphColor: p.glyph
  });
}
