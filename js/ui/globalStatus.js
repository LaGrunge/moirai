// Global status management - loading indicator, connection status, last update time

let activeRequests = 0;
let lastUpdateTime = null;

// DOM elements (cached on init)
let globalLoader = null;
let loaderText = null;
let connectionStatus = null;
let statusText = null;
let lastUpdateEl = null;

// Initialize global status elements
export function initGlobalStatus() {
    globalLoader = document.getElementById('global-loader');
    loaderText = globalLoader?.querySelector('.loader-text');
    connectionStatus = document.getElementById('connection-status');
    statusText = connectionStatus?.querySelector('.status-text');
    lastUpdateEl = document.getElementById('last-update');
    
    // Set initial disconnected state
    setConnectionStatus('disconnected');
}

// Show global loader with optional message
export function showGlobalLoader(message = 'Loading...') {
    activeRequests++;
    if (globalLoader) {
        globalLoader.style.display = 'flex';
        if (loaderText) {
            loaderText.textContent = message;
        }
    }
}

// Hide global loader (only when all requests complete)
export function hideGlobalLoader() {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0 && globalLoader) {
        globalLoader.style.display = 'none';
    }
}

// Force hide loader (reset counter)
export function forceHideGlobalLoader() {
    activeRequests = 0;
    if (globalLoader) {
        globalLoader.style.display = 'none';
    }
}

// Set connection status: 'connected', 'disconnected', 'error'
export function setConnectionStatus(status, message = null) {
    if (!connectionStatus || !statusText) return;
    
    connectionStatus.className = 'connection-status ' + status;
    
    const messages = {
        connected: 'Connected',
        disconnected: 'Disconnected',
        error: 'Connection error'
    };
    
    statusText.textContent = message || messages[status] || status;
}

// Update last update time
export function updateLastUpdateTime() {
    lastUpdateTime = new Date();
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last update: ${formatTime(lastUpdateTime)}`;
    }
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// Get time since last update in seconds
export function getSecondsSinceLastUpdate() {
    if (!lastUpdateTime) return null;
    return Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000);
}
