/**
 * Logging Utility
 * Centralized logging with levels and production safety
 */

// Determine if we're in development mode
const isDevelopment = () => {
    // Check for common development indicators
    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('dev') ||
        window.location.search.includes('debug=true') ||
        localStorage.getItem('debug') === 'true'
    );
};

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor() {
        this.level = isDevelopment() ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
        this.prefix = '[BookmarkManager]';
    }

    /**
     * Set logging level
     * @param {string} level - Log level (error, warn, info, debug)
     */
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (LOG_LEVELS.hasOwnProperty(upperLevel)) {
            this.level = LOG_LEVELS[upperLevel];
        }
    }

    /**
     * Format log message with timestamp and context
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {any} data - Additional data
     * @returns {Array}
     */
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `${this.prefix} [${timestamp}] ${level}: ${message}`;

        if (data !== undefined) {
            return [formattedMessage, data];
        }
        return [formattedMessage];
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {any} data - Additional data
     */
    error(message, data) {
        if (this.level >= LOG_LEVELS.ERROR) {
            const args = this.formatMessage('ERROR', message, data);
            console.error(...args);

            // In production, you might want to send errors to a logging service
            if (!isDevelopment()) {
                this.sendToLoggingService('error', message, data);
            }
        }
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {any} data - Additional data
     */
    warn(message, data) {
        if (this.level >= LOG_LEVELS.WARN) {
            const args = this.formatMessage('WARN', message, data);
            console.warn(...args);
        }
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {any} data - Additional data
     */
    info(message, data) {
        if (this.level >= LOG_LEVELS.INFO) {
            const args = this.formatMessage('INFO', message, data);
            console.info(...args);
        }
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {any} data - Additional data
     */
    debug(message, data) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            const args = this.formatMessage('DEBUG', message, data);
            console.log(...args);
        }
    }

    /**
     * Log function execution time
     * @param {string} functionName - Function name
     * @param {Function} func - Function to time
     * @returns {any} Function result
     */
    time(functionName, func) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            const startTime = performance.now();
            const result = func();
            const endTime = performance.now();
            this.debug(`${functionName} executed in ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        }
        return func();
    }

    /**
     * Log async function execution time
     * @param {string} functionName - Function name
     * @param {Function} func - Async function to time
     * @returns {Promise<any>} Function result
     */
    async timeAsync(functionName, func) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            const startTime = performance.now();
            const result = await func();
            const endTime = performance.now();
            this.debug(`${functionName} executed in ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        }
        return await func();
    }

    /**
     * Create a scoped logger for a specific component
     * @param {string} component - Component name
     * @returns {Object} Scoped logger
     */
    createScope(component) {
        return {
            error: (message, data) => this.error(`[${component}] ${message}`, data),
            warn: (message, data) => this.warn(`[${component}] ${message}`, data),
            info: (message, data) => this.info(`[${component}] ${message}`, data),
            debug: (message, data) => this.debug(`[${component}] ${message}`, data),
            time: (functionName, func) => this.time(`[${component}] ${functionName}`, func),
            timeAsync: (functionName, func) => this.timeAsync(`[${component}] ${functionName}`, func)
        };
    }

    /**
     * Send error to logging service (placeholder for production)
     * @param {string} level - Log level
     * @param {string} message - Error message
     * @param {any} data - Additional data
     */
    sendToLoggingService(level, message, data) {
        // In a real application, you would send this to a logging service
        // like Sentry, LogRocket, or your own logging endpoint

        // Example implementation:
        // fetch('/api/logs', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         level,
        //         message,
        //         data,
        //         timestamp: new Date().toISOString(),
        //         userAgent: navigator.userAgent,
        //         url: window.location.href
        //     })
        // }).catch(() => {
        //     // Silently fail if logging service is unavailable
        // });
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.level = LOG_LEVELS.DEBUG;
        localStorage.setItem('debug', 'true');
        this.info('Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.level = LOG_LEVELS.ERROR;
        localStorage.removeItem('debug');
        console.log(`${this.prefix} Debug mode disabled`);
    }
}

// Create singleton instance
const logger = new Logger();

// Export both the instance and the class
export default logger;
export {
    Logger
};

// Convenience exports for direct use
export const {
    error,
    warn,
    info,
    debug,
    time,
    timeAsync,
    createScope
} = logger;