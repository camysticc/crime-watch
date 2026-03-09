console.log('[CLIENT] Crime Watch application starting...');

// Initialize map
const map = L.map('map').setView([54.3, -3], 6);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

console.log('[CLIENT] Map initialized');

// Global variables
let userLocation = null;
let crimeMarkers = [];
let currentChart = null;
let radiusCircle = null;
let currentCrimeData = null;
let currentSearchRadius = 1;
let currentSearchLocation = null;

// Color palette for crime categories (matching original)
const categoryColors = {
  'Anti Social Behaviour': '#1B9E77',
  'Bicycle Theft': '#D95F02',
  'Burglary': '#7570B3',
  'Criminal Damage Arson': '#E7298A',
  'Drugs': '#66A61E',
  'Other Crime': '#E6AB02',
  'Other Theft': '#1B9E77',
  'Possession Of Weapons': '#D95F02',
  'Public Order': '#7570B3',
  'Robbery': '#E7298A',
  'Shoplifting': '#66A61E',
  'Theft From The Person': '#E6AB02',
  'Vehicle Crime': '#1B9E77',
  'Violence And Sexual Offences': '#D95F02',
  'hover-for-detail': '#999999'
};

// Get user's location
if (navigator.geolocation) {
  console.log('[LOCATION] Requesting user location...');
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      console.log(`[LOCATION] User location obtained: lat=${userLocation.lat}, lng=${userLocation.lng}`);
    },
    (error) => {
      console.log(`[LOCATION] Failed to get user location: ${error.message}`);
    }
  );
} else {
  console.log('[LOCATION] Geolocation not supported by browser');
}

// UI Elements
const addressInput = document.getElementById('address-input');
const useLocationCheckbox = document.getElementById('use-location');
const findCrimeBtn = document.getElementById('find-crime-btn');
const statusMessage = document.getElementById('status-message');
const chartContainer = document.getElementById('chart-container');
const radiusSlider = document.getElementById('radius-slider');
const radiusInput = document.getElementById('radius-input');
const radiusDisplay = document.getElementById('radius-display');
const exportSection = document.getElementById('export-section');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const statsSummary = document.getElementById('stats-summary');

// Format UK postcode to standard format
function formatPostcode(postcode) {
  // Remove extra spaces and convert to uppercase
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  
  // UK postcode patterns
  // Format: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
  const postcodeRegex = /^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})$/;
  const match = cleaned.match(postcodeRegex);
  
  if (match) {
    // Add space in the middle
    return `${match[1]} ${match[2]}`;
  }
  
  // Return original if doesn't match postcode pattern
  return postcode.trim();
}

// Validate and enhance search query
function enhanceSearchQuery(query) {
  const cleaned = query.trim();
  
  if (!cleaned) {
    return null;
  }
  
  // Check if it looks like a postcode (contains numbers and letters)
  if (/^[A-Z]{1,2}\d/.test(cleaned.toUpperCase())) {
    const formatted = formatPostcode(cleaned);
    console.log(`[INPUT] Detected postcode format: "${query}" -> "${formatted}"`);
    return formatted;
  }
  
  // Otherwise return as-is (for areas, cities, villages)
  console.log(`[INPUT] Using search query: "${cleaned}"`);
  return cleaned;
}

// Sync radius controls
function updateRadiusDisplay(value) {
  const radius = parseFloat(value).toFixed(2);
  radiusDisplay.textContent = radius;
  radiusSlider.value = value;
  radiusInput.value = value;
  currentSearchRadius = parseFloat(value);
  console.log(`[RADIUS] Updated to ${radius} mile(s)`);
}

// Draw radius circle on map
function drawRadiusCircle(lat, lng, radiusMiles) {
  // Remove existing circle
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
  }
  
  // Convert miles to meters (1 mile = 1609.34 meters)
  const radiusMeters = radiusMiles * 1609.34;
  
  radiusCircle = L.circle([lat, lng], {
    color: '#337ab7',
    fillColor: '#337ab7',
    fillOpacity: 0.1,
    radius: radiusMeters,
    weight: 2,
    dashArray: '5, 10'
  }).addTo(map);
  
  console.log(`[MAP] Drew search radius circle: ${radiusMiles} mile(s)`);
}

// Calculate distance between two points in miles
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Filter crimes by radius
function filterCrimesByRadius(crimes, centerLat, centerLng, radiusMiles) {
  return crimes.filter(crime => {
    const distance = calculateDistance(centerLat, centerLng, crime.lat, crime.lng);
    return distance <= radiusMiles;
  });
}

// Export data as CSV
function exportToCSV(crimes, place) {
  console.log('[EXPORT] Generating CSV...');
  
  const headers = ['Date', 'Category', 'Street', 'Latitude', 'Longitude'];
  const rows = [headers.join(',')];
  
  crimes.forEach(crime => {
    const categoryFormatted = crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const row = [
      crime.date,
      `"${categoryFormatted}"`,
      `"${crime.street || 'No location'}"`,
      crime.lat,
      crime.lng
    ];
    rows.push(row.join(','));
  });
  
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `crime-data-${place.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log(`[EXPORT] CSV downloaded: ${crimes.length} records`);
  showStatus(`✅ Exported ${crimes.length} records to CSV`, 'success');
}

// Export data as JSON
function exportToJSON(crimes, place, radius) {
  console.log('[EXPORT] Generating JSON...');
  
  const exportData = {
    location: place,
    searchRadius: `${radius} mile(s)`,
    exportDate: new Date().toISOString(),
    totalCrimes: crimes.length,
    crimes: crimes.map(crime => ({
      date: crime.date,
      category: crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      street: crime.street || 'No location',
      latitude: crime.lat,
      longitude: crime.lng,
      id: crime.id
    }))
  };
  
  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `crime-data-${place.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log(`[EXPORT] JSON downloaded: ${crimes.length} records`);
  showStatus(`✅ Exported ${crimes.length} records to JSON`, 'success');
}

// Show status message
function showStatus(message, type = 'info') {
  console.log(`[UI] Status: ${message} (${type})`);
  
  statusMessage.style.display = 'block';
  statusMessage.className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'loading';
  statusMessage.innerHTML = message;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }
}

// Clear markers from map
function clearMarkers() {
  crimeMarkers.forEach(marker => map.removeLayer(marker));
  crimeMarkers = [];
}

// Get top 5 categories
function getTop5Categories(categoryCounts) {
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5).map(([cat]) => cat);
  return { top5, sorted };
}

// Get color for category
function getCategoryColor(category, top5) {
  if (top5.includes(category)) {
    return categoryColors[category] || '#1B9E77';
  }
  return categoryColors['hover-for-detail'];
}

// Add crime markers to map
function addCrimeMarkers(crimes, categoryCounts, place) {
  console.log(`[MAP] Adding ${crimes.length} crime markers...`);
  
  clearMarkers();
  
  const { top5 } = getTop5Categories(categoryCounts);
  
  crimes.forEach(crime => {
    const categoryFormatted = crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const color = getCategoryColor(categoryFormatted, top5);
    
    // Format date for display
    const [year, month] = crime.date.split('-');
    const dateObj = new Date(year, parseInt(month) - 1);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const circle = L.circle([crime.lat, crime.lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.7,
      radius: 30,
      stroke: false
    }).addTo(map);
    
    // Create detailed tooltip with HTML
    const tooltipContent = `
      <div class="crime-tooltip">
        <strong>${categoryFormatted}</strong>
        <div><small>📍 ${crime.street || 'Location not specified'}</small></div>
        <div><small>📅 ${formattedDate}</small></div>
        <div><small>🗺️ ${crime.lat.toFixed(4)}, ${crime.lng.toFixed(4)}</small></div>
      </div>
    `;
    
    circle.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -5],
      opacity: 0.95
    });
    
    crimeMarkers.push(circle);
  });
  
  // Center map on location
  if (crimes.length > 0 && currentSearchLocation) {
    map.setView([currentSearchLocation.lat, currentSearchLocation.lng], 14);
    
    // Draw radius circle
    drawRadiusCircle(currentSearchLocation.lat, currentSearchLocation.lng, currentSearchRadius);
  }
  
  console.log('[MAP] Markers added successfully');
  
  // Create chart
  createChart(categoryCounts, place, crimes[0].date);
  
  // Show export section and update stats
  exportSection.style.display = 'block';
  updateStatsSummary(crimes.length, place);
}

// Update stats summary
function updateStatsSummary(count, place) {
  statsSummary.innerHTML = `
    📊 <strong>${count}</strong> crimes found within <strong>${currentSearchRadius}</strong> mile(s) of ${place}
  `;
}

// Create Highcharts bar chart
function createChart(categoryCounts, place, date) {
  console.log('[CHART] Creating statistics chart...');
  
  const { sorted } = getTop5Categories(categoryCounts);
  const categories = sorted.map(([cat]) => cat);
  const data = sorted.map(([, count]) => count);
  
  // Format date
  const [year, month] = date.split('-');
  const dateObj = new Date(year, parseInt(month) - 1);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  if (currentChart) {
    currentChart.destroy();
  }
  
  currentChart = Highcharts.chart('chart-container', {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent'
    },
    title: {
      text: `Crimes within ${currentSearchRadius} mile(s) of ${place}`,
      style: { fontFamily: 'Oswald, sans-serif', fontSize: '1rem' }
    },
    subtitle: {
      text: formattedDate,
      style: { fontFamily: 'Oswald, sans-serif' }
    },
    xAxis: {
      categories: categories,
      title: { text: '' },
      gridLineWidth: 0
    },
    yAxis: {
      title: { text: 'Incidents' },
      gridLineWidth: 0
    },
    legend: {
      enabled: false
    },
    tooltip: {
      pointFormat: 'Incidents: <b>{point.y}</b>'
    },
    plotOptions: {
      series: {
        cursor: 'default',
        color: '#4682B4'
      }
    },
    series: [{
      name: 'Incidents',
      data: data
    }],
    credits: {
      enabled: false
    }
  });
  
  console.log('[CHART] Chart created successfully');
}

// Fetch crime data
async function fetchCrimeData(lat, lng) {
  console.log(`[FETCH] Fetching crime data for lat=${lat}, lng=${lng}...`);
  
  try {
    const response = await fetch(`/api/crime?lat=${lat}&lng=${lng}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[FETCH] Retrieved ${data.total} crimes`);
    
    return data;
    
  } catch (error) {
    console.error(`[FETCH] Error: ${error.message}`);
    throw error;
  }
}

// Geocode address
async function geocodeAddress(address) {
  const enhanced = enhanceSearchQuery(address);
  
  if (!enhanced) {
    throw new Error('Please enter a valid location');
  }
  
  console.log(`[GEOCODE] Geocoding: "${enhanced}"`);
  
  try {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(enhanced)}`);
    
    if (!response.ok) {
      if (response.status === 501) {
        throw new Error('Address search requires an OpenCage API key. Please use GPS location or try another method.');
      }
      if (response.status === 404) {
        throw new Error(`Location "${enhanced}" not found. Try a different postcode, area, or city.`);
      }
      throw new Error(`Failed to find location`);
    }
    
    const data = await response.json();
    console.log(`[GEOCODE] Location resolved: ${data.formatted} (lat=${data.lat}, lng=${data.lng})`);
    
    return data;
    
  } catch (error) {
    console.error(`[GEOCODE] Error: ${error.message}`);
    throw error;
  }
}

// Reverse geocode coordinates
async function reverseGeocode(lat, lng) {
  console.log(`[GEOCODE] Reverse geocoding: lat=${lat}, lng=${lng}`);
  
  try {
    const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    const data = await response.json();
    
    console.log(`[GEOCODE] Location: ${data.formatted}`);
    return data.formatted;
    
  } catch (error) {
    console.error(`[GEOCODE] Error: ${error.message}`);
    return `Location (${lat}, ${lng})`;
  }
}

// Main search handler
async function handleFindCrime(searchQuery = null) {
  console.log('\n[EVENT] Find Crime button clicked');
  
  // Disable button during search
  findCrimeBtn.disabled = true;
  findCrimeBtn.textContent = '🔄 Searching...';
  
  let lat, lng, place;
  
  try {
    if (useLocationCheckbox.checked) {
      console.log('[EVENT] Using current location');
      
      if (!userLocation) {
        throw new Error('Unable to get your location. Please enable location services or use address search.');
      }
      
      lat = userLocation.lat;
      lng = userLocation.lng;
      
      showStatus('🔍 Getting your location...', 'info');
      place = await reverseGeocode(lat, lng);
      
    } else {
      console.log('[EVENT] Using address search');
      
      const address = searchQuery || addressInput.value.trim();
      
      if (!address || address.length < 2) {
        throw new Error('Please enter a postcode, area, city, or location (e.g., "SW1A 1AA", "Camden", "Manchester")');
      }
      
      showStatus('📍 Looking up location...', 'info');
      const geocodeResult = await geocodeAddress(address);
      
      lat = geocodeResult.lat;
      lng = geocodeResult.lng;
      place = geocodeResult.formatted || address;
    }
    
    showStatus('📊 Fetching crime data from data.police.uk...', 'info');
    
    // Store search location for radius filtering
    currentSearchLocation = { lat, lng };
    
    const crimeData = await fetchCrimeData(lat, lng);
    
    if (crimeData.total === 0) {
      throw new Error('No crime data found for this location. The area may be outside England, Wales, or Northern Ireland, or no crimes were reported recently.');
    }
    
    console.log('[PROCESS] Processing crime data...');
    console.log(`[PROCESS] Total crimes from API: ${crimeData.total}`);
    
    // Filter crimes by radius
    const filteredCrimes = filterCrimesByRadius(crimeData.crimes, lat, lng, currentSearchRadius);
    console.log(`[PROCESS] Crimes within ${currentSearchRadius} mile(s): ${filteredCrimes.length}`);
    
    if (filteredCrimes.length === 0) {
      throw new Error(`No crimes found within ${currentSearchRadius} mile(s) of this location. Try increasing the search radius.`);
    }
    
    // Recalculate category counts for filtered crimes
    const filteredCategoryCounts = {};
    filteredCrimes.forEach(crime => {
      const cat = crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      filteredCategoryCounts[cat] = (filteredCategoryCounts[cat] || 0) + 1;
    });
    
    // Store for export
    currentCrimeData = {
      crimes: filteredCrimes,
      place: place,
      radius: currentSearchRadius
    };
    
    addCrimeMarkers(filteredCrimes, filteredCategoryCounts, place);
    
    showStatus(`✅ Found ${filteredCrimes.length} crime${filteredCrimes.length !== 1 ? 's' : ''} within ${currentSearchRadius} mile(s) of ${place}`, 'success');
    console.log(`[SUCCESS] Operation complete! Displayed ${filteredCrimes.length} crimes\n`);
    
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    showStatus(error.message, 'error');
  } finally {
    // Re-enable button
    findCrimeBtn.disabled = false;
    findCrimeBtn.textContent = '🔎 Find Crime Data';
  }
}

// Event listeners
findCrimeBtn.addEventListener('click', () => handleFindCrime());

// Radius slider synchronization
radiusSlider.addEventListener('input', (e) => {
  updateRadiusDisplay(e.target.value);
});

radiusInput.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  if (value >= 0.25 && value <= 5) {
    updateRadiusDisplay(value);
  }
});

// Export buttons
exportCsvBtn.addEventListener('click', () => {
  if (currentCrimeData) {
    exportToCSV(currentCrimeData.crimes, currentCrimeData.place);
  }
});

exportJsonBtn.addEventListener('click', () => {
  if (currentCrimeData) {
    exportToJSON(currentCrimeData.crimes, currentCrimeData.place, currentCrimeData.radius);
  }
});

addressInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleFindCrime();
  }
});

// Auto-format postcode as user types
addressInput.addEventListener('input', (e) => {
  const value = e.target.value;
  // Only auto-format if it looks like a postcode
  if (value.length >= 5 && /^[A-Z]{1,2}\d/i.test(value)) {
    const formatted = formatPostcode(value);
    if (formatted !== value && formatted.includes(' ')) {
      e.target.value = formatted;
    }
  }
});

useLocationCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    addressInput.disabled = true;
    addressInput.placeholder = '📍 Using your current GPS location...';
    if (!userLocation) {
      showStatus('Requesting location access...', 'info');
    }
  } else {
    addressInput.disabled = false;
    addressInput.placeholder = 'e.g., SW1A 1AA, Camden, Manchester, or Birmingham';
  }
});

console.log('[CLIENT] Application ready. Click "Find Crime!" to begin.');
