// Tab switching functionality

// Initialize tabs
export function initTabs(tabButtons, tabContents) {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Switch to a specific tab programmatically
export function switchToTab(tabId, tabButtons, tabContents) {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const content = document.getElementById(`${tabId}-tab`);

    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}
