
let ready;

export function loadGoogle({ libraries = [] } = {}) {
  if (window.google?.maps) return Promise.resolve(window.google);

  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const apiKey = 'AIzaSyCNW_jNQe4wEgD8R_4XIMC2Ff95psP2MLQ';

      const params = new URLSearchParams({
        key: apiKey,
        v: 'weekly',
        libraries: libraries.join(',')
      });

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Failed to load Google Maps JS API'));
      document.head.appendChild(script);
    });
  }
  return ready;
}