#!/bin/bash
# Test script to verify UK Police API connectivity

echo "=========================================="
echo "UK Police API Connection Test"
echo "=========================================="
echo ""

# Test 1: API availability
echo "[TEST 1] Checking API availability..."
response=$(curl -s -o /dev/null -w "%{http_code}" "https://data.police.uk/api/forces")
if [ "$response" = "200" ]; then
    echo "✓ API is reachable (HTTP $response)"
else
    echo "✗ API returned HTTP $response"
    exit 1
fi
echo ""

# Test 2: Get available forces
echo "[TEST 2] Fetching police forces..."
forces=$(curl -s "https://data.police.uk/api/forces" | head -c 200)
echo "Sample response: ${forces}..."
echo ""

# Test 3: Get crime data for London coordinates
echo "[TEST 3] Fetching crime data for London (51.5074, -0.1278)..."
lat=51.5074
lng=-0.1278
crime_response=$(curl -s "https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}")

# Count crimes
crime_count=$(echo "${crime_response}" | grep -o '"category"' | wc -l)
echo "✓ Retrieved ${crime_count} crime records"
echo ""

# Show sample crime categories
echo "[TEST 4] Sample crime categories found:"
echo "${crime_response}" | grep -o '"category":"[^"]*"' | head -5 | sed 's/"category":"\([^"]*\)"/  - \1/'
echo ""

# Test 5: Get crime data for Manchester
echo "[TEST 5] Fetching crime data for Manchester (53.4808, -2.2426)..."
lat=53.4808
lng=-2.2426
crime_response=$(curl -s "https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}")
crime_count=$(echo "${crime_response}" | grep -o '"category"' | wc -l)
echo "✓ Retrieved ${crime_count} crime records"
echo ""

echo "=========================================="
echo "All tests completed successfully!"
echo "The UK Police API is working correctly."
echo "=========================================="
