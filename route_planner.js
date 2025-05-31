let map;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 45.2970, lng: 6.5833 },
    zoom: 14,
    mapTypeId: "terrain"
  });
  window.initMap;

  // Autocomplete for start & destination
  const startInput = document.getElementById("start-location");
  const destInput = document.getElementById("destination-location");
  const inputColumn = document.querySelector(".input-column");

  new google.maps.places.Autocomplete(startInput).bindTo("bounds", map);
  new google.maps.places.Autocomplete(destInput).bindTo("bounds", map);

  const addStopBtn = document.getElementById("add-stop-btn");

  addStopBtn.addEventListener("click", () => {
    // === Create container div for stop input and delete button ===
    const stopContainer = document.createElement("div");
    stopContainer.className = "stop-container";

    // Stop input
    const stopInput = document.createElement("input");
    stopInput.type = "text";
    stopInput.className = "route-input";
    stopInput.placeholder = "Stop";

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "✖";
    deleteBtn.className = "delete-stop-btn";
    deleteBtn.onclick = () => stopContainer.remove();

    // Assemble
    stopContainer.appendChild(stopInput);
    stopContainer.appendChild(deleteBtn);

    // Insert before destination
    inputColumn.insertBefore(stopContainer, destInput);

    // Add Autocomplete
    new google.maps.places.Autocomplete(stopInput).bindTo("bounds", map);
  });
}

window.addEventListener("load", () => {
  if (typeof google === "object" && typeof google.maps === "object") {
    initMap();
  } else {
    console.error("Google Maps failed to load.");
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

