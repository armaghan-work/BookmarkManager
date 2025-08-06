/**
 * Global Error Handler
 * Centralized error handling and recovery
 */

import logger from './logger.js';
import {
    ERROR_MESSAGES
} from '../constants.js';

class ErrorHandler {
    constructor() {
        this.setupGlobalHandlers();
        this.errorCount = 0;
        this.maxErrors = 10; // Prevent error spam
        this.recoveryStrategies = new Map();

        // Register default recovery strategies
        this.registerRecoveryStrategy('network', this.networkErrorRecovery.bind(this));
        this.registerRecoveryStrategy('storage', this.storageErrorRecovery.bind(this));
        this.registerRecoveryStrategy('ui', this.uiErrorRecovery.bind(this));
    }

    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error && event.error.stack
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: (event.reason && event.reason.message) || 'Unhandled promise rejection',
                error: event.reason,
                stack: event.reason && event.reason.stack
            });
        });

        // Handle network errors
        window.addEventListener('offline', () => {
            this.handleError({
                type: 'network',
                message: 'Network connection lost',
                recoverable: true
            });
        });

        window.addEventListener('online', () => {
            logger.info('Network connection restored');
            this.showUserMessage('Connection restored', 'success');
        });
    }

    /**
     * Handle errors with context and recovery
     * @param {Object} errorInfo - Error information
     */
    handleError(errorInfo) {
        // Prevent error spam
        if (this.errorCount >= this.maxErrors) {
            return;
        }
        this.errorCount++;

        // Log the error
        logger.error('Error occurred', errorInfo);

        // Attempt recovery if strategy exists
        if (errorInfo.recoverable !== false) {
            const recovered = this.attemptRecovery(errorInfo);
            if (recovered) {
                logger.info('Error recovery successful', {
                    type: errorInfo.type
                });
                return;
            }
        }

        // Show user-friendly error message
        this.showUserError(errorInfo);

        // Reset error count after some time
        setTimeout(() => {
            this.errorCount = Math.max(0, this.errorCount - 1);
        }, 60000); // Reset one error per minute
    }

    /**
     * Register a recovery strategy
     * @param {string} type - Error type
     * @param {Function} strategy - Recovery function
     */
    registerRecoveryStrategy(type, strategy) {
        this.recoveryStrategies.set(type, strategy);
    }

    /**
     * Attempt to recover from error
     * @param {Object} errorInfo - Error information
     * @returns {boolean} Recovery success
     */
    attemptRecovery(errorInfo) {
        const strategy = this.recoveryStrategies.get(errorInfo.type);
        if (strategy) {
            try {
                return strategy(errorInfo);
            } catch (recoveryError) {
                logger.error('Recovery strategy failed', {
                    originalError: errorInfo,
                    recoveryError: recoveryError.message
                });
            }
        }
        return false;
    }

    /**
     * Network error recovery strategy
     * @param {Object} errorInfo - Error information
     * @returns {boolean} Recovery success
     */
    networkErrorRecovery(errorInfo) {
        // Show offline indicator
        this.showOfflineIndicator();

        // Attempt to queue failed requests for retry
        if (errorInfo.request) {
            this.queueFailedRequest(errorInfo.request);
        }

        return true; // Always consider network errors recoverable
    }

    /**
     * Storage error recovery strategy
     * @param {Object} errorInfo - Error information
     * @returns {boolean} Recovery success
     */
    storageErrorRecovery(errorInfo) {
        // Try to clear corrupted data
        try {
            localStorage.removeItem('bookmarkData');
            logger.info('Cleared corrupted storage data');

            // Reload the page to start fresh
            if (confirm('Storage error detected. Reload the page to recover?')) {
                window.location.reload();
            }

            return true;
        } catch (error) {
            logger.error('Storage recovery failed', error);
            return false;
        }
    }

    /**
     * UI error recovery strategy
     * @param {Object} errorInfo - Error information
     * @returns {boolean} Recovery success
     */
    uiErrorRecovery(errorInfo) {
        // Try to restore UI to a known good state
        try {
            // Close any open modals
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                modal.style.display = 'none';
            });

            // Clear any error states
            const errorElements = document.querySelectorAll('.error');
            errorElements.forEach(element => {
                element.classList.remove('error');
            });

            logger.info('UI state recovered');
            return true;
        } catch (error) {
            logger.error('UI recovery failed', error);
            return false;
        }
    }

    /**
     * Show user-friendly error message
     * @param {Object} errorInfo - Error information
     */
    showUserError(errorInfo) {
        const message = this.getUserFriendlyMessage(errorInfo);
        this.showUserMessage(message, 'error');
    }

    /**
     * Get user-friendly error message
     * @param {Object} errorInfo - Error information
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(errorInfo) {
        switch (errorInfo.type) {
            case 'network':
                return 'Connection problem. Please check your internet connection.';
            case 'storage':
                return 'Unable to save data. Please try again.';
            case 'javascript':
                return 'Something went wrong. Please refresh the page.';
            case 'promise':
                return 'An operation failed. Please try again.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    /**
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Message type (error, success, info)
     */
    showUserMessage(message, type = 'info') {
        // Create or get notification container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            float: right;
            cursor: pointer;
            margin-left: 10px;
        `;
        closeBtn.onclick = () => notification.remove();
        notification.appendChild(closeBtn);

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Show offline indicator
     */
    showOfflineIndicator() {
        let indicator = document.getElementById('offline-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ff9800;
                color: white;
                text-align: center;
                padding: 8px;
                z-index: 10001;
                font-weight: bold;
            `;
            indicator.textContent = 'You are offline. Some features may not work.';
            document.body.appendChild(indicator);
        }
    }

    /**
     * Queue failed request for retry
     * @param {Object} request - Failed request information
     */
    queueFailedRequest(request) {
        // In a real implementation, you would queue requests
        // and retry them when connection is restored
        logger.debug('Queuing failed request for retry', request);
    }

    /**
     * Create safe wrapper for async functions
     * @param {Function} asyncFn - Async function to wrap
     * @param {string} context - Context for error reporting
     * @returns {Function} Wrapped function
     */
    wrapAsync(asyncFn, context = 'async operation') {
        return async (...args) => {
            try {
                return await asyncFn(...args);
            } catch (error) {
                this.handleError({
                    type: 'async',
                    message: `Error in ${context}: ${error.message}`,
                    error,
                    stack: error.stack,
                    context
                });
                throw error; // Re-throw for caller to handle
            }
        };
    }

    /**
     * Create safe wrapper for regular functions
     * @param {Function} fn - Function to wrap
     * @param {string} context - Context for error reporting
     * @returns {Function} Wrapped function
     */
    wrapSync(fn, context = 'operation') {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError({
                    type: 'sync',
                    message: `Error in ${context}: ${error.message}`,
                    error,
                    stack: error.stack,
                    context
                });
                throw error; // Re-throw for caller to handle
            }
        };
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

export default errorHandler;