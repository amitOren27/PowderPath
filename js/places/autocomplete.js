
export function attachAutocomplete(inputEl, {
  fields = ['place_id', 'geometry', 'name', 'formatted_address'],
  onPlace
} = {}) {
  const ac = new google.maps.places.Autocomplete(inputEl, { fields });
  if (typeof onPlace === 'function') {
    ac.addListener('place_changed', () => onPlace(ac.getPlace()));
  }
  return ac;
}