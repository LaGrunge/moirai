// Demo mode test data - centralized and consistent across all tabs

// Base timestamp for demo data (now)
const NOW = Math.floor(Date.now() / 1000);

// Demo builds - used for branches, cron, and stats
export const DEMO_BUILDS = [
    {
        number: 142,
        branch: 'main',
        displayName: 'main',
        status: 'success',
        event: 'push',
        commit: 'a1b2c3d4e5f6g7h8i9j0',
        message: 'feat: add new dashboard feature',
        author: 'alice',
        author_avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
        created: NOW - 3600,
        started: NOW - 3500,
        finished: NOW - 3200
    },
    {
        number: 141,
        branch: 'develop',
        displayName: 'develop',
        status: 'running',
        event: 'push',
        commit: 'b2c3d4e5f6g7h8i9j0k1',
        message: 'chore: update dependencies',
        author: 'bob',
        author_avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
        created: NOW - 600,
        started: NOW - 550,
        finished: null
    },
    {
        number: 140,
        branch: 'feature/auth',
        displayName: 'feature/auth',
        status: 'failure',
        event: 'push',
        commit: 'c3d4e5f6g7h8i9j0k1l2',
        message: 'fix: authentication flow',
        author: 'charlie',
        author_avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
        created: NOW - 7200,
        started: NOW - 7100,
        finished: NOW - 6900
    },
    {
        number: 139,
        branch: 'feature/api',
        displayName: 'PR #42',
        status: 'success',
        event: 'pull_request',
        isPR: true,
        prNumber: 42,
        commit: 'd4e5f6g7h8i9j0k1l2m3',
        message: 'feat: implement REST API endpoints',
        author: 'diana',
        author_avatar: 'https://avatars.githubusercontent.com/u/4?v=4',
        ref: 'refs/pull/42/head',
        created: NOW - 86400,
        started: NOW - 86300,
        finished: NOW - 85800
    },
    {
        number: 138,
        branch: 'hotfix/security',
        displayName: 'hotfix/security',
        status: 'pending',
        event: 'push',
        commit: 'e5f6g7h8i9j0k1l2m3n4',
        message: 'security: patch vulnerability',
        author: 'eve',
        author_avatar: 'https://avatars.githubusercontent.com/u/5?v=4',
        created: NOW - 300,
        started: null,
        finished: null
    }
];

// Demo cron builds
export const DEMO_CRON_BUILDS = [
    {
        number: 135,
        branch: 'main',
        cron: 'nightly-build',
        displayName: 'nightly-build',
        status: 'success',
        event: 'cron',
        commit: 'a1b2c3d4e5f6g7h8i9j0',
        message: 'Nightly build',
        author: 'cron',
        created: NOW - 28800,
        started: NOW - 28700,
        finished: NOW - 27000
    },
    {
        number: 130,
        branch: 'main',
        cron: 'weekly-security-scan',
        displayName: 'weekly-security-scan',
        status: 'success',
        event: 'cron',
        commit: 'f6g7h8i9j0k1l2m3n4o5',
        message: 'Weekly security scan',
        author: 'cron',
        created: NOW - 172800,
        started: NOW - 172700,
        finished: NOW - 171000
    },
    {
        number: 125,
        branch: 'develop',
        cron: 'integration-tests',
        displayName: 'integration-tests',
        status: 'failure',
        event: 'cron',
        commit: 'g7h8i9j0k1l2m3n4o5p6',
        message: 'Integration tests',
        author: 'cron',
        created: NOW - 43200,
        started: NOW - 43100,
        finished: NOW - 42000
    }
];

// Generate historical builds for stats (last 30 days)
function generateHistoricalBuilds(branch, count = 50) {
    const statuses = ['success', 'success', 'success', 'success', 'failure', 'success', 'success'];
    const builds = [];
    
    for (let i = 0; i < count; i++) {
        const daysAgo = Math.floor(i / 2);
        const status = statuses[i % statuses.length];
        const duration = 180 + Math.floor(Math.random() * 120); // 3-5 minutes
        
        builds.push({
            number: 100 + count - i,
            branch,
            status,
            event: 'push',
            commit: `commit${i}`,
            message: `Build #${100 + count - i}`,
            author: ['alice', 'bob', 'charlie'][i % 3],
            created: NOW - (daysAgo * 86400) - (i * 1800),
            started: NOW - (daysAgo * 86400) - (i * 1800) + 30,
            finished: NOW - (daysAgo * 86400) - (i * 1800) + 30 + duration
        });
    }
    
    return builds;
}

// Demo stats for branch cards
export function getDemoBranchStats(branch) {
    const builds = generateHistoricalBuilds(branch, 50);
    const successCount = builds.filter(b => b.status === 'success').length;
    const failureCount = builds.filter(b => b.status === 'failure').length;
    
    return {
        builds,
        totalBuilds: builds.length,
        successCount,
        failureCount,
        successRate: Math.round((successCount / builds.length) * 100),
        avgDuration: 240,
        minDuration: 180,
        maxDuration: 300,
        p50Duration: 230,
        p95Duration: 290
    };
}

// Demo overview data
export const DEMO_OVERVIEW = {
    totalBuilds: 342,
    successRate: 87.1,
    avgDuration: 245,
    statusCounts: {
        success: 298,
        failure: 35,
        error: 3,
        running: 2,
        pending: 4,
        killed: 0,
        skipped: 0
    },
    healthStatus: 'good',
    healthColor: '🟢',
    healthText: 'Healthy',
    buildsPerDay: 11.4,
    periodDays: 30,
    hasCronBuilds: true,
    isHeadBuilds: true,
    branchBreakdown: [
        { branch: 'main', total: 120, success: 115, failure: 5, successRate: 95.8 },
        { branch: 'develop', total: 89, success: 72, failure: 17, successRate: 80.9 },
        { branch: 'feature/auth', total: 45, success: 38, failure: 7, successRate: 84.4 },
        { branch: 'feature/api', total: 42, success: 40, failure: 2, successRate: 95.2 },
        { branch: 'hotfix/security', total: 23, success: 20, failure: 3, successRate: 87.0 }
    ]
};

// Generate trend data for overview
export function getDemoTrendData(periodDays = 30) {
    const trendData = [];
    for (let i = periodDays - 1; i >= 0; i--) {
        const date = new Date(NOW * 1000 - i * 86400000);
        const dateStr = date.toISOString().split('T')[0];
        const total = Math.floor(Math.random() * 10) + 8;
        const success = Math.floor(total * (0.75 + Math.random() * 0.2));
        trendData.push({
            date: dateStr,
            total,
            success,
            failure: total - success,
            successRate: Math.round((success / total) * 100)
        });
    }
    return trendData;
}

// Demo infrastructure data
export const DEMO_INFRASTRUCTURE = {
    totalBuilds: 342,
    totalCpuSeconds: 83520,
    cpuStats: {
        totalHours: 23.2,
        estimatedCost: 1.16,
        costPerHour: 0.05
    },
    awsCost: null,
    useAwsCost: false,
    awsData: null,
    runningBuilds: [
        { number: 141, branch: 'develop', status: 'running', created: NOW - 600, message: 'chore: update dependencies' }
    ],
    pendingBuilds: [
        { number: 138, branch: 'hotfix/security', status: 'pending', created: NOW - 300, message: 'security: patch vulnerability' }
    ],
    queuedBuilds: [
        { number: 141, branch: 'develop', status: 'running', created: NOW - 600, message: 'chore: update dependencies' },
        { number: 138, branch: 'hotfix/security', status: 'pending', created: NOW - 300, message: 'security: patch vulnerability' }
    ],
    durations: {
        avg: 245,
        p50: 198,
        p90: 450,
        p99: 890,
        min: 45,
        max: 1245
    },
    failureRate: 11.1,
    periodDays: 30,
    durationTrend: [],
    eventBreakdown: {
        push: 245,
        pull_request: 67,
        cron: 30
    },
    statusBreakdown: {
        success: 298,
        failure: 38,
        running: 2,
        pending: 4
    },
    slowestBuilds: [
        { number: 98, branch: 'main', duration: 1245, message: 'Full integration test suite' },
        { number: 112, branch: 'develop', duration: 987, message: 'Build with coverage report' },
        { number: 134, branch: 'feature/api', duration: 856, message: 'E2E tests' }
    ],
    branchCosts: [
        { branch: 'main', buildCount: 120, avgDuration: 280, cost: 0.47 },
        { branch: 'develop', buildCount: 89, avgDuration: 245, cost: 0.30 },
        { branch: 'feature/auth', buildCount: 45, avgDuration: 198, cost: 0.12 },
        { branch: 'feature/api', buildCount: 42, avgDuration: 312, cost: 0.18 },
        { branch: 'hotfix/security', buildCount: 23, avgDuration: 156, cost: 0.05 }
    ],
    problemBranches: [
        { branch: 'feature/auth', failureRate: 15.6, failedBuilds: 7, totalBuilds: 45 },
        { branch: 'develop', failureRate: 19.1, failedBuilds: 17, totalBuilds: 89 }
    ],
    mostExpensiveBuilds: [
        { number: 98, branch: 'main', duration: 1245, cost: 0.017, message: 'Full integration test suite', status: 'success' },
        { number: 112, branch: 'develop', duration: 987, cost: 0.014, message: 'Build with coverage report', status: 'success' },
        { number: 134, branch: 'feature/api', duration: 856, cost: 0.012, message: 'E2E tests', status: 'failure' },
        { number: 89, branch: 'main', duration: 756, cost: 0.011, message: 'Deploy to staging', status: 'success' },
        { number: 127, branch: 'develop', duration: 698, cost: 0.010, message: 'Run all tests', status: 'success' }
    ],
    recentFailures: [
        { number: 140, branch: 'feature/auth', message: 'fix: authentication flow', created: NOW - 7200, error: 'Test failed: auth.spec.js' },
        { number: 125, branch: 'develop', message: 'Integration tests', created: NOW - 43200, error: 'Timeout in database connection' },
        { number: 118, branch: 'feature/api', message: 'API endpoint tests', created: NOW - 86400, error: 'Assertion failed: expected 200 got 500' }
    ],
    hourlyDistribution: [
        2, 1, 1, 0, 1, 2, 3, 5, 12, 18, 22, 25, 
        20, 23, 21, 19, 17, 15, 10, 6, 4, 3, 2, 1
    ],
    awsCostsError: null
};

// Generate demo builds for a contributor
function generateContributorBuilds(author, successCount, failedCount) {
    const builds = [];
    for (let i = 0; i < successCount; i++) {
        builds.push({
            number: 100 + i,
            branch: ['main', 'develop', 'feature/auth'][i % 3],
            status: 'success',
            message: `Build by ${author} #${100 + i}`,
            created: NOW - (i * 3600),
            author
        });
    }
    for (let i = 0; i < failedCount; i++) {
        builds.push({
            number: 200 + i,
            branch: ['develop', 'feature/api'][i % 2],
            status: 'failure',
            message: `Failed build by ${author} #${200 + i}`,
            created: NOW - (i * 7200),
            author
        });
    }
    return builds;
}

// Demo contributors list
const DEMO_CONTRIBUTORS_LIST = [
    {
        name: 'Alice Developer',
        login: 'alice',
        avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
        totalBuilds: 89,
        successBuilds: 78,
        failedBuilds: 11,
        otherBuilds: 0,
        successRate: 87.6,
        lastBuild: NOW - 3600,
        medal: '🥇',
        rank: 1,
        commits: 45,
        prs: 12,
        streak: 8,
        builds: generateContributorBuilds('alice', 78, 11)
    },
    {
        name: 'Bob Engineer',
        login: 'bob',
        avatar: 'https://avatars.githubusercontent.com/u/2?v=4',
        totalBuilds: 67,
        successBuilds: 61,
        failedBuilds: 6,
        otherBuilds: 0,
        successRate: 91.0,
        lastBuild: NOW - 7200,
        medal: '🥈',
        rank: 2,
        commits: 38,
        prs: 9,
        streak: 12,
        builds: generateContributorBuilds('bob', 61, 6)
    },
    {
        name: 'Charlie Coder',
        login: 'charlie',
        avatar: 'https://avatars.githubusercontent.com/u/3?v=4',
        totalBuilds: 54,
        successBuilds: 45,
        failedBuilds: 9,
        otherBuilds: 0,
        successRate: 83.3,
        lastBuild: NOW - 14400,
        medal: '🥉',
        rank: 3,
        commits: 29,
        prs: 7,
        streak: 5,
        builds: generateContributorBuilds('charlie', 45, 9)
    },
    {
        name: 'Diana Dev',
        login: 'diana',
        avatar: 'https://avatars.githubusercontent.com/u/4?v=4',
        totalBuilds: 42,
        successBuilds: 38,
        failedBuilds: 4,
        otherBuilds: 0,
        successRate: 90.5,
        lastBuild: NOW - 28800,
        rank: 4,
        commits: 22,
        prs: 5,
        streak: 6,
        builds: generateContributorBuilds('diana', 38, 4)
    },
    {
        name: 'Eve Engineer',
        login: 'eve',
        avatar: 'https://avatars.githubusercontent.com/u/5?v=4',
        totalBuilds: 31,
        successBuilds: 25,
        failedBuilds: 6,
        otherBuilds: 0,
        successRate: 80.6,
        lastBuild: NOW - 43200,
        rank: 5,
        commits: 18,
        prs: 3,
        streak: 4,
        builds: generateContributorBuilds('eve', 25, 6)
    }
];

// Demo contributors data
export const DEMO_CONTRIBUTORS = {
    contributors: DEMO_CONTRIBUTORS_LIST,
    topContributors: DEMO_CONTRIBUTORS_LIST.slice(0, 10),
    maxBuilds: 89,
    totalBuilds: 342,
    totalContributors: 5,
    periodDays: 30
};

// Generate demo builds for overview (all builds and cron builds)
function generateOverviewBuilds() {
    const builds = [];
    const statuses = ['success', 'success', 'success', 'success', 'failure', 'success', 'success', 'success'];
    const branches = ['main', 'develop', 'feature/auth', 'feature/api', 'hotfix/security'];
    const events = ['push', 'push', 'push', 'pull_request', 'push'];
    
    for (let i = 0; i < 342; i++) {
        const daysAgo = Math.floor(i / 12);
        const status = statuses[i % statuses.length];
        const duration = 180 + Math.floor(Math.random() * 120);
        
        builds.push({
            number: 1000 - i,
            branch: branches[i % branches.length],
            status,
            event: events[i % events.length],
            message: `Build #${1000 - i}`,
            author: ['alice', 'bob', 'charlie', 'diana', 'eve'][i % 5],
            created: NOW - (daysAgo * 86400) - (i * 600),
            started: NOW - (daysAgo * 86400) - (i * 600) + 30,
            finished: status !== 'running' && status !== 'pending' ? NOW - (daysAgo * 86400) - (i * 600) + 30 + duration : null
        });
    }
    return builds;
}

// All builds for overview
export const DEMO_ALL_BUILDS = generateOverviewBuilds();

// Cron builds for overview (subset with event='cron')
export const DEMO_OVERVIEW_CRON_BUILDS = [
    ...DEMO_CRON_BUILDS,
    // Add more cron builds
    ...Array.from({ length: 27 }, (_, i) => ({
        number: 500 - i,
        branch: 'main',
        status: i % 5 === 0 ? 'failure' : 'success',
        event: 'cron',
        cron: ['nightly-build', 'weekly-security-scan', 'integration-tests'][i % 3],
        message: `Cron build #${500 - i}`,
        created: NOW - (i * 86400),
        started: NOW - (i * 86400) + 30,
        finished: NOW - (i * 86400) + 1800
    }))
];

// Demo config
export const DEMO_CONFIG = {
    id: 'demo-config',
    serverId: 'demo-woodpecker',
    serverName: 'Demo Woodpecker',
    serverType: 'woodpecker',
    serverUrl: 'https://ci.example.com',
    serverToken: 'demo',
    repoId: '1',
    repoFullName: 'woodpecker-ci/woodpecker',
    repoData: { id: 1, owner: 'woodpecker-ci', name: 'woodpecker', full_name: 'woodpecker-ci/woodpecker' },
    displayName: 'Demo Project'
};
