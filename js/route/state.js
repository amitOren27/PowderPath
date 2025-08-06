
import { emit } from '../core/events.js';

const route = {
  stops: [
    { type: 'origin',       place: null },
    { type: 'destination',  place: null }
  ]
};

function syncTypes() {
  if (route.stops.length < 2) return;
  route.stops[0].type = 'origin';
  route.stops[route.stops.length - 1].type = 'destination';
  for (let i = 1; i < route.stops.length - 1; i++) {
    route.stops[i].type = 'intermediate';
  }
}

export function getRoute() {
  return route;
}

export function addStopBeforeDestination() {
  route.stops.splice(route.stops.length - 1, 0, { type: 'intermediate', place: null });
  syncTypes();
  emit('route:changed', { route });
}

export function removeStopAt(index) {
  if (index <= 0 || index >= route.stops.length - 1) return; // don't remove ends
  route.stops.splice(index, 1);
  syncTypes();
  emit('route:changed', { route });
}

export function swapEnds() {
  const last = route.stops.length - 1;
  [route.stops[0], route.stops[last]] = [route.stops[last], route.stops[0]];
  syncTypes();
  emit('route:changed', { route });
}

export function setPlaceAt(index, place) {
  if (!route.stops[index]) return;
  route.stops[index].place = place ?? null;
  emit('route:changed', { route });
}