mapboxgl.accessToken = 'pk.eyJ1IjoicG93ZGVycGF0aCIsImEiOiJjbWFheWd4aG0yMm5qMmlxdWZoc3BuN2duIn0.ACVT0HValXADaLR7Esyfvg';
const url = 'https://7zu3uvx6vzepkmqjc36zcm2xhi0dhrjy.lambda-url.us-east-1.on.aws/';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12',
  center: [6.5833, 45.2970], // Val Thorens [lon, lat]
  zoom: 13
});

map.on('load', () => {
  // Find the first symbol layer to insert below (labels, icons)
  const layers = map.getStyle().layers;
  const firstSymbolLayer = layers.find(layer =>
  layer.type === 'symbol' &&
  layer.layout &&
  layer.layout['text-field']
  );

  // Add the GeoJSON source
  map.addSource('pistes', {
    type: 'geojson',
    data: url
  });

  // Add the layer with dynamic color by difficulty
  map.addLayer({
    id: 'pistes-layer',
    type: 'line',
    source: 'pistes',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'difficulty'],
        'novice', '#4CAF50',
        'easy', '#00ccff',
        'intermediate', '#ff0000',
        'advanced', '#000000',
        'expert', '#ff6600',
        'freeride', '#ffcc00',
        '#999999' // default
      ],
      'line-width': 2
    }
  }, firstSymbolLayer?.id) // Insert below the first symbol layer
});
