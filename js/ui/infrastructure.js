// Infrastructure tab for CI engineers - technical details and system health

import { state } from '../state.js';
import { apiRequest } from '../api.js';
import { normalizeBuild } from '../builds.js';
import { getRepoFullName, formatSeconds, formatTimeAgo } from '../utils.js';
import { getDefaultStatsPeriod } from '../stats.js';

// Load infrastructure data
export async function loadInfrastructureData(periodDays = null) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }

    if (!state.currentServer || !state.currentRepo) {
        return null;
    }

    const repoFullName = getRepoFullName(state.currentRepo);
    let buildsEndpoint;

    if (state.currentServer.type === 'drone') {
        buildsEndpoint = `/repos/${repoFullName}/builds?per_page=100`;
    } else {
        buildsEndpoint = `/repos/${state.currentRepo.id}/pipelines?per_page=100`;
    }

    const allBuilds = await apiRequest(buildsEndpoint);
    const cutoffTime = Math.floor(Date.now() / 1000) - (periodDays * 24 * 60 * 60);

    const builds = allBuilds
        .map(normalizeBuild)
        .filter(build => build.created >= cutoffTime);

    return calculateInfraStats(builds, periodDays);
}

// Calculate infrastructure statistics
function calculateInfraStats(builds, periodDays) {
    // Current queue (running + pending)
    const queuedBuilds = builds.filter(b => b.status === 'running' || b.status === 'pending');
    const runningBuilds = builds.filter(b => b.status === 'running');
    const pendingBuilds = builds.filter(b => b.status === 'pending');

    // Build durations analysis
    const finishedBuilds = builds.filter(b => b.started && b.finished);
    const durations = finishedBuilds.map(b => ({
        ...b,
        duration: b.finished - b.started
    }));

    // Calculate percentiles for anomaly detection
    const sortedDurations = durations.map(d => d.duration).sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p90 = sortedDurations[Math.floor(sortedDurations.length * 0.9)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    // Long builds (> p90)
    const longBuilds = durations
        .filter(d => d.duration > p90 && p90 > 0)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

    // Failed builds analysis
    const failedBuilds = builds.filter(b => b.status === 'failure' || b.status === 'error');
    
    // Group failures by branch
    const failuresByBranch = {};
    failedBuilds.forEach(b => {
        const key = b.branch || 'unknown';
        if (!failuresByBranch[key]) {
            failuresByBranch[key] = { count: 0, lastFailure: null };
        }
        failuresByBranch[key].count++;
        if (!failuresByBranch[key].lastFailure || b.created > failuresByBranch[key].lastFailure.created) {
            failuresByBranch[key].lastFailure = b;
        }
    });

    // Problem branches (most failures)
    const problemBranches = Object.entries(failuresByBranch)
        .map(([branch, data]) => ({
            branch,
            failureCount: data.count,
            lastFailure: data.lastFailure
        }))
        .sort((a, b) => b.failureCount - a.failureCount)
        .slice(0, 5);

    // Recent failures (last 10)
    const recentFailures = failedBuilds
        .sort((a, b) => b.created - a.created)
        .slice(0, 10);

    // Killed builds (might indicate resource issues)
    const killedBuilds = builds.filter(b => b.status === 'killed');

    // Build frequency by hour (to detect peak times)
    const hourlyDistribution = new Array(24).fill(0);
    builds.forEach(b => {
        const hour = new Date(b.created * 1000).getHours();
        hourlyDistribution[hour]++;
    });

    return {
        periodDays,
        totalBuilds: builds.length,
        queuedBuilds,
        runningBuilds,
        pendingBuilds,
        failedBuilds,
        killedBuilds,
        longBuilds,
        problemBranches,
        recentFailures,
        durations: {
            p50,
            p90,
            p99,
            avg: sortedDurations.length > 0 
                ? Math.round(sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length)
                : 0
        },
        hourlyDistribution
    };
}

// Render infrastructure tab
export function renderInfrastructure(container, stats) {
    if (!stats) {
        container.innerHTML = `
            <div class="infra-placeholder">
                <p>Select a repository to view infrastructure details</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="infra-container">
            <div class="infra-header">
                <h2>🔧 Infrastructure</h2>
                <select class="infra-period-select" id="infra-period">
                    <option value="7" ${stats.periodDays === 7 ? 'selected' : ''}>Last 7 days</option>
                    <option value="14" ${stats.periodDays === 14 ? 'selected' : ''}>Last 14 days</option>
                    <option value="30" ${stats.periodDays === 30 ? 'selected' : ''}>Last 30 days</option>
                    <option value="90" ${stats.periodDays === 90 ? 'selected' : ''}>Last 90 days</option>
                </select>
            </div>

            <div class="infra-grid">
                <!-- Queue Status -->
                <div class="infra-card">
                    <h3>📋 Current Queue</h3>
                    <div class="queue-stats">
                        <div class="queue-item">
                            <span class="queue-value running">${stats.runningBuilds.length}</span>
                            <span class="queue-label">Running</span>
                        </div>
                        <div class="queue-item">
                            <span class="queue-value pending">${stats.pendingBuilds.length}</span>
                            <span class="queue-label">Pending</span>
                        </div>
                    </div>
                    ${renderQueueList(stats.queuedBuilds)}
                </div>

                <!-- Duration Stats -->
                <div class="infra-card">
                    <h3>⏱️ Build Duration</h3>
                    <div class="duration-stats">
                        <div class="duration-item">
                            <span class="duration-label">Average</span>
                            <span class="duration-value">${formatSeconds(stats.durations.avg)}</span>
                        </div>
                        <div class="duration-item">
                            <span class="duration-label">Median (P50)</span>
                            <span class="duration-value">${formatSeconds(stats.durations.p50)}</span>
                        </div>
                        <div class="duration-item">
                            <span class="duration-label">P90</span>
                            <span class="duration-value">${formatSeconds(stats.durations.p90)}</span>
                        </div>
                        <div class="duration-item">
                            <span class="duration-label">P99</span>
                            <span class="duration-value">${formatSeconds(stats.durations.p99)}</span>
                        </div>
                    </div>
                </div>

                <!-- Problem Branches -->
                <div class="infra-card">
                    <h3>⚠️ Problem Branches</h3>
                    ${renderProblemBranches(stats.problemBranches)}
                </div>

                <!-- Long Builds -->
                <div class="infra-card">
                    <h3>🐢 Long Builds (> P90)</h3>
                    ${renderLongBuilds(stats.longBuilds, stats.durations.p90)}
                </div>

                <!-- Recent Failures -->
                <div class="infra-card full-width">
                    <h3>❌ Recent Failures</h3>
                    ${renderRecentFailures(stats.recentFailures)}
                </div>

                <!-- Hourly Distribution -->
                <div class="infra-card full-width">
                    <h3>📊 Build Activity by Hour</h3>
                    ${renderHourlyChart(stats.hourlyDistribution)}
                </div>
            </div>
        </div>
    `;
}

// Render queue list
function renderQueueList(builds) {
    if (builds.length === 0) {
        return '<div class="empty-list">No builds in queue</div>';
    }

    return `
        <div class="queue-list">
            ${builds.slice(0, 5).map(b => `
                <div class="queue-build">
                    <span class="queue-build-status status-${b.status}">${b.status}</span>
                    <span class="queue-build-branch">${b.branch || 'N/A'}</span>
                    <span class="queue-build-number">#${b.number}</span>
                    <span class="queue-build-time">${formatTimeAgo(b.created)}</span>
                </div>
            `).join('')}
            ${builds.length > 5 ? `<div class="more-items">+${builds.length - 5} more</div>` : ''}
        </div>
    `;
}

// Render problem branches
function renderProblemBranches(branches) {
    if (branches.length === 0) {
        return '<div class="empty-list">No problem branches 🎉</div>';
    }

    return `
        <div class="problem-list">
            ${branches.map(b => `
                <div class="problem-item">
                    <span class="problem-branch">${b.branch}</span>
                    <span class="problem-count">${b.failureCount} failures</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Render long builds
function renderLongBuilds(builds, p90) {
    if (builds.length === 0) {
        return '<div class="empty-list">No anomalously long builds</div>';
    }

    return `
        <div class="long-builds-list">
            ${builds.map(b => `
                <div class="long-build-item">
                    <span class="long-build-number">#${b.number}</span>
                    <span class="long-build-branch">${b.branch || 'N/A'}</span>
                    <span class="long-build-duration">${formatSeconds(b.duration)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Render recent failures
function renderRecentFailures(failures) {
    if (failures.length === 0) {
        return '<div class="empty-list">No recent failures 🎉</div>';
    }

    return `
        <table class="failures-table">
            <thead>
                <tr>
                    <th>Build</th>
                    <th>Branch</th>
                    <th>Event</th>
                    <th>Time</th>
                    <th>Commit</th>
                </tr>
            </thead>
            <tbody>
                ${failures.map(f => `
                    <tr>
                        <td><span class="status-badge status-${f.status}">#${f.number}</span></td>
                        <td>${f.branch || 'N/A'}</td>
                        <td>${f.event || 'push'}</td>
                        <td>${formatTimeAgo(f.created)}</td>
                        <td><code>${f.commit ? f.commit.slice(0, 7) : 'N/A'}</code></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Render hourly distribution chart
function renderHourlyChart(distribution) {
    const maxValue = Math.max(...distribution, 1);
    const width = 500;
    const height = 100;
    const barWidth = width / 24 - 2;

    const bars = distribution.map((count, hour) => {
        const barHeight = (count / maxValue) * 80;
        const x = hour * (width / 24) + 1;
        const y = height - barHeight - 20;

        return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
                  fill="var(--primary-color)" rx="2">
                <title>${hour}:00 - ${count} builds</title>
            </rect>
        `;
    }).join('');

    // Hour labels (every 4 hours)
    const labels = [0, 4, 8, 12, 16, 20].map(hour => {
        const x = hour * (width / 24) + barWidth / 2;
        return `<text x="${x}" y="${height - 5}" class="chart-label">${hour}:00</text>`;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="hourly-chart">
            ${bars}
            ${labels}
        </svg>
    `;
}

// Initialize infrastructure period handler
export function initInfraPeriodHandler(container) {
    const periodSelect = container.querySelector('#infra-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = '<div class="infra-loading">Loading infrastructure data...</div>';
            try {
                const stats = await loadInfrastructureData(newPeriod);
                renderInfrastructure(container, stats);
                initInfraPeriodHandler(container);
            } catch (error) {
                container.innerHTML = `<div class="infra-error">Failed to load data: ${error.message}</div>`;
            }
        });
    }
}
