
import { fetchPlaceDetails } from './details.js';

/**
 * Wires Google Map clicks:
 * - POI click (has placeId): opens the right-side place panel with full details.
 * - Blank click: closes InfoWindow + panel and invokes onBlankMapClick (optional).
 */
export function wirePOIClicks({ map, placesSvc, infoWindow, placePanel, onBlankMapClick } = {}) {
  map.addListener('click', (e) => {
    if (e.placeId) {
      e.stop(); // prevent default bubble
      fetchPlaceDetails(placesSvc, e.placeId).then((place) => {
        if (place) {
          placePanel?.open?.(place);
          infoWindow?.close?.();
        }
      });
      return;
    }
    infoWindow?.close?.();
    placePanel?.close?.();
    onBlankMapClick?.(e);
  });
}
