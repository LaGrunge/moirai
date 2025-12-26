// CI Dashboard Application
// Supports both Woodpecker and Drone CI

// State
let servers = [];
let currentServer = null;
let currentRepo = null;
let repositories = [];
let demoMode = false;

// Settings (loaded from localStorage)
const settings = {
    filterEmptyRepos: true
};

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('ci_dashboard_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(settings, parsed);
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('ci_dashboard_settings', JSON.stringify(settings));
}

// Store original functions for restoration after demo mode
const originalFunctions = {
    loadRepositories: null,
    loadBranchBuilds: null,
    loadCronBuilds: null
};

// CI Type Icons (inline SVG data URLs)
const CI_ICONS = {
    woodpecker: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#4CAF50"/><path d="M30 65 L50 35 L70 65 L50 55 Z" fill="white"/></svg>`),
    drone: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#2196F3"/><circle cx="50" cy="50" r="20" fill="white"/><circle cx="50" cy="50" r="10" fill="#2196F3"/></svg>`)
};

// DOM Elements
const serverSelectWrapper = document.getElementById('server-select');
const serverSelectBtn = document.getElementById('server-select-btn');
const serverDropdown = document.getElementById('server-dropdown');
const repoSelect = document.getElementById('repo-select');
const branchesCards = document.getElementById('branches-cards');
const cronCards = document.getElementById('cron-cards');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const themeToggle = document.getElementById('theme-toggle');
const demoToggle = document.getElementById('demo-toggle');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initTheme();
    initDemoMode();
    initTabs();
    initServerSelect();
    initRepoSelect();
    initBranchToolbar();
    initSettings();
    loadServers();
});

// Initialize settings tab
function initSettings() {
    const filterEmptyReposCheckbox = document.getElementById('setting-filter-empty-repos');
    const clearCacheBtn = document.getElementById('clear-cache-btn');

    // Set initial state from settings
    filterEmptyReposCheckbox.checked = settings.filterEmptyRepos;

    // Handle checkbox change
    filterEmptyReposCheckbox.addEventListener('change', (e) => {
        settings.filterEmptyRepos = e.target.checked;
        saveSettings();
        // Reload repositories with new setting
        if (currentServer) {
            loadRepositories();
        }
    });

    // Handle clear cache button
    clearCacheBtn.addEventListener('click', () => {
        localStorage.removeItem('ci_dashboard_selected_server');
        localStorage.removeItem('ci_dashboard_selected_repo');
        localStorage.removeItem('ci_dashboard_repo_selections');
        alert('Cache cleared! Page will reload.');
        location.reload();
    });
}

// Initialize branch filter and sort controls
function initBranchToolbar() {
    const filterInput = document.getElementById('branch-filter');
    const sortButtons = document.querySelectorAll('.sort-btn');

    // Filter input with debounce
    let filterTimeout;
    filterInput.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            branchFilter = e.target.value;
            if (lastBranchBuilds.length > 0) {
                applyBranchFilterAndRender();
            }
        }, 200);
    });

    // Sort buttons
    sortButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const sortMode = btn.dataset.sort;
            branchSortMode = sortMode;

            // Update active state
            sortButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-render with new sort
            if (lastBranchBuilds.length > 0) {
                applyBranchFilterAndRender();
            }
        });
    });
}

// Theme switching
function initTheme() {
    const savedTheme = localStorage.getItem('ci_dashboard_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ci_dashboard_theme', newTheme);
    });
}

// Demo mode toggle
function initDemoMode() {
    const savedDemoMode = localStorage.getItem('ci_dashboard_demo_mode') === 'true';
    demoMode = savedDemoMode;
    updateDemoModeUI();

    demoToggle.addEventListener('click', () => {
        demoMode = !demoMode;
        localStorage.setItem('ci_dashboard_demo_mode', demoMode);
        updateDemoModeUI();

        if (demoMode) {
            loadDemoData();
        } else {
            // Exit demo mode - reload real servers
            exitDemoMode();
        }
    });
}

function updateDemoModeUI() {
    if (demoMode) {
        demoToggle.classList.add('active');
        demoToggle.title = 'Demo mode ON - click to disable';
    } else {
        demoToggle.classList.remove('active');
        demoToggle.title = 'Demo mode OFF - click to enable';
    }
}

function exitDemoMode() {
    // Restore original functions
    if (originalFunctions.loadRepositories) {
        window.loadRepositories = originalFunctions.loadRepositories;
        window.loadBranchBuilds = originalFunctions.loadBranchBuilds;
        window.loadCronBuilds = originalFunctions.loadCronBuilds;
    }

    // Clear demo state
    currentServer = null;
    currentRepo = null;
    repositories = [];

    // Reload real servers from storage (filter out any demo servers)
    const savedServers = localStorage.getItem('ci_dashboard_servers');
    if (savedServers) {
        try {
            servers = JSON.parse(savedServers).filter(s => !s.id.startsWith('demo-'));
            // Save back without demo servers
            localStorage.setItem('ci_dashboard_servers', JSON.stringify(servers));
        } catch (e) {
            servers = [];
        }
    } else {
        servers = [];
    }

    if (servers.length > 0) {
        populateServerSelect();
    } else {
        serverDropdown.innerHTML = '';
        updateServerSelectButton();
        repoSelect.innerHTML = '<option value="">Select repository...</option>';
        showPlaceholder(branchesCards, 'Add a server to get started. Use addServer() in console.');
        showPlaceholder(cronCards, 'Add a server to get started.');
    }
}

// Tab switching
function initTabs() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Server selection - custom dropdown with icons
function initServerSelect() {
    // Toggle dropdown
    serverSelectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        serverDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        serverDropdown.classList.remove('open');
    });

    // Prevent dropdown from closing when clicking inside it
    serverDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Select a server from dropdown
function selectServer(serverId) {
    serverDropdown.classList.remove('open');

    if (serverId) {
        currentServer = servers.find(s => s.id === serverId);
        localStorage.setItem('ci_dashboard_selected_server', serverId);
        currentRepo = null;
        repositories = [];
        updateServerSelectButton();
        updateServerDropdownSelection();
        loadRepositories();
    } else {
        currentServer = null;
        currentRepo = null;
        repositories = [];
        localStorage.removeItem('ci_dashboard_selected_server');
        updateServerSelectButton();
        repoSelect.innerHTML = '<option value="">Select repository...</option>';
        showPlaceholder(branchesCards, 'Select a server and repository');
        showPlaceholder(cronCards, 'Select a server and repository');
    }
}

// Update the server select button to show current selection
function updateServerSelectButton() {
    const iconEl = serverSelectBtn.querySelector('.server-icon');
    const nameEl = serverSelectBtn.querySelector('.server-name');

    if (currentServer) {
        iconEl.innerHTML = `<img src="${CI_ICONS[currentServer.type] || CI_ICONS.woodpecker}" alt="${currentServer.type}">`;
        nameEl.textContent = currentServer.name;
    } else {
        iconEl.innerHTML = '';
        nameEl.textContent = 'Select server...';
    }
}

// Update dropdown to show which item is selected
function updateServerDropdownSelection() {
    const items = serverDropdown.querySelectorAll('.server-dropdown-item');
    items.forEach(item => {
        if (item.dataset.serverId === (currentServer ? currentServer.id : '')) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Repository selection
function initRepoSelect() {
    repoSelect.addEventListener('change', (e) => {
        const repoId = e.target.value;
        if (repoId) {
            currentRepo = repositories.find(r => getRepoId(r) === repoId);
            // Save repo selection per server
            saveSelectedRepo(currentServer.id, repoId);
            loadBranchBuilds();
            loadCronBuilds();
        } else {
            currentRepo = null;
            if (currentServer) {
                clearSelectedRepo(currentServer.id);
            }
            showPlaceholder(branchesCards, 'Select a repository to view branch status');
            showPlaceholder(cronCards, 'Select a repository to view cron builds');
        }
    });
}

// Save selected repo for a specific server
function saveSelectedRepo(serverId, repoId) {
    const selections = JSON.parse(localStorage.getItem('ci_dashboard_repo_selections') || '{}');
    selections[serverId] = repoId;
    localStorage.setItem('ci_dashboard_repo_selections', JSON.stringify(selections));
}

// Get saved repo for a specific server
function getSavedRepoForServer(serverId) {
    const selections = JSON.parse(localStorage.getItem('ci_dashboard_repo_selections') || '{}');
    return selections[serverId] || null;
}

// Clear selected repo for a specific server
function clearSelectedRepo(serverId) {
    const selections = JSON.parse(localStorage.getItem('ci_dashboard_repo_selections') || '{}');
    delete selections[serverId];
    localStorage.setItem('ci_dashboard_repo_selections', JSON.stringify(selections));
}

// Get repository ID (works for both Drone and Woodpecker)
function getRepoId(repo) {
    return repo.id ? repo.id.toString() : `${repo.owner}/${repo.name}`;
}

// Get repository full name
function getRepoFullName(repo) {
    return repo.full_name || repo.slug || `${repo.owner}/${repo.name}`;
}

// Load servers from config file or localStorage
function loadServers() {
    // Check if demo mode is enabled
    if (demoMode) {
        loadDemoData();
        return;
    }

    // First, check if config.js has servers defined
    if (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.servers && window.DASHBOARD_CONFIG.servers.length > 0) {
        // Load servers from config file, auto-detect type if not specified
        loadServersFromConfig();
        return;
    }

    // Fall back to localStorage
    const savedServers = localStorage.getItem('ci_dashboard_servers');
    if (savedServers) {
        try {
            // Filter out any demo servers that might have been saved
            servers = JSON.parse(savedServers).filter(s => !s.id.startsWith('demo-'));
        } catch (e) {
            servers = [];
        }
    } else {
        servers = [];
    }

    if (servers.length > 0) {
        populateServerSelect();
    } else {
        // No servers configured - show instructions
        showPlaceholder(branchesCards, 'Add a server to get started. Use addServer() in console or enable Demo mode.');
        showPlaceholder(cronCards, 'Add a server to get started.');
    }
}

// Save servers to localStorage
function saveServers() {
    localStorage.setItem('ci_dashboard_servers', JSON.stringify(servers));
}

// Load servers from config.js with auto-detection of type
async function loadServersFromConfig() {
    const configServers = window.DASHBOARD_CONFIG.servers;
    servers = [];

    showPlaceholder(branchesCards, 'Loading servers...');

    for (let i = 0; i < configServers.length; i++) {
        const s = configServers[i];
        const url = s.url.replace(/\/$/, ''); // Remove trailing slash
        let type = s.type;

        // Auto-detect type if not specified
        if (!type) {
            console.log(`Auto-detecting type for ${s.name}...`);
            type = await detectCIType(url, s.token);
        }

        servers.push({
            id: s.id || `config-server-${i}`,
            name: s.name,
            url: url,
            token: s.token,
            type: type
        });
    }

    console.log('Loaded servers from config.js:', servers.length);
    populateServerSelect();
}

// Populate server dropdown with icons
function populateServerSelect() {
    // Build dropdown items
    serverDropdown.innerHTML = '';

    servers.forEach(server => {
        const item = document.createElement('div');
        item.className = 'server-dropdown-item';
        item.dataset.serverId = server.id;
        item.innerHTML = `
            <span class="server-icon"><img src="${CI_ICONS[server.type] || CI_ICONS.woodpecker}" alt="${server.type}"></span>
            <span class="server-name">${escapeHtml(server.name)}</span>
        `;
        item.addEventListener('click', () => selectServer(server.id));
        serverDropdown.appendChild(item);
    });

    // Try to restore saved server selection
    const savedServerId = localStorage.getItem('ci_dashboard_selected_server');
    const savedServer = savedServerId ? servers.find(s => s.id === savedServerId) : null;

    if (savedServer) {
        currentServer = savedServer;
        updateServerSelectButton();
        updateServerDropdownSelection();
        loadRepositories();
    } else if (servers.length === 1) {
        currentServer = servers[0];
        localStorage.setItem('ci_dashboard_selected_server', servers[0].id);
        updateServerSelectButton();
        updateServerDropdownSelection();
        loadRepositories();
    } else {
        updateServerSelectButton();
        showPlaceholder(branchesCards, 'Select a server to get started');
    }
}

// Detect CI type (Drone or Woodpecker)
async function detectCIType(serverUrl, apiToken) {
    console.log('Detecting CI type for:', serverUrl);

    // Try Woodpecker version endpoint - this is the most reliable check
    try {
        const wpResponse = await fetch(`${serverUrl}/api/version`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        if (wpResponse.ok) {
            const text = await wpResponse.text();
            try {
                const data = JSON.parse(text);
                console.log('Version response:', data);
                // Woodpecker always has version endpoint, check for woodpecker-specific fields
                // Woodpecker 2.x has 'source' field pointing to GitHub repo
                // Or version string contains 'next' or starts with '2.' or '3.'
                if (data.source ||
                    (data.version && (data.version.includes('next') ||
                                      data.version.startsWith('2.') ||
                                      data.version.startsWith('3.')))) {
                    console.log('Detected: woodpecker (from version)');
                    return 'woodpecker';
                }
            } catch (parseError) {
                console.log('Version response is not JSON, skipping');
            }
        }
    } catch (e) {
        console.log('Version endpoint check failed:', e);
    }

    // Check repos structure - Woodpecker uses 'full_name', Drone uses 'slug'
    try {
        const reposResponse = await fetch(`${serverUrl}/api/user/repos?per_page=1`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        if (reposResponse.ok) {
            const repos = await reposResponse.json();
            console.log('Repos sample:', repos[0]);
            if (repos.length > 0) {
                const repo = repos[0];
                // Woodpecker specific fields
                if (repo.forge_remote_id !== undefined ||
                    repo.netrc_only_trusted !== undefined ||
                    repo.full_name) {
                    console.log('Detected: woodpecker (from repo structure)');
                    return 'woodpecker';
                }
                // Drone specific - has slug but not full_name
                if (repo.slug && !repo.full_name) {
                    console.log('Detected: drone (from repo structure)');
                    return 'drone';
                }
            }
        }
    } catch (e) {
        console.log('Repos check failed:', e);
    }

    // Default to woodpecker
    console.log('Detected: woodpecker (default)');
    return 'woodpecker';
}

// API request helper
async function apiRequest(endpoint) {
    if (!currentServer) throw new Error('No server selected');

    const url = `${currentServer.url}/api${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${currentServer.token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Load repositories
async function loadRepositories() {
    if (!currentServer) return;

    try {
        showLoading(branchesCards);
        repoSelect.innerHTML = '<option value="">Loading repositories...</option>';

        const allRepos = await apiRequest('/user/repos');

        // Filter out repositories with no builds (if setting enabled)
        if (settings.filterEmptyRepos) {
            repoSelect.innerHTML = '<option value="">Checking builds...</option>';
            repositories = await filterReposWithBuilds(allRepos);
        } else {
            repositories = allRepos;
        }

        populateRepoSelect(repositories);
    } catch (error) {
        console.error('Failed to load repositories:', error);
        repoSelect.innerHTML = '<option value="">Select repository...</option>';
        showError(branchesCards, 'Failed to load repositories. Check connection settings.');
    }
}

// Filter repositories that have at least one build
async function filterReposWithBuilds(repos) {
    // Check builds for each repo in parallel (limit concurrency to avoid overwhelming server)
    const batchSize = 10;
    const reposWithBuilds = [];

    for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (repo) => {
            try {
                const hasBuilds = await checkRepoHasBuilds(repo);
                return hasBuilds ? repo : null;
            } catch (e) {
                // If check fails, include repo anyway
                return repo;
            }
        }));
        reposWithBuilds.push(...results.filter(r => r !== null));
    }

    return reposWithBuilds;
}

// Check if a repository has any builds
async function checkRepoHasBuilds(repo) {
    const repoFullName = repo.full_name || repo.slug || `${repo.owner}/${repo.name}`;
    let endpoint;

    if (currentServer.type === 'drone') {
        endpoint = `/repos/${repoFullName}/builds?per_page=1`;
    } else {
        endpoint = `/repos/${repo.id}/pipelines?per_page=1`;
    }

    try {
        const builds = await apiRequest(endpoint);
        return builds && builds.length > 0;
    } catch (e) {
        return false;
    }
}

// Populate repository dropdown
function populateRepoSelect(repos) {
    repoSelect.innerHTML = '<option value="">Select repository...</option>';
    repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = getRepoId(repo);
        option.textContent = getRepoFullName(repo);
        repoSelect.appendChild(option);
    });

    // Try to restore saved repository selection for this server
    const savedRepoId = currentServer ? getSavedRepoForServer(currentServer.id) : null;
    const savedRepo = savedRepoId ? repos.find(r => getRepoId(r) === savedRepoId) : null;

    if (savedRepo) {
        repoSelect.value = savedRepoId;
        currentRepo = savedRepo;
        loadBranchBuilds();
        loadCronBuilds();
    } else if (repos.length === 1) {
        const repoId = getRepoId(repos[0]);
        repoSelect.value = repoId;
        currentRepo = repos[0];
        if (currentServer) {
            saveSelectedRepo(currentServer.id, repoId);
        }
        loadBranchBuilds();
        loadCronBuilds();
    } else {
        showPlaceholder(branchesCards, 'Select a repository to view branch status');
        showPlaceholder(cronCards, 'Select a repository to view cron builds');
    }
}

// Get builds endpoint based on CI type
function getBuildsEndpoint() {
    const repoFullName = getRepoFullName(currentRepo);

    if (currentServer.type === 'drone') {
        // Drone uses /api/repos/{owner}/{repo}/builds
        return `/repos/${repoFullName}/builds?per_page=100`;
    } else {
        // Woodpecker uses /api/repos/{repo_id}/pipelines
        return `/repos/${currentRepo.id}/pipelines?per_page=100`;
    }
}

// Normalize build data from different CI systems
function normalizeBuild(build) {
    // Drone uses 'target' for branch, Woodpecker uses 'branch'
    // Drone uses 'trigger' for event, Woodpecker uses 'event'
    // Drone uses 'before'/'after' for commits, Woodpecker uses 'commit'
    const event = build.event || build.trigger;
    const isPR = event === 'pull_request' || event === 'pull-request';

    return {
        number: build.number,
        branch: build.branch || build.target,
        status: build.status,
        event: event,
        isPR: isPR,
        prNumber: build.pull_request_number || build.pr || (isPR ? extractPRNumber(build.ref) : null),
        prTitle: build.title || null,  // Woodpecker stores PR title in 'title' field
        commit: build.commit || build.after,
        message: build.message,
        created: build.created || build.created_at,
        started: build.started || build.started_at,
        finished: build.finished || build.finished_at,
        ref: build.ref,
        refspec: build.refspec,
        cron: build.cron || build.cron_name
    };
}

// Extract PR number from ref like "refs/pull/123/head"
function extractPRNumber(ref) {
    if (!ref) return null;
    const match = ref.match(/refs\/pull\/(\d+)/);
    return match ? match[1] : null;
}

// Get existing branches from repository
async function getExistingBranches() {
    try {
        if (currentServer.type === 'woodpecker') {
            // Woodpecker: /api/repos/{repo_id}/branches
            const branches = await apiRequest(`/repos/${currentRepo.id}/branches`);
            return new Set(branches.map(b => b.name || b));
        } else {
            // Drone doesn't have branches endpoint, return null to skip filtering
            return null;
        }
    } catch (error) {
        console.log('Could not fetch branches, skipping filter:', error);
        return null;
    }
}

// Get open pull requests from repository
async function getOpenPullRequests() {
    try {
        if (currentServer.type === 'woodpecker') {
            // Woodpecker: /api/repos/{repo_id}/pull_requests
            const pullRequests = await apiRequest(`/repos/${currentRepo.id}/pull_requests`);
            // Return set of open PR numbers
            return new Set(pullRequests.map(pr => pr.number?.toString() || pr.index?.toString()));
        } else {
            // Drone doesn't have PR endpoint, return null to skip filtering
            return null;
        }
    } catch (error) {
        console.log('Could not fetch pull requests, showing all PRs:', error);
        return null;
    }
}

// Store last loaded builds for re-filtering/sorting without API call
let lastBranchBuilds = [];

// Load branch builds
async function loadBranchBuilds() {
    if (!currentRepo || !currentServer) return;

    showLoading(branchesCards);

    try {
        // Fetch builds, existing branches, and open PRs in parallel
        const [builds, existingBranches, openPRs] = await Promise.all([
            apiRequest(getBuildsEndpoint()),
            getExistingBranches(),
            getOpenPullRequests()
        ]);

        const normalizedBuilds = builds.map(normalizeBuild);

        // Group by branch and get latest for each, filtering out deleted branches and closed PRs
        lastBranchBuilds = groupByBranch(normalizedBuilds, existingBranches, openPRs);
        applyBranchFilterAndRender();
    } catch (error) {
        console.error('Failed to load branch builds:', error);
        showError(branchesCards, 'Failed to load branch builds.');
    }
}

// Apply current filter and render
function applyBranchFilterAndRender() {
    let filtered = filterBranchBuilds(lastBranchBuilds, branchFilter);
    filtered = sortBranchBuilds(filtered);
    renderBranchCards(filtered);
}

// Load cron builds
async function loadCronBuilds() {
    if (!currentRepo || !currentServer) return;

    showLoading(cronCards);

    try {
        const endpoint = getBuildsEndpoint();
        const builds = await apiRequest(endpoint);
        const normalizedBuilds = builds.map(normalizeBuild);
        const cronBuilds = normalizedBuilds.filter(b => b.event === 'cron');

        // Group by cron job name
        const groupedCronBuilds = groupByCron(cronBuilds);
        renderCronCards(groupedCronBuilds);
    } catch (error) {
        console.error('Failed to load cron builds:', error);
        showError(cronCards, 'Failed to load cron builds.');
    }
}

// Current sort mode for branches
let branchSortMode = 'status'; // 'status', 'time', 'name'
let branchFilter = '';

// Group pipelines by branch (includes PRs)
function groupByBranch(pipelines, existingBranches = null, openPRs = null) {
    const branches = {};
    const prs = {};

    pipelines.forEach(pipeline => {
        const branch = pipeline.branch;
        if (!branch) return;

        // Skip cron events for branch view
        if (pipeline.event === 'cron') return;

        // Handle PRs separately - group by PR number
        if (pipeline.isPR && pipeline.prNumber) {
            // Skip closed/merged PRs if we have the list of open PRs
            if (openPRs && !openPRs.has(pipeline.prNumber.toString())) {
                return;
            }

            const prKey = `PR #${pipeline.prNumber}`;
            if (!prs[prKey] || pipeline.number > prs[prKey].number) {
                // Use prTitle (from build.title) for PR title
                const displayName = pipeline.prTitle ? `#${pipeline.prNumber}: ${pipeline.prTitle}` : prKey;
                prs[prKey] = { ...pipeline, displayName: displayName };
            }
            return;
        }

        // Skip deleted branches if we have the list (but not for PRs)
        if (existingBranches && !existingBranches.has(branch)) {
            return;
        }

        if (!branches[branch] || pipeline.number > branches[branch].number) {
            branches[branch] = { ...pipeline, displayName: branch };
        }
    });

    // Combine branches and PRs
    const allBuilds = [...Object.values(branches), ...Object.values(prs)];

    return sortBranchBuilds(allBuilds);
}

// Sort branch builds based on current sort mode
function sortBranchBuilds(builds) {
    return builds.sort((a, b) => {
        switch (branchSortMode) {
            case 'time':
                return (b.created || 0) - (a.created || 0);
            case 'name':
                return (a.displayName || a.branch).localeCompare(b.displayName || b.branch);
            case 'status':
            default:
                // Sort by status (failures first), then by date
                const statusOrder = { failure: 0, error: 1, running: 2, pending: 3, success: 4, killed: 5, skipped: 6 };
                const aOrder = statusOrder[a.status] ?? 7;
                const bOrder = statusOrder[b.status] ?? 7;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return (b.created || 0) - (a.created || 0);
        }
    });
}

// Filter builds by name
function filterBranchBuilds(builds, filter) {
    if (!filter) return builds;
    const lowerFilter = filter.toLowerCase();
    return builds.filter(b => {
        const name = (b.displayName || b.branch || '').toLowerCase();
        return name.includes(lowerFilter);
    });
}

// Group pipelines by cron job
function groupByCron(pipelines) {
    const crons = {};

    pipelines.forEach(pipeline => {
        const cronName = pipeline.cron || 'default';

        if (!crons[cronName] || pipeline.number > crons[cronName].number) {
            crons[cronName] = pipeline;
        }
    });

    return Object.values(crons).sort((a, b) => {
        return new Date(b.created) - new Date(a.created);
    });
}

// Render branch cards
function renderBranchCards(builds) {
    if (builds.length === 0) {
        showPlaceholder(branchesCards, 'No builds to display');
        return;
    }

    branchesCards.innerHTML = builds.map(build => createBuildCard(build, 'branch')).join('');
}

// Render cron cards
function renderCronCards(builds) {
    if (builds.length === 0) {
        showPlaceholder(cronCards, 'No cron builds to display');
        return;
    }

    cronCards.innerHTML = builds.map(build => createBuildCard(build, 'cron')).join('');
}

// Get build URL based on CI type
function getBuildUrl(build) {
    const repoFullName = getRepoFullName(currentRepo);

    if (currentServer.type === 'drone') {
        return `${currentServer.url}/${repoFullName}/${build.number}`;
    } else {
        return `${currentServer.url}/repos/${currentRepo.id}/pipeline/${build.number}`;
    }
}

// Create build card HTML
function createBuildCard(build, type) {
    const statusClass = getStatusClass(build.status);
    const statusText = getStatusText(build.status);
    const timeAgo = formatTimeAgo(build.created);
    const duration = formatDuration(build.started, build.finished);
    const commitSha = build.commit ? build.commit.substring(0, 8) : 'N/A';
    const commitMessage = build.message || 'No commit message';

    // Use displayName for PRs, branch for regular builds, cron name for cron
    let title, icon;
    if (type === 'cron') {
        title = build.cron || 'Cron Job';
        icon = '⏰';
    } else if (build.isPR) {
        title = build.displayName || `PR #${build.prNumber}`;
        icon = '🔀';
    } else {
        title = build.displayName || build.branch;
        icon = '🌿';
    }

    // Build URLs
    const repoFullName = getRepoFullName(currentRepo);
    const buildUrl = getBuildUrl(build);
    const commitUrl = build.commit ? `https://github.com/${repoFullName}/commit/${build.commit}` : null;
    const prUrl = (build.isPR && build.prNumber) ?
        `https://github.com/${repoFullName}/pull/${build.prNumber}` : null;

    return `
        <div class="card" onclick="window.open('${buildUrl}', '_blank')" style="cursor: pointer;">
            <div class="card-header">
                <div class="card-title">
                    <span class="branch-icon">${icon}</span>
                    ${escapeHtml(title)}
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="card-body">
                <div class="build-info">
                    <div class="build-row">
                        <span class="build-label">Build #</span>
                        <span class="build-value">${build.number}</span>
                    </div>
                    <div class="build-row">
                        <span class="build-label">Event</span>
                        <span class="build-value">${escapeHtml(build.event || 'push')}</span>
                    </div>
                    <div class="build-row">
                        <span class="build-label">Time</span>
                        <span class="build-value">${timeAgo}</span>
                    </div>
                    <div class="build-row">
                        <span class="build-label">Duration</span>
                        <span class="build-value">${duration}</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <div class="commit-info">
                    ${commitUrl ? `<a href="${commitUrl}" target="_blank" class="commit-sha" onclick="event.stopPropagation();">${commitSha}</a>` : `<span class="commit-sha">${commitSha}</span>`}
                    ${prUrl ? `<a href="${prUrl}" target="_blank" class="pr-link" onclick="event.stopPropagation();">PR</a>` : ''}
                    <span class="commit-message">${escapeHtml(commitMessage)}</span>
                </div>
            </div>
        </div>
    `;
}

// Get status CSS class
function getStatusClass(status) {
    const statusMap = {
        'success': 'status-success',
        'failure': 'status-failure',
        'error': 'status-error',
        'pending': 'status-pending',
        'running': 'status-running',
        'killed': 'status-killed',
        'skipped': 'status-skipped',
        'blocked': 'status-blocked',
        'declined': 'status-declined'
    };
    return statusMap[status] || 'status-pending';
}

// Get status display text
function getStatusText(status) {
    const statusMap = {
        'success': 'Success',
        'failure': 'Failure',
        'error': 'Error',
        'pending': 'Pending',
        'running': 'Running',
        'killed': 'Killed',
        'skipped': 'Skipped',
        'blocked': 'Blocked',
        'declined': 'Declined'
    };
    return statusMap[status] || status;
}

// Format time ago
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';

    const now = new Date();
    const date = new Date(timestamp * 1000);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return date.toLocaleDateString('en-US');
}

// Format duration
function formatDuration(started, finished) {
    if (!started || !finished) return 'N/A';

    const duration = finished - started;
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show loading spinner
function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

// Show placeholder message
function showPlaceholder(container, message) {
    container.innerHTML = `<div class="placeholder">${escapeHtml(message)}</div>`;
}

// Show error message
function showError(container, message) {
    container.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}

// Demo mode with mock data
function loadDemoData() {
    // Save original functions before overriding
    if (!originalFunctions.loadRepositories) {
        originalFunctions.loadRepositories = loadRepositories;
        originalFunctions.loadBranchBuilds = loadBranchBuilds;
        originalFunctions.loadCronBuilds = loadCronBuilds;
    }

    // Override load functions for demo
    window.loadBranchBuilds = loadDemoBranchBuilds;
    window.loadCronBuilds = loadDemoCronBuilds;
    window.loadRepositories = loadDemoRepositories;

    servers = [
        { id: 'demo-woodpecker', name: 'Demo Woodpecker', url: 'https://ci.example.com', token: 'demo', type: 'woodpecker' },
        { id: 'demo-drone', name: 'Demo Drone', url: 'https://drone.example.com', token: 'demo', type: 'drone' }
    ];

    // Populate server dropdown with icons
    serverDropdown.innerHTML = '';
    servers.forEach(server => {
        const item = document.createElement('div');
        item.className = 'server-dropdown-item';
        item.dataset.serverId = server.id;
        item.innerHTML = `
            <span class="server-icon"><img src="${CI_ICONS[server.type] || CI_ICONS.woodpecker}" alt="${server.type}"></span>
            <span class="server-name">${escapeHtml(server.name)}</span>
        `;
        item.addEventListener('click', () => selectServer(server.id));
        serverDropdown.appendChild(item);
    });

    // Set demo server
    currentServer = servers[0];
    updateServerSelectButton();
    updateServerDropdownSelection();

    repositories = [
        { id: 1, owner: 'woodpecker-ci', name: 'woodpecker', full_name: 'woodpecker-ci/woodpecker' },
        { id: 2, owner: 'example', name: 'frontend', full_name: 'example/frontend' },
        { id: 3, owner: 'example', name: 'backend', full_name: 'example/backend' }
    ];

    // Populate repo dropdown without triggering real API calls
    repoSelect.innerHTML = '<option value="">Select repository...</option>';
    repositories.forEach(repo => {
        const option = document.createElement('option');
        option.value = getRepoId(repo);
        option.textContent = getRepoFullName(repo);
        repoSelect.appendChild(option);
    });

    // Auto-select first repo and load demo builds
    if (repositories.length > 0) {
        const repoId = getRepoId(repositories[0]);
        repoSelect.value = repoId;
        currentRepo = repositories[0];
        loadDemoBranchBuilds();
        loadDemoCronBuilds();
    }
}

function loadDemoRepositories() {
    if (!currentServer) return;

    repositories = [
        { id: 1, owner: 'woodpecker-ci', name: 'woodpecker', full_name: 'woodpecker-ci/woodpecker' },
        { id: 2, owner: 'example', name: 'frontend', full_name: 'example/frontend' },
        { id: 3, owner: 'example', name: 'backend', full_name: 'example/backend' }
    ];

    // Populate repo dropdown
    repoSelect.innerHTML = '<option value="">Select repository...</option>';
    repositories.forEach(repo => {
        const option = document.createElement('option');
        option.value = getRepoId(repo);
        option.textContent = getRepoFullName(repo);
        repoSelect.appendChild(option);
    });

    // Auto-select first repo
    if (repositories.length > 0) {
        const repoId = getRepoId(repositories[0]);
        repoSelect.value = repoId;
        currentRepo = repositories[0];
        loadDemoBranchBuilds();
        loadDemoCronBuilds();
    }
}

function loadDemoBranchBuilds() {
    const demoBuilds = [
        {
            number: 142,
            branch: 'main',
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
            status: 'success',
            event: 'pull_request',
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
            status: 'pending',
            event: 'push',
            commit: 'e5f6g7h8i9j0k1l2m3n4',
            message: 'security: patch vulnerability',
            created: Math.floor(Date.now() / 1000) - 300,
            started: null,
            finished: null
        }
    ];

    renderBranchCards(demoBuilds);
}

function loadDemoCronBuilds() {
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

    renderCronCards(demoCronBuilds);
}

// Server management functions
async function addServer(name, url, token, type = null) {
    // Normalize URL (remove trailing slash)
    url = url.replace(/\/$/, '');

    // Detect CI type if not provided
    if (!type) {
        type = await detectCIType(url, token);
    }

    const server = {
        id: `server-${Date.now()}`,
        name: name,
        url: url,
        token: token,
        type: type
    };

    servers.push(server);
    saveServers();
    populateServerSelect();

    // Auto-select the new server
    serverSelect.value = server.id;
    currentServer = server;
    localStorage.setItem('ci_dashboard_selected_server', server.id);
    loadRepositories();

    return server;
}

function updateServerType(serverId, newType) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        server.type = newType;
        saveServers();
        // Update current server if it's the one being changed
        if (currentServer && currentServer.id === serverId) {
            currentServer.type = newType;
        }
        populateServerSelect();
        console.log(`Server ${server.name} type updated to: ${newType}`);
        return server;
    }
    return null;
}

function removeServer(serverId) {
    servers = servers.filter(s => s.id !== serverId);
    saveServers();

    if (currentServer && currentServer.id === serverId) {
        currentServer = null;
        currentRepo = null;
        repositories = [];
        localStorage.removeItem('ci_dashboard_selected_server');
        localStorage.removeItem('ci_dashboard_selected_repo');
    }

    if (servers.length > 0) {
        populateServerSelect();
    } else {
        serverDropdown.innerHTML = '';
        updateServerSelectButton();
        repoSelect.innerHTML = '<option value="">Select repository...</option>';
        showPlaceholder(branchesCards, 'Add a server to get started. Use addServer() in console.');
        showPlaceholder(cronCards, 'Add a server to get started.');
    }
}

function listServers() {
    return servers.map(s => ({ id: s.id, name: s.name, url: s.url, type: s.type }));
}

function clearAllServers() {
    servers = [];
    currentServer = null;
    currentRepo = null;
    repositories = [];
    localStorage.removeItem('ci_dashboard_servers');
    localStorage.removeItem('ci_dashboard_selected_server');
    localStorage.removeItem('ci_dashboard_selected_repo');
    serverDropdown.innerHTML = '';
    updateServerSelectButton();
    repoSelect.innerHTML = '<option value="">Select repository...</option>';
    showPlaceholder(branchesCards, 'Add a server to get started. Use addServer() in console.');
    showPlaceholder(cronCards, 'Add a server to get started.');
}

// Debug function to test CI detection
async function debugDetection(serverIdOrUrl, token = null) {
    let serverUrl = serverIdOrUrl;

    // If it looks like a server ID, get URL and token from saved servers
    if (serverIdOrUrl.startsWith('server-')) {
        const savedServers = JSON.parse(localStorage.getItem('ci_dashboard_servers') || '[]');
        const server = savedServers.find(s => s.id === serverIdOrUrl);
        if (server) {
            serverUrl = server.url;
            token = server.token;
            console.log('Found server:', server.name);
        } else {
            console.log('Server not found with ID:', serverIdOrUrl);
            return;
        }
    } else if (!token) {
        // Try to find token by URL
        const savedServers = JSON.parse(localStorage.getItem('ci_dashboard_servers') || '[]');
        const server = savedServers.find(s => s.url === serverIdOrUrl);
        if (server) {
            token = server.token;
            console.log('Found server by URL:', server.name);
        } else {
            console.log('No token provided and server not found by URL');
            return;
        }
    }

    console.log('=== CI Type Detection Debug ===');
    console.log('Server URL:', serverUrl);

    // Test /api/version
    console.log('\n--- Testing /api/version ---');
    try {
        const versionResponse = await fetch(`${serverUrl}/api/version`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Status:', versionResponse.status);
        if (versionResponse.ok) {
            const data = await versionResponse.json();
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }

    // Test /api/info
    console.log('\n--- Testing /api/info ---');
    try {
        const infoResponse = await fetch(`${serverUrl}/api/info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Status:', infoResponse.status);
        if (infoResponse.ok) {
            const data = await infoResponse.json();
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }

    // Test /api/user/repos
    console.log('\n--- Testing /api/user/repos (first repo) ---');
    try {
        const reposResponse = await fetch(`${serverUrl}/api/user/repos?per_page=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Status:', reposResponse.status);
        if (reposResponse.ok) {
            const repos = await reposResponse.json();
            if (repos.length > 0) {
                console.log('First repo keys:', Object.keys(repos[0]));
                console.log('First repo:', JSON.stringify(repos[0], null, 2));
            } else {
                console.log('No repos found');
            }
        }
    } catch (e) {
        console.log('Error:', e.message);
    }

    // Run actual detection
    console.log('\n--- Running detectCIType ---');
    const detectedType = await detectCIType(serverUrl, token);
    console.log('Detected type:', detectedType);

    console.log('=== End Debug ===');
    return detectedType;
}

// Export for console usage
window.addServer = addServer;
window.updateServerType = updateServerType;
window.removeServer = removeServer;
window.listServers = listServers;
window.clearAllServers = clearAllServers;
window.debugDetection = debugDetection;
