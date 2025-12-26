// Config dropdown functionality

import { state, CI_ICONS, saveSavedConfigs } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showPlaceholder } from './common.js';

// Initialize config select dropdown
export function initConfigSelect(configSelectBtn, configDropdown) {
    // Toggle dropdown
    configSelectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        configDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        configDropdown.classList.remove('open');
    });

    // Prevent dropdown from closing when clicking inside it
    configDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Update the config select button to show current selection
export function updateConfigSelectButton(configSelectBtn) {
    const iconEl = configSelectBtn.querySelector('.config-icon');
    const nameEl = configSelectBtn.querySelector('.config-name');

    if (state.currentConfig) {
        iconEl.innerHTML = `<img src="${CI_ICONS[state.currentConfig.serverType] || CI_ICONS.woodpecker}" alt="${state.currentConfig.serverType}">`;
        nameEl.textContent = state.currentConfig.displayName;
    } else {
        iconEl.innerHTML = '';
        nameEl.textContent = 'Select repository...';
    }
}

// Update dropdown to show which item is selected
export function updateConfigDropdownSelection(configDropdown) {
    const items = configDropdown.querySelectorAll('.config-dropdown-item');
    items.forEach(item => {
        if (item.dataset.configId === (state.currentConfig ? state.currentConfig.id : '')) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Populate config dropdown
export function populateConfigDropdown(configDropdown, onSelectConfig) {
    if (state.savedConfigs.length === 0) {
        configDropdown.innerHTML = '<div class="config-dropdown-empty">No saved repositories. Go to Settings to add one.</div>';
        return;
    }

    configDropdown.innerHTML = '';
    state.savedConfigs.forEach(config => {
        const item = document.createElement('div');
        item.className = 'config-dropdown-item';
        item.dataset.configId = config.id;
        item.innerHTML = `
            <span class="config-icon"><img src="${CI_ICONS[config.serverType] || CI_ICONS.woodpecker}" alt="${config.serverType}"></span>
            <div class="config-info">
                <div class="config-name">${escapeHtml(config.displayName)}</div>
                <div class="config-details">${escapeHtml(config.serverName)}</div>
            </div>
        `;
        item.addEventListener('click', () => onSelectConfig(config.id));
        configDropdown.appendChild(item);
    });

    updateConfigDropdownSelection(configDropdown);
}

// Remove a saved config
export function removeConfig(configId, elements, callbacks) {
    state.savedConfigs = state.savedConfigs.filter(c => c.id !== configId);
    saveSavedConfigs();
    
    if (callbacks.renderSavedConfigsList) {
        callbacks.renderSavedConfigsList();
    }
    if (callbacks.populateConfigDropdown) {
        callbacks.populateConfigDropdown();
    }

    if (state.currentConfig && state.currentConfig.id === configId) {
        state.currentConfig = null;
        state.currentServer = null;
        state.currentRepo = null;
        updateConfigSelectButton(elements.configSelectBtn);
        showPlaceholder(elements.branchesCards, 'Select a repository from the dropdown');
        showPlaceholder(elements.cronCards, 'Select a repository from the dropdown');
    }
}
