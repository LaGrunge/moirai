// Theme switching functionality

// Initialize theme
export function initTheme(themeToggle) {
    const savedTheme = localStorage.getItem('ci_dashboard_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ci_dashboard_theme', newTheme);
    });
}
