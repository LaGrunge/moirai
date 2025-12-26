// Build data processing functions

import { state } from './state.js';
import { extractPRNumber } from './utils.js';

// Normalize build data from different CI systems
export function normalizeBuild(build) {
    const event = build.event || build.trigger;
    const isPR = event === 'pull_request' || event === 'pull-request';

    return {
        number: build.number,
        branch: build.branch || build.target,
        status: build.status,
        event: event,
        isPR: isPR,
        prNumber: build.pull_request_number || build.pr || (isPR ? extractPRNumber(build.ref) : null),
        prTitle: build.title || null,
        commit: build.commit || build.after,
        message: build.message,
        created: build.created || build.created_at,
        started: build.started || build.started_at,
        finished: build.finished || build.finished_at,
        ref: build.ref,
        refspec: build.refspec,
        cron: build.cron || build.cron_name
    };
}

// Group pipelines by branch (includes PRs)
export function groupByBranch(pipelines, existingBranches = null, openPRs = null) {
    const branches = {};
    const prs = {};

    pipelines.forEach(pipeline => {
        const branch = pipeline.branch;
        if (!branch) return;

        // Skip cron events for branch view
        if (pipeline.event === 'cron') return;

        // Handle PRs separately - group by PR number
        if (pipeline.isPR && pipeline.prNumber) {
            // Skip closed/merged PRs if we have the list of open PRs
            if (openPRs && !openPRs.has(pipeline.prNumber.toString())) {
                return;
            }

            const prKey = `PR #${pipeline.prNumber}`;
            if (!prs[prKey] || pipeline.number > prs[prKey].number) {
                const displayName = pipeline.prTitle ? `#${pipeline.prNumber}: ${pipeline.prTitle}` : prKey;
                prs[prKey] = { ...pipeline, displayName: displayName };
            }
            return;
        }

        // Skip deleted branches if we have the list (but not for PRs)
        if (existingBranches && !existingBranches.has(branch)) {
            return;
        }

        if (!branches[branch] || pipeline.number > branches[branch].number) {
            branches[branch] = { ...pipeline, displayName: branch };
        }
    });

    // Combine branches and PRs
    const allBuilds = [...Object.values(branches), ...Object.values(prs)];

    return sortBranchBuilds(allBuilds);
}

// Sort branch builds based on current sort mode
export function sortBranchBuilds(builds) {
    return builds.sort((a, b) => {
        switch (state.branchSortMode) {
            case 'time':
                return (b.created || 0) - (a.created || 0);
            case 'name':
                return (a.displayName || a.branch).localeCompare(b.displayName || b.branch);
            case 'status':
            default:
                const statusOrder = { failure: 0, error: 1, running: 2, pending: 3, success: 4, killed: 5, skipped: 6 };
                const aOrder = statusOrder[a.status] ?? 7;
                const bOrder = statusOrder[b.status] ?? 7;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return (b.created || 0) - (a.created || 0);
        }
    });
}

// Filter builds by name
export function filterBranchBuilds(builds, filter) {
    if (!filter) return builds;
    const lowerFilter = filter.toLowerCase();
    return builds.filter(b => {
        const name = (b.displayName || b.branch || '').toLowerCase();
        return name.includes(lowerFilter);
    });
}

// Group pipelines by cron job
export function groupByCron(pipelines) {
    const crons = {};

    pipelines.forEach(pipeline => {
        const cronName = pipeline.cron || 'default';

        if (!crons[cronName] || pipeline.number > crons[cronName].number) {
            crons[cronName] = pipeline;
        }
    });

    return Object.values(crons).sort((a, b) => {
        return new Date(b.created) - new Date(a.created);
    });
}
