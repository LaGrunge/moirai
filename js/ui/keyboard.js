// Keyboard shortcuts module

import { switchToTab } from './tabs.js';

// Callbacks for actions (set during init)
let refreshCallback = null;
let tabButtons = null;
let tabContents = null;

// Tab mapping: key -> tab name
const TAB_KEYS = {
    '1': 'overview',
    '2': 'branches',
    '3': 'cron',
    '4': 'contributors',
    '5': 'infra',
    '6': 'settings'
};

// Initialize keyboard shortcuts
export function initKeyboardShortcuts(callbacks) {
    refreshCallback = callbacks.refresh;
    tabButtons = callbacks.tabButtons;
    tabContents = callbacks.tabContents;
    
    document.addEventListener('keydown', handleKeyDown);
}

// Handle keydown events
function handleKeyDown(e) {
    // Ignore if user is typing in an input/textarea/select
    if (isInputFocused()) return;
    
    // Ignore if modifier keys are pressed (except for some shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    
    const key = e.key.toLowerCase();
    
    // R - Refresh data
    if (key === 'r') {
        e.preventDefault();
        if (refreshCallback) {
            refreshCallback();
        }
        return;
    }
    
    // 1-6 - Switch tabs
    if (TAB_KEYS[key]) {
        e.preventDefault();
        switchToTab(TAB_KEYS[key], tabButtons, tabContents);
        return;
    }
    
    // ? - Show shortcuts help
    if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        showShortcutsHelp();
        return;
    }
    
    // Escape - Close any open dropdowns/modals
    if (key === 'escape') {
        closeOpenElements();
        return;
    }
}

// Check if user is focused on an input element
function isInputFocused() {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    
    const tagName = activeEl.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || activeEl.isContentEditable;
}

// Close open dropdowns and modals
function closeOpenElements() {
    // Close config dropdown
    const dropdown = document.getElementById('config-dropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
    
    // Close any open stats panels
    document.querySelectorAll('.stats-container').forEach(container => {
        if (container.style.display !== 'none') {
            container.style.display = 'none';
        }
    });
    document.querySelectorAll('.stats-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Blur active element
    if (document.activeElement) {
        document.activeElement.blur();
    }
}

// Show keyboard shortcuts help modal
function showShortcutsHelp() {
    // Check if modal already exists
    let modal = document.getElementById('shortcuts-modal');
    if (modal) {
        modal.style.display = 'flex';
        return;
    }
    
    // Create modal
    modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.className = 'shortcuts-modal';
    modal.innerHTML = `
        <div class="shortcuts-content">
            <div class="shortcuts-header">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <button class="shortcuts-close">&times;</button>
            </div>
            <div class="shortcuts-body">
                <div class="shortcut-group">
                    <h4>Navigation</h4>
                    <div class="shortcut-item"><kbd>1</kbd> Overview</div>
                    <div class="shortcut-item"><kbd>2</kbd> Branches</div>
                    <div class="shortcut-item"><kbd>3</kbd> Cron Builds</div>
                    <div class="shortcut-item"><kbd>4</kbd> Contributors</div>
                    <div class="shortcut-item"><kbd>5</kbd> Infrastructure</div>
                    <div class="shortcut-item"><kbd>6</kbd> Settings</div>
                </div>
                <div class="shortcut-group">
                    <h4>Actions</h4>
                    <div class="shortcut-item"><kbd>R</kbd> Refresh data</div>
                    <div class="shortcut-item"><kbd>Esc</kbd> Close panels</div>
                    <div class="shortcut-item"><kbd>?</kbd> Show this help</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('shortcuts-close')) {
            modal.style.display = 'none';
        }
    });
}
