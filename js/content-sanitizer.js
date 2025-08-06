/**
 * HTML Content Sanitization and Validation Utilities
 * 
 * This module provides functions to sanitize HTML content and validate it
 * for safe use in the notes editing tool. It prevents XSS attacks by
 * allowing only safe formatting tags.
 */

/**
 * List of allowed HTML tags for formatting
 */
const ALLOWED_TAGS = ['p', 'div', 'span', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br'];

/**
 * List of allowed HTML attributes (currently none for security)
 */
const ALLOWED_ATTRIBUTES = ['style'];

/**
 * List of dangerous tags that should be completely removed (including their content)
 */
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'form', 'input', 'button'];

/**
 * Sanitizes HTML content by removing harmful tags and attributes
 * while preserving safe formatting tags.
 * 
 * @param {string} html - The HTML content to sanitize
 * @returns {string} - The sanitized HTML content
 */
function sanitizeContent(html) {
    if (typeof html !== 'string') {
        return '';
    }

    // Handle empty or whitespace-only content
    if (!html.trim()) {
        return '';
    }

    try {
        // Create a temporary DOM element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Recursively sanitize all elements
        sanitizeElement(tempDiv);

        return tempDiv.innerHTML;
    } catch (error) {
        console.error('Error sanitizing content:', error);
        // Fallback to plain text if sanitization fails
        return fallbackToPlainText(html);
    }
}

/**
 * Recursively sanitizes a DOM element and its children
 * 
 * @param {Element} element - The DOM element to sanitize
 */
function sanitizeElement(element) {
    const children = Array.from(element.childNodes);

    children.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();

            // Check if tag is dangerous and should be completely removed
            if (DANGEROUS_TAGS.includes(tagName)) {
                // Completely remove dangerous tags and their content
                child.parentNode.removeChild(child);
            } else if (ALLOWED_TAGS.includes(tagName)) {
                // Remove all attributes for security (can be expanded later if needed)
                const attributes = Array.from(child.attributes);
                attributes.forEach(attr => {
                    if (!ALLOWED_ATTRIBUTES.includes(attr.name.toLowerCase())) {
                        child.removeAttribute(attr.name);
                    }
                });

                // Recursively sanitize children
                sanitizeElement(child);
            } else {
                // For disallowed tags, check if they contain dangerous content
                if (containsDangerousContent(child)) {
                    // If they contain dangerous content, remove the entire element
                    child.parentNode.removeChild(child);
                } else {
                    // Otherwise, first sanitize their children
                    sanitizeElement(child);

                    // Then replace the tag with its sanitized text content
                    const textNode = document.createTextNode(child.textContent || '');
                    child.parentNode.replaceChild(textNode, child);
                }
            }
        }
        // Text nodes and other safe node types are left as-is
    });
}

/**
 * Checks if an element contains dangerous content (dangerous tags or scripts)
 * 
 * @param {Element} element - The DOM element to check
 * @returns {boolean} - True if the element contains dangerous content
 */
function containsDangerousContent(element) {
    // Check if the element itself or any descendant is a dangerous tag
    const allElements = element.querySelectorAll('*');

    // Check the element itself
    if (DANGEROUS_TAGS.includes(element.tagName.toLowerCase())) {
        return true;
    }

    // Check all descendants
    for (let i = 0; i < allElements.length; i++) {
        if (DANGEROUS_TAGS.includes(allElements[i].tagName.toLowerCase())) {
            return true;
        }
    }

    // Check for dangerous text content patterns
    const textContent = element.textContent || '';
    const dangerousTextPatterns = [
        /javascript:/i,
        /vbscript:/i,
        /data:/i,
        /alert\s*\(/i,
        /eval\s*\(/i,
        /document\./i,
        /window\./i
    ];

    return dangerousTextPatterns.some(pattern => pattern.test(textContent));
}

/**
 * Converts HTML content to plain text as a fallback mechanism
 * 
 * @param {string} content - The content to convert to plain text
 * @returns {string} - The plain text content
 */
function fallbackToPlainText(content) {
    if (typeof content !== 'string') {
        return '';
    }

    try {
        // Create a temporary element to extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        return tempDiv.textContent || tempDiv.innerText || '';
    } catch (error) {
        console.error('Error in fallback to plain text:', error);
        // Last resort: use regex to strip HTML tags
        return content.replace(/<[^>]*>/g, '').trim();
    }
}

/**
 * Validates HTML content structure and checks for potential security issues
 * 
 * @param {string} html - The HTML content to validate
 * @returns {Object} - Validation result with isValid boolean and errors array
 */
function validateContent(html) {
    const result = {
        isValid: true,
        errors: []
    };

    if (typeof html !== 'string') {
        result.isValid = false;
        result.errors.push('Content must be a string');
        return result;
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
        /<script[^>]*>/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i,
        /<link[^>]*>/i,
        /<meta[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /data:/i,
        /on\w+\s*=/i // Event handlers like onclick, onload, etc.
    ];

    dangerousPatterns.forEach((pattern, index) => {
        if (pattern.test(html)) {
            result.isValid = false;
            result.errors.push(`Potentially dangerous content detected (pattern ${index + 1})`);
        }
    });

    // Check for excessive nesting (prevent DoS attacks)
    const maxNestingLevel = 10;
    const nestingLevel = getMaxNestingLevel(html);
    if (nestingLevel > maxNestingLevel) {
        result.isValid = false;
        result.errors.push(`Excessive nesting detected (${nestingLevel} levels, max allowed: ${maxNestingLevel})`);
    }

    // Check content length (prevent DoS attacks)
    const maxContentLength = 100000; // 100KB
    if (html.length > maxContentLength) {
        result.isValid = false;
        result.errors.push(`Content too large (${html.length} characters, max allowed: ${maxContentLength})`);
    }

    return result;
}

/**
 * Calculates the maximum nesting level of HTML elements
 * 
 * @param {string} html - The HTML content to analyze
 * @returns {number} - The maximum nesting level
 */
function getMaxNestingLevel(html) {
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return calculateElementDepth(tempDiv);
    } catch (error) {
        console.error('Error calculating nesting level:', error);
        return 0;
    }
}

/**
 * Recursively calculates the depth of DOM elements
 * 
 * @param {Element} element - The DOM element to analyze
 * @returns {number} - The depth of the element tree
 */
function calculateElementDepth(element) {
    let maxDepth = 0;

    Array.from(element.children).forEach(child => {
        const childDepth = calculateElementDepth(child);
        maxDepth = Math.max(maxDepth, childDepth);
    });

    return maxDepth + 1;
}

/**
 * Safely processes content by validating and sanitizing it
 * 
 * @param {string} content - The content to process
 * @returns {Object} - Result object with processed content and validation info
 */
function processContent(content) {
    const validation = validateContent(content);

    if (!validation.isValid) {
        console.warn('Content validation failed:', validation.errors);
        // Return plain text version if validation fails
        return {
            content: fallbackToPlainText(content),
            isHtml: false,
            errors: validation.errors
        };
    }

    const sanitizedContent = sanitizeContent(content);

    return {
        content: sanitizedContent,
        isHtml: true,
        errors: []
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        sanitizeContent,
        fallbackToPlainText,
        validateContent,
        processContent
    };
} else {
    // Browser environment - attach to window object
    window.ContentSanitizer = {
        sanitizeContent,
        fallbackToPlainText,
        validateContent,
        processContent
    };
}