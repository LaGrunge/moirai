// Build statistics module

import { state } from './state.js';
import { fetchBuildsForPeriod } from './api.js';
import { normalizeBuild } from './builds.js';
import { formatSeconds } from './utils.js';

// Get default period from settings
export function getDefaultStatsPeriod() {
    return state.settings.statsPeriodDays || 30;
}

// Format status for display (success -> OK, etc.)
function formatStatus(status) {
    if (!status) return 'N/A';
    const statusMap = {
        'success': 'OK',
        'failure': 'FAIL',
        'error': 'ERR',
        'running': 'RUN',
        'pending': 'WAIT',
        'killed': 'KILL',
        'skipped': 'SKIP'
    };
    return statusMap[status] || status.toUpperCase();
}

// Get builds for a specific branch/cron/PR within a time period
export async function getBranchBuilds(branchOrPR, periodDays = null, isCron = false, isPR = false) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }
    
    const rawBuilds = await fetchBuildsForPeriod(periodDays);

    // Filter by branch/cron/PR
    const filtered = rawBuilds
        .map(normalizeBuild)
        .filter(build => {

            if (isCron) {
                return build.event === 'cron' && (build.cron === branchOrPR || (!build.cron && branchOrPR === 'default'));
            } else if (isPR) {
                // For PRs, match by PR number
                return build.isPR && String(build.prNumber) === String(branchOrPR);
            } else {
                // For branches, match by branch name and exclude cron events and PRs
                return build.branch === branchOrPR && build.event !== 'cron' && !build.isPR;
            }
        })
        .sort((a, b) => a.created - b.created); // Oldest first for histogram
    
    return filtered;
}

// Calculate statistics from builds array
export function calculateStats(builds) {
    if (builds.length === 0) {
        return {
            totalBuilds: 0,
            successRate: 0,
            medianDuration: null,
            avgDuration: null,
            lastBuild: null,
            lastStatus: null,
            statusCounts: { success: 0, failure: 0, running: 0, pending: 0, other: 0 }
        };
    }

    // Count statuses
    const statusCounts = { success: 0, failure: 0, running: 0, pending: 0, other: 0 };
    builds.forEach(build => {
        if (statusCounts.hasOwnProperty(build.status)) {
            statusCounts[build.status]++;
        } else {
            statusCounts.other++;
        }
    });

    // Calculate durations (only for finished builds)
    const durations = builds
        .filter(b => b.started && b.finished)
        .map(b => b.finished - b.started)
        .sort((a, b) => a - b);

    let medianDuration = null;
    let avgDuration = null;

    if (durations.length > 0) {
        const mid = Math.floor(durations.length / 2);
        medianDuration = durations.length % 2 === 0
            ? (durations[mid - 1] + durations[mid]) / 2
            : durations[mid];

        avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    // Last build info
    const lastBuild = builds[builds.length - 1];

    return {
        totalBuilds: builds.length,
        successRate: Math.round((statusCounts.success / builds.length) * 100),
        medianDuration,
        avgDuration,
        lastBuild: lastBuild?.created || null,
        lastStatus: lastBuild?.status || null,
        statusCounts
    };
}

// Generate histogram data for visualization
export function generateHistogramData(builds, maxBars = null, getBuildUrlFn = null) {
    // Take last N builds for histogram (or all if maxBars is null)
    const recentBuilds = maxBars ? builds.slice(-maxBars) : builds;

    return recentBuilds.map(build => ({
        number: build.number,
        duration: build.started && build.finished ? build.finished - build.started : 0,
        status: build.status,
        created: build.created,
        url: getBuildUrlFn ? getBuildUrlFn(build) : null
    }));
}

// Render stats panel HTML
export function renderStatsPanel(stats, histogramData, periodDays) {
    const successRateClass = stats.successRate >= 80 ? 'stat-good' :
                            stats.successRate >= 50 ? 'stat-warning' : 'stat-bad';

    const lastBuildTime = stats.lastBuild
        ? new Date(stats.lastBuild * 1000).toLocaleString()
        : 'N/A';

    const medianTime = stats.medianDuration != null
        ? formatSeconds(stats.medianDuration)
        : 'N/A';

    // Find max duration for scaling histogram
    const maxDuration = Math.max(...histogramData.map(d => d.duration), 1);

    const histogramBars = histogramData.map(bar => {
        const heightPercent = (bar.duration / maxDuration) * 100;
        const statusClass = `hist-${bar.status}`;
        const tooltip = `#${bar.number}: ${formatSeconds(bar.duration)}`;
        const clickAttr = bar.url ? `onclick="window.open('${bar.url}', '_blank')"` : '';
        const cursorStyle = bar.url ? 'cursor: pointer;' : '';

        return `<div class="hist-bar ${statusClass}" style="height: ${heightPercent}%; ${cursorStyle}" title="${tooltip}" ${clickAttr}></div>`;
    }).join('');

    return `
        <div class="stats-panel">
            <div class="stats-header">
                <span class="stats-title">Build Statistics</span>
                <select class="stats-period-select" data-period="${periodDays}">
                    <option value="7" ${Number(periodDays) === 7 ? 'selected' : ''}>7 days</option>
                    <option value="14" ${Number(periodDays) === 14 ? 'selected' : ''}>14 days</option>
                    <option value="30" ${Number(periodDays) === 30 ? 'selected' : ''}>30 days</option>
                    <option value="90" ${Number(periodDays) === 90 ? 'selected' : ''}>90 days</option>
                </select>
            </div>
            <div class="stats-metrics">
                <div class="stat-item">
                    <span class="stat-value">${stats.totalBuilds}</span>
                    <span class="stat-label">Total Builds</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value ${successRateClass}">${stats.successRate}%</span>
                    <span class="stat-label">Success Rate</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${medianTime}</span>
                    <span class="stat-label">Median Time</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value stat-status status-${stats.lastStatus || 'pending'}">${formatStatus(stats.lastStatus)}</span>
                    <span class="stat-label">Last Status</span>
                </div>
            </div>
            <div class="stats-histogram">
                <div class="histogram-container">
                    ${histogramBars || '<span class="no-data">No build data</span>'}
                </div>
                <div class="histogram-label">Last ${histogramData.length} builds (height = duration, color = status)</div>
            </div>
        </div>
    `;
}
