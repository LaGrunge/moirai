// Settings tab functionality

import { state, CI_ICONS, saveSettings, saveSavedConfigs } from '../state.js';
import { storage } from '../storage.js';
import { escapeHtml, getRepoId, getRepoFullName, generateDisplayName } from '../utils.js';
import { apiRequest, filterReposWithBuilds } from '../api.js';

// Initialize settings tab
export function initSettings(elements, callbacks) {
    const {
        clearCacheBtn,
        filterEmptyReposCheckbox,
        statsPeriodSelect,
        addConfigServerSelect,
        addConfigRepoSelect,
        addConfigNameInput,
        addConfigBtn
    } = elements;

    // Initialize filter checkbox from settings
    filterEmptyReposCheckbox.checked = state.settings.filterEmptyRepos;
    filterEmptyReposCheckbox.addEventListener('change', (e) => {
        state.settings.filterEmptyRepos = e.target.checked;
        saveSettings();
    });

    // Initialize stats period select from settings
    if (statsPeriodSelect) {
        const currentPeriod = state.settings.statsPeriodDays || 30;
        statsPeriodSelect.value = currentPeriod;
        statsPeriodSelect.addEventListener('change', (e) => {
            const newPeriod = parseInt(e.target.value);
            state.settings.statsPeriodDays = newPeriod;
            saveSettings();
            // Close all open stats panels so they use new period when reopened
            document.querySelectorAll('.stats-container').forEach(container => {
                container.style.display = 'none';
            });
            document.querySelectorAll('.stats-btn.active').forEach(btn => {
                btn.classList.remove('active');
            });
        });
    }
    
    // Initialize CPU cost setting
    const cpuCostInput = document.getElementById('setting-cpu-cost');
    const cpuCostSetting = document.getElementById('cpu-cost-setting');
    const awsCostNotice = document.getElementById('aws-cost-notice');
    
    if (cpuCostInput) {
        cpuCostInput.value = state.settings.cpuCostPerHour || 0.05;
        cpuCostInput.addEventListener('change', (e) => {
            const newCost = parseFloat(e.target.value) || 0.05;
            state.settings.cpuCostPerHour = newCost;
            saveSettings();
        });
    }
    
    // Check AWS status and update UI
    checkAwsStatus(cpuCostSetting, awsCostNotice, cpuCostInput);

    // Handle clear cache button
    clearCacheBtn.addEventListener('click', () => {
        storage.clearAll();
        alert('All data cleared! Page will reload.');
        location.reload();
    });

    // Handle server selection in add form
    addConfigServerSelect.addEventListener('change', async (e) => {
        const serverId = e.target.value;
        addConfigRepoSelect.innerHTML = '<option value="">Loading...</option>';
        addConfigRepoSelect.disabled = true;
        addConfigBtn.disabled = true;

        if (!serverId) {
            addConfigRepoSelect.innerHTML = '<option value="">Select server first...</option>';
            return;
        }

        const server = state.servers.find(s => s.id === serverId);
        if (!server) return;

        try {
            // Temporarily set currentServer for API calls
            const prevServer = state.currentServer;
            state.currentServer = server;
            let repos = await apiRequest('/user/repos');

            // Filter repos with builds if setting enabled
            if (state.settings.filterEmptyRepos) {
                addConfigRepoSelect.innerHTML = '<option value="">Checking builds...</option>';
                repos = await filterReposWithBuilds(repos);
            }

            state.currentServer = prevServer;

            addConfigRepoSelect.innerHTML = '<option value="">Select repository...</option>';
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    id: getRepoId(repo),
                    fullName: getRepoFullName(repo),
                    repoData: repo
                });
                option.textContent = getRepoFullName(repo);
                addConfigRepoSelect.appendChild(option);
            });
            addConfigRepoSelect.disabled = false;
        } catch (error) {
            console.error('Failed to load repos:', error);
            addConfigRepoSelect.innerHTML = '<option value="">Failed to load repos</option>';
        }
    });

    // Handle repo selection in add form - auto-fill display name
    addConfigRepoSelect.addEventListener('change', (e) => {
        addConfigBtn.disabled = !e.target.value;

        if (e.target.value) {
            const repo = JSON.parse(e.target.value);
            addConfigNameInput.value = generateDisplayName(repo.fullName);
        } else {
            addConfigNameInput.value = '';
        }
    });

    // Handle add button
    addConfigBtn.addEventListener('click', () => {
        const serverId = addConfigServerSelect.value;
        const repoData = addConfigRepoSelect.value;
        const displayName = addConfigNameInput.value.trim();

        if (!serverId || !repoData) return;

        const server = state.servers.find(s => s.id === serverId);
        const repo = JSON.parse(repoData);

        const config = {
            id: `${serverId}_${repo.id}`,
            serverId: serverId,
            serverName: server.name,
            serverType: server.type,
            serverUrl: server.url,
            serverToken: server.token,
            repoId: repo.id,
            repoFullName: repo.fullName,
            repoData: repo.repoData,
            displayName: displayName || repo.fullName
        };

        // Check if already exists
        if (state.savedConfigs.find(c => c.id === config.id)) {
            alert('This repository is already saved!');
            return;
        }

        state.savedConfigs.push(config);
        saveSavedConfigs();
        
        if (callbacks.renderSavedConfigsList) {
            callbacks.renderSavedConfigsList();
        }
        if (callbacks.populateConfigDropdown) {
            callbacks.populateConfigDropdown();
        }

        // Reset form
        addConfigServerSelect.value = '';
        addConfigRepoSelect.innerHTML = '<option value="">Select server first...</option>';
        addConfigRepoSelect.disabled = true;
        addConfigNameInput.value = '';
        addConfigBtn.disabled = true;

        // Auto-select if first config
        if (state.savedConfigs.length === 1 && callbacks.selectConfig) {
            callbacks.selectConfig(config.id);
        }
    });

    // Initial render
    if (callbacks.renderSavedConfigsList) {
        callbacks.renderSavedConfigsList();
    }
    populateAddConfigServerSelect(addConfigServerSelect);
}

// Populate server select in add form
export function populateAddConfigServerSelect(select) {
    select.innerHTML = '<option value="">Select server...</option>';
    state.servers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = `${server.name} (${server.type})`;
        select.appendChild(option);
    });
}

// Check AWS status and update cost setting UI
async function checkAwsStatus(cpuCostSetting, awsCostNotice, cpuCostInput) {
    if (!cpuCostSetting || !awsCostNotice) return;
    
    try {
        const response = await fetch('/api/aws/status');
        const data = await response.json();
        
        state.awsEnabled = data.enabled;
        
        if (data.enabled) {
            // AWS is configured - disable manual cost setting
            cpuCostSetting.style.display = 'none';
            awsCostNotice.style.display = 'flex';
            if (cpuCostInput) cpuCostInput.disabled = true;
        } else {
            // AWS not configured - show manual cost setting
            cpuCostSetting.style.display = 'flex';
            awsCostNotice.style.display = 'none';
            if (cpuCostInput) cpuCostInput.disabled = false;
        }
    } catch (error) {
        // If can't reach server, assume no AWS
        console.log('Could not check AWS status:', error);
        state.awsEnabled = false;
    }
}

// Render saved configs list in settings
export function renderSavedConfigsList(container, onRemoveConfig) {
    if (state.savedConfigs.length === 0) {
        container.innerHTML = '<div class="placeholder">No saved repositories yet. Add one below!</div>';
        return;
    }

    container.innerHTML = state.savedConfigs.map(config => `
        <div class="saved-config-item" data-config-id="${config.id}">
            <span class="config-icon"><img src="${CI_ICONS[config.serverType] || CI_ICONS.woodpecker}" alt="${config.serverType}"></span>
            <div class="config-info">
                <div class="config-name">${escapeHtml(config.displayName)}</div>
                <div class="config-details">${escapeHtml(config.serverName)} • ${escapeHtml(config.repoFullName)}</div>
            </div>
            <button class="config-remove" title="Remove">×</button>
        </div>
    `).join('');

    // Add remove handlers
    container.querySelectorAll('.config-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.saved-config-item');
            const configId = item.dataset.configId;
            onRemoveConfig(configId);
        });
    });
}
