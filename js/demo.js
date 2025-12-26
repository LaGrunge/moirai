// Demo mode functionality

import { state, originalFunctions } from './state.js';
import { storage } from './storage.js';
import { renderBranchCards, renderCronCards } from './ui/cards.js';

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

// Exit demo mode
export function exitDemoMode(callbacks) {
    // Restore original functions
    if (originalFunctions.loadBranchBuilds) {
        window.loadBranchBuilds = originalFunctions.loadBranchBuilds;
        window.loadCronBuilds = originalFunctions.loadCronBuilds;
    }

    // Clear demo state
    state.currentConfig = null;
    state.currentServer = null;
    state.currentRepo = null;

    // Reload real data
    if (callbacks.loadData) {
        callbacks.loadData();
    }
}

// Load demo data
export function loadDemoData(callbacks) {
    // Save original functions before overriding
    if (!originalFunctions.loadBranchBuilds && callbacks.loadBranchBuilds) {
        originalFunctions.loadBranchBuilds = callbacks.loadBranchBuilds;
        originalFunctions.loadCronBuilds = callbacks.loadCronBuilds;
    }

    // Create demo config
    const demoConfig = {
        id: 'demo-config',
        serverId: 'demo-woodpecker',
        serverName: 'Demo Woodpecker',
        serverType: 'woodpecker',
        serverUrl: 'https://ci.example.com',
        serverToken: 'demo',
        repoId: '1',
        repoFullName: 'woodpecker-ci/woodpecker',
        repoData: { id: 1, owner: 'woodpecker-ci', name: 'woodpecker', full_name: 'woodpecker-ci/woodpecker' },
        displayName: 'Demo Project'
    };

    // Set demo as current
    state.savedConfigs = [demoConfig];
    state.currentConfig = demoConfig;
    state.currentServer = {
        id: demoConfig.serverId,
        name: demoConfig.serverName,
        type: demoConfig.serverType,
        url: demoConfig.serverUrl,
        token: demoConfig.serverToken
    };
    state.currentRepo = demoConfig.repoData;

    // Update UI
    if (callbacks.populateConfigDropdown) {
        callbacks.populateConfigDropdown();
    }
    if (callbacks.updateConfigSelectButton) {
        callbacks.updateConfigSelectButton();
    }
    
    loadDemoBranchBuilds(callbacks.elements?.branchesCards);
    loadDemoCronBuilds(callbacks.elements?.cronCards);
}

// Load demo branch builds
export function loadDemoBranchBuilds(container) {
    const demoBuilds = [
        {
            number: 142,
            branch: 'main',
            displayName: 'main',
            status: 'success',
            event: 'push',
            commit: 'a1b2c3d4e5f6g7h8i9j0',
            message: 'feat: add new dashboard feature',
            created: Math.floor(Date.now() / 1000) - 3600,
            started: Math.floor(Date.now() / 1000) - 3500,
            finished: Math.floor(Date.now() / 1000) - 3200
        },
        {
            number: 141,
            branch: 'develop',
            displayName: 'develop',
            status: 'running',
            event: 'push',
            commit: 'b2c3d4e5f6g7h8i9j0k1',
            message: 'chore: update dependencies',
            created: Math.floor(Date.now() / 1000) - 600,
            started: Math.floor(Date.now() / 1000) - 550,
            finished: null
        },
        {
            number: 140,
            branch: 'feature/auth',
            displayName: 'feature/auth',
            status: 'failure',
            event: 'push',
            commit: 'c3d4e5f6g7h8i9j0k1l2',
            message: 'fix: authentication flow',
            created: Math.floor(Date.now() / 1000) - 7200,
            started: Math.floor(Date.now() / 1000) - 7100,
            finished: Math.floor(Date.now() / 1000) - 6900
        },
        {
            number: 139,
            branch: 'feature/api',
            displayName: 'PR #42',
            status: 'success',
            event: 'pull_request',
            isPR: true,
            prNumber: 42,
            commit: 'd4e5f6g7h8i9j0k1l2m3',
            message: 'feat: implement REST API endpoints',
            ref: 'refs/pull/42/head',
            created: Math.floor(Date.now() / 1000) - 86400,
            started: Math.floor(Date.now() / 1000) - 86300,
            finished: Math.floor(Date.now() / 1000) - 85800
        },
        {
            number: 138,
            branch: 'hotfix/security',
            displayName: 'hotfix/security',
            status: 'pending',
            event: 'push',
            commit: 'e5f6g7h8i9j0k1l2m3n4',
            message: 'security: patch vulnerability',
            created: Math.floor(Date.now() / 1000) - 300,
            started: null,
            finished: null
        }
    ];

    if (container) {
        renderBranchCards(demoBuilds, container);
    }
}

// Load demo cron builds
export function loadDemoCronBuilds(container) {
    const demoCronBuilds = [
        {
            number: 135,
            branch: 'main',
            cron: 'nightly-build',
            status: 'success',
            event: 'cron',
            commit: 'a1b2c3d4e5f6g7h8i9j0',
            message: 'Nightly build',
            created: Math.floor(Date.now() / 1000) - 28800,
            started: Math.floor(Date.now() / 1000) - 28700,
            finished: Math.floor(Date.now() / 1000) - 27000
        },
        {
            number: 130,
            branch: 'main',
            cron: 'weekly-security-scan',
            status: 'success',
            event: 'cron',
            commit: 'f6g7h8i9j0k1l2m3n4o5',
            message: 'Weekly security scan',
            created: Math.floor(Date.now() / 1000) - 172800,
            started: Math.floor(Date.now() / 1000) - 172700,
            finished: Math.floor(Date.now() / 1000) - 171000
        },
        {
            number: 125,
            branch: 'develop',
            cron: 'integration-tests',
            status: 'failure',
            event: 'cron',
            commit: 'g7h8i9j0k1l2m3n4o5p6',
            message: 'Integration tests',
            created: Math.floor(Date.now() / 1000) - 43200,
            started: Math.floor(Date.now() / 1000) - 43100,
            finished: Math.floor(Date.now() / 1000) - 42000
        }
    ];

    if (container) {
        renderCronCards(demoCronBuilds, container);
    }
}
