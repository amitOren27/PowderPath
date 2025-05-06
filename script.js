//// 1. Create basic map
//const map = new ol.Map({
//  target: 'map',
//  layers: [
//    new ol.layer.Tile({
//      source: new ol.source.OSM() // Base OpenStreetMap layer
//    })
//  ],
//  view: new ol.View({
//    center: ol.proj.fromLonLat([6.5833, 45.2970]), // Center on Val Thorens
//    zoom: 13
//  })
//});
//
//// 3. Fetch ski trails and add to map
//const url = 'https://2koy3wx3n3swhlzmienduvjobq0nsgqn.lambda-url.us-east-1.on.aws/';
//
//fetch(url)
//  .then(response => response.json())
//  .then(geojsonData => {
//    const vectorSource = new ol.source.Vector({
//      features: new ol.format.GeoJSON().readFeatures(geojsonData, {
//        featureProjection: 'EPSG:3857'
//      })
//    });
//
//    const difficultyColors = {
//      "novice": "#4CAF50",       // green
//      "easy": "#00ccff",         // blue
//      "intermediate": "#ff0000", // red
//      "advanced": "#000000",     // black
//      "expert": "#ff6600",       // orange
//      "freeride": "#ffcc00",     // yellow
//      "[null]": "#999999"        // gray for undefined/null
//    };
//
//    const pisteLayer = new ol.layer.Vector({
//      source: vectorSource,
//      style: function (feature) {
//        const difficulty = feature.get('difficulty');
//        return new ol.style.Style({
//          stroke: new ol.style.Stroke({
//            color: difficultyColors[difficulty],
//            width: 2
//          })
//        });
//      }
//    });
//
//    map.addLayer(pisteLayer);
//  })
//  .catch(error => {
//    console.error('Error fetching pistes:', error);
//  });

mapboxgl.accessToken = 'pk.eyJ1IjoicG93ZGVycGF0aCIsImEiOiJjbWFheWd4aG0yMm5qMmlxdWZoc3BuN2duIn0.ACVT0HValXADaLR7Esyfvg';

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

  const url = 'https://2koy3wx3n3swhlzmienduvjobq0nsgqn.lambda-url.us-east-1.on.aws/';

   map.addSource('pistes', {
    type: 'geojson',
    data: url // Replace with your actual Lambda URL
  });

//  fetch(url)
//    .then(response => response.json())
//    .then(geojsonData => {
//      map.addSource('pistes', {
//        type: 'geojson',
//        data: geojsonData
//      });

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
            /* default */ '#999999'
          ],
          'line-width': 2
        }
      }, firstSymbolLayer?.id) // Insert below the first symbol layer
    });
//    .catch(error => console.error('Error loading GeoJSON:', error));
//});
