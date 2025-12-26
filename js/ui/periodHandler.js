// Shared period handler for tabs with period selection
// Eliminates duplication across overview, infrastructure, and contributors tabs

/**
 * Creates a period change handler for a tab
 * @param {Object} config - Configuration object
 * @param {string} config.selectId - ID of the period select element
 * @param {string} config.loadingClass - CSS class for loading state
 * @param {string} config.loadingText - Text to show while loading
 * @param {Function} config.loadData - Async function to load data for given period
 * @param {Function} config.render - Function to render data to container
 * @returns {Function} - Handler initializer function
 */
export function createPeriodHandler(config) {
    const { selectId, loadingClass, loadingText, loadData, render } = config;

    return function initPeriodHandler(container) {
        const periodSelect = container.querySelector(`#${selectId}`);
        if (!periodSelect) return;

        periodSelect.addEventListener('change', async (e) => {
            const newPeriod = parseInt(e.target.value);
            container.innerHTML = `<div class="${loadingClass}">${loadingText}</div>`;
            
            try {
                const data = await loadData(newPeriod);
                render(container, data);
                // Re-attach handler after re-render
                initPeriodHandler(container);
            } catch (error) {
                const errorClass = loadingClass.replace('loading', 'error');
                container.innerHTML = `<div class="${errorClass}">Failed to load data: ${error.message}</div>`;
            }
        });
    };
}
