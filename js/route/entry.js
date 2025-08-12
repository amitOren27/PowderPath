
import { loadGoogle } from '../maps/loader.js';
import { on } from '../core/events.js';
import { initRouteUI, render, positionOverlays } from './ui.js';
import { getRoute } from './state.js';

import * as draw from './draw.js';
import * as markers from './markers.js';
import { fetchMultiLeg } from './api.js';
import { getWalkingPath, getWalkingConnectors } from './walking.js';

import * as placePanel from '../map/ui/placepanel.js';
import { wirePOIClicks, makePin } from '../map/common/mapclicks.js';
import { fetchPlaceDetails } from '../map/common/details.js';

let currentAbort = null;

/** Build a list of LatLngLiteral, skipping empty pills (keeps order). */
function extractFilledStops(route) {
  const out = [];
  for (const stop of route.stops) {
    const ll = stop?.place?.geometry?.location;
    if (ll) out.push({ lat: ll.lat(), lng: ll.lng() });
  }
  return out;
}

async function bootstrap() {
  await loadGoogle({ libraries: ['places', 'marker', 'geometry'] });

  // Map init
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 },
    zoom: 14,
    mapTypeId: 'terrain',
    mapId: 'POWDERPATH_BASE'
  });

  let poiMarker = null; // marker for POI clicks (separate from route pins)

  // Init overlays module with the map
  draw.init(map);

  // Init marker handling for the map
  markers.init(map);

  // UI init
  initRouteUI();

  // Places plumbing (shared with home page)
  const infoWindow = new google.maps.InfoWindow();
  const placesSvc  = new google.maps.places.PlacesService(map);

  wirePOIClicks({
    map,
    placesSvc,
    infoWindow,
    placePanel,
    onPOIClick: (e) => {
      // Drop/update a marker at the clicked POI
      const pin = makePin();
      if (!poiMarker) {
        poiMarker = new google.maps.marker.AdvancedMarkerElement({
          map, position: e.latLng, content: pin.element, zIndex: 50
        });
      } else {
        poiMarker.position = e.latLng;
        poiMarker.content = pin.element;
        poiMarker.map = map;
      }
    },
    onBlankMapClick: () => {
      // Clear the POI marker
      if (poiMarker) { poiMarker.map = null; }
    }
  });

  // When any pill selects a place: pan/zoom like on the home map, then open the details panel
  on('route:placeSelected', async (ev) => {
    const place = ev.detail?.place;
    if (!place || !place.geometry) return;
    const loc = place.geometry.location;
    map.panTo(loc);
    map.setZoom(17);
  });

  // Re-render UI and redraw route whenever the store changes
  on('route:changed', async () => {
      render();

      // Cancel any in-flight routing
      if (currentAbort) currentAbort.abort();
      currentAbort = new AbortController();
      const { signal } = currentAbort;

      // Keep pins synced with pills
      markers.sync(getRoute());

      try {
        const filled = extractFilledStops(getRoute()); // [{lat,lng}, ... filled only, order kept]
        if (filled.length < 2) {
          draw.clearRoute();
          return;
        }

        const { path, segments, fallbacks, walking } = await fetchMultiLeg(filled, signal);

        // Clear then draw
        draw.clearRoute();
        draw.drawSegments(segments);
        draw.drawFallbacks(fallbacks);
        const walkPromises = [];
        const connectorPaths = [];
        for (const hint of (walking || [])) {
          if (hint?.toSnap?.origin && hint?.toSnap?.destination) {
            walkPromises.push(
              getWalkingPath(hint.toSnap.origin, hint.toSnap.destination, signal)
                .then(path => {
                  const conns = getWalkingConnectors(hint.toSnap.origin, hint.toSnap.destination, path);
                  if (conns.length) connectorPaths.push(...conns);
                  return path;
                })
                .catch(() => [])
            );
          }
          if (hint?.fromSnap?.origin && hint?.fromSnap?.destination) {
            walkPromises.push(
              getWalkingPath(hint.fromSnap.origin, hint.fromSnap.destination, signal)
                .then(path => {
                  const conns = getWalkingConnectors(hint.fromSnap.origin, hint.fromSnap.destination, path);
                  if (conns.length) connectorPaths.push(...conns);
                  return path;
                })
                .catch(() => [])
            );
          }
        }
        const walkResults = await Promise.all(walkPromises);
        const walkPaths = walkResults.filter(p => Array.isArray(p) && p.length > 1);
        draw.drawWalkingPolylines(walkPaths);
        draw.drawWalkingConnectors(connectorPaths);
        draw.fitToRoute(path, fallbacks);

      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('[route] failed:', err);
        draw.clearRoute();
      }
    });

  // Keep overlays aligned in the side panel
  window.addEventListener('resize', positionOverlays);
}

bootstrap();