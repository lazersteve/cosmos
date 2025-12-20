// --- Variable Declarations ---
const statusContainer = document.getElementById('status-container');
const objectSelect = document.getElementById('object-select');
const calcSelect1 = document.getElementById('calc-select-1'); const calcSelect2 = document.getElementById('calc-select-2'); const calcSelect3 = document.getElementById('calc-select-3');
const check1 = document.getElementById('check-1'); const check2 = document.getElementById('check-2'); const check3 = document.getElementById('check-3');
const resultP1P2Div = document.getElementById('result-p1-p2'); const resultP2P3Div = document.getElementById('result-p2-p3'); const resultP3P1Div = document.getElementById('result-p3-p1');
const utcClockDiv = document.getElementById('utc-clock'); const panXSlider = document.getElementById('panX'); const panYSlider = document.getElementById('panY');
const tooltip = d3.select("#tooltip");
const toggleLinesCheckbox = document.getElementById('toggle-tri-lines'); 
const dataUploadInput = document.getElementById('data-upload-input');
const dataUrlInput = document.getElementById('data-url-input');
const targetObserverSelect = document.getElementById('target-observer-select');
const placementTierSelect = document.getElementById('placement-tier-select');
const placementObjectSelect = document.getElementById('placement-object-select');
const distanceUnitSelect = document.getElementById('distance-unit-select');
const debugStatusDiv = document.getElementById('debug-status'); // ADDED DEBUG VAR

let rawData = []; 
let currentTier = 'solar'; 
// dataSourceType variable is no longer needed with automatic fallback

let observers = {
    '1': { x: 0, y: 0, z: 0, name: 'Obs 1 (Solar Center)' },
    '2': { x: 0, y: 0, z: 0, name: 'Obs 2 (Solar Center)' },
    '3': { x: 0, y: 0, z: 0, name: 'Obs 3 (Solar Center)' }
};

const DATA_REPOSITORIES = {
    'local': {
        'solar': 'data/solar_system_data.json', 
        'interstellar': 'data/interstellar_data.json', 
        'milkyway': 'data/milky_way_data.json' 
    },
    'web': {
        // Updated to use a CORS proxy and specific API endpoints
        'solar': 'corsproxy.io?' + encodeURIComponent('ssd-api.jpl.nasa.gov'),
        'interstellar': 'corsproxy.io?' + encodeURIComponent('simbad.cds.unistra.fr'), // Placeholder URL, need actual endpoint
        'milkyway': 'corsproxy.io?' + encodeURIComponent('simbad.cds.unistra.fr') // Placeholder URL, need actual endpoint
    }
};

const SCALING_FACTORS = {
    'solar': 63241,   
    'interstellar': 1,      
    'milkyway': 3262        
};

const CONVERSION_FACTORS_TO_LY = {
    'LY': 1,
    'AU': 63241.077,
    'km': 9.461e12,
    'pc': 0.306601,
    'kpc': 0.000306601,
    'Mpc': 0.000000306601
};

if (typeof d3 === 'undefined') { 
    statusContainer.textContent = "Status: Error loading D3 library.";
    statusContainer.classList.add('status-error');
    if (debugStatusDiv) { debugStatusDiv.textContent = "Status: D3 failed to load."; }
} else {
    if (debugStatusDiv) { debugStatusDiv.textContent = "Status: D3 loaded, App.js v1.2 running."; } // ADDED DEBUG UPDATE

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => { 
              console.log('SW registered: ', registration); 
              requestBackgroundSync(registration);
          })
          .catch(registrationError => { console.log('SW registration failed: ', registrationError); });
    }

    fetchCosmicData(DATA_REPOSITORIES['web'][currentTier]); 
    setInterval(updateClock, 1000);
    placementTierSelect.addEventListener('change', loadPlacementObjects);
    loadPlacementObjects();
    window.switchDataTier = switchDataTier;
    // Placeholders for functions assumed to be defined elsewhere in your original code
    window.handlePanSlider = function(){}; 
    window.setZoomScale = function(){}; 
    window.resetView = function(){}; 
    window.centerViewToObject = function(){}; 
    window.sortObjectsByName = function(){}; 
    window.assignObserverLocation = assignObserverLocation; 
    window.handleManualUpload = handleManualUpload; 
    window.handleURLUpload = handleURLUpload; 
    window.calculateTriangulation = function(){}; 
    window.toggleTriangulationLines = function(){}; 
    window.toggleSelect = function(){}; 
    window.centerOnSelection = function(){}; 
    window.showDetails = function(){}; 
    window.hideDetails = function(){}; 
}

// Function to update the Universal Time Clock display (ADDED)
function updateClock() {
    const now = new Date();
    const utcString = now.toUTCString(); 
    utcClockDiv.textContent = utcString;
    utcClockDiv.classList.remove('utc-connecting');
}

// NEW Function: Request Background Sync Permission
async function requestBackgroundSync(registration) {
    if ('periodicSync' in registration) {
        try {
            await registration.periodicSync.register('update-cosmic-data', {
                minInterval: 24 * 60 * 60 * 1000 // 24 hours
            });
            console.log("Periodic background sync registered successfully.");
        } catch (error) {
            console.error("Periodic background sync registration failed:", error);
        }
    } else {
        console.log("Background Sync API not supported.");
    }
}


// --- Observer Management Functions ---

function loadPlacementObjects() {
    const selectedTier = placementTierSelect.value;
    const url = DATA_REPOSITORIES['local'][selectedTier]; 
    
    d3.json(url)
      .then(tierData => {
          placementObjectSelect.innerHTML = '<option value="">Select Object to Assign Location</option>';
          tierData.forEach(obj => {
              const option = document.createElement("option");
              option.value = JSON.stringify({x: obj.x, y: obj.y, z: obj.z, name: obj.name, tier: selectedTier});
              option.textContent = obj.name + ` (${selectedTier})`;
              placementObjectSelect.appendChild(option);
          });
      })
      .catch(err => console.error("Error loading placement objects:", err));
}

function assignObserverLocation() {
    const observerId = targetObserverSelect.value;
    const selectedOptionValue = placementObjectSelect.value;

    if (!selectedOptionValue) {
        alert("Please select a valid location object first.");
        return;
    }

    const locationData = JSON.parse(selectedOptionValue);
    const scale = SCALING_FACTORS[locationData.tier];

    observers[observerId].x = locationData.x * scale;
    observers[observerId].y = locationData.y * scale;
    observers[observerId].z = locationData.z * scale;
    observers[observerId].name = locationData.name;

    alert(`Observer ${observerId} relocated to ${locationData.name} (${locationData.tier}).`);
}

// --- Data Handling Functions ---

function switchDataTier(tierName) {
    if (currentTier !== tierName) {
        currentTier = tierName;
        fetchCosmicData(DATA_REPOSITORIES['web'][currentTier]); 
    }
}

function handleURLUpload() {
    const url = dataUrlInput.value;
    if (url) {
        fetchCosmicData(url, false); 
    } else {
        alert("Please enter a valid URL.");
    }
}

function handleManualUpload() {
    const files = dataUploadInput.files;
    if (files.length === 0) {
        alert("Please select a JSON file to upload.");
        return;
    }
    const file = files;
    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const jsonData = JSON.parse(event.target.result);
            processAndScaleData(jsonData, `manual upload (${file.name})`);
        } catch (e) {
            statusContainer.textContent = "Status: Error parsing JSON file.";
            statusContainer.classList.add('status-error');
        }
    };
    reader.onerror = (error) => { console.error("FileReader error:", error); };
    reader.readAsText(file);
}


// fetchCosmicData updated with timeout and fallback logic (UPDATED with AbortController/Timeout)
function fetchCosmicData(url, useFallback = true) {
    statusContainer.textContent = `Status: Connecting to ${url}...`;
    statusContainer.classList.add('status-connecting');
    if (debugStatusDiv) debugStatusDiv.textContent = `Status: Fetching ${url}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 5000); 

    d3.json(url, { signal: controller.signal })
      .then(data => {
          clearTimeout(timeoutId); 

          rawData = data;
          let parsedData = data;
          
          if (url.includes('jpl.nasa.gov')) { 
              parsedData = parseNasaJPLData(data);
          } else if (url.includes('simbad.cds.unistra.fr')) {
              // Handle simbad data parsing here
          }
          
          processAndScaleData(parsedData, url); 
          statusContainer.textContent = `Status: Data from ${url} processed successfully.`;
          statusContainer.classList.remove('status-connecting', 'status-error');
          statusContainer.classList.add('status-success'); 
          if (debugStatusDiv) debugStatusDiv.textContent = `Status: Success from ${url}`;

      })
      .catch(error => {
          clearTimeout(timeoutId); 
          if (debugStatusDiv) debugStatusDiv.textContent = `Status: Fetch failed for ${url}`;


          if (error.name === 'TimeoutError' && useFallback) {
              console.warn("Web request timed out. Falling back to local data...");
              statusContainer.textContent = "Status: Web API timed out. Attempting local fallback...";
              const localUrl = DATA_REPOSITORIES['local'][currentTier];
              fetchCosmicData(localUrl, false); 
          } else if (useFallback) {
              console.error("Error fetching data, falling back:", error);
              statusContainer.textContent = `Status: Error loading data from ${url}. Attempting local fallback.`;
              const localUrl = DATA_REPOSITORIES['local'][currentTier];
              fetchCosmicData(localUrl, false);
          } else {
              console.error("Fatal error loading data:", error);
              statusContainer.textContent = `Status: Failed to load data from both web and local sources. Check console for details.`;
              statusContainer.classList.remove('status-connecting');
              statusContainer.classList.add('status-error');
          }
      });
}


// parseNasaJPLData updated with array access fixes and completion (FIXED/UPDATED)
function parseNasaJPLData(apiResponse) {
    const outputData = [];
    const targetData = apiResponse.data;
    if (!targetData || !apiResponse.target) { return outputData; } 
    
    const lines = targetData.split('\n');
    const dataLines = lines.filter(line => !line.startsWith('$$') && line.trim().length > 0);
    const targets = apiResponse.target;
    
    dataLines.forEach(line => {
        const values = line.split(',');
        
        // Access specific array indices for x, y, z, ID
        const x = parseFloat(values[0]); // Corrected: Must access index [0]
        const y = parseFloat(values[1]); // Corrected: Must access index [1]
        const z = parseFloat(values[2]); // Corrected: Must access index [2]
        const objectId = values[3] ? values[3].trim() : 'Unknown'; // Corrected: Must access index [3]
        
        const targetObj = targets.find(t => t === objectId);
        const name = targetObj ? targetObj : `Object ${objectId}`;
        
        outputData.push({
            id: objectId, 
            name: name, 
            type: name.includes('Sun') ? 'sun' : 'planet', 
            x: x, 
            y: y,
            z: z
        });
    });
    
    return outputData; 
}
