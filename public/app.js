console.log('[CLIENT] Crime Watch application starting...');

const map = L.map('map').setView([54.3, -3], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

let userLocation = null;
let crimeMarkers = [];
let radiusCircle = null;
let currentSearchRadius = 1;
let currentSearchCenter = null;
let currentPlace = '';
let allCrimesForCurrentLocation = [];
let visibleCrimes = [];

const CATEGORY_COLORS = {
  'Anti Social Behaviour': '#e74c3c',
  'Bicycle Theft': '#e67e22',
  'Burglary': '#9b59b6',
  'Criminal Damage Arson': '#c0392b',
  'Drugs': '#27ae60',
  'Other Crime': '#7f8c8d',
  'Other Theft': '#16a085',
  'Possession Of Weapons': '#8e44ad',
  'Public Order': '#2980b9',
  'Robbery': '#d35400',
  'Shoplifting': '#2ecc71',
  'Theft From The Person': '#1abc9c',
  'Vehicle Crime': '#3498db',
  'Violence And Sexual Offences': '#922b21'
};
const FALLBACK_COLORS = ['#f39c12', '#6c5ce7', '#fd79a8', '#00b894', '#0984e3'];
let fallbackColorIndex = 0;
const resolvedCategoryColors = {};

const addressInput = document.getElementById('address-input');
const useLocationCheckbox = document.getElementById('use-location');
const findCrimeBtn = document.getElementById('find-crime-btn');
const statusMessage = document.getElementById('status-message');
const radiusSlider = document.getElementById('radius-slider');
const radiusInput = document.getElementById('radius-input');
const radiusDisplay = document.getElementById('radius-display');
const statsPanel = document.getElementById('stats-panel');
const statsTotal = document.getElementById('stats-total');
const statsSubtitle = document.getElementById('stats-subtitle');
const statsLocationLabel = document.getElementById('stats-location-label');
const statsBody = document.getElementById('stats-body');
const statsDate = document.getElementById('stats-date');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');

function formatCategory(raw) {
  return raw.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMonthDate(yyyyMM) {
  const [year, month] = yyyyMM.split('-');
  return new Date(year, Number(month) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatPostcode(postcode) {
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})$/);
  return match ? `${match[1]} ${match[2]}` : postcode.trim();
}

function normalizeQuery(query) {
  const cleaned = query.trim();
  if (!cleaned) return null;
  if (/^[A-Z]{1,2}\d/i.test(cleaned)) return formatPostcode(cleaned);
  return cleaned;
}

function setSearching(isSearching) {
  findCrimeBtn.disabled = isSearching;
  findCrimeBtn.textContent = isSearching ? '🔄 Searching...' : '🔎 Find Crime';
}

function showStatus(message, type = 'info') {
  statusMessage.style.display = 'block';
  statusMessage.className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'loading';
  statusMessage.textContent = message;
  if (type === 'success' || type === 'error') {
    setTimeout(() => { statusMessage.style.display = 'none'; }, 4500);
  }
}

function getCategoryColor(categoryName) {
  if (CATEGORY_COLORS[categoryName]) return CATEGORY_COLORS[categoryName];
  if (!resolvedCategoryColors[categoryName]) {
    resolvedCategoryColors[categoryName] = FALLBACK_COLORS[fallbackColorIndex % FALLBACK_COLORS.length];
    fallbackColorIndex += 1;
  }
  return resolvedCategoryColors[categoryName];
}

function updateRadiusDisplay(value) {
  const numeric = Math.max(0.25, Math.min(5, Number(value)));
  const rounded = Number(numeric.toFixed(2));
  currentSearchRadius = rounded;
  radiusDisplay.textContent = String(rounded);
  radiusSlider.value = String(rounded);
  radiusInput.value = String(rounded);
}

function calculateDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function filterCrimesByRadius(crimes, centerLat, centerLng, radiusMiles) {
  return crimes.filter((crime) => calculateDistanceMiles(centerLat, centerLng, crime.lat, crime.lng) <= radiusMiles);
}

function buildCategoryCounts(crimes) {
  const counts = {};
  crimes.forEach((crime) => {
    const category = formatCategory(crime.category);
    counts[category] = (counts[category] || 0) + 1;
  });
  return counts;
}

function clearCrimeMarkers() {
  crimeMarkers.forEach((marker) => map.removeLayer(marker));
  crimeMarkers = [];
}

function drawRadiusCircle(lat, lng, miles) {
  if (radiusCircle) map.removeLayer(radiusCircle);
  radiusCircle = L.circle([lat, lng], {
    color: '#337ab7',
    fillColor: '#337ab7',
    fillOpacity: 0.08,
    radius: miles * 1609.34,
    weight: 2,
    dashArray: '5,8'
  }).addTo(map);
}

function renderCrimeDots(crimes) {
  clearCrimeMarkers();
  crimes.forEach((crime) => {
    const category = formatCategory(crime.category);
    const color = getCategoryColor(category);
    const recorded = formatMonthDate(crime.date);
    const street = crime.street || 'Location not specified';

    const marker = L.circle([crime.lat, crime.lng], {
      color,
      fillColor: color,
      fillOpacity: 0.75,
      radius: 30,
      stroke: false
    }).addTo(map);

    const tooltipHtml = `
      <div class="crime-tip-title">${category}</div>
      <div class="crime-tip-row">📅 Recorded: ${recorded}</div>
      <div class="crime-tip-row">📍 ${street}</div>
    `;

    marker.bindTooltip(tooltipHtml, {
      className: 'crime-tip',
      direction: 'top',
      offset: [0, -8],
      opacity: 0.96
    });

    crimeMarkers.push(marker);
  });
}

function renderStatsPanel(categoryCounts, totalCrimes, place, monthText) {
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  statsPanel.style.display = 'block';
  statsTotal.textContent = String(totalCrimes);
  statsSubtitle.textContent = `crimes within ${currentSearchRadius} mile(s)`;
  statsLocationLabel.textContent = place.length > 18 ? `${place.slice(0, 18)}...` : place;
  statsDate.textContent = monthText;

  statsBody.innerHTML = '';
  if (sorted.length === 0) {
    statsBody.innerHTML = '<div class="help-text">No categories available for this result.</div>';
    return;
  }

  sorted.forEach(([category, count]) => {
    const widthPct = Math.max(6, Math.round((count / maxCount) * 100));
    const color = getCategoryColor(category);
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="category-row">
        <span class="category-swatch" style="background:${color}"></span>
        <span class="category-name">${category}</span>
        <span class="category-count">${count}</span>
      </div>
      <div class="category-bar-track">
        <div class="category-bar-fill" style="width:${widthPct}%;background:${color}"></div>
      </div>
    `;
    statsBody.appendChild(row);
  });
}

function renderCurrentResult() {
  if (!currentSearchCenter || allCrimesForCurrentLocation.length === 0) return;

  const filtered = filterCrimesByRadius(
    allCrimesForCurrentLocation,
    currentSearchCenter.lat,
    currentSearchCenter.lng,
    currentSearchRadius
  );
  visibleCrimes = filtered;

  drawRadiusCircle(currentSearchCenter.lat, currentSearchCenter.lng, currentSearchRadius);
  map.setView([currentSearchCenter.lat, currentSearchCenter.lng], 14);

  if (filtered.length === 0) {
    clearCrimeMarkers();
    renderStatsPanel({}, 0, currentPlace, 'No crimes in selected radius');
    showStatus('No crimes found in this radius. Increase the radius to see results.', 'error');
    return;
  }

  const categoryCounts = buildCategoryCounts(filtered);
  const monthText = formatMonthDate(filtered[0].date);
  renderCrimeDots(filtered);
  renderStatsPanel(categoryCounts, filtered.length, currentPlace, monthText);
  showStatus(`Found ${filtered.length} crimes in ${currentSearchRadius} mile(s).`, 'success');
}

async function fetchCrimeData(lat, lng) {
  const response = await fetch(`/api/crime?lat=${lat}&lng=${lng}`);
  if (!response.ok) throw new Error(`Could not fetch crime data (${response.status})`);
  return response.json();
}

async function geocodeAddress(address) {
  const normalized = normalizeQuery(address);
  if (!normalized) throw new Error('Enter a postcode, borough, village, or area first.');
  const response = await fetch(`/api/geocode?address=${encodeURIComponent(normalized)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not find that location.');
  }
  return response.json();
}

async function reverseGeocode(lat, lng) {
  const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
  if (!response.ok) return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  const data = await response.json();
  return data.formatted || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

async function handleSearch() {
  setSearching(true);
  try {
    let lat;
    let lng;
    let place;

    if (useLocationCheckbox.checked) {
      if (!userLocation) throw new Error('Location not available. Enable browser location and try again.');
      lat = userLocation.lat;
      lng = userLocation.lng;
      place = await reverseGeocode(lat, lng);
    } else {
      const query = addressInput.value;
      if (!query || query.trim().length < 2) {
        throw new Error('Enter a postcode, borough, village, or area name.');
      }
      showStatus('Looking up location...', 'info');
      const geocoded = await geocodeAddress(query);
      lat = geocoded.lat;
      lng = geocoded.lng;
      place = geocoded.formatted || query.trim();
    }

    showStatus('Fetching crime data...', 'info');
    const apiData = await fetchCrimeData(lat, lng);
    if (!apiData.crimes || apiData.crimes.length === 0) {
      throw new Error('No crime data returned for this location.');
    }

    currentSearchCenter = { lat, lng };
    currentPlace = place;
    allCrimesForCurrentLocation = apiData.crimes;
    renderCurrentResult();
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    setSearching(false);
  }
}

function exportToCSV(crimes, place) {
  const headers = ['Month', 'Category', 'Street', 'Latitude', 'Longitude'];
  const rows = [headers.join(',')];
  crimes.forEach((crime) => {
    rows.push([
      crime.date,
      `"${formatCategory(crime.category)}"`,
      `"${(crime.street || 'Location not specified').replace(/"/g, '""')}"`,
      crime.lat,
      crime.lng
    ].join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crime-data-${place.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToJSON(crimes, place) {
  const payload = {
    place,
    radiusMiles: currentSearchRadius,
    exportedAt: new Date().toISOString(),
    total: crimes.length,
    crimes: crimes.map((crime) => ({
      month: crime.date,
      category: formatCategory(crime.category),
      street: crime.street || 'Location not specified',
      lat: crime.lat,
      lng: crime.lng
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crime-data-${place.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      console.log(`[LOCATION] Ready: ${userLocation.lat}, ${userLocation.lng}`);
    },
    (error) => {
      console.log(`[LOCATION] Not available: ${error.message}`);
    }
  );
}

findCrimeBtn.addEventListener('click', handleSearch);
addressInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSearch();
  }
});

addressInput.addEventListener('input', (event) => {
  const value = event.target.value;
  if (value.length >= 5 && /^[A-Z]{1,2}\d/i.test(value.trim())) {
    const formatted = formatPostcode(value);
    if (formatted.includes(' ') && formatted !== value) {
      event.target.value = formatted;
    }
  }
});

useLocationCheckbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    addressInput.disabled = true;
    addressInput.placeholder = 'Using your current location...';
  } else {
    addressInput.disabled = false;
    addressInput.placeholder = 'e.g., SW1A 1AA, Camden, Manchester';
  }
});

radiusSlider.addEventListener('input', (event) => {
  updateRadiusDisplay(event.target.value);
  if (allCrimesForCurrentLocation.length > 0) renderCurrentResult();
});

radiusInput.addEventListener('input', (event) => {
  const value = Number(event.target.value);
  if (!Number.isNaN(value) && value >= 0.25 && value <= 5) {
    updateRadiusDisplay(value);
    if (allCrimesForCurrentLocation.length > 0) renderCurrentResult();
  }
});

exportCsvBtn.addEventListener('click', () => {
  if (visibleCrimes.length === 0) {
    showStatus('No visible crimes to export.', 'error');
    return;
  }
  exportToCSV(visibleCrimes, currentPlace || 'search');
  showStatus(`Exported ${visibleCrimes.length} crimes to CSV.`, 'success');
});

exportJsonBtn.addEventListener('click', () => {
  if (visibleCrimes.length === 0) {
    showStatus('No visible crimes to export.', 'error');
    return;
  }
  exportToJSON(visibleCrimes, currentPlace || 'search');
  showStatus(`Exported ${visibleCrimes.length} crimes to JSON.`, 'success');
});

updateRadiusDisplay(1);
console.log('[CLIENT] Ready');
