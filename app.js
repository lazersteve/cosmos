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

let rawData = []; 
let currentTier = 'solar'; 
let dataSourceType = 'local';
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
        'solar': 'ssd-api.jpl.nasa.gov',
        'interstellar': 'simbad.cds.unistra.fr',
        'milkyway': 'simbad.cds.unistra.fr'
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
    setUtcStatus(false); 
} else {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => { 
              console.log('SW registered: ', registration); 
              requestBackgroundSync(registration);
          })
          .catch(registrationError => { console.log('SW registration failed: ', registrationError); });
    }

    fetchCosmicData(DATA_REPOSITORIES[dataSourceType][currentTier]);
    setInterval(updateClock, 1000);
    placementTierSelect.addEventListener('change', loadPlacementObjects);
    loadPlacementObjects();
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

function setDataSource(sourceType) {
    dataSourceType = sourceType;
    fetchCosmicData(DATA_REPOSITORIES[dataSourceType][currentTier]);
}

function switchDataTier(tierName) {
    if (currentTier !== tierName) {
        currentTier = tierName;
        fetchCosmicData(DATA_REPOSITORIES[dataSourceType][currentTier]);
    }
}

function handleURLUpload() {
    const url = dataUrlInput.value;
    if (url) {
        fetchCosmicData(url);
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

function fetchCosmicData(url) {
    statusContainer.textContent = `Status: Connecting to ${url}...`;
    statusContainer.classList.add('status-connecting');

    d3.json(url)
      .then(data => {
          rawData = data;
          let parsedData = data;
          
          if (dataSourceType === 'web' && currentTier === 'solar') {
              parsedData = parseNasaJPLData(data);
          } else if (dataSourceType === 'web' && (currentTier === 'interstellar' || currentTier === 'milkyway')) {
              parsedData = parseSimbadData(data); 
          }
          
          processAndScaleData(parsedData, url);
      })
      .catch(error => {
          console.error("Error fetching data:", error);
          statusContainer.textContent = `Status: Error loading data from ${url}. Check console for CORS errors or switch to Local Files option.`;
          statusContainer.classList.remove('status-connecting');
          statusContainer.classList.add('status-error');
      });
}

function parseNasaJPLData(apiResponse) {
    const outputData = [];
    const targetData = apiResponse.data;
    // Basic check if data structure is correct
    if (!targetData || !apiResponse.target) { return outputData; } 
    
    const lines = targetData.split('\n');
    const dataLines = lines.filter(line => !line.startsWith('$$') && line.trim().length > 0);
    const targets = apiResponse.target;
    
    dataLines.forEach(line => {
        // Split the line into an array of values
        const values = line.split(',');
        
        // Assuming x is index 0, y is index 1, z is index 2, and ID is index 3
        const x = parseFloat(values[0]); 
        const y = parseFloat(values[1]);
        const z = parseFloat(values[2]);
        const objectId = values[3] ? values[3].trim() : 'Unknown'; // Get the 4th value
        
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
    
    // Must return the processed data array
    return outputData; 
}

function parseSimbadData(apiResponse) {
    const outputData = [];
    const rawObjects = apiResponse.data; 
    const headers = apiResponse.head.cols.map(col => col.name); 
    const raIndex = headers.indexOf('RA');
    const decIndex = headers.indexOf('DEC');
    const nameIndex = headers.indexOf('MAIN_ID');
    const otypeIndex = headers.indexOf('OTYPE');

    rawObjects.forEach(obj => {
        const x_deg = parseFloat(obj[raIndex]); 
        const y_deg = parseFloat(obj[decIndex]); 
        const name = obj[nameIndex];
        const type = obj[otypeIndex] || 'object';
        const id = name.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

        outputData.push({
            id: id, name: name, type: type.toLowerCase(), x: x_deg, y: y_deg, z: 0.0
        });
    });
    return outputData;
}

function processAndScaleData(inputData, sourceName = "data source") {
    let inputUnitFactor = SCALING_FACTORS[currentTier]; 
    if (dataSourceType === 'web' && (currentTier === 'interstellar' || currentTier === 'milkyway')) {
        // Data from SIMBAD is in degrees, so scaling factors are approximations
    }
    
    const scale = inputUnitFactor;
    
    const scaledDataForDisplay = inputData.map(d => {
        const scaledX = d.x * scale;
        const scaledY = d.y * scale;
        const r = Math.sqrt(scaledX * scaledX + scaledY * scaledY);
        const theta = Math.atan2(scaledY, scaledX);
        
        return {
            ...d, x: scaledX, y: scaledY, r: r, theta: theta
        };
    });
    
    updateD3Visualization(scaledDataForDisplay); 
    sortObjectsByName('asc', scaledDataForDisplay);
    
    let displayUnit = (currentTier === 'interstellar') ? "LY" : (currentTier === 'solar' ? "AU (scaled)" : "kpc (scaled)");
    if (dataSourceType === 'web' && currentTier !== 'solar') displayUnit = "Degrees (approx)";

    statusContainer.textContent = `Status: Data loaded from ${sourceName} (${displayUnit}).`;
    statusContainer.classList.remove('status-connecting', 'status-error');
    statusContainer.classList.add('status-connected');
}

// --- D3 Visualization Update Logic ---
function updateD3Visualization(newData) {
    d3.select("#cosmos-map").selectAll(".planet, .star, .sun").remove();
    console.log(`D3 visualization updated with ${newData.length} items for the ${currentTier} tier.`);
    // *** YOUR D3 rendering logic goes here, using the newData array's x/y properties ***
}

// --- Helper Functions ---
function setUtcStatus(isConnected) {
    if (isConnected) {
        utcClockDiv.classList.remove('utc-connecting');
        utcClockDiv.classList.add('utc-connected');
    } else {
        utcClockDiv.classList.remove('utc-connected');
        utcClockDiv.classList.add('utc-connecting');
    }
}
function resetView() { /* ... */ }
function toggleTriangulationLines() { /* ... */ }
function sortObjectsByName(order, dataArray = null) {
    const effectiveData = dataArray || rawData; 
    if (!effectiveData || effectiveData.length === 0) return;
    effectiveData.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) return order === 'asc' ? -1 : 1;
        if (nameA > nameB) return order === 'asc' ? 1 : -1;
        return 0;
    });
    populateSelect(objectSelect, effectiveData);
    populateSelect(calcSelect1, effectiveData);
    populateSelect(calcSelect2, effectiveData);
    populateSelect(calcSelect3, effectiveData);
}
function populateSelect(selectElement, objects) {
    while (selectElement.options.length > 1) { selectElement.remove(1); }
    objects.forEach(obj => {
        const option = document.createElement("option");
        option.value = obj.id; option.textContent = obj.name; selectElement.appendChild(option);
    });
}
function updateClock() {
    try {
        const now = new Date();
        const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        utcClockDiv.textContent = dtf.format(now) + " UTC";
        setUtcStatus(true); 
    } catch (error) { utcClockDiv.textContent = "Time Error"; setUtcStatus(false); }
}
function calculateTriangulation() {
    const p1 = observers['1']; const p2 = observers['2']; const p3 = observers['3'];
    const dist12_ly = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const dist23_ly = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
    const dist31_ly = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
    const selectedUnit = distanceUnitSelect.value;
    const factor = CONVERSION_FACTORS_TO_LY[selectedUnit];
    if (!factor) { return; }
    const displayDist12 = dist12_ly * factor; const displayDist23 = dist23_ly * factor; const displayDist31 = dist31_ly * factor;
    function formatDisplay(distance, unit) { return `${Number(distance).toPrecision(4)} ${unit}`; }
    function formatForTooltip(distance, unit) { return `${distance.toString()} ${unit} (Full Precision)`; }
    resultP1P2Div.textContent = formatDisplay(displayDist12, selectedUnit); resultP1P2Div.title = formatForTooltip(displayDist12, selectedUnit);
    resultP2P3Div.textContent = formatDisplay(displayDist23, selectedUnit); resultP2P3Div.title = formatForTooltip(displayDist23, selectedUnit);
    resultP3P1Div.textContent = formatDisplay(displayDist31, selectedUnit); resultP3P1Div.title = formatForTooltip(displayDist31, selectedUnit);
}
// --- D3 Placeholder Functions (You MUST define these in your full D3 script) ---
function handlePanSlider() { console.log("handlePanSlider() is a placeholder function."); }
function setZoomScale(scale) { console.log(`setZoomScale(${scale}) is a placeholder function.`); }
function centerViewToObject() { console.log("centerViewToObject() is a placeholder function."); }
function toggleSelect(num) { console.log(`toggleSelect(${num}) is a placeholder function.`); }
function centerOnSelection(num) { console.log(`centerOnSelection(${num}) is a placeholder function.`); }
function showDetails(event, num) { console.log(`showDetails(${num}) is a placeholder function.`); }
function hideDetails() { console.log("hideDetails() is a placeholder function."); }