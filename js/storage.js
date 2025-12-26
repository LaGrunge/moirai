// Centralized localStorage management
// All storage keys and operations in one place

const STORAGE_KEYS = {
    SETTINGS: 'moirai_settings',
    SAVED_CONFIGS: 'moirai_saved_configs',
    SELECTED_CONFIG: 'moirai_selected_config',
    THEME: 'moirai_theme',
    DEMO_MODE: 'moirai_demo_mode'
};

// Generic get/set with JSON parsing
function getJSON(key, defaultValue = null) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
        console.error(`Failed to load ${key}:`, e);
        return defaultValue;
    }
}

function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getString(key, defaultValue = '') {
    return localStorage.getItem(key) || defaultValue;
}

function setString(key, value) {
    localStorage.setItem(key, value);
}

function remove(key) {
    localStorage.removeItem(key);
}

// Specific accessors
export const storage = {
    // Settings
    getSettings: () => getJSON(STORAGE_KEYS.SETTINGS, {}),
    saveSettings: (settings) => setJSON(STORAGE_KEYS.SETTINGS, settings),
    
    // Saved configs
    getSavedConfigs: () => getJSON(STORAGE_KEYS.SAVED_CONFIGS, []),
    saveSavedConfigs: (configs) => setJSON(STORAGE_KEYS.SAVED_CONFIGS, configs),
    
    // Selected config
    getSelectedConfig: () => getString(STORAGE_KEYS.SELECTED_CONFIG),
    saveSelectedConfig: (configId) => setString(STORAGE_KEYS.SELECTED_CONFIG, configId),
    clearSelectedConfig: () => remove(STORAGE_KEYS.SELECTED_CONFIG),
    
    // Theme
    getTheme: () => getString(STORAGE_KEYS.THEME, 'light'),
    saveTheme: (theme) => setString(STORAGE_KEYS.THEME, theme),
    
    // Demo mode
    getDemoMode: () => getString(STORAGE_KEYS.DEMO_MODE) === 'true',
    saveDemoMode: (enabled) => setString(STORAGE_KEYS.DEMO_MODE, enabled.toString()),
    
    // Clear all
    clearAll: () => {
        Object.values(STORAGE_KEYS).forEach(key => remove(key));
    }
};

export { STORAGE_KEYS };
