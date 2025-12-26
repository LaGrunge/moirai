// Tab switching functionality with browser history support

// Flag to prevent pushing state when handling popstate
let isRestoringState = false;

// Initialize tabs with history support
export function initTabs(tabButtons, tabContents) {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchToTabWithHistory(tabId, tabButtons, tabContents);
        });
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.tab) {
            isRestoringState = true;
            switchToTabInternal(event.state.tab, tabButtons, tabContents);
            
            // Restore filter if present
            if (event.state.filter) {
                const filterId = event.state.tab === 'cron' ? 'cron-filter' : 'branch-filter';
                const filterInput = document.getElementById(filterId);
                if (filterInput) {
                    filterInput.value = event.state.filter;
                    filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else {
                // Clear filters when going back to state without filter
                const branchFilter = document.getElementById('branch-filter');
                const cronFilter = document.getElementById('cron-filter');
                if (branchFilter && branchFilter.value) {
                    branchFilter.value = '';
                    branchFilter.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (cronFilter && cronFilter.value) {
                    cronFilter.value = '';
                    cronFilter.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            
            isRestoringState = false;
        }
    });
    
    // Set initial state
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        history.replaceState({ tab: activeTab.dataset.tab }, '', `#${activeTab.dataset.tab}`);
    }
}

// Internal tab switch (no history push)
function switchToTabInternal(tabId, tabButtons, tabContents) {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const content = document.getElementById(`${tabId}-tab`);

    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}

// Switch tab and push to history
function switchToTabWithHistory(tabId, tabButtons, tabContents, filter = null) {
    switchToTabInternal(tabId, tabButtons, tabContents);
    
    if (!isRestoringState) {
        const state = { tab: tabId };
        if (filter) state.filter = filter;
        history.pushState(state, '', `#${tabId}${filter ? '/' + encodeURIComponent(filter) : ''}`);
    }
}

// Switch to a specific tab programmatically (with history)
export function switchToTab(tabId, tabButtons, tabContents) {
    const allTabButtons = tabButtons || document.querySelectorAll('.tab-btn');
    const allTabContents = tabContents || document.querySelectorAll('.tab-content');
    switchToTabWithHistory(tabId, allTabButtons, allTabContents);
}

// Push filter state to history (called when navigating from overview)
export function pushFilterState(tabId, filter) {
    if (!isRestoringState) {
        const state = { tab: tabId, filter };
        history.pushState(state, '', `#${tabId}/${encodeURIComponent(filter)}`);
    }
}
