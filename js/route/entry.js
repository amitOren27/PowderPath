
import { loadGoogle } from '../maps/loader.js';
import { on } from '../core/events.js';
import { initRouteUI, render, positionOverlays } from './ui.js';
import { getRoute } from './state.js';

import * as draw from './draw.js';
import * as markers from './markers.js';
import { fetchMultiLeg } from './api.js';

import * as placePanel from '../map/ui/placepanel.js';
import { wirePOIClicks } from '../map/common/mapclicks.js';
import { makePin } from '../map/common/mapclicks.js';
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
  await loadGoogle({ libraries: ['places', 'marker'] });

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

        const { path, fallbacks } = await fetchMultiLeg(filled, signal);

        // Clear then draw
        draw.clearRoute();
        if (path.length) draw.drawRoute(path);
        draw.drawFallbacks(fallbacks);
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