// Theme switching functionality

import { storage } from '../storage.js';

// Initialize theme
export function initTheme(themeToggle) {
    const savedTheme = storage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        storage.saveTheme(newTheme);
    });
}
