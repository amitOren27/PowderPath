mapboxgl.accessToken = 'pk.eyJ1IjoicG93ZGVycGF0aCIsImEiOiJjbWFheWd4aG0yMm5qMmlxdWZoc3BuN2duIn0.ACVT0HValXADaLR7Esyfvg';
const url = 'https://7zu3uvx6vzepkmqjc36zcm2xhi0dhrjy.lambda-url.us-east-1.on.aws/';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12',
  center: [6.5833, 45.2970], // Val Thorens [lon, lat]
  zoom: 13
});

map.on('styleimagemissing', (e) => {
  const id = e.id.replace('-15', '');

  // Skip re-adding if it's already loaded
  if (map.hasImage(id)) return;

  // Construct sprite URL
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite/${id}@2x.png?access_token=${mapboxgl.accessToken}`;

  map.loadImage(url, (error, image) => {
    if (error) {
      console.warn(`Could not load icon: ${id}`, error);
      return;
    }
    map.addImage(id, image);
  });
});

map.on('load', () => {
  // Remove default POI labels
  map.removeLayer('poi-label');

  // Add GeoJSON source for points of interest
  map.addSource('val-thorens-pois', {
    type: 'geojson',
    data: 'val_thorens_pois.geojson'
  });
  // Add symbol layer using maki icons
  map.addLayer({
    id: 'val-thorens-pois-icons',
    type: 'symbol',
    source: 'val-thorens-pois',
    minzoom: 14,
    layout: {
      'icon-image': ['get', 'maki'],
      'icon-size': 1.2,
      'icon-allow-overlap': true,
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#333'
    }
  });
  // Add popups on click
  map.on('click', 'val-thorens-pois-icons', (e) => {
    const feature = e.features[0];
    const coords = feature.geometry.coordinates.slice();
    const props = feature.properties;

    const name = props.name || 'Unknown';
    const category = props.maki || props.class || 'POI';

    new mapboxgl.Popup()
      .setLngLat(coords)
      .setHTML(`<strong>${name}</strong><br>Type: ${category}`)
      .addTo(map);
  });

  // Change cursor to pointer on hover
  map.on('mouseenter', 'val-thorens-pois-icons', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'val-thorens-pois-icons', () => {
    map.getCanvas().style.cursor = '';
  });

  // Add the GeoJSON source for pistes
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
  }, beforeId='contour-label'); // Insert below the contour-label symbol layer

  map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
  }));
});
