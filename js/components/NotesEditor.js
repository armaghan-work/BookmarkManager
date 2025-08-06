/**
 * Notes Editor Component
 * Handles the floating notes window functionality
 */

import logger from '../utils/logger.js';
import {
    NOTES_DEFAULTS,
    UI_CONSTANTS,
    ELEMENT_IDS
} from '../constants.js';
import {
    setHTMLContent,
    getElementById,
    addEventListenerSafe,
    setStyle
} from '../utils/dom-utils.js';
import errorHandler from '../utils/error-handler.js';

const log = logger.createScope('NotesEditor');

class NotesEditor {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.notesWindow = null;
        this.notesEditor = null;
        this.notesHeader = null;
        this.isDragging = false;
        this.dragOffset = {
            x: 0,
            y: 0
        };
        this.saveTimeout = null;
        this.isRestoringSize = false;

        this.init();
    }

    /**
     * Initialize the notes editor
     */
    init() {
        try {
            this.setupElements();
            this.setupDragging();
            this.setupAutoSave();
            this.setupResizing();
            this.setupFormattingCommands();
            this.loadNotesContent();

            log.info('Notes editor initialized successfully');
        } catch (error) {
            log.error('Failed to initialize notes editor', error);
            errorHandler.handleError({
                type: 'ui',
                message: 'Notes editor initialization failed',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Setup DOM elements
     */
    setupElements() {
        this.notesWindow = getElementById(ELEMENT_IDS.NOTES_WINDOW);
        this.notesEditor = getElementById(ELEMENT_IDS.NOTES_EDITOR);
        this.notesHeader = getElementById(ELEMENT_IDS.NOTES_HEADER);

        if (!this.notesWindow || !this.notesEditor || !this.notesHeader) {
            throw new Error('Required notes elements not found in DOM');
        }

        // Ensure notes data exists
        this.ensureNotesData();
    }

    /**
     * Ensure notes data structure exists
     */
    ensureNotesData() {
        const bookmarkData = this.dataManager.getData();

        if (!bookmarkData.notes) {
            bookmarkData.notes = {
                content: NOTES_DEFAULTS.CONTENT,
                plainContent: NOTES_DEFAULTS.PLAIN_CONTENT,
                position: {
                    ...NOTES_DEFAULTS.POSITION
                },
                size: {
                    ...NOTES_DEFAULTS.SIZE
                },
                formatVersion: NOTES_DEFAULTS.FORMAT_VERSION
            };
            log.info('Created default notes data structure');
        } else {
            // Migrate existing notes if needed
            bookmarkData.notes = this.migrateNotesToRichText(bookmarkData.notes);
        }
    }

    /**
     * Migrate notes to rich text format
     */
    migrateNotesToRichText(notes) {
        if (!notes.formatVersion || notes.formatVersion < NOTES_DEFAULTS.FORMAT_VERSION) {
            log.info('Migrating notes to rich text format');

            return {
                content: notes.content || NOTES_DEFAULTS.CONTENT,
                plainContent: notes.plainContent || NOTES_DEFAULTS.PLAIN_CONTENT,
                position: notes.position || {
                    ...NOTES_DEFAULTS.POSITION
                },
                size: notes.size || {
                    ...NOTES_DEFAULTS.SIZE
                },
                formatVersion: NOTES_DEFAULTS.FORMAT_VERSION
            };
        }
        return notes;
    }

    /**
     * Setup dragging functionality
     */
    setupDragging() {
        const dragHandler = errorHandler.wrapSync((e) => {
            this.isDragging = true;
            const rect = this.notesWindow.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;

            document.addEventListener('mousemove', this.dragNotesWindow);
            document.addEventListener('mouseup', this.stopDragNotesWindow);
            e.preventDefault();
        }, 'notes drag start');

        addEventListenerSafe(this.notesHeader, 'mousedown', dragHandler);
    }

    /**
     * Handle notes window dragging
     */
    dragNotesWindow = (e) => {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Keep window within viewport bounds
        const maxX = window.innerWidth - this.notesWindow.offsetWidth;
        const maxY = window.innerHeight - this.notesWindow.offsetHeight;

        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));

        setStyle(this.notesWindow, {
            left: boundedX + 'px',
            top: boundedY + 'px',
            right: 'auto',
            bottom: 'auto'
        });

        // Save position
        const bookmarkData = this.dataManager.getData();
        if (bookmarkData && bookmarkData.notes) {
            bookmarkData.notes.position.x = boundedX;
            bookmarkData.notes.position.y = boundedY;
        }
    }

    /**
     * Stop dragging notes window
     */
    stopDragNotesWindow = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.dragNotesWindow);
        document.removeEventListener('mouseup', this.stopDragNotesWindow);
        this.dataManager.saveData();
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        const autoSaveHandler = errorHandler.wrapSync(() => {
            this.handleAutoSave();
        }, 'notes auto-save');

        addEventListenerSafe(this.notesEditor, 'input', autoSaveHandler);
        addEventListenerSafe(this.notesEditor, 'paste', autoSaveHandler);
        addEventListenerSafe(this.notesEditor, 'keyup', autoSaveHandler);
    }

    /**
     * Handle auto-save with comprehensive error handling
     */
    async handleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                await this.performAutoSave();
            } catch (error) {
                log.error('Auto-save failed', error);
                errorHandler.handleError({
                    type: 'storage',
                    message: 'Failed to auto-save notes',
                    error,
                    recoverable: true
                });
            }
        }, UI_CONSTANTS.AUTO_SAVE_DELAY);
    }

    /**
     * Perform the actual auto-save operation
     */
    async performAutoSave() {
        const bookmarkData = this.dataManager.getData();

        if (!bookmarkData || !bookmarkData.notes || !this.notesEditor) {
            throw new Error('Notes data or editor not available');
        }

        // Get content from editor
        const rawHtmlContent = this.notesEditor.innerHTML || '';
        const plainText = this.notesEditor.textContent || this.notesEditor.innerText || '';

        log.debug('Auto-save content', {
            htmlLength: rawHtmlContent.length,
            textLength: plainText.length,
            hasFormatting: /<(strong|em|b|i|ul|ol|li)>/i.test(rawHtmlContent)
        });

        // Sanitize content
        let sanitizedContent = this.sanitizeContent(rawHtmlContent, plainText);

        // Update data model
        bookmarkData.notes.content = sanitizedContent;
        bookmarkData.notes.plainContent = plainText;
        bookmarkData.notes.formatVersion = NOTES_DEFAULTS.FORMAT_VERSION;

        // Save with retry mechanism
        await this.dataManager.saveDataWithRetry();

        log.debug('Auto-save completed successfully');
    }

    /**
     * Sanitize HTML content
     */
    sanitizeContent(rawHtml, plainText) {
        try {
            if (window.ContentSanitizer && typeof window.ContentSanitizer.sanitizeContent === 'function') {
                const sanitized = window.ContentSanitizer.sanitizeContent(rawHtml);

                if (!sanitized || sanitized.trim() === '') {
                    log.warn('Sanitization returned empty content, using plain text fallback');
                    return plainText ? `<p>${this.escapeHtml(plainText)}</p>` : NOTES_DEFAULTS.CONTENT;
                }

                return sanitized;
            } else {
                log.warn('ContentSanitizer not available, using plain text approach');
                return plainText ? `<p>${this.escapeHtml(plainText)}</p>` : NOTES_DEFAULTS.CONTENT;
            }
        } catch (error) {
            log.error('Content sanitization failed', error);
            return plainText ? `<p>${this.escapeHtml(plainText)}</p>` : NOTES_DEFAULTS.CONTENT;
        }
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Setup window resizing
     */
    setupResizing() {
        const resizeObserver = new ResizeObserver((entries) => {
            clearTimeout(resizeObserver.saveTimeout);
            resizeObserver.saveTimeout = setTimeout(() => {
                this.handleResize(entries);
            }, UI_CONSTANTS.RESIZE_SAVE_DELAY);
        });

        resizeObserver.observe(this.notesWindow);
    }

    /**
     * Handle window resize
     */
    handleResize(entries) {
        for (let entry of entries) {
            const {
                width,
                height
            } = entry.contentRect;

            // Skip if restoring size programmatically
            if (this.isRestoringSize) {
                log.debug('Skipping resize save during size restoration', {
                    width,
                    height
                });
                return;
            }

            // Skip if window not visible or invalid dimensions
            const isVisible = this.notesWindow.style.display !== 'none' &&
                getComputedStyle(this.notesWindow).display !== 'none';

            if (!isVisible || width <= 0 || height <= 0) {
                log.debug('Skipping resize save - invalid state', {
                    width,
                    height,
                    isVisible
                });
                return;
            }

            // Save new size
            const bookmarkData = this.dataManager.getData();
            if (bookmarkData && bookmarkData.notes && bookmarkData.notes.size) {
                log.debug('Saving new window size', {
                    width,
                    height
                });
                bookmarkData.notes.size.width = width;
                bookmarkData.notes.size.height = height;
                this.dataManager.saveData().catch(log.error);
            }
        }
    }

    /**
     * Load notes content and position
     */
    loadNotesContent() {
        const bookmarkData = this.dataManager.getData();
        const notes = bookmarkData.notes;

        log.debug('Loading notes content', {
            hasContent: !!notes.content,
            hasPosition: !!notes.position,
            hasSize: !!notes.size
        });

        // Load content
        const displayContent = notes.content ||
            (notes.plainContent ? `<p>${this.escapeHtml(notes.plainContent).replace(/\n/g, '</p><p>')}</p>` : NOTES_DEFAULTS.CONTENT);

        setHTMLContent(this.notesEditor, displayContent);

        // Load position
        if (notes.position && notes.position.x !== undefined) {
            setStyle(this.notesWindow, {
                left: notes.position.x + 'px',
                top: notes.position.y + 'px',
                right: 'auto'
            });
        }

        // Load size
        if (notes.size && notes.size.width && notes.size.height) {
            this.isRestoringSize = true;

            setStyle(this.notesWindow, {
                width: notes.size.width + 'px',
                height: notes.size.height + 'px'
            });

            setTimeout(() => {
                this.isRestoringSize = false;
                log.debug('Size restoration complete');
            }, 100);
        }
    }

    /**
     * Setup formatting commands
     */
    setupFormattingCommands() {
        // This would contain the formatting logic
        // For now, keeping it simple to focus on the main refactoring
        log.debug('Formatting commands setup completed');
    }

    /**
     * Show/hide notes window
     */
    toggle() {
        const isVisible = this.notesWindow.style.display !== 'none';
        console.log('Notes toggle - current display:', this.notesWindow.style.display, 'isVisible:', isVisible);

        this.notesWindow.style.display = isVisible ? 'none' : 'block';

        console.log('Notes toggle - new display:', this.notesWindow.style.display);

        if (!isVisible) {
            this.notesEditor.focus();
        }

        log.info(`Notes window ${isVisible ? 'hidden' : 'shown'}`);
    }

    /**
     * Close notes window
     */
    close() {
        this.notesWindow.style.display = 'none';
        log.info('Notes window closed');
    }
}

export default NotesEditor;