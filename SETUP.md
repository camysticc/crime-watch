# Crime Watch - Setup and Testing Guide

## What Was Updated

The application has been completely updated with the following improvements:

### 1. **Working Police Data Retrieval**
- Replaced the outdated `ukpolice` package with direct API calls to data.police.uk
- Implemented robust error handling for API requests
- Added proper data parsing and validation

### 2. **Comprehensive Logging System**
- All operations now log detailed information to the terminal
- Log categories include:
  - `[STARTUP]` - Application initialization
  - `[API]` - API requests and responses
  - `[LOCATION]` - GPS and location services
  - `[GEOCODE]` - Address lookup operations
  - `[FETCH]` - Data retrieval operations
  - `[PROCESS]` - Data processing steps
  - `[MAP]` - Map rendering updates
  - `[CHART]` - Chart generation
  - `[SUCCESS]` - Successful operations
  - `[ERROR]` - Error conditions

### 3. **Enhanced Error Messages**
- User-friendly error dialogs with helpful information
- Detailed technical errors in terminal logs
- Better validation of user inputs

### 4. **Improved Data Display**
- Crime categories are now properly formatted (Title Case)
- Better handling of missing or invalid data
- More informative tooltips and labels

## Prerequisites

To run this application, you need:

1. **R** (version 4.0 or higher)
2. **R packages**:
   - shiny
   - dplyr
   - forcats
   - leaflet
   - opencage
   - highcharter
   - httr
   - jsonlite

## Installation

### Option 1: Install R and Dependencies

```bash
# Install R (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y r-base r-base-dev libcurl4-openssl-dev libssl-dev libxml2-dev

# Install R packages
R -e "install.packages(c('shiny', 'dplyr', 'forcats', 'leaflet', 'opencage', 'highcharter', 'httr', 'jsonlite'), repos='https://cloud.r-project.org')"
```

### Option 2: Use Docker

```bash
# Run the app in a Docker container with R pre-installed
docker run --rm -it -p 3838:3838 -v $(pwd):/app -w /app rocker/shiny:latest bash
```

Then inside the container:
```bash
R -e "install.packages(c('shiny', 'dplyr', 'forcats', 'leaflet', 'opencage', 'highcharter', 'httr', 'jsonlite'), repos='https://cloud.r-project.org')"
R -e "shiny::runApp('/app', port=3838, host='0.0.0.0')"
```

## OpenCage API Key (Optional)

The app uses OpenCage for geocoding. To use your own API key:

1. Get a free API key from https://opencagedata.com/
2. Create the key file:

```r
# In R console:
saveRDS("YOUR_API_KEY_HERE", "opencage_api.rds")
```

**Note:** The app will still work without an API key, but address search functionality will be limited.

## Running the Application

```bash
# Start the application
R -e "shiny::runApp('app.R', port=3838, host='0.0.0.0')"
```

Or simply double-click `app.R` in RStudio.

## Testing the Application

Once running, you should see detailed logs in the terminal like:

```
[STARTUP] Crime Watch application starting...
[STARTUP] Libraries loaded successfully
[STARTUP] OpenCage API key loaded from file
[STARTUP] Starting Shiny application...
[STARTUP] Application ready - navigate to the URL shown above

Listening on http://0.0.0.0:3838
```

### Test Searches

Try these example locations (UK only):

1. **London**: `London, UK` or coordinates: 51.5074, -0.1278
2. **Manchester**: `Manchester, UK` or coordinates: 53.4808, -2.2426
3. **Birmingham**: `Birmingham, UK` or coordinates: 52.4862, -1.8904
4. **Cardiff**: `Cardiff, Wales` or coordinates: 51.4816, -3.1791
5. **Belfast**: `Belfast, Northern Ireland` or coordinates: 54.5973, -5.9301

### Expected Behavior

When you click "Find Crime!", you should see logs like:

```
[EVENT] 'Find Crime!' button clicked
[EVENT] use_location checkbox: FALSE
[LOCATION] Using address search
[GEOCODE] Searching for address: 'London, UK'
[GEOCODE] Address resolved to: lat=51.507400, lng=-0.127800
[FETCH] Starting crime data retrieval...
[API] Fetching crime data for coordinates: lat=51.507400, lng=-0.127800
[API] Making request to data.police.uk...
[API] Response status: 200
[API] Received 45678 bytes of data
[API] Successfully parsed 123 crime incidents
[API] Data processing complete. Categories found: Anti Social Behaviour, Burglary, Violence And Sexual Offences, ...
[PROCESS] Processing 123 crime records...
[PROCESS] Date range: February 2026
[PROCESS] Crime categories breakdown:
  - Violence And Sexual Offences: 45 incidents
  - Anti Social Behaviour: 32 incidents
  - Public Order: 18 incidents
  ...
[MAP] Updating map with crime data...
[MAP] Map updated with 123 crime locations
[CHART] Generating crime statistics chart...
[CHART] Chart rendered successfully
[SUCCESS] Operation completed! Total crimes displayed: 123
```

## API Information

The application uses the UK Police API (https://data.police.uk/):
- **Endpoint**: `https://data.police.uk/api/crimes-street/all-crime`
- **Coverage**: England, Wales, and Northern Ireland
- **Data**: Most recent month available (typically 2-3 months behind current date)
- **Radius**: Approximately 1 mile from search location
- **Rate Limiting**: 15 requests per second, 1000 per hour

## Troubleshooting

### No Data Returned
- Check if location is within England, Wales, or Northern Ireland
- Check terminal logs for API errors
- Verify internet connectivity

### Geocoding Errors
- Ensure OpenCage API key is properly configured
- Check for typos in address
- Try using more specific location names

### Package Installation Errors
- Ensure system dependencies are installed (libcurl, libssl, libxml2)
- Try installing packages one at a time
- Check R version compatibility

## Original Design Preserved

All original design elements have been maintained:
- ✓ Same UI layout and styling
- ✓ Oswald font
- ✓ CartoDB Positron base map
- ✓ Color scheme for crime categories
- ✓ Interactive map with circles
- ✓ Highcharter bar chart
- ✓ Responsive design
- ✓ GPS location support
- ✓ Address search
- ✓ Progress indicators

## Changes Made

Only internal implementation was changed:
- ✗ Removed dependency on `ukpolice` package
- ✓ Added direct API integration
- ✓ Added comprehensive logging
- ✓ Improved error handling
- ✓ Better data validation
- ✓ More informative user feedback
