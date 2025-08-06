/**
 * DOM Utility Functions
 * Common DOM manipulation and utility functions used throughout the application
 */

const DOMUtils = {
    /**
     * Safely get element by ID with error handling
     * @param {string} id - Element ID
     * @returns {Element|null} - Element or null if not found
     */
    getElementById(id) {
        try {
            return document.getElementById(id);
        } catch (error) {
            console.error(`Error getting element by ID '${id}':`, error);
            return null;
        }
    },

    /**
     * Safely query selector with error handling
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element (optional)
     * @returns {Element|null} - Element or null if not found
     */
    querySelector(selector, parent = document) {
        try {
            return parent.querySelector(selector);
        } catch (error) {
            console.error(`Error with querySelector '${selector}':`, error);
            return null;
        }
    },

    /**
     * Safely query all selectors with error handling
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element (optional)
     * @returns {NodeList|Array} - NodeList or empty array if error
     */
    querySelectorAll(selector, parent = document) {
        try {
            return parent.querySelectorAll(selector);
        } catch (error) {
            console.error(`Error with querySelectorAll '${selector}':`, error);
            return [];
        }
    },

    /**
     * Create element with attributes and content
     * @param {string} tagName - HTML tag name
     * @param {Object} attributes - Attributes to set
     * @param {string|Element} content - Text content or child element
     * @returns {Element} - Created element
     */
    createElement(tagName, attributes = {}, content = null) {
        try {
            const element = document.createElement(tagName);

            // Set attributes
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'dataset') {
                    Object.entries(value).forEach(([dataKey, dataValue]) => {
                        element.dataset[dataKey] = dataValue;
                    });
                } else {
                    element.setAttribute(key, value);
                }
            });

            // Set content
            if (content !== null) {
                if (typeof content === 'string') {
                    element.textContent = content;
                } else if (content instanceof Element) {
                    element.appendChild(content);
                }
            }

            return element;
        } catch (error) {
            console.error(`Error creating element '${tagName}':`, error);
            return document.createElement('div'); // Fallback
        }
    },

    /**
     * Safely add event listener with error handling
     * @param {Element} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(element, event, handler, options = {}) {
        try {
            if (element && typeof handler === 'function') {
                element.addEventListener(event, handler, options);
            }
        } catch (error) {
            console.error(`Error adding event listener for '${event}':`, error);
        }
    },

    /**
     * Safely remove event listener
     * @param {Element} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    removeEventListener(element, event, handler) {
        try {
            if (element && typeof handler === 'function') {
                element.removeEventListener(event, handler);
            }
        } catch (error) {
            console.error(`Error removing event listener for '${event}':`, error);
        }
    },

    /**
     * Check if element is visible
     * @param {Element} element - Element to check
     * @returns {boolean} - True if visible
     */
    isVisible(element) {
        try {
            if (!element) return false;

            const style = getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0';
        } catch (error) {
            console.error('Error checking element visibility:', error);
            return false;
        }
    },

    /**
     * Get element dimensions safely
     * @param {Element} element - Element to measure
     * @returns {Object} - Dimensions object with width and height
     */
    getDimensions(element) {
        try {
            if (!element) return {
                width: 0,
                height: 0
            };

            const rect = element.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom
            };
        } catch (error) {
            console.error('Error getting element dimensions:', error);
            return {
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            };
        }
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Strip HTML tags from text
     * @param {string} html - HTML string
     * @returns {string} - Plain text
     */
    stripHtml(html) {
        if (typeof html !== 'string') return '';

        try {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        } catch (error) {
            console.error('Error stripping HTML:', error);
            return html.replace(/<[^>]*>/g, '');
        }
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} - Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Check if element is in viewport
     * @param {Element} element - Element to check
     * @returns {boolean} - True if in viewport
     */
    isInViewport(element) {
        try {
            if (!element) return false;

            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        } catch (error) {
            console.error('Error checking viewport:', error);
            return false;
        }
    },

    /**
     * Smooth scroll to element
     * @param {Element} element - Element to scroll to
     * @param {Object} options - Scroll options
     */
    scrollToElement(element, options = {}) {
        try {
            if (!element) return;

            const defaultOptions = {
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            };

            element.scrollIntoView({
                ...defaultOptions,
                ...options
            });
        } catch (error) {
            console.error('Error scrolling to element:', error);
        }
    },

    /**
     * Get text selection information
     * @returns {Object} - Selection information
     */
    getSelection() {
        try {
            const selection = window.getSelection();
            return {
                text: selection.toString(),
                rangeCount: selection.rangeCount,
                isCollapsed: selection.isCollapsed,
                anchorNode: selection.anchorNode,
                focusNode: selection.focusNode
            };
        } catch (error) {
            console.error('Error getting selection:', error);
            return {
                text: '',
                rangeCount: 0,
                isCollapsed: true,
                anchorNode: null,
                focusNode: null
            };
        }
    },

    /**
     * Set text selection
     * @param {Element} element - Element to select in
     * @param {number} start - Start position
     * @param {number} end - End position
     */
    setSelection(element, start, end) {
        try {
            if (!element) return;

            const range = document.createRange();
            const selection = window.getSelection();

            // For contentEditable elements
            if (element.isContentEditable) {
                const textNode = element.firstChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    range.setStart(textNode, Math.min(start, textNode.textContent.length));
                    range.setEnd(textNode, Math.min(end, textNode.textContent.length));

                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        } catch (error) {
            console.error('Error setting selection:', error);
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
} else {
    window.DOMUtils = DOMUtils;
}