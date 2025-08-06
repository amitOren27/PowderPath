
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

  const DOT_COLOR       = '#7E57C2'; // aerialway purple
  const REPEAT_PX       = 14;        // spacing between mid-line dots
  const MID_DOT_SCALE   = 2;         // mid-line dot size
  const END_DOT_SCALE   = 3.2;       // start/end dot size
  const OUTLINE_WEIGHT  = 1;         // white outline thickness (1–1.5 looks good)

  // Single-symbol outlined dots (solid center + white stroke)
  const midDot = makeOutlinedCircle(DOT_COLOR, MID_DOT_SCALE, OUTLINE_WEIGHT);
  const endDot = makeOutlinedCircle(DOT_COLOR, END_DOT_SCALE, OUTLINE_WEIGHT);

  fetch(url)
    .then(r => r.json())
    .then(geojson => {
      layer.addGeoJson(geojson);

      // Hide the layer's own stroke
      layer.setStyle({
        strokeColor: '#7E57C2',
        strokeOpacity: 1,
        strokeWeight: 1
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
            icons: [
              // 1) Mid-line repeated outlined dots
              { icon: midDot, offset: '0', repeat: `${REPEAT_PX}px` },
              // 2) Larger outlined dots at both endpoints (paint after mid-dots to sit on top)
              { icon: endDot, offset: '0' },       // start
              { icon: endDot, offset: '100%' }     // end
            ]
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

function makeOutlinedCircle(fill, scale, strokeWeight) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight
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
