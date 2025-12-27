// Demo mode functionality

import { state, originalFunctions } from './state.js';
import { storage } from './storage.js';
import { renderBranchCards, renderCronCards } from './ui/cards.js';
import { renderOverview, initOverviewPeriodHandler, setOverviewDemoData } from './ui/overview.js';
import { renderInfrastructure, initInfraPeriodHandler } from './ui/infrastructure.js';
import { renderContributors, initContribPeriodHandler } from './ui/contributors.js';
import { 
    DEMO_BUILDS, 
    DEMO_CRON_BUILDS, 
    DEMO_OVERVIEW, 
    DEMO_INFRASTRUCTURE, 
    DEMO_CONTRIBUTORS,
    DEMO_CONFIG,
    getDemoTrendData,
    DEMO_ALL_BUILDS,
    DEMO_OVERVIEW_CRON_BUILDS
} from './demoData.js';

// Update demo mode UI
export function updateDemoModeUI(demoToggle) {
    if (state.demoMode) {
        demoToggle.classList.add('active');
        demoToggle.title = 'Demo mode ON - click to disable';
    } else {
        demoToggle.classList.remove('active');
        demoToggle.title = 'Demo mode OFF - click to enable';
    }
}

// Initialize demo mode
export function initDemoMode(demoToggle, callbacks) {
    state.demoMode = storage.getDemoMode();
    updateDemoModeUI(demoToggle);

    demoToggle.addEventListener('click', () => {
        state.demoMode = !state.demoMode;
        storage.saveDemoMode(state.demoMode);
        updateDemoModeUI(demoToggle);

        if (state.demoMode) {
            loadDemoData(callbacks);
        } else {
            exitDemoMode(callbacks);
        }
    });
}

// Store original state for demo mode
let originalState = null;

// Exit demo mode
export function exitDemoMode(callbacks) {
    // Restore original functions
    if (originalFunctions.loadBranchBuilds) {
        window.loadBranchBuilds = originalFunctions.loadBranchBuilds;
        window.loadCronBuilds = originalFunctions.loadCronBuilds;
    }

    // Clear original state
    originalState = null;
    
    // Clear demo state
    state.currentConfig = null;
    state.currentServer = null;
    state.currentRepo = null;
    state.savedConfigs = [];

    // Reload everything from scratch
    if (callbacks.loadData) {
        callbacks.loadData();
    }
}

// Load demo data
export function loadDemoData(callbacks) {
    // Save original state before overriding
    if (!originalState) {
        originalState = {
            savedConfigs: [...state.savedConfigs],
            currentConfig: state.currentConfig,
            currentServer: state.currentServer,
            currentRepo: state.currentRepo
        };
    }
    
    // Save original functions before overriding
    if (!originalFunctions.loadBranchBuilds && callbacks.loadBranchBuilds) {
        originalFunctions.loadBranchBuilds = callbacks.loadBranchBuilds;
        originalFunctions.loadCronBuilds = callbacks.loadCronBuilds;
    }

    // Set demo as current
    state.savedConfigs = [DEMO_CONFIG];
    state.currentConfig = DEMO_CONFIG;
    state.currentServer = {
        id: DEMO_CONFIG.serverId,
        name: DEMO_CONFIG.serverName,
        type: DEMO_CONFIG.serverType,
        url: DEMO_CONFIG.serverUrl,
        token: DEMO_CONFIG.serverToken
    };
    state.currentRepo = DEMO_CONFIG.repoData;

    // Update UI
    if (callbacks.populateConfigDropdown) {
        callbacks.populateConfigDropdown();
    }
    if (callbacks.updateConfigSelectButton) {
        callbacks.updateConfigSelectButton();
    }
    
    loadDemoBranchBuilds(callbacks.elements?.branchesCards);
    loadDemoCronBuilds(callbacks.elements?.cronCards);
    loadDemoOverview(callbacks.elements?.overviewContent);
    loadDemoInfrastructure(callbacks.elements?.infraContent);
    loadDemoContributors(callbacks.elements?.contributorsContent);
}

// Load demo branch builds
export function loadDemoBranchBuilds(container) {
    // Store demo builds in state for filtering
    state.lastBranchBuilds = DEMO_BUILDS;
    
    if (container) {
        renderBranchCards(DEMO_BUILDS, container);
    }
}

// Load demo cron builds  
export function loadDemoCronBuilds(container) {
    // Group cron builds by cron job name and store in state for filtering
    const cronGroups = {};
    DEMO_CRON_BUILDS.forEach(build => {
        const cronName = build.cron || 'default';
        if (!cronGroups[cronName] || build.created > cronGroups[cronName].created) {
            cronGroups[cronName] = build;
        }
    });
    state.lastCronBuilds = Object.values(cronGroups);
    
    if (container) {
        renderCronCards(state.lastCronBuilds, container);
    }
}

// Load demo overview
function loadDemoOverview(container) {
    if (!container) return;
    
    // Set demo data for overview toggle functionality
    setOverviewDemoData(DEMO_ALL_BUILDS, DEMO_OVERVIEW_CRON_BUILDS, 30);
    
    const demoData = {
        ...DEMO_OVERVIEW,
        trendData: getDemoTrendData(30)
    };
    renderOverview(container, demoData);
    initOverviewPeriodHandler(container);
}

// Load demo infrastructure
function loadDemoInfrastructure(container) {
    if (!container) return;
    
    renderInfrastructure(container, DEMO_INFRASTRUCTURE);
    initInfraPeriodHandler(container);
}

// Load demo contributors
function loadDemoContributors(container) {
    if (!container) return;
    
    renderContributors(container, DEMO_CONTRIBUTORS);
    initContribPeriodHandler(container);
}
