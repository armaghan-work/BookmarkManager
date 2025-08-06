/**
 * Simple Logger Utility
 * A lightweight logging system that can be gradually adopted
 * without changing existing functionality
 */

// Determine if we're in development mode
const isDevelopment = () => {
    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('dev') ||
        window.location.search.includes('debug=true') ||
        localStorage.getItem('debug') === 'true'
    );
};

// Simple logger that mirrors console behavior but with better formatting
const logger = {
    debug: function(message, data) {
        if (isDevelopment()) {
            if (data !== undefined) {
                console.log(`[DEBUG] ${message}`, data);
            } else {
                console.log(`[DEBUG] ${message}`);
            }
        }
    },

    info: function(message, data) {
        if (data !== undefined) {
            console.log(`[INFO] ${message}`, data);
        } else {
            console.log(`[INFO] ${message}`);
        }
    },

    warn: function(message, data) {
        if (data !== undefined) {
            console.warn(`[WARN] ${message}`, data);
        } else {
            console.warn(`[WARN] ${message}`);
        }
    },

    error: function(message, data) {
        if (data !== undefined) {
            console.error(`[ERROR] ${message}`, data);
        } else {
            console.error(`[ERROR] ${message}`);
        }
    }
};

// Make it available globally for gradual adoption
window.logger = logger;