
import { loadGoogle } from '../maps/loader.js';
import { on } from '../core/events.js';
import { initRouteUI, render, positionOverlays } from './ui.js';
import { getRoute } from './state.js';
import * as draw from './draw.js';
import * as placePanel from '../map/ui/placepanel.js';
import { wirePOIClicks } from '../map/common/mapclicks.js';
import { fetchPlaceDetails } from '../map/common/details.js';

async function bootstrap() {
  await loadGoogle({ libraries: ['places'] });

  // Map init
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 },
    zoom: 13,
    mapId: 'POWDERPATH_BASE'
  });

  // Init overlays module with the map
  draw.init(map);

  // UI init
  initRouteUI();

  // Places plumbing (shared with home page)
  const infoWindow = new google.maps.InfoWindow();
  const placesSvc  = new google.maps.places.PlacesService(map);
  wirePOIClicks({ map, placesSvc, infoWindow, placePanel });

  // When any pill selects a place: pan/zoom like on the home map, then open the details panel
  on('route:placeSelected', async (ev) => {
    const place = ev.detail?.place;
    if (!place || !place.geometry) return;
    const loc = place.geometry.location;
    map.panTo(loc);
    map.setZoom(17);
  });

  // Re-render UI and redraw route whenever the store changes
  on('route:changed', () => {
    render();
    draw.update(getRoute());   // <— this is the new piece
  });

  // Keep overlays aligned in the side panel
  window.addEventListener('resize', positionOverlays);
}

bootstrap();