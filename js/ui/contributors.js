// Contributors tab - leaderboard of developers who triggered builds

import { state } from '../state.js';
import { fetchBuildsForPeriod } from '../api.js';
import { formatTimeAgo, escapeHtml, getUserProfileUrl } from '../utils.js';
import { getDefaultStatsPeriod } from '../stats.js';
import { createPeriodHandler } from './periodHandler.js';

// Load contributors data
export async function loadContributorsData(periodDays = null) {
    if (periodDays === null) {
        periodDays = getDefaultStatsPeriod();
    }

    if (!state.currentServer || !state.currentRepo) {
        return null;
    }

    // Don't use normalizeBuild here - we need raw author data
    const builds = await fetchBuildsForPeriod(periodDays);

    return calculateContributorStats(builds, periodDays);
}

// Normalize build to get author info based on CI type
function normalizeBuildWithAuthor(build) {
    const isWoodpecker = state.currentServer?.type === 'woodpecker';
    
    let authorLogin, authorAvatar, authorEmail;
    
    if (isWoodpecker) {
        // Woodpecker: author is the git username, author_avatar is the avatar URL
        authorLogin = build.author || null;
        authorAvatar = build.author_avatar || null;
        authorEmail = build.author_email || '';
        // Woodpecker doesn't have separate display name, use login
        return {
            ...build,
            author: authorLogin || 'Unknown',
            authorLogin,
            authorDisplayName: authorLogin || 'Unknown',
            authorAvatar,
            authorEmail
        };
    } else {
        // Drone: author_login is the username, author_avatar is the avatar
        // author_name may contain full name (fallback to login)
        authorLogin = build.author_login || build.sender || null;
        authorAvatar = build.author_avatar || null;
        authorEmail = build.author_email || '';
        // Return display name separately for Drone
        const displayName = build.author_name || authorLogin || 'Unknown';
        return {
            ...build,
            author: authorLogin || 'Unknown',
            authorLogin,
            authorDisplayName: displayName,
            authorAvatar,
            authorEmail
        };
    }
}

// Calculate contributor statistics
function calculateContributorStats(builds, periodDays) {
    const contributors = {};

    builds.forEach(build => {
        const authorInfo = normalizeBuildWithAuthor(build);
        const author = authorInfo.author || 'Unknown';
        
        if (!contributors[author]) {
            contributors[author] = {
                name: authorInfo.authorDisplayName,  // Display name (full name if available)
                login: authorInfo.authorLogin,       // Username for profile URL
                email: authorInfo.authorEmail,
                avatar: authorInfo.authorAvatar,
                totalBuilds: 0,
                successBuilds: 0,
                failedBuilds: 0,
                otherBuilds: 0,
                builds: [],                          // Store all builds for drill-down
                commits: new Set(),
                branches: new Set(),
                prs: 0,
                lastBuild: null,
                streak: 0,
                currentStreak: 0
            };
        }

        const c = contributors[author];
        
        // Update name if we find a better one (not empty, different from login)
        const displayName = authorInfo.authorDisplayName;
        if (displayName && displayName !== authorInfo.authorLogin && c.name === c.login) {
            c.name = displayName;
        }
        
        // Store build info for drill-down
        c.builds.push({
            number: build.number,
            status: build.status,
            branch: build.branch || build.target,
            message: build.message,
            created: build.created || build.created_at,
            commit: build.commit || build.after
        });
        
        c.totalBuilds++;
        
        if (build.status === 'success') {
            c.successBuilds++;
            c.currentStreak++;
            if (c.currentStreak > c.streak) {
                c.streak = c.currentStreak;
            }
        } else if (build.status === 'failure' || build.status === 'error') {
            c.failedBuilds++;
            c.currentStreak = 0;
        } else {
            // Other statuses: running, pending, killed, skipped, etc.
            c.otherBuilds++;
        }

        if (build.commit) {
            c.commits.add(build.commit);
        }
        if (build.branch) {
            c.branches.add(build.branch);
        }
        if (build.isPR) {
            c.prs++;
        }

        if (!c.lastBuild || build.created > c.lastBuild.created) {
            c.lastBuild = build;
        }
    });

    // Convert to array and calculate derived stats
    const contributorList = Object.values(contributors).map(c => ({
        ...c,
        commits: c.commits.size,
        branches: c.branches.size,
        successRate: c.totalBuilds > 0 ? Math.round((c.successBuilds / c.totalBuilds) * 100) : 0
    }));

    // Sort by total builds (descending)
    contributorList.sort((a, b) => b.totalBuilds - a.totalBuilds);

    // Assign ranks and medals
    contributorList.forEach((c, i) => {
        c.rank = i + 1;
        if (i === 0) c.medal = '🥇';
        else if (i === 1) c.medal = '🥈';
        else if (i === 2) c.medal = '🥉';
        else c.medal = null;
    });

    // Calculate activity by contributor for chart
    const topContributors = contributorList.slice(0, 10);
    const maxBuilds = topContributors.length > 0 ? topContributors[0].totalBuilds : 0;

    return {
        periodDays,
        totalContributors: contributorList.length,
        contributors: contributorList,
        topContributors,
        maxBuilds,
        totalBuilds: builds.length
    };
}

// Render contributors tab
export function renderContributors(container, stats) {
    if (!stats) {
        container.innerHTML = `
            <div class="tab-placeholder">
                <p>Select a repository to view contributors</p>
            </div>
        `;
        return;
    }

    if (stats.contributors.length === 0) {
        container.innerHTML = `
            <div class="tab-placeholder">
                <p>No build data available for this period</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="contrib-container">
            <div class="contrib-header">
                <h2>🏆 Contributors Leaderboard</h2>
                <select class="period-select" id="contrib-period">
                    <option value="7" ${stats.periodDays === 7 ? 'selected' : ''}>Last 7 days</option>
                    <option value="14" ${stats.periodDays === 14 ? 'selected' : ''}>Last 14 days</option>
                    <option value="30" ${stats.periodDays === 30 ? 'selected' : ''}>Last 30 days</option>
                    <option value="90" ${stats.periodDays === 90 ? 'selected' : ''}>Last 90 days</option>
                </select>
            </div>

            <div class="contrib-summary">
                <div class="contrib-stat">
                    <span class="contrib-stat-value">${stats.totalContributors}</span>
                    <span class="contrib-stat-label">Contributors</span>
                </div>
                <div class="contrib-stat">
                    <span class="contrib-stat-value">${stats.totalBuilds}</span>
                    <span class="contrib-stat-label">Total Builds</span>
                </div>
            </div>

            <!-- Podium for top 3 -->
            ${renderPodium(stats.topContributors)}

            <!-- Bar chart -->
            <div class="contrib-chart-card">
                <h3>📊 Build Activity by Contributor</h3>
                ${renderContributorChart(stats.topContributors, stats.maxBuilds)}
            </div>

            <!-- Full leaderboard -->
            <div class="contrib-leaderboard">
                <h3>📋 Full Leaderboard</h3>
                ${renderLeaderboardTable(stats.contributors)}
            </div>
        </div>
    `;
    
    // Initialize click handlers for chart bars
    initChartClickHandlers(container);
}

// Render podium for top 3
function renderPodium(topContributors) {
    if (topContributors.length < 1) {
        return '';
    }

    const first = topContributors[0];
    const second = topContributors[1];
    const third = topContributors[2];

    return `
        <div class="podium">
            <div class="podium-place second">
                ${second ? `
                    <div class="podium-avatar">${getAvatarHtml(second, true)}</div>
                    <div class="podium-name" title="${escapeHtml(second.name)}">${getNameHtml(second)}</div>
                    <div class="podium-builds">${second.totalBuilds} builds</div>
                    <div class="podium-medal">🥈</div>
                    <div class="podium-pedestal">2</div>
                ` : '<div class="podium-empty">-</div>'}
            </div>
            <div class="podium-place first">
                <div class="podium-avatar">${getAvatarHtml(first, true)}</div>
                <div class="podium-name" title="${escapeHtml(first.name)}">${getNameHtml(first)}</div>
                <div class="podium-builds">${first.totalBuilds} builds</div>
                <div class="podium-medal">🥇</div>
                <div class="podium-pedestal">1</div>
            </div>
            <div class="podium-place third">
                ${third ? `
                    <div class="podium-avatar">${getAvatarHtml(third, true)}</div>
                    <div class="podium-name" title="${escapeHtml(third.name)}">${getNameHtml(third)}</div>
                    <div class="podium-builds">${third.totalBuilds} builds</div>
                    <div class="podium-medal">🥉</div>
                    <div class="podium-pedestal">3</div>
                ` : '<div class="podium-empty">-</div>'}
            </div>
        </div>
    `;
}

// Get avatar HTML (optionally wrapped in link)
function getAvatarHtml(contributor, withLink = false) {
    let avatarContent;
    if (contributor.avatar) {
        avatarContent = `<img src="${contributor.avatar}" alt="${escapeHtml(contributor.name)}" class="avatar-img" />`;
    } else {
        // Generate initials avatar
        const initials = contributor.name
            .split(/[\s._-]+/)
            .map(part => part[0] || '')
            .slice(0, 2)
            .join('')
            .toUpperCase();
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        const colorIndex = contributor.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        avatarContent = `<div class="avatar-initials" style="background-color: ${colors[colorIndex]}">${initials}</div>`;
    }
    
    if (withLink) {
        // Use login (username) for profile URL, not display name
        const profileUrl = getUserProfileUrl(contributor.login || contributor.name, state.currentRepo, contributor.avatar);
        if (profileUrl) {
            return `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="contributor-link">${avatarContent}</a>`;
        }
    }
    return avatarContent;
}

// Get contributor name HTML (optionally wrapped in link)
function getNameHtml(contributor) {
    // Use login (username) for profile URL, display name for text
    const profileUrl = getUserProfileUrl(contributor.login || contributor.name, state.currentRepo, contributor.avatar);
    if (profileUrl) {
        return `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="contributor-link">${escapeHtml(contributor.name)}</a>`;
    }
    return escapeHtml(contributor.name);
}

// Store contributors data for click handlers
let chartContributorsData = [];

// Render contributor bar chart (HTML-based for interactivity)
function renderContributorChart(contributors, maxBuilds) {
    if (contributors.length === 0) {
        return '<div class="no-data">No data available</div>';
    }
    
    // Store data for click handlers
    chartContributorsData = contributors;

    const rows = contributors.map((c, i) => {
        const successPct = maxBuilds > 0 ? (c.successBuilds / maxBuilds) * 100 : 0;
        const failPct = maxBuilds > 0 ? (c.failedBuilds / maxBuilds) * 100 : 0;
        const otherPct = maxBuilds > 0 ? ((c.otherBuilds || 0) / maxBuilds) * 100 : 0;
        
        // Truncate name smartly
        const maxNameLen = 28;
        const displayName = c.name.length > maxNameLen ? c.name.slice(0, maxNameLen - 1) + '…' : c.name;

        return `
            <div class="chart-row" data-index="${i}">
                <div class="chart-row-label" title="${escapeHtml(c.name)}">
                    ${c.medal || ''} ${escapeHtml(displayName)}
                </div>
                <div class="chart-row-bars">
                    ${c.successBuilds > 0 ? `
                        <div class="chart-bar success" style="width: ${successPct}%"
                             data-status="success"
                             title="${c.successBuilds} successful - click to expand">
                        </div>
                    ` : ''}
                    ${c.failedBuilds > 0 ? `
                        <div class="chart-bar failure" style="width: ${failPct}%"
                             data-status="failure"
                             title="${c.failedBuilds} failed - click to expand">
                        </div>
                    ` : ''}
                    ${(c.otherBuilds || 0) > 0 ? `
                        <div class="chart-bar other" style="width: ${otherPct}%"
                             data-status="other"
                             title="${c.otherBuilds} other - click to expand">
                        </div>
                    ` : ''}
                </div>
                <div class="chart-row-value">${c.totalBuilds}</div>
            </div>
            <div class="chart-row-builds" style="display: none;"></div>
        `;
    }).join('');

    return `
        <div class="contrib-chart-html">
            ${rows}
        </div>
        <div class="chart-legend-inline">
            <span class="legend-item-inline"><span class="legend-dot success"></span> Success</span>
            <span class="legend-item-inline"><span class="legend-dot failure"></span> Failed</span>
            <span class="legend-item-inline"><span class="legend-dot other"></span> Other</span>
        </div>
    `;
}

// Get build URL for a specific build number
function getBuildUrlForNumber(buildNumber) {
    if (!state.currentServer || !state.currentRepo) return null;
    
    const repoFullName = state.currentRepo.full_name || state.currentRepo.slug || 
                         `${state.currentRepo.owner}/${state.currentRepo.name}`;
    
    if (state.currentServer.type === 'drone') {
        return `${state.currentServer.url}/${repoFullName}/${buildNumber}`;
    } else {
        return `${state.currentServer.url}/repos/${state.currentRepo.id}/pipeline/${buildNumber}`;
    }
}

// Initialize chart click handlers
function initChartClickHandlers(container) {
    container.querySelectorAll('.chart-bar').forEach(bar => {
        bar.style.cursor = 'pointer';
        bar.addEventListener('click', (e) => {
            const status = bar.dataset.status;
            const chartRow = bar.closest('.chart-row');
            const index = parseInt(chartRow.dataset.index, 10);
            const contributor = chartContributorsData[index];
            const builds = contributor?.builds || [];
            const buildsContainer = chartRow.nextElementSibling;
            
            // Filter builds by status
            let filteredBuilds;
            if (status === 'success') {
                filteredBuilds = builds.filter(b => b.status === 'success');
            } else if (status === 'failure') {
                filteredBuilds = builds.filter(b => b.status === 'failure' || b.status === 'error');
            } else {
                filteredBuilds = builds.filter(b => 
                    b.status !== 'success' && b.status !== 'failure' && b.status !== 'error'
                );
            }
            
            // Toggle builds list
            if (buildsContainer.style.display !== 'none' && buildsContainer.dataset.status === status) {
                buildsContainer.style.display = 'none';
                bar.classList.remove('expanded');
            } else {
                // Render builds list
                buildsContainer.innerHTML = renderBuildsList(filteredBuilds, status);
                buildsContainer.style.display = 'block';
                buildsContainer.dataset.status = status;
                
                // Update expanded state
                chartRow.querySelectorAll('.chart-bar').forEach(b => b.classList.remove('expanded'));
                bar.classList.add('expanded');
            }
        });
    });
}

// Render list of builds for drill-down
function renderBuildsList(builds, status) {
    if (builds.length === 0) {
        return '<div class="builds-list-empty">No builds</div>';
    }
    
    const statusLabel = status === 'success' ? 'Successful' : 
                        status === 'failure' ? 'Failed' : 'Other';
    
    const items = builds
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .slice(0, 20)  // Limit to 20 builds
        .map(build => {
            const url = getBuildUrlForNumber(build.number);
            const timeAgo = formatTimeAgo(build.created);
            const message = build.message ? 
                (build.message.length > 60 ? build.message.slice(0, 60) + '…' : build.message) : 
                'No message';
            
            return `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="builds-list-item status-${build.status}">
                    <span class="build-number">#${build.number}</span>
                    <span class="build-branch">${escapeHtml(build.branch || '')}</span>
                    <span class="build-message">${escapeHtml(message)}</span>
                    <span class="build-time">${timeAgo}</span>
                </a>
            `;
        }).join('');
    
    return `
        <div class="builds-list">
            <div class="builds-list-header">${statusLabel} builds (${builds.length})</div>
            ${items}
            ${builds.length > 20 ? `<div class="builds-list-more">... and ${builds.length - 20} more</div>` : ''}
        </div>
    `;
}

// Render leaderboard table
function renderLeaderboardTable(contributors) {
    if (contributors.length === 0) {
        return '<div class="no-data">No contributors found</div>';
    }

    return `
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Contributor</th>
                    <th>Builds</th>
                    <th>Success Rate</th>
                    <th>Commits</th>
                    <th>PRs</th>
                    <th>Best Streak</th>
                </tr>
            </thead>
            <tbody>
                ${contributors.map(c => `
                    <tr class="${c.rank <= 3 ? 'top-rank' : ''}">
                        <td class="rank-cell">
                            ${c.medal || c.rank}
                        </td>
                        <td class="contributor-cell">
                            <div class="contributor-info">
                                <div class="contributor-avatar-small">${getAvatarHtml(c, true)}</div>
                                <span class="contributor-name">${getNameHtml(c)}</span>
                            </div>
                        </td>
                        <td>
                            <span class="builds-count">${c.totalBuilds}</span>
                            <span class="builds-breakdown">(${c.successBuilds}✓ ${c.failedBuilds}✗)</span>
                        </td>
                        <td>
                            <span class="success-rate rate-${c.successRate >= 80 ? 'good' : c.successRate >= 50 ? 'warning' : 'bad'}">
                                ${c.successRate}%
                            </span>
                        </td>
                        <td>${c.commits}</td>
                        <td>${c.prs}</td>
                        <td>
                            ${c.streak > 0 ? `🔥 ${c.streak}` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Period handler using shared factory
export const initContribPeriodHandler = createPeriodHandler({
    selectId: 'contrib-period',
    loadingText: 'Loading contributors data...',
    loadData: loadContributorsData,
    render: renderContributors
});
