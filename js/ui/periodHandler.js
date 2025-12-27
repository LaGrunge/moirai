// Shared period handler for tabs with period selection
// Eliminates duplication across overview, infrastructure, and contributors tabs

import { state } from '../state.js';

/**
 * Creates a period change handler for a tab
 * @param {Object} config - Configuration object
 * @param {string} config.selectId - ID of the period select element
 * @param {string} config.loadingText - Text to show while loading
 * @param {Function} config.loadData - Async function to load data for given period
 * @param {Function} config.render - Function to render data to container
 * @returns {Function} - Handler initializer function
 */
export function createPeriodHandler(config) {
    const { selectId, loadingText, loadData, render } = config;

    return function initPeriodHandler(container) {
        const periodSelect = container.querySelector(`#${selectId}`);
        if (!periodSelect) return;

        periodSelect.addEventListener('change', async (e) => {
            // In demo mode, don't reload data - just keep current view
            if (state.demoMode) {
                return;
            }
            
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = `<div class="tab-loading">${loadingText}</div>`;
            
            try {
                const data = await loadData(newPeriod);
                render(container, data);
                // Re-attach handler after re-render
                initPeriodHandler(container);
            } catch (error) {
                container.innerHTML = `<div class="tab-error">Failed to load data: ${error.message}</div>`;
            }
        });
    };
}
