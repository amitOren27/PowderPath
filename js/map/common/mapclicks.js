
import { fetchPlaceDetails } from './details.js';

/**
 * Wires Google Map clicks:
 * - POI click (has placeId): opens the right-side place panel with full details.
 * - Blank click: closes InfoWindow + panel and invokes onBlankMapClick (optional).
 */
export function wirePOIClicks({ map, placesSvc, infoWindow, placePanel, onBlankMapClick, onPOIClick } = {}) {
  map.addListener('click', (e) => {
    if (e.placeId) {
      e.stop(); // prevent default bubble
      onPOIClick?.(e);  // let callers drop a marker right away
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

/**
 * Creates and returns a new marker pin with the given background
 * color, border color and glyph color.
 * By default returns the classic red marker pin
 */
export function makePin({ bg = '#EA4335', border = '#960A0A', glyph = '#960A0A' } = {}) {
  const { PinElement } = google.maps.marker;
  return new PinElement({ background: bg, borderColor: border, glyphColor: glyph });
}
