// Common UI functions

import { escapeHtml } from '../utils.js';

// Show loading spinner
export function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

// Show placeholder message
export function showPlaceholder(container, message) {
    container.innerHTML = `<div class="placeholder">${escapeHtml(message)}</div>`;
}

// Show error message
export function showError(container, message) {
    container.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}
