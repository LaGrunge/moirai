// Unified data loading utilities
// Reduces duplication across overview, infrastructure, contributors modules

import { state } from './state.js';
import { apiRequest } from './api.js';
import { getRepoFullName } from './utils.js';
import { getDefaultStatsPeriod } from './stats.js';

// Get builds endpoint based on CI server type
export function getBuildsEndpoint(perPage = 100) {
    if (!state.currentServer || !state.currentRepo) {
        return null;
    }

    const repoFullName = getRepoFullName(state.currentRepo);
    
    if (state.currentServer.type === 'drone') {
        return `/repos/${repoFullName}/builds?per_page=${perPage}`;
    } else {
        return `/repos/${state.currentRepo.id}/pipelines?per_page=${perPage}`;
    }
}

// Load builds with time filter
export async function loadBuildsForPeriod(periodDays = null, perPage = 100) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }

    const endpoint = getBuildsEndpoint(perPage);
    if (!endpoint) {
        return { builds: [], periodDays, cutoffTime: 0 };
    }

    const allBuilds = await apiRequest(endpoint);
    const cutoffTime = Math.floor(Date.now() / 1000) - (periodDays * 24 * 60 * 60);

    const builds = allBuilds.filter(build => {
        const created = build.created || build.created_at;
        return created >= cutoffTime;
    });

    return { builds, periodDays, cutoffTime };
}

// Check if repository is selected
export function isRepoSelected() {
    return state.currentServer && state.currentRepo;
}

// Generic tab loader factory
export function createTabLoader(options) {
    const {
        loadData,
        render,
        initPeriodHandler,
        container,
        loadingClass = 'loading',
        loadingText = 'Loading...',
        errorClass = 'error',
        placeholderText = 'Select a repository'
    } = options;

    return async function load() {
        if (!isRepoSelected()) {
            container.innerHTML = `<div class="${loadingClass.replace('loading', 'placeholder')}">${placeholderText}</div>`;
            return;
        }

        container.innerHTML = `<div class="${loadingClass}">${loadingText}</div>`;

        try {
            const data = await loadData();
            render(container, data);
            if (initPeriodHandler) {
                initPeriodHandler(container);
            }
        } catch (error) {
            container.innerHTML = `<div class="${errorClass}">Failed to load: ${error.message}</div>`;
        }
    };
}
