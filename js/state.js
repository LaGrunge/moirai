// Application State Management

// CI Type Icons (inline SVG data URLs)
export const CI_ICONS = {
    woodpecker: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#4CAF50"/><path d="M30 65 L50 35 L70 65 L50 55 Z" fill="white"/></svg>`),
    drone: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#2196F3"/><circle cx="50" cy="50" r="20" fill="white"/><circle cx="50" cy="50" r="10" fill="#2196F3"/></svg>`)
};

// Application state
export const state = {
    servers: [],           // Available servers from config
    savedConfigs: [],      // Saved server+repo configurations
    currentConfig: null,   // Currently selected config
    currentServer: null,
    currentRepo: null,
    demoMode: false,
    
    // UI state
    branchSortMode: 'status',  // 'status', 'time', 'name'
    branchFilter: '',
    lastBranchBuilds: [],
    
    // Settings
    settings: {
        filterEmptyRepos: true
    }
};

// Store original functions for restoration after demo mode
export const originalFunctions = {
    loadBranchBuilds: null,
    loadCronBuilds: null
};

// Load settings from localStorage
export function loadSettings() {
    const saved = localStorage.getItem('ci_dashboard_settings');
    if (saved) {
        try {
            Object.assign(state.settings, JSON.parse(saved));
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// Save settings to localStorage
export function saveSettings() {
    localStorage.setItem('ci_dashboard_settings', JSON.stringify(state.settings));
}

// Load saved configs from localStorage
export function loadSavedConfigs() {
    const saved = localStorage.getItem('ci_dashboard_saved_configs');
    if (saved) {
        try {
            state.savedConfigs = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to load saved configs:', e);
            state.savedConfigs = [];
        }
    }
}

// Save configs to localStorage
export function saveSavedConfigs() {
    localStorage.setItem('ci_dashboard_saved_configs', JSON.stringify(state.savedConfigs));
}

// Load servers from config.js (window.DASHBOARD_CONFIG or CI_SERVERS)
export function loadServersFromConfig() {
    let configServers = [];

    // Check both possible config formats
    if (typeof CI_SERVERS !== 'undefined' && Array.isArray(CI_SERVERS)) {
        configServers = CI_SERVERS;
    } else if (window.DASHBOARD_CONFIG && Array.isArray(window.DASHBOARD_CONFIG.servers)) {
        configServers = window.DASHBOARD_CONFIG.servers;
    }

    if (configServers.length > 0) {
        state.servers = configServers.map((s, i) => ({
            id: s.id || `server-${i}`,
            name: s.name,
            url: s.url.replace(/\/$/, ''),
            token: s.token,
            type: s.type || 'auto'
        }));
    }
    
    return state.servers;
}
