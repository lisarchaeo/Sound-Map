/* Keys live in config.js, which is loaded first and never replaced by updates. */

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
    <audio controls controlsList="nodownload" preload="none" src="${esc(rec.audio)}"></audio>
    ${date ? `<p class="meta">Recorded ${esc(date)}</p>` : ''}
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

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        closeSheet();
        if (NARROW()) {
          map.closePopup();
          openSheet(rec);
        } else {
          // openOn() closes any popup already showing, so only one is ever open.
          L.popup({ minWidth: 290, maxWidth: 320, autoPanPadding: [24, 24] })
            .setLatLng(marker.getLatLng())
            .setContent(bubbleHtml(rec))
            .openOn(map);
        }
      });

      // FR-22: the same collection, reachable without seeing the map
      const li = document.createElement('li');
      li.innerHTML = `<h3>${esc(rec.title)}</h3>
        ${rec.date ? `<p>Recorded ${esc(prettyDate(rec.date))}</p>` : ''}
        ${rec.note ? `<p>${esc(rec.note)}</p>` : ''}
        <audio controls controlsList="nodownload" preload="none" src="${esc(rec.audio)}"></audio>`;
      list.appendChild(li);
    });

    document.getElementById('sr-count').textContent =
      `${placed.length} field recording${placed.length === 1 ? '' : 's'}.`;
  })
  .catch(err => {
    const box = document.getElementById('error');
    if (location.protocol === 'file:') {
      // Browsers refuse to let a page opened from disk read files next to it.
      // Nothing is wrong with the site; it simply cannot be previewed this way.
      box.innerHTML = '<strong>This page needs to be online to work.</strong><br><br>' +
        'Your browser will not let a page opened from your computer read the recordings ' +
        'file sitting beside it. That is a security rule, not a fault in the site. ' +
        'Upload everything to GitHub and it will work immediately.';
    } else {
      box.innerHTML = '<strong>The recordings could not be loaded.</strong><br><br>' +
        'Check that <code>data/recordings.json</code> exists and that the file is valid. ' +
        '<br><br><small>' + String(err.message) + '</small>';
    }
    box.hidden = false;
  });
