// Application State Management

import { storage } from './storage.js';

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
    showBranches: true,        // Toggle branches visibility
    showPRs: true,             // Toggle PRs visibility
    overviewHeadBuilds: true,  // Toggle: true = head/cron builds, false = all builds
    lastBranchBuilds: [],
    
    // Cron tab state (mirrors branch state)
    cronSortMode: 'status',
    cronFilter: '',
    lastCronBuilds: [],
    
    // Settings
    settings: {
        filterEmptyRepos: true,
        statsPeriodDays: 30  // Default period for statistics
    }
};

// Store original functions for restoration after demo mode
export const originalFunctions = {
    loadBranchBuilds: null,
    loadCronBuilds: null
};

// Load settings from localStorage
export function loadSettings() {
    const saved = storage.getSettings();
    Object.assign(state.settings, saved);
}

// Save settings to localStorage
export function saveSettings() {
    storage.saveSettings(state.settings);
}

// Load saved configs from localStorage
export function loadSavedConfigs() {
    state.savedConfigs = storage.getSavedConfigs();
}

// Save configs to localStorage
export function saveSavedConfigs() {
    storage.saveSavedConfigs(state.savedConfigs);
}

