// Moirai Dashboard - Main Entry Point
// Supports both Woodpecker and Drone CI

import { state, loadSettings, loadSavedConfigs, saveSavedConfigs } from './state.js';
import { storage } from './storage.js';
import { initGlobalErrorHandlers } from './errors.js';
import { apiRequest, getBuildsEndpoint, getExistingBranches, getOpenPullRequests, autoDetectServerTypes, loadServersFromProxy } from './api.js';
import { normalizeBuild, groupByBranch, groupByCron, sortBranchBuilds, filterBranchBuilds } from './builds.js';
import { initTheme } from './ui/theme.js';
import { initTabs, switchToTab } from './ui/tabs.js';
import { initConfigSelect, updateConfigSelectButton, updateConfigDropdownSelection, populateConfigDropdown, removeConfig } from './ui/dropdown.js';
import { initSettings, renderSavedConfigsList, populateAddConfigServerSelect } from './ui/settings.js';
import { renderBranchCards, renderCronCards } from './ui/cards.js';
import { showLoading, showPlaceholder, showError } from './ui/common.js';
import { initDemoMode, loadDemoData } from './demo.js';
import { loadOverviewData, renderOverview, initOverviewPeriodHandler } from './ui/overview.js';
import { loadInfrastructureData, renderInfrastructure, initInfraPeriodHandler } from './ui/infrastructure.js';
import { loadContributorsData, renderContributors, initContribPeriodHandler } from './ui/contributors.js';
import { initGlobalStatus, showGlobalLoader, hideGlobalLoader, forceHideGlobalLoader, setConnectionStatus, updateLastUpdateTime } from './ui/globalStatus.js';
import { initKeyboardShortcuts } from './ui/keyboard.js';

// DOM Elements
const elements = {
    configSelectBtn: document.getElementById('config-select-btn'),
    configDropdown: document.getElementById('config-dropdown'),
    branchesCards: document.getElementById('branches-cards'),
    cronCards: document.getElementById('cron-cards'),
    overviewContent: document.getElementById('overview-content'),
    infraContent: document.getElementById('infra-content'),
    contributorsContent: document.getElementById('contributors-content'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    themeToggle: document.getElementById('theme-toggle'),
    demoToggle: document.getElementById('demo-toggle'),
    branchFilter: document.getElementById('branch-filter'),
    sortSelect: document.getElementById('sort-select'),
    toggleBranches: document.getElementById('toggle-branches'),
    togglePRs: document.getElementById('toggle-prs'),
    // Settings elements
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    filterEmptyReposCheckbox: document.getElementById('setting-filter-empty-repos'),
    statsPeriodSelect: document.getElementById('setting-stats-period'),
    addConfigServerSelect: document.getElementById('add-config-server'),
    addConfigRepoSelect: document.getElementById('add-config-repo'),
    addConfigNameInput: document.getElementById('add-config-name'),
    addConfigBtn: document.getElementById('add-config-btn'),
    savedConfigsList: document.getElementById('saved-configs-list')
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initGlobalErrorHandlers();
    initGlobalStatus();
    loadSettings();
    initTheme(elements.themeToggle);
    initDemoMode(elements.demoToggle, getDemoCallbacks());
    initTabs(elements.tabButtons, elements.tabContents);
    initConfigSelect(elements.configSelectBtn, elements.configDropdown);
    initBranchToolbar();
    initSettingsTab();
    initKeyboardShortcuts({
        refresh: refreshAllData,
        tabButtons: elements.tabButtons,
        tabContents: elements.tabContents
    });
    loadData();
});

// Get callbacks for demo mode
function getDemoCallbacks() {
    return {
        loadData,
        loadBranchBuilds,
        loadCronBuilds,
        loadOverview,
        loadInfrastructure,
        loadContributors,
        populateConfigDropdown: () => populateConfigDropdown(elements.configDropdown, selectConfig),
        updateConfigSelectButton: () => updateConfigSelectButton(elements.configSelectBtn),
        elements
    };
}

// Initialize branch filter and sort controls
function initBranchToolbar() {
    // Filter input with debounce
    let filterTimeout;
    elements.branchFilter.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            state.branchFilter = e.target.value;
            if (state.lastBranchBuilds.length > 0) {
                applyBranchFilterAndRender();
            }
        }, 200);
    });

    // Sort dropdown
    elements.sortSelect.addEventListener('change', () => {
        state.branchSortMode = elements.sortSelect.value;
        if (state.lastBranchBuilds.length > 0) {
            applyBranchFilterAndRender();
        }
    });
    
    // Toggle branches visibility
    elements.toggleBranches.addEventListener('click', () => {
        elements.toggleBranches.classList.toggle('active');
        state.showBranches = elements.toggleBranches.classList.contains('active');
        if (state.lastBranchBuilds.length > 0) {
            applyBranchFilterAndRender();
        }
    });
    
    // Toggle PRs visibility
    elements.togglePRs.addEventListener('click', () => {
        elements.togglePRs.classList.toggle('active');
        state.showPRs = elements.togglePRs.classList.contains('active');
        if (state.lastBranchBuilds.length > 0) {
            applyBranchFilterAndRender();
        }
    });
}

// Shared callbacks object for config management (avoids deep nesting)
function getConfigCallbacks() {
    return {
        renderSavedConfigsList: () => renderSavedConfigsList(elements.savedConfigsList, handleRemoveConfig),
        populateConfigDropdown: () => populateConfigDropdown(elements.configDropdown, selectConfig),
        selectConfig
    };
}

// Handle remove config using shared callbacks
function handleRemoveConfig(configId) {
    removeConfig(configId, elements, getConfigCallbacks());
}

// Initialize settings tab
function initSettingsTab() {
    const settingsElements = {
        clearCacheBtn: elements.clearCacheBtn,
        filterEmptyReposCheckbox: elements.filterEmptyReposCheckbox,
        addConfigServerSelect: elements.addConfigServerSelect,
        addConfigRepoSelect: elements.addConfigRepoSelect,
        addConfigNameInput: elements.addConfigNameInput,
        addConfigBtn: elements.addConfigBtn
    };

    initSettings(settingsElements, getConfigCallbacks());
}

// Select a config from dropdown
async function selectConfig(configId) {
    elements.configDropdown.classList.remove('open');

    if (configId) {
        state.currentConfig = state.savedConfigs.find(c => c.id === configId);
        if (state.currentConfig) {
            // Set up server and repo from saved config - instant!
            state.currentServer = {
                id: state.currentConfig.serverId,
                name: state.currentConfig.serverName,
                type: state.currentConfig.serverType,
                url: state.currentConfig.serverUrl,
                token: state.currentConfig.serverToken
            };
            state.currentRepo = state.currentConfig.repoData;

            storage.saveSelectedConfig(configId);
            updateConfigSelectButton(elements.configSelectBtn);
            updateConfigDropdownSelection(elements.configDropdown);

            // Load cards with global loader
            showGlobalLoader('Loading repository data...');
            try {
                await Promise.all([
                    loadBranchBuilds(),
                    loadCronBuilds(),
                    loadOverview(),
                    loadInfrastructure(),
                    loadContributors()
                ]);
                setConnectionStatus('connected');
                updateLastUpdateTime();
            } catch (error) {
                setConnectionStatus('error', 'Failed to load data');
            } finally {
                forceHideGlobalLoader();
            }
        }
    } else {
        state.currentConfig = null;
        state.currentServer = null;
        state.currentRepo = null;
        storage.clearSelectedConfig();
        updateConfigSelectButton(elements.configSelectBtn);
        setConnectionStatus('disconnected');
        showPlaceholder(elements.branchesCards, 'Select a repository from the dropdown');
        showPlaceholder(elements.cronCards, 'Select a repository from the dropdown');
        showPlaceholder(elements.overviewContent, 'Select a repository to view overview');
        showPlaceholder(elements.infraContent, 'Select a repository to view infrastructure details');
        showPlaceholder(elements.contributorsContent, 'Select a repository to view contributors');
    }
}

// Generic tab loader to reduce duplication
function createTabLoader(container, loadFn, renderFn, initHandlerFn, loadingClass, placeholderText) {
    return async function() {
        if (!state.currentServer || !state.currentRepo) {
            showPlaceholder(container, placeholderText);
            return;
        }

        container.innerHTML = `<div class="${loadingClass}">Loading...</div>`;

        try {
            const data = await loadFn();
            renderFn(container, data);
            if (initHandlerFn) initHandlerFn(container);
        } catch (error) {
            container.innerHTML = `<div class="${loadingClass.replace('loading', 'error')}">Failed to load: ${error.message}</div>`;
        }
    };
}

// Tab loaders using factory pattern
const loadOverview = createTabLoader(
    elements.overviewContent,
    loadOverviewData,
    renderOverview,
    initOverviewPeriodHandler,
    'overview-loading',
    'Select a repository to view overview'
);

const loadInfrastructure = createTabLoader(
    elements.infraContent,
    loadInfrastructureData,
    renderInfrastructure,
    initInfraPeriodHandler,
    'infra-loading',
    'Select a repository to view infrastructure details'
);

const loadContributors = createTabLoader(
    elements.contributorsContent,
    loadContributorsData,
    renderContributors,
    initContribPeriodHandler,
    'contrib-loading',
    'Select a repository to view contributors'
);

// Load initial data
async function loadData() {
    // Load servers from proxy (tokens stay server-side)
    await loadServersFromProxy();
    
    // Auto-detect server types
    await autoDetectServerTypes();

    // Load saved configs from localStorage
    loadSavedConfigs();

    // Populate UI using shared callbacks
    const callbacks = getConfigCallbacks();
    callbacks.populateConfigDropdown();
    populateAddConfigServerSelect(elements.addConfigServerSelect);
    callbacks.renderSavedConfigsList();

    // Restore last selected config
    const savedConfigId = storage.getSelectedConfig();
    if (savedConfigId) {
        const config = state.savedConfigs.find(c => c.id === savedConfigId);
        if (config) {
            selectConfig(savedConfigId);
            return;
        }
    }

    // No saved selection
    if (state.savedConfigs.length === 0) {
        // No saved repos - auto-open Settings tab
        switchToTab('settings', elements.tabButtons, elements.tabContents);
        showPlaceholder(elements.branchesCards, 'Go to Settings to add a repository');
        showPlaceholder(elements.cronCards, 'Go to Settings to add a repository');
    } else {
        showPlaceholder(elements.branchesCards, 'Select a repository from the dropdown');
        showPlaceholder(elements.cronCards, 'Select a repository from the dropdown');
    }
}

// Load branch builds
async function loadBranchBuilds() {
    if (!state.currentRepo || !state.currentServer) return;

    showLoading(elements.branchesCards);

    try {
        // Fetch builds, existing branches, and open PRs in parallel
        const [builds, existingBranches, openPRs] = await Promise.all([
            apiRequest(getBuildsEndpoint()),
            getExistingBranches(),
            getOpenPullRequests()
        ]);

        const normalizedBuilds = builds.map(normalizeBuild);

        // Group by branch and get latest for each, filtering out deleted branches and closed PRs
        state.lastBranchBuilds = groupByBranch(normalizedBuilds, existingBranches, openPRs);
        applyBranchFilterAndRender();
    } catch (error) {
        console.error('Failed to load branch builds:', error);
        showError(elements.branchesCards, 'Failed to load branch builds.');
    }
}

// Apply current filter and render
function applyBranchFilterAndRender() {
    let filtered = filterBranchBuilds(state.lastBranchBuilds, state.branchFilter);
    
    // Filter by type (branches/PRs)
    filtered = filtered.filter(build => {
        if (build.isPR) {
            return state.showPRs;
        } else {
            return state.showBranches;
        }
    });
    
    filtered = sortBranchBuilds(filtered);
    renderBranchCards(filtered, elements.branchesCards);
}

// Load cron builds
async function loadCronBuilds() {
    if (!state.currentRepo || !state.currentServer) return;

    showLoading(elements.cronCards);

    try {
        const endpoint = getBuildsEndpoint();
        const builds = await apiRequest(endpoint);
        const normalizedBuilds = builds.map(normalizeBuild);
        const cronBuilds = normalizedBuilds.filter(b => b.event === 'cron');

        // Group by cron job name
        const groupedCronBuilds = groupByCron(cronBuilds);
        renderCronCards(groupedCronBuilds, elements.cronCards);
    } catch (error) {
        console.error('Failed to load cron builds:', error);
        showError(elements.cronCards, 'Failed to load cron builds.');
    }
}

// Refresh all data (called by keyboard shortcut R)
async function refreshAllData() {
    if (!state.currentServer || !state.currentRepo) return;
    
    showGlobalLoader('Refreshing...');
    try {
        await Promise.all([
            loadBranchBuilds(),
            loadCronBuilds(),
            loadOverview(),
            loadInfrastructure(),
            loadContributors()
        ]);
        setConnectionStatus('connected');
        updateLastUpdateTime();
    } catch (error) {
        setConnectionStatus('error', 'Refresh failed');
    } finally {
        forceHideGlobalLoader();
    }
}

// Export for console usage and demo mode
window.loadBranchBuilds = loadBranchBuilds;
window.loadCronBuilds = loadCronBuilds;
window.refreshAllData = refreshAllData;
