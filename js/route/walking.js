
import { GOOGLE_API_KEY } from '../maps/loader.js';

let svc = null;

function ensureService() {
  if (!svc) svc = new google.maps.DirectionsService();
  return svc;
}

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

// Returns Promise<Array<{lat,lng}>>; [] if it fails or is pointless
export async function getWalkingPath(origin, destination, signal) {
  if (!origin || !destination) return { path: [] };

  const toApiLatLng = ll => ({ latitude: ll.lat, longitude: ll.lng });

  const body = {
    origin:      { location: { latLng: toApiLatLng(origin) } },
    destination: { location: { latLng: toApiLatLng(destination) } },
    travelMode: 'WALK',
    polylineEncoding: 'ENCODED_POLYLINE'
  };

  const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'routes.polyline,routes.legs.distanceMeters,routes.legs.duration,routes.warnings'
    },
    body: JSON.stringify(body),
    signal
  });

  if (!resp.ok) {
    console.log('[routes] computeRoutes failed', resp.status, await resp.text());
    return { path: [] };
  }

  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) {
    console.log('[walk] computeRoutes OK but no route found', data);
    return { path: [] };
  }

  // Decode polyline (either encoded or GeoJSON)
  let path = null;
  const poly = route.polyline || {};
  if (poly.encodedPolyline) {
    path = decodeEncodedPolyline(poly.encodedPolyline);
  } else if (poly.geoJsonLinestring) {
    path = decodeGeoJsonLineString(poly.geoJsonLinestring);
  }
  if (!path || path.length < 2) {
    console.log('[walk] route has no decodable polyline', poly);
    return { path: [] };
  }

  return path;
}

// Returns an array of 0..2 polylines (each polyline is an array of 2 points)
export function getWalkingConnectors(origin, destination, path, minMeters = 0) {
  const connectors = [];
  if (!origin || !destination || !Array.isArray(path) || path.length < 1) return connectors;

  // Need geometry lib for precise meters
  const toGLatLng = (p) => new google.maps.LatLng(p.lat, p.lng);
  const dist = (a, b) => {
    return google.maps.geometry.spherical.computeDistanceBetween(toGLatLng(a), toGLatLng(b));
  };

  const first = path[0];
  const last  = path[path.length - 1];
  if (dist(origin, first) > minMeters) connectors.push([origin, first]);
  if (dist(destination, last)  > minMeters) connectors.push([last, destination]);
  return connectors;
}