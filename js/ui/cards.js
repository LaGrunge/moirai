// Card rendering functions

import { state, CI_ICONS } from '../state.js';
import { escapeHtml, formatTimeAgo, formatDuration, getStatusClass, getStatusText, getRepoFullName } from '../utils.js';
import { showPlaceholder } from './common.js';

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

    const repoFullName = getRepoFullName(state.currentRepo);
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

// Render branch cards
export function renderBranchCards(builds, container) {
    if (builds.length === 0) {
        showPlaceholder(container, 'No builds to display');
        return;
    }

    container.innerHTML = builds.map(build => createBuildCard(build, 'branch')).join('');
}

// Render cron cards
export function renderCronCards(builds, container) {
    if (builds.length === 0) {
        showPlaceholder(container, 'No cron builds to display');
        return;
    }

    container.innerHTML = builds.map(build => createBuildCard(build, 'cron')).join('');
}
