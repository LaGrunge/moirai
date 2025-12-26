// Card rendering functions

import { state, CI_ICONS } from '../state.js';
import { escapeHtml, formatTimeAgo, formatDuration, getStatusClass, getStatusText, getRepoFullName } from '../utils.js';
import { showPlaceholder } from './common.js';
import { getBranchBuilds, calculateStats, generateHistogramData, renderStatsPanel, getDefaultStatsPeriod } from '../stats.js';

// Get build URL based on CI type
export function getBuildUrl(build) {
    const repoFullName = getRepoFullName(state.currentRepo);

    if (state.currentServer.type === 'drone') {
        return `${state.currentServer.url}/${repoFullName}/${build.number}`;
    } else {
        return `${state.currentServer.url}/repos/${state.currentRepo.id}/pipeline/${build.number}`;
    }
}

// Create build card HTML
export function createBuildCard(build, type) {
    const statusClass = getStatusClass(build.status);
    const statusText = getStatusText(build.status);
    const timeAgo = formatTimeAgo(build.created);
    const duration = formatDuration(build.started, build.finished);
    const commitSha = build.commit ? build.commit.substring(0, 8) : 'N/A';
    const commitMessage = build.message || 'No commit message';

    let title, icon, statsKey, isPRStats;
    if (type === 'cron') {
        title = build.cron || 'Cron Job';
        icon = '⏰';
        statsKey = build.cron || 'default';
        isPRStats = false;
    } else if (build.isPR) {
        title = build.displayName || `PR #${build.prNumber}`;
        icon = '🔀';
        statsKey = build.prNumber; // PRs use PR number for stats
        isPRStats = true;
    } else {
        title = build.displayName || build.branch;
        icon = '🌿';
        statsKey = build.branch;
        isPRStats = false;
    }
    
    const repoFullName = getRepoFullName(state.currentRepo);
    const buildUrl = getBuildUrl(build);
    const commitUrl = build.commit ? `https://github.com/${repoFullName}/commit/${build.commit}` : null;
    const prUrl = (build.isPR && build.prNumber) ?
        `https://github.com/${repoFullName}/pull/${build.prNumber}` : null;

    const cardId = `card-${type}-${build.number}`;
    const isCron = type === 'cron';

    // Use base64 encoding for branch/PR name to preserve special characters
    const encodedBranch = btoa(encodeURIComponent(statsKey));

    return `
        <div class="card-wrapper" id="${cardId}" data-branch="${encodedBranch}" data-is-cron="${isCron}" data-is-pr="${isPRStats}">
            <div class="card" data-build-url="${buildUrl}">
                <div class="card-header">
                    <div class="card-title">
                        <span class="branch-icon">${icon}</span>
                        ${escapeHtml(title)}
                    </div>
                    <div class="card-actions">
                        <button class="stats-btn" title="View statistics">
                            📊
                        </button>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
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
            <div class="stats-container" style="display: none;"></div>
        </div>
    `;
}

// Toggle stats panel for a card
export async function toggleStats(cardId, branch, isCron, periodDays = null, forceRefresh = false, isPR = false) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }
    const wrapper = document.getElementById(cardId);
    if (!wrapper) return;

    const statsContainer = wrapper.querySelector('.stats-container');
    const statsBtn = wrapper.querySelector('.stats-btn');

    // If already open and not forcing refresh, close it
    if (statsContainer.style.display !== 'none' && !forceRefresh) {
        statsContainer.style.display = 'none';
        statsBtn.classList.remove('active');
        return;
    }

    // Show loading
    statsContainer.innerHTML = '<div class="stats-loading">Loading statistics...</div>';
    statsContainer.style.display = 'block';
    statsBtn.classList.add('active');

    try {
        const builds = await getBranchBuilds(branch, periodDays, isCron, isPR);
        const stats = calculateStats(builds);
        const histogramData = generateHistogramData(builds);

        statsContainer.innerHTML = renderStatsPanel(stats, histogramData, periodDays);

        // Add period change handler
        const periodSelect = statsContainer.querySelector('.stats-period-select');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                const newPeriod = parseInt(e.target.value);
                // Force refresh when changing period
                loadStatsForCard(cardId, branch, isCron, newPeriod, isPR);
            });
        }
    } catch (error) {
        statsContainer.innerHTML = `<div class="stats-error">Failed to load statistics: ${error.message}</div>`;
    }
}

// Load stats without toggle logic (for period change)
async function loadStatsForCard(cardId, branch, isCron, periodDays, isPR = false) {
    const wrapper = document.getElementById(cardId);
    if (!wrapper) return;

    const statsContainer = wrapper.querySelector('.stats-container');

    // Show loading
    statsContainer.innerHTML = '<div class="stats-loading">Loading statistics...</div>';

    try {
        const builds = await getBranchBuilds(branch, periodDays, isCron, isPR);
        const stats = calculateStats(builds);
        const histogramData = generateHistogramData(builds);

        statsContainer.innerHTML = renderStatsPanel(stats, histogramData, periodDays);

        // Add period change handler again
        const periodSelect = statsContainer.querySelector('.stats-period-select');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                const newPeriod = parseInt(e.target.value);
                loadStatsForCard(cardId, branch, isCron, newPeriod, isPR);
            });
        }
    } catch (error) {
        statsContainer.innerHTML = `<div class="stats-error">Failed to load statistics: ${error.message}</div>`;
    }
}

// Render branch cards
export function renderBranchCards(builds, container) {
    if (builds.length === 0) {
        showPlaceholder(container, 'No builds to display');
        return;
    }

    container.innerHTML = builds.map(build => createBuildCard(build, 'branch')).join('');
    attachCardClickHandlers(container);
}

// Attach click handlers to cards (for opening build URL and stats)
function attachCardClickHandlers(container) {
    container.querySelectorAll('.card-wrapper').forEach(wrapper => {
        const card = wrapper.querySelector('.card');
        const statsBtn = wrapper.querySelector('.stats-btn');

        // Card click -> open build URL
        if (card) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target.closest('button')) return;
                const url = card.dataset.buildUrl;
                if (url) window.open(url, '_blank');
            });
        }

        // Stats button click -> toggle stats panel
        if (statsBtn) {
            statsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Decode base64 encoded branch/PR name
                const encodedBranch = wrapper.dataset.branch;
                const branch = decodeURIComponent(atob(encodedBranch));
                const isCron = wrapper.dataset.isCron === 'true';
                const isPR = wrapper.dataset.isPr === 'true';
                toggleStats(wrapper.id, branch, isCron, null, false, isPR);
            });
        }
    });
}

// Render cron cards
export function renderCronCards(builds, container) {
    if (builds.length === 0) {
        showPlaceholder(container, 'No cron builds to display');
        return;
    }

    container.innerHTML = builds.map(build => createBuildCard(build, 'cron')).join('');
    attachCardClickHandlers(container);
}
