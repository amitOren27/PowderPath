
/** Build info window HTML for a piste feature. */
export function buildPisteInfo(feature) {
  const name       = feature.getProperty('name') || 'Unnamed trail';
  const difficulty = feature.getProperty('difficulty') || 'Unknown difficulty';
  return `<strong>${escapeHTML(name)}</strong><br>Difficulty: ${escapeHTML(difficulty)}`;
}

/** Build info window HTML for an aerialway feature. */
export function buildAerialwayInfo(feature) {
  const name = feature.getProperty('name') || 'Unnamed lift';
  const type = feature.getProperty('type') || 'Unknown type';
  return `<strong>${escapeHTML(name)}</strong><br>Type: ${escapeHTML(type)}`;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}