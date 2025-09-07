import { GOOGLE_API_KEY } from '../maps/loader.js';

function decodeEncodedPolyline(encoded) {
  // Requires geometry library
  if (!google?.maps?.geometry?.encoding?.decodePath) return null;
  const gPath = google.maps.geometry.encoding.decodePath(encoded);
  return gPath.map(ll => ({ lat: ll.lat(), lng: ll.lng() }));
}

function decodeGeoJsonLineString(geojson) {
  const coords = geojson?.coordinates;
  if (!Array.isArray(coords) || !coords.length) return null;
  // GeoJSON is [lng, lat]
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

/**
 * Returns Promise<Array<{lat,lng}>>.
 * Always returns an ARRAY (never an object), so callers can use Array.isArray(path).
 * Accepts 1-point polylines (so we can still draw dotted connectors).
 */
export async function getWalkingPath(origin, destination, signal) {
  if (!origin || !destination) return [];

  const toApiLatLng = (ll) => ({ latitude: ll.lat, longitude: ll.lng });

  const body = {
    origin:      { location: { latLng: toApiLatLng(origin) } },
    destination: { location: { latLng: toApiLatLng(destination) } },
    travelMode: 'WALK',
    polylineEncoding: 'ENCODED_POLYLINE',
    // polylineQuality: 'HIGH_QUALITY' // optional; uncomment if you want denser paths
  };

  const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      // Be explicit: request the encoded polyline field
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline'
    },
    body: JSON.stringify(body),
    signal
  });

  if (!resp.ok) {
    console.log('[routes] computeRoutes failed', resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) {
    console.log('[walk] computeRoutes OK but no route found', data);
    return [];
  }

  // Decode polyline (prefer encoded; fall back to GeoJSON if present)
  let path = null;
  const poly = route.polyline || {};
  if (poly.encodedPolyline) {
    path = decodeEncodedPolyline(poly.encodedPolyline);
  } else if (poly.geoJsonLinestring) {
    path = decodeGeoJsonLineString(poly.geoJsonLinestring);
  }

  if (!Array.isArray(path) || path.length < 1) {
    console.log('[walk] route has no decodable polyline', poly);
    return [];
  }

  return path; // ← ALWAYS an array
}

/** Returns an array of 0..2 polylines (each polyline is an array of 2 points) */
export function getWalkingConnectors(origin, destination, path, minMeters = 0) {
  const connectors = [];
  if (!origin || !destination || !Array.isArray(path) || path.length < 1) return connectors;

  const toGLatLng = (p) => new google.maps.LatLng(p.lat, p.lng);
  const dist = (a, b) => google.maps.geometry.spherical.computeDistanceBetween(toGLatLng(a), toGLatLng(b));

  const first = path[0];
  const last  = path[path.length - 1];
  if (dist(origin, first) > minMeters) connectors.push([origin, first]);
  if (dist(destination, last)  > minMeters) connectors.push([last, destination]);
  return connectors;
}
