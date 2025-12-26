// Utility functions

// Generate display name from repo path (e.g., "my-cool_repo" -> "My Cool Repo")
export function generateDisplayName(repoFullName) {
    // Get last part after /
    const repoName = repoFullName.split('/').pop() || repoFullName;
    // Replace - and _ with spaces, then convert to Title Case
    return repoName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format time ago
export function formatTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';

    const now = new Date();
    const date = new Date(timestamp * 1000);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return date.toLocaleDateString('en-US');
}

// Format duration from timestamps
export function formatDuration(started, finished) {
    if (!started || !finished) return 'N/A';
    return formatSeconds(finished - started);
}

// Format duration in seconds to human readable string
export function formatSeconds(seconds) {
    if (seconds == null || seconds < 0) return 'N/A';

    seconds = Math.round(seconds);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Get repository ID (works for both Drone and Woodpecker)
export function getRepoId(repo) {
    return repo.id ? repo.id.toString() : `${repo.owner}/${repo.name}`;
}

// Get repository full name
export function getRepoFullName(repo) {
    return repo.full_name || repo.slug || `${repo.owner}/${repo.name}`;
}

// Extract PR number from ref like "refs/pull/123/head"
export function extractPRNumber(ref) {
    if (!ref) return null;
    const match = ref.match(/refs\/pull\/(\d+)/);
    return match ? match[1] : null;
}

// Get status CSS class
export function getStatusClass(status) {
    const statusMap = {
        'success': 'status-success',
        'failure': 'status-failure',
        'error': 'status-error',
        'pending': 'status-pending',
        'running': 'status-running',
        'killed': 'status-killed',
        'skipped': 'status-skipped',
        'blocked': 'status-blocked',
        'declined': 'status-declined'
    };
    return statusMap[status] || 'status-pending';
}

// Get status display text
export function getStatusText(status) {
    const statusMap = {
        'success': 'Success',
        'failure': 'Failure',
        'error': 'Error',
        'pending': 'Pending',
        'running': 'Running',
        'killed': 'Killed',
        'skipped': 'Skipped',
        'blocked': 'Blocked',
        'declined': 'Declined'
    };
    return statusMap[status] || status;
}
