
import { buildAerialwayInfo } from '../ui/infowindow.js';

/**
 * Adds aerialways in their own Data layer and overlays dotted polylines
 * for visibility. Data layer remains for click events; polylines are non-clickable.
 *
 * @param {google.maps.Map} map
 * @param {{ url: string, infoWindow: google.maps.InfoWindow, onBeforeOpen?: () => void }} opts
 */
export function addAerialways(map, { url, infoWindow, onBeforeOpen } = {}) {
  const layer = new google.maps.Data({ map });

  // Keep references to the dotted polylines so we can clean up later
  const dottedOverlays = [];

  // Symbol used to create dots along the line
  const DOT_COLOR = '#7E57C2';
  const dotSymbol = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 2,
    fillColor: DOT_COLOR,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight: 1          // outline thickness
  };

  fetch(url)
    .then(r => r.json())
    .then(geojson => {
      layer.addGeoJson(geojson);

      // Hide the layer's own stroke
      layer.setStyle({
        strokeColor: '#7E57C2',
        strokeOpacity: 0,
        strokeWeight: 2
      });

      // Build a dotted polyline for each geometry part
      layer.forEach(feature => {
        const geom = feature.getGeometry();
        buildDottedForGeometry(geom, (path) => {
          const pl = new google.maps.Polyline({
            map,
            path,
            strokeOpacity: 0,         // hide the base stroke
            clickable: false,         // let Data layer receive clicks
            zIndex: 11,
            icons: [{
              icon: dotSymbol,
              offset: '0',
              repeat: '12px'          // spacing between dots
            }]
          });
          dottedOverlays.push(pl);
        });
      });

      // Click → InfoWindow
      layer.addListener('click', (e) => {
        onBeforeOpen?.();
        const content = buildAerialwayInfo(e.feature);
        infoWindow.setContent(content);
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });
    })
    .catch(err => {
      console.error('Failed to load aerialways GeoJSON:', err);
    });

  return {
    remove() {
      layer.setMap(null);
      dottedOverlays.forEach(pl => pl.setMap(null));
      dottedOverlays.length = 0;
    }
  };
}

/**
 * Walk a Data.Geometry (LineString/MultiLineString) and invoke cb(path)
 * for each polyline path (array of LatLng).
 */
function buildDottedForGeometry(geometry, cb) {
  const type = geometry.getType();
  if (type === 'LineString') {
    const path = [];
    geometry.forEachLatLng(ll => path.push(ll));
    if (path.length > 1) cb(path);
  } else if (type === 'MultiLineString') {
    geometry.getArray().forEach(g => buildDottedForGeometry(g, cb));
  }
}
