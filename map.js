/* ===========================================================================
   PASTE YOUR TWO KEYS HERE. Nothing else in this file needs changing.
   Both are meant to be public. There is no billing attached to either.
   =========================================================================== */
const STADIA_KEY = 'e978f8f0-6773-474d-a0c2-97be1054428b';   // from client.stadiamaps.com
const JAWG_TOKEN = 'Yo67WMEobQW5tuw9U3Fw7sFeYvGjokLAXfWo5n02QCYpWBFwJuk2HGsYfpuuOQbF';   // from jawg.io
/* ======================================================================== */

const OSM = '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a>';
const NARROW = () => window.matchMedia('(max-width: 700px)').matches;

const map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([20, 0], 2);

/* --- basemaps. Note: no {r} in these URLs. Retina tiles get refused. ------ */
const terrain = L.tileLayer(
  `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`,
  { maxZoom: 18, attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> ' + OSM });

const streets = L.tileLayer(
  `https://tile.jawg.io/jawg-terrain/{z}/{x}/{y}.png?access-token=${JAWG_TOKEN}`,
  { maxZoom: 20, attribution: '&copy; <a href="https://jawg.io">Jawg Maps</a> ' + OSM });

terrain.addTo(map);
L.control.layers({ 'Terrain': terrain, 'Streets': streets }, null,
                 { position: 'topright', collapsed: false }).addTo(map);

/* --- one sound at a time, wherever it was started from ------------------- */
document.addEventListener('play', e => {
  document.querySelectorAll('audio').forEach(a => { if (a !== e.target) a.pause(); });
}, true);

const esc = t => String(t == null ? '' : t)
  .replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const prettyDate = iso => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' });
};

/* --- bubble contents, shared by the popup and the mobile panel ----------- */
function bubbleHtml(rec) {
  const date = prettyDate(rec.date);
  return `<h2>${esc(rec.title)}</h2>
    <audio controls preload="none" src="${esc(rec.audio)}"></audio>
    ${date ? `<p class="meta">${esc(date)}</p>` : ''}
    ${rec.note ? `<p class="meta">${esc(rec.note)}</p>` : ''}`;
}

/* --- the panel used on narrow screens instead of a pin-anchored popup ---- */
const sheet = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');

function openSheet(rec) {
  sheetBody.innerHTML = bubbleHtml(rec);
  sheet.hidden = false;
  sheet.classList.add('open');
}
function closeSheet() {
  sheet.classList.remove('open');
  sheetBody.innerHTML = '';          // stops playback
  sheet.hidden = true;
}
document.getElementById('sheet-close').onclick = closeSheet;

function closeEverything() {
  map.closePopup();
  closeSheet();
}
map.on('click', closeEverything);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEverything(); });

/* --- build the map from the data file ------------------------------------ */
fetch('data/recordings.json')
  .then(r => {
    if (!r.ok) throw new Error('recordings.json could not be loaded (' + r.status + ')');
    return r.json();
  })
  .then(recs => {
    const placed = recs.filter(r => r.lat != null && r.lng != null);   // FR-7c
    const list = document.getElementById('sr-list');

    placed.forEach(rec => {
      const marker = L.marker([rec.lat, rec.lng], {
        keyboard: true,
        alt: rec.title,
        icon: L.divIcon({
          className: 'pin',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: rec.colour ? `<i style="background:${esc(rec.colour)}"></i>` : '<i></i>'
        })
      }).addTo(map);

      if (!L.Browser.mobile) {
        marker.bindTooltip(rec.title, { direction: 'top', offset: [0, -11] });
      }

      marker.on('click', () => {
        closeEverything();
        if (NARROW()) openSheet(rec);
        else marker.bindPopup(bubbleHtml(rec), { minWidth: 290, maxWidth: 320 }).openPopup();
      });

      // FR-22: the same collection, reachable without seeing the map
      const li = document.createElement('li');
      li.innerHTML = `<h3>${esc(rec.title)}</h3>
        ${rec.date ? `<p>${esc(prettyDate(rec.date))}</p>` : ''}
        ${rec.note ? `<p>${esc(rec.note)}</p>` : ''}
        <audio controls preload="none" src="${esc(rec.audio)}"></audio>`;
      list.appendChild(li);
    });

    document.getElementById('sr-count').textContent =
      `${placed.length} field recording${placed.length === 1 ? '' : 's'}.`;
  })
  .catch(err => {
    document.getElementById('error').textContent =
      'The recordings could not be loaded. ' + err.message;
    document.getElementById('error').hidden = false;
  });
