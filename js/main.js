        let bookmarkData = {
            folders: [],
            links: [],
            notes: {
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
            }
        };
        let currentEditId = null;
        let currentFolder = null;
        let searchTerm = '';

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadData(); // This will call setupNotesWindow() after data is loaded
            setupSearch();
            setupDragAndDrop();
            setupSidebarResizer();
            setupGlobalKeyboardShortcuts();
        });

        // Notes functionality
        function setupNotesWindow() {
            const notesWindow = document.getElementById('notesWindow');
            const notesHeader = document.getElementById('notesHeader');
            const notesEditor = document.getElementById('notesEditor');

            // Safety check - ensure notes object exists with enhanced data model
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
                // Ensure existing notes are migrated to enhanced format
                bookmarkData.notes = migrateNotesToRichText(bookmarkData.notes);
            }

            // Make notes window draggable
            let isDragging = false;
            let dragOffset = {
                x: 0,
                y: 0
            };

            notesHeader.addEventListener('mousedown', function(e) {
                isDragging = true;
                const rect = notesWindow.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;

                document.addEventListener('mousemove', dragNotesWindow);
                document.addEventListener('mouseup', stopDragNotesWindow);
                e.preventDefault();
            });

            function dragNotesWindow(e) {
                if (!isDragging) return;

                const x = e.clientX - dragOffset.x;
                const y = e.clientY - dragOffset.y;

                // Keep window within viewport bounds
                const maxX = window.innerWidth - notesWindow.offsetWidth;
                const maxY = window.innerHeight - notesWindow.offsetHeight;

                const boundedX = Math.max(0, Math.min(x, maxX));
                const boundedY = Math.max(0, Math.min(y, maxY));

                notesWindow.style.left = boundedX + 'px';
                notesWindow.style.top = boundedY + 'px';
                notesWindow.style.right = 'auto';
                notesWindow.style.bottom = 'auto';

                // Save position safely
                if (bookmarkData && bookmarkData.notes) {
                    bookmarkData.notes.position.x = boundedX;
                    bookmarkData.notes.position.y = boundedY;
                }
            }

            function stopDragNotesWindow() {
                isDragging = false;
                document.removeEventListener('mousemove', dragNotesWindow);
                document.removeEventListener('mouseup', stopDragNotesWindow);
                saveData();
            }

            // Auto-save notes content with sanitization
            let saveTimeout;

            // Enhanced auto-save function with comprehensive error handling and fallback mechanisms
            function handleAutoSave() {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    // Pre-flight checks
                    if (!bookmarkData || !bookmarkData.notes) {
                        console.error('Auto-save failed: bookmarkData or notes object not available');
                        return;
                    }

                    if (!notesEditor) {
                        console.error('Auto-save failed: notes editor not available');
                        return;
                    }

                    try {
                        // Check if editor is still functional
                        if (!ensureEditorFunctionality()) {
                            console.warn('Editor functionality compromised during auto-save, attempting recovery');
                            // Try to recover editor functionality
                            try {
                                notesEditor.contentEditable = true;
                                if (!notesEditor.isContentEditable) {
                                    throw new Error('Cannot restore contentEditable functionality');
                                }
                            } catch (recoveryError) {
                                console.error('Failed to recover editor functionality:', recoveryError);
                                switchToPlainTextMode('Editor became non-functional during auto-save');
                                return;
                            }
                        }

                        // Get content from contentEditable div with error handling
                        let rawHtmlContent, plainText;
                        try {
                            rawHtmlContent = notesEditor.innerHTML || '';
                            plainText = notesEditor.textContent || notesEditor.innerText || '';
                        } catch (contentError) {
                            console.error('Failed to get content from editor:', contentError);
                            // Try alternative methods to get content
                            try {
                                rawHtmlContent = notesEditor.outerHTML || '';
                                plainText = notesEditor.textContent || '';
                            } catch (alternativeError) {
                                console.error('Alternative content extraction failed:', alternativeError);
                                // Use recovery mechanism for corrupted content
                                const recovery = recoverCorruptedContent(bookmarkData.notes.content, alternativeError);
                                rawHtmlContent = recovery.content;
                                plainText = recovery.plainContent;
                            }
                        }

                        console.log('Auto-save: Raw HTML from editor:', rawHtmlContent);
                        console.log('Auto-save: Plain text from editor:', plainText);

                        // Debug: Check if content has formatting
                        const hasFormatting = /<(strong|em|b|i|ul|ol|li)>/i.test(rawHtmlContent);
                        console.log('Auto-save: Content has formatting:', hasFormatting);

                        // Sanitize HTML content before saving with comprehensive error handling
                        let sanitizedContent;
                        try {
                            if (window.ContentSanitizer && typeof window.ContentSanitizer.sanitizeContent === 'function') {
                                // Skip validation for now and go directly to sanitization
                                console.log('Auto-save: Raw HTML content:', rawHtmlContent);
                                sanitizedContent = window.ContentSanitizer.sanitizeContent(rawHtmlContent);
                                console.log('Auto-save: After sanitization:', sanitizedContent);

                                // If sanitization returns empty content, fallback to plain text wrapped in paragraph
                                if (!sanitizedContent || sanitizedContent.trim() === '') {
                                    console.warn('Auto-save: Sanitization returned empty content, using plain text fallback');
                                    sanitizedContent = plainText ? `<p>${escapeHtml(plainText)}</p>` : '<p></p>';
                                    console.log('Auto-save: Used fallback content after empty sanitization:', sanitizedContent);
                                }
                            } else {
                                // Fallback if sanitizer is not available - use plain text approach
                                console.warn('ContentSanitizer not available, falling back to plain text storage');
                                sanitizedContent = plainText ? `<p>${escapeHtml(plainText)}</p>` : '<p></p>';
                            }
                        } catch (sanitizationError) {
                            console.error('Content sanitization failed:', sanitizationError);
                            // Use recovery mechanism for corrupted content
                            const recovery = recoverCorruptedContent(rawHtmlContent, sanitizationError);
                            sanitizedContent = recovery.content;
                            plainText = recovery.plainContent;
                        }

                        // Update the data model with sanitized content
                        try {
                            bookmarkData.notes.content = sanitizedContent;
                            bookmarkData.notes.plainContent = plainText;
                            bookmarkData.notes.formatVersion = '1.0';

                            console.log('Auto-save: Saving HTML content:', sanitizedContent);
                            console.log('Auto-save: Saving plain content:', plainText);

                            // Debug: Show what's actually being saved
                            console.log('Auto-save: Final data model content:', {
                                htmlContent: bookmarkData.notes.content,
                                plainContent: bookmarkData.notes.plainContent,
                                hasHtmlFormatting: /<(strong|em|b|i|ul|ol|li)>/i.test(bookmarkData.notes.content)
                            });
                        } catch (dataUpdateError) {
                            console.error('Failed to update data model:', dataUpdateError);
                            throw new Error(`Data model update failed: ${dataUpdateError.message}`);
                        }

                        // Save the data with retry mechanism
                        let saveAttempts = 0;
                        const maxSaveAttempts = 3;

                        while (saveAttempts < maxSaveAttempts) {
                            try {
                                await saveData();
                                console.log(`Auto-save successful on attempt ${saveAttempts + 1}`);
                                break;
                            } catch (saveError) {
                                saveAttempts++;
                                console.warn(`Auto-save attempt ${saveAttempts} failed:`, saveError);

                                if (saveAttempts >= maxSaveAttempts) {
                                    throw new Error(`All ${maxSaveAttempts} save attempts failed: ${saveError.message}`);
                                }

                                // Wait before retrying (exponential backoff)
                                await new Promise(resolve => setTimeout(resolve, Math.pow(2, saveAttempts) * 100));
                            }
                        }

                        // FIXED: Do not update editor content during auto-save to prevent cursor jumping
                        // The sanitized content is saved to the data model, but we don't update the editor
                        // during typing to avoid cursor position issues. The editor will be updated only
                        // when loading content from storage or when explicitly needed.

                    } catch (error) {
                        console.error('Auto-save failed with comprehensive error:', error);

                        // Log detailed error information for debugging
                        console.error('Auto-save error details:', {
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                            timestamp: new Date().toISOString(),
                            editorState: {
                                exists: !!notesEditor,
                                isContentEditable: notesEditor ? notesEditor.isContentEditable : false,
                                hasContent: notesEditor ? !!notesEditor.innerHTML : false
                            }
                        });

                        // Attempt emergency fallback: save as plain text if HTML processing fails
                        try {
                            console.log('Attempting emergency fallback save...');
                            const emergencyPlainText = (notesEditor ? notesEditor.textContent : '') || (notesEditor ? notesEditor.innerText : '') || (bookmarkData.notes ? bookmarkData.notes.plainContent : '') || '';

                            bookmarkData.notes.content = emergencyPlainText ? `<p>${escapeHtml(emergencyPlainText)}</p>` : '<p></p>';
                            bookmarkData.notes.plainContent = emergencyPlainText;
                            bookmarkData.notes.formatVersion = 'emergency-fallback';

                            await saveData();
                            console.log('Emergency fallback save successful');

                        } catch (emergencyError) {
                            console.error('Emergency fallback save failed:', emergencyError);

                            // Last resort - switch to plain text mode
                            switchToPlainTextMode(`Auto-save completely failed: ${error.message}. Emergency save also failed: ${emergencyError.message}`);
                        }
                    }
                }, 1000); // Maintain the existing 1-second auto-save delay for optimal performance
            }

            // Add event listeners for contentEditable input events
            notesEditor.addEventListener('input', handleAutoSave);
            notesEditor.addEventListener('paste', handleAutoSave);
            notesEditor.addEventListener('keyup', handleAutoSave);

            // Save size when window is resized
            let isRestoringSize = false; // Flag to prevent saving during programmatic size restoration

            const resizeObserver = new ResizeObserver(function(entries) {
                clearTimeout(resizeObserver.saveTimeout);
                resizeObserver.saveTimeout = setTimeout(() => {
                    for (let entry of entries) {
                        const {
                            width,
                            height
                        } = entry.contentRect;

                        // Skip saving if we're programmatically restoring the size
                        if (isRestoringSize) {
                            console.log('Skipping resize save during size restoration:', {
                                width,
                                height
                            });
                            return;
                        }

                        // Skip saving if window is not visible or has invalid dimensions
                        const isWindowVisible = notesWindow.style.display !== 'none' &&
                            getComputedStyle(notesWindow).display !== 'none';

                        if (!isWindowVisible || width <= 0 || height <= 0) {
                            console.log('Skipping resize save - window not visible or invalid size:', {
                                width,
                                height,
                                isVisible: isWindowVisible
                            });
                            return;
                        }

                        if (bookmarkData && bookmarkData.notes && bookmarkData.notes.size) {
                            console.log('User resized window - Saving new size:', {
                                width,
                                height
                            });
                            bookmarkData.notes.size.width = width;
                            bookmarkData.notes.size.height = height;
                            console.log('Updated bookmarkData.notes.size:', bookmarkData.notes.size);
                            saveData().catch(console.error);
                        } else {
                            console.log('Cannot save window size - missing data structure:', {
                                hasBookmarkData: !!bookmarkData,
                                hasNotes: !!(bookmarkData && bookmarkData.notes),
                                hasSize: !!(bookmarkData && bookmarkData.notes && bookmarkData.notes.size)
                            });
                        }
                    }
                }, 500);
            });

            resizeObserver.observe(notesWindow);

            // Load saved notes content and position
            // Use HTML content for contentEditable display, fallback to plainContent if content doesn't exist (backward compatibility)
            console.log('Loading notes - Raw data:', bookmarkData.notes);
            const displayContent = (bookmarkData.notes && bookmarkData.notes.content) ?
                bookmarkData.notes.content :
                (bookmarkData.notes && bookmarkData.notes.plainContent) ?
                `<p>${escapeHtml(bookmarkData.notes.plainContent).replace(/\n/g, '</p><p>')}</p>` :
                '<p></p>';
            console.log('Display content:', displayContent);
            notesEditor.innerHTML = displayContent;

            if (bookmarkData.notes && bookmarkData.notes.position && bookmarkData.notes.position.x !== undefined) {
                notesWindow.style.left = bookmarkData.notes.position.x + 'px';
                notesWindow.style.top = bookmarkData.notes.position.y + 'px';
                notesWindow.style.right = 'auto';
            }
            if (bookmarkData.notes && bookmarkData.notes.size && bookmarkData.notes.size.width && bookmarkData.notes.size.height) {
                console.log('Loading saved window size:', bookmarkData.notes.size);

                // Set flag to prevent ResizeObserver from saving during restoration
                isRestoringSize = true;

                notesWindow.style.width = bookmarkData.notes.size.width + 'px';
                notesWindow.style.height = bookmarkData.notes.size.height + 'px';

                // Reset flag after a short delay to allow ResizeObserver to process
                setTimeout(() => {
                    isRestoringSize = false;
                    console.log('Size restoration complete - ResizeObserver saves now enabled');
                }, 100);
                console.log('Applied window size - Width:', notesWindow.style.width, 'Height:', notesWindow.style.height);
            } else {
                console.log('No saved size found or incomplete size data:', bookmarkData.notes && bookmarkData.notes.size ? bookmarkData.notes.size : 'undefined');
            }

            // Setup formatting commands
            setupFormattingCommands();
        }

        // Core formatting command handlers with comprehensive error handling
        function setupFormattingCommands() {
            const notesEditor = document.getElementById('notesEditor');

            // Check if contentEditable is supported and functional
            function isContentEditableSupported() {
                try {
                    const testDiv = document.createElement('div');
                    testDiv.contentEditable = true;
                    return testDiv.isContentEditable === true;
                } catch (error) {
                    console.error('ContentEditable support check failed:', error);
                    return false;
                }
            }

            // Check if execCommand is supported for a specific command
            function isExecCommandSupported(command) {
                try {
                    return document.queryCommandSupported && document.queryCommandSupported(command);
                } catch (error) {
                    console.warn(`ExecCommand support check failed for ${command}:`, error);
                    return false;
                }
            }

            // Enhanced error recovery mechanism
            function handleFormattingError(command, error, fallbackFunction) {
                console.error(`Formatting command '${command}' failed:`, error);

                // Log detailed error information for debugging
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    command: command,
                    timestamp: new Date().toISOString()
                });

                // Attempt fallback mechanism
                try {
                    if (typeof fallbackFunction === 'function') {
                        console.log(`Attempting fallback for command: ${command}`);
                        fallbackFunction();
                    } else {
                        console.warn(`No fallback function available for command: ${command}`);
                        // Generic fallback - ensure editor remains functional
                        ensureEditorFunctionality();
                    }
                } catch (fallbackError) {
                    console.error(`Fallback mechanism failed for ${command}:`, fallbackError);
                    // Last resort - switch to plain text mode
                    switchToPlainTextMode(`Fallback failed for ${command}: ${fallbackError.message}`);
                }
            }

            // Format commands object with comprehensive error handling
            const formatCommands = {
                bold: function() {
                    try {
                        // Pre-flight checks
                        if (!isContentEditableSupported()) {
                            throw new Error('ContentEditable not supported');
                        }

                        if (!isExecCommandSupported('bold')) {
                            console.warn('ExecCommand bold not supported, using fallback');
                            fallbackFormatting('bold');
                            return;
                        }

                        // Ensure editor is focused and functional
                        if (!ensureEditorFunctionality()) {
                            throw new Error('Editor is not functional');
                        }

                        const result = document.execCommand('bold', false, null);
                        console.log('Bold execCommand result:', result);

                        // Debug: Check what happened to the content immediately after execCommand
                        setTimeout(() => {
                            const htmlAfter = notesEditor.innerHTML;
                            const textAfter = notesEditor.textContent;
                            console.log('After bold execCommand - HTML:', htmlAfter);
                            console.log('After bold execCommand - Text:', textAfter);
                            console.log('After bold execCommand - Has <strong> tags:', htmlAfter.includes('<strong>'));
                            console.log('After bold execCommand - Has <b> tags:', htmlAfter.includes('<b>'));
                        }, 50);

                        if (!result) {
                            console.warn('ExecCommand bold returned false, attempting fallback');
                            fallbackFormatting('bold');
                            return;
                        }

                        notesEditor.focus();
                    } catch (error) {
                        handleFormattingError('bold', error, () => fallbackFormatting('bold'));
                    }
                },

                italic: function() {
                    try {
                        // Pre-flight checks
                        if (!isContentEditableSupported()) {
                            throw new Error('ContentEditable not supported');
                        }

                        if (!isExecCommandSupported('italic')) {
                            console.warn('ExecCommand italic not supported, using fallback');
                            fallbackFormatting('italic');
                            return;
                        }

                        // Ensure editor is focused and functional
                        if (!ensureEditorFunctionality()) {
                            throw new Error('Editor is not functional');
                        }

                        const result = document.execCommand('italic', false, null);
                        console.log('Italic execCommand result:', result);

                        // Debug: Check what happened to the content immediately after execCommand
                        setTimeout(() => {
                            const htmlAfter = notesEditor.innerHTML;
                            const textAfter = notesEditor.textContent;
                            console.log('After italic execCommand - HTML:', htmlAfter);
                            console.log('After italic execCommand - Text:', textAfter);
                            console.log('After italic execCommand - Has <em> tags:', htmlAfter.includes('<em>'));
                            console.log('After italic execCommand - Has <i> tags:', htmlAfter.includes('<i>'));

                            // Check for any italic-related tags or styles
                            const hasItalicStyle = htmlAfter.includes('font-style') || htmlAfter.includes('italic');
                            console.log('After italic execCommand - Has italic style:', hasItalicStyle);

                            // Show all HTML tags present
                            const tags = htmlAfter.match(/<[^>]+>/g);
                            console.log('After italic execCommand - All HTML tags found:', tags);
                        }, 50);

                        if (!result) {
                            console.warn('ExecCommand italic returned false, attempting fallback');
                            fallbackFormatting('italic');
                            return;
                        }

                        notesEditor.focus();
                    } catch (error) {
                        handleFormattingError('italic', error, () => fallbackFormatting('italic'));
                    }
                },

                removeFormat: function() {
                    try {
                        // Pre-flight checks
                        if (!isContentEditableSupported()) {
                            throw new Error('ContentEditable not supported');
                        }

                        if (!isExecCommandSupported('removeFormat')) {
                            console.warn('ExecCommand removeFormat not supported, using fallback');
                            fallbackRemoveFormat();
                            return;
                        }

                        // Ensure editor is focused and functional
                        if (!ensureEditorFunctionality()) {
                            throw new Error('Editor is not functional');
                        }

                        const result = document.execCommand('removeFormat', false, null);
                        if (!result) {
                            console.warn('ExecCommand removeFormat returned false, attempting fallback');
                            fallbackRemoveFormat();
                            return;
                        }

                        notesEditor.focus();
                    } catch (error) {
                        handleFormattingError('removeFormat', error, () => fallbackRemoveFormat());
                    }
                },

                insertUnorderedList: function() {
                    try {
                        // Pre-flight checks
                        if (!isContentEditableSupported()) {
                            throw new Error('ContentEditable not supported');
                        }

                        if (!isExecCommandSupported('insertUnorderedList')) {
                            console.warn('ExecCommand insertUnorderedList not supported, using fallback');
                            fallbackFormatting('insertUnorderedList');
                            return;
                        }

                        // Ensure editor is focused and functional
                        if (!ensureEditorFunctionality()) {
                            throw new Error('Editor is not functional');
                        }

                        console.log('insertUnorderedList: Starting...');

                        // Ensure there's a proper selection/cursor position
                        const selection = window.getSelection();
                        if (selection.rangeCount === 0) {
                            // Create a range at the end of the editor
                            const range = document.createRange();
                            range.selectNodeContents(notesEditor);
                            range.collapse(false); // Collapse to end
                            selection.removeAllRanges();
                            selection.addRange(range);
                            console.log('insertUnorderedList: Created selection at end');
                        }

                        console.log('insertUnorderedList: About to call execCommand');
                        const result = document.execCommand('insertUnorderedList', false, null);
                        console.log('insertUnorderedList: execCommand result:', result);

                        if (!result) {
                            console.warn('ExecCommand insertUnorderedList returned false, attempting fallback');
                            fallbackFormatting('insertUnorderedList');
                            return;
                        }

                        // Check if list was created with timeout for DOM updates
                        setTimeout(() => {
                            try {
                                const html = notesEditor.innerHTML;
                                const hasUL = html.includes('<ul>');
                                const hasLI = html.includes('<li>');
                                Logger.debug('insertUnorderedList: HTML after command', {
                                    htmlLength: html.length,
                                    hasUL,
                                    hasLI
                                });
                                console.log('insertUnorderedList: Has UL:', hasUL, 'Has LI:', hasLI);

                                if (!hasUL && !hasLI) {
                                    Logger.warn('insertUnorderedList: execCommand failed to create list, trying manual creation');
                                    // Manual fallback - create list manually
                                    const currentHTML = notesEditor.innerHTML;
                                    if (currentHTML.includes('<p>')) {
                                        // Convert current paragraph to list item
                                        const newHTML = currentHTML.replace(/<p>(.*?)<\/p>/, '<ul><li>$1</li></ul>');
                                        notesEditor.innerHTML = newHTML;
                                    } else {
                                        // Add new list
                                        notesEditor.innerHTML += '<ul><li>New item</li></ul>';
                                    }
                                    Logger.info('insertUnorderedList: Manual list created');
                                }

                                // Position cursor inside the list item for continued typing
                                setTimeout(() => {
                                    try {
                                        const listItems = notesEditor.querySelectorAll('ul li');
                                        if (listItems.length > 0) {
                                            const lastLI = listItems[listItems.length - 1];
                                            const range = document.createRange();
                                            const selection = window.getSelection();

                                            // Position cursor at the end of the last list item
                                            range.selectNodeContents(lastLI);
                                            range.collapse(false);
                                            selection.removeAllRanges();
                                            selection.addRange(range);

                                            console.log('insertUnorderedList: Cursor positioned inside list item');
                                        }
                                    } catch (cursorError) {
                                        console.warn('Failed to position cursor in list item:', cursorError);
                                        // Ensure editor remains focused even if cursor positioning fails
                                        notesEditor.focus();
                                    }
                                }, 150);

                                // Trigger input event to save changes
                                notesEditor.dispatchEvent(new Event('input', {
                                    bubbles: true
                                }));
                            } catch (postProcessError) {
                                console.error('Error in post-processing unordered list:', postProcessError);
                                // Ensure editor remains functional
                                notesEditor.focus();
                            }
                        }, 100);

                    } catch (error) {
                        handleFormattingError('insertUnorderedList', error, () => fallbackFormatting('insertUnorderedList'));
                    }
                },

                insertOrderedList: function() {
                    try {
                        // Pre-flight checks
                        if (!isContentEditableSupported()) {
                            throw new Error('ContentEditable not supported');
                        }

                        if (!isExecCommandSupported('insertOrderedList')) {
                            console.warn('ExecCommand insertOrderedList not supported, using fallback');
                            fallbackFormatting('insertOrderedList');
                            return;
                        }

                        // Ensure editor is focused and functional
                        if (!ensureEditorFunctionality()) {
                            throw new Error('Editor is not functional');
                        }

                        console.log('insertOrderedList: Starting...');

                        // Ensure there's a proper selection/cursor position
                        const selection = window.getSelection();
                        if (selection.rangeCount === 0) {
                            // Create a range at the end of the editor
                            const range = document.createRange();
                            range.selectNodeContents(notesEditor);
                            range.collapse(false); // Collapse to end
                            selection.removeAllRanges();
                            selection.addRange(range);
                            console.log('insertOrderedList: Created selection at end');
                        }

                        console.log('insertOrderedList: About to call execCommand');
                        const result = document.execCommand('insertOrderedList', false, null);
                        console.log('insertOrderedList: execCommand result:', result);

                        if (!result) {
                            console.warn('ExecCommand insertOrderedList returned false, attempting fallback');
                            fallbackFormatting('insertOrderedList');
                            return;
                        }

                        // Check if list was created with timeout for DOM updates
                        setTimeout(() => {
                            try {
                                const html = notesEditor.innerHTML;
                                const hasOL = html.includes('<ol>');
                                const hasLI = html.includes('<li>');
                                console.log('insertOrderedList: HTML after command:', html);
                                console.log('insertOrderedList: Has OL:', hasOL, 'Has LI:', hasLI);

                                if (!hasOL && !hasLI) {
                                    console.log('insertOrderedList: execCommand failed to create list, trying manual creation');
                                    // Manual fallback - create list manually
                                    const currentHTML = notesEditor.innerHTML;
                                    if (currentHTML.includes('<p>')) {
                                        // Convert current paragraph to list item
                                        const newHTML = currentHTML.replace(/<p>(.*?)<\/p>/, '<ol><li>$1</li></ol>');
                                        notesEditor.innerHTML = newHTML;
                                    } else {
                                        // Add new list
                                        notesEditor.innerHTML += '<ol><li>New item</li></ol>';
                                    }
                                    console.log('insertOrderedList: Manual list created');
                                }

                                // Position cursor inside the list item for continued typing
                                setTimeout(() => {
                                    try {
                                        const listItems = notesEditor.querySelectorAll('ol li');
                                        if (listItems.length > 0) {
                                            const lastLI = listItems[listItems.length - 1];
                                            const range = document.createRange();
                                            const selection = window.getSelection();

                                            // Position cursor at the end of the last list item
                                            range.selectNodeContents(lastLI);
                                            range.collapse(false);
                                            selection.removeAllRanges();
                                            selection.addRange(range);

                                            console.log('insertOrderedList: Cursor positioned inside list item');
                                        }
                                    } catch (cursorError) {
                                        console.warn('Failed to position cursor in list item:', cursorError);
                                        // Ensure editor remains focused even if cursor positioning fails
                                        notesEditor.focus();
                                    }
                                }, 150);

                                // Trigger input event to save changes
                                notesEditor.dispatchEvent(new Event('input', {
                                    bubbles: true
                                }));
                            } catch (postProcessError) {
                                console.error('Error in post-processing ordered list:', postProcessError);
                                // Ensure editor remains functional
                                notesEditor.focus();
                            }
                        }, 100);

                    } catch (error) {
                        handleFormattingError('insertOrderedList', error, () => fallbackFormatting('insertOrderedList'));
                    }
                }
            };

            // Enhanced function to check current formatting state at cursor position
            function getCurrentFormattingState() {
                try {
                    const notesEditor = document.getElementById('notesEditor');
                    if (!notesEditor) {
                        return {
                            bold: false,
                            italic: false,
                            insertUnorderedList: false,
                            insertOrderedList: false,
                            removeFormat: false
                        };
                    }

                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) {
                        return {
                            bold: false,
                            italic: false,
                            insertUnorderedList: false,
                            insertOrderedList: false,
                            removeFormat: false
                        };
                    }

                    const range = selection.getRangeAt(0);
                    let element = range.commonAncestorContainer;

                    // If the selection is a text node, get its parent element
                    if (element.nodeType === Node.TEXT_NODE) {
                        element = element.parentElement;
                    }

                    // Initialize state object
                    const state = {
                        bold: false,
                        italic: false,
                        insertUnorderedList: false,
                        insertOrderedList: false,
                        removeFormat: false
                    };

                    // Handle case where element might be null or not within the editor
                    if (!element || !notesEditor.contains(element)) {
                        return state;
                    }

                    // Walk up the DOM tree to check for formatting
                    let currentElement = element;
                    while (currentElement && currentElement !== notesEditor && currentElement !== document.body) {
                        try {
                            const tagName = currentElement.tagName ? currentElement.tagName.toLowerCase() : '';

                            // Check for bold formatting - multiple ways to detect
                            if (tagName === 'strong' || tagName === 'b') {
                                state.bold = true;
                            } else if (currentElement.style && currentElement.style.fontWeight) {
                                const fontWeight = currentElement.style.fontWeight;
                                if (fontWeight === 'bold' || fontWeight === 'bolder' || parseInt(fontWeight) >= 700) {
                                    state.bold = true;
                                }
                            } else {
                                // Check computed style as fallback
                                try {
                                    const computedStyle = window.getComputedStyle(currentElement);
                                    const computedWeight = computedStyle.fontWeight;
                                    if (computedWeight === 'bold' || computedWeight === 'bolder' || parseInt(computedWeight) >= 700) {
                                        state.bold = true;
                                    }
                                } catch (styleError) {
                                    // Ignore computed style errors
                                }
                            }

                            // Check for italic formatting - multiple ways to detect
                            if (tagName === 'em' || tagName === 'i') {
                                state.italic = true;
                            } else if (currentElement.style && currentElement.style.fontStyle === 'italic') {
                                state.italic = true;
                            } else {
                                // Check computed style as fallback
                                try {
                                    const computedStyle = window.getComputedStyle(currentElement);
                                    if (computedStyle.fontStyle === 'italic') {
                                        state.italic = true;
                                    }
                                } catch (styleError) {
                                    // Ignore computed style errors
                                }
                            }

                            // Check for list formatting
                            if (tagName === 'ul') {
                                state.insertUnorderedList = true;
                            }
                            if (tagName === 'ol') {
                                state.insertOrderedList = true;
                            }

                            // Special handling for list items - check parent lists
                            if (tagName === 'li') {
                                const parentList = currentElement.parentElement;
                                if (parentList) {
                                    const parentTagName = parentList.tagName ? parentList.tagName.toLowerCase() : '';
                                    if (parentTagName === 'ul') {
                                        state.insertUnorderedList = true;
                                    } else if (parentTagName === 'ol') {
                                        state.insertOrderedList = true;
                                    }
                                }
                            }

                        } catch (elementError) {
                            console.warn('Error checking element formatting:', elementError);
                            // Continue to parent element
                        }

                        currentElement = currentElement.parentElement;
                    }

                    return state;

                } catch (error) {
                    console.error('Error in getCurrentFormattingState:', error);
                    // Return default state if there's an error
                    return {
                        bold: false,
                        italic: false,
                        insertUnorderedList: false,
                        insertOrderedList: false
                    };
                }
            }

            // Enhanced function to update toolbar button states based on current formatting
            function updateToolbarButtonStates() {
                try {
                    const notesEditor = document.getElementById('notesEditor');
                    if (!notesEditor) {
                        console.warn('Cannot update button states: notes editor not found');
                        return;
                    }

                    // Get current formatting state
                    const state = getCurrentFormattingState();

                    // Get all toolbar buttons
                    const toolbarButtons = document.querySelectorAll('.notes-toolbar .toolbar-btn');

                    if (toolbarButtons.length === 0) {
                        console.warn('No toolbar buttons found for state update');
                        return;
                    }

                    // Update each button's active state
                    toolbarButtons.forEach(button => {
                        try {
                            const command = button.getAttribute('data-command');

                            if (!command) {
                                console.warn('Toolbar button missing data-command attribute:', button);
                                return;
                            }

                            // Check if this command has a corresponding state
                            if (state.hasOwnProperty(command)) {
                                const isActive = state[command];

                                // Update button visual state
                                if (isActive) {
                                    if (!button.classList.contains('active')) {
                                        button.classList.add('active');
                                        // Add visual feedback for state change
                                        button.style.transition = 'all 0.2s ease';
                                    }
                                } else {
                                    if (button.classList.contains('active')) {
                                        button.classList.remove('active');
                                        // Add visual feedback for state change
                                        button.style.transition = 'all 0.2s ease';
                                    }
                                }

                                // Update button title to reflect current state
                                const originalTitle = button.getAttribute('title') || '';
                                const baseTitle = originalTitle.split(' - ')[0]; // Remove any existing state indicator

                                if (isActive) {
                                    button.setAttribute('title', `${baseTitle} - Active`);
                                } else {
                                    button.setAttribute('title', baseTitle);
                                }

                            } else {
                                console.warn(`No state property found for command: ${command}`);
                            }

                        } catch (buttonError) {
                            console.error('Error updating individual button state:', buttonError, button);
                        }
                    });

                    // Debug logging for state updates
                    console.log('Button states updated:', {
                        bold: state.bold,
                        italic: state.italic,
                        insertUnorderedList: state.insertUnorderedList,
                        insertOrderedList: state.insertOrderedList
                    });

                } catch (error) {
                    console.error('Error updating toolbar button states:', error);
                    // Don't throw the error to prevent breaking other functionality
                }
            }

            // Event handlers for toolbar button clicks
            const toolbarButtons = document.querySelectorAll('.notes-toolbar .toolbar-btn');
            toolbarButtons.forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();

                    const command = this.getAttribute('data-command');
                    console.log('Toolbar button clicked, command:', command);
                    console.log('formatCommands object:', formatCommands);
                    console.log('formatCommands[command] exists:', !!formatCommands[command]);

                    if (formatCommands[command]) {
                        console.log('Executing command:', command);

                        // Handle cases where no text is selected (cursor positioning for new formatted input)
                        const selection = window.getSelection();
                        const hasSelection = selection.toString().length > 0;
                        console.log('Has selection:', hasSelection, 'Selection text:', selection.toString());

                        // Execute the formatting command
                        formatCommands[command]();

                        // If no text was selected and we're applying bold/italic, 
                        // the cursor is now positioned for formatted input
                        if (!hasSelection && (command === 'bold' || command === 'italic')) {
                            // The cursor is already positioned correctly by execCommand
                            // No additional action needed
                        }

                        // Update button states after formatting command
                        setTimeout(() => {
                            updateToolbarButtonStates();
                        }, 10);

                        // Trigger input event to save changes
                        notesEditor.dispatchEvent(new Event('input', {
                            bubbles: true
                        }));
                    } else {
                        console.error('Command not found in formatCommands:', command);
                        console.log('Available commands:', Object.keys(formatCommands));
                    }
                });
            });

            // Keyboard shortcuts for common formatting operations
            notesEditor.addEventListener('keydown', function(e) {
                // Ctrl+B for bold formatting
                if (e.ctrlKey && e.key === 'b') {
                    e.preventDefault();
                    formatCommands.bold();
                    // Update button states after formatting command
                    setTimeout(() => {
                        updateToolbarButtonStates();
                    }, 10);
                    // Trigger input event to save changes
                    notesEditor.dispatchEvent(new Event('input', {
                        bubbles: true
                    }));
                }

                // Ctrl+I for italic formatting
                if (e.ctrlKey && e.key === 'i') {
                    e.preventDefault();
                    formatCommands.italic();
                    // Update button states after formatting command
                    setTimeout(() => {
                        updateToolbarButtonStates();
                    }, 10);
                    // Trigger input event to save changes
                    notesEditor.dispatchEvent(new Event('input', {
                        bubbles: true
                    }));
                }

                // Handle Enter key for automatic list item creation
                if (e.key === 'Enter') {
                    handleEnterInList(e);
                }
            });

            // Enhanced selection change event handlers to update button states
            document.addEventListener('selectionchange', function() {
                try {
                    // Only update if the selection is within the notes editor
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) {
                        return;
                    }

                    const range = selection.getRangeAt(0);
                    const notesEditor = document.getElementById('notesEditor');

                    if (!notesEditor) {
                        return;
                    }

                    // Check if selection is within the notes editor
                    if (notesEditor.contains(range.commonAncestorContainer) ||
                        notesEditor === range.commonAncestorContainer ||
                        range.commonAncestorContainer.contains(notesEditor)) {

                        // Debounce the update to avoid excessive calls
                        clearTimeout(window.selectionUpdateTimeout);
                        window.selectionUpdateTimeout = setTimeout(() => {
                            updateToolbarButtonStates();
                        }, 50);
                    }
                } catch (error) {
                    console.warn('Error in selectionchange handler:', error);
                }
            });

            // Enhanced event listeners for cursor position changes
            notesEditor.addEventListener('keyup', function(e) {
                try {
                    // Update button states on cursor movement keys and formatting keys
                    const updateKeys = [
                        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                        'Home', 'End', 'PageUp', 'PageDown',
                        'Backspace', 'Delete', 'Enter', 'Tab'
                    ];

                    if (updateKeys.includes(e.key)) {
                        // Debounce the update
                        clearTimeout(window.keyupUpdateTimeout);
                        window.keyupUpdateTimeout = setTimeout(() => {
                            updateToolbarButtonStates();
                        }, 100);
                    }
                } catch (error) {
                    console.warn('Error in keyup handler:', error);
                }
            });

            // Enhanced mouse event handling
            notesEditor.addEventListener('mouseup', function(e) {
                try {
                    // Update button states after mouse clicks (cursor position changes)
                    clearTimeout(window.mouseupUpdateTimeout);
                    window.mouseupUpdateTimeout = setTimeout(() => {
                        updateToolbarButtonStates();
                    }, 50);
                } catch (error) {
                    console.warn('Error in mouseup handler:', error);
                }
            });

            // Handle mouse selection events
            notesEditor.addEventListener('mousedown', function(e) {
                try {
                    // Clear any pending updates
                    clearTimeout(window.mouseSelectionTimeout);

                    // Set up a listener for when the mouse selection is complete
                    const handleMouseSelectionEnd = function() {
                        clearTimeout(window.mouseSelectionTimeout);
                        window.mouseSelectionTimeout = setTimeout(() => {
                            updateToolbarButtonStates();
                        }, 100);

                        document.removeEventListener('mouseup', handleMouseSelectionEnd);
                    };

                    document.addEventListener('mouseup', handleMouseSelectionEnd);
                } catch (error) {
                    console.warn('Error in mousedown handler:', error);
                }
            });

            // Update button states when editor gains focus
            notesEditor.addEventListener('focus', function() {
                try {
                    clearTimeout(window.focusUpdateTimeout);
                    window.focusUpdateTimeout = setTimeout(() => {
                        updateToolbarButtonStates();
                    }, 100);
                } catch (error) {
                    console.warn('Error in focus handler:', error);
                }
            });

            // DISABLED: Button state updates on input events to fix new text formatting
            // The frequent button state updates were interfering with contentEditable's ability
            // to maintain formatting context for newly typed text after applying formatting
            notesEditor.addEventListener('input', function(e) {
                try {
                    console.log('Input event detected - inputType:', e.inputType, 'data:', e.data);

                    // Only update button states for explicit formatting operations, not for regular typing
                    if (e.inputType && e.inputType.includes('format')) {
                        console.log('Format-related input detected, updating button states');
                        clearTimeout(window.inputUpdateTimeout);
                        window.inputUpdateTimeout = setTimeout(() => {
                            updateToolbarButtonStates();
                        }, 150);
                    } else {
                        console.log('Regular input detected - preserving formatting context, skipping button state update');
                    }
                } catch (error) {
                    console.warn('Error in input handler:', error);
                }
            });

            // Handle paste events that might change formatting
            notesEditor.addEventListener('paste', function(e) {
                try {
                    // Update button states after paste operation completes
                    clearTimeout(window.pasteUpdateTimeout);
                    window.pasteUpdateTimeout = setTimeout(() => {
                        updateToolbarButtonStates();
                    }, 200);
                } catch (error) {
                    console.warn('Error in paste handler:', error);
                }
            });

            // Initial button state update when notes window is set up
            setTimeout(() => {
                try {
                    updateToolbarButtonStates();
                } catch (error) {
                    console.warn('Error in initial button state update:', error);
                }
            }, 100);
        }

        // Helper functions for comprehensive error handling and fallback mechanisms

        // Ensures the notes editor is functional and ready for operations
        function ensureEditorFunctionality() {
            const notesEditor = document.getElementById('notesEditor');

            try {
                // Check if editor exists and is accessible
                if (!notesEditor) {
                    console.error('Notes editor element not found');
                    return false;
                }

                // Check if editor is contentEditable
                if (!notesEditor.isContentEditable) {
                    console.warn('Notes editor is not contentEditable, attempting to fix');
                    notesEditor.contentEditable = true;

                    // Verify the fix worked
                    if (!notesEditor.isContentEditable) {
                        console.error('Failed to make notes editor contentEditable');
                        return false;
                    }
                }

                // Check if editor is visible and has dimensions
                const rect = notesEditor.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    console.warn('Notes editor has zero dimensions');
                    // Don't return false here as it might still be functional
                }

                // Ensure editor can receive focus
                try {
                    notesEditor.focus();
                } catch (focusError) {
                    console.warn('Failed to focus notes editor:', focusError);
                    // Don't return false as this might not be critical
                }

                return true;
            } catch (error) {
                console.error('Error checking editor functionality:', error);
                return false;
            }
        }

        // Switches to plain text mode as a last resort fallback
        function switchToPlainTextMode(reason) {
            console.error('Switching to plain text mode. Reason:', reason);

            try {
                const notesEditor = document.getElementById('notesEditor');
                if (!notesEditor) {
                    console.error('Cannot switch to plain text mode: editor not found');
                    return;
                }

                // Get current content as plain text
                const currentText = notesEditor.textContent || notesEditor.innerText || '';

                // Create a new textarea element to replace the contentEditable div
                const textarea = document.createElement('textarea');
                textarea.id = 'notesEditor';
                textarea.className = 'notes-editor';
                textarea.value = currentText;
                textarea.placeholder = 'Plain text mode - formatting disabled due to compatibility issues';

                // Copy relevant attributes and styles
                textarea.style.cssText = notesEditor.style.cssText;

                // Replace the contentEditable div with textarea
                notesEditor.parentNode.replaceChild(textarea, notesEditor);

                // Update the data model to reflect plain text mode
                if (bookmarkData && bookmarkData.notes) {
                    bookmarkData.notes.content = currentText ? `<p>${escapeHtml(currentText)}</p>` : '<p></p>';
                    bookmarkData.notes.plainContent = currentText;
                    bookmarkData.notes.formatVersion = 'plaintext-fallback';
                }

                // Disable toolbar buttons
                const toolbarButtons = document.querySelectorAll('.notes-toolbar .toolbar-btn');
                toolbarButtons.forEach(button => {
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.title = 'Formatting disabled - plain text mode active';
                });

                // Add event listener for auto-save in plain text mode
                textarea.addEventListener('input', function() {
                    if (bookmarkData && bookmarkData.notes) {
                        const plainText = textarea.value;
                        bookmarkData.notes.content = plainText ? `<p>${escapeHtml(plainText)}</p>` : '<p></p>';
                        bookmarkData.notes.plainContent = plainText;

                        // Trigger auto-save
                        clearTimeout(window.plainTextSaveTimeout);
                        window.plainTextSaveTimeout = setTimeout(() => {
                            saveData().catch(error => {
                                console.error('Failed to save in plain text mode:', error);
                            });
                        }, 1000);
                    }
                });

                // Focus the new textarea
                textarea.focus();

                console.log('Successfully switched to plain text mode');

            } catch (error) {
                console.error('Failed to switch to plain text mode:', error);
                // At this point, we've exhausted all options
                alert('The notes editor has encountered a critical error and cannot function properly. Please refresh the page.');
            }
        }

        // Detects browser compatibility issues and provides appropriate fallbacks
        function detectBrowserCompatibility() {
            const compatibility = {
                contentEditable: false,
                execCommand: false,
                selection: false,
                issues: []
            };

            try {
                // Test contentEditable support
                const testDiv = document.createElement('div');
                testDiv.contentEditable = true;
                compatibility.contentEditable = testDiv.isContentEditable === true;
                if (!compatibility.contentEditable) {
                    compatibility.issues.push('ContentEditable not supported');
                }
            } catch (error) {
                compatibility.issues.push('ContentEditable test failed: ' + error.message);
            }

            try {
                // Test execCommand support
                compatibility.execCommand = typeof document.execCommand === 'function' &&
                    document.queryCommandSupported &&
                    document.queryCommandSupported('bold');
                if (!compatibility.execCommand) {
                    compatibility.issues.push('ExecCommand not supported or deprecated');
                }
            } catch (error) {
                compatibility.issues.push('ExecCommand test failed: ' + error.message);
            }

            try {
                // Test Selection API support
                compatibility.selection = typeof window.getSelection === 'function' &&
                    typeof document.createRange === 'function';
                if (!compatibility.selection) {
                    compatibility.issues.push('Selection API not supported');
                }
            } catch (error) {
                compatibility.issues.push('Selection API test failed: ' + error.message);
            }

            return compatibility;
        }

        // Creates error recovery mechanisms for corrupted content
        function recoverCorruptedContent(corruptedContent, error) {
            console.warn('Attempting to recover corrupted content:', error);

            try {
                // First, try to extract plain text from corrupted HTML
                let recoveredText = '';

                if (typeof corruptedContent === 'string') {
                    // Use the content sanitizer's fallback function if available
                    if (window.ContentSanitizer && typeof window.ContentSanitizer.fallbackToPlainText === 'function') {
                        recoveredText = window.ContentSanitizer.fallbackToPlainText(corruptedContent);
                    } else {
                        // Manual plain text extraction
                        recoveredText = corruptedContent.replace(/<[^>]*>/g, '').trim();
                    }
                }

                // If we couldn't recover any text, check for backup content
                if (!recoveredText && bookmarkData && bookmarkData.notes && bookmarkData.notes.plainContent) {
                    recoveredText = bookmarkData.notes.plainContent;
                    console.log('Using backup plain content for recovery');
                }

                // Create safe HTML content from recovered text
                const safeContent = recoveredText ? `<p>${escapeHtml(recoveredText)}</p>` : '<p></p>';

                console.log('Content recovery successful:', {
                    originalLength: corruptedContent ? corruptedContent.length : 0,
                    recoveredLength: recoveredText.length,
                    safeContent: safeContent
                });

                return {
                    success: true,
                    content: safeContent,
                    plainContent: recoveredText,
                    recoveryMethod: recoveredText === (bookmarkData && bookmarkData.notes && bookmarkData.notes.plainContent) ? 'backup' : 'extraction'
                };

            } catch (recoveryError) {
                console.error('Content recovery failed:', recoveryError);

                return {
                    success: false,
                    content: '<p></p>',
                    plainContent: '',
                    recoveryMethod: 'empty',
                    error: recoveryError.message
                };
            }
        }

        // Utility function to safely escape HTML for plain text fallback
        function escapeHtml(text) {
            if (typeof text !== 'string') return '';

            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Enhanced Enter key handling for automatic list item creation within lists
        function handleEnterInList(e) {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const currentNode = range.startContainer;

            // Find the closest list item (li) element
            let listItem = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;
            while (listItem && listItem.tagName !== 'LI') {
                listItem = listItem.parentElement;
                // Stop if we've gone too far up the DOM tree
                if (!listItem || listItem === document.getElementById('notesEditor')) {
                    return; // Not in a list, let default behavior happen
                }
            }

            if (!listItem || listItem.tagName !== 'LI') {
                return; // Not in a list item, let default behavior happen
            }

            // Check if the current list item is empty
            const listItemText = listItem.textContent.trim();
            if (listItemText === '') {
                // Empty list item - exit the list
                e.preventDefault();

                // Get the parent list (ul or ol)
                const parentList = listItem.parentElement;
                if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                    // Remove the empty list item
                    listItem.remove();

                    // Check if the list is now empty and remove it if so
                    if (parentList.children.length === 0) {
                        const emptyListParent = parentList.parentElement;
                        parentList.remove();

                        // Create a new paragraph where the list was
                        const newParagraph = document.createElement('p');
                        newParagraph.innerHTML = '<br>';
                        emptyListParent.appendChild(newParagraph);

                        // Position cursor in the new paragraph
                        const newRange = document.createRange();
                        newRange.setStart(newParagraph, 0);
                        newRange.setEnd(newParagraph, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        // Create a new paragraph after the list
                        const newParagraph = document.createElement('p');
                        newParagraph.innerHTML = '<br>'; // Ensure the paragraph is not empty

                        // Insert the paragraph after the list
                        parentList.parentNode.insertBefore(newParagraph, parentList.nextSibling);

                        // Position cursor in the new paragraph
                        const newRange = document.createRange();
                        newRange.setStart(newParagraph, 0);
                        newRange.setEnd(newParagraph, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }

                    // Trigger input event to save changes
                    document.getElementById('notesEditor').dispatchEvent(new Event('input', {
                        bubbles: true
                    }));
                }
                return;
            }

            // Non-empty list item - create a new list item
            e.preventDefault();

            const parentList = listItem.parentElement;
            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                // Enhanced cursor position detection
                const textContent = range.endContainer.textContent || '';
                const cursorAtEnd = range.endOffset >= textContent.length;
                const cursorAtStart = range.startOffset === 0;

                if (cursorAtEnd || (range.endContainer === listItem && range.endOffset === listItem.childNodes.length)) {
                    // Cursor at end - create new list item after current one
                    const newListItem = document.createElement('li');
                    newListItem.innerHTML = '<br>'; // Ensure the list item is not empty

                    // Insert the new list item after the current one
                    listItem.parentNode.insertBefore(newListItem, listItem.nextSibling);

                    // Position cursor in the new list item
                    const newRange = document.createRange();
                    newRange.setStart(newListItem, 0);
                    newRange.setEnd(newListItem, 0);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else {
                    // Cursor in middle - split the current list item
                    const newListItem = document.createElement('li');

                    try {
                        // Move content after cursor to new list item
                        const afterCursor = range.extractContents();
                        newListItem.appendChild(afterCursor);

                        // If new list item is empty after extraction, add a br
                        if (newListItem.textContent.trim() === '') {
                            newListItem.innerHTML = '<br>';
                        }

                        // Insert the new list item after the current one
                        listItem.parentNode.insertBefore(newListItem, listItem.nextSibling);

                        // Position cursor at start of new list item
                        const newRange = document.createRange();
                        newRange.setStart(newListItem, 0);
                        newRange.setEnd(newListItem, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } catch (error) {
                        // Fallback: create empty list item if extraction fails
                        console.warn('List item splitting failed, using fallback:', error);
                        newListItem.innerHTML = '<br>';
                        listItem.parentNode.insertBefore(newListItem, listItem.nextSibling);

                        const newRange = document.createRange();
                        newRange.setStart(newListItem, 0);
                        newRange.setEnd(newListItem, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }

                // For ordered lists, the numbering is automatically maintained by the browser
                // This ensures proper list nesting and formatting behavior

                // Trigger input event to save changes
                document.getElementById('notesEditor').dispatchEvent(new Event('input', {
                    bubbles: true
                }));
            }
        }

        // Enhanced fallback formatting functions with comprehensive error handling
        function fallbackFormatting(command) {
            console.log(`Executing fallback formatting for command: ${command}`);

            try {
                const selection = window.getSelection();
                const notesEditor = document.getElementById('notesEditor');

                // Ensure editor exists and is functional
                if (!notesEditor) {
                    throw new Error('Notes editor not found');
                }

                if (!ensureEditorFunctionality()) {
                    throw new Error('Editor is not functional');
                }

                // Check if we have a valid selection API
                if (!selection || typeof selection.getRangeAt !== 'function') {
                    throw new Error('Selection API not available');
                }

                // If no selection, create one at the end of the editor
                if (selection.rangeCount === 0) {
                    try {
                        const range = document.createRange();
                        range.selectNodeContents(notesEditor);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (selectionError) {
                        console.warn('Failed to create selection, focusing editor:', selectionError);
                        notesEditor.focus();
                        return;
                    }
                }

                const range = selection.getRangeAt(0);

                // Validate range
                if (!range) {
                    throw new Error('Could not get selection range');
                }
                if (command === 'bold') {
                    try {
                        const strong = document.createElement('strong');
                        if (selection.toString().length > 0) {
                            // Check if the range can be surrounded
                            try {
                                range.surroundContents(strong);
                            } catch (surroundError) {
                                // If surroundContents fails, extract and wrap content manually
                                const contents = range.extractContents();
                                strong.appendChild(contents);
                                range.insertNode(strong);
                            }
                        } else {
                            // Insert empty strong element for cursor positioning
                            strong.innerHTML = '&nbsp;'; // Use non-breaking space for better cursor positioning
                            range.insertNode(strong);
                            // Position cursor inside the strong element
                            const newRange = document.createRange();
                            newRange.setStart(strong.firstChild, 0);
                            newRange.setEnd(strong.firstChild, 1);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    } catch (boldError) {
                        console.error('Bold fallback failed:', boldError);
                        throw new Error(`Bold formatting fallback failed: ${boldError.message}`);
                    }
                } else if (command === 'italic') {
                    try {
                        const em = document.createElement('em');
                        if (selection.toString().length > 0) {
                            // Check if the range can be surrounded
                            try {
                                range.surroundContents(em);
                            } catch (surroundError) {
                                // If surroundContents fails, extract and wrap content manually
                                const contents = range.extractContents();
                                em.appendChild(contents);
                                range.insertNode(em);
                            }
                        } else {
                            // Insert empty em element for cursor positioning
                            em.innerHTML = '&nbsp;'; // Use non-breaking space for better cursor positioning
                            range.insertNode(em);
                            // Position cursor inside the em element
                            const newRange = document.createRange();
                            newRange.setStart(em.firstChild, 0);
                            newRange.setEnd(em.firstChild, 1);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    } catch (italicError) {
                        console.error('Italic fallback failed:', italicError);
                        throw new Error(`Italic formatting fallback failed: ${italicError.message}`);
                    }
                } else if (command === 'insertUnorderedList') {
                    try {
                        // Enhanced fallback implementation for bullet lists
                        const selectedText = selection.toString();

                        // Check if we're already in a list item
                        let currentNode = range.startContainer;
                        let listItem = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;

                        while (listItem && listItem.tagName !== 'LI' && listItem !== notesEditor) {
                            listItem = listItem.parentElement;
                        }

                        if (listItem && listItem.tagName === 'LI') {
                            // Already in a list - convert to bullet list if needed
                            const parentList = listItem.parentElement;
                            if (parentList && parentList.tagName === 'OL') {
                                try {
                                    // Convert ordered list to unordered list
                                    const ul = document.createElement('ul');
                                    while (parentList.firstChild) {
                                        ul.appendChild(parentList.firstChild);
                                    }
                                    parentList.parentNode.replaceChild(ul, parentList);
                                } catch (conversionError) {
                                    console.warn('Failed to convert ordered list to unordered:', conversionError);
                                    // If conversion fails, just ensure we're in a list
                                }
                            }
                        } else {
                            // Not in a list - create new bullet list
                            try {
                                const ul = document.createElement('ul');
                                const li = document.createElement('li');

                                if (selectedText.length > 0) {
                                    li.textContent = selectedText;
                                } else {
                                    li.innerHTML = '&nbsp;'; // Use non-breaking space for better cursor positioning
                                }

                                ul.appendChild(li);

                                // Replace the selection with the list
                                range.deleteContents();
                                range.insertNode(ul);

                                // Position cursor in the list item
                                try {
                                    const newRange = document.createRange();
                                    if (selectedText.length > 0) {
                                        newRange.setStartAfter(li.lastChild);
                                        newRange.setEndAfter(li.lastChild);
                                    } else {
                                        newRange.setStart(li.firstChild, 0);
                                        newRange.setEnd(li.firstChild, 1);
                                    }
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                } catch (cursorError) {
                                    console.warn('Failed to position cursor in bullet list:', cursorError);
                                    // Fallback: just focus the editor
                                    notesEditor.focus();
                                }
                            } catch (listCreationError) {
                                console.error('Failed to create bullet list:', listCreationError);
                                throw new Error(`Bullet list creation failed: ${listCreationError.message}`);
                            }
                        }
                    } catch (bulletListError) {
                        console.error('Bullet list fallback failed:', bulletListError);
                        throw new Error(`Bullet list formatting fallback failed: ${bulletListError.message}`);
                    }

                } else if (command === 'insertOrderedList') {
                    try {
                        // Enhanced fallback implementation for numbered lists
                        const selectedText = selection.toString();

                        // Check if we're already in a list item
                        let currentNode = range.startContainer;
                        let listItem = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;

                        while (listItem && listItem.tagName !== 'LI' && listItem !== notesEditor) {
                            listItem = listItem.parentElement;
                        }

                        if (listItem && listItem.tagName === 'LI') {
                            // Already in a list - convert to numbered list if needed
                            const parentList = listItem.parentElement;
                            if (parentList && parentList.tagName === 'UL') {
                                try {
                                    // Convert unordered list to ordered list
                                    const ol = document.createElement('ol');
                                    while (parentList.firstChild) {
                                        ol.appendChild(parentList.firstChild);
                                    }
                                    parentList.parentNode.replaceChild(ol, parentList);
                                } catch (conversionError) {
                                    console.warn('Failed to convert unordered list to ordered:', conversionError);
                                    // If conversion fails, just ensure we're in a list
                                }
                            }
                        } else {
                            // Not in a list - create new numbered list
                            try {
                                const ol = document.createElement('ol');
                                const li = document.createElement('li');

                                if (selectedText.length > 0) {
                                    li.textContent = selectedText;
                                } else {
                                    li.innerHTML = '&nbsp;'; // Use non-breaking space for better cursor positioning
                                }

                                ol.appendChild(li);

                                // Replace the selection with the list
                                range.deleteContents();
                                range.insertNode(ol);

                                // Position cursor in the list item
                                try {
                                    const newRange = document.createRange();
                                    if (selectedText.length > 0) {
                                        newRange.setStartAfter(li.lastChild);
                                        newRange.setEndAfter(li.lastChild);
                                    } else {
                                        newRange.setStart(li.firstChild, 0);
                                        newRange.setEnd(li.firstChild, 1);
                                    }
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                } catch (cursorError) {
                                    console.warn('Failed to position cursor in numbered list:', cursorError);
                                    // Fallback: just focus the editor
                                    notesEditor.focus();
                                }
                            } catch (listCreationError) {
                                console.error('Failed to create numbered list:', listCreationError);
                                throw new Error(`Numbered list creation failed: ${listCreationError.message}`);
                            }
                        }
                    } catch (numberedListError) {
                        console.error('Numbered list fallback failed:', numberedListError);
                        throw new Error(`Numbered list formatting fallback failed: ${numberedListError.message}`);
                    }
                } else {
                    throw new Error(`Unknown formatting command: ${command}`);
                }
            } catch (error) {
                console.error('All fallback formatting mechanisms failed:', error);
                // Last resort - switch to plain text mode
                switchToPlainTextMode(`All formatting fallbacks failed: ${error.message}`);
                return;
            }

            // Ensure editor remains focused after successful fallback
            try {
                notesEditor.focus();
            } catch (focusError) {
                console.warn('Failed to focus editor after fallback formatting:', focusError);
            }
        }

        // Enhanced fallback function to remove formatting with comprehensive error handling
        function fallbackRemoveFormat() {
            console.log('Executing fallback remove formatting');

            try {
                const selection = window.getSelection();
                const notesEditor = document.getElementById('notesEditor');

                // Ensure editor exists and is functional
                if (!notesEditor) {
                    throw new Error('Notes editor not found');
                }

                if (!ensureEditorFunctionality()) {
                    throw new Error('Editor is not functional');
                }

                // Check if we have a valid selection API
                if (!selection || typeof selection.getRangeAt !== 'function') {
                    throw new Error('Selection API not available');
                }

                // If no selection, create one at the end of the editor
                if (selection.rangeCount === 0) {
                    try {
                        const range = document.createRange();
                        range.selectNodeContents(notesEditor);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (selectionError) {
                        console.warn('Failed to create selection for remove format, focusing editor:', selectionError);
                        notesEditor.focus();
                        return;
                    }
                }

                const range = selection.getRangeAt(0);
                const selectedText = selection.toString();

                if (selectedText.length > 0) {
                    try {
                        // Create a text node with the plain text content
                        const textNode = document.createTextNode(selectedText);
                        range.deleteContents();
                        range.insertNode(textNode);

                        // Position cursor after the inserted text
                        const newRange = document.createRange();
                        newRange.setStartAfter(textNode);
                        newRange.setEndAfter(textNode);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } catch (textInsertError) {
                        console.error('Failed to insert plain text:', textInsertError);
                        // Try alternative approach - replace innerHTML of selected elements
                        try {
                            const container = range.commonAncestorContainer;
                            if (container.nodeType === Node.ELEMENT_NODE) {
                                container.textContent = selectedText;
                            }
                        } catch (alternativeError) {
                            console.error('Alternative remove format approach failed:', alternativeError);
                            throw new Error(`Remove format fallback failed: ${alternativeError.message}`);
                        }
                    }
                } else {
                    // No text selected - reset cursor to plain text mode
                    try {
                        // Find the current element and ensure it's not formatted
                        let currentElement = range.startContainer;
                        if (currentElement.nodeType === Node.TEXT_NODE) {
                            currentElement = currentElement.parentElement;
                        }

                        // If we're in a formatted element, move cursor outside of it
                        const formattedTags = ['strong', 'b', 'em', 'i'];
                        while (currentElement && currentElement !== notesEditor &&
                            formattedTags.includes(currentElement.tagName ? currentElement.tagName.toLowerCase() : '')) {
                            currentElement = currentElement.parentElement;
                        }

                        // Position cursor in a plain paragraph
                        if (currentElement && currentElement !== notesEditor) {
                            const newRange = document.createRange();
                            newRange.setStartAfter(currentElement);
                            newRange.setEndAfter(currentElement);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    } catch (cursorResetError) {
                        console.warn('Failed to reset cursor for remove format:', cursorResetError);
                        // Just ensure editor is focused
                    }
                }

                // Ensure editor remains focused after successful operation
                notesEditor.focus();

            } catch (error) {
                console.error('All remove format fallback mechanisms failed:', error);
                // Last resort - switch to plain text mode
                switchToPlainTextMode(`Remove format fallback failed: ${error.message}`);
            }
        }

        function toggleNotesWindow() {
            const notesWindow = document.getElementById('notesWindow');

            if (notesWindow.style.display === 'block') {
                notesWindow.style.display = 'none';
            } else {
                notesWindow.style.display = 'block';
                // Focus on editor when opening
                setTimeout(() => {
                    document.getElementById('notesEditor').focus();
                }, 100);
            }
        }

        function closeNotesWindow() {
            document.getElementById('notesWindow').style.display = 'none';
        }

        // Setup global keyboard shortcuts
        function setupGlobalKeyboardShortcuts() {
            document.addEventListener('keydown', function(e) {
                // Hierarchical Escape key behavior
                if (e.key === 'Escape') {
                    const folderModal = document.getElementById('folderModal');
                    const linkModal = document.getElementById('linkModal');
                    const notesWindow = document.getElementById('notesWindow');

                    // Priority 1: Close folder modal if open
                    if (folderModal && folderModal.style.display === 'block') {
                        e.preventDefault();
                        closeModal('folderModal');
                        console.log('Escape pressed: Closed folder modal');
                        return;
                    }

                    // Priority 2: Close link modal if open
                    if (linkModal && linkModal.style.display === 'block') {
                        e.preventDefault();
                        closeModal('linkModal');
                        console.log('Escape pressed: Closed link modal');
                        return;
                    }

                    // Priority 3: Close notes window if open and no modals are open
                    if (notesWindow && notesWindow.style.display === 'block') {
                        e.preventDefault();
                        closeNotesWindow();
                        console.log('Escape pressed: Closed notes window');
                        return;
                    }
                }
            });
        }

        function setupSidebarResizer() {
            const resizer = document.getElementById('sidebarResizer');
            const sidebar = document.querySelector('.sidebar');

            let startX, startWidth;

            function startResize(e) {
                startX = e.clientX;
                startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);
                document.body.style.cursor = 'col-resize';
            }

            function resize(e) {
                const width = startWidth + (e.clientX - startX);
                if (width > 100 && width < window.innerWidth * 0.5) {
                    sidebar.style.width = width + 'px';
                    resizer.style.left = width + 'px';
                }
            }

            function stopResize() {
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
                document.body.style.cursor = '';
            }

            resizer.addEventListener('mousedown', startResize);
        }

        function setupSearch() {
            const searchInput = document.getElementById('searchInput');
            const searchClear = document.getElementById('searchClear');

            searchInput.addEventListener('input', function(e) {
                searchTerm = e.target.value.toLowerCase();

                // Toggle clear button visibility
                if (searchTerm) {
                    searchClear.classList.add('visible');
                } else {
                    searchClear.classList.remove('visible');
                }

                renderLinks();
            });

            searchClear.addEventListener('click', function() {
                searchInput.value = '';
                searchTerm = '';
                searchClear.classList.remove('visible');
                renderLinks();
            });
        }

        function setupDragAndDrop() {
            // Setup sortable for root folders
            const folderList = document.getElementById('folderList');
            new Sortable(folderList, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'drag-ghost',
                group: 'folders',
                onEnd: async function(evt) {
                    updateFolderOrder();
                    await saveData();
                }
            });

            // For handling link drag and drop
            document.addEventListener('dragstart', function(e) {
                // Handle folder dragging
                if (e.target.classList.contains('folder')) {
                    e.dataTransfer.setData('application/folder', e.target.dataset.folderId);
                    e.target.classList.add('dragging');
                }

                // Handle link dragging
                if (e.target.classList.contains('link-item')) {
                    e.dataTransfer.setData('application/link', e.target.dataset.linkId);
                    e.target.classList.add('dragging');
                }
            });

            document.addEventListener('dragend', function(e) {
                if (e.target.classList.contains('folder') || e.target.classList.contains('link-item')) {
                    e.target.classList.remove('dragging');
                }
            });

            document.addEventListener('dragover', function(e) {
                e.preventDefault();
                // Find the folder we're hovering over
                const dropTarget = e.target.closest('.folder');

                if (dropTarget) {
                    // Handle folder to folder drag
                    const draggedFolderId = e.dataTransfer.getData('application/folder');
                    const draggedLinkId = e.dataTransfer.getData('application/link');

                    if ((draggedFolderId && draggedFolderId !== dropTarget.dataset.folderId) ||
                        draggedLinkId) {
                        dropTarget.classList.add('drag-over');
                    }
                }
            });

            document.addEventListener('dragleave', function(e) {
                const dropTarget = e.target.closest('.folder');
                if (dropTarget && !dropTarget.contains(e.relatedTarget)) {
                    dropTarget.classList.remove('drag-over');
                }
            });

            document.addEventListener('drop', async function(e) {
                e.preventDefault();

                // Handle drops on folders
                const dropTarget = e.target.closest('.folder');

                if (dropTarget) {
                    const targetFolderId = dropTarget.dataset.folderId;

                    // Handle folder to folder drop
                    const folderId = e.dataTransfer.getData('application/folder');
                    if (folderId && folderId !== targetFolderId) {
                        await moveFolder(folderId, targetFolderId);
                    }

                    // Handle link to folder drop
                    const linkId = e.dataTransfer.getData('application/link');
                    if (linkId) {
                        await moveLink(linkId, targetFolderId);
                    }
                }

                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
            });

            setupLinkDragAndDrop();
        }

        async function moveFolder(folderId, targetFolderId) {
            const folder = bookmarkData.folders.find(f => f.id === folderId);
            if (folder) {
                // Check if target folder is not a descendant of the folder being moved
                if (isDescendant(targetFolderId, folderId)) {
                    alert("Cannot move a folder into its own subfolder!");
                    return;
                }

                folder.parentId = targetFolderId;
                await saveData();
                renderFolders();
            }
        }

        // Check if childId is a descendant of parentId
        function isDescendant(childId, parentId) {
            if (childId === parentId) return true;

            const folder = bookmarkData.folders.find(f => f.id === childId);
            if (!folder || !folder.parentId) return false;

            return isDescendant(folder.parentId, parentId);
        }

        function setupLinkDragAndDrop() {
            const linkContainers = document.querySelectorAll('.link-container');
            linkContainers.forEach(container => {
                new Sortable(container, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'drag-ghost',
                    group: 'links',
                    onEnd: async function(evt) {
                        const folderId = evt.to.dataset.folderId;
                        if (folderId) {
                            // Update links in the destination folder
                            updateLinkOrder(folderId);

                            // Update links in the source folder if different
                            if (evt.from !== evt.to && evt.from.dataset.folderId) {
                                updateLinkOrder(evt.from.dataset.folderId);
                            }

                            await saveData();
                        }
                    }
                });
            });
        }

        function updateFolderOrder() {
            const folderElements = document.querySelectorAll('#folderList > .folder');
            folderElements.forEach((el, index) => {
                const folderId = el.dataset.folderId;
                const folder = bookmarkData.folders.find(f => f.id === folderId);
                if (folder) {
                    folder.order = index;
                }
            });
        }

        function updateLinkOrder(folderId) {
            const container = document.querySelector(`.link-container[data-folder-id="${folderId}"]`);
            if (!container) return;

            const linkElements = container.querySelectorAll('.link-item');
            linkElements.forEach((el, index) => {
                const linkId = el.dataset.linkId;
                const link = bookmarkData.links.find(l => l.id === linkId);
                if (link) {
                    link.order = index;
                    link.folderId = folderId;
                }
            });
        }

        // Data migration function to convert existing plain text notes to HTML format
        function migrateNotesToRichText(notes) {
            // Check if migration is needed (no formatVersion or version < 1.0)
            if (!notes.formatVersion || notes.formatVersion < '1.0') {
                console.log('Migrating notes to rich text format...');

                // Convert plain text content to HTML
                let htmlContent = '';
                let plainContent = '';

                if (notes.content && typeof notes.content === 'string') {
                    plainContent = notes.content;
                    // Convert plain text to HTML by wrapping in paragraphs and preserving line breaks
                    htmlContent = notes.content
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .map(line => `<p>${escapeHtml(line)}</p>`)
                        .join('');

                    // If no content, use empty paragraph
                    if (!htmlContent) {
                        htmlContent = '<p></p>';
                    }
                } else {
                    htmlContent = '<p></p>';
                    plainContent = '';
                }

                // Create new enhanced notes structure
                const migratedNotes = {
                    content: htmlContent,
                    plainContent: plainContent,
                    position: notes.position || {
                        x: 50,
                        y: 100
                    },
                    size: notes.size || {
                        width: 300,
                        height: 400
                    },
                    formatVersion: '1.0'
                };

                console.log('Notes migration completed:', migratedNotes);
                return migratedNotes;
            }

            // Already migrated, ensure all required properties exist
            return {
                content: notes.content || '<p></p>',
                plainContent: notes.plainContent || '',
                position: notes.position || {
                    x: 50,
                    y: 100
                },
                size: notes.size || {
                    width: 300,
                    height: 400
                },
                formatVersion: notes.formatVersion || '1.0'
            };
        }

        // Helper function to escape HTML characters
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async function loadData() {
            try {
                console.log('Loading data...');
                const response = await fetch('bookmark_api.php?action=load');
                const data = await response.json();

                if (data.success && data.data) {
                    console.log('Data loaded successfully:', data.data);

                    // Create a deep copy to avoid reference issues
                    bookmarkData = JSON.parse(JSON.stringify(data.data));

                    // Ensure notes object exists and migrate if necessary
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
                        // Migrate existing notes to rich text format
                        bookmarkData.notes = migrateNotesToRichText(bookmarkData.notes);
                    }

                    // Ensure arrays exist
                    if (!Array.isArray(bookmarkData.folders)) {
                        bookmarkData.folders = [];
                    }
                    if (!Array.isArray(bookmarkData.links)) {
                        bookmarkData.links = [];
                    }

                    // Add order property if not exists
                    bookmarkData.folders.forEach((folder, index) => {
                        if (!folder.hasOwnProperty('order')) folder.order = index;
                        if (!folder.hasOwnProperty('parentId')) folder.parentId = null;
                    });

                    bookmarkData.links.forEach((link, index) => {
                        if (!link.hasOwnProperty('order')) link.order = index;
                    });

                    renderFolders();
                    renderLinks();

                    // Setup notes window AFTER data is loaded
                    setupNotesWindow();

                    console.log('Data loaded and UI rendered successfully');
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (error) {
                console.error('Error loading data:', error);
                // Even if there's an error, ensure we have a valid structure
                bookmarkData = {
                    folders: [],
                    links: [],
                    notes: {
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
                    }
                };
                setupNotesWindow();
            }
        }

        async function saveData() {
            try {
                // Add a small delay to prevent rapid successive saves
                if (saveData.timeout) {
                    clearTimeout(saveData.timeout);
                }

                return new Promise((resolve) => {
                    saveData.timeout = setTimeout(async () => {
                        try {
                            const response = await fetch('bookmark_api.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'save',
                                    data: bookmarkData
                                })
                            });
                            const result = await response.json();

                            if (!result.success) {
                                console.error('Save failed:', result.error);
                            }

                            resolve(result.success);
                        } catch (error) {
                            console.error('Error saving data:', error);
                            resolve(false);
                        }
                    }, 100); // Small delay to batch rapid saves
                });
            } catch (error) {
                console.error('Error in saveData:', error);
                return false;
            }
        }

        function renderFolders() {
            const folderList = document.getElementById('folderList');
            folderList.innerHTML = '';

            // Sort folders by order
            const rootFolders = bookmarkData.folders
                .filter(folder => !folder.parentId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            rootFolders.forEach(folder => {
                const folderElement = createFolderElement(folder);
                folderList.appendChild(folderElement);
            });

            updateFolderSelect();
            updateParentFolderSelect();
        }

        function createFolderElement(folder) {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder';
            if (currentFolder === folder.id) {
                folderDiv.classList.add('selected');
            }
            folderDiv.dataset.folderId = folder.id;
            folderDiv.draggable = true;

            const linkCount = bookmarkData.links.filter(link => link.folderId === folder.id).length;
            const subfolders = bookmarkData.folders.filter(f => f.parentId === folder.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            folderDiv.innerHTML = `
            <div class="folder-header" onclick="toggleFolder('${folder.id}')">
                <div class="folder-title">
                    <span class="drag-handle">⋮</span>
                    <i class="folder-icon" id="folder-icon-${folder.id}">📁</i>
                    ${folder.name} <span class="folder-count">(${linkCount})</span>
                </div>
                <div class="folder-actions">
                    <button class="action-btn edit-btn" onclick="event.stopPropagation(); editFolder('${folder.id}')" title="Edit folder"></button>
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteFolder('${folder.id}')" title="Delete folder"></button>
                </div>
            </div>
            <div class="folder-content" id="content-${folder.id}">
                <div class="subfolder-container" id="subfolder-${folder.id}"></div>
            </div>
        `;

            return folderDiv;
        }

        // function to create backups
        function createBackup() {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = JSON.stringify(bookmarkData, null, 2);
            localStorage.setItem(`bookmark_backup_${timestamp}`, backupData);

            // Keep only last 5 backups
            const keys = Object.keys(localStorage).filter(key => key.startsWith('bookmark_backup_'));
            if (keys.length > 5) {
                keys.sort();
                keys.slice(0, -5).forEach(key => localStorage.removeItem(key));
            }
        }

        // Call this before any major operation
        async function saveDataWithBackup() {
            createBackup();
            return await saveData();
        }

        // Helper function to check if a folder has subfolders
        function hasSubfolders(folderId) {
            return bookmarkData.folders.some(folder => folder.parentId === folderId);
        }

        // Helper function to auto-close empty folders (folders without subfolders)
        function autoCloseEmptyFolders(currentFolderId) {
            // Get all currently expanded folders
            const expandedFolders = document.querySelectorAll('.folder.expanded');

            expandedFolders.forEach(folderElement => {
                const folderId = folderElement.getAttribute('data-folder-id');

                // Skip the current folder being clicked
                if (folderId === currentFolderId) {
                    return;
                }

                // Check if this folder has subfolders
                if (!hasSubfolders(folderId)) {
                    // Close the folder by removing expanded class and updating icon
                    folderElement.classList.remove('expanded');

                    const folderIcon = document.getElementById(`folder-icon-${folderId}`);
                    if (folderIcon) {
                        folderIcon.textContent = '📁';
                        folderIcon.classList.remove('open');
                    }
                }
            });
        }

        function toggleFolder(folderId) {
            const folder = document.querySelector(`[data-folder-id="${folderId}"]`);
            const folderIcon = document.getElementById(`folder-icon-${folderId}`);

            // Auto-close empty folders before processing current folder
            autoCloseEmptyFolders(folderId);

            // Remove 'selected' class from all folders
            document.querySelectorAll('.folder').forEach(f => {
                f.classList.remove('selected');
            });

            // Add 'selected' class to the clicked folder
            folder.classList.add('selected');

            if (folder.classList.contains('expanded')) {
                folder.classList.remove('expanded');
                folderIcon.textContent = '📁';
                folderIcon.classList.remove('open');
            } else {
                folder.classList.add('expanded');
                folderIcon.textContent = '📂';
                folderIcon.classList.add('open');

                // Render subfolders
                const subfolderContainer = document.getElementById(`subfolder-${folderId}`);
                if (subfolderContainer) {
                    subfolderContainer.innerHTML = '';

                    const subfolders = bookmarkData.folders
                        .filter(f => f.parentId === folderId)
                        .sort((a, b) => (a.order || 0) - (b.order || 0));

                    subfolders.forEach(subfolder => {
                        const folderElement = createFolderElement(subfolder);
                        subfolderContainer.appendChild(folderElement);
                    });

                    // Setup sortable for subfolders
                    new Sortable(subfolderContainer, {
                        animation: 150,
                        handle: '.drag-handle',
                        ghostClass: 'drag-ghost',
                        group: 'folders',
                        onEnd: async function() {
                            updateSubfolderOrder(folderId);
                            await saveData();
                        }
                    });
                }
            }

            currentFolder = folderId;
            renderLinks();
        }

        function updateSubfolderOrder(parentId) {
            const container = document.getElementById(`subfolder-${parentId}`);
            if (!container) return;

            const folderElements = container.querySelectorAll('.folder');
            folderElements.forEach((el, index) => {
                const folderId = el.dataset.folderId;
                const folder = bookmarkData.folders.find(f => f.id === folderId);
                if (folder) {
                    folder.order = index;
                    folder.parentId = parentId;
                }
            });
        }

        function renderLinks() {
            const linkList = document.getElementById('linkList');
            linkList.innerHTML = '';

            if (!currentFolder && !searchTerm) {
                linkList.innerHTML = '<div class="empty-state">Select a folder to view links</div>';
                return;
            }

            let linksToShow;

            if (searchTerm) {
                // Enhanced search: split search terms and match all words
                const searchWords = searchTerm.trim().split(/\s+/).filter(word => word.length > 0);

                linksToShow = bookmarkData.links.filter(link => {
                    const titleLower = link.title.toLowerCase();
                    const urlLower = link.url.toLowerCase();
                    const combinedText = titleLower + ' ' + urlLower;

                    // Check if ALL search words are found in either title or URL
                    return searchWords.every(word =>
                        combinedText.includes(word.toLowerCase())
                    );
                }).sort((a, b) => {
                    // Enhanced sorting: prioritize matches in title, then by relevance
                    const getRelevanceScore = (link) => {
                        let score = 0;
                        const title = link.title.toLowerCase();
                        const url = link.url.toLowerCase();

                        searchWords.forEach(word => {
                            const wordLower = word.toLowerCase();

                            // Higher score for title matches
                            if (title.includes(wordLower)) {
                                score += 10;
                                // Even higher score if word appears at the beginning of title
                                if (title.startsWith(wordLower)) {
                                    score += 20;
                                }
                            }

                            // Lower score for URL matches
                            if (url.includes(wordLower)) {
                                score += 5;
                            }

                            // Bonus for exact phrase matches
                            const searchPhrase = searchTerm.toLowerCase();
                            if (title.includes(searchPhrase)) {
                                score += 15;
                            }
                            if (url.includes(searchPhrase)) {
                                score += 8;
                            }
                        });

                        return score;
                    };

                    const scoreA = getRelevanceScore(a);
                    const scoreB = getRelevanceScore(b);

                    // Sort by relevance score (higher first), then by original order
                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }
                    return (a.order || 0) - (b.order || 0);
                });

                if (linksToShow.length === 0) {
                    linkList.innerHTML = '<div class="empty-state">No matching links found</div>';
                    return;
                }

                linkList.innerHTML = `
                <div class="folder-header-big">
                    <h2>Search Results</h2>
                </div>
                <div class="link-container" id="main-link-container"></div>
            `;
            } else if (currentFolder) {
                linksToShow = bookmarkData.links
                    .filter(link => link.folderId === currentFolder)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));

                const folder = bookmarkData.folders.find(f => f.id === currentFolder);
                const folderName = folder ? folder.name : '';

                linkList.innerHTML = `
                <div class="folder-header-big">
                    <h2><i class="folder-icon">📂</i> ${folderName}</h2>
                </div>
                <div class="link-container" id="main-link-container" data-folder-id="${currentFolder}"></div>
            `;

                if (linksToShow.length === 0) {
                    document.getElementById('main-link-container').innerHTML =
                        '<div class="empty-state">No links in this folder</div>';
                    return;
                }
            } else {
                return;
            }

            const container = document.getElementById('main-link-container');

            linksToShow.forEach(link => {
                const linkDiv = createLinkElement(link);
                container.appendChild(linkDiv);
            });

            // Setup sortable for links container
            new Sortable(container, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'drag-ghost',
                group: 'links',
                onEnd: async function() {
                    if (currentFolder) {
                        updateLinkOrder(currentFolder);
                        await saveData();
                    }
                }
            });
        }

        function createLinkElement(link) {
            const linkDiv = document.createElement('div');
            linkDiv.className = 'link-item';
            linkDiv.dataset.linkId = link.id;
            linkDiv.draggable = true;

            const folder = bookmarkData.folders.find(f => f.id === link.folderId);
            const folderName = folder ? folder.name : 'No folder';

            // Get favicon URL
            let faviconUrl;
            try {
                faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}`;
            } catch (e) {
                faviconUrl = ''; // Invalid URL
            }

            linkDiv.innerHTML = `
            <span class="drag-handle">⋮</span>
            <img class="favicon" src="${faviconUrl}" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QUFDTgmJYgH6QAAAIpJREFUOMvd0CEOwkAUhOH/LYEEsYhijasIakp7AHqEHoJbcITS3oFggm0waEmANVmVYgPBbDDF8yXzzMy+SZr40yqyCWrM0OLc50vUeKKJGVZ40CwxwghTpCyf+GAeR1hjF3P+xt3+zbDENSROnfjeOF8PmVOWu5C0R1jAn0QTnLAtG/5KGwpMsMeui/8JHRfTLSexER0AAAAASUVORK5CYII='" alt="">
            <div class="link-title">${link.title}</div>
            <a href="${link.url}" target="_blank" class="link-url">${link.url}</a>
            ${searchTerm ? `<div style="font-size: 10px; color: #888; margin-left: auto; margin-right: 8px;">${folderName}</div>` : ''}
            <div class="link-actions">
                <button class="action-btn edit-btn" onclick="editLink('${link.id}')" title="Edit bookmark"></button>
                <button class="action-btn delete-btn" onclick="deleteLink('${link.id}')" title="Delete bookmark"></button>
            </div>
        `;

            return linkDiv;
        }

        function updateFolderSelect() {
            const select = document.getElementById('linkFolder');
            if (!select) return;

            select.innerHTML = '<option value="">Select folder...</option>';

            // Function to recursively add folders with proper indentation
            function addFoldersRecursive(folders, level = 0, parentId = null) {
                const indent = '-'.repeat(level);

                folders
                    .filter(folder => folder.parentId === parentId)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .forEach(folder => {
                        const option = document.createElement('option');
                        option.value = folder.id;
                        option.textContent = indent + ' ' + folder.name;
                        select.appendChild(option);

                        // Add children
                        addFoldersRecursive(folders, level + 1, folder.id);
                    });
            }

            addFoldersRecursive(bookmarkData.folders);
        }

        function updateParentFolderSelect() {
            const select = document.getElementById('parentFolder');
            if (!select) return;

            select.innerHTML = '<option value="">None (Root level)</option>';

            // Function to recursively add folders with proper indentation
            function addFoldersRecursive(folders, level = 0, parentId = null, currentId = null) {
                const indent = '-'.repeat(level);

                folders
                    .filter(folder => folder.parentId === parentId && folder.id !== currentId)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .forEach(folder => {
                        // Skip this folder and its children if it's the one we're editing
                        if (folder.id === currentEditId) return;

                        const option = document.createElement('option');
                        option.value = folder.id;
                        option.textContent = indent + ' ' + folder.name;
                        select.appendChild(option);

                        // Add children only if they're not descendants of currentEditId
                        if (!isDescendant(folder.id, currentEditId)) {
                            addFoldersRecursive(folders, level + 1, folder.id, currentEditId);
                        }
                    });
            }

            addFoldersRecursive(bookmarkData.folders);
        }

        // Modal functions
        function showAddFolderModal() {
            currentEditId = null;
            document.getElementById('folderName').value = '';
            document.getElementById('parentFolder').value = '';
            updateParentFolderSelect();
            document.getElementById('folderModal').style.display = 'block';

            // Set up Enter key functionality for folder modal
            setupFolderModalHandlers();
        }

        function showAddLinkModal() {
            currentEditId = null;
            document.getElementById('linkTitle').value = '';
            document.getElementById('linkUrl').value = '';
            updateFolderSelect();
            document.getElementById('linkFolder').value = currentFolder || '';
            document.getElementById('linkModal').style.display = 'block';

            // Set up auto-fetch and keyboard handlers for new link
            setupLinkModalHandlers();
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        function editFolder(folderId) {
            const folder = bookmarkData.folders.find(f => f.id === folderId);
            if (folder) {
                currentEditId = folderId;
                document.getElementById('folderName').value = folder.name;
                document.getElementById('parentFolder').value = folder.parentId || '';
                updateParentFolderSelect(); // Update without current folder as an option
                document.getElementById('folderModal').style.display = 'block';

                // Set up Enter key functionality for folder modal (edit mode)
                setupFolderModalHandlers();
            }
        }

        // Setup Enter key functionality for folder modal
        function setupFolderModalHandlers() {
            const folderNameInput = document.getElementById('folderName');
            const parentFolderSelect = document.getElementById('parentFolder');

            // Remove any existing event listeners to avoid duplicates
            const newFolderNameInput = folderNameInput.cloneNode(true);
            const newParentFolderSelect = parentFolderSelect.cloneNode(true);

            folderNameInput.parentNode.replaceChild(newFolderNameInput, folderNameInput);
            parentFolderSelect.parentNode.replaceChild(newParentFolderSelect, parentFolderSelect);

            // Enter key to save functionality
            function handleEnterKey(e) {
                if (e.key === 'Enter') {
                    const folderName = newFolderNameInput.value.trim();

                    // Only save if folder name is filled
                    if (folderName) {
                        e.preventDefault();
                        saveFolder();
                    }
                }
            }

            newFolderNameInput.addEventListener('keydown', handleEnterKey);
            newParentFolderSelect.addEventListener('keydown', handleEnterKey);

            // Focus on the folder name input for better UX
            setTimeout(() => {
                newFolderNameInput.focus();
                newFolderNameInput.select(); // Select all text for easy editing
            }, 100);
        }

        function editLink(linkId) {
            const link = bookmarkData.links.find(l => l.id === linkId);
            if (link) {
                currentEditId = linkId;
                document.getElementById('linkTitle').value = link.title;
                document.getElementById('linkUrl').value = link.url;
                updateFolderSelect();
                document.getElementById('linkFolder').value = link.folderId;
                document.getElementById('linkModal').style.display = 'block';

                // Set up handlers for edit mode (but don't auto-fetch since title already exists)
                setupLinkModalHandlers(false); // false = don't auto-fetch for existing links
            }
        }

        // Setup auto-fetch title and keyboard handlers for link modal
        function setupLinkModalHandlers(enableAutoFetch = true) {
            const titleInput = document.getElementById('linkTitle');
            const urlInput = document.getElementById('linkUrl');
            const folderSelect = document.getElementById('linkFolder');

            // Remove any existing event listeners to avoid duplicates
            // Store the current folder selection before replacing elements
            const currentFolderValue = folderSelect.value;

            const newTitleInput = titleInput.cloneNode(true);
            const newUrlInput = urlInput.cloneNode(true);
            const newFolderSelect = folderSelect.cloneNode(true);

            titleInput.parentNode.replaceChild(newTitleInput, titleInput);
            urlInput.parentNode.replaceChild(newUrlInput, urlInput);
            folderSelect.parentNode.replaceChild(newFolderSelect, folderSelect);

            // Restore the folder selection
            newFolderSelect.value = currentFolderValue;

            // Auto-fetch title functionality
            if (enableAutoFetch) {
                newUrlInput.addEventListener('blur', async function() {
                    const url = this.value.trim();
                    const title = newTitleInput.value.trim();

                    // Only fetch title if title is empty and URL is provided
                    if (!title && url && isValidUrl(url)) {
                        await fetchAndSetTitle(url, newTitleInput);
                    }
                });

                newUrlInput.addEventListener('paste', async function() {
                    // Wait a bit for paste to complete
                    setTimeout(async () => {
                        const url = this.value.trim();
                        const title = newTitleInput.value.trim();

                        if (!title && url && isValidUrl(url)) {
                            await fetchAndSetTitle(url, newTitleInput);
                        }
                    }, 100);
                });
            }

            // Enter key to save functionality
            function handleEnterKey(e) {
                if (e.key === 'Enter') {
                    const title = newTitleInput.value.trim();
                    const url = newUrlInput.value.trim();

                    // Only save if both fields are filled
                    if (title && url) {
                        e.preventDefault();
                        saveLink();
                    }
                }
            }

            newTitleInput.addEventListener('keydown', handleEnterKey);
            newUrlInput.addEventListener('keydown', handleEnterKey);
            newFolderSelect.addEventListener('keydown', handleEnterKey);
        }

        // Validate if a string is a valid URL
        function isValidUrl(string) {
            try {
                const url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                // Try adding https:// if no protocol
                try {
                    const url = new URL('https://' + string);
                    return true;
                } catch (_) {
                    return false;
                }
            }
        }

        // Fetch title from URL and set it in the title input
        async function fetchAndSetTitle(url, titleInput) {
            try {
                // Show loading indicator
                const originalPlaceholder = titleInput.placeholder;
                titleInput.placeholder = 'Fetching title...';
                titleInput.style.backgroundColor = '#f0f8ff';

                // Ensure URL has protocol
                let fetchUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    fetchUrl = 'https://' + url;
                }

                // Use a CORS proxy or try direct fetch
                let title = '';

                try {
                    // Try direct fetch first (will work for same-origin or CORS-enabled sites)
                    const response = await fetch(fetchUrl, {
                        method: 'GET',
                        mode: 'cors',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; BookmarkManager/1.0)'
                        }
                    });

                    if (response.ok) {
                        const html = await response.text();
                        title = extractTitleFromHtml(html);
                    }
                } catch (corsError) {
                    console.log('Direct fetch failed, trying alternative methods:', corsError);

                    // Fallback: try to extract title from URL structure
                    title = generateTitleFromUrl(fetchUrl);
                }

                // Set the title if we got one
                if (title) {
                    titleInput.value = title;
                    titleInput.style.backgroundColor = '#f0fff0'; // Light green to indicate success

                    // Reset background after a moment
                    setTimeout(() => {
                        titleInput.style.backgroundColor = '';
                    }, 2000);
                } else {
                    titleInput.style.backgroundColor = '#fff8dc'; // Light yellow to indicate partial success
                    setTimeout(() => {
                        titleInput.style.backgroundColor = '';
                    }, 2000);
                }

                // Restore placeholder
                titleInput.placeholder = originalPlaceholder;

            } catch (error) {
                console.error('Error fetching title:', error);
                titleInput.placeholder = 'Could not fetch title';
                titleInput.style.backgroundColor = '#ffe4e1'; // Light red to indicate error

                setTimeout(() => {
                    titleInput.placeholder = '';
                    titleInput.style.backgroundColor = '';
                }, 3000);
            }
        }

        // Extract title from HTML content
        function extractTitleFromHtml(html) {
            try {
                // Create a temporary DOM element to parse HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Try to get title from <title> tag
                const titleElement = doc.querySelector('title');
                if (titleElement && titleElement.textContent.trim()) {
                    return titleElement.textContent.trim();
                }

                // Fallback: try meta og:title
                const ogTitle = doc.querySelector('meta[property="og:title"]');
                if (ogTitle && ogTitle.getAttribute('content')) {
                    return ogTitle.getAttribute('content').trim();
                }

                // Fallback: try meta twitter:title
                const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
                if (twitterTitle && twitterTitle.getAttribute('content')) {
                    return twitterTitle.getAttribute('content').trim();
                }

                // Fallback: try first h1
                const h1 = doc.querySelector('h1');
                if (h1 && h1.textContent.trim()) {
                    return h1.textContent.trim();
                }

                return '';
            } catch (error) {
                console.error('Error extracting title from HTML:', error);
                return '';
            }
        }

        // Generate a reasonable title from URL structure
        function generateTitleFromUrl(url) {
            try {
                const urlObj = new URL(url);
                let title = '';

                // Try to get a meaningful name from the hostname
                const hostname = urlObj.hostname.replace('www.', '');
                const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

                if (pathParts.length > 0) {
                    // Use the last meaningful path part
                    const lastPart = pathParts[pathParts.length - 1];
                    title = lastPart.replace(/[-_]/g, ' ').replace(/\.(html|php|asp|jsp)$/i, '');

                    // Capitalize first letter of each word
                    title = title.split(' ').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');

                    // Add hostname for context
                    title += ` - ${hostname}`;
                } else {
                    // Just use the hostname
                    title = hostname.split('.')[0];
                    title = title.charAt(0).toUpperCase() + title.slice(1);
                }

                return title;
            } catch (error) {
                console.error('Error generating title from URL:', error);
                return '';
            }
        }

        async function saveFolder() {
            const name = document.getElementById('folderName').value.trim();
            const parentId = document.getElementById('parentFolder').value || null;
            if (!name) return;

            if (currentEditId) {
                const folder = bookmarkData.folders.find(f => f.id === currentEditId);
                if (folder) {
                    // Check if trying to make a folder a child of one of its descendants
                    if (parentId && isDescendant(parentId, folder.id)) {
                        alert('Cannot make a folder a child of one of its own subfolders!');
                        return;
                    }

                    folder.name = name;
                    folder.parentId = parentId;
                }
            } else {
                const newFolder = {
                    id: Date.now().toString(),
                    name: name,
                    parentId: parentId,
                    order: bookmarkData.folders.length
                };
                bookmarkData.folders.push(newFolder);
            }

            await saveData();
            renderFolders();
            closeModal('folderModal');
        }

        async function saveLink() {
            const title = document.getElementById('linkTitle').value.trim();
            const url = document.getElementById('linkUrl').value.trim();
            const folderId = document.getElementById('linkFolder').value;

            if (!title || !url) return;

            // Add http:// if no protocol specified
            let processedUrl = url;
            if (!/^https?:\/\//i.test(processedUrl)) {
                processedUrl = 'http://' + processedUrl;
            }

            if (currentEditId) {
                const link = bookmarkData.links.find(l => l.id === currentEditId);
                if (link) {
                    link.title = title;
                    link.url = processedUrl;
                    link.folderId = folderId;
                }
            } else {
                bookmarkData.links.push({
                    id: Date.now().toString(),
                    title: title,
                    url: processedUrl,
                    folderId: folderId,
                    order: bookmarkData.links.filter(l => l.folderId === folderId).length
                });
            }

            await saveData();
            renderFolders();
            renderLinks();
            closeModal('linkModal');
        }

        async function deleteFolder(folderId) {
            if (!confirm('Delete folder and all its links?')) return;

            // First, get all descendant folder IDs
            const descendantIds = getAllDescendantFolderIds(folderId);
            const allFolderIdsToDelete = [folderId, ...descendantIds];

            // Remove all folders and their links
            bookmarkData.folders = bookmarkData.folders.filter(f => !allFolderIdsToDelete.includes(f.id));
            bookmarkData.links = bookmarkData.links.filter(l => !allFolderIdsToDelete.includes(l.folderId));

            await saveData();
            if (currentFolder === folderId) {
                currentFolder = null;
            }
            renderFolders();
            renderLinks();
        }

        function getAllDescendantFolderIds(folderId) {
            const result = [];
            const childFolders = bookmarkData.folders.filter(f => f.parentId === folderId);

            childFolders.forEach(folder => {
                result.push(folder.id);
                const descendants = getAllDescendantFolderIds(folder.id);
                result.push(...descendants);
            });

            return result;
        }

        async function deleteLink(linkId) {
            if (!confirm('Delete this link?')) return;

            bookmarkData.links = bookmarkData.links.filter(l => l.id !== linkId);
            await saveData();
            renderFolders();
            renderLinks();
        }

        async function moveLink(linkId, folderId) {
            const link = bookmarkData.links.find(l => l.id === linkId);
            if (link) {
                const oldFolderId = link.folderId;
                link.folderId = folderId;
                link.order = bookmarkData.links.filter(l => l.folderId === folderId).length;
                await saveData();

                // Update folder counts in UI
                renderFolders();

                // If the current view is the source or destination folder, update it
                if (currentFolder === oldFolderId || currentFolder === folderId) {
                    renderLinks();
                }
            }
        }

        function exportData() {
            const dataStr = JSON.stringify(bookmarkData, null, 2);
            const dataBlob = new Blob([dataStr], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'bookmarks.json';
            link.click();
        }

        function importData(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (confirm('Replace all current bookmarks and notes with imported data?')) {
                            bookmarkData = imported;

                            // Ensure notes object exists
                            if (!bookmarkData.notes) {
                                bookmarkData.notes = {
                                    content: '',
                                    position: {
                                        x: 50,
                                        y: 100
                                    },
                                    size: {
                                        width: 300,
                                        height: 400
                                    }
                                };
                            }

                            await saveData();
                            renderFolders();
                            renderLinks();

                            // Update notes window if it's open
                            const notesEditor = document.getElementById('notesEditor');
                            const notesWindow = document.getElementById('notesWindow');
                            if (notesEditor) {
                                const displayContent = bookmarkData.notes.content || '<p></p>';
                                notesEditor.innerHTML = displayContent;
                            }

                            // Update notes window position and size
                            if (bookmarkData.notes.position) {
                                notesWindow.style.left = bookmarkData.notes.position.x + 'px';
                                notesWindow.style.top = bookmarkData.notes.position.y + 'px';
                            }
                            if (bookmarkData.notes.size) {
                                notesWindow.style.width = bookmarkData.notes.size.width + 'px';
                                notesWindow.style.height = bookmarkData.notes.size.height + 'px';
                            }
                        }
                    } catch (error) {
                        alert('Invalid JSON file');
                    }
                };
                reader.readAsText(file);
            }
        }