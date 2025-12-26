// API functions for CI servers

import { state } from './state.js';
import { getRepoFullName } from './utils.js';
import { handleError, ErrorTypes } from './errors.js';

// API request helper - uses proxy to keep tokens server-side
export async function apiRequest(endpoint) {
    if (!state.currentServer) {
        const error = new Error('No server selected');
        handleError(error, 'apiRequest');
        throw error;
    }

    // Use proxy endpoint instead of direct API call
    const url = `/proxy/${state.currentServer.id}${endpoint}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const error = new Error(`API Error: ${response.status} ${response.statusText}`);
            handleError(error, `apiRequest ${endpoint}`);
            throw error;
        }

        return response.json();
    } catch (error) {
        if (error.name === 'TypeError') {
            // Network error
            handleError(error, `apiRequest ${endpoint} (network)`);
        }
        throw error;
    }
}

// Detect CI type (Drone or Woodpecker) - uses proxy
export async function detectCIType(serverId) {
    console.log('Detecting CI type for server:', serverId);

    // Try Woodpecker version endpoint - this is the most reliable check
    try {
        const wpResponse = await fetch(`/proxy/${serverId}/version`);
        if (wpResponse.ok) {
            const text = await wpResponse.text();
            try {
                const data = JSON.parse(text);
                console.log('Version response:', data);
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
        const reposResponse = await fetch(`/proxy/${serverId}/user/repos?per_page=1`);
        if (reposResponse.ok) {
            const repos = await reposResponse.json();
            console.log('Repos sample:', repos[0]);
            if (repos.length > 0) {
                const repo = repos[0];
                if (repo.forge_remote_id !== undefined ||
                    repo.netrc_only_trusted !== undefined ||
                    repo.full_name) {
                    console.log('Detected: woodpecker (from repo structure)');
                    return 'woodpecker';
                }
                if (repo.slug && !repo.full_name) {
                    console.log('Detected: drone (from repo structure)');
                    return 'drone';
                }
            }
        }
    } catch (e) {
        console.log('Repos check failed:', e);
    }

    console.log('Detected: woodpecker (default)');
    return 'woodpecker';
}

// Get builds endpoint based on CI type
export function getBuildsEndpoint() {
    const repoFullName = getRepoFullName(state.currentRepo);

    if (state.currentServer.type === 'drone') {
        return `/repos/${repoFullName}/builds?per_page=100`;
    } else {
        return `/repos/${state.currentRepo.id}/pipelines?per_page=100`;
    }
}

// Check if a repository has any builds
export async function checkRepoHasBuilds(repo) {
    const repoFullName = repo.full_name || repo.slug || `${repo.owner}/${repo.name}`;
    let endpoint;

    if (state.currentServer.type === 'drone') {
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

// Filter repositories that have at least one build
export async function filterReposWithBuilds(repos) {
    const batchSize = 10;
    const reposWithBuilds = [];

    for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (repo) => {
            try {
                const hasBuilds = await checkRepoHasBuilds(repo);
                return hasBuilds ? repo : null;
            } catch (e) {
                return repo; // Include on error
            }
        }));
        reposWithBuilds.push(...results.filter(r => r !== null));
    }

    return reposWithBuilds;
}

// Get existing branches from repository
export async function getExistingBranches() {
    try {
        if (state.currentServer.type === 'woodpecker') {
            const branches = await apiRequest(`/repos/${state.currentRepo.id}/branches`);
            return new Set(branches.map(b => b.name || b));
        } else {
            return null;
        }
    } catch (error) {
        console.log('Could not fetch branches, skipping filter:', error);
        return null;
    }
}

// Get open pull requests from repository
export async function getOpenPullRequests() {
    try {
        if (state.currentServer.type === 'woodpecker') {
            const pullRequests = await apiRequest(`/repos/${state.currentRepo.id}/pull_requests`);
            return new Set(pullRequests.map(pr => pr.number?.toString() || pr.index?.toString()));
        } else {
            return null;
        }
    } catch (error) {
        console.log('Could not fetch pull requests, showing all PRs:', error);
        return null;
    }
}

// Auto-detect types for servers that need it
export async function autoDetectServerTypes() {
    for (const server of state.servers) {
        if (server.type === 'auto') {
            server.type = await detectCIType(server.id);
        }
    }
}

// Load servers from proxy endpoint (tokens stay server-side)
export async function loadServersFromProxy() {
    try {
        const response = await fetch('/api/servers');
        if (response.ok) {
            const servers = await response.json();
            state.servers = servers;
            return servers;
        } else {
            const error = new Error(`Failed to load servers: ${response.status}`);
            handleError(error, 'loadServersFromProxy');
        }
    } catch (error) {
        handleError(error, 'loadServersFromProxy');
    }
    return [];
}
