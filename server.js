const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3838;

// Middleware
app.use(express.json());
app.use(express.static('public'));

console.log('[STARTUP] Crime Watch Node.js server starting...');
console.log('[STARTUP] Loading dependencies...');

// API Routes
app.get('/api/crime', async (req, res) => {
  const { lat, lng, date } = req.query;
  
  console.log(`[API] Crime data request received: lat=${lat}, lng=${lng}`);
  
  if (!lat || !lng) {
    console.log('[API] Error: Missing required parameters');
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }
  
  try {
    const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}${date ? `&date=${date}` : ''}`;
    console.log(`[API] Fetching from: ${url}`);
    
    const response = await fetch(url);
    console.log(`[API] Response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`[API] Error: HTTP ${response.status}`);
      return res.status(response.status).json({ error: 'Failed to fetch crime data' });
    }
    
    const data = await response.json();
    console.log(`[API] Successfully retrieved ${data.length} crime records`);
    
    // Process data
    const processed = data.map(crime => ({
      category: crime.category,
      lat: parseFloat(crime.location.latitude),
      lng: parseFloat(crime.location.longitude),
      date: crime.month,
      street: crime.location.street.name,
      id: crime.id
    }));
    
    // Get unique categories
    const categories = [...new Set(processed.map(c => c.category))];
    console.log(`[API] Categories found: ${categories.join(', ')}`);
    
    // Count by category
    const categoryCounts = {};
    processed.forEach(crime => {
      const cat = crime.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    console.log('[API] Crime breakdown:');
    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count} incidents`);
      });
    
    res.json({
      crimes: processed,
      categoryCounts,
      total: processed.length
    });
    
  } catch (error) {
    console.log(`[API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Geocoding endpoint
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  const apiKey = process.env.OPENCAGE_API_KEY;
  
  console.log(`[GEOCODE] Address lookup: "${address}"`);
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  if (!apiKey) {
    console.log('[GEOCODE] Warning: No OpenCage API key configured');
    return res.status(501).json({ 
      error: 'Geocoding service not configured. Please add OPENCAGE_API_KEY to .env file.' 
    });
  }
  
  try {
    // Enhance query for better UK results
    let query = address.trim();
    
    // If it looks like a postcode without country, ensure UK context
    const postcodePattern = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    if (postcodePattern.test(query)) {
      console.log('[GEOCODE] Detected UK postcode format');
      query = `${query}, UK`;
    } else if (!query.toLowerCase().includes('uk') && 
               !query.toLowerCase().includes('england') && 
               !query.toLowerCase().includes('wales') &&
               !query.toLowerCase().includes('scotland') &&
               !query.toLowerCase().includes('northern ireland')) {
      // Add UK context for better results
      query = `${query}, UK`;
    }
    
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&countrycode=gb&limit=5&no_annotations=1`;
    console.log(`[GEOCODE] Making request to OpenCage API for: "${query}"`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log(`[GEOCODE] Address resolved: ${result.formatted} (lat=${result.geometry.lat}, lng=${result.geometry.lng})`);
      
      res.json({
        lat: result.geometry.lat,
        lng: result.geometry.lng,
        formatted: result.formatted
      });
    } else {
      console.log('[GEOCODE] No results found for query');
      res.status(404).json({ 
        error: `Location "${address}" not found. Try a UK postcode, city, or area name.` 
      });
    }
    
  } catch (error) {
    console.log(`[GEOCODE] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Reverse geocoding endpoint
app.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey = process.env.OPENCAGE_API_KEY;
  
  console.log(`[GEOCODE] Reverse geocode: lat=${lat}, lng=${lng}`);
  
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }
  
  if (!apiKey) {
    console.log('[GEOCODE] Warning: No OpenCage API key configured');
    return res.json({ formatted: `Location (${lat}, ${lng})` });
  }
  
  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&countrycode=gb&limit=1`;
    console.log('[GEOCODE] Making reverse geocode request...');
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const formatted = result.components.postcode || result.formatted;
      console.log(`[GEOCODE] Location identified: ${formatted}`);
      
      res.json({ formatted });
    } else {
      res.json({ formatted: `Location (${lat}, ${lng})` });
    }
    
  } catch (error) {
    console.log(`[GEOCODE] Error: ${error.message}`);
    res.json({ formatted: `Location (${lat}, ${lng})` });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] Server started successfully`);
  console.log(`[STARTUP] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[STARTUP] Crime Watch is ready!`);
  console.log('[STARTUP] Press Ctrl+C to stop\n');
});
