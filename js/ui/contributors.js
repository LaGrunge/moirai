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
                    <div class="podium-name">${getNameHtml(second)}</div>
                    <div class="podium-builds">${second.totalBuilds} builds</div>
                    <div class="podium-medal">🥈</div>
                    <div class="podium-pedestal">2</div>
                ` : '<div class="podium-empty">-</div>'}
            </div>
            <div class="podium-place first">
                <div class="podium-avatar">${getAvatarHtml(first, true)}</div>
                <div class="podium-name">${getNameHtml(first)}</div>
                <div class="podium-builds">${first.totalBuilds} builds</div>
                <div class="podium-medal">🥇</div>
                <div class="podium-pedestal">1</div>
            </div>
            <div class="podium-place third">
                ${third ? `
                    <div class="podium-avatar">${getAvatarHtml(third, true)}</div>
                    <div class="podium-name">${getNameHtml(third)}</div>
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

// Render contributor bar chart
function renderContributorChart(contributors, maxBuilds) {
    if (contributors.length === 0) {
        return '<div class="no-data">No data available</div>';
    }

    const barHeight = 30;
    const gap = 8;
    const labelWidth = 120;
    const chartWidth = 400;
    const height = contributors.length * (barHeight + gap);

    const bars = contributors.map((c, i) => {
        const barWidth = maxBuilds > 0 ? (c.totalBuilds / maxBuilds) * chartWidth : 0;
        const y = i * (barHeight + gap);
        const successWidth = maxBuilds > 0 ? (c.successBuilds / maxBuilds) * chartWidth : 0;
        const failWidth = maxBuilds > 0 ? (c.failedBuilds / maxBuilds) * chartWidth : 0;
        const otherWidth = maxBuilds > 0 ? ((c.otherBuilds || 0) / maxBuilds) * chartWidth : 0;

        return `
            <g transform="translate(0, ${y})">
                <text x="${labelWidth - 10}" y="${barHeight / 2 + 5}" class="chart-label" text-anchor="end">
                    ${c.medal || ''} ${escapeHtml(c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name)}
                </text>
                <rect x="${labelWidth}" y="0" width="${successWidth}" height="${barHeight}" 
                      fill="var(--success-color)" rx="4">
                    <title>${c.name}: ${c.successBuilds} successful</title>
                </rect>
                <rect x="${labelWidth + successWidth}" y="0" width="${failWidth}" height="${barHeight}" 
                      fill="var(--failure-color)" rx="4">
                    <title>${c.name}: ${c.failedBuilds} failed</title>
                </rect>
                <rect x="${labelWidth + successWidth + failWidth}" y="0" width="${otherWidth}" height="${barHeight}" 
                      fill="var(--text-secondary)" rx="4">
                    <title>${c.name}: ${c.otherBuilds || 0} other (running/pending/killed)</title>
                </rect>
                <text x="${labelWidth + barWidth + 10}" y="${barHeight / 2 + 5}" class="chart-value">
                    ${c.totalBuilds}
                </text>
            </g>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${labelWidth + chartWidth + 50} ${height}" class="contrib-chart">
            ${bars}
        </svg>
        <div class="chart-legend-inline">
            <span class="legend-item-inline"><span class="legend-dot success"></span> Success</span>
            <span class="legend-item-inline"><span class="legend-dot failure"></span> Failed</span>
            <span class="legend-item-inline"><span class="legend-dot other"></span> Other</span>
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
