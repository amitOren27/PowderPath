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
    const inputColumn = document.getElementById("inputs-container");
    const destinationInput = document.getElementById("destination-location");

    // Create a wrapper row for the new stop input and delete button
    const stopRow = document.createElement("div");
    stopRow.className = "input-row";

    const stopInput = document.createElement("input");
    stopInput.type = "text";
    stopInput.className = "route-input";
    stopInput.placeholder = "Stop";

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "✖";
    deleteBtn.className = "delete-stop-btn";
    deleteBtn.onclick = () => stopRow.remove();

    stopRow.appendChild(stopInput);
    stopRow.appendChild(deleteBtn);

    // Insert the new stop row right before the destination input row
    const rows = inputColumn.querySelectorAll(".input-row");
    const destinationRow = [...rows].find(row => row.contains(destinationInput));
    inputColumn.insertBefore(stopRow, destinationRow);

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

