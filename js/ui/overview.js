// Overview tab for managers - high-level statistics without technical details

import { state } from '../state.js';
import { fetchBuildsForPeriod } from '../api.js';
import { normalizeBuild } from '../builds.js';
import { formatSeconds, formatTimeAgo, escapeHtml } from '../utils.js';
import { getDefaultStatsPeriod } from '../stats.js';
import { switchToTab, pushFilterState } from './tabs.js';

// Store overview data for toggle functionality
let overviewAllBuilds = [];
let overviewCronBuilds = [];
let overviewPeriodDays = 30;

// Set demo data for overview (used by demo mode)
export function setOverviewDemoData(allBuilds, cronBuilds, periodDays = 30) {
    overviewAllBuilds = allBuilds;
    overviewCronBuilds = cronBuilds;
    overviewPeriodDays = periodDays;
}

// Load overview data for current repository
export async function loadOverviewData(periodDays = null) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }

    if (!state.currentServer || !state.currentRepo) {
        return null;
    }

    const rawBuilds = await fetchBuildsForPeriod(periodDays);
    const builds = rawBuilds.map(normalizeBuild);
    
    // Store for toggle functionality
    overviewAllBuilds = builds;
    overviewCronBuilds = builds.filter(b => b.event === 'cron');
    overviewPeriodDays = periodDays;
    
    // Determine which builds to use based on toggle state and availability
    const hasCronBuilds = overviewCronBuilds.length > 0;
    
    // If no cron builds, force to all builds mode
    if (!hasCronBuilds) {
        state.overviewHeadBuilds = false;
    }
    
    const buildsToUse = state.overviewHeadBuilds ? overviewCronBuilds : builds;

    return {
        ...calculateOverviewStats(buildsToUse, periodDays),
        hasCronBuilds,
        isHeadBuilds: state.overviewHeadBuilds
    };
}

// Recalculate stats when toggle changes (without refetching)
export function recalculateOverviewStats() {
    const buildsToUse = state.overviewHeadBuilds ? overviewCronBuilds : overviewAllBuilds;
    return {
        ...calculateOverviewStats(buildsToUse, overviewPeriodDays),
        hasCronBuilds: overviewCronBuilds.length > 0,
        isHeadBuilds: state.overviewHeadBuilds
    };
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

    // Group builds by day for trend charts
    const dailyStats = {};
    
    // Group builds by branch for breakdown
    const branchStats = {};

    builds.forEach(build => {
        if (statusCounts.hasOwnProperty(build.status)) {
            statusCounts[build.status]++;
        }
        if (build.started && build.finished) {
            totalDuration += build.finished - build.started;
            finishedCount++;
        }

        // Group by day
        const date = new Date(build.created * 1000).toISOString().split('T')[0];
        if (!dailyStats[date]) {
            dailyStats[date] = { total: 0, success: 0, failure: 0, totalDuration: 0, finishedCount: 0 };
        }
        dailyStats[date].total++;
        if (build.status === 'success') dailyStats[date].success++;
        if (build.status === 'failure' || build.status === 'error') dailyStats[date].failure++;
        if (build.started && build.finished) {
            dailyStats[date].totalDuration += build.finished - build.started;
            dailyStats[date].finishedCount++;
        }
        
        // Group by branch
        const branch = build.branch || build.target || 'unknown';
        if (!branchStats[branch]) {
            branchStats[branch] = { 
                branch, 
                total: 0, 
                success: 0, 
                failure: 0,
                lastBuild: null,
                lastStatus: null,
                isCron: false,
                cronCount: 0
            };
        }
        branchStats[branch].total++;
        if (build.status === 'success') branchStats[branch].success++;
        if (build.status === 'failure' || build.status === 'error') branchStats[branch].failure++;
        
        // Track if this branch has cron builds
        if (build.event === 'cron') {
            branchStats[branch].cronCount++;
        }
        
        // Track last build
        if (!branchStats[branch].lastBuild || build.created > branchStats[branch].lastBuild.created) {
            branchStats[branch].lastBuild = build;
            branchStats[branch].lastStatus = build.status;
        }
    });
    
    // Mark branches as cron if they have ANY cron builds
    // (cron builds should navigate to Cron tab, not Branches tab)
    Object.values(branchStats).forEach(b => {
        b.isCron = b.cronCount > 0;
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

    // Generate daily trend data (sorted by date)
    const trendData = Object.entries(dailyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({
            date,
            total: stats.total,
            success: stats.success,
            failure: stats.failure,
            avgDuration: stats.finishedCount > 0 
                ? Math.round(stats.totalDuration / stats.finishedCount) 
                : null,
            successRate: stats.total > 0 
                ? Math.round((stats.success / stats.total) * 100) 
                : 0
        }));

    // Generate branch breakdown (sorted by last build time, failed first)
    const branchBreakdown = Object.values(branchStats)
        .map(b => ({
            ...b,
            successRate: b.total > 0 ? Math.round((b.success / b.total) * 100) : 0
        }))
        .sort((a, b) => {
            // Failed branches first, then by last build time
            if (a.lastStatus !== 'success' && b.lastStatus === 'success') return -1;
            if (a.lastStatus === 'success' && b.lastStatus !== 'success') return 1;
            return (b.lastBuild?.created || 0) - (a.lastBuild?.created || 0);
        });

    return {
        totalBuilds,
        successRate,
        avgDuration,
        statusCounts,
        healthStatus,
        healthColor,
        healthText,
        buildsPerDay,
        periodDays,
        trendData,
        branchBreakdown
    };
}

// Render overview tab content
export function renderOverview(container, stats) {
    if (!stats) {
        container.innerHTML = `
            <div class="tab-placeholder">
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

    const cronBuildsDisabled = !stats.hasCronBuilds;
    const cronBuildsTooltip = cronBuildsDisabled 
        ? 'No cron/scheduled builds available' 
        : 'Show only cron/scheduled builds (release branches)';
    const allBuildsTooltip = 'Show all builds from all branches';

    container.innerHTML = `
        <div class="overview-container">
            <div class="overview-header">
                <div class="health-indicator health-${stats.healthStatus}">
                    <span class="health-icon">${stats.healthColor}</span>
                    <span class="health-text">${stats.healthText}</span>
                </div>
                <div class="overview-toggles">
                    <div class="builds-toggle-group">
                        <button class="builds-toggle ${!stats.isHeadBuilds ? 'active' : ''}" 
                                id="toggle-all-builds" title="${allBuildsTooltip}">
                            All builds
                        </button>
                        <button class="builds-toggle ${stats.isHeadBuilds ? 'active' : ''} ${cronBuildsDisabled ? 'disabled' : ''}" 
                                id="toggle-cron-builds" 
                                title="${cronBuildsTooltip}"
                                ${cronBuildsDisabled ? 'disabled' : ''}>
                            Cron builds
                        </button>
                    </div>
                    <select class="period-select" id="overview-period">
                        <option value="7" ${stats.periodDays === 7 ? 'selected' : ''}>Last 7 days</option>
                        <option value="14" ${stats.periodDays === 14 ? 'selected' : ''}>Last 14 days</option>
                        <option value="30" ${stats.periodDays === 30 ? 'selected' : ''}>Last 30 days</option>
                        <option value="90" ${stats.periodDays === 90 ? 'selected' : ''}>Last 90 days</option>
                    </select>
                </div>
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

                ${stats.branchBreakdown.length > 0 ? `
                <div class="chart-card branch-breakdown-card">
                    <h3>🎯 ${stats.isHeadBuilds ? 'Cron' : 'All'} Builds by Branch</h3>
                    <div class="branch-breakdown-list">
                        ${renderBranchBreakdown(stats.branchBreakdown)}
                    </div>
                </div>
                ` : ''}

                <div class="chart-card">
                    <h3>Build Activity (per day)</h3>
                    ${renderBarChart(stats.trendData, 'total', 'Builds')}
                </div>
                <div class="chart-card">
                    <h3>Success Rate Trend</h3>
                    ${renderLineChart(stats.trendData, 'successRate', '%')}
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

// Render branch breakdown for builds
function renderBranchBreakdown(branches) {
    return branches.map(b => {
        // Status class based on success rate (not last build status)
        // Green: >= 80%, Yellow: >= 50%, Red: < 50%
        const statusClass = b.successRate >= 80 ? 'success' : 
                           b.successRate >= 50 ? 'warning' : 'failure';
        
        // SVG icons for consistent sizing
        const statusIcon = statusClass === 'success' 
            ? `<svg class="status-icon" viewBox="0 0 16 16" fill="var(--success-color)"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/></svg>`
            : statusClass === 'warning'
            ? `<svg class="status-icon" viewBox="0 0 16 16" fill="var(--pending-color)"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM8 4a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 4zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`
            : `<svg class="status-icon" viewBox="0 0 16 16" fill="var(--failure-color)"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm2.22-10.22a.75.75 0 0 0-1.06-1.06L8 5.94 6.84 4.78a.75.75 0 0 0-1.06 1.06L6.94 7 5.78 8.16a.75.75 0 1 0 1.06 1.06L8 8.06l1.16 1.16a.75.75 0 1 0 1.06-1.06L9.06 7l1.16-1.22z"/></svg>`;
        
        const lastBuildTime = b.lastBuild ? formatTimeAgo(b.lastBuild.created) : 'N/A';
        
        const targetTab = b.isCron ? 'Cron' : 'Branches';
        
        return `
            <div class="branch-breakdown-item status-${statusClass}" data-branch="${escapeHtml(b.branch)}" data-is-cron="${b.isCron}" title="Click to view in ${targetTab} tab">
                <div class="branch-status-icon">${statusIcon}</div>
                <div class="branch-info">
                    <div class="branch-name">${escapeHtml(b.branch)}</div>
                    <div class="branch-stats">
                        ${b.success}/${b.total} passed (${b.successRate}%) · Last: ${lastBuildTime}
                    </div>
                </div>
                <div class="branch-bar">
                    <div class="branch-bar-fill success" style="width: ${b.successRate}%"></div>
                    <div class="branch-bar-fill failure" style="width: ${100 - b.successRate}%"></div>
                </div>
            </div>
        `;
    }).join('');
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

// Render bar chart for daily data
function renderBarChart(trendData, field, label) {
    if (!trendData || trendData.length === 0) {
        return '<div class="no-data">No trend data available</div>';
    }

    const width = 400;
    const height = 150;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...trendData.map(d => d[field] || 0), 1);
    const barWidth = Math.max(4, (chartWidth / trendData.length) - 2);

    const bars = trendData.map((d, i) => {
        const value = d[field] || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + (i * (chartWidth / trendData.length)) + 1;
        const y = padding.top + chartHeight - barHeight;

        return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
                  fill="var(--primary-color)" rx="2" class="chart-bar">
                <title>${d.date}: ${value} ${label}</title>
            </rect>
        `;
    }).join('');

    // X-axis labels (show every few days)
    const step = Math.ceil(trendData.length / 7);
    const xLabels = trendData
        .filter((_, i) => i % step === 0)
        .map((d, i) => {
            const x = padding.left + (i * step * (chartWidth / trendData.length)) + barWidth / 2;
            return `<text x="${x}" y="${height - 8}" class="chart-label">${d.date.slice(5)}</text>`;
        }).join('');

    // Y-axis labels
    const yLabels = [0, Math.round(maxValue / 2), maxValue].map((v, i) => {
        const y = padding.top + chartHeight - (i * chartHeight / 2);
        return `<text x="${padding.left - 5}" y="${y + 4}" class="chart-label" text-anchor="end">${v}</text>`;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="bar-chart">
            ${bars}
            ${xLabels}
            ${yLabels}
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" 
                  x2="${width - padding.right}" y2="${padding.top + chartHeight}" 
                  stroke="var(--border-color)" />
        </svg>
    `;
}

// Render line chart for trend data
function renderLineChart(trendData, field, unit) {
    if (!trendData || trendData.length === 0) {
        return '<div class="no-data">No trend data available</div>';
    }

    const width = 400;
    const height = 150;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = trendData.map(d => d[field] || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values);

    // Generate line path
    const points = trendData.map((d, i) => {
        const value = d[field] || 0;
        const x = padding.left + (i / (trendData.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
        return `${x},${y}`;
    });

    const linePath = `M ${points.join(' L ')}`;

    // Area fill
    const areaPath = `M ${padding.left},${padding.top + chartHeight} L ${points.join(' L ')} L ${padding.left + chartWidth},${padding.top + chartHeight} Z`;

    // Data points
    const dots = trendData.map((d, i) => {
        const value = d[field] || 0;
        const x = padding.left + (i / (trendData.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
        return `<circle cx="${x}" cy="${y}" r="3" fill="var(--primary-color)" class="chart-dot">
            <title>${d.date}: ${value}${unit}</title>
        </circle>`;
    }).join('');

    // Y-axis labels
    const yLabels = [minValue, Math.round((maxValue + minValue) / 2), maxValue].map((v, i) => {
        const y = padding.top + chartHeight - (i * chartHeight / 2);
        return `<text x="${padding.left - 5}" y="${y + 4}" class="chart-label" text-anchor="end">${v}${unit}</text>`;
    }).join('');

    // X-axis labels
    const step = Math.ceil(trendData.length / 7);
    const xLabels = trendData
        .filter((_, i) => i % step === 0)
        .map((d, i) => {
            const x = padding.left + (i * step / (trendData.length - 1 || 1)) * chartWidth;
            return `<text x="${x}" y="${height - 5}" class="chart-label">${d.date.slice(5)}</text>`;
        }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="line-chart">
            <path d="${areaPath}" fill="var(--primary-color)" opacity="0.1" />
            <path d="${linePath}" fill="none" stroke="var(--primary-color)" stroke-width="2" />
            ${dots}
            ${xLabels}
            ${yLabels}
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" 
                  x2="${width - padding.right}" y2="${padding.top + chartHeight}" 
                  stroke="var(--border-color)" />
        </svg>
    `;
}

// Initialize overview handlers (period select + build type toggle)
export function initOverviewPeriodHandler(container) {
    // Period select handler
    const periodSelect = container.querySelector('#overview-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            // In demo mode, just recalculate with existing data
            if (state.demoMode) {
                const stats = recalculateOverviewStats();
                renderOverview(container, stats);
                initOverviewPeriodHandler(container);
                return;
            }
            
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = `<div class="tab-loading">Loading...</div>`;
            
            try {
                const data = await loadOverviewData(newPeriod);
                renderOverview(container, data);
                initOverviewPeriodHandler(container);
            } catch (error) {
                container.innerHTML = `<div class="tab-error">Failed to load data: ${error.message}</div>`;
            }
        });
    }
    
    // Build type toggle handlers
    const toggleAllBuilds = container.querySelector('#toggle-all-builds');
    const toggleCronBuilds = container.querySelector('#toggle-cron-builds');
    
    if (toggleAllBuilds) {
        toggleAllBuilds.addEventListener('click', () => {
            if (state.overviewHeadBuilds) {
                state.overviewHeadBuilds = false;
                const stats = recalculateOverviewStats();
                renderOverview(container, stats);
                initOverviewPeriodHandler(container);
            }
        });
    }
    
    if (toggleCronBuilds && !toggleCronBuilds.disabled) {
        toggleCronBuilds.addEventListener('click', () => {
            if (!state.overviewHeadBuilds) {
                state.overviewHeadBuilds = true;
                const stats = recalculateOverviewStats();
                renderOverview(container, stats);
                initOverviewPeriodHandler(container);
            }
        });
    }
    
    // Branch breakdown click handlers - navigate to appropriate tab with filter
    container.querySelectorAll('.branch-breakdown-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const branchName = item.dataset.branch;
            const isCron = item.dataset.isCron === 'true';
            if (branchName) {
                navigateToBranch(branchName, isCron);
            }
        });
    });
}

// Navigate to Branches or Cron tab and filter by branch name
function navigateToBranch(branchName, isCron) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Switch to appropriate tab
    const targetTab = isCron ? 'cron' : 'branches';
    switchToTab(targetTab, tabButtons, tabContents);
    
    // Set filter to branch name
    const filterId = isCron ? 'cron-filter' : 'branch-filter';
    const filterInput = document.getElementById(filterId);
    if (filterInput) {
        filterInput.value = branchName;
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Push to history for back button support
    pushFilterState(targetTab, branchName);
    
    // Scroll to and highlight the matching card
    setTimeout(() => {
        const cards = document.querySelectorAll(`#${targetTab}-cards .card`);
        for (const card of cards) {
            const cardBranch = card.querySelector('.card-branch, .cron-branch');
            if (cardBranch && cardBranch.textContent.includes(branchName)) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlight');
                setTimeout(() => card.classList.remove('highlight'), 2000);
                break;
            }
        }
    }, 100);
}
