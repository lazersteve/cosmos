// ElementDataManager.js

/**
 * The fundamental scaling constant of our system, related to the 1/8 buffer, 
 * used to define the 'bond length' in our tetrahedral model.
 */
const SYSTEM_BOND_LENGTH_FACTOR = 0.125; 

/**
 * ZPE constants used in the app.js ZPE modulation
 */
const REDUCED_PLANCK_CONSTANT_HBAR = 1.0545718e-34; // J*s (for physical context)
const TYPICAL_H_FREQ_OMEGA = 7.5e14; // Approximate angular frequency for H vibration

/**
 * A data structure representing elements in a tetrahedral grid.
 * The element is the centroid, neighbors are vertices.
 * Coordinates are represented in the 'head-to-tail' suppressed zero format.
 */
const ElementDataRepository = {
    // Hydrogen (H): Atomic number 1. The stable, zero-neutron state.
    'H': {
        atomicNumber: 1,
        name: 'Hydrogen',
        symbol: 'H',
        // Coordinates for the centroid (uses zero suppression)
        position: {
            magnitude: 0.0, // Head: The main integer body (zero based)
            precision: 0.0, // Tail: The exact inverted fraction
            exponent: 0     // Exponent: Represents the 'empty space' (no zeros suppressed here)
        },
        // Neighbors are placeholders for simplicity in this model
        neighbors: [ /* List of neighbor element symbols, e.g., 'He', 'Li', 'B' */ ],
        // Calculate the base Zero Point Energy for Hydrogen
        zeroPointEnergy: 0.5 * REDUCED_PLANCK_CONSTANT_HBAR * TYPICAL_H_FREQ_OMEGA
    },
    
    // Helium (He): Atomic number 2. 
    'He': {
        atomicNumber: 2,
        name: 'Helium',
        symbol: 'He',
        position: {
            magnitude: 1.0, 
            precision: 0.0, 
            exponent: 0     
        },
        neighbors: [ /* List of neighbor element symbols */ ],
        zeroPointEnergy: 0 // Placeholder, He is inert
    },

    // A hypothetical element in a vast, empty region of the universe.
    'HypotheticalElement': {
        atomicNumber: 999,
        name: 'Exotic Matter',
        symbol: 'Ex',
        // Example of extreme scale using zero suppression
        position: {
            magnitude: 5.4,        // Head: Significant figures
            precision: 0.12345,    // Tail: Precise fractional part
            exponent: 22           // Exponent: 22 zeros suppressed between magnitude and precision point
        },
        neighbors: [],
        zeroPointEnergy: 0
    }
    // ... we would add more elements here (Li, Be, B, C, N, etc.)
};

/**
 * Function to decompress coordinates from the repository for visualization/reference.
 * The 'displayZeros' parameter controls how many zeros are generated when expanding back.
 */
function getElementCoordinates(symbol, displayZeros) {
    const element = ElementDataRepository[symbol];
    if (!element) return null;

    // Decompression logic: magnitude + (precision * 10^-exponent)
    const fullX = element.position.magnitude + (element.position.precision * Math.pow(10, -element.position.exponent));

    // Format the number dynamically for UI display based on user preference (displayZeros)
    const formattedDisplayX = Intl.NumberFormat('en-US', { 
        minimumFractionDigits: displayZeros,
        maximumFractionDigits: displayZeros,
        useGrouping: false
    }).format(fullX);
    
    return {
        symbol: element.symbol,
        fullX: fullX, // The actual number for math operations
        displayX: formattedDisplayX // The formatted string for UI reference
    };
}

function getElementZPE(symbol) {
    const element = ElementDataRepository[symbol];
    return element ? element.zeroPointEnergy : 0;
}

// Expose the repository and function globally for site access
window.ElementDataRepository = ElementDataRepository;
window.getElementCoordinates = getElementCoordinates;
window.getElementZPE = getElementZPE;
