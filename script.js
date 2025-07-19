let map;

function initMap() {
  // Initialize the map centered on Val Thorens
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 45.2970, lng: 6.5833 },
    zoom: 14,
    mapTypeId: "terrain",
    zoomControl: true,
    fullscreenControl: true,
    streetViewControl: true,
     zoomControlOptions: {
       position: google.maps.ControlPosition.RIGHT_BOTTOM
     },
    streetViewControl: true,
    streetViewControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    },
  });

  // Create the side panel element
  const panel = document.createElement("div");
  panel.id = "info-panel";
  panel.style.cssText = `
    position: absolute;
    top: 20px;
    right: 60px;
    width: 320px;
    max-height: 90%;
    overflow-y: auto;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    padding: 12px;
    z-index: 1000;
    display: none;
  `;
  document.body.appendChild(panel);

  // Close panel when clicking on the map (not on POI)
  map.addListener("click", (e) => {
    if (!e.placeId) {
      panel.style.display = "none";
      clearSearch();
      return;
    }

    e.stop(); // Prevent default info window

    const service = new google.maps.places.PlacesService(map);
    service.getDetails({
      placeId: e.placeId,
      fields: [
        'name',
        'formatted_address',
        'photos',
        'opening_hours',
        'rating',
        'user_ratings_total',
        'geometry',
        'url'
      ]
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
        const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 300 }) || '';
        const openNow = place.opening_hours?.weekday_text?.join('<br>') || 'Hours not available';
        const rating = place.rating ? `${place.rating} ★ (${place.user_ratings_total} reviews)` : 'No rating';

        // Set the panel HTML
        panel.innerHTML = `
          <div>
            <div style="text-align: right;">
              <button onclick="document.getElementById('info-panel').style.display='none'" 
                style="border:none;background:none;font-size:18px;cursor:pointer;">✖</button>
            </div>
            <h3 style="margin: 4px 0;">${place.name}</h3>
            <p style="margin: 2px 0; font-size: 14px;">${place.formatted_address}</p>
            ${photoUrl ? `<img src="${photoUrl}" alt="${place.name}"
              style="width:100%; height:140px; object-fit:cover; border-radius:6px; margin:6px 0;" />` : ''}
            <p style="margin: 2px 0;"><strong>Rating:</strong> ${rating}</p>
            <p style="margin: 2px 0;"><strong>Hours:</strong><br>${openNow}</p>
            <a href="${place.url}" target="_blank" style="font-size: 14px;">View on Google Maps</a>
          </div>
        `;
        panel.style.display = "block";
      }
    });
  });

  // === Search Box using Google Places Autocomplete ===
  const input = document.getElementById("search-input");
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.bindTo("bounds", map);

  const marker = new google.maps.Marker({ map });

  const clearButton = document.getElementById("clear-search");

  // Clear function
  function clearSearch() {
    input.value = "";
    marker.setVisible(false);
    clearButton.style.display = "none";
  }

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;

    map.panTo(place.geometry.location);
    map.setZoom(17);
    marker.setPosition(place.geometry.location);
    marker.setVisible(true);
    clearButton.style.display = "block";
  });

  clearButton.addEventListener("click", () => {
    clearSearch();
  });


  // === Load and Display Ski Pistes ===
  const pistes_url = 'https://pzacz4eagty6wkmi7d366e25ie0yvdmw.lambda-url.us-east-1.on.aws/';
  const infoWindow = new google.maps.InfoWindow();

  fetch(pistes_url)
    .then((response) => response.json())
    .then((geojson) => {
      map.data.addGeoJson(geojson);

      map.data.setStyle((feature) => {
        const difficulty = feature.getProperty('difficulty');
        const color = getColorForDifficulty(difficulty);
        return {
          strokeColor: color,
          strokeWeight: 2,
        };
      });

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

    const aerialwayLayer = new google.maps.Data({ map: map });

    // Load aerialway GeoJSON from your new Lambda
    const aerialways_url = 'https://5ahe25yvc5nbe3aclzso6xebdq0fcxho.lambda-url.us-east-1.on.aws/';

    fetch(aerialways_url)
      .then((response) => response.json())
      .then((geojson) => {
        aerialwayLayer.addGeoJson(geojson);

        // Apply custom style for aerialways
        aerialwayLayer.setStyle((feature) => {
          const aerialwayType = feature.getProperty('aerialway') || 'unknown';

          return {
            strokeColor: '#8E44AD',
            strokeWeight: 1,
            strokeOpacity: 0.9
          };
        });

        // Add click interaction
        aerialwayLayer.addListener('click', (event) => {
          const name = event.feature.getProperty('name') || 'Unnamed lift';
          const type = event.feature.getProperty('aerialway') || 'Unknown type';
          const capacity = event.feature.getProperty('capacity') || 'N/A';
          const content = `<strong>${name}</strong><br>Type: ${type}`;
          infoWindow.setContent(content);
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map);
        });
      })
      .catch((error) => {
        console.error("Failed to load aerialways GeoJSON:", error);
      });

}

function getColorForDifficulty(difficulty) {
  switch (difficulty) {
    case 'novice': return '#4CAF50';
    case 'easy': return '#3399ff';
    case 'intermediate': return '#ff0000';
    case 'advanced': return '#000000';
    case 'expert': return '#ff6600';
    case 'freeride': return '#ffcc00';
    default: return '#999999';
  }
}

window.addEventListener('load', () => {
  if (typeof google === 'object' && typeof google.maps === 'object') {
    initMap();
  } else {
    console.error("Google Maps JavaScript API failed to load.");
  }
});
 // Get current path (e.g. "/weather.html")
  const currentPage = window.location.pathname.split('/').pop();

  // Loop through nav links
  document.querySelectorAll('.bottom-nav a').forEach(link => {
    const linkPage = link.getAttribute('href');

    if (linkPage === currentPage) {
      link.classList.add('active'); // mark as active
    }
  });

