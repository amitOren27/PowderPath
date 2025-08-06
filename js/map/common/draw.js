
export function getColorByDifficulty(difficulty) {
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

export function makeOutlinedCircle(fill, scale, strokeWeight) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight
  };
}


/** Solid piste segment polyline */
export function makePistePolyline(map, path, strokeColor) {
  return new google.maps.Polyline({
    map,
    path,
    strokeColor,
    strokeWeight: 2,
    strokeOpacity: 1,
    zIndex: 11,
    clickable: true
  });
}

/** Purple dotted lift overlay with white-outlined dots and larger endpoints */
export function makeLiftPolyline(map, path) {
  const DOT_COLOR       = '#7E57C2'; // purple
  const REPEAT_PX       = 14;        // spacing between mid-line dots
  const MID_DOT_SCALE   = 2;         // mid-line dot size
  const END_DOT_SCALE   = 3.2;       // start/end dot size
  const OUTLINE_WEIGHT  = 1;         // white outline thickness

  const midDot = makeOutlinedCircle(DOT_COLOR, MID_DOT_SCALE, OUTLINE_WEIGHT);
  const endDot = makeOutlinedCircle(DOT_COLOR, END_DOT_SCALE, OUTLINE_WEIGHT);

  return new google.maps.Polyline({
    map,
    path,
    strokeColor: '#7E57C2',
    strokeWeight: 1,
    strokeOpacity: 1,
    zIndex: 11,
    clickable: false,
    icons: [
      { icon: midDot, offset: '0', repeat: `${REPEAT_PX}px` }, // mid-line dots
      { icon: endDot, offset: '0' },                           // start
      { icon: endDot, offset: '100%' }                         // end
    ]
  });
}