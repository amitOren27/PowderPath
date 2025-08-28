
import { loadGoogle } from '../maps/loader.js';
import { on } from '../core/events.js';
import {
  initRouteUI, render, positionOverlays, mountRecentUI, renderRecent
} from './ui.js';
import { getRoute, getAllowedDifficulties } from './state.js';

import * as draw from './draw.js';
import * as markers from './markers.js';
import { fetchMultiLeg } from './api.js';
import { getWalkingPath, getWalkingConnectors } from './walking.js';

import * as placePanel from '../map/ui/placepanel.js';
import { wirePOIClicks, makePin } from '../map/common/mapclicks.js';
import { fetchPlaceDetails } from '../map/common/details.js';

import { requireLogin } from '../core/auth.js';

import { saveRecentLocation } from './recent_locations.js';
import { fetchRecentLocations } from './recent_api.js';

import { saveRoute } from './saved_api.js';
import { initSavedRoutes, refreshSavedRoutes } from './saved_routes.js';


let currentAbort = null;
let _map = null;
let _highlightPolylines = [];
let _itSteps = [];

/** Build a list of LatLngLiteral, skipping empty pills (keeps order). */
function extractFilledStops(route) {
  const out = [];
  for (const stop of route.stops) {
    const ll = stop?.place?.geometry?.location;
    if (ll) out.push({ lat: ll.lat(), lng: ll.lng() });
  }
  return out;
}

function clearHighlight() {
  _highlightPolylines.forEach(pl => pl.setMap(null));
  _highlightPolylines = [];
}

// קבע זום קבוע לכל ההדגשות
const HIGHLIGHT_ZOOM = (window.innerWidth < 768) ? 15 : 16;

function showHighlight(pathOrPaths = []) {
  clearHighlight();
  if (!_map) return;

  // מאחד קלט: או [LatLng...] בודד או [[LatLng...], [LatLng...], ...]
  const isLatLngLike = p => p && (typeof p.lat === 'function' || ('lat' in p && 'lng' in p));
  const paths = Array.isArray(pathOrPaths) && pathOrPaths.length
    ? (isLatLngLike(pathOrPaths[0]) ? [pathOrPaths] : pathOrPaths.filter(a => Array.isArray(a) && a.length > 1))
    : [];

  if (!paths.length) return;

  const bounds = new google.maps.LatLngBounds();

  paths.forEach(segPath => {
    const latlngs = segPath.map(p => (typeof p.lat === 'function') ? p : new google.maps.LatLng(p.lat, p.lng));
    latlngs.forEach(pt => bounds.extend(pt));

    const pl = new google.maps.Polyline({
      map: _map,
      path: latlngs,
      strokeColor: '#1a73e8',
      strokeOpacity: 0.95,
      strokeWeight: 6,
      zIndex: 300
    });
    _highlightPolylines.push(pl);
  });

  // מרכז + זום קבוע (ללא fitBounds אגרסיבי)
  const center = bounds.getCenter();
  _map.panTo(center);
  if (Math.abs((_map.getZoom() || 0) - HIGHLIGHT_ZOOM) > 0.3) {
    _map.setZoom(HIGHLIGHT_ZOOM);
  }
}

async function bootstrap() {
  const userId = await requireLogin();

  await loadGoogle({ libraries: ['places', 'marker', 'geometry'] });

  // Map init
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 45.297, lng: 6.58 },
    zoom: 14,
    mapTypeId: 'terrain',
    mapId: 'POWDERPATH_BASE'
  });
  _map = map; // ← חשוב להדגשה

  let poiMarker = null; // marker for POI clicks (separate from route pins)

  // Init overlays module with the map
  draw.init(map);

  // Init marker handling for the map
  markers.init(map);

  // UI init
  // UI init
  initRouteUI();
  const itUI = wireItineraryUI();

  await initSavedRoutes();
  const saveBtn = document.getElementById('save-route-btn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    try {
      const route = getRoute();
      const stops = route?.stops || [];
      const s0 = stops[0]?.place?.geometry?.location;
      const s1 = stops[1]?.place?.geometry?.location;

      if (!s0 || !s1) {
        alert('Please set both Origin and Destination before saving.');
        return;
      }

      const start = {
        name: stops[0]?.place?.name || 'Start',
        lat: typeof s0.lat === 'function' ? s0.lat() : s0.lat,
        lng: typeof s0.lng === 'function' ? s0.lng() : s0.lng
      };
      const end = {
        name: stops[1]?.place?.name || 'End',
        lat: typeof s1.lat === 'function' ? s1.lat() : s1.lat,
        lng: typeof s1.lng === 'function' ? s1.lng() : s1.lng
      };
      const route_name = `${start.name} → ${end.name}`;

      const res = await saveRoute({ start, end, route_name });
      if (!res?.ok) {
        console.error('[save-route] failed:', res);
        alert('Saving route failed.');
        return;
      }
      await refreshSavedRoutes();
    } catch (err) {
      console.error('[save-route] error:', err);
      alert('Network error while saving route.');
    }
  });
  document.addEventListener('saved:select', onSavedRouteSelect);



  // ---- RECENT PLACES: תמיד מתחת ל-Difficulties ----
  const dropdown = document.getElementById('diff-dropdown');
  const diffPanel = document.getElementById('diff-panel');

  // ודא שקיים עוגן מחוץ ל-dropdown
  let recentAnchor = document.getElementById('recent-root');
  if (!recentAnchor) {
    recentAnchor = document.createElement('div');
    recentAnchor.id = 'recent-root';
    recentAnchor.className = 'recent hidden';
    // מציב את העוגן מייד אחרי ה-<details id="diff-dropdown">
    (dropdown || document.getElementById('route-form') || document.body)
      .insertAdjacentElement('afterend', recentAnchor);
  }

  // מרכיבים את ה-UI של Recent על האלמנט עצמו (לא מחרוזת!)
  try {
    if (typeof mountRecentUI === 'function') {
      mountRecentUI({ anchor: recentAnchor });
    }
  } catch (e) {
    console.error('[recent] mount failed:', e);
  }

  // פונקציה שמוציאה כל .recent שהוזרקה בטעות לתוך ה-dropdown
  const moveRecentOut = () => {
    const inside = diffPanel?.querySelector('.recent');
    if (inside && inside !== recentAnchor) {
      recentAnchor.replaceWith(inside);
      inside.id = 'recent-root';
      recentAnchor = inside;
    }
    recentAnchor.classList.remove('hidden');
  };

  // הפעלה ראשונית + שמירה מפני הזרקות עתידיות
  moveRecentOut();
  if (diffPanel) {
    new MutationObserver(moveRecentOut).observe(diffPanel, { childList: true, subtree: true });
  }

  // טעינת נתונים והצגה
  try {
    const recent = await fetchRecentLocations(10);
    if (typeof renderRecent === 'function') {
      renderRecent(recent);
    }
  } catch (e) {
    console.error('[recent] load failed:', e);
  }




  // Places plumbing (shared with home page)
  const infoWindow = new google.maps.InfoWindow();
  const placesSvc = new google.maps.places.PlacesService(map);

  wirePOIClicks({
    map,
    placesSvc,
    infoWindow,
    placePanel,
    onPOIClick: (e) => {
      // Drop/update a marker at the clicked POI
      const pin = makePin();
      if (!poiMarker) {
        poiMarker = new google.maps.marker.AdvancedMarkerElement({
          map, position: e.latLng, content: pin.element, zIndex: 50
        });
      } else {
        poiMarker.position = e.latLng;
        poiMarker.content = pin.element;
        poiMarker.map = map;
      }
    },
    onBlankMapClick: () => {
      // Clear the POI marker
      if (poiMarker) { poiMarker.map = null; }
    }
  });

  // When any pill selects a place: pan/zoom like on the home map, then open the details panel
  on('route:placeSelected', async (ev) => {
    const place = ev.detail?.place;
    if (!place || !place.geometry) return;
    const loc = place.geometry.location;
    map.panTo(loc);
    map.setZoom(17);
    const name = place.name || place.formatted_address || place.vicinity || 'Unnamed';
    const lat = (typeof loc.lat === 'function') ? loc.lat() : loc.lat;
    const lng = (typeof loc.lng === 'function') ? loc.lng() : loc.lng;

    try {
      await saveRecentLocation({ user_id: userId, name, lat, lng });
      const recent = await fetchRecentLocations(10);
      renderRecent(recent);
    } catch (err) {
      console.error('[recent] save/load recent failed:', err);
    }

  });

  // Re-render UI and redraw route whenever the store changes
  on('route:changed', async () => {
    render();

    // Cancel any in-flight routing
    if (currentAbort) currentAbort.abort();
    currentAbort = new AbortController();
    const { signal } = currentAbort;

    // Keep pins synced with pills
    markers.sync(getRoute());

    try {
      const filled = extractFilledStops(getRoute()); // [{lat,lng}, ... filled only, order kept]
      if (filled.length < 2) {
        draw.clearRoute();
        clearItinerary();
        clearHighlight();

        return;
      }

      const allowed = getAllowedDifficulties();
      const { path, segments, fallbacks, walking } =
        await fetchMultiLeg(filled, signal, { allowedDifficulties: allowed });

      // Clear then draw
      draw.clearRoute();
      clearHighlight();
      draw.drawSegments(segments);
      draw.drawFallbacks(fallbacks);
      const walkPromises = [];
      const connectorPaths = [];
      for (const hint of (walking || [])) {
        if (hint?.toSnap?.origin && hint?.toSnap?.destination) {
          walkPromises.push(
            getWalkingPath(hint.toSnap.origin, hint.toSnap.destination, signal)
              .then(path => {
                const conns = getWalkingConnectors(hint.toSnap.origin, hint.toSnap.destination, path);
                if (conns.length) connectorPaths.push(...conns);
                return path;
              })
              .catch(() => [])
          );
        }
        if (hint?.fromSnap?.origin && hint?.fromSnap?.destination) {
          walkPromises.push(
            getWalkingPath(hint.fromSnap.origin, hint.fromSnap.destination, signal)
              .then(path => {
                const conns = getWalkingConnectors(hint.fromSnap.origin, hint.fromSnap.destination, path);
                if (conns.length) connectorPaths.push(...conns);
                return path;
              })
              .catch(() => [])
          );
        }
      }
      const walkResults = await Promise.all(walkPromises);
      const walkPaths = walkResults.filter(p => Array.isArray(p) && p.length > 1);
      draw.drawWalkingPolylines(walkPaths);
      draw.drawWalkingConnectors(connectorPaths);
      draw.fitToRoute(path, fallbacks);
      updateItinerary({
        segments,
        walkPaths,
        fallbacks,
        totalPath: path
      });


    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('[route] failed:', err);
      draw.clearRoute();
      clearItinerary();
      clearHighlight();
    }
  });

  // Keep overlays aligned in the side panel
  window.addEventListener('resize', positionOverlays);
}


bootstrap();
function km(meters) { return (meters / 1000).toFixed(2) + ' km'; }

function lengthOfPath(path = []) {
  try {
    const g = google.maps.geometry?.spherical;
    if (!g) return 0;
    // תומך במערכים של {lat,lng} או LatLng
    const latlngs = path.map(p => (typeof p.lat === 'function' ? p : new google.maps.LatLng(p.lat, p.lng)));
    return g.computeLength(latlngs);
  } catch { return 0; }
}
function computeSortKey(item, routePts = []) {
  // אוספים את כל ה-pathים של הפריט (path יחיד או כמה paths)
  const paths = [];
  if (Array.isArray(item.path) && item.path.length) paths.push(item.path);
  if (Array.isArray(item.paths)) {
    item.paths.forEach(p => { if (Array.isArray(p) && p.length) paths.push(p); });
  }
  if (!routePts?.length || !paths.length) return Number.MAX_SAFE_INTEGER;

  // משתמשים בשני הקצוות (first+last) כדי לא להיות תלויים בכיוון המערך
  let best = Number.MAX_SAFE_INTEGER;
  for (const p of paths) {
    const first = p[0];
    const last = p[p.length - 1];
    const i1 = nearestVertexIndex(routePts, first);
    const i2 = nearestVertexIndex(routePts, last);
    best = Math.min(best, i1, i2);
  }
  return best;
}

function toLatLng(p) { return (typeof p?.lat === 'function') ? p : new google.maps.LatLng(p.lat, p.lng); }
function nearestVertexIndex(poly = [], point) {
  if (!poly?.length || !point) return Number.MAX_SAFE_INTEGER;
  const g = google.maps.geometry?.spherical, pt = toLatLng(point);
  let bestIdx = 0, best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const d = g.computeDistanceBetween(toLatLng(poly[i]), pt);
    if (d < best) { best = d; bestIdx = i; }
  }
  return bestIdx;
}


// נרמול שם למסך־מפתח: מוריד דיאקריטיים, יידוע התחלתי, המילה "piste", רווחים כפולים
function normalizeNameKey(raw) {
  if (!raw) return 'unnamed';
  let s = String(raw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // הסרת דיאקריטיים
    .toLowerCase().trim();

  // הסרת יידוע בתחילת המחרוזת (שפות נפוצות)
  s = s.replace(/^(la|le|les|l'|the|el|il|lo|los|las)\s+/, '');
  // הסרת המילה "piste" אם קיימת
  s = s.replace(/\bpiste\b/g, '');
  // ניקוי רווחים
  s = s.replace(/\s+/g, ' ').trim();

  return s || 'unnamed';
}


// מזהה רכבל גם כשמגיע דרך fallbacks/תגיות שונות
function isLift(seg = {}) {
  const low = s => (s || '').toString().toLowerCase();

  const t = low(seg.type || seg.segment_type || seg.mode || seg.category || seg.kind);
  const name = low(seg.name || seg.piste_name || seg?.edge?.name || seg?.edge?.tags?.name);
  const aerial = low(
    seg.aerialway || seg.lift_type || seg?.tags?.aerialway ||
    seg?.edge?.aerialway || seg?.edge?.tags?.aerialway
  );

  const any = (s) =>
    ['lift', 'aerialway', 'gondola', 'tram', 'telecab', 'télécabine', 'téléphérique',
      'chair', 'cable', 'funicular', 'rope', 't-bar', 'drag', 'carpet'].some(tok => s.includes(tok));

  return !!aerial || any(t) || any(name);
}

function segPath(seg = {}) {
  if (Array.isArray(seg.path) && seg.path.length) return seg.path;
  const enc = seg.polyline || seg.encodedPath || seg.edge?.polyline;
  if (enc && google?.maps?.geometry?.encoding) {
    return google.maps.geometry.encoding.decodePath(enc); // מחזיר Array<LatLng>
  }
  return [];
}
// מאחד סגמנטים רצופים ומסווג: ski אם יש קושי; אחרת lift (ברירת מחדל)
// מאחד סגמנטים רצופים ומסווג: ski אם יש קושי; אחרת lift. שומר גם path מאוחד.
// מאחד סגמנטים רצופים ומסווג: ski אם יש קושי; אחרת lift. שומר גם path מאוחד.
// איחוד רצפים: ski אם יש קושי; אחרת lift. נרמול שם לאיחוד, "Unnamed" יורש את שם הקודם.
function compactMixedSegments(allSegs = []) {
  const out = [];

  for (const seg of allSegs) {
    const hasDiff = !!(seg?.difficulty || seg?.piste_difficulty);
    const type = hasDiff ? 'ski' : 'lift';

    const rawName =
      seg?.name || seg?.piste_name || seg?.lift_name ||
      seg?.edge?.name || seg?.edge?.tags?.name ||
      (type === 'lift' ? 'Unnamed lift' : 'Unnamed piste');

    let key = normalizeNameKey(rawName);
    const diff = hasDiff ? (seg?.difficulty || seg?.piste_difficulty || '').trim() : '';

    const path = segPath(seg);
    const dist = lengthOfPath(path);

    const last = out[out.length - 1];

    // אם השם "unnamed" ורצף זהה (type+diff) – ירושה של המפתח מהקודם כדי להתאחד
    if (key === 'unnamed' && last && last.type === type && last.diff === diff) {
      key = last.nameKey;
    }

    if (last && last.type === type && last.diff === diff && last.nameKey === key) {
      // מאחדים לרצף קיים
      last.dist += dist;
      if (path?.length) last.path = (last.path || []).concat(path);

      // אם לשם הקודם היה "Unnamed..." ולעכשווי יש שם אמיתי – שדרג את התצוגה
      if (/^unnamed/i.test(last.name) && !/^unnamed/i.test(rawName)) {
        last.name = rawName;
      }
    } else {
      // פותחים רצף חדש
      out.push({
        type,
        name: rawName,   // שם לתצוגה (עם אותיות גדולות/יידוע)
        nameKey: key,    // מפתח מאוחד לאיחוד
        diff,
        dist,
        path: path || []
      });
    }
  }

  return out;
}




// מאחד הליכות רצופות – שומר סכום מרחק וגם path מאוחד
function compactWalks(walkPaths = []) {
  return (walkPaths || [])
    .filter(p => Array.isArray(p) && p.length > 1)
    .map(p => ({ type: 'walk', dist: lengthOfPath(p), path: p }));
}


function wireItineraryUI() {
  const panel = document.getElementById('itinerary');
  const toggle = document.getElementById('itinerary-toggle');
  const close = document.getElementById('it-close');
  if (!panel || !toggle) return;
  const open = () => { panel.classList.remove('collapsed'); toggle.setAttribute('aria-expanded', 'true'); };
  const collapse = () => { panel.classList.add('collapsed'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => panel.classList.contains('collapsed') ? open() : collapse());
  close?.addEventListener('click', collapse);
  return { open, collapse };
}

function clearItinerary() {
  document.getElementById('it-summary')?.replaceChildren();
  document.getElementById('it-steps')?.replaceChildren();
  document.getElementById('itinerary')?.classList.add('collapsed');
}

function updateItinerary({ segments = [], walkPaths = [], fallbacks = [], totalPath = [] } = {}) {
  const summaryEl = document.getElementById('it-summary');
  const stepsEl = document.getElementById('it-steps');
  if (!summaryEl || !stepsEl) return;

  // מסלול כולל (לפי סדר) לשיוך פריטים למיקום הנכון
  const routePts = Array.isArray(totalPath) ? totalPath : [];

  // סקי/רכבל (מאוחדים לפי שם/קושי) + גם fallbacks
  const mixed = compactMixedSegments([...(segments || []), ...((fallbacks || []))]);
  // הליכות – פריטים נפרדים (לא מאוחדים)
  const walkItems = compactWalks(walkPaths);

  // מוסיפים sortKey עמיד (לפי שני קצות המקטע) ואינדקס מקורי למיון יציב
  let items = [...mixed, ...walkItems].map((it, idx) => ({
    ...it,
    sortKey: computeSortKey(it, routePts),
    _idx: idx
  }));

  // מיון כרונולוגי לאורך המסלול
  items.sort((a, b) => (a.sortKey === b.sortKey) ? (a._idx - b._idx) : (a.sortKey - b.sortKey));

  // חישובי מרחקים לפי סוג
  const skiDist = items.filter(s => s.type === 'ski').reduce((a, s) => a + (s.dist || 0), 0);
  const liftDist = items.filter(s => s.type === 'lift').reduce((a, s) => a + (s.dist || 0), 0);
  const walkDist = items.filter(s => s.type === 'walk').reduce((a, s) => a + (s.dist || 0), 0);
  const totalDist = skiDist + liftDist + walkDist;

  summaryEl.innerHTML = `
    <div><strong>Total:</strong> ${km(totalDist)}</div>
    <div>
      Ski: ${km(skiDist)}
      ${liftDist ? ` • Lift: ${km(liftDist)}` : ''}
      ${walkDist ? ` • Walk: ${km(walkDist)}` : ''}
    </div>
    ${fallbacks?.length ? `<div>Includes ${fallbacks.length} fallback segment(s)</div>` : ''}
  `;

  // בניית רשימת צעדים עם הנתיב של כל צעד
  _itSteps = items;

  const rows = _itSteps.map(({ type, name, diff, dist }, idx) => {
    const icon = (type === 'lift') ? 'tram' : (type === 'ski' ? 'downhill_skiing' : 'directions_walk');
    const label = name || (type === 'lift' ? 'Lift' : type === 'ski' ? 'Piste' : 'Walk connector');
    const extra = (type === 'ski' && diff) ? ` · <span style="color:#5f6368">${diff}</span>` : '';
    return `
      <li data-step-idx="${idx}">
        <div class="icon"><span class="material-icons">${icon}</span></div>
        <div class="name">${label}${extra}</div>
        <div class="meta">${km(dist || 0)}</div>
      </li>
    `;
  }).join('');

  stepsEl.innerHTML = rows;
  document.getElementById('itinerary')?.classList.remove('collapsed');

  // קליק על שורה → הדגשת המקטע המתאים (בלי לחבר הליכות שונות)
  stepsEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      stepsEl.querySelectorAll('li.active').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      const idx = parseInt(li.getAttribute('data-step-idx'), 10);
      const step = _itSteps[idx];
      showHighlight(step?.path || step?.paths || []);
    });
  });
}

async function onSaveRouteClick() {
  try {
    // מוציאים את שתי העצירות הראשונות מה-store (Origin/Destination)
    const route = getRoute();
    const stops = route?.stops || [];
    const s0 = stops[0]?.place?.geometry?.location;
    const s1 = stops[1]?.place?.geometry?.location;

    if (!s0 || !s1) {
      alert('Please set both Origin and Destination before saving.');
      return;
    }

    const start = {
      name: stops[0]?.place?.name || 'Start',
      lat: typeof s0.lat === 'function' ? s0.lat() : s0.lat,
      lng: typeof s0.lng === 'function' ? s0.lng() : s0.lng
    };
    const end = {
      name: stops[1]?.place?.name || 'End',
      lat: typeof s1.lat === 'function' ? s1.lat() : s1.lat,
      lng: typeof s1.lng === 'function' ? s1.lng() : s1.lng
    };
    const route_name = `${start.name} → ${end.name}`;

    // POST → Lambda (עם user_id מתוך requireLogin שמנוהל בתוך saveRoute)
    const res = await saveRoute({ start, end, route_name });
    if (!res?.ok) {
      console.error('[save-route] failed:', res);
      alert('Saving route failed.');
      return;
    }

    // רענון רשימת ה-Saved (GET מחדש)
    await refreshSavedRoutes();

  } catch (err) {
    console.error('[save-route] error:', err);
    alert('Network error while saving route.');
  }
}
async function onSavedRouteSelect(ev) {
  const item = ev?.detail;
  if (!item?.start || !item?.end) return;

  try {
    // נתוני קלט לרואטר
    const filled = [
      { lat: Number(item.start.lat), lng: Number(item.start.lng) },
      { lat: Number(item.end.lat), lng: Number(item.end.lng) }
    ];

    // קוראים לרואטר בדיוק כמו ב-route:changed (עם אותם כללים)
    const allowed = getAllowedDifficulties();
    const { path, segments, fallbacks, walking } =
      await fetchMultiLeg(filled, undefined, { allowedDifficulties: allowed });

    // ניקוי ציור קודם
    draw.clearRoute();

    // ציור הסגמנטים
    draw.drawSegments(segments);
    draw.drawFallbacks(fallbacks);

    // חישובי הליכה (אם קיימים)
    const walkPromises = [];
    const connectorPaths = [];
    for (const hint of (walking || [])) {
      if (hint?.toSnap?.origin && hint?.toSnap?.destination) {
        walkPromises.push(
          getWalkingPath(hint.toSnap.origin, hint.toSnap.destination)
            .then(p => {
              const c = getWalkingConnectors(hint.toSnap.origin, hint.toSnap.destination, p);
              if (c.length) connectorPaths.push(...c); return p;
            })
            .catch(() => [])
        );
      }
      if (hint?.fromSnap?.origin && hint?.fromSnap?.destination) {
        walkPromises.push(
          getWalkingPath(hint.fromSnap.origin, hint.fromSnap.destination)
            .then(p => {
              const c = getWalkingConnectors(hint.fromSnap.origin, hint.fromSnap.destination, p);
              if (c.length) connectorPaths.push(...c); return p;
            })
            .catch(() => [])
        );
      }
    }
    const walkResults = await Promise.all(walkPromises);
    const walkPaths = walkResults.filter(p => Array.isArray(p) && p.length > 1);
    draw.drawWalkingPolylines(walkPaths);
    draw.drawWalkingConnectors(connectorPaths);

    // התאמת תצוגה למסלול + פירוט
    draw.fitToRoute(path, fallbacks);
    updateItinerary({ segments, walkPaths, fallbacks, totalPath: path });

    // UX קטן: למלא את שני השדות בטופס כדי שהמשתמש יראה מה נבחר
    const o = document.getElementById('origin-input');
    const d = document.getElementById('destination-input');
    if (o) o.value = item.start.name || `${item.start.lat}, ${item.start.lng}`;
    if (d) d.value = item.end.name || `${item.end.lat}, ${item.end.lng}`;

  } catch (err) {
    console.error('[saved:select] failed:', err);
    draw.clearRoute();
    // אם יש אצלך clearItinerary() – אפשר לקרוא גם לו
  }
}
