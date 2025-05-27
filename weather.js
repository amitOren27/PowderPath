function loadWeather(url, buttonElement) {
      const iframe = document.getElementById('weather-iframe');
      const container = document.querySelector('.iframe-container');
  
      // Update iframe src
      iframe.src = url;
      container.style.display = 'flex';
  
      // Remove 'active' class from all buttons
      document.querySelectorAll('.weather-links button').forEach(btn => {
        btn.classList.remove('active');
      });
  
      // Add 'active' class to the clicked button
      if (buttonElement) {
        buttonElement.classList.add('active');
      }
    }
  
    // Load Val Thorens by default on page load
    window.onload = function () {
      const defaultBtn = document.querySelector('.weather-links button');
      loadWeather('https://www.valthorens.com/en/meteo/', defaultBtn);
    };