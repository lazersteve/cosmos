// app.js

// --- Core Architectural Constants ---
const C_LIGHT = 1.0; 
const SACKETT_N = 0.2734375; 
const PRECISION_BUFFER = 0.125; 
// Using the normalized, radius-based beat value
const PI_MINUS_3_OVER_3_BEAT = (Math.PI - 3) / 3; 
const H_BASE_ZPE = getElementZPE('H');
const DRUDE_APPLICABLE_SCALE_THRESHOLD = 1e-6; 


// D3 Setup Variables
const width = 400; const height = 400;
let showUncertainty = false; 

// --- Data Models (Observers are Solitons) ---
let observer1 = { x: 0, y: 0, vel: 0.0, angle: 0.0, name: 'Obs 1', localRadius: 5 };
let observer2 = { x: 10, y: 0, vel: 0.0, angle: 0.0, name: 'Obs 2', localRadius: 5 };

// --- Color Utilities ---
function mixColors(color1_rgb_str, color2_rgb_str) {
    const c1 = d3.rgb(color1_rgb_str); const c2 = d3.rgb(color2_rgb_str);
    const r = Math.min(255, c1.r + c2.r); const g = Math.min(255, c1.g + c2.g); const b = Math.min(255, c2.b);
    return `rgb(${r}, ${g}, ${b})`;
}
const velocityColorScale = d3.scaleLinear()
    .domain([0, 0.5, C_LIGHT])
    .range(["blue", "green", "red"])
    .clamp(true);

// --- Scaling and Math Utilities (Unified Logic) ---
function calculateDynamicScaleRatio(velocity, polarity) {
    if (velocity >= C_LIGHT) velocity = C_LIGHT - 1e-6; 
    const gamma = 1 / Math.sqrt(1 - (velocity * velocity) / (C_LIGHT * C_LIGHT));
    // Use the new, normalized beat value
    const adjustment = showUncertainty ? PI_MINUS_3_OVER_3_BEAT : 0; 
    const zpeModulation = H_BASE_ZPE > 0 ? (H_BASE_ZPE * 1e33) : 1;
    
    // The core unified calculation: multiplies by the polarity flag
    return (SACKETT_N * gamma + adjustment) * zpeModulation * polarity;
}

function formatNumberForDisplay(num, displayZeros) {
    return Intl.NumberFormat('en-US', { minimumFractionDigits: displayZeros, maximumFractionDigits: displayZeros, useGrouping: false }).format(num);
}

function toggleUncertainty() {
    showUncertainty = !showUncertainty;
    document.getElementById('uncertainty-status').textContent = `Uncertainty View: ${showUncertainty ? 'ON (Chaos Mode)' : 'OFF (Stable Mode)'}`;
    updateVisualization();
}

// Placeholder for the Drude Model physics overlay (HPC Ready)
function applyDrudeModelOverlay(elementSymbol, scaleFactor) {
    if (document.getElementById('drude-toggle').checked) {
        if (document.getElementById('supercomputer-toggle').checked) {
            console.log(`HPC Mode ON for ${elementSymbol}. Running expensive sim...`);
            return "rgb(255, 215, 0)"; // Gold color
        } else {
            console.log("Using local JS approximation (fast fallback)...");
            return "rgb(255, 255, 0)"; // Yellow fallback
        }
    }
    return null; 
}

function getPythagoreanCoords(angleDegrees) {
    const angleRad = angleDegrees * Math.PI / 180;
    const x_coord = Math.cos(angleRad); 
    const y_coord = Math.sin(angleRad);
    return { x: x_coord, y: y_coord };
}


// --- Main Visualization Update Function ---
function updateVisualization() {
    // 1. Capture dynamic user input and polarity flag
    const systemPolarity = document.getElementById('polarity-toggle').checked ? 1 : -1; // 1 for matter, -1 for antimatter

    observer1.x = parseFloat(document.getElementById('obs1-posX').value) * systemPolarity;
    observer1.y = parseFloat(document.getElementById('obs1-posY').value) * systemPolarity;
    observer1.vel = parseFloat(document.getElementById('obs1-vel').value);
    observer1.angle = parseFloat(document.getElementById('obs1-angle').value); 
    observer2.x = parseFloat(document.getElementById('obs2-posX').value) * systemPolarity;
    observer2.y = parseFloat(document.getElementById('obs2-posY').value) * systemPolarity;
    observer2.vel = parseFloat(document.getElementById('obs2-vel').value);
    observer2.angle = parseFloat(document.getElementById('obs2-angle').value); 
    const displayZeros = parseInt(document.getElementById('display-zeros').value);

    // 2. Calculate system parameters using unified logic
    const midpointX = (observer1.x + observer2.x) / 2;
    const midpointY = (observer1.y + observer2.y) / 2;
    const baselineDistance = Math.sqrt(Math.pow(observer1.x - observer2.x, 2) + Math.pow(observer1.y - observer2.y, 2));
    // Pass polarity into the scaling function
    const dynamicRatio = calculateDynamicScaleRatio(observer1.vel, systemPolarity); 
    const newDomainExtent = baselineDistance * dynamicRatio || 10;

    const isDrudeApplicable = newDomainExtent < DRUDE_APPLICABLE_SCALE_THRESHOLD;
    document.getElementById('drude-toggle').disabled = !isDrudeApplicable;

    document.getElementById('status-container').textContent = 
        `Status: System Polarity: ${systemPolarity === 1 ? 'MATTER' : 'ANTIMATTER'}. Drude Applicable: ${isDrudeApplicable ? 'YES' : 'NO'}`;

    // 3. Setup D3 Scales (Zero-Base Math for the Midpoint)
    const globalScaleX = d3.scaleLinear().domain([midpointX - newDomainExtent/2, midpointX + newDomainExtent/2]).range([0, width]);
    const globalScaleY = d3.scaleLinear().domain([midpointY - newDomainExtent/2, midpointY + newDomainExtent/2]).range([height, 0]);
    const localScale1 = d3.scaleLinear().domain([-observer1.localRadius, observer1.localRadius]).range([0, width]);
    const localScale2 = d3.scaleLinear().domain([-observer2.localRadius, observer2.localRadius]).range([0, width]);
        
    drawGlobalView(globalScaleX, globalScaleY, observer1, observer2, systemPolarity);
    drawLocalView(d3.select("#local-viewport-1"), localScale1, observer1, dynamicRatio, displayZeros, "H", isDrudeApplicable, systemPolarity);
    drawLocalView(d3.select("#local-viewport-2"), localScale2, observer2, dynamicRatio, displayZeros, "He", isDrudeApplicable, systemPolarity);
}

function displayHydrogenData() {
    const zeros = parseInt(document.getElementById('display-zeros').value);
    const hData = getElementCoordinates('H', zeros); 
    const zpe = getElementZPE('H');
    if (hData) {
        alert(`Hydrogen Data:\nSymbol: ${hData.symbol}\nZPE (Zero Beat Energy): ${zpe.toExponential(4)} Joules\nDisplayed X (UI Value): ${hData.displayX}`);
    } else {
        alert("Hydrogen data not found.");
    }
}


// --- D3 Drawing Functions ---

function drawGlobalView(xScale, yScale, o1, o2, polarity) {
    const svg = d3.select("#global-viewport-2d").html("").append("svg").attr("width", width).attr("height", height);
    // Adjust base color scheme based on polarity
    const color1 = polarity === 1 ? velocityColorScale(o1.vel) : "rgb(255, 100, 100)"; 
    const color2 = polarity === 1 ? velocityColorScale(o2.vel) : "rgb(100, 100, 255)";
    
    svg.append("line").attr("x1", xScale(o1.x)).attr("y1", yScale(o1.y)).attr("x2", xScale(o2.x)).attr("y2", yScale(o2.y)).attr("stroke", mixColors(color1, color2)).attr("stroke-dasharray", "4,4"); 

   .forEach(r => { // Concentric circles represent the stable soliton wave packet
        svg.append("circle")
           .attr("cx", xScale(o1.x))
           .attr("cy", yScale(o1.y))
           .attr("r", r)
           .style("fill", 'none')
           .style("stroke", color1)
           .style("opacity", 0.5);
    });
   .forEach(r => {
        svg.append("circle")
           .attr("cx", xScale(o2.x))
           .attr("cy", yScale(o2.y))
           .attr("r", r)
           .style("fill", 'none')
           .style("stroke", color2)
           .style("opacity", 0.5);
    });

    const coords1 = getPythagoreanCoords(o1.angle);
    svg.append("line").attr("x1", xScale(o1.x)).attr("y1", yScale(o1.y)).attr("x2", xScale(o1.x + coords1.x * 2)).attr("y2", yScale(o1.y + coords1.y * 2)).attr("stroke", color1).attr("stroke-width", 2);
    const coords2 = getPythagoreanCoords(o2.angle);
    svg.append("line").attr("x1", xScale(o2.x)).attr("y1", yScale(o2.y)).attr("x2", xScale(o2.x + coords2.x * 2)).attr("y2", yScale(o2.y + coords2.y * 2)).attr("stroke", color2).attr("stroke-width", 2);
}

function drawLocalView(viewport, scale, observer, dynamicRatio, displayZeros, elementSymbol, isDrudeApplicable, polarity) {
    const svg = viewport.html("").append("svg").attr("width", width).attr("height", height);
    const bufferColor = d3.rgb(velocityColorScale(observer.vel));
    bufferColor.s *= (dynamicRatio % PRECISION_BUFFER) * 10; 

    svg.append("circle").attr("cx", scale(0)).attr("cy", scale(0)).attr("r", scale(PRECISION_BUFFER) - scale(0)).style("fill", "none").style("stroke", bufferColor.toString()).style("stroke-dasharray", "2,2");

    let elementFillColor = polarity === 1 ? velocityColorScale(observer.vel) : "rgb(255, 100, 100)"; 
    if (isDrudeApplicable) {
        elementFillColor = applyDrudeModelOverlay(elementSymbol, scale.domain()); 
    }

    svg.append("circle")
       .attr("cx", scale(0)) 
       .attr("cy", scale(0))
       .attr("r", 8) 
       .style("fill", elementFillColor) 
       .style("stroke", "white")
       .attr("class", "element-centroid");
       
    svg.append("text").attr("x", scale(0) + 10).attr("y", scale(0) - 10).text(elementSymbol).style("fill", "white").style("font-size", "14px");

    svg.append("text").attr("x", 10).attr("y", height - 10).text(`Scale: 1 unit (ZPE mod) = ${formatNumberForDisplay(dynamicRatio, displayZeros)} factor`).style("fill", "#eee") .style("font-size", "10px");
    
    const coords = getPythagoreanCoords(observer.angle);
    svg.append("line").attr("x1", scale(0)).attr("y1", scale(0)).attr("x2", scale(0 + coords.x * observer.localRadius * 0.5)).attr("y2", scale(0 + coords.y * observer.localRadius * 0.5)).attr("stroke", elementFillColor).attr("stroke-width", 3);
}

document.addEventListener('DOMContentLoaded', updateVisualization);
