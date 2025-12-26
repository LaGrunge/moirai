// Global error handling

// Error types for better categorization
export const ErrorTypes = {
    NETWORK: 'network',
    API: 'api',
    AUTH: 'auth',
    UNKNOWN: 'unknown'
};

// Classify error by type
function classifyError(error) {
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
        return ErrorTypes.NETWORK;
    }
    if (error.message?.includes('401') || error.message?.includes('403')) {
        return ErrorTypes.AUTH;
    }
    if (error.message?.includes('API Error')) {
        return ErrorTypes.API;
    }
    return ErrorTypes.UNKNOWN;
}

// Format error message for display
function formatErrorMessage(error, type) {
    switch (type) {
        case ErrorTypes.NETWORK:
            return 'Network error. Please check your connection.';
        case ErrorTypes.AUTH:
            return 'Authentication failed. Please check your API token.';
        case ErrorTypes.API:
            return `API Error: ${error.message}`;
        default:
            return `An unexpected error occurred: ${error.message}`;
    }
}

// Show toast notification for errors (non-blocking)
function showErrorToast(message) {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('error-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'error-toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.style.cssText = `
        background-color: var(--failure-color, #dc3545);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        margin-left: 10px;
        cursor: pointer;
        opacity: 0.8;
    `;
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Log error for debugging
function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const type = classifyError(error);
    
    console.group(`[${timestamp}] Error${context ? ` in ${context}` : ''}`);
    console.error('Type:', type);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.groupEnd();
}

// Main error handler
export function handleError(error, context = '', showToast = true) {
    const type = classifyError(error);
    const message = formatErrorMessage(error, type);
    
    logError(error, context);
    
    if (showToast) {
        showErrorToast(message);
    }
    
    return { type, message };
}

// Initialize global error handlers
export function initGlobalErrorHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
        handleError(event.error || new Error(event.message), 'uncaught');
        // Prevent default browser error handling
        event.preventDefault();
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error 
            ? event.reason 
            : new Error(String(event.reason));
        handleError(error, 'unhandled promise');
        // Prevent default browser handling
        event.preventDefault();
    });

    // Add CSS animation for toasts
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    console.log('Global error handlers initialized');
}
