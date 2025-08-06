
export function fetchPlaceDetails(placesSvc, placeId) {
  if (!placeId) return Promise.resolve(null);
  return new Promise((resolve) => {
    placesSvc.getDetails({
      placeId,
      fields: [
        'place_id','name','rating','user_ratings_total',
        'formatted_address','international_phone_number','geometry',
        'photos','website','url',
        'types','price_level','business_status',
        'opening_hours','current_opening_hours','utc_offset_minutes'
      ]
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        resolve(place);
      } else {
        resolve(null);
      }
    });
  });
}
