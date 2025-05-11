let map;

function initMap() {
  // Initialize the map centered on Val Thorens
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 45.2970, lng: 6.5833 },
    zoom: 14,
    mapTypeId: "terrain"
  });

  // 1. === Search Box using Google Places Autocomplete ===
  const input = document.getElementById("search-input");
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.bindTo("bounds", map);

  const infoWindow = new google.maps.InfoWindow();
  const marker = new google.maps.Marker({ map });

  autocomplete.addListener("place_changed", () => {
    infoWindow.close();
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;

    map.panTo(place.geometry.location);
    map.setZoom(15);
    marker.setPosition(place.geometry.location);
    marker.setVisible(true);

    const content = `
      <strong>${place.name}</strong><br>
      ${place.types?.[0] || ''}<br>
      ${place.formatted_address || ''}
    `;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);
  });

  // 2. === Load and Display Ski Pistes ===
  const lambda_url = 'https://7zu3uvx6vzepkmqjc36zcm2xhi0dhrjy.lambda-url.us-east-1.on.aws/';

  fetch(lambda_url)
    .then((response) => response.json())
    .then((geojson) => {
      map.data.addGeoJson(geojson); // Load GeoJSON to the map's Data layer

      // Set styling for each feature based on 'difficulty'
      map.data.setStyle((feature) => {
        const difficulty = feature.getProperty('difficulty');
        const color = getColorForDifficulty(difficulty);
        return {
          strokeColor: color,
          strokeWeight: 1,
        };
      });

      // Optional: Info window when clicking a piste
      map.data.addListener('click', (event) => {
        const name = event.feature.getProperty('name') || 'Unnamed trail';
        const difficulty = event.feature.getProperty('difficulty') || 'Unknown';
        const content = `<strong>${name}</strong><br>Difficulty: ${difficulty}`;
        infoWindow.setContent(content);
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map);
      });
    })
    .catch((error) => {
      console.error("Failed to load pistes GeoJSON:", error);
    });
}

// 3. === Helper: Assign color based on difficulty level ===
function getColorForDifficulty(difficulty) {
  switch (difficulty) {
    case 'novice': return '#4CAF50';        // Green
    case 'easy': return '#00ccff';          // Blue
    case 'intermediate': return '#ff0000';  // Red
    case 'advanced': return '#000000';      // Black
    case 'expert': return '#ff6600';        // Orange
    case 'freeride': return '#ffcc00';      // Yellow
    default: return '#999999';              // Gray
}
}