
import { buildPisteInfo } from '../ui/infowindow.js';
import { getColorByDifficulty } from '../common/draw.js';

/**
 * Adds pistes to the built-in map.data layer and
 * calls onBeforeOpen() before showing the InfoWindow.
 *
 * @param {google.maps.Map} map
 * @param {{ url: string, infoWindow: google.maps.InfoWindow, onBeforeOpen?: () => void }} opts
 */
export function addPistes(map, { url, infoWindow, onBeforeOpen } = {}) {
  let clickListener = null;

  fetch(url)
    .then(r => r.json())
    .then(geojson => {
      map.data.addGeoJson(geojson);
      map.data.setStyle((feature) => {
        const diff = feature.getProperty('difficulty');
        return {
          strokeColor: getColorByDifficulty(diff),
          strokeWeight: 2
        };
      });

      clickListener = map.data.addListener('click', (e) => {
        onBeforeOpen?.(); // Close any side-panel before opening this InfoWindow
        const content = buildPisteInfo(e.feature);
        infoWindow.setContent(content);
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });
    })
    .catch(err => {
      console.error('Failed to load pistes GeoJSON:', err);
    });

  return {
    remove() {
      if (clickListener) google.maps.event.removeListener(clickListener);
    }
  };
}