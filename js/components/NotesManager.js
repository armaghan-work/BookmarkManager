/**
 * Notes Manager Component
 * Handles all notes window functionality including rich text editing,
 * formatting, auto-save, and window management.
 */

class NotesManager {
    constructor() {
        this.notesWindow = null;
        this.notesEditor = null;
        this.saveTimeout = null;
        this.isRestoringSize = false;
        this.resizeObserver = null;

        // Bind methods to maintain context
        this.handleAutoSave = this.handleAutoSave.bind(this);
        this.dragNotesWindow = this.dragNotesWindow.bind(this);
        this.stopDragNotesWindow = this.stopDragNotesWindow.bind(this);
    }

    /**
     * Initialize the notes window and set up all functionality
     */
    initialize() {
        this.notesWindow = document.getElementById('notesWindow');
        this.notesEditor = document.getElementById('notesEditor');

        if (!this.notesWindow || !this.notesEditor) {
            console.error('Notes window elements not found');
            return false;
        }

        this.ensureNotesDataStructure();
        this.setupDragging();
        this.setupAutoSave();
        this.setupResizing();
        this.loadContent();
        this.setupFormattingCommands();
        this.setupKeyboardShortcuts();

        return true;
    }

    /**
     * Ensure the notes data structure exists with proper format
     */
    ensureNotesDataStructure() {
        if (!bookmarkData.notes) {
            bookmarkData.notes = {
                content: '<p></p>',
                plainContent: '',
                position: {
                    x: 50,
                    y: 100
                },
                size: {
                    width: 300,
                    height: 400
                },
                formatVersion: '1.0'
            };
        } else {
            // Migrate existing notes to enhanced format
            bookmarkData.notes = this.migrateNotesToRichText(bookmarkData.notes);
        }
    }

    /**
     * Set up window dragging functionality
     */
    setupDragging() {
        const notesHeader = document.getElementById('notesHeader');
        if (!notesHeader) return;

        let isDragging = false;
        let dragOffset = {
            x: 0,
            y: 0
        };

        notesHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = this.notesWindow.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;

            document.addEventListener('mousemove', this.dragNotesWindow);
            document.addEventListener('mouseup', this.stopDragNotesWindow);
            e.preventDefault();
        });

        this.isDragging = () => isDragging;
        this.setDragging = (value) => {
            isDragging = value;
        };
        this.getDragOffset = () => dragOffset;
    }

    /**
     * Handle window dragging
     */
    dragNotesWindow(e) {
        if (!this.isDragging()) return;

        const offset = this.getDragOffset();
        const x = e.clientX - offset.x;
        const y = e.clientY - offset.y;

        // Keep window within viewport bounds
        const maxX = window.innerWidth - this.notesWindow.offsetWidth;
        const maxY = window.innerHeight - this.notesWindow.offsetHeight;

        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));

        this.notesWindow.style.left = boundedX + 'px';
        this.notesWindow.style.top = boundedY + 'px';
        this.notesWindow.style.right = 'auto';
        this.notesWindow.style.bottom = 'auto';

        // Save position
        if (bookmarkData ? .notes) {
            bookmarkData.notes.position.x = boundedX;
            bookmarkData.notes.position.y = boundedY;
        }
    }

    /**
     * Stop window dragging
     */
    stopDragNotesWindow() {
        this.setDragging(false);
        document.removeEventListener('mousemove', this.dragNotesWindow);
        document.removeEventListener('mouseup', this.stopDragNotesWindow);
        this.saveData();
    }

    /**
     * Set up auto-save functionality
     */
    setupAutoSave() {
        this.notesEditor.addEventListener('input', this.handleAutoSave);
        this.notesEditor.addEventListener('paste', this.handleAutoSave);
        this.notesEditor.addEventListener('keyup', this.handleAutoSave);
    }

    /**
     * Handle auto-save with comprehensive error handling
     */
    async handleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                if (!bookmarkData ? .notes || !this.notesEditor) {
                    console.warn('Auto-save skipped: missing data or editor');
                    return;
                }

                // Get content with error handling
                let rawHtmlContent, plainText;
                try {
                    rawHtmlContent = this.notesEditor.innerHTML || '';
                    plainText = this.notesEditor.textContent || this.notesEditor.innerText || '';
                } catch (contentError) {
                    console.error('Failed to get content from editor:', contentError);
                    return;
                }

                // Sanitize content
                let sanitizedContent;
                try {
                    if (window.ContentSanitizer ? .sanitizeContent) {
                        sanitizedContent = window.ContentSanitizer.sanitizeContent(rawHtmlContent);

                        if (!sanitizedContent || sanitizedContent.trim() === '') {
                            sanitizedContent = plainText ? `<p>${this.escapeHtml(plainText)}</p>` : '<p></p>';
                        }
                    } else {
                        sanitizedContent = plainText ? `<p>${this.escapeHtml(plainText)}</p>` : '<p></p>';
                    }
                } catch (sanitizationError) {
                    console.error('Content sanitization failed:', sanitizationError);
                    sanitizedContent = plainText ? `<p>${this.escapeHtml(plainText)}</p>` : '<p></p>';
                }

                // Update data model
                bookmarkData.notes.content = sanitizedContent;
                bookmarkData.notes.plainContent = plainText;
                bookmarkData.notes.formatVersion = '1.0';

                // Save data
                await this.saveData();

            } catch (error) {
                console.error('Auto-save failed:', error);
                // Emergency fallback
                try {
                    const emergencyText = this.notesEditor ? .textContent || '';
                    bookmarkData.notes.content = emergencyText ? `<p>${this.escapeHtml(emergencyText)}</p>` : '<p></p>';
                    bookmarkData.notes.plainContent = emergencyText;
                    await this.saveData();
                } catch (emergencyError) {
                    console.error('Emergency save failed:', emergencyError);
                }
            }
        }, 1000);
    }

    /**
     * Set up window resizing functionality
     */
    setupResizing() {
        this.resizeObserver = new ResizeObserver((entries) => {
            clearTimeout(this.resizeObserver.saveTimeout);
            this.resizeObserver.saveTimeout = setTimeout(() => {
                for (let entry of entries) {
                    const {
                        width,
                        height
                    } = entry.contentRect;

                    if (this.isRestoringSize || width <= 0 || height <= 0) {
                        return;
                    }

                    const isVisible = this.notesWindow.style.display !== 'none' &&
                        getComputedStyle(this.notesWindow).display !== 'none';

                    if (!isVisible) return;

                    if (bookmarkData ? .notes ? .size) {
                        bookmarkData.notes.size.width = width;
                        bookmarkData.notes.size.height = height;
                        this.saveData().catch(console.error);
                    }
                }
            }, 500);
        });

        this.resizeObserver.observe(this.notesWindow);
    }

    /**
     * Load saved content and restore window position/size
     */
    loadContent() {
        // Load content
        const displayContent = bookmarkData.notes ? .content ||
            (bookmarkData.notes ? .plainContent ?
                `<p>${this.escapeHtml(bookmarkData.notes.plainContent).replace(/\n/g, '</p><p>')}</p>` :
                '<p></p>');

        this.notesEditor.innerHTML = displayContent;

        // Restore position
        if (bookmarkData.notes ? .position) {
            this.notesWindow.style.left = bookmarkData.notes.position.x + 'px';
            this.notesWindow.style.top = bookmarkData.notes.position.y + 'px';
            this.notesWindow.style.right = 'auto';
        }

        // Restore size
        if (bookmarkData.notes ? .size ? .width && bookmarkData.notes ? .size ? .height) {
            this.isRestoringSize = true;
            this.notesWindow.style.width = bookmarkData.notes.size.width + 'px';
            this.notesWindow.style.height = bookmarkData.notes.size.height + 'px';

            setTimeout(() => {
                this.isRestoringSize = false;
            }, 100);
        }
    }

    /**
     * Set up formatting commands and toolbar
     */
    setupFormattingCommands() {
        const formatCommands = {
            bold: () => this.executeCommand('bold'),
            italic: () => this.executeCommand('italic'),
            removeFormat: () => this.executeCommand('removeFormat'),
            insertUnorderedList: () => this.executeCommand('insertUnorderedList'),
            insertOrderedList: () => this.executeCommand('insertOrderedList')
        };

        // Set up toolbar button event listeners
        document.querySelectorAll('.toolbar-btn').forEach(button => {
            const command = button.getAttribute('data-command');
            if (formatCommands[command]) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    formatCommands[command]();
                    this.notesEditor.focus();
                });
            }
        });

        // Set up selection change listener for button states
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.notesEditor) {
                this.updateToolbarButtonStates();
            }
        });
    }

    /**
     * Execute a formatting command with error handling
     */
    executeCommand(command) {
        try {
            if (!this.ensureEditorFunctionality()) {
                throw new Error('Editor is not functional');
            }

            const result = document.execCommand(command, false, null);
            if (!result) {
                console.warn(`ExecCommand ${command} returned false`);
            }
        } catch (error) {
            console.error(`Formatting command '${command}' failed:`, error);
            this.handleFormattingError(command, error);
        }
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.notesEditor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.executeCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.executeCommand('italic');
                        break;
                }
            }
        });
    }

    /**
     * Update toolbar button states based on current selection
     */
    updateToolbarButtonStates() {
        const commands = ['bold', 'italic'];

        commands.forEach(command => {
            const button = document.querySelector(`.toolbar-btn[data-command="${command}"]`);
            if (button) {
                try {
                    const isActive = document.queryCommandState(command);
                    button.classList.toggle('active', isActive);
                } catch (error) {
                    // Ignore queryCommandState errors
                }
            }
        });
    }

    /**
     * Show the notes window
     */
    show() {
        this.notesWindow.style.display = 'block';
    }

    /**
     * Hide the notes window
     */
    hide() {
        this.notesWindow.style.display = 'none';
    }

    /**
     * Toggle notes window visibility
     */
    toggle() {
        if (this.notesWindow.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Utility methods
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    ensureEditorFunctionality() {
        try {
            return this.notesEditor &&
                this.notesEditor.isContentEditable &&
                this.notesEditor.focus;
        } catch (error) {
            return false;
        }
    }

    handleFormattingError(command, error) {
        console.error(`Formatting error for ${command}:`, error);
        // Could implement fallback mechanisms here
    }

    migrateNotesToRichText(notes) {
        if (!notes.formatVersion || notes.formatVersion < '1.0') {
            let htmlContent = '<p></p>';
            let plainContent = '';

            if (notes.content && typeof notes.content === 'string') {
                plainContent = notes.content;
                htmlContent = notes.content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => `<p>${this.escapeHtml(line)}</p>`)
                    .join('') || '<p></p>';
            }

            return {
                ...notes,
                content: htmlContent,
                plainContent: plainContent,
                formatVersion: '1.0'
            };
        }

        return notes;
    }

    async saveData() {
        if (typeof saveData === 'function') {
            return await saveData();
        } else if (typeof window.saveData === 'function') {
            return await window.saveData();
        } else {
            console.warn('saveData function not available');
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        clearTimeout(this.saveTimeout);

        // Remove event listeners
        document.removeEventListener('mousemove', this.dragNotesWindow);
        document.removeEventListener('mouseup', this.stopDragNotesWindow);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotesManager;
} else {
    window.NotesManager = NotesManager;
}