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
    
    const circle = L.circle([crime.lat, crime.lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.7,
      radius: 30,
      stroke: false
    }).addTo(map);
    
    circle.bindTooltip(categoryFormatted);
    crimeMarkers.push(circle);
  });
  
  // Center map on location
  if (crimes.length > 0) {
    const firstCrime = crimes[0];
    map.setView([firstCrime.lat, firstCrime.lng], 14);
  }
  
  console.log('[MAP] Markers added successfully');
  
  // Create chart
  createChart(categoryCounts, place, crimes[0].date);
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
      text: `Crimes within 1 mile of ${place}`,
      style: { fontFamily: 'Oswald, sans-serif' }
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
    
    const crimeData = await fetchCrimeData(lat, lng);
    
    if (crimeData.total === 0) {
      throw new Error('No crime data found for this location. The area may be outside England, Wales, or Northern Ireland, or no crimes were reported recently.');
    }
    
    console.log('[PROCESS] Processing crime data...');
    addCrimeMarkers(crimeData.crimes, crimeData.categoryCounts, place);
    
    showStatus(`✅ Successfully loaded ${crimeData.total} crime${crimeData.total !== 1 ? 's' : ''} near ${place}`, 'success');
    console.log(`[SUCCESS] Operation complete! Displayed ${crimeData.total} crimes\n`);
    
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

// Quick search buttons
quickSearchBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const location = btn.getAttribute('data-location');
    console.log(`[UI] Quick search clicked: ${location}`);
    addressInput.value = location;
    useLocationCheckbox.checked = false;
    addressInput.disabled = false;
    handleFindCrime(location);
  });
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
