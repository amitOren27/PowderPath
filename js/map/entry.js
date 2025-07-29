
import { loadGoogle } from '../maps/loader.js';
import { attachAutocomplete } from '../places/autocomplete.js';
import { addPistes } from './layers/pistes.js';
import { addAerialways } from './layers/aerialways.js';
import * as placePanel from './ui/placepanel.js';
import { wirePOIClicks } from './common/mapClicks.js';
import { fetchPlaceDetails } from './common/details.js';

async function bootstrap() {
  // Load Google Maps (with Places for the search box)
  await loadGoogle({ libraries: ['places'] });

  // Create the map
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 }, // Val Thorens
    zoom: 14,
    mapTypeId: 'terrain',
    mapId: 'POWDERPATH_BASE',
    clickableIcons: true
  });

  const infoWindow = new google.maps.InfoWindow();
  const placesSvc  = new google.maps.places.PlacesService(map);

  const closePanel = () => placePanel.close();

  // Add layers
  const PISTES_URL     = 'https://pzacz4eagty6wkmi7d366e25ie0yvdmw.lambda-url.us-east-1.on.aws/';
  const AERIALWAYS_URL = 'https://5ahe25yvc5nbe3aclzso6xebdq0fcxho.lambda-url.us-east-1.on.aws/';

  const pistes = addPistes(map, { url: PISTES_URL, infoWindow, onBeforeOpen: closePanel });
  const lifts  = addAerialways(map, { url: AERIALWAYS_URL, infoWindow, onBeforeOpen: closePanel });

  // Search box + clear button
  const searchInput = document.getElementById('search-input');
  const clearBtn    = document.getElementById('clear-search');
  let searchMarker = null;

  if (searchInput && clearBtn) {
    const toggleClear = () => {
      clearBtn.style.display = searchInput.value ? 'inline-block' : 'none';
    };
    toggleClear();

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      toggleClear();
      if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }
      infoWindow.close();
      placePanel.close();
      searchInput.focus();
    });

    searchInput.addEventListener('input', toggleClear);

    attachAutocomplete(searchInput, {
      onPlace: (place) => {
        if (!place || !place.geometry) return;

        // Keep chosen text visible
        const label = place.name || place.formatted_address || '';
        searchInput.value = label;
        toggleClear();

        // Place / move a marker
        const loc = place.geometry.location;
        if (!searchMarker) {
          searchMarker = new google.maps.Marker({ map, position: loc });
        } else {
          searchMarker.setPosition(loc);
        }

        // Pan/zoom – if viewport present, fit; else center + zoom 17
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport, { top: 20, left: 20, right: 20, bottom: 80 });
        } else {
          map.panTo(loc);
          map.setZoom(17);
        }

        // Also open the details panel (behavior matches “click a POI”)
        fetchPlaceDetails(placesSvc, place.place_id).then((full) => {
          if (full) placePanel.open(full);
        });
      }
    });
  }

  // Map click behavior
  wirePOIClicks({
    map,
    placesSvc,
    infoWindow,
    placePanel,
    onBlankMapClick: () => {
      if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }
      if (searchInput) {
        searchInput.value = '';
        clearBtn.style.display = 'none';
      }
    }
  });
}

bootstrap();