// Overview tab for managers - high-level statistics without technical details

import { state } from '../state.js';
import { apiRequest } from '../api.js';
import { normalizeBuild } from '../builds.js';
import { getRepoFullName, formatSeconds } from '../utils.js';
import { getDefaultStatsPeriod } from '../stats.js';

// Load overview data for current repository
export async function loadOverviewData(periodDays = null) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }

    if (!state.currentServer || !state.currentRepo) {
        return null;
    }

    const repoFullName = getRepoFullName(state.currentRepo);
    let endpoint;

    if (state.currentServer.type === 'drone') {
        endpoint = `/repos/${repoFullName}/builds?per_page=100`;
    } else {
        endpoint = `/repos/${state.currentRepo.id}/pipelines?per_page=100`;
    }

    const allBuilds = await apiRequest(endpoint);
    const cutoffTime = Math.floor(Date.now() / 1000) - (periodDays * 24 * 60 * 60);

    // Filter by time period
    const builds = allBuilds
        .map(normalizeBuild)
        .filter(build => build.created >= cutoffTime);

    return calculateOverviewStats(builds, periodDays);
}

// Calculate overview statistics
function calculateOverviewStats(builds, periodDays) {
    const statusCounts = {
        success: 0,
        failure: 0,
        error: 0,
        running: 0,
        pending: 0,
        killed: 0,
        skipped: 0
    };

    let totalDuration = 0;
    let finishedCount = 0;

    builds.forEach(build => {
        if (statusCounts.hasOwnProperty(build.status)) {
            statusCounts[build.status]++;
        }
        if (build.started && build.finished) {
            totalDuration += build.finished - build.started;
            finishedCount++;
        }
    });

    const totalBuilds = builds.length;
    const successRate = totalBuilds > 0 
        ? Math.round((statusCounts.success / totalBuilds) * 100) 
        : 0;
    const avgDuration = finishedCount > 0 
        ? Math.round(totalDuration / finishedCount) 
        : null;

    // Calculate health status
    let healthStatus, healthColor, healthText;
    if (totalBuilds === 0) {
        healthStatus = 'unknown';
        healthColor = '⚪';
        healthText = 'No data';
    } else if (successRate >= 80 && statusCounts.running === 0) {
        healthStatus = 'good';
        healthColor = '🟢';
        healthText = 'Healthy';
    } else if (successRate >= 50 || statusCounts.running > 0) {
        healthStatus = 'warning';
        healthColor = '🟡';
        healthText = statusCounts.running > 0 ? 'Building' : 'Needs attention';
    } else {
        healthStatus = 'critical';
        healthColor = '🔴';
        healthText = 'Critical';
    }

    // Builds per day
    const buildsPerDay = totalBuilds > 0 
        ? (totalBuilds / periodDays).toFixed(1) 
        : 0;

    return {
        totalBuilds,
        successRate,
        avgDuration,
        statusCounts,
        healthStatus,
        healthColor,
        healthText,
        buildsPerDay,
        periodDays
    };
}

// Render overview tab content
export function renderOverview(container, stats) {
    if (!stats) {
        container.innerHTML = `
            <div class="overview-placeholder">
                <p>Select a repository to view overview</p>
            </div>
        `;
        return;
    }

    const avgTimeDisplay = stats.avgDuration 
        ? formatSeconds(stats.avgDuration) 
        : 'N/A';

    // Calculate pie chart segments
    const pieData = generatePieChartData(stats.statusCounts, stats.totalBuilds);

    container.innerHTML = `
        <div class="overview-container">
            <div class="overview-header">
                <div class="health-indicator health-${stats.healthStatus}">
                    <span class="health-icon">${stats.healthColor}</span>
                    <span class="health-text">${stats.healthText}</span>
                </div>
                <select class="overview-period-select" id="overview-period">
                    <option value="7" ${stats.periodDays === 7 ? 'selected' : ''}>Last 7 days</option>
                    <option value="14" ${stats.periodDays === 14 ? 'selected' : ''}>Last 14 days</option>
                    <option value="30" ${stats.periodDays === 30 ? 'selected' : ''}>Last 30 days</option>
                    <option value="90" ${stats.periodDays === 90 ? 'selected' : ''}>Last 90 days</option>
                </select>
            </div>

            <div class="overview-kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-value">${stats.totalBuilds}</div>
                    <div class="kpi-label">Total Builds</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value kpi-${stats.successRate >= 80 ? 'good' : stats.successRate >= 50 ? 'warning' : 'bad'}">${stats.successRate}%</div>
                    <div class="kpi-label">Success Rate</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value">${avgTimeDisplay}</div>
                    <div class="kpi-label">Avg Build Time</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value">${stats.buildsPerDay}</div>
                    <div class="kpi-label">Builds/Day</div>
                </div>
            </div>

            <div class="overview-charts">
                <div class="chart-card">
                    <h3>Build Status Distribution</h3>
                    <div class="pie-chart-container">
                        ${renderPieChart(pieData)}
                    </div>
                    <div class="pie-legend">
                        ${renderPieLegend(pieData)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate pie chart data from status counts
function generatePieChartData(statusCounts, total) {
    if (total === 0) return [];

    const colors = {
        success: 'var(--success-color)',
        failure: 'var(--failure-color)',
        error: 'var(--failure-color)',
        running: 'var(--running-color)',
        pending: 'var(--pending-color)',
        killed: '#6c757d',
        skipped: '#adb5bd'
    };

    const labels = {
        success: 'Success',
        failure: 'Failed',
        error: 'Error',
        running: 'Running',
        pending: 'Pending',
        killed: 'Killed',
        skipped: 'Skipped'
    };

    return Object.entries(statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
            status,
            count,
            percentage: Math.round((count / total) * 100),
            color: colors[status] || '#6c757d',
            label: labels[status] || status
        }))
        .sort((a, b) => b.count - a.count);
}

// Render SVG pie chart
function renderPieChart(data) {
    if (data.length === 0) {
        return '<div class="no-data">No build data</div>';
    }

    const size = 200;
    const center = size / 2;
    const radius = 80;

    let currentAngle = -90; // Start from top
    const segments = data.map(item => {
        const angle = (item.percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        // For single segment (100%), draw a circle
        if (data.length === 1) {
            return `<circle cx="${center}" cy="${center}" r="${radius}" fill="${item.color}" />`;
        }

        return `<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${item.color}" />`;
    });

    return `
        <svg viewBox="0 0 ${size} ${size}" class="pie-chart">
            ${segments.join('')}
            <circle cx="${center}" cy="${center}" r="40" fill="var(--card-bg)" />
        </svg>
    `;
}

// Render pie chart legend
function renderPieLegend(data) {
    if (data.length === 0) return '';

    return data.map(item => `
        <div class="legend-item">
            <span class="legend-color" style="background-color: ${item.color}"></span>
            <span class="legend-label">${item.label}</span>
            <span class="legend-value">${item.count} (${item.percentage}%)</span>
        </div>
    `).join('');
}

// Initialize overview tab
export function initOverview(container, periodSelect) {
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = '<div class="overview-loading">Loading...</div>';
            try {
                const stats = await loadOverviewData(newPeriod);
                renderOverview(container, stats);
                // Re-attach period change handler
                const newSelect = container.querySelector('#overview-period');
                if (newSelect) {
                    newSelect.addEventListener('change', async (ev) => {
                        const period = parseInt(ev.target.value);
                        container.innerHTML = '<div class="overview-loading">Loading...</div>';
                        const newStats = await loadOverviewData(period);
                        renderOverview(container, newStats);
                        initOverviewPeriodHandler(container);
                    });
                }
            } catch (error) {
                container.innerHTML = `<div class="overview-error">Failed to load data: ${error.message}</div>`;
            }
        });
    }
}

// Helper to re-attach period handler after re-render
export function initOverviewPeriodHandler(container) {
    const periodSelect = container.querySelector('#overview-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = '<div class="overview-loading">Loading...</div>';
            try {
                const stats = await loadOverviewData(newPeriod);
                renderOverview(container, stats);
                initOverviewPeriodHandler(container);
            } catch (error) {
                container.innerHTML = `<div class="overview-error">Failed to load data: ${error.message}</div>`;
            }
        });
    }
}
